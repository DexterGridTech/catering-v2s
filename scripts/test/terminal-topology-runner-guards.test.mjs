import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import net from 'node:net'
import test from 'node:test'
import {createTcpBridge} from '../../tools/terminal-topology/tcp-bridge.mjs'
import {
  prepareMemberJourneySurface,
  memberJourneyCustomerSurfaceReady,
} from '../../tools/terminal-topology/member-journey-admission.mjs'
import {
  memberFinancialProbeId,
  memberSubmitId,
  submitMemberFormWithClosedKeyboard,
  virtualKeyboardCompleteId,
} from '../../tools/terminal-topology/member-form-submit.mjs'
import {
  evaluateCloseOriginAcceptance,
  evaluateMemberJourneyTransferAcceptance,
  parseTopologyPeerLogEvents,
  requiredMemberJourneyLabels,
  requiredTwoMachineCloseOrigins,
  topologyAcceptanceStatusForProfiles,
  topologyStageOneOutcome,
} from '../../tools/terminal-topology/journey-acceptance.mjs'

const topologyLogEvent = (timestamp, event, data = {}) => [
  `{ timestamp: ${timestamp},`,
  `  event: '${event}',`,
  '  data: {',
  ...Object.entries(data).map(([key, value]) => `    ${key}: ${typeof value === 'string' ? `'${value}'` : value},`),
  '  },',
  '}',
].join('\n')

const stateTransferLogs = ({masterCodec = 'zlib-base64', slaveCodec = 'zlib-base64'} = {}) => {
  const forwardSummary = {
    syncEntryCount: 4,
    primaryContainerCount: 1,
    secondaryContainerCount: 1,
    primaryPartKey: 'sample.desk.waiting-confirm',
    secondaryPartKey: 'sample.desk.customer-member',
  }
  const reverseSummary = {
    syncEntryCount: 5,
    primaryContainerCount: 1,
    secondaryContainerCount: 1,
    primaryPartKey: 'sample.desk.member-list',
    secondaryPartKey: 'sample.desk.customer-welcome',
  }
  return {
    masterLogcat: [
      topologyLogEvent(100, 'topology.peer.state-full-transfer-planned', {
        sliceName: 'kernel.base.ui-state.content.MAIN', direction: 'master-to-slave', revision: 7, codec: masterCodec, ...forwardSummary,
      }),
      topologyLogEvent(201, 'topology.peer.state-full-applied', {
        sliceName: 'kernel.base.ui-state.content.BRANCH', direction: 'slave-to-master', revision: 9, changed: true, ...reverseSummary,
      }),
    ].join('\n'),
    slaveLogcat: [
      topologyLogEvent(101, 'topology.peer.state-full-applied', {
        sliceName: 'kernel.base.ui-state.content.MAIN', direction: 'master-to-slave', revision: 7, changed: true, ...forwardSummary,
      }),
      topologyLogEvent(200, 'topology.peer.state-full-transfer-planned', {
        sliceName: 'kernel.base.ui-state.content.BRANCH', direction: 'slave-to-master', revision: 9, codec: slaveCodec, ...reverseSummary,
      }),
    ].join('\n'),
  }
}

const expectedMemberJourneyLabels = Object.freeze([
  'anonymous-paired-slave-customer-surface',
  'paired-anonymous-slave-renders-customer-surface',
  'member-list-before-registration',
  'member-waiting-on-master',
  'member-confirmation-on-slave',
  'cross-device-member-pending-state',
  'pending-state-after-slave-restart',
  'pending-customer-workflow-restored-after-slave-restart',
  'withdrawn-state-after-slave-restart',
  'no-stale-customer-popup-after-reconnect',
  'slave-reconnect-clears-cancelled-customer-popup',
  'second-member-waiting-after-cancel',
  'second-member-confirmation-after-cancel',
  'member-confirmed-on-master',
  'member-welcome-on-slave',
  'cross-device-member-confirmed-state',
  'authenticated-state-after-cold-restart',
  'authenticated-member-state-restored-after-cold-restart',
])

const expectedMemberJourneyObservations = Object.freeze({
  'anonymous-paired-slave-customer-surface': {ids: ['sample.desk.customer-welcome'], texts: ['欢迎，请等待店员操作']},
  'member-list-before-registration': {ids: ['sample.desk.member-list'], texts: ['已登记会员']},
  'member-waiting-on-master': {ids: ['sample.desk.member-list', 'sample.desk.waiting-confirm'], texts: ['已提交，等待顾客确认', 'Alice', '01012345678']},
  'member-confirmation-on-slave': {ids: ['sample.desk.customer-member'], texts: ['请确认登记', 'Alice', '01012345678']},
  'pending-state-after-slave-restart': {ids: ['sample.desk.customer-member'], texts: ['请确认登记', 'Alice', '01012345678']},
  'withdrawn-state-after-slave-restart': {ids: ['sample.desk.member-form'], texts: []},
  'no-stale-customer-popup-after-reconnect': {ids: ['sample.desk.customer-welcome'], texts: ['欢迎，请等待店员操作']},
  'second-member-waiting-after-cancel': {ids: ['sample.desk.waiting-confirm'], texts: ['Bob', '01087654321']},
  'second-member-confirmation-after-cancel': {ids: ['sample.desk.customer-member'], texts: ['Bob', '01087654321']},
  'member-confirmed-on-master': {ids: ['sample.desk.member-list', 'sample.desk.member-list:row'], texts: ['已登记会员', 'Bob', '01087654321']},
  'member-welcome-on-slave': {ids: ['sample.desk.customer-welcome'], texts: ['欢迎，请等待店员操作']},
  'authenticated-state-after-cold-restart': {ids: ['sample.desk.member-list', 'sample.desk.member-list:row'], texts: ['Bob', '01087654321']},
})

const memberJourneyProgressLabels = new Set([
  'paired-anonymous-slave-renders-customer-surface',
  'cross-device-member-pending-state',
  'pending-customer-workflow-restored-after-slave-restart',
  'slave-reconnect-clears-cancelled-customer-popup',
  'cross-device-member-confirmed-state',
  'authenticated-member-state-restored-after-cold-restart',
])

const memberJourneyStep = (label, deviceRole = 'master', observedIds = [], observedText = []) => ({label, deviceRole, observedIds, observedText})
const memberJourneySteps = Object.freeze(expectedMemberJourneyLabels
  .filter(label => !memberJourneyProgressLabels.has(label))
  .map(label => {
    if (label === 'member-waiting-on-master') return memberJourneyStep(label, 'master', ['sample.desk.waiting-confirm'], ['Alice', '[PHONE_REDACTED]'])
    if (label === 'member-confirmation-on-slave') return memberJourneyStep(label, 'slave', ['sample.desk.customer-member'], ['Alice', '[PHONE_REDACTED]'])
    if (label === 'second-member-confirmation-after-cancel') return memberJourneyStep(label, 'slave', ['sample.desk.customer-member'], ['Bob', '[PHONE_REDACTED]'])
    if (label === 'second-member-waiting-after-cancel') return memberJourneyStep(label, 'master', ['sample.desk.waiting-confirm'], ['Bob', '[PHONE_REDACTED]'])
    if (label === 'member-confirmed-on-master') return memberJourneyStep(label, 'master', ['sample.desk.member-list', 'sample.desk.member-list:row'], ['已登记会员', 'Bob', '[PHONE_REDACTED]'])
    if (label === 'member-welcome-on-slave') return memberJourneyStep(label, 'slave', ['sample.desk.customer-welcome'], ['欢迎，请等待店员操作'])
    return memberJourneyStep(label)
  }))
const memberJourneyTimeline = Object.freeze(expectedMemberJourneyLabels
  .filter(label => memberJourneyProgressLabels.has(label))
  .map(label => ({label})))

const transferBoundaries = Object.freeze({
  'master-to-slave': Object.freeze({master: 99, slave: 99}),
  'slave-to-master': Object.freeze({master: 199, slave: 199}),
})

const expectedCloseOriginMatrix = Object.freeze([
  {origin: 'role-occupied-rejection', expectedReasons: ['TOPOLOGY_ROLE_OCCUPIED'], evidenceKind: 'rejected-client-and-incumbent-preserved'},
  {origin: 'half-open-heartbeat-timeout', expectedReasons: ['TOPOLOGY_TIMEOUT'], evidenceKind: 'both-endpoint-close-reasons'},
  {origin: 'host-stop', expectedReasons: ['TOPOLOGY_HOST_STOPPED'], evidenceKind: 'both-endpoint-close-reasons'},
  {origin: 'closePeer', expectedReasons: ['TOPOLOGY_HOST_STOPPED'], evidenceKind: 'both-endpoint-close-reasons'},
  {origin: 'unpair', expectedReasons: ['TOPOLOGY_UNPAIRED'], evidenceKind: 'both-endpoint-close-reasons'},
  {
    origin: 'remote-close',
    expectedReasons: ['TOPOLOGY_ROLE_OCCUPIED', 'TOPOLOGY_TIMEOUT', 'TOPOLOGY_UNPAIRED', 'TOPOLOGY_HOST_STOPPED', 'TOPOLOGY_PEER_UNREACHABLE'],
    evidenceKind: 'both-endpoint-close-reasons',
  },
  {origin: 'network-loss', expectedReasons: ['TOPOLOGY_PEER_UNREACHABLE'], evidenceKind: 'both-endpoint-close-reasons'},
])

const listen = server => new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', () => {
    server.off('error', reject)
    resolve(server.address().port)
  })
})

const connect = (port, allowHalfOpen = false) => new Promise((resolve, reject) => {
  const socket = net.connect({host: '127.0.0.1', port, allowHalfOpen})
  socket.once('connect', () => resolve(socket))
  socket.once('error', reject)
})

test('disconnect closes existing TCP sessions and resume permits a fresh session', async () => {
  const upstreamServer = net.createServer(socket => socket.pipe(socket))
  const upstreamPort = await listen(upstreamServer)
  const bridge = createTcpBridge({listenHost: '127.0.0.1', listenPort: 0, targetHost: '127.0.0.1', targetPort: upstreamPort})
  try {
    const address = await bridge.listen()
    const first = await connect(address.port)
    await new Promise((resolve, reject) => {
      first.once('data', resolve)
      first.once('error', reject)
      first.write('connected')
    })
    assert.equal(bridge.activeConnections, 1)
    assert.equal(bridge.pause(), 1)
    await new Promise((resolve, reject) => {
      first.once('close', resolve)
      first.once('error', reject)
    })
    assert.equal(bridge.activeConnections, 0)
    bridge.resume()
    const second = await connect(address.port)
    second.destroy()
  } finally {
    await bridge.close()
    await new Promise(resolve => upstreamServer.close(resolve))
  }
})

test('closing the upstream side also closes and accounts for the accepted client', async () => {
  let acceptedUpstream = null
  const upstreamServer = net.createServer({allowHalfOpen: true}, socket => {
    acceptedUpstream = socket
    socket.on('data', chunk => socket.write(chunk))
  })
  const upstreamPort = await listen(upstreamServer)
  const bridge = createTcpBridge({listenHost: '127.0.0.1', listenPort: 0, targetHost: '127.0.0.1', targetPort: upstreamPort})
  try {
    const address = await bridge.listen()
    const client = await connect(address.port, true)
    await new Promise((resolve, reject) => {
      client.once('data', resolve)
      client.once('error', reject)
      client.write('connected')
    })
    assert.equal(bridge.activeConnections, 1)
    const upstreamClosed = new Promise(resolve => acceptedUpstream.once('close', resolve))
    acceptedUpstream.destroySoon()
    await upstreamClosed
    const bridgeClosed = bridge.close()
    let timeout
    await Promise.race([
      bridgeClosed,
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('bridge cleanup did not close its accepted client')), 1_000) }),
    ]).finally(() => clearTimeout(timeout))
    assert.equal(bridge.activeConnections, 0)
  } finally {
    await bridge.close()
    await new Promise(resolve => upstreamServer.close(resolve))
  }
})

test('member submit closes the final sample-only keyboard before tapping submit', async () => {
  const actions = []
  await submitMemberFormWithClosedKeyboard({
    tap: async testId => actions.push(`tap:${testId}`),
    waitForKeyboardClosed: async () => actions.push('wait:keyboard-absent'),
  })
  assert.deepEqual(actions, [
    `tap:${memberFinancialProbeId}`,
    `tap:${virtualKeyboardCompleteId}`,
    'wait:keyboard-absent',
    `tap:${memberSubmitId}`,
  ])
})

test('member journey closes both Admin overlays before reading the slave customer surface', async () => {
  const events = []
  const openAdminTargets = new Set(['master', 'slave'])
  await prepareMemberJourneySurface({
    master: 'master',
    slave: 'slave',
    closeAdmin: async target => {
      events.push(`close:${target}`)
      openAdminTargets.delete(target)
    },
    assertCustomerSurface: async target => {
      assert.equal(target, 'slave')
      assert.deepEqual([...openAdminTargets], [])
      events.push(`surface:${target}`)
    },
  })
  assert.deepEqual(events, ['close:master', 'close:slave', 'surface:slave'])
})

test('member journey customer surface rejects a welcome node covered by the Admin layer', () => {
  const covered = '<node resource-id="sample.desk.customer-welcome"></node><node resource-id="ui-base-render:layer:admin.console.layer"></node>'
  const exposed = '<node resource-id="sample.desk.customer-welcome"></node>'
  assert.equal(memberJourneyCustomerSurfaceReady(covered), false)
  assert.equal(memberJourneyCustomerSurfaceReady(exposed), true)
  assert.equal(memberJourneyCustomerSurfaceReady('<node resource-id="sample.desk.customer-member"></node>'), false)
})

test('member journey transfer acceptance requires compressed plans, matching receiver applies, and both readbacks', () => {
  const logs = stateTransferLogs()
  assert.deepEqual(parseTopologyPeerLogEvents(logs.masterLogcat).map(event => [event.event, event.direction, event.codec]), [
    ['topology.peer.state-full-transfer-planned', 'master-to-slave', 'zlib-base64'],
    ['topology.peer.state-full-applied', 'slave-to-master', undefined],
  ])
  const result = evaluateMemberJourneyTransferAcceptance({...logs, steps: memberJourneySteps, timeline: memberJourneyTimeline, afterTimestampByDirection: transferBoundaries})
  assert.equal(result.status, 'PASS')
  assert.deepEqual(result.directions.map(({direction, status}) => [direction, status]), [
    ['master-to-slave', 'PASS'],
    ['slave-to-master', 'PASS'],
  ])
  assert.deepEqual(result.directions.map(({readbackMatchedValues}) => readbackMatchedValues), [
    ['Alice', '[PHONE_REDACTED]'],
    ['Bob', '[PHONE_REDACTED]'],
  ])
  assert.deepEqual(result.missingJourneyLabels, [])
})

test('member journey transfer acceptance stays OPEN when either direction uses raw base64 or lacks a receiver readback', () => {
  const logs = stateTransferLogs({slaveCodec: 'raw-base64'})
  const result = evaluateMemberJourneyTransferAcceptance({...logs, steps: memberJourneySteps, timeline: memberJourneyTimeline, afterTimestampByDirection: transferBoundaries})
  assert.equal(result.status, 'OPEN')
  assert.deepEqual(result.directions.map(({direction, status}) => [direction, status]), [
    ['master-to-slave', 'PASS'],
    ['slave-to-master', 'OPEN'],
  ])
  assert.ok(result.directions[1].missing.includes('post-boundary-compressed-plan-and-changed-matching-receiver-apply-for-expected-surfaces'))

  const withoutReverseReadback = memberJourneySteps.map(step => step.label === 'member-confirmed-on-master'
    ? {...step, observedText: ['已登记会员', 'Alice', '[PHONE_REDACTED]']}
    : step)
  const missingReadback = evaluateMemberJourneyTransferAcceptance({...stateTransferLogs(), steps: withoutReverseReadback, timeline: memberJourneyTimeline, afterTimestampByDirection: transferBoundaries})
  assert.equal(missingReadback.status, 'OPEN')
  assert.deepEqual(missingReadback.directions.map(({direction, status}) => [direction, status]), [
    ['master-to-slave', 'PASS'],
    ['slave-to-master', 'OPEN'],
  ])
  assert.ok(missingReadback.directions[1].missing.includes('direction-specific-post-action-business-readback'))

  const mismatchedReceiver = stateTransferLogs()
  mismatchedReceiver.slaveLogcat = mismatchedReceiver.slaveLogcat.replace('primaryContainerCount: 1', 'primaryContainerCount: 2')
  const mismatched = evaluateMemberJourneyTransferAcceptance({...mismatchedReceiver, steps: memberJourneySteps, timeline: memberJourneyTimeline, afterTimestampByDirection: transferBoundaries})
  assert.equal(mismatched.status, 'OPEN')
  assert.ok(mismatched.directions[0].missing.includes('post-boundary-compressed-plan-and-changed-matching-receiver-apply-for-expected-surfaces'))
})

test('member journey transfer acceptance ignores compressed events emitted before the journey boundary', () => {
  const logs = stateTransferLogs()
  const result = evaluateMemberJourneyTransferAcceptance({
    ...logs,
    steps: memberJourneySteps,
    timeline: memberJourneyTimeline,
    afterTimestampByDirection: {
      'master-to-slave': {master: 1_000, slave: 1_000},
      'slave-to-master': {master: 1_000, slave: 1_000},
    },
  })
  assert.equal(result.status, 'OPEN')
  assert.ok(result.directions.every(direction => direction.missing.includes('post-boundary-compressed-plan-and-changed-matching-receiver-apply-for-expected-surfaces')))
})

test('reverse transfer cannot reuse pre-confirmation Bob values as proof of the confirmation transfer', () => {
  const logs = stateTransferLogs()
  const withoutPostConfirmationSender = memberJourneySteps.filter(step => step.label !== 'member-welcome-on-slave')
  const result = evaluateMemberJourneyTransferAcceptance({
    ...logs,
    steps: withoutPostConfirmationSender,
    timeline: memberJourneyTimeline,
    afterTimestampByDirection: transferBoundaries,
  })
  assert.equal(result.status, 'OPEN')
  assert.ok(result.missingJourneyLabels.includes('member-welcome-on-slave'))
})

test('reverse transfer readback compares Bob identity across the secondary source and primary registered row', () => {
  const logs = stateTransferLogs()
  const changedReceiver = memberJourneySteps.map(step => step.label === 'member-confirmed-on-master'
    ? {...step, observedText: ['已登记会员', 'Bob', '[PHONE_REDACTED]']}
    : step)
  const matching = evaluateMemberJourneyTransferAcceptance({...logs, steps: changedReceiver, timeline: memberJourneyTimeline, afterTimestampByDirection: transferBoundaries})
  assert.equal(matching.directions[0].status, 'PASS')
  assert.equal(matching.directions[1].status, 'PASS')
  assert.deepEqual(matching.directions[1].readbackMatchedValues, ['Bob', '[PHONE_REDACTED]'])

  const mismatchedSender = memberJourneySteps.map(step => step.label === 'second-member-confirmation-after-cancel'
    ? {...step, observedText: ['Alice', '[PHONE_REDACTED]']}
    : step)
  const mismatch = evaluateMemberJourneyTransferAcceptance({...logs, steps: mismatchedSender, timeline: memberJourneyTimeline, afterTimestampByDirection: transferBoundaries})
  assert.equal(mismatch.directions[0].status, 'PASS')
  assert.equal(mismatch.directions[1].status, 'OPEN')
  assert.ok(mismatch.directions[1].missing.includes('direction-specific-post-action-business-readback'))
})

test('member journey acceptance requires every one of the 18 required runtime labels', () => {
  assert.deepEqual(requiredMemberJourneyLabels, expectedMemberJourneyLabels)
  for (const omitted of requiredMemberJourneyLabels) {
    const result = evaluateMemberJourneyTransferAcceptance({
      ...stateTransferLogs(),
      steps: memberJourneySteps.filter(step => step.label !== omitted),
      timeline: memberJourneyTimeline.filter(entry => entry.label !== omitted),
      afterTimestampByDirection: transferBoundaries,
    })
    assert.equal(result.status, 'OPEN', `omitting ${omitted} must keep T3 open`)
    assert.ok(result.missingJourneyLabels.includes(omitted), `omitting ${omitted} must be reported`)
  }
})

test('member journey source has the exact 18 literal observe/progress labels', () => {
  const source = readFileSync(new URL('../../tools/terminal-topology/run-dual-device.mjs', import.meta.url), 'utf8')
  const start = source.indexOf('const runMemberJourney = async (')
  const end = source.indexOf('\nconst ensureAdminTopology =', start)
  assert.ok(start >= 0 && end > start, 'runMemberJourney source block must exist')
  const body = source.slice(start, end)
  const observationCalls = [...body.matchAll(/\bobserve\(record,\s*[\w$]+,\s*'([^']+)',\s*(\[[^\]]*\]),\s*(\[[^\]]*\])\)/g)]
  const actualObservations = Object.fromEntries(observationCalls.map(([, label, ids, texts]) => [label, {
    ids: JSON.parse(ids.replaceAll("'", '"')),
    texts: JSON.parse(texts.replaceAll("'", '"')),
  }]))
  const actualLabels = [
    ...observationCalls.map(match => ({label: match[1], index: match.index})),
    ...[...body.matchAll(/\bprogress\(record,\s*'([^']+)'/g)].map(match => ({label: match[1], index: match.index})),
  ].sort((left, right) => left.index - right.index).map(({label}) => label)
  const callCount = [...body.matchAll(/\b(?:observe|progress)\(record,/g)].length
  assert.equal(actualLabels.length, callCount, 'every observe/progress call in the journey must use a literal label and observation arrays')
  assert.deepEqual(actualLabels, expectedMemberJourneyLabels, 'journey labels must remain complete and in the approved action order')
  assert.deepEqual(actualObservations, expectedMemberJourneyObservations, 'each observation must retain its concrete UI IDs and business-state text')
})

test('two-machine close-origin acceptance cannot pass with unobserved or one-sided reason events', () => {
  assert.deepEqual(requiredTwoMachineCloseOrigins, expectedCloseOriginMatrix)
  const open = evaluateCloseOriginAcceptance([])
  assert.equal(open.status, 'OPEN')
  assert.deepEqual(open.rows.map(row => row.origin), requiredTwoMachineCloseOrigins.map(row => row.origin))
  assert.ok(open.rows.every(row => row.status === 'OPEN'))

  const evidence = expectedCloseOriginMatrix.map(({origin, expectedReasons, evidenceKind}) => ({
    origin,
    expectedReason: expectedReasons[0],
    startedMonotonicMs: 1_000,
    endedMonotonicMs: 1_500,
    maxDurationMs: 5_000,
    ...(evidenceKind === 'rejected-client-and-incumbent-preserved'
      ? {rejectedClientReason: expectedReasons[0], rejectedClientPaired: false, incumbentStillPaired: true}
      : {observedReasons: {master: expectedReasons[0], slave: expectedReasons[0]}}),
  }))
  assert.equal(evaluateCloseOriginAcceptance(evidence).status, 'PASS')
  evidence[5].expectedReason = 'TOPOLOGY_HOST_STOPPED'
  evidence[5].observedReasons = {master: 'TOPOLOGY_ROLE_OCCUPIED', slave: 'TOPOLOGY_ROLE_OCCUPIED'}
  assert.equal(evaluateCloseOriginAcceptance(evidence).status, 'OPEN', 'both endpoints must report the row expected reason')
  evidence[5].observedReasons = {master: 'TOPOLOGY_HOST_STOPPED', slave: 'TOPOLOGY_HOST_STOPPED'}
  assert.equal(evaluateCloseOriginAcceptance(evidence).status, 'PASS')
  evidence[5].observedReasons.slave = 'UNRECOGNIZED_CLOSE_REASON'
  assert.equal(evaluateCloseOriginAcceptance(evidence).status, 'OPEN')
  evidence[5].expectedReason = expectedCloseOriginMatrix[5].expectedReasons[0]
  evidence[5].observedReasons = {master: evidence[5].expectedReason, slave: evidence[5].expectedReason}
  evidence[0].incumbentStillPaired = false
  assert.equal(evaluateCloseOriginAcceptance(evidence).status, 'OPEN')
  evidence[0].incumbentStillPaired = true
  evidence[0].rejectedClientPaired = true
  assert.equal(evaluateCloseOriginAcceptance(evidence).status, 'OPEN')
  evidence[0].rejectedClientPaired = false
  evidence[1].observedReasons.slave = 'TOPOLOGY_PEER_UNREACHABLE'
  assert.equal(evaluateCloseOriginAcceptance(evidence).status, 'OPEN')
  evidence[1].observedReasons.slave = requiredTwoMachineCloseOrigins[1].expectedReasons[0]
  evidence[0].endedMonotonicMs = 6_001
  assert.equal(evaluateCloseOriginAcceptance(evidence).status, 'OPEN')
  evidence[0].endedMonotonicMs = 1_500
  evidence.push({...evidence[0]})
  assert.equal(evaluateCloseOriginAcceptance(evidence).status, 'OPEN')
})

test('topology run acceptance remains OPEN unless every selected profile closed its acceptance matrix', () => {
  assert.equal(topologyAcceptanceStatusForProfiles([{topologyAcceptance: {status: 'PASS'}}]), 'PASS')
  assert.equal(topologyAcceptanceStatusForProfiles([{topologyAcceptance: {status: 'OPEN'}}]), 'OPEN')
  assert.equal(topologyAcceptanceStatusForProfiles([{topologyAcceptance: {status: 'PASS'}}, {}]), 'OPEN')
  assert.equal(topologyAcceptanceStatusForProfiles([]), 'OPEN')
})

test('stage-one runner cannot exit as accepted while business, acceptance, or cleanup is open', () => {
  assert.equal(topologyStageOneOutcome({business: 'PASS', topologyAcceptance: 'PASS', cleanup: 'PASS'}), 'PASS')
  assert.equal(topologyStageOneOutcome({business: 'PASS', topologyAcceptance: 'OPEN', cleanup: 'PASS'}), 'OPEN')
  assert.equal(topologyStageOneOutcome({business: 'PASS', topologyAcceptance: 'PASS', cleanup: 'FAIL'}), 'OPEN')
})
