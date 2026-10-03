import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

export const WEB_SCENARIOS = Object.freeze([
  'admin-runtime',
  'platform-ports-smoke',
  'screen-error-member-journey',
  'screen-error-secondary-journey',
  'layer-error-production-journey',
  'keyboard-login',
  'keyboard-member-journey',
  'keyboard-overlay-ownership',
  'textinput-contextmenu',
  'terminal-activation-connection',
  'terminal-activation-owner-rejection',
  'terminal-server-config',
  'terminal-wallpaper-exit',
]);

export const WEB_TERMINAL_BUSINESS_ASSERTION_IDS = Object.freeze({
  'terminal-activation-connection': Object.freeze({
    'sample-console': Object.freeze({
      laptop: Object.freeze(['A-02', 'A-03a', 'A-05a', 'A-10a', 'A-11a', 'A-13a']),
      mobile: Object.freeze(['A-02', 'A-03a', 'A-05a', 'A-10a', 'A-11a', 'A-13a']),
    }),
    'sample-wallpaper-console': Object.freeze({
      laptop: Object.freeze(['A-02', 'A-03a', 'A-05a', 'A-10a', 'A-11a', 'A-14a']),
      mobile: Object.freeze(['A-02', 'A-03a', 'A-05a', 'A-10a', 'A-11a', 'A-14a']),
    }),
  }),
  'terminal-activation-owner-rejection': Object.freeze({
    'sample-console': Object.freeze({laptop: Object.freeze(['A-04a'])}),
    'sample-wallpaper-console': Object.freeze({laptop: Object.freeze(['A-04a'])}),
  }),
  'terminal-server-config': Object.freeze({
    'sample-console': Object.freeze({
      laptop: Object.freeze(['A-06a', 'A-07a']),
      mobile: Object.freeze(['A-06a', 'A-07a']),
    }),
    'sample-wallpaper-console': Object.freeze({
      laptop: Object.freeze(['A-06a', 'A-07a']),
      mobile: Object.freeze(['A-06a', 'A-07a']),
    }),
  }),
  'terminal-wallpaper-exit': Object.freeze({
    'sample-wallpaper-console': Object.freeze({
      laptop: Object.freeze(['A-02', 'A-03a', 'A-05a', 'A-10a', 'A-14b']),
    }),
  }),
});

export function expectedWebBusinessAssertionIds({webScenario, integrationName, surfaceForm}) {
  const ids = WEB_TERMINAL_BUSINESS_ASSERTION_IDS[webScenario]?.[integrationName]?.[surfaceForm];
  if (!Array.isArray(ids)) throw new Error('WEB_TERMINAL_BUSINESS_ASSERTION_SCOPE_INVALID');
  return ids;
}

export function hasManagedTerminalBrowserOrigin(origins, port) {
  if (!Array.isArray(origins) || !Number.isInteger(port) || port < 1024 || port > 65535) return false;
  if (origins.some(value => typeof value !== 'string' || !/^http:\/\/(?:127\.0\.0\.1|localhost):[0-9]{4,5}$/u.test(value))) {
    return false;
  }
  return origins.includes(`http://127.0.0.1:${port}`);
}

export function webBusinessAssertionSetMatches(expected, observed) {
  if (!Array.isArray(expected) || !Array.isArray(observed)) return false;
  if (expected.some(value => typeof value !== 'string') || observed.some(value => typeof value !== 'string'))
    return false;
  if (new Set(expected).size !== expected.length || new Set(observed).size !== observed.length) return false;
  const expectedSet = new Set(expected);
  return observed.length === expected.length && observed.every(value => expectedSet.has(value));
}

export function expectedWebAStageRows() {
  return Object.freeze(
    Object.entries(WEB_TERMINAL_BUSINESS_ASSERTION_IDS).flatMap(([webScenario, integrations]) =>
      Object.entries(integrations).flatMap(([integrationName, surfaces]) =>
        Object.entries(surfaces).map(([surfaceForm, businessAssertionIds]) =>
          Object.freeze({
            webScenario,
            integrationName,
            surfaceForm,
            businessAssertionIds,
          }),
        ),
      ),
    ),
  );
}

export function validateWebAStageManifests(manifests, currentSourceSha256) {
  const errors = [];
  if (!Array.isArray(manifests)) return Object.freeze({status: 'FAIL', errors: Object.freeze(['MANIFESTS_INVALID'])});
  if (typeof currentSourceSha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(currentSourceSha256)) {
    errors.push('CURRENT_SOURCE_SHA256_INVALID');
  }
  const expected = new Map(
    expectedWebAStageRows().map(row => [`${row.webScenario}|${row.integrationName}|${row.surfaceForm}`, row]),
  );
  const seenRows = new Set();
  const seenRunIds = new Set();
  let managedDevIdentity = null;
  for (const manifest of manifests) {
    const rowKey = `${manifest?.webScenario}|${manifest?.integrationName}|${manifest?.surfaceForm}`;
    const expectedRow = expected.get(rowKey);
    if (expectedRow === undefined) {
      errors.push(`UNEXPECTED_WEB_A_ROW:${rowKey}`);
      continue;
    }
    if (seenRows.has(rowKey)) errors.push(`DUPLICATE_WEB_A_ROW:${rowKey}`);
    seenRows.add(rowKey);
    if (typeof manifest.runId !== 'string' || seenRunIds.has(manifest.runId)) {
      errors.push(`DUPLICATE_OR_INVALID_WEB_A_RUN_ID:${rowKey}`);
    } else {
      seenRunIds.add(manifest.runId);
    }
    if (typeof manifest.requestedRunId !== 'string' || manifest.requestedRunId !== manifest.runId) {
      errors.push(`WEB_A_MANIFEST_RUN_ID_MISMATCH:${rowKey}`);
    }
    const identity = {
      runId: manifest.managedDevRunId,
      manifestSha256: manifest.managedDevManifestSha256,
    };
    if (
      typeof identity.runId !== 'string' ||
      !/^r5-dev-[0-9]+-[0-9]+-[0-9a-f-]{36}$/u.test(identity.runId) ||
      typeof identity.manifestSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/u.test(identity.manifestSha256)
    ) {
      errors.push(`WEB_A_MANAGED_DEV_IDENTITY_INVALID:${rowKey}`);
    } else if (managedDevIdentity === null) {
      managedDevIdentity = identity;
    } else if (
      identity.runId !== managedDevIdentity.runId ||
      identity.manifestSha256 !== managedDevIdentity.manifestSha256
    ) {
      errors.push(`WEB_A_MANAGED_DEV_IDENTITY_MISMATCH:${rowKey}`);
    }
    if (manifest.phase !== 'COMPLETE' || manifest.business !== 'PASS' || manifest.cleanup !== 'PASS') {
      errors.push(`WEB_A_RUN_NOT_CLOSED:${rowKey}`);
    }
    const tdsReadiness = manifest.managedDevReadiness?.tds;
    if (
      manifest.managedDevReadiness?.runId !== identity.runId ||
      manifest.managedDevReadiness?.business?.status !== 'PASS' ||
      !Array.isArray(tdsReadiness) ||
      tdsReadiness.length !== 3 ||
      tdsReadiness.some(node => node?.status !== 'PASS') ||
      manifest.managedDevReadiness?.ingress?.status !== 'PASS'
    ) {
      errors.push(`WEB_A_MANAGED_DEV_READINESS_NOT_PROVEN:${rowKey}`);
    }
    const expectedRejectedCommandCount = manifest.webScenario === 'terminal-server-config' ? 1 : 0;
    if (manifest.frontendLogRead !== 'PASS') {
      errors.push(`WEB_A_FRONTEND_LOG_EVIDENCE_MISSING:${rowKey}`);
    }
    if (
      manifest.frontendRejectedCommandCount !== expectedRejectedCommandCount ||
      webCommandDispatchMismatch(manifest.webScenario, manifest.frontendCommandEvents) !== null
    ) {
      errors.push(`WEB_A_COMMAND_REJECTION_EVIDENCE_MISMATCH:${rowKey}`);
    }
    if (expectedRow.businessAssertionIds.includes('A-02')) {
      const heartbeat = manifest.matchedHeartbeatRtt;
      const tdsEvents = Array.isArray(manifest.tdsServerLogEvents) ? manifest.tdsServerLogEvents : [];
      const acceptedTdsSessions = new Set(
        tdsEvents
          .filter(
            value =>
              value?.event === 'tds_ws_accepted' &&
              typeof value.nodeId === 'string' &&
              typeof value.connectionId === 'string',
          )
          .map(value => `${value.nodeId}|${value.connectionId}`),
      );
      const hasRegisteredTdsSession = tdsEvents.some(
        value =>
          value?.event === 'tds_session_registered' &&
          typeof value.nodeId === 'string' &&
          typeof value.connectionId === 'string' &&
          acceptedTdsSessions.has(`${value.nodeId}|${value.connectionId}`),
      );
      if (
        manifest.backendLogRead !== 'PASS' ||
        manifest.tdsLogRead !== 'PASS' ||
        !Array.isArray(manifest.tdsNodeLogRead) ||
        manifest.tdsNodeLogRead.length !== 3 ||
        manifest.tdsNodeLogRead.some(value => value?.status !== 'PASS') ||
        typeof manifest.tdsServerLog !== 'string' ||
        manifest.tdsServerLog.length === 0 ||
        !hasRegisteredTdsSession ||
        manifest.frontendBackendLogCorrelation?.activation !== 'PASS' ||
        manifest.frontendBackendLogCorrelation?.['cancel-activation'] !== 'PASS' ||
        !Number.isInteger(heartbeat?.sequence) ||
        !Number.isFinite(heartbeat?.rttMs) ||
        heartbeat.rttMs < 0 ||
        manifest.activationResult?.tdsSessionRouteObserved !== 'PASS'
      ) {
        errors.push(`WEB_A_ACTIVATION_BACKEND_TDS_OR_RTT_EVIDENCE_MISSING:${rowKey}`);
      }
    }
    if (
      expectedRow.businessAssertionIds.includes('A-04a') &&
      (manifest.backendLogRead !== 'PASS' ||
        manifest.frontendBackendLogCorrelation?.activation !== 'PASS' ||
        manifest.activationRejection?.httpStatus !== 409 ||
        manifest.activationRejection?.ownerCode !== 'STORE_TERMINAL_DISABLED')
    ) {
      errors.push(`WEB_A_REJECTION_BACKEND_CORRELATION_MISSING:${rowKey}`);
    }
    const allowedConsoleFailureIndexes =
      expectedRow.businessAssertionIds.includes('A-04a') &&
      manifest.activationRejection?.httpStatus === 409 &&
      manifest.activationRejection?.ownerCode === 'STORE_TERMINAL_DISABLED' &&
      manifest.frontendBackendLogCorrelation?.activation === 'PASS'
        ? expectedActivationRejectionConsoleFailureIndexes({
            failures: manifest.browserConsoleFailures,
            httpResults: manifest.managedHttpResults,
          })
        : [];
    if (
      !Array.isArray(manifest.expectedHttpStatusConsoleFailureIndexes) ||
      manifest.expectedHttpStatusConsoleFailureIndexes.length !== allowedConsoleFailureIndexes.length ||
      manifest.expectedHttpStatusConsoleFailureIndexes.some(
        (value, index) => value !== allowedConsoleFailureIndexes[index],
      ) ||
      hasUnexpectedBrowserConsoleFailures(manifest.browserConsoleFailures, allowedConsoleFailureIndexes)
    ) {
      errors.push(`WEB_A_BROWSER_CONSOLE_EVIDENCE_MISMATCH:${rowKey}`);
    }
    if (
      expectedRow.businessAssertionIds.includes('A-13a') &&
      (manifest.memberRegistration?.pendingContentMatched !== 'PASS' ||
        manifest.memberRegistration?.confirmationReadbackMatched !== 'PASS' ||
        manifest.memberRegistration?.confirmedMemberRowCount !== 1 ||
        manifest.memberRegistration?.matchingConfirmedMemberRowCount !== 1 ||
        manifest.memberRegistration?.optionalAgeInputAcceptedAndSubmitted !== 'PASS' ||
        manifest.memberRegistration?.exactAgeStateReadback !== 'OWNER_FOCUSED_PROOF_REQUIRED')
    ) {
      errors.push(`WEB_A_MEMBER_CONFIRMATION_EVIDENCE_MISSING:${rowKey}`);
    }
    if (
      expectedRow.businessAssertionIds.includes('A-06a') &&
      (manifest.serverConfigUi?.savedOverrideReadback !== 'PASS' ||
        manifest.serverConfigUi?.clearedOverrideReadback !== 'PASS' ||
        manifest.serverConfigUi?.rejectedInvalidOverrideWithoutEffectiveChange !== 'PASS' ||
        typeof manifest.serverConfigUi?.rejectedInvalidCommand !== 'string' ||
        !manifest.serverConfigUi.rejectedInvalidCommand.endsWith('kernel.base.server-config.set-server-override') ||
        manifest.serverConfigUi?.restoredDefaultReadback !== 'PASS')
    ) {
      errors.push(`WEB_A_SERVER_CONFIG_EVIDENCE_MISSING:${rowKey}`);
    }
    if (
      manifest.sourceStable !== 'PASS' ||
      manifest.sourceSha256 !== currentSourceSha256 ||
      manifest.sourceSha256After !== currentSourceSha256
    ) {
      errors.push(`WEB_A_SOURCE_BYTES_MISMATCH:${rowKey}`);
    }
    if (!webBusinessAssertionSetMatches(expectedRow.businessAssertionIds, manifest.businessAssertionIds)) {
      errors.push(`WEB_A_ASSERTION_SET_MISMATCH:${rowKey}`);
    }
  }
  for (const rowKey of expected.keys()) {
    if (!seenRows.has(rowKey)) errors.push(`WEB_A_ROW_MISSING:${rowKey}`);
  }
  return Object.freeze({
    status: errors.length === 0 ? 'PASS' : 'FAIL',
    expectedRows: expected.size,
    observedRows: manifests.length,
    currentSourceSha256,
    errors: Object.freeze(errors),
  });
}

export function managedTestGroupWorkspaceUrl(managedDevManifest, workspaceKey = 'aurora') {
  if (
    managedDevManifest?.kind !== 'r5-dev-run-manifest' ||
    typeof managedDevManifest.runId !== 'string' ||
    !/^r5-dev-[0-9]+-[0-9]+-[0-9a-f-]{36}$/.test(managedDevManifest.runId) ||
    typeof managedDevManifest.localHttpBaseUrl !== 'string' ||
    !/^http:\/\/127\.0\.0\.1:\d{4,5}$/.test(managedDevManifest.localHttpBaseUrl) ||
    typeof workspaceKey !== 'string' ||
    !/^[A-Za-z0-9_-]+$/.test(workspaceKey)
  ) {
    throw new Error('WEB_MANAGED_DEV_GROUP_WORKSPACE_INPUT_INVALID');
  }
  return `${managedDevManifest.localHttpBaseUrl}/api/terminal/group-workspaces/${workspaceKey}`;
}

export function managedTestServerSpaceOverrides(managedDevManifest, workspaceKey = 'aurora') {
  const websocketUrls = [
    managedDevManifest?.localTdsWebSocketBaseUrl,
    managedDevManifest?.localTdsEntryTwoWebSocketBaseUrl,
  ];
  if (websocketUrls.some(value => typeof value !== 'string' || !/^ws:\/\/127\.0\.0\.1:\d{4,5}$/.test(value))) {
    throw new Error('WEB_MANAGED_DEV_TDS_ENTRY_URL_INVALID');
  }
  if (websocketUrls[0] === websocketUrls[1]) throw new Error('WEB_MANAGED_DEV_TDS_ENTRIES_NOT_DISTINCT');
  return Object.freeze({
    businessBaseUrl: managedTestGroupWorkspaceUrl(managedDevManifest, workspaceKey),
    tdsEntryOneWebSocketBaseUrl: websocketUrls[0],
    tdsEntryTwoWebSocketBaseUrl: websocketUrls[1],
  });
}

export function parsePlatformPortsSummaryCount(text, expectedLabel) {
  if (typeof text !== 'string' || typeof expectedLabel !== 'string' || expectedLabel.length === 0) return null;
  const normalized = text.trim().replace(/\s+/g, ' ');
  const prefix = `${expectedLabel} `;
  if (!normalized.startsWith(prefix)) return null;
  const count = normalized.slice(prefix.length);
  return /^(0|[1-9]\d*)$/.test(count) ? Number(count) : null;
}

export function isWallpaperRadioMarkerSelected(text) {
  return typeof text === 'string' && text.trim() === '•';
}

export function wallpaperExitReadbackMismatch({wallpaperId, homeRouteObserved, backgroundCount, backgroundLabel}) {
  if (!['none', 'w1', 'w2', 'w3'].includes(wallpaperId)) return 'WEB_WALLPAPER_EXIT_SELECTION_INVALID';
  if (homeRouteObserved !== true) return 'WEB_WALLPAPER_EXIT_HOME_ROUTE_NOT_OBSERVED';
  if (!Number.isSafeInteger(backgroundCount) || backgroundCount < 0)
    return 'WEB_WALLPAPER_EXIT_BACKGROUND_COUNT_INVALID';
  if (wallpaperId === 'none') {
    return backgroundCount === 0 ? null : 'WEB_WALLPAPER_EXIT_NONE_BACKGROUND_PRESENT';
  }
  const expectedLabels = {w1: '当前壁纸：山景', w2: '当前壁纸：湖景', w3: '当前壁纸：海滩'};
  return backgroundCount === 1 && backgroundLabel === expectedLabels[wallpaperId]
    ? null
    : 'WEB_WALLPAPER_EXIT_CHANGED_CONFIRMED_VALUE';
}

export function memberConfirmationReadback({rowTexts, expectedName, expectedPhone}) {
  if (
    !Array.isArray(rowTexts) ||
    rowTexts.some(value => typeof value !== 'string') ||
    typeof expectedName !== 'string' ||
    expectedName.length === 0 ||
    typeof expectedPhone !== 'string' ||
    expectedPhone.length === 0
  ) {
    return Object.freeze({status: 'FAIL', rowCount: Array.isArray(rowTexts) ? rowTexts.length : null, matchingRowCount: 0});
  }
  const expectedRow = `${expectedName} ${expectedPhone}`;
  const matchingRowCount = rowTexts.filter(value => value.trim() === expectedRow).length;
  return Object.freeze({
    status: rowTexts.length === 1 && matchingRowCount === 1 ? 'PASS' : 'FAIL',
    rowCount: rowTexts.length,
    matchingRowCount,
  });
}

export const EXPECTED_ADMIN_SHELL_COLOR_BY_INTEGRATION = Object.freeze({
  'sample-console': Object.freeze({token: '16 29 49', computed: 'rgb(16, 29, 49)'}),
  'sample-wallpaper-console': Object.freeze({token: '255 255 255', computed: 'rgb(255, 255, 255)'}),
});

export const ADMIN_SHELL_FRAME_SELECTOR = '[data-testid^="terminal.admin:frame:"]';

export const EXPECTED_TEXTINPUT_PROBE_COUNT = Object.freeze({
  'sample-console': Object.freeze({laptop: 7, mobile: 6}),
  'sample-wallpaper-console': Object.freeze({laptop: 3, mobile: 2}),
});

export const EXPECTED_TEXTINPUT_PROBE_IDS = Object.freeze({
  'sample-console': Object.freeze({
    laptop: Object.freeze([
      'sample.auth.login:operator-name',
      'sample.auth.login:passcode',
      'sample.desk.member-form:name',
      'sample.desk.member-form:phone',
      'sample.desk.member-form:keyboard-alpha-probe',
      'sample.desk.member-form:keyboard-financial-probe',
      'terminal.admin:topology:host',
    ]),
    mobile: Object.freeze([
      'sample.auth.login:operator-name',
      'sample.auth.login:passcode',
      'sample.desk.member-form:name',
      'sample.desk.member-form:phone',
      'sample.desk.member-form:keyboard-alpha-probe',
      'sample.desk.member-form:keyboard-financial-probe',
    ]),
  }),
  'sample-wallpaper-console': Object.freeze({
    laptop: Object.freeze([
      'sample.auth.login:operator-name',
      'sample.auth.login:passcode',
      'terminal.admin:topology:host',
    ]),
    mobile: Object.freeze(['sample.auth.login:operator-name', 'sample.auth.login:passcode']),
  }),
});

export const WEB_TEXTINPUT_CONTEXTMENU_UNREACHED_CONSUMERS = Object.freeze([
  Object.freeze({
    integrationName: 'sample-console',
    testID: 'sample.desk.customer-member:age',
    status: 'NOT_REACHED_BY_THIS_SCENARIO',
    reason: 'textinput-contextmenu does not submit the member form to mount CustomerMemberAgeField',
  }),
]);

export function expectedTextInputProbeCount({integrationName, surfaceForm}) {
  const count = EXPECTED_TEXTINPUT_PROBE_COUNT[integrationName]?.[surfaceForm];
  if (!Number.isInteger(count)) throw new Error('TER_ADMIN_DISPLAY_WEB_TEXTINPUT_SCOPE_INVALID');
  return count;
}

export function expectedTextInputProbeIds({integrationName, surfaceForm}) {
  const ids = EXPECTED_TEXTINPUT_PROBE_IDS[integrationName]?.[surfaceForm];
  if (!Array.isArray(ids)) throw new Error('TER_ADMIN_DISPLAY_WEB_TEXTINPUT_SCOPE_INVALID');
  return ids;
}

export function additionalTextInputContextMenuTargets({integrationName, surfaceForm}) {
  const loginProbeIds = new Set(['sample.auth.login:operator-name', 'sample.auth.login:passcode']);
  return Object.freeze(
    expectedTextInputProbeIds({integrationName, surfaceForm}).filter(testID => !loginProbeIds.has(testID)),
  );
}

export function textInputProbeMismatch(observations, expectedIds) {
  const statesById = new Map();
  for (const observation of observations) {
    if (
      typeof observation?.testID !== 'string' ||
      typeof observation?.state !== 'string' ||
      observation?.contextMenuPrevented !== true
    ) {
      return 'WEB_TEXTINPUT_CONTEXTMENU_OBSERVATION_INVALID';
    }
    const states = statesById.get(observation.testID) ?? new Set();
    if (states.has(observation.state)) return 'WEB_TEXTINPUT_CONTEXTMENU_DUPLICATE_STATE';
    states.add(observation.state);
    statesById.set(observation.testID, states);
  }
  const actualIds = [...statesById.keys()].sort();
  const requiredIds = [...expectedIds].sort();
  if (actualIds.length !== requiredIds.length || actualIds.some((id, index) => id !== requiredIds[index])) {
    return 'WEB_TEXTINPUT_CONTEXTMENU_FIELD_SET_MISMATCH';
  }
  if (
    [...statesById.values()].some(states => states.size !== 2 || !states.has('empty') || !states.has('existing-text'))
  ) {
    return 'WEB_TEXTINPUT_CONTEXTMENU_STATE_COUNT_MISMATCH';
  }
  return null;
}

export function classifyAdminLauncherFailureRecoveryLog(
  logText,
  {adminLayerMounted = false, failureOwner = null} = {},
) {
  const events = String(logText)
    .split(/\r?\n/)
    .flatMap(line => {
      try {
        const value = JSON.parse(line);
        return isStructuredRuntimeLogEvent(value) ? [value] : [];
      } catch {
        return [];
      }
    });
  const requestIndexes = [];
  const resultEvents = [];
  events.forEach((event, index) => {
    if (isExpectedRuntimeLogEvent(event, 'admin.launcher-open-requested')) requestIndexes.push(index);
    if (isExpectedRuntimeLogEvent(event, 'admin.launcher-open-result')) resultEvents.push({event, index});
  });
  const openRequests = requestIndexes.length;
  const results = resultEvents.map(entry => entry.event);
  const completedResults = results.filter(event => event.data?.status === 'completed').length;
  const exactlyOneOrderedRequest =
    openRequests === 1 && resultEvents.length === 1 && resultEvents[0].index > requestIndexes[0];
  if (adminLayerMounted) {
    const resetUnavailableIndexes = events.flatMap((event, index) =>
      isExpectedRuntimeLogEvent(event, 'runtime.system-failure.reset-unavailable') &&
      event.data?.portStatus === 'unavailable'
        ? [index]
        : [],
    );
    const latestResetUnavailableIndex = resetUnavailableIndexes.at(-1) ?? -1;
    const adminLayerSelectedAfterReset = events.some(
      (event, index) =>
        index > latestResetUnavailableIndex &&
        isExpectedRuntimeLogEvent(event, 'render.layer-selection') &&
        event.data?.displayMode === 'PRIMARY' &&
        Array.isArray(event.data?.layerIds) &&
        event.data.layerIds.includes('admin.console.layer'),
    );
    if (
      failureOwner === 'layer:admin.console.layer' &&
      exactlyOneOrderedRequest &&
      completedResults === 1 &&
      resetUnavailableIndexes.length === 1 &&
      latestResetUnavailableIndex > resultEvents[0].index &&
      adminLayerSelectedAfterReset
    ) {
      return Object.freeze({
        status: 'PASS',
        openRequests,
        completedResults,
        reason: 'OPENED_BOUNDARY_OWNER',
      });
    }
    return Object.freeze({
      status: 'OPEN',
      openRequests,
      completedResults,
      reason: 'ADMIN_LAYER_REMAINS_MOUNTED_LAUNCHER_REENTRY_NOT_APPLICABLE',
    });
  }
  return Object.freeze({
    status: exactlyOneOrderedRequest && completedResults === 1 ? 'PASS' : 'OPEN',
    openRequests,
    completedResults,
  });
}

export function parseJsonEventsAfterByteOffset(bytes, byteOffset) {
  const checkpoint =
    typeof byteOffset === 'number'
      ? Object.freeze({byteOffset, notBeforeEpochMillis: null})
      : byteOffset;
  if (
    !Buffer.isBuffer(bytes) ||
    !checkpoint ||
    typeof checkpoint !== 'object' ||
    !Number.isSafeInteger(checkpoint.byteOffset) ||
    checkpoint.byteOffset < 0 ||
    checkpoint.byteOffset > bytes.length ||
    (checkpoint.notBeforeEpochMillis !== null &&
      (!Number.isSafeInteger(checkpoint.notBeforeEpochMillis) || checkpoint.notBeforeEpochMillis < 0))
  ) {
    throw new Error('WEB_LOG_BYTE_OFFSET_INVALID');
  }
  let scanOffset = checkpoint.byteOffset;
  if (checkpoint.notBeforeEpochMillis !== null && scanOffset > 0 && bytes[scanOffset - 1] !== 0x0a) {
    scanOffset = bytes.lastIndexOf(0x0a, scanOffset - 1) + 1;
  }
  let tail = bytes.subarray(scanOffset).toString('utf8');
  if (checkpoint.notBeforeEpochMillis === null && scanOffset !== checkpoint.byteOffset) {
    const nextLineStart = tail.indexOf('\n');
    if (nextLineStart < 0) return [];
    tail = tail.slice(nextLineStart + 1);
  }
  const lines = tail.split(/\r?\n/);
  if (!tail.endsWith('\n') && !tail.endsWith('\r')) lines.pop();
  return lines.flatMap(line => {
    try {
      const jsonStart = line.indexOf('{');
      const jsonEnd = line.lastIndexOf('}');
      if (jsonStart < 0 || jsonEnd < jsonStart) return [];
      const value = JSON.parse(normalizeConsoleUndefinedValues(line.slice(jsonStart, jsonEnd + 1)));
      return isStructuredRuntimeLogEvent(value) &&
        (checkpoint.notBeforeEpochMillis === null || value.timestamp >= checkpoint.notBeforeEpochMillis)
        ? [value]
        : [];
    } catch {
      return [];
    }
  });
}

export function createWebLogCheckpoint(bytes, capturedAtEpochMillis = Date.now()) {
  if (!Buffer.isBuffer(bytes) || !Number.isSafeInteger(capturedAtEpochMillis) || capturedAtEpochMillis < 0) {
    throw new Error('WEB_LOG_CHECKPOINT_INPUT_INVALID');
  }
  return Object.freeze({byteOffset: bytes.length, notBeforeEpochMillis: capturedAtEpochMillis});
}

export function projectTerminalActivationLogEvents(events, startedAt, finishedAt) {
  const start = Date.parse(startedAt);
  const finish = Date.parse(finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(finish) || finish < start) {
    throw new Error('WEB_TERMINAL_ACTIVATION_LOG_WINDOW_INVALID');
  }
  const acceptedEvents = new Set([
    'activation-request-started',
    'activation-request-result',
    'activation-request-threw',
  ]);
  return events.flatMap(event => {
    if (
      event.category !== 'terminal.activation.http' ||
      !acceptedEvents.has(event.event) ||
      event.scope?.moduleName !== 'kernel.base.terminal-data-client' ||
      event.security?.containsSensitiveRaw !== false ||
      event.timestamp < start ||
      event.timestamp > finish
    )
      return [];
    const data = event.data !== null && typeof event.data === 'object' ? event.data : {};
    const elapsedMs = Number.isFinite(data.elapsedMs) && data.elapsedMs >= 0 ? data.elapsedMs : null;
    const status = Number.isInteger(data.status) && data.status >= 100 && data.status <= 599 ? data.status : null;
    const kind = ['success', 'business-rejection', 'failure'].includes(data.kind) ? data.kind : null;
    const category = ['not-delivered', 'delivered-failure', 'unknown-business-rejection'].includes(data.category)
      ? data.category
      : null;
    return [
      {
        at: new Date(event.timestamp).toISOString(),
        event: event.event,
        operationId: data.operationId === 'activateTerminal' ? data.operationId : null,
        outcome: kind,
        category,
        status,
        elapsedMs,
        commandIdPresent: typeof event.context?.commandId === 'string',
      },
    ];
  });
}

export function projectTerminalConnectionHeartbeatLogEvents(events, startedAt, finishedAt) {
  const start = Date.parse(startedAt);
  const finish = Date.parse(finishedAt);
  if (!Number.isFinite(start) || !Number.isFinite(finish) || finish < start) {
    throw new Error('WEB_TERMINAL_HEARTBEAT_LOG_WINDOW_INVALID');
  }
  return events.flatMap(event => {
    if (
      event.category !== 'terminal.connection.heartbeat' ||
      event.event !== 'heartbeat-pong-matched' ||
      event.scope?.moduleName !== 'kernel.base.terminal-data-client' ||
      event.security?.containsSensitiveRaw !== false ||
      event.timestamp < start ||
      event.timestamp > finish
    )
      return [];
    const data = event.data !== null && typeof event.data === 'object' ? event.data : {};
    if (
      data.profileId !== 'terminal-data-client' ||
      !Number.isSafeInteger(data.sequence) ||
      data.sequence < 1 ||
      !Number.isSafeInteger(data.rttMs) ||
      data.rttMs < 0
    )
      return [];
    return [
      {
        at: new Date(event.timestamp).toISOString(),
        sequence: data.sequence,
        rttMs: data.rttMs,
        commandIdPresent: typeof event.context?.commandId === 'string',
      },
    ];
  });
}

export function displayedHeartbeatRttMismatch(displayText, matchedHeartbeats) {
  const match = typeof displayText === 'string' ? /^连接延时：(0|[1-9]\d*) ms$/u.exec(displayText.trim()) : null;
  if (!match || !Array.isArray(matchedHeartbeats) || matchedHeartbeats.length === 0) {
    return 'WEB_TERMINAL_HEARTBEAT_RTT_NOT_OBSERVED';
  }
  const latest = matchedHeartbeats.at(-1);
  if (!Number.isSafeInteger(latest?.rttMs) || !Number.isSafeInteger(latest?.sequence) || latest.sequence < 1) {
    return 'WEB_TERMINAL_HEARTBEAT_RTT_OBSERVATION_INVALID';
  }
  return Number(match[1]) === latest.rttMs ? null : 'WEB_TERMINAL_HEARTBEAT_RTT_SELECTOR_MISMATCH';
}

export function classifyBrowserConsoleFailure(text) {
  if (typeof text !== 'string') return 'CONSOLE_FAILURE';
  if (/"event"\s*:\s*"container-empty"|container-empty/iu.test(text)) return 'UI_CONTAINER_EMPTY';
  if (/"event"\s*:\s*"command-dispatch-rejected"/iu.test(text)) {
    const failure = text.match(/"failure"\s*:\s*"(partial-failed|timed-out|error|promise-rejected)"/iu)?.[1];
    if (failure !== undefined) return 'COMMAND_DISPATCH_REJECTION_' + failure.toUpperCase();
  }
  const httpStatus = text.match(/server responded with a status of (\d{3})/iu)?.[1];
  if (httpStatus !== undefined) return `HTTP_RESPONSE_STATUS_${httpStatus}`;
  if (/blocked by CORS policy|cross-origin request blocked/iu.test(text)) return 'CROSS_ORIGIN_POLICY';
  if (/mixed content/iu.test(text)) return 'MIXED_CONTENT';
  if (/net::ERR_[A-Z0-9_]+/u.test(text)) return 'CHROMIUM_NETWORK_FAILURE';
  if (/failed to fetch|networkerror/iu.test(text)) return 'FETCH_FAILED';
  return 'OTHER_CONSOLE_FAILURE';
}

export function expectedActivationRejectionConsoleFailureIndexes({failures, httpResults}) {
  if (!Array.isArray(failures) || !Array.isArray(httpResults)) return [];
  const responses = httpResults.filter(
    value =>
      value?.operation === 'activation' &&
      value.method === 'POST' &&
      value.status === 409 &&
      typeof value.at === 'string' &&
      Number.isFinite(Date.parse(value.at)),
  );
  if (responses.length !== 1) return [];
  const responseAt = Date.parse(responses[0].at);
  const candidates = failures.flatMap((value, index) => {
    if (
      value?.level !== 'error' ||
      value.classification !== 'HTTP_RESPONSE_STATUS_409' ||
      typeof value.at !== 'string' ||
      !Number.isFinite(Date.parse(value.at))
    )
      return [];
    return Math.abs(Date.parse(value.at) - responseAt) <= 1_000 ? [index] : [];
  });
  return candidates.length === 1 ? candidates : [];
}

export function hasUnexpectedBrowserConsoleFailures(failures, allowedFailureIndexes = []) {
  const allowed = new Set(allowedFailureIndexes);
  return (
    Array.isArray(failures) &&
    failures.some(
      (value, index) =>
        value?.level === 'error' && value?.classification !== 'UI_CONTAINER_EMPTY' && !allowed.has(index),
    )
  );
}

export function unresolvedScreenPlacementsAfterStartup(events) {
  if (!Array.isArray(events)) return [];
  const completionIndex = events.findIndex(value => isExpectedRuntimeLogEvent(value, 'startup.complete'));
  if (completionIndex < 0) return [];

  const latestPlacementByContainer = new Map();
  for (const value of events.slice(completionIndex + 1)) {
    // Ignore placements emitted by the in-process reset transition after completion.
    if (isExpectedRuntimeLogEvent(value, 'runtime.reset.completed')) {
      latestPlacementByContainer.clear();
      continue;
    }
    if (!isStructuredRuntimeLogEvent(value)) continue;
    const isSelection = value?.event === 'render.screen-selection';
    const isEmpty = value?.event === 'container-empty' && value.level === 'error';
    if (!isSelection && !isEmpty) continue;
    const displayMode = value.data?.displayMode;
    const containerKey = value.data?.containerKey;
    if (
      !['PRIMARY', 'SECONDARY'].includes(displayMode) ||
      typeof containerKey !== 'string' ||
      containerKey.length === 0
    )
      continue;
    const hasResolvedPart =
      value.data?.fallback === null &&
      typeof value.data?.screenPartKey === 'string' &&
      value.data.screenPartKey.length > 0;
    const reportsEmpty = isEmpty || value.data?.fallback === 'container-empty';
    latestPlacementByContainer.set(`${displayMode}\u0000${containerKey}`, {
      timestamp: value.timestamp,
      displayMode,
      containerKey,
      empty: reportsEmpty || (isSelection && !hasResolvedPart),
      reason: reportsEmpty ? 'container-empty' : isSelection && !hasResolvedPart ? 'screen-selection-incomplete' : null,
    });
  }

  const completedAt = events[completionIndex].timestamp;
  return [...latestPlacementByContainer.values()]
    .filter(value => value.empty && Number.isFinite(value.timestamp) && Number.isFinite(completedAt))
    .map(value => ({
      at: new Date(value.timestamp).toISOString(),
      displayMode: value.displayMode,
      containerKey: value.containerKey,
      reason: value.reason,
    }));
}

export function hasStartupCompletionEvent(events) {
  if (!Array.isArray(events)) return false;
  const completions = events.filter(value => isExpectedRuntimeLogEvent(value, 'startup.complete'));
  if (completions.length !== 1) return false;
  const {data} = completions[0];
  const requiredGroups = ['modules', 'slices', 'commands', 'actors', 'ports', 'parts'];
  return (
    data?.primaryDeclared === true &&
    data?.primaryMeasured === true &&
    requiredGroups.every(group => data.groups?.[group] === true)
  );
}

export function projectFrontendCommandDispatchEvents(events) {
  if (!Array.isArray(events)) return Object.freeze({events: Object.freeze([]), rejectedCount: 0});
  const failureKinds = new Set(['promise-rejected', 'partial-failed', 'timed-out', 'error']);
  const projected = events
    .filter(value => value?.event === 'command-dispatch-completed' || value?.event === 'command-dispatch-rejected')
    .map(value =>
      Object.freeze({
        event: value.event,
        commandName: typeof value.context?.commandName === 'string' ? value.context.commandName : null,
        failure: failureKinds.has(value.data?.failure) ? value.data.failure : null,
        level: value.level,
        timestamp: Number.isFinite(value.timestamp) ? value.timestamp : null,
      }),
    );
  return Object.freeze({
    events: Object.freeze(projected),
    rejectedCount: projected.filter(value => value.event === 'command-dispatch-rejected').length,
  });
}

export function webCommandDispatchMismatch(webScenario, events) {
  if (!Array.isArray(events)) return 'WEB_COMMAND_DISPATCH_EVENTS_INVALID';
  const rejected = events.filter(value => value?.event === 'command-dispatch-rejected');
  if (webScenario === 'terminal-server-config') {
    if (rejected.length !== 1) return 'WEB_COMMAND_REJECTION_COUNT_MISMATCH';
    return typeof rejected[0]?.commandName === 'string' &&
      rejected[0].commandName.endsWith('kernel.base.server-config.set-server-override') &&
      rejected[0].failure === 'error'
      ? null
      : 'WEB_COMMAND_REJECTION_COMMAND_MISMATCH';
  }
  return rejected.length === 0 ? null : 'WEB_COMMAND_REJECTION_COUNT_MISMATCH';
}

export function projectWebFailureDiagnostic(error, scenarioStep) {
  const message = typeof error?.message === 'string' ? error.message : '';
  const name =
    typeof error?.name === 'string' && /^[A-Za-z][A-Za-z0-9_]{0,63}$/u.test(error.name) ? error.name : 'Error';
  const marker = message.match(/^([A-Z][A-Z0-9_-]{2,119})(?=[:\s]|$)/u)?.[1];
  const step =
    typeof scenarioStep === 'string' && /^[A-Z0-9_]{1,96}$/u.test(scenarioStep) ? scenarioStep : 'UNCLASSIFIED_STEP';
  const expectedLogEvent = message.match(
    /^WEB_EXPECTED_LOG_EVENT_MISSING:(admin\.launcher-open-requested|admin\.launcher-open-result|runtime\.system-failure\.reset-unavailable)$/u,
  )?.[1];
  return Object.freeze({
    failureCode: marker ?? (name === 'TimeoutError' ? 'PLAYWRIGHT_TIMEOUT' : 'UNCLASSIFIED_WEB_FAILURE'),
    errorType: name,
    scenarioStep: step,
    ...(expectedLogEvent === undefined ? {} : {expectedLogEvent}),
  });
}

export function correlateManagedBackendRequest({
  frontendResponse,
  backendEvents,
  operationId,
  routeTemplate,
  expectedOutcome = 'SUCCEEDED',
  expectedStatus = 200,
  expectedErrorCode = null,
}) {
  if (
    frontendResponse === null ||
    typeof frontendResponse?.requestId !== 'string' ||
    frontendResponse.requestId.length === 0 ||
    typeof frontendResponse?.correlationId !== 'string' ||
    frontendResponse.correlationId.length === 0 ||
    !Array.isArray(backendEvents) ||
    typeof operationId !== 'string' ||
    typeof routeTemplate !== 'string'
  )
    return false;
  const matches = backendEvents.filter(
    value =>
      value.requestId === frontendResponse.requestId &&
      value.correlationId === frontendResponse.correlationId &&
      value.routeTemplate === routeTemplate,
  );
  if (matches.length !== 1) return false;
  const [event] = matches;
  return (
    event.event === 'REQUEST_COMPLETED' &&
    event.operationId === operationId &&
    event.outcome === expectedOutcome &&
    (frontendResponse.status === null ||
      frontendResponse.status === undefined ||
      event.status === frontendResponse.status) &&
    event.status === expectedStatus &&
    event.owner === 'terminal-binding' &&
    event.consumerFace === 'terminal' &&
    (expectedErrorCode === null || event.errorCode === expectedErrorCode) &&
    Number.isSafeInteger(event.databaseOperationCount) &&
    event.databaseOperationCount >= 0
  );
}

export function correlateManagedHttpExchange({
  request,
  response,
  backendEvents,
  operationId,
  routeTemplate,
  expectedOutcome = 'SUCCEEDED',
  expectedStatus = 200,
  expectedErrorCode = null,
}) {
  if (
    request === null ||
    typeof request !== 'object' ||
    response === null ||
    typeof response !== 'object' ||
    request.operation !== response.operation ||
    request.method !== response.method
  )
    return false;
  return correlateManagedBackendRequest({
    frontendResponse: {
      ...request,
      requestId: response.requestId,
      correlationId: response.correlationId,
      status: response.status,
    },
    backendEvents,
    operationId,
    routeTemplate,
    expectedOutcome,
    expectedStatus,
    expectedErrorCode,
  });
}

export function projectManagedTdsLogLines(lines, nodeId, startedAt, finishedAt, finishGraceMillis = 0) {
  const start = Date.parse(startedAt);
  const finish = Date.parse(finishedAt);
  if (
    !Array.isArray(lines) ||
    typeof nodeId !== 'string' ||
    !/^[A-Za-z0-9._:-]{1,64}$/u.test(nodeId) ||
    !Number.isFinite(start) ||
    !Number.isFinite(finish) ||
    finish < start ||
    !Number.isSafeInteger(finishGraceMillis) ||
    finishGraceMillis < 0 ||
    finishGraceMillis > 10_000
  ) {
    throw new Error('WEB_TDS_LOG_PROJECTION_INPUT_INVALID');
  }
  const safeFields = [
    'connectionId',
    'sessionId',
    'stage',
    'failureType',
    'rootFailureType',
    'sqlState',
    'disposition',
    'applicationClose',
    'closeCode',
    'closeReason',
    'timeoutMillis',
    'frameType',
    'frameBytes',
    'outcome',
    'reason',
    'revokedGeneration',
    'targetCount',
    'queueDepth',
    'queueBytes',
  ];
  return Object.freeze(
    lines.flatMap(line => {
      const timestampText = line.match(/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?(?:Z|[+-]\d\d:\d\d))/u)?.[1];
      const event = line.match(/\bevent=(tds_(?:ws|session)_[A-Za-z0-9_]+)/u)?.[1];
      if (timestampText === undefined || event === undefined) return [];
      const timestamp = Date.parse(timestampText);
      if (!Number.isFinite(timestamp) || timestamp < start || timestamp > finish + finishGraceMillis) return [];
      const fields = Object.fromEntries(
        safeFields.flatMap(key => {
          const value = line.match(new RegExp(`\\b${key}=([^\\s]+)`, 'u'))?.[1];
          return value !== undefined && /^[A-Za-z0-9_.:-]{1,128}$/u.test(value) ? [[key, value]] : [];
        }),
      );
      return [Object.freeze({at: timestampText, nodeId, event, ...fields})];
    }),
  );
}

function normalizeConsoleUndefinedValues(value) {
  let normalized = '';
  let inString = false;
  let escaped = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      normalized += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      normalized += character;
      continue;
    }
    if (value.startsWith('undefined', index)) {
      const previous = value[index - 1];
      const next = value[index + 'undefined'.length];
      const isTokenStart = previous === undefined || !/[A-Za-z0-9_$]/u.test(previous);
      const isTokenEnd = next === undefined || !/[A-Za-z0-9_$]/u.test(next);
      if (isTokenStart && isTokenEnd) {
        normalized += 'null';
        index += 'undefined'.length - 1;
        continue;
      }
    }
    normalized += character;
  }
  return normalized;
}

export function isStructuredRuntimeLogEvent(value) {
  const validLayers = new Set(['kernel', 'ui', 'adapter', 'application']);
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Number.isFinite(value.timestamp) &&
    ['debug', 'info', 'warn', 'error'].includes(value.level) &&
    typeof value.category === 'string' &&
    value.category.length > 0 &&
    typeof value.event === 'string' &&
    value.event.length > 0 &&
    value.scope !== null &&
    typeof value.scope === 'object' &&
    !Array.isArray(value.scope) &&
    typeof value.scope.moduleName === 'string' &&
    value.scope.moduleName.length > 0 &&
    (value.scope.layer === undefined || validLayers.has(value.scope.layer)) &&
    value.security !== null &&
    typeof value.security === 'object' &&
    typeof value.security.containsSensitiveRaw === 'boolean' &&
    value.security.maskingMode === 'masked'
  );
}

export function isExpectedRuntimeLogEvent(value, expectedEvent) {
  if (!isStructuredRuntimeLogEvent(value) || value.event !== expectedEvent) return false;
  const expectedOwner = {
    'runtime.system-failure.reset-unavailable': {category: 'runtime.system-failure', moduleName: 'platform-ports'},
    'runtime.reset.completed': {category: 'runtime.lifecycle', moduleName: 'kernel.base.runtime'},
    'startup.complete': {category: 'startup.complete', moduleName: 'platform-ports'},
    'startup.ready-hidden': {category: 'startup.ready-hidden', moduleName: 'platform-ports'},
    'admin.launcher-geometry-measured': {category: 'admin.launcher', moduleName: 'platform-ports'},
    'admin.launcher-binding': {category: 'admin.launcher', moduleName: 'platform-ports'},
    'admin.launcher-open-requested': {category: 'admin.launcher', moduleName: 'platform-ports'},
    'admin.launcher-open-result': {category: 'admin.launcher', moduleName: 'platform-ports'},
    'render.layer-selection': {category: 'display-diagnostics', moduleName: 'platform-ports'},
  }[expectedEvent];
  if (expectedOwner === undefined) return true;
  const ownerMatches =
    value.category === expectedOwner.category &&
    value.scope.moduleName === expectedOwner.moduleName &&
    value.scope.layer === 'kernel';
  if (expectedEvent === 'runtime.system-failure.reset-unavailable') {
    return ownerMatches && value.context?.commandName === 'kernel.base.runtime.reset-runtime-after-system-failure';
  }
  return ownerMatches;
}

export function adminLauncherBindingReady(value, displayMode = 'PRIMARY') {
  return (
    isExpectedRuntimeLogEvent(value, 'admin.launcher-binding') &&
    value.data?.displayMode === displayMode &&
    value.data?.handlerAttached === true &&
    value.data?.hasAdminLayer === false
  );
}

export function launcherGeometryMatches(value, targetRect, targetViewport) {
  if (!isExpectedRuntimeLogEvent(value, 'admin.launcher-geometry-measured')) return false;
  const rect = value.data?.windowRect;
  const viewport = value.data?.windowDimensions;
  return (
    rect !== null &&
    typeof rect === 'object' &&
    viewport !== null &&
    typeof viewport === 'object' &&
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    Number.isFinite(targetRect.x) &&
    Number.isFinite(targetRect.y) &&
    Number.isFinite(viewport.width) &&
    Number.isFinite(viewport.height) &&
    viewport.width === targetViewport.width &&
    viewport.height === targetViewport.height &&
    Math.abs(rect.x - targetRect.x) <= 1 &&
    Math.abs(rect.y - targetRect.y) <= 1 &&
    Math.abs(rect.width - targetRect.width) <= 1 &&
    Math.abs(rect.height - targetRect.height) <= 1
  );
}

export function adminLauncherGesturePagePoint(geometry, logicalPoint = {x: 24, y: 24}) {
  const rect = geometry?.data?.windowRect;
  const canvas = geometry?.data?.canvas;
  if (
    !isExpectedRuntimeLogEvent(geometry, 'admin.launcher-geometry-measured') ||
    ![
      rect?.x,
      rect?.y,
      rect?.width,
      rect?.height,
      canvas?.width,
      canvas?.height,
      logicalPoint?.x,
      logicalPoint?.y,
    ].every(Number.isFinite) ||
    rect.width <= 0 ||
    rect.height <= 0 ||
    canvas.width <= 0 ||
    canvas.height <= 0 ||
    logicalPoint.x < 0 ||
    logicalPoint.x > 96 ||
    logicalPoint.y < 0 ||
    logicalPoint.y > 96
  ) {
    throw new Error('WEB_ADMIN_LAUNCHER_GEOMETRY_INVALID');
  }
  return Object.freeze({
    x: rect.x + (logicalPoint.x * rect.width) / canvas.width,
    y: rect.y + (logicalPoint.y * rect.height) / canvas.height,
  });
}

export function hasStartupContentFailureReadiness(events) {
  const completeIndex = events.findIndex(
    event =>
      isExpectedRuntimeLogEvent(event, 'startup.complete') &&
      event.data?.primaryContentFailure === 'render-error' &&
      event.data?.primaryRealReady === false &&
      typeof event.data?.startupRunId === 'string' &&
      event.data.startupRunId.length > 0,
  );
  if (completeIndex < 0) return false;
  const complete = events[completeIndex];
  return events
    .slice(completeIndex + 1)
    .some(
      event =>
        isExpectedRuntimeLogEvent(event, 'startup.ready-hidden') &&
        event.data?.contentFailure === 'render-error' &&
        event.data?.startupRunId === complete.data.startupRunId,
    );
}

export function verifyExpoWebListenerOwnership({stdout, status, stderr = '', ownedProcessTree}) {
  const listenerPids = parseListeningProcessIds(stdout, status, stderr);
  assertManagedWebListenerOwnership(listenerPids, ownedProcessTree);
  return listenerPids;
}

export const WEB_LAYER_OWNER_COVERAGE = Object.freeze({
  'layer:admin.console.layer': Object.freeze({
    integrations: 'both',
    journey: 'admin-launcher',
    surfaceForms: Object.freeze(['laptop', 'mobile']),
    status: 'WEB_REACHABLE',
  }),
  'layer:admin.console.power-confirmation.layer': Object.freeze({
    integrations: 'both',
    journey: null,
    surfaceForms: Object.freeze([]),
    status: 'OPEN',
    reason: 'production power-status subscription is unavailable in Web; no production Web trigger exists',
  }),
  'layer:sample.auth.notice': Object.freeze({
    integrations: 'both',
    journey: 'auth-business-failure',
    surfaceForms: Object.freeze(['laptop', 'mobile']),
    status: 'WEB_REACHABLE',
  }),
  'layer:sample.auth.system-notice': Object.freeze({
    integrations: 'both',
    journey: null,
    surfaceForms: Object.freeze([]),
    status: 'OPEN',
    reason: 'requires a production auth system-failure outcome; Web has no controlled failure result',
  }),
  'layer:sample.desk.waiting-confirm': Object.freeze({
    integrations: 'sample-console',
    journey: 'member-registration-pending',
    surfaceForms: Object.freeze(['laptop']),
    status: 'WEB_REACHABLE',
    requiresDualPreview: true,
  }),
  'layer:sample.desk.registry-notice': Object.freeze({
    integrations: 'sample-console',
    journey: 'member-registration-rejected',
    surfaceForms: Object.freeze(['laptop']),
    status: 'WEB_REACHABLE',
    requiresDualPreview: true,
  }),
  'layer:sample.desk.discard-confirm': Object.freeze({
    integrations: 'sample-console',
    journey: 'dirty-member-form-cancel',
    surfaceForms: Object.freeze(['laptop', 'mobile']),
    status: 'WEB_REACHABLE',
  }),
  'layer:sample.desk.withdraw-confirm': Object.freeze({
    integrations: 'sample-console',
    journey: 'member-registration-withdraw',
    surfaceForms: Object.freeze(['laptop']),
    status: 'WEB_REACHABLE',
    requiresDualPreview: true,
  }),
  'layer:sample.desk.system-notice': Object.freeze({
    integrations: 'sample-console',
    journey: null,
    surfaceForms: Object.freeze([]),
    status: 'OPEN',
    reason: 'requires a production member-system-failure outcome; Web has no controlled failure result',
  }),
  'layer:sample.wallpaper.system-notice': Object.freeze({
    integrations: 'sample-wallpaper-console',
    journey: null,
    surfaceForms: Object.freeze([]),
    status: 'OPEN',
    reason: 'requires a production wallpaper-system-failure outcome; Web has no controlled failure result',
  }),
});

export function enumerateWebLayerOwnerCoverage() {
  return Object.freeze(
    Object.entries(WEB_LAYER_OWNER_COVERAGE).flatMap(([owner, entry]) => {
      const integrations =
        entry.integrations === 'both' ? ['sample-console', 'sample-wallpaper-console'] : [entry.integrations];
      return integrations.map(integrationName =>
        Object.freeze({
          integrationName,
          owner,
          journey: entry.journey,
          surfaceForms: entry.surfaceForms,
          status: entry.status,
          reason: entry.reason ?? null,
        }),
      );
    }),
  );
}

const memberScreenOwners = new Set(['screen:main:sample.desk.member-list', 'screen:main:sample.desk.member-form']);

const secondaryScreenOwnerIntegrations = Object.freeze({
  'screen:main:sample.desk.customer-welcome': 'sample-console',
  'screen:main:sample.desk.customer-member': 'sample-console',
  'screen:main:sample.wallpaper-console.waiting': 'sample-wallpaper-console',
  'screen:main:sample.wallpaper-console.welcome': 'sample-wallpaper-console',
});

const isIntegrationAllowed = (allowed, actual) => allowed === 'both' || allowed === actual;

export function webScenarioScopeError({integrationName, webScenario, surfaceForm, failureOwner}) {
  if (!WEB_SCENARIOS.includes(webScenario)) return 'TER_ADMIN_DISPLAY_WEB_SCENARIO_INVALID';
  if (!['sample-console', 'sample-wallpaper-console'].includes(integrationName)) {
    return 'TER_ADMIN_DISPLAY_WEB_INTEGRATION_INVALID';
  }
  if (!['laptop', 'mobile'].includes(surfaceForm)) return 'TER_ADMIN_DISPLAY_WEB_SURFACE_FORM_INVALID';

  if (webScenario === 'screen-error-member-journey') {
    return integrationName === 'sample-console' && memberScreenOwners.has(failureOwner)
      ? null
      : 'WEB_SCREEN_ERROR_MEMBER_JOURNEY_SCOPE_INVALID';
  }

  if (webScenario === 'screen-error-secondary-journey') {
    return surfaceForm === 'laptop' && secondaryScreenOwnerIntegrations[failureOwner] === integrationName
      ? null
      : 'WEB_SCREEN_ERROR_SECONDARY_JOURNEY_SCOPE_INVALID';
  }

  if (webScenario === 'platform-ports-smoke') {
    return integrationName === 'sample-console' && surfaceForm === 'laptop' && failureOwner === null
      ? null
      : 'WEB_PLATFORM_PORTS_SMOKE_SCOPE_INVALID';
  }

  if (webScenario === 'layer-error-production-journey') {
    const target = WEB_LAYER_OWNER_COVERAGE[failureOwner];
    if (target?.status === 'OPEN') return `WEB_LAYER_ERROR_OWNER_WEB_TRIGGER_OPEN:${failureOwner}`;
    return target !== undefined &&
      target.journey !== null &&
      isIntegrationAllowed(target.integrations, integrationName) &&
      target.surfaceForms.includes(surfaceForm)
      ? null
      : 'WEB_LAYER_ERROR_PRODUCTION_JOURNEY_SCOPE_INVALID';
  }

  if (webScenario === 'keyboard-member-journey') {
    return integrationName === 'sample-console' && failureOwner === null ? null : 'WEB_KEYBOARD_JOURNEY_SCOPE_INVALID';
  }
  if (webScenario === 'keyboard-login') {
    return integrationName === 'sample-wallpaper-console' && failureOwner === null
      ? null
      : 'WEB_KEYBOARD_JOURNEY_SCOPE_INVALID';
  }
  if (webScenario === 'keyboard-overlay-ownership') {
    return integrationName === 'sample-console' && failureOwner === null ? null : 'WEB_KEYBOARD_JOURNEY_SCOPE_INVALID';
  }
  if (webScenario === 'textinput-contextmenu') {
    return failureOwner === null ? null : 'WEB_KEYBOARD_JOURNEY_SCOPE_INVALID';
  }
  if (webScenario === 'terminal-wallpaper-exit') {
    return integrationName === 'sample-wallpaper-console' && surfaceForm === 'laptop' && failureOwner === null
      ? null
      : 'WEB_TERMINAL_WALLPAPER_EXIT_SCOPE_INVALID';
  }
  if (webScenario === 'terminal-activation-owner-rejection') {
    return ['sample-console', 'sample-wallpaper-console'].includes(integrationName) &&
      surfaceForm === 'laptop' &&
      failureOwner === null
      ? null
      : 'WEB_TERMINAL_ACTIVATION_REJECTION_SCOPE_INVALID';
  }
  if (webScenario === 'terminal-server-config') {
    return failureOwner === null ? null : 'WEB_TERMINAL_SERVER_CONFIG_SCOPE_INVALID';
  }
  if (webScenario === 'terminal-activation-connection') {
    return failureOwner === null ? null : 'WEB_TERMINAL_ACTIVATION_SCOPE_INVALID';
  }

  return failureOwner === null || failureOwner === 'screen:main:sample.auth.login'
    ? null
    : 'WEB_ADMIN_RUNTIME_FAILURE_OWNER_INVALID';
}

export function ensureContainedWebDirectory(repositoryRoot, targetPath) {
  const repositoryRealRoot = fs.realpathSync(repositoryRoot);
  let targetCursor = path.resolve(targetPath);
  const unresolvedSegments = [];
  let targetRealPath;
  while (targetRealPath === undefined) {
    try {
      targetRealPath = path.join(fs.realpathSync(targetCursor), ...unresolvedSegments.reverse());
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.code !== 'ENOTDIR') throw error;
      const parent = path.dirname(targetCursor);
      if (parent === targetCursor) throw new Error('TER_ADMIN_DISPLAY_WEB_RUNTIME_PATH_INVALID');
      unresolvedSegments.push(path.basename(targetCursor));
      targetCursor = parent;
    }
  }
  const relativePath = path.relative(repositoryRealRoot, targetRealPath);
  if (relativePath.length === 0 || path.isAbsolute(relativePath) || relativePath.split(path.sep).includes('..')) {
    throw new Error('TER_ADMIN_DISPLAY_WEB_RUNTIME_PATH_INVALID');
  }
  let current = repositoryRealRoot;
  for (const segment of relativePath.split(path.sep)) {
    current = path.join(current, segment);
    try {
      fs.mkdirSync(current, {mode: 0o700});
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
    const stat = fs.lstatSync(current);
    const actual = fs.realpathSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !actual.startsWith(`${repositoryRealRoot}${path.sep}`)) {
      throw new Error('TER_ADMIN_DISPLAY_WEB_RUNTIME_PATH_INVALID');
    }
  }
  return current;
}

export function acquireManagedWebRunLock(lockPath, runId, {pid = process.pid, startToken}) {
  if (!Number.isInteger(pid) || pid <= 0 || typeof startToken !== 'string' || startToken.length === 0) {
    throw new Error('TER_ADMIN_DISPLAY_WEB_RUN_LOCK_IDENTITY_INVALID');
  }
  fs.mkdirSync(path.dirname(lockPath), {recursive: true});
  let fd;
  try {
    fd = fs.openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error('TER_ADMIN_DISPLAY_WEB_RUN_ALREADY_ACTIVE');
    throw error;
  }
  try {
    fs.writeFileSync(fd, `${JSON.stringify({runId, pid, startToken})}\n`);
    fs.fsyncSync(fd);
    return fd;
  } catch (error) {
    try {
      const opened = fs.fstatSync(fd);
      const current = fs.lstatSync(lockPath);
      if (opened.dev === current.dev && opened.ino === current.ino) fs.unlinkSync(lockPath);
    } catch {}
    try {
      fs.closeSync(fd);
    } catch {}
    throw error;
  }
}

export function releaseManagedWebRunLock(lockPath, fd, runId, {pid = process.pid, startToken}) {
  if (fd === null || fd === undefined) return;
  try {
    const opened = fs.fstatSync(fd);
    const currentPath = fs.lstatSync(lockPath);
    if (opened.dev !== currentPath.dev || opened.ino !== currentPath.ino) {
      throw new Error('TER_ADMIN_DISPLAY_WEB_RUN_LOCK_OWNERSHIP_MISMATCH');
    }
    const recorded = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
    if (recorded.runId !== runId || recorded.pid !== pid || recorded.startToken !== startToken) {
      throw new Error('TER_ADMIN_DISPLAY_WEB_RUN_LOCK_OWNERSHIP_MISMATCH');
    }
    fs.closeSync(fd);
    fs.unlinkSync(lockPath);
  } catch (error) {
    try {
      fs.closeSync(fd);
    } catch {}
    throw error;
  }
}

export const WEB_RUNNER_FIXED_SOURCE_FILES = Object.freeze([
  'package.json',
  'yarn.lock',
  '.yarnrc.yml',
  'turbo.json',
  'scripts/dev/managed-process-tree.mjs',
  'scripts/dev/managed-diagnostic-protocol.mjs',
  'scripts/dev/r5-dev-environment.mjs',
  'scripts/dev/r5-dev-runner.mjs',
  'scripts/dev/r5-doris-resident.mjs',
  'scripts/dev/r5-managed-terminal-topology.mjs',
  'scripts/dev/r5-remote-java-runtime.mjs',
  'scripts/dev/r5-remote-java.mjs',
  'scripts/dev/terminal-client-dev-acceptance-lock.mjs',
  'scripts/env/check-runtime-resource-budget',
  'scripts/test/terminal-client-dev-acceptance.mjs',
  'scripts/test/terminal-business-fixtures.mjs',
  'scripts/test/ter-admin-display-web-contract.mjs',
  'scripts/test/ter-admin-display-web.mjs',
  'scripts/test/ter-admin-display-web-stage.mjs',
  'scripts/test/ter-admin-display-web.test.mjs',
  'doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json',
]);

export function collectWebSourceFiles(
  repositoryRoot,
  listAppFiles = () =>
    execFileSync('git', ['ls-files', '-co', '--exclude-standard', '--', 'apps/terminal'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }),
) {
  const appFiles = String(listAppFiles())
    .split(/\r?\n/)
    .map(file => file.trim())
    .filter(Boolean);
  const files = [...new Set([...appFiles, ...WEB_RUNNER_FIXED_SOURCE_FILES])].sort((left, right) =>
    left.localeCompare(right),
  );
  if (files.length !== appFiles.length + WEB_RUNNER_FIXED_SOURCE_FILES.length) {
    throw new Error('TER_ADMIN_DISPLAY_WEB_SOURCE_INVENTORY_DUPLICATE');
  }
  const repositoryRealRoot = fs.realpathSync(repositoryRoot);
  for (const relativePath of files) {
    if (path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) {
      throw new Error('TER_ADMIN_DISPLAY_WEB_SOURCE_PATH_INVALID');
    }
    const absolutePath = path.resolve(repositoryRealRoot, relativePath);
    if (!absolutePath.startsWith(`${repositoryRealRoot}${path.sep}`)) {
      throw new Error('TER_ADMIN_DISPLAY_WEB_SOURCE_PATH_INVALID');
    }
    const realPath = fs.realpathSync(absolutePath);
    if (!realPath.startsWith(`${repositoryRealRoot}${path.sep}`) || !fs.statSync(realPath).isFile()) {
      throw new Error('TER_ADMIN_DISPLAY_WEB_SOURCE_PATH_INVALID');
    }
  }
  return Object.freeze(files);
}

export function hashWebSourceFiles(repositoryRoot, files) {
  const hash = createHash('sha256');
  for (const relativePath of files) {
    hash.update(relativePath);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(repositoryRoot, relativePath)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function sourceSnapshotsMatch(before, after) {
  return (
    before.sha256 === after.sha256 &&
    before.files.length === after.files.length &&
    before.files.every((file, index) => file === after.files[index])
  );
}

export function applyWebSourceSnapshot(manifest, before, after) {
  manifest.sourceFilesAfterCount = after.files.length;
  manifest.sourceSha256After = after.sha256;
  manifest.sourceStable = sourceSnapshotsMatch(before, after) ? 'PASS' : 'FAIL';
  if (manifest.sourceStable === 'FAIL' && manifest.business === 'PASS') {
    manifest.lastKnownGood = 'PASS';
    manifest.firstFailure ??= 'WEB_SOURCE_CHANGED_DURING_RUN';
    manifest.business = 'FAIL';
  }
  return manifest.sourceStable;
}

export function applyWebSourceRecheckFailure(manifest, error) {
  manifest.sourceStable = 'UNKNOWN';
  if (manifest.business === 'PASS') {
    manifest.lastKnownGood = 'PASS';
    manifest.firstFailure = 'WEB_SOURCE_RECHECK_FAILED';
    manifest.firstFailureDetails = projectWebFailureDiagnostic(error, 'SOURCE_RECHECK');
    manifest.business = 'FAIL';
  }
}

export function createExpoWebLaunchSpec(integrationRoot, port, inheritedEnv = process.env) {
  return Object.freeze({
    command: 'yarn',
    args: Object.freeze(['web', '--port', String(port)]),
    options: Object.freeze({
      cwd: integrationRoot,
      detached: true,
      stdio: Object.freeze(['ignore', 'pipe', 'pipe']),
      env: Object.freeze({...inheritedEnv, CI: '1'}),
    }),
  });
}

export function fetchExpoWebReadiness(fetchImpl, url, timeoutMs = 1_000) {
  if (typeof fetchImpl !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error('EXPO_WEB_READINESS_REQUEST_INVALID');
  }
  return fetchImpl(url, {signal: AbortSignal.timeout(timeoutMs)});
}

export function awaitManagedChildSpawn(child) {
  return new Promise(resolve => {
    const onSpawn = () => {
      child.off('error', onError);
      resolve(null);
    };
    const onError = error => {
      child.off('spawn', onSpawn);
      resolve(error);
    };
    child.once('spawn', onSpawn);
    child.once('error', onError);
  });
}

export function parseListeningProcessIds(stdout, status, stderr = '') {
  const output = String(stdout ?? '').trim();
  const errorOutput = String(stderr ?? '').trim();
  if (status === 1 && output.length === 0 && errorOutput.length === 0) return Object.freeze([]);
  if (status !== 0 || output.length === 0) throw new Error('WEB_PORT_LISTENER_READBACK_FAILED');
  const values = output.split(/\r?\n/).map(value => value.trim());
  if (values.some(value => !/^\d{1,10}$/.test(value) || Number(value) <= 0)) {
    throw new Error('WEB_PORT_LISTENER_READBACK_MALFORMED');
  }
  return Object.freeze([...new Set(values.map(Number))].sort((left, right) => left - right));
}

export function assertManagedWebListenerOwnership(listenerPids, ownedProcessTree) {
  if (!Array.isArray(listenerPids) || listenerPids.length === 0 || !Array.isArray(ownedProcessTree)) {
    throw new Error('WEB_PORT_LISTENER_NOT_OBSERVED');
  }
  const ownedPids = new Set(
    ownedProcessTree
      .filter(process => process?.ownershipUnverified !== true)
      .map(process => process?.pid)
      .filter(pid => Number.isInteger(pid) && pid > 0),
  );
  if (listenerPids.some(pid => !ownedPids.has(pid))) {
    throw new Error('WEB_PORT_LISTENER_NOT_OWNED_BY_RUNNER');
  }
  return true;
}

export function pipeExpoOutput(stdout, stderr, destination) {
  stdout.pipe(destination, {end: false});
  stderr.pipe(destination, {end: false});
}

export async function sendProtectedInputKeyboardProbe(keyboard) {
  await keyboard.type('Z');
  await keyboard.press('Tab');
  await keyboard.down('Shift');
  await keyboard.press('Tab');
  await keyboard.up('Shift');
  await keyboard.type('SCAN');
  await keyboard.press('Enter');
}
