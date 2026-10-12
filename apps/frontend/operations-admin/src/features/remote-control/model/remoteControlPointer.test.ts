import {describe, expect, it} from 'vitest';
import {normalizedVideoPoint} from './remoteControlPointer';

describe('normalizedVideoPoint', () => {
  it('maps a point inside a contained video frame to normalized coordinates', () => {
    expect(normalizedVideoPoint(400, 300, {left: 100, top: 100, width: 600, height: 400}, {width: 1600, height: 900}))
      .toEqual({u: 0.5, v: 0.5});
  });

  it('rejects black bars and zero-sized frames', () => {
    const rect = {left: 100, top: 100, width: 600, height: 400};
    expect(normalizedVideoPoint(110, 120, rect, {width: 1600, height: 900})).toBeNull();
    expect(normalizedVideoPoint(200, 110, rect, {width: 1600, height: 900})).toBeNull();
    expect(normalizedVideoPoint(200, 200, rect, {width: 0, height: 900})).toBeNull();
  });
});
