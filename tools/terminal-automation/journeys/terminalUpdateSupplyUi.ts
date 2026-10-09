import {chromium, type Browser, type Page} from 'playwright';
import {terminalUpdateTestIds as platformIds} from '../../../apps/frontend/platform-admin/src/app/automation/terminalUpdateTestIds.ts';
import {platformWorkspaceTestIds} from '../../../apps/frontend/platform-admin/src/app/automation/platformWorkspaceTestIds.ts';
import {terminalUpdateTestIds as operationsIds} from '../../../apps/frontend/operations-admin/src/app/automation/terminalUpdateTestIds.ts';
import {roleHomeDataScopeOptionPrefix, roleHomeTestIds} from '../../../apps/frontend/operations-admin/src/features/role-home-bootstrap/roleHomeTestIds.ts';

type ArtifactReadback = Readonly<{
  artifactRef: string;
  kind: 'FULL' | 'HOT';
  applicationId: string;
  publicationId: string;
  zipSha256: string;
  apkVersion: string;
  jsVersion: string;
  runtimeVersion: string;
  minimumFullArtifactRef?: string;
}>;

export type TerminalUpdateSupplyUi = Readonly<{
  browser: Browser;
  operationsPage: Page;
  full: ArtifactReadback;
  hot: ArtifactReadback;
  ruleRef: string;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown, key: string): string => {
  if (!isRecord(value) || typeof value[key] !== 'string' || value[key].length === 0)
    throw new Error(`TERMINAL_UPDATE_SUPPLY_READBACK_INVALID_${key.toUpperCase()}`);
  return value[key] as string;
};

const integer = (value: unknown, key: string): number => {
  if (!isRecord(value) || !Number.isSafeInteger(value[key]) || (value[key] as number) < 0)
    throw new Error(`TERMINAL_UPDATE_SUPPLY_READBACK_INVALID_${key.toUpperCase()}`);
  return value[key] as number;
};

const clickOptionByTestId = async (page: Page, controlTestId: string, optionTestId: string): Promise<void> => {
  const control = page.getByTestId(controlTestId);
  const input = control.locator('input').first();
  await input.waitFor({state: 'visible'});
  await input.click();
  const option = page.getByTestId(optionTestId);
  await option.waitFor({state: 'visible'});
  if (await option.count() !== 1) throw new Error(`TERMINAL_UPDATE_SUPPLY_OPTION_NOT_UNIQUE:${optionTestId}`);
  await option.click();
};

const clickOptionByTestIdPrefix = async (
  page: Page,
  controlTestId: string,
  optionTestIdPrefix: string,
  expectedLabel: RegExp,
): Promise<void> => {
  const control = page.getByTestId(controlTestId);
  const input = control.locator('input').first();
  await input.waitFor({state: 'visible'});
  await input.click();
  const options = page.getByTestId(new RegExp(`^${optionTestIdPrefix}`));
  const matching: string[] = [];
  for (let index = 0; index < await options.count(); index += 1) {
    const option = options.nth(index);
    if (!(await option.isVisible()) || !expectedLabel.test(await option.innerText())) continue;
    const optionTestId = await option.getAttribute('data-testid');
    if (optionTestId?.startsWith(optionTestIdPrefix)) matching.push(optionTestId);
  }
  if (matching.length !== 1) throw new Error(`TERMINAL_UPDATE_SUPPLY_OPTION_NOT_UNIQUE:${controlTestId}`);
  await page.getByTestId(matching[0]!).click();
  if (!expectedLabel.test(await control.innerText()))
    throw new Error(`TERMINAL_UPDATE_SUPPLY_OPTION_SELECTION_MISMATCH:${controlTestId}`);
};

const waitForPage = async (page: Page, testId: string): Promise<void> => {
  await page.getByTestId(testId).waitFor({state: 'visible', timeout: 30_000});
};

const assertText = async (page: Page, testId: string, expected: RegExp): Promise<void> => {
  const actual = await page.getByTestId(testId).innerText();
  if (!expected.test(actual)) throw new Error('TERMINAL_UPDATE_SUPPLY_VISIBLE_TEXT_MISMATCH');
};

const registerArtifact = async (
  page: Page,
  input: Readonly<{zipPath: string; kind: 'FULL' | 'HOT'; minimumFullArtifactRef?: string}>,
): Promise<ArtifactReadback> => {
  await page.getByTestId(platformIds.upload).click();
  const upload = page.getByTestId(platformIds.uploadInput).locator('input[type="file"]');
  await upload.setInputFiles(input.zipPath);
  await clickOptionByTestId(page, platformIds.artifactKind, platformIds.artifactKindOption(input.kind));
  if (input.kind === 'HOT') {
    if (!input.minimumFullArtifactRef) throw new Error('TERMINAL_UPDATE_SUPPLY_MINIMUM_FULL_REF_REQUIRED');
    await clickOptionByTestId(
      page,
      platformIds.minimumFull,
      platformIds.minimumFullCandidate(input.minimumFullArtifactRef),
    );
  }

  await page.getByTestId(platformIds.save).click();
  await page.getByTestId(platformIds.parseSuccess).waitFor({state: 'visible', timeout: 180_000});

  const savedResponse = page.waitForResponse(response =>
    response.request().method() === 'POST' &&
    new URL(response.url()).pathname.endsWith('/terminal-update-artifacts'),
  );
  await page.getByTestId(platformIds.save).click();
  const response = await savedResponse;
  if (!response.ok()) throw new Error(`TERMINAL_UPDATE_SUPPLY_REGISTER_HTTP_${response.status()}`);
  const body: unknown = await response.json();
  const saved: ArtifactReadback = Object.freeze({
    artifactRef: text(body, 'artifactRef'),
    kind: text(body, 'kind') as 'FULL' | 'HOT',
    applicationId: text(body, 'applicationId'),
    publicationId: text(body, 'publicationId'),
    zipSha256: text(body, 'zipSha256'),
    apkVersion: text(body, 'apkVersion'),
    jsVersion: text(body, 'jsVersion'),
    runtimeVersion: text(body, 'runtimeVersion'),
    ...(isRecord(body) && typeof body.minimumFullArtifactRef === 'string'
      ? {minimumFullArtifactRef: body.minimumFullArtifactRef}
      : {}),
  });
  if (saved.kind !== input.kind) throw new Error('TERMINAL_UPDATE_SUPPLY_REGISTER_KIND_MISMATCH');
  await page.getByTestId(platformIds.detail).waitFor({state: 'visible'});
  await page.keyboard.press('Escape');
  await page.getByTestId(platformIds.detail).waitFor({state: 'hidden'});
  return saved;
};

export const createTerminalUpdateSupplyUi = async (input: Readonly<{
  platformOrigin: string;
  operationsOrigin: string;
  platformPassword: string;
  operationsPassword: string;
  fullZipPath: string;
  hotZipPath: string;
  applicationId: string;
  storeRef: string;
  runId: string;
}>): Promise<TerminalUpdateSupplyUi> => {
  const browser = await chromium.launch({headless: true});
  try {
    const context = await browser.newContext();
    const platformPage = await context.newPage();
    await platformPage.goto(new URL('/platform/login', input.platformOrigin).toString());
    await platformPage.getByTestId('platform-login-name').fill('root');
    await platformPage.getByTestId('platform-login-password').fill(input.platformPassword);
    await platformPage.getByTestId('platform-login-submit').click();
    await platformPage.getByTestId('platform-workspace-selector').waitFor({state: 'visible', timeout: 30_000});
    await clickOptionByTestId(
      platformPage,
      platformWorkspaceTestIds.selector,
      platformWorkspaceTestIds.option('aurora'),
    );
    await platformPage.goto(new URL('/platform/terminal-update-packages', input.platformOrigin).toString());
    await waitForPage(platformPage, platformIds.page);
    const full = await registerArtifact(platformPage, {zipPath: input.fullZipPath, kind: 'FULL'});
    if (full.applicationId !== input.applicationId || !/^[a-f0-9]{64}$/u.test(full.zipSha256))
      throw new Error('TERMINAL_UPDATE_SUPPLY_FULL_OWNER_READBACK_MISMATCH');
    const hot = await registerArtifact(platformPage, {
      zipPath: input.hotZipPath,
      kind: 'HOT',
      minimumFullArtifactRef: full.artifactRef,
    });
    if (
      hot.applicationId !== full.applicationId ||
      !/^[a-f0-9]{64}$/u.test(hot.zipSha256) ||
      hot.minimumFullArtifactRef !== full.artifactRef ||
      hot.runtimeVersion !== full.runtimeVersion
    )
      throw new Error('TERMINAL_UPDATE_SUPPLY_HOT_OWNER_READBACK_MISMATCH');

    const operationsPage = await context.newPage();
    await operationsPage.goto(new URL('/operations/aurora/login', input.operationsOrigin).toString());
    await operationsPage.getByTestId('operations-login-name').fill('r5-account-multi-role');
    await operationsPage.getByTestId('operations-login-password').fill(input.operationsPassword);
    await operationsPage.getByTestId('operations-login-submit').click();
    await operationsPage.getByTestId('operations-role-context-select').waitFor({state: 'visible', timeout: 30_000});
    await clickOptionByTestIdPrefix(
      operationsPage,
      'operations-role-context-select',
      roleHomeTestIds.roleContext.optionPrefix,
      /集团运营管理员.*华润万象生活/u,
    );
    await operationsPage.getByTestId('operations-role-context-enter').click();
    await operationsPage.getByTestId('operations-shell-menu').waitFor({state: 'visible', timeout: 30_000});
    const scope = operationsPage.getByTestId(roleHomeTestIds.dataScope.trigger);
    await scope.click();
    await clickOptionByTestIdPrefix(
      operationsPage,
      roleHomeTestIds.dataScope.region,
      roleHomeDataScopeOptionPrefix('REGION'),
      /华北大区/u,
    );
    await clickOptionByTestIdPrefix(
      operationsPage,
      roleHomeTestIds.dataScope.project,
      roleHomeDataScopeOptionPrefix('PROJECT'),
      /太原万象城/u,
    );
    await operationsPage.getByTestId(roleHomeTestIds.dataScope.confirm).click();
    await operationsPage.goto(new URL('/operations/aurora/terminal-update/rules', input.operationsOrigin).toString());
    await waitForPage(operationsPage, operationsIds.page);
    await operationsPage.getByTestId(operationsIds.createRule).click();
    await clickOptionByTestId(
      operationsPage,
      operationsIds.targetMode,
      operationsIds.targetModeOption('STORE_REFS'),
    );
    await clickOptionByTestId(
      operationsPage,
      operationsIds.storeRefs,
      operationsIds.storeRefOption(input.storeRef),
    );
    await clickOptionByTestId(
      operationsPage,
      operationsIds.fullArtifact,
      operationsIds.fullArtifactOption(full.artifactRef),
    );
    await clickOptionByTestId(
      operationsPage,
      operationsIds.hotArtifact,
      operationsIds.hotArtifactOption(hot.artifactRef),
    );
    const minuteInput = operationsPage.getByTestId(operationsIds.nMinutes).locator('input');
    await minuteInput.fill('5');
    if (await minuteInput.inputValue() !== '5') throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_INTERVAL_MISMATCH');
    await clickOptionByTestId(
      operationsPage,
      operationsIds.hotStrategy,
      operationsIds.hotStrategyOption('IMMEDIATE'),
    );
    const description = `TER-B-${input.runId}`;
    await operationsPage.getByTestId(operationsIds.description).fill(description);
    const ruleResponsePromise = operationsPage.waitForResponse(response =>
      response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/terminal-update-rules'),
    );
    const ruleRequestPromise = operationsPage.waitForRequest(request =>
      request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/terminal-update-rules'),
    );
    await operationsPage.getByTestId(operationsIds.createRuleSubmit).click();
    const ruleRequest = await ruleRequestPromise;
    const ruleRequestBody: unknown = ruleRequest.postDataJSON();
    if (!isRecord(ruleRequestBody) || !Array.isArray(ruleRequestBody.storeRefs) || ruleRequestBody.storeRefs.length !== 1 || ruleRequestBody.storeRefs[0] !== input.storeRef)
      throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_STORE_IDENTITY_MISMATCH');
    const ruleResponse = await ruleResponsePromise;
    if (!ruleResponse.ok()) throw new Error(`TERMINAL_UPDATE_SUPPLY_RULE_CREATE_HTTP_${ruleResponse.status()}`);
    const ruleBody: unknown = await ruleResponse.json();
    const ruleRef = text(ruleBody, 'ruleRef');
    if (
      text(ruleBody, 'status') !== 'DISABLED' ||
      text(ruleBody, 'targetMode') !== 'STORE_REFS' ||
      text(ruleBody, 'fullArtifactRef') !== full.artifactRef ||
      integer(ruleBody, 'nSeconds') !== 300 ||
      text(ruleBody, 'hotStrategy') !== 'IMMEDIATE'
    )
      throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_CREATE_READBACK_MISMATCH');
    const ruleRow = operationsPage.getByTestId(operationsIds.ruleRow(ruleRef));
    await ruleRow.waitFor({state: 'visible'});
    await operationsPage.getByTestId(operationsIds.ruleOpen(ruleRef)).click();
    await operationsPage.getByTestId(operationsIds.ruleDetail).waitFor({state: 'visible'});
    await assertText(operationsPage, operationsIds.ruleDetail, /河畔茶里店/u);
    await operationsPage.getByTestId(operationsIds.ruleDetailActions).click();
    await operationsPage.getByTestId(operationsIds.enableRuleAction).click();
    const statusResponsePromise = operationsPage.waitForResponse(response =>
      response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith(`/terminal-update-rules/${ruleRef}/status`),
    );
    await operationsPage.getByTestId(operationsIds.ruleStatusConfirm).click();
    const statusResponse = await statusResponsePromise;
    if (!statusResponse.ok()) throw new Error(`TERMINAL_UPDATE_SUPPLY_RULE_ENABLE_HTTP_${statusResponse.status()}`);
    const enabledRule: unknown = await statusResponse.json();
    if (!isRecord(enabledRule) || text(enabledRule, 'ruleRef') !== ruleRef || text(enabledRule, 'status') !== 'ENABLED')
      throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_ENABLE_READBACK_MISMATCH');
    await ruleRow.getByText('启用', {exact: true}).waitFor({state: 'visible', timeout: 30_000});
    await assertText(operationsPage, operationsIds.ruleRow(ruleRef), /启用/u);
    await operationsPage.getByTestId(operationsIds.ruleDetailActions).click();
    await operationsPage.getByTestId(operationsIds.ruleHistoryAction).click();
    const auditList = operationsPage.getByTestId('operations-audit-history-list');
    await auditList.waitFor({state: 'visible', timeout: 30_000});
    if (await auditList.locator('button').count() !== 2)
      throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_AUDIT_HISTORY_COUNT_MISMATCH');
    await operationsPage.keyboard.press('Escape');
    await operationsPage.getByTestId('operations-audit-history-modal').waitFor({state: 'hidden'});
    await operationsPage.getByTestId(operationsIds.reportsTabLabel).click();
    await waitForPage(operationsPage, operationsIds.reportList);
    process.stdout.write(`TERMINAL_AUTOMATION_SUPPLY_UI_READY run=${input.runId} app=${input.applicationId} full=registered hot=registered rule=enabled\n`);
    return Object.freeze({browser, operationsPage, full, hot, ruleRef});
  } catch (error) {
    await browser.close().catch(() => undefined);
    throw error;
  }
};

export const assertTerminalUpdateReportInUi = async (input: Readonly<{
  page: Page;
  terminalName: string;
  terminalRef: string;
  apkVersion: string;
  jsVersion: string;
  runtimeVersion: string;
  runId: string;
}>): Promise<void> => {
  const {page} = input;
  await page.getByTestId(operationsIds.reportsTabLabel).click();
  const query = page.getByTestId(operationsIds.reportQuery).locator('input');
  await query.fill(input.terminalName);
  await page.getByTestId(operationsIds.reportQuerySubmit).click();
  const row = page.getByTestId(operationsIds.reportRow(input.terminalRef));
  await row.waitFor({state: 'visible', timeout: 60_000});
  await assertText(page, operationsIds.reportRow(input.terminalRef), new RegExp(input.terminalName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  await assertText(page, operationsIds.reportRow(input.terminalRef), new RegExp(input.apkVersion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  await assertText(page, operationsIds.reportRow(input.terminalRef), new RegExp(input.jsVersion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  await assertText(page, operationsIds.reportRow(input.terminalRef), new RegExp(input.runtimeVersion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  await assertText(page, operationsIds.reportRow(input.terminalRef), /SUCCEEDED/u);
  await page.getByTestId(operationsIds.reportOpen(input.terminalRef)).click();
  await page.getByTestId(operationsIds.reportDetail).waitFor({state: 'visible'});
  await assertText(page, operationsIds.reportDetail, new RegExp(input.apkVersion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  await assertText(page, operationsIds.reportDetail, new RegExp(input.jsVersion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  await assertText(page, operationsIds.reportDetail, new RegExp(input.runtimeVersion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  const history = page.getByTestId(operationsIds.reportHistory);
  await history.waitFor({state: 'visible'});
  const rows = history.locator('tbody tr');
  if (await rows.count() !== 1) throw new Error('TERMINAL_UPDATE_SUPPLY_REPORT_HISTORY_COUNT_MISMATCH');
  await assertText(page, operationsIds.reportHistory, /SUCCEEDED/u);
  process.stdout.write(`TERMINAL_AUTOMATION_SUPPLY_REPORT_READBACK run=${input.runId} terminal=matched history=1\n`);
};
