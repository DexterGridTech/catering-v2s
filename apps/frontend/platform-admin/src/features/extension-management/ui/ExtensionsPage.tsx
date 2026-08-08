import {ProTable} from '@ant-design/pro-components';
import {Alert, Button, Card, Empty, Layout, Menu, Space, Spin, Typography} from 'antd';
import {contextScopedQueryArgs, testId, useAsyncGenerationGuard, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useCallback, useMemo, useState} from 'react';
import {WorkspaceScope} from '../../../app/state/WorkspaceScope';
import {platformAdminRtkRequest} from '../../../app/api/generated/platform-edge.rtk';
import {platformProblemOf, platformRtk, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {adminCatalog, platformPageDesignKeys} from '../../../app/catalog/generatedAdminCatalog';
import type {ExtensionDefinition, ExtensionEntityCatalogPage} from '../../../app/api/generated/platform-edge';
import {ExtensionDefinitionEditDrawer} from './ExtensionDefinitionEditDrawer';
import {ExtensionDefinitionSaveModal} from './ExtensionDefinitionSaveModal';
import {PlatformAuditHistoryModal, type PlatformAuditTarget} from '../../audit-history';

type ExtensionCatalogItem = ExtensionEntityCatalogPage['items'][number];
type DefinitionField = ExtensionDefinition['definitions'][number];

const fieldTypeLabel = (value: DefinitionField['type']) => ({TEXT: '文本', NUMBER: '数值', DATE: '日期', BOOLEAN: '是/否', SELECT: '单选'}[value]);
const fieldStatusLabel = (value: DefinitionField['status']) => value === 'ENABLED' ? '启用' : '停用';
const configurationTime = (updatedAt: number) => updatedAt > 0 ? new Date(updatedAt).toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'}) : '暂未配置';
const extensionPage = adminCatalog.platformPages.find((page) => page.pageDesignKey === platformPageDesignKeys.PlatformExtensionFields);
if (!extensionPage) throw new Error('Missing generated extension page');
const extensionPageTitle = extensionPage.title;

export function ExtensionsPage() {
  return <WorkspaceScope>{(key) => <ExtensionsForWorkspace groupWorkspaceKey={key}/>}</WorkspaceScope>;
}

/** IA03: a fixed business-category rail and one category's full definition content, never an action table. */
function ExtensionsForWorkspace({groupWorkspaceKey}: {groupWorkspaceKey: string}) {
  const [selected, setSelected] = useState<ExtensionCatalogItem>();
  const [definition, setDefinition] = useState<ExtensionDefinition>();
  const [editingDefinition, setEditingDefinition] = useState<ExtensionDefinition>();
  const [commandProblem, setProblem] = useState<PlatformApiProblem>();
  const [resultNotice, setResultNotice] = useState<'saved' | 'conflict'>();
  const [auditTarget, setAuditTarget] = useState<PlatformAuditTarget>();
  const generation = useAsyncGenerationGuard();
  useOverlayLock(Boolean(editingDefinition) || Boolean(auditTarget));
  const context = useMemo(() => contextScopedQueryArgs({}, {groupWorkspaceKey}), [groupWorkspaceKey]);
  const catalogRequest = useMemo(() => platformAdminRtkRequest.getExtensionEntityCatalog({groupWorkspaceKey: context.groupWorkspaceKey}, {}), [context.groupWorkspaceKey]);
  const {data: result, error, isLoading, refetch: refetchCatalog} = platformRtk.useGetExtensionEntityCatalogQuery(catalogRequest);
  const [loadDefinition, {isFetching}] = platformRtk.useLazyGetExtensionDefinitionQuery();
  const catalogProblem = error ? platformProblemOf(error) : undefined;
  const definitionProblem = commandProblem;
  const selectCategory = useCallback((row: ExtensionCatalogItem) => {
    const request = generation.begin();
    setSelected(row); setDefinition(undefined); setProblem(undefined); setResultNotice(undefined);
    void loadDefinition(platformAdminRtkRequest.getExtensionDefinition({groupWorkspaceKey: context.groupWorkspaceKey, entityType: row.entityType}, {})).unwrap()
      .then((next) => { if (generation.isCurrent(request)) setDefinition(next); })
      .catch((nextError) => { if (generation.isCurrent(request)) setProblem(platformProblemOf(nextError)); });
  }, [context.groupWorkspaceKey, generation, loadDefinition]);
  const reloadCurrent = () => { const row = result?.items.find((item) => item.entityType === selected?.entityType); if (row) selectCategory(row); };
  return <Card title={<Typography.Paragraph aria-label={extensionPageTitle} type="secondary" style={{margin: 0}}>选择业务对象后，统一维护它在运营管理后台录入和查看时使用的字段。</Typography.Paragraph>} styles={{body: {padding: 20}}}>
    {catalogProblem ? <Alert type="error" showIcon title="暂时无法获取业务对象" description={catalogProblem.detail} action={<Button size="small" onClick={() => void refetchCatalog()} {...testId('extension-catalog-retry')}>重试</Button>}/> : <Layout style={{background: 'transparent', gap: 16, minHeight: 440}}>
      <Layout.Sider width={232} theme="light" style={{background: 'transparent'}}><Card size="small" title="业务对象" extra={<Typography.Text type="secondary">{result?.items.length ?? 0} 类</Typography.Text>} styles={{body: {padding: 8, background: '#fafbfc'}}}><Typography.Paragraph type="secondary" style={{fontSize: 12, margin: '0 8px 8px'}}>选择一个对象，查看并维护其完整字段配置。</Typography.Paragraph>{isLoading ? <div style={{display: 'grid', minHeight: 240, placeItems: 'center'}}><Spin/></div> : <Menu mode="inline" selectedKeys={selected ? [selected.entityType] : []} items={(result?.items ?? []).map((row) => ({key: row.entityType, label: row.displayName, onClick: () => selectCategory(row)}))} {...testId('extension-category-selector')}/>}</Card></Layout.Sider>
      <Layout.Content style={{minWidth: 0}}><Card size="small" title={selected ? <Typography.Text strong>{selected.displayName}字段配置</Typography.Text> : '字段配置'} extra={selected && definition ? <Space><Button onClick={() => setAuditTarget({entityType: 'EXTENSION_DEFINITION', entityId: selected.entityType, displayName: selected.displayName})} {...testId('extension-definition-audit-history')}>操作历史</Button><Button type="primary" onClick={() => setEditingDefinition(definition)} {...testId('extension-definition-edit')}>编辑字段</Button></Space> : undefined} styles={{body: {minHeight: 400}}}>{!selected ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Space direction="vertical" size={2}><Typography.Text>请选择业务对象</Typography.Text><Typography.Text type="secondary">字段配置按对象分别维护，不会混用。</Typography.Text></Space>} style={{marginTop: 104}}/> : isFetching || (!definition && !definitionProblem) ? <div style={{display: 'grid', minHeight: 300, placeItems: 'center'}}><Spin tip="正在读取字段配置"/></div> : definitionProblem ? <Alert type="error" showIcon title={`暂时无法获取${selected.displayName}字段配置`} description={definitionProblem.detail} action={<Button size="small" onClick={reloadCurrent} {...testId('extension-definition-retry')}>重试</Button>}/> : <>
        <Typography.Paragraph type="secondary" style={{margin: '0 0 16px'}}>最后更新：{configurationTime(definition!.updatedAt)}</Typography.Paragraph>
        <div {...testId('extension-definition-table')}><ProTable<DefinitionField> size="small" rowKey="key" dataSource={definition!.definitions} search={false} options={false} pagination={false} locale={{emptyText: '暂未配置字段'}} columns={[
          {title: '字段 key', dataIndex: 'key'}, {title: '字段名称', dataIndex: 'label'}, {title: '字段类型', render: (_, row) => fieldTypeLabel(row.type)}, {title: '是否必填', render: (_, row) => row.required ? '是' : '否'},
          {title: '是否启用', render: (_, row) => fieldStatusLabel(row.status)}, {title: '选项', render: (_, row) => row.type === 'SELECT' && row.options.length ? row.options.join('、') : '—'},
        ]}/></div>
      </>}</Card></Layout.Content>
    </Layout>}
    <ExtensionDefinitionEditDrawer definition={editingDefinition} displayName={selected?.displayName} groupWorkspaceKey={context.groupWorkspaceKey} onClose={() => setEditingDefinition(undefined)} onSaved={(updated) => { setDefinition(updated); setEditingDefinition(undefined); setResultNotice('saved'); }} onConflict={() => { setEditingDefinition(undefined); setDefinition(undefined); setResultNotice('conflict'); }}/>
    <ExtensionDefinitionSaveModal outcome={resultNotice} onClose={() => setResultNotice(undefined)} onViewLatest={reloadCurrent}/>
    <PlatformAuditHistoryModal open={Boolean(auditTarget)} target={auditTarget} groupWorkspaceKey={context.groupWorkspaceKey} onClose={() => setAuditTarget(undefined)}/>
  </Card>;
}
