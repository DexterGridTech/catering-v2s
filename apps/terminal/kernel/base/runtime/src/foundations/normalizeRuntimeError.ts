import {
  createAppError,
  isAppError,
  type AppError,
  type CommandId,
  type NodeId,
  type RequestId,
  type SessionId,
} from '@catering-v2s/kernel-base-contracts'
import {moduleName} from '../moduleName'

export type RuntimeErrorContext = Readonly<{
  commandName: string
  commandId: CommandId
  requestId: RequestId | null
  sessionId?: SessionId | null
  nodeId?: NodeId | null
}>

const commandExecutionErrorDefinition = {
  key: `${moduleName}.command_execution_failed`,
  name: 'Runtime command execution failed',
  defaultTemplate: 'Runtime command ${commandName} execution failed',
  category: 'SYSTEM' as const,
  severity: 'MEDIUM' as const,
  code: 'ERR_TER_RUNTIME_COMMAND_EXECUTION_FAILED',
  moduleName,
}

export const normalizeRuntimeError = (
  error: unknown,
  context: RuntimeErrorContext,
): AppError => {
  if (isAppError(error)) return error

  const errorContext: {
    commandName: string
    commandId: CommandId
    requestId?: RequestId
    sessionId?: SessionId
    nodeId?: NodeId
  } = {
    commandName: context.commandName,
    commandId: context.commandId,
  }
  if (context.requestId !== null) errorContext.requestId = context.requestId
  if (context.sessionId !== undefined && context.sessionId !== null) {
    errorContext.sessionId = context.sessionId
  }
  if (context.nodeId !== undefined && context.nodeId !== null) {
    errorContext.nodeId = context.nodeId
  }

  return createAppError(commandExecutionErrorDefinition, {
    args: {commandName: context.commandName},
    context: errorContext,
    cause: error,
  })
}
