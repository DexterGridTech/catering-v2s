import {describe, expect, it, vi} from 'vitest';
import {createAutomationNodeRegistry} from '../src/foundations/registry/createAutomationNodeRegistry';

describe('automation node registry', () => {
  it('keeps duplicate testIDs on different surfaces distinct and publishes only mounted nodes', () => {
    const registry = createAutomationNodeRegistry();
    const changed = vi.fn();
    const release = registry.subscribe(changed);
    const base = {
      role: 'button',
      label: 'Submit',
      accessibilityState: Object.freeze({disabled: false}),
      value: null,
      hostNode: {},
    } as const;
    registry.sink.register({
      ...base,
      nodeInstanceId: 'node-primary',
      testID: 'sample.member:submit',
      surface: {surface: 'PRIMARY', displayIndex: 0, layoutRevision: 1},
    });
    registry.sink.register({
      ...base,
      nodeInstanceId: 'node-secondary',
      testID: 'sample.member:submit',
      surface: {surface: 'SECONDARY', displayIndex: 1, layoutRevision: 1},
    });

    expect(registry.list()).toHaveLength(2);
    expect(registry.list().map(node => node.surface.surface)).toEqual(['PRIMARY', 'SECONDARY']);
    registry.sink.update('node-primary', {layout: {x: 5, y: 7, width: 100, height: 32}});
    expect(registry.get('node-primary')?.layout).toEqual({x: 5, y: 7, width: 100, height: 32});
    registry.sink.update('node-primary', {layout: {x: 0, y: 0, width: Number.NaN, height: 32}});
    expect(registry.get('node-primary')?.layout).toEqual({x: 5, y: 7, width: 100, height: 32});
    registry.sink.unregister('node-primary');
    expect(registry.list().map(node => node.nodeInstanceId)).toEqual(['node-secondary']);
    expect(changed).toHaveBeenCalledTimes(4);
    release();
  });

  it('measures native host refs in their window and DOM refs in their viewport', async () => {
    const registry = createAutomationNodeRegistry();
    const base = {
      role: 'button',
      label: 'Submit',
      accessibilityState: Object.freeze({disabled: false}),
      value: null,
      testID: 'sample.member:submit',
      surface: {surface: 'PRIMARY' as const, displayIndex: 0, layoutRevision: 1},
    };
    registry.sink.register({
      ...base,
      nodeInstanceId: 'native-1',
      hostNode: {
        measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
          callback(15, 25, 100, 40),
      },
    });
    registry.sink.register({
      ...base,
      nodeInstanceId: 'web-1',
      hostNode: {
        measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
          callback(4, 10.29, 60, 30),
        getBoundingClientRect: () => ({x: 4, y: 9, width: 60, height: 30}),
      },
    });
    expect(await registry.measure('native-1')).toEqual({x: 15, y: 25, width: 100, height: 40});
    expect(await registry.measure('web-1')).toEqual({x: 4, y: 9, width: 60, height: 30});
    expect(await registry.measure('missing')).toBeNull();
  });

  it('invalidates every cached bounds revision on its surface after scrolling', () => {
    const registry = createAutomationNodeRegistry();
    const node = {
      testID: 'sample.member:submit',
      role: 'button',
      label: 'Submit',
      accessibilityState: Object.freeze({disabled: false}),
      value: null,
      surface: {surface: 'PRIMARY' as const, displayIndex: 0, layoutRevision: 4},
      hostNode: {},
    };
    registry.sink.register({...node, nodeInstanceId: 'primary-node'});
    registry.sink.register({
      ...node,
      nodeInstanceId: 'secondary-node',
      surface: {surface: 'SECONDARY', displayIndex: 1, layoutRevision: 4},
    });
    registry.sink.invalidateSurface(node.surface);
    expect(registry.get('primary-node')?.surface.layoutRevision).toBe(5);
    expect(registry.get('secondary-node')?.surface.layoutRevision).toBe(4);
    registry.sink.invalidateSurface(node.surface);
    expect(registry.get('primary-node')?.surface.layoutRevision).toBe(6);
  });

  it('publishes real press coordinates only while the addressed node is registered', () => {
    const registry = createAutomationNodeRegistry();
    const events: unknown[] = [];
    const release = registry.subscribe(event => events.push(event));
    registry.sink.register({
      nodeInstanceId: 'button-1',
      testID: 'sample.member:submit',
      role: 'button',
      label: 'Submit',
      accessibilityState: Object.freeze({disabled: false}),
      value: null,
      surface: {surface: 'PRIMARY', displayIndex: 0, layoutRevision: 1},
      hostNode: {},
    });
    const registered = registry.get('button-1');
    registry.sink.interaction('button-1', {
      phase: 'press-in',
      pageX: 10,
      pageY: 20,
      locationX: 7,
      locationY: 15,
    });
    registry.sink.unregister('button-1');
    registry.sink.interaction('button-1', {
      phase: 'press-out',
      pageX: 10,
      pageY: 20,
      locationX: 7,
      locationY: 15,
    });

    expect(events).toEqual([
      {type: 'nodes.changed'},
      {
        type: 'interaction',
        node: registered,
        phase: 'press-in',
        pageX: 10,
        pageY: 20,
        locationX: 7,
        locationY: 15,
      },
      {type: 'nodes.changed'},
    ]);
    release();
  });

  it('invokes only the addressed enabled node action with its current layout revision', () => {
    const registry = createAutomationNodeRegistry();
    const press = vi.fn();
    const changeText = vi.fn();
    const node = {
      testID: 'sample.member:submit',
      role: 'button',
      label: 'Submit',
      accessibilityState: Object.freeze({disabled: false}),
      value: null,
      surface: {surface: 'PRIMARY' as const, displayIndex: 0, layoutRevision: 3},
      hostNode: {},
      semanticActions: {press, changeText},
    };
    registry.sink.register({...node, nodeInstanceId: 'node-1'});

    expect(registry.act({nodeInstanceId: 'node-1', layoutRevision: 2, action: 'press'})).toEqual({
      ok: false,
      code: 'STALE_BOUNDS',
    });
    expect(registry.act({nodeInstanceId: 'node-1', layoutRevision: 3, action: 'changeText', value: 'sample'})).toEqual({
      ok: true,
    });
    expect(changeText).toHaveBeenCalledExactlyOnceWith('sample');
    expect(press).not.toHaveBeenCalled();
    registry.sink.update('node-1', {accessibilityState: Object.freeze({disabled: true})});
    expect(registry.act({nodeInstanceId: 'node-1', layoutRevision: 3, action: 'press'})).toEqual({
      ok: false,
      code: 'CONTROL_DISABLED',
    });
    registry.sink.unregister('node-1');
    expect(registry.act({nodeInstanceId: 'node-1', layoutRevision: 3, action: 'press'})).toEqual({
      ok: false,
      code: 'NODE_GONE',
    });
  });

  it('returns a stable action failure when a semantic callback throws', () => {
    const registry = createAutomationNodeRegistry();
    registry.sink.register({
      nodeInstanceId: 'node-1',
      testID: 'sample.member:submit',
      role: 'button',
      label: 'Submit',
      accessibilityState: Object.freeze({disabled: false}),
      value: null,
      surface: {surface: 'PRIMARY', displayIndex: 0, layoutRevision: 3},
      hostNode: {},
      semanticActions: {
        press: () => {
          throw new Error('private callback detail');
        },
      },
    });

    expect(registry.act({nodeInstanceId: 'node-1', layoutRevision: 3, action: 'press'})).toEqual({
      ok: false,
      code: 'ACTION_FAILED',
    });
  });
});
