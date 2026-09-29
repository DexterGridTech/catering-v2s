import {act, render, waitFor} from '@testing-library/react-native';
import {Linking, Text} from 'react-native';
import {describe, expect, it, vi} from 'vitest';
import type {RenderContextValue} from '../src/contexts/RenderContext';
import {RenderContext} from '../src/contexts/RenderContext';
import {
  isDebugFailureInjectionEnabled,
  parseDebugFailureInjectionUrl,
  SystemFailureBoundary,
} from '../src/components/SystemFailureBoundary';

const linking = vi.hoisted(() => {
  const urlListeners: Array<(event: {url: string}) => void> = [];
  return {
    getInitialURL: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
    urlListeners,
    addEventListener: vi.fn((_type: string, listener: (event: {url: string}) => void) => {
      urlListeners.push(listener);
      return {
        remove: vi.fn(() => {
          const index = urlListeners.indexOf(listener);
          if (index >= 0) urlListeners.splice(index, 1);
        }),
      };
    }),
  };
});

vi.mock('react-native', async importOriginal => ({
  ...(await importOriginal()),
  Linking: linking,
}));

const logger = {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), scope: vi.fn(), withContext: vi.fn()};
const context = {
  logger,
  dispatchCommand: vi.fn(),
} as unknown as RenderContextValue;

describe('SystemFailureBoundary debug injection', () => {
  it('enables injection only for a dev runtime or the explicit managed test-bundle flag', () => {
    expect(isDebugFailureInjectionEnabled(false, undefined)).toBe(false);
    expect(isDebugFailureInjectionEnabled(false, 'false')).toBe(false);
    expect(isDebugFailureInjectionEnabled(false, 'true')).toBe(true);
    expect(isDebugFailureInjectionEnabled(true, undefined)).toBe(true);
  });

  it.skipIf(!__DEV__)('accepts a bounded failure owner from an Expo Web query URL', async () => {
    const webUrl = 'http://localhost:8093/?surfaceForm=laptop&terFailureOwner=screen%3Asample.auth.login';
    linking.getInitialURL.mockResolvedValue(webUrl);

    expect(parseDebugFailureInjectionUrl(webUrl)).toBe('screen:sample.auth.login');

    const view = await render(
      <RenderContext.Provider value={context}>
        <SystemFailureBoundary ownerId="screen:sample.auth.login">
          <Text>boundary-child</Text>
        </SystemFailureBoundary>
      </RenderContext.Provider>,
    );

    expect(view.getByText('知道了')).toBeTruthy();
    expect(view.queryByText('boundary-child')).toBeNull();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'runtime.system-failure',
        event: 'runtime.system-failure.debug-injection-resolution',
        message: 'TER_DEBUG_FAILURE_INJECTION_RESOLUTION source=initial owner=screen:sample.auth.login outcome=matched',
        data: {
          ownerId: 'screen:sample.auth.login',
          source: 'initial',
          urlPresent: true,
          outcome: 'matched',
        },
      }),
    );
    expect(JSON.stringify(logger.debug.mock.calls)).not.toContain('ter-failure://');
  });

  it('rejects duplicate and malformed Expo Web failure owner parameters', () => {
    expect(
      parseDebugFailureInjectionUrl(
        'http://localhost:8093/?terFailureOwner=screen%3Asample.auth.login&terFailureOwner=layer%3Aadmin',
      ),
    ).toBeUndefined();
    expect(parseDebugFailureInjectionUrl('http://localhost:8093/?terFailureOwner=../../outside')).toBeUndefined();
  });

  it.skipIf(!__DEV__)('renders ordinary Web content when the initial URL is not a failure injection', async () => {
    expect(__DEV__).toBe(true);
    linking.getInitialURL.mockResolvedValue('http://localhost:8093/?surfaceForm=laptop');

    const view = await render(
      <RenderContext.Provider value={context}>
        <SystemFailureBoundary ownerId="screen:sample.auth.login">
          <Text>boundary-child</Text>
        </SystemFailureBoundary>
      </RenderContext.Provider>,
    );

    expect(view.getByText('boundary-child')).toBeTruthy();
    expect(view.queryByText('知道了')).toBeNull();
  });

  it.skipIf(!__DEV__)('applies a runtime VIEW URL event to the already-mounted boundary', async () => {
    linking.getInitialURL.mockResolvedValue(null);
    linking.urlListeners.length = 0;

    const view = await render(
      <RenderContext.Provider value={context}>
        <SystemFailureBoundary ownerId="surface-content">
          <Text>surface-child</Text>
        </SystemFailureBoundary>
      </RenderContext.Provider>,
    );

    await waitFor(() => expect(view.getByText('surface-child')).toBeTruthy());
    expect(linking.urlListeners).toHaveLength(1);
    await act(async () => {
      linking.urlListeners[0]?.({url: 'ter-failure://inject/surface-content'});
    });

    expect(view.getByText('知道了')).toBeTruthy();
    expect(view.queryByText('surface-child')).toBeNull();
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'runtime.system-failure.debug-injection-resolution',
        message: 'TER_DEBUG_FAILURE_INJECTION_RESOLUTION source=event owner=surface-content outcome=matched',
      }),
    );
  });

  it('accepts one bounded owner target and keeps the injection disabled outside debug mode', async () => {
    expect(parseDebugFailureInjectionUrl('ter-failure://inject/screen%3Asample.auth.login')).toBe(
      'screen:sample.auth.login',
    );
    expect(parseDebugFailureInjectionUrl('ter-failure://clear')).toBeNull();
    expect(parseDebugFailureInjectionUrl('https://example.test/')).toBeUndefined();
    linking.getInitialURL.mockResolvedValue('ter-failure://inject/screen%3Asample.auth.login');

    const view = await render(
      <RenderContext.Provider value={context}>
        <SystemFailureBoundary ownerId="screen:sample.auth.login">
          <Text>boundary-child</Text>
        </SystemFailureBoundary>
      </RenderContext.Provider>,
    );
    if (__DEV__) {
      expect(view.getByText('知道了')).toBeTruthy();
      expect(view.queryByText('boundary-child')).toBeNull();
    } else {
      expect(view.getByText('boundary-child')).toBeTruthy();
      expect(view.queryByText('知道了')).toBeNull();
    }
  });
});
