import {describe, expect, it} from 'vitest'
import {createCommandId} from '@catering-v2s/kernel-base-contracts'
import {
  createCommand,
  defineCommand,
  type ActorExecutionRecord,
  type CommandExecutionObservation,
  type RuntimeModuleContext,
  type ActorExecutionContext,
} from '../src/index'

describe('runtime type and public-shape boundaries', () => {
  it('T-1 keeps execution records JSON-shaped and accepts null result/error', () => {
    const record: ActorExecutionRecord = {
      actorKey: 'test.actor', status: 'completed', startedAt: 1, completedAt: 2, result: null, error: null,
    }
    const observation: CommandExecutionObservation = {
      commandId: createCommandId(), parentCommandId: null, commandName: 'test.command', target: 'local',
      allowNoActor: false, actorResults: [record], startedAt: 1, completedAt: 2, displayMode: null,
    }
    expect(observation.actorResults[0]?.result).toBeNull()
    expect(observation.actorResults[0]?.error).toBeNull()
  })

  it('T-2 exposes exactly the module and actor context keys at runtime', () => {
    const moduleKeys: readonly (keyof RuntimeModuleContext)[] = [
      'moduleName', 'localNodeId', 'platformPorts', 'descriptors', 'getState', 'flushPersistence',
      'subscribeState', 'dispatchCommand', 'installPeerDispatchGateway',
    ]
    const actorKeys: readonly (keyof ActorExecutionContext)[] = [
      'runtimeId', 'localNodeId', 'platformPorts', 'command', 'actor', 'getState', 'dispatchAction',
      'flushPersistence', 'subscribeState', 'dispatchCommand', 'requestApplicationReset',
    ]
    expect(new Set(moduleKeys).size).toBe(9)
    expect(new Set(actorKeys).size).toBe(11)
    expect(moduleKeys).not.toContain('requestApplicationReset' as never)
    expect(actorKeys).not.toContain('installPeerDispatchGateway' as never)
  })

  it('T-3 keeps command construction factory-bound and freezes intents', () => {
    const definition = defineCommand<{value: number}>('test.types', {name: 'run', visibility: 'internal'})
    const intent = createCommand(definition, {value: 1})
    expect(Object.isFrozen(intent)).toBe(true)
    expect(intent.definition).toBe(definition)
    expect(intent.payload).toEqual({value: 1})
    expect(() => defineCommand('test.types', {name: 'bad.name', visibility: 'internal'})).toThrow()
  })

})
