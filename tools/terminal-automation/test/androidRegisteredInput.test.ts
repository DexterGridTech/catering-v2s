import {describe, expect, it, vi} from 'vitest';
import type {AndroidInput} from '../src/androidInput.js';
import {tapRegisteredAndroidInput, tapRegisteredAndroidNode} from '../src/androidRegisteredInput.js';
import type {AutomationDriverServer} from '../src/server.js';

const envelope = (type: 'response' | 'event', body: unknown) => ({
  protocolVersion: 1 as const,
  sessionId: 'session-1',
  messageId: 'message-1',
  type,
  body,
});

const node = {
  nodeInstanceId: 'node-1',
  testID: 'member.confirm',
  surface: {surface: 'SECONDARY', displayIndex: 1, layoutRevision: 7},
  layout: {x: 10, y: 20, width: 100, height: 50},
};

describe('tapRegisteredAndroidNode', () => {
  it('waits for a registered control after an initially empty snapshot and releases the subscription', async () => {
    let listener: ((message: ReturnType<typeof envelope>) => void) | null = null;
    let subscribeCount = 0;
    const request = vi.fn(async (_sessionId: string, type: string, body?: unknown) => {
      if (type === 'controls.query') return envelope('response', {result: {nodes: []}});
      if (type === 'controls.subscribe') {
        subscribeCount += 1;
        if (subscribeCount > 1) return envelope('response', {result: {nodes: [node]}});
        queueMicrotask(() => {
          const subscriptionId = (body as {subscriptionId: string}).subscriptionId;
          listener?.(envelope('event', {subscriptionId, sequence: 1, nodes: [node]}));
        });
        return envelope('response', {
          result: {subscriptionId: (body as {subscriptionId: string}).subscriptionId, nodes: []},
        });
      }
      if (type === 'controls.bounds') {
        return envelope('response', {
          result: {nodeInstanceId: 'node-1', layoutRevision: 7, bounds: {x: 10, y: 20, width: 100, height: 50}},
        });
      }
      return envelope('response', {result: {released: true}});
    });
    const server = {
      request,
      onMessage: vi.fn((_sessionId: string, callback: (message: ReturnType<typeof envelope>) => void) => {
        listener = callback;
        return () => {
          listener = null;
        };
      }),
    } as unknown as AutomationDriverServer;
    const android: AndroidInput = {
      discoverDisplays: vi.fn(),
      tap: vi.fn(),
      tapBounds: vi.fn(async () => {
        const subscribeCall = request.mock.calls.filter(call => call[1] === 'controls.subscribe').at(-1);
        const subscriptionId = (subscribeCall?.[2] as {subscriptionId: string}).subscriptionId;
        listener?.(envelope('event', {subscriptionId, interaction: {node, phase: 'press-in'}}));
        listener?.(envelope('event', {subscriptionId, interaction: {node, phase: 'press-out'}}));
        return {x: 60, y: 45};
      }),
    };

    await expect(
      tapRegisteredAndroidNode({
        server,
        sessionId: 'session-1',
        android,
        testID: 'member.confirm',
        surface: 'secondary',
        displayIndex: 1,
      }),
    ).resolves.toMatchObject({nodeInstanceId: 'node-1', layoutRevision: 7});
    expect(request.mock.calls.map(call => call[1])).toEqual([
      'controls.query',
      'controls.subscribe',
      'controls.unsubscribe',
      'controls.bounds',
      'controls.subscribe',
      'controls.unsubscribe',
    ]);
  });

  it('fails with the exact target and releases the subscription when a control never registers', async () => {
    let listener: ((message: ReturnType<typeof envelope>) => void) | null = null;
    const request = vi.fn(async (_sessionId: string, type: string, body?: unknown) => {
      if (type === 'controls.query') return envelope('response', {result: {nodes: []}});
      if (type === 'controls.subscribe') {
        return envelope('response', {
          result: {subscriptionId: (body as {subscriptionId: string}).subscriptionId, nodes: []},
        });
      }
      return envelope('response', {result: {released: true}});
    });
    const server = {
      request,
      onMessage: vi.fn((_sessionId: string, callback: (message: ReturnType<typeof envelope>) => void) => {
        listener = callback;
        return () => {
          listener = null;
        };
      }),
    } as unknown as AutomationDriverServer;
    const android: AndroidInput = {discoverDisplays: vi.fn(), tap: vi.fn(), tapBounds: vi.fn()};

    await expect(
      tapRegisteredAndroidNode({
        server,
        sessionId: 'session-1',
        android,
        testID: 'member.confirm',
        surface: 'secondary',
        displayIndex: 1,
        interactionTimeoutMs: 10,
      }),
    ).rejects.toThrow(
      'TERMINAL_AUTOMATION_NODE_NOT_READY_TIMEOUT testID=member.confirm timeoutMs=10 lastObservedState=not-registered',
    );
    expect(listener).toBeNull();
    expect(request.mock.calls.map(call => call[1])).toEqual([
      'controls.query',
      'controls.subscribe',
      'controls.unsubscribe',
    ]);
    expect(android.tapBounds).not.toHaveBeenCalled();
  });

  it('queries current node identity, uses measured bounds, and requires real press events', async () => {
    let listener: ((message: ReturnType<typeof envelope>) => void) | null = null;
    const request = vi.fn(async (_sessionId: string, type: string, body?: unknown) => {
      if (type === 'controls.query') return envelope('response', {result: {nodes: [node]}});
      if (type === 'controls.bounds') {
        return envelope('response', {
          result: {nodeInstanceId: 'node-1', layoutRevision: 7, bounds: {x: 10, y: 20, width: 100, height: 50}},
        });
      }
      if (type === 'controls.subscribe') return envelope('response', {result: {nodes: [node]}});
      return envelope('response', {result: {released: true}});
    });
    const onMessage = vi.fn((_sessionId: string, callback: (message: ReturnType<typeof envelope>) => void) => {
      listener = callback;
      return () => {
        listener = null;
      };
    });
    const server = {request, onMessage} as unknown as AutomationDriverServer;
    let subscriptionId = '';
    const android: AndroidInput = {
      discoverDisplays: vi.fn(),
      tap: vi.fn(),
      tapBounds: vi.fn(async () => {
        const subscribeCall = request.mock.calls.find(call => call[1] === 'controls.subscribe');
        subscriptionId = (subscribeCall?.[2] as {subscriptionId: string}).subscriptionId;
        listener?.(
          envelope('event', {
            subscriptionId,
            interaction: {node, phase: 'press-in'},
          }),
        );
        listener?.(
          envelope('event', {
            subscriptionId,
            interaction: {node, phase: 'press-out'},
          }),
        );
        return {x: 132, y: 114};
      }),
    };

    const result = await tapRegisteredAndroidNode({
      server: server as unknown as AutomationDriverServer,
      sessionId: 'session-1',
      android,
      testID: 'member.confirm',
      surface: 'secondary',
      displayIndex: 1,
      position: {x: 0.1, y: 0},
    });

    expect(result).toEqual({nodeInstanceId: 'node-1', layoutRevision: 7, tapX: 132, tapY: 114});
    expect(android.tapBounds).toHaveBeenCalledWith('secondary', {x: 10, y: 20, width: 100, height: 50}, {x: 0.1, y: 0});
    expect(server.request).toHaveBeenCalledTimes(4);
  });

  it('waits until the keyboard key itself becomes enabled before measuring and tapping it', async () => {
    const keyboardTestID = 'ui.base.input:virtual-keyboard:text-a';
    const disabledKeyboardNode = {...node, testID: keyboardTestID, accessibilityState: {disabled: true}};
    const enabledKeyboardNode = {...disabledKeyboardNode, accessibilityState: {disabled: false}};
    let listener: ((message: ReturnType<typeof envelope>) => void) | null = null;
    let keyboardReady = false;
    let interactionSubscription = '';
    const request = vi.fn(async (_sessionId: string, type: string, body?: unknown) => {
      if (type === 'controls.query') {
        return envelope('response', {result: {nodes: [keyboardReady ? enabledKeyboardNode : disabledKeyboardNode]}});
      }
      if (type === 'controls.bounds') {
        return envelope('response', {
          result: {nodeInstanceId: 'node-1', layoutRevision: 7, bounds: {x: 10, y: 590, width: 100, height: 50}},
        });
      }
      if (type === 'controls.subscribe') {
        const subscriptionId = (body as {subscriptionId: string}).subscriptionId;
        const testID = (body as {filter: {testID: string}}).filter.testID;
        if (testID === keyboardTestID && !keyboardReady) {
          queueMicrotask(() => {
            keyboardReady = true;
            listener?.(envelope('event', {subscriptionId, nodes: [enabledKeyboardNode]}));
          });
          return envelope('response', {result: {subscriptionId, nodes: [disabledKeyboardNode]}});
        }
        interactionSubscription = subscriptionId;
        return envelope('response', {result: {nodes: [enabledKeyboardNode]}});
      }
      return envelope('response', {result: {released: true}});
    });
    const server = {
      request,
      onMessage: vi.fn((_sessionId: string, callback: (message: ReturnType<typeof envelope>) => void) => {
        listener = callback;
        return () => {
          listener = null;
        };
      }),
    } as unknown as AutomationDriverServer;
    const android: AndroidInput = {
      discoverDisplays: vi.fn(),
      tap: vi.fn(),
      tapBounds: vi.fn(async () => {
        listener?.(
          envelope('event', {
            subscriptionId: interactionSubscription,
            interaction: {node: enabledKeyboardNode, phase: 'press-in'},
          }),
        );
        listener?.(
          envelope('event', {
            subscriptionId: interactionSubscription,
            interaction: {node: enabledKeyboardNode, phase: 'press-out'},
          }),
        );
        return {x: 60, y: 620};
      }),
    };

    await expect(
      tapRegisteredAndroidNode({
        server,
        sessionId: 'session-1',
        android,
        testID: keyboardTestID,
        surface: 'secondary',
        displayIndex: 1,
      }),
    ).resolves.toMatchObject({nodeInstanceId: 'node-1', layoutRevision: 7});
    expect(request.mock.calls.filter(call => call[1] === 'controls.query')).toHaveLength(1);
    expect(android.tapBounds).toHaveBeenCalledWith('secondary', {x: 10, y: 590, width: 100, height: 50});
  });

  it('uses measured bounds for a registered input without waiting for a layout snapshot', async () => {
    const unlaidNode = {...node, testID: 'member.name', layout: null};
    const request = vi.fn(async (_sessionId: string, type: string, body?: unknown) => {
      if (type === 'controls.query') return envelope('response', {result: {nodes: [unlaidNode]}});
      if (type === 'controls.bounds') {
        return envelope('response', {
          result: {nodeInstanceId: 'node-1', layoutRevision: 7, bounds: {x: 10, y: 20, width: 100, height: 50}},
        });
      }
      throw new Error(`unexpected request ${type}`);
    });
    const server = {
      request,
      onMessage: vi.fn(),
    } as unknown as AutomationDriverServer;
    const android: AndroidInput = {
      discoverDisplays: vi.fn(),
      tap: vi.fn(),
      tapBounds: vi.fn(async () => ({x: 60, y: 45})),
    };

    await expect(
      tapRegisteredAndroidInput({
        server,
        sessionId: 'session-1',
        android,
        testID: 'member.name',
        surface: 'secondary',
        displayIndex: 1,
      }),
    ).resolves.toBeUndefined();
    expect(request.mock.calls.map(call => call[1])).toEqual(['controls.query', 'controls.bounds']);
    expect(android.tapBounds).toHaveBeenCalledWith('secondary', {x: 10, y: 20, width: 100, height: 50});
  });

  it('rejects ambiguous registration before reading bounds or sending input', async () => {
    const android: AndroidInput = {discoverDisplays: vi.fn(), tap: vi.fn(), tapBounds: vi.fn()};
    const server = {
      request: vi.fn(async () => envelope('response', {result: {nodes: [node, {...node, nodeInstanceId: 'node-2'}]}})),
      onMessage: vi.fn(),
    } as unknown as AutomationDriverServer;
    await expect(
      tapRegisteredAndroidNode({
        server,
        sessionId: 'session-1',
        android,
        testID: 'member.confirm',
        surface: 'secondary',
        displayIndex: 1,
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_NODE_AMBIGUOUS');
    expect(android.tapBounds).not.toHaveBeenCalled();
  });

  it('accepts a real native press-in when the key action changes the current input layer', async () => {
    let listener: ((message: ReturnType<typeof envelope>) => void) | null = null;
    const request = vi.fn(async (_sessionId: string, type: string, body?: unknown) => {
      if (type === 'controls.query') return envelope('response', {result: {nodes: [node]}});
      if (type === 'controls.bounds') {
        return envelope('response', {
          result: {nodeInstanceId: 'node-1', layoutRevision: 7, bounds: {x: 10, y: 20, width: 100, height: 50}},
        });
      }
      if (type === 'controls.subscribe') return envelope('response', {result: {nodes: [node]}});
      return envelope('response', {result: {released: true}});
    });
    const server = {
      request,
      onMessage: vi.fn((_sessionId: string, callback: (message: ReturnType<typeof envelope>) => void) => {
        listener = callback;
        return () => {
          listener = null;
        };
      }),
    } as unknown as AutomationDriverServer;
    const android: AndroidInput = {
      discoverDisplays: vi.fn(),
      tap: vi.fn(),
      tapBounds: vi.fn(async () => {
        const subscribeCall = request.mock.calls.find(call => call[1] === 'controls.subscribe');
        const subscriptionId = (subscribeCall?.[2] as {subscriptionId: string}).subscriptionId;
        listener?.(envelope('event', {subscriptionId, interaction: {node, phase: 'press-in'}}));
        return {x: 132, y: 114};
      }),
    };

    await expect(
      tapRegisteredAndroidNode({
        server,
        sessionId: 'session-1',
        android,
        testID: 'member.confirm',
        surface: 'secondary',
        displayIndex: 1,
        interactionTimeoutMs: 10,
      }),
    ).resolves.toEqual({nodeInstanceId: 'node-1', layoutRevision: 7, tapX: 132, tapY: 114});
  });

  it('requires an exact-node press-in after the native tap', async () => {
    const request = vi.fn(async (_sessionId: string, type: string, body?: unknown) => {
      if (type === 'controls.query') return envelope('response', {result: {nodes: [node]}});
      if (type === 'controls.bounds') {
        return envelope('response', {
          result: {nodeInstanceId: 'node-1', layoutRevision: 7, bounds: {x: 10, y: 20, width: 100, height: 50}},
        });
      }
      if (type === 'controls.subscribe') return envelope('response', {result: {nodes: [node]}});
      return envelope('response', {result: {released: true}});
    });
    const server = {
      request,
      onMessage: vi.fn(() => () => undefined),
    } as unknown as AutomationDriverServer;
    const android: AndroidInput = {
      discoverDisplays: vi.fn(),
      tap: vi.fn(),
      tapBounds: vi.fn(async () => ({x: 132, y: 114})),
    };

    await expect(
      tapRegisteredAndroidNode({
        server,
        sessionId: 'session-1',
        android,
        testID: 'member.confirm',
        surface: 'secondary',
        displayIndex: 1,
        interactionTimeoutMs: 10,
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_ANDROID_INTERACTION_TIMEOUT observed=none bounds=10,20,100,50 tap=132,114');
  });
});

describe('tapRegisteredAndroidInput', () => {
  it('uses the registered field bounds for a real native tap without waiting for pressable events', async () => {
    const request = vi.fn(async (_sessionId: string, type: string) => {
      if (type === 'controls.query') return envelope('response', {result: {nodes: [node]}});
      if (type === 'controls.bounds') {
        return envelope('response', {
          result: {nodeInstanceId: 'node-1', layoutRevision: 7, bounds: {x: 10, y: 20, width: 100, height: 50}},
        });
      }
      throw new Error('UNEXPECTED_AUTOMATION_REQUEST');
    });
    const server = {
      request,
      onMessage: vi.fn(),
    } as unknown as AutomationDriverServer;
    const android: AndroidInput = {
      discoverDisplays: vi.fn(),
      tap: vi.fn(),
      tapBounds: vi.fn(async () => ({x: 60, y: 45})),
    };

    await expect(
      tapRegisteredAndroidInput({
        server,
        sessionId: 'session-1',
        android,
        testID: 'member.confirm',
        surface: 'secondary',
        displayIndex: 1,
      }),
    ).resolves.toBeUndefined();
    expect(android.tapBounds).toHaveBeenCalledExactlyOnceWith('secondary', {x: 10, y: 20, width: 100, height: 50});
    expect(request.mock.calls.map(call => call[1])).toEqual(['controls.query', 'controls.bounds']);
    expect(server.onMessage).not.toHaveBeenCalled();
  });
});
