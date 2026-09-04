import {Alert, Button, Card, Col, Drawer, Input, Row, Space, Spin, Table, Tree, Typography} from 'antd';
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import {
  CursorPagination,
  adminListState,
  adminWideDrawerSurfaceProps,
  testId,
  useDrawerFormLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import {operationsLogger, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type SalesMenuItemCandidate,
  type Uuid,
} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {
  formatSalesMenuPrice,
  mergeSalesMenuCandidateSelection,
  salesMenuCandidateSelection,
  salesMenuProductShapeLabel,
} from '../model/salesMenuModel';
import {salesMenuTestIds} from '../salesMenuTestIds';
import {problemMessage, salesMenuCategoryTreeData, type SalesMenuReadModel} from './salesMenuUiShared';

export function SalesMenuCandidateDrawer({
  open,
  read,
  onClose,
  onAdd,
  onClosedFocus,
}: {
  open: boolean;
  read: SalesMenuReadModel;
  onClose: () => void;
  onAdd: (refs: Uuid[]) => Promise<boolean>;
  onClosedFocus: () => void;
}) {
  const [selected, setSelected] = useState<Uuid[]>([]);
  const openedRef = useRef(false);
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: next => {
      if (!next) onClose();
    },
    dirtyMessage: '已选择的商品尚未加入菜单。',
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.getOperationsSalesMenuItemCandidates,
  });
  const resetLifecycle = lifecycle.reset;
  const categoryNavigationRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogNavigation(
        {},
        {query: {dataNodeRef: wireUuid(read.storeRef ?? ''), viewKey: 'ALL'}},
      ),
    [read.storeRef],
  );
  const categoryNavigationQuery = operationsRtk.useGetOperationsCatalogNavigationQuery(categoryNavigationRequest, {
    skip: !open || !read.storeRef,
  });
  const categoryNavigation = categoryNavigationQuery.currentData?.data;
  const categoryTreeData = useMemo(
    () => salesMenuCategoryTreeData(categoryNavigation?.tree ?? []),
    [categoryNavigation?.tree],
  );
  useEffect(() => {
    setSelected([]);
    resetLifecycle();
  }, [open, resetLifecycle]);
  const page = read.candidates.page;
  const rows = useMemo(() => page?.items ?? [], [page?.items]);
  const candidatePageOutcome = read.candidates.query.isError
    ? 'FAILED'
    : read.candidates.query.isFetching
      ? 'FETCHING'
      : page
        ? rows.length > 0
          ? 'READY_WITH_ITEMS'
          : 'READY_EMPTY'
        : 'WAITING';
  useEffect(() => {
    operationsLogger.info({
      event: 'sales-menu.candidates.page',
      phase: 'CANDIDATE_READ_MODEL',
      outcome: candidatePageOutcome,
      operationId: OPERATIONS_ADMIN_OPERATION_IDS.getOperationsSalesMenuItemCandidates,
    });
  }, [candidatePageOutcome]);
  const selection = useMemo(
    () =>
      salesMenuCandidateSelection(
        selected,
        rows.map(row => row.candidateRef),
      ),
    [rows, selected],
  );
  const hiddenSelectedCount = selection.hiddenSelectedCount;
  const error = problemMessage(read.candidates.query.error, '商品候选暂时无法获取，请重试。');
  const categoryError = problemMessage(categoryNavigationQuery.error, '商品分类暂时无法读取，请重试。');
  const submit = useCallback(async () => {
    if (!selection.canSubmit || lifecycle.submitting) return;
    lifecycle.setSubmitting(true);
    const added = await onAdd(selected);
    if (added) lifecycle.closeAfterSuccess();
    else lifecycle.setSubmitting(false);
  }, [lifecycle, onAdd, selected, selection.canSubmit]);
  const handleAfterOpenChange = useCallback(
    (visible: boolean) => {
      lifecycle.afterOpenChange(visible);
      if (visible) {
        openedRef.current = true;
        return;
      }
      if (openedRef.current && !open) {
        openedRef.current = false;
        window.requestAnimationFrame(onClosedFocus);
      }
    },
    [lifecycle, onClosedFocus, open],
  );
  return (
    <Drawer
      open={open}
      title="添加商品到菜单"
      onClose={lifecycle.requestClose}
      afterOpenChange={handleAfterOpenChange}
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      closable={!lifecycle.submitting}
      {...adminWideDrawerSurfaceProps}
      width="min(860px, calc(100vw - 48px))"
      footer={
        <Space>
          <Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>
            取消
          </Button>
          <Button
            type="primary"
            disabled={!selection.canSubmit}
            loading={lifecycle.submitting}
            onClick={() => void submit()}
            {...testId(salesMenuTestIds.candidateSubmit)}
          >
            添加已选商品
          </Button>
        </Space>
      }
      {...testId(salesMenuTestIds.candidateDrawer)}
    >
      <Row gutter={[16, 16]} align="top">
        <Col xs={24} md={7}>
          <Card size="small" title="商品分类" bodyStyle={{maxHeight: 560, overflowY: 'auto'}}>
            {categoryError && <Alert type="error" showIcon title={categoryError} />}
            {!categoryError && categoryNavigationQuery.isLoading && <Spin />}
            {!categoryError && !categoryNavigationQuery.isLoading && (
              <Tree
                blockNode
                showLine
                aria-label="商品分类树"
                treeData={categoryTreeData}
                selectedKeys={read.candidateCategoryRef ? [read.candidateCategoryRef] : []}
                onSelect={keys => {
                  const next = String(keys[0] ?? '');
                  setSelected([]);
                  lifecycle.setDirty(false);
                  read.setCandidateCategoryRef(next ? (next as Uuid) : undefined);
                  read.candidates.cursor.reset();
                }}
                {...testId(salesMenuTestIds.candidateCategoryTree)}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} md={17}>
          <Space direction="vertical" size={12} style={{display: 'flex'}}>
            <Input.Search
              value={read.candidateQuery}
              allowClear
              placeholder="搜索商品名称或编码"
              onChange={event => {
                setSelected([]);
                lifecycle.setDirty(false);
                read.setCandidateQuery(event.target.value);
                read.candidates.cursor.reset();
              }}
              onSearch={() => {
                setSelected([]);
                lifecycle.setDirty(false);
                read.candidates.cursor.reset();
              }}
              {...testId(salesMenuTestIds.candidateSearch)}
            />
            <Typography.Text type="secondary">分类只用于查找商品；候选商品按商品形态展示。</Typography.Text>
            {hiddenSelectedCount > 0 && (
              <Alert
                type="warning"
                showIcon
                title={`当前还有 ${hiddenSelectedCount} 个已选商品不在本页；提交按钮会包含这些已选商品。`}
                action={
                  <Button
                    size="small"
                    onClick={() => {
                      setSelected(selection.visibleSelected as Uuid[]);
                      lifecycle.setDirty(selection.visibleSelected.length > 0);
                    }}
                  >
                    清除不可见选择
                  </Button>
                }
              />
            )}
            {error && (
              <Alert
                type="error"
                showIcon
                title={error}
                action={<Button onClick={() => void read.candidates.query.refetch()}>重试</Button>}
              />
            )}
            <Table<SalesMenuItemCandidate>
              size="small"
              rowKey="candidateRef"
              {...adminListState({
                loading: read.candidates.query.isFetching,
                failed: Boolean(error),
                emptyText: '该分类暂无可编入商品',
                testIdPrefix: salesMenuTestIds.candidateList,
              })}
              dataSource={rows}
              rowSelection={{
                selectedRowKeys: selected,
                preserveSelectedRowKeys: true,
                renderCell: (_checked, row, _index, originNode) =>
                  isValidElement(originNode)
                    ? cloneElement(
                        originNode as ReactElement<{['data-testid']?: string}>,
                        testId(salesMenuTestIds.candidateRow(row.candidateRef)),
                      )
                    : originNode,
                onChange: keys => {
                  const visibleRefs = rows.map(row => row.candidateRef);
                  const next = mergeSalesMenuCandidateSelection(
                    selected,
                    visibleRefs,
                    (keys as Array<string | number>)
                      .map(String)
                      .filter((candidateRef): candidateRef is Uuid => visibleRefs.includes(candidateRef as Uuid)),
                  ) as Uuid[];
                  const visibleRefSet = new Set(visibleRefs);
                  operationsLogger.debug({
                    event: 'sales-menu.candidates.selection',
                    phase: 'CANDIDATE_SELECTION',
                    outcome: 'UPDATED',
                    operationId: OPERATIONS_ADMIN_OPERATION_IDS.getOperationsSalesMenuItemCandidates,
                    diagnostic: {
                      selectedCount: next.length,
                      visibleSelectedCount: next.filter(candidateRef => visibleRefSet.has(candidateRef)).length,
                      preservedOffPageCount: next.filter(candidateRef => !visibleRefSet.has(candidateRef)).length,
                    },
                  });
                  setSelected(next);
                  lifecycle.setDirty(next.length > 0);
                  lifecycle.markBusinessIntentChanged();
                },
              }}
              pagination={false}
              columns={[
                {title: '商品名称', dataIndex: 'displayName', key: 'displayName'},
                {title: '商品编码', dataIndex: 'itemCode', key: 'itemCode'},
                {
                  title: '中文商品形态',
                  key: 'productShape',
                  render: (_, row) => salesMenuProductShapeLabel(row.productShape),
                },
                {
                  title: '所属分类',
                  key: 'categoryNames',
                  render: (_, row) => (row.categoryNames.length > 0 ? row.categoryNames.join(' / ') : '未分类'),
                },
                {
                  title: '默认价格',
                  key: 'defaultPriceCents',
                  render: (_, row) => formatSalesMenuPrice(row.defaultPriceCents),
                },
                {title: '已编入次数', dataIndex: 'alreadyAddedCount', key: 'alreadyAddedCount'},
              ]}
            />
            <CursorPagination
              state={read.candidates.cursor}
              nextCursor={page?.nextCursor ?? undefined}
              testIdPrefix={salesMenuTestIds.candidateCursor}
            />
          </Space>
        </Col>
      </Row>
    </Drawer>
  );
}
