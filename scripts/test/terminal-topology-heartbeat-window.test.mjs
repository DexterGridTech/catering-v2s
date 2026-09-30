import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {EventEmitter} from 'node:events';
import {
  evaluateHeartbeatOnlyWindow,
  findUniqueUiNodeById,
  hasExactScopedResourceText,
  readScopedUiEvidence,
  readHeartbeatTopologyFromXml,
  topologyPeerEventsBetweenMarkers,
  topologyLifecycleSnapshot,
} from '../../tools/terminal-topology/heartbeat-window.mjs';
import {waitForRoleOccupancyProbe} from '../../tools/terminal-topology/role-occupancy-probe.mjs';

const baseline = Object.freeze({
  startedMonotonicMs: 1_000,
  endedMonotonicMs: 91_000,
  heartbeatIntervalMs: 10_000,
  heartbeatTimeoutMs: 30_000,
  startProcesses: {master: {pid: '101', startTicks: '10001'}, slave: {pid: '202', startTicks: '20002'}},
  endProcesses: {master: {pid: '101', startTicks: '10001'}, slave: {pid: '202', startTicks: '20002'}},
  startTopology: {
    master: {role: 'MASTER', pairState: 'PAIRED', reachability: 'REACHABLE'},
    slave: {role: 'SLAVE', pairState: 'PAIRED', reachability: 'REACHABLE'},
  },
  endTopology: {
    master: {role: 'MASTER', pairState: 'PAIRED', reachability: 'REACHABLE'},
    slave: {role: 'SLAVE', pairState: 'PAIRED', reachability: 'REACHABLE'},
  },
  startLifecycle: {master: lifecycleCounts(), slave: lifecycleCounts()},
  endLifecycle: {master: lifecycleCounts(), slave: lifecycleCounts()},
  peerEventsDuringWindow: {
    master: [
      {event: 'topology.peer.frame-received', messageType: 'ping'},
      {event: 'topology.peer.frame-sent', messageType: 'pong'},
    ],
    slave: [{event: 'topology.peer.frame-received', messageType: 'pong'}],
  },
});

function lifecycleCounts(overrides = {}) {
  return {
    'topology.peer.accepted': 1,
    'topology.peer.channel-anomaly': 0,
    'topology.peer.closed-error-received': 0,
    'topology.peer.loss': 0,
    'topology.peer.reconnect-scheduled': 0,
    'topology.peer.session-installed': 1,
    ...overrides,
  };
}

test('heartbeat-only window accepts a stable production three-timeout interval', () => {
  assert.deepEqual(evaluateHeartbeatOnlyWindow(baseline), {
    status: 'PASS',
    elapsedMs: 90_000,
    minimumWindowMs: 90_000,
    heartbeatIntervalMs: 10_000,
    heartbeatTimeoutMs: 30_000,
    nonHeartbeatPeerEventCount: 0,
    violations: [],
  });
});

test('heartbeat-only window does not confuse rolling lifecycle-log eviction with an in-window reconnect', () => {
  const result = evaluateHeartbeatOnlyWindow({
    ...baseline,
    endLifecycle: {
      master: lifecycleCounts({'topology.peer.session-installed': 0}),
      slave: lifecycleCounts({'topology.peer.session-installed': 0}),
    },
  });
  assert.equal(result.status, 'PASS');
  assert.deepEqual(result.violations, []);

  const disconnected = evaluateHeartbeatOnlyWindow({
    ...baseline,
    peerEventsDuringWindow: {
      ...baseline.peerEventsDuringWindow,
      slave: [...baseline.peerEventsDuringWindow.slave, {event: 'topology.peer.loss', messageType: null}],
    },
  });
  assert.equal(disconnected.status, 'FAIL');
  assert.deepEqual(disconnected.violations, ['non-heartbeat-peer-activity-observed']);
});

test('heartbeat-only event window requires intact markers and detects app-level peer traffic', () => {
  const logs = [
    '1727700000.000  9  9 I TER_TOPOLOGY_A7: start-marker',
    '1727700001.000  101  101 I ReactNativeJS: { timestamp: 1727700001000,',
    "1727700001.000  101  101 I ReactNativeJS:   event: 'topology.peer.frame-received',",
    "1727700001.000  101  101 I ReactNativeJS:   data: { messageType: 'ping' } }",
    '1727700002.000  101  101 I ReactNativeJS: { timestamp: 1727700002000,',
    "1727700002.000  101  101 I ReactNativeJS:   event: 'topology.peer.frame-sent',",
    "1727700002.000  101  101 I ReactNativeJS:   data: { messageType: 'state-full' } }",
    '1727700003.000  9  9 I TER_TOPOLOGY_A7: end-marker',
    '1727700004.000  101  101 I ReactNativeJS: { timestamp: 1727700004000,',
    "1727700004.000  101  101 I ReactNativeJS:   event: 'topology.peer.frame-sent',",
    "1727700004.000  101  101 I ReactNativeJS:   data: { messageType: 'pong' } }",
  ].join('\n');
  assert.deepEqual(
    topologyPeerEventsBetweenMarkers(logs, {
      startMarker: 'start-marker',
      endMarker: 'end-marker',
      processId: 101,
    }),
    [
      {event: 'topology.peer.frame-received', messageType: 'ping'},
      {event: 'topology.peer.frame-sent', messageType: 'state-full'},
    ],
  );
  assert.throws(
    () => topologyPeerEventsBetweenMarkers(logs, {startMarker: 'missing', endMarker: 'end-marker', processId: 101}),
    /TP_A7_LOG_WINDOW_MARKERS_INCOMPLETE/,
  );
  assert.throws(
    () =>
      topologyPeerEventsBetweenMarkers(`${logs}\n${logs.split('\n')[0]}`, {
        startMarker: 'start-marker',
        endMarker: 'end-marker',
        processId: 101,
      }),
    /TP_A7_LOG_WINDOW_MARKERS_INCOMPLETE/,
  );

  const result = evaluateHeartbeatOnlyWindow({
    ...baseline,
    peerEventsDuringWindow: {
      ...baseline.peerEventsDuringWindow,
      master: [
        ...baseline.peerEventsDuringWindow.master,
        {event: 'topology.peer.frame-sent', messageType: 'state-full'},
      ],
    },
  });
  assert.equal(result.status, 'FAIL');
  assert.deepEqual(result.violations, ['non-heartbeat-peer-activity-observed']);
  assert.equal(result.nonHeartbeatPeerEventCount, 1);
});

test('TP-A7 marker extraction survives more than 5000 unrelated buffered rows without capping the read', () => {
  const source = readFileSync(new URL('../../tools/terminal-topology/run-dual-device.mjs', import.meta.url), 'utf8');
  const lifecycleStart = source.indexOf('const readHeartbeatLifecycle =');
  const lifecycleEnd = source.indexOf('\n};', lifecycleStart);
  const eventsStart = source.indexOf('const readHeartbeatPeerEvents =');
  const eventsEnd = source.indexOf('\n};', eventsStart);
  assert.ok(lifecycleStart >= 0 && lifecycleEnd > lifecycleStart);
  assert.ok(eventsStart >= 0 && eventsEnd > eventsStart);
  for (const reader of [source.slice(lifecycleStart, lifecycleEnd), source.slice(eventsStart, eventsEnd)]) {
    assert.match(reader, /\['logcat', '-b', 'main', '-d', '-v', 'epoch'\]/);
    assert.doesNotMatch(reader, /'-t',\s*'\d+'/);
  }

  const start = '1727700000.000  9  9 I TER_TOPOLOGY_A7: start-marker';
  const end = '1727700100.000  9  9 I TER_TOPOLOGY_A7: end-marker';
  const noisyRows = Array.from({length: 5_001}, (_, index) => `1727700001.${index}  9  9 I Noise: row-${index}`);
  const heartbeatRows = [
    '1727700002.000  101  101 I ReactNativeJS: { timestamp: 1727700002000,',
    "1727700002.000  101  101 I ReactNativeJS:   event: 'topology.peer.frame-received',",
    "1727700002.000  101  101 I ReactNativeJS:   data: { messageType: 'ping' } }",
  ];
  const observed = topologyPeerEventsBetweenMarkers([start, ...noisyRows, ...heartbeatRows, end].join('\n'), {
    startMarker: 'start-marker',
    endMarker: 'end-marker',
    processId: 101,
  });
  assert.deepEqual(observed, [{event: 'topology.peer.frame-received', messageType: 'ping'}]);
});

test('heartbeat-only window rejects missing or role-inverted ping/pong traffic', () => {
  const missing = evaluateHeartbeatOnlyWindow({
    ...baseline,
    peerEventsDuringWindow: {master: [], slave: []},
  });
  assert.equal(missing.status, 'FAIL');
  assert.deepEqual(missing.violations, ['heartbeat-traffic-unobserved']);

  const wrongDirection = evaluateHeartbeatOnlyWindow({
    ...baseline,
    peerEventsDuringWindow: {
      ...baseline.peerEventsDuringWindow,
      master: [
        {event: 'topology.peer.frame-sent', messageType: 'ping'},
        {event: 'topology.peer.frame-received', messageType: 'pong'},
      ],
    },
  });
  assert.equal(wrongDirection.status, 'FAIL');
  assert.deepEqual(wrongDirection.violations, ['non-heartbeat-peer-activity-observed', 'heartbeat-traffic-unobserved']);
});

test('heartbeat-only window rejects a short interval, lifecycle transition, process restart, or state change', () => {
  const short = evaluateHeartbeatOnlyWindow({...baseline, endedMonotonicMs: 90_999});
  assert.equal(short.status, 'FAIL');
  assert.deepEqual(short.violations, ['window-shorter-than-three-timeouts']);

  const reconnect = evaluateHeartbeatOnlyWindow({
    ...baseline,
    peerEventsDuringWindow: {
      ...baseline.peerEventsDuringWindow,
      master: [...baseline.peerEventsDuringWindow.master, {event: 'topology.peer.loss', messageType: null}],
    },
  });
  assert.equal(reconnect.status, 'FAIL');
  assert.deepEqual(reconnect.violations, ['non-heartbeat-peer-activity-observed']);

  const restarted = evaluateHeartbeatOnlyWindow({
    ...baseline,
    endProcesses: {...baseline.endProcesses, master: {pid: '103', startTicks: '10003'}},
  });
  assert.equal(restarted.status, 'FAIL');
  assert.deepEqual(restarted.violations, ['process-lifecycle-changed']);

  const changed = evaluateHeartbeatOnlyWindow({
    ...baseline,
    endTopology: {...baseline.endTopology, slave: {...baseline.endTopology.slave, reachability: 'RECONNECTING'}},
  });
  assert.equal(changed.status, 'FAIL');
  assert.deepEqual(changed.violations, ['paired-reachability-or-role-changed']);
});

test('heartbeat-only acceptance fails closed when any required snapshot or timing input is absent', () => {
  const incompleteCases = [
    {...baseline, startProcesses: undefined, endProcesses: undefined},
    {...baseline, startProcesses: {...baseline.startProcesses, master: {pid: '101', startTicks: 'unknown'}}},
    {...baseline, endProcesses: {...baseline.endProcesses, slave: {pid: 202, startTicks: 20002}}},
    {...baseline, startTopology: undefined, endTopology: undefined},
    {...baseline, startLifecycle: undefined, endLifecycle: undefined},
    {...baseline, peerEventsDuringWindow: undefined},
    {...baseline, peerEventsDuringWindow: {master: ['topology.peer.frame-sent'], slave: []}},
    {...baseline, heartbeatIntervalMs: undefined},
    {...baseline, heartbeatTimeoutMs: 0},
  ];
  for (const input of incompleteCases) {
    const result = evaluateHeartbeatOnlyWindow(input);
    assert.equal(result.status, 'FAIL');
    assert.ok(result.violations.length > 0);
  }
});

test('heartbeat-only acceptance fails closed when lifecycle logs contain no proven paired-session baseline', () => {
  const emptyEvents = {
    master: lifecycleCounts(Object.fromEntries(Object.keys(lifecycleCounts()).map(key => [key, 0]))),
    slave: lifecycleCounts(Object.fromEntries(Object.keys(lifecycleCounts()).map(key => [key, 0]))),
  };
  const result = evaluateHeartbeatOnlyWindow({...baseline, startLifecycle: emptyEvents, endLifecycle: emptyEvents});
  assert.equal(result.status, 'FAIL');
  assert.deepEqual(result.violations, ['peer-connection-baseline-unobserved']);
});

test('lifecycle snapshot counts only exact peer lifecycle events', () => {
  const logcat = [
    "09-29 04:32:56.752 2770 3713 I ReactNativeJS:   event: 'topology.peer.session-installed',",
    '09-29 04:32:56.752 2770 3713 I ReactNativeJS:   message: "event: \'topology.peer.loss\'",',
    "09-29 04:32:56.803 2770 3713 I ReactNativeJS:   event: 'topology.peer.loss-ignored-closing',",
    "09-29 04:32:56.809 2770 3713 I ReactNativeJS:   event: 'topology.peer.session-installed',",
    "09-29 04:32:56.809 2770 3713 I ReactNativeJS:   event: 'topology.peer.loss',",
    "09-29 04:32:56.810 2770 3713 I ReactNativeJS:   event: 'topology.peer.reconnect-scheduled',",
  ].join('\n');
  assert.deepEqual(topologyLifecycleSnapshot(logcat), {
    'topology.peer.accepted': 0,
    'topology.peer.channel-anomaly': 0,
    'topology.peer.closed-error-received': 0,
    'topology.peer.loss': 1,
    'topology.peer.reconnect-scheduled': 1,
    'topology.peer.session-installed': 2,
  });
});

test('lifecycle snapshot ignores event-name text that is not the structured event field', () => {
  const snapshot = topologyLifecycleSnapshot(
    [
      'ReactNativeJS: message: "event: \'topology.peer.loss\'",',
      "ReactNativeJS: event: 'topology.peer.loss-ignored-closing',",
    ].join('\n'),
  );
  assert.equal(snapshot['topology.peer.loss'], 0);
  assert.equal(snapshot['topology.peer.loss-ignored-closing'], undefined);
});

test('topology readback takes visible status text from descendants inside each testID subtree', () => {
  const xml = [
    '<hierarchy>',
    '<node text="" resource-id="terminal.admin:topology:role" bounds="[0,0][100,60]">',
    '<node text="当前角色" resource-id="" bounds="[4,4][96,24]" />',
    '<node text="主机" resource-id="" bounds="[4,28][96,56]" />',
    '</node>',
    '<node text="" resource-id="terminal.admin:topology:pair-state" bounds="[110,0][210,60]">',
    '<node text="配对状态" resource-id="" bounds="[114,4][206,24]" />',
    '<node text="已配对" resource-id="" bounds="[114,28][206,56]" />',
    '</node>',
    '<node text="" resource-id="terminal.admin:topology:reachability" bounds="[220,0][320,60]">',
    '<node text="对端连接" resource-id="" bounds="[224,4][316,24]" />',
    '<node text="可达" resource-id="" bounds="[224,28][316,56]" />',
    '</node>',
    '<node text="副机" resource-id="" bounds="[4,28][96,56]" />',
    '<node text="重连中" resource-id="" bounds="[224,28][316,56]" />',
    '</hierarchy>',
  ].join('');
  assert.deepEqual(readHeartbeatTopologyFromXml(xml), {
    role: 'MASTER',
    pairState: 'PAIRED',
    reachability: 'REACHABLE',
  });
});

test('exact topology status matching does not treat unreachable as reachable', () => {
  const xml = [
    '<hierarchy>',
    '<node text="" resource-id="terminal.admin:topology:reachability" bounds="[0,0][320,60]">',
    '<node text="不可达" resource-id="" bounds="[4,28][316,56]" />',
    '</node>',
    '</hierarchy>',
  ].join('');
  const substringEvidence = readScopedUiEvidence(xml, ['terminal.admin:topology:reachability'], ['可达']);

  assert.deepEqual(substringEvidence.missingTexts, [], 'generic copy matching demonstrates the prior false green');
  assert.equal(hasExactScopedResourceText(xml, 'terminal.admin:topology:reachability', '不可达'), true);
  assert.equal(
    hasExactScopedResourceText(xml, 'terminal.admin:topology:reachability', '可达'),
    false,
    'the negative status must not satisfy the positive status assertion',
  );
});

test('topology readback fails closed when a status is missing or duplicated', () => {
  const xml = [
    '<hierarchy>',
    '<node text="" resource-id="terminal.admin:topology:role" bounds="[0,0][100,60]">',
    '<node text="副机" resource-id="" bounds="[4,28][96,56]" />',
    '</node>',
    '<node text="" resource-id="terminal.admin:topology:pair-state" bounds="[110,0][210,60]">',
    '<node text="未配对" resource-id="" bounds="[114,28][206,56]" />',
    '</node>',
    '<node text="" resource-id="terminal.admin:topology:reachability" bounds="[220,0][320,60]">',
    '<node text="未知" resource-id="" bounds="[224,28][316,56]" />',
    '</node>',
    '<node text="可达" resource-id="terminal.admin:topology:reachability" bounds="[330,0][430,60]">',
    '<node text="可达" resource-id="" bounds="[334,4][426,56]" />',
    '</node>',
    '</hierarchy>',
  ].join('');
  assert.deepEqual(readHeartbeatTopologyFromXml(xml), {
    role: 'SLAVE',
    pairState: 'UNPAIRED',
    reachability: 'UNKNOWN',
  });

  const ambiguousXml = [
    '<hierarchy>',
    '<node text="" resource-id="terminal.admin:topology:role" bounds="[0,0][100,60]">',
    '<node text="主机" resource-id="" bounds="[4,28][96,56]" />',
    '<node text="副机" resource-id="" bounds="[4,28][96,56]" />',
    '</node>',
    '<node text="" resource-id="terminal.admin:topology:pair-state" bounds="[110,0][210,60]">',
    '<node text="已配对" resource-id="" bounds="[114,28][206,56]" />',
    '<node text="未配对" resource-id="" bounds="[114,28][206,56]" />',
    '</node>',
    '<node text="" resource-id="terminal.admin:topology:reachability" bounds="[220,0][320,60]">',
    '<node text="可达" resource-id="" bounds="[224,28][316,56]" />',
    '<node text="重连中" resource-id="" bounds="[224,28][316,56]" />',
    '</node>',
    '</hierarchy>',
  ].join('');
  assert.deepEqual(readHeartbeatTopologyFromXml(ambiguousXml), {
    role: 'UNKNOWN',
    pairState: 'UNKNOWN',
    reachability: 'UNKNOWN',
  });
});

test('topology readback ignores a matching status in an unrelated overlapping sibling', () => {
  const xml = [
    '<hierarchy>',
    '<node text="" resource-id="terminal.admin:topology:role" bounds="[0,0][100,60]">',
    '<node text="当前角色" resource-id="" bounds="[4,4][96,24]" />',
    '</node>',
    '<node text="主机" resource-id="" bounds="[4,28][96,56]" />',
    '<node text="" resource-id="terminal.admin:topology:pair-state" bounds="[110,0][210,60]">',
    '<node text="已配对" resource-id="" bounds="[114,28][206,56]" />',
    '</node>',
    '<node text="" resource-id="terminal.admin:topology:reachability" bounds="[220,0][320,60]">',
    '<node text="可达" resource-id="" bounds="[224,28][316,56]" />',
    '</node>',
    '</hierarchy>',
  ].join('');

  assert.deepEqual(readHeartbeatTopologyFromXml(xml), {
    role: 'UNKNOWN',
    pairState: 'PAIRED',
    reachability: 'REACHABLE',
  });
});

test('scoped UI evidence reports actual descendant text rather than copying expected values', () => {
  const xml = [
    '<hierarchy>',
    '<node resource-id="sample.desk.customer-member" text="">',
    '<node resource-id="sample.desk.customer-member:name" text="Alice &amp; Lin" />',
    '<node resource-id="sample.desk.customer-member:phone" text="5551234567" />',
    '</node>',
    '<node resource-id="unrelated.hidden-node" text="unrelated" />',
    '</hierarchy>',
  ].join('');
  const evidence = readScopedUiEvidence(xml, ['sample.desk.customer-member'], ['Alice & Lin', '5551234567'], value =>
    value.replace(/\b\d{10,11}\b/g, '[PHONE_REDACTED]'),
  );

  assert.equal(evidence.hierarchyValid, true);
  assert.deepEqual(evidence.missingIds, []);
  assert.deepEqual(evidence.missingTexts, []);
  assert.deepEqual(evidence.observedText, ['Alice & Lin', '[PHONE_REDACTED]']);
  assert.deepEqual(evidence.observedIds, [
    'sample.desk.customer-member',
    'sample.desk.customer-member:name',
    'sample.desk.customer-member:phone',
    'unrelated.hidden-node',
  ]);
});

test('scoped UI evidence rejects matching text outside the required resource subtree', () => {
  const evidence = readScopedUiEvidence(
    [
      '<hierarchy>',
      '<node resource-id="sample.desk.customer-member" text="">',
      '<node resource-id="sample.desk.customer-member:title" text="请确认登记" />',
      '</node>',
      '<node resource-id="unrelated.hidden-node" text="Alice" />',
      '</hierarchy>',
    ].join(''),
    ['sample.desk.customer-member'],
    ['Alice'],
  );

  assert.deepEqual(evidence.missingTexts, ['Alice']);
  assert.deepEqual(evidence.observedText, ['请确认登记']);
});

test('scoped UI evidence excludes matching IDs and text outside the selected frame subtree', () => {
  const evidence = readScopedUiEvidence(
    [
      '<hierarchy>',
      '<node resource-id="terminal.admin:frame:IA-01" text="">',
      '<node resource-id="terminal.admin:frame:IA-01:title" text="运行状态" />',
      '</node>',
      '<node resource-id="terminal.admin:frame:IA-02" text="">',
      '<node resource-id="terminal.admin:frame:IA-01:control" text="伪造控件" />',
      '</node>',
      '</hierarchy>',
    ].join(''),
    ['terminal.admin:frame:IA-01', 'terminal.admin:frame:IA-01:control'],
    ['伪造控件'],
    undefined,
    'terminal.admin:frame:IA-01',
  );

  assert.equal(evidence.scopeValid, true);
  assert.deepEqual(evidence.missingIds, ['terminal.admin:frame:IA-01:control']);
  assert.deepEqual(evidence.missingTexts, ['伪造控件']);
  assert.deepEqual(evidence.observedIds, ['terminal.admin:frame:IA-01', 'terminal.admin:frame:IA-01:title']);
});

test('scoped UI evidence fails closed when the requested frame root is absent or duplicated', () => {
  for (const xml of [
    '<hierarchy><node resource-id="other" text="Ready" /></hierarchy>',
    '<hierarchy><node resource-id="frame" text="one" /><node resource-id="frame" text="two" /></hierarchy>',
  ]) {
    const evidence = readScopedUiEvidence(xml, ['control'], ['Ready'], undefined, 'frame');
    assert.equal(evidence.scopeValid, false);
    assert.deepEqual(evidence.missingIds, ['control']);
    assert.deepEqual(evidence.missingTexts, ['Ready']);
    assert.deepEqual(evidence.observedIds, []);
  }
});

test('uiautomator control lookup uses a unique node from a complete XML hierarchy', () => {
  const unique = findUniqueUiNodeById(
    '<hierarchy><node resource-id="target" text="Save &amp; close" bounds="[10,20][110,60]" enabled="true" /></hierarchy>',
    'target',
  );
  assert.deepEqual(unique, {
    tag: '<node resource-id="target" text="Save &amp; close" bounds="[10,20][110,60]" enabled="true" />',
    text: 'Save & close',
    left: 10,
    top: 20,
    right: 110,
    bottom: 60,
    enabled: true,
  });
  assert.equal(
    findUniqueUiNodeById(
      '<hierarchy><node resource-id="target" text="first" bounds="[0,0][10,10]"/><node resource-id="target" text="second" bounds="[0,0][10,10]"/></hierarchy>',
      'target',
    ),
    null,
  );
  assert.equal(
    findUniqueUiNodeById(
      '<hierarchy><!-- <node resource-id="target" text="fake" bounds="[0,0][10,10]" /> --></hierarchy>',
      'target',
    ),
    null,
  );
});

test('scoped UI evidence fails closed for incomplete hierarchy XML', () => {
  const evidence = readScopedUiEvidence(
    '<hierarchy><node resource-id="sample.desk.customer-member" text="Alice">',
    ['sample.desk.customer-member'],
    ['Alice'],
  );

  assert.equal(evidence.hierarchyValid, false);
  assert.deepEqual(evidence.missingTexts, ['Alice']);
});

test('scoped UI evidence ignores commented-out nodes and rejects ambiguous required IDs', () => {
  const commented = readScopedUiEvidence(
    '<hierarchy><!-- <node resource-id="target" text="Ready" /> --></hierarchy>',
    ['target'],
    ['Ready'],
  );
  assert.equal(commented.hierarchyValid, true);
  assert.deepEqual(commented.missingIds, ['target']);
  assert.deepEqual(commented.missingTexts, ['Ready']);

  const duplicate = readScopedUiEvidence(
    '<hierarchy><node resource-id="target" text="Ready"/><node resource-id="target" text="Ready"/></hierarchy>',
    ['target'],
    [],
  );
  assert.deepEqual(duplicate.ambiguousIds, ['target']);
  assert.deepEqual(duplicate.scopedTextById.target, []);
});

test('scoped UI evidence rejects a missing hierarchy root and mismatched element nesting', () => {
  for (const xml of [
    '<node resource-id="target" text="Ready"/>',
    '<hierarchy><node resource-id="target" text="Ready"></hierarchy>',
    '<hierarchy><node resource-id="target" text="Ready"/></not-hierarchy>',
  ]) {
    const evidence = readScopedUiEvidence(xml, ['target'], ['Ready']);
    assert.equal(evidence.hierarchyValid, false);
    assert.deepEqual(evidence.missingIds, ['target']);
    assert.deepEqual(evidence.missingTexts, ['Ready']);
  }
});

test('role-occupancy probe clears its deadline and listeners and closes the socket when an error rejects', async () => {
  class ProbeSocket extends EventEmitter {
    closeCalls = 0;
    close() {
      this.closeCalls += 1;
    }
  }
  const socket = new ProbeSocket();
  let deadline = null;
  const cleared = [];
  const probe = waitForRoleOccupancyProbe(socket, 10_000, {
    setTimeout(callback, delay) {
      deadline = {callback, delay};
      return deadline;
    },
    clearTimeout(timer) {
      cleared.push(timer);
    },
  });
  const expectedError = new Error('socket read failed');
  socket.emit('error', expectedError);
  await assert.rejects(probe, error => error === expectedError);
  assert.equal(deadline?.delay, 10_000);
  assert.deepEqual(cleared, [deadline]);
  assert.equal(socket.closeCalls, 1);
  assert.equal(socket.listenerCount('message'), 0);
  assert.equal(socket.listenerCount('close'), 1);
  socket.emit('close', 1000, '');
  assert.equal(socket.listenerCount('close'), 0);
  assert.equal(socket.listenerCount('error'), 0);
});

test('role-occupancy probe accepts only the typed role-occupied rejection', async () => {
  class ProbeSocket extends EventEmitter {
    closeCalls = 0;
    close() {
      this.closeCalls += 1;
    }
  }
  const socket = new ProbeSocket();
  const cleared = [];
  const probe = waitForRoleOccupancyProbe(socket, 10_000, {
    setTimeout(callback) {
      return callback;
    },
    clearTimeout(timer) {
      cleared.push(timer);
    },
  });
  socket.emit(
    'message',
    Buffer.from(JSON.stringify({type: 'hello-rejected', error: {code: 'TOPOLOGY_ROLE_OCCUPIED'}})),
  );
  assert.deepEqual(await probe, {status: 'PASS', messageType: 'hello-rejected', reasonCode: 'TOPOLOGY_ROLE_OCCUPIED'});
  assert.equal(socket.closeCalls, 1);
  assert.equal(cleared.length, 1);
});

test('role-occupancy probe reports a different typed rejection instead of timing out', async () => {
  class ProbeSocket extends EventEmitter {
    closeCalls = 0;
    close() {
      this.closeCalls += 1;
    }
  }
  const socket = new ProbeSocket();
  const probe = waitForRoleOccupancyProbe(socket, 10_000, {
    setTimeout(callback) {
      return callback;
    },
    clearTimeout() {},
  });
  socket.emit(
    'message',
    Buffer.from(JSON.stringify({type: 'hello-rejected', error: {code: 'TOPOLOGY_PROTOCOL_INVALID'}})),
  );
  assert.deepEqual(await probe, {
    status: 'FAIL',
    messageType: 'hello-rejected',
    reasonCode: 'TOPOLOGY_PROTOCOL_INVALID',
  });
  assert.equal(socket.closeCalls, 1);
});

test('role-occupancy probe does not claim success when only the close reason says role occupied', async () => {
  class ProbeSocket extends EventEmitter {
    closeCalls = 0;
    close() {
      this.closeCalls += 1;
    }
  }
  const socket = new ProbeSocket();
  const probe = waitForRoleOccupancyProbe(socket, 10_000, {
    setTimeout(callback) {
      return callback;
    },
    clearTimeout() {},
  });
  socket.emit('close', 1008, 'TOPOLOGY_ROLE_OCCUPIED');
  assert.deepEqual(await probe, {status: 'FAIL', reasonCode: 'TOPOLOGY_REJECTION_MESSAGE_MISSING'});
  assert.equal(socket.closeCalls, 0);
  assert.equal(socket.listenerCount('message'), 0);
  assert.equal(socket.listenerCount('error'), 0);
  assert.equal(socket.listenerCount('close'), 0);
});

test('role-occupancy probe times out, closes, and removes its pending message handler', async () => {
  class ProbeSocket extends EventEmitter {
    closeCalls = 0;
    close() {
      this.closeCalls += 1;
    }
  }
  const socket = new ProbeSocket();
  let fireDeadline;
  const probe = waitForRoleOccupancyProbe(socket, 5_000, {
    setTimeout(callback, delay) {
      assert.equal(delay, 5_000);
      fireDeadline = callback;
      return callback;
    },
    clearTimeout() {},
  });
  fireDeadline();
  assert.deepEqual(await probe, {status: 'FAIL', reasonCode: 'TOPOLOGY_TIMEOUT'});
  assert.equal(socket.closeCalls, 1);
  assert.equal(socket.listenerCount('message'), 0);
});
