import type {ActorDefinition} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {loginCommand, loginFailedCommand, loginSucceededCommand} from '../../declarations/commands';
import {createInvalidCredentialsError} from '../../foundations/errors';
import {moduleName} from '../../moduleName';
import {sessionActions} from '../slices/staffSession';
import type {LoginPayload} from '../../types/types';

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

export const createStaffLoginActor = (canLogin?: StaffLoginGuard): ActorDefinition =>
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
