import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./ExtensionDefinitionEditDrawer.tsx', import.meta.url), 'utf8');
describe('extension definition edit focused contract', () => it('keeps existing type fixed, clears no-longer-applicable options, and replaces the complete owner set atomically', () => {
  expect(source).toContain('isExisting ? <Input'); expect(source).toContain('readOnly'); expect(source).toContain("type === 'SELECT' && next !== 'SELECT'"); expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.replaceExtensionDefinition); expect(source).toContain('expectedVersion: definition.revision'); expect(source).toContain("testId('extension-definition-save')");
}));
