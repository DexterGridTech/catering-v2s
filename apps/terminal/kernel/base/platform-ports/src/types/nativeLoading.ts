export type NativeLoadingHideResult = Readonly<{
  readonly hidden: boolean
  readonly alreadyHidden: boolean
  readonly reason: string
}>

export type NativeLoadingTarget = Readonly<{
  readonly surfaceKey: 'PRIMARY'
  readonly displayIndex: 0
}>

/** The only bridge from rendered readiness/failure to the Android splash owner. */
export type NativeLoadingCapability = Readonly<{
  readonly targetPhysicalSurface: NativeLoadingTarget
  readonly hideOnce: (reason: string) => Promise<NativeLoadingHideResult>
}>
