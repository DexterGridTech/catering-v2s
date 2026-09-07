export type LayoutRect = Readonly<{
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}>

export type ScrollIntoViewInput = Readonly<{
  readonly inputRect: LayoutRect
  readonly viewportRect: LayoutRect
  readonly currentOffset: number
  readonly keyboardHeight: number
  /** The InputSurfaceFrame has already shrunk this viewport for its keyboard sibling/inset. */
  readonly viewportAlreadyShrunk: boolean
}>

/**
 * Returns the smallest non-negative offset change that makes the whole input visible.
 * The native/web scroll host clamps a target beyond its content end to its legal maximum.
 */
export const calculateScrollOffset = ({
  inputRect,
  viewportRect,
  currentOffset,
  keyboardHeight,
  viewportAlreadyShrunk,
}: ScrollIntoViewInput): number => {
  const visibleTop = viewportRect.y
  const visibleBottom = viewportRect.y + viewportRect.height
    - (viewportAlreadyShrunk ? 0 : Math.max(0, keyboardHeight))
  const inputBottom = inputRect.y + inputRect.height
  const delta = inputRect.y < visibleTop
    ? inputRect.y - visibleTop
    : inputBottom > visibleBottom
      ? inputBottom - visibleBottom
      : 0
  return Math.max(0, currentOffset + delta)
}
