import type {SurfaceForm, TopologyIdentity, TopologyLocator, TopologyPayloadFailure} from '@catering-v2s/kernel-base-contracts'
import type {TopologyHostState} from '@catering-v2s/kernel-base-platform-ports'

export type TopologyState = Readonly<{
  readonly nodeId: string
  readonly displayName: string
  readonly surfaceForm: SurfaceForm
  readonly displayCount: number | null
  readonly masterLocator: TopologyLocator | null
  readonly peerIdentity: TopologyIdentity | null
  readonly peerReachable: boolean
  readonly peerConnectionRevision: number
  readonly hostDesired: boolean
  readonly hostActual: TopologyHostState
  readonly hostErrorCode: string | null
  readonly payloadFailure: TopologyPayloadFailure | null
  readonly revision: number
  readonly repairPending: boolean
}>
