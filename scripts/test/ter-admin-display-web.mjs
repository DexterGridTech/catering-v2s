#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {readProcessTable, snapshotProcessTree, terminateOwnedProcessTree} from '../dev/managed-process-tree.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeRoot = path.join(root, '.runtime/ter-admin-display');
const integrationName = process.argv[5] ?? 'sample-console';
if (!['sample-console', 'sample-wallpaper-console'].includes(integrationName)) {
  throw new Error('TER_ADMIN_DISPLAY_WEB_INTEGRATION_INVALID');
}
const integrationRoot = path.join(root, 'apps/terminal/ui/integration', integrationName);
const appName = integrationName === 'sample-console' ? 'sample-terminal' : 'sample-wallpaper-terminal';
const appRoot = path.join(root, 'apps/terminal/application/android', appName);
const surfaceTestIdPrefix = `${integrationName}:test-expo:surface:PRIMARY`;
const webScenario = process.argv[6] ?? 'admin-runtime';
if (![
  'admin-runtime',
  'keyboard-login',
  'keyboard-member-journey',
  'keyboard-overlay-ownership',
  'textinput-contextmenu',
].includes(webScenario)) {
  throw new Error('TER_ADMIN_DISPLAY_WEB_SCENARIO_INVALID');
}
const surfaceForm = process.argv[7] ?? 'laptop';
if (!['laptop', 'mobile'].includes(surfaceForm)) throw new Error('TER_ADMIN_DISPLAY_WEB_SURFACE_FORM_INVALID');
const integrationPackage = JSON.parse(fs.readFileSync(path.join(integrationRoot, 'package.json'), 'utf8'));
const expectedPrimaryLogicalSize = integrationPackage.terminalSurfaces?.orientations?.landscape?.PRIMARY;
if (
  !Number.isFinite(expectedPrimaryLogicalSize?.width) ||
  !Number.isFinite(expectedPrimaryLogicalSize?.height) ||
  expectedPrimaryLogicalSize.width <= 0 ||
  expectedPrimaryLogicalSize.height <= 0
) {
  throw new Error('WEB_PRIMARY_LOGICAL_SIZE_SOURCE_INVALID');
}
const runId = process.argv[2];
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(runId ?? '')) throw new Error('TER_ADMIN_DISPLAY_RUN_ID_REQUIRED');
const port = Number(process.argv[3] ?? 8093);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('TER_ADMIN_DISPLAY_PORT_INVALID');
const failureOwnerArgument = process.argv[4] ?? null;
const failureOwner = failureOwnerArgument === '-' ? null : failureOwnerArgument;
if (failureOwner !== null && !/^[A-Za-z0-9:._-]{1,160}$/.test(failureOwner)) {
  throw new Error('TER_ADMIN_DISPLAY_FAILURE_OWNER_INVALID');
}
const runRoot = path.join(runtimeRoot, runId);
if (fs.existsSync(runRoot)) throw new Error('TER_ADMIN_DISPLAY_RUN_ALREADY_EXISTS');
fs.mkdirSync(runRoot, {recursive: true, mode: 0o700});

const files = [
  path.relative(root, path.join(appRoot, 'package.json')),
  path.relative(root, path.join(appRoot, 'android/app/build.gradle')),
  'apps/terminal/application/base/android/config/index.cjs',
  path.relative(root, path.join(integrationRoot, 'package.json')),
  path.relative(root, path.join(integrationRoot, 'tailwind.config.cjs')),
  path.relative(root, path.join(integrationRoot, 'src/index.ts')),
  path.relative(root, path.join(integrationRoot, 'src/application/terminalSurfaces.ts')),
  path.relative(root, path.join(integrationRoot, 'test-expo/App.tsx')),
  'apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLoginOperatorNameInput.tsx',
  'apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLoginPasscodeInput.tsx',
  'apps/terminal/ui/feature/sample-staff-auth/src/components/laptop/StaffLogin.tsx',
  'apps/terminal/ui/feature/sample-staff-auth/src/hooks/useStaffLogin.ts',
  'apps/terminal/ui/feature/sample-member-desk/src/components/MemberFormScrollContent.tsx',
  'apps/terminal/ui/feature/sample-member-desk/src/components/laptop/MemberForm.tsx',
  'apps/terminal/ui/feature/sample-member-desk/src/components/laptop/MemberList.tsx',
  'apps/terminal/ui/feature/sample-member-desk/src/hooks/useMemberForm.ts',
  'apps/terminal/ui/base/input/src/components/VirtualKeyboard.tsx',
  'apps/terminal/ui/base/input/src/foundations/keyboardLayout.ts',
  'apps/terminal/ui/base/input/src/foundations/editText.ts',
  'apps/terminal/ui/base/render/src/types/runtimeFacts.ts',
  'apps/terminal/ui/base/render/src/components/SystemFailureBoundary.tsx',
  'apps/terminal/ui/base/render/src/components/SystemFailureNotice.tsx',
  'apps/terminal/ui/base/render/src/components/ScreenContainer.tsx',
  'apps/terminal/ui/base/render/src/components/ScreenReadyBoundary.tsx',
  'apps/terminal/ui/base/render/src/components/LayerStack.tsx',
  'apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx',
  'apps/terminal/kernel/base/runtime/src/features/actors/resetRuntimeAfterSystemFailureActor.ts',
  'apps/terminal/kernel/base/runtime/src/features/commands/resetRuntimeAfterSystemFailure.ts',
  'apps/terminal/ui/base/integration-assembly/src/foundations/integrationAssembly.tsx',
  'apps/terminal/ui/base/admin-shell/src/hooks/useAdminRuntimeDisplay.ts',
  'apps/terminal/ui/base/admin-shell/src/foundations/runtimeDisplay.ts',
  'apps/terminal/ui/base/admin-shell/src/foundations/adminTestIds.ts',
  'apps/terminal/ui/base/admin-shell/src/components/sections/RuntimeSectionLaptop.tsx',
  'apps/terminal/ui/base/admin-shell/src/components/sections/RuntimeSectionMobile.tsx',
  'apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSectionLaptop.tsx',
  'apps/terminal/ui/base/admin-shell/src/components/sections/DisplayContextSectionMobile.tsx',
  'apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx',
  'apps/terminal/ui/base/primitives/src/components/PrimitiveAdmin.tsx',
  'apps/terminal/adapter/android/device/android/src/main/java/com/catering/v2s/terminal/adapter/android/device/TerminalDeviceModule.kt',
  'scripts/env/check-runtime-resource-budget',
  'scripts/test/ter-admin-display-web.mjs',
];
const sourceSha256 = createHash('sha256')
  .update(files.map(file => `${file}\0${fs.readFileSync(path.join(root, file))}`).join('\0'))
  .digest('hex');
const manifestPath = path.join(runRoot, 'run-manifest.json');
const logPath = path.join(runRoot, 'expo-web.log');
const screenshotPath = path.join(runRoot, 'admin-runtime.png');
const manifest = {
  runId,
  phase: 'PREFLIGHT',
  sourceSha256,
  sourceFiles: files,
  webUrl: (() => {
    const url = new URL(`http://127.0.0.1:${port}/?surfaceForm=${surfaceForm}`);
    if (failureOwner !== null) url.searchParams.set('terFailureOwner', failureOwner);
    return url.toString();
  })(),
  failureOwner,
  webScenario,
  surfaceForm,
  process: null,
  business: 'NOT_RUN',
  cleanup: 'NOT_RUN',
  firstFailure: null,
};
const save = () => fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
save();

let expo = null;
let browser = null;
let page = null;
const pageErrorNames = [];
const waitForLauncherGeometryAfter = async (filePath, byteOffset, targetRect, targetViewport, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const content = fs.readFileSync(filePath, 'utf8');
    const tail = content.slice(byteOffset);
    for (const line of tail.split('\n')) {
      if (!line.includes('"event": "admin.launcher-geometry-measured"')) continue;
      const viewport = line.match(/"windowDimensions":\s*\{([^}]*)\}/)?.[1];
      const rect = line.match(/"windowRect":\s*\{([^}]*)\}/)?.[1];
      const viewportWidth = Number(viewport?.match(/"width":\s*([\d.]+)/)?.[1]);
      const viewportHeight = Number(viewport?.match(/"height":\s*([\d.]+)/)?.[1]);
      const measuredWidth = Number(rect?.match(/"width":\s*([\d.]+)/)?.[1]);
      const measuredHeight = Number(rect?.match(/"height":\s*([\d.]+)/)?.[1]);
      if (
        viewportWidth === targetViewport.width &&
        viewportHeight === targetViewport.height &&
        Math.abs(measuredWidth - targetRect.width) <= 1 &&
        Math.abs(measuredHeight - targetRect.height) <= 1
      ) return line;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(
    `WEB_LAUNCHER_GEOMETRY_DID_NOT_MATCH_VISIBLE_PRIMARY:${targetViewport.width}x${targetViewport.height}:${targetRect.width}x${targetRect.height}`,
  );
};
const waitForLogEvent = async (filePath, event, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.readFileSync(filePath, 'utf8').includes(`"event": "${event}"`)) return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`WEB_EXPECTED_LOG_EVENT_MISSING:${event}`);
};
try {
  const budget = spawnSync(
    path.join(root, 'scripts/env/check-runtime-resource-budget'),
    ['--profile', 'ter-validation-with-dev', path.join(root, '.runtime')],
    {cwd: root, encoding: 'utf8'},
  );
  fs.writeFileSync(path.join(runRoot, 'resource-preflight.log'), `${budget.stdout ?? ''}${budget.stderr ?? ''}`, {
    mode: 0o600,
  });
  if (budget.status !== 0) throw new Error(`RESOURCE_PREFLIGHT_FAILED:${budget.status}`);

  const log = fs.createWriteStream(logPath, {flags: 'wx', mode: 0o600});
  expo = spawn('yarn', ['web', '--port', String(port), '--non-interactive'], {
    cwd: integrationRoot,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  expo.stdout.pipe(log);
  expo.stderr.pipe(log);
  const processTable = readProcessTable();
  const identity = processTable.find(process => process.pid === expo.pid);
  if (!identity) throw new Error('EXPO_PROCESS_IDENTITY_READBACK_FAILED');
  manifest.process = {
    pid: identity.pid,
    pgid: identity.pgid,
    startToken: identity.startToken,
    commandSha256: identity.commandSha256,
    logPath: path.relative(root, logPath),
  };
  manifest.phase = 'WEB_STARTING';
  save();

  let ready = false;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (expo.exitCode !== null) throw new Error(`EXPO_EXITED:${expo.exitCode}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('EXPO_WEB_READINESS_TIMEOUT');

  manifest.phase = 'WEB_SCENARIO';
  save();
  browser = await chromium.launch({headless: true});
  page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  page.on('pageerror', error => pageErrorNames.push(error.name || 'Error'));
  const initialGeometryLogOffset = fs.statSync(logPath).size;
  await page.goto(manifest.webUrl, {waitUntil: 'networkidle', timeout: 60_000});

  const launcher = page.getByTestId('terminal.admin:launcher');
  await launcher.waitFor({state: 'visible', timeout: 30_000});
  const bounds = await page.getByTestId(surfaceTestIdPrefix).boundingBox();
  if (bounds === null) throw new Error('ADMIN_LAUNCHER_BOUNDS_UNAVAILABLE');
  await waitForLauncherGeometryAfter(logPath, initialGeometryLogOffset, bounds, {width: 1440, height: 1000}, 10_000);
  if (
    webScenario === 'keyboard-member-journey' ||
    webScenario === 'keyboard-login' ||
    webScenario === 'keyboard-overlay-ownership' ||
    webScenario === 'textinput-contextmenu'
  ) {
    const correctIntegration =
      (webScenario === 'keyboard-member-journey' && integrationName === 'sample-console') ||
      (webScenario === 'keyboard-login' && integrationName === 'sample-wallpaper-console') ||
      (webScenario === 'keyboard-overlay-ownership' && integrationName === 'sample-console') ||
      webScenario === 'textinput-contextmenu';
    if (failureOwner !== null || !correctIntegration) {
      throw new Error('WEB_KEYBOARD_JOURNEY_SCOPE_INVALID');
    }
    const tapKey = async (keyId, testIDSuffix = '') => {
      await page.getByTestId(`ui.base.input:virtual-keyboard:${keyId}${testIDSuffix}`).click({timeout: 5_000});
    };
    const contextMenuObservations = [];
    const observeContextMenu = async testID => {
      const input = page.getByTestId(testID);
      await input.waitFor({state: 'visible', timeout: 10_000});
      for (const state of ['empty', 'existing-text']) {
        await input.fill(state === 'empty' ? '' : 'menu-probe');
        const defaultPrevented = await input.evaluate(element => {
          const event = new MouseEvent('contextmenu', {bubbles: true, cancelable: true, view: window});
          element.dispatchEvent(event);
          return event.defaultPrevented;
        });
        if (!defaultPrevented) throw new Error(`WEB_TEXTINPUT_CONTEXTMENU_NOT_PREVENTED:${testID}:${state}`);
        contextMenuObservations.push({testID, state, contextMenuPrevented: true});
      }
      await input.fill('');
    };
    if (webScenario === 'textinput-contextmenu') {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      await page.evaluate(() => navigator.clipboard.writeText('TER-REMEDIATION-CLIPBOARD'));
      await observeContextMenu('sample.auth.login:operator-name');
      await observeContextMenu('sample.auth.login:passcode');
    }
    const operatorName = page.getByTestId('sample.auth.login:operator-name');
    const passcode = page.getByTestId('sample.auth.login:passcode');
    if (webScenario !== 'keyboard-overlay-ownership') {
      await operatorName.click();
      await tapKey('shift');
      await tapKey('text-a');
      for (const digit of '001') await tapKey(`text-${digit}`);
      if ((await operatorName.inputValue()) !== 'A001') throw new Error('WEB_KEYBOARD_OPERATOR_NAME_MISMATCH');
      manifest.keyboardJourney = {loginName: 'PASS'};
      save();

      await passcode.click();
      for (const digit of '1111') await tapKey(`text-${digit}`);
      if ((await passcode.inputValue()) !== '1111') throw new Error('WEB_KEYBOARD_PASSCODE_ENTRY_MISMATCH');
      manifest.keyboardJourney.passcodeEntry = 'PASS';
      save();
      await page.getByTestId('sample.auth.login:submit').click();
    }
    if (webScenario === 'keyboard-login') {
      await page.getByTestId('sample.wallpaper.picker').waitFor({state: 'visible', timeout: 15_000});
      manifest.keyboardJourney.wallpaperPickerReached = 'PASS';
      manifest.webObserved = {...manifest.keyboardJourney};
      manifest.pageErrorNames = pageErrorNames;
      if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
      await page.screenshot({path: screenshotPath, fullPage: true});
      manifest.screenshotPath = path.relative(root, screenshotPath);
      manifest.business = 'PASS';
    } else if (
      webScenario === 'keyboard-member-journey' ||
      (webScenario === 'textinput-contextmenu' && integrationName === 'sample-console')
    ) {
      const addMember = page.getByTestId('sample.desk.member-list:empty-action');
      await addMember.waitFor({state: 'visible', timeout: 15_000});
      await addMember.click();

      if (webScenario === 'textinput-contextmenu') {
        for (const testID of [
          'sample.desk.member-form:name',
          'sample.desk.member-form:phone',
          'sample.desk.member-form:keyboard-alpha-probe',
          'sample.desk.member-form:keyboard-financial-probe',
        ]) await observeContextMenu(testID);

        if (integrationName === 'sample-console') {
          for (let index = 0; index < 5; index += 1) {
            await page.mouse.click(bounds.x + Math.min(24, bounds.width / 4), bounds.y + Math.min(24, bounds.height / 4));
          }
          await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
          const pin = (await page.getByTestId('terminal.admin:debug-password').innerText()).match(/\d{6}/)?.[0];
          if (pin === undefined) throw new Error('WEB_ADMIN_DEBUG_PASSWORD_READBACK_MISSING');
          for (const digit of pin) await tapKey(`text-${digit}`);
          await page.getByTestId('terminal.admin:verify').click();
          await page.getByTestId('terminal.admin:section:topology').click();
          await page.getByTestId('terminal.admin:topology:action:return-choice').click();
          await observeContextMenu('terminal.admin:topology:host');
        }
        manifest.webObserved = {
          clipboardPrecondition: 'NON_EMPTY',
          textInputCount: contextMenuObservations.length / 2,
          emptyAndExistingTextStates: contextMenuObservations.length,
          nonTextInputAdminPinSkipped: true,
          contextMenuPrevented: 'PASS',
          observationKind: 'RNW_CONTEXTMENU_EVENT',
        };
        manifest.pageErrorNames = pageErrorNames;
        if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
        await page.screenshot({path: screenshotPath, fullPage: true});
        manifest.screenshotPath = path.relative(root, screenshotPath);
        manifest.business = 'PASS';
      } else {

    const name = page.getByTestId('sample.desk.member-form:name');
    await name.waitFor({state: 'visible', timeout: 10_000});
    await name.click();
    await tapKey('text-x');
    const symbols = [':', '/', '.', '?', '&', '=', '-', '_', '%', '+'];
    for (const [index, symbol] of symbols.entries()) {
      const digit = '1234567890'[index];
      await tapKey('shift');
      const keyId = `ui.base.input:virtual-keyboard:text-${digit}`;
      const visibleLabel = await page.getByTestId(keyId).innerText();
      if (visibleLabel !== symbol) {
        throw new Error(`WEB_KEYBOARD_URL_SYMBOL_LABEL_MISMATCH:${index}:${JSON.stringify(visibleLabel)}`);
      }
      await tapKey(`text-${digit}`);
      if ((await name.inputValue()) !== `x${symbols.slice(0, index + 1).join('')}`) {
        throw new Error(`WEB_KEYBOARD_URL_SYMBOL_INSERTION_MISMATCH:${index}`);
      }
      manifest.keyboardJourney.urlSymbolsMatched = index + 1;
      save();
    }

    const alphaProbe = page.getByTestId('sample.desk.member-form:keyboard-alpha-probe');
    await alphaProbe.click();
    await tapKey('text-a');
    await tapKey('shift');
    await tapKey('text-b');
    await tapKey('space');
    await tapKey('text-c');
    if ((await alphaProbe.inputValue()) !== 'aB c') throw new Error('WEB_KEYBOARD_ALPHA_SHIFT_SPACE_MISMATCH');

    const financialProbe = page.getByTestId('sample.desk.member-form:keyboard-financial-probe');
    await financialProbe.click();
    await tapKey('text-1');
    await tapKey('text-.');
    await tapKey('text-2');
    if ((await financialProbe.inputValue()) !== '1.2') throw new Error('WEB_KEYBOARD_FINANCIAL_INSERTION_MISMATCH');
    for (let index = 0; index < 3; index += 1) await tapKey('backspace');
    for (const keyId of ['text--', 'text-1', 'text-.', 'text-2']) await tapKey(keyId);
    if ((await financialProbe.inputValue()) !== '-1.2') throw new Error('WEB_KEYBOARD_FINANCIAL_SIGN_MISMATCH');

    manifest.webObserved = {
      loginViaVirtualKeys: 'PASS',
      urlSymbolCount: symbols.length,
      urlSymbolLabelMatchesInsertedValues: 'PASS',
      alphaShiftAndSpaceInsertion: 'PASS',
      financialAsciiInsertion: 'PASS',
    };
    manifest.pageErrorNames = pageErrorNames;
    if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
    await page.screenshot({path: screenshotPath, fullPage: true});
    manifest.screenshotPath = path.relative(root, screenshotPath);
    manifest.business = 'PASS';
      }
    } else if (webScenario === 'textinput-contextmenu') {
      await page.getByTestId('sample.wallpaper.picker').waitFor({state: 'visible', timeout: 15_000});
      for (let index = 0; index < 5; index += 1) {
        await page.mouse.click(bounds.x + Math.min(24, bounds.width / 4), bounds.y + Math.min(24, bounds.height / 4));
      }
      await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
      const pin = (await page.getByTestId('terminal.admin:debug-password').innerText()).match(/\d{6}/)?.[0];
      if (pin === undefined) throw new Error('WEB_ADMIN_DEBUG_PASSWORD_READBACK_MISSING');
      for (const digit of pin) await tapKey(`text-${digit}`);
      await page.getByTestId('terminal.admin:verify').click();
      await page.getByTestId('terminal.admin:section:topology').click();
      await page.getByTestId('terminal.admin:topology:action:return-choice').click();
      await observeContextMenu('terminal.admin:topology:host');
      manifest.webObserved = {
        clipboardPrecondition: 'NON_EMPTY',
        textInputCount: contextMenuObservations.length / 2,
        emptyAndExistingTextStates: contextMenuObservations.length,
        nonTextInputAdminPinSkipped: true,
        contextMenuPrevented: 'PASS',
        observationKind: 'RNW_CONTEXTMENU_EVENT',
      };
      manifest.pageErrorNames = pageErrorNames;
      if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
      await page.screenshot({path: screenshotPath, fullPage: true});
      manifest.screenshotPath = path.relative(root, screenshotPath);
      manifest.business = 'PASS';
    } else if (webScenario === 'keyboard-overlay-ownership') {
      await page.getByTestId(`${integrationName}:test-expo:surface-mode:single`).click();
      await page.waitForFunction(
        () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))),
      );
      const launcherBounds = await page.getByTestId(surfaceTestIdPrefix).boundingBox();
      if (launcherBounds === null) throw new Error('WEB_OVERLAY_SINGLE_SURFACE_BOUNDS_UNAVAILABLE');
      const coveredOperator = page.getByTestId('sample.auth.login:operator-name');
      const coveredPasscode = page.getByTestId('sample.auth.login:passcode');
      const typeStaffLogin = async () => {
        const operatorName = page.getByTestId('sample.auth.login:operator-name');
        await operatorName.click();
        await tapKey('shift');
        await tapKey('text-a');
        for (const digit of '001') await tapKey(`text-${digit}`);
        const passcode = page.getByTestId('sample.auth.login:passcode');
        await passcode.click();
        for (const digit of '1111') await tapKey(`text-${digit}`);
        if ((await operatorName.inputValue()) !== 'A001' || (await passcode.inputValue()) !== '1111') {
          throw new Error('WEB_OVERLAY_PRECONDITION_STAFF_FIELDS_MISMATCH');
        }
      };
      await typeStaffLogin();
      for (let index = 0; index < 5; index += 1) {
        await page.mouse.click(
          launcherBounds.x + Math.min(24, launcherBounds.width / 4),
          launcherBounds.y + Math.min(24, launcherBounds.height / 4),
        );
      }
      await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
      const pin = (await page.getByTestId('terminal.admin:debug-password').innerText()).match(/\d{6}/)?.[0];
      if (pin === undefined) throw new Error('WEB_ADMIN_DEBUG_PASSWORD_READBACK_MISSING');
      for (const digit of pin) await tapKey(`text-${digit}`);
      await page.getByTestId('terminal.admin:verify').click();

      for (const input of [coveredOperator, coveredPasscode]) {
        const box = await input.boundingBox();
        if (box === null) throw new Error('WEB_OVERLAY_COVERED_INPUT_BOUNDS_UNAVAILABLE');
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        await page.keyboard.type('Z');
        await page.keyboard.press('Tab');
        await page.keyboard.type('SCAN');
        await page.keyboard.press('Enter');
      }
      if ((await coveredOperator.inputValue()) !== 'A001' || (await coveredPasscode.inputValue()) !== '1111') {
        throw new Error('WEB_OVERLAY_COVERED_STAFF_FIELD_ACCEPTED_WRITE');
      }

      await page.getByTestId('terminal.admin:section:topology').click();
      await page.getByTestId('terminal.admin:topology:action:return-choice').click();
      const hostInput = page.getByTestId('terminal.admin:topology:host');
      await hostInput.click();
      for (const key of ['text-1', 'text-9', 'text-2', 'text-.', 'text-0', 'text-.', 'text-2', 'text-.', 'text-1']) {
        await tapKey(key);
      }
      if ((await hostInput.inputValue()) !== '192.0.2.1') throw new Error('WEB_OVERLAY_POSITIVE_CONTROL_NOT_WRITABLE');
      const closeAdmin = page.getByTestId('terminal.admin:close');
      await closeAdmin.focus();
      await closeAdmin.press('Enter');
      await page.getByTestId('terminal.admin:shell').waitFor({state: 'hidden', timeout: 5_000});
      await page.locator('[data-testid^="ui.base.input:virtual-keyboard:"]').first().waitFor({
        state: 'hidden',
        timeout: 2_000,
      });
      if ((await coveredOperator.inputValue()) !== 'A001' || (await coveredPasscode.inputValue()) !== '1111') {
        throw new Error('WEB_OVERLAY_CLOSE_CHANGED_COVERED_VALUES');
      }
      const keyboardKeys = page.locator('[data-testid^="ui.base.input:virtual-keyboard:"]');
      if (await keyboardKeys.count() > 0 && await keyboardKeys.first().isVisible()) {
        throw new Error('WEB_OVERLAY_CLOSE_LEFT_KEYBOARD_VISIBLE');
      }
      await coveredOperator.click();
      await tapKey('text-z');
      if ((await coveredOperator.inputValue()) !== 'A001z') throw new Error('WEB_OVERLAY_CLOSED_FIELD_NOT_REACTIVATED');
      manifest.webObserved = {
        coveredStaffFieldsUnchangedAfterPointerKeyboardTabAndScannerSuffix: 'PASS',
        topologyHostAddressPositiveControl: 'PASS',
        closeClearedVirtualKeyboard: 'PASS',
        explicitRefocusRestoredEntry: 'PASS',
      };
      manifest.pageErrorNames = pageErrorNames;
      if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
      await page.screenshot({path: screenshotPath, fullPage: true});
      manifest.screenshotPath = path.relative(root, screenshotPath);
      manifest.business = 'PASS';
    }
  } else if (failureOwner !== null) {
    const failureNotice = page.getByTestId(`ui-base-render:system-failure:${failureOwner}`);
    const dismissButton = page.getByTestId(`ui-base-render:system-failure:${failureOwner}:dismiss`);
    await failureNotice.waitFor({state: 'visible', timeout: 10_000});
    if (failureOwner === 'screen:main:sample.auth.login') {
      const readinessLog = fs.readFileSync(logPath, 'utf8');
      const startupComplete = readinessLog.split('\n').find(line =>
        line.includes('"event": "startup.complete"') &&
        line.includes('"primaryContentFailure": "render-error"') &&
        line.includes('"primaryRealReady": false'),
      );
      const loadingReleased = readinessLog.split('\n').some(line =>
        line.includes('"event": "startup.ready-hidden"') &&
        line.includes('"contentFailure": "render-error"'),
      );
      if (startupComplete === undefined || !loadingReleased) {
        throw new Error('WEB_STARTUP_CONTENT_FAILURE_READINESS_MISMATCH');
      }
      manifest.startupContentFailure = 'PASS';
      manifest.startupLoadingReleasedWithoutRealReady = 'PASS';
    }
    if (await page.getByText('知道了', {exact: true}).count() !== 1) {
      throw new Error('WEB_SYSTEM_FAILURE_NOTICE_BUTTON_COUNT_MISMATCH');
    }
    await dismissButton.click();
    await waitForLogEvent(logPath, 'runtime.system-failure.reset-unavailable', 10_000);
    await failureNotice.waitFor({state: 'visible', timeout: 5_000});
    for (let index = 0; index < 5; index += 1) {
      await page.mouse.click(bounds.x + Math.min(24, bounds.width / 4), bounds.y + Math.min(24, bounds.height / 4));
    }
    await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
    await failureNotice.waitFor({state: 'visible', timeout: 5_000});
    if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);
    manifest.failureNoticeStayedVisible = 'PASS';
    manifest.adminLauncherRemainedUsable = 'PASS';
    manifest.webObserved = {failureOwner, resetUnavailableLogged: true};
    manifest.pageErrorNames = pageErrorNames;
    await page.screenshot({path: screenshotPath, fullPage: true});
    manifest.screenshotPath = path.relative(root, screenshotPath);
    manifest.business = 'PASS';
  } else {
    for (let index = 0; index < 5; index += 1) {
      await page.mouse.click(bounds.x + Math.min(24, bounds.width / 4), bounds.y + Math.min(24, bounds.height / 4));
    }

    await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
    const passwordText = await page.getByTestId('terminal.admin:debug-password').innerText();
    const digits = passwordText.match(/\d{6}/)?.[0];
    if (digits === undefined) throw new Error('ADMIN_DEBUG_PASSWORD_READBACK_MISSING');
    for (const digit of digits) await page.getByTestId(`ui.base.input:virtual-keyboard:text-${digit}`).click();
    await page.getByTestId('terminal.admin:verify').click();
    await page.getByTestId('terminal.admin:section:runtime').click();

    const primaryWidth = page.getByTestId('terminal.admin:runtime:surface-map:surface:PRIMARY:logic-width');
    const primaryHeight = page.getByTestId('terminal.admin:runtime:surface-map:surface:PRIMARY:logic-height');
    await primaryWidth.waitFor({state: 'visible', timeout: 15_000});
    const observed = {
      primaryLogicalWidth: await primaryWidth.innerText(),
      primaryLogicalHeight: await primaryHeight.innerText(),
      primaryReadiness: await page.getByTestId('terminal.admin:runtime:surface-map:surface:PRIMARY:inside:0').innerText(),
      deviceDisplayAreaLabelCount: await page.getByText(/设备显示区域：/).count(),
      secondaryCardCount: await page.getByTestId('terminal.admin:runtime:surface-map:surface:SECONDARY:card').count(),
    };
    if (
      observed.primaryLogicalWidth !== `逻辑分辨率宽：${expectedPrimaryLogicalSize.width}` ||
      observed.primaryLogicalHeight !== `逻辑分辨率高：${expectedPrimaryLogicalSize.height}`
    ) {
      throw new Error(`WEB_PRIMARY_LOGICAL_RESOLUTION_MISMATCH:${JSON.stringify(observed)}`);
    }
    if (observed.primaryReadiness !== '已就绪' || observed.deviceDisplayAreaLabelCount !== 0) {
      throw new Error(`WEB_RUNTIME_DISPLAY_AREA_LABEL_PRESENT_OR_READINESS_MISSING:${JSON.stringify(observed)}`);
    }
    if (observed.secondaryCardCount !== 0) throw new Error('WEB_SECONDARY_ADAPTER_FACTS_UNEXPECTEDLY_PRESENT');
    if (pageErrorNames.length) throw new Error(`WEB_PAGE_ERRORS:${JSON.stringify(pageErrorNames)}`);

    await page.getByTestId('terminal.admin:close').click();
    // Authentication hides the login form while the admin layer remains mounted.
    // Wait for the actual layer owner to unmount before sending a new launcher gesture.
    await page.getByTestId('terminal.admin:shell').waitFor({state: 'hidden', timeout: 10_000});
    const geometryLogOffset = fs.statSync(logPath).size;
    await page.setViewportSize({width: 1180, height: 760});
    await page.waitForFunction(
      () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true)))),
    );
    const resizedBounds = await page.getByTestId(surfaceTestIdPrefix).boundingBox();
    if (resizedBounds === null) throw new Error('ADMIN_LAUNCHER_RESIZED_BOUNDS_UNAVAILABLE');
    await waitForLauncherGeometryAfter(
      logPath,
      geometryLogOffset,
      resizedBounds,
      {width: 1180, height: 760},
      10_000,
    );
    for (let index = 0; index < 5; index += 1) {
      await page.mouse.click(
        resizedBounds.x + Math.min(24, resizedBounds.width / 4),
        resizedBounds.y + Math.min(24, resizedBounds.height / 4),
      );
    }
    await page.getByTestId('terminal.admin:login').waitFor({state: 'visible', timeout: 10_000});
    const resizedOpenRequests = fs.readFileSync(logPath, 'utf8').slice(geometryLogOffset)
      .split('\n')
      .filter(line => line.includes('"event": "admin.launcher-open-requested"')).length;
    if (resizedOpenRequests !== 1) throw new Error(`WEB_RESIZED_LAUNCHER_OPEN_COUNT:${resizedOpenRequests}`);
    manifest.geometryAfterViewportResize = 'PASS';
    await page.screenshot({path: screenshotPath, fullPage: true});
    manifest.webObserved = observed;
    manifest.screenshotPath = path.relative(root, screenshotPath);
    manifest.pageErrorNames = pageErrorNames;
    manifest.business = 'PASS';
  }
} catch (error) {
  manifest.firstFailure = error instanceof Error ? error.message : String(error);
  manifest.business = 'FAIL';
  if (page !== null) {
    try {
      await page.screenshot({path: screenshotPath, fullPage: true});
      manifest.screenshotPath = path.relative(root, screenshotPath);
    } catch (screenshotError) {
      manifest.failureScreenshotError = screenshotError instanceof Error ? screenshotError.name : 'UnknownError';
    }
    try {
      manifest.pageDiagnostics = await page.locator('[data-testid]').evaluateAll(elements => elements.map(element => ({
        testID: element.getAttribute('data-testid'),
        tagName: element.tagName,
        visible: element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden',
      })));
    } catch (diagnosticError) {
      manifest.pageDiagnosticsFailure = diagnosticError instanceof Error ? diagnosticError.name : 'UnknownError';
    }
    manifest.pageErrorNames = pageErrorNames;
  }
} finally {
  await browser?.close().catch(() => {});
  if (expo !== null) {
    const result = await terminateOwnedProcessTree({
      pid: expo.pid,
      pgid: expo.pid,
      startToken: manifest.process?.startToken ?? '',
    });
    const remaining = snapshotProcessTree({
      pid: expo.pid,
      pgid: expo.pid,
      startToken: manifest.process?.startToken ?? '',
    });
    manifest.cleanup = result.status === 'PASS' && remaining.length === 0 ? 'PASS' : 'FAIL';
    manifest.cleanupReadback = remaining;
  } else manifest.cleanup = 'NOT_APPLICABLE';
  manifest.phase = 'COMPLETE';
  save();
}

process.stdout.write(
  `TER_ADMIN_DISPLAY_WEB business=${manifest.business} cleanup=${manifest.cleanup} runId=${runId} sourceSha256=${sourceSha256}\n`,
);
if (manifest.business !== 'PASS' || manifest.cleanup !== 'PASS') {
  process.stderr.write(`TER_ADMIN_DISPLAY_WEB_FAILURE=${manifest.firstFailure ?? 'CLEANUP_FAILED'}\n`);
  process.exitCode = 1;
}
