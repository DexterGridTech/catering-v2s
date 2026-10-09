import {Alert, Button, Card, Descriptions, Drawer, Form, Input, InputNumber, Select, Space, Table, Tabs, Tag, Typography, message} from 'antd';
import {ProTable, type ProColumns} from '@ant-design/pro-components';
import {AdminDetailActionLabel, AdminDetailActionMenu, CursorPagination, StatusChangeConfirm, adminListState, createContentIdempotencyKey, formatCanonicalDateTime, testId, useCursorStack, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {HTMLAttributes} from 'react';
import {operationsClient, operationsProblemOf} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS, type JsonValue, type TerminalUpdateArtifactSummary, type TerminalUpdateRuleDetail, type TerminalUpdateRuleSummary, type TerminalUpdateVersionDetail, type TerminalUpdateVersionReportItem} from '../../../app/api/generated/operations-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import type {OperationsPageProps} from '../../../app/routing/model';
import {useOrganizationCandidates} from '../../../app/queries/useOrganizationCandidates';
import {terminalUpdateTestIds} from '../../../app/automation/terminalUpdateTestIds';
import {OperationsAuditHistoryModal} from '../../audit-history';

type RuleForm = {targetMode: 'ALL' | 'STORE_REFS'; storeRefs?: string[]; fullArtifactRef: string; hotArtifactRef?: string; nMinutes: number; hotStrategy: 'IMMEDIATE' | 'IDLE'; mSeconds?: number; description?: string};
type Candidate = TerminalUpdateArtifactSummary;

export function ProjectTerminalUpdatePage(props: OperationsPageProps) {
  const projectRef = props.queryContext.scopeRef;
  if (!projectRef) return <Card title="项目终端版本管理">请选择项目数据节点。</Card>;
  return <ProjectTerminalUpdateContent {...props} projectRef={projectRef} />;
}

function ProjectTerminalUpdateContent({queryContext, actionCapabilityKeys, projectRef}: OperationsPageProps & {projectRef: NonNullable<OperationsPageProps['queryContext']['scopeRef']>}) {
  const writable = actionCapabilityKeys.includes('MANAGE_PROJECT_TERMINAL_VERSION' as never);
  const contextKey = `${queryContext.groupWorkspaceKey}:${projectRef}:${queryContext.expectedContextVersion}`;
  const latestContextKey = useRef(contextKey);
  latestContextKey.current = contextKey;
  const [tab, setTab] = useState('rules');
  const [rules, setRules] = useState<readonly TerminalUpdateRuleSummary[]>([]);
  const [ruleStatus, setRuleStatus] = useState<'ENABLED' | 'DISABLED'>();
  const [ruleNext, setRuleNext] = useState<string | null>(null);
  const [ruleLoading, setRuleLoading] = useState(false);
  const [reportRows, setReportRows] = useState<readonly TerminalUpdateVersionReportItem[]>([]);
  const [reportNext, setReportNext] = useState<string | null>(null);
  const [appliedReportFilters, setAppliedReportFilters] = useState({query: '', apk: '', js: '', runtime: '', storeRef: ''});
  const [reportLoading, setReportLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<TerminalUpdateRuleDetail>();
  const [versionDetail, setVersionDetail] = useState<TerminalUpdateVersionDetail>();
  const [history, setHistory] = useState<import('../../../app/api/generated/operations-edge').TerminalUpdateReportHistoryPage['items']>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [ruleStores, setRuleStores] = useState<import('../../../app/api/generated/operations-edge').TerminalUpdateRuleStorePage['items']>([]);
  const [ruleStoresCursor, setRuleStoresCursor] = useState<string | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [statusTarget, setStatusTarget] = useState<TerminalUpdateRuleSummary>();
  const rulePager = useCursorStack({resetKey: `${contextKey}:${ruleStatus ?? ''}`});
  const reportPager = useCursorStack({resetKey: `${contextKey}:${JSON.stringify(appliedReportFilters)}`});
  const reportStores = useOrganizationCandidates({open: tab === 'reports', queryContext, subjectType: 'STORE', projectId: projectRef, pageSize: 50});
  useOverlayLock(createOpen || Boolean(detail) || Boolean(versionDetail) || Boolean(statusTarget) || auditOpen);
  const path = useMemo(() => ({groupWorkspaceKey: queryContext.groupWorkspaceKey, projectRef}), [projectRef, queryContext.groupWorkspaceKey]);

  const loadRules = useCallback(async (cursor?: string, append = false) => {
    setRuleLoading(true); setProblem(undefined);
    try {
      const page = await operationsClient.getOperationsProjectTerminalUpdateRulePage(path, {query: {expectedContextVersion: queryContext.expectedContextVersion, status: ruleStatus, cursor: cursor || undefined, limit: 50}});
      if (latestContextKey.current !== contextKey) return;
      setRules(current => append ? [...current, ...page.items] : page.items);
      setRuleNext(page.nextCursor);
    } catch (error) { if (latestContextKey.current === contextKey) setProblem(operationsProblemOf(error).detail || '读取更新规则失败'); }
    finally { if (latestContextKey.current === contextKey) setRuleLoading(false); }
  }, [contextKey, path, queryContext.expectedContextVersion, ruleStatus]);
  const loadReports = useCallback(async (cursor?: string, append = false) => {
    setReportLoading(true); setProblem(undefined);
    try {
      const page = await operationsClient.getOperationsProjectTerminalVersionPage(path, {query: {
        expectedContextVersion: queryContext.expectedContextVersion, queryText: appliedReportFilters.query || undefined,
        currentApkVersion: appliedReportFilters.apk || undefined, currentJsVersion: appliedReportFilters.js || undefined,
        runtimeVersion: appliedReportFilters.runtime || undefined, storeRef: appliedReportFilters.storeRef ? wireUuid(appliedReportFilters.storeRef) : undefined,
        cursor: cursor || undefined, limit: 50,
      }});
      if (latestContextKey.current !== contextKey) return;
      setReportRows(current => append ? [...current, ...page.items] : page.items);
      setReportNext(page.nextCursor);
    } catch (error) { if (latestContextKey.current === contextKey) setProblem(operationsProblemOf(error).detail || '读取终端版本报告失败'); }
    finally { if (latestContextKey.current === contextKey) setReportLoading(false); }
  }, [appliedReportFilters, contextKey, path, queryContext.expectedContextVersion]);
  useEffect(() => {
    setRules([]); setRuleNext(null); setReportRows([]); setReportNext(null);
    setDetail(undefined); setVersionDetail(undefined); setHistory([]); setRuleStores([]); setRuleStoresCursor(null); setAuditOpen(false); setProblem(undefined);
  }, [contextKey]);
  useEffect(() => { void loadRules(rulePager.cursor); }, [loadRules, rulePager.cursor, rulePager.page]);
  useEffect(() => { void loadReports(reportPager.cursor); }, [loadReports, reportPager.cursor, reportPager.page]);

  const openRule = async (row: TerminalUpdateRuleSummary) => {
    const requestContextKey = contextKey;
    setProblem(undefined);
    try {
      const loaded = await operationsClient.getOperationsProjectTerminalUpdateRuleDetail({...path, ruleRef: wireUuid(row.ruleRef)}, {query: {expectedContextVersion: queryContext.expectedContextVersion}});
      if (latestContextKey.current !== requestContextKey) return;
      setDetail(loaded);
      if (loaded.targetMode === 'STORE_REFS') {
        const stores = await operationsClient.getOperationsProjectTerminalUpdateRuleStorePage({...path, ruleRef: wireUuid(row.ruleRef)}, {query: {expectedContextVersion: queryContext.expectedContextVersion, limit: 50}});
        if (latestContextKey.current !== requestContextKey) return;
        setRuleStores(stores.items); setRuleStoresCursor(stores.nextCursor);
      } else { setRuleStores([]); setRuleStoresCursor(null); }
    }
    catch (error) { if (latestContextKey.current === requestContextKey) setProblem(operationsProblemOf(error).detail || '读取规则详情失败'); }
  };
  const changeStatus = async (target: TerminalUpdateRuleSummary, status: 'ENABLED' | 'DISABLED') => {
    try {
      const body = {revision: target.revision, status};
      const idempotencyKey = await createContentIdempotencyKey(OPERATIONS_ADMIN_OPERATION_IDS.changeOperationsProjectTerminalUpdateRuleStatus, body);
      await operationsClient.changeOperationsProjectTerminalUpdateRuleStatus({...path, ruleRef: wireUuid(target.ruleRef)}, {
        query: {expectedContextVersion: queryContext.expectedContextVersion}, body,
        headers: {'Idempotency-Key': idempotencyKey},
      });
      setStatusTarget(undefined); await loadRules(rulePager.cursor); message.success(status === 'ENABLED' ? '规则已启用' : '规则已停用');
    } catch (error) { setProblem(operationsProblemOf(error).detail || '规则状态更新失败'); }
  };
  const openVersion = async (row: TerminalUpdateVersionReportItem) => {
    setVersionDetail(undefined); setHistory([]); setHistoryCursor(null); setProblem(undefined);
    try {
      const result = await operationsClient.getOperationsProjectTerminalVersionDetail({...path, terminalRef: wireUuid(row.terminalRef)}, {query: {expectedContextVersion: queryContext.expectedContextVersion}});
      setVersionDetail(result);
      const page = await operationsClient.getOperationsProjectTerminalUpdateReportHistoryPage({...path, terminalRef: wireUuid(row.terminalRef)}, {query: {expectedContextVersion: queryContext.expectedContextVersion, limit: 20}});
      setHistory(page.items); setHistoryCursor(page.nextCursor);
    } catch (error) { setProblem(operationsProblemOf(error).detail || '读取终端报告详情失败'); }
  };

  const loadMoreHistory = async (cursor: string) => {
    if (!versionDetail) return;
    const page = await operationsClient.getOperationsProjectTerminalUpdateReportHistoryPage({...path, terminalRef: wireUuid(versionDetail.terminalRef)}, {query: {expectedContextVersion: queryContext.expectedContextVersion, cursor, limit: 20}});
    setHistory(current => [...current, ...page.items]); setHistoryCursor(page.nextCursor);
  };
  const loadMoreRuleStores = async () => {
    if (!detail || !ruleStoresCursor) return;
    const page = await operationsClient.getOperationsProjectTerminalUpdateRuleStorePage({...path, ruleRef: wireUuid(detail.ruleRef)}, {query: {expectedContextVersion: queryContext.expectedContextVersion, cursor: ruleStoresCursor, limit: 50}});
    setRuleStores(current => [...current, ...page.items]); setRuleStoresCursor(page.nextCursor);
  };

  const ruleColumns: ProColumns<TerminalUpdateRuleSummary>[] = [
    {title: '规则', dataIndex: 'createdAtEpochMillis', search: false, render: (_, row) => <a onClick={() => void openRule(row)} {...testId(terminalUpdateTestIds.ruleOpen(row.ruleRef))}>查看规则 · {formatCanonicalDateTime(row.createdAtEpochMillis)}</a>},
    {title: '范围', dataIndex: 'targetMode', search: false, render: (_, row) => row.targetMode === 'ALL' ? '项目全部门店' : '指定门店'},
    {title: 'FULL', dataIndex: 'fullArtifactRef', search: false, render: () => '已绑定'},
    {title: 'HOT', dataIndex: 'hotArtifactRef', search: false, render: (_, row) => row.hotArtifactRef ? '已绑定' : '无'},
    {title: '检查间隔', dataIndex: 'nSeconds', search: false, render: (_, row) => `${Math.floor(row.nSeconds / 60)} 分钟`},
    {title: '状态', dataIndex: 'status', valueType: 'select', valueEnum: {ENABLED: '启用', DISABLED: '停用'}, fieldProps: testId('terminal-update-rule-status-filter'), render: (_, row) => <Tag color={row.status === 'ENABLED' ? 'green' : 'default'}>{row.status === 'ENABLED' ? '启用' : '停用'}</Tag>},
    {title: '创建时间', dataIndex: 'createdAtEpochMillis', search: false, render: (_, row) => formatCanonicalDateTime(row.createdAtEpochMillis)},
  ];
  const reportColumns: ProColumns<TerminalUpdateVersionReportItem>[] = [
    {title: '终端', dataIndex: 'queryText', fieldProps: testId(terminalUpdateTestIds.reportQuery), render: (_, row) => <a onClick={() => void openVersion(row)} {...testId(terminalUpdateTestIds.reportOpen(row.terminalRef))}>{row.terminalName}</a>},
    {title: '门店', dataIndex: 'storeRef', valueType: 'select', fieldProps: {showSearch: true, filterOption: false, onSearch: reportStores.setStoreSearch, onPopupScroll: reportStores.onPopupScroll, options: reportStores.items.map(item => ({value: item.id, label: `${item.name} · ${item.code}`})), ...testId(terminalUpdateTestIds.reportStore)}, render: (_, row) => row.storeName},
    {title: '最新实际状态', dataIndex: 'recentState', search: false, render: (_, row) => row.recent ? String(row.recent.state ?? '已上报') : '尚无报告'},
    {title: '实际 APK', dataIndex: 'currentApkVersion', fieldProps: testId(terminalUpdateTestIds.reportApk), render: (_, row) => row.actual ? String(row.actual.apkVersion ?? '未知') : '—'},
    {title: '实际 JS', dataIndex: 'currentJsVersion', fieldProps: testId(terminalUpdateTestIds.reportJs), render: (_, row) => row.actual ? String(row.actual.jsVersion ?? '未知') : '—'},
    {title: 'Runtime', dataIndex: 'runtimeVersion', fieldProps: testId(terminalUpdateTestIds.reportRuntime), render: (_, row) => row.actual ? String(row.actual.runtimeVersion ?? '未知') : '—'},
  ];
  const latestActual = versionDetail?.latest?.actual;
  const latestRecent = versionDetail?.latest?.recent;
  const latestApk = jsonObject(latestActual) && typeof latestActual.apkVersion === 'string' ? latestActual.apkVersion : '未知';
  const latestJs = jsonObject(latestActual) && typeof latestActual.jsVersion === 'string' ? latestActual.jsVersion : '未知';
  const latestRuntime = jsonObject(latestActual) && typeof latestActual.runtimeVersion === 'string' ? latestActual.runtimeVersion : '未知';
  const latestStatus = jsonObject(latestRecent) && typeof latestRecent.state === 'string' ? latestRecent.state : '尚无报告';
  return <Card title="项目终端版本管理" {...testId(terminalUpdateTestIds.page)}>
    {problem && <Alert type="error" showIcon message={problem} />}
    <Tabs activeKey={tab} onChange={setTab} items={[
      {key: 'rules', label: <span {...testId(terminalUpdateTestIds.rulesTabLabel)}>更新规则</span>, children: <>
        <Space style={{marginBottom: 16}}><Button onClick={() => void loadRules()} loading={ruleLoading}>刷新</Button>{writable && <Button type="primary" onClick={() => setCreateOpen(true)} {...testId(terminalUpdateTestIds.createRule)}>新建规则</Button>}</Space>
        <ProTable<TerminalUpdateRuleSummary>
          rowKey="ruleRef"
          {...adminListState({loading: ruleLoading, failed: Boolean(problem), emptyText: '暂无更新规则', testIdPrefix: terminalUpdateTestIds.ruleList})}
          dataSource={rules}
          columns={ruleColumns}
          onRow={row => testId(terminalUpdateTestIds.ruleRow(row.ruleRef)) as HTMLAttributes<HTMLTableRowElement>}
          search={{labelWidth: 'auto', optionRender: searchConfig => [
            <Button key="query" type="primary" onClick={() => searchConfig.form?.submit()} {...testId('terminal-update-rule-filter-query')}>查询</Button>,
            <Button key="reset" onClick={() => {searchConfig.form?.resetFields(); setRuleStatus(undefined);}} {...testId('terminal-update-rule-filter-reset')}>重置</Button>,
          ]}}
          onSubmit={values => setRuleStatus(values.status === 'ENABLED' || values.status === 'DISABLED' ? values.status : undefined)}
          onReset={() => setRuleStatus(undefined)}
          options={false}
          toolBarRender={false}
          pagination={false}
          {...testId(terminalUpdateTestIds.ruleList)}
        />
        <CursorPagination state={rulePager} nextCursor={ruleNext ?? undefined} testIdPrefix="terminal-update-rule-pagination" />
      </>},
      {key: 'reports', label: <span {...testId(terminalUpdateTestIds.reportsTabLabel)}>版本与报告</span>, children: <>
        <ProTable<TerminalUpdateVersionReportItem>
          rowKey="terminalRef"
          {...adminListState({loading: reportLoading, failed: Boolean(problem), emptyText: '暂无版本报告', testIdPrefix: terminalUpdateTestIds.reportList})}
          dataSource={reportRows}
          columns={reportColumns}
          onRow={row => testId(terminalUpdateTestIds.reportRow(row.terminalRef)) as HTMLAttributes<HTMLTableRowElement>}
          search={{labelWidth: 'auto', optionRender: searchConfig => [
            <Button key="query" type="primary" onClick={() => searchConfig.form?.submit()} {...testId(terminalUpdateTestIds.reportQuerySubmit)}>查询</Button>,
            <Button key="reset" onClick={() => searchConfig.form?.resetFields()} {...testId('terminal-update-report-filter-reset')}>重置</Button>,
          ]}}
          onSubmit={values => setAppliedReportFilters({
            query: textValue(values.queryText), apk: textValue(values.currentApkVersion), js: textValue(values.currentJsVersion),
            runtime: textValue(values.runtimeVersion), storeRef: textValue(values.storeRef),
          })}
          onReset={() => setAppliedReportFilters({query: '', apk: '', js: '', runtime: '', storeRef: ''})}
          options={false}
          toolBarRender={false}
          pagination={false}
          {...testId(terminalUpdateTestIds.reportList)}
        />
        <CursorPagination state={reportPager} nextCursor={reportNext ?? undefined} testIdPrefix="terminal-update-report-pagination" />
      </>},
    ]} {...testId(tab === 'rules' ? terminalUpdateTestIds.rulesTab : terminalUpdateTestIds.reportsTab)} />
    <RuleCreateDrawer open={createOpen} queryContext={queryContext} projectRef={projectRef} onClose={() => setCreateOpen(false)} onCreated={async () => {setCreateOpen(false); await loadRules();}} />
    <Drawer title="更新规则详情" open={Boolean(detail)} onClose={() => setDetail(undefined)} width={620} extra={detail && <AdminDetailActionMenu triggerTestId={terminalUpdateTestIds.ruleDetailActions} items={[
      {key: 'history', label: <AdminDetailActionLabel testIdValue={terminalUpdateTestIds.ruleHistoryAction}>操作历史</AdminDetailActionLabel>, onClick: () => setAuditOpen(true)},
      ...(writable ? [{key: 'status', label: <AdminDetailActionLabel testIdValue={terminalUpdateTestIds.enableRuleAction}>{detail.status === 'ENABLED' ? '停用规则' : '启用规则'}</AdminDetailActionLabel>, onClick: () => setStatusTarget(detail)}] : []),
    ]} />} {...testId(terminalUpdateTestIds.ruleDetail)}>
      {detail && (
        <>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="状态">{detail.status}</Descriptions.Item>
            <Descriptions.Item label="范围">{detail.targetMode === 'ALL' ? '项目全部门店' : '指定门店'}</Descriptions.Item>
            <Descriptions.Item label="FULL">已绑定</Descriptions.Item>
            <Descriptions.Item label="HOT">{detail.hotArtifactRef ? '已绑定' : '无'}</Descriptions.Item>
            <Descriptions.Item label="检查间隔">{detail.nSeconds / 60} 分钟</Descriptions.Item>
            <Descriptions.Item label="HOT策略">{detail.hotStrategy}</Descriptions.Item>
            <Descriptions.Item label="空闲时长">{detail.mSeconds ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatCanonicalDateTime(detail.createdAtEpochMillis)}</Descriptions.Item>
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
                      status === 'UNKNOWN' ? '未知' : status === 'VOIDED' ? '已作废' : status === 'DISABLED' ? '停用' : '启用',
                  },
                ]}
              />
              {ruleStoresCursor && <Button onClick={() => void loadMoreRuleStores()}>下一页</Button>}
            </>
          )}
        </>
      )}
    </Drawer>
    <Drawer title="终端版本与任务历史" open={Boolean(versionDetail)} onClose={() => setVersionDetail(undefined)} width={760} {...testId(terminalUpdateTestIds.reportDetail)}>
      {versionDetail && <><Descriptions column={1} bordered size="small"><Descriptions.Item label="终端">{versionDetail.terminalName}</Descriptions.Item><Descriptions.Item label="门店">{versionDetail.storeName}</Descriptions.Item><Descriptions.Item label="报告状态">{versionDetail.hasReport ? '已上报' : '尚无报告'}</Descriptions.Item><Descriptions.Item label="实际 APK">{latestApk}</Descriptions.Item><Descriptions.Item label="实际 JS">{latestJs}</Descriptions.Item><Descriptions.Item label="Runtime">{latestRuntime}</Descriptions.Item><Descriptions.Item label="最近状态">{latestStatus}</Descriptions.Item></Descriptions><Table rowKey={row => row.reportId} dataSource={history} columns={[{title: '报告状态', render: (_, row) => row.recent.state}, {title: '原因', render: (_, row) => row.recent.reason}, {title: '实际 APK', render: (_, row) => row.actual.apkVersion ?? '未知'}, {title: '实际 JS', render: (_, row) => row.actual.jsVersion ?? '未知'}, {title: 'Runtime', render: (_, row) => row.actual.runtimeVersion}, {title: '接收时间', render: (_, row) => formatCanonicalDateTime(row.receivedAtEpochMillis)}]} pagination={false} {...testId(terminalUpdateTestIds.reportHistory)} />{historyCursor && <Button onClick={() => void loadMoreHistory(historyCursor)}>加载更多历史</Button>}</>}
    </Drawer>
    <StatusChangeConfirm open={Boolean(statusTarget)} title={statusTarget?.status === 'ENABLED' ? '停用更新规则' : '启用更新规则'} actionLabel={statusTarget?.status === 'ENABLED' ? '停用' : '启用'} onCancel={() => setStatusTarget(undefined)} onConfirm={() => statusTarget && void changeStatus(statusTarget, statusTarget.status === 'ENABLED' ? 'DISABLED' : 'ENABLED')} confirmTestId={terminalUpdateTestIds.ruleStatusConfirm} cancelTestId="terminal-update-rule-status-cancel" modalTestId="terminal-update-rule-status-confirmation" />
    <OperationsAuditHistoryModal open={auditOpen} target={detail ? {entityType: 'TERMINAL_UPDATE_RULE', entityId: detail.ruleRef, projectRef, displayName: '更新规则'} : undefined} groupWorkspaceKey={queryContext.groupWorkspaceKey} onClose={() => setAuditOpen(false)} />
  </Card>;
}

function jsonObject(value: JsonValue | undefined): value is {[key: string]: JsonValue} {
  return value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value);
}

function textValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function RuleCreateDrawer({open, queryContext, projectRef, onClose, onCreated}: {open: boolean; queryContext: OperationsPageProps['queryContext']; projectRef: string; onClose: () => void; onCreated: () => Promise<void>}) {
  const [form] = Form.useForm<RuleForm>();
  const lifecycle = useDrawerFormLifecycle({open, onOpenChange: next => {if (!next) onClose();}, dirtyMessage: '填写中的更新规则不会保存。', idempotencyKey: true});
  const [problem, setProblem] = useState<string>();
  const [fullCandidates, setFullCandidates] = useState<Candidate[]>([]);
  const [hotCandidates, setHotCandidates] = useState<Candidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const targetMode = Form.useWatch('targetMode', form) ?? 'ALL';
  const fullArtifactRef = Form.useWatch('fullArtifactRef', form);
  const hotStrategy = Form.useWatch('hotStrategy', form) ?? 'IMMEDIATE';
  const stores = useOrganizationCandidates({open: open && targetMode === 'STORE_REFS', queryContext, subjectType: 'STORE', projectId: projectRef, pageSize: 50});
  useOverlayLock(open);
  useEffect(() => {
    if (!open) return;
    form.resetFields(); form.setFieldsValue({targetMode: 'ALL', nMinutes: 5, hotStrategy: 'IMMEDIATE'}); setProblem(undefined);
    setLoadingCandidates(true);
    void operationsClient.getOperationsTerminalUpdateArtifactCandidatePage({groupWorkspaceKey: queryContext.groupWorkspaceKey}, {query: {expectedContextVersion: queryContext.expectedContextVersion, projectRef: wireUuid(projectRef), kind: 'FULL', limit: 50}})
      .then(page => setFullCandidates(page.items)).catch(error => setProblem(operationsProblemOf(error).detail || '读取更新包候选失败')).finally(() => setLoadingCandidates(false));
  }, [form, open, projectRef, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]);
  const submit = async (values: RuleForm) => {
    setProblem(undefined); lifecycle.setSubmitting(true);
    try {
      const body = {targetMode: values.targetMode, ...(values.targetMode === 'STORE_REFS' ? {storeRefs: (values.storeRefs ?? []).map(wireUuid)} : {}),
        fullArtifactRef: wireUuid(values.fullArtifactRef), ...(values.hotArtifactRef ? {hotArtifactRef: wireUuid(values.hotArtifactRef)} : {}),
        status: 'DISABLED' as const, nSeconds: Math.round(values.nMinutes * 60), hotStrategy: values.hotStrategy,
        ...(values.hotStrategy === 'IDLE' && values.mSeconds !== undefined ? {mSeconds: values.mSeconds} : {}), description: values.description?.trim() || undefined};
      const idempotencyKey = await createContentIdempotencyKey(OPERATIONS_ADMIN_OPERATION_IDS.createOperationsProjectTerminalUpdateRule, body);
      await operationsClient.createOperationsProjectTerminalUpdateRule({groupWorkspaceKey: queryContext.groupWorkspaceKey, projectRef: wireUuid(projectRef)}, {
        query: {expectedContextVersion: queryContext.expectedContextVersion}, body, headers: {'Idempotency-Key': idempotencyKey},
      });
      lifecycle.setDirty(false); await onCreated(); message.success('更新规则已创建，当前为停用状态');
    } catch (error) { setProblem(operationsProblemOf(error).detail || '保存更新规则失败'); }
    finally { lifecycle.setSubmitting(false); }
  };
  const loadHotCandidates = async (minimumFullRef = fullArtifactRef) => {
    if (!minimumFullRef) return;
    setLoadingCandidates(true);
    try {
      const page = await operationsClient.getOperationsTerminalUpdateArtifactCandidatePage({groupWorkspaceKey: queryContext.groupWorkspaceKey}, {query: {expectedContextVersion: queryContext.expectedContextVersion, projectRef: wireUuid(projectRef), kind: 'HOT', minimumFullArtifactRef: wireUuid(minimumFullRef), limit: 50}});
      if (form.getFieldValue('fullArtifactRef') === minimumFullRef) setHotCandidates(page.items);
    }
    catch (error) { setProblem(operationsProblemOf(error).detail || '读取 HOT 候选失败'); }
    finally { setLoadingCandidates(false); }
  };
  return <Drawer title="新建终端更新规则" open={open} onClose={() => lifecycle.requestClose()} width={680} destroyOnClose>
    {problem && <Alert type="error" showIcon message={problem} />}
    <Form form={form} layout="vertical" onFinish={submit} onValuesChange={() => lifecycle.setDirty(true)}>
      <Form.Item name="targetMode" label="应用范围" rules={[{required: true}]}><Select options={[{value: 'ALL', label: '项目全部门店'}, {value: 'STORE_REFS', label: '指定门店'}]} optionRender={option => <span {...testId(terminalUpdateTestIds.targetModeOption(option.value as 'ALL' | 'STORE_REFS'))}>{option.label}</span>} {...testId(terminalUpdateTestIds.targetMode)} /></Form.Item>
      {targetMode === 'STORE_REFS' && <Form.Item name="storeRefs" label="门店" rules={[{required: true}]}><Select mode="multiple" showSearch filterOption={false} onSearch={stores.setStoreSearch} onPopupScroll={stores.onPopupScroll} loading={stores.isFetching} options={stores.items.map(item => ({value: item.id, label: `${item.name} · ${item.code}`}))} optionRender={option => <span {...testId(terminalUpdateTestIds.storeRefOption(String(option.value)))}>{option.label}</span>} {...testId(terminalUpdateTestIds.storeRefs)} /></Form.Item>}
      <Form.Item name="fullArtifactRef" label="FULL 更新包" rules={[{required: true}]}><Select showSearch loading={loadingCandidates} options={fullCandidates.map(item => ({value: item.artifactRef, label: `${item.applicationId} · ${item.apkVersion} · ${item.runtimeVersion}`}))} optionRender={option => <span {...testId(terminalUpdateTestIds.fullArtifactOption(String(option.value)))}>{option.label}</span>} onChange={value => {form.setFieldValue('hotArtifactRef', undefined); setHotCandidates([]); void loadHotCandidates(value);}} {...testId(terminalUpdateTestIds.fullArtifact)} /></Form.Item>
      <Form.Item name="hotArtifactRef" label="HOT 更新包"><Select allowClear showSearch loading={loadingCandidates} options={hotCandidates.map(item => ({value: item.artifactRef, label: `${item.applicationId} · ${item.jsVersion} · ${item.runtimeVersion}`}))} optionRender={option => <span {...testId(terminalUpdateTestIds.hotArtifactOption(String(option.value)))}>{option.label}</span>} {...testId(terminalUpdateTestIds.hotArtifact)} /></Form.Item>
      <Form.Item name="nMinutes" label="检查间隔（分钟）" rules={[{required: true}]}><InputNumber min={1} max={1440} precision={0} style={{width: '100%'}} {...testId(terminalUpdateTestIds.nMinutes)} /></Form.Item>
      <Form.Item name="hotStrategy" label="HOT 执行策略" rules={[{required: true}]}><Select options={[{value: 'IMMEDIATE', label: '立即执行'}, {value: 'IDLE', label: '空闲时执行'}]} optionRender={option => <span {...testId(terminalUpdateTestIds.hotStrategyOption(option.value as 'IMMEDIATE' | 'IDLE'))}>{option.label}</span>} {...testId(terminalUpdateTestIds.hotStrategy)} /></Form.Item>
      {hotStrategy === 'IDLE' && <Form.Item name="mSeconds" label="空闲时长（秒）"><InputNumber min={1} precision={0} style={{width: '100%'}} {...testId(terminalUpdateTestIds.mSeconds)} /></Form.Item>}
      <Form.Item name="description" label="说明"><Input.TextArea maxLength={500} {...testId(terminalUpdateTestIds.description)} /></Form.Item>
      <Space><Button onClick={() => lifecycle.requestClose()}>取消</Button><Button type="primary" htmlType="submit" loading={lifecycle.submitting} {...testId(terminalUpdateTestIds.createRuleSubmit)}>保存并创建</Button></Space>
    </Form>
  </Drawer>;
}
