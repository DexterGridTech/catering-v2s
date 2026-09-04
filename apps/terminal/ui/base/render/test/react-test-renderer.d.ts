declare module 'react-test-renderer' {
  import type {ReactElement} from 'react'

  type TestInstance = Readonly<{
    readonly type: unknown
    readonly props: Readonly<Record<string, unknown>>
    readonly children: readonly unknown[]
    readonly findByType: (type: string) => TestInstance
    readonly findAllByType: (type: string) => readonly TestInstance[]
    readonly findAll: (predicate: (instance: TestInstance) => boolean) => readonly TestInstance[]
  }>

  export interface ReactTestRenderer {
    readonly root: TestInstance
    update(element: ReactElement): void
    unmount(): void
  }

  export function act(callback: () => void | Promise<void>): void | Promise<void>
  export function create(element: ReactElement): ReactTestRenderer
}
