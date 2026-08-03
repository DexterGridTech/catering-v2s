import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./CommercialGroupInitializationDrawer.tsx', import.meta.url), 'utf8');
describe('commercial group initialization focused contract', () => it('submits explicit code/name through owner command with shared drawer lifecycle', () => {
  expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.initializeCommercialGroup); expect(source).toContain('useDrawerFormLifecycle'); expect(source).toContain('useGetExtensionDefinitionQuery'); expect(source).toContain("entityType: 'COMMERCIAL_GROUP'"); expect(source).toContain('extensionValues: extensionValues'); expect(source).toContain("testId('platform-workspace-initialize-code')"); expect(source).toContain("testId('platform-workspace-initialize-submit')");
}));
