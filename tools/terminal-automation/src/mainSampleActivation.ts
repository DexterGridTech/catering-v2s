import type {TerminalAutomationFixtureApi} from './driver.js';
import {mainSampleSeedKey, type MainSampleShape} from './mainSampleJourneyConfig.js';

/** Prepares the seed terminal once, then verifies the fixture identity before a main journey starts. */
export const ensureMainSampleActivated = async (
  fixtures: TerminalAutomationFixtureApi | undefined,
  input: Readonly<{readonly shape: MainSampleShape; readonly deviceId: string; readonly runId: string}>,
) => {
  if (fixtures === undefined) throw new Error('TERMINAL_AUTOMATION_FIXTURE_API_MISSING');
  const identity = await fixtures.ensureActivated(input);
  if (identity.deviceId !== input.deviceId || identity.seedKey !== mainSampleSeedKey(input.shape)) {
    throw new Error('TERMINAL_AUTOMATION_ACTIVATION_FIXTURE_IDENTITY_MISMATCH');
  }
  return identity;
};
