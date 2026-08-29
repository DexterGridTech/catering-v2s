import {Alert, Form, Input, Modal, Space, TreeSelect, Typography, type FormInstance} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import type {CatalogCategoryTask} from './controllers/useCatalogCategoryActionController';
import type {useCatalogCategoryCandidates} from './useCatalogCategoryCandidates';

type CategoryFormValues = {code?: string; name?: string; parentCategoryRef?: string | null};
type CategoryCandidates = ReturnType<typeof useCatalogCategoryCandidates>;

type Props = {
  action: CatalogCategoryTask | undefined;
  form: FormInstance<CategoryFormValues>;
  problem?: string;
  createCandidates: CategoryCandidates;
  reparentCandidates: CategoryCandidates;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

/** Category governance surface only; command and task state stay in the workspace controller. */
export function CatalogCategoryActionModal({
  action,
  form,
  problem,
  createCandidates,
  reparentCandidates,
  submitting,
  onClose,
  onSubmit,
}: Props) {
  return (
    <Modal
      open={Boolean(action)}
      title={
        action?.mode === 'CREATE'
          ? action.node
            ? '新建子分类'
            : '新建分类'
          : action?.mode === 'RENAME'
            ? '重命名分类'
            : action?.mode === 'REPARENT'
              ? '更换父分类'
              : action?.mode === 'MOVE_UP'
                ? '向上移动分类'
                : action?.mode === 'MOVE_DOWN'
                  ? '向下移动分类'
                  : '标记删除分类'
      }
      okText={action?.mode === 'DELETE' ? '标记删除' : '确定'}
      okButtonProps={action?.mode === 'DELETE' ? {danger: true} : undefined}
      onCancel={onClose}
      onOk={onSubmit}
      maskClosable={!submitting}
      keyboard={!submitting}
      confirmLoading={submitting}
      destroyOnHidden
      {...testId(catalogTestIds.static.categoryActionModal)}
    >
      <Form form={form} layout="vertical">
        {problem && (
          <Alert type="error" showIcon title="分类操作未完成" description={problem} style={{marginBottom: 12}} />
        )}
        {action?.mode === 'CREATE' &&
          (createCandidates.problem ? (
            <Alert
              type="error"
              showIcon
              title="分类候选暂不可用"
              description={createCandidates.problem}
              style={{marginBottom: 12}}
              {...testId(catalogTestIdControls.categoryTask.problem)}
            />
          ) : (
            <Form.Item label="父分类" name="parentCategoryRef" extra="清空表示建立最上层分类">
              <TreeSelect
                allowClear
                treeData={createCandidates.treeData}
                loadData={createCandidates.loadData}
                loading={createCandidates.loading}
                disabled={Boolean(createCandidates.problem)}
                treeDefaultExpandAll
                showSearch
                filterTreeNode={false}
                searchValue={createCandidates.searchValue}
                onSearch={createCandidates.onSearch}
                placeholder="请选择父分类"
                style={{width: '100%'}}
              />
            </Form.Item>
          ))}
        {action?.mode === 'REPARENT' &&
          (reparentCandidates.problem ? (
            <Alert
              type="error"
              showIcon
              title="分类候选暂不可用"
              description={reparentCandidates.problem}
              style={{marginBottom: 12}}
              {...testId(catalogTestIdControls.categoryTask.problem)}
            />
          ) : null)}
        {action?.mode === 'REPARENT' && (
          <Form.Item label="目标父分类" name="parentCategoryRef">
            <TreeSelect
              allowClear
              treeData={reparentCandidates.treeData}
              loadData={reparentCandidates.loadData}
              loading={reparentCandidates.loading}
              disabled={Boolean(reparentCandidates.problem)}
              treeDefaultExpandAll
              showSearch
              filterTreeNode={false}
              searchValue={reparentCandidates.searchValue}
              onSearch={reparentCandidates.onSearch}
              placeholder="选择新的父分类；清空表示移到最上层"
              style={{width: '100%'}}
            />
          </Form.Item>
        )}
        {action?.mode === 'CREATE' && (
          <Form.Item label="分类编码" name="code" rules={[{required: true, message: '请输入分类编码'}]}>
            <Input {...testId(catalogTestIds.static.categoryCode)} />
          </Form.Item>
        )}
        {(action?.mode === 'CREATE' || action?.mode === 'RENAME') && (
          <Form.Item
            label="分类名称"
            name="name"
            rules={[
              {required: true, message: '请输入分类名称'},
              {max: 80, message: '名称不能超过 80 个字符'},
            ]}
          >
            <Input {...testId(catalogTestIds.static.categoryName)} />
          </Form.Item>
        )}
        {action?.mode === 'MOVE_UP' && <Typography.Text type="secondary">将按当前最新排序上移一位。</Typography.Text>}
        {action?.mode === 'MOVE_DOWN' && <Typography.Text type="secondary">将按当前最新排序下移一位。</Typography.Text>}
        {action?.mode === 'DELETE' && (
          <Space direction="vertical" size={6}>
            <Typography.Text>将把“{action.node?.name}”标记为删除；分类及其子分类仍会保留历史事实。</Typography.Text>
            {(action.node?.deletionAvailability.blockingReferences?.references.length ?? 0) > 0 && (
              <Typography.Text type="danger">
                仍被以下商品引用，当前不能标记删除：
                {action.node?.deletionAvailability.blockingReferences?.references
                  .map(reference => reference.name)
                  .join('、')}
              </Typography.Text>
            )}
          </Space>
        )}
      </Form>
    </Modal>
  );
}
