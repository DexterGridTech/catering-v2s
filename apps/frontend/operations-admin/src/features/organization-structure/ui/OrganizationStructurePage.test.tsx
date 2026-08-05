import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';

const [page, regionCreate, projectCreate, edit, groupEdit, status, phases, extensionFields] = await Promise.all([
  readFile(new URL('./OrganizationStructurePage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./RegionCreateDrawer.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./ProjectCreateDrawer.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./OrganizationEditDrawer.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./CommercialGroupEditDrawer.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./OrganizationStatusModal.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./ProjectPhaseFieldList.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./OrganizationExtensionFields.tsx', import.meta.url), 'utf8'),
]);

describe('organization structure focused IA contract', () => {
  it('keeps the IA04 organization tree as a fixed three-level tree and detail context, not an action list', () => {
    expect(page).toContain('<Tree aria-label="集团大区项目组织树"');
    expect(page).toContain('children: rootMatches ? childrenOf(null).map');
    expect(page).toContain('children: hierarchySearchMatches(region, hierarchySearch) ? childrenOf(region.id).map');
    expect(page).toContain('<Tag color="cyan">');
    expect(page).toContain('treeNodeTitle(commercialGroup)');
    expect(page).toContain('treeNodeTitle(region)');
    expect(page).toContain('treeNodeTitle(project)');
    expect(page).toContain('formatNameCode(row.name, row.code)');
    expect(page).toContain("placeholder=\"按名称或编码搜索\"");
    expect(page).toContain("testId('operations-organization-hierarchy-search')");
    expect(page).toContain("new Intl.Collator('zh-CN', {numeric: true, sensitivity: 'base'})");
    expect(page).toContain('hierarchySearchMatches(project, hierarchySearch)');
    expect(page).toContain('<Tag color="default">已停用</Tag>');
    expect(page).toContain('<Card size="small" title="组织架构"');
    expect(page).toContain('维护集团、大区和项目的组织层级；选择节点查看详情并执行已获授权的管理操作。');
    expect(page).toContain("selected.nodeType === 'GROUP' && canCreateRegion");
    expect(page).toContain('extra={detailActions}');
    expect(page).toContain('size="small" column={1} styles={{label: {width: 164}}}');
    expect(page).toContain("selected.nodeType === 'GROUP' ? 'COMMERCIAL_GROUP' : 'ORGANIZATION_NODE'");
    expect(page).not.toContain('<Space style={{marginTop: 16}} wrap>');
    expect(page).toContain("selected.nodeType === 'PROJECT' ? [{key: 'phases', label: '项目分期名称'");
    expect(page).toContain("selected.phases.join('、') || '—'");
    expect(page).toContain('organizationStructurePageTitle');
    expect(page).not.toContain('title={organizationStructurePageTitle}');
    expect(page).not.toMatch(/title:\s*['"]操作['"]/);
  });

  it('uses fixed parent/type create surfaces and the ordered phase list required by IA04', () => {
    expect(regionCreate).toContain(OPERATIONS_ADMIN_OPERATION_IDS.createOperationsOrganizationRegion);
    expect(regionCreate).not.toContain('name="kind"');
    expect(projectCreate).toContain(OPERATIONS_ADMIN_OPERATION_IDS.createOperationsOrganizationProject);
    expect(projectCreate).toContain('regionId: region.id');
    expect(projectCreate).not.toContain('name="regionId"');
    expect(regionCreate).toContain('useOverlayLock(open)');
    expect(projectCreate).toContain('useOverlayLock(open)');
    expect(phases).toContain('operations-project-phase-add');
    expect(phases).toContain("name={[field.name, 'name']}");
    expect(phases).not.toContain('<Form.Item {...field} noStyle');
    expect(phases).toContain('move(index, index - 1)');
    expect(phases).toContain('move(index, index + 1)');
  });

  it('closes the detail context before independent edit/status surfaces and preserves owner readback', () => {
    expect(page).toContain("if (selected.nodeType === 'GROUP') setEditingCommercialGroup(selected); else setEditing(selected); setSelected(undefined);");
    expect(page).toContain('setTransitionTarget(selected); setSelected(undefined);');
    expect(page).toContain('const readback = await operationsClient.transitionOperationsOrganizationNodeStatus');
    expect(page).toContain('setSelected(rowFromNode(readback));');
    expect(edit).toContain('parentId: node.parentId');
    expect(page).toContain('parentName={editing?.nodeType === \'PROJECT\' ? rows.find((row) => row.id === editing.parentId)?.name : commercialGroup?.name}');
    expect(edit).toContain('<Typography.Text>{parentName ?? \'—\'}</Typography.Text>');
    expect(edit).not.toContain('<Input readOnly value={parentName');
    expect(edit).toContain('phases: node.nodeType === \'PROJECT\' ? projectPhasePayload(values.phaseDrafts) : []');
    expect(edit).toContain('useOverlayLock(Boolean(node))');
    expect(status).toContain('useOverlayLock(Boolean(target))');
    expect(status).toContain('operations-organization-status-cancel');
    expect(status).toContain('operations-organization-status-confirm');
    expect(status).toContain('停用影响由系统在提交后如实提示。');
  });

  it('uses the generated per-host definition for all three organization extension value surfaces', () => {
    expect(extensionFields).toContain('getOperationsOrganizationHierarchyExtensionDefinition');
    expect(extensionFields).toContain("'COMMERCIAL_GROUP' | 'REGION' | 'PROJECT'");
    expect(extensionFields).toContain('hydrateOrganizationExtensionValues');
    expect(extensionFields).toContain('serializeOrganizationExtensionValues');
    expect(extensionFields).toContain('organizationExtensionDetailItems');
    expect(extensionFields).toContain("field.type === 'DATE'");
    expect(extensionFields).toContain('<DatePicker');
    expect(extensionFields).toContain("field.type === 'BOOLEAN'");
    expect(regionCreate).toContain("entityType: 'REGION'");
    expect(projectCreate).toContain("entityType: 'PROJECT'");
    expect(edit).toContain("node?.nodeType === 'PROJECT' ? 'PROJECT' : 'REGION'");
    expect(page).toContain("selected?.nodeType === 'GROUP' ? 'COMMERCIAL_GROUP'");
    expect(page).toContain('organizationExtensionDetailItems(definition.data, selected.extensionValues)');
    expect(groupEdit).toContain("entityType: 'COMMERCIAL_GROUP'");
    expect(groupEdit).toContain(OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsCommercialGroup);
    expect(groupEdit).toContain('updateOperationsCommercialGroup');
    expect(groupEdit).toContain('expectedVersion: group.revision');
    expect(groupEdit).toContain("'Idempotency-Key': lifecycle.getIdempotencyKey()");
    expect(groupEdit).toContain("testId('operations-commercial-group-edit-submit')");
    expect(groupEdit).toContain('useOverlayLock(Boolean(group))');
    expect(groupEdit).toContain('maskClosable');
    expect(groupEdit).not.toContain('<Input readOnly');
    expect(regionCreate + projectCreate + edit + groupEdit).toContain('disabled={!definitionReady}');
  });

  it('renders the persisted group-edit grant as one owner-backed edit path without inferring a group-status action', () => {
    expect(page).toContain("row.nodeType === 'GROUP'");
    expect(page).toContain('ACTION_CAPABILITIES.ORG_GROUP_EDIT');
    expect(page).toContain("? actionCapabilityKeys.includes(ACTION_CAPABILITIES.ORG_GROUP_EDIT)");
    expect(page).toContain('<CommercialGroupEditDrawer');
    expect(page).toContain('rowFromCommercialGroup(group)');
    expect(page).not.toContain('ACTION_CAPABILITIES.ORG_GROUP_STATUS');
  });
});
