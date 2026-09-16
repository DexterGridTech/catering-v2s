import {describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {App} from 'antd';
import {Provider} from 'react-redux';
import {operationsStore} from '../../../app/state/OperationsStore';
import {SalesMenuPage, salesMenuCategoryTreeData} from './SalesMenuPage';

// This page composes the existing catalog detail surface. Its catalog editor
// dependency imports ProList, whose published CJS entry is not executable as
// ESM under this Vitest workspace. The page tests do not mount that editor.
vi.mock('@ant-design/pro-components', () => ({ProList: () => null}));

const category = (categoryRef: string, name: string, parentCategoryRef: string | null, displayOrder: number) => ({
  categoryRef: categoryRef as never,
  code: categoryRef.toUpperCase(),
  name,
  parentCategoryRef: parentCategoryRef as never,
  version: 1,
  displayOrder,
  count: 0,
  directCount: 0,
  countSemantics: 'SELF_ONLY' as const,
  deletionAvailability: {
    canDelete: true,
    subtreeSize: 0,
    blockingReferenceCount: 0,
    blockingReferences: {count: 0, references: []},
  },
});

describe('sales menu page boundary', () => {
  it('renders the complete catalog navigation tree shape, including empty categories', () => {
    expect(
      salesMenuCategoryTreeData([
        category('child', '子分类', 'root', 2),
        category('empty', '空分类', null, 3),
        category('root', '根分类', null, 1),
      ]),
    ).toEqual([
      {title: '根分类', key: 'root', children: [{title: '子分类', key: 'child'}]},
      {title: '空分类', key: 'empty'},
    ]);
  });

  it('keeps orphaned and cyclic catalog categories visible instead of silently dropping them', () => {
    const tree = salesMenuCategoryTreeData([
      category('cycle-a', '循环 A', 'cycle-b', 1),
      category('orphan', '孤儿分类', 'missing-parent', 2),
      category('cycle-b', '循环 B', 'cycle-a', 3),
    ]);
    expect(tree).toEqual([
      {title: '循环 A', key: 'cycle-a', children: [{title: '循环 B', key: 'cycle-b'}]},
      {title: '孤儿分类', key: 'orphan'},
    ]);
    expect(tree.flatMap(node => [node.key, ...(node.children ?? []).map(child => child.key)])).toEqual([
      'cycle-a',
      'cycle-b',
      'orphan',
    ]);
  });

  it('renders from the global store scope without adding a page-local store selector', () => {
    const markup = renderToStaticMarkup(
      <Provider store={operationsStore}>
        <App>
          <SalesMenuPage
            queryContext={{
              groupWorkspaceKey: 'workspace-1',
              expectedContextVersion: 3,
              scopeRef: '00000000-0000-4000-8000-000000000001' as never,
            }}
            actionCapabilityKeys={[]}
          />
        </App>
      </Provider>,
    );
    expect(markup).not.toContain('门店销售菜单');
    expect(markup).toContain('data-scope-ref="00000000-0000-4000-8000-000000000001"');
    expect(markup).toContain('data-testid="operations-store-operating-rule-loading"');
    expect(markup).not.toContain('data-testid="sales-menu-selector-input"');
    expect(markup).not.toContain('选择门店');
    expect(markup).not.toContain('门店选择器');
  });
});
