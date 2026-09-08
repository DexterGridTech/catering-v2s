import {describe, expect, it} from 'vitest';
import {calculateVirtualKeyboardMetrics, INPUT_LAYOUT_CONSTANTS} from '../src/foundations/keyboardHeight';

const frame = (width: number, height: number) => ({width, height, ready: true as const});
const PRIMARY_FRAME = frame(1280, 800);
const SECONDARY_FRAME = frame(960, 540);
const GENERIC_FRAME = frame(960, 540);

describe('virtual keyboard geometry', () => {
  it('uses the local frame height with the capped ratio and content floor', () => {
    expect(calculateVirtualKeyboardMetrics(PRIMARY_FRAME, 'full')).toMatchObject({
      capacity: 'supported',
      height: 219,
      contentHeight: 581,
      visible: true,
      rowCount: 4,
      cellWidth: 124,
    });
    expect(calculateVirtualKeyboardMetrics(SECONDARY_FRAME, 'numeric')).toMatchObject({
      capacity: 'supported',
      height: 219,
      contentHeight: 321,
      visible: true,
      rowCount: 4,
      cellWidth: 309,
    });
  });

  it('fits the outer dock to the active layout row count', () => {
    const metrics = (layout: 'full' | 'financial' | 'numeric' | 'alpha') =>
      calculateVirtualKeyboardMetrics(GENERIC_FRAME, layout);
    expect(metrics('full').height).toBe(219);
    expect(metrics('numeric').height).toBe(219);
    expect(metrics('financial').height).toBe(219);
    expect(metrics('alpha').height).toBe(168);
    expect(metrics('alpha').contentHeight).toBe(372);
    expect(metrics('full').horizontalMode).toBe('dense');
    expect(metrics('numeric').horizontalMode).toBe('standard');
    expect(metrics('full').cellWidth).toBe(92);
    expect(metrics('numeric').cellWidth).toBe(309);
    expect(metrics('financial').cellWidth).toBe(309);
    expect(metrics('numeric').rowCount).toBe(4);
    expect(metrics('financial').rowCount).toBe(4);
  });

  it('keeps the first frame unmeasured and never guesses a dock', () => {
    expect(calculateVirtualKeyboardMetrics(null, 'numeric')).toMatchObject({
      capacity: 'unmeasured',
      height: 0,
      visible: false,
    });
  });

  it('classifies insufficient width and height separately', () => {
    expect(calculateVirtualKeyboardMetrics(frame(320, 540), 'numeric').capacity).toBe('unsupported-width');
    expect(calculateVirtualKeyboardMetrics(frame(360, 300), 'numeric')).toMatchObject({
      capacity: 'unsupported-height',
      height: 92,
      contentHeight: 208,
      visible: false,
      contentTooSmall: true,
    });
    expect(calculateVirtualKeyboardMetrics(frame(360, 350), 'alpha')).toMatchObject({
      capacity: 'unsupported-height',
      height: 142,
      contentHeight: 208,
      visible: false,
      contentTooSmall: true,
    });
  });

  it('classifies horizontal capacity using dense and standard tokens', () => {
    expect(calculateVirtualKeyboardMetrics(frame(359, 720), 'full').capacity).toBe('unsupported-width');
    expect(calculateVirtualKeyboardMetrics(frame(360, 720), 'full')).toMatchObject({
      capacity: 'supported',
      cellWidth: INPUT_LAYOUT_CONSTANTS.DENSE_KEY_MIN_WIDTH,
    });
    expect(calculateVirtualKeyboardMetrics(frame(360, 720), 'numeric')).toMatchObject({
      capacity: 'supported',
      cellWidth: 109,
    });
    expect(calculateVirtualKeyboardMetrics(frame(360, 720), 'financial')).toMatchObject({
      capacity: 'supported',
      cellWidth: 109,
      columnCount: 3,
    });
  });
});
