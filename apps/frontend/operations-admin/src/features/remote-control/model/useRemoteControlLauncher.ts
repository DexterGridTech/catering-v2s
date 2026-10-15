import {useCallback, useEffect, useRef, useState} from 'react';
import {
  operationsClient,
  operationsLogger,
  operationsProblemOf,
} from '../../../app/api/OperationsTransport';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type TerminalRemoteControlStartResponse,
} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {createRemoteControlUuid} from './remoteControlIdentity';
import type {RemoteControlTarget} from '../ui/RemoteControlWorkspace';

export type RemoteControlSession = Readonly<{
  target: RemoteControlTarget;
  start: TerminalRemoteControlStartResponse;
}>;

const errorDiagnostics = (error: unknown): Record<string, string> => {
  const debugDetails = import.meta.env.DEV || import.meta.env.VITE_FRONTEND_DEBUG_LOGS === 'true';
  if (error instanceof Error) {
    return {
      errorName: error.name,
      ...(debugDetails ? {errorMessage: error.message, errorStack: error.stack ?? ''} : {}),
    };
  }
  return {errorName: typeof error, ...(debugDetails ? {errorMessage: String(error)} : {})};
};

export function useRemoteControlLauncher(contextKey: string) {
  const currentContextKey = useRef(contextKey);
  currentContextKey.current = contextKey;
  const requestGeneration = useRef(0);
  const pendingStart = useRef<{generation: number; restartFromSessionId?: string} | undefined>(undefined);
  const isStartingRef = useRef(false);
  const [currentSession, setCurrentSession] = useState<RemoteControlSession>();
  const currentSessionRef = useRef<RemoteControlSession | undefined>(undefined);
  const [isStarting, setIsStarting] = useState(false);

  const endRemoteSession = useCallback(async (target: RemoteControlTarget, start: TerminalRemoteControlStartResponse) => {
    try {
      await operationsClient.endOperationsTerminalRemoteControl(
        {
          groupWorkspaceKey: target.groupWorkspaceKey,
          projectRef: wireUuid(target.projectRef),
          terminalRef: wireUuid(target.terminalRef),
          sessionId: start.sessionId,
        },
        {query: {expectedContextVersion: target.expectedContextVersion}, body: {reason: 'WORKSPACE_CLOSED'}},
      );
      operationsLogger.info({
        event: 'frontend.remote_control.session_closed',
        phase: 'remote_control',
        outcome: 'SUCCEEDED',
        operationId: OPERATIONS_ADMIN_OPERATION_IDS.endOperationsTerminalRemoteControl,
        diagnostic: {sessionId: start.sessionId, reason: 'WORKSPACE_CLOSED'},
      });
    } catch (error) {
      const failure = operationsProblemOf(error);
      operationsLogger.error({
        event: 'frontend.remote_control.session_close_failed',
        phase: 'cleanup',
        outcome: 'ERROR',
        operationId: OPERATIONS_ADMIN_OPERATION_IDS.endOperationsTerminalRemoteControl,
        errorCode: failure.errorCode,
        status: failure.status,
        diagnostic: {sessionId: start.sessionId, ...errorDiagnostics(error)},
      });
    }
  }, []);

  const closeCurrentSession = useCallback((sessionId?: string) => {
    const session = currentSessionRef.current;
    if (!session || (sessionId !== undefined && session.start.sessionId !== sessionId)) return;
    currentSessionRef.current = undefined;
    setCurrentSession(current => current?.start.sessionId === session.start.sessionId ? undefined : current);
    void endRemoteSession(session.target, session.start);
  }, [endRemoteSession]);

  const launch = useCallback(async (
    target: RemoteControlTarget,
    isTargetCurrent: () => boolean,
    restartFromSessionId?: string,
  ): Promise<RemoteControlSession | undefined> => {
    if (isStartingRef.current) return undefined;
    const generation = ++requestGeneration.current;
    pendingStart.current = {generation, restartFromSessionId};
    isStartingRef.current = true;
    setIsStarting(true);
    operationsLogger.info({
      event: 'frontend.remote_control.start',
      phase: 'remote_control',
      outcome: 'STARTED',
      operationId: OPERATIONS_ADMIN_OPERATION_IDS.startOperationsTerminalRemoteControl,
      diagnostic: {projectRef: target.projectRef, terminalRef: target.terminalRef},
    });
    try {
      const start = await operationsClient.startOperationsTerminalRemoteControl(
        {
          groupWorkspaceKey: target.groupWorkspaceKey,
          projectRef: wireUuid(target.projectRef),
          terminalRef: wireUuid(target.terminalRef),
        },
        {
          query: {expectedContextVersion: target.expectedContextVersion},
          body: {requestId: wireUuid(createRemoteControlUuid())},
        },
      );
      const isCurrent = requestGeneration.current === generation &&
        currentContextKey.current === target.contextKey && isTargetCurrent();
      if (!isCurrent) {
        await endRemoteSession(target, start);
        return undefined;
      }
      const session = {target, start};
      currentSessionRef.current = session;
      setCurrentSession(session);
      operationsLogger.info({
        event: 'frontend.remote_control.start',
        phase: 'remote_control',
        outcome: 'SUCCEEDED',
        operationId: OPERATIONS_ADMIN_OPERATION_IDS.startOperationsTerminalRemoteControl,
        diagnostic: {sessionId: start.sessionId, state: start.state},
      });
      return session;
    } finally {
      if (requestGeneration.current === generation) {
        pendingStart.current = undefined;
        isStartingRef.current = false;
        setIsStarting(false);
      }
    }
  }, [endRemoteSession]);

  const start = useCallback((target: RemoteControlTarget, isTargetCurrent: () => boolean) =>
    launch(target, isTargetCurrent), [launch]);

  const restart = useCallback((target: RemoteControlTarget) => {
    const restartFromSessionId = currentSessionRef.current?.start.sessionId;
    if (!restartFromSessionId) return Promise.resolve(undefined);
    return launch(
      target,
      () => currentContextKey.current === target.contextKey,
      restartFromSessionId,
    );
  }, [launch]);

  const clear = useCallback((sessionId: string) => {
    if (currentSessionRef.current?.start.sessionId === sessionId) currentSessionRef.current = undefined;
    setCurrentSession(current => current?.start.sessionId === sessionId ? undefined : current);
  }, []);

  const invalidatePendingStart = useCallback(() => {
    requestGeneration.current += 1;
    pendingStart.current = undefined;
    isStartingRef.current = false;
    setIsStarting(false);
  }, []);

  const cancelRestart = useCallback((sessionId: string) => {
    if (pendingStart.current?.restartFromSessionId !== sessionId) return;
    operationsLogger.info({
      event: 'frontend.remote_control.restart_cancelled_by_close',
      phase: 'remote_control',
      outcome: 'CANCELLED',
      operationId: OPERATIONS_ADMIN_OPERATION_IDS.startOperationsTerminalRemoteControl,
      diagnostic: {sessionId, reason: 'WORKSPACE_CLOSE_REQUESTED'},
    });
    invalidatePendingStart();
  }, [invalidatePendingStart]);

  useEffect(() => () => {
    requestGeneration.current += 1;
    isStartingRef.current = false;
    const session = currentSessionRef.current;
    currentSessionRef.current = undefined;
    if (session) void endRemoteSession(session.target, session.start);
  }, [endRemoteSession]);

  const previousContextKey = useRef(contextKey);
  useEffect(() => {
    if (previousContextKey.current === contextKey) return;
    previousContextKey.current = contextKey;
    invalidatePendingStart();
    if (currentSessionRef.current?.target.contextKey !== contextKey) closeCurrentSession();
  }, [closeCurrentSession, contextKey, invalidatePendingStart]);

  return {currentSession, isStarting, start, restart, clear, invalidatePendingStart, cancelRestart};
}
