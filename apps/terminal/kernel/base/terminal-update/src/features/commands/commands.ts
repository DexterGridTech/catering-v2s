import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import type {FixedUpdateTarget} from '../../types/terminalUpdate';

export const acceptTerminalUpdateTargetCommand = defineCommand<
  Readonly<{selectionContext: FixedUpdateTarget['selectionContext']}>
>(moduleName, {name: 'accept-target', visibility: 'public'});

export const confirmTerminalUpdateBootCommand = defineCommand<Readonly<{bootToken: string; publicationId: string}>>(
  moduleName,
  {name: 'confirm-boot', visibility: 'public'},
);

export const refreshTerminalUpdateRuleSnapshotCommand = defineCommand<Readonly<{}>>(moduleName, {
  name: 'refresh-rule-snapshot',
  visibility: 'internal',
  allowNoActor: false,
  allowReentry: false,
  defaultTarget: 'local',
});

export const reconcileTerminalUpdateCommand = defineCommand<Readonly<{resumeFixedTask: boolean}>>(moduleName, {
  name: 'reconcile-native-facts',
  visibility: 'internal',
});

export const clearTerminalUpdateReportContextCommand = defineCommand<Readonly<{}>>(moduleName, {
  name: 'clear-report-context',
  visibility: 'internal',
});
