import {type OrganizationHierarchySnapshot, type OrganizationNode} from '../../../app/api/generated/operations-edge';
import {ApiFailure} from '../../../app/api/OperationsTransport';
import {
  ACTION_CAPABILITIES,
  adminCatalog,
  operationsPageDesignKeys,
} from '../../../app/catalog/generatedAdminCatalog';

export type HierarchyRow = {
  id: string;
  nodeType: 'GROUP' | 'REGION' | 'PROJECT';
  parentId: string | null;
  code: string;
  name: string;
  notes?: string | null;
  status?: 'ENABLED' | 'DISABLED';
  phases: string[];
  revision?: number;
};

export type ProjectPhaseDraft = {name?: string};

export type OrganizationMutationForm = {
  code: string;
  name: string;
  notes?: string;
  phaseDrafts?: ProjectPhaseDraft[];
};

const page = adminCatalog.operationsPages.find(
  (item) => item.pageDesignKey === operationsPageDesignKeys.PgOrgStructure,
);
if (!page) throw new Error('ADMIN_CATALOG_ORGANIZATION_STRUCTURE_PAGE_MISSING');

function actionLabelFor(actionKey: string, missing: string) {
  const action = adminCatalog.actions.find((item) => item.actionKey === actionKey);
  if (!action?.actionLabel) throw new Error(missing);
  return action.actionLabel;
}

export const organizationStructurePageTitle = page.pageTitle;
export const organizationRegionCreateLabel = actionLabelFor(
  ACTION_CAPABILITIES.ORG_REGION_CREATE,
  'ADMIN_CATALOG_ORGANIZATION_REGION_CREATE_ACTION_MISSING',
);
export const organizationProjectCreateLabel = actionLabelFor(
  ACTION_CAPABILITIES.ORG_PROJECT_CREATE,
  'ADMIN_CATALOG_ORGANIZATION_PROJECT_CREATE_ACTION_MISSING',
);
export const organizationRegionEditLabel = actionLabelFor(
  ACTION_CAPABILITIES.ORG_REGION_EDIT,
  'ADMIN_CATALOG_ORGANIZATION_REGION_EDIT_ACTION_MISSING',
);
export const organizationProjectEditLabel = actionLabelFor(
  ACTION_CAPABILITIES.ORG_PROJECT_EDIT,
  'ADMIN_CATALOG_ORGANIZATION_PROJECT_EDIT_ACTION_MISSING',
);

export function issue(error: unknown) {
  return error instanceof ApiFailure
    ? `${error.problem.errorCode}：${error.problem.detail}`
    : '无法完成组织结构操作';
}

export function rowsOf(snapshot?: OrganizationHierarchySnapshot): HierarchyRow[] {
  if (!snapshot) return [];
  return [
    {
      id: snapshot.commercialGroup.id,
      nodeType: 'GROUP',
      parentId: null,
      code: snapshot.commercialGroup.groupCode,
      name: snapshot.commercialGroup.groupName,
      phases: [],
      revision: snapshot.commercialGroup.version,
    },
    ...snapshot.items.map((node) => rowFromNode(node)),
  ];
}

export function rowFromNode(node: OrganizationNode): HierarchyRow {
  return {
    id: node.id,
    nodeType: node.nodeType,
    parentId: node.parentId,
    code: node.code,
    name: node.name,
    notes: node.notes,
    status: node.status,
    phases: node.phases.map((phase) => phase.name),
    revision: node.revision,
  };
}

export function nodeTypeLabel(nodeType: HierarchyRow['nodeType']) {
  if (nodeType === 'GROUP') return '商业集团';
  if (nodeType === 'REGION') return '大区';
  return '项目';
}

export function organizationStatusLabel(status?: HierarchyRow['status']) {
  if (status === 'ENABLED') return '已启用';
  if (status === 'DISABLED') return '已停用';
  return '—';
}

export function projectPhaseDrafts(phases: string[]): ProjectPhaseDraft[] {
  return phases.map((name) => ({name}));
}

export function projectPhasePayload(drafts?: ProjectPhaseDraft[]) {
  return (drafts ?? [])
    .map((draft) => draft.name?.trim() ?? '')
    .filter(Boolean)
    .map((name) => ({name}));
}
