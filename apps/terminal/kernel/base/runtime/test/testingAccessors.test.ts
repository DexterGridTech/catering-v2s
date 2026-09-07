import {describe, expect, it} from 'vitest'
import type {Runtime} from '../src/types/runtime'
import {
  releaseRuntimeForTest,
} from '../src/testing/releaseRuntimeForTest'
import {
  registerRuntimeStateSyncAccessor,
} from '../src/foundations/runtimeStateSyncAccessorRegistry'
import {
  runtimeStateSyncForTest,
} from '../src/testing/runtimeStateSyncForTest'

describe('runtime testing accessor boundaries', () => {
  it('returns zero when a runtime has no resource registry', () => {
    expect(releaseRuntimeForTest({} as Runtime)).toBe(0)
  })

  it('rejects a runtime without a registered state sync accessor', () => {
    expect(() => runtimeStateSyncForTest({} as Runtime)).toThrow(
      'Runtime state sync test accessor is not registered',
    )
  })

  it('rejects state sync reads and writes when the registered runtime is unavailable', () => {
    const runtime = {} as Runtime
    registerRuntimeStateSyncAccessor(runtime, () => undefined)
    const accessor = runtimeStateSyncForTest(runtime)

    expect(() => accessor.createFullSyncPayload('test.slice')).toThrow(
      'State runtime is not available',
    )
    expect(() => accessor.applyAuthoritativeSync('test.slice', {} as never)).toThrow(
      'State runtime is not available',
    )
  })
})
