import {expect, type Locator, type Page} from '@playwright/test';
import {roleHomeTestIds} from '../../features/role-home-bootstrap/roleHomeTestIds';

export type GeneratedL2Operation = {method: string; path: string};

function operationTemplateRegExp(template: string): RegExp {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

function routeSpecificity(path: string): [number, number, number] {
  const segments = path.split('/').filter(Boolean);
  const staticSegments = segments.filter(segment => !(segment.startsWith('{') && segment.endsWith('}')));
  return [staticSegments.length, staticSegments.reduce((total, segment) => total + segment.length, 0), segments.length];
}

function isMoreSpecific(left: GeneratedL2Operation, right: GeneratedL2Operation): boolean {
  const leftScore = routeSpecificity(left.path);
  const rightScore = routeSpecificity(right.path);
  for (let index = 0; index < leftScore.length; index += 1) {
    if (leftScore[index] !== rightScore[index]) return leftScore[index] > rightScore[index];
  }
  return false;
}

/**
 * Match the most specific generated route. A literal endpoint such as
 * `/terminals/area-candidates` must win over the earlier parameterized
 * `/terminals/{terminalRef}` route; otherwise L2 diagnostics send the wrong
 * operation identity and the real request is rejected as metadata drift.
 */
export function matchGeneratedL2Operation<T extends GeneratedL2Operation>(
  operations: readonly T[],
  method: string,
  pathname: string,
): T | undefined {
  return operations
    .filter(operation => operation.method === method && operationTemplateRegExp(operation.path).test(pathname))
    .reduce<T | undefined>((best, operation) => {
      if (!best || isMoreSpecific(operation, best)) return operation;
      return best;
    }, undefined);
}

export function matchGeneratedL2Path<T extends GeneratedL2Operation>(
  operations: readonly T[],
  pathname: string,
): T | undefined {
  return operations
    .filter(operation => operationTemplateRegExp(operation.path).test(pathname))
    .reduce<T | undefined>((best, operation) => {
      if (!best || isMoreSpecific(operation, best)) return operation;
      return best;
    }, undefined);
}

type OperationsDataScopeType = 'REGION' | 'PROJECT' | 'STORE' | 'HEAD_COMPANY';
type OperationsDataScopeSelection = {
  regionName?: string;
  regionRef?: string;
  projectName?: string;
  projectRef?: string;
  storeName?: string;
  storeRef?: string;
  headCompanyName?: string;
  headCompanyRef?: string;
};
export type OperationsDataScopeTouch = {
  testId: string;
  phase: 'TRIGGER' | 'SELECTOR' | 'OPTION' | 'CONFIRM' | 'CANCEL';
  type?: OperationsDataScopeType;
};
type OperationsDataScopeTouchHandler = (touch: OperationsDataScopeTouch) => void;

async function activeSelectDropdown(page: Page, input: Locator): Promise<Locator> {
  const listboxId = await input.getAttribute('aria-controls');
  if (listboxId) {
    const listbox = page.locator(`#${listboxId}`);
    const ownerDropdown = listbox
      .locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " ant-select-dropdown ")]')
      .first();
    // `aria-controls` can point at Ant Design's accessibility listbox mirror,
    // which may not contain the options rendered in the visible body portal.
    // Only bind to that ancestor when it is itself visible and owns a visible
    // option; otherwise use the current visible portal below.
    if (
      (await ownerDropdown.count()) &&
      (await ownerDropdown.isVisible()) &&
      (await ownerDropdown.locator('.ant-select-item-option:visible').count())
    )
      return ownerDropdown;
  }
  // Ant Design can retain closing portals in the DOM. The last visible
  // portal is the safe fallback only when the input does not expose the
  // active listbox identity.
  return page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible').last();
}

/**
 * Ant Design renders menu actions in a portal separate from the trigger and
 * keeps closing portals in the DOM. Resolve the current visible portal before
 * selecting its real interactive menu item; callers retain command-completion
 * ownership rather than duplicating a click helper per feature suite.
 */
export async function visibleOperationsMenuItem(page: Page, label: string | RegExp) {
  const dropdown = visibleOperationsDropdown(page);
  await expect(dropdown).toBeVisible();
  const item =
    typeof label === 'string'
      ? dropdown.getByRole('menuitem', {name: label, exact: true})
      : dropdown.getByRole('menuitem', {name: label});
  await expect(item).toBeVisible();
  return item;
}

function visibleOperationsDropdown(page: Page): Locator {
  return page.locator('.ant-dropdown:not(.ant-dropdown-hidden):visible').last();
}

/** Open one detail Drawer action Popup and return its current visible portal. */
export async function openOperationsDetailActionMenu(page: Page, actionMenuTestId: string): Promise<Locator> {
  const trigger = page.getByTestId(actionMenuTestId);
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dropdown = visibleOperationsDropdown(page);
  await expect(dropdown).toBeVisible();
  return dropdown;
}

/** Resolve a real menu label anchor in the currently visible detail-action portal. */
export async function visibleOperationsMenuTestId(page: Page, actionTestId: string): Promise<Locator> {
  const dropdown = visibleOperationsDropdown(page);
  await expect(dropdown).toBeVisible();
  const action = dropdown.getByTestId(actionTestId);
  await expect(action).toBeVisible();
  return action;
}

/**
 * Ant Design puts Modal's test id on the zero-layout root and the actual
 * visible surface on its descendant dialog. Keep the declared test id as the
 * binding anchor, but assert and act on the user-facing dialog.
 */
export function visibleModalDialogByTestId(page: Page, testId: string): Locator {
  const anchor = page.getByTestId(testId);
  // Ant Design can place the role=dialog wrapper outside the owner-supplied
  // modalRender wrapper. Resolve the semantic dialog from either side of the
  // test-id anchor, without falling back to a class or position selector.
  return anchor.locator('xpath=ancestor-or-self::*[@role="dialog"][1] | .//*[@role="dialog"]').filter({visible: true});
}

/**
 * Detail Drawer actions are rendered in an Ant Design popup portal. Bind both
 * sides of the interaction to app-owned TestIds instead of relying on the
 * old flat-button location or visible action copy.
 */
export async function clickOperationsDetailAction(
  page: Page,
  actionMenuTestId: string,
  actionTestId: string,
): Promise<void> {
  await openOperationsDetailActionMenu(page, actionMenuTestId);
  const action = await visibleOperationsMenuTestId(page, actionTestId);
  await action.click();
}

/** Select an exact owner-returned option and prove it became this control's value. */
export async function selectOperationsOption(
  page: Page,
  testId: string,
  label?: string,
  optionTestId?: string,
  assertSelectedValue = true,
): Promise<void> {
  const control = page.getByTestId(testId);
  await expect(control).toBeVisible();
  const input = control.locator('input');
  await expect(input).toBeVisible();
  // The test id is attached to Ant Design's wrapper, which remains enabled
  // while the native input is disabled during an owner-query refresh.
  // Wait on the real interactive element before opening its portal.
  await expect(input).toBeEnabled();
  await control.click();
  // Owner options have already been loaded for this control. A rendered
  // `名称(代码)` label is display copy and must not be re-used as an API
  // candidate-query term, which can replace the portal with an empty result.
  // The aria-controls listbox may be an accessibility mirror that is kept
  // inside a visible Ant Design wrapper but is not the pointer target.  The
  // current visible body portal is the only safe interaction surface.
  const dropdown = await activeSelectDropdown(page, input);
  await expect(dropdown).toBeVisible();
  const visibleOptions = dropdown.locator('.ant-select-item-option:visible');
  const option = optionTestId
    ? visibleOptions.getByTestId(optionTestId).last()
    : label
      ? visibleOptions.filter({hasText: label}).last()
      : visibleOptions.last();
  await expect(option).toBeVisible();
  // Bind the target to the option already resolved from this control's active
  // dropdown. Do not query a global aria-controls listbox: nested Drawer
  // portals can retain another listbox with the same label. Click the real
  // visible option first so multiple Selects commit their array value; keep a
  // bounded keyboard fallback for virtualized single Selects.
  const targetLabel = label ?? (await option.innerText()).trim();
  if ((await option.getAttribute('aria-disabled')) === 'true') {
    throw new Error(`OPERATIONS_L2_OPTION_DISABLED:${targetLabel}`);
  }
  // Click the real visible option so rc-select's pointer handler receives the
  // same user interaction as the browser. The value assertion below is the
  // proof that this was a semantic selection, not merely a DOM click.
  await option.scrollIntoViewIfNeeded();
  try {
    await option.click();
  } catch (error) {
    // A controlled Ant Design multiple Select can synchronously replace the
    // option node when the selection is committed. Preserve the semantic
    // interaction by falling through to the bounded keyboard path below, but
    // never hide unrelated click failures.
    if (!String(error).includes('element was detached')) throw error;
  }
  let selectionCommitted = false;
  if (label && assertSelectedValue) {
    try {
      // This is a controlled Select inside a dynamic Form.List. Its displayed
      // value can lag the option click while Form.useWatch publishes the field
      // update. Poll for the semantic result before falling back: clicking the
      // same option again in multiple mode deselects it.
      await expect(control).toContainText(label);
      selectionCommitted = true;
    } catch {
      selectionCommitted = false;
    }
  }
  if (label && assertSelectedValue && !selectionCommitted) {
    // Keep a keyboard fallback for virtualized Selects, but never repeat the
    // pointer click after a possibly committed controlled selection.
    if (!(await activeSelectDropdown(page, input).then(async dropdown => (await dropdown.count()) > 0)))
      await control.click();
    await input.focus();
    await page.keyboard.press('Home');
    let reachedTarget = false;
    for (let step = 0; step < 64; step += 1) {
      const activeId = await input.getAttribute('aria-activedescendant');
      if (activeId) {
        const activeOption = page.locator(`#${activeId}`);
        if (await activeOption.count()) {
          const activeLabel = (
            (await activeOption.getAttribute('aria-label')) ?? (await activeOption.innerText())
          ).trim();
          if (activeLabel === targetLabel) {
            reachedTarget = true;
            break;
          }
        }
      }
      await page.keyboard.press('ArrowDown');
    }
    if (!reachedTarget) throw new Error(`OPERATIONS_L2_OPTION_NOT_REACHABLE:${targetLabel}`);
    await page.keyboard.press('Enter');
  }
  if (label && assertSelectedValue) await expect(control).toContainText(label);
  await closeOperationsSelectDropdown(page);
}

/**
 * Wait for rc-select's normal leave animation before using Escape as a
 * bounded fallback.  Sending Escape immediately after an option click can
 * race the portal's leave transition and close the surrounding Drawer
 * instead; that is especially destructive in a dirty form because it turns
 * a selector interaction into a navigation/discard interaction.
 */
export async function closeOperationsSelectDropdown(page: Page): Promise<void> {
  const openDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible');
  try {
    await expect(openDropdown).toHaveCount(0, {timeout: 1000});
    return;
  } catch {
    if (!(await openDropdown.count())) return;
    await page.keyboard.press('Escape');
    await expect(openDropdown).toHaveCount(0);
  }
}

/**
 * A role-locked selector already contains an owner-confirmed fixed value. L2
 * must prove that value rather than attempting a choice the real UI forbids.
 */
async function selectOrAssertOperationsScopeOption(
  page: Page,
  testId: string,
  type: OperationsDataScopeType,
  label?: string,
  optionRef?: string,
  onControlTouch?: OperationsDataScopeTouchHandler,
): Promise<boolean> {
  const control = page.getByTestId(testId);
  await expect(control).toBeVisible();
  const input = control.locator('input');
  await expect(input).toBeVisible();
  if (await input.isDisabled()) {
    if (label) await expect(control).toContainText(label);
    return false;
  }
  if (!optionRef) throw new Error(`OPERATIONS_DATA_SCOPE_OPTION_REF_REQUIRED:${type}`);
  const optionTestId = roleHomeTestIds.dataScope.option(type, optionRef);
  onControlTouch?.({testId, phase: 'SELECTOR', type});
  await selectOperationsOption(page, testId, label, optionTestId);
  onControlTouch?.({testId: optionTestId, phase: 'OPTION', type});
  return true;
}

/** Select an owner-returned option through a ProTable form field's stable id. */
export async function selectOperationsFieldOption(page: Page, fieldId: string, label: string): Promise<void> {
  const control = page.locator(`input#${fieldId}`);
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  await control.click();
  const dropdown = await activeSelectDropdown(page, control);
  await expect(dropdown).toBeVisible();
  const option = dropdown.locator('.ant-select-item-option:visible').filter({hasText: label}).last();
  await expect(option).toBeVisible();
  await option.click();
  // Selecting a non-search option may close the portal before the keyboard
  // event is sent.  Do not let an unconditional Escape reach an enclosing
  // dirty Drawer and open its discard confirmation.
  await closeOperationsSelectDropdown(page);
  await expect(control).toHaveAttribute('aria-expanded', 'false');
}

/** Selects and explicitly confirms the owner-returned management range required by the current page. */
export async function selectOperationsDataScope(
  page: Page,
  type: OperationsDataScopeType,
  preferred: OperationsDataScopeSelection = {},
  onControlTouch?: OperationsDataScopeTouchHandler,
): Promise<void> {
  const trigger = page.getByTestId(roleHomeTestIds.dataScope.trigger);
  await expect(trigger).toBeVisible();
  await trigger.click();
  onControlTouch?.({testId: roleHomeTestIds.dataScope.trigger, phase: 'TRIGGER', type});
  let submitted = false;
  if (type === 'HEAD_COMPANY') {
    submitted = await selectOrAssertOperationsScopeOption(
      page,
      roleHomeTestIds.dataScope.headCompany,
      'HEAD_COMPANY',
      preferred.headCompanyName,
      preferred.headCompanyRef,
      onControlTouch,
    );
    if (submitted) {
      await page.getByTestId(roleHomeTestIds.dataScope.confirm).click();
      onControlTouch?.({testId: roleHomeTestIds.dataScope.confirm, phase: 'CONFIRM', type});
    } else await page.keyboard.press('Escape');
    await expect(page.locator('.ant-popover:visible')).toHaveCount(0);
    await expect(trigger).toBeEnabled();
    await expect(trigger).toContainText('总公司：');
    return;
  }
  const region = page.getByTestId(roleHomeTestIds.dataScope.region);
  await expect(region).toBeVisible();
  if (type === 'REGION') {
    const changed = await selectOrAssertOperationsScopeOption(
      page,
      roleHomeTestIds.dataScope.region,
      'REGION',
      preferred.regionName,
      preferred.regionRef,
      onControlTouch,
    );
    if (changed) {
      await page.getByTestId(roleHomeTestIds.dataScope.confirm).click();
      onControlTouch?.({testId: roleHomeTestIds.dataScope.confirm, phase: 'CONFIRM', type});
      submitted = true;
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(page.locator('.ant-popover:visible')).toHaveCount(0);
    await expect(trigger).toBeEnabled();
    await expect(trigger).toContainText('大区：');
    return;
  }
  await selectOrAssertOperationsScopeOption(
    page,
    roleHomeTestIds.dataScope.region,
    'REGION',
    preferred.regionName,
    preferred.regionRef,
    onControlTouch,
  );
  submitted = await selectOrAssertOperationsScopeOption(
    page,
    roleHomeTestIds.dataScope.project,
    'PROJECT',
    preferred.projectName,
    preferred.projectRef,
    onControlTouch,
  );
  if (type === 'STORE')
    submitted = await selectOrAssertOperationsScopeOption(
      page,
      roleHomeTestIds.dataScope.store,
      'STORE',
      preferred.storeName,
      preferred.storeRef,
      onControlTouch,
    );
  if (submitted) {
    await page.getByTestId(roleHomeTestIds.dataScope.confirm).click();
    onControlTouch?.({testId: roleHomeTestIds.dataScope.confirm, phase: 'CONFIRM', type});
  } else await page.keyboard.press('Escape');
  await expect(page.locator('.ant-popover:visible')).toHaveCount(0);
  await expect(trigger).toBeEnabled();

  await expect(trigger).toContainText('大区：');
  await expect(trigger).toContainText('项目：');
  if (preferred.projectName ?? preferred.storeName)
    await expect(trigger).toContainText(preferred.projectName ?? preferred.storeName ?? '');
}

/** A local draft must never change the owner-confirmed sidebar range until Confirm is clicked. */
export async function discardOperationsProjectScopeDraft(page: Page): Promise<void> {
  const trigger = page.getByTestId(roleHomeTestIds.dataScope.trigger);
  const scopeLines = trigger.locator('.operations-scope-trigger-line');
  const before = await scopeLines.allInnerTexts();
  await trigger.click();
  const control = page.getByTestId(roleHomeTestIds.dataScope.project);
  await expect(control).toBeVisible();
  await control.click();
  const options = page.locator(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible .ant-select-item-option:visible',
  );
  const current = await control.innerText();
  const count = await options.count();
  let candidate = options.last();
  for (let index = 0; index < count; index += 1) {
    const option = options.nth(index);
    if ((await option.innerText()) !== current) {
      candidate = option;
      break;
    }
  }
  await expect(candidate).toBeVisible();
  await candidate.click();
  await page.getByTestId(roleHomeTestIds.dataScope.cancel).click();
  await expect(page.locator('.ant-popover:visible')).toHaveCount(0);
  expect(await scopeLines.allInnerTexts()).toEqual(before);
}

export async function expandOperationsQuery(page: Page): Promise<void> {
  const expand = page.locator('.ant-pro-query-filter-actions').getByText('展开', {exact: true});
  await expect(expand).toBeVisible();
  await expand.click();
}

export async function openOperationsPrincipalAction(page: Page, action: '修改密码' | '退出登录'): Promise<void> {
  await page.getByTestId('operations-shell-principal').click();
  await page.getByRole('menuitem', {name: action}).click();
}
