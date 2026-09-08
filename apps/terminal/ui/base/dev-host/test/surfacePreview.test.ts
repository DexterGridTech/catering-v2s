import {describe, expect, it} from 'vitest';
import {
  calculateSurfacePreviewGeometry,
  mapLogicalPointToPreviewClientPoint,
  SURFACE_PREVIEW_CONSTANTS,
} from '../src/foundations/surfacePreview';

const primary = {width: 1920, height: 1080};
const secondary = {width: 1024, height: 600};

describe('surface preview geometry', () => {
  it('fits one column surface by available viewport width without changing logical dimensions', () => {
    const geometry = calculateSurfacePreviewGeometry({
      layout: 'column',
      showSecondary: false,
      viewport: {width: 1276, height: 900},
      primary,
      secondary,
    });

    expect(geometry).toMatchObject({
      stageWidth: 1920,
      stageHeight: 1080,
      scaleX: 1276 / 1920,
      scaleY: 1276 / 1920,
      renderedWidth: 1276,
      renderedHeight: 1080 * (1276 / 1920),
    });
  });

  it('uses one shared scale for two column surfaces', () => {
    const geometry = calculateSurfacePreviewGeometry({
      layout: 'column',
      showSecondary: true,
      viewport: {width: 1276, height: 900},
      primary,
      secondary,
    });

    expect(geometry).toMatchObject({
      stageWidth: 1920,
      stageHeight: 1080 + SURFACE_PREVIEW_CONSTANTS.surfaceGap + 600,
    });
    expect(geometry?.renderedWidth).toBeLessThanOrEqual(1276);
  });

  it('uses combined logical width for two row surfaces', () => {
    const geometry = calculateSurfacePreviewGeometry({
      layout: 'row',
      showSecondary: true,
      viewport: {width: 1200, height: 800},
      primary,
      secondary,
    });

    expect(geometry).toMatchObject({
      stageWidth: 1920 + SURFACE_PREVIEW_CONSTANTS.surfaceGap + 1024,
      stageHeight: 1080,
    });
    expect(geometry?.renderedWidth).toBe(
      1200,
    );
  });

  it('fills width instead of retaining an obsolete unscaled preview mode', () => {
    expect(
      calculateSurfacePreviewGeometry({
        layout: 'row',
        showSecondary: true,
      viewport: {width: 1200, height: 800},
        primary,
        secondary,
      }),
    ).toMatchObject({
      scaleX: 1200 / (1920 + SURFACE_PREVIEW_CONSTANTS.surfaceGap + 1024),
      scaleY: 1200 / (1920 + SURFACE_PREVIEW_CONSTANTS.surfaceGap + 1024),
      renderedWidth: 1200,
      renderedHeight: 1080 * (1200 / (1920 + SURFACE_PREVIEW_CONSTANTS.surfaceGap + 1024)),
    });
  });

  it('fills a wider viewport while preserving the logical stage ratio', () => {
    expect(
      calculateSurfacePreviewGeometry({
        layout: 'column',
        showSecondary: false,
        viewport: {width: 2400, height: 1200},
        primary,
        secondary,
      }),
    ).toMatchObject({
      scaleX: 2400 / 1920,
      scaleY: 2400 / 1920,
      renderedWidth: 2400,
      renderedHeight: 1080 * (2400 / 1920),
    });
  });

  it('does not render a stage before a positive viewport measurement exists', () => {
    expect(
      calculateSurfacePreviewGeometry({
        layout: 'column',
        showSecondary: false,
        viewport: {width: 0, height: 1},
        primary,
        secondary,
      }),
    ).toBeNull();
  });

  it('maps a logical point into the current preview client coordinate system', () => {
    expect(
      mapLogicalPointToPreviewClientPoint({
        logicalPoint: {x: 100, y: 200},
        previewRect: {left: 40, top: 30},
        scaleX: 0.75,
        scaleY: 0.5,
      }),
    ).toEqual({x: 115, y: 130});
    expect(
      mapLogicalPointToPreviewClientPoint({
        logicalPoint: {x: 100, y: 200},
        previewRect: {left: 40, top: 30},
        scaleX: 0,
        scaleY: 0.5,
      }),
    ).toBeNull();
  });
});
