import {describe, expect, it} from 'vitest';
import {handoffFrameAt, handoffTrackOf} from '../src/foundations/keyboardPresentation';

const interpolate = (progress: number, inputRange: readonly number[], outputRange: readonly number[]): number => {
  const segment = inputRange.findIndex((point, index) => index > 0 && point >= progress);
  if (segment < 0) return outputRange[outputRange.length - 1]!;
  const start = segment - 1;
  const ratio = (progress - inputRange[start]!) / (inputRange[segment]! - inputRange[start]!);
  return outputRange[start]! + (outputRange[segment]! - outputRange[start]!) * ratio;
};

describe('keyboard presentation geometry', () => {
  it.each([
    ['alpha to full', 190, 246, -190, -246],
    ['full to alpha', 246, 190, -246, -190],
    ['equal full layouts', 246, 246, -246, -246],
  ])(
    '%s preserves the obstruction and offset bounds at every segment sample',
    (_name, heightA, heightB, offsetA, offsetB) => {
      let previousHeight = heightA;
      let previousOffset = offsetA;
      for (let index = 0; index <= 1000; index += 1) {
        const progress = index / 1000;
        const frame = handoffFrameAt({
          progress,
          outgoingHeight: heightA,
          incomingHeight: heightB,
          outgoingOffset: offsetA,
          incomingOffset: offsetB,
        });
        expect(frame.obstructionHeight).toBeGreaterThanOrEqual(0);
        expect(frame.offset).toBeLessThanOrEqual(0);
        expect(frame.offset).toBeGreaterThanOrEqual(-frame.obstructionHeight - 1e-8);
        if (index > 0) {
          if (heightB >= heightA) {
            expect(frame.obstructionHeight + 1e-8).toBeGreaterThanOrEqual(previousHeight);
            if (offsetB >= offsetA) expect(frame.offset + 1e-8).toBeGreaterThanOrEqual(previousOffset);
            else expect(frame.offset - 1e-8).toBeLessThanOrEqual(previousOffset);
          } else {
            expect(frame.obstructionHeight - 1e-8).toBeLessThanOrEqual(previousHeight);
            if (offsetB >= offsetA) expect(frame.offset + 1e-8).toBeGreaterThanOrEqual(previousOffset);
            else expect(frame.offset - 1e-8).toBeLessThanOrEqual(previousOffset);
          }
        }
        previousHeight = frame.obstructionHeight;
        previousOffset = frame.offset;
      }
      expect(
        handoffFrameAt({
          progress: 0,
          outgoingHeight: heightA,
          incomingHeight: heightB,
          outgoingOffset: offsetA,
          incomingOffset: offsetB,
        }).offset,
      ).toBeCloseTo(offsetA, 8);
      expect(
        handoffFrameAt({
          progress: 1,
          outgoingHeight: heightA,
          incomingHeight: heightB,
          outgoingOffset: offsetA,
          incomingOffset: offsetB,
        }).offset,
      ).toBeCloseTo(offsetB, 8);
    },
  );

  it.each([
    [190, 246, -190, -246, 0.25, -190],
    [246, 190, -246, -190, 0.75, -190],
  ])(
    'holds the content against the actual obstruction plateau for %s→%s',
    (heightA, heightB, offsetA, offsetB, progress, expectedOffset) => {
      const frame = handoffFrameAt({
        progress,
        outgoingHeight: heightA,
        incomingHeight: heightB,
        outgoingOffset: offsetA,
        incomingOffset: offsetB,
      });
      expect(frame.obstructionHeight).toBeCloseTo(190, 8);
      expect(frame.offset).toBeCloseTo(expectedOffset, 8);
    },
  );

  it('uses the exact visible-height transition, including both phase boundaries', () => {
    const beforeSwitch = handoffFrameAt({
      progress: 0.5 - 1e-7,
      outgoingHeight: 190,
      incomingHeight: 246,
      outgoingOffset: -190,
      incomingOffset: -246,
    });
    const atSwitch = handoffFrameAt({
      progress: 0.5,
      outgoingHeight: 190,
      incomingHeight: 246,
      outgoingOffset: -190,
      incomingOffset: -246,
    });
    const afterSwitch = handoffFrameAt({
      progress: 0.5 + 1e-7,
      outgoingHeight: 190,
      incomingHeight: 246,
      outgoingOffset: -190,
      incomingOffset: -246,
    });

    expect(Math.abs(beforeSwitch.obstructionHeight - atSwitch.obstructionHeight)).toBeLessThan(0.001);
    expect(Math.abs(afterSwitch.obstructionHeight - atSwitch.obstructionHeight)).toBeLessThan(0.001);
    expect(Math.abs(beforeSwitch.offset - atSwitch.offset)).toBeLessThan(0.001);
    expect(Math.abs(afterSwitch.offset - atSwitch.offset)).toBeLessThan(0.001);
  });

  it.each([
    [190, 246, -190, -246],
    [246, 190, -246, -190],
    [246, 246, -246, -246],
    [190, 190.4, -190, -190.4],
    [190, 190.5, -190, -190.5],
    [190.5, 190, -190.5, -190],
  ])('native-driver interpolation matches the sampled geometry for %s→%s', (heightA, heightB, offsetA, offsetB) => {
    const input = {
      outgoingHeight: heightA,
      incomingHeight: heightB,
      outgoingOffset: offsetA,
      incomingOffset: offsetB,
      tolerance: 0.5,
    };
    const track = handoffTrackOf(input);
    for (let index = 0; index <= 1000; index += 1) {
      const progress = index / 1000;
      const frame = handoffFrameAt({...input, progress});
      expect(interpolate(progress, track.inputRange, track.obstructionHeight)).toBeCloseTo(frame.obstructionHeight, 8);
      expect(interpolate(progress, track.inputRange, track.offset)).toBeCloseTo(frame.offset, 8);
      expect(interpolate(progress, track.inputRange, track.outgoingTranslateY)).toBeCloseTo(
        frame.outgoingTranslateY,
        8,
      );
      expect(interpolate(progress, track.inputRange, track.incomingTranslateY)).toBeCloseTo(
        frame.incomingTranslateY,
        8,
      );
    }
  });

  it('uses shared-time interpolation and clamps the offset for near-equal measured heights', () => {
    const frame = handoffFrameAt({
      progress: 0.75,
      outgoingHeight: 190,
      incomingHeight: 190.4,
      outgoingOffset: -190,
      incomingOffset: -190.4,
      tolerance: 0.5,
    });

    expect(frame.obstructionHeight).toBeCloseTo(190.4);
    expect(frame.offset).toBeGreaterThanOrEqual(-frame.obstructionHeight);
    expect(frame.offset).toBeLessThanOrEqual(0);
  });

  it.each([
    [190, 190.5, -190, -190.5],
    [190.5, 190, -190.5, -190],
  ])('treats the exact tolerance boundary %s→%s as the shared-time branch', (heightA, heightB, offsetA, offsetB) => {
    const frame = handoffFrameAt({
      progress: 0.25,
      outgoingHeight: heightA,
      incomingHeight: heightB,
      outgoingOffset: offsetA,
      incomingOffset: offsetB,
      tolerance: 0.5,
    });

    expect(frame.offset).toBeCloseTo(
      Math.max(-frame.obstructionHeight, Math.min(0, offsetA + (offsetB - offsetA) * 0.25)),
      8,
    );
    expect(frame.offset).toBeGreaterThanOrEqual(-frame.obstructionHeight);
    expect(frame.offset).toBeLessThanOrEqual(0);
  });
});
