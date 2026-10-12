export type RemoteControlPoint = Readonly<{u: number; v: number}>;

export function normalizedVideoPoint(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
  frame: Readonly<{width: number; height: number}>,
): RemoteControlPoint | null {
  if (rect.width <= 0 || rect.height <= 0 || frame.width <= 0 || frame.height <= 0) return null;
  const scale = Math.min(rect.width / frame.width, rect.height / frame.height);
  const width = frame.width * scale;
  const height = frame.height * scale;
  const left = rect.left + (rect.width - width) / 2;
  const top = rect.top + (rect.height - height) / 2;
  if (clientX < left || clientX > left + width || clientY < top || clientY > top + height) return null;
  return Object.freeze({u: (clientX - left) / width, v: (clientY - top) / height});
}
