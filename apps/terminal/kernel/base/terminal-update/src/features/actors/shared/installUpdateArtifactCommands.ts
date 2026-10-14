import {onCommand, type ActorCommandHandler} from '@catering-v2s/kernel-base-runtime';
import {
  confirmTerminalUpdateInstallCommand,
  deferTerminalUpdateInstallCommand,
  reconcileTerminalUpdateCommand,
  terminalUpdateDeadlineCommand,
} from '../../../declarations/commands';
import type {
  ReconcileTerminalUpdatePayload,
  TerminalUpdateDeadlinePayload,
  TerminalUpdateInstallDecision,
} from '../../../declarations/commands';

type InstallUpdateArtifactCommandsInput = Readonly<{
  reconcile: ActorCommandHandler<ReconcileTerminalUpdatePayload>;
  deadline: ActorCommandHandler<TerminalUpdateDeadlinePayload>;
  confirmInstall: ActorCommandHandler<TerminalUpdateInstallDecision>;
  deferInstall: ActorCommandHandler<TerminalUpdateInstallDecision>;
}>;

export const installUpdateArtifactCommands = ({
  reconcile,
  deadline,
  confirmInstall,
  deferInstall,
}: InstallUpdateArtifactCommandsInput) =>
  [
    onCommand(reconcileTerminalUpdateCommand, reconcile),
    onCommand(terminalUpdateDeadlineCommand, deadline),
    onCommand(confirmTerminalUpdateInstallCommand, confirmInstall),
    onCommand(deferTerminalUpdateInstallCommand, deferInstall),
  ] as const;
