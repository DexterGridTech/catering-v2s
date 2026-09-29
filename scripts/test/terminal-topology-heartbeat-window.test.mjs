import assert from 'node:assert/strict'
import test from 'node:test'
import {evaluateHeartbeatOnlyWindow, readHeartbeatTopologyFromXml, topologyLifecycleSnapshot} from '../../tools/terminal-topology/heartbeat-window.mjs'

const baseline = Object.freeze({
  startedMonotonicMs: 1_000,
  endedMonotonicMs: 91_000,
  heartbeatIntervalMs: 10_000,
  heartbeatTimeoutMs: 30_000,
  startProcesses: {master: 'm:1', slave: 's:1'},
  endProcesses: {master: 'm:1', slave: 's:1'},
  startTopology: {master: 'MASTER:已配对:可达', slave: 'SLAVE:已配对:可达'},
  endTopology: {master: 'MASTER:已配对:可达', slave: 'SLAVE:已配对:可达'},
  startLifecycle: {loss: 0, reconnect: 0, sessions: 1},
  endLifecycle: {loss: 0, reconnect: 0, sessions: 1},
})

test('heartbeat-only window accepts a stable production three-timeout interval', () => {
  assert.deepEqual(evaluateHeartbeatOnlyWindow(baseline), {
    status: 'PASS',
    elapsedMs: 90_000,
    minimumWindowMs: 90_000,
    heartbeatIntervalMs: 10_000,
    heartbeatTimeoutMs: 30_000,
    violations: [],
  })
})

test('heartbeat-only window rejects a short interval, lifecycle transition, process restart, or state change', () => {
  const short = evaluateHeartbeatOnlyWindow({...baseline, endedMonotonicMs: 90_999})
  assert.equal(short.status, 'FAIL')
  assert.deepEqual(short.violations, ['window-shorter-than-three-timeouts'])

  const reconnect = evaluateHeartbeatOnlyWindow({...baseline, endLifecycle: {...baseline.endLifecycle, sessions: 2}})
  assert.equal(reconnect.status, 'FAIL')
  assert.deepEqual(reconnect.violations, ['peer-connection-lifecycle-changed'])

  const restarted = evaluateHeartbeatOnlyWindow({...baseline, endProcesses: {master: 'm:2', slave: 's:1'}})
  assert.equal(restarted.status, 'FAIL')
  assert.deepEqual(restarted.violations, ['process-lifecycle-changed'])

  const changed = evaluateHeartbeatOnlyWindow({...baseline, endTopology: {...baseline.endTopology, slave: 'SLAVE:已配对:重连中'}})
  assert.equal(changed.status, 'FAIL')
  assert.deepEqual(changed.violations, ['paired-reachability-or-role-changed'])
})

test('lifecycle snapshot counts only exact peer lifecycle events', () => {
  const logcat = [
    "event: 'topology.peer.session-installed'",
    "event: 'topology.peer.loss-ignored-closing'",
    "event: 'topology.peer.session-installed'",
    "event: 'topology.peer.loss'",
    "event: 'topology.peer.reconnect-scheduled'",
  ].join('\n')
  assert.deepEqual(topologyLifecycleSnapshot(logcat), {
    'topology.peer.accepted': 0,
    'topology.peer.channel-anomaly': 0,
    'topology.peer.closed-error-received': 0,
    'topology.peer.loss': 1,
    'topology.peer.reconnect-scheduled': 1,
    'topology.peer.session-installed': 2,
  })
})

test('topology readback takes visible status text from descendants inside each testID bounds', () => {
  const xml = [
    '<hierarchy>',
    '<node text="" resource-id="terminal.admin:topology:role" bounds="[0,0][100,60]">',
    '<node text="当前角色" resource-id="" bounds="[4,4][96,24]">',
    '<node text="主机" resource-id="" bounds="[4,28][96,56]">',
    '<node text="" resource-id="terminal.admin:topology:pair-state" bounds="[110,0][210,60]">',
    '<node text="配对状态" resource-id="" bounds="[114,4][206,24]">',
    '<node text="已配对" resource-id="" bounds="[114,28][206,56]">',
    '<node text="" resource-id="terminal.admin:topology:reachability" bounds="[220,0][320,60]">',
    '<node text="对端连接" resource-id="" bounds="[224,4][316,24]">',
    '<node text="可达" resource-id="" bounds="[224,28][316,56]">',
    '<node text="副机" resource-id="" bounds="[330,0][400,60]">',
    '<node text="重连中" resource-id="" bounds="[410,0][500,60]">',
    '</hierarchy>',
  ].join('')
  assert.deepEqual(readHeartbeatTopologyFromXml(xml), {
    role: 'MASTER',
    pairState: 'PAIRED',
    reachability: 'REACHABLE',
  })
})

test('topology readback fails closed when a status is missing or duplicated', () => {
  const xml = [
    '<node text="" resource-id="terminal.admin:topology:role" bounds="[0,0][100,60]">',
    '<node text="副机" resource-id="" bounds="[4,28][96,56]">',
    '<node text="" resource-id="terminal.admin:topology:pair-state" bounds="[110,0][210,60]">',
    '<node text="未配对" resource-id="" bounds="[114,28][206,56]">',
    '<node text="" resource-id="terminal.admin:topology:reachability" bounds="[220,0][320,60]">',
    '<node text="未知" resource-id="" bounds="[224,28][316,56]">',
    '<node text="可达" resource-id="terminal.admin:topology:reachability" bounds="[330,0][430,60]">',
    '</hierarchy>',
  ].join('')
  assert.deepEqual(readHeartbeatTopologyFromXml(xml), {
    role: 'SLAVE',
    pairState: 'UNPAIRED',
    reachability: 'UNKNOWN',
  })
})
