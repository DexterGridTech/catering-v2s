import {Alert, Form, Modal, Select, TreeSelect} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import type {ReactNode, UIEvent} from 'react';
import type {CatalogBatchResult, CatalogBatchStatus} from '../model/catalogModel';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import {CatalogBatchOutcome} from './CatalogBatchOutcome';
import type {useCatalogCategoryCandidates} from './useCatalogCategoryCandidates';

export type CatalogBatchAction = 'CATEGORY' | 'TAG' | 'STATUS' | 'ARCHIVE';
type CategoryCandidates = ReturnType<typeof useCatalogCategoryCandidates>;

type Props = {
  action: CatalogBatchAction | undefined;
  results: CatalogBatchResult[];
  selectedItemCount: number;
  submitting: boolean;
  problem?: string;
  refreshProblem?: string;
  categoryCandidates: CategoryCandidates;
  categoryRef?: string;
  tagRefs: string[];
  tagOptions: Array<{value: string; label: ReactNode}>;
  tagLoading: boolean;
  status: CatalogBatchStatus;
  onCategoryChange: (categoryRef?: string) => void;
  onTagsChange: (tagRefs: string[]) => void;
  onTagPopupScroll: (event: UIEvent<HTMLElement>) => void;
  onStatusChange: (status: CatalogBatchStatus) => void;
  onClose: () => void;
  onExecute: () => void;
};

/** Presentation and control cascade for a batch task; execution remains owner-command orchestration. */
export function CatalogBatchActionModal({
  action,
  results,
  selectedItemCount,
  submitting,
  problem,
  refreshProblem,
  categoryCandidates,
  categoryRef,
  tagRefs,
  tagOptions,
  tagLoading,
  status,
  onCategoryChange,
  onTagsChange,
  onTagPopupScroll,
  onStatusChange,
  onClose,
  onExecute,
}: Props) {
  return (
    <Modal
      open={Boolean(action)}
      title={
        action === 'CATEGORY'
          ? '批量改分类'
          : action === 'TAG'
            ? '批量改标签'
            : action === 'STATUS'
              ? '批量改状态'
              : '批量归档'
      }
      onCancel={onClose}
      onOk={() => {
        if (results.length) onClose();
        else onExecute();
      }}
      maskClosable={!submitting}
      keyboard={!submitting}
      footer={results.length ? null : undefined}
      okText="执行"
      cancelText="取消"
      confirmLoading={submitting}
      okButtonProps={{
        disabled:
          submitting ||
          (!results.length && selectedItemCount === 0) ||
          (action === 'CATEGORY' && (categoryCandidates.loading || Boolean(categoryCandidates.problem))),
        ...testId(catalogTestIdControls.batch.submit),
      }}
      cancelButtonProps={{disabled: submitting, ...testId(catalogTestIdControls.batch.cancel)}}
      destroyOnHidden
    >
      <div aria-busy={submitting} {...testId(catalogTestIds.surface.batchTaskModal)}>
        {submitting && (
          <Alert
            type="info"
            showIcon
            title="正在处理，请稍候…"
            style={{marginBottom: 12}}
            {...testId(catalogTestIdControls.batch.progress)}
          />
        )}
        {(problem || categoryCandidates.problem) && (
          <Alert
            type="error"
            showIcon
            title="批量操作未执行"
            description={categoryCandidates.problem ?? problem}
            style={{marginBottom: 12}}
            {...testId(catalogTestIdControls.batch.problem)}
          />
        )}
        {!results.length && action === 'CATEGORY' && (
          <Form.Item label="目标分类" extra="提交后会替换所选商品的分类关系；清空即取消全部分类">
            <TreeSelect
              allowClear
              treeData={categoryCandidates.treeData}
              treeDefaultExpandAll
              showSearch
              filterTreeNode={false}
              searchValue={categoryCandidates.searchValue}
              onSearch={categoryCandidates.onSearch}
              loadData={categoryCandidates.loadData}
              loading={categoryCandidates.loading}
              disabled={Boolean(categoryCandidates.problem)}
              value={categoryRef}
              onChange={value => onCategoryChange(value ? String(value) : undefined)}
              placeholder="请选择分类"
              style={{width: '100%'}}
              {...testId(catalogTestIdControls.batch.category)}
            />
          </Form.Item>
        )}
        {!results.length && action === 'TAG' && (
          <Form.Item label="目标标签" extra="提交后会替换所选商品的标签关系；清空即取消全部标签">
            <Select
              mode="multiple"
              allowClear
              value={tagRefs}
              options={tagOptions}
              loading={tagLoading}
              onPopupScroll={onTagPopupScroll}
              onChange={onTagsChange}
              placeholder="请选择标签"
              style={{width: '100%'}}
              {...testId(catalogTestIdControls.batch.tags)}
            />
          </Form.Item>
        )}
        {!results.length && action === 'STATUS' && (
          <Form.Item label="目标状态">
            <Select
              value={status}
              options={[
                {value: 'ENABLED', label: '启用'},
                {value: 'DISABLED', label: '停用'},
              ]}
              onChange={onStatusChange}
              placeholder="请选择目标状态"
              style={{width: '100%'}}
              {...testId(catalogTestIds.static.inventoryBatchStatus)}
            />
          </Form.Item>
        )}
        {!results.length && action === 'ARCHIVE' && (
          <Alert
            type="warning"
            showIcon
            title={`将归档 ${selectedItemCount} 个商品`}
            description="归档只改变商品状态，不会清空图片、属性或其他商品资料。每条结果会单独显示。"
          />
        )}
        {results.length > 0 && (
          <CatalogBatchOutcome results={results} refreshProblem={refreshProblem} onClose={onClose} />
        )}
      </div>
    </Modal>
  );
}
