import type {AutomationDriverServer, AutomationDriverSession} from './server.js';

type SessionMatch = (session: AutomationDriverSession) => boolean;

const findUniqueSession = (server: AutomationDriverServer, matches: SessionMatch): AutomationDriverSession | null => {
  const candidates = server.getSessions().filter(matches);
  if (candidates.length > 1) throw new Error('TERMINAL_AUTOMATION_SESSION_AMBIGUOUS');
  return candidates[0] ?? null;
};

export const waitForAutomationSession = (
  server: AutomationDriverServer,
  matches: SessionMatch = () => true,
  timeoutMs = 5_000,
  signal?: AbortSignal,
): Promise<AutomationDriverSession> => {
  if (signal?.aborted) return Promise.reject(new Error('TERMINAL_AUTOMATION_SESSION_WAIT_CANCELLED'));
  let current: AutomationDriverSession | null;
  try {
    current = findUniqueSession(server, matches);
  } catch (error) {
    return Promise.reject(error);
  }
  if (current !== null) return Promise.resolve(current);
  return new Promise((resolve, reject) => {
    let settled = false;
    let unsubscribe = (): void => undefined;
    const cleanup = (): void => {
      clearTimeout(timer);
      unsubscribe();
      signal?.removeEventListener('abort', onAbort);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('TERMINAL_AUTOMATION_SESSION_TIMEOUT'));
    }, timeoutMs);
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('TERMINAL_AUTOMATION_SESSION_WAIT_CANCELLED'));
    };
    // The driver server's session callback is the only session lifecycle event.
    // Re-evaluate its owned session map instead of polling or trusting the latest session.
    const onSession = (): void => {
      if (settled) return;
      try {
        const next = findUniqueSession(server, matches);
        if (next === null) return;
        settled = true;
        cleanup();
        resolve(next);
      } catch (error) {
        settled = true;
        cleanup();
        reject(error);
      }
    };
    signal?.addEventListener('abort', onAbort, {once: true});
    unsubscribe = server.onSessionChange(onSession);
    onSession();
  });
};

/** Finds the next connection for this app after a Runtime recreation. */
export const waitForReplacementAutomationSession = (
  server: AutomationDriverServer,
  previous: AutomationDriverSession,
  timeoutMs = 5_000,
): Promise<AutomationDriverSession> =>
  waitForAutomationSession(
    server,
    candidate => candidate.appName === previous.appName && candidate.sessionId !== previous.sessionId,
    timeoutMs,
  );

/** Prefers the new Runtime session if it arrives before the prior socket closes. */
export const resolveCurrentAutomationSession = (
  server: AutomationDriverServer,
  previous: AutomationDriverSession,
  timeoutMs = 5_000,
): Promise<AutomationDriverSession> => {
  const replacements = server
    .getSessions()
    .filter(candidate => candidate.appName === previous.appName && candidate.sessionId !== previous.sessionId);
  if (replacements.length > 1) return Promise.reject(new Error('TERMINAL_AUTOMATION_SESSION_AMBIGUOUS'));
  const replacement = replacements[0];
  if (replacement !== undefined) return Promise.resolve(replacement);
  const current = server.getSession(previous.sessionId);
  if (current !== null && current.socket.readyState === current.socket.OPEN) return Promise.resolve(current);
  return waitForReplacementAutomationSession(server, previous, timeoutMs);
};
