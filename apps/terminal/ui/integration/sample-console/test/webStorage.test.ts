import {describe, expect, it} from 'vitest'
import {createWebStateStoragePort} from '@catering-v2s/ui-base-test-support'
import {FakeWebStorage} from './support'

describe('sample-console Web StateStoragePort', () => {
  it('persists strings in a namespace and keeps the physical storage distinct from memory', async () => {
    const storage = new FakeWebStorage()
    const port = createWebStateStoragePort(storage, 'plain:', 'persistKv')
    const other = createWebStateStoragePort(storage, 'protected:', 'persistSecure')

    expect(await port.write({key: 'members', value: '{"members":[]} ', timeoutMs: 50})).toMatchObject({status: 'succeeded'})
    expect(await port.read({key: 'members', timeoutMs: 50})).toMatchObject({
      status: 'succeeded',
      value: {state: 'found', value: '{"members":[]} '},
    })
    expect(await other.read({key: 'members', timeoutMs: 50})).toMatchObject({
      status: 'succeeded',
      value: {state: 'missing'},
    })
    expect(await port.listKeys({timeoutMs: 50})).toMatchObject({
      status: 'succeeded',
      value: ['members'],
    })
    expect(storage.getItem('plain:members')).toBe('{"members":[]} ')
  })

  it('clears only its own namespace', async () => {
    const storage = new FakeWebStorage()
    const plain = createWebStateStoragePort(storage, 'plain:', 'persistKv')
    const protectedPort = createWebStateStoragePort(storage, 'protected:', 'persistSecure')
    await plain.write({key: 'a', value: '1', timeoutMs: 50})
    await protectedPort.write({key: 'b', value: '2', timeoutMs: 50})
    await plain.clear({timeoutMs: 50})
    expect(storage.getItem('plain:a')).toBeNull()
    expect(storage.getItem('protected:b')).toBe('2')
  })
})
