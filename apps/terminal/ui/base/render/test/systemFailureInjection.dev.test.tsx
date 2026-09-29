import {render} from '@testing-library/react-native';
import {Linking, Text} from 'react-native';
import {describe, expect, it, vi} from 'vitest';
import type {RenderContextValue} from '../src/contexts/RenderContext';
import {RenderContext} from '../src/contexts/RenderContext';
import {parseDebugFailureInjectionUrl, SystemFailureBoundary} from '../src/components/SystemFailureBoundary';

const linking = vi.hoisted(() => ({
  getInitialURL: vi.fn<() => Promise<string | null>>().mockResolvedValue(null),
  addEventListener: vi.fn(() => ({remove: vi.fn()})),
}));

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
