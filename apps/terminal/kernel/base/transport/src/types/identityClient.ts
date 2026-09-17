import type {TopologyIdentityResponse} from '@catering-v2s/kernel-base-contracts'

export type TopologyIdentityClient = Readonly<{
  readonly query: (host: string) => Promise<TopologyIdentityResponse>
}>

