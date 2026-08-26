import {Form, Modal} from 'antd';
import {NameCodeText, testId, useDrawerFormLifecycle, useRefreshVersion} from '@catering-v2s/admin-ui-foundation';
import type {DrawerLifecycleDiagnosticEvent} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useReducer, useRef, useState, type SetStateAction} from 'react';
import {operationsContentTabRefreshSignal, operationsLogger} from '../../../app/api/OperationsTransport';
import {requireOperationsScopeRef} from '../../../app/routing/model';
import type {
  CatalogAttributeAssignment,
  CatalogInventoryRuleNode,
  CatalogOrderOptionConfig,
  CatalogSkuRow,
} from '../model/catalogModel';
import {
  buildCatalogSkuVoidRequest,
  catalogDetailImageRefs,
  catalogFormValidationIssue,
  mergeCatalogSkuVoidReadback,
  requireCatalogSkuVoidTransitionReadback,
} from '../model/catalogModel';
import {useCatalogItemEditorSession} from '../model/useCatalogItemEditorSession';
import {
  draftFieldSections,
  draftSection,
  emptyCatalogItemDraftSnapshot,
  selectCatalogItemBasicDraft,
  selectCatalogItemProductionDraft,
  normalizeSkuDraftRows,
  type CatalogCompositeGroupDraft,
  type CatalogIdentifierDraft,
  type CatalogItemBasicDraft,
  type CatalogItemDraftSnapshot,
  type CatalogItemProductionDraft,
  type MediaDraft,
  type SkuDimensionDraft,
  type SkuRowDraft,
} from '../model/catalogItemEditorDraftAdapters';
import {catalogUiProblemFeedback} from '../model/catalogUiProblemFeedback';
import {catalogFieldLabel} from '../model/catalogManifestLabels';
import type {CatalogLibraryKind} from '../model/catalogWorkspaceTask';
import {
  catalogEditorCanClose,
  catalogEditorChildCloseResult,
  catalogEditorChildTaskReducer,
  initialCatalogEditorChildTask,
} from '../model/catalogEditorChildTask';
import {catalogTestIds} from '../catalogTestIds';
import type {CatalogItemEditorSectionProps} from './CatalogItemEditorSectionProps';
import type {CatalogItemDrawerProps, CatalogManifest} from '../model/catalogItemSurfaceTypes';
import {useCatalogItemEditorMediaActions} from './useCatalogItemEditorMediaActions';

const catalogDeniedFieldLabels: Record<string, string> = {
  name: '商品名称',
  shortName: '短名',
  attributeAssignments: '商品属性',
  identifiers: '标识与条码',
  categoryRef: '分类',
  tagRefs: '商品标签',
  salesUnitRef: '销售单位',
  baseMeasureUnitRef: '基础计量单位',
  standardSalePrice: '商品标准价',
  images: '图片资产',
  preparationProfile: '制作信息',
  skuVariantDimensions: '规格维度',
  skuVariantAttribute: '规格属性',
  skuVariantValues: '规格值',
  skuMatrix: '规格列表',
  skus: '规格列表',
  orderOptionConfigs: '点单选项',
  inventoryBomComponent: '耗用对象',
  inventoryRules: '库存与 BOM',
  compositeComponentSku: '套餐组件规格',
  compositeGroups: '套餐内容',
};

function deniedFieldLabel(manifest: CatalogManifest | undefined, fieldKey: string) {
  const label = catalogDeniedFieldLabels[fieldKey] ?? catalogFieldLabel(manifest, fieldKey);
  return label === fieldKey ? '上游维护字段' : label;
}

/**
 * Typed UI-state hook for the editor workspace. Server reads, commands and
 * accidental-close/page-refresh recovery remain owned by
 * useCatalogItemEditorSession. Metadata maintenance is deliberately not a
 * recovery path: it remains an in-place child task of the open editor.
 */
export function useCatalogItemEditorWorkspaceState({
  itemCode,
  initialMode = 'view',
  queryContext,
  brandRef,
  canWriteCatalog,
  surface,
  onSaved,
  onClose,
}: CatalogItemDrawerProps) {
  void initialMode;
  void surface;
  const mode = 'edit' as const;
  const [problem, setProblem] = useState<string>();
  const drawerOperationInstanceId = useRef<string | undefined>(undefined);
  const problemRef = useRef<HTMLDivElement | null>(null);
  const draftRowSequence = useRef(0);
  const createDraftRowId = useCallback((prefix: string) => {
    draftRowSequence.current += 1;
    return `${prefix}-${draftRowSequence.current}`;
  }, []);
  const [mediaProblem, setMediaProblem] = useState<string>();
  const [releaseCloseFailed, setReleaseCloseFailed] = useState(false);
  const [releasingBeforeClose, setReleasingBeforeClose] = useState(false);
  const [voidingSkuRef, setVoidingSkuRef] = useState<string>();
  /** A configuration task is a child of this editor, never a replacement for it. */
  const [configurationTask, dispatchConfigurationTask] = useReducer(
    catalogEditorChildTaskReducer,
    initialCatalogEditorChildTask,
  );
  const pendingConfigurationFocusTestId = useRef<string | undefined>(undefined);
  const [form] = Form.useForm<{displayName: string; shortName?: string}>();
  const onDraftDiagnostic = useCallback((event: {phase: string; outcome: string; itemCode?: string}) => {
    operationsLogger.info({
      event: 'catalog.item.editor.draft.recovery',
      phase: event.phase,
      outcome: event.outcome,
      operationId: 'catalog-item-editor',
      operationInstanceId: drawerOperationInstanceId.current,
    });
  }, []);
  const session = useCatalogItemEditorSession({
    itemCode,
    scopeRef: queryContext.scopeRef,
    brandRef,
    onDraftDiagnostic,
  });
  const {
    detailQuery,
    detail,
    manifestQuery,
    manifest,
    mediaLimits,
    hydrateDraftFromDetail,
    markSavedForHydration,
    resetHydrationForClosedItem,
    saveWholeDraft,
    saveSkuVoid,
    stageStagedAsset,
    releaseStagedAsset,
    releaseStagedMedia,
  } = session;
  const {
    draft,
    replace: replaceDraft,
    updateField,
    updateFields,
    sectionState,
    setActiveSection,
    setSectionError,
    resetSectionState,
    restoreCandidate,
    restoreStatus,
    restoreProblem,
    persist: persistDraft,
    clear: clearDraft,
    acceptRestore,
    discardRestore,
    dismissRestore,
  } = session.draft;
  const activeTab = draft.activeTab;
  const persistCurrentDraft = useCallback(
    () =>
      persistDraft({
        ...draft,
        mode,
        activeTab,
        formValues: form.getFieldsValue(),
        mediaDraft: draft.mediaDraft.map(({file: _file, ...asset}) => asset),
        skuStagedMedia: draft.skuStagedMedia.map(({file: _file, ...asset}) => asset),
      }),
    [activeTab, draft, form, mode, persistDraft],
  );
  const setDraftField = useCallback(
    <K extends keyof CatalogItemDraftSnapshot>(key: K, next: SetStateAction<CatalogItemDraftSnapshot[K]>) => {
      updateField(key, next, draftFieldSections[key]);
    },
    [updateField],
  );
  const setActiveTab = useCallback(
    (next: SetStateAction<string>) => {
      const value = typeof next === 'function' ? next(activeTab) : next;
      setDraftField('activeTab', value);
      setActiveSection(draftSection(value));
    },
    [activeTab, setActiveSection, setDraftField],
  );
  const setContentScrollTop = useCallback(
    (next: number) => updateField('contentScrollTop', Math.max(0, Math.floor(next))),
    [updateField],
  );
  const mediaDraft = draft.mediaDraft;
  const skuStagedMedia = draft.skuStagedMedia;
  const identifierDraft = draft.identifierDraft;
  const attributeAssignmentsDraft = draft.attributeAssignmentsDraft;
  const orderOptionConfigsDraft = draft.orderOptionConfigsDraft;
  const inventoryRulesDraft = draft.inventoryRulesDraft;
  const compositeGroupsDraft = draft.compositeGroupsDraft;
  const skuVariantDimensionsDraft = draft.skuVariantDimensionsDraft;
  const skusDraft = draft.skusDraft;
  const setMediaDraft = useCallback(
    (next: SetStateAction<MediaDraft[]>) => setDraftField('mediaDraft', next),
    [setDraftField],
  );
  const setSkuStagedMedia = useCallback(
    (next: SetStateAction<MediaDraft[]>) => setDraftField('skuStagedMedia', next),
    [setDraftField],
  );
  const setIdentifierDraft = useCallback(
    (next: SetStateAction<CatalogIdentifierDraft[]>) => setDraftField('identifierDraft', next),
    [setDraftField],
  );
  const setAttributeAssignmentsDraft = useCallback(
    (next: SetStateAction<CatalogAttributeAssignment[]>) => setDraftField('attributeAssignmentsDraft', next),
    [setDraftField],
  );
  const setOrderOptionConfigsDraft = useCallback(
    (next: SetStateAction<CatalogOrderOptionConfig[]>) => setDraftField('orderOptionConfigsDraft', next),
    [setDraftField],
  );
  const setInventoryRulesDraft = useCallback(
    (next: SetStateAction<CatalogInventoryRuleNode[]>) => setDraftField('inventoryRulesDraft', next),
    [setDraftField],
  );
  const setCompositeGroupsDraft = useCallback(
    (next: SetStateAction<CatalogCompositeGroupDraft[]>) => setDraftField('compositeGroupsDraft', next),
    [setDraftField],
  );
  const setSkuVariantDimensionsDraft = useCallback(
    (next: SetStateAction<SkuDimensionDraft[]>) => setDraftField('skuVariantDimensionsDraft', next),
    [setDraftField],
  );
  const setSkusDraft = useCallback(
    (next: SetStateAction<SkuRowDraft[]>) => setDraftField('skusDraft', next),
    [setDraftField],
  );
  const closeAfterStagedRelease = useCallback(async () => {
    setReleaseCloseFailed(false);
    setReleasingBeforeClose(true);
    const outcomes = await releaseStagedMedia([...mediaDraft, ...skuStagedMedia]);
    const released = outcomes.every(outcome => outcome.released);
    const releasedIds = new Set(outcomes.filter(outcome => outcome.released).map(outcome => outcome.asset.id));
    if (releasedIds.size > 0) {
      setMediaDraft(current => current.map(asset => (releasedIds.has(asset.id) ? {...asset, staged: false} : asset)));
      setSkuStagedMedia(current =>
        current.map(asset => (releasedIds.has(asset.id) ? {...asset, staged: false} : asset)),
      );
    }
    setReleasingBeforeClose(false);
    if (!released) {
      setReleaseCloseFailed(true);
      setMediaProblem('图片资产释放未完成，请重试关闭。');
      return;
    }
    onClose();
  }, [mediaDraft, onClose, releaseStagedMedia, setMediaDraft, setSkuStagedMedia, skuStagedMedia]);
  const onLifecycleDiagnostic = useCallback((event: DrawerLifecycleDiagnosticEvent) => {
    drawerOperationInstanceId.current = event.operationInstanceId;
    operationsLogger.info({
      event: 'catalog.item.editor.lifecycle',
      phase: event.phase,
      outcome: event.outcome,
      operationId: event.operationId,
      operationInstanceId: event.operationInstanceId,
    });
  }, []);
  const {
    dirty: lifecycleDirty,
    setDirty: setLifecycleDirty,
    submitting: lifecycleSubmitting,
    setSubmitting: setLifecycleSubmitting,
    reset: resetLifecycle,
    requestClose: requestEditorClose,
    afterOpenChange,
  } = useDrawerFormLifecycle({
    open: Boolean(itemCode),
    onOpenChange: open => {
      if (!open) void closeAfterStagedRelease();
    },
    dirtyMessage: '商品编辑内容尚未保存。',
    dirtyGuardTestIds: {
      confirm: testId(catalogTestIds.static.itemDirtyDiscard),
      cancel: testId(catalogTestIds.static.itemDirtyContinue),
    },
    diagnosticOperationId: 'catalog-item-editor',
    onDiagnosticEvent: onLifecycleDiagnostic,
  });
  useEffect(() => {
    if (!itemCode || !detail || !lifecycleDirty || restoreCandidate) return;
    persistCurrentDraft();
  }, [detail, itemCode, lifecycleDirty, persistCurrentDraft, restoreCandidate]);
  const openCatalogConfig = useCallback((library: CatalogLibraryKind, triggerTestId: string) => {
    if (!itemCode) return;
    // Configuration is an editor child task. It must not persist, close or
    // rehydrate the item draft: the parent remains the sole draft owner.
    dispatchConfigurationTask({type: 'OPEN_CONFIG', library, triggerTestId});
  }, [itemCode]);
  const closeConfiguration = useCallback(() => {
    const {focusTestId} = catalogEditorChildCloseResult(configurationTask);
    pendingConfigurationFocusTestId.current = focusTestId;
    dispatchConfigurationTask({type: 'CLOSE'});
  }, [configurationTask]);
  const afterConfigurationClose = useCallback(() => {
    const focusTestId = pendingConfigurationFocusTestId.current;
    pendingConfigurationFocusTestId.current = undefined;
    if (!focusTestId) return;
    document.querySelector<HTMLElement>(`[data-testid="${focusTestId}"]`)?.focus();
  }, []);
  const requestClose = useCallback(() => {
    if (!catalogEditorCanClose(configurationTask)) {
      setProblem('请先完成或关闭商品元数据维护，再关闭商品编辑。');
      return;
    }
    requestEditorClose();
  }, [configurationTask, requestEditorClose]);
  const applyRecoveredDraft = useCallback(
    (snapshot: CatalogItemDraftSnapshot) => {
      form.setFieldsValue(snapshot.formValues);
      replaceDraft({
        ...snapshot,
        contentScrollTop: snapshot.contentScrollTop ?? 0,
        mediaDraft: snapshot.mediaDraft.map(asset => ({
          ...asset,
          file: undefined,
          status: asset.status === 'UPLOADING' ? 'FAILED' : asset.status,
        })),
        skuStagedMedia: snapshot.skuStagedMedia.map(asset => ({
          ...asset,
          file: undefined,
          status: asset.status === 'UPLOADING' ? 'FAILED' : asset.status,
        })),
      });
      setLifecycleDirty(true);
      operationsLogger.info({
        event: 'catalog.item.editor.draft.recovery_applied',
        phase: 'DRAFT_RECOVERY',
        outcome: 'SUCCEEDED',
        operationId: 'catalog-item-editor',
        operationInstanceId: drawerOperationInstanceId.current,
      });
    },
    [form, replaceDraft, setLifecycleDirty],
  );
  const restoreDraft = useCallback(() => {
    const snapshot = acceptRestore();
    if (snapshot) applyRecoveredDraft(snapshot);
  }, [acceptRestore, applyRecoveredDraft]);
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  const lastContentTabRefreshVersion = useRef(contentTabRefreshVersion);
  const refetchDetail = detailQuery.refetch;
  const refetchManifest = manifestQuery.refetch;
  useEffect(() => {
    if (!itemCode || contentTabRefreshVersion === lastContentTabRefreshVersion.current) return;
    lastContentTabRefreshVersion.current = contentTabRefreshVersion;
    // A shell refresh must update the server read model without overwriting a
    // dirty editor draft. Clean drawers opt into hydration after the refetch;
    // the existing hydration guard keeps unsaved edits intact.
    if (!lifecycleDirty) markSavedForHydration();
    operationsLogger.info({
      event: 'catalog.item.editor.content_refresh',
      phase: 'READ_MODEL_REFRESH',
      outcome: 'STARTED',
      operationId: 'catalog-item-editor',
      operationInstanceId: drawerOperationInstanceId.current,
    });
    void refetchDetail();
    void refetchManifest();
  }, [contentTabRefreshVersion, itemCode, lifecycleDirty, markSavedForHydration, refetchDetail, refetchManifest]);
  useEffect(() => {
    const hydration = hydrateDraftFromDetail({activeTab, dirty: lifecycleDirty, createDraftRowId});
    if (hydration.kind !== 'HYDRATED') return;
    form.setFieldsValue(hydration.formValues);
    resetSectionState({activeSection: draftSection(hydration.activeTab)});
    setMediaProblem(undefined);
  }, [activeTab, createDraftRowId, form, hydrateDraftFromDetail, lifecycleDirty, resetSectionState]);
  useEffect(() => {
    if (!(problem || detailQuery.error || mediaProblem)) return;
    window.requestAnimationFrame(() => problemRef.current?.focus());
  }, [detailQuery.error, mediaProblem, problem]);
  useEffect(() => {
    if (!itemCode) {
      // The Drawer stays mounted while hidden, so closing it must clear every
      // local draft before the next open. Clearing only the basic fields lets
      // the previous product's attributes/order options leak into a new edit.
      drawerOperationInstanceId.current = undefined;
      resetHydrationForClosedItem();
      setActiveTab('basic');
      setProblem(undefined);
      setMediaProblem(undefined);
      setReleaseCloseFailed(false);
      setReleasingBeforeClose(false);
      dispatchConfigurationTask({type: 'CLOSE'});
      replaceDraft(emptyCatalogItemDraftSnapshot());
      setVoidingSkuRef(undefined);
      form.resetFields();
      resetSectionState();
      resetLifecycle();
    }
  }, [form, itemCode, replaceDraft, resetHydrationForClosedItem, resetLifecycle, resetSectionState, setActiveTab]);

  const submit = async () => {
    if (!detail || !itemCode) return;
    if (mediaDraft.some(asset => asset.status === 'UPLOADING')) {
      setMediaProblem('图片仍在上传或处理中，请等待完成后再保存。');
      setActiveTab('basic');
      return;
    }
    if (mediaDraft.some(asset => asset.status === 'FAILED' && !asset.assetRef)) {
      setMediaProblem('存在未完成的图片上传，请重试或移除失败项后再保存。');
      setActiveTab('basic');
      return;
    }
    if (skuStagedMedia.some(asset => asset.status === 'UPLOADING')) {
      setMediaProblem('规格图片仍在上传或处理中，请等待完成后再保存。');
      setActiveTab('sku-specifications-pricing');
      return;
    }
    if (skuStagedMedia.some(asset => asset.status === 'FAILED' && !asset.assetRef)) {
      setMediaProblem('存在未完成的规格图片上传，请重试或移除失败项后再保存。');
      setActiveTab('sku-specifications-pricing');
      return;
    }
    let values: {displayName: string; shortName?: string};
    try {
      values = await form.validateFields();
    } catch (error) {
      const issue = catalogFormValidationIssue(error);
      const section = draftSection(issue?.tabKey ?? 'basic');
      const message = issue?.message ?? '请先修正商品基础信息后再保存。';
      setActiveTab(section);
      setSectionError(section, message);
      setProblem(message);
      return;
    }
    const visibleTabs = new Set(detail.tabs.filter(tab => tab.visible).map(tab => tab.tabKey));
    if (visibleTabs.has('identifiers')) {
      const invalidIndex = identifierDraft.findIndex(entry => !entry.identifierType || !entry.identifierValue.trim());
      if (invalidIndex >= 0) {
        setActiveTab('identifiers');
        const message = `条码与标识第 ${invalidIndex + 1} 行请填写识别方式和识别值。`;
        setSectionError('identifiers', message);
        setProblem(message);
        return;
      }
    }
    if (visibleTabs.has('sku-specifications-pricing')) {
      const invalidDimension = skuVariantDimensionsDraft.findIndex(
        dimension =>
          !dimension.attributeCode.trim() ||
          !dimension.attributeName.trim() ||
          dimension.values.some(value => !value.valueCode.trim() || !value.valueLabel.trim()),
      );
      const seenSkuCodes = new Set<string>();
      let invalidSku = -1;
      for (let index = 0; index < skusDraft.length; index += 1) {
        const sku = skusDraft[index];
        const code = sku.skuCode.trim();
        if (!code || !sku.skuName.trim() || seenSkuCodes.has(code)) {
          invalidSku = index;
          break;
        }
        seenSkuCodes.add(code);
      }
      if (invalidDimension >= 0) {
        setActiveTab('sku-specifications-pricing');
        const message = `规格第 ${invalidDimension + 1} 个维度缺少属性编码、名称或属性值信息。`;
        setSectionError('sku-specifications-pricing', message);
        setProblem(message);
        return;
      }
      if (invalidSku >= 0) {
        setActiveTab('sku-specifications-pricing');
        const message = '规格列表第 ' + (invalidSku + 1) + ' 行缺少编码、名称或存在重复编码。';
        setSectionError('sku-specifications-pricing', message);
        setProblem(message);
        return;
      }
    }
    if (visibleTabs.has('inventory-bom')) {
      const invalidNode = inventoryRulesDraft.findIndex(node => {
        if (node.mode === 'NONE') return false;
        if (node.mode === 'DIRECT') return !node.directConfiguration;
        if (node.mode === 'BOM') {
          return (
            !node.bom?.lines.length ||
            node.bom.lines.some(line => !line.targetRef || !line.itemRef || !line.quantity.trim())
          );
        }
        return true;
      });
      if (invalidNode >= 0) {
        setActiveTab('inventory-bom');
        const message = `库存/BOM 第 ${invalidNode + 1} 个节点缺少库存对象或消耗数量，请选择已有库存对象。`;
        setSectionError('inventory-bom', message);
        setProblem(message);
        return;
      }
    }
    if (visibleTabs.has('composite-content')) {
      const invalidGroup = compositeGroupsDraft.findIndex(
        group =>
          !group.groupCode.trim() ||
          !group.groupName.trim() ||
          group.components.some(
            component =>
              !component.itemCode.trim() ||
              !component.itemRef.trim() ||
              !component.quantity.trim() ||
              !component.unit.trim(),
          ),
      );
      if (invalidGroup >= 0) {
        setActiveTab('composite-content');
        const message = `套餐内容第 ${invalidGroup + 1} 组缺少分组编码、分组名、组件商品引用或数量/单位。`;
        setSectionError('composite-content', message);
        setProblem(message);
        return;
      }
    }
    setLifecycleSubmitting(true);
    setProblem(undefined);
    try {
      await saveWholeDraft({itemCode, detail, visibleTabs, formValues: values});
      clearDraft();
      resetSectionState();
      markSavedForHydration();
      resetLifecycle();
      onSaved?.();
      setMediaDraft(current =>
        current.map(asset => ({...asset, bindGrant: undefined, file: undefined, staged: false})),
      );
      setSkuStagedMedia(current =>
        current.map(asset => ({...asset, bindGrant: undefined, file: undefined, staged: false})),
      );
    } catch (error) {
      const feedback = catalogUiProblemFeedback(error, '商品暂时无法保存，请稍后重新尝试。');
      if (feedback.tab) {
        setActiveTab(feedback.tab);
        setSectionError(draftSection(feedback.tab), feedback.message);
      }
      setProblem(feedback.message);
      setLifecycleSubmitting(false);
    }
  };
  const voidSku = (sku: CatalogSkuRow) => {
    if (
      !detail ||
      !itemCode ||
      !canWriteCatalog ||
      detail.item.source === 'TEMPORARY' ||
      detail.item.lifecycle.status === 'VOIDED' ||
      !sku.voidAvailability?.canVoid
    )
      return;
    Modal.confirm({
      title: (
        <span>
          作废规格“
          <NameCodeText name={sku.skuName} code={sku.skuCode} />
          ”？
        </span>
      ),
      content: '作废后该规格不再占用商品编码；此操作不可逆，商品其他事实不会被清空。',
      okText: '确认作废规格',
      cancelText: '取消',
      okButtonProps: {danger: true},
      onOk: async () => {
        setVoidingSkuRef(sku.productSkuRef);
        setProblem(undefined);
        try {
          const dataNodeRef = requireOperationsScopeRef(queryContext);
          const body = buildCatalogSkuVoidRequest(detail.item, dataNodeRef, itemCode, sku, detail.inventoryRules);
          const readback = await saveSkuVoid({itemCode, body});
          const transitionReadback = requireCatalogSkuVoidTransitionReadback(
            readback.result.skuTransitions,
            sku.productSkuRef,
          );
          setSkusDraft(current =>
            normalizeSkuDraftRows(
              mergeCatalogSkuVoidReadback(current, sku.productSkuRef, transitionReadback),
              createDraftRowId,
            ),
          );
        } catch (error) {
          setProblem(
            error instanceof Error && error.message === 'INVALID_CATALOG_SKU_VOID_TRANSITION_READBACK'
              ? '规格作废结果暂时无法确认，请刷新后重试。'
              : catalogUiProblemFeedback(error, '规格作废未完成，请刷新后重试。').message,
          );
        } finally {
          setVoidingSkuRef(undefined);
        }
      },
    });
  };
  const {stageMedia, removeMedia, moveMedia, setPrimaryMedia, stageSkuMedia, removeSkuMedia, removeSkuStagedMedia} =
    useCatalogItemEditorMediaActions({
      itemCode,
      mediaLimits,
      mediaDraft,
      skuStagedMedia,
      skusDraft,
      setMediaDraft,
      setSkuStagedMedia,
      setSkusDraft,
      stageStagedAsset,
      releaseStagedAsset,
      setDirty: setLifecycleDirty,
      setProblem: setMediaProblem,
    });
  const updateIdentifiers = (next: CatalogIdentifierDraft[]) => {
    setIdentifierDraft(next);
    setLifecycleDirty(true);
  };
  const updateInventoryRules = (next: CatalogInventoryRuleNode[]) => {
    setInventoryRulesDraft(next);
    setLifecycleDirty(true);
  };
  const updateCompositeGroups = (next: CatalogCompositeGroupDraft[]) => {
    setCompositeGroupsDraft(next);
    setLifecycleDirty(true);
  };
  const updateSkuVariantDimensions = (next: SkuDimensionDraft[]) => {
    setSkuVariantDimensionsDraft(next);
    setLifecycleDirty(true);
  };
  const updateSkus = (next: CatalogSkuRow[]) => {
    setSkusDraft(normalizeSkuDraftRows(next, createDraftRowId));
    setLifecycleDirty(true);
  };
  const basicDraft = {
    values: selectCatalogItemBasicDraft(draft),
    onChange: (patch: Partial<CatalogItemBasicDraft>) => {
      updateFields(patch, 'basic');
      setLifecycleDirty(true);
    },
  };
  const productionDraft = {
    values: selectCatalogItemProductionDraft(draft),
    onChange: (patch: Partial<CatalogItemProductionDraft>) => {
      updateFields(patch, 'production-prompts');
      setLifecycleDirty(true);
    },
  };
  const sectionProps: Omit<CatalogItemEditorSectionProps, 'tabKey'> | undefined = detail
    ? {
        detail,
        manifest,
        canWriteCatalog,
        form,
        mediaDraft,
        onStageMedia: stageMedia,
        onRemoveMedia: removeMedia,
        onMoveMedia: moveMedia,
        onSetPrimaryMedia: setPrimaryMedia,
        skuStagedMedia,
        onStageSkuMedia: stageSkuMedia,
        onRemoveSkuMedia: removeSkuMedia,
        onRemoveSkuStagedMedia: removeSkuStagedMedia,
        productionDraft,
        onOpenConfig: openCatalogConfig,
        basicDraft,
        attributeAssignmentsDraft,
        onAttributeAssignmentsChange: next => {
          setAttributeAssignmentsDraft(next);
          setLifecycleDirty(true);
        },
        orderOptionConfigsDraft,
        onOrderOptionConfigsChange: next => {
          setOrderOptionConfigsDraft(next);
          setLifecycleDirty(true);
        },
        identifierDraft,
        createDraftRowId,
        inventoryRulesDraft,
        compositeGroupsDraft,
        skuVariantDimensionsDraft,
        skusDraft,
        queryContext,
        brandRef,
        currentItemCode: itemCode,
        onIdentifiersChange: updateIdentifiers,
        onInventoryRulesChange: updateInventoryRules,
        onCompositeGroupsChange: updateCompositeGroups,
        onSkuVariantDimensionsChange: updateSkuVariantDimensions,
        onSkusChange: updateSkus,
        onDirty: () => setLifecycleDirty(true),
        onVoidSku: voidSku,
        voidingSkuRef,
        onNavigateTab: next => setActiveTab(next),
      }
    : undefined;
  return {
    activeTab,
    afterOpenChange,
    autoSyncLockedFieldLabels: detail?.deniedFields.map(field => deniedFieldLabel(manifest, field)).join('、'),
    closeAfterStagedRelease,
    contentScrollTop: draft.contentScrollTop,
    configurationTask,
    closeConfiguration,
    afterConfigurationClose,
    detail,
    detailImageRefs: detail ? catalogDetailImageRefs(detail.item) : [],
    detailQuery,
    discardRestore,
    dismissRestore,
    lifecycleSubmitting,
    manifest,
    mediaProblem,
    problem,
    problemRef,
    releaseCloseFailed,
    releasingBeforeClose,
    requestClose,
    restoreCandidate,
    restoreDraft,
    restoreProblem,
    restoreStatus,
    setActiveTab,
    setContentScrollTop,
    submit,
    sectionProps,
    sectionState,
  };
}
