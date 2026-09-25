declare module 'react-test-renderer' {
  import type {ReactElement} from 'react'

  type TestInstance = Readonly<{
    readonly type: unknown
    readonly props: Readonly<Record<string, unknown>>
    readonly children: readonly unknown[]
    readonly findByProps: (props: Record<string, unknown>) => TestInstance
    readonly findAllByProps: (props: Record<string, unknown>) => readonly TestInstance[]
    readonly findAll: (predicate: (node: TestInstance) => boolean) => readonly TestInstance[]
    readonly findByType: (type: unknown) => TestInstance
    readonly findAllByType: (type: unknown) => readonly TestInstance[]
  }>

  export type ReactTestRenderer = {
    readonly root: TestInstance
    unmount(): void
  }

  export function act(callback: () => void): void
  export function create(element: ReactElement | null): ReactTestRenderer
}
