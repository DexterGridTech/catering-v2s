import {
  actorCommandHandlerDefinitionBrand,
  actorDefinitionBrand,
  type ActorDefinition,
  type ActorInfo,
  type RegisteredActorHandler,
} from '../types/actor'
import {freezeList} from './freezeList'

export type RuntimeActorRegistry = Readonly<{
  handlersByCommand: ReadonlyMap<string, readonly RegisteredActorHandler[]>
  actorCount: number
}>

type RuntimeActorModule = Readonly<{
  moduleName: string
  actorDefinitions?: readonly ActorDefinition[]
}>

type RegisteredCommandDefinitions = ReadonlyMap<string, unknown>

type ActorValidationMessages = Readonly<{
  actorDefinition?: (moduleName: string) => string
  handlerDefinition?: (actorKey: string) => string
}>

const assertActorDefinition = (
  actor: ActorDefinition,
  message = 'Runtime actor must be created by defineActor',
): void => {
  if (typeof actor !== 'object' || actor === null || !(actorDefinitionBrand in actor)) {
    throw new Error(message)
  }
}

const assertHandlerDefinition = (
  handler: ActorDefinition['handlers'][number],
  message = 'Runtime actor handler must be created by onCommand',
): void => {
  if (typeof handler !== 'object' || handler === null || !(actorCommandHandlerDefinitionBrand in handler)) {
    throw new Error(message)
  }
  if (handler.definition.commandName !== handler.commandName) {
    throw new Error(`Runtime actor handler command identity mismatch: ${handler.commandName}`)
  }
}

export const createActorRegistry = (
  modules: readonly RuntimeActorModule[],
  definitions?: RegisteredCommandDefinitions,
  messages: ActorValidationMessages = {},
): RuntimeActorRegistry => {
  const handlersByCommand = new Map<string, RegisteredActorHandler[]>()
  const actors = new Set<string>()
  const handlers = new Set<string>()
  let order = 0

  for (const module of modules) {
    for (const actor of module.actorDefinitions ?? []) {
      assertActorDefinition(actor, messages.actorDefinition?.(module.moduleName))
      if (actor.moduleName !== module.moduleName) {
        throw new Error(`Actor definition does not belong to owning module: ${actor.actorKey}`)
      }
      const actorKey = `${actor.moduleName}.${actor.actorName}`
      if (actors.has(actorKey)) {
        throw new Error(`Duplicate runtime actor: ${actorKey}`)
      }
      actors.add(actorKey)
      for (const handler of actor.handlers) {
        assertHandlerDefinition(handler, messages.handlerDefinition?.(actorKey))
        if (definitions !== undefined && !definitions.has(handler.commandName)) {
          throw new Error(`Actor handler command is not registered: ${handler.commandName}`)
        }
        const handlerKey = `${actorKey}:${handler.commandName}`
        if (handlers.has(handlerKey)) {
          throw new Error(`Duplicate runtime actor handler: ${handlerKey}`)
        }
        handlers.add(handlerKey)
        const actorInfo: ActorInfo = Object.freeze({
          actorKey,
          moduleName: actor.moduleName,
          actorName: actor.actorName,
        })
        const next = handlersByCommand.get(handler.commandName) ?? []
        next.push(Object.freeze({
          actor: actorInfo,
          commandName: handler.commandName,
          handle: handler.handle,
          order: order++,
        }))
        handlersByCommand.set(handler.commandName, next)
      }
    }
  }

  const frozenEntries = new Map<string, readonly RegisteredActorHandler[]>()
  for (const [name, values] of handlersByCommand) {
    frozenEntries.set(name, freezeList(values))
  }
  return Object.freeze({
    handlersByCommand: frozenEntries,
    actorCount: actors.size,
  })
}
