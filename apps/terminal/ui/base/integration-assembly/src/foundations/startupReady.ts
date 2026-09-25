import {
  defineActor,
  onCommand,
  type ActorDefinition,
  type CommandDefinition,
} from '@catering-v2s/kernel-base-runtime'
import type {RenderSurfaceReadyInput} from '@catering-v2s/ui-base-render'

export type StartupReadyPayload = Readonly<Pick<
  RenderSurfaceReadyInput,
  'surfaceKey' | 'displayIndex' | 'readyPartKey' | 'contentFailure'
>>

export const createStartupReadyPayload = (
  input: RenderSurfaceReadyInput,
): StartupReadyPayload => Object.freeze({
  surfaceKey: input.surfaceKey,
  displayIndex: input.displayIndex,
  readyPartKey: input.readyPartKey,
  contentFailure: input.contentFailure,
})

export type StartupReadyActorInput = Readonly<{
  readonly moduleName: string
  readonly command: CommandDefinition<StartupReadyPayload>
  readonly message: string
}>

export const createStartupReadyActor = ({
  moduleName,
  command,
  message,
}: StartupReadyActorInput): ActorDefinition => defineActor(moduleName, 'startup-ready', [
  onCommand(command, context => {
    context.platformPorts.logger.info({
      category: 'startup.ready',
      event: 'startup.ready',
      message,
      data: {
        surfaceKey: context.command.payload.surfaceKey,
        displayIndex: context.command.payload.displayIndex,
        readyPartKey: context.command.payload.readyPartKey,
        contentFailure: context.command.payload.contentFailure,
        writer: 'ui.base.integration-assembly',
      },
    })
    return null
  }),
])
