import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import * as runner from './ter-virtual-keyboard-android.mjs';
import {terminalBusinessMemberFixture} from './terminal-business-fixtures.mjs';
import {
  activationFixtureActionLabel,
  activationFixtureInputEvidence,
  activationInputBoundaryReadback,
  terminalBusinessInputValue,
  terminalBusinessInputKeyPlan,
  terminalBusinessInputNeedsShiftToggle,
  terminalBusinessInputReadback,
  terminalBusinessInputEntryDecision,
  terminalBusinessMemberReadback,
  terminalBusinessScreenAssertion,
  terminalBusinessScreenWaitMatched,
  summarizeTerminalBusinessScreenDiagnostic,
  terminalBusinessTextAssertion,
  terminalActivationInputReadiness,
  projectTerminalBusinessLogcatEvents,
  resolveTerminalBusinessLogWindow,
  correlateAndroidTerminalBackendLogEvents,
  terminalBusinessEvidenceFailureCodes,
  summarizeTerminalBusinessLogcatDiagnostics,
  terminalTdsNodeEvidenceId,
  terminalBindingReadbackMatches,
  terminalBindingIdentityReadbackMatches,
  terminalBindingFixtureCandidates,
  TERMINAL_BUSINESS_SCREENS,
  resolveManagedCommandTimeoutMs,
  resolveManagedCommandMaxBytes,
  validateTerminalEmulatorPair,
  emptyFrameMatrix,
  captureObservationMatrix,
  classifyFrameRoute,
  iaControlRoster,
  perControlVisualAuditRows,
  parseArgs,
  assertRunAllowsAction,
  debugFailureInjectionIntentArgs,
  debugFailureInjectionRuntimeIntentArgs,
  summarizeDebugFailureInjectionLogcat,
  debugNativeLoadingDelayIntentArgs,
  parseAndroidProcessTable,
  parseLogicalDisplays,
  parseResourceNode,
  chooseDifferentWallpaperOption,
  activationSubmitReadiness,
  parseResourceContentDescriptionHash,
  parseHarnessTextHash,
  parseVisibleControlInventory,
  sameResourceNodeBounds,
  URL_SYMBOL_KEYS,
  URL_SYMBOL_SEQUENCE,
  adminLauncherTapPlan,
  parseDumpsysDisplayFacts,
  parseDisplayWindowIdentity,
  parsePngFileDescription,
  parseSurfaceDisplays,
  resolveCaptureDisplayInventory,
  summarizePersistKvW10,
  validateA11BaselineManifest,
  validateA11W10Action,
  validateDeviceShape,
  w7ClearInputArgs,
  w7ClipboardKeyArgs,
  w7ProbeKeyIds,
  w7ProbeTapPlan,
  w7LongPressArgs,
  parseTextInputContextMenu,
} from './ter-virtual-keyboard-android.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const IA_IDS = [
  'VK-IA-01',
  'VK-IA-02',
  'VK-IA-03',
  'VK-IA-04',
  'VK-IA-05',
  'VK-IA-06',
  'VK-IA-07',
  'VK-IA-08',
  'VK-IA-09',
  'VK-IA-10',
  'VK-IA-11',
  'VK-IA-12',
  'VK-IA-13',
  'VK-IA-14',
  'VK-IA-15',
  'VK-IA-16',
  'VK-IA-17',
  'VK-IA-18',
  'VK-IA-19',
];

test('activation fixture input evidence never persists or labels the activation digits', () => {
  const activationCode = '70123456';
  const evidence = activationFixtureInputEvidence({
    fixtureKey: 'term-front',
    expectedCode: activationCode,
    observedValue: activationCode,
  });
  assert.deepEqual(evidence, {
    fixtureKey: 'term-front',
    expectedDigitCount: 8,
    observedDigitCount: 8,
    matched: true,
  });
  assert.equal(JSON.stringify(evidence).includes(activationCode), false);
  assert.equal(activationFixtureActionLabel('dual', 'fixture', 3), 'dual-activation-fixture-03');
  assert.equal(activationFixtureActionLabel('mobile', 'leading-zero', 1), 'mobile-activation-leading-zero-01');
  assert.throws(
    () => activationFixtureActionLabel('dual', 'fixture', 17),
    /VK_ANDROID_ACTIVATION_ACTION_ORDINAL_INVALID/,
  );
  const mismatch = activationFixtureInputEvidence({
    fixtureKey: 'term-front',
    expectedCode: activationCode,
    observedValue: '7012',
  });
  assert.deepEqual(mismatch, {
    fixtureKey: 'term-front',
    expectedDigitCount: 8,
    observedDigitCount: 4,
    matched: false,
  });
  assert.equal(JSON.stringify(mismatch).includes(activationCode), false);
  const leadingZeroMismatch = activationInputBoundaryReadback({
    expectedValue: '01234567',
    observedValue: '1234567',
  });
  assert.deepEqual(leadingZeroMismatch, {
    expectedDigitCount: 8,
    observedDigitCount: 7,
    leadingZeroPreserved: false,
    exactMatch: false,
    valueRedacted: true,
  });
  assert.equal(JSON.stringify(leadingZeroMismatch).includes('01234567'), false);
  assert.equal(JSON.stringify(leadingZeroMismatch).includes('1234567'), false);
});

test('activation input readiness requires an enabled field and settled interactive virtual keyboard', () => {
  const focusedFalseXml =
    '<hierarchy><display id="0"><node resource-id="terminal.activation.code" text="" enabled="true" focused="false" bounds="[1,2][9,10]"/><node resource-id="ui.base.input:virtual-keyboard" enabled="true" bounds="[0,20][20,40]"/></display></hierarchy>';
  assert.deepEqual(terminalActivationInputReadiness(focusedFalseXml, 0), {
    fieldVisible: true,
    fieldEnabled: true,
    nativeFocusReported: false,
    keyboardVisible: true,
    keyboardInteractive: false,
    keyboardHitShieldPresent: false,
    blockingAdminOverlayPresent: false,
    focusVisibilityFailure: null,
    ready: false,
  });
  const focusedSettledXml =
    '<hierarchy><display id="0"><node resource-id="terminal.activation.code" text="" enabled="true" focused="true" bounds="[1,2][9,10]"/><node resource-id="ui.base.input:virtual-keyboard" enabled="true" bounds="[0,20][20,40]"/><node resource-id="ui.base.input:keyboard-layer:interactive" enabled="true" bounds="[0,20][20,40]"/></display></hierarchy>';
  assert.deepEqual(terminalActivationInputReadiness(focusedSettledXml, 0), {
    fieldVisible: true,
    fieldEnabled: true,
    nativeFocusReported: true,
    keyboardVisible: true,
    keyboardInteractive: true,
    keyboardHitShieldPresent: false,
    blockingAdminOverlayPresent: false,
    focusVisibilityFailure: null,
    ready: true,
  });
  const blockedByPersistedAdminLayer = focusedSettledXml.replace(
    '</display>',
    '<node resource-id="terminal.admin:login" enabled="true" bounds="[0,0][20,20]"/></display>',
  );
  assert.deepEqual(terminalActivationInputReadiness(blockedByPersistedAdminLayer, 0), {
    fieldVisible: true,
    fieldEnabled: true,
    nativeFocusReported: true,
    keyboardVisible: true,
    keyboardInteractive: true,
    keyboardHitShieldPresent: false,
    blockingAdminOverlayPresent: true,
    focusVisibilityFailure: null,
    ready: false,
  });
  const focusWithoutKeyboardSettlement =
    '<hierarchy><display id="0"><node resource-id="terminal.activation.code" text="" enabled="true" focused="true" bounds="[1,2][9,10]"/><node resource-id="ui.base.input:virtual-keyboard" enabled="true" bounds="[0,20][20,40]"/><node resource-id="ui.base.input:keyboard-hit-shield" enabled="true" bounds="[0,20][20,40]"/></display></hierarchy>';
  assert.deepEqual(terminalActivationInputReadiness(focusWithoutKeyboardSettlement, 0), {
    fieldVisible: true,
    fieldEnabled: true,
    nativeFocusReported: true,
    keyboardVisible: true,
    keyboardInteractive: false,
    keyboardHitShieldPresent: true,
    blockingAdminOverlayPresent: false,
    focusVisibilityFailure: null,
    ready: false,
  });
  const visiblePendingWithFailure =
    '<hierarchy><display id="0"><node resource-id="terminal.activation.code" text="" enabled="true" focused="false" bounds="[1,2][9,10]"/><node resource-id="ui.base.input:virtual-keyboard" enabled="true" bounds="[0,20][20,40]"/><node resource-id="ui.base.input:focus-visibility-error:scroll-range-insufficient" text="焦点框无法完整显示，请调整窗口尺寸或退出输入" enabled="true" bounds="[0,0][20,5]"/></display></hierarchy>';
  assert.deepEqual(terminalActivationInputReadiness(visiblePendingWithFailure, 0), {
    fieldVisible: true,
    fieldEnabled: true,
    nativeFocusReported: false,
    keyboardVisible: true,
    keyboardInteractive: false,
    keyboardHitShieldPresent: false,
    blockingAdminOverlayPresent: false,
    focusVisibilityFailure: 'ui.base.input:focus-visibility-error:scroll-range-insufficient',
    ready: false,
  });
  const noKeyboardXml =
    '<hierarchy><display id="0"><node resource-id="terminal.activation.code" text="" enabled="true" focused="false" bounds="[1,2][9,10]"/></display></hierarchy>';
  assert.deepEqual(terminalActivationInputReadiness(noKeyboardXml, 0), {
    fieldVisible: true,
    fieldEnabled: true,
    nativeFocusReported: false,
    keyboardVisible: false,
    keyboardInteractive: false,
    keyboardHitShieldPresent: false,
    blockingAdminOverlayPresent: false,
    focusVisibilityFailure: null,
    ready: false,
  });
  const disabledFieldXml =
    '<hierarchy><display id="0"><node resource-id="terminal.activation.code" text="" enabled="false" focused="false" bounds="[1,2][9,10]"/><node resource-id="ui.base.input:virtual-keyboard" enabled="true" bounds="[0,20][20,40]"/></display></hierarchy>';
  assert.deepEqual(terminalActivationInputReadiness(disabledFieldXml, 0), {
    fieldVisible: true,
    fieldEnabled: false,
    nativeFocusReported: false,
    keyboardVisible: true,
    keyboardInteractive: false,
    keyboardHitShieldPresent: false,
    blockingAdminOverlayPresent: false,
    focusVisibilityFailure: null,
    ready: false,
  });
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const activationInput = source.slice(
    source.indexOf('async function clearActivationCodeInput('),
    source.indexOf('async function enterActivationDigits('),
  );
  const activationFixtureInput = source.slice(
    source.indexOf('async function runActivationFixtureInput('),
    source.indexOf('async function seedW7Clipboard('),
  );
  assert.match(activationInput, /terminalActivationInputReadiness/);
  assert.match(activationInput, /SETTLED_INTERACTIVE_VIRTUAL_KEYBOARD/);
  assert.doesNotMatch(activationInput, /VK_ANDROID_ACTIVATION_INPUT_NOT_FOCUSED/);
  assert.match(activationInput, /ACTIVATION_INPUT_READINESS_OBSERVED/);
  assert.match(
    activationInput,
    /await tapResource\(manifest, shape, TERMINAL_ACTIVATION_INPUT_ID\);\s*let readinessAttempts = 0;\s*for \(let attempt = 1; attempt <= 8; attempt \+= 1\)/,
  );
  assert.match(activationFixtureInput, /activationInputBoundaryReadback\(/);
  assert.match(activationFixtureInput, /ACTIVATION_BOUNDARY_READBACK/);
  assert.match(activationFixtureInput, /ACTIVATION_BLOCKING_ADMIN_OVERLAY_DISMISSED/);
  assert.match(activationFixtureInput, /VK_ANDROID_ACTIVATION_BLOCKING_ADMIN_OVERLAY_DID_NOT_CLOSE/);
  const digitEntry = source.slice(
    source.indexOf('async function enterActivationDigits('),
    source.indexOf('async function runActivationFixtureInput('),
  );
  assert.match(digitEntry, /ACTIVATION_DIGITS_READBACK/);
  assert.match(digitEntry, /tapResourceFromSnapshot/);
  assert.doesNotMatch(digitEntry, /ACTIVATION_DIGIT_READBACK/);
  assert.match(digitEntry, /valueRedacted: true/);
  assert.match(digitEntry, /VK_ANDROID_ACTIVATION_KEY_READBACK_MISMATCH/);
  const keyDispatchLoop = digitEntry.slice(
    digitEntry.indexOf('for (let index = 0;'),
    digitEntry.indexOf('const {xml: resultXml}'),
  );
  assert.doesNotMatch(keyDispatchLoop, /uiDump\(/);
});

test('android form key entry reuses one observed keyboard layout and verifies final value', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const formInput = source.slice(
    source.indexOf('async function enterTerminalBusinessInput('),
    source.indexOf('async function assertTerminalBusinessText('),
  );
  assert.match(formInput, /tapResourceFromSnapshot/);
  assert.match(formInput, /VK_ANDROID_BUSINESS_INPUT_SHIFT_STATE_MISMATCH/);
  assert.match(formInput, /terminalBusinessInputNeedsShiftToggle\(key, shiftSelected\)/);
  assert.match(formInput, /\/\/ The input owner consumes one-shot Shift[\s\S]*shiftSelected = false;/);
  assert.match(formInput, /terminalBusinessInputReadback\(/);
  assert.match(formInput, /terminalBusinessInputEntryDecision\(/);
  assert.match(formInput, /USE_REMEMBERED_MATCH/);
  assert.match(formInput, /ui\.base\.input:virtual-keyboard:complete/);
  assert.match(formInput, /VK_ANDROID_BUSINESS_INPUT_KEYBOARD_DID_NOT_CLOSE/);
  assert.match(formInput, /input\.nextResourceId/);
  assert.match(formInput, /VK_ANDROID_BUSINESS_INPUT_NEXT_FIELD_NOT_FOCUSED/);
  const inputContract = source.slice(
    source.indexOf('const TERMINAL_BUSINESS_INPUTS'),
    source.indexOf('const TERMINAL_BUSINESS_TEXT'),
  );
  assert.match(
    inputContract,
    /'member-name':[\s\S]*?resourceId: 'sample\.desk\.member-form:name',[\s\S]*?nextResourceId: 'sample\.desk\.member-form:phone'/,
  );
  assert.match(
    inputContract,
    /'member-phone':[\s\S]*?resourceId: 'sample\.desk\.member-form:phone',[\s\S]*?nextResourceId: 'sample\.desk\.member-form:keyboard-alpha-probe'/,
  );
  assert.match(formInput, /keyboardDismissed/);
  const keyLoopStart = formInput.indexOf('for (let index = 0; index < keyPlan.length;');
  const keyLoopEnd = formInput.indexOf(
    '\n    }\n    ({xml} = await uiDump(manifest, device, display.id));',
    keyLoopStart,
  );
  const keyDispatchLoop = formInput.slice(keyLoopStart, keyLoopEnd);
  assert.ok(keyDispatchLoop.length > 0);
  assert.ok(
    (keyDispatchLoop.match(/uiDump\(/g) ?? []).length <= 2,
    'only a shift-state transition may refresh the key layout',
  );
  const clearActivation = source.slice(
    source.indexOf('async function clearActivationCodeInput('),
    source.indexOf('async function enterActivationDigits('),
  );
  assert.match(clearActivation, /tapResourceFromSnapshot/);
  assert.match(clearActivation, /VK_ANDROID_ACTIVATION_INPUT_CLEAR_FAILED/);
});

test('managed business input recovery clears only run-owned member form fields and verifies empty readback', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const clearInput = source.slice(
    source.indexOf('async function clearTerminalBusinessInput('),
    source.indexOf('async function assertTerminalBusinessText('),
  );
  assert.match(
    clearInput,
    /appName !== 'sample-terminal' \|\| !\['member-name', 'member-phone'\]\.includes\(valueKey\)/,
  );
  assert.match(clearInput, /w7ClearInputArgs\(display\.id\)/);
  assert.match(clearInput, /VK_ANDROID_BUSINESS_INPUT_CLEAR_READBACK_MISMATCH/);
  assert.match(clearInput, /characterCountCleared: beforeValue\.length/);
  assert.doesNotMatch(clearInput, /beforeValue[,}]/);
  assert.match(source.slice(source.indexOf('async function dispatch(')), /action === 'clear-business-input'/);
});

test('business input models one-shot Shift without toggling it back from a stale UI snapshot', () => {
  const keys = terminalBusinessInputKeyPlan('A001');
  let shiftSelected = false;
  const shiftToggles = [];
  for (const [index, key] of keys.entries()) {
    if (terminalBusinessInputNeedsShiftToggle(key, shiftSelected)) {
      shiftSelected = key.uppercase;
      shiftToggles.push(index);
    }
    // The keyboard owner clears Shift as soon as a character is inserted.
    shiftSelected = false;
  }
  assert.deepEqual(shiftToggles, [0]);
  assert.equal(shiftSelected, false);
});

test('terminal business input uses fixed synthetic probes and returns only redacted key plans', () => {
  const runId = 'ter-pair-topology-01';
  const memberName = terminalBusinessInputValue(runId, 'member-name');
  const memberPhone = terminalBusinessInputValue(runId, 'member-phone');
  assert.match(memberName, /^ter[a-f0-9]{10}$/u);
  assert.match(memberPhone, /^010\d{8}$/u);
  assert.deepEqual({name: memberName, phone: memberPhone}, terminalBusinessMemberFixture(runId));
  assert.notEqual(memberPhone, terminalBusinessInputValue('ter-pair-topology-02', 'member-phone'));
  assert.throws(() => terminalBusinessMemberFixture('../outside'), /TERMINAL_BUSINESS_FIXTURE_RUN_ID_INVALID/u);
  assert.deepEqual(terminalBusinessInputKeyPlan('A01'), [
    {keyId: 'text-a', uppercase: true},
    {keyId: 'text-0', uppercase: false},
    {keyId: 'text-1', uppercase: false},
  ]);
  assert.deepEqual(
    terminalBusinessInputKeyPlan('Ter Guest').map(value => value.keyId),
    ['text-t', 'text-e', 'text-r', 'space', 'text-g', 'text-u', 'text-e', 'text-s', 'text-t'],
  );
  assert.equal(JSON.stringify(terminalBusinessInputKeyPlan(memberName)).includes(memberName), false);
  assert.equal(JSON.stringify(terminalBusinessInputKeyPlan(memberPhone)).includes(memberPhone), false);
  assert.deepEqual(terminalBusinessInputReadback('member-name', memberName, memberName), {
    valueKey: 'member-name',
    resourceId: 'sample.desk.member-form:name',
    characterCount: memberName.length,
    verification: 'FIELD_READBACK',
    matched: true,
  });
  assert.deepEqual(terminalBusinessInputReadback('staff-passcode', '1111', '••••'), {
    valueKey: 'staff-passcode',
    resourceId: 'sample.auth.login:passcode',
    characterCount: 4,
    verification: 'OWNER_OUTCOME_REQUIRED',
    matched: null,
  });
  assert.deepEqual(terminalBusinessInputEntryDecision('staff-name', 'A001', ''), {action: 'TYPE'});
  assert.deepEqual(terminalBusinessInputEntryDecision('staff-name', 'A001', 'A001'), {action: 'USE_REMEMBERED_MATCH'});
  assert.equal(
    JSON.stringify(terminalBusinessInputEntryDecision('staff-name', 'A001', 'A001')).includes('A001'),
    false,
  );
  assert.throws(
    () => terminalBusinessInputEntryDecision('staff-name', 'A001', 'OTHER'),
    /VK_ANDROID_BUSINESS_INPUT_PREFILLED_VALUE_MISMATCH/u,
  );
  assert.throws(
    () => terminalBusinessInputEntryDecision('staff-passcode', '1111', '1111'),
    /VK_ANDROID_BUSINESS_INPUT_PREFILLED_VALUE_MISMATCH/u,
  );
  assert.throws(
    () => terminalBusinessInputReadback('unknown', 'value', 'value'),
    /VK_ANDROID_BUSINESS_INPUT_KEY_INVALID/,
  );
  assert.throws(() => terminalBusinessInputValue(runId, 'arbitrary-input'), /VK_ANDROID_BUSINESS_INPUT_KEY_INVALID/);
  assert.throws(() => terminalBusinessInputKeyPlan('private value!'), /VK_ANDROID_BUSINESS_INPUT_VALUE_INVALID/);
});

test('terminal business visible-text oracle compares in memory and returns no UI text', () => {
  const visible =
    '<hierarchy><display id="0"><node resource-id="terminal.activation.admin:connection" text="连接状态：已连接" bounds="[1,2][9,10]"/></display></hierarchy>';
  const hidden =
    '<hierarchy><display id="0"><node resource-id="terminal.activation.admin:connection" text="连接状态：连接中" bounds="[1,2][9,10]"/></display></hierarchy>';
  assert.deepEqual(terminalBusinessTextAssertion(visible, 'connection-connected', 0), {
    expectationId: 'connection-connected',
    resourceId: 'terminal.activation.admin:connection',
    matched: true,
  });
  const mismatch = terminalBusinessTextAssertion(hidden, 'connection-connected', 0);
  assert.equal(mismatch.matched, false);
  assert.equal(JSON.stringify(mismatch).includes('连接状态：连接中'), false);
  assert.throws(
    () => terminalBusinessTextAssertion(visible, 'unlisted-expectation', 0),
    /VK_ANDROID_BUSINESS_TEXT_EXPECTATION_INVALID/,
  );
  assert.throws(
    () => terminalBusinessTextAssertion('<hierarchy/>', 'activation-success', 0),
    /VK_ANDROID_BUSINESS_TEXT_EXPECTATION_INVALID/,
  );
  const rejected =
    '<hierarchy><display id="0"><node resource-id="terminal.activation.result" text="终端已停用，暂时无法激活。" bounds="[1,2][9,10]"/></display></hierarchy>';
  assert.equal(terminalBusinessTextAssertion(rejected, 'activation-disabled', 0).matched, true);
});

test('terminal business log projection binds app pid, time window, allowlisted fields, and redacts unknown payload data', () => {
  const event = {
    timestamp: Date.parse('2026-10-03T09:00:01.000Z'),
    category: 'terminal.activation.http',
    event: 'activation-request-result',
    context: {commandId: 'cmd_mg2a0w00_1234567890abcdef'},
    scope: {moduleName: 'kernel.base.terminal-data-client'},
    security: {containsSensitiveRaw: false},
    data: {
      profileId: 'terminal-data-client',
      operationId: 'activateTerminal',
      elapsedMs: 12,
      kind: 'success',
      status: 200,
      requestId: 'req_mg2a0w00_1234567890abcdef',
      correlationId: 'corr_mg2a0w00_1234567890abcdef',
      credentialSecret: 'must-not-be-retained',
    },
  };
  const log = `1791018001.000 123 123 I ReactNativeJS: ${JSON.stringify(event)}\n1791018001.000 999 999 I ReactNativeJS: ${JSON.stringify(event)}`;
  const projected = projectTerminalBusinessLogcatEvents(
    log,
    ['123'],
    '2026-10-03T09:00:00.000Z',
    '2026-10-03T09:00:02.000Z',
  );
  assert.equal(projected.invalidEventCount, 0);
  assert.deepEqual(projected.events, [
    {
      at: '2026-10-03T09:00:01.000Z',
      event: 'activation-request-result',
      commandIdPresent: true,
      data: {
        profileId: 'terminal-data-client',
        operationId: 'activateTerminal',
        elapsedMs: 12,
        kind: 'success',
        status: 200,
        requestId: 'req_mg2a0w00_1234567890abcdef',
        correlationId: 'corr_mg2a0w00_1234567890abcdef',
      },
    },
  ]);
  assert.equal(JSON.stringify(projected).includes('must-not-be-retained'), false);
  const pongEvent = {
    ...event,
    timestamp: Date.parse('2026-10-03T09:00:01.200Z'),
    category: 'terminal.connection.heartbeat',
    event: 'heartbeat-pong-matched',
    data: {profileId: 'terminal-data-client', sequence: 7, rttMs: 23},
  };
  const epochBrief = projectTerminalBusinessLogcatEvents(
    `1791018001.200 123 123 I/ReactNativeJS( 123 ): ${JSON.stringify(pongEvent)}`,
    ['123'],
    '2026-10-03T09:00:00.000Z',
    '2026-10-03T09:00:02.000Z',
  );
  assert.equal(epochBrief.invalidEventCount, 0);
  assert.equal(epochBrief.events.length, 1);
  assert.deepEqual(epochBrief.events[0].data, {profileId: 'terminal-data-client', sequence: 7, rttMs: 23});
  const epochWithUid = projectTerminalBusinessLogcatEvents(
    `1791018001.250 10123 123 123 I ReactNativeJS: ${JSON.stringify(pongEvent)}`,
    ['123'],
    '2026-10-03T09:00:00.000Z',
    '2026-10-03T09:00:02.000Z',
  );
  assert.equal(epochWithUid.invalidEventCount, 0);
  assert.equal(epochWithUid.events.length, 1);
  assert.deepEqual(epochWithUid.events[0].data, {profileId: 'terminal-data-client', sequence: 7, rttMs: 23});
  const epochLeadingWhitespace = projectTerminalBusinessLogcatEvents(
    `  1791018001.260 123 123 I ReactNativeJS: ${JSON.stringify(pongEvent)}`,
    ['123'],
    '2026-10-03T09:00:00.000Z',
    '2026-10-03T09:00:02.000Z',
  );
  assert.equal(epochLeadingWhitespace.invalidEventCount, 0);
  assert.equal(epochLeadingWhitespace.events.length, 1);
  const epochUidBrief = projectTerminalBusinessLogcatEvents(
    `1791018001.275 10123 123 123 I/ReactNativeJS( 123 ): ${JSON.stringify(pongEvent)}`,
    ['123'],
    '2026-10-03T09:00:00.000Z',
    '2026-10-03T09:00:02.000Z',
  );
  assert.equal(epochUidBrief.invalidEventCount, 0);
  assert.equal(epochUidBrief.events.length, 1);
  const epochUidBriefPidMismatch = projectTerminalBusinessLogcatEvents(
    `1791018001.275 10123 999 123 I/ReactNativeJS( 123 ): ${JSON.stringify(pongEvent)}`,
    ['123'],
    '2026-10-03T09:00:00.000Z',
    '2026-10-03T09:00:02.000Z',
  );
  assert.equal(epochUidBriefPidMismatch.events.length, 0);
  const mismatchedEpochBriefPid = projectTerminalBusinessLogcatEvents(
    `1791018001.200 999 123 I/ReactNativeJS( 123 ): ${JSON.stringify(pongEvent)}`,
    ['123'],
    '2026-10-03T09:00:00.000Z',
    '2026-10-03T09:00:02.000Z',
  );
  assert.equal(mismatchedEpochBriefPid.events.length, 0);
  assert.equal(mismatchedEpochBriefPid.invalidEventCount, 0);
  const staleLogcatTimestamp = projectTerminalBusinessLogcatEvents(
    `1791017999.000 123 123 I ReactNativeJS: ${JSON.stringify(event)}`,
    ['123'],
    '2026-10-03T09:00:00.000Z',
    '2026-10-03T09:00:02.000Z',
  );
  assert.equal(staleLogcatTimestamp.events.length, 0);
  assert.equal(staleLogcatTimestamp.invalidEventCount, 0);
  const staleStructuredTimestampInWindow = projectTerminalBusinessLogcatEvents(
    `1791018001.000 123 123 I ReactNativeJS: ${JSON.stringify({...event, timestamp: Date.parse('2026-10-03T08:59:59.000Z')})}`,
    ['123'],
    '2026-10-03T09:00:00.000Z',
    '2026-10-03T09:00:02.000Z',
  );
  assert.equal(staleStructuredTimestampInWindow.events.length, 0);
  assert.equal(staleStructuredTimestampInWindow.invalidEventCount, 1);
  const highPrecisionEpoch = projectTerminalBusinessLogcatEvents(
    `1791018001.123456 123 123 I ReactNativeJS: ${JSON.stringify(event)}`,
    ['123'],
    '2026-10-03T09:00:00.000Z',
    '2026-10-03T09:00:02.000Z',
  );
  assert.equal(highPrecisionEpoch.events.length, 1);
  assert.equal(highPrecisionEpoch.invalidEventCount, 0);
  const unboundedBriefLogcat = projectTerminalBusinessLogcatEvents(
    `I/ReactNativeJS(123): ${JSON.stringify(event)}`,
    ['123'],
    '2026-10-03T09:00:00.000Z',
    '2026-10-03T09:00:02.000Z',
  );
  assert.equal(unboundedBriefLogcat.events.length, 0);
  assert.equal(unboundedBriefLogcat.invalidEventCount, 1);
  assert.throws(
    () => projectTerminalBusinessLogcatEvents(log, [], '2026-10-03T09:00:00.000Z', '2026-10-03T09:00:02.000Z'),
    /VK_ANDROID_TERMINAL_BUSINESS_LOG_INPUT_INVALID/,
  );
  const untrusted = {...event, security: {containsSensitiveRaw: true}};
  const invalid = projectTerminalBusinessLogcatEvents(
    `I/ReactNativeJS(123): ${JSON.stringify(untrusted)}`,
    ['123'],
    '2026-10-03T09:00:00.000Z',
    '2026-10-03T09:00:02.000Z',
  );
  assert.equal(invalid.events.length, 0);
  assert.equal(invalid.invalidEventCount, 1);
  const withoutCommand = {...event, context: {}};
  const uncorrelated = projectTerminalBusinessLogcatEvents(
    `1791018001.000 123 123 I ReactNativeJS: ${JSON.stringify(withoutCommand)}`,
    ['123'],
    '2026-10-03T09:00:00.000Z',
    '2026-10-03T09:00:02.000Z',
  );
  assert.equal(uncorrelated.events.length, 0);
  assert.equal(uncorrelated.invalidEventCount, 1);
  const stringTimestamp = {...event, timestamp: new Date(event.timestamp).toISOString()};
  const invalidTimestamp = projectTerminalBusinessLogcatEvents(
    `1791018001.000 123 123 I ReactNativeJS: ${JSON.stringify(stringTimestamp)}`,
    ['123'],
    '2026-10-03T09:00:00.000Z',
    '2026-10-03T09:00:02.000Z',
  );
  assert.equal(invalidTimestamp.events.length, 0);
  assert.equal(invalidTimestamp.invalidEventCount, 1);
});

test('Android evidence window and backend correlation use run-bound request identities', () => {
  const window = resolveTerminalBusinessLogWindow('2026-10-03T09:00:00.000Z', '2026-10-03T09:00:02.000Z');
  assert.deepEqual(window, {
    startedAt: '2026-10-03T09:00:00.000Z',
    finishedAt: '2026-10-03T09:00:02.000Z',
  });
  assert.throws(
    () => resolveTerminalBusinessLogWindow('1791018000000', '1791018002000'),
    /VK_ANDROID_TERMINAL_BUSINESS_LOG_WINDOW_INVALID/,
  );
  const clientEvents = [
    {
      event: 'activation-request-result',
      data: {
        operationId: 'activateTerminal',
        kind: 'success',
        status: 200,
        requestId: 'req-activation-1',
        correlationId: 'corr-activation-1',
      },
    },
  ];
  const backendEvent = {
    event: 'REQUEST_COMPLETED',
    operationId: 'activateTerminal',
    outcome: 'SUCCEEDED',
    status: 200,
    owner: 'terminal-binding',
    consumerFace: 'terminal',
    routeTemplate: '/api/terminal/group-workspaces/{groupWorkspaceKey}/activation',
    requestId: 'req-activation-1',
    correlationId: 'corr-activation-1',
    databaseOperationCount: 9,
  };
  assert.deepEqual(correlateAndroidTerminalBackendLogEvents(clientEvents, [backendEvent]), [
    {
      operationId: 'activateTerminal',
      requestIdPresent: true,
      correlationIdPresent: true,
      status: 'PASS',
    },
  ]);
  assert.equal(correlateAndroidTerminalBackendLogEvents(clientEvents, [backendEvent, backendEvent])[0].status, 'FAIL');
  assert.equal(
    correlateAndroidTerminalBackendLogEvents(clientEvents, [{...backendEvent, requestId: 'req-other'}])[0].status,
    'FAIL',
  );
});

test('Android evidence capture fails closed when expected client, backend, or TDS proof is absent', () => {
  assert.deepEqual(terminalBusinessEvidenceFailureCodes('activation-success', [], [], 0), [
    'VK_ANDROID_TERMINAL_ACTIVATION_EVENT_MISSING',
    'VK_ANDROID_FRONTEND_BACKEND_LOG_CORRELATION_MISMATCH',
    'VK_ANDROID_TDS_REGISTERED_SESSION_NOT_OBSERVED',
  ]);
  const activate = [
    {event: 'activation-request-result', data: {operationId: 'activateTerminal', kind: 'success', status: 200}},
  ];
  assert.deepEqual(
    terminalBusinessEvidenceFailureCodes(
      'activation-success',
      activate,
      [{operationId: 'activateTerminal', status: 'PASS'}],
      1,
    ),
    [],
  );
  assert.deepEqual(terminalBusinessEvidenceFailureCodes('activation-cancelled', [], [], 0), [
    'VK_ANDROID_TERMINAL_CANCELLATION_EVENT_MISSING',
    'VK_ANDROID_FRONTEND_BACKEND_LOG_CORRELATION_MISMATCH',
  ]);
  assert.deepEqual(terminalBusinessEvidenceFailureCodes('heartbeat-pong', [], [], 0), [
    'VK_ANDROID_TERMINAL_HEARTBEAT_PONG_EVENT_MISSING',
  ]);
  assert.deepEqual(
    terminalBusinessEvidenceFailureCodes('heartbeat-pong', [{event: 'heartbeat-pong-matched'}], [], 0),
    [],
  );
  assert.throws(
    () => terminalBusinessEvidenceFailureCodes('anything', [], [], 0),
    /VK_ANDROID_TERMINAL_BUSINESS_EXPECTATION_INVALID/u,
  );
});

test('Android logcat forensic counters expose empty capture without retaining log contents', () => {
  assert.deepEqual(summarizeTerminalBusinessLogcatDiagnostics('', ['123']), {
    lineCount: 0,
    reactNativeJsLineCount: 0,
    appLogLineCount: 0,
    otherProcessReactNativeJsLineCount: 0,
    unparsedReactNativeJsLineCount: 0,
    unparsedHeaderFormats: {epoch: 0, isoDate: 0, monthDay: 0, brief: 0, other: 0},
    unparsedHeaderShapes: {},
    jsonEventEnvelopeCount: 0,
    knownEventCandidateCount: 0,
  });
  const payload = JSON.stringify({event: 'activation-request-result', secret: 'never-retain'});
  const diagnostics = summarizeTerminalBusinessLogcatDiagnostics(
    `1791018001.000 123 123 I ReactNativeJS: ${payload}\n1791018001.100 999 999 I ReactNativeJS: ${payload}\nI/ReactNativeJS(123): ${payload}\n1791018001.200 123 123 I/ReactNativeJS( 123 ): ${payload}\n1791018001.300 1 2 3 123 I ReactNativeJS: ${payload}\n2026-10-03 09:00:01.200 123 123 I/ReactNativeJS( 123 ): ${payload}`,
    ['123'],
  );
  assert.deepEqual(diagnostics, {
    lineCount: 6,
    reactNativeJsLineCount: 4,
    appLogLineCount: 3,
    otherProcessReactNativeJsLineCount: 1,
    unparsedReactNativeJsLineCount: 2,
    unparsedHeaderFormats: {epoch: 1, isoDate: 1, monthDay: 0, brief: 0, other: 0},
    unparsedHeaderShapes: {
      'epoch|numericFields=4|priority=space|embeddedPid=false': 1,
      'isoDate|numericFields=0|priority=slash|embeddedPid=true': 1,
    },
    jsonEventEnvelopeCount: 3,
    knownEventCandidateCount: 3,
  });
  assert.equal(JSON.stringify(diagnostics).includes('never-retain'), false);
});

test('TDS forensic capture reads node identity from the managed control, not readiness projection', () => {
  assert.equal(terminalTdsNodeEvidenceId({nodeId: 'tds-a', instanceName: 'tds-a'}), 'tds-a');
  assert.equal(terminalTdsNodeEvidenceId({nodeId: 'tds-b', instanceName: 'tds-b'}), 'tds-b');
  assert.throws(
    () => terminalTdsNodeEvidenceId({remoteIdentity: {nodeId: 'tds-a'}}),
    /VK_ANDROID_TDS_CONTROL_NODE_ID_INVALID/u,
  );
  assert.throws(
    () => terminalTdsNodeEvidenceId({nodeId: 'tds-a', instanceName: 'unexpected'}),
    /VK_ANDROID_TDS_CONTROL_NODE_ID_INVALID/u,
  );
});

test('binding readback can inspect actual seed state and preserves safe mismatch evidence before failing', () => {
  const shared = {
    expectedTerminalStatus: 'ENABLED',
    observedTerminalStatus: 'ENABLED',
    observedBindingStatus: 'ENDED',
    generation: 14,
  };
  assert.equal(terminalBindingReadbackMatches({...shared, expectedBindingStatus: undefined}), true);
  assert.equal(terminalBindingReadbackMatches({...shared, expectedBindingStatus: 'ENDED'}), true);
  assert.equal(terminalBindingReadbackMatches({...shared, expectedBindingStatus: 'UNBOUND'}), false);
  assert.equal(terminalBindingReadbackMatches({...shared, expectedTerminalStatus: 'DISABLED'}), false);
  assert.equal(terminalBindingReadbackMatches({...shared, observedBindingStatus: 'UNBOUND', generation: 14}), false);
});

test('terminal identity readback compares in memory and exposes only match booleans', () => {
  const identity = {
    observedTerminalRef: 'a58f0283-a942-4f86-b7bd-fb3795b2ed6b',
    expectedTerminalRef: 'a58f0283-a942-4f86-b7bd-fb3795b2ed6b',
    observedGroupWorkspaceKey: 'aurora',
    expectedGroupWorkspaceKey: 'aurora',
  };
  assert.deepEqual(terminalBindingIdentityReadbackMatches(identity), {
    terminalRefMatches: true,
    groupWorkspaceMatches: true,
    matched: true,
  });
  const mismatch = terminalBindingIdentityReadbackMatches({
    ...identity,
    expectedTerminalRef: 'ad96c36c-891d-4d6d-a2a9-b118a8075e29',
  });
  assert.deepEqual(mismatch, {terminalRefMatches: false, groupWorkspaceMatches: true, matched: false});
  assert.equal(JSON.stringify(mismatch).includes(identity.observedTerminalRef), false);
  assert.throws(
    () => terminalBindingIdentityReadbackMatches({...identity, expectedGroupWorkspaceKey: null}),
    /VK_ANDROID_TERMINAL_IDENTITY_READBACK_INVALID/u,
  );
});

test('terminal identity fixture resolution matches the finite candidate set without exposing identifiers', () => {
  const observedTerminalRef = 'a58f0283-a942-4f86-b7bd-fb3795b2ed6b';
  const candidates = [
    {fixtureKey: 'term-front', terminalRef: 'ad96c36c-891d-4d6d-a2a9-b118a8075e29', groupWorkspaceKey: 'aurora'},
    {fixtureKey: 'term-kitchen-multi', terminalRef: observedTerminalRef, groupWorkspaceKey: 'aurora'},
  ];
  const result = terminalBindingFixtureCandidates({
    observedTerminalRef,
    observedGroupWorkspaceKey: 'aurora',
    expectedGroupWorkspaceKey: 'aurora',
    candidates,
  });
  assert.deepEqual(result, {candidateCount: 2, matchedFixtureKeys: ['term-kitchen-multi'], workspaceMatches: true});
  assert.equal(JSON.stringify(result).includes(observedTerminalRef), false);
  assert.deepEqual(
    terminalBindingFixtureCandidates({
      observedTerminalRef,
      observedGroupWorkspaceKey: 'other-space',
      expectedGroupWorkspaceKey: 'aurora',
      candidates,
    }),
    {candidateCount: 2, matchedFixtureKeys: [], workspaceMatches: false},
  );
  assert.deepEqual(
    terminalBindingFixtureCandidates({
      observedTerminalRef: '11111111-1111-4111-8111-111111111111',
      observedGroupWorkspaceKey: 'aurora',
      expectedGroupWorkspaceKey: 'aurora',
      candidates,
    }),
    {candidateCount: 2, matchedFixtureKeys: [], workspaceMatches: true},
  );
  assert.throws(
    () =>
      terminalBindingFixtureCandidates({
        observedTerminalRef,
        observedGroupWorkspaceKey: 'aurora',
        expectedGroupWorkspaceKey: 'aurora',
        candidates: [],
      }),
    /VK_ANDROID_TERMINAL_IDENTITY_CANDIDATE_INPUT_INVALID/u,
  );
});

test('terminal business screen oracle requires every finite control on the selected display', () => {
  const expectationId = 'member-form-host';
  const controls = TERMINAL_BUSINESS_SCREENS[expectationId].required;
  const nodes = controls.map(resourceId => `<node resource-id="${resourceId}" bounds="[1,2][9,10]" enabled="true"/>`);
  const complete = `<hierarchy><display id="0">${nodes.join('')}</display><display id="1"></display></hierarchy>`;
  assert.deepEqual(terminalBusinessScreenAssertion(complete, expectationId, 0), {
    expectationId,
    requiredControlCount: controls.length,
    matchedControlCount: controls.length,
    missingResourceIds: [],
    unexpectedResourceIds: [],
    ambiguousResourceIds: [],
    matched: true,
  });

  const incomplete = `<hierarchy><display id="0">${nodes.slice(0, -1).join('')}</display></hierarchy>`;
  const missing = terminalBusinessScreenAssertion(incomplete, expectationId, 0);
  assert.equal(missing.matched, false);
  assert.equal(missing.requiredControlCount - missing.matchedControlCount, 1);
  assert.deepEqual(missing.missingResourceIds, [controls.at(-1)]);

  assert.equal(terminalBusinessScreenAssertion(complete, expectationId, 1).matched, false);
  assert.throws(
    () => terminalBusinessScreenAssertion(complete, 'unlisted-screen', 0),
    /VK_ANDROID_BUSINESS_SCREEN_EXPECTATION_INVALID/,
  );
  assert.throws(
    () => terminalBusinessScreenAssertion(complete, expectationId, Number.NaN),
    /VK_ANDROID_BUSINESS_SCREEN_DISPLAY_INVALID/,
  );
  const ambiguous = terminalBusinessScreenAssertion(
    `<hierarchy><display id="0"><node resource-id="${controls[0]}" bounds="[1,2][9,10]"/><node resource-id="${controls[0]}" bounds="[1,2][9,10]"/></display></hierarchy>`,
    expectationId,
    0,
  );
  assert.equal(ambiguous.matched, false);
  assert.deepEqual(ambiguous.ambiguousResourceIds, [controls[0]]);
});

test('host member list is not accepted while any member-desk blocking layer is present', () => {
  const expectationId = 'member-list-host';
  const expectation = TERMINAL_BUSINESS_SCREENS[expectationId];
  const base = expectation.required
    .map(resourceId => `<node resource-id="${resourceId}" bounds="[1,2][9,10]" enabled="true"/>`)
    .join('');
  assert.equal(
    terminalBusinessScreenAssertion(`<hierarchy><display id="0">${base}</display></hierarchy>`, expectationId, 0)
      .matched,
    true,
  );
  for (const blocker of expectation.forbidden) {
    const result = terminalBusinessScreenAssertion(
      `<hierarchy><display id="0">${base}<node resource-id="${blocker}" bounds="[1,2][9,10]" enabled="true"/></display></hierarchy>`,
      expectationId,
      0,
    );
    assert.equal(result.matched, false, `${blocker} prevents the underlying list from being treated as active`);
    assert.deepEqual(result.unexpectedResourceIds, [blocker]);
  }
});

test('screen diagnostics expose only bounded resource ids and classes, never visible text', () => {
  const xml =
    '<hierarchy><display id="0">' +
    '<node resource-id="terminal.activation.screen" class="android.view.View" text="SECRET_CODE" content-desc="PRIVATE_LABEL" bounds="[1,2][9,10]"/>' +
    '<node resource-id="sample.auth.login:submit" class="android.widget.Button" text="Continue" bounds="[1,10][9,18]"/>' +
    '</display></hierarchy>';
  const result = summarizeTerminalBusinessScreenDiagnostic(xml, 0, 'com.anonymous.sampleterminal');
  assert.equal(result.visibleNodeCount, 2);
  assert.deepEqual(result.applicationResourceIds, ['sample.auth.login:submit', 'terminal.activation.screen']);
  assert.equal(result.screenControlCounts.activation.observed, 1);
  assert.equal(result.uiTextCaptured, false);
  assert.equal(result.contentDescriptionsCaptured, false);
  assert.equal(JSON.stringify(result).includes('SECRET_CODE'), false);
  assert.equal(JSON.stringify(result).includes('PRIVATE_LABEL'), false);
  assert.equal(JSON.stringify(result).includes('Continue'), false);
  assert.throws(
    () => summarizeTerminalBusinessScreenDiagnostic(xml, -1, 'com.anonymous.sampleterminal'),
    /VK_ANDROID_BUSINESS_SCREEN_DIAGNOSTIC_ARGUMENT_INVALID/u,
  );
});

test('terminal screen oracles distinguish host and branch wallpaper controls', () => {
  const expectation = TERMINAL_BUSINESS_SCREENS['wallpaper-slave'];
  const required = expectation.required.map(
    resourceId => `<node resource-id="${resourceId}" bounds="[1,2][9,10]" enabled="true"/>`,
  );
  const branchPage = `<hierarchy><display id="0">${required.join('')}</display></hierarchy>`;
  assert.equal(terminalBusinessScreenAssertion(branchPage, 'wallpaper-slave', 0).matched, true);

  const leakedHostLogout = branchPage.replace(
    '</display>',
    '<node resource-id="sample.wallpaper.picker:logout" bounds="[1,2][9,10]" enabled="true"/></display>',
  );
  const mismatch = terminalBusinessScreenAssertion(leakedHostLogout, 'wallpaper-slave', 0);
  assert.equal(mismatch.matched, false);
  assert.deepEqual(mismatch.unexpectedResourceIds, ['sample.wallpaper.picker:logout']);

  const hostMobile = TERMINAL_BUSINESS_SCREENS['wallpaper-host-mobile'];
  assert.ok(hostMobile.required.includes('sample.wallpaper.picker:logout'));
  assert.ok(hostMobile.forbidden.includes('sample.wallpaper.picker:exit'));
  assert.ok(TERMINAL_BUSINESS_SCREENS['wallpaper-host-laptop'].required.includes('sample.wallpaper.picker:exit'));
});

test('terminal screen oracles reject a host member list on the branch display', () => {
  const expectation = TERMINAL_BUSINESS_SCREENS['member-list-branch'];
  const required = expectation.required.map(
    resourceId => `<node resource-id="${resourceId}" bounds="[1,2][9,10]" enabled="true"/>`,
  );
  const branchList = `<hierarchy><display id="2">${required.join('')}</display></hierarchy>`;
  assert.equal(terminalBusinessScreenAssertion(branchList, 'member-list-branch', 2).matched, true);
  const leakedHostList = branchList.replace(
    '</display>',
    '<node resource-id="sample.desk.member-list" bounds="[1,2][9,10]" enabled="true"/></display>',
  );
  assert.deepEqual(terminalBusinessScreenAssertion(leakedHostList, 'member-list-branch', 2).unexpectedResourceIds, [
    'sample.desk.member-list',
  ]);
});

test('terminal business screen wait requires a visible oracle before or at the fixed deadline', () => {
  assert.equal(terminalBusinessScreenWaitMatched(true, 20_000, 20_000), true);
  assert.equal(terminalBusinessScreenWaitMatched(true, 20_001, 20_000), false);
  assert.equal(terminalBusinessScreenWaitMatched(false, 4, 20_000), false);
  assert.throws(
    () => terminalBusinessScreenWaitMatched(true, -1, 20_000),
    /VK_ANDROID_BUSINESS_SCREEN_WAIT_EVIDENCE_INVALID/,
  );
});

test('managed Android child commands have a bounded default and validate explicit limits', () => {
  assert.equal(resolveManagedCommandTimeoutMs(undefined), 60_000);
  assert.equal(resolveManagedCommandTimeoutMs(8_000), 8_000);
  assert.throws(() => resolveManagedCommandTimeoutMs(0), /VK_ANDROID_COMMAND_TIMEOUT_INVALID/);
  assert.throws(() => resolveManagedCommandTimeoutMs(Number.POSITIVE_INFINITY), /VK_ANDROID_COMMAND_TIMEOUT_INVALID/);
  assert.equal(resolveManagedCommandMaxBytes(undefined), 24 * 1024 * 1024);
  assert.equal(resolveManagedCommandMaxBytes(8_000), 8_000);
  assert.throws(() => resolveManagedCommandMaxBytes(0), /VK_ANDROID_COMMAND_OUTPUT_LIMIT_INVALID/);
  assert.throws(() => resolveManagedCommandMaxBytes(129 * 1024 * 1024), /VK_ANDROID_COMMAND_OUTPUT_LIMIT_INVALID/);
});

test('terminal business screen expectations are anchored to current UI owners', () => {
  const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
  const activation = read('apps/terminal/ui/base/terminal-activation/src/components/ActivationCodeForm.tsx');
  const staffLogin = [
    'apps/terminal/ui/feature/sample-staff-auth/src/components/laptop/StaffLogin.tsx',
    'apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLoginOperatorNameInput.tsx',
    'apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLoginPasscodeInput.tsx',
    'apps/terminal/ui/feature/sample-staff-auth/src/hooks/useStaffLogin.ts',
  ]
    .map(read)
    .join('\n');
  const memberList = [
    'apps/terminal/ui/feature/sample-member-desk/src/components/laptop/MemberList.tsx',
    'apps/terminal/ui/feature/sample-member-desk/src/components/branch/MemberList.tsx',
  ]
    .map(read)
    .join('\n');
  const memberForm = [
    'apps/terminal/ui/feature/sample-member-desk/src/components/laptop/MemberForm.tsx',
    'apps/terminal/ui/feature/sample-member-desk/src/components/MemberFormScrollContent.tsx',
  ]
    .map(read)
    .join('\n');
  const customer = [
    'apps/terminal/ui/feature/sample-member-desk/src/components/laptop/CustomerMember.tsx',
    'apps/terminal/ui/feature/sample-member-desk/src/components/branch/CustomerMember.tsx',
  ]
    .map(read)
    .join('\n');
  const wallpaper = [
    'apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/wallpaperPickerTestIds.ts',
    'apps/terminal/ui/feature/sample-wallpaper-picker/src/foundations/wallpaperCatalogData.json',
    'apps/terminal/ui/feature/sample-wallpaper-picker/src/components/laptop/WallpaperPicker.tsx',
    'apps/terminal/ui/feature/sample-wallpaper-picker/src/components/mobile/WallpaperPicker.tsx',
    'apps/terminal/ui/feature/sample-wallpaper-picker/src/components/laptop/BranchWallpaperPicker.tsx',
    'apps/terminal/ui/feature/sample-wallpaper-picker/src/components/WallpaperOptionCards.tsx',
  ]
    .map(read)
    .join('\n');
  const activationAdmin = read('apps/terminal/ui/base/terminal-activation/src/components/ActivationStatusSection.tsx');
  const activationOwner = read('apps/terminal/ui/base/terminal-activation/src/components/ActivationCodeForm.tsx');
  assert.match(activation, /testID="terminal\.activation\.screen"/);
  assert.match(activation, /testID:\s*fieldId/);
  assert.match(activation, /testID="terminal\.activation\.submit"/);
  assert.match(staffLogin, /sample\.auth\.login/);
  assert.match(staffLogin, /operatorNameFieldId\s*=\s*'sample\.auth\.login:operator-name'/);
  assert.match(staffLogin, /passcodeFieldId\s*=\s*'sample\.auth\.login:passcode'/);
  assert.match(memberList, /\$\{prefix\}:title/);
  assert.match(memberList, /\$\{prefix\}:scroll/);
  assert.match(memberList, /showLogout=\{false\}/);
  assert.match(memberList, /sample\.desk\.branch\.member-list/);
  assert.match(memberForm, /\$\{prefix\}:submit/);
  assert.match(memberForm, /\$\{prefix\}:cancel/);
  assert.match(customer, /\$\{prefix\}:confirm/);
  assert.match(customer, /\$\{prefix\}:reject/);
  assert.match(customer, /sample\.desk\.branch\.customer-member/);
  assert.match(wallpaper, /sample\.wallpaper\.picker:logout/);
  assert.match(wallpaper, /sample\.wallpaper\.branch\.picker:exit/);
  assert.match(wallpaper, /branchWallpaperOptionTestId/);
  assert.match(wallpaper, /sample\.wallpaper\.picker:exit/);
  assert.match(wallpaper, /\$\{optionTestId\}:card/);
  assert.match(wallpaper, /"none"/);
  assert.match(wallpaper, /"w1"/);
  assert.match(wallpaper, /"w2"/);
  assert.match(wallpaper, /"w3"/);
  assert.match(activationAdmin, /terminal\.activation\.admin\.cancel/);
  assert.match(activationOwner, /STORE_TERMINAL_DISABLED:\s*'终端已停用，暂时无法激活。'/);
  const activationField = activation.match(/const ActivationCodeField =([\s\S]*?)\n};/);
  const activationForm = activation.match(/export const ActivationCodeForm =([\s\S]*)$/);
  assert.ok(activationField, 'activation field has a dedicated input-owning component');
  assert.ok(activationForm, 'activation form source is present');
  assert.match(activationField[0], /useInputField\(/);
  assert.doesNotMatch(activationForm[0], /useInputField\(/);
  assert.match(activationForm[0], /<InputScrollArea[\s\S]*<ActivationCodeField\s/);
  for (const [name, expectation] of Object.entries(TERMINAL_BUSINESS_SCREENS)) {
    assert.ok(expectation.required.length > 0, `${name} has a nonempty screen oracle`);
    assert.equal(
      new Set(expectation.required).size,
      expectation.required.length,
      `${name} has no duplicate required control`,
    );
    assert.equal(
      new Set(expectation.forbidden ?? []).size,
      (expectation.forbidden ?? []).length,
      `${name} has no duplicate forbidden control`,
    );
    assert.equal(
      expectation.required.some(resourceId => (expectation.forbidden ?? []).includes(resourceId)),
      false,
    );
  }
});

test('terminal business assertion failures are recorded before the runner exits nonzero', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  for (const [functionName, failureCode] of [
    ['assertTerminalBusinessText', 'VK_ANDROID_BUSINESS_TEXT_ASSERTION_FAILED'],
    ['assertTerminalBusinessScreen', 'VK_ANDROID_BUSINESS_SCREEN_ASSERTION_FAILED'],
  ]) {
    const start = source.indexOf(`async function ${functionName}(`);
    assert.notEqual(start, -1, `${functionName} exists`);
    const body = source.slice(start, source.indexOf('\n}', start) + 2);
    const tryBlock = body.indexOf('try {');
    const dumpRead = body.indexOf('await uiDump(');
    const catchBlock = body.indexOf('} catch (error)');
    assert.ok(
      tryBlock >= 0 && dumpRead > tryBlock && catchBlock > dumpRead,
      `${functionName} records UI read failures`,
    );
    const evidenceWrite = body.indexOf('manifest.businessChecks.push(');
    const manifestSave = body.indexOf('saveManifest(manifest);');
    const failure = body.indexOf(`fail(failureCode ?? '${failureCode}')`);
    assert.ok(evidenceWrite >= 0 && manifestSave > evidenceWrite && failure > manifestSave);
  }
  assert.match(source, /action === 'assert-business-screen'/);
  assert.match(source, /action === 'diagnose-business-screen'/);
  assert.match(source, /action === 'verify-terminal-binding-identity'/);
  assert.match(source, /action === 'wait-business-screen'/);
  const waitStart = source.indexOf('async function waitTerminalBusinessScreen(');
  const waitBody = source.slice(waitStart, source.indexOf('\n}', waitStart) + 2);
  assert.match(waitBody, /BUSINESS_SCREEN_WAIT_TIMEOUT_MS/);
  assert.match(waitBody, /BUSINESS_SCREEN_WAIT_POLL_MS/);
  assert.match(waitBody, /performance\.now\(\)/);
  assert.match(waitBody, /catch \(error\)/);
  assert.match(waitBody, /failureCode/);
  assert.match(waitBody, /summarizeTerminalBusinessScreenDiagnostic/);
  assert.match(waitBody, /manifest\.businessChecks\.push\(result\)/);
  assert.ok(
    waitBody.indexOf('saveManifest(manifest);') <
      waitBody.indexOf("fail(failureCode ?? 'VK_ANDROID_BUSINESS_SCREEN_WAIT_TIMED_OUT')"),
  );
  const dumpStart = source.indexOf('async function uiDump(');
  const dumpBody = source.slice(dumpStart, source.indexOf('\n}', dumpStart) + 2);
  assert.match(dumpBody, /deadlineMonotonic/);
  assert.match(dumpBody, /timeoutMs: commandTimeout\(\)/);
  const managedStart = source.indexOf('async function runManaged(');
  const managedBody = source.slice(managedStart, source.indexOf('\n}', managedStart) + 2);
  assert.match(managedBody, /resolveManagedCommandTimeoutMs\(options\.timeoutMs\)/);
  assert.match(managedBody, /resolveManagedCommandMaxBytes\(options\.maxBytes\)/);
  assert.ok(
    managedBody.indexOf('resolveManagedCommandMaxBytes(options.maxBytes)') < managedBody.indexOf('spawn(command, args'),
  );
  assert.match(managedBody, /setTimeout\(/);
  assert.match(managedBody, /VK_ANDROID_COMMAND_OUTPUT_TRUNCATED/);
  assert.match(managedBody, /outputTruncated/);
});

test('terminal business oracle IDs and text match the current owning UI components', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
  const operatorName = read(
    'apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLoginOperatorNameInput.tsx',
  );
  const passcode = read('apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLoginPasscodeInput.tsx');
  const memberForm = read('apps/terminal/ui/feature/sample-member-desk/src/components/MemberFormScrollContent.tsx');
  const customerAge = read('apps/terminal/ui/feature/sample-member-desk/src/components/CustomerMemberAgeField.tsx');
  const status = read('apps/terminal/ui/base/terminal-activation/src/components/ActivationStatusSection.tsx');
  assert.match(operatorName, /testID:\s*operatorNameFieldId/);
  assert.match(operatorName, /keyboardKind:\s*'virtual'/);
  assert.match(passcode, /testID:\s*passcodeFieldId/);
  assert.match(passcode, /secureTextEntry:\s*true/);
  assert.match(memberForm, /testID:\s*`\$\{prefix\}:name`/);
  assert.match(memberForm, /testID:\s*`\$\{prefix\}:phone`/);
  assert.match(customerAge, /testID:\s*fieldId/);
  assert.match(status, /testID="terminal\.activation\.admin:state"/);
  assert.match(status, /testID="terminal\.activation\.admin:connection"/);
  assert.match(
    status,
    /连接状态：\{connection === null \? '主机状态待同步' : readableConnection\(connection\.status\)\}/,
  );
});

test('terminal member readback requires exactly one full synthetic row and redacts its values', () => {
  const name = 'ter0123456789';
  const phone = '01012345678';
  const row = `<node resource-id="sample.desk.member-list:row:request-1:content" text="${name} ${phone}" bounds="[1,2][9,10]"/>`;
  const xml = `<hierarchy><display id="0">${row}</display><display id="2"><node resource-id="sample.desk.member-list:row:request-2:content" text="${name} ${phone}"/></display></hierarchy>`;
  assert.deepEqual(terminalBusinessMemberReadback(xml, name, phone, 0), {
    rowsObserved: 1,
    matchingRows: 1,
    matched: true,
  });
  assert.deepEqual(
    terminalBusinessMemberReadback(
      `<hierarchy><display id="0">${row}${row.replace('request-1', 'request-2')}</display></hierarchy>`,
      name,
      phone,
      0,
    ),
    {
      rowsObserved: 2,
      matchingRows: 2,
      matched: false,
    },
  );
  const mismatch = terminalBusinessMemberReadback(
    `<hierarchy><display id="0">${row.replace(phone, '01087654321')}</display></hierarchy>`,
    name,
    phone,
    0,
  );
  assert.equal(mismatch.matched, false);
  assert.equal(JSON.stringify(mismatch).includes(name), false);
  assert.equal(JSON.stringify(mismatch).includes(phone), false);
  assert.throws(
    () => terminalBusinessMemberReadback(xml, 'Alice', phone, 0),
    /VK_ANDROID_BUSINESS_MEMBER_EXPECTATION_INVALID/,
  );
  assert.throws(
    () => terminalBusinessMemberReadback(xml, name, phone, 'not-an-id'),
    /VK_ANDROID_BUSINESS_MEMBER_DISPLAY_INVALID/,
  );
});

test('terminal member readback action derives the current run fixture and persists only counts', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const helperStart = source.indexOf('async function assertTerminalBusinessMemberReadback(');
  const helperEnd = source.indexOf('\nasync function ', helperStart + 1);
  const helper = source.slice(helperStart, helperEnd);
  assert.ok(helperStart >= 0 && helperEnd > helperStart);
  assert.match(helper, /terminalBusinessInputValue\(manifest\.runId, 'member-name'\)/);
  assert.match(helper, /terminalBusinessInputValue\(manifest\.runId, 'member-phone'\)/);
  assert.match(helper, /name: 'BUSINESS_MEMBER_READBACK',\s*\.\.\.evidence,\s*elapsedMs:/);
  assert.match(helper, /BUSINESS_MEMBER_READBACK_FAILED/);
  assert.match(helper, /recordFirstFailure\(manifest, failureCode, 'member-list-owner-readback'\)/);
  assert.doesNotMatch(helper, /expectedName|expectedPhone|member-name:.*value/);
  assert.match(
    source.slice(
      source.indexOf("if (action === 'assert-business-member-readback')"),
      source.indexOf("if (action === 'capture-terminal-business-logs')"),
    ),
    /assertTerminalBusinessMemberReadback/,
  );
  assert.match(
    source.slice(
      source.indexOf('export function projectTerminalBusinessLogcatEvents'),
      source.indexOf('function isCanonicalBusinessTimestamp'),
    ),
    /entry\.timestampMs < start \|\| entry\.timestampMs > finish/,
  );
  const clockReader = source.slice(
    source.indexOf('async function readTerminalBusinessClock('),
    source.indexOf('\nasync function tapActivationKey', source.indexOf('async function readTerminalBusinessClock(')),
  );
  assert.match(clockReader, /\['shell', 'date', '\+%s'\]/);
  assert.match(clockReader, /bootId: device\.inventory\.bootId/);
  assert.match(
    source.slice(source.indexOf('async function dispatch(')),
    /action === 'business-clock'\) return readTerminalBusinessClock/,
  );
  assert.match(source.slice(source.indexOf('async function dispatch(')), /action === 'mark-terminal-evidence-start'/);
  assert.match(
    source.slice(source.indexOf('async function dispatch(')),
    /collectTerminalBusinessLogEvidence\(manifest, args\.device, args\.app, args\.expectation\)/,
  );
  assert.doesNotMatch(
    source.slice(source.indexOf('async function dispatch(')),
    /collectTerminalBusinessLogEvidence\([^\n]*args\['started-at'\]/,
  );
  const capture = source.slice(
    source.indexOf('async function collectTerminalBusinessLogEvidence('),
    source.indexOf(
      '\nasync function readTerminalBusinessClock',
      source.indexOf('async function collectTerminalBusinessLogEvidence('),
    ),
  );
  assert.match(capture, /validateManagedDevManifest\(readRepositoryJson\(managedDevManifestFile\(\)\)\)/);
  assert.match(capture, /collectRemoteLog\(host, devManifest\.remoteJava, backendRawPath\)/);
  assert.match(capture, /collectRemoteTdsLog\(host, node, rawPath\)/);
  assert.match(capture, /fs\.rmSync\(rawPath, \{force: true\}\)/);
  assert.match(capture, /rawServerLogCleanup = 'FAIL'/);
  assert.match(capture, /correlateAndroidTerminalBackendLogEvents\(evidence\.events, backendEvents\)/);
  assert.match(capture, /terminalBusinessEvidenceFailureCodes\(/);
  assert.match(capture, /summarizeTerminalBusinessLogcatDiagnostics\(/);
  assert.match(capture, /terminalTdsNodeEvidenceId\(node\)/);
  assert.match(capture, /result\.brokenBoundary = brokenBoundary/);
  assert.match(capture, /result\.lastKnownGood = lastKnownGood/);
  assert.match(capture, /backend-terminal-activation-\$\{captureSuffix\}\.jsonl/);
  assert.match(capture, /tds-server-events-\$\{captureSuffix\}\.jsonl/);
  const readbackStart = source.indexOf('function readTerminalBindingEvidence(');
  const readbackEnd = source.indexOf('\nasync function ', readbackStart + 1);
  const bindingReadback = source.slice(readbackStart, readbackEnd);
  assert.ok(readbackStart >= 0 && readbackEnd > readbackStart);
  assert.match(bindingReadback, /readManagedTerminalBindingByName\(/);
  assert.match(bindingReadback, /terminalBindingReadbackMatches\(/);
  assert.match(
    bindingReadback,
    /saveManifest\(manifest\);\s*if \(!matched\) fail\('VK_ANDROID_TERMINAL_BINDING_READBACK_MISMATCH'\)/,
  );
  assert.match(bindingReadback, /SERVER_TERMINAL_BINDING_READBACK/);
  assert.doesNotMatch(bindingReadback, /\b(?:UPDATE|INSERT|DELETE|TRUNCATE)\b/i);
  assert.match(source.slice(source.indexOf('async function dispatch(')), /readTerminalBindingEvidence\(/);
  assert.match(source, /ANDROID_TERMINAL_EVIDENCE=PASS/);
  assert.match(source, /args\.expectation\);/);
});

test('paired terminal VM admission proves separate emulator, AVD, and boot identities', () => {
  const pair = validateTerminalEmulatorPair(
    {serial: 'emulator-5554', avdName: 'TER_LAPTOP_A', bootId: '00000000-0000-0000-0000-000000000001'},
    {serial: 'emulator-5556', avdName: 'TER_MOBILE_B', bootId: '00000000-0000-0000-0000-000000000002'},
  );
  assert.equal(pair.dual.avdName, 'TER_LAPTOP_A');
  assert.equal(pair.mobile.avdName, 'TER_MOBILE_B');
  for (const mobile of [
    {serial: 'emulator-5554', avdName: 'TER_MOBILE_B', bootId: '00000000-0000-0000-0000-000000000002'},
    {serial: 'emulator-5556', avdName: 'TER_LAPTOP_A', bootId: '00000000-0000-0000-0000-000000000002'},
    {serial: 'emulator-5556', avdName: 'TER_MOBILE_B', bootId: '00000000-0000-0000-0000-000000000001'},
    {serial: 'emulator-5556', avdName: '../TER_MOBILE_B', bootId: '00000000-0000-0000-0000-000000000002'},
    {serial: 'physical-01', avdName: 'TER_MOBILE_B', bootId: '00000000-0000-0000-0000-000000000002'},
  ]) {
    assert.throws(
      () => validateTerminalEmulatorPair(pair.dual, mobile),
      /VK_ANDROID_DISTINCT_EMULATOR_IDENTITY_UNPROVEN/,
    );
  }
  const manifest = validManifest();
  manifest.devices.dual.inventory = pair.dual;
  manifest.devices.mobile.inventory = pair.mobile;
  manifest.emulatorPairIdentity = pair;
  assert.doesNotThrow(() => runner.validateRunManifest(manifest));
  manifest.emulatorPairIdentity = {...pair, mobile: {...pair.mobile, avdName: pair.dual.avdName}};
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_DISTINCT_EMULATOR_IDENTITY_MISMATCH/);
});

function validManifest() {
  return {
    schemaVersion: 2,
    runId: 'vk-run-01',
    devices: {
      dual: {serial: 'emulator-5554', inventory: {serial: 'emulator-5554', bootId: 'boot-12345678'}},
      mobile: {serial: 'emulator-5556', inventory: {serial: 'emulator-5556', bootId: 'boot-87654321'}},
    },
    appBindings: {
      'sample-terminal': {
        apkPath:
          'apps/terminal/application/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk',
        bytes: 128,
        sha256: 'a'.repeat(64),
      },
    },
    ownedRemoteProcesses: [],
    ownedRemoteCaptureProcesses: [],
    pendingRemoteLaunches: [],
    pendingRemoteCaptureProcesses: [],
    remoteTempFiles: [],
    processes: [],
  };
}

function validLaunchLogReinspectionManifest() {
  const intent = {
    intentId: 'dual-sample-terminal-epoch-01',
    shape: 'dual',
    appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal',
    host: 'emulator-5554',
    bootId: 'boot-12345678',
    resolution: 'PROCESS_ABSENT',
    processCount: 0,
  };
  const inspection = {
    intentId: intent.intentId,
    shape: intent.shape,
    appName: intent.appName,
    packageName: intent.packageName,
    host: intent.host,
    bootId: intent.bootId,
    evidenceStatus: 'MATCHED',
    startupPid: '321',
    startupAtEpochMs: 1790203633400,
    overlayOutcome: 'ATTACHED',
    observedMarkers: ['activity.onCreate:start', 'native.loading-overlay-attached'],
    markerCount: 2,
    signals: {
      fatalException: false,
      processDied: false,
      nativeFatalSignals: [],
      exceptionTypes: [],
      appFrames: [],
      jsErrorSeen: false,
    },
    processObservation: {
      startupPid: '321',
      processTableCandidateCount: 1,
      processTableCandidates: [
        {pid: 321, name: 'com.anonymous.sampleterminal', statStatus: 'READABLE', processState: 'S', startTicks: '9001'},
      ],
      startupPidStatus: 'READABLE',
    },
    exitInfo: {
      startupPid: '321',
      status: 'NO_PACKAGE_RECORD',
      packageRecordCount: 0,
      targetPidRecordCount: 0,
      records: [],
    },
    inspectedAt: '2026-09-24T00:00:00.000Z',
  };
  const manifest = validManifest();
  manifest.resolvedRemoteLaunches = [intent];
  manifest.launchLogReinspections = [inspection];
  return {manifest, intent, inspection};
}

test('runner requires explicit, distinct device identities and keeps fixed IA denominator', () => {
  assert.deepEqual(parseArgs(['prepare', '--run-id', 'vk-run-01', '--dual-serial', 'emulator-5554']), {
    positionals: ['prepare'],
    'run-id': 'vk-run-01',
    'dual-serial': 'emulator-5554',
  });
  const frames = emptyFrameMatrix();
  assert.deepEqual(Object.keys(frames), IA_IDS);
  assert.throws(() => parseArgs(['prepare', '--run-id', 'x', '--run-id', 'y']), /VK_ANDROID_ARGUMENT_INVALID/);
});

test('DEV tunnel route parser and package binding fail closed on stale or ambiguous inputs', () => {
  const devManifest = {
    kind: 'r5-dev-run-manifest',
    runId: 'r5-dev-1790993299237-49733-238c3e40-5f08-42d7-bbee-1ef78650882f',
    topology: {
      java: 'REMOTE_TRUSTED_HOST',
      tds: 'REMOTE_TRUSTED_HOST',
      haproxy: 'REMOTE_TRUSTED_HOST_HOST_NETWORK_LOOPBACK_ONLY',
    },
    tunnelPorts: {http: '28080', tds: '28180', tdsSecondary: '28181'},
    readiness: {
      remoteJava: {readiness: 'REMOTE_JAVA_SPRING_BOOT_STARTED_AFTER_FLYWAY'},
      remoteTdsNodes: ['tds-a', 'tds-b', 'tds-c'].map(nodeId => ({
        readiness: 'REMOTE_TDS_REACTIVE_WEBSOCKET_AND_DATABASE_LISTENER_READY',
        remoteIdentity: {nodeId},
      })),
      remoteHaproxy: {status: 'PASS'},
    },
  };
  const packageConfig = {
    serverSpaces: {
      selectedSpace: 'development',
      spaces: [
        {
          name: 'development',
          servers: [
            {
              serverName: 'business',
              addresses: [
                {addressName: 'primary', baseUrl: 'http://127.0.0.1:28080/api/terminal/group-workspaces/aurora'},
              ],
            },
            {
              serverName: 'terminal-data-server',
              addresses: [
                {addressName: 'haproxy-entry-one', baseUrl: 'ws://127.0.0.1:28180'},
                {addressName: 'haproxy-entry-two', baseUrl: 'ws://127.0.0.1:28181'},
              ],
            },
          ],
        },
      ],
    },
  };
  assert.deepEqual(runner.validateDevTunnelRouteInputs({appName: 'sample-terminal', packageConfig, devManifest}), [
    {devicePort: 28080, hostPort: 28080},
    {devicePort: 28180, hostPort: 28180},
    {devicePort: 28181, hostPort: 28181},
  ]);
  assert.deepEqual(runner.parseAdbReverseList('host-16 tcp:28080 tcp:28080\nhost tcp:28180 tcp:28180'), [
    {scope: 'host-16', deviceSocket: 'tcp:28080', hostSocket: 'tcp:28080'},
    {scope: 'host', deviceSocket: 'tcp:28180', hostSocket: 'tcp:28180'},
  ]);
  assert.throws(() => runner.parseAdbReverseList('host-16 tcp:28080'), /VK_ANDROID_DEV_TUNNEL_REVERSE_LIST_INVALID/);
  const stale = structuredClone(devManifest);
  stale.readiness.remoteTdsNodes.pop();
  assert.throws(
    () => runner.validateDevTunnelRouteInputs({appName: 'sample-terminal', packageConfig, devManifest: stale}),
    /VK_ANDROID_DEV_TUNNEL_DEV_NOT_READY/,
  );
  const duplicateNode = structuredClone(devManifest);
  duplicateNode.readiness.remoteTdsNodes[2].remoteIdentity.nodeId = 'tds-b';
  assert.throws(
    () => runner.validateDevTunnelRouteInputs({appName: 'sample-terminal', packageConfig, devManifest: duplicateNode}),
    /VK_ANDROID_DEV_TUNNEL_DEV_NOT_READY/,
  );
  const staleHaproxyPath = structuredClone(devManifest);
  staleHaproxyPath.remoteHaproxy = {status: 'PASS'};
  delete staleHaproxyPath.readiness.remoteHaproxy;
  assert.throws(
    () =>
      runner.validateDevTunnelRouteInputs({appName: 'sample-terminal', packageConfig, devManifest: staleHaproxyPath}),
    /VK_ANDROID_DEV_TUNNEL_DEV_NOT_READY/,
  );
  const wrongSpace = structuredClone(packageConfig);
  wrongSpace.serverSpaces.selectedSpace = 'production';
  assert.throws(
    () => runner.validateDevTunnelRouteInputs({appName: 'sample-terminal', packageConfig: wrongSpace, devManifest}),
    /VK_ANDROID_PACKAGE_DEVELOPMENT_SPACE_INVALID/,
  );
  const wrongTunnel = structuredClone(packageConfig);
  wrongTunnel.serverSpaces.spaces[0].servers[0].addresses[0].baseUrl =
    'http://127.0.0.1:7890/api/terminal/group-workspaces/aurora';
  assert.throws(
    () => runner.validateDevTunnelRouteInputs({appName: 'sample-terminal', packageConfig: wrongTunnel, devManifest}),
    /VK_ANDROID_PACKAGE_DEV_ADDRESS_MISMATCH/,
  );
});

test('old schema-2 manifests without DEV tunnel mappings remain valid, malformed additions do not', () => {
  const manifest = validManifest();
  assert.equal(Object.hasOwn(manifest, 'devTunnelMappings'), false);
  assert.equal(runner.validateRunManifest(manifest), true);
  manifest.devTunnelMappings = 'not-an-array';
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_INVALID/);
});

test('run manifest accepts only a recognized authorization label when the field is present', () => {
  const manifest = validManifest();
  manifest.authorization = 'TER_ACTIVATION_INTERACTION_PAIR_TOPOLOGY_IMPLEMENTATION';
  assert.equal(runner.validateRunManifest(manifest), true);
  manifest.authorization = 'UNRELATED_AUTHORIZATION';
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_RUN_AUTHORIZATION_INVALID/);
});

test('A11 W10 log parser binds new and legacy namespace facts to the exact launch intent', () => {
  const intentId = 'dual-sample-terminal-1234567890';
  const logs = [
    'I/TerminalPersistKv( 100): event=persist-kv operation=listKeys mode=protected status=succeeded',
    `I/TER-VK-LAUNCH( 101): intent=${intentId}`,
    'I/TerminalPersistKv( 102): event=persist-kv operation=listKeys mode=protected namespaceVersion=2 existedBeforeOpen=false legacyNamespacePresent=true',
    'I/TerminalPersistKv( 102): event=persist-kv operation=listKeys mode=protected status=succeeded',
  ].join('\n');
  assert.deepEqual(summarizePersistKvW10(logs, intentId, ['102']), {
    status: 'PASS',
    intentObserved: true,
    namespaceVersion: 2,
    newNamespaceExistedBeforeOpen: false,
    legacyNamespacePresent: true,
    operationSucceededAfterOpen: true,
    keyMismatchObserved: false,
  });
  const otherIntent = logs.replace(`intent=${intentId}`, 'intent=another-intent');
  assert.equal(summarizePersistKvW10(otherIntent, intentId, ['102']).status, 'LAUNCH_INTENT_NOT_FOUND');
  const unrelatedProcessOnly = logs
    .replaceAll('( 102)', '( 999)')
    .replace('I/TerminalPersistKv( 100):', 'I/TerminalPersistKv( 102):');
  assert.equal(
    summarizePersistKvW10(unrelatedProcessOnly, intentId, ['102']).status,
    'NEW_NAMESPACE_OBSERVATION_MISSING',
    'a marker from a PID outside the adopted app process set must not count',
  );
  assert.throws(() => summarizePersistKvW10(logs, intentId, []), /VK_ANDROID_A11_W10_APP_PROCESS_FILTER_INVALID/);
  const cases = [
    [
      'new namespace already existed',
      logs.replace('existedBeforeOpen=false', 'existedBeforeOpen=true'),
      'NEW_NAMESPACE_PREEXISTED',
    ],
    [
      'old namespace absent',
      logs.replace('legacyNamespacePresent=true', 'legacyNamespacePresent=false'),
      'LEGACY_NAMESPACE_NOT_PRESENT',
    ],
    [
      'protected operation did not succeed',
      logs.replace(
        'I/TerminalPersistKv( 102): event=persist-kv operation=listKeys mode=protected status=succeeded',
        'I/TerminalPersistKv( 102): event=persist-kv operation=listKeys mode=protected status=failed',
      ),
      'PROTECTED_OPERATION_NOT_SUCCEEDED',
    ],
    [
      'new namespace marker absent',
      logs.replace('namespaceVersion=2 ', 'namespaceVersion=3 '),
      'NEW_NAMESPACE_OBSERVATION_MISSING',
    ],
    [
      'identity mismatch observed',
      logs.replace('namespaceVersion=2 ', 'PERSIST_KV_PROTECTED_KEY_MISMATCH namespaceVersion=2 '),
      'PROTECTED_KEY_MISMATCH',
    ],
  ];
  for (const [label, value, expected] of cases)
    assert.equal(summarizePersistKvW10(value, intentId, ['102']).status, expected, label);
});

test('A11 W10 baseline binds the dynamically discovered devices and all four old APK markers', () => {
  const devices = {
    dual: {inventory: {serial: 'physical-device', bootId: 'boot-dual-12345678'}},
    mobile: {inventory: {serial: 'emulator-new-id', bootId: 'boot-mobile-12345678'}},
  };
  const markers = [
    ['dual', 'sample-terminal', 'physical-dual'],
    ['mobile', 'sample-terminal', 'mobile-vm'],
    ['dual', 'sample-wallpaper-terminal', 'physical-dual'],
    ['mobile', 'sample-wallpaper-terminal', 'mobile-vm'],
  ].map(([shape, appName, deviceRole]) => ({
    shape,
    appName,
    deviceRole,
    serial: devices[shape].inventory.serial,
    packageName:
      appName === 'sample-terminal' ? 'com.anonymous.sampleterminal' : 'com.catering.v2s.terminal.samplewallpaper',
    apkSha256: `${appName === 'sample-terminal' ? 'a' : 'b'}${shape === 'dual' ? 'c' : 'd'}`.repeat(32).slice(0, 64),
    sourceDigest: 'e'.repeat(64),
    status: 'CONFIRMED',
  }));
  const baseline = {
    runId: 'ter-a11-prechange-test01',
    status: 'PASS',
    business: 'PASS',
    cleanup: 'PASS',
    sourceDigest: 'e'.repeat(64),
    sourceFiles: ['apps/terminal/package.json'],
    markers,
    devices: {
      dual: {serial: 'physical-device', bootId: 'boot-dual-12345678'},
      mobile: {serial: 'emulator-new-id', bootId: 'boot-mobile-12345678'},
    },
  };
  const bound = validateA11BaselineManifest(baseline, devices);
  assert.deepEqual(Object.keys(bound.devices), ['dual', 'mobile']);
  assert.equal(bound.devices.mobile.serial, 'emulator-new-id');
  assert.equal(bound.markers.length, 4);
  assert.throws(
    () =>
      validateA11BaselineManifest(baseline, {
        ...devices,
        mobile: {inventory: {...devices.mobile.inventory, bootId: 'boot-recreated-12345678'}},
      }),
    /VK_ANDROID_A11_BASELINE_DEVICE_BINDING_MISMATCH/,
  );
  assert.throws(
    () => validateA11BaselineManifest({...baseline, markers: markers.slice(1)}, devices),
    /VK_ANDROID_A11_BASELINE_INVALID/,
  );

  const digest = createHash('sha256')
    .update(`apps/terminal/package.json\0${fs.readFileSync(path.join(root, 'apps/terminal/package.json'))}`)
    .digest('hex');
  const manifest = validManifest();
  manifest.appBindings['sample-wallpaper-terminal'] = {
    apkPath:
      'apps/terminal/application/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk',
    bytes: 256,
    sha256: 'f'.repeat(64),
    sourceDigest: digest,
  };
  manifest.appBindings['sample-terminal'].sourceDigest = digest;
  manifest.devices.dual.serial = devices.dual.inventory.serial;
  manifest.devices.dual.inventory = devices.dual.inventory;
  manifest.devices.mobile.serial = devices.mobile.inventory.serial;
  manifest.devices.mobile.inventory = devices.mobile.inventory;
  manifest.a11BaselineRunId = baseline.runId;
  manifest.a11Baseline = bound;
  manifest.a11W10SourceDigest = digest;
  manifest.persistKvW10Upgrades = [];
  manifest.persistKvW10PendingObservation = null;
  assert.equal(validateA11W10Action(manifest, 'launch', 'dual', 'sample-terminal'), true);
  assert.throws(
    () => validateA11W10Action(manifest, 'capture', 'dual', 'sample-terminal'),
    /VK_ANDROID_A11_W10_ACTION_NOT_ALLOWED/,
  );
  manifest.appBindings['sample-terminal'].sha256 = markers[0].apkSha256;
  assert.throws(
    () => validateA11W10Action(manifest, 'launch', 'dual', 'sample-terminal'),
    /VK_ANDROID_A11_W10_FINAL_RELEASE_BINDING_INVALID/,
  );

  manifest.appBindings['sample-terminal'].sha256 = 'f'.repeat(64);
  manifest.persistKvW10Upgrades = markers.map((marker, index) => {
    const appBinding = manifest.appBindings[marker.appName];
    return {
      shape: marker.shape,
      appName: marker.appName,
      packageName: marker.packageName,
      serial: devices[marker.shape].inventory.serial,
      bootId: devices[marker.shape].inventory.bootId,
      intentId: `w10-${marker.shape}-${index}`,
      oldApkSha256: marker.apkSha256,
      apkSha256: appBinding.sha256,
      sourceDigest: digest,
      installMode: 'install -r',
      namespaceVersion: 2,
      newNamespaceExistedBeforeOpen: false,
      legacyNamespacePresent: true,
      operationSucceededAfterOpen: true,
      keyMismatchObserved: false,
      observationStatus: 'PASS',
      observedAt: '2026-09-29T00:00:00.000Z',
    };
  });
  manifest.business = 'PASS';
  assert.equal(runner.validateRunManifest(manifest), true);
  manifest.persistKvW10Upgrades.pop();
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_A11_W10_DENOMINATOR_INVALID/);
});

test('successful Gradle output binds a nonempty APK by exact bytes without requiring mtime churn', () => {
  assert.equal(typeof runner.createAppBuildBinding, 'function');
  const bytes = Buffer.from('verified APK bytes');
  const binding = runner.createAppBuildBinding('apps/example/app-release.apk', bytes);
  assert.deepEqual(
    {apkPath: binding.apkPath, bytes: binding.bytes, sha256: binding.sha256},
    {
      apkPath: 'apps/example/app-release.apk',
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
  );
  assert.match(binding.builtAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.throws(
    () => runner.createAppBuildBinding('apps/example/app-release.apk', Buffer.alloc(0)),
    /VK_ANDROID_BUILD_ARTIFACT_INVALID/,
  );
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const build = source.slice(
    source.indexOf('async function buildApp('),
    source.indexOf('async function remoteProcessIdentity('),
  );
  assert.match(build, /createAppBuildBinding\(path\.relative\(ROOT, apk\), bytes\)/);
  assert.ok(runner.managedGradleBuildArgs('sample-terminal', 'release').includes('--rerun-tasks'));
  assert.ok(runner.managedGradleBuildArgs('sample-terminal', 'debug').includes('--rerun-tasks'));
  assert.match(build, /buildType === 'debug' \? debugFailureBuildEnvironment\(\) : releaseBuildEnvironment\(\)/);
  assert.doesNotMatch(build, /mtime|BUILD_ARTIFACT_NOT_REFRESHED/);
  assert.deepEqual(runner.debugFailureBuildEnvironment({NODE_ENV: 'development', CI: '1'}), {
    NODE_ENV: 'production',
    CI: '1',
    EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION: 'true',
  });
  assert.deepEqual(
    runner.releaseBuildEnvironment({
      NODE_ENV: 'development',
      CI: '1',
      EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION: 'true',
    }),
    {
      NODE_ENV: 'production',
      CI: '1',
      EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION: 'false',
    },
  );
});

test('managed Android build variant is explicit, path-bound, and cannot replace A11 release observation', () => {
  assert.deepEqual(runner.appBuildArtifact('sample-terminal', 'release'), {
    androidRoot: 'apps/terminal/application/android/sample-terminal/android',
    gradleTask: 'assembleRelease',
    apkPath: path.join(
      'apps/terminal/application/android/sample-terminal/android',
      'app/build/outputs/apk/release/app-release.apk',
    ),
    buildType: 'release',
  });
  assert.deepEqual(runner.appBuildArtifact('sample-terminal', 'debug'), {
    androidRoot: 'apps/terminal/application/android/sample-terminal/android',
    gradleTask: 'assembleDebug',
    apkPath: path.join(
      'apps/terminal/application/android/sample-terminal/android',
      'app/build/outputs/apk/debug/app-debug.apk',
    ),
    buildType: 'debug',
  });
  assert.throws(() => runner.appBuildArtifact('sample-terminal', 'profile'), /VK_ANDROID_BUILD_VARIANT_INVALID/);
  const manifest = validManifest();
  manifest.a11BaselineRunId = 'ter-a11-baseline';
  manifest.appBindings['sample-terminal'] = {
    apkPath: runner.appBuildArtifact('sample-terminal', 'debug').apkPath,
    bytes: 8,
    sha256: 'a'.repeat(64),
    buildType: 'debug',
  };
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_A11_W10_DEBUG_BUILD_FORBIDDEN/);
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const build = source.slice(
    source.indexOf('async function buildApp('),
    source.indexOf('async function remoteProcessIdentity('),
  );
  assert.match(
    source,
    /if \(action === 'build'\) return buildApp\(manifest, args\.app, args\['build-type'\] \?\? 'release'\)/,
  );
  assert.match(build, /manifest\.a11BaselineRunId && buildType !== 'release'/);
});

test('debug failure injection defaults off for local embedded bundles and remains opt-in for managed debug builds', () => {
  assert.equal(runner.isDebugFailureInjectionEnabled(false, undefined), false);
  assert.equal(runner.isDebugFailureInjectionEnabled(false, 'false'), false);
  assert.equal(runner.isDebugFailureInjectionEnabled(false, 'true'), true);
  assert.deepEqual(
    debugFailureInjectionIntentArgs(
      'com.anonymous.sampleterminal/com.anonymous.sampleterminal.MainActivity',
      'screen:sample.auth.login',
    ),
    [
      'shell',
      'am',
      'start',
      '-W',
      '-n',
      'com.anonymous.sampleterminal/com.anonymous.sampleterminal.MainActivity',
      '-a',
      'android.intent.action.VIEW',
      '-d',
      'ter-failure://inject/screen%3Asample.auth.login',
    ],
  );
  assert.deepEqual(
    debugFailureInjectionIntentArgs('com.anonymous.sampleterminal/com.anonymous.sampleterminal.MainActivity').slice(-2),
    ['-d', 'ter-failure://clear'],
  );
  assert.throws(
    () => debugFailureInjectionIntentArgs('not-an-activity', 'screen:x'),
    /VK_ANDROID_HARNESS_ACTIVITY_INVALID/,
  );
  assert.throws(
    () =>
      debugFailureInjectionIntentArgs(
        'com.anonymous.sampleterminal/com.anonymous.sampleterminal.MainActivity',
        'screen:bad target',
      ),
    /VK_ANDROID_DEBUG_FAILURE_OWNER_INVALID/,
  );

  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const installer = source.slice(
    source.indexOf('async function installLaunch('),
    source.indexOf('function screenshotPath('),
  );
  const dispatcher = source.slice(
    source.indexOf('async function dispatch('),
    source.indexOf('export function selfTest()'),
  );
  assert.match(installer, /initialFailureOwnerId !== null && binding\.buildType !== 'debug'/);
  assert.match(installer, /debugFailureInjectionIntentArgs\(app\.activity, initialFailureOwnerId\)/);
  assert.match(dispatcher, /args\['failure-owner'\] \?\? null/);
  assert.match(dispatcher, /action === 'clear-failure-injection'/);
  assert.match(dispatcher, /binding\?\.buildType !== 'debug'/);
  assert.match(dispatcher, /debugFailureInjectionIntentArgs\(app\.activity\)/);
  assert.match(dispatcher, /action === 'inspect-debug-failure-injection'/);
  const logInspector = source.slice(
    source.indexOf('async function inspectDebugFailureInjection('),
    source.indexOf('function launchAttemptLogLines('),
  );
  assert.match(logInspector, /requireOwnedApp\(manifest, shape, appName\)/);
  assert.match(logInspector, /remoteProcessIdentityMatches\(owned, observed, device\.serial\)/);
  assert.match(logInspector, /'ReactNativeJS:V'/);
  assert.match(logInspector, /diagnosticOutput: 'omit'/);

  for (const appName of ['sample-terminal', 'sample-wallpaper-terminal']) {
    const gradle = fs.readFileSync(
      path.join(root, 'apps/terminal/application/android', appName, 'android/app/build.gradle'),
      'utf8',
    );
    assert.match(gradle, /debuggableVariants\s*=\s*\[\]/);
    assert.match(
      gradle,
      /afterEvaluate\s*\{[\s\S]*?tasks\.named\("createBundleDebugJsAndAssets"\)[\s\S]*?task\.devEnabled\.set\(false\)/,
    );
    assert.match(gradle, /EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION/);
    assert.match(gradle, /TER_DEBUG_FAILURE_INJECTION_EMBEDDED_PRODUCTION_MODE/);
    assert.match(
      gradle,
      /def debugFailureInjectionEnabled\s*=\s*System\.getenv\("EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION"\)\s*==\s*"true"/,
    );
    assert.match(gradle, /task\.inputs\.property\("terDebugFailureInjection", debugFailureInjectionEnabled\)/);
    assert.match(gradle, /if\s*\(debugFailureInjectionEnabled\)/);
    assert.doesNotMatch(gradle, /TER_DEBUG_FAILURE_INJECTION_TEST_FLAG_REQUIRED/);
    assert.doesNotMatch(
      gradle,
      /TER_DEBUG_FAILURE_INJECTION_DEV_MODE_REQUIRED|TER_DEBUG_FAILURE_INJECTION_BUNDLE_DEV_ENABLED/,
    );
    assert.doesNotMatch(
      gradle,
      /if\s*\(task\.name\s*==\s*"createBundleReleaseJsAndAssets"\)\s*\{[^}]*devEnabled\.set\(true\)/,
    );
  }
});

test('runtime debug failure injection targets the owned singleTask activity without waiting for activity launch', () => {
  const activity = 'com.anonymous.sampleterminal/com.anonymous.sampleterminal.MainActivity';
  assert.deepEqual(debugFailureInjectionRuntimeIntentArgs(activity, 'surface-content'), [
    'shell',
    'am',
    'start',
    '-n',
    activity,
    '-a',
    'android.intent.action.VIEW',
    '-d',
    'ter-failure://inject/surface-content',
  ]);
  assert.throws(
    () => debugFailureInjectionRuntimeIntentArgs(activity, 'surface content'),
    /VK_ANDROID_DEBUG_FAILURE_OWNER_INVALID/,
  );
  assert.throws(
    () => debugFailureInjectionRuntimeIntentArgs('not-an-activity', 'surface-content'),
    /VK_ANDROID_HARNESS_ACTIVITY_INVALID/,
  );

  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const dispatcher = source.slice(
    source.indexOf('async function dispatch('),
    source.indexOf('export function selfTest()'),
  );
  const actionStart = dispatcher.indexOf("if (action === 'inject-debug-failure')");
  const actionEnd = dispatcher.indexOf("if (action === 'inspect-debug-failure-injection')", actionStart);
  assert.ok(actionStart >= 0 && actionEnd > actionStart);
  const action = dispatcher.slice(actionStart, actionEnd);
  assert.match(action, /binding\?\.buildType !== 'debug'/);
  assert.match(action, /requireOwnedApp\(manifest, args\.device, args\.app\)/);
  assert.match(action, /remoteProcessIdentityMatches\(owned, before, device\.serial\)/);
  assert.match(action, /remoteProcessIdentityMatches\(owned, after, device\.serial\)/);
  assert.match(action, /debugFailureInjectionRuntimeIntentArgs\(app\.activity, args\['failure-owner'\]\)/);
  assert.doesNotMatch(action, /['"]-W['"]/);
});

test('debug injection log summary is app-PID-bound and never retains raw URLs', () => {
  const logcat = [
    'I/ReactNativeJS( 4100): {"level":"info","category":"runtime.system-failure","event":"runtime.system-failure.debug-injection-resolution","message":"TER_DEBUG_FAILURE_INJECTION_RESOLUTION source=initial owner=screen:main:sample.desk.member-list outcome=matched","scope":{"moduleName":"ui-base-render"}}',
    'I/ReactNativeJS( 4200): {"level":"info","category":"runtime.system-failure","event":"runtime.system-failure.debug-injection-resolution","message":"TER_DEBUG_FAILURE_INJECTION_RESOLUTION source=initial owner=screen:main:sample.desk.member-list outcome=other-owner","scope":{"moduleName":"ui-base-render"}}',
    'I/ReactNativeJS( 4100): {"message":"ter-failure://inject/private"}',
  ].join('\n');
  const summary = summarizeDebugFailureInjectionLogcat(logcat, ['4100'], 'screen:main:sample.desk.member-list');

  assert.deepEqual(summary, {
    signalCount: 1,
    targetOwnerSignalCount: 1,
    targetOwnerOutcomes: ['matched'],
    observedOwners: ['screen:main:sample.desk.member-list'],
  });
  assert.doesNotMatch(JSON.stringify(summary), /ter-failure:\/\//);
  assert.throws(() => summarizeDebugFailureInjectionLogcat(logcat, [], 'screen:main:sample.desk.member-list'));
});

test('startup failure summary retains only allowlisted structured runtime events for the exact app PID', () => {
  const logcat = [
    '1790658953.100 11338 11338 I ReactNativeJS: {"level":"info","category":"runtime.system-failure","event":"runtime.system-failure.debug-injection-resolution","message":"TER_DEBUG_FAILURE_INJECTION_RESOLUTION source=initial owner=screen:main:sample.desk.member-list outcome=matched","data":{"ownerId":"screen:main:sample.desk.member-list","source":"initial","urlPresent":true,"outcome":"matched","rawUrl":"ter-failure://inject/private"}}',
    '1790658953.200 11338 11338 E ReactNativeJS: {"level":"error","category":"runtime.system-failure","event":"runtime.system-failure.render-failed","message":"A rendered terminal region failed","data":{"ownerId":"screen:main:sample.desk.member-list","errorName":"Error","exceptionMessage":"private payload"}}',
    '1790658953.300 11338 11338 I ReactNativeJS: {"level":"info","category":"startup.ready-candidate","event":"startup.ready-candidate","message":"Visible PRIMARY content failure completed its first layout","data":{"readyPartKey":"sample.desk.member-list","contentFailure":"render-error","surfaceKey":"PRIMARY","displayIndex":0,"layoutWidth":1280,"rawPayload":"private payload"}}',
    '1790658953.400 11999 11999 E ReactNativeJS: {"event":"runtime.system-failure.render-failed","data":{"ownerId":"screen:main:sample.desk.member-list","errorName":"OtherProcessError"}}',
  ].join('\n');

  const summary = runner.summarizeStructuredRuntimeDiagnostics(logcat, ['11338']);

  assert.deepEqual(summary, {
    eventCount: 3,
    events: [
      {
        event: 'debug-injection-resolution',
        ownerId: 'screen:main:sample.desk.member-list',
        source: 'initial',
        outcome: 'matched',
        urlPresent: true,
      },
      {
        event: 'render-failed',
        ownerId: 'screen:main:sample.desk.member-list',
        errorName: 'Error',
      },
      {
        event: 'startup-ready-candidate',
        readyPartKey: 'sample.desk.member-list',
        contentFailure: 'render-error',
        surfaceKey: 'PRIMARY',
        displayIndex: 0,
      },
    ],
  });
  assert.doesNotMatch(JSON.stringify(summary), /ter-failure:|private payload|rawPayload|rawUrl/);
});

test('JavaScript startup failure summary classifies exact-PID errors without retaining raw messages', () => {
  assert.equal(typeof runner.summarizeJavaScriptRuntimeErrors, 'function');
  const summary = runner.summarizeJavaScriptRuntimeErrors(
    [
      'E/ReactNativeJS( 22496): TypeError: password=secret token=secret-value',
      'E/ReactNativeJS( 22496): Error: TER_DEBUG_FAILURE_INJECTION',
      'E/ReactNativeJS( 99999): Invariant Violation: unrelated app',
      'E/AndroidRuntime( 22496): java.lang.IllegalStateException: native',
    ].join('\n'),
    ['22496'],
  );
  assert.deepEqual(summary, {errorCount: 2, kinds: ['INJECTED_FAILURE', 'JS_TYPE_ERROR']});
  assert.doesNotMatch(JSON.stringify(summary), /password|secret|token|unrelated/);
});

test('JavaScript startup diagnostics keep only safe error identity and bundle source-map coordinates', () => {
  assert.equal(typeof runner.summarizeJavaScriptRuntimeErrorDetails, 'function');
  const summary = runner.summarizeJavaScriptRuntimeErrorDetails(
    [
      'E/ReactNativeJS( 22496): Error: private payload token=secret-value',
      'I/ActivityManager( 1000): unrelated lifecycle event',
      'E/ReactNativeJS( 22496):     at start (address at index.android.bundle:1:9876)',
      'E/ReactNativeJS( 99999): TypeError: unrelated account phone=5551234567',
      'E/AndroidRuntime( 22496): java.lang.IllegalStateException: native failure',
    ].join('\n'),
    ['22496'],
  );

  assert.equal(summary.errors.length, 1);
  assert.equal(summary.errors[0].kind, 'JS_ERROR');
  assert.equal(summary.errors[0].errorName, 'Error');
  assert.equal(summary.errors[0].safeCode, null);
  assert.equal(summary.errors[0].safeMessage, '[SENSITIVE_DETAIL_REDACTED]');
  assert.equal(Object.hasOwn(summary.errors[0], 'messageSha256'), false);
  assert.deepEqual(summary.errors[0].bundleFrames, [{line: 1, column: 9876}]);
  assert.doesNotMatch(
    JSON.stringify(summary),
    /private payload|secret-value|unrelated account|5551234567|IllegalStateException/,
  );
});

test('resolved debug injection reinspection is APK, boot, launch-marker, and startup-PID bound', async () => {
  const manifest = validManifest();
  const intent = {
    intentId: 'dual-sample-terminal-debug-epoch-01',
    shape: 'dual',
    appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal',
    host: 'emulator-5554',
    bootId: 'boot-12345678',
    startedAt: '2026-09-29T04:59:32.749Z',
    resolvedAt: '2026-09-29T04:59:52.656Z',
    resolution: 'PROCESS_ABSENT',
    processCount: 0,
  };
  manifest.appBindings['sample-terminal'] = {
    apkPath: 'apps/terminal/application/android/sample-terminal/android/app/build/outputs/apk/debug/app-debug.apk',
    bytes: 123,
    sha256: 'b'.repeat(64),
    buildType: 'debug',
  };
  manifest.resolvedRemoteLaunches = [intent];
  manifest.launchDiagnostics = [
    {
      intentId: intent.intentId,
      shape: intent.shape,
      appName: intent.appName,
      packageName: intent.packageName,
      host: intent.host,
      bootId: intent.bootId,
      startupPid: '321',
    },
  ];

  const calls = [];
  const briefLogcat = [
    'I/ReactNativeJS( 321): Error: unrelated earlier event',
    'I/TER-VK-LAUNCH( 999): intent=other-launch',
    'I/ReactNativeJS( 654): TER_DEBUG_FAILURE_INJECTION_RESOLUTION source=initial owner=screen:main:sample.desk.member-list outcome=matched',
    `I/TER-VK-LAUNCH( 999): intent=${intent.intentId}`,
    'E/ReactNativeJS( 321): TypeError: password=secret token=secret-value',
    'I/ReactNativeJS( 321): TER_DEBUG_FAILURE_INJECTION_RESOLUTION source=initial owner=screen:main:sample.desk.member-list outcome=matched',
    'I/ReactNativeJS( 321): TER_DEBUG_FAILURE_INJECTION_RESOLUTION source=event owner=screen:main:sample.desk.member-list outcome=clear',
  ].join('\n');
  const summary = await runner.collectResolvedDebugFailureInjectionLogEvidence(
    manifest,
    intent.intentId,
    'screen:main:sample.desk.member-list',
    async (_manifest, device, label, args, options) => {
      calls.push({serial: device.serial, label, args, options});
      return label.endsWith('boot-id') ? intent.bootId : briefLogcat;
    },
  );

  assert.deepEqual(summary, {
    intentId: intent.intentId,
    host: intent.host,
    bootId: intent.bootId,
    apkSha256: 'b'.repeat(64),
    startupPid: '321',
    ownerId: 'screen:main:sample.desk.member-list',
    javascriptErrors: {errorCount: 1, kinds: ['JS_TYPE_ERROR']},
    javascriptErrorDetails: {
      errors: [
        {
          kind: 'JS_TYPE_ERROR',
          errorName: 'TypeError',
          safeCode: null,
          safeMessage: '[SENSITIVE_DETAIL_REDACTED]',
          bundleFrames: [],
        },
      ],
    },
    signalCount: 2,
    targetOwnerSignalCount: 2,
    targetOwnerOutcomes: ['matched', 'clear'],
    observedOwners: ['screen:main:sample.desk.member-list'],
  });
  assert.equal(Object.hasOwn(summary.javascriptErrorDetails.errors[0], 'messageSha256'), false);
  assert.doesNotMatch(JSON.stringify(summary.javascriptErrorDetails), /secret-value|password=|token=/i);
  assert.deepEqual(
    calls.map(call => call.label),
    [
      'dual-sample-terminal-resolved-debug-injection-pre-boot-id',
      'dual-sample-terminal-resolved-debug-injection-logcat',
      'dual-sample-terminal-resolved-debug-injection-post-boot-id',
    ],
  );
  assert.ok(calls.every(call => call.serial === intent.host));
  assert.deepEqual(calls[1].args, [
    'shell',
    'logcat',
    '-d',
    '-t',
    '2000',
    '-v',
    'brief',
    '-s',
    'TER-VK-LAUNCH:I',
    'ReactNativeJS:V',
  ]);
  assert.equal(calls[1].options?.diagnosticOutput, 'omit');
  assert.equal(JSON.stringify(summary).includes('ter-failure://'), false);

  const wrongBootCalls = [];
  await assert.rejects(
    () =>
      runner.collectResolvedDebugFailureInjectionLogEvidence(
        manifest,
        intent.intentId,
        'screen:main:sample.desk.member-list',
        async (_manifest, _device, label) => {
          wrongBootCalls.push(label);
          return 'boot-87654321';
        },
      ),
    /VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH/,
  );
  assert.deepEqual(wrongBootCalls, ['dual-sample-terminal-resolved-debug-injection-pre-boot-id']);
});

test('native-loading main-thread injection is bounded and requires a debug launch', () => {
  assert.deepEqual(
    debugNativeLoadingDelayIntentArgs('com.anonymous.sampleterminal/com.anonymous.sampleterminal.MainActivity', 2_300),
    [
      'shell',
      'am',
      'start',
      '-W',
      '-n',
      'com.anonymous.sampleterminal/com.anonymous.sampleterminal.MainActivity',
      '--el',
      'terminalDebugMainThreadDelayMs',
      '2300',
    ],
  );
  assert.throws(
    () => debugNativeLoadingDelayIntentArgs('not-an-activity', 2_300),
    /VK_ANDROID_HARNESS_ACTIVITY_INVALID/,
  );
  assert.throws(
    () =>
      debugNativeLoadingDelayIntentArgs(
        'com.anonymous.sampleterminal/com.anonymous.sampleterminal.MainActivity',
        2_000,
      ),
    /VK_ANDROID_NATIVE_LOADING_DELAY_INVALID/,
  );
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const installer = source.slice(
    source.indexOf('async function installLaunch('),
    source.indexOf('function screenshotPath('),
  );
  const dispatcher = source.slice(
    source.indexOf('async function dispatch('),
    source.indexOf('export function selfTest()'),
  );
  assert.match(installer, /nativeLoadingDelayMs !== null && binding\.buildType !== 'debug'/);
  assert.match(installer, /debugNativeLoadingDelayIntentArgs\(app\.activity, Number\(nativeLoadingDelayMs\)\)/);
  assert.match(installer, /nativeLoadingDelayMs !== null && initialFailureOwnerId !== null/);
  assert.match(dispatcher, /args\['native-loading-delay-ms'\]/);
});

test('managed debug bundles use embedded production mode with explicit test injection and native dev support disabled', () => {
  for (const appName of ['sample-terminal', 'sample-wallpaper-terminal']) {
    const applicationPackageDirectory =
      appName === 'sample-terminal' ? 'com/anonymous/sampleterminal' : 'com/catering/v2s/terminal/samplewallpaper';
    const gradle = fs.readFileSync(
      path.join(root, 'apps/terminal/application/android', appName, 'android/app/build.gradle'),
      'utf8',
    );
    const application = fs.readFileSync(
      path.join(
        root,
        'apps/terminal/application/android',
        appName,
        `android/app/src/main/java/${applicationPackageDirectory}`,
        'MainApplication.kt',
      ),
      'utf8',
    );
    assert.match(gradle, /terDisableNativeDevSupport/);
    assert.match(gradle, /buildConfigField\s+"boolean",\s+"TER_DISABLE_NATIVE_DEV_SUPPORT"/);
    assert.match(gradle, /task\.devEnabled\.set\(false\)/);
    assert.match(gradle, /TER_DEBUG_FAILURE_INJECTION_EMBEDDED_PRODUCTION_MODE/);
    assert.match(
      application,
      /useDevSupport\s*=\s*BuildConfig\.DEBUG\s*&&\s*!BuildConfig\.TER_DISABLE_NATIVE_DEV_SUPPORT/,
    );
  }
  assert.equal(
    runner.isDebugFailureInjectionEnabled(false, 'true'),
    true,
    'the managed embedded debug bundle enables only its explicit failure-injection flag',
  );
  assert.equal(runner.isDebugFailureInjectionEnabled(false, 'false'), false);
  assert.equal(runner.isDebugFailureInjectionEnabled(true, undefined), true);
  assert.ok(runner.managedGradleBuildArgs('sample-terminal', 'debug').includes('-PterDisableNativeDevSupport=true'));
  assert.ok(!runner.managedGradleBuildArgs('sample-terminal', 'release').includes('-PterDisableNativeDevSupport=true'));
});

test('report retains the full IA by app by VM-shape by surface observation denominator without visual false PASS', () => {
  const frames = emptyFrameMatrix();
  frames['VK-IA-01'].captures.push({
    shape: 'dual',
    app: 'sample-terminal',
    surface: 'primary',
    screenshot: 'evidence/one.png',
    captureEvidence: 'evidence/one.capture-evidence.json',
    state: 'stable',
    transitionIndex: null,
  });
  const matrix = captureObservationMatrix(frames);
  assert.deepEqual(Object.keys(matrix), IA_IDS);
  assert.equal(Object.keys(matrix['VK-IA-01'].routes).length, 8);
  assert.equal(matrix['VK-IA-01'].routes['dual/sample-terminal/primary'].status, 'CAPTURED_AWAITING_PER_CONTROL_AUDIT');
  assert.equal(matrix['VK-IA-01'].routes['dual/sample-terminal/primary'].perControlVisualAudit, 'OPEN');
  assert.equal(matrix['VK-IA-01'].routes['dual/sample-wallpaper-terminal/primary'].status, 'OPEN_NOT_OBSERVED');
  assert.equal(matrix['VK-IA-01'].routes['mobile/sample-terminal/primary'].status, 'NOT_APPLICABLE_FRAME_SHAPE');
  assert.equal(
    matrix['VK-IA-03'].routes['dual/sample-wallpaper-terminal/primary'].status,
    'NOT_COVERED_BY_PRODUCT_CONSUMER',
  );
  assert.equal(matrix['VK-IA-17'].routes['dual/sample-terminal/primary'].status, 'HARNESS_ONLY_NOT_PRODUCT');
  assert.equal(
    matrix['VK-IA-19'].routes['dual/sample-wallpaper-terminal/secondary'].status,
    'NOT_COVERED_BY_PRODUCT_CONSUMER',
  );
  assert.equal(matrix['VK-IA-01'].routes['mobile/sample-terminal/secondary'].status, 'NOT_APPLICABLE_DEVICE_SHAPE');
  assert.equal(
    matrix['VK-IA-11'].routes['dual/sample-terminal/primary'].controlRoster.some(
      item => item.controlId === 'sample.desk.member-form:cancel',
    ),
    true,
  );
  assert.equal(
    matrix['VK-IA-11'].routes['dual/sample-wallpaper-terminal/primary'].controlRoster.some(
      item => item.controlId === 'sample.desk.member-form:cancel',
    ),
    false,
  );
});

test('all 19 IA frames retain explicit per-control rosters and CP-0 product coverage classes', () => {
  const frames = emptyFrameMatrix();
  const matrix = captureObservationMatrix(frames);
  assert.equal(Object.keys(matrix).length, 19);
  for (const [iaId, frame] of Object.entries(matrix)) {
    assert.ok(frame.controlRoster.length > 0, `${iaId} must have at least one expected visual/control target`);
    assert.equal(
      new Set(frame.controlRoster.map(item => item.controlId)).size,
      frame.controlRoster.length,
      `${iaId} roster IDs must be unique`,
    );
    assert.equal(
      frame.controlRoster.every(item => item.status === 'OPEN' && item.reviewer === null),
      true,
    );
  }
  assert.equal(iaControlRoster('VK-IA-01').length, 41);
  assert.equal(iaControlRoster('VK-IA-03').length, 31);
  assert.equal(
    iaControlRoster('VK-IA-03').some(item => item.controlId === 'ui.base.input:virtual-keyboard:space'),
    true,
  );
  assert.equal(iaControlRoster('VK-IA-05').length, 13);
  assert.equal(iaControlRoster('VK-IA-07').length, 15);
  assert.equal(
    iaControlRoster('VK-IA-15').some(item => item.controlId === 'outgoing/ui.base.input:virtual-keyboard:text-1'),
    true,
  );
  assert.equal(
    iaControlRoster('VK-IA-15').some(item => item.controlId === 'incoming/ui.base.input:virtual-keyboard:text-a'),
    true,
  );
  assert.equal(classifyFrameRoute('VK-IA-13', 'dual', 'sample-terminal', 'secondary'), 'OPEN_PRODUCT_PATH_TO_CONFIRM');
  assert.equal(classifyFrameRoute('VK-IA-15', 'mobile', 'sample-terminal', 'primary'), 'NOT_APPLICABLE_FRAME_SHAPE');
  assert.equal(
    classifyFrameRoute('VK-IA-18', 'mobile', 'sample-wallpaper-terminal', 'primary'),
    'PRODUCT_CONSUMER_CANDIDATE',
  );
  assert.throws(() => iaControlRoster('VK-IA-99'), /VK_ANDROID_IA_ID_INVALID/);
});

test('per-control visual report includes every captured UI node and keeps all judgments OPEN by default', () => {
  const frames = emptyFrameMatrix();
  frames['VK-IA-01'].captures.push({
    shape: 'dual',
    app: 'sample-terminal',
    surface: 'primary',
    screenshot: 'evidence/one.png',
    visibleControls: [
      {
        nodeIndex: 0,
        resourceId: 'ui.base.input:virtual-keyboard:text-1',
        className: 'android.widget.Button',
        bounds: {left: 1, top: 2, right: 10, bottom: 11},
        hasText: false,
        hasContentDescription: true,
      },
      {
        nodeIndex: 1,
        resourceId: null,
        resourceIdSha256: 'c'.repeat(64),
        className: 'android.widget.TextView',
        bounds: null,
        hasText: false,
        hasContentDescription: false,
      },
    ],
  });
  const audit = perControlVisualAuditRows(frames);
  assert.equal(audit.length, 42);
  const observed = audit.find(row => row.controlId === 'ui.base.input:virtual-keyboard:text-1');
  assert.equal(observed?.presenceStatus, 'OBSERVED_AWAITING_VISUAL_JUDGMENT');
  assert.equal(observed?.observedResourceIds[0], 'ui.base.input:virtual-keyboard:text-1');
  assert.equal(
    audit.some(
      row =>
        row.controlId === 'ui.base.input:virtual-keyboard:text-2' &&
        row.presenceStatus === 'OPEN_EXPECTED_CONTROL_NOT_OBSERVED',
    ),
    true,
  );
  assert.equal(
    audit.some(row => row.controlId === 'unaddressed:android.widget.TextView:1:cccccccccccc'),
    true,
  );
  assert.equal(
    audit.every(row => row.visualStatus === 'OPEN' && row.reviewer === null),
    true,
  );
  assert.deepEqual(audit[0].visualDimensions, [
    'position',
    'size',
    'shape',
    'color',
    'icon',
    'font',
    'background',
    'text',
    'state',
    'hierarchy',
    'gap',
  ]);
});

test('prepare rejects a missing serial and duplicate dual/mobile identity before resource work', () => {
  assert.equal(typeof runner.validatePrepareOptions, 'function');
  assert.throws(
    () => runner.validatePrepareOptions({'run-id': 'vk-run-01', 'mobile-serial': 'emulator-5556'}),
    /VK_ANDROID_SERIAL_REQUIRED/,
  );
  assert.throws(
    () =>
      runner.validatePrepareOptions({
        'run-id': 'vk-run-01',
        'dual-serial': 'emulator-5554',
        'mobile-serial': 'emulator-5554',
      }),
    /VK_ANDROID_DEVICE_SERIALS_MUST_DIFFER/,
  );
  assert.deepEqual(
    runner.validatePrepareOptions({
      'run-id': 'vk-run-01',
      'dual-serial': 'emulator-5554',
      'mobile-serial': 'emulator-5556',
    }),
    {
      runId: 'vk-run-01',
      dualSerial: 'emulator-5554',
      mobileSerial: 'emulator-5556',
      a11BaselineRunId: null,
      authorization: 'TER_VIRTUAL_KEYBOARD_OPTIMIZATION_IMPLEMENTATION_CP4_DUAL_AND_MOBILE_ONLY',
    },
  );
  assert.equal(
    runner.validatePrepareOptions({
      'run-id': 'ter-pair-topology-01',
      'dual-serial': 'emulator-5554',
      'mobile-serial': 'emulator-5556',
      authorization: 'TER_ACTIVATION_INTERACTION_PAIR_TOPOLOGY_IMPLEMENTATION',
    }).authorization,
    'TER_ACTIVATION_INTERACTION_PAIR_TOPOLOGY_IMPLEMENTATION',
  );
  assert.throws(
    () =>
      runner.validatePrepareOptions({
        'run-id': 'ter-pair-topology-01',
        'dual-serial': 'emulator-5554',
        'mobile-serial': 'emulator-5556',
        authorization: 'ARBITRARY_AUTHORIZATION',
      }),
    /VK_ANDROID_RUN_AUTHORIZATION_INVALID/,
  );
  assert.equal(
    runner.validatePrepareOptions({
      'run-id': 'vk-run-01',
      'dual-serial': 'physical-dynamic-id',
      'mobile-serial': 'emulator-dynamic-id',
      'a11-baseline-run-id': 'ter-a11-prechange-test01',
    }).a11BaselineRunId,
    'ter-a11-prechange-test01',
  );
});

test('ADB device inventory accepts tab or space delimiters and excludes non-device states', () => {
  assert.equal(typeof runner.parseAdbDeviceList, 'function');
  if (typeof runner.parseAdbDeviceList !== 'function') return;
  const output = [
    'List of devices attached',
    'emulator-5554 device product:sdk_gtablet_arm64 model:Pixel_Tablet device:emu64a transport_id:1',
    'emulator-5556\tdevice product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:2',
    'emulator-5558 offline product:sdk_gphone64_arm64 model:sdk_gphone64_arm64',
    'emulator-5560 unauthorized product:sdk_gphone64_arm64 model:sdk_gphone64_arm64',
    '',
  ].join('\n');
  assert.deepEqual([...runner.parseAdbDeviceList(output).keys()], ['emulator-5554', 'emulator-5556']);
  const runnerSource = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const queryDevicesSource = runnerSource.slice(
    runnerSource.indexOf('async function queryDevices('),
    runnerSource.indexOf('async function inventoryDevice('),
  );
  assert.match(queryDevicesSource, /parseAdbDeviceList\(output\)/);
  assert.doesNotMatch(queryDevicesSource, /\\tdevice/);
});

test('Android process-table parser keeps exact package and colon sub-process identities', () => {
  assert.equal(typeof parseAndroidProcessTable, 'function');
  assert.deepEqual(
    parseAndroidProcessTable(
      [
        'PID NAME',
        '101 init',
        '202 com.anonymous.sampleterminal',
        '303 com.anonymous.sampleterminal:remote',
        '404 com.anonymous.sampleterminal.debug',
        '505 com.catering.v2s.terminal.samplewallpaper',
      ].join('\n'),
      'com.anonymous.sampleterminal',
    ),
    [
      {pid: 202, name: 'com.anonymous.sampleterminal'},
      {pid: 303, name: 'com.anonymous.sampleterminal:remote'},
    ],
  );
  assert.throws(
    () => parseAndroidProcessTable('USER PID CMD\nuser 202 app', 'com.anonymous.sampleterminal'),
    /VK_ANDROID_PROCESS_TABLE_INVALID/,
  );
  assert.throws(() => parseAndroidProcessTable('PID NAME\n202 com.unknown', 'com.unknown'), /VK_ANDROID_APP_INVALID/);
});

test('process observation keeps ps candidates whose proc stat disappeared', () => {
  const pkg = 'com.anonymous.sampleterminal';
  const statFields = ['S', '1', ...Array(17).fill('0'), '90210'];
  const result = runner.summarizeAndroidProcessObservation(
    ['PID NAME', `${4500} ${pkg}`, `${4501} ${pkg}:remote`, '4502 com.other.app'].join('\n'),
    pkg,
    new Map([
      ['4500', ''],
      ['4501', `4501 (${pkg}:remote) ${statFields.join(' ')}`],
    ]),
    '4500',
  );

  assert.deepEqual(result, {
    startupPid: '4500',
    processTableCandidateCount: 2,
    processTableCandidates: [
      {pid: 4500, name: pkg, statStatus: 'UNREADABLE', processState: null, startTicks: null},
      {pid: 4501, name: `${pkg}:remote`, statStatus: 'READABLE', processState: 'S', startTicks: '90210'},
    ],
    startupPidStatus: 'CANDIDATE_STAT_UNREADABLE',
  });
});

test('activity exit-info summary keeps exact target exit facts and drops descriptions', () => {
  const pkg = 'com.anonymous.sampleterminal';
  const evidence = runner.summarizeAndroidExitInfo(
    [
      'Historical Process Exit for uid 10234:',
      `  #0: ApplicationExitInfo(timestamp=2026-09-24 01:06:58, pid=4500, process=${pkg}, reason=6 (CRASH_NATIVE), subReason=0, status=11, description=private raw exception payload)`,
      '  #1: ApplicationExitInfo(timestamp=2026-09-24 01:05:00, pid=4499, process=com.other.app, reason=4 (USER_REQUESTED), status=0, description=ignore)',
    ].join('\n'),
    pkg,
    '4500',
  );

  assert.deepEqual(evidence, {
    startupPid: '4500',
    status: 'MATCHED',
    packageRecordCount: 1,
    targetPidRecordCount: 1,
    records: [{pid: 4500, reasonCode: 6, reasonName: 'CRASH_NATIVE', statusCode: 11}],
  });
  assert.doesNotMatch(JSON.stringify(evidence), /private raw exception payload|description/);
});

test('run manifest accepts only fixed app bindings and run-scoped remote temporary files', () => {
  assert.equal(typeof runner.validateRunManifest, 'function');
  assert.equal(runner.validateRunManifest(validManifest()), true);

  const wrongPackage = validManifest();
  wrongPackage.ownedRemoteProcesses.push({
    host: 'emulator-5554',
    bootId: 'boot-a',
    packageName: 'com.attacker/.Injected',
    appName: 'sample-terminal',
    shape: 'dual',
    processes: [{pid: 100, startTicks: '20'}],
  });
  assert.throws(() => runner.validateRunManifest(wrongPackage), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);

  const wrongPath = validManifest();
  wrongPath.appBindings['sample-terminal'].apkPath = '../../tmp/foreign.apk';
  assert.throws(() => runner.validateRunManifest(wrongPath), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);

  const historicalCleanup = validManifest();
  historicalCleanup.appBindings['sample-terminal'].apkPath =
    'apps/terminal/assembly/android/sample-terminal/android/app/build/outputs/apk/release/app-release.apk';
  assert.throws(() => runner.validateRunManifest(historicalCleanup), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  assert.equal(runner.validateRunManifest(historicalCleanup, {allowHistoricalApkPathsForCleanup: true}), true);
  const foreignHistoricalCleanup = validManifest();
  foreignHistoricalCleanup.appBindings['sample-terminal'].apkPath =
    'apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build/outputs/apk/release/app-release.apk';
  assert.throws(
    () => runner.validateRunManifest(foreignHistoricalCleanup, {allowHistoricalApkPathsForCleanup: true}),
    /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/,
  );

  const wrongTemporaryPath = validManifest();
  wrongTemporaryPath.remoteTempFiles.push({host: 'emulator-5554', path: '/sdcard/other-run-dual-1234567890123.xml'});
  assert.throws(() => runner.validateRunManifest(wrongTemporaryPath), /VK_ANDROID_MANIFEST_TEMP_PATH_INVALID/);

  const ownedRecorder = validManifest();
  ownedRecorder.ownedRemoteCaptureProcesses.push({
    shape: 'dual',
    host: 'emulator-5554',
    bootId: 'boot-id-123',
    executable: 'screenrecord',
    pid: 123,
    startTicks: '50',
    path: '/sdcard/vk-run-01-dual-1234567890123-transition.mp4',
  });
  ownedRecorder.remoteTempFiles.push({
    host: 'emulator-5554',
    path: '/sdcard/vk-run-01-dual-1234567890123-transition.mp4',
  });
  assert.equal(runner.validateRunManifest(ownedRecorder), true);
  const foreignRecorder = validManifest();
  foreignRecorder.ownedRemoteCaptureProcesses.push({
    shape: 'dual',
    host: 'emulator-5554',
    bootId: 'boot-id-123',
    executable: 'screenrecord',
    pid: 123,
    startTicks: '50',
    path: '/sdcard/foreign-dual-1234567890123-transition.mp4',
  });
  assert.throws(() => runner.validateRunManifest(foreignRecorder), /VK_ANDROID_REMOTE_CAPTURE_IDENTITY_INVALID/);
});

test('remote process identity includes the bound device serial, boot and complete PID/start-tick set', () => {
  assert.equal(typeof runner.remoteProcessIdentityMatches, 'function');
  const expected = {host: 'emulator-5554', bootId: 'boot-a', processes: [{pid: 101, startTicks: '900'}]};
  assert.equal(runner.remoteProcessIdentityMatches(expected, expected, 'emulator-5554'), true);
  assert.equal(runner.remoteProcessIdentityMatches(expected, expected, 'emulator-5556'), false);
  assert.equal(runner.remoteProcessIdentityMatches(expected, {...expected, bootId: 'boot-b'}, 'emulator-5554'), false);
  assert.equal(runner.remoteProcessIdentityMatches(expected, {...expected, processes: []}, 'emulator-5554'), false);
});

test('cleanup terminates only a still-live local command with matching PID, PGID and start token', async () => {
  assert.equal(typeof runner.cleanupRecordedLocalCommand, 'function');
  const manifest = {activeProcessIdentity: {pid: 42, pgid: 42, startToken: 'Mon Sep 21 10:11:12 2026'}};
  let terminateCalls = 0;
  let rows = [{pid: 42, pgid: 42, startToken: 'Mon Sep 21 10:11:12 2026'}];
  const matched = await runner.cleanupRecordedLocalCommand(manifest, {
    readTable: () => rows,
    terminate: async identity => {
      terminateCalls += 1;
      assert.deepEqual(identity, manifest.activeProcessIdentity);
      rows = [];
      return {status: 'PASS', treeReadback: []};
    },
  });
  assert.equal(matched.status, 'PASS');
  assert.equal(terminateCalls, 1);
  assert.equal(manifest.activeProcessIdentity, null);

  const reused = {activeProcessIdentity: {pid: 42, pgid: 42, startToken: 'old-process'}};
  terminateCalls = 0;
  const rejected = await runner.cleanupRecordedLocalCommand(reused, {
    readTable: () => [{pid: 42, pgid: 42, startToken: 'new-process'}],
    terminate: async () => {
      terminateCalls += 1;
      return {status: 'PASS', treeReadback: []};
    },
  });
  assert.equal(rejected.status, 'FAIL');
  assert.equal(terminateCalls, 0);

  const exitedCommandWithLiveRunner = {
    activeProcessIdentity: {pid: 42, pgid: 42, startToken: 'old-command'},
    processes: [{pid: 7, pgid: 7, startToken: 'live-runner', commandLabel: 'managed-runner'}],
  };
  const runnerStillLive = await runner.cleanupRecordedLocalCommand(exitedCommandWithLiveRunner, {
    readTable: () => [{pid: 7, pgid: 7, startToken: 'live-runner'}],
    terminate: async () => {
      throw new Error('must-not-terminate-unowned-runner-group');
    },
  });
  assert.deepEqual(runnerStillLive, {status: 'FAIL', reason: 'VK_ANDROID_LOCAL_RUNNER_STILL_LIVE'});
});

test('pending remote launch survives a failed readback so cleanup cannot report false PASS', async () => {
  assert.equal(typeof runner.launchWithPendingOwnership, 'function');
  const manifest = {devices: {dual: {serial: 'emulator-5554'}}, pendingRemoteLaunches: [], ownedRemoteProcesses: []};
  const order = [];
  await assert.rejects(
    () =>
      runner.launchWithPendingOwnership(
        manifest,
        {
          host: 'emulator-5554',
          bootId: 'boot-a',
          packageName: 'com.anonymous.sampleterminal',
          appName: 'sample-terminal',
          shape: 'dual',
          intentId: 'launch-01',
        },
        {
          persist: async () => {
            order.push(`persist:${manifest.pendingRemoteLaunches.length}`);
          },
          launch: async () => {
            order.push(`launch:${manifest.pendingRemoteLaunches.length}`);
          },
          readback: async () => {
            order.push(`readback:${manifest.pendingRemoteLaunches.length}`);
            throw new Error('readback-failed');
          },
        },
      ),
    /readback-failed/,
  );
  assert.deepEqual(order, ['persist:1', 'launch:1', 'readback:1']);
  assert.equal(manifest.pendingRemoteLaunches.length, 1);
  assert.equal(manifest.ownedRemoteProcesses.length, 0);
});

test('successful pending remote launch records the resolved intent and owned process exactly once', async () => {
  const manifest = {devices: {dual: {serial: 'emulator-5554'}}, pendingRemoteLaunches: [], ownedRemoteProcesses: []};
  const intent = {
    host: 'emulator-5554',
    bootId: 'boot-a',
    packageName: 'com.anonymous.sampleterminal',
    appName: 'sample-terminal',
    shape: 'dual',
    intentId: 'launch-adopted-01',
  };
  await runner.launchWithPendingOwnership(manifest, intent, {
    persist: async () => {},
    launch: async () => {},
    readback: async () => ({
      host: intent.host,
      bootId: intent.bootId,
      processes: [{pid: 8700, startTicks: '1305669748'}],
    }),
  });

  assert.deepEqual(manifest.pendingRemoteLaunches, []);
  assert.equal(manifest.resolvedRemoteLaunches?.length, 1);
  assert.equal(manifest.resolvedRemoteLaunches[0].intentId, intent.intentId);
  assert.equal(manifest.resolvedRemoteLaunches[0].resolution, 'PROCESS_ADOPTED');
  assert.equal(manifest.resolvedRemoteLaunches[0].processCount, 1);
  assert.equal(manifest.ownedRemoteProcesses.length, 1);
  assert.equal(manifest.ownedRemoteProcesses[0].processes[0].pid, 8700);
});

test('W10 launch adoption and observation readiness are persisted as one transition', async () => {
  const intent = {
    host: 'device-dual-01',
    bootId: 'boot-a',
    packageName: 'com.anonymous.sampleterminal',
    appName: 'sample-terminal',
    shape: 'dual',
    intentId: 'launch-w10-atomic-01',
  };
  const manifest = {
    devices: {dual: {serial: intent.host}},
    pendingRemoteLaunches: [],
    ownedRemoteProcesses: [],
    resolvedRemoteLaunches: [],
    persistKvW10PendingObservation: {intentId: intent.intentId, launchResolved: false},
  };
  const persisted = [];
  await runner.launchWithPendingOwnership(manifest, intent, {
    persist: async () => {
      persisted.push(
        structuredClone({
          pendingRemoteLaunches: manifest.pendingRemoteLaunches,
          resolvedRemoteLaunches: manifest.resolvedRemoteLaunches,
          ownedRemoteProcesses: manifest.ownedRemoteProcesses,
          launchResolved: manifest.persistKvW10PendingObservation.launchResolved,
        }),
      );
    },
    launch: async () => {},
    readback: async () => ({
      host: intent.host,
      bootId: intent.bootId,
      processes: [{pid: 8700, startTicks: '1305669748'}],
    }),
  });

  assert.equal(persisted.length, 2);
  assert.equal(persisted[0].launchResolved, false);
  assert.deepEqual(
    persisted[0].pendingRemoteLaunches.map(item => item.intentId),
    [intent.intentId],
  );
  assert.equal(persisted[1].launchResolved, true);
  assert.deepEqual(persisted[1].pendingRemoteLaunches, []);
  assert.equal(persisted[1].resolvedRemoteLaunches[0].intentId, intent.intentId);
  assert.equal(persisted[1].resolvedRemoteLaunches[0].resolution, 'PROCESS_ADOPTED');
  assert.equal(persisted[1].ownedRemoteProcesses[0].processes[0].pid, 8700);
});

test('W10 observation does not shadow the runner stdout binding with app process identity', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const observation = source.slice(
    source.indexOf('async function observeA11W10('),
    source.indexOf('function screenshotPath('),
  );
  assert.doesNotMatch(observation, /\b(?:const|let|var)\s+process\b/);
  assert.match(observation, /process\.stdout\.write\(/);
});

test('managed cleanup recovers only runner-recorded invalidated app ownership on the same host and boot', () => {
  const makeManifest = ({
    startupPid = null,
    resolution = 'PROCESS_ABSENT',
    markers = ['activity.onCreate:start'],
  } = {}) => {
    const manifest = validManifest();
    const bootId = 'boot-recovery-12345678';
    manifest.devices.dual.inventory = {bootId};
    const intent = {
      intentId: 'dual-sample-terminal-recovery-01',
      shape: 'dual',
      appName: 'sample-terminal',
      packageName: 'com.anonymous.sampleterminal',
      host: 'emulator-5554',
      bootId,
      startedAt: '2026-09-24T00:00:00Z',
      resolution,
      processCount: 0,
    };
    manifest.resolvedRemoteLaunches = [{...intent}];
    manifest.launchDiagnostics = [
      {
        intentId: intent.intentId,
        shape: intent.shape,
        appName: intent.appName,
        packageName: intent.packageName,
        host: intent.host,
        bootId: intent.bootId,
        startupPid: startupPid == null ? null : String(startupPid),
        observedMarkers: markers,
        markerCount: markers.length,
      },
    ];
    return {manifest, intent};
  };

  const {manifest, intent} = makeManifest({startupPid: 4500});
  assert.equal(
    runner.resolveInvalidatedRemoteLaunch(
      manifest,
      intent.intentId,
      {
        host: intent.host,
        bootId: intent.bootId,
        processes: [{pid: 4500, startTicks: '90123'}],
      },
      '2026-09-24T03:00:00Z',
    ),
    'PROCESS_ADOPTED',
  );
  assert.deepEqual(manifest.ownedRemoteProcesses, [
    {
      host: intent.host,
      bootId: intent.bootId,
      processes: [{pid: 4500, startTicks: '90123'}],
      packageName: intent.packageName,
      appName: intent.appName,
      shape: intent.shape,
    },
  ]);
  assert.equal(manifest.historicalRemoteLaunchRecoveries[0].resolution, 'PROCESS_ADOPTED');
  assert.equal(runner.validateRunManifest(manifest), true);

  const absent = makeManifest();
  assert.equal(
    runner.resolveInvalidatedRemoteLaunch(
      absent.manifest,
      absent.intent.intentId,
      {
        host: absent.intent.host,
        bootId: absent.intent.bootId,
        processes: [],
      },
      '2026-09-24T03:00:01Z',
    ),
    'PROCESS_ABSENT',
  );
  assert.equal(absent.manifest.ownedRemoteProcesses.length, 0);
  assert.equal(runner.validateRunManifest(absent.manifest), true);

  const invalidReadbacks = [
    {host: intent.host, bootId: 'other-boot-12345678', processes: []},
    {host: 'emulator-5556', bootId: intent.bootId, processes: []},
    {host: intent.host, bootId: intent.bootId, processes: [{pid: 4501, startTicks: '90123'}]},
    {host: intent.host, bootId: intent.bootId, processes: [{pid: 4500, startTicks: 'bad'}]},
  ];
  for (const observed of invalidReadbacks) {
    const invalid = makeManifest({startupPid: 4500});
    assert.throws(
      () => runner.resolveInvalidatedRemoteLaunch(invalid.manifest, invalid.intent.intentId, observed),
      /VK_ANDROID_HISTORICAL_LAUNCH_IDENTITY_MISMATCH/,
    );
    assert.equal(invalid.manifest.ownedRemoteProcesses.length, 0);
    assert.equal(invalid.manifest.historicalRemoteLaunchRecoveries, undefined);
  }
  for (const invalid of [
    makeManifest({resolution: 'PROCESS_ADOPTED'}),
    makeManifest({markers: []}),
    makeManifest({markers: ['untrusted.launch-marker']}),
    makeManifest({markers: ['activity.onCreate:start', 'activity.onCreate:start']}),
  ]) {
    assert.throws(
      () =>
        runner.resolveInvalidatedRemoteLaunch(invalid.manifest, invalid.intent.intentId, {
          host: invalid.intent.host,
          bootId: invalid.intent.bootId,
          processes: [],
        }),
      /VK_ANDROID_HISTORICAL_LAUNCH_IDENTITY_MISMATCH/,
    );
    assert.equal(invalid.manifest.ownedRemoteProcesses.length, 0);
  }

  const mismatchedMarkerCount = makeManifest();
  mismatchedMarkerCount.manifest.launchDiagnostics[0].markerCount = 2;
  assert.throws(
    () => runner.validateRunManifest(mismatchedMarkerCount.manifest),
    /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/,
  );

  const mismatchedDiagnosticIdentity = makeManifest();
  mismatchedDiagnosticIdentity.manifest.launchDiagnostics[0].bootId = 'other-boot-12345678';
  assert.throws(
    () =>
      runner.resolveInvalidatedRemoteLaunch(
        mismatchedDiagnosticIdentity.manifest,
        mismatchedDiagnosticIdentity.intent.intentId,
        {
          host: mismatchedDiagnosticIdentity.intent.host,
          bootId: mismatchedDiagnosticIdentity.intent.bootId,
          processes: [],
        },
      ),
    /VK_ANDROID_HISTORICAL_LAUNCH_IDENTITY_MISMATCH/,
  );

  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const recovery = source.slice(
    source.indexOf('async function recoverInvalidatedLaunchOwnership('),
    source.indexOf('async function doCleanup('),
  );
  assert.match(recovery, /remoteProcessIdentity\(manifest, device, intent\.packageName\)/);
  assert.match(recovery, /resolveInvalidatedRemoteLaunch\(manifest, intent\.intentId, observed\)/);
  assert.match(recovery, /doCleanup\(manifest\)/);
  assert.match(source, /args\['recover-invalidated-launches'\] === 'yes'/);
});

test('unresolved launch reports a bounded diagnostic callback before preserving failure ownership', async () => {
  const manifest = {devices: {dual: {serial: 'emulator-5554'}}, pendingRemoteLaunches: [], ownedRemoteProcesses: []};
  const notices = [];
  await assert.rejects(
    () =>
      runner.launchWithPendingOwnership(
        manifest,
        {
          host: 'emulator-5554',
          bootId: 'boot-a',
          packageName: 'com.anonymous.sampleterminal',
          appName: 'sample-terminal',
          shape: 'dual',
          intentId: 'launch-capture-01',
        },
        {
          persist: async () => {},
          launch: async () => {},
          readback: async () => ({host: 'emulator-5554', bootId: 'boot-a', processes: []}),
          onLaunchFailure: async notice => {
            notices.push(notice);
          },
        },
      ),
    /VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED/,
  );
  assert.deepEqual(notices, [
    {
      intentId: 'launch-capture-01',
      stage: 'ownership-readback',
      failureCode: 'VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED',
    },
  ]);
  assert.equal(manifest.pendingRemoteLaunches.length, 1);
  assert.equal(manifest.ownedRemoteProcesses.length, 0);

  const errorManifest = {
    devices: {dual: {serial: 'emulator-5554'}},
    pendingRemoteLaunches: [],
    ownedRemoteProcesses: [],
  };
  const errorNotices = [];
  await assert.rejects(
    () =>
      runner.launchWithPendingOwnership(
        errorManifest,
        {
          host: 'emulator-5554',
          bootId: 'boot-a',
          packageName: 'com.anonymous.sampleterminal',
          appName: 'sample-terminal',
          shape: 'dual',
          intentId: 'launch-capture-02',
        },
        {
          persist: async () => {},
          launch: async () => {},
          readback: async () => {
            throw new Error('raw readback detail must not enter callback');
          },
          onLaunchFailure: async notice => {
            errorNotices.push(notice);
          },
        },
      ),
    /raw readback detail must not enter callback/,
  );
  assert.deepEqual(errorNotices, [
    {
      intentId: 'launch-capture-02',
      stage: 'process-readback',
      failureCode: 'VK_ANDROID_REMOTE_PROCESS_READBACK_FAILED',
    },
  ]);
  assert.equal(errorManifest.pendingRemoteLaunches.length, 1);
  assert.equal(errorManifest.ownedRemoteProcesses.length, 0);

  const launchErrorManifest = {
    devices: {dual: {serial: 'emulator-5554'}},
    pendingRemoteLaunches: [],
    ownedRemoteProcesses: [],
  };
  const launchErrorNotices = [];
  await assert.rejects(
    () =>
      runner.launchWithPendingOwnership(
        launchErrorManifest,
        {
          host: 'emulator-5554',
          bootId: 'boot-a',
          packageName: 'com.anonymous.sampleterminal',
          appName: 'sample-terminal',
          shape: 'dual',
          intentId: 'launch-capture-03',
        },
        {
          persist: async () => {},
          launch: async () => {
            throw new Error('VK_ANDROID_ACTIVITY_LAUNCH_FAILED');
          },
          readback: async () => {
            throw new Error('readback must not be reached');
          },
          onLaunchFailure: async notice => {
            launchErrorNotices.push(notice);
          },
        },
      ),
    /VK_ANDROID_ACTIVITY_LAUNCH_FAILED/,
  );
  assert.deepEqual(launchErrorNotices, [
    {intentId: 'launch-capture-03', stage: 'activity-launch', failureCode: 'VK_ANDROID_ACTIVITY_LAUNCH_FAILED'},
  ]);
  assert.equal(launchErrorManifest.pendingRemoteLaunches.length, 1);
  assert.equal(launchErrorManifest.ownedRemoteProcesses.length, 0);
});

test('launch diagnostic callback failure cannot replace the original launch failure', async () => {
  const manifest = {devices: {dual: {serial: 'emulator-5554'}}, pendingRemoteLaunches: [], ownedRemoteProcesses: []};
  await assert.rejects(
    () =>
      runner.launchWithPendingOwnership(
        manifest,
        {
          host: 'emulator-5554',
          bootId: 'boot-a',
          packageName: 'com.anonymous.sampleterminal',
          appName: 'sample-terminal',
          shape: 'dual',
          intentId: 'launch-capture-callback-fails',
        },
        {
          persist: async () => {},
          launch: async () => {},
          readback: async () => ({host: 'emulator-5554', bootId: 'boot-a', processes: []}),
          onLaunchFailure: async () => {
            throw new Error('diagnostic-write-failed');
          },
        },
      ),
    /VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED/,
  );
  assert.equal(manifest.pendingRemoteLaunches.length, 1);
  assert.equal(manifest.ownedRemoteProcesses.length, 0);
});

test('launch crash diagnostics expose only package-bound failure facts and reconcile exact pending ownership', () => {
  assert.equal(typeof runner.summarizeAndroidLaunchDiagnostics, 'function');
  assert.equal(typeof runner.resolvePendingRemoteLaunch, 'function');
  const summary = runner.summarizeAndroidLaunchDiagnostics(
    [
      'E/AndroidRuntime( 100): FATAL EXCEPTION: main',
      'E/AndroidRuntime( 100): Process: com.anonymous.sampleterminal, PID: 100',
      'E/AndroidRuntime( 100): java.lang.RuntimeException: password=secret token=abc 192.168.1.2',
      'E/AndroidRuntime( 100):     at com.anonymous.sampleterminal.MainActivity.onCreate(MainActivity.kt:42)',
      'E/AndroidRuntime( 100): Process: com.other.app, PID: 200',
      'E/AndroidRuntime( 200): java.lang.IllegalStateException: unrelated',
    ].join('\n'),
    'com.anonymous.sampleterminal',
    '100',
  );
  assert.deepEqual(summary, {
    fatalException: true,
    processDied: false,
    nativeFatalSignals: [],
    exceptionTypes: ['java.lang.RuntimeException'],
    appFrames: [{className: 'com.anonymous.sampleterminal.MainActivity', location: 'MainActivity.kt:42'}],
    jsErrorSeen: false,
  });

  const processDeathForOtherPid = runner.summarizeAndroidLaunchDiagnostics(
    [
      'E/AndroidRuntime( 100): Process: com.anonymous.sampleterminal, PID: 100',
      'E/ActivityManager( 1): Process com.anonymous.sampleterminal (pid 200) has died: fg TOP',
    ].join('\n'),
    'com.anonymous.sampleterminal',
    '100',
  );
  assert.equal(processDeathForOtherPid.processDied, false);
  const processDeathForPackagePrefix = runner.summarizeAndroidLaunchDiagnostics(
    [
      'E/AndroidRuntime( 100): Process: com.anonymous.sampleterminal, PID: 100',
      'E/ActivityManager( 1): Process com.anonymous.sampleterminal.debug (pid 100) has died: fg TOP',
    ].join('\n'),
    'com.anonymous.sampleterminal',
    '100',
  );
  assert.equal(processDeathForPackagePrefix.processDied, false);
  const processDeathForTargetPid = runner.summarizeAndroidLaunchDiagnostics(
    [
      'E/AndroidRuntime( 100): Process: com.anonymous.sampleterminal, PID: 100',
      'E/ActivityManager( 1): Process com.anonymous.sampleterminal (pid 100) has died: fg TOP',
    ].join('\n'),
    'com.anonymous.sampleterminal',
    '100',
  );
  assert.equal(processDeathForTargetPid.processDied, true);
  const processDeathFromStartupBreadcrumbPid = runner.summarizeAndroidLaunchDiagnostics(
    [
      'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
      'I/ActivityManager( 1): Process com.anonymous.sampleterminal (pid 321) has died: vis +30s',
    ].join('\n'),
    'com.anonymous.sampleterminal',
    '321',
  );
  assert.equal(processDeathFromStartupBreadcrumbPid.processDied, true);
  const processDeathForOtherStartupPid = runner.summarizeAndroidLaunchDiagnostics(
    [
      'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
      'I/ActivityManager( 1): Process com.anonymous.sampleterminal (pid 654) has died: vis +30s',
    ].join('\n'),
    'com.anonymous.sampleterminal',
    '321',
  );
  assert.equal(processDeathForOtherStartupPid.processDied, false);
  const staleProcessDeathBeforeLatestLaunch = runner.summarizeAndroidLaunchDiagnostics(
    [
      'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
      'I/ActivityManager( 1): Process com.anonymous.sampleterminal (pid 321) has died: vis +30s',
      'I/TER-Splash( 654): event=activity.onCreate phase=start app=sample-terminal',
    ].join('\n'),
    'com.anonymous.sampleterminal',
    '654',
  );
  assert.equal(staleProcessDeathBeforeLatestLaunch.processDied, false);

  const nativeCrashForTarget = runner.summarizeAndroidLaunchDiagnostics(
    [
      'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
      'F/DEBUG( 999): Cmdline: com.anonymous.sampleterminal',
      'F/DEBUG( 999): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
      'F/DEBUG( 999): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
    ].join('\n'),
    'com.anonymous.sampleterminal',
    '321',
  );
  assert.deepEqual(nativeCrashForTarget.nativeFatalSignals, ['SIGSEGV']);
  const nativeCrashForOtherPid = runner.summarizeAndroidLaunchDiagnostics(
    [
      'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
      'F/DEBUG( 999): Cmdline: com.anonymous.sampleterminal',
      'F/DEBUG( 999): pid: 654, tid: 654, name: main >>> com.anonymous.sampleterminal <<<',
      'F/DEBUG( 999): signal 6 (SIGABRT), code -1 (SI_QUEUE)',
    ].join('\n'),
    'com.anonymous.sampleterminal',
    '321',
  );
  assert.deepEqual(nativeCrashForOtherPid.nativeFatalSignals, []);
  const nativeCrashForPackagePrefix = runner.summarizeAndroidLaunchDiagnostics(
    [
      'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
      'F/DEBUG( 999): Cmdline: com.anonymous.sampleterminal.debug',
      'F/DEBUG( 999): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal.debug <<<',
      'F/DEBUG( 999): signal 6 (SIGABRT), code -1 (SI_QUEUE)',
    ].join('\n'),
    'com.anonymous.sampleterminal',
    '321',
  );

  const nativeCrashWithoutExactLaunchPid = runner.summarizeAndroidLaunchDiagnostics(
    [
      'E/AndroidRuntime( 654): Process: com.anonymous.sampleterminal, PID: 654',
      'F/DEBUG( 999): Cmdline: com.anonymous.sampleterminal',
      'F/DEBUG( 999): pid: 654, tid: 654, name: main >>> com.anonymous.sampleterminal <<<',
      'F/DEBUG( 999): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
    ].join('\n'),
    'com.anonymous.sampleterminal',
  );
  assert.deepEqual(nativeCrashWithoutExactLaunchPid.nativeFatalSignals, []);
  const nativeCrashWithUnknownSignal = runner.summarizeAndroidLaunchDiagnostics(
    [
      'F/DEBUG( 999): Cmdline: com.anonymous.sampleterminal',
      'F/DEBUG( 999): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
      'F/DEBUG( 999): signal 11 (SIGNOTREAL), code 1 (UNKNOWN)',
    ].join('\n'),
    'com.anonymous.sampleterminal',
    '321',
  );
  assert.deepEqual(nativeCrashWithUnknownSignal.nativeFatalSignals, []);
  assert.deepEqual(nativeCrashForPackagePrefix.nativeFatalSignals, []);
  const nativeCrashEvidenceAcrossSeparateDumps = runner.summarizeAndroidLaunchDiagnostics(
    [
      'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
      'F/DEBUG( 999): *** *** *** *** *** *** *** *** *** *** *** *** *** *** *** ***',
      'F/DEBUG( 999): Cmdline: com.anonymous.sampleterminal',
      'F/DEBUG( 999): pid: 654, tid: 654, name: main >>> com.anonymous.sampleterminal <<<',
      'F/DEBUG( 998): *** *** *** *** *** *** *** *** *** *** *** *** *** *** *** ***',
      'F/DEBUG( 998): Cmdline: com.other.process',
      'F/DEBUG( 998): pid: 321, tid: 321, name: main >>> com.other.process <<<',
      'F/DEBUG( 998): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
    ].join('\n'),
    'com.anonymous.sampleterminal',
  );
  assert.deepEqual(nativeCrashEvidenceAcrossSeparateDumps.nativeFatalSignals, []);

  const intent = {
    host: 'emulator-5554',
    bootId: 'boot-a',
    packageName: 'com.anonymous.sampleterminal',
    appName: 'sample-terminal',
    shape: 'dual',
    intentId: 'dual-sample-terminal-01',
    startedAt: '2026-09-24T00:00:00Z',
  };
  const absent = {pendingRemoteLaunches: [{...intent}], ownedRemoteProcesses: [], resolvedRemoteLaunches: []};
  assert.equal(
    runner.resolvePendingRemoteLaunch(
      absent,
      intent.intentId,
      {host: intent.host, bootId: intent.bootId, processes: []},
      '2026-09-24T00:00:01Z',
    ),
    'PROCESS_ABSENT',
  );
  assert.equal(absent.pendingRemoteLaunches.length, 0);
  assert.equal(absent.resolvedRemoteLaunches[0].resolution, 'PROCESS_ABSENT');

  const live = {pendingRemoteLaunches: [{...intent}], ownedRemoteProcesses: [], resolvedRemoteLaunches: []};
  assert.equal(
    runner.resolvePendingRemoteLaunch(
      live,
      intent.intentId,
      {
        host: intent.host,
        bootId: intent.bootId,
        processes: [{pid: 101, startTicks: '55'}],
      },
      '2026-09-24T00:00:02Z',
    ),
    'PROCESS_ADOPTED',
  );
  assert.equal(live.pendingRemoteLaunches.length, 0);
  assert.equal(live.ownedRemoteProcesses[0].processes[0].pid, 101);

  const mismatched = {pendingRemoteLaunches: [{...intent}], ownedRemoteProcesses: [], resolvedRemoteLaunches: []};
  assert.throws(
    () =>
      runner.resolvePendingRemoteLaunch(
        mismatched,
        intent.intentId,
        {
          host: intent.host,
          bootId: 'other-boot',
          processes: [],
        },
        '2026-09-24T00:00:03Z',
      ),
    /VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH/,
  );
  assert.equal(mismatched.pendingRemoteLaunches.length, 1);

  for (const processes of [
    [null],
    [{pid: '101', startTicks: '55'}],
    [{pid: 101, startTicks: 'not-numeric'}],
    [
      {pid: 101, startTicks: '55'},
      {pid: 101, startTicks: '56'},
    ],
  ]) {
    const invalid = {pendingRemoteLaunches: [{...intent}], ownedRemoteProcesses: [], resolvedRemoteLaunches: []};
    assert.throws(
      () =>
        runner.resolvePendingRemoteLaunch(
          invalid,
          intent.intentId,
          {
            host: intent.host,
            bootId: intent.bootId,
            processes,
          },
          '2026-09-24T00:00:04Z',
        ),
      /VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH/,
    );
    assert.equal(invalid.pendingRemoteLaunches.length, 1);
    assert.equal(invalid.ownedRemoteProcesses.length, 0);
    assert.equal(invalid.resolvedRemoteLaunches.length, 0);
  }

  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const action = source.slice(
    source.indexOf('async function diagnosePendingLaunch('),
    source.indexOf('async function report('),
  );
  assert.match(action, /remoteProcessIdentity\(manifest, device, intent\.packageName\)/);
  assert.match(action, /summarizeAppLaunchBreadcrumbs\(logcat, intent\.appName, intent\.intentId\)/);
  assert.match(
    action,
    /summarizeAndroidLaunchDiagnostics\(logcat, intent\.packageName, breadcrumbs\.startupPid, intent\.intentId\)/,
  );
  assert.match(action, /'AndroidRuntime:E',\s*'ReactNativeJS:V'/);
  assert.match(action, /'TER-VK-LAUNCH:I',\s*'TER-Splash:I'/);
  assert.match(action, /'ActivityManager:I',\s*'ActivityTaskManager:I'/);
  assert.match(action, /diagnosticOutput: 'omit'/);
  assert.match(action, /summarizeStructuredRuntimeDiagnostics\(\s*logcat,/);
  assert.match(action, /runtimeEvents,/);
  assert.match(action, /resolvePendingRemoteLaunch\(manifest, intent\.intentId, observed\)/);
  assert.match(source, /action === 'diagnose-pending-launch'/);
});

test('launch breadcrumb diagnostics expose only whitelisted TER-Splash stages for the exact app', () => {
  assert.equal(typeof runner.summarizeAppLaunchBreadcrumbs, 'function');
  const summary = runner.summarizeAppLaunchBreadcrumbs(
    [
      'I/TER-Splash( 100): event=activity.onCreate phase=start app=sample-terminal',
      'I/TER-VK-LAUNCH( 111): intent=dual-sample-terminal-01',
      'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
      'I/TER-Splash( 321): event=expo.prevent-auto-hide-set app=sample-terminal value=true',
      'I/TER-Splash( 321): event=activity.onCreate phase=after-super app=sample-terminal',
      'I/TER-Splash( 654): event=activity.onCreate phase=start app=sample-wallpaper-terminal',
      'I/OtherTag( 321): event=activity.onCreate phase=before-super app=sample-terminal',
      'I/TER-Splash( 321): event=untrusted marker app=sample-terminal token=secret',
    ].join('\n'),
    'sample-terminal',
    'dual-sample-terminal-01',
  );
  assert.deepEqual(summary, {
    observedMarkers: ['activity.onCreate:start', 'expo.prevent-auto-hide-set', 'activity.onCreate:after-super'],
    markerCount: 3,
    startupPid: '321',
  });
  assert.deepEqual(
    runner.summarizeAppLaunchBreadcrumbs(
      ['I/TER-Splash( 100): event=activity.onCreate phase=start app=sample-terminal'].join('\n'),
      'sample-terminal',
      'dual-sample-terminal-01',
    ),
    {
      observedMarkers: [],
      markerCount: 0,
      startupPid: null,
    },
  );
  assert.throws(
    () =>
      runner.summarizeAppLaunchBreadcrumbs(
        [
          'I/TER-VK-LAUNCH( 111): intent=dual-sample-terminal-01',
          'I/TER-VK-LAUNCH( 112): intent=dual-sample-terminal-01',
        ].join('\n'),
        'sample-terminal',
        'dual-sample-terminal-01',
      ),
    /VK_ANDROID_LAUNCH_SENTINEL_DUPLICATE/,
  );
  const laterLaunchLog = [
    'I/TER-VK-LAUNCH( 111): intent=dual-sample-terminal-old',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'I/TER-Splash( 321): event=activity.onCreate phase=after-super app=sample-terminal',
    'I/TER-VK-LAUNCH( 112): intent=dual-sample-terminal-new',
    'I/TER-Splash( 999): event=activity.onCreate phase=start app=sample-terminal',
    'F/DEBUG( 998): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 998): pid: 999, tid: 999, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 998): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n');
  const oldLaunch = runner.summarizeAppLaunchBreadcrumbs(laterLaunchLog, 'sample-terminal', 'dual-sample-terminal-old');
  assert.equal(oldLaunch.startupPid, '321');
  assert.deepEqual(
    runner.summarizeAndroidLaunchDiagnostics(laterLaunchLog, 'com.anonymous.sampleterminal', oldLaunch.startupPid)
      .nativeFatalSignals,
    [],
  );
  const reusedPidLaunchLog = [
    'I/TER-VK-LAUNCH( 111): intent=dual-sample-terminal-old-pid-reuse',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'I/TER-Splash( 321): event=activity.onCreate phase=after-super app=sample-terminal',
    'I/TER-VK-LAUNCH( 112): intent=dual-sample-terminal-new-pid-reuse',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'F/DEBUG( 998): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 998): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 998): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n');
  const oldReusedPidLaunch = runner.summarizeAppLaunchBreadcrumbs(
    reusedPidLaunchLog,
    'sample-terminal',
    'dual-sample-terminal-old-pid-reuse',
  );
  assert.equal(oldReusedPidLaunch.startupPid, '321');
  assert.deepEqual(
    runner.summarizeAndroidLaunchDiagnostics(
      reusedPidLaunchLog,
      'com.anonymous.sampleterminal',
      oldReusedPidLaunch.startupPid,
      'dual-sample-terminal-old-pid-reuse',
    ),
    {
      fatalException: false,
      processDied: false,
      nativeFatalSignals: [],
      exceptionTypes: [],
      appFrames: [],
      jsErrorSeen: false,
    },
  );
  const malformedNextSentinelLog = [
    'I/TER-VK-LAUNCH( 111): intent=dual-sample-terminal-old-malformed-next',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'I/TER-VK-LAUNCH( 112): malformed marker without an intent value',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'F/DEBUG( 998): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 998): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 998): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n');
  const oldMalformedNextLaunch = runner.summarizeAppLaunchBreadcrumbs(
    malformedNextSentinelLog,
    'sample-terminal',
    'dual-sample-terminal-old-malformed-next',
  );
  assert.equal(oldMalformedNextLaunch.startupPid, '321');
  assert.deepEqual(
    runner.summarizeAndroidLaunchDiagnostics(
      malformedNextSentinelLog,
      'com.anonymous.sampleterminal',
      oldMalformedNextLaunch.startupPid,
      'dual-sample-terminal-old-malformed-next',
    ).nativeFatalSignals,
    [],
  );
  assert.throws(
    () =>
      runner.summarizeAppLaunchBreadcrumbs(
        'I/TER-Splash( 321): event=activity.onCreate phase=start app=unknown',
        'unknown',
      ),
    /VK_ANDROID_APP_INVALID/,
  );
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const inspection = source.slice(
    source.indexOf('async function inspectResolvedLaunch('),
    source.indexOf('async function report('),
  );
  const resolver = source.slice(
    source.indexOf('export function resolveInspectableLaunch('),
    source.indexOf('async function inspectResolvedLaunch('),
  );
  assert.match(resolver, /resolvedRemoteLaunches/);
  assert.match(inspection, /resolveInspectableLaunch\(manifest\)/);
  assert.match(inspection, /summarizeAppLaunchBreadcrumbs\(logcat, intent\.appName, intent\.intentId\)/);
  assert.match(
    inspection,
    /summarizeAndroidLaunchDiagnostics\(logcat, intent\.packageName, breadcrumbs\.startupPid, intent\.intentId\)/,
  );
  assert.match(inspection, /'TER-Splash:I'/);
  assert.match(inspection, /'TER-VK-LAUNCH:I',\s*'TER-Splash:I'/);
  assert.match(inspection, /diagnosticOutput: 'omit'/);
  const resolvedProcessTableRead = inspection.slice(
    inspection.indexOf('const processTableText ='),
    inspection.indexOf('const processTable ='),
  );
  assert.match(resolvedProcessTableRead, /'shell', 'ps', '-A', '-o', 'PID,NAME'/);
  assert.match(resolvedProcessTableRead, /diagnosticOutput: 'sanitized'/);
  assert.doesNotMatch(resolvedProcessTableRead, /diagnosticOutput: 'omit'/);
  assert.match(inspection, /'ActivityManager:I',\s*'ActivityTaskManager:I'/);
  assert.match(inspection, /'DEBUG:F',\s*'libc:F',\s*'crash_dump32:F',\s*'crash_dump64:F',\s*'tombstoned:F'/);
  assert.match(inspection, /'shell', 'ps', '-A', '-o', 'PID,NAME'/);
  assert.match(inspection, /parseAndroidProcessTable\(processTableText, intent\.packageName\)/);
  assert.doesNotMatch(inspection, /remoteProcessIdentity\(|am', 'start|force-stop/);
  const installer = source.slice(
    source.indexOf('async function installLaunch('),
    source.indexOf('function screenshotPath('),
  );
  assert.match(installer, /onLaunchFailure: async \(\{intentId, stage, failureCode\}\)/);
  assert.match(installer, /launch-intent-marker/);
  assert.match(installer, /'shell',\s*'log',\s*'-p',\s*'i',\s*'-t',\s*'TER-VK-LAUNCH'/);
  assert.ok(installer.indexOf('launch-intent-marker') < installer.indexOf("'shell', 'am', 'start'"));
  assert.match(installer, /launch-failure-logcat/);
  assert.match(installer, /'TER-VK-LAUNCH:I',\s*'TER-Splash:I'/);
  assert.match(installer, /'ReactNativeJS:V'/);
  assert.match(installer, /summarizeStructuredRuntimeDiagnostics\(\s*logcat,/);
  assert.match(installer, /'ActivityManager:I',\s*'ActivityTaskManager:I'/);
  assert.match(installer, /'DEBUG:F',\s*'libc:F',\s*'crash_dump32:F',\s*'crash_dump64:F',\s*'tombstoned:F'/);
  assert.match(
    installer,
    /summarizeAndroidLaunchDiagnostics\(\s*logcat,\s*app\.packageName,\s*breadcrumbs\.startupPid,\s*intentId,?\s*\)/,
  );
  assert.match(installer, /summarizeAppLaunchBreadcrumbs\(logcat, appName, intentId\)/);
  assert.match(installer, /appendEvent\(manifest, 'REMOTE_LAUNCH_FAILURE_LOG_CAPTURED'/);
  assert.match(source, /action === 'inspect-resolved-launch'/);
});

test('launch epoch diagnostics bind app pid, timestamp, and actual overlay outcome to one intent', () => {
  const summary = runner.summarizeAppLaunchBreadcrumbs(
    [
      '1790203633.300 777 777 I TER-VK-LAUNCH: intent=dual-sample-terminal-epoch-01',
      '1790203633.400 321 321 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
      '1790203633.405 321 321 I TER-Splash: event=native.loading-overlay-attached activity=ephemeral-activity-token',
      '1790203633.410 321 321 I TER-Splash: event=native.loading-overlay-attached-after-super app=sample-terminal',
      '1790203633.415 322 322 I TER-Splash: event=native.loading-overlay-skipped reason=gate-unavailable activity=other-token',
      '1790203633.500 778 778 I TER-VK-LAUNCH: intent=dual-sample-terminal-epoch-02',
      '1790203633.510 999 999 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
    ].join('\n'),
    'sample-terminal',
    'dual-sample-terminal-epoch-01',
  );

  assert.equal(summary.startupPid, '321');
  assert.equal(summary.startupAtEpochMs, 1790203633400);
  assert.equal(summary.overlayOutcome, 'ATTACHED');
  assert.ok(summary.observedMarkers.includes('native.loading-overlay-attach-call-returned-after-super'));
  assert.ok(summary.observedMarkers.includes('native.loading-overlay-attached'));
  assert.ok(!summary.observedMarkers.includes('native.loading-overlay-skipped:gate-unavailable'));
});

test('launch epoch diagnostics report a same-process registry skip without exposing activity tokens', () => {
  const summary = runner.summarizeAppLaunchBreadcrumbs(
    [
      '1790203633.300 777 777 I TER-VK-LAUNCH: intent=dual-sample-terminal-epoch-skip',
      '1790203633.400 321 321 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
      '1790203633.405 321 321 I TER-Splash: event=native.loading-overlay-skipped reason=config-unavailable activity=private-token',
    ].join('\n'),
    'sample-terminal',
    'dual-sample-terminal-epoch-skip',
  );

  assert.equal(summary.overlayOutcome, 'SKIPPED_CONFIG_UNAVAILABLE');
  assert.ok(summary.observedMarkers.includes('native.loading-overlay-skipped:config-unavailable'));
  assert.ok(!JSON.stringify(summary).includes('private-token'));
});

test('launch epoch diagnostics mark repeated same-pid Activity starts ambiguous', () => {
  const summary = runner.summarizeAppLaunchBreadcrumbs(
    [
      '1790203633.300 777 777 I TER-VK-LAUNCH: intent=dual-sample-terminal-epoch-repeat',
      '1790203633.400 321 321 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
      '1790203633.405 321 321 I TER-Splash: event=native.loading-overlay-attached activity=first-token',
      '1790203633.410 321 321 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
    ].join('\n'),
    'sample-terminal',
    'dual-sample-terminal-epoch-repeat',
  );

  assert.equal(summary.startupPidStatus, 'AMBIGUOUS');
  assert.equal(summary.startupPid, null);
  assert.equal(summary.startupAtEpochMs, undefined);
  assert.deepEqual(summary.observedMarkers, []);
});

test('launch log reinspection requires an exact uninspected PROCESS_ABSENT intent', () => {
  const absent = {
    intentId: 'dual-sample-terminal-epoch-01',
    shape: 'dual',
    appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal',
    host: 'emulator-5554',
    bootId: 'boot-12345678',
    resolution: 'PROCESS_ABSENT',
    processCount: 0,
  };
  const secondAbsent = {
    ...absent,
    intentId: 'dual-sample-wallpaper-terminal-epoch-02',
    appName: 'sample-wallpaper-terminal',
    packageName: 'com.catering.v2s.terminal.samplewallpaper',
  };
  const adopted = {
    ...absent,
    intentId: 'dual-sample-wallpaper-terminal-adopted',
    appName: 'sample-wallpaper-terminal',
    packageName: 'com.catering.v2s.terminal.samplewallpaper',
    resolution: 'PROCESS_ADOPTED',
    processCount: 1,
  };

  assert.deepEqual(
    runner.resolveLaunchLogReinspection(
      {
        resolvedRemoteLaunches: [adopted, absent, secondAbsent],
        launchLogReinspections: [],
      },
      absent.intentId,
    ),
    absent,
  );
  assert.deepEqual(
    runner.resolveLaunchLogReinspection(
      {
        resolvedRemoteLaunches: [adopted, absent, secondAbsent],
        launchLogReinspections: [],
      },
      secondAbsent.intentId,
    ),
    secondAbsent,
  );
  assert.throws(
    () =>
      runner.resolveLaunchLogReinspection({
        resolvedRemoteLaunches: [absent, secondAbsent],
        launchLogReinspections: [],
      }),
    /VK_ANDROID_LAUNCH_INTENT_ID_INVALID/,
  );
  assert.throws(
    () =>
      runner.resolveLaunchLogReinspection(
        {
          resolvedRemoteLaunches: [absent, secondAbsent],
          launchLogReinspections: [{intentId: absent.intentId}],
        },
        absent.intentId,
      ),
    /VK_ANDROID_RESOLVED_LAUNCH_ALREADY_INSPECTED/,
  );
  assert.throws(
    () =>
      runner.resolveLaunchLogReinspection(
        {
          resolvedRemoteLaunches: [adopted, absent, secondAbsent],
          launchLogReinspections: [],
        },
        adopted.intentId,
      ),
    /VK_ANDROID_RESOLVED_LAUNCH_NOT_INSPECTABLE/,
  );
  assert.throws(
    () =>
      runner.resolveLaunchLogReinspection(
        {
          resolvedRemoteLaunches: [absent, {...absent}],
          launchLogReinspections: [],
        },
        absent.intentId,
      ),
    /VK_ANDROID_RESOLVED_LAUNCH_COUNT_INVALID/,
  );
  assert.deepEqual(
    parseArgs(['reinspect-resolved-launch-logs', '--run-id', 'vk-run-01', '--intent-id', absent.intentId]),
    {
      positionals: ['reinspect-resolved-launch-logs'],
      'run-id': 'vk-run-01',
      'intent-id': absent.intentId,
    },
  );
  assert.throws(
    () =>
      runner.resolveLaunchLogReinspection(
        {
          resolvedRemoteLaunches: [absent],
          launchLogReinspections: [{intentId: absent.intentId}],
        },
        absent.intentId,
      ),
    /VK_ANDROID_RESOLVED_LAUNCH_ALREADY_INSPECTED/,
  );
});

test('resolved launch evidence joins epoch and brief logs only for the same startup pid', () => {
  const intent = {
    intentId: 'dual-sample-terminal-epoch-01',
    shape: 'dual',
    appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal',
    host: 'emulator-5554',
    bootId: 'boot-12345678',
  };
  const epochLogcat = [
    '1790203633.300 777 777 I TER-VK-LAUNCH: intent=dual-sample-terminal-epoch-01',
    '1790203633.400 321 321 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
    '1790203633.405 321 321 I TER-Splash: event=native.loading-overlay-attached activity=private-activity-token',
    '1790203633.410 321 321 I TER-Splash: event=native.loading-overlay-attached-after-super app=sample-terminal',
    '1790203633.420 998 998 F DEBUG: Cmdline: com.anonymous.sampleterminal',
    '1790203633.421 998 998 F DEBUG: pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    '1790203633.422 998 998 F DEBUG: signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n');
  const briefLogcat = [
    'I/TER-VK-LAUNCH( 777): intent=dual-sample-terminal-epoch-01',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'I/TER-Splash( 321): event=native.loading-overlay-attached activity=private-activity-token',
    'I/TER-Splash( 321): event=native.loading-overlay-attached-after-super app=sample-terminal',
    'F/DEBUG( 998): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 998): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 998): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n');

  const summary = runner.summarizeResolvedLaunchLogEvidence(intent, epochLogcat, briefLogcat);
  assert.equal(summary.evidenceStatus, 'MATCHED');
  assert.equal(summary.startupPid, '321');
  assert.equal(summary.startupAtEpochMs, 1790203633400);
  assert.equal(summary.overlayOutcome, 'ATTACHED');
  assert.deepEqual(summary.signals.nativeFatalSignals, ['SIGSEGV']);
  assert.ok(summary.observedMarkers.includes('native.loading-overlay-attached'));
  assert.ok(!JSON.stringify(summary).includes('private-activity-token'));

  const mismatch = runner.summarizeResolvedLaunchLogEvidence(
    intent,
    epochLogcat,
    briefLogcat.replaceAll('( 321)', '( 999)').replaceAll('pid: 321', 'pid: 999'),
  );
  assert.equal(mismatch.evidenceStatus, 'PID_MISMATCH');
  assert.equal(mismatch.startupPid, null);
  assert.equal(mismatch.startupAtEpochMs, null);
  assert.equal(mismatch.overlayOutcome, 'NOT_OBSERVED');
  assert.deepEqual(mismatch.observedMarkers, []);
  assert.deepEqual(mismatch.signals.nativeFatalSignals, []);
});

test('resolved native fatal signals are timestamped at or after the exact Activity start', () => {
  const intent = {
    intentId: 'dual-sample-terminal-epoch-time',
    shape: 'dual',
    appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal',
    host: 'emulator-5554',
    bootId: 'boot-12345678',
  };
  const epochLogcat = [
    '1790203633.300 777 777 I TER-VK-LAUNCH: intent=dual-sample-terminal-epoch-time',
    '1790203633.390 321 321 F DEBUG: Cmdline: com.anonymous.sampleterminal',
    '1790203633.391 321 321 F DEBUG: pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    '1790203633.392 321 321 F DEBUG: signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
    '1790203633.400 321 321 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
  ].join('\n');
  const briefLogcat = [
    'I/TER-VK-LAUNCH( 777): intent=dual-sample-terminal-epoch-time',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
    'F/DEBUG( 321): Cmdline: com.anonymous.sampleterminal',
    'F/DEBUG( 321): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
    'F/DEBUG( 321): signal 11 (SIGSEGV), code 1 (SEGV_MAPERR)',
  ].join('\n');

  const stale = runner.summarizeResolvedLaunchLogEvidence(intent, epochLogcat, briefLogcat);
  assert.equal(stale.evidenceStatus, 'MATCHED');
  assert.deepEqual(stale.signals.nativeFatalSignals, []);

  const freshEpochLogcat = epochLogcat
    .replace('1790203633.390 321 321 F DEBUG:', '1790203633.405 321 321 F DEBUG:')
    .replace('1790203633.391 321 321 F DEBUG:', '1790203633.406 321 321 F DEBUG:')
    .replace('1790203633.392 321 321 F DEBUG:', '1790203633.407 321 321 F DEBUG:');
  const fresh = runner.summarizeResolvedLaunchLogEvidence(intent, freshEpochLogcat, briefLogcat);
  assert.deepEqual(fresh.signals.nativeFatalSignals, ['SIGSEGV']);
});

test('manifest binds launch log reinspection to absent intent and rejects raw output fields', () => {
  const manifest = validManifest();
  const intent = {
    intentId: 'dual-sample-terminal-epoch-01',
    shape: 'dual',
    appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal',
    host: 'emulator-5554',
    bootId: 'boot-12345678',
    resolution: 'PROCESS_ABSENT',
    processCount: 0,
  };
  manifest.resolvedRemoteLaunches = [intent];
  const inspection = {
    intentId: intent.intentId,
    shape: intent.shape,
    appName: intent.appName,
    packageName: intent.packageName,
    host: intent.host,
    bootId: intent.bootId,
    evidenceStatus: 'MATCHED',
    startupPid: '321',
    startupAtEpochMs: 1790203633400,
    overlayOutcome: 'ATTACHED',
    observedMarkers: ['activity.onCreate:start', 'native.loading-overlay-attached'],
    markerCount: 2,
    signals: {
      fatalException: false,
      processDied: false,
      nativeFatalSignals: [],
      exceptionTypes: [],
      appFrames: [],
      jsErrorSeen: false,
    },
    processObservation: {
      startupPid: '321',
      processTableCandidateCount: 1,
      processTableCandidates: [
        {pid: 321, name: 'com.anonymous.sampleterminal', statStatus: 'READABLE', processState: 'S', startTicks: '9001'},
      ],
      startupPidStatus: 'READABLE',
    },
    exitInfo: {
      startupPid: '321',
      status: 'NO_PACKAGE_RECORD',
      packageRecordCount: 0,
      targetPidRecordCount: 0,
      records: [],
    },
    inspectedAt: '2026-09-24T00:00:00.000Z',
  };
  manifest.launchLogReinspections = [{...inspection}];

  assert.equal(runner.validateRunManifest(manifest), true);
  manifest.launchLogReinspections[0].rawOutput = 'unredacted process description';
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);

  const nestedManifest = validManifest();
  nestedManifest.resolvedRemoteLaunches = [intent];
  nestedManifest.launchLogReinspections = [
    {...inspection, signals: {...inspection.signals, rawOutput: 'unredacted nested output'}},
  ];
  assert.throws(() => runner.validateRunManifest(nestedManifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);

  const invalidRecords = [
    {
      ...inspection,
      signals: {
        ...inspection.signals,
        appFrames: [
          {className: 'com.anonymous.sampleterminal.MainActivity', location: 'MainActivity.kt:4', rawOutput: 'secret'},
        ],
      },
    },
    {...inspection, signals: {...inspection.signals, exceptionTypes: ['unbounded raw exception payload']}},
    {...inspection, signals: {...inspection.signals, nativeFatalSignals: ['SIGSEGV', 'SIGSEGV']}},
    {...inspection, evidenceStatus: 'INSUFFICIENT_EVIDENCE'},
    {...inspection, observedMarkers: ['activity.onCreate:start'], markerCount: 1},
  ];
  for (const invalidRecord of invalidRecords) {
    const candidate = validManifest();
    candidate.resolvedRemoteLaunches = [intent];
    candidate.launchLogReinspections = [invalidRecord];
    assert.throws(() => runner.validateRunManifest(candidate), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  }
});

test('manifest preserves bounded legacy insufficient launch reinspection records for managed cleanup', () => {
  const {manifest, inspection} = validLaunchLogReinspectionManifest();
  const legacy = {
    ...inspection,
    evidenceStatus: 'INSUFFICIENT_EVIDENCE',
    startupPid: null,
    startupAtEpochMs: null,
    overlayOutcome: 'NOT_OBSERVED',
    observedMarkers: [],
    markerCount: 0,
    signals: {
      fatalException: false,
      processDied: false,
      nativeFatalSignals: [],
      exceptionTypes: [],
      appFrames: [],
      jsErrorSeen: false,
    },
  };
  delete legacy.processObservation;
  delete legacy.exitInfo;
  manifest.launchLogReinspections = [legacy];

  assert.equal(runner.validateRunManifest(manifest), true);

  const unsafeLegacyVariants = [
    {...legacy, startupPid: '4500'},
    {...legacy, observedMarkers: ['activity.onCreate:start'], markerCount: 1},
    {...legacy, signals: {...legacy.signals, jsErrorSeen: true}},
    {...legacy, evidenceStatus: 'MATCHED', startupPid: '4500', startupAtEpochMs: 1790203633400},
    {...legacy, rawOutput: 'must not be preserved'},
    {...legacy, processObservation: {}, exitInfo: {}},
  ];
  for (const invalid of unsafeLegacyVariants) {
    const candidate = validManifest();
    candidate.resolvedRemoteLaunches = [...manifest.resolvedRemoteLaunches];
    candidate.launchLogReinspections = [invalid];
    assert.throws(() => runner.validateRunManifest(candidate), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  }
});

test('manifest rejects overlay summaries that contradict the observed outcome markers', () => {
  const {manifest, inspection} = validLaunchLogReinspectionManifest();
  inspection.observedMarkers.push('native.loading-overlay-skipped:gate-unavailable');
  inspection.markerCount = inspection.observedMarkers.length;

  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
});

test('manifest bounds reinspection timestamps and diagnostic string fields', () => {
  const invalidCases = [
    [
      'non-string inspectedAt',
      candidate => {
        candidate.inspection.inspectedAt = {raw: 'timestamp'};
      },
    ],
    [
      'non-canonical inspectedAt',
      candidate => {
        candidate.inspection.inspectedAt = '2026-02-30T00:00:00.000Z';
      },
    ],
    [
      'oversized startup pid',
      candidate => {
        candidate.inspection.startupPid = '9'.repeat(1000);
      },
    ],
    [
      'oversized exception type',
      candidate => {
        candidate.inspection.signals.exceptionTypes = [`com.example.${'A'.repeat(300)}Exception`];
      },
    ],
    [
      'oversized app frame class',
      candidate => {
        candidate.inspection.signals.appFrames = [
          {
            className: `com.anonymous.sampleterminal.${'A'.repeat(300)}`,
            location: 'MainActivity.kt:4',
          },
        ];
      },
    ],
    [
      'oversized app frame location',
      candidate => {
        candidate.inspection.signals.appFrames = [
          {
            className: 'com.anonymous.sampleterminal.MainActivity',
            location: `MainActivity.kt:${'1'.repeat(1000)}`,
          },
        ];
      },
    ],
    [
      'process candidate crosses package boundary',
      candidate => {
        candidate.inspection.processObservation.processTableCandidates[0].name = 'com.anonymous.sampleterminal.debug';
      },
    ],
    [
      'process candidate has unreadable stat fields marked readable',
      candidate => {
        candidate.inspection.processObservation.processTableCandidates[0].startTicks = null;
      },
    ],
    [
      'exit-info summary cannot persist raw description',
      candidate => {
        candidate.inspection.exitInfo = {
          startupPid: '321',
          status: 'MATCHED',
          packageRecordCount: 1,
          targetPidRecordCount: 1,
          records: [{pid: 321, reasonCode: 6, reasonName: 'CRASH_NATIVE', statusCode: 11, description: 'private'}],
        };
      },
    ],
    [
      'exit-info record cannot claim another pid',
      candidate => {
        candidate.inspection.exitInfo = {
          startupPid: '321',
          status: 'MATCHED',
          packageRecordCount: 1,
          targetPidRecordCount: 1,
          records: [{pid: 322, reasonCode: 6, reasonName: 'CRASH_NATIVE', statusCode: 11}],
        };
      },
    ],
  ];

  for (const [label, mutate] of invalidCases) {
    const candidate = validLaunchLogReinspectionManifest();
    mutate(candidate);
    assert.throws(
      () => runner.validateRunManifest(candidate.manifest),
      /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/,
      label,
    );
  }
});

test('resolved launch log collection verifies boot before reading bounded read-only logcat', async () => {
  const intent = {
    intentId: 'dual-sample-terminal-epoch-01',
    shape: 'dual',
    appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal',
    host: 'emulator-5554',
    bootId: 'boot-12345678',
  };
  const epochLogcat = [
    '1790203633.300 777 777 I TER-VK-LAUNCH: intent=dual-sample-terminal-epoch-01',
    '1790203633.400 321 321 I TER-Splash: event=activity.onCreate phase=start app=sample-terminal',
  ].join('\n');
  const briefLogcat = [
    'I/TER-VK-LAUNCH( 777): intent=dual-sample-terminal-epoch-01',
    'I/TER-Splash( 321): event=activity.onCreate phase=start app=sample-terminal',
  ].join('\n');
  const processTableText = 'PID NAME\n321 com.anonymous.sampleterminal';
  const statFields = ['S', '1', ...Array(17).fill('0'), '9001'];
  const processStat = `321 (com.anonymous.sampleterminal) ${statFields.join(' ')}`;
  const exitInfoText = 'No historical process exit information';
  const calls = [];
  const replies = [
    intent.bootId,
    epochLogcat,
    briefLogcat,
    processTableText,
    {stdout: processStat, stderr: '', exitCode: 0, signal: null},
    exitInfoText,
    intent.bootId,
  ];
  const evidence = await runner.collectResolvedLaunchLogEvidence(
    validManifest(),
    intent,
    async (manifest, device, label, args, options) => {
      calls.push({runId: manifest.runId, serial: device.serial, label, args, options});
      return replies.shift();
    },
  );

  assert.equal(evidence.evidenceStatus, 'MATCHED');
  assert.equal(evidence.processObservation.startupPidStatus, 'READABLE');
  assert.equal(evidence.exitInfo.status, 'NO_PACKAGE_RECORD');
  assert.deepEqual(
    calls.map(call => call.label),
    [
      'dual-sample-terminal-reinspection-boot-id',
      'dual-sample-terminal-reinspection-epoch-logcat',
      'dual-sample-terminal-reinspection-brief-logcat',
      'dual-sample-terminal-reinspection-process-table',
      'dual-sample-terminal-reinspection-stat-321',
      'dual-sample-terminal-reinspection-exit-info',
      'dual-sample-terminal-reinspection-post-boot-id',
    ],
  );
  assert.ok(calls.every(call => call.serial === intent.host));
  assert.deepEqual(calls[1].args, [
    'shell',
    'logcat',
    '-d',
    '-t',
    '2000',
    '-v',
    'epoch',
    '-s',
    'TER-VK-LAUNCH:I',
    'TER-Splash:I',
    'AndroidRuntime:E',
    'ReactNativeJS:E',
    'ActivityManager:I',
    'ActivityTaskManager:I',
    'DEBUG:F',
    'libc:F',
    'crash_dump32:F',
    'crash_dump64:F',
    'tombstoned:F',
  ]);
  assert.ok(calls.every(call => call.options?.preserveLastKnownGood === true));
  assert.equal(calls[1].options?.diagnosticOutput, 'omit');
  assert.equal(calls[2].options?.diagnosticOutput, 'omit');
  assert.equal(calls[2].args[0], 'shell');
  assert.equal(calls[2].args[1], 'logcat');
  assert.deepEqual(calls[3].args, ['shell', 'ps', '-A', '-o', 'PID,NAME']);
  assert.equal(calls[3].options?.diagnosticOutput, 'sanitized');
  assert.deepEqual(calls[4].args, ['shell', 'cat', '/proc/321/stat']);
  assert.equal(calls[4].options?.diagnosticOutput, 'sanitized');
  assert.deepEqual(calls[4].options?.acceptedExitCodes, [0, 1]);
  assert.equal(calls[4].options?.returnCommandResult, true);
  assert.deepEqual(calls[5].args, ['shell', 'dumpsys', 'activity', 'exit-info', intent.packageName]);
  assert.ok(!calls.some(call => call.args.includes('am') || call.args.includes('force-stop')));

  const mismatchCalls = [];
  await assert.rejects(
    () =>
      runner.collectResolvedLaunchLogEvidence(validManifest(), intent, async (_manifest, _device, _label, args) => {
        mismatchCalls.push(args);
        return 'boot-87654321';
      }),
    /VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH/,
  );
  assert.equal(mismatchCalls.length, 1);

  const postMismatchCalls = [];
  const postMismatchReplies = [
    intent.bootId,
    epochLogcat,
    briefLogcat,
    processTableText,
    {stdout: processStat, stderr: '', exitCode: 0, signal: null},
    exitInfoText,
    'boot-87654321',
  ];
  await assert.rejects(
    () =>
      runner.collectResolvedLaunchLogEvidence(validManifest(), intent, async (_manifest, _device, label, args) => {
        postMismatchCalls.push({label, args});
        return postMismatchReplies.shift();
      }),
    /VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH/,
  );
  assert.equal(postMismatchCalls.length, 7);
  assert.equal(postMismatchCalls[6].label, 'dual-sample-terminal-reinspection-post-boot-id');
});

test('remote process readback passes pidof, stat, and cmdline operands directly and preserves expected absence stderr', async () => {
  assert.equal(typeof runner.remoteNamedProcessIdentity, 'function');
  const calls = [];
  const identity = await runner.remoteNamedProcessIdentity(
    validManifest(),
    {serial: 'emulator-5554', shape: 'dual'},
    'system_server',
    async (_manifest, _device, label, args, options) => {
      calls.push({label, args, options});
      if (label.endsWith('remote-boot-id')) return 'boot-12345678';
      if (label.endsWith('remote-process')) return {stdout: '', stderr: 'pidof: no matching process', exitCode: 1};
      throw new Error('stat must not run when pidof reports absence');
    },
  );

  assert.deepEqual(identity, {host: 'emulator-5554', bootId: 'boot-12345678', processes: []});
  assert.deepEqual(calls[1].args, ['shell', 'pidof', 'system_server']);
  assert.equal(calls[1].options?.diagnosticOutput, 'sanitized');
  assert.deepEqual(calls[1].options?.acceptedExitCodes, [0, 1]);
  assert.equal(calls[1].options?.returnCommandResult, true);

  const missingStatCalls = [];
  const missingStat = await runner.remoteNamedProcessIdentity(
    validManifest(),
    {serial: 'emulator-5554', shape: 'dual'},
    'system_server',
    async (_manifest, _device, label, args, options) => {
      missingStatCalls.push({label, args, options});
      if (label.endsWith('remote-boot-id')) return 'boot-12345678';
      if (label.endsWith('remote-process')) return {stdout: '321\n', stderr: '', exitCode: 0};
      if (label.endsWith('remote-stat-321'))
        return {stdout: '', stderr: 'cat: /proc/321/stat: No such file', exitCode: 1, signal: null};
      throw new Error(`unexpected read: ${label}`);
    },
  );
  assert.deepEqual(missingStat.processes, []);
  assert.deepEqual(missingStatCalls[1].args, ['shell', 'pidof', 'system_server']);
  assert.deepEqual(missingStatCalls[2].args, ['shell', 'cat', '/proc/321/stat']);
  assert.deepEqual(missingStatCalls[2].options?.acceptedExitCodes, [0, 1]);

  const mismatchedStat = await runner.remoteNamedProcessIdentity(
    validManifest(),
    {serial: 'emulator-5554', shape: 'dual'},
    'system_server',
    async (_manifest, _device, label) => {
      if (label.endsWith('remote-boot-id')) return 'boot-12345678';
      if (label.endsWith('remote-process')) return {stdout: '321\n', stderr: '', exitCode: 0};
      return {stdout: '321 (other-process) S 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 9001', stderr: '', exitCode: 0};
    },
  );
  assert.deepEqual(mismatchedStat.processes, []);
});

test('named process identity accepts Android-truncated stat comm only with exact cmdline binding', async () => {
  const statFields = ['S', '1', ...Array(17).fill('0'), '9001'];
  const calls = [];
  const identity = await runner.remoteNamedProcessIdentity(
    validManifest(),
    {serial: 'emulator-5554', shape: 'dual'},
    'com.anonymous.sampleterminal',
    async (_manifest, _device, label, args, options) => {
      calls.push({label, args, options});
      if (label.endsWith('remote-boot-id')) return 'boot-12345678';
      if (label.endsWith('remote-process')) return {stdout: '321\n', stderr: '', exitCode: 0, signal: null};
      if (label.endsWith('remote-stat-321'))
        return {stdout: `321 (.sampleterminal) ${statFields.join(' ')}`, stderr: '', exitCode: 0, signal: null};
      if (label.endsWith('remote-cmdline-321'))
        return {stdout: 'com.anonymous.sampleterminal\u0000', stderr: '', exitCode: 0, signal: null};
      throw new Error(`unexpected read: ${label}`);
    },
  );

  assert.deepEqual(identity, {
    host: 'emulator-5554',
    bootId: 'boot-12345678',
    processes: [{pid: 321, startTicks: '9001'}],
  });
  assert.deepEqual(calls[3].args, ['shell', 'cat', '/proc/321/cmdline']);
  assert.equal(calls[3].options?.returnCommandResult, true);
  assert.equal(calls[3].options?.diagnosticOutput, 'sanitized');
});

test('named process identity rejects a PID whose exact cmdline is not the requested package', async () => {
  const statFields = ['S', '1', ...Array(17).fill('0'), '9001'];
  const identity = await runner.remoteNamedProcessIdentity(
    validManifest(),
    {serial: 'emulator-5554', shape: 'dual'},
    'com.anonymous.sampleterminal',
    async (_manifest, _device, label) => {
      if (label.endsWith('remote-boot-id')) return 'boot-12345678';
      if (label.endsWith('remote-process')) return {stdout: '321\n', stderr: '', exitCode: 0, signal: null};
      if (label.endsWith('remote-stat-321'))
        return {stdout: `321 (.sampleterminal) ${statFields.join(' ')}`, stderr: '', exitCode: 0, signal: null};
      return {stdout: 'com.other.application\u0000', stderr: '', exitCode: 0, signal: null};
    },
  );
  assert.deepEqual(identity.processes, []);
});

test('process readback rejects unexpected exit-one diagnostics instead of treating them as absence', async () => {
  await assert.rejects(
    () =>
      runner.remoteNamedProcessIdentity(
        validManifest(),
        {serial: 'emulator-5554', shape: 'dual'},
        'system_server',
        async (_manifest, _device, label) =>
          label.endsWith('remote-boot-id')
            ? 'boot-12345678'
            : {stdout: '', stderr: 'permission denied', exitCode: 1, signal: null},
      ),
    /VK_ANDROID_REMOTE_PROCESS_READBACK_INVALID/,
  );

  await assert.rejects(
    () =>
      runner.remotePidIdentity(
        validManifest(),
        {serial: 'emulator-5554', shape: 'dual'},
        321,
        'screenrecord',
        '/sdcard/run-dual-transition.mp4',
        async (_manifest, _device, label) =>
          label.endsWith('boot-id')
            ? 'boot-12345678'
            : {stdout: '', stderr: 'cat: /proc/321/stat: Permission denied', exitCode: 1, signal: null},
      ),
    /VK_ANDROID_REMOTE_PROCESS_READBACK_INVALID/,
  );

  await assert.rejects(
    () =>
      runner.remoteNamedProcessIdentity(
        validManifest(),
        {serial: 'emulator-5554', shape: 'dual'},
        'system_server',
        async (_manifest, _device, label) =>
          label.endsWith('remote-boot-id')
            ? 'boot-12345678'
            : {stdout: '', stderr: 'pidof: command not found', exitCode: 1, signal: null},
      ),
    /VK_ANDROID_REMOTE_PROCESS_READBACK_INVALID/,
  );

  await assert.rejects(
    () =>
      runner.remotePidIdentity(
        validManifest(),
        {serial: 'emulator-5554', shape: 'dual'},
        321,
        'screenrecord',
        '/sdcard/run-dual-transition.mp4',
        async (_manifest, _device, label) =>
          label.endsWith('boot-id')
            ? 'boot-12345678'
            : {stdout: '', stderr: 'cat: command not found', exitCode: 1, signal: null},
      ),
    /VK_ANDROID_REMOTE_PROCESS_READBACK_INVALID/,
  );
});

test('named process identity rejects a proc stat comm mismatch after pidof', async () => {
  const statFields = ['S', '1', ...Array(17).fill('0'), '9001'];
  const identity = await runner.remoteNamedProcessIdentity(
    validManifest(),
    {serial: 'emulator-5554', shape: 'dual'},
    'com.anonymous.sampleterminal',
    async (_manifest, _device, label) => {
      if (label.endsWith('remote-boot-id')) return 'boot-12345678';
      if (label.endsWith('remote-process')) return {stdout: '321\n', stderr: '', exitCode: 0, signal: null};
      return {stdout: `321 (other.process) ${statFields.join(' ')}`, stderr: '', exitCode: 0, signal: null};
    },
  );
  assert.deepEqual(identity, {host: 'emulator-5554', bootId: 'boot-12345678', processes: []});
});

test('process readback preflight checks known-present system_server before every target package on both devices', async () => {
  assert.equal(typeof runner.verifyRemoteProcessReadback, 'function');
  const manifest = validManifest();
  const calls = [];
  const observations = await runner.verifyRemoteProcessReadback(
    manifest,
    async (_manifest, device, processName) => {
      calls.push(`${device.shape}:${processName}`);
      return {
        host: device.serial,
        bootId: device.shape === 'dual' ? 'boot-12345678' : 'boot-87654321',
        processes: processName === 'system_server' ? [{pid: 1, startTicks: '10'}] : [],
      };
    },
    () => {},
  );

  assert.deepEqual(calls, [
    'dual:system_server',
    'dual:com.anonymous.sampleterminal',
    'dual:com.catering.v2s.terminal.samplewallpaper',
    'mobile:system_server',
    'mobile:com.anonymous.sampleterminal',
    'mobile:com.catering.v2s.terminal.samplewallpaper',
  ]);
  assert.equal(observations.length, 6);
  assert.equal(
    observations.filter(item => item.processName === 'system_server').every(item => item.status === 'PRESENT'),
    true,
  );
  assert.equal(manifest.processReadbackPreflight, observations);

  const unavailable = validManifest();
  let laterReadReached = false;
  await assert.rejects(
    () =>
      runner.verifyRemoteProcessReadback(
        unavailable,
        async (_manifest, _device, processName) => {
          if (processName !== 'system_server') laterReadReached = true;
          return {host: 'emulator-5554', bootId: 'boot-12345678', processes: []};
        },
        () => {},
      ),
    /VK_ANDROID_PROCESS_READBACK_POSITIVE_PREFLIGHT_FAILED/,
  );
  assert.equal(laterReadReached, false);

  const bootMismatch = validManifest();
  const bootMismatchCalls = [];
  await assert.rejects(
    () =>
      runner.verifyRemoteProcessReadback(
        bootMismatch,
        async (_manifest, device, processName) => {
          bootMismatchCalls.push(`${device.shape}:${processName}`);
          return {
            host: device.serial,
            bootId: device.shape === 'dual' ? 'boot-wrong-123456' : 'boot-87654321',
            processes: [{pid: 1, startTicks: '10'}],
          };
        },
        () => {},
      ),
    /VK_ANDROID_PROCESS_READBACK_IDENTITY_MISMATCH/,
  );
  assert.deepEqual(bootMismatchCalls, ['dual:system_server']);

  const packageMismatch = validManifest();
  const packageMismatchCalls = [];
  await assert.rejects(
    () =>
      runner.verifyRemoteProcessReadback(
        packageMismatch,
        async (_manifest, device, processName) => {
          packageMismatchCalls.push(`${device.shape}:${processName}`);
          return {
            host: device.serial,
            bootId: processName === 'system_server' ? 'boot-12345678' : 'boot-wrong-123456',
            processes: processName === 'system_server' ? [{pid: 1, startTicks: '10'}] : [],
          };
        },
        () => {},
      ),
    /VK_ANDROID_PROCESS_READBACK_IDENTITY_MISMATCH/,
  );
  assert.deepEqual(packageMismatchCalls, ['dual:system_server', 'dual:com.anonymous.sampleterminal']);
});

test('remote PID identity reads stat and cmdline as direct adb shell argv', async () => {
  assert.equal(typeof runner.remotePidIdentity, 'function');
  const calls = [];
  const statFields = ['S', '1', ...Array(17).fill('0'), '9001'];
  const identity = await runner.remotePidIdentity(
    validManifest(),
    {serial: 'emulator-5554', shape: 'dual'},
    321,
    'screenrecord',
    '/sdcard/run-dual-transition.mp4',
    async (_manifest, _device, label, args, options) => {
      calls.push({label, args, options});
      if (label.endsWith('boot-id')) return 'boot-12345678';
      if (label.includes('-stat-'))
        return {stdout: `321 (screenrecord) ${statFields.join(' ')}`, stderr: '', exitCode: 0};
      if (label.includes('-cmdline-'))
        return {stdout: 'screenrecord\u0000/sdcard/run-dual-transition.mp4\u0000', stderr: '', exitCode: 0};
      throw new Error(`unexpected read: ${label}`);
    },
  );

  assert.deepEqual(identity, {host: 'emulator-5554', bootId: 'boot-12345678', process: {pid: 321, startTicks: '9001'}});
  assert.deepEqual(calls[1].args, ['shell', 'cat', '/proc/321/stat']);
  assert.deepEqual(calls[2].args, ['shell', 'cat', '/proc/321/cmdline']);
  for (const call of calls.slice(1)) {
    assert.deepEqual(call.options?.acceptedExitCodes, [0, 1]);
    assert.equal(call.options?.returnCommandResult, true);
    assert.equal(call.options?.diagnosticOutput, 'sanitized');
  }

  const missingStatCalls = [];
  const missingStat = await runner.remotePidIdentity(
    validManifest(),
    {serial: 'emulator-5554', shape: 'dual'},
    321,
    'screenrecord',
    '/sdcard/run-dual-transition.mp4',
    async (_manifest, _device, label, args) => {
      missingStatCalls.push({label, args});
      if (label.endsWith('boot-id')) return 'boot-12345678';
      return {stdout: '', stderr: 'cat: /proc/321/stat: No such file', exitCode: 1, signal: null};
    },
  );
  assert.equal(missingStat.process, null);
  assert.deepEqual(missingStatCalls[1].args, ['shell', 'cat', '/proc/321/stat']);
  assert.equal(missingStatCalls.length, 2);
});

test('remote PID identity requires exact executable and argument tokens', async () => {
  const statFields = ['S', '1', ...Array(17).fill('0'), '9001'];
  const readIdentity = cmdline =>
    runner.remotePidIdentity(
      validManifest(),
      {serial: 'emulator-5554', shape: 'dual'},
      321,
      'screenrecord',
      '/sdcard/run-dual-transition.mp4',
      async (_manifest, _device, label) => {
        if (label.endsWith('boot-id')) return 'boot-12345678';
        if (label.includes('-stat-'))
          return {stdout: `321 (screenrecord) ${statFields.join(' ')}`, stderr: '', exitCode: 0, signal: null};
        return {stdout: cmdline, stderr: '', exitCode: 0, signal: null};
      },
    );

  assert.equal((await readIdentity('screenrecord-helper\u0000/sdcard/run-dual-transition.mp4\u0000')).process, null);
  assert.equal((await readIdentity('screenrecord\u0000/sdcard/run-dual-transition.mp4.bak\u0000')).process, null);
});

test('remote PID identity binds Android app packages by exact cmdline when stat comm is truncated', async () => {
  const statFields = ['S', '1', ...Array(17).fill('0'), '9001'];
  const readIdentity = cmdline =>
    runner.remotePidIdentity(
      validManifest(),
      {serial: 'emulator-5554', shape: 'dual'},
      321,
      'com.anonymous.sampleterminal',
      null,
      async (_manifest, _device, label, args) => {
        if (label.endsWith('boot-id')) return 'boot-12345678';
        if (label.includes('-stat-'))
          return {stdout: `321 (.sampleterminal) ${statFields.join(' ')}`, stderr: '', exitCode: 0, signal: null};
        assert.deepEqual(args, ['shell', 'cat', '/proc/321/cmdline']);
        return {stdout: cmdline, stderr: '', exitCode: 0, signal: null};
      },
    );

  assert.deepEqual((await readIdentity('com.anonymous.sampleterminal\u0000')).process, {pid: 321, startTicks: '9001'});
  assert.equal((await readIdentity('com.other.application\u0000')).process, null);
});

test('screenrecord startup passes one complete shell command string to adb', async () => {
  assert.equal(typeof runner.launchRemoteScreenrecord, 'function');
  const calls = [];
  const command =
    'screenrecord --time-limit 2 --display-id 11 /sdcard/run-dual-transition.mp4 >/sdcard/run-dual-transition.log 2>&1 & echo $!';
  const output = await runner.launchRemoteScreenrecord(
    validManifest(),
    {serial: 'emulator-5554', shape: 'dual'},
    'sample-terminal',
    'VK-IA-15',
    11,
    '/sdcard/run-dual-transition.mp4',
    '/sdcard/run-dual-transition.log',
    async (_manifest, _device, _label, args) => {
      calls.push(args);
      return '321\n';
    },
  );

  assert.equal(output, '321\n');
  assert.deepEqual(calls, [['shell', command]]);
  const source = fs.readFileSync(new URL('./ter-virtual-keyboard-android.mjs', import.meta.url), 'utf8');
  assert.match(source, /launchRemoteScreenrecord\(manifest, device, appName, iaId, sf\.id, remoteVideo, remoteLog\)/);
});

test('screenrecord startup accepts a SurfaceFlinger 64-bit display id and cleanup distinguishes an active path', async () => {
  assert.equal(typeof runner.screenrecordProcessUsesPath, 'function');
  const calls = [];
  const displayId = '4619827259835644672';
  const command = `screenrecord --time-limit 2 --display-id ${displayId} /sdcard/run-dual-transition.mp4 >/sdcard/run-dual-transition.log 2>&1 & echo $!`;
  const output = await runner.launchRemoteScreenrecord(
    validManifest(),
    {serial: 'emulator-5554', shape: 'dual'},
    'sample-terminal',
    'VK-IA-15',
    displayId,
    '/sdcard/run-dual-transition.mp4',
    '/sdcard/run-dual-transition.log',
    async (_manifest, _device, _label, args) => {
      calls.push(args);
      return '321\\n';
    },
  );
  assert.equal(output, '321\\n');
  assert.deepEqual(calls, [['shell', command]]);
  assert.equal(
    runner.screenrecordProcessUsesPath(
      `123 screenrecord ${displayId} /sdcard/run-dual-transition.mp4`,
      '/sdcard/run-dual-transition.mp4',
    ),
    true,
  );
  assert.equal(runner.screenrecordProcessUsesPath('123 surfaceflinger', '/sdcard/run-dual-transition.mp4'), false);
});

test('native fatal signal allowlist rejects unknown and non-fatal signal names', () => {
  const summarize = signal =>
    runner.summarizeAndroidLaunchDiagnostics(
      [
        'F/DEBUG( 999): Cmdline: com.anonymous.sampleterminal',
        'F/DEBUG( 999): pid: 321, tid: 321, name: main >>> com.anonymous.sampleterminal <<<',
        `F/DEBUG( 999): signal 11 (${signal}), code 1 (UNKNOWN)`,
      ].join('\n'),
      'com.anonymous.sampleterminal',
      '321',
    );
  assert.deepEqual(summarize('SIGSEGV').nativeFatalSignals, ['SIGSEGV']);
  assert.deepEqual(summarize('SIGNOTREAL').nativeFatalSignals, []);
  assert.deepEqual(summarize('SIGTERM').nativeFatalSignals, []);
});

test('launch breadcrumb evidence stays bound to one exact absent launch and marker vocabulary', () => {
  const manifest = validManifest();
  manifest.resolvedRemoteLaunches = [
    {
      intentId: 'dual-sample-terminal-01',
      shape: 'dual',
      appName: 'sample-terminal',
      packageName: 'com.anonymous.sampleterminal',
      host: 'emulator-5554',
      bootId: 'boot-abcdef',
      resolution: 'PROCESS_ABSENT',
      processCount: 0,
    },
  ];
  manifest.launchLogInspections = [
    {
      intentId: 'dual-sample-terminal-01',
      shape: 'dual',
      appName: 'sample-terminal',
      packageName: 'com.anonymous.sampleterminal',
      host: 'emulator-5554',
      bootId: 'boot-abcdef',
      startupPid: '321',
      observedMarkers: ['activity.onCreate:start'],
      markerCount: 1,
      signals: {nativeFatalSignals: ['SIGSEGV']},
    },
  ];
  assert.equal(runner.validateRunManifest(manifest), true);

  manifest.launchLogInspections[0].signals.nativeFatalSignals = ['SIGNOTREAL'];
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.launchLogInspections[0].signals.nativeFatalSignals = ['SIGSEGV'];
  manifest.launchLogInspections[0].startupPid = 'not-a-pid';
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.launchLogInspections[0].startupPid = '321';
  manifest.launchLogInspections[0].startupPid = null;
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.launchLogInspections[0].startupPid = '321';
  manifest.launchDiagnostics = [{startupPid: null, signals: {nativeFatalSignals: ['SIGSEGV']}}];
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.launchDiagnostics = [];

  manifest.launchLogInspections[0].host = 'emulator-5556';
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.launchLogInspections[0].host = 'emulator-5554';
  manifest.launchLogInspections[0].observedMarkers = ['raw exception message'];
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);

  manifest.launchLogInspections[0].observedMarkers = ['activity.onCreate:start'];
  manifest.resolvedRemoteLaunches[0].resolution = 'PROCESS_ADOPTED';
  manifest.resolvedRemoteLaunches[0].processCount = 1;
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.resolvedRemoteLaunches[0].resolution = 'PROCESS_ABSENT';
  manifest.resolvedRemoteLaunches[0].processCount = 0;
  manifest.launchLogInspections.push({...manifest.launchLogInspections[0]});
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);

  const historical = validManifest();
  historical.resolvedRemoteLaunches = [
    {
      intentId: 'dual-sample-terminal-historical-01',
      shape: 'dual',
      appName: 'sample-terminal',
      packageName: 'com.anonymous.sampleterminal',
      host: 'emulator-5554',
      bootId: 'boot-abcdef',
      resolution: 'PROCESS_ABSENT',
      processCount: 0,
    },
  ];
  historical.launchLogInspections = [
    {
      intentId: 'dual-sample-terminal-historical-01',
      shape: 'dual',
      appName: 'sample-terminal',
      packageName: 'com.anonymous.sampleterminal',
      host: 'emulator-5554',
      bootId: 'boot-abcdef',
      observedMarkers: ['native.loading-overlay-attached-after-super'],
      markerCount: 1,
    },
  ];
  assert.equal(runner.validateRunManifest(historical), true);
});

test('resolved launch process-table evidence accepts only exact package identities', () => {
  const manifest = validManifest();
  manifest.resolvedRemoteLaunches = [
    {
      intentId: 'dual-sample-terminal-01',
      shape: 'dual',
      appName: 'sample-terminal',
      packageName: 'com.anonymous.sampleterminal',
      host: 'emulator-5554',
      bootId: 'boot-abcdef',
      resolution: 'PROCESS_ABSENT',
      processCount: 0,
    },
  ];
  manifest.launchLogInspections = [
    {
      intentId: 'dual-sample-terminal-01',
      shape: 'dual',
      appName: 'sample-terminal',
      packageName: 'com.anonymous.sampleterminal',
      host: 'emulator-5554',
      bootId: 'boot-abcdef',
      observedMarkers: [],
      markerCount: 0,
      processTableCandidateCount: 1,
      processTableCandidates: [{pid: 612, name: 'com.anonymous.sampleterminal:remote', startTicks: '9182'}],
    },
  ];
  assert.equal(runner.validateRunManifest(manifest), true);

  manifest.launchLogInspections[0].processTableCandidates[0].name = 'com.anonymous.sampleterminal.debug';
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.launchLogInspections[0].processTableCandidates[0].name = 'com.anonymous.sampleterminal:';
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
  manifest.launchLogInspections[0].processTableCandidates[0].name = 'com.anonymous.sampleterminal';
  manifest.launchLogInspections[0].processTableCandidates[0].startTicks = 'not-a-tick';
  assert.throws(() => runner.validateRunManifest(manifest), /VK_ANDROID_MANIFEST_APP_BINDING_INVALID/);
});

test('resolved launch inspection refuses repeated reads before touching logcat', () => {
  const manifest = {
    resolvedRemoteLaunches: [
      {
        intentId: 'dual-sample-terminal-01',
        shape: 'dual',
        appName: 'sample-terminal',
        packageName: 'com.anonymous.sampleterminal',
        host: 'emulator-5554',
        bootId: 'boot-abcdef',
        resolution: 'PROCESS_ABSENT',
        processCount: 0,
      },
    ],
    launchLogInspections: [{intentId: 'dual-sample-terminal-01'}],
  };
  assert.throws(() => runner.resolveInspectableLaunch(manifest), /VK_ANDROID_RESOLVED_LAUNCH_ALREADY_INSPECTED/);
});

test('resolved launch inspector selects the only uninspected absent launch', () => {
  const terminal = {
    intentId: 'dual-sample-terminal-01',
    shape: 'dual',
    appName: 'sample-terminal',
    packageName: 'com.anonymous.sampleterminal',
    host: 'emulator-5554',
    bootId: 'boot-abcdef',
    resolution: 'PROCESS_ABSENT',
    processCount: 0,
  };
  const wallpaper = {
    intentId: 'dual-sample-wallpaper-terminal-01',
    shape: 'dual',
    appName: 'sample-wallpaper-terminal',
    packageName: 'com.catering.v2s.terminal.samplewallpaper',
    host: 'emulator-5554',
    bootId: 'boot-abcdef',
    resolution: 'PROCESS_ABSENT',
    processCount: 0,
  };
  const manifest = {
    resolvedRemoteLaunches: [terminal, wallpaper],
    launchLogInspections: [{intentId: terminal.intentId}],
  };
  assert.equal(runner.resolveInspectableLaunch(manifest).intentId, wallpaper.intentId);

  manifest.launchLogInspections.push({intentId: wallpaper.intentId});
  assert.throws(() => runner.resolveInspectableLaunch(manifest), /VK_ANDROID_RESOLVED_LAUNCH_ALREADY_INSPECTED/);
  manifest.launchLogInspections = [];
  assert.throws(() => runner.resolveInspectableLaunch(manifest), /VK_ANDROID_RESOLVED_LAUNCH_COUNT_INVALID/);
});

test('first failure keeps its broken boundary available at the top level', () => {
  assert.equal(typeof runner.recordFirstFailure, 'function');
  const manifest = {firstFailure: null, lastKnownGood: 'dual-app-process', brokenBoundary: null};
  runner.recordFirstFailure(manifest, 'VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED', 'INSTALL_dual_sample-terminal');
  assert.equal(manifest.firstFailure.code, 'VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED');
  assert.equal(manifest.firstFailure.brokenBoundary, 'INSTALL_dual_sample-terminal');
  assert.equal(manifest.brokenBoundary, 'INSTALL_dual_sample-terminal');

  runner.recordFirstFailure(manifest, 'VK_ANDROID_CLEANUP_FAILED', 'CLEANUP');
  assert.equal(manifest.firstFailure.code, 'VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED');
  assert.equal(manifest.brokenBoundary, 'INSTALL_dual_sample-terminal');
});

test('diagnostic command success preserves the previous last-known-good checkpoint', () => {
  const manifest = {lastKnownGood: 'dual-sample-wallpaper-terminal-startup-logcat-diagnostic'};
  assert.equal(
    runner.recordLastKnownGood(manifest, 'dual-reinspection-logcat', {preserveCurrent: true}),
    'dual-sample-wallpaper-terminal-startup-logcat-diagnostic',
  );
  assert.equal(manifest.lastKnownGood, 'dual-sample-wallpaper-terminal-startup-logcat-diagnostic');
  assert.equal(runner.recordLastKnownGood(manifest, 'next-owned-runtime-step'), 'next-owned-runtime-step');
});

test('command diagnostics do not mark a result-validated exit one as PASS', () => {
  const record = runner.commandDiagnosticRecord({
    phase: 'CLEANUP',
    label: 'dual-sample-terminal-remote-process',
    executable: 'adb',
    args: ['shell', 'pidof', 'com.anonymous.sampleterminal'],
    durationMs: 12,
    exitCode: 1,
    signal: null,
    stdout: '',
    stderr: 'permission denied',
    acceptedExitCodes: [0, 1],
    resultAccepted: false,
    outputPolicy: 'sanitized',
  });
  assert.equal(record.result, 'FAIL');
  assert.equal(record.stderr, 'permission denied');
  assert.throws(
    () =>
      runner.commandDiagnosticRecord({
        phase: 'CLEANUP',
        label: 'invalid-result-validation',
        executable: 'adb',
        args: [],
        durationMs: 1,
        exitCode: 1,
        signal: null,
        stdout: '',
        stderr: '',
        acceptedExitCodes: [0, 1],
        resultAccepted: 'false',
        outputPolicy: 'sanitized',
      }),
    /VK_ANDROID_COMMAND_RESULT_VALIDATION_INVALID/,
  );
});

test('command logs mirror complete runtime history when evidence logs directory is absent', () => {
  assert.equal(typeof runner.appendCommandLogRecord, 'function');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-vk-command-log-'));
  try {
    const runtimeLogPath = path.join(tempRoot, 'runtime', 'logs', 'commands.jsonl');
    const evidenceRunDirectory = path.join(tempRoot, 'evidence', 'run-01');
    const evidenceLogPath = path.join(evidenceRunDirectory, 'logs', 'commands.jsonl');
    fs.mkdirSync(path.dirname(runtimeLogPath), {recursive: true});
    fs.mkdirSync(evidenceRunDirectory, {recursive: true});
    fs.writeFileSync(runtimeLogPath, `${JSON.stringify({label: 'earlier-command', result: 'PASS'})}\n`);

    runner.appendCommandLogRecord({
      runtimeLogPath,
      evidenceLogPath,
      evidenceRunDirectory,
      record: {label: 'diagnose', result: 'PASS'},
    });
    assert.equal(fs.readFileSync(evidenceLogPath, 'utf8'), fs.readFileSync(runtimeLogPath, 'utf8'));
    runner.appendCommandLogRecord({
      runtimeLogPath,
      evidenceLogPath,
      evidenceRunDirectory,
      record: {label: 'cleanup', result: 'PASS'},
    });
    assert.equal(fs.readFileSync(evidenceLogPath, 'utf8'), fs.readFileSync(runtimeLogPath, 'utf8'));
    assert.equal(fs.readFileSync(evidenceLogPath, 'utf8').match(/earlier-command/g)?.length, 1);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
});

test('transition evidence samples are explicitly unaligned video times and full-video review remains open', () => {
  assert.deepEqual(runner.transitionVideoSampleOffsets(2), [
    {index: 1, offsetFromVideoStartMs: 333.333},
    {index: 2, offsetFromVideoStartMs: 666.667},
    {index: 3, offsetFromVideoStartMs: 1000},
    {index: 4, offsetFromVideoStartMs: 1333.333},
    {index: 5, offsetFromVideoStartMs: 1666.667},
  ]);
  assert.throws(() => runner.transitionVideoSampleOffsets(0), /VK_ANDROID_TRANSITION_VIDEO_DURATION_INVALID/);
  const source = fs.readFileSync(new URL('./ter-virtual-keyboard-android.mjs', import.meta.url), 'utf8');
  assert.match(source, /screenrecord --time-limit 2 --display-id/);
  assert.match(source, /TRANSITION_VIDEO_CAPTURED/);
  assert.match(source, /UNALIGNED_TO_TAP_EVENT/);
  assert.match(source, /OPEN_REQUIRES_FULL_VIDEO_AND_PER_CONTROL_REVIEW/);
  assert.match(source, /VISUAL=OPEN/);
  assert.match(source, /remotePidIdentity\(manifest, device, recorderPid, 'screenrecord', remoteVideo\)/);
  assert.match(source, /VK_ANDROID_OWNED_SCREENRECORD_STILL_RUNNING/);
  assert.doesNotMatch(source, /progress: sample\.progress|offsetFromTapMs|tapOffsetMs \+ sample/);
  assert.doesNotMatch(source, /VK_ANDROID_SCREENRECORD_TAP_OFFSET_INVALID/);
  assert.doesNotMatch(source, /recorderReadbackToTapMs/);
});

test('transition video samples are tied only to the probed video timeline, never mislabeled as animation progress', () => {
  assert.equal(typeof runner.transitionVideoSampleOffsets, 'function');
  if (typeof runner.transitionVideoSampleOffsets !== 'function') return;
  assert.deepEqual(runner.transitionVideoSampleOffsets(2), [
    {index: 1, offsetFromVideoStartMs: 333.333},
    {index: 2, offsetFromVideoStartMs: 666.667},
    {index: 3, offsetFromVideoStartMs: 1000},
    {index: 4, offsetFromVideoStartMs: 1333.333},
    {index: 5, offsetFromVideoStartMs: 1666.667},
  ]);
  assert.throws(() => runner.transitionVideoSampleOffsets(0), /VK_ANDROID_TRANSITION_VIDEO_DURATION_INVALID/);
});

test('transition samples stop at the last decodable video frame when the container has trailing time', () => {
  assert.deepEqual(
    runner.parseVideoFrameTimestamps(
      JSON.stringify({
        frames: [
          {best_effort_timestamp_time: '0.000000'},
          {best_effort_timestamp_time: '0.760156'},
          {best_effort_timestamp_time: '1.760700'},
        ],
      }),
    ),
    [0, 0.760156, 1.7607],
  );
  assert.deepEqual(runner.transitionVideoSampleOffsets(2.272622, [0, 0.760156, 1.7607]), [
    {index: 1, offsetFromVideoStartMs: 293.45},
    {index: 2, offsetFromVideoStartMs: 586.9},
    {index: 3, offsetFromVideoStartMs: 880.35},
    {index: 4, offsetFromVideoStartMs: 1173.8},
    {index: 5, offsetFromVideoStartMs: 1467.25},
  ]);
  assert.throws(
    () => runner.parseVideoFrameTimestamps('{"frames":[]}'),
    /VK_ANDROID_TRANSITION_FRAME_TIMELINE_INVALID/,
  );
  assert.throws(() => runner.transitionVideoSampleOffsets(2, []), /VK_ANDROID_TRANSITION_FRAME_TIMELINE_INVALID/);
  const source = fs.readFileSync(new URL('./ter-virtual-keyboard-android.mjs', import.meta.url), 'utf8');
  assert.match(source, /transition-frame-timeline/);
  assert.match(source, /LAST_DECODED_VIDEO_FRAME/);
  assert.match(source, /VK_ANDROID_TRANSITION_FRAME_OUTPUT_MISSING/);
});

test('cleanup recovery never skips the full repository runtime resource inventory for new work', () => {
  assert.equal(typeof runner.runtimeResourceRoot, 'function');
  assert.equal(runner.runtimeResourceRoot('/workspace/repo'), path.join('/workspace/repo', '.runtime'));
  assert.deepEqual(runner.terResourcePreflightArgs('/workspace/repo'), [
    '--profile',
    'ter-validation-with-dev',
    '/workspace/repo/.runtime',
  ]);
});

test('ADB command validation rejects destructive argument vectors independent of source formatting', () => {
  assert.equal(typeof runner.validateAdbArgs, 'function');
  assert.throws(
    () => runner.validateAdbArgs(['-s', 'emulator-5554', 'shell', 'pm', 'clear', 'com.example.app']),
    /VK_ANDROID_FORBIDDEN_DEVICE_COMMAND/,
  );
  assert.throws(
    () => runner.validateAdbArgs(['-s', 'emulator-5554', 'logcat', '-c']),
    /VK_ANDROID_FORBIDDEN_DEVICE_COMMAND/,
  );
  assert.equal(runner.validateAdbArgs(['-s', 'emulator-5554', 'shell', 'input', 'tap', '10', '20']), true);
});

test('W2 input actions use only fixed redacted probes, scoped hardware keys, and parse admin code without exposing it', () => {
  assert.equal(typeof runner.w2InputProbeArgs, 'function');
  assert.equal(typeof runner.w2HardwareKeyArgs, 'function');
  assert.equal(typeof runner.parseAdminDebugPassword, 'function');
  assert.deepEqual(runner.w2InputProbeArgs('staff-name', 0), ['shell', 'input', '-d', '0', 'text', 'STAFFPROBE']);
  assert.deepEqual(runner.w2InputProbeArgs('staff-passcode', 0), ['shell', 'input', '-d', '0', 'text', '1111']);
  assert.deepEqual(runner.w2InputProbeArgs('covered-text', 0), ['shell', 'input', '-d', '0', 'text', 'Z']);
  assert.deepEqual(runner.w2InputProbeArgs('scanner-text', 0), ['shell', 'input', '-d', '0', 'text', 'SCAN']);
  assert.deepEqual(runner.w2InputProbeArgs('overlay-host', 0), ['shell', 'input', '-d', '0', 'text', '198.51.100.8']);
  assert.deepEqual(runner.w2HardwareKeyArgs('tab', 0), ['shell', 'input', '-d', '0', 'keyevent', 'KEYCODE_TAB']);
  assert.deepEqual(runner.w2HardwareKeyArgs('shift-tab', 0), [
    'shell',
    'input',
    '-d',
    '0',
    'keycombination',
    'KEYCODE_SHIFT_LEFT',
    'KEYCODE_TAB',
  ]);
  assert.deepEqual(runner.w2HardwareKeyArgs('enter', 0), ['shell', 'input', '-d', '0', 'keyevent', 'KEYCODE_ENTER']);
  assert.throws(() => runner.w2InputProbeArgs('arbitrary-user-value', 0), /VK_ANDROID_W2_INPUT_PROBE_INVALID/);
  assert.throws(() => runner.w2HardwareKeyArgs('back', 0), /VK_ANDROID_W2_HARDWARE_KEY_INVALID/);
  const xml =
    '<hierarchy><display id="0"><node resource-id="terminal.admin:debug-password" text="（482913）"/></display></hierarchy>';
  assert.equal(runner.parseAdminDebugPassword(xml, 0), '482913');
  const mergedInstruction =
    '<hierarchy><display id="0"><node resource-id="terminal.admin:login:instruction" text="请输入动态口令（482913）"/></display></hierarchy>';
  assert.equal(runner.parseAdminDebugPassword(mergedInstruction, 0), '482913');
  assert.equal(
    JSON.stringify({
      codeHash: createHash('sha256').update(runner.parseAdminDebugPassword(xml, 0)).digest('hex'),
    }).includes('482913'),
    false,
  );
  assert.throws(
    () => runner.parseAdminDebugPassword('<hierarchy/>', 0),
    /VK_ANDROID_ADMIN_DEBUG_PASSWORD_NOT_OBSERVED/,
  );
  assert.throws(
    () =>
      runner.parseAdminDebugPassword(
        '<hierarchy><display id="0"><node resource-id="terminal.admin:login:instruction" text="请输入动态口令（482913）且备用码（111222）"/></display></hierarchy>',
        0,
      ),
    /VK_ANDROID_ADMIN_DEBUG_PASSWORD_NOT_OBSERVED/,
  );
});

test('W7 long-press actions are display-scoped, bounded, and detect only visible selection-menu evidence', () => {
  assert.deepEqual(w7ProbeKeyIds('sample.auth.login:operator-name'), [
    'ui.base.input:virtual-keyboard:text-t',
    'ui.base.input:virtual-keyboard:text-e',
    'ui.base.input:virtual-keyboard:text-r',
    'ui.base.input:virtual-keyboard:text-w',
    'ui.base.input:virtual-keyboard:text-7',
    'ui.base.input:virtual-keyboard:text-c',
    'ui.base.input:virtual-keyboard:text-l',
    'ui.base.input:virtual-keyboard:text-i',
    'ui.base.input:virtual-keyboard:text-p',
    'ui.base.input:virtual-keyboard:text-b',
    'ui.base.input:virtual-keyboard:text-o',
    'ui.base.input:virtual-keyboard:text-a',
    'ui.base.input:virtual-keyboard:text-r',
    'ui.base.input:virtual-keyboard:text-d',
  ]);
  assert.deepEqual(w7ProbeKeyIds('sample.auth.login:passcode'), Array(4).fill('ui.base.input:virtual-keyboard:text-1'));
  assert.deepEqual(w7ProbeKeyIds('sample.desk.member-form:keyboard-financial-probe').slice(0, 5), [
    'ui.base.input:virtual-keyboard:text-1',
    'ui.base.input:virtual-keyboard:text-2',
    'ui.base.input:virtual-keyboard:text-.',
    'ui.base.input:virtual-keyboard:text-3',
    'ui.base.input:virtual-keyboard:text-4',
  ]);
  assert.throws(() => w7ProbeKeyIds('unapproved-field'), /VK_ANDROID_W7_RESOURCE_ID_OUT_OF_SCOPE/);
  const probeResourceId = 'sample.auth.login:operator-name';
  const uniqueKeyIds = [...new Set(w7ProbeKeyIds(probeResourceId))];
  const keyNodes = uniqueKeyIds
    .map((keyId, index) => {
      const left = index * 20;
      return `<node resource-id="${keyId}" bounds="[${left},20][${left + 10},30]" enabled="true"/>`;
    })
    .join('');
  const probeXml =
    `<hierarchy><display id="2"><node resource-id="${probeResourceId}" text="" focused="true" enabled="true" bounds="[0,0][100,10]"/>` +
    '<node resource-id="ui.base.input:virtual-keyboard" bounds="[0,40][200,100]" enabled="true"/>' +
    `${keyNodes}</display></hierarchy>`;
  const tapPlan = w7ProbeTapPlan(probeXml, 2, probeResourceId);
  assert.equal(tapPlan.length, 14);
  assert.deepEqual(tapPlan[0], {x: 5, y: 25});
  assert.deepEqual(tapPlan[1], {x: 25, y: 25});
  assert.deepEqual(tapPlan[13], {x: 245, y: 25});
  assert.throws(() => w7ProbeTapPlan(probeXml, 2, 'missing-field'), /VK_ANDROID_W7_PROBE_INPUT_NOT_READY/);
  assert.deepEqual(w7ClearInputArgs(2, 3), [
    'shell',
    'input',
    '-d',
    '2',
    'keyevent',
    'KEYCODE_DEL',
    'KEYCODE_DEL',
    'KEYCODE_DEL',
  ]);
  assert.throws(() => w7ClearInputArgs(2, 0), /VK_ANDROID_W7_CLEAR_INPUT_INVALID/);
  assert.throws(() => w7ClearInputArgs(2, 129), /VK_ANDROID_W7_CLEAR_INPUT_INVALID/);
  assert.deepEqual(w7ClipboardKeyArgs('select-all', 2), [
    'shell',
    'input',
    '-d',
    '2',
    'keycombination',
    'KEYCODE_CTRL_LEFT',
    'KEYCODE_A',
  ]);
  assert.deepEqual(w7ClipboardKeyArgs('copy', 2).slice(-3), ['keycombination', 'KEYCODE_CTRL_LEFT', 'KEYCODE_C']);
  assert.deepEqual(w7ClipboardKeyArgs('paste', 2).slice(-3), ['keycombination', 'KEYCODE_CTRL_LEFT', 'KEYCODE_V']);
  assert.deepEqual(w7LongPressArgs(2, {left: 20, top: 40, right: 80, bottom: 100}), [
    'shell',
    'input',
    '-d',
    '2',
    'swipe',
    '50',
    '70',
    '50',
    '70',
    '1000',
  ]);
  assert.throws(() => w7ClipboardKeyArgs('arbitrary-key', 2), /VK_ANDROID_W7_CLIPBOARD_ACTION_INVALID/);
  assert.throws(
    () => w7LongPressArgs(2, {left: 10, top: 10, right: 10, bottom: 20}),
    /VK_ANDROID_W7_LONG_PRESS_INVALID/,
  );
  assert.throws(
    () => w7LongPressArgs(2, {left: 0, top: 0, right: 20, bottom: 20}, 500),
    /VK_ANDROID_W7_LONG_PRESS_INVALID/,
  );

  const absent =
    '<hierarchy><display id="0"><node resource-id="sample.auth.login:operator-name" text=""/></display>' +
    '<display id="2"><node resource-id="sample.auth.login:operator-name" text=""/></display></hierarchy>';
  assert.deepEqual(parseTextInputContextMenu(absent, 2), {visible: false, floatingToolbar: false, actions: []});
  const visible =
    '<hierarchy><display id="0"><node text="Paste"/></display>' +
    '<display id="2"><node resource-id="android:id/floating_toolbar"/><node text="Paste"/><node text="Copy"/></display></hierarchy>';
  assert.deepEqual(parseTextInputContextMenu(visible, 2), {
    visible: true,
    floatingToolbar: true,
    actions: ['COPY', 'PASTE'],
  });
  assert.throws(() => parseTextInputContextMenu('<hierarchy/>', 2), /VK_ANDROID_CONTEXT_MENU_DISPLAY_MISSING/);
});

test('command diagnostics are readable, secret-redacted, and never persist raw UI hierarchy', () => {
  assert.equal(typeof runner.commandDiagnosticRecord, 'function');
  const ordinary = runner.commandDiagnosticRecord({
    phase: 'INSPECT',
    label: 'dual-adb-display',
    executable: 'adb',
    args: ['-s', 'emulator-5554', 'shell', 'dumpsys'],
    durationMs: 17,
    exitCode: 1,
    signal: null,
    stdout: 'token=abc123',
    stderr: 'failed for 192.0.2.8',
    outputPolicy: 'sanitized',
  });
  assert.equal(ordinary.result, 'FAIL');
  assert.match(ordinary.stdout, /token=\[REDACTED\]/);
  assert.match(ordinary.stderr, /\[IP_REDACTED\]/);
  assert.equal(ordinary.argumentCount, 4);
  assert.equal('args' in ordinary, false);

  const hierarchy = runner.commandDiagnosticRecord({
    phase: 'INSPECT',
    label: 'uia-read',
    executable: 'adb',
    args: ['shell', 'cat', 'temp.xml'],
    durationMs: 10,
    exitCode: 0,
    signal: null,
    stdout: '<node text="private-value"/>',
    stderr: 'private-stderr-payload',
    outputPolicy: 'omit',
  });
  assert.equal(hierarchy.stdout, '[RAW_OUTPUT_OMITTED]');
  assert.equal(hierarchy.stderr, '[RAW_OUTPUT_OMITTED]');
  assert.doesNotMatch(JSON.stringify(hierarchy), /private-value|private-stderr-payload/);

  const expectedAbsent = runner.commandDiagnosticRecord({
    phase: 'PREPARE',
    label: 'dual-sample-terminal-remote-process',
    executable: 'adb',
    args: ['shell', 'pidof', 'com.anonymous.sampleterminal'],
    durationMs: 12,
    exitCode: 1,
    signal: null,
    stdout: '',
    stderr: 'pidof: no matching process',
    acceptedExitCodes: [0, 1],
    outputPolicy: 'sanitized',
  });
  assert.equal(expectedAbsent.result, 'PASS');
  assert.deepEqual(expectedAbsent.acceptedExitCodes, [0, 1]);
  assert.equal(expectedAbsent.stderr, 'pidof: no matching process');
});

test('binary command output is omitted from structured diagnostic logs', () => {
  assert.equal(typeof runner.commandDiagnosticOutputPolicy, 'function');
  assert.equal(runner.commandDiagnosticOutputPolicy({binary: true}), 'omit');
  assert.equal(runner.commandDiagnosticOutputPolicy({binary: false, requestedPolicy: 'sanitized'}), 'sanitized');
  const binaryRecord = runner.commandDiagnosticRecord({
    phase: 'CAPTURE',
    label: 'dual-frame-capture',
    executable: 'adb',
    args: ['exec-out', 'screencap'],
    durationMs: 10,
    exitCode: 0,
    signal: null,
    stdout: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0xff]),
    stderr: Buffer.alloc(0),
    outputPolicy: 'omit',
  });
  assert.equal(binaryRecord.stdoutBytes, 5);
  assert.equal(binaryRecord.stdout, '[RAW_OUTPUT_OMITTED]');
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const diagnosticRecord = source.slice(
    source.indexOf('export function commandDiagnosticRecord('),
    source.indexOf('function commandDiagnosticLogContent('),
  );
  assert.match(diagnosticRecord, /stdout,\s*stderr,/);
  assert.match(diagnosticRecord, /stdout: persisted\(stdout\),\s*stderr: persisted\(stderr\)/);
});

test('omitted command output stays omitted in runtime and evidence capture logs', () => {
  assert.equal(typeof runner.writeCommandCaptureLog, 'function');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-vk-capture-log-'));
  const runtimeLogPath = path.join(tempRoot, 'runtime', 'logs', 'capture.log');
  const evidenceRunDirectory = path.join(tempRoot, 'evidence', 'run-01');
  const evidenceLogPath = path.join(evidenceRunDirectory, 'logs', 'capture.log');
  fs.mkdirSync(path.dirname(evidenceLogPath), {recursive: true});

  try {
    runner.writeCommandCaptureLog({
      runtimeLogPath,
      evidenceLogPath,
      evidenceRunDirectory,
      stdout: 'raw stdout payload',
      stderr: 'raw stderr token=private-value',
      outputPolicy: 'omit',
    });
    const runtimeContent = fs.readFileSync(runtimeLogPath, 'utf8');
    const evidenceContent = fs.readFileSync(evidenceLogPath, 'utf8');
    assert.equal(runtimeContent, evidenceContent);
    assert.match(runtimeContent, /^\[RAW_COMMAND_OUTPUT_OMITTED\] stdoutBytes=\d+ stderrBytes=\d+\n$/);
    assert.doesNotMatch(runtimeContent, /raw stdout payload|raw stderr|private-value/);
  } finally {
    fs.rmSync(tempRoot, {recursive: true, force: true});
  }
});

test('logical and SurfaceFlinger identities must prove both approved device shapes', () => {
  const logicalDual = parseLogicalDisplays(
    [
      'Display id 0: DisplayInfo{"Internal", real 2560 x 1600, uniqueId "primary", flags=FLAG_DEFAULT}',
      'Display id 2: DisplayInfo{"Presentation", real 1280 x 720, uniqueId "secondary", flags=FLAG_PRESENTATION}',
    ].join('\n'),
  );
  const surfacesDual = parseSurfaceDisplays(
    [
      'Display local:0 (HWC display 0, primary, "Internal")',
      'activeMode={id=1, resolution=2560x1600}',
      'Virtual Display virtual:1',
      'name="Presentation"',
      'activeMode={id=2, resolution=1280x720}',
    ].join('\n'),
  );
  assert.equal(validateDeviceShape({shape: 'dual', logical: logicalDual, surfaces: surfacesDual}).secondary.id, 2);
  assert.throws(
    () => validateDeviceShape({shape: 'mobile', logical: logicalDual, surfaces: surfacesDual}),
    /VK_ANDROID_MOBILE_SHAPE_MISMATCH/,
  );
  const logicalMobile = [logicalDual[0]];
  const surfacesMobile = {primary: surfacesDual.primary, virtual: [], external: []};
  assert.equal(
    validateDeviceShape({shape: 'mobile', logical: logicalMobile, surfaces: surfacesMobile}).secondary,
    null,
  );
});

test('dual admission accepts either an emulator secondary surface or one physical external presentation surface', () => {
  const logical = parseLogicalDisplays(
    [
      'Display id 0: DisplayInfo{"Built-in", real 1920 x 1080, uniqueId "local:0", flags=FLAG_DEFAULT}',
      'Display id 2: DisplayInfo{"HDMI", real 1920 x 1080, uniqueId "local:1", flags=FLAG_PRESENTATION}',
    ].join('\n'),
  );
  const physical = parseSurfaceDisplays(
    [
      'Display 0',
      '    connectionType=Internal',
      '    name="Primary display"',
      '    displayModes={id=0, resolution=1920x1080}',
      'Display 1',
      '    connectionType=External',
      '    name="Secondary display"',
      '    displayModes={id=0, resolution=1920x1080}',
    ].join('\n'),
  );
  const admitted = validateDeviceShape({shape: 'dual', logical, surfaces: physical});
  assert.equal(admitted.secondary.id, 2);
  assert.equal(admitted.secondarySurface.id, '1');
  assert.equal(admitted.secondarySurfaceKind, 'physical');
  assert.throws(
    () =>
      validateDeviceShape({
        shape: 'dual',
        logical,
        surfaces: {...physical, virtual: [{id: 'virtual:extra', width: 1920, height: 1080}]},
      }),
    /VK_ANDROID_DUAL_SHAPE_MISMATCH/,
  );
  assert.throws(
    () =>
      validateDeviceShape({
        shape: 'mobile',
        logical: [logical[0]],
        surfaces: {...physical, primary: [physical.primary[0]], external: physical.external},
      }),
    /VK_ANDROID_MOBILE_SHAPE_MISMATCH/,
  );
});

test('capture display inventory is freshly resolved and corroborated by dumpsys display facts', () => {
  const logicalText = [
    'Display id 0: DisplayInfo{"Built-in Screen", displayId 0, FLAG_DEFAULT, real 1280 x 800, uniqueId "local:primary", state ON}',
    'Display id 2: DisplayInfo{"Emulator 2D Display", displayId 2, FLAG_PRESENTATION, real 1280 x 800, uniqueId "virtual:secondary", state ON}',
  ].join('\n');
  const displayDump = [
    'mBaseDisplayInfo=DisplayInfo{"Built-in Screen", displayId 0, FLAG_DEFAULT, real 1280 x 800, uniqueId "local:primary", state ON}',
    'mOverrideDisplayInfo=DisplayInfo{"Built-in Screen", displayId 0, FLAG_DEFAULT, real 1200 x 800, uniqueId "local:primary", state ON}',
    'mBaseDisplayInfo=DisplayInfo{"Emulator 2D Display", displayId 2, FLAG_PRESENTATION, real 1280 x 800, uniqueId "virtual:secondary", state ON}',
  ].join('\n');
  const latestSurfaceDump = [
    'Display local:latest-primary (HWC display 0, primary, "Built-in Screen")',
    'activeMode={id=1, resolution=1280×720}',
    'Virtual Display virtual:latest-secondary',
    'name="Emulator 2D Display"',
    'activeMode={id=2, resolution=1280×720}',
  ].join('\n');

  assert.deepEqual(parseDumpsysDisplayFacts(displayDump), [
    {id: 0, name: 'Built-in Screen', width: 1280, height: 800, uniqueId: 'local:primary', flags: ['FLAG_DEFAULT']},
    {
      id: 2,
      name: 'Emulator 2D Display',
      width: 1280,
      height: 800,
      uniqueId: 'virtual:secondary',
      flags: ['FLAG_PRESENTATION'],
    },
  ]);
  const resolved = resolveCaptureDisplayInventory('dual', logicalText, displayDump, latestSurfaceDump);
  assert.equal(resolved.pairing.primarySurface.id, 'local:latest-primary');
  assert.equal(resolved.pairing.secondarySurface.id, 'virtual:latest-secondary');
  assert.throws(
    () =>
      resolveCaptureDisplayInventory(
        'dual',
        logicalText,
        displayDump.replace('uniqueId "virtual:secondary"', 'uniqueId "virtual:stale"'),
        latestSurfaceDump,
      ),
    /VK_ANDROID_CAPTURE_DISPLAY_FACTS_MISMATCH/,
  );
});

test('testID taps are scoped to the requested Android logical display', () => {
  const xml =
    '<hierarchy><display id="0"><node resource-id="shared:key" bounds="[1,2][9,10]" enabled="true"/></display><display id="2"><node resource-id="shared:key" bounds="[11,12][29,30]" enabled="true"/></display></hierarchy>';
  assert.deepEqual(parseResourceNode(xml, 'shared:key', 0), {
    left: 1,
    top: 2,
    right: 9,
    bottom: 10,
    enabled: true,
    selected: false,
  });
  assert.deepEqual(parseResourceNode(xml, 'shared:key', 2), {
    left: 11,
    top: 12,
    right: 29,
    bottom: 30,
    enabled: true,
    selected: false,
  });
  assert.equal(parseResourceNode(xml, 'shared:key', 3), null);
  assert.throws(
    () =>
      parseResourceNode(
        '<hierarchy><display id="2"><node resource-id="shared:key" bounds="[11,12][29,30]" enabled="true"/><node resource-id="shared:key" bounds="[31,32][49,50]" enabled="true"/></display></hierarchy>',
        'shared:key',
        2,
      ),
    /VK_ANDROID_RESOURCE_NODE_AMBIGUOUS/,
  );
});

test('a cleaned Android run cannot start new owned work or falsely keep cleanup PASS', () => {
  const manifest = {status: 'CLEANED', cleanup: 'PASS', devTunnelMappings: []};
  assert.equal(assertRunAllowsAction(manifest, 'report'), undefined);
  assert.equal(assertRunAllowsAction(manifest, 'cleanup'), undefined);
  assert.throws(() => assertRunAllowsAction(manifest, 'launch'), /VK_ANDROID_RUN_ALREADY_CLEANED/u);
  assert.throws(() => assertRunAllowsAction(manifest, 'bridge-dev-tunnels'), /VK_ANDROID_RUN_ALREADY_CLEANED/u);
  assert.equal(manifest.cleanup, 'PASS');
  assert.deepEqual(manifest.devTunnelMappings, []);
});

test('a failed Android run allows evidence and cleanup but blocks further business actions', () => {
  const manifest = {status: 'FAIL', firstFailure: {code: 'VK_ANDROID_EXAMPLE'}};
  for (const action of [
    'report',
    'cleanup',
    'capture-terminal-business-logs',
    'read-terminal-binding',
    'diagnose-business-screen',
  ]) {
    assert.equal(assertRunAllowsAction(manifest, action), undefined, `${action} remains available to close evidence`);
  }
  for (const action of ['tap', 'business-input', 'activation-fixture-input', 'launch', 'bridge-dev-tunnels']) {
    assert.throws(
      () => assertRunAllowsAction(manifest, action),
      /VK_ANDROID_RUN_FAILED_ACTION_NOT_ALLOWED/u,
      `${action} must not continue the business flow after first failure`,
    );
  }
  assert.equal(manifest.firstFailure.code, 'VK_ANDROID_EXAMPLE');
});

test('wallpaper Android flow chooses a different option from the live selected state', () => {
  const ids = ['none', 'w1', 'w2', 'w3'];
  const xmlFor = selected =>
    `<hierarchy><display id="0">${ids
      .map(
        id =>
          `<node resource-id="sample.wallpaper.picker:options:${id}" bounds="[1,2][9,10]" enabled="true"${id === selected ? ' selected="true"' : ''}/>`,
      )
      .join('')}</display><display id="2">${ids
      .map(
        id =>
          `<node resource-id="sample.wallpaper.picker:options:${id}" bounds="[1,2][9,10]" enabled="true"${id === 'w3' ? ' selected="true"' : ''}/>`,
      )
      .join('')}</display></hierarchy>`;
  assert.deepEqual(chooseDifferentWallpaperOption(xmlFor('w1'), 0), {
    currentResourceId: 'sample.wallpaper.picker:options:w1',
    nextResourceId: 'sample.wallpaper.picker:options:none',
  });
  assert.deepEqual(chooseDifferentWallpaperOption(xmlFor('w1'), 2), {
    currentResourceId: 'sample.wallpaper.picker:options:w3',
    nextResourceId: 'sample.wallpaper.picker:options:none',
  });
  assert.throws(() => chooseDifferentWallpaperOption(xmlFor(null), 0), /VK_ANDROID_WALLPAPER_SELECTION_NOT_UNIQUE/u);
  assert.throws(
    () => chooseDifferentWallpaperOption(xmlFor('w1').replace('sample.wallpaper.picker:options:w3', 'missing'), 0),
    /VK_ANDROID_WALLPAPER_OPTIONS_INCOMPLETE/u,
  );
});

test('activation submit is ready only after Enter dismisses the virtual keyboard', () => {
  const visibleKeyboard = '<node resource-id="ui.base.input:virtual-keyboard" bounds="[0,10][100,90]" enabled="true"/>';
  const submit = '<node resource-id="terminal.activation.submit" bounds="[10,10][90,20]" enabled="true"/>';
  const visibleXml = `<hierarchy><display id="0">${visibleKeyboard}${submit}</display></hierarchy>`;
  assert.deepEqual(activationSubmitReadiness(visibleXml, 0), {
    keyboardVisible: true,
    blockingAdminOverlayPresent: false,
    submitVisible: true,
    submitEnabled: true,
    ready: false,
  });
  const readyXml = `<hierarchy><display id="0">${submit}</display></hierarchy>`;
  assert.deepEqual(activationSubmitReadiness(readyXml, 0), {
    keyboardVisible: false,
    blockingAdminOverlayPresent: false,
    submitVisible: true,
    submitEnabled: true,
    ready: true,
  });
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const tap = source.slice(
    source.indexOf('async function tapResource('),
    source.indexOf('async function enterTerminalBusinessInput('),
  );
  assert.match(
    tap,
    /KEYBOARD_BLOCKED_SUBMIT_RESOURCE_IDS\.has\(resourceId\)[\s\S]*ui\.base\.input:virtual-keyboard[\s\S]*VK_ANDROID_FORM_SUBMIT_BLOCKED_BY_KEYBOARD/,
  );
  assert.match(source, /'terminal\.activation\.submit'[\s\S]*'sample\.auth\.login:submit'/);
  assert.match(
    tap,
    /KEYBOARD_BLOCKED_SUBMIT_RESOURCE_IDS\.has\(resourceId\)[\s\S]*VK_ANDROID_FORM_SUBMIT_BLOCKED_BY_KEYBOARD/,
  );
  const fixture = source.slice(
    source.indexOf('async function runActivationFixtureInput('),
    source.indexOf('async function seedW7Clipboard('),
  );
  assert.match(fixture, /ui\.base\.input:virtual-keyboard:complete/);
  assert.match(fixture, /ACTIVATION_SUBMIT_READY/);
  assert.match(fixture, /VK_ANDROID_ACTIVATION_SUBMIT_NOT_READY/);
});

test('admin launcher gesture uses the bounded five-tap physical point plan', () => {
  const plan = adminLauncherTapPlan(0);
  assert.equal(plan.length, 5);
  assert.deepEqual(
    plan.map(item => item.tapIndex),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(plan[0].args, ['shell', 'input', '-d', '0', 'tap', '48', '48']);
  assert.deepEqual(plan[4].args, ['shell', 'input', '-d', '0', 'tap', '48', '48']);
  assert.throws(() => adminLauncherTapPlan(-1), /VK_ANDROID_ADMIN_LAUNCH_DISPLAY_INVALID/);
  assert.throws(() => adminLauncherTapPlan(1.5), /VK_ANDROID_ADMIN_LAUNCH_DISPLAY_INVALID/);
});

test('URL symbol taps use the shifted-state nodes only after confirming unchanged key geometry', () => {
  assert.equal(
    sameResourceNodeBounds({left: 1, top: 2, right: 10, bottom: 11}, {left: 1, top: 2, right: 10, bottom: 11}),
    true,
  );
  assert.equal(
    sameResourceNodeBounds({left: 1, top: 2, right: 10, bottom: 11}, {left: 1, top: 3, right: 10, bottom: 11}),
    false,
  );
  assert.equal(sameResourceNodeBounds(null, {left: 1, top: 2, right: 10, bottom: 11}), false);

  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const action = source.slice(
    source.indexOf('async function insertUrlSymbolSequence('),
    source.indexOf('async function doCleanup('),
  );
  assert.match(action, /shiftedShift\.selected/);
  assert.match(action, /sameResourceNodeBounds\(item\.node, keys\[index\]\.node\)/);
  assert.match(action, /tapNodeCenter\(\s*manifest,\s*device,\s*display\.id,\s*shiftedKeys\[index\]\.node/);
  assert.match(action, /tapNodeCenter\(\s*manifest,\s*device,\s*display\.id,\s*shiftedShift/);
});

test('screenshot proof requires an app window identity scoped to its logical display and file dimensions', () => {
  const xml =
    '<hierarchy><display id="0"><window id="w-primary"><node class="android.widget.FrameLayout" package="com.anonymous.sampleterminal" resource-id="sample.auth.login" bounds="[0,0][1280,800]"/></window></display><display id="2"><window id="w-secondary"><node class="android.widget.FrameLayout" package="com.other.app" resource-id="other:root" bounds="[0,0][1280,800]"/></window></display></hierarchy>';
  assert.deepEqual(parseDisplayWindowIdentity(xml, 0, 'com.anonymous.sampleterminal'), {
    logicalDisplayId: 0,
    packageName: 'com.anonymous.sampleterminal',
    rootClass: 'android.widget.FrameLayout',
    rootResourceId: 'sample.auth.login',
  });
  assert.throws(
    () => parseDisplayWindowIdentity(xml, 2, 'com.anonymous.sampleterminal'),
    /VK_ANDROID_CAPTURE_WINDOW_IDENTITY_UNPROVEN/,
  );
  assert.deepEqual(
    parsePngFileDescription('/tmp/cap.png: PNG image data, 1280 x 800, 8-bit/color RGBA, non-interlaced'),
    {
      description: 'PNG image data, 1280 x 800, 8-bit/color RGBA, non-interlaced',
      width: 1280,
      height: 800,
    },
  );
  assert.throws(() => parsePngFileDescription('/tmp/cap.png: ASCII text'), /VK_ANDROID_CAPTURE_FILE_TYPE_INVALID/);
  const inventory = parseVisibleControlInventory(
    '<hierarchy><display id="0"><node resource-id="keyboard:key" class="android.widget.Button" bounds="[1,2][9,10]" enabled="true" selected="false" clickable="true" text=":/.?&amp;=-_%+" content-desc="符号键"/><node class="android.widget.TextView" text="敏感输入"/></display><display id="2"><node resource-id="other:key"/></display></hierarchy>',
    0,
  );
  assert.equal(inventory.length, 2);
  assert.equal(inventory[0].resourceId, 'keyboard:key');
  assert.deepEqual(inventory[0].bounds, {left: 1, top: 2, right: 9, bottom: 10});
  assert.equal(inventory[0].hasText, true);
  assert.equal(inventory[0].hasContentDescription, true);
  assert.equal(inventory[1].hasText, true);
  assert.equal(Object.hasOwn(inventory[1], 'textSha256'), false);
  assert.equal(Object.hasOwn(inventory[1], 'contentDescriptionSha256'), false);
  assert.doesNotMatch(JSON.stringify(inventory), /敏感输入/);
  assert.equal(JSON.stringify(inventory).includes(createHash('sha256').update('敏感输入').digest('hex')), false);
  assert.equal(JSON.stringify(inventory).includes('敏感输入'), false);
  assert.throws(() => parseVisibleControlInventory('<hierarchy/>', 0), /VK_ANDROID_CONTROL_INVENTORY_DISPLAY_MISSING/);
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const captureSource = source.slice(
    source.indexOf('async function capture('),
    source.indexOf('async function tapResource('),
  );
  assert.match(captureSource, /parseDisplayWindowIdentity\(/);
  assert.match(captureSource, /cmd', 'display', 'get-displays/);
  assert.match(captureSource, /dumpsys', 'display/);
  assert.match(captureSource, /dumpsys', 'SurfaceFlinger', '--displays/);
  assert.match(captureSource, /resolveCaptureDisplayInventory\(/);
  assert.match(captureSource, /'file', \[file\]/);
  assert.match(captureSource, /dumpsys-display\.txt/);
  assert.match(captureSource, /surfaceflinger-displays\.txt/);
  assert.match(captureSource, /parseVisibleControlInventory\(/);
  assert.match(captureSource, /\.controls\.json/);
  assert.match(captureSource, /controlsInventory:/);
  assert.match(source, /perControlVisualAuditRows\(manifest\.frameMatrix\)/);
});

test('URL symbol business oracle hashes only the exact ten synthetic inserted characters', () => {
  assert.deepEqual(URL_SYMBOL_KEYS, [
    {keyId: 'text-1', value: ':'},
    {keyId: 'text-2', value: '/'},
    {keyId: 'text-3', value: '.'},
    {keyId: 'text-4', value: '?'},
    {keyId: 'text-5', value: '&'},
    {keyId: 'text-6', value: '='},
    {keyId: 'text-7', value: '-'},
    {keyId: 'text-8', value: '_'},
    {keyId: 'text-9', value: '%'},
    {keyId: 'text-0', value: '+'},
  ]);
  assert.equal(URL_SYMBOL_SEQUENCE, ':/ .?&=-_%+'.replace(' ', ''));
  assert.equal(typeof runner.resolveUrlSymbolHarnessField, 'function');
  if (typeof runner.resolveUrlSymbolHarnessField !== 'function') return;
  const loginOnlyXml =
    '<hierarchy><display id="0"><node resource-id="sample.auth.login:operator-name" text="" enabled="true" bounds="[1,2][9,10]"/></display></hierarchy>';
  assert.equal(runner.resolveUrlSymbolHarnessField(loginOnlyXml, 0), null);
  const harnessXml =
    '<hierarchy><display id="0"><node resource-id="harness:full-field" text=":/.?&amp;=-_%+" enabled="true" bounds="[1,2][9,10]"/><node resource-id="sample.auth.login:operator-name" text="must-not-read" enabled="true" bounds="[11,12][19,20]"/></display></hierarchy>';
  assert.deepEqual(runner.resolveUrlSymbolHarnessField(harnessXml, 0), {
    fieldId: 'harness:full-field',
    node: {left: 1, top: 2, right: 9, bottom: 10, enabled: true, selected: false},
    textSha256: createHash('sha256').update(URL_SYMBOL_SEQUENCE).digest('hex'),
  });
  const digest = parseHarnessTextHash(harnessXml, 'harness:full-field', 0);
  assert.equal(digest, createHash('sha256').update(URL_SYMBOL_SEQUENCE).digest('hex'));
  assert.doesNotMatch(digest, /[:/?&=_%+]/);
  assert.throws(
    () =>
      parseHarnessTextHash(
        '<hierarchy><display id="0"><node resource-id="sample.auth.login:passcode"/></display></hierarchy>',
        'sample.auth.login:passcode',
        0,
      ),
    /VK_ANDROID_SENSITIVE_VALUE_HASH_FORBIDDEN/,
  );
  assert.throws(
    () =>
      parseHarnessTextHash(
        '<hierarchy><display id="0"><node resource-id="terminal.activation.code" text="00123456"/></display></hierarchy>',
        'terminal.activation.code',
        0,
      ),
    /VK_ANDROID_SENSITIVE_VALUE_HASH_FORBIDDEN/,
  );
  assert.throws(
    () =>
      parseHarnessTextHash(
        '<hierarchy><display id="0"><node resource-id="harness:full-field"/></display></hierarchy>',
        'harness:full-field',
        0,
      ),
    /VK_ANDROID_RESOURCE_TEXT_MISSING/,
  );
  const keyboardLabelXml =
    '<hierarchy><display id="0"><node resource-id="ui.base.input:virtual-keyboard:text-1" text="" content-desc="1" enabled="true" bounds="[1,2][9,10]"/></display></hierarchy>';
  assert.equal(
    parseResourceContentDescriptionHash(keyboardLabelXml, 'ui.base.input:virtual-keyboard:text-1', 0),
    createHash('sha256').update('1').digest('hex'),
  );
  assert.throws(
    () =>
      parseResourceContentDescriptionHash(
        '<hierarchy><display id="0"><node resource-id="ui.base.input:virtual-keyboard:text-1" text="" /></display></hierarchy>',
        'ui.base.input:virtual-keyboard:text-1',
        0,
      ),
    /VK_ANDROID_RESOURCE_CONTENT_DESCRIPTION_MISSING/,
  );
  assert.throws(
    () => parseResourceContentDescriptionHash('<hierarchy/>', 'sample.member:phone', 0),
    /VK_ANDROID_SENSITIVE_VALUE_HASH_FORBIDDEN/,
  );

  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const action = source.slice(
    source.indexOf('async function insertUrlSymbolSequence('),
    source.indexOf('async function doCleanup('),
  );
  assert.match(action, /URL_SYMBOL_KEYS/);
  assert.match(action, /parseResourceContentDescriptionHash\(xml, item\.id, display\.id\)/);
  assert.match(action, /observedSha256 === expectedSha256/);
  assert.match(action, /submitted: false/);
  assert.doesNotMatch(action, /URL_SYMBOL_FIELD_ID/);
  assert.match(action, /controlledKeyboardHarnessIntentArgs\(APPS\[appName\]\.activity\)/);
  assert.match(action, /remoteProcessIdentityMatches\(ownedApp, beforeRoute, device\.serial\)/);
  assert.match(action, /remoteProcessIdentityMatches\(ownedApp, afterRoute, device\.serial\)/);
  assert.match(action, /VK_ANDROID_CONTROLLED_HARNESS_FIELD_NOT_OBSERVED/);
  assert.doesNotMatch(action, /sample\.auth\.login:operator-name|sample\.auth\.login:submit|login\.submit/);
  assert.match(source, /insert-url-symbol-sequence.*insertUrlSymbolSequence/s);
});

test('sensitive Android probe paths persist only redacted outcomes and never value digests', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  const regions = [
    source.slice(source.indexOf('async function typeW7Probe('), source.indexOf('async function capture(')),
    source.slice(
      source.indexOf('async function runActivationFixtureInput('),
      source.indexOf('async function seedW7Clipboard('),
    ),
    source.slice(
      source.indexOf('async function longPressW7Input('),
      source.indexOf('async function triggerAdminLauncherGesture('),
    ),
    source.slice(
      source.indexOf('async function sendW2TextProbe('),
      source.indexOf('async function sendW2HardwareKey('),
    ),
    source.slice(
      source.indexOf('export function summarizeJavaScriptRuntimeErrorDetails('),
      source.indexOf('export function summarizeDebugFailureInjectionLogcat('),
    ),
  ];
  assert.ok(regions.every(region => region.length > 0));
  for (const region of regions) {
    assert.doesNotMatch(region, /(?:text|value|observed|expected|message)Sha256\s*:/i);
    assert.doesNotMatch(region, /sha256\((?:observedValue|observedStateValue|value|message|fixture\.activationCode)/);
  }
  assert.match(regions[0], /observedValue === expectedValue/);
  assert.match(regions[1], /activationFixtureInputEvidence/);
  assert.match(regions[2], /valuePreserved: true/);
  assert.match(regions[3], /dispatchAccepted: true/);
  assert.match(regions[3], /W2_TEXT_PROBE=DISPATCHED/);
  assert.doesNotMatch(regions[4], /messageSha256/);
});

test('managed device runner cannot clear app data or global device logs', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/test/ter-virtual-keyboard-android.mjs'), 'utf8');
  assert.match(source, /check-runtime-resource-budget/);
  assert.match(source, /canonicalStartToken/);
  assert.match(source, /bootId/);
  assert.match(source, /startTicks/);
  assert.doesNotMatch(source, /pm\s+clear/);
  assert.doesNotMatch(source, /logcat['",\s]+['"]?-c/);
  assert.match(source, /args\['dual-serial'\]/);
  assert.match(source, /args\['mobile-serial'\]/);
  assert.doesNotMatch(source, /emulator-555[0-9]/);
});

test('controlled keyboard harness accepts only its exact explicit route', () => {
  assert.equal(typeof runner.isControlledKeyboardHarnessUrl, 'function');
  assert.equal(typeof runner.CONTROLLED_KEYBOARD_HARNESS_URL, 'string');
  if (typeof runner.isControlledKeyboardHarnessUrl !== 'function') return;
  const route = runner.CONTROLLED_KEYBOARD_HARNESS_URL;
  assert.equal(route, 'ter-vk://controlled/full');
  assert.equal(runner.isControlledKeyboardHarnessUrl(route), true);
  assert.equal(runner.isControlledKeyboardHarnessUrl(`${route}/unexpected`), false);
  assert.equal(runner.isControlledKeyboardHarnessUrl(`${route}?field=sample.auth.login`), false);
  assert.equal(runner.isControlledKeyboardHarnessUrl(null), false);
});

test('both Android apps mount the harness only from the exact primary-surface route and declare its UI dependencies', () => {
  const appDirectories = [
    'apps/terminal/application/android/sample-terminal',
    'apps/terminal/application/android/sample-wallpaper-terminal',
  ];
  for (const directory of appDirectories) {
    const appSource = fs.readFileSync(path.join(root, directory, 'App.tsx'), 'utf8');
    const harnessSource = fs.readFileSync(
      path.join(root, directory, 'src/components/controlledKeyboardHarness.tsx'),
      'utf8',
    );
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, directory, 'package.json'), 'utf8'));
    const dependenciesSource = fs.readFileSync(path.join(root, directory, 'src/dependencies.ts'), 'utf8');

    assert.match(appSource, /useControlledKeyboardHarness\(displayIndex !== 1\)/);
    assert.match(appSource, /if \(controlledKeyboardHarness\) return <ControlledKeyboardHarness \/>/);
    assert.match(harnessSource, /ter-vk:\/\/controlled\/full/);
    assert.match(harnessSource, /value === CONTROLLED_KEYBOARD_HARNESS_URL/);
    assert.match(harnessSource, /Linking\.addEventListener\('url'/);
    assert.match(harnessSource, /<InputSurfaceFrame>/);
    assert.match(harnessSource, /useInputField\(/);
    assert.match(harnessSource, /<PrimitiveInput \{\.\.\.field\.inputProps\}/);
    assert.match(harnessSource, /fieldId: 'harness:full-field'/);
    assert.match(harnessSource, /testID: 'harness:full-field'/);
    assert.match(harnessSource, /layout: 'full'/);
    assert.doesNotMatch(harnessSource, /sample\.auth\.login|sample\.desk\.|dispatchAction|onSubmit|payload/i);
    assert.equal(packageJson.dependencies['@catering-v2s/ui-base-input'], 'workspace:*');
    assert.equal(packageJson.dependencies['@catering-v2s/ui-base-primitives'], 'workspace:*');
    assert.match(dependenciesSource, /@catering-v2s\/ui-base-input/);
    assert.match(dependenciesSource, /@catering-v2s\/ui-base-primitives/);
  }
});

test('controlled harness is entered by an explicit VIEW intent without stopping the owned app', () => {
  assert.equal(typeof runner.controlledKeyboardHarnessIntentArgs, 'function');
  if (typeof runner.controlledKeyboardHarnessIntentArgs !== 'function') return;
  assert.deepEqual(runner.controlledKeyboardHarnessIntentArgs('com.example/.MainActivity'), [
    'shell',
    'am',
    'start',
    '-W',
    '-n',
    'com.example/.MainActivity',
    '-a',
    'android.intent.action.VIEW',
    '-d',
    runner.CONTROLLED_KEYBOARD_HARNESS_URL,
  ]);
  assert.throws(
    () => runner.controlledKeyboardHarnessIntentArgs('com.example;pm clear'),
    /VK_ANDROID_HARNESS_ACTIVITY_INVALID/,
  );
  assert.throws(
    () => runner.controlledKeyboardHarnessIntentArgs('com.example/.Main$Activity'),
    /VK_ANDROID_HARNESS_ACTIVITY_INVALID/,
  );
});

test('controlled-harness screenshots remain separate from the 19 product IA-frame denominator', () => {
  assert.equal(typeof runner.recordCapture, 'function');
  if (typeof runner.recordCapture !== 'function') return;
  const manifest = {frameMatrix: emptyFrameMatrix()};
  const record = {
    shape: 'dual',
    app: 'sample-terminal',
    iaId: 'VK-IA-09',
    surface: 'primary',
    screenshot: 'evidence/harness-shift.png',
    captureEvidence: 'evidence/harness-shift.capture-evidence.json',
    state: 'controlled-harness-url-symbol-shift',
    transitionIndex: null,
  };
  runner.recordCapture(manifest, 'VK-IA-09', record, 'CONTROLLED_HARNESS');
  assert.equal(manifest.frameMatrix['VK-IA-09'].captures.length, 0);
  assert.equal(manifest.controlledHarnessCaptures.length, 1);
  assert.equal(manifest.controlledHarnessCaptures[0].evidenceKind, 'CONTROLLED_HARNESS');
  assert.equal(manifest.controlledHarnessCaptures[0].coveredIaId, 'VK-IA-09');
  assert.equal(
    captureObservationMatrix(manifest.frameMatrix)['VK-IA-09'].routes['dual/sample-terminal/primary'].status,
    'OPEN_NOT_OBSERVED',
  );
  assert.throws(
    () => runner.recordCapture(manifest, 'VK-IA-09', {...record, iaId: 'VK-IA-08'}, 'CONTROLLED_HARNESS'),
    /VK_ANDROID_IA_ID_OUT_OF_RANGE/,
  );
});

test('transition samples use the shared product capture registration with explicit evidence kind', () => {
  const manifest = {frameMatrix: emptyFrameMatrix()};
  const record = {
    shape: 'dual',
    app: 'sample-terminal',
    iaId: 'VK-IA-15',
    surface: 'primary',
    screenshot: 'evidence/transition-1.png',
    captureEvidence: 'evidence/transition-1.capture-evidence.json',
    transitionVideo: 'evidence/transition.mp4',
    state: 'transition-video-sample-1-uncalibrated',
    transitionIndex: 1,
    controlsInventory: null,
    visibleControlCount: 0,
    visibleControls: [],
  };

  runner.recordCapture(manifest, 'VK-IA-15', record, 'PRODUCT_TRANSITION_SAMPLE');
  assert.equal(manifest.frameMatrix['VK-IA-15'].captures.length, 1);
  assert.equal(manifest.frameMatrix['VK-IA-15'].captures[0].evidenceKind, 'PRODUCT_TRANSITION_SAMPLE');
  assert.equal(manifest.frameMatrix['VK-IA-15'].reason, 'AWAITING_PER_CONTROL_VISUAL_JUDGMENT');
  assert.throws(
    () => runner.recordCapture(manifest, 'VK-IA-15', record, 'UNKNOWN_PRODUCT_CAPTURE'),
    /VK_ANDROID_CAPTURE_EVIDENCE_KIND_INVALID/,
  );

  const source = fs.readFileSync(new URL('./ter-virtual-keyboard-android.mjs', import.meta.url), 'utf8');
  assert.match(source, /recordCapture\(manifest, iaId, capture, 'PRODUCT_TRANSITION_SAMPLE'\)/);
  assert.doesNotMatch(source, /manifest\.frameMatrix\[iaId\]\.captures\.push\(capture\)/);
});
