import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';

export type EmptyPayload = Readonly<{}>;

export const authNoticeDismissedCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'auth-notice-dismissed',
  visibility: 'public',
});

/** Integration requests the existing login or read-only host-login guide stage. */
export const needToLoginStaffCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'need-to-login-staff',
  visibility: 'public',
});

export type AuthSystemOperation = 'login' | 'logout';

export const authSystemFailureObservedCommand = defineCommand<
  Readonly<{
    readonly operation: AuthSystemOperation;
  }>
>(moduleName, {
  name: 'auth-system-failure-observed',
  visibility: 'public',
});

export const authSystemFailureDismissedCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'auth-system-failure-dismissed',
  visibility: 'public',
});
