import {Alert, Button, Card, Descriptions, Input, Modal, Select, Space, Tag, Typography} from 'antd';
import {adminWideDetailDescriptionsProps, testId} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useRef, useState} from 'react';
import type {CatalogIdentifier, CatalogIdentifierType, CatalogSkuRow} from '../model/catalogModel';
import type {CatalogManifest} from '../model/catalogItemSurfaceTypes';
import {CATALOG_IDENTIFIER_TYPE_LABELS} from '../model/catalogIdentificationPreparationFeedback';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import {draftUuid, type CatalogIdentifierDraft} from '../model/catalogItemEditorDraftAdapters';
import {catalogFieldWidth} from './catalogFieldWidths';
import {EmptySection} from './CatalogItemReadOnlyPresenters';

export function manifestIdentifierTypes(
  manifest: CatalogManifest | undefined,
  shapeKey: string,
  grain: 'CATALOG_ITEM' | 'SKU',
): CatalogIdentifierType[] {
  const admission = manifest?.identifierRules?.admission;
  if (!admission || typeof admission !== 'object' || Array.isArray(admission)) return [];
  const shape = (admission as Record<string, unknown>)[shapeKey];
  if (!shape || typeof shape !== 'object' || Array.isArray(shape)) return [];
  const grainRule = (shape as Record<string, unknown>)[grain];
  if (!grainRule || typeof grainRule !== 'object' || Array.isArray(grainRule)) return [];
  return Object.entries(grainRule)
    .filter(([, allowed]) => allowed === true)
    .map(([value]) => value)
    .filter((value): value is CatalogIdentifierType => value in CATALOG_IDENTIFIER_TYPE_LABELS);
}

export function IdentifierEditor({
  values,
  allowedTypes,
  heading = '条码与标识',
  description = '识别码用于扫码、称重键码或快速检索。商品编码无需在此重复维护。',
  createDraftRowId,
  onChange,
  onDirty,
}: {
  values: CatalogIdentifierDraft[];
  allowedTypes: CatalogIdentifierType[];
  heading?: string;
  description?: string;
  createDraftRowId: (prefix: string) => string;
  onChange: (next: CatalogIdentifierDraft[]) => void;
  onDirty: () => void;
}) {
  const update = (index: number, patch: Partial<CatalogIdentifierDraft>) =>
    onChange(values.map((entry, entryIndex) => (entryIndex === index ? {...entry, ...patch} : entry)));
  return (
    <Space
      direction="vertical"
      size={12}
      style={{display: 'flex'}}
      {...testId(catalogTestIds.static.itemIdentifiersEditor)}
    >
      <Typography.Title level={5} style={{margin: 0}}>
        {heading}
      </Typography.Title>
      <Typography.Text type="secondary">{description}</Typography.Text>
      <Button
        onClick={() => {
          const identifierType = allowedTypes[0] ?? 'MNEMONIC';
          onChange([
            ...values,
            {
              editorId: createDraftRowId('identifier'),
              identifierRef: draftUuid(),
              ownerType: 'CATALOG_ITEM',
              ownerRef: draftUuid(),
              identifierType,
              identifierValue: '',
              normalizedValue: '',
              displayOrder: values.length,
            },
          ]);
          onDirty();
        }}
        disabled={allowedTypes.length === 0}
        {...testId(catalogTestIds.static.itemIdentifierAdd)}
      >
        添加识别码
      </Button>
      {allowedTypes.length === 0 && <EmptySection text="当前商品形态不提供识别方式" />}
      {values.length === 0 && allowedTypes.length > 0 && <EmptySection text="尚未维护识别码" />}
      {values.map((entry, index) => (
        <Card
          key={entry.editorId}
          size="small"
          title={`识别码 ${index + 1}`}
          extra={
            <Button
              danger
              type="link"
              onClick={() => {
                onChange(values.filter((_, entryIndex) => entryIndex !== index));
                onDirty();
              }}
              {...testId(catalogTestIdControls.edit.dynamic('identifier', 'remove', entry.editorId))}
            >
              移除
            </Button>
          }
        >
          <Space wrap>
            <Select
              style={catalogFieldWidth('compact')}
              aria-label={`识别码 ${index + 1} 类型`}
              value={entry.identifierType}
              optionLabelProp="label"
              options={allowedTypes.map(identifierType => ({
                value: identifierType,
                label: CATALOG_IDENTIFIER_TYPE_LABELS[identifierType],
              }))}
              onChange={identifierType => {
                update(index, {identifierType});
                onDirty();
              }}
              {...testId(catalogTestIdControls.edit.dynamic('identifier', 'type', entry.editorId))}
            />
            <Input
              style={catalogFieldWidth('regular')}
              aria-label={`识别码 ${index + 1} 识别值`}
              placeholder="请输入识别值"
              maxLength={160}
              value={entry.identifierValue}
              onChange={event => {
                update(index, {identifierValue: event.target.value});
                onDirty();
              }}
              {...testId(catalogTestIdControls.edit.dynamic('identifier', 'value', entry.editorId))}
            />
            {entry.identifierType === 'MNEMONIC' && (
              <Typography.Text type="secondary">助记码不区分大小写</Typography.Text>
            )}
          </Space>
        </Card>
      ))}
    </Space>
  );
}

export function CatalogItemIdentifiersEditor({
  locked,
  values,
  allowedTypes,
  createDraftRowId,
  onChange,
  onDirty,
}: {
  locked: boolean;
  values: CatalogIdentifierDraft[];
  allowedTypes: CatalogIdentifierType[];
  createDraftRowId: (prefix: string) => string;
  onChange: (next: CatalogIdentifierDraft[]) => void;
  onDirty: () => void;
}) {
  if (!locked)
    return (
      <IdentifierEditor
        values={values}
        allowedTypes={allowedTypes}
        createDraftRowId={createDraftRowId}
        onChange={onChange}
        onDirty={onDirty}
      />
    );
  return (
    <Space direction="vertical" style={{display: 'flex'}}>
      <Alert type="info" showIcon title="条码与标识由来源维护" description="当前只读；如需修改请在来源系统处理。" />
      <Descriptions
        {...adminWideDetailDescriptionsProps}
        items={values.map((entry, index) => ({
          key: `${entry.identifierType}-${index}`,
          label: CATALOG_IDENTIFIER_TYPE_LABELS[entry.identifierType],
          children: (
            <Space>
              <Typography.Text>{entry.identifierValue}</Typography.Text>
              <Tag>商品</Tag>
            </Space>
          ),
        }))}
      />
    </Space>
  );
}

export function SkuIdentifierEditorModal({
  open,
  sku,
  allowedTypes,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  sku?: CatalogSkuRow;
  allowedTypes: CatalogIdentifierType[];
  onCancel: () => void;
  onConfirm: (identifiers: CatalogIdentifier[]) => void;
}) {
  const [draft, setDraft] = useState<CatalogIdentifierDraft[]>([]);
  const [problem, setProblem] = useState<string>();
  const sequence = useRef(0);
  const createDraftRowId = useCallback((prefix: string) => `${prefix}-${++sequence.current}`, []);
  useEffect(() => {
    if (!open || !sku) return;
    setDraft(sku.identifiers.map(identifier => ({...identifier, editorId: createDraftRowId('sku-identifier')})));
    setProblem(undefined);
  }, [createDraftRowId, open, sku]);
  return (
    <Modal
      open={open}
      title={<span>维护识别码 · {sku?.skuName || '当前规格'}</span>}
      onCancel={onCancel}
      onOk={() => {
        if (draft.some(identifier => !identifier.identifierValue.trim())) {
          setProblem('请填写识别值');
          return;
        }
        onConfirm(draft.map(({editorId: _editorId, ...identifier}) => identifier));
      }}
      okText="确定"
      cancelText="取消"
      destroyOnHidden
      {...testId(catalogTestIds.static.skuIdentifierModal)}
    >
      <Space direction="vertical" style={{display: 'flex'}} size={12}>
        {problem && <Alert type="error" showIcon title={problem} role="alert" />}
        <IdentifierEditor
          values={draft}
          allowedTypes={allowedTypes}
          heading="规格识别码"
          description="这些识别码只识别当前规格。返回商品页面后仍需点击保存才会生效。"
          createDraftRowId={createDraftRowId}
          onChange={setDraft}
          onDirty={() => setProblem(undefined)}
        />
      </Space>
    </Modal>
  );
}
