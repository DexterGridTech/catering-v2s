import {createAutomationDriverServer, type AutomationDriverServer} from './server.js';
import {waitForAutomationSession} from './session.js';
import type {AutomationDriverSession} from './server.js';
import type {TerminalAutomationShape} from '../fixtures/terminal.js';
import type {TerminalActivationIdentity} from '../fixtures/terminalActivation.js';

export type TerminalAutomationFixtureApi = Readonly<{
  readonly ensureActivated: (
    input: Readonly<{
      readonly shape: TerminalAutomationShape;
      readonly deviceId: string;
      readonly runId: string;
    }>,
  ) => Promise<TerminalActivationIdentity>;
}>;

export type TerminalAutomationFixtureFactory = (server: AutomationDriverServer) => TerminalAutomationFixtureApi;

export type TerminalAutomationDriver = Readonly<{
  readonly transport: AutomationDriverServer;
  readonly waitForSession: (
    matches?: (session: AutomationDriverSession) => boolean,
    timeoutMs?: number,
  ) => Promise<AutomationDriverSession>;
  readonly fixtures?: TerminalAutomationFixtureApi;
  readonly close: () => Promise<void>;
}>;

export const createTerminalAutomationDriver = (
  input: Parameters<typeof createAutomationDriverServer>[0] &
    Readonly<{
      readonly fixtureFactory?: TerminalAutomationFixtureFactory;
    }>,
): TerminalAutomationDriver => {
  const server = createAutomationDriverServer(input);
  const fixtures = input.fixtureFactory?.(server);
  return Object.freeze({
    transport: server,
    ...(fixtures === undefined ? {} : {fixtures}),
    waitForSession: (matches, timeoutMs) => waitForAutomationSession(server, matches, timeoutMs),
    close: () => server.close(),
  });
};
