import {Alert, Button, Card, Descriptions, Space, Tree} from 'antd';
import {testId, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsClient, operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {ACTION_CAPABILITIES} from '../../../app/catalog/generatedAdminCatalog';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {OperationsAuditHistoryModal} from '../../audit-history';
import type {OperationsPageProps} from '../../../app/routing/model';
import {OrganizationEditDrawer} from './OrganizationEditDrawer';
import {OrganizationStatusModal} from './OrganizationStatusModal';
import {ProjectCreateDrawer} from './ProjectCreateDrawer';
import {RegionCreateDrawer} from './RegionCreateDrawer';
import {issue, organizationRegionCreateLabel, organizationStatusLabel, rowFromNode, rowsOf, type HierarchyRow, organizationStructurePageTitle} from './organizationStructureShared';

export function OrganizationStructurePage({queryContext, actionCapabilityKeys}: OperationsPageProps) {
  const [commandProblem, setProblem] = useState<string>();
  const [regionCreateOpen, setRegionCreateOpen] = useState(false);
  const [projectCreateOpen, setProjectCreateOpen] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [editing, setEditing] = useState<HierarchyRow>();
  const [transitionTarget, setTransitionTarget] = useState<HierarchyRow>();
  const [selected, setSelected] = useState<HierarchyRow>();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const submission = useSubmissionLifecycle();
  const canCreateRegion = actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_REGION_CREATE);
  const canCreateProject = actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_PROJECT_CREATE);
  const request = useMemo(() => operationsAdminRtkRequest.getOperationsOrganizationHierarchy({groupWorkspaceKey: queryContext.groupWorkspaceKey}, {}), [queryContext.groupWorkspaceKey]);
  const {data: snapshot, error, isLoading} = operationsRtk.useGetOperationsOrganizationHierarchyQuery(request);
  const rows = useMemo(() => rowsOf(snapshot), [snapshot]);
  const problem = error ? issue(operationsProblemOf(error)) : commandProblem;
  const commercialGroup = rows.find((row) => row.nodeType === 'GROUP');

  useEffect(() => { setSelected(undefined); }, [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]);

  const treeData = useMemo(() => {
    if (!commercialGroup) return [];
    const childrenOf = (parentId: string | null) => rows.filter((row) => row.nodeType !== 'GROUP' && row.parentId === parentId);
    return [{
      key: commercialGroup.id,
      title: `${commercialGroup.name}（${commercialGroup.code}）`,
      children: childrenOf(null).map((region) => ({
        key: region.id,
        title: `${region.name}（${region.code}）`,
        children: childrenOf(region.id).map((project) => ({key: project.id, title: `${project.name}（${project.code}）`})),
      })),
    }];
  }, [commercialGroup, rows]);
  useEffect(() => {
    setExpandedKeys(treeData.flatMap((group) => [String(group.key), ...(group.children ?? []).map((region) => String(region.key))]));
  }, [treeData]);

  const canEdit = (row: HierarchyRow) => row.nodeType === 'REGION'
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

  return <Card title={organizationStructurePageTitle} {...testId('operations-organization-structure')} extra={canCreateRegion ? <Button type="primary" onClick={() => setRegionCreateOpen(true)} {...testId('operations-region-create')}>{organizationRegionCreateLabel}</Button> : undefined}>
    {problem && <Alert type="error" showIcon message="组织结构页面失败" description={problem} style={{marginBottom: 16}}/>}
    <div style={{display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(320px, 1.4fr)', gap: 24}}>
      <Tree aria-label="集团大区项目组织树" treeData={treeData} expandedKeys={expandedKeys} onExpand={(keys) => setExpandedKeys(keys.map(String))} selectedKeys={selected ? [selected.id] : []} onSelect={(keys) => setSelected(rows.find((row) => row.id === keys[0]))}/>
      <Card size="small" title="组织详情" extra={selected && selected.nodeType !== 'GROUP' ? <Button onClick={() => setAuditOpen(true)} {...testId('operations-organization-audit')}>操作历史</Button> : undefined}>
        {selected ? <>
          <Descriptions bordered column={1} items={[
            {key: 'name', label: '名称', children: selected.name},
            {key: 'code', label: '编码', children: selected.code},
            {key: 'status', label: '状态', children: organizationStatusLabel(selected.status)},
            {key: 'notes', label: '备注', children: selected.notes ?? '—'},
            ...(selected.nodeType === 'PROJECT' ? [{key: 'phases', label: '项目分期名称', children: selected.phases.join('、') || '—'}] : []),
          ]}/>
          <Space style={{marginTop: 16}} wrap>
            {selected.nodeType === 'REGION' && canCreateProject && <Button type="primary" onClick={() => setProjectCreateOpen(true)} {...testId('operations-project-create')}>新建项目</Button>}
            {canEdit(selected) && <Button onClick={() => { setEditing(selected); setSelected(undefined); }} {...testId('operations-organization-edit')}>编辑</Button>}
            {canTransition(selected) && <Button onClick={() => { setTransitionTarget(selected); setSelected(undefined); }} {...testId('operations-organization-status')}>{selected.status === 'ENABLED' ? '停用' : '启用'}</Button>}
          </Space>
        </> : '请选择集团、大区或项目查看详情'}
      </Card>
    </div>
    <RegionCreateDrawer open={regionCreateOpen} commercialGroup={commercialGroup} queryContext={queryContext} onClose={() => setRegionCreateOpen(false)} onCreated={(node) => { setSelected(rowFromNode(node)); }}/>
    <ProjectCreateDrawer open={projectCreateOpen} region={selected?.nodeType === 'REGION' ? selected : undefined} queryContext={queryContext} onClose={() => setProjectCreateOpen(false)} onCreated={(node) => { setSelected(rowFromNode(node)); }}/>
    <OrganizationEditDrawer node={editing} parentName={editing?.nodeType === 'PROJECT' ? rows.find((row) => row.id === editing.parentId)?.name : commercialGroup?.name} queryContext={queryContext} onClose={() => setEditing(undefined)} onUpdated={(node) => { setSelected(node); setEditing(undefined); }}/>
    <OrganizationStatusModal target={transitionTarget} submitting={transitioning} onCancel={() => setTransitionTarget(undefined)} onConfirm={(target) => void transition(target)}/>
    <OperationsAuditHistoryModal open={auditOpen} target={selected && selected.nodeType !== 'GROUP' ? {entityType: 'ORGANIZATION_NODE', entityId: selected.id, displayName: selected.name} : undefined} groupWorkspaceKey={queryContext.groupWorkspaceKey} onClose={() => setAuditOpen(false)}/>
    {isLoading && !snapshot && <span aria-live="polite">正在加载</span>}
  </Card>;
}
