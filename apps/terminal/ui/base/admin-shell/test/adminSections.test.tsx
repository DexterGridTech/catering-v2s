import {act, render} from '@testing-library/react-native';
import {describe, expect, it} from 'vitest';
import {createUiCatalog, type UiCatalogContext} from '@catering-v2s/kernel-base-ui-state';
import {ADMIN_SECTION_CONTAINER_KEY} from '../src/foundations/adminIdentity';
import {selectAdminPageProjections} from '../src/foundations/adminSectionSelection';
import {useAdminSections, type AdminSectionsState} from '../src/hooks/useAdminSections';

const context: UiCatalogContext = {
  displayMode: 'PRIMARY',
  workspace: 'MAIN',
  instanceMode: 'MASTER',
  surfaceForm: 'laptop',
};

const entry = (partKey: string, title: string) => ({
  partKey,
  rendererKey: `${partKey}.laptop`,
  containerKeys: [ADMIN_SECTION_CONTAINER_KEY] as const,
  displayModes: ['PRIMARY'] as const,
  workspaces: ['MAIN'] as const,
  instanceModes: ['MASTER'] as const,
  surfaceForm: ['laptop'] as const,
  title,
  description: `${title} description`,
});

const Probe = ({
  catalog,
  onState,
}: Readonly<{
  readonly catalog: ReturnType<typeof createUiCatalog>;
  readonly onState: (state: AdminSectionsState) => void;
}>) => {
  const state = useAdminSections({catalog, context});
  onState(state);
  return null;
};

describe('useAdminSections', () => {
  it('maps raw runtime and display-context parts to one stable runtime page', () => {
    const catalog = createUiCatalog([
      entry('admin.console.runtime', '运行状态'),
      entry('admin.console.display-context', '运行状态（显示上下文）'),
      entry('admin.console.topology', '双机拓扑'),
    ]);

    expect(selectAdminPageProjections(catalog.entries)).toEqual([
      expect.objectContaining({
        pageKey: 'runtime',
        entry: expect.objectContaining({partKey: 'admin.console.runtime'}),
        spec: expect.objectContaining({
          key: 'runtime',
          title: '运行状态',
          sourcePartKeys: ['admin.console.runtime', 'admin.console.display-context'],
          rendererKey: 'admin.console.runtime.laptop',
        }),
      }),
      expect.objectContaining({
        pageKey: 'topology',
        entry: expect.objectContaining({partKey: 'admin.console.topology'}),
        spec: expect.objectContaining({
          key: 'topology',
          title: '双机拓扑',
          rendererKey: 'admin.console.topology.laptop',
        }),
      }),
    ]);
  });

  it('starts with no page selected and rejects unknown keys without choosing a fallback', async () => {
    const catalog = createUiCatalog([
      entry('admin.console.runtime', '运行状态'),
      entry('admin.console.topology', '双机拓扑'),
    ]);
    let state: AdminSectionsState | undefined;
    const renderer = await render(
      <Probe
        catalog={catalog}
        onState={next => {
          state = next;
        }}
      />,
    );
    expect(state?.sections.map(section => section.partKey)).toEqual([
      'admin.console.runtime',
      'admin.console.topology',
    ]);
    expect(state?.selectedPartKey).toBeNull();
    expect(state?.selectedSection).toBeUndefined();

    await act(() => {
      state?.selectSection('admin.console.topology');
    });
    expect(state?.selectedPartKey).toBe('admin.console.topology');
    expect(state?.selectedSection?.title).toBe('双机拓扑');

    await act(() => {
      state?.selectSection('admin.console.not-in-catalog');
    });
    expect(state?.selectedPartKey).toBe('admin.console.topology');
    await renderer.unmount();
  });

  it('keeps built-in pages ordered and appends integration-registered admin sections', () => {
    const catalog = createUiCatalog([
      entry('admin.console.platform-ports', '平台端口'),
      entry('admin.console.runtime', '运行状态'),
      entry('admin.console.display-context', '运行状态（显示上下文）'),
      entry('admin.console.topology', '双机拓扑'),
      entry('sample.console.admin-test', '示例诊断'),
    ]);

    expect(selectAdminPageProjections(catalog.entries).map(page => page.pageKey)).toEqual([
      'platform-ports',
      'runtime',
      'topology',
      undefined,
    ]);
    expect(selectAdminPageProjections(catalog.entries).map(page => page.entry.partKey)).toEqual([
      'admin.console.platform-ports',
      'admin.console.runtime',
      'admin.console.topology',
      'sample.console.admin-test',
    ]);
    expect(selectAdminPageProjections(catalog.entries)[3]).toMatchObject({
      entry: expect.objectContaining({title: '示例诊断'}),
      spec: undefined,
    });
  });
});
