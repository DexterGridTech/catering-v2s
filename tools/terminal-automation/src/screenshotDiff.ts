import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';

export type ScreenshotMask = Readonly<{readonly x: number; readonly y: number; readonly width: number; readonly height: number}>;

const applyMasks = (image: PNG, masks: readonly ScreenshotMask[]): void => {
  for (const mask of masks) {
    if (![mask.x, mask.y, mask.width, mask.height].every(Number.isFinite) || mask.width < 0 || mask.height < 0) {
      throw new Error('TERMINAL_AUTOMATION_SCREENSHOT_MASK_INVALID');
    }
    const left = Math.max(0, Math.floor(mask.x));
    const top = Math.max(0, Math.floor(mask.y));
    const right = Math.min(image.width, Math.ceil(mask.x + mask.width));
    const bottom = Math.min(image.height, Math.ceil(mask.y + mask.height));
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const offset = (y * image.width + x) * 4;
        image.data[offset] = 0;
        image.data[offset + 1] = 0;
        image.data[offset + 2] = 0;
        image.data[offset + 3] = 255;
      }
    }
  }
};

export const compareScreenshots = (
  beforeBytes: Buffer,
  afterBytes: Buffer,
  masks: readonly ScreenshotMask[],
): Readonly<{readonly differentPixels: number; readonly diff: Buffer}> => {
  const before = PNG.sync.read(beforeBytes);
  const after = PNG.sync.read(afterBytes);
  if (before.width !== after.width || before.height !== after.height) {
    throw new Error('TERMINAL_AUTOMATION_SCREENSHOT_DIMENSIONS_DIFFER');
  }
  applyMasks(before, masks);
  applyMasks(after, masks);
  const diff = new PNG({width: before.width, height: before.height});
  const differentPixels = pixelmatch(before.data, after.data, diff.data, before.width, before.height, {
    threshold: 0.1,
    includeAA: false,
  });
  return Object.freeze({differentPixels, diff: PNG.sync.write(diff)});
};
