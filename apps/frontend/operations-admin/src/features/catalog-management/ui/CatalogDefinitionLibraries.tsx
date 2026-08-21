import {DeleteOutlined, PlusOutlined} from '@ant-design/icons';
import {Alert, Button, Card, Drawer, Form, Input, Modal, Select, Space, Table, Typography} from 'antd';
import {
  adminListState,
  adminWideDrawerSurfaceProps,
  createContentIdempotencyKey,
  NameCodeText,
  testId,
  useCursorCandidates,
  useDrawerFormLifecycle,
  useOverlayLock,
  useRefreshVersion,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useRef, useState} from 'react';
import {
  operationsContentTabRefreshSignal,
  operationsProblemOf,
  operationsRtk,
} from '../../../app/api/OperationsTransport';
import {
  CATALOG_INVENTORY_OPERATION_IDS,
  type CatalogAttributeDefinitionList,
  type CatalogOrderOptionDefinitionList,
} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {wireUuid} from '../../../app/api/wireUuid';
import {
  hydrateOrderOptionDefinitionValues,
  serializeOrderOptionDefinitionValues,
  type OrderOptionDefinitionFormValue,
} from '../model/catalogDefinitionForm';

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
};

export function CatalogDefinitionLibraries({open, kind, scopeRef, headers, canWrite}: Props) {
  const [attributeDrawer, setAttributeDrawer] = useState<AttributeDefinition | 'CREATE'>();
  const [orderOptionDrawer, setOrderOptionDrawer] = useState<OrderOptionDefinition | 'CREATE'>();
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
      setAttributeDrawer(undefined);
      setOrderOptionDrawer(undefined);
    }
  }, [open]);
  if (!scopeRef) {
    return (
      <Alert type="info" showIcon title="请选择管理范围" description="选择管理范围后，可维护商品属性和点单选项。" />
    );
  }
  if (kind === 'ATTRIBUTES') {
    const definitions = attributeQuery.currentData?.data.definitions ?? [];
    return (
      <>
        <Card
          size="small"
          title="商品属性库"
          extra={
            <Space>
              {canWrite && (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => setAttributeDrawer('CREATE')}>
                  新建商品属性
                </Button>
              )}
            </Space>
          }
          {...testId('catalog-attribute-definition-library')}
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
                render: (_, row) => (
                  <Button type="link" onClick={() => setAttributeDrawer(row)}>
                    <NameCodeText name={row.name} code={row.code} />
                  </Button>
                ),
              },
              {title: '填写方式', dataIndex: 'valueType', width: 160, render: value => attributeValueTypeLabel(value)},
              {
                title: '可选值',
                width: 260,
                render: (_, row) =>
                  row.valueType === 'TEXT'
                    ? '由商品填写'
                    : row.options.map(option => option.name).join('、') || '尚未设置',
              },
            ]}
            {...adminListState({
              loading: attributeQuery.isFetching,
              failed: Boolean(attributeQuery.error),
              emptyText: '还没有商品属性，可先新建一个。',
              testIdPrefix: 'catalog-attribute-definition-list',
            })}
          />
        </Card>
        <CatalogAttributeDefinitionDrawer
          definition={attributeDrawer}
          scopeRef={scopeRef}
          headers={headers}
          canWrite={canWrite}
          onClose={() => setAttributeDrawer(undefined)}
        />
      </>
    );
  }
  const definitions = orderOptionQuery.currentData?.data.definitions ?? [];
  return (
    <>
      <Card
        size="small"
        title="点单选项库"
        extra={
          <Space>
            {canWrite && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setOrderOptionDrawer('CREATE')}>
                新建点单选项
              </Button>
            )}
          </Space>
        }
        {...testId('catalog-order-option-definition-library')}
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
              render: (_, row) => (
                <Button type="link" onClick={() => setOrderOptionDrawer(row)}>
                  {row.name}
                </Button>
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
          ]}
          {...adminListState({
            loading: orderOptionQuery.isFetching,
            failed: Boolean(orderOptionQuery.error),
            emptyText: '还没有点单选项，可先新建一个。',
            testIdPrefix: 'catalog-order-option-definition-list',
          })}
        />
      </Card>
      <CatalogOrderOptionDefinitionDrawer
        definition={orderOptionDrawer}
        scopeRef={scopeRef}
        headers={headers}
        canWrite={canWrite}
        onClose={() => setOrderOptionDrawer(undefined)}
      />
    </>
  );
}

type AttributeDrawerProps = Omit<Props, 'kind' | 'open'> & {
  definition?: AttributeDefinition | 'CREATE';
  onClose: () => void;
};
type AttributeForm = {
  code: string;
  name: string;
  valueType: AttributeDefinition['valueType'];
  options: Array<{optionRef?: string; name: string}>;
};

function CatalogAttributeDefinitionDrawer({definition, scopeRef, headers, canWrite, onClose}: AttributeDrawerProps) {
  const [form] = Form.useForm<AttributeForm>();
  const [problem, setProblem] = useState<string>();
  const create = operationsRtk.useCreateOperationsCatalogAttributeDefinitionMutation()[0];
  const update = operationsRtk.useUpdateOperationsCatalogAttributeDefinitionMutation()[0];
  const remove = operationsRtk.useDeleteOperationsCatalogAttributeDefinitionMutation()[0];
  const lifecycle = useDrawerFormLifecycle({
    open: Boolean(definition),
    onOpenChange: open => {
      if (!open) onClose();
    },
    dirtyMessage: '商品属性定义尚未保存。',
    diagnosticOperationId: 'catalog-attribute-definition-editor',
  });
  useOverlayLock(Boolean(definition));
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
    if (!scopeRef || !canWrite) return;
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
      setProblem(operationsProblemOf(error).detail || '保存失败，请检查后重试。');
      lifecycle.setSubmitting(false);
    }
  };
  const deleteDefinition = () => {
    if (!definition || definition === 'CREATE' || !scopeRef || !canWrite) return;
    Modal.confirm({
      title: '删除商品属性',
      content: '删除后，已使用该属性的商品将不再保留这项属性。',
      okText: '删除',
      okButtonProps: {danger: true},
      onOk: async () => {
        const body = {
          dataNodeRef: wireUuid(scopeRef),
          definitionRef: wireUuid(definition.definitionRef),
          expectedVersion: definition.version,
        };
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.deleteOperationsCatalogAttributeDefinition,
          body,
        );
        await remove(
          catalogInventoryRtkRequest.deleteOperationsCatalogAttributeDefinition(
            {definitionRef: wireUuid(definition.definitionRef)},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
        onClose();
      },
    });
  };
  const valueType = Form.useWatch('valueType', form) ?? 'TEXT';
  return (
    <Drawer
      open={Boolean(definition)}
      title={definition === 'CREATE' ? '新建商品属性' : '编辑商品属性'}
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      destroyOnHidden={false}
      maskClosable={!lifecycle.submitting}
      {...adminWideDrawerSurfaceProps}
      extra={
        <Space>
          {definition !== 'CREATE' && canWrite && (
            <Button danger icon={<DeleteOutlined />} onClick={deleteDefinition}>
              删除
            </Button>
          )}
          <Button type="primary" disabled={!canWrite} loading={lifecycle.submitting} onClick={() => void submit()}>
            保存
          </Button>
        </Space>
      }
      {...testId('catalog-attribute-definition-drawer')}
    >
      {problem && (
        <Alert type="error" showIcon title="商品属性未保存" description={problem} style={{marginBottom: 16}} />
      )}
      <Form form={form} layout="vertical" onValuesChange={() => lifecycle.setDirty(true)}>
        <Space direction="vertical" size={0} style={{display: 'flex'}}>
          <Form.Item
            label="属性名称"
            name="name"
            rules={[{required: true, whitespace: true, message: '请填写属性名称'}]}
          >
            <Input disabled={!canWrite} maxLength={80} />
          </Form.Item>
          <Form.Item
            label="属性编码"
            name="code"
            rules={[{required: true, whitespace: true, message: '请填写属性编码'}]}
          >
            <Input disabled={!canWrite} maxLength={80} />
          </Form.Item>
          <Form.Item label="填写方式" name="valueType" rules={[{required: true}]} extra="创建后不可修改。">
            <Select
              disabled={!canWrite || definition !== 'CREATE'}
              options={[
                {value: 'TEXT', label: '纯文本'},
                {value: 'SINGLE_SELECT', label: '单选'},
                {value: 'MULTI_SELECT', label: '多选'},
              ]}
            />
          </Form.Item>
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
                        <Input disabled={!canWrite} placeholder="例如：三个月" />
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
        </Space>
      </Form>
    </Drawer>
  );
}

type OrderOptionDrawerProps = Omit<Props, 'kind' | 'open'> & {
  definition?: OrderOptionDefinition | 'CREATE';
  onClose: () => void;
};
type OrderOptionForm = {
  code: string;
  name: string;
  selectionMode: OrderOptionDefinition['selectionMode'];
  values: OrderOptionDefinitionFormValue[];
};

function CatalogOrderOptionDefinitionDrawer({
  definition,
  scopeRef,
  headers,
  canWrite,
  onClose,
}: OrderOptionDrawerProps) {
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
  const remove = operationsRtk.useDeleteOperationsCatalogOrderOptionDefinitionMutation()[0];
  const lifecycle = useDrawerFormLifecycle({
    open: Boolean(definition),
    onOpenChange: open => {
      if (!open) onClose();
    },
    dirtyMessage: '点单选项定义尚未保存。',
    diagnosticOperationId: 'catalog-order-option-definition-editor',
  });
  useOverlayLock(Boolean(definition));
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
    if (!scopeRef || !canWrite) return;
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
      setProblem(operationsProblemOf(error).detail || '保存失败，请检查后重试。');
      lifecycle.setSubmitting(false);
    }
  };
  const deleteDefinition = () => {
    if (!definition || definition === 'CREATE' || !scopeRef || !canWrite) return;
    Modal.confirm({
      title: '删除点单选项',
      content: '删除后，使用该点单选项的商品将不能继续使用它。',
      okText: '删除',
      okButtonProps: {danger: true},
      onOk: async () => {
        const body = {
          dataNodeRef: wireUuid(scopeRef),
          definitionRef: wireUuid(definition.definitionRef),
          expectedVersion: definition.version,
        };
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.deleteOperationsCatalogOrderOptionDefinition,
          body,
        );
        await remove(
          catalogInventoryRtkRequest.deleteOperationsCatalogOrderOptionDefinition(
            {definitionRef: wireUuid(definition.definitionRef)},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
        onClose();
      },
    });
  };
  return (
    <Drawer
      open={Boolean(definition)}
      title={definition === 'CREATE' ? '新建点单选项' : '编辑点单选项'}
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      destroyOnHidden={false}
      maskClosable={!lifecycle.submitting}
      {...adminWideDrawerSurfaceProps}
      extra={
        <Space>
          {definition !== 'CREATE' && canWrite && (
            <Button danger icon={<DeleteOutlined />} onClick={deleteDefinition}>
              删除
            </Button>
          )}
          <Button type="primary" disabled={!canWrite} loading={lifecycle.submitting} onClick={() => void submit()}>
            保存
          </Button>
        </Space>
      }
      {...testId('catalog-order-option-definition-drawer')}
    >
      {problem && (
        <Alert type="error" showIcon title="点单选项未保存" description={problem} style={{marginBottom: 16}} />
      )}
      <Form form={form} layout="vertical" onValuesChange={() => lifecycle.setDirty(true)}>
        <Form.Item
          label="选项组名称"
          name="name"
          rules={[{required: true, whitespace: true, message: '请填写选项组名称'}]}
        >
          <Input disabled={!canWrite} maxLength={80} />
        </Form.Item>
        <Form.Item
          label="选项组编码"
          name="code"
          rules={[{required: true, whitespace: true, message: '请填写选项组编码'}]}
          extra={definition === 'CREATE' ? '创建后不可修改。' : '创建后不可修改。'}
        >
          <Input disabled={!canWrite || definition !== 'CREATE'} maxLength={80} />
        </Form.Item>
        <Form.Item label="选择方式" name="selectionMode" rules={[{required: true}]}>
          <Select
            disabled={!canWrite}
            options={[
              {value: 'SINGLE', label: '单选'},
              {value: 'MULTIPLE', label: '多选'},
            ]}
          />
        </Form.Item>
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
                        disabled={!canWrite || Boolean(form.getFieldValue(['values', field.name, 'valueRef']))}
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
                      <Input disabled={!canWrite} placeholder="例如：黑松露酱" />
                    </Form.Item>
                  </div>
                  <Form.List name={[field.name, 'materials']}>
                    {(materialFields, {add: addMaterial, remove: removeMaterial}) => (
                      <Card
                        size="small"
                        title="关联原料商品"
                        extra={
                          canWrite && (
                            <Button
                              type="link"
                              icon={<PlusOutlined />}
                              onClick={() => addMaterial({materialItemRef: undefined})}
                            >
                              添加原料商品
                            </Button>
                          )
                        }
                        style={{marginTop: 12}}
                      >
                        {materialFields.length === 0 && (
                          <Typography.Text type="secondary">不扣原料可留空。</Typography.Text>
                        )}
                        {materialFields.map((materialField, materialIndex) => (
                          <Space key={materialField.key} align="start" style={{display: 'flex', marginBottom: 8}}>
                            <Typography.Text>{materialIndex + 1}.</Typography.Text>
                            <Form.Item
                              name={[materialField.name, 'materialItemRef']}
                              style={{marginBottom: 0, flex: 1}}
                            >
                              <Select
                                allowClear
                                showSearch
                                disabled={!canWrite}
                                loading={inventoryQuery.isFetching}
                                filterOption={false}
                                placeholder="搜索并选择已有库存记录的原料商品"
                                onSearch={setMaterialKeyword}
                                onPopupScroll={event =>
                                  onMaterialCandidatePopupScroll(event, inventoryQuery.isFetching)
                                }
                                notFoundContent={
                                  inventoryQuery.isFetching ? '正在查找原料商品…' : '没有可选择的原料商品'
                                }
                                options={candidates.map(candidate => ({
                                  value: candidate.itemRef,
                                  label: (
                                    <Space size={4}>
                                      <NameCodeText name={candidate.name} code={candidate.productCode} />
                                      <NameCodeText
                                        name={candidate.consumptionUnitSnapshot.name}
                                        code={candidate.consumptionUnitSnapshot.code}
                                      />
                                    </Space>
                                  ),
                                }))}
                              />
                            </Form.Item>
                            {canWrite && (
                              <Button
                                type="text"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => removeMaterial(materialField.name)}
                                aria-label="删除关联原料商品"
                              />
                            )}
                          </Space>
                        ))}
                      </Card>
                    )}
                  </Form.List>
                </Card>
              ))}
              {fields.length === 0 && <Typography.Text type="secondary">请至少添加一个可选项。</Typography.Text>}
            </Card>
          )}
        </Form.List>
      </Form>
    </Drawer>
  );
}

function attributeValueTypeLabel(value: AttributeDefinition['valueType']) {
  return value === 'TEXT' ? '纯文本' : value === 'SINGLE_SELECT' ? '单选' : '多选';
}

function selectionModeLabel(value: OrderOptionDefinition['selectionMode']) {
  return value === 'SINGLE' ? '单选' : '多选';
}
