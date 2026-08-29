import {Button, Card, Checkbox, Input, Modal, Select, Space, Tag} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {useMemo, useState, type ReactNode} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';
import type {CatalogAttributeAssignment} from '../model/catalogModel';
import {catalogTestIds} from '../catalogTestIds';
import {catalogFieldWidth} from './catalogFieldWidths';
import {AttributeAssignmentsReadOnly, EmptySection} from './CatalogItemReadOnlyPresenters';

type Props = {
  locked: boolean;
  values: CatalogAttributeAssignment[];
  readOnlyValues: CatalogAttributeAssignment[];
  scopeRef?: string;
  brandRef?: string;
  onChange: (next: CatalogAttributeAssignment[]) => void;
  onDirty: () => void;
  lockedNotice: ReactNode;
};

/** Owns attribute-definition selection and values; read-only is never a disabled form. */
export function CatalogItemAttributesEditor({
  locked,
  values,
  readOnlyValues,
  scopeRef,
  brandRef,
  onChange,
  onDirty,
  lockedNotice,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDefinitionRefs, setPendingDefinitionRefs] = useState<string[]>([]);
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const request = useMemo(
    () =>
      catalogInventoryRtkRequest.listOperationsCatalogAttributeDefinitions(
        {},
        {query: {dataNodeRef: wireUuid(scopeRef ?? '')}, headers},
      ),
    [headers, scopeRef],
  );
  const candidateRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.listOperationsCatalogAttributeDefinitions(
        {},
        {query: {dataNodeRef: wireUuid(scopeRef ?? ''), candidateUsage: 'ITEM_ASSIGNMENT'}, headers},
      ),
    [headers, scopeRef],
  );
  const query = operationsRtk.useListOperationsCatalogAttributeDefinitionsQuery(request, {skip: !scopeRef || locked});
  const candidateQuery = operationsRtk.useListOperationsCatalogAttributeDefinitionsQuery(candidateRequest, {
    skip: !scopeRef || locked,
  });
  const definitions = query.currentData?.data.definitions ?? [];
  const candidateDefinitions = candidateQuery.currentData?.data.definitions ?? [];
  if (locked)
    return (
      <Space direction="vertical" style={{display: 'flex'}}>
        {lockedNotice}
        <AttributeAssignmentsReadOnly values={readOnlyValues} />
      </Space>
    );
  const availableDefinitions = candidateDefinitions.filter(
    definition => !values.some(value => value.definitionRef === definition.definitionRef),
  );
  const commit = (next: CatalogAttributeAssignment[]) => {
    onChange(next);
    onDirty();
  };
  const addDefinitions = () => {
    const selected = new Set(pendingDefinitionRefs);
    const additions = candidateDefinitions
      .filter(
        definition =>
          selected.has(definition.definitionRef) &&
          !values.some(value => value.definitionRef === definition.definitionRef),
      )
      .map(definition => ({
        definitionRef: definition.definitionRef,
        code: definition.code,
        name: definition.name,
        valueType: definition.valueType,
        textValue: null,
        optionRefs: [],
      }));
    if (additions.length) commit([...values, ...additions]);
    setAddOpen(false);
  };
  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };
  return (
    <Space direction="vertical" style={{display: 'flex'}}>
      <Button
        type="primary"
        onClick={() => {
          setPendingDefinitionRefs([]);
          setAddOpen(true);
        }}
        disabled={!availableDefinitions.length}
        loading={query.isFetching || candidateQuery.isFetching}
        {...testId(catalogTestIds.static.itemAttributeLibraryAdd)}
      >
        添加商品属性
      </Button>
      <Modal
        title="添加商品属性"
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        onOk={addDefinitions}
        okText="添加"
        cancelText="取消"
        destroyOnHidden
        {...testId(catalogTestIds.static.itemAttributeLibraryAddModal)}
      >
        {availableDefinitions.length ? (
          <Checkbox.Group
            value={pendingDefinitionRefs}
            onChange={refs => setPendingDefinitionRefs(refs.map(String))}
            style={{display: 'flex', flexDirection: 'column', gap: 12}}
            options={availableDefinitions.map(definition => ({
              label: definition.name,
              value: definition.definitionRef,
            }))}
          />
        ) : (
          <EmptySection text="没有可添加的商品属性。" />
        )}
      </Modal>
      {values.length === 0 ? (
        <EmptySection text="请先从商品属性库添加属性。" />
      ) : (
        values.map((assignment, index) => {
          const definition = definitions.find(entry => entry.definitionRef === assignment.definitionRef);
          return (
            <Card
              key={assignment.definitionRef}
              size="small"
              title={assignment.name}
              extra={
                <Space>
                  <Tag>
                    {assignment.valueType === 'TEXT'
                      ? '纯文本'
                      : assignment.valueType === 'SINGLE_SELECT'
                        ? '单选'
                        : '多选'}
                  </Tag>
                  <Button type="link" disabled={index === 0} onClick={() => move(index, -1)}>
                    上移
                  </Button>
                  <Button type="link" disabled={index === values.length - 1} onClick={() => move(index, 1)}>
                    下移
                  </Button>
                  <Button type="link" danger onClick={() => commit(values.filter((_, rowIndex) => rowIndex !== index))}>
                    移除
                  </Button>
                </Space>
              }
            >
              {assignment.valueType === 'TEXT' ? (
                <Input
                  value={assignment.textValue ?? ''}
                  onChange={event =>
                    commit(
                      values.map((row, rowIndex) =>
                        rowIndex === index ? {...row, textValue: event.target.value} : row,
                      ),
                    )
                  }
                  placeholder="填写属性值"
                />
              ) : (
                <Select
                  style={catalogFieldWidth('full')}
                  mode={assignment.valueType === 'MULTI_SELECT' ? 'multiple' : undefined}
                  value={assignment.optionRefs}
                  options={(definition?.options ?? []).map(option => ({value: option.optionRef, label: option.name}))}
                  onChange={optionRefs =>
                    commit(
                      values.map((row, rowIndex) =>
                        rowIndex === index
                          ? {
                              ...row,
                              optionRefs: Array.isArray(optionRefs) ? optionRefs : optionRefs ? [optionRefs] : [],
                            }
                          : row,
                      ),
                    )
                  }
                  placeholder="选择属性值"
                />
              )}
            </Card>
          );
        })
      )}
    </Space>
  );
}
