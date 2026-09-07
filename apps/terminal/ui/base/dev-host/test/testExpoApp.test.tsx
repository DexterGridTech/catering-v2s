import {useEffect} from 'react';
import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {Text} from 'react-native';
import {describe, expect, it, vi} from 'vitest';
import {createTestExpoApp, type TestExpoAssembly} from '../src';
import {SURFACE_PREVIEW_CONSTANTS} from '../src/foundations/surfacePreview';

type Lifecycle = Record<'PRIMARY' | 'SECONDARY', {mounts: number; unmounts: number}>;
type LayoutHandler = (event: {nativeEvent: {layout: {width: number; height: number}}}) => void;
type StyleRecord = Readonly<{
  aspectRatio?: number;
  flexShrink?: number;
  height?: number;
  transform?: ReadonlyArray<Readonly<{scale?: number}>>;
  width?: number;
}>;

const nextTurn = async (): Promise<void> => {
  await new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });
};

const waitFor = async (renderer: ReactTestRenderer, predicate: () => boolean): Promise<void> => {
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
      createSurface: displayMode => <SurfaceProbe displayMode={displayMode} lifecycle={lifecycle} />,
    };
    const createAssembly = vi.fn(async (): Promise<TestExpoAssembly> => assembly);
    const App = createTestExpoApp({
      appName: 'dev-host-test',
      title: '宿主测试',
      terminalSurfaces: {
        layout: 'column',
        scaleToFit: true,
        surfaces: {
          PRIMARY: {width: 1920, height: 1080},
          SECONDARY: {width: 1024, height: 600},
        },
      },
      createAssembly,
      getRuntimeStatus: () => 'started',
    });

    let renderer: ReactTestRenderer | undefined;
    act(() => {
      renderer = create(<App />);
    });
    const mountedRenderer = renderer!;
    await waitFor(
      mountedRenderer,
      () => mountedRenderer.root.findAllByProps({testID: 'dev-host-test:test-expo:canvas'}).length > 0,
    );
    const canvas = mountedRenderer.root.findByProps({testID: 'dev-host-test:test-expo:canvas'});
    expect(
      mountedRenderer.root.findAllByProps({testID: 'dev-host-test:test-expo:canvas:measure-pending'}),
    ).toHaveLength(1);
    expect(mountedRenderer.root.findAllByProps({testID: 'dev-host-test:test-expo:surface:PRIMARY'})).toHaveLength(0);
    act(() => {
      (canvas.props.onLayout as LayoutHandler)({nativeEvent: {layout: {width: 1300, height: 96}}});
    });
    await waitFor(
      mountedRenderer,
      () => mountedRenderer.root.findAllByProps({testID: 'dev-host-test:test-expo:surface:PRIMARY'}).length > 0,
    );
    const primarySurface = mountedRenderer.root.findByProps({testID: 'dev-host-test:test-expo:surface:PRIMARY'});
    const primaryStyles = (
      Array.isArray(primarySurface.props.style) ? primarySurface.props.style : [primarySurface.props.style]
    ).filter((value): value is StyleRecord => typeof value === 'object' && value !== null);
    expect(primaryStyles.some(style => style.width === 1920 && style.height === 1080)).toBe(true);
    expect(primaryStyles.some(style => style.flexShrink === 0)).toBe(true);
    expect(primaryStyles.some(style => style.aspectRatio !== undefined)).toBe(false);
    const logicalStage = mountedRenderer.root.findByProps({testID: 'dev-host-test:test-expo:canvas:logical-stage'});
    const logicalStyles = (
      Array.isArray(logicalStage.props.style) ? logicalStage.props.style : [logicalStage.props.style]
    ).filter((value): value is StyleRecord => typeof value === 'object' && value !== null);
    const scale =
      (1300 - 2 * SURFACE_PREVIEW_CONSTANTS.canvasBorder - 2 * SURFACE_PREVIEW_CONSTANTS.stagePadding) / 1920;
    expect(
      logicalStyles.some(
        style => style.width === 1920 && style.height === 1080 + 0 && style.transform?.[0]?.scale === scale,
      ),
    ).toBe(true);
    const scaledStage = mountedRenderer.root.findByProps({testID: 'dev-host-test:test-expo:canvas:scaled-stage'});
    const scaledStyles = (
      Array.isArray(scaledStage.props.style) ? scaledStage.props.style : [scaledStage.props.style]
    ).filter((value): value is StyleRecord => typeof value === 'object' && value !== null);
    expect(scaledStyles.some(style => style.width === 1300 - 2 * SURFACE_PREVIEW_CONSTANTS.canvasBorder)).toBe(true);
    const toggle = mountedRenderer.root.findByProps({testID: 'dev-host-test:test-expo:surface-toggle'});
    await act(async () => {
      (toggle.props.onPress as () => void)();
      await nextTurn();
    });
    await waitFor(
      mountedRenderer,
      () => mountedRenderer.root.findAllByProps({testID: 'dev-host-test:test-expo:surface:SECONDARY'}).length > 0,
    );
    const secondarySurface = mountedRenderer.root.findByProps({testID: 'dev-host-test:test-expo:surface:SECONDARY'});
    const secondaryStyles = (
      Array.isArray(secondarySurface.props.style) ? secondarySurface.props.style : [secondarySurface.props.style]
    ).filter((value): value is Readonly<Record<string, unknown>> => typeof value === 'object' && value !== null);
    expect(secondaryStyles.some(style => style.width === 1024 && style.height === 600 && style.flexShrink === 0)).toBe(
      true,
    );

    act(() => {
      (canvas.props.onLayout as LayoutHandler)({nativeEvent: {layout: {width: 960, height: 96}}});
    });
    const resizedLogicalStage = mountedRenderer.root.findByProps({
      testID: 'dev-host-test:test-expo:canvas:logical-stage',
    });
    const resizedStyles = (
      Array.isArray(resizedLogicalStage.props.style)
        ? resizedLogicalStage.props.style
        : [resizedLogicalStage.props.style]
    ).filter((value): value is StyleRecord => typeof value === 'object' && value !== null);
    const resizedScale =
      (960 - 2 * SURFACE_PREVIEW_CONSTANTS.canvasBorder - 2 * SURFACE_PREVIEW_CONSTANTS.stagePadding) / 1920;
    expect(resizedStyles.some(style => style.transform?.[0]?.scale === resizedScale)).toBe(true);

    expect(lifecycle.PRIMARY).toEqual({mounts: 1, unmounts: 0});
    expect(lifecycle.SECONDARY).toEqual({mounts: 1, unmounts: 0});
    expect(createAssembly).toHaveBeenCalledTimes(1);
    act(() => {
      mountedRenderer.unmount();
    });
    expect(lifecycle.PRIMARY).toEqual({mounts: 1, unmounts: 1});
    expect(lifecycle.SECONDARY).toEqual({mounts: 1, unmounts: 1});
  });
});
