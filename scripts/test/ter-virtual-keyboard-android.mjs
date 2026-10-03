#!/usr/bin/env node
// Managed Android keyboard evidence CLI. Requires explicit dual/mobile serials;
// never clears app data or device logs. All dynamic commands are run through
// this entrypoint so process, device, screenshot, and cleanup evidence is bound.
// Usage: prepare --run-id ID --dual-serial SERIAL --mobile-serial SERIAL [--authorization FIXED_TOKEN];
// bridge-dev-tunnels --run-id ID --device dual|mobile --app APP;
// build --run-id ID --app APP; launch/inspect/tap/capture/transition/insert-url-symbol-sequence --run-id ID
// with the explicit --device dual|mobile and the action-specific IA/testID fields;
// business-input --value-key, assert-business-text --expectation, assert-business-screen/wait-business-screen,
// and assert-business-member-readback are finite, redacted test oracles;
// business-clock emits the attached Android VM's epoch milliseconds for bounded log projection;
// W7 uses w7-seed-clipboard and w7-long-press through this managed runner; input values are compared only in memory.
// inject-debug-failure sends a debug-only VIEW event to an already-owned process without Activity wait;
// diagnose-pending-launch --run-id ID resolves only the exact pending launch after host/boot/process readback;
// inspect-resolved-launch --run-id ID reads whitelisted startup breadcrumbs for an exact resolved absent launch;
// reinspect-resolved-launch-logs --run-id ID --intent-id EXACT rereads bounded, whitelisted logcat for one absent launch;
// cleanup --run-id ID always closes only the exact identities created by this run.
// cleanup --run-id ID --recover-invalidated-launches yes repairs only exact historical PROCESS_ABSENT resolutions
// produced by this runner's former broken process reader, then cleans their current package-bound identities.

import {createHash} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  canonicalStartToken,
  readProcessTable,
  snapshotProcessTree,
  terminateOwnedProcessTree,
} from '../dev/managed-process-tree.mjs';
import {parseAvdNameReply} from '../../tools/terminal-topology/device-identity.mjs';
import {terminalBusinessMemberFixture} from './terminal-business-fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUNTIME_ROOT = path.join(ROOT, '.runtime/ter-virtual-keyboard-android');
const REPOSITORY_RUNTIME_ROOT = path.join(ROOT, '.runtime');
const EVIDENCE_ROOT = path.join(ROOT, 'doc/evidence/platform/2026-09-24-ter-virtual-keyboard-optimization/android');
const A11_BASELINE_ROOT = path.join(ROOT, '.runtime/ter-third-party-usage-remediation/cp-a/a6/prechange');
const SERIAL_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const RUN_AUTHORIZATIONS = Object.freeze([
  'TER_VIRTUAL_KEYBOARD_OPTIMIZATION_IMPLEMENTATION_CP4_DUAL_AND_MOBILE_ONLY',
  'TER_ACTIVATION_INTERACTION_PAIR_TOPOLOGY_IMPLEMENTATION',
]);
const TERMINAL_BUSINESS_INPUTS = Object.freeze({
  'staff-name': Object.freeze({
    apps: Object.freeze(['sample-terminal', 'sample-wallpaper-terminal']),
    resourceId: 'sample.auth.login:operator-name',
    value: 'A001',
  }),
  'staff-passcode': Object.freeze({
    apps: Object.freeze(['sample-terminal', 'sample-wallpaper-terminal']),
    resourceId: 'sample.auth.login:passcode',
    value: '1111',
  }),
  'member-name': Object.freeze({
    apps: Object.freeze(['sample-terminal']),
    resourceId: 'sample.desk.member-form:name',
    valueForRun: runId => terminalBusinessMemberFixture(runId).name,
  }),
  'member-phone': Object.freeze({
    apps: Object.freeze(['sample-terminal']),
    resourceId: 'sample.desk.member-form:phone',
    valueForRun: runId => terminalBusinessMemberFixture(runId).phone,
  }),
  'member-age': Object.freeze({
    apps: Object.freeze(['sample-terminal']),
    resourceId: 'sample.desk.customer-member:age',
    value: '37',
  }),
});
const TERMINAL_BUSINESS_TEXT = Object.freeze({
  'activation-active': Object.freeze({resourceId: 'terminal.activation.admin:state', expectedText: '激活状态：已激活'}),
  'connection-connected': Object.freeze({resourceId: 'terminal.activation.admin:connection', expectedText: '连接状态：已连接'}),
  'activation-disabled': Object.freeze({resourceId: 'terminal.activation.result', expectedText: '终端已停用，暂时无法激活。'}),
});
export const TERMINAL_BUSINESS_SCREENS = Object.freeze({
  activation: Object.freeze({
    required: Object.freeze(['terminal.activation.screen', 'terminal.activation.code', 'terminal.activation.submit']),
  }),
  'staff-login': Object.freeze({
    required: Object.freeze([
      'sample.auth.login',
      'sample.auth.login:operator-name',
      'sample.auth.login:passcode',
      'sample.auth.login:submit',
    ]),
  }),
  'member-list-host': Object.freeze({
    required: Object.freeze(['sample.desk.member-list', 'sample.desk.member-list:title', 'sample.desk.member-list:scroll']),
  }),
  'member-list-branch': Object.freeze({
    required: Object.freeze(['sample.desk.branch.member-list', 'sample.desk.branch.member-list:title', 'sample.desk.branch.member-list:scroll']),
    forbidden: Object.freeze([
      'sample.desk.branch.member-list:logout',
      'sample.desk.member-list',
      'sample.desk.member-list:logout',
    ]),
  }),
  'member-form-host': Object.freeze({required: Object.freeze([
    'sample.desk.member-form',
    'sample.desk.member-form:name',
    'sample.desk.member-form:phone',
    'sample.desk.member-form:submit',
    'sample.desk.member-form:cancel',
  ])}),
  'customer-confirmation-host': Object.freeze({required: Object.freeze([
    'sample.desk.customer-member',
    'sample.desk.customer-member:name',
    'sample.desk.customer-member:phone',
    'sample.desk.customer-member:confirm',
    'sample.desk.customer-member:reject',
  ])}),
  'customer-confirmation-branch': Object.freeze({required: Object.freeze([
    'sample.desk.branch.customer-member',
    'sample.desk.branch.customer-member:name',
    'sample.desk.branch.customer-member:phone',
    'sample.desk.branch.customer-member:confirm',
    'sample.desk.branch.customer-member:reject',
  ]), forbidden: Object.freeze(['sample.desk.customer-member'])}),
  'wallpaper-host-mobile': Object.freeze({
    required: Object.freeze([
      'sample.wallpaper.picker',
      'sample.wallpaper.picker:options:w1',
      'sample.wallpaper.picker:options:w2',
      'sample.wallpaper.picker:options:w3',
      'sample.wallpaper.picker:options:none',
      'sample.wallpaper.picker:confirm',
      'sample.wallpaper.picker:logout',
    ]),
    forbidden: Object.freeze(['sample.wallpaper.picker:exit']),
  }),
  'wallpaper-host-laptop': Object.freeze({required: Object.freeze([
    'sample.wallpaper.picker',
    'sample.wallpaper.picker:options:w1',
    'sample.wallpaper.picker:options:w2',
    'sample.wallpaper.picker:options:w3',
    'sample.wallpaper.picker:options:none',
    'sample.wallpaper.picker:confirm',
    'sample.wallpaper.picker:exit',
    'sample.wallpaper.picker:logout',
  ])}),
  'wallpaper-slave': Object.freeze({
    required: Object.freeze([
      'sample.wallpaper.branch.picker',
      'sample.wallpaper.branch.picker:option.w1',
      'sample.wallpaper.branch.picker:option.w2',
      'sample.wallpaper.branch.picker:option.w3',
      'sample.wallpaper.branch.picker:option.none',
      'sample.wallpaper.branch.picker:confirm',
      'sample.wallpaper.branch.picker:exit',
    ]),
    forbidden: Object.freeze(['sample.wallpaper.picker', 'sample.wallpaper.picker:logout']),
  }),
  'activation-admin': Object.freeze({
    required: Object.freeze([
      'terminal.activation.admin.status',
      'terminal.activation.admin:state',
      'terminal.activation.admin:connection',
      'terminal.activation.admin:latency',
      'terminal.activation.admin.cancel',
    ]),
  }),
});
const IA_IDS = Object.freeze(Array.from({length: 19}, (_, index) => `VK-IA-${String(index + 1).padStart(2, '0')}`));
const FULL_KEY_IDS = Object.freeze([
  ...Array.from('1234567890', value => `text-${value}`),
  ...Array.from('qwertyuiopasdfghjklzxcvbnm', value => `text-${value}`),
  'shift',
  'space',
  'backspace',
  'complete',
]);
const ALPHA_KEY_IDS = Object.freeze([
  ...Array.from('qwertyuiopasdfghjklzxcvbnm', value => `text-${value}`),
  'shift',
  'space',
  'backspace',
  'complete',
]);
const NUMERIC_KEY_IDS = Object.freeze([...Array.from('1234567890', value => `text-${value}`), 'backspace', 'complete']);
const FINANCIAL_KEY_IDS = Object.freeze([
  ...Array.from('1234567890', value => `text-${value}`),
  'text--',
  'text-.',
  'backspace',
  'complete',
]);
const W2_INPUT_PROBES = Object.freeze({
  'staff-name': 'STAFFPROBE',
  'staff-passcode': '1111',
  'covered-text': 'Z',
  'scanner-text': 'SCAN',
  'overlay-host': '198.51.100.8',
});
const W7_CLIPBOARD_SENTINEL = 'terw7clipboard';
const W7_PROBE_TEXT_BY_RESOURCE_ID = Object.freeze({
  'sample.auth.login:operator-name': W7_CLIPBOARD_SENTINEL,
  'sample.auth.login:passcode': '1111',
  'sample.desk.customer-member:age': '123',
  'sample.desk.member-form:name': 'terw7',
  'sample.desk.member-form:phone': '12345678',
  'sample.desk.member-form:keyboard-alpha-probe': 'terw7',
  'sample.desk.member-form:keyboard-financial-probe': '12.34',
  'terminal.admin:topology:host': '192.0.2.1',
  'harness:full-field': 'terw7',
});
const W7_INPUT_RESOURCE_IDS = new Set([
  'sample.auth.login:operator-name',
  'sample.auth.login:passcode',
  'sample.desk.customer-member:age',
  'sample.desk.member-form:name',
  'sample.desk.member-form:phone',
  'sample.desk.member-form:keyboard-alpha-probe',
  'sample.desk.member-form:keyboard-financial-probe',
  'terminal.admin:topology:host',
  'harness:full-field',
]);
const W7_CLIPBOARD_KEYS = Object.freeze({
  'select-all': Object.freeze(['keycombination', 'KEYCODE_CTRL_LEFT', 'KEYCODE_A']),
  copy: Object.freeze(['keycombination', 'KEYCODE_CTRL_LEFT', 'KEYCODE_C']),
  paste: Object.freeze(['keycombination', 'KEYCODE_CTRL_LEFT', 'KEYCODE_V']),
  delete: Object.freeze(['keyevent', 'KEYCODE_DEL']),
});
const W2_HARDWARE_KEYS = Object.freeze({
  tab: Object.freeze(['keyevent', 'KEYCODE_TAB']),
  'shift-tab': Object.freeze(['keycombination', 'KEYCODE_SHIFT_LEFT', 'KEYCODE_TAB']),
  enter: Object.freeze(['keyevent', 'KEYCODE_ENTER']),
});
const KEY_IDS_BY_LAYOUT = Object.freeze({
  full: FULL_KEY_IDS,
  alpha: ALPHA_KEY_IDS,
  numeric: NUMERIC_KEY_IDS,
  financial: FINANCIAL_KEY_IDS,
});
const LAPTOP_IA_IDS = new Set([
  'VK-IA-01',
  'VK-IA-03',
  'VK-IA-05',
  'VK-IA-07',
  'VK-IA-09',
  'VK-IA-15',
  'VK-IA-16',
  'VK-IA-17',
  'VK-IA-19',
]);
const MOBILE_IA_IDS = new Set(['VK-IA-02', 'VK-IA-04', 'VK-IA-06', 'VK-IA-08', 'VK-IA-10']);
const SAMPLE_TERMINAL_ONLY_IA_IDS = new Set(['VK-IA-03', 'VK-IA-04', 'VK-IA-07', 'VK-IA-08', 'VK-IA-15', 'VK-IA-16']);
const FRAME_LAYOUTS = Object.freeze({
  'VK-IA-01': ['full'],
  'VK-IA-02': ['full'],
  'VK-IA-03': ['alpha'],
  'VK-IA-04': ['alpha'],
  'VK-IA-05': ['numeric'],
  'VK-IA-06': ['numeric'],
  'VK-IA-07': ['financial'],
  'VK-IA-08': ['financial'],
  'VK-IA-09': ['full'],
  'VK-IA-10': ['full'],
  'VK-IA-11': ['full'],
  'VK-IA-12': ['numeric'],
  'VK-IA-13': ['numeric'],
  'VK-IA-14': ['full'],
  'VK-IA-15': ['numeric', 'alpha'],
  'VK-IA-16': ['alpha', 'financial'],
  'VK-IA-17': ['numeric', 'financial'],
  'VK-IA-18': ['full'],
  'VK-IA-19': ['numeric'],
});
const FRAME_EXTRA_CONTROLS = Object.freeze({
  'VK-IA-11': [
    'geometry:surface-content-box',
    'geometry:focus-frame',
    'sample.auth.login:submit',
    'sample.desk.member-form:submit',
    'sample.desk.member-form:cancel',
  ],
  'VK-IA-12': [
    'geometry:surface-backdrop',
    'terminal.admin:login',
    'terminal.admin:login:card',
    'terminal.admin:password-input',
    'terminal.admin:verify',
    'terminal.admin:close',
  ],
  'VK-IA-13': [
    'terminal.admin:password-input',
    ...Array.from({length: 6}, (_, index) => `terminal.admin:password:digit:${index}`),
    'terminal.admin:verify',
    'terminal.admin:close',
  ],
  'VK-IA-14': [
    'sample.auth.login:operator-name',
    'sample.auth.login:passcode',
    'geometry:same-keyboard-frame',
    'geometry:focus-frame',
  ],
  'VK-IA-15': [
    'sample.desk.member-form:phone',
    'sample.desk.member-form:keyboard-alpha-probe',
    'geometry:outgoing-keyboard',
    'geometry:incoming-keyboard',
    'geometry:focus-frame',
    'geometry:presentation-offset',
  ],
  'VK-IA-16': [
    'sample.desk.member-form:keyboard-alpha-probe',
    'sample.desk.member-form:keyboard-financial-probe',
    'geometry:outgoing-keyboard',
    'geometry:incoming-keyboard',
    'geometry:focus-frame',
    'geometry:presentation-offset',
  ],
  'VK-IA-17': [
    'harness:numeric-field',
    'harness:financial-field',
    'geometry:outgoing-keyboard',
    'geometry:incoming-keyboard',
    'geometry:single-input-owner',
  ],
  'VK-IA-18': [
    'geometry:scroll-viewport',
    'sample.auth.login:operator-name',
    'sample.auth.login:passcode',
    'harness:upper-edge-clipping',
    'harness:lower-edge-clipping',
    'harness:focus-next-offscreen',
    'harness:oversize-field',
  ],
  'VK-IA-19': [
    'geometry:primary-surface-frame',
    'geometry:secondary-surface-frame',
    'sample.desk.customer-member:age',
    'geometry:no-cross-surface-size-borrowing',
  ],
});
const FRAME_EXTRA_CONTROLS_BY_APP = Object.freeze({
  'VK-IA-11': Object.freeze({
    'sample-terminal': [
      'sample.desk.member-form',
      'sample.desk.member-form:scroll',
      'sample.desk.member-form:name',
      'sample.desk.member-form:actions',
      'sample.desk.member-form:submit',
      'sample.desk.member-form:cancel',
    ],
    'sample-wallpaper-terminal': [
      'sample.auth.login',
      'sample.auth.login:scroll',
      'sample.auth.login:operator-name',
      'sample.auth.login:actions',
      'sample.auth.login:submit',
    ],
  }),
});
const SHAPES = Object.freeze({
  dual: Object.freeze({serialKey: 'dualSerial', shape: 'dual'}),
  mobile: Object.freeze({serialKey: 'mobileSerial', shape: 'mobile'}),
});
const TERMINAL_ACTIVATION_INPUT_ID = 'terminal.activation.code';
const TERMINAL_ACTIVATION_SCREEN_ID = 'terminal.activation.screen';
const VIRTUAL_NUMERIC_KEY_ID = 'ui.base.input:virtual-keyboard:text-';
const BUSINESS_SCREEN_WAIT_TIMEOUT_MS = 20_000;
const BUSINESS_SCREEN_WAIT_POLL_MS = 250;
const UI_DUMP_COMMAND_TIMEOUT_MS = 8_000;
const DEFAULT_MANAGED_COMMAND_TIMEOUT_MS = 60_000;
const DEFAULT_MANAGED_COMMAND_MAX_BYTES = 24 * 1024 * 1024;
const MAX_MANAGED_COMMAND_MAX_BYTES = 128 * 1024 * 1024;
const APPS = Object.freeze({
  'sample-terminal': Object.freeze({
    packageName: 'com.anonymous.sampleterminal',
    activity: 'com.anonymous.sampleterminal/.MainActivity',
    androidRoot: 'apps/terminal/application/android/sample-terminal/android',
  }),
  'sample-wallpaper-terminal': Object.freeze({
    packageName: 'com.catering.v2s.terminal.samplewallpaper',
    activity: 'com.catering.v2s.terminal.samplewallpaper/.MainActivity',
    androidRoot: 'apps/terminal/application/android/sample-wallpaper-terminal/android',
  }),
});
const APP_LAUNCH_BREADCRUMBS = Object.freeze([
  Object.freeze({summary: 'activity.onCreate:start', wire: 'event=activity.onCreate phase=start'}),
  Object.freeze({
    summary: 'native.registry-application-registered',
    wire: 'event=native.registry-application-registered',
  }),
  Object.freeze({summary: 'expo.prevent-auto-hide-set', wire: 'event=expo.prevent-auto-hide-set'}),
  Object.freeze({summary: 'expo.activity-registered', wire: 'event=expo.activity-registered'}),
  Object.freeze({
    summary: 'expo.content-gate-released-for-native-overlay',
    wire: 'event=expo.content-gate-released-for-native-overlay',
  }),
  Object.freeze({summary: 'native.activity-registered', wire: 'event=native.activity-registered'}),
  Object.freeze({summary: 'activity.onCreate:before-super', wire: 'event=activity.onCreate phase=before-super'}),
  Object.freeze({summary: 'activity.onCreate:after-super', wire: 'event=activity.onCreate phase=after-super'}),
  Object.freeze({
    summary: 'native.loading-overlay-attach-call-returned-after-super',
    wire: 'event=native.loading-overlay-attached-after-super',
  }),
  Object.freeze({summary: 'native.loading-overlay-attached', wire: 'event=native.loading-overlay-attached'}),
  Object.freeze({
    summary: 'native.loading-overlay-skipped:gate-unavailable',
    wire: 'event=native.loading-overlay-skipped reason=gate-unavailable',
  }),
  Object.freeze({
    summary: 'native.loading-overlay-skipped:config-unavailable',
    wire: 'event=native.loading-overlay-skipped reason=config-unavailable',
  }),
  Object.freeze({
    summary: 'native.loading-overlay-skipped:content-unavailable',
    wire: 'event=native.loading-overlay-skipped reason=content-unavailable',
  }),
]);
const APP_LAUNCH_BREADCRUMB_SUMMARIES = new Set(APP_LAUNCH_BREADCRUMBS.map(item => item.summary));
const LEGACY_APP_LAUNCH_BREADCRUMB_SUMMARIES = new Set(['native.loading-overlay-attached-after-super']);
const NATIVE_FATAL_SIGNAL_ALLOWLIST = new Set([
  'SIGABRT',
  'SIGBUS',
  'SIGFPE',
  'SIGILL',
  'SIGSEGV',
  'SIGSYS',
  'SIGTRAP',
]);
const MAX_REINSPECTION_PID_LENGTH = 10;
const MAX_REINSPECTION_DIAGNOSTIC_STRING_LENGTH = 256;
const MAX_REINSPECTION_LOCATION_LENGTH = 160;
const PRODUCT_CAPTURE_EVIDENCE_KINDS = Object.freeze(['PRODUCT_FRAME', 'PRODUCT_TRANSITION_SAMPLE']);

function validLaunchBreadcrumbRecord(observedMarkers, markerCount) {
  return (
    Array.isArray(observedMarkers) &&
    Number.isSafeInteger(markerCount) &&
    markerCount >= 0 &&
    observedMarkers.length <= APP_LAUNCH_BREADCRUMB_SUMMARIES.size &&
    markerCount === observedMarkers.length &&
    new Set(observedMarkers).size === observedMarkers.length &&
    observedMarkers.every(marker => APP_LAUNCH_BREADCRUMB_SUMMARIES.has(marker))
  );
}

export const URL_SYMBOL_KEYS = Object.freeze([
  Object.freeze({keyId: 'text-1', value: ':'}),
  Object.freeze({keyId: 'text-2', value: '/'}),
  Object.freeze({keyId: 'text-3', value: '.'}),
  Object.freeze({keyId: 'text-4', value: '?'}),
  Object.freeze({keyId: 'text-5', value: '&'}),
  Object.freeze({keyId: 'text-6', value: '='}),
  Object.freeze({keyId: 'text-7', value: '-'}),
  Object.freeze({keyId: 'text-8', value: '_'}),
  Object.freeze({keyId: 'text-9', value: '%'}),
  Object.freeze({keyId: 'text-0', value: '+'}),
]);
export const URL_SYMBOL_SEQUENCE = URL_SYMBOL_KEYS.map(item => item.value).join('');
const URL_SYMBOL_HARNESS_FIELD_ID = 'harness:full-field';
export const CONTROLLED_KEYBOARD_HARNESS_URL = 'ter-vk://controlled/full';

// The production admin launcher is a five-tap gesture in the physical top-left
// point of the surface. Keep this runner action deliberately narrow: it is not
// a general coordinate injector and it does not bypass the launcher readback
// gate below.
export const ADMIN_LAUNCH_GESTURE_TAP = Object.freeze({x: 48, y: 48, repetitions: 5});

export function adminLauncherTapPlan(displayId) {
  if (!Number.isSafeInteger(displayId) || displayId < 0) fail('VK_ANDROID_ADMIN_LAUNCH_DISPLAY_INVALID');
  return Object.freeze(
    Array.from({length: ADMIN_LAUNCH_GESTURE_TAP.repetitions}, (_, index) =>
      Object.freeze({
        tapIndex: index + 1,
        args: [
          'shell',
          'input',
          '-d',
          String(displayId),
          'tap',
          String(ADMIN_LAUNCH_GESTURE_TAP.x),
          String(ADMIN_LAUNCH_GESTURE_TAP.y),
        ],
      }),
    ),
  );
}

export function parseArgs(argv) {
  const result = {positionals: []};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      result.positionals.push(token);
      continue;
    }
    const key = token.slice(2);
    if (!/^[a-z][a-z0-9-]*$/.test(key) || result[key] !== undefined) fail('VK_ANDROID_ARGUMENT_INVALID');
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) fail('VK_ANDROID_ARGUMENT_VALUE_REQUIRED');
    result[key] = value;
    index += 1;
  }
  return result;
}

export function activationFixtureInputEvidence({fixtureKey, expectedCode, observedValue}) {
  if (!/^[A-Za-z0-9._-]{1,96}$/.test(fixtureKey ?? '')) fail('VK_ANDROID_ACTIVATION_FIXTURE_KEY_INVALID');
  if (!/^\d{8}$/.test(expectedCode ?? '') || typeof observedValue !== 'string')
    fail('VK_ANDROID_ACTIVATION_FIXTURE_INPUT_INVALID');
  return Object.freeze({
    fixtureKey,
    expectedDigitCount: expectedCode.length,
    observedDigitCount: observedValue.length,
    matched: observedValue === expectedCode,
  });
}

export function activationInputBoundaryReadback({expectedValue, observedValue}) {
  if (!/^\d{8}$/.test(expectedValue ?? '') || typeof observedValue !== 'string')
    fail('VK_ANDROID_ACTIVATION_BOUNDARY_READBACK_INVALID');
  return Object.freeze({
    expectedDigitCount: expectedValue.length,
    observedDigitCount: observedValue.length,
    leadingZeroPreserved: observedValue.startsWith('0'),
    exactMatch: observedValue === expectedValue,
    valueRedacted: true,
  });
}

export function activationFixtureActionLabel(shape, purpose, ordinal) {
  if (!['dual', 'mobile'].includes(shape) || !['leading-zero', 'overlength', 'fixture'].includes(purpose))
    fail('VK_ANDROID_ACTIVATION_ACTION_LABEL_INVALID');
  if (!Number.isSafeInteger(ordinal) || ordinal < 1 || ordinal > 16)
    fail('VK_ANDROID_ACTIVATION_ACTION_ORDINAL_INVALID');
  return `${shape}-activation-${purpose}-${String(ordinal).padStart(2, '0')}`;
}

export function terminalBusinessInputValue(runId, valueKey) {
  if (!RUN_ID_RE.test(runId ?? '')) fail('VK_ANDROID_RUN_ID_INVALID');
  const input = TERMINAL_BUSINESS_INPUTS[valueKey];
  if (!input) fail('VK_ANDROID_BUSINESS_INPUT_KEY_INVALID');
  const value = typeof input.valueForRun === 'function' ? input.valueForRun(runId) : input.value;
  if (typeof value !== 'string' || !/^[A-Za-z0-9 ]{1,32}$/u.test(value)) fail('VK_ANDROID_BUSINESS_INPUT_VALUE_INVALID');
  return value;
}

export function terminalBusinessInputKeyPlan(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9 ]{1,32}$/u.test(value)) fail('VK_ANDROID_BUSINESS_INPUT_VALUE_INVALID');
  const keys = [];
  for (const character of value) {
    if (character === ' ') {
      keys.push(Object.freeze({keyId: 'space', uppercase: false}));
    } else if (/^[0-9]$/u.test(character)) {
      keys.push(Object.freeze({keyId: `text-${character}`, uppercase: false}));
    } else {
      keys.push(Object.freeze({keyId: `text-${character.toLowerCase()}`, uppercase: character !== character.toLowerCase()}));
    }
  }
  return Object.freeze(keys);
}

export function terminalBusinessInputReadback(valueKey, expected, observed) {
  const input = TERMINAL_BUSINESS_INPUTS[valueKey];
  if (!input || typeof expected !== 'string') fail('VK_ANDROID_BUSINESS_INPUT_KEY_INVALID');
  if (valueKey === 'staff-passcode') {
    return Object.freeze({
      valueKey,
      resourceId: input.resourceId,
      characterCount: expected.length,
      verification: 'OWNER_OUTCOME_REQUIRED',
      matched: null,
    });
  }
  if (typeof observed !== 'string') fail('VK_ANDROID_BUSINESS_INPUT_READBACK_INVALID');
  return Object.freeze({
    valueKey,
    resourceId: input.resourceId,
    characterCount: expected.length,
    verification: 'FIELD_READBACK',
    matched: observed === expected,
  });
}

export function terminalBusinessMemberReadback(xml, expectedName, expectedPhone, displayId) {
  if (!/^ter[a-f0-9]{10}$/u.test(expectedName ?? '') || !/^010\d{8}$/u.test(expectedPhone ?? '')) {
    fail('VK_ANDROID_BUSINESS_MEMBER_EXPECTATION_INVALID');
  }
  if (!Number.isSafeInteger(Number(displayId)) || Number(displayId) < 0) {
    fail('VK_ANDROID_BUSINESS_MEMBER_DISPLAY_INVALID');
  }
  let scoped = String(xml ?? '');
  const open = new RegExp(`<display\\s+id=["']${Number(displayId)}["'][^>]*>`).exec(scoped);
  if (!open) fail('VK_ANDROID_RESOURCE_NODE_NOT_FOUND');
  const close = scoped.indexOf('</display>', open.index + open[0].length);
  if (close < 0) fail('VK_ANDROID_RESOURCE_NODE_NOT_FOUND');
  scoped = scoped.slice(open.index, close + '</display>'.length);
  const contentNodes = [...scoped.matchAll(/<node\b[^>]*resource-id=["'](sample\.desk\.member-list:row:[A-Za-z0-9._:-]+:content)["'][^>]*>/gu)];
  const decode = value => value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  const target = `${expectedName} ${expectedPhone}`;
  const matchingRows = contentNodes.filter(match => {
    const text = match[0].match(/\btext=["']([^"']*)["']/u)?.[1];
    return text !== undefined && decode(text) === target;
  }).length;
  return Object.freeze({
    rowsObserved: contentNodes.length,
    matchingRows,
    matched: matchingRows === 1,
  });
}

export function terminalBusinessTextAssertion(xml, expectationId, displayId) {
  const expectation = TERMINAL_BUSINESS_TEXT[expectationId];
  if (!expectation) fail('VK_ANDROID_BUSINESS_TEXT_EXPECTATION_INVALID');
  const actual = parseResourceTextValue(xml, expectation.resourceId, displayId);
  return Object.freeze({expectationId, resourceId: expectation.resourceId, matched: actual === expectation.expectedText});
}

export function terminalBusinessScreenAssertion(xml, expectationId, displayId) {
  const expectation = TERMINAL_BUSINESS_SCREENS[expectationId];
  if (!expectation) fail('VK_ANDROID_BUSINESS_SCREEN_EXPECTATION_INVALID');
  if (!Number.isSafeInteger(Number(displayId)) || Number(displayId) < 0) {
    fail('VK_ANDROID_BUSINESS_SCREEN_DISPLAY_INVALID');
  }
  const requiredResourceIds = expectation.required;
  const forbiddenResourceIds = expectation.forbidden ?? [];
  const ambiguousResourceIds = [];
  const hasResource = resourceId => {
    try {
      return parseResourceNode(xml, resourceId, Number(displayId)) !== null;
    } catch (error) {
      if (error?.message !== 'VK_ANDROID_RESOURCE_NODE_AMBIGUOUS') throw error;
      ambiguousResourceIds.push(resourceId);
      return false;
    }
  };
  const missingResourceIds = requiredResourceIds.filter(resourceId => !hasResource(resourceId));
  const unexpectedResourceIds = forbiddenResourceIds.filter(resourceId => hasResource(resourceId));
  return Object.freeze({
    expectationId,
    requiredControlCount: requiredResourceIds.length,
    matchedControlCount: requiredResourceIds.length - missingResourceIds.length,
    missingResourceIds: Object.freeze(missingResourceIds),
    unexpectedResourceIds: Object.freeze(unexpectedResourceIds),
    ambiguousResourceIds: Object.freeze([...new Set(ambiguousResourceIds)]),
    matched: missingResourceIds.length === 0 && unexpectedResourceIds.length === 0 && ambiguousResourceIds.length === 0,
  });
}

export function terminalBusinessScreenWaitMatched(observedMatched, elapsedMs, timeoutMs) {
  if (
    typeof observedMatched !== 'boolean' ||
    !Number.isSafeInteger(elapsedMs) ||
    elapsedMs < 0 ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1
  ) {
    fail('VK_ANDROID_BUSINESS_SCREEN_WAIT_EVIDENCE_INVALID');
  }
  return observedMatched && elapsedMs <= timeoutMs;
}

export function resolveManagedCommandTimeoutMs(value) {
  if (value === undefined) return DEFAULT_MANAGED_COMMAND_TIMEOUT_MS;
  if (!Number.isSafeInteger(value) || value < 1 || value > 0x7fffffff) fail('VK_ANDROID_COMMAND_TIMEOUT_INVALID');
  return value;
}

export function resolveManagedCommandMaxBytes(value) {
  if (value === undefined) return DEFAULT_MANAGED_COMMAND_MAX_BYTES;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_MANAGED_COMMAND_MAX_BYTES) {
    fail('VK_ANDROID_COMMAND_OUTPUT_LIMIT_INVALID');
  }
  return value;
}

export function validateTerminalEmulatorPair(dual, mobile) {
  for (const identity of [dual, mobile]) {
    if (
      !/^emulator-\d+$/.test(identity?.serial ?? '') ||
      !/^[A-Za-z0-9_.-]{1,80}$/.test(identity?.avdName ?? '') ||
      typeof identity?.bootId !== 'string' ||
      !/^[A-Fa-f0-9-]{16,64}$/.test(identity.bootId)
    ) {
      fail('VK_ANDROID_DISTINCT_EMULATOR_IDENTITY_UNPROVEN');
    }
  }
  if (
    dual.serial === mobile.serial ||
    dual.avdName === mobile.avdName ||
    dual.bootId === mobile.bootId
  ) {
    fail('VK_ANDROID_DISTINCT_EMULATOR_IDENTITY_UNPROVEN');
  }
  return Object.freeze({
    dual: Object.freeze({serial: dual.serial, avdName: dual.avdName, bootId: dual.bootId}),
    mobile: Object.freeze({serial: mobile.serial, avdName: mobile.avdName, bootId: mobile.bootId}),
  });
}

export function isControlledKeyboardHarnessUrl(value) {
  return value === CONTROLLED_KEYBOARD_HARNESS_URL;
}

export function controlledKeyboardHarnessIntentArgs(activity) {
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(activity ?? '')) fail('VK_ANDROID_HARNESS_ACTIVITY_INVALID');
  return [
    'shell',
    'am',
    'start',
    '-W',
    '-n',
    activity,
    '-a',
    'android.intent.action.VIEW',
    '-d',
    CONTROLLED_KEYBOARD_HARNESS_URL,
  ];
}

export function debugFailureInjectionIntentArgs(activity, ownerId = null) {
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(activity ?? '')) fail('VK_ANDROID_HARNESS_ACTIVITY_INVALID');
  if (ownerId !== null && !/^[A-Za-z0-9:._-]{1,160}$/.test(ownerId)) fail('VK_ANDROID_DEBUG_FAILURE_OWNER_INVALID');
  const uri = ownerId === null ? 'ter-failure://clear' : `ter-failure://inject/${encodeURIComponent(ownerId)}`;
  return ['shell', 'am', 'start', '-W', '-n', activity, '-a', 'android.intent.action.VIEW', '-d', uri];
}

export function debugFailureInjectionRuntimeIntentArgs(activity, ownerId) {
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(activity ?? '')) fail('VK_ANDROID_HARNESS_ACTIVITY_INVALID');
  if (!/^[A-Za-z0-9:._-]{1,160}$/.test(ownerId ?? '')) fail('VK_ANDROID_DEBUG_FAILURE_OWNER_INVALID');
  return [
    'shell',
    'am',
    'start',
    '-n',
    activity,
    '-a',
    'android.intent.action.VIEW',
    '-d',
    `ter-failure://inject/${encodeURIComponent(ownerId)}`,
  ];
}

export function debugNativeLoadingDelayIntentArgs(activity, delayMs) {
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/.test(activity ?? '')) fail('VK_ANDROID_HARNESS_ACTIVITY_INVALID');
  if (!Number.isInteger(delayMs) || delayMs < 2_100 || delayMs > 4_000) fail('VK_ANDROID_NATIVE_LOADING_DELAY_INVALID');
  return ['shell', 'am', 'start', '-W', '-n', activity, '--el', 'terminalDebugMainThreadDelayMs', String(delayMs)];
}

export function parseLogicalDisplays(text) {
  return String(text ?? '')
    .split('\n')
    .filter(line => /^\s*Display id \d+:/.test(line))
    .map(line => {
      const normalized = line.trim().replace(/\\"/g, '"');
      const id = Number(normalized.match(/^Display id (\d+):/)?.[1]);
      const name = normalized.match(/DisplayInfo\{"([^"]+)"/)?.[1] ?? null;
      const size = normalized.match(/real (\d+) x (\d+)/);
      const uniqueId = normalized.match(/uniqueId "([^"]+)"/)?.[1] ?? null;
      const flags = [...normalized.matchAll(/FLAG_[A-Z_]+/g)].map(match => match[0]);
      return {id, name, width: size ? Number(size[1]) : null, height: size ? Number(size[2]) : null, uniqueId, flags};
    });
}

export function parseSurfaceDisplays(text) {
  const blocks = String(text ?? '')
    .split(/(?=^(?:Display|Virtual Display) \S+)/m)
    .map(block => block.trim())
    .filter(Boolean);
  const parse = (block, virtual) => {
    const size = block.match(/(?:activeMode|displayModes)=[\s\S]*?resolution=(\d+)[x×](\d+)/);
    return {
      id: block.match(/^(?:Virtual )?Display (\S+)/)?.[1] ?? '',
      name:
        block.match(/^\s*name="([^"]+)"/m)?.[1] ??
        block.match(/^Display \S+ \([^,]+, primary, "([^"]+)"\)/)?.[1] ??
        null,
      connectionType: block.match(/^\s*connectionType=(Internal|External)$/m)?.[1] ?? null,
      primary: /^Display \S+ \([^,]+, primary,/.test(block),
      width: size ? Number(size[1]) : virtual ? null : 0,
      height: size ? Number(size[2]) : virtual ? null : 0,
    };
  };
  const physical = blocks.filter(block => /^Display \S+/.test(block)).map(block => parse(block, false));
  return {
    primary: physical.filter(display => display.primary || display.connectionType === 'Internal'),
    external: physical.filter(display => display.connectionType === 'External'),
    virtual: blocks.filter(block => /^Virtual Display \S+/.test(block)).map(block => parse(block, true)),
  };
}

export function parseDumpsysDisplayFacts(text) {
  return String(text ?? '')
    .split('\n')
    .filter(line => line.includes('mBaseDisplayInfo=DisplayInfo{'))
    .map(line => {
      const match = line.match(/mBaseDisplayInfo=DisplayInfo\{"([^"]+)", displayId (\d+),([\s\S]*)\}/);
      const body = match?.[3];
      const size = body?.match(/\breal (\d+) x (\d+)/);
      const uniqueId = body?.match(/\buniqueId "([^"]+)"/);
      if (!match || !size || !uniqueId) fail('VK_ANDROID_DISPLAY_DUMPSYS_PARSE_FAILED');
      return {
        id: Number(match[2]),
        name: match[1],
        width: Number(size[1]),
        height: Number(size[2]),
        uniqueId: uniqueId[1],
        flags: [...body.matchAll(/FLAG_[A-Z_]+/g)].map(flag => flag[0]),
      };
    });
}

export function resolveCaptureDisplayInventory(shape, logicalText, displayDumpText, surfaceDumpText) {
  const logical = parseLogicalDisplays(logicalText);
  const displayFacts = parseDumpsysDisplayFacts(displayDumpText);
  const surfaces = parseSurfaceDisplays(surfaceDumpText);
  if (logical.length === 0 || logical.length !== displayFacts.length) fail('VK_ANDROID_CAPTURE_DISPLAY_FACTS_MISMATCH');
  for (const item of logical) {
    const facts = displayFacts.filter(value => value.id === item.id);
    if (
      facts.length !== 1 ||
      facts[0].name !== item.name ||
      facts[0].width !== item.width ||
      facts[0].height !== item.height ||
      facts[0].uniqueId !== item.uniqueId ||
      JSON.stringify([...facts[0].flags].sort()) !== JSON.stringify([...item.flags].sort())
    ) {
      fail('VK_ANDROID_CAPTURE_DISPLAY_FACTS_MISMATCH');
    }
  }
  const pairing = validateDeviceShape({shape, logical, surfaces});
  return Object.freeze({logical, displayFacts, surfaces, pairing});
}

export function parseResourceNode(xml, resourceId, displayId = null) {
  let scoped = String(xml ?? '');
  if (displayId !== null) {
    const open = new RegExp(`<display\\s+id=["']${Number(displayId)}["'][^>]*>`).exec(scoped);
    if (!open) return null;
    const close = scoped.indexOf('</display>', open.index + open[0].length);
    if (close < 0) return null;
    scoped = scoped.slice(open.index, close + '</display>'.length);
  }
  const escaped = String(resourceId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...scoped.matchAll(new RegExp(`<node\\b[^>]*resource-id="${escaped}"[^>]*>`, 'g'))];
  if (matches.length > 1) fail('VK_ANDROID_RESOURCE_NODE_AMBIGUOUS');
  const tag = matches[0]?.[0];
  if (!tag) return null;
  const bounds = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  if (!bounds) return null;
  return Object.freeze({
    left: Number(bounds[1]),
    top: Number(bounds[2]),
    right: Number(bounds[3]),
    bottom: Number(bounds[4]),
    enabled: /\benabled="true"/.test(tag),
    selected: /\bselected="true"/.test(tag),
  });
}

export function sameResourceNodeBounds(left, right) {
  return (
    left !== null &&
    right !== null &&
    left.left === right.left &&
    left.top === right.top &&
    left.right === right.right &&
    left.bottom === right.bottom
  );
}

function parseResourceAttributeValue(xml, resourceId, displayId, attributeName, missingCode) {
  let scoped = String(xml ?? '');
  const open = new RegExp(`<display\\s+id=["']${Number(displayId)}["'][^>]*>`).exec(scoped);
  if (!open) fail('VK_ANDROID_RESOURCE_NODE_NOT_FOUND');
  const close = scoped.indexOf('</display>', open.index + open[0].length);
  if (close < 0) fail('VK_ANDROID_RESOURCE_NODE_NOT_FOUND');
  scoped = scoped.slice(open.index, close + '</display>'.length);
  const escaped = String(resourceId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = [...scoped.matchAll(new RegExp(`<node\\b[^>]*resource-id="${escaped}"[^>]*>`, 'g'))];
  if (matches.length > 1) fail('VK_ANDROID_RESOURCE_NODE_AMBIGUOUS');
  const tag = matches[0]?.[0];
  if (!tag) fail('VK_ANDROID_RESOURCE_NODE_NOT_FOUND');
  const value = tag.match(new RegExp('\\b' + attributeName + '="([^"]*)"'))?.[1];
  if (value === undefined) fail(missingCode);
  const decoded = value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  return decoded;
}

export function parseHarnessTextHash(xml, resourceId, displayId) {
  if (resourceId !== 'harness:full-field') fail('VK_ANDROID_SENSITIVE_VALUE_HASH_FORBIDDEN');
  return sha256(parseResourceAttributeValue(xml, resourceId, displayId, 'text', 'VK_ANDROID_RESOURCE_TEXT_MISSING'));
}

export function parseAdminDebugPassword(xml, displayId) {
  let scoped = String(xml ?? '');
  const open = new RegExp(`<display\\s+id=["']${Number(displayId)}["'][^>]*>`).exec(scoped);
  if (!open) fail('VK_ANDROID_ADMIN_DEBUG_PASSWORD_NOT_OBSERVED');
  const close = scoped.indexOf('</display>', open.index + open[0].length);
  if (close < 0) fail('VK_ANDROID_ADMIN_DEBUG_PASSWORD_NOT_OBSERVED');
  scoped = scoped.slice(open.index, close + '</display>'.length);
  const debugTags = [...scoped.matchAll(/<node\b[^>]*resource-id="terminal\.admin:debug-password"[^>]*>/g)];
  const instructionTags = [...scoped.matchAll(/<node\b[^>]*resource-id="terminal\.admin:login:instruction"[^>]*>/g)];
  if (debugTags.length > 1 || instructionTags.length > 1 || (debugTags.length === 1 && instructionTags.length > 1))
    fail('VK_ANDROID_ADMIN_DEBUG_PASSWORD_NOT_OBSERVED');
  const rawText = (debugTags[0] ?? instructionTags[0])?.[0].match(/\btext="([^"]*)"/)?.[1];
  if (rawText === undefined) fail('VK_ANDROID_ADMIN_DEBUG_PASSWORD_NOT_OBSERVED');
  const text = rawText
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  const digits = text.match(/\d{6}/g) ?? [];
  if (
    digits.length !== 1 ||
    (debugTags.length === 0 && (!/请输入动态口令/.test(text) || !/[（(]\d{6}[）)]/.test(text)))
  ) fail('VK_ANDROID_ADMIN_DEBUG_PASSWORD_NOT_OBSERVED');
  return digits[0];
}

export function w2InputProbeArgs(probe, displayId) {
  if (!Number.isSafeInteger(displayId) || displayId < 0 || !Object.hasOwn(W2_INPUT_PROBES, probe))
    fail('VK_ANDROID_W2_INPUT_PROBE_INVALID');
  return ['shell', 'input', '-d', String(displayId), 'text', W2_INPUT_PROBES[probe]];
}

export function w2HardwareKeyArgs(key, displayId) {
  if (!Number.isSafeInteger(displayId) || displayId < 0 || !Object.hasOwn(W2_HARDWARE_KEYS, key))
    fail('VK_ANDROID_W2_HARDWARE_KEY_INVALID');
  return ['shell', 'input', '-d', String(displayId), ...W2_HARDWARE_KEYS[key]];
}

export function w7ProbeKeyIds(resourceId) {
  const value = W7_PROBE_TEXT_BY_RESOURCE_ID[resourceId];
  if (typeof value !== 'string') fail('VK_ANDROID_W7_RESOURCE_ID_OUT_OF_SCOPE');
  return Array.from(value, character => `ui.base.input:virtual-keyboard:text-${character}`);
}

export function w7ProbeTapPlan(xml, displayId, resourceId) {
  if (!Number.isSafeInteger(displayId) || displayId < 0) fail('VK_ANDROID_W7_DISPLAY_INVALID');
  const fieldState = parseResourceUiState(xml, resourceId, displayId);
  const keyboard = parseResourceNode(xml, 'ui.base.input:virtual-keyboard', displayId);
  if (fieldState?.focused !== true || !keyboard?.enabled) fail('VK_ANDROID_W7_PROBE_INPUT_NOT_READY');
  return w7ProbeKeyIds(resourceId).map((keyId, index) => {
    const node = parseResourceNode(xml, keyId, displayId);
    if (!node?.enabled || node.right <= node.left || node.bottom <= node.top) {
      fail(`VK_ANDROID_W7_PROBE_KEY_NOT_AVAILABLE_${index + 1}`);
    }
    return Object.freeze({
      x: Math.floor((node.left + node.right) / 2),
      y: Math.floor((node.top + node.bottom) / 2),
    });
  });
}

export function w7ClipboardKeyArgs(key, displayId) {
  if (!Number.isSafeInteger(displayId) || displayId < 0 || !Object.hasOwn(W7_CLIPBOARD_KEYS, key))
    fail('VK_ANDROID_W7_CLIPBOARD_ACTION_INVALID');
  return ['shell', 'input', '-d', String(displayId), ...W7_CLIPBOARD_KEYS[key]];
}

export function w7ClearInputArgs(displayId, deleteKeyCount = 64) {
  if (
    !Number.isSafeInteger(displayId) ||
    displayId < 0 ||
    !Number.isSafeInteger(deleteKeyCount) ||
    deleteKeyCount < 1 ||
    deleteKeyCount > 128
  ) {
    fail('VK_ANDROID_W7_CLEAR_INPUT_INVALID');
  }
  return ['shell', 'input', '-d', String(displayId), 'keyevent', ...Array(deleteKeyCount).fill('KEYCODE_DEL')];
}

export function w7LongPressArgs(displayId, bounds, durationMs = 1_000) {
  if (
    !Number.isSafeInteger(displayId) ||
    displayId < 0 ||
    !bounds ||
    !['left', 'top', 'right', 'bottom'].every(key => Number.isSafeInteger(bounds[key])) ||
    bounds.left < 0 ||
    bounds.top < 0 ||
    bounds.right <= bounds.left ||
    bounds.bottom <= bounds.top ||
    !Number.isSafeInteger(durationMs) ||
    durationMs < 750 ||
    durationMs > 2_000
  ) {
    fail('VK_ANDROID_W7_LONG_PRESS_INVALID');
  }
  const x = Math.floor((bounds.left + bounds.right) / 2);
  const y = Math.floor((bounds.top + bounds.bottom) / 2);
  return [
    'shell',
    'input',
    '-d',
    String(displayId),
    'swipe',
    String(x),
    String(y),
    String(x),
    String(y),
    String(durationMs),
  ];
}

export function parseTextInputContextMenu(xml, displayId) {
  let scoped = String(xml ?? '');
  const open = new RegExp(`<display\\s+id=["']${Number(displayId)}["'][^>]*>`).exec(scoped);
  if (!open) fail('VK_ANDROID_CONTEXT_MENU_DISPLAY_MISSING');
  const close = scoped.indexOf('</display>', open.index + open[0].length);
  if (close < 0) fail('VK_ANDROID_CONTEXT_MENU_DISPLAY_MISSING');
  scoped = scoped.slice(open.index, close + '</display>'.length);
  const decode = value =>
    value
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  const actionByLabel = new Map([
    ['select all', 'SELECT_ALL'],
    ['select', 'SELECT'],
    ['copy', 'COPY'],
    ['paste', 'PASTE'],
    ['paste as plain text', 'PASTE_PLAIN_TEXT'],
    ['cut', 'CUT'],
    ['autofill', 'AUTOFILL'],
    ['全选', 'SELECT_ALL'],
    ['选择', 'SELECT'],
    ['复制', 'COPY'],
    ['粘贴', 'PASTE'],
    ['粘贴为纯文本', 'PASTE_PLAIN_TEXT'],
    ['剪切', 'CUT'],
    ['自动填充', 'AUTOFILL'],
  ]);
  const actions = new Set();
  let floatingToolbar = false;
  for (const [match] of scoped.matchAll(/<node\b[^>]*>/g)) {
    const resourceId = match.match(/\bresource-id="([^"]*)"/)?.[1] ?? '';
    if (/(?:floating_toolbar|text_action_mode)/i.test(resourceId)) floatingToolbar = true;
    const rawText = match.match(/\btext="([^"]*)"/)?.[1];
    if (rawText === undefined) continue;
    const action = actionByLabel.get(decode(rawText).trim().toLowerCase());
    if (action) actions.add(action);
  }
  return Object.freeze({
    visible: floatingToolbar || actions.size > 0,
    floatingToolbar,
    actions: Object.freeze([...actions].sort()),
  });
}

export function parseResourceContentDescriptionHash(xml, resourceId, displayId) {
  if (!/^ui\.base\.input:virtual-keyboard:(?:text-[0-9]|text-[a-z]|shift|space|backspace|complete)$/.test(resourceId))
    fail('VK_ANDROID_SENSITIVE_VALUE_HASH_FORBIDDEN');
  return sha256(parseResourceAttributeValue(xml, resourceId, displayId, 'content-desc', 'VK_ANDROID_RESOURCE_CONTENT_DESCRIPTION_MISSING'));
}

function parseResourceTextValue(xml, resourceId, displayId) {
  return parseResourceAttributeValue(xml, resourceId, displayId, 'text', 'VK_ANDROID_RESOURCE_TEXT_MISSING');
}

export function resolveUrlSymbolHarnessField(xml, displayId) {
  const node = parseResourceNode(xml, URL_SYMBOL_HARNESS_FIELD_ID, displayId);
  if (!node?.enabled || node.right <= node.left || node.bottom <= node.top) return null;
  return Object.freeze({
    fieldId: URL_SYMBOL_HARNESS_FIELD_ID,
    node,
    textSha256: parseHarnessTextHash(xml, URL_SYMBOL_HARNESS_FIELD_ID, displayId),
  });
}

export function parseDisplayWindowIdentity(xml, displayId, expectedPackage) {
  let scoped = String(xml ?? '');
  const open = new RegExp(`<display\\s+id=["']${Number(displayId)}["'][^>]*>`).exec(scoped);
  if (!open) fail('VK_ANDROID_CAPTURE_WINDOW_IDENTITY_UNPROVEN');
  const close = scoped.indexOf('</display>', open.index + open[0].length);
  if (close < 0) fail('VK_ANDROID_CAPTURE_WINDOW_IDENTITY_UNPROVEN');
  scoped = scoped.slice(open.index, close + '</display>'.length);
  const nodes = [...scoped.matchAll(/<node\b[^>]*>/g)].map(match => match[0]);
  const root = nodes.find(tag =>
    new RegExp(`\\bpackage=["']${String(expectedPackage).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(tag),
  );
  if (!root) fail('VK_ANDROID_CAPTURE_WINDOW_IDENTITY_UNPROVEN');
  const attribute = name => root.match(new RegExp(`\\b${name}=["']([^"']*)["']`))?.[1] ?? null;
  return Object.freeze({
    logicalDisplayId: Number(displayId),
    packageName: expectedPackage,
    rootClass: attribute('class'),
    rootResourceId: attribute('resource-id'),
  });
}

export function parseVisibleControlInventory(xml, displayId) {
  let scoped = String(xml ?? '');
  const open = new RegExp(`<display\\s+id=["']${Number(displayId)}["'][^>]*>`).exec(scoped);
  if (!open) fail('VK_ANDROID_CONTROL_INVENTORY_DISPLAY_MISSING');
  const close = scoped.indexOf('</display>', open.index + open[0].length);
  if (close < 0) fail('VK_ANDROID_CONTROL_INVENTORY_DISPLAY_MISSING');
  scoped = scoped.slice(open.index, close + '</display>'.length);
  const decode = value =>
    value
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  const attributesOf = tag =>
    Object.fromEntries([...tag.matchAll(/([\w:-]+)=["']([^"']*)["']/g)].map(match => [match[1], decode(match[2])]));
  return Object.freeze(
    [...scoped.matchAll(/<node\b[^>]*>/g)].map((match, nodeIndex) => {
      const attributes = attributesOf(match[0]);
      const bounds = attributes.bounds?.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
      const safeResourceId =
        attributes['resource-id'] !== undefined && /^[A-Za-z0-9_.:$-]{1,192}$/.test(attributes['resource-id'])
          ? attributes['resource-id']
          : null;
      return Object.freeze({
        nodeIndex,
        resourceId: safeResourceId,
        resourceIdSha256: attributes['resource-id'] === undefined ? null : sha256(attributes['resource-id']),
        className: attributes.class ?? null,
        bounds: bounds
          ? {left: Number(bounds[1]), top: Number(bounds[2]), right: Number(bounds[3]), bottom: Number(bounds[4])}
          : null,
        enabled: attributes.enabled === 'true',
        selected: attributes.selected === 'true',
        clickable: attributes.clickable === 'true',
        checkable: attributes.checkable === 'true',
        focused: attributes.focused === 'true',
        scrollable: attributes.scrollable === 'true',
        hasText: attributes.text !== undefined && attributes.text.length > 0,
        hasContentDescription: attributes['content-desc'] !== undefined && attributes['content-desc'].length > 0,
      });
    }),
  );
}

export function parseResourceUiState(xml, resourceId, displayId) {
  const matches = parseVisibleControlInventory(xml, displayId).filter(item => item.resourceId === resourceId);
  if (matches.length > 1) fail('VK_ANDROID_RESOURCE_NODE_AMBIGUOUS');
  const item = matches[0];
  if (!item) return null;
  return Object.freeze({
    resourceId: item.resourceId,
    bounds: item.bounds,
    enabled: item.enabled,
    focused: item.focused,
    hasText: item.hasText,
    hasContentDescription: item.hasContentDescription,
  });
}

export function terminalActivationInputReadiness(xml, displayId) {
  const field = parseResourceUiState(xml, TERMINAL_ACTIVATION_INPUT_ID, displayId);
  const keyboardVisible = parseResourceNode(xml, 'ui.base.input:virtual-keyboard', displayId) !== null;
  const keyboardHitShieldPresent = parseResourceNode(xml, 'ui.base.input:keyboard-hit-shield', displayId) !== null;
  const nativeFocusReported = field?.focused === true;
  return Object.freeze({
    fieldVisible: field !== null,
    fieldEnabled: field?.enabled === true,
    nativeFocusReported,
    keyboardVisible,
    keyboardHitShieldPresent,
    ready: field?.enabled === true && keyboardVisible && !keyboardHitShieldPresent,
  });
}

export function parsePngFileDescription(output) {
  const description = String(output ?? '')
    .slice(String(output ?? '').indexOf(': ') + 2)
    .trim();
  const dimensions = description.match(/^PNG image data, (\d+) x (\d+),/);
  if (!dimensions) fail('VK_ANDROID_CAPTURE_FILE_TYPE_INVALID');
  return Object.freeze({description, width: Number(dimensions[1]), height: Number(dimensions[2])});
}

export function validateDeviceShape({shape, logical, surfaces}) {
  if (!['dual', 'mobile'].includes(shape)) fail('VK_ANDROID_SHAPE_INVALID');
  const primary = logical.filter(value => value.id === 0);
  const secondaries = logical.filter(value => value.id !== 0 && value.flags.includes('FLAG_PRESENTATION'));
  if (primary.length !== 1 || surfaces.primary.length !== 1) fail('VK_ANDROID_PRIMARY_DISPLAY_UNPROVEN');
  const externalSurfaces = surfaces.external ?? [];
  if (
    shape === 'mobile' &&
    (logical.length !== 1 || secondaries.length !== 0 || surfaces.virtual.length !== 0 || externalSurfaces.length !== 0)
  )
    fail('VK_ANDROID_MOBILE_SHAPE_MISMATCH');
  const virtualSecondary = surfaces.virtual.length === 1 && externalSurfaces.length === 0;
  const physicalSecondary = surfaces.virtual.length === 0 && externalSurfaces.length === 1;
  if (
    shape === 'dual' &&
    (logical.length !== 2 || secondaries.length !== 1 || (!virtualSecondary && !physicalSecondary))
  )
    fail('VK_ANDROID_DUAL_SHAPE_MISMATCH');
  const sfPrimary = surfaces.primary[0];
  if (
    ![primary[0].width, primary[0].height, sfPrimary.width, sfPrimary.height].every(
      value => Number.isSafeInteger(value) && value > 0,
    )
  )
    fail('VK_ANDROID_PRIMARY_GEOMETRY_UNAVAILABLE');
  let sfSecondary = null;
  if (shape === 'dual') {
    const logicalSecondary = secondaries[0];
    sfSecondary = virtualSecondary ? surfaces.virtual[0] : externalSurfaces[0];
    if (virtualSecondary && logicalSecondary.name !== sfSecondary.name) fail('VK_ANDROID_SECONDARY_IDENTITY_MISMATCH');
    if (
      ![logicalSecondary.width, logicalSecondary.height].every(value => Number.isSafeInteger(value) && value > 0) ||
      (sfSecondary.width !== null &&
        ![sfSecondary.width, sfSecondary.height].every(value => Number.isSafeInteger(value) && value > 0))
    ) {
      fail('VK_ANDROID_SECONDARY_GEOMETRY_UNAVAILABLE');
    }
  }
  return Object.freeze({
    primary: primary[0],
    secondary: secondaries[0] ?? null,
    primarySurface: sfPrimary,
    secondarySurface: sfSecondary,
    secondarySurfaceKind: shape === 'dual' ? (virtualSecondary ? 'virtual' : 'physical') : null,
  });
}

export function emptyFrameMatrix() {
  return Object.fromEntries(IA_IDS.map(iaId => [iaId, {status: 'OPEN', reason: 'NOT_OBSERVED', captures: []}]));
}

export function recordCapture(manifest, iaId, record, evidenceKind = 'PRODUCT_FRAME') {
  if (!IA_IDS.includes(iaId) || record?.iaId !== iaId) fail('VK_ANDROID_IA_ID_OUT_OF_RANGE');
  if (evidenceKind === 'CONTROLLED_HARNESS') {
    manifest.controlledHarnessCaptures ??= [];
    manifest.controlledHarnessCaptures.push({...record, evidenceKind, coveredIaId: iaId});
    return;
  }
  if (!PRODUCT_CAPTURE_EVIDENCE_KINDS.includes(evidenceKind)) fail('VK_ANDROID_CAPTURE_EVIDENCE_KIND_INVALID');
  const frame = manifest.frameMatrix?.[iaId];
  if (!frame) fail('VK_ANDROID_IA_ID_OUT_OF_RANGE');
  frame.captures.push({...record, evidenceKind});
  frame.status = 'OPEN';
  frame.reason = 'AWAITING_PER_CONTROL_VISUAL_JUDGMENT';
  frame.lastCaptureAt = now();
}

export function captureObservationMatrix(frameMatrix) {
  return Object.fromEntries(
    IA_IDS.map(iaId => [
      iaId,
      {
        frameStatus: frameMatrix[iaId]?.status ?? 'OPEN',
        controlRoster: iaControlRoster(iaId),
        routes: Object.fromEntries(
          ['dual', 'mobile'].flatMap(shape =>
            Object.keys(APPS).flatMap(app =>
              ['primary', 'secondary'].map(surface => {
                const captures = (frameMatrix[iaId]?.captures ?? []).filter(
                  item => item.shape === shape && item.app === app && item.surface === surface,
                );
                const coverageClass = classifyFrameRoute(iaId, shape, app, surface);
                const notApplicable =
                  coverageClass === 'NOT_APPLICABLE_DEVICE_SHAPE' || coverageClass === 'NOT_APPLICABLE_FRAME_SHAPE';
                const notCovered = coverageClass === 'NOT_COVERED_BY_PRODUCT_CONSUMER';
                const harnessOnly = coverageClass === 'HARNESS_ONLY_NOT_PRODUCT';
                const openProductPath = coverageClass === 'OPEN_PRODUCT_PATH_TO_CONFIRM';
                return [
                  `${shape}/${app}/${surface}`,
                  {
                    coverageClass,
                    status: notApplicable
                      ? coverageClass
                      : notCovered
                        ? coverageClass
                        : harnessOnly
                          ? coverageClass
                          : captures.length > 0
                            ? 'CAPTURED_AWAITING_PER_CONTROL_AUDIT'
                            : openProductPath
                              ? 'OPEN_PRODUCT_PATH_TO_CONFIRM'
                              : 'OPEN_NOT_OBSERVED',
                    controlRoster: iaControlRoster(iaId, app),
                    captureCount: captures.length,
                    captures: captures.map(item => ({
                      screenshot: item.screenshot,
                      captureEvidence: item.captureEvidence ?? null,
                      state: item.state,
                      transitionIndex: item.transitionIndex ?? null,
                    })),
                    perControlVisualAudit: 'OPEN',
                  },
                ];
              }),
            ),
          ),
        ),
      },
    ]),
  );
}

export function iaControlRoster(iaId, app = null) {
  if (!IA_IDS.includes(iaId)) fail('VK_ANDROID_IA_ID_INVALID');
  if (app !== null && !Object.hasOwn(APPS, app)) fail('VK_ANDROID_APP_INVALID');
  const layouts = FRAME_LAYOUTS[iaId] ?? [];
  const controls = ['ui.base.input:virtual-keyboard:outer-frame'];
  layouts.forEach((layout, index) => {
    const stage = layouts.length > 1 ? `${index === 0 ? 'outgoing' : 'incoming'}/` : '';
    controls.push(...KEY_IDS_BY_LAYOUT[layout].map(keyId => `${stage}ui.base.input:virtual-keyboard:${keyId}`));
  });
  controls.push(...(FRAME_EXTRA_CONTROLS_BY_APP[iaId]?.[app] ?? FRAME_EXTRA_CONTROLS[iaId] ?? []));
  return Object.freeze(controls.map(controlId => Object.freeze({controlId, status: 'OPEN', reviewer: null})));
}

export function classifyFrameRoute(iaId, shape, app, surface) {
  if (
    !IA_IDS.includes(iaId) ||
    !['dual', 'mobile'].includes(shape) ||
    !Object.hasOwn(APPS, app) ||
    !['primary', 'secondary'].includes(surface)
  ) {
    fail('VK_ANDROID_FRAME_ROUTE_INVALID');
  }
  if (shape === 'mobile' && surface === 'secondary') return 'NOT_APPLICABLE_DEVICE_SHAPE';
  if ((LAPTOP_IA_IDS.has(iaId) && shape !== 'dual') || (MOBILE_IA_IDS.has(iaId) && shape !== 'mobile'))
    return 'NOT_APPLICABLE_FRAME_SHAPE';
  if (iaId === 'VK-IA-17') return 'HARNESS_ONLY_NOT_PRODUCT';
  if (SAMPLE_TERMINAL_ONLY_IA_IDS.has(iaId) && app !== 'sample-terminal') return 'NOT_COVERED_BY_PRODUCT_CONSUMER';
  if (iaId === 'VK-IA-19' && surface === 'secondary' && app !== 'sample-terminal')
    return 'NOT_COVERED_BY_PRODUCT_CONSUMER';
  if (surface === 'secondary' && iaId === 'VK-IA-19' && app === 'sample-terminal') return 'PRODUCT_CONSUMER_CANDIDATE';
  if (surface === 'secondary' && ['VK-IA-12', 'VK-IA-13'].includes(iaId)) return 'OPEN_PRODUCT_PATH_TO_CONFIRM';
  if (surface === 'secondary') return 'NOT_COVERED_BY_PRODUCT_CONSUMER';
  return 'PRODUCT_CONSUMER_CANDIDATE';
}

export function perControlVisualAuditRows(frameMatrix) {
  return IA_IDS.flatMap(iaId =>
    (frameMatrix[iaId]?.captures ?? []).flatMap(capture => {
      const controls = capture.visibleControls ?? [];
      const expectedRows = iaControlRoster(iaId, capture.app).map(expected => {
        const baseId = expected.controlId.replace(/^(?:outgoing|incoming)\//, '');
        const candidates = controls.filter(
          control => control.resourceId === baseId || control.resourceId?.startsWith(`${baseId}:`),
        );
        const semanticOnly = baseId.startsWith('geometry:') || baseId.startsWith('harness:');
        return {
          iaId,
          shape: capture.shape,
          app: capture.app,
          surface: capture.surface,
          screenshot: capture.screenshot,
          controlId: expected.controlId,
          observedResourceIds: candidates.map(control => control.resourceId),
          bounds: candidates.length === 1 ? candidates[0].bounds : null,
          presenceStatus:
            controls.length === 0
              ? 'OPEN_NO_CONTROL_INVENTORY'
              : semanticOnly
                ? 'OPEN_MANUAL_GEOMETRY_CHECK'
                : candidates.length === 0
                  ? 'OPEN_EXPECTED_CONTROL_NOT_OBSERVED'
                  : candidates.length > 1
                    ? 'OPEN_AMBIGUOUS_CONTROL_ID'
                    : 'OBSERVED_AWAITING_VISUAL_JUDGMENT',
          visualStatus: 'OPEN',
          visualDimensions: [
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
          ],
          reviewer: null,
        };
      });
      const matchedIds = new Set(expectedRows.flatMap(row => row.observedResourceIds));
      const unaddressedAndExtraRows = controls
        .filter(control => control.resourceId === null || !matchedIds.has(control.resourceId))
        .map(control => ({
          iaId,
          shape: capture.shape,
          app: capture.app,
          surface: capture.surface,
          screenshot: capture.screenshot,
          controlId:
            control.resourceId ??
            `unaddressed:${control.className ?? 'unknown'}:${control.nodeIndex}:${control.resourceIdSha256?.slice(0, 12) ?? 'no-id'}`,
          observedResourceIds: control.resourceId === null ? [] : [control.resourceId],
          bounds: control.bounds,
          presenceStatus: 'OPEN_UNEXPECTED_OR_UNADDRESSABLE_VISIBLE_CONTROL',
          visualStatus: 'OPEN',
          visualDimensions: [
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
          ],
          reviewer: null,
        }));
      return [...expectedRows, ...unaddressedAndExtraRows];
    }),
  );
}

function fail(code) {
  throw new Error(code);
}
function now() {
  return new Date().toISOString();
}
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
export function createAppBuildBinding(apkPath, bytes) {
  if (typeof apkPath !== 'string' || apkPath.trim() === '' || !Buffer.isBuffer(bytes) || bytes.length === 0) {
    fail('VK_ANDROID_BUILD_ARTIFACT_INVALID');
  }
  return {apkPath, bytes: bytes.length, sha256: sha256(bytes), builtAt: now()};
}

export function appBuildArtifact(appName, buildType = 'release') {
  const app = APPS[appName];
  if (!app || !['debug', 'release'].includes(buildType)) fail('VK_ANDROID_BUILD_VARIANT_INVALID');
  const capitalized = `${buildType[0].toUpperCase()}${buildType.slice(1)}`;
  return Object.freeze({
    androidRoot: app.androidRoot,
    gradleTask: `assemble${capitalized}`,
    apkPath: path.join(app.androidRoot, `app/build/outputs/apk/${buildType}/app-${buildType}.apk`),
    buildType,
  });
}

export function managedGradleBuildArgs(appName, buildType = 'release') {
  const build = appBuildArtifact(appName, buildType);
  return [
    build.gradleTask,
    ...(buildType === 'debug' ? ['-PterDisableNativeDevSupport=true'] : []),
    '--rerun-tasks',
    '--no-daemon',
    '--console=plain',
  ];
}
function safeRunId(value) {
  if (!RUN_ID_RE.test(value ?? '')) fail('VK_ANDROID_RUN_ID_INVALID');
  return value;
}
function safeSerial(value) {
  if (!SERIAL_RE.test(value ?? '')) fail('VK_ANDROID_SERIAL_REQUIRED');
  return value;
}
function safeLabel(value, code) {
  if (!/^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/.test(value ?? '')) fail(code);
  return value;
}

export function validateA11BaselineManifest(baseline, currentDevices) {
  if (
    !baseline ||
    baseline.status !== 'PASS' ||
    baseline.business !== 'PASS' ||
    baseline.cleanup !== 'PASS' ||
    !/^[a-f0-9]{64}$/i.test(baseline.sourceDigest ?? '') ||
    !Array.isArray(baseline.markers) ||
    baseline.markers.length !== 4 ||
    !baseline.devices?.dual ||
    !baseline.devices?.mobile
  ) {
    fail('VK_ANDROID_A11_BASELINE_INVALID');
  }
  const roleForShape = {dual: 'physical-dual', mobile: 'mobile-vm'};
  const devices = {};
  for (const shape of ['dual', 'mobile']) {
    const before = baseline.devices[shape];
    const current = currentDevices?.[shape]?.inventory;
    if (
      !current ||
      before.serial !== current.serial ||
      before.bootId !== current.bootId ||
      !/^[A-Za-z0-9-]{8,96}$/.test(before.bootId ?? '')
    ) {
      fail('VK_ANDROID_A11_BASELINE_DEVICE_BINDING_MISMATCH');
    }
    devices[shape] = {serial: before.serial, bootId: before.bootId, role: roleForShape[shape]};
  }
  const pairs = new Set();
  const markers = baseline.markers.map(marker => {
    const app = APPS[marker.appName];
    const shape =
      marker.deviceRole === roleForShape.dual ? 'dual' : marker.deviceRole === roleForShape.mobile ? 'mobile' : null;
    const device = shape ? devices[shape] : null;
    const pair = shape ? `${shape}:${marker.appName}` : null;
    if (
      !app ||
      !device ||
      marker.serial !== device.serial ||
      marker.packageName !== app.packageName ||
      marker.status !== 'CONFIRMED' ||
      !/^[a-f0-9]{64}$/i.test(marker.apkSha256 ?? '') ||
      marker.sourceDigest !== baseline.sourceDigest ||
      pairs.has(pair)
    ) {
      fail('VK_ANDROID_A11_BASELINE_MARKER_INVALID');
    }
    pairs.add(pair);
    return {
      shape,
      appName: marker.appName,
      packageName: marker.packageName,
      apkSha256: marker.apkSha256,
      sourceDigest: marker.sourceDigest,
    };
  });
  if (
    pairs.size !== 4 ||
    ['dual', 'mobile'].some(shape => Object.keys(APPS).some(appName => !pairs.has(`${shape}:${appName}`)))
  ) {
    fail('VK_ANDROID_A11_BASELINE_MARKER_DENOMINATOR_INVALID');
  }
  if (
    !Array.isArray(baseline.sourceFiles) ||
    baseline.sourceFiles.length === 0 ||
    baseline.sourceFiles.some(file => {
      if (typeof file !== 'string' || path.isAbsolute(file)) return true;
      const absolute = path.resolve(ROOT, file);
      try {
        return (
          !absolute.startsWith(`${ROOT}${path.sep}`) ||
          !fs.realpathSync(absolute).startsWith(`${fs.realpathSync(ROOT)}${path.sep}`) ||
          !fs.statSync(absolute).isFile()
        );
      } catch {
        return true;
      }
    })
  ) {
    fail('VK_ANDROID_A11_BASELINE_SOURCE_FILES_INVALID');
  }
  return {
    runId: baseline.runId,
    sourceDigest: baseline.sourceDigest,
    sourceFiles: baseline.sourceFiles,
    devices,
    markers,
  };
}

function a11SourceDigest(manifest) {
  if (!manifest.a11Baseline?.sourceFiles?.length) fail('VK_ANDROID_A11_BASELINE_REQUIRED');
  const chunks = manifest.a11Baseline.sourceFiles.map(file => {
    const absolute = path.resolve(ROOT, file);
    if (
      !absolute.startsWith(`${ROOT}${path.sep}`) ||
      !fs.realpathSync(absolute).startsWith(`${fs.realpathSync(ROOT)}${path.sep}`) ||
      !fs.statSync(absolute).isFile()
    )
      fail('VK_ANDROID_A11_SOURCE_INPUT_INVALID');
    return `${file}\0${fs.readFileSync(absolute)}`;
  });
  return sha256(chunks.join('\0'));
}

const A11_W10_PAIRS = Object.freeze([
  'dual:sample-terminal',
  'dual:sample-wallpaper-terminal',
  'mobile:sample-terminal',
  'mobile:sample-wallpaper-terminal',
]);

export function validateA11W10Action(manifest, action, shape = null, appName = null) {
  if (!manifest.a11BaselineRunId || !manifest.a11Baseline) fail('VK_ANDROID_A11_BASELINE_REQUIRED');
  if (!['build', 'launch', 'observe-w10', 'report', 'cleanup'].includes(action))
    fail('VK_ANDROID_A11_W10_ACTION_NOT_ALLOWED');
  if (['build', 'launch', 'observe-w10'].includes(action)) {
    const digest = a11SourceDigest(manifest);
    if (manifest.a11W10SourceDigest && manifest.a11W10SourceDigest !== digest)
      fail('VK_ANDROID_A11_W10_SOURCE_CHANGED');
  }
  if (action === 'build') {
    if (
      !APPS[appName] ||
      manifest.appBindings[appName] ||
      manifest.persistKvW10Upgrades.length > 0 ||
      manifest.persistKvW10PendingObservation
    ) {
      fail('VK_ANDROID_A11_W10_BUILD_WINDOW_CLOSED');
    }
  }
  if (action === 'launch') {
    const pair = `${shape}:${appName}`;
    if (
      !A11_W10_PAIRS.includes(pair) ||
      manifest.persistKvW10PendingObservation ||
      manifest.persistKvW10Upgrades.some(item => `${item.shape}:${item.appName}` === pair) ||
      Object.keys(APPS).some(name => !manifest.appBindings[name])
    )
      fail('VK_ANDROID_A11_W10_PAIR_INVALID');
    const prior = manifest.a11Baseline.markers.find(item => item.shape === shape && item.appName === appName);
    const binding = manifest.appBindings[appName];
    if (!prior || prior.apkSha256 === binding.sha256 || binding.sourceDigest !== a11SourceDigest(manifest)) {
      fail('VK_ANDROID_A11_W10_FINAL_RELEASE_BINDING_INVALID');
    }
  }
  if (action === 'observe-w10') {
    const pending = manifest.persistKvW10PendingObservation;
    if (
      !pending ||
      pending.shape !== shape ||
      pending.appName !== appName ||
      !pending.intentId ||
      !A11_W10_PAIRS.includes(`${shape}:${appName}`)
    )
      fail('VK_ANDROID_A11_W10_OBSERVATION_NOT_PENDING');
  }
  return true;
}

function readA11Baseline(runId) {
  safeRunId(runId);
  const file = path.join(A11_BASELINE_ROOT, runId, 'run-manifest.json');
  if (!fs.existsSync(file)) fail('VK_ANDROID_A11_BASELINE_MISSING');
  const baseline = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (baseline.runId !== runId) fail('VK_ANDROID_A11_BASELINE_INVALID');
  return baseline;
}

export function recordFirstFailure(manifest, code, brokenBoundary) {
  manifest.firstFailure ??= {
    at: now(),
    code,
    lastKnownGood: manifest.lastKnownGood ?? null,
    brokenBoundary,
  };
  manifest.brokenBoundary = manifest.firstFailure.brokenBoundary ?? brokenBoundary ?? null;
  return manifest.firstFailure;
}

export function recordLastKnownGood(manifest, label, {preserveCurrent = false} = {}) {
  if (!preserveCurrent) manifest.lastKnownGood = label;
  return manifest.lastKnownGood ?? null;
}

export function runtimeResourceRoot(repoRoot = ROOT) {
  return path.join(repoRoot, '.runtime');
}

export function terResourcePreflightArgs(repoRoot = ROOT) {
  return ['--profile', 'ter-validation-with-dev', runtimeResourceRoot(repoRoot)];
}

export function validatePrepareOptions(args) {
  const runId = safeRunId(args['run-id']);
  const dualSerial = safeSerial(args['dual-serial']);
  const mobileSerial = safeSerial(args['mobile-serial']);
  if (dualSerial === mobileSerial) fail('VK_ANDROID_DEVICE_SERIALS_MUST_DIFFER');
  const a11BaselineRunId = args['a11-baseline-run-id'] === undefined ? null : safeRunId(args['a11-baseline-run-id']);
  const authorization = args.authorization ?? RUN_AUTHORIZATIONS[0];
  if (!RUN_AUTHORIZATIONS.includes(authorization)) fail('VK_ANDROID_RUN_AUTHORIZATION_INVALID');
  return Object.freeze({runId, dualSerial, mobileSerial, a11BaselineRunId, authorization});
}

export function validateRunManifest(manifest, {allowHistoricalApkPathsForCleanup = false} = {}) {
  if (
    !manifest ||
    manifest.schemaVersion !== 2 ||
    !RUN_ID_RE.test(manifest.runId ?? '') ||
    !manifest.devices?.dual?.serial ||
    !manifest.devices?.mobile?.serial ||
    manifest.devices.dual.serial === manifest.devices.mobile.serial ||
    !manifest.appBindings ||
    !Array.isArray(manifest.ownedRemoteProcesses) ||
    !Array.isArray(manifest.pendingRemoteLaunches) ||
    !Array.isArray(manifest.remoteTempFiles) ||
    !Array.isArray(manifest.ownedRemoteCaptureProcesses) ||
    !Array.isArray(manifest.pendingRemoteCaptureProcesses) ||
    (manifest.devTunnelMappings !== undefined && !Array.isArray(manifest.devTunnelMappings)) ||
    !Array.isArray(manifest.processes)
  )
    fail('VK_ANDROID_MANIFEST_INVALID');
  if (manifest.authorization !== undefined && !RUN_AUTHORIZATIONS.includes(manifest.authorization)) {
    fail('VK_ANDROID_RUN_AUTHORIZATION_INVALID');
  }

  for (const shape of ['dual', 'mobile']) safeSerial(manifest.devices[shape].serial);
  if (manifest.emulatorPairIdentity !== undefined) {
    const observedPair = validateTerminalEmulatorPair(
      manifest.devices.dual.inventory,
      manifest.devices.mobile.inventory,
    );
    if (JSON.stringify(observedPair) !== JSON.stringify(manifest.emulatorPairIdentity))
      fail('VK_ANDROID_DISTINCT_EMULATOR_IDENTITY_MISMATCH');
  }
  for (const [appName, binding] of Object.entries(manifest.appBindings)) {
    const app = APPS[appName];
    const expectedBuild = app && appBuildArtifact(appName, binding.buildType ?? 'release');
    const expectedPath = expectedBuild?.apkPath;
    const historicalCleanupPath = path.posix.join(
      'apps/terminal/assembly/android',
      appName,
      'android/app/build/outputs/apk/release/app-release.apk',
    );
    const pathMatches = binding.apkPath === expectedPath ||
      (allowHistoricalApkPathsForCleanup && binding.apkPath === historicalCleanupPath && (binding.buildType ?? 'release') === 'release');
    if (
      !app ||
      !pathMatches ||
      !Number.isSafeInteger(binding.bytes) ||
      binding.bytes <= 0 ||
      !/^[a-f0-9]{64}$/i.test(binding.sha256 ?? '')
    )
      fail('VK_ANDROID_MANIFEST_APP_BINDING_INVALID');
    if (binding.sourceDigest !== undefined && !/^[a-f0-9]{64}$/i.test(binding.sourceDigest))
      fail('VK_ANDROID_MANIFEST_APP_BINDING_INVALID');
    if (manifest.a11BaselineRunId && (binding.buildType ?? 'release') !== 'release')
      fail('VK_ANDROID_A11_W10_DEBUG_BUILD_FORBIDDEN');
  }
  if (manifest.a11BaselineRunId !== undefined && manifest.a11BaselineRunId !== null) {
    safeRunId(manifest.a11BaselineRunId);
    if (
      !manifest.a11Baseline ||
      !/^[a-f0-9]{64}$/i.test(manifest.a11W10SourceDigest ?? '') ||
      !Array.isArray(manifest.persistKvW10Upgrades) ||
      manifest.persistKvW10Upgrades.length > 4 ||
      (manifest.persistKvW10PendingObservation !== null &&
        manifest.persistKvW10PendingObservation !== undefined &&
        (!A11_W10_PAIRS.includes(
          `${manifest.persistKvW10PendingObservation.shape}:${manifest.persistKvW10PendingObservation.appName}`,
        ) ||
          !/^[A-Za-z0-9._-]{1,96}$/.test(manifest.persistKvW10PendingObservation.intentId ?? '') ||
          manifest.persistKvW10PendingObservation.packageName !==
            APPS[manifest.persistKvW10PendingObservation.appName]?.packageName ||
          manifest.persistKvW10PendingObservation.serial !==
            manifest.devices[manifest.persistKvW10PendingObservation.shape]?.serial ||
          manifest.persistKvW10PendingObservation.bootId !==
            manifest.devices[manifest.persistKvW10PendingObservation.shape]?.inventory?.bootId ||
          manifest.persistKvW10PendingObservation.sourceDigest !== manifest.a11W10SourceDigest ||
          manifest.persistKvW10PendingObservation.installMode !== 'install -r' ||
          typeof manifest.persistKvW10PendingObservation.launchResolved !== 'boolean' ||
          !/^[a-f0-9]{64}$/i.test(manifest.persistKvW10PendingObservation.oldApkSha256 ?? '') ||
          !/^[a-f0-9]{64}$/i.test(manifest.persistKvW10PendingObservation.apkSha256 ?? '')))
    ) {
      fail('VK_ANDROID_A11_W10_MANIFEST_INVALID');
    }
    const seenW10 = new Set();
    for (const item of manifest.persistKvW10Upgrades) {
      const pair = `${item.shape}:${item.appName}`;
      const baseline = manifest.a11Baseline.markers.find(
        marker => marker.shape === item.shape && marker.appName === item.appName,
      );
      const app = APPS[item.appName];
      if (
        !app ||
        !A11_W10_PAIRS.includes(pair) ||
        seenW10.has(pair) ||
        !baseline ||
        item.packageName !== app.packageName ||
        item.serial !== manifest.devices[item.shape].serial ||
        item.bootId !== manifest.devices[item.shape].inventory?.bootId ||
        item.oldApkSha256 !== baseline.apkSha256 ||
        item.apkSha256 === item.oldApkSha256 ||
        item.sourceDigest !== manifest.a11W10SourceDigest ||
        item.installMode !== 'install -r' ||
        !/^[A-Za-z0-9._-]{1,96}$/.test(item.intentId ?? '') ||
        typeof item.observedAt !== 'string' ||
        !Number.isFinite(Date.parse(item.observedAt)) ||
        item.observationStatus !== 'PASS' ||
        item.namespaceVersion !== 2 ||
        item.newNamespaceExistedBeforeOpen !== false ||
        item.legacyNamespacePresent !== true ||
        item.operationSucceededAfterOpen !== true ||
        item.keyMismatchObserved !== false
      ) {
        fail('VK_ANDROID_A11_W10_MANIFEST_INVALID');
      }
      seenW10.add(pair);
    }
    if (manifest.business === 'PASS' && seenW10.size !== A11_W10_PAIRS.length)
      fail('VK_ANDROID_A11_W10_DENOMINATOR_INVALID');
  }

  const validRemoteIdentity = (identity, allowEmptyProcesses) => {
    if (
      !['dual', 'mobile'].includes(identity.shape) ||
      !APPS[identity.appName] ||
      identity.packageName !== APPS[identity.appName].packageName ||
      identity.host !== manifest.devices[identity.shape].serial ||
      !/^[A-Za-z0-9-]{8,96}$/.test(identity.bootId ?? '') ||
      !Array.isArray(identity.processes) ||
      (!allowEmptyProcesses && identity.processes.length === 0) ||
      identity.processes.some(
        value => !Number.isSafeInteger(value.pid) || value.pid <= 0 || !/^\d+$/.test(value.startTicks ?? ''),
      )
    ) {
      fail('VK_ANDROID_MANIFEST_APP_BINDING_INVALID');
    }
  };
  for (const identity of manifest.ownedRemoteProcesses) validRemoteIdentity(identity, false);
  for (const intent of manifest.pendingRemoteLaunches) {
    validRemoteIdentity({...intent, processes: []}, true);
    if (!/^[A-Za-z0-9._-]{1,96}$/.test(intent.intentId ?? '')) fail('VK_ANDROID_MANIFEST_APP_BINDING_INVALID');
  }
  if (manifest.processReadbackPreflight !== undefined) {
    const observations = manifest.processReadbackPreflight;
    const allowedNames = new Set(['system_server', ...Object.values(APPS).map(app => app.packageName)]);
    if (
      !Array.isArray(observations) ||
      observations.some(
        item =>
          !['dual', 'mobile'].includes(item.shape) ||
          !allowedNames.has(item.processName) ||
          !['PRESENT', 'ABSENT'].includes(item.status) ||
          !Number.isSafeInteger(item.processCount) ||
          item.processCount < 0 ||
          (item.status === 'PRESENT') !== item.processCount > 0 ||
          (item.processName === 'system_server' && item.processCount === 0),
      ) ||
      new Set(observations.map(item => `${item.shape}:${item.processName}`)).size !== observations.length ||
      (manifest.phase === 'PREPARED' &&
        (observations.length !== 6 ||
          ['dual', 'mobile'].some(
            shape =>
              !observations.some(
                item => item.shape === shape && item.processName === 'system_server' && item.status === 'PRESENT',
              ),
          )))
    ) {
      fail('VK_ANDROID_MANIFEST_PROCESS_READBACK_PREFLIGHT_INVALID');
    }
  }
  for (const resolved of manifest.resolvedRemoteLaunches ?? []) {
    validRemoteIdentity({...resolved, processes: []}, true);
    if (
      !/^[A-Za-z0-9._-]{1,96}$/.test(resolved.intentId ?? '') ||
      !['PROCESS_ADOPTED', 'PROCESS_ABSENT'].includes(resolved.resolution) ||
      !Number.isSafeInteger(resolved.processCount) ||
      resolved.processCount < 0
    )
      fail('VK_ANDROID_MANIFEST_APP_BINDING_INVALID');
  }
  if (manifest.historicalRemoteLaunchRecoveries !== undefined) {
    if (!Array.isArray(manifest.historicalRemoteLaunchRecoveries)) fail('VK_ANDROID_HISTORICAL_RECOVERY_INVALID');
    for (const recovery of manifest.historicalRemoteLaunchRecoveries) {
      const app = APPS[recovery.appName];
      if (
        !app ||
        recovery.packageName !== app.packageName ||
        !['dual', 'mobile'].includes(recovery.shape) ||
        recovery.host !== manifest.devices[recovery.shape].serial ||
        !/^[A-Za-z0-9-]{8,96}$/.test(recovery.bootId ?? '') ||
        !/^[A-Za-z0-9._-]{1,96}$/.test(recovery.intentId ?? '') ||
        !['PROCESS_ADOPTED', 'PROCESS_ABSENT'].includes(recovery.resolution) ||
        !Array.isArray(recovery.processes) ||
        (recovery.resolution === 'PROCESS_ADOPTED' && recovery.processes.length === 0) ||
        (recovery.resolution === 'PROCESS_ABSENT' && recovery.processes.length !== 0) ||
        recovery.processes.some(
          value => !Number.isSafeInteger(value.pid) || value.pid <= 0 || !/^\d+$/.test(value.startTicks ?? ''),
        )
      ) {
        fail('VK_ANDROID_HISTORICAL_RECOVERY_INVALID');
      }
    }
  }
  if (manifest.launchDiagnostics !== undefined && !Array.isArray(manifest.launchDiagnostics))
    fail('VK_ANDROID_MANIFEST_INVALID');
  if (manifest.launchLogInspections !== undefined && !Array.isArray(manifest.launchLogInspections))
    fail('VK_ANDROID_MANIFEST_INVALID');
  if (manifest.launchLogReinspections !== undefined && !Array.isArray(manifest.launchLogReinspections))
    fail('VK_ANDROID_MANIFEST_INVALID');
  for (const diagnostic of manifest.launchDiagnostics ?? []) {
    const signals = diagnostic.signals?.nativeFatalSignals;
    const breadcrumbFieldsPresent = diagnostic.observedMarkers !== undefined || diagnostic.markerCount !== undefined;
    if (
      (diagnostic.startupPid !== undefined && diagnostic.startupPid !== null && !/^\d+$/.test(diagnostic.startupPid)) ||
      (signals !== undefined &&
        (!Array.isArray(signals) ||
          signals.some(signal => !NATIVE_FATAL_SIGNAL_ALLOWLIST.has(signal)) ||
          (signals.length > 0 && !/^\d+$/.test(diagnostic.startupPid ?? '')))) ||
      (breadcrumbFieldsPresent && !validLaunchBreadcrumbRecord(diagnostic.observedMarkers, diagnostic.markerCount))
    ) {
      fail('VK_ANDROID_MANIFEST_APP_BINDING_INVALID');
    }
  }
  const inspectedIntentIds = new Set();
  for (const inspection of manifest.launchLogInspections ?? []) {
    const resolved = (manifest.resolvedRemoteLaunches ?? []).find(item => item.intentId === inspection.intentId);
    const processTableCandidates = inspection.processTableCandidates;
    const processTableEvidencePresent =
      processTableCandidates !== undefined || inspection.processTableCandidateCount !== undefined;
    if (
      !resolved ||
      resolved.resolution !== 'PROCESS_ABSENT' ||
      resolved.processCount !== 0 ||
      inspection.shape !== resolved.shape ||
      inspection.appName !== resolved.appName ||
      inspection.host !== resolved.host ||
      inspection.bootId !== resolved.bootId ||
      inspection.packageName !== resolved.packageName ||
      !Array.isArray(inspection.observedMarkers) ||
      inspection.observedMarkers.some(
        marker =>
          !APP_LAUNCH_BREADCRUMBS.some(item => item.summary === marker) &&
          !LEGACY_APP_LAUNCH_BREADCRUMB_SUMMARIES.has(marker),
      ) ||
      (inspection.startupPid !== undefined && inspection.startupPid !== null && !/^\d+$/.test(inspection.startupPid)) ||
      (inspection.signals?.nativeFatalSignals !== undefined &&
        (!Array.isArray(inspection.signals.nativeFatalSignals) ||
          inspection.signals.nativeFatalSignals.some(signal => !NATIVE_FATAL_SIGNAL_ALLOWLIST.has(signal)) ||
          (inspection.signals.nativeFatalSignals.length > 0 && !/^\d+$/.test(inspection.startupPid ?? '')))) ||
      (processTableEvidencePresent &&
        (!Array.isArray(processTableCandidates) ||
          !Number.isSafeInteger(inspection.processTableCandidateCount) ||
          inspection.processTableCandidateCount !== processTableCandidates.length ||
          processTableCandidates.some(
            candidate =>
              !Number.isSafeInteger(candidate.pid) ||
              candidate.pid <= 0 ||
              typeof candidate.name !== 'string' ||
              (candidate.name !== inspection.packageName &&
                (!candidate.name.startsWith(`${inspection.packageName}:`) ||
                  !/^[A-Za-z0-9._-]+$/.test(candidate.name.slice(inspection.packageName.length + 1)))) ||
              !/^\d+$/.test(candidate.startTicks ?? ''),
          ) ||
          new Set(processTableCandidates.map(candidate => candidate.pid)).size !== processTableCandidates.length)) ||
      inspection.markerCount !== inspection.observedMarkers.length ||
      inspectedIntentIds.has(inspection.intentId)
    ) {
      fail('VK_ANDROID_MANIFEST_APP_BINDING_INVALID');
    }
    inspectedIntentIds.add(inspection.intentId);
  }
  const reinspectedIntentIds = new Set();
  const reinspectionKeys = new Set([
    'intentId',
    'shape',
    'appName',
    'packageName',
    'host',
    'bootId',
    'evidenceStatus',
    'startupPid',
    'startupAtEpochMs',
    'overlayOutcome',
    'observedMarkers',
    'markerCount',
    'signals',
    'processObservation',
    'exitInfo',
    'inspectedAt',
  ]);
  const legacyReinspectionKeys = [...reinspectionKeys].filter(key => !['processObservation', 'exitInfo'].includes(key));
  const allowedOverlayOutcomes = new Set([
    'ATTACHED',
    'SKIPPED_GATE_UNAVAILABLE',
    'SKIPPED_CONFIG_UNAVAILABLE',
    'SKIPPED_CONTENT_UNAVAILABLE',
    'AMBIGUOUS',
    'NOT_OBSERVED',
  ]);
  const signalKeys = [
    'fatalException',
    'processDied',
    'nativeFatalSignals',
    'exceptionTypes',
    'appFrames',
    'jsErrorSeen',
  ];
  const appFrameKeys = ['className', 'location'];
  const processObservationKeys = [
    'startupPid',
    'processTableCandidateCount',
    'processTableCandidates',
    'startupPidStatus',
  ];
  const processCandidateKeys = ['pid', 'name', 'statStatus', 'processState', 'startTicks'];
  const exitInfoKeys = ['startupPid', 'status', 'packageRecordCount', 'targetPidRecordCount', 'records'];
  const exitRecordKeys = ['pid', 'reasonCode', 'reasonName', 'statusCode'];
  const hasExactKeys = (value, keys) =>
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
  const isCanonicalUtcTimestamp = value =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
  const validProcessObservation = (observation, packageName) => {
    if (
      !hasExactKeys(observation, processObservationKeys) ||
      (observation.startupPid !== null && !/^\d{1,10}$/.test(observation.startupPid ?? '')) ||
      !Number.isSafeInteger(observation.processTableCandidateCount) ||
      observation.processTableCandidateCount < 0 ||
      observation.processTableCandidateCount > 32 ||
      !Array.isArray(observation.processTableCandidates) ||
      observation.processTableCandidateCount !== observation.processTableCandidates.length ||
      !['NOT_PROVIDED', 'NOT_IN_PROCESS_TABLE', 'READABLE', 'CANDIDATE_STAT_UNREADABLE'].includes(
        observation.startupPidStatus,
      )
    )
      return false;
    const candidates = observation.processTableCandidates;
    const packageNamePattern = new RegExp(
      `^${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?::[A-Za-z0-9._-]{1,96})?$`,
    );
    if (
      candidates.some(
        candidate =>
          !hasExactKeys(candidate, processCandidateKeys) ||
          !Number.isSafeInteger(candidate.pid) ||
          candidate.pid <= 0 ||
          candidate.pid > 2_147_483_647 ||
          typeof candidate.name !== 'string' ||
          candidate.name.length > 160 ||
          !packageNamePattern.test(candidate.name) ||
          !['READABLE', 'UNREADABLE'].includes(candidate.statStatus) ||
          (candidate.statStatus === 'READABLE'
            ? !/^[A-Za-z]$/.test(candidate.processState ?? '') || !/^\d{1,20}$/.test(candidate.startTicks ?? '')
            : candidate.processState !== null || candidate.startTicks !== null),
      )
    )
      return false;
    if (new Set(candidates.map(candidate => candidate.pid)).size !== candidates.length) return false;
    const target =
      observation.startupPid === null
        ? null
        : candidates.find(candidate => candidate.pid === Number(observation.startupPid));
    const expectedStatus =
      observation.startupPid === null
        ? 'NOT_PROVIDED'
        : !target
          ? 'NOT_IN_PROCESS_TABLE'
          : target.statStatus === 'READABLE'
            ? 'READABLE'
            : 'CANDIDATE_STAT_UNREADABLE';
    return observation.startupPidStatus === expectedStatus;
  };
  const validExitInfo = (exitInfo, packageName) => {
    const statuses = ['MATCHED', 'NO_PACKAGE_RECORD', 'PACKAGE_RECORD_NO_TARGET_PID', 'UNPARSEABLE_TARGET_RECORD'];
    if (
      !hasExactKeys(exitInfo, exitInfoKeys) ||
      (exitInfo.startupPid !== null && !/^\d{1,10}$/.test(exitInfo.startupPid ?? '')) ||
      !statuses.includes(exitInfo.status) ||
      !Number.isSafeInteger(exitInfo.packageRecordCount) ||
      exitInfo.packageRecordCount < 0 ||
      exitInfo.packageRecordCount > 50 ||
      !Number.isSafeInteger(exitInfo.targetPidRecordCount) ||
      exitInfo.targetPidRecordCount < 0 ||
      exitInfo.targetPidRecordCount > exitInfo.packageRecordCount ||
      !Array.isArray(exitInfo.records) ||
      exitInfo.records.length > 8 ||
      exitInfo.records.some(
        record =>
          !hasExactKeys(record, exitRecordKeys) ||
          !Number.isSafeInteger(record.pid) ||
          record.pid <= 0 ||
          String(record.pid) !== exitInfo.startupPid ||
          !Number.isSafeInteger(record.reasonCode) ||
          record.reasonCode < 0 ||
          record.reasonCode > 9999 ||
          typeof record.reasonName !== 'string' ||
          record.reasonName.length > 64 ||
          !/^[A-Z][A-Z0-9_]*$/.test(record.reasonName) ||
          !Number.isSafeInteger(record.statusCode) ||
          record.statusCode < -999999 ||
          record.statusCode > 999999,
      )
    )
      return false;
    if (exitInfo.records.length > exitInfo.targetPidRecordCount) return false;
    return exitInfo.status === 'MATCHED'
      ? exitInfo.records.length > 0
      : exitInfo.status === 'NO_PACKAGE_RECORD'
        ? exitInfo.packageRecordCount === 0 && exitInfo.targetPidRecordCount === 0
        : exitInfo.status === 'PACKAGE_RECORD_NO_TARGET_PID'
          ? exitInfo.packageRecordCount > 0 && exitInfo.targetPidRecordCount === 0
          : exitInfo.targetPidRecordCount > 0 && exitInfo.records.length === 0;
  };
  for (const inspection of manifest.launchLogReinspections ?? []) {
    const resolved = (manifest.resolvedRemoteLaunches ?? []).find(item => item.intentId === inspection.intentId);
    const signals = inspection.signals;
    const escapedPackage =
      typeof inspection.packageName === 'string' ? inspection.packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '';
    const exceptionTypePattern = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:Exception|Error)$/;
    const appClassPattern = new RegExp(`^${escapedPackage}\\.[A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*$`);
    const allowedMarkers = APP_LAUNCH_BREADCRUMBS.map(item => item.summary);
    const overlayMarker = {
      ATTACHED: 'native.loading-overlay-attached',
      SKIPPED_GATE_UNAVAILABLE: 'native.loading-overlay-skipped:gate-unavailable',
      SKIPPED_CONFIG_UNAVAILABLE: 'native.loading-overlay-skipped:config-unavailable',
      SKIPPED_CONTENT_UNAVAILABLE: 'native.loading-overlay-skipped:content-unavailable',
    };
    const overlayMarkers = Object.values(overlayMarker);
    const observedMarkers = Array.isArray(inspection.observedMarkers) ? inspection.observedMarkers : [];
    const observedOverlayMarkers = observedMarkers.filter(marker => overlayMarkers.includes(marker));
    const overlayOutcomeMatchesMarkers =
      inspection.overlayOutcome === 'AMBIGUOUS'
        ? observedOverlayMarkers.length >= 2
        : inspection.overlayOutcome === 'NOT_OBSERVED'
          ? observedOverlayMarkers.length === 0
          : observedOverlayMarkers.length === 1 &&
            observedOverlayMarkers[0] === overlayMarker[inspection.overlayOutcome];
    const signalValuesPresent =
      signals &&
      (signals.fatalException ||
        signals.processDied ||
        signals.jsErrorSeen ||
        signals.nativeFatalSignals?.length > 0 ||
        signals.exceptionTypes?.length > 0 ||
        signals.appFrames?.length > 0);
    // Earlier runner bytes persisted an explicitly insufficient record before process/exit summaries existed.
    // Accept only that exact no-observation shape so cleanup can read the immutable history without upgrading it.
    const legacyInsufficientRecord =
      hasExactKeys(inspection, legacyReinspectionKeys) &&
      inspection.evidenceStatus === 'INSUFFICIENT_EVIDENCE' &&
      inspection.startupPid === null &&
      inspection.startupAtEpochMs === null &&
      inspection.overlayOutcome === 'NOT_OBSERVED' &&
      Array.isArray(inspection.observedMarkers) &&
      inspection.observedMarkers.length === 0 &&
      inspection.markerCount === 0;
    if (
      !resolved ||
      resolved.resolution !== 'PROCESS_ABSENT' ||
      resolved.processCount !== 0 ||
      inspection.shape !== resolved.shape ||
      inspection.appName !== resolved.appName ||
      inspection.packageName !== resolved.packageName ||
      inspection.host !== resolved.host ||
      inspection.bootId !== resolved.bootId ||
      !['MATCHED', 'INSUFFICIENT_EVIDENCE', 'PID_MISMATCH', 'AMBIGUOUS_STARTUP_PID'].includes(
        inspection.evidenceStatus,
      ) ||
      (inspection.startupPid !== null &&
        !new RegExp(`^\\d{1,${MAX_REINSPECTION_PID_LENGTH}}$`).test(inspection.startupPid ?? '')) ||
      (inspection.startupAtEpochMs !== null &&
        (!Number.isSafeInteger(inspection.startupAtEpochMs) || inspection.startupAtEpochMs <= 0)) ||
      (inspection.evidenceStatus === 'MATCHED' &&
        (!new RegExp(`^\\d{1,${MAX_REINSPECTION_PID_LENGTH}}$`).test(inspection.startupPid ?? '') ||
          !Number.isSafeInteger(inspection.startupAtEpochMs))) ||
      !isCanonicalUtcTimestamp(inspection.inspectedAt) ||
      !allowedOverlayOutcomes.has(inspection.overlayOutcome) ||
      !Array.isArray(inspection.observedMarkers) ||
      inspection.observedMarkers.length > allowedMarkers.length ||
      inspection.observedMarkers.some(marker => !allowedMarkers.includes(marker)) ||
      new Set(inspection.observedMarkers).size !== inspection.observedMarkers.length ||
      inspection.markerCount !== inspection.observedMarkers.length ||
      !hasExactKeys(signals, signalKeys) ||
      typeof signals.fatalException !== 'boolean' ||
      typeof signals.processDied !== 'boolean' ||
      !Array.isArray(signals.nativeFatalSignals) ||
      signals.nativeFatalSignals.length > NATIVE_FATAL_SIGNAL_ALLOWLIST.size ||
      signals.nativeFatalSignals.some(signal => !NATIVE_FATAL_SIGNAL_ALLOWLIST.has(signal)) ||
      new Set(signals.nativeFatalSignals).size !== signals.nativeFatalSignals.length ||
      (signals.nativeFatalSignals.length > 0 && !/^\d+$/.test(inspection.startupPid ?? '')) ||
      !Array.isArray(signals.exceptionTypes) ||
      signals.exceptionTypes.length > 2000 ||
      signals.exceptionTypes.some(
        value =>
          typeof value !== 'string' ||
          value.length > MAX_REINSPECTION_DIAGNOSTIC_STRING_LENGTH ||
          !exceptionTypePattern.test(value),
      ) ||
      new Set(signals.exceptionTypes).size !== signals.exceptionTypes.length ||
      !Array.isArray(signals.appFrames) ||
      signals.appFrames.length > 8 ||
      signals.appFrames.some(
        frame =>
          !hasExactKeys(frame, appFrameKeys) ||
          typeof frame.className !== 'string' ||
          frame.className.length > MAX_REINSPECTION_DIAGNOSTIC_STRING_LENGTH ||
          !appClassPattern.test(frame.className) ||
          typeof frame.location !== 'string' ||
          frame.location.length > MAX_REINSPECTION_LOCATION_LENGTH ||
          !/^[A-Za-z0-9_.$-]+:\d+$/.test(frame.location),
      ) ||
      new Set(signals.appFrames.map(frame => `${frame.className}|${frame.location}`)).size !==
        signals.appFrames.length ||
      typeof signals.jsErrorSeen !== 'boolean' ||
      (inspection.evidenceStatus !== 'MATCHED' &&
        (inspection.startupPid !== null ||
          inspection.startupAtEpochMs !== null ||
          inspection.overlayOutcome !== 'NOT_OBSERVED' ||
          inspection.observedMarkers.length !== 0 ||
          signalValuesPresent)) ||
      (inspection.evidenceStatus === 'MATCHED' && signalValuesPresent && !/^\d+$/.test(inspection.startupPid ?? '')) ||
      !overlayOutcomeMatchesMarkers ||
      (!legacyInsufficientRecord &&
        (!validProcessObservation(inspection.processObservation, inspection.packageName) ||
          !validExitInfo(inspection.exitInfo, inspection.packageName) ||
          !Object.keys(inspection).every(key => reinspectionKeys.has(key)) ||
          ![...reinspectionKeys].every(key => Object.prototype.hasOwnProperty.call(inspection, key)))) ||
      reinspectedIntentIds.has(inspection.intentId)
    )
      fail('VK_ANDROID_MANIFEST_APP_BINDING_INVALID');
    reinspectedIntentIds.add(inspection.intentId);
  }
  for (const identity of manifest.ownedRemoteCaptureProcesses) {
    if (
      identity.executable !== 'screenrecord' ||
      !['dual', 'mobile'].includes(identity.shape) ||
      identity.host !== manifest.devices[identity.shape].serial ||
      !/^[A-Za-z0-9-]{8,96}$/.test(identity.bootId ?? '') ||
      !Number.isSafeInteger(identity.pid) ||
      identity.pid <= 0 ||
      !/^\d+$/.test(identity.startTicks ?? '') ||
      !new RegExp(`^/sdcard/${manifest.runId}-(dual|mobile)-\\d{13}-transition\\.(mp4|log)$`).test(identity.path ?? '')
    ) {
      fail('VK_ANDROID_REMOTE_CAPTURE_IDENTITY_INVALID');
    }
  }
  for (const intent of manifest.pendingRemoteCaptureProcesses) {
    if (
      intent.executable !== 'screenrecord' ||
      !['dual', 'mobile'].includes(intent.shape) ||
      intent.host !== manifest.devices[intent.shape].serial ||
      !/^[A-Za-z0-9-]{8,96}$/.test(intent.bootId ?? '') ||
      !new RegExp(`^/sdcard/${manifest.runId}-(dual|mobile)-\\d{13}-transition\\.(mp4|log)$`).test(intent.path ?? '')
    ) {
      fail('VK_ANDROID_REMOTE_CAPTURE_IDENTITY_INVALID');
    }
  }
  for (const temp of manifest.remoteTempFiles) {
    const validHost = ['dual', 'mobile'].some(shape => manifest.devices[shape].serial === temp.host);
    const safePath = new RegExp(
      `^/sdcard/${manifest.runId}-(dual|mobile)-\\d{13}(?:\\.xml|-transition\\.(?:mp4|log))$`,
    ).test(temp.path ?? '');
    if (!validHost || !safePath) fail('VK_ANDROID_MANIFEST_TEMP_PATH_INVALID');
  }
  const seenTunnelMappings = new Set();
  for (const mapping of manifest.devTunnelMappings ?? []) {
    const app = APPS[mapping.appName];
    const routeKey = `${mapping.shape}:${mapping.devicePort}`;
    if (
      !['dual', 'mobile'].includes(mapping.shape) ||
      !app ||
      !manifest.appBindings[mapping.appName] ||
      mapping.serial !== manifest.devices[mapping.shape].serial ||
      mapping.deviceBootId !== manifest.devices[mapping.shape].inventory?.bootId ||
      !Number.isInteger(mapping.devicePort) ||
      mapping.devicePort < 1 ||
      mapping.devicePort > 65535 ||
      !Number.isInteger(mapping.hostPort) ||
      mapping.hostPort < 1 ||
      mapping.hostPort > 65535 ||
      mapping.status !== 'OWNED' && mapping.status !== 'CREATING' ||
      !RUN_ID_RE.test(mapping.devRunId ?? '') ||
      seenTunnelMappings.has(routeKey)
    )
      fail('VK_ANDROID_DEV_TUNNEL_MAPPING_INVALID');
    seenTunnelMappings.add(routeKey);
  }
  if (manifest.activeProcessIdentity !== null && manifest.activeProcessIdentity !== undefined) {
    const identity = manifest.activeProcessIdentity;
    if (
      !Number.isSafeInteger(identity.pid) ||
      identity.pid <= 0 ||
      !Number.isSafeInteger(identity.pgid) ||
      identity.pgid <= 0 ||
      !canonicalStartToken(identity.startToken)
    )
      fail('VK_ANDROID_MANIFEST_LOCAL_PROCESS_IDENTITY_INVALID');
  }
  return true;
}

export function validateAdbArgs(args) {
  const deviceArgs = args[0] === '-s' ? args.slice(2) : args;
  const command = deviceArgs[0];
  const shellArgs = command === 'shell' ? deviceArgs.slice(1) : [];
  if (
    (command === 'logcat' && deviceArgs.slice(1).includes('-c')) ||
    (shellArgs[0] === 'pm' && shellArgs[1] === 'clear')
  )
    fail('VK_ANDROID_FORBIDDEN_DEVICE_COMMAND');
  return true;
}

export function remoteProcessIdentityMatches(expected, current, deviceSerial) {
  if (
    !expected ||
    !current ||
    expected.host !== deviceSerial ||
    current.host !== deviceSerial ||
    !expected.bootId ||
    current.bootId !== expected.bootId ||
    !Array.isArray(expected.processes) ||
    !Array.isArray(current.processes) ||
    expected.processes.length === 0 ||
    expected.processes.length !== current.processes.length
  )
    return false;
  const expectedIds = new Set(expected.processes.map(value => `${value.pid}:${value.startTicks}`));
  const currentIds = new Set(current.processes.map(value => `${value.pid}:${value.startTicks}`));
  return (
    expectedIds.size === expected.processes.length &&
    currentIds.size === current.processes.length &&
    [...expectedIds].every(value => currentIds.has(value))
  );
}

export async function cleanupRecordedLocalCommand(
  manifest,
  {readTable = readProcessTable, terminate = terminateOwnedProcessTree} = {},
) {
  const identity = manifest.activeProcessIdentity;
  const processTable = readTable();
  if (!identity) {
    const liveRecorded = (manifest.processes ?? []).some(recorded =>
      processTable.some(
        value =>
          value.pid === recorded.pid &&
          value.pgid === recorded.pgid &&
          canonicalStartToken(value.startToken) === canonicalStartToken(recorded.startToken),
      ),
    );
    if (liveRecorded) return {status: 'FAIL', reason: 'VK_ANDROID_LOCAL_PROCESS_IDENTITY_UNRESOLVED'};
    manifest.processes = [];
    return {status: 'PASS', reason: 'NO_LIVE_RECORDED_LOCAL_PROCESS'};
  }
  const rootMatches = processTable.some(
    value =>
      value.pid === identity.pid &&
      value.pgid === identity.pgid &&
      canonicalStartToken(value.startToken) === canonicalStartToken(identity.startToken),
  );
  if (!rootMatches) {
    const remaining = snapshotProcessTree(identity, processTable);
    if (remaining.length > 0) return {status: 'FAIL', reason: 'VK_ANDROID_LOCAL_PROCESS_TREE_IDENTITY_UNRESOLVED'};
    const otherLiveRecorded = (manifest.processes ?? []).some(
      recorded =>
        recorded.pid !== identity.pid &&
        processTable.some(
          value =>
            value.pid === recorded.pid &&
            value.pgid === recorded.pgid &&
            canonicalStartToken(value.startToken) === canonicalStartToken(recorded.startToken),
        ),
    );
    if (otherLiveRecorded) {
      manifest.activeProcessIdentity = null;
      return {status: 'FAIL', reason: 'VK_ANDROID_LOCAL_RUNNER_STILL_LIVE'};
    }
    manifest.activeProcessIdentity = null;
    manifest.processes = [];
    return {status: 'PASS', reason: 'RECORDED_LOCAL_COMMAND_ALREADY_EXITED'};
  }
  const result = await terminate(identity, {waitMs: 15_000, readTable});
  const afterTable = readTable();
  const remaining = snapshotProcessTree(identity, afterTable);
  if (result.status !== 'PASS' || remaining.length > 0)
    return {status: 'FAIL', reason: 'VK_ANDROID_LOCAL_PROCESS_TREE_CLEANUP_FAILED'};
  const otherLiveRecorded = (manifest.processes ?? []).filter(
    recorded =>
      recorded.pid !== identity.pid &&
      afterTable.some(
        value =>
          value.pid === recorded.pid &&
          value.pgid === recorded.pgid &&
          canonicalStartToken(value.startToken) === canonicalStartToken(recorded.startToken),
      ),
  );
  if (otherLiveRecorded.length > 0) {
    manifest.activeProcessIdentity = null;
    return {status: 'FAIL', reason: 'VK_ANDROID_LOCAL_RUNNER_STILL_LIVE'};
  }
  manifest.activeProcessIdentity = null;
  manifest.processes = [];
  return {status: 'PASS', reason: 'VERIFIED_OWNED_LOCAL_PROCESS_TREE_TERMINATED'};
}

export async function launchWithPendingOwnership(manifest, intent, {persist, launch, readback, onLaunchFailure}) {
  const app = APPS[intent.appName];
  if (
    !app ||
    intent.packageName !== app.packageName ||
    intent.host !== manifest.devices[intent.shape]?.serial ||
    !intent.bootId ||
    !intent.intentId
  )
    fail('VK_ANDROID_MANIFEST_APP_BINDING_INVALID');
  const pendingW10 = manifest.persistKvW10PendingObservation;
  if (pendingW10 && pendingW10.intentId !== intent.intentId) fail('VK_ANDROID_A11_W10_LAUNCH_INTENT_MISMATCH');
  manifest.pendingRemoteLaunches.push({...intent, startedAt: now()});
  await persist();
  const noteFailure = async (stage, failureCode) => {
    if (!onLaunchFailure) return;
    try {
      await onLaunchFailure({intentId: intent.intentId, stage, failureCode});
    } catch {
      /* Preserve the original launch failure. */
    }
  };
  try {
    await launch();
  } catch (error) {
    const failureCode = /^VK_[A-Z0-9_]+$/.test(error?.message ?? '')
      ? error.message
      : 'VK_ANDROID_ACTIVITY_LAUNCH_FAILED';
    await noteFailure('activity-launch', failureCode);
    throw error;
  }
  let observed;
  try {
    observed = await readback();
  } catch (error) {
    const failureCode = /^VK_[A-Z0-9_]+$/.test(error?.message ?? '')
      ? error.message
      : 'VK_ANDROID_REMOTE_PROCESS_READBACK_FAILED';
    await noteFailure('process-readback', failureCode);
    throw error;
  }
  if (
    !observed ||
    observed.host !== intent.host ||
    observed.bootId !== intent.bootId ||
    !Array.isArray(observed.processes) ||
    observed.processes.length === 0
  ) {
    await noteFailure('ownership-readback', 'VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED');
    fail('VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED');
  }
  const resolution = resolvePendingRemoteLaunch(manifest, intent.intentId, observed);
  if (resolution !== 'PROCESS_ADOPTED') fail('VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED');
  if (pendingW10) pendingW10.launchResolved = true;
  await persist();
  return observed;
}

function parseLogcatLine(line) {
  const brief = String(line).match(/^[VDIWEF]\/([^ (]+)\(\s*(\d+)\):\s*(.*)$/);
  if (brief) return {tag: brief[1], pid: brief[2], message: brief[3], timestampMs: null};
  const epoch = String(line).match(/^(\d{10}\.\d{3})\s+(\d+)\s+\d+\s+[VDIWEF]\s+([^:]+):\s*(.*)$/);
  if (!epoch) return null;
  const timestampMs = Math.round(Number(epoch[1]) * 1000);
  if (!Number.isSafeInteger(timestampMs)) return null;
  return {tag: epoch[3], pid: epoch[2], message: epoch[4], timestampMs};
}

const STRUCTURED_RUNTIME_EVENT_FIELDS = Object.freeze({
  'runtime.system-failure.debug-injection-resolution': Object.freeze([
    ['ownerId', value => typeof value === 'string' && /^[A-Za-z0-9:._-]{1,160}$/.test(value)],
    ['source', value => value === 'initial' || value === 'event'],
    ['outcome', value => ['no-url', 'unrecognized', 'clear', 'matched', 'other-owner'].includes(value)],
    ['urlPresent', value => typeof value === 'boolean'],
  ]),
  'runtime.system-failure.debug-injection-read-failed': Object.freeze([
    ['ownerId', value => typeof value === 'string' && /^[A-Za-z0-9:._-]{1,160}$/.test(value)],
    ['source', value => value === 'initial'],
  ]),
  'runtime.system-failure.render-failed': Object.freeze([
    ['ownerId', value => typeof value === 'string' && /^[A-Za-z0-9:._-]{1,160}$/.test(value)],
    ['errorName', value => typeof value === 'string' && /^[A-Za-z_$][\w$]{0,79}$/.test(value)],
  ]),
  'startup.ready-candidate': Object.freeze([
    ['readyPartKey', value => value === null || (typeof value === 'string' && /^[A-Za-z0-9:._-]{1,160}$/.test(value))],
    [
      'contentFailure',
      value =>
        value === null ||
        [
          'render-error',
          'missing-catalog-entry',
          'incompatible-catalog-entry',
          'container-empty',
          'invalid-props',
        ].includes(value),
    ],
    ['surfaceKey', value => value === 'PRIMARY' || value === 'SECONDARY'],
    ['displayIndex', value => value === 0 || value === 1],
  ]),
  'startup.ready-hidden': Object.freeze([
    ['readyPartKey', value => value === null || (typeof value === 'string' && /^[A-Za-z0-9:._-]{1,160}$/.test(value))],
    [
      'contentFailure',
      value =>
        value === null ||
        [
          'render-error',
          'missing-catalog-entry',
          'incompatible-catalog-entry',
          'container-empty',
          'invalid-props',
        ].includes(value),
    ],
    ['surfaceKey', value => value === 'PRIMARY' || value === 'SECONDARY'],
    ['displayIndex', value => value === 0 || value === 1],
  ]),
  'startup.ready-failed': Object.freeze([
    ['readyPartKey', value => value === null || (typeof value === 'string' && /^[A-Za-z0-9:._-]{1,160}$/.test(value))],
    [
      'contentFailure',
      value =>
        value === null ||
        [
          'render-error',
          'missing-catalog-entry',
          'incompatible-catalog-entry',
          'container-empty',
          'invalid-props',
        ].includes(value),
    ],
    ['errorName', value => typeof value === 'string' && /^[A-Za-z_$][\w$]{0,79}$/.test(value)],
  ]),
});

export function summarizeStructuredRuntimeDiagnostics(logcatText, processIds) {
  if (!Array.isArray(processIds) || processIds.some(value => !/^\d{1,10}$/.test(String(value))))
    fail('VK_ANDROID_RUNTIME_DIAGNOSTIC_PID_FILTER_INVALID');
  const allowedPids = new Set(processIds.map(String));
  const events = [];
  for (const line of String(logcatText ?? '').split(/\r?\n/)) {
    const entry = parseLogcatLine(line);
    if (!entry || entry.tag !== 'ReactNativeJS' || !allowedPids.has(entry.pid)) continue;
    const objectStart = entry.message.indexOf('{');
    if (objectStart < 0) continue;
    let record;
    try {
      record = JSON.parse(entry.message.slice(objectStart));
    } catch {
      continue;
    }
    const fields = STRUCTURED_RUNTIME_EVENT_FIELDS[record?.event];
    if (!fields) continue;
    const data = record?.data;
    if (data === null || typeof data !== 'object' || Array.isArray(data)) continue;
    const summarized = {event: record.event.replace(/^runtime\.system-failure\./, '').replaceAll('.', '-')};
    let valid = true;
    for (const [field, accepts] of fields) {
      const value = data[field];
      if (!accepts(value)) {
        valid = false;
        break;
      }
      summarized[field] = value;
    }
    if (!valid) continue;
    events.push(summarized);
    if (events.length > 100) fail('VK_ANDROID_RUNTIME_DIAGNOSTIC_EVENT_LIMIT');
  }
  return {eventCount: events.length, events};
}

export function summarizeJavaScriptRuntimeErrors(logcatText, processIds) {
  if (!Array.isArray(processIds) || processIds.some(value => !/^\d{1,10}$/.test(String(value))))
    fail('VK_ANDROID_RUNTIME_DIAGNOSTIC_PID_FILTER_INVALID');
  const allowedPids = new Set(processIds.map(String));
  const kinds = new Set();
  for (const line of String(logcatText ?? '').split(/\r?\n/)) {
    const entry = parseLogcatLine(line);
    if (!entry || entry.tag !== 'ReactNativeJS' || !allowedPids.has(entry.pid)) continue;
    const message = entry.message;
    if (!/(?:error|exception|fatal|invariant violation)/i.test(message)) continue;
    const kind = /TER_DEBUG_FAILURE_INJECTION/.test(message)
      ? 'INJECTED_FAILURE'
      : /(?:Unable to load script|No bundle URL present)/i.test(message)
        ? 'BUNDLE_UNAVAILABLE'
        : /(?:Cannot find module|Unable to resolve module)/i.test(message)
          ? 'MODULE_RESOLUTION_FAILURE'
          : /TurboModuleRegistry|Native module .* not found/i.test(message)
            ? 'NATIVE_MODULE_FAILURE'
            : /Invariant Violation/i.test(message)
              ? 'RN_INVARIANT_VIOLATION'
              : /\bTypeError\b/i.test(message)
                ? 'JS_TYPE_ERROR'
                : /\bReferenceError\b/i.test(message)
                  ? 'JS_REFERENCE_ERROR'
                  : /\bSyntaxError\b/i.test(message)
                    ? 'JS_SYNTAX_ERROR'
                    : 'JS_ERROR';
    kinds.add(kind);
  }
  return {errorCount: kinds.size, kinds: [...kinds].sort()};
}

const TERMINAL_BUSINESS_LOG_EVENTS = Object.freeze({
  'activation-request-started': Object.freeze({
    category: 'terminal.activation.http',
    required: Object.freeze(['profileId', 'operationId', 'method', 'surfaceForm']),
    fields: Object.freeze(['profileId', 'operationId', 'method', 'surfaceForm']),
  }),
  'activation-request-result': Object.freeze({
    category: 'terminal.activation.http',
    required: Object.freeze(['profileId', 'operationId', 'elapsedMs', 'kind']),
    fields: Object.freeze([
      'profileId', 'operationId', 'elapsedMs', 'kind', 'status', 'errorCode', 'category', 'code',
      'requestId', 'correlationId',
    ]),
  }),
  'activation-request-threw': Object.freeze({
    category: 'terminal.activation.http',
    required: Object.freeze(['profileId', 'operationId', 'elapsedMs']),
    fields: Object.freeze(['profileId', 'operationId', 'elapsedMs']),
  }),
  'cancel-activation-request-started': Object.freeze({
    category: 'terminal.activation.http',
    required: Object.freeze(['profileId', 'operationId', 'method', 'surfaceForm']),
    fields: Object.freeze(['profileId', 'operationId', 'method', 'surfaceForm']),
  }),
  'cancel-activation-request-result': Object.freeze({
    category: 'terminal.activation.http',
    required: Object.freeze(['profileId', 'operationId', 'method', 'elapsedMs', 'kind']),
    fields: Object.freeze([
      'profileId', 'operationId', 'method', 'elapsedMs', 'kind', 'status', 'outcome', 'errorCode',
      'category', 'code', 'requestId', 'correlationId',
    ]),
  }),
  'heartbeat-pong-matched': Object.freeze({
    category: 'terminal.connection.heartbeat',
    required: Object.freeze(['profileId', 'sequence', 'rttMs']),
    fields: Object.freeze(['profileId', 'sequence', 'rttMs']),
  }),
});
const SAFE_LOG_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const validTerminalBusinessLogField = (field, value) => {
  if (field === 'profileId') return value === 'terminal-data-client';
  if (field === 'operationId') return ['activateTerminal', 'cancelTerminalActivation'].includes(value);
  if (field === 'method') return value === 'POST';
  if (field === 'kind') return ['success', 'business-rejection', 'failure'].includes(value);
  if (field === 'outcome') return ['CANCELLED', 'ALREADY_CANCELLED'].includes(value);
  if (field === 'status') return Number.isSafeInteger(value) && value >= 100 && value <= 599;
  if (field === 'elapsedMs' || field === 'sequence' || field === 'rttMs')
    return Number.isSafeInteger(value) && value >= 0;
  return typeof value === 'string' && value.length <= 128 && SAFE_LOG_ID.test(value);
};
const isCanonicalBusinessTimestamp = value =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;

export function projectTerminalBusinessLogcatEvents(logcatText, processIds, startedAt, finishedAt) {
  const start = Date.parse(startedAt);
  const finish = Date.parse(finishedAt);
  if (
    !Array.isArray(processIds) || processIds.length === 0 ||
    processIds.some(value => !/^\d{1,10}$/u.test(String(value))) ||
    new Set(processIds.map(String)).size !== processIds.length ||
    !Number.isFinite(start) || !Number.isFinite(finish) || finish < start
  ) {
    fail('VK_ANDROID_TERMINAL_BUSINESS_LOG_INPUT_INVALID');
  }
  const allowedPids = new Set(processIds.map(String));
  const events = [];
  let invalidEventCount = 0;
  for (const line of String(logcatText ?? '').split(/\r?\n/u)) {
    const entry = parseLogcatLine(line);
    if (!entry || entry.tag !== 'ReactNativeJS' || !allowedPids.has(entry.pid)) continue;
    const objectStart = entry.message.indexOf('{');
    if (objectStart < 0) continue;
    let record;
    try {
      record = JSON.parse(entry.message.slice(objectStart));
    } catch {
      continue;
    }
    const descriptor = TERMINAL_BUSINESS_LOG_EVENTS[record?.event];
    if (descriptor === undefined) continue;
    const timestamp = record?.timestamp;
    const data = record?.data;
    if (
      record.category !== descriptor.category ||
      record.scope?.moduleName !== 'kernel.base.terminal-data-client' ||
      record.security?.containsSensitiveRaw !== false ||
      !Number.isSafeInteger(entry.timestampMs) || entry.timestampMs < start || entry.timestampMs > finish ||
      !Number.isSafeInteger(timestamp) || timestamp < start || timestamp > finish ||
      data === null || typeof data !== 'object' || Array.isArray(data)
    ) {
      invalidEventCount += 1;
      continue;
    }
    const commandId = record.context?.commandId;
    if (typeof commandId !== 'string' || !SAFE_LOG_ID.test(commandId)) {
      invalidEventCount += 1;
      continue;
    }
    const requiredFields = [...descriptor.required];
    if (
      (record.event === 'activation-request-result' || record.event === 'cancel-activation-request-result') &&
      ['success', 'business-rejection'].includes(data.kind)
    ) {
      requiredFields.push('status');
    }
    if (requiredFields.some(field => !Object.hasOwn(data, field))) {
      invalidEventCount += 1;
      continue;
    }
    if (
      ['activation-request-result', 'cancel-activation-request-result'].includes(record.event) &&
      ['success', 'business-rejection'].includes(data.kind) &&
      ['requestId', 'correlationId'].some(field => typeof data[field] !== 'string' || !SAFE_LOG_ID.test(data[field]))
    ) {
      invalidEventCount += 1;
      continue;
    }
    const safeData = {};
    let valid = true;
    for (const field of descriptor.fields) {
      const value = data[field];
      if (value === undefined) continue;
      if (validTerminalBusinessLogField(field, value)) {
        safeData[field] = value;
      } else {
        valid = false;
        break;
      }
    }
    if (!valid) {
      invalidEventCount += 1;
      continue;
    }
    events.push(Object.freeze({
      at: new Date(timestamp).toISOString(),
      event: record.event,
      commandIdPresent: true,
      data: Object.freeze(safeData),
    }));
    if (events.length > 200) fail('VK_ANDROID_TERMINAL_BUSINESS_LOG_EVENT_LIMIT');
  }
  return Object.freeze({events: Object.freeze(events), invalidEventCount});
}

function safeJavaScriptErrorMessage(message) {
  const normalized = String(message ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    /\b(?:password|passwd|token|cookie|authorization|otp|phone|mobile|username|login|credential|session|account|payload|request body|response body)\b/i.test(
      normalized,
    )
  ) {
    return '[SENSITIVE_DETAIL_REDACTED]';
  }
  const withoutName = normalized.replace(
    /^(?:Uncaught\s+)?(?:Invariant Violation|Error|[A-Za-z_$][\w$]*(?:Error|Exception))\s*:\s*/i,
    '',
  );
  const sanitized = withoutName
    .replace(/https?:\/\/[^\s)]+/gi, '[URL_REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL_REDACTED]')
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_REDACTED]')
    .replace(/\b\+?\d[\d ().-]{7,}\d\b/g, '[NUMBER_REDACTED]')
    .replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '[VALUE_REDACTED]')
    .replace(/\b(?:0x)?[a-f0-9]{24,}\b/gi, '[OPAQUE_ID_REDACTED]')
    .replace(/\b[A-Za-z0-9._-]{40,}\b/g, '[OPAQUE_VALUE_REDACTED]');
  return /^[\x20-\x7e]*$/.test(sanitized) ? sanitized.slice(0, 180) : '[DETAIL_REDACTED]';
}

export function summarizeJavaScriptRuntimeErrorDetails(logcatText, processIds) {
  if (!Array.isArray(processIds) || processIds.some(value => !/^\d{1,10}$/.test(String(value))))
    fail('VK_ANDROID_RUNTIME_DIAGNOSTIC_PID_FILTER_INVALID');
  const allowedPids = new Set(processIds.map(String));
  const lines = String(logcatText ?? '').split(/\r?\n/);
  const targetLines = lines
    .map((line, index) => ({index, entry: parseLogcatLine(line)}))
    .filter(({entry}) => entry?.tag === 'ReactNativeJS' && allowedPids.has(entry.pid));
  const errors = [];
  const seen = new Set();
  for (let targetIndex = 0; targetIndex < targetLines.length; targetIndex += 1) {
    const {entry} = targetLines[targetIndex];
    const message = entry.message;
    if (!/(?:error|exception|fatal|invariant violation)/i.test(message)) continue;
    const kind = /TER_DEBUG_FAILURE_INJECTION/.test(message)
      ? 'INJECTED_FAILURE'
      : /(?:Unable to load script|No bundle URL present)/i.test(message)
        ? 'BUNDLE_UNAVAILABLE'
        : /(?:Cannot find module|Unable to resolve module)/i.test(message)
          ? 'MODULE_RESOLUTION_FAILURE'
          : /TurboModuleRegistry|Native module .* not found/i.test(message)
            ? 'NATIVE_MODULE_FAILURE'
            : /Invariant Violation/i.test(message)
              ? 'RN_INVARIANT_VIOLATION'
              : /\bTypeError\b/i.test(message)
                ? 'JS_TYPE_ERROR'
                : /\bReferenceError\b/i.test(message)
                  ? 'JS_REFERENCE_ERROR'
                  : /\bSyntaxError\b/i.test(message)
                    ? 'JS_SYNTAX_ERROR'
                    : 'JS_ERROR';
    const nameMatch = message.match(/\b(Invariant Violation|Error|[A-Za-z_$][\w$]*(?:Error|Exception))\s*:/i);
    const errorName = nameMatch ? (nameMatch[1] === 'Invariant Violation' ? 'InvariantViolation' : nameMatch[1]) : null;
    const safeCode = message.match(/\b(TER_[A-Z0-9_]{2,80})\b/)?.[1] ?? null;
    const bundleFrames = [];
    for (let frameIndex = targetIndex; frameIndex < Math.min(targetLines.length, targetIndex + 26); frameIndex += 1) {
      const frameEntry = targetLines[frameIndex].entry;
      if (
        frameIndex > targetIndex &&
        /(?:^|\b)(?:Error|[A-Za-z_$][\w$]*(?:Error|Exception))\s*:/i.test(frameEntry.message)
      )
        break;
      for (const match of frameEntry.message.matchAll(/\bindex\.android\.bundle:(\d{1,8}):(\d{1,8})\b/g)) {
        const frame = {line: Number(match[1]), column: Number(match[2])};
        if (!bundleFrames.some(item => item.line === frame.line && item.column === frame.column)) {
          bundleFrames.push(frame);
          if (bundleFrames.length === 12) break;
        }
      }
      if (bundleFrames.length === 12) break;
    }
    const record = {
      kind,
      errorName,
      safeCode,
      safeMessage: safeJavaScriptErrorMessage(message),
      bundleFrames,
    };
    const key = JSON.stringify(record);
    if (!seen.has(key)) {
      seen.add(key);
      errors.push(record);
      if (errors.length > 20) fail('VK_ANDROID_RUNTIME_DIAGNOSTIC_EVENT_LIMIT');
    }
  }
  return {errors};
}

export function summarizeDebugFailureInjectionLogcat(logcatText, processIds, expectedOwnerId) {
  if (
    !Array.isArray(processIds) ||
    processIds.length === 0 ||
    processIds.some(value => !/^\d{1,10}$/.test(String(value))) ||
    !/^[A-Za-z0-9:._-]{1,160}$/.test(expectedOwnerId ?? '')
  ) {
    fail('VK_ANDROID_DEBUG_FAILURE_LOG_FILTER_INVALID');
  }
  const allowedPids = new Set(processIds.map(String));
  const observations = [];
  for (const line of String(logcatText ?? '').split(/\r?\n/)) {
    const parsed = parseLogcatLine(line);
    if (!parsed || parsed.tag !== 'ReactNativeJS' || !allowedPids.has(parsed.pid)) continue;
    const match = parsed.message.match(
      /TER_DEBUG_FAILURE_INJECTION_RESOLUTION source=(initial|event) owner=([A-Za-z0-9:._-]{1,160}) outcome=(no-url|unrecognized|clear|matched|other-owner)(?=$|["},\s])/,
    );
    const failedRead = parsed.message.match(
      /TER_DEBUG_FAILURE_INJECTION_READ_FAILED source=initial owner=([A-Za-z0-9:._-]{1,160})(?=$|["},\s])/,
    );
    if (match) {
      observations.push({source: match[1], ownerId: match[2], outcome: match[3]});
    } else if (failedRead) {
      observations.push({source: 'initial', ownerId: failedRead[1], outcome: 'read-failed'});
    }
    if (observations.length > 100) fail('VK_ANDROID_DEBUG_FAILURE_LOG_RECORD_LIMIT');
  }
  const targetObservations = observations.filter(value => value.ownerId === expectedOwnerId);
  return {
    signalCount: observations.length,
    targetOwnerSignalCount: targetObservations.length,
    targetOwnerOutcomes: targetObservations.map(value => value.outcome),
    observedOwners: [...new Set(observations.map(value => value.ownerId))],
  };
}

export function resolveResolvedDebugFailureInjectionLog(manifest, intentId) {
  if (!/^[A-Za-z0-9._-]{1,96}$/.test(intentId ?? '')) fail('VK_ANDROID_LAUNCH_INTENT_ID_INVALID');
  const matches = (manifest.resolvedRemoteLaunches ?? []).filter(item => item.intentId === intentId);
  if (matches.length !== 1) fail('VK_ANDROID_RESOLVED_LAUNCH_COUNT_INVALID');
  const intent = matches[0];
  const app = APPS[intent.appName];
  const binding = manifest.appBindings?.[intent.appName];
  const device = manifest.devices?.[intent.shape];
  const diagnostics = (manifest.launchDiagnostics ?? []).filter(
    item =>
      item.intentId === intentId &&
      item.shape === intent.shape &&
      item.appName === intent.appName &&
      item.packageName === intent.packageName &&
      item.host === intent.host &&
      item.bootId === intent.bootId &&
      /^\d{1,10}$/.test(String(item.startupPid ?? '')),
  );
  const startupPids = [...new Set(diagnostics.map(item => String(item.startupPid)))];
  if (
    !app ||
    intent.packageName !== app.packageName ||
    !['dual', 'mobile'].includes(intent.shape) ||
    !(
      (intent.resolution === 'PROCESS_ADOPTED' &&
        Number.isSafeInteger(intent.processCount) &&
        intent.processCount > 0) ||
      (intent.resolution === 'PROCESS_ABSENT' && intent.processCount === 0)
    ) ||
    !device ||
    device.serial !== intent.host ||
    device.inventory?.bootId !== intent.bootId ||
    binding?.buildType !== 'debug' ||
    binding.apkPath !== appBuildArtifact(intent.appName, 'debug').apkPath ||
    !/^[a-f0-9]{64}$/i.test(binding.sha256 ?? '') ||
    !Number.isFinite(Date.parse(intent.startedAt ?? '')) ||
    !Number.isFinite(Date.parse(intent.resolvedAt ?? '')) ||
    Date.parse(intent.resolvedAt) < Date.parse(intent.startedAt) ||
    startupPids.length !== 1
  ) {
    fail('VK_ANDROID_RESOLVED_DEBUG_FAILURE_LAUNCH_IDENTITY_INVALID');
  }
  return {intent, startupPid: startupPids[0], apkSha256: binding.sha256};
}

export async function collectResolvedDebugFailureInjectionLogEvidence(
  manifest,
  intentId,
  expectedOwnerId,
  readAdbText = adbText,
) {
  const resolved = resolveResolvedDebugFailureInjectionLog(manifest, intentId);
  if (!/^[A-Za-z0-9:._-]{1,160}$/.test(expectedOwnerId ?? '')) fail('VK_ANDROID_DEBUG_FAILURE_LOG_FILTER_INVALID');
  const {intent, startupPid, apkSha256} = resolved;
  const device = deviceFor(manifest, intent.shape);
  const readBootId = async stage =>
    (
      await readAdbText(
        manifest,
        device,
        `${intent.shape}-${intent.appName}-resolved-debug-injection-${stage}-boot-id`,
        ['shell', 'cat', '/proc/sys/kernel/random/boot_id'],
        {diagnosticOutput: 'omit', preserveLastKnownGood: true},
      )
    ).trim();
  if ((await readBootId('pre')) !== intent.bootId) fail('VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH');
  const logcat = await readAdbText(
    manifest,
    device,
    `${intent.shape}-${intent.appName}-resolved-debug-injection-logcat`,
    ['shell', 'logcat', '-d', '-t', '2000', '-v', 'brief', '-s', 'TER-VK-LAUNCH:I', 'ReactNativeJS:V'],
    {maxBytes: 4 * 1024 * 1024, diagnosticOutput: 'omit', preserveLastKnownGood: true},
  );
  if ((await readBootId('post')) !== intent.bootId) fail('VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH');
  const launchScopedLines = launchAttemptLogLines(logcat, intentId).filter(line => {
    const entry = parseLogcatLine(line);
    return entry?.tag === 'ReactNativeJS' && entry.pid === startupPid;
  });
  const scopedLogcat = launchScopedLines.join('\n');
  const summary = summarizeDebugFailureInjectionLogcat(scopedLogcat, [startupPid], expectedOwnerId);
  return {
    intentId,
    host: intent.host,
    bootId: intent.bootId,
    apkSha256,
    startupPid,
    ownerId: expectedOwnerId,
    javascriptErrors: summarizeJavaScriptRuntimeErrors(scopedLogcat, [startupPid]),
    javascriptErrorDetails: summarizeJavaScriptRuntimeErrorDetails(scopedLogcat, [startupPid]),
    ...summary,
  };
}

async function inspectDebugFailureInjection(manifest, shape, appName, ownerId) {
  const app = APPS[appName];
  const binding = manifest.appBindings[appName];
  if (!app || binding?.buildType !== 'debug') fail('VK_ANDROID_DEBUG_FAILURE_REQUIRES_DEBUG_APK');
  const owned = requireOwnedApp(manifest, shape, appName);
  const device = deviceFor(manifest, shape);
  const observed = await remoteProcessIdentity(manifest, device, app.packageName);
  if (
    !remoteProcessIdentityMatches(owned, observed, device.serial) ||
    observed.bootId !== device.inventory?.bootId ||
    observed.processes.length === 0
  ) {
    fail('VK_ANDROID_DEBUG_FAILURE_PROCESS_IDENTITY_MISMATCH');
  }
  const logcat = await adbText(
    manifest,
    device,
    `${shape}-${appName}-debug-injection-logcat`,
    ['shell', 'logcat', '-d', '-t', '2000', '-v', 'brief', '-s', 'ReactNativeJS:V'],
    {maxBytes: 4 * 1024 * 1024, diagnosticOutput: 'omit'},
  );
  const summary = summarizeDebugFailureInjectionLogcat(
    logcat,
    observed.processes.map(value => String(value.pid)),
    ownerId,
  );
  const observation = {
    shape,
    appName,
    packageName: app.packageName,
    host: device.serial,
    bootId: device.inventory.bootId,
    apkSha256: binding.sha256,
    ownerId,
    observedAt: now(),
    ...summary,
  };
  manifest.debugFailureInjectionObservations ??= [];
  manifest.debugFailureInjectionObservations.push(observation);
  appendEvent(manifest, 'DEBUG_FAILURE_INJECTION_LOGS_INSPECTED', {
    shape,
    appName,
    ownerId,
    signalCount: summary.signalCount,
    targetOwnerSignalCount: summary.targetOwnerSignalCount,
    targetOwnerOutcomes: summary.targetOwnerOutcomes,
  });
  saveManifest(manifest);
  process.stdout.write(`DEBUG_FAILURE_INJECTION=${JSON.stringify(observation)}\n`);
}

function launchAttemptLogLines(logcatText, intentId) {
  if (!/^[A-Za-z0-9._-]{1,96}$/.test(intentId ?? '')) fail('VK_ANDROID_LAUNCH_INTENT_ID_INVALID');
  const lines = String(logcatText ?? '').split(/\r?\n/);
  const parsed = lines.map(parseLogcatLine);
  const sentinelIndexes = parsed.flatMap((entry, index) => {
    const match = entry?.tag === 'TER-VK-LAUNCH' ? entry.message.match(/^intent=([A-Za-z0-9._-]+)\s*$/) : null;
    return match?.[1] === intentId ? [index] : [];
  });
  if (sentinelIndexes.length > 1) fail('VK_ANDROID_LAUNCH_SENTINEL_DUPLICATE');
  const sentinelIndex = sentinelIndexes[0];
  if (sentinelIndex === undefined) return [];
  const nextSentinelIndex = parsed.findIndex((entry, index) => index > sentinelIndex && entry?.tag === 'TER-VK-LAUNCH');
  return lines.slice(sentinelIndex + 1, nextSentinelIndex < 0 ? lines.length : nextSentinelIndex);
}

export function summarizePersistKvW10(logcatText, intentId, appProcessIds) {
  if (
    !Array.isArray(appProcessIds) ||
    appProcessIds.length === 0 ||
    appProcessIds.some(value => !/^\d{1,10}$/.test(String(value)))
  ) {
    fail('VK_ANDROID_A11_W10_APP_PROCESS_FILTER_INVALID');
  }
  const allowedPids = new Set(appProcessIds.map(String));
  const lines = launchAttemptLogLines(logcatText, intentId);
  const parsed = lines.map(parseLogcatLine).map(entry => (entry && allowedPids.has(entry.pid) ? entry : null));
  const mismatchObserved = parsed.some(
    entry => entry?.tag === 'TerminalPersistKv' && entry.message.includes('PERSIST_KV_PROTECTED_KEY_MISMATCH'),
  );
  const namespace = parsed.flatMap((entry, index) => {
    if (entry?.tag !== 'TerminalPersistKv') return [];
    const match = entry.message.match(
      /event=persist-kv operation=(read|readMany|write|writeMany|listKeys|clear) mode=protected namespaceVersion=(\d+) existedBeforeOpen=(true|false)(?: legacyNamespacePresent=(true|false))?/,
    );
    return match
      ? [
          {
            index,
            operation: match[1],
            version: Number(match[2]),
            existed: match[3] === 'true',
            legacyPresent: match[4] === 'true',
          },
        ]
      : [];
  });
  const firstV2 = namespace.find(item => item.version === 2);
  const operationSuccessIndex = parsed.findIndex(
    (entry, index) =>
      index > (firstV2?.index ?? Number.MAX_SAFE_INTEGER) &&
      entry?.tag === 'TerminalPersistKv' &&
      entry.message === `event=persist-kv operation=${firstV2?.operation} mode=protected status=succeeded`,
  );
  const status = !lines.length
    ? 'LAUNCH_INTENT_NOT_FOUND'
    : mismatchObserved
      ? 'PROTECTED_KEY_MISMATCH'
      : !firstV2
        ? 'NEW_NAMESPACE_OBSERVATION_MISSING'
        : firstV2.existed
          ? 'NEW_NAMESPACE_PREEXISTED'
          : !firstV2.legacyPresent
            ? 'LEGACY_NAMESPACE_NOT_PRESENT'
            : operationSuccessIndex < 0
              ? 'PROTECTED_OPERATION_NOT_SUCCEEDED'
              : 'PASS';
  return {
    status,
    intentObserved: lines.length > 0,
    namespaceVersion: firstV2?.version ?? null,
    newNamespaceExistedBeforeOpen: firstV2?.existed ?? null,
    legacyNamespacePresent: firstV2 ? firstV2.legacyPresent : null,
    operationSucceededAfterOpen: operationSuccessIndex >= 0,
    keyMismatchObserved: mismatchObserved,
  };
}

export function summarizeAndroidLaunchDiagnostics(
  logcatText,
  packageName,
  launchPid = null,
  intentId = null,
  startupAtEpochMs = null,
) {
  if (!Object.values(APPS).some(app => app.packageName === packageName)) fail('VK_ANDROID_APP_INVALID');
  const lines =
    intentId === null ? String(logcatText ?? '').split(/\r?\n/) : launchAttemptLogLines(logcatText, intentId);
  const exactLaunchPid = typeof launchPid === 'string' && /^\d+$/.test(launchPid) ? launchPid : null;
  const targetPids = exactLaunchPid === null ? new Set() : new Set([exactLaunchPid]);
  const escapedPackage = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const packageToken = new RegExp(`(?:^|[^A-Za-z0-9_.$])${escapedPackage}(?=$|[^A-Za-z0-9_.$])`);
  const nativeFatalSignals = new Set();
  const nativeLogTags = new Set(['DEBUG', 'libc', 'crash_dump32', 'crash_dump64', 'tombstoned']);
  let nativeBlock = [];
  const isAtOrAfterStartup = entry =>
    startupAtEpochMs === null || (Number.isSafeInteger(entry?.timestampMs) && entry.timestampMs >= startupAtEpochMs);
  const collectNativeSignal = block => {
    if (block.length === 0) return;
    const body = block.map(item => item.line).join('\n');
    if (!packageToken.test(body)) return;
    const pids = [...body.matchAll(/\bpid\s*[=:]?\s*(\d+)\b/gi)].map(match => match[1]);
    if (!pids.some(pid => targetPids.has(pid))) return;
    for (const item of block) {
      if (!isAtOrAfterStartup(item.entry)) continue;
      for (const match of item.line.matchAll(/\bsignal\s+\d+\s+\((SIG[A-Z0-9]+)\)/gi)) {
        const signal = match[1].toUpperCase();
        if (NATIVE_FATAL_SIGNAL_ALLOWLIST.has(signal)) nativeFatalSignals.add(signal);
      }
    }
  };
  for (const line of lines) {
    const entry = parseLogcatLine(line);
    const tag = entry?.tag;
    if (tag && nativeLogTags.has(tag)) {
      const startsNewDump =
        /\*\*\*\s+\*\*\*/.test(line) ||
        (/\bCmdline:/i.test(line) && nativeBlock.some(value => /\bCmdline:/i.test(value.line)));
      if (startsNewDump) {
        collectNativeSignal(nativeBlock);
        nativeBlock = [];
      }
      nativeBlock.push({line, entry});
    } else {
      collectNativeSignal(nativeBlock);
      nativeBlock = [];
    }
  }
  collectNativeSignal(nativeBlock);
  const exceptionTypes = new Set();
  const appFrames = new Map();
  let fatalException = false;
  let processDied = false;
  let jsErrorSeen = false;
  for (const line of lines) {
    const entry = parseLogcatLine(line);
    if (!entry || !isAtOrAfterStartup(entry)) continue;
    const reportedPid =
      line
        .match(/\bPID:\s*(\d+)\b|\bpid\s*[=:]?\s*(\d+)\b/i)
        ?.slice(1)
        .find(Boolean) ?? line.match(new RegExp(`\\b(\\d+):${escapedPackage}(?=/|\\b)`))?.[1];
    if (
      packageToken.test(line) &&
      reportedPid &&
      targetPids.has(reportedPid) &&
      /(?:has died|died|exited|crash|fatal signal)/i.test(line)
    )
      processDied = true;
    if (!targetPids.has(entry.pid)) continue;
    if (/FATAL EXCEPTION/i.test(line)) fatalException = true;
    if (/\/ReactNativeJS\(/.test(line) && /(?:error|exception|fatal)/i.test(line)) jsErrorSeen = true;
    const exceptionType = line.match(
      /(?:Caused by:\s*)?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:Exception|Error))(?::|\s|$)/,
    )?.[1];
    if (exceptionType) exceptionTypes.add(exceptionType);
    const frame = line.match(
      new RegExp(`\\bat (${escapedPackage}\\.[\\w$]+(?:\\.[\\w$]+)*)\\.[\\w$]+\\(([A-Za-z0-9_.$-]+:\\d+)\\)`),
    );
    if (frame) appFrames.set(`${frame[1]}|${frame[2]}`, {className: frame[1], location: frame[2]});
  }
  return {
    fatalException,
    processDied,
    nativeFatalSignals: [...nativeFatalSignals].sort(),
    exceptionTypes: [...exceptionTypes].sort(),
    appFrames: [...appFrames.values()].slice(0, 8),
    jsErrorSeen,
  };
}

export function summarizeAppLaunchBreadcrumbs(logcatText, appName, intentId) {
  if (!APPS[appName]) fail('VK_ANDROID_APP_INVALID');
  const escapedAppName = appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const appToken = new RegExp(`(?:^|\\s)app=${escapedAppName}(?=\\s|$)`);
  const correlatedLines = launchAttemptLogLines(logcatText, intentId);
  const observed = new Set();
  const overlayOutcomes = new Set();
  let startupPid = null;
  let startupAtEpochMs = null;
  let startupPidAmbiguous = false;
  let startupCount = 0;
  for (const line of correlatedLines) {
    const entry = parseLogcatLine(line);
    if (!entry || entry.tag !== 'TER-Splash') continue;
    const isStartup = appToken.test(entry.message) && entry.message.includes('event=activity.onCreate phase=start');
    if (isStartup) {
      startupCount += 1;
      if (startupCount === 1) {
        startupPid = entry.pid;
        startupAtEpochMs = entry.timestampMs;
      } else {
        startupPid = null;
        startupAtEpochMs = null;
        startupPidAmbiguous = true;
        observed.clear();
        overlayOutcomes.clear();
      }
    }
    if (startupPidAmbiguous || entry.pid !== startupPid) continue;

    if (appToken.test(entry.message)) {
      for (const breadcrumb of APP_LAUNCH_BREADCRUMBS.slice(0, 9)) {
        if (entry.message.includes(breadcrumb.wire)) observed.add(breadcrumb.summary);
      }
    }
    if (/\bevent=native\.loading-overlay-attached(?:\s|$)/.test(entry.message)) {
      observed.add('native.loading-overlay-attached');
      overlayOutcomes.add('ATTACHED');
    }
    const skipped = entry.message.match(
      /\bevent=native\.loading-overlay-skipped reason=(gate-unavailable|config-unavailable|content-unavailable)(?=\s|$)/,
    );
    if (skipped) {
      observed.add(`native.loading-overlay-skipped:${skipped[1]}`);
      overlayOutcomes.add(`SKIPPED_${skipped[1].replaceAll('-', '_').toUpperCase()}`);
    }
  }
  const observedMarkers = APP_LAUNCH_BREADCRUMBS.map(item => item.summary).filter(marker => observed.has(marker));
  const summary = {observedMarkers, markerCount: observedMarkers.length, startupPid};
  if (startupPidAmbiguous) summary.startupPidStatus = 'AMBIGUOUS';
  if (startupAtEpochMs !== null) summary.startupAtEpochMs = startupAtEpochMs;
  if (overlayOutcomes.size > 0)
    summary.overlayOutcome = overlayOutcomes.size === 1 ? [...overlayOutcomes][0] : 'AMBIGUOUS';
  return summary;
}

export function summarizeResolvedLaunchLogEvidence(intent, epochLogcat, briefLogcat) {
  const app = APPS[intent?.appName];
  if (
    !app ||
    intent.packageName !== app.packageName ||
    !['dual', 'mobile'].includes(intent.shape) ||
    !SERIAL_RE.test(intent.host ?? '') ||
    !/^[A-Za-z0-9-]{8,96}$/.test(intent.bootId ?? '') ||
    !/^[A-Za-z0-9._-]{1,96}$/.test(intent.intentId ?? '')
  )
    fail('VK_ANDROID_MANIFEST_APP_BINDING_INVALID');
  const epoch = summarizeAppLaunchBreadcrumbs(epochLogcat, intent.appName, intent.intentId);
  const brief = summarizeAppLaunchBreadcrumbs(briefLogcat, intent.appName, intent.intentId);
  let evidenceStatus = 'INSUFFICIENT_EVIDENCE';
  if (epoch.startupPidStatus === 'AMBIGUOUS' || brief.startupPidStatus === 'AMBIGUOUS') {
    evidenceStatus = 'AMBIGUOUS_STARTUP_PID';
  } else if (epoch.startupPid && brief.startupPid && epoch.startupPid !== brief.startupPid) {
    evidenceStatus = 'PID_MISMATCH';
  } else if (
    epoch.startupPid &&
    brief.startupPid &&
    epoch.startupPid === brief.startupPid &&
    Number.isSafeInteger(epoch.startupAtEpochMs)
  ) {
    evidenceStatus = 'MATCHED';
  }
  const identityMatched = evidenceStatus === 'MATCHED';
  const markerSet = new Set(identityMatched ? [...epoch.observedMarkers, ...brief.observedMarkers] : []);
  const observedMarkers = APP_LAUNCH_BREADCRUMBS.map(item => item.summary).filter(marker => markerSet.has(marker));
  const outcomes = new Set(identityMatched ? [epoch.overlayOutcome, brief.overlayOutcome].filter(Boolean) : []);
  const overlayOutcome = outcomes.size > 1 ? 'AMBIGUOUS' : outcomes.size === 1 ? [...outcomes][0] : 'NOT_OBSERVED';
  const startupPid = identityMatched ? epoch.startupPid : null;
  return {
    evidenceStatus,
    startupPid,
    startupAtEpochMs: identityMatched ? epoch.startupAtEpochMs : null,
    overlayOutcome,
    observedMarkers,
    markerCount: observedMarkers.length,
    signals: summarizeAndroidLaunchDiagnostics(
      epochLogcat,
      intent.packageName,
      startupPid,
      intent.intentId,
      epoch.startupAtEpochMs,
    ),
  };
}

export function resolvePendingRemoteLaunch(manifest, intentId, observed, resolvedAt = now()) {
  const index = manifest.pendingRemoteLaunches?.findIndex(value => value.intentId === intentId) ?? -1;
  const intent = index < 0 ? null : manifest.pendingRemoteLaunches[index];
  if (
    !intent ||
    !Array.isArray(manifest.ownedRemoteProcesses) ||
    observed?.host !== intent.host ||
    observed?.bootId !== intent.bootId ||
    !Array.isArray(observed.processes)
  )
    fail('VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH');
  const seen = new Set();
  const seenPids = new Set();
  for (const process of observed.processes) {
    if (!process || typeof process !== 'object') fail('VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH');
    const identity = `${process.pid}:${process.startTicks}`;
    if (
      !Number.isSafeInteger(process.pid) ||
      process.pid <= 0 ||
      !/^\d+$/.test(process.startTicks ?? '') ||
      seen.has(identity) ||
      seenPids.has(process.pid)
    ) {
      fail('VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH');
    }
    seen.add(identity);
    seenPids.add(process.pid);
  }
  const resolution = observed.processes.length > 0 ? 'PROCESS_ADOPTED' : 'PROCESS_ABSENT';
  if (resolution === 'PROCESS_ADOPTED') {
    manifest.ownedRemoteProcesses.push({
      host: intent.host,
      bootId: intent.bootId,
      processes: observed.processes,
      packageName: intent.packageName,
      appName: intent.appName,
      shape: intent.shape,
    });
  }
  manifest.resolvedRemoteLaunches ??= [];
  manifest.resolvedRemoteLaunches.push({
    ...intent,
    resolvedAt,
    resolution,
    processCount: observed.processes.length,
  });
  manifest.pendingRemoteLaunches.splice(index, 1);
  return resolution;
}

export function resolveInvalidatedRemoteLaunch(manifest, intentId, observed, recoveredAt = now()) {
  const matches = (manifest.resolvedRemoteLaunches ?? []).filter(value => value.intentId === intentId);
  const intent = matches.length === 1 ? matches[0] : null;
  const device = intent && manifest.devices?.[intent.shape];
  const launchEvidence = (manifest.launchDiagnostics ?? []).filter(
    value =>
      value.intentId === intentId &&
      value.shape === intent.shape &&
      value.appName === intent.appName &&
      (value.packageName == null || value.packageName === intent.packageName) &&
      value.host === intent.host &&
      value.bootId === intent.bootId &&
      validLaunchBreadcrumbRecord(value.observedMarkers, value.markerCount) &&
      value.observedMarkers.length > 0,
  );
  const app = intent && APPS[intent.appName];
  if (
    !intent ||
    intent.resolution !== 'PROCESS_ABSENT' ||
    intent.processCount !== 0 ||
    !app ||
    intent.packageName !== app.packageName ||
    !device ||
    device.serial !== intent.host ||
    device.inventory?.bootId !== intent.bootId ||
    launchEvidence.length === 0 ||
    observed?.host !== intent.host ||
    observed?.bootId !== intent.bootId ||
    !Array.isArray(observed.processes)
  ) {
    fail('VK_ANDROID_HISTORICAL_LAUNCH_IDENTITY_MISMATCH');
  }

  const seenPids = new Set();
  for (const process of observed.processes) {
    if (
      !process ||
      !Number.isSafeInteger(process.pid) ||
      process.pid <= 0 ||
      !/^\d+$/.test(process.startTicks ?? '') ||
      seenPids.has(process.pid)
    )
      fail('VK_ANDROID_HISTORICAL_LAUNCH_IDENTITY_MISMATCH');
    seenPids.add(process.pid);
  }
  const startupPids = new Set(
    launchEvidence
      .map(value => value.startupPid)
      .filter(value => value != null)
      .map(String),
  );
  if ([...startupPids].some(pid => !observed.processes.some(value => String(value.pid) === pid))) {
    fail('VK_ANDROID_HISTORICAL_LAUNCH_IDENTITY_MISMATCH');
  }
  const tablePids = new Set(
    (manifest.launchLogInspections ?? [])
      .filter(
        value =>
          value.intentId === intentId &&
          value.shape === intent.shape &&
          value.host === intent.host &&
          value.bootId === intent.bootId &&
          value.packageName === intent.packageName,
      )
      .flatMap(value => value.processTableCandidates ?? [])
      .map(value => String(value.pid)),
  );
  if (tablePids.size > 0 && !observed.processes.some(value => tablePids.has(String(value.pid)))) {
    fail('VK_ANDROID_HISTORICAL_LAUNCH_IDENTITY_MISMATCH');
  }

  const resolution = observed.processes.length > 0 ? 'PROCESS_ADOPTED' : 'PROCESS_ABSENT';
  if (resolution === 'PROCESS_ADOPTED') {
    const existing = manifest.ownedRemoteProcesses.find(
      value => value.shape === intent.shape && value.host === intent.host && value.packageName === intent.packageName,
    );
    const nextIdentity = {
      host: intent.host,
      bootId: intent.bootId,
      processes: observed.processes,
      packageName: intent.packageName,
      appName: intent.appName,
      shape: intent.shape,
    };
    if (existing) {
      if (!remoteProcessIdentityMatches(existing, nextIdentity, intent.host))
        fail('VK_ANDROID_HISTORICAL_LAUNCH_IDENTITY_MISMATCH');
    } else manifest.ownedRemoteProcesses.push(nextIdentity);
  }
  manifest.historicalRemoteLaunchRecoveries ??= [];
  if (manifest.historicalRemoteLaunchRecoveries.some(value => value.intentId === intentId)) {
    fail('VK_ANDROID_HISTORICAL_RECOVERY_DUPLICATE');
  }
  manifest.historicalRemoteLaunchRecoveries.push({
    intentId,
    shape: intent.shape,
    appName: intent.appName,
    packageName: intent.packageName,
    host: intent.host,
    bootId: intent.bootId,
    recoveredAt,
    resolution,
    processes: observed.processes.map(value => ({pid: value.pid, startTicks: value.startTicks})),
  });
  return resolution;
}

export function commandDiagnosticRecord({
  phase,
  label,
  executable,
  args,
  durationMs,
  exitCode,
  signal,
  stdout,
  stderr,
  outputPolicy = 'sanitized',
  acceptedExitCodes = [0],
  resultAccepted = true,
}) {
  if (!['sanitized', 'omit'].includes(outputPolicy)) fail('VK_ANDROID_COMMAND_OUTPUT_POLICY_INVALID');
  if (
    !Array.isArray(acceptedExitCodes) ||
    acceptedExitCodes.length === 0 ||
    acceptedExitCodes.some(code => !Number.isInteger(code) || code < 0 || code > 255) ||
    new Set(acceptedExitCodes).size !== acceptedExitCodes.length
  )
    fail('VK_ANDROID_EXPECTED_EXIT_CODES_INVALID');
  if (typeof resultAccepted !== 'boolean') fail('VK_ANDROID_COMMAND_RESULT_VALIDATION_INVALID');
  const render = value => redact(value).slice(0, 4096);
  const persisted = value => (outputPolicy === 'omit' ? '[RAW_OUTPUT_OMITTED]' : render(value));
  return Object.freeze({
    at: now(),
    phase,
    label: safeLabel(label, 'VK_ANDROID_LOG_LABEL_INVALID'),
    executable: path.basename(executable),
    argumentCount: args.length,
    durationMs,
    exitCode,
    signal: signal ?? null,
    acceptedExitCodes: Object.freeze([...acceptedExitCodes]),
    stdoutBytes: Buffer.byteLength(stdout ?? ''),
    stderrBytes: Buffer.byteLength(stderr ?? ''),
    stdout: persisted(stdout),
    stderr: persisted(stderr),
    stdoutTruncated: Buffer.byteLength(stdout ?? '') > 4096,
    stderrTruncated: Buffer.byteLength(stderr ?? '') > 4096,
    result: acceptedExitCodes.includes(exitCode) && resultAccepted && !signal ? 'PASS' : 'FAIL',
  });
}

function commandDiagnosticLogContent({stdout, stderr, outputPolicy = 'sanitized'}) {
  if (!['sanitized', 'omit'].includes(outputPolicy)) fail('VK_ANDROID_COMMAND_OUTPUT_POLICY_INVALID');
  if (outputPolicy === 'omit') {
    return `[RAW_COMMAND_OUTPUT_OMITTED] stdoutBytes=${Buffer.byteLength(stdout ?? '')} stderrBytes=${Buffer.byteLength(stderr ?? '')}\n`;
  }
  return redact(`${stdout ?? ''}${stderr ?? ''}`);
}

export function writeCommandCaptureLog({runtimeLogPath, evidenceLogPath, stdout, stderr, outputPolicy = 'sanitized'}) {
  const content = commandDiagnosticLogContent({stdout, stderr, outputPolicy});
  fs.mkdirSync(path.dirname(runtimeLogPath), {recursive: true, mode: 0o700});
  fs.writeFileSync(runtimeLogPath, content, {mode: 0o600});
  if (evidenceLogPath && fs.existsSync(path.dirname(evidenceLogPath))) {
    fs.mkdirSync(path.dirname(evidenceLogPath), {recursive: true, mode: 0o700});
    fs.writeFileSync(evidenceLogPath, content, {mode: 0o600});
  }
}

export function commandDiagnosticOutputPolicy({binary, requestedPolicy = 'sanitized'} = {}) {
  if (binary) return 'omit';
  if (!['sanitized', 'omit'].includes(requestedPolicy)) fail('VK_ANDROID_COMMAND_OUTPUT_POLICY_INVALID');
  return requestedPolicy;
}
function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  const temp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  fs.renameSync(temp, file);
}
function manifestPath(runId) {
  return path.join(RUNTIME_ROOT, safeRunId(runId), 'run-manifest.json');
}
function readManifest(runId, {allowHistoricalApkPathsForCleanup = false} = {}) {
  const file = manifestPath(runId);
  if (!fs.existsSync(file)) fail('VK_ANDROID_RUN_NOT_PREPARED');
  const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (manifest.runId !== runId) fail('VK_ANDROID_MANIFEST_INVALID');
  validateRunManifest(manifest, {allowHistoricalApkPathsForCleanup});
  // Schema 2 manifests created before managed DEV reverse routes existed remain
  // readable; the first tunnel action upgrades only this additive field.
  manifest.devTunnelMappings ??= [];
  return manifest;
}
function readRepositoryJson(file) {
  const canonicalRoot = fs.realpathSync(ROOT);
  const canonicalFile = fs.realpathSync(file);
  if (!canonicalFile.startsWith(`${canonicalRoot}${path.sep}`)) fail('VK_ANDROID_REPOSITORY_INPUT_ESCAPES_ROOT');
  return JSON.parse(fs.readFileSync(canonicalFile, 'utf8'));
}
function saveManifest(manifest) {
  manifest.updatedAt = now();
  writeJsonAtomic(manifestPath(manifest.runId), manifest);
  const evidenceManifest = path.join(EVIDENCE_ROOT, manifest.runId, 'run-manifest.json');
  if (fs.existsSync(path.dirname(evidenceManifest))) writeJsonAtomic(evidenceManifest, manifest);
}
function appendEvent(manifest, event, details = {}) {
  const logPath = path.join(RUNTIME_ROOT, manifest.runId, 'events.jsonl');
  const evidenceLogPath = path.join(EVIDENCE_ROOT, manifest.runId, 'events.jsonl');
  fs.mkdirSync(path.dirname(logPath), {recursive: true, mode: 0o700});
  const line = `${JSON.stringify({at: now(), phase: manifest.phase, event, ...details})}\n`;
  fs.appendFileSync(logPath, line, {mode: 0o600});
  if (fs.existsSync(path.dirname(evidenceLogPath))) fs.appendFileSync(evidenceLogPath, line, {mode: 0o600});
  manifest.logPath = path.relative(ROOT, evidenceLogPath);
}

function appendCommandLog(manifest, record) {
  const logPath = path.join(RUNTIME_ROOT, manifest.runId, 'logs', 'commands.jsonl');
  const evidencePath = path.join(EVIDENCE_ROOT, manifest.runId, 'logs', 'commands.jsonl');
  appendCommandLogRecord({
    runtimeLogPath: logPath,
    evidenceLogPath: evidencePath,
    evidenceRunDirectory: path.dirname(path.dirname(evidencePath)),
    record,
  });
  return path.relative(ROOT, evidencePath);
}

export function appendCommandLogRecord({runtimeLogPath, evidenceLogPath, evidenceRunDirectory, record}) {
  const line = `${JSON.stringify(record)}\n`;
  fs.mkdirSync(path.dirname(runtimeLogPath), {recursive: true, mode: 0o700});
  fs.appendFileSync(runtimeLogPath, line, {mode: 0o600});
  if (fs.existsSync(evidenceRunDirectory)) {
    fs.mkdirSync(path.dirname(evidenceLogPath), {recursive: true, mode: 0o700});
    if (fs.existsSync(evidenceLogPath)) fs.appendFileSync(evidenceLogPath, line, {mode: 0o600});
    else {
      fs.copyFileSync(runtimeLogPath, evidenceLogPath);
      fs.chmodSync(evidenceLogPath, 0o600);
    }
  }
}

function resourcePreflight(manifest = null) {
  const checker = path.join(ROOT, 'scripts/env/check-runtime-resource-budget');
  const result = spawnSync(checker, terResourcePreflightArgs(ROOT), {cwd: ROOT, encoding: 'utf8'});
  if (manifest) {
    const target = path.join(RUNTIME_ROOT, manifest.runId, 'resource-preflight.json');
    const evidenceTarget = path.join(EVIDENCE_ROOT, manifest.runId, 'resource-preflight.json');
    const record = {
      at: now(),
      exitCode: result.status,
      stdout: redact(result.stdout),
      stderr: redact(result.stderr),
      result: result.status === 0 ? 'PASS' : 'FAIL',
    };
    writeJsonAtomic(target, record);
    if (fs.existsSync(path.dirname(evidenceTarget))) writeJsonAtomic(evidenceTarget, record);
    manifest.resourcePreflight = {
      at: now(),
      result: result.status === 0 ? 'PASS' : 'FAIL',
      evidence: path.relative(ROOT, evidenceTarget),
    };
    saveManifest(manifest);
  }
  if (result.status !== 0) fail('VK_ANDROID_RESOURCE_PREFLIGHT_FAILED');
}
function processIdentity(pid, pgid = null) {
  const row = readProcessTable().find(value => value.pid === pid && (pgid === null || value.pgid === pgid));
  return row ? {pid: row.pid, pgid: row.pgid, startToken: canonicalStartToken(row.startToken)} : null;
}
function ownedProcessRows(rootIdentity) {
  const rows = snapshotProcessTree(rootIdentity, readProcessTable());
  return rows.map(({pid, ppid, pgid, startToken, commandSha256, ownershipUnverified}) => ({
    pid,
    ppid,
    pgid,
    startToken,
    commandSha256,
    ...(ownershipUnverified ? {ownershipUnverified: true} : {}),
  }));
}
function pngDimensions(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24 || bytes.subarray(1, 4).toString() !== 'PNG')
    fail('VK_ANDROID_CAPTURE_INVALID_PNG');
  return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
}

function writeCaptureTextArtifact(filePath, text) {
  fs.writeFileSync(filePath, text, {encoding: 'utf8', mode: 0o600, flag: 'wx'});
  return path.relative(ROOT, filePath);
}
function deviceFor(manifest, shape) {
  const configured = SHAPES[shape];
  if (!configured) fail('VK_ANDROID_DEVICE_SHAPE_REQUIRED');
  return {...manifest.devices[shape], shape};
}
function logicalDisplayFor(manifest, shape, surface) {
  if (!['primary', 'secondary'].includes(surface)) fail('VK_ANDROID_SURFACE_INVALID');
  if (surface === 'secondary' && shape !== 'dual') fail('VK_ANDROID_SECONDARY_SURFACE_UNAVAILABLE');
  const device = deviceFor(manifest, shape);
  const pairing = validateDeviceShape({shape, logical: device.inventory.logical, surfaces: device.inventory.surfaces});
  return surface === 'primary' ? pairing.primary : pairing.secondary;
}
function adbArgs(device, args) {
  return ['-s', device.serial, ...args];
}

function requireOwnedApp(manifest, shape, appName = null) {
  const device = deviceFor(manifest, shape);
  const owned = manifest.ownedRemoteProcesses.find(
    value => value.host === device.serial && value.shape === shape && (!appName || value.appName === appName),
  );
  if (!owned) fail('VK_ANDROID_APP_OWNERSHIP_REQUIRED');
  return owned;
}

async function runManaged(manifest, label, command, args, options = {}) {
  safeLabel(label, 'VK_ANDROID_LOG_LABEL_INVALID');
  const acceptedExitCodes = options.acceptedExitCodes ?? [0];
  if (
    !Array.isArray(acceptedExitCodes) ||
    acceptedExitCodes.length === 0 ||
    acceptedExitCodes.some(code => !Number.isInteger(code) || code < 0 || code > 255) ||
    new Set(acceptedExitCodes).size !== acceptedExitCodes.length
  )
    fail('VK_ANDROID_EXPECTED_EXIT_CODES_INVALID');
  const timeoutMs = resolveManagedCommandTimeoutMs(options.timeoutMs);
  const maxBytes = resolveManagedCommandMaxBytes(options.maxBytes);
  const startedAt = Date.now();
  const child = spawn(command, args, {
    cwd: options.cwd ?? ROOT,
    env: options.env ?? process.env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let spawnError = null;
  child.once('error', error => {
    spawnError = error;
  });
  if (!child.pid) {
    await new Promise(resolve => child.once('close', resolve));
    fail(spawnError?.code ? `VK_ANDROID_PROCESS_START_FAILED:${spawnError.code}` : 'VK_ANDROID_PROCESS_START_FAILED');
  }
  let identity = null;
  for (let attempt = 0; attempt < 20 && !identity; attempt += 1) {
    identity = processIdentity(child.pid, child.pid);
    if (!identity) await sleep(10);
  }
  if (!identity) {
    child.kill('SIGTERM');
    fail('VK_ANDROID_PROCESS_IDENTITY_UNAVAILABLE');
  }
  const runnerIdentity = processIdentity(process.pid);
  if (!runnerIdentity) {
    child.kill('SIGTERM');
    fail('VK_ANDROID_RUNNER_PROCESS_IDENTITY_UNAVAILABLE');
  }
  let processRows = ownedProcessRows(identity);
  manifest.processes = [
    {...runnerIdentity, commandLabel: 'managed-runner'},
    {...identity, commandLabel: label},
    ...processRows.filter(row => row.pid !== identity.pid),
  ];
  manifest.activeProcessIdentity = {...identity, commandLabel: label};
  manifest.activeCommand = {label, executable: path.basename(command), argumentCount: args.length, startedAt};
  appendEvent(manifest, 'COMMAND_STARTED', {label, executable: path.basename(command), argumentCount: args.length});
  saveManifest(manifest);
  let stdout = Buffer.alloc(0);
  let stderr = Buffer.alloc(0);
  let stdoutTruncated = false;
  let stderrTruncated = false;
  child.stdout.on('data', chunk => {
    const remaining = Math.max(0, maxBytes - stdout.length);
    if (chunk.length > remaining) stdoutTruncated = true;
    if (remaining > 0) stdout = Buffer.concat([stdout, chunk.subarray(0, remaining)]);
  });
  child.stderr.on('data', chunk => {
    const remaining = Math.max(0, maxBytes - stderr.length);
    if (chunk.length > remaining) stderrTruncated = true;
    if (remaining > 0) stderr = Buffer.concat([stderr, chunk.subarray(0, remaining)]);
  });
  let limitFailure = null;
  let termination = null;
  const heartbeat = setInterval(() => {
    try {
      processRows = ownedProcessRows(identity);
      manifest.processes = [
        {...runnerIdentity, commandLabel: 'managed-runner'},
        ...processRows.filter(row => row.pid !== runnerIdentity.pid),
      ];
      manifest.heartbeatAt = now();
      manifest.resourceSample = manifest.processes.map(row => {
        const stat = spawnSync('ps', ['-o', 'rss=', '-p', String(row.pid)], {encoding: 'utf8'});
        return {pid: row.pid, rssKiB: Number(stat.stdout.trim()) || 0};
      });
      const totalRssKiB = manifest.resourceSample.reduce((sum, row) => sum + row.rssKiB, 0);
      manifest.managedRssMiB = Math.ceil(totalRssKiB / 1024);
      saveManifest(manifest);
      if (manifest.managedRssMiB > 2048) limitFailure = 'VK_ANDROID_MANAGED_RSS_LIMIT_EXCEEDED';
    } catch {
      limitFailure = 'VK_ANDROID_HEARTBEAT_FAILED';
    }
    if (limitFailure && termination === null) {
      termination = terminateOwnedProcessTree(identity, {waitMs: 15_000});
    }
  }, 1000);
  const timeout = setTimeout(() => {
        limitFailure = 'VK_ANDROID_COMMAND_TIMEOUT';
        if (termination === null) termination = terminateOwnedProcessTree(identity, {waitMs: 15_000});
      }, timeoutMs);
  const exit = await new Promise(resolve => child.once('close', (code, signal) => resolve({code, signal})));
  clearInterval(heartbeat);
  clearTimeout(timeout);
  if (termination) {
    const terminationResult = await termination;
    if (terminationResult.status !== 'PASS') limitFailure ??= 'VK_ANDROID_OWNED_PROCESS_TREE_CLEANUP_FAILED';
  }
  const stdoutText = stdout.toString('utf8');
  const stderrText = stderr.toString('utf8');
  const output = `${stdoutText}${stderrText}`;
  const finishedAt = Date.now();
  if (options.captureLog) {
    const logFile = path.join(
      RUNTIME_ROOT,
      manifest.runId,
      'logs',
      `${safeLabel(label, 'VK_ANDROID_LOG_LABEL_INVALID')}.log`,
    );
    const evidenceLogFile = path.join(
      EVIDENCE_ROOT,
      manifest.runId,
      'logs',
      `${safeLabel(label, 'VK_ANDROID_LOG_LABEL_INVALID')}.log`,
    );
    writeCommandCaptureLog({
      runtimeLogPath: logFile,
      evidenceLogPath: evidenceLogFile,
      stdout,
      stderr,
      outputPolicy: options.diagnosticOutput ?? 'sanitized',
    });
  }
  const currentRows = ownedProcessRows(identity);
  const exitedCleanly = currentRows.length === 0;
  const exitAccepted = acceptedExitCodes.includes(exit.code);
  const resultAccepted =
    typeof options.resultValidator === 'function'
      ? options.resultValidator({stdout: stdoutText, stderr: stderrText, exitCode: exit.code, signal: exit.signal})
      : true;
  const outputTruncated = stdoutTruncated || stderrTruncated;
  if (outputTruncated) limitFailure ??= 'VK_ANDROID_COMMAND_OUTPUT_TRUNCATED';
  const commandPassed = exitAccepted && resultAccepted && !limitFailure && exitedCleanly;
  manifest.processes = exitedCleanly ? [] : currentRows;
  manifest.activeProcessIdentity = exitedCleanly ? null : {...identity, commandLabel: label};
  manifest.activeCommand = null;
  const diagnosticPath = appendCommandLog(
    manifest,
    commandDiagnosticRecord({
      phase: manifest.phase,
      label,
      executable: command,
      args,
      durationMs: finishedAt - startedAt,
      exitCode: exit.code,
      signal: exit.signal,
      stdout,
      stderr,
      acceptedExitCodes,
      resultAccepted,
      outputPolicy: options.diagnosticOutput ?? 'sanitized',
    }),
  );
  manifest.commandResults ??= [];
  manifest.commandResults.push({
    label,
    executable: path.basename(command),
    argumentCount: args.length,
    exitCode: exit.code,
    acceptedExitCodes: [...acceptedExitCodes],
    signal: exit.signal,
    durationMs: finishedAt - startedAt,
      outputBytes: stdout.length + stderr.length,
      outputTruncated,
    ownedTreeReadbackCount: currentRows.length,
    result: commandPassed ? 'PASS' : 'FAIL',
    logPath: diagnosticPath,
    captureLogPath: options.captureLog
      ? path.relative(ROOT, path.join(EVIDENCE_ROOT, manifest.runId, 'logs', `${label}.log`))
      : null,
  });
  if (!exitedCleanly) recordFirstFailure(manifest, 'VK_ANDROID_CHILD_TREE_NOT_EMPTY', label);
  if (commandPassed) {
    recordLastKnownGood(manifest, label, {preserveCurrent: options.preserveLastKnownGood === true});
  } else {
    recordFirstFailure(manifest, limitFailure ?? 'VK_ANDROID_COMMAND_FAILED', label);
    manifest.status = 'FAIL';
    manifest.phase = 'COMMAND_FAILED';
  }
  appendEvent(manifest, 'COMMAND_FINISHED', {
    label,
    exitCode: exit.code,
    acceptedExitCodes: [...acceptedExitCodes],
    signal: exit.signal,
    durationMs: finishedAt - startedAt,
    outputBytes: stdout.length + stderr.length,
    outputTruncated,
    result: commandPassed ? 'PASS' : 'FAIL',
    failureCode: limitFailure ?? (commandPassed ? null : 'VK_ANDROID_COMMAND_FAILED'),
  });
  saveManifest(manifest);
  if (limitFailure) fail(limitFailure);
  if (!exitAccepted || !resultAccepted) fail('VK_ANDROID_COMMAND_FAILED');
  if (!exitedCleanly) fail('VK_ANDROID_CHILD_TREE_NOT_EMPTY');
  if (options.returnCommandResult === true) return {stdout: stdoutText, stderr: stderrText, exitCode: exit.code};
  return options.binary ? stdout : output;
}

function redact(value) {
  return String(value ?? '')
    .replace(/\/(?:Users|home)\/[^/\s]+/g, match => `${match.slice(0, match.lastIndexOf('/'))}/[REDACTED]`)
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_REDACTED]')
    .replace(
      /((?:password|passwd|token|cookie|authorization|otp|phone|mobile|username|login)\s*[:=]\s*)[^\s,;]+/gi,
      '$1[REDACTED]',
    )
    .replace(
      /((?:password|passwd|token|cookie|authorization|otp|phone|mobile|username|login)"\s*:\s*")[^"]*(")/gi,
      '$1[REDACTED]$2',
    );
}

async function command(manifest, label, executable, args, {device, binary = false, ...options} = {}) {
  const executablePath = executable === 'adb' ? 'adb' : executable;
  const finalArgs = device ? adbArgs(device, args) : args;
  if (executablePath === 'adb') validateAdbArgs(finalArgs);
  return runManaged(manifest, label, executablePath, finalArgs, {
    ...options,
    binary,
    diagnosticOutput: commandDiagnosticOutputPolicy({binary, requestedPolicy: options.diagnosticOutput}),
  });
}

async function adbText(manifest, device, label, args, options = {}) {
  return command(manifest, label, 'adb', args, {device, ...options});
}

function managedDevManifestFile(value = '.runtime/r5/run-manifest.json') {
  if (value !== '.runtime/r5/run-manifest.json') fail('VK_ANDROID_DEV_MANIFEST_PATH_INVALID');
  const file = path.resolve(ROOT, value);
  if (!file.startsWith(`${path.join(ROOT, '.runtime/r5')}${path.sep}`) || !fs.existsSync(file))
    fail('VK_ANDROID_DEV_MANIFEST_MISSING');
  const canonicalRoot = fs.realpathSync(ROOT);
  const canonicalFile = fs.realpathSync(file);
  if (!canonicalFile.startsWith(`${canonicalRoot}${path.sep}`)) fail('VK_ANDROID_REPOSITORY_INPUT_ESCAPES_ROOT');
  return canonicalFile;
}

async function setupDevTunnelMappings(manifest, shape, appName, devManifestArgument) {
  if (!['dual', 'mobile'].includes(shape) || !APPS[appName]) fail('VK_ANDROID_DEV_TUNNEL_ARGUMENT_INVALID');
  if (!manifest.appBindings[appName]) fail('VK_ANDROID_DEV_TUNNEL_APP_NOT_BUILT');
  const device = deviceFor(manifest, shape);
  const bootId = (await adbText(manifest, device, `${shape}-dev-tunnel-boot-id`, [
    'shell',
    'cat',
    '/proc/sys/kernel/random/boot_id',
  ])).trim();
  if (!bootId || bootId !== device.inventory?.bootId) fail('VK_ANDROID_DEV_TUNNEL_DEVICE_IDENTITY_CHANGED');
  const devManifest = readRepositoryJson(managedDevManifestFile(devManifestArgument));
  const packageConfig = readRepositoryJson(path.join(ROOT, APPS[appName].androidRoot, '..', 'package.json'));
  const routes = validateDevTunnelRouteInputs({appName, packageConfig, devManifest});
  if (manifest.devTunnelMappings.some(mapping => mapping.shape === shape))
    fail('VK_ANDROID_DEV_TUNNEL_ALREADY_OWNED');
  const existing = parseAdbReverseList(await adbText(manifest, device, `${shape}-dev-tunnel-reverse-list-before`, [
    'reverse',
    '--list',
  ]));
  for (const route of routes) {
    if (existing.some(item => item.deviceSocket === `tcp:${route.devicePort}`))
      fail('VK_ANDROID_DEV_TUNNEL_DEVICE_PORT_ALREADY_MAPPED');
  }
  for (const route of routes) {
    const mapping = {
      shape,
      appName,
      serial: device.serial,
      deviceBootId: bootId,
      devicePort: route.devicePort,
      hostPort: route.hostPort,
      devRunId: devManifest.runId,
      status: 'CREATING',
    };
    manifest.devTunnelMappings.push(mapping);
    saveManifest(manifest);
    await adbText(manifest, device, `${shape}-dev-tunnel-reverse-create-${route.devicePort}`, [
      'reverse',
      '--no-rebind',
      `tcp:${route.devicePort}`,
      `tcp:${route.hostPort}`,
    ]);
    const after = parseAdbReverseList(await adbText(manifest, device, `${shape}-dev-tunnel-reverse-readback-${route.devicePort}`, [
      'reverse',
      '--list',
    ]));
    const deviceRoute = after.filter(item => item.deviceSocket === `tcp:${route.devicePort}`);
    if (deviceRoute.length !== 1 || deviceRoute[0].hostSocket !== `tcp:${route.hostPort}`)
      fail('VK_ANDROID_DEV_TUNNEL_REVERSE_READBACK_MISMATCH');
    mapping.status = 'OWNED';
    saveManifest(manifest);
  }
  appendEvent(manifest, 'DEV_TUNNEL_REVERSE_SETUP', {
    shape,
    appName,
    serial: device.serial,
    bootId,
    devRunId: devManifest.runId,
    mappingCount: routes.length,
    ports: routes.map(route => route.devicePort),
  });
  saveManifest(manifest);
  process.stdout.write(`DEV_TUNNEL_REVERSE_SETUP=PASS\nDEVICE=${shape}\nMAPPINGS=${routes.length}\nPORTS=${routes.map(route => route.devicePort).join(',')}\n`);
}

async function cleanupDevTunnelMappings(manifest) {
  const failures = [];
  for (const mapping of [...manifest.devTunnelMappings]) {
    try {
      const device = deviceFor(manifest, mapping.shape);
      if (device.serial !== mapping.serial || device.inventory?.bootId !== mapping.deviceBootId)
        throw new Error('VK_ANDROID_DEV_TUNNEL_DEVICE_IDENTITY_CHANGED');
      if (mapping.status === 'CREATING') {
        const createResult = manifest.commandResults.find(
          result => result.label === `${mapping.shape}-dev-tunnel-reverse-create-${mapping.devicePort}`,
        );
        if (createResult?.result !== 'PASS') {
          // --no-rebind failed, so this run did not create or replace the
          // pre-existing reverse mapping. Leave it for its owning run.
          manifest.devTunnelMappings = manifest.devTunnelMappings.filter(value => value !== mapping);
          appendEvent(manifest, 'DEV_TUNNEL_REVERSE_NOT_CREATED', {
            shape: mapping.shape,
            appName: mapping.appName,
            serial: mapping.serial,
            deviceBootId: mapping.deviceBootId,
            devicePort: mapping.devicePort,
            hostPort: mapping.hostPort,
          });
          saveManifest(manifest);
          continue;
        }
      }
      const bootId = (await adbText(manifest, device, `${mapping.shape}-dev-tunnel-cleanup-boot-id`, [
        'shell',
        'cat',
        '/proc/sys/kernel/random/boot_id',
      ])).trim();
      if (bootId !== mapping.deviceBootId) throw new Error('VK_ANDROID_DEV_TUNNEL_DEVICE_IDENTITY_CHANGED');
      const routes = parseAdbReverseList(await adbText(manifest, device, `${mapping.shape}-dev-tunnel-cleanup-list`, [
        'reverse',
        '--list',
      ]));
      const atDevicePort = routes.filter(item => item.deviceSocket === `tcp:${mapping.devicePort}`);
      if (atDevicePort.some(item => item.hostSocket !== `tcp:${mapping.hostPort}`))
        throw new Error('VK_ANDROID_DEV_TUNNEL_MAPPING_OWNERSHIP_CHANGED');
      if (atDevicePort.length === 1) {
        await adbText(manifest, device, `${mapping.shape}-dev-tunnel-cleanup-${mapping.devicePort}`, [
          'reverse',
          '--remove',
          `tcp:${mapping.devicePort}`,
        ]);
        const after = parseAdbReverseList(await adbText(manifest, device, `${mapping.shape}-dev-tunnel-cleanup-readback`, [
          'reverse',
          '--list',
        ]));
        if (after.some(item => item.deviceSocket === `tcp:${mapping.devicePort}`))
          throw new Error('VK_ANDROID_DEV_TUNNEL_CLEANUP_READBACK_FAILED');
      } else if (atDevicePort.length > 1) {
        throw new Error('VK_ANDROID_DEV_TUNNEL_MAPPING_AMBIGUOUS');
      }
      manifest.devTunnelMappings = manifest.devTunnelMappings.filter(value => value !== mapping);
      appendEvent(manifest, 'DEV_TUNNEL_REVERSE_CLEANED', {
        shape: mapping.shape,
        appName: mapping.appName,
        serial: mapping.serial,
        deviceBootId: mapping.deviceBootId,
        devicePort: mapping.devicePort,
        hostPort: mapping.hostPort,
        readback: atDevicePort.length === 0 ? 'ALREADY_ABSENT' : 'REMOVED',
      });
      saveManifest(manifest);
    } catch (error) {
      failures.push(error.message);
    }
  }
  return failures;
}

export function parseAdbDeviceList(output) {
  const devices = new Map();
  for (const line of String(output ?? '').split(/\r?\n/)) {
    const [serial, state] = line.trim().split(/\s+/, 2);
    if (state === 'device' && SERIAL_RE.test(serial ?? '')) devices.set(serial, line);
  }
  return devices;
}

export function parseAdbReverseList(output) {
  const mappings = [];
  for (const rawLine of String(output ?? '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length !== 3 || !/^(?:host(?:-\d+)?|\(reverse\))$/.test(parts[0] ?? '') || !/^tcp:\d+$/.test(parts[1] ?? '') || !/^tcp:\d+$/.test(parts[2] ?? ''))
      fail('VK_ANDROID_DEV_TUNNEL_REVERSE_LIST_INVALID');
    mappings.push({scope: parts[0], deviceSocket: parts[1], hostSocket: parts[2]});
  }
  return mappings;
}

export function validateDevTunnelRouteInputs({appName, packageConfig, devManifest}) {
  if (!APPS[appName] || !packageConfig?.serverSpaces || !devManifest?.runId || !devManifest?.tunnelPorts)
    fail('VK_ANDROID_DEV_TUNNEL_INPUT_INVALID');
  if (
    devManifest.kind !== 'r5-dev-run-manifest' ||
    devManifest.topology?.java !== 'REMOTE_TRUSTED_HOST' ||
    devManifest.topology?.tds !== 'REMOTE_TRUSTED_HOST' ||
    devManifest.topology?.haproxy !== 'REMOTE_TRUSTED_HOST_HOST_NETWORK_LOOPBACK_ONLY' ||
    devManifest.readiness?.remoteJava?.readiness !== 'REMOTE_JAVA_SPRING_BOOT_STARTED_AFTER_FLYWAY' ||
    devManifest.readiness?.remoteHaproxy?.status !== 'PASS' ||
    !Array.isArray(devManifest.readiness?.remoteTdsNodes) ||
    devManifest.readiness.remoteTdsNodes.length !== 3 ||
    devManifest.readiness.remoteTdsNodes.some(node => node.readiness !== 'REMOTE_TDS_REACTIVE_WEBSOCKET_AND_DATABASE_LISTENER_READY') ||
    new Set(devManifest.readiness.remoteTdsNodes.map(node => node.remoteIdentity?.nodeId)).size !== 3
  )
    fail('VK_ANDROID_DEV_TUNNEL_DEV_NOT_READY');
  safeRunId(devManifest.runId);
  const development = packageConfig.serverSpaces.spaces?.find(space => space.name === 'development');
  if (packageConfig.serverSpaces.selectedSpace !== 'development' || !development)
    fail('VK_ANDROID_PACKAGE_DEVELOPMENT_SPACE_INVALID');
  const business = development.servers?.find(service => service.serverName === 'business')?.addresses;
  const tds = development.servers?.find(service => service.serverName === 'terminal-data-server')?.addresses;
  if (!Array.isArray(business) || business.length !== 1 || !Array.isArray(tds) || tds.length !== 2)
    fail('VK_ANDROID_PACKAGE_DEV_SERVER_DENOMINATOR_INVALID');
  const address = (entry, expectedProtocol, expectedPort, expectedPath = '/') => {
    let url;
    try {
      url = new URL(entry.baseUrl);
    } catch {
      fail('VK_ANDROID_PACKAGE_DEV_ADDRESS_INVALID');
    }
    const port = Number(expectedPort);
    if (
      !Number.isInteger(port) ||
      port < 1 ||
      port > 65535 ||
      url.protocol !== expectedProtocol ||
      url.hostname !== '127.0.0.1' ||
      Number(url.port) !== port ||
      url.pathname !== expectedPath ||
      url.search !== '' ||
      url.hash !== ''
    )
      fail('VK_ANDROID_PACKAGE_DEV_ADDRESS_MISMATCH');
    return port;
  };
  const businessPath = '/api/terminal/group-workspaces/aurora';
  const businessPort = address(business[0], 'http:', devManifest.tunnelPorts.http, businessPath);
  const tdsPorts = tds.map((entry, index) =>
    address(entry, 'ws:', index === 0 ? devManifest.tunnelPorts.tds : devManifest.tunnelPorts.tdsSecondary),
  );
  if (
    business[0].addressName !== 'primary' ||
    tds[0].addressName !== 'haproxy-entry-one' ||
    tds[1].addressName !== 'haproxy-entry-two' ||
    new Set([businessPort, ...tdsPorts]).size !== 3
  )
    fail('VK_ANDROID_PACKAGE_DEV_ADDRESS_ORDER_INVALID');
  return Object.freeze([businessPort, ...tdsPorts].map(port => Object.freeze({devicePort: port, hostPort: port})));
}

export function parseAndroidProcessTable(output, packageName) {
  if (!Object.values(APPS).some(app => app.packageName === packageName)) fail('VK_ANDROID_APP_INVALID');
  const lines = String(output ?? '')
    .trim()
    .split(/\r?\n/);
  const header = lines.shift()?.trim().split(/\s+/) ?? [];
  const pidIndex = header.indexOf('PID');
  const nameIndex = header.indexOf('NAME');
  if (pidIndex < 0 || nameIndex < 0) fail('VK_ANDROID_PROCESS_TABLE_INVALID');
  return lines.flatMap(line => {
    const columns = line.trim().split(/\s+/);
    const pid = Number(columns[pidIndex]);
    const name = columns[nameIndex];
    if (
      !Number.isSafeInteger(pid) ||
      pid <= 0 ||
      !name ||
      (name !== packageName &&
        (!name.startsWith(`${packageName}:`) || !/^[A-Za-z0-9._-]+$/.test(name.slice(packageName.length + 1))))
    )
      return [];
    return [{pid, name}];
  });
}

export function summarizeAndroidProcessObservation(processTableText, packageName, statReadbacks, startupPid = null) {
  if (!(statReadbacks instanceof Map) || (startupPid !== null && !/^\d{1,10}$/.test(String(startupPid)))) {
    fail('VK_ANDROID_PROCESS_OBSERVATION_INVALID');
  }
  const candidates = parseAndroidProcessTable(processTableText, packageName);
  if (candidates.length > 32 || new Set(candidates.map(candidate => candidate.pid)).size !== candidates.length) {
    fail('VK_ANDROID_PROCESS_OBSERVATION_INVALID');
  }
  const processTableCandidates = candidates.map(({pid, name}) => {
    const statText = statReadbacks.get(String(pid)) ?? '';
    const statFields = statText
      .slice(statText.lastIndexOf(')') + 1)
      .trim()
      .split(/\s+/);
    const processState = statFields[0];
    const startTicks = statFields[19];
    const statReadable = /^\d+$/.test(startTicks ?? '') && /^[A-Za-z]$/.test(processState ?? '');
    return {
      pid,
      name,
      statStatus: statReadable ? 'READABLE' : 'UNREADABLE',
      processState: statReadable ? processState : null,
      startTicks: statReadable ? startTicks : null,
    };
  });
  const startupCandidate =
    startupPid === null ? null : processTableCandidates.find(candidate => candidate.pid === Number(startupPid));
  const startupPidStatus =
    startupPid === null
      ? 'NOT_PROVIDED'
      : !startupCandidate
        ? 'NOT_IN_PROCESS_TABLE'
        : startupCandidate.statStatus === 'READABLE'
          ? 'READABLE'
          : 'CANDIDATE_STAT_UNREADABLE';
  return {
    startupPid: startupPid === null ? null : String(startupPid),
    processTableCandidateCount: processTableCandidates.length,
    processTableCandidates,
    startupPidStatus,
  };
}

export function summarizeAndroidExitInfo(output, packageName, startupPid) {
  if (
    !Object.values(APPS).some(app => app.packageName === packageName) ||
    (startupPid !== null && !/^\d{1,10}$/.test(String(startupPid)))
  )
    fail('VK_ANDROID_EXIT_INFO_INVALID');
  const blocks = [];
  let current = null;
  for (const line of String(output ?? '')
    .slice(0, 1_048_576)
    .split(/\r?\n/)) {
    if (/ApplicationExitInfo\s*\(/.test(line)) {
      if (current !== null) blocks.push(current);
      current = line.slice(line.indexOf('ApplicationExitInfo'));
    } else if (current !== null && current.length < 8192) {
      current += ` ${line.trim()}`;
    }
  }
  if (current !== null) blocks.push(current);
  if (blocks.length > 50) fail('VK_ANDROID_EXIT_INFO_RECORD_COUNT_INVALID');

  let packageRecordCount = 0;
  let targetPidRecordCount = 0;
  let unparseableTargetRecord = false;
  const records = [];
  for (const block of blocks) {
    const processName = block.match(/\bprocess=([A-Za-z0-9._:-]{1,160})(?=[,\s)])/i)?.[1];
    if (processName !== packageName && !processName?.startsWith(`${packageName}:`)) continue;
    packageRecordCount += 1;
    const pid = Number(block.match(/\bpid=(\d{1,10})\b/)?.[1]);
    if (startupPid === null || pid !== Number(startupPid)) continue;
    targetPidRecordCount += 1;
    const reason = block.match(/\breason=(\d{1,4})\s+\(([A-Z][A-Z0-9_]{0,63})\)/);
    const statusCode = block.match(/\bstatus=(-?\d{1,6})\b/);
    if (!reason || !statusCode) {
      unparseableTargetRecord = true;
      continue;
    }
    records.push({pid, reasonCode: Number(reason[1]), reasonName: reason[2], statusCode: Number(statusCode[1])});
  }
  const status =
    records.length > 0
      ? 'MATCHED'
      : unparseableTargetRecord
        ? 'UNPARSEABLE_TARGET_RECORD'
        : packageRecordCount === 0
          ? 'NO_PACKAGE_RECORD'
          : targetPidRecordCount === 0
            ? 'PACKAGE_RECORD_NO_TARGET_PID'
            : 'UNPARSEABLE_TARGET_RECORD';
  return {
    startupPid: startupPid === null ? null : String(startupPid),
    status,
    packageRecordCount,
    targetPidRecordCount,
    records: records.slice(0, 8),
  };
}

async function queryDevices(manifest) {
  const output = await command(manifest, 'adb-device-list', 'adb', ['devices', '-l']);
  return parseAdbDeviceList(output);
}

async function inventoryDevice(manifest, shape) {
  const device = deviceFor(manifest, shape);
  const devices = await queryDevices(manifest);
  if (!devices.has(device.serial)) fail('VK_ANDROID_DEVICE_NOT_ONLINE');
  if (!/^emulator-\d+$/.test(device.serial)) fail('VK_ANDROID_DEVICE_IS_NOT_A_MANAGED_EMULATOR');
  const avdName = parseAvdNameReply(
    await adbText(manifest, device, `${shape}-avd-name`, ['emu', 'avd', 'name']),
  );
  const logicalText = await adbText(manifest, device, `${shape}-logical-display-inventory`, [
    'shell',
    'cmd',
    'display',
    'get-displays',
  ]);
  const surfaceText = await adbText(manifest, device, `${shape}-surface-inventory`, [
    'shell',
    'dumpsys',
    'SurfaceFlinger',
    '--displays',
  ]);
  const model = await adbText(manifest, device, `${shape}-model`, ['shell', 'getprop', 'ro.product.model']);
  const bootId = await adbText(manifest, device, `${shape}-boot-id`, [
    'shell',
    'cat',
    '/proc/sys/kernel/random/boot_id',
  ]);
  const logical = parseLogicalDisplays(logicalText);
  const surfaces = parseSurfaceDisplays(surfaceText);
  const pairing = validateDeviceShape({shape, logical, surfaces});
  const result = {serial: device.serial, avdName, model: model.trim(), bootId: bootId.trim(), logical, surfaces, pairing};
  manifest.devices[shape] = {...manifest.devices[shape], inventory: result, online: true};
  saveManifest(manifest);
  return result;
}

async function prepare(args) {
  const {runId, dualSerial, mobileSerial, a11BaselineRunId, authorization} = validatePrepareOptions(args);
  const runtimeDirectory = path.join(RUNTIME_ROOT, runId);
  if (fs.existsSync(runtimeDirectory)) fail('VK_ANDROID_RUN_ID_ALREADY_EXISTS');
  const processHost = processIdentity(process.pid);
  if (!processHost) fail('VK_ANDROID_RUNNER_PROCESS_IDENTITY_UNAVAILABLE');
  const manifest = {
    schemaVersion: 2,
    runId,
    tool: 'scripts/test/ter-virtual-keyboard-android.mjs',
    phase: 'PREPARE',
    status: 'RUNNING',
    startedAt: now(),
    updatedAt: now(),
    processHost: {platform: process.platform, ...processHost},
    authorization,
    a11BaselineRunId,
    a11Baseline: null,
    persistKvW10Upgrades: [],
    persistKvW10PendingObservation: null,
    devices: {
      dual: {serial: dualSerial, shape: 'dual', online: false},
      mobile: {serial: mobileSerial, shape: 'mobile', online: false},
    },
      processReadbackPreflight: [],
      devTunnelMappings: [],
      appBindings: {},
    ownedRemoteProcesses: [],
    ownedRemoteCaptureProcesses: [],
    pendingRemoteLaunches: [],
    resolvedRemoteLaunches: [],
    pendingRemoteCaptureProcesses: [],
    launchDiagnostics: [],
    launchLogInspections: [],
    launchLogReinspections: [],
    debugFailureInjectionObservations: [],
    historicalRemoteLaunchRecoveries: [],
    remoteTempFiles: [],
    frameMatrix: emptyFrameMatrix(),
    controlledHarnessEntries: [],
      controlledHarnessCaptures: [],
      businessChecks: [],
      terminalBusinessLogEvidence: [],
    commandResults: [],
    processes: [],
    activeProcessIdentity: null,
    business: 'NOT_RUN',
    visual: 'OPEN',
    cleanup: 'NOT_RUN',
    firstFailure: null,
    lastKnownGood: null,
    brokenBoundary: null,
  };
  fs.mkdirSync(runtimeDirectory, {recursive: true, mode: 0o700});
  fs.mkdirSync(path.join(EVIDENCE_ROOT, runId), {recursive: true, mode: 0o700});
  writeJsonAtomic(manifestPath(runId), manifest);
  try {
    resourcePreflight(manifest);
    const dual = await inventoryDevice(manifest, 'dual');
    const mobile = await inventoryDevice(manifest, 'mobile');
    manifest.emulatorPairIdentity = validateTerminalEmulatorPair(dual, mobile);
    appendEvent(manifest, 'DISTINCT_EMULATOR_IDENTITIES_VERIFIED', manifest.emulatorPairIdentity);
    saveManifest(manifest);
    if (a11BaselineRunId) {
      const baseline = readA11Baseline(a11BaselineRunId);
      manifest.a11Baseline = validateA11BaselineManifest(baseline, manifest.devices);
      appendEvent(manifest, 'A11_BASELINE_BOUND', {
        baselineRunId: a11BaselineRunId,
        sourceDigest: manifest.a11Baseline.sourceDigest,
        deviceRoles: Object.fromEntries(
          Object.entries(manifest.a11Baseline.devices).map(([shape, device]) => [
            shape,
            {serial: device.serial, bootId: device.bootId},
          ]),
        ),
      });
      manifest.a11W10SourceDigest = a11SourceDigest(manifest);
    }
    await verifyRemoteProcessReadback(manifest);
    manifest.phase = 'PREPARED';
    manifest.status = 'READY';
    manifest.evidenceRoot = path.relative(ROOT, path.join(EVIDENCE_ROOT, runId));
    saveManifest(manifest);
    process.stdout.write(
      `RUN_ID=${runId}\nDUAL_MODEL=${manifest.devices.dual.inventory.model}\nMOBILE_MODEL=${manifest.devices.mobile.inventory.model}\nA11_BASELINE=${a11BaselineRunId ? 'BOUND' : 'NOT_REQUESTED'}\nPROCESS_READBACK_POSITIVE_PREFLIGHT=PASS\nPROCESS_READBACK_OBSERVATIONS=${manifest.processReadbackPreflight.length}\nPREPARE=PASS\n`,
    );
  } catch (error) {
    manifest.phase = 'PREPARE_FAILED';
    manifest.status = 'FAIL';
    recordFirstFailure(manifest, error.message, 'device-shape-preflight');
    saveManifest(manifest);
    throw error;
  }
}

async function buildApp(manifest, appName, buildType = 'release') {
  const app = APPS[appName];
  if (!app) fail('VK_ANDROID_APP_INVALID');
  const build = appBuildArtifact(appName, buildType);
  if (manifest.a11BaselineRunId && buildType !== 'release') fail('VK_ANDROID_A11_W10_DEBUG_BUILD_FORBIDDEN');
  if (manifest.a11BaselineRunId) validateA11W10Action(manifest, 'build', null, appName);
  const androidRoot = path.join(ROOT, app.androidRoot);
  const apk = path.join(ROOT, build.apkPath);
  manifest.phase = `BUILD_${buildType.toUpperCase()}_${appName}`;
  manifest.status = 'RUNNING';
  saveManifest(manifest);
  const buildEnvironment = buildType === 'debug' ? debugFailureBuildEnvironment() : releaseBuildEnvironment();
  await command(manifest, `build-${buildType}-${appName}`, './gradlew', managedGradleBuildArgs(appName, buildType), {
    cwd: androidRoot,
    env: buildEnvironment,
    timeoutMs: 20 * 60_000,
    captureLog: true,
    maxBytes: 32 * 1024 * 1024,
  });
  const bytes = fs.readFileSync(apk);
  manifest.appBindings[appName] = {...createAppBuildBinding(path.relative(ROOT, apk), bytes), buildType};
  if (manifest.a11BaselineRunId) {
    const digest = a11SourceDigest(manifest);
    if (digest !== manifest.a11W10SourceDigest) fail('VK_ANDROID_A11_W10_SOURCE_CHANGED');
    manifest.appBindings[appName].sourceDigest = digest;
  }
  manifest.lastKnownGood = `build-${appName}`;
  manifest.phase = 'BUILT';
  manifest.status = 'READY';
  saveManifest(manifest);
}

export function releaseBuildEnvironment(baseEnvironment = process.env) {
  return {
    ...baseEnvironment,
    NODE_ENV: 'production',
    EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION: 'false',
  };
}

export function debugFailureBuildEnvironment(baseEnvironment = process.env) {
  return {
    ...baseEnvironment,
    NODE_ENV: 'production',
    EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION: 'true',
  };
}

export function isDebugFailureInjectionEnabled(devMode, buildFlag) {
  return devMode === true || buildFlag === 'true';
}

async function remoteProcessIdentity(manifest, device, packageName) {
  if (!Object.values(APPS).some(app => app.packageName === packageName)) fail('VK_ANDROID_APP_INVALID');
  return remoteNamedProcessIdentity(manifest, device, packageName);
}

function processReadbackAbsenceMatches({exitCode, signal, stderr}, kind) {
  if (signal || exitCode !== 1) return false;
  const diagnostic = String(stderr ?? '').trim();
  if (kind === 'pidof') {
    return diagnostic === '' || /(?:no matching process|no process found)/i.test(diagnostic);
  }
  if (kind === 'proc-stat' || kind === 'proc-cmdline') {
    return /(?:no such file(?: or directory)?|cannot (?:open|access))/i.test(diagnostic);
  }
  return false;
}

function processReadbackOptions(kind) {
  if (!['pidof', 'proc-stat', 'proc-cmdline'].includes(kind)) fail('VK_ANDROID_REMOTE_PROCESS_READBACK_INVALID');
  return {
    acceptedExitCodes: [0, 1],
    returnCommandResult: true,
    diagnosticOutput: 'sanitized',
    preserveLastKnownGood: true,
    resultValidator: result =>
      (result.exitCode === 0 && result.signal == null) || processReadbackAbsenceMatches(result, kind),
  };
}

function processReadbackStdout(result, kind) {
  if (
    !result ||
    typeof result.stdout !== 'string' ||
    typeof result.stderr !== 'string' ||
    ![0, 1].includes(result.exitCode) ||
    !['pidof', 'proc-stat', 'proc-cmdline'].includes(kind)
  ) {
    fail('VK_ANDROID_REMOTE_PROCESS_READBACK_INVALID');
  }
  if (result.exitCode === 0 && result.signal == null) return result.stdout;
  if (processReadbackAbsenceMatches(result, kind)) return '';
  fail('VK_ANDROID_REMOTE_PROCESS_READBACK_INVALID');
}

function procStatComm(stat) {
  const open = stat.indexOf('(');
  const close = stat.lastIndexOf(')');
  if (open <= 0 || close <= open) return null;
  return stat.slice(open + 1, close);
}

function procExecutableMatches(expectedExecutable, value) {
  const actual = String(value ?? '')
    .split('/')
    .at(-1);
  const expected = String(expectedExecutable ?? '')
    .split('/')
    .at(-1);
  return (
    actual === expected ||
    (expected.includes('.') &&
      actual.startsWith(`${expected}:`) &&
      /^[A-Za-z0-9._-]{1,96}$/.test(actual.slice(expected.length + 1)))
  );
}

function procCmdlineMatches(cmdline, expectedExecutable, expectedArgument) {
  const argv = String(cmdline)
    .split('\u0000')
    .filter(value => value.length > 0);
  if (argv.length === 0 || !procExecutableMatches(expectedExecutable, argv[0])) return false;
  return expectedArgument === null || argv.slice(1).includes(expectedArgument);
}

function assertProcessReadbackIdentityBound(manifest, shape, device, identity) {
  const inventory = manifest.devices?.[shape]?.inventory;
  if (
    !inventory ||
    inventory.serial !== device.serial ||
    !/^[A-Za-z0-9-]{8,96}$/.test(inventory.bootId ?? '') ||
    !identity ||
    identity.host !== device.serial ||
    identity.bootId !== inventory.bootId
  ) {
    fail('VK_ANDROID_PROCESS_READBACK_IDENTITY_MISMATCH');
  }
  return identity;
}

export async function verifyRemoteProcessReadback(
  manifest,
  readIdentity = remoteNamedProcessIdentity,
  persist = saveManifest,
) {
  const observations = [];
  const appPackages = [...new Set(Object.values(APPS).map(app => app.packageName))];
  for (const shape of ['dual', 'mobile']) {
    const device = deviceFor(manifest, shape);
    const systemServer = assertProcessReadbackIdentityBound(
      manifest,
      shape,
      device,
      await readIdentity(manifest, device, 'system_server'),
    );
    if (!Array.isArray(systemServer.processes) || systemServer.processes.length === 0) {
      fail('VK_ANDROID_PROCESS_READBACK_POSITIVE_PREFLIGHT_FAILED');
    }
    observations.push({
      shape,
      processName: 'system_server',
      status: 'PRESENT',
      processCount: systemServer.processes.length,
    });
    for (const packageName of appPackages) {
      const identity = assertProcessReadbackIdentityBound(
        manifest,
        shape,
        device,
        await readIdentity(manifest, device, packageName),
      );
      if (!Array.isArray(identity.processes)) fail('VK_ANDROID_PROCESS_READBACK_POSITIVE_PREFLIGHT_FAILED');
      observations.push({
        shape,
        processName: packageName,
        status: identity.processes.length > 0 ? 'PRESENT' : 'ABSENT',
        processCount: identity.processes.length,
      });
    }
  }
  manifest.processReadbackPreflight = observations;
  for (const observation of observations) {
    appendEvent(manifest, 'PROCESS_READBACK_PREFLIGHT', observation);
  }
  persist(manifest);
  return observations;
}

export async function remoteNamedProcessIdentity(manifest, device, processName, readAdbText = adbText) {
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(processName ?? '')) fail('VK_ANDROID_REMOTE_PROCESS_NAME_INVALID');
  const bootId = (
    await readAdbText(manifest, device, `${device.shape}-remote-boot-id`, [
      'shell',
      'cat',
      '/proc/sys/kernel/random/boot_id',
    ])
  ).trim();
  if (!/^[A-Za-z0-9-]{8,96}$/.test(bootId)) fail('VK_ANDROID_REMOTE_PROCESS_IDENTITY_INVALID');
  const lookup = await readAdbText(
    manifest,
    device,
    `${device.shape}-${processName}-remote-process`,
    ['shell', 'pidof', processName],
    processReadbackOptions('pidof'),
  );
  const text = processReadbackStdout(lookup, 'pidof');
  const pids = [
    ...new Set(
      text
        .trim()
        .split(/\s+/)
        .map(Number)
        .filter(pid => Number.isInteger(pid) && pid > 0),
    ),
  ].sort((left, right) => left - right);
  if (pids.length === 0) return {host: device.serial, bootId, processes: []};
  const processes = [];
  for (const pid of pids) {
    const statResult = await readAdbText(
      manifest,
      device,
      `${device.shape}-${processName}-remote-stat-${pid}`,
      ['shell', 'cat', `/proc/${pid}/stat`],
      processReadbackOptions('proc-stat'),
    );
    const stat = processReadbackStdout(statResult, 'proc-stat');
    if (stat.trim() === '') continue;
    const cmdlineResult = await readAdbText(
      manifest,
      device,
      `${device.shape}-${processName}-remote-cmdline-${pid}`,
      ['shell', 'cat', `/proc/${pid}/cmdline`],
      processReadbackOptions('proc-cmdline'),
    );
    const cmdline = processReadbackStdout(cmdlineResult, 'proc-cmdline');
    if (cmdline.trim() === '' || !procCmdlineMatches(cmdline, processName, null)) continue;
    const afterName = stat
      .slice(stat.lastIndexOf(')') + 1)
      .trim()
      .split(/\s+/);
    const startTicks = afterName[19];
    if (!/^\d+$/.test(startTicks ?? '')) fail('VK_ANDROID_REMOTE_PROCESS_IDENTITY_INVALID');
    processes.push({pid, startTicks});
  }
  return {host: device.serial, bootId, processes};
}

export async function remotePidIdentity(
  manifest,
  device,
  pid,
  expectedExecutable,
  expectedArgument = null,
  readAdbText = adbText,
) {
  const bootId = (
    await readAdbText(manifest, device, `${device.shape}-${expectedExecutable}-boot-id`, [
      'shell',
      'cat',
      '/proc/sys/kernel/random/boot_id',
    ])
  ).trim();
  if (!/^[A-Za-z0-9-]{8,96}$/.test(bootId)) fail('VK_ANDROID_REMOTE_PROCESS_IDENTITY_INVALID');
  const statResult = await readAdbText(
    manifest,
    device,
    `${device.shape}-${expectedExecutable}-stat-${pid}`,
    ['shell', 'cat', `/proc/${pid}/stat`],
    processReadbackOptions('proc-stat'),
  );
  const stat = processReadbackStdout(statResult, 'proc-stat');
  if (stat.trim() === '') return {host: device.serial, bootId, process: null};
  const comm = procStatComm(stat);
  const isKnownAppPackage = Object.values(APPS).some(app => app.packageName === expectedExecutable);
  if (!isKnownAppPackage && !procExecutableMatches(expectedExecutable, comm))
    return {host: device.serial, bootId, process: null};
  const cmdlineResult = await readAdbText(
    manifest,
    device,
    `${device.shape}-${expectedExecutable}-cmdline-${pid}`,
    ['shell', 'cat', `/proc/${pid}/cmdline`],
    processReadbackOptions('proc-cmdline'),
  );
  const cmdline = processReadbackStdout(cmdlineResult, 'proc-cmdline');
  if (cmdline.trim() === '') return {host: device.serial, bootId, process: null};
  if (!procCmdlineMatches(cmdline, expectedExecutable, expectedArgument))
    return {host: device.serial, bootId, process: null};
  const afterName = stat
    .slice(stat.lastIndexOf(')') + 1)
    .trim()
    .split(/\s+/);
  const startTicks = afterName[19];
  if (!/^\d+$/.test(startTicks ?? '')) fail('VK_ANDROID_REMOTE_PROCESS_IDENTITY_INVALID');
  return {host: device.serial, bootId, process: {pid, startTicks}};
}

export async function launchRemoteScreenrecord(
  manifest,
  device,
  appName,
  iaId,
  displayId,
  remoteVideo,
  remoteLog,
  readAdbText = adbText,
) {
  const displayIdText = String(displayId);
  if (
    !APPS[appName] ||
    !IA_IDS.includes(iaId) ||
    !/^\d{1,20}$/.test(displayIdText) ||
    !/^\/sdcard\/[A-Za-z0-9._-]+\.mp4$/.test(remoteVideo) ||
    !/^\/sdcard\/[A-Za-z0-9._-]+\.log$/.test(remoteLog)
  )
    fail('VK_ANDROID_SCREENRECORD_ARGUMENT_INVALID');
  const launchCommand = `screenrecord --time-limit 2 --display-id ${displayIdText} ${remoteVideo} >${remoteLog} 2>&1 & echo $!`;
  return readAdbText(manifest, device, `${device.shape}-${appName}-${iaId}-transition-record-start`, [
    'shell',
    launchCommand,
  ]);
}

export function screenrecordProcessUsesPath(processTableText, remoteVideo) {
  if (typeof processTableText !== 'string' || !/^\/sdcard\/[A-Za-z0-9._-]+-transition\.mp4$/.test(remoteVideo ?? ''))
    return false;
  return processTableText.split(/\r?\n/).some(line => line.includes(remoteVideo));
}

export function parseVideoFrameTimestamps(probeText) {
  let probe;
  try {
    probe = JSON.parse(String(probeText ?? ''));
  } catch {
    fail('VK_ANDROID_TRANSITION_FRAME_TIMELINE_INVALID');
  }
  const timestamps = (Array.isArray(probe?.frames) ? probe.frames : [])
    .map(frame => {
      const raw = frame?.best_effort_timestamp_time;
      if (typeof raw === 'number') return raw;
      if (typeof raw !== 'string' || raw.trim() === '') return Number.NaN;
      return Number(raw);
    })
    .filter(value => Number.isFinite(value) && value >= 0);
  const unique = [...new Set(timestamps)].sort((left, right) => left - right);
  if (unique.length === 0 || unique.at(-1) <= 0) fail('VK_ANDROID_TRANSITION_FRAME_TIMELINE_INVALID');
  return Object.freeze(unique);
}

export function transitionVideoSampleOffsets(durationSeconds, frameTimestamps = null) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) fail('VK_ANDROID_TRANSITION_VIDEO_DURATION_INVALID');
  let sampleDurationSeconds = durationSeconds;
  if (frameTimestamps !== null) {
    if (
      !Array.isArray(frameTimestamps) ||
      frameTimestamps.length === 0 ||
      frameTimestamps.some(value => !Number.isFinite(value) || value < 0)
    ) {
      fail('VK_ANDROID_TRANSITION_FRAME_TIMELINE_INVALID');
    }
    const decodableEndSeconds = Math.max(...frameTimestamps);
    if (!Number.isFinite(decodableEndSeconds) || decodableEndSeconds <= 0)
      fail('VK_ANDROID_TRANSITION_FRAME_TIMELINE_INVALID');
    sampleDurationSeconds = Math.min(durationSeconds, decodableEndSeconds);
  }
  return Object.freeze(
    [1, 2, 3, 4, 5].map(index =>
      Object.freeze({
        index,
        offsetFromVideoStartMs: Number(((sampleDurationSeconds * 1000 * index) / 6).toFixed(3)),
      }),
    ),
  );
}

async function installLaunch(manifest, shape, appName, initialFailureOwnerId = null, nativeLoadingDelayMs = null) {
  const app = APPS[appName];
  const binding = manifest.appBindings[appName];
  if (!app || !binding) fail('VK_ANDROID_BUILD_BINDING_REQUIRED');
  if (initialFailureOwnerId !== null && binding.buildType !== 'debug')
    fail('VK_ANDROID_DEBUG_FAILURE_REQUIRES_DEBUG_APK');
  if (initialFailureOwnerId !== null && !/^[A-Za-z0-9:._-]{1,160}$/.test(initialFailureOwnerId))
    fail('VK_ANDROID_DEBUG_FAILURE_OWNER_INVALID');
  if (nativeLoadingDelayMs !== null && binding.buildType !== 'debug')
    fail('VK_ANDROID_DEBUG_FAILURE_REQUIRES_DEBUG_APK');
  if (nativeLoadingDelayMs !== null && initialFailureOwnerId !== null)
    fail('VK_ANDROID_DEBUG_INJECTIONS_MUTUALLY_EXCLUSIVE');
  if (manifest.a11BaselineRunId) {
    validateA11W10Action(manifest, 'launch', shape, appName);
    const oldMarker = manifest.a11Baseline.markers.find(item => item.shape === shape && item.appName === appName);
    const intentId = `${shape}-${appName}-${Date.now()}`;
    manifest.persistKvW10PendingObservation = {
      shape,
      appName,
      packageName: app.packageName,
      serial: manifest.devices[shape].serial,
      bootId: manifest.devices[shape].inventory.bootId,
      intentId,
      oldApkSha256: oldMarker.apkSha256,
      apkSha256: binding.sha256,
      sourceDigest: manifest.a11W10SourceDigest,
      installMode: 'install -r',
      startedAt: now(),
      launchResolved: false,
    };
    appendEvent(manifest, 'A11_W10_UPGRADE_STARTED', {
      shape,
      appName,
      serial: manifest.devices[shape].serial,
      intentId,
      oldApkSha256: oldMarker.apkSha256,
      apkSha256: binding.sha256,
      sourceDigest: manifest.a11W10SourceDigest,
    });
    saveManifest(manifest);
  }
  const device = deviceFor(manifest, shape);
  const prior = await remoteProcessIdentity(manifest, device, app.packageName);
  if (prior.processes.length > 0) fail('VK_ANDROID_PREEXISTING_APP_PROCESS');
  const localApk = path.join(ROOT, binding.apkPath);
  const localBytes = fs.readFileSync(localApk);
  if (sha256(localBytes) !== binding.sha256) fail('VK_ANDROID_LOCAL_APK_BINDING_CHANGED');
  manifest.phase = `INSTALL_${shape}_${appName}`;
  saveManifest(manifest);
  await adbText(manifest, device, `${shape}-${appName}-install`, ['install', '-r', localApk]);
  const pathsText = await adbText(manifest, device, `${shape}-${appName}-installed-path`, [
    'shell',
    'pm',
    'path',
    app.packageName,
  ]);
  const installedPath = pathsText.match(/^package:(\S+)$/m)?.[1];
  if (!installedPath) fail('VK_ANDROID_INSTALLED_APK_PATH_MISSING');
  const remoteSha = await adbText(manifest, device, `${shape}-${appName}-installed-sha`, [
    'shell',
    'sha256sum',
    installedPath,
  ]);
  if (!remoteSha.toLowerCase().includes(binding.sha256)) fail('VK_ANDROID_INSTALLED_APK_BINDING_MISMATCH');
  const preLaunch = await remoteProcessIdentity(manifest, device, app.packageName);
  if (preLaunch.processes.length > 0) fail('VK_ANDROID_PREEXISTING_APP_PROCESS');
  const launchIntentId = manifest.persistKvW10PendingObservation?.intentId ?? `${shape}-${appName}-${Date.now()}`;
  await launchWithPendingOwnership(
    manifest,
    {
      host: device.serial,
      bootId: preLaunch.bootId,
      packageName: app.packageName,
      appName,
      shape,
      intentId: launchIntentId,
    },
    {
      persist: async () => saveManifest(manifest),
      launch: async () => {
        await adbText(manifest, device, `${shape}-${appName}-launch-intent-marker`, [
          'shell',
          'log',
          '-p',
          'i',
          '-t',
          'TER-VK-LAUNCH',
          `intent=${launchIntentId}`,
        ]);
        const launchArgs =
          nativeLoadingDelayMs !== null
            ? debugNativeLoadingDelayIntentArgs(app.activity, Number(nativeLoadingDelayMs))
            : initialFailureOwnerId === null
              ? ['shell', 'am', 'start', '-W', '-n', app.activity]
              : debugFailureInjectionIntentArgs(app.activity, initialFailureOwnerId);
        const result = await adbText(manifest, device, `${shape}-${appName}-launch`, launchArgs);
        if (!/Status:\s*ok/.test(result)) fail('VK_ANDROID_ACTIVITY_LAUNCH_FAILED');
      },
      readback: async () => remoteProcessIdentity(manifest, device, app.packageName),
      onLaunchFailure: async ({intentId, stage, failureCode}) => {
        const diagnostic = {
          intentId,
          shape,
          appName,
          packageName: app.packageName,
          host: device.serial,
          bootId: preLaunch.bootId,
          stage,
          failureCode,
          collectionStatus: 'COLLECTED',
          collectedAt: now(),
        };
        try {
          const logcat = await adbText(
            manifest,
            device,
            `${shape}-${appName}-launch-failure-logcat`,
            [
              'shell',
              'logcat',
              '-d',
              '-t',
              '2000',
              '-v',
              'brief',
              '-s',
              'TER-VK-LAUNCH:I',
              'TER-Splash:I',
              'AndroidRuntime:E',
              'ReactNativeJS:V',
              'ActivityManager:I',
              'ActivityTaskManager:I',
              'DEBUG:F',
              'libc:F',
              'crash_dump32:F',
              'crash_dump64:F',
              'tombstoned:F',
            ],
            {maxBytes: 4 * 1024 * 1024, diagnosticOutput: 'omit'},
          );
          const breadcrumbs = summarizeAppLaunchBreadcrumbs(logcat, appName, intentId);
          diagnostic.runtimeEvents = summarizeStructuredRuntimeDiagnostics(
            logcat,
            breadcrumbs.startupPid === null ? [] : [breadcrumbs.startupPid],
          );
          diagnostic.javascriptErrors = summarizeJavaScriptRuntimeErrors(
            logcat,
            breadcrumbs.startupPid === null ? [] : [breadcrumbs.startupPid],
          );
          diagnostic.javascriptErrorDetails = summarizeJavaScriptRuntimeErrorDetails(
            logcat,
            breadcrumbs.startupPid === null ? [] : [breadcrumbs.startupPid],
          );
          diagnostic.signals = summarizeAndroidLaunchDiagnostics(
            logcat,
            app.packageName,
            breadcrumbs.startupPid,
            intentId,
          );
          Object.assign(diagnostic, breadcrumbs);
        } catch (error) {
          diagnostic.collectionStatus = 'FAILED';
          diagnostic.collectionFailureCode = /^VK_[A-Z0-9_]+$/.test(error?.message ?? '')
            ? error.message
            : 'VK_ANDROID_LAUNCH_LOG_CAPTURE_FAILED';
        }
        manifest.launchDiagnostics ??= [];
        manifest.launchDiagnostics.push(diagnostic);
        appendEvent(manifest, 'REMOTE_LAUNCH_FAILURE_LOG_CAPTURED', {
          shape,
          appName,
          stage,
          failureCode,
          collectionStatus: diagnostic.collectionStatus,
          fatalException: diagnostic.signals?.fatalException ?? null,
          processDied: diagnostic.signals?.processDied ?? null,
          nativeFatalSignalCount: diagnostic.signals?.nativeFatalSignals.length ?? null,
          exceptionTypeCount: diagnostic.signals?.exceptionTypes.length ?? null,
          appFrameCount: diagnostic.signals?.appFrames.length ?? null,
          jsErrorSeen: diagnostic.signals?.jsErrorSeen ?? null,
          jsErrorCount: diagnostic.javascriptErrors?.errorCount ?? null,
          markerCount: diagnostic.markerCount ?? null,
          observedMarkers: diagnostic.observedMarkers ?? [],
        });
        saveManifest(manifest);
      },
    },
  );
  manifest.lastKnownGood = `launch-${shape}-${appName}`;
  manifest.phase = 'RUNNING_APP';
  if (manifest.persistKvW10PendingObservation?.intentId === launchIntentId) {
    if (!manifest.persistKvW10PendingObservation.launchResolved) fail('VK_ANDROID_A11_W10_LAUNCH_NOT_ADOPTED');
  }
  saveManifest(manifest);
}

async function observeA11W10(manifest, shape, appName) {
  validateA11W10Action(manifest, 'observe-w10', shape, appName);
  const pending = manifest.persistKvW10PendingObservation;
  if (!pending.launchResolved) fail('VK_ANDROID_A11_W10_LAUNCH_NOT_ADOPTED');
  const device = deviceFor(manifest, shape);
  if (device.serial !== pending.serial || device.inventory.bootId !== pending.bootId)
    fail('VK_ANDROID_A11_W10_DEVICE_IDENTITY_CHANGED');
  const intent = manifest.resolvedRemoteLaunches.find(item => item.intentId === pending.intentId);
  if (
    !intent ||
    intent.resolution !== 'PROCESS_ADOPTED' ||
    intent.host !== pending.serial ||
    intent.bootId !== pending.bootId
  ) {
    fail('VK_ANDROID_A11_W10_LAUNCH_NOT_ADOPTED');
  }
  requireOwnedApp(manifest, shape, appName);
  const appProcess = await remoteProcessIdentity(manifest, device, pending.packageName);
  if (appProcess.host !== pending.serial || appProcess.bootId !== pending.bootId || appProcess.processes.length === 0) {
    fail('VK_ANDROID_A11_W10_APP_NOT_RUNNING');
  }
  const logcat = await adbText(
    manifest,
    device,
    `${shape}-${appName}-a11-w10-logcat`,
    ['shell', 'logcat', '-d', '-t', '2000', '-v', 'brief', '-s', 'TER-VK-LAUNCH:I', 'TerminalPersistKv:I'],
    {maxBytes: 2 * 1024 * 1024, diagnosticOutput: 'omit'},
  );
  const observation = summarizePersistKvW10(
    logcat,
    pending.intentId,
    appProcess.processes.map(item => String(item.pid)),
  );
  if (observation.status !== 'PASS') fail(`VK_ANDROID_A11_W10_${observation.status}`);
  const item = {
    shape,
    appName,
    packageName: pending.packageName,
    serial: pending.serial,
    bootId: pending.bootId,
    intentId: pending.intentId,
    oldApkSha256: pending.oldApkSha256,
    apkSha256: pending.apkSha256,
    sourceDigest: pending.sourceDigest,
    installMode: pending.installMode,
    namespaceVersion: observation.namespaceVersion,
    newNamespaceExistedBeforeOpen: observation.newNamespaceExistedBeforeOpen,
    legacyNamespacePresent: observation.legacyNamespacePresent,
    operationSucceededAfterOpen: observation.operationSucceededAfterOpen,
    keyMismatchObserved: observation.keyMismatchObserved,
    observationStatus: observation.status,
    observedAt: now(),
  };
  manifest.persistKvW10Upgrades.push(item);
  manifest.persistKvW10PendingObservation = null;
  if (manifest.persistKvW10Upgrades.length === A11_W10_PAIRS.length) manifest.business = 'PASS';
  manifest.lastKnownGood = `a11-w10-${shape}-${appName}`;
  appendEvent(manifest, 'A11_W10_UPGRADE_OBSERVED', {
    shape,
    appName,
    serial: pending.serial,
    apkSha256: pending.apkSha256,
    namespaceVersion: observation.namespaceVersion,
    newNamespaceExistedBeforeOpen: observation.newNamespaceExistedBeforeOpen,
    legacyNamespacePresent: observation.legacyNamespacePresent,
    operationSucceededAfterOpen: observation.operationSucceededAfterOpen,
    keyMismatchObserved: observation.keyMismatchObserved,
  });
  validateRunManifest(manifest);
  saveManifest(manifest);
  process.stdout.write(`A11_W10_OBSERVATION=${JSON.stringify(item)}\n`);
}

function screenshotPath(manifest, iaId, shape, appName, surface) {
  const normalizedIaId = safeLabel(iaId, 'VK_ANDROID_IA_ID_INVALID');
  if (!IA_IDS.includes(normalizedIaId)) fail('VK_ANDROID_IA_ID_OUT_OF_RANGE');
  if (!['primary', 'secondary'].includes(surface)) fail('VK_ANDROID_SURFACE_INVALID');
  const app = safeLabel(appName, 'VK_ANDROID_APP_INVALID');
  if (!APPS[app]) fail('VK_ANDROID_APP_INVALID');
  const file = `${normalizedIaId}-${shape}-${app}-${surface}-${Date.now()}.png`;
  return path.join(EVIDENCE_ROOT, manifest.runId, file);
}

async function uiDump(manifest, device, displayId, {deadlineMonotonic = null} = {}) {
  const commandTimeout = () => {
    if (deadlineMonotonic === null) return UI_DUMP_COMMAND_TIMEOUT_MS;
    const remainingMs = Math.ceil(deadlineMonotonic - performance.now());
    if (remainingMs < 1) fail('VK_ANDROID_BUSINESS_SCREEN_WAIT_TIMED_OUT');
    return Math.min(UI_DUMP_COMMAND_TIMEOUT_MS, remainingMs);
  };
  const remote = `/sdcard/${manifest.runId}-${device.shape}-${Date.now()}.xml`;
  manifest.remoteTempFiles.push({host: device.serial, path: remote});
  validateRunManifest(manifest);
  saveManifest(manifest);
  await adbText(manifest, device, `${device.shape}-uiautomator-dump`, [
    'shell',
    'uiautomator',
    'dump',
    '--windows',
    remote,
  ], {timeoutMs: commandTimeout()});
  const xml = await adbText(manifest, device, `${device.shape}-uiautomator-read`, ['shell', 'cat', remote], {
    maxBytes: 12 * 1024 * 1024,
    diagnosticOutput: 'omit',
    timeoutMs: commandTimeout(),
  });
  await adbText(manifest, device, `${device.shape}-uiautomator-remove`, ['shell', 'rm', '-f', remote], {
    timeoutMs: commandTimeout(),
  });
  manifest.remoteTempFiles = manifest.remoteTempFiles.filter(
    value => !(value.host === device.serial && value.path === remote),
  );
  saveManifest(manifest);
  return {xml, displayId};
}

async function typeW7Probe(manifest, device, displayId, resourceId, initialXml = null) {
  const xml = initialXml ?? (await uiDump(manifest, device, displayId)).xml;
  const keyCenters = w7ProbeTapPlan(xml, displayId, resourceId);

  for (let index = 0; index < keyCenters.length; index += 1) {
    const point = keyCenters[index];
    await adbText(manifest, device, `${device.shape}-w7-probe-key-${index + 1}`, [
      'shell',
      'input',
      '-d',
      String(displayId),
      'tap',
      String(point.x),
      String(point.y),
    ]);
  }

  const after = await uiDump(manifest, device, displayId);
  const observedValue = parseResourceTextValue(after.xml, resourceId, displayId);
  const expectedValue = W7_PROBE_TEXT_BY_RESOURCE_ID[resourceId];
  const secureField = resourceId === 'sample.auth.login:passcode';
  const readbackMatches = secureField ? observedValue.length > 0 : observedValue === expectedValue;
  if (!readbackMatches) {
    appendEvent(manifest, 'W7_INPUT_PROBE_READBACK_MISMATCH', {
      resourceId,
      displayId,
      expectedValuePresent: expectedValue.length > 0,
      observedValuePresent: observedValue.length > 0,
      fieldFocused: parseResourceUiState(after.xml, resourceId, displayId)?.focused === true,
      keyboardVisible: parseResourceNode(after.xml, 'ui.base.input:virtual-keyboard', displayId) !== null,
      injectedKeyCount: keyCenters.length,
      secureField,
    });
    saveManifest(manifest);
    fail('VK_ANDROID_W7_PROBE_READBACK_MISMATCH');
  }
  return {xml: after.xml, valueMatched: readbackMatches, injectedKeyCount: keyCenters.length};
}

async function capture(
  manifest,
  shape,
  appName,
  iaId,
  surface,
  stateLabel,
  transitionIndex = null,
  evidenceKind = 'PRODUCT_FRAME',
) {
  if (
    evidenceKind === 'PRODUCT_FRAME' &&
    manifest.controlledHarnessEntries?.some(item => item.shape === shape && item.app === appName)
  ) {
    fail('VK_ANDROID_PRODUCT_CAPTURE_AFTER_CONTROLLED_HARNESS_ENTRY');
  }
  if (
    evidenceKind === 'CONTROLLED_HARNESS' &&
    !manifest.controlledHarnessEntries?.some(item => item.shape === shape && item.app === appName)
  ) {
    fail('VK_ANDROID_CONTROLLED_HARNESS_ENTRY_REQUIRED');
  }
  requireOwnedApp(manifest, shape, appName);
  const device = deviceFor(manifest, shape);
  if (surface === 'secondary' && shape !== 'dual') fail('VK_ANDROID_SECONDARY_SURFACE_UNAVAILABLE');
  const priorPairing = validateDeviceShape({
    shape,
    logical: device.inventory.logical,
    surfaces: device.inventory.surfaces,
  });
  const priorLogical = surface === 'primary' ? priorPairing.primary : priorPairing.secondary;
  const {xml} = await uiDump(manifest, device, priorLogical.id);
  const app = APPS[appName];
  const windowIdentity = parseDisplayWindowIdentity(xml, priorLogical.id, app.packageName);
  const visibleControls = parseVisibleControlInventory(xml, priorLogical.id);

  const logicalText = await adbText(
    manifest,
    device,
    `${shape}-${appName}-${iaId}-${surface}-capture-logical`,
    ['shell', 'cmd', 'display', 'get-displays'],
    {maxBytes: 12 * 1024 * 1024},
  );
  const displayDumpText = await adbText(
    manifest,
    device,
    `${shape}-${appName}-${iaId}-${surface}-capture-display-dump`,
    ['shell', 'dumpsys', 'display'],
    {maxBytes: 12 * 1024 * 1024},
  );
  const surfaceDumpText = await adbText(
    manifest,
    device,
    `${shape}-${appName}-${iaId}-${surface}-capture-surfaceflinger`,
    ['shell', 'dumpsys', 'SurfaceFlinger', '--displays'],
    {maxBytes: 12 * 1024 * 1024},
  );
  const current = resolveCaptureDisplayInventory(shape, logicalText, displayDumpText, surfaceDumpText);
  const logical = surface === 'primary' ? current.pairing.primary : current.pairing.secondary;
  const sf = surface === 'primary' ? current.pairing.primarySurface : current.pairing.secondarySurface;
  if (
    !logical ||
    logical.id !== priorLogical.id ||
    logical.uniqueId !== priorLogical.uniqueId ||
    logical.name !== priorLogical.name
  ) {
    fail('VK_ANDROID_CAPTURE_SURFACE_IDENTITY_CHANGED');
  }
  manifest.devices[shape].inventory = {
    ...manifest.devices[shape].inventory,
    logical: current.logical,
    surfaces: current.surfaces,
    pairing: current.pairing,
  };
  const file = screenshotPath(manifest, iaId, shape, appName, surface);
  const artifactStem = file.slice(0, -'.png'.length);
  const displayDumpPath = writeCaptureTextArtifact(`${artifactStem}.dumpsys-display.txt`, displayDumpText);
  const surfaceDumpPath = writeCaptureTextArtifact(`${artifactStem}.surfaceflinger-displays.txt`, surfaceDumpText);
  const logicalDumpPath = writeCaptureTextArtifact(`${artifactStem}.cmd-display-get-displays.txt`, logicalText);
  appendEvent(manifest, 'CAPTURE_DISPLAY_INVENTORY', {
    iaId,
    shape,
    app: appName,
    surface,
    serial: device.serial,
    logicalDisplayId: logical.id,
    logicalUniqueId: logical.uniqueId,
    surfaceFlingerId: sf.id,
    displayDumpPath,
    surfaceDumpPath,
    logicalDumpPath,
  });
  saveManifest(manifest);
  const startedAt = Date.now();
  const png = await command(
    manifest,
    `${shape}-${appName}-${iaId}-${surface}-capture`,
    'adb',
    adbArgs(device, ['exec-out', 'screencap', '-p', '-d', sf.id]),
    {binary: true, maxBytes: 20 * 1024 * 1024, timeoutMs: 30_000},
  );
  const dimensions = pngDimensions(png);
  if (dimensions.width !== logical.width || dimensions.height !== logical.height)
    fail('VK_ANDROID_CAPTURE_GEOMETRY_MISMATCH');
  fs.writeFileSync(file, png, {mode: 0o600});
  const fileOutput = await command(manifest, `${shape}-${appName}-${iaId}-${surface}-file`, 'file', [file]);
  const fileInfo = parsePngFileDescription(fileOutput);
  if (
    fileInfo.width !== logical.width ||
    fileInfo.height !== logical.height ||
    fileInfo.width !== dimensions.width ||
    fileInfo.height !== dimensions.height
  )
    fail('VK_ANDROID_CAPTURE_FILE_GEOMETRY_MISMATCH');
  const relative = path.relative(ROOT, file);
  const controlsFile = `${artifactStem}.controls.json`;
  writeJsonAtomic(controlsFile, {schemaVersion: 1, displayId: logical.id, nodes: visibleControls});
  const evidence = {
    serial: device.serial,
    app: appName,
    packageName: app.packageName,
    activity: app.activity,
    shape,
    surface,
    logicalDisplayId: logical.id,
    logicalName: logical.name,
    logicalUniqueId: logical.uniqueId,
    logicalResolution: `${logical.width}x${logical.height}`,
    surfaceFlingerId: sf.id,
    surfaceFlingerName: sf.name,
    windowIdentity,
    fileDescription: fileInfo.description,
    width: fileInfo.width,
    height: fileInfo.height,
    visibleControlCount: visibleControls.length,
    visibleControlsWithStableResourceId: visibleControls.filter(item => item.resourceId !== null).length,
    controlsInventory: path.relative(ROOT, controlsFile),
    dumpsysDisplay: displayDumpPath,
    surfaceFlingerDisplays: surfaceDumpPath,
    logicalDisplayListing: logicalDumpPath,
  };
  const evidenceFile = `${artifactStem}.capture-evidence.json`;
  writeJsonAtomic(evidenceFile, evidence);
  const record = {
    shape,
    serial: device.serial,
    model: device.inventory.model,
    app: appName,
    iaId,
    surface,
    logicalDisplayId: logical.id,
    logicalResolution: `${logical.width}x${logical.height}`,
    surfaceFlingerId: sf.id,
    screenshot: relative,
    captureEvidence: path.relative(ROOT, evidenceFile),
    controlsInventory: path.relative(ROOT, controlsFile),
    visibleControlCount: visibleControls.length,
    visibleControls,
    windowIdentity,
    fileDescription: fileInfo.description,
    sha256: sha256(png),
    bytes: png.length,
    elapsedMs: Date.now() - startedAt,
    state: safeLabel(stateLabel, 'VK_ANDROID_STATE_LABEL_INVALID'),
    transitionIndex,
  };
  recordCapture(manifest, iaId, record, evidenceKind);
  saveManifest(manifest);
  return record;
}

async function tapResource(manifest, shape, resourceId, surface = 'primary') {
  requireOwnedApp(manifest, shape);
  const device = deviceFor(manifest, shape);
  if (surface === 'secondary' && shape !== 'dual') fail('VK_ANDROID_SECONDARY_SURFACE_UNAVAILABLE');
  const logical = surface === 'primary' ? device.inventory.pairing?.primary : device.inventory.pairing?.secondary;
  const actual =
    logical ??
    validateDeviceShape({shape, logical: device.inventory.logical, surfaces: device.inventory.surfaces})[surface];
  const {xml} = await uiDump(manifest, device, actual.id);
  const node = parseResourceNode(xml, safeLabel(resourceId, 'VK_ANDROID_RESOURCE_ID_INVALID'), actual.id);
  if (!node || !node.enabled || node.right <= node.left || node.bottom <= node.top)
    fail('VK_ANDROID_RESOURCE_NODE_NOT_ACTIONABLE');
  const x = Math.floor((node.left + node.right) / 2);
  const y = Math.floor((node.top + node.bottom) / 2);
  const issuedAtMonotonic = performance.now();
  await adbText(manifest, device, `${shape}-tap-${resourceId.replaceAll(':', '-')}`, [
    'shell',
    'input',
    '-d',
    String(actual.id),
    'tap',
    String(x),
    String(y),
  ]);
  manifest.lastKnownGood = `tap:${resourceId}`;
  saveManifest(manifest);
  return {issuedAtMonotonic, completedAtMonotonic: performance.now()};
}

async function enterTerminalBusinessInput(manifest, shape, appName, valueKey, surface = 'primary') {
  requireOwnedApp(manifest, shape, appName);
  const input = TERMINAL_BUSINESS_INPUTS[valueKey];
  if (!input || !input.apps.includes(appName)) fail('VK_ANDROID_BUSINESS_INPUT_SCOPE_INVALID');
  const device = deviceFor(manifest, shape);
  const display = logicalDisplayFor(manifest, shape, surface);
  const value = terminalBusinessInputValue(manifest.runId, valueKey);
  const keyPlan = terminalBusinessInputKeyPlan(value);
  let {xml} = await uiDump(manifest, device, display.id);
  const field = parseResourceNode(xml, input.resourceId, display.id);
  if (!field?.enabled) fail('VK_ANDROID_BUSINESS_INPUT_FIELD_NOT_ACTIONABLE');
  if (parseResourceTextValue(xml, input.resourceId, display.id).length !== 0)
    fail('VK_ANDROID_BUSINESS_INPUT_FIELD_NOT_EMPTY');
  if (parseResourceUiState(xml, input.resourceId, display.id)?.focused !== true) {
    await tapResource(manifest, shape, input.resourceId, surface);
  }
  let keyboardReady = false;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    ({xml} = await uiDump(manifest, device, display.id));
    if (parseResourceNode(xml, 'ui.base.input:virtual-keyboard', display.id) !== null) {
      keyboardReady = true;
      break;
    }
    await sleep(120);
  }
  if (!keyboardReady) fail('VK_ANDROID_BUSINESS_INPUT_KEYBOARD_NOT_READY');
  const shiftId = 'ui.base.input:virtual-keyboard:shift';
  for (let index = 0; index < keyPlan.length; index += 1) {
    const key = keyPlan[index];
    ({xml} = await uiDump(manifest, device, display.id));
    const shift = parseResourceNode(xml, shiftId, display.id);
    if (key.uppercase && !shift?.selected) {
      if (!shift?.enabled) fail('VK_ANDROID_BUSINESS_INPUT_SHIFT_NOT_ACTIONABLE');
      await tapActivationKey(manifest, shape, display.id, shiftId, `${shape}-business-input-shift-${String(index + 1).padStart(2, '0')}`);
    } else if (!key.uppercase && shift?.selected) {
      if (!shift.enabled) fail('VK_ANDROID_BUSINESS_INPUT_SHIFT_NOT_ACTIONABLE');
      await tapActivationKey(manifest, shape, display.id, shiftId, `${shape}-business-input-unshift-${String(index + 1).padStart(2, '0')}`);
    }
    await tapActivationKey(
      manifest,
      shape,
      display.id,
      `ui.base.input:virtual-keyboard:${key.keyId}`,
      `${shape}-business-input-key-${String(index + 1).padStart(2, '0')}`,
    );
  }
  ({xml} = await uiDump(manifest, device, display.id));
  const evidence = terminalBusinessInputReadback(
    valueKey,
    value,
    valueKey === 'staff-passcode' ? null : parseResourceTextValue(xml, input.resourceId, display.id),
  );
  if (evidence.matched === false) fail('VK_ANDROID_BUSINESS_INPUT_READBACK_MISMATCH');
  manifest.businessChecks ??= [];
  manifest.businessChecks.push({name: 'BUSINESS_INPUT_READBACK', ...evidence, at: now()});
  appendEvent(manifest, 'BUSINESS_INPUT_READBACK', evidence);
  if (evidence.matched === true) manifest.lastKnownGood = `business-input:${valueKey}`;
  saveManifest(manifest);
  process.stdout.write(
    `ANDROID_BUSINESS_INPUT=${evidence.matched === true ? 'PASS' : 'DISPATCHED'}\nVALUE_KEY=${valueKey}\nCHARACTERS=${value.length}\nVERIFICATION=${evidence.verification}\nVALUE_REDACTED=true\n`,
  );
}

async function assertTerminalBusinessText(manifest, shape, appName, expectationId, surface = 'primary') {
  requireOwnedApp(manifest, shape, appName);
  const device = deviceFor(manifest, shape);
  const display = logicalDisplayFor(manifest, shape, surface);
  let evidence;
  let failureCode = null;
  try {
    const {xml} = await uiDump(manifest, device, display.id);
    evidence = terminalBusinessTextAssertion(xml, expectationId, display.id);
  } catch (error) {
    failureCode = /^VK_ANDROID_[A-Z0-9_]+$/u.test(error?.message ?? '')
      ? error.message
      : 'VK_ANDROID_BUSINESS_TEXT_ASSERTION_ERROR';
    evidence = Object.freeze({expectationId, resourceId: 'UNRESOLVED', matched: false, failureCode});
  }
  manifest.businessChecks ??= [];
  manifest.businessChecks.push({name: 'BUSINESS_VISIBLE_TEXT', ...evidence, at: now()});
  appendEvent(manifest, 'BUSINESS_VISIBLE_TEXT', evidence);
  saveManifest(manifest);
  if (!evidence.matched) fail(failureCode ?? 'VK_ANDROID_BUSINESS_TEXT_ASSERTION_FAILED');
  process.stdout.write(`ANDROID_BUSINESS_TEXT=PASS\nEXPECTATION=${expectationId}\nVALUE_REDACTED=true\n`);
}

async function assertTerminalBusinessScreen(manifest, shape, appName, expectationId, surface = 'primary') {
  requireOwnedApp(manifest, shape, appName);
  const device = deviceFor(manifest, shape);
  const display = logicalDisplayFor(manifest, shape, surface);
  let evidence;
  let failureCode = null;
  try {
    const {xml} = await uiDump(manifest, device, display.id);
    evidence = terminalBusinessScreenAssertion(xml, expectationId, display.id);
  } catch (error) {
    failureCode = /^VK_ANDROID_[A-Z0-9_]+$/u.test(error?.message ?? '')
      ? error.message
      : 'VK_ANDROID_BUSINESS_SCREEN_ASSERTION_ERROR';
    evidence = Object.freeze({
      expectationId,
      requiredControlCount: 0,
      matchedControlCount: 0,
      missingResourceIds: [],
      unexpectedResourceIds: [],
      ambiguousResourceIds: [],
      matched: false,
      failureCode,
    });
  }
  manifest.businessChecks ??= [];
  manifest.businessChecks.push({name: 'BUSINESS_SCREEN_CONTROLS', ...evidence, at: now()});
  appendEvent(manifest, 'BUSINESS_SCREEN_CONTROLS', evidence);
  saveManifest(manifest);
  if (!evidence.matched) fail(failureCode ?? 'VK_ANDROID_BUSINESS_SCREEN_ASSERTION_FAILED');
  process.stdout.write(
    `ANDROID_BUSINESS_SCREEN=PASS\nEXPECTATION=${expectationId}\nCONTROLS=${evidence.matchedControlCount}/${evidence.requiredControlCount}\n`,
  );
}

async function assertTerminalBusinessMemberReadback(manifest, shape, appName, surface = 'primary') {
  if (appName !== 'sample-terminal') fail('VK_ANDROID_BUSINESS_MEMBER_APP_INVALID');
  requireOwnedApp(manifest, shape, appName);
  const device = deviceFor(manifest, shape);
  const display = logicalDisplayFor(manifest, shape, surface);
  const startedAt = performance.now();
  let evidence;
  try {
    const {xml} = await uiDump(manifest, device, display.id);
    evidence = terminalBusinessMemberReadback(
      xml,
      terminalBusinessInputValue(manifest.runId, 'member-name'),
      terminalBusinessInputValue(manifest.runId, 'member-phone'),
      display.id,
    );
  } catch (error) {
    const failureCode = /^VK_ANDROID_[A-Z0-9_]+$/u.test(error?.message ?? '')
      ? error.message
      : 'VK_ANDROID_BUSINESS_MEMBER_READBACK_FAILED';
    evidence = Object.freeze({rowsObserved: 0, matchingRows: 0, matched: false, failureCode});
  }
  const result = Object.freeze({name: 'BUSINESS_MEMBER_READBACK', ...evidence, elapsedMs: Math.ceil(performance.now() - startedAt), at: now()});
  manifest.businessChecks ??= [];
  manifest.businessChecks.push(result);
  appendEvent(manifest, evidence.matched ? 'BUSINESS_MEMBER_READBACK' : 'BUSINESS_MEMBER_READBACK_FAILED', result);
  saveManifest(manifest);
  if (!evidence.matched) {
    const failureCode = evidence.failureCode ?? 'VK_ANDROID_BUSINESS_MEMBER_READBACK_MISMATCH';
    recordFirstFailure(manifest, failureCode, 'member-list-owner-readback');
    saveManifest(manifest);
    fail(failureCode);
  }
  manifest.lastKnownGood = 'business-member-row-readback';
  saveManifest(manifest);
  process.stdout.write(
    `ANDROID_BUSINESS_MEMBER_READBACK=PASS\nROWS=${evidence.rowsObserved}\nMATCHES=${evidence.matchingRows}\nVALUES_REDACTED=true\n`,
  );
}

async function waitTerminalBusinessScreen(manifest, shape, appName, expectationId, surface = 'primary') {
  requireOwnedApp(manifest, shape, appName);
  const device = deviceFor(manifest, shape);
  const display = logicalDisplayFor(manifest, shape, surface);
  const startedAt = performance.now();
  const deadline = startedAt + BUSINESS_SCREEN_WAIT_TIMEOUT_MS;
  let attempts = 0;
  let evidence = null;
  let failureCode = null;
  try {
    while (performance.now() < deadline) {
      const {xml} = await uiDump(manifest, device, display.id, {deadlineMonotonic: deadline});
      attempts += 1;
      evidence = terminalBusinessScreenAssertion(xml, expectationId, display.id);
      if (evidence.matched) break;
      await sleep(Math.min(BUSINESS_SCREEN_WAIT_POLL_MS, Math.max(0, deadline - performance.now())));
    }
  } catch (error) {
    failureCode = /^VK_ANDROID_[A-Z0-9_]+$/u.test(error?.message ?? '')
      ? error.message
      : 'VK_ANDROID_BUSINESS_SCREEN_WAIT_READ_FAILED';
  }
  const completedAt = performance.now();
  const elapsedMs = Math.ceil(completedAt - startedAt);
  const matched = failureCode === null && terminalBusinessScreenWaitMatched(evidence?.matched === true, elapsedMs, BUSINESS_SCREEN_WAIT_TIMEOUT_MS);
  const result = Object.freeze({
    name: 'BUSINESS_SCREEN_WAIT',
    ...(evidence ?? {expectationId, requiredControlCount: 0, matchedControlCount: 0, missingResourceIds: [], unexpectedResourceIds: []}),
    observedMatched: evidence?.matched === true,
    matched,
    attempts,
    elapsedMs,
    timeoutMs: BUSINESS_SCREEN_WAIT_TIMEOUT_MS,
    failureCode,
    at: now(),
  });
  manifest.businessChecks ??= [];
  manifest.businessChecks.push(result);
  appendEvent(manifest, 'BUSINESS_SCREEN_WAIT', result);
  if (!matched) recordFirstFailure(manifest, failureCode ?? 'VK_ANDROID_BUSINESS_SCREEN_WAIT_TIMED_OUT', 'business-screen-wait');
  saveManifest(manifest);
  if (!result.matched) fail(failureCode ?? 'VK_ANDROID_BUSINESS_SCREEN_WAIT_TIMED_OUT');
  manifest.lastKnownGood = `business-screen:${expectationId}`;
  saveManifest(manifest);
  process.stdout.write(
    `ANDROID_BUSINESS_SCREEN=PASS\nEXPECTATION=${expectationId}\nCONTROLS=${evidence.matchedControlCount}/${evidence.requiredControlCount}\nATTEMPTS=${attempts}\nELAPSED_MS=${elapsedMs}\n`,
  );
}

async function collectTerminalBusinessLogEvidence(manifest, shape, appName, startedAt, finishedAt) {
  const app = APPS[appName];
  if (!app || !isCanonicalBusinessTimestamp(startedAt) || !isCanonicalBusinessTimestamp(finishedAt)) {
    fail('VK_ANDROID_TERMINAL_BUSINESS_LOG_ARGUMENT_INVALID');
  }
  const device = deviceFor(manifest, shape);
  const owned = requireOwnedApp(manifest, shape, appName);
  const current = await remoteProcessIdentity(manifest, device, app.packageName);
  if (!remoteProcessIdentityMatches(owned, current, device.serial) || current.processes.length === 0) {
    fail('VK_ANDROID_TERMINAL_BUSINESS_LOG_PROCESS_IDENTITY_MISMATCH');
  }
  const logcatText = await adbText(
    manifest,
    device,
    `${shape}-${appName}-terminal-business-logcat`,
    ['shell', 'logcat', '-d', '-t', '4000', '-v', 'epoch', '-s', 'ReactNativeJS:V'],
    {maxBytes: 12 * 1024 * 1024, diagnosticOutput: 'omit'},
  );
  const evidence = projectTerminalBusinessLogcatEvents(
    logcatText,
    current.processes.map(value => String(value.pid)),
    startedAt,
    finishedAt,
  );
  manifest.terminalBusinessLogEvidence ??= [];
  manifest.terminalBusinessLogEvidence.push({
    shape,
    appName,
    serial: device.serial,
    bootId: current.bootId,
    processCount: current.processes.length,
    startedAt,
    finishedAt,
    eventCount: evidence.events.length,
    invalidEventCount: evidence.invalidEventCount,
    events: evidence.events,
    status: evidence.invalidEventCount === 0 ? 'CAPTURED' : 'FAIL',
    at: now(),
  });
  appendEvent(manifest, 'TERMINAL_BUSINESS_LOG_EVIDENCE_COLLECTED', {
    shape,
    appName,
    serial: device.serial,
    bootId: current.bootId,
    processCount: current.processes.length,
    eventCount: evidence.events.length,
    invalidEventCount: evidence.invalidEventCount,
    status: evidence.invalidEventCount === 0 ? 'PASS' : 'FAIL',
  });
  saveManifest(manifest);
  if (evidence.invalidEventCount !== 0) fail('VK_ANDROID_TERMINAL_BUSINESS_LOG_EVENT_INVALID');
  process.stdout.write(`ANDROID_TERMINAL_BUSINESS_LOGS=CAPTURED\nEVENTS=${evidence.events.length}\nRAW_LOG_RETAINED=false\n`);
}

async function readTerminalBusinessClock(manifest, shape) {
  const device = deviceFor(manifest, shape);
  const output = await adbText(
    manifest,
    device,
    `${shape}-terminal-business-clock`,
    ['shell', 'date', '+%s'],
    {diagnosticOutput: 'omit'},
  );
  const seconds = Number(output.trim());
  if (!/^\d{9,11}$/u.test(output.trim()) || !Number.isSafeInteger(seconds) || seconds <= 0)
    fail('VK_ANDROID_TERMINAL_BUSINESS_CLOCK_INVALID');
  const epochMs = seconds * 1000;
  manifest.terminalBusinessClock = {
    serial: device.serial,
    bootId: device.inventory.bootId,
    epochMs,
    observedAt: now(),
  };
  appendEvent(manifest, 'TERMINAL_BUSINESS_CLOCK_READ', {
    serial: device.serial,
    bootId: device.inventory.bootId,
    epochMs,
  });
  saveManifest(manifest);
  process.stdout.write(`ANDROID_BUSINESS_CLOCK_EPOCH_MS=${epochMs}\nDEVICE_IDENTITY_BOUND=true\n`);
}

async function tapActivationKey(manifest, shape, displayId, keyId, safeLabel) {
  const device = deviceFor(manifest, shape);
  const {xml} = await uiDump(manifest, device, displayId);
  const key = parseResourceNode(xml, keyId, displayId);
  if (!key?.enabled || key.right <= key.left || key.bottom <= key.top)
    fail('VK_ANDROID_ACTIVATION_KEY_NOT_ACTIONABLE');
  await adbText(manifest, device, safeLabel, [
    'shell',
    'input',
    '-d',
    String(displayId),
    'tap',
    String(Math.floor((key.left + key.right) / 2)),
    String(Math.floor((key.top + key.bottom) / 2)),
  ]);
}

async function clearActivationCodeInput(manifest, shape, appName, labelOrdinalOffset = 0) {
  requireOwnedApp(manifest, shape, appName);
  const device = deviceFor(manifest, shape);
  const display = logicalDisplayFor(manifest, shape, 'primary');
  let {xml} = await uiDump(manifest, device, display.id);
  if (parseResourceNode(xml, TERMINAL_ACTIVATION_SCREEN_ID, display.id) === null)
    fail('VK_ANDROID_ACTIVATION_SCREEN_NOT_VISIBLE');
  let readiness = terminalActivationInputReadiness(xml, display.id);
  if (!readiness.fieldVisible)
    fail('VK_ANDROID_ACTIVATION_INPUT_NOT_VISIBLE');
  // A rendered keyboard is presentation state, not evidence that this field
  // owns input. Route every probe through the field's real focus entrypoint.
  await tapResource(manifest, shape, TERMINAL_ACTIVATION_INPUT_ID);
  let readinessAttempts = 0;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    readinessAttempts = attempt;
    ({xml} = await uiDump(manifest, device, display.id));
    readiness = terminalActivationInputReadiness(xml, display.id);
    if (readiness.ready) break;
    await sleep(120);
  }
  const readinessEvidence = Object.freeze({
    shape,
    appName,
    displayId: display.id,
    fieldEnabled: readiness.fieldEnabled,
    nativeFocusReported: readiness.nativeFocusReported,
    keyboardVisible: readiness.keyboardVisible,
    keyboardHitShieldPresent: readiness.keyboardHitShieldPresent,
    ready: readiness.ready,
    attempts: readinessAttempts,
    proof: 'SETTLED_INTERACTIVE_VIRTUAL_KEYBOARD',
    at: now(),
  });
  manifest.activationInputReadiness = readinessEvidence;
  appendEvent(manifest, 'ACTIVATION_INPUT_READINESS_OBSERVED', readinessEvidence);
  saveManifest(manifest);
  if (!readiness.ready) {
    recordFirstFailure(manifest, 'VK_ANDROID_ACTIVATION_INPUT_NOT_READY', 'activation-input-readiness');
    saveManifest(manifest);
    fail('VK_ANDROID_ACTIVATION_INPUT_NOT_READY');
  }
  for (let index = 0; index < 8; index += 1) {
    await tapActivationKey(
      manifest,
      shape,
      display.id,
      'ui.base.input:virtual-keyboard:backspace',
      activationFixtureActionLabel(shape, 'overlength', labelOrdinalOffset + index + 1),
    );
  }
  ({xml} = await uiDump(manifest, device, display.id));
  if (parseResourceTextValue(xml, TERMINAL_ACTIVATION_INPUT_ID, display.id) !== '')
    fail('VK_ANDROID_ACTIVATION_INPUT_CLEAR_FAILED');
}

async function enterActivationDigits(manifest, shape, displayId, digits, purpose) {
  for (let index = 0; index < digits.length; index += 1) {
    const digit = digits[index];
    if (!/^[0-9]$/.test(digit)) fail('VK_ANDROID_ACTIVATION_FIXTURE_INPUT_INVALID');
    await tapActivationKey(
      manifest,
      shape,
      displayId,
      `${VIRTUAL_NUMERIC_KEY_ID}${digit}`,
      activationFixtureActionLabel(shape, purpose, index + 1),
    );
  }
}

async function runActivationFixtureInput(manifest, shape, appName, fixtureKey, expectedStatus = 'ENABLED') {
  if (!APPS[appName]) fail('VK_ANDROID_ACTIVATION_APP_INVALID');
  if (!['ENABLED', 'DISABLED'].includes(expectedStatus)) fail('VK_ANDROID_ACTIVATION_FIXTURE_STATUS_INVALID');
  requireOwnedApp(manifest, shape, appName);
  const fixtureContract = readRepositoryJson(
    path.join(ROOT, 'doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json'),
  );
  const fixture = fixtureContract.stableFixtures?.organization?.storeTerminals?.find(value => value.key === fixtureKey);
  const expectedDeviceType = shape === 'dual' ? 'laptop' : 'mobile';
  if (
    fixture?.status !== expectedStatus ||
    fixture.deviceType !== expectedDeviceType ||
    !/^\d{8}$/.test(fixture.activationCode ?? '')
  ) {
    fail('VK_ANDROID_ACTIVATION_FIXTURE_INVALID');
  }

  const device = deviceFor(manifest, shape);
  const display = logicalDisplayFor(manifest, shape, 'primary');
  let {xml} = await uiDump(manifest, device, display.id);
  if (parseResourceNode(xml, TERMINAL_ACTIVATION_SCREEN_ID, display.id) === null)
    fail('VK_ANDROID_ACTIVATION_SCREEN_NOT_VISIBLE');
  await clearActivationCodeInput(manifest, shape, appName, 0);
  ({xml} = await uiDump(manifest, device, display.id));
  if (parseResourceTextValue(xml, TERMINAL_ACTIVATION_INPUT_ID, display.id) !== '')
    fail('VK_ANDROID_ACTIVATION_INPUT_CLEAR_FAILED');
  const leadingZeroValue = '01234567';
  await enterActivationDigits(manifest, shape, display.id, leadingZeroValue, 'leading-zero');
  ({xml} = await uiDump(manifest, device, display.id));
  const observedLeadingZeroValue = parseResourceTextValue(xml, TERMINAL_ACTIVATION_INPUT_ID, display.id);
  const leadingZeroReadback = Object.freeze({
    ...activationInputBoundaryReadback({expectedValue: leadingZeroValue, observedValue: observedLeadingZeroValue}),
    at: now(),
  });
  manifest.activationBoundaryReadback = leadingZeroReadback;
  appendEvent(manifest, 'ACTIVATION_BOUNDARY_READBACK', leadingZeroReadback);
  saveManifest(manifest);
  if (!leadingZeroReadback.exactMatch)
    fail('VK_ANDROID_ACTIVATION_LEADING_ZERO_NOT_PRESERVED');
  await tapActivationKey(
    manifest,
    shape,
    display.id,
    `${VIRTUAL_NUMERIC_KEY_ID}9`,
    activationFixtureActionLabel(shape, 'overlength', 1),
  );
  ({xml} = await uiDump(manifest, device, display.id));
  if (parseResourceTextValue(xml, TERMINAL_ACTIVATION_INPUT_ID, display.id) !== leadingZeroValue)
    fail('VK_ANDROID_ACTIVATION_OVERLENGTH_ACCEPTED');

  await clearActivationCodeInput(manifest, shape, appName, 1);
  ({xml} = await uiDump(manifest, device, display.id));
  if (parseResourceTextValue(xml, TERMINAL_ACTIVATION_INPUT_ID, display.id) !== '')
    fail('VK_ANDROID_ACTIVATION_INPUT_CLEAR_FAILED');

  await enterActivationDigits(manifest, shape, display.id, fixture.activationCode, 'fixture');
  ({xml} = await uiDump(manifest, device, display.id));
  const evidence = activationFixtureInputEvidence({
    fixtureKey,
    expectedCode: fixture.activationCode,
    observedValue: parseResourceTextValue(xml, TERMINAL_ACTIVATION_INPUT_ID, display.id),
  });
  if (!evidence.matched) fail('VK_ANDROID_ACTIVATION_FIXTURE_INPUT_MISMATCH');
  const submit = parseResourceNode(xml, 'terminal.activation.submit', display.id);
  if (!submit?.enabled) fail('VK_ANDROID_ACTIVATION_SUBMIT_NOT_ENABLED');

  manifest.activationFixtureInput = Object.freeze({
    fixtureKey,
    expectedStatus,
    shape,
    appName,
    expectedDigitCount: evidence.expectedDigitCount,
    observedDigitCount: evidence.observedDigitCount,
    leadingZeroPreserved: true,
    overlengthRejected: true,
    inputClearedAfterBoundaryProbe: true,
    matched: true,
    at: now(),
  });
  manifest.lastKnownGood = 'activation-fixture-input-ready';
  appendEvent(manifest, 'ACTIVATION_FIXTURE_INPUT_VERIFIED', {
    fixtureKey,
    expectedStatus,
    shape,
    appName,
    digitCount: evidence.observedDigitCount,
    leadingZeroPreserved: true,
    overlengthRejected: true,
  });
  saveManifest(manifest);
  process.stdout.write(
    `ACTIVATION_FIXTURE_INPUT=PASS\nFIXTURE_KEY=${fixtureKey}\nDIGIT_COUNT=${evidence.observedDigitCount}\nLEADING_ZERO=PASS\nOVERLENGTH=REJECTED\nVALUE_REDACTED=true\n`,
  );
}

async function seedW7Clipboard(manifest, shape, appName, sourceResourceId, targetResourceId, surface = 'primary') {
  requireOwnedApp(manifest, shape, appName);
  if (sourceResourceId !== 'sample.auth.login:operator-name' || targetResourceId !== sourceResourceId) {
    fail('VK_ANDROID_W7_CLIPBOARD_FIELDS_INVALID');
  }
  const device = deviceFor(manifest, shape);
  const display = logicalDisplayFor(manifest, shape, surface);

  const readSourceHash = async () => {
    const observation = await uiDump(manifest, device, display.id);
    return parseResourceTextValue(observation.xml, sourceResourceId, display.id);
  };
  await tapResource(manifest, shape, sourceResourceId, surface);
  await adbText(manifest, device, `${shape}-w7-clipboard-empty-source`, w7ClearInputArgs(display.id));
  if ((await readSourceHash()) !== sha256('')) fail('VK_ANDROID_W7_SOURCE_FIELD_NOT_EMPTY');
  const seeded = await typeW7Probe(manifest, device, display.id, sourceResourceId);
  if (seeded.valueMatched !== true) fail('VK_ANDROID_W7_SOURCE_SENTINEL_NOT_OBSERVED');
  await adbText(manifest, device, `${shape}-w7-clipboard-select-source`, w7ClipboardKeyArgs('select-all', display.id));
  await adbText(manifest, device, `${shape}-w7-clipboard-copy-source`, w7ClipboardKeyArgs('copy', display.id));
  await adbText(manifest, device, `${shape}-w7-clipboard-empty-source-before-paste`, w7ClearInputArgs(display.id));
  if ((await readSourceHash()) !== sha256('')) fail('VK_ANDROID_W7_SOURCE_CLEAR_BEFORE_PASTE_FAILED');
  await adbText(manifest, device, `${shape}-w7-clipboard-paste-source`, w7ClipboardKeyArgs('paste', display.id));
  if ((await readSourceHash()) !== W7_CLIPBOARD_SENTINEL) {
    fail('VK_ANDROID_W7_CLIPBOARD_NONEMPTY_NOT_PROVEN');
  }
  await adbText(manifest, device, `${shape}-w7-clipboard-empty-source-after-paste`, w7ClearInputArgs(display.id));
  if ((await readSourceHash()) !== sha256('')) fail('VK_ANDROID_W7_CLIPBOARD_SEED_CLEANUP_FAILED');

  const proof = {
    shape,
    appName,
    sourceResourceId,
    targetResourceId,
    displayId: display.id,
    clipboardNonEmptyProvenBySameFieldCopyPaste: true,
    clearMethod: 'bounded-KEYCODE_DEL-sequence',
    sentinelSha256: sha256(W7_CLIPBOARD_SENTINEL),
    inputFieldsRestoredEmpty: true,
    at: now(),
  };
  manifest.w7ClipboardPreconditions ??= [];
  manifest.w7ClipboardPreconditions.push(proof);
  appendEvent(manifest, 'W7_CLIPBOARD_NONEMPTY_PROVEN_BY_CONTROLLED_PASTE', {
    shape,
    appName,
    sourceResourceId,
    targetResourceId,
    displayId: display.id,
    sentinelSha256: proof.sentinelSha256,
  });
  saveManifest(manifest);
  process.stdout.write(`W7_CLIPBOARD_PRECONDITION=PASS\nSHAPE=${shape}\nAPP=${appName}\nVALUE_REDACTED=true\n`);
}

async function longPressW7Input(manifest, shape, appName, resourceId, state, surface = 'primary') {
  requireOwnedApp(manifest, shape, appName);
  if (!W7_INPUT_RESOURCE_IDS.has(resourceId)) fail('VK_ANDROID_W7_RESOURCE_ID_OUT_OF_SCOPE');
  if (!['empty', 'existing-text'].includes(state)) fail('VK_ANDROID_W7_TEXT_STATE_INVALID');
  const device = deviceFor(manifest, shape);
  const display = logicalDisplayFor(manifest, shape, surface);
  const clipboardReady = manifest.w7ClipboardPreconditions?.some(
    item => item.shape === shape && item.appName === appName && item.displayId === display.id,
  );
  if (!clipboardReady) fail('VK_ANDROID_W7_CLIPBOARD_PRECONDITION_REQUIRED');

  await tapResource(manifest, shape, resourceId, surface);
  let before = await uiDump(manifest, device, display.id);
  let observedValue = parseResourceTextValue(before.xml, resourceId, display.id);
  if (state === 'empty' && observedValue !== '') fail('VK_ANDROID_W7_EXPECTED_EMPTY_FIELD');
  if (state === 'existing-text' && observedValue === '') {
    const seeded = await typeW7Probe(manifest, device, display.id, resourceId, before.xml);
    before = {xml: seeded.xml, displayId: display.id};
    observedValue = parseResourceTextValue(before.xml, resourceId, display.id);
    const secureField = resourceId === 'sample.auth.login:passcode';
    const expectedValue = W7_PROBE_TEXT_BY_RESOURCE_ID[resourceId];
    if (secureField ? observedValue === '' : observedValue !== expectedValue) {
      fail('VK_ANDROID_W7_EXISTING_TEXT_PROBE_MISMATCH');
    }
  }
  const node = parseResourceNode(before.xml, resourceId, display.id);
  if (!node?.enabled || node.right <= node.left || node.bottom <= node.top)
    fail('VK_ANDROID_RESOURCE_NODE_NOT_ACTIONABLE');
  const focused = parseResourceUiState(before.xml, resourceId, display.id)?.focused === true;
  if (!focused) fail('VK_ANDROID_W7_TARGET_NOT_FOCUSED');

  await adbText(
    manifest,
    device,
    `${shape}-w7-long-press-${resourceId.replaceAll(':', '-')}-${state}`,
    w7LongPressArgs(display.id, node),
  );
  const after = await uiDump(manifest, device, display.id);
  const contextMenu = parseTextInputContextMenu(after.xml, display.id);
  const observedStateValue = parseResourceTextValue(after.xml, resourceId, display.id);
  if (observedStateValue !== observedValue) fail('VK_ANDROID_W7_FIELD_VALUE_CHANGED');
  const observation = {
    shape,
    appName,
    surface,
    displayId: display.id,
    resourceId,
    state,
    valuePreserved: true,
    contextMenu,
    visibleNodeCount: parseVisibleControlInventory(after.xml, display.id).length,
    at: now(),
  };
  manifest.w7ContextMenuObservations ??= [];
  manifest.w7ContextMenuObservations.push(observation);
  appendEvent(manifest, 'W7_TEXTINPUT_LONG_PRESS_OBSERVED', {
    shape,
    appName,
    surface,
    displayId: display.id,
    resourceId,
    state,
    valuePreserved: true,
    contextMenuVisible: contextMenu.visible,
    contextMenuActionIds: contextMenu.actions,
    floatingToolbar: contextMenu.floatingToolbar,
  });
  saveManifest(manifest);
  if (contextMenu.visible) fail('VK_ANDROID_W7_SYSTEM_CONTEXT_MENU_VISIBLE');
  process.stdout.write(
    `W7_LONG_PRESS=PASS\nSHAPE=${shape}\nAPP=${appName}\nFIELD=${resourceId}\nSTATE=${state}\nDISPLAY=${display.id}\nCONTEXT_MENU=ABSENT\nTEXT_VALUE_REDACTED=true\n`,
  );
}

async function triggerAdminLauncherGesture(manifest, shape, surface = 'primary') {
  requireOwnedApp(manifest, shape);
  const device = deviceFor(manifest, shape);
  if (surface === 'secondary' && shape !== 'dual') fail('VK_ANDROID_SECONDARY_SURFACE_UNAVAILABLE');
  const logical = surface === 'primary' ? device.inventory.pairing?.primary : device.inventory.pairing?.secondary;
  const actual =
    logical ??
    validateDeviceShape({shape, logical: device.inventory.logical, surfaces: device.inventory.surfaces})[surface];
  const {xml} = await uiDump(manifest, device, actual.id);
  const launcher = parseResourceNode(xml, 'terminal.admin:launcher', actual.id);
  if (!launcher || !launcher.enabled || launcher.right <= launcher.left || launcher.bottom <= launcher.top) {
    fail('VK_ANDROID_ADMIN_LAUNCHER_NOT_OBSERVED');
  }
  for (const plan of adminLauncherTapPlan(actual.id)) {
    await adbText(manifest, device, `${shape}-admin-launch-gesture-${plan.tapIndex}`, plan.args);
    appendEvent(manifest, 'ADMIN_LAUNCH_GESTURE_TAP', {
      shape,
      surface,
      displayId: actual.id,
      tapIndex: plan.tapIndex,
      x: ADMIN_LAUNCH_GESTURE_TAP.x,
      y: ADMIN_LAUNCH_GESTURE_TAP.y,
    });
  }
  manifest.lastKnownGood = `${shape}-admin-launch-gesture`;
  saveManifest(manifest);
  process.stdout.write(`ADMIN_LAUNCH_GESTURE=PASS\nTAPS=${ADMIN_LAUNCH_GESTURE_TAP.repetitions}\n`);
}

async function tapNodeCenter(manifest, device, displayId, node, label) {
  if (!node?.enabled || node.right <= node.left || node.bottom <= node.top)
    fail('VK_ANDROID_RESOURCE_NODE_NOT_ACTIONABLE');
  const x = Math.floor((node.left + node.right) / 2);
  const y = Math.floor((node.top + node.bottom) / 2);
  await adbText(manifest, device, label, ['shell', 'input', '-d', String(displayId), 'tap', String(x), String(y)]);
}

async function recordTransition(manifest, shape, appName, iaId, resourceId, surface = 'primary') {
  requireOwnedApp(manifest, shape, appName);
  if (surface !== 'primary') fail('VK_ANDROID_TRANSITION_VIDEO_PRIMARY_ONLY');
  const device = deviceFor(manifest, shape);
  const priorPairing = validateDeviceShape({
    shape,
    logical: device.inventory.logical,
    surfaces: device.inventory.surfaces,
  });
  const priorLogical = priorPairing.primary;
  const {xml: initialXml} = await uiDump(manifest, device, priorLogical.id);
  const app = APPS[appName];
  const windowIdentity = parseDisplayWindowIdentity(initialXml, priorLogical.id, app.packageName);
  const logicalText = await adbText(
    manifest,
    device,
    `${shape}-${appName}-${iaId}-transition-logical`,
    ['shell', 'cmd', 'display', 'get-displays'],
    {maxBytes: 12 * 1024 * 1024},
  );
  const displayDumpText = await adbText(
    manifest,
    device,
    `${shape}-${appName}-${iaId}-transition-display-dump`,
    ['shell', 'dumpsys', 'display'],
    {maxBytes: 12 * 1024 * 1024},
  );
  const surfaceDumpText = await adbText(
    manifest,
    device,
    `${shape}-${appName}-${iaId}-transition-surfaceflinger`,
    ['shell', 'dumpsys', 'SurfaceFlinger', '--displays'],
    {maxBytes: 12 * 1024 * 1024},
  );
  const inventory = resolveCaptureDisplayInventory(shape, logicalText, displayDumpText, surfaceDumpText);
  const logical = inventory.pairing.primary;
  const sf = inventory.pairing.primarySurface;
  if (logical.id !== priorLogical.id || logical.uniqueId !== priorLogical.uniqueId)
    fail('VK_ANDROID_CAPTURE_SURFACE_IDENTITY_CHANGED');
  const videoFile = screenshotPath(manifest, iaId, shape, appName, surface).replace(/\.png$/, '-transition.mp4');
  const stem = videoFile.replace(/\.mp4$/, '');
  const remoteStamp = Date.now();
  const remoteVideo = `/sdcard/${manifest.runId}-${shape}-${remoteStamp}-transition.mp4`;
  const remoteLog = `/sdcard/${manifest.runId}-${shape}-${remoteStamp}-transition.log`;
  const preexisting = await remoteNamedProcessIdentity(manifest, device, 'screenrecord');
  if (preexisting.processes.length > 0) fail('VK_ANDROID_PREEXISTING_SCREENRECORD_PROCESS');
  manifest.remoteTempFiles.push({host: device.serial, path: remoteVideo}, {host: device.serial, path: remoteLog});
  manifest.pendingRemoteCaptureProcesses.push({
    shape,
    host: device.serial,
    bootId: preexisting.bootId,
    executable: 'screenrecord',
    path: remoteVideo,
    startedAt: now(),
  });
  saveManifest(manifest);

  const launchOutput = await launchRemoteScreenrecord(manifest, device, appName, iaId, sf.id, remoteVideo, remoteLog);
  const recorderPid = Number(launchOutput.trim().split(/\s+/).at(-1));
  if (!Number.isSafeInteger(recorderPid) || recorderPid <= 0) fail('VK_ANDROID_SCREENRECORD_PID_UNREADABLE');
  const pending = manifest.pendingRemoteCaptureProcesses.find(item => item.path === remoteVideo);
  if (!pending) fail('VK_ANDROID_SCREENRECORD_INTENT_MISSING');
  pending.requestedPid = recorderPid;
  saveManifest(manifest);
  const recorderIdentity = await remotePidIdentity(manifest, device, recorderPid, 'screenrecord', remoteVideo);
  if (recorderIdentity.bootId !== preexisting.bootId || recorderIdentity.process?.pid !== recorderPid)
    fail('VK_ANDROID_SCREENRECORD_OWNERSHIP_UNRESOLVED');
  manifest.pendingRemoteCaptureProcesses = manifest.pendingRemoteCaptureProcesses.filter(
    item => item.path !== remoteVideo,
  );
  const owned = {
    shape,
    host: device.serial,
    bootId: recorderIdentity.bootId,
    executable: 'screenrecord',
    pid: recorderPid,
    startTicks: recorderIdentity.process.startTicks,
    path: remoteVideo,
  };
  manifest.ownedRemoteCaptureProcesses.push(owned);
  saveManifest(manifest);
  await tapResource(manifest, shape, resourceId, surface);

  const deadline = performance.now() + 5000;
  let finishedIdentity = null;
  while (performance.now() < deadline) {
    const current = await remotePidIdentity(manifest, device, recorderPid, 'screenrecord', remoteVideo);
    if (current.bootId !== owned.bootId) fail('VK_ANDROID_SCREENRECORD_DEVICE_BOOT_CHANGED');
    if (current.process === null) {
      finishedIdentity = current;
      break;
    }
    if (current.process.startTicks !== owned.startTicks) fail('VK_ANDROID_SCREENRECORD_PID_REUSED');
    await sleep(100);
  }
  if (finishedIdentity === null) fail('VK_ANDROID_SCREENRECORD_DID_NOT_EXIT_WITHIN_BOUND');
  manifest.ownedRemoteCaptureProcesses = manifest.ownedRemoteCaptureProcesses.filter(item => item.path !== remoteVideo);
  const logText = await adbText(
    manifest,
    device,
    `${shape}-${appName}-${iaId}-transition-record-log`,
    ['shell', 'cat', remoteLog],
    {diagnosticOutput: 'omit'},
  );
  const remoteVideoBytes = await command(
    manifest,
    `${shape}-${appName}-${iaId}-transition-record-download`,
    'adb',
    adbArgs(device, ['exec-out', 'cat', remoteVideo]),
    {binary: true, maxBytes: 24 * 1024 * 1024, timeoutMs: 15_000},
  );
  if (remoteVideoBytes.length === 0) fail('VK_ANDROID_SCREENRECORD_EMPTY');
  fs.writeFileSync(videoFile, remoteVideoBytes, {mode: 0o600, flag: 'wx'});
  const remoteVideoSha256 = sha256(remoteVideoBytes);
  const probeText = await command(
    manifest,
    `${shape}-${appName}-${iaId}-transition-ffprobe`,
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,codec_type', '-of', 'json', videoFile],
    {maxBytes: 32 * 1024},
  );
  const probe = JSON.parse(probeText);
  const videoStream = probe.streams?.find(item => item.codec_type === 'video');
  const durationSeconds = Number(probe.format?.duration);
  if (
    !videoStream ||
    videoStream.width !== logical.width ||
    videoStream.height !== logical.height ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0.5
  ) {
    fail('VK_ANDROID_SCREENRECORD_GEOMETRY_OR_DURATION_INVALID');
  }
  const frameTimelineText = await command(
    manifest,
    `${shape}-${appName}-${iaId}-transition-frame-timeline`,
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'frame=best_effort_timestamp_time',
      '-of',
      'json',
      videoFile,
    ],
    {maxBytes: 256 * 1024},
  );
  const frameTimestamps = parseVideoFrameTimestamps(frameTimelineText);
  const decodableEndSeconds = frameTimestamps.at(-1);
  if (decodableEndSeconds < 0.5) fail('VK_ANDROID_SCREENRECORD_GEOMETRY_OR_DURATION_INVALID');
  const sampleDurationSeconds = Math.min(durationSeconds, decodableEndSeconds);
  const displayDumpPath = writeCaptureTextArtifact(`${stem}.dumpsys-display.txt`, displayDumpText);
  const surfaceDumpPath = writeCaptureTextArtifact(`${stem}.surfaceflinger-displays.txt`, surfaceDumpText);
  const logicalDumpPath = writeCaptureTextArtifact(`${stem}.cmd-display-get-displays.txt`, logicalText);
  const recordEvidencePath = `${stem}.transition-evidence.json`;
  const sampleOffsets = transitionVideoSampleOffsets(durationSeconds, frameTimestamps);
  const recordEvidence = {
    serial: device.serial,
    app: appName,
    packageName: app.packageName,
    activity: app.activity,
    shape,
    surface,
    iaId,
    triggerResourceId: resourceId,
    animationExpectation: {durationMs: 250, easing: 'Easing.inOut(Easing.quad)'},
    logicalDisplayId: logical.id,
    logicalName: logical.name,
    logicalUniqueId: logical.uniqueId,
    logicalResolution: `${logical.width}x${logical.height}`,
    surfaceFlingerId: sf.id,
    surfaceFlingerName: sf.name,
    windowIdentity,
    video: path.relative(ROOT, videoFile),
    videoBytes: remoteVideoBytes.length,
    videoSha256: remoteVideoSha256,
    videoDurationSeconds: durationSeconds,
    videoWidth: videoStream.width,
    videoHeight: videoStream.height,
    videoDecodableEndSeconds: decodableEndSeconds,
    sampleDurationSeconds,
    videoTimelineBinding: 'UNALIGNED_TO_TAP_EVENT',
    sampleTimeBasis: 'LAST_DECODED_VIDEO_FRAME',
    sampleTargets: sampleOffsets.map(item => ({
      index: item.index,
      offsetFromVideoStartMs: item.offsetFromVideoStartMs,
      animationProgress: null,
      status: 'OPEN_UNCALIBRATED_VIDEO_TIME',
    })),
    recorderExitIdentity: {
      host: finishedIdentity.host,
      bootId: finishedIdentity.bootId,
      pid: recorderPid,
      startTicks: owned.startTicks,
    },
    remoteLog: redact(logText),
    dumpsysDisplay: displayDumpPath,
    surfaceFlingerDisplays: surfaceDumpPath,
    logicalDisplayListing: logicalDumpPath,
    visualStatus: 'OPEN_REQUIRES_FULL_VIDEO_AND_PER_CONTROL_REVIEW',
  };
  writeJsonAtomic(recordEvidencePath, recordEvidence);

  const sampleFiles = [];
  for (const sample of sampleOffsets) {
    const index = sample.index - 1;
    const offsetSeconds = Number((sample.offsetFromVideoStartMs / 1000).toFixed(3));
    if (offsetSeconds >= sampleDurationSeconds) fail('VK_ANDROID_SCREENRECORD_SAMPLE_OUTSIDE_VIDEO');
    const frameFile = `${stem}-transition-${index + 1}.png`;
    await command(
      manifest,
      `${shape}-${appName}-${iaId}-transition-extract-${index + 1}`,
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-ss',
        String(offsetSeconds),
        '-i',
        videoFile,
        '-frames:v',
        '1',
        '-fps_mode',
        'passthrough',
        '-y',
        frameFile,
      ],
      {maxBytes: 32 * 1024},
    );
    if (!fs.existsSync(frameFile)) fail('VK_ANDROID_TRANSITION_FRAME_OUTPUT_MISSING');
    const frameBytes = fs.readFileSync(frameFile);
    const frameDimensions = pngDimensions(frameBytes);
    if (frameDimensions.width !== logical.width || frameDimensions.height !== logical.height)
      fail('VK_ANDROID_TRANSITION_FRAME_DIMENSIONS_INVALID');
    const fileDescription = await command(
      manifest,
      `${shape}-${appName}-${iaId}-transition-file-${index + 1}`,
      'file',
      [frameFile],
    );
    const fileInfo = parsePngFileDescription(fileDescription);
    if (fileInfo.width !== logical.width || fileInfo.height !== logical.height)
      fail('VK_ANDROID_TRANSITION_FRAME_FILE_INVALID');
    const relative = path.relative(ROOT, frameFile);
    const evidencePath = `${frameFile}.capture-evidence.json`;
    writeJsonAtomic(evidencePath, {
      ...recordEvidence,
      frame: sample.index,
      frameOffsetSeconds: offsetSeconds,
      frameFile: relative,
      fileDescription: fileInfo.description,
      visualStatus: 'OPEN_UNCALIBRATED_VIDEO_TIME',
    });
    const capture = {
      shape,
      serial: device.serial,
      model: device.inventory.model,
      app: appName,
      iaId,
      surface,
      logicalDisplayId: logical.id,
      logicalResolution: `${logical.width}x${logical.height}`,
      surfaceFlingerId: sf.id,
      screenshot: relative,
      captureEvidence: path.relative(ROOT, evidencePath),
      transitionVideo: path.relative(ROOT, videoFile),
      windowIdentity,
      fileDescription: fileInfo.description,
      sha256: sha256(frameBytes),
      bytes: frameBytes.length,
      elapsedMs: 0,
      state: `transition-video-sample-${sample.index}-uncalibrated`,
      transitionIndex: sample.index,
      controlsInventory: null,
      visibleControlCount: 0,
      visibleControls: [],
    };
    recordCapture(manifest, iaId, capture, 'PRODUCT_TRANSITION_SAMPLE');
    sampleFiles.push({
      index: sample.index,
      offsetFromVideoStartMs: sample.offsetFromVideoStartMs,
      offsetSeconds,
      screenshot: relative,
      captureEvidence: path.relative(ROOT, evidencePath),
    });
  }
  manifest.transitions ??= [];
  const transition = {
    shape,
    app: appName,
    iaId,
    surface,
    triggerResourceId: resourceId,
    status: 'CAPTURED_AWAITING_PER_CONTROL_AND_VIDEO_REVIEW',
    video: path.relative(ROOT, videoFile),
    evidence: path.relative(ROOT, recordEvidencePath),
    sampleFiles,
    animationDurationMs: 250,
    videoTimelineBinding: 'UNALIGNED_TO_TAP_EVENT',
    captureWindowStatus: 'VIDEO_CAPTURED_UNALIGNED',
    visualStatus: 'OPEN_REQUIRES_FULL_VIDEO_AND_PER_CONTROL_REVIEW',
  };
  manifest.transitions.push(transition);
  manifest.visual = 'OPEN';
  appendEvent(manifest, 'TRANSITION_VIDEO_CAPTURED', {
    shape,
    app: appName,
    iaId,
    surface,
    sampleCount: sampleFiles.length,
    visualStatus: 'OPEN',
  });
  saveManifest(manifest);
  await adbText(manifest, device, `${shape}-transition-remove-video`, ['shell', 'rm', '-f', remoteVideo, remoteLog]);
  manifest.remoteTempFiles = manifest.remoteTempFiles.filter(
    item => item.path !== remoteVideo && item.path !== remoteLog,
  );
  saveManifest(manifest);
  process.stdout.write(
    `TRANSITION_VIDEO=${path.relative(ROOT, videoFile)}\nTRANSITION_SAMPLES=${sampleFiles.length}\nVIDEO_TIMING=UNALIGNED_TO_TAP_EVENT\nVISUAL=OPEN\n`,
  );
}

async function insertUrlSymbolSequence(manifest, shape, appName) {
  const surface = 'primary';
  const ownedApp = requireOwnedApp(manifest, shape, appName);
  const device = deviceFor(manifest, shape);
  const pairing = validateDeviceShape({shape, logical: device.inventory.logical, surfaces: device.inventory.surfaces});
  const display = pairing.primary;
  const beforeRoute = await remoteProcessIdentity(manifest, device, ownedApp.packageName);
  if (!remoteProcessIdentityMatches(ownedApp, beforeRoute, device.serial))
    fail('VK_ANDROID_CONTROLLED_HARNESS_APP_IDENTITY_CHANGED_BEFORE_ROUTE');
  const intentResult = await adbText(
    manifest,
    device,
    `${shape}-${appName}-controlled-harness-view-intent`,
    controlledKeyboardHarnessIntentArgs(APPS[appName].activity),
  );
  if (!/Status:\s*ok/.test(intentResult)) fail('VK_ANDROID_CONTROLLED_HARNESS_VIEW_INTENT_FAILED');
  const afterRoute = await remoteProcessIdentity(manifest, device, ownedApp.packageName);
  if (!remoteProcessIdentityMatches(ownedApp, afterRoute, device.serial))
    fail('VK_ANDROID_CONTROLLED_HARNESS_APP_IDENTITY_CHANGED_AFTER_ROUTE');
  manifest.controlledHarnessEntries ??= [];
  manifest.controlledHarnessEntries.push({
    shape,
    app: appName,
    surface,
    route: CONTROLLED_KEYBOARD_HARNESS_URL,
    enteredAt: now(),
    appIdentity: {host: ownedApp.host, bootId: ownedApp.bootId, processes: ownedApp.processes},
  });
  appendEvent(manifest, 'CONTROLLED_KEYBOARD_HARNESS_ENTERED', {
    shape,
    app: appName,
    surface,
    route: CONTROLLED_KEYBOARD_HARNESS_URL,
    submitted: false,
  });
  saveManifest(manifest);
  let {xml} = await uiDump(manifest, device, display.id);
  const emptyHash = sha256('');
  const harnessField = resolveUrlSymbolHarnessField(xml, display.id);
  manifest.businessChecks ??= [];
  if (harnessField === null) {
    fail('VK_ANDROID_CONTROLLED_HARNESS_FIELD_NOT_OBSERVED');
  }
  parseDisplayWindowIdentity(xml, display.id, APPS[appName].packageName);
  if (harnessField.textSha256 !== emptyHash) fail('VK_ANDROID_CONTROLLED_HARNESS_FIELD_NOT_EMPTY');
  await tapResource(manifest, shape, harnessField.fieldId, surface);

  ({xml} = await uiDump(manifest, device, display.id));
  const shiftId = 'ui.base.input:virtual-keyboard:shift';
  const shift = parseResourceNode(xml, shiftId, display.id);
  const keys = URL_SYMBOL_KEYS.map(item => ({
    ...item,
    id: `ui.base.input:virtual-keyboard:${item.keyId}`,
    node: parseResourceNode(xml, `ui.base.input:virtual-keyboard:${item.keyId}`, display.id),
  }));
  if (!shift || !shift.enabled || keys.some(item => !item.node?.enabled)) fail('VK_ANDROID_URL_SYMBOL_KEYS_NOT_READY');
  for (const item of keys) {
    const digit = item.keyId.slice('text-'.length);
    if (parseResourceContentDescriptionHash(xml, item.id, display.id) !== sha256(digit))
      fail('VK_ANDROID_URL_SYMBOL_NUMERIC_BASELINE_MISMATCH');
  }
  await tapNodeCenter(manifest, device, display.id, shift, 'url-symbol-sequence-shift-01');
  ({xml} = await uiDump(manifest, device, display.id));
  const shiftedShift = parseResourceNode(xml, shiftId, display.id);
  if (!shiftedShift?.enabled || !shiftedShift.selected) fail('VK_ANDROID_URL_SYMBOL_SHIFT_STATE_NOT_SELECTED');
  const shiftedKeys = keys.map(item => ({...item, node: parseResourceNode(xml, item.id, display.id)}));
  if (shiftedKeys.some((item, index) => !item.node?.enabled || !sameResourceNodeBounds(item.node, keys[index].node))) {
    fail('VK_ANDROID_URL_SYMBOL_KEY_GEOMETRY_CHANGED');
  }
  for (const item of shiftedKeys) {
    if (parseResourceContentDescriptionHash(xml, item.id, display.id) !== sha256(item.value))
      fail('VK_ANDROID_URL_SYMBOL_KEY_LABEL_MISMATCH');
  }
  const shiftFrame = shape === 'dual' ? 'VK-IA-09' : 'VK-IA-10';
  await capture(manifest, shape, appName, shiftFrame, surface, 'url-symbol-shift-state', null, 'CONTROLLED_HARNESS');

  for (let index = 0; index < shiftedKeys.length; index += 1) {
    await tapNodeCenter(
      manifest,
      device,
      display.id,
      shiftedKeys[index].node,
      `url-symbol-sequence-key-${String(index + 1).padStart(2, '0')}`,
    );
    if (index < shiftedKeys.length - 1)
      await tapNodeCenter(
        manifest,
        device,
        display.id,
        shiftedShift,
        `url-symbol-sequence-shift-${String(index + 2).padStart(2, '0')}`,
      );
  }
  ({xml} = await uiDump(manifest, device, display.id));
  const observedSha256 = parseHarnessTextHash(xml, harnessField.fieldId, display.id);
  const expectedSha256 = sha256(URL_SYMBOL_SEQUENCE);
  const matched = observedSha256 === expectedSha256;
  manifest.businessChecks ??= [];
  const check = {
    name: 'URL_SYMBOL_INSERTION_SEQUENCE',
    status: matched ? 'PASS' : 'FAIL',
    shape,
    app: appName,
    surface,
    fieldId: harnessField.fieldId,
    expectedSha256,
    observedSha256,
    symbolCount: URL_SYMBOL_KEYS.length,
    shiftTapCount: URL_SYMBOL_KEYS.length,
    submitted: false,
    at: now(),
  };
  manifest.businessChecks.push(check);
  appendEvent(manifest, 'URL_SYMBOL_INSERTION_CHECK', {
    status: check.status,
    shape,
    app: appName,
    surface,
    symbolCount: check.symbolCount,
    submitted: false,
  });
  saveManifest(manifest);
  process.stdout.write(`BUSINESS_CHECK=${check.status}\nSYMBOLS_VERIFIED=${check.symbolCount}\nSUBMITTED=false\n`);
  if (!matched) fail('VK_ANDROID_URL_SYMBOL_INSERTION_MISMATCH');
}

async function recoverInvalidatedLaunchOwnership(manifest) {
  const recoveredIntentIds = new Set((manifest.historicalRemoteLaunchRecoveries ?? []).map(value => value.intentId));
  const candidates = (manifest.resolvedRemoteLaunches ?? []).filter(
    value => value.resolution === 'PROCESS_ABSENT' && !recoveredIntentIds.has(value.intentId),
  );
  if (candidates.length === 0) fail('VK_ANDROID_NO_INVALIDATED_LAUNCH_TO_RECOVER');

  for (const intent of candidates) {
    const device = deviceFor(manifest, intent.shape);
    const observed = await remoteProcessIdentity(manifest, device, intent.packageName);
    const resolution = resolveInvalidatedRemoteLaunch(manifest, intent.intentId, observed);
    appendEvent(manifest, 'HISTORICAL_LAUNCH_OWNERSHIP_RECOVERED', {
      intentId: intent.intentId,
      shape: intent.shape,
      appName: intent.appName,
      resolution,
      processCount: observed.processes.length,
    });
    saveManifest(manifest);
  }
  return candidates.length;
}

function recoverPriorRunTunnelMappings(manifest, sourceRunId) {
  if (!sourceRunId) return;
  safeRunId(sourceRunId);
  const sourcePath = path.join(RUNTIME_ROOT, sourceRunId, 'run-manifest.json');
  if (!fs.existsSync(sourcePath)) fail('VK_ANDROID_TUNNEL_RECOVERY_SOURCE_MISSING');
  const source = readRepositoryJson(sourcePath);
  if (source.runId !== sourceRunId || source.tool !== 'scripts/test/ter-virtual-keyboard-android.mjs')
    fail('VK_ANDROID_TUNNEL_RECOVERY_SOURCE_INVALID');
  const sourceLog = path.join(EVIDENCE_ROOT, sourceRunId, 'logs', 'commands.jsonl');
  if (!fs.existsSync(sourceLog) || !fs.realpathSync(sourceLog).startsWith(`${fs.realpathSync(EVIDENCE_ROOT)}${path.sep}`))
    fail('VK_ANDROID_TUNNEL_RECOVERY_EVIDENCE_MISSING');
  const rows = fs.readFileSync(sourceLog, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const devManifest = readRepositoryJson(managedDevManifestFile());
  const packageConfig = readRepositoryJson(path.join(ROOT, APPS['sample-terminal'].androidRoot, '..', 'package.json'));
  const routes = validateDevTunnelRouteInputs({appName: 'sample-terminal', packageConfig, devManifest});
  for (const shape of ['dual', 'mobile']) {
    const oldDevice = source.devices?.[shape];
    const device = deviceFor(manifest, shape);
    if (oldDevice?.serial !== device.serial || oldDevice.inventory?.bootId !== device.inventory?.bootId) continue;
    for (const route of routes) {
      const create = rows.find(row => row.label === `${shape}-dev-tunnel-reverse-create-${route.devicePort}` && row.exitCode === 0);
      const readback = rows.find(row => row.label === `${shape}-dev-tunnel-reverse-readback-${route.devicePort}` && row.exitCode === 0);
      if (!create || !readback) continue;
      const oldRoute = parseAdbReverseList(readback.stdout).filter(
        item => item.deviceSocket === `tcp:${route.devicePort}` && item.hostSocket === `tcp:${route.hostPort}`,
      );
      if (oldRoute.length !== 1 || manifest.devTunnelMappings.some(item => item.shape === shape && item.devicePort === route.devicePort))
        continue;
      manifest.devTunnelMappings.push({
        shape,
        appName: 'sample-terminal',
        serial: device.serial,
        deviceBootId: device.inventory.bootId,
        devicePort: route.devicePort,
        hostPort: route.hostPort,
        devRunId: devManifest.runId,
        status: 'OWNED',
        recoveredFromRunId: sourceRunId,
      });
      appendEvent(manifest, 'DEV_TUNNEL_PRIOR_RUN_MAPPING_RECOVERED', {
        sourceRunId,
        shape,
        serial: device.serial,
        deviceBootId: device.inventory.bootId,
        devicePort: route.devicePort,
      });
    }
  }
  saveManifest(manifest);
}

async function cleanupWithOptionalHistoricalRecovery(manifest, enabled, tunnelSourceRunId = null) {
  if (!enabled && !tunnelSourceRunId) return doCleanup(manifest);
  manifest.phase = 'CLEANUP_RECOVERY';
  manifest.status = 'RUNNING';
  manifest.cleanup = 'RUNNING';
  saveManifest(manifest);
  try {
    const recoveredLaunchCount = enabled ? await recoverInvalidatedLaunchOwnership(manifest) : 0;
    recoverPriorRunTunnelMappings(manifest, tunnelSourceRunId);
    appendEvent(manifest, 'HISTORICAL_CLEANUP_RECOVERY_READY', {recoveredLaunchCount, tunnelSourceRunId});
    saveManifest(manifest);
    return await doCleanup(manifest);
  } catch (error) {
    manifest.cleanup = 'FAIL';
    manifest.status = 'CLEANUP_REQUIRED';
    manifest.phase = 'CLEANUP_FAILED';
    manifest.cleanupFailures = [error.message];
    manifest.finishedAt = now();
    appendEvent(manifest, 'HISTORICAL_CLEANUP_RECOVERY_FAILED', {failureCode: error.message});
    saveManifest(manifest);
    throw error;
  }
}

async function doCleanup(manifest) {
  manifest.phase = 'CLEANUP';
  manifest.status = 'RUNNING';
  manifest.cleanup = 'RUNNING';
  saveManifest(manifest);
  const failures = [];
  const localCleanup = await cleanupRecordedLocalCommand(manifest);
  if (localCleanup.status !== 'PASS') failures.push(localCleanup.reason);
  if (localCleanup.status === 'PASS') {
    for (const intent of [...manifest.pendingRemoteCaptureProcesses]) {
      try {
        const device = deviceFor(manifest, intent.shape);
        if (!Number.isSafeInteger(intent.requestedPid) || intent.requestedPid <= 0) {
          const processTable = await adbText(
            manifest,
            device,
            `${intent.shape}-pending-screenrecord-process-table`,
            ['shell', 'ps', '-A', '-o', 'PID,ARGS'],
            {
              maxBytes: 4 * 1024 * 1024,
              diagnosticOutput: 'sanitized',
            },
          );
          if (screenrecordProcessUsesPath(processTable, intent.path))
            throw new Error('VK_ANDROID_PENDING_SCREENRECORD_OWNERSHIP_UNRESOLVED');
          appendEvent(manifest, 'REMOTE_CAPTURE_START_ABANDONED_WITHOUT_PID', {
            shape: intent.shape,
            host: intent.host,
            path: intent.path,
          });
          manifest.pendingRemoteCaptureProcesses = manifest.pendingRemoteCaptureProcesses.filter(
            value => value.path !== intent.path,
          );
          saveManifest(manifest);
          continue;
        }
        const current = await remotePidIdentity(manifest, device, intent.requestedPid, intent.executable, intent.path);
        if (current.host !== intent.host || current.bootId !== intent.bootId)
          throw new Error('VK_ANDROID_SCREENRECORD_BOOT_OR_HOST_CHANGED');
        if (current.process)
          manifest.ownedRemoteCaptureProcesses.push({
            shape: intent.shape,
            host: intent.host,
            bootId: intent.bootId,
            executable: intent.executable,
            pid: current.process.pid,
            startTicks: current.process.startTicks,
            path: intent.path,
          });
        manifest.pendingRemoteCaptureProcesses = manifest.pendingRemoteCaptureProcesses.filter(
          value => value.path !== intent.path,
        );
        saveManifest(manifest);
      } catch (error) {
        failures.push(error.message);
      }
    }
    for (const owned of [...manifest.ownedRemoteCaptureProcesses]) {
      try {
        const device = deviceFor(manifest, owned.shape);
        if (owned.host !== device.serial) throw new Error('VK_ANDROID_SCREENRECORD_HOST_CHANGED');
        const current = await remotePidIdentity(manifest, device, owned.pid, owned.executable, owned.path);
        if (current.host !== owned.host || current.bootId !== owned.bootId)
          throw new Error('VK_ANDROID_SCREENRECORD_BOOT_CHANGED');
        if (current.process && current.process.startTicks === owned.startTicks) {
          await adbText(manifest, device, `${owned.shape}-cleanup-owned-screenrecord`, [
            'shell',
            'kill',
            '-TERM',
            String(owned.pid),
          ]);
          const after = await remotePidIdentity(manifest, device, owned.pid, owned.executable, owned.path);
          if (
            after.host !== owned.host ||
            after.bootId !== owned.bootId ||
            (after.process && after.process.startTicks === owned.startTicks)
          ) {
            throw new Error('VK_ANDROID_OWNED_SCREENRECORD_STILL_RUNNING');
          }
        }
        manifest.ownedRemoteCaptureProcesses = manifest.ownedRemoteCaptureProcesses.filter(
          value => value.path !== owned.path,
        );
        saveManifest(manifest);
      } catch (error) {
        failures.push(error.message);
      }
    }
    for (const temp of [...manifest.remoteTempFiles]) {
      try {
        const device = Object.values(manifest.devices).find(value => value.serial === temp.host);
        if (!device) throw new Error('VK_ANDROID_TEMP_HOST_NOT_IN_MANIFEST');
        const expectedPath = new RegExp(
          `^/sdcard/${manifest.runId}-(dual|mobile)-\\d{13}(?:\\.xml|-transition\\.(?:mp4|log))$`,
        );
        if (!expectedPath.test(temp.path)) throw new Error('VK_ANDROID_TEMP_PATH_IDENTITY_MISMATCH');
        await adbText(manifest, device, `${device.shape}-cleanup-ui-xml`, ['shell', 'rm', '-f', temp.path]);
        manifest.remoteTempFiles = manifest.remoteTempFiles.filter(
          value => value.path !== temp.path || value.host !== temp.host,
        );
        saveManifest(manifest);
      } catch (error) {
        failures.push(error.message);
      }
    }
  }
  if (localCleanup.status === 'PASS') {
    for (const owned of [...manifest.ownedRemoteProcesses]) {
      try {
        const device = deviceFor(manifest, owned.shape);
        if (owned.host !== device.serial) throw new Error('VK_ANDROID_REMOTE_HOST_IDENTITY_CHANGED');
        const current = await remoteProcessIdentity(manifest, device, owned.packageName);
        if (current.host !== owned.host || current.bootId !== owned.bootId)
          throw new Error('VK_ANDROID_REMOTE_BOOT_OR_HOST_IDENTITY_CHANGED');
        if (current.processes.length > 0) {
          if (!remoteProcessIdentityMatches(owned, current, device.serial))
            throw new Error('VK_ANDROID_REMOTE_PROCESS_IDENTITY_CHANGED_NOT_STOPPED');
          await adbText(manifest, device, `${owned.shape}-${owned.appName}-cleanup-force-stop-owned`, [
            'shell',
            'am',
            'force-stop',
            owned.packageName,
          ]);
          const after = await remoteProcessIdentity(manifest, device, owned.packageName);
          if (after.host !== owned.host || after.bootId !== owned.bootId || after.processes.length > 0)
            throw new Error('VK_ANDROID_OWNED_APP_PROCESS_STILL_RUNNING');
        }
        manifest.ownedRemoteProcesses = manifest.ownedRemoteProcesses.filter(
          value =>
            !(value.host === owned.host && value.packageName === owned.packageName && value.appName === owned.appName),
        );
        saveManifest(manifest);
      } catch (error) {
        failures.push(error.message);
      }
    }
  }
  // Reverse mappings do not depend on app-process cleanup; always attempt the
  // exact run-owned routes, even if another cleanup branch already failed.
  failures.push(...(await cleanupDevTunnelMappings(manifest)));
  if (manifest.pendingRemoteLaunches.length > 0) failures.push('VK_ANDROID_REMOTE_LAUNCH_OWNERSHIP_UNRESOLVED');
  if (manifest.pendingRemoteCaptureProcesses.length > 0)
    failures.push('VK_ANDROID_REMOTE_CAPTURE_OWNERSHIP_UNRESOLVED');
  if (localCleanup.status === 'PASS') {
    for (const temp of manifest.remoteTempFiles) {
      if (!['dual', 'mobile'].some(shape => manifest.devices[shape].serial === temp.host))
        failures.push('VK_ANDROID_TEMP_HOST_NOT_IN_MANIFEST');
    }
    for (const owned of manifest.ownedRemoteProcesses) {
      if (owned.host !== manifest.devices[owned.shape].serial) failures.push('VK_ANDROID_REMOTE_HOST_IDENTITY_CHANGED');
    }
  }
  manifest.cleanup =
    failures.length === 0 &&
    manifest.pendingRemoteLaunches.length === 0 &&
    manifest.pendingRemoteCaptureProcesses.length === 0 &&
    manifest.remoteTempFiles.length === 0 &&
    manifest.ownedRemoteProcesses.length === 0 &&
    manifest.ownedRemoteCaptureProcesses.length === 0 &&
    manifest.devTunnelMappings.length === 0 &&
    manifest.processes.length === 0 &&
    manifest.activeProcessIdentity == null
      ? 'PASS'
      : 'FAIL';
  manifest.cleanupFailures = failures;
  manifest.status = manifest.cleanup === 'PASS' ? 'CLEANED' : 'CLEANUP_REQUIRED';
  manifest.phase = manifest.cleanup === 'PASS' ? 'CLEANED' : 'CLEANUP_FAILED';
  manifest.finishedAt = now();
  appendEvent(manifest, 'CLEANUP_FINISHED', {
    result: manifest.cleanup,
    failureCount: failures.length,
    failureCodes: failures,
  });
  saveManifest(manifest);
  if (manifest.cleanup !== 'PASS') fail('VK_ANDROID_CLEANUP_FAILED');
}

async function inspectResource(manifest, shape, resourceId, surface = 'primary') {
  requireOwnedApp(manifest, shape);
  const device = deviceFor(manifest, shape);
  const display = logicalDisplayFor(manifest, shape, surface);
  const {xml} = await uiDump(manifest, device, display.id);
  const normalizedResourceId = safeLabel(resourceId, 'VK_ANDROID_RESOURCE_ID_INVALID');
  const node = parseResourceNode(xml, normalizedResourceId, display.id);
  const uiState = parseResourceUiState(xml, normalizedResourceId, display.id);
  process.stdout.write(
    `${JSON.stringify({shape, surface, resourceId, displayId: display.id, found: node !== null, node, uiState})}\n`,
  );
}

async function sendW2TextProbe(manifest, shape, probe, surface = 'primary') {
  requireOwnedApp(manifest, shape);
  const device = deviceFor(manifest, shape);
  const display = logicalDisplayFor(manifest, shape, surface);
  const args = w2InputProbeArgs(probe, display.id);
  await adbText(manifest, device, `${shape}-w2-text-probe-${probe}`, args);
  const value = args.at(-1);
  manifest.w2InputProbes ??= [];
  manifest.w2InputProbes.push({
    probe,
    displayId: display.id,
    characterCount: value.length,
    dispatchAccepted: true,
    at: now(),
  });
  appendEvent(manifest, 'W2_TEXT_PROBE_SENT', {
    shape,
    probe,
    displayId: display.id,
    characterCount: value.length,
    dispatchAccepted: true,
  });
  saveManifest(manifest);
  process.stdout.write(`W2_TEXT_PROBE=DISPATCHED\nPROBE=${probe}\nCHARACTERS=${value.length}\nVALUE_REDACTED=true\n`);
}

async function sendW2HardwareKey(manifest, shape, key, surface = 'primary') {
  requireOwnedApp(manifest, shape);
  const device = deviceFor(manifest, shape);
  const display = logicalDisplayFor(manifest, shape, surface);
  await adbText(manifest, device, `${shape}-w2-hardware-key-${key}`, w2HardwareKeyArgs(key, display.id));
  appendEvent(manifest, 'W2_HARDWARE_KEY_SENT', {shape, key, displayId: display.id});
  saveManifest(manifest);
  process.stdout.write(`W2_HARDWARE_KEY=PASS\nKEY=${key}\nDISPLAY=${display.id}\n`);
}

async function authenticateAdminFromDisplayedCode(manifest, shape, appName, surface = 'primary') {
  requireOwnedApp(manifest, shape, appName);
  const device = deviceFor(manifest, shape);
  const display = logicalDisplayFor(manifest, shape, surface);
  const {xml} = await uiDump(manifest, device, display.id);
  const code = parseAdminDebugPassword(xml, display.id);
  for (let index = 0; index < code.length; index += 1) {
    const keyResourceId = `ui.base.input:virtual-keyboard:text-${code[index]}`;
    const current = await uiDump(manifest, device, display.id);
    const keyNode = parseResourceNode(current.xml, keyResourceId, display.id);
    if (!keyNode?.enabled) fail('VK_ANDROID_ADMIN_DEBUG_PASSWORD_KEY_NOT_ACTIONABLE');
    await tapNodeCenter(
      manifest,
      device,
      display.id,
      keyNode,
      `${shape}-admin-auth-digit-${String(index + 1).padStart(2, '0')}`,
    );
  }
  await tapResource(manifest, shape, 'terminal.admin:verify', surface);
  let authenticated = false;
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const current = await uiDump(manifest, device, display.id);
    if (parseResourceNode(current.xml, 'terminal.admin:shell', display.id) !== null) {
      authenticated = true;
      break;
    }
    await sleep(120);
  }
  if (!authenticated) fail('VK_ANDROID_ADMIN_AUTHENTICATION_NOT_CONFIRMED');
  appendEvent(manifest, 'W2_ADMIN_AUTHENTICATED', {shape, appName, displayId: display.id, digitCount: code.length});
  saveManifest(manifest);
  process.stdout.write('W2_ADMIN_AUTHENTICATION=PASS\nCODE_REDACTED=true\n');
}

async function diagnosePendingLaunch(manifest) {
  if (!Array.isArray(manifest.pendingRemoteLaunches) || manifest.pendingRemoteLaunches.length !== 1) {
    fail('VK_ANDROID_PENDING_LAUNCH_COUNT_INVALID');
  }
  const intent = manifest.pendingRemoteLaunches[0];
  const device = deviceFor(manifest, intent.shape);
  if (device.serial !== intent.host) fail('VK_ANDROID_PENDING_LAUNCH_HOST_MISMATCH');
  const observed = await remoteProcessIdentity(manifest, device, intent.packageName);
  if (observed.host !== intent.host || observed.bootId !== intent.bootId)
    fail('VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH');
  const logcat = await adbText(
    manifest,
    device,
    `${intent.shape}-${intent.appName}-launch-logcat-diagnostic`,
    [
      'shell',
      'logcat',
      '-d',
      '-t',
      '500',
      '-v',
      'brief',
      '-s',
      'TER-VK-LAUNCH:I',
      'TER-Splash:I',
      'AndroidRuntime:E',
      'ReactNativeJS:V',
      'ActivityManager:I',
      'ActivityTaskManager:I',
      'DEBUG:F',
      'libc:F',
      'crash_dump32:F',
      'crash_dump64:F',
      'tombstoned:F',
    ],
    {maxBytes: 4 * 1024 * 1024, diagnosticOutput: 'omit'},
  );
  const breadcrumbs = summarizeAppLaunchBreadcrumbs(logcat, intent.appName, intent.intentId);
  const signals = summarizeAndroidLaunchDiagnostics(
    logcat,
    intent.packageName,
    breadcrumbs.startupPid,
    intent.intentId,
  );
  const runtimeEvents = summarizeStructuredRuntimeDiagnostics(
    logcat,
    breadcrumbs.startupPid ? [breadcrumbs.startupPid] : [],
  );
  const javascriptErrors = summarizeJavaScriptRuntimeErrors(
    logcat,
    breadcrumbs.startupPid ? [breadcrumbs.startupPid] : [],
  );
  const resolution = resolvePendingRemoteLaunch(manifest, intent.intentId, observed);
  const diagnostic = {
    intentId: intent.intentId,
    shape: intent.shape,
    appName: intent.appName,
    host: intent.host,
    bootId: intent.bootId,
    observedProcessCount: observed.processes.length,
    resolution,
    signals,
    runtimeEvents,
    javascriptErrors,
    collectedAt: now(),
    ...breadcrumbs,
  };
  manifest.launchDiagnostics ??= [];
  manifest.launchDiagnostics.push(diagnostic);
  if (manifest.firstFailure) {
    recordFirstFailure(manifest, manifest.firstFailure.code, manifest.firstFailure.brokenBoundary);
  }
  appendEvent(manifest, 'PENDING_LAUNCH_DIAGNOSED', {
    shape: intent.shape,
    appName: intent.appName,
    resolution,
    observedProcessCount: observed.processes.length,
    fatalException: signals.fatalException,
    processDied: signals.processDied,
    exceptionTypeCount: signals.exceptionTypes.length,
    nativeFatalSignalCount: signals.nativeFatalSignals.length,
    appFrameCount: signals.appFrames.length,
    jsErrorSeen: signals.jsErrorSeen,
    runtimeEventCount: runtimeEvents.eventCount,
    jsErrorCount: javascriptErrors.errorCount,
    markerCount: breadcrumbs.markerCount,
    startupPid: breadcrumbs.startupPid,
  });
  saveManifest(manifest);
  process.stdout.write(`LAUNCH_DIAGNOSTIC=${JSON.stringify(diagnostic)}\n`);
}

export function resolveInspectableLaunch(manifest) {
  const absentLaunches = (manifest.resolvedRemoteLaunches ?? []).filter(item => item.resolution === 'PROCESS_ABSENT');
  const inspectedIds = new Set((manifest.launchLogInspections ?? []).map(item => item.intentId));
  const uninspected = absentLaunches.filter(item => !inspectedIds.has(item.intentId));
  if (uninspected.length === 0) {
    if (absentLaunches.length > 0) fail('VK_ANDROID_RESOLVED_LAUNCH_ALREADY_INSPECTED');
    fail('VK_ANDROID_RESOLVED_LAUNCH_COUNT_INVALID');
  }
  if (uninspected.length !== 1) fail('VK_ANDROID_RESOLVED_LAUNCH_COUNT_INVALID');
  return uninspected[0];
}

export function resolveLaunchLogReinspection(manifest, intentId) {
  if (!/^[A-Za-z0-9._-]{1,96}$/.test(intentId ?? '')) fail('VK_ANDROID_LAUNCH_INTENT_ID_INVALID');
  const matches = (manifest.resolvedRemoteLaunches ?? []).filter(item => item.intentId === intentId);
  if (matches.length !== 1) fail('VK_ANDROID_RESOLVED_LAUNCH_COUNT_INVALID');
  const intent = matches[0];
  if (intent.resolution !== 'PROCESS_ABSENT' || intent.processCount !== 0) {
    fail('VK_ANDROID_RESOLVED_LAUNCH_NOT_INSPECTABLE');
  }
  if ((manifest.launchLogReinspections ?? []).some(item => item.intentId === intentId)) {
    fail('VK_ANDROID_RESOLVED_LAUNCH_ALREADY_INSPECTED');
  }
  return intent;
}

export async function collectResolvedLaunchLogEvidence(
  manifest,
  intent,
  readAdbText = adbText,
  recordedStartupPid = null,
) {
  const app = APPS[intent?.appName];
  if (
    !app ||
    intent.packageName !== app.packageName ||
    !['dual', 'mobile'].includes(intent.shape) ||
    !/^[A-Za-z0-9._-]{1,96}$/.test(intent.intentId ?? '')
  )
    fail('VK_ANDROID_MANIFEST_APP_BINDING_INVALID');
  const device = deviceFor(manifest, intent.shape);
  if (device.serial !== intent.host || !/^[A-Za-z0-9-]{8,96}$/.test(intent.bootId ?? '')) {
    fail('VK_ANDROID_PENDING_LAUNCH_HOST_MISMATCH');
  }
  const bootId = (
    await readAdbText(
      manifest,
      device,
      `${intent.shape}-${intent.appName}-reinspection-boot-id`,
      ['shell', 'cat', '/proc/sys/kernel/random/boot_id'],
      {diagnosticOutput: 'omit', preserveLastKnownGood: true},
    )
  ).trim();
  if (bootId !== intent.bootId) fail('VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH');
  const epochLogcat = await readAdbText(
    manifest,
    device,
    `${intent.shape}-${intent.appName}-reinspection-epoch-logcat`,
    [
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
    ],
    {maxBytes: 4 * 1024 * 1024, diagnosticOutput: 'omit', preserveLastKnownGood: true},
  );
  const briefLogcat = await readAdbText(
    manifest,
    device,
    `${intent.shape}-${intent.appName}-reinspection-brief-logcat`,
    [
      'shell',
      'logcat',
      '-d',
      '-t',
      '2000',
      '-v',
      'brief',
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
    ],
    {maxBytes: 4 * 1024 * 1024, diagnosticOutput: 'omit', preserveLastKnownGood: true},
  );
  const processTableText = await readAdbText(
    manifest,
    device,
    `${intent.shape}-${intent.appName}-reinspection-process-table`,
    ['shell', 'ps', '-A', '-o', 'PID,NAME'],
    {maxBytes: 4 * 1024 * 1024, diagnosticOutput: 'sanitized', preserveLastKnownGood: true},
  );
  const processCandidates = parseAndroidProcessTable(processTableText, intent.packageName);
  if (processCandidates.length > 32) fail('VK_ANDROID_PROCESS_OBSERVATION_INVALID');
  const statReadbacks = new Map();
  for (const candidate of processCandidates) {
    const statResult = await readAdbText(
      manifest,
      device,
      `${intent.shape}-${intent.appName}-reinspection-stat-${candidate.pid}`,
      ['shell', 'cat', `/proc/${candidate.pid}/stat`],
      {...processReadbackOptions('proc-stat'), maxBytes: 4096},
    );
    statReadbacks.set(String(candidate.pid), processReadbackStdout(statResult, 'proc-stat'));
  }
  const exitInfoText = await readAdbText(
    manifest,
    device,
    `${intent.shape}-${intent.appName}-reinspection-exit-info`,
    ['shell', 'dumpsys', 'activity', 'exit-info', intent.packageName],
    {maxBytes: 1 * 1024 * 1024, diagnosticOutput: 'omit', preserveLastKnownGood: true},
  );
  const postReadBootId = (
    await readAdbText(
      manifest,
      device,
      `${intent.shape}-${intent.appName}-reinspection-post-boot-id`,
      ['shell', 'cat', '/proc/sys/kernel/random/boot_id'],
      {diagnosticOutput: 'omit', preserveLastKnownGood: true},
    )
  ).trim();
  if (postReadBootId !== intent.bootId) fail('VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH');
  const summary = summarizeResolvedLaunchLogEvidence(intent, epochLogcat, briefLogcat);
  const startupPid = recordedStartupPid ?? summary.startupPid;
  return {
    ...summary,
    processObservation: summarizeAndroidProcessObservation(
      processTableText,
      intent.packageName,
      statReadbacks,
      startupPid,
    ),
    exitInfo: summarizeAndroidExitInfo(exitInfoText, intent.packageName, startupPid),
  };
}

async function inspectResolvedLaunch(manifest) {
  const intent = resolveInspectableLaunch(manifest);
  const app = APPS[intent.appName];
  if (!app || intent.packageName !== app.packageName) fail('VK_ANDROID_MANIFEST_APP_BINDING_INVALID');
  const device = deviceFor(manifest, intent.shape);
  if (device.serial !== intent.host) fail('VK_ANDROID_PENDING_LAUNCH_HOST_MISMATCH');
  const bootId = (
    await adbText(manifest, device, `${intent.shape}-${intent.appName}-resolved-launch-logcat-boot-id`, [
      'shell',
      'cat',
      '/proc/sys/kernel/random/boot_id',
    ])
  ).trim();
  if (bootId !== intent.bootId) fail('VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH');
  const processTableText = await adbText(
    manifest,
    device,
    `${intent.shape}-${intent.appName}-resolved-launch-process-table`,
    ['shell', 'ps', '-A', '-o', 'PID,NAME'],
    {maxBytes: 4 * 1024 * 1024, diagnosticOutput: 'sanitized'},
  );
  const processTable = parseAndroidProcessTable(processTableText, intent.packageName);
  const processTableCandidates = [];
  for (const candidate of processTable) {
    const identity = await remotePidIdentity(manifest, device, candidate.pid, intent.packageName);
    if (identity.bootId !== intent.bootId) fail('VK_ANDROID_PENDING_LAUNCH_IDENTITY_MISMATCH');
    if (identity.process)
      processTableCandidates.push({
        pid: identity.process.pid,
        startTicks: identity.process.startTicks,
        name: candidate.name,
      });
  }
  const logcat = await adbText(
    manifest,
    device,
    `${intent.shape}-${intent.appName}-startup-logcat-diagnostic`,
    [
      'shell',
      'logcat',
      '-d',
      '-t',
      '2000',
      '-v',
      'brief',
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
    ],
    {maxBytes: 4 * 1024 * 1024, diagnosticOutput: 'omit'},
  );
  const breadcrumbs = summarizeAppLaunchBreadcrumbs(logcat, intent.appName, intent.intentId);
  const inspection = {
    intentId: intent.intentId,
    shape: intent.shape,
    appName: intent.appName,
    packageName: intent.packageName,
    host: intent.host,
    bootId: intent.bootId,
    processTableCandidateCount: processTableCandidates.length,
    processTableCandidates,
    signals: summarizeAndroidLaunchDiagnostics(logcat, intent.packageName, breadcrumbs.startupPid, intent.intentId),
    ...breadcrumbs,
    inspectedAt: now(),
  };
  manifest.launchLogInspections ??= [];
  manifest.launchLogInspections.push(inspection);
  appendEvent(manifest, 'RESOLVED_LAUNCH_LOG_INSPECTED', {
    shape: intent.shape,
    appName: intent.appName,
    fatalException: inspection.signals.fatalException,
    processDied: inspection.signals.processDied,
    nativeFatalSignalCount: inspection.signals.nativeFatalSignals.length,
    exceptionTypeCount: inspection.signals.exceptionTypes.length,
    appFrameCount: inspection.signals.appFrames.length,
    jsErrorSeen: inspection.signals.jsErrorSeen,
    processTableCandidateCount: inspection.processTableCandidateCount,
    markerCount: inspection.markerCount,
    observedMarkers: inspection.observedMarkers,
  });
  saveManifest(manifest);
  process.stdout.write(`RESOLVED_LAUNCH_LOG_INSPECTION=${JSON.stringify(inspection)}\n`);
}

async function reinspectResolvedLaunchLogs(manifest, intent) {
  const priorStartupPids = [...(manifest.launchLogInspections ?? []), ...(manifest.launchDiagnostics ?? [])]
    .filter(item => item.intentId === intent.intentId && item.startupPid !== null && item.startupPid !== undefined)
    .map(item => String(item.startupPid));
  if (new Set(priorStartupPids).size > 1) fail('VK_ANDROID_REINSPECTION_PID_AMBIGUOUS');
  const evidence = await collectResolvedLaunchLogEvidence(manifest, intent, adbText, priorStartupPids[0] ?? null);
  const inspection = {
    intentId: intent.intentId,
    shape: intent.shape,
    appName: intent.appName,
    packageName: intent.packageName,
    host: intent.host,
    bootId: intent.bootId,
    ...evidence,
    inspectedAt: now(),
  };
  manifest.launchLogReinspections ??= [];
  manifest.launchLogReinspections.push(inspection);
  validateRunManifest(manifest);
  appendEvent(manifest, 'RESOLVED_LAUNCH_LOGS_REINSPECTED', {
    shape: intent.shape,
    appName: intent.appName,
    evidenceStatus: inspection.evidenceStatus,
    startupPidPresent: inspection.startupPid !== null,
    markerCount: inspection.markerCount,
    overlayOutcome: inspection.overlayOutcome,
    fatalException: inspection.signals.fatalException,
    processDied: inspection.signals.processDied,
    nativeFatalSignalCount: inspection.signals.nativeFatalSignals.length,
    exceptionTypeCount: inspection.signals.exceptionTypes.length,
    appFrameCount: inspection.signals.appFrames.length,
    jsErrorSeen: inspection.signals.jsErrorSeen,
  });
  saveManifest(manifest);
  process.stdout.write(`RESOLVED_LAUNCH_LOG_REINSPECTION=${JSON.stringify(inspection)}\n`);
}

async function report(manifest) {
  const output = {
    runId: manifest.runId,
    status: manifest.status,
    phase: manifest.phase,
    business: manifest.business,
    visual: manifest.visual,
    cleanup: manifest.cleanup,
    firstFailure: manifest.firstFailure,
    lastKnownGood: manifest.lastKnownGood,
    frameCounts: Object.fromEntries(
      ['dual', 'mobile'].map(shape => [
        shape,
        Object.fromEntries(
          Object.entries(manifest.frameMatrix).map(([iaId, frame]) => [
            iaId,
            frame.captures.filter(item => item.shape === shape).length,
          ]),
        ),
      ]),
    ),
    captureObservationMatrix: captureObservationMatrix(manifest.frameMatrix),
    perControlVisualAudit: perControlVisualAuditRows(manifest.frameMatrix),
    launchDiagnostics: manifest.launchDiagnostics ?? [],
    launchLogInspections: manifest.launchLogInspections ?? [],
    launchLogReinspections: manifest.launchLogReinspections ?? [],
    debugFailureInjectionObservations: manifest.debugFailureInjectionObservations ?? [],
    resolvedRemoteLaunches: manifest.resolvedRemoteLaunches ?? [],
    a11Baseline: manifest.a11Baseline ?? null,
    a11W10SourceDigest: manifest.a11W10SourceDigest ?? null,
    persistKvW10Upgrades: manifest.persistKvW10Upgrades ?? [],
    persistKvW10PendingObservation: manifest.persistKvW10PendingObservation ?? null,
    historicalRemoteLaunchRecoveries: manifest.historicalRemoteLaunchRecoveries ?? [],
    controlledHarnessEntries: manifest.controlledHarnessEntries ?? [],
    controlledHarnessCaptures: manifest.controlledHarnessCaptures ?? [],
    businessChecks: manifest.businessChecks ?? [],
    terminalBusinessLogEvidence: manifest.terminalBusinessLogEvidence ?? [],
    w7ClipboardPreconditions: manifest.w7ClipboardPreconditions ?? [],
    w7ContextMenuObservations: manifest.w7ContextMenuObservations ?? [],
    devTunnelMappings: manifest.devTunnelMappings ?? [],
    transitions: manifest.transitions ?? [],
    evidenceRoot: manifest.evidenceRoot,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

async function dispatch(argv) {
  const args = parseArgs(argv);
  const [action] = args.positionals;
  if (action === 'prepare') return prepare(args);
  if (
    args['recover-invalidated-launches'] !== undefined &&
    (action !== 'cleanup' || args['recover-invalidated-launches'] !== 'yes')
  )
    fail('VK_ANDROID_HISTORICAL_RECOVERY_ARGUMENT_INVALID');
  const runId = safeRunId(args['run-id']);
  const manifest = readManifest(runId, {allowHistoricalApkPathsForCleanup: action === 'cleanup'});
  if (manifest.a11BaselineRunId && !['build', 'launch', 'observe-w10', 'report', 'cleanup'].includes(action)) {
    fail('VK_ANDROID_A11_W10_ACTION_NOT_ALLOWED');
  }
  if (manifest.a11BaselineRunId && ['build', 'launch', 'observe-w10'].includes(action)) {
    validateA11W10Action(manifest, action, args.device, args.app);
  }
  const launchLogReinspectionIntent =
    action === 'reinspect-resolved-launch-logs' ? resolveLaunchLogReinspection(manifest, args['intent-id']) : null;
  if (action !== 'cleanup') {
    try {
      resourcePreflight(manifest);
    } catch (error) {
      recordFirstFailure(manifest, error.message, 'runtime-resource-preflight');
      manifest.phase = 'RESOURCE_PREFLIGHT_FAILED';
      manifest.status = 'FAIL';
      saveManifest(manifest);
      throw error;
    }
  } else {
    manifest.resourcePreflight = {
      at: now(),
      result: 'NOT_APPLICABLE_CLEANUP_RECOVERY',
      reason: 'CLEANUP_USES_ONLY_RUN_BOUND_IDENTITIES',
    };
    appendEvent(manifest, 'RESOURCE_PREFLIGHT_SKIPPED_FOR_IDENTITY_BOUND_CLEANUP', {});
    saveManifest(manifest);
  }
  if (action === 'build') return buildApp(manifest, args.app, args['build-type'] ?? 'release');
  if (action === 'bridge-dev-tunnels')
    return setupDevTunnelMappings(manifest, args.device, args.app, args['dev-manifest'] ?? '.runtime/r5/run-manifest.json');
  if (action === 'launch')
    return installLaunch(
      manifest,
      args.device,
      args.app,
      args['failure-owner'] ?? null,
      args['native-loading-delay-ms'] === undefined ? null : Number(args['native-loading-delay-ms']),
    );
  if (action === 'clear-failure-injection') {
    const app = APPS[args.app];
    const binding = manifest.appBindings[args.app];
    if (!app || binding?.buildType !== 'debug') fail('VK_ANDROID_DEBUG_FAILURE_REQUIRES_DEBUG_APK');
    const device = deviceFor(manifest, args.device);
    const output = await adbText(
      manifest,
      device,
      `${args.device}-${args.app}-clear-debug-failure`,
      debugFailureInjectionIntentArgs(app.activity),
    );
    if (!/Status:\s*ok/.test(output)) fail('VK_ANDROID_DEBUG_FAILURE_CLEAR_FAILED');
    appendEvent(manifest, 'DEBUG_FAILURE_INJECTION_CLEARED', {shape: args.device, appName: args.app});
    saveManifest(manifest);
    return;
  }
  if (action === 'inject-debug-failure') {
    const app = APPS[args.app];
    const binding = manifest.appBindings[args.app];
    if (!app || binding?.buildType !== 'debug') fail('VK_ANDROID_DEBUG_FAILURE_REQUIRES_DEBUG_APK');
    const owned = requireOwnedApp(manifest, args.device, args.app);
    const device = deviceFor(manifest, args.device);
    const before = await remoteProcessIdentity(manifest, device, app.packageName);
    if (
      !remoteProcessIdentityMatches(owned, before, device.serial) ||
      before.bootId !== device.inventory?.bootId ||
      before.processes.length === 0
    ) {
      fail('VK_ANDROID_DEBUG_FAILURE_PROCESS_IDENTITY_MISMATCH');
    }
    const output = await adbText(
      manifest,
      device,
      `${args.device}-${args.app}-inject-debug-failure`,
      debugFailureInjectionRuntimeIntentArgs(app.activity, args['failure-owner']),
    );
    if (!/^Starting:\s*Intent\b/m.test(output)) fail('VK_ANDROID_DEBUG_FAILURE_INJECTION_DISPATCH_FAILED');
    const after = await remoteProcessIdentity(manifest, device, app.packageName);
    if (
      !remoteProcessIdentityMatches(owned, after, device.serial) ||
      after.bootId !== device.inventory?.bootId ||
      after.processes.length === 0
    ) {
      fail('VK_ANDROID_DEBUG_FAILURE_PROCESS_IDENTITY_MISMATCH');
    }
    appendEvent(manifest, 'DEBUG_FAILURE_INJECTION_SENT_TO_OWNED_RUNTIME', {
      shape: args.device,
      appName: args.app,
      ownerId: args['failure-owner'],
      host: device.serial,
      bootId: device.inventory.bootId,
      apkSha256: binding.sha256,
      processCount: after.processes.length,
    });
    saveManifest(manifest);
    process.stdout.write(
      `DEBUG_FAILURE_INJECTION_SENT=${JSON.stringify({shape: args.device, appName: args.app, ownerId: args['failure-owner'], processCount: after.processes.length, output: output.trim()})}\n`,
    );
    return;
  }
  if (action === 'inspect-debug-failure-injection')
    return inspectDebugFailureInjection(manifest, args.device, args.app, args['failure-owner']);
  if (action === 'inspect-resolved-debug-failure-injection') {
    const observation = await collectResolvedDebugFailureInjectionLogEvidence(
      manifest,
      args['intent-id'],
      args['failure-owner'],
    );
    manifest.debugFailureInjectionObservations ??= [];
    manifest.debugFailureInjectionObservations.push({observedAt: now(), ...observation});
    appendEvent(manifest, 'RESOLVED_DEBUG_FAILURE_INJECTION_LOGS_INSPECTED', {
      intentId: observation.intentId,
      host: observation.host,
      ownerId: observation.ownerId,
      startupPid: observation.startupPid,
      apkSha256: observation.apkSha256,
      signalCount: observation.signalCount,
      javascriptErrors: observation.javascriptErrors,
      targetOwnerOutcomes: observation.targetOwnerOutcomes,
    });
    saveManifest(manifest);
    process.stdout.write(`RESOLVED_DEBUG_FAILURE_INJECTION_INSPECTION=${JSON.stringify(observation)}\n`);
    return;
  }
  if (action === 'observe-w10') return observeA11W10(manifest, args.device, args.app);
  if (action === 'diagnose-pending-launch') return diagnosePendingLaunch(manifest);
  if (action === 'inspect-resolved-launch') return inspectResolvedLaunch(manifest);
  if (action === 'reinspect-resolved-launch-logs')
    return reinspectResolvedLaunchLogs(manifest, launchLogReinspectionIntent);
  if (action === 'inspect')
    return inspectResource(manifest, args.device, args['resource-id'], args.surface ?? 'primary');
  if (action === 'tap') return tapResource(manifest, args.device, args['resource-id'], args.surface ?? 'primary');
  if (action === 'activation-fixture-input')
    return runActivationFixtureInput(
      manifest,
      args.device,
      args.app,
      args['fixture-key'],
      args['expected-status'] ?? 'ENABLED',
    );
  if (action === 'business-input')
    return enterTerminalBusinessInput(manifest, args.device, args.app, args['value-key'], args.surface ?? 'primary');
  if (action === 'assert-business-text')
    return assertTerminalBusinessText(manifest, args.device, args.app, args.expectation, args.surface ?? 'primary');
  if (action === 'assert-business-screen')
    return assertTerminalBusinessScreen(manifest, args.device, args.app, args.expectation, args.surface ?? 'primary');
  if (action === 'assert-business-member-readback')
    return assertTerminalBusinessMemberReadback(manifest, args.device, args.app, args.surface ?? 'primary');
  if (action === 'wait-business-screen')
    return waitTerminalBusinessScreen(manifest, args.device, args.app, args.expectation, args.surface ?? 'primary');
  if (action === 'capture-terminal-business-logs')
    return collectTerminalBusinessLogEvidence(manifest, args.device, args.app, args['started-at'], args['finished-at']);
  if (action === 'business-clock') return readTerminalBusinessClock(manifest, args.device);
  if (action === 'activation-input-clear') {
    await clearActivationCodeInput(manifest, args.device, args.app);
    manifest.activationInputClearedAt = now();
    appendEvent(manifest, 'ACTIVATION_INPUT_CLEARED', {shape: args.device, appName: args.app});
    saveManifest(manifest);
    process.stdout.write('ACTIVATION_INPUT_CLEANUP=PASS\nVALUE_REDACTED=true\n');
    return;
  }
  if (action === 'w7-seed-clipboard')
    return seedW7Clipboard(
      manifest,
      args.device,
      args.app,
      args['source-resource-id'],
      args['target-resource-id'],
      args.surface ?? 'primary',
    );
  if (action === 'w7-long-press')
    return longPressW7Input(
      manifest,
      args.device,
      args.app,
      args['resource-id'],
      args.state,
      args.surface ?? 'primary',
    );
  if (action === 'w2-input-probe') return sendW2TextProbe(manifest, args.device, args.probe, args.surface ?? 'primary');
  if (action === 'w2-hardware-key')
    return sendW2HardwareKey(manifest, args.device, args.key, args.surface ?? 'primary');
  if (action === 'w2-admin-auth')
    return authenticateAdminFromDisplayedCode(manifest, args.device, args.app, args.surface ?? 'primary');
  if (action === 'admin-launch-gesture')
    return triggerAdminLauncherGesture(manifest, args.device, args.surface ?? 'primary');
  if (action === 'insert-url-symbol-sequence') return insertUrlSymbolSequence(manifest, args.device, args.app);
  if (action === 'capture') {
    const result = await capture(
      manifest,
      args.device,
      args.app,
      args['ia-id'],
      args.surface ?? 'primary',
      args.state ?? 'stable',
    );
    process.stdout.write(`CAPTURE=${result.screenshot}\n`);
    return;
  }
  if (action === 'transition') {
    const duration = Number(args['duration-ms'] ?? 250);
    if (duration !== 250) fail('VK_ANDROID_TRANSITION_DURATION_INVALID');
    return recordTransition(
      manifest,
      args.device,
      args.app,
      args['ia-id'],
      args['resource-id'],
      args.surface ?? 'primary',
    );
  }
  if (action === 'cleanup') {
    if (args['recover-dev-tunnels-from'] !== undefined && !RUN_ID_RE.test(args['recover-dev-tunnels-from']))
      fail('VK_ANDROID_TUNNEL_RECOVERY_SOURCE_INVALID');
    return cleanupWithOptionalHistoricalRecovery(
      manifest,
      args['recover-invalidated-launches'] === 'yes',
      args['recover-dev-tunnels-from'] ?? null,
    );
  }
  if (action === 'report') return report(manifest);
  fail('VK_ANDROID_ACTION_INVALID');
}

export function selfTest() {
  const logicalDual = parseLogicalDisplays(
    'Display id 0: DisplayInfo{"Internal", real 2560 x 1600, uniqueId "a", flags=FLAG_DEFAULT}\nDisplay id 2: DisplayInfo{"Presentation", real 1280 x 720, uniqueId "b", flags=FLAG_PRESENTATION}',
  );
  const surfaceDual = parseSurfaceDisplays(
    'Display 0 (HWC display 0, primary, "Internal")\nactiveMode={id=1, resolution=2560x1600}\nVirtual Display 7\nname="Presentation"\nactiveMode={id=2, resolution=1280x720}',
  );
  if (validateDeviceShape({shape: 'dual', logical: logicalDual, surfaces: surfaceDual}).secondary.id !== 2)
    fail('VK_ANDROID_SELF_TEST_DUAL_PARSE');
  if (emptyFrameMatrix() && Object.keys(emptyFrameMatrix()).length !== 19)
    fail('VK_ANDROID_SELF_TEST_FRAME_DENOMINATOR');
  const xml =
    '<hierarchy><display id="2"><node resource-id="keyboard:key" bounds="[2,3][22,33]" enabled="true" selected="false"/></display></hierarchy>';
  if (parseResourceNode(xml, 'keyboard:key', 2)?.bottom !== 33) fail('VK_ANDROID_SELF_TEST_RESOURCE_PARSE');
  if (parseResourceNode(xml, 'keyboard:key', 0) !== null) fail('VK_ANDROID_SELF_TEST_DISPLAY_SCOPE');
  if (
    parseLogicalDisplays('Display id 0: DisplayInfo{"Internal", real 10 x 20, uniqueId "only", flags=FLAG_DEFAULT}')
      .length !== 1
  )
    fail('VK_ANDROID_SELF_TEST_MOBILE_PARSE');
  if (Object.values(emptyFrameMatrix()).some(frame => frame.status !== 'OPEN' || frame.captures.length !== 0))
    fail('VK_ANDROID_SELF_TEST_FRAME_INITIAL_STATE');
  for (const invalid of ['', 'unsafe path', '../run']) {
    try {
      safeRunId(invalid);
      fail('VK_ANDROID_SELF_TEST_UNSAFE_RUN_ID_NOT_RED');
    } catch (error) {
      if (!error.message.startsWith('VK_ANDROID_RUN_ID_INVALID')) throw error;
    }
  }
  process.stdout.write(
    'VK_ANDROID_RUNNER_SELF_TEST=PASS\nIA_FRAME_DENOMINATOR=19\nDUAL_AND_MOBILE_SHAPE_GATES=PASS\nDISPLAY_SCOPED_TAP_PARSER=PASS\nUNSAFE_RUN_ID_RED=PASS\n',
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (process.argv[2] === '--self-test') selfTest();
  else
    dispatch(process.argv.slice(2)).catch(error => {
      try {
        const args = parseArgs(process.argv.slice(2));
        if (args['run-id'] && RUN_ID_RE.test(args['run-id'])) {
          const manifest = readManifest(args['run-id']);
          recordFirstFailure(manifest, error.message, manifest.activeCommand?.label ?? manifest.phase);
          if (args.positionals[0] === 'cleanup' || ['CLEANUP', 'CLEANUP_FAILED'].includes(manifest.phase)) {
            manifest.cleanup = 'FAIL';
            manifest.status = 'CLEANUP_REQUIRED';
            manifest.phase = 'CLEANUP_FAILED';
          } else if (manifest.cleanup === 'PASS') {
            manifest.status = 'CLEANED';
          } else if (manifest.status !== 'CLEANUP_REQUIRED') {
            manifest.status = 'FAIL';
            manifest.phase = 'FAILED';
          }
          saveManifest(manifest);
          appendEvent(manifest, 'RUN_ACTION_FAILED', {failureCode: error.message});
          saveManifest(manifest);
        }
      } catch {
        /* No writable manifest exists for failures before run preparation. */
      }
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
