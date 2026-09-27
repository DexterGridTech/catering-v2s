import {PlusOutlined} from '@ant-design/icons';
import {Alert, Button, Card, Empty, Form, List, Skeleton, Space, Tag, Typography} from 'antd';
import {
  CursorPagination,
  StatusChangeConfirm,
  adminListState,
  lifecycleColor,
  testId,
  useDrawerFormLifecycle,
  useSubmissionLifecycle,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {operationsLogger, operationsProblemOf, type ApiProblem} from '../../../app/api/OperationsTransport';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type StoreTerminalDetail,
  type StoreTerminalStatus,
} from '../../../app/api/generated/operations-edge';
import {ACTION_CAPABILITIES} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageProps} from '../../../app/routing/model';
import {changeStoreTerminalStatus, createStoreTerminal, replaceStoreTerminal} from '../model/storeTerminalCommands';
import {
  nextTerminalRefAfterVoid,
  newTerminalCreateFormValues,
  resolveTerminalSelection,
  terminalFormValuesFromDetail,
  storeTerminalDeviceTypeLabels,
  storeTerminalStatusLabels,
  type StoreTerminalCreateFormValues,
  type StoreTerminalEditFormValues,
  type StoreTerminalEditor,
} from '../model/storeTerminalModel';
import {useStoreTerminalReadModel} from '../model/useStoreTerminalReadModel';
import {storeTerminalTestIds} from '../storeTerminalTestIds';
import {StoreTerminalDetail as StoreTerminalDetailView} from './StoreTerminalDetail';
import {TerminalCreateDrawer} from './TerminalCreateDrawer';
import {TerminalEditDrawer} from './TerminalEditDrawer';

type StatusRequest = {terminal: StoreTerminalDetail; status: StoreTerminalStatus; contextKey: string};
type StatusMutationAttempt = {
  terminal: StoreTerminalDetail;
  status: StoreTerminalStatus;
  contextKey: string;
};
type LocalDrawerNotice = {title: string; detail: string};
type TerminalMutationAttempt =
  {mode: 'create'; values: StoreTerminalCreateFormValues} | {mode: 'edit'; values: StoreTerminalEditFormValues};

function problemText(error: unknown, fallback: string) {
  return operationsProblemOf(error).detail || fallback;
}

function clientFailureCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return typeof error;
  if (/^(WIRE_|OPERATIONS_)[A-Z0-9_]+$/.test(error.message)) return error.message;
  return error.name;
}

export function StoreTerminalPage({queryContext, actionCapabilityKeys}: OperationsPageProps) {
  const canEdit = actionCapabilityKeys.includes(ACTION_CAPABILITIES.EDIT_STORE_TERMINAL);
  const scopeReady = Boolean(queryContext.scopeRef);
  const contextKey = `${queryContext.groupWorkspaceKey}:${queryContext.scopeRef ?? ''}`;
  const [selectedTerminalRef, setSelectedTerminalRef] = useState<string>();
  const [selectionIntentRef, setSelectionIntentRef] = useState<string>();
  const [editor, setEditor] = useState<StoreTerminalEditor>();
  const [editorConfigurationOpen, setEditorConfigurationOpen] = useState(false);
  const [drawerProblem, setDrawerProblem] = useState<ApiProblem>();
  const [drawerNotice, setDrawerNotice] = useState<LocalDrawerNotice>();
  const [statusRequest, setStatusRequest] = useState<StatusRequest>();
  const [statusProblem, setStatusProblem] = useState<string>();
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusRequiresRefresh, setStatusRequiresRefresh] = useState(false);
  const [editorRequiresReopen, setEditorRequiresReopen] = useState(false);
  const [editorContextStale, setEditorContextStale] = useState(false);
  const previousContextKey = useRef(contextKey);
  const formEditorIdentity = useRef<string | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);
  const statusTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [contentWidth, setContentWidth] = useState<number>();
  const createForm = Form.useForm<StoreTerminalCreateFormValues>()[0];
  const editForm = Form.useForm<StoreTerminalEditFormValues>()[0];
  const drawerLifecycle = useDrawerFormLifecycle({
    open: Boolean(editor),
    onOpenChange: next => {
      if (!next) {
        setEditor(undefined);
        setEditorConfigurationOpen(false);
        setEditorRequiresReopen(false);
        setEditorContextStale(false);
      }
    },
    dirtyMessage: '已修改的终端资料不会保存。',
    dirtyGuardTestIds: {
      confirm: testId(storeTerminalTestIds.dirtyGuardConfirm),
      cancel: testId(storeTerminalTestIds.dirtyGuardCancel),
    },
    idempotencyKey: true,
    diagnosticOperationId:
      editor?.mode === 'edit'
        ? OPERATIONS_ADMIN_OPERATION_IDS.putOperationsStoreTerminal
        : OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreTerminal,
  });
  const statusLifecycle = useSubmissionLifecycle();
  useOverlayLock(Boolean(statusRequest));
  const statusAfterOpenChange = useCallback((visible: boolean) => {
    if (!visible && statusTriggerRef.current) {
      const trigger = statusTriggerRef.current;
      window.requestAnimationFrame(() => {
        trigger.focus();
        if (statusTriggerRef.current === trigger) statusTriggerRef.current = null;
      });
    }
  }, []);
  const openEditorConfiguration = useCallback(() => setEditorConfigurationOpen(true), []);
  const read = useStoreTerminalReadModel({
    queryContext,
    gateReady: true,
    selectedTerminalRef,
    editorOpen: Boolean(editor) && (editor?.mode === 'edit' || editorConfigurationOpen),
  });

  useEffect(() => {
    if (previousContextKey.current === contextKey) return;
    previousContextKey.current = contextKey;

    // A store/workspace context is part of the owner of every draft and
    // selection. Never let an old drawer or status confirmation submit under
    // the newly selected scope. Context changes normally arrive only after
    // the shared dirty lock has allowed them; if an external context update
    // races with an open drawer, route the discard through the same foundation
    // guard instead of creating a feature-local confirmation.
    setSelectedTerminalRef(undefined);
    setSelectionIntentRef(undefined);
    setStatusRequest(undefined);
    setStatusProblem(undefined);
    setStatusRequiresRefresh(false);
    statusLifecycle.reset();
    read.setAreaQueryText('');
    read.setTagQueryText('');

    const discardEditor = () => {
      setEditor(undefined);
      setEditorConfigurationOpen(false);
      setDrawerProblem(undefined);
      setDrawerNotice(undefined);
      setEditorRequiresReopen(false);
      setEditorContextStale(false);
      drawerLifecycle.reset();
    };
    if (editor) {
      setEditorContextStale(true);
      setDrawerNotice({
        title: '门店上下文已变化',
        detail: '当前编辑资料属于之前的门店，请关闭后重新选择门店并编辑。',
      });
      drawerLifecycle.requestDiscard(discardEditor);
    } else discardEditor();
  }, [contextKey, drawerLifecycle, editor, read, statusLifecycle]);

  useEffect(() => {
    if (!scopeReady) {
      setSelectedTerminalRef(undefined);
      setSelectionIntentRef(undefined);
      return;
    }
    const resolved = resolveTerminalSelection(read.terminals, selectedTerminalRef, selectionIntentRef);
    if (resolved.selectedRef !== selectedTerminalRef) setSelectedTerminalRef(resolved.selectedRef);
    if (resolved.pendingRef !== selectionIntentRef) setSelectionIntentRef(resolved.pendingRef);
  }, [read.terminals, scopeReady, selectedTerminalRef, selectionIntentRef]);

  useEffect(() => {
    if (!editor) {
      createForm.resetFields();
      editForm.resetFields();
      formEditorIdentity.current = undefined;
      return;
    }
    const identity = `${editor.mode}:${editor.terminal ? String(editor.terminal.terminalRef) : 'new'}`;
    if (formEditorIdentity.current === identity) return;
    if (editor.mode === 'create') {
      createForm.setFieldsValue(newTerminalCreateFormValues());
    } else {
      editForm.setFieldsValue(terminalFormValuesFromDetail(editor.terminal));
    }
    formEditorIdentity.current = identity;
  }, [createForm, editForm, editor]);

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;
    const measure = () => {
      const width = element.getBoundingClientRect().width;
      if (width > 0) setContentWidth(width);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [scopeReady]);

  const selectedSummary = useMemo(
    () => read.terminals.find(item => String(item.terminalRef) === selectedTerminalRef),
    [read.terminals, selectedTerminalRef],
  );

  const refreshEditorDetail = async () => {
    const result = await read.refetchDetail();
    const refreshed = result.data;
    if (!refreshed) return;
    // Keep the draft and its original expected version together.  Reading a
    // newer snapshot must not silently make that old draft writable with the
    // newer version; the user must close and reopen the editor explicitly.
    setEditorRequiresReopen(true);
    setDrawerNotice({
      title: '终端资料已变化',
      detail: '已读取最新资料，请取消当前草稿后重新打开编辑。',
    });
  };

  const runMutation = async (attempt: TerminalMutationAttempt) => {
    if (!queryContext.scopeRef || !editor || editor.contextKey !== contextKey || editor.mode !== attempt.mode) return;
    if (editorRequiresReopen || editorContextStale) return;
    setDrawerProblem(undefined);
    setDrawerNotice(undefined);
    drawerLifecycle.setSubmitting(true);
    const operationId =
      attempt.mode === 'create'
        ? OPERATIONS_ADMIN_OPERATION_IDS.postOperationsStoreTerminal
        : OPERATIONS_ADMIN_OPERATION_IDS.putOperationsStoreTerminal;
    operationsLogger.info({
      event: 'frontend.store_terminal.mutation.started',
      phase: 'mutation',
      outcome: 'STARTED',
      operationId,
      diagnostic: {
        mode: attempt.mode,
        printerCount: attempt.values.printers.length,
        functionCount: attempt.values.functions.length,
        incompletePrinterRows: attempt.values.printers.filter(
          printer =>
            !printer || !printer.clientKey || !printer.name || !printer.modelKey || !printer.connectionMethodKey,
        ).length,
        incompleteFunctionRows: attempt.values.functions.filter(
          fn => !fn || !fn.clientKey || !fn.functionKey || !fn.scenes || !Array.isArray(fn.selectedRangeKeys),
        ).length,
        functionRowShapes: JSON.stringify(
          attempt.values.functions.map(fn => ({
            present: Boolean(fn),
            hasClientKey: Boolean(fn?.clientKey),
            hasFunctionKey: Boolean(fn?.functionKey),
            hasScenes: Boolean(fn?.scenes),
            hasRangeArray: Array.isArray(fn?.selectedRangeKeys),
          })),
        ),
      },
    });
    let succeeded = false;
    try {
      const context = {
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        storeRef: String(queryContext.scopeRef),
      };
      let result: Pick<StoreTerminalDetail, 'terminalRef'> | undefined;
      if (attempt.mode === 'create') {
        if (editor.mode !== 'create') return;
        result = await createStoreTerminal(context, attempt.values, drawerLifecycle.getIdempotencyKey());
      } else {
        if (editor.mode !== 'edit') return;
        result = await replaceStoreTerminal(context, editor.terminal, attempt.values);
      }
      if (!result) {
        drawerLifecycle.setSubmitting(false);
        operationsLogger.warn({
          event: 'frontend.store_terminal.mutation.empty_result',
          phase: 'mutation',
          outcome: 'EMPTY_RESULT',
          operationId,
        });
        return;
      }
      operationsLogger.info({
        event: 'frontend.store_terminal.mutation.succeeded',
        phase: 'mutation',
        outcome: 'SUCCEEDED',
        operationId,
      });
      setSelectionIntentRef(String(result.terminalRef));
      succeeded = true;
      drawerLifecycle.closeAfterSuccess();
      await read.refetchTerminals();
      await read.refetchDetail();
    } catch (error) {
      const problem = operationsProblemOf(error);
      if (problem.errorCode === 'PLATFORM_COMMON_VERSION_CONFLICT') {
        setEditorRequiresReopen(true);
      }
      // Edit and automatic-create requests use a content-derived key, so
      // submitting the same form replays the same command. Keep the server
      // problem intact and avoid a feature-local recovery state machine.
      setDrawerProblem(problem);
      operationsLogger.error({
        event: 'frontend.store_terminal.mutation.failed',
        phase: 'mutation',
        outcome: 'ERROR',
        operationId,
        errorCode: problem.errorCode,
        status: problem.status,
        diagnostic: {
          failureSource: error instanceof Error && error.name === 'ApiFailure' ? 'api' : 'client',
          clientFailureCode: clientFailureCode(error) ?? 'UNKNOWN',
          clientFailureMessage: error instanceof Error ? error.message.slice(0, 160) : 'NON_ERROR_THROWABLE',
          clientFailureStack:
            error instanceof Error ? (error.stack ?? '').replace(/\s+/g, ' ').slice(0, 320) : 'NON_ERROR_THROWABLE',
        },
      });
      drawerLifecycle.setSubmitting(false);
    } finally {
      if (!succeeded) drawerLifecycle.setSubmitting(false);
    }
  };

  const completeStatusMutation = async (attempt: StatusMutationAttempt) => {
    setStatusRequest(undefined);
    setStatusRequiresRefresh(false);
    statusLifecycle.reset();
    const previousTerminalItems = read.terminals;
    const terminalsResult = await read.refetchTerminals();
    if (attempt.status === 'VOIDED') {
      // A voided terminal is no longer part of the operational list.  Do
      // not let the detail query keep the just-voided ref selected after a
      // successful refresh; resolve the next visible item from the fresh
      // list or show the empty detail state.
      setSelectionIntentRef(undefined);
      setSelectedTerminalRef(
        nextTerminalRefAfterVoid(
          previousTerminalItems,
          terminalsResult.data?.items ?? [],
          String(attempt.terminal.terminalRef),
        ),
      );
    } else {
      await read.refetchDetail();
    }
  };

  const confirmStatus = async () => {
    if (
      !statusRequest ||
      statusRequest.contextKey !== contextKey ||
      !queryContext.scopeRef ||
      statusSubmitting ||
      statusRequiresRefresh
    )
      return;
    setStatusSubmitting(true);
    setStatusProblem(undefined);
    const attempt: StatusMutationAttempt = {
      terminal: statusRequest.terminal,
      status: statusRequest.status,
      contextKey,
    };
    operationsLogger.info({
      event: 'frontend.store_terminal.status_mutation.started',
      phase: 'status.mutation',
      outcome: 'STARTED',
      diagnostic: {requestedStatus: attempt.status},
    });
    try {
      await changeStoreTerminalStatus(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: String(queryContext.scopeRef)},
        attempt.terminal,
        attempt.status,
      );
      await completeStatusMutation(attempt);
      operationsLogger.info({
        event: 'frontend.store_terminal.status_mutation.succeeded',
        phase: 'status.mutation',
        outcome: 'SUCCEEDED',
        diagnostic: {requestedStatus: attempt.status},
      });
    } catch (error) {
      const problem = operationsProblemOf(error);
      operationsLogger.error({
        event: 'frontend.store_terminal.status_mutation.failed',
        phase: 'status.mutation',
        outcome: 'ERROR',
        errorCode: problem.errorCode,
        status: problem.status,
        diagnostic: {requestedStatus: attempt.status},
      });
      if (problem.errorCode === 'PLATFORM_COMMON_RESULT_UNKNOWN') {
        setStatusProblem('操作结果待确认，请再次点击确认以重放原操作。');
      } else {
        setStatusRequiresRefresh(true);
        let refreshed = true;
        try {
          await read.refetchDetail();
        } catch {
          refreshed = false;
        }
        // Do not leave the modal's old expectedVersion executable after a
        // failed request.  The user must cancel and reopen from the refreshed
        // detail, so a stale status command cannot be sent again.
        setStatusProblem(
          `${problemText(error, '终端状态操作失败，请重试。')} ${
            refreshed ? '请取消后从最新详情重新操作。' : '详情重读失败，请取消后重新读取详情。'
          }`,
        );
      }
    } finally {
      setStatusSubmitting(false);
    }
  };

  const content = !scopeReady ? (
    <Alert type="info" showIcon title="请先选择门店数据节点。" />
  ) : (
    <div
      ref={contentRef}
      style={{
        display: 'grid',
        gridTemplateColumns:
          contentWidth !== undefined && contentWidth <= 992 ? '1fr' : 'minmax(220px, 280px) minmax(0, 1fr)',
        gap: 16,
      }}
    >
      <Card
        size="small"
        title="门店终端"
        extra={
          canEdit ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setDrawerProblem(undefined);
                setDrawerNotice(undefined);
                setEditorRequiresReopen(false);
                setEditorContextStale(false);
                setEditorConfigurationOpen(false);
                setEditor({mode: 'create', contextKey});
              }}
              {...testId(storeTerminalTestIds.create)}
            >
              新建终端
            </Button>
          ) : undefined
        }
        {...testId(storeTerminalTestIds.list)}
      >
        {read.terminalsQuery.isFetching && !read.terminalsQuery.currentData ? (
          <Skeleton active paragraph={{rows: 5}} />
        ) : read.terminalsQuery.error ? (
          <Alert
            type="error"
            showIcon
            title="终端列表读取失败"
            action={
              <Button {...testId(storeTerminalTestIds.listRetry)} onClick={() => void read.refetchTerminals()}>
                重试
              </Button>
            }
          />
        ) : read.terminals.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Space direction="vertical" size={4}>
                <Typography.Text>还没有终端</Typography.Text>
                <Typography.Text type="secondary">
                  {canEdit ? '请点击“新建终端”开始配置。' : '请联系有编辑终端权限的管理员创建终端。'}
                </Typography.Text>
              </Space>
            }
          />
        ) : (
          <>
            <List
              size="small"
              {...adminListState({
                loading: read.terminalsQuery.isFetching,
                failed: false,
                emptyText: '暂无终端',
                testIdPrefix: storeTerminalTestIds.list,
              })}
              dataSource={read.terminals}
              renderItem={item => {
                const active = String(item.terminalRef) === selectedTerminalRef;
                return (
                  <List.Item
                    key={String(item.terminalRef)}
                    onClick={() => setSelectedTerminalRef(String(item.terminalRef))}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedTerminalRef(String(item.terminalRef));
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-current={active ? 'true' : undefined}
                    style={{
                      cursor: 'pointer',
                      background: active ? 'var(--ant-color-primary-bg)' : undefined,
                      borderInlineStart: active ? '3px solid var(--ant-color-primary)' : '3px solid transparent',
                      paddingInline: 10,
                    }}
                    {...testId(storeTerminalTestIds.listItem(String(item.terminalRef)))}
                  >
                    <List.Item.Meta
                      title={item.name}
                      description={storeTerminalDeviceTypeLabels[item.deviceType] ?? item.deviceType}
                    />
                    <Tag color={lifecycleColor(item.status)}>{storeTerminalStatusLabels[item.status]}</Tag>
                  </List.Item>
                );
              }}
            />
            <CursorPagination
              state={read.terminalCursor}
              nextCursor={read.terminalsQuery.currentData?.nextCursor ?? undefined}
              testIdPrefix={storeTerminalTestIds.pagination}
              style={{marginTop: 12}}
            />
          </>
        )}
      </Card>
      <Card size="small" title={selectedSummary?.name ?? read.detail?.name ?? '终端详情'}>
        {read.detailQuery.isFetching && !read.detail ? (
          <Skeleton active paragraph={{rows: 8}} />
        ) : read.detailQuery.error ? (
          <Alert
            type="error"
            showIcon
            title="终端详情读取失败"
            action={
              <Button {...testId(storeTerminalTestIds.detailRetry)} onClick={() => void read.refetchDetail()}>
                重试
              </Button>
            }
          />
        ) : (
          <StoreTerminalDetailView
            value={read.detail}
            emptyDescription={read.terminals.length === 0 ? '创建后，在这里查看详情' : '请选择终端'}
            canEdit={canEdit}
            statusTriggerRef={statusTriggerRef}
            onEdit={() => {
              if (read.detail) {
                setDrawerProblem(undefined);
                setDrawerNotice(undefined);
                setEditorRequiresReopen(false);
                setEditorContextStale(false);
                setEditorConfigurationOpen(true);
                setEditor({mode: 'edit', terminal: read.detail, contextKey});
              }
            }}
            onStatus={(status, trigger) => {
              if (!read.detail) return;
              if (trigger) statusTriggerRef.current = trigger;
              setStatusProblem(undefined);
              setStatusRequiresRefresh(false);
              statusLifecycle.reset();
              setStatusRequest({terminal: read.detail, status, contextKey});
            }}
          />
        )}
      </Card>
    </div>
  );

  const drawerSharedProps = {
    onConfigurationOpen: openEditorConfiguration,
    lifecycle: drawerLifecycle,
    areaCandidates: read.areaCandidates,
    tagCandidates: read.tagCandidates,
    areasLoading: read.areaCandidatesQuery.isFetching,
    tagsLoading: read.tagCandidatesQuery.isFetching,
    areaCandidateError: read.areaCandidatesQuery.error,
    tagCandidateError: read.tagCandidatesQuery.error,
    onRetryAreaCandidates: () => void read.areaCandidatesQuery.refetch(),
    onRetryTagCandidates: () => void read.tagCandidatesQuery.refetch(),
    problem: drawerProblem,
    notice: drawerNotice,
    onClearProblem: () => {
      if (!editorRequiresReopen && !editorContextStale) {
        setDrawerProblem(undefined);
        setDrawerNotice(undefined);
      }
    },
    onRefreshDetail: () => void refreshEditorDetail(),
    saveDisabled: editorRequiresReopen || editorContextStale,
    candidateCacheKey: contextKey,
    areaQueryText: read.areaQueryText,
    tagQueryText: read.tagQueryText,
    onAreaQueryTextChange: read.setAreaQueryText,
    onTagQueryTextChange: read.setTagQueryText,
    onValuesChange: () => {
      if (!editorRequiresReopen && !editorContextStale) {
        setDrawerProblem(undefined);
        setDrawerNotice(undefined);
      }
      drawerLifecycle.setDirty(true);
      drawerLifecycle.markBusinessIntentChanged();
    },
  };

  return (
    <div {...testId(storeTerminalTestIds.page)} data-scope-ref={queryContext.scopeRef}>
      <Space direction="vertical" size={16} style={{display: 'flex'}}>
        {!canEdit && scopeReady && <Alert type="info" showIcon title="当前角色没有编辑终端的权限，页面仅供查看。" />}
        {content}
      </Space>

      <TerminalCreateDrawer
        {...drawerSharedProps}
        editor={editor?.mode === 'create' ? editor : undefined}
        form={createForm}
        onFinish={values => void runMutation({mode: 'create', values})}
        onRetry={() => void createForm.submit()}
      />
      <TerminalEditDrawer
        {...drawerSharedProps}
        editor={editor?.mode === 'edit' ? editor : undefined}
        form={editForm}
        onFinish={values => void runMutation({mode: 'edit', values})}
        onRetry={() => void editForm.submit()}
      />

      <StatusChangeConfirm
        open={Boolean(statusRequest)}
        title={
          statusRequest
            ? `确认${statusRequest.status === 'VOIDED' ? '作废终端' : statusRequest.status === 'ENABLED' ? '启用终端' : '停用终端'}“${statusRequest.terminal.name}”？`
            : '确认状态操作'
        }
        actionLabel={
          statusRequest?.status === 'VOIDED'
            ? '作废终端'
            : statusRequest?.status === 'ENABLED'
              ? '启用终端'
              : '停用终端'
        }
        dangerous={statusRequest?.status === 'VOIDED'}
        submitting={statusSubmitting}
        confirmDisabled={statusRequiresRefresh}
        problem={statusProblem}
        onCancel={() => {
          if (!statusSubmitting) {
            setStatusRequest(undefined);
            setStatusRequiresRefresh(false);
            statusLifecycle.reset();
          }
        }}
        onConfirm={() => void confirmStatus()}
        confirmTestId={storeTerminalTestIds.statusConfirm}
        cancelTestId={storeTerminalTestIds.statusCancel}
        modalTestId={storeTerminalTestIds.statusModal}
        problemTestId={storeTerminalTestIds.statusProblem}
        modalProps={{
          afterOpenChange: statusAfterOpenChange,
        }}
      >
        <p>
          {statusRequest?.status === 'VOIDED'
            ? '作废后终端不再出现在普通列表，且激活码不会再次使用。'
            : '状态变更会保留终端资料，并按当前版本条件提交。'}
        </p>
      </StatusChangeConfirm>
    </div>
  );
}
