import {describe, expect, it} from 'vitest';
import {idleMinutesToSeconds, idleSecondsToMinutes} from './terminalUpdateDuration';

describe('terminal update idle duration units', () => {
  it('converts ten UI minutes to 600 API seconds and back', () => {
    expect(idleMinutesToSeconds(10)).toBe(600);
    expect(idleSecondsToMinutes(600)).toBe(10);
  });
});
