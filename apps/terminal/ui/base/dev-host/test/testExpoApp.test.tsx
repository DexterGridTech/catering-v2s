import {useEffect} from 'react';
import {act, render, type RenderResult} from '@testing-library/react-native';
import {StyleSheet, Text} from 'react-native';
import {describe, expect, it, vi} from 'vitest';
import {createTestExpoApp, testExpoTestIds, type SurfaceForm, type TestExpoAssembly} from '../src';

type Lifecycle = Record<'PRIMARY' | 'SECONDARY', {mounts: number; unmounts: number}>;
type LayoutHandler = (event: {nativeEvent: {layout: {width: number; height: number}}}) => void;
type SliderPressEvent = Readonly<{nativeEvent: Readonly<{locationX: number}>}>;
type StyleRecord = Readonly<{
  aspectRatio?: number;
  borderColor?: string;
  borderWidth?: number;
  bottom?: number;
  flexShrink?: number;
  height?: number;
  justifyContent?: string;
  left?: number;
  margin?: number;
  position?: string;
  right?: number;
  top?: number;
  transform?: ReadonlyArray<Readonly<{scale?: number}>>;
  width?: number | string;
}>;

const nextTurn = async (): Promise<void> => {
  await new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });
};

const waitFor = async (renderer: RenderResult, predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (predicate()) return;
    await act(nextTurn);
  }
  expect(predicate()).toBe(true);
};

const SurfaceProbe = ({
  displayMode,
  lifecycle,
}: Readonly<{displayMode: 'PRIMARY' | 'SECONDARY'; lifecycle: Lifecycle}>) => {
  useEffect(() => {
    lifecycle[displayMode].mounts += 1;
    return () => {
      lifecycle[displayMode].unmounts += 1;
    };
  }, [displayMode, lifecycle]);
  return <Text testID={`probe:${displayMode}`}>{displayMode}</Text>;
};

describe('ui.base.dev-host surface lifecycle', () => {
  it('keeps PRIMARY mounted while toggling the SECONDARY surface', async () => {
    const lifecycle: Lifecycle = {
      PRIMARY: {mounts: 0, unmounts: 0},
      SECONDARY: {mounts: 0, unmounts: 0},
    };
    const assembly: TestExpoAssembly = {
      createSurface: input => <SurfaceProbe displayMode={input.displayMode} lifecycle={lifecycle} />,
    };
    const createAssembly = vi.fn(async (): Promise<TestExpoAssembly> => assembly);
    const App = createTestExpoApp({
      appName: 'dev-host-test',
      title: '宿主测试',
      terminalSurfaces: {
        orientations: {
          landscape: {
            PRIMARY: {width: 1920, height: 1080},
            SECONDARY: {width: 1024, height: 600},
          },
        },
      },
      createAssembly,
      getRuntimeStatus: () => 'started',
    });

    const mountedRenderer = await render(<App />);
    await waitFor(mountedRenderer, () => mountedRenderer.queryAllByTestId(testExpoTestIds.canvas).length > 0);
    const canvas = mountedRenderer.getByTestId(testExpoTestIds.canvas);
    const previewViewport = mountedRenderer.getByTestId(testExpoTestIds.previewViewport);
    const previewViewportStyles = (
      Array.isArray(previewViewport.props.style) ? previewViewport.props.style : [previewViewport.props.style]
    ).filter((value): value is StyleRecord => typeof value === 'object' && value !== null);
    expect(previewViewportStyles.some(style => style.margin === 10 && style.borderWidth === undefined)).toBe(true);
    expect(mountedRenderer.queryAllByTestId(testExpoTestIds.measurePending)).toHaveLength(1);
    expect(mountedRenderer.queryAllByTestId(testExpoTestIds.surface('PRIMARY'))).toHaveLength(0);
    await act(async () => {
      (canvas.props.onLayout as LayoutHandler)({nativeEvent: {layout: {width: 1300, height: 96}}});
      (previewViewport.props.onLayout as LayoutHandler)({nativeEvent: {layout: {width: 1276, height: 76}}});
    });
    await waitFor(
      mountedRenderer,
      () => mountedRenderer.queryAllByTestId(testExpoTestIds.surface('PRIMARY')).length > 0,
    );
    const toolbarActions = mountedRenderer.getByTestId(testExpoTestIds.toolbarActions);
    expect(StyleSheet.flatten(toolbarActions.props.style)).toEqual(
      expect.objectContaining({width: '100%', justifyContent: 'center'}),
    );
    const primarySurface = mountedRenderer.getByTestId(testExpoTestIds.surface('PRIMARY'));
    const primaryStyles = (
      Array.isArray(primarySurface.props.style) ? primarySurface.props.style : [primarySurface.props.style]
    ).filter((value): value is StyleRecord => typeof value === 'object' && value !== null);
    expect(primaryStyles.some(style => style.width === 1920 && style.height === 1080)).toBe(true);
    expect(primaryStyles.some(style => style.flexShrink === 0)).toBe(true);
    expect(primaryStyles.some(style => style.aspectRatio !== undefined)).toBe(false);
    const logicalStage = mountedRenderer.getByTestId(testExpoTestIds.logicalStage);
    const logicalStyles = (
      Array.isArray(logicalStage.props.style) ? logicalStage.props.style : [logicalStage.props.style]
    ).filter((value): value is StyleRecord => typeof value === 'object' && value !== null);
    const scale = 1276 / 1920;
    expect(
      logicalStyles.some(
        style => style.width === 1920 && style.height === 1080 + 0 && style.transform?.[0]?.scale === scale,
      ),
    ).toBe(true);
    const scaledStage = mountedRenderer.getByTestId(testExpoTestIds.scaledStage);
    const scaledStyles = (
      Array.isArray(scaledStage.props.style) ? scaledStage.props.style : [scaledStage.props.style]
    ).filter((value): value is StyleRecord => typeof value === 'object' && value !== null);
    expect(scaledStyles.some(style => style.width === 1276 && style.height === 1276 * (1080 / 1920))).toBe(true);
    const primaryDecoration = mountedRenderer.getByTestId(testExpoTestIds.surfaceDecoration('PRIMARY'));
    const primaryDecorationStyles = (
      Array.isArray(primaryDecoration.props.style) ? primaryDecoration.props.style : [primaryDecoration.props.style]
    ).filter((value): value is StyleRecord => typeof value === 'object' && value !== null);
    expect(primaryDecorationStyles.some(style => style.position === 'absolute' && style.borderWidth === 1)).toBe(true);
    expect(primaryStyles.some(style => style.borderWidth !== undefined)).toBe(false);
    expect(primaryStyles.some(style => style.position === 'relative')).toBe(true);
    const surfaceWidthSlider = mountedRenderer.getByTestId(testExpoTestIds.surfaceWidthSlider);
    expect(surfaceWidthSlider.props).toMatchObject({
      accessibilityRole: 'adjustable',
      accessibilityValue: {min: 30, max: 100, now: 100, text: '100%'},
    });
    const changeSurfaceWidth = surfaceWidthSlider.props.onPressIn as (event: SliderPressEvent) => void;
    await act(async () => {
      changeSurfaceWidth({nativeEvent: {locationX: 0}});
    });
    const narrowStage = mountedRenderer.getByTestId(testExpoTestIds.scaledStage);
    const narrowStageStyles = (
      Array.isArray(narrowStage.props.style) ? narrowStage.props.style : [narrowStage.props.style]
    ).filter((value): value is StyleRecord => typeof value === 'object' && value !== null);
    expect(narrowStageStyles.some(style => style.width === 1276 * 0.3)).toBe(true);
    const narrowedLogicalStage = mountedRenderer.getByTestId(testExpoTestIds.logicalStage);
    const narrowedLogicalStyles = (
      Array.isArray(narrowedLogicalStage.props.style)
        ? narrowedLogicalStage.props.style
        : [narrowedLogicalStage.props.style]
    ).filter((value): value is StyleRecord => typeof value === 'object' && value !== null);
    expect(
      narrowedLogicalStyles.some(
        style => style.width === 1920 && style.height === 1080 && style.transform?.[0]?.scale === (1276 * 0.3) / 1920,
      ),
    ).toBe(true);
    expect(mountedRenderer.getByTestId(testExpoTestIds.surface('PRIMARY')).props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({width: 1920, height: 1080})]),
    );
    await act(async () => {
      changeSurfaceWidth({nativeEvent: {locationX: 132}});
    });
    const surfaceModeRadio = mountedRenderer.getByTestId(testExpoTestIds.surfaceToggle);
    expect(surfaceModeRadio.props.accessibilityLabel).toBe('屏幕模式');
    const singleModeRadio = mountedRenderer.getByTestId(testExpoTestIds.surfaceMode('single'));
    const dualModeRadio = mountedRenderer.getByTestId(testExpoTestIds.surfaceMode('dual'));
    expect(singleModeRadio.props.accessibilityRole).toBe('radio');
    expect(singleModeRadio.props.accessibilityState).toEqual({selected: true});
    expect(singleModeRadio.props['aria-checked']).toBe(true);
    expect(dualModeRadio.props.accessibilityRole).toBe('radio');
    expect(dualModeRadio.props.accessibilityState).toEqual({selected: false});
    expect(dualModeRadio.props['aria-checked']).toBe(false);
    expect(mountedRenderer.queryAllByTestId(testExpoTestIds.surfaceForm('mobile'))).toHaveLength(0);
    await act(async () => {
      (dualModeRadio.props.onPress as () => void)();
      await nextTurn();
    });
    await waitFor(
      mountedRenderer,
      () => mountedRenderer.queryAllByTestId(testExpoTestIds.surface('SECONDARY')).length > 0,
    );
    expect(mountedRenderer.getByTestId(testExpoTestIds.surfaceMode('single')).props.accessibilityState).toEqual({
      selected: false,
    });
    expect(mountedRenderer.getByTestId(testExpoTestIds.surfaceMode('single')).props['aria-checked']).toBe(false);
    expect(mountedRenderer.getByTestId(testExpoTestIds.surfaceMode('dual')).props.accessibilityState).toEqual({
      selected: true,
    });
    expect(mountedRenderer.getByTestId(testExpoTestIds.surfaceMode('dual')).props['aria-checked']).toBe(true);
    const secondarySurface = mountedRenderer.getByTestId(testExpoTestIds.surface('SECONDARY'));
    const secondaryStyles = (
      Array.isArray(secondarySurface.props.style) ? secondarySurface.props.style : [secondarySurface.props.style]
    ).filter((value): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null);
    expect(secondaryStyles.some(style => style.width === 1024 && style.height === 600 && style.flexShrink === 0)).toBe(
      true,
    );

    await act(async () => {
      (previewViewport.props.onLayout as LayoutHandler)({nativeEvent: {layout: {width: 936, height: 76}}});
    });
    const resizedLogicalStage = mountedRenderer.getByTestId(testExpoTestIds.logicalStage);
    const resizedStyles = (
      Array.isArray(resizedLogicalStage.props.style)
        ? resizedLogicalStage.props.style
        : [resizedLogicalStage.props.style]
    ).filter((value): value is StyleRecord => typeof value === 'object' && value !== null);
    const resizedScale = 936 / 1920;
    expect(resizedStyles.some(style => style.transform?.[0]?.scale === resizedScale)).toBe(true);

    expect(lifecycle.PRIMARY).toEqual({mounts: 1, unmounts: 0});
    expect(lifecycle.SECONDARY).toEqual({mounts: 1, unmounts: 0});
    expect(createAssembly).toHaveBeenCalledTimes(1);
    await act(async () => {
      mountedRenderer.unmount();
    });
    expect(lifecycle.PRIMARY).toEqual({mounts: 1, unmounts: 1});
    expect(lifecycle.SECONDARY).toEqual({mounts: 1, unmounts: 1});
  });

  it('switches between declared surface forms and rebuilds the Web surface in a non-browser host', async () => {
    const lifecycle: Lifecycle = {
      PRIMARY: {mounts: 0, unmounts: 0},
      SECONDARY: {mounts: 0, unmounts: 0},
    };
    const assembly: TestExpoAssembly = {
      createSurface: input => <SurfaceProbe displayMode={input.displayMode} lifecycle={lifecycle} />,
    };
    const createdForms: SurfaceForm[] = [];
    const createAssembly = vi.fn(
      async (input: Readonly<{readonly surfaceForm: SurfaceForm}>): Promise<TestExpoAssembly> => {
        createdForms.push(input.surfaceForm);
        return assembly;
      },
    );
    const App = createTestExpoApp({
      appName: 'dev-host-form-test',
      title: '宿主形态测试',
      terminalSurfaces: {
        orientations: {
          landscape: {
            PRIMARY: {width: 1920, height: 1080},
            SECONDARY: {width: 1024, height: 600},
          },
          portrait: {
            PRIMARY: {width: 360, height: 800},
          },
        },
      },
      createAssembly,
      getRuntimeStatus: () => 'started',
    });

    const mountedRenderer = await render(<App />);
    await waitFor(mountedRenderer, () => mountedRenderer.queryAllByTestId(testExpoTestIds.canvas).length > 0);
    const canvas = mountedRenderer.getByTestId(testExpoTestIds.canvas);
    const previewViewport = mountedRenderer.getByTestId(testExpoTestIds.previewViewport);
    await act(async () => {
      (canvas.props.onLayout as LayoutHandler)({nativeEvent: {layout: {width: 1300, height: 96}}});
      (previewViewport.props.onLayout as LayoutHandler)({nativeEvent: {layout: {width: 1276, height: 76}}});
    });
    await waitFor(
      mountedRenderer,
      () => mountedRenderer.queryAllByTestId(testExpoTestIds.surface('PRIMARY')).length > 0,
    );

    const mobileButton = mountedRenderer.getByTestId(testExpoTestIds.surfaceForm('mobile'));
    const laptopButton = mountedRenderer.getByTestId(testExpoTestIds.surfaceForm('laptop'));
    expect(laptopButton.props.accessibilityState).toEqual({selected: true});
    expect(mobileButton.props.accessibilityState).toEqual({selected: false});
    expect(createdForms).toEqual(['laptop']);

    await act(async () => {
      (mobileButton.props.onPress as () => void)();
      await nextTurn();
    });
    await waitFor(
      mountedRenderer,
      () =>
        createdForms.length === 2 &&
        (
          mountedRenderer.getByTestId(testExpoTestIds.surfaceForm('mobile')).props as {
            accessibilityState?: {selected?: boolean};
          }
        ).accessibilityState?.selected === true,
    );
    const mobileCanvas = mountedRenderer.getByTestId(testExpoTestIds.canvas);
    const mobilePreviewViewport = mountedRenderer.getByTestId(testExpoTestIds.previewViewport);
    await act(async () => {
      (mobileCanvas.props.onLayout as LayoutHandler)({nativeEvent: {layout: {width: 1300, height: 96}}});
      (mobilePreviewViewport.props.onLayout as LayoutHandler)({
        nativeEvent: {layout: {width: 1276, height: 76}},
      });
    });
    await waitFor(
      mountedRenderer,
      () => mountedRenderer.queryAllByTestId(testExpoTestIds.surface('PRIMARY')).length > 0,
    );
    const mobilePrimary = mountedRenderer.getByTestId(testExpoTestIds.surface('PRIMARY'));
    const mobilePrimaryStyles = (
      Array.isArray(mobilePrimary.props.style) ? mobilePrimary.props.style : [mobilePrimary.props.style]
    ).filter((value): value is StyleRecord => typeof value === 'object' && value !== null);
    expect(mobilePrimaryStyles.some(style => style.width === 360 && style.height === 800)).toBe(true);
    expect(mountedRenderer.queryAllByTestId(testExpoTestIds.surface('SECONDARY'))).toHaveLength(0);
    expect(mountedRenderer.queryAllByTestId(testExpoTestIds.surfaceToggle)).toHaveLength(0);
    expect(lifecycle.PRIMARY).toEqual({mounts: 2, unmounts: 1});
    expect(lifecycle.SECONDARY).toEqual({mounts: 0, unmounts: 0});

    await act(async () => {
      mountedRenderer.unmount();
    });
  });
});
