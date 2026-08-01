import {Form, TreeSelect} from 'antd';
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

type Props = {catalog?: Pick<WorkspaceRolePage, 'pageAccessCatalog' | 'capabilityCatalog'>; serviceNodeType?: ServiceNodeType};

/** Catalog eligibility is supplied by the owner; this component only renders it. */
export function RolePermissionFields({catalog, serviceNodeType}: Props) {
  const pageTreeData = useMemo(() => {
    const groups = new Map<string, {title: string; order: number; children: Array<{title: string; value: string}>}>();
    for (const page of catalog?.pageAccessCatalog ?? []) {
      if (!serviceNodeType || !page.eligibleOrganizationTypes.includes(serviceNodeType)) continue;
      const group = groups.get(page.menuGroup) ?? {title: page.menuGroup, order: page.menuOrder, children: []};
      group.children.push({title: page.title, value: page.pageDesignKey});
      groups.set(page.menuGroup, group);
    }
    return [...groups.values()].sort((left, right) => left.order - right.order).map((group) => ({title: group.title, value: `page-group:${group.title}`, selectable: false, children: group.children}));
  }, [catalog?.pageAccessCatalog, serviceNodeType]);
  const capabilityTreeData = useMemo(() => {
    const groups = new Map<string, {title: string; order: number; children: Array<{title: string; value: string}>}>();
    for (const capability of catalog?.capabilityCatalog ?? []) {
      if (!serviceNodeType || !capability.organizationTypes.includes(serviceNodeType)) continue;
      const group = groups.get(capability.actionGroupKey) ?? {title: capability.actionGroupLabel, order: capability.actionGroupOrder, children: []};
      group.children.push({title: capability.label, value: capability.key});
      groups.set(capability.actionGroupKey, group);
    }
    return [...groups.values()].sort((left, right) => left.order - right.order).map((group) => ({title: group.title, value: `capability-group:${group.title}`, selectable: false, children: group.children}));
  }, [catalog?.capabilityCatalog, serviceNodeType]);
  return <>
    <Form.Item name="pageAccessKeys" label="可使用的功能菜单" rules={[{required: true, message: '请选择可使用的功能菜单'}]}>
      <TreeSelect treeCheckable showSearch treeDefaultExpandAll treeData={pageTreeData} placeholder="选择该任职机构类型可使用的功能菜单" {...testId('workspace-role-page-access')}/>
    </Form.Item>
    <Form.Item name="capabilityKeys" label="可执行的操作" rules={[{required: true, message: '请选择可执行的操作'}]}>
      <TreeSelect treeCheckable showSearch treeDefaultExpandAll treeData={capabilityTreeData} placeholder="选择该任职机构类型可执行的操作" {...testId('workspace-role-capability-access')}/>
    </Form.Item>
  </>;
}
