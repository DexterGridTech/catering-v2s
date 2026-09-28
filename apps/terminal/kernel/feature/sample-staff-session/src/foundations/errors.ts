import {createAppError, createModuleErrorFactory, type AppError} from '@catering-v2s/kernel-base-contracts';
import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';

const defineError = createModuleErrorFactory(moduleName);

export const invalidCredentialsErrorDefinition = defineError('invalid-credentials', {
  name: 'Sample staff credentials are invalid',
  defaultTemplate: 'Sample staff credentials are invalid',
  category: 'AUTHENTICATION',
  severity: 'LOW',
  code: 'ERR_TER_SAMPLE_STAFF_INVALID_CREDENTIALS',
});

export const createInvalidCredentialsError = (context: ActorExecutionContext): AppError =>
  createAppError(invalidCredentialsErrorDefinition, {
    args: {},
    context: {
      commandName: context.command.commandName,
      commandId: context.command.commandId,
      requestId: context.command.requestId ?? undefined,
      nodeId: context.localNodeId,
    },
    details: {reasonCode: 'invalid-credentials'},
  });
