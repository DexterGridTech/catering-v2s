import {act, create, type ReactTestRenderer} from 'react-test-renderer';
import {StyleSheet} from 'react-native';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {FakeWebStorage} from './support';

vi.mock('../src', async importOriginal => {
  const actual = await importOriginal<typeof import('../src')>();
  return {
    ...actual,
    createSampleAssembly: vi.fn(actual.createSampleAssembly),
  };
});

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

type LayoutHandler = (event: {nativeEvent: {layout: {width: number; height: number}}}) => void;

describe('test-expo host shell', () => {
  let renderer: ReactTestRenderer | undefined;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new FakeWebStorage(),
    });
  });

  afterEach(() => {
    if (renderer !== undefined)
      act(() => {
        renderer!.unmount();
      });
    renderer = undefined;
    delete (globalThis as {localStorage?: Storage}).localStorage;
  });

  it('mounts one surface, toggles to two, and reuses the same assembly', async () => {
    const {default: App} = await import('../test-expo/App');
    const assemblyModule = await import('../src');
    const createAssembly = vi.mocked(assemblyModule.createSampleAssembly);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await act(async () => {
      renderer = create(<App />);
      await nextTurn();
    });

    await waitFor(
      renderer!,
      () => renderer!.root.findAllByProps({testID: 'sample-console:test-expo:canvas'}).length > 0,
    );
    const canvas = renderer!.root.findByProps({testID: 'sample-console:test-expo:canvas'});
    act(() => {
      (canvas.props.onLayout as LayoutHandler)({nativeEvent: {layout: {width: 1300, height: 96}}});
    });
    await waitFor(
      renderer!,
      () => renderer!.root.findAllByProps({testID: 'sample-console:test-expo:surface:PRIMARY'}).length > 0,
    );
    expect(renderer!.root.findAllByProps({testID: 'sample-console:test-expo:surface:SECONDARY'})).toHaveLength(0);
    expect(renderer!.root.findByProps({testID: 'sample-console:test-expo:surface-toggle'})).toBeDefined();
    expect(renderer!.root.findByProps({testID: 'sample-console:test-expo:header-status'})).toBeDefined();
    expect(renderer!.root.findByProps({testID: 'sample-console:test-expo:surface-summary:PRIMARY'})).toBeDefined();
    expect(renderer!.root.findByProps({testID: 'sample-console:test-expo:surface-summary:SECONDARY'})).toBeDefined();
    expect(createAssembly).toHaveBeenCalledTimes(1);
    expect(info.mock.calls.map(([event]) => (event as {readonly event?: string}).event)).toContain('startup-ready');
    expect(info.mock.calls.map(([event]) => (event as {readonly event?: string}).event)).toContain(
      'surface-decision-ready',
    );
    expect(
      error.mock.calls.some(
        ([event]) =>
          typeof event === 'object' &&
          event !== null &&
          (event as {readonly event?: string}).event === 'startup-failed',
      ),
    ).toBe(false);

    const assertFixedSurface = (testID: string, width: number, height: number): void => {
      const surface = renderer!.root.findByProps({testID});
      const style = StyleSheet.flatten(surface.props.style) as {
        readonly width?: unknown;
        readonly height?: unknown;
        readonly flexShrink?: unknown;
      };
      expect(style.width).toBe(width);
      expect(style.height).toBe(height);
      expect(style.flexShrink).toBe(0);
    };
    for (const [index, frame] of renderer!.root.findAllByProps({testID: 'ui.base.input:surface-frame'}).entries()) {
      act(() => {
        (frame.props.onLayout as (event: unknown) => void)({
          nativeEvent: {layout: index === 0 ? {width: 1157, height: 723} : {width: 962, height: 541}},
        });
      });
    }
    assertFixedSurface('sample-console:test-expo:surface:PRIMARY', 1157, 723);
    const canvasStyle = StyleSheet.flatten(canvas.props.style) as {
      readonly width?: unknown;
      readonly transform?: unknown;
    };
    expect(canvasStyle.width).toBe('100%');
    expect(canvasStyle.transform).toBeUndefined();
    const logicalStage = renderer!.root.findByProps({testID: 'sample-console:test-expo:canvas:logical-stage'});
    const logicalStageStyle = StyleSheet.flatten(logicalStage.props.style) as {
      readonly height?: unknown;
      readonly transform?: ReadonlyArray<{readonly scale?: unknown}>;
      readonly width?: unknown;
    };
    expect(logicalStageStyle.width).toBe(1157);
    expect(logicalStageStyle.height).toBe(723 + 0);
    expect(logicalStageStyle.transform?.[0]?.scale).toBe(1);

    const toggle = renderer!.root.findByProps({testID: 'sample-console:test-expo:surface-toggle'});
    expect(typeof toggle.props.onPress).toBe('function');
    await act(async () => {
      (toggle.props.onPress as () => void)();
      await nextTurn();
    });

    await waitFor(
      renderer!,
      () => renderer!.root.findAllByProps({testID: 'sample-console:test-expo:surface:SECONDARY'}).length > 0,
    );
    expect(renderer!.root.findAllByProps({testID: 'sample-console:test-expo:surface:PRIMARY'}).length).toBeGreaterThan(
      0,
    );
    for (const [index, frame] of renderer!.root.findAllByProps({testID: 'ui.base.input:surface-frame'}).entries()) {
      act(() => {
        (frame.props.onLayout as (event: unknown) => void)({
          nativeEvent: {layout: index === 0 ? {width: 1157, height: 723} : {width: 962, height: 541}},
        });
      });
    }
    assertFixedSurface('sample-console:test-expo:surface:PRIMARY', 1157, 723);
    assertFixedSurface('sample-console:test-expo:surface:SECONDARY', 962, 541);
    expect(createAssembly).toHaveBeenCalledTimes(1);
  });
});
