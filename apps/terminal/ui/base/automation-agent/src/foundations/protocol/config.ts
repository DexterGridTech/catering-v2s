export type AutomationAgentConfig = Readonly<{
  readonly enabled: boolean;
  readonly url: string;
  readonly sessionToken: string;
}>;

export type NormalizedAutomationAgentConfig = Readonly<{
  readonly enabled: boolean;
  readonly url: string;
  readonly sessionToken: string;
  readonly addressDescription: string;
}>;

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export const describeAutomationAddress = (rawUrl: string): string => {
  const url = new URL(rawUrl);
  const host = loopbackHosts.has(url.hostname.toLowerCase()) ? 'LOOPBACK' : 'REMOTE_HOST';
  const port = url.port.length === 0 ? '' : `:${url.port}`;
  return `${url.protocol}//${host}${port}${url.pathname}`;
};

export const parseAutomationAgentConfig = (value: unknown): NormalizedAutomationAgentConfig => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('AUTOMATION_CONFIG_INVALID_OBJECT');
  }
  const config = value as Record<string, unknown>;
  if (typeof config.enabled !== 'boolean') throw new Error('AUTOMATION_CONFIG_INVALID_ENABLED');
  if (typeof config.url !== 'string' || config.url.length === 0) throw new Error('AUTOMATION_CONFIG_INVALID_URL');
  if (typeof config.sessionToken !== 'string') throw new Error('AUTOMATION_CONFIG_INVALID_TOKEN');
  if (!config.enabled) {
    return Object.freeze({enabled: false, url: config.url, sessionToken: '', addressDescription: 'DISABLED'});
  }
  if (config.sessionToken.trim().length === 0) throw new Error('AUTOMATION_CONFIG_TOKEN_REQUIRED');
  let url: URL;
  try {
    url = new URL(config.url);
  } catch {
    throw new Error('AUTOMATION_CONFIG_INVALID_URL');
  }
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') throw new Error('AUTOMATION_CONFIG_SCHEME_INVALID');
  if (url.username || url.password || url.search || url.hash) throw new Error('AUTOMATION_CONFIG_URL_SECRET_FORBIDDEN');
  const isLoopback = loopbackHosts.has(url.hostname.toLowerCase());
  if (url.protocol === 'ws:' && !isLoopback) throw new Error('AUTOMATION_CONFIG_REMOTE_REQUIRES_WSS');
  return Object.freeze({
    enabled: true,
    url: url.toString(),
    sessionToken: config.sessionToken,
    addressDescription: describeAutomationAddress(url.toString()),
  });
};
