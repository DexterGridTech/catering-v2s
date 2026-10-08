import {defineCommand} from '../../foundations/defineCommand';
import {moduleName} from '../../moduleName';

export type PrimarySurfaceReadyPayload = Readonly<{contentReady: boolean}>;

/** Generic lifecycle fact emitted after the primary surface's startup routing completes. */
export const primarySurfaceReadyCommand = defineCommand<PrimarySurfaceReadyPayload>(moduleName, {
  name: 'primary-surface-ready',
  visibility: 'internal',
  allowNoActor: true,
});
