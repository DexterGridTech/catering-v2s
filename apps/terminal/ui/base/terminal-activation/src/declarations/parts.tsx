import {definePart} from '@catering-v2s/ui-base-render';
import type {ComponentType} from 'react';
import type {TransportServerConfig} from '@catering-v2s/kernel-base-contracts';
import {ActivationCodeForm} from '../components/ActivationCodeForm';
import {ActivationGuide} from '../components/ActivationGuide';
import {ActivationStatusSection} from '../components/ActivationStatusSection';

const part = ({
  partKey,
  title,
  description,
  component,
  dimensions,
  props = Object.freeze({}),
}: Readonly<{
  readonly partKey: string;
  readonly title: string;
  readonly description: string;
  readonly component: typeof ActivationCodeForm | typeof ActivationGuide | typeof ActivationStatusSection;
  readonly dimensions: Readonly<{
    readonly displayModes: readonly ('PRIMARY' | 'SECONDARY')[];
    readonly workspaces: readonly ('MAIN' | 'BRANCH')[];
    readonly instanceModes: readonly ('MASTER' | 'SLAVE')[];
    readonly surfaceForm: readonly ('laptop' | 'mobile')[];
  }>;
  readonly props?: Readonly<Record<string, unknown>>;
}>) => {
  const View = component as ComponentType<any>;
  return definePart({
    partKey,
    rendererKey: partKey,
    containerKeys: partKey === 'terminal.activation.admin.status' ? (['admin.sections'] as const) : (['main'] as const),
    ...dimensions,
    title,
    description,
    component: received => <View {...props} {...received} />,
  });
};

export const createTerminalActivationParts = (defaults: TransportServerConfig) =>
  Object.freeze([
    part({
      partKey: 'terminal.activation.mmp',
      title: '设备激活',
      description: 'MMP 主屏激活交互',
      component: ActivationCodeForm,
      dimensions: {displayModes: ['PRIMARY'], workspaces: ['MAIN'], instanceModes: ['MASTER'], surfaceForm: ['mobile']},
      props: {defaults},
    }),
    part({
      partKey: 'terminal.activation.lmp',
      title: '设备激活',
      description: 'LMP 主屏激活交互',
      component: ActivationCodeForm,
      dimensions: {displayModes: ['PRIMARY'], workspaces: ['MAIN'], instanceModes: ['MASTER'], surfaceForm: ['laptop']},
      props: {defaults},
    }),
    part({
      partKey: 'terminal.activation.lms',
      title: '设备激活引导',
      description: 'LMS 主屏激活引导',
      component: ActivationGuide,
      dimensions: {
        displayModes: ['SECONDARY'],
        workspaces: ['MAIN'],
        instanceModes: ['MASTER', 'SLAVE'],
        surfaceForm: ['laptop'],
      },
      props: {message: '请在主屏幕上完成设备激活'},
    }),
    part({
      partKey: 'terminal.activation.lsp',
      title: '设备激活引导',
      description: 'LSP 主机激活引导',
      component: ActivationGuide,
      dimensions: {
        displayModes: ['PRIMARY'],
        workspaces: ['BRANCH'],
        instanceModes: ['SLAVE'],
        surfaceForm: ['laptop'],
      },
      props: {message: '请先在主机上完成设备激活'},
    }),
    part({
      partKey: 'terminal.activation.admin.status',
      title: '设备激活状态',
      description: '查看本机或主机激活、连接和延时状态',
      component: ActivationStatusSection,
      dimensions: {
        displayModes: ['PRIMARY', 'SECONDARY'],
        workspaces: ['MAIN', 'BRANCH'],
        instanceModes: ['MASTER', 'SLAVE'],
        surfaceForm: ['mobile', 'laptop'],
      },
    }),
  ]);
