import type {SurfaceForm, TopologyIdentity, TopologyLocalAddress, TopologyLocator, TopologyPayloadFailure} from '@catering-v2s/kernel-base-contracts'
import type {TopologyHostState} from '@catering-v2s/kernel-base-platform-ports'

export type TopologyState = Readonly<{
  readonly nodeId: string
  readonly displayName: string
  readonly surfaceForm: SurfaceForm
  readonly displayCount: number | null
  readonly masterLocator: TopologyLocator | null
  readonly peerIdentity: TopologyIdentity | null
  readonly hostAddress: TopologyLocalAddress | null
  readonly peerReachable: boolean
  readonly peerConnectionRevision: number
  readonly hostDesired: boolean
  /** In-memory command signal; it is not a persisted business fact. */
  readonly hostReconcileRevision: number
  readonly hostActual: TopologyHostState
  readonly hostErrorCode: string | null
  readonly payloadFailure: TopologyPayloadFailure | null
  readonly revision: number
  readonly repairPending: boolean
}>
