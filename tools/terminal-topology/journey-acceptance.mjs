const transferDirections = Object.freeze({
  'master-to-slave': Object.freeze({
    sender: 'master',
    receiver: 'slave',
    expectedSurface: Object.freeze({primaryPartKey: 'sample.desk.waiting-confirm', secondaryPartKey: 'sample.desk.customer-member'}),
  }),
  'slave-to-master': Object.freeze({
    sender: 'slave',
    receiver: 'master',
    expectedSurface: Object.freeze({primaryPartKey: 'sample.desk.member-list', secondaryPartKey: 'sample.desk.customer-welcome'}),
  }),
})

export const requiredTwoMachineCloseOrigins = Object.freeze([
  Object.freeze({origin: 'role-occupied-rejection', expectedReasons: Object.freeze(['TOPOLOGY_ROLE_OCCUPIED']), evidenceKind: 'rejected-client-and-incumbent-preserved'}),
  Object.freeze({origin: 'half-open-heartbeat-timeout', expectedReasons: Object.freeze(['TOPOLOGY_TIMEOUT']), evidenceKind: 'both-endpoint-close-reasons'}),
  Object.freeze({origin: 'host-stop', expectedReasons: Object.freeze(['TOPOLOGY_HOST_STOPPED']), evidenceKind: 'both-endpoint-close-reasons'}),
  Object.freeze({origin: 'closePeer', expectedReasons: Object.freeze(['TOPOLOGY_HOST_STOPPED']), evidenceKind: 'both-endpoint-close-reasons'}),
  Object.freeze({origin: 'unpair', expectedReasons: Object.freeze(['TOPOLOGY_UNPAIRED']), evidenceKind: 'both-endpoint-close-reasons'}),
  Object.freeze({
    origin: 'remote-close',
    expectedReasons: Object.freeze([
      'TOPOLOGY_ROLE_OCCUPIED',
      'TOPOLOGY_TIMEOUT',
      'TOPOLOGY_UNPAIRED',
      'TOPOLOGY_HOST_STOPPED',
      'TOPOLOGY_PEER_UNREACHABLE',
    ]),
    evidenceKind: 'both-endpoint-close-reasons',
  }),
  Object.freeze({origin: 'network-loss', expectedReasons: Object.freeze(['TOPOLOGY_PEER_UNREACHABLE']), evidenceKind: 'both-endpoint-close-reasons'}),
])

export const requiredMemberJourneyLabels = Object.freeze([
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

const exactCloseOriginEvidence = evidence => {
  if (!Array.isArray(evidence) || evidence.length !== requiredTwoMachineCloseOrigins.length) return false
  const origins = evidence.map(row => row?.origin)
  return requiredTwoMachineCloseOrigins.every(({origin}) => origins.filter(candidate => candidate === origin).length === 1) &&
    origins.every(origin => requiredTwoMachineCloseOrigins.some(required => required.origin === origin))
}

const valueFor = (block, key) => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = block.match(
    new RegExp(
      `(?:^|\\n)(?:[^\\n]*?ReactNativeJS:[ \\t]*)?[ \\t]*${escapedKey}:[ \\t]*(?:'([^']*)'|"([^"]*)"|(-?\\d+)|(null|true|false|undefined))`,
    ),
  )
  if (match === null) return undefined
  if (match[1] !== undefined) return match[1]
  if (match[2] !== undefined) return match[2]
  if (match[3] !== undefined) return Number(match[3])
  return match[4] === 'null' || match[4] === 'undefined' ? null : match[4] === 'true'
}

export const parseTopologyPeerLogEvents = logcat => {
  const markers = [
    ...String(logcat).matchAll(/(?:^|\n)(?:[^\n]*?ReactNativeJS:[ \t]*)?[ \t]*\{[ \t]*timestamp:[ \t]*(\d+)/g),
  ]
  return markers.flatMap((marker, index) => {
    const start = marker.index
    const end = markers[index + 1]?.index ?? String(logcat).length
    const block = String(logcat).slice(start, end)
    const event = valueFor(block, 'event')
    if (typeof event !== 'string' || !event.startsWith('topology.peer.')) return []
    return [Object.freeze({
      timestamp: Number(marker[1]),
      event,
      direction: valueFor(block, 'direction'),
      codec: valueFor(block, 'codec'),
      sliceName: valueFor(block, 'sliceName'),
      revision: valueFor(block, 'revision'),
      reason: valueFor(block, 'reason'),
      syncEntryCount: valueFor(block, 'syncEntryCount'),
      primaryContainerCount: valueFor(block, 'primaryContainerCount'),
      secondaryContainerCount: valueFor(block, 'secondaryContainerCount'),
      primaryPartKey: valueFor(block, 'primaryPartKey'),
      secondaryPartKey: valueFor(block, 'secondaryPartKey'),
      changed: valueFor(block, 'changed'),
    })]
  })
}

const sharedReadbackValues = (steps, senderLabel, receiverLabel) => {
  const sender = steps.find(step => step.label === senderLabel)
  const receiver = steps.find(step => step.label === receiverLabel)
  if (sender === undefined || receiver === undefined) return []
  const receiverValues = new Set(receiver.observedText ?? receiver.expectedTexts ?? [])
  return (sender.observedText ?? sender.expectedTexts ?? []).filter(value =>
    receiverValues.has(value) && value.length > 0 && !['已提交，等待顾客确认', '请确认登记', '已登记会员'].includes(value),
  )
}

const observedStep = (steps, {label, deviceRole, requiredIds, requiredTexts, forbiddenIds = []}) => {
  const step = steps.find(candidate => candidate.label === label && candidate.deviceRole === deviceRole)
  if (step === undefined) return false
  const observedIds = new Set(step.observedIds ?? [])
  const observedTexts = new Set(step.observedText ?? [])
  return requiredIds.every(id => observedIds.has(id)) &&
    requiredTexts.every(text => observedTexts.has(text)) &&
    forbiddenIds.every(id => !observedIds.has(id))
}

const transferSummaryMatches = (planned, applied) => {
  const summaryKeys = [
    'syncEntryCount',
    'primaryContainerCount',
    'secondaryContainerCount',
    'primaryPartKey',
    'secondaryPartKey',
  ]
  return summaryKeys.every(key => planned[key] !== undefined && planned[key] === applied[key])
}

export const evaluateMemberJourneyTransferAcceptance = ({
  masterLogcat,
  slaveLogcat,
  steps = [],
  timeline = [],
  afterTimestampByDirection = {},
}) => {
  const eventsByRole = {
    master: parseTopologyPeerLogEvents(masterLogcat),
    slave: parseTopologyPeerLogEvents(slaveLogcat),
  }
  const readbackByDirection = {
    'master-to-slave': observedStep(steps, {
      label: 'member-waiting-on-master',
      deviceRole: 'master',
      requiredIds: ['sample.desk.waiting-confirm'],
      requiredTexts: ['Alice', '[PHONE_REDACTED]'],
    }) && observedStep(steps, {
      label: 'member-confirmation-on-slave',
      deviceRole: 'slave',
      requiredIds: ['sample.desk.customer-member'],
      requiredTexts: ['Alice', '[PHONE_REDACTED]'],
    }) ? sharedReadbackValues(steps, 'member-waiting-on-master', 'member-confirmation-on-slave') : [],
    'slave-to-master': observedStep(steps, {
      label: 'second-member-confirmation-after-cancel',
      deviceRole: 'slave',
      requiredIds: ['sample.desk.customer-member'],
      requiredTexts: ['Bob', '[PHONE_REDACTED]'],
    }) && observedStep(steps, {
      label: 'second-member-waiting-after-cancel',
      deviceRole: 'master',
      requiredIds: ['sample.desk.waiting-confirm'],
      requiredTexts: ['Bob', '[PHONE_REDACTED]'],
      forbiddenIds: ['sample.desk.member-list:row'],
    }) && observedStep(steps, {
      label: 'member-confirmed-on-master',
      deviceRole: 'master',
      requiredIds: ['sample.desk.member-list', 'sample.desk.member-list:row'],
      requiredTexts: ['Bob', '[PHONE_REDACTED]'],
    }) && observedStep(steps, {
      label: 'member-welcome-on-slave',
      deviceRole: 'slave',
      requiredIds: ['sample.desk.customer-welcome'],
      requiredTexts: ['欢迎，请等待店员操作'],
    }) ? sharedReadbackValues(steps, 'second-member-confirmation-after-cancel', 'member-confirmed-on-master') : [],
  }
  const observedJourneyLabels = new Set([
    ...steps.map(step => step?.label),
    ...timeline.map(entry => entry?.label),
  ])
  const missingJourneyLabels = requiredMemberJourneyLabels.filter(label => !observedJourneyLabels.has(label))
  const directions = Object.entries(transferDirections).map(([direction, endpoints]) => {
    const directionBaseline = afterTimestampByDirection[direction] ?? {}
    const eventsAfterBoundary = role => {
      const afterTimestamp = directionBaseline[role]
      return Number.isFinite(afterTimestamp)
        ? eventsByRole[role].filter(event => event.timestamp > afterTimestamp)
        : []
    }
    const eligibleEventsByRole = {
      master: eventsAfterBoundary('master'),
      slave: eventsAfterBoundary('slave'),
    }
    const expectedSurface = endpoints.expectedSurface
    const plannedAfterBoundary = eligibleEventsByRole[endpoints.sender].filter(event =>
      event.event === 'topology.peer.state-full-transfer-planned' &&
      event.direction === direction && event.codec === 'zlib-base64' &&
      typeof event.sliceName === 'string' && event.sliceName.includes('.content.') &&
      event.primaryPartKey === expectedSurface.primaryPartKey &&
      event.secondaryPartKey === expectedSurface.secondaryPartKey,
    )
    const applied = eligibleEventsByRole[endpoints.receiver].filter(event =>
      event.event === 'topology.peer.state-full-applied' && event.direction === direction && event.changed === true &&
      event.primaryPartKey === expectedSurface.primaryPartKey &&
      event.secondaryPartKey === expectedSurface.secondaryPartKey,
    )
    const matches = plannedAfterBoundary.find(sent => applied.some(received =>
      received.sliceName === sent.sliceName && received.revision === sent.revision && transferSummaryMatches(sent, received),
    ))
    const readbackValues = readbackByDirection[direction]
    const status = matches !== undefined && readbackValues.length > 0 && missingJourneyLabels.length === 0 ? 'PASS' : 'OPEN'
    return Object.freeze({
      direction,
      sender: endpoints.sender,
      receiver: endpoints.receiver,
      status,
      codec: matches?.codec ?? null,
      sliceName: matches?.sliceName ?? null,
      revision: matches?.revision ?? null,
      readbackMatchedValues: readbackValues,
      missing: Object.freeze([
        ...(matches === undefined ? ['post-boundary-compressed-plan-and-changed-matching-receiver-apply-for-expected-surfaces'] : []),
        ...(readbackValues.length === 0 ? ['direction-specific-post-action-business-readback'] : []),
        ...(missingJourneyLabels.length > 0 ? ['all-required-member-journey-labels'] : []),
      ]),
    })
  })
  return Object.freeze({
    status: directions.every(direction => direction.status === 'PASS') ? 'PASS' : 'OPEN',
    requiredJourneyLabels: Object.freeze([...requiredMemberJourneyLabels]),
    missingJourneyLabels: Object.freeze(missingJourneyLabels),
    directions: Object.freeze(directions),
  })
}

export const evaluateCloseOriginAcceptance = evidence => {
  const exactEvidence = exactCloseOriginEvidence(evidence)
  const rows = requiredTwoMachineCloseOrigins.map(({origin, expectedReasons, evidenceKind}) => {
    const matches = Array.isArray(evidence) ? evidence.filter(row => row?.origin === origin) : []
    const observed = matches.length === 1 ? matches[0] : undefined
    const elapsedMs = observed?.endedMonotonicMs - observed?.startedMonotonicMs
    const bounded = Number.isFinite(observed?.startedMonotonicMs) && Number.isFinite(observed?.endedMonotonicMs) &&
      Number.isFinite(observed?.maxDurationMs) && elapsedMs >= 0 && elapsedMs <= observed.maxDurationMs &&
      expectedReasons.includes(observed.expectedReason)
    const evidenceMatches = evidenceKind === 'rejected-client-and-incumbent-preserved'
      ? observed?.rejectedClientReason === observed?.expectedReason && observed?.rejectedClientPaired === false && observed?.incumbentStillPaired === true
      : observed?.observedReasons?.master === observed?.expectedReason && observed?.observedReasons?.slave === observed?.expectedReason
    const status = exactEvidence && bounded && evidenceMatches
      ? 'PASS'
      : 'OPEN'
    return Object.freeze({
      origin,
      status,
      expectedReasons,
      evidenceKind,
      elapsedMs: Number.isFinite(elapsedMs) ? elapsedMs : null,
      missing: status === 'PASS'
        ? Object.freeze([])
        : Object.freeze([
          ...(!exactEvidence ? ['one-unique-evidence-row-per-required-origin'] : []),
          ...(evidenceKind === 'rejected-client-and-incumbent-preserved'
            ? ['bounded-rejected-client-reason-rejected-client-unpaired-and-incumbent-preserved-readback']
            : ['bounded-both-endpoint-close-reason-readback']),
        ]),
    })
  })
  return Object.freeze({status: rows.every(row => row.status === 'PASS') ? 'PASS' : 'OPEN', rows: Object.freeze(rows)})
}

export const topologyAcceptanceStatusForProfiles = profiles =>
  Array.isArray(profiles) && profiles.length > 0 && profiles.every(profile => profile.topologyAcceptance?.status === 'PASS')
    ? 'PASS'
    : 'OPEN'

export const topologyStageOneOutcome = ({business, topologyAcceptance, cleanup}) =>
  business === 'PASS' && topologyAcceptance === 'PASS' && cleanup === 'PASS' ? 'PASS' : 'OPEN'
