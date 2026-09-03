declare module 'react-test-renderer' {
  import type {ReactElement} from 'react'

  type TestInstance = Readonly<{
    readonly props: Readonly<Record<string, unknown>>
    readonly findByType: (type: string) => TestInstance
    readonly findAllByType: (type: string) => readonly TestInstance[]
  }>

  export interface ReactTestRenderer {
    readonly root: TestInstance
    update(element: ReactElement): void
    unmount(): void
  }

  export function act(callback: () => void | Promise<void>): void | Promise<void>
  export function create(element: ReactElement): ReactTestRenderer
}
