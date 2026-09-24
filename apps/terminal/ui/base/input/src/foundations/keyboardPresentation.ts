const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export type KeyboardHandoffFrameInput = Readonly<{
  readonly progress: number;
  readonly outgoingHeight: number;
  readonly incomingHeight: number;
  readonly outgoingOffset: number;
  readonly incomingOffset: number;
  readonly tolerance?: number;
}>;

export type KeyboardHandoffFrame = Readonly<{
  readonly outgoingVisibleHeight: number;
  readonly incomingVisibleHeight: number;
  readonly outgoingTranslateY: number;
  readonly incomingTranslateY: number;
  readonly obstructionHeight: number;
  readonly offset: number;
}>;

export type KeyboardHandoffTrack = Readonly<{
  readonly inputRange: readonly number[];
  readonly outgoingTranslateY: readonly number[];
  readonly incomingTranslateY: readonly number[];
  readonly obstructionHeight: readonly number[];
  readonly offset: readonly number[];
}>;

/**
 * Samples the two sequential handoff phases from one normalized clock:
 * incoming rises behind the fully visible outgoing keyboard, then outgoing
 * descends while incoming stays fully visible.
 */
export const handoffFrameAt = ({
  progress: rawProgress,
  outgoingHeight,
  incomingHeight,
  outgoingOffset,
  incomingOffset,
  tolerance = 0.5,
}: KeyboardHandoffFrameInput): KeyboardHandoffFrame => {
  const progress = clamp(rawProgress, 0, 1);
  const firstPhase = progress <= 0.5;
  const phaseProgress = firstPhase
    ? progress * 2
    : (progress - 0.5) * 2;
  const outgoingVisibleHeight = firstPhase
    ? outgoingHeight
    : outgoingHeight * (1 - phaseProgress);
  const incomingVisibleHeight = firstPhase
    ? incomingHeight * phaseProgress
    : incomingHeight;
  const obstructionHeight = Math.max(outgoingVisibleHeight, incomingVisibleHeight);
  const deltaHeight = incomingHeight - outgoingHeight;
  const offset = Math.abs(deltaHeight) > tolerance
    ? outgoingOffset + (incomingOffset - outgoingOffset) * clamp(
      (obstructionHeight - outgoingHeight) / deltaHeight,
      0,
      1,
    )
    : clamp(
      outgoingOffset + (incomingOffset - outgoingOffset) * progress,
      -obstructionHeight,
      0,
    );

  return {
    outgoingVisibleHeight,
    incomingVisibleHeight,
    outgoingTranslateY: outgoingHeight - outgoingVisibleHeight,
    incomingTranslateY: incomingHeight - incomingVisibleHeight,
    obstructionHeight,
    offset,
  };
};

/**
 * Produces the exact piecewise-linear native-driver track for a handoff. The
 * extra points are the obstruction-height plateau boundaries and, in the
 * near-equal branch, the point where offset reaches the per-frame K clamp.
 */
export const handoffTrackOf = (
  input: Omit<KeyboardHandoffFrameInput, 'progress'>,
): KeyboardHandoffTrack => {
  const points = [0, 0.5, 1];
  if (input.incomingHeight > input.outgoingHeight && input.incomingHeight > 0) {
    points.push(input.outgoingHeight / (2 * input.incomingHeight));
  } else if (input.outgoingHeight > input.incomingHeight && input.outgoingHeight > 0) {
    points.push(1 - input.incomingHeight / (2 * input.outgoingHeight));
  }
  points.sort((left, right) => left - right);
  const uniquePoints = points.filter((point, index) => index === 0 || point - points[index - 1]! > 1e-9);
  const deltaHeight = input.incomingHeight - input.outgoingHeight;
  if (Math.abs(deltaHeight) <= (input.tolerance ?? 0.5)) {
    const clampCrossings: number[] = [];
    for (let index = 1; index < uniquePoints.length; index += 1) {
      const start = uniquePoints[index - 1]!;
      const end = uniquePoints[index]!;
      const startFrame = handoffFrameAt({...input, progress: start});
      const endFrame = handoffFrameAt({...input, progress: end});
      const startGap = input.outgoingOffset + (input.incomingOffset - input.outgoingOffset) * start
        + startFrame.obstructionHeight;
      const endGap = input.outgoingOffset + (input.incomingOffset - input.outgoingOffset) * end
        + endFrame.obstructionHeight;
      if ((startGap < 0 && endGap > 0) || (startGap > 0 && endGap < 0)) {
        clampCrossings.push(start + (end - start) * startGap / (startGap - endGap));
      }
    }
    points.push(...clampCrossings);
    points.sort((left, right) => left - right);
  }

  const inputRange = points.filter((point, index) => index === 0 || point - points[index - 1]! > 1e-9);
  const frames = inputRange.map(progress => handoffFrameAt({...input, progress}));
  return {
    inputRange,
    outgoingTranslateY: frames.map(frame => frame.outgoingTranslateY),
    incomingTranslateY: frames.map(frame => frame.incomingTranslateY),
    obstructionHeight: frames.map(frame => frame.obstructionHeight),
    offset: frames.map(frame => frame.offset),
  };
};
