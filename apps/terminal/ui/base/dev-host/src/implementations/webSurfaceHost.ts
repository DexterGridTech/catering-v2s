export type WebSurfaceHostSize = Readonly<{
  readonly width: number;
  readonly height: number;
}>;

export type WebSurfaceHostSnapshot = Readonly<{
  readonly stableHostLogicalSize: WebSurfaceHostSize;
  readonly isHostPrimaryDisplay: boolean;
}>;

export type WebSurfaceHostSource = Readonly<{
  readonly getSnapshot: () => WebSurfaceHostSnapshot | null;
  readonly subscribe: (listener: (snapshot: WebSurfaceHostSnapshot | null) => void) => () => void;
}>;

/**
 * The dev-host owns a deterministic Web host fact for each physical preview
 * index. It is intentionally a structural source so the dev-host package does
 * not depend on render; the integration binds the full surface identity.
 */
export const createWebSurfaceHostSource = (
  input: Readonly<{
    readonly displayIndex: 0 | 1;
    readonly size: WebSurfaceHostSize;
  }>,
): WebSurfaceHostSource => {
  const snapshot = Object.freeze({
    stableHostLogicalSize: Object.freeze({...input.size}),
    isHostPrimaryDisplay: input.displayIndex === 0,
  });
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe: (_listener: (next: WebSurfaceHostSnapshot | null) => void) => () => undefined,
  });
};
