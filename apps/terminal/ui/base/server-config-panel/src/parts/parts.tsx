import {definePart} from '@catering-v2s/ui-base-render';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import type {AdminSectionProps} from '@catering-v2s/ui-base-admin-shell';
import {ServerConfigPanel} from '../components/ServerConfigPanel';

export const createServerConfigPanelParts = (defaults: TransportServerConfig) =>
  Object.freeze([
    definePart({
      partKey: 'terminal.server-config.admin',
      rendererKey: 'terminal.server-config.admin',
      containerKeys: ['admin.sections'] as const,
      displayModes: ['PRIMARY', 'SECONDARY'] as const,
      workspaces: ['MAIN', 'BRANCH'] as const,
      instanceModes: ['MASTER', 'SLAVE'] as const,
      surfaceForm: ['mobile', 'laptop'] as const,
      title: '服务配置',
      description: '查看或编辑本机服务配置',
      component: (props: AdminSectionProps) => <ServerConfigPanel defaults={defaults} context={props.context} />,
    }),
  ]);
