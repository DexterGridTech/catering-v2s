import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import {
  actorCommandHandlerDefinitionBrand,
  actorDefinitionBrand,
  type ActorCommandHandler,
  type ActorCommandHandlerDefinition,
  type ActorDefinition,
} from '../types/actor'
import type {CommandDefinition} from '../types/command'

const requireBareName = (value: string, label: string): void => {
  if (value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`)
  }
  if (value.includes('.')) {
    throw new Error(`${label} must be a bare name: ${value}`)
  }
}

const requireModuleName = (value: string): void => {
  if (value.trim().length === 0) {
    throw new Error('Runtime actor module name must be non-empty')
  }
}

export const onCommand = <TPayload extends StateJsonValue>(
  definition: CommandDefinition<TPayload>,
  handle: ActorCommandHandler<TPayload>,
): ActorCommandHandlerDefinition<TPayload> => Object.freeze({
  commandName: definition.commandName,
  definition,
  handle,
  [actorCommandHandlerDefinitionBrand]: true as const,
})

export const defineActor = <
  THandlers extends readonly ActorCommandHandlerDefinition[],
>(
  moduleName: string,
  actorName: string,
  handlers: THandlers,
): ActorDefinition => {
  requireModuleName(moduleName)
  requireBareName(actorName, 'Runtime actor name')
  const actorKey = `${moduleName}.${actorName}`
  return Object.freeze({
    moduleName,
    actorName,
    actorKey,
    handlers: Object.freeze([...handlers]),
    [actorDefinitionBrand]: true as const,
  })
}
