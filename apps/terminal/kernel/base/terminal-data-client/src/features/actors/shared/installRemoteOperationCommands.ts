import {createCommandId, createRequestId} from '@catering-v2s/kernel-base-contracts';
import {onCommand, type ActorExecutionContext, type ActorExecutionRecord} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue, StateRoot} from '@catering-v2s/kernel-base-state';
import {terminalRemoteOperationMutationCommand, type TerminalRemoteOperationMutation} from '../../../declarations/commands';
import {terminalDataClientParameters} from '../../../declarations/parameters';
import {terminalConnectionMessageUtf8ByteLength} from '../../../foundations/parseTerminalConnectionMessage';
import {
  terminalConnectionMaxCompleteDecompressedMessageBytes,
  type RemoteCommandMessage,
} from '../../../generated/terminalConnectionProtocol';
import {moduleName} from '../../../moduleName';
import {terminalDataClientActions} from '../../slices/terminalDataClient';
import type {TerminalClientState, TerminalDataClientDependencies, RemoteOperationFact} from '../../../types/client';
import type {LateRemoteResult, TerminalDataClientSession} from './createTerminalDataClientSession';

export type InstallRemoteOperationCommandsInput = Readonly<{
  readonly dependencies: TerminalDataClientDependencies;
  readonly profileId: string;
  readonly readState: (state: StateRoot) => TerminalClientState;
  readonly flush: (context: ActorExecutionContext) => Promise<void>;
  readonly session: TerminalDataClientSession;
  readonly isRecord: (value: unknown) => value is Record<string, unknown>;
  readonly requireProtocolUuid: (dependencies: TerminalDataClientDependencies) => string;
  readonly createProtocolUuid: (dependencies: TerminalDataClientDependencies) => string | null;
}>;

export const installRemoteOperationCommands = (input: InstallRemoteOperationCommandsInput) => {
  const {
    dependencies,
    profileId,
    readState,
    flush,
    session,
    isRecord,
    requireProtocolUuid,
    createProtocolUuid,
  } = input;
  const remoteOperationLimit = terminalDataClientParameters.remoteOperationLimit.defaultValue;
  const remoteResultResidenceMs = terminalDataClientParameters.remoteResultResidenceMs.defaultValue;
  type RemoteActorResult = ActorExecutionRecord;
  const flattenActorResults = (records: readonly RemoteActorResult[]): readonly RemoteActorResult[] => {
    const flattened: RemoteActorResult[] = [];
    for (const record of records) {
      const value = record.result;
      const nested = isRecord(value) && Array.isArray(value.actorResults) ? value.actorResults : null;
      if (nested !== null) flattened.push(...(nested as RemoteActorResult[]));
      else flattened.push(record);
    }
    return flattened;
  };

  const reportLateResultWhenComplete = (input: {
    context: ActorExecutionContext;
    message: RemoteCommandMessage;
    credential: NonNullable<TerminalClientState['credential']>;
    original: RemoteOperationFact;
    accumulator: LateRemoteResult;
  }): void => {
    const {context, message, credential, original, accumulator} = input;
    if (
      accumulator.reported ||
      !accumulator.unknownPersisted ||
      accumulator.expectedActorKeys === null ||
      accumulator.expectedActorKeys.size === 0
    )
      return;
    const records = [...accumulator.expectedActorKeys]
      .map(actorKey => accumulator.records.get(actorKey))
      .filter((record): record is RemoteActorResult => record !== undefined);
    if (
      records.length !== accumulator.expectedActorKeys.size ||
      records.some(record => record.status !== 'completed' && record.status !== 'error')
    )
      return;
    accumulator.reported = true;
    const succeeded = records.every(record => record.status === 'completed');
    void reportRemoteOutcome({
      context,
      message,
      credential,
      original,
      records,
      phase: succeeded ? 'COMPLETED' : 'FAILED',
      errorCode: succeeded ? undefined : 'REMOTE_COMMAND_FAILED',
    });
  };

  const applyRemoteOperationMutation = async (
    context: ActorExecutionContext,
    mutation: TerminalRemoteOperationMutation,
  ): Promise<boolean> => {
    const result = await context.dispatchCommand(terminalRemoteOperationMutationCommand, mutation);
    return result.status === 'completed';
  };

  const restoreRemoteOperations = async (
    context: ActorExecutionContext,
    facts: readonly RemoteOperationFact[],
  ): Promise<void> => {
    for (const fact of facts) await applyRemoteOperationMutation(context, {kind: 'put', fact});
  };

  const remoteFactMatchesCurrentClient = (
    context: ActorExecutionContext,
    fact: RemoteOperationFact,
    expectedEpoch = session.remoteOperationEpoch,
  ): boolean => {
    const client = readState(context.getState());
    const credential = client.credential;
    return (
      credential !== null &&
      credential.groupWorkspaceKey === fact.groupWorkspaceKey &&
      credential.terminalRef === fact.terminalRef &&
      credential.bindingGeneration === fact.bindingGeneration &&
      session.remoteOperationEpoch === expectedEpoch &&
      session.currentConfigRevision === fact.configRevision &&
      client.connection.addressName === fact.addressName
    );
  };

  const ownsRemoteFact = (
    context: ActorExecutionContext,
    fact: RemoteOperationFact,
    expectedEpoch = session.remoteOperationEpoch,
  ): boolean => {
    const current = readState(context.getState()).remoteOperations[fact.remoteOperationId];
    return (
      current !== undefined &&
      current.remoteOperationId === fact.remoteOperationId &&
      current.requestId === fact.requestId &&
      current.localRequestId === fact.localRequestId &&
      current.reportId === fact.reportId &&
      current.phase === fact.phase &&
      remoteFactMatchesCurrentClient(context, fact, expectedEpoch)
    );
  };

  const remoteFactFrom = (
    input: Readonly<{
      message: RemoteCommandMessage;
      credential: NonNullable<TerminalClientState['credential']>;
      localRequestId: string;
      phase: RemoteOperationFact['phase'];
      addressName: string | null;
      details?: Pick<RemoteOperationFact, 'resultJson' | 'errorCode'>;
    }>,
  ): RemoteOperationFact => {
    const {message, credential, localRequestId, phase, addressName, details = {}} = input;
    return {
      remoteOperationId: message.remoteOperationId,
      requestId: message.requestId,
      localRequestId,
      groupWorkspaceKey: credential.groupWorkspaceKey,
      terminalRef: credential.terminalRef,
      bindingGeneration: credential.bindingGeneration,
      addressName,
      configRevision: session.currentConfigRevision,
      commandName: message.commandName,
      phase,
      reportId: requireProtocolUuid(dependencies),
      occurredAt: new Date(dependencies.now()).toISOString(),
      ...details,
    };
  };

  const sendRemoteReport = async (
    fact: Pick<
      RemoteOperationFact,
      'remoteOperationId' | 'requestId' | 'phase' | 'reportId' | 'occurredAt' | 'resultJson' | 'errorCode'
    >,
  ): Promise<void> => {
    if (!session.sessionReady || session.connection === undefined) return;
    const raw = JSON.stringify({
      type: 'REMOTE_REPORT',
      reportId: fact.reportId,
      remoteOperationId: fact.remoteOperationId,
      requestId: fact.requestId,
      phase: fact.phase,
      occurredAt: fact.occurredAt,
      ...(fact.resultJson === undefined
        ? {}
        : {result: JSON.parse(fact.resultJson) as Readonly<Record<string, unknown>>}),
      ...(fact.errorCode === undefined ? {} : {errorCode: fact.errorCode}),
    });
    if (terminalConnectionMessageUtf8ByteLength(raw) > terminalConnectionMaxCompleteDecompressedMessageBytes) return;
    try {
      await session.connection.send(raw);
    } catch {
      await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
    }
  };

  const persistRemoteFact = async (
    context: ActorExecutionContext,
    fact: RemoteOperationFact,
    expectedEpoch = session.remoteOperationEpoch,
  ): Promise<boolean> => {
    if (!remoteFactMatchesCurrentClient(context, fact, expectedEpoch)) return false;
    const previous = readState(context.getState()).remoteOperations[fact.remoteOperationId];
    if (!(await applyRemoteOperationMutation(context, {kind: 'put', fact}))) return false;
    if (!ownsRemoteFact(context, fact, expectedEpoch)) return false;
    try {
      await flush(context);
      return ownsRemoteFact(context, fact, expectedEpoch);
    } catch {
      if (!ownsRemoteFact(context, fact, expectedEpoch)) return false;
      if (previous === undefined)
        await applyRemoteOperationMutation(context, {kind: 'remove', remoteOperationId: fact.remoteOperationId});
      else if (remoteFactMatchesCurrentClient(context, previous, expectedEpoch))
        await applyRemoteOperationMutation(context, {kind: 'put', fact: previous});
      return false;
    }
  };

  const persistRemoteRemoval = async (
    context: ActorExecutionContext,
    fact: RemoteOperationFact,
    expectedEpoch = session.remoteOperationEpoch,
  ): Promise<boolean> => {
    if (!ownsRemoteFact(context, fact, expectedEpoch)) return false;
    if (!(await applyRemoteOperationMutation(context, {kind: 'remove', remoteOperationId: fact.remoteOperationId})))
      return false;
    if (!remoteFactMatchesCurrentClient(context, fact, expectedEpoch)) return false;
    try {
      await flush(context);
      if (readState(context.getState()).remoteOperations[fact.remoteOperationId] !== undefined) return false;
      if (!remoteFactMatchesCurrentClient(context, fact, expectedEpoch)) return false;
      session.lateRemoteResults.delete(fact.remoteOperationId);
      return true;
    } catch {
      if (
        remoteFactMatchesCurrentClient(context, fact, expectedEpoch) &&
        readState(context.getState()).remoteOperations[fact.remoteOperationId] === undefined
      )
        await applyRemoteOperationMutation(context, {kind: 'put', fact});
      return false;
    }
  };

  const resumeRemoteReports = async (context: ActorExecutionContext): Promise<void> => {
    for (const fact of Object.values(readState(context.getState()).remoteOperations)) {
      let current = fact;
      if (fact.phase === 'RECEIVED' || fact.phase === 'STARTED') {
        const reportId = createProtocolUuid(dependencies);
        if (reportId === null) continue;
        const {resultJson, ...withoutResult} = fact;
        void resultJson;
        current = {
          ...withoutResult,
          phase: 'UNKNOWN',
          reportId,
          occurredAt: new Date(dependencies.now()).toISOString(),
          errorCode: 'REMOTE_RESULT_UNKNOWN',
        };
        if (!(await persistRemoteFact(context, current))) continue;
      }
      await sendRemoteReport(current);
    }
  };

  const reportRemoteOutcome = async (
    input: Readonly<{
      context: ActorExecutionContext;
      message: RemoteCommandMessage;
      credential: NonNullable<TerminalClientState['credential']>;
      original: RemoteOperationFact;
      records: readonly import('@catering-v2s/kernel-base-runtime').ActorExecutionRecord[];
      phase: RemoteOperationFact['phase'];
      expectedEpoch?: number;
      errorCode?: string;
    }>,
  ): Promise<void> => {
    const {context, message, credential, original, records, phase, errorCode} = input;
    const expectedEpoch = input.expectedEpoch ?? session.remoteOperationEpoch;
    const current = readState(context.getState()).remoteOperations[message.remoteOperationId];
    if (
      session.remoteOperationEpoch !== expectedEpoch ||
      current === undefined ||
      current.localRequestId !== original.localRequestId ||
      current.requestId !== original.requestId ||
      current.groupWorkspaceKey !== original.groupWorkspaceKey ||
      current.terminalRef !== original.terminalRef ||
      current.bindingGeneration !== original.bindingGeneration ||
      current.addressName !== original.addressName ||
      current.configRevision !== original.configRevision
    )
      return;
    const result = {
      actorResults: records.map(record => ({
        actorKey: record.actorKey,
        status: record.status,
        result: record.result,
        ...(record.error === null ? {} : {errorCode: record.error.code}),
      })),
    };
    let fact = remoteFactFrom({
      message,
      credential,
      localRequestId: original.localRequestId,
      phase,
      addressName: original.addressName,
      details: {
        resultJson: JSON.stringify(result),
        ...(errorCode === undefined ? {} : {errorCode}),
      },
    });
    const wire = JSON.stringify({
      type: 'REMOTE_REPORT',
      reportId: fact.reportId,
      remoteOperationId: fact.remoteOperationId,
      requestId: fact.requestId,
      phase: fact.phase,
      occurredAt: fact.occurredAt,
      ...(fact.resultJson === undefined
        ? {}
        : {result: JSON.parse(fact.resultJson) as Readonly<Record<string, unknown>>}),
      ...(fact.errorCode === undefined ? {} : {errorCode: fact.errorCode}),
    });
    if (terminalConnectionMessageUtf8ByteLength(wire) > terminalConnectionMaxCompleteDecompressedMessageBytes) {
      fact = remoteFactFrom({
        message,
        credential,
        localRequestId: original.localRequestId,
        phase: 'FAILED',
        addressName: original.addressName,
        details: {errorCode: 'TERMINAL_RESULT_TOO_LARGE'},
      });
    }
    if (await persistRemoteFact(context, fact, expectedEpoch)) await sendRemoteReport(fact);
  };

  const logRemoteCommandBoundary = (
    context: ActorExecutionContext,
    event: string,
    data: Readonly<Record<string, string | number | boolean | null>>,
  ): void => {
    context.platformPorts.logger
      .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'remote-command'})
      .info({
        category: 'terminal.remote-control.execution',
        event: `remote-command.${event}`,
        message: 'Terminal remote-command execution boundary',
        context: {
          commandId: context.command.commandId,
          ...(context.command.requestId == null ? {} : {requestId: context.command.requestId}),
        },
        data,
      });
  };

  const remoteCommandKind = (commandName: string): string => {
    if (commandName === 'kernel.base.remote-control.start-remote-control') return 'START_REMOTE_CONTROL';
    if (commandName === 'kernel.base.remote-control.stop-remote-control') return 'STOP_REMOTE_CONTROL';
    return 'OTHER';
  };

  const runRemoteCommand = async (
    context: ActorExecutionContext,
    message: RemoteCommandMessage,
  ): Promise<Readonly<{status: string}>> => {
    const expectedEpoch = session.remoteOperationEpoch;
    const client = readState(context.getState());
    const credential = client.credential;
    const commandKind = remoteCommandKind(message.commandName);
    const operationContext = {
      remoteOperationId: message.remoteOperationId,
      requestId: message.requestId,
      commandKind,
      bindingGeneration: message.bindingGeneration,
      sessionReady: session.sessionReady,
      hasCredential: credential !== null,
      credentialGenerationMatches: credential?.bindingGeneration === message.bindingGeneration,
    };
    logRemoteCommandBoundary(context, 'received', operationContext);
    const reject = async (errorCode: string): Promise<Readonly<{status: string}>> => {
      if (session.remoteOperationEpoch !== expectedEpoch) {
        logRemoteCommandBoundary(context, 'discarded-after-clear', {...operationContext, errorCode});
        return Object.freeze({status: 'operation-cleared'});
      }
      logRemoteCommandBoundary(context, 'rejected', {...operationContext, errorCode});
      const reportId = createProtocolUuid(dependencies);
      if (reportId !== null) {
        await sendRemoteReport({
          remoteOperationId: message.remoteOperationId,
          requestId: message.requestId,
          phase: 'FAILED',
          reportId,
          occurredAt: new Date(dependencies.now()).toISOString(),
          errorCode,
        });
      }
      return Object.freeze({status: errorCode});
    };
    if (
      credential === null ||
      client.activationStatus !== 'active' ||
      credential.bindingGeneration !== message.bindingGeneration
    )
      return reject('TERMINAL_BINDING_INVALID');
    const prior = client.remoteOperations[message.remoteOperationId];
    if (prior !== undefined) {
      if (
        prior.requestId !== message.requestId ||
        prior.commandName !== message.commandName ||
        prior.groupWorkspaceKey !== credential.groupWorkspaceKey ||
        prior.bindingGeneration !== credential.bindingGeneration ||
        prior.terminalRef !== credential.terminalRef ||
        prior.addressName !== client.connection.addressName ||
        prior.configRevision !== session.currentConfigRevision
      )
        return reject('REMOTE_OPERATION_ID_CONFLICT');
      await sendRemoteReport(prior);
      logRemoteCommandBoundary(context, 'duplicate-reported', {...operationContext, phase: prior.phase});
      return Object.freeze({status: 'duplicate-reported'});
    }
    if (Object.keys(client.remoteOperations).length >= remoteOperationLimit)
      return reject('REMOTE_OPERATION_LIMIT_REACHED');
    if (!isRecord(message.parameters)) return reject('REMOTE_PARAMETERS_INVALID');
    const localRequestId = String(createRequestId());
    const received = remoteFactFrom({
      message,
      credential,
      localRequestId,
      phase: 'RECEIVED',
      addressName: client.connection.addressName,
    });
    if (!(await persistRemoteFact(context, received, expectedEpoch))) return reject('TERMINAL_PERSISTENCE_FAILED');
    logRemoteCommandBoundary(context, 'fact-persisted', {...operationContext, phase: 'RECEIVED'});
    await sendRemoteReport(received);
    const started = remoteFactFrom({
      message,
      credential,
      localRequestId,
      phase: 'STARTED',
      addressName: received.addressName,
    });
    if (!(await persistRemoteFact(context, started, expectedEpoch)))
      return Object.freeze({status: 'start-persistence-failed'});
    logRemoteCommandBoundary(context, 'fact-persisted', {...operationContext, phase: 'STARTED'});
    await sendRemoteReport(started);
    if (!ownsRemoteFact(context, started, expectedEpoch)) {
      logRemoteCommandBoundary(context, 'discarded-after-clear', {...operationContext, phase: 'STARTED'});
      return Object.freeze({status: 'operation-cleared'});
    }
    try {
      logRemoteCommandBoundary(context, 'dispatch-started', {...operationContext, phase: 'STARTED'});
      const result = await context.dispatchCommand(message.commandName, message.parameters as StateJsonValue, {
        requestId: localRequestId as never,
        commandId: createCommandId(),
        target: 'local',
        lateOutcome: record => {
          if (session.remoteOperationEpoch !== expectedEpoch) return;
          const accumulator = session.lateRemoteResults.get(message.remoteOperationId) ?? {
            records: new Map<string, RemoteActorResult>(),
            expectedActorKeys: null,
            unknownPersisted: false,
            reported: false,
          };
          const records = flattenActorResults([record]);
          const hasAggregateResult = isRecord(record.result) && Array.isArray(record.result.actorResults);
          if (hasAggregateResult) accumulator.expectedActorKeys = new Set(records.map(item => item.actorKey));
          for (const current of records) accumulator.records.set(current.actorKey, current);
          session.lateRemoteResults.set(message.remoteOperationId, accumulator);
          reportLateResultWhenComplete({context, message, credential, original: received, accumulator});
        },
        lateResultTtlMs: remoteResultResidenceMs,
      });
      const hasPendingActor = flattenActorResults(result.actorResults).some(record => record.status === 'timed-out');
      logRemoteCommandBoundary(context, 'dispatch-completed', {
        ...operationContext,
        dispatchStatus: result.status,
        actorResultCount: flattenActorResults(result.actorResults).length,
        hasPendingActor,
      });
      if (result.status === 'timed-out' || hasPendingActor) {
        const records = flattenActorResults(result.actorResults);
        const accumulator = session.lateRemoteResults.get(message.remoteOperationId) ?? {
          records: new Map<string, RemoteActorResult>(),
          expectedActorKeys: null,
          unknownPersisted: false,
          reported: false,
        };
        accumulator.expectedActorKeys = new Set(records.map(record => record.actorKey));
        const firstRecords = records.filter(record => !accumulator.records.has(record.actorKey));
        for (const record of firstRecords) accumulator.records.set(record.actorKey, record);
        session.lateRemoteResults.set(message.remoteOperationId, accumulator);
        await reportRemoteOutcome({
          context,
          message,
          credential,
          original: received,
          expectedEpoch,
          records,
          phase: 'UNKNOWN',
          errorCode: 'REMOTE_RESULT_UNKNOWN',
        });
        accumulator.unknownPersisted = true;
        reportLateResultWhenComplete({context, message, credential, original: received, accumulator});
        return Object.freeze({status: 'unknown'});
      }
      session.lateRemoteResults.delete(message.remoteOperationId);
      await reportRemoteOutcome({
        context,
        message,
        credential,
        original: received,
        expectedEpoch,
        records: result.actorResults,
        phase: result.status === 'completed' ? 'COMPLETED' : 'FAILED',
        errorCode: result.status === 'completed' ? undefined : 'REMOTE_COMMAND_FAILED',
      });
      return Object.freeze({status: result.status});
    } catch (error) {
      logRemoteCommandBoundary(context, 'dispatch-failed', {
        ...operationContext,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      await reportRemoteOutcome({
        context,
        message,
        credential,
        original: received,
        expectedEpoch,
        records: [],
        phase: 'FAILED',
        errorCode: 'REMOTE_COMMAND_DISPATCH_FAILED',
      });
      return Object.freeze({status: 'dispatch-failed'});
    }
  };

  return Object.freeze({
    commands: Object.freeze([
      onCommand(terminalRemoteOperationMutationCommand, context => {
        const mutation = context.command.payload as TerminalRemoteOperationMutation;
        if (mutation.kind === 'put') {
          context.dispatchAction(terminalDataClientActions.putRemoteOperation(mutation.fact));
        } else {
          context.dispatchAction(terminalDataClientActions.removeRemoteOperation(mutation.remoteOperationId));
        }
        return Object.freeze({status: 'updated'});
      }),
    ]),
    runRemoteCommand,
    resumeRemoteReports,
    persistRemoteRemoval,
    restoreRemoteOperations,
  });
};
