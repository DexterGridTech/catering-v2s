import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readHeartbeatTopologyFromXml,
  topologyLifecycleSnapshot,
  topologyPeerEventsBetweenMarkers,
  waitForPairedReachableTopology,
} from '../../tools/terminal-topology/heartbeat-window.mjs';

const topologyXml = ({role = '副机', pairState = '已配对', reachability = '可达'} = {}) => `
<hierarchy rotation="0"><node text="" resource-id="root" class="android.view.ViewGroup" bounds="[0,0][1920,1080]">
  <node text="" resource-id="terminal.admin:topology:pair-state" class="android.view.ViewGroup" bounds="[100,100][500,200]" />
  <node text="配对状态" resource-id="" class="android.widget.TextView" bounds="[110,110][480,130]" />
  <node text="${pairState}" resource-id="" class="android.widget.TextView" bounds="[110,140][480,190]" />
  <node text="" resource-id="terminal.admin:topology:reachability" class="android.view.ViewGroup" bounds="[600,100][1000,200]" />
  <node text="对端连接" resource-id="" class="android.widget.TextView" bounds="[610,110][980,130]" />
  <node text="${reachability}" resource-id="" class="android.widget.TextView" bounds="[610,140][980,190]" />
  <node text="" resource-id="terminal.admin:topology:role" class="android.view.ViewGroup" bounds="[1100,100][1500,200]" />
  <node text="当前角色" resource-id="" class="android.widget.TextView" bounds="[1110,110][1480,130]" />
  <node text="${role}" resource-id="" class="android.widget.TextView" bounds="[1110,140][1480,190]" />
  <node text="已配对" resource-id="" class="android.widget.TextView" bounds="[1600,100][1800,150]" />
</node></hierarchy>`;

test('reads visible topology values adjacent to their empty testID containers', () => {
  assert.deepEqual(readHeartbeatTopologyFromXml(topologyXml()), {
    role: 'SLAVE',
    pairState: 'PAIRED',
    reachability: 'REACHABLE',
  });
});

test('reads reconnecting state from the rendered status values next to their testID containers', () => {
  assert.deepEqual(readHeartbeatTopologyFromXml(topologyXml({reachability: '重连中'})), {
    role: 'SLAVE',
    pairState: 'PAIRED',
    reachability: 'RECONNECTING',
  });
});

test('keeps the topology snapshot unknown when a testID has conflicting visible status values', () => {
  const ambiguous = topologyXml().replace(
    '<node text="副机" resource-id="" class="android.widget.TextView" bounds="[1110,140][1480,190]" />',
    '<node text="副机" resource-id="" class="android.widget.TextView" bounds="[1110,140][1480,160]" /><node text="主机" resource-id="" class="android.widget.TextView" bounds="[1110,160][1480,190]" />',
  );
  assert.deepEqual(readHeartbeatTopologyFromXml(ambiguous), {
    role: 'UNKNOWN',
    pairState: 'PAIRED',
    reachability: 'REACHABLE',
  });
});

test('waits for both endpoint snapshots to report the paired and reachable admission state', async () => {
  const ready = {role: 'MASTER', pairState: 'PAIRED', reachability: 'REACHABLE'};
  const pending = {role: 'MASTER', pairState: 'UNKNOWN', reachability: 'UNKNOWN'};
  const snapshots = [
    {master: pending, slave: {...ready, role: 'SLAVE'}},
    {master: ready, slave: {...ready, role: 'SLAVE'}},
  ];
  let reads = 0;
  const result = await waitForPairedReachableTopology({
    read: async () => snapshots[reads++],
    timeoutMs: 100,
    pollIntervalMs: 1,
    sleep: async () => {},
    now: () => 0,
  });
  assert.equal(result.status, 'READY');
  assert.equal(result.observations.length, 2);
});

test('retains the last observed state when paired/reachable admission never arrives', async () => {
  const pending = {role: 'MASTER', pairState: 'UNKNOWN', reachability: 'UNKNOWN'};
  const result = await waitForPairedReachableTopology({
    read: async () => ({master: pending, slave: {...pending, role: 'SLAVE'}}),
    timeoutMs: 0,
    pollIntervalMs: 1,
    sleep: async () => {},
    now: () => 0,
  });
  assert.equal(result.status, 'TIMED_OUT');
  assert.equal(result.topology.master.pairState, 'UNKNOWN');
  assert.equal(result.observations.length, 1);
});

const reactNativeLog = (pid, event, data = {}, timestamp = '1791051500.123') =>
  `${timestamp} ${pid} 1234 I ReactNativeJS: ${JSON.stringify({timestamp: 1791051500123, level: 'info', event, data})}`;

test('counts lifecycle events from the structured production log format', () => {
  const counts = topologyLifecycleSnapshot(
    [
      reactNativeLog(1001, 'topology.peer.accepted'),
      reactNativeLog(1001, 'topology.peer.session-installed'),
      reactNativeLog(1001, 'topology.peer.frame-received', {messageType: 'ping'}),
      reactNativeLog(1001, 'other.event'),
    ].join('\n'),
  );
  assert.equal(counts['topology.peer.accepted'], 1);
  assert.equal(counts['topology.peer.session-installed'], 1);
  assert.equal(counts['topology.peer.loss'], 0);
});

test('reads heartbeat events between log markers for the bound process only', () => {
  const lines = [
    '1791051500.100 3333 3333 I TER_TOPOLOGY_A7: START',
    reactNativeLog(1001, 'topology.peer.channel-event', {channelEvent: 'message'}),
    reactNativeLog(1001, 'topology.peer.frame-received', {messageType: 'ping'}),
    reactNativeLog(1001, 'topology.peer.frame-sent', {messageType: 'pong'}),
    reactNativeLog(1001, 'topology.peer.channel-event', {channelEvent: 'open'}),
    reactNativeLog(2002, 'topology.peer.frame-received', {messageType: 'ping'}),
    '1791051501.100 3333 3333 I TER_TOPOLOGY_A7: END',
    reactNativeLog(1001, 'topology.peer.frame-received', {messageType: 'ping'}),
  ].join('\n');
  assert.deepEqual(topologyPeerEventsBetweenMarkers(lines, {startMarker: 'START', endMarker: 'END', processId: 1001}), [
    {event: 'topology.peer.frame-received', messageType: 'ping'},
    {event: 'topology.peer.frame-sent', messageType: 'pong'},
    {event: 'topology.peer.channel-event', messageType: null},
  ]);
});
