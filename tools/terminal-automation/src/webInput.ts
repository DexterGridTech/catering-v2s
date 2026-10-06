import {randomUUID} from 'node:crypto';
import {filter, firstValueFrom, Subject, take, timeout, toArray} from 'rxjs';
import type {Locator} from 'playwright';
import type {AutomationDriverServer} from './server.js';

type JsonRecord = Readonly<Record<string, unknown>>;
type WebBounds = Readonly<{readonly x: number; readonly y: number; readonly width: number; readonly height: number}>;
type NodeRecord = Readonly<{
  readonly nodeInstanceId: string;
  readonly testID: string;
  readonly surface: Readonly<{readonly surface: string; readonly displayIndex: number | null}>;
  readonly surfaceLayoutRevision: number;
}>;

type WebNodeInput = Readonly<{
  readonly server: AutomationDriverServer;
  readonly sessionId: string;
  readonly surfaceRoot: Locator;
  readonly testID: string;
  readonly surface: 'PRIMARY' | 'SECONDARY';
  readonly displayIndex: number;
}>;

const BOUNDS_TOLERANCE_CSS_PIXELS = 1;
const BOUNDS_STABILITY_TOLERANCE_CSS_PIXELS = 0.05;
const BOUNDS_STABLE_FRAME_COUNT = 2;
const BOUNDS_STABILITY_MAX_FRAMES = 120;
const VIRTUAL_KEYBOARD_TEST_ID_PREFIX = 'ui.base.input:virtual-keyboard:';
const WEB_KEYBOARD_MOUNT_TIMEOUT_MS = 2_000;
const WEB_KEYBOARD_ACTIONABILITY_TIMEOUT_MS = 2_000;

const record = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null;

const responseResult = (response: Awaited<ReturnType<AutomationDriverServer['request']>>): unknown => {
  if (response.type === 'error') {
    const body = response.body;
    throw new Error(record(body) && typeof body.code === 'string' ? body.code : 'TERMINAL_AUTOMATION_AGENT_ERROR');
  }
  if (response.type !== 'response' || !record(response.body) || !('result' in response.body)) {
    throw new Error('TERMINAL_AUTOMATION_AGENT_RESPONSE_INVALID');
  }
  return response.body.result;
};

const asNode = (value: unknown): NodeRecord | null => {
  if (!record(value) || !record(value.surface)) return null;
  if (
    typeof value.nodeInstanceId !== 'string' ||
    typeof value.testID !== 'string' ||
    typeof value.surface.surface !== 'string' ||
    !(typeof value.surface.displayIndex === 'number' || value.surface.displayIndex === null) ||
    !Number.isSafeInteger(value.surface.layoutRevision)
  ) {
    return null;
  }
  return {
    nodeInstanceId: value.nodeInstanceId,
    testID: value.testID,
    surface: {surface: value.surface.surface, displayIndex: value.surface.displayIndex},
    surfaceLayoutRevision: value.surface.layoutRevision as number,
  };
};

const requireUniqueNode = (result: unknown, testID: string): NodeRecord => {
  if (!record(result) || !Array.isArray(result.nodes)) {
    throw new Error('TERMINAL_AUTOMATION_CONTROL_QUERY_INVALID');
  }
  const nodes = result.nodes.map(asNode);
  if (nodes.some(node => node === null)) throw new Error('TERMINAL_AUTOMATION_CONTROL_NODE_INVALID');
  const matches = nodes.filter((node): node is NodeRecord => node?.testID === testID);
  if (matches.length === 0) throw new Error('TERMINAL_AUTOMATION_NODE_NOT_FOUND');
  if (matches.length !== 1) throw new Error('TERMINAL_AUTOMATION_NODE_AMBIGUOUS');
  return matches[0];
};

const matchesBounds = (
  actual: Readonly<{readonly x: number; readonly y: number; readonly width: number; readonly height: number}>,
  expected: Readonly<{readonly x: number; readonly y: number; readonly width: number; readonly height: number}>,
): boolean =>
  [
    Math.abs(actual.x - expected.x),
    Math.abs(actual.y - expected.y),
    Math.abs(actual.width - expected.width),
    Math.abs(actual.height - expected.height),
  ].every(difference => Number.isFinite(difference) && difference <= BOUNDS_TOLERANCE_CSS_PIXELS);

const readDomBounds = (locator: Locator): Promise<WebBounds> =>
  locator.evaluate((element): WebBounds => {
    const {x, y, width, height} = element.getBoundingClientRect();
    return {x, y, width, height};
  });

const readDomBoundsOnFrame = (locator: Locator): Promise<WebBounds> =>
  locator.evaluate(
    (element): Promise<WebBounds> =>
      new Promise<WebBounds>(resolve => {
        const sample = (): void => {
          const {x, y, width, height} = element.getBoundingClientRect();
          resolve({x, y, width, height});
        };
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(sample);
        else sample();
      }),
  );

const waitForStableDomBounds = async (locator: Locator, testID: string): Promise<void> => {
  let previous: WebBounds | undefined;
  let consecutiveStableFrames = 0;
  for (let frame = 0; frame < BOUNDS_STABILITY_MAX_FRAMES; frame += 1) {
    const current = await readDomBoundsOnFrame(locator);
    if (
      previous !== undefined &&
      [
        Math.abs(current.x - previous.x),
        Math.abs(current.y - previous.y),
        Math.abs(current.width - previous.width),
        Math.abs(current.height - previous.height),
      ].every(difference => difference <= BOUNDS_STABILITY_TOLERANCE_CSS_PIXELS)
    ) {
      consecutiveStableFrames += 1;
      if (consecutiveStableFrames >= BOUNDS_STABLE_FRAME_COUNT) return;
    } else {
      consecutiveStableFrames = 0;
    }
    previous = current;
  }
  throw new Error(`TERMINAL_AUTOMATION_WEB_NODE_BOUNDS_NOT_STABLE testID=${testID}`);
};

const locatorDiagnosticOf = async (locator: Locator): Promise<string> => {
  const matches = await locator.evaluateAll(elements =>
    elements.slice(0, 8).map(element => {
      const positionedLayer = element.closest('[data-testid^="ui.base.input:keyboard-layer-position:"]');
      const keyboardLayer = element.closest('[data-testid^="ui.base.input:keyboard-layer:"]');
      const rect = element.getBoundingClientRect();
      return {
        tag: element.tagName,
        testID: element.getAttribute('data-testid'),
        positionedLayer: positionedLayer?.getAttribute('data-testid') ?? null,
        keyboardLayer: keyboardLayer?.getAttribute('data-testid') ?? null,
        nativeID: element.getAttribute('data-nativeid'),
        ariaHidden: element.getAttribute('aria-hidden'),
        disabled: element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true',
        pointerEvents: getComputedStyle(element).pointerEvents,
        bounds: {x: rect.x, y: rect.y, width: rect.width, height: rect.height},
      };
    }),
  );
  return JSON.stringify(matches);
};

const locateRegisteredWebNode = async (input: WebNodeInput) => {
  const locator = input.surfaceRoot.getByTestId(input.testID);
  if (input.testID.startsWith(VIRTUAL_KEYBOARD_TEST_ID_PREFIX)) {
    const deadline = Date.now() + WEB_KEYBOARD_MOUNT_TIMEOUT_MS;
    try {
      await locator.waitFor({state: 'visible', timeout: WEB_KEYBOARD_MOUNT_TIMEOUT_MS});
    } catch {
      throw new Error(
        `TERMINAL_AUTOMATION_WEB_KEYBOARD_TARGET_NOT_VISIBLE testID=${input.testID} timeoutMs=${WEB_KEYBOARD_MOUNT_TIMEOUT_MS}`,
      );
    }
    try {
      // InputSurfaceFrame intentionally keeps keys disabled through measure/enter/handoff/exit.
      // Ask Playwright to wait for real click actionability without sending a click.
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) throw new Error('TERMINAL_AUTOMATION_WEB_KEYBOARD_READINESS_DEADLINE');
      await locator.click({trial: true, timeout: Math.min(remainingMs, WEB_KEYBOARD_ACTIONABILITY_TIMEOUT_MS)});
    } catch {
      const diagnostic = await locatorDiagnosticOf(locator);
      throw new Error(
        `TERMINAL_AUTOMATION_WEB_KEYBOARD_TARGET_NOT_ACTIONABLE testID=${input.testID} timeoutMs=${WEB_KEYBOARD_ACTIONABILITY_TIMEOUT_MS} nodes=${diagnostic}`,
      );
    }
  }
  const count = await locator.count();
  if (count === 0) throw new Error(`TERMINAL_AUTOMATION_WEB_LOCATOR_NOT_FOUND testID=${input.testID}`);
  if (count > 1) {
    const diagnostic = await locatorDiagnosticOf(locator);
    throw new Error(
      `TERMINAL_AUTOMATION_WEB_LOCATOR_AMBIGUOUS testID=${input.testID} count=${count} nodes=${diagnostic}`,
    );
  }
  if (!(await locator.isVisible()) || !(await locator.isEnabled())) {
    const diagnostic = await locatorDiagnosticOf(locator);
    throw new Error(`TERMINAL_AUTOMATION_WEB_LOCATOR_NOT_ACTIONABLE testID=${input.testID} nodes=${diagnostic}`);
  }
  await waitForStableDomBounds(locator, input.testID);

  const initial = responseResult(
    await input.server.request(input.sessionId, 'controls.query', {
      filter: {testID: input.testID, surface: input.surface, displayIndex: input.displayIndex},
    }),
  );
  const node = requireUniqueNode(initial, input.testID);
  if (node.surface.surface !== input.surface || node.surface.displayIndex !== input.displayIndex) {
    throw new Error('TERMINAL_AUTOMATION_NODE_SURFACE_MISMATCH');
  }
  const boundsResult = responseResult(
    await input.server.request(input.sessionId, 'controls.bounds', {
      nodeInstanceId: node.nodeInstanceId,
      layoutRevision: node.surfaceLayoutRevision,
    }),
  );
  if (!record(boundsResult) || !record(boundsResult.bounds)) {
    throw new Error('TERMINAL_AUTOMATION_NODE_BOUNDS_INVALID');
  }
  const bounds = boundsResult.bounds;
  if (
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(
      value => typeof value === 'number' && Number.isFinite(value),
    )
  ) {
    throw new Error('TERMINAL_AUTOMATION_NODE_BOUNDS_INVALID');
  }
  const domBounds = await readDomBounds(locator);
  if (domBounds === null || !matchesBounds(domBounds, bounds as typeof domBounds)) {
    throw new Error(
      `TERMINAL_AUTOMATION_WEB_NODE_IDENTITY_MISMATCH testID=${input.testID} registered=${JSON.stringify(bounds)} dom=${JSON.stringify(domBounds)}`,
    );
  }
  return Object.freeze({node, locator});
};

/** Focuses a real text input. TextInput has no pressable interaction contract;
 * the caller proves focus by entering text through the visible virtual keyboard. */
export const focusRegisteredWebInput = async (input: WebNodeInput): Promise<void> => {
  const {locator} = await locateRegisteredWebNode(input);
  await locator.click();
  const focused = await locator.evaluate(element => element === document.activeElement);
  if (!focused) throw new Error('TERMINAL_AUTOMATION_WEB_INPUT_FOCUS_NOT_OBSERVED');
};

export const clickRegisteredWebNode = async (
  input: WebNodeInput & Readonly<{readonly interactionTimeoutMs?: number}>,
): Promise<Readonly<{readonly nodeInstanceId: string; readonly layoutRevision: number}>> => {
  const {node, locator} = await locateRegisteredWebNode(input);

  const subscriptionId = `web-input-${randomUUID()}`;
  const interactions = new Subject<Readonly<{readonly phase: string; readonly nodeInstanceId: string}>>();
  const interactionEvidence: string[] = [];
  const removeListener = input.server.onMessage(input.sessionId, message => {
    if (!record(message.body) || message.body.subscriptionId !== subscriptionId) return;
    if (message.type === 'error') {
      interactions.error(
        new Error(
          `TERMINAL_AUTOMATION_WEB_CONTROL_SUBSCRIPTION_FAILED code=${typeof message.body.code === 'string' ? message.body.code : 'UNKNOWN'}`,
        ),
      );
      return;
    }
    if (message.type !== 'event') return;
    const interaction = message.body.interaction;
    if (!record(interaction) || !record(interaction.node)) return;
    const eventNode = interaction.node;
    if (!record(eventNode.surface)) return;
    const matchesTarget =
      eventNode.testID === input.testID &&
      eventNode.surface.surface === input.surface &&
      eventNode.surface.displayIndex === input.displayIndex;
    const matchesRevision = eventNode.surface.layoutRevision === node.surfaceLayoutRevision;
    interactionEvidence.push(
      `${String(interaction.phase)}:node=${String(eventNode.nodeInstanceId)}:testID=${String(eventNode.testID)}:surface=${String(eventNode.surface.surface)}:${String(eventNode.surface.displayIndex)}:revision=${String(eventNode.surface.layoutRevision)}:matchesInitialNode=${String(eventNode.nodeInstanceId === node.nodeInstanceId)}:matchesTarget=${String(matchesTarget)}:matchesRevision=${String(matchesRevision)}`,
    );
    if (
      typeof interaction.phase === 'string' &&
      typeof eventNode.nodeInstanceId === 'string' &&
      matchesTarget &&
      matchesRevision
    ) {
      interactions.next({phase: interaction.phase, nodeInstanceId: eventNode.nodeInstanceId});
    }
  });
  let subscribed = false;
  try {
    const subscribeResponse = await input.server.request(input.sessionId, 'controls.subscribe', {
      subscriptionId,
      filter: {testID: input.testID, surface: input.surface, displayIndex: input.displayIndex},
    });
    const subscribeResult = responseResult(subscribeResponse);
    subscribed = subscribeResponse.type === 'response';
    if (!record(subscribeResult) || !Array.isArray(subscribeResult.nodes)) {
      throw new Error('TERMINAL_AUTOMATION_CONTROL_SUBSCRIBE_INVALID');
    }
    const subscribedNode = requireUniqueNode(subscribeResult, input.testID);
    if (
      subscribedNode.nodeInstanceId !== node.nodeInstanceId ||
      subscribedNode.surfaceLayoutRevision !== node.surfaceLayoutRevision
    ) {
      throw new Error('TERMINAL_AUTOMATION_NODE_CHANGED_BEFORE_INPUT');
    }
    const observed = firstValueFrom(
      interactions.pipe(take(2), toArray(), timeout({first: input.interactionTimeoutMs ?? 2_000})),
    );
    await locator.click();
    let phases: readonly Readonly<{readonly phase: string; readonly nodeInstanceId: string}>[];
    try {
      phases = await observed;
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new Error(
          `TERMINAL_AUTOMATION_WEB_PRESS_EVENTS_TIMEOUT testID=${input.testID} expectedNode=${node.nodeInstanceId} expectedRevision=${node.surfaceLayoutRevision} interactions=${interactionEvidence.join('|') || 'none'}`,
        );
      }
      throw error;
    }
    if (phases.map(event => event.phase).join(',') !== 'press-in,press-out') {
      throw new Error('TERMINAL_AUTOMATION_WEB_PRESS_EVENTS_INCOMPLETE');
    }
    if (phases[0]?.nodeInstanceId !== phases[1]?.nodeInstanceId) {
      throw new Error(`TERMINAL_AUTOMATION_WEB_PRESS_NODE_CHANGED_DURING_INPUT testID=${input.testID}`);
    }
    return Object.freeze({nodeInstanceId: phases[0]!.nodeInstanceId, layoutRevision: node.surfaceLayoutRevision});
  } finally {
    interactions.complete();
    removeListener();
    if (subscribed) {
      responseResult(await input.server.request(input.sessionId, 'controls.unsubscribe', {subscriptionId}));
    }
  }
};
