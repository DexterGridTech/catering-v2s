declare module 'react-test-renderer' {
  import type {ReactElement} from 'react'

  type TestInstance = Readonly<{
    readonly children?: readonly unknown[]
    readonly props: Readonly<Record<string, unknown>>
  }>

  export type ReactTestRenderer = Readonly<{
    readonly root: {
      readonly findByProps: (props: Readonly<Record<string, unknown>>) => TestInstance
      readonly findAllByProps: (props: Readonly<Record<string, unknown>>) => readonly TestInstance[]
    }
    readonly unmount: () => void
  }>

  export const act: (callback: () => void) => void
  export const create: (element: ReactElement) => ReactTestRenderer
}
