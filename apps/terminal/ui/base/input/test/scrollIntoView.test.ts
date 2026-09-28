import {describe, expect, it} from 'vitest';
import {
  calculatePresentationOffsetY,
  calculateScrollOffset,
  isRectInsideVisibleVerticalIntersection,
  visibleVerticalIntersectionOf,
} from '../src/foundations/scrollIntoView';

const rect = (y: number, height: number) => ({x: 0, y, width: 100, height});

describe('scroll into the measured surface and viewport intersection', () => {
  it('centers a focus frame above the keyboard while clamping movement to keyboard height', () => {
    expect(calculatePresentationOffsetY(rect(400, 40), 800, 300)).toBe(-170);
    expect(calculatePresentationOffsetY(rect(600, 40), 800, 300)).toBe(-300);
    expect(calculatePresentationOffsetY(rect(100, 40), 800, 300)).toBe(0);
  });

  it('does not count scroll or presentation offset twice for the canonical nested-scroll sample', () => {
    expect(
      calculateScrollOffset({
        inputRect: rect(520, 40),
        viewportRect: rect(100, 500),
        currentOffset: 80,
        maxScroll: 1000,
        surfaceHeight: 800,
        keyboardHeight: 300,
        presentationOffsetY: -100,
      }),
    ).toBe(80);
    expect(
      visibleVerticalIntersectionOf({
        viewportRect: rect(100, 500),
        surfaceHeight: 800,
        keyboardHeight: 300,
        presentationOffsetY: -100,
      }),
    ).toEqual({top: 0, bottom: 500});
    expect(isRectInsideVisibleVerticalIntersection(rect(420, 40), {top: 0, bottom: 500})).toBe(true);
  });

  it('scrolls down when presentation translation clips the upper edge', () => {
    expect(
      calculateScrollOffset({
        inputRect: rect(50, 40),
        viewportRect: rect(100, 300),
        currentOffset: 80,
        maxScroll: 1000,
        surfaceHeight: 800,
        keyboardHeight: 200,
        presentationOffsetY: -100,
      }),
    ).toBe(30);
  });

  it('scrolls up when the translated viewport lower edge clips an input', () => {
    expect(
      calculateScrollOffset({
        inputRect: rect(600, 40),
        viewportRect: rect(100, 500),
        currentOffset: 80,
        maxScroll: 1000,
        surfaceHeight: 800,
        keyboardHeight: 300,
        presentationOffsetY: -150,
      }),
    ).toBe(120);
  });

  it('leaves a field at its current offset when the full frame is inside the intersection', () => {
    expect(
      calculateScrollOffset({
        inputRect: rect(300, 40),
        viewportRect: rect(100, 500),
        currentOffset: 12,
        maxScroll: 1000,
        surfaceHeight: 800,
        keyboardHeight: 300,
        presentationOffsetY: -100,
      }),
    ).toBe(12);
  });

  it('uses the same half-unit tolerance for visibility and target calculation', () => {
    const intersection = {top: 0, bottom: 100};
    expect(isRectInsideVisibleVerticalIntersection(rect(-0.4, 20), intersection)).toBe(true);
    expect(isRectInsideVisibleVerticalIntersection(rect(80.4, 20), intersection)).toBe(true);
    expect(
      calculateScrollOffset({
        inputRect: rect(180.4, 20),
        viewportRect: rect(0, 200),
        currentOffset: 100,
        maxScroll: 1000,
        surfaceHeight: 800,
        keyboardHeight: 600,
        presentationOffsetY: 0,
      }),
    ).toBe(100);
  });

  it('returns an empty intersection when the keyboard leaves no visible viewport', () => {
    const intersection = visibleVerticalIntersectionOf({
      viewportRect: rect(700, 80),
      surfaceHeight: 800,
      keyboardHeight: 300,
      presentationOffsetY: -20,
    });
    expect(intersection).toEqual({top: 680, bottom: 500});
    expect(isRectInsideVisibleVerticalIntersection(rect(690, 20), intersection)).toBe(false);
    expect(
      calculateScrollOffset({
        inputRect: rect(690, 20),
        viewportRect: rect(700, 80),
        currentOffset: 12,
        maxScroll: 1000,
        surfaceHeight: 800,
        keyboardHeight: 300,
        presentationOffsetY: -20,
      }),
    ).toBe(12);
  });

  it('clamps a requested scroll target to the measured content maximum', () => {
    expect(
      calculateScrollOffset({
        inputRect: rect(600, 40),
        viewportRect: rect(100, 300),
        currentOffset: 20,
        maxScroll: 75,
        surfaceHeight: 800,
        keyboardHeight: 200,
        presentationOffsetY: 0,
      }),
    ).toBe(75);
  });
});
