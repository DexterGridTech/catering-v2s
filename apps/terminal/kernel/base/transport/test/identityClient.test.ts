import {describe, expect, it} from 'vitest'
import {createTopologyIdentityClient} from '../src/foundations/createTopologyIdentityClient'

const identity = JSON.stringify({
  type: 'identity',
  protocolVersion: 1,
  nodeId: 'node-2',
  displayName: 'TER host',
  instanceMode: 'MASTER',
  displayRole: 'CHIEF',
})

describe('topology identity client', () => {
  it('reads and validates the status identity before a websocket is used', async () => {
    const fetchLike = async (url: string, init: Readonly<{readonly method: 'GET'}>) => {
      expect(url).toBe('http://192.0.2.10:43172/terminal-topology/status')
      expect(init).toEqual({method: 'GET'})
      return {ok: true, status: 200, text: async () => identity}
    }
    await expect(createTopologyIdentityClient(fetchLike).query('192.0.2.10')).resolves.toMatchObject({
      type: 'identity',
      nodeId: 'node-2',
      instanceMode: 'MASTER',
    })
  })

  it('rejects a non-bare host before making a request', async () => {
    const fetchLike = async () => {
      throw new Error('must not be called')
    }
    await expect(createTopologyIdentityClient(fetchLike).query('http://192.0.2.10')).rejects.toThrow('bare IPv4')
  })

  it('rejects non-identity or non-success responses', async () => {
    const fetchLike = async () => ({ok: false, status: 503, text: async () => identity})
    await expect(createTopologyIdentityClient(fetchLike).query('192.0.2.10')).rejects.toThrow('503')
  })
})

