import {useEffect, useState} from 'react';
import {
  confirmTerminalUpdateInstallCommand,
  deferTerminalUpdateInstallCommand,
  selectTerminalUpdateActualVersions,
  selectTerminalUpdateInvitation,
  selectTerminalUpdateTask,
  type TerminalUpdateInstallDecision,
} from '@catering-v2s/kernel-base-terminal-update';
import {PrimitiveActions, PrimitiveButton, PrimitiveCenter, PrimitiveContainer, PrimitiveHeading, PrimitiveStatus, PrimitiveText} from '@catering-v2s/ui-base-primitives';
import {useSurfaceContext, useTrackedCommand, useUiStateSelector} from '@catering-v2s/ui-base-render';
import {adminTestIds} from '../foundations/adminTestIds';

const reminderText = '暂时无法准备安装，请稍后。';
const formatVersion = (version: string, build: number): string => `${version} (${build})`;

export const InstallReminder = () => {
  const invitation = useUiStateSelector(selectTerminalUpdateInvitation) ?? null;
  const task = useUiStateSelector(selectTerminalUpdateTask) ?? null;
  const actual = useUiStateSelector(selectTerminalUpdateActualVersions) ?? null;
  const {hostLogicalSize} = useSurfaceContext();
  const tracked = useTrackedCommand();
  const [feedback, setFeedback] = useState('');
  const [attempt, setAttempt] = useState<Readonly<{decision: TerminalUpdateInstallDecision; settled: boolean}> | null>(null);

  useEffect(() => {
    if (
      attempt !== null &&
      (invitation === null ||
        invitation.taskId !== attempt.decision.taskId ||
        invitation.actionId !== attempt.decision.actionId ||
        invitation.bootId !== attempt.decision.bootId)
    ) {
      setAttempt(null);
      setFeedback('');
      return;
    }
    if (attempt?.settled === true && invitation !== null) setFeedback(reminderText);
  }, [attempt, invitation]);

  const isCurrent =
    invitation !== null &&
    task !== null &&
    actual !== null &&
    task.phase === 'waiting-user' &&
    task.target.full !== null &&
    task.taskId === invitation.taskId &&
    task.actionId === invitation.actionId &&
    actual.bootId === invitation.bootId;
  if (!isCurrent || hostLogicalSize === null) return null;

  const decision: TerminalUpdateInstallDecision = Object.freeze({
    taskId: invitation.taskId,
    actionId: invitation.actionId,
    bootId: invitation.bootId,
  });
  const target = task.target.full!.artifact;
  const reminderMinutes = Math.max(1, Math.ceil(task.target.policy.nSeconds / 60));

  const submit = async (kind: 'defer' | 'confirm'): Promise<void> => {
    if (tracked.requestInFlight) return;
    setFeedback('');
    setAttempt(Object.freeze({decision, settled: false}));
    const result = await tracked.run({
      definition: kind === 'confirm' ? confirmTerminalUpdateInstallCommand : deferTerminalUpdateInstallCommand,
      payload: decision,
      rejectionPolicy: 'CONSUME',
      onRejected: () => setFeedback(reminderText),
    });
    if (result !== undefined && result.status !== 'running') setAttempt(Object.freeze({decision, settled: true}));
  };

  return (
    <PrimitiveCenter testID={adminTestIds.installReminder.root} style={{flex: 1, minHeight: 0, padding: 16}}>
      <PrimitiveContainer layout="card" bounded style={{width: '100%'}}>
        <PrimitiveHeading testID={adminTestIds.installReminder.title}>安装终端更新</PrimitiveHeading>
        <PrimitiveText testID={adminTestIds.installReminder.message}>更新包已准备好，请完成安装。</PrimitiveText>
        <PrimitiveText testID={adminTestIds.installReminder.versions}>
          <PrimitiveText testID={adminTestIds.installReminder.currentVersion}>
            当前安装版本：{formatVersion(actual.nativeVersion, actual.nativeBuildNumber)}
          </PrimitiveText>
          {'\n'}
          <PrimitiveText testID={adminTestIds.installReminder.targetVersion}>
            更新安装版本：{formatVersion(target.nativeVersion, target.nativeBuildNumber)}
          </PrimitiveText>
        </PrimitiveText>
        <PrimitiveText testID={adminTestIds.installReminder.reminder}>
          稍后将在 {reminderMinutes} 分钟后再次提醒。
        </PrimitiveText>
        <PrimitiveActions testID={adminTestIds.installReminder.actions}>
          <PrimitiveButton
            testID={adminTestIds.installReminder.deferInstall}
            disabled={tracked.requestInFlight}
            onPress={() => void submit('defer')}
          >
            稍后
          </PrimitiveButton>
          <PrimitiveButton
            testID={adminTestIds.installReminder.confirmInstall}
            disabled={tracked.requestInFlight}
            busy={tracked.requestInFlight}
            tone="info"
            onPress={() => void submit('confirm')}
          >
            安装
          </PrimitiveButton>
        </PrimitiveActions>
        {feedback.length === 0 ? null : (
          <PrimitiveStatus testID={adminTestIds.installReminder.feedback} tone="error">
            {feedback}
          </PrimitiveStatus>
        )}
      </PrimitiveContainer>
    </PrimitiveCenter>
  );
};
