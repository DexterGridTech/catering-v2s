import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';

const source = await readFile(new URL('./DataScopeSelector.tsx', import.meta.url), 'utf8');

describe('operations data-scope focused IA contract', () => {
  it('keeps the scope selector in a right-bottom sidebar Popover and hides it when the page has no scope requirement', () => {
    expect(source).toContain("if (requiredDataNodeType === 'NONE') return null");
    expect(source).toContain('placement="rightBottom"');
    expect(source).toContain('const selectionPrompt = (type: RequiredDataNodeType)');
    expect(source).toContain('请选择${scopeName(type)}');
    expect(source).toContain('当前角色没有可选择的${scopeName(type)}');
    expect(source).toContain("testId('operations-data-scope-trigger')");
    expect(source).toContain('collapsed = false');
    expect(source).toContain('icon={collapsed ? <ApartmentOutlined/> : undefined}');
    expect(source).toContain('管理范围');
    expect(source).not.toContain('点击选择');
    expect(source).toContain('Tooltip title={`管理范围：${selected ? label(selected) : noDataNodePrompt}`}');
  });

  it('derives the region-project-store cascade only from owner candidates and commits only after explicit confirmation', () => {
    expect(source).toContain('entry.dataNodeCandidates ?? []');
    expect(source).toContain("page?.cascadeLevelLabels ?? []");
    expect(source).toContain('setRegionRef(value); setProjectRef(undefined); setStoreRef(undefined)');
    expect(source).toContain('setProjectRef(value); setStoreRef(undefined)');
    expect(source).toContain("candidate.dataNodeType === 'PROJECT' && candidate.regionRef === regionRef");
    expect(source).toContain("candidate.dataNodeType === 'STORE' && candidate.regionRef === regionRef && candidate.projectRef === projectRef");
    expect(source).toContain(OPERATIONS_ADMIN_OPERATION_IDS.selectOperationsWorkspaceSessionDataNode);
    expect(source).toContain('setOpen(false)');
    expect(source).not.toContain('选择完成后，点击确认才会更新当前管理范围。');
    expect(source).toContain('确认{scopeName(type)}');
    expect(source).toContain("style={{width: '100%'}}");
    expect(source).toContain("justifyContent: 'flex-end'");
    expect(source).toContain('暂时无法更新管理范围，请重试');
    expect(source).toContain('useAsyncGenerationGuard');
    expect(source).toContain('useSubmissionLifecycle');
    expect(source).toContain('useOverlayLock');
    expect(source).not.toContain('ApiFailure');
    expect(source).not.toContain('error.problem.detail');
  });

  it('initializes and rehydrates locked role values from the owner-confirmed scope context', () => {
    expect(source).toContain("useState<string | undefined>(() => entry.scopeContext?.region?.dataNodeRef)");
    expect(source).toContain("useState<string | undefined>(() => entry.scopeContext?.project?.dataNodeRef)");
    expect(source).toContain("useState<string | undefined>(() => entry.scopeContext?.store?.dataNodeRef)");
    expect(source).toContain("useState<string | undefined>(() => entry.scopeContext?.headCompany?.dataNodeRef)");
    expect(source).toContain('setStoreRef(store?.dataNodeRef)');
    expect(source).toContain('value={storeRef}');
    expect(source).toContain('const displayNodes = useMemo(() => unique([...candidates');
    expect(source).toContain('displayNodes.filter');
  });
});
