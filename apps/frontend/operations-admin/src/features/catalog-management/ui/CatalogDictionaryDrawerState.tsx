import {Alert, App, Button, Form, Tag, Tooltip, Typography} from 'antd';
import {
  createContentIdempotencyKey,
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
import {catalogEnumLabel} from '../model/catalogManifestLabels';
import {catalogUiProblemFeedback} from '../model/catalogUiProblemFeedback';
import {productionTagReadbackIsComplete} from '../model/catalogModel';
import type {CatalogLibraryKind} from '../model/catalogWorkspaceTask';
import {useCatalogConfigLibrary} from '../model/useCatalogConfigLibrary';
import {catalogTestIdControls, catalogTestIds} from '../catalogTestIds';
import {CatalogDefinitionLibraries} from './CatalogDefinitionLibraries';
import {type CatalogConfigurationLibrary} from './CatalogConfigurationLibraryNavigation';
import {CatalogConfigurationDrawerSurface} from './CatalogConfigurationDrawerSurface';
import {CatalogDictionaryAtomModals} from './CatalogDictionaryAtomModals';
import {CatalogSimpleDictionaryLibrary} from './CatalogSimpleDictionaryLibrary';
import {CatalogSkuAttributeLibrary} from './CatalogSkuAttributeLibrary';

export type CatalogDictionaryDrawerProps = {
  open: boolean;
  initialKind?: CatalogLibraryKind;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  canWrite: boolean;
  parentEntryRef?: string;
  presentation?: 'WORKBENCH' | 'EDITOR_CHILD';
  onClose: (kind?: DictionaryKind) => void;
  onAfterClose?: () => void;
};
export type DictionaryKind = 'TAG' | 'UNIT' | 'SKU_ATTRIBUTE' | 'SKU_ATTRIBUTE_VALUE' | 'PRODUCTION_TAG';
type ConfigLibraryTab = CatalogConfigurationLibrary;
type FormValues = {
  code: string;
  name: string;
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
  status: string;
  version: number;
  unitDimension?: FormValues['unitDimension'];
  precision?: number;
  isReferenced?: boolean;
  linkedProductCount?: number;
  voidAvailability?: VoidAvailability;
};
type NameEditRequest = {row: DictionaryRow; dictionaryKind: DictionaryKind};
type UnitEditValues = Pick<FormValues, 'code' | 'name' | 'unitDimension' | 'precision'>;
type StatusChangeRequest = {row: DictionaryRow; dictionaryKind: DictionaryKind};

function voidReason(value?: VoidAvailability) {
  if (!value || value.canVoid) return undefined;
  if (value.blockingReferences.some(entry => entry.referenceKind === 'CATALOG_ITEM')) {
    return '仍被商品或规格使用';
  }
  if (value.blockingReferences.length > 0) return '仍被其他业务记录使用';
  if (value.dependentFacts.length > 0) return '仍存在关联业务数据';
  return '当前条目暂不能删除';
}

function deleteActionLabel(_value?: VoidAvailability) {
  // Availability changes the control state and its business reason, never the
  // action's meaning. A different disabled label made the same lifecycle
  // action look like a second operation in the configuration libraries.
  return '删除';
}

const dictionaryKindLabels: Record<DictionaryKind, string> = {
  TAG: '商品标签',
  UNIT: '计量单位',
  SKU_ATTRIBUTE: '规格维度',
  SKU_ATTRIBUTE_VALUE: '属性值',
  PRODUCTION_TAG: '生产标签',
};

const dictionaryDescriptions: Record<Exclude<DictionaryKind, 'SKU_ATTRIBUTE_VALUE'>, string> = {
  TAG: '为商品补充业务特征，方便筛选和运营管理。',
  UNIT: '维护有限的计量单位定义；精度属于单位本身，停用只影响后续候选。',
  SKU_ATTRIBUTE: '定义商品可售规格的维度及其可选值，例如杯型与中杯。',
  PRODUCTION_TAG: '维护商品的生产标签，供后厨识别。',
};

const DICTIONARY_PAGE_SIZE = 50;

const unitDimensionOptions: Array<{value: NonNullable<FormValues['unitDimension']>; label: string}> = [
  {value: 'COUNT', label: '计数'},
  {value: 'WEIGHT', label: '重量'},
  {value: 'VOLUME', label: '体积'},
  {value: 'SERVICE_DURATION', label: '服务时长'},
  {value: 'PACKAGE', label: '包装'},
];

function unitDimensionLabel(value?: FormValues['unitDimension']) {
  return unitDimensionOptions.find(option => option.value === value)?.label ?? value ?? '—';
}

export function catalogUnitVoidControlState({
  canWrite,
  isReferenced,
  isTransitioning,
}: {
  canWrite: boolean;
  isReferenced: boolean | undefined;
  isTransitioning: boolean;
}): {disabled: boolean; reason?: string} {
  if (!canWrite) return {disabled: true, reason: '当前账号只有查看商品库的权限，不能修改字典。'};
  if (isReferenced) return {disabled: true, reason: '该计量单位正在使用，不能删除；可以停用。'};
  if (isTransitioning) return {disabled: true, reason: '正在更新状态，请稍候。'};
  return {disabled: false};
}

export function catalogUnitStatusQuery(status?: string): {status?: 'ENABLED' | 'DISABLED' | 'VOIDED'} {
  if (status === 'ENABLED' || status === 'DISABLED' || status === 'VOIDED') return {status};
  return {};
}

export function catalogConfigurationChangeNeedsConfirmation({
  configurationLifecycleDirty,
  definitionDirtyMessage,
}: {
  configurationLifecycleDirty: boolean;
  definitionDirtyMessage?: string;
}) {
  return configurationLifecycleDirty || Boolean(definitionDirtyMessage);
}

/**
 * Owns shared configuration-library commands, query state and drawer
 * lifecycle. The workbench owns the first-level placement; an editor owns its
 * one second-level configuration child placement. This adapter holds neither task
 * state nor an item draft, so it cannot create a parallel business owner.
 */
export function CatalogDictionaryDrawerState({
  open,
  initialKind = 'TAG',
  queryContext,
  brandRef,
  canWrite,
  parentEntryRef,
  presentation,
  onClose,
  onAfterClose,
}: CatalogDictionaryDrawerProps) {
  const {modal} = App.useApp();
  const initialConfigLibrary: ConfigLibraryTab = initialKind === 'SKU_ATTRIBUTE_VALUE' ? 'SKU_ATTRIBUTE' : initialKind;
  const configLibrary = useCatalogConfigLibrary({
    initialLibrary: initialConfigLibrary,
    contextKey: `${open}|${queryContext.scopeRef ?? ''}|${brandRef ?? ''}|${parentEntryRef ?? ''}`,
  });
  const {
    selectLibrary,
    setSelectedEntryRef,
    resetLibraryContext,
    setSimpleLibraryKeywordInput,
    applySimpleLibraryKeyword,
    clearSimpleLibraryKeyword,
    setSimpleLibraryStatus,
  } = configLibrary;
  const currentLibrary = configLibrary.currentLibrary as ConfigLibraryTab;
  const isDefinitionLibrary = currentLibrary === 'ATTRIBUTES' || currentLibrary === 'ORDER_OPTIONS';
  const kind = (isDefinitionLibrary ? 'TAG' : currentLibrary) as DictionaryKind;
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
  const [creatingKind, setCreatingKind] = useState<DictionaryKind>();
  const selectedAttributeRef = configLibrary.selectedEntryRef;
  const [definitionDirtyMessage, setDefinitionDirtyMessage] = useState<string>();
  const drawerOperationInstanceId = useRef<string | undefined>(undefined);
  const definitionCloseConfirmOpen = useRef(false);
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const isProduction = kind === 'PRODUCTION_TAG';
  const isUnit = kind === 'UNIT';
  const simpleLibraryFilter = {
    ...configLibrary.simpleLibraryFilter,
    setKeywordInput: setSimpleLibraryKeywordInput,
    applyKeyword: applySimpleLibraryKeyword,
    clearKeyword: clearSimpleLibraryKeyword,
    setStatus: setSimpleLibraryStatus,
  };
  const dictionaryCursor = useCursorStack({
    resetKey: `${open}|${kind}|${queryContext.scopeRef ?? ''}|${brandRef ?? ''}|${parentEntryRef ?? ''}|${simpleLibraryFilter.appliedKeyword}|${simpleLibraryFilter.status ?? ''}`,
  });
  const attributeValuesCursor = useCursorStack({
    resetKey: `${open}|${selectedAttributeRef ?? ''}|${queryContext.scopeRef ?? ''}|${brandRef ?? ''}`,
  });
  const productionCursor = useCursorStack({
    resetKey: `${open}|production-tags|${queryContext.scopeRef ?? ''}|${brandRef ?? ''}|${simpleLibraryFilter.appliedKeyword}|${simpleLibraryFilter.status ?? ''}`,
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
      confirm: testId(catalogTestIds.static.dictionaryDirtyDiscard),
      cancel: testId(catalogTestIds.static.dictionaryDirtyContinue),
    },
    diagnosticOperationId: 'catalog-dictionary',
    onDiagnosticEvent: onLifecycleDiagnostic,
  });
  const requestConfigClose = () => {
    if (!definitionDirtyMessage || lifecycle.dirty) {
      lifecycle.requestClose();
      return;
    }
    if (definitionCloseConfirmOpen.current) return;
    definitionCloseConfirmOpen.current = true;
    modal.confirm({
      title: '放弃当前填写内容？',
      content: definitionDirtyMessage,
      okText: '放弃并关闭',
      cancelText: '继续编辑',
      onOk: () => {
        definitionCloseConfirmOpen.current = false;
        setDefinitionDirtyMessage(undefined);
        close();
      },
      onCancel: () => {
        definitionCloseConfirmOpen.current = false;
      },
    });
  };
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
  const missingParentEntry = kind === 'SKU_ATTRIBUTE_VALUE' && !parentEntryRef;
  const dictionaryRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogDictionary(
        {dictionaryKind: kind === 'PRODUCTION_TAG' || kind === 'UNIT' ? 'TAG' : kind},
        {
          query: {
            dataNodeRef: wireUuid(queryContext.scopeRef ?? ''),
            ...(kind === 'SKU_ATTRIBUTE_VALUE' && parentEntryRef ? {parentEntryRef: wireUuid(parentEntryRef)} : {}),
            ...(kind === 'TAG' && simpleLibraryFilter.appliedKeyword
              ? {query: simpleLibraryFilter.appliedKeyword}
              : {}),
            ...(kind === 'TAG' && simpleLibraryFilter.status ? {status: simpleLibraryFilter.status} : {}),
            ...(dictionaryCursor.cursor ? {cursor: dictionaryCursor.cursor} : {}),
            pageSize: DICTIONARY_PAGE_SIZE,
          },
          headers,
        },
      ),
    [
      dictionaryCursor.cursor,
      headers,
      kind,
      parentEntryRef,
      queryContext.scopeRef,
      simpleLibraryFilter.appliedKeyword,
      simpleLibraryFilter.status,
    ],
  );
  const dictionaryQuery = operationsRtk.useGetOperationsCatalogDictionaryQuery(dictionaryRequest, {
    skip: !open || isDefinitionLibrary || isProduction || isUnit || missingParentEntry,
  });
  const unitRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.listOperationsCatalogUnits(
        {},
        {
          query: {
            dataNodeRef: wireUuid(queryContext.scopeRef ?? ''),
            includeInactive: true,
            ...(simpleLibraryFilter.appliedKeyword ? {query: simpleLibraryFilter.appliedKeyword} : {}),
            ...catalogUnitStatusQuery(simpleLibraryFilter.status),
          },
          headers,
        },
      ),
    [headers, queryContext.scopeRef, simpleLibraryFilter.appliedKeyword, simpleLibraryFilter.status],
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
            ...(simpleLibraryFilter.appliedKeyword ? {query: simpleLibraryFilter.appliedKeyword} : {}),
            ...(simpleLibraryFilter.status ? {status: simpleLibraryFilter.status} : {}),
            ...(productionCursor.cursor ? {cursor: productionCursor.cursor} : {}),
            pageSize: DICTIONARY_PAGE_SIZE,
          },
          headers,
        },
      ),
    [
      headers,
      productionCursor.cursor,
      queryContext.scopeRef,
      simpleLibraryFilter.appliedKeyword,
      simpleLibraryFilter.status,
    ],
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
  const [transitionUnit, transitionUnitState] = operationsRtk.useTransitionOperationsCatalogUnitStatusMutation();
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
      selectLibrary(initialConfigLibrary);
    }
    wasOpen.current = open;
  }, [initialConfigLibrary, open, selectLibrary]);
  useEffect(() => {
    if (!open) {
      setEditingEntry(undefined);
      setStatusChange(undefined);
      editNameForm.resetFields();
      setCreatingKind(undefined);
      setProblem(undefined);
      resetLibraryContext();
    }
  }, [editNameForm, open, resetLibraryContext]);
  useEffect(() => {
    if (!open) return;
    if (kind !== 'SKU_ATTRIBUTE') {
      setSelectedEntryRef(undefined);
      return;
    }
    const entries = dictionaryData?.entries ?? [];
    const requestedParent =
      parentEntryRef && entries.some(entry => entry.entryRef === parentEntryRef) ? parentEntryRef : undefined;
    setSelectedEntryRef(
      requestedParent ??
        (selectedAttributeRef && entries.some(entry => entry.entryRef === selectedAttributeRef)
          ? selectedAttributeRef
          : entries[0]?.entryRef),
    );
  }, [dictionaryData?.entries, kind, open, parentEntryRef, selectedAttributeRef, setSelectedEntryRef]);
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
      setProblem(catalogUiProblemFeedback(error, '字典保存未完成，请重试。').message);
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
      setProblem('属性值必须先选择所属的规格维度。');
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
      setProblem(catalogUiProblemFeedback(error, '字典保存未完成，请重试。').message);
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
        return;
      } catch (error) {
        setProblem(catalogUiProblemFeedback(error, '计量单位保存未完成，请重试。').message);
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
      const body = {dataNodeRef, code, name};
      try {
        const idempotencyKey = await createContentIdempotencyKey(requestOperationId, body);
        const response = await createTag(
          catalogInventoryRtkRequest.createOperationsProductionTag(
            {},
            {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
        const readback = response.result;
        const readbackIsComplete = productionTagReadbackIsComplete(readback);
        operationsLogger.info({
          event: 'catalog.dictionary.create.response_received',
          phase: 'READBACK',
          outcome: readbackIsComplete ? 'VALID' : 'INVALID',
          operationId: requestOperationId,
          operationInstanceId: drawerOperationInstanceId.current,
          status: '200',
        });
        if (!readbackIsComplete) {
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
          activeForm.resetFields();
          setCreatingKind(undefined);
          lifecycle.reset();
          operationsLogger.info({
            event: 'catalog.dictionary.create.candidate_applied',
            phase: 'UI_APPLY',
            outcome: 'SUCCEEDED',
            operationId: requestOperationId,
            operationInstanceId: drawerOperationInstanceId.current,
          });
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
          activeForm.setFields([{name: 'code', errors: ['当前作用域中已存在相同编码。']}]);
          lifecycle.setSubmitting(false);
          return;
        }
        setProblem(catalogUiProblemFeedback(error, '字典保存未完成，请重试。').message);
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
        activeForm.setFields([{name: 'code', errors: ['当前作用域中已存在相同编码。']}]);
        lifecycle.setSubmitting(false);
        return;
      }
      setProblem(catalogUiProblemFeedback(error, '字典保存未完成，请重试。').message);
      lifecycle.setSubmitting(false);
      return;
    }

    const readback = response.result;
    const readbackIsComplete = Boolean(readback?.entryRef && readback.code && readback.name);
    operationsLogger.info({
      event: 'catalog.dictionary.create.response_received',
      phase: 'READBACK',
      outcome: readbackIsComplete ? 'VALID' : 'INVALID',
      operationId: requestOperationId,
      operationInstanceId: drawerOperationInstanceId.current,
      status: '200',
    });
    if (!readback?.entryRef || !readback.code || !readback.name) {
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
      setCreatingKind(undefined);
      lifecycle.reset();
      if (kind === 'SKU_ATTRIBUTE') setSelectedEntryRef(readback.entryRef);
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
      setProblem(catalogUiProblemFeedback(error, '属性值保存未完成，请重试。').message);
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
      setProblem('请先选择规格维度，再新增属性值。');
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
      setProblem(catalogUiProblemFeedback(error, '属性值保存未完成，请重试。').message);
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
        attributeValueForm.setFields([{name: 'code', errors: ['当前作用域中已存在相同编码。']}]);
        setProblem(undefined);
        lifecycle.setSubmitting(false);
        return;
      }
      setProblem(catalogUiProblemFeedback(error, '属性值保存未完成，请重试。').message);
      lifecycle.setSubmitting(false);
      return;
    }
    const readback = response.result;
    const readbackIsComplete = Boolean(readback?.entryRef && readback.code && readback.name);
    operationsLogger.info({
      event: 'catalog.dictionary.attribute_value_create.response_received',
      phase: 'READBACK',
      outcome: readbackIsComplete ? 'VALID' : 'INVALID',
      operationId,
      operationInstanceId: drawerOperationInstanceId.current,
      status: '200',
    });
    if (!readbackIsComplete) {
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
        feedback.errorCode === 'CATALOG_UNIT_IN_USE'
          ? '该单位已被使用；如需改变此项，请新建计量单位后在后续配置中选择'
          : catalogUiProblemFeedback(error, '计量单位更新未完成，请重试。').message,
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
      setProblem(catalogUiProblemFeedback(error, '字典名称更新未完成，请重试。').message);
    }
  };
  const openStatusChange = (row: DictionaryRow, dictionaryKind: DictionaryKind = kind) => {
    if (row.status === 'VOIDED') return;
    setProblem(undefined);
    setStatusChange({row, dictionaryKind});
  };
  const changeStatus = async () => {
    if (!statusChange) return;
    const {row, dictionaryKind} = statusChange;
    const targetStatus: 'ENABLED' | 'DISABLED' = row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
    try {
      setProblem(undefined);
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      if (dictionaryKind === 'UNIT') {
        const body = {
          dataNodeRef,
          unitRef: wireUuid(row.entryRef),
          expectedVersion: row.version,
          targetStatus,
        };
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.transitionOperationsCatalogUnitStatus,
          body,
        );
        await transitionUnit(
          catalogInventoryRtkRequest.transitionOperationsCatalogUnitStatus(
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
      setProblem(catalogUiProblemFeedback(error, '字典状态更新未完成，请重试。').message);
    }
  };
  const deleteDictionaryEntry = (row: DictionaryRow, dictionaryKind: DictionaryKind = kind) => {
    const canVoid = dictionaryKind === 'UNIT' ? !row.isReferenced : row.voidAvailability?.canVoid;
    if (!canVoid) return;
    modal.confirm({
      title: `删除“${row.name}”`,
      content: '删除后会保留历史记录，不会自动创建新记录；如需新增，请在列表中手动新建。',
      okText: '确认删除',
      cancelText: '取消',
      onOk: async () => {
        try {
          setProblem(undefined);
          const dataNodeRef = requireOperationsScopeRef(queryContext);
          if (dictionaryKind === 'UNIT') {
            const body = {
              dataNodeRef,
              unitRef: wireUuid(row.entryRef),
              expectedVersion: row.version,
              targetStatus: 'VOIDED' as const,
            };
            const idempotencyKey = await createContentIdempotencyKey(
              CATALOG_INVENTORY_OPERATION_IDS.transitionOperationsCatalogUnitStatus,
              body,
            );
            await transitionUnit(
              catalogInventoryRtkRequest.transitionOperationsCatalogUnitStatus(
                {unitRef: wireUuid(row.entryRef)},
                {headers: {...headers, 'Idempotency-Key': idempotencyKey}, body},
              ),
            ).unwrap();
          } else if (dictionaryKind === 'PRODUCTION_TAG') {
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
        } catch (error) {
          setProblem(catalogUiProblemFeedback(error, '删除未完成，请重试。').message);
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
      : catalogUiProblemFeedback(unitQuery.error, '计量单位读取失败，请重试。').message;
  })();
  const isSkuAttributeManagement = kind === 'SKU_ATTRIBUTE';
  const readOnlyReason = canWrite ? undefined : '当前账号只有查看商品库的权限，不能修改字典。';
  const activeEntityKind = kind === 'SKU_ATTRIBUTE_VALUE' ? 'SKU_ATTRIBUTE' : kind;
  const activeEntityLabel = dictionaryKindLabels[activeEntityKind];
  const activeEntityDescription = dictionaryDescriptions[activeEntityKind];
  const createLabel =
    activeEntityKind === 'PRODUCTION_TAG'
      ? '新建生产标签'
      : activeEntityKind === 'SKU_ATTRIBUTE'
        ? '新建规格维度'
        : activeEntityKind === 'TAG'
          ? '新建商品标签'
          : '新建计量单位';
  const creationKind = creatingKind ?? kind;
  const creationForm = creationKind === 'SKU_ATTRIBUTE_VALUE' ? attributeValueForm : formForKind(creationKind);
  const codeFieldLabel =
    creationKind === 'PRODUCTION_TAG'
      ? '生产标签编码'
      : creationKind === 'TAG'
        ? '商品标签编码'
        : creationKind === 'UNIT'
          ? '计量单位编码'
          : creationKind === 'SKU_ATTRIBUTE'
            ? '规格维度编码'
            : '属性值编码';
  const nameFieldLabel =
    creationKind === 'PRODUCTION_TAG'
      ? '生产标签名称'
      : creationKind === 'TAG'
        ? '商品标签名称'
        : creationKind === 'UNIT'
          ? '计量单位名称'
          : creationKind === 'SKU_ATTRIBUTE'
            ? '规格维度名称'
            : '属性值名称';
  const creationTitle =
    creationKind === 'SKU_ATTRIBUTE_VALUE'
      ? `新增“${selectedAttribute?.name ?? '规格维度'}”的可选值`
      : creationKind === 'SKU_ATTRIBUTE'
        ? '新建规格维度'
        : `新建${dictionaryKindLabels[creationKind]}`;
  const creationFormTestId =
    creationKind === 'SKU_ATTRIBUTE'
      ? testId(catalogTestIds.static.skuAttributeCreateForm)
      : creationKind === 'SKU_ATTRIBUTE_VALUE'
        ? testId(catalogTestIds.static.skuAttributeValueCreateForm)
        : undefined;
  const submitCreation = () => {
    if (creatingKind === 'SKU_ATTRIBUTE_VALUE') void createAttributeValue();
    else void create();
  };
  const openCreate = (nextKind: DictionaryKind) => {
    const targetForm = nextKind === 'SKU_ATTRIBUTE_VALUE' ? attributeValueForm : formForKind(nextKind);
    targetForm.resetFields();
    setProblem(undefined);
    setCreatingKind(nextKind);
  };
  const dismissCreate = (nextKind: DictionaryKind) => {
    const targetForm = nextKind === 'SKU_ATTRIBUTE_VALUE' ? attributeValueForm : formForKind(nextKind);
    targetForm.resetFields();
    setCreatingKind(undefined);
    lifecycle.reset();
  };
  const changeLibrary = (nextLibrary: ConfigLibraryTab) => {
    if (nextLibrary === currentLibrary) return;
    const applyChange = () => {
      lifecycle.reset();
      // The current specification dimension is meaningful only inside its
      // parent/child library. Clear it synchronously with the library change;
      // the data-refresh effect below remains a defensive reconciliation, not
      // the owner of this cascade.
      configLibrary.selectLibrary(nextLibrary);
    };
    const configurationDirty = catalogConfigurationChangeNeedsConfirmation({
      configurationLifecycleDirty: lifecycle.dirty,
      definitionDirtyMessage,
    });
    if (!configurationDirty) {
      applyChange();
      return;
    }
    modal.confirm({
      title: '放弃当前填写内容？',
      content: '切换配置分类后，当前未保存的内容不会保留。',
      okText: '放弃并切换',
      cancelText: '继续编辑',
      onOk: applyChange,
    });
  };
  return (
    <CatalogConfigurationDrawerSurface
      open={open}
      lifecycle={lifecycle}
      currentLibrary={currentLibrary}
      onSelectLibrary={changeLibrary}
      onRequestClose={requestConfigClose}
      onAfterClose={onAfterClose}
      presentation={presentation}
    >
      {problem && !creatingKind && !editingEntry && !statusChange && (
        <Alert
          type="error"
          showIcon
          title="字典操作未完成"
          description={problem}
          style={{marginBottom: 16}}
          {...testId(catalogTestIds.static.dictionaryProblem)}
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
          {...testId(catalogTestIds.static.unitReadProblem)}
        />
      )}
      {isDefinitionLibrary && (
        <CatalogDefinitionLibraries
          open={open}
          kind={currentLibrary === 'ATTRIBUTES' ? 'ATTRIBUTES' : 'ORDER_OPTIONS'}
          scopeRef={queryContext.scopeRef}
          headers={headers}
          canWrite={canWrite}
          definitionEditor={configLibrary.definitionEditor}
          onOpenDefinitionEditor={configLibrary.openDefinitionEditor}
          onCloseDefinitionEditor={configLibrary.closeDefinitionEditor}
          onEditorDirtyChange={setDefinitionDirtyMessage}
        />
      )}
      {!isDefinitionLibrary && isSkuAttributeManagement && (
        <CatalogSkuAttributeLibrary
          attributes={rows}
          selectedAttributeRef={selectedAttributeRef}
          selectedAttribute={selectedAttribute}
          attributeValues={attributeValueRows}
          canWrite={canWrite}
          attributesLoading={dictionaryQuery.isLoading || dictionaryQuery.isFetching}
          attributeValuesLoading={attributeValuesQuery.isLoading || attributeValuesQuery.isFetching}
          onSelectAttribute={setSelectedEntryRef}
          onCreateAttribute={() => openCreate('SKU_ATTRIBUTE')}
          onCreateValue={() => openCreate('SKU_ATTRIBUTE_VALUE')}
          renderStatus={value => <StatusTag manifest={manifest} value={value} />}
          renderVoidReason={attribute => {
            const reason = voidReason((attribute as DictionaryRow).voidAvailability);
            return reason ? <Typography.Text type="secondary">暂不能删除：{reason}</Typography.Text> : undefined;
          }}
          renderAttributeActions={attribute => {
            const row = attribute as DictionaryRow;
            const disabled = !canWrite || !row.voidAvailability?.canVoid;
            return (
              <>
                {row.status !== 'VOIDED' &&
                  withMutationReason(
                    <Button
                      type="link"
                      disabled={!canWrite}
                      onClick={() => openNameEdit(row)}
                      {...testId(catalogTestIdControls.config.action('SKU_ATTRIBUTE', row.code, 'edit'))}
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
                      onClick={() => openStatusChange(row)}
                      {...testId(catalogTestIdControls.config.action('SKU_ATTRIBUTE', row.code, 'change-status'))}
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
                      disabled={disabled}
                      onClick={() => deleteDictionaryEntry(row)}
                      {...testId(catalogTestIdControls.config.action('SKU_ATTRIBUTE', row.code, 'delete'))}
                    >
                      {deleteActionLabel(row.voidAvailability)}
                    </Button>,
                    disabled,
                    canWrite ? voidReason(row.voidAvailability) : readOnlyReason,
                  )}
              </>
            );
          }}
          renderValueActions={value => {
            const row = value as DictionaryRow;
            const disabled = !canWrite || !row.voidAvailability?.canVoid;
            return (
              <>
                {row.status !== 'VOIDED' &&
                  withMutationReason(
                    <Button
                      type="link"
                      disabled={!canWrite}
                      onClick={() => openNameEdit(row, 'SKU_ATTRIBUTE_VALUE')}
                      {...testId(catalogTestIdControls.config.action('SKU_ATTRIBUTE_VALUE', row.code, 'edit'))}
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
                      {...testId(catalogTestIdControls.config.action('SKU_ATTRIBUTE_VALUE', row.code, 'change-status'))}
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
                      disabled={disabled}
                      onClick={() => deleteDictionaryEntry(row, 'SKU_ATTRIBUTE_VALUE')}
                      {...testId(catalogTestIdControls.config.action('SKU_ATTRIBUTE_VALUE', row.code, 'delete'))}
                    >
                      {deleteActionLabel(row.voidAvailability)}
                    </Button>,
                    disabled,
                    canWrite ? voidReason(row.voidAvailability) : readOnlyReason,
                  )}
              </>
            );
          }}
          attributesPagination={{
            state: dictionaryCursor,
            nextCursor: dictionaryData?.cursor,
            testIdPrefix: catalogTestIds.static.skuAttributesPagination,
          }}
          attributeValuesPagination={{
            state: attributeValuesCursor,
            nextCursor: attributeValuesData?.cursor,
            testIdPrefix: catalogTestIds.static.skuAttributeValuesPagination,
          }}
        />
      )}
      {!isDefinitionLibrary && !isSkuAttributeManagement && (
        <CatalogSimpleDictionaryLibrary
          entityLabel={activeEntityLabel}
          libraryKey={kind}
          description={activeEntityDescription}
          rows={rows}
          filter={simpleLibraryFilter}
          canWrite={canWrite}
          isUnit={isUnit}
          isProduction={isProduction}
          loading={
            isUnit
              ? unitQuery.isLoading || unitQuery.isFetching
              : isProduction
                ? productionQuery.isLoading || productionQuery.isFetching
                : dictionaryQuery.isLoading || dictionaryQuery.isFetching
          }
          createLabel={createLabel}
          onCreate={() => openCreate(kind)}
          renderStatus={value => <StatusTag manifest={manifest} value={value} />}
          renderUnitDimension={value => unitDimensionLabel(value as FormValues['unitDimension'])}
          renderActions={simpleRow => {
            const row = simpleRow as DictionaryRow;
            if (isUnit) {
              const control = catalogUnitVoidControlState({
                canWrite,
                isReferenced: row.isReferenced,
                isTransitioning: transitionUnitState.isLoading,
              });
              return (
                <>
                  {row.status !== 'VOIDED' &&
                    withMutationReason(
                      <Button
                        type="link"
                        disabled={!canWrite}
                        onClick={() => (row.isReferenced ? openNameEdit(row) : openUnitEdit(row))}
                        {...testId(catalogTestIdControls.config.action('UNIT', row.code, 'edit'))}
                      >
                        {row.isReferenced ? '编辑名称' : '编辑单位'}
                      </Button>,
                      !canWrite,
                      readOnlyReason,
                    )}
                  {row.status !== 'VOIDED' &&
                    withMutationReason(
                      <Button
                        type="link"
                        danger={row.status === 'ENABLED'}
                        disabled={!canWrite}
                        onClick={() => openStatusChange(row)}
                        {...testId(catalogTestIdControls.config.action('UNIT', row.code, 'change-status'))}
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
                        disabled={control.disabled}
                        onClick={() => deleteDictionaryEntry(row, 'UNIT')}
                        {...testId(catalogTestIdControls.config.action('UNIT', row.code, 'delete'))}
                      >
                        删除
                      </Button>,
                      control.disabled,
                      control.reason,
                    )}
                </>
              );
            }
            const reason = canWrite ? voidReason(row.voidAvailability) : readOnlyReason;
            const canVoid = !canWrite || !row.voidAvailability?.canVoid;
            return (
              <>
                {row.status !== 'VOIDED' &&
                  withMutationReason(
                    <Button
                      type="link"
                      disabled={!canWrite}
                      onClick={() => openNameEdit(row)}
                      {...testId(catalogTestIdControls.config.action(kind, row.code, 'edit'))}
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
                      onClick={() => openStatusChange(row)}
                      {...testId(catalogTestIdControls.config.action(kind, row.code, 'change-status'))}
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
                      disabled={canVoid}
                      onClick={() => deleteDictionaryEntry(row)}
                      {...testId(catalogTestIdControls.config.action(kind, row.code, 'delete'))}
                    >
                      {deleteActionLabel(row.voidAvailability)}
                    </Button>,
                    canVoid,
                    reason,
                  )}
              </>
            );
          }}
          pagination={
            isUnit
              ? undefined
              : {
                  state: isProduction ? productionCursor : dictionaryCursor,
                  nextCursor: isProduction ? productionData?.cursor : dictionaryData?.cursor,
                  testIdPrefix: isProduction
                    ? catalogTestIds.static.productionTagsPagination
                    : catalogTestIds.static.dictionaryPagination,
                }
          }
        />
      )}
      <CatalogDictionaryAtomModals
        canWrite={canWrite}
        problem={problem}
        creatingKind={creatingKind}
        creationTitle={creationTitle}
        creationKind={creationKind}
        creationForm={creationForm}
        creationFormTestId={creationFormTestId}
        creationSubmitting={
          createEntryState.isLoading || createTagState.isLoading || createUnitState.isLoading || lifecycle.submitting
        }
        nameFieldLabel={nameFieldLabel}
        codeFieldLabel={codeFieldLabel}
        unitDimensionOptions={unitDimensionOptions}
        onCreationValuesChange={() => lifecycle.setDirty(true)}
        onCancelCreate={() => creatingKind && dismissCreate(creatingKind)}
        onSubmitCreate={submitCreation}
        editingEntry={editingEntry}
        editNameForm={editNameForm}
        nameSaveLoading={updateEntryState.isLoading || updateTagState.isLoading || updateUnitState.isLoading}
        renderStatus={value => <StatusTag manifest={manifest} value={value} />}
        onSaveName={() => void saveName()}
        onCancelName={() => {
          editNameForm.resetFields();
          setProblem(undefined);
          setEditingEntry(undefined);
        }}
        editingUnit={editingUnit}
        editUnitForm={editUnitForm}
        unitSaveLoading={updateUnitState.isLoading}
        onSaveUnit={() => void saveUnit()}
        onCancelUnit={() => {
          editUnitForm.resetFields();
          setProblem(undefined);
          setEditingUnit(undefined);
        }}
        statusChange={statusChange}
        statusSaveLoading={
          transitionEntryState.isLoading || transitionTagState.isLoading || transitionUnitState.isLoading
        }
        onChangeStatus={() => void changeStatus()}
        onCancelStatus={() => {
          setProblem(undefined);
          setStatusChange(undefined);
        }}
      />
      {!canWrite && <TypographyHint text="当前账号没有编辑商品库能力，只读查看字典。" />}
    </CatalogConfigurationDrawerSurface>
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
