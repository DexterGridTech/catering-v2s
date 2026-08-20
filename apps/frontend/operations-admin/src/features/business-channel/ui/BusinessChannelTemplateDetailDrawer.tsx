import {Alert, Button, Descriptions, Drawer, Space, Tag} from 'antd';
import {
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  testId,
  useDetailDrawer,
  useOverlayLock,
  useRefreshVersion,
} from '@catering-v2s/admin-ui-foundation';
import type {BusinessChannelTemplateView} from '../../../app/api/generated/operations-edge';
import type {OperationsPageContext} from '../../../app/routing/model';
import {useEffect, useState} from 'react';
import {operationsContentTabRefreshSignal, operationsProblemOf} from '../../../app/api/OperationsTransport';
import {readExternalProviderCandidates} from '../application/queries';

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
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  useOverlayLock(open);

  const {open: openDetail, close: closeDetail, target} = detail;
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
      target.orderKind === 'TAKEAWAY' || target.orderKind === 'GROUP_BUY' ? target.orderKind : undefined;
    void readExternalProviderCandidates(queryContext, capabilityClass)
      .then(providers =>
        setProviderName(providers.find(provider => provider.providerCode === target.providerCode)?.displayName),
      )
      .catch(error => setProviderProblem(operationsProblemOf(error).detail));
  }, [contentTabRefreshVersion, open, queryContext, target]);

  const transitionStatus = async () => {
    if (!target) return;
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
        target && (
          <Space>
            {target.status === 'ENABLED' && (
              <Button
                onClick={() => {
                  closeDetail();
                  onClose();
                  onEdit(target);
                }}
                {...testId('business-channel-template-detail-edit')}
              >
                编辑
              </Button>
            )}
            <Button
              danger={target.status === 'ENABLED'}
              loading={statusSubmitting}
              onClick={() => void transitionStatus()}
              {...testId('business-channel-template-detail-status')}
            >
              {target.status === 'ENABLED' ? '停用' : '启用'}
            </Button>
          </Space>
        )
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
            {key: 'access', label: '接入类型', children: target.accessKindDisplayName},
            {key: 'operator', label: '经营主体', children: target.operatorKindDisplayName},
            {key: 'order', label: '订单类型', children: target.orderKindDisplayName},
            {key: 'dineInForm', label: '到店点餐形式', children: target.dineInFormDisplayName ?? '—'},
            {key: 'provider', label: '外部接入档案', children: providerName ?? '—'},
            {key: 'status', label: '状态', children: <Tag>{target.statusDisplayName}</Tag>},
          ]}
        />
      )}
    </Drawer>
  );
}
