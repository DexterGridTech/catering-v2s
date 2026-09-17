import {parseTopologyIdentityResponse, type TopologyIdentityResponse} from '@catering-v2s/kernel-base-contracts'
import type {TopologyIdentityClient} from '../types/identityClient'

type FetchResponse = Readonly<{
  readonly ok: boolean
  readonly status: number
  readonly text: () => Promise<string>
}>

type FetchLike = (input: string, init: Readonly<{readonly method: 'GET'}>) => Promise<FetchResponse>

const readFetch = (): FetchLike => {
  const candidate = (globalThis as unknown as {readonly fetch?: FetchLike}).fetch
  if (typeof candidate !== 'function') throw new Error('Topology identity HTTP client is unavailable')
  return candidate
}

const normalizeHost = (host: string): string => {
  const value = host.trim()
  if (value.length === 0 || value.includes('/') || value.includes(':')) {
    throw new Error('Topology host must be a bare IPv4 or hostname')
  }
  return value
}

const readIdentity = (response: FetchResponse, raw: string): TopologyIdentityResponse => {
  if (!response.ok) throw new Error(`Topology identity request failed: ${response.status}`)
  return parseTopologyIdentityResponse(raw)
}

export const createTopologyIdentityClient = (fetchLike?: FetchLike): TopologyIdentityClient => Object.freeze({
  query: async (host: string): Promise<TopologyIdentityResponse> => {
    const response = await (fetchLike ?? readFetch())(
      `http://${normalizeHost(host)}:43172/terminal-topology/status`,
      {method: 'GET'},
    )
    return readIdentity(response, await response.text())
  },
})

