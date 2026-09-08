export type SurfaceHostSize = Readonly<{
  readonly width: number
  readonly height: number
}>

export type SurfaceCanvasDeclaration = SurfaceHostSize

export type SurfaceHostImeSnapshot = Readonly<{
  readonly visible: boolean
  readonly bottomLogicalBeforeCanvasScale: number
}>

export type SurfaceHostSnapshot = Readonly<{
  readonly stableHostLogicalSize: SurfaceHostSize
  /** Insets are already in the target window's logical unit, before canvas scale. */
  readonly ime?: SurfaceHostImeSnapshot
}>

export type SurfaceHostSource = Readonly<{
  readonly getSnapshot: () => SurfaceHostSnapshot | null
  readonly subscribe: (listener: (snapshot: SurfaceHostSnapshot | null) => void) => () => void
}>

export type SurfaceHostGeometry = Readonly<{
  readonly canvas: SurfaceCanvasDeclaration
  readonly host: SurfaceHostSize
  readonly scaleX: number
  readonly scaleY: number
}>

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0

export const calculateSurfaceHostImeInset = (input: Readonly<{
  readonly ime?: SurfaceHostImeSnapshot
  readonly scaleY: number
}>): number | null => {
  if (input.ime === undefined || !input.ime.visible) return 0
  if (!isPositiveFinite(input.scaleY)) return null
  if (!Number.isFinite(input.ime.bottomLogicalBeforeCanvasScale) || input.ime.bottomLogicalBeforeCanvasScale < 0) {
    return null
  }
  return input.ime.bottomLogicalBeforeCanvasScale / input.scaleY
}

export const calculateSurfaceHostGeometry = (input: Readonly<{
  readonly canvas: SurfaceCanvasDeclaration
  readonly snapshot: SurfaceHostSnapshot | null
}>): SurfaceHostGeometry | null => {
  const canvas = input.canvas
  const host = input.snapshot?.stableHostLogicalSize
  if (
    host === undefined
    || !isPositiveFinite(canvas.width)
    || !isPositiveFinite(canvas.height)
    || !isPositiveFinite(host.width)
    || !isPositiveFinite(host.height)
  ) return null

  return Object.freeze({
    canvas,
    host,
    scaleX: host.width / canvas.width,
    scaleY: host.height / canvas.height,
  })
}
