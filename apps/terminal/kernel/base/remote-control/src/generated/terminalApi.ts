// Generated from contracts/policy/terminal-client-generation.json and canonical terminal contract sources; do not edit.

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | {readonly [key: string]: JsonValue};

export type TerminalRemoteControlDescription = {
  readonly "sessionId": string;
  readonly "roomName": string;
  readonly "controllerIdentity": string;
  readonly "topologyKind": "MOBILE_SINGLE" | "LAPTOP_SINGLE" | "LAPTOP_DUAL" | "LAPTOP_PAIRED";
  readonly "masterEndpointId": string;
  readonly "endpoints": readonly TerminalRemoteControlEndpoint[];
  readonly "screens": readonly TerminalRemoteControlScreen[];
};

export type TerminalRemoteControlEndpoint = {
  readonly "endpointId": string;
  readonly "participantIdentity": string;
};

export type TerminalRemoteControlEndpointGrant = {
  readonly "endpointId": string;
  readonly "roomName": string;
  readonly "participantIdentity": string;
  readonly "token": string;
  readonly "expiresAtEpochMillis": number;
};

export type TerminalRemoteControlPeerIdentity = {
  readonly "moduleName": string;
  readonly "nodeId": string;
};

export type TerminalRemoteControlRegisterRequest = {
  readonly "sessionId": string;
  readonly "topologyKind": "MOBILE_SINGLE" | "LAPTOP_SINGLE" | "LAPTOP_DUAL" | "LAPTOP_PAIRED";
  readonly "peerIdentity": TerminalRemoteControlPeerIdentity | null;
};

export type TerminalRemoteControlRegisterResponse = {
  readonly "description": TerminalRemoteControlDescription;
  readonly "remainingLeaseMs": number;
  readonly "grants": readonly TerminalRemoteControlEndpointGrant[];
};

export type TerminalRemoteControlScreen = {
  readonly "screen": "main" | "secondary";
  readonly "endpointId": string;
};

export type TerminalRemoteControlStatusReportReceipt = {
  readonly "sessionId": string;
  readonly "state": "STARTING" | "ACTIVE" | "ENDED";
  readonly "reason": string | null;
  readonly "remainingLeaseMs": number;
};

export type TerminalRemoteControlStatusReportRequest = {
  readonly "sessionId": string;
  readonly "state": "STARTING" | "ACTIVE" | "ENDED";
  readonly "reason": string | null;
  readonly "readyScreens": readonly {
  readonly "endpointId": string;
  readonly "screen": "main" | "secondary";
  readonly "streamId": string;
  readonly "trackSid": string;
}[];
};

export type TerminalOperationId = "registerTerminalRemoteControl" | "reportTerminalRemoteControl";
export const TERMINAL_OPERATION_IDS = ["registerTerminalRemoteControl","reportTerminalRemoteControl"] as const;
export type TerminalRequestMap = {
  registerTerminalRemoteControl: { readonly pathParameters: { readonly "sessionId": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: Readonly<Record<string, never>>; readonly body: TerminalRemoteControlRegisterRequest };
  reportTerminalRemoteControl: { readonly pathParameters: { readonly "sessionId": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: Readonly<Record<string, never>>; readonly body: TerminalRemoteControlStatusReportRequest };
};
export type TerminalResponseMap = {
  registerTerminalRemoteControl: TerminalRemoteControlRegisterResponse;
  reportTerminalRemoteControl: TerminalRemoteControlStatusReportReceipt;
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
export type TerminalExecutionMetadata = Readonly<{
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly addressName?: string;
  readonly configRevision?: number;
}>;
export type TerminalExecutionResult =
  | {readonly kind: "response"; readonly status: number; readonly body: unknown; readonly contentType?: string; readonly execution?: TerminalExecutionMetadata}
  | {readonly kind: "failure"; readonly category: "not-delivered" | "delivered-failure"; readonly code: string};
export type TerminalHttpCommandRequest = Readonly<{
  readonly method: string;
  readonly pathAndQuery: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: Readonly<{readonly kind: "empty"}> | Readonly<{readonly kind: "json"; readonly value: JsonValue}>;
  readonly safeRetryable: boolean;
}>;
export type TerminalOperationDescriptor<I extends TerminalOperationId = TerminalOperationId> = typeof terminalOperationContracts[I];
export type TerminalRequestExecutor = <I extends TerminalOperationId>(descriptor: TerminalOperationDescriptor<I>, request: TerminalRequestMap[I]) => Promise<TerminalExecutionResult>;
export type TerminalOperationResult<I extends TerminalOperationId> =
  | {readonly kind: "success"; readonly status: number; readonly body: TerminalResponseMap[I]; readonly execution?: TerminalExecutionMetadata}
  | {readonly kind: "business-rejection"; readonly status: number; readonly errorCode: TerminalBusinessErrorCode<I>; readonly problem: TerminalBusinessProblem; readonly execution?: TerminalExecutionMetadata}
  | {readonly kind: "failure"; readonly category: "not-delivered" | "delivered-failure" | "unknown-business-rejection"; readonly code: string; readonly status?: number; readonly execution?: TerminalExecutionMetadata};
export const terminalOperationContracts = {
  "registerTerminalRemoteControl": {
    operationId: "registerTerminalRemoteControl",
    method: "POST",
    path: "/remote-control-sessions/{sessionId}/registration",
    owner: "TERMINAL_REMOTE_CONTROL",
    authorizationMode: "TERMINAL_CREDENTIAL",
    idempotencyRequired: false,
    safeRetryable: false,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_ACCESS_DENIED","PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED","PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION","PLATFORM_COMMON_RESOURCE_NOT_FOUND","PLATFORM_COMMON_RESULT_UNKNOWN","PLATFORM_COMMON_VALIDATION_FAILED","PLATFORM_DEPENDENCY_UNAVAILABLE","STORE_TERMINAL_DISABLED","TERMINAL_BINDING_CREDENTIAL_INVALID","TERMINAL_CONTROL_REMOTE_IDENTITY_CONFLICT","TERMINAL_CONTROL_REMOTE_NOT_READY","TERMINAL_CONTROL_REMOTE_SESSION_ENDED"],
    requestSchema: "TerminalRemoteControlRegisterRequest",
    responseSchema: "TerminalRemoteControlRegisterResponse",
  },
  "reportTerminalRemoteControl": {
    operationId: "reportTerminalRemoteControl",
    method: "POST",
    path: "/remote-control-sessions/{sessionId}/status",
    owner: "TERMINAL_REMOTE_CONTROL",
    authorizationMode: "TERMINAL_CREDENTIAL",
    idempotencyRequired: false,
    safeRetryable: false,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_ACCESS_DENIED","PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED","PLATFORM_COMMON_OWNER_INVARIANT_VIOLATION","PLATFORM_COMMON_RESOURCE_NOT_FOUND","PLATFORM_COMMON_RESULT_UNKNOWN","PLATFORM_COMMON_VALIDATION_FAILED","PLATFORM_DEPENDENCY_UNAVAILABLE","STORE_TERMINAL_DISABLED","TERMINAL_BINDING_CREDENTIAL_INVALID","TERMINAL_CONTROL_REMOTE_IDENTITY_CONFLICT","TERMINAL_CONTROL_REMOTE_SESSION_ENDED"],
    requestSchema: "TerminalRemoteControlStatusReportRequest",
    responseSchema: "TerminalRemoteControlStatusReportReceipt",
  },
} as const;

type TerminalJsonSchema = Readonly<{
  readonly $ref?: string;
  readonly type?: string | readonly string[];
  readonly nullable?: boolean;
  readonly enum?: readonly unknown[];
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, TerminalJsonSchema>>;
  readonly items?: TerminalJsonSchema;
  readonly additionalProperties?: boolean | TerminalJsonSchema;
  readonly allOf?: readonly TerminalJsonSchema[];
  readonly anyOf?: readonly TerminalJsonSchema[];
  readonly oneOf?: readonly TerminalJsonSchema[];
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly pattern?: string;
  readonly format?: string;
}>;
const terminalResponseSchemas = JSON.parse("{\"TerminalRemoteControlDescription\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"sessionId\",\"roomName\",\"controllerIdentity\",\"topologyKind\",\"masterEndpointId\",\"endpoints\",\"screens\"],\"properties\":{\"sessionId\":{\"type\":\"string\",\"format\":\"uuid\"},\"roomName\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":128},\"controllerIdentity\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":128},\"topologyKind\":{\"type\":\"string\",\"enum\":[\"MOBILE_SINGLE\",\"LAPTOP_SINGLE\",\"LAPTOP_DUAL\",\"LAPTOP_PAIRED\"]},\"masterEndpointId\":{\"type\":\"string\",\"format\":\"uuid\"},\"endpoints\":{\"type\":\"array\",\"minItems\":1,\"maxItems\":2,\"items\":{\"$ref\":\"#/components/schemas/TerminalRemoteControlEndpoint\"}},\"screens\":{\"type\":\"array\",\"minItems\":1,\"maxItems\":2,\"items\":{\"$ref\":\"#/components/schemas/TerminalRemoteControlScreen\"}}}},\"TerminalRemoteControlEndpoint\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"endpointId\",\"participantIdentity\"],\"properties\":{\"endpointId\":{\"type\":\"string\",\"format\":\"uuid\"},\"participantIdentity\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":128}}},\"TerminalRemoteControlEndpointGrant\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"endpointId\",\"roomName\",\"participantIdentity\",\"token\",\"expiresAtEpochMillis\"],\"properties\":{\"endpointId\":{\"type\":\"string\",\"format\":\"uuid\"},\"roomName\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":128},\"participantIdentity\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":128},\"token\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":8192},\"expiresAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0}}},\"TerminalRemoteControlPeerIdentity\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"moduleName\",\"nodeId\"],\"properties\":{\"moduleName\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":128},\"nodeId\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":128}}},\"TerminalRemoteControlRegisterRequest\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"sessionId\",\"topologyKind\",\"peerIdentity\"],\"properties\":{\"sessionId\":{\"type\":\"string\",\"format\":\"uuid\"},\"topologyKind\":{\"type\":\"string\",\"enum\":[\"MOBILE_SINGLE\",\"LAPTOP_SINGLE\",\"LAPTOP_DUAL\",\"LAPTOP_PAIRED\"]},\"peerIdentity\":{\"allOf\":[{\"$ref\":\"#/components/schemas/TerminalRemoteControlPeerIdentity\"}],\"nullable\":true}}},\"TerminalRemoteControlRegisterResponse\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"description\",\"remainingLeaseMs\",\"grants\"],\"properties\":{\"description\":{\"$ref\":\"#/components/schemas/TerminalRemoteControlDescription\"},\"remainingLeaseMs\":{\"type\":\"integer\",\"minimum\":0},\"grants\":{\"type\":\"array\",\"minItems\":1,\"maxItems\":2,\"items\":{\"$ref\":\"#/components/schemas/TerminalRemoteControlEndpointGrant\"}}}},\"TerminalRemoteControlScreen\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"screen\",\"endpointId\"],\"properties\":{\"screen\":{\"type\":\"string\",\"enum\":[\"main\",\"secondary\"]},\"endpointId\":{\"type\":\"string\",\"format\":\"uuid\"}}},\"TerminalRemoteControlStatusReportReceipt\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"sessionId\",\"state\",\"reason\",\"remainingLeaseMs\"],\"properties\":{\"sessionId\":{\"type\":\"string\",\"format\":\"uuid\"},\"state\":{\"type\":\"string\",\"enum\":[\"STARTING\",\"ACTIVE\",\"ENDED\"]},\"reason\":{\"type\":\"string\",\"nullable\":true},\"remainingLeaseMs\":{\"type\":\"integer\",\"minimum\":0}}},\"TerminalRemoteControlStatusReportRequest\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"sessionId\",\"state\",\"reason\",\"readyScreens\"],\"properties\":{\"sessionId\":{\"type\":\"string\",\"format\":\"uuid\"},\"state\":{\"type\":\"string\",\"enum\":[\"STARTING\",\"ACTIVE\",\"ENDED\"]},\"reason\":{\"type\":\"string\",\"nullable\":true},\"readyScreens\":{\"type\":\"array\",\"maxItems\":2,\"items\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"endpointId\",\"screen\",\"streamId\",\"trackSid\"],\"properties\":{\"endpointId\":{\"type\":\"string\",\"format\":\"uuid\"},\"screen\":{\"type\":\"string\",\"enum\":[\"main\",\"secondary\"]},\"streamId\":{\"type\":\"string\",\"format\":\"uuid\"},\"trackSid\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":128}}}}}}}") as Readonly<Record<string, TerminalJsonSchema>>;

function matchesStringSchema(schema: TerminalJsonSchema, value: unknown): boolean {
  if (typeof value !== "string") return false;
  return (schema.minLength === undefined || value.length >= schema.minLength)
    && (schema.maxLength === undefined || value.length <= schema.maxLength)
    && (schema.pattern === undefined || new RegExp(schema.pattern).test(value))
    && (schema.format !== "uuid" || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value));
}

function matchesNumberSchema(schema: TerminalJsonSchema, value: unknown, integer: boolean): boolean {
  if (typeof value !== "number") return false;
  return (!integer || Number.isInteger(value))
    && (schema.minimum === undefined || value >= schema.minimum)
    && (schema.maximum === undefined || value <= schema.maximum);
}

function matchesArraySchema(schema: TerminalJsonSchema, value: unknown, depth: number): boolean {
  if (!Array.isArray(value)) return false;
  return (schema.minItems === undefined || value.length >= schema.minItems)
    && (schema.maxItems === undefined || value.length <= schema.maxItems)
    && (schema.items === undefined || value.every(item => matchesTerminalSchema(schema.items!, item, depth + 1)));
}

function matchesObjectSchema(schema: TerminalJsonSchema, value: unknown, depth: number): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const properties = schema.properties ?? {};
  const additionalProperties = schema.additionalProperties;
  if ((schema.required ?? []).some(key => !Object.hasOwn(record, key))) return false;
  if (Object.entries(properties).some(([key, child]) => Object.hasOwn(record, key)
    && !matchesTerminalSchema(child, record[key], depth + 1))) return false;
  if (additionalProperties === false
    && Object.keys(record).some(key => !Object.hasOwn(properties, key))) return false;
  if (typeof additionalProperties === "object"
    && Object.entries(record).some(([key, item]) => !Object.hasOwn(properties, key)
      && !matchesTerminalSchema(additionalProperties, item, depth + 1))) return false;
  return true;
}

function matchesTerminalSchema(schema: TerminalJsonSchema, value: unknown, depth = 0): boolean {
  if (depth > 64) return false;
  const declaredTypes = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (value === null) return schema.nullable === true || declaredTypes.includes("null");
  if (schema.$ref) {
    const referenceName = schema.$ref.split("/").at(-1) ?? "";
    const referenceSchema = terminalResponseSchemas[referenceName];
    return referenceSchema !== undefined && matchesTerminalSchema(referenceSchema, value, depth + 1);
  }
  if (schema.enum && !schema.enum.some(candidate => Object.is(candidate, value))) return false;
  if (schema.allOf && !schema.allOf.every(child => matchesTerminalSchema(child, value, depth + 1))) return false;
  if (schema.anyOf && !schema.anyOf.some(child => matchesTerminalSchema(child, value, depth + 1))) return false;
  if (schema.oneOf && schema.oneOf.filter(child => matchesTerminalSchema(child, value, depth + 1)).length !== 1) return false;
  const nonNullTypes = declaredTypes.filter(type => type !== "null");
  const type = nonNullTypes.length === 1 ? nonNullTypes[0] : undefined;
  if (type === "string") return matchesStringSchema(schema, value);
  if (type === "integer" || type === "number") return matchesNumberSchema(schema, value, type === "integer");
  if (type === "boolean") return typeof value === "boolean";
  if (type === "array") return matchesArraySchema(schema, value, depth);
  if (type === "object" || schema.properties || schema.additionalProperties !== undefined)
    return matchesObjectSchema(schema, value, depth);
  return type === undefined || type === "null";
}

export function isTerminalRemoteControlDescription(value: unknown): value is TerminalRemoteControlDescription {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalRemoteControlDescription"], value);
}

export function isTerminalRemoteControlEndpoint(value: unknown): value is TerminalRemoteControlEndpoint {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalRemoteControlEndpoint"], value);
}

export function isTerminalRemoteControlEndpointGrant(value: unknown): value is TerminalRemoteControlEndpointGrant {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalRemoteControlEndpointGrant"], value);
}

export function isTerminalRemoteControlPeerIdentity(value: unknown): value is TerminalRemoteControlPeerIdentity {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalRemoteControlPeerIdentity"], value);
}

export function isTerminalRemoteControlRegisterRequest(value: unknown): value is TerminalRemoteControlRegisterRequest {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalRemoteControlRegisterRequest"], value);
}

export function isTerminalRemoteControlRegisterResponse(value: unknown): value is TerminalRemoteControlRegisterResponse {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalRemoteControlRegisterResponse"], value);
}

export function isTerminalRemoteControlScreen(value: unknown): value is TerminalRemoteControlScreen {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalRemoteControlScreen"], value);
}

export function isTerminalRemoteControlStatusReportReceipt(value: unknown): value is TerminalRemoteControlStatusReportReceipt {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalRemoteControlStatusReportReceipt"], value);
}

export function isTerminalRemoteControlStatusReportRequest(value: unknown): value is TerminalRemoteControlStatusReportRequest {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalRemoteControlStatusReportRequest"], value);
}

export function createTerminalApiClient(executeRequest: TerminalRequestExecutor) {
  const execute = async <I extends TerminalOperationId>(operationId: I, request: TerminalRequestMap[I]): Promise<TerminalOperationResult<I>> => {
    const descriptor = terminalOperationContracts[operationId];
    const result = await executeRequest(descriptor, request);
    if (result.kind === "failure") return result;
    const execution = result.execution === undefined ? {} : {execution: result.execution};
    if (result.status >= 200 && result.status < 300) {
      if (result.status !== descriptor.successStatus || !validateTerminalResponse(descriptor.responseSchema, result.body)) {
        return {kind: "failure", category: "delivered-failure", code: "TERMINAL_RESPONSE_SCHEMA_INVALID", status: result.status, ...execution};
      }
      return {kind: "success", status: result.status, body: result.body as TerminalResponseMap[I], ...execution};
    }
    if (result.status >= 400 && result.status < 500 && isTerminalBusinessProblem(result.body, result.status)) {
      if (descriptor.errorCodes.includes(result.body.errorCode as never)) {
        return {kind: "business-rejection", status: result.status, errorCode: result.body.errorCode as TerminalBusinessErrorCode<I>, problem: result.body, ...execution};
      }
      return {kind: "failure", category: "unknown-business-rejection", code: result.body.errorCode, status: result.status, ...execution};
    }
    return {kind: "failure", category: "delivered-failure", code: "HTTP_DELIVERED_FAILURE", status: result.status, ...execution};
  };
  return {
    registerTerminalRemoteControl: (request: TerminalRequestMap["registerTerminalRemoteControl"]) => execute("registerTerminalRemoteControl", request),
    reportTerminalRemoteControl: (request: TerminalRequestMap["reportTerminalRemoteControl"]) => execute("reportTerminalRemoteControl", request),
  } as const;
}

export function buildTerminalHttpCommandRequest<I extends TerminalOperationId>(
  descriptor: TerminalOperationDescriptor<I>,
  request: TerminalRequestMap[I],
): TerminalHttpCommandRequest {
  const pathParameters = request.pathParameters as Readonly<Record<string, string>>;
  const path = descriptor.path.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = pathParameters[name];
    if (typeof value !== "string") throw new Error("TERMINAL_HTTP_PATH_PARAMETER_MISSING");
    return encodeURIComponent(value);
  });
  const query = Object.entries(request.queryParameters as Readonly<Record<string, unknown>>).flatMap(([key, raw]) => {
    const values = Array.isArray(raw) ? raw : [raw];
      return values.flatMap(value =>
      value === undefined || value === null ? [] : [encodeURIComponent(key) + "=" + encodeURIComponent(String(value))],
    );
  });
  return Object.freeze({
    method: descriptor.method,
    pathAndQuery: query.length === 0 ? path : path + "?" + query.join("&"),
    headers: request.headers as Readonly<Record<string, string>>,
    body: request.body === undefined
      ? Object.freeze({kind: "empty" as const})
      : Object.freeze({kind: "json" as const, value: request.body as JsonValue}),
    safeRetryable: descriptor.safeRetryable,
  });
}

function validateTerminalResponse(schemaName: string, value: unknown): boolean {
  switch (schemaName) {
    case "TerminalRemoteControlRegisterResponse": return isTerminalRemoteControlRegisterResponse(value);
    case "TerminalRemoteControlStatusReportReceipt": return isTerminalRemoteControlStatusReportReceipt(value);
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
