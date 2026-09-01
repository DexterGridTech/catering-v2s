import type {
  LogError,
  LogEvent,
  LogFields,
  LogContext,
  LogScope,
  LogValue,
} from '../types/logging';

type MaskCategory =
  | 'phone'
  | 'password'
  | 'hash'
  | 'otp'
  | 'token'
  | 'cookie'
  | 'authorization'
  | 'login'
  | 'account'
  | 'ip'
  | 'payload'
  | 'credential';

const redaction = (category: MaskCategory): string => `[REDACTED:${category}]`;

const normalizedKey = (key: string): string => key.toLowerCase().replaceAll(/[^a-z0-9]/g, '');

const isSafeDiagnosticValue = (key: string | undefined, value: string): boolean => {
  if (key === undefined) return false;
  const normalized = normalizedKey(key);
  if (normalized === 'packagesha256' || normalized === 'manifestsha256') {
    return /^[0-9a-f]{64}$/i.test(value);
  }
  if (normalized === 'bundleversion') {
    return /^\d+(?:\.\d+)+(?:[-+][0-9A-Za-z.-]+)?$/.test(value);
  }
  if (normalized === 'accountbalance') {
    return /^-?(?:\d+|\d+\.\d+)$/.test(value);
  }
  return false;
};

const sensitiveKeyCategory = (key: string): MaskCategory | undefined => {
  const normalized = normalizedKey(key);
  if (normalized.includes('password') || normalized.includes('passwd')) return 'password';
  if (normalized.includes('hash')) return 'hash';
  if (normalized === 'otp' || normalized.includes('onetime') || normalized.includes('verificationcode')) return 'otp';
  if (normalized.includes('authorization') || normalized === 'bearer' || normalized.includes('authheader')) return 'authorization';
  if (normalized.includes('cookie')) return 'cookie';
  if (normalized.includes('token')) return 'token';
  if (normalized.includes('phone') || normalized.includes('mobile')) return 'phone';
  if (normalized.includes('username') || normalized.includes('loginname') || normalized === 'login') return 'login';
  if (normalized.includes('account')) return 'account';
  if (normalized === 'ip' || normalized.endsWith('ipaddress') || normalized.includes('remoteip')) return 'ip';
  if (
    normalized.includes('payload') ||
    normalized.includes('rawrequest') ||
    normalized.includes('rawresponse') ||
    normalized === 'request' ||
    normalized === 'response' ||
    normalized === 'body' ||
    normalized === 'requestbody' ||
    normalized === 'responsebody'
  ) return 'payload';
  if (normalized.includes('secret') || normalized.includes('credential')) return 'credential';
  return undefined;
};

const valueCategory = (value: string): MaskCategory | undefined => {
  if (/(?:^|\D)(?:\+?86[- .]?)?1[3-9]\d{9}(?!\d)/.test(value)) return 'phone';
  if (/\bBearer\s+[A-Za-z0-9._~+/=-]+/i.test(value)) return 'authorization';
  if (/(?:^|[\s=:])(?:access|refresh|id)?[-_ ]?token(?:[\s=:_-]|$)[^\s]*/i.test(value)) return 'token';
  if (/\b(?:password|passwd)\s*[:=]\s*\S+/i.test(value)) return 'password';
  if (/\$2[aby]?\$\d{2}\$[./A-Za-z0-9]{20,}|\b[0-9a-f]{32,}\b/i.test(value)) return 'hash';
  if (/\b(?:otp|one[- ]time password|verification code)\s*[:=]?\s*\S+/i.test(value)) return 'otp';
  if (/\b(?:authorization|auth)\s*[:=]\s*\S+/i.test(value)) return 'authorization';
  if (/\b(?:cookie|set-cookie)\s*[:=]\s*\S+/i.test(value)) return 'cookie';
  if (/\b(?:login|username|login name)\s*[:=]\s*\S+/i.test(value)) return 'login';
  if (/\b(?:account|user)\s+(?:exists|found|registered)\b/i.test(value)) return 'account';
  if (/(?:^|[^\d])(?:\d{1,3}\.){3}\d{1,3}(?!\d)/.test(value)) return 'ip';
  if (/(?:^|[\s[(])(?:[0-9a-f]{1,4}:){2,}[0-9a-f:]{1,4}(?:$|[\s])/.test(value)) return 'ip';
  if (/\b(?:raw\s+)?(?:request|response|payload|body)\b\s*[:=]/i.test(value)) return 'payload';
  if (/\b(?:secret|credential)\b\s*[:=]\s*\S+/i.test(value)) return 'credential';
  return undefined;
};

const sanitizeText = (key: string | undefined, value: string): {readonly value: string; readonly sensitive: boolean} => {
  if (isSafeDiagnosticValue(key, value)) return {value, sensitive: false};
  const keyCategory = key === undefined ? undefined : sensitiveKeyCategory(key);
  if (keyCategory !== undefined) return {value: redaction(keyCategory), sensitive: true};
  const category = valueCategory(value);
  return category === undefined
    ? {value, sensitive: false}
    : {value: redaction(category), sensitive: true};
};

interface SanitizedValue {
  readonly value: LogValue;
  readonly sensitive: boolean;
}

type MutableLogFields = {[key: string]: LogValue};

interface SanitizedFields {
  readonly value: LogFields;
  readonly sensitive: boolean;
}

const isLogArray = (value: LogValue): value is readonly LogValue[] => Array.isArray(value);

const sanitizeFields = (fields: LogFields): SanitizedFields => {
  let sensitive = false;
  const sanitized: MutableLogFields = {};
  for (const [childKey, childValue] of Object.entries(fields)) {
    const result = sanitizeValue(childKey, childValue);
    sanitized[childKey] = result.value;
    sensitive ||= result.sensitive;
  }
  return {value: sanitized, sensitive};
};

const sanitizeValue = (key: string | undefined, value: LogValue): SanitizedValue => {
  if (typeof value === 'string') return sanitizeText(key, value);
  if (isLogArray(value)) {
    let sensitive = false;
    const sanitized = value.map((entry) => {
      const result = sanitizeValue(undefined, entry);
      sensitive ||= result.sensitive;
      return result.value;
    });
    return {value: sanitized, sensitive};
  }
  if (typeof value === 'object' && value !== null) {
    const keyCategory = key === undefined ? undefined : sensitiveKeyCategory(key);
    if (keyCategory !== undefined) return {value: redaction(keyCategory), sensitive: true};
    return sanitizeFields(value);
  }
  return {value, sensitive: false};
};

const sanitizeError = (error: LogError | undefined): {readonly error?: LogError; readonly sensitive: boolean} => {
  if (error === undefined) return {sensitive: false};
  const message = sanitizeText(undefined, error.message);
  const stack = error.stack === undefined ? undefined : sanitizeText(undefined, error.stack);
  const name = error.name === undefined ? undefined : sanitizeText(undefined, error.name);
  const code = error.code === undefined ? undefined : sanitizeText(undefined, error.code);
  return {
    error: {
      name: name?.value,
      code: code?.value,
      message: message.value,
      stack: stack?.value,
    },
    sensitive: message.sensitive || (stack?.sensitive ?? false) || (name?.sensitive ?? false) || (code?.sensitive ?? false),
  };
};

const sanitizeScope = (scope: LogScope): LogScope => ({
  moduleName: scope.moduleName,
  layer: scope.layer,
  subsystem: scope.subsystem,
  component: scope.component,
});

// LogContext is intentionally a closed projection: branded IDs are preserved, commandName is value-sanitized,
// and any future field must be added here before it can reach a LogEvent.
const sanitizeContext = (context: LogContext | undefined): {readonly context?: LogContext; readonly sensitive: boolean} => {
  if (context === undefined) return {sensitive: false};
  const commandName = context.commandName === undefined ? undefined : sanitizeText('commandName', context.commandName);
  return {
    context: {
      requestId: context.requestId,
      commandId: context.commandId,
      commandName: commandName?.value,
      sessionId: context.sessionId,
      connectionId: context.connectionId,
      nodeId: context.nodeId,
      peerNodeId: context.peerNodeId,
    },
    sensitive: commandName?.sensitive ?? false,
  };
};

export const sanitizeLogEvent = (event: LogEvent): LogEvent => {
  const message = event.message === undefined ? undefined : sanitizeText(undefined, event.message);
  const data = event.data === undefined ? undefined : sanitizeFields(event.data);
  const error = sanitizeError(event.error);
  const context = sanitizeContext(event.context);
  const containsSensitiveRaw =
    event.security.containsSensitiveRaw ||
    (message?.sensitive ?? false) ||
    (data?.sensitive ?? false) ||
    error.sensitive ||
    context.sensitive;
  return {
    timestamp: event.timestamp,
    level: event.level,
    category: event.category,
    event: event.event,
    message: message?.value,
    scope: sanitizeScope(event.scope),
    context: context.context,
    data: data?.value,
    error: error.error,
    security: {
      containsSensitiveRaw,
      maskingMode: 'masked',
    },
  };
};
