import {describe, expect, it} from 'vitest'
import {createTopologyIdentityClient} from '../src/foundations/createTopologyIdentityClient'

const identity = JSON.stringify({
  type: 'identity',
  protocolVersion: 1,
  moduleName: 'ui.integration.sample-console',
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
    await expect(createTopologyIdentityClient({fetchLike}).query('192.0.2.10')).resolves.toMatchObject({
      type: 'identity',
      nodeId: 'node-2',
      instanceMode: 'MASTER',
    })
  })

  it('rejects a non-bare host before making a request', async () => {
    const fetchLike = async () => {
      throw new Error('must not be called')
    }
    await expect(createTopologyIdentityClient({fetchLike}).query('http://192.0.2.10')).rejects.toThrow('bare IPv4')
  })

  it('rejects non-identity or non-success responses', async () => {
    const fetchLike = async () => ({ok: false, status: 503, text: async () => identity})
    await expect(createTopologyIdentityClient({fetchLike}).query('192.0.2.10')).rejects.toThrow('503')
  })

  it('fails over in configured order and makes the successful address sticky', async () => {
    const calls: string[] = []
    const config = {
      selectedSpace: 'topology',
      spaces: [{
        name: 'topology',
        servers: [{
          serverName: 'topology',
          addresses: [
            {addressName: 'primary', baseUrl: 'http://127.0.0.1:43172/terminal-topology'},
            {addressName: 'backup', baseUrl: 'http://127.0.0.1:43173/terminal-topology'},
          ],
        }],
      }],
    } as const
    const fetchLike = async (url: string) => {
      calls.push(url)
      if (url.includes(':43172')) return {ok: false, status: 503, text: async () => identity}
      return {ok: true, status: 200, text: async () => identity}
    }
    const client = createTopologyIdentityClient({fetchLike, config})
    await expect(client.query('192.0.2.10')).resolves.toMatchObject({nodeId: 'node-2'})
    await expect(client.query('192.0.2.10')).resolves.toMatchObject({nodeId: 'node-2'})
    expect(calls).toEqual([
      'http://192.0.2.10:43172/terminal-topology/status',
      'http://192.0.2.10:43173/terminal-topology/status',
      'http://192.0.2.10:43173/terminal-topology/status',
    ])
  })
})
