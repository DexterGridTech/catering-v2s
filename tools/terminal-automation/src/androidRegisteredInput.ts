import {randomUUID} from 'node:crypto';
import {filter, firstValueFrom, ReplaySubject, Subject, take, timeout, toArray} from 'rxjs';
import type {AutomationDriverServer} from './server.js';
import type {AndroidClickPacing, AndroidInput, AndroidSurface} from './androidInput.js';
import type {AndroidLogicalBounds, AndroidTapPosition} from './androidWindow.js';

type JsonRecord = Readonly<Record<string, unknown>>;
type QueriedNode = Readonly<{
  readonly nodeInstanceId: string;
  readonly testID: string;
  readonly surface: string;
  readonly displayIndex: number | null;
  readonly layoutRevision: number;
  readonly disabled: boolean | undefined;
}>;

const VIRTUAL_KEYBOARD_TEST_ID_PREFIX = 'ui.base.input:virtual-keyboard:';
const VIRTUAL_KEYBOARD_SURFACE_TEST_ID = 'ui.base.input:virtual-keyboard';

const record = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null;

const resultOf = (response: Awaited<ReturnType<AutomationDriverServer['request']>>): unknown => {
  if (response.type === 'error') {
    const body = response.body;
    throw new Error(record(body) && typeof body.code === 'string' ? body.code : 'TERMINAL_AUTOMATION_AGENT_ERROR');
  }
  if (response.type !== 'response' || !record(response.body) || !('result' in response.body)) {
    throw new Error('TERMINAL_AUTOMATION_AGENT_RESPONSE_INVALID');
  }
  return response.body.result;
};

const requireUniqueNode = (value: unknown, testID: string): QueriedNode => {
  if (!record(value) || !Array.isArray(value.nodes)) throw new Error('TERMINAL_AUTOMATION_CONTROL_QUERY_INVALID');
  const matches = value.nodes.filter(
    (node): node is JsonRecord => record(node) && node.testID === testID && record(node.surface),
  );
  if (matches.length === 0) throw new Error('TERMINAL_AUTOMATION_NODE_NOT_FOUND');
  if (matches.length !== 1) throw new Error('TERMINAL_AUTOMATION_NODE_AMBIGUOUS');
  const node = matches[0];
  const surface = node.surface;
  if (
    typeof node.nodeInstanceId !== 'string' ||
    !record(surface) ||
    typeof surface.surface !== 'string' ||
    !(typeof surface.displayIndex === 'number' || surface.displayIndex === null) ||
    !Number.isSafeInteger(surface.layoutRevision)
  ) {
    throw new Error('TERMINAL_AUTOMATION_CONTROL_NODE_INVALID');
  }
  return Object.freeze({
    nodeInstanceId: node.nodeInstanceId,
    testID,
    surface: surface.surface,
    displayIndex: surface.displayIndex,
    layoutRevision: surface.layoutRevision as number,
    disabled:
      record(node.accessibilityState) && typeof node.accessibilityState.disabled === 'boolean'
        ? node.accessibilityState.disabled
        : undefined,
  });
};

const resolveRegisteredNode = async (
  input: Readonly<{
    readonly server: AutomationDriverServer;
    readonly sessionId: string;
    readonly testID: string;
    readonly surface: string;
    readonly displayIndex: number;
    readonly waitTimeoutMs: number;
    readonly ready?: (node: QueriedNode) => boolean;
  }>,
): Promise<QueriedNode> => {
  let lastObservedState = 'not-registered';
  const recordReadiness = (node: QueriedNode): void => {
    lastObservedState = node.disabled === true ? 'disabled' : node.disabled === false ? 'enabled' : 'unknown';
  };
  const filterBody = {testID: input.testID, surface: input.surface, displayIndex: input.displayIndex};
  const queried = resultOf(await input.server.request(input.sessionId, 'controls.query', {filter: filterBody}));
  if (!record(queried) || !Array.isArray(queried.nodes)) {
    throw new Error('TERMINAL_AUTOMATION_CONTROL_QUERY_INVALID');
  }
  if (queried.nodes.length > 0) {
    const initialNode = requireUniqueNode(queried, input.testID);
    recordReadiness(initialNode);
    if (input.ready === undefined || input.ready(initialNode)) return initialNode;
  }

  const subscriptionId = `android-node-${randomUUID()}`;
  const updates = new ReplaySubject<readonly unknown[]>(1);
  const removeListener = input.server.onMessage(input.sessionId, message => {
    if (!record(message.body) || message.body.subscriptionId !== subscriptionId) return;
    if (message.type === 'error') {
      updates.error(
        new Error(
          `TERMINAL_AUTOMATION_CONTROL_SUBSCRIPTION_FAILED code=${typeof message.body.code === 'string' ? message.body.code : 'UNKNOWN'}`,
        ),
      );
      return;
    }
    if (message.type !== 'event' || !Array.isArray(message.body.nodes)) return;
    updates.next(message.body.nodes);
  });
  const appeared = firstValueFrom(
    updates.pipe(
      filter(nodes => {
        const matching = nodes.filter(node => record(node) && node.testID === input.testID);
        if (matching.length === 0) return false;
        const candidate = requireUniqueNode({nodes: matching}, input.testID);
        recordReadiness(candidate);
        return input.ready === undefined || input.ready(candidate);
      }),
      take(1),
      timeout({first: input.waitTimeoutMs}),
    ),
  );
  let subscribed = false;
  try {
    const response = await input.server.request(input.sessionId, 'controls.subscribe', {
      subscriptionId,
      filter: filterBody,
    });
    subscribed = response.type === 'response';
    const initial = resultOf(response);
    if (!record(initial) || !Array.isArray(initial.nodes)) {
      throw new Error('TERMINAL_AUTOMATION_CONTROL_SUBSCRIBE_INVALID');
    }
    const initialNode = initial.nodes.length > 0 ? requireUniqueNode(initial, input.testID) : null;
    if (initialNode !== null && (input.ready === undefined || input.ready(initialNode))) return initialNode;
    return requireUniqueNode({nodes: await appeared}, input.testID);
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(
        `TERMINAL_AUTOMATION_NODE_NOT_READY_TIMEOUT testID=${input.testID} timeoutMs=${input.waitTimeoutMs} lastObservedState=${lastObservedState}`,
      );
    }
    throw error;
  } finally {
    void appeared.catch(() => undefined);
    updates.complete();
    removeListener();
    if (subscribed) {
      resultOf(await input.server.request(input.sessionId, 'controls.unsubscribe', {subscriptionId}));
    }
  }
};

export const waitForInteractiveAndroidKeyboardKey = async (
  input: Readonly<{
    readonly server: AutomationDriverServer;
    readonly sessionId: string;
    readonly testID: string;
    readonly surface: AndroidSurface;
    readonly displayIndex: 0 | 1;
    readonly waitTimeoutMs: number;
  }>,
): Promise<void> => {
  if (!input.testID.startsWith(VIRTUAL_KEYBOARD_TEST_ID_PREFIX)) {
    throw new Error('TERMINAL_AUTOMATION_KEYBOARD_TARGET_INVALID');
  }
  await resolveRegisteredNode({
    server: input.server,
    sessionId: input.sessionId,
    testID: input.testID,
    surface: input.surface === 'primary' ? 'PRIMARY' : 'SECONDARY',
    displayIndex: input.displayIndex,
    waitTimeoutMs: input.waitTimeoutMs,
    ready: candidate => candidate.disabled === false,
  });
};

export const waitForAndroidVirtualKeyboardDismissed = async (
  input: Readonly<{
    readonly server: AutomationDriverServer;
    readonly sessionId: string;
    readonly surface: AndroidSurface;
    readonly displayIndex: number;
    readonly waitTimeoutMs: number;
  }>,
): Promise<void> => {
  if (!Number.isSafeInteger(input.waitTimeoutMs) || input.waitTimeoutMs <= 0) {
    throw new Error('TERMINAL_AUTOMATION_KEYBOARD_DISMISS_TIMEOUT_INVALID');
  }
  const surfaceName = input.surface === 'primary' ? 'PRIMARY' : 'SECONDARY';
  const filterBody = {surface: surfaceName, displayIndex: input.displayIndex};
  const hasKeyboard = (nodes: readonly unknown[]): boolean =>
    nodes.some(
      node =>
        record(node) &&
        typeof node.testID === 'string' &&
        (node.testID === VIRTUAL_KEYBOARD_SURFACE_TEST_ID ||
          node.testID.startsWith(`${VIRTUAL_KEYBOARD_SURFACE_TEST_ID}:`)),
    );
  const query = resultOf(await input.server.request(input.sessionId, 'controls.query', {filter: filterBody}));
  if (!record(query) || !Array.isArray(query.nodes)) throw new Error('TERMINAL_AUTOMATION_CONTROL_QUERY_INVALID');
  if (!hasKeyboard(query.nodes)) return;

  const subscriptionId = `android-keyboard-dismiss-${randomUUID()}`;
  const updates = new ReplaySubject<readonly unknown[]>(1);
  const removeListener = input.server.onMessage(input.sessionId, message => {
    if (!record(message.body) || message.body.subscriptionId !== subscriptionId) return;
    if (message.type === 'error') {
      updates.error(
        new Error(
          `TERMINAL_AUTOMATION_KEYBOARD_DISMISS_SUBSCRIPTION_FAILED code=${
            typeof message.body.code === 'string' ? message.body.code : 'UNKNOWN'
          }`,
        ),
      );
      return;
    }
    if (message.type === 'event' && Array.isArray(message.body.nodes)) updates.next(message.body.nodes);
  });
  const dismissed = firstValueFrom(
    updates.pipe(
      filter(nodes => !hasKeyboard(nodes)),
      take(1),
      timeout({first: input.waitTimeoutMs}),
    ),
  );
  let subscribed = false;
  let primaryError: unknown;
  try {
    const response = await input.server.request(input.sessionId, 'controls.subscribe', {
      subscriptionId,
      filter: filterBody,
    });
    subscribed = response.type === 'response';
    const initial = resultOf(response);
    if (!record(initial) || initial.subscriptionId !== subscriptionId || !Array.isArray(initial.nodes)) {
      throw new Error('TERMINAL_AUTOMATION_CONTROL_SUBSCRIBE_INVALID');
    }
    if (!hasKeyboard(initial.nodes)) return;
    await dismissed;
  } catch (error) {
    primaryError = error;
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(`TERMINAL_AUTOMATION_KEYBOARD_DISMISS_TIMEOUT timeoutMs=${input.waitTimeoutMs}`);
    }
    throw error;
  } finally {
    void dismissed.catch(() => undefined);
    updates.complete();
    removeListener();
    if (subscribed) {
      try {
        resultOf(await input.server.request(input.sessionId, 'controls.unsubscribe', {subscriptionId}));
      } catch (error) {
        if (primaryError === undefined) throw error;
      }
    }
  }
};

const requireBounds = (
  value: unknown,
  node: QueriedNode,
): Readonly<{x: number; y: number; width: number; height: number}> => {
  if (
    !record(value) ||
    value.nodeInstanceId !== node.nodeInstanceId ||
    value.layoutRevision !== node.layoutRevision ||
    !record(value.bounds)
  ) {
    throw new Error('TERMINAL_AUTOMATION_NODE_BOUNDS_INVALID');
  }
  const bounds = value.bounds;
  if (
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(item => typeof item === 'number' && Number.isFinite(item))
  ) {
    throw new Error('TERMINAL_AUTOMATION_NODE_BOUNDS_INVALID');
  }
  return bounds as Readonly<{x: number; y: number; width: number; height: number}>;
};

const boundsOf = async (
  input: Readonly<{server: AutomationDriverServer; sessionId: string; node: QueriedNode}>,
): Promise<Readonly<{x: number; y: number; width: number; height: number}>> =>
  requireBounds(
    resultOf(
      await input.server.request(input.sessionId, 'controls.bounds', {
        nodeInstanceId: input.node.nodeInstanceId,
        layoutRevision: input.node.layoutRevision,
      }),
    ),
    input.node,
  );

export const tapRegisteredAndroidNode = async (
  input: Readonly<{
    readonly server: AutomationDriverServer;
    readonly sessionId: string;
    readonly android: AndroidInput;
    readonly testID: string;
    readonly surface: AndroidSurface;
    readonly displayIndex: 0 | 1;
    readonly position?: AndroidTapPosition;
    readonly clickPacing?: AndroidClickPacing;
    readonly repeatCount?: number;
    readonly interactionTimeoutMs?: number;
  }>,
): Promise<
  Readonly<{
    readonly nodeInstanceId: string;
    readonly layoutRevision: number;
    readonly tapX: number;
    readonly tapY: number;
  }>
> => {
  const surfaceName = input.surface === 'primary' ? 'PRIMARY' : 'SECONDARY';
  const filterBody = {testID: input.testID, surface: surfaceName, displayIndex: input.displayIndex};
  const repeatCount = input.repeatCount ?? 1;
  if (!Number.isSafeInteger(repeatCount) || repeatCount < 1) {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_TAP_REPEAT_COUNT_INVALID');
  }
  if (repeatCount > 1 && input.clickPacing !== 'intentional-overlap') {
    throw new Error('TERMINAL_AUTOMATION_ANDROID_TAP_REPEAT_REQUIRES_INTENTIONAL_OVERLAP');
  }
  const subscriptionId = `android-input-${randomUUID()}`;
  const interactions = new Subject<Readonly<{readonly phase: string}>>();
  const observedPhases: string[] = [];
  const diagnostics: {
    bounds?: AndroidLogicalBounds;
    tapPoint?: Readonly<{readonly x: number; readonly y: number}>;
    observed?: Promise<void>;
  } = {};
  let removeListener: (() => void) | undefined;
  let subscribed = false;
  try {
    const resolveAndTap = async (
      markClickStarted: () => void,
    ): Promise<
      Readonly<{
        readonly node: QueriedNode;
        readonly bounds: AndroidLogicalBounds;
        readonly tapPoint: Readonly<{readonly x: number; readonly y: number}>;
        readonly observed: Promise<void>;
      }>
    > => {
      // Resolve the app target after its connection-scoped pacing slot becomes
      // available, so the 800ms gap cannot leave this action with stale bounds.
      const resolvedNode = await resolveRegisteredNode({
        server: input.server,
        sessionId: input.sessionId,
        testID: input.testID,
        surface: surfaceName,
        displayIndex: input.displayIndex,
        waitTimeoutMs: input.interactionTimeoutMs ?? 2_000,
        ready: input.testID.startsWith(VIRTUAL_KEYBOARD_TEST_ID_PREFIX)
          ? candidate => candidate.disabled !== true
          : undefined,
      });
      if (resolvedNode.surface !== surfaceName || resolvedNode.displayIndex !== input.displayIndex) {
        throw new Error('TERMINAL_AUTOMATION_NODE_SURFACE_MISMATCH');
      }
      const resolvedBounds = await boundsOf({server: input.server, sessionId: input.sessionId, node: resolvedNode});
      diagnostics.bounds = resolvedBounds;
      removeListener = input.server.onMessage(input.sessionId, message => {
        if (message.type !== 'event' || !record(message.body) || message.body.subscriptionId !== subscriptionId) return;
        const interaction = message.body.interaction;
        if (!record(interaction) || !record(interaction.node) || !record(interaction.node.surface)) return;
        if (
          interaction.node.nodeInstanceId === resolvedNode.nodeInstanceId &&
          interaction.node.surface.layoutRevision === resolvedNode.layoutRevision &&
          typeof interaction.phase === 'string'
        ) {
          observedPhases.push(interaction.phase);
          interactions.next({phase: interaction.phase});
        }
      });
      const subscribeResponse = await input.server.request(input.sessionId, 'controls.subscribe', {
        subscriptionId,
        filter: filterBody,
      });
      const subscription = resultOf(subscribeResponse);
      subscribed = subscribeResponse.type === 'response';
      if (!record(subscription) || !Array.isArray(subscription.nodes)) {
        throw new Error('TERMINAL_AUTOMATION_CONTROL_SUBSCRIBE_INVALID');
      }
      const subscribedNode = requireUniqueNode(subscription, input.testID);
      if (
        subscribedNode.nodeInstanceId !== resolvedNode.nodeInstanceId ||
        subscribedNode.layoutRevision !== resolvedNode.layoutRevision ||
        subscribedNode.surface !== resolvedNode.surface ||
        subscribedNode.displayIndex !== resolvedNode.displayIndex
      ) {
        throw new Error('TERMINAL_AUTOMATION_NODE_CHANGED_BEFORE_INPUT');
      }
      const observed = firstValueFrom(
        interactions.pipe(
          filter(interaction => interaction.phase === 'press-in'),
          take(repeatCount),
          toArray(),
          timeout({first: input.interactionTimeoutMs ?? 2_000}),
        ),
      )
        .then(() => undefined)
        .catch(error => {
          if (error instanceof Error && error.name === 'TimeoutError') {
            throw new Error(
              `TERMINAL_AUTOMATION_ANDROID_INTERACTION_TIMEOUT observed=${observedPhases.join(',') || 'none'}`,
            );
          }
          throw error;
        });
      diagnostics.observed = observed;
      const tapPoint =
        repeatCount === 1
          ? await input.android.tapBounds(
              input.surface,
              resolvedBounds,
              input.position,
              input.clickPacing ?? 'paced',
              markClickStarted,
            )
          : await input.android.tapBounds(
              input.surface,
              resolvedBounds,
              input.position,
              input.clickPacing ?? 'paced',
              markClickStarted,
              repeatCount,
            );
      diagnostics.tapPoint = tapPoint;
      return Object.freeze({node: resolvedNode, bounds: resolvedBounds, tapPoint, observed});
    };
    const click =
      input.clickPacing === 'intentional-overlap'
        ? await resolveAndTap(() => undefined)
        : (await input.android.runPacedClick(resolveAndTap)).result;
    await click.observed;
    return Object.freeze({
      nodeInstanceId: click.node.nodeInstanceId,
      layoutRevision: click.node.layoutRevision,
      tapX: click.tapPoint.x,
      tapY: click.tapPoint.y,
    });
  } catch (error) {
    if (diagnostics.observed !== undefined) void diagnostics.observed.catch(() => undefined);
    const bounds = diagnostics.bounds;
    const tapPoint = diagnostics.tapPoint;
    const boundsSummary =
      bounds === undefined ? 'unavailable' : `${bounds.x},${bounds.y},${bounds.width},${bounds.height}`;
    if (error instanceof Error && error.message.startsWith('TERMINAL_AUTOMATION_ANDROID_INTERACTION_TIMEOUT')) {
      const point = tapPoint === undefined ? 'unavailable' : `${tapPoint.x},${tapPoint.y}`;
      throw new Error(`${error.message} bounds=${boundsSummary} tap=${point}`);
    }
    if (error instanceof Error && error.message.startsWith('TERMINAL_AUTOMATION_ANDROID_TAP_TARGET_TOO_SMALL')) {
      throw new Error(`${error.message} bounds=${boundsSummary}`);
    }
    throw error;
  } finally {
    interactions.complete();
    removeListener?.();
    if (subscribed) {
      resultOf(await input.server.request(input.sessionId, 'controls.unsubscribe', {subscriptionId}));
    }
  }
};

/** Focuses a real native text input. TextInput is not a pressable node, so its
 * focus is exercised by the caller's next real virtual-keyboard tap. */
export const tapRegisteredAndroidInput = async (
  input: Readonly<{
    readonly server: AutomationDriverServer;
    readonly sessionId: string;
    readonly android: AndroidInput;
    readonly testID: string;
    readonly surface: AndroidSurface;
    readonly displayIndex: 0 | 1;
    readonly clickPacing?: AndroidClickPacing;
    readonly interactionTimeoutMs?: number;
  }>,
): Promise<void> => {
  // TextInput is a registered interactive node too: RnrTextInput reports its
  // press-in through the same registry. Wait for that app-side observation so
  // the next virtual-key action cannot race the native focus event.
  await tapRegisteredAndroidNode({
    ...input,
    interactionTimeoutMs: input.interactionTimeoutMs ?? 2_000,
  });
};
