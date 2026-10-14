import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {View, type LayoutChangeEvent} from 'react-native';
import type {DisplayMode} from '@catering-v2s/kernel-base-display-context';
import type {PlatformPorts} from '@catering-v2s/kernel-base-platform-ports';
import type {TestId} from '@catering-v2s/ui-base-primitives';
import type {SurfaceForm, TestExpoAssembly, TerminalSurfaces} from '../types/testExpoApp';
import {calculateSurfacePreviewGeometry, SURFACE_PREVIEW_CONSTANTS, type SurfacePreviewLayout, type SurfacePreviewPolicy} from '../foundations/surfacePreview';
import {resolveSurfaceGroup} from './surfaceGroup';
import {styles} from './testExpoAppStyles';
import type {SurfaceSize} from '../types/testExpoApp';

const DEV_HOST_PREVIEW_LAYOUT: SurfacePreviewLayout = 'column';
const DEV_HOST_PREVIEW_POLICY: SurfacePreviewPolicy = 'width-selective-preserve-ratio';
const resolvePreviewLayoutStyles = (layout: SurfacePreviewLayout) => ({
  flexDirection: layout === 'row' ? ('row' as const) : ('column' as const),
  alignItems: layout === 'column' ? ('center' as const) : ('flex-start' as const),
});

type SurfaceCanvasProps = Readonly<{
  readonly assembly: TestExpoAssembly;
  readonly logger: PlatformPorts['logger'];
  readonly showSecondary: boolean;
  readonly surfaceWidthPercent: number;
  readonly surfaceForm: SurfaceForm;
  readonly terminalSurfaces: TerminalSurfaces;
  readonly makeTestId: (element: string, key?: string) => TestId;
}>;

type WebRect = Readonly<{
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}>;

type WebViewport = Readonly<{
  readonly width: number | null;
  readonly height: number | null;
  readonly devicePixelRatio: number | null;
  readonly visualViewportWidth: number | null;
  readonly visualViewportHeight: number | null;
  readonly visualViewportScale: number | null;
}>;

type PreviewViewportSize = Readonly<{
  readonly width: number;
  readonly height: number;
}>;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const readWebRect = (node: unknown): WebRect | null => {
  if (typeof node !== 'object' || node === null) return null;
  const candidate = node as {readonly getBoundingClientRect?: unknown};
  if (typeof candidate.getBoundingClientRect !== 'function') return null;
  try {
    const rect = candidate.getBoundingClientRect() as Partial<WebRect>;
    if (
      !isFiniteNumber(rect.left) ||
      !isFiniteNumber(rect.top) ||
      !isFiniteNumber(rect.right) ||
      !isFiniteNumber(rect.bottom) ||
      !isFiniteNumber(rect.width) ||
      !isFiniteNumber(rect.height)
    )
      return null;
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  } catch {
    return null;
  }
};

const readWebViewport = (): WebViewport => {
  if (typeof window === 'undefined') {
    return {
      width: null,
      height: null,
      devicePixelRatio: null,
      visualViewportWidth: null,
      visualViewportHeight: null,
      visualViewportScale: null,
    };
  }
  const visualViewport = window.visualViewport;
  return {
    width: isFiniteNumber(window.innerWidth) ? window.innerWidth : null,
    height: isFiniteNumber(window.innerHeight) ? window.innerHeight : null,
    devicePixelRatio: isFiniteNumber(window.devicePixelRatio) ? window.devicePixelRatio : null,
    visualViewportWidth:
      visualViewport !== null && visualViewport !== undefined && isFiniteNumber(visualViewport.width)
        ? visualViewport.width
        : null,
    visualViewportHeight:
      visualViewport !== null && visualViewport !== undefined && isFiniteNumber(visualViewport.height)
        ? visualViewport.height
        : null,
    visualViewportScale:
      visualViewport !== null && visualViewport !== undefined && isFiniteNumber(visualViewport.scale)
        ? visualViewport.scale
        : null,
  };
};

export const SurfaceCanvas = ({
  assembly,
  logger,
  showSecondary,
  surfaceWidthPercent,
  surfaceForm,
  terminalSurfaces,
  makeTestId,
}: SurfaceCanvasProps) => {
  const {primary, secondary} = resolveSurfaceGroup(terminalSurfaces, surfaceForm);
  const [previewViewportSize, setPreviewViewportSize] = useState<PreviewViewportSize | null>(null);
  const canvasNodeRef = useRef<unknown>(null);
  const previewViewportNodeRef = useRef<unknown>(null);
  const scaledStageNodeRef = useRef<unknown>(null);
  const logicalStageNodeRef = useRef<unknown>(null);
  const surfaceNodeRefs = useRef<Partial<Record<DisplayMode, unknown>>>({});
  const reportReactLayout = useCallback(
    (node: string, event: LayoutChangeEvent) => {
      if (!__DEV__) return;
      const {x, y, width, height} = event.nativeEvent.layout;
      logger.info({
        category: 'display-diagnostics',
        event: 'web.react-layout',
        message: 'Web display-chain React layout observed',
        data: {
          source: 'ui-base-dev-host.SurfaceCanvas',
          node,
          units: 'css-layout-unit',
          x,
          y,
          width,
          height,
          previewViewportWidth: previewViewportSize?.width ?? null,
          previewViewportHeight: previewViewportSize?.height ?? null,
          showSecondary,
        },
      });
    },
    [logger, previewViewportSize, showSecondary],
  );
  const handleCanvasLayout = useCallback(
    (event: LayoutChangeEvent) => {
      reportReactLayout('canvas', event);
    },
    [reportReactLayout],
  );
  const handlePreviewViewportLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const {width, height} = event.nativeEvent.layout;
      reportReactLayout('preview-viewport', event);
      if (!isFiniteNumber(width) || width <= 0 || !isFiniteNumber(height) || height <= 0) {
        setPreviewViewportSize(null);
        return;
      }
      setPreviewViewportSize(current =>
        current?.width === width && current.height === height ? current : {width, height},
      );
    },
    [reportReactLayout],
  );
  const geometry = useMemo(
    () =>
      previewViewportSize === null
        ? null
        : calculateSurfacePreviewGeometry({
            layout: DEV_HOST_PREVIEW_LAYOUT,
            showSecondary,
            viewport: {
              width: previewViewportSize.width * (surfaceWidthPercent / 100),
              height: previewViewportSize.height,
            },
            primary,
            secondary,
          }),
    [primary, secondary, previewViewportSize, showSecondary, surfaceWidthPercent],
  );
  useEffect(() => {
    if (!__DEV__ || geometry === null) return;
    logger.info({
      category: 'display-diagnostics',
      event: 'web.surface-geometry',
      message: 'Web display-chain geometry observed',
      data: {
        source: 'ui-base-dev-host.SurfaceCanvas',
        units: 'logical-stage-and-css-rect',
        viewport: readWebViewport(),
        layout: DEV_HOST_PREVIEW_LAYOUT,
        previewPolicy: DEV_HOST_PREVIEW_POLICY,
        surfaceWidthPercent,
        showSecondary,
        previewViewportWidth: previewViewportSize?.width ?? null,
        previewViewportHeight: previewViewportSize?.height ?? null,
        primaryWidth: primary.width,
        primaryHeight: primary.height,
        secondaryWidth: secondary.width,
        secondaryHeight: secondary.height,
        stageWidth: geometry.stageWidth,
        stageHeight: geometry.stageHeight,
        scaleX: geometry.scaleX,
        scaleY: geometry.scaleY,
        renderedWidth: geometry.renderedWidth,
        renderedHeight: geometry.renderedHeight,
        canvasRect: readWebRect(canvasNodeRef.current),
        previewViewportRect: readWebRect(previewViewportNodeRef.current),
        scaledStageRect: readWebRect(scaledStageNodeRef.current),
        logicalStageRect: readWebRect(logicalStageNodeRef.current),
        primaryRect: readWebRect(surfaceNodeRefs.current.PRIMARY),
        secondaryRect: showSecondary ? readWebRect(surfaceNodeRefs.current.SECONDARY) : null,
      },
    });
  }, [
    geometry,
    logger,
    previewViewportSize,
    primary.height,
    primary.width,
    secondary.height,
    secondary.width,
    showSecondary,
    surfaceWidthPercent,
  ]);
  const surfaceStyle = (size: SurfaceSize) => ({
    width: size.width,
    height: size.height,
    flexShrink: 0,
  });
  return (
    <View
      testID={makeTestId('canvas')}
      style={[styles.canvas, {overflow: 'scroll'}]}
      onLayout={handleCanvasLayout}
      ref={node => {
        canvasNodeRef.current = node;
      }}
    >
      <View
        testID={makeTestId('canvas', 'preview-viewport')}
        style={styles.previewViewport}
        onLayout={handlePreviewViewportLayout}
        ref={node => {
          previewViewportNodeRef.current = node;
        }}
      >
        {geometry === null ? (
          <View testID={makeTestId('canvas', 'measure-pending')} style={styles.measurePending} />
        ) : (
          <View
            testID={makeTestId('canvas', 'scaled-stage')}
            onLayout={event => reportReactLayout('scaled-stage', event)}
            ref={node => {
              scaledStageNodeRef.current = node;
            }}
            style={[
              styles.scaledStage,
              {
                width: geometry.renderedWidth,
                height: geometry.renderedHeight,
              },
            ]}
          >
            <View
              testID={makeTestId('canvas', 'logical-stage')}
              onLayout={event => reportReactLayout('logical-stage', event)}
              ref={node => {
                logicalStageNodeRef.current = node;
              }}
              style={[
                styles.logicalStage,
                {
                  left: 0,
                  top: 0,
                  width: geometry.stageWidth,
                  height: geometry.stageHeight,
                  ...resolvePreviewLayoutStyles(DEV_HOST_PREVIEW_LAYOUT),
                  gap: SURFACE_PREVIEW_CONSTANTS.surfaceGap,
                  transform: [{scale: geometry.scaleX}],
                  transformOrigin: 'top left',
                },
              ]}
            >
              <View
                style={[styles.surface, styles.primarySurface, surfaceStyle(primary)]}
                testID={makeTestId('surface', 'PRIMARY')}
                onLayout={event => reportReactLayout('surface-PRIMARY', event)}
                ref={node => {
                  surfaceNodeRefs.current.PRIMARY = node;
                }}
              >
                {assembly.createSurface({displayIndex: 0, displayMode: 'PRIMARY', surfaceForm})}
                <View
                  testID={makeTestId('surface-decoration', 'PRIMARY')}
                  style={[styles.surfaceDecoration, styles.primarySurfaceDecoration, {pointerEvents: 'none'}]}
                />
              </View>
              {showSecondary ? (
                <View
                  style={[styles.surface, styles.secondarySurface, surfaceStyle(secondary)]}
                  testID={makeTestId('surface', 'SECONDARY')}
                  onLayout={event => reportReactLayout('surface-SECONDARY', event)}
                  ref={node => {
                    surfaceNodeRefs.current.SECONDARY = node;
                  }}
                >
                  {assembly.createSurface({displayIndex: 1, displayMode: 'SECONDARY', surfaceForm})}
                  <View
                    testID={makeTestId('surface-decoration', 'SECONDARY')}
                    style={[styles.surfaceDecoration, styles.secondarySurfaceDecoration, {pointerEvents: 'none'}]}
                  />
                </View>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

