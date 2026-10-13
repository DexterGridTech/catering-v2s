import {describe, expect, it} from 'vitest';
import {ANDROID_SCREEN_CLICK_INTERVAL_MS, createClickPacer} from '../src/clickPacer.js';

describe('createClickPacer', () => {
  it('spaces default Android screen clicks by at least 800ms', async () => {
    expect(ANDROID_SCREEN_CLICK_INTERVAL_MS).toBe(800);
    const pacer = createClickPacer();
    const starts: number[] = [];
    const [first, second] = await Promise.all([
      pacer.run(async markClickStarted => {
        markClickStarted();
        starts.push(performance.now());
        return 'first';
      }),
      pacer.run(async markClickStarted => {
        markClickStarted();
        starts.push(performance.now());
        return 'second';
      }),
    ]);

    expect(first.result).toBe('first');
    expect(second.result).toBe('second');
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(ANDROID_SCREEN_CLICK_INTERVAL_MS);
  });

  it('serializes clicks and spaces their start times by the configured minimum', async () => {
    const pacer = createClickPacer(20);
    const starts: number[] = [];
    const [first, second] = await Promise.all([
      pacer.run(async markClickStarted => {
        markClickStarted();
        starts.push(performance.now());
        return 'first';
      }),
      pacer.run(async markClickStarted => {
        markClickStarted();
        starts.push(performance.now());
        return 'second';
      }),
    ]);

    expect([first.result, second.result]).toEqual(['first', 'second']);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(20);
    expect(second.waitMs).toBeGreaterThan(0);
  });

  it('does not add a delay when the previous action already took longer than the interval', async () => {
    const pacer = createClickPacer(10);
    await pacer.run(async markClickStarted => {
      markClickStarted();
      return new Promise(resolve => setTimeout(resolve, 20));
    });

    const next = await pacer.run(async markClickStarted => {
      markClickStarted();
      return 'ready';
    });

    expect(next).toMatchObject({result: 'ready', waitMs: 0});
  });

  it('rejects an invalid interval', () => {
    expect(() => createClickPacer(0)).toThrow('TERMINAL_AUTOMATION_CLICK_INTERVAL_INVALID');
  });

  it('requires callers to mark the actual click start before completing', async () => {
    const pacer = createClickPacer(10);

    await expect(pacer.run(async () => 'unclicked')).rejects.toThrow('TERMINAL_AUTOMATION_CLICK_START_NOT_MARKED');
  });
});
