import {act, render} from '@testing-library/react-native';
import {describe, expect, it} from 'vitest';
import type {
  LogEvent,
  LogWriteInput,
  LogWriteResult,
  LoggerPort,
  NativeLoadingCapability,
} from '@catering-v2s/kernel-base-platform-ports';
import {StandaloneStartupFailurePage} from '../src';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

const createLogger = (): Readonly<{readonly logger: LoggerPort; readonly events: LogWriteInput[]}> => {
  const events: LogWriteInput[] = [];
  const write = (input: LogWriteInput): LogWriteResult => {
    events.push(input);
    return {status: 'succeeded', value: {} as LogEvent, completedAt: 0};
  };
  const logger: LoggerPort = {
    debug: write,
    info: write,
    warn: write,
    error: write,
    scope: () => logger,
    withContext: () => logger,
  };
  return {logger, events};
};

const createCapability = (hideReasons: string[]): NativeLoadingCapability =>
  Object.freeze({
    targetPhysicalSurface: Object.freeze({surfaceKey: 'PRIMARY' as const, displayIndex: 0 as const}),
    hideOnce: async (reason: string) => {
      hideReasons.push(reason);
      return Object.freeze({hidden: true, alreadyHidden: false, reason});
    },
  });

describe('StandaloneStartupFailurePage', () => {
  it('uses the render-owned page and hides only the physical PRIMARY splash', async () => {
    const hideReasons: string[] = [];
    const {logger, events} = createLogger();
    const renderer = await render(
      <StandaloneStartupFailurePage
        reason="assembly-rejection:Error"
        displayIndex={0}
        logger={logger}
        nativeLoadingCapability={createCapability(hideReasons)}
      />,
    );

    expect(renderer.getByTestId('ui.base.render:startup-failure')).toBeTruthy();
    expect(renderer.getByTestId('ui.base.render:startup-failure:title').props.children).toBe('终端启动失败');
    expect(renderer.getByTestId('ui.base.render:startup-failure:message').props.children).toBe(
      '请重启终端，如仍失败请联系管理员',
    );
    expect(renderer.getByTestId('ui.base.render:startup-failure:code').props.children).toBe(
      'assembly-rejection:Error:UnknownError',
    );
    expect(hideReasons).toEqual(['startup-failure']);
    expect(events).toEqual(expect.arrayContaining([expect.objectContaining({event: 'startup.failure-page-visible'})]));
    await renderer.unmount();
  });

  it('does not hide the PRIMARY splash from a secondary physical surface', async () => {
    const hideReasons: string[] = [];
    const {logger} = createLogger();

    const renderer = await render(
      <StandaloneStartupFailurePage
        reason="assembly-rejection:Error"
        displayIndex={1}
        logger={logger}
        nativeLoadingCapability={createCapability(hideReasons)}
      />,
    );

    expect(hideReasons).toEqual([]);
    await renderer.unmount();
  });
});
