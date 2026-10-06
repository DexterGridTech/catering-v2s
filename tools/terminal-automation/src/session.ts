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
): Promise<AutomationDriverSession> => {
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
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(new Error('TERMINAL_AUTOMATION_SESSION_TIMEOUT'));
    }, timeoutMs);
    // The driver server's session callback is the only session lifecycle event.
    // Re-evaluate its owned session map instead of polling or trusting the latest session.
    const onSession = (): void => {
      if (settled) return;
      try {
        const next = findUniqueSession(server, matches);
        if (next === null) return;
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        resolve(next);
      } catch (error) {
        settled = true;
        clearTimeout(timer);
        unsubscribe();
        reject(error);
      }
    };
    unsubscribe = server.onSessionChange(onSession);
    onSession();
  });
};
