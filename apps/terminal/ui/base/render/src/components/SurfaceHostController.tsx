import {useEffect, useMemo, useState, useSyncExternalStore, type ReactNode} from 'react';
import {PixelRatio, StyleSheet, View} from 'react-native';
import {PrimitiveSpinner} from '@catering-v2s/ui-base-primitives';
import {useRenderContext} from '../contexts/RenderContext';
import {
  calculateSurfaceHostGeometry,
  type SurfaceCanvasDeclaration,
  type SurfaceHostAvailability,
  type SurfaceHostGeometry,
  type SurfaceHostSnapshot,
  type SurfaceHostSource,
} from '../foundations/surfaceHost';

export type SurfaceHostControllerProps = Readonly<{
  readonly canvas: SurfaceCanvasDeclaration;
  readonly source?: SurfaceHostSource;
  readonly snapshot?: SurfaceHostSnapshot | null;
  readonly children?: ReactNode;
}>;

const subscribeToNothing =
  (_listener: (snapshot: SurfaceHostSnapshot | null) => void): (() => void) =>
  () =>
    undefined;
const readNoSnapshot = (): null => null;
const subscribeToNoAvailability =
  (_listener: (availability: SurfaceHostAvailability) => void): (() => void) =>
  () =>
    undefined;
const readNoAvailability = (): undefined => undefined;

export const useSurfaceHostSnapshot = (
  source: SurfaceHostSource | undefined,
): SurfaceHostSnapshot | null | undefined => {
  const subscribe = source?.subscribe ?? subscribeToNothing;
  const getSnapshot = source?.getSnapshot ?? readNoSnapshot;
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return source === undefined ? undefined : snapshot;
};

export const useSurfaceHostAvailability = (
  source: SurfaceHostSource | undefined,
): SurfaceHostAvailability | undefined => {
  const subscribe = source?.subscribeAvailability ?? subscribeToNoAvailability;
  const getSnapshot = source?.getAvailability ?? readNoAvailability;
  const availability = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return source?.getAvailability === undefined ? undefined : availability;
};

const staticGeometryOf = (canvas: SurfaceCanvasDeclaration): SurfaceHostGeometry =>
  Object.freeze({
    canvas,
    host: canvas,
    scaleX: 1,
    scaleY: 1,
  });

export const SurfaceHostController = ({
  canvas,
  source,
  snapshot: controlledSnapshot,
  children,
}: SurfaceHostControllerProps) => {
  const {logger} = useRenderContext();
  const [internalSnapshot, setInternalSnapshot] = useState<SurfaceHostSnapshot | null>(
    () => source?.getSnapshot() ?? null,
  );

  useEffect(() => {
    if (controlledSnapshot !== undefined) return undefined;
    if (source === undefined) {
      setInternalSnapshot(null);
      return undefined;
    }
    setInternalSnapshot(source.getSnapshot());
    return source.subscribe(setInternalSnapshot);
  }, [controlledSnapshot, source]);

  const snapshot = controlledSnapshot === undefined ? internalSnapshot : controlledSnapshot;
  const explicitAvailability = useSurfaceHostAvailability(source);
  const availability = explicitAvailability ?? (snapshot === null ? 'pending' : 'ready');

  const geometry = useMemo(
    () => (source === undefined ? staticGeometryOf(canvas) : calculateSurfaceHostGeometry({canvas, snapshot})),
    [canvas, snapshot, source],
  );
  useEffect(() => {
    if (!__DEV__) return;
    logger.info({
      category: 'display-diagnostics',
      event: 'render.surface-host-layout',
      message: 'Surface host canvas geometry observed',
      data: {
        source: 'ui-base-render.SurfaceHostController',
        hostSourceAttached: source !== undefined,
        ready: geometry !== null,
        canvasWidth: geometry?.canvas.width ?? canvas.width,
        canvasHeight: geometry?.canvas.height ?? canvas.height,
        hostWidth: geometry?.host.width ?? null,
        hostHeight: geometry?.host.height ?? null,
        scaleX: geometry?.scaleX ?? null,
        scaleY: geometry?.scaleY ?? null,
        // PixelRatio is diagnostics-only. Geometry must stay owned by the
        // per-surface host snapshot and the package canvas declaration.
        pixelRatio: PixelRatio.get(),
        fontScale: PixelRatio.getFontScale(),
        units: 'logical-layout-unit',
      },
    });
  }, [canvas.height, canvas.width, geometry, logger, source]);

  if (geometry === null) {
    if (availability === 'unavailable') {
      return (
        <View testID="ui-base-render:surface-host-failure" style={styles.viewport}>
          {children}
        </View>
      );
    }
    return (
      <View
        testID="ui-base-render:surface-host-pending"
        style={styles.viewport}
        accessibilityRole="progressbar"
        accessibilityLabel="正在准备显示面"
      >
        <PrimitiveSpinner testID="ui-base-render:surface-host-loading-indicator" accessibilityLabel="正在准备显示面" />
      </View>
    );
  }

  return (
    <View testID="ui-base-render:surface-host-viewport" style={styles.viewport}>
      <View
        testID="ui-base-render:surface-host-canvas"
        style={[
          styles.canvas,
          {
            width: geometry.canvas.width,
            height: geometry.canvas.height,
            transform: [{scaleX: geometry.scaleX}, {scaleY: geometry.scaleY}],
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  canvas: {
    // The input backdrop is intentionally transparent. Keep the host canvas
    // opaque so transparent keyboard margins reveal the business surface,
    // never the Android window/theme background.
    backgroundColor: '#ffffff',
    position: 'relative',
    transformOrigin: 'top left',
  },
});
