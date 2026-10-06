import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type FC,
  type ReactElement,
} from 'react';
import {Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent} from 'react-native';
import {
  readDisplayInfo,
  resolveSecondarySurfaceAvailable,
  type DisplayMode,
} from '@catering-v2s/kernel-base-display-context';
import type {NativeLoadingCapability, PlatformPorts} from '@catering-v2s/kernel-base-platform-ports';
import {createWebPlatformPorts, type SurfaceMode, type WebPlatformOptions} from '../implementations/webPlatform';
import type {SurfaceForm} from '@catering-v2s/kernel-base-contracts';
import type {TestId} from '@catering-v2s/ui-base-primitives';
import {createWebSurfaceHostSource, type WebSurfaceHostSource} from '../implementations/webSurfaceHost';
import {testExpoTestIds} from '../foundations/testExpoTestIds';
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

export type {SurfaceForm} from '@catering-v2s/kernel-base-contracts';

export type SurfaceCreationInput = Readonly<{
  readonly displayIndex: 0 | 1;
  readonly displayMode: DisplayMode;
  readonly surfaceForm: SurfaceForm;
}>;

export type TerminalSurfaces = Readonly<{
  readonly orientations: Readonly<{
    readonly landscape: Readonly<Record<DisplayMode, SurfaceSize>>;
    readonly portrait?: Readonly<Pick<Record<DisplayMode, SurfaceSize>, 'PRIMARY'>>;
  }>;
}>;

export type TestExpoRuntimeStatus = 'created' | 'starting' | 'started' | 'failed';

export type TestExpoAssembly = Readonly<{
  readonly createSurface: (input: SurfaceCreationInput) => ReactElement;
}>;

export type TestExpoAppOptions<TAssembly extends TestExpoAssembly> = Readonly<{
  readonly appName: string;
  readonly title: string;
  readonly terminalSurfaces: TerminalSurfaces;
  readonly surfaceForm?: SurfaceForm;
  readonly persistenceKey?: string;
  readonly webPlatformOptions?: WebPlatformOptions;
  readonly createAssembly: (
    input: Readonly<{
      readonly platformPorts: PlatformPorts;
      readonly nativeLoadingCapability: NativeLoadingCapability;
      readonly persistenceKey: string;
      readonly surfaceForm: SurfaceForm;
      readonly surfaceHostSourcesByDisplayIndex: Readonly<Partial<Record<0 | 1, WebSurfaceHostSource>>>;
    }>,
  ) => Promise<TAssembly>;
  readonly getRuntimeStatus: (assembly: TAssembly) => TestExpoRuntimeStatus;
  /**
   * Lets the integration owner commit a display-topology refresh before the
   * host reads the same display facts for surface mounting.
   */
  readonly onSurfaceModeChanged?: (
    input: Readonly<{
      readonly assembly: TAssembly;
      readonly surfaceMode: SurfaceMode;
    }>,
  ) => Promise<void>;
}>;

const createWebNativeLoadingCapability = (): NativeLoadingCapability => {
  let hidden = false;
  return Object.freeze({
    targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const}),
    hideOnce: async (reason: string) => {
      if (hidden) return Object.freeze({hidden: false, reason, alreadyHidden: true});
      hidden = true;
      return Object.freeze({hidden: true, reason, alreadyHidden: false});
    },
  });
};

const SURFACE_FORM_QUERY_PARAM = 'surfaceForm';

const CONTENT_MAX_WIDTH = 1600;
const CONTENT_HORIZONTAL_PADDING = 28;
const DEV_HOST_PREVIEW_LAYOUT: SurfacePreviewLayout = 'column';
const DEV_HOST_PREVIEW_POLICY: SurfacePreviewPolicy = 'width-selective-preserve-ratio';
const SURFACE_WIDTH_MIN_PERCENT = 30;
const SURFACE_WIDTH_MAX_PERCENT = 100;
const SURFACE_WIDTH_STEP_PERCENT = 1;
const DEFAULT_SURFACE_WIDTH_PERCENT = SURFACE_WIDTH_MAX_PERCENT;

const createSurfaceModeSource = (initial: SurfaceMode) => {
  let current = initial;
  return Object.freeze({
    read: (): SurfaceMode => current,
    write: (next: SurfaceMode): void => {
      current = next;
    },
  });
};

const clampSurfaceWidthPercent = (value: number): number => {
  if (!Number.isFinite(value)) return DEFAULT_SURFACE_WIDTH_PERCENT;
  return Math.min(SURFACE_WIDTH_MAX_PERCENT, Math.max(SURFACE_WIDTH_MIN_PERCENT, Math.round(value)));
};

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
  readonly surfaceWidthPercent: number;
  readonly surfaceForm: SurfaceForm;
  readonly terminalSurfaces: TerminalSurfaces;
  readonly makeTestId: (element: string, key?: string) => TestId;
}>;

type SurfaceGroup = Readonly<{
  readonly primary: SurfaceSize;
  readonly secondary: SurfaceSize;
}>;

const resolveSurfaceGroup = (terminalSurfaces: TerminalSurfaces, surfaceForm: SurfaceForm): SurfaceGroup => {
  if (surfaceForm === 'laptop') {
    return {
      primary: terminalSurfaces.orientations.landscape.PRIMARY,
      secondary: terminalSurfaces.orientations.landscape.SECONDARY,
    };
  }
  const portrait = terminalSurfaces.orientations.portrait;
  if (portrait === undefined) throw new Error('[ui-base-dev-host] mobile surface declarations are required');
  return {primary: portrait.PRIMARY, secondary: portrait.PRIMARY};
};

const isSurfaceForm = (value: string | null): value is SurfaceForm => value === 'laptop' || value === 'mobile';

const readSurfaceFormFromWebLocation = (): SurfaceForm | undefined => {
  if (typeof window === 'undefined' || typeof window.location?.search !== 'string') return undefined;
  const requested = new URLSearchParams(window.location.search).get(SURFACE_FORM_QUERY_PARAM);
  return isSurfaceForm(requested) ? requested : undefined;
};

const resolveInitialSurfaceForm = (
  defaultSurfaceForm: SurfaceForm,
  terminalSurfaces: TerminalSurfaces,
): SurfaceForm => {
  const requested = readSurfaceFormFromWebLocation();
  if (requested === undefined) return defaultSurfaceForm;
  if (requested === 'mobile' && terminalSurfaces.orientations.portrait === undefined) return defaultSurfaceForm;
  return requested;
};

const restartWebSurfaceWithForm = (surfaceForm: SurfaceForm): boolean => {
  if (typeof window === 'undefined' || typeof window.location?.replace !== 'function') return false;
  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set(SURFACE_FORM_QUERY_PARAM, surfaceForm);
  window.location.replace(nextUrl.toString());
  return true;
};

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

const SurfaceCanvas = ({
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

type HeaderStatusProps = Readonly<{
  readonly runtimeStatus: TestExpoRuntimeStatus;
  readonly showSecondary: boolean | undefined;
  readonly surfaceForm: SurfaceForm;
  readonly terminalSurfaces: TerminalSurfaces;
  readonly makeTestId: (element: string, key?: string) => TestId;
}>;

type SurfaceFormSwitcherProps = Readonly<{
  readonly surfaceForm: SurfaceForm;
  readonly supportsMobile: boolean;
  readonly onSelect: (surfaceForm: SurfaceForm) => void;
  readonly makeTestId: (element: string, key?: string) => TestId;
}>;

type SurfaceRadioOptionProps = Readonly<{
  readonly label: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly optionTestID: TestId;
}>;

const SurfaceRadioOption = ({label, selected, onPress, optionTestID}: SurfaceRadioOptionProps) => (
  <Pressable
    testID={optionTestID}
    accessibilityRole="radio"
    accessibilityLabel={label}
    accessibilityState={{selected}}
    aria-checked={selected}
    onPress={onPress}
    style={({pressed}) => [
      styles.surfaceRadioOption,
      selected && styles.surfaceRadioOptionSelected,
      pressed && styles.surfaceRadioOptionPressed,
    ]}
  >
    <View style={[styles.surfaceRadioCircle, selected && styles.surfaceRadioCircleSelected]}>
      {selected ? <View style={styles.surfaceRadioDot} /> : null}
    </View>
    <Text style={[styles.surfaceRadioText, selected && styles.surfaceRadioTextSelected]}>{label}</Text>
  </Pressable>
);

const SurfaceFormSwitcher = ({surfaceForm, supportsMobile, onSelect, makeTestId}: SurfaceFormSwitcherProps) => (
  <View style={styles.surfaceRadioGroup} testID={makeTestId('surface-form-switcher')} accessibilityLabel="终端视角">
    <Text style={styles.surfaceRadioGroupLabel}>视角</Text>
    <SurfaceRadioOption
      optionTestID={makeTestId('surface-form', 'laptop')}
      label="laptop 视角"
      selected={surfaceForm === 'laptop'}
      onPress={() => onSelect('laptop')}
    />
    {supportsMobile ? (
      <SurfaceRadioOption
        optionTestID={makeTestId('surface-form', 'mobile')}
        label="mobile 视角"
        selected={surfaceForm === 'mobile'}
        onPress={() => onSelect('mobile')}
      />
    ) : null}
  </View>
);

type SurfaceWidthControlProps = Readonly<{
  readonly surfaceWidthPercent: number;
  readonly onChange: (value: number) => void;
  readonly makeTestId: (element: string, key?: string) => TestId;
}>;

const SURFACE_WIDTH_SLIDER_TRACK_WIDTH = 132;

type SurfaceWidthKeyDownEvent = Readonly<{
  readonly nativeEvent: Readonly<{readonly key: string}>;
  readonly preventDefault: () => void;
}>;

const surfaceWidthPercentFromLocation = (locationX: number): number =>
  clampSurfaceWidthPercent(
    SURFACE_WIDTH_MIN_PERCENT +
      (locationX / SURFACE_WIDTH_SLIDER_TRACK_WIDTH) * (SURFACE_WIDTH_MAX_PERCENT - SURFACE_WIDTH_MIN_PERCENT),
  );

const SurfaceWidthSlider = ({surfaceWidthPercent, onChange, makeTestId}: SurfaceWidthControlProps) => {
  const handleLocation = (event: GestureResponderEvent): void => {
    const locationX = event.nativeEvent.locationX;
    if (Number.isFinite(locationX)) onChange(surfaceWidthPercentFromLocation(locationX));
  };
  const handleKeyDown = (event: SurfaceWidthKeyDownEvent): void => {
    const key = event.nativeEvent.key;
    const delta =
      key === 'ArrowLeft' || key === 'ArrowDown'
        ? -SURFACE_WIDTH_STEP_PERCENT
        : key === 'ArrowRight' || key === 'ArrowUp'
          ? SURFACE_WIDTH_STEP_PERCENT
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    onChange(clampSurfaceWidthPercent(surfaceWidthPercent + delta));
  };
  const fillPercent =
    ((surfaceWidthPercent - SURFACE_WIDTH_MIN_PERCENT) / (SURFACE_WIDTH_MAX_PERCENT - SURFACE_WIDTH_MIN_PERCENT)) * 100;
  const pressableProps: ComponentProps<typeof Pressable> &
    Readonly<{
      readonly onKeyDown: (event: SurfaceWidthKeyDownEvent) => void;
    }> = {
    accessibilityLabel: 'surface 宽度比例',
    accessibilityRole: 'adjustable',
    accessibilityValue: {
      min: SURFACE_WIDTH_MIN_PERCENT,
      max: SURFACE_WIDTH_MAX_PERCENT,
      now: surfaceWidthPercent,
      text: `${surfaceWidthPercent}%`,
    },
    onKeyDown: handleKeyDown,
    onPressIn: handleLocation,
    onPressMove: handleLocation,
    style: styles.surfaceWidthSlider,
    testID: makeTestId('surface-width-slider'),
  };
  return (
    <Pressable {...pressableProps}>
      <View style={styles.surfaceWidthSliderTrack}>
        <View style={[styles.surfaceWidthSliderFill, {width: `${fillPercent}%`}]} />
        <View style={[styles.surfaceWidthSliderThumb, {left: `${fillPercent}%`}]} />
      </View>
    </Pressable>
  );
};

type SurfaceModeRadioProps = Readonly<{
  readonly surfaceMode: SurfaceMode;
  readonly onSelect: (surfaceMode: SurfaceMode) => void;
  readonly makeTestId: (element: string, key?: string) => TestId;
}>;

const SurfaceModeRadio = ({surfaceMode, onSelect, makeTestId}: SurfaceModeRadioProps) => (
  <View style={styles.surfaceRadioGroup} testID={makeTestId('surface-toggle')} accessibilityLabel="屏幕模式">
    <Text style={styles.surfaceRadioGroupLabel}>屏幕</Text>
    <SurfaceRadioOption
      optionTestID={makeTestId('surface-mode', 'single')}
      label="单屏模式"
      selected={surfaceMode === 'single'}
      onPress={() => onSelect('single')}
    />
    <SurfaceRadioOption
      optionTestID={makeTestId('surface-mode', 'dual')}
      label="双屏模式"
      selected={surfaceMode === 'dual'}
      onPress={() => onSelect('dual')}
    />
  </View>
);

const SurfaceWidthControl = ({surfaceWidthPercent, onChange, makeTestId}: SurfaceWidthControlProps) => (
  <View
    style={styles.surfaceWidthControl}
    testID={makeTestId('surface-width-control')}
    accessibilityLabel="surface 宽度"
  >
    <Text style={styles.surfaceWidthControlLabel}>surface 宽度</Text>
    <SurfaceWidthSlider surfaceWidthPercent={surfaceWidthPercent} onChange={onChange} makeTestId={makeTestId} />
    <Text style={styles.surfaceWidthControlValue} testID={makeTestId('surface-width-value')}>
      {surfaceWidthPercent}%
    </Text>
  </View>
);

const HeaderStatus = ({runtimeStatus, showSecondary, surfaceForm, terminalSurfaces, makeTestId}: HeaderStatusProps) => {
  const {primary, secondary} = resolveSurfaceGroup(terminalSurfaces, surfaceForm);
  return (
    <View style={styles.headerInfo} testID={makeTestId('header-status')}>
      <View style={styles.headerMetricRow}>
        <View style={styles.headerMetric}>
          <View
            style={[
              styles.statusIndicator,
              runtimeStatus === 'started' ? styles.statusIndicatorSuccess : styles.statusIndicatorWarning,
            ]}
          />
          <Text style={styles.headerMetricLabel}>RUNTIME</Text>
          <Text style={styles.headerMetricValue} testID={makeTestId('runtime-status')}>
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
            style={[
              styles.statusIndicator,
              showSecondary ? styles.statusIndicatorSuccess : styles.statusIndicatorMuted,
            ]}
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
          testID={makeTestId('surface-summary', 'PRIMARY')}
        >
          <View style={[styles.surfaceDot, styles.primaryDot]} />
          <Text style={styles.headerSurfaceText}>
            {surfaceForm === 'laptop' ? '主屏' : '手持屏'} · {primary.width} × {primary.height}
          </Text>
          <Text style={styles.headerSurfaceState}>已挂载</Text>
        </View>
        {surfaceForm === 'laptop' ? (
          <View
            style={[styles.headerSurface, showSecondary ? styles.headerSecondarySurface : styles.headerInactiveSurface]}
            testID={makeTestId('surface-summary', 'SECONDARY')}
          >
            <View style={[styles.surfaceDot, showSecondary ? styles.secondaryDot : styles.inactiveDot]} />
            <Text style={styles.headerSurfaceText}>
              客显 · {secondary.width} × {secondary.height}
            </Text>
            <Text style={[styles.headerSurfaceState, !showSecondary && styles.inactiveText]}>
              {showSecondary ? '已挂载' : showSecondary === false ? '未启用' : '读取中'}
            </Text>
          </View>
        ) : null}
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
  readonly testID: TestId;
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
  const makeTestId = testExpoTestIds.node;
  const persistenceKey = options.persistenceKey ?? `${options.appName}-web`;
  const defaultSurfaceForm = options.surfaceForm ?? 'laptop';
  const supportsMobile = options.terminalSurfaces.orientations.portrait !== undefined;

  const TestExpoApp: FC = () => {
    const [surfaceForm, setSurfaceForm] = useState<SurfaceForm>(() =>
      resolveInitialSurfaceForm(defaultSurfaceForm, options.terminalSurfaces),
    );
    const [surfaceWidthPercent, setSurfaceWidthPercent] = useState(DEFAULT_SURFACE_WIDTH_PERCENT);
    const [surfaceMode, setSurfaceMode] = useState<SurfaceMode>('single');
    const [surfaceModeSource] = useState(() => createSurfaceModeSource(surfaceMode));
    const changeSurfaceMode = (nextSurfaceMode: SurfaceMode): void => {
      surfaceModeSource.write(nextSurfaceMode);
      setSurfaceMode(nextSurfaceMode);
    };
    const [assembly, setAssembly] = useState<TAssembly | undefined>();
    const [startupError, setStartupError] = useState(false);
    const [showSecondary, setShowSecondary] = useState<boolean | undefined>();
    const webPlatformOptions = useMemo(() => {
      const readDisplaySurfaces =
        options.webPlatformOptions?.readDisplaySurfaces ??
        (() => {
          const {primary, secondary} = resolveSurfaceGroup(options.terminalSurfaces, surfaceForm);
          return Object.freeze([
            Object.freeze({
              displayId: 0,
              role: 'primary' as const,
              logicalSize: Object.freeze({...primary}),
              physicalSize: null,
              readiness: 'ready' as const,
            }),
            ...(surfaceModeSource.read() === 'dual' && surfaceForm === 'laptop'
              ? [
                  Object.freeze({
                    displayId: 1,
                    role: 'secondary' as const,
                    logicalSize: Object.freeze({...secondary}),
                    physicalSize: null,
                    readiness: 'ready' as const,
                  }),
                ]
              : []),
          ]);
        });
      return Object.freeze({
        ...options.webPlatformOptions,
        readDisplaySurfaces,
        storageNamespace: options.appName,
      });
    }, [surfaceForm, surfaceModeSource]);
    const platformPorts = useMemo(
      () => createWebPlatformPorts(surfaceModeSource.read, webPlatformOptions),
      [surfaceModeSource, webPlatformOptions],
    );
    const webSurfaceHostSources = useMemo(() => {
      const {primary, secondary} = resolveSurfaceGroup(options.terminalSurfaces, surfaceForm);
      return Object.freeze({
        0: createWebSurfaceHostSource({displayIndex: 0, size: primary}),
        ...(surfaceForm === 'laptop' ? {1: createWebSurfaceHostSource({displayIndex: 1, size: secondary})} : {}),
      });
    }, [surfaceForm]);
    const [nativeLoadingCapability] = useState(createWebNativeLoadingCapability);

    useEffect(() => {
      let active = true;
      setAssembly(undefined);
      setStartupError(false);
      setShowSecondary(undefined);
      void options
        .createAssembly({
          platformPorts,
          nativeLoadingCapability,
          persistenceKey,
          surfaceForm,
          surfaceHostSourcesByDisplayIndex: webSurfaceHostSources,
        })
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
    }, [nativeLoadingCapability, platformPorts, surfaceForm, webSurfaceHostSources]);

    useEffect(() => {
      if (assembly === undefined) return;
      let active = true;
      void (async () => {
        try {
          await options.onSurfaceModeChanged?.({assembly, surfaceMode});
          const displayInfo = await readDisplayInfo(platformPorts.device);
          if (!active) return;
          setShowSecondary(surfaceForm === 'laptop' && resolveSecondarySurfaceAvailable(displayInfo));
          platformPorts.logger.info({
            category: `${options.appName}.test-expo`,
            event: 'surface-decision-ready',
            data: {displayInfoStatus: displayInfo.status},
          });
        } catch (error) {
          if (!active) return;
          setShowSecondary(false);
          platformPorts.logger.error({
            category: `${options.appName}.test-expo`,
            event: 'surface-decision-failed',
            message: error instanceof Error ? error.message.slice(0, 160) : 'Surface topology refresh failed',
          });
        }
      })();
      return () => {
        active = false;
      };
    }, [assembly, platformPorts, surfaceForm, surfaceMode]);

    const runtimeStatus = startupError
      ? 'failed'
      : assembly === undefined
        ? 'starting'
        : options.getRuntimeStatus(assembly);
    return (
      <View style={styles.root} testID={makeTestId('root')}>
        <View style={styles.scroll}>
          <View style={styles.content}>
            <View style={styles.stageHeader}>
              <View style={styles.stageHeaderTopRow} testID={makeTestId('stage-header-top')}>
                <View>
                  <Text style={styles.sectionEyebrow}>LIVE SURFACE PREVIEW</Text>
                  <Text style={styles.stageTitle}>{options.title}</Text>
                </View>
                <HeaderStatus
                  runtimeStatus={runtimeStatus}
                  showSecondary={showSecondary}
                  surfaceForm={surfaceForm}
                  terminalSurfaces={options.terminalSurfaces}
                  makeTestId={makeTestId}
                />
              </View>
              <View style={styles.toolbarActions} testID={makeTestId('toolbar-actions')}>
                <SurfaceWidthControl
                  surfaceWidthPercent={surfaceWidthPercent}
                  onChange={setSurfaceWidthPercent}
                  makeTestId={makeTestId}
                />
                <SurfaceFormSwitcher
                  surfaceForm={surfaceForm}
                  supportsMobile={supportsMobile}
                  makeTestId={makeTestId}
                  onSelect={nextSurfaceForm => {
                    if (nextSurfaceForm === surfaceForm) return;
                    const restarted = restartWebSurfaceWithForm(nextSurfaceForm);
                    platformPorts.logger.info({
                      category: `${options.appName}.test-expo`,
                      event: 'surface-form-switch-requested',
                      message: restarted
                        ? 'Web surface form switch requested; restarting the surface page'
                        : 'Surface form switch requested; rebuilding the host in place',
                      data: {
                        from: surfaceForm,
                        to: nextSurfaceForm,
                        restart: restarted ? 'web-page-reload' : 'in-memory-rebuild',
                      },
                    });
                    changeSurfaceMode('single');
                    if (!restarted) setSurfaceForm(nextSurfaceForm);
                  }}
                />
                {surfaceForm === 'laptop' ? (
                  <SurfaceModeRadio surfaceMode={surfaceMode} onSelect={changeSurfaceMode} makeTestId={makeTestId} />
                ) : null}
              </View>
            </View>
            {startupError ? (
              <HostStateCard
                kind="error"
                testID={makeTestId('start-error')}
                title={`${options.appName} 启动失败`}
                description="请查看启动日志后重试；业务 surface 尚未挂载。"
              />
            ) : assembly === undefined ? (
              <HostStateCard
                kind="pending"
                testID={makeTestId('start-pending')}
                title={`${options.appName} 启动中`}
                description="正在组装 runtime、目录与业务模块，完成后会挂载主屏。"
              />
            ) : showSecondary === undefined ? (
              <HostStateCard
                kind="pending"
                testID={makeTestId('display-pending')}
                title="正在读取屏幕信息"
                description="外壳正在决定是否挂载客显；这一步不改变业务模块与 runtime。"
              />
            ) : (
              <>
                <SurfaceCanvas
                  key={surfaceForm}
                  assembly={assembly}
                  logger={platformPorts.logger}
                  showSecondary={showSecondary}
                  surfaceWidthPercent={surfaceWidthPercent}
                  surfaceForm={surfaceForm}
                  terminalSurfaces={options.terminalSurfaces}
                  makeTestId={makeTestId}
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
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  surfaceRadioGroup: {
    minHeight: 36,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    backgroundColor: '#0D263B',
    borderWidth: 1,
    borderColor: '#2E6287',
  },
  surfaceRadioGroupLabel: {
    paddingHorizontal: 7,
    color: COLORS.inkMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  surfaceRadioOption: {
    minHeight: 28,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
  },
  surfaceRadioOptionSelected: {
    backgroundColor: COLORS.primarySoft,
  },
  surfaceRadioOptionPressed: {
    opacity: 0.78,
  },
  surfaceRadioCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.inkMuted,
  },
  surfaceRadioCircleSelected: {
    borderColor: COLORS.primary,
  },
  surfaceRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  surfaceRadioText: {
    color: COLORS.inkMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  surfaceRadioTextSelected: {
    color: COLORS.ink,
  },
  surfaceWidthControl: {
    minHeight: 36,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#0D263B',
    borderWidth: 1,
    borderColor: '#2E6287',
  },
  surfaceWidthControlLabel: {
    color: COLORS.inkMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  surfaceWidthSlider: {
    width: 132,
    height: 24,
    justifyContent: 'center',
  },
  surfaceWidthSliderTrack: {
    width: SURFACE_WIDTH_SLIDER_TRACK_WIDTH,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.borderStrong,
    position: 'relative',
  },
  surfaceWidthSliderFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  surfaceWidthSliderThumb: {
    width: 18,
    height: 18,
    marginLeft: -9,
    marginTop: -6,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    position: 'absolute',
    top: 3,
  },
  surfaceWidthControlValue: {
    minWidth: 34,
    color: COLORS.ink,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'right',
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
    gap: 14,
  },
  stageHeaderTopRow: {
    width: '100%',
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
