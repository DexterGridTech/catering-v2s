import type {AutomationNodeDescription, AutomationNodeSink} from '@catering-v2s/ui-base-primitives';

export type AutomationNodeRecord = AutomationNodeDescription &
  Readonly<{
    readonly layout: Readonly<{
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    }> | null;
  }>;

export type AutomationNodeRegistryEvent =
  | Readonly<{readonly type: 'nodes.changed'}>
  | Readonly<{
      readonly type: 'interaction';
      readonly node: AutomationNodeRecord;
      readonly phase: 'press-in' | 'press-out';
      readonly pageX: number;
      readonly pageY: number;
      readonly locationX: number;
      readonly locationY: number;
    }>;

export type AutomationNodeRegistryActResult =
  | Readonly<{readonly ok: true}>
  | Readonly<{
      readonly ok: false;
      readonly code: 'NODE_GONE' | 'STALE_BOUNDS' | 'CONTROL_DISABLED' | 'ACTION_UNAVAILABLE' | 'ACTION_FAILED';
    }>;

export type AutomationNodeRegistry = Readonly<{
  readonly sink: AutomationNodeSink;
  readonly list: () => readonly AutomationNodeRecord[];
  readonly get: (nodeInstanceId: string) => AutomationNodeRecord | undefined;
  readonly measure: (nodeInstanceId: string) => Promise<Readonly<{
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }> | null>;
  readonly act: (
    input: Readonly<{
      readonly nodeInstanceId: string;
      readonly layoutRevision: number;
      readonly action: 'press' | 'changeText';
      readonly value?: string;
    }>,
  ) => AutomationNodeRegistryActResult;
  readonly subscribe: (listener: (event: AutomationNodeRegistryEvent) => void) => () => void;
}>;

const validLayout = (
  layout: Readonly<{readonly x: number; readonly y: number; readonly width: number; readonly height: number}>,
): boolean =>
  [layout.x, layout.y, layout.width, layout.height].every(Number.isFinite) && layout.width >= 0 && layout.height >= 0;

const measureHostNode = (
  hostNode: unknown,
): Promise<Readonly<{
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}> | null> => {
  if (typeof hostNode !== 'object' || hostNode === null) return Promise.resolve(null);
  const candidate = hostNode as {
    measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
    getBoundingClientRect?: () => {x: number; y: number; width: number; height: number};
  };
  if (typeof candidate.getBoundingClientRect === 'function') {
    const rect = candidate.getBoundingClientRect();
    const bounds = Object.freeze({x: rect.x, y: rect.y, width: rect.width, height: rect.height});
    return Promise.resolve(validLayout(bounds) ? bounds : null);
  }
  if (typeof candidate.measureInWindow === 'function') {
    return new Promise(resolve => {
      candidate.measureInWindow?.((...measurements) => {
        const [x, y, width, height] = measurements;
        const bounds = Object.freeze({x, y, width, height});
        resolve(validLayout(bounds) ? bounds : null);
      });
    });
  }
  return Promise.resolve(null);
};

export const createAutomationNodeRegistry = (): AutomationNodeRegistry => {
  const nodes = new Map<string, AutomationNodeRecord>();
  const listeners = new Set<(event: AutomationNodeRegistryEvent) => void>();
  const surfaceRevisions = new Map<string, number>();
  const surfaceRevisionKey = (surface: AutomationNodeDescription['surface']): string =>
    `${surface.surface}:${surface.displayIndex ?? 'host'}`;
  const revisionOf = (surface: AutomationNodeDescription['surface']): number =>
    Math.max(surface.layoutRevision, surfaceRevisions.get(surfaceRevisionKey(surface)) ?? 0);
  const notify = (event: AutomationNodeRegistryEvent): void => {
    for (const listener of [...listeners]) listener(event);
  };
  const sink: AutomationNodeSink = Object.freeze({
    register: node => {
      nodes.set(
        node.nodeInstanceId,
        Object.freeze({
          ...node,
          surface: Object.freeze({...node.surface, layoutRevision: revisionOf(node.surface)}),
          layout: null,
        }),
      );
      notify({type: 'nodes.changed'});
    },
    update: (nodeInstanceId, update) => {
      const current = nodes.get(nodeInstanceId);
      if (current === undefined) return;
      if (update.layout !== undefined && !validLayout(update.layout)) return;
      nodes.set(
        nodeInstanceId,
        Object.freeze({
          ...current,
          ...update,
          layout: update.layout ?? current.layout,
        }),
      );
      notify({type: 'nodes.changed'});
    },
    unregister: nodeInstanceId => {
      if (nodes.delete(nodeInstanceId)) notify({type: 'nodes.changed'});
    },
    invalidateSurface: surface => {
      const key = surfaceRevisionKey(surface);
      const nextRevision = Math.max(surface.layoutRevision, surfaceRevisions.get(key) ?? 0) + 1;
      surfaceRevisions.set(key, nextRevision);
      let changed = false;
      for (const [nodeInstanceId, current] of nodes) {
        if (surfaceRevisionKey(current.surface) !== key) continue;
        nodes.set(
          nodeInstanceId,
          Object.freeze({...current, surface: Object.freeze({...current.surface, layoutRevision: nextRevision})}),
        );
        changed = true;
      }
      if (changed) notify({type: 'nodes.changed'});
    },
    interaction: (nodeInstanceId, event) => {
      const node = nodes.get(nodeInstanceId);
      if (node === undefined) return;
      notify(Object.freeze({type: 'interaction', node, ...event}));
    },
  });
  return Object.freeze({
    sink,
    list: () => Object.freeze([...nodes.values()]),
    get: nodeInstanceId => nodes.get(nodeInstanceId),
    measure: nodeInstanceId => {
      const node = nodes.get(nodeInstanceId);
      return node === undefined ? Promise.resolve(null) : measureHostNode(node.hostNode);
    },
    act: ({nodeInstanceId, layoutRevision, action, value}) => {
      const node = nodes.get(nodeInstanceId);
      if (node === undefined) return Object.freeze({ok: false, code: 'NODE_GONE'});
      if (node.surface.layoutRevision !== layoutRevision) return Object.freeze({ok: false, code: 'STALE_BOUNDS'});
      if (node.accessibilityState.disabled === true) return Object.freeze({ok: false, code: 'CONTROL_DISABLED'});
      const callback = node.semanticActions?.[action];
      if (callback === undefined) return Object.freeze({ok: false, code: 'ACTION_UNAVAILABLE'});
      try {
        if (action === 'changeText') (callback as (nextValue: string) => void)(value ?? '');
        else (callback as () => void)();
      } catch {
        return Object.freeze({ok: false, code: 'ACTION_FAILED'});
      }
      return Object.freeze({ok: true});
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
};
