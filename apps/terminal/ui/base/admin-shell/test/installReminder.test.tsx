import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {moduleName as terminalUpdateModuleName} from '@catering-v2s/kernel-base-terminal-update';

const harness = vi.hoisted(() => ({
  root: {} as Record<string, unknown>,
  run: vi.fn(async () => ({status: 'completed', actorResults: []})),
}));

vi.mock('@catering-v2s/ui-base-render', () => ({
  useUiStateSelector: (selector: (state: Record<string, unknown>) => unknown) => selector(harness.root),
  useSurfaceContext: () => ({hostLogicalSize: {width: 800, height: 600}}),
  useTrackedCommand: () => ({requestInFlight: false, run: harness.run}),
}));

import {InstallReminder} from '../src/components/InstallReminder';
import {adminTestIds} from '../src/foundations/adminTestIds';

const taskId = 'task-1';
const actionId = 'action-1';
const bootId = 'boot-1';

describe('admin-shell terminal update reminder', () => {
  beforeEach(() => {
    harness.run.mockReset().mockResolvedValue({status: 'completed', actorResults: []});
    harness.root = {
      [`${terminalUpdateModuleName}.state`]: {
        currentTask: {
          taskId,
          phase: 'waiting-user',
          actionId,
          target: {
            full: {artifact: {nativeVersion: '2.1.0', nativeBuildNumber: 21}},
            policy: {nSeconds: 300},
          },
        },
        actualVersions: {nativeVersion: '2.0.0', nativeBuildNumber: 20, bootId},
        invitation: {taskId, actionId, bootId},
      },
    };
  });

  it('shows the fixed task versions and sends the exact local owner decision', async () => {
    const view = await render(<InstallReminder />);

    expect(view.getByTestId(adminTestIds.installReminder.scroll)).toBeTruthy();
    expect(view.getByText('安装终端更新')).toBeTruthy();
    expect(view.getByText('更新包已准备好，请完成安装。')).toBeTruthy();
    expect(view.getByText('当前安装版本：2.0.0 (20)')).toBeTruthy();
    expect(view.getByText('更新安装版本：2.1.0 (21)')).toBeTruthy();
    expect(view.getByText('稍后将在 5 分钟后再次提醒。')).toBeTruthy();

    await fireEvent.press(view.getByTestId(adminTestIds.installReminder.deferInstall));
    expect(harness.run).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {taskId, actionId, bootId},
        rejectionPolicy: 'CONSUME',
      }),
    );
  });

  it('does not render an invitation whose boot identity is stale', async () => {
    const update = harness.root[`${terminalUpdateModuleName}.state`] as Record<string, unknown>;
    update.invitation = {taskId, actionId, bootId: 'previous-boot'};

    const view = await render(<InstallReminder />);
    expect(view.queryByTestId(adminTestIds.installReminder.root)).toBeNull();
  });
});
