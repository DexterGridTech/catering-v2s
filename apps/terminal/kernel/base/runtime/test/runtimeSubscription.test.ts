import {describe, expect, it} from 'vitest'
import {
  createRuntime,
  defineCommand,
  type RuntimeModule,
  type RuntimeStatus,
} from '../src/index'
import {
  createCommandModule,
  createTestRuntimeInput,
  createTestSlice,
} from './testSupport'

const incrementCommand = defineCommand<Readonly<{}>>('test.runtime.subscription', {
  name: 'increment',
  visibility: 'internal',
})

describe('runtime facade subscription', () => {
  it('retains a pre-start subscription and reports written status transitions in order', async () => {
    const module = createCommandModule({
      command: incrementCommand,
      stateSlice: createTestSlice('test.runtime.subscription.state'),
      handler: context => {
        context.dispatchAction({type: 'test/increment'})
        return null
      },
    })
    const runtime = createRuntime(createTestRuntimeInput({modules: [module]}))
    const statuses: RuntimeStatus[] = []
    let startedRoot: unknown
    const unsubscribe = runtime.subscribe(() => {
      statuses.push(runtime.status)
      if (runtime.status === 'started') startedRoot = runtime.getState()
    })

    expect(statuses).toEqual([])
    await runtime.start()

    expect(statuses).toEqual(['starting', 'started'])
    expect(startedRoot).toBe(runtime.getState())
    unsubscribe()
  })

  it('notifies synchronously while an actor dispatches a state action', async () => {
    let inActionDispatch = false
    let observedSynchronously = false
    let observedValue = 0
    const module = createCommandModule({
      command: incrementCommand,
      stateSlice: createTestSlice('test.runtime.subscription.sync'),
      handler: context => {
        inActionDispatch = true
        context.dispatchAction({type: 'test/increment'})
        inActionDispatch = false
        return null
      },
    })
    const runtime = createRuntime(createTestRuntimeInput({modules: [module]}))
    const unsubscribe = runtime.subscribe(() => {
      if (runtime.status !== 'started') return
      observedSynchronously ||= inActionDispatch
      const value = runtime.getState()['test.runtime.subscription.sync']
      if (value && 'value' in value && typeof value.value === 'number') observedValue = value.value
    })
    await runtime.start()

    await runtime.dispatchCommand(incrementCommand, {})

    expect(observedSynchronously).toBe(true)
    expect(observedValue).toBe(1)
    unsubscribe()
  })

  it('reports failed after failure is written and closes facade subscriptions', async () => {
    const failingModule: RuntimeModule = {
      moduleName: 'test.runtime.subscription.failure',
      kind: 'owner',
      dependencies: [{moduleName: 'kernel.base.runtime'}],
      commands: [],
      commandDefinitions: [],
      actors: [],
      actorDefinitions: [],
      stateSlices: [createTestSlice('test.runtime.subscription.failure.state')],
      install: () => { throw new Error('subscription start failure') },
    }
    const runtime = createRuntime(createTestRuntimeInput({modules: [failingModule]}))
    const statuses: RuntimeStatus[] = []
    const failures: unknown[] = []
    const unsubscribe = runtime.subscribe(() => {
      statuses.push(runtime.status)
      failures.push(runtime.failure)
    })

    await expect(runtime.start()).rejects.toMatchObject({key: 'kernel.base.runtime.lifecycle_failed'})

    expect(statuses).toEqual(['starting', 'failed'])
    expect(failures[0]).toBeNull()
    expect(failures[1]).toMatchObject({key: 'kernel.base.runtime.lifecycle_failed'})
    const notificationCount = statuses.length
    await expect(runtime.start()).rejects.toMatchObject({key: 'kernel.base.runtime.lifecycle_failed'})
    expect(statuses).toHaveLength(notificationCount)
    const {releaseRuntimeForTest} = await import('../src/testing/releaseRuntimeForTest')
    expect(releaseRuntimeForTest(runtime)).toBe(0)
    runtime.subscribe(() => { throw new Error('failed runtime must not retain a late listener') })
    expect(releaseRuntimeForTest(runtime)).toBe(0)
    unsubscribe()
  })

  it('makes unsubscribe idempotent and exposes the post-unsubscribe oracle through a real command', async () => {
    const module = createCommandModule({
      command: incrementCommand,
      stateSlice: createTestSlice('test.runtime.subscription.unsubscribe'),
      handler: context => {
        context.dispatchAction({type: 'test/increment'})
        return null
      },
    })
    const runtime = createRuntime(createTestRuntimeInput({modules: [module]}))
    await runtime.start()
    let notifications = 0
    const unsubscribe = runtime.subscribe(() => { notifications += 1 })

    await runtime.dispatchCommand(incrementCommand, {})
    const beforeUnsubscribe = notifications
    unsubscribe()
    unsubscribe()
    await runtime.dispatchCommand(incrementCommand, {})

    expect(beforeUnsubscribe).toBeGreaterThan(0)
    expect(notifications).toBe(beforeUnsubscribe)
  })

  it('releases facade subscriptions through the existing test resource seam', async () => {
    const module = createCommandModule({
      command: incrementCommand,
      stateSlice: createTestSlice('test.runtime.subscription.release'),
      handler: context => {
        context.dispatchAction({type: 'test/increment'})
        return null
      },
    })
    const runtime = createRuntime(createTestRuntimeInput({modules: [module]}))
    await runtime.start()
    let notifications = 0
    runtime.subscribe(() => { notifications += 1 })
    await runtime.dispatchCommand(incrementCommand, {})
    const beforeRelease = notifications

    const {releaseRuntimeForTest} = await import('../src/testing/releaseRuntimeForTest')
    expect(releaseRuntimeForTest(runtime)).toBeGreaterThan(0)
    await runtime.dispatchCommand(incrementCommand, {})

    expect(beforeRelease).toBeGreaterThan(0)
    expect(notifications).toBe(beforeRelease)
  })

  it('keeps the existing snapshot availability and reference stability contract', async () => {
    const runtime = createRuntime(createTestRuntimeInput({
      modules: [createCommandModule({
        command: incrementCommand,
        stateSlice: createTestSlice('test.runtime.subscription.snapshot'),
      })],
    }))
    expect(() => runtime.getState()).toThrow()
    await runtime.start()
    const first = runtime.getState()
    const second = runtime.getState()

    expect(second).toBe(first)
  })
})
