import {
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  CursorPagination,
  StatusChangeConfirm,
  adminListState,
  createContentIdempotencyKey,
  formatCanonicalDateTime,
  testId,
  useCursorStack,
  useCursorCandidates,
  useDrawerFormLifecycle,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {HTMLAttributes} from 'react';
import {operationsClient, operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type JsonValue,
  type TerminalUpdateArtifactSummary,
  type TerminalUpdateRuleDetail,
  type TerminalUpdateRuleSummary,
  type TerminalUpdateVersionDetail,
  type TerminalUpdateVersionReportItem,
} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageProps} from '../../../app/routing/model';
import {useOrganizationCandidates} from '../../../app/queries/useOrganizationCandidates';
import {terminalUpdateTestIds} from '../../../app/automation/terminalUpdateTestIds';
import {OperationsAuditHistoryModal} from '../../audit-history';
import {idleMinutesToSeconds, idleSecondsToMinutes} from '../model/terminalUpdateDuration';
import {terminalUpdateCandidateQuery} from '../model/terminalUpdateCandidateQuery';
import {terminalUpdateRuleFilters, type TerminalUpdateRuleFilterForm, type TerminalUpdateRuleFilters} from '../model/terminalUpdateRuleFilters';

type RuleForm = {
  targetMode: 'ALL' | 'STORE_REFS';
  status: 'ENABLED' | 'DISABLED';
  storeRefs?: string[];
  fullArtifactRef: string;
  hotArtifactRef?: string;
  nMinutes: number;
  hotStrategy?: 'IMMEDIATE' | 'IDLE';
  mMinutes?: number;
  description?: string;
};
type Candidate = TerminalUpdateArtifactSummary;

export function ProjectTerminalUpdatePage(props: OperationsPageProps) {
  const projectRef = props.queryContext.scopeRef;
  if (!projectRef) return <Card title="项目终端版本管理">请选择项目数据节点。</Card>;
  return <ProjectTerminalUpdateContent {...props} projectRef={projectRef} />;
}

function ProjectTerminalUpdateContent({
  queryContext,
  actionCapabilityKeys,
  projectRef,
}: OperationsPageProps & {projectRef: NonNullable<OperationsPageProps['queryContext']['scopeRef']>}) {
  const writable = actionCapabilityKeys.includes('MANAGE_PROJECT_TERMINAL_VERSION' as never);
  const contextKey = `${queryContext.groupWorkspaceKey}:${projectRef}:${queryContext.expectedContextVersion}`;
  const latestContextKey = useRef(contextKey);
  latestContextKey.current = contextKey;
  const rulesRequestId = useRef(0);
  const reportsRequestId = useRef(0);
  const ruleDetailRequestId = useRef(0);
  const ruleStorePageRequestId = useRef(0);
  const versionRequestId = useRef(0);
  const [tab, setTab] = useState('rules');
  const [rules, setRules] = useState<readonly TerminalUpdateRuleSummary[]>([]);
  const [ruleFilters, setRuleFilters] = useState<TerminalUpdateRuleFilters>({});
  const [ruleNext, setRuleNext] = useState<string | null>(null);
  const [ruleLoading, setRuleLoading] = useState(false);
  const [reportRows, setReportRows] = useState<readonly TerminalUpdateVersionReportItem[]>([]);
  const [reportNext, setReportNext] = useState<string | null>(null);
  const [appliedReportFilters, setAppliedReportFilters] = useState({
    query: '',
    apk: '',
    js: '',
    runtime: '',
    storeRef: '',
  });
  const [reportLoading, setReportLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<TerminalUpdateRuleDetail>();
  const latestRuleRef = useRef<string | undefined>(undefined);
  const [versionDetail, setVersionDetail] = useState<TerminalUpdateVersionDetail>();
  const [history, setHistory] = useState<
    import('../../../app/api/generated/operations-edge').TerminalUpdateReportHistoryPage['items']
  >([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [ruleStores, setRuleStores] = useState<
    import('../../../app/api/generated/operations-edge').TerminalUpdateRuleStorePage['items']
  >([]);
  const [ruleStoresCursor, setRuleStoresCursor] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [statusTarget, setStatusTarget] = useState<TerminalUpdateRuleSummary>();
  const latestRuleFilters = useRef(ruleFilters);
  const latestReportFilters = useRef(appliedReportFilters);
  latestRuleFilters.current = ruleFilters;
  latestReportFilters.current = appliedReportFilters;
  const rulePager = useCursorStack({resetKey: `${contextKey}:${JSON.stringify(ruleFilters)}`});
  const reportPager = useCursorStack({resetKey: `${contextKey}:${JSON.stringify(appliedReportFilters)}`});
  const latestRuleCursor = useRef(rulePager.cursor);
  const latestReportCursor = useRef(reportPager.cursor);
  latestRuleCursor.current = rulePager.cursor;
  latestReportCursor.current = reportPager.cursor;
  latestRuleRef.current = detail?.ruleRef;
  const reportStores = useOrganizationCandidates({
    open: tab === 'reports',
    queryContext,
    subjectType: 'STORE',
    projectId: projectRef,
    pageSize: 50,
  });
  useOverlayLock(createOpen || Boolean(detail) || Boolean(versionDetail) || Boolean(statusTarget) || auditOpen);
  const path = useMemo(
    () => ({groupWorkspaceKey: queryContext.groupWorkspaceKey, projectRef}),
    [projectRef, queryContext.groupWorkspaceKey],
  );
  const resetReportFilters = () => {
    const cleared = {query: '', apk: '', js: '', runtime: '', storeRef: ''};
    setAppliedReportFilters(cleared);
    reportPager.reset();
  };

  const loadRules = useCallback(
    async (cursor?: string, append = false) => {
      const requestContextKey = contextKey;
      const requestFilters = ruleFilters;
      const requestCursor = cursor || undefined;
      const requestId = ++rulesRequestId.current;
      setRuleLoading(true);
      setProblem(undefined);
      try {
        const page = await operationsClient.getOperationsProjectTerminalUpdateRulePage(path, {
          query: {
            expectedContextVersion: queryContext.expectedContextVersion,
            ...ruleFilters,
            cursor: requestCursor,
            limit: 50,
          },
        });
        if (
          latestContextKey.current !== requestContextKey ||
          rulesRequestId.current !== requestId ||
          latestRuleFilters.current !== requestFilters ||
          latestRuleCursor.current !== requestCursor
        )
          return;
        setRules(current => (append ? [...current, ...page.items] : page.items));
        setRuleNext(page.nextCursor);
      } catch (error) {
        if (
          latestContextKey.current === requestContextKey &&
          rulesRequestId.current === requestId &&
          latestRuleFilters.current === requestFilters &&
          latestRuleCursor.current === requestCursor
        )
          setProblem(operationsProblemOf(error).detail || '读取更新规则失败');
      } finally {
        if (
          latestContextKey.current === requestContextKey &&
          rulesRequestId.current === requestId &&
          latestRuleFilters.current === requestFilters &&
          latestRuleCursor.current === requestCursor
        )
          setRuleLoading(false);
      }
    },
    [contextKey, path, queryContext.expectedContextVersion, ruleFilters],
  );
  const loadReports = useCallback(
    async (cursor?: string, append = false) => {
      const requestContextKey = contextKey;
      const requestFilters = appliedReportFilters;
      const requestCursor = cursor || undefined;
      const requestId = ++reportsRequestId.current;
      setReportLoading(true);
      setProblem(undefined);
      try {
        const page = await operationsClient.getOperationsProjectTerminalVersionPage(path, {
          query: {
            expectedContextVersion: queryContext.expectedContextVersion,
            queryText: appliedReportFilters.query || undefined,
            currentApkVersion: appliedReportFilters.apk || undefined,
            currentJsVersion: appliedReportFilters.js || undefined,
            runtimeVersion: appliedReportFilters.runtime || undefined,
            storeRef: appliedReportFilters.storeRef ? wireUuid(appliedReportFilters.storeRef) : undefined,
            cursor: requestCursor,
            limit: 50,
          },
        });
        if (
          latestContextKey.current !== requestContextKey ||
          reportsRequestId.current !== requestId ||
          latestReportFilters.current !== requestFilters ||
          latestReportCursor.current !== requestCursor
        )
          return;
        setReportRows(current => (append ? [...current, ...page.items] : page.items));
        setReportNext(page.nextCursor);
      } catch (error) {
        if (
          latestContextKey.current === requestContextKey &&
          reportsRequestId.current === requestId &&
          latestReportFilters.current === requestFilters &&
          latestReportCursor.current === requestCursor
        )
          setProblem(operationsProblemOf(error).detail || '读取终端版本报告失败');
      } finally {
        if (
          latestContextKey.current === requestContextKey &&
          reportsRequestId.current === requestId &&
          latestReportFilters.current === requestFilters &&
          latestReportCursor.current === requestCursor
        )
          setReportLoading(false);
      }
    },
    [appliedReportFilters, contextKey, path, queryContext.expectedContextVersion],
  );
  useEffect(() => {
    versionRequestId.current += 1;
    setRules([]);
    setRuleNext(null);
    setReportRows([]);
    setReportNext(null);
    setDetail(undefined);
    setVersionDetail(undefined);
    setHistory([]);
    setRuleStores([]);
    setRuleStoresCursor(null);
    setAuditOpen(false);
    setProblem(undefined);
  }, [contextKey]);
  useEffect(() => {
    void loadRules(rulePager.cursor);
  }, [loadRules, rulePager.cursor, rulePager.page]);
  useEffect(() => {
    void loadReports(reportPager.cursor);
  }, [loadReports, reportPager.cursor, reportPager.page]);

  const openRule = async (row: TerminalUpdateRuleSummary) => {
    const requestContextKey = contextKey;
    const requestId = ++ruleDetailRequestId.current;
    setProblem(undefined);
    try {
      const loaded = await operationsClient.getOperationsProjectTerminalUpdateRuleDetail(
        {...path, ruleRef: wireUuid(row.ruleRef)},
        {query: {expectedContextVersion: queryContext.expectedContextVersion}},
      );
      if (latestContextKey.current !== requestContextKey || ruleDetailRequestId.current !== requestId) return;
      setDetail(loaded);
      if (loaded.targetMode === 'STORE_REFS') {
        const stores = await operationsClient.getOperationsProjectTerminalUpdateRuleStorePage(
          {...path, ruleRef: wireUuid(row.ruleRef)},
          {query: {expectedContextVersion: queryContext.expectedContextVersion, limit: 50}},
        );
        if (latestContextKey.current !== requestContextKey || ruleDetailRequestId.current !== requestId) return;
        setRuleStores(stores.items);
        setRuleStoresCursor(stores.nextCursor);
      } else {
        setRuleStores([]);
        setRuleStoresCursor(null);
      }
    } catch (error) {
      if (latestContextKey.current === requestContextKey && ruleDetailRequestId.current === requestId)
        setProblem(operationsProblemOf(error).detail || '读取规则详情失败');
    }
  };
  const changeStatus = async (target: TerminalUpdateRuleSummary, status: 'ENABLED' | 'DISABLED') => {
    const requestContextKey = contextKey;
    try {
      const body = {revision: target.revision, status};
      const path = {
        groupWorkspaceKey: queryContext.groupWorkspaceKey,
        projectRef: wireUuid(projectRef),
        ruleRef: wireUuid(target.ruleRef),
      };
      const idempotencyKey = await createContentIdempotencyKey(
        OPERATIONS_ADMIN_OPERATION_IDS.changeOperationsProjectTerminalUpdateRuleStatus,
        {path, body},
      );
      await operationsClient.changeOperationsProjectTerminalUpdateRuleStatus(
        path,
        {
          query: {expectedContextVersion: queryContext.expectedContextVersion},
          body,
          headers: {'Idempotency-Key': idempotencyKey},
        },
      );
      if (latestContextKey.current !== requestContextKey) return;
      setStatusTarget(undefined);
      await loadRules(rulePager.cursor);
      if (latestContextKey.current === requestContextKey && latestRuleRef.current === target.ruleRef)
        await openRule(target);
      if (latestContextKey.current === requestContextKey)
        message.success(status === 'ENABLED' ? '规则已启用' : '规则已停用');
    } catch (error) {
      if (latestContextKey.current === requestContextKey)
        setProblem(operationsProblemOf(error).detail || '规则状态更新失败');
    }
  };
  const openVersion = async (row: TerminalUpdateVersionReportItem) => {
    const requestContextKey = contextKey;
    const requestId = ++versionRequestId.current;
    setVersionDetail(undefined);
    setHistory([]);
    setHistoryCursor(null);
    setProblem(undefined);
    try {
      const result = await operationsClient.getOperationsProjectTerminalVersionDetail(
        {...path, terminalRef: wireUuid(row.terminalRef)},
        {query: {expectedContextVersion: queryContext.expectedContextVersion}},
      );
      if (latestContextKey.current !== requestContextKey || versionRequestId.current !== requestId) return;
      setVersionDetail(result);
      const page = await operationsClient.getOperationsProjectTerminalUpdateReportHistoryPage(
        {...path, terminalRef: wireUuid(row.terminalRef)},
        {query: {expectedContextVersion: queryContext.expectedContextVersion, limit: 20}},
      );
      if (latestContextKey.current !== requestContextKey || versionRequestId.current !== requestId) return;
      setHistory(page.items);
      setHistoryCursor(page.nextCursor);
    } catch (error) {
      if (latestContextKey.current === requestContextKey && versionRequestId.current === requestId)
        setProblem(operationsProblemOf(error).detail || '读取终端报告详情失败');
    }
  };

  const loadMoreHistory = async (cursor: string) => {
    if (!versionDetail) return;
    const requestContextKey = contextKey;
    const requestId = versionRequestId.current;
    const terminalRef = versionDetail.terminalRef;
    try {
      const page = await operationsClient.getOperationsProjectTerminalUpdateReportHistoryPage(
        {...path, terminalRef: wireUuid(terminalRef)},
        {query: {expectedContextVersion: queryContext.expectedContextVersion, cursor, limit: 20}},
      );
      if (
        latestContextKey.current !== requestContextKey ||
        versionRequestId.current !== requestId ||
        !versionDetail ||
        versionDetail.terminalRef !== terminalRef
      )
        return;
      setHistory(current => [...current, ...page.items]);
      setHistoryCursor(page.nextCursor);
    } catch (error) {
      if (
        latestContextKey.current === requestContextKey &&
        versionRequestId.current === requestId &&
        versionDetail?.terminalRef === terminalRef
      )
        setProblem(operationsProblemOf(error).detail || '读取终端报告历史失败');
    }
  };
  const loadMoreRuleStores = async () => {
    if (!detail || !ruleStoresCursor) return;
    const requestContextKey = contextKey;
    const requestRuleRef = detail.ruleRef;
    const detailRequestId = ruleDetailRequestId.current;
    const requestId = ++ruleStorePageRequestId.current;
    const cursor = ruleStoresCursor;
    try {
      const page = await operationsClient.getOperationsProjectTerminalUpdateRuleStorePage(
        {...path, ruleRef: wireUuid(requestRuleRef)},
        {query: {expectedContextVersion: queryContext.expectedContextVersion, cursor, limit: 50}},
      );
      if (
        latestContextKey.current !== requestContextKey ||
        latestRuleRef.current !== requestRuleRef ||
        ruleDetailRequestId.current !== detailRequestId ||
        ruleStorePageRequestId.current !== requestId
      )
        return;
      setRuleStores(current => [...current, ...page.items]);
      setRuleStoresCursor(page.nextCursor);
    } catch (error) {
      if (
        latestContextKey.current === requestContextKey &&
        latestRuleRef.current === requestRuleRef &&
        ruleDetailRequestId.current === detailRequestId &&
        ruleStorePageRequestId.current === requestId
      )
        setProblem(operationsProblemOf(error).detail || '读取规则门店失败');
    }
  };

  const ruleColumns: ProColumns<TerminalUpdateRuleSummary>[] = [
    {
      title: '更新目标',
      dataIndex: 'targetMode',
      search: false,
      render: (_, row) => (
        <a onClick={() => void openRule(row)} {...testId(terminalUpdateTestIds.ruleOpen(row.ruleRef))}>
          {ruleTargetTitle(row)}
        </a>
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
      title: '检查间隔',
      dataIndex: 'nSeconds',
      search: false,
      render: (_, row) => `${Math.floor(row.nSeconds / 60)} 分钟`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: {ENABLED: '启用', DISABLED: '停用'},
      fieldProps: {...testId('terminal-update-rule-status-filter'), allowClear: true},
      render: (_, row) => (
        <Tag color={row.status === 'ENABLED' ? 'success' : 'warning'}>{row.status === 'ENABLED' ? '启用' : '停用'}</Tag>
      ),
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
        <a onClick={() => void openVersion(row)} {...testId(terminalUpdateTestIds.reportOpen(row.terminalRef))}>
          {row.terminalName}
        </a>
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
          {row.recent ? reportStateLabel(jsonString(row.recent, 'state')) : '尚无报告'}
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
  const latestApk =
    jsonObject(latestActual) && typeof latestActual.apkVersion === 'string' ? latestActual.apkVersion : '未知';
  const latestJs =
    jsonObject(latestActual) && typeof latestActual.jsVersion === 'string' ? latestActual.jsVersion : '未知';
  const latestRuntime =
    jsonObject(latestActual) && typeof latestActual.runtimeVersion === 'string' ? latestActual.runtimeVersion : '未知';
  const latestStatus = jsonObject(latestRecent) ? reportStateLabel(jsonString(latestRecent, 'state')) : '尚无报告';
  const latestReason = jsonObject(latestRecent) ? reportReasonLabel(jsonString(latestRecent, 'reason')) : '—';
  const latestChangedAt = jsonNumber(latestRecent, 'changedAtEpochMillis');
  const latestReferences = versionDetail?.latestReferences;
  const latestRuleReference = reportRuleTargetLabel(
    jsonString(latestRecent, 'ruleRef'), latestReferences?.ruleTarget,
  );
  const latestFullReference = reportArtifactReferenceLabel(
    jsonString(latestRecent, 'fullArtifactRef'), latestReferences?.fullArtifactIdentity, '—',
  );
  const latestHotReference = reportArtifactReferenceLabel(
    jsonString(latestRecent, 'hotArtifactRef'), latestReferences?.hotArtifactIdentity, '无',
  );
  return (
    <Card title="项目终端版本管理" {...testId(terminalUpdateTestIds.page)}>
      {problem && <Alert type="error" showIcon message={problem} />}
      <Tabs
        activeKey={tab}
        onChange={setTab}
        items={[
          {
            key: 'rules',
            label: <span {...testId(terminalUpdateTestIds.rulesTabLabel)}>更新规则</span>,
            children: (
              <>
                <Space style={{marginBottom: 16}}>
                  <Button onClick={() => void loadRules()} loading={ruleLoading}>
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
                  {...adminListState({
                    loading: ruleLoading,
                    failed: Boolean(problem),
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
                        {...testId('terminal-update-rule-filter-query')}
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
                        {...testId('terminal-update-rule-filter-reset')}
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
          {
            key: 'reports',
            label: <span {...testId(terminalUpdateTestIds.reportsTabLabel)}>终端更新状态</span>,
            children: (
              <>
                <ProTable<TerminalUpdateVersionReportItem>
                  rowKey="terminalRef"
                  {...adminListState({
                    loading: reportLoading,
                    failed: Boolean(problem),
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
                        {...testId('terminal-update-report-filter-reset')}
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
                  testIdPrefix="terminal-update-report-pagination"
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
          await loadRules(rulePager.cursor);
        }}
      />
      <Drawer
        title={detail ? `${ruleTargetTitle(detail)} · 版本规则详情` : '版本规则详情'}
        open={Boolean(detail)}
        onClose={() => {
          ruleDetailRequestId.current += 1;
          ruleStorePageRequestId.current += 1;
          setDetail(undefined);
          setRuleStores([]);
          setRuleStoresCursor(null);
        }}
        width={620}
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
                        onClick: () => setStatusTarget(detail),
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
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="状态">{ruleStatusLabel(detail.status)}</Descriptions.Item>
              <Descriptions.Item label="范围">
                {detail.targetMode === 'ALL' ? '项目全部门店' : '指定门店'}
              </Descriptions.Item>
              <Descriptions.Item label="完整更新">
                {artifactIdentityLabel(detail.fullArtifactIdentity)}
              </Descriptions.Item>
              <Descriptions.Item label="热更新">
                {detail.hotArtifactIdentity ? artifactIdentityLabel(detail.hotArtifactIdentity) : '无'}
              </Descriptions.Item>
              <Descriptions.Item label="检查间隔">{detail.nSeconds / 60} 分钟</Descriptions.Item>
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
                      render: (status: string) =>
                        status === 'UNKNOWN'
                          ? '未知'
                          : status === 'VOIDED'
                            ? '已作废'
                            : status === 'DISABLED'
                              ? '停用'
                              : '启用',
                    },
                  ]}
                />
                {ruleStoresCursor && <Button onClick={() => void loadMoreRuleStores()}>下一页</Button>}
              </>
            )}
          </>
        )}
      </Drawer>
      <Drawer
        title={versionDetail ? `${versionDetail.terminalName} · 终端更新状态详情` : '终端更新状态详情'}
        open={Boolean(versionDetail)}
        onClose={() => {
          versionRequestId.current += 1;
          setVersionDetail(undefined);
          setHistory([]);
          setHistoryCursor(null);
        }}
        width={760}
        {...testId(terminalUpdateTestIds.reportDetail)}
      >
        {versionDetail && (
          <>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="终端">{versionDetail.terminalName}</Descriptions.Item>
              <Descriptions.Item label="门店">{versionDetail.storeName}</Descriptions.Item>
              <Descriptions.Item label="报告状态">{versionDetail.hasReport ? '已上报' : '尚无报告'}</Descriptions.Item>
              {versionDetail.latest?.oldBinding === true && (
                <Descriptions.Item label="绑定状态">上次绑定报告</Descriptions.Item>
              )}
              <Descriptions.Item label="实际 APK">{latestApk}</Descriptions.Item>
              <Descriptions.Item label="实际 JS">{latestJs}</Descriptions.Item>
              <Descriptions.Item label="Runtime">{latestRuntime}</Descriptions.Item>
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
            <Table
              rowKey={row => row.reportId}
              dataSource={history}
              columns={[
                {title: '规则', render: (_, row) => reportRuleTargetLabel(row.recent.ruleRef, row.references.ruleTarget)},
                {title: 'FULL 工件', render: (_, row) => reportArtifactReferenceLabel(
                  row.recent.fullArtifactRef, row.references.fullArtifactIdentity, '—',
                )},
                {title: 'HOT 工件', render: (_, row) => reportArtifactReferenceLabel(
                  row.recent.hotArtifactRef, row.references.hotArtifactIdentity, '无',
                )},
                {title: '报告状态', render: (_, row) => reportStateLabel(row.recent.state)},
                {title: '原因', render: (_, row) => reportReasonLabel(row.recent.reason)},
                {title: '实际 APK', render: (_, row) => row.actual.apkVersion ?? '未知'},
                {title: '实际 JS', render: (_, row) => row.actual.jsVersion ?? '未知'},
                {title: 'Runtime', render: (_, row) => row.actual.runtimeVersion},
                {title: '接收时间', render: (_, row) => formatCanonicalDateTime(row.receivedAtEpochMillis)},
              ]}
              pagination={false}
              {...testId(terminalUpdateTestIds.reportHistory)}
            />
            {historyCursor && <Button onClick={() => void loadMoreHistory(historyCursor)}>加载更多历史</Button>}
          </>
        )}
      </Drawer>
      <StatusChangeConfirm
        open={Boolean(statusTarget)}
        title={
          statusTarget
            ? `${statusTarget.status === 'ENABLED' ? '停用' : '启用'}“${ruleTargetTitle(statusTarget)}”？`
            : '更新规则状态'
        }
        actionLabel={statusTarget?.status === 'ENABLED' ? '停用' : '启用'}
        onCancel={() => setStatusTarget(undefined)}
        onConfirm={() =>
          statusTarget && void changeStatus(statusTarget, statusTarget.status === 'ENABLED' ? 'DISABLED' : 'ENABLED')
        }
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

function ruleStatusLabel(value: string): string {
  return value === 'ENABLED' ? '启用' : value === 'DISABLED' ? '停用' : '状态未知';
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

function artifactIdentityLabel(
  identity: NonNullable<TerminalUpdateRuleSummary['fullArtifactIdentity']> | null,
): string {
  if (!identity) return '更新资料暂不可读取';
  const kind = identity.kind === 'FULL' ? '完整更新' : identity.kind === 'HOT' ? '热更新' : '更新';
  return `${identity.applicationId} · ${kind} · ${identity.version}`;
}

function reportRuleTargetLabel(ruleRef: string | null | undefined, target: ReportRuleTarget | null | undefined): string {
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

function RuleCreateDrawer({
  open,
  queryContext,
  projectRef,
  onClose,
  onCreated,
}: {
  open: boolean;
  queryContext: OperationsPageProps['queryContext'];
  projectRef: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [form] = Form.useForm<RuleForm>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: next => {
      if (!next) onClose();
    },
    dirtyMessage: '填写中的更新规则不会保存。',
    idempotencyKey: true,
  });
  const [problem, setProblem] = useState<string>();
  const [fullCandidateSearch, setFullCandidateSearch] = useState('');
  const [hotCandidateSearch, setHotCandidateSearch] = useState('');
  const targetMode = Form.useWatch('targetMode', form) ?? 'ALL';
  const fullArtifactRef = Form.useWatch('fullArtifactRef', form);
  const hotArtifactRef = Form.useWatch('hotArtifactRef', form);
  const hotStrategy = Form.useWatch('hotStrategy', form);
  const candidateContextKey = `${queryContext.groupWorkspaceKey}:${projectRef}:${queryContext.expectedContextVersion}`;
  const latestCandidateContextKey = useRef(candidateContextKey);
  latestCandidateContextKey.current = candidateContextKey;
  const candidateRequestId = useRef(0);
  const hotCandidateRequestId = useRef(0);
  const fullCandidateState = useCursorCandidates<Candidate>({
    queryText: fullCandidateSearch,
    resetKey: `${open}|${candidateContextKey}`,
    pageSize: 50,
    keyOf: item => item.artifactRef,
  });
  const hotCandidateState = useCursorCandidates<Candidate>({
    queryText: hotCandidateSearch,
    resetKey: `${open}|${candidateContextKey}|${fullArtifactRef ?? ''}`,
    pageSize: 50,
    keyOf: item => item.artifactRef,
  });
  const {
    items: fullCandidates,
    acceptPage: acceptFullCandidatePage,
    cursor: fullCandidateCursor,
    debouncedQueryText: fullCandidateQueryText,
    pageSize: fullCandidatePageSize,
    nextCursor: fullCandidateNextCursor,
    loadNext: loadNextFullCandidatePage,
    onPopupScroll: onFullCandidatePopupScroll,
  } = fullCandidateState;
  const {
    items: hotCandidates,
    acceptPage: acceptHotCandidatePage,
    cursor: hotCandidateCursor,
    debouncedQueryText: hotCandidateQueryText,
    pageSize: hotCandidatePageSize,
    nextCursor: hotCandidateNextCursor,
    loadNext: loadNextHotCandidatePage,
    onPopupScroll: onHotCandidatePopupScroll,
  } = hotCandidateState;
  const [fetchFullCandidatePage, fullCandidateQuery] =
    operationsRtk.useLazyGetOperationsTerminalUpdateArtifactCandidatePageQuery();
  const [fetchHotCandidatePage, hotCandidateQuery] =
    operationsRtk.useLazyGetOperationsTerminalUpdateArtifactCandidatePageQuery();
  const loadingCandidates = fullCandidateQuery.isFetching || hotCandidateQuery.isFetching;
  const stores = useOrganizationCandidates({
    open: open && targetMode === 'STORE_REFS',
    queryContext,
    subjectType: 'STORE',
    projectId: projectRef,
    pageSize: 50,
  });
  useOverlayLock(open);
  useEffect(() => {
    if (!open) return;
    candidateRequestId.current += 1;
    form.resetFields();
    form.setFieldsValue({targetMode: 'ALL', status: 'DISABLED', nMinutes: 5, hotStrategy: 'IMMEDIATE'});
    setProblem(undefined);
    setFullCandidateSearch('');
    setHotCandidateSearch('');
    return () => {
      candidateRequestId.current += 1;
    };
  }, [
    candidateContextKey,
    form,
    open,
    projectRef,
    queryContext.expectedContextVersion,
    queryContext.groupWorkspaceKey,
  ]);
  useEffect(() => {
    if (!open) return;
    const requestContextKey = candidateContextKey;
    const requestId = ++candidateRequestId.current;
    const request = operationsAdminRtkRequest.getOperationsTerminalUpdateArtifactCandidatePage(
      {groupWorkspaceKey: queryContext.groupWorkspaceKey},
      {
        query: terminalUpdateCandidateQuery({
          expectedContextVersion: queryContext.expectedContextVersion,
          projectRef: wireUuid(projectRef),
          kind: 'FULL',
          queryText: fullCandidateQueryText,
          cursor: fullCandidateCursor,
          limit: fullCandidatePageSize,
        }),
      },
    );
    void fetchFullCandidatePage(request).unwrap()
      .then(page => {
        if (latestCandidateContextKey.current === requestContextKey && candidateRequestId.current === requestId)
          acceptFullCandidatePage(page.items, {nextCursor: page.nextCursor});
      })
      .catch(error => {
        if (latestCandidateContextKey.current === requestContextKey && candidateRequestId.current === requestId)
          setProblem(operationsProblemOf(error).detail || '读取 FULL 更新包候选失败');
      });
    return () => {
      if (candidateRequestId.current === requestId) candidateRequestId.current += 1;
    };
  }, [
    candidateContextKey,
    fetchFullCandidatePage,
    acceptFullCandidatePage,
    fullCandidateCursor,
    fullCandidatePageSize,
    fullCandidateQueryText,
    open,
    projectRef,
    queryContext.expectedContextVersion,
    queryContext.groupWorkspaceKey,
  ]);
  const submit = async (values: RuleForm) => {
    setProblem(undefined);
    lifecycle.setSubmitting(true);
    try {
      const body = {
        targetMode: values.targetMode,
        ...(values.targetMode === 'STORE_REFS' ? {storeRefs: (values.storeRefs ?? []).map(wireUuid)} : {}),
        fullArtifactRef: wireUuid(values.fullArtifactRef),
        ...(values.hotArtifactRef ? {hotArtifactRef: wireUuid(values.hotArtifactRef)} : {}),
        status: values.status,
        nSeconds: Math.round(values.nMinutes * 60),
        ...(values.hotArtifactRef
          ? {
              hotStrategy: values.hotStrategy ?? 'IMMEDIATE',
              ...(values.hotStrategy === 'IDLE' && values.mMinutes !== undefined
                ? {mSeconds: idleMinutesToSeconds(values.mMinutes)}
                : {}),
            }
          : {}),
        description: values.description?.trim() || undefined,
      };
      const idempotencyKey = await createContentIdempotencyKey(
        OPERATIONS_ADMIN_OPERATION_IDS.createOperationsProjectTerminalUpdateRule,
        body,
      );
      await operationsClient.createOperationsProjectTerminalUpdateRule(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, projectRef: wireUuid(projectRef)},
        {
          query: {expectedContextVersion: queryContext.expectedContextVersion},
          body,
          headers: {'Idempotency-Key': idempotencyKey},
        },
      );
      lifecycle.setDirty(false);
      await onCreated();
      message.success(`更新规则已创建，当前为${values.status === 'ENABLED' ? '启用' : '停用'}状态`);
    } catch (error) {
      setProblem(operationsProblemOf(error).detail || '保存更新规则失败');
    } finally {
      lifecycle.setSubmitting(false);
    }
  };
  useEffect(() => {
    if (!open || !fullArtifactRef) return;
    const requestContextKey = candidateContextKey;
    const requestId = ++hotCandidateRequestId.current;
    const request = operationsAdminRtkRequest.getOperationsTerminalUpdateArtifactCandidatePage(
      {groupWorkspaceKey: queryContext.groupWorkspaceKey},
      {
        query: terminalUpdateCandidateQuery({
          expectedContextVersion: queryContext.expectedContextVersion,
          projectRef: wireUuid(projectRef),
          kind: 'HOT',
          minimumFullArtifactRef: wireUuid(fullArtifactRef),
          queryText: hotCandidateQueryText,
          cursor: hotCandidateCursor,
          limit: hotCandidatePageSize,
        }),
      },
    );
    void fetchHotCandidatePage(request).unwrap()
      .then(page => {
        if (latestCandidateContextKey.current === requestContextKey &&
          hotCandidateRequestId.current === requestId && form.getFieldValue('fullArtifactRef') === fullArtifactRef)
          acceptHotCandidatePage(page.items, {nextCursor: page.nextCursor});
      })
      .catch(error => {
        if (latestCandidateContextKey.current === requestContextKey &&
          hotCandidateRequestId.current === requestId && form.getFieldValue('fullArtifactRef') === fullArtifactRef)
          setProblem(operationsProblemOf(error).detail || '读取 HOT 更新包候选失败');
      });
    return () => {
      if (hotCandidateRequestId.current === requestId) hotCandidateRequestId.current += 1;
    };
  }, [
    candidateContextKey,
    fetchHotCandidatePage,
    form,
    fullArtifactRef,
    acceptHotCandidatePage,
    hotCandidateCursor,
    hotCandidatePageSize,
    hotCandidateQueryText,
    open,
    projectRef,
    queryContext.expectedContextVersion,
    queryContext.groupWorkspaceKey,
  ]);
  return (
    <Drawer title="新建终端更新规则" open={open} onClose={() => lifecycle.requestClose()} width={680} destroyOnClose>
      {problem && <Alert type="error" showIcon message={problem} />}
      <Form form={form} layout="vertical" onFinish={submit} onValuesChange={() => lifecycle.setDirty(true)}>
        <Form.Item name="targetMode" label="应用范围" rules={[{required: true}]}>
          <Select
            options={[
              {value: 'ALL', label: '项目全部门店'},
              {value: 'STORE_REFS', label: '指定门店'},
            ]}
            optionRender={option => (
              <span {...testId(terminalUpdateTestIds.targetModeOption(option.value as 'ALL' | 'STORE_REFS'))}>
                {option.label}
              </span>
            )}
            {...testId(terminalUpdateTestIds.targetMode)}
          />
        </Form.Item>
        <Form.Item name="status" label="初始状态" rules={[{required: true}]}>
          <Select
            options={[
              {value: 'DISABLED', label: '停用'},
              {value: 'ENABLED', label: '启用'},
            ]}
            {...testId(terminalUpdateTestIds.initialStatus)}
          />
        </Form.Item>
        {targetMode === 'STORE_REFS' && (
          <Form.Item name="storeRefs" label="门店" rules={[{required: true}]}>
            <Select
              mode="multiple"
              showSearch
              filterOption={false}
              onSearch={stores.setStoreSearch}
              onPopupScroll={stores.onPopupScroll}
              loading={stores.isFetching}
              options={stores.items.map(item => ({value: item.id, label: `${item.name} · ${item.code}`}))}
              optionRender={option => (
                <span {...testId(terminalUpdateTestIds.storeRefOption(String(option.value)))}>{option.label}</span>
              )}
              {...testId(terminalUpdateTestIds.storeRefs)}
            />
          </Form.Item>
        )}
        <Form.Item name="fullArtifactRef" label="FULL 更新包" rules={[{required: true}]}>
          <Select
            showSearch
            loading={loadingCandidates}
            options={fullCandidates.map(item => ({
              value: item.artifactRef,
              label: `${item.applicationId} · ${item.apkVersion} · ${item.runtimeVersion}`,
            }))}
            filterOption={false}
            onSearch={setFullCandidateSearch}
            onPopupScroll={event => onFullCandidatePopupScroll(event, fullCandidateQuery.isFetching)}
            dropdownRender={menu => (
              <>
                {menu}
                {fullCandidateNextCursor && (
                  <Button
                    type="link"
                    loading={fullCandidateQuery.isFetching}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => loadNextFullCandidatePage(fullCandidateQuery.isFetching)}
                    {...testId(terminalUpdateTestIds.fullArtifactLoadMore)}
                  >
                    加载更多
                  </Button>
                )}
              </>
            )}
            optionRender={option => (
              <span {...testId(terminalUpdateTestIds.fullArtifactOption(String(option.value)))}>{option.label}</span>
            )}
            onChange={value => {
              hotCandidateRequestId.current += 1;
              form.setFieldValue('hotArtifactRef', undefined);
              setHotCandidateSearch('');
              if (!value) setProblem(undefined);
            }}
            {...testId(terminalUpdateTestIds.fullArtifact)}
          />
        </Form.Item>
        <Form.Item name="hotArtifactRef" label="HOT 更新包">
          <Select
            allowClear
            showSearch
            loading={loadingCandidates}
            filterOption={false}
            onSearch={setHotCandidateSearch}
            onPopupScroll={event => onHotCandidatePopupScroll(event, hotCandidateQuery.isFetching)}
            options={hotCandidates.map(item => ({
              value: item.artifactRef,
              label: `${item.applicationId} · ${item.jsVersion} · ${item.runtimeVersion}`,
            }))}
            onChange={value => {
              form.setFieldValue('mMinutes', undefined);
              form.setFieldValue('hotStrategy', value ? (form.getFieldValue('hotStrategy') ?? 'IMMEDIATE') : undefined);
            }}
            optionRender={option => (
              <span {...testId(terminalUpdateTestIds.hotArtifactOption(String(option.value)))}>{option.label}</span>
            )}
            dropdownRender={menu => (
              <>
                {menu}
                {hotCandidateNextCursor && (
                  <Button
                    type="link"
                    loading={hotCandidateQuery.isFetching}
                    onMouseDown={event => event.preventDefault()}
                    onClick={() => loadNextHotCandidatePage(hotCandidateQuery.isFetching)}
                    {...testId(terminalUpdateTestIds.hotArtifactLoadMore)}
                  >
                    加载更多
                  </Button>
                )}
              </>
            )}
            {...testId(terminalUpdateTestIds.hotArtifact)}
          />
        </Form.Item>
        <Form.Item name="nMinutes" label="检查间隔（分钟）" rules={[{required: true}]}>
          <InputNumber
            min={1}
            max={1440}
            precision={0}
            style={{width: '100%'}}
            {...testId(terminalUpdateTestIds.nMinutes)}
          />
        </Form.Item>
        {hotArtifactRef && (
          <Form.Item name="hotStrategy" label="HOT 执行策略" rules={[{required: true}]} preserve={false}>
            <Select
              options={[
                {value: 'IMMEDIATE', label: '立即执行'},
                {value: 'IDLE', label: '空闲时执行'},
              ]}
              optionRender={option => (
                <span {...testId(terminalUpdateTestIds.hotStrategyOption(option.value as 'IMMEDIATE' | 'IDLE'))}>
                  {option.label}
                </span>
              )}
              {...testId(terminalUpdateTestIds.hotStrategy)}
            />
          </Form.Item>
        )}
        {hotArtifactRef && hotStrategy === 'IDLE' && (
          <Form.Item name="mMinutes" label="空闲时长（分钟）" rules={[{required: true}]} preserve={false}>
            <InputNumber
              min={1}
              max={1440}
              precision={0}
              style={{width: '100%'}}
              {...testId(terminalUpdateTestIds.mMinutes)}
            />
          </Form.Item>
        )}
        <Form.Item name="description" label="说明">
          <Input.TextArea maxLength={500} {...testId(terminalUpdateTestIds.description)} />
        </Form.Item>
        <Space>
          <Button onClick={() => lifecycle.requestClose()}>取消</Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={lifecycle.submitting}
            {...testId(terminalUpdateTestIds.createRuleSubmit)}
          >
            保存并创建
          </Button>
        </Space>
      </Form>
    </Drawer>
  );
}
