import {createContext, type PropsWithChildren} from 'react';

export type AutomationSurfaceScope = Readonly<{
  readonly surface: 'HOST' | 'PRIMARY' | 'SECONDARY';
  readonly displayIndex: number | null;
  readonly layoutRevision: number;
}>;

export type AutomationNodeDescription = Readonly<{
  readonly nodeInstanceId: string;
  readonly testID: string;
  readonly role: string;
  readonly label: string | null;
  readonly accessibilityState: Readonly<Record<string, boolean | undefined>>;
  readonly value: string | number | boolean | null;
  readonly surface: AutomationSurfaceScope;
  readonly hostNode: unknown;
  readonly semanticActions?: Readonly<{
    readonly press?: () => void;
    readonly changeText?: (value: string) => void;
  }>;
}>;

export type AutomationNodeSink = Readonly<{
  readonly register: (node: AutomationNodeDescription) => void;
  readonly update: (
    nodeInstanceId: string,
    update: Readonly<{
      readonly testID?: string;
      readonly role?: string;
      readonly label?: string | null;
      readonly accessibilityState?: Readonly<Record<string, boolean | undefined>>;
      readonly value?: string | number | boolean | null;
      readonly surface?: AutomationSurfaceScope;
      readonly semanticActions?: AutomationNodeDescription['semanticActions'];
      readonly layout?: Readonly<{
        readonly x: number;
        readonly y: number;
        readonly width: number;
        readonly height: number;
      }>;
    }>,
  ) => void;
  readonly unregister: (nodeInstanceId: string) => void;
  readonly invalidateSurface: (surface: AutomationSurfaceScope) => void;
  readonly interaction: (
    nodeInstanceId: string,
    event: Readonly<{
      readonly phase: 'press-in' | 'press-out';
      readonly pageX: number;
      readonly pageY: number;
      readonly locationX: number;
      readonly locationY: number;
    }>,
  ) => void;
}>;

const noOp = (): void => undefined;
const noOpUpdate: AutomationNodeSink['update'] = noOp;
const noOpInteraction: AutomationNodeSink['interaction'] = noOp;
export const noAutomationNodeSink: AutomationNodeSink = Object.freeze({
  register: noOp,
  update: noOpUpdate,
  unregister: noOp,
  invalidateSurface: noOp,
  interaction: noOpInteraction,
});

export type AutomationNodeProviderProps = PropsWithChildren<Readonly<{readonly sink: AutomationNodeSink | null}>>;

export const AutomationNodeSinkContext = createContext<AutomationNodeSink | null>(null);
export const AutomationSurfaceContext = createContext<AutomationSurfaceScope>(
  Object.freeze({surface: 'HOST', displayIndex: null, layoutRevision: 0}),
);

export const AutomationNodeProvider = ({sink, children}: AutomationNodeProviderProps) => (
  <AutomationNodeSinkContext.Provider value={sink}>{children}</AutomationNodeSinkContext.Provider>
);

export const AutomationSurfaceProvider = ({
  scope,
  children,
}: PropsWithChildren<Readonly<{readonly scope: AutomationSurfaceScope}>>) => (
  <AutomationSurfaceContext.Provider value={scope}>{children}</AutomationSurfaceContext.Provider>
);
