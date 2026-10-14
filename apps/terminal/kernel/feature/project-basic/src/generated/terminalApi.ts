// Generated from contracts/policy/terminal-client-generation.json and canonical terminal contract sources; do not edit.

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | {readonly [key: string]: JsonValue};

export type NoBody = Readonly<Record<string, never>>;

export type TerminalStoreOrganizationPathRead = {
  readonly "projectRef": string;
  readonly "projectName": string;
  readonly "regionRef": string;
  readonly "regionName": string;
  readonly "commercialGroupRef": string;
  readonly "commercialGroupName": string;
  readonly "projectUpdatedAtEpochMillis": number;
  readonly "regionUpdatedAtEpochMillis": number;
  readonly "commercialGroupUpdatedAtEpochMillis": number;
};

export type TerminalUpdateArtifactSummary = {
  readonly "artifactRef": string;
  readonly "kind": "FULL" | "HOT";
  readonly "applicationId": string;
  readonly "runtimeVersion": string;
  readonly "nativeBuildNumber": number;
  readonly "apkVersion": string;
  readonly "jsVersion": string;
  readonly "publicationId": string;
  readonly "apkSha256": string | null;
  readonly "zipSha256": string;
  readonly "byteSize": number;
  readonly "createdAtEpochMillis": number;
};

export type TerminalUpdateRuleSnapshotItem = {
  readonly "ruleRef": string;
  readonly "targetMode": "ALL" | "STORE_REFS";
  readonly "storeRefs": readonly string[];
  readonly "applicationId": string;
  readonly "createdAtEpochMillis": number;
  readonly "full": TerminalUpdateArtifactSummary;
  readonly "hot": TerminalUpdateArtifactSummary | null;
  readonly "nSeconds": number;
  readonly "hotStrategy": "IMMEDIATE" | "IDLE" | null;
  readonly "mSeconds": number | null;
  readonly "description": string | null;
};

export type TerminalUpdateRuleSnapshotPage = {
  readonly "items": readonly TerminalUpdateRuleSnapshotItem[];
  readonly "collectionHash": string;
  readonly "nextCursor": string | null;
};

export type TerminalOperationId = "terminalReadProjectUpdateRuleSnapshotPage" | "terminalReadStoreOrganizationPath";
export const TERMINAL_OPERATION_IDS = ["terminalReadProjectUpdateRuleSnapshotPage","terminalReadStoreOrganizationPath"] as const;
export type TerminalRequestMap = {
  terminalReadProjectUpdateRuleSnapshotPage: { readonly pathParameters: { readonly "projectRef": string }; readonly queryParameters: { readonly "collectionHash": string | null; readonly "cursor"?: string | null; readonly "limit": number }; readonly headers: Readonly<Record<string, never>>; readonly body?: never };
  terminalReadStoreOrganizationPath: { readonly pathParameters: { readonly "storeRef": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: Readonly<Record<string, never>>; readonly body?: never };
};
export type TerminalResponseMap = {
  terminalReadProjectUpdateRuleSnapshotPage: TerminalUpdateRuleSnapshotPage;
  terminalReadStoreOrganizationPath: TerminalStoreOrganizationPathRead;
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
  "terminalReadProjectUpdateRuleSnapshotPage": {
    operationId: "terminalReadProjectUpdateRuleSnapshotPage",
    method: "GET",
    path: "/update-rules/projects/{projectRef}",
    owner: "TERMINAL_UPDATE_RULE",
    authorizationMode: "TERMINAL_CREDENTIAL",
    idempotencyRequired: false,
    safeRetryable: false,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_ACCESS_DENIED","PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED","PLATFORM_COMMON_RESOURCE_NOT_FOUND","PLATFORM_COMMON_VALIDATION_FAILED","PLATFORM_DEPENDENCY_UNAVAILABLE","STORE_TERMINAL_DISABLED","TERMINAL_BINDING_CREDENTIAL_INVALID","TERMINAL_UPDATE_SNAPSHOT_CHANGED","TERMINAL_UPDATE_SNAPSHOT_TOO_LARGE"],
    requestSchema: "NoBody",
    responseSchema: "TerminalUpdateRuleSnapshotPage",
  },
  "terminalReadStoreOrganizationPath": {
    operationId: "terminalReadStoreOrganizationPath",
    method: "GET",
    path: "/stores/{storeRef}/organization-path",
    owner: "organization",
    authorizationMode: "TERMINAL_CREDENTIAL",
    idempotencyRequired: false,
    safeRetryable: false,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_ACCESS_DENIED","PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED","PLATFORM_COMMON_RESOURCE_NOT_FOUND","PLATFORM_COMMON_VALIDATION_FAILED","PLATFORM_DEPENDENCY_UNAVAILABLE","STORE_TERMINAL_DISABLED","TERMINAL_BINDING_CREDENTIAL_INVALID"],
    requestSchema: "NoBody",
    responseSchema: "TerminalStoreOrganizationPathRead",
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
const terminalResponseSchemas = JSON.parse("{\"NoBody\":{\"type\":\"object\",\"additionalProperties\":false},\"TerminalStoreOrganizationPathRead\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"projectRef\",\"projectName\",\"regionRef\",\"regionName\",\"commercialGroupRef\",\"commercialGroupName\",\"projectUpdatedAtEpochMillis\",\"regionUpdatedAtEpochMillis\",\"commercialGroupUpdatedAtEpochMillis\"],\"properties\":{\"projectRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"projectName\":{\"type\":\"string\"},\"regionRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"regionName\":{\"type\":\"string\"},\"commercialGroupRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"commercialGroupName\":{\"type\":\"string\"},\"projectUpdatedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"regionUpdatedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"commercialGroupUpdatedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0}}},\"TerminalUpdateArtifactSummary\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"artifactRef\",\"kind\",\"applicationId\",\"runtimeVersion\",\"nativeBuildNumber\",\"apkVersion\",\"jsVersion\",\"publicationId\",\"apkSha256\",\"zipSha256\",\"byteSize\",\"createdAtEpochMillis\"],\"properties\":{\"artifactRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"kind\":{\"type\":\"string\",\"enum\":[\"FULL\",\"HOT\"]},\"applicationId\":{\"type\":\"string\"},\"runtimeVersion\":{\"type\":\"string\"},\"nativeBuildNumber\":{\"type\":\"integer\",\"minimum\":0},\"apkVersion\":{\"type\":\"string\"},\"jsVersion\":{\"type\":\"string\"},\"publicationId\":{\"type\":\"string\"},\"apkSha256\":{\"type\":[\"string\",\"null\"],\"pattern\":\"^[a-f0-9]{64}$\"},\"zipSha256\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"},\"byteSize\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":1},\"createdAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0}}},\"TerminalUpdateRuleSnapshotItem\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"ruleRef\",\"targetMode\",\"storeRefs\",\"applicationId\",\"createdAtEpochMillis\",\"full\",\"hot\",\"nSeconds\",\"hotStrategy\",\"mSeconds\",\"description\"],\"properties\":{\"ruleRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"targetMode\":{\"type\":\"string\",\"enum\":[\"ALL\",\"STORE_REFS\"]},\"storeRefs\":{\"type\":\"array\",\"items\":{\"type\":\"string\",\"format\":\"uuid\"}},\"applicationId\":{\"type\":\"string\"},\"createdAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"full\":{\"$ref\":\"#/components/schemas/TerminalUpdateArtifactSummary\"},\"hot\":{\"allOf\":[{\"$ref\":\"#/components/schemas/TerminalUpdateArtifactSummary\"}],\"nullable\":true},\"nSeconds\":{\"type\":\"integer\",\"minimum\":60,\"maximum\":86400},\"hotStrategy\":{\"type\":\"string\",\"enum\":[\"IMMEDIATE\",\"IDLE\"],\"nullable\":true},\"mSeconds\":{\"type\":[\"integer\",\"null\"],\"minimum\":60,\"maximum\":86400},\"description\":{\"type\":[\"string\",\"null\"],\"maxLength\":500}}},\"TerminalUpdateRuleSnapshotPage\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"items\",\"collectionHash\",\"nextCursor\"],\"properties\":{\"items\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/components/schemas/TerminalUpdateRuleSnapshotItem\"}},\"collectionHash\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"},\"nextCursor\":{\"type\":[\"string\",\"null\"]}}}}") as Readonly<Record<string, TerminalJsonSchema>>;

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

export function isNoBody(value: unknown): value is NoBody {
  return matchesTerminalSchema(terminalResponseSchemas["NoBody"], value);
}

export function isTerminalStoreOrganizationPathRead(value: unknown): value is TerminalStoreOrganizationPathRead {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalStoreOrganizationPathRead"], value);
}

export function isTerminalUpdateArtifactSummary(value: unknown): value is TerminalUpdateArtifactSummary {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalUpdateArtifactSummary"], value);
}

export function isTerminalUpdateRuleSnapshotItem(value: unknown): value is TerminalUpdateRuleSnapshotItem {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalUpdateRuleSnapshotItem"], value);
}

export function isTerminalUpdateRuleSnapshotPage(value: unknown): value is TerminalUpdateRuleSnapshotPage {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalUpdateRuleSnapshotPage"], value);
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
    terminalReadProjectUpdateRuleSnapshotPage: (request: TerminalRequestMap["terminalReadProjectUpdateRuleSnapshotPage"]) => execute("terminalReadProjectUpdateRuleSnapshotPage", request),
    terminalReadStoreOrganizationPath: (request: TerminalRequestMap["terminalReadStoreOrganizationPath"]) => execute("terminalReadStoreOrganizationPath", request),
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
    case "TerminalUpdateRuleSnapshotPage": return isTerminalUpdateRuleSnapshotPage(value);
    case "TerminalStoreOrganizationPathRead": return isTerminalStoreOrganizationPathRead(value);
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
