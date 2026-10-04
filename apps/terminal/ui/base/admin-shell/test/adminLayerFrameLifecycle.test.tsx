import {StrictMode, createElement} from 'react';
import {act, render, type RenderResult} from '@testing-library/react-native';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const harness = vi.hoisted(() => ({
  dispatch: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  dispatchWithRequestId: vi.fn(),
  activateFocusScope: vi.fn(),
}));

vi.mock('@catering-v2s/ui-base-render', async importOriginal => {
  const actual = await importOriginal<typeof import('@catering-v2s/ui-base-render')>();
  return {
    ...actual,
    dispatchWithRequestId: harness.dispatchWithRequestId,
    useDispatchCommand: () => harness.dispatch,
    useRenderContext: () => ({
      logger: {info: harness.info, warn: harness.warn, error: harness.error},
      runtimeFacts: {
        deviceIdentity: {available: false, deviceId: null},
        debugMode: {enabled: false},
        showAdminPassword: false,
      },
    }),
    useSurfaceContext: () => ({
      displayMode: 'PRIMARY',
      surfaceIdentity: {surfaceKey: 'PRIMARY', displayIndex: 0, displayMode: 'PRIMARY'},
    }),
    useUiStateSelector: () => undefined,
  };
});

vi.mock('@catering-v2s/ui-base-input', async importOriginal => {
  const actual = await importOriginal<typeof import('@catering-v2s/ui-base-input')>();
  return {...actual, useInputController: () => ({activateFocusScope: harness.activateFocusScope})};
});

import {AdminLayerFrame} from '../src/components/AdminLayerFrame';

describe('AdminLayerFrame cleanup under StrictMode', () => {
  beforeEach(() => {
    harness.dispatch.mockClear();
    harness.info.mockClear();
    harness.warn.mockClear();
    harness.error.mockClear();
    harness.dispatchWithRequestId.mockReset().mockResolvedValue({status: 'completed'});
    harness.activateFocusScope.mockClear();
  });

  it('does not close the layer during StrictMode effect replay but closes after real unmount', async () => {
    let renderer: RenderResult | undefined;
    await act(async () => {
      renderer = await render(
        createElement(
          StrictMode,
          null,
          createElement(AdminLayerFrame, {
            renderAuthenticated: () => null,
            renderLogin: () => null,
          }),
        ),
      );
      await Promise.resolve();
    });
    expect(harness.dispatchWithRequestId).not.toHaveBeenCalled();

    await act(async () => {
      await renderer!.unmount();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(harness.dispatchWithRequestId).toHaveBeenCalledTimes(1);
    expect(harness.dispatchWithRequestId.mock.calls[0]?.[0]).toMatchObject({
      payload: {displayMode: 'PRIMARY', layerId: 'admin.console.layer'},
    });
    expect(harness.dispatchWithRequestId.mock.calls[0]?.[0]).not.toHaveProperty('routeIntent');
  });
});
