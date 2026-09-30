import {useCallback, useEffect, useMemo, useRef} from 'react';
import {Animated, BackHandler, Platform, Pressable, StyleSheet, View} from 'react-native';
import {closeLayerCommand, selectLayers} from '@catering-v2s/kernel-base-ui-state';
import {useRenderContext} from '../contexts/RenderContext';
import {useSurfaceContext} from '../contexts/SurfaceContext';
import {useSurfaceFocusBoundary} from '../contexts/SurfaceFocusBoundaryContext';
import {dispatchWithRequestId} from '../foundations/dispatchWithRequestId';
import {RenderFallback, resolvePart} from './resolvePart';
import {useDispatchCommand} from '../hooks/useDispatchCommand';
import {useRenderStatus} from '../hooks/useRenderStatus';
import {useUiCatalogContext} from '../hooks/useUiCatalogContext';
import {useUiStateSelector} from '../hooks/useUiStateSelector';
import {isUiCatalogEntryAvailable} from '@catering-v2s/kernel-base-ui-state';
import {useSurfacePresentationOffset} from '../contexts/SurfacePresentationOffsetContext';
import {SystemFailureBoundary} from './SystemFailureBoundary';

const LAYER_STACK_TEST_ID = 'ui-base-render:layer-stack';
const LAYER_BACKDROP_TEST_ID = 'ui-base-render:layer-backdrop';

type Layer = Readonly<{
  readonly layerId: string;
  readonly partKey: string;
  readonly props?: unknown;
  readonly openedAt: number;
}>;

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
  },
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  layerContent: {
    flex: 1,
  },
});

const tierRank = (
  layer: Layer,
  uiCatalog: Parameters<typeof resolvePart>[0]['uiCatalog'],
  rendererCatalog: Parameters<typeof resolvePart>[0]['rendererCatalog'],
): number => {
  const entry = uiCatalog.byPartKey[layer.partKey];
  if (entry === undefined) return 0;
  return rendererCatalog.tierOf(entry.rendererKey) === 'alert' ? 1 : 0;
};

const compareStrings = (left: string, right: string): number => (left === right ? 0 : left < right ? -1 : 1);

const compareLayers = (
  input: Readonly<{
    left: Layer;
    right: Layer;
    uiCatalog: Parameters<typeof resolvePart>[0]['uiCatalog'];
    rendererCatalog: Parameters<typeof resolvePart>[0]['rendererCatalog'];
  }>,
): number => {
  const tierDelta =
    tierRank(input.left, input.uiCatalog, input.rendererCatalog) -
    tierRank(input.right, input.uiCatalog, input.rendererCatalog);
  if (tierDelta !== 0) return tierDelta;
  if (input.left.openedAt !== input.right.openedAt) return input.left.openedAt - input.right.openedAt;
  return compareStrings(input.left.layerId, input.right.layerId);
};

const layerGuardOf = (
  layer: Layer,
  uiCatalog: Parameters<typeof resolvePart>[0]['uiCatalog'],
  rendererCatalog: Parameters<typeof resolvePart>[0]['rendererCatalog'],
) => {
  const entry = uiCatalog.byPartKey[layer.partKey];
  if (entry === undefined) return 'decisive' as const;
  return rendererCatalog.guardOf(entry.rendererKey) ?? 'decisive';
};

const ResolvedLayer = (input: Parameters<typeof resolvePart>[0]) => resolvePart(input);

export const LayerStack = () => {
  const {displayMode} = useSurfaceContext();
  const presentationOffsetY = useSurfacePresentationOffset();
  const notifyFocusBoundary = useSurfaceFocusBoundary();
  const {logger, uiCatalog, rendererCatalog, layerDismissals, reportPartDiagnostic, clearPartDiagnostic} =
    useRenderContext();
  const dispatchCommand = useDispatchCommand();
  const runtimeStatus = useRenderStatus();
  const catalogContext = useUiCatalogContext(displayMode);
  const layerSelector = useMemo(
    () => (root: Parameters<typeof selectLayers>[0]) => selectLayers(root, displayMode) as readonly Layer[],
    [displayMode],
  );
  const selectedLayers = useUiStateSelector(layerSelector);
  const layers = (selectedLayers ?? []).filter(layer => {
    const entry = uiCatalog.byPartKey[layer.partKey];
    return (
      entry === undefined || catalogContext === undefined || isUiCatalogEntryAvailable(entry, null, catalogContext)
    );
  });
  const orderedLayers = [...layers].sort((left, right) => compareLayers({left, right, uiCatalog, rendererCatalog}));
  const layerSignature = orderedLayers.map(layer => layer.layerId).join('\u0000');
  const topLayer = orderedLayers.at(-1);
  const topLayerId = topLayer?.layerId ?? null;
  const previousLayerSignature = useRef('');

  useEffect(() => {
    if (!__DEV__) return;
    logger.info({
      category: 'display-diagnostics',
      event: 'render.layer-selection',
      message: 'Layer selection observed',
      data: {
        source: 'ui-base-render.LayerStack',
        displayMode,
        runtimeStatus,
        layerCount: orderedLayers.length,
        layerIds: orderedLayers.map(layer => layer.layerId),
        topLayerId,
      },
    });
  }, [displayMode, logger, orderedLayers, runtimeStatus, topLayerId]);

  useEffect(() => {
    const hadLayers = previousLayerSignature.current.length > 0;
    const hasLayers = layerSignature.length > 0;
    if (!hadLayers && hasLayers) notifyFocusBoundary('suspend');
    if (hadLayers && !hasLayers) notifyFocusBoundary('restore');
    previousLayerSignature.current = layerSignature;
  }, [layerSignature, notifyFocusBoundary]);

  const topGuard =
    topLayer === undefined ? ('dismissible' as const) : layerGuardOf(topLayer, uiCatalog, rendererCatalog);
  const topLayerDismissal = topLayer === undefined ? undefined : layerDismissals?.[topLayer.partKey];

  const dismissTopLayer = useCallback(() => {
    if (topLayer === undefined || topGuard !== 'dismissible') return;
    if (topLayerDismissal !== undefined) {
      try {
        void Promise.resolve(
          topLayerDismissal({
            dispatchCommand,
            displayMode,
            layerId: topLayer.layerId,
          }),
        ).catch(() => undefined);
      } catch {
        // The feature-owned intent remains best-effort at an input boundary;
        // its command dispatcher records the actual rejection.
      }
      return;
    }
    void dispatchWithRequestId({
      dispatchCommand,
      definition: closeLayerCommand,
      payload: {displayMode, layerId: topLayer.layerId},
    }).catch(() => undefined);
  }, [dispatchCommand, displayMode, topGuard, topLayer, topLayerDismissal]);

  useEffect(() => {
    if (Platform.OS === 'web' || typeof BackHandler?.addEventListener !== 'function') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (topLayer === undefined) return false;
      if (topGuard === 'dismissible') dismissTopLayer();
      return true;
    });
    return () => subscription.remove();
  }, [dismissTopLayer, topGuard, topLayer]);

  if (runtimeStatus !== 'started') {
    return (
      <View testID={LAYER_STACK_TEST_ID}>
        <RenderFallback failure={{category: 'transition', reason: 'runtime-not-started'}} />
      </View>
    );
  }

  return (
    <View testID={LAYER_STACK_TEST_ID} pointerEvents="box-none" style={styles.stack}>
      {orderedLayers.length > 0 ? (
        <Pressable
          testID={LAYER_BACKDROP_TEST_ID}
          accessibilityRole="none"
          style={styles.backdrop}
          onPress={dismissTopLayer}
        />
      ) : null}
      {orderedLayers.map(layer => (
        <View
          key={layer.layerId}
          testID={`ui-base-render:layer:${layer.layerId}`}
          pointerEvents="box-none"
          style={styles.layer}
        >
          <Animated.View style={[styles.layerContent, {transform: [{translateY: presentationOffsetY}]}]}>
            <SystemFailureBoundary ownerId={`layer:${layer.layerId}`}>
              <ResolvedLayer
                placement={layer}
                displayMode={displayMode}
                containerKey={null}
                catalogContext={catalogContext!}
                uiCatalog={uiCatalog}
                rendererCatalog={rendererCatalog}
                reportPartDiagnostic={reportPartDiagnostic}
                clearPartDiagnostic={clearPartDiagnostic}
                elementKey={layer.layerId}
              />
            </SystemFailureBoundary>
          </Animated.View>
        </View>
      ))}
    </View>
  );
};
