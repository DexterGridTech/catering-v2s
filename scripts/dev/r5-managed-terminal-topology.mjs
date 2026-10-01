const validPort = value => Number.isInteger(value) && value >= 1024 && value <= 65535;

export const TDS_CLUSTER_NODE_NAMES = Object.freeze(['a', 'b', 'c']);
export const HAPROXY_IMAGE_TAG = '3.4.6';
export const HAPROXY_MEMORY_BUDGET_MIB = 128;

export function createHaproxyConfiguration({entryOnePort, entryTwoPort, nodePorts}) {
  if (!validPort(entryOnePort) || !validPort(entryTwoPort) || entryOnePort === entryTwoPort) {
    throw new Error('R5_TDS_TOPOLOGY_ENTRY_PORTS_INVALID');
  }
  if (!nodePorts || typeof nodePorts !== 'object' || TDS_CLUSTER_NODE_NAMES.some(name => !validPort(nodePorts[name]))) {
    throw new Error('R5_TDS_TOPOLOGY_NODE_PORTS_INVALID');
  }
  const allPorts = [entryOnePort, entryTwoPort, ...TDS_CLUSTER_NODE_NAMES.map(name => nodePorts[name])];
  if (new Set(allPorts).size !== allPorts.length) throw new Error('R5_TDS_TOPOLOGY_PORT_COLLISION');

  return [
    'global',
    '  log stdout format raw local0',
    '  maxconn 128',
    '  stats socket /run/haproxy-control/admin.sock mode 600 level admin',
    '',
    'defaults',
    '  log global',
    '  mode http',
    '  log-format "event=haproxy_request status=%ST backend=%b server=%s"',
    '  timeout connect 2s',
    '  timeout client 180s',
    '  timeout server 180s',
    '  timeout tunnel 180s',
    '  timeout check 1s',
    '',
    'frontend terminal_entry_one',
    `  bind 127.0.0.1:${entryOnePort}`,
    '  acl actuator_root path /actuator',
    '  acl actuator_tree path_beg /actuator/',
    '  http-request deny deny_status 403 if actuator_root or actuator_tree',
    '  default_backend terminal_nodes_ab',
    '',
    'frontend terminal_entry_two',
    `  bind 127.0.0.1:${entryTwoPort}`,
    '  acl actuator_root path /actuator',
    '  acl actuator_tree path_beg /actuator/',
    '  http-request deny deny_status 403 if actuator_root or actuator_tree',
    '  default_backend terminal_node_c',
    '',
    'backend terminal_nodes_ab',
    '  balance roundrobin',
    '  option httpchk GET /actuator/health/readiness',
    '  http-check expect status 200',
    '  default-server inter 1s fall 1 rise 1 check',
    `  server tds-a 127.0.0.1:${nodePorts.a} check`,
    `  server tds-b 127.0.0.1:${nodePorts.b} check`,
    '',
    'backend terminal_node_c',
    '  option httpchk GET /actuator/health/readiness',
    '  http-check expect status 200',
    '  default-server inter 1s fall 1 rise 1 check',
    `  server tds-c 127.0.0.1:${nodePorts.c} check`,
    '',
  ].join('\n');
}

export function validateManagedTdsCluster({runId, remoteRoot, nodes, entryPorts, hostBootId}) {
  if (typeof runId !== 'string' || !/^r5-dev-[0-9]+-[0-9]+-[0-9a-f-]{36}$/.test(runId)) {
    throw new Error('R5_TDS_CLUSTER_RUN_ID_INVALID');
  }
  if (typeof remoteRoot !== 'string' || remoteRoot !== `/tmp/${runId}`) {
    throw new Error('R5_TDS_CLUSTER_ROOT_BINDING_INVALID');
  }
  if (typeof hostBootId !== 'string' || !/^[0-9a-f-]{16,128}$/i.test(hostBootId)) {
    throw new Error('R5_TDS_CLUSTER_HOST_BOOT_ID_INVALID');
  }
  if (!Array.isArray(nodes) || nodes.length !== TDS_CLUSTER_NODE_NAMES.length) {
    throw new Error('R5_TDS_CLUSTER_NODE_COUNT_INVALID');
  }
  const expectedNames = new Set(TDS_CLUSTER_NODE_NAMES.map(name => `tds-${name}`));
  const names = new Set();
  const nodeIds = new Set();
  const ports = new Set();
  for (const node of nodes) {
    if (!node || !expectedNames.has(node.instanceName) || names.has(node.instanceName)) {
      throw new Error('R5_TDS_CLUSTER_NODE_NAME_INVALID');
    }
    names.add(node.instanceName);
    if (typeof node.nodeId !== 'string' || !node.nodeId.trim() || nodeIds.has(node.nodeId)) {
      throw new Error('R5_TDS_CLUSTER_NODE_ID_INVALID');
    }
    nodeIds.add(node.nodeId);
    if (!validPort(node.websocketPort) || ports.has(node.websocketPort)) throw new Error('R5_TDS_CLUSTER_NODE_PORT_INVALID');
    ports.add(node.websocketPort);
    if (node.runId !== runId || node.remoteRoot !== remoteRoot || node.bootId !== hostBootId ||
        !Number.isInteger(node.pid) || node.pid < 1 || !Number.isInteger(node.processStartTicks) || node.processStartTicks < 1 ||
        !Number.isInteger(node.rssBudgetMiB) || node.rssBudgetMiB < 1 ||
        typeof node.logPath !== 'string' || !node.logPath.startsWith(`${remoteRoot}/`)) {
      throw new Error(`R5_TDS_CLUSTER_NODE_IDENTITY_INVALID:${node.instanceName}`);
    }
  }
  if (!entryPorts || !validPort(entryPorts.one) || !validPort(entryPorts.two) || entryPorts.one === entryPorts.two ||
      ports.has(entryPorts.one) || ports.has(entryPorts.two)) {
    throw new Error('R5_TDS_CLUSTER_ENTRY_PORTS_INVALID');
  }
  return Object.freeze({runId, remoteRoot, hostBootId, nodes: Object.freeze([...nodes]), entryPorts: Object.freeze({...entryPorts})});
}

export function validateRemoteHaproxyControl(value) {
  if (!value || value.schemaVersion !== 1 || value.kind !== 'r5-dev-remote-haproxy-control') {
    throw new Error('R5_REMOTE_HAPROXY_CONTROL_INVALID');
  }
  if (typeof value.runId !== 'string' || !/^r5-dev-[0-9]+-[0-9]+-[0-9a-f-]{36}$/.test(value.runId) ||
      value.remoteRoot !== `/tmp/${value.runId}` || !/^[0-9a-f-]{16,128}$/i.test(value.hostBootId ?? '')) {
    throw new Error('R5_REMOTE_HAPROXY_CONTROL_ROOT_INVALID');
  }
  if (!/^[a-f0-9]{12,64}$/i.test(value.containerId ?? '') ||
      value.imageRef !== `library/haproxy@sha256:${value.imageDigest}` ||
      !/^[a-f0-9]{64}$/.test(value.imageDigest ?? '') ||
      !/^sha256:[a-f0-9]{64}$/.test(value.containerImageId ?? '') ||
      !/^[a-f0-9]{64}$/.test(value.configSha256 ?? '') ||
      value.memoryBudgetMiB !== HAPROXY_MEMORY_BUDGET_MIB) {
    throw new Error('R5_REMOTE_HAPROXY_CONTROL_RESOURCE_INVALID');
  }
  if (!value.entryPorts || !validPort(value.entryPorts.one) || !validPort(value.entryPorts.two) ||
      value.entryPorts.one === value.entryPorts.two || !value.nodePorts ||
      TDS_CLUSTER_NODE_NAMES.some(name => !validPort(value.nodePorts[name])) ||
      new Set([value.entryPorts.one, value.entryPorts.two, ...TDS_CLUSTER_NODE_NAMES.map(name => value.nodePorts[name])]).size !== 5) {
    throw new Error('R5_REMOTE_HAPROXY_CONTROL_PORTS_INVALID');
  }
  for (const field of ['configPath', 'logPath', 'controlPath']) {
    if (typeof value[field] !== 'string' || !value[field].startsWith(`${value.remoteRoot}/`)) {
      throw new Error(`R5_REMOTE_HAPROXY_CONTROL_${field.toUpperCase()}_INVALID`);
    }
  }
  if (value.controlSocketPath !== `${value.remoteRoot}/results/haproxy-control/admin.sock`) {
    throw new Error('R5_REMOTE_HAPROXY_CONTROL_SOCKET_PATH_INVALID');
  }
  if (!['STARTING', 'READY', 'STOPPING', 'STOPPED', 'FAILED'].includes(value.phase)) {
    throw new Error('R5_REMOTE_HAPROXY_CONTROL_PHASE_INVALID');
  }
  return value;
}

export function remoteHaproxyIdentityMatches(expected, actual) {
  try {
    validateRemoteHaproxyControl(expected);
    validateRemoteHaproxyControl(actual);
    const scalarFields = ['runId', 'remoteRoot', 'hostBootId', 'containerId', 'containerImageId', 'imageRef', 'imageDigest', 'configSha256', 'memoryBudgetMiB', 'configPath', 'logPath', 'controlPath', 'controlSocketPath'];
    return scalarFields.every(field => expected[field] === actual[field]) &&
      JSON.stringify(expected.entryPorts) === JSON.stringify(actual.entryPorts) &&
      JSON.stringify(expected.nodePorts) === JSON.stringify(actual.nodePorts);
  } catch {
    return false;
  }
}
