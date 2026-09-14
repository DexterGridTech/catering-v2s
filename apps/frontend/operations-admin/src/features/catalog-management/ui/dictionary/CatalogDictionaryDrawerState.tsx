import {App, Form} from 'antd';
import {
  createContentIdempotencyKey,
  type DrawerLifecycleDiagnosticEvent,
  testId,
  useCursorStack,
  useDrawerFormLifecycle,
  useRefreshVersion,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  operationsContentTabRefreshSignal,
  operationsLogger,
  operationsProblemOf,
  operationsRtk,
} from '../../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../../app/api/generated/catalog-inventory-edge.rtk';
import {
  CATALOG_INVENTORY_OPERATION_IDS,
  type CatalogDictionaryEntryReadback,
} from '../../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../../app/api/wireUuid';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../../app/routing/model';
import {catalogUiProblemFeedback} from '../../model/catalogUiProblemFeedback';
import {productionTagReadbackIsComplete} from '../../model/catalogModel';
import type {CatalogLibraryKind} from '../../model/catalogWorkspaceTask';
import {useCatalogConfigLibrary} from '../../model/useCatalogConfigLibrary';
import {catalogTestIds} from '../../catalogTestIds';
import {type CatalogConfigurationLibrary} from '../CatalogConfigurationLibraryNavigation';
import {CatalogDictionaryDrawerView} from './CatalogDictionaryDrawerView';
import {
  catalogConfigurationChangeNeedsConfirmation,
  DICTIONARY_PAGE_SIZE,
  dictionaryDescriptions,
  dictionaryKindLabels,
  catalogUnitStatusQuery,
} from './catalogDictionaryDrawerModel';
import type {DictionaryKind, FormValues, VoidAvailability} from './catalogDictionaryDrawerModel';

// Preserve the pre-split state-module exports for existing model tests and
// callers while keeping the implementation in the dictionary model module.
export {
  catalogConfigurationChangeNeedsConfirmation,
  catalogUnitStatusQuery,
  catalogUnitVoidControlState,
} from './catalogDictionaryDrawerModel';

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

export type ConfigLibraryTab = CatalogConfigurationLibrary;

export type DictionaryRow = {
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

export type NameEditRequest = {row: DictionaryRow; dictionaryKind: DictionaryKind};

export type UnitEditValues = Pick<FormValues, 'code' | 'name' | 'unitDimension' | 'precision'>;

export type StatusChangeRequest = {row: DictionaryRow; dictionaryKind: DictionaryKind};

export function useCatalogDictionaryDrawerController({
  open,
  initialKind = 'TAG',
  queryContext,
  brandRef,
  canWrite,
  parentEntryRef,
  presentation,
  onClose,
  onAfterClose: onAfterCloseProp,
}: CatalogDictionaryDrawerProps) {
  const {modal} = App.useApp();
  const initialConfigLibrary: ConfigLibraryTab = initialKind === 'SKU_ATTRIBUTE_VALUE' ? 'SKU_ATTRIBUTE' : initialKind;
  const configLibrary = useCatalogConfigLibrary({
    initialLibrary: initialConfigLibrary,
    contextKey: `${open}|${initialConfigLibrary}|${queryContext.scopeRef ?? ''}|${brandRef ?? ''}|${parentEntryRef ?? ''}`,
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
  const libraryContextReady = !configLibrary.contextChanged;
  const currentLibrary = (
    libraryContextReady ? configLibrary.currentLibrary : initialConfigLibrary
  ) as ConfigLibraryTab;
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
  const definitionDirtyBridged = useRef(false);
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
    dirtyMessage: definitionDirtyMessage ?? '字典新建内容尚未保存。',
    dirtyGuardTestIds: {
      confirm: testId(catalogTestIds.static.dictionaryDirtyDiscard),
      cancel: testId(catalogTestIds.static.dictionaryDirtyContinue),
    },
    diagnosticOperationId: 'catalog-dictionary',
    onDiagnosticEvent: onLifecycleDiagnostic,
  });
  const resetLocalTransientState = useCallback(() => {
    tagForm.resetFields();
    unitForm.resetFields();
    skuAttributeForm.resetFields();
    productionTagForm.resetFields();
    attributeValueForm.resetFields();
    editNameForm.resetFields();
    editUnitForm.resetFields();
    setProblem(undefined);
    setEditingEntry(undefined);
    setEditingUnit(undefined);
    setStatusChange(undefined);
    setCreatingKind(undefined);
    setDefinitionDirtyMessage(undefined);
    definitionDirtyBridged.current = false;
    drawerOperationInstanceId.current = undefined;
    resetLibraryContext();
  }, [
    attributeValueForm,
    editNameForm,
    editUnitForm,
    productionTagForm,
    resetLibraryContext,
    skuAttributeForm,
    tagForm,
    unitForm,
  ]);
  const resetLifecycle = lifecycle.reset;
  const resetLifecyclePreservingOpen = lifecycle.resetPreservingOpen;
  const resetTransientState = useCallback(() => {
    resetLocalTransientState();
    resetLifecyclePreservingOpen();
  }, [resetLifecyclePreservingOpen, resetLocalTransientState]);
  const handleAfterClose = useCallback(() => {
    // The configuration surface invokes this only after the Drawer has
    // visually closed and the foundation has consumed its close transition.
    resetLocalTransientState();
    resetLifecycle();
    onAfterCloseProp?.();
  }, [onAfterCloseProp, resetLifecycle, resetLocalTransientState]);
  const handleDefinitionDirtyChange = useCallback(
    (message?: string) => {
      setDefinitionDirtyMessage(message);
      if (message) {
        if (!lifecycle.dirty) definitionDirtyBridged.current = true;
        lifecycle.setDirty(true);
      } else if (definitionDirtyBridged.current) {
        definitionDirtyBridged.current = false;
        lifecycle.setDirty(false);
      }
    },
    [lifecycle],
  );
  const requestConfigClose = lifecycle.requestClose;
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
    skip: !open || !libraryContextReady || isDefinitionLibrary || isProduction || isUnit || missingParentEntry,
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
  const unitQuery = operationsRtk.useListOperationsCatalogUnitsQuery(unitRequest, {
    skip: !open || !libraryContextReady || !isUnit,
  });
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
    skip: !open || !libraryContextReady || isDefinitionLibrary || kind !== 'SKU_ATTRIBUTE' || !selectedAttributeRef,
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
    skip: !open || !libraryContextReady || isDefinitionLibrary || !isProduction,
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
    if (!open || !libraryContextReady || contentTabRefreshVersion === lastContentTabRefreshVersion.current) return;
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
    libraryContextReady,
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
    if (open && configLibrary.contextChanged) {
      resetTransientState();
    }
    if (open && (!wasOpen.current || configLibrary.contextChanged)) {
      selectLibrary(initialConfigLibrary);
    }
    wasOpen.current = open;
  }, [configLibrary.contextChanged, initialConfigLibrary, open, resetTransientState, selectLibrary]);
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
        resetLifecyclePreservingOpen();
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
          resetLifecyclePreservingOpen();
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
      resetLifecyclePreservingOpen();
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
      resetLifecyclePreservingOpen();
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
    resetLifecyclePreservingOpen();
  };
  const changeLibrary = (nextLibrary: ConfigLibraryTab) => {
    if (nextLibrary === currentLibrary) return;
    const applyChange = () => {
      resetLifecyclePreservingOpen();
      setDefinitionDirtyMessage(undefined);
      definitionDirtyBridged.current = false;
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
    // This confirmation protects an in-drawer library switch. The outer
    // Drawer close intent always goes through the foundation lifecycle below.
    modal.confirm({
      title: '放弃当前填写内容？',
      content: '切换配置分类后，当前未保存的内容不会保留。',
      okText: '放弃并切换',
      cancelText: '继续编辑',
      onOk: applyChange,
    });
  };
  return {
    open,
    queryContext,
    canWrite,
    presentation,
    onAfterClose: handleAfterClose,
    configLibrary,
    setSelectedEntryRef,
    currentLibrary,
    isDefinitionLibrary,
    kind,
    editNameForm,
    editUnitForm,
    problem,
    setProblem,
    editingEntry,
    setEditingEntry,
    editingUnit,
    setEditingUnit,
    statusChange,
    setStatusChange,
    creatingKind,
    selectedAttributeRef,
    setDefinitionDirtyMessage: handleDefinitionDirtyChange,
    headers,
    isProduction,
    isUnit,
    simpleLibraryFilter,
    dictionaryCursor,
    attributeValuesCursor,
    productionCursor,
    lifecycle,
    requestConfigClose,
    manifest,
    dictionaryQuery,
    unitQuery,
    attributeValuesQuery,
    productionQuery,
    createEntryState,
    createTagState,
    updateEntryState,
    transitionEntryState,
    updateTagState,
    transitionTagState,
    createUnitState,
    updateUnitState,
    transitionUnitState,
    dictionaryData,
    attributeValuesData,
    productionData,
    openNameEdit,
    openUnitEdit,
    saveUnit,
    saveName,
    openStatusChange,
    changeStatus,
    deleteDictionaryEntry,
    rows,
    attributeValueRows,
    selectedAttribute,
    unitReadProblem,
    isSkuAttributeManagement,
    readOnlyReason,
    activeEntityLabel,
    activeEntityDescription,
    createLabel,
    creationKind,
    creationForm,
    codeFieldLabel,
    nameFieldLabel,
    creationTitle,
    creationFormTestId,
    submitCreation,
    openCreate,
    dismissCreate,
    changeLibrary,
  };
}

export type CatalogDictionaryDrawerViewModel = ReturnType<typeof useCatalogDictionaryDrawerController>;

export function CatalogDictionaryDrawerState(props: CatalogDictionaryDrawerProps) {
  const viewModel = useCatalogDictionaryDrawerController(props);
  return <CatalogDictionaryDrawerView viewModel={viewModel} />;
}
