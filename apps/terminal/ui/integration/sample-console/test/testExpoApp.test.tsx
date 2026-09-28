import {act, render, type RenderResult} from '@testing-library/react-native';
import type {ReactNode} from 'react';
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

vi.mock('@catering-v2s/ui-base-admin-shell', async importOriginal => {
  const actual = await importOriginal<typeof import('@catering-v2s/ui-base-admin-shell')>();
  const {createElement, Fragment} = await import('react');
  return {
    ...actual,
    AdminLauncher: ({children}: Readonly<{children?: ReactNode}>) => createElement(Fragment, null, children),
  };
});

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

type LayoutHandler = (event: {nativeEvent: {layout: {width: number; height: number}}}) => void;

describe('test-expo host shell', () => {
  let renderer: RenderResult | undefined;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: new FakeWebStorage(),
    });
  });

  afterEach(async () => {
    if (renderer !== undefined) await renderer.unmount();
    renderer = undefined;
    delete (globalThis as {localStorage?: Storage}).localStorage;
  });

  it('mounts one surface, toggles to two, and reuses the same assembly', async () => {
    const {default: App} = await import('../test-expo/App');
    const assemblyModule = await import('../src');
    const createAssembly = vi.mocked(assemblyModule.createSampleAssembly);
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderer = await render(<App />);

    await waitFor(renderer!, () => renderer!.queryAllByTestId('sample-console:test-expo:canvas').length > 0);
    const canvas = renderer.getByTestId('sample-console:test-expo:canvas');
    const previewViewport = renderer.getByTestId('sample-console:test-expo:canvas:preview-viewport');
    await act(async () => {
      (canvas.props.onLayout as LayoutHandler)({nativeEvent: {layout: {width: 1304, height: 96}}});
      (previewViewport.props.onLayout as LayoutHandler)({nativeEvent: {layout: {width: 1280, height: 720}}});
    });
    await waitFor(renderer!, () => renderer!.queryAllByTestId('sample-console:test-expo:surface:PRIMARY').length > 0);
    expect(renderer.queryAllByTestId('sample-console:test-expo:surface:SECONDARY')).toHaveLength(0);
    expect(renderer.getByTestId('sample-console:test-expo:surface-toggle')).toBeDefined();
    expect(renderer.getByTestId('sample-console:test-expo:header-status')).toBeDefined();
    expect(renderer.getByTestId('sample-console:test-expo:surface-summary:PRIMARY')).toBeDefined();
    expect(renderer.getByTestId('sample-console:test-expo:surface-summary:SECONDARY')).toBeDefined();
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
      const surface = renderer!.getByTestId(testID);
      const style = StyleSheet.flatten(surface.props.style) as {
        readonly width?: unknown;
        readonly height?: unknown;
        readonly flexShrink?: unknown;
        readonly borderWidth?: unknown;
      };
      expect(style.width).toBe(width);
      expect(style.height).toBe(height);
      expect(style.flexShrink).toBe(0);
      expect(style.borderWidth).toBeUndefined();
    };
    for (const frame of renderer.queryAllByTestId('ui.base.input:surface-frame')) {
      await act(async () => {
        (frame.props.onLayout as (event: unknown) => void)({
          nativeEvent: {layout: {width: 1280, height: 720}},
        });
      });
    }
    assertFixedSurface('sample-console:test-expo:surface:PRIMARY', 1280, 720);
    const canvasStyle = StyleSheet.flatten(canvas.props.style) as {
      readonly width?: unknown;
      readonly transform?: unknown;
    };
    expect(canvasStyle.width).toBe('100%');
    expect(canvasStyle.transform).toBeUndefined();
    const logicalStage = renderer.getByTestId('sample-console:test-expo:canvas:logical-stage');
    const logicalStageStyle = StyleSheet.flatten(logicalStage.props.style) as {
      readonly height?: unknown;
      readonly transform?: ReadonlyArray<{readonly scale?: unknown}>;
      readonly width?: unknown;
    };
    expect(logicalStageStyle.width).toBe(1280);
    expect(logicalStageStyle.height).toBe(720 + 0);
    expect(logicalStageStyle.transform?.[0]?.scale).toBe(1);

    const dualModeRadio = renderer.getByTestId('sample-console:test-expo:surface-mode:dual');
    expect(dualModeRadio.props.accessibilityRole).toBe('radio');
    expect(dualModeRadio.props.accessibilityState).toEqual({selected: false});
    await act(async () => {
      (dualModeRadio.props.onPress as () => void)();
      await nextTurn();
    });

    await waitFor(renderer!, () => renderer!.queryAllByTestId('sample-console:test-expo:surface:SECONDARY').length > 0);
    expect(renderer.queryAllByTestId('sample-console:test-expo:surface:PRIMARY').length).toBeGreaterThan(0);
    for (const frame of renderer.queryAllByTestId('ui.base.input:surface-frame')) {
      await act(async () => {
        (frame.props.onLayout as (event: unknown) => void)({
          nativeEvent: {layout: {width: 1280, height: 720}},
        });
      });
    }
    assertFixedSurface('sample-console:test-expo:surface:PRIMARY', 1280, 720);
    assertFixedSurface('sample-console:test-expo:surface:SECONDARY', 1280, 720);
    expect(renderer.getByTestId('sample-console:test-expo:surface-mode:single').props.accessibilityState).toEqual({
      selected: false,
    });
    expect(renderer.getByTestId('sample-console:test-expo:surface-mode:dual').props.accessibilityState).toEqual({
      selected: true,
    });
    expect(createAssembly).toHaveBeenCalledTimes(1);
  });
});
