import {Alert, Button, Card, Descriptions, Empty, Input, Space, Tag, Tree} from 'antd';
import {adminHierarchyCollator, formatNameCode, testId, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsClient, operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {ACTION_CAPABILITIES} from '../../../app/catalog/generatedAdminCatalog';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {OperationsAuditHistoryModal} from '../../audit-history';
import type {OperationsPageProps} from '../../../app/routing/model';
import {OrganizationEditDrawer} from './OrganizationEditDrawer';
import {CommercialGroupEditDrawer} from './CommercialGroupEditDrawer';
import {OrganizationStatusModal} from './OrganizationStatusModal';
import {ProjectCreateDrawer} from './ProjectCreateDrawer';
import {RegionCreateDrawer} from './RegionCreateDrawer';
import {issue, nodeTypeLabel, organizationRegionCreateLabel, organizationStatusLabel, rowFromCommercialGroup, rowFromNode, rowsOf, type HierarchyRow, organizationStructurePageTitle} from './organizationStructureShared';
import {organizationExtensionDetailItems, useOrganizationExtensionDefinition} from './OrganizationExtensionFields';

function treeNodeTitle(row: HierarchyRow) {
  return <span><Tag color="cyan">{nodeTypeLabel(row.nodeType)}</Tag><span>{formatNameCode(row.name, row.code)}</span>{row.status === 'DISABLED' && <Tag color="default">已停用</Tag>}</span>;
}

const hierarchyNameCollator = adminHierarchyCollator;
const hierarchySearchMatches = (row: Pick<HierarchyRow, 'name' | 'code'>, query: string) => {
  const normalized = query.trim().toLocaleLowerCase('zh-CN');
  return !normalized || row.name.toLocaleLowerCase('zh-CN').includes(normalized) || row.code.toLocaleLowerCase('zh-CN').includes(normalized);
};

export function OrganizationStructurePage({queryContext, actionCapabilityKeys}: OperationsPageProps) {
  const [commandProblem, setProblem] = useState<string>();
  const [regionCreateOpen, setRegionCreateOpen] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [editing, setEditing] = useState<HierarchyRow>();
  const [editingCommercialGroup, setEditingCommercialGroup] = useState<HierarchyRow>();
  const [transitionTarget, setTransitionTarget] = useState<HierarchyRow>();
  const [selected, setSelected] = useState<HierarchyRow>();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [hierarchySearch, setHierarchySearch] = useState('');
  const submission = useSubmissionLifecycle();
  const canCreateRegion = actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_REGION_CREATE);
  const canCreateProject = actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_PROJECT_CREATE);
  const request = useMemo(() => operationsAdminRtkRequest.getOperationsOrganizationHierarchy({groupWorkspaceKey: queryContext.groupWorkspaceKey}, {}), [queryContext.groupWorkspaceKey]);
  const {data: snapshot, error, isLoading} = operationsRtk.useGetOperationsOrganizationHierarchyQuery(request);
  const rows = useMemo(() => rowsOf(snapshot), [snapshot]);
  const problem = error ? issue(operationsProblemOf(error)) : commandProblem;
  const commercialGroup = rows.find((row) => row.nodeType === 'GROUP');
  const definition = useOrganizationExtensionDefinition({
    queryContext,
    entityType: selected?.nodeType === 'GROUP' ? 'COMMERCIAL_GROUP' : selected?.nodeType === 'PROJECT' ? 'PROJECT' : 'REGION',
    enabled: Boolean(selected),
  });

  useEffect(() => { setSelected(undefined); }, [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]);

  const treeData = useMemo(() => {
    if (!commercialGroup) return [];
    const childrenOf = (parentId: string | null) => rows.filter((row) => row.nodeType !== 'GROUP' && row.parentId === parentId).sort((left, right) => hierarchyNameCollator.compare(left.name, right.name));
    const regions = childrenOf(null).flatMap((region) => {
      const projects = childrenOf(region.id).filter((project) => hierarchySearchMatches(project, hierarchySearch));
      return hierarchySearchMatches(region, hierarchySearch) || projects.length ? [{
        key: region.id,
        title: treeNodeTitle(region),
        children: hierarchySearchMatches(region, hierarchySearch) ? childrenOf(region.id).map((project) => ({key: project.id, title: treeNodeTitle(project)})) : projects.map((project) => ({key: project.id, title: treeNodeTitle(project)})),
      }] : [];
    });
    const rootMatches = hierarchySearchMatches(commercialGroup, hierarchySearch);
    if (hierarchySearch.trim() && !rootMatches && regions.length === 0) return [];
    return [{
      key: commercialGroup.id,
      title: treeNodeTitle(commercialGroup),
      children: rootMatches ? childrenOf(null).map((region) => ({key: region.id, title: treeNodeTitle(region), children: childrenOf(region.id).map((project) => ({key: project.id, title: treeNodeTitle(project)}))})) : regions,
    }];
  }, [commercialGroup, hierarchySearch, rows]);
  useEffect(() => {
    setExpandedKeys(treeData.flatMap((group) => [String(group.key), ...(group.children ?? []).map((region) => String(region.key))]));
  }, [treeData]);

  const canEdit = (row: HierarchyRow) => row.nodeType === 'GROUP'
    ? actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_GROUP_EDIT)
    : row.nodeType === 'REGION'
      ? actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_REGION_EDIT)
      : row.nodeType === 'PROJECT' && actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_PROJECT_EDIT);
  const canTransition = (row: HierarchyRow) => row.nodeType === 'REGION'
    ? actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_REGION_STATUS)
    : row.nodeType === 'PROJECT' && actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_PROJECT_STATUS);
  const transition = async (row: HierarchyRow) => {
    if (!row.status || row.revision === undefined) return;
    submission.markBusinessIntentChanged();
    setTransitioning(true);
    setProblem(undefined);
    try {
      const readback = await operationsClient.transitionOperationsOrganizationNodeStatus(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, nodeId: row.id},
        {body: {targetStatus: row.status === 'ENABLED' ? 'DISABLED' : 'ENABLED', expectedVersion: row.revision}, headers: {'Idempotency-Key': submission.getIdempotencyKey()}},
      );
      setSelected(rowFromNode(readback));
      setTransitionTarget(undefined);
    } catch (cause) {
      setProblem(issue(cause));
    } finally {
      setTransitioning(false);
    }
  };

  const detailActions = selected ? <Space size={8} wrap>
    <Button onClick={() => setAuditOpen(true)} {...testId('operations-organization-audit')}>操作历史</Button>
    {selected.nodeType === 'GROUP' && canCreateRegion && <Button type="primary" onClick={() => setRegionCreateOpen(true)} {...testId('operations-region-create')}>{organizationRegionCreateLabel}</Button>}
    {selected.nodeType === 'REGION' && canCreateProject && <Button type="primary" onClick={() => setProjectCreateOpen(true)} {...testId('operations-project-create')}>新建项目</Button>}
    {canEdit(selected) && <Button onClick={() => { if (selected.nodeType === 'GROUP') setEditingCommercialGroup(selected); else setEditing(selected); }} {...testId('operations-organization-edit')}>编辑</Button>}
    {canTransition(selected) && <Button onClick={() => setTransitionTarget(selected)} {...testId('operations-organization-status')}>{selected.status === 'ENABLED' ? '停用' : '启用'}</Button>}
  </Space> : undefined;

  return <Card aria-label={organizationStructurePageTitle} {...testId('operations-organization-structure')}>
    <div style={{marginBottom: 16, color: 'var(--ant-color-text-secondary)'}}>维护集团、大区和项目的组织层级；选择节点查看详情并执行已获授权的管理操作。</div>
    {problem && <Alert type="error" showIcon title="组织结构页面失败" description={problem} style={{marginBottom: 16}}/>}
    <div style={{display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(340px, 1.35fr)', gap: 16}}>
      <Card size="small" title="组织架构" style={{minWidth: 0}} styles={{body: {display: 'flex', flexDirection: 'column', gap: 12, minHeight: 360}}}><Input allowClear placeholder="按名称或编码搜索" value={hierarchySearch} onChange={(event) => setHierarchySearch(event.target.value)} {...testId('operations-organization-hierarchy-search')}/><div style={{flex: 1, minHeight: 0, maxHeight: 440, overflow: 'auto', paddingRight: 4}}>{treeData.length ? <Tree aria-label="集团大区项目组织树" treeData={treeData} expandedKeys={expandedKeys} onExpand={(keys) => setExpandedKeys(keys.map(String))} selectedKeys={selected ? [selected.id] : []} onSelect={(keys) => { const id = String(keys[0] ?? ''); if (!id) return; setSelected(rows.find((row) => row.id === id)); }}/> : <Empty description="未找到匹配的组织"/>}</div></Card>
      <Card size="small" title="组织详情" style={{minWidth: 0, alignSelf: 'start'}} extra={detailActions}>
        {selected ? <>
          {definition.error && <Alert type="error" showIcon title="扩展字段加载失败" description="请关闭后重新进入。" style={{marginBottom: 16}}/>}
          <Descriptions bordered size="small" column={1} styles={{label: {width: 164}}} items={[
            {key: 'name', label: '名称', children: selected.name},
            {key: 'code', label: '编码', children: selected.code},
            {key: 'status', label: '状态', children: organizationStatusLabel(selected.status)},
            {key: 'notes', label: '备注', children: selected.notes ?? '—'},
            ...(selected.nodeType === 'PROJECT' ? [{key: 'phases', label: '项目分期名称', children: selected.phases.join('、') || '—'}] : []),
            ...organizationExtensionDetailItems(definition.data, selected.extensionValues),
          ]}/>
        </> : '请选择集团、大区或项目查看详情'}
      </Card>
    </div>
    <RegionCreateDrawer open={regionCreateOpen} commercialGroup={commercialGroup} queryContext={queryContext} onClose={() => setRegionCreateOpen(false)} onCreated={(node) => { setSelected(rowFromNode(node)); }}/>
    <ProjectCreateDrawer open={projectCreateOpen} region={selected?.nodeType === 'REGION' ? selected : undefined} queryContext={queryContext} onClose={() => setProjectCreateOpen(false)} onCreated={(node) => { setSelected(rowFromNode(node)); }}/>
    <OrganizationEditDrawer node={editing} parentName={editing?.nodeType === 'PROJECT' ? rows.find((row) => row.id === editing.parentId)?.name : commercialGroup?.name} queryContext={queryContext} onClose={() => setEditing(undefined)} onUpdated={(node) => { setSelected(node); setEditing(undefined); }}/>
    <CommercialGroupEditDrawer group={editingCommercialGroup} queryContext={queryContext} onClose={() => setEditingCommercialGroup(undefined)} onUpdated={(group) => { setSelected(rowFromCommercialGroup(group)); setEditingCommercialGroup(undefined); }}/>
    <OrganizationStatusModal target={transitionTarget} submitting={transitioning} onCancel={() => setTransitionTarget(undefined)} onConfirm={(target) => void transition(target)}/>
    <OperationsAuditHistoryModal open={auditOpen} target={selected ? {entityType: selected.nodeType === 'GROUP' ? 'COMMERCIAL_GROUP' : 'ORGANIZATION_NODE', entityId: selected.id, displayName: selected.name} : undefined} groupWorkspaceKey={queryContext.groupWorkspaceKey} onClose={() => setAuditOpen(false)}/>
    {isLoading && !snapshot && <span aria-live="polite">正在加载</span>}
  </Card>;
}
