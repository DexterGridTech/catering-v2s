declare module 'react-test-renderer' {
  import type {ReactElement} from 'react'

  export type ReactTestRenderer = Readonly<{
    readonly root: Readonly<Record<string, unknown>>
    readonly update: (element: ReactElement) => void
    readonly unmount: () => void
  }>

  export function act(callback: () => void | Promise<void>): void | Promise<void>
  export function create(element: ReactElement | null): ReactTestRenderer
}
