import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../../moduleName';
import type {RuntimeInstanceId} from '@catering-v2s/kernel-base-contracts';
import type {UpdatePresentation} from '@catering-v2s/kernel-base-platform-ports';
import type {FixedUpdateTarget, RequestTerminalUpdatePayload} from '../../types/terminalUpdate';

export const createRequestTerminalUpdatePayload = (target: FixedUpdateTarget | null): RequestTerminalUpdatePayload =>
  Object.freeze({target: target as unknown as StateJsonValue});

export const requestTerminalUpdateCommand = defineCommand<RequestTerminalUpdatePayload>(moduleName, {
  name: 'request-terminal-update',
  visibility: 'public',
  timeoutMs: 300_000,
  defaultTarget: 'local',
});

export const confirmTerminalUpdateBootCommand = defineCommand<Readonly<{bootToken: string; publicationId: string}>>(
  moduleName,
  {name: 'confirm-boot', visibility: 'public'},
);

export const reconcileTerminalUpdateCommand = defineCommand<Readonly<{resumeFixedTask: boolean}>>(moduleName, {
  name: 'reconcile-native-facts',
  visibility: 'internal',
});

export const terminalUpdateDeadlineCommand = defineCommand<
  Readonly<{
    taskId: string;
    bootId: string;
    kind: 'hot-idle' | 'full-reminder';
    interactionRevision: number;
    deadlineAt: number;
    scheduleGeneration: number;
  }>
>(moduleName, {name: 'deadline', visibility: 'internal'});

export type TerminalUpdateInstallDecision = Readonly<{
  taskId: string;
  actionId: string | null;
  bootId: string;
}>;

export const confirmTerminalUpdateInstallCommand = defineCommand<TerminalUpdateInstallDecision>(moduleName, {
  name: 'confirm-install',
  visibility: 'public',
});

export const deferTerminalUpdateInstallCommand = defineCommand<TerminalUpdateInstallDecision>(moduleName, {
  name: 'defer-install',
  visibility: 'public',
});

export const updatePresentationChangedCommand = defineCommand<
  Readonly<{runtimeIdentity: RuntimeInstanceId; presentation: UpdatePresentation}>
>(moduleName, {
  name: 'presentation-changed',
  visibility: 'internal',
});

export const clearTerminalUpdateReportContextCommand = defineCommand<Readonly<{}>>(moduleName, {
  name: 'clear-report-context',
  visibility: 'internal',
});
