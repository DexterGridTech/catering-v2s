import {chromium, type Browser, type Locator, type Page, type Request} from 'playwright';
import {expect} from 'playwright/test';
import {terminalUpdateTestIds as platformIds} from '../../../apps/frontend/platform-admin/src/app/automation/terminalUpdateTestIds.ts';
import {platformWorkspaceTestIds} from '../../../apps/frontend/platform-admin/src/app/automation/platformWorkspaceTestIds.ts';
import {terminalUpdateTestIds as operationsIds} from '../../../apps/frontend/operations-admin/src/app/automation/terminalUpdateTestIds.ts';
import {
  roleHomeDataScopeOptionPrefix,
  roleHomeTestIds,
} from '../../../apps/frontend/operations-admin/src/features/role-home-bootstrap/roleHomeTestIds.ts';
import {readAdminStructureProjectContext} from './adminStructureDevUi.ts';

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
  platformPage: Page;
  operationsPage: Page;
  projectRef: string;
  contextVersion: number;
  full: ArtifactReadback;
  hot: ArtifactReadback;
  ruleRef: string;
  ruleTargetTitle: string;
  fullArtifactTitle: string;
  hotArtifactTitle: string;
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

const artifactVersion = (artifact: ArtifactReadback): string =>
  artifact.kind === 'FULL' ? artifact.apkVersion : artifact.jsVersion;
const artifactTitle = (artifact: ArtifactReadback): string =>
  `${artifact.applicationId} · ${artifact.kind === 'FULL' ? '完整更新' : '热更新'} · ${artifactVersion(artifact)}`;
const ruleTitle = (full: ArtifactReadback, hot?: ArtifactReadback): string =>
  hot ? `${artifactTitle(full)} + ${artifactTitle(hot)}` : artifactTitle(full);
const escaped = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
const canonicalDatePattern = /\d{4}年\d{1,2}月\d{1,2}日/u;
const supplyLog = (runId: string, stage: string, detail = ''): void => {
  process.stdout.write(`TERMINAL_AUTOMATION_SUPPLY run=${runId} stage=${stage}${detail ? ` ${detail}` : ''}\n`);
};
const observePageWaiterRejection = (runId: string, phase: string, waiter: Promise<unknown>): void => {
  void waiter.catch(error => {
    const details = error instanceof Error ? `${error.name}: ${error.message}\n${error.stack ?? ''}` : String(error);
    supplyLog(runId, 'page.waiter.rejected', `phase=${phase} error=${JSON.stringify(details)}`);
  });
};
const problemSummary = async (response: import('playwright').Response): Promise<string> => {
  const problem: unknown = await response.json().catch(() => undefined);
  const code =
    isRecord(problem) && typeof problem.errorCode === 'string'
      ? problem.errorCode
      : isRecord(problem) && typeof problem.title === 'string'
        ? problem.title
        : 'UNKNOWN';
  const correlationId =
    isRecord(problem) && typeof problem.correlationId === 'string' ? problem.correlationId : 'unavailable';
  return `status=${response.status()} code=${JSON.stringify(code)} correlationId=${JSON.stringify(correlationId)}`;
};

const supplyApiOperation = (request: Request): string | undefined => {
  let pathname: string;
  try {
    pathname = new URL(request.url()).pathname;
  } catch {
    return 'admin-api.invalid-url';
  }
  if (!pathname.startsWith('/api/')) return undefined;
  if (pathname.endsWith('/auth/session')) return 'admin-api.session';
  if (pathname.endsWith('/terminal-update-artifact-stages')) return 'artifact.parse';
  if (pathname.endsWith('/terminal-update-artifacts')) return 'artifact.register';
  if (/\/terminal-update-rules\/[^/]+\/stores$/u.test(pathname)) return 'rule.stores';
  if (/\/terminal-update-rules\/[^/]+\/status$/u.test(pathname)) return 'rule.status';
  if (pathname.endsWith('/terminal-update-rules')) return 'rule.create';
  if (/\/terminal-update-rules\/[^/]+$/u.test(pathname)) return 'rule.detail';
  if (/\/terminal-versions\/[^/]+\/update-reports$/u.test(pathname)) return 'report.history';
  if (/\/terminal-versions\/[^/]+$/u.test(pathname)) return 'version.detail';
  return 'admin-api.other';
};

const attachSupplyPageDiagnostics = (page: Page, runId: string, surface: 'platform' | 'operations'): void => {
  const requestSequence = new WeakMap<Request, number>();
  let nextRequestSequence = 0;
  const startedAt = new WeakMap<Request, number>();
  page.on('request', request => {
    const operation = supplyApiOperation(request);
    if (operation === undefined) return;
    const requestId = ++nextRequestSequence;
    requestSequence.set(request, requestId);
    startedAt.set(request, Date.now());
    supplyLog(
      runId,
      `${surface}.http.started`,
      `request=${requestId} method=${request.method()} operation=${operation}`,
    );
  });
  page.on('response', response => {
    const request = response.request();
    const requestId = requestSequence.get(request);
    if (requestId === undefined) return;
    const operation = supplyApiOperation(request) ?? 'admin-api.other';
    const start = startedAt.get(request);
    supplyLog(
      runId,
      `${surface}.http.completed`,
      `request=${requestId} method=${request.method()} operation=${operation} status=${response.status()} elapsedMs=${start === undefined ? 'unknown' : Date.now() - start}`,
    );
  });
  page.on('requestfailed', request => {
    const requestId = requestSequence.get(request);
    if (requestId === undefined) return;
    const operation = supplyApiOperation(request) ?? 'admin-api.other';
    const start = startedAt.get(request);
    supplyLog(
      runId,
      `${surface}.http.failed`,
      `request=${requestId} method=${request.method()} operation=${operation} elapsedMs=${start === undefined ? 'unknown' : Date.now() - start} reason=${JSON.stringify(request.failure()?.errorText ?? 'UNKNOWN')}`,
    );
  });
  page.on('pageerror', error => {
    supplyLog(
      runId,
      `${surface}.page.error`,
      `name=${JSON.stringify(error.name)} message=${JSON.stringify(error.message)}`,
    );
  });
};

const clickOptionByTestId = async (page: Page, controlTestId: string, optionTestId: string): Promise<void> => {
  const control = page.getByTestId(controlTestId);
  const input = control.locator('input').first();
  await input.waitFor({state: 'visible'});
  await input.click();
  const optionMarker = page.getByTestId(optionTestId);
  await optionMarker.waitFor({state: 'visible'});
  try {
    await expect(optionMarker).toHaveCount(1, {timeout: 5_000});
  } catch {
    throw new Error(`TERMINAL_UPDATE_SUPPLY_OPTION_NOT_UNIQUE:${optionTestId}`);
  }
  await optionMarker.click();
  await page.waitForTimeout(75);
  if ((await input.getAttribute('aria-expanded').catch(() => null)) === 'true') await page.keyboard.press('Escape');
};

const clickOptionByTestIdPrefix = async (
  runId: string,
  page: Page,
  controlTestId: string,
  optionTestIdPrefix: string,
  expectedLabel: RegExp,
  keyboardSelection = false,
): Promise<void> => {
  const control = page.getByTestId(controlTestId);
  const input = control.locator('input').first();
  await control.waitFor({state: 'visible'});
  await input.waitFor({state: 'attached'});
  const inputEnabled = await input.isEnabled();
  const ariaControls = await input.getAttribute('aria-controls');
  supplyLog(
    runId,
    'selector.open.begin',
    `control=${controlTestId} inputEnabled=${inputEnabled} ariaControls=${ariaControls ?? 'missing'}`,
  );
  if (!inputEnabled) {
    const selectedText = (await control.innerText().catch(() => '')).replace(/\s+/gu, ' ').trim();
    throw new Error(`TERMINAL_UPDATE_SUPPLY_SELECTOR_DISABLED:${controlTestId}:selected=${selectedText}`);
  }
  await control.click();
  await expect(input).toHaveAttribute('aria-expanded', 'true', {timeout: 5_000});
  const visibleDropdownCount = await page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible')
    .count();
  supplyLog(
    runId,
    'selector.open.completed',
    `control=${controlTestId} visibleDropdownCount=${visibleDropdownCount}`,
  );
  const dropdown = await activeSelectDropdown(page, input);
  await dropdown.waitFor({state: 'visible', timeout: 30_000});
  if (optionTestIdPrefix !== '' && !/^[a-zA-Z0-9_-]+$/u.test(optionTestIdPrefix))
    throw new Error(`TERMINAL_UPDATE_SUPPLY_OPTION_PREFIX_INVALID:${controlTestId}`);
  const matching =
    optionTestIdPrefix === ''
      ? dropdown.locator('.ant-select-item-option:visible').filter({hasText: expectedLabel})
      : dropdown.locator(`[data-testid^="${optionTestIdPrefix}"]`).filter({hasText: expectedLabel});
  try {
    await expect(matching).toHaveCount(1, {timeout: 5_000});
  } catch {
    // Ant Design can expose the expanded dropdown before its options finish rendering.
  }
  const count = await matching.count();
  const visibleOptions = dropdown.locator('.ant-select-item-option:visible');
  const visibleOptionCountAtRead = await visibleOptions.count();
  supplyLog(
    runId,
    'selector.options.readback',
    `control=${controlTestId} prefix=${optionTestIdPrefix || 'none'} matchedCount=${count} visibleOptionCountAtRead=${visibleOptionCountAtRead}`,
  );
  if (count !== 1) {
    const visibleLabels: string[] = [];
    const visibleOptions = dropdown.locator('.ant-select-item-option:visible');
    for (let index = 0; index < Math.min(await visibleOptions.count(), 20); index += 1) {
      visibleLabels.push((await visibleOptions.nth(index).innerText()).replace(/\s+/gu, ' ').trim());
    }
    const dropdownText = (await dropdown.innerText().catch(() => '')).replace(/\s+/gu, ' ').trim();
    throw new Error(
      `TERMINAL_UPDATE_SUPPLY_OPTION_COUNT_MISMATCH:${controlTestId}:prefix=${optionTestIdPrefix || 'none'}:expected=${expectedLabel.source}:actual=${count}:${visibleLabels.join('|')}:${dropdownText.slice(0, 200)}`,
    );
  }
  const option = matching.first();
  await expect(option).toBeVisible({timeout: 5_000});
  if (keyboardSelection) {
    const targetOptionLabel = (
      (await option.getAttribute('aria-label')) ?? (await option.innerText())
    )
      .replace(/\s+/gu, ' ')
      .trim();
    const targetOptionIndex = await option.evaluate(element => {
      const parent = element.parentElement;
      if (!parent) return -1;
      return Array.from(parent.querySelectorAll('.ant-select-item-option')).indexOf(element as HTMLElement);
    });
    if (!targetOptionLabel || targetOptionIndex < 0)
      throw new Error(`TERMINAL_UPDATE_SUPPLY_OPTION_POSITION_MISSING:${controlTestId}`);
    await input.focus();
    await input.press('Home');
    for (let index = 0; index < targetOptionIndex; index += 1) await input.press('ArrowDown');
    const activeId = await input.getAttribute('aria-activedescendant');
    const activeLabel = activeId
      ? await page
          .locator(`#${activeId}`)
          .evaluate(element => (element.getAttribute('aria-label') ?? element.textContent ?? '').replace(/\s+/gu, ' ').trim())
          .catch(() => '')
      : '';
    supplyLog(
      runId,
      'selector.keyboard-target.readback',
      `control=${controlTestId} target=${targetOptionLabel} activeOptionId=${activeId ?? 'missing'} activeLabel=${activeLabel || 'missing'}`,
    );
    if (activeLabel !== targetOptionLabel)
      throw new Error(`TERMINAL_UPDATE_SUPPLY_OPTION_KEYBOARD_TARGET_MISMATCH:${controlTestId}`);
    await input.press('Enter');
  } else {
    await option.click();
  }
  await expect(input).toHaveAttribute('aria-expanded', 'false', {timeout: 5_000});
  if (!expectedLabel.test(await control.innerText())) {
    throw new Error(`TERMINAL_UPDATE_SUPPLY_OPTION_SELECTION_MISMATCH:${controlTestId}`);
  }
  supplyLog(runId, 'selector.selection.completed', `control=${controlTestId}`);
};

const waitForPage = async (page: Page, testId: string): Promise<void> => {
  try {
    await page.getByTestId(testId).waitFor({state: 'visible', timeout: 30_000});
  } catch {
    const state = await page
      .evaluate(() => {
        const visible = (id: string): boolean => {
          const element = document.querySelector(`[data-testid="${id}"]`);
          if (!(element instanceof HTMLElement)) return false;
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
        };
        return {
          path: location.pathname,
          readyState: document.readyState,
          loginVisible: visible('platform-login-name'),
          workspaceVisible: visible('platform-workspace-selector'),
          recoveringSession: document.body.innerText.includes('正在恢复平台会话'),
        };
      })
      .catch(() => ({
        path: 'unavailable',
        readyState: 'unavailable',
        loginVisible: false,
        workspaceVisible: false,
        recoveringSession: false,
      }));
    throw new Error(`TERMINAL_UPDATE_SUPPLY_PAGE_NOT_VISIBLE:${testId}:${JSON.stringify(state)}`);
  }
};

const activeSelectDropdown = async (page: Page, input: Locator): Promise<Locator> => {
  const listboxId = await input.getAttribute('aria-controls');
  if (listboxId) {
    const listbox = page.locator(`[id=${JSON.stringify(listboxId)}]`);
    const ownerDropdown = listbox
      .locator('xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " ant-select-dropdown ")]')
      .first();
    if (
      (await ownerDropdown.count()) > 0 &&
      (await ownerDropdown.isVisible()) &&
      (await ownerDropdown.locator('.ant-select-item-option:visible').count()) > 0
    )
      return ownerDropdown;
  }
  return page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible').last();
};

const assertText = async (page: Page, testId: string, expected: RegExp): Promise<void> => {
  const target = page.getByTestId(testId);
  try {
    await expect(target).toContainText(expected, {timeout: 5_000});
  } catch {
    const actual = (await target.innerText({timeout: 1_000}).catch(() => '')).replace(/\s+/gu, ' ').trim();
    throw new Error(`TERMINAL_UPDATE_SUPPLY_VISIBLE_TEXT_MISMATCH:${testId}:${expected.source}:${actual}`);
  }
};

const assertVisiblePageText = async (page: Page, expected: RegExp): Promise<void> => {
  await page.getByText(expected).first().waitFor({state: 'visible', timeout: 30_000});
};

const registerArtifact = async (
  page: Page,
  input: Readonly<{zipPath: string; kind: 'FULL' | 'HOT'; runId: string; minimumFullArtifactRef?: string}>,
): Promise<ArtifactReadback> => {
  supplyLog(input.runId, 'artifact.upload.begin', `kind=${input.kind}`);
  await page.getByTestId(platformIds.upload).click();
  const upload = page.getByTestId(platformIds.uploadInput);
  await upload.waitFor({state: 'attached', timeout: 30_000});
  await clickOptionByTestId(page, platformIds.artifactKind, platformIds.artifactKindOption(input.kind));
  supplyLog(input.runId, 'artifact.parse.begin', `kind=${input.kind}`);
  let resolveStageResponse: ((response: import('playwright').Response) => void) | undefined;
  const stageResponsePromise = new Promise<import('playwright').Response>(resolve => {
    resolveStageResponse = resolve;
  });
  const responseTimeoutMs = 90_000;
  let parseStartedAt = 0;
  let stageRequestStartedAt: number | undefined;
  const isStageRequest = (request: Request): boolean =>
    request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/terminal-update-artifact-stages');
  const stageRequestListener = (request: Request): void => {
    if (!isStageRequest(request)) return;
    stageRequestStartedAt = Date.now();
    supplyLog(input.runId, 'artifact.parse.request.started', `kind=${input.kind}`);
  };
  const stageResponseListener = (response: import('playwright').Response): void => {
    if (!isStageRequest(response.request())) return;
    const elapsedMs = Date.now() - parseStartedAt;
    const requestElapsedMs = stageRequestStartedAt === undefined ? 'unavailable' : Date.now() - stageRequestStartedAt;
    supplyLog(
      input.runId,
      'artifact.parse.response.received',
      `kind=${input.kind} status=${response.status()} elapsedMs=${elapsedMs} requestElapsedMs=${requestElapsedMs}`,
    );
    resolveStageResponse?.(response);
  };
  const stageRequestFailedListener = (request: Request): void => {
    if (!isStageRequest(request)) return;
    const elapsedMs = Date.now() - parseStartedAt;
    supplyLog(input.runId, 'artifact.parse.request.failed', `kind=${input.kind} elapsedMs=${elapsedMs}`);
  };
  page.on('request', stageRequestListener);
  page.on('response', stageResponseListener);
  page.on('requestfailed', stageRequestFailedListener);
  parseStartedAt = Date.now();
  supplyLog(input.runId, 'artifact.parse.auto.begin', `kind=${input.kind}`);
  let stageResponse: import('playwright').Response;
  try {
    await upload.setInputFiles(input.zipPath);
    supplyLog(
      input.runId,
      'artifact.parse.file.selected',
      `kind=${input.kind} elapsedMs=${Date.now() - parseStartedAt}`,
    );
    stageResponse = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('TERMINAL_UPDATE_SUPPLY_STAGE_RESPONSE_TIMEOUT')),
        responseTimeoutMs,
      );
      void stageResponsePromise.then(
        response => {
          clearTimeout(timeout);
          resolve(response);
        },
        error => {
          clearTimeout(timeout);
          reject(error);
        },
      );
    });
  } catch (error) {
    const requestObserved = stageRequestStartedAt !== undefined;
    const requestElapsedMs = stageRequestStartedAt === undefined ? 'unavailable' : Date.now() - stageRequestStartedAt;
    supplyLog(
      input.runId,
      'artifact.parse.response.wait.failed',
      `kind=${input.kind} timeoutMs=${responseTimeoutMs} elapsedMs=${Date.now() - parseStartedAt} requestObserved=${requestObserved} requestElapsedMs=${requestElapsedMs}`,
    );
    throw error;
  } finally {
    page.off('request', stageRequestListener);
    page.off('response', stageResponseListener);
    page.off('requestfailed', stageRequestFailedListener);
  }
  if (!stageResponse.ok()) {
    const problem = await problemSummary(stageResponse);
    supplyLog(input.runId, 'artifact.parse.reject', `kind=${input.kind} ${problem}`);
    throw new Error(`TERMINAL_UPDATE_SUPPLY_PARSE_HTTP_${problem.replaceAll(' ', ':')}`);
  }
  await page.getByTestId(platformIds.parseSuccess).waitFor({state: 'visible', timeout: 30_000});
  const saveButton = page.getByTestId(platformIds.save);
  await expect(saveButton).toHaveText(/^保\s*存$/u);
  await expect(saveButton).toBeEnabled();
  supplyLog(input.runId, 'artifact.parse.readback', `kind=${input.kind} result=valid`);

  if (input.kind === 'HOT') {
    if (!input.minimumFullArtifactRef) throw new Error('TERMINAL_UPDATE_SUPPLY_MINIMUM_FULL_REF_REQUIRED');
    await clickOptionByTestId(
      page,
      platformIds.minimumFull,
      platformIds.minimumFullCandidate(input.minimumFullArtifactRef),
    );
    supplyLog(input.runId, 'artifact.minimum-full.selected', `artifactRef=${input.minimumFullArtifactRef}`);
  }

  const savedResponse = page.waitForResponse(
    response =>
      response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/terminal-update-artifacts'),
  );
  observePageWaiterRejection(input.runId, `artifact.register.${input.kind}`, savedResponse);
  await page.getByTestId(platformIds.save).click();
  const response = await savedResponse;
  if (!response.ok()) {
    const problem = await problemSummary(response);
    supplyLog(input.runId, 'artifact.register.reject', `kind=${input.kind} ${problem}`);
    throw new Error(`TERMINAL_UPDATE_SUPPLY_REGISTER_HTTP_${problem.replaceAll(' ', ':')}`);
  }
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
  supplyLog(
    input.runId,
    'artifact.register.readback',
    `kind=${saved.kind} artifactRef=${saved.artifactRef} publicationId=${saved.publicationId} zipSha256=${saved.zipSha256}`,
  );
  await page.getByTestId(platformIds.detail).waitFor({state: 'visible'});
  await assertText(page, platformIds.detail, new RegExp(saved.applicationId.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  await assertVisiblePageText(page, new RegExp(`${escaped(artifactTitle(saved))} · 更新包详情`, 'u'));
  await assertText(page, platformIds.detail, new RegExp(saved.apkVersion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')));
  await assertText(
    page,
    platformIds.detail,
    new RegExp(`类型\\s*${saved.kind === 'FULL' ? '完整更新' : '热更新'}`, 'u'),
  );
  await page.keyboard.press('Escape');
  await page.getByTestId(platformIds.detail).waitFor({state: 'hidden'});
  return saved;
};

export const createTerminalUpdateSupplyUi = async (
  input: Readonly<{
    platformOrigin: string;
    operationsOrigin: string;
    platformPassword: string;
    operationsPassword: string;
    fullZipPath: string;
    hotZipPath: string;
    applicationId: string;
    storeRef: string;
    runId: string;
    verifyIdleDuration?: boolean;
  }>,
): Promise<TerminalUpdateSupplyUi> => {
  supplyLog(input.runId, 'browser.start', `applicationId=${input.applicationId}`);
  const browser = await chromium.launch({headless: true});
  try {
    const context = await browser.newContext();
    const platformPage = await context.newPage();
    attachSupplyPageDiagnostics(platformPage, input.runId, 'platform');
    await platformPage.goto(new URL('/platform/login', input.platformOrigin).toString());
    await waitForPage(platformPage, 'platform-login-name');
    await platformPage.getByTestId('platform-login-name').fill('root');
    await platformPage.getByTestId('platform-login-password').fill(input.platformPassword);
    await platformPage.getByTestId('platform-login-submit').click();
    await platformPage.getByTestId('platform-workspace-selector').waitFor({state: 'visible', timeout: 30_000});
    await platformPage.goto(new URL('/platform/terminal-update-packages', input.platformOrigin).toString());
    await platformPage.getByTestId(platformWorkspaceTestIds.selector).waitFor({state: 'visible', timeout: 30_000});
    await clickOptionByTestId(
      platformPage,
      platformWorkspaceTestIds.selector,
      platformWorkspaceTestIds.option('aurora'),
    );
    await waitForPage(platformPage, platformIds.page);
    supplyLog(input.runId, 'platform.session.ready');
    const full = await registerArtifact(platformPage, {
      zipPath: input.fullZipPath,
      kind: 'FULL',
      runId: input.runId,
    });
    if (full.applicationId !== input.applicationId || !/^[a-f0-9]{64}$/u.test(full.zipSha256))
      throw new Error('TERMINAL_UPDATE_SUPPLY_FULL_OWNER_READBACK_MISMATCH');
    const hot = await registerArtifact(platformPage, {
      zipPath: input.hotZipPath,
      kind: 'HOT',
      runId: input.runId,
      minimumFullArtifactRef: full.artifactRef,
    });
    if (
      hot.applicationId !== full.applicationId ||
      !/^[a-f0-9]{64}$/u.test(hot.zipSha256) ||
      hot.minimumFullArtifactRef !== full.artifactRef ||
      hot.runtimeVersion !== full.runtimeVersion
    )
      throw new Error('TERMINAL_UPDATE_SUPPLY_HOT_OWNER_READBACK_MISMATCH');
    supplyLog(input.runId, 'artifact.chain.verified', `full=${full.artifactRef} hot=${hot.artifactRef}`);

    const operationsPage = await context.newPage();
    await operationsPage.setViewportSize({width: 1440, height: 900});
    attachSupplyPageDiagnostics(operationsPage, input.runId, 'operations');
    await operationsPage.goto(new URL('/operations/aurora/login', input.operationsOrigin).toString());
    await operationsPage.getByTestId('operations-login-name').fill('r5-account-multi-role');
    await operationsPage.getByTestId('operations-login-password').fill(input.operationsPassword);
    await operationsPage.getByTestId('operations-login-submit').click();
    await operationsPage.getByTestId('operations-role-context-select').waitFor({state: 'visible', timeout: 30_000});
    await clickOptionByTestIdPrefix(
      input.runId,
      operationsPage,
      'operations-role-context-select',
      roleHomeTestIds.roleContext.optionPrefix,
      /集团运营管理员.*华润万象生活/u,
    );
    await operationsPage.getByTestId('operations-role-context-enter').click();
    await operationsPage.getByTestId('operations-shell-menu').waitFor({state: 'visible', timeout: 30_000});
    supplyLog(input.runId, 'operations.session.ready');
    await operationsPage.goto(new URL('/operations/aurora/terminal-update/rules', input.operationsOrigin).toString());
    const scope = operationsPage.getByTestId(roleHomeTestIds.dataScope.trigger);
    await scope.waitFor({state: 'visible', timeout: 30_000});
    await scope.click();
    await clickOptionByTestIdPrefix(
      input.runId,
      operationsPage,
      roleHomeTestIds.dataScope.region,
      roleHomeDataScopeOptionPrefix('REGION'),
      /华北大区/u,
    );
    await clickOptionByTestIdPrefix(
      input.runId,
      operationsPage,
      roleHomeTestIds.dataScope.project,
      roleHomeDataScopeOptionPrefix('PROJECT'),
      /太原万象城/u,
    );
    await operationsPage.getByTestId(roleHomeTestIds.dataScope.confirm).click();
    await waitForPage(operationsPage, operationsIds.page);
    const projectContext = await readAdminStructureProjectContext({
      page: operationsPage,
      operationsOrigin: input.operationsOrigin,
      storeRef: input.storeRef,
      runId: input.runId,
    });
    if (input.verifyIdleDuration) {
      supplyLog(input.runId, 'operations.rule-tab.activate.started');
      await operationsPage.getByTestId(operationsIds.rulesTabLabel).click();
      await operationsPage.getByTestId(operationsIds.rulesTab).waitFor({state: 'visible'});
      supplyLog(input.runId, 'operations.rule-tab.activate.completed');
      await operationsPage.getByTestId(operationsIds.createRule).click();
      await assertText(operationsPage, operationsIds.initialStatus, /^停用$/u);
      await clickOptionByTestId(operationsPage, operationsIds.targetMode, operationsIds.targetModeOption('STORE_REFS'));
      await clickOptionByTestId(operationsPage, operationsIds.storeRefs, operationsIds.storeRefOption(input.storeRef));
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
      await clickOptionByTestId(operationsPage, operationsIds.hotStrategy, operationsIds.hotStrategyOption('IDLE'));
      const selectedHotStrategy = (await operationsPage.getByTestId(operationsIds.hotStrategy).innerText())
        .replace(/\s+/gu, ' ')
        .trim();
      if (selectedHotStrategy !== '空闲时执行')
        throw new Error(`TERMINAL_UPDATE_SUPPLY_IDLE_STRATEGY_SELECTION_MISMATCH:${selectedHotStrategy}`);
      const idleInput = operationsPage.getByTestId(operationsIds.mMinutes);
      try {
        await idleInput.waitFor({state: 'visible', timeout: 5_000});
      } catch {
        throw new Error(`TERMINAL_UPDATE_SUPPLY_IDLE_MINUTES_FIELD_NOT_RENDERED:strategy=${selectedHotStrategy}`);
      }
      await idleInput.fill('10');
      if ((await idleInput.inputValue()) !== '10')
        throw new Error('TERMINAL_UPDATE_SUPPLY_IDLE_MINUTES_INPUT_MISMATCH');
      await operationsPage.getByTestId(operationsIds.description).fill(`TER-B-IDLE-${input.runId}`);
      const idleRequestPromise = operationsPage.waitForRequest(
        request => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/terminal-update-rules'),
      );
      observePageWaiterRejection(input.runId, 'rule.create.idle.request', idleRequestPromise);
      const idleResponsePromise = operationsPage.waitForResponse(
        response =>
          response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/terminal-update-rules'),
      );
      observePageWaiterRejection(input.runId, 'rule.create.idle.response', idleResponsePromise);
      await operationsPage.getByTestId(operationsIds.createRuleSubmit).click();
      const idleRequest = await idleRequestPromise;
      const idleRequestBody: unknown = idleRequest.postDataJSON();
      if (
        !isRecord(idleRequestBody) ||
        idleRequestBody.status !== 'DISABLED' ||
        idleRequestBody.hotStrategy !== 'IDLE' ||
        idleRequestBody.mSeconds !== 600 ||
        'mMinutes' in idleRequestBody
      )
        throw new Error('TERMINAL_UPDATE_SUPPLY_IDLE_MINUTES_REQUEST_MISMATCH');
      const idleResponse = await idleResponsePromise;
      if (!idleResponse.ok()) {
        const problem = await problemSummary(idleResponse);
        supplyLog(input.runId, 'rule.idle.create.reject', problem);
        throw new Error(`TERMINAL_UPDATE_SUPPLY_IDLE_RULE_CREATE_HTTP_${problem.replaceAll(' ', ':')}`);
      }
      const idleRule: unknown = await idleResponse.json();
      if (
        !isRecord(idleRule) ||
        text(idleRule, 'status') !== 'DISABLED' ||
        text(idleRule, 'hotStrategy') !== 'IDLE' ||
        integer(idleRule, 'mSeconds') !== 600
      )
        throw new Error('TERMINAL_UPDATE_SUPPLY_IDLE_RULE_READBACK_MISMATCH');
      const idleRuleRef = text(idleRule, 'ruleRef');
      supplyLog(input.runId, 'rule.idle.readback', `ruleRef=${idleRuleRef} status=DISABLED hotStrategy=IDLE`);
      await operationsPage.getByTestId(operationsIds.ruleOpen(idleRuleRef)).click();
      await operationsPage.getByTestId(operationsIds.ruleDetail).waitFor({state: 'visible'});
      await assertText(operationsPage, operationsIds.ruleDetail, /HOT策略\s*空闲时执行/u);
      await assertText(operationsPage, operationsIds.ruleDetail, /空闲时长\s*10 分钟/u);
      await operationsPage.keyboard.press('Escape');
      await operationsPage.getByTestId(operationsIds.ruleDetail).waitFor({state: 'hidden'});
    }
    await operationsPage.getByTestId(operationsIds.createRule).click();
    await assertText(operationsPage, operationsIds.initialStatus, /^停用$/u);
    await clickOptionByTestId(operationsPage, operationsIds.targetMode, operationsIds.targetModeOption('STORE_REFS'));
    await clickOptionByTestId(operationsPage, operationsIds.storeRefs, operationsIds.storeRefOption(input.storeRef));
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
    const minuteInput = operationsPage.getByTestId(operationsIds.nMinutes);
    await minuteInput.fill('5');
    if ((await minuteInput.inputValue()) !== '5') throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_INTERVAL_MISMATCH');
    await clickOptionByTestId(operationsPage, operationsIds.hotStrategy, operationsIds.hotStrategyOption('IMMEDIATE'));
    const description = `TER-B-${input.runId}`;
    await operationsPage.getByTestId(operationsIds.description).fill(description);
    const ruleResponsePromise = operationsPage.waitForResponse(
      response =>
        response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/terminal-update-rules'),
    );
    observePageWaiterRejection(input.runId, 'rule.create.request-response', ruleResponsePromise);
    const ruleRequestPromise = operationsPage.waitForRequest(
      request => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/terminal-update-rules'),
    );
    observePageWaiterRejection(input.runId, 'rule.create.request', ruleRequestPromise);
    await operationsPage.getByTestId(operationsIds.createRuleSubmit).click();
    const ruleRequest = await ruleRequestPromise;
    const ruleRequestBody: unknown = ruleRequest.postDataJSON();
    if (
      !isRecord(ruleRequestBody) ||
      !Array.isArray(ruleRequestBody.storeRefs) ||
      ruleRequestBody.storeRefs.length !== 1 ||
      ruleRequestBody.storeRefs[0] !== input.storeRef ||
      ruleRequestBody.status !== 'DISABLED'
    )
      throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_STORE_IDENTITY_MISMATCH');
    const ruleResponse = await ruleResponsePromise;
    if (!ruleResponse.ok()) {
      const problem = await problemSummary(ruleResponse);
      supplyLog(input.runId, 'rule.create.reject', problem);
      throw new Error(`TERMINAL_UPDATE_SUPPLY_RULE_CREATE_HTTP_${problem.replaceAll(' ', ':')}`);
    }
    const ruleBody: unknown = await ruleResponse.json();
    if (!isRecord(ruleBody)) throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_CREATE_READBACK_MISMATCH');
    const ruleRef = text(ruleBody, 'ruleRef');
    supplyLog(input.runId, 'rule.create.readback', `ruleRef=${ruleRef} status=DISABLED`);
    const fullIdentity = ruleBody.fullArtifactIdentity;
    const hotIdentity = ruleBody.hotArtifactIdentity;
    if (
      text(ruleBody, 'status') !== 'DISABLED' ||
      text(ruleBody, 'targetMode') !== 'STORE_REFS' ||
      text(ruleBody, 'fullArtifactRef') !== full.artifactRef ||
      text(ruleBody, 'hotArtifactRef') !== hot.artifactRef ||
      !isRecord(fullIdentity) ||
      !isRecord(hotIdentity) ||
      integer(ruleBody, 'nSeconds') !== 300 ||
      text(ruleBody, 'hotStrategy') !== 'IMMEDIATE'
    )
      throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_CREATE_READBACK_MISMATCH');
    if (
      text(fullIdentity, 'applicationId') !== full.applicationId ||
      text(fullIdentity, 'kind') !== full.kind ||
      text(fullIdentity, 'version') !== artifactVersion(full) ||
      text(hotIdentity, 'applicationId') !== hot.applicationId ||
      text(hotIdentity, 'kind') !== hot.kind ||
      text(hotIdentity, 'version') !== artifactVersion(hot)
    )
      throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_ARTIFACT_IDENTITY_MISMATCH');
    const title = ruleTitle(full, hot);
    const ruleRow = operationsPage.getByTestId(operationsIds.ruleRow(ruleRef));
    await ruleRow.waitFor({state: 'visible'});
    await assertText(operationsPage, operationsIds.ruleRow(ruleRef), new RegExp(escaped(artifactTitle(full)), 'u'));
    await assertText(operationsPage, operationsIds.ruleRow(ruleRef), new RegExp(escaped(artifactTitle(hot)), 'u'));
    await expect(ruleRow.locator('.ant-tag')).toHaveClass(/ant-tag-warning/u);
    const ruleStatusFilter = operationsPage.getByTestId(operationsIds.ruleStatusFilter);
    if (!(await ruleStatusFilter.isVisible().catch(() => false))) {
      const expandRuleFilters = operationsPage
        .getByRole('tabpanel', {name: '终端版本更新规则'})
        .getByText('展开', {exact: true});
      supplyLog(input.runId, 'rule.filters.expand.started');
      await expandRuleFilters.waitFor({state: 'visible'});
      await expandRuleFilters.click();
      await ruleStatusFilter.waitFor({state: 'visible'});
      supplyLog(input.runId, 'rule.filters.expand.completed');
    }
    await clickOptionByTestIdPrefix(input.runId, operationsPage, operationsIds.ruleStatusFilter, '', /^停用$/u, true);
    const disabledQueryResponsePromise = operationsPage.waitForResponse(response => {
      if (response.request().method() !== 'GET') return false;
      const url = new URL(response.url());
      return url.pathname.endsWith('/terminal-update-rules') && url.searchParams.get('status') === 'DISABLED';
    });
    observePageWaiterRejection(input.runId, 'rule.filter.disabled', disabledQueryResponsePromise);
    await operationsPage.getByTestId(operationsIds.ruleQuerySubmit).click();
    const disabledQueryResponse = await disabledQueryResponsePromise;
    if (!disabledQueryResponse.ok())
      throw new Error(`TERMINAL_UPDATE_SUPPLY_RULE_FILTER_HTTP_${disabledQueryResponse.status()}`);
    await ruleRow.waitFor({state: 'visible'});
    await expect(ruleRow.locator('.ant-tag')).toHaveClass(/ant-tag-warning/u);
    supplyLog(input.runId, 'rule.filter.disabled.readback', `ruleRef=${ruleRef} status=DISABLED`);
    const resetQueryResponsePromise = operationsPage.waitForResponse(response => {
      if (response.request().method() !== 'GET') return false;
      const url = new URL(response.url());
      return url.pathname.endsWith('/terminal-update-rules') && !url.searchParams.has('status');
    });
    observePageWaiterRejection(input.runId, 'rule.filter.reset', resetQueryResponsePromise);
    await operationsPage.getByTestId(operationsIds.ruleQueryReset).click();
    const resetQueryResponse = await resetQueryResponsePromise;
    if (!resetQueryResponse.ok())
      throw new Error(`TERMINAL_UPDATE_SUPPLY_RULE_RESET_HTTP_${resetQueryResponse.status()}`);
    await ruleRow.waitFor({state: 'visible'});
    const ruleStoresResponsePromise = operationsPage.waitForResponse(
      response =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname.endsWith(`/terminal-update-rules/${ruleRef}/stores`),
    );
    observePageWaiterRejection(input.runId, 'rule.stores.readback', ruleStoresResponsePromise);
    await operationsPage.getByTestId(operationsIds.ruleOpen(ruleRef)).click();
    const ruleStoresResponse = await ruleStoresResponsePromise;
    if (!ruleStoresResponse.ok()) {
      const problem = await problemSummary(ruleStoresResponse);
      supplyLog(input.runId, 'rule.stores.reject', `ruleRef=${ruleRef} ${problem}`);
      throw new Error(`TERMINAL_UPDATE_SUPPLY_RULE_STORES_HTTP_${problem.replaceAll(' ', ':')}`);
    }
    const ruleStoresBody: unknown = await ruleStoresResponse.json();
    if (!isRecord(ruleStoresBody) || !Array.isArray(ruleStoresBody.items) || ruleStoresBody.items.length !== 1) {
      throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_STORES_READBACK_MISMATCH');
    }
    const ruleStore = ruleStoresBody.items[0];
    if (
      !isRecord(ruleStore) ||
      text(ruleStore, 'storeRef') !== input.storeRef ||
      !text(ruleStore, 'name').includes('河畔茶里店')
    )
      throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_STORE_IDENTITY_MISMATCH');
    await operationsPage.getByTestId(operationsIds.ruleDetail).waitFor({state: 'visible'});
    await assertVisiblePageText(operationsPage, new RegExp(`${escaped(title)} · 版本规则详情`, 'u'));
    await operationsPage
      .getByTestId(operationsIds.ruleDetail)
      .getByText(/河畔茶里店/u)
      .waitFor({state: 'visible', timeout: 30_000});
    await assertText(operationsPage, operationsIds.ruleDetail, /河畔茶里店/u);
    await assertText(operationsPage, operationsIds.ruleDetail, /状态\s*停用/u);
    await assertText(operationsPage, operationsIds.ruleDetail, /HOT策略\s*立即执行/u);
    await assertText(operationsPage, operationsIds.ruleDetail, new RegExp(escaped(artifactTitle(full)), 'u'));
    await assertText(operationsPage, operationsIds.ruleDetail, new RegExp(escaped(artifactTitle(hot)), 'u'));
    await operationsPage.getByTestId(operationsIds.ruleDetailActions).click();
    await operationsPage.getByTestId(operationsIds.enableRuleAction).click();
    await assertText(
      operationsPage,
      'terminal-update-rule-status-confirmation',
      new RegExp(`启用“${escaped(title)}”？`, 'u'),
    );
    const statusResponsePromise = operationsPage.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith(`/terminal-update-rules/${ruleRef}/status`),
    );
    observePageWaiterRejection(input.runId, 'rule.enable', statusResponsePromise);
    await operationsPage.getByTestId(operationsIds.ruleStatusConfirm).click();
    const statusResponse = await statusResponsePromise;
    if (!statusResponse.ok()) {
      const problem = await problemSummary(statusResponse);
      supplyLog(input.runId, 'rule.enable.reject', `ruleRef=${ruleRef} ${problem}`);
      throw new Error(`TERMINAL_UPDATE_SUPPLY_RULE_ENABLE_HTTP_${problem.replaceAll(' ', ':')}`);
    }
    const enabledRule: unknown = await statusResponse.json();
    if (!isRecord(enabledRule) || text(enabledRule, 'ruleRef') !== ruleRef || text(enabledRule, 'status') !== 'ENABLED')
      throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_ENABLE_READBACK_MISMATCH');
    supplyLog(input.runId, 'rule.enable.readback', `ruleRef=${ruleRef} status=ENABLED`);
    await ruleRow.getByText('启用', {exact: true}).waitFor({state: 'visible', timeout: 30_000});
    await assertText(operationsPage, operationsIds.ruleRow(ruleRef), /启用/u);
    await expect(ruleRow.locator('.ant-tag')).toHaveClass(/ant-tag-success/u);
    await assertText(operationsPage, operationsIds.ruleDetail, /状态\s*启用/u);
    await operationsPage.getByTestId(operationsIds.ruleDetailActions).click();
    await assertText(operationsPage, operationsIds.enableRuleAction, /停用规则/u);
    await operationsPage.getByTestId(operationsIds.enableRuleAction).click();
    await assertText(
      operationsPage,
      'terminal-update-rule-status-confirmation',
      new RegExp(`停用“${escaped(title)}”？`, 'u'),
    );
    const disableResponsePromise = operationsPage.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith(`/terminal-update-rules/${ruleRef}/status`),
    );
    observePageWaiterRejection(input.runId, 'rule.disable', disableResponsePromise);
    await operationsPage.getByTestId(operationsIds.ruleStatusConfirm).click();
    const disableResponse = await disableResponsePromise;
    if (!disableResponse.ok()) throw new Error(`TERMINAL_UPDATE_SUPPLY_RULE_DISABLE_HTTP_${disableResponse.status()}`);
    const disabledRule: unknown = await disableResponse.json();
    if (
      !isRecord(disabledRule) ||
      text(disabledRule, 'ruleRef') !== ruleRef ||
      text(disabledRule, 'status') !== 'DISABLED'
    )
      throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_DISABLE_READBACK_MISMATCH');
    await assertText(operationsPage, operationsIds.ruleDetail, /状态\s*停用/u);
    await operationsPage.getByTestId(operationsIds.ruleDetailActions).click();
    await operationsPage.getByTestId(operationsIds.enableRuleAction).click();
    await assertText(
      operationsPage,
      'terminal-update-rule-status-confirmation',
      new RegExp(`启用“${escaped(title)}”？`, 'u'),
    );
    const reenableResponsePromise = operationsPage.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname.endsWith(`/terminal-update-rules/${ruleRef}/status`),
    );
    observePageWaiterRejection(input.runId, 'rule.reenable', reenableResponsePromise);
    await operationsPage.getByTestId(operationsIds.ruleStatusConfirm).click();
    const reenableResponse = await reenableResponsePromise;
    if (!reenableResponse.ok())
      throw new Error(`TERMINAL_UPDATE_SUPPLY_RULE_REENABLE_HTTP_${reenableResponse.status()}`);
    const reenabledRule: unknown = await reenableResponse.json();
    if (
      !isRecord(reenabledRule) ||
      text(reenabledRule, 'ruleRef') !== ruleRef ||
      text(reenabledRule, 'status') !== 'ENABLED'
    )
      throw new Error('TERMINAL_UPDATE_SUPPLY_RULE_REENABLE_READBACK_MISMATCH');
    await assertText(operationsPage, operationsIds.ruleDetail, /状态\s*启用/u);
    await operationsPage.getByTestId(operationsIds.ruleDetailActions).click();
    await operationsPage.getByTestId(operationsIds.ruleHistoryAction).click();
    const auditList = operationsPage.getByTestId('operations-audit-history-list');
    await auditList.waitFor({state: 'visible', timeout: 30_000});
    const auditItems = auditList.locator('[data-testid^="operations-audit-history-item-"]');
    const expectedAuditItemCount = 4; // CREATE, ENABLE, DISABLE, ENABLE.
    try {
      await expect(auditItems).toHaveCount(expectedAuditItemCount, {timeout: 5_000});
    } catch {
      const observedCount = await auditItems.count();
      supplyLog(
        input.runId,
        'rule.audit-history.mismatch',
        `ruleRef=${ruleRef} expectedItems=${expectedAuditItemCount} observedItems=${observedCount}`,
      );
      throw new Error(
        `TERMINAL_UPDATE_SUPPLY_RULE_AUDIT_HISTORY_COUNT_MISMATCH:expected=${expectedAuditItemCount}:observed=${observedCount}`,
      );
    }
    supplyLog(input.runId, 'rule.audit-history.readback', `ruleRef=${ruleRef} items=${expectedAuditItemCount}`);
    await operationsPage.keyboard.press('Escape');
    await operationsPage.getByTestId('operations-audit-history-modal').waitFor({state: 'hidden'});
    supplyLog(input.runId, 'rule.audit-history.closed', `ruleRef=${ruleRef}`);
    supplyLog(input.runId, 'rule.detail.close.begin', `ruleRef=${ruleRef}`);
    await operationsPage.getByTestId(operationsIds.ruleDetail).locator('button.ant-drawer-close').click();
    await operationsPage.getByTestId(operationsIds.ruleDetail).waitFor({state: 'hidden'});
    supplyLog(input.runId, 'rule.detail.closed', `ruleRef=${ruleRef}`);
    const ruleRefreshResponsePromise = operationsPage.waitForResponse(response => {
      if (response.request().method() !== 'GET') return false;
      const url = new URL(response.url());
      return url.pathname.endsWith('/terminal-update-rules') && !url.searchParams.has('status');
    });
    observePageWaiterRejection(input.runId, 'rule.refresh', ruleRefreshResponsePromise);
    await operationsPage.getByTestId(operationsIds.ruleRefresh).click();
    const ruleRefreshResponse = await ruleRefreshResponsePromise;
    if (!ruleRefreshResponse.ok())
      throw new Error(`TERMINAL_UPDATE_SUPPLY_RULE_REFRESH_HTTP_${ruleRefreshResponse.status()}`);
    await expect(ruleRow.locator('.ant-tag')).toHaveClass(/ant-tag-success/u);
    supplyLog(input.runId, 'rule.refresh.readback', `ruleRef=${ruleRef} status=ENABLED`);
    await operationsPage.getByTestId(operationsIds.reportsTabLabel).click();
    await assertText(operationsPage, operationsIds.reportsTabLabel, /^门店终端列表$/u);
    supplyLog(input.runId, 'reports.tab.opened', `ruleRef=${ruleRef}`);
    await waitForPage(operationsPage, operationsIds.reportList);
    process.stdout.write(
      `TERMINAL_AUTOMATION_SUPPLY_UI_READY run=${input.runId} app=${input.applicationId} full=registered hot=registered rule=enabled\n`,
    );
    return Object.freeze({
      browser,
      platformPage,
      operationsPage,
      projectRef: projectContext.projectRef,
      contextVersion: projectContext.contextVersion,
      full,
      hot,
      ruleRef,
      ruleTargetTitle: title,
      fullArtifactTitle: artifactTitle(full),
      hotArtifactTitle: artifactTitle(hot),
    });
  } catch (error) {
    await browser.close().catch(() => undefined);
    throw error;
  }
};

export const assertTerminalUpdateReportInUi = async (
  input: Readonly<{
    page: Page;
    terminalName: string;
    terminalRef: string;
    taskId: string;
    ruleRef: string;
    fullArtifactRef: string;
    hotArtifactRef: string;
    ruleTargetTitle: string;
    fullArtifactTitle: string;
    hotArtifactTitle: string;
    apkVersion: string;
    jsVersion: string;
    runtimeVersion: string;
    contextVersion: number;
    controlledHistory?: boolean;
    runId: string;
  }>,
): Promise<void> => {
  const {page} = input;
  await page.getByTestId(operationsIds.reportsTabLabel).click();
  const query = page.getByTestId(operationsIds.reportQuery);
  await query.fill(input.terminalName);
  await page.getByTestId(operationsIds.reportQuerySubmit).click();
  const row = page.getByTestId(operationsIds.reportRow(input.terminalRef));
  await row.waitFor({state: 'visible', timeout: 60_000});
  await assertText(
    page,
    operationsIds.reportRow(input.terminalRef),
    new RegExp(input.terminalName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
  );
  await assertText(
    page,
    operationsIds.reportRow(input.terminalRef),
    new RegExp(input.apkVersion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
  );
  await assertText(
    page,
    operationsIds.reportRow(input.terminalRef),
    new RegExp(input.jsVersion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
  );
  await assertText(
    page,
    operationsIds.reportRow(input.terminalRef),
    new RegExp(input.runtimeVersion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
  );
  await assertText(page, operationsIds.reportRow(input.terminalRef), /更新已完成/u);
  await assertText(page, operationsIds.reportRow(input.terminalRef), canonicalDatePattern);
  const historyResponsePromise = page.waitForResponse(
    response => {
      if (response.request().method() !== 'GET') return false;
      try {
        return new URL(response.url()).pathname.endsWith(`/terminal-versions/${input.terminalRef}/update-reports`);
      } catch {
        return false;
      }
    },
    {timeout: 60_000},
  );
  observePageWaiterRejection(input.runId, 'report.history.real.first-page', historyResponsePromise);
  await page.getByTestId(operationsIds.reportOpen(input.terminalRef)).click();
  const historyResponse = await historyResponsePromise;
  if (!historyResponse.ok())
    throw new Error(`TERMINAL_UPDATE_SUPPLY_REPORT_HISTORY_HTTP_FAILURE:${historyResponse.status()}`);
  const responseDiagnosticId = (value: string | undefined): string => value ?? 'unavailable';
  const readHistoryPage = async (
    response: import('playwright').Response,
  ): Promise<Readonly<{items: unknown[]; nextCursor: string | null; requestId: string; correlationId: string}>> => {
    const payload: unknown = await response.json().catch(() => undefined);
    if (
      !isRecord(payload) ||
      !Array.isArray(payload.items) ||
      (payload.nextCursor !== null && typeof payload.nextCursor !== 'string')
    )
      throw new Error('TERMINAL_UPDATE_SUPPLY_REPORT_HISTORY_RESPONSE_INVALID');
    const headers = await response.allHeaders();
    return {
      items: payload.items,
      nextCursor: payload.nextCursor,
      requestId: responseDiagnosticId(headers['x-request-id']),
      correlationId: responseDiagnosticId(headers['x-correlation-id']),
    };
  };
  const history = page.getByTestId(operationsIds.reportHistory);
  const rows = history.locator('tbody tr');
  await history.waitFor({state: 'visible'});
  await expect(rows.first()).toBeVisible({timeout: 60_000});

  let historyPageNumber = 1;
  let historyPage = await readHistoryPage(historyResponse);
  let taskIndex = historyPage.items.findIndex(item => isRecord(item) && item.taskId === input.taskId);
  const matchingReportFacts = (item: unknown): boolean => {
    if (!isRecord(item) || !isRecord(item.recent) || !isRecord(item.actual)) return false;
    return (
      item.recent.state === 'SUCCEEDED' &&
      item.recent.reason === 'NONE' &&
      item.recent.ruleRef === input.ruleRef &&
      item.recent.fullArtifactRef === input.fullArtifactRef &&
      item.recent.hotArtifactRef === input.hotArtifactRef &&
      item.actual.apkVersion === input.apkVersion &&
      item.actual.jsVersion === input.jsVersion &&
      item.actual.runtimeVersion === input.runtimeVersion
    );
  };
  let matchingFactsCount = historyPage.items.filter(matchingReportFacts).length;
  const requestedCursors = new Set<string>();
  const logHistoryPage = (): void => {
    const boundary = (item: unknown): string => {
      if (!isRecord(item)) return 'unavailable';
      const sequence = item.reportSequence;
      const receivedAt = item.receivedAtEpochMillis;
      return Number.isSafeInteger(sequence) && Number.isSafeInteger(receivedAt)
        ? `${String(sequence)}@${String(receivedAt)}`
        : 'invalid';
    };
    supplyLog(
      input.runId,
      'report.history.readback',
      `page=${historyPageNumber} requestId=${historyPage.requestId} correlationId=${historyPage.correlationId} items=${historyPage.items.length} firstSequenceAt=${boundary(historyPage.items[0])} lastSequenceAt=${boundary(historyPage.items.at(-1))} taskFound=${taskIndex >= 0 ? 1 : 0} matchingBusinessFacts=${matchingFactsCount} nextCursorPresent=${historyPage.nextCursor === null ? 0 : 1}`,
    );
  };
  logHistoryPage();
  while (taskIndex < 0 && historyPage.nextCursor !== null) {
    const cursor = historyPage.nextCursor;
    if (requestedCursors.has(cursor)) throw new Error('TERMINAL_UPDATE_SUPPLY_REPORT_HISTORY_CURSOR_REPEATED');
    requestedCursors.add(cursor);
    const nextPageNumber = historyPageNumber + 1;
    const nextHistoryResponsePromise = page.waitForResponse(
      response => {
        if (response.request().method() !== 'GET') return false;
        try {
          const url = new URL(response.url());
          return (
            url.pathname.endsWith(`/terminal-versions/${input.terminalRef}/update-reports`) &&
            url.searchParams.get('cursor') === cursor
          );
        } catch {
          return false;
        }
      },
      {timeout: 60_000},
    );
    observePageWaiterRejection(input.runId, `report.history.real.cursor=${cursor}`, nextHistoryResponsePromise);
    await page.getByTestId(`${operationsIds.reportHistoryPagination}-next`).click();
    const nextHistoryResponse = await nextHistoryResponsePromise;
    if (!nextHistoryResponse.ok())
      throw new Error(`TERMINAL_UPDATE_SUPPLY_REPORT_HISTORY_HTTP_FAILURE:${nextHistoryResponse.status()}`);
    historyPage = await readHistoryPage(nextHistoryResponse);
    historyPageNumber = nextPageNumber;
    taskIndex = historyPage.items.findIndex(item => isRecord(item) && item.taskId === input.taskId);
    matchingFactsCount = historyPage.items.filter(matchingReportFacts).length;
    await expect(page.getByTestId(operationsIds.reportHistoryPagination)).toContainText(`第 ${historyPageNumber} 页`);
    logHistoryPage();
  }
  if (taskIndex < 0)
    throw new Error(
      `TERMINAL_UPDATE_SUPPLY_REPORT_HISTORY_TASK_ID_MISMATCH:pages=${historyPageNumber}:matches=0:businessFacts=${matchingFactsCount}`,
    );
  const taskItem = historyPage.items[taskIndex];
  if (!isRecord(taskItem)) throw new Error('TERMINAL_UPDATE_SUPPLY_REPORT_HISTORY_TASK_INVALID');
  expect(taskItem).toMatchObject({
    recent: {
      state: 'SUCCEEDED',
      reason: 'NONE',
      ruleRef: input.ruleRef,
      fullArtifactRef: input.fullArtifactRef,
      hotArtifactRef: input.hotArtifactRef,
    },
    actual: {
      apkVersion: input.apkVersion,
      jsVersion: input.jsVersion,
      runtimeVersion: input.runtimeVersion,
    },
  });
  await page.getByTestId(operationsIds.reportDetail).waitFor({state: 'visible'});
  await assertText(
    page,
    operationsIds.reportDetail,
    new RegExp(`${input.terminalName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')} · 终端更新状态详情`, 'u'),
  );
  await assertText(page, operationsIds.reportDetail, new RegExp(escaped(input.ruleTargetTitle), 'u'));
  await assertText(page, operationsIds.reportDetail, new RegExp(escaped(input.fullArtifactTitle), 'u'));
  await assertText(page, operationsIds.reportDetail, new RegExp(escaped(input.hotArtifactTitle), 'u'));
  await expect(page.getByTestId(operationsIds.reportDetail)).not.toContainText(input.ruleRef);
  await expect(page.getByTestId(operationsIds.reportDetail)).not.toContainText(input.fullArtifactRef);
  await expect(page.getByTestId(operationsIds.reportDetail)).not.toContainText(input.hotArtifactRef);
  await assertText(
    page,
    operationsIds.reportDetail,
    new RegExp(input.apkVersion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
  );
  await assertText(
    page,
    operationsIds.reportDetail,
    new RegExp(input.jsVersion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
  );
  await assertText(
    page,
    operationsIds.reportDetail,
    new RegExp(input.runtimeVersion.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')),
  );
  await assertText(page, operationsIds.reportDetail, /最近状态\s*更新已完成/u);
  await assertText(page, operationsIds.reportDetail, /最近原因\s*无/u);
  await assertText(page, operationsIds.reportDetail, new RegExp(`状态发生时间\\s*${canonicalDatePattern.source}`, 'u'));
  await assertText(
    page,
    operationsIds.reportDetail,
    new RegExp(`服务端接收时间\\s*${canonicalDatePattern.source}`, 'u'),
  );
  const visibleHistoryRows = await rows.count();
  const taskRow = rows.nth(taskIndex);
  // The API taskId is the exact business identity. Visible titles are display values and may repeat.
  await expect(taskRow).toContainText(new RegExp(escaped(input.ruleTargetTitle), 'u'));
  await expect(taskRow).toContainText(new RegExp(escaped(input.fullArtifactTitle), 'u'));
  await expect(taskRow).toContainText(new RegExp(escaped(input.hotArtifactTitle), 'u'));
  await expect(taskRow).not.toContainText(input.ruleRef);
  await expect(taskRow).not.toContainText(input.fullArtifactRef);
  await expect(taskRow).not.toContainText(input.hotArtifactRef);
  await expect(taskRow).toContainText(/更新已完成/u);
  await expect(taskRow).toContainText(/无/u);
  await expect(taskRow).toContainText(canonicalDatePattern);
  if (input.controlledHistory === true) {
    const historyUrl = new URL(historyResponse.url());
    const historyPath = historyUrl.pathname;
    const cursorFromUrl = (url: URL): string | null => {
      const cursor = url.searchParams.get('cursor');
      return cursor === null || cursor.trim() === '' ? null : cursor;
    };
    const fixtureCursor = 't1-controlled-history-page-2';
    const fixtureTaskIds = ['90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002'] as const;
    const fixtureItems = fixtureTaskIds.map((taskId, index) => {
      const item = structuredClone(taskItem) as Record<string, unknown>;
      if (!isRecord(item.actual)) throw new Error('TERMINAL_UPDATE_SUPPLY_CONTROLLED_HISTORY_FIXTURE_ACTUAL_INVALID');
      item.reportId = index === 0 ? '91000000-0000-4000-8000-000000000001' : '91000000-0000-4000-8000-000000000002';
      item.taskId = taskId;
      item.reportSequence = integer(taskItem, 'reportSequence') + index + 1;
      item.receivedAtEpochMillis = integer(taskItem, 'receivedAtEpochMillis') + (index + 1) * 1000;
      item.actual.apkVersion = `${input.apkVersion}-history-page-${index + 1}`;
      return item;
    });
    if (new Set(fixtureTaskIds).size !== 2 || fixtureTaskIds.some(taskId => taskId === input.taskId))
      throw new Error('TERMINAL_UPDATE_SUPPLY_CONTROLLED_HISTORY_FIXTURE_IDENTITY_INVALID');
    const controlledPage = (
      pageNumber: 0 | 1,
    ): Readonly<{items: Record<string, unknown>[]; nextCursor: string | null}> => ({
      items: [fixtureItems[pageNumber]!],
      nextCursor: pageNumber === 0 ? fixtureCursor : null,
    });
    const controlledRequests: Array<string | null> = [];
    const inFlightRouteHandlers = new Set<Promise<void>>();
    const routeHandlerFailures: unknown[] = [];
    let routeHandlerStarted = 0;
    let routeHandlerSettled = 0;
    const routeHandler = (route: import('playwright').Route): Promise<void> => {
      const handlerPromise = (async (): Promise<void> => {
        const request = route.request();
        const url = new URL(request.url());
        const rawCursor = url.searchParams.get('cursor');
        const cursor = cursorFromUrl(url);
        supplyLog(
          input.runId,
          'report.history.controlled-pagination.request',
          `method=${request.method()} contextMatches=${url.searchParams.get('expectedContextVersion') === String(input.contextVersion)} cursorEncoding=${rawCursor === null ? 'absent' : rawCursor.trim() === '' ? 'empty' : 'opaque'} page=${cursor === null ? 'first' : 'later'}`,
        );
        if (
          request.method() !== 'GET' ||
          url.origin !== historyUrl.origin ||
          url.pathname !== historyPath ||
          url.searchParams.get('expectedContextVersion') !== String(input.contextVersion)
        ) {
          await route.continue();
          return;
        }
        controlledRequests.push(cursor);
        if (cursor === null) {
          await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(controlledPage(0))});
        } else if (cursor === fixtureCursor) {
          await route.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(controlledPage(1))});
        } else {
          await route.continue();
        }
      })();
      routeHandlerStarted += 1;
      inFlightRouteHandlers.add(handlerPromise);
      void handlerPromise.then(
        () => {
          routeHandlerSettled += 1;
          inFlightRouteHandlers.delete(handlerPromise);
        },
        error => {
          routeHandlerSettled += 1;
          routeHandlerFailures.push(error);
          inFlightRouteHandlers.delete(handlerPromise);
        },
      );
      return handlerPromise;
    };
    const waitForControlledPage = (cursor: string | null) => {
      const responsePromise = page.waitForResponse(
        response => {
          if (response.request().method() !== 'GET') return false;
          const url = new URL(response.url());
          return (
            url.origin === historyUrl.origin &&
            url.pathname === historyPath &&
            url.searchParams.get('expectedContextVersion') === String(input.contextVersion) &&
            cursorFromUrl(url) === cursor
          );
        },
        {timeout: 30_000},
      );
      return responsePromise;
    };
    const clickAndWaitForPageResponse = async (
      responsePromise: Promise<import('playwright').Response>,
      click: () => Promise<void>,
      phase: string,
    ) => {
      observePageWaiterRejection(input.runId, `report.history.controlled-pagination.${phase}`, responsePromise);
      const [, response] = await Promise.all([click(), responsePromise]);
      return response;
    };
    const clickAndWaitForControlledPage = async (
      cursor: string | null,
      locator: import('playwright').Locator,
    ) => {
      return clickAndWaitForPageResponse(
        waitForControlledPage(cursor),
        () => locator.click(),
        `controlled-cursor=${cursor ?? 'first'}`,
      );
    };
    const historyRouteMatcher = (url: URL): boolean => url.origin === historyUrl.origin && url.pathname === historyPath;
    const fixtureHistoryRows = page.getByTestId(operationsIds.reportHistory).locator('tbody tr');
    await page.getByTestId(operationsIds.reportDetailClose).click();
    await page.getByTestId(operationsIds.reportDetail).waitFor({state: 'hidden'});
    await page.route(historyRouteMatcher, routeHandler);
    let controlledHistoryFailure: unknown;
    let routeReleaseFailure: unknown;
    let exactUnrouteCompleted = false;
    let ownerPageClosedForCleanup = false;
    let inFlightAtUnroute = 0;
    try {
      const firstFixtureResponse = await clickAndWaitForControlledPage(
        null,
        page.getByTestId(operationsIds.reportOpen(input.terminalRef)),
      );
      if (!firstFixtureResponse.ok())
        throw new Error(`TERMINAL_UPDATE_SUPPLY_CONTROLLED_HISTORY_HTTP_${firstFixtureResponse.status()}`);
      await expect(page.getByTestId(operationsIds.reportHistoryPagination)).toContainText('第 1 页');
      await expect(fixtureHistoryRows).toHaveCount(1);
      await expect(fixtureHistoryRows.first()).toContainText(`${input.apkVersion}-history-page-1`);
      await expect(fixtureHistoryRows.first()).not.toContainText(`${input.apkVersion}-history-page-2`);

      const secondFixtureResponse = await clickAndWaitForControlledPage(
        fixtureCursor,
        page.getByTestId(operationsIds.reportHistoryNext),
      );
      if (!secondFixtureResponse.ok())
        throw new Error(`TERMINAL_UPDATE_SUPPLY_CONTROLLED_HISTORY_HTTP_${secondFixtureResponse.status()}`);
      await expect(page.getByTestId(operationsIds.reportHistoryPagination)).toContainText('第 2 页');
      await expect(fixtureHistoryRows).toHaveCount(1);
      await expect(fixtureHistoryRows.first()).toContainText(`${input.apkVersion}-history-page-2`);
      await expect(fixtureHistoryRows.first()).not.toContainText(`${input.apkVersion}-history-page-1`);

      const previousFixtureResponse = await clickAndWaitForControlledPage(
        null,
        page.getByTestId(operationsIds.reportHistoryPrevious),
      );
      if (!previousFixtureResponse.ok())
        throw new Error(`TERMINAL_UPDATE_SUPPLY_CONTROLLED_HISTORY_HTTP_${previousFixtureResponse.status()}`);
      await expect(page.getByTestId(operationsIds.reportHistoryPagination)).toContainText('第 1 页');
      await expect(fixtureHistoryRows.first()).toContainText(`${input.apkVersion}-history-page-1`);

      await page.getByTestId(operationsIds.reportDetailClose).click();
      await page.getByTestId(operationsIds.reportDetail).waitFor({state: 'hidden'});
      const reportListRefreshPromise = page.waitForResponse(
        response => {
          if (response.request().method() !== 'GET') return false;
          const url = new URL(response.url());
          return (
            url.origin === historyUrl.origin &&
            url.pathname.endsWith('/terminal-versions') &&
            url.searchParams.get('expectedContextVersion') === String(input.contextVersion)
          );
        },
        {timeout: 30_000},
      );
      const [, reportListRefreshResponse] = await Promise.all([
        page.getByTestId('operations-shell-refresh-current').click(),
        reportListRefreshPromise,
      ]);
      if (!reportListRefreshResponse.ok())
        throw new Error(`TERMINAL_UPDATE_SUPPLY_REPORT_LIST_REFRESH_HTTP_${reportListRefreshResponse.status()}`);
      const refreshFixtureResponse = await clickAndWaitForControlledPage(
        null,
        page.getByTestId(operationsIds.reportOpen(input.terminalRef)),
      );
      if (!refreshFixtureResponse.ok())
        throw new Error(`TERMINAL_UPDATE_SUPPLY_CONTROLLED_HISTORY_HTTP_${refreshFixtureResponse.status()}`);
      await expect(page.getByTestId(operationsIds.reportHistoryPagination)).toContainText('第 1 页');
      await expect(fixtureHistoryRows.first()).toContainText(`${input.apkVersion}-history-page-1`);
      expect(controlledRequests).toEqual([null, fixtureCursor, null, null]);
      supplyLog(
        input.runId,
        'report.history.controlled-pagination',
        `terminalRef=${input.terminalRef} pageTaskIds=${fixtureTaskIds.join(',')} cursorRequests=${controlledRequests.map(value => value ?? 'first').join(',')} duplicateTasks=0`,
      );
    } catch (error) {
      controlledHistoryFailure = error;
    } finally {
      try {
        await page.unroute(historyRouteMatcher, routeHandler);
        exactUnrouteCompleted = true;
      } catch (error) {
        routeReleaseFailure = error;
      }
      inFlightAtUnroute = inFlightRouteHandlers.size;
      if (!exactUnrouteCompleted || (controlledHistoryFailure !== undefined && inFlightAtUnroute > 0)) {
        try {
          await page.close();
          ownerPageClosedForCleanup = true;
        } catch (error) {
          routeReleaseFailure ??= error;
        }
      }
      const settledHandlers: PromiseSettledResult<void>[] = [];
      while (inFlightRouteHandlers.size > 0) {
        settledHandlers.push(...(await Promise.allSettled([...inFlightRouteHandlers])));
      }
      if (controlledHistoryFailure === undefined && routeHandlerFailures.length > 0)
        controlledHistoryFailure = routeHandlerFailures[0];
      const handlerReleased = (exactUnrouteCompleted || ownerPageClosedForCleanup) && inFlightRouteHandlers.size === 0;
      if (!handlerReleased)
        routeReleaseFailure ??= new Error('TERMINAL_UPDATE_SUPPLY_CONTROLLED_HISTORY_HANDLER_NOT_RELEASED');
      const handlerFailureDetails = routeHandlerFailures.map(error =>
        error instanceof Error
          ? {name: error.name, message: error.message, stack: error.stack}
          : {value: String(error)},
      );
      supplyLog(
        input.runId,
        'report.history.controlled-pagination.route-released',
        `terminalRef=${input.terminalRef} routeHandlerStarted=${routeHandlerStarted} routeHandlerSettled=${routeHandlerSettled} inFlightAtUnroute=${inFlightAtUnroute} cleanupSettled=${settledHandlers.length} handlerFailureCount=${routeHandlerFailures.length} handlerFailureDetails=${JSON.stringify(handlerFailureDetails)} exactUnrouteCompleted=${exactUnrouteCompleted} ownerPageClosedForCleanup=${ownerPageClosedForCleanup} handlerReleased=${handlerReleased}`,
      );
      if (routeReleaseFailure !== undefined)
        supplyLog(input.runId, 'report.history.controlled-pagination.route-release-failed', String(routeReleaseFailure));
    }
    if (controlledHistoryFailure !== undefined) throw controlledHistoryFailure;
    if (routeReleaseFailure !== undefined) throw routeReleaseFailure;

    await page.getByTestId(operationsIds.reportDetailClose).click();
    await page.getByTestId(operationsIds.reportDetail).waitFor({state: 'hidden'});
    const restoredHistoryResponsePromise = page.waitForResponse(
      response => {
        if (response.request().method() !== 'GET') return false;
        const url = new URL(response.url());
        return (
          url.origin === historyUrl.origin &&
          url.pathname === historyPath &&
          url.searchParams.get('expectedContextVersion') === String(input.contextVersion) &&
          cursorFromUrl(url) === null
        );
      },
      {timeout: 60_000},
    );
    let restoredResponse = await clickAndWaitForPageResponse(
      restoredHistoryResponsePromise,
      () => page.getByTestId(operationsIds.reportOpen(input.terminalRef)).click(),
      'restore-first-page',
    );
    let restoredPage = await readHistoryPage(restoredResponse);
    let restoredTaskFound = restoredPage.items.some(item => isRecord(item) && item.taskId === input.taskId);
    const restoredCursors = new Set<string>();
    while (!restoredTaskFound && restoredPage.nextCursor !== null) {
      const cursor = restoredPage.nextCursor;
      if (restoredCursors.has(cursor)) throw new Error('TERMINAL_UPDATE_SUPPLY_RESTORED_HISTORY_CURSOR_REPEATED');
      restoredCursors.add(cursor);
      const restoredNextResponsePromise = page.waitForResponse(
        response => {
          if (response.request().method() !== 'GET') return false;
          const url = new URL(response.url());
          return (
            url.origin === historyUrl.origin &&
            url.pathname === historyPath &&
            url.searchParams.get('expectedContextVersion') === String(input.contextVersion) &&
            cursorFromUrl(url) === cursor
          );
        },
        {timeout: 60_000},
      );
      restoredResponse = await clickAndWaitForPageResponse(
        restoredNextResponsePromise,
        () => page.getByTestId(operationsIds.reportHistoryNext).click(),
        `restore-cursor=${cursor}`,
      );
      restoredPage = await readHistoryPage(restoredResponse);
      restoredTaskFound = restoredPage.items.some(item => isRecord(item) && item.taskId === input.taskId);
    }
    if (!restoredTaskFound) throw new Error('TERMINAL_UPDATE_SUPPLY_RESTORED_REAL_TASK_NOT_FOUND');
    supplyLog(
      input.runId,
      'report.history.real-owner-restored',
      `terminalRef=${input.terminalRef} taskId=${input.taskId} found=true controlledHandlerRemoved=true`,
    );
  }
  process.stdout.write(
    `TERMINAL_AUTOMATION_SUPPLY_REPORT_READBACK run=${input.runId} terminal=matched taskId=${input.taskId} historyPage=${historyPageNumber} currentTaskFound=1 visibleHistoryRows=${visibleHistoryRows}\n`,
  );
};
