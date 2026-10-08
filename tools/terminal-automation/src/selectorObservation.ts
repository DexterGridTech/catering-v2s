import {randomUUID} from 'node:crypto';
import type {AutomationDriverServer} from './server.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const responseResult = async (
  server: AutomationDriverServer,
  sessionId: string,
  type: 'selector.read' | 'selector.subscribe' | 'selector.unsubscribe',
  body: unknown,
): Promise<unknown> => {
  const response = await server.request(sessionId, type, body);
  if (response.type === 'error') {
    return Promise.reject(
      new Error(
        isRecord(response.body) && typeof response.body.code === 'string'
          ? response.body.code
          : 'TERMINAL_AUTOMATION_SELECTOR_ERROR',
      ),
    );
  }
  if (response.type !== 'response' || !isRecord(response.body) || !('result' in response.body)) {
    throw new Error('TERMINAL_AUTOMATION_SELECTOR_RESPONSE_INVALID');
  }
  return response.body.result;
};

const jsonValue = (value: unknown): unknown => {
  if (!isRecord(value) || value.valueState !== 'JSON') {
    throw new Error('TERMINAL_AUTOMATION_SELECTOR_VALUE_NOT_JSON');
  }
  return value.value;
};

export const readSelector = async (
  server: AutomationDriverServer,
  sessionId: string,
  selectorName: string,
  argsTuple: readonly unknown[],
): Promise<unknown> => jsonValue(await responseResult(server, sessionId, 'selector.read', {selectorName, argsTuple}));

export const subscribeSelector = async (
  server: AutomationDriverServer,
  sessionId: string,
  selectorName: string,
  argsTuple: readonly unknown[],
) => {
  const subscriptionId = `selector-observation-${randomUUID()}`;
  let latest:
    Readonly<{readonly state: 'JSON'; readonly value: unknown}> | Readonly<{readonly state: 'INVALID'}> | undefined;
  let waiter:
    | Readonly<{
        matches: (value: unknown) => boolean;
        resolve: (value: unknown) => void;
        reject: (error: Error) => void;
      }>
    | undefined;
  const removeListener = server.onMessage(sessionId, message => {
    if (message.type !== 'event' || !isRecord(message.body) || message.body.subscriptionId !== subscriptionId) return;
    try {
      const value = jsonValue(message.body);
      latest = Object.freeze({state: 'JSON', value});
      if (waiter?.matches(value)) {
        waiter.resolve(value);
        waiter = undefined;
      }
    } catch (error) {
      latest = Object.freeze({state: 'INVALID'});
      waiter?.reject(error instanceof Error ? error : new Error('TERMINAL_AUTOMATION_SELECTOR_EVENT_INVALID'));
      waiter = undefined;
    }
  });
  let subscribed = false;
  try {
    const accepted = await responseResult(server, sessionId, 'selector.subscribe', {
      subscriptionId,
      selectorName,
      argsTuple,
    });
    if (!isRecord(accepted) || accepted.accepted !== true || accepted.subscriptionId !== subscriptionId) {
      throw new Error('TERMINAL_AUTOMATION_SELECTOR_SUBSCRIBE_FAILED');
    }
    subscribed = true;
    const current = await readSelector(server, sessionId, selectorName, argsTuple);
    if (latest === undefined) latest = Object.freeze({state: 'JSON', value: current});
    let closed = false;
    return Object.freeze({
      current,
      waitFor: (matches: (value: unknown) => boolean, timeoutMs = 15_000): Promise<unknown> => {
        if (closed) return Promise.reject(new Error('TERMINAL_AUTOMATION_SELECTOR_OBSERVATION_CLOSED'));
        if (latest?.state === 'JSON' && matches(latest.value)) return Promise.resolve(latest.value);
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            waiter = undefined;
            reject(new Error('TERMINAL_AUTOMATION_SELECTOR_WAIT_TIMEOUT'));
          }, timeoutMs);
          waiter = {
            matches,
            resolve: value => {
              clearTimeout(timer);
              resolve(value);
            },
            reject: error => {
              clearTimeout(timer);
              reject(error);
            },
          };
        });
      },
      close: async (): Promise<void> => {
        if (closed) return;
        closed = true;
        removeListener();
        if (!subscribed) return;
        const released = await responseResult(server, sessionId, 'selector.unsubscribe', {subscriptionId});
        if (!isRecord(released) || released.released !== true) {
          throw new Error('TERMINAL_AUTOMATION_SELECTOR_UNSUBSCRIBE_FAILED');
        }
        subscribed = false;
      },
    });
  } catch (error) {
    removeListener();
    if (subscribed) {
      await responseResult(server, sessionId, 'selector.unsubscribe', {subscriptionId});
    }
    throw error;
  }
};

export const waitForSelector = async (
  server: AutomationDriverServer,
  sessionId: string,
  selectorName: string,
  argsTuple: readonly unknown[],
  matches: (value: unknown) => boolean,
  timeoutMs = 15_000,
): Promise<unknown> => {
  const observation = await subscribeSelector(server, sessionId, selectorName, argsTuple);
  try {
    return await observation.waitFor(matches, timeoutMs);
  } finally {
    await observation.close();
  }
};
