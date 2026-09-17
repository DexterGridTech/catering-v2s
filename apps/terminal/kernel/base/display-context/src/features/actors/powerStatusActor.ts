import {
  defineActor,
  onCommand,
} from '@catering-v2s/kernel-base-runtime'
import type {ActorDefinition} from '@catering-v2s/kernel-base-runtime'
import {moduleName} from '../../moduleName'
import {powerStatusChangedCommand} from '../commands/powerStatusChanged'
import {requestPowerRoleChangeCommand} from '../commands/requestPowerRoleChange'
import {createDisplayError} from '../../foundations/displayErrors'
import {isPowerSource} from '../../types/display'

export const createPowerStatusActor = (): ActorDefinition => defineActor(moduleName, 'power-status', [
  onCommand(powerStatusChangedCommand, async context => {
    const payload = context.command.payload
    const source = typeof payload === 'object' && payload !== null
      ? Reflect.get(payload, 'powerSource')
      : undefined
    if (!isPowerSource(source)) {
      throw createDisplayError(context, 'Power source payload is invalid', {
        reasonCode: 'invalid-power-source',
      })
    }
    const result = await context.dispatchCommand(
      requestPowerRoleChangeCommand,
      Object.freeze({powerSource: source}),
      {
        requestId: context.command.requestId ?? undefined,
        parentCommandId: context.command.commandId,
        routeContext: context.command.routeContext,
        target: 'local',
      },
    )
    if (result.status !== 'completed') {
      throw createDisplayError(context, 'Power confirmation request did not complete', {
        reasonCode: 'power-confirmation-request-failed',
        childStatus: result.status,
      })
    }
    const childResult = result.actorResults.find(actor => actor.status === 'completed')?.result
    return childResult ?? Object.freeze({changed: false, reason: 'confirmation-request-no-result'})
  }),
])
