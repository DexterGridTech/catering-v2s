declare module 'react-test-renderer' {
  import type {ReactElement} from 'react'

  type TestInstance = Readonly<{
    readonly type: unknown
    readonly props: Readonly<Record<string, unknown>> & Readonly<{
      readonly onLayout: (event: unknown) => unknown
      readonly children: unknown
    }>
    readonly children: readonly unknown[]
    readonly findByType: (type: string) => TestInstance
    readonly findAllByType: (type: string) => readonly TestInstance[]
    readonly findAll: (predicate: (instance: TestInstance) => boolean) => readonly TestInstance[]
    readonly findByProps: (props: Readonly<Record<string, unknown>>) => TestInstance
    readonly findAllByProps: (props: Readonly<Record<string, unknown>>) => readonly TestInstance[]
  }>

  export interface ReactTestRenderer {
    readonly root: TestInstance
    update(element: ReactElement): void
    unmount(): void
  }

  export function act(callback: () => void | Promise<void>): void | Promise<void>
  export function create(element: ReactElement): ReactTestRenderer
}
