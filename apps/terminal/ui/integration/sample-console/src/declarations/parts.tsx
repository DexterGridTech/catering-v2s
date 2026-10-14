import {definePart} from '@catering-v2s/ui-base-render';
import {ADMIN_SECTION_CONTAINER_KEY} from '@catering-v2s/ui-base-admin-shell';
import {SampleSection} from '@catering-v2s/ui-base-admin-shell';

export const sampleAdminTestPart = definePart({
  partKey: 'sample.console.admin-test',
  rendererKey: 'sample.console.admin-test',
  containerKeys: [ADMIN_SECTION_CONTAINER_KEY] as const,
  displayModes: ['PRIMARY', 'SECONDARY'] as const,
  workspaces: ['MAIN', 'BRANCH'] as const,
  instanceModes: ['MASTER', 'SLAVE'] as const,
  surfaceForm: ['laptop', 'mobile'] as const,
  title: '示例诊断',
  description: '由 sample-console 通过包内 module 注册的标题占位 section',
  component: SampleSection,
});
