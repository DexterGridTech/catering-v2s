// Generated from contracts/policy/terminal-client-generation.json and canonical terminal contract sources; do not edit.

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | {readonly [key: string]: JsonValue};

export type TerminalActivationCancellationRequest = {
  readonly "deviceId": string;
  readonly [key: string]: JsonValue;
};

export type TerminalActivationCancellationResult = {
  readonly "outcome": "CANCELLED" | "ALREADY_CANCELLED";
};

export type TerminalActivationRequest = {
  readonly "activationCode": string;
  readonly "deviceId": string;
  readonly "surfaceForm": "laptop" | "mobile";
  readonly "appVersion": string;
  readonly "credentialSecret": string;
  readonly [key: string]: JsonValue;
};

export type TerminalActivationResult = {
  readonly "terminalRef": string;
  readonly "storeRef": string;
  readonly "groupWorkspaceKey": string;
  readonly "bindingGeneration": number;
};

export type TerminalOperationId = "activateTerminal" | "cancelTerminalActivation";
export const TERMINAL_OPERATION_IDS = ["activateTerminal","cancelTerminalActivation"] as const;
export type TerminalRequestMap = {
  activateTerminal: { readonly pathParameters: {  }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: Readonly<Record<string, never>>; readonly body: TerminalActivationRequest };
  cancelTerminalActivation: { readonly pathParameters: { readonly "terminalRef": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: { readonly "Authorization": string }; readonly body: TerminalActivationCancellationRequest };
};
export type TerminalResponseMap = {
  activateTerminal: TerminalActivationResult;
  cancelTerminalActivation: TerminalActivationCancellationResult;
};
export type TerminalBusinessErrorCode<I extends TerminalOperationId> = typeof terminalOperationContracts[I]["errorCodes"][number];
export type TerminalBusinessProblem = Readonly<{
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly errorCode: string;
  readonly correlationId: string;
  readonly [key: string]: JsonValue;
}>;
export type TerminalExecutionResult =
  | {readonly kind: "response"; readonly status: number; readonly body: unknown; readonly contentType?: string}
  | {readonly kind: "failure"; readonly category: "not-delivered" | "delivered-failure"; readonly code: string};
export type TerminalOperationDescriptor<I extends TerminalOperationId = TerminalOperationId> = typeof terminalOperationContracts[I];
export type TerminalRequestExecutor = <I extends TerminalOperationId>(descriptor: TerminalOperationDescriptor<I>, request: TerminalRequestMap[I]) => Promise<TerminalExecutionResult>;
export type TerminalOperationResult<I extends TerminalOperationId> =
  | {readonly kind: "success"; readonly status: number; readonly body: TerminalResponseMap[I]}
  | {readonly kind: "business-rejection"; readonly status: number; readonly errorCode: TerminalBusinessErrorCode<I>; readonly problem: TerminalBusinessProblem}
  | {readonly kind: "failure"; readonly category: "not-delivered" | "delivered-failure" | "unknown-business-rejection"; readonly code: string};
export const terminalOperationContracts = {
  "activateTerminal": {
    operationId: "activateTerminal",
    method: "POST",
    path: "/activation",
    owner: "terminal-binding",
    authorizationMode: "NONE",
    idempotencyRequired: false,
    safeRetryable: true,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_ACCESS_DENIED","PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED","PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION","PLATFORM_COMMON_RESOURCE_NOT_FOUND","PLATFORM_COMMON_RESULT_UNKNOWN","PLATFORM_COMMON_VALIDATION_FAILED","STORE_TERMINAL_DEVICE_TYPE_MISMATCH","STORE_TERMINAL_DISABLED","STORE_TERMINAL_STORE_VOIDED","STORE_TERMINAL_VOIDED_IMMUTABLE","TERMINAL_BINDING_ACTIVATION_EXPIRED","TERMINAL_BINDING_ALREADY_BOUND"],
    requestSchema: "TerminalActivationRequest",
    responseSchema: "TerminalActivationResult",
  },
  "cancelTerminalActivation": {
    operationId: "cancelTerminalActivation",
    method: "POST",
    path: "/terminals/{terminalRef}/activation/cancel",
    owner: "terminal-binding",
    authorizationMode: "TERMINAL_CREDENTIAL",
    idempotencyRequired: false,
    safeRetryable: true,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION","PLATFORM_COMMON_RESULT_UNKNOWN","PLATFORM_COMMON_VALIDATION_FAILED","TERMINAL_BINDING_CREDENTIAL_INVALID"],
    requestSchema: "TerminalActivationCancellationRequest",
    responseSchema: "TerminalActivationCancellationResult",
  },
} as const;

export function isTerminalActivationCancellationResult(value: unknown): value is TerminalActivationCancellationResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (typeof record["outcome"] === "string" && ["CANCELLED", "ALREADY_CANCELLED"].includes(record["outcome"] as never));
}

export function isTerminalActivationResult(value: unknown): value is TerminalActivationResult {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (typeof record["terminalRef"] === "string") && (typeof record["storeRef"] === "string") && (typeof record["groupWorkspaceKey"] === "string" && (record["groupWorkspaceKey"] as string).length >= 1 && (record["groupWorkspaceKey"] as string).length <= 64 && new RegExp("^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$").test(record["groupWorkspaceKey"] as string)) && (typeof record["bindingGeneration"] === "number" && Number.isInteger(record["bindingGeneration"]) && (record["bindingGeneration"] as number) >= 1);
}

export function createTerminalApiClient(executeRequest: TerminalRequestExecutor) {
  const execute = async <I extends TerminalOperationId>(operationId: I, request: TerminalRequestMap[I]): Promise<TerminalOperationResult<I>> => {
    const descriptor = terminalOperationContracts[operationId];
    const result = await executeRequest(descriptor, request);
    if (result.kind === "failure") return result;
    if (result.status >= 200 && result.status < 300) {
      if (result.status !== descriptor.successStatus || !validateTerminalResponse(descriptor.responseSchema, result.body)) {
        return {kind: "failure", category: "delivered-failure", code: "TERMINAL_RESPONSE_SCHEMA_INVALID"};
      }
      return {kind: "success", status: result.status, body: result.body as TerminalResponseMap[I]};
    }
    if (result.status >= 400 && result.status < 500 && isTerminalBusinessProblem(result.body, result.status)) {
      if (descriptor.errorCodes.includes(result.body.errorCode as never)) {
        return {kind: "business-rejection", status: result.status, errorCode: result.body.errorCode as TerminalBusinessErrorCode<I>, problem: result.body};
      }
      return {kind: "failure", category: "unknown-business-rejection", code: result.body.errorCode};
    }
    return {kind: "failure", category: "delivered-failure", code: "HTTP_DELIVERED_FAILURE"};
  };
  return {
    activateTerminal: (request: TerminalRequestMap["activateTerminal"]) => execute("activateTerminal", request),
    cancelTerminalActivation: (request: TerminalRequestMap["cancelTerminalActivation"]) => execute("cancelTerminalActivation", request),
  } as const;
}

function validateTerminalResponse(schemaName: string, value: unknown): boolean {
  switch (schemaName) {
    case "TerminalActivationResult": return isTerminalActivationResult(value);
    case "TerminalActivationCancellationResult": return isTerminalActivationCancellationResult(value);
    default: return false;
  }
}

function isTerminalBusinessProblem(value: unknown, status: number): value is TerminalBusinessProblem {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return record.status === status && typeof record.type === "string" &&
    typeof record.title === "string" && record.title.length > 0 && typeof record.detail === "string" &&
    typeof record.errorCode === "string" && record.errorCode.length > 0 &&
    typeof record.correlationId === "string" && record.correlationId.length >= 8;
}
