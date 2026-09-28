import type {
  AppError,
  CreateAppErrorInput,
  ErrorCategory,
  ErrorDefinition,
  ErrorSeverity,
  ErrorTemplateArguments,
  RenderedErrorTemplate,
} from '../types/error';
import {nowTimestampMs} from './time';

const errorCategories: ReadonlySet<unknown> = new Set<ErrorCategory>([
  'BUSINESS',
  'VALIDATION',
  'AUTHENTICATION',
  'AUTHORIZATION',
  'NETWORK',
  'DATABASE',
  'EXTERNAL_API',
  'SYSTEM',
  'UNKNOWN',
]);

const errorSeverities: ReadonlySet<unknown> = new Set<ErrorSeverity>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

export const renderErrorTemplate = <TArguments extends ErrorTemplateArguments = ErrorTemplateArguments>(
  template: string,
  args?: TArguments,
): RenderedErrorTemplate => {
  const missingKeys: string[] = [];
  const message = template.replace(/\$\{([\s\S]+?)\}/g, (placeholder, rawKey: string) => {
    const key = rawKey.trim();
    if (args === undefined || !Object.hasOwn(args, key)) {
      missingKeys.push(key);
      return placeholder;
    }

    return String(args[key]);
  });

  return {message, missingKeys};
};

export const createAppError = <TArguments extends ErrorTemplateArguments = ErrorTemplateArguments>(
  definition: ErrorDefinition,
  input: CreateAppErrorInput<TArguments> = {},
): AppError<TArguments> => {
  const rendered = renderErrorTemplate(definition.defaultTemplate, input.args);

  return {
    name: definition.name,
    message: rendered.message,
    key: definition.key,
    code: definition.code ?? definition.key,
    category: definition.category,
    severity: definition.severity,
    commandName: input.context?.commandName,
    commandId: input.context?.commandId,
    requestId: input.context?.requestId,
    sessionId: input.context?.sessionId,
    nodeId: input.context?.nodeId,
    createdAt: nowTimestampMs(),
    args: input.args,
    templateMissingKeys: rendered.missingKeys,
    details: input.details,
    cause: input.cause,
  };
};

export const isAppError = (value: unknown): value is AppError => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const name = Reflect.get(value, 'name');
  const message = Reflect.get(value, 'message');
  const key = Reflect.get(value, 'key');
  const code = Reflect.get(value, 'code');
  const category = Reflect.get(value, 'category');
  const severity = Reflect.get(value, 'severity');
  const createdAt = Reflect.get(value, 'createdAt');
  const templateMissingKeys = Reflect.get(value, 'templateMissingKeys');

  return (
    typeof name === 'string' &&
    typeof message === 'string' &&
    typeof key === 'string' &&
    typeof code === 'string' &&
    errorCategories.has(category) &&
    errorSeverities.has(severity) &&
    typeof createdAt === 'number' &&
    Number.isFinite(createdAt) &&
    Array.isArray(templateMissingKeys) &&
    templateMissingKeys.every(missingKey => typeof missingKey === 'string')
  );
};
