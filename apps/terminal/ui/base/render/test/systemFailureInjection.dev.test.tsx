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

const context = {
  logger: {debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), scope: vi.fn(), withContext: vi.fn()},
  dispatchCommand: vi.fn(),
} as unknown as RenderContextValue;

describe('SystemFailureBoundary debug injection', () => {
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
