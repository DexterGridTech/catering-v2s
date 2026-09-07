import {LegacyEventEmitter, requireNativeModule, type EventSubscription} from 'expo-modules-core'

export type AndroidImeInsetsSnapshot = Readonly<{
  readonly displayIndex: 0 | 1
  readonly displayId: number
  readonly windowIdentity: 'primary' | 'secondary'
  readonly visible: boolean
  readonly bottomPx: number
  readonly bottomLogical: number
}>

type NativeDualScreenModule = Readonly<{
  readonly addListener: (eventName: string) => unknown
  readonly getImeInsetsSnapshot: (displayIndex: number) => Promise<AndroidImeInsetsSnapshot | null>
}>

const eventName = 'onImeInsetsChanged'

const getNativeModule = (): NativeDualScreenModule =>
  requireNativeModule<NativeDualScreenModule>('TerminalDualScreen')

export const createAndroidImeInsetsSource = (displayIndex: 0 | 1) => {
  let current: AndroidImeInsetsSnapshot | null = null
  let emitter: LegacyEventEmitter | null = null

  const getEmitter = () => {
    if (emitter === null) emitter = new LegacyEventEmitter(getNativeModule())
    return emitter
  }

  return Object.freeze({
    getSnapshot: () => current,
    subscribe: (listener: (snapshot: AndroidImeInsetsSnapshot) => void): (() => void) => {
      const native = getNativeModule()
      const update = (snapshot: AndroidImeInsetsSnapshot) => {
        if (snapshot.displayIndex !== displayIndex) return
        current = snapshot
        listener(snapshot)
      }
      const subscription = getEmitter().addListener<AndroidImeInsetsSnapshot>(eventName, update) as EventSubscription
      void native.getImeInsetsSnapshot(displayIndex).then((snapshot) => {
        if (snapshot !== null) update(snapshot)
      }).catch((error: unknown) => {
        const errorName = error instanceof Error ? error.name : 'UnknownError'
        console.error(
          `[TerminalDualScreen] ime snapshot unavailable displayIndex=${displayIndex} error=${errorName}`,
        )
      })
      return () => subscription.remove()
    },
  })
}
