import {createElement, type ComponentProps} from 'react';
import {Text} from 'react-native';
import {render} from '@testing-library/react-native';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {AutomationNodeProvider, AutomationSurfaceProvider} from '@catering-v2s/ui-base-primitives';

const harness = vi.hoisted(() => ({
  dispatch: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  dispatchWithRequestId: vi.fn(),
  isHostPrimaryDisplay: false,
}));

vi.mock('@catering-v2s/ui-base-render', async importOriginal => {
  const actual = await importOriginal<typeof import('@catering-v2s/ui-base-render')>();
  return {
    ...actual,
    dispatchWithRequestId: harness.dispatchWithRequestId,
    useDispatchCommand: () => harness.dispatch,
    useRenderContext: () => ({
      logger: {info: harness.info, warn: harness.warn, error: harness.error},
    }),
    useSurfaceContext: () => ({
      displayMode: 'PRIMARY',
      surfaceIdentity: {surfaceKey: 'PRIMARY', displayIndex: 0, displayMode: 'PRIMARY'},
      isHostPrimaryDisplay: harness.isHostPrimaryDisplay,
      surfaceHostAvailability: 'available',
      hostLogicalSize: {width: 1280, height: 720},
    }),
    useUiStateSelector: () => false,
  };
});

vi.mock('react-native', async importOriginal => {
  const actual = await importOriginal<typeof import('react-native')>();
  const React = await import('react');
  const MeasurableView = React.forwardRef<
    {measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) => void},
    ComponentProps<typeof actual.View>
  >((props, ref) => {
    React.useImperativeHandle(ref, () => ({measureInWindow: callback => callback(0, 0, 1280, 720)}));
    return React.createElement(actual.View, props);
  });
  return {...actual, View: MeasurableView};
});

import {AdminLauncher} from '../src/components/AdminLauncher';
import {adminTestIds} from '../src/foundations/adminTestIds';

describe('AdminLauncher surface locality', () => {
  beforeEach(() => {
    harness.isHostPrimaryDisplay = false;
    harness.dispatch.mockReset();
    harness.dispatchWithRequestId.mockReset().mockResolvedValue({status: 'completed'});
    harness.info.mockClear();
    harness.warn.mockClear();
    harness.error.mockClear();
  });

  it('renders the local admin launcher on a non-host-primary surface', async () => {
    const renderer = await render(
      createElement(AdminLauncher, {
        canvas: {width: 1280, height: 720},
        children: createElement(Text, null, 'business content'),
      }),
    );

    expect(renderer.getByTestId(adminTestIds.launcher)).toBeTruthy();
    expect(renderer.getByText('business content')).toBeTruthy();
    expect(harness.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'admin.launcher-binding',
        data: expect.objectContaining({handlerAttached: true, isHostPrimaryDisplay: false}),
      }),
    );
  });

  it('registers the measured launcher view in its current automation surface', async () => {
    const sink = {
      register: vi.fn(),
      update: vi.fn(),
      unregister: vi.fn(),
      invalidateSurface: vi.fn(),
      interaction: vi.fn(),
    };
    const renderer = await render(
      createElement(
        AutomationNodeProvider,
        {sink},
        createElement(
          AutomationSurfaceProvider,
          {scope: {surface: 'PRIMARY', displayIndex: 2, layoutRevision: 7}},
          createElement(AdminLauncher, {
            canvas: {width: 1280, height: 720},
            children: createElement(Text, null, 'business content'),
          }),
        ),
      ),
    );

    const launcher = renderer.getByTestId(adminTestIds.launcher);
    expect(sink.register).toHaveBeenCalledWith(
      expect.objectContaining({
        testID: adminTestIds.launcher,
        role: 'container',
        surface: {surface: 'PRIMARY', displayIndex: 2, layoutRevision: 7},
      }),
    );
    const touchEvent = {nativeEvent: {pageX: 20, pageY: 30, locationX: 4, locationY: 5}};
    launcher.props.onTouchStart(touchEvent);
    launcher.props.onTouchEnd(touchEvent);
    expect(sink.interaction).toHaveBeenNthCalledWith(1, expect.any(String), {
      phase: 'press-in',
      pageX: 20,
      pageY: 30,
      locationX: 4,
      locationY: 5,
    });
    expect(sink.interaction).toHaveBeenNthCalledWith(2, expect.any(String), {
      phase: 'press-out',
      pageX: 20,
      pageY: 30,
      locationX: 4,
      locationY: 5,
    });
  });
});
