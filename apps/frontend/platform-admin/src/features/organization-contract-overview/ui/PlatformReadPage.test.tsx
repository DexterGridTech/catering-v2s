import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./PlatformReadPage.tsx', import.meta.url), 'utf8');
describe('organization and contract overview focused contract', () => it('forwards owner filters, clears invalid tab references, links to owner detail, and has no action column', () => {
  expect(source).toContain('contextScopedQueryArgs'); expect(source).toContain('organizationOverviewQuery(tab, organizationFilters, page, pageSize)'); expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.getPlatformContractOverviewPage); expect(source).toContain('filtersForOrganizationTab'); expect(source).toContain('ownerFilterOptions'); expect(source).toContain('openOrganizationDetail'); expect(source).toContain('openContractDetail'); expect(source).not.toMatch(/title:\s*['"]操作['"]/);
}));
