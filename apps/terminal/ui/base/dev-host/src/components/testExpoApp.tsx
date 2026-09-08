import {useCallback, useEffect, useMemo, useRef, useState, type FC, type ReactElement} from 'react';
import {Pressable, StyleSheet, Text, View, type LayoutChangeEvent} from 'react-native';
import {
  readDisplayInfo,
  resolveSecondarySurfaceAvailable,
  type DisplayMode,
} from '@catering-v2s/kernel-base-display-context';
import type {PlatformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {createWebPlatformPorts, type SurfaceMode} from '../implementations/webPlatform';
import {
  calculateSurfacePreviewGeometry,
  SURFACE_PREVIEW_CONSTANTS,
  type SurfacePreviewLayout,
  type SurfacePreviewPolicy,
} from '../foundations/surfacePreview';

export type SurfaceSize = Readonly<{
  readonly width: number;
  readonly height: number;
}>;

export type TerminalSurfaces = Readonly<{
  readonly orientations: Readonly<{
    readonly landscape: Readonly<Record<DisplayMode, SurfaceSize>>;
    readonly portrait?: Readonly<Pick<Record<DisplayMode, SurfaceSize>, 'PRIMARY'>>;
  }>;
}>;

export type TestExpoRuntimeStatus = 'created' | 'starting' | 'started' | 'failed';

export type TestExpoAssembly = Readonly<{
  readonly createSurface: (displayMode: DisplayMode) => ReactElement;
}>;

export type TestExpoAppOptions<TAssembly extends TestExpoAssembly> = Readonly<{
  readonly appName: string;
  readonly title: string;
  readonly terminalSurfaces: TerminalSurfaces;
  readonly persistenceKey?: string;
  readonly createAssembly: (
    input: Readonly<{
      readonly platformPorts: PlatformPorts;
      readonly persistenceKey: string;
    }>,
  ) => Promise<TAssembly>;
  readonly getRuntimeStatus: (assembly: TAssembly) => TestExpoRuntimeStatus;
}>;

const CONTENT_MAX_WIDTH = 1600;
const CONTENT_HORIZONTAL_PADDING = 28;
const DEV_HOST_PREVIEW_LAYOUT: SurfacePreviewLayout = 'column';
const DEV_HOST_PREVIEW_POLICY: SurfacePreviewPolicy = 'width-fill-preserve-ratio';

const resolvePreviewLayoutStyles = (layout: SurfacePreviewLayout) => ({
  flexDirection: layout === 'row' ? ('row' as const) : ('column' as const),
  alignItems: layout === 'column' ? ('center' as const) : ('flex-start' as const),
});

const COLORS = {
  ink: '#EAF6FF',
  inkMuted: '#8CAEC5',
  canvas: '#061321',
  canvasRaised: '#0B1E30',
  white: '#F7FBFF',
  border: '#1B3D5A',
  borderStrong: '#2B6288',
  primary: '#32B7FF',
  primarySoft: '#102C47',
  secondary: '#23D3C2',
  secondarySoft: '#103D42',
  success: '#58E39B',
  successSoft: '#123C33',
  danger: '#FF6B6B',
  dangerSoft: '#4A1F2B',
  warning: '#F7C66A',
  warningSoft: '#43351A',
} as const;

type SurfaceCanvasProps = Readonly<{
  readonly assembly: TestExpoAssembly;
  readonly logger: PlatformPorts['logger'];
  readonly showSecondary: boolean;
  readonly terminalSurfaces: TerminalSurfaces;
  readonly testIdPrefix: string;
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
    ) return null;
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
    visualViewportWidth: visualViewport !== null && visualViewport !== undefined && isFiniteNumber(visualViewport.width)
      ? visualViewport.width
      : null,
    visualViewportHeight: visualViewport !== null && visualViewport !== undefined && isFiniteNumber(visualViewport.height)
      ? visualViewport.height
      : null,
    visualViewportScale: visualViewport !== null && visualViewport !== undefined && isFiniteNumber(visualViewport.scale)
      ? visualViewport.scale
      : null,
  };
};

const SurfaceCanvas = ({assembly, logger, showSecondary, terminalSurfaces, testIdPrefix}: SurfaceCanvasProps) => {
  const landscape = terminalSurfaces.orientations.landscape;
  const primary = landscape.PRIMARY;
  const secondary = landscape.SECONDARY;
  const [previewViewportSize, setPreviewViewportSize] = useState<PreviewViewportSize | null>(null);
  const canvasNodeRef = useRef<unknown>(null);
  const previewViewportNodeRef = useRef<unknown>(null);
  const scaledStageNodeRef = useRef<unknown>(null);
  const logicalStageNodeRef = useRef<unknown>(null);
  const surfaceNodeRefs = useRef<Partial<Record<DisplayMode, unknown>>>({});
  const reportReactLayout = useCallback((node: string, event: LayoutChangeEvent) => {
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
  }, [logger, previewViewportSize, showSecondary]);
  const handleCanvasLayout = useCallback((event: LayoutChangeEvent) => {
    reportReactLayout('canvas', event);
  }, [reportReactLayout]);
  const handlePreviewViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    reportReactLayout('preview-viewport', event);
    if (!isFiniteNumber(width) || width <= 0 || !isFiniteNumber(height) || height <= 0) {
      setPreviewViewportSize(null);
      return;
    }
    setPreviewViewportSize(current =>
      current?.width === width && current.height === height ? current : {width, height},
    );
  }, [reportReactLayout]);
  const geometry = useMemo(
    () =>
      previewViewportSize === null
        ? null
          : calculateSurfacePreviewGeometry({
            layout: DEV_HOST_PREVIEW_LAYOUT,
            showSecondary,
            viewport: previewViewportSize,
            primary,
            secondary,
          }),
    [primary, secondary, previewViewportSize, showSecondary],
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
  }, [geometry, logger, previewViewportSize, primary.height, primary.width, secondary.height, secondary.width, showSecondary]);
  const surfaceStyle = (size: SurfaceSize) => ({
    width: size.width,
    height: size.height,
    flexShrink: 0,
  });
  return (
    <View
      testID={`${testIdPrefix}:canvas`}
      style={[styles.canvas, {overflow: 'scroll'}]}
      onLayout={handleCanvasLayout}
      ref={node => {
        canvasNodeRef.current = node;
      }}
    >
      <View
        testID={`${testIdPrefix}:canvas:preview-viewport`}
        style={styles.previewViewport}
        onLayout={handlePreviewViewportLayout}
        ref={node => {
          previewViewportNodeRef.current = node;
        }}
      >
        {geometry === null ? (
          <View testID={`${testIdPrefix}:canvas:measure-pending`} style={styles.measurePending} />
        ) : (
          <View
            testID={`${testIdPrefix}:canvas:scaled-stage`}
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
              testID={`${testIdPrefix}:canvas:logical-stage`}
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
                testID={`${testIdPrefix}:surface:PRIMARY`}
                onLayout={event => reportReactLayout('surface-PRIMARY', event)}
                ref={node => {
                  surfaceNodeRefs.current.PRIMARY = node;
                }}
              >
                {assembly.createSurface('PRIMARY')}
                <View
                  pointerEvents="none"
                  testID={`${testIdPrefix}:surface:PRIMARY:decoration`}
                  style={[styles.surfaceDecoration, styles.primarySurfaceDecoration]}
                />
              </View>
              {showSecondary ? (
                <View
                  style={[styles.surface, styles.secondarySurface, surfaceStyle(secondary)]}
                  testID={`${testIdPrefix}:surface:SECONDARY`}
                  onLayout={event => reportReactLayout('surface-SECONDARY', event)}
                  ref={node => {
                    surfaceNodeRefs.current.SECONDARY = node;
                  }}
                >
                  {assembly.createSurface('SECONDARY')}
                  <View
                    pointerEvents="none"
                    testID={`${testIdPrefix}:surface:SECONDARY:decoration`}
                    style={[styles.surfaceDecoration, styles.secondarySurfaceDecoration]}
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

type HeaderStatusProps = Readonly<{
  readonly runtimeStatus: TestExpoRuntimeStatus;
  readonly showSecondary: boolean | undefined;
  readonly terminalSurfaces: TerminalSurfaces;
  readonly testIdPrefix: string;
}>;

const HeaderStatus = ({runtimeStatus, showSecondary, terminalSurfaces, testIdPrefix}: HeaderStatusProps) => {
  const landscape = terminalSurfaces.orientations.landscape;
  return (
  <View style={styles.headerInfo} testID={`${testIdPrefix}:header-status`}>
    <View style={styles.headerMetricRow}>
      <View style={styles.headerMetric}>
        <View
          style={[
            styles.statusIndicator,
            runtimeStatus === 'started' ? styles.statusIndicatorSuccess : styles.statusIndicatorWarning,
          ]}
        />
        <Text style={styles.headerMetricLabel}>RUNTIME</Text>
        <Text style={styles.headerMetricValue} testID={`${testIdPrefix}:runtime-status`}>
          {runtimeStatus === 'started' ? 'Started' : runtimeStatus === 'failed' ? 'Failed' : 'Starting'}
        </Text>
      </View>
      <View style={styles.headerMetricDivider} />
      <View style={styles.headerMetric}>
        <View style={[styles.statusIndicator, styles.statusIndicatorInfo]} />
        <Text style={styles.headerMetricLabel}>STORE</Text>
        <Text style={styles.headerMetricValue}>同一 assembly</Text>
      </View>
      <View style={styles.headerMetricDivider} />
      <View style={styles.headerMetric}>
        <View
          style={[styles.statusIndicator, showSecondary ? styles.statusIndicatorSuccess : styles.statusIndicatorMuted]}
        />
        <Text style={styles.headerMetricLabel}>SURFACES</Text>
        <Text style={styles.headerMetricValue}>
          {showSecondary ? '2 个 Root' : showSecondary === false ? '1 个 Root' : '读取中'}
        </Text>
      </View>
    </View>
    <View style={styles.headerSurfaceRow}>
      <View
        style={[styles.headerSurface, styles.headerPrimarySurface]}
        testID={`${testIdPrefix}:surface-summary:PRIMARY`}
      >
        <View style={[styles.surfaceDot, styles.primaryDot]} />
        <Text style={styles.headerSurfaceText}>
          主屏 · {landscape.PRIMARY.width} × {landscape.PRIMARY.height}
        </Text>
        <Text style={styles.headerSurfaceState}>已挂载</Text>
      </View>
      <View
        style={[styles.headerSurface, showSecondary ? styles.headerSecondarySurface : styles.headerInactiveSurface]}
        testID={`${testIdPrefix}:surface-summary:SECONDARY`}
      >
        <View style={[styles.surfaceDot, showSecondary ? styles.secondaryDot : styles.inactiveDot]} />
        <Text style={styles.headerSurfaceText}>
          客显 · {landscape.SECONDARY.width} × {landscape.SECONDARY.height}
        </Text>
        <Text style={[styles.headerSurfaceState, !showSecondary && styles.inactiveText]}>
          {showSecondary ? '已挂载' : showSecondary === false ? '未启用' : '读取中'}
        </Text>
      </View>
    </View>
  </View>
  );
};

const HostStateCard = ({
  kind,
  title,
  description,
  testID,
}: Readonly<{
  readonly kind: 'error' | 'pending';
  readonly title: string;
  readonly description: string;
  readonly testID: string;
}>) => (
  <View style={[styles.hostStateCard, kind === 'error' ? styles.hostErrorCard : styles.hostPendingCard]}>
    <View style={[styles.stateGlyph, kind === 'error' ? styles.errorGlyph : styles.pendingGlyph]}>
      {kind === 'error' ? (
        <Text style={styles.errorGlyphText}>!</Text>
      ) : (
        <Text style={styles.pendingGlyphText}>···</Text>
      )}
    </View>
    <View style={styles.hostStateCopy}>
      <Text style={styles.hostStateTitle} testID={testID}>
        {title}
      </Text>
      <Text style={styles.hostStateDescription}>{description}</Text>
    </View>
  </View>
);

export const createTestExpoApp = <TAssembly extends TestExpoAssembly>(options: TestExpoAppOptions<TAssembly>): FC => {
  const testIdPrefix = `${options.appName}:test-expo`;
  const persistenceKey = options.persistenceKey ?? `${options.appName}-web`;

  const TestExpoApp: FC = () => {
    const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>('single');
    const surfaceModeRef = useRef<SurfaceMode>(surfaceMode);
    surfaceModeRef.current = surfaceMode;
    const [assembly, setAssembly] = useState<TAssembly | undefined>();
    const [startupError, setStartupError] = useState(false);
    const [showSecondary, setShowSecondary] = useState<boolean | undefined>();
    const platformPorts = useMemo(
      () =>
        createWebPlatformPorts(() => surfaceModeRef.current, {
          storageNamespace: options.appName,
        }),
      [],
    );

    useEffect(() => {
      let active = true;
      void options
        .createAssembly({platformPorts, persistenceKey})
        .then(nextAssembly => {
          if (!active) return;
          setAssembly(nextAssembly);
          platformPorts.logger.info({
            category: `${options.appName}.test-expo`,
            event: 'startup-ready',
            data: {runtimeStatus: options.getRuntimeStatus(nextAssembly)},
          });
        })
        .catch(() => {
          if (!active) return;
          setStartupError(true);
          platformPorts.logger.error({
            category: `${options.appName}.test-expo`,
            event: 'startup-failed',
            message: `${options.appName} startup failed`,
          });
        });
      return () => {
        active = false;
      };
    }, [platformPorts]);

    useEffect(() => {
      if (assembly === undefined) return;
      let active = true;
      void readDisplayInfo(platformPorts.device).then(displayInfo => {
        if (!active) return;
        setShowSecondary(resolveSecondarySurfaceAvailable(displayInfo));
        platformPorts.logger.info({
          category: `${options.appName}.test-expo`,
          event: 'surface-decision-ready',
          data: {displayInfoStatus: displayInfo.status},
        });
      });
      return () => {
        active = false;
      };
    }, [assembly, platformPorts, surfaceMode]);

    const runtimeStatus = startupError
      ? 'failed'
      : assembly === undefined
        ? 'starting'
        : options.getRuntimeStatus(assembly);
    return (
      <View style={styles.root} testID={`${testIdPrefix}:root`}>
        <View style={styles.scroll}>
          <View style={styles.content}>
            <View style={styles.stageHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>LIVE SURFACE PREVIEW</Text>
                <Text style={styles.stageTitle}>{options.title}</Text>
              </View>
              <View style={styles.stageHeaderRight}>
                <HeaderStatus
                  runtimeStatus={runtimeStatus}
                  showSecondary={showSecondary}
                  terminalSurfaces={options.terminalSurfaces}
                  testIdPrefix={testIdPrefix}
                />
                <View style={styles.toolbarActions}>
                  <View style={styles.modePill}>
                    <View style={styles.modePillDot} />
                    <Text style={styles.modePillLabel} testID={`${testIdPrefix}:surface-mode`}>
                      {surfaceMode === 'dual' ? '双屏模式' : '单屏模式'}
                    </Text>
                  </View>
                  <Pressable
                    testID={`${testIdPrefix}:surface-toggle`}
                    accessibilityRole="button"
                    accessibilityLabel="切换单屏双屏"
                    accessibilityHint={
                      surfaceMode === 'dual' ? '切换为单屏并保留当前运行时' : '切换为双屏并保留当前运行时'
                    }
                    onPress={() => setSurfaceMode(current => (current === 'single' ? 'dual' : 'single'))}
                    style={({pressed}) => [styles.modeButton, pressed && styles.modeButtonPressed]}
                  >
                    <Text style={styles.modeButtonText}>{surfaceMode === 'dual' ? '切换为单屏' : '切换为双屏'}</Text>
                    <Text style={styles.modeButtonArrow}>→</Text>
                  </Pressable>
                </View>
              </View>
            </View>
            {startupError ? (
              <HostStateCard
                kind="error"
                testID={`${testIdPrefix}:start-error`}
                title={`${options.appName} 启动失败`}
                description="请查看启动日志后重试；业务 surface 尚未挂载。"
              />
            ) : assembly === undefined ? (
              <HostStateCard
                kind="pending"
                testID={`${testIdPrefix}:start-pending`}
                title={`${options.appName} 启动中`}
                description="正在组装 runtime、目录与业务模块，完成后会挂载主屏。"
              />
            ) : showSecondary === undefined ? (
              <HostStateCard
                kind="pending"
                testID={`${testIdPrefix}:display-pending`}
                title="正在读取屏幕信息"
                description="外壳正在决定是否挂载客显；这一步不改变业务模块与 runtime。"
              />
            ) : (
              <>
                <SurfaceCanvas
                  assembly={assembly}
                  logger={platformPorts.logger}
                  showSecondary={showSecondary}
                  terminalSurfaces={options.terminalSurfaces}
                  testIdPrefix={testIdPrefix}
                />
                <Text style={styles.stageFooter}>逻辑尺寸固定 · 外层按配置排布 · 内部由业务组件负责内容</Text>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  return TestExpoApp;
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.canvas,
  },
  scroll: {
    flex: 1,
    width: '100%',
    overflow: 'scroll',
  },
  headerInfo: {
    flex: 1,
    minWidth: 280,
    gap: 4,
    alignItems: 'flex-end',
  },
  headerMetricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 7,
  },
  headerMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerMetricDivider: {
    width: 1,
    height: 13,
    backgroundColor: COLORS.border,
  },
  headerMetricLabel: {
    color: COLORS.inkMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  headerMetricValue: {
    color: COLORS.ink,
    fontSize: 10,
    fontWeight: '700',
  },
  headerSurfaceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 7,
  },
  headerSurface: {
    minHeight: 22,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  headerPrimarySurface: {
    backgroundColor: COLORS.primarySoft,
    borderColor: '#2E81C4',
  },
  headerSecondarySurface: {
    backgroundColor: COLORS.secondarySoft,
    borderColor: '#27AFA4',
  },
  headerInactiveSurface: {
    backgroundColor: COLORS.canvasRaised,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
  },
  headerSurfaceText: {
    color: COLORS.ink,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  headerSurfaceState: {
    color: COLORS.success,
    fontSize: 9,
    fontWeight: '800',
  },
  toolbarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stageHeaderRight: {
    flex: 1,
    minWidth: 460,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 16,
  },
  modePill: {
    minHeight: 36,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 18,
    backgroundColor: '#0D263B',
    borderWidth: 1,
    borderColor: '#2E6287',
  },
  modePillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  modePillLabel: {
    color: COLORS.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  modeButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#116EA9',
    borderWidth: 1,
    borderColor: '#45C9FF',
    boxShadow: '0px 4px 12px rgba(30, 183, 245, 0.28)',
  },
  modeButtonPressed: {
    opacity: 0.78,
  },
  modeButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
  },
  modeButtonArrow: {
    color: '#BFD7FF',
    fontSize: 18,
    lineHeight: 18,
  },
  content: {
    width: '100%',
    maxWidth: CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: CONTENT_HORIZONTAL_PADDING,
    paddingTop: 24,
    paddingBottom: 48,
    gap: 18,
  },
  statusIndicator: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusIndicatorSuccess: {
    backgroundColor: COLORS.success,
  },
  statusIndicatorWarning: {
    backgroundColor: COLORS.warning,
  },
  statusIndicatorInfo: {
    backgroundColor: COLORS.primary,
  },
  statusIndicatorMuted: {
    backgroundColor: COLORS.borderStrong,
  },
  sectionEyebrow: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  surfaceDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  primaryDot: {
    backgroundColor: COLORS.primary,
  },
  secondaryDot: {
    backgroundColor: COLORS.secondary,
  },
  inactiveDot: {
    backgroundColor: COLORS.borderStrong,
  },
  inactiveText: {
    color: COLORS.inkMuted,
  },
  stageHeader: {
    width: '100%',
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 24,
  },
  stageTitle: {
    marginTop: 3,
    color: COLORS.ink,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  canvas: {
    width: '100%',
    minHeight: 96,
    borderRadius: 12,
    backgroundColor: '#0A2236',
    borderWidth: 2,
    borderColor: '#368DD0',
    boxShadow: '0px 0px 14px rgba(24, 152, 211, 0.22)',
  },
  measurePending: {
    height: 1,
    width: '100%',
    opacity: 0,
  },
  previewViewport: {
    alignSelf: 'stretch',
    margin: SURFACE_PREVIEW_CONSTANTS.stagePadding,
  },
  scaledStage: {
    position: 'relative',
    alignSelf: 'center',
  },
  logicalStage: {
    position: 'absolute',
  },
  surface: {
    position: 'relative',
    borderRadius: 2,
    overflow: 'hidden',
  },
  primarySurface: {
    backgroundColor: '#F7FBFF',
  },
  secondarySurface: {
    backgroundColor: '#E9FFFF',
  },
  surfaceDecoration: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderRadius: 2,
  },
  primarySurfaceDecoration: {
    borderColor: '#3792F4',
  },
  secondarySurfaceDecoration: {
    borderColor: '#24B9AE',
  },
  stageFooter: {
    width: '100%',
    marginTop: 12,
    color: '#82A8BF',
    fontSize: 11,
    textAlign: 'center',
  },
  hostStateCard: {
    width: '100%',
    minHeight: 132,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  hostPendingCard: {
    backgroundColor: '#102C47',
    borderColor: '#2E81C4',
  },
  hostErrorCard: {
    backgroundColor: COLORS.dangerSoft,
    borderColor: '#A94752',
  },
  stateGlyph: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  pendingGlyph: {
    backgroundColor: '#173A58',
  },
  pendingGlyphText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  errorGlyph: {
    backgroundColor: COLORS.danger,
  },
  errorGlyphText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: '800',
  },
  hostStateCopy: {
    flex: 1,
  },
  hostStateTitle: {
    color: COLORS.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  hostStateDescription: {
    marginTop: 5,
    color: COLORS.inkMuted,
    fontSize: 13,
    lineHeight: 20,
  },
});
