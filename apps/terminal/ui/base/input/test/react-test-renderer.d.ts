declare module 'react-test-renderer' {
  type ReactTestInstance = Readonly<{
    readonly props: Readonly<Record<string, any>>
    readonly type: unknown
  }>
  export type ReactTestRenderer = Readonly<{
    readonly root: Readonly<{
      readonly findAllByType: (type: unknown) => readonly ReactTestInstance[]
      readonly findAllByProps: (props: Readonly<Record<string, unknown>>) => readonly ReactTestInstance[]
      readonly findByProps: (props: Readonly<Record<string, unknown>>) => ReactTestInstance
    }>
    readonly unmount: () => void
  }>
  export const act: (callback: () => void) => void
  export const create: (element: import('react').ReactElement) => ReactTestRenderer
}
