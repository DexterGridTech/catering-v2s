import {Alert, Button, Card, Descriptions, Drawer, Space, Table, Tabs, Tag, Tooltip, Typography, message} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {CloseOutlined} from '@ant-design/icons';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  CursorPagination,
  StatusChangeConfirm,
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  adminListState,
  formatCanonicalDateTime,
  LIFECYCLE_LABELS,
  testId,
  useCursorStack,
  useOverlayLock,
  useRefreshVersion,
  useSubmissionLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useRef, useState} from 'react';
import type {HTMLAttributes} from 'react';
import {
  operationsClient,
  operationsContentTabRefreshSignal,
  operationsLogger,
  operationsProblemOf,
} from '../../../app/api/OperationsTransport';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type JsonValue,
  type TerminalUpdateRuleSummary,
  type TerminalUpdateVersionReportItem,
} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageProps} from '../../../app/routing/model';
import {useOrganizationCandidates} from '../../../app/queries/useOrganizationCandidates';
import {terminalUpdateTestIds} from '../../../app/automation/terminalUpdateTestIds';
import {OperationsAuditHistoryModal} from '../../audit-history';
import {idleSecondsToMinutes} from '../model/terminalUpdateDuration';
import {
  terminalUpdateRuleDetailLabel,
  terminalUpdateRuleStoreLabel,
  terminalUpdateRuleTablePresentation,
} from '../model/terminalUpdateLifecyclePresentation';
import {
  terminalUpdateRuleFilters,
  type TerminalUpdateRuleFilterForm,
  type TerminalUpdateRuleFilters,
} from '../model/terminalUpdateRuleFilters';
import {terminalUpdateActualUnknownReasonLabel} from '../model/terminalUpdateActualUnknownReason';
import {remoteControlTestIds} from '../../../app/automation/remoteControlTestIds';
import {RemoteControlWorkspace, type RemoteControlTarget} from '../../remote-control';
import {useRemoteControlLauncher} from '../../remote-control';
import {RuleCreateDrawer} from './RuleCreateDrawer';
import {useTerminalUpdateRules} from '../model/useTerminalUpdateRules';
import {useTerminalUpdateRuleDetail} from '../model/useTerminalUpdateRuleDetail';
import {useTerminalUpdateReports} from '../model/useTerminalUpdateReports';
import {useTerminalUpdateReportDetail} from '../model/useTerminalUpdateReportDetail';
import {
  isTerminalUpdateVersionConflict,
  terminalUpdateStatusActionLabel,
  terminalUpdateStatusAlreadyApplied,
  terminalUpdateStatusConfirmTitle,
} from '../model/terminalUpdateRuleStatus';

const remoteControlErrorDiagnostics = (error: unknown): Record<string, string> => {
  const debugDetails = import.meta.env.DEV || import.meta.env.VITE_FRONTEND_DEBUG_LOGS === 'true';
  if (error instanceof Error) {
    return {
      errorName: error.name,
      ...(debugDetails ? {errorMessage: error.message, errorStack: error.stack ?? ''} : {}),
    };
  }
  return {errorName: typeof error, ...(debugDetails ? {errorMessage: String(error)} : {})};
};

export function ProjectTerminalUpdatePage(props: OperationsPageProps) {
  const projectRef = props.queryContext.scopeRef;
  if (!projectRef) return <Card>请选择项目数据节点。</Card>;
  return <ProjectTerminalUpdateContent {...props} projectRef={projectRef} />;
}

function ProjectTerminalUpdateContent({
  queryContext,
  actionCapabilityKeys,
  projectRef,
}: OperationsPageProps & {projectRef: NonNullable<OperationsPageProps['queryContext']['scopeRef']>}) {
  const writable = actionCapabilityKeys.includes('MANAGE_PROJECT_TERMINAL_VERSION');
  const contextKey = `${queryContext.groupWorkspaceKey}:${projectRef}:${queryContext.expectedContextVersion}`;
  const latestContextKey = useRef(contextKey);
  latestContextKey.current = contextKey;
  const [tab, setTab] = useState('reports');
  const [ruleFilters, setRuleFilters] = useState<TerminalUpdateRuleFilters>({});
  const [appliedReportFilters, setAppliedReportFilters] = useState({
    query: '',
    apk: '',
    js: '',
    runtime: '',
    storeRef: '',
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [remoteControlProblem, setRemoteControlProblem] = useState<string>();
  const [auditOpen, setAuditOpen] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [statusTarget, setStatusTarget] = useState<TerminalUpdateRuleSummary>();
  const [statusIntent, setStatusIntent] = useState<'ENABLED' | 'DISABLED'>();
  const [statusProblem, setStatusProblem] = useState<string>();
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const statusSubmittingRef = useRef(false);
  const statusSubmission = useSubmissionLifecycle();
  const contentTabRefreshVersion = useRefreshVersion(operationsContentTabRefreshSignal);
  const rulePager = useCursorStack({resetKey: `${contextKey}:${JSON.stringify(ruleFilters)}`});
  const reportPager = useCursorStack({resetKey: `${contextKey}:${JSON.stringify(appliedReportFilters)}`});
  const rulesRead = useTerminalUpdateRules({queryContext, projectRef, filters: ruleFilters, cursor: rulePager.cursor});
  const reportsRead = useTerminalUpdateReports({
    queryContext,
    projectRef,
    filters: appliedReportFilters,
    cursor: reportPager.cursor,
  });
  const ruleDetailRead = useTerminalUpdateRuleDetail({queryContext, projectRef});
  const reportDetailRead = useTerminalUpdateReportDetail({queryContext, projectRef});
  const {items: rules, nextCursor: ruleNext, loading: ruleLoading, problem: rulesProblem, load: loadRules} = rulesRead;
  const {
    items: reportRows,
    nextCursor: reportNext,
    loading: reportLoading,
    problem: reportsProblem,
    load: loadReports,
  } = reportsRead;
  const detail = ruleDetailRead.detail;
  const ruleStores = ruleDetailRead.stores;
  const ruleStoresCursor = ruleDetailRead.storesCursor;
  const ruleStorePageLoading = ruleDetailRead.storesLoading;
  const versionDetail = reportDetailRead.detail;
  const history = reportDetailRead.history;
  const historyCursor = reportDetailRead.historyCursor;
  const historyPageLoading = reportDetailRead.historyLoading;
  const reportStores = useOrganizationCandidates({
    open: true,
    queryContext,
    subjectType: 'STORE',
    projectId: projectRef,
    pageSize: 50,
  });
  const canControlRemote = actionCapabilityKeys.includes('CONTROL_PROJECT_TERMINAL');
  const remoteLauncher = useRemoteControlLauncher(contextKey);
  const invalidatePendingStart = remoteLauncher.invalidatePendingStart;
  const remoteWorkspace = remoteLauncher.currentSession;
  const remoteStartLoading = remoteLauncher.isStarting;
  const selectedReadRefs = useRef<{ruleRef?: string; terminalRef?: string}>({});
  selectedReadRefs.current = {ruleRef: ruleDetailRead.ruleRef, terminalRef: reportDetailRead.terminalRef};
  const pageReadProblem =
    problem || rulesProblem || reportsProblem || ruleDetailRead.problem || reportDetailRead.problem;
  useOverlayLock(
    createOpen ||
      Boolean(detail) ||
      Boolean(versionDetail) ||
      Boolean(statusTarget) ||
      auditOpen ||
      Boolean(remoteWorkspace),
  );
  const resetReportFilters = () => {
    const cleared = {query: '', apk: '', js: '', runtime: '', storeRef: ''};
    setAppliedReportFilters(cleared);
    reportPager.reset();
  };

  useEffect(() => {
    invalidatePendingStart();
    setAuditOpen(false);
    setProblem(undefined);
    statusSubmittingRef.current = false;
    setStatusSubmitting(false);
    setStatusTarget(undefined);
    setStatusIntent(undefined);
    setStatusProblem(undefined);
  }, [contextKey, invalidatePendingStart]);

  const openRule = (row: Pick<TerminalUpdateRuleSummary, 'ruleRef'>) => {
    selectedReadRefs.current = {...selectedReadRefs.current, ruleRef: row.ruleRef};
    setProblem(undefined);
    return ruleDetailRead.open(row.ruleRef);
  };

  const closeRule = () => {
    selectedReadRefs.current = {...selectedReadRefs.current, ruleRef: undefined};
    ruleDetailRead.close();
  };

  const changeStatus = async (target: TerminalUpdateRuleSummary, status: 'ENABLED' | 'DISABLED') => {
    if (statusSubmittingRef.current) return;
    statusSubmittingRef.current = true;
    setStatusSubmitting(true);
    setStatusProblem(undefined);
    const requestContextKey = contextKey;
    const requestedRuleRef = target.ruleRef;
    try {
      await operationsClient.changeOperationsProjectTerminalUpdateRuleStatus(
        {
          groupWorkspaceKey: queryContext.groupWorkspaceKey,
          projectRef: wireUuid(projectRef),
          ruleRef: wireUuid(target.ruleRef),
        },
        {
          query: {expectedContextVersion: queryContext.expectedContextVersion},
          body: {revision: target.revision, status},
          headers: {'Idempotency-Key': statusSubmission.getIdempotencyKey()},
        },
      );
      if (latestContextKey.current !== requestContextKey) return;
      setStatusTarget(undefined);
      setStatusIntent(undefined);
      statusSubmission.reset();
      await loadRules();
      if (latestContextKey.current === requestContextKey && selectedReadRefs.current.ruleRef === requestedRuleRef)
        await ruleDetailRead.open(requestedRuleRef);
      if (latestContextKey.current === requestContextKey)
        message.success(status === 'ENABLED' ? '规则已启用' : '规则已停用');
    } catch (error) {
      if (latestContextKey.current === requestContextKey) {
        const failure = operationsProblemOf(error);
        if (
          isTerminalUpdateVersionConflict(failure) &&
          statusIntent !== undefined &&
          selectedReadRefs.current.ruleRef === requestedRuleRef
        ) {
          const latest = await ruleDetailRead.open(requestedRuleRef);
          if (
            latestContextKey.current === requestContextKey &&
            selectedReadRefs.current.ruleRef === requestedRuleRef &&
            latest
          ) {
            statusSubmission.reset();
            if (terminalUpdateStatusAlreadyApplied(latest.status, statusIntent)) {
              setStatusTarget(undefined);
              setStatusIntent(undefined);
              setStatusProblem(undefined);
              message.info(`规则已被其他操作${terminalUpdateStatusActionLabel(statusIntent)}。`);
            } else {
              setStatusTarget(latest);
              setStatusProblem('规则已被其他操作修改。已读取当前状态，请核对后再次确认。');
            }
          } else if (
            latestContextKey.current === requestContextKey &&
            selectedReadRefs.current.ruleRef === requestedRuleRef
          ) {
            setStatusProblem(ruleDetailRead.problem || '状态冲突后读取当前规则失败，请关闭并刷新。');
          }
        } else {
          setStatusProblem(failure.detail || '规则状态更新失败');
        }
      }
    } finally {
      if (latestContextKey.current === requestContextKey) {
        statusSubmittingRef.current = false;
        setStatusSubmitting(false);
      }
    }
  };

  const openVersion = (row: Pick<TerminalUpdateVersionReportItem, 'terminalRef'>) => {
    selectedReadRefs.current = {...selectedReadRefs.current, terminalRef: row.terminalRef};
    setRemoteControlProblem(undefined);
    setProblem(undefined);
    return reportDetailRead.open(row.terminalRef);
  };

  const closeVersionDrawer = () => {
    selectedReadRefs.current = {...selectedReadRefs.current, terminalRef: undefined};
    invalidatePendingStart();
    reportDetailRead.close();
    setRemoteControlProblem(undefined);
  };

  const startRemoteFromDrawer = async () => {
    const current = versionDetail;
    if (!canControlRemote || !current || current.connectionStatus !== 'ONLINE' || remoteLauncher.isStarting) return;
    setRemoteControlProblem(undefined);
    const requestedContextKey = contextKey;
    const requestedTerminalRef = current.terminalRef;
    const target: RemoteControlTarget = {
      groupWorkspaceKey: queryContext.groupWorkspaceKey,
      projectRef,
      terminalRef: current.terminalRef,
      terminalName: current.terminalName,
      storeName: current.storeName,
      expectedContextVersion: queryContext.expectedContextVersion,
      contextKey: requestedContextKey,
    };
    try {
      const session = await remoteLauncher.start(
        target,
        () =>
          latestContextKey.current === requestedContextKey &&
          selectedReadRefs.current.terminalRef === requestedTerminalRef,
      );
      if (session && latestContextKey.current === requestedContextKey) closeVersionDrawer();
    } catch (error) {
      if (
        latestContextKey.current === requestedContextKey &&
        selectedReadRefs.current.terminalRef === requestedTerminalRef
      ) {
        const failure = operationsProblemOf(error);
        setRemoteControlProblem(failure.detail || '远程控制发起失败，请核对终端状态后重试。');
        operationsLogger.error({
          event: 'frontend.remote_control.start_failed',
          phase: 'remote_control',
          outcome: 'ERROR',
          operationId: OPERATIONS_ADMIN_OPERATION_IDS.startOperationsTerminalRemoteControl,
          errorCode: failure.errorCode,
          status: failure.status,
          diagnostic: {terminalRef: requestedTerminalRef, ...remoteControlErrorDiagnostics(error)},
        });
      }
    }
  };

  const closeRemoteWorkspace = (
    target: RemoteControlTarget,
    sessionId: string,
    result: {endFailed: boolean; cleanupFailed: boolean},
  ) => {
    remoteLauncher.clear(sessionId);
    if (result.endFailed) message.error('远程会话结束请求失败，终端占用状态需要刷新核对。');
    if (result.cleanupFailed) message.error('浏览器媒体连接未能完整释放，请检查本次远控日志。');
    requestAnimationFrame(() => {
      const testIdValue =
        latestContextKey.current === target.contextKey
          ? terminalUpdateTestIds.reportOpen(target.terminalRef)
          : terminalUpdateTestIds.reportQuerySubmit;
      document.querySelector<HTMLElement>(`[data-testid="${testIdValue}"]`)?.focus();
    });
  };

  const historyPaginationState = reportDetailRead.pagination;
  const ruleStoresPaginationState = ruleDetailRead.pagination;
  const refreshCallbacks = useRef({
    loadRules,
    loadReports,
    refreshRule: ruleDetailRead.refresh,
    refreshReport: reportDetailRead.refresh,
  });
  refreshCallbacks.current = {
    loadRules,
    loadReports,
    refreshRule: ruleDetailRead.refresh,
    refreshReport: reportDetailRead.refresh,
  };
  useEffect(() => {
    if (contentTabRefreshVersion === 0) return;
    void refreshCallbacks.current.loadRules();
    void refreshCallbacks.current.loadReports();
    if (selectedReadRefs.current.ruleRef) void refreshCallbacks.current.refreshRule();
    if (selectedReadRefs.current.terminalRef) void refreshCallbacks.current.refreshReport();
  }, [contentTabRefreshVersion]);

  const ruleColumns: ProColumns<TerminalUpdateRuleSummary>[] = [
    {
      title: '更新目标',
      dataIndex: 'targetMode',
      search: false,
      render: (_, row) => (
        <Button type="link" onClick={() => void openRule(row)} {...testId(terminalUpdateTestIds.ruleOpen(row.ruleRef))}>
          {ruleTargetLines(row)}
        </Button>
      ),
    },
    {
      title: '应用包名',
      dataIndex: 'applicationId',
      hideInTable: true,
      fieldProps: testId(terminalUpdateTestIds.ruleApplicationFilter),
    },
    {
      title: '创建日期',
      dataIndex: 'createdRange',
      hideInTable: true,
      valueType: 'dateRange',
      fieldProps: testId(terminalUpdateTestIds.ruleCreatedRangeFilter),
    },
    {
      title: '门店范围',
      dataIndex: 'targetMode',
      search: false,
      render: (_, row) => (row.targetMode === 'ALL' ? '项目全部门店' : '指定门店'),
    },
    {
      title: '安装提醒间隔',
      dataIndex: 'nSeconds',
      search: false,
      render: (_, row) => `${Math.floor(row.nSeconds / 60)} 分钟`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: {ENABLED: LIFECYCLE_LABELS.ENABLED, DISABLED: LIFECYCLE_LABELS.DISABLED},
      fieldProps: {...testId(terminalUpdateTestIds.ruleStatusFilter), allowClear: true},
      render: (_, row) => {
        const presentation = terminalUpdateRuleTablePresentation(row.status);
        return <Tag color={presentation.color}>{presentation.label}</Tag>;
      },
    },
    {
      title: '创建时间',
      dataIndex: 'createdAtEpochMillis',
      search: false,
      render: (_, row) => formatCanonicalDateTime(row.createdAtEpochMillis),
    },
  ];
  const reportColumns: ProColumns<TerminalUpdateVersionReportItem>[] = [
    {
      title: '终端',
      dataIndex: 'queryText',
      fieldProps: testId(terminalUpdateTestIds.reportQuery),
      render: (_, row) => (
        <Button
          type="link"
          onClick={() => void openVersion(row)}
          {...testId(terminalUpdateTestIds.reportOpen(row.terminalRef))}
        >
          {row.terminalName}
        </Button>
      ),
    },
    {
      title: '连接状态',
      dataIndex: 'connectionStatus',
      search: false,
      render: (_, row) => (
        <Tag
          color={
            row.connectionStatus === 'ONLINE' ? 'success' : row.connectionStatus === 'OFFLINE' ? 'warning' : 'default'
          }
          {...testId(remoteControlTestIds.onlineStatus(row.terminalRef))}
        >
          {row.connectionStatus === 'ONLINE' ? '在线' : row.connectionStatus === 'OFFLINE' ? '离线' : '未激活'}
        </Tag>
      ),
    },
    {
      title: '门店',
      dataIndex: 'storeRef',
      valueType: 'select',
      fieldProps: {
        showSearch: true,
        filterOption: false,
        onSearch: reportStores.setStoreSearch,
        onPopupScroll: reportStores.onPopupScroll,
        loading: reportStores.isFetching,
        notFoundContent: reportStores.isFetching
          ? '正在加载门店…'
          : reportStores.error
            ? '门店读取失败，请刷新页面后重试'
            : '暂无匹配门店',
        options: reportStores.items.map(item => ({value: item.id, label: `${item.name} · ${item.code}`})),
        ...testId(terminalUpdateTestIds.reportStore),
      },
      render: (_, row) => row.storeName,
    },
    {
      title: '最新升级报告状态',
      dataIndex: 'recentState',
      search: false,
      render: (_, row) => (
        <Space>
          {!row.hasReport
            ? '尚无报告'
            : row.recent
              ? reportStateLabel(jsonString(row.recent, 'state'))
              : '已上报，暂无任务报告'}
          {row.oldBinding && <Tag>上次绑定报告</Tag>}
        </Space>
      ),
    },
    {
      title: '接收时间',
      dataIndex: 'receivedAtEpochMillis',
      search: false,
      render: (_, row) =>
        row.receivedAtEpochMillis === null ? '—' : formatCanonicalDateTime(row.receivedAtEpochMillis),
    },
    {
      title: '实际 APK',
      dataIndex: 'currentApkVersion',
      fieldProps: testId(terminalUpdateTestIds.reportApk),
      render: (_, row) => (row.actual ? String(row.actual.apkVersion ?? '未知') : '—'),
    },
    {
      title: '实际 applicationId',
      search: false,
      width: 260,
      ellipsis: true,
      render: (_, row) => (row.actual ? (jsonString(row.actual, 'applicationId') ?? '未知') : '—'),
    },
    {
      title: '实际 JS',
      dataIndex: 'currentJsVersion',
      fieldProps: testId(terminalUpdateTestIds.reportJs),
      render: (_, row) => (row.actual ? String(row.actual.jsVersion ?? '未知') : '—'),
    },
    {
      title: 'Runtime',
      dataIndex: 'runtimeVersion',
      fieldProps: testId(terminalUpdateTestIds.reportRuntime),
      render: (_, row) => (row.actual ? String(row.actual.runtimeVersion ?? '未知') : '—'),
    },
  ];
  const latestActual = versionDetail?.latest?.actual;
  const latestRecent = versionDetail?.latest?.recent;
  const latestApplicationId =
    jsonObject(latestActual) && typeof latestActual.applicationId === 'string' ? latestActual.applicationId : '未知';
  const latestApk =
    jsonObject(latestActual) && typeof latestActual.apkVersion === 'string' ? latestActual.apkVersion : '未知';
  const latestJs =
    jsonObject(latestActual) && typeof latestActual.jsVersion === 'string' ? latestActual.jsVersion : '未知';
  const latestRuntime =
    jsonObject(latestActual) && typeof latestActual.runtimeVersion === 'string' ? latestActual.runtimeVersion : '未知';
  const latestActualUnknownReason = jsonObject(latestActual)
    ? terminalUpdateActualUnknownReasonLabel(latestActual.unknownReason)
    : null;
  const latestStatus = jsonObject(latestRecent)
    ? reportStateLabel(jsonString(latestRecent, 'state'))
    : versionDetail?.hasReport
      ? '已上报，暂无任务报告'
      : '尚无报告';
  const latestReason = jsonObject(latestRecent) ? reportReasonLabel(jsonString(latestRecent, 'reason')) : '—';
  const latestChangedAt = jsonNumber(latestRecent, 'changedAtEpochMillis');
  const latestReferences = versionDetail?.latestReferences;
  const latestRuleReference = reportRuleTargetLabel(jsonString(latestRecent, 'ruleRef'), latestReferences?.ruleTarget);
  const latestFullReference = reportArtifactReferenceLabel(
    jsonString(latestRecent, 'fullArtifactRef'),
    latestReferences?.fullArtifactIdentity,
    '—',
  );
  const latestHotReference = reportArtifactReferenceLabel(
    jsonString(latestRecent, 'hotArtifactRef'),
    latestReferences?.hotArtifactIdentity,
    '无',
  );
  return (
    <Card {...testId(terminalUpdateTestIds.page)}>
      {pageReadProblem && <Alert type="error" showIcon message={pageReadProblem} />}
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'reports',
            label: <span {...testId(terminalUpdateTestIds.reportsTabLabel)}>门店终端列表</span>,
            children: (
              <>
                <ProTable<TerminalUpdateVersionReportItem>
                  rowKey="terminalRef"
                  {...adminListState({
                    loading: reportLoading,
                    failed: Boolean(problem || reportsProblem),
                    emptyText: '暂无版本报告',
                    testIdPrefix: terminalUpdateTestIds.reportList,
                  })}
                  dataSource={reportRows}
                  columns={reportColumns}
                  onRow={row =>
                    testId(terminalUpdateTestIds.reportRow(row.terminalRef)) as HTMLAttributes<HTMLTableRowElement>
                  }
                  search={{
                    labelWidth: 'auto',
                    optionRender: searchConfig => [
                      <Button
                        key="query"
                        type="primary"
                        onClick={() => searchConfig.form?.submit()}
                        {...testId(terminalUpdateTestIds.reportQuerySubmit)}
                      >
                        查询
                      </Button>,
                      <Button
                        key="reset"
                        onClick={() => {
                          searchConfig.form?.resetFields();
                          resetReportFilters();
                        }}
                        {...testId(terminalUpdateTestIds.reportQueryReset)}
                      >
                        重置
                      </Button>,
                    ],
                  }}
                  onSubmit={values =>
                    setAppliedReportFilters({
                      query: textValue(values.queryText),
                      apk: textValue(values.currentApkVersion),
                      js: textValue(values.currentJsVersion),
                      runtime: textValue(values.runtimeVersion),
                      storeRef: textValue(values.storeRef),
                    })
                  }
                  onReset={resetReportFilters}
                  options={false}
                  toolBarRender={false}
                  pagination={false}
                  {...testId(terminalUpdateTestIds.reportList)}
                />
                <CursorPagination
                  state={reportPager}
                  nextCursor={reportNext ?? undefined}
                  testIdPrefix={terminalUpdateTestIds.reportPagination}
                />
              </>
            ),
          },
          {
            key: 'rules',
            label: <span {...testId(terminalUpdateTestIds.rulesTabLabel)}>终端版本更新规则</span>,
            children: (
              <>
                <Space style={{marginBottom: 16}}>
                  <Button
                    onClick={() => void loadRules()}
                    loading={ruleLoading}
                    {...testId(terminalUpdateTestIds.ruleRefresh)}
                  >
                    刷新
                  </Button>
                  {writable && (
                    <Button
                      type="primary"
                      onClick={() => setCreateOpen(true)}
                      {...testId(terminalUpdateTestIds.createRule)}
                    >
                      新建规则
                    </Button>
                  )}
                </Space>
                <ProTable<TerminalUpdateRuleSummary>
                  rowKey="ruleRef"
                  dateFormatter={false}
                  {...adminListState({
                    loading: ruleLoading,
                    failed: Boolean(problem || rulesProblem),
                    emptyText: '暂无更新规则',
                    testIdPrefix: terminalUpdateTestIds.ruleList,
                  })}
                  dataSource={rules}
                  columns={ruleColumns}
                  onRow={row =>
                    testId(terminalUpdateTestIds.ruleRow(row.ruleRef)) as HTMLAttributes<HTMLTableRowElement>
                  }
                  search={{
                    labelWidth: 'auto',
                    optionRender: searchConfig => [
                      <Button
                        key="query"
                        type="primary"
                        onClick={() => searchConfig.form?.submit()}
                        {...testId(terminalUpdateTestIds.ruleQuerySubmit)}
                      >
                        查询
                      </Button>,
                      <Button
                        key="reset"
                        onClick={() => {
                          searchConfig.form?.resetFields();
                          setRuleFilters({});
                          rulePager.reset();
                        }}
                        {...testId(terminalUpdateTestIds.ruleQueryReset)}
                      >
                        重置
                      </Button>,
                    ],
                  }}
                  onSubmit={values => {
                    setRuleFilters(terminalUpdateRuleFilters(values as TerminalUpdateRuleFilterForm));
                    rulePager.reset();
                  }}
                  onReset={() => {
                    setRuleFilters({});
                    rulePager.reset();
                  }}
                  options={false}
                  toolBarRender={false}
                  pagination={false}
                  {...testId(terminalUpdateTestIds.ruleList)}
                />
                <CursorPagination
                  state={rulePager}
                  nextCursor={ruleNext ?? undefined}
                  testIdPrefix="terminal-update-rule-pagination"
                />
              </>
            ),
          },
        ]}
        {...testId(tab === 'rules' ? terminalUpdateTestIds.rulesTab : terminalUpdateTestIds.reportsTab)}
      />
      <RuleCreateDrawer
        open={createOpen}
        queryContext={queryContext}
        projectRef={projectRef}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          setCreateOpen(false);
          await loadRules();
        }}
      />
      <Drawer
        title={detail ? `${ruleTargetTitle(detail)} · 版本规则详情` : '版本规则详情'}
        open={Boolean(detail)}
        onClose={closeRule}
        width={720}
        {...adminDrawerSurfaceProps}
        extra={
          detail && (
            <AdminDetailActionMenu
              triggerTestId={terminalUpdateTestIds.ruleDetailActions}
              items={[
                {
                  key: 'history',
                  label: (
                    <AdminDetailActionLabel testIdValue={terminalUpdateTestIds.ruleHistoryAction}>
                      操作历史
                    </AdminDetailActionLabel>
                  ),
                  onClick: () => setAuditOpen(true),
                },
                ...(writable
                  ? [
                      {
                        key: 'status',
                        label: (
                          <AdminDetailActionLabel testIdValue={terminalUpdateTestIds.enableRuleAction}>
                            {detail.status === 'ENABLED' ? '停用规则' : '启用规则'}
                          </AdminDetailActionLabel>
                        ),
                        onClick: () => {
                          statusSubmission.reset();
                          setStatusProblem(undefined);
                          setStatusIntent(detail.status === 'ENABLED' ? 'DISABLED' : 'ENABLED');
                          setStatusTarget(detail);
                        },
                      },
                    ]
                  : []),
              ]}
            />
          )
        }
        {...testId(terminalUpdateTestIds.ruleDetail)}
      >
        {detail && (
          <>
            <Descriptions {...adminDetailDescriptionsProps}>
              <Descriptions.Item label="状态">{terminalUpdateRuleDetailLabel(detail.status)}</Descriptions.Item>
              <Descriptions.Item label="范围">
                {detail.targetMode === 'ALL' ? '项目全部门店' : '指定门店'}
              </Descriptions.Item>
              <Descriptions.Item label="完整更新">
                {artifactIdentityLabel(detail.fullArtifactIdentity)}
              </Descriptions.Item>
              <Descriptions.Item label="热更新">
                {detail.hotArtifactIdentity ? artifactIdentityLabel(detail.hotArtifactIdentity) : '无'}
              </Descriptions.Item>
              <Descriptions.Item label="安装提醒间隔">{detail.nSeconds / 60} 分钟</Descriptions.Item>
              <Descriptions.Item label="HOT策略">{hotStrategyLabel(detail.hotStrategy)}</Descriptions.Item>
              <Descriptions.Item label="空闲时长">
                {detail.mSeconds == null ? '—' : `${idleSecondsToMinutes(detail.mSeconds)} 分钟`}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatCanonicalDateTime(detail.createdAtEpochMillis)}
              </Descriptions.Item>
              <Descriptions.Item label="说明">{detail.description || '—'}</Descriptions.Item>
            </Descriptions>
            {detail.targetMode === 'STORE_REFS' && (
              <>
                <Typography.Text strong>指定门店</Typography.Text>
                <Table
                  size="small"
                  rowKey="storeRef"
                  dataSource={ruleStores}
                  loading={ruleStorePageLoading}
                  pagination={false}
                  columns={[
                    {
                      title: '门店',
                      dataIndex: 'name',
                      render: (name: string | null, row: (typeof ruleStores)[number]) =>
                        name ? `${name}${row.code ? ` · ${row.code}` : ''}` : '门店不可用',
                    },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      render: terminalUpdateRuleStoreLabel,
                    },
                  ]}
                />
                <CursorPagination
                  state={ruleStoresPaginationState}
                  nextCursor={ruleStorePageLoading ? undefined : (ruleStoresCursor ?? undefined)}
                  testIdPrefix={terminalUpdateTestIds.ruleStoresPagination}
                />
              </>
            )}
          </>
        )}
      </Drawer>
      <Drawer
        title={versionDetail ? `${versionDetail.terminalName} · 终端更新状态详情` : '终端更新状态详情'}
        open={Boolean(versionDetail)}
        onClose={closeVersionDrawer}
        width={720}
        closeIcon={
          <span {...testId(terminalUpdateTestIds.reportDetailClose)}>
            <CloseOutlined />
          </span>
        }
        {...adminDrawerSurfaceProps}
        extra={
          canControlRemote && versionDetail ? (
            <AdminDetailActionMenu
              triggerTestId={remoteControlTestIds.detailActions(versionDetail.terminalRef)}
              loading={remoteStartLoading}
              items={[
                {
                  key: 'remote-control',
                  'data-testid': remoteControlTestIds.start(versionDetail.terminalRef),
                  disabled: versionDetail.connectionStatus !== 'ONLINE' || remoteStartLoading,
                  label: (
                    <Tooltip
                      title={
                        versionDetail.connectionStatus === 'NOT_ACTIVATED'
                          ? '终端未激活'
                          : versionDetail.connectionStatus === 'OFFLINE'
                            ? '终端离线'
                            : undefined
                      }
                    >
                      <span>远程控制</span>
                    </Tooltip>
                  ),
                  onClick: () => void startRemoteFromDrawer(),
                },
              ]}
            />
          ) : null
        }
        {...testId(terminalUpdateTestIds.reportDetail)}
      >
        {versionDetail && (
          <>
            <Descriptions {...adminDetailDescriptionsProps}>
              <Descriptions.Item label="终端">{versionDetail.terminalName}</Descriptions.Item>
              <Descriptions.Item label="门店">{versionDetail.storeName}</Descriptions.Item>
              <Descriptions.Item label="连接状态">
                <Tag
                  color={
                    versionDetail.connectionStatus === 'ONLINE'
                      ? 'success'
                      : versionDetail.connectionStatus === 'OFFLINE'
                        ? 'warning'
                        : 'default'
                  }
                >
                  {versionDetail.connectionStatus === 'ONLINE'
                    ? '在线'
                    : versionDetail.connectionStatus === 'OFFLINE'
                      ? '离线'
                      : '未激活'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="连接观察时间">{versionDetail.observedAt ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="报告状态">{versionDetail.hasReport ? '已上报' : '尚无报告'}</Descriptions.Item>
              {versionDetail.latest?.oldBinding === true && (
                <Descriptions.Item label="绑定状态">上次绑定报告</Descriptions.Item>
              )}
              <Descriptions.Item label="实际 APK">{latestApk}</Descriptions.Item>
              <Descriptions.Item label="实际 applicationId">{latestApplicationId}</Descriptions.Item>
              <Descriptions.Item label="实际 JS">{latestJs}</Descriptions.Item>
              <Descriptions.Item label="Runtime">{latestRuntime}</Descriptions.Item>
              <Descriptions.Item label="实际版本未知原因">{latestActualUnknownReason ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="最新报告规则">{latestRuleReference}</Descriptions.Item>
              <Descriptions.Item label="最新报告 FULL 工件">{latestFullReference}</Descriptions.Item>
              <Descriptions.Item label="最新报告 HOT 工件">{latestHotReference}</Descriptions.Item>
              <Descriptions.Item label="最近状态">{latestStatus}</Descriptions.Item>
              <Descriptions.Item label="最近原因">{latestReason}</Descriptions.Item>
              <Descriptions.Item label="状态发生时间">
                {latestChangedAt === undefined ? '—' : formatCanonicalDateTime(latestChangedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="服务端接收时间">
                {versionDetail.receivedAtEpochMillis === null
                  ? '—'
                  : formatCanonicalDateTime(versionDetail.receivedAtEpochMillis)}
              </Descriptions.Item>
            </Descriptions>
            {remoteControlProblem && (
              <Alert type="error" showIcon message={remoteControlProblem} style={{marginBottom: 16}} />
            )}
            <Space direction="vertical" size={8} style={{display: 'flex'}}>
              <Table
                rowKey={row => row.reportId}
                dataSource={history}
                loading={historyPageLoading}
                columns={[
                  {
                    title: '规则',
                    render: (_, row) => reportRuleTargetLabel(row.recent.ruleRef, row.references.ruleTarget),
                  },
                  {
                    title: 'FULL 工件',
                    render: (_, row) =>
                      reportArtifactReferenceLabel(
                        row.recent.fullArtifactRef,
                        row.references.fullArtifactIdentity,
                        '—',
                      ),
                  },
                  {
                    title: 'HOT 工件',
                    render: (_, row) =>
                      reportArtifactReferenceLabel(row.recent.hotArtifactRef, row.references.hotArtifactIdentity, '无'),
                  },
                  {title: '报告状态', render: (_, row) => reportStateLabel(row.recent.state)},
                  {title: '原因', render: (_, row) => reportReasonLabel(row.recent.reason)},
                  {title: '实际 APK', render: (_, row) => row.actual.apkVersion ?? '未知'},
                  {title: '实际 JS', render: (_, row) => row.actual.jsVersion ?? '未知'},
                  {title: 'Runtime', render: (_, row) => row.actual.runtimeVersion},
                  {
                    title: '实际版本未知原因',
                    render: (_, row) => terminalUpdateActualUnknownReasonLabel(row.actual.unknownReason) ?? '—',
                  },
                  {title: '接收时间', render: (_, row) => formatCanonicalDateTime(row.receivedAtEpochMillis)},
                ]}
                pagination={false}
                {...testId(terminalUpdateTestIds.reportHistory)}
              />
              <CursorPagination
                state={historyPaginationState}
                nextCursor={historyPageLoading ? undefined : (historyCursor ?? undefined)}
                testIdPrefix={terminalUpdateTestIds.reportHistoryPagination}
              />
            </Space>
          </>
        )}
      </Drawer>
      <StatusChangeConfirm
        open={Boolean(statusTarget)}
        title={
          statusTarget
            ? terminalUpdateStatusConfirmTitle(statusIntent ?? 'ENABLED', ruleTargetTitle(statusTarget))
            : '更新规则状态'
        }
        actionLabel={terminalUpdateStatusActionLabel(statusIntent ?? 'ENABLED')}
        submitting={statusSubmitting}
        problem={statusProblem}
        onCancel={() => {
          if (statusSubmittingRef.current) return;
          setStatusTarget(undefined);
          setStatusIntent(undefined);
          setStatusProblem(undefined);
          statusSubmission.reset();
        }}
        onConfirm={() => statusTarget && statusIntent && void changeStatus(statusTarget, statusIntent)}
        confirmTestId={terminalUpdateTestIds.ruleStatusConfirm}
        cancelTestId="terminal-update-rule-status-cancel"
        modalTestId="terminal-update-rule-status-confirmation"
      />
      <OperationsAuditHistoryModal
        open={auditOpen}
        target={
          detail
            ? {entityType: 'TERMINAL_UPDATE_RULE', entityId: detail.ruleRef, projectRef, displayName: '更新规则'}
            : undefined
        }
        groupWorkspaceKey={queryContext.groupWorkspaceKey}
        onClose={() => setAuditOpen(false)}
      />
      {remoteWorkspace && (
        <RemoteControlWorkspace
          target={remoteWorkspace.target}
          currentStart={remoteWorkspace.start}
          contextCurrent={remoteWorkspace.target.contextKey === contextKey}
          onRestart={async () => {
            await remoteLauncher.restart(remoteWorkspace.target);
          }}
          onCloseRequested={sessionId => remoteLauncher.cancelRestart(sessionId)}
          onClose={(sessionId, result) => closeRemoteWorkspace(remoteWorkspace.target, sessionId, result)}
        />
      )}
    </Card>
  );
}

function jsonObject(value: JsonValue | undefined): value is {[key: string]: JsonValue} {
  return value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value);
}

function jsonString(value: JsonValue | undefined, key: string): string | undefined {
  return jsonObject(value) && typeof value[key] === 'string' ? (value[key] as string) : undefined;
}

function jsonNumber(value: JsonValue | undefined, key: string): number | undefined {
  return jsonObject(value) && typeof value[key] === 'number' ? (value[key] as number) : undefined;
}

function hotStrategyLabel(value: string | null | undefined): string {
  return value === 'IMMEDIATE' ? '立即执行' : value === 'IDLE' ? '空闲时执行' : '—';
}

type RuleTarget = Pick<TerminalUpdateRuleSummary, 'fullArtifactIdentity' | 'hotArtifactIdentity'>;
type ReportRuleTarget = {
  fullArtifactIdentity: NonNullable<TerminalUpdateRuleSummary['fullArtifactIdentity']>;
  hotArtifactIdentity: NonNullable<TerminalUpdateRuleSummary['hotArtifactIdentity']> | null;
};

function ruleTargetTitle(rule: RuleTarget): string {
  const full = artifactIdentityLabel(rule.fullArtifactIdentity);
  const hot = rule.hotArtifactIdentity ? artifactIdentityLabel(rule.hotArtifactIdentity) : undefined;
  return hot ? `${full} + ${hot}` : full;
}

function ruleTargetLines(rule: RuleTarget) {
  return (
    <Space direction="vertical" size={0} style={{alignItems: 'flex-start'}}>
      <span>{artifactIdentityLabel(rule.fullArtifactIdentity)}</span>
      {rule.hotArtifactIdentity && <span>{artifactIdentityLabel(rule.hotArtifactIdentity)}</span>}
    </Space>
  );
}

function artifactIdentityLabel(
  identity: NonNullable<TerminalUpdateRuleSummary['fullArtifactIdentity']> | null,
): string {
  if (!identity) return '更新资料暂不可读取';
  const kind = identity.kind === 'FULL' ? '完整更新' : identity.kind === 'HOT' ? '热更新' : '更新';
  return `${identity.applicationId} · ${kind} · ${identity.version}`;
}

function reportRuleTargetLabel(
  ruleRef: string | null | undefined,
  target: ReportRuleTarget | null | undefined,
): string {
  if (!ruleRef) return '—';
  return target ? ruleTargetTitle(target) : '关联更新资料暂不可读取';
}

function reportArtifactReferenceLabel(
  artifactRef: string | null | undefined,
  identity: NonNullable<TerminalUpdateRuleSummary['fullArtifactIdentity']> | null | undefined,
  absentLabel: string,
): string {
  if (!artifactRef) return absentLabel;
  return identity ? artifactIdentityLabel(identity) : '关联更新资料暂不可读取';
}

function reportStateLabel(value: string | undefined): string {
  switch (value) {
    case 'WAITING_USER':
      return '等待安装确认';
    case 'DOWNLOADING':
      return '正在下载更新内容';
    case 'VERIFYING':
      return '正在校验更新内容';
    case 'WAITING_IDLE':
      return '等待闲时更新';
    case 'ADMISSION_REJECTED':
      return '更新规则不适用于此终端';
    case 'INSTALLING':
      return '正在安装完整更新';
    case 'APPLYING_HOT':
      return '正在应用热更新';
    case 'SUCCEEDED':
      return '更新已完成';
    case 'FAILED':
      return '更新失败';
    case 'CANCELLED':
      return '更新已取消';
    case 'UNKNOWN':
      return '更新结果待确认';
    default:
      return '更新状态暂不可读取';
  }
}

function reportReasonLabel(value: string | undefined): string {
  switch (value) {
    case 'NONE':
      return '无';
    case 'NETWORK':
      return '网络连接失败';
    case 'HTTP_REJECTED':
      return '更新请求被拒绝';
    case 'HASH_MISMATCH':
      return '更新内容校验失败';
    case 'PREPARE_FAILED':
      return '更新内容准备失败';
    case 'INSTALLER_CANCELLED':
      return '已取消系统安装';
    case 'INCOMPATIBLE':
      return '应用不匹配';
    case 'WOULD_DOWNGRADE':
      return '更新版本低于当前版本';
    case 'FAILED_ARTIFACT':
      return '更新包此前已失败';
    case 'INSTALL_FAILED':
      return '完整更新安装失败';
    case 'HOT_APPLY_FAILED':
      return '热更新应用失败';
    case 'UNKNOWN':
      return '更新原因待确认';
    default:
      return '更新原因暂不可读取';
  }
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
