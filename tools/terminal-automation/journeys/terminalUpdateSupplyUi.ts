import {chromium, type Browser, type Locator, type Page, type Request} from 'playwright';
import {expect} from 'playwright/test';
import {terminalUpdateTestIds as platformIds} from '../../../apps/frontend/platform-admin/src/app/automation/terminalUpdateTestIds.ts';
import {platformWorkspaceTestIds} from '../../../apps/frontend/platform-admin/src/app/automation/platformWorkspaceTestIds.ts';
import {terminalUpdateTestIds as operationsIds} from '../../../apps/frontend/operations-admin/src/app/automation/terminalUpdateTestIds.ts';
import {
  roleHomeDataScopeOptionPrefix,
  roleHomeTestIds,
} from '../../../apps/frontend/operations-admin/src/features/role-home-bootstrap/roleHomeTestIds.ts';

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
const safeProblemSummary = async (response: import('playwright').Response): Promise<string> => {
  const problem: unknown = await response.json().catch(() => undefined);
  const code =
    isRecord(problem) && typeof problem.errorCode === 'string'
      ? problem.errorCode
      : isRecord(problem) && typeof problem.title === 'string'
        ? problem.title.replace(/[^A-Za-z0-9_-]/gu, '_').slice(0, 64)
        : 'UNKNOWN';
  const correlationId =
    isRecord(problem) && typeof problem.correlationId === 'string' ? problem.correlationId : 'unavailable';
  return `status=${response.status()} code=${code} correlationId=${correlationId}`;
};

const safeBrowserError = (message: string): string =>
  message
    .replace(/https?:\/\/[^\s)]+/gu, '[URL]')
    .replace(/\b(password|token|secret|authorization|cookie)\b\s*[:=]\s*[^\s,;]+/giu, '$1=[REDACTED]')
    .replace(/\s+/gu, ' ')
    .slice(0, 200);

const isPlatformSessionRequest = (request: Request): boolean => {
  try {
    return new URL(request.url()).pathname === '/api/platform/auth/session';
  } catch {
    return false;
  }
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
  page: Page,
  controlTestId: string,
  _optionTestIdPrefix: string,
  expectedLabel: RegExp,
): Promise<void> => {
  const control = page.getByTestId(controlTestId);
  const input = control.locator('input').first();
  await input.waitFor({state: 'visible'});
  await input.click();
  const dropdown = await activeSelectDropdown(page, input);
  await dropdown.waitFor({state: 'visible', timeout: 30_000});
  const matching = dropdown.locator('.ant-select-item-option:visible').filter({hasText: expectedLabel});
  try {
    await expect(matching.first()).toBeVisible({timeout: 5_000});
  } catch {
    const visibleLabels: string[] = [];
    const visibleOptions = dropdown.locator('.ant-select-item-option:visible');
    for (let index = 0; index < Math.min(await visibleOptions.count(), 20); index += 1) {
      visibleLabels.push((await visibleOptions.nth(index).innerText()).replace(/\s+/gu, ' ').trim());
    }
    const dropdownText = (await dropdown.innerText().catch(() => '')).replace(/\s+/gu, ' ').trim();
    throw new Error(
      `TERMINAL_UPDATE_SUPPLY_OPTION_NOT_FOUND:${controlTestId}:${expectedLabel.source}:${visibleLabels.join('|')}:${dropdownText.slice(0, 200)}`,
    );
  }
  const count = await matching.count();
  const option = matching.last();
  await option.scrollIntoViewIfNeeded();
  await option.click();
  await page.waitForTimeout(75);
  if ((await input.getAttribute('aria-expanded').catch(() => null)) === 'true') await page.keyboard.press('Escape');
  if (!expectedLabel.test(await control.innerText())) {
    throw new Error(`TERMINAL_UPDATE_SUPPLY_OPTION_SELECTION_MISMATCH:${controlTestId}`);
  }
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
      .catch(() => ({path: 'unavailable', readyState: 'unavailable', loginVisible: false, workspaceVisible: false, recoveringSession: false}));
    throw new Error(`TERMINAL_UPDATE_SUPPLY_PAGE_NOT_VISIBLE:${testId}:${JSON.stringify(state)}`);
  }
};

const activeSelectDropdown = (_page: Page, _input: Locator): Locator =>
  _page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible').last();

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
    const problem = await safeProblemSummary(stageResponse);
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
  await page.getByTestId(platformIds.save).click();
  const response = await savedResponse;
  if (!response.ok()) {
    const problem = await safeProblemSummary(response);
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
    const sessionRequestStartedAt = new WeakMap<Request, number>();
    platformPage.on('request', request => {
      if (!isPlatformSessionRequest(request)) return;
      sessionRequestStartedAt.set(request, Date.now());
      supplyLog(input.runId, 'platform.session.request', `method=${request.method()}`);
    });
    platformPage.on('response', response => {
      const request = response.request();
      if (!isPlatformSessionRequest(request)) return;
      const startedAt = sessionRequestStartedAt.get(request);
      supplyLog(
        input.runId,
        'platform.session.response',
        `status=${response.status()} elapsedMs=${startedAt === undefined ? 'unknown' : Date.now() - startedAt}`,
      );
    });
    platformPage.on('requestfailed', request => {
      if (!isPlatformSessionRequest(request)) return;
      const startedAt = sessionRequestStartedAt.get(request);
      supplyLog(
        input.runId,
        'platform.session.request.failed',
        `elapsedMs=${startedAt === undefined ? 'unknown' : Date.now() - startedAt} reason=${safeBrowserError(request.failure()?.errorText ?? 'UNKNOWN')}`,
      );
    });
    platformPage.on('pageerror', error => {
      supplyLog(input.runId, 'platform.page.error', `name=${error.name} message=${safeBrowserError(error.message)}`);
    });
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
    supplyLog(input.runId, 'operations.session.ready');
    await operationsPage.goto(new URL('/operations/aurora/terminal-update/rules', input.operationsOrigin).toString());
    const scope = operationsPage.getByTestId(roleHomeTestIds.dataScope.trigger);
    await scope.waitFor({state: 'visible', timeout: 30_000});
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
    await waitForPage(operationsPage, operationsIds.page);
    if (input.verifyIdleDuration) {
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
      const idleResponsePromise = operationsPage.waitForResponse(
        response =>
          response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/terminal-update-rules'),
      );
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
        const problem = await safeProblemSummary(idleResponse);
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
    const ruleRequestPromise = operationsPage.waitForRequest(
      request => request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/terminal-update-rules'),
    );
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
      const problem = await safeProblemSummary(ruleResponse);
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
    await assertText(operationsPage, operationsIds.ruleRow(ruleRef), new RegExp(escaped(title), 'u'));
    await expect(ruleRow.locator('.ant-tag')).toHaveClass(/ant-tag-warning/u);
    const ruleStoresResponsePromise = operationsPage.waitForResponse(
      response =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname.endsWith(`/terminal-update-rules/${ruleRef}/stores`),
    );
    await operationsPage.getByTestId(operationsIds.ruleOpen(ruleRef)).click();
    const ruleStoresResponse = await ruleStoresResponsePromise;
    if (!ruleStoresResponse.ok()) {
      const problem = await safeProblemSummary(ruleStoresResponse);
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
    await operationsPage.getByTestId(operationsIds.ruleStatusConfirm).click();
    const statusResponse = await statusResponsePromise;
    if (!statusResponse.ok()) {
      const problem = await safeProblemSummary(statusResponse);
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
    await operationsPage.getByTestId(operationsIds.ruleHistoryAction).click();
    const auditList = operationsPage.getByTestId('operations-audit-history-list');
    await auditList.waitFor({state: 'visible', timeout: 30_000});
    const auditItems = auditList.locator('[data-testid^="operations-audit-history-item-"]');
    try {
      await expect(auditItems).toHaveCount(2, {timeout: 5_000});
    } catch {
      const observedCount = await auditItems.count();
      supplyLog(
        input.runId,
        'rule.audit-history.mismatch',
        `ruleRef=${ruleRef} expectedItems=2 observedItems=${observedCount}`,
      );
      throw new Error(`TERMINAL_UPDATE_SUPPLY_RULE_AUDIT_HISTORY_COUNT_MISMATCH:expected=2:observed=${observedCount}`);
    }
    supplyLog(input.runId, 'rule.audit-history.readback', `ruleRef=${ruleRef} items=2`);
    await operationsPage.keyboard.press('Escape');
    await operationsPage.getByTestId('operations-audit-history-modal').waitFor({state: 'hidden'});
    supplyLog(input.runId, 'rule.audit-history.closed', `ruleRef=${ruleRef}`);
    supplyLog(input.runId, 'rule.detail.close.begin', `ruleRef=${ruleRef}`);
    await operationsPage.getByTestId(operationsIds.ruleDetail).locator('button.ant-drawer-close').click();
    await operationsPage.getByTestId(operationsIds.ruleDetail).waitFor({state: 'hidden'});
    supplyLog(input.runId, 'rule.detail.closed', `ruleRef=${ruleRef}`);
    await operationsPage.getByTestId(operationsIds.reportsTabLabel).click();
    await assertText(operationsPage, operationsIds.reportsTabLabel, /^终端更新状态$/u);
    supplyLog(input.runId, 'reports.tab.opened', `ruleRef=${ruleRef}`);
    await waitForPage(operationsPage, operationsIds.reportList);
    process.stdout.write(
      `TERMINAL_AUTOMATION_SUPPLY_UI_READY run=${input.runId} app=${input.applicationId} full=registered hot=registered rule=enabled\n`,
    );
    return Object.freeze({
      browser,
      operationsPage,
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
    ruleRef: string;
    fullArtifactRef: string;
    hotArtifactRef: string;
    ruleTargetTitle: string;
    fullArtifactTitle: string;
    hotArtifactTitle: string;
    apkVersion: string;
    jsVersion: string;
    runtimeVersion: string;
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
  await page.getByTestId(operationsIds.reportOpen(input.terminalRef)).click();
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
  await assertText(page, operationsIds.reportDetail, new RegExp(`服务端接收时间\\s*${canonicalDatePattern.source}`, 'u'));
  const history = page.getByTestId(operationsIds.reportHistory);
  await history.waitFor({state: 'visible'});
  const rows = history.locator('tbody tr');
  try {
    await expect(rows).toHaveCount(1, {timeout: 5_000});
  } catch {
    throw new Error('TERMINAL_UPDATE_SUPPLY_REPORT_HISTORY_COUNT_MISMATCH');
  }
  await assertText(page, operationsIds.reportHistory, new RegExp(escaped(input.ruleTargetTitle), 'u'));
  await assertText(page, operationsIds.reportHistory, new RegExp(escaped(input.fullArtifactTitle), 'u'));
  await assertText(page, operationsIds.reportHistory, new RegExp(escaped(input.hotArtifactTitle), 'u'));
  await expect(history).not.toContainText(input.ruleRef);
  await expect(history).not.toContainText(input.fullArtifactRef);
  await expect(history).not.toContainText(input.hotArtifactRef);
  await assertText(page, operationsIds.reportHistory, /更新已完成/u);
  await assertText(page, operationsIds.reportHistory, /无/u);
  await assertText(page, operationsIds.reportHistory, canonicalDatePattern);
  process.stdout.write(`TERMINAL_AUTOMATION_SUPPLY_REPORT_READBACK run=${input.runId} terminal=matched history=1\n`);
};
