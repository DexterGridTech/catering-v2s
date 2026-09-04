declare module 'react-test-renderer' {
  import type {ReactElement} from 'react'

  type TestInstance = Readonly<{
    readonly type: unknown
    readonly props: Readonly<Record<string, unknown>>
    readonly children: readonly unknown[]
    readonly findByProps: (props: Record<string, unknown>) => TestInstance
    readonly findAllByProps: (props: Record<string, unknown>) => readonly TestInstance[]
  }>

  export type ReactTestRenderer = {
    readonly root: TestInstance
    readonly unmount: () => void
  }

  export const act: (callback: () => void) => void
  export const create: (element: ReactElement | null) => ReactTestRenderer
}
