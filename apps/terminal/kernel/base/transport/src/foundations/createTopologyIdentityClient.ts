import {
  parseTopologyIdentityResponse,
  topologyTransportServerConfig,
  type TopologyIdentityResponse,
  type TransportServerConfig,
} from '@catering-v2s/kernel-base-contracts'
import type {TopologyIdentityClient} from '../types/identityClient'
import {createTransportAddressSelector} from './resolveTransportServerAddresses'

type FetchResponse = Readonly<{
  readonly ok: boolean
  readonly status: number
  readonly text: () => Promise<string>
}>

export type FetchLike = (input: string, init: Readonly<{readonly method: 'GET'}>) => Promise<FetchResponse>

export type CreateTopologyIdentityClientOptions = Readonly<{
  readonly config?: TransportServerConfig
  readonly fetchLike?: FetchLike
}>

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

const replaceHost = (baseUrl: string, host: string): string => {
  const url = new URL(baseUrl)
  url.hostname = host
  return url.toString().replace(/\/$/, '')
}

export const createTopologyIdentityClient = (
  options: CreateTopologyIdentityClientOptions = {},
): TopologyIdentityClient => {
  const selector = createTransportAddressSelector(options.config ?? topologyTransportServerConfig, 'topology')
  return Object.freeze({
    query: async (host: string): Promise<TopologyIdentityResponse> => {
      const normalizedHost = normalizeHost(host)
      let lastError: unknown
      for (const address of selector.resolve()) {
        try {
          const response = await (options.fetchLike ?? readFetch())(
            `${replaceHost(address.baseUrl, normalizedHost)}/status`,
            {method: 'GET'},
          )
          const identity = readIdentity(response, await response.text())
          selector.markSuccessful(address.addressName)
          return identity
        } catch (error) {
          lastError = error
        }
      }
      throw lastError instanceof Error ? lastError : new Error('Topology identity request failed')
    },
  })
}
