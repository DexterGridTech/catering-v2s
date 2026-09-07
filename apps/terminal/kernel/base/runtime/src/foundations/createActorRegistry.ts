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

const registerActorHandlers = (input: Readonly<{
  actor: ActorDefinition
  actorKey: string
  definitions?: RegisteredCommandDefinitions
  messages: ActorValidationMessages
  handlersByCommand: Map<string, RegisteredActorHandler[]>
  handlers: Set<string>
  order: number
}>): number => {
  let nextOrder = input.order
  for (const handler of input.actor.handlers) {
    assertHandlerDefinition(handler, input.messages.handlerDefinition?.(input.actorKey))
    if (input.definitions !== undefined && !input.definitions.has(handler.commandName)) {
      throw new Error(`Actor handler command is not registered: ${handler.commandName}`)
    }
    const handlerKey = `${input.actorKey}:${handler.commandName}`
    if (input.handlers.has(handlerKey)) {
      throw new Error(`Duplicate runtime actor handler: ${handlerKey}`)
    }
    input.handlers.add(handlerKey)
    const actorInfo: ActorInfo = Object.freeze({
      actorKey: input.actorKey,
      moduleName: input.actor.moduleName,
      actorName: input.actor.actorName,
    })
    const next = input.handlersByCommand.get(handler.commandName) ?? []
    next.push(Object.freeze({
      actor: actorInfo,
      commandName: handler.commandName,
      handle: handler.handle,
      order: nextOrder++,
    }))
    input.handlersByCommand.set(handler.commandName, next)
  }
  return nextOrder
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
      order = registerActorHandlers({
        actor,
        actorKey,
        definitions,
        messages,
        handlersByCommand,
        handlers,
        order,
      })
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
