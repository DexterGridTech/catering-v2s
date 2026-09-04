import {describe, expect, it} from 'vitest'
import {readDisplayInfo, resolveSecondarySurfaceAvailable} from '../src/index'
import {FakeDevicePort, succeeded, unavailable} from './testSupport'

describe('display info public seam', () => {
  it('reads the public tri-state result and applies the unknown-to-single fallback', async () => {
    const device = new FakeDevicePort()
    device.displayCount = 2

    const valid = await readDisplayInfo(device)
    expect(valid).toEqual({status: 'valid', displayCount: 2})
    expect(resolveSecondarySurfaceAvailable(valid)).toBe(true)

    device.displayResults.push(unavailable('getDisplayInfo'))
    const unavailableResult = await readDisplayInfo(device)
    expect(unavailableResult.status).toBe('unavailable')
    expect(resolveSecondarySurfaceAvailable(unavailableResult)).toBe(false)

    device.displayResults.push(succeeded({displayCount: 0}))
    const malformed = await readDisplayInfo(device)
    expect(malformed.status).toBe('malformed')
    expect(resolveSecondarySurfaceAvailable(malformed)).toBe(false)
  })
})
