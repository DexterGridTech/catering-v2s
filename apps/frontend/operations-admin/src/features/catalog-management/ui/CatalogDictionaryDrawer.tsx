import {
  Alert,
  App,
  Button,
  Descriptions,
  Divider,
  Empty,
  Flex,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Splitter,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {createContentIdempotencyKey, testId, useDrawerFormLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {CATALOG_INVENTORY_OPERATION_IDS} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../app/routing/model';
import {catalogEnumLabel, catalogEnumOptions} from '../model/catalogManifestLabels';
import {productionTagCandidateFromReadback, type CatalogProductionTagCandidate} from '../model/catalogModel';

export type ProductionTagKind = 'PRODUCTION' | 'PACKAGE' | 'LABEL' | 'HANDOFF' | 'REVIEW' | 'OTHER';
export type ProductionTagCandidate = CatalogProductionTagCandidate;
export type CatalogDictionaryQuickManageCandidate = {entryRef: string; code: string; name: string};
type Props = {
  open: boolean;
  initialKind?: DictionaryKind;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  canWrite: boolean;
  quickManage?: boolean;
  parentEntryRef?: string;
  onCreated?: (candidate: ProductionTagCandidate) => void;
  onDictionaryCreated?: (candidate: CatalogDictionaryQuickManageCandidate) => void;
  onClose: (kind?: DictionaryKind) => void;
};
export type DictionaryKind = 'TAG' | 'SALES_UNIT' | 'SKU_ATTRIBUTE' | 'SKU_ATTRIBUTE_VALUE' | 'PRODUCTION_TAG';
type FormValues = {code: string; name: string; tagKind?: ProductionTagKind};
type VoidAvailability = {
  canVoid: boolean;
  blockingReferences: Array<{referenceKind: string; referenceRef: string}>;
  dependentFacts: Array<{factKind: string; factRef: string}>;
};
type DictionaryRow = {
  entryRef: string;
  code: string;
  name: string;
  tagKind?: ProductionTagKind;
  status: string;
  version: number;
  linkedProductCount?: number;
  voidAvailability?: VoidAvailability;
};
type RebuildRequest = {row: DictionaryRow; dictionaryKind: DictionaryKind};
type NameEditRequest = {row: DictionaryRow; dictionaryKind: DictionaryKind; refresh: () => Promise<void>};
type StatusChangeRequest = {row: DictionaryRow; dictionaryKind: DictionaryKind; refresh: () => Promise<void>};

function voidReason(value?: VoidAvailability) {
  if (!value || value.canVoid) return undefined;
  if (value.blockingReferences.some(entry => entry.referenceKind === 'CATALOG_ITEM')) {
    return '仍被商品或 SKU 使用';
  }
  if (value.blockingReferences.length > 0) return '仍被其他业务记录使用';
  if (value.dependentFacts.length > 0) return '仍存在关联业务数据';
  return '当前条目暂不能作废';
}

function voidActionLabel(value?: VoidAvailability) {
  return value?.canVoid ? '作废并重建' : '作废不可用';
}

const dictionaryKindLabels: Record<DictionaryKind, string> = {
  TAG: '商品标签',
  SALES_UNIT: '销售单位',
  SKU_ATTRIBUTE: 'SKU 销售属性',
  SKU_ATTRIBUTE_VALUE: '属性值',
  PRODUCTION_TAG: '商品处理标签',
};

const dictionaryTabs: Array<{key: Exclude<DictionaryKind, 'SKU_ATTRIBUTE_VALUE'>; label: string}> = [
  {key: 'TAG', label: '商品标签'},
  {key: 'SALES_UNIT', label: '销售单位'},
  {key: 'SKU_ATTRIBUTE', label: 'SKU 销售属性'},
  {key: 'PRODUCTION_TAG', label: '商品处理标签'},
];

const dictionaryDescriptions: Record<Exclude<DictionaryKind, 'SKU_ATTRIBUTE_VALUE'>, string> = {
  TAG: '为商品补充业务特征，方便筛选和运营管理。',
  SALES_UNIT: '定义商品对外销售时使用的单位，例如杯、份或盒。',
  SKU_ATTRIBUTE: '定义商品可售规格的维度及其可选值，例如杯型与中杯。',
  PRODUCTION_TAG: '描述商品的处理要求，供履约与后厨识别，不代表岗位或设备。',
};

export function CatalogDictionaryDrawer({
  open,
  initialKind = 'TAG',
  queryContext,
  brandRef,
  canWrite,
  quickManage = false,
  parentEntryRef,
  onCreated,
  onDictionaryCreated,
  onClose,
}: Props) {
  const {modal} = App.useApp();
  const [kind, setKind] = useState<DictionaryKind>(initialKind);
  const wasOpen = useRef(false);
  const [tagForm] = Form.useForm<FormValues>();
  const [salesUnitForm] = Form.useForm<FormValues>();
  const [skuAttributeForm] = Form.useForm<FormValues>();
  const [productionTagForm] = Form.useForm<FormValues>();
  const [attributeValueForm] = Form.useForm<FormValues>();
  const [editNameForm] = Form.useForm<Pick<FormValues, 'name'>>();
  const [problem, setProblem] = useState<string>();
  const [editingEntry, setEditingEntry] = useState<NameEditRequest>();
  const [statusChange, setStatusChange] = useState<StatusChangeRequest>();
  const [rebuildFrom, setRebuildFrom] = useState<RebuildRequest>();
  const [creatingKind, setCreatingKind] = useState<DictionaryKind>();
  const [selectedAttributeRef, setSelectedAttributeRef] = useState<string>();
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const isProduction = kind === 'PRODUCTION_TAG';
  const formForKind = (value: Exclude<DictionaryKind, 'SKU_ATTRIBUTE_VALUE'>) =>
    value === 'TAG'
      ? tagForm
      : value === 'SALES_UNIT'
        ? salesUnitForm
        : value === 'SKU_ATTRIBUTE'
          ? skuAttributeForm
          : productionTagForm;
  const activeForm = kind === 'SKU_ATTRIBUTE_VALUE' ? attributeValueForm : formForKind(kind);
  const close = () => onClose(kind);
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: next => {
      if (!next) close();
    },
    dirtyMessage: '字典新建内容尚未保存。',
    dirtyGuardTestIds: {
      confirm: testId('catalog-dictionary-dirty-discard'),
      cancel: testId('catalog-dictionary-dirty-continue'),
    },
    diagnosticOperationId: isProduction ? 'production-tag-quick-manage' : 'catalog-dictionary',
  });
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
  const manifest = manifestQuery.currentData?.data;
  const productionTagKindOptions = useMemo(() => catalogEnumOptions(manifest, 'productionTagKind'), [manifest]);
  const productionTagKindLabel = (value?: ProductionTagKind) => catalogEnumLabel(manifest, 'productionTagKind', value);
  const missingParentEntry = kind === 'SKU_ATTRIBUTE_VALUE' && !parentEntryRef;
  const dictionaryRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogDictionary(
        {dictionaryKind: kind === 'PRODUCTION_TAG' ? 'TAG' : kind},
        {
          query: {
            dataNodeRef: wireUuid(queryContext.scopeRef ?? ''),
            ...(kind === 'SKU_ATTRIBUTE_VALUE' && parentEntryRef ? {parentEntryRef: wireUuid(parentEntryRef)} : {}),
          },
          headers,
        },
      ),
    [headers, kind, parentEntryRef, queryContext.scopeRef],
  );
  const dictionaryQuery = operationsRtk.useGetOperationsCatalogDictionaryQuery(dictionaryRequest, {
    skip: !open || isProduction || missingParentEntry,
  });
  const attributeValuesRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogDictionary(
        {dictionaryKind: 'SKU_ATTRIBUTE_VALUE'},
        {
          query: {
            dataNodeRef: wireUuid(queryContext.scopeRef ?? ''),
            ...(selectedAttributeRef ? {parentEntryRef: wireUuid(selectedAttributeRef)} : {}),
          },
          headers,
        },
      ),
    [headers, queryContext.scopeRef, selectedAttributeRef],
  );
  const attributeValuesQuery = operationsRtk.useGetOperationsCatalogDictionaryQuery(attributeValuesRequest, {
    skip: !open || kind !== 'SKU_ATTRIBUTE' || !selectedAttributeRef,
  });
  const productionRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsProductionTags(
        {},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers},
      ),
    [headers, queryContext.scopeRef],
  );
  const productionQuery = operationsRtk.useGetOperationsProductionTagsQuery(productionRequest, {
    skip: !open || !isProduction,
  });
  const [createEntry, createEntryState] = operationsRtk.useCreateOperationsCatalogDictionaryEntryMutation();
  const [createTag, createTagState] = operationsRtk.useCreateOperationsProductionTagMutation();
  const [updateEntry, updateEntryState] = operationsRtk.useUpdateOperationsCatalogDictionaryEntryMutation();
  const [transitionEntry, transitionEntryState] =
    operationsRtk.useTransitionOperationsCatalogDictionaryEntryStatusMutation();
  const [updateTag, updateTagState] = operationsRtk.useUpdateOperationsProductionTagMutation();
  const [transitionTag, transitionTagState] = operationsRtk.useTransitionOperationsProductionTagStatusMutation();
  const dictionaryData = dictionaryQuery.currentData?.data;
  const attributeValuesData = attributeValuesQuery.currentData?.data;
  const productionData = productionQuery.currentData?.data;
  useEffect(() => {
    if (open && !wasOpen.current) setKind(initialKind);
    wasOpen.current = open;
  }, [initialKind, open]);
  useEffect(() => {
    if (!open) {
      setEditingEntry(undefined);
      setStatusChange(undefined);
      editNameForm.resetFields();
      setRebuildFrom(undefined);
      setCreatingKind(undefined);
      setProblem(undefined);
      setSelectedAttributeRef(undefined);
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    if (kind !== 'SKU_ATTRIBUTE') {
      setSelectedAttributeRef(undefined);
      return;
    }
    const entries = dictionaryData?.entries ?? [];
    setSelectedAttributeRef(current =>
      current && entries.some(entry => entry.entryRef === current) ? current : entries[0]?.entryRef,
    );
  }, [dictionaryData?.entries, kind, open]);
  useEffect(() => {
    if (!rebuildFrom) return;
    const targetForm =
      rebuildFrom.dictionaryKind === 'SKU_ATTRIBUTE_VALUE'
        ? attributeValueForm
        : formForKind(rebuildFrom.dictionaryKind);
    targetForm.resetFields();
    targetForm.setFieldsValue({
      name: rebuildFrom.row.name,
      ...(rebuildFrom.dictionaryKind === 'PRODUCTION_TAG' ? {tagKind: rebuildFrom.row.tagKind ?? 'PRODUCTION'} : {}),
    });
    setCreatingKind(rebuildFrom.dictionaryKind);
    lifecycle.setDirty(true);
  }, [attributeValueForm, lifecycle, rebuildFrom, tagForm, salesUnitForm, skuAttributeForm, productionTagForm]);

  const create = async () => {
    try {
      const values = await activeForm.validateFields();
      if (!isProduction && missingParentEntry) {
        setProblem('属性值必须先选择所属的 SKU 销售属性。');
        return;
      }
      lifecycle.setSubmitting(true);
      setProblem(undefined);
      const code = values.code.trim();
      const name = values.name.trim();
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      if (isProduction) {
        const tagKind = values.tagKind ?? 'PRODUCTION';
        const body = {dataNodeRef, code, tagKind, name};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.createOperationsProductionTag,
          body,
        );
        const response = await createTag(
          catalogInventoryRtkRequest.createOperationsProductionTag(
            {},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
        const readback = response.result;
        const candidate = productionTagCandidateFromReadback(readback, {code, name, tagKind});
        if (!candidate) {
          setProblem('标签已创建，但暂未选用，请关闭后重试。');
          lifecycle.setSubmitting(false);
          return;
        }
        onCreated?.(candidate);
        await productionQuery.refetch();
        activeForm.resetFields();
        setRebuildFrom(undefined);
        setCreatingKind(undefined);
        lifecycle.reset();
        if (quickManage) close();
      } else {
        const body = {
          dataNodeRef,
          dictionaryKind: kind,
          code,
          name,
          ...(kind === 'SKU_ATTRIBUTE_VALUE' && parentEntryRef ? {parentEntryRef: wireUuid(parentEntryRef)} : {}),
        };
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.createOperationsCatalogDictionaryEntry,
          body,
        );
        await createEntry(
          catalogInventoryRtkRequest.createOperationsCatalogDictionaryEntry(
            {dictionaryKind: kind},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
        activeForm.resetFields();
        setRebuildFrom(undefined);
        setCreatingKind(undefined);
        lifecycle.reset();
        const refreshed = await dictionaryQuery.refetch();
        if (!quickManage && kind === 'SKU_ATTRIBUTE') {
          setSelectedAttributeRef(refreshed.data?.data.entries.find(entry => entry.code === code)?.entryRef);
        }
        if (quickManage) {
          const created = refreshed.data?.data.entries.find(entry => entry.code === code);
          if (!created) {
            setProblem('条目已创建，但暂未选用，请关闭后重试。');
            lifecycle.setSubmitting(false);
            return;
          }
          onDictionaryCreated?.({entryRef: created.entryRef, code: created.code, name: created.name});
          close();
        }
      }
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      const feedback = operationsProblemOf(error);
      if (!isProduction && feedback.errorCode === 'DUPLICATE_CODE') {
        activeForm.setFields([{name: 'code', errors: [feedback.detail || '当前作用域中已存在相同编码。']}]);
        setProblem(undefined);
        lifecycle.setSubmitting(false);
        return;
      }
      setProblem(feedback.detail || '字典保存未完成，请重试。');
      lifecycle.setSubmitting(false);
    }
  };

  const createAttributeValue = async () => {
    try {
      const values = await attributeValueForm.validateFields();
      if (!selectedAttributeRef) {
        setProblem('请先选择 SKU 销售属性，再新增属性值。');
        return;
      }
      lifecycle.setSubmitting(true);
      setProblem(undefined);
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const body = {
        dataNodeRef,
        dictionaryKind: 'SKU_ATTRIBUTE_VALUE',
        code: values.code.trim(),
        name: values.name.trim(),
        parentEntryRef: wireUuid(selectedAttributeRef),
      };
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.createOperationsCatalogDictionaryEntry,
        body,
      );
      await createEntry(
        catalogInventoryRtkRequest.createOperationsCatalogDictionaryEntry(
          {dictionaryKind: 'SKU_ATTRIBUTE_VALUE'},
          {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
        ),
      ).unwrap();
      attributeValueForm.resetFields();
      setRebuildFrom(undefined);
      setCreatingKind(undefined);
      lifecycle.reset();
      await attributeValuesQuery.refetch();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      const feedback = operationsProblemOf(error);
      if (feedback.errorCode === 'DUPLICATE_CODE') {
        attributeValueForm.setFields([{name: 'code', errors: [feedback.detail || '当前作用域中已存在相同编码。']}]);
        setProblem(undefined);
        lifecycle.setSubmitting(false);
        return;
      }
      setProblem(feedback.detail || '属性值保存未完成，请重试。');
      lifecycle.setSubmitting(false);
    }
  };

  const refreshRows = async () => {
    if (isProduction) await productionQuery.refetch();
    else await dictionaryQuery.refetch();
  };
  const refreshAttributeValues = async () => {
    if (selectedAttributeRef) await attributeValuesQuery.refetch();
  };
  const openNameEdit = (row: DictionaryRow, dictionaryKind: DictionaryKind = kind, refresh = refreshRows) => {
    editNameForm.setFieldsValue({name: row.name});
    setProblem(undefined);
    setEditingEntry({row, dictionaryKind, refresh});
  };
  const saveName = async () => {
    if (!editingEntry) return;
    const {row, dictionaryKind, refresh} = editingEntry;
    try {
      const values = await editNameForm.validateFields();
      const name = values.name.trim();
      setProblem(undefined);
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      if (dictionaryKind === 'PRODUCTION_TAG') {
        const body = {
          dataNodeRef,
          tagCode: row.code,
          expectedVersion: row.version,
          tagKind: row.tagKind ?? 'OTHER',
          name,
        };
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.updateOperationsProductionTag,
          body,
        );
        await updateTag(
          catalogInventoryRtkRequest.updateOperationsProductionTag(
            {tagCode: row.code},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      } else {
        const body = {dataNodeRef, dictionaryKind, entryCode: row.code, expectedVersion: row.version, name};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.updateOperationsCatalogDictionaryEntry,
          body,
        );
        await updateEntry(
          catalogInventoryRtkRequest.updateOperationsCatalogDictionaryEntry(
            {dictionaryKind, entryCode: row.code},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      }
      await refresh();
      editNameForm.resetFields();
      setEditingEntry(undefined);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setProblem(operationsProblemOf(error).detail || '字典名称更新未完成，请重试。');
    }
  };
  const openStatusChange = (row: DictionaryRow, dictionaryKind: DictionaryKind = kind, refresh = refreshRows) => {
    if (row.status === 'VOIDED') return;
    setProblem(undefined);
    setStatusChange({row, dictionaryKind, refresh});
  };
  const changeStatus = async () => {
    if (!statusChange) return;
    const {row, dictionaryKind, refresh} = statusChange;
    const targetStatus = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    try {
      setProblem(undefined);
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      if (dictionaryKind === 'PRODUCTION_TAG') {
        const body = {dataNodeRef, tagCode: row.code, expectedVersion: row.version, targetStatus};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.transitionOperationsProductionTagStatus,
          body,
        );
        await transitionTag(
          catalogInventoryRtkRequest.transitionOperationsProductionTagStatus(
            {tagCode: row.code},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      } else {
        const body = {dataNodeRef, dictionaryKind, entryCode: row.code, expectedVersion: row.version, targetStatus};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.transitionOperationsCatalogDictionaryEntryStatus,
          body,
        );
        await transitionEntry(
          catalogInventoryRtkRequest.transitionOperationsCatalogDictionaryEntryStatus(
            {dictionaryKind, entryCode: row.code},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      }
      await refresh();
      setStatusChange(undefined);
    } catch (error) {
      setProblem(operationsProblemOf(error).detail || '字典状态更新未完成，请重试。');
    }
  };
  const voidAndPrepareRebuild = (
    row: DictionaryRow,
    dictionaryKind: DictionaryKind = kind,
    refresh: () => Promise<void> = refreshRows,
  ) => {
    if (!row.voidAvailability?.canVoid) return;
    modal.confirm({
      title: `作废并重建“${row.name}”`,
      content: '将先把旧记录置为作废并永久保留原编码，然后用新编码创建一条记录。旧编码不会释放。',
      okText: '作废并继续重建',
      cancelText: '取消',
      onOk: async () => {
        try {
          setProblem(undefined);
          const dataNodeRef = requireOperationsScopeRef(queryContext);
          if (dictionaryKind === 'PRODUCTION_TAG') {
            const body = {
              dataNodeRef,
              tagCode: row.code,
              expectedVersion: row.version,
              targetStatus: 'VOIDED' as const,
            };
            const idempotencyKey = await createContentIdempotencyKey(
              CATALOG_INVENTORY_OPERATION_IDS.transitionOperationsProductionTagStatus,
              body,
            );
            await transitionTag(
              catalogInventoryRtkRequest.transitionOperationsProductionTagStatus(
                {tagCode: row.code},
                {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
              ),
            ).unwrap();
          } else {
            const body = {
              dataNodeRef,
              dictionaryKind,
              entryCode: row.code,
              expectedVersion: row.version,
              targetStatus: 'VOIDED' as const,
            };
            const idempotencyKey = await createContentIdempotencyKey(
              CATALOG_INVENTORY_OPERATION_IDS.transitionOperationsCatalogDictionaryEntryStatus,
              body,
            );
            await transitionEntry(
              catalogInventoryRtkRequest.transitionOperationsCatalogDictionaryEntryStatus(
                {dictionaryKind, entryCode: row.code},
                {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
              ),
            ).unwrap();
          }
          setRebuildFrom({row, dictionaryKind});
          setCreatingKind(dictionaryKind);
          await refresh();
        } catch (error) {
          setProblem(operationsProblemOf(error).detail || '作废未完成，请重试。');
          throw error;
        }
      },
    });
  };
  const rows: DictionaryRow[] = isProduction
    ? (productionData?.entries ?? []).map(entry => ({
        entryRef: entry.tagRef,
        code: entry.code,
        name: entry.name,
        tagKind: entry.tagKind,
        status: entry.status,
        version: entry.version,
        linkedProductCount: entry.linkedProductCount,
        voidAvailability: entry.voidAvailability,
      }))
    : (dictionaryData?.entries ?? []).map(entry => ({
        entryRef: entry.entryRef,
        code: entry.code,
        name: entry.name,
        status: entry.status,
        version: entry.version,
        voidAvailability: entry.voidAvailability,
      }));
  const attributeValueRows: DictionaryRow[] = (attributeValuesData?.entries ?? []).map(entry => ({
    entryRef: entry.entryRef,
    code: entry.code,
    name: entry.name,
    status: entry.status,
    version: entry.version,
    voidAvailability: entry.voidAvailability,
  }));
  const selectedAttribute = rows.find(row => row.entryRef === selectedAttributeRef);
  const isSkuAttributeManagement = !quickManage && kind === 'SKU_ATTRIBUTE';
  const readOnlyReason = canWrite ? undefined : '当前账号只有查看商品库的权限，不能修改字典。';
  const activeEntityKind = kind === 'SKU_ATTRIBUTE_VALUE' ? 'SKU_ATTRIBUTE' : kind;
  const activeEntityLabel = dictionaryKindLabels[activeEntityKind];
  const activeEntityDescription = dictionaryDescriptions[activeEntityKind];
  const createLabel =
    activeEntityKind === 'PRODUCTION_TAG'
      ? '新建商品处理标签'
      : activeEntityKind === 'SKU_ATTRIBUTE'
        ? '新建销售属性'
        : activeEntityKind === 'TAG'
          ? '新建商品标签'
          : '新建销售单位';
  const creationKind = creatingKind ?? kind;
  const creationForm = creationKind === 'SKU_ATTRIBUTE_VALUE' ? attributeValueForm : formForKind(creationKind);
  const creationIsProduction = creationKind === 'PRODUCTION_TAG';
  const codeFieldLabel =
    creationKind === 'PRODUCTION_TAG'
      ? '商品处理标签编码'
      : creationKind === 'TAG'
        ? '商品标签编码'
        : creationKind === 'SALES_UNIT'
          ? '销售单位编码'
          : creationKind === 'SKU_ATTRIBUTE'
            ? '销售属性编码'
            : '属性值编码';
  const nameFieldLabel =
    creationKind === 'PRODUCTION_TAG'
      ? '商品处理标签名称'
      : creationKind === 'TAG'
        ? '商品标签名称'
        : creationKind === 'SALES_UNIT'
          ? '销售单位名称'
          : creationKind === 'SKU_ATTRIBUTE'
            ? '销售属性名称'
            : '属性值名称';
  const creationTitle =
    creationKind === 'SKU_ATTRIBUTE_VALUE'
      ? `新增“${selectedAttribute?.name ?? '规格维度'}”的可选值`
      : creationKind === 'SKU_ATTRIBUTE'
        ? '新建规格维度'
        : `新建${dictionaryKindLabels[creationKind]}`;
  const creationFormTestId =
    creationKind === 'SKU_ATTRIBUTE'
      ? testId('catalog-sku-attribute-create-form')
      : creationKind === 'SKU_ATTRIBUTE_VALUE'
        ? testId('catalog-sku-attribute-value-create-form')
        : undefined;
  const creationButtonTestId =
    creationKind === 'SKU_ATTRIBUTE'
      ? testId('catalog-sku-attribute-create')
      : creationKind === 'SKU_ATTRIBUTE_VALUE'
        ? testId('catalog-sku-attribute-value-create')
        : testId(quickManage ? 'catalog-production-tag-quick-manage-create' : 'catalog-dictionary-create');
  const submitCreation = () => {
    if (creatingKind === 'SKU_ATTRIBUTE_VALUE') void createAttributeValue();
    else void create();
  };
  const openCreate = (nextKind: DictionaryKind) => {
    const targetForm = nextKind === 'SKU_ATTRIBUTE_VALUE' ? attributeValueForm : formForKind(nextKind);
    targetForm.resetFields();
    setRebuildFrom(undefined);
    setProblem(undefined);
    setCreatingKind(nextKind);
  };
  const dismissCreate = (nextKind: DictionaryKind) => {
    const targetForm = nextKind === 'SKU_ATTRIBUTE_VALUE' ? attributeValueForm : formForKind(nextKind);
    targetForm.resetFields();
    setRebuildFrom(undefined);
    setCreatingKind(undefined);
    lifecycle.reset();
  };
  const title = quickManage
    ? `快速创建${isProduction ? '商品处理标签' : (dictionaryKindLabels[kind] ?? '字典条目')}`
    : '商品字典与关联维护';
  return (
    <Modal
      title={title}
      open={open}
      onCancel={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      destroyOnHidden={false}
      mask={{closable: !lifecycle.dirty}}
      footer={null}
      width={1200}
      styles={{body: {maxHeight: 'calc(100vh - 200px)', overflowY: 'auto'}}}
      {...testId(quickManage ? 'catalog-production-tag-quick-manage-drawer' : 'catalog-dictionary-drawer')}
    >
      {problem && !creatingKind && !editingEntry && !statusChange && (
        <Alert
          type="error"
          showIcon
          title="字典操作未完成"
          description={problem}
          style={{marginBottom: 16}}
          {...testId('catalog-dictionary-problem')}
        />
      )}
      {!quickManage && (
        <Tabs
          activeKey={kind}
          onChange={next => setKind(next as DictionaryKind)}
          items={dictionaryTabs.map(tab => ({key: tab.key, label: tab.label}))}
          {...testId('catalog-dictionary-tabs')}
        />
      )}
      {isSkuAttributeManagement && (
        <Splitter style={{minHeight: 360}} {...testId('catalog-sku-attribute-manager')}>
          <Splitter.Panel defaultSize="36%" min="280px" max="440px">
            <Flex vertical gap="middle" style={{paddingRight: 16}}>
              <Flex justify="space-between" align="center">
                <Typography.Text strong>规格维度</Typography.Text>
                {canWrite && rows.length > 0 && (
                  <Button type="primary" size="small" onClick={() => openCreate('SKU_ATTRIBUTE')}>
                    新建规格维度
                  </Button>
                )}
              </Flex>
              <Table
                size="small"
                rowKey="entryRef"
                rowSelection={{
                  type: 'radio',
                  selectedRowKeys: selectedAttributeRef ? [selectedAttributeRef] : [],
                  onChange: selectedRowKeys => setSelectedAttributeRef(String(selectedRowKeys[0] ?? '')),
                }}
                loading={dictionaryQuery.isLoading || dictionaryQuery.isFetching}
                dataSource={rows}
                pagination={false}
                locale={{
                  emptyText: (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有规格维度。">
                      {canWrite && (
                        <Button type="primary" onClick={() => openCreate('SKU_ATTRIBUTE')}>
                          新建规格维度
                        </Button>
                      )}
                    </Empty>
                  ),
                }}
                columns={[
                  {title: '名称', dataIndex: 'name'},
                  {title: '编码', dataIndex: 'code'},
                  {
                    title: '状态',
                    dataIndex: 'status',
                    render: (value: string) => <StatusTag manifest={manifest} value={value} />,
                  },
                ]}
                onRow={row => ({onClick: () => setSelectedAttributeRef(row.entryRef), style: {cursor: 'pointer'}})}
                {...testId('catalog-sku-attributes-table')}
              />
            </Flex>
          </Splitter.Panel>
          <Splitter.Panel>
            <div style={{paddingLeft: 16}}>
              {!selectedAttribute ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择左侧规格维度，查看其可选值。" />
              ) : (
                <Flex vertical gap="middle">
                  <Flex justify="space-between" align="start" gap="middle">
                    <Flex vertical gap={4} style={{flex: '1 1 auto', minWidth: 0}}>
                      <Flex align="center" gap="small">
                        <Typography.Title level={5} style={{margin: 0}}>
                          {selectedAttribute.name}
                        </Typography.Title>
                        <StatusTag manifest={manifest} value={selectedAttribute.status} />
                      </Flex>
                      <Typography.Text type="secondary">编码：{selectedAttribute.code}</Typography.Text>
                      {voidReason(selectedAttribute.voidAvailability) && (
                        <Typography.Text type="secondary">
                          暂不能作废：{voidReason(selectedAttribute.voidAvailability)}
                        </Typography.Text>
                      )}
                    </Flex>
                    <Space wrap style={{flex: '0 0 auto', justifyContent: 'flex-end'}}>
                      {selectedAttribute.status !== 'VOIDED' &&
                        withMutationReason(
                          <Button type="link" disabled={!canWrite} onClick={() => openNameEdit(selectedAttribute)}>
                            编辑名称
                          </Button>,
                          !canWrite,
                          readOnlyReason,
                        )}
                      {selectedAttribute.status !== 'VOIDED' &&
                        withMutationReason(
                          <Button type="link" disabled={!canWrite} onClick={() => openStatusChange(selectedAttribute)}>
                            {selectedAttribute.status === 'ENABLED' ? '停用' : '启用'}
                          </Button>,
                          !canWrite,
                          readOnlyReason,
                        )}
                      {selectedAttribute.status !== 'VOIDED' &&
                        withMutationReason(
                          <Button
                            type="link"
                            danger
                            disabled={!canWrite || !selectedAttribute.voidAvailability?.canVoid}
                            onClick={() => voidAndPrepareRebuild(selectedAttribute)}
                          >
                            {voidActionLabel(selectedAttribute.voidAvailability)}
                          </Button>,
                          !canWrite || !selectedAttribute.voidAvailability?.canVoid,
                          canWrite ? voidReason(selectedAttribute.voidAvailability) : readOnlyReason,
                        )}
                      {canWrite && attributeValueRows.length > 0 && (
                        <Button type="primary" onClick={() => openCreate('SKU_ATTRIBUTE_VALUE')}>
                          新增可选值
                        </Button>
                      )}
                    </Space>
                  </Flex>
                  <Divider titlePlacement="start">可选值</Divider>
                  <Table
                    size="small"
                    rowKey="entryRef"
                    loading={attributeValuesQuery.isLoading || attributeValuesQuery.isFetching}
                    dataSource={attributeValueRows}
                    pagination={false}
                    locale={{
                      emptyText: (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这个规格维度还没有可选值。">
                          {canWrite && (
                            <Button type="primary" onClick={() => openCreate('SKU_ATTRIBUTE_VALUE')}>
                              新增可选值
                            </Button>
                          )}
                        </Empty>
                      ),
                    }}
                    columns={[
                      {title: '名称', dataIndex: 'name'},
                      {title: '编码', dataIndex: 'code'},
                      {
                        title: '状态',
                        dataIndex: 'status',
                        render: (value: string) => <StatusTag manifest={manifest} value={value} />,
                      },
                      {
                        key: 'actions',
                        render: (_: unknown, row: DictionaryRow) => (
                          <Space>
                            {row.status !== 'VOIDED' &&
                              withMutationReason(
                                <Button
                                  type="link"
                                  disabled={!canWrite}
                                  onClick={() => openNameEdit(row, 'SKU_ATTRIBUTE_VALUE', refreshAttributeValues)}
                                >
                                  编辑名称
                                </Button>,
                                !canWrite,
                                readOnlyReason,
                              )}
                            {row.status !== 'VOIDED' &&
                              withMutationReason(
                                <Button
                                  type="link"
                                  disabled={!canWrite}
                                  onClick={() => openStatusChange(row, 'SKU_ATTRIBUTE_VALUE', refreshAttributeValues)}
                                >
                                  {row.status === 'ENABLED' ? '停用' : '启用'}
                                </Button>,
                                !canWrite,
                                readOnlyReason,
                              )}
                            {row.status !== 'VOIDED' &&
                              withMutationReason(
                                <Button
                                  type="link"
                                  danger
                                  disabled={!canWrite || !row.voidAvailability?.canVoid}
                                  onClick={() =>
                                    voidAndPrepareRebuild(row, 'SKU_ATTRIBUTE_VALUE', refreshAttributeValues)
                                  }
                                >
                                  {voidActionLabel(row.voidAvailability)}
                                </Button>,
                                !canWrite || !row.voidAvailability?.canVoid,
                                canWrite ? voidReason(row.voidAvailability) : readOnlyReason,
                              )}
                          </Space>
                        ),
                      },
                    ]}
                    {...testId('catalog-sku-attribute-values-table')}
                  />
                </Flex>
              )}
            </div>
          </Splitter.Panel>
        </Splitter>
      )}
      {!quickManage && !isSkuAttributeManagement && (
        <Flex vertical gap="middle">
          <Flex justify="space-between" align="center" gap="middle">
            <Typography.Text type="secondary">{activeEntityDescription}</Typography.Text>
            {canWrite && rows.length > 0 && (
              <Button type="primary" onClick={() => openCreate(kind)}>
                {createLabel}
              </Button>
            )}
          </Flex>
          <Table
            size="small"
            rowKey="entryRef"
            loading={
              isProduction
                ? productionQuery.isLoading || productionQuery.isFetching
                : dictionaryQuery.isLoading || dictionaryQuery.isFetching
            }
            dataSource={rows}
            pagination={false}
            locale={{
              emptyText: (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`还没有${activeEntityLabel}。`}>
                  {canWrite && (
                    <Button type="primary" onClick={() => openCreate(kind)}>
                      {createLabel}
                    </Button>
                  )}
                </Empty>
              ),
            }}
            columns={[
              {title: '名称', dataIndex: 'name'},
              {title: '编码', dataIndex: 'code'},
              ...(isProduction
                ? [
                    {
                      title: '类型',
                      dataIndex: 'tagKind',
                      render: (value: ProductionTagKind) => productionTagKindLabel(value),
                    },
                  ]
                : []),
              {
                title: '状态',
                dataIndex: 'status',
                render: (value: string) => <StatusTag manifest={manifest} value={value} />,
              },
              {
                key: 'actions',
                render: (_: unknown, row: DictionaryRow) => (
                  <Space>
                    {row.status !== 'VOIDED' &&
                      withMutationReason(
                        <Button
                          type="link"
                          disabled={!canWrite}
                          onClick={() => openNameEdit(row)}
                          {...testId(`catalog-dictionary-edit-${row.code}`)}
                        >
                          编辑名称
                        </Button>,
                        !canWrite,
                        readOnlyReason,
                      )}
                    {row.status !== 'VOIDED' &&
                      withMutationReason(
                        <Button type="link" disabled={!canWrite} onClick={() => openStatusChange(row)}>
                          {row.status === 'ENABLED' ? '停用' : '启用'}
                        </Button>,
                        !canWrite,
                        readOnlyReason,
                      )}
                    {row.status !== 'VOIDED' &&
                      (() => {
                        const reason = canWrite ? voidReason(row.voidAvailability) : readOnlyReason;
                        const disabled = !canWrite || !row.voidAvailability?.canVoid;
                        const button = (
                          <Button
                            type="link"
                            danger
                            disabled={disabled}
                            onClick={() => voidAndPrepareRebuild(row)}
                            {...testId(`catalog-dictionary-void-rebuild-${row.code}`)}
                          >
                            {voidActionLabel(row.voidAvailability)}
                          </Button>
                        );
                        return withMutationReason(button, disabled, reason);
                      })()}
                  </Space>
                ),
              },
            ]}
            {...testId('catalog-dictionary-table')}
          />
        </Flex>
      )}
      {canWrite && quickManage && (
        <Form
          form={creationForm}
          layout="vertical"
          onValuesChange={() => lifecycle.setDirty(true)}
          {...creationFormTestId}
        >
          <Form.Item label={nameFieldLabel} name="name" rules={[{required: true, message: '请输入名称'}]}>
            <Input autoFocus {...testId('catalog-dictionary-name')} />
          </Form.Item>
          {creationIsProduction && (
            <Form.Item
              label="商品处理标签类型"
              name="tagKind"
              initialValue="PRODUCTION"
              rules={[{required: true, message: '请选择标签类型'}]}
            >
              <Select
                loading={manifestQuery.isLoading}
                options={productionTagKindOptions}
                placeholder="请选择类型"
                {...testId('catalog-production-tag-kind')}
              />
            </Form.Item>
          )}
          <Form.Item
            label={codeFieldLabel}
            name="code"
            extra="创建后不可修改；编码可按业务需要填写。"
            rules={[{required: true, message: '请输入编码'}]}
          >
            <Input placeholder="请输入业务编码" {...testId('catalog-dictionary-code')} />
          </Form.Item>
          <Button
            type="primary"
            loading={createEntryState.isLoading || createTagState.isLoading || lifecycle.submitting}
            onClick={submitCreation}
            {...creationButtonTestId}
          >
            创建并选用
          </Button>
        </Form>
      )}
      {canWrite && !quickManage && creatingKind && (
        <Modal
          title={creationTitle}
          open
          onCancel={() => dismissCreate(creatingKind)}
          mask={{closable: !lifecycle.dirty}}
          width={560}
          confirmLoading={createEntryState.isLoading || createTagState.isLoading || lifecycle.submitting}
          okText="创建"
          cancelText="取消"
          onOk={submitCreation}
          {...testId('catalog-dictionary-create-modal')}
        >
          {problem && (
            <Alert type="error" showIcon title="保存未完成" description={problem} style={{marginBottom: 16}} />
          )}
          <Form
            form={creationForm}
            layout="vertical"
            onValuesChange={() => lifecycle.setDirty(true)}
            {...creationFormTestId}
          >
            {rebuildFrom?.dictionaryKind === creatingKind && (
              <Alert
                type="warning"
                showIcon
                title="正在重建作废记录"
                description={`旧编码 ${rebuildFrom.row.code} 已永久保留，请输入新的唯一编码后创建。`}
                style={{marginBottom: 12}}
                {...testId('catalog-dictionary-rebuild-notice')}
              />
            )}
            <Typography.Paragraph type="secondary">
              {creationKind === 'SKU_ATTRIBUTE_VALUE'
                ? '新增的可选值会归属到当前选中的规格维度。'
                : creationKind === 'SKU_ATTRIBUTE'
                  ? '创建规格维度后，可在右侧维护其可选值。'
                  : '填写后可立即在商品维护中使用。'}
            </Typography.Paragraph>
            <Form.Item label={nameFieldLabel} name="name" rules={[{required: true, message: '请输入名称'}]}>
              <Input autoFocus {...testId('catalog-dictionary-name')} />
            </Form.Item>
            {creationIsProduction && (
              <Form.Item
                label="商品处理标签类型"
                name="tagKind"
                initialValue="PRODUCTION"
                rules={[{required: true, message: '请选择标签类型'}]}
              >
                <Select
                  loading={manifestQuery.isLoading}
                  options={productionTagKindOptions}
                  placeholder="请选择类型"
                  {...testId('catalog-production-tag-kind')}
                />
              </Form.Item>
            )}
            <Form.Item
              label={codeFieldLabel}
              name="code"
              extra="创建后不可修改；编码可按业务需要填写。"
              rules={[{required: true, message: '请输入编码'}]}
            >
              <Input placeholder="请输入业务编码" {...testId('catalog-dictionary-code')} />
            </Form.Item>
          </Form>
        </Modal>
      )}
      {canWrite && editingEntry && (
        <Modal
          title={`编辑${dictionaryKindLabels[editingEntry.dictionaryKind]}名称`}
          open
          width={520}
          okText="保存"
          cancelText="取消"
          confirmLoading={updateEntryState.isLoading || updateTagState.isLoading}
          onOk={() => void saveName()}
          onCancel={() => {
            editNameForm.resetFields();
            setProblem(undefined);
            setEditingEntry(undefined);
          }}
          {...testId('catalog-dictionary-name-edit-modal')}
        >
          {problem && (
            <Alert type="error" showIcon title="保存未完成" description={problem} style={{marginBottom: 16}} />
          )}
          <Descriptions
            size="small"
            column={2}
            items={[
              {key: 'code', label: '编码', children: editingEntry.row.code},
              {
                key: 'status',
                label: '当前状态',
                children: <StatusTag manifest={manifest} value={editingEntry.row.status} />,
              },
            ]}
            style={{marginBottom: 16}}
          />
          <Form form={editNameForm} layout="vertical">
            <Form.Item label="名称" name="name" rules={[{required: true, message: '请输入名称'}]}>
              <Input autoFocus {...testId(`catalog-dictionary-edit-name-${editingEntry.row.code}`)} />
            </Form.Item>
          </Form>
        </Modal>
      )}
      {canWrite && statusChange && (
        <Modal
          title={`${statusChange.row.status === 'ENABLED' ? '停用' : '启用'}“${statusChange.row.name}”`}
          open
          okText={`确认${statusChange.row.status === 'ENABLED' ? '停用' : '启用'}`}
          okButtonProps={{danger: statusChange.row.status === 'ENABLED'}}
          cancelText="取消"
          confirmLoading={transitionEntryState.isLoading || transitionTagState.isLoading}
          onOk={() => void changeStatus()}
          onCancel={() => {
            setProblem(undefined);
            setStatusChange(undefined);
          }}
          {...testId('catalog-dictionary-status-change-modal')}
        >
          {problem && (
            <Alert type="error" showIcon title="状态更新未完成" description={problem} style={{marginBottom: 16}} />
          )}
          <Typography.Paragraph>
            {statusChange.row.status === 'ENABLED'
              ? '停用后，新建商品时不会再提供该条目；已经保存的商品引用不受影响。'
              : '启用后，该条目会重新出现在新建商品的候选列表中。'}
          </Typography.Paragraph>
        </Modal>
      )}
      {!canWrite && <TypographyHint text="当前账号没有编辑商品库能力，只读查看字典。" />}
    </Modal>
  );
}

function TypographyHint({text}: {text: string}) {
  return <Typography.Text type="secondary">{text}</Typography.Text>;
}

function StatusTag({manifest, value}: {manifest: Parameters<typeof catalogEnumLabel>[0]; value: string}) {
  return (
    <Tag color={value === 'ENABLED' ? 'green' : value === 'VOIDED' ? 'red' : 'default'}>
      {catalogEnumLabel(manifest, 'dictionaryEntryStatus', value)}
    </Tag>
  );
}

function withMutationReason(content: ReactNode, disabled: boolean, reason?: string) {
  if (!disabled || !reason) return content;
  return (
    <Tooltip title={reason}>
      <span style={{display: 'inline-block'}}>{content}</span>
    </Tooltip>
  );
}
