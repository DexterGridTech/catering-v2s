import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';

const [page, regionCreate, projectCreate, edit, status, phases] = await Promise.all([
  readFile(new URL('./OrganizationStructurePage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./RegionCreateDrawer.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./ProjectCreateDrawer.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./OrganizationEditDrawer.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./OrganizationStatusModal.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./ProjectPhaseFieldList.tsx', import.meta.url), 'utf8'),
]);

describe('organization structure focused IA contract', () => {
  it('keeps the IA04 organization tree as a fixed three-level tree and detail context, not an action list', () => {
    expect(page).toContain('<Tree aria-label="集团大区项目组织树"');
    expect(page).toContain('children: childrenOf(null)');
    expect(page).toContain('children: childrenOf(region.id)');
    expect(page).toContain('organizationStructurePageTitle');
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
    expect(phases).toContain('move(index, index - 1)');
    expect(phases).toContain('move(index, index + 1)');
  });

  it('closes the detail context before independent edit/status surfaces and preserves owner readback', () => {
    expect(page).toContain('setEditing(selected); setSelected(undefined);');
    expect(page).toContain('setTransitionTarget(selected); setSelected(undefined);');
    expect(page).toContain('const readback = await operationsClient.transitionOperationsOrganizationNodeStatus');
    expect(page).toContain('setSelected(rowFromNode(readback));');
    expect(edit).toContain('parentId: node.parentId');
    expect(page).toContain('parentName={editing?.nodeType === \'PROJECT\' ? rows.find((row) => row.id === editing.parentId)?.name : commercialGroup?.name}');
    expect(edit).toContain('value={parentName ?? \'—\'}');
    expect(edit).toContain('phases: node.nodeType === \'PROJECT\' ? projectPhasePayload(values.phaseDrafts) : []');
    expect(edit).toContain('useOverlayLock(Boolean(node))');
    expect(status).toContain('useOverlayLock(Boolean(target))');
    expect(status).toContain('operations-organization-status-cancel');
    expect(status).toContain('operations-organization-status-confirm');
    expect(status).toContain('停用影响由系统在提交后如实提示。');
  });
});
