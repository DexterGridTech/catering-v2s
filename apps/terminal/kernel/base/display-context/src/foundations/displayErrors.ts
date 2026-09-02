import {createAppError, type AppError} from '@catering-v2s/kernel-base-contracts'
import type {ActorExecutionContext} from '@catering-v2s/kernel-base-runtime'
import type {LogFields} from '@catering-v2s/kernel-base-platform-ports'
import {moduleName} from '../moduleName'

const displayErrorDefinition = Object.freeze({
  key: `${moduleName}.transition_rejected`,
  name: 'Display context transition rejected',
  defaultTemplate: 'Display context transition rejected',
  category: 'VALIDATION' as const,
  severity: 'MEDIUM' as const,
  code: 'ERR_TER_DISPLAY_CONTEXT_TRANSITION_REJECTED',
  moduleName,
})

export const createDisplayError = (
  context: ActorExecutionContext,
  message: string,
  details: object,
): AppError => createAppError(displayErrorDefinition, {
  context: {
    commandName: context.command.commandName,
    commandId: context.command.commandId,
    requestId: context.command.requestId ?? undefined,
    nodeId: context.localNodeId,
  },
  details: {message, ...details},
})

const logDisplayMessage = (
  context: ActorExecutionContext,
  event: string,
  message: string,
  data: LogFields,
  level: 'warn' | 'error',
): void => {
  const logger = context.platformPorts.logger.withContext({
    commandId: context.command.commandId,
    commandName: context.command.commandName,
    requestId: context.command.requestId ?? undefined,
    nodeId: context.localNodeId,
  })
  logger[level]({
    category: 'display-context',
    event,
    message,
    data,
  })
}

export const logDisplayDiagnostic = (
  context: ActorExecutionContext,
  event: string,
  message: string,
  data: LogFields,
): void => logDisplayMessage(context, event, message, data, 'warn')

export const logDisplayError = (
  context: ActorExecutionContext,
  event: string,
  message: string,
  data: LogFields,
): void => {
  logDisplayMessage(context, event, message, data, 'error')
}
