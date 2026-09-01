import {DeleteOutlined, PlusOutlined} from '@ant-design/icons';
import {Alert, Button, Card, Flex, Form, Input, Modal, Select, Space, Table, Tag, Typography} from 'antd';
import {
  adminListState,
  createContentIdempotencyKey,
  NameCodeText,
  testId,
  useCursorCandidates,
  useDrawerFormLifecycle,
  useRefreshVersion,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useRef, useState} from 'react';
import {operationsContentTabRefreshSignal, operationsRtk} from '../../../app/api/OperationsTransport';
import {
  CATALOG_INVENTORY_OPERATION_IDS,
  type CatalogAttributeDefinitionList,
  type CatalogOrderOptionDefinitionList,
} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';
import {
  hydrateOrderOptionDefinitionValues,
  orderOptionMaterialRefs,
  orderOptionMaterialsFromRefs,
  serializeOrderOptionDefinitionValues,
  type OrderOptionDefinitionFormValue,
} from '../model/catalogDefinitionForm';
import {catalogUiProblemFeedback} from '../model/catalogUiProblemFeedback';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import type {CatalogDefinitionEditorState} from '../model/useCatalogConfigLibrary';

type LibraryKind = 'ATTRIBUTES' | 'ORDER_OPTIONS';
type AttributeDefinition = CatalogAttributeDefinitionList['data']['definitions'][number];
type OrderOptionDefinition = CatalogOrderOptionDefinitionList['data']['definitions'][number];
type MaterialCandidate = {
  itemRef: string;
  name: string | null;
  productCode: string;
  consumptionUnitSnapshot: {code: string; name: string};
};

type Props = {
  open: boolean;
  kind: LibraryKind;
  scopeRef?: string;
  headers?: {'X-Workspace-Brand-Ref': string};
  canWrite: boolean;
  definitionEditor?: CatalogDefinitionEditorState;
  onOpenDefinitionEditor: (editor: CatalogDefinitionEditorState) => void;
  onCloseDefinitionEditor: () => void;
  onEditorDirtyChange?: (message?: string) => void;
};

export function CatalogDefinitionLibraries({
  open,
  kind,
  scopeRef,
  headers,
  canWrite,
  definitionEditor,
  onOpenDefinitionEditor,
  onCloseDefinitionEditor,
  onEditorDirtyChange,
}: Props) {
  const [editorDirtyMessage, setEditorDirtyMessage] = useState<string>();
  const attributeRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.listOperationsCatalogAttributeDefinitions(
        {},
        {query: {dataNodeRef: wireUuid(scopeRef ?? '')}, headers},
      ),
    [headers, scopeRef],
  );
  const orderOptionRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.listOperationsCatalogOrderOptionDefinitions(
        {},
        {query: {dataNodeRef: wireUuid(scopeRef ?? '')}, headers},
      ),
    [headers, scopeRef],
  );
  const attributeQuery = operationsRtk.useListOperationsCatalogAttributeDefinitionsQuery(attributeRequest, {
    skip: !open || !scopeRef || kind !== 'ATTRIBUTES',
  });
  const orderOptionQuery = operationsRtk.useListOperationsCatalogOrderOptionDefinitionsQuery(orderOptionRequest, {
    skip: !open || !scopeRef || kind !== 'ORDER_OPTIONS',
  });
  const refetchAttributeDefinitions = attributeQuery.refetch;
  const refetchOrderOptionDefinitions = orderOptionQuery.refetch;
  useEffect(() => {
    if (!definitionEditor || definitionEditor.mode !== 'EDIT' || definitionEditor.library !== kind) return;
    const definitions =
      kind === 'ATTRIBUTES'
        ? attributeQuery.currentData?.data.definitions
        : orderOptionQuery.currentData?.data.definitions;
    if (!definitions) return;
    if (!definitions.some(definition => definition.definitionRef === definitionEditor.definitionRef)) {
      onCloseDefinitionEditor();
    }
  }, [
    attributeQuery.currentData?.data.definitions,
    definitionEditor,
    kind,
    onCloseDefinitionEditor,
    orderOptionQuery.currentData?.data.definitions,
  ]);
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  const lastContentTabRefreshVersion = useRef(contentTabRefreshVersion);
  useEffect(() => {
    if (!open || !scopeRef || contentTabRefreshVersion === lastContentTabRefreshVersion.current) return;
    lastContentTabRefreshVersion.current = contentTabRefreshVersion;
    if (kind === 'ATTRIBUTES') void refetchAttributeDefinitions();
    else void refetchOrderOptionDefinitions();
  }, [contentTabRefreshVersion, kind, open, refetchAttributeDefinitions, refetchOrderOptionDefinitions, scopeRef]);
  useEffect(() => {
    if (!open) {
      setEditorDirtyMessage(undefined);
    }
  }, [onCloseDefinitionEditor, open]);
  useEffect(() => {
    setEditorDirtyMessage(undefined);
  }, [kind]);
  useEffect(() => {
    onEditorDirtyChange?.(editorDirtyMessage);
  }, [editorDirtyMessage, onEditorDirtyChange]);
  useEffect(() => () => onEditorDirtyChange?.(undefined), [onEditorDirtyChange]);
  const closeAttributeEditor = () => {
    onCloseDefinitionEditor();
    setEditorDirtyMessage(undefined);
  };
  const closeOrderOptionEditor = () => {
    onCloseDefinitionEditor();
    setEditorDirtyMessage(undefined);
  };
  if (!scopeRef) {
    return (
      <Alert type="info" showIcon title="请选择管理范围" description="选择管理范围后，可维护商品属性和点单选项。" />
    );
  }
  if (kind === 'ATTRIBUTES') {
    const definitions = attributeQuery.currentData?.data.definitions ?? [];
    const attributeEditor =
      definitionEditor?.library === 'ATTRIBUTES'
        ? definitionEditor.mode === 'CREATE'
          ? 'CREATE'
          : definitions.find(definition => definition.definitionRef === definitionEditor.definitionRef)
        : undefined;
    if (attributeEditor) {
      return (
        <CatalogAttributeDefinitionPane
          definition={attributeEditor}
          scopeRef={scopeRef}
          headers={headers}
          canWrite={canWrite}
          onClose={closeAttributeEditor}
          onDirtyChange={setEditorDirtyMessage}
        />
      );
    }
    return (
      <Card
        size="small"
        title="商品属性库"
        extra={
          canWrite && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => onOpenDefinitionEditor({library: 'ATTRIBUTES', mode: 'CREATE'})}
            >
              新建商品属性
            </Button>
          )
        }
        {...testId(catalogTestIds.static.attributeDefinitionLibrary)}
      >
        <Typography.Paragraph type="secondary">
          先在属性库维护属性定义；商品只选择属性并填写适合自己的值。
        </Typography.Paragraph>
        <Table<AttributeDefinition>
          rowKey="definitionRef"
          size="small"
          pagination={false}
          dataSource={definitions}
          columns={[
            {
              title: '属性名称',
              render: (_, row) =>
                canWrite ? (
                  <Button
                    type="link"
                    onClick={() =>
                      onOpenDefinitionEditor({library: 'ATTRIBUTES', mode: 'EDIT', definitionRef: row.definitionRef})
                    }
                  >
                    {row.name}
                  </Button>
                ) : (
                  row.name
                ),
            },
            {title: '属性编码', dataIndex: 'code', width: 180},
            {title: '填写方式', dataIndex: 'valueType', width: 160, render: value => attributeValueTypeLabel(value)},
            {
              title: '可选值',
              width: 260,
              render: (_, row) =>
                row.valueType === 'TEXT'
                  ? '由商品填写'
                  : row.options.map(option => option.name).join('、') || '尚未设置',
            },
            {title: '状态', dataIndex: 'status', width: 110, render: value => definitionStatusTag(value)},
          ]}
          {...adminListState({
            loading: attributeQuery.isFetching,
            failed: Boolean(attributeQuery.error),
            emptyText: '还没有商品属性，可先新建一个。',
            testIdPrefix: catalogTestIds.static.attributeDefinitionList,
          })}
        />
      </Card>
    );
  }
  const definitions = orderOptionQuery.currentData?.data.definitions ?? [];
  const orderOptionEditor =
    definitionEditor?.library === 'ORDER_OPTIONS'
      ? definitionEditor.mode === 'CREATE'
        ? 'CREATE'
        : definitions.find(definition => definition.definitionRef === definitionEditor.definitionRef)
      : undefined;
  if (orderOptionEditor) {
    return (
      <CatalogOrderOptionDefinitionPane
        definition={orderOptionEditor}
        scopeRef={scopeRef}
        headers={headers}
        canWrite={canWrite}
        onClose={closeOrderOptionEditor}
        onDirtyChange={setEditorDirtyMessage}
      />
    );
  }
  return (
    <Card
      size="small"
      title="点单选项库"
      extra={
        canWrite && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => onOpenDefinitionEditor({library: 'ORDER_OPTIONS', mode: 'CREATE'})}
          >
            新建点单选项
          </Button>
        )
      }
      {...testId(catalogTestIds.static.orderOptionDefinitionLibrary)}
    >
      <Typography.Paragraph type="secondary">
        在这里定义选项组、可选项及其原料关联；商品只选择需要的点单选项并维护商品自己的规则。
      </Typography.Paragraph>
      <Table<OrderOptionDefinition>
        rowKey="definitionRef"
        size="small"
        pagination={false}
        dataSource={definitions}
        columns={[
          {
            title: '选项组',
            render: (_, row) =>
              canWrite ? (
                <Button
                  type="link"
                  onClick={() =>
                    onOpenDefinitionEditor({library: 'ORDER_OPTIONS', mode: 'EDIT', definitionRef: row.definitionRef})
                  }
                >
                  {row.name}
                </Button>
              ) : (
                row.name
              ),
          },
          {title: '选项组编码', dataIndex: 'code', width: 180},
          {title: '选择方式', dataIndex: 'selectionMode', width: 160, render: value => selectionModeLabel(value)},
          {
            title: '可选项',
            width: 300,
            render: (_, row) =>
              row.values.length ? (
                <Space wrap size={4}>
                  {row.values.map(value => (
                    <NameCodeText key={value.valueRef} name={value.name} code={value.code} />
                  ))}
                </Space>
              ) : (
                '尚未设置'
              ),
          },
          {title: '状态', dataIndex: 'status', width: 110, render: value => definitionStatusTag(value)},
        ]}
        {...adminListState({
          loading: orderOptionQuery.isFetching,
          failed: Boolean(orderOptionQuery.error),
          emptyText: '还没有点单选项，可先新建一个。',
          testIdPrefix: catalogTestIds.static.orderOptionDefinitionList,
        })}
      />
    </Card>
  );
}

type AttributePaneProps = Omit<Props, 'kind' | 'open' | 'onOpenDefinitionEditor' | 'onCloseDefinitionEditor'> & {
  definition: AttributeDefinition | 'CREATE';
  onClose: () => void;
  onDirtyChange: (message?: string) => void;
};
type AttributeForm = {
  code: string;
  name: string;
  valueType: AttributeDefinition['valueType'];
  options: Array<{optionRef?: string; name: string}>;
};

function CatalogAttributeDefinitionPane({
  definition,
  scopeRef,
  headers,
  canWrite,
  onClose,
  onDirtyChange,
}: AttributePaneProps) {
  const [form] = Form.useForm<AttributeForm>();
  const [problem, setProblem] = useState<string>();
  const create = operationsRtk.useCreateOperationsCatalogAttributeDefinitionMutation()[0];
  const update = operationsRtk.useUpdateOperationsCatalogAttributeDefinitionMutation()[0];
  const transition = operationsRtk.useTransitionOperationsCatalogAttributeDefinitionStatusMutation()[0];
  const readOnly = definition !== 'CREATE' && definition.status === 'VOIDED';
  const lifecycle = useDrawerFormLifecycle({
    open: Boolean(definition),
    onOpenChange: open => {
      if (!open) onClose();
    },
    dirtyMessage: '商品属性定义尚未保存。',
    diagnosticOperationId: 'catalog-attribute-definition-editor',
  });
  const editorDirty = lifecycle.dirty;
  useEffect(() => {
    onDirtyChange(editorDirty ? '商品属性定义尚未保存。' : undefined);
  }, [editorDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(undefined), [onDirtyChange]);
  useEffect(() => {
    if (!definition) return;
    form.setFieldsValue(
      definition === 'CREATE'
        ? {code: '', name: '', valueType: 'TEXT', options: []}
        : {
            code: definition.code,
            name: definition.name,
            valueType: definition.valueType,
            options: definition.options.map(option => ({optionRef: option.optionRef, name: option.name})),
          },
    );
    lifecycle.reset();
    setProblem(undefined);
  }, [definition, form, lifecycle]);
  const submit = async () => {
    if (!scopeRef || !canWrite || readOnly) return;
    try {
      const values = await form.validateFields();
      const options =
        values.valueType === 'TEXT'
          ? []
          : values.options.map((option, index) => ({
              optionRef: option.optionRef ? wireUuid(option.optionRef) : null,
              name: option.name.trim(),
              displayOrder: index + 1,
            }));
      const base = {dataNodeRef: wireUuid(scopeRef), code: values.code.trim(), name: values.name.trim(), options};
      lifecycle.setSubmitting(true);
      if (definition === 'CREATE') {
        const body = {...base, valueType: values.valueType};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.createOperationsCatalogAttributeDefinition,
          body,
        );
        await create(
          catalogInventoryRtkRequest.createOperationsCatalogAttributeDefinition(
            {},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      } else if (definition) {
        const body = {...base, definitionRef: wireUuid(definition.definitionRef), expectedVersion: definition.version};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.updateOperationsCatalogAttributeDefinition,
          body,
        );
        await update(
          catalogInventoryRtkRequest.updateOperationsCatalogAttributeDefinition(
            {definitionRef: wireUuid(definition.definitionRef)},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      }
      lifecycle.reset();
      onClose();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setProblem(catalogUiProblemFeedback(error, '保存失败，请检查后重试。').message);
      lifecycle.setSubmitting(false);
    }
  };
  const changeStatus = (targetStatus: 'ENABLED' | 'DISABLED' | 'VOIDED') => {
    if (!definition || definition === 'CREATE' || !scopeRef || !canWrite || readOnly) return;
    const actionLabel = targetStatus === 'VOIDED' ? '删除' : targetStatus === 'DISABLED' ? '停用' : '启用';
    Modal.confirm({
      title: `${actionLabel}“${definition.name}”`,
      content:
        targetStatus === 'VOIDED'
          ? '删除后会保留历史事实并释放编码供新定义使用；已有商品引用不会被静默改写。'
          : targetStatus === 'DISABLED'
            ? '停用后，新建商品不会再提供该属性；已有商品引用仍保留。'
            : '启用后，该属性会重新出现在新建商品的候选列表中。',
      okText: `确认${actionLabel}`,
      okButtonProps: {danger: targetStatus !== 'ENABLED'},
      onOk: async () => {
        try {
          const body = {
            dataNodeRef: wireUuid(scopeRef),
            definitionRef: wireUuid(definition.definitionRef),
            expectedVersion: definition.version,
            targetStatus,
          };
          const idempotencyKey = await createContentIdempotencyKey(
            CATALOG_INVENTORY_OPERATION_IDS.transitionOperationsCatalogAttributeDefinitionStatus,
            body,
          );
          await transition(
            catalogInventoryRtkRequest.transitionOperationsCatalogAttributeDefinitionStatus(
              {definitionRef: wireUuid(definition.definitionRef)},
              {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
            ),
          ).unwrap();
          onClose();
        } catch (error) {
          setProblem(catalogUiProblemFeedback(error, '状态更新未完成，请检查后重试。').message);
          throw error;
        }
      },
    });
  };
  const valueType = Form.useWatch('valueType', form) ?? 'TEXT';
  return (
    <Card
      size="small"
      title={definition === 'CREATE' ? '新建商品属性' : readOnly ? '查看商品属性（已作废）' : '编辑商品属性'}
      extra={
        <Space>
          <Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>
            返回商品属性库
          </Button>
          {definition !== 'CREATE' && canWrite && !readOnly && (
            <>
              <Button
                danger={definition.status === 'ENABLED'}
                onClick={() => changeStatus(definition.status === 'ENABLED' ? 'DISABLED' : 'ENABLED')}
                {...testId(catalogTestIdControls.config.action('ATTRIBUTES', definition.code, 'change-status'))}
              >
                {definition.status === 'ENABLED' ? '停用' : '启用'}
              </Button>
              <Button danger icon={<DeleteOutlined />} onClick={() => changeStatus('VOIDED')}>
                删除
              </Button>
            </>
          )}
          {!readOnly && (
            <Button type="primary" loading={lifecycle.submitting} onClick={() => void submit()} disabled={!canWrite}>
              保存
            </Button>
          )}
        </Space>
      }
      {...testId(catalogTestIds.static.attributeDefinitionDrawer)}
    >
      {problem && (
        <Alert type="error" showIcon title="商品属性未保存" description={problem} style={{marginBottom: 16}} />
      )}
      <Form form={form} layout="vertical" disabled={readOnly} onValuesChange={() => lifecycle.setDirty(true)}>
        <Flex gap="middle" wrap="wrap" align="start" style={{width: '100%'}}>
          <Form.Item
            label="属性名称"
            name="name"
            rules={[{required: true, whitespace: true, message: '请填写属性名称'}]}
            style={{flex: '1 1 0', minWidth: 0}}
          >
            <Input style={{width: '100%'}} maxLength={80} />
          </Form.Item>
          <Form.Item
            label="属性编码"
            name="code"
            rules={[{required: true, whitespace: true, message: '请填写属性编码'}]}
            style={{flex: '1 1 0', minWidth: 0}}
          >
            <Input style={{width: '100%'}} maxLength={80} />
          </Form.Item>
          <Form.Item
            label="填写方式"
            name="valueType"
            rules={[{required: true}]}
            extra="创建后不可修改。"
            style={{flex: '1 1 0', minWidth: 0}}
          >
            <Select
              style={{width: '100%'}}
              disabled={definition !== 'CREATE'}
              options={[
                {value: 'TEXT', label: '纯文本'},
                {value: 'SINGLE_SELECT', label: '单选'},
                {value: 'MULTI_SELECT', label: '多选'},
              ]}
            />
          </Form.Item>
        </Flex>
        {valueType !== 'TEXT' && (
          <Form.List name="options">
            {(fields, {add, remove: removeOption, move}) => (
              <Card
                size="small"
                title="可选值"
                extra={
                  canWrite && (
                    <Button type="link" icon={<PlusOutlined />} onClick={() => add({name: ''})}>
                      添加可选值
                    </Button>
                  )
                }
              >
                {fields.length === 0 && <Typography.Text type="secondary">请至少添加一个可选值。</Typography.Text>}
                {fields.map((field, index) => (
                  <Space key={field.key} align="start" style={{display: 'flex', marginBottom: 8}}>
                    <Typography.Text>{index + 1}.</Typography.Text>
                    <Form.Item
                      name={[field.name, 'name']}
                      rules={[{required: true, whitespace: true, message: '请填写可选值'}]}
                      style={{marginBottom: 0, flex: 1}}
                    >
                      <Input placeholder="例如：三个月" />
                    </Form.Item>
                    {canWrite && (
                      <>
                        <Button type="text" disabled={index === 0} onClick={() => move(index, index - 1)}>
                          上移
                        </Button>
                        <Button
                          type="text"
                          disabled={index === fields.length - 1}
                          onClick={() => move(index, index + 1)}
                        >
                          下移
                        </Button>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeOption(field.name)}
                          aria-label="删除可选值"
                        />
                      </>
                    )}
                  </Space>
                ))}
              </Card>
            )}
          </Form.List>
        )}
      </Form>
    </Card>
  );
}

type OrderOptionPaneProps = Omit<Props, 'kind' | 'open' | 'onOpenDefinitionEditor' | 'onCloseDefinitionEditor'> & {
  definition: OrderOptionDefinition | 'CREATE';
  onClose: () => void;
  onDirtyChange: (message?: string) => void;
};
type OrderOptionForm = {
  code: string;
  name: string;
  selectionMode: OrderOptionDefinition['selectionMode'];
  values: OrderOptionDefinitionFormValue[];
};

function CatalogOrderOptionDefinitionPane({
  definition,
  scopeRef,
  headers,
  canWrite,
  onClose,
  onDirtyChange,
}: OrderOptionPaneProps) {
  const [form] = Form.useForm<OrderOptionForm>();
  const [problem, setProblem] = useState<string>();
  const [materialKeyword, setMaterialKeyword] = useState('');
  const materialCandidates = useCursorCandidates<MaterialCandidate>({
    queryText: materialKeyword,
    resetKey: `${Boolean(definition)}|${scopeRef ?? ''}|${headers?.['X-Workspace-Brand-Ref'] ?? ''}`,
    pageSize: 50,
    keyOf: candidate => candidate.itemRef,
  });
  const {
    acceptPage: acceptMaterialCandidatePage,
    cursor: materialCursor,
    debouncedQueryText: debouncedMaterialKeyword,
    items: candidates,
    onPopupScroll: onMaterialCandidatePopupScroll,
    pageSize: materialCandidatePageSize,
  } = materialCandidates;
  const inventoryRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsInventoryTargets(
        {},
        {
          query: {
            dataNodeRef: wireUuid(scopeRef ?? ''),
            ...(debouncedMaterialKeyword ? {keyword: debouncedMaterialKeyword} : {}),
            ...(materialCursor ? {cursor: materialCursor} : {}),
            pageSize: materialCandidatePageSize,
          },
          headers,
        },
      ),
    [debouncedMaterialKeyword, headers, materialCandidatePageSize, materialCursor, scopeRef],
  );
  const inventoryQuery = operationsRtk.useGetOperationsInventoryTargetsQuery(inventoryRequest, {
    skip: !scopeRef || !definition,
  });
  const inventoryPage = inventoryQuery.currentData?.data;
  useEffect(() => {
    if (!inventoryPage) return;
    const byItem = new Map<string, MaterialCandidate>();
    for (const row of inventoryPage.items) {
      if (!byItem.has(row.itemRef)) {
        byItem.set(row.itemRef, {
          itemRef: row.itemRef,
          name: row.productName,
          productCode: row.productCode,
          consumptionUnitSnapshot: row.consumptionUnitSnapshot,
        });
      }
    }
    acceptMaterialCandidatePage([...byItem.values()], {
      pageSize: materialCandidatePageSize,
      total: inventoryPage.total,
      nextCursor: inventoryPage.cursor,
    });
  }, [acceptMaterialCandidatePage, inventoryPage, materialCandidatePageSize]);
  const create = operationsRtk.useCreateOperationsCatalogOrderOptionDefinitionMutation()[0];
  const update = operationsRtk.useUpdateOperationsCatalogOrderOptionDefinitionMutation()[0];
  const transition = operationsRtk.useTransitionOperationsCatalogOrderOptionDefinitionStatusMutation()[0];
  const readOnly = definition !== 'CREATE' && definition.status === 'VOIDED';
  const lifecycle = useDrawerFormLifecycle({
    open: Boolean(definition),
    onOpenChange: open => {
      if (!open) onClose();
    },
    dirtyMessage: '点单选项定义尚未保存。',
    diagnosticOperationId: 'catalog-order-option-definition-editor',
  });
  const editorDirty = lifecycle.dirty;
  useEffect(() => {
    onDirtyChange(editorDirty ? '点单选项定义尚未保存。' : undefined);
  }, [editorDirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(undefined), [onDirtyChange]);
  useEffect(() => {
    if (!definition) return;
    form.setFieldsValue(
      definition === 'CREATE'
        ? {code: '', name: '', selectionMode: 'SINGLE', values: []}
        : {
            code: definition.code,
            name: definition.name,
            selectionMode: definition.selectionMode,
            values: hydrateOrderOptionDefinitionValues(definition.values),
          },
    );
    lifecycle.reset();
    setProblem(undefined);
  }, [definition, form, lifecycle]);
  const submit = async () => {
    if (!scopeRef || !canWrite || readOnly) return;
    try {
      const values = await form.validateFields();
      const base = {
        dataNodeRef: wireUuid(scopeRef),
        name: values.name.trim(),
        selectionMode: values.selectionMode,
        values: serializeOrderOptionDefinitionValues(values.values),
      };
      lifecycle.setSubmitting(true);
      if (definition === 'CREATE') {
        const body = {...base, code: values.code.trim()};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.createOperationsCatalogOrderOptionDefinition,
          body,
        );
        await create(
          catalogInventoryRtkRequest.createOperationsCatalogOrderOptionDefinition(
            {},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      } else if (definition) {
        const body = {
          ...base,
          definitionRef: wireUuid(definition.definitionRef),
          code: definition.code,
          expectedVersion: definition.version,
        };
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.updateOperationsCatalogOrderOptionDefinition,
          body,
        );
        await update(
          catalogInventoryRtkRequest.updateOperationsCatalogOrderOptionDefinition(
            {definitionRef: wireUuid(definition.definitionRef)},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      }
      lifecycle.reset();
      onClose();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setProblem(catalogUiProblemFeedback(error, '保存失败，请检查后重试。').message);
      lifecycle.setSubmitting(false);
    }
  };
  const changeStatus = (targetStatus: 'ENABLED' | 'DISABLED' | 'VOIDED') => {
    if (!definition || definition === 'CREATE' || !scopeRef || !canWrite || readOnly) return;
    const actionLabel = targetStatus === 'VOIDED' ? '删除' : targetStatus === 'DISABLED' ? '停用' : '启用';
    Modal.confirm({
      title: `${actionLabel}“${definition.name}”`,
      content:
        targetStatus === 'VOIDED'
          ? '删除后会保留历史事实并释放编码供新定义使用；已有商品引用不会被静默改写。'
          : targetStatus === 'DISABLED'
            ? '停用后，新建商品不会再提供该点单选项；已有商品引用仍保留。'
            : '启用后，该点单选项会重新出现在新建商品的候选列表中。',
      okText: `确认${actionLabel}`,
      okButtonProps: {danger: targetStatus !== 'ENABLED'},
      onOk: async () => {
        try {
          const body = {
            dataNodeRef: wireUuid(scopeRef),
            definitionRef: wireUuid(definition.definitionRef),
            expectedVersion: definition.version,
            targetStatus,
          };
          const idempotencyKey = await createContentIdempotencyKey(
            CATALOG_INVENTORY_OPERATION_IDS.transitionOperationsCatalogOrderOptionDefinitionStatus,
            body,
          );
          await transition(
            catalogInventoryRtkRequest.transitionOperationsCatalogOrderOptionDefinitionStatus(
              {definitionRef: wireUuid(definition.definitionRef)},
              {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
            ),
          ).unwrap();
          onClose();
        } catch (error) {
          setProblem(catalogUiProblemFeedback(error, '状态更新未完成，请检查后重试。').message);
          throw error;
        }
      },
    });
  };
  return (
    <Card
      size="small"
      title={definition === 'CREATE' ? '新建点单选项' : readOnly ? '查看点单选项（已作废）' : '编辑点单选项'}
      extra={
        <Space>
          <Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>
            返回点单选项库
          </Button>
          {definition !== 'CREATE' && canWrite && !readOnly && (
            <>
              <Button
                danger={definition.status === 'ENABLED'}
                onClick={() => changeStatus(definition.status === 'ENABLED' ? 'DISABLED' : 'ENABLED')}
                {...testId(catalogTestIdControls.config.action('ORDER_OPTIONS', definition.code, 'change-status'))}
              >
                {definition.status === 'ENABLED' ? '停用' : '启用'}
              </Button>
              <Button danger icon={<DeleteOutlined />} onClick={() => changeStatus('VOIDED')}>
                删除
              </Button>
            </>
          )}
          {!readOnly && (
            <Button type="primary" loading={lifecycle.submitting} onClick={() => void submit()} disabled={!canWrite}>
              保存
            </Button>
          )}
        </Space>
      }
      {...testId(catalogTestIds.static.orderOptionDefinitionDrawer)}
    >
      {problem && (
        <Alert type="error" showIcon title="点单选项未保存" description={problem} style={{marginBottom: 16}} />
      )}
      <Form form={form} layout="vertical" disabled={readOnly} onValuesChange={() => lifecycle.setDirty(true)}>
        <Flex gap="middle" wrap="wrap" align="start" style={{width: '100%'}}>
          <Form.Item
            label="选项组名称"
            name="name"
            rules={[{required: true, whitespace: true, message: '请填写选项组名称'}]}
            style={{flex: '1 1 0', minWidth: 0}}
          >
            <Input style={{width: '100%'}} maxLength={80} />
          </Form.Item>
          <Form.Item
            label="选项组编码"
            name="code"
            rules={[{required: true, whitespace: true, message: '请填写选项组编码'}]}
            extra="创建后不可修改。"
            style={{flex: '1 1 0', minWidth: 0}}
          >
            <Input style={{width: '100%'}} disabled={definition !== 'CREATE'} maxLength={80} />
          </Form.Item>
          <Form.Item
            label="选择方式"
            name="selectionMode"
            rules={[{required: true}]}
            style={{flex: '1 1 0', minWidth: 0}}
          >
            <Select
              style={{width: '100%'}}
              options={[
                {value: 'SINGLE', label: '单选'},
                {value: 'MULTIPLE', label: '多选'},
              ]}
            />
          </Form.Item>
        </Flex>
        <Form.List name="values">
          {(fields, {add, remove: removeValue, move}) => (
            <Card
              size="small"
              title="可选项和原料"
              extra={
                canWrite && (
                  <Button type="link" icon={<PlusOutlined />} onClick={() => add({code: '', name: '', materials: []})}>
                    添加可选项
                  </Button>
                )
              }
            >
              {fields.map((field, index) => (
                <Card
                  key={field.key}
                  size="small"
                  style={{marginBottom: 8}}
                  title={`可选项 ${index + 1}`}
                  extra={
                    canWrite && (
                      <Space size={0}>
                        <Button type="text" disabled={index === 0} onClick={() => move(index, index - 1)}>
                          上移
                        </Button>
                        <Button
                          type="text"
                          disabled={index === fields.length - 1}
                          onClick={() => move(index, index + 1)}
                        >
                          下移
                        </Button>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeValue(field.name)}
                          aria-label="删除可选项"
                        />
                      </Space>
                    )
                  }
                >
                  <div style={{display: 'flex', gap: 12, flexWrap: 'wrap'}}>
                    <Form.Item
                      label="可选项编码"
                      name={[field.name, 'code']}
                      rules={[{required: true, whitespace: true, message: '请填写可选项编码'}]}
                      extra={form.getFieldValue(['values', field.name, 'valueRef']) ? '创建后不可修改。' : undefined}
                      style={{marginBottom: 0, flex: '1 1 180px'}}
                    >
                      <Input
                        disabled={Boolean(form.getFieldValue(['values', field.name, 'valueRef']))}
                        placeholder="例如：truffle"
                        maxLength={80}
                      />
                    </Form.Item>
                    <Form.Item
                      label="名称"
                      name={[field.name, 'name']}
                      rules={[{required: true, whitespace: true, message: '请填写可选项名称'}]}
                      style={{marginBottom: 0, flex: '1 1 240px'}}
                    >
                      <Input placeholder="例如：黑松露酱" />
                    </Form.Item>
                  </div>
                  <Form.Item
                    label="关联原料商品"
                    name={[field.name, 'materials']}
                    getValueProps={(materials: OrderOptionDefinitionFormValue['materials'] | undefined) => ({
                      value: orderOptionMaterialRefs(materials),
                    })}
                    getValueFromEvent={(materialRefs: string[]) => orderOptionMaterialsFromRefs(materialRefs)}
                    extra="不扣原料可留空。"
                    style={{marginTop: 12, marginBottom: 0}}
                  >
                    <Select
                      mode="multiple"
                      style={{width: '100%'}}
                      allowClear
                      showSearch
                      maxTagCount="responsive"
                      loading={inventoryQuery.isFetching}
                      filterOption={false}
                      placeholder="搜索并选择已有库存记录的原料商品"
                      onSearch={setMaterialKeyword}
                      onPopupScroll={event => onMaterialCandidatePopupScroll(event, inventoryQuery.isFetching)}
                      notFoundContent={inventoryQuery.isFetching ? '正在查找原料商品…' : '没有可选择的原料商品'}
                      options={candidates.map(candidate => ({
                        value: candidate.itemRef,
                        label: (
                          <Space size={4}>
                            <span>{candidate.name}</span>
                            <Typography.Text type="secondary">{candidate.consumptionUnitSnapshot.name}</Typography.Text>
                          </Space>
                        ),
                      }))}
                    />
                  </Form.Item>
                </Card>
              ))}
              {fields.length === 0 && <Typography.Text type="secondary">请至少添加一个可选项。</Typography.Text>}
            </Card>
          )}
        </Form.List>
      </Form>
    </Card>
  );
}

function attributeValueTypeLabel(value: AttributeDefinition['valueType']) {
  return value === 'TEXT' ? '纯文本' : value === 'SINGLE_SELECT' ? '单选' : '多选';
}

function selectionModeLabel(value: OrderOptionDefinition['selectionMode']) {
  return value === 'SINGLE' ? '单选' : '多选';
}

function definitionStatusTag(value: string) {
  if (value === 'ENABLED') return <Tag color="green">启用</Tag>;
  if (value === 'DISABLED') return <Tag color="orange">已停用</Tag>;
  if (value === 'VOIDED') return <Tag color="default">已作废</Tag>;
  return <Tag>状态不可识别</Tag>;
}
