import {defineCommand} from '../../foundations/defineCommand';
import {moduleName} from '../../moduleName';

/** Internal maintenance command; it is intentionally not part of the package root exports. */
export type CleanupRequestLedgerPayload = Readonly<{}>;

export const cleanupRequestLedgerCommand = defineCommand<CleanupRequestLedgerPayload>(moduleName, {
  name: 'cleanup-request-ledger',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});
