import {Alert, Descriptions, Form, Input, InputNumber, Modal, Select, Typography} from 'antd';
import type {FormInstance} from 'antd';
import type {ReactNode} from 'react';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import {catalogFieldWidth} from './catalogFieldWidths';

type DictionaryKind = 'TAG' | 'UNIT' | 'SKU_ATTRIBUTE' | 'SKU_ATTRIBUTE_VALUE' | 'PRODUCTION_TAG';
type FormValues = {
  code: string;
  name: string;
  unitDimension?: 'COUNT' | 'WEIGHT' | 'VOLUME' | 'SERVICE_DURATION' | 'PACKAGE';
  precision?: number;
};
type UnitEditValues = Pick<FormValues, 'code' | 'name' | 'unitDimension' | 'precision'>;
type StatusRow = {name: string; status: string};

/**
 * The configuration drawer's only second-level task surfaces. Each modal
 * receives controller-owned state and commands; it deliberately owns neither
 * library selection nor query/cursor state.
 */
export function CatalogDictionaryAtomModals({
  canWrite,
  problem,
  creatingKind,
  creationTitle,
  creationKind,
  creationForm,
  creationFormTestId,
  creationSubmitting,
  nameFieldLabel,
  codeFieldLabel,
  unitDimensionOptions,
  onCreationValuesChange,
  onCancelCreate,
  onSubmitCreate,
  editingEntry,
  editNameForm,
  nameSaveLoading,
  renderStatus,
  onSaveName,
  onCancelName,
  editingUnit,
  editUnitForm,
  unitSaveLoading,
  onSaveUnit,
  onCancelUnit,
  statusChange,
  statusSaveLoading,
  onChangeStatus,
  onCancelStatus,
}: {
  canWrite: boolean;
  problem?: string;
  creatingKind?: DictionaryKind;
  creationTitle: string;
  creationKind: DictionaryKind;
  creationForm: FormInstance<FormValues>;
  creationFormTestId?: {'data-testid': string};
  creationSubmitting: boolean;
  nameFieldLabel: string;
  codeFieldLabel: string;
  unitDimensionOptions: Array<{value: NonNullable<FormValues['unitDimension']>; label: string}>;
  onCreationValuesChange: () => void;
  onCancelCreate: () => void;
  onSubmitCreate: () => void;
  editingEntry?: {dictionaryKind: DictionaryKind; row: {code: string; status: string}};
  editNameForm: FormInstance<Pick<FormValues, 'name'>>;
  nameSaveLoading: boolean;
  renderStatus: (value: string) => ReactNode;
  onSaveName: () => void;
  onCancelName: () => void;
  editingUnit?: {code: string};
  editUnitForm: FormInstance<UnitEditValues>;
  unitSaveLoading: boolean;
  onSaveUnit: () => void;
  onCancelUnit: () => void;
  statusChange?: {dictionaryKind: DictionaryKind; row: StatusRow};
  statusSaveLoading: boolean;
  onChangeStatus: () => void;
  onCancelStatus: () => void;
}) {
  const statusAction = statusChange?.row.status === 'ENABLED' ? '停用' : '启用';
  return (
    <>
      {canWrite && creatingKind && (
        <Modal
          title={creationTitle}
          open
          onCancel={onCancelCreate}
          maskClosable={!creationSubmitting}
          width={creationKind === 'UNIT' ? 720 : 480}
          confirmLoading={creationSubmitting}
          okText="创建"
          cancelText="取消"
          cancelButtonProps={testId(catalogTestIds.static.dictionaryCancel)}
          okButtonProps={testId(catalogTestIds.static.dictionaryCreate)}
          onOk={onSubmitCreate}
          {...testId(catalogTestIds.static.dictionaryCreateModal)}
        >
          {problem && (
            <Alert
              type="error"
              showIcon
              title="保存未完成"
              description={problem}
              style={{marginBottom: 16}}
              {...testId(catalogTestIds.static.dictionaryProblem)}
            />
          )}
          <Form form={creationForm} layout="vertical" onValuesChange={onCreationValuesChange} {...creationFormTestId}>
            <Typography.Paragraph type="secondary">
              {creationKind === 'SKU_ATTRIBUTE_VALUE'
                ? '新增的可选值会归属到当前选中的规格维度。'
                : creationKind === 'SKU_ATTRIBUTE'
                  ? '创建规格维度后，可在右侧维护其可选值。'
                  : '填写后可立即在商品维护中使用。'}
            </Typography.Paragraph>
            <Form.Item label={nameFieldLabel} name="name" rules={[{required: true, message: '请输入名称'}]}>
              <Input autoFocus {...testId(catalogTestIds.static.dictionaryName)} />
            </Form.Item>
            {creationKind === 'UNIT' && (
              <>
                <Form.Item
                  label="单位维度"
                  name="unitDimension"
                  initialValue="COUNT"
                  rules={[{required: true, message: '请选择单位维度'}]}
                >
                  <Select
                    style={catalogFieldWidth('compact')}
                    options={unitDimensionOptions}
                    {...testId(catalogTestIds.static.unitDimension)}
                  />
                </Form.Item>
                <Form.Item
                  label="精度"
                  name="precision"
                  initialValue={0}
                  extra="0 表示整数；精度为 0 时只能填写整数；录入超出精度时向零截断。"
                  rules={[{required: true, message: '请输入精度'}]}
                >
                  <InputNumber
                    min={0}
                    precision={0}
                    style={{width: '100%'}}
                    {...testId(catalogTestIds.static.unitPrecision)}
                  />
                </Form.Item>
              </>
            )}
            <Form.Item
              label={codeFieldLabel}
              name="code"
              extra="创建后不可修改；编码可按业务需要填写。"
              rules={[{required: true, message: '请输入编码'}]}
            >
              <Input placeholder="请输入业务编码" {...testId(catalogTestIds.static.dictionaryCode)} />
            </Form.Item>
          </Form>
        </Modal>
      )}
      {canWrite && editingEntry && (
        <Modal
          title={`编辑${creationKindLabelFor(editingEntry.dictionaryKind)}名称`}
          open
          width={480}
          maskClosable={!nameSaveLoading}
          okText="保存"
          cancelText="取消"
          confirmLoading={nameSaveLoading}
          onOk={onSaveName}
          onCancel={onCancelName}
          {...testId(catalogTestIds.static.dictionaryNameEditModal)}
        >
          {problem && (
            <Alert type="error" showIcon title="保存未完成" description={problem} style={{marginBottom: 16}} />
          )}
          <Descriptions
            size="small"
            column={2}
            items={[
              {key: 'code', label: '编码', children: editingEntry.row.code},
              {key: 'status', label: '当前状态', children: renderStatus(editingEntry.row.status)},
            ]}
            style={{marginBottom: 16}}
          />
          <Form form={editNameForm} layout="vertical">
            <Form.Item label="名称" name="name" rules={[{required: true, message: '请输入名称'}]}>
              <Input
                autoFocus
                {...testId(
                  catalogTestIdControls.config.action(editingEntry.dictionaryKind, editingEntry.row.code, 'edit-name'),
                )}
              />
            </Form.Item>
          </Form>
        </Modal>
      )}
      {canWrite && editingUnit && (
        <Modal
          title="编辑计量单位"
          open
          width={720}
          maskClosable={!unitSaveLoading}
          okText="保存"
          cancelText="取消"
          confirmLoading={unitSaveLoading}
          onOk={onSaveUnit}
          onCancel={onCancelUnit}
          {...testId(catalogTestIds.static.unitEditModal)}
        >
          {problem && (
            <Alert type="error" showIcon title="保存未完成" description={problem} style={{marginBottom: 16}} />
          )}
          <Typography.Paragraph type="secondary">
            当前单位尚未被商品、规格或点单选项引用，编码、名称、类别和精度均可调整；提交时仍由系统再次校验引用状态。
          </Typography.Paragraph>
          <Form form={editUnitForm} layout="vertical">
            <Form.Item label="计量单位名称" name="name" rules={[{required: true, message: '请输入名称'}]}>
              <Input
                autoFocus
                {...testId(catalogTestIdControls.config.action('UNIT', editingUnit.code, 'edit-name'))}
              />
            </Form.Item>
            <Form.Item label="计量单位编码" name="code" rules={[{required: true, message: '请输入编码'}]}>
              <Input {...testId(catalogTestIdControls.config.action('UNIT', editingUnit.code, 'edit-code'))} />
            </Form.Item>
            <Form.Item label="单位维度" name="unitDimension" rules={[{required: true, message: '请选择单位维度'}]}>
              <Select
                style={catalogFieldWidth('compact')}
                options={unitDimensionOptions}
                {...testId(catalogTestIdControls.config.action('UNIT', editingUnit.code, 'edit-dimension'))}
              />
            </Form.Item>
            <Form.Item
              label="精度"
              name="precision"
              extra="0 表示整数；精度为 0 时只能填写整数；录入超出精度时向零截断。"
              rules={[{required: true, message: '请输入精度'}]}
            >
              <InputNumber
                min={0}
                precision={0}
                style={{width: '100%'}}
                {...testId(catalogTestIdControls.config.action('UNIT', editingUnit.code, 'edit-precision'))}
              />
            </Form.Item>
          </Form>
        </Modal>
      )}
      {canWrite && statusChange && (
        <Modal
          title={`${statusAction}“${statusChange.row.name}”`}
          open
          okText={`确认${statusAction}`}
          okButtonProps={{danger: statusAction === '停用'}}
          maskClosable={!statusSaveLoading}
          cancelText="取消"
          confirmLoading={statusSaveLoading}
          onOk={onChangeStatus}
          onCancel={onCancelStatus}
          {...testId(catalogTestIds.static.dictionaryStatusChangeModal)}
        >
          {problem && (
            <Alert type="error" showIcon title="状态更新未完成" description={problem} style={{marginBottom: 16}} />
          )}
          <Typography.Paragraph>
            {statusChange.row.status === 'ENABLED'
              ? statusChange.dictionaryKind === 'UNIT'
                ? '停用后，新建商品、规格与库存配置不会再提供该单位；已经保存的配置和历史快照不受影响。'
                : '停用后，新建商品时不会再提供该条目；已经保存的商品引用不受影响。'
              : '启用后，该条目会重新出现在新建商品的候选列表中。'}
          </Typography.Paragraph>
        </Modal>
      )}
    </>
  );
}

function creationKindLabelFor(kind: DictionaryKind) {
  return kind === 'SKU_ATTRIBUTE_VALUE'
    ? '可选值'
    : kind === 'SKU_ATTRIBUTE'
      ? '规格维度'
      : kind === 'PRODUCTION_TAG'
        ? '生产标签'
        : kind === 'UNIT'
          ? '计量单位'
          : '商品标签';
}
