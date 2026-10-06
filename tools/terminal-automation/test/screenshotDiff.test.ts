import {PNG} from 'pngjs';
import {describe, expect, it} from 'vitest';
import {compareScreenshots, type ScreenshotMask} from '../src/screenshotDiff.ts';

const image = (width: number, height: number, color: readonly [number, number, number, number]): PNG => {
  const png = new PNG({width, height});
  for (let offset = 0; offset < png.data.length; offset += 4) {
    png.data.set(color, offset);
  }
  return png;
};

const encoded = (png: PNG): Buffer => PNG.sync.write(png);

describe('automation screenshot comparison', () => {
  it('ignores only explicitly masked runtime-value pixels', () => {
    const before = image(4, 2, [255, 255, 255, 255]);
    const after = image(4, 2, [255, 255, 255, 255]);
    after.data.set([0, 0, 0, 255], 0);
    const mask: ScreenshotMask = {x: 0, y: 0, width: 1, height: 1};

    const result = compareScreenshots(encoded(before), encoded(after), [mask]);

    expect(result.differentPixels).toBe(0);
  });

  it('detects one visible-pixel mutation outside the mask', () => {
    const before = image(4, 2, [255, 255, 255, 255]);
    const after = image(4, 2, [255, 255, 255, 255]);
    after.data.set([0, 0, 0, 255], 4 * 5);

    const result = compareScreenshots(encoded(before), encoded(after), [{x: 0, y: 0, width: 1, height: 1}]);

    expect(result.differentPixels).toBe(1);
  });

  it('fails when a changed dynamic pixel is not covered by the declared mask', () => {
    const before = image(4, 2, [255, 255, 255, 255]);
    const after = image(4, 2, [255, 255, 255, 255]);
    after.data.set([0, 0, 0, 255], 0);

    const result = compareScreenshots(encoded(before), encoded(after), [{x: 2, y: 1, width: 1, height: 1}]);

    expect(result.differentPixels).toBe(1);
  });

  it('rejects differing screenshot dimensions before pixel comparison', () => {
    expect(() => compareScreenshots(encoded(image(4, 2, [0, 0, 0, 255])), encoded(image(3, 2, [0, 0, 0, 255])), []))
      .toThrow('TERMINAL_AUTOMATION_SCREENSHOT_DIMENSIONS_DIFFER');
  });
});
