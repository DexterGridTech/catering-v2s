import type {ActorDefinition, ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime';
import {
  bootstrapSessionCommand,
  loginCommand,
  loginFailedCommand,
  loginSucceededCommand,
  logoutCommand,
  logoutSucceededCommand,
  sessionRestoredAnonymousCommand,
  sessionRestoredAuthenticatedCommand,
} from '../commands/commands';
import {createInvalidCredentialsError} from '../../foundations/errors';
import {moduleName} from '../../moduleName';
import {selectSessionState} from '../../selectors/selectors';
import {sessionActions} from '../slices/slice';
import type {LoginPayload} from '../../types/types';
import type {StateRoot} from '@catering-v2s/kernel-base-state';

export type StaffLoginGuard = (state: StateRoot) => boolean;

const credentials: readonly LoginPayload[] = [
  Object.freeze({operatorName: 'A001', passcode: '1111'}),
  Object.freeze({operatorName: 'A002', passcode: '2222'}),
];

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readLoginPayload = (value: unknown): LoginPayload => {
  if (
    !isRecord(value) ||
    typeof value.operatorName !== 'string' ||
    typeof value.passcode !== 'string' ||
    value.operatorName.trim().length === 0 ||
    value.passcode.trim().length === 0
  ) {
    throw new Error('[sample-staff-session] login payload must contain operatorName and passcode');
  }
  return Object.freeze({operatorName: value.operatorName, passcode: value.passcode});
};

const isKnownCredential = (payload: LoginPayload): boolean =>
  credentials.some(
    candidate => candidate.operatorName === payload.operatorName && candidate.passcode === payload.passcode,
  );

const dispatchRestoreEvent = async (context: ActorExecutionContext): Promise<void> => {
  const state = selectSessionState(context.getState());
  if (state.status === 'authenticated' && state.operatorName !== null) {
    await context.dispatchCommand(sessionRestoredAuthenticatedCommand, {
      operatorName: state.operatorName,
    });
    return;
  }
  await context.dispatchCommand(sessionRestoredAnonymousCommand, {});
};

export const createBootstrapActor = (): ActorDefinition =>
  defineActor(moduleName, 'bootstrap', [
    onCommand(bootstrapSessionCommand, async context => {
      await dispatchRestoreEvent(context);
      return null;
    }),
  ]);

export const createLoginActor = (canLogin?: StaffLoginGuard): ActorDefinition =>
  defineActor(moduleName, 'login', [
    onCommand(loginCommand, async context => {
      if (canLogin !== undefined && !canLogin(context.getState()))
        throw new Error('STAFF_LOGIN_REQUIRES_ACTIVE_TERMINAL');
      const payload = readLoginPayload(context.command.payload);
      if (!isKnownCredential(payload)) {
        await context.dispatchCommand(loginFailedCommand, {reasonCode: 'invalid-credentials'});
        throw createInvalidCredentialsError(context);
      }

      context.dispatchAction(sessionActions.setAuthenticated(payload.operatorName));
      await context.dispatchCommand(loginSucceededCommand, {operatorName: payload.operatorName});
      return null;
    }),
  ]);

export const createLogoutActor = (): ActorDefinition =>
  defineActor(moduleName, 'logout', [
    onCommand(logoutCommand, async context => {
      context.dispatchAction(sessionActions.setAnonymous());
      await context.dispatchCommand(logoutSucceededCommand, {});
      return null;
    }),
  ]);
