import {act, render} from '@testing-library/react-native';
import {createElement} from 'react';
import {describe, expect, it} from 'vitest';
import {createRequestId, type RequestId} from '@catering-v2s/kernel-base-contracts';
import type {LogEvent, LogWriteInput, LogWriteResult, LoggerPort} from '@catering-v2s/kernel-base-platform-ports';
import {createCommand, defineCommand, type CommandDispatchResult} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {createUiCatalog} from '@catering-v2s/kernel-base-ui-state';
import {
  createRendererCatalog,
  createRenderRuntimeFacts,
  RenderProvider,
  resolveDebugMode,
  useDispatchCommand,
  type RenderProviderProps,
} from '../src/index';
import {nativeLoadingCapability} from './renderProviderBindings';

(globalThis as {IS_REACT_ACT_ENVIRONMENT?: boolean}).IS_REACT_ACT_ENVIRONMENT = true;

type RuntimeStateRoot = ReturnType<RenderProviderProps['stateSource']['getState']>;

const definition = defineCommand<Readonly<{}>>('render.dispatch-observation-test', {
  name: 'submit',
  visibility: 'public',
});

const createLogger = (): Readonly<{logger: LoggerPort; events: LogWriteInput[]; levels: string[]}> => {
  const events: LogWriteInput[] = [];
  const levels: string[] = [];
  const write =
    (level: string) =>
    (input: LogWriteInput): LogWriteResult => {
      levels.push(level);
      events.push(input);
      return {status: 'succeeded', value: {} as LogEvent, completedAt: 0};
    };
  let logger: LoggerPort;
  logger = {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
    scope: () => logger,
    withContext: () => logger,
  };
  return {logger, events, levels};
};

const createStartedStateSource = (): RenderProviderProps['stateSource'] => {
  const root = Object.freeze({}) as RuntimeStateRoot;
  return {
    getStatus: () => 'started',
    getState: () => root,
    subscribe: () => () => {},
  };
};

describe('render command dispatch observation', () => {
  it('reports rejected dispatch with a typed diagnostic while preserving rejection', async () => {
    const {logger, events, levels} = createLogger();
    const source = createStartedStateSource();
    const requestId = createRequestId() as RequestId;
    const failure = new Error('ledger write failed');
    const dispatchCommand: RenderProviderProps['dispatchCommand'] = async <TPayload extends StateJsonValue>() => {
      void (null as unknown as TPayload);
      throw failure;
    };
    let invoke: (() => Promise<unknown>) | undefined;
    const Probe = () => {
      const dispatch = useDispatchCommand();
      invoke = () => dispatch(createCommand(definition, {}), {requestId});
      return createElement('dispatch-observation-probe');
    };

    const renderer = await render(
      createElement(
        RenderProvider,
        {
          stateSource: source,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          nativeLoadingCapability,
          runtimeFacts: createRenderRuntimeFacts({
            environmentMode: 'TEST',
            debugMode: resolveDebugMode({}),
            deviceIdentity: {available: false, deviceId: null},
            platformPortCapabilities: [],
          }),
          dispatchCommand,
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
          selectSurfaceForm: () => 'laptop' as const,
        },
        createElement(Probe),
      ),
    );

    await expect(invoke!()).rejects.toBe(failure);
    expect(events).toContainEqual({
      category: 'ui.base.render',
      event: 'command-dispatch-rejected',
      context: {
        commandName: definition.commandName,
        requestId,
      },
      data: {
        failure: 'promise-rejected',
      },
    });
    expect(levels).toContain('error');
    await renderer.unmount();
  });

  it('reports a resolved actor failure without converting it into a rejected promise', async () => {
    const {logger, events, levels} = createLogger();
    const source = createStartedStateSource();
    const requestId = createRequestId() as RequestId;
    const failure = {
      requestId,
      commandId: 'command-failed' as CommandDispatchResult['commandId'],
      status: 'error',
      actorResults: [],
    } satisfies CommandDispatchResult;
    const dispatchCommand: RenderProviderProps['dispatchCommand'] = async <TPayload extends StateJsonValue>() => {
      void (null as unknown as TPayload);
      return failure;
    };
    let invoke: (() => Promise<unknown>) | undefined;
    const Probe = () => {
      const dispatch = useDispatchCommand();
      invoke = () => dispatch(createCommand(definition, {}), {requestId});
      return createElement('dispatch-observation-probe');
    };

    const renderer = await render(
      createElement(
        RenderProvider,
        {
          stateSource: source,
          uiCatalog: createUiCatalog([]),
          rendererCatalog: createRendererCatalog([]),
          logger,
          nativeLoadingCapability,
          runtimeFacts: createRenderRuntimeFacts({
            environmentMode: 'TEST',
            debugMode: resolveDebugMode({}),
            deviceIdentity: {available: false, deviceId: null},
            platformPortCapabilities: [],
          }),
          dispatchCommand,
          selectUiVariable: (_root, declaration) => declaration.defaultValue,
          selectSurfaceForm: () => 'laptop' as const,
        },
        createElement(Probe),
      ),
    );

    await expect(invoke!()).resolves.toBe(failure);
    expect(events).toContainEqual({
      category: 'ui.base.render',
      event: 'command-dispatch-rejected',
      context: {
        commandName: definition.commandName,
        requestId,
      },
      data: {
        failure: 'error',
      },
    });
    expect(levels).toContain('warn');
    await renderer.unmount();
  });
});
