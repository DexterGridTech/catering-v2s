import {fireEvent, render} from '@testing-library/react-native';
import {Text} from 'react-native';
import type {CommandDispatchResult} from '@catering-v2s/kernel-base-runtime';
import type {RenderProviderProps} from '../src/types/props';
import {describe, expect, it, vi} from 'vitest';
import {RenderContext, type RenderContextValue} from '../src/contexts/RenderContext';
import {SystemFailureBoundary} from '../src/components/SystemFailureBoundary';

const renderContext = (dispatchCommand: ReturnType<typeof vi.fn>, logger: RenderContextValue['logger']) =>
  ({
    logger,
    dispatchCommand: dispatchCommand as RenderContextValue['dispatchCommand'],
  }) as RenderContextValue;

const createLogger = () => {
  const error = vi.fn();
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error,
    scope: vi.fn(),
    withContext: vi.fn(),
  } as unknown as RenderContextValue['logger'];
  return {logger, error};
};

const BrokenScreen = () => {
  throw new Error('private-render-detail');
};

describe('SystemFailureBoundary', () => {
  it('shows the single existing notice and dispatches the runtime reset command only after acknowledgement', async () => {
    const dispatch = vi.fn<RenderProviderProps['dispatchCommand']>(
      async () => ({status: 'completed'}) as CommandDispatchResult,
    );
    const {logger, error} = createLogger();
    const view = await render(
      <RenderContext.Provider value={renderContext(dispatch, logger)}>
        <SystemFailureBoundary ownerId="screen:sample.auth.login">
          <BrokenScreen />
        </SystemFailureBoundary>
      </RenderContext.Provider>,
    );

    expect(view.getByText('系统提示')).toBeTruthy();
    expect(view.getByText('操作没有完成，请重试')).toBeTruthy();
    expect(view.getByText('知道了')).toBeTruthy();
    expect(view.queryByText('private-render-detail')).toBeNull();
    expect(dispatch).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'runtime.system-failure',
        event: 'runtime.system-failure.render-failed',
        data: expect.objectContaining({ownerId: 'screen:sample.auth.login', errorName: 'Error'}),
      }),
    );

    await fireEvent.press(view.getByTestId('ui-base-render:system-failure:screen:sample.auth.login:dismiss'));
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]?.[0]).toMatchObject({
      definition: {commandName: 'kernel.base.runtime.reset-runtime-after-system-failure'},
      payload: {},
    });
    await expect(dispatch.mock.results[0]?.value).resolves.toMatchObject({status: 'completed'});
  });

  it('keeps an outside management entry mounted when a child stays failed', async () => {
    const dispatch = vi.fn<RenderProviderProps['dispatchCommand']>(
      async () => ({status: 'completed'}) as CommandDispatchResult,
    );
    const {logger} = createLogger();
    const view = await render(
      <RenderContext.Provider value={renderContext(dispatch, logger)}>
        <>
          <SystemFailureBoundary ownerId="surface-content">
            <BrokenScreen />
          </SystemFailureBoundary>
          <Text testID="admin-launcher">管理入口</Text>
        </>
      </RenderContext.Provider>,
    );
    expect(view.getByText('知道了')).toBeTruthy();
    expect(view.getByTestId('admin-launcher')).toBeTruthy();
    expect(view.getByTestId('ui-base-render:system-failure:surface-content')).toBeTruthy();
  });
});
