import {onCommand, type ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {terminalDataHeartbeatCommand} from '@catering-v2s/kernel-base-terminal-data-client';
import {clearTerminalUpdateReportContextCommand} from '../../../declarations/commands';
import {terminalUpdateActions} from '../../slices/terminalUpdate';
import {createTerminalUpdateReportOwner} from './createTerminalUpdateReportOwner';

type InstallUpdateReportCommandsInput = Readonly<{
  actions: typeof terminalUpdateActions;
  reportOwner: ReturnType<typeof createTerminalUpdateReportOwner>;
  persist: (context: ActorExecutionContext) => Promise<boolean>;
}>;

export const installUpdateReportCommands = ({actions, reportOwner, persist}: InstallUpdateReportCommandsInput) =>
  [
    onCommand(clearTerminalUpdateReportContextCommand, async context => {
      context.dispatchAction(actions.replaceReportDescriptor(reportOwner.emptyReportDescriptor(null)));
      return Object.freeze({status: (await persist(context)) ? 'cleared' : 'persistence-failed'});
    }),
    onCommand(terminalDataHeartbeatCommand, context => reportOwner.sendPendingReport(context, context.command.payload)),
  ] as const;
