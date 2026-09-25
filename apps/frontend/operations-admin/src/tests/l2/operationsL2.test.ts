import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';

const source = readFileSync(new URL('./operationsL2.ts', import.meta.url), 'utf8');

function helperBody(name: string, nextMarker: string): string {
  const asyncStart = source.indexOf(`export async function ${name}`);
  const syncStart = source.indexOf(`export function ${name}`);
  const start = asyncStart >= 0 ? asyncStart : syncStart;
  const end = source.indexOf(nextMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('operations L2 select helpers', () => {
  it('does not send Escape after a select already closed its portal', () => {
    const ownerOptionHelper = helperBody(
      'selectOperationsOption',
      '/**\n * A role-locked selector already contains an owner-confirmed fixed value.',
    );
    const fieldOptionHelper = helperBody(
      'selectOperationsFieldOption',
      '/** Selects and explicitly confirms the owner-returned management range required by the current page.',
    );

    for (const helper of [ownerOptionHelper, fieldOptionHelper]) {
      expect(helper).toContain('await closeOperationsSelectDropdown(page);');
      expect(helper.split('await closeOperationsSelectDropdown(page);')[0]).not.toContain(
        "await page.keyboard.press('Escape');",
      );
    }
    expect(source).toContain('await expect(openDropdown).toHaveCount(0, {timeout: 1000});');
    expect(source).toContain("await page.keyboard.press('Escape');");
  });

  it('uses the active portal option with click-first keyboard fallback', () => {
    const ownerOptionHelper = helperBody(
      'selectOperationsOption',
      '/**\n * A role-locked selector already contains an owner-confirmed fixed value.',
    );
    expect(ownerOptionHelper).toContain("const visibleOptions = dropdown.locator('.ant-select-item-option:visible');");
    expect(ownerOptionHelper).toContain('await option.scrollIntoViewIfNeeded();');
    expect(ownerOptionHelper).toContain('await option.click();');
    expect(ownerOptionHelper).toContain('const retryOption = (await activeSelectDropdown(page, input))');
    expect(ownerOptionHelper).toContain('await retryOption.scrollIntoViewIfNeeded();');
    expect(ownerOptionHelper).toContain('await retryOption.click();');
    expect(ownerOptionHelper).toContain('const activeOption = page.locator(`#${activeId}`);');
    expect(ownerOptionHelper).toContain('const activeLabel =');
    expect(ownerOptionHelper).toContain('await input.focus();');
    expect(ownerOptionHelper).toContain("await page.keyboard.press('Home');");
    expect(ownerOptionHelper).toContain("await page.keyboard.press('Enter');");
    expect(ownerOptionHelper).toContain("await input.getAttribute('aria-activedescendant')");
    expect(ownerOptionHelper).not.toContain('force: true');
    expect(ownerOptionHelper).not.toContain("await option.dispatchEvent('click');");
  });

  it('binds option lookup to the active control listbox before using the visible-portal fallback', () => {
    expect(source).toContain("const listboxId = await input.getAttribute('aria-controls');");
    expect(source).toContain('ownerDropdown');
    expect(source).toContain('ant-select-dropdown');
    expect(source).toContain('The last visible');
    expect(source).toContain('const ownerDropdown = listbox');
    expect(source).toContain("dropdown.locator('.ant-select-item-option:visible')");
  });

  it('resolves the visible modal dialog around the declared test-id anchor', () => {
    const helper = helperBody(
      'visibleModalDialogByTestId',
      '/**\n * Detail Drawer actions are rendered in an Ant Design popup portal. Bind both',
    );
    expect(helper).toContain('ancestor-or-self::*[@role="dialog"][1]');
    expect(helper).toContain('.//*[@role="dialog"]');
    expect(helper).toContain('filter({visible: true})');
    expect(helper).not.toContain('return page.getByTestId(testId);');
  });
});
