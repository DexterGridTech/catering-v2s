import {Alert, Button, Col, Form, Input, Modal, Row, Select, Space, TreeSelect} from 'antd';
import {
  createContentIdempotencyKey,
  testId,
  useDrawerFormLifecycle,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useRef, useState} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {CATALOG_INVENTORY_OPERATION_IDS} from '../../../app/api/generated/catalog-inventory-edge';
import type {CatalogItemCreateRequest} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../app/routing/model';
import {catalogEnumLabel} from '../model/catalogManifestLabels';

type Props = {
  open: boolean;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  initialValues?: {code?: string; name?: string; shapeKey?: string; categoryRef?: string};
  onClose: () => void;
  onCreated: (itemCode: string) => void;
};

type FormValues = {code: string; name: string; shapeKey: string; categoryRef?: string};

export function CatalogItemCreateDrawer({open, queryContext, brandRef, initialValues, onClose, onCreated}: Props) {
  const [form] = Form.useForm<FormValues>();
  const [problem, setProblem] = useState<string>();
  const [createdItemCode, setCreatedItemCode] = useState<string>();
  const handedOffItemCode = useRef<string | undefined>(undefined);
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const manifestRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogShapeManifest(
        {},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers},
      ),
    [headers, queryContext.scopeRef],
  );
  const manifestQuery = operationsRtk.useGetOperationsCatalogShapeManifestQuery(manifestRequest, {
    skip: !open || !queryContext.scopeRef,
  });
  const navigationRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogNavigation(
        {},
        {query: {viewKey: 'ALL', dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers},
      ),
    [headers, queryContext.scopeRef],
  );
  const navigationQuery = operationsRtk.useGetOperationsCatalogNavigationQuery(navigationRequest, {
    skip: !open || !queryContext.scopeRef,
  });
  const [create, createState] = operationsRtk.useCreateOperationsCatalogItemMutation();
  useOverlayLock(open);
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: next => {
      if (!next) onClose();
    },
    dirtyMessage: '新建商品内容尚未保存。',
    dirtyGuardTestIds: {
      confirm: testId('catalog-create-dirty-discard'),
      cancel: testId('catalog-create-dirty-continue'),
    },
    diagnosticOperationId: 'catalog-item-create',
  });
  const manifest = manifestQuery.currentData?.data;
  const shapeKeys = manifest?.shapeKeys ?? [];
  const shapeOptions = shapeKeys.map(shapeKey => ({
    value: shapeKey,
    label: catalogEnumLabel(manifest, 'shapeKey', shapeKey),
    disabled: shapeKey === 'BENEFIT_SHELL',
  }));

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setProblem(undefined);
      setCreatedItemCode(undefined);
      handedOffItemCode.current = undefined;
      lifecycle.reset();
      return;
    }
    form.setFieldsValue({
      code: initialValues?.code,
      name: initialValues?.name,
      shapeKey: initialValues?.shapeKey,
      categoryRef: initialValues?.categoryRef,
    });
  }, [form, initialValues, lifecycle, open]);

  const submit = async () => {
    try {
      const values = await form.validateFields();
      lifecycle.setSubmitting(true);
      setProblem(undefined);
      const body: CatalogItemCreateRequest = {
        dataNodeRef: requireOperationsScopeRef(queryContext),
        code: values.code.trim(),
        name: values.name.trim(),
        shapeKey: values.shapeKey,
        categoryRef: values.categoryRef ? wireUuid(values.categoryRef) : null,
      };
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.createOperationsCatalogItem,
        body,
      );
      await create(
        catalogInventoryRtkRequest.createOperationsCatalogItem(
          {},
          {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
        ),
      ).unwrap();
      lifecycle.reset();
      setCreatedItemCode(body.code);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setProblem(operationsProblemOf(error).detail || '创建失败，请检查后重试。');
      lifecycle.setSubmitting(false);
    }
  };

  return (
    <Modal
      title="新建商品"
      open={open && !createdItemCode}
      onCancel={lifecycle.requestClose}
      afterOpenChange={visible => {
        lifecycle.afterOpenChange(visible);
        if (!visible && createdItemCode && handedOffItemCode.current !== createdItemCode) {
          handedOffItemCode.current = createdItemCode;
          onCreated(createdItemCode);
        }
      }}
      destroyOnHidden={false}
      maskClosable={!lifecycle.submitting}
      width="min(760px, calc(100vw - 48px))"
      footer={
        <Space>
          <Button onClick={lifecycle.requestClose}>取消</Button>
          <Button
            type="primary"
            loading={createState.isLoading || lifecycle.submitting}
            disabled={navigationQuery.isLoading || Boolean(navigationQuery.error)}
            onClick={() => void submit()}
            {...testId('catalog-create-submit')}
          >
            创建并继续编辑
          </Button>
        </Space>
      }
      {...testId('catalog-item-create-modal')}
    >
      {problem && (
        <Alert
          type="error"
          showIcon
          title="商品创建未完成"
          description={problem}
          style={{marginBottom: 16}}
          {...testId('catalog-create-problem')}
        />
      )}
      <Alert
        type="info"
        showIcon
        title="创建后不可修改"
        description="商品编码和商品形态会在创建草稿商品时确定；请先阅读形态说明再继续。"
        style={{marginBottom: 16}}
      />
      {navigationQuery.error && (
        <Alert
          type="error"
          showIcon
          title="分类暂不可用"
          description="分类树读取失败，请恢复后再创建商品。"
          style={{marginBottom: 16}}
        />
      )}
      <Form form={form} layout="vertical" onValuesChange={() => lifecycle.setDirty(true)}>
        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Form.Item label="商品编码" name="code" rules={[{required: true, message: '请输入商品编码'}]}>
              <Input maxLength={80} {...testId('catalog-create-code')} />
            </Form.Item>
          </Col>
          <Col xs={24} sm={12}>
            <Form.Item label="商品名称" name="name" rules={[{required: true, message: '请输入商品名称'}]}>
              <Input maxLength={160} {...testId('catalog-create-name')} />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="分类（可不选）" name="categoryRef">
          <TreeSelect
            allowClear
            loading={navigationQuery.isLoading}
            disabled={Boolean(navigationQuery.error)}
            placeholder="请选择分类"
            treeData={catalogCategoryTree(navigationQuery.currentData?.data.tree ?? [])}
            {...testId('catalog-create-category')}
          />
        </Form.Item>
        <Form.Item label="商品形态" name="shapeKey" rules={[{required: true, message: '请选择商品形态'}]}>
          <Select
            loading={manifestQuery.isLoading}
            options={shapeOptions}
            optionRender={option =>
              option.data.disabled ? (
                <span style={{color: '#999'}}>{option.label}（权益域尚未开放）</span>
              ) : (
                option.label
              )
            }
            {...testId('catalog-create-shape')}
          />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(previous, current) => previous.shapeKey !== current.shapeKey}>
          {({getFieldValue}) => (
            <Alert
              type="info"
              showIcon
              title="形态说明"
              description={shapeDescription(getFieldValue('shapeKey') as string | undefined)}
              {...testId('catalog-create-shape-description')}
            />
          )}
        </Form.Item>
      </Form>
    </Modal>
  );
}

function catalogCategoryTree(
  entries: Array<{categoryRef: string; name: string; parentCategoryRef: string | null}>,
): Array<{title: string; value: string; key: string; children?: ReturnType<typeof catalogCategoryTree>}> {
  const byParent = new Map<string | null, typeof entries>();
  for (const entry of entries) {
    const siblings = byParent.get(entry.parentCategoryRef) ?? [];
    siblings.push(entry);
    byParent.set(entry.parentCategoryRef, siblings);
  }
  const build = (parentCategoryRef: string | null): ReturnType<typeof catalogCategoryTree> =>
    (byParent.get(parentCategoryRef) ?? []).map(entry => ({
      title: entry.name,
      value: entry.categoryRef,
      key: entry.categoryRef,
      children: build(entry.categoryRef),
    }));
  return build(null);
}

function shapeDescription(shapeKey?: string): string {
  const descriptions: Record<string, string> = {
    STANDARD_SALE_COUNTED: '用于按件销售的普通商品，可在后续维护商品资料、点单选项和原料用量。',
    SKU_VARIANT_SALE_COUNTED: '用于需要按规格销售的商品，创建后将按 SKU 维护规格和价格。',
    STANDARD_SALE_WEIGHED: '用于按重量销售的商品，后续按称重方式维护销售资料。',
    MATERIAL: '用于原材料、半成品或包装物，可用于库存管理和商品原料用量。',
    COMPOSITE: '用于商品型套餐，后续维护套餐内容和顾客选择规则。',
    SERVICE: '用于服务或费用商品，不作为原材料管理。',
    BENEFIT_SHELL: '权益商品当前暂不支持创建。',
  };
  return descriptions[shapeKey ?? ''] ?? '请选择商品形态；形态会决定后续可维护的商品资料，并且创建后不可修改。';
}
