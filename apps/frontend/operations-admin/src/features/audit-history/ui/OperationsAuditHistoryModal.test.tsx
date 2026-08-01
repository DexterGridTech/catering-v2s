import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./OperationsAuditHistoryModal.tsx', import.meta.url), 'utf8');

describe('operations audit history focused IA contract', () => {
  it('uses the generated RTK task-read without a handwritten client or response cache', () => {
    expect(source).toContain('operationsAdminRtkRequest.getOperationsEntityAuditHistory');
    expect(source).toContain('operationsRtk.useGetOperationsEntityAuditHistoryQuery');
    expect(source).toContain('[groupWorkspaceKey, page, target?.entityId, target?.entityType]');
    expect(source).not.toContain('operationsClient.getOperationsEntityAuditHistory');
  });

  it('keeps the approved Modal master-detail information hierarchy and retry boundary', () => {
    expect(source).toContain('item.actorDisplayName} · {action(item.action)');
    expect(source).toContain('formatOccurredAt(item.occurredAt)');
    expect(source).toContain('query.data.items[0]?.id');
    expect(source).toContain('onClick={() => void query.refetch()}');
    expect(source).toContain("PLATFORM_COMMON_ACCESS_DENIED");
    expect(source).toContain("PLATFORM_COMMON_RESOURCE_NOT_FOUND");
    expect(source).not.toContain('item.target.entityId');
    expect(source).not.toContain('item.target.entityType');
  });

  it('renders owner audit vocabulary as readable business labels', () => {
    expect(source).toContain('WORKSPACE_ACCOUNT_CREDENTIAL_RESET_REQUESTED');
    expect(source).toContain("CONTRACT_UPDATED: '已更新合同'");
    expect(source).toContain("phaseName: '项目分期'");
    expect(source).toContain("items: '货号'");
  });
});
