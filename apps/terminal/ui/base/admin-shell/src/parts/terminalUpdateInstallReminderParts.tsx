import {definePart} from '@catering-v2s/ui-base-render';
import {InstallReminder} from '../components/InstallReminder';
import {UPDATE_INSTALL_REMINDER_PART_KEY} from '../foundations/updateReminderIdentity';

export const createTerminalUpdateInstallReminderParts = () =>
  Object.freeze(
    (['laptop', 'mobile'] as const).map(surfaceForm =>
      definePart({
        partKey: UPDATE_INSTALL_REMINDER_PART_KEY,
        rendererKey: `${UPDATE_INSTALL_REMINDER_PART_KEY}.${surfaceForm}`,
        containerKeys: [] as const,
        displayModes: ['PRIMARY'] as const,
        workspaces: ['MAIN', 'BRANCH'] as const,
        instanceModes: ['MASTER', 'SLAVE'] as const,
        surfaceForm: [surfaceForm] as const,
        title: '安装终端更新',
        description: '呈现 terminal-update owner 提供的本机安装提醒',
        component: InstallReminder,
        layerTier: 'alert' as const,
        layerGuard: 'decisive' as const,
        placementScope: 'local-primary' as const,
      }),
    ),
  );
