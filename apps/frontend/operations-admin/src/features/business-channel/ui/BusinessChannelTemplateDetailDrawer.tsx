import {Alert, Button, Card, Descriptions, Drawer, Space, Tag, Typography} from 'antd';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  CursorPagination,
  NameCodeText,
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  closedCodeLabel,
  isKnownClosedCode,
  testId,
  useDetailDrawer,
  useAsyncGenerationGuard,
  useCursorStack,
  useOverlayLock,
  useRefreshVersion,
} from '@catering-v2s/admin-ui-foundation';
import type {
  BusinessChannelTemplateView,
  BusinessChannelTemplateVisibleStore,
} from '../../../app/api/generated/operations-edge';
import type {OperationsPageContext} from '../../../app/routing/model';
import {useEffect, useState} from 'react';
import {operationsContentTabRefreshSignal, operationsProblemOf} from '../../../app/api/OperationsTransport';
import {readBusinessChannelTemplateVisibleStores, readExternalProviderCandidates} from '../application/queries';
import {businessChannelTemplateTestIds} from '../../../app/automation/businessChannelTemplateTestIds';
import {
  accessKindLabels,
  dineInFormLabels,
  lifecycleStatusLabels,
  businessChannelTemplateStoreVisibilitySummary,
  organizationStoreStatusLabels,
  operatorKindLabels,
  orderKindLabels,
} from '../model/businessChannelCodeLabels';
import {operationsDetailDrawerTestIds} from '../../../app/automation/operationsDetailDrawerTestIds';

export function BusinessChannelTemplateDetailDrawer({
  open,
  queryContext,
  template,
  onClose,
  onEdit,
  onStatusChange,
}: {
  open: boolean;
  queryContext: OperationsPageContext;
  template?: BusinessChannelTemplateView;
  onClose: () => void;
  onEdit: (template: BusinessChannelTemplateView) => void;
  onStatusChange: (template: BusinessChannelTemplateView, status: 'ENABLED' | 'DISABLED') => Promise<void>;
}) {
  const detail = useDetailDrawer<BusinessChannelTemplateView>();
  const [providerName, setProviderName] = useState<string>();
  const [providerProblem, setProviderProblem] = useState<string>();
  const [statusProblem, setStatusProblem] = useState<string>();
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [visibleStores, setVisibleStores] = useState<BusinessChannelTemplateVisibleStore[]>([]);
  const [visibleStoreNextCursor, setVisibleStoreNextCursor] = useState<string>();
  const [visibleStoreTotal, setVisibleStoreTotal] = useState(0);
  const [visibleStoreProblem, setVisibleStoreProblem] = useState<string>();
  const [visibleStoreLoading, setVisibleStoreLoading] = useState(false);
  const [visibleStoreRefreshVersion, setVisibleStoreRefreshVersion] = useState(0);
  const visibleStoreGeneration = useAsyncGenerationGuard();
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  useOverlayLock(open);

  const {open: openDetail, close: closeDetail, target} = detail;
  const visibleStorePage = useCursorStack({
    resetKey: [open, target?.templateRef ?? '', target?.storeVisibilityScope ?? '', visibleStoreRefreshVersion].join(
      '|',
    ),
  });
  const targetStatusKnown = target ? isKnownClosedCode(lifecycleStatusLabels, target.status) : false;
  useEffect(() => {
    if (open && template) openDetail(template);
    else closeDetail();
  }, [closeDetail, open, openDetail, template]);

  useEffect(() => {
    if (!open || !target?.providerCode) {
      setProviderName(undefined);
      setProviderProblem(undefined);
      return;
    }
    setProviderName(undefined);
    setProviderProblem(undefined);
    const capabilityClass =
      target.orderKind === 'DINE_IN' || target.orderKind === 'TAKEAWAY' || target.orderKind === 'GROUP_BUY'
        ? target.orderKind
        : undefined;
    void readExternalProviderCandidates(queryContext, capabilityClass, target.operatorKind)
      .then(providers =>
        setProviderName(providers.find(provider => provider.providerCode === target.providerCode)?.displayName),
      )
      .catch(error => setProviderProblem(operationsProblemOf(error).detail));
  }, [contentTabRefreshVersion, open, queryContext, target]);

  useEffect(() => {
    const shouldReadVisibleStores =
      open && target?.operatorKind === 'STORE' && target.storeVisibilityScope === 'SELECTED_PROJECT_STORES';
    if (!shouldReadVisibleStores || !target) {
      visibleStoreGeneration.invalidate();
      setVisibleStores([]);
      setVisibleStoreNextCursor(undefined);
      setVisibleStoreTotal(0);
      setVisibleStoreProblem(undefined);
      setVisibleStoreLoading(false);
      return;
    }
    const requestGeneration = visibleStoreGeneration.begin();
    setVisibleStoreLoading(true);
    setVisibleStoreProblem(undefined);
    void readBusinessChannelTemplateVisibleStores(
      queryContext,
      target.templateRef,
      'NON_VOIDED',
      visibleStorePage.cursor,
      20,
    )
      .then(page => {
        if (!visibleStoreGeneration.isCurrent(requestGeneration)) return;
        setVisibleStores(page.items);
        setVisibleStoreNextCursor(page.nextCursor ?? undefined);
        setVisibleStoreTotal(page.total);
      })
      .catch(error => {
        if (!visibleStoreGeneration.isCurrent(requestGeneration)) return;
        setVisibleStoreProblem(operationsProblemOf(error).detail || '门店范围读取失败，请重试。');
      })
      .finally(() => {
        if (visibleStoreGeneration.isCurrent(requestGeneration)) setVisibleStoreLoading(false);
      });
  }, [open, queryContext, target, visibleStoreGeneration, visibleStorePage.cursor, visibleStoreRefreshVersion]);

  const transitionStatus = async () => {
    if (!target || !targetStatusKnown) {
      if (target) setStatusProblem('当前模板状态无法识别，已停止该操作。');
      return;
    }
    setStatusProblem(undefined);
    setStatusSubmitting(true);
    try {
      await onStatusChange(target, target.status === 'ENABLED' ? 'DISABLED' : 'ENABLED');
      closeDetail();
      onClose();
    } catch (error) {
      setStatusProblem(operationsProblemOf(error).detail);
    } finally {
      setStatusSubmitting(false);
    }
  };
  const actionItems =
    target && targetStatusKnown && target.status !== 'VOIDED'
      ? [
          {
            key: 'edit',
            label: (
              <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.businessChannelTemplate.edit}>
                编辑
              </AdminDetailActionLabel>
            ),
            onClick: () => {
              closeDetail();
              onClose();
              onEdit(target);
            },
          },
          {
            key: 'status',
            danger: target.status === 'ENABLED',
            disabled: statusSubmitting,
            label: (
              <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.businessChannelTemplate.status}>
                {target.status === 'ENABLED' ? '停用' : '启用'}
              </AdminDetailActionLabel>
            ),
            onClick: () => void transitionStatus(),
          },
        ]
      : [];

  return (
    <Drawer
      open={open}
      title={target ? `渠道模板详情：${target.templateName}` : '渠道模板详情'}
      onClose={() => {
        closeDetail();
        onClose();
      }}
      size={640}
      destroyOnHidden
      maskClosable
      {...adminDrawerSurfaceProps}
      {...testId('business-channel-template-detail')}
      extra={
        actionItems.length > 0 ? (
          <AdminDetailActionMenu
            items={actionItems}
            triggerTestId={operationsDetailDrawerTestIds.businessChannelTemplate.actionMenu}
            disabled={statusSubmitting}
            loading={statusSubmitting}
          />
        ) : undefined
      }
    >
      {statusProblem && <Alert type="error" showIcon title="状态更新失败" description={statusProblem} />}
      {providerProblem && (
        <Alert
          type="warning"
          showIcon
          title="外部接入档案名称暂时无法获取"
          description={providerProblem}
          style={{marginBottom: 16}}
        />
      )}
      {target && (
        <Descriptions
          {...adminDetailDescriptionsProps}
          items={[
            {key: 'name', label: '模板名称', children: target.templateName},
            {key: 'code', label: '模板编码', children: target.templateCode || '—'},
            {key: 'access', label: '接入类型', children: closedCodeLabel(accessKindLabels, target.accessKind)},
            {key: 'operator', label: '经营主体', children: closedCodeLabel(operatorKindLabels, target.operatorKind)},
            {key: 'order', label: '订单类型', children: closedCodeLabel(orderKindLabels, target.orderKind)},
            {
              key: 'storeVisibilityScope',
              label: '门店可见范围',
              children: businessChannelTemplateStoreVisibilitySummary(target),
            },
            {
              key: 'dineInForm',
              label: '到店点餐形式',
              children:
                target.accessKind === 'EXTERNAL' && target.orderKind === 'DINE_IN'
                  ? '外部系统不使用 POS、扫码或自助机点餐形式'
                  : target.dineInForm
                    ? closedCodeLabel(dineInFormLabels, target.dineInForm)
                    : '未配置',
            },
            {key: 'provider', label: '外部接入档案', children: providerName ?? '—'},
            {
              key: 'status',
              label: '状态',
              children: <Tag>{closedCodeLabel(lifecycleStatusLabels, target.status)}</Tag>,
            },
          ]}
        />
      )}
      {target?.operatorKind === 'STORE' && target.storeVisibilityScope === 'SELECTED_PROJECT_STORES' && (
        <Card
          size="small"
          title="已选门店"
          style={{marginTop: 16}}
          extra={<Typography.Text type="secondary">共 {visibleStoreTotal} 家非作废门店</Typography.Text>}
        >
          <Typography.Paragraph type="secondary">范围变更只影响新建渠道选择，已创建渠道不受影响。</Typography.Paragraph>
          {visibleStoreProblem && (
            <Alert
              type="warning"
              showIcon
              title="门店范围读取失败"
              description={visibleStoreProblem}
              action={
                <Button
                  onClick={() => setVisibleStoreRefreshVersion(version => version + 1)}
                  {...testId(businessChannelTemplateTestIds.visibleStoreReadRetry)}
                >
                  重试
                </Button>
              }
              style={{marginBottom: 12}}
            />
          )}
          {visibleStoreLoading && visibleStores.length === 0 ? (
            <Typography.Text type="secondary">正在读取可见门店…</Typography.Text>
          ) : visibleStores.length === 0 && !visibleStoreProblem ? (
            <Typography.Text type="secondary">暂无可见门店，当前不会出现在任何门店的新建候选中</Typography.Text>
          ) : (
            <Space direction="vertical" size={8} style={{display: 'flex'}}>
              {visibleStores.map(store => (
                <Space key={store.storeRef} size={8} wrap>
                  <NameCodeText name={store.storeName} code={store.storeCode} />
                  {store.storeStatus !== 'ENABLED' && <Tag>{organizationStoreStatusLabels[store.storeStatus]}</Tag>}
                </Space>
              ))}
            </Space>
          )}
          {(visibleStoreNextCursor || visibleStorePage.canPrevious) && (
            <CursorPagination
              state={visibleStorePage}
              nextCursor={visibleStoreNextCursor}
              testIdPrefix={businessChannelTemplateTestIds.visibleStorePage}
              style={{marginTop: 16}}
            />
          )}
        </Card>
      )}
    </Drawer>
  );
}
