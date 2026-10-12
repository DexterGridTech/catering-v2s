export type PacedActionResult<T> = Readonly<{readonly result: T; readonly waitMs: number}>;

export type ClickPacer = Readonly<{
  readonly run: <T>(action: (markClickStarted: () => void) => Promise<T>) => Promise<PacedActionResult<T>>;
}>;

export const ANDROID_SCREEN_CLICK_INTERVAL_MS = 800;

const wait = async (delayMs: number): Promise<void> => new Promise(resolve => setTimeout(resolve, delayMs));

/** Serializes clicks and enforces a minimum gap between their start times. */
export const createClickPacer = (minimumIntervalMs = ANDROID_SCREEN_CLICK_INTERVAL_MS): ClickPacer => {
  if (!Number.isSafeInteger(minimumIntervalMs) || minimumIntervalMs <= 0) {
    throw new Error('TERMINAL_AUTOMATION_CLICK_INTERVAL_INVALID');
  }

  let next: Promise<void> = Promise.resolve();
  let lastStartedAt = 0;

  return Object.freeze({
    run: <T>(action: (markClickStarted: () => void) => Promise<T>): Promise<PacedActionResult<T>> => {
      const current = next.then(async () => {
        const waitMs = Math.max(0, lastStartedAt + minimumIntervalMs - performance.now());
        if (waitMs > 0) await wait(waitMs);
        let started = false;
        const markClickStarted = (): void => {
          if (started) throw new Error('TERMINAL_AUTOMATION_CLICK_START_ALREADY_MARKED');
          started = true;
          lastStartedAt = performance.now();
        };
        const result = await action(markClickStarted);
        if (!started) throw new Error('TERMINAL_AUTOMATION_CLICK_START_NOT_MARKED');
        return Object.freeze({result, waitMs: Math.ceil(waitMs)});
      });
      next = current.then(
        () => undefined,
        () => undefined,
      );
      return current;
    },
  });
};
