import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./PlatformAuditHistoryModal.tsx', import.meta.url), 'utf8');

describe('platform audit history focused IA contract', () => {
  it('keeps first-load failures retryable and identifies the actor in the master list', () => {
    expect(source).toContain('platform-audit-history-initial-error');
    expect(source).toContain('item.actorDisplayName} · {action(item.action)');
    expect(source).toContain('onClick={() => void query.refetch()}');
  });

  it('uses a bounded modal body with its own vertical scroll surface', () => {
    expect(source).toContain('height: 640');
    expect(source).toContain('overflowY: \'auto\'');
  });
});
