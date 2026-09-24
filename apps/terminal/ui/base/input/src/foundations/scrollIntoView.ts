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
  readonly maxScroll: number
  readonly surfaceHeight: number
  readonly keyboardHeight: number
  readonly presentationOffsetY: number
}>

export type VisibleVerticalIntersection = Readonly<{
  readonly top: number
  readonly bottom: number
}>

export const calculatePresentationOffsetY = (
  focusRect: LayoutRect,
  surfaceHeight: number,
  keyboardHeight: number,
): number => {
  if (
    !Number.isFinite(focusRect.y)
    || !Number.isFinite(focusRect.height)
    || !Number.isFinite(surfaceHeight)
    || !Number.isFinite(keyboardHeight)
    || surfaceHeight <= 0
    || keyboardHeight <= 0
  ) return 0
  const boundedKeyboardHeight = Math.min(surfaceHeight, keyboardHeight)
  const centerY = focusRect.y + focusRect.height / 2
  const centerLine = (surfaceHeight - boundedKeyboardHeight) / 2
  const upwardOffset = Math.min(boundedKeyboardHeight, Math.max(0, centerY - centerLine))
  return upwardOffset === 0 ? 0 : -upwardOffset
}

export const visibleVerticalIntersectionOf = (input: Readonly<{
  readonly viewportRect: LayoutRect
  readonly surfaceHeight: number
  readonly keyboardHeight: number
  readonly presentationOffsetY: number
}>): VisibleVerticalIntersection => ({
  top: Math.max(0, input.viewportRect.y + input.presentationOffsetY),
  bottom: Math.min(
    Math.max(0, input.surfaceHeight - input.keyboardHeight),
    input.viewportRect.y + input.presentationOffsetY + input.viewportRect.height,
  ),
})

export const isRectInsideVisibleVerticalIntersection = (
  rect: LayoutRect,
  intersection: VisibleVerticalIntersection,
): boolean => intersection.bottom > intersection.top
  && rect.y >= intersection.top
  && rect.y + rect.height <= intersection.bottom

/**
 * Returns the smallest non-negative offset change that makes the whole input visible.
 * The native/web scroll host clamps a target beyond its content end to its legal maximum.
 */
export const calculateScrollOffset = ({
  inputRect,
  viewportRect,
  currentOffset,
  maxScroll,
  surfaceHeight,
  keyboardHeight,
  presentationOffsetY,
}: ScrollIntoViewInput): number => {
  const intersection = visibleVerticalIntersectionOf({
    viewportRect,
    surfaceHeight,
    keyboardHeight: Math.max(0, keyboardHeight),
    presentationOffsetY,
  })
  if (intersection.bottom <= intersection.top) return currentOffset

  const displayedTop = inputRect.y + presentationOffsetY
  const displayedBottom = displayedTop + inputRect.height
  const delta = displayedTop < intersection.top
    ? displayedTop - intersection.top
    : displayedBottom > intersection.bottom
      ? displayedBottom - intersection.bottom
      : 0
  return Math.min(Math.max(0, maxScroll), Math.max(0, currentOffset + delta))
}
