export type TopologyPeerChannelEvent =
  | Readonly<{readonly type: 'open'; readonly connectionId?: string}>
  | Readonly<{readonly type: 'message'; readonly raw: string; readonly connectionId?: string}>
  | Readonly<{readonly type: 'close'; readonly reason?: string; readonly connectionId?: string}>
  | Readonly<{readonly type: 'error'; readonly reason?: string; readonly connectionId?: string}>

export type TopologyPeerChannel = Readonly<{
  readonly subscribe: (listener: (event: TopologyPeerChannelEvent) => void) => () => void
  readonly listen: () => void
  readonly connect: (url: string) => Promise<void>
  readonly send: (raw: string) => Promise<void>
  readonly close: (reason?: string) => Promise<void>
  readonly dispose: () => Promise<void>
}>
