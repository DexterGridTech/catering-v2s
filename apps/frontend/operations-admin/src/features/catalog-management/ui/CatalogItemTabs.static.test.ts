import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const editorSource = readFileSync(new URL('./CatalogItemEditorTabs.tsx', import.meta.url), 'utf8');
const viewSource = readFileSync(new URL('./CatalogItemViewDrawer.tsx', import.meta.url), 'utf8');

function assertSelectedStateAdapter(source: string): void {
  expect(source).toContain('catalogItemTabTestId');
  expect(source).toContain("data-active={activeTab === tab.tabKey ? 'true' : 'false'}");
}

describe('catalog item tab L2 action adapter', () => {
  it('keeps the stable id on the visible label and exposes selected state', () => {
    for (const source of [editorSource, viewSource]) {
      assertSelectedStateAdapter(source);
    }
  });

  it('turns red if a tab loses the selected-state adapter', () => {
    const mutatedSource = editorSource.replaceAll("data-active={activeTab === tab.tabKey ? 'true' : 'false'}", '');
    expect(() => assertSelectedStateAdapter(mutatedSource)).toThrow();
  });
});
