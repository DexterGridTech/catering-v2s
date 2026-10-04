const lifecycleEventNames = Object.freeze([
  'topology.peer.accepted',
  'topology.peer.channel-anomaly',
  'topology.peer.closed-error-received',
  'topology.peer.loss',
  'topology.peer.reconnect-scheduled',
  'topology.peer.session-installed',
]);

export const topologyPeerEventsBetweenMarkers = (logcat, {startMarker, endMarker, processId}) => {
  if (
    typeof startMarker !== 'string' ||
    startMarker.length === 0 ||
    typeof endMarker !== 'string' ||
    endMarker.length === 0 ||
    startMarker === endMarker ||
    !/^\d+$/.test(String(processId))
  ) {
    throw new Error('TP_A7_LOG_WINDOW_INPUT_INVALID');
  }
  const lines = String(logcat ?? '').split(/\r?\n/);
  const startIndexes = lines.flatMap((line, index) => (line.includes(startMarker) ? [index] : []));
  const endIndexes = lines.flatMap((line, index) => (line.includes(endMarker) ? [index] : []));
  if (startIndexes.length !== 1 || endIndexes.length !== 1 || startIndexes[0] >= endIndexes[0]) {
    throw new Error('TP_A7_LOG_WINDOW_MARKERS_INCOMPLETE');
  }

  const pid = String(processId);
  const processLine = new RegExp(
    `^\\s*(?:\\d+(?:\\.\\d+)?|\\[PHONE_REDACTED\\]\\.\\d+)\\s+${pid}\\s+\\d+\\s+[VDIWEF]\\s+ReactNativeJS:\\s*(\\{.*\\})$`,
  );
  return Object.freeze(
    lines.slice(startIndexes[0] + 1, endIndexes[0]).flatMap(line => {
      const match = line.match(processLine);
      if (match === null) return [];
      let payload;
      try {
        payload = JSON.parse(match[1]);
      } catch {
        return [];
      }
      if (typeof payload.event !== 'string' || !payload.event.startsWith('topology.peer.')) return [];
      // Each WebSocket message also emits a channel-event envelope. The
      // corresponding frame-received/frame-sent event carries the message
      // type; retaining the envelope would misclassify every PING/PONG as
      // unrelated activity.
      if (payload.event === 'topology.peer.channel-event' && payload.data?.channelEvent === 'message') return [];
      const messageType = typeof payload.data?.messageType === 'string' ? payload.data.messageType : null;
      return [Object.freeze({event: payload.event, messageType})];
    }),
  );
};

const decodeXmlText = value =>
  value
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');

const parseUiHierarchy = xml => {
  const stack = [];
  const nodesById = new Map();
  const allNodes = [];
  const source = String(xml ?? '');
  const tokenPattern =
    /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<!DOCTYPE[^>]*>|<\/?[A-Za-z_:][\w:.-]*\b[^>]*>/g;
  let rootName = null;
  let cursor = 0;
  let malformed = false;

  for (const match of source.matchAll(tokenPattern)) {
    const tag = match[0];
    if (source.slice(cursor, match.index).trim().length > 0) malformed = true;
    cursor = match.index + tag.length;
    if (tag.startsWith('<!--') || tag.startsWith('<?') || tag.startsWith('<![CDATA[') || /^<!DOCTYPE/i.test(tag))
      continue;

    const closing = /^<\//.test(tag);
    const name = tag.match(/^<\/?([A-Za-z_:][\w:.-]*)/)?.[1];
    if (name === undefined) {
      malformed = true;
      continue;
    }
    if (closing) {
      if (stack.at(-1)?.name !== name) malformed = true;
      else stack.pop();
      continue;
    }
    if (stack.length === 0) {
      if (rootName !== null) malformed = true;
      else rootName = name;
    }

    const attributes = Object.fromEntries(
      [...tag.matchAll(/([A-Za-z_:][\w:.-]*)="([^"]*)"/g)].map(([, name, value]) => [name, decodeXmlText(value)]),
    );
    const node = {
      name,
      resourceId: attributes['resource-id'] ?? '',
      text: (attributes.text ?? '').trim(),
      tag,
      bounds: attributes.bounds ?? '',
      enabled: attributes.enabled !== 'false',
      children: [],
    };
    const parent = stack.at(-1);
    if (parent !== undefined) parent.children.push(node);
    allNodes.push(node);
    if (name === 'node' && node.resourceId !== '') {
      const matches = nodesById.get(node.resourceId) ?? [];
      matches.push(node);
      nodesById.set(node.resourceId, matches);
    }
    if (!/\/\s*>$/.test(tag)) stack.push(node);
  }
  if (source.slice(cursor).trim().length > 0) malformed = true;

  return {
    hierarchyValid: rootName === 'hierarchy' && stack.length === 0 && !malformed,
    nodesById,
    allNodes,
  };
};

const textInSubtree = node => {
  const texts = [];
  const pending = [node];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current.text.length > 0) texts.push(current.text);
    for (let index = current.children.length - 1; index >= 0; index -= 1) {
      pending.push(current.children[index]);
    }
  }
  return texts;
};

const nodesInSubtree = node => {
  const nodes = [];
  const pending = [node];
  while (pending.length > 0) {
    const current = pending.pop();
    nodes.push(current);
    for (let index = current.children.length - 1; index >= 0; index -= 1) {
      pending.push(current.children[index]);
    }
  }
  return nodes;
};

export const readScopedUiEvidence = (
  xml,
  requiredIds = [],
  expectedTexts = [],
  sanitize = value => value,
  scopeId = null,
) => {
  const parsed = parseUiHierarchy(xml);
  const matchingScopes = scopeId === null ? [] : (parsed.nodesById.get(scopeId) ?? []);
  const scopeValid = parsed.hierarchyValid && (scopeId === null || matchingScopes.length === 1);
  const scopedNodes = scopeId === null || matchingScopes.length !== 1 ? null : nodesInSubtree(matchingScopes[0]);
  const nodesById =
    scopedNodes === null
      ? parsed.nodesById
      : new Map(
          [...new Set(scopedNodes.map(node => node.resourceId).filter(Boolean))].map(resourceId => [
            resourceId,
            scopedNodes.filter(node => node.resourceId === resourceId),
          ]),
        );
  const observedIds = scopeId !== null && scopedNodes === null ? [] : [...nodesById.keys()];
  const missingIds = !scopeValid ? [...requiredIds] : requiredIds.filter(resourceId => !nodesById.has(resourceId));
  const ambiguousIds = scopeValid ? requiredIds.filter(resourceId => (nodesById.get(resourceId)?.length ?? 0) > 1) : [];
  const scopedTextById = Object.fromEntries(
    requiredIds.map(resourceId => {
      const matchingNodes = nodesById.get(resourceId) ?? [];
      const rawTexts = matchingNodes.flatMap(textInSubtree);
      const safeTexts = [...new Set(rawTexts.map(text => String(sanitize(text)).trim()).filter(Boolean))];
      return [resourceId, matchingNodes.length === 1 ? safeTexts : []];
    }),
  );
  const observedText = [...new Set(Object.values(scopedTextById).flat())];
  const safeExpectedTexts = expectedTexts.map(text => String(sanitize(text)).trim());
  const scopedTexts = Object.values(scopedTextById).flat();
  const missingTexts = !scopeValid
    ? safeExpectedTexts
    : safeExpectedTexts.filter(
        expected =>
          expected.length === 0 || !scopedTexts.some(actual => actual === expected || actual.includes(expected)),
      );

  return Object.freeze({
    hierarchyValid: parsed.hierarchyValid,
    scopeValid,
    missingIds: Object.freeze(missingIds),
    ambiguousIds: Object.freeze(ambiguousIds),
    missingTexts: Object.freeze(missingTexts),
    observedIds: Object.freeze(observedIds),
    observedText: Object.freeze(observedText),
    scopedTextById: Object.freeze(scopedTextById),
    idCounts: Object.freeze(Object.fromEntries([...nodesById].map(([id, nodes]) => [id, nodes.length]))),
  });
};

export const findUniqueUiNodeById = (xml, resourceId) => {
  const parsed = parseUiHierarchy(xml);
  const matches = parsed.nodesById.get(resourceId) ?? [];
  if (!parsed.hierarchyValid || matches.length !== 1) return null;
  const node = matches[0];
  const bounds = node.bounds.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
  if (bounds === null) return null;
  return Object.freeze({
    tag: node.tag,
    text: node.text,
    left: Number(bounds[1]),
    top: Number(bounds[2]),
    right: Number(bounds[3]),
    bottom: Number(bounds[4]),
    enabled: node.enabled,
  });
};

export const hasExactScopedResourceText = (xml, resourceId, expectedText) => {
  if (typeof expectedText !== 'string' || expectedText.trim().length === 0) return false;
  const evidence = readScopedUiEvidence(xml, [resourceId]);
  return (
    evidence.hierarchyValid &&
    evidence.idCounts[resourceId] === 1 &&
    (evidence.scopedTextById[resourceId] ?? []).includes(expectedText.trim())
  );
};

const uniqueKnownStatus = (texts, knownStatuses) => {
  const matches = new Set(texts.filter(text => knownStatuses.includes(text)));
  return matches.size === 1 ? [...matches][0] : null;
};

const parseBounds = value => {
  const match = String(value ?? '').match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
  return match === null ? null : match.slice(1).map(Number);
};

const textsWithinBounds = (parsed, container) => {
  const outer = parseBounds(container.bounds);
  if (outer === null) return [];
  const [left, top, right, bottom] = outer;
  return parsed.allNodes.flatMap(node => {
    if (node.text.length === 0) return [];
    const inner = parseBounds(node.bounds);
    if (inner === null) return [];
    const [textLeft, textTop, textRight, textBottom] = inner;
    return textLeft >= left && textTop >= top && textRight <= right && textBottom <= bottom ? [node.text] : [];
  });
};

export const readHeartbeatTopologyFromXml = xml => {
  const requiredIds = [
    'terminal.admin:topology:role',
    'terminal.admin:topology:pair-state',
    'terminal.admin:topology:reachability',
  ];
  const evidence = readScopedUiEvidence(xml, requiredIds);
  if (!evidence.hierarchyValid) {
    return Object.freeze({role: 'UNKNOWN', pairState: 'UNKNOWN', reachability: 'UNKNOWN'});
  }
  const parsed = parseUiHierarchy(xml);
  const singleNodeTexts = resourceId => {
    if (evidence.idCounts[resourceId] !== 1) return [];
    const container = parsed.nodesById.get(resourceId)?.[0];
    return container === undefined ? [] : [...textInSubtree(container), ...textsWithinBounds(parsed, container)];
  };
  const roleTexts = singleNodeTexts(requiredIds[0]);
  const pairStateTexts = singleNodeTexts(requiredIds[1]);
  const reachabilityTexts = singleNodeTexts(requiredIds[2]);
  const role = uniqueKnownStatus(roleTexts, ['主机', '副机']);
  const pairState = uniqueKnownStatus(pairStateTexts, ['已配对', '未配对']);
  const reachability = uniqueKnownStatus(reachabilityTexts, ['可达', '重连中', '不可达']);
  return Object.freeze({
    role: role === '主机' ? 'MASTER' : role === '副机' ? 'SLAVE' : 'UNKNOWN',
    pairState: pairState === '已配对' ? 'PAIRED' : pairState === '未配对' ? 'UNPAIRED' : 'UNKNOWN',
    reachability:
      reachability === '可达'
        ? 'REACHABLE'
        : reachability === '重连中'
          ? 'RECONNECTING'
          : reachability === '不可达'
            ? 'UNREACHABLE'
            : 'UNKNOWN',
  });
};

export const waitForPairedReachableTopology = async ({
  read,
  timeoutMs,
  pollIntervalMs,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  now = () => Date.now(),
}) => {
  const deadline = now() + timeoutMs;
  const observations = [];
  while (true) {
    const topology = await read();
    observations.push(topology);
    if (
      topology.master.role === 'MASTER' &&
      topology.slave.role === 'SLAVE' &&
      topology.master.pairState === 'PAIRED' &&
      topology.slave.pairState === 'PAIRED' &&
      topology.master.reachability === 'REACHABLE' &&
      topology.slave.reachability === 'REACHABLE'
    ) {
      return Object.freeze({status: 'READY', topology, observations: Object.freeze(observations)});
    }
    const remainingMs = deadline - now();
    if (remainingMs <= 0) {
      return Object.freeze({status: 'TIMED_OUT', topology, observations: Object.freeze(observations)});
    }
    await sleep(Math.min(pollIntervalMs, remainingMs));
  }
};

export const topologyLifecycleSnapshot = logcat => {
  const counts = Object.fromEntries(lifecycleEventNames.map(eventName => [eventName, 0]));
  for (const line of `${logcat ?? ''}`.split(/\r?\n/)) {
    const payloadText = line.match(/ReactNativeJS:\s*(\{.*\})$/)?.[1];
    if (payloadText === undefined) continue;
    let payload;
    try {
      payload = JSON.parse(payloadText);
    } catch {
      continue;
    }
    const eventName = payload.event;
    if (Object.hasOwn(counts, eventName)) counts[eventName] += 1;
  }
  return Object.freeze(counts);
};

const expectedRoles = Object.freeze({master: 'MASTER', slave: 'SLAVE'});
const hasExactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === keys.length &&
  keys.every(key => Object.hasOwn(value, key));
const validProcessPair = value =>
  hasExactKeys(value, ['master', 'slave']) &&
  ['master', 'slave'].every(role => {
    const identity = value[role];
    return (
      identity !== null &&
      typeof identity === 'object' &&
      Number.isSafeInteger(Number(identity.pid)) &&
      Number(identity.pid) > 0 &&
      typeof identity.startTicks === 'string' &&
      /^\d+$/.test(identity.startTicks)
    );
  });
const validTopologyPair = value =>
  hasExactKeys(value, ['master', 'slave']) &&
  ['master', 'slave'].every(role => {
    const snapshot = value[role];
    return (
      snapshot !== null &&
      typeof snapshot === 'object' &&
      ['MASTER', 'SLAVE', 'UNKNOWN'].includes(snapshot.role) &&
      ['PAIRED', 'UNPAIRED', 'UNKNOWN'].includes(snapshot.pairState) &&
      ['REACHABLE', 'RECONNECTING', 'UNREACHABLE', 'UNKNOWN'].includes(snapshot.reachability)
    );
  });
const healthyTopologyPair = value =>
  ['master', 'slave'].every(
    role =>
      value[role].role === expectedRoles[role] &&
      value[role].pairState === 'PAIRED' &&
      value[role].reachability === 'REACHABLE',
  );
const validLifecycleSnapshot = value =>
  hasExactKeys(value, ['master', 'slave']) &&
  ['master', 'slave'].every(role => {
    const events = value[role];
    return (
      hasExactKeys(events, lifecycleEventNames) &&
      lifecycleEventNames.every(eventName => Number.isSafeInteger(events[eventName]) && events[eventName] >= 0)
    );
  });
const validPeerEventsDuringWindow = value =>
  hasExactKeys(value, ['master', 'slave']) &&
  ['master', 'slave'].every(
    role =>
      Array.isArray(value[role]) &&
      value[role].every(
        event =>
          event !== null &&
          typeof event === 'object' &&
          hasExactKeys(event, ['event', 'messageType']) &&
          typeof event.event === 'string' &&
          event.event.startsWith('topology.peer.') &&
          (event.messageType === null || (typeof event.messageType === 'string' && event.messageType.length > 0)),
      ),
  );
const isHeartbeatPeerEvent = (role, event) =>
  (role === 'master' &&
    ((event.event === 'topology.peer.frame-received' && event.messageType === 'ping') ||
      (event.event === 'topology.peer.frame-sent' && event.messageType === 'pong'))) ||
  (role === 'slave' && event.event === 'topology.peer.frame-received' && event.messageType === 'pong');
const heartbeatPeerTrafficObserved = value =>
  ['master', 'slave'].every(role => {
    const expected =
      role === 'master'
        ? [
            ['topology.peer.frame-received', 'ping'],
            ['topology.peer.frame-sent', 'pong'],
          ]
        : [['topology.peer.frame-received', 'pong']];
    return expected.every(([event, messageType]) =>
      value[role].some(record => record.event === event && record.messageType === messageType),
    );
  });
const establishedLifecycleBaseline = value =>
  ['master', 'slave'].every(
    role => value[role]['topology.peer.accepted'] > 0 && value[role]['topology.peer.session-installed'] > 0,
  );
const sameSnapshot = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export const evaluateHeartbeatOnlyWindow = input => {
  const values = input ?? {};
  const elapsedMs = Number(values.endedMonotonicMs) - Number(values.startedMonotonicMs);
  const heartbeatIntervalMs = Number(values.heartbeatIntervalMs);
  const heartbeatTimeoutMs = Number(values.heartbeatTimeoutMs);
  const minimumWindowMs = heartbeatTimeoutMs * 3;
  const validConfiguration =
    Number.isFinite(heartbeatIntervalMs) &&
    heartbeatIntervalMs > 0 &&
    Number.isFinite(heartbeatTimeoutMs) &&
    heartbeatTimeoutMs > 0;
  const validProcesses = validProcessPair(values.startProcesses) && validProcessPair(values.endProcesses);
  const validTopology = validTopologyPair(values.startTopology) && validTopologyPair(values.endTopology);
  const validLifecycle = validLifecycleSnapshot(values.startLifecycle) && validLifecycleSnapshot(values.endLifecycle);
  const validPeerEvents = validPeerEventsDuringWindow(values.peerEventsDuringWindow);
  const lifecycleBaselineEstablished = validLifecycle && establishedLifecycleBaseline(values.startLifecycle);
  const sameProcesses = validProcesses && sameSnapshot(values.startProcesses, values.endProcesses);
  const sameTopology =
    validTopology &&
    healthyTopologyPair(values.startTopology) &&
    healthyTopologyPair(values.endTopology) &&
    sameSnapshot(values.startTopology, values.endTopology);
  const heartbeatTrafficObserved = validPeerEvents && heartbeatPeerTrafficObserved(values.peerEventsDuringWindow);
  const nonHeartbeatPeerEventCount = validPeerEvents
    ? ['master', 'slave'].reduce(
        (count, role) =>
          count + values.peerEventsDuringWindow[role].filter(event => !isHeartbeatPeerEvent(role, event)).length,
        0,
      )
    : null;
  const violations = [];
  if (!validConfiguration) violations.push('heartbeat-configuration-invalid');
  if (!Number.isFinite(elapsedMs) || elapsedMs < minimumWindowMs) violations.push('window-shorter-than-three-timeouts');
  if (!validProcesses) violations.push('process-snapshot-incomplete');
  if (!sameProcesses) violations.push('process-lifecycle-changed');
  if (!validTopology) violations.push('topology-snapshot-incomplete');
  if (!sameTopology) violations.push('paired-reachability-or-role-changed');
  if (!validLifecycle) violations.push('lifecycle-snapshot-incomplete');
  if (validLifecycle && !lifecycleBaselineEstablished) violations.push('peer-connection-baseline-unobserved');
  if (!validPeerEvents) violations.push('peer-event-window-incomplete');
  else if (nonHeartbeatPeerEventCount > 0) {
    violations.push('non-heartbeat-peer-activity-observed');
  }
  if (validPeerEvents && !heartbeatTrafficObserved) violations.push('heartbeat-traffic-unobserved');
  return Object.freeze({
    status: violations.length === 0 ? 'PASS' : 'FAIL',
    elapsedMs,
    minimumWindowMs,
    heartbeatIntervalMs,
    heartbeatTimeoutMs,
    nonHeartbeatPeerEventCount,
    violations: Object.freeze(violations),
  });
};
