import {Alert, Descriptions, Drawer, Space, Tag, Typography} from 'antd';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  closedCodeLabel,
  testId,
  useDetailDrawer,
  useOverlayLock,
  useRefreshVersion,
  useSubmissionLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import type {
  BusinessChannelTemplateView,
  BusinessChannelView,
  ExternalCapability,
  OwnerBindingView,
  ProviderProfileView,
} from '../../../app/api/generated/operations-edge';
import type {OperationsPageContext} from '../../../app/routing/model';
import {useEffect, useState} from 'react';
import {
  operationsClient,
  operationsContentTabRefreshSignal,
  operationsProblemOf,
} from '../../../app/api/OperationsTransport';
import {readBusinessChannelTemplates, readExternalProviderCandidates} from '../application/queries';
import {BusinessChannelBindingDrawer} from './BusinessChannelBindingDrawer';
import {ownerBindingBusinessDisplay, ownerBindingExternalOwnerDisplay} from './ownerBindingPresentation';
import {
  bindingStatusLabels,
  lifecycleStatusLabels,
  ownerNodeTypeLabels,
  statusDimensionTypeLabels,
} from '../model/businessChannelCodeLabels';
import {accessKindLabels, dineInFormLabels, orderKindLabels} from '../model/businessChannelCodeLabels';
import {
  businessChannelActionAvailability,
  canTransitionBusinessChannelStatus,
} from '../model/businessChannelActionPolicy';
import {operationsDetailDrawerTestIds} from '../../../app/automation/operationsDetailDrawerTestIds';
import {businessChannelTemplateTestIds} from '../../../app/automation/businessChannelTemplateTestIds';

function dimensionStatusLabel(status: string) {
  if (status === 'ENABLED') return lifecycleStatusLabels.ENABLED;
  if (status === 'DISABLED') return lifecycleStatusLabels.DISABLED;
  if (status === 'VOIDED') return lifecycleStatusLabels.VOIDED;
  return '当前状态无法识别';
}

function providerCapabilityForOrderKind(
  orderKind: BusinessChannelTemplateView['orderKind'],
): ExternalCapability['capabilityClass'] {
  return orderKind;
}

export function BusinessChannelDetailDrawer({
  open,
  queryContext,
  selected,
  onClose,
  onEdit,
  onSaved,
}: {
  open: boolean;
  queryContext: OperationsPageContext;
  selected?: BusinessChannelView;
  onClose: () => void;
  onEdit?: (channel: BusinessChannelView) => void;
  onSaved: () => void;
}) {
  const detail = useDetailDrawer<BusinessChannelView>();
  const [template, setTemplate] = useState<BusinessChannelTemplateView>();
  const [provider, setProvider] = useState<ProviderProfileView>();
  const [binding, setBinding] = useState<OwnerBindingView>();
  const [problem, setProblem] = useState<string>();
  const [bindingOpen, setBindingOpen] = useState(false);
  const submission = useSubmissionLifecycle();
  useOverlayLock(open);
  const {openLoading, open: openDetail, close: closeDetail, loading, target} = detail;
  const selectedChannelRef = selected?.channelRef;
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  useEffect(() => {
    if (!open || !selectedChannelRef || bindingOpen) return;
    openLoading();
    setProblem(undefined);
    setBinding(undefined);
    const bindingRequest = selected?.bindingRef
      ? operationsClient.getOperationsOwnerBindingDetail(
          {groupWorkspaceKey: queryContext.groupWorkspaceKey, channelRef: selected.channelRef},
          {},
        )
      : Promise.resolve(undefined);
    void Promise.all([
      operationsClient.getOperationsBusinessChannelDetail(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, channelRef: selectedChannelRef},
        {},
      ),
      readBusinessChannelTemplates(queryContext),
      bindingRequest,
    ])
      .then(async ([channel, templates, nextBinding]) => {
        openDetail(channel);
        const nextTemplate = templates.items.find(item => item.templateRef === channel.templateRef);
        const providers =
          nextTemplate?.accessKind === 'EXTERNAL'
            ? await readExternalProviderCandidates(
                queryContext,
                providerCapabilityForOrderKind(nextTemplate.orderKind),
                channel.ownerNodeType,
              )
            : [];
        setTemplate(nextTemplate);
        setProvider(providers.find(item => item.providerCode === nextTemplate?.providerCode));
        setBinding(nextBinding);
      })
      .catch(error => {
        closeDetail();
        setProblem(operationsProblemOf(error).detail);
      });
  }, [
    bindingOpen,
    closeDetail,
    contentTabRefreshVersion,
    open,
    openDetail,
    openLoading,
    queryContext,
    selected,
    selectedChannelRef,
  ]);

  const channel = target;
  const isExternalDineIn = template?.accessKind === 'EXTERNAL' && template.orderKind === 'DINE_IN';
  const channelActions = channel ? businessChannelActionAvailability(channel.status) : undefined;
  const closeThen = (next: () => void) => {
    if (!channel) return;
    closeDetail();
    onClose();
    next();
  };
  const transition = async (status: BusinessChannelView['status']) => {
    if (!channel) return;
    if (!canTransitionBusinessChannelStatus(channel.status, status)) {
      setProblem('当前渠道状态不允许执行该操作。');
      return;
    }
    try {
      await operationsClient.transitionOperationsBusinessChannelStatus(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, channelRef: channel.channelRef},
        {
          body: {status, expectedVersion: channel.version},
          headers: {'Idempotency-Key': submission.getIdempotencyKey()},
        },
      );
      submission.reset();
      onSaved();
      onClose();
    } catch (error) {
      setProblem(operationsProblemOf(error).detail);
    }
  };
  const actionItems = channel
    ? [
        ...(onEdit && channelActions?.canEdit
          ? [
              {
                key: 'edit',
                label: (
                  <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.businessChannel.edit}>
                    编辑
                  </AdminDetailActionLabel>
                ),
                onClick: () => closeThen(() => onEdit(channel)),
              },
            ]
          : []),
        ...(channelActions?.canMaintainBinding
          ? [
              {
                key: 'binding',
                label: (
                  <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.businessChannel.binding}>
                    维护绑定
                  </AdminDetailActionLabel>
                ),
                onClick: () => setBindingOpen(true),
              },
            ]
          : []),
        ...(channelActions?.canDisable
          ? [
              {
                key: 'disable',
                danger: true,
                label: (
                  <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.businessChannel.status}>
                    停用
                  </AdminDetailActionLabel>
                ),
                onClick: () => void transition('DISABLED'),
              },
            ]
          : []),
        ...(channelActions?.canEnable
          ? [
              {
                key: 'enable',
                label: (
                  <AdminDetailActionLabel testIdValue={operationsDetailDrawerTestIds.businessChannel.status}>
                    恢复启用
                  </AdminDetailActionLabel>
                ),
                onClick: () => void transition('ENABLED'),
              },
            ]
          : []),
      ]
    : [];
  return (
    <>
      <Drawer
        open={open}
        title="经营渠道详情"
        loading={loading}
        destroyOnHidden
        maskClosable
        onClose={() => {
          detail.close();
          onClose();
        }}
        {...adminDrawerSurfaceProps}
        {...testId('business-channel-detail')}
        extra={
          actionItems.length > 0 ? (
            <AdminDetailActionMenu
              items={actionItems}
              triggerTestId={operationsDetailDrawerTestIds.businessChannel.actionMenu}
            />
          ) : undefined
        }
      >
        {problem && <Alert type="error" showIcon title="读取失败" description={problem} />}
        {channel && (
          <>
            <div {...(isExternalDineIn ? testId(businessChannelTemplateTestIds.externalDineInDetail) : {})}>
              <Descriptions
                {...adminDetailDescriptionsProps}
                items={[
                  {key: 'code', label: '渠道编码', children: channel.channelCode || '—'},
                  {key: 'name', label: '渠道名称', children: channel.channelName},
                  {key: 'template', label: '来源模板', children: template?.templateName || '—'},
                  {
                    key: 'operator',
                    label: '经营主体',
                    children: closedCodeLabel(ownerNodeTypeLabels, channel.ownerNodeType),
                  },
                  {
                    key: 'order',
                    label: '订单类型',
                    children: template ? closedCodeLabel(orderKindLabels, template.orderKind) : '—',
                  },
                  {
                    key: 'access',
                    label: '接入类型',
                    children: template ? closedCodeLabel(accessKindLabels, template.accessKind) : '—',
                  },
                  {
                    key: 'dineInForm',
                    label: '到店点餐形式',
                    children: isExternalDineIn
                      ? '外部系统不使用 POS、扫码或自助机点餐形式'
                      : template?.dineInForm
                        ? closedCodeLabel(dineInFormLabels, template.dineInForm)
                        : '未配置',
                  },
                  {
                    key: 'salesMenu',
                    label: '销售菜单',
                    children: isExternalDineIn ? '外部渠道不在本平台销售菜单范围内' : '—',
                  },
                  {
                    key: 'business',
                    label: '绑定业务',
                    children: ownerBindingBusinessDisplay(binding),
                  },
                  {
                    key: 'externalOwner',
                    label: '外部主体编号',
                    children:
                      template?.accessKind !== 'EXTERNAL'
                        ? '—'
                        : ownerBindingExternalOwnerDisplay(binding, provider?.authenticationKind),
                  },
                  {
                    key: 'status',
                    label: '状态',
                    children: <Tag>{closedCodeLabel(lifecycleStatusLabels, channel.status)}</Tag>,
                  },
                  {
                    key: 'statusDimensions',
                    label: '状态维度',
                    children: (
                      <Space direction="vertical" size={4} {...testId('business-channel-status-dimensions')}>
                        {channel.statusDimensions.length > 0 ? (
                          channel.statusDimensions.map(dimension => (
                            <Typography.Text
                              key={`${dimension.type}-${dimension.ref}`}
                              {...testId(`business-channel-status-dimension-${dimension.type}-${dimension.ref}`)}
                            >
                              {closedCodeLabel(statusDimensionTypeLabels, dimension.type)}：
                              {dimensionStatusLabel(dimension.status)}
                            </Typography.Text>
                          ))
                        ) : (
                          <Typography.Text>暂无上游状态维度</Typography.Text>
                        )}
                      </Space>
                    ),
                  },
                  {
                    key: 'blockers',
                    label: '上游阻断',
                    children: (
                      <Space direction="vertical" size={4} {...testId('business-channel-blockers')}>
                        {channel.blockers.length > 0 ? (
                          channel.blockers.map(blocker => (
                            <Typography.Text
                              key={`${blocker.type}-${blocker.ref}`}
                              {...testId(`business-channel-blocker-${blocker.type}-${blocker.ref}`)}
                            >
                              {closedCodeLabel(statusDimensionTypeLabels, blocker.type)}：
                              {dimensionStatusLabel(blocker.status)}
                            </Typography.Text>
                          ))
                        ) : (
                          <Typography.Text>当前没有上游阻断</Typography.Text>
                        )}
                      </Space>
                    ),
                  },
                  {
                    key: 'binding',
                    label: '绑定状态',
                    children:
                      channel.bindingStatus === 'NOT_REQUIRED'
                        ? '—'
                        : closedCodeLabel(bindingStatusLabels, channel.bindingStatus),
                  },
                ]}
              />
            </div>
          </>
        )}
      </Drawer>
      {channel && (
        <BusinessChannelBindingDrawer
          open={bindingOpen}
          queryContext={queryContext}
          channel={channel}
          providerCode={provider?.providerCode}
          authenticationKind={provider?.authenticationKind}
          onClose={() => setBindingOpen(false)}
          onSaved={() => {
            setBindingOpen(false);
            onSaved();
          }}
        />
      )}
    </>
  );
}
