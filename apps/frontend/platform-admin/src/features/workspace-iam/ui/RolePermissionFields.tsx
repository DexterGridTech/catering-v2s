import {Form, Tree, type TreeDataNode} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {useMemo} from 'react';
import type {ServiceNodeType, WorkspaceRole, WorkspaceRolePage} from '../../../app/api/generated/platform-edge';

export type RolePermissionFields = {
  name: string;
  description?: string;
  serviceNodeType: ServiceNodeType;
  pageAccessKeys: string[];
  capabilityKeys: WorkspaceRole['capabilityKeys'];
};

export const serviceNodeTypeLabel = (value: ServiceNodeType) => ({
  GROUP: '集团', REGION: '大区', PROJECT: '项目', HEAD_COMPANY: '总公司', STORE: '门店',
}[value]);

type RoleCatalog = Pick<WorkspaceRolePage, 'pageAccessCatalog' | 'capabilityCatalog'>;
type PermissionTreeNode = TreeDataNode & {children?: PermissionTreeNode[]};

function pageTreeData(catalog: RoleCatalog | undefined, serviceNodeType: ServiceNodeType | undefined): PermissionTreeNode[] {
  const groups = new Map<string, {title: string; order: number; children: PermissionTreeNode[]}>();
  for (const page of catalog?.pageAccessCatalog ?? []) {
    if (!serviceNodeType || !page.eligibleOrganizationTypes.includes(serviceNodeType)) continue;
    const group = groups.get(page.menuGroup) ?? {title: page.menuGroup, order: page.menuOrder, children: []};
    group.children.push({title: page.title, key: page.pageDesignKey});
    groups.set(page.menuGroup, group);
  }
  return [...groups.values()].sort((left, right) => left.order - right.order).map((group) => ({title: group.title, key: `page-group:${group.title}`, selectable: false, children: group.children}));
}

function capabilityTreeData(catalog: RoleCatalog | undefined, serviceNodeType: ServiceNodeType | undefined): PermissionTreeNode[] {
  const groups = new Map<string, {title: string; order: number; children: PermissionTreeNode[]}>();
  for (const capability of catalog?.capabilityCatalog ?? []) {
    if (!serviceNodeType || !capability.organizationTypes.includes(serviceNodeType)) continue;
    const group = groups.get(capability.actionGroupKey) ?? {title: capability.actionGroupLabel, order: capability.actionGroupOrder, children: []};
    group.children.push({title: capability.label, key: capability.key});
    groups.set(capability.actionGroupKey, group);
  }
  return [...groups.values()].sort((left, right) => left.order - right.order).map((group) => ({title: group.title, key: `capability-group:${group.title}`, selectable: false, children: group.children}));
}

function selectedTree(nodes: PermissionTreeNode[], selected: readonly string[]): PermissionTreeNode[] {
  const selectedKeys = new Set(selected);
  return nodes.flatMap((node) => {
    const children = node.children ? selectedTree(node.children, selected) : [];
    return children.length || selectedKeys.has(String(node.key)) ? [{...node, children: children.length ? children : undefined}] : [];
  });
}

function leafKeys(nodes: PermissionTreeNode[]): Set<string> {
  return new Set(nodes.flatMap((node) => node.children?.length ? [...leafKeys(node.children)] : [String(node.key)]));
}

function PermissionTreeField({value = [], onChange, treeData, marker, disabled}: {value?: string[]; onChange?: (value: string[]) => void; treeData: PermissionTreeNode[]; marker: string; disabled: boolean}) {
  const allowedLeafKeys = leafKeys(treeData);
  const {errors} = Form.Item.useStatus();
  return <><div className="workspace-role-permission-tree" {...testId(marker)}>
    <Tree checkable selectable={false} blockNode disabled={disabled} treeData={treeData} checkedKeys={value} defaultExpandAll onCheck={(checkedKeys) => onChange?.((checkedKeys as string[]).filter((key) => allowedLeafKeys.has(key)))}/>
  </div>{errors.length > 0 && <Form.ErrorList errors={errors}/>}</>;
}

/** Two independent owner-catalog trees; menu/action selections are never inferred from each other. */
export function RolePermissionFields({catalog, serviceNodeType, fillDrawer = false}: {catalog?: RoleCatalog; serviceNodeType?: ServiceNodeType; fillDrawer?: boolean}) {
  const pageData = useMemo(() => pageTreeData(catalog, serviceNodeType), [catalog, serviceNodeType]);
  const capabilityData = useMemo(() => capabilityTreeData(catalog, serviceNodeType), [catalog, serviceNodeType]);
  const fields = [
    {name: 'pageAccessKeys', label: '可使用的功能菜单', treeData: pageData, marker: 'workspace-role-page-access', required: true},
    {name: 'capabilityKeys', label: '可执行的操作', treeData: capabilityData, marker: 'workspace-role-capability-access', required: false},
  ] as const;
  return <div className="workspace-role-permission-grid">
    {fields.map((field) => fillDrawer ? <section className="workspace-role-permission-field" aria-label={field.label} key={field.name}>
      <div className="workspace-role-permission-heading">{field.label}</div>
      <Form.Item noStyle name={field.name} rules={field.required ? [{required: true, message: `请选择${field.label}`}] : []}> 
        <PermissionTreeField treeData={field.treeData} marker={field.marker} disabled={!catalog || !serviceNodeType}/>
      </Form.Item>
    </section> : <Form.Item className="workspace-role-permission-field" key={field.name} name={field.name} label={field.label} rules={field.required ? [{required: true, message: `请选择${field.label}`}] : []}> 
      <PermissionTreeField treeData={field.treeData} marker={field.marker} disabled={!catalog || !serviceNodeType}/>
    </Form.Item>)}
  </div>;
}

export function RolePermissionSummaryTrees({catalog, serviceNodeType, pageAccessKeys, capabilityKeys}: {catalog?: RoleCatalog; serviceNodeType: ServiceNodeType; pageAccessKeys: string[]; capabilityKeys: WorkspaceRole['capabilityKeys']}) {
  const pageData = useMemo(() => selectedTree(pageTreeData(catalog, serviceNodeType), pageAccessKeys), [catalog, pageAccessKeys, serviceNodeType]);
  const capabilityData = useMemo(() => selectedTree(capabilityTreeData(catalog, serviceNodeType), capabilityKeys), [capabilityKeys, catalog, serviceNodeType]);
  return <div className="workspace-role-permission-grid workspace-role-permission-grid-readonly">
    <section aria-label="可使用的功能菜单"><div className="workspace-role-permission-heading">可使用的功能菜单</div><div className="workspace-role-permission-tree" {...testId('workspace-role-page-access-summary')}><Tree selectable={false} blockNode treeData={pageData} defaultExpandAll/></div></section>
    <section aria-label="可执行的操作"><div className="workspace-role-permission-heading">可执行的操作</div><div className="workspace-role-permission-tree" {...testId('workspace-role-capability-access-summary')}><Tree selectable={false} blockNode treeData={capabilityData} defaultExpandAll/></div></section>
  </div>;
}
