const lifecycleEventNames = Object.freeze([
  'topology.peer.accepted',
  'topology.peer.channel-anomaly',
  'topology.peer.closed-error-received',
  'topology.peer.loss',
  'topology.peer.reconnect-scheduled',
  'topology.peer.session-installed',
])

const xmlAttribute = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? ''

const xmlBounds = tag => {
  const match = tag.match(/\bbounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
  return match === null ? null : match.slice(1).map(Number)
}

const decodeXmlText = value => value
  .replaceAll('&quot;', '"')
  .replaceAll('&apos;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&amp;', '&')

const textsWithinResourceBounds = (nodes, resourceId) => {
  const matching = nodes.filter(tag => xmlAttribute(tag, 'resource-id') === resourceId)
  if (matching.length !== 1) return []
  const parentBounds = xmlBounds(matching[0])
  if (parentBounds === null) return []
  const [left, top, right, bottom] = parentBounds
  return nodes
    .map(tag => ({tag, bounds: xmlBounds(tag), text: decodeXmlText(xmlAttribute(tag, 'text')).trim()}))
    .filter(node => node.bounds !== null && node.text.length > 0 &&
      node.bounds[0] >= left && node.bounds[1] >= top && node.bounds[2] <= right && node.bounds[3] <= bottom)
    .map(node => node.text)
}

export const readHeartbeatTopologyFromXml = xml => {
  const nodes = [...String(xml ?? '').matchAll(/<node\b[^>]*>/g)].map(match => match[0])
  const roleTexts = textsWithinResourceBounds(nodes, 'terminal.admin:topology:role')
  const pairStateTexts = textsWithinResourceBounds(nodes, 'terminal.admin:topology:pair-state')
  const reachabilityTexts = textsWithinResourceBounds(nodes, 'terminal.admin:topology:reachability')
  return Object.freeze({
    role: roleTexts.includes('主机') ? 'MASTER' : roleTexts.includes('副机') ? 'SLAVE' : 'UNKNOWN',
    pairState: pairStateTexts.includes('已配对') ? 'PAIRED' : pairStateTexts.includes('未配对') ? 'UNPAIRED' : 'UNKNOWN',
    reachability: reachabilityTexts.includes('可达') ? 'REACHABLE' :
      reachabilityTexts.includes('重连中') ? 'RECONNECTING' :
        reachabilityTexts.includes('不可达') ? 'UNREACHABLE' : 'UNKNOWN',
  })
}

export const topologyLifecycleSnapshot = logcat => Object.freeze(Object.fromEntries(
  lifecycleEventNames.map(eventName => [eventName, `${logcat ?? ''}`.split(`event: '${eventName}'`).length - 1]),
))

export const evaluateHeartbeatOnlyWindow = input => {
  const elapsedMs = Number(input.endedMonotonicMs) - Number(input.startedMonotonicMs)
  const minimumWindowMs = Number(input.heartbeatTimeoutMs) * 3
  const sameProcesses = JSON.stringify(input.startProcesses) === JSON.stringify(input.endProcesses)
  const sameTopology = JSON.stringify(input.startTopology) === JSON.stringify(input.endTopology)
  const sameLifecycle = JSON.stringify(input.startLifecycle) === JSON.stringify(input.endLifecycle)
  const violations = []
  if (!Number.isFinite(elapsedMs) || elapsedMs < minimumWindowMs) violations.push('window-shorter-than-three-timeouts')
  if (!sameProcesses) violations.push('process-lifecycle-changed')
  if (!sameTopology) violations.push('paired-reachability-or-role-changed')
  if (!sameLifecycle) violations.push('peer-connection-lifecycle-changed')
  return Object.freeze({
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    elapsedMs,
    minimumWindowMs,
    heartbeatIntervalMs: input.heartbeatIntervalMs,
    heartbeatTimeoutMs: input.heartbeatTimeoutMs,
    violations: Object.freeze(violations),
  })
}
