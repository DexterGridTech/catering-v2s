import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode} from 'react';
import {StyleSheet, useWindowDimensions, View} from 'react-native';
import {openLayerCommand, selectLayers} from '@catering-v2s/kernel-base-ui-state';
import {selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {
  dispatchWithRequestId,
  useDispatchCommand,
  useRenderContext,
  useSurfaceContext,
  useUiStateSelector,
} from '@catering-v2s/ui-base-render';
import type {SurfaceHostSize} from '@catering-v2s/ui-base-render';
import {ADMIN_CONSOLE_LAYER_ID, ADMIN_CONSOLE_PART_KEY} from '../foundations/adminIdentity';
import {
  createInitialAdminGestureState,
  adminLauncherPointFromEvent,
  logicalPointFromWindow,
  trackAdminGesture,
  type AdminGestureCoordinateSpace,
  type AdminGestureState,
} from '../foundations/adminLauncher';
import {adminTestIds} from '../foundations/adminTestIds';

const coordinateSpaceOf = (
  windowMeasurement: Readonly<{
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }> | null,
  canvas: SurfaceHostSize,
  host: SurfaceHostSize | null,
): AdminGestureCoordinateSpace | null => {
  if (windowMeasurement === null || host === null) return null;
  if (
    !Number.isFinite(canvas.width) ||
    !Number.isFinite(canvas.height) ||
    canvas.width <= 0 ||
    canvas.height <= 0 ||
    !Number.isFinite(host.width) ||
    !Number.isFinite(host.height) ||
    host.width <= 0 ||
    host.height <= 0
  )
    return null;
  const measuredScaleX = windowMeasurement.width / canvas.width;
  const measuredScaleY = windowMeasurement.height / canvas.height;
  const scaleX = Number.isFinite(measuredScaleX) && measuredScaleX > 0 ? measuredScaleX : host.width / canvas.width;
  const scaleY = Number.isFinite(measuredScaleY) && measuredScaleY > 0 ? measuredScaleY : host.height / canvas.height;
  if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) return null;
  return Object.freeze({
    originX: windowMeasurement.x,
    originY: windowMeasurement.y,
    scaleX,
    scaleY,
  });
};

type AdminLauncherProps = Readonly<{
  readonly canvas: SurfaceHostSize;
  readonly children?: ReactNode;
}>;

const boundedErrorMessage = (error: unknown): string => {
  const message = error instanceof Error ? error.message : 'Unknown admin launcher dispatch failure';
  if (/(password|passcode|otp|token|cookie|authorization|phone|address|ip)/i.test(message)) return '[redacted]';
  return message.slice(0, 160);
};

/**
 * Observes the launcher completion event on the business-content ancestor.
 * This node is deliberately a plain View: it has no responder negotiation or
 * press handling of its own, so descendants keep their normal touch behavior.
 */
export const AdminLauncher = ({canvas, children}: AdminLauncherProps) => {
  const surface = useSurfaceContext();
  const {logger} = useRenderContext();
  const hostLogicalSize = surface.hostLogicalSize;
  const windowDimensions = useWindowDimensions();
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;
  const hostLogicalWidth = hostLogicalSize?.width ?? null;
  const hostLogicalHeight = hostLogicalSize?.height ?? null;
  const hasAdminLayerSelector = useMemo(
    () => (root: Parameters<typeof selectLayers>[0]) => {
      const workspace =
        selectRuntimeInstanceMode(root) === 'SLAVE' && selectDisplayRole(root) === 'VICE' ? 'BRANCH' : undefined;
      return selectLayers(root, surface.displayMode, workspace).some(layer => layer.layerId === ADMIN_CONSOLE_LAYER_ID);
    },
    [surface.displayMode],
  );
  const localAdminWorkspace = useUiStateSelector(
    useMemo(
      () => (root: Parameters<typeof selectRuntimeInstanceMode>[0]) =>
        selectRuntimeInstanceMode(root) === 'SLAVE' && selectDisplayRole(root) === 'VICE' ? 'BRANCH' : undefined,
      [],
    ),
  );
  const hasAdminLayer = useUiStateSelector(hasAdminLayerSelector) ?? false;
  const dispatchCommand = useDispatchCommand();
  const gestureState = useRef<AdminGestureState>(createInitialAdminGestureState());
  const windowMeasurementRef = useRef<Readonly<{
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }> | null>(null);
  const nodeRef = useRef<View>(null);
  const measurementGenerationRef = useRef(0);
  const geometryReadyRef = useRef(false);

  useEffect(() => {
    logger.info({
      category: 'admin.launcher',
      event: 'admin.launcher-binding',
      message: 'Admin launcher binding observed',
      data: {
        displayMode: surface.displayMode,
        displayIndex: surface.surfaceIdentity?.displayIndex ?? null,
        surfaceKey: surface.surfaceIdentity?.surfaceKey ?? null,
        isHostPrimaryDisplay: surface.isHostPrimaryDisplay,
        surfaceHostAvailability: surface.surfaceHostAvailability,
        hasAdminLayer,
        handlerAttached: !hasAdminLayer,
      },
    });
  }, [
    hasAdminLayer,
    logger,
    surface.displayMode,
    surface.isHostPrimaryDisplay,
    surface.surfaceHostAvailability,
    surface.surfaceIdentity?.displayIndex,
    surface.surfaceIdentity?.surfaceKey,
  ]);
  const measureOrigin = useCallback(
    (invalidateCurrent = false) => {
      const generation = ++measurementGenerationRef.current;
      gestureState.current = createInitialAdminGestureState();
      if (invalidateCurrent) geometryReadyRef.current = false;
      requestAnimationFrame(() => {
        if (generation !== measurementGenerationRef.current) return;
        // The viewport update may cause the host canvas to commit its new scale
        // after this frame; measure on the following frame, against that layout.
        requestAnimationFrame(() => {
          if (generation !== measurementGenerationRef.current) return;
          const node = nodeRef.current;
          if (node === null) return;
          node.measureInWindow((...measurements: [number, number, number, number]) => {
            if (generation !== measurementGenerationRef.current) return;
            const [x, y, width, height] = measurements;
            if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width) && Number.isFinite(height)) {
              windowMeasurementRef.current = Object.freeze({x, y, width, height});
              geometryReadyRef.current = true;
              logger.info({
                category: 'admin.launcher',
                event: 'admin.launcher-geometry-measured',
                message: 'Admin launcher window geometry measured',
                data: {
                  displayMode: surface.displayMode,
                  displayIndex: surface.surfaceIdentity?.displayIndex ?? null,
                  windowRect: {x, y, width, height},
                  canvas: {width: canvasWidth, height: canvasHeight},
                  hostLogicalSize:
                    hostLogicalWidth === null || hostLogicalHeight === null
                      ? null
                      : {width: hostLogicalWidth, height: hostLogicalHeight},
                  windowDimensions: {width: windowDimensions.width, height: windowDimensions.height},
                },
              });
            }
          });
        });
      });
    },
    [
      canvasHeight,
      canvasWidth,
      hostLogicalHeight,
      hostLogicalWidth,
      logger,
      surface.displayMode,
      surface.surfaceIdentity?.displayIndex,
      windowDimensions.height,
      windowDimensions.width,
    ],
  );

  useLayoutEffect(() => {
    measureOrigin(true);
  }, [
    canvas.height,
    canvas.width,
    hostLogicalSize?.height,
    hostLogicalSize?.width,
    measureOrigin,
    windowDimensions.height,
    windowDimensions.width,
  ]);

  useEffect(
    () => () => {
      measurementGenerationRef.current += 1;
      geometryReadyRef.current = false;
    },
    [],
  );

  const open = useCallback(() => {
    logger.info({
      category: 'admin.launcher',
      event: 'admin.launcher-open-requested',
      message: 'Admin launcher gesture completed',
      data: {
        displayMode: surface.displayMode,
        displayIndex: surface.surfaceIdentity?.displayIndex ?? null,
        isHostPrimaryDisplay: surface.isHostPrimaryDisplay,
        hasAdminLayer,
      },
    });
    void dispatchWithRequestId({
      dispatchCommand,
      definition: openLayerCommand,
      payload: {
        displayMode: surface.displayMode,
        layerId: ADMIN_CONSOLE_LAYER_ID,
        partKey: ADMIN_CONSOLE_PART_KEY,
        ...(localAdminWorkspace === undefined ? {} : {workspace: localAdminWorkspace}),
      },
    })
      .then(result => {
        logger.info({
          category: 'admin.launcher',
          event: 'admin.launcher-open-result',
          message: 'Admin launcher open dispatch completed',
          data: {
            displayMode: surface.displayMode,
            displayIndex: surface.surfaceIdentity?.displayIndex ?? null,
            target: 'local',
            status: result.status,
          },
        });
        if (result.status !== 'completed') {
          logger.error({
            category: 'admin.launcher',
            event: 'admin.launcher-open-failed',
            message: 'Admin launcher open dispatch returned a non-completed result',
            data: {
              displayMode: surface.displayMode,
              displayIndex: surface.surfaceIdentity?.displayIndex ?? null,
              target: 'local',
              status: result.status,
              reason: 'command-not-completed',
            },
          });
        }
      })
      .catch((error: unknown) => {
        logger.error({
          category: 'admin.launcher',
          event: 'admin.launcher-open-failed',
          message: 'Admin launcher open dispatch failed',
          data: {
            displayMode: surface.displayMode,
            displayIndex: surface.surfaceIdentity?.displayIndex ?? null,
            target: 'local',
          },
          error: {
            name: error instanceof Error ? error.name : 'UnknownError',
            message: boundedErrorMessage(error),
          },
        });
      });
  }, [
    dispatchCommand,
    hasAdminLayer,
    logger,
    localAdminWorkspace,
    surface.displayMode,
    surface.isHostPrimaryDisplay,
    surface.surfaceIdentity?.displayIndex,
  ]);

  const handleLauncherEvent = useCallback(
    (event: unknown) => {
      if (!geometryReadyRef.current) {
        gestureState.current = createInitialAdminGestureState();
        logger.warn({
          category: 'admin.launcher',
          event: 'admin.launcher-gesture-rejected',
          message: 'Admin launcher gesture arrived before fresh geometry was measured',
          data: {
            displayMode: surface.displayMode,
            displayIndex: surface.surfaceIdentity?.displayIndex ?? null,
            isHostPrimaryDisplay: surface.isHostPrimaryDisplay,
            hasAdminLayer,
            reason: 'geometry-not-ready',
          },
        });
        return;
      }
      const eventPoint = adminLauncherPointFromEvent(event);
      const eventRecord =
        typeof event === 'object' && event !== null ? (event as Readonly<{readonly stopPropagation?: unknown}>) : null;
      const space = coordinateSpaceOf(windowMeasurementRef.current, canvas, hostLogicalSize);
      const point =
        space === null
          ? null
          : eventPoint === null
            ? null
            : logicalPointFromWindow({
                pageX: eventPoint.pageX,
                pageY: eventPoint.pageY,
                space,
              });
      if (point === null) {
        gestureState.current = createInitialAdminGestureState();
        logger.warn({
          category: 'admin.launcher',
          event: 'admin.launcher-gesture-rejected',
          message: 'Admin launcher gesture event had no usable coordinate',
          data: {
            displayMode: surface.displayMode,
            displayIndex: surface.surfaceIdentity?.displayIndex ?? null,
            isHostPrimaryDisplay: surface.isHostPrimaryDisplay,
            hasAdminLayer,
            reason: 'invalid-coordinate',
          },
        });
        return;
      }
      const result = trackAdminGesture(gestureState.current, {
        x: point.x,
        y: point.y,
        atMs: Date.now(),
      });
      gestureState.current = result.state;
      logger.info({
        category: 'admin.launcher',
        event: 'admin.launcher-gesture-progress',
        message: 'Admin launcher gesture coordinate evaluated',
        data: {
          displayMode: surface.displayMode,
          displayIndex: surface.surfaceIdentity?.displayIndex ?? null,
          logicalPoint: point,
          repetitions: result.state.repetitions,
          completed: result.completed,
          geometryMeasured: windowMeasurementRef.current !== null,
        },
      });
      if (result.completed) {
        const stopPropagation = eventRecord?.stopPropagation;
        if (typeof stopPropagation === 'function') {
          stopPropagation.call(event);
        }
        open();
      }
    },
    [
      canvas,
      hasAdminLayer,
      hostLogicalSize,
      logger,
      open,
      surface.displayMode,
      surface.isHostPrimaryDisplay,
      surface.surfaceIdentity?.displayIndex,
    ],
  );

  const launcherEventProps =
    typeof document === 'undefined'
      ? {onTouchEnd: hasAdminLayer ? undefined : handleLauncherEvent}
      : {onClick: hasAdminLayer ? undefined : handleLauncherEvent};
  return (
    <View
      ref={nodeRef}
      testID={adminTestIds.launcher}
      style={styles.observer}
      onLayout={() => measureOrigin(true)}
      {...launcherEventProps}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  observer: {
    flex: 1,
    width: '100%',
  },
});
