import {describe, expect, it} from 'vitest';
import {calculateVirtualKeyboardDockWidth, calculateVirtualKeyboardMetrics, INPUT_LAYOUT_CONSTANTS} from '../src/foundations/keyboardHeight';

const frame = (width: number, height: number) => ({width, height, ready: true as const});
const PRIMARY_FRAME = frame(1280, 800);
const SECONDARY_FRAME = frame(960, 540);
const GENERIC_FRAME = frame(960, 540);

describe('virtual keyboard geometry', () => {
  it('insets wide keyboard cards without making the 360-unit mobile layout unsupported', () => {
    expect(calculateVirtualKeyboardDockWidth(1280, 'full')).toBe(820);
    expect(calculateVirtualKeyboardDockWidth(1280, 'numeric')).toBe(560);
    expect(calculateVirtualKeyboardDockWidth(640, 'alpha')).toBe(608);
    expect(calculateVirtualKeyboardDockWidth(392, 'full')).toBe(360);
    expect(calculateVirtualKeyboardDockWidth(360, 'full')).toBe(360);
    expect(calculateVirtualKeyboardDockWidth(360, 'numeric')).toBe(330);
    expect(calculateVirtualKeyboardDockWidth(360, 'financial')).toBe(330);
  });

  it('uses the local frame height with the capped ratio and content floor', () => {
    expect(calculateVirtualKeyboardMetrics(PRIMARY_FRAME, 'full')).toMatchObject({
      capacity: 'supported',
      height: 246,
      contentHeight: 554,
      visible: true,
      rowCount: 4,
      cellWidth: 118,
    });
    expect(calculateVirtualKeyboardMetrics(SECONDARY_FRAME, 'numeric')).toMatchObject({
      capacity: 'supported',
      height: 246,
      contentHeight: 294,
      visible: true,
      rowCount: 4,
      cellWidth: 305,
    });
  });

  it('fits the outer dock to the active layout row count', () => {
    const metrics = (layout: 'full' | 'financial' | 'numeric' | 'alpha') =>
      calculateVirtualKeyboardMetrics(GENERIC_FRAME, layout);
    expect(metrics('full').height).toBe(246);
    expect(metrics('numeric').height).toBe(246);
    expect(metrics('financial').height).toBe(246);
    expect(metrics('alpha').height).toBe(190);
    expect(metrics('alpha').contentHeight).toBe(350);
    expect(metrics('full').horizontalMode).toBe('dense');
    expect(metrics('numeric').horizontalMode).toBe('standard');
    expect(metrics('full').cellWidth).toBe(86);
    expect(metrics('numeric').cellWidth).toBe(305);
    expect(metrics('financial').cellWidth).toBe(305);
    expect(metrics('numeric').rowCount).toBe(4);
    expect(metrics('financial').rowCount).toBe(4);
  });

  it('budgets the dock border outside the keyboard content height on laptop and mobile', () => {
    const laptop = calculateVirtualKeyboardMetrics(GENERIC_FRAME, 'full');
    const laptopAlpha = calculateVirtualKeyboardMetrics(GENERIC_FRAME, 'alpha');
    const mobile = calculateVirtualKeyboardMetrics(frame(360, 720), 'full');
    const mobileAlpha = calculateVirtualKeyboardMetrics(frame(360, 720), 'alpha');
    const border = INPUT_LAYOUT_CONSTANTS.DOCK_BORDER_WIDTH;
    const laptopContent =
      INPUT_LAYOUT_CONSTANTS.KEY_CELL_HEIGHT * 4 +
      INPUT_LAYOUT_CONSTANTS.ROW_GAP * 3 +
      INPUT_LAYOUT_CONSTANTS.DOCK_PADDING_VERTICAL * 2;
    const laptopAlphaContent =
      INPUT_LAYOUT_CONSTANTS.KEY_CELL_HEIGHT * 3 +
      INPUT_LAYOUT_CONSTANTS.ROW_GAP * 2 +
      INPUT_LAYOUT_CONSTANTS.DOCK_PADDING_VERTICAL * 2;
    const mobileContent =
      INPUT_LAYOUT_CONSTANTS.COMPACT_KEY_CELL_HEIGHT * 4 +
      INPUT_LAYOUT_CONSTANTS.COMPACT_ROW_GAP * 3 +
      INPUT_LAYOUT_CONSTANTS.COMPACT_DOCK_PADDING_VERTICAL * 2;
    const mobileAlphaContent =
      INPUT_LAYOUT_CONSTANTS.COMPACT_KEY_CELL_HEIGHT * 3 +
      INPUT_LAYOUT_CONSTANTS.COMPACT_ROW_GAP * 2 +
      INPUT_LAYOUT_CONSTANTS.COMPACT_DOCK_PADDING_VERTICAL * 2;

    expect(laptop.height - border * 2).toBe(laptopContent);
    expect(laptopAlpha.height - border * 2).toBe(laptopAlphaContent);
    expect(mobile.height - border * 2).toBe(mobileContent);
    expect(mobileAlpha.height - border * 2).toBe(mobileAlphaContent);
    expect(laptopContent + border * 2).toBeLessThanOrEqual(laptop.height);
    expect(laptopAlphaContent + border * 2).toBeLessThanOrEqual(laptopAlpha.height);
    expect(mobileContent + border * 2).toBeLessThanOrEqual(mobile.height);
    expect(mobileAlphaContent + border * 2).toBeLessThanOrEqual(mobileAlpha.height);
    expect(laptop.contentHeight + laptop.height).toBe(GENERIC_FRAME.height);
    expect(mobile.contentHeight + mobile.height).toBe(720);
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
    expect(calculateVirtualKeyboardMetrics(frame(360, 340), 'alpha')).toMatchObject({
      capacity: 'unsupported-height',
      height: 132,
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
      cellWidth: 110,
    });
    expect(calculateVirtualKeyboardMetrics(frame(360, 720), 'financial')).toMatchObject({
      capacity: 'supported',
      cellWidth: 110,
      columnCount: 3,
    });
  });
});
