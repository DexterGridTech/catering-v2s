import {ApartmentOutlined} from '@ant-design/icons';
import {Alert, Button, Popover, Select, Space, Tooltip, Typography} from 'antd';
import {NameCodeText, testId, useAsyncGenerationGuard, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {useSelector} from 'react-redux';
import {operationsClient} from '../../../app/api/OperationsTransport';
import type {WorkspaceScopeNode, WorkspaceSessionEntry} from '../../../app/api/generated/operations-edge';
import type {OperationsRootState} from '../../../app/state/OperationsStore';

type RequiredDataNodeType = 'NONE' | 'REGION' | 'PROJECT' | 'HEAD_COMPANY' | 'STORE';
type Option = {value: string; label: ReactNode};
type DataScopePage = {requiredDataNodeType: RequiredDataNodeType; noDataNodePrompt: string | null; noCandidatePrompt: string | null; cascadeLevelLabels: readonly string[]};
type Props = {entry: WorkspaceSessionEntry; page?: DataScopePage; collapsed?: boolean; disabled?: boolean; onChanged: (entry: WorkspaceSessionEntry) => void};

const scopeProblem = '暂时无法更新管理范围，请重试';
const label = (node: WorkspaceScopeNode, emphasizeName = false) => <NameCodeText name={node.dataNodeName} code={node.dataNodeCode} emphasizeName={emphasizeName}/>;
const plainLabel = (node: WorkspaceScopeNode) => [node.dataNodeName, node.dataNodeCode].filter(Boolean).join(' ');
const unique = (values: WorkspaceScopeNode[]): WorkspaceScopeNode[] => [...new Map(values.map((value) => [value.dataNodeRef, value])).values()];
const selectedFor = (context: WorkspaceSessionEntry['scopeContext'], type: RequiredDataNodeType) => type === 'REGION' ? context?.region : type === 'PROJECT' ? context?.project : type === 'STORE' ? context?.store : type === 'HEAD_COMPANY' ? context?.headCompany : null;
const scopeName = (type: RequiredDataNodeType) => type === 'REGION' ? '大区' : type === 'PROJECT' ? '项目' : type === 'STORE' ? '门店' : '总公司';
const selectionPrompt = (type: RequiredDataNodeType) => `请选择${scopeName(type)}`;
const noCandidatePromptFor = (type: RequiredDataNodeType) => `当前角色没有可选择的${scopeName(type)}`;

/** App-owned display selector; owner candidates and scopeContext are the only selection truth. */
export function DataScopeSelector({entry, page, collapsed = false, disabled = false, onChanged}: Props) {
  const type = page?.requiredDataNodeType ?? 'NONE';
  const [open, setOpen] = useState(false);
  // A fixed role still has to display its owner-confirmed path before the
  // Popover is opened.  Keep only the in-flight cascade draft locally; the
  // persisted selection always comes back from the owner in scopeContext.
  const [regionRef, setRegionRef] = useState<string | undefined>(() => entry.scopeContext?.region?.dataNodeRef);
  const [projectRef, setProjectRef] = useState<string | undefined>(() => entry.scopeContext?.project?.dataNodeRef);
  const [storeRef, setStoreRef] = useState<string | undefined>(() => entry.scopeContext?.store?.dataNodeRef);
  const [headCompanyRef, setHeadCompanyRef] = useState<string | undefined>(() => entry.scopeContext?.headCompany?.dataNodeRef);
  const [problem, setProblem] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const lifecycle = useSubmissionLifecycle();
  const generation = useAsyncGenerationGuard();
  const locked = useOverlayLock();
  const candidates = useMemo(() => entry.dataNodeCandidates ?? [], [entry.dataNodeCandidates]);
  const roleType = entry.selected?.roleNodeType;
  const ownerScopeContext = useSelector((state: OperationsRootState) => state.operationsScopeContext.context);
  const context = ownerScopeContext ?? entry.scopeContext;
  const region = context?.region;
  const project = context?.project;
  const store = context?.store;
  const headCompany = context?.headCompany;
  // Fixed ancestors are context, not selectable candidates.  Include them
  // only in Select options so AntD renders the owner label instead of a raw
  // UUID; disabled/owner checks below still govern every possible change.
  const displayNodes = useMemo(() => unique([...candidates, ...[region, project, store, headCompany].filter((node): node is WorkspaceScopeNode => Boolean(node))]), [candidates, headCompany, project, region, store]);
  const regions = useMemo(() => unique(displayNodes.filter((candidate) => candidate.dataNodeType === 'REGION')), [displayNodes]);
  const projects = useMemo(() => unique(displayNodes.filter((candidate) => candidate.dataNodeType === 'PROJECT' && candidate.regionRef === regionRef)), [displayNodes, regionRef]);
  const stores = useMemo(() => unique(displayNodes.filter((candidate) => candidate.dataNodeType === 'STORE' && candidate.regionRef === regionRef && candidate.projectRef === projectRef)), [displayNodes, projectRef, regionRef]);
  const headCompanies = useMemo(() => unique(displayNodes.filter((candidate) => candidate.dataNodeType === 'HEAD_COMPANY')), [displayNodes]);
  const selected = selectedFor(context, type);
  const canChangeRegion = roleType === 'GROUP';
  const canChangeProject = roleType === 'GROUP' || roleType === 'REGION';
  const canChangeStore = roleType === 'GROUP' || roleType === 'REGION' || roleType === 'PROJECT';
  const canChangeHeadCompany = roleType === 'GROUP';

  useEffect(() => {
    setProblem(undefined);
    setRegionRef(region?.dataNodeRef);
    setProjectRef(project?.dataNodeRef);
    setStoreRef(store?.dataNodeRef);
    setHeadCompanyRef(headCompany?.dataNodeRef);
  }, [entry.contextVersion, headCompany?.dataNodeRef, project?.dataNodeRef, region?.dataNodeRef, store?.dataNodeRef]);

  const submit = async (candidate?: WorkspaceScopeNode) => {
    if (!entry.selected || !candidate || submitting || locked || disabled) return;
    const request = generation.begin();
    lifecycle.markBusinessIntentChanged();
    setSubmitting(true);
    setProblem(undefined);
    try {
      const next = await operationsClient.selectOperationsWorkspaceSessionDataNode(
        {groupWorkspaceKey: entry.groupWorkspaceKey},
        {body: {dataNodeRef: candidate.dataNodeRef, dataNodeType: candidate.dataNodeType, requiredContextVersion: entry.contextVersion}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}},
      );
      if (generation.isCurrent(request)) { onChanged(next); setOpen(false); }
    } catch {
      if (generation.isCurrent(request)) setProblem(scopeProblem);
    } finally {
      if (generation.isCurrent(request)) setSubmitting(false);
    }
  };
  const requiredDataNodeType = type;
  if (requiredDataNodeType === 'NONE') return null;
  const noDataNodePrompt = selectionPrompt(type);
  const noCandidatePrompt = noCandidatePromptFor(type);
  const cascadeLevelLabels = page?.cascadeLevelLabels ?? [];
  const cascadeLabel = (index: number, fallback: string) => cascadeLevelLabels[index] ?? fallback;
  const triggerLines: Array<[string, WorkspaceScopeNode | null | undefined]> = type === 'REGION' ? [[cascadeLabel(0, '大区'), region]]
    : type === 'PROJECT' ? [[cascadeLabel(0, '大区'), region], [cascadeLabel(1, '项目'), project]]
      : type === 'STORE' ? [[cascadeLabel(0, '大区'), region], [cascadeLabel(1, '项目'), project], [cascadeLabel(2, '门店'), store]]
        : [['总公司', headCompany]];
  const scopeSummary = triggerLines.map(([name, node]) => `${name}：${node ? plainLabel(node as WorkspaceScopeNode) : '未选择'}`).join('；');
  const option = (nodes: WorkspaceScopeNode[]): Option[] => nodes.map((node) => ({value: node.dataNodeRef, label: label(node)}));
  const candidate = type === 'REGION'
    ? regions.find((node) => node.dataNodeRef === regionRef)
    : type === 'PROJECT'
      ? projects.find((node) => node.dataNodeRef === projectRef)
      : type === 'STORE'
        ? stores.find((node) => node.dataNodeRef === storeRef)
        : headCompanies.find((node) => node.dataNodeRef === headCompanyRef);
  const canConfirm = type === 'REGION'
    ? canChangeRegion
    : type === 'PROJECT'
      ? canChangeProject
      : type === 'STORE'
        ? canChangeStore
        : canChangeHeadCompany;
  const resetDraft = () => {
    setProblem(undefined);
    setRegionRef(region?.dataNodeRef);
    setProjectRef(project?.dataNodeRef);
    setStoreRef(store?.dataNodeRef);
    setHeadCompanyRef(headCompany?.dataNodeRef);
  };
  const content = <Space orientation="vertical" size={12} style={{minWidth: 336, maxHeight: 'calc(100vh - 96px)', overflow: 'auto'}}>
    <Space orientation="vertical" size={2}>
      <Typography.Title level={5} style={{margin: 0}}>{selectionPrompt(type)}</Typography.Title>
    </Space>
    {problem && <Alert type="error" showIcon title={scopeProblem}/>} 
    {type === 'HEAD_COMPANY'
      ? <><Typography.Text>总公司</Typography.Text><Select showSearch style={{width: '100%'}} value={headCompanyRef} aria-label="总公司" options={option(headCompanies)} placeholder="选择总公司" disabled={!canChangeHeadCompany || submitting || locked || disabled} onChange={setHeadCompanyRef} {...testId('operations-data-scope-head-company')}/></>
      : <>
        <Typography.Text>大区</Typography.Text><Select showSearch style={{width: '100%'}} value={regionRef} aria-label="大区" options={option(regions)} placeholder="选择大区" disabled={!canChangeRegion || submitting || locked || disabled} onChange={(value) => { setRegionRef(value); setProjectRef(undefined); setStoreRef(undefined); }} {...testId('operations-data-scope-region')}/>
        {type !== 'REGION' && <><Typography.Text>项目</Typography.Text><Select showSearch style={{width: '100%'}} value={projectRef} aria-label="项目" options={option(projects)} placeholder={regionRef ? '选择项目' : '请先选择大区'} disabled={!regionRef || !canChangeProject || submitting || locked || disabled} onChange={(value) => { setProjectRef(value); setStoreRef(undefined); }} {...testId('operations-data-scope-project')}/></>}
        {type === 'STORE' && <><Typography.Text>门店</Typography.Text><Select showSearch style={{width: '100%'}} value={storeRef} aria-label="门店" options={option(stores)} placeholder={projectRef ? '选择门店' : '请先选择项目'} disabled={!projectRef || !canChangeStore || submitting || locked || disabled} onChange={setStoreRef} {...testId('operations-data-scope-store')}/></>}
      </>}
    <Space style={{width: '100%', justifyContent: 'flex-end'}}>
      <Button onClick={() => { resetDraft(); setOpen(false); }} disabled={submitting} {...testId('operations-data-scope-cancel')}>取消</Button>
      <Button type="primary" disabled={!candidate || !canConfirm || submitting || locked || disabled} loading={submitting} onClick={() => void submit(candidate)}>确认{scopeName(type)}</Button>
    </Space>
    {!candidates.length && <Alert type="info" showIcon title={noCandidatePrompt}/>} 
  </Space>;
  const trigger = <Button className="operations-scope-trigger" type="text" aria-label={collapsed ? `管理范围：${selected ? plainLabel(selected) : noDataNodePrompt}` : `切换可查看范围；${scopeSummary}`} icon={collapsed ? <ApartmentOutlined/> : undefined} disabled={!entry.selected || disabled || locked || submitting} {...testId('operations-data-scope-trigger')}>
      {collapsed ? null : <div className="operations-scope-trigger-summary">
        {triggerLines.map(([name, node]) => <div key={name} className="operations-scope-trigger-line">
          <Typography.Text type="secondary" className="operations-scope-trigger-type">{name}：</Typography.Text>
          <span className="operations-scope-trigger-value">{node ? label(node as WorkspaceScopeNode, true) : <Typography.Text type="secondary">未选择</Typography.Text>}</span>
        </div>)}
      </div>}
    </Button>;
  return <Popover open={open} onOpenChange={(nextOpen) => { if (!nextOpen) resetDraft(); setOpen(nextOpen); }} placement="rightBottom" trigger="click" content={content}>
    {collapsed ? <Tooltip title={<span>管理范围：{selected ? label(selected) : noDataNodePrompt}</span>}><span>{trigger}</span></Tooltip> : trigger}
  </Popover>;
}
