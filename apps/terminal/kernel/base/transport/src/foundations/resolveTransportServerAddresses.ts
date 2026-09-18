import type {
  ResolveTransportServerConfigOptions,
  TransportServerAddress,
  TransportServerDefinition,
  TransportServerConfig,
} from '@catering-v2s/kernel-base-contracts'

export type ResolvedTransportServerAddress = Readonly<{
  readonly serverName: string
  readonly addressName: string
  readonly baseUrl: string
  readonly timeoutMs?: number
}>

export type TransportAddressSelector = Readonly<{
  readonly resolve: (options?: ResolveTransportServerConfigOptions) => readonly ResolvedTransportServerAddress[]
  readonly markSuccessful: (addressName: string) => void
  readonly clearPreferred: () => void
}>

const readServer = (config: TransportServerConfig, options: ResolveTransportServerConfigOptions, serverName: string): TransportServerDefinition => {
  const selectedSpace = options.selectedSpace ?? config.selectedSpace
  const space = config.spaces.find(candidate => candidate.name === selectedSpace)
  if (space === undefined) throw new Error(`transport config space is unavailable: ${selectedSpace}`)
  const server = space.servers.find(candidate => candidate.serverName === serverName)
  if (server === undefined) throw new Error(`transport server is unavailable: ${serverName}`)
  return server
}

const overrideAddresses = (
  server: TransportServerDefinition,
  options: ResolveTransportServerConfigOptions,
): readonly TransportServerAddress[] => {
  const override = options.serverOverrides?.[server.serverName]
  if (override?.addresses === undefined) return server.addresses
  return override.addresses.map((address, index) => {
    const inherited = server.addresses[index]
    return Object.freeze({
      addressName: address.addressName ?? inherited?.addressName ?? `override-${index + 1}`,
      baseUrl: address.baseUrl,
      timeoutMs: address.timeoutMs ?? inherited?.timeoutMs,
    })
  })
}

const applyBaseUrlOverride = (
  address: TransportServerAddress,
  options: ResolveTransportServerConfigOptions,
): TransportServerAddress => Object.freeze({
  ...address,
  baseUrl: options.baseUrlOverrides?.[address.addressName] ?? address.baseUrl,
})

const reorderPreferred = (
  addresses: readonly ResolvedTransportServerAddress[],
  preferredAddressName: string | undefined,
): readonly ResolvedTransportServerAddress[] => {
  if (preferredAddressName === undefined) return addresses
  const preferred = addresses.find(address => address.addressName === preferredAddressName)
  if (preferred === undefined) return addresses
  return [preferred, ...addresses.filter(address => address !== preferred)]
}

export const createTransportAddressSelector = (
  config: TransportServerConfig,
  serverName: string,
): TransportAddressSelector => {
  let preferredAddressName: string | undefined
  return Object.freeze({
    resolve: (options: ResolveTransportServerConfigOptions = {}): readonly ResolvedTransportServerAddress[] => {
      const server = readServer(config, options, serverName)
      const addresses = overrideAddresses(server, options)
        .map(address => applyBaseUrlOverride(address, options))
        .map(address => Object.freeze({...address, serverName}))
      if (addresses.length === 0) throw new Error(`transport server has no addresses: ${serverName}`)
      return reorderPreferred(addresses, preferredAddressName)
    },
    markSuccessful: (addressName: string): void => {
      preferredAddressName = addressName
    },
    clearPreferred: (): void => {
      preferredAddressName = undefined
    },
  })
}
