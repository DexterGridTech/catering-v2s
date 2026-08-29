import {
  AppstoreOutlined,
  BulbOutlined,
  CustomerServiceOutlined,
  GiftOutlined,
  HistoryOutlined,
  InboxOutlined,
  ShoppingOutlined,
  StopOutlined,
  SyncOutlined,
  TagOutlined,
  TagsOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import {Button, Card, Dropdown, Input, Space, Tag, Tree} from 'antd';
import {EllipsisTooltip, NameCodeText, testId} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useMemo, type Key, type ReactNode} from 'react';
import {catalogTestIds, catalogTestIdControls} from '../catalogTestIds';
import type {CatalogNavigation} from '../model/catalogModel';
import type {CatalogCategoryAction} from '../model/catalogWorkspaceTask';
import type {CatalogTreeSelection, CatalogWorkbenchTreeNode} from './catalogWorkbenchPresentation';

export const defaultCatalogTreeExpandedKeys: Key[] = [
  'smart-root',
  'shape-root',
  'tag-root',
  'production-tag-root',
  'category-root',
];

const smartViewIcons: Record<string, ReactNode> = {
  EXTERNAL_ORDER_TEMP: <CustomerServiceOutlined />,
  INACTIVE: <StopOutlined />,
  RECENTLY_UPDATED: <HistoryOutlined />,
  AUTO_SYNC: <SyncOutlined />,
};

const shapeIcons: Record<string, ReactNode> = {
  STANDARD_SALE_COUNTED: <ShoppingOutlined />,
  SKU_VARIANT_SALE_COUNTED: <AppstoreOutlined />,
  STANDARD_SALE_WEIGHED: <ShoppingOutlined />,
  MATERIAL: <InboxOutlined />,
  COMPOSITE: <GiftOutlined />,
  SERVICE: <CustomerServiceOutlined />,
  BENEFIT_SHELL: <GiftOutlined />,
};

function CatalogTreeLine({
  label,
  count,
  icon,
  action,
  children,
  ...rest
}: {
  label: string;
  count?: number;
  icon?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      aria-label={rest['aria-label'] ?? label}
      style={{display: 'flex', alignItems: 'center', gap: 6, minWidth: 0}}
    >
      {icon}
      <EllipsisTooltip title={label}>
        <span style={{minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
          {children ?? label}
        </span>
      </EllipsisTooltip>
      {typeof count === 'number' ? <Tag style={{marginInlineEnd: 0, flex: '0 0 auto'}}>{count}</Tag> : null}
      {action ? <span style={{marginInlineStart: 'auto', flex: '0 0 auto'}}>{action}</span> : null}
    </div>
  );
}

type Props = {
  navigation?: CatalogNavigation;
  selection: CatalogTreeSelection;
  search: string;
  expandedKeys: Key[];
  canWriteCatalog: boolean;
  smartViewLabel: (viewKey: string) => string;
  shapeLabel: (shapeKey: string) => string;
  onSearchChange: (search: string) => void;
  onExpandedKeysChange: (keys: Key[]) => void;
  onSelection: (selection: CatalogTreeSelection) => void;
  onOpenCategory: (action: CatalogCategoryAction, node?: CatalogNavigation['tree'][number]) => void;
  onRememberCategoryTrigger: (event: React.MouseEvent<HTMLElement>) => void;
};

type CategoryTreeNode = CatalogNavigation['tree'][number];

/**
 * The owner is the write boundary for the three-level limit. The navigation tree mirrors that
 * fact at the entry point so a third-level category never advertises an impossible child task.
 * A malformed or cyclic navigation response fails closed here; the owner remains authoritative.
 */
export const catalogCategoryDepthLimitCopy = '商品分类最多只能建立三级';

export function catalogCategoryCanCreateChild(
  node: CategoryTreeNode,
  categories: readonly CategoryTreeNode[],
): boolean {
  const byRef = new Map(categories.map(category => [category.categoryRef, category]));
  const visited = new Set([node.categoryRef]);
  let depth = 1;
  let parentRef = node.parentCategoryRef;
  while (parentRef !== null) {
    if (visited.has(parentRef)) return false;
    visited.add(parentRef);
    const parent = byRef.get(parentRef);
    if (!parent) return false;
    depth += 1;
    if (depth >= 3) return false;
    parentRef = parent.parentCategoryRef;
  }
  return true;
}

/**
 * Owns tree presentation only: hierarchy derivation, search expansion and tree action menus.
 * It receives owner facts and task callbacks but never owns catalog task state or rewrites facts.
 */
export function CatalogWorkbenchNavigationTree({
  navigation,
  selection,
  search,
  expandedKeys,
  canWriteCatalog,
  smartViewLabel,
  shapeLabel,
  onSearchChange,
  onExpandedKeysChange,
  onSelection,
  onOpenCategory,
  onRememberCategoryTrigger,
}: Props) {
  const treeData = useMemo<CatalogWorkbenchTreeNode[]>(() => {
    if (!navigation) return [];
    const match = search.trim().toLocaleLowerCase();
    const categoryByParent = new Map<string, CatalogNavigation['tree']>();
    navigation.tree.forEach(node => {
      const parent = node.parentCategoryRef ?? '';
      categoryByParent.set(parent, [...(categoryByParent.get(parent) ?? []), node]);
    });
    const categoryMatches = (node: CatalogNavigation['tree'][number]): boolean =>
      !match ||
      node.name.toLocaleLowerCase().includes(match) ||
      node.code.toLocaleLowerCase().includes(match) ||
      (categoryByParent.get(node.categoryRef) ?? []).some(categoryMatches);
    const renderCategory = (node: CatalogNavigation['tree'][number]): CatalogWorkbenchTreeNode => {
      const siblings = (categoryByParent.get(node.parentCategoryRef ?? '') ?? [])
        .slice()
        .sort((left, right) => left.displayOrder - right.displayOrder || left.code.localeCompare(right.code));
      const siblingIndex = siblings.findIndex(sibling => sibling.categoryRef === node.categoryRef);
      const canMoveUp = siblingIndex > 0;
      const canMoveDown = siblingIndex >= 0 && siblingIndex < siblings.length - 1;
      const canCreateChild = catalogCategoryCanCreateChild(node, navigation.tree);
      return {
        key: `CATEGORY:${node.categoryRef}`,
        title: (
          <CatalogTreeLine
            label={node.name}
            count={node.count}
            action={
              canWriteCatalog && (
                <span
                  onClick={event => event.stopPropagation()}
                  onDoubleClick={event => event.stopPropagation()}
                  onKeyDown={event => event.stopPropagation()}
                  onMouseDown={event => {
                    onRememberCategoryTrigger(event);
                    event.stopPropagation();
                  }}
                >
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        {
                          key: 'create-child',
                          label: '新建子分类',
                          disabled: !canCreateChild,
                          title: canCreateChild ? undefined : catalogCategoryDepthLimitCopy,
                        },
                        {key: 'rename', label: '重命名'},
                        {key: 'reparent', label: '更换父分类'},
                        {
                          key: 'move-up',
                          label: '向上移动',
                          disabled: !canMoveUp,
                          title: canMoveUp ? undefined : '分类已位于当前层级首位',
                        },
                        {
                          key: 'move-down',
                          label: '向下移动',
                          disabled: !canMoveDown,
                          title: canMoveDown ? undefined : '分类已位于当前层级末位',
                        },
                        {
                          key: 'delete',
                          label: '标记删除分类',
                          danger: true,
                          disabled: !node.deletionAvailability.canDelete,
                          title: node.deletionAvailability.canDelete
                            ? undefined
                            : `仍有 ${node.deletionAvailability.blockingReferenceCount} 个商品引用`,
                        },
                      ],
                      onClick: ({key}) => {
                        const actionByKey: Record<string, CatalogCategoryAction> = {
                          'create-child': 'CREATE',
                          rename: 'RENAME',
                          reparent: 'REPARENT',
                          'move-up': 'MOVE_UP',
                          'move-down': 'MOVE_DOWN',
                          delete: 'DELETE',
                        };
                        const action = actionByKey[key];
                        if (action) onOpenCategory(action, node);
                      },
                    }}
                  >
                    <Button
                      type="text"
                      size="small"
                      aria-label={`分类 ${node.name} 操作`}
                      {...testId(catalogTestIdControls.workbench.categoryActions(node.code))}
                    >
                      ···
                    </Button>
                  </Dropdown>
                </span>
              )
            }
            {...testId(catalogTestIdControls.workbench.categoryNode(node.code))}
          >
            <NameCodeText name={node.name} code={node.code} />
          </CatalogTreeLine>
        ),
        children: (categoryByParent.get(node.categoryRef) ?? []).filter(categoryMatches).map(renderCategory),
      };
    };
    return [
      {key: 'SMART:ALL', title: <CatalogTreeLine label="全部商品" count={navigation.allCount} />},
      {
        key: 'smart-root',
        title: <CatalogTreeLine label="智能视图" icon={<BulbOutlined />} />,
        selectable: false,
        children: navigation.smartViews.map(node => ({
          key: `SMART:${node.viewKey}`,
          title: (
            <CatalogTreeLine
              label={smartViewLabel(node.viewKey)}
              count={node.count}
              icon={smartViewIcons[node.viewKey] ?? <AppstoreOutlined />}
            />
          ),
        })),
      },
      {
        key: 'shape-root',
        title: <CatalogTreeLine label="商品形态" icon={<AppstoreOutlined />} />,
        selectable: false,
        children: navigation.shapeCounts.map(node => ({
          key: `SHAPE:${node.shapeKey}`,
          title: (
            <CatalogTreeLine
              label={shapeLabel(node.shapeKey)}
              count={node.count}
              icon={shapeIcons[node.shapeKey] ?? <AppstoreOutlined />}
            />
          ),
        })),
      },
      {
        key: 'tag-root',
        title: <CatalogTreeLine label="商品标签" icon={<TagOutlined />} />,
        selectable: false,
        children: navigation.tags
          .filter(
            node =>
              !match || node.name.toLocaleLowerCase().includes(match) || node.code.toLocaleLowerCase().includes(match),
          )
          .map(node => ({
            key: `TAG:${node.tagRef}`,
            title: (
              <CatalogTreeLine label={node.name} count={node.count} icon={<TagOutlined />}>
                <NameCodeText name={node.name} code={node.code} />
              </CatalogTreeLine>
            ),
          })),
      },
      {
        key: 'production-tag-root',
        title: <CatalogTreeLine label="生产标签" icon={<ToolOutlined />} />,
        selectable: false,
        children: navigation.productionTags
          .filter(
            node =>
              !match || node.name.toLocaleLowerCase().includes(match) || node.code.toLocaleLowerCase().includes(match),
          )
          .map(node => ({
            key: `PRODUCTION_TAG:${node.tagRef}`,
            title: (
              <CatalogTreeLine label={node.name} count={node.count} icon={<ToolOutlined />}>
                <Space size={4}>
                  <NameCodeText name={node.name} code={node.code} />
                  {node.status === 'DISABLED' && <Tag color="default">已停用</Tag>}
                </Space>
              </CatalogTreeLine>
            ),
          })),
      },
      {
        key: 'category-root',
        title: (
          <CatalogTreeLine
            label="商品分类"
            icon={<TagsOutlined />}
            action={
              canWriteCatalog && (
                <Button
                  type="link"
                  size="small"
                  onClick={event => {
                    event.stopPropagation();
                    onOpenCategory('CREATE');
                  }}
                  {...testId(catalogTestIds.static.categoryCreateRoot)}
                >
                  新建分类
                </Button>
              )
            }
          />
        ),
        selectable: false,
        children: [
          {
            key: 'UNCATEGORIZED:UNCATEGORIZED',
            title: <CatalogTreeLine label="未分类" count={navigation.uncategorizedCount ?? 0} />,
          },
          ...(categoryByParent.get('') ?? []).filter(categoryMatches).map(renderCategory),
        ],
      },
    ];
  }, [canWriteCatalog, navigation, onOpenCategory, onRememberCategoryTrigger, search, shapeLabel, smartViewLabel]);

  const visibleExpandedKeys = useMemo<Key[]>(() => {
    if (!search.trim()) return expandedKeys;
    const keys: Key[] = [];
    const visit = (nodes: CatalogWorkbenchTreeNode[]) =>
      nodes.forEach(node => {
        if (!node.children?.length) return;
        keys.push(node.key);
        visit(node.children);
      });
    visit(treeData);
    return keys;
  }, [expandedKeys, search, treeData]);

  const selectTreeKey = useCallback(
    (selectedKey: string) => {
      if (!navigation) return;
      const [kind, ...ref] = selectedKey.split(':');
      if (!['SMART', 'SHAPE', 'CATEGORY', 'TAG', 'PRODUCTION_TAG', 'UNCATEGORIZED'].includes(kind)) return;
      const key = ref.join(':');
      if (kind === 'TAG') {
        const tag = navigation.tags.find(node => node.tagRef === key);
        if (tag) onSelection({kind: 'TAG', ref: key, label: tag.name});
        return;
      }
      if (kind === 'PRODUCTION_TAG') {
        const tag = navigation.productionTags.find(node => node.tagRef === key);
        if (tag) onSelection({kind: 'PRODUCTION_TAG', ref: key, label: tag.name});
        return;
      }
      const label =
        kind === 'SMART'
          ? smartViewLabel(key)
          : kind === 'SHAPE'
            ? shapeLabel(key)
            : kind === 'UNCATEGORIZED'
              ? '未分类'
              : (navigation.tree.find(node => node.categoryRef === key)?.name ?? key);
      onSelection({kind: kind as CatalogTreeSelection['kind'], ref: key, label});
    },
    [navigation, onSelection, shapeLabel, smartViewLabel],
  );

  return (
    <Card
      size="small"
      style={{width: 312, flex: '0 0 312px'}}
      title="商品视图、标签和分类"
      {...testId(catalogTestIds.surface.navigationTree)}
    >
      <Input.Search
        allowClear
        placeholder="搜索标签或分类名称/编码"
        value={search}
        onChange={event => onSearchChange(event.target.value)}
        {...testId(catalogTestIds.control.treeSearch)}
      />
      {!navigation ? (
        <div aria-live="polite" {...testId(catalogTestIds.static.inventoryTreeLoading)}>
          正在加载商品视图…
        </div>
      ) : (
        <Tree
          blockNode
          expandedKeys={visibleExpandedKeys}
          onExpand={keys => onExpandedKeysChange(keys)}
          selectedKeys={[`${selection.kind}:${selection.ref}`]}
          treeData={treeData}
          onSelect={keys => selectTreeKey(String(keys[0] ?? ''))}
          style={{marginTop: 12}}
        />
      )}
    </Card>
  );
}
