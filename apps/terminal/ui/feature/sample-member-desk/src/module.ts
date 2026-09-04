import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import {dependencyModuleNames} from './dependencies'
import {memberFormOpenedCommand, noticeDismissedCommand} from './commands'
import {
  createDeskConfirmedActor,
  createDeskFormActor,
  createDeskNavigationActor,
  createDeskNoticeActor,
  createDeskPendingActor,
  createDeskRejectedActor,
} from './features/actors/actors'
import {moduleKind, moduleName} from './moduleName'

const commands = [memberFormOpenedCommand, noticeDismissedCommand] as const

export const createSampleMemberDeskModule = (): RuntimeModule => {
  const actors = [
    createDeskNavigationActor(),
    createDeskFormActor(),
    createDeskPendingActor(),
    createDeskConfirmedActor(),
    createDeskRejectedActor(),
    createDeskNoticeActor(),
  ] as const
  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: dependencyModuleNames.map(name => ({moduleName: name})),
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    actors: actors.map(actor => ({name: actor.actorName})),
    actorDefinitions: actors,
    slices: [],
    stateSlices: [],
  })
}
