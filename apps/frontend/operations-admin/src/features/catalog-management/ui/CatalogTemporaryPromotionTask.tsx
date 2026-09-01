import {Alert, Button, Descriptions, Form, Input, Modal, Select, Space, Typography} from 'antd';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {createContentIdempotencyKey, NameCodeText, testId} from '@catering-v2s/admin-ui-foundation';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {
  CATALOG_INVENTORY_OPERATION_IDS,
  type TemporaryPromotionExecuteRequest,
  type TemporaryPromotionPreflight,
  type TemporaryPromotionPreflightRequest,
} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../app/routing/model';
import type {CatalogDetail} from '../model/catalogModel';
import {catalogEnumLabel} from '../model/catalogManifestLabels';
import {catalogUiProblemFeedback} from '../model/catalogUiProblemFeedback';
import {catalogTestIds} from '../catalogTestIds';
import type {CatalogManifest} from '../model/catalogItemSurfaceTypes';
import {catalogFieldWidth} from './catalogFieldWidths';

type PromotionFormValues = Pick<
  TemporaryPromotionPreflightRequest,
  'formalCode' | 'shapeKey' | 'name' | 'shortName' | 'materialRole'
>;

const TEMPORARY_PROMOTION_USER_VISIBLE_COPY = {
  fields: {
    formalCode: '商品编码',
    shapeKey: '商品形态',
    name: '商品名称',
    shortName: '短名',
    materialRole: '物料角色',
  } as Record<string, string>,
  blockedReasons: {
    NOT_TEMPORARY_ITEM: '当前商品不是外部订单临时商品，不能转正。',
    VERSION_CONFLICT: '商品资料已有更新，请重新检查。',
    SHAPE_DISABLED: '当前商品形态暂不支持转正，请调整商品形态。',
    MATERIAL_ROLE_REQUIRED: '选择原材料、半成品或包装物时，请填写物料角色。',
    DUPLICATE_CODE: '商品编码已被使用，请修改后重新检查。',
  } as Record<string, string>,
  unknownBlockedReason: '尚有资料或规则不满足转正条件，请调整后重新检查。',
} as const;

/** Promotion protocol keys are never shown to the user without this business projection. */
export function temporaryPromotionFieldLabel(value: string): string {
  return TEMPORARY_PROMOTION_USER_VISIBLE_COPY.fields[value] ?? '商品资料';
}

export function temporaryPromotionBlockedReasonLabel(value: string): string {
  return (
    TEMPORARY_PROMOTION_USER_VISIBLE_COPY.blockedReasons[value] ??
    TEMPORARY_PROMOTION_USER_VISIBLE_COPY.unknownBlockedReason
  );
}

/**
 * A View child task.  It owns only the temporary-item preflight/execute journey;
 * preflight digest and source version remain protocol facts and never enter the UI.
 */
export function CatalogTemporaryPromotionTask({
  open,
  detail,
  manifest,
  queryContext,
  brandRef,
  onClose,
  onCompleted,
}: {
  open: boolean;
  detail: CatalogDetail;
  manifest?: CatalogManifest;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  onClose: () => void;
  onCompleted: (input: {codeChanged: boolean}) => void;
}) {
  const [form] = Form.useForm<PromotionFormValues>();
  const [preflight, setPreflight] = useState<TemporaryPromotionPreflight['data']>();
  const [problem, setProblem] = useState<string>();
  const [runPreflight, preflightState] = operationsRtk.usePreflightOperationsTemporaryCatalogItemPromotionMutation();
  const [executePromotion, executeState] = operationsRtk.useExecuteOperationsTemporaryCatalogItemPromotionMutation();
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const initialValues = useMemo<PromotionFormValues>(
    () => ({
      formalCode: detail.item.code,
      shapeKey: detail.item.shapeKey as PromotionFormValues['shapeKey'],
      name: detail.item.name,
      shortName: detail.item.shortName ?? '',
      materialRole: detail.item.materialRole ?? '',
    }),
    [detail.item.code, detail.item.materialRole, detail.item.name, detail.item.shapeKey, detail.item.shortName],
  );

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(initialValues);
    setPreflight(undefined);
    setProblem(undefined);
  }, [form, initialValues, open]);

  const check = useCallback(
    async (values: PromotionFormValues) => {
      setPreflight(undefined);
      setProblem(undefined);
      try {
        const body: TemporaryPromotionPreflightRequest = {
          dataNodeRef: requireOperationsScopeRef(queryContext),
          itemCode: detail.item.code,
          formalCode: values.formalCode.trim(),
          shapeKey: values.shapeKey,
          name: values.name.trim(),
          shortName: values.shortName?.trim() ?? '',
          materialRole: values.materialRole?.trim() ?? '',
          expectedSourceVersion: detail.item.version,
        };
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.preflightOperationsTemporaryCatalogItemPromotion,
          body,
        );
        const response = await runPreflight(
          catalogInventoryRtkRequest.preflightOperationsTemporaryCatalogItemPromotion(
            {itemCode: detail.item.code},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
        if (!response.data) throw new Error('TEMPORARY_PROMOTION_PREFLIGHT_MISSING');
        setPreflight(response.data);
      } catch (error) {
        setProblem(catalogUiProblemFeedback(error, '暂时无法完成检查，请稍后重试。').message);
      }
    },
    [detail.item.code, detail.item.version, headers, queryContext, runPreflight],
  );

  const execute = useCallback(async () => {
    if (!preflight) return;
    try {
      const values = await form.validateFields();
      const body: TemporaryPromotionExecuteRequest = {
        dataNodeRef: requireOperationsScopeRef(queryContext),
        itemCode: detail.item.code,
        formalCode: values.formalCode.trim(),
        shapeKey: values.shapeKey,
        name: values.name.trim(),
        shortName: values.shortName?.trim() ?? '',
        materialRole: values.materialRole?.trim() ?? '',
        expectedSourceVersion: preflight.sourceVersion,
        expectedVersion: detail.item.version,
        preflightDigest: preflight.preflightDigest,
      };
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.executeOperationsTemporaryCatalogItemPromotion,
        body,
      );
      await executePromotion(
        catalogInventoryRtkRequest.executeOperationsTemporaryCatalogItemPromotion(
          {itemCode: detail.item.code},
          {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
        ),
      ).unwrap();
      onCompleted({codeChanged: body.formalCode !== detail.item.code});
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setProblem(catalogUiProblemFeedback(error, '暂时无法完成转正，请重新检查后再试。').message);
    }
  }, [detail.item.code, detail.item.version, executePromotion, form, headers, onCompleted, preflight, queryContext]);

  return (
    <Modal
      open={open}
      title={`${detail.item.name} · 转为正式商品`}
      onCancel={onClose}
      maskClosable={!executeState.isLoading}
      keyboard={!executeState.isLoading}
      okText="确认转正"
      cancelText="返回"
      okButtonProps={{disabled: !preflight?.canPromote, loading: executeState.isLoading}}
      onOk={() => void execute()}
      {...testId(catalogTestIds.surface.promotionTaskModal)}
    >
      <Space direction="vertical" size={12} style={{display: 'flex'}}>
        {problem && (
          <Alert
            type="error"
            showIcon
            title="检查未完成"
            description={problem}
            {...testId(catalogTestIds.static.temporaryPromotionProblem)}
          />
        )}
        <Form
          form={form}
          layout="vertical"
          onValuesChange={() => {
            setPreflight(undefined);
            setProblem(undefined);
          }}
        >
          <Space align="start" wrap style={{display: 'flex'}}>
            <Form.Item label="正式商品编码" name="formalCode" rules={[{required: true, message: '请输入正式商品编码'}]}>
              <Input {...testId(catalogTestIds.static.temporaryPromotionFormalCode)} />
            </Form.Item>
            <Form.Item label="商品名称" name="name" rules={[{required: true, message: '请输入商品名称'}]}>
              <Input {...testId(catalogTestIds.static.temporaryPromotionName)} />
            </Form.Item>
            <Form.Item label="短名" name="shortName">
              <Input {...testId(catalogTestIds.static.temporaryPromotionShortName)} />
            </Form.Item>
          </Space>
          <Form.Item label="商品形态" name="shapeKey" rules={[{required: true, message: '请选择商品形态'}]}>
            <Select
              style={catalogFieldWidth('regular')}
              options={(manifest?.shapeKeys ?? []).map(value => ({
                value,
                label: catalogEnumLabel(manifest, 'shapeKey', value),
                disabled: value === 'BENEFIT_SHELL',
              }))}
              {...testId(catalogTestIds.static.temporaryPromotionShape)}
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(previous, current) => previous.shapeKey !== current.shapeKey}>
            {({getFieldValue}) =>
              getFieldValue('shapeKey') === 'MATERIAL' ? (
                <Form.Item
                  label="物料角色"
                  name="materialRole"
                  rules={[{required: true, message: '原材料必须填写物料角色'}]}
                >
                  <Input
                    placeholder="例如：原料、半成品或包装物"
                    {...testId(catalogTestIds.static.temporaryPromotionMaterialRole)}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
        <Button
          onClick={() =>
            void form
              .validateFields()
              .then(check)
              .catch(() => undefined)
          }
          loading={preflightState.isLoading}
          {...testId(catalogTestIds.static.temporaryPromotionRePreflight)}
        >
          检查是否可以转为正式商品
        </Button>
        {preflight && (
          <>
            <Descriptions
              size="small"
              bordered
              items={[
                {
                  key: 'current',
                  label: '当前商品',
                  children: <NameCodeText name={preflight.item.name} code={preflight.item.code} />,
                },
                {
                  key: 'proposed',
                  label: '转正后商品',
                  children: <NameCodeText name={preflight.proposed.name} code={preflight.proposed.code} />,
                },
                {
                  key: 'shape',
                  label: '商品形态',
                  children: catalogEnumLabel(manifest, 'shapeKey', preflight.proposed.shapeKey),
                },
                {key: 'code', label: '商品编码', children: preflight.formalCodeAvailable ? '可用' : '已被使用'},
                {key: 'status', label: '检查结果', children: preflight.canPromote ? '可以转正' : '暂不能转正'},
              ]}
            />
            {preflight.requiredFields.length > 0 && (
              <Typography.Text type="secondary">
                待补资料：{preflight.requiredFields.map(temporaryPromotionFieldLabel).join('、')}
              </Typography.Text>
            )}
            {preflight.changes.length > 0 && (
              <Descriptions
                size="small"
                title="变更预览"
                items={preflight.changes.map(change => ({
                  key: change.field,
                  label: temporaryPromotionFieldLabel(change.field),
                  children: `${change.before ?? '—'} → ${change.after ?? '—'}`,
                }))}
              />
            )}
            {preflight.blockedReasons.length > 0 && (
              <Alert
                type="warning"
                showIcon
                title="暂不能转正"
                description={preflight.blockedReasons.map(temporaryPromotionBlockedReasonLabel).join('；')}
                {...testId(catalogTestIds.static.temporaryPromotionBlocked)}
              />
            )}
          </>
        )}
      </Space>
    </Modal>
  );
}
