import {
  createAppError,
  createModuleErrorFactory,
  type AppError,
} from '@catering-v2s/kernel-base-contracts'
import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from '../moduleName'

const defineError = createModuleErrorFactory(moduleName)

const noPendingMemberErrorDefinition = defineError('no-pending-member', {
  name: 'No pending member registration',
  defaultTemplate: 'No pending member registration is available to confirm',
  category: 'BUSINESS',
  severity: 'LOW',
  code: 'ERR_TER_SAMPLE_MEMBER_NO_PENDING',
})

const invalidMemberPayloadErrorDefinition = defineError('invalid-member-payload', {
  name: 'Sample member payload is invalid',
  defaultTemplate: 'Sample member payload is invalid',
  category: 'VALIDATION',
  severity: 'LOW',
  code: 'ERR_TER_SAMPLE_MEMBER_INVALID_PAYLOAD',
})

const errorContext = (context: ActorExecutionContext) => ({
  commandName: context.command.commandName,
  commandId: context.command.commandId,
  requestId: context.command.requestId ?? undefined,
  nodeId: context.localNodeId,
})

export const createNoPendingMemberError = (context: ActorExecutionContext): AppError => createAppError(
  noPendingMemberErrorDefinition,
  {args: {}, context: errorContext(context), details: {reasonCode: 'no-pending-member'}},
)

export const createInvalidMemberPayloadError = (context: ActorExecutionContext): AppError => createAppError(
  invalidMemberPayloadErrorDefinition,
  {args: {}, context: errorContext(context), details: {reasonCode: 'invalid-member-payload'}},
)

export const memberErrorDefinitions = [
  noPendingMemberErrorDefinition,
  invalidMemberPayloadErrorDefinition,
] as const
