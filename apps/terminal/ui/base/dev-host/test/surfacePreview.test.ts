import {describe, expect, it} from 'vitest';
import {calculateSurfacePreviewGeometry, SURFACE_PREVIEW_CONSTANTS} from '../src/foundations/surfacePreview';

const primary = {width: 1920, height: 1080};
const secondary = {width: 1024, height: 600};

describe('surface preview geometry', () => {
  it('fits one column surface by available viewport width without changing logical dimensions', () => {
    const geometry = calculateSurfacePreviewGeometry({
      layout: 'column',
      scaleToFit: true,
      showSecondary: false,
      viewportWidth: 1300,
      primary,
      secondary,
    });

    const availableWidth =
      1300 - 2 * SURFACE_PREVIEW_CONSTANTS.canvasBorder - 2 * SURFACE_PREVIEW_CONSTANTS.stagePadding;
    expect(geometry).toMatchObject({
      stageWidth: 1920,
      stageHeight: 1080,
      scale: availableWidth / 1920,
      renderedWidth: availableWidth,
      renderedHeight: 1080 * (availableWidth / 1920),
    });
  });

  it('uses one shared scale for two column surfaces', () => {
    const geometry = calculateSurfacePreviewGeometry({
      layout: 'column',
      scaleToFit: true,
      showSecondary: true,
      viewportWidth: 1300,
      primary,
      secondary,
    });

    expect(geometry).toMatchObject({
      stageWidth: 1920,
      stageHeight: 1080 + SURFACE_PREVIEW_CONSTANTS.surfaceGap + 600,
    });
    expect(geometry?.renderedWidth).toBeLessThanOrEqual(1300 - 2 * SURFACE_PREVIEW_CONSTANTS.canvasBorder);
  });

  it('uses combined logical width for two row surfaces', () => {
    const geometry = calculateSurfacePreviewGeometry({
      layout: 'row',
      scaleToFit: true,
      showSecondary: true,
      viewportWidth: 1200,
      primary,
      secondary,
    });

    expect(geometry).toMatchObject({
      stageWidth: 1920 + SURFACE_PREVIEW_CONSTANTS.surfaceGap + 1024,
      stageHeight: 1080,
    });
    expect(geometry?.renderedWidth).toBe(
      1200 - 2 * SURFACE_PREVIEW_CONSTANTS.canvasBorder - 2 * SURFACE_PREVIEW_CONSTANTS.stagePadding,
    );
  });

  it('keeps scale at one when scaleToFit is disabled', () => {
    expect(
      calculateSurfacePreviewGeometry({
        layout: 'row',
        scaleToFit: false,
        showSecondary: true,
        viewportWidth: 1200,
        primary,
        secondary,
      }),
    ).toMatchObject({
      scale: 1,
      renderedWidth: 1920 + SURFACE_PREVIEW_CONSTANTS.surfaceGap + 1024,
      renderedHeight: 1080,
    });
  });

  it('does not upscale a logical surface when the viewport is wider than the target', () => {
    expect(
      calculateSurfacePreviewGeometry({
        layout: 'column',
        scaleToFit: true,
        showSecondary: false,
        viewportWidth: 2400,
        primary,
        secondary,
      }),
    ).toMatchObject({
      scale: 1,
      renderedWidth: 1920,
      renderedHeight: 1080,
    });
  });

  it('does not render a stage before a positive viewport measurement exists', () => {
    expect(
      calculateSurfacePreviewGeometry({
        layout: 'column',
        scaleToFit: true,
        showSecondary: false,
        viewportWidth: 0,
        primary,
        secondary,
      }),
    ).toBeNull();
  });
});
