import type {AutomationDriverServer} from '../src/server.js';
import type {TerminalAutomationFixtureApi} from '../src/driver.js';
import type {TerminalAutomationShape} from './terminal.js';
import {
  ensureTerminalActivated,
  writeTerminalActivationCompletion,
  writeTerminalActivationIntent,
} from './terminalActivation.js';

type ManagedBindingReader = typeof import('../../../scripts/dev/r5-dev-runner.mjs').readManagedTerminalBindingByName;

export const createManagedActivationFixtureApi = (
  input: Readonly<{
    readonly server: AutomationDriverServer;
    readonly repositoryRoot: string;
    readonly runId: string;
    readonly managedDevRunId: string;
    readonly androidDeviceSerial?: string;
    readonly sessionId: () => string | null;
    readonly deviceId: (shape: TerminalAutomationShape) => string;
  }>,
): TerminalAutomationFixtureApi =>
  Object.freeze({
    ensureActivated: async ({shape, deviceId, runId}) => {
      if (runId !== input.runId || deviceId !== input.deviceId(shape)) {
        throw new Error('TERMINAL_AUTOMATION_MANAGED_ACTIVATION_IDENTITY_MISMATCH');
      }
      const sessionId = input.sessionId();
      const manifestPath = process.env.V2S_TERMINAL_DEV_MANIFEST;
      const httpBaseUrl = process.env.V2S_TERMINAL_DEV_HTTP_BASE_URL;
      const operationsPassword = process.env.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD;
      if (!sessionId || !manifestPath || !httpBaseUrl || !operationsPassword) {
        throw new Error('TERMINAL_AUTOMATION_MANAGED_ACTIVATION_INPUT_MISSING');
      }
      const {readManagedTerminalBindingByName} = (await import('../../../scripts/dev/r5-dev-runner.mjs')) as {
        readonly readManagedTerminalBindingByName: ManagedBindingReader;
      };
      return ensureTerminalActivated({
        repositoryRoot: input.repositoryRoot,
        shape,
        deviceId,
        ...(input.androidDeviceSerial === undefined ? {} : {androidDeviceSerial: input.androidDeviceSerial}),
        httpBaseUrl,
        operationsPassword,
        managedDevRunId: input.managedDevRunId,
        sessionId,
        driver: input.server,
        readManagedBindings: async terminalName =>
          readManagedTerminalBindingByName({
            manifestPath,
            runId: input.managedDevRunId,
            groupWorkspaceKey: 'aurora',
            terminalNames: [terminalName],
          }),
        onActivationIntent: async identity =>
          writeTerminalActivationIntent(input.repositoryRoot, input.runId, {
            managedDevRunId: input.managedDevRunId,
            ...identity,
          }),
        onActivationComplete: async identity =>
          writeTerminalActivationCompletion(input.repositoryRoot, input.runId, identity),
      });
    },
  });
