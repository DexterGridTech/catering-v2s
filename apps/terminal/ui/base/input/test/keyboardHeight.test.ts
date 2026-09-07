import {describe, expect, it} from 'vitest';
import {calculateVirtualKeyboardMetrics, INPUT_LAYOUT_CONSTANTS} from '../src/foundations/keyboardHeight';

const frame = (width: number, height: number) => ({width, height, ready: true as const});

describe('virtual keyboard geometry', () => {
  it('uses the local frame height with the capped ratio and content floor', () => {
    expect(calculateVirtualKeyboardMetrics(frame(1157, 723), 'full')).toMatchObject({
      capacity: 'supported',
      height: 219,
      contentHeight: 504,
      visible: true,
      rowCount: 4,
      cellWidth: 112,
    });
    expect(calculateVirtualKeyboardMetrics(frame(962, 541), 'numeric')).toMatchObject({
      capacity: 'supported',
      height: 219,
      contentHeight: 322,
      visible: true,
      rowCount: 4,
      cellWidth: 310,
    });
  });

  it('fits the outer dock to the active layout row count', () => {
    const metrics = (layout: 'full' | 'financial' | 'numeric' | 'alpha') =>
      calculateVirtualKeyboardMetrics(frame(962, 541), layout);
    expect(metrics('full').height).toBe(219);
    expect(metrics('numeric').height).toBe(219);
    expect(metrics('financial').height).toBe(219);
    expect(metrics('alpha').height).toBe(168);
    expect(metrics('alpha').contentHeight).toBe(373);
    expect(metrics('full').horizontalMode).toBe('dense');
    expect(metrics('numeric').horizontalMode).toBe('standard');
    expect(metrics('full').cellWidth).toBe(92);
    expect(metrics('numeric').cellWidth).toBe(310);
    expect(metrics('financial').cellWidth).toBe(310);
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
    expect(calculateVirtualKeyboardMetrics(frame(320, 541), 'numeric').capacity).toBe('unsupported-width');
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
    expect(calculateVirtualKeyboardMetrics(frame(359, 723), 'full').capacity).toBe('unsupported-width');
    expect(calculateVirtualKeyboardMetrics(frame(360, 723), 'full')).toMatchObject({
      capacity: 'supported',
      cellWidth: INPUT_LAYOUT_CONSTANTS.DENSE_KEY_MIN_WIDTH,
    });
    expect(calculateVirtualKeyboardMetrics(frame(360, 723), 'numeric')).toMatchObject({
      capacity: 'supported',
      cellWidth: 109,
    });
    expect(calculateVirtualKeyboardMetrics(frame(360, 723), 'financial')).toMatchObject({
      capacity: 'supported',
      cellWidth: 109,
      columnCount: 3,
    });
  });
});
