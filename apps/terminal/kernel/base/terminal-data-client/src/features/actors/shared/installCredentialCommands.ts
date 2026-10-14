import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {onCommand, selectRuntimeInstanceMode, type ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../../../moduleName';
import {
  activateTerminalCommand,
  cancelTerminalOfflineCommand,
  cancelTerminaActivationCommand,
  connectTerminalCommand,
  terminalActivationSucceededCommand,
} from '../../../declarations/commands';
import {terminalDataClientActions} from '../../slices/terminalDataClient';
import {terminalDataClientParameters} from '../../../declarations/parameters';
import type {
  TerminalClientState,
  TerminalCredential,
  TerminalDataClientDependencies,
} from '../../../types/client';
import type {
  TerminalOperationId,
  TerminalOperationResult,
  createTerminalApiClient,
} from '../../../generated/terminalApi';

type PendingActivation = NonNullable<TerminalClientState['pendingActivations'][string]>;
type ActivationReservation = Readonly<{signature: string; promise: Promise<PendingActivation>}>
type ResetRequestId = {current?: ReturnType<typeof createRequestId>};
type TerminalClientForTransport = Readonly<{
  readonly client: ReturnType<typeof createTerminalApiClient>;
  readonly acceptBusinessResponse: (
    profileId: string,
    serverName: string,
    result: TerminalOperationResult<TerminalOperationId>,
  ) => Promise<void>;
}>;

type InstallCredentialCommandsInput = Readonly<{
  readonly dependencies: TerminalDataClientDependencies;
  readonly terminalClient: (credential: TerminalCredential | null) => TerminalClientForTransport;
  readonly readState: (state: StateRoot) => TerminalClientState;
  readonly isHostRuntime: (state: StateRoot) => boolean;
  readonly credentialReadyForCurrentMode: (state: StateRoot, client: TerminalClientState) => boolean;
  readonly flush: (context: ActorExecutionContext) => Promise<unknown>;
  readonly closeLocalConnection: () => Promise<void>;
  readonly connectionExists: () => boolean;
  readonly pendingByOperationId: Map<string, ActivationReservation>;
  readonly pendingByBusinessIdentity: Map<string, ActivationReservation>;
  readonly resetRequestId: ResetRequestId;
  readonly dispatchOfflineReset: (context: ActorExecutionContext) => void;
  readonly isCredentialSecret: (secret: string) => boolean;
  readonly activationLogCode: (code: string) => string;
}>;

const profileId = 'terminal-data-client';
const callTimeoutMs = terminalDataClientParameters.callTimeoutMs.defaultValue;

export const installCredentialCommands = ({
  dependencies,
  terminalClient,
  readState,
  isHostRuntime,
  credentialReadyForCurrentMode,
  flush,
  closeLocalConnection,
  connectionExists,
  pendingByOperationId,
  pendingByBusinessIdentity,
  resetRequestId,
  dispatchOfflineReset,
  isCredentialSecret,
  activationLogCode,
}: InstallCredentialCommandsInput) => [
    onCommand(activateTerminalCommand, async context => {
      if (!isHostRuntime(context.getState()))
        return Object.freeze({status: 'rejected', reason: 'TERMINAL_CLIENT_HOST_ROLE_REQUIRED'});
      const activationState = readState(context.getState());
      if (activationState.credential !== null) return Object.freeze({status: 'rejected', reason: 'ALREADY_ACTIVE'});
      if (activationState.activationStatus === 'cancelling')
        return Object.freeze({status: 'rejected', reason: 'ACTIVATION_IN_PROGRESS'});
      if (dependencies.canActivate?.(context.getState()) === false)
        return Object.freeze({status: 'rejected', reason: 'TOPOLOGY_CHANGE_IN_PROGRESS'});
      context.dispatchAction(terminalDataClientActions.setActivationStatus('activating'));
      let device: Awaited<ReturnType<typeof context.platformPorts.device.getDeviceInfo>>;
      try {
        device = await context.platformPorts.device.getDeviceInfo({timeoutMs: callTimeoutMs});
      } catch (error) {
        context.dispatchAction(terminalDataClientActions.setActivationStatus('inactive'));
        throw error;
      }
      if (
        device.status !== 'succeeded' ||
        device.value.deviceId.trim().length === 0 ||
        device.value.deviceId.length > 128
      ) {
        context.dispatchAction(terminalDataClientActions.setActivationStatus('inactive'));
        return Object.freeze({status: 'rejected', reason: 'DEVICE_ID_UNAVAILABLE'});
      }
      if (!isHostRuntime(context.getState()) || dependencies.canActivate?.(context.getState()) === false) {
        context.dispatchAction(terminalDataClientActions.setActivationStatus('inactive'));
        return Object.freeze({status: 'rejected', reason: 'TOPOLOGY_CHANGE_IN_PROGRESS'});
      }
      const current = readState(context.getState());
      if (current.credential !== null) return Object.freeze({status: 'rejected', reason: 'ALREADY_ACTIVE'});
      const operationId = context.command.requestId ?? createRequestId();
      const signature = JSON.stringify([
        context.command.payload.activationCode,
        device.value.deviceId,
        dependencies.surfaceForm,
        dependencies.appVersion,
      ]);
      const operationReservation = pendingByOperationId.get(operationId);
      if (operationReservation !== undefined && operationReservation.signature !== signature)
        return Object.freeze({status: 'rejected', reason: 'ACTIVATION_OPERATION_MISMATCH'});
      const previous =
        current.pendingActivations[operationId] ??
        Object.values(current.pendingActivations).find(
          pendingActivation =>
            pendingActivation.activationCode === context.command.payload.activationCode &&
            pendingActivation.deviceId === device.value.deviceId &&
            pendingActivation.surfaceForm === dependencies.surfaceForm &&
            pendingActivation.appVersion === dependencies.appVersion,
        );
      if (
        previous !== undefined &&
        (previous.activationCode !== context.command.payload.activationCode ||
          previous.deviceId !== device.value.deviceId ||
          previous.surfaceForm !== dependencies.surfaceForm ||
          previous.appVersion !== dependencies.appVersion)
      )
        return Object.freeze({status: 'rejected', reason: 'ACTIVATION_OPERATION_MISMATCH'});
      let pending = previous;
      if (pending === undefined) {
        const businessReservation = pendingByBusinessIdentity.get(signature);
        let reservation = operationReservation ?? businessReservation;
        if (reservation !== undefined && reservation.signature !== signature)
          return Object.freeze({status: 'rejected', reason: 'ACTIVATION_OPERATION_MISMATCH'});
        if (reservation === undefined) {
          const promise = Promise.resolve().then(async (): Promise<PendingActivation> => {
            let credentialSecret: string;
            try {
              credentialSecret = await dependencies.createCredentialSecret();
            } catch {
              throw new Error('SECURE_RANDOM_UNAVAILABLE');
            }
            if (!isCredentialSecret(credentialSecret)) throw new Error('SECURE_RANDOM_INVALID');
            const created = Object.freeze({
              operationId,
              activationCode: context.command.payload.activationCode,
              deviceId: device.value.deviceId,
              surfaceForm: dependencies.surfaceForm,
              appVersion: dependencies.appVersion,
              credentialSecret,
            });
            context.dispatchAction(terminalDataClientActions.setPendingActivation(created));
            await flush(context);
            return created;
          });
          reservation = Object.freeze({signature, promise});
          pendingByBusinessIdentity.set(signature, reservation);
        }
        pendingByOperationId.set(operationId, reservation);
        try {
          pending = await reservation.promise;
        } catch (error) {
          if (!(error instanceof Error) || !error.message.startsWith('SECURE_RANDOM_')) throw error;
          if (Object.keys(readState(context.getState()).pendingActivations).length === 0)
            context.dispatchAction(terminalDataClientActions.setActivationStatus('inactive'));
          return Object.freeze({status: 'rejected', reason: error.message});
        } finally {
          if (pendingByOperationId.get(operationId) === reservation) pendingByOperationId.delete(operationId);
          if (pendingByBusinessIdentity.get(signature) === reservation) pendingByBusinessIdentity.delete(signature);
        }
      }
      const activationLogger = context.platformPorts.logger.scope({
        moduleName,
        layer: 'kernel',
        subsystem: 'terminal-data-client',
        component: 'activation',
      });
      const activationStartedAt = dependencies.now();
      activationLogger.info({
        category: 'terminal.activation.http',
        event: 'activation-request-started',
        message: 'Terminal activation HTTP request started',
        context: {commandId: context.command.commandId},
        data: {profileId, operationId: 'activateTerminal', method: 'POST', surfaceForm: dependencies.surfaceForm},
      });
      const api = terminalClient(null);
      let result: Awaited<ReturnType<typeof api.client.activateTerminal>>;
      try {
        result = await api.client.activateTerminal({
          pathParameters: {},
          queryParameters: {},
          headers: {},
          body: {
            activationCode: pending.activationCode,
            deviceId: pending.deviceId,
            surfaceForm: pending.surfaceForm,
            appVersion: pending.appVersion,
            credentialSecret: pending.credentialSecret,
          },
        });
      } catch (error) {
        activationLogger.error({
          category: 'terminal.activation.http',
          event: 'activation-request-threw',
          message: 'Terminal activation HTTP request threw before returning a result',
          context: {commandId: context.command.commandId},
          data: {
            profileId,
            operationId: 'activateTerminal',
            elapsedMs: Math.max(0, dependencies.now() - activationStartedAt),
          },
          error: {
            name: error instanceof Error ? error.name : 'UnknownError',
            code: 'ACTIVATION_HTTP_CALL_THROWN',
            message: 'Terminal activation HTTP call did not return a result',
          },
        });
        throw error;
      }
      const activationResultLog: Record<string, string | number> =
        result.kind === 'success'
          ? {kind: result.kind, status: result.status}
          : result.kind === 'business-rejection'
            ? {kind: result.kind, status: result.status, errorCode: result.errorCode}
            : {kind: result.kind, category: result.category, code: activationLogCode(result.code)};
      activationLogger[result.kind === 'success' ? 'info' : 'warn']({
        category: 'terminal.activation.http',
        event: 'activation-request-result',
        message: 'Terminal activation HTTP request returned a classified result',
        context: {commandId: context.command.commandId},
        data: {
          profileId,
          operationId: 'activateTerminal',
          elapsedMs: Math.max(0, dependencies.now() - activationStartedAt),
          ...activationResultLog,
          ...(result.execution?.requestId === undefined ? {} : {requestId: result.execution.requestId}),
          ...(result.execution?.correlationId === undefined ? {} : {correlationId: result.execution.correlationId}),
        },
      });
      await api.acceptBusinessResponse(profileId, dependencies.businessServerName, result);
      if (result.kind === 'success') {
        if (!isHostRuntime(context.getState()) || dependencies.canActivate?.(context.getState()) === false) {
          return Object.freeze({status: 'rejected', reason: 'ACTIVATION_RESULT_STALE'});
        }
        context.dispatchAction(
          terminalDataClientActions.replaceCredential(
            Object.freeze({
              groupWorkspaceKey: result.body.groupWorkspaceKey,
              terminalRef: result.body.terminalRef,
              storeRef: result.body.storeRef,
              deviceId: pending.deviceId,
              bindingGeneration: result.body.bindingGeneration,
              credentialSecret: pending.credentialSecret,
            }),
          ),
        );
        context.dispatchAction(terminalDataClientActions.removePendingActivation(pending.operationId));
        const pendingCredentialState = readState(context.getState());
        const savedCredential = pendingCredentialState.credential;
        const savedRevision = pendingCredentialState.credentialRevision;
        await flush(context);
        const postFlushState = context.getState();
        const postFlushClient = readState(postFlushState);
        if (
          savedCredential === null ||
          postFlushClient.credential !== savedCredential ||
          postFlushClient.credentialRevision !== savedRevision ||
          selectRuntimeInstanceMode(postFlushState) !== 'MASTER'
        )
          return Object.freeze({status: 'rejected', reason: 'ACTIVATION_RESULT_STALE'});
        context.dispatchAction(
          terminalDataClientActions.markCredentialReady({credentialRevision: savedRevision, instanceMode: 'MASTER'}),
        );
        if (!credentialReadyForCurrentMode(context.getState(), readState(context.getState())))
          return Object.freeze({status: 'rejected', reason: 'ACTIVATION_RESULT_STALE'});
        const activationSucceeded = await context.dispatchCommand(
          terminalActivationSucceededCommand,
          {
            terminalRef: result.body.terminalRef,
            storeRef: result.body.storeRef,
            groupWorkspaceKey: result.body.groupWorkspaceKey,
            bindingGeneration: result.body.bindingGeneration,
          },
          {requestId: context.command.requestId ?? createRequestId()},
        );
        if (activationSucceeded.status !== 'completed') {
          context.platformPorts.logger
            .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'activation'})
            .error({
              category: 'terminal.activation.bootstrap',
              event: 'activation-success-broadcast-failed',
              message: 'Terminal activation succeeded but one or more feature consumers failed to start',
              context: {commandId: context.command.commandId},
              data: {
                dispatchStatus: activationSucceeded.status,
                bindingGeneration: result.body.bindingGeneration,
                requestId: activationSucceeded.requestId,
                actorResults: activationSucceeded.actorResults.map(actorResult => ({
                  actorKey: actorResult.actorKey,
                  status: actorResult.status,
                  errorCode: actorResult.error?.code ?? null,
                })),
              },
            });
        }
        const connectionResult = await context.dispatchCommand(connectTerminalCommand, Object.freeze({}), {
          requestId: context.command.requestId ?? createRequestId(),
        });
        if (connectionResult.status !== 'completed') {
          context.platformPorts.logger
            .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'connection'})
            .error({
              category: 'terminal.connection.activation-connect',
              event: 'activation-connect-command-failed',
              message: 'TDS connection command did not complete after activation',
              context: {commandId: context.command.commandId},
              data: {profileId, dispatchStatus: connectionResult.status},
            });
        }
        return Object.freeze({
          status: 'activated',
          terminalRef: result.body.terminalRef,
          bindingGeneration: result.body.bindingGeneration,
        });
      }
      if (result.kind === 'business-rejection' && result.errorCode === 'TERMINAL_BINDING_ACTIVATION_EXPIRED') {
        context.dispatchAction(terminalDataClientActions.removePendingActivation(pending.operationId));
        await flush(context);
        if (Object.keys(readState(context.getState()).pendingActivations).length === 0)
          context.dispatchAction(terminalDataClientActions.setActivationStatus('inactive'));
      }
      return result;
    }),
    onCommand(cancelTerminaActivationCommand, async context => {
      if (!isHostRuntime(context.getState()))
        return Object.freeze({status: 'rejected', reason: 'TERMINAL_CLIENT_HOST_ROLE_REQUIRED'});
      const credential = readState(context.getState()).credential;
      if (credential === null) return Object.freeze({status: 'rejected', reason: 'TERMINAL_NOT_ACTIVE'});
      const wasConnected =
        connectionExists() ||
        ['connecting', 'awaiting-ready', 'connected', 'backoff'].includes(
          readState(context.getState()).connection.status,
        );
      if (readState(context.getState()).activationStatus === 'cancelling')
        return Object.freeze({status: 'rejected', reason: 'CANCELLATION_IN_PROGRESS'});
      context.dispatchAction(terminalDataClientActions.setActivationStatus('cancelling'));
      await closeLocalConnection();
      context.dispatchAction(terminalDataClientActions.clearConnection());
      const cancellationLogger = context.platformPorts.logger.scope({
        moduleName,
        layer: 'kernel',
        subsystem: 'terminal-data-client',
        component: 'activation',
      });
      const cancellationStartedAt = dependencies.now();
      cancellationLogger.info({
        category: 'terminal.activation.http',
        event: 'cancel-activation-request-started',
        message: 'Terminal cancellation HTTP request started',
        context: {commandId: context.command.commandId},
        data: {
          profileId,
          operationId: 'cancelTerminalActivation',
          method: 'POST',
          surfaceForm: dependencies.surfaceForm,
        },
      });
      const api = terminalClient(credential);
      let result: Awaited<ReturnType<typeof api.client.cancelTerminalActivation>>;
      try {
        result = await api.client.cancelTerminalActivation({
          pathParameters: {terminalRef: credential.terminalRef},
          queryParameters: {},
          headers: {},
        });
      } catch (error) {
        context.dispatchAction(terminalDataClientActions.setActivationStatus('active'));
        if (wasConnected) {
          await context.dispatchCommand(connectTerminalCommand, Object.freeze({}), {
            requestId: context.command.requestId ?? createRequestId(),
          });
        }
        throw error;
      }
      cancellationLogger[result.kind === 'success' ? 'info' : 'warn']({
        category: 'terminal.activation.http',
        event: 'cancel-activation-request-result',
        message: 'Terminal cancellation HTTP request returned a classified result',
        context: {commandId: context.command.commandId},
        data: {
          profileId,
          operationId: 'cancelTerminalActivation',
          method: 'POST',
          elapsedMs: Math.max(0, dependencies.now() - cancellationStartedAt),
          ...(result.kind === 'success'
            ? {kind: result.kind, status: result.status, outcome: result.body.outcome}
            : result.kind === 'business-rejection'
              ? {kind: result.kind, status: result.status, errorCode: result.errorCode}
              : {kind: result.kind, category: result.category, code: activationLogCode(result.code)}),
          ...(result.execution?.requestId === undefined ? {} : {requestId: result.execution.requestId}),
          ...(result.execution?.correlationId === undefined ? {} : {correlationId: result.execution.correlationId}),
        },
      });
      await api.acceptBusinessResponse(profileId, dependencies.businessServerName, result);
      if (result.kind !== 'success') {
        context.dispatchAction(terminalDataClientActions.setActivationStatus('active'));
        if (wasConnected) {
          await context.dispatchCommand(connectTerminalCommand, Object.freeze({}), {
            requestId: context.command.requestId ?? createRequestId(),
          });
        }
        return result;
      }
      context.dispatchAction(terminalDataClientActions.setActivationStatus('cancelling'));
      resetRequestId.current = context.command.requestId ?? createRequestId();
      dispatchOfflineReset(context);
      return Object.freeze({status: result.body.outcome});
    }),
    onCommand(cancelTerminalOfflineCommand, async context => {
      if (!isHostRuntime(context.getState()))
        return Object.freeze({status: 'rejected', reason: 'TERMINAL_CLIENT_HOST_ROLE_REQUIRED'});
      context.dispatchAction(terminalDataClientActions.setActivationStatus('cancelling'));
      await closeLocalConnection();
      resetRequestId.current = context.command.requestId ?? createRequestId();
      dispatchOfflineReset(context);
      return Object.freeze({status: 'cancelled-offline'});
    }),
] as const;
