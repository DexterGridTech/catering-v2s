/** Starts one asynchronous cleanup action and keeps its exact outcome observable to every caller. */
export const createAwaitableDisposal = (
  dispose: () => Promise<void>,
  failureCode: string,
): Readonly<{start: () => Promise<void>; wait: () => Promise<void>}> => {
  let completion: Promise<void> | undefined;
  const start = (): Promise<void> => {
    completion ??= Promise.resolve()
      .then(dispose)
      .catch(() => {
        throw new Error(failureCode);
      });
    // A remote-close event can start disposal before the owning runtime awaits it.
    // Attach a rejection observer without changing the promise returned to explicit cleanup.
    void completion.catch(() => undefined);
    return completion;
  };
  return Object.freeze({start, wait: start});
};
