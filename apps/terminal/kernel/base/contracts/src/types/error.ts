import type {CommandId, NodeId, RequestId, SessionId, TimestampMs} from './ids';

export type ErrorCategory =
  | 'BUSINESS'
  | 'VALIDATION'
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'NETWORK'
  | 'DATABASE'
  | 'EXTERNAL_API'
  | 'SYSTEM'
  | 'UNKNOWN';

export type ErrorSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ErrorTemplateValue = string | number | boolean | bigint | null | undefined;
export type ErrorTemplateArguments = Readonly<Record<string, ErrorTemplateValue>>;

export interface ErrorDefinition {
  readonly key: string;
  readonly name: string;
  readonly defaultTemplate: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly code?: string;
  readonly moduleName?: string;
}

export interface RenderedErrorTemplate {
  readonly message: string;
  readonly missingKeys: readonly string[];
}

export interface AppError<TArguments extends ErrorTemplateArguments = ErrorTemplateArguments> {
  readonly name: string;
  readonly message: string;
  readonly key: string;
  readonly code: string;
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly commandName?: string;
  readonly commandId?: CommandId;
  readonly requestId?: RequestId;
  readonly sessionId?: SessionId;
  readonly nodeId?: NodeId;
  readonly createdAt: TimestampMs;
  readonly args?: TArguments;
  readonly templateMissingKeys: readonly string[];
  readonly details?: unknown;
  readonly cause?: unknown;
  readonly stack?: string;
}

export interface CreateAppErrorContext {
  readonly commandName?: string;
  readonly commandId?: CommandId;
  readonly requestId?: RequestId;
  readonly sessionId?: SessionId;
  readonly nodeId?: NodeId;
}

export interface CreateAppErrorInput<TArguments extends ErrorTemplateArguments = ErrorTemplateArguments> {
  readonly args?: TArguments;
  readonly context?: CreateAppErrorContext;
  readonly details?: unknown;
  readonly cause?: unknown;
}
