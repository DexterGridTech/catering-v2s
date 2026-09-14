import {
  createContentIdempotencyKey,
  testId,
  useCursorCandidates,
  useDrawerFormLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../../app/api/generated/catalog-inventory-edge.rtk';
import {CATALOG_INVENTORY_OPERATION_IDS} from '../../../../app/api/generated/catalog-inventory-edge';
import type {
  CatalogShapeManifestView,
  LocalCopyCandidatePage,
} from '../../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../../app/api/wireUuid';
import {requireOperationsScopeRef, type OperationsPageProps} from '../../../../app/routing/model';
import {copyConfirmationRows} from '../../model/catalog/catalogCopyModel';
import {decodeDetail} from '../../model/catalog/catalogItemModel';
import {shapeHasVisibleTab} from '../../model/catalog/catalogLifecycle';
import {
  decodeLocalCopyCandidatePage,
  decodeLocalCopyPreflight,
  decodeLocalCopyReadback,
  type LocalCopyPreflightData,
  type LocalCopyReadbackData,
  type LocalCopyScope,
  LOCAL_COPY_SCOPE_VALUES,
  DEFAULT_LOCAL_COPY_SCOPES,
  LOCAL_COPY_STEPS,
  copyScopeTabKey,
  type WizardStep,
} from './localCatalogCopyModel';
import {catalogUiProblemFeedback} from '../../model/catalogUiProblemFeedback';
import {catalogEnumOptions} from '../../model/catalogManifestLabels';
import {catalogTestIds} from '../../catalogTestIds';
import {catalogBusinessName} from '../catalogBusinessName';
import {LocalCatalogCopyView} from './LocalCatalogCopyView';

export type Props = {
  open: boolean;
  sourceItemCode: string;
  targetShapeKey?: string;
  queryContext: OperationsPageProps['queryContext'];
  brandRef?: string;
  onClose: () => void;
};

export type CatalogManifest = Pick<CatalogShapeManifestView, 'enumLabels' | 'fields' | 'tabRules'>;

export function useLocalCatalogCopyController({
  open,
  sourceItemCode,
  targetShapeKey,
  queryContext,
  brandRef,
  onClose,
}: Props) {
  // The detail drawer opens this journey for the current item. The selected
  // candidate is therefore the source and sourceItemCode is the immutable target.
  const targetItemCode = sourceItemCode;
  const contextKey = `${open}|${queryContext.scopeRef ?? ''}|${brandRef ?? ''}|${targetItemCode}|${targetShapeKey ?? ''}`;
  const previousContextKey = useRef(contextKey);
  const contextChanged = previousContextKey.current !== contextKey;
  if (contextChanged) previousContextKey.current = contextKey;
  const [step, setStep] = useState<WizardStep>('source-scope');
  const [selectedSourceItemCode, setSelectedSourceItemCode] = useState<string>();
  const [sourceKeyword, setSourceKeyword] = useState('');
  const candidateState = useCursorCandidates<LocalCopyCandidatePage['data']['items'][number]>({
    queryText: sourceKeyword,
    resetKey: `${open}|${queryContext.scopeRef ?? ''}|${brandRef ?? ''}|${targetItemCode}|${targetShapeKey ?? ''}`,
    pageSize: 50,
    keyOf: item => item.code,
  });
  const [selectedSections, setSelectedSections] = useState<LocalCopyScope[]>(DEFAULT_LOCAL_COPY_SCOPES);
  const [preflight, setPreflight] = useState<LocalCopyPreflightData>();
  const [readback, setReadback] = useState<LocalCopyReadbackData>();
  const [referenceMappingsSnapshot, setReferenceMappingsSnapshot] = useState<
    LocalCopyPreflightData['referenceMappings']
  >([]);
  const [preflightPending, setPreflightPending] = useState(false);
  const [confirmedCompatibilityKeys, setConfirmedCompatibilityKeys] = useState<string[]>([]);
  const [stale, setStale] = useState(false);
  const [problem, setProblem] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: next => {
      if (!next) onClose();
    },
    dirtyMessage: '本库复制检查影响和选择尚未提交。',
    dirtyGuardTestIds: {
      confirm: testId(catalogTestIds.static.localCopyDirtyDiscard),
      cancel: testId(catalogTestIds.static.localCopyDirtyContinue),
    },
    diagnosticOperationId: 'local-catalog-copy',
  });
  const resetLifecycle = lifecycle.reset;
  const resetLifecyclePreservingOpen = lifecycle.resetPreservingOpen;
  const resetLocalTransientState = useCallback(() => {
    setStep('source-scope');
    setSelectedSourceItemCode(undefined);
    setSourceKeyword('');
    setSelectedSections(DEFAULT_LOCAL_COPY_SCOPES);
    setPreflight(undefined);
    setReadback(undefined);
    setReferenceMappingsSnapshot([]);
    setPreflightPending(false);
    setConfirmedCompatibilityKeys([]);
    setStale(false);
    setProblem(undefined);
  }, []);
  const handleAfterOpenChange = useCallback(
    (visible: boolean) => {
      lifecycle.afterOpenChange(visible);
      if (!visible && !open) {
        // Local state is discarded only after the visual close has been
        // confirmed. The foundation reset must run after that callback so it
        // cannot erase the observed-open marker before close confirmation.
        resetLocalTransientState();
        resetLifecycle();
      }
    },
    [lifecycle, open, resetLifecycle, resetLocalTransientState],
  );
  const headers = useMemo(() => (brandRef ? {'X-Workspace-Brand-Ref': brandRef} : undefined), [brandRef]);
  const targetDetailRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.getOperationsCatalogItem(
        {itemCode: targetItemCode},
        {query: {dataNodeRef: wireUuid(queryContext.scopeRef ?? '')}, headers},
      ),
    [headers, queryContext.scopeRef, targetItemCode],
  );
  const targetDetailQuery = operationsRtk.useGetOperationsCatalogItemQuery(targetDetailRequest, {
    skip: !open || !targetItemCode || !queryContext.scopeRef,
  });
  const targetDetail = decodeDetail(targetDetailQuery.currentData);
  const targetItemName = catalogBusinessName(targetDetail?.item.name, targetItemCode, '当前商品名称暂时无法读取');
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
  const candidateRequest = useMemo(() => {
    const query: Record<string, string | number> = {
      dataNodeRef: queryContext.scopeRef ?? '',
      pageSize: candidateState.pageSize,
    };
    if (candidateState.debouncedQueryText) query.keyword = candidateState.debouncedQueryText;
    if (candidateState.cursor) query.cursor = candidateState.cursor;
    return catalogInventoryRtkRequest.getOperationsLocalCatalogCopyCandidates({}, {query, headers});
  }, [
    candidateState.cursor,
    candidateState.debouncedQueryText,
    candidateState.pageSize,
    headers,
    queryContext.scopeRef,
  ]);
  const candidatesQuery = operationsRtk.useGetOperationsLocalCatalogCopyCandidatesQuery(candidateRequest, {
    skip: !open,
  });
  const candidatePage = decodeLocalCopyCandidatePage(candidatesQuery.currentData);
  const acceptCandidatePage = candidateState.acceptPage;
  const candidatePageSize = candidateState.pageSize;
  useEffect(() => {
    if (!candidatePage) return;
    acceptCandidatePage(candidatePage.items, {
      pageSize: candidatePageSize,
      total: candidatePage.total,
      nextCursor: candidatePage.cursor,
    });
  }, [acceptCandidatePage, candidatePage, candidatePageSize]);
  const candidates = useMemo(
    () =>
      candidateState.items.filter(
        item => item.code !== targetItemCode && (!targetShapeKey || item.shapeKey === targetShapeKey),
      ),
    [candidateState.items, targetItemCode, targetShapeKey],
  );
  const selectedSourceShapeKey = candidateState.items.find(item => item.code === selectedSourceItemCode)?.shapeKey;
  const localCopyScopeOptions = useMemo(() => {
    const labels = new Map(catalogEnumOptions(manifest, 'catalogSection').map(option => [option.value, option.label]));
    return LOCAL_COPY_SCOPE_VALUES.flatMap(value => {
      const label = labels.get(value);
      if (!label) return [];
      const tabKey = copyScopeTabKey(value);
      const disabled = Boolean(
        selectedSourceShapeKey && tabKey && !shapeHasVisibleTab(manifest, selectedSourceShapeKey, tabKey),
      );
      return [
        {
          value,
          label,
          disabled,
          reason: disabled ? '当前来源商品形态不支持该复制范围。' : undefined,
        },
      ];
    });
  }, [manifest, selectedSourceShapeKey]);
  useEffect(() => {
    if (!selectedSourceShapeKey) return;
    setSelectedSections(current =>
      current.filter(scope => {
        const tabKey = copyScopeTabKey(scope);
        return !tabKey || shapeHasVisibleTab(manifest, selectedSourceShapeKey, tabKey);
      }),
    );
  }, [manifest, selectedSourceShapeKey]);
  const [preflightCopy] = operationsRtk.usePreflightOperationsLocalCatalogCopyMutation();
  const [executeCopy, executeState] = operationsRtk.useExecuteOperationsLocalCatalogCopyMutation();
  const confirmationRows = useMemo(
    () => copyConfirmationRows(preflight?.compatibilityResults ?? []),
    [preflight?.compatibilityResults],
  );
  const unhandledConfirmationCount = Math.max(confirmationRows.length - confirmedCompatibilityKeys.length, 0);
  const confirmationCountMatches = !preflight || preflight.confirmationRequiredCount === confirmationRows.length;
  const allConfirmationsHandled = confirmationCountMatches && unhandledConfirmationCount === 0;

  useEffect(() => {
    if (!contextChanged) return;
    resetLocalTransientState();
    resetLifecyclePreservingOpen();
  }, [contextChanged, resetLifecyclePreservingOpen, resetLocalTransientState]);

  const runPreflight = async () => {
    if (!selectedSourceItemCode || selectedSections.length === 0) {
      setProblem('请选择来源商品和至少一个复制范围。');
      return;
    }
    if (lifecycle.submitting) return;
    setProblem(undefined);
    setStale(false);
    setReadback(undefined);
    setPreflight(undefined);
    setConfirmedCompatibilityKeys([]);
    setPreflightPending(true);
    setStep('bom-mapping');
    lifecycle.setSubmitting(true);
    try {
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const body = {dataNodeRef, sourceItemCode: selectedSourceItemCode, targetItemCode, selectedSections};
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.preflightOperationsLocalCatalogCopy,
        body,
      );
      const response = await preflightCopy(
        catalogInventoryRtkRequest.preflightOperationsLocalCatalogCopy(
          {},
          {
            headers: {...(headers ?? {}), 'Idempotency-Key': idempotencyKey},
            body,
          },
        ),
      ).unwrap();
      const value = decodeLocalCopyPreflight(response);
      if (!value) throw new Error('COPY_PREFLIGHT_SHAPE_MISSING');
      setPreflight(value);
      setReferenceMappingsSnapshot(value.referenceMappings);
      lifecycle.setDirty(true);
    } catch (error) {
      setProblem(
        error instanceof Error && error.message === 'COPY_PREFLIGHT_SHAPE_MISSING'
          ? '本库复制检查影响返回不完整，请重试。'
          : catalogUiProblemFeedback(error, '复制检查未完成，请稍后重试。').message,
      );
    } finally {
      setPreflightPending(false);
      lifecycle.setSubmitting(false);
    }
  };

  const expectedVersions = (value: LocalCopyPreflightData) => {
    // Local preflight returns one version row for the selected source object;
    // that row carries both the source and current-target versions.
    const versionRow = value.objectVersions.find(row => row.code === selectedSourceItemCode) ?? value.objectVersions[0];
    if (!versionRow) throw new Error('COPY_PREFLIGHT_VERSIONS_MISSING');
    return {expectedSourceVersion: versionRow.sourceVersion, expectedTargetVersion: versionRow.targetVersion};
  };

  const execute = async () => {
    if (!preflight || !selectedSourceItemCode || preflight.blockingCount > 0 || !allConfirmationsHandled) return;
    if (lifecycle.submitting) return;
    lifecycle.setSubmitting(true);
    try {
      setProblem(undefined);
      const versions = expectedVersions(preflight);
      const dataNodeRef = requireOperationsScopeRef(queryContext);
      const body = {
        dataNodeRef,
        sourceItemCode: selectedSourceItemCode,
        targetItemCode,
        selectedSections,
        preflightDigest: preflight.preflightDigest,
        ...versions,
        compatibilityDispositions: confirmedCompatibilityKeys.map(compatibilityId => ({
          compatibilityId,
          disposition: 'CONFIRM' as const,
        })),
      };
      const idempotencyKey = await createContentIdempotencyKey(
        CATALOG_INVENTORY_OPERATION_IDS.executeOperationsLocalCatalogCopy,
        body,
      );
      const response = await executeCopy(
        catalogInventoryRtkRequest.executeOperationsLocalCatalogCopy(
          {},
          {
            headers: {...(headers ?? {}), 'Idempotency-Key': idempotencyKey},
            body,
          },
        ),
      ).unwrap();
      const value = decodeLocalCopyReadback(response);
      if (!value) throw new Error('COPY_READBACK_SHAPE_MISSING');
      resetLifecyclePreservingOpen();
      setReadback(value);
      // Keep the preview/readback open. The caller only closes after the user
      // explicitly acknowledges the owner result.
    } catch (error) {
      const feedback = operationsProblemOf(error);
      const errorCode = feedback.errorCode as string;
      if (error instanceof Error && error.message === 'COPY_PREFLIGHT_VERSIONS_MISSING') {
        setProblem('检查影响资料不完整，请重新检查。');
        return;
      }
      if (error instanceof Error && error.message === 'COPY_READBACK_SHAPE_MISSING') {
        setProblem('复制已提交，但结果暂未完整返回。请保留当前页面后重试。');
        return;
      }
      setProblem(catalogUiProblemFeedback(error, '复制未完成，请重新检查后再试。').message);
      if (errorCode === 'STALE_COPY_PREFLIGHT') {
        // Keep the safe source/scope/mapping choices. Only the digest-bound
        // preflight is discarded; the user can regenerate it from this point.
        setPreflight(undefined);
        setReadback(undefined);
        setConfirmedCompatibilityKeys([]);
        setStale(true);
        setStep('bom-mapping');
      }
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  const candidateLoading = candidatesQuery.isLoading || (candidatesQuery.isFetching && !candidateState.items.length);
  const stepIndex = LOCAL_COPY_STEPS.findIndex(({key}) => key === step);
  const sourceScope = candidatePage?.sourceScope;
  const targetScope = candidatePage?.targetScope;
  const selectedSource = candidates.find(item => item.code === selectedSourceItemCode);

  return {
    open,
    onClose,
    lifecycle,
    afterOpenChange: handleAfterOpenChange,
    step,
    stepIndex,
    problem,
    targetItemName,
    sourceScope,
    targetScope,
    manifest,
    manifestQuery,
    candidates,
    selectedSource,
    selectedSourceItemCode,
    sourceKeyword,
    candidateLoading,
    candidateState,
    candidatesQuery,
    selectedSections,
    preflight,
    readback,
    referenceMappingsSnapshot,
    stale,
    preflightPending,
    localCopyScopeOptions,
    confirmationRows,
    confirmationCountMatches,
    allConfirmationsHandled,
    confirmedCompatibilityKeys,
    executeState,
    setStep,
    setSourceKeyword,
    setSelectedSourceItemCode,
    setSelectedSections,
    setPreflight,
    setReadback,
    setReferenceMappingsSnapshot,
    setStale,
    setConfirmedCompatibilityKeys,
    runPreflight,
    execute,
  };
}

export type LocalCatalogCopyViewModel = ReturnType<typeof useLocalCatalogCopyController>;

export function LocalCatalogCopyDrawer(props: Props) {
  return <LocalCatalogCopyView viewModel={useLocalCatalogCopyController(props)} />;
}
