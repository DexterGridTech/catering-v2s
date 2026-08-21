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
  InputNumber,
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
import {
  createContentIdempotencyKey,
  CursorPagination,
  type DrawerLifecycleDiagnosticEvent,
  testId,
  useCursorStack,
  useDrawerFormLifecycle,
  useRefreshVersion,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {
  operationsContentTabRefreshSignal,
  operationsLogger,
  operationsProblemOf,
  operationsRtk,
} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {
  CATALOG_INVENTORY_OPERATION_IDS,
  type CatalogDictionaryEntryReadback,
} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../app/routing/model';
import {catalogEnumLabel, catalogEnumOptions} from '../model/catalogManifestLabels';
import {catalogDictionaryQuickManageCandidateFromReadback} from '../model/catalogDictionaryReadback';
import {productionTagCandidateFromReadback, type CatalogProductionTagCandidate} from '../model/catalogModel';
import {CatalogDefinitionLibraries} from './CatalogDefinitionLibraries';

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
export type DictionaryKind = 'TAG' | 'UNIT' | 'SKU_ATTRIBUTE' | 'SKU_ATTRIBUTE_VALUE' | 'PRODUCTION_TAG';
type MetadataTab = Exclude<DictionaryKind, 'SKU_ATTRIBUTE_VALUE'> | 'ATTRIBUTES' | 'ORDER_OPTIONS';
type FormValues = {
  code: string;
  name: string;
  tagKind?: ProductionTagKind;
  unitDimension?: 'COUNT' | 'WEIGHT' | 'VOLUME' | 'SERVICE_DURATION' | 'PACKAGE';
  precision?: number;
};
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
  unitDimension?: FormValues['unitDimension'];
  precision?: number;
  isReferenced?: boolean;
  linkedProductCount?: number;
  voidAvailability?: VoidAvailability;
};
type RebuildRequest = {row: DictionaryRow; dictionaryKind: DictionaryKind};
type NameEditRequest = {row: DictionaryRow; dictionaryKind: DictionaryKind};
type UnitEditValues = Pick<FormValues, 'code' | 'name' | 'unitDimension' | 'precision'>;
type StatusChangeRequest = {row: DictionaryRow; dictionaryKind: DictionaryKind};

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
  UNIT: '计量单位',
  SKU_ATTRIBUTE: 'SKU 销售属性',
  SKU_ATTRIBUTE_VALUE: '属性值',
  PRODUCTION_TAG: '商品处理标签',
};

const dictionaryTabs: Array<{key: Exclude<DictionaryKind, 'SKU_ATTRIBUTE_VALUE'>; label: string}> = [
  {key: 'TAG', label: '商品标签'},
  {key: 'UNIT', label: '计量单位'},
  {key: 'SKU_ATTRIBUTE', label: 'SKU 销售属性'},
  {key: 'PRODUCTION_TAG', label: '商品处理标签'},
];

const dictionaryDescriptions: Record<Exclude<DictionaryKind, 'SKU_ATTRIBUTE_VALUE'>, string> = {
  TAG: '为商品补充业务特征，方便筛选和运营管理。',
  UNIT: '维护有限的计量单位定义；精度属于单位本身，停用只影响后续候选。',
  SKU_ATTRIBUTE: '定义商品可售规格的维度及其可选值，例如杯型与中杯。',
  PRODUCTION_TAG: '描述商品的处理要求，供履约与后厨识别，不代表岗位或设备。',
};

const DICTIONARY_PAGE_SIZE = 50;

const unitDimensionOptions: Array<{value: FormValues['unitDimension']; label: string}> = [
  {value: 'COUNT', label: '计数'},
  {value: 'WEIGHT', label: '重量'},
  {value: 'VOLUME', label: '体积'},
  {value: 'SERVICE_DURATION', label: '服务时长'},
  {value: 'PACKAGE', label: '包装'},
];

function unitDimensionLabel(value?: FormValues['unitDimension']) {
  return unitDimensionOptions.find(option => option.value === value)?.label ?? value ?? '—';
}

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
  const [metadataTab, setMetadataTab] = useState<MetadataTab>(
    initialKind === 'SKU_ATTRIBUTE_VALUE' ? 'SKU_ATTRIBUTE' : initialKind,
  );
  const wasOpen = useRef(false);
  const [tagForm] = Form.useForm<FormValues>();
  const [unitForm] = Form.useForm<FormValues>();
  const [skuAttributeForm] = Form.useForm<FormValues>();
  const [productionTagForm] = Form.useForm<FormValues>();
  const [attributeValueForm] = Form.useForm<FormValues>();
  const [editNameForm] = Form.useForm<Pick<FormValues, 'name'>>();
  const [editUnitForm] = Form.useForm<UnitEditValues>();
  const [problem, setProblem] = useState<string>();
  const [editingEntry, setEditingEntry] = useState<NameEditRequest>();
  const [editingUnit, setEditingUnit] = useState<DictionaryRow>();
  const [statusChange, setStatusChange] = useState<StatusChangeRequest>();
  const [rebuildFrom, setRebuildFrom] = useState<RebuildRequest>();
  const [creatingKind, setCreatingKind] = useState<DictionaryKind>();
  const [selectedAttributeRef, setSelectedAttributeRef] = useState<string>();
  const drawerOperationInstanceId = useRef<string | undefined>(undefined);
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const isProduction = kind === 'PRODUCTION_TAG';
  const isUnit = kind === 'UNIT';
  const isDefinitionLibrary = metadataTab === 'ATTRIBUTES' || metadataTab === 'ORDER_OPTIONS';
  const dictionaryCursor = useCursorStack({
    resetKey: `${open}|${kind}|${queryContext.scopeRef ?? ''}|${brandRef ?? ''}|${parentEntryRef ?? ''}`,
  });
  const attributeValuesCursor = useCursorStack({
    resetKey: `${open}|${selectedAttributeRef ?? ''}|${queryContext.scopeRef ?? ''}|${brandRef ?? ''}`,
  });
  const productionCursor = useCursorStack({
    resetKey: `${open}|production-tags|${queryContext.scopeRef ?? ''}|${brandRef ?? ''}`,
  });
  const formForKind = useCallback(
    (value: Exclude<DictionaryKind, 'SKU_ATTRIBUTE_VALUE'>) =>
      value === 'TAG'
        ? tagForm
        : value === 'UNIT'
          ? unitForm
          : value === 'SKU_ATTRIBUTE'
            ? skuAttributeForm
            : productionTagForm,
    [productionTagForm, skuAttributeForm, tagForm, unitForm],
  );
  const activeForm = kind === 'SKU_ATTRIBUTE_VALUE' ? attributeValueForm : formForKind(kind);
  const close = () => onClose(kind);
  const onLifecycleDiagnostic = useCallback((event: DrawerLifecycleDiagnosticEvent) => {
    drawerOperationInstanceId.current = event.operationInstanceId;
    operationsLogger.info({
      event: 'catalog.dictionary.lifecycle',
      phase: event.phase,
      outcome: event.outcome,
      operationId: event.operationId,
      operationInstanceId: event.operationInstanceId,
    });
  }, []);
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
    onDiagnosticEvent: onLifecycleDiagnostic,
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
        {dictionaryKind: kind === 'PRODUCTION_TAG' || kind === 'UNIT' ? 'TAG' : kind},
        {
          query: {
            dataNodeRef: wireUuid(queryContext.scopeRef ?? ''),
            ...(kind === 'SKU_ATTRIBUTE_VALUE' && parentEntryRef ? {parentEntryRef: wireUuid(parentEntryRef)} : {}),
            ...(dictionaryCursor.cursor ? {cursor: dictionaryCursor.cursor} : {}),
            pageSize: DICTIONARY_PAGE_SIZE,
          },
          headers,
        },
      ),
    [dictionaryCursor.cursor, headers, kind, parentEntryRef, queryContext.scopeRef],
  );
  const dictionaryQuery = operationsRtk.useGetOperationsCatalogDictionaryQuery(dictionaryRequest, {
    skip: !open || isDefinitionLibrary || isProduction || isUnit || missingParentEntry,
  });
  const unitRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.listOperationsCatalogUnits(
        {},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? ''), includeInactive: true}, headers},
      ),
    [headers, queryContext.scopeRef],
  );
  const unitQuery = operationsRtk.useListOperationsCatalogUnitsQuery(unitRequest, {skip: !open || !isUnit});
  const attributeValuesRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogDictionary(
        {dictionaryKind: 'SKU_ATTRIBUTE_VALUE'},
        {
          query: {
            dataNodeRef: wireUuid(queryContext.scopeRef ?? ''),
            ...(selectedAttributeRef ? {parentEntryRef: wireUuid(selectedAttributeRef)} : {}),
            ...(attributeValuesCursor.cursor ? {cursor: attributeValuesCursor.cursor} : {}),
            pageSize: DICTIONARY_PAGE_SIZE,
          },
          headers,
        },
      ),
    [attributeValuesCursor.cursor, headers, queryContext.scopeRef, selectedAttributeRef],
  );
  const attributeValuesQuery = operationsRtk.useGetOperationsCatalogDictionaryQuery(attributeValuesRequest, {
    skip: !open || isDefinitionLibrary || kind !== 'SKU_ATTRIBUTE' || !selectedAttributeRef,
  });
  const productionRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsProductionTags(
        {},
        {
          query: {
            dataNodeRef: wireUuid(queryContext.scopeRef ?? ''),
            ...(productionCursor.cursor ? {cursor: productionCursor.cursor} : {}),
            pageSize: DICTIONARY_PAGE_SIZE,
          },
          headers,
        },
      ),
    [headers, productionCursor.cursor, queryContext.scopeRef],
  );
  const productionQuery = operationsRtk.useGetOperationsProductionTagsQuery(productionRequest, {
    skip: !open || isDefinitionLibrary || !isProduction,
  });
  const [createEntry, createEntryState] = operationsRtk.useCreateOperationsCatalogDictionaryEntryMutation();
  const [createTag, createTagState] = operationsRtk.useCreateOperationsProductionTagMutation();
  const [updateEntry, updateEntryState] = operationsRtk.useUpdateOperationsCatalogDictionaryEntryMutation();
  const [transitionEntry, transitionEntryState] =
    operationsRtk.useTransitionOperationsCatalogDictionaryEntryStatusMutation();
  const [updateTag, updateTagState] = operationsRtk.useUpdateOperationsProductionTagMutation();
  const [transitionTag, transitionTagState] = operationsRtk.useTransitionOperationsProductionTagStatusMutation();
  const [createUnit, createUnitState] = operationsRtk.useCreateOperationsCatalogUnitMutation();
  const [updateUnit, updateUnitState] = operationsRtk.useUpdateOperationsCatalogUnitMutation();
  const [disableUnit, disableUnitState] = operationsRtk.useDisableOperationsCatalogUnitMutation();
  const [deleteUnit, deleteUnitState] = operationsRtk.useDeleteOperationsCatalogUnitMutation();
  const dictionaryData = dictionaryQuery.currentData?.data;
  const attributeValuesData = attributeValuesQuery.currentData?.data;
  const productionData = productionQuery.currentData?.data;
  const unitData = unitQuery.currentData?.data;
  const refetchManifest = manifestQuery.refetch;
  const refetchDictionary = dictionaryQuery.refetch;
  const refetchAttributeValues = attributeValuesQuery.refetch;
  const refetchProduction = productionQuery.refetch;
  const refetchUnits = unitQuery.refetch;
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  const lastContentTabRefreshVersion = useRef(contentTabRefreshVersion);
  useEffect(() => {
    if (!open || contentTabRefreshVersion === lastContentTabRefreshVersion.current) return;
    lastContentTabRefreshVersion.current = contentTabRefreshVersion;
    operationsLogger.info({
      event: 'catalog.dictionary.content_refresh',
      phase: 'READ_MODEL_REFRESH',
      outcome: 'STARTED',
      operationId: 'catalog-dictionary',
      operationInstanceId: drawerOperationInstanceId.current,
    });
    void refetchManifest();
    if (!isDefinitionLibrary && !isProduction && !missingParentEntry) void refetchDictionary();
    if (!isDefinitionLibrary && kind === 'SKU_ATTRIBUTE' && selectedAttributeRef) {
      void refetchAttributeValues();
    }
    if (!isDefinitionLibrary && isProduction) void refetchProduction();
    if (!isDefinitionLibrary && isUnit) void refetchUnits();
  }, [
    contentTabRefreshVersion,
    isDefinitionLibrary,
    isProduction,
    isUnit,
    kind,
    metadataTab,
    missingParentEntry,
    open,
    refetchAttributeValues,
    refetchDictionary,
    refetchManifest,
    refetchProduction,
    refetchUnits,
    selectedAttributeRef,
  ]);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setKind(initialKind);
      setMetadataTab(initialKind === 'SKU_ATTRIBUTE_VALUE' ? 'SKU_ATTRIBUTE' : initialKind);
    }
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
  }, [editNameForm, open]);
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
  }, [attributeValueForm, formForKind, lifecycle, rebuildFrom]);

  const create = async () => {
    let values: FormValues;
    try {
      values = await activeForm.validateFields();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        operationsLogger.debug({
          event: 'catalog.dictionary.create.validation_failed',
          phase: 'VALIDATION',
          outcome: 'REJECTED',
          operationId: 'catalog-dictionary',
          operationInstanceId: drawerOperationInstanceId.current,
        });
        return;
      }
      const feedback = operationsProblemOf(error);
      operationsLogger.error({
        event: 'catalog.dictionary.create.failed',
        phase: 'VALIDATION',
        outcome: 'ERROR',
        operationId: 'catalog-dictionary',
        operationInstanceId: drawerOperationInstanceId.current,
        errorCode: feedback.errorCode,
        status: feedback.status,
      });
      setProblem(feedback.detail || '字典保存未完成，请重试。');
      return;
    }
    if (!isProduction && missingParentEntry) {
      operationsLogger.warn({
        event: 'catalog.dictionary.create.validation_failed',
        phase: 'VALIDATION',
        outcome: 'REJECTED',
        operationId: 'catalog-dictionary',
        operationInstanceId: drawerOperationInstanceId.current,
        errorCode: 'PARENT_ENTRY_REQUIRED',
      });
      setProblem('属性值必须先选择所属的 SKU 销售属性。');
      return;
    }
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    const code = values.code.trim();
    const name = values.name.trim();
    let dataNodeRef: ReturnType<typeof wireUuid>;
    try {
      dataNodeRef = requireOperationsScopeRef(queryContext);
    } catch (error) {
      const feedback = operationsProblemOf(error);
      operationsLogger.error({
        event: 'catalog.dictionary.create.failed',
        phase: 'REQUEST_PREPARE',
        outcome: 'ERROR',
        operationId: 'catalog-dictionary',
        operationInstanceId: drawerOperationInstanceId.current,
        errorCode: feedback.errorCode,
        status: feedback.status,
      });
      setProblem(feedback.detail || '字典保存未完成，请重试。');
      lifecycle.setSubmitting(false);
      return;
    }
    if (kind === 'UNIT') {
      const body = {
        dataNodeRef,
        code,
        name,
        unitDimension: values.unitDimension ?? 'COUNT',
        precision: values.precision ?? 0,
      };
      try {
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.createOperationsCatalogUnit,
          body,
        );
        const response = await createUnit(
          catalogInventoryRtkRequest.createOperationsCatalogUnit(
            {},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
        const unit = response.result?.unit;
        if (!unit || unit.code !== code || unit.name !== name || unit.status !== 'ENABLED')
          throw new Error('CATALOG_UNIT_CREATE_READBACK_INVALID');
        activeForm.resetFields();
        setCreatingKind(undefined);
        lifecycle.reset();
        if (quickManage) {
          onDictionaryCreated?.({entryRef: unit.unitRef, code: unit.code, name: unit.name});
          close();
        }
        return;
      } catch (error) {
        setProblem(operationsProblemOf(error).detail || '计量单位保存未完成，请重试。');
        lifecycle.setSubmitting(false);
        return;
      }
    }
    const requestOperationId = isProduction
      ? CATALOG_INVENTORY_OPERATION_IDS.createOperationsProductionTag
      : CATALOG_INVENTORY_OPERATION_IDS.createOperationsCatalogDictionaryEntry;
    operationsLogger.info({
      event: 'catalog.dictionary.create.request_started',
      phase: 'REQUEST',
      outcome: 'STARTED',
      operationId: requestOperationId,
      operationInstanceId: drawerOperationInstanceId.current,
      status: 'unassigned',
      requiresSession: true,
    });
    if (isProduction) {
      const tagKind = values.tagKind ?? 'PRODUCTION';
      const body = {dataNodeRef, code, tagKind, name};
      try {
        const idempotencyKey = await createContentIdempotencyKey(requestOperationId, body);
        const response = await createTag(
          catalogInventoryRtkRequest.createOperationsProductionTag(
            {},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
        const readback = response.result;
        const candidate = productionTagCandidateFromReadback(readback, {code, name, tagKind});
        operationsLogger.info({
          event: 'catalog.dictionary.create.response_received',
          phase: 'READBACK',
          outcome: candidate ? 'VALID' : 'INVALID',
          operationId: requestOperationId,
          operationInstanceId: drawerOperationInstanceId.current,
          status: '200',
        });
        if (!candidate) {
          operationsLogger.error({
            event: 'catalog.dictionary.create.readback_invalid',
            phase: 'READBACK',
            outcome: 'ERROR',
            operationId: requestOperationId,
            operationInstanceId: drawerOperationInstanceId.current,
            errorCode: 'CATALOG_DICTIONARY_CREATE_READBACK_INVALID',
            status: 200,
          });
          setProblem('标签已创建，但返回资料不完整，请刷新后重试。');
          lifecycle.setSubmitting(false);
          return;
        }
        operationsLogger.info({
          event: 'catalog.dictionary.create.ui_apply_started',
          phase: 'UI_APPLY',
          outcome: 'STARTED',
          operationId: requestOperationId,
          operationInstanceId: drawerOperationInstanceId.current,
        });
        try {
          operationsLogger.info({
            event: 'catalog.dictionary.create.callback_started',
            phase: 'UI_APPLY',
            outcome: 'STARTED',
            operationId: requestOperationId,
            operationInstanceId: drawerOperationInstanceId.current,
          });
          onCreated?.(candidate);
          operationsLogger.info({
            event: 'catalog.dictionary.create.callback_completed',
            phase: 'UI_APPLY',
            outcome: 'SUCCEEDED',
            operationId: requestOperationId,
            operationInstanceId: drawerOperationInstanceId.current,
          });
          activeForm.resetFields();
          setRebuildFrom(undefined);
          setCreatingKind(undefined);
          lifecycle.reset();
          operationsLogger.info({
            event: 'catalog.dictionary.create.candidate_applied',
            phase: 'UI_APPLY',
            outcome: 'SUCCEEDED',
            operationId: requestOperationId,
            operationInstanceId: drawerOperationInstanceId.current,
          });
          if (quickManage) {
            operationsLogger.info({
              event: 'catalog.dictionary.create.close_requested',
              phase: 'CLOSE',
              outcome: 'REQUESTED',
              operationId: requestOperationId,
              operationInstanceId: drawerOperationInstanceId.current,
            });
            close();
          }
        } catch (error) {
          const feedback = operationsProblemOf(error);
          operationsLogger.error({
            event: 'catalog.dictionary.create.failed',
            phase: 'UI_APPLY',
            outcome: 'ERROR',
            operationId: requestOperationId,
            operationInstanceId: drawerOperationInstanceId.current,
            errorCode: feedback.errorCode,
            status: feedback.status,
          });
          setProblem('标签已创建，但页面回填失败，请刷新后重试。');
          lifecycle.setSubmitting(false);
        }
      } catch (error) {
        const feedback = operationsProblemOf(error);
        operationsLogger.error({
          event: 'catalog.dictionary.create.failed',
          phase: 'REQUEST',
          outcome: 'ERROR',
          operationId: requestOperationId,
          operationInstanceId: drawerOperationInstanceId.current,
          errorCode: feedback.errorCode,
          status: feedback.status,
        });
        if (feedback.errorCode === 'DUPLICATE_CODE') {
          activeForm.setFields([{name: 'code', errors: [feedback.detail || '当前作用域中已存在相同编码。']}]);
          lifecycle.setSubmitting(false);
          return;
        }
        setProblem(feedback.detail || '字典保存未完成，请重试。');
        lifecycle.setSubmitting(false);
      }
      return;
    }

    const body = {
      dataNodeRef,
      dictionaryKind: kind,
      code,
      name,
      ...(kind === 'SKU_ATTRIBUTE_VALUE' && parentEntryRef ? {parentEntryRef: wireUuid(parentEntryRef)} : {}),
    };
    let response: CatalogDictionaryEntryReadback;
    try {
      const idempotencyKey = await createContentIdempotencyKey(requestOperationId, body);
      response = await createEntry(
        catalogInventoryRtkRequest.createOperationsCatalogDictionaryEntry(
          {dictionaryKind: kind},
          {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
        ),
      ).unwrap();
    } catch (error) {
      const feedback = operationsProblemOf(error);
      operationsLogger.error({
        event: 'catalog.dictionary.create.failed',
        phase: 'REQUEST',
        outcome: 'ERROR',
        operationId: requestOperationId,
        operationInstanceId: drawerOperationInstanceId.current,
        errorCode: feedback.errorCode,
        status: feedback.status,
      });
      if (feedback.errorCode === 'DUPLICATE_CODE') {
        activeForm.setFields([{name: 'code', errors: [feedback.detail || '当前作用域中已存在相同编码。']}]);
        lifecycle.setSubmitting(false);
        return;
      }
      setProblem(feedback.detail || '字典保存未完成，请重试。');
      lifecycle.setSubmitting(false);
      return;
    }

    const candidate = catalogDictionaryQuickManageCandidateFromReadback(response);
    operationsLogger.info({
      event: 'catalog.dictionary.create.response_received',
      phase: 'READBACK',
      outcome: candidate ? 'VALID' : 'INVALID',
      operationId: requestOperationId,
      operationInstanceId: drawerOperationInstanceId.current,
      status: '200',
    });
    if (!candidate) {
      operationsLogger.error({
        event: 'catalog.dictionary.create.readback_invalid',
        phase: 'READBACK',
        outcome: 'ERROR',
        operationId: requestOperationId,
        operationInstanceId: drawerOperationInstanceId.current,
        errorCode: 'CATALOG_DICTIONARY_CREATE_READBACK_INVALID',
        status: 200,
      });
      setProblem('字典已创建，但返回资料不完整，请刷新后重试。');
      lifecycle.setSubmitting(false);
      return;
    }
    operationsLogger.info({
      event: 'catalog.dictionary.create.ui_apply_started',
      phase: 'UI_APPLY',
      outcome: 'STARTED',
      operationId: requestOperationId,
      operationInstanceId: drawerOperationInstanceId.current,
    });
    try {
      activeForm.resetFields();
      setRebuildFrom(undefined);
      setCreatingKind(undefined);
      lifecycle.reset();
      if (!quickManage && kind === 'SKU_ATTRIBUTE') setSelectedAttributeRef(candidate.entryRef);
      if (quickManage) {
        operationsLogger.info({
          event: 'catalog.dictionary.create.callback_started',
          phase: 'UI_APPLY',
          outcome: 'STARTED',
          operationId: requestOperationId,
          operationInstanceId: drawerOperationInstanceId.current,
        });
        onDictionaryCreated?.(candidate);
        operationsLogger.info({
          event: 'catalog.dictionary.create.callback_completed',
          phase: 'UI_APPLY',
          outcome: 'SUCCEEDED',
          operationId: requestOperationId,
          operationInstanceId: drawerOperationInstanceId.current,
        });
        operationsLogger.info({
          event: 'catalog.dictionary.create.candidate_applied',
          phase: 'UI_APPLY',
          outcome: 'SUCCEEDED',
          operationId: requestOperationId,
          operationInstanceId: drawerOperationInstanceId.current,
        });
        operationsLogger.info({
          event: 'catalog.dictionary.create.close_requested',
          phase: 'CLOSE',
          outcome: 'REQUESTED',
          operationId: requestOperationId,
          operationInstanceId: drawerOperationInstanceId.current,
        });
        close();
      }
    } catch (error) {
      const feedback = operationsProblemOf(error);
      operationsLogger.error({
        event: 'catalog.dictionary.create.failed',
        phase: 'UI_APPLY',
        outcome: 'ERROR',
        operationId: requestOperationId,
        operationInstanceId: drawerOperationInstanceId.current,
        errorCode: feedback.errorCode,
        status: feedback.status,
      });
      setProblem('字典已创建，但页面回填失败，请刷新后重试。');
      lifecycle.setSubmitting(false);
    }
  };

  const createAttributeValue = async () => {
    let values: FormValues;
    try {
      values = await attributeValueForm.validateFields();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        operationsLogger.debug({
          event: 'catalog.dictionary.attribute_value_create.validation_failed',
          phase: 'VALIDATION',
          outcome: 'REJECTED',
          operationId: CATALOG_INVENTORY_OPERATION_IDS.createOperationsCatalogDictionaryEntry,
          operationInstanceId: drawerOperationInstanceId.current,
        });
        return;
      }
      const feedback = operationsProblemOf(error);
      operationsLogger.error({
        event: 'catalog.dictionary.attribute_value_create.failed',
        phase: 'VALIDATION',
        outcome: 'ERROR',
        operationId: CATALOG_INVENTORY_OPERATION_IDS.createOperationsCatalogDictionaryEntry,
        operationInstanceId: drawerOperationInstanceId.current,
        errorCode: feedback.errorCode,
        status: feedback.status,
      });
      setProblem(feedback.detail || '属性值保存未完成，请重试。');
      return;
    }
    if (!selectedAttributeRef) {
      operationsLogger.warn({
        event: 'catalog.dictionary.attribute_value_create.validation_failed',
        phase: 'VALIDATION',
        outcome: 'REJECTED',
        operationId: CATALOG_INVENTORY_OPERATION_IDS.createOperationsCatalogDictionaryEntry,
        operationInstanceId: drawerOperationInstanceId.current,
        errorCode: 'PARENT_ENTRY_REQUIRED',
      });
      setProblem('请先选择 SKU 销售属性，再新增属性值。');
      return;
    }
    lifecycle.setSubmitting(true);
    setProblem(undefined);
    const operationId = CATALOG_INVENTORY_OPERATION_IDS.createOperationsCatalogDictionaryEntry;
    let dataNodeRef: ReturnType<typeof wireUuid>;
    try {
      dataNodeRef = requireOperationsScopeRef(queryContext);
    } catch (error) {
      const feedback = operationsProblemOf(error);
      operationsLogger.error({
        event: 'catalog.dictionary.attribute_value_create.failed',
        phase: 'REQUEST_PREPARE',
        outcome: 'ERROR',
        operationId,
        operationInstanceId: drawerOperationInstanceId.current,
        errorCode: feedback.errorCode,
        status: feedback.status,
      });
      setProblem(feedback.detail || '属性值保存未完成，请重试。');
      lifecycle.setSubmitting(false);
      return;
    }
    const body = {
      dataNodeRef,
      dictionaryKind: 'SKU_ATTRIBUTE_VALUE',
      code: values.code.trim(),
      name: values.name.trim(),
      parentEntryRef: wireUuid(selectedAttributeRef),
    };
    operationsLogger.info({
      event: 'catalog.dictionary.attribute_value_create.request_started',
      phase: 'REQUEST',
      outcome: 'STARTED',
      operationId,
      operationInstanceId: drawerOperationInstanceId.current,
      status: 'unassigned',
      requiresSession: true,
    });
    let response: CatalogDictionaryEntryReadback;
    try {
      const idempotencyKey = await createContentIdempotencyKey(operationId, body);
      response = await createEntry(
        catalogInventoryRtkRequest.createOperationsCatalogDictionaryEntry(
          {dictionaryKind: 'SKU_ATTRIBUTE_VALUE'},
          {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
        ),
      ).unwrap();
    } catch (error) {
      const feedback = operationsProblemOf(error);
      operationsLogger.error({
        event: 'catalog.dictionary.attribute_value_create.failed',
        phase: 'REQUEST',
        outcome: 'ERROR',
        operationId,
        operationInstanceId: drawerOperationInstanceId.current,
        errorCode: feedback.errorCode,
        status: feedback.status,
      });
      if (feedback.errorCode === 'DUPLICATE_CODE') {
        attributeValueForm.setFields([{name: 'code', errors: [feedback.detail || '当前作用域中已存在相同编码。']}]);
        setProblem(undefined);
        lifecycle.setSubmitting(false);
        return;
      }
      setProblem(feedback.detail || '属性值保存未完成，请重试。');
      lifecycle.setSubmitting(false);
      return;
    }
    const candidate = catalogDictionaryQuickManageCandidateFromReadback(response);
    operationsLogger.info({
      event: 'catalog.dictionary.attribute_value_create.response_received',
      phase: 'READBACK',
      outcome: candidate ? 'VALID' : 'INVALID',
      operationId,
      operationInstanceId: drawerOperationInstanceId.current,
      status: '200',
    });
    if (!candidate) {
      operationsLogger.error({
        event: 'catalog.dictionary.attribute_value_create.readback_invalid',
        phase: 'READBACK',
        outcome: 'ERROR',
        operationId,
        operationInstanceId: drawerOperationInstanceId.current,
        errorCode: 'CATALOG_DICTIONARY_CREATE_READBACK_INVALID',
        status: 200,
      });
      setProblem('属性值已创建，但返回资料不完整，请刷新后重试。');
      lifecycle.setSubmitting(false);
      return;
    }
    operationsLogger.info({
      event: 'catalog.dictionary.attribute_value_create.ui_apply_started',
      phase: 'UI_APPLY',
      outcome: 'STARTED',
      operationId,
      operationInstanceId: drawerOperationInstanceId.current,
    });
    try {
      attributeValueForm.resetFields();
      setRebuildFrom(undefined);
      setCreatingKind(undefined);
      lifecycle.reset();
      operationsLogger.info({
        event: 'catalog.dictionary.attribute_value_create.candidate_applied',
        phase: 'UI_APPLY',
        outcome: 'SUCCEEDED',
        operationId,
        operationInstanceId: drawerOperationInstanceId.current,
      });
      // The command invalidates the active child dictionary query; the list is
      // refreshed by RTK without a second identity lookup or an extra GET.
    } catch (error) {
      const feedback = operationsProblemOf(error);
      operationsLogger.error({
        event: 'catalog.dictionary.attribute_value_create.failed',
        phase: 'UI_APPLY',
        outcome: 'ERROR',
        operationId,
        operationInstanceId: drawerOperationInstanceId.current,
        errorCode: feedback.errorCode,
        status: feedback.status,
      });
      setProblem('属性值已创建，但页面刷新失败，请刷新后重试。');
      lifecycle.setSubmitting(false);
    }
  };

  const openNameEdit = (row: DictionaryRow, dictionaryKind: DictionaryKind = kind) => {
    editNameForm.setFieldsValue({name: row.name});
    setProblem(undefined);
    setEditingEntry({row, dictionaryKind});
  };
  const openUnitEdit = (row: DictionaryRow) => {
    editUnitForm.setFieldsValue({
      code: row.code,
      name: row.name,
      unitDimension: row.unitDimension ?? 'COUNT',
      precision: row.precision ?? 0,
    });
    setProblem(undefined);
    setEditingUnit(row);
  };
  const saveUnit = async () => {
    if (!editingUnit) return;
    try {
      const values = await editUnitForm.validateFields();
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const body = {
        dataNodeRef,
        unitRef: wireUuid(editingUnit.entryRef),
        expectedVersion: editingUnit.version,
        code: values.code.trim(),
        name: values.name.trim(),
        unitDimension: values.unitDimension ?? 'COUNT',
        precision: values.precision ?? 0,
      };
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.updateOperationsCatalogUnit,
        body,
      );
      await updateUnit(
        catalogInventoryRtkRequest.updateOperationsCatalogUnit(
          {unitRef: wireUuid(editingUnit.entryRef)},
          {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
        ),
      ).unwrap();
      editUnitForm.resetFields();
      setEditingUnit(undefined);
      setProblem(undefined);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      const feedback = operationsProblemOf(error);
      setProblem(
        feedback.detail ||
          (feedback.errorCode === 'CATALOG_UNIT_IN_USE'
            ? '该单位已被使用；如需改变此项，请新建计量单位后在后续配置中选择'
            : '计量单位更新未完成，请重试。'),
      );
    }
  };
  const saveName = async () => {
    if (!editingEntry) return;
    const {row, dictionaryKind} = editingEntry;
    try {
      const values = await editNameForm.validateFields();
      const name = values.name.trim();
      setProblem(undefined);
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      if (dictionaryKind === 'UNIT') {
        const body = {dataNodeRef, unitRef: wireUuid(row.entryRef), expectedVersion: row.version, name};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.updateOperationsCatalogUnit,
          body,
        );
        await updateUnit(
          catalogInventoryRtkRequest.updateOperationsCatalogUnit(
            {unitRef: wireUuid(row.entryRef)},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      } else if (dictionaryKind === 'PRODUCTION_TAG') {
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
      editNameForm.resetFields();
      setEditingEntry(undefined);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setProblem(operationsProblemOf(error).detail || '字典名称更新未完成，请重试。');
    }
  };
  const openStatusChange = (row: DictionaryRow, dictionaryKind: DictionaryKind = kind) => {
    if (row.status === 'VOIDED' || (dictionaryKind === 'UNIT' && row.status !== 'ENABLED')) return;
    setProblem(undefined);
    setStatusChange({row, dictionaryKind});
  };
  const changeStatus = async () => {
    if (!statusChange) return;
    const {row, dictionaryKind} = statusChange;
    const targetStatus = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    try {
      setProblem(undefined);
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      if (dictionaryKind === 'UNIT') {
        if (row.status !== 'ENABLED') {
          setStatusChange(undefined);
          return;
        }
        const body = {dataNodeRef, unitRef: wireUuid(row.entryRef), expectedVersion: row.version};
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.disableOperationsCatalogUnit,
          body,
        );
        await disableUnit(
          catalogInventoryRtkRequest.disableOperationsCatalogUnit(
            {unitRef: wireUuid(row.entryRef)},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
      } else if (dictionaryKind === 'PRODUCTION_TAG') {
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
      setStatusChange(undefined);
    } catch (error) {
      setProblem(operationsProblemOf(error).detail || '字典状态更新未完成，请重试。');
    }
  };
  const voidAndPrepareRebuild = (row: DictionaryRow, dictionaryKind: DictionaryKind = kind) => {
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
        } catch (error) {
          setProblem(operationsProblemOf(error).detail || '作废未完成，请重试。');
          throw error;
        }
      },
    });
  };
  const deleteUnitRow = (row: DictionaryRow) => {
    modal.confirm({
      title: `删除“${row.name}”`,
      content: '只有从未被商品、SKU、库存或历史事实引用的计量单位才能删除；已引用单位不能删除。',
      okText: '删除',
      okButtonProps: {danger: true},
      cancelText: '取消',
      onOk: async () => {
        try {
          const dataNodeRef = requireOperationsScopeRef(queryContext);
          const body = {dataNodeRef, unitRef: wireUuid(row.entryRef), expectedVersion: row.version};
          const idempotencyKey = await createContentIdempotencyKey(
            CATALOG_INVENTORY_OPERATION_IDS.deleteOperationsCatalogUnit,
            body,
          );
          await deleteUnit(
            catalogInventoryRtkRequest.deleteOperationsCatalogUnit(
              {unitRef: wireUuid(row.entryRef)},
              {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
            ),
          ).unwrap();
          setProblem(undefined);
        } catch (error) {
          const feedback = operationsProblemOf(error);
          setProblem(
            feedback.detail ||
              (feedback.errorCode === 'CATALOG_UNIT_IN_USE' || feedback.errorCode === 'REFERENCE_BLOCKS_DELETE'
                ? '该计量单位正在使用，不能删除。'
                : '计量单位删除未完成，请重试。'),
          );
          throw error;
        }
      },
    });
  };
  const rows: DictionaryRow[] = isUnit
    ? (unitData?.units ?? []).map(unit => ({
        entryRef: unit.unitRef,
        code: unit.code,
        name: unit.name,
        status: unit.status,
        version: unit.version,
        unitDimension: unit.unitDimension,
        precision: unit.precision,
        isReferenced: unit.isReferenced,
      }))
    : isProduction
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
  const unitReadProblem = (() => {
    if (!isUnit || !unitQuery.error) return undefined;
    const feedback = operationsProblemOf(unitQuery.error);
    return feedback.errorCode === 'CATALOG_UNIT_LIMIT_EXCEEDED'
      ? '计量单位数量超过可维护范围，请先整理单位库'
      : feedback.detail || '计量单位读取失败，请重试。';
  })();
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
          : '新建计量单位';
  const creationKind = creatingKind ?? kind;
  const creationForm = creationKind === 'SKU_ATTRIBUTE_VALUE' ? attributeValueForm : formForKind(creationKind);
  const creationIsProduction = creationKind === 'PRODUCTION_TAG';
  const codeFieldLabel =
    creationKind === 'PRODUCTION_TAG'
      ? '商品处理标签编码'
      : creationKind === 'TAG'
        ? '商品标签编码'
        : creationKind === 'UNIT'
          ? '计量单位编码'
          : creationKind === 'SKU_ATTRIBUTE'
            ? '销售属性编码'
            : '属性值编码';
  const nameFieldLabel =
    creationKind === 'PRODUCTION_TAG'
      ? '商品处理标签名称'
      : creationKind === 'TAG'
        ? '商品标签名称'
        : creationKind === 'UNIT'
          ? '计量单位名称'
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
      maskClosable={!lifecycle.submitting}
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
      {unitReadProblem && !problem && (
        <Alert
          type="error"
          showIcon
          title="计量单位读取失败"
          description={unitReadProblem}
          action={
            <Button type="link" onClick={() => void unitQuery.refetch()}>
              重试
            </Button>
          }
          style={{marginBottom: 16}}
          {...testId('catalog-unit-read-problem')}
        />
      )}
      {!quickManage && (
        <Tabs
          activeKey={metadataTab}
          onChange={next => {
            if (next === 'ATTRIBUTES' || next === 'ORDER_OPTIONS') {
              setMetadataTab(next);
              return;
            }
            setKind(next as DictionaryKind);
            setMetadataTab(next as MetadataTab);
          }}
          items={[
            ...dictionaryTabs.map(tab => ({key: tab.key, label: tab.label})),
            {key: 'ATTRIBUTES', label: '商品属性库'},
            {key: 'ORDER_OPTIONS', label: '点单选项库'},
          ]}
          {...testId('catalog-dictionary-tabs')}
        />
      )}
      {isDefinitionLibrary && !quickManage && (
        <CatalogDefinitionLibraries
          open={open}
          kind={metadataTab}
          scopeRef={queryContext.scopeRef}
          headers={headers}
          canWrite={canWrite}
        />
      )}
      {!isDefinitionLibrary && isSkuAttributeManagement && (
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
              <CursorPagination
                state={dictionaryCursor}
                nextCursor={dictionaryData?.cursor}
                testIdPrefix="catalog-sku-attributes-pagination"
                style={{marginTop: 12}}
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
                                  onClick={() => openNameEdit(row, 'SKU_ATTRIBUTE_VALUE')}
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
                                  onClick={() => openStatusChange(row, 'SKU_ATTRIBUTE_VALUE')}
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
                                  onClick={() => voidAndPrepareRebuild(row, 'SKU_ATTRIBUTE_VALUE')}
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
                  <CursorPagination
                    state={attributeValuesCursor}
                    nextCursor={attributeValuesData?.cursor}
                    testIdPrefix="catalog-sku-attribute-values-pagination"
                    style={{marginTop: 12}}
                  />
                </Flex>
              )}
            </div>
          </Splitter.Panel>
        </Splitter>
      )}
      {!quickManage && !isDefinitionLibrary && !isSkuAttributeManagement && (
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
              isUnit
                ? unitQuery.isLoading || unitQuery.isFetching
                : isProduction
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
              ...(isUnit
                ? [
                    {
                      title: '维度',
                      dataIndex: 'unitDimension',
                      render: (value: DictionaryRow['unitDimension']) => unitDimensionLabel(value),
                    },
                    {
                      title: '精度',
                      dataIndex: 'precision',
                      render: (value: number | undefined) => value ?? '—',
                    },
                    {
                      title: '正在使用',
                      dataIndex: 'isReferenced',
                      render: (value: boolean | undefined) =>
                        value ? <Tag color="blue">是</Tag> : <Typography.Text type="secondary">否</Typography.Text>,
                    },
                  ]
                : []),
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
                render: (_: unknown, row: DictionaryRow) =>
                  isUnit ? (
                    <Space>
                      {withMutationReason(
                        <Button
                          type="link"
                          disabled={!canWrite}
                          onClick={() => (row.isReferenced ? openNameEdit(row) : openUnitEdit(row))}
                          {...testId(`catalog-unit-edit-${row.code}`)}
                        >
                          {row.isReferenced ? '编辑名称' : '编辑单位'}
                        </Button>,
                        !canWrite,
                        readOnlyReason,
                      )}
                      {row.status === 'ENABLED' &&
                        withMutationReason(
                          <Button type="link" danger disabled={!canWrite} onClick={() => openStatusChange(row)}>
                            停用
                          </Button>,
                          !canWrite,
                          readOnlyReason,
                        )}
                      {withMutationReason(
                        <Button
                          type="link"
                          danger
                          disabled={!canWrite || deleteUnitState.isLoading}
                          onClick={() => deleteUnitRow(row)}
                          {...testId(`catalog-unit-delete-${row.code}`)}
                        >
                          删除
                        </Button>,
                        !canWrite || deleteUnitState.isLoading,
                        canWrite ? '该计量单位正在使用，不能删除。' : readOnlyReason,
                      )}
                    </Space>
                  ) : (
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
          {!isUnit && (
            <CursorPagination
              state={isProduction ? productionCursor : dictionaryCursor}
              nextCursor={isProduction ? productionData?.cursor : dictionaryData?.cursor}
              testIdPrefix={isProduction ? 'catalog-production-tags-pagination' : 'catalog-dictionary-pagination'}
              style={{marginTop: 12}}
            />
          )}
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
          {creationKind === 'UNIT' && (
            <>
              <Form.Item
                label="单位维度"
                name="unitDimension"
                initialValue="COUNT"
                rules={[{required: true, message: '请选择单位维度'}]}
              >
                <Select options={unitDimensionOptions} {...testId('catalog-unit-dimension')} />
              </Form.Item>
              <Form.Item
                label="精度"
                name="precision"
                initialValue={0}
                extra="0 表示整数；精度为 0 时只能填写整数；录入超出精度时向零截断。"
                rules={[{required: true, message: '请输入精度'}]}
              >
                <InputNumber min={0} precision={0} style={{width: '100%'}} {...testId('catalog-unit-precision')} />
              </Form.Item>
            </>
          )}
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
            loading={
              createEntryState.isLoading ||
              createTagState.isLoading ||
              createUnitState.isLoading ||
              lifecycle.submitting
            }
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
          maskClosable={!lifecycle.submitting}
          width={560}
          confirmLoading={
            createEntryState.isLoading || createTagState.isLoading || createUnitState.isLoading || lifecycle.submitting
          }
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
            {creationKind === 'UNIT' && (
              <>
                <Form.Item
                  label="单位维度"
                  name="unitDimension"
                  initialValue="COUNT"
                  rules={[{required: true, message: '请选择单位维度'}]}
                >
                  <Select options={unitDimensionOptions} {...testId('catalog-unit-dimension')} />
                </Form.Item>
                <Form.Item
                  label="精度"
                  name="precision"
                  initialValue={0}
                  extra="0 表示整数；精度为 0 时只能填写整数；录入超出精度时向零截断。"
                  rules={[{required: true, message: '请输入精度'}]}
                >
                  <InputNumber min={0} precision={0} style={{width: '100%'}} {...testId('catalog-unit-precision')} />
                </Form.Item>
              </>
            )}
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
          maskClosable={!updateEntryState.isLoading && !updateTagState.isLoading && !updateUnitState.isLoading}
          okText="保存"
          cancelText="取消"
          confirmLoading={updateEntryState.isLoading || updateTagState.isLoading || updateUnitState.isLoading}
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
      {canWrite && editingUnit && (
        <Modal
          title="编辑计量单位"
          open
          width={560}
          maskClosable={!updateUnitState.isLoading}
          okText="保存"
          cancelText="取消"
          confirmLoading={updateUnitState.isLoading}
          onOk={() => void saveUnit()}
          onCancel={() => {
            editUnitForm.resetFields();
            setProblem(undefined);
            setEditingUnit(undefined);
          }}
          {...testId('catalog-unit-edit-modal')}
        >
          {problem && (
            <Alert type="error" showIcon title="保存未完成" description={problem} style={{marginBottom: 16}} />
          )}
          <Typography.Paragraph type="secondary">
            当前单位尚未被商品、SKU 或点单选项引用，编码、名称、类别和精度均可调整；提交时仍由 owner 再次校验引用状态。
          </Typography.Paragraph>
          <Form form={editUnitForm} layout="vertical">
            <Form.Item label="计量单位名称" name="name" rules={[{required: true, message: '请输入名称'}]}>
              <Input autoFocus {...testId(`catalog-unit-edit-name-${editingUnit.code}`)} />
            </Form.Item>
            <Form.Item label="计量单位编码" name="code" rules={[{required: true, message: '请输入编码'}]}>
              <Input {...testId(`catalog-unit-edit-code-${editingUnit.code}`)} />
            </Form.Item>
            <Form.Item label="单位维度" name="unitDimension" rules={[{required: true, message: '请选择单位维度'}]}>
              <Select options={unitDimensionOptions} {...testId(`catalog-unit-edit-dimension-${editingUnit.code}`)} />
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
                {...testId(`catalog-unit-edit-precision-${editingUnit.code}`)}
              />
            </Form.Item>
          </Form>
        </Modal>
      )}
      {canWrite && statusChange && (
        <Modal
          title={`${statusChange.dictionaryKind === 'UNIT' || statusChange.row.status === 'ENABLED' ? '停用' : '启用'}“${statusChange.row.name}”`}
          open
          okText={`确认${statusChange.dictionaryKind === 'UNIT' || statusChange.row.status === 'ENABLED' ? '停用' : '启用'}`}
          okButtonProps={{danger: statusChange.dictionaryKind === 'UNIT' || statusChange.row.status === 'ENABLED'}}
          maskClosable={!transitionEntryState.isLoading && !transitionTagState.isLoading && !disableUnitState.isLoading}
          cancelText="取消"
          confirmLoading={transitionEntryState.isLoading || transitionTagState.isLoading || disableUnitState.isLoading}
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
            {statusChange.dictionaryKind === 'UNIT'
              ? '停用后，新建商品、SKU 与库存配置不会再提供该单位；已经保存的配置和历史快照不受影响。'
              : statusChange.row.status === 'ENABLED'
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
    <Tag color={value === 'ENABLED' ? 'green' : value === 'VOIDED' ? 'red' : 'orange'}>
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
