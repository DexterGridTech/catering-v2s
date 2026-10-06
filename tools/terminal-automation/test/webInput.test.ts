import {describe, expect, it, vi} from 'vitest';
import type {Locator} from 'playwright';
import type {AutomationEnvelope} from '@catering-v2s/ui-base-automation-agent/protocol';
import type {AutomationDriverServer} from '../src/server.js';
import {clickRegisteredWebNode, focusRegisteredWebInput} from '../src/webInput.js';

const node = Object.freeze({
  nodeInstanceId: 'node-1',
  testID: 'member:confirm',
  surface: Object.freeze({surface: 'PRIMARY', displayIndex: 0, layoutRevision: 7}),
});

const serverFor = (
  options: Readonly<{readonly ambiguous?: boolean; readonly testID?: string; readonly interactionNodeId?: string}> = {},
) => {
  const registeredNode = {...node, testID: options.testID ?? node.testID};
  let listener: ((message: AutomationEnvelope) => void) | undefined;
  let subscriptionId = '';
  const requests: string[] = [];
  const request = vi.fn(async (_sessionId: string, type: string, body: unknown) => {
    requests.push(type);
    const response = (result: unknown) => ({
      protocolVersion: 1 as const,
      sessionId: 'session-1',
      messageId: `reply-${requests.length}`,
      type: 'response' as const,
      body: {requestMessageId: `request-${requests.length}`, result},
    });
    if (type === 'controls.query')
      return response({
        nodes: options.ambiguous ? [registeredNode, {...registeredNode, nodeInstanceId: 'node-2'}] : [registeredNode],
      });
    if (type === 'controls.bounds')
      return response({
        nodeInstanceId: node.nodeInstanceId,
        layoutRevision: 7,
        bounds: {x: 10, y: 20, width: 40, height: 30},
      });
    if (type === 'controls.subscribe') {
      subscriptionId = (body as {subscriptionId: string}).subscriptionId;
      return response({subscriptionId, sequence: 1, nodes: [registeredNode]});
    }
    if (type === 'controls.unsubscribe') return response({released: true});
    throw new Error('UNEXPECTED_AUTOMATION_REQUEST');
  });
  const server = {
    request,
    onMessage: vi.fn((_sessionId: string, next: (message: AutomationEnvelope) => void) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    }),
  };
  return {
    server: server as unknown as AutomationDriverServer,
    request,
    requests,
    emit: (phase: string) =>
      listener?.({
        protocolVersion: 1,
        sessionId: 'session-1',
        messageId: `event-${phase}`,
        type: 'event',
        body: {
          subscriptionId,
          interaction: {
            phase,
            node: {
              nodeInstanceId: options.interactionNodeId ?? node.nodeInstanceId,
              testID: registeredNode.testID,
              surface: node.surface,
            },
          },
        },
      } as AutomationEnvelope),
  };
};

describe('clickRegisteredWebNode', () => {
  it('uses Playwright trial actionability for a virtual key before issuing the real press', async () => {
    const testID = 'ui.base.input:virtual-keyboard:alpha:A';
    const context = serverFor({testID});
    const click = vi.fn(async (options?: {trial?: boolean; timeout?: number}) => {
      if (options?.trial !== true) {
        context.emit('press-in');
        context.emit('press-out');
      }
    });
    const locator = {
      waitFor: vi.fn().mockResolvedValue(undefined),
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      evaluate: vi.fn().mockResolvedValue({x: 10, y: 20, width: 40, height: 30}),
      click,
    } as unknown as Locator;
    const surfaceRoot = {getByTestId: vi.fn().mockReturnValue(locator)} as unknown as Locator;

    await expect(
      clickRegisteredWebNode({
        server: context.server,
        sessionId: 'session-1',
        surfaceRoot,
        testID,
        surface: 'PRIMARY',
        displayIndex: 0,
      }),
    ).resolves.toEqual({nodeInstanceId: 'node-1', layoutRevision: 7});

    expect(click.mock.calls[0]?.[0]).toMatchObject({trial: true});
    expect(click.mock.calls[0]?.[0]?.timeout).toBeGreaterThan(0);
    expect(click.mock.calls[0]?.[0]?.timeout).toBeLessThanOrEqual(2_000);
    expect(click).toHaveBeenNthCalledWith(2);
  });

  it('reports the exact virtual key and disabled state when actionability never settles', async () => {
    const testID = 'ui.base.input:virtual-keyboard:alpha:A';
    const context = serverFor({testID});
    const locator = {
      waitFor: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockRejectedValue(new Error('TimeoutError')),
      evaluateAll: vi.fn().mockResolvedValue([{testID, disabled: true, pointerEvents: 'none'}]),
    } as unknown as Locator;
    const surfaceRoot = {getByTestId: vi.fn().mockReturnValue(locator)} as unknown as Locator;

    await expect(
      clickRegisteredWebNode({
        server: context.server,
        sessionId: 'session-1',
        surfaceRoot,
        testID,
        surface: 'PRIMARY',
        displayIndex: 0,
      }),
    ).rejects.toThrow(
      `TERMINAL_AUTOMATION_WEB_KEYBOARD_TARGET_NOT_ACTIONABLE testID=${testID} timeoutMs=2000 nodes=[{"testID":"${testID}","disabled":true,"pointerEvents":"none"}]`,
    );
    expect(context.request).not.toHaveBeenCalled();
  });

  it('waits for an animated node to settle before comparing bounds and clicking', async () => {
    const context = serverFor();
    const click = vi.fn(async () => {
      context.emit('press-in');
      context.emit('press-out');
    });
    const evaluate = vi
      .fn()
      .mockResolvedValueOnce({x: 10, y: 24, width: 40, height: 30})
      .mockResolvedValueOnce({x: 10, y: 22, width: 40, height: 30})
      .mockResolvedValueOnce({x: 10, y: 20, width: 40, height: 30})
      .mockResolvedValueOnce({x: 10, y: 20, width: 40, height: 30})
      .mockResolvedValueOnce({x: 10, y: 20, width: 40, height: 30})
      .mockResolvedValueOnce({x: 10, y: 20, width: 40, height: 30});
    const locator = {
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      evaluate,
      click,
    } as unknown as Locator;
    const surfaceRoot = {getByTestId: vi.fn().mockReturnValue(locator)} as unknown as Locator;

    await expect(
      clickRegisteredWebNode({
        server: context.server,
        sessionId: 'session-1',
        surfaceRoot,
        testID: node.testID,
        surface: 'PRIMARY',
        displayIndex: 0,
      }),
    ).resolves.toEqual({nodeInstanceId: 'node-1', layoutRevision: 7});

    expect(evaluate.mock.invocationCallOrder[4]).toBeLessThan(context.request.mock.invocationCallOrder[0]!);
    expect(click).toHaveBeenCalledExactlyOnceWith();
  });

  it('checks registered identity and bounds, clicks once, and observes both real press events', async () => {
    const context = serverFor();
    const click = vi.fn(async () => {
      context.emit('press-in');
      context.emit('press-out');
    });
    const locator = {
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      evaluate: vi.fn().mockResolvedValue({x: 10.5, y: 20.8, width: 40, height: 30}),
      click,
    } as unknown as Locator;
    const surfaceRoot = {getByTestId: vi.fn().mockReturnValue(locator)} as unknown as Locator;

    await expect(
      clickRegisteredWebNode({
        server: context.server,
        sessionId: 'session-1',
        surfaceRoot,
        testID: node.testID,
        surface: 'PRIMARY',
        displayIndex: 0,
      }),
    ).resolves.toEqual({nodeInstanceId: 'node-1', layoutRevision: 7});
    expect(context.requests).toEqual([
      'controls.query',
      'controls.bounds',
      'controls.subscribe',
      'controls.unsubscribe',
    ]);
    expect(surfaceRoot.getByTestId).toHaveBeenCalledExactlyOnceWith(node.testID);
    expect(click).toHaveBeenCalledExactlyOnceWith();
  });

  it('accepts the exact unique Web locator target when its registered node remounts before press', async () => {
    const context = serverFor({interactionNodeId: 'node-after-input-remount'});
    const click = vi.fn(async () => {
      context.emit('press-in');
      context.emit('press-out');
    });
    const locator = {
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      evaluate: vi.fn().mockResolvedValue({x: 10, y: 20, width: 40, height: 30}),
      click,
    } as unknown as Locator;
    const surfaceRoot = {getByTestId: vi.fn().mockReturnValue(locator)} as unknown as Locator;

    await expect(
      clickRegisteredWebNode({
        server: context.server,
        sessionId: 'session-1',
        surfaceRoot,
        testID: node.testID,
        surface: 'PRIMARY',
        displayIndex: 0,
      }),
    ).resolves.toEqual({nodeInstanceId: 'node-after-input-remount', layoutRevision: 7});
    expect(click).toHaveBeenCalledExactlyOnceWith();
  });

  it('rejects ambiguous registered identities without clicking', async () => {
    const context = serverFor({ambiguous: true});
    const click = vi.fn();
    const locator = {
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      evaluate: vi.fn().mockResolvedValue({x: 10, y: 20, width: 40, height: 30}),
      click,
    } as unknown as Locator;
    const surfaceRoot = {getByTestId: vi.fn().mockReturnValue(locator)} as unknown as Locator;

    await expect(
      clickRegisteredWebNode({
        server: context.server,
        sessionId: 'session-1',
        surfaceRoot,
        testID: node.testID,
        surface: 'PRIMARY',
        displayIndex: 0,
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_NODE_AMBIGUOUS');
    expect(click).not.toHaveBeenCalled();
  });

  it('reports both registered and browser bounds when a node moves between reads', async () => {
    const context = serverFor();
    const locator = {
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      evaluate: vi.fn().mockResolvedValue({x: 40, y: 50, width: 40, height: 30}),
      click: vi.fn(),
    } as unknown as Locator;
    const surfaceRoot = {getByTestId: vi.fn().mockReturnValue(locator)} as unknown as Locator;

    await expect(
      clickRegisteredWebNode({
        server: context.server,
        sessionId: 'session-1',
        surfaceRoot,
        testID: node.testID,
        surface: 'PRIMARY',
        displayIndex: 0,
      }),
    ).rejects.toThrow(
      'TERMINAL_AUTOMATION_WEB_NODE_IDENTITY_MISMATCH testID=member:confirm registered={"x":10,"y":20,"width":40,"height":30} dom={"x":40,"y":50,"width":40,"height":30}',
    );
    expect(locator.click).not.toHaveBeenCalled();
  });

  it('keeps the documented one CSS-pixel bound tolerance', async () => {
    const context = serverFor();
    const locator = {
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      evaluate: vi.fn().mockResolvedValue({x: 10, y: 21.21, width: 40, height: 30}),
      click: vi.fn(),
    } as unknown as Locator;
    const surfaceRoot = {getByTestId: vi.fn().mockReturnValue(locator)} as unknown as Locator;

    await expect(
      clickRegisteredWebNode({
        server: context.server,
        sessionId: 'session-1',
        surfaceRoot,
        testID: node.testID,
        surface: 'PRIMARY',
        displayIndex: 0,
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_WEB_NODE_IDENTITY_MISMATCH');
    expect(locator.click).not.toHaveBeenCalled();
  });

  it('identifies which registered control failed to report press events', async () => {
    const testID = 'ui.base.input:virtual-keyboard:shift';
    const context = serverFor({testID});
    const locator = {
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      waitFor: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue({x: 10, y: 20, width: 40, height: 30}),
      click: vi.fn(async () => undefined),
    } as unknown as Locator;
    const surfaceRoot = {getByTestId: vi.fn().mockReturnValue(locator)} as unknown as Locator;

    await expect(
      clickRegisteredWebNode({
        server: context.server,
        sessionId: 'session-1',
        surfaceRoot,
        testID,
        surface: 'PRIMARY',
        displayIndex: 0,
        interactionTimeoutMs: 10,
      }),
    ).rejects.toThrow(
      `TERMINAL_AUTOMATION_WEB_PRESS_EVENTS_TIMEOUT testID=${testID} expectedNode=node-1 expectedRevision=7 interactions=none`,
    );
    expect(context.requests.at(-1)).toBe('controls.unsubscribe');
  });

  it('waits for the focused virtual keyboard key to mount before querying its target', async () => {
    const testID = 'ui.base.input:virtual-keyboard:text-3';
    const context = serverFor({testID});
    const click = vi.fn(async () => {
      context.emit('press-in');
      context.emit('press-out');
    });
    const count = vi.fn().mockResolvedValue(0);
    const waitFor = vi.fn(async () => {
      count.mockResolvedValue(1);
    });
    const locator = {
      count,
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      waitFor,
      evaluate: vi.fn().mockResolvedValue({x: 10, y: 20, width: 40, height: 30}),
      click,
    } as unknown as Locator;
    const surfaceRoot = {getByTestId: vi.fn().mockReturnValue(locator)} as unknown as Locator;

    await expect(
      clickRegisteredWebNode({
        server: context.server,
        sessionId: 'session-1',
        surfaceRoot,
        testID,
        surface: 'PRIMARY',
        displayIndex: 0,
      }),
    ).resolves.toEqual({nodeInstanceId: 'node-1', layoutRevision: 7});
    expect(waitFor).toHaveBeenCalledExactlyOnceWith({state: 'visible', timeout: 2_000});
    expect(count.mock.invocationCallOrder[0]!).toBeGreaterThan(waitFor.mock.invocationCallOrder[0]!);
  });
});

describe('focusRegisteredWebInput', () => {
  it('clicks the registered real input and confirms browser focus without requiring press events', async () => {
    const context = serverFor();
    const click = vi.fn(async () => undefined);
    const locator = {
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      evaluate: vi
        .fn()
        .mockResolvedValueOnce({x: 10, y: 20, width: 40, height: 30})
        .mockResolvedValueOnce({x: 10, y: 20, width: 40, height: 30})
        .mockResolvedValueOnce({x: 10, y: 20, width: 40, height: 30})
        .mockResolvedValueOnce({x: 10, y: 20, width: 40, height: 30})
        .mockResolvedValueOnce(true),
      click,
    } as unknown as Locator;
    const surfaceRoot = {getByTestId: vi.fn().mockReturnValue(locator)} as unknown as Locator;

    await expect(
      focusRegisteredWebInput({
        server: context.server,
        sessionId: 'session-1',
        surfaceRoot,
        testID: node.testID,
        surface: 'PRIMARY',
        displayIndex: 0,
      }),
    ).resolves.toBeUndefined();
    expect(click).toHaveBeenCalledExactlyOnceWith();
    expect(locator.evaluate).toHaveBeenCalledTimes(5);
    expect(context.requests).toEqual(['controls.query', 'controls.bounds']);
  });

  it('fails if a real input click does not focus the exact registered element', async () => {
    const context = serverFor();
    const locator = {
      count: vi.fn().mockResolvedValue(1),
      isVisible: vi.fn().mockResolvedValue(true),
      isEnabled: vi.fn().mockResolvedValue(true),
      evaluate: vi
        .fn()
        .mockResolvedValueOnce({x: 10, y: 20, width: 40, height: 30})
        .mockResolvedValueOnce({x: 10, y: 20, width: 40, height: 30})
        .mockResolvedValueOnce({x: 10, y: 20, width: 40, height: 30})
        .mockResolvedValueOnce({x: 10, y: 20, width: 40, height: 30})
        .mockResolvedValueOnce(false),
      click: vi.fn(async () => undefined),
    } as unknown as Locator;
    const surfaceRoot = {getByTestId: vi.fn().mockReturnValue(locator)} as unknown as Locator;

    await expect(
      focusRegisteredWebInput({
        server: context.server,
        sessionId: 'session-1',
        surfaceRoot,
        testID: node.testID,
        surface: 'PRIMARY',
        displayIndex: 0,
      }),
    ).rejects.toThrow('TERMINAL_AUTOMATION_WEB_INPUT_FOCUS_NOT_OBSERVED');
  });
});
