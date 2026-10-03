import type {RuntimeModule, RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import {createTransportConnectionOwner} from '../foundations/createTransportConnectionOwner';
import {createTransportNetworkStatusBridge} from '../foundations/createTransportNetworkStatusBridge';
import {createTransportActor} from '../features/actors/transportActor';
import {
  transportInvalidCommand,
  transportHttpAddressAvailableCommand,
  transportHttpRequestCommand,
  transportNetworkStatusChangedCommand,
  transportReadyCommand,
  transportReadyTimeoutCommand,
  transportRetryDueCommand,
  transportStablePeriodElapsedCommand,
  transportStartCommand,
  transportStopCommand,
} from '../features/commands/transportCommands';
import type {
  TransportCommandGateway,
  TransportHttpExecutionResult,
  TransportHttpRequest,
  TransportModuleOptions,
  TransportNetworkAdapter,
} from '../types/runtimeControl';

type TransportRuntimeModule = RuntimeModule & Readonly<{readonly commandGateway: TransportCommandGateway}>;
type TransportDiagnosticInput = Readonly<{
  readonly level: 'info' | 'warn';
  readonly event: string;
  readonly profileId?: string;
  readonly data?: Readonly<Record<string, string | number | boolean | null>>;
}>;

type TransportResourceDisposal = Readonly<{
  readonly name: 'network-status-bridge' | 'connection-owner';
  readonly dispose: () => Promise<void>;
}>;

const requireCompleted = (
  result: Awaited<ReturnType<RuntimeModuleContext['dispatchCommand']>>,
  commandName: string,
): void => {
  if (result.status !== 'completed') throw new Error(`TRANSPORT_COMMAND_FAILED:${commandName}:${result.status}`);
};

/** Creates one transport owner and a generic facade whose control methods dispatch owner commands. */
export const createTransportModule = (options: TransportModuleOptions = {}): TransportRuntimeModule => {
  let runtimeContext: RuntimeModuleContext | undefined;
  let activeNetworkAdapter = options.networkAdapter;
  const networkAdapter =
    options.networkAdapterFactory === undefined && options.networkAdapter === undefined
      ? undefined
      : Object.freeze({
          readSnapshot: (serverName: string) => {
            if (activeNetworkAdapter === undefined) throw new Error('TRANSPORT_NETWORK_ADAPTER_NOT_INSTALLED');
            return activeNetworkAdapter.readSnapshot(serverName);
          },
          connect: (input: Parameters<TransportNetworkAdapter['connect']>[0]) => {
            if (activeNetworkAdapter === undefined) throw new Error('TRANSPORT_NETWORK_ADAPTER_NOT_INSTALLED');
            return activeNetworkAdapter.connect(input);
          },
          sendHttp: (input: Parameters<NonNullable<TransportNetworkAdapter['sendHttp']>>[0]) => {
            if (activeNetworkAdapter?.sendHttp === undefined) throw new Error('TRANSPORT_HTTP_ADAPTER_UNAVAILABLE');
            return activeNetworkAdapter.sendHttp(input);
          },
        });
  let bridgeDispose: (() => Promise<void>) | undefined;
  const report = (context: RuntimeModuleContext, input: TransportDiagnosticInput): void => {
    context.platformPorts.logger.withContext({nodeId: context.localNodeId})[input.level]({
      category: 'transport.connection',
      event: `transport.connection.${input.event}`,
      message: 'Transport lifecycle event observed',
      data: {...(input.profileId === undefined ? {} : {profileId: input.profileId}), ...(input.data ?? {})},
    });
  };
  const reportInternalCommandFailure = (
    input: Readonly<{
      readonly context: RuntimeModuleContext;
      readonly kind: 'retry' | 'ready-timeout' | 'stable';
      readonly profileId: string;
      readonly status: string;
    }>,
  ): void => {
    const {context, kind, profileId, status} = input;
    report(context, {
      level: 'warn',
      event: 'internal-command-failed',
      profileId,
      data: {kind, status, stateTransition: 'not-applied'},
    });
  };
  const dispatchInternal = (kind: 'retry' | 'ready-timeout' | 'stable', profileId: string, token: number): void => {
    const context = runtimeContext;
    if (context === undefined) return;
    const dispatch =
      kind === 'retry'
        ? context.dispatchCommand(transportRetryDueCommand, {profileId, token})
        : kind === 'ready-timeout'
          ? context.dispatchCommand(transportReadyTimeoutCommand, {profileId, token})
          : context.dispatchCommand(transportStablePeriodElapsedCommand, {profileId, token});
    dispatch.then(
      result => {
        if (result.status !== 'completed')
          reportInternalCommandFailure({context, kind, profileId, status: result.status});
      },
      () => reportInternalCommandFailure({context, kind, profileId, status: 'rejected'}),
    );
  };
  const owner = createTransportConnectionOwner({
    adapter: networkAdapter,
    now: options.now,
    random: options.random,
    dispatchInternal,
    diagnose: (event, profileId, data) => {
      const context = runtimeContext;
      if (context !== undefined)
        report(context, {level: event === 'connect-attempt-failed' ? 'warn' : 'info', event, profileId, data});
    },
  });
  let nextHttpRequestId = 0;
  const pendingHttpRequests = new Map<
    string,
    {readonly request: TransportHttpRequest; result?: TransportHttpExecutionResult}
  >();
  const actor = createTransportActor(owner, {
    readRequest: requestId => pendingHttpRequests.get(requestId)?.request,
    writeResult: (requestId, result) => {
      const pending = pendingHttpRequests.get(requestId);
      if (pending !== undefined) pending.result = result;
    },
  });
  const disposeResources = async (
    context: RuntimeModuleContext,
    resources: readonly TransportResourceDisposal[],
  ): Promise<void> => {
    const outcomes = await Promise.allSettled(resources.map(resource => resource.dispose()));
    let failed = false;
    outcomes.forEach((outcome, index) => {
      if (outcome.status === 'rejected') {
        failed = true;
        report(context, {
          level: 'warn',
          event: 'resource-disposal-failed',
          data: {resource: resources[index]!.name, status: 'rejected'},
        });
      }
    });
    if (failed) throw new Error('TRANSPORT_RESOURCE_DISPOSAL_FAILED');
  };
  const commandDefinitions = [
    transportStartCommand,
    transportReadyCommand,
    transportInvalidCommand,
    transportStopCommand,
    transportHttpRequestCommand,
    transportHttpAddressAvailableCommand,
    transportNetworkStatusChangedCommand,
    transportRetryDueCommand,
    transportReadyTimeoutCommand,
    transportStablePeriodElapsedCommand,
  ] as const;
  const dispatchThroughRuntime = async <TPayload extends import('@catering-v2s/kernel-base-state').StateJsonValue>(
    command: import('@catering-v2s/kernel-base-runtime').CommandDefinition<TPayload>,
    payload: TPayload,
  ): Promise<void> => {
    const context = runtimeContext;
    if (context === undefined) throw new Error('TRANSPORT_RUNTIME_NOT_INSTALLED');
    const result = await context.dispatchCommand(command, payload, {
      target: 'local',
      ...(command.visibility === 'public' ? {requestId: createRequestId()} : {}),
    });
    requireCompleted(result, command.commandName);
  };
  const commandGateway: TransportCommandGateway = Object.freeze({
    start: async startInput => {
      await dispatchThroughRuntime(transportStartCommand, startInput);
      return owner.connectionFor(startInput.profileId);
    },
    ready: async payload => dispatchThroughRuntime(transportReadyCommand, payload),
    invalid: async payload => dispatchThroughRuntime(transportInvalidCommand, payload),
    stop: async payload => dispatchThroughRuntime(transportStopCommand, payload),
    executeHttp: async request => {
      const requestId = `transport-http-${++nextHttpRequestId}`;
      const pending: {readonly request: TransportHttpRequest; result?: TransportHttpExecutionResult} = {request};
      pendingHttpRequests.set(requestId, pending);
      try {
        await dispatchThroughRuntime(transportHttpRequestCommand, {requestId});
        if (pending.result === undefined) throw new Error('TRANSPORT_HTTP_RESULT_MISSING');
        return pending.result;
      } finally {
        pendingHttpRequests.delete(requestId);
      }
    },
    reportHttpAddressAvailable: async accepted =>
      dispatchThroughRuntime(transportHttpAddressAvailableCommand, accepted),
  });

  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: commandDefinitions.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions,
    actors: [{name: actor.actorName}],
    actorDefinitions: [actor],
    slices: [],
    install: async (context: RuntimeModuleContext) => {
      runtimeContext = context;
      if (options.networkAdapterFactory !== undefined) activeNetworkAdapter = options.networkAdapterFactory(context);
      const bridge = await createTransportNetworkStatusBridge({
        device: context.platformPorts.device,
        timeoutMs: 5_000,
        dispatchTransition: transition => dispatchThroughRuntime(transportNetworkStatusChangedCommand, transition),
        onObservationError: (source, code) =>
          report(context, {level: 'warn', event: 'network-observation-failed', data: {source, code}}),
      });
      if (bridge.installed) {
        report(context, {level: 'info', event: 'network-status-bridge-installed'});
        bridgeDispose = bridge.dispose;
      } else {
        report(context, {level: 'info', event: 'network-status-bridge-unavailable'});
      }
      context.registerAsyncResource(async () => {
        runtimeContext = undefined;
        const resources: TransportResourceDisposal[] = [];
        if (bridgeDispose !== undefined) resources.push({name: 'network-status-bridge', dispose: bridgeDispose});
        bridgeDispose = undefined;
        resources.push({name: 'connection-owner', dispose: () => owner.dispose()});
        return disposeResources(context, resources);
      });
    },
    commandGateway,
  });
};
