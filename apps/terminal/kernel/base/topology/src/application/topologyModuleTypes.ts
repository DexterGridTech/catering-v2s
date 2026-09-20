import type {RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime'

export type TopologyPeerLog = (
  context: RuntimeModuleContext,
  event: string,
  ...optional: readonly [
    data?: Readonly<Record<string, string | number | boolean | null>>,
    connectionId?: string,
  ]
) => void
