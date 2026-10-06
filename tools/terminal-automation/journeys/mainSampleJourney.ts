import type {AutomationDriverServer} from '../src/server.js';
import {runStoreBasicDataChangeProof} from './storeBasicDataChange.js';
import {runSampleConsoleJourney, type SampleConsoleJourneyInput, type SampleConsoleJourneyPort} from './sampleConsoleJourney.js';
import {runSampleWallpaperJourney, type SampleWallpaperJourneyPort} from './sampleWallpaperJourney.js';

type StoreBasicProofInput = Readonly<{
  readonly runId: string;
  readonly httpBaseUrl: string;
  readonly operationsPassword: string;
  readonly platformRootPassword: string;
}>;

type ConsoleMainJourney = Readonly<{
  readonly sample: 'console';
  readonly port: SampleConsoleJourneyPort;
  readonly input: SampleConsoleJourneyInput;
  readonly storeBasicProof: StoreBasicProofInput;
}>;

type WallpaperMainJourney = Readonly<{
  readonly sample: 'wallpaper';
  readonly port: SampleWallpaperJourneyPort;
}>;

/** Runs the selected main business flow and its data oracle; platform mechanics stay in the driver adapter. */
export const runMainSampleJourney = async (input: ConsoleMainJourney | WallpaperMainJourney): Promise<void> => {
  if (input.sample === 'wallpaper') {
    await runSampleWallpaperJourney(input.port);
    return;
  }

  await runSampleConsoleJourney(input.port, input.input);
  input.port.diagnostics?.markStep('store-basic.data-change-proof');
  const proof = input.storeBasicProof;
  await runStoreBasicDataChangeProof({
    server: input.port.server,
    sessionId: input.port.sessionId,
    runId: proof.runId,
    httpBaseUrl: proof.httpBaseUrl,
    operationsPassword: proof.operationsPassword,
    platformRootPassword: proof.platformRootPassword,
  });
};
