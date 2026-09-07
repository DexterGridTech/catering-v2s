declare module 'react-test-renderer' {
  import type {ReactElement} from 'react'

  type ReactTestInstance = Readonly<{
    readonly props: Readonly<Record<string, any>>
    readonly type: unknown
    readonly children: readonly unknown[]
    readonly findByProps: (props: Record<string, unknown>) => ReactTestInstance
    readonly findAllByProps: (props: Record<string, unknown>) => readonly ReactTestInstance[]
    readonly findByType: (type: unknown) => ReactTestInstance
    readonly findAllByType: (type: unknown) => readonly ReactTestInstance[]
  }>

  export type ReactTestRenderer = Readonly<{
    readonly root: ReactTestInstance
    readonly unmount: () => void
  }>

  export const act: (callback: () => void) => void
  export const create: (element: ReactElement) => ReactTestRenderer
}
