import {randomUUID} from 'node:crypto';
import {filter, firstValueFrom, ReplaySubject, Subject, take, timeout} from 'rxjs';
import type {AutomationDriverServer} from './server.js';
import type {AndroidInput, AndroidSurface} from './androidInput.js';
import type {AndroidTapPosition} from './androidWindow.js';

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
    lastObservedState = node.disabled === true ? 'disabled' : 'enabled';
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
  const node = await resolveRegisteredNode({
    server: input.server,
    sessionId: input.sessionId,
    testID: input.testID,
    surface: surfaceName,
    displayIndex: input.displayIndex,
    waitTimeoutMs: input.interactionTimeoutMs ?? 2_000,
    // The input layer disables keys during enter/handoff/exit. Wait for the
    // same node to become enabled before measuring its native coordinates.
    ready: input.testID.startsWith(VIRTUAL_KEYBOARD_TEST_ID_PREFIX)
      ? candidate => candidate.disabled !== true
      : undefined,
  });
  if (node.surface !== surfaceName || node.displayIndex !== input.displayIndex) {
    throw new Error('TERMINAL_AUTOMATION_NODE_SURFACE_MISMATCH');
  }
  const bounds = await boundsOf({server: input.server, sessionId: input.sessionId, node});
  const subscriptionId = `android-input-${randomUUID()}`;
  const interactions = new Subject<Readonly<{readonly phase: string}>>();
  const observedPhases: string[] = [];
  const removeListener = input.server.onMessage(input.sessionId, message => {
    if (message.type !== 'event' || !record(message.body) || message.body.subscriptionId !== subscriptionId) return;
    const interaction = message.body.interaction;
    if (!record(interaction) || !record(interaction.node) || !record(interaction.node.surface)) return;
    if (
      interaction.node.nodeInstanceId === node.nodeInstanceId &&
      interaction.node.surface.layoutRevision === node.layoutRevision &&
      typeof interaction.phase === 'string'
    ) {
      observedPhases.push(interaction.phase);
      interactions.next({phase: interaction.phase});
    }
  });
  let subscribed = false;
  let observed: Promise<void> | null = null;
  let tapPoint: Readonly<{readonly x: number; readonly y: number}> | null = null;
  try {
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
      subscribedNode.nodeInstanceId !== node.nodeInstanceId ||
      subscribedNode.layoutRevision !== node.layoutRevision ||
      subscribedNode.surface !== node.surface ||
      subscribedNode.displayIndex !== node.displayIndex
    ) {
      throw new Error('TERMINAL_AUTOMATION_NODE_CHANGED_BEFORE_INPUT');
    }
    observed = firstValueFrom(
      interactions.pipe(
        filter(interaction => interaction.phase === 'press-in'),
        take(1),
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
    tapPoint =
      input.position === undefined
        ? await input.android.tapBounds(input.surface, bounds)
        : await input.android.tapBounds(input.surface, bounds, input.position);
    await observed;
    return Object.freeze({
      nodeInstanceId: node.nodeInstanceId,
      layoutRevision: node.layoutRevision,
      tapX: tapPoint.x,
      tapY: tapPoint.y,
    });
  } catch (error) {
    if (observed !== null) void observed.catch(() => undefined);
    if (error instanceof Error && error.message.startsWith('TERMINAL_AUTOMATION_ANDROID_INTERACTION_TIMEOUT')) {
      const point = tapPoint === null ? 'unavailable' : `${tapPoint.x},${tapPoint.y}`;
      throw new Error(`${error.message} bounds=${bounds.x},${bounds.y},${bounds.width},${bounds.height} tap=${point}`);
    }
    if (error instanceof Error && error.message.startsWith('TERMINAL_AUTOMATION_ANDROID_TAP_TARGET_TOO_SMALL')) {
      throw new Error(`${error.message} bounds=${bounds.x},${bounds.y},${bounds.width},${bounds.height}`);
    }
    throw error;
  } finally {
    interactions.complete();
    removeListener();
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
  }>,
): Promise<void> => {
  const surfaceName = input.surface === 'primary' ? 'PRIMARY' : 'SECONDARY';
  const node = await resolveRegisteredNode({
    server: input.server,
    sessionId: input.sessionId,
    testID: input.testID,
    surface: surfaceName,
    displayIndex: input.displayIndex,
    waitTimeoutMs: 2_000,
  });
  if (node.surface !== surfaceName || node.displayIndex !== input.displayIndex) {
    throw new Error('TERMINAL_AUTOMATION_NODE_SURFACE_MISMATCH');
  }
  const bounds = await boundsOf({server: input.server, sessionId: input.sessionId, node});
  await input.android.tapBounds(input.surface, bounds);
};
