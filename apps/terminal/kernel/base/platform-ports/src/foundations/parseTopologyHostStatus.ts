import type {
  TopologyHostAddress,
  TopologyHostRuntimeConfig,
  TopologyHostState,
  TopologyHostStatus,
} from '../types/topologyHost';

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isHostState = (value: unknown): value is TopologyHostState =>
  value === 'stopped' || value === 'starting' || value === 'running' || value === 'stopping' || value === 'error';

const readAddress = (value: unknown): TopologyHostAddress | undefined => {
  if (!isRecord(value)) return undefined;
  const host = value.host;
  const basePath = value.basePath;
  const httpBaseUrl = value.httpBaseUrl;
  const wsUrl = value.wsUrl;
  const localHttpBaseUrl = value.localHttpBaseUrl;
  const localWsUrl = value.localWsUrl;
  const port = value.port;
  if (
    typeof host !== 'string' ||
    typeof basePath !== 'string' ||
    typeof httpBaseUrl !== 'string' ||
    typeof wsUrl !== 'string' ||
    typeof localHttpBaseUrl !== 'string' ||
    typeof localWsUrl !== 'string' ||
    typeof port !== 'number' ||
    !Number.isSafeInteger(port) ||
    port <= 0
  )
    return undefined;
  return Object.freeze({host, port, basePath, httpBaseUrl, wsUrl, localHttpBaseUrl, localWsUrl});
};

const readConfig = (value: unknown): TopologyHostRuntimeConfig | undefined => {
  if (!isRecord(value)) return undefined;
  if (
    typeof value.port !== 'number' ||
    !Number.isSafeInteger(value.port) ||
    value.port <= 0 ||
    typeof value.basePath !== 'string' ||
    value.basePath.length === 0 ||
    typeof value.heartbeatIntervalMs !== 'number' ||
    !Number.isFinite(value.heartbeatIntervalMs) ||
    typeof value.heartbeatTimeoutMs !== 'number' ||
    !Number.isFinite(value.heartbeatTimeoutMs)
  )
    return undefined;
  return Object.freeze({
    port: value.port,
    basePath: value.basePath,
    heartbeatIntervalMs: value.heartbeatIntervalMs,
    heartbeatTimeoutMs: value.heartbeatTimeoutMs,
  });
};

/**
 * The platform-port boundary owns the native host status shape.  Consumers
 * must use this parser instead of reimplementing Reflect/get-field checks.
 */
export const parseTopologyHostStatus = (value: unknown): TopologyHostStatus | undefined => {
  if (!isRecord(value) || !isHostState(value.state)) return undefined;
  const config = readConfig(value.config);
  if (config === undefined) return undefined;
  const address = value.address === undefined ? undefined : readAddress(value.address);
  if (value.address !== undefined && address === undefined) return undefined;
  if (value.errorCode !== undefined && typeof value.errorCode !== 'string') return undefined;
  if (value.errorMessage !== undefined && typeof value.errorMessage !== 'string') return undefined;
  return Object.freeze({
    state: value.state,
    config,
    ...(address === undefined ? {} : {address}),
    ...(value.errorCode === undefined ? {} : {errorCode: value.errorCode}),
    ...(value.errorMessage === undefined ? {} : {errorMessage: value.errorMessage}),
  });
};
