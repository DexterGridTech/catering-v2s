import {describe, expect, it} from 'vitest'
import {
  createRenderRuntimeFacts,
  resolveDebugMode,
} from '../src'

describe('render runtime facts', () => {
  it('resolves startup over packaging, including an explicit false', () => {
    const cases = [
      [{}, false, 'default'],
      [{packaging: true}, true, 'packaging'],
      [{packaging: false}, false, 'packaging'],
      [{startup: true}, true, 'startup'],
      [{startup: true, packaging: true}, true, 'startup'],
      [{startup: true, packaging: false}, true, 'startup'],
      [{startup: false}, false, 'startup'],
      [{startup: false, packaging: true}, false, 'startup'],
      [{startup: false, packaging: false}, false, 'startup'],
    ] as const

    for (const [input, enabled, source] of cases) {
      expect(resolveDebugMode(input)).toEqual({enabled, source})
    }
  })

  it('keeps production mode independent from the debug fact and freezes the transfer', () => {
    const facts = createRenderRuntimeFacts({
      environmentMode: 'PROD',
      debugMode: resolveDebugMode({packaging: true}),
      deviceIdentity: {available: true, deviceId: 'DEVICE-001'},
      platformPortCapabilities: [{
        port: 'device',
        descriptorStatus: 'complete',
        capabilities: [{capability: 'getDeviceInfo', state: 'real', source: 'adapter'}],
      }],
    })

    expect(facts.environmentMode).toBe('PROD')
    expect(facts.debugMode).toEqual({enabled: true, source: 'packaging'})
    expect(facts.deviceIdentity).toEqual({available: true, deviceId: 'DEVICE-001'})
    expect(Object.isFrozen(facts)).toBe(true)
    expect(Object.isFrozen(facts.debugMode)).toBe(true)
    expect(Object.isFrozen(facts.deviceIdentity)).toBe(true)
    expect(Object.isFrozen(facts.platformPortCapabilities)).toBe(true)
    expect(Object.isFrozen(facts.platformPortCapabilities[0])).toBe(true)
    expect(Object.isFrozen(facts.platformPortCapabilities[0]!.capabilities)).toBe(true)
  })
})
