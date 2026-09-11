import {Alert, Button, Checkbox, Input, Modal, Space, Tag, Typography} from 'antd';
import type {InputRef} from 'antd/es/input';
import {NameCodeText, testId, useOverlayLock, wireUuid} from '@catering-v2s/admin-ui-foundation';
import type {BusinessChannelTemplateVisibleStore} from '../../../app/api/generated/operations-edge';
import {useEffect, useMemo, useRef, useState, type UIEvent} from 'react';
import {businessChannelTemplateTestIds} from '../../../app/automation/businessChannelTemplateTestIds';

export type EditableVisibleStore = Pick<BusinessChannelTemplateVisibleStore, 'storeRef' | 'storeCode' | 'storeName'> & {
  storeStatus: BusinessChannelTemplateVisibleStore['storeStatus'];
};

export type StoreCandidate = {
  id: string;
  name: string;
  code: string;
};

type Props = {
  open: boolean;
  selectedStores: readonly EditableVisibleStore[];
  candidateItems: readonly StoreCandidate[];
  candidateLoading: boolean;
  candidateErrorMessage?: string;
  disabled: boolean;
  onCandidateSearchChange: (value: string) => void;
  onCandidateScroll: (event: UIEvent<HTMLDivElement>) => void;
  onCandidateRetry: () => void;
  onCancel: () => void;
  onConfirm: (stores: EditableVisibleStore[]) => void;
  onClosed: () => void;
};

export function BusinessChannelTemplateStorePickerModal({
  open,
  selectedStores,
  candidateItems,
  candidateLoading,
  candidateErrorMessage,
  disabled,
  onCandidateSearchChange,
  onCandidateScroll,
  onCandidateRetry,
  onCancel,
  onConfirm,
  onClosed,
}: Props) {
  const [draftStores, setDraftStores] = useState<EditableVisibleStore[]>([]);
  const searchInput = useRef<InputRef>(null);
  useOverlayLock(open);

  useEffect(() => {
    if (open) setDraftStores(selectedStores.map(store => ({...store})));
  }, [open, selectedStores]);

  const selectedStoreRefs = useMemo(() => new Set(draftStores.map(store => store.storeRef)), [draftStores]);
  const staleStores = draftStores.filter(store => store.storeStatus !== 'ENABLED');

  const toggleCandidate = (candidate: StoreCandidate, checked: boolean) => {
    const storeRef = wireUuid(candidate.id);
    setDraftStores(current => {
      if (checked) {
        if (current.some(store => store.storeRef === storeRef)) return current;
        return [
          ...current,
          {
            storeRef,
            storeCode: candidate.code,
            storeName: candidate.name,
            storeStatus: 'ENABLED',
          },
        ];
      }
      return current.filter(store => store.storeRef !== storeRef);
    });
  };

  const afterOpenChange = (visible: boolean) => {
    if (visible) {
      searchInput.current?.focus();
    } else {
      onClosed();
    }
  };

  return (
    <Modal
      title="添加可见门店"
      open={open}
      width={600}
      destroyOnHidden
      onCancel={disabled ? undefined : onCancel}
      afterOpenChange={afterOpenChange}
      maskClosable={!disabled}
      keyboard={!disabled}
      footer={[
        <Button
          key="cancel"
          onClick={onCancel}
          disabled={disabled}
          {...testId(businessChannelTemplateTestIds.visibleStorePickerCancel)}
        >
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={() => onConfirm(draftStores.map(store => ({...store})))}
          disabled={disabled}
          {...testId(businessChannelTemplateTestIds.visibleStorePickerConfirm)}
        >
          确定
        </Button>,
      ]}
      {...testId(businessChannelTemplateTestIds.visibleStorePickerModal)}
    >
      <Space orientation="vertical" size={16} style={{display: 'flex'}}>
        <Typography.Paragraph type="secondary" style={{marginBottom: 0}}>
          选择需要使用此模板的项目门店。确认后回到编辑抽屉，点击“保存”才会提交本次变更。
        </Typography.Paragraph>

        <Space orientation="vertical" size={8} style={{display: 'flex'}}>
          <Typography.Text strong>搜索并选择门店</Typography.Text>
          <Input
            ref={searchInput}
            autoFocus
            allowClear
            aria-label="搜索门店名称或编码"
            placeholder="搜索门店名称或编码"
            disabled={disabled}
            onChange={event => onCandidateSearchChange(event.target.value)}
            {...testId(businessChannelTemplateTestIds.visibleStorePickerSearch)}
          />
          <Typography.Text type="secondary">已选择 {draftStores.length} 家门店</Typography.Text>
        </Space>

        {staleStores.length > 0 && (
          <Alert
            type="warning"
            showIcon
            title="已选名单包含停用或作废门店"
            description="这些门店会继续保留，不会因本次搜索选择被静默移除；如需移除，请返回编辑抽屉后点击对应门店的“删除”。"
          />
        )}

        {candidateErrorMessage && (
          <Alert
            type="warning"
            showIcon
            title="门店候选读取失败"
            description={candidateErrorMessage}
            action={
              <Button
                onClick={onCandidateRetry}
                disabled={disabled}
                {...testId(businessChannelTemplateTestIds.visibleStorePickerReadRetry)}
              >
                重试
              </Button>
            }
          />
        )}

        <div
          role="list"
          aria-label="项目门店"
          aria-busy={candidateLoading}
          onScroll={onCandidateScroll}
          {...testId(businessChannelTemplateTestIds.visibleStorePickerList)}
          style={{
            maxHeight: 360,
            overflowY: 'auto',
            padding: 4,
            border: '1px solid #d9d9d9',
            borderRadius: 6,
          }}
        >
          {candidateLoading && candidateItems.length === 0 ? (
            <Typography.Text type="secondary">正在读取可添加门店…</Typography.Text>
          ) : candidateItems.length === 0 && !candidateErrorMessage ? (
            <Typography.Text type="secondary">当前项目暂无可添加的门店</Typography.Text>
          ) : (
            <Space orientation="vertical" size={4} style={{display: 'flex'}}>
              {candidateItems.map(candidate => {
                const storeRef = wireUuid(candidate.id);
                return (
                  <div key={candidate.id} role="listitem">
                    <Checkbox
                      checked={selectedStoreRefs.has(storeRef)}
                      disabled={disabled}
                      onChange={event => toggleCandidate(candidate, event.target.checked)}
                      {...testId(businessChannelTemplateTestIds.visibleStorePickerOption(storeRef))}
                    >
                      <NameCodeText name={candidate.name} code={candidate.code} />
                    </Checkbox>
                  </div>
                );
              })}
              {candidateLoading && <Typography.Text type="secondary">正在加载更多门店…</Typography.Text>}
            </Space>
          )}
        </div>

        {staleStores.length > 0 && (
          <Space orientation="vertical" size={4} style={{display: 'flex'}}>
            <Typography.Text type="secondary">当前已保留的非可选门店</Typography.Text>
            {staleStores.map(store => (
              <Space key={store.storeRef} size={8} wrap>
                <NameCodeText name={store.storeName} code={store.storeCode} />
                <Tag>{store.storeStatus === 'VOIDED' ? '作废' : '停用'}</Tag>
              </Space>
            ))}
          </Space>
        )}
      </Space>
    </Modal>
  );
}
