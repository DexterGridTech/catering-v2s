import {Alert, Button, Select, Segmented, Space, Typography} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {adminListState, NameCodeText, testId, useCursorStack, useDetailDrawer} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useMemo, useRef, useState} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import type {Uuid} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {ACTION_CAPABILITIES} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {InventoryDetailDrawer} from './InventoryDetailDrawer';
import {
  envelopeData,
  hasCapability,
  inventoryAuthorityLabel,
  type InventoryCounts,
  type InventoryPage,
  type InventoryTargetSummary,
  type StockView,
} from './inventoryManagementModel';
import {catalogEnumLabel} from '../../catalog-management/model/catalogManifestLabels';

const stockLabels: Record<StockView, string> = {
  ALL: '全部',
  NEEDS_ATTENTION: '需处理',
  LOW: '低库存',
  OUT: '无库存',
  NEGATIVE: '负库存',
  UNKNOWN: '未知',
};
const stateLabels: Record<string, string> = {
  IN_STOCK: '在库',
  OK: '在库',
  LOW: '低库存',
  OUT: '无库存',
  NEGATIVE: '负库存',
  UNKNOWN: '未知',
};

export function InventoryManagementPage({queryContext, actionCapabilityKeys}: OperationsPageProps) {
  const [keyword, setKeyword] = useState<string>();
  const [categoryRef, setCategoryRef] = useState<string>();
  const pageSize = 20;
  const {
    page: cursorPage,
    cursor,
    canPrevious,
    goToPage,
    reset: resetCursor,
  } = useCursorStack({resetKey: queryContext.scopeRef ?? ''});
  const [view, setView] = useState<StockView>('ALL');
  const detail = useDetailDrawer<Uuid>();
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const scopeReady = Boolean(queryContext.scopeRef);
  const navigationRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogNavigation(
        {},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? ''), viewKey: 'ALL'}},
      ),
    [queryContext.scopeRef],
  );
  const navigation = operationsRtk.useGetOperationsCatalogNavigationQuery(navigationRequest, {skip: !scopeReady});
  const manifestRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogShapeManifest(
        {},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}},
      ),
    [queryContext.scopeRef],
  );
  const manifestQuery = operationsRtk.useGetOperationsCatalogShapeManifestQuery(manifestRequest, {skip: !scopeReady});
  const manifest = manifestQuery.currentData?.data;
  const categoryOptions = useMemo(
    () =>
      (navigation.currentData?.data.tree ?? []).map(node => ({
        value: node.categoryRef,
        label: <NameCodeText name={node.name} code={node.code} />,
      })),
    [navigation.currentData],
  );
  const request = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsInventoryTargets(
        {},
        {
          query: {
            ...(queryContext.scopeRef ? {dataNodeRef: queryContext.scopeRef} : {}),
            ...(keyword ? {keyword} : {}),
            ...(categoryRef ? {categoryRef: wireUuid(categoryRef)} : {}),
            stockView: view,
            ...(cursor ? {cursor} : {}),
            pageSize,
          },
        },
      ),
    [categoryRef, cursor, keyword, pageSize, queryContext.scopeRef, view],
  );
  const list = operationsRtk.useGetOperationsInventoryTargetsQuery(request, {skip: !scopeReady});
  const page = envelopeData<InventoryPage>(list.currentData);
  const rows = page?.items ?? [];
  const counts = useMemo<InventoryCounts>(() => {
    const serverCounts = page?.counts ?? {};
    return (Object.keys(stockLabels) as StockView[]).reduce<InventoryCounts>(
      (result, key) => ({...result, [key]: serverCounts[key] ?? 0}),
      {ALL: 0, NEEDS_ATTENTION: 0, LOW: 0, OUT: 0, NEGATIVE: 0, UNKNOWN: 0},
    );
  }, [page?.counts]);
  const canEdit = hasCapability(actionCapabilityKeys as readonly string[], ACTION_CAPABILITIES.EDIT_STORE_INVENTORY);
  const openDetail = useCallback((targetRef: Uuid) => detail.open(targetRef), [detail]);
  const closeDetail = useCallback(() => {
    detail.close();
    // The table row remains mounted while the detail Drawer closes. Restore
    // keyboard context after Ant Design finishes the close transition.
    window.requestAnimationFrame(() => detailTriggerRef.current?.focus());
  }, [detail]);
  const columns = useMemo<ProColumns<InventoryTargetSummary>[]>(
    () => [
      {
        key: 'keyword',
        title: '关键词',
        hideInTable: true,
        fieldProps: {...testId('inventory-filter-keyword'), allowClear: true, placeholder: '库存对象名称/编码'},
      },
      {
        key: 'categoryRef',
        title: '商品分类',
        hideInTable: true,
        renderFormItem: () => (
          <Select
            showSearch
            optionFilterProp="label"
            loading={navigation.isFetching}
            options={categoryOptions}
            allowClear
            placeholder="选择商品分类（可选）"
            {...testId('inventory-filter-category')}
          />
        ),
        fieldProps: {...testId('inventory-filter-category')},
      },
      {
        title: '库存对象',
        search: false,
        fixed: 'left',
        width: 220,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Button
              type="link"
              style={{padding: 0, height: 'auto'}}
              onClick={event => {
                detailTriggerRef.current = event.currentTarget;
                openDetail(row.targetRef);
              }}
              {...testId(`inventory-target-open-${row.targetRef}`)}
            >
              <NameCodeText name={row.productName ?? row.productCode} code={row.productCode} />
            </Button>
            <Typography.Text type="secondary" style={{fontSize: 12}}>
              {[catalogEnumLabel(manifest, 'inventoryNodeType', row.targetType), row.categoryName, row.materialRole]
                .filter(value => value && value !== '—')
                .join('｜') || '未分类'}
            </Typography.Text>
            {row.skuName && (
              <Typography.Text type="secondary" style={{fontSize: 12}}>
                SKU：
                <NameCodeText name={row.skuName} code={row.skuCode} />
              </Typography.Text>
            )}
          </Space>
        ),
      },
      {
        title: '当前库存 / 盘点换算',
        search: false,
        width: 180,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <span>
              {row.balance} {row.consumptionUnit}
            </span>
            <Typography.Text type="secondary" style={{fontSize: 12}}>
              {row.conversionSummary ?? (row.countingUnit ? `盘点单位：${row.countingUnit}` : '未配置盘点单位')}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: '状态 / 陈旧',
        search: false,
        width: 120,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <span>{stateLabels[row.stockState] ?? row.stockState}</span>
            {row.stale && (
              <Typography.Text type="warning" style={{fontSize: 12}}>
                数据陈旧
              </Typography.Text>
            )}
            {row.unknown && (
              <Typography.Text type="danger" style={{fontSize: 12}}>
                数据未知
              </Typography.Text>
            )}
          </Space>
        ),
      },
      {
        title: '阈值 / 差额',
        search: false,
        width: 120,
        render: (_, row) => (
          <span>
            {row.threshold ?? '—'} / {row.gap ?? '—'}
          </span>
        ),
      },
      {
        title: '今日 / 7天 / 30天',
        search: false,
        width: 180,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <span>
              {row.changeToday} / {row.change7d} / {row.change30d}
            </span>
            <Typography.Text type="secondary" style={{fontSize: 12}}>
              库存变化
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: '最近变化',
        search: false,
        width: 180,
        render: (_, row) =>
          row.lastChangeAt ? (
            <Space direction="vertical" size={0}>
              <span>{new Date(row.lastChangeAt).toLocaleString()}</span>
              <Typography.Text type="secondary" style={{fontSize: 12}}>
                {row.lastChangeSource ?? '—'}
              </Typography.Text>
            </Space>
          ) : (
            '—'
          ),
      },
      {title: '来源', search: false, width: 110, render: (_, row) => inventoryAuthorityLabel(row.authorityType)},
    ],
    [categoryOptions, manifest, navigation.isFetching, openDetail],
  );

  const problemCode = list.error ? operationsProblemOf(list.error).errorCode : undefined;
  const scopeForbidden = problemCode === 'SCOPE_FORBIDDEN';
  const problem = list.error && !scopeForbidden ? '库存数据暂时无法获取，已保留当前筛选，请重试。' : undefined;
  return (
    <section {...testId('inventory-store-status-page')}>
      {!scopeReady && (
        <Alert
          type="info"
          showIcon
          title="请选择管理范围"
          description="请选择一个门店后再查看库存对象。"
          style={{marginBottom: 16}}
          {...testId('inventory-scope-required')}
        />
      )}
      {scopeForbidden && (
        <Alert
          type="error"
          showIcon
          title="当前范围无权访问库存数据"
          description="请切换到有权限的门店；系统不会展示其他范围的库存对象。"
          action={<Button onClick={() => void list.refetch()}>重试</Button>}
          style={{marginBottom: 16}}
          {...testId('inventory-scope-forbidden')}
        />
      )}
      {problem && (
        <Alert
          type="error"
          showIcon
          title="门店库存管理未完成"
          description={problem}
          action={<Button onClick={() => void list.refetch()}>重试</Button>}
          style={{marginBottom: 16}}
          {...testId('inventory-list-problem')}
        />
      )}
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        <Segmented<StockView>
          value={view}
          onChange={next => {
            setView(next);
            resetCursor();
          }}
          options={(Object.keys(stockLabels) as StockView[]).map(key => ({
            value: key,
            label: `${stockLabels[key]} ${counts[key]}`,
          }))}
          {...testId('inventory-stock-view')}
        />
        <ProTable<InventoryTargetSummary>
          size="small"
          aria-label="门店库存管理"
          rowKey="targetRef"
          options={{density: false, fullScreen: false, reload: () => list.refetch()}}
          scroll={{x: 1250}}
          sticky
          dataSource={rows}
          columns={columns}
          {...adminListState({
            loading: list.isFetching,
            failed: Boolean(list.error) || !scopeReady,
            emptyText: '暂无库存对象',
            testIdPrefix: 'inventory-target-list',
          })}
          search={{
            labelWidth: 'auto',
            optionRender: searchConfig => [
              <Button
                key="submit"
                type="primary"
                onClick={() => searchConfig.form?.submit()}
                {...testId('inventory-filter-submit')}
              >
                查询
              </Button>,
              <Button
                key="reset"
                onClick={() => {
                  searchConfig.form?.resetFields();
                  setKeyword(undefined);
                  setCategoryRef(undefined);
                  resetCursor();
                }}
                {...testId('inventory-filter-reset')}
              >
                重置
              </Button>,
            ],
          }}
          onSubmit={values => {
            setKeyword(typeof values.keyword === 'string' ? values.keyword.trim() || undefined : undefined);
            setCategoryRef(typeof values.categoryRef === 'string' ? values.categoryRef.trim() || undefined : undefined);
            resetCursor();
          }}
          pagination={false}
          {...testId('inventory-target-table')}
        />
        <Space style={{display: 'flex', justifyContent: 'flex-end'}} {...testId('inventory-target-pagination')}>
          <Button
            disabled={!canPrevious}
            onClick={() => goToPage(cursorPage - 1)}
            {...testId('inventory-target-page-previous')}
          >
            上一页
          </Button>
          <Typography.Text type="secondary">第 {cursorPage} 页</Typography.Text>
          <Button
            disabled={!page?.cursor}
            onClick={() => goToPage(cursorPage + 1, page?.cursor)}
            {...testId('inventory-target-page-next')}
          >
            下一页
          </Button>
        </Space>
      </Space>
      <InventoryDetailDrawer
        targetRef={detail.isOpen ? detail.target : undefined}
        canEdit={canEdit}
        queryContext={queryContext}
        onClose={closeDetail}
        onListChanged={() => void list.refetch()}
      />
    </section>
  );
}
