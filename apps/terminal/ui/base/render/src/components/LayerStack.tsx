import {useCallback, useEffect, useMemo, useRef} from 'react';
import {Animated, BackHandler, Platform, Pressable, StyleSheet, View} from 'react-native';
import {closeLayerCommand, selectLayers} from '@catering-v2s/kernel-base-ui-state';
import {resolveWorkspace, selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {DisplayMode} from '@catering-v2s/kernel-base-ui-state';
import type {WorkspaceKey} from '@catering-v2s/kernel-base-state';
import {useRenderContext} from '../hooks/useRenderContext';
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
import {renderTestIds} from '../foundations/renderTestIds';

type Layer = Readonly<{
  readonly layerId: string;
  readonly partKey: string;
  readonly props?: unknown;
  readonly openedAt: number;
  readonly renderDisplayMode?: DisplayMode;
  readonly renderWorkspace?: WorkspaceKey;
}>;

const localWorkspaceForRoot = (root: Parameters<typeof selectLayers>[0]): WorkspaceKey => {
  const instanceMode = selectRuntimeInstanceMode(root);
  const displayRole = selectDisplayRole(root);
  return instanceMode === 'SLAVE' && displayRole === 'VICE' ? 'BRANCH' : resolveWorkspace({instanceMode, displayRole});
};

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
  const tier = rendererCatalog.tierOf(entry.rendererKey);
  return tier === 'admin' ? 2 : tier === 'alert' ? 1 : 0;
};

const isAdminLayer = (
  layer: Layer,
  uiCatalog: Parameters<typeof resolvePart>[0]['uiCatalog'],
  rendererCatalog: Parameters<typeof resolvePart>[0]['rendererCatalog'],
): boolean => {
  const entry = uiCatalog.byPartKey[layer.partKey];
  return entry !== undefined && rendererCatalog.tierOf(entry.rendererKey) === 'admin';
};

const isLocalPrimaryLayer = (
  layer: Layer,
  uiCatalog: Parameters<typeof resolvePart>[0]['uiCatalog'],
  rendererCatalog: Parameters<typeof resolvePart>[0]['rendererCatalog'],
): boolean => {
  const entry = uiCatalog.byPartKey[layer.partKey];
  return entry !== undefined && rendererCatalog.placementScopeOf(entry.rendererKey) === 'local-primary';
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
  const {displayMode, isHostPrimaryDisplay} = useSurfaceContext();
  const presentationOffsetY = useSurfacePresentationOffset();
  const notifyFocusBoundary = useSurfaceFocusBoundary();
  const {
    logger,
    uiCatalog,
    rendererCatalog,
    layerDismissals,
    reportPartDiagnostic,
    clearPartDiagnostic,
    selectBusinessInterlockActive,
    renderBusinessInterlock,
  } = useRenderContext();
  const dispatchCommand = useDispatchCommand();
  const runtimeStatus = useRenderStatus();
  const catalogContext = useUiCatalogContext(displayMode);
  const localPrimaryWorkspace = useUiStateSelector(localWorkspaceForRoot);
  const localPrimaryCatalogContext = useUiCatalogContext('PRIMARY', localPrimaryWorkspace);
  const layerSelector = useMemo(
    () => (root: Parameters<typeof selectLayers>[0]) => {
      const currentLayers = selectLayers(root, displayMode).filter(
        layer => !isLocalPrimaryLayer(layer as Layer, uiCatalog, rendererCatalog),
      );
      const isViceSlave = selectRuntimeInstanceMode(root) === 'SLAVE' && selectDisplayRole(root) === 'VICE';
      const localAdminLayers = isViceSlave
        ? selectLayers(root, displayMode, 'BRANCH').filter(layer =>
            isAdminLayer(layer as Layer, uiCatalog, rendererCatalog),
          )
        : [];
      const projectedBusinessLayers = isViceSlave
        ? currentLayers.filter(layer => !isAdminLayer(layer as Layer, uiCatalog, rendererCatalog))
        : currentLayers;
      if (!isHostPrimaryDisplay) return [...projectedBusinessLayers, ...localAdminLayers] as readonly Layer[];
      const workspace = localWorkspaceForRoot(root);
      const localPrimaryLayers = selectLayers(root, 'PRIMARY', workspace)
        .filter(layer => isLocalPrimaryLayer(layer as Layer, uiCatalog, rendererCatalog))
        .map(layer => ({...layer, renderDisplayMode: 'PRIMARY' as const, renderWorkspace: workspace}));
      return [...projectedBusinessLayers, ...localAdminLayers, ...localPrimaryLayers] as readonly Layer[];
    },
    [displayMode, isHostPrimaryDisplay, rendererCatalog, uiCatalog],
  );
  const selectedLayers = useUiStateSelector(layerSelector);
  const interlockSelector = selectBusinessInterlockActive ?? alwaysInactiveInterlock;
  const businessInterlockActive = useUiStateSelector(interlockSelector) ?? false;
  const layers = (selectedLayers ?? []).filter(layer => {
    const entry = uiCatalog.byPartKey[layer.partKey];
    if (entry === undefined) return true;
    const localPrimary = isLocalPrimaryLayer(layer, uiCatalog, rendererCatalog);
    const context = localPrimary ? localPrimaryCatalogContext : catalogContext;
    return context === undefined || isUiCatalogEntryAvailable(entry, null, context);
  });
  const orderedLayers = [...layers].sort((left, right) => compareLayers({left, right, uiCatalog, rendererCatalog}));
  const layerSignature = [
    ...orderedLayers.map(layer => layer.layerId),
    ...(businessInterlockActive ? [BUSINESS_INTERLOCK_FOCUS_MARKER] : []),
  ].join('\u0000');
  const adminLayers = orderedLayers.filter(layer => isAdminLayer(layer, uiCatalog, rendererCatalog));
  const localPrimaryLayers = orderedLayers.filter(layer => isLocalPrimaryLayer(layer, uiCatalog, rendererCatalog));
  const businessLayers = orderedLayers.filter(
    layer =>
      !isAdminLayer(layer, uiCatalog, rendererCatalog) && !isLocalPrimaryLayer(layer, uiCatalog, rendererCatalog),
  );
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
        businessInterlockActive,
        layerCount: orderedLayers.length,
        layerIds: orderedLayers.map(layer => layer.layerId),
        topLayerId,
      },
    });
  }, [businessInterlockActive, displayMode, logger, orderedLayers, runtimeStatus, topLayerId]);

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
  const topLayerDisplayMode = topLayer?.renderDisplayMode ?? displayMode;
  const topLayerWorkspace = topLayer?.renderWorkspace;

  const renderLayer = (layer: Layer) => (
    <View
      key={layer.layerId}
      testID={renderTestIds.layer(layer.layerId)}
      accessibilityElementsHidden={
        businessInterlockActive &&
        !isAdminLayer(layer, uiCatalog, rendererCatalog) &&
        !isLocalPrimaryLayer(layer, uiCatalog, rendererCatalog)
      }
      importantForAccessibility={
        businessInterlockActive &&
        !isAdminLayer(layer, uiCatalog, rendererCatalog) &&
        !isLocalPrimaryLayer(layer, uiCatalog, rendererCatalog)
          ? 'no-hide-descendants'
          : 'auto'
      }
      pointerEvents="box-none"
      style={styles.layer}
    >
      <Animated.View style={[styles.layerContent, {transform: [{translateY: presentationOffsetY}]}]}>
        <SystemFailureBoundary ownerId={`layer:${layer.layerId}`}>
          <ResolvedLayer
            placement={layer}
            displayMode={layer.renderDisplayMode ?? displayMode}
            containerKey={null}
            catalogContext={
              (isLocalPrimaryLayer(layer, uiCatalog, rendererCatalog) ? localPrimaryCatalogContext : catalogContext)!
            }
            uiCatalog={uiCatalog}
            rendererCatalog={rendererCatalog}
            reportPartDiagnostic={reportPartDiagnostic}
            clearPartDiagnostic={clearPartDiagnostic}
            elementKey={layer.layerId}
          />
        </SystemFailureBoundary>
      </Animated.View>
    </View>
  );

  const dismissTopLayer = useCallback(() => {
    if (topLayer === undefined || topGuard !== 'dismissible') return;
    if (topLayerDismissal !== undefined) {
      try {
        void Promise.resolve(
          topLayerDismissal({
            dispatchCommand,
            displayMode: topLayerDisplayMode,
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
      payload: {
        displayMode: topLayerDisplayMode,
        layerId: topLayer.layerId,
        ...(topLayerWorkspace === undefined ? {} : {workspace: topLayerWorkspace}),
      },
    }).catch(() => undefined);
  }, [dispatchCommand, topGuard, topLayer, topLayerDisplayMode, topLayerDismissal, topLayerWorkspace]);

  useEffect(() => {
    if (Platform.OS === 'web' || typeof BackHandler?.addEventListener !== 'function') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (businessInterlockActive && (topLayer === undefined || !isAdminLayer(topLayer, uiCatalog, rendererCatalog)))
        return true;
      if (topLayer === undefined) return false;
      if (topGuard === 'dismissible') dismissTopLayer();
      return true;
    });
    return () => subscription.remove();
  }, [businessInterlockActive, dismissTopLayer, rendererCatalog, topGuard, topLayer, uiCatalog]);

  if (runtimeStatus !== 'started') {
    return (
      <View testID={renderTestIds.layerStack}>
        <RenderFallback failure={{category: 'transition', reason: 'runtime-not-started'}} />
      </View>
    );
  }

  return (
    <View testID={renderTestIds.layerStack} pointerEvents="box-none" style={styles.stack}>
      {orderedLayers.length > 0 ? (
        <Pressable
          testID={renderTestIds.layerBackdrop}
          accessibilityRole="none"
          style={styles.backdrop}
          onPress={dismissTopLayer}
        />
      ) : null}
      {businessLayers.map(renderLayer)}
      {businessInterlockActive ? renderBusinessInterlock?.() : null}
      {localPrimaryLayers.map(renderLayer)}
      {adminLayers.map(renderLayer)}
    </View>
  );
};

const BUSINESS_INTERLOCK_FOCUS_MARKER = renderTestIds.businessInterlock;
const alwaysInactiveInterlock = (): boolean => false;
