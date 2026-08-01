import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./ExtensionDefinitionSaveModal.tsx', import.meta.url), 'utf8');
describe('extension definition save result focused contract', () => it('separates saved acknowledgement from conflict latest-readback action', () => {
  expect(source).toContain('useOverlayLock(Boolean(outcome))'); expect(source).toContain('onViewLatest(); onClose();'); expect(source).toContain("testId('extension-definition-view-latest')"); expect(source).toContain("testId('extension-definition-save-confirm')");
}));
