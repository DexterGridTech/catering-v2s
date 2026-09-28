export type RuntimeInstanceMode = 'MASTER' | 'SLAVE';

export const isRuntimeInstanceMode = (value: unknown): value is RuntimeInstanceMode =>
  value === 'MASTER' || value === 'SLAVE';

export type SetRuntimeInstanceModePayload = Readonly<{
  instanceMode: RuntimeInstanceMode;
}>;

export type SetRuntimeInstanceModeResult = Readonly<{
  changed: boolean;
  previousMode: RuntimeInstanceMode;
  currentMode: RuntimeInstanceMode;
}>;
