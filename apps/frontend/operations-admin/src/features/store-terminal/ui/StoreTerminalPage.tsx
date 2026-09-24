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
import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {operationsProblemOf, type ApiProblem} from '../../../app/api/OperationsTransport';
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
  resolveTerminalSelection,
  terminalFormValuesFromDetail,
  storeTerminalDeviceTypeLabels,
  storeTerminalStatusLabels,
  terminalDraftMatchesFormValues,
  type StoreTerminalEditor,
  type StoreTerminalFormValues,
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
  idempotencyKey: string;
};
type UnknownMutationAttempt = {
  mode: 'create' | 'edit';
  terminalRef?: string;
  expectedVersion?: number;
};

function problemText(error: unknown, fallback: string) {
  return operationsProblemOf(error).detail || fallback;
}

export function StoreTerminalPage({queryContext, actionCapabilityKeys}: OperationsPageProps) {
  const canEdit = actionCapabilityKeys.includes(ACTION_CAPABILITIES.EDIT_STORE_TERMINAL);
  const scopeReady = Boolean(queryContext.scopeRef);
  const contextKey = `${queryContext.groupWorkspaceKey}:${queryContext.scopeRef ?? ''}`;
  const [selectedTerminalRef, setSelectedTerminalRef] = useState<string>();
  const [selectionIntentRef, setSelectionIntentRef] = useState<string>();
  const [editor, setEditor] = useState<StoreTerminalEditor>();
  const [drawerProblem, setDrawerProblem] = useState<ApiProblem>();
  const [statusRequest, setStatusRequest] = useState<StatusRequest>();
  const [statusProblem, setStatusProblem] = useState<string>();
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [statusRequiresRefresh, setStatusRequiresRefresh] = useState(false);
  const [statusResultUnknown, setStatusResultUnknown] = useState(false);
  const [editorRequiresReopen, setEditorRequiresReopen] = useState(false);
  const [editorContextStale, setEditorContextStale] = useState(false);
  const [recoveryPending, setRecoveryPending] = useState(false);
  const previousContextKey = useRef(contextKey);
  const formEditorIdentity = useRef<string | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState<number>();
  const form = Form.useForm<StoreTerminalFormValues>()[0];
  const statusMutationAttempt = useRef<StatusMutationAttempt | undefined>(undefined);
  const unknownMutationAttempt = useRef<UnknownMutationAttempt | undefined>(undefined);
  const drawerLifecycle = useDrawerFormLifecycle({
    open: Boolean(editor),
    onOpenChange: next => {
      if (!next) {
        setEditor(undefined);
        setEditorRequiresReopen(false);
        setEditorContextStale(false);
        setRecoveryPending(false);
        unknownMutationAttempt.current = undefined;
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
  const read = useStoreTerminalReadModel({
    queryContext,
    gateReady: true,
    selectedTerminalRef,
    editorOpen: Boolean(editor),
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
    setStatusResultUnknown(false);
    statusMutationAttempt.current = undefined;
    statusLifecycle.reset();
    read.setAreaQueryText('');
    read.setTagQueryText('');

    const discardEditor = () => {
      setEditor(undefined);
      setDrawerProblem(undefined);
      setEditorRequiresReopen(false);
      setEditorContextStale(false);
      setRecoveryPending(false);
      unknownMutationAttempt.current = undefined;
      drawerLifecycle.reset();
    };
    if (editor) {
      setEditorContextStale(true);
      setDrawerProblem({
        type: 'about:blank',
        title: '门店上下文已变化',
        detail: '当前编辑资料属于之前的门店，请关闭后重新选择门店并编辑。',
        status: 409,
        errorCode: 'PLATFORM_COMMON_VERSION_CONFLICT',
        correlationId: 'frontend-context-change',
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
      form.resetFields();
      formEditorIdentity.current = undefined;
      return;
    }
    const identity = `${editor.mode}:${editor.terminal ? String(editor.terminal.terminalRef) : 'new'}`;
    if (formEditorIdentity.current === identity) return;
    form.setFieldsValue(terminalFormValuesFromDetail(editor.terminal));
    formEditorIdentity.current = identity;
  }, [editor, form]);

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
    setDrawerProblem({
      type: 'about:blank',
      title: '终端资料已变化',
      detail: '已读取最新资料，请取消当前草稿后重新打开编辑。',
      status: 409,
      errorCode: 'PLATFORM_COMMON_VERSION_CONFLICT',
      correlationId: `frontend-readback-${String(refreshed.terminalRef)}`,
    });
  };

  const runMutation = async (values: StoreTerminalFormValues, allowRecoveryRetry = false) => {
    if (!queryContext.scopeRef || !editor || editor.contextKey !== contextKey) return;
    if ((editorRequiresReopen || editorContextStale || recoveryPending) && !allowRecoveryRetry) return;
    setDrawerProblem(undefined);
    drawerLifecycle.setSubmitting(true);
    unknownMutationAttempt.current = {
      mode: editor.mode,
      terminalRef: editor.terminal ? String(editor.terminal.terminalRef) : undefined,
      expectedVersion: editor.terminal?.version,
    };
    let succeeded = false;
    const idempotencyKey = drawerLifecycle.getIdempotencyKey();
    try {
      const result =
        editor.mode === 'create'
          ? await createStoreTerminal(
              {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: String(queryContext.scopeRef)},
              values,
              idempotencyKey,
            )
          : editor.terminal
            ? await replaceStoreTerminal(
                {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: String(queryContext.scopeRef)},
                editor.terminal,
                values,
                idempotencyKey,
              )
            : undefined;
      if (!result) {
        drawerLifecycle.setSubmitting(false);
        return;
      }
      setSelectionIntentRef(String(result.terminalRef));
      unknownMutationAttempt.current = undefined;
      succeeded = true;
      drawerLifecycle.closeAfterSuccess();
      await read.refetchTerminals();
      await read.refetchDetail();
    } catch (error) {
      const problem = operationsProblemOf(error);
      if (problem.errorCode === 'PLATFORM_COMMON_RESULT_UNKNOWN') {
        setRecoveryPending(true);
        setDrawerProblem({
          ...problem,
          title: '操作结果待确认',
          detail: '请先读取原操作结果；结果确认前不能继续编辑。',
        });
      } else {
        unknownMutationAttempt.current = undefined;
        if (String(problem.errorCode) === 'STORE_TERMINAL_VERSION_CONFLICT' || problem.errorCode === 'PLATFORM_COMMON_VERSION_CONFLICT') {
          setEditorRequiresReopen(true);
        }
        setDrawerProblem(problem);
      }
      drawerLifecycle.setSubmitting(false);
    } finally {
      if (!succeeded) drawerLifecycle.setSubmitting(false);
    }
  };

  const recoverUnknownResult = async () => {
    const attempt = unknownMutationAttempt.current;
    const currentEditor = editor;
    if (!attempt || !currentEditor) {
      setRecoveryPending(false);
      await form.submit();
      return;
    }
    try {
      if (attempt.mode === 'create') {
        // A list match is not an authoritative result readback: another
        // operator may have created an indistinguishable terminal. Reusing
        // the original command key makes the owner read/replay its receipt
        // and returns the exact terminal ref without creating a new intent.
        const values = await form.validateFields();
        setRecoveryPending(false);
        await runMutation(values, true);
        return;
      }

      const result = await read.refetchDetail();
      const refreshed = result.data;
      if (
        refreshed &&
        String(refreshed.terminalRef) === attempt.terminalRef &&
        refreshed.version > (attempt.expectedVersion ?? refreshed.version)
      ) {
        const draft = form.getFieldsValue(true) as StoreTerminalFormValues;
        if (terminalDraftMatchesFormValues(refreshed, draft)) {
          unknownMutationAttempt.current = undefined;
          setRecoveryPending(false);
          setSelectionIntentRef(String(refreshed.terminalRef));
          drawerLifecycle.closeAfterSuccess();
          await read.refetchTerminals();
          await read.refetchDetail();
          return;
        }
        unknownMutationAttempt.current = undefined;
        setRecoveryPending(false);
        setEditorRequiresReopen(true);
        setDrawerProblem({
          type: 'about:blank',
          title: '终端资料已变化',
          detail: '最新资料与当前草稿不一致，请取消后重新编辑。',
          status: 409,
          errorCode: 'PLATFORM_COMMON_VERSION_CONFLICT',
          correlationId: 'frontend-readback',
        });
        return;
      }
      // Readback did not observe the write.  Only now replay the unchanged
      // draft with the exact original idempotency key.
      const values = await form.validateFields();
      setRecoveryPending(false);
      await runMutation(values, true);
    } catch (error) {
      if ((error as {errorFields?: unknown})?.errorFields) {
        setRecoveryPending(false);
        return;
      }
      setDrawerProblem({
        ...operationsProblemOf(error),
        title: '操作结果仍待确认',
        detail: '读取原操作结果失败，请重试读取；未确认前不能继续编辑。',
      });
      setRecoveryPending(true);
      drawerLifecycle.setSubmitting(false);
    }
  };

  const completeStatusMutation = async (attempt: StatusMutationAttempt) => {
    statusMutationAttempt.current = undefined;
    setStatusResultUnknown(false);
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

  const recoverUnknownStatus = async () => {
    const attempt = statusMutationAttempt.current;
    if (!attempt || attempt.contextKey !== contextKey || !queryContext.scopeRef) return;
    setStatusSubmitting(true);
    setStatusProblem(undefined);
    try {
      const result = await read.refetchDetail();
      const refreshed = result.data;
      if (!refreshed || String(refreshed.terminalRef) !== String(attempt.terminal.terminalRef)) {
        setStatusProblem('详情读取失败，请再次确认以重试读取。');
        return;
      }
      if (refreshed.status === attempt.status) {
        await completeStatusMutation(attempt);
        return;
      }
      if (refreshed.version !== attempt.terminal.version) {
        statusMutationAttempt.current = undefined;
        setStatusResultUnknown(false);
        setStatusRequiresRefresh(true);
        setStatusProblem('终端资料已变化，请取消后从最新详情重新操作。');
        return;
      }
      // The readback proves that the first request did not change the state;
      // replay the exact same idempotent intent, never manufacture a new key.
      setStatusResultUnknown(false);
      await changeStoreTerminalStatus(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: String(queryContext.scopeRef)},
        attempt.terminal,
        attempt.status,
        attempt.idempotencyKey,
      );
      await completeStatusMutation(attempt);
    } catch (error) {
      const problem = operationsProblemOf(error);
      if (problem.errorCode === 'PLATFORM_COMMON_RESULT_UNKNOWN') {
        setStatusResultUnknown(true);
        setStatusProblem('操作结果仍待确认，请再次确认以读取最新状态。');
      } else {
        statusMutationAttempt.current = undefined;
        setStatusResultUnknown(false);
        setStatusRequiresRefresh(true);
        setStatusProblem(`${problemText(error, '终端状态操作失败，请重试。')} 请取消后从最新详情重新操作。`);
      }
    } finally {
      setStatusSubmitting(false);
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
    if (statusResultUnknown) {
      await recoverUnknownStatus();
      return;
    }
    setStatusSubmitting(true);
    setStatusProblem(undefined);
    const attempt: StatusMutationAttempt = {
      terminal: statusRequest.terminal,
      status: statusRequest.status,
      contextKey,
      idempotencyKey: statusLifecycle.getIdempotencyKey(),
    };
    statusMutationAttempt.current = attempt;
    try {
      await changeStoreTerminalStatus(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeRef: String(queryContext.scopeRef)},
        attempt.terminal,
        attempt.status,
        attempt.idempotencyKey,
      );
      await completeStatusMutation(attempt);
    } catch (error) {
      const problem = operationsProblemOf(error);
      if (problem.errorCode === 'PLATFORM_COMMON_RESULT_UNKNOWN') {
        setStatusResultUnknown(true);
        setStatusProblem('操作结果待确认，请再次确认以读取最新状态。');
      } else {
        statusMutationAttempt.current = undefined;
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
                setEditorRequiresReopen(false);
                setEditorContextStale(false);
                setRecoveryPending(false);
                unknownMutationAttempt.current = undefined;
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
            onEdit={() => {
              if (read.detail) {
                setDrawerProblem(undefined);
                setEditorRequiresReopen(false);
                setEditorContextStale(false);
                setRecoveryPending(false);
                unknownMutationAttempt.current = undefined;
                setEditor({mode: 'edit', terminal: read.detail, contextKey});
              }
            }}
            onStatus={status => {
              if (!read.detail) return;
              setStatusProblem(undefined);
              setStatusRequiresRefresh(false);
              setStatusResultUnknown(false);
              statusLifecycle.reset();
              statusMutationAttempt.current = undefined;
              setStatusRequest({terminal: read.detail, status, contextKey});
            }}
          />
        )}
      </Card>
    </div>
  );

  const drawerProps = {
    editor,
    form,
    lifecycle: drawerLifecycle,
    areaCandidates: read.areaCandidates,
    tagCandidates: read.tagCandidates,
    areasLoading: read.areaCandidatesQuery.isFetching,
    tagsLoading: read.tagCandidatesQuery.isFetching,
    areaCandidateError: read.areaCandidatesQuery.error,
    tagCandidateError: read.tagCandidatesQuery.error,
    onRetryAreaCandidates: () => void read.areaCandidatesQuery.refetch(),
    onRetryTagCandidates: () => void read.tagCandidatesQuery.refetch(),
    onFinish: (values: StoreTerminalFormValues) => void runMutation(values),
    onRetry: () => void recoverUnknownResult(),
    problem: drawerProblem,
    onClearProblem: () => {
      if (!editorRequiresReopen && !editorContextStale && !recoveryPending) setDrawerProblem(undefined);
    },
    onRefreshDetail: () => void refreshEditorDetail(),
    saveDisabled: editorRequiresReopen || editorContextStale,
    recoveryPending,
    candidateCacheKey: contextKey,
    areaQueryText: read.areaQueryText,
    tagQueryText: read.tagQueryText,
    onAreaQueryTextChange: read.setAreaQueryText,
    onTagQueryTextChange: read.setTagQueryText,
    onValuesChange: () => {
      if (!editorRequiresReopen && !editorContextStale && !recoveryPending) setDrawerProblem(undefined);
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

      <TerminalCreateDrawer {...drawerProps} />
      <TerminalEditDrawer {...drawerProps} />

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
            setStatusResultUnknown(false);
            statusMutationAttempt.current = undefined;
            statusLifecycle.reset();
          }
        }}
        onConfirm={() => void confirmStatus()}
        confirmTestId={storeTerminalTestIds.statusConfirm}
        cancelTestId={storeTerminalTestIds.statusCancel}
        modalTestId={storeTerminalTestIds.statusModal}
        problemTestId={storeTerminalTestIds.statusProblem}
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
