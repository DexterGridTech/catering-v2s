// Generated from contracts/policy/terminal-client-generation.json and canonical terminal contract sources; do not edit.

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | {readonly [key: string]: JsonValue};

export type NoBody = Readonly<Record<string, never>>;

export type TerminalUpdateApkFacts = {
  readonly "path": string;
  readonly "sha256": string;
  readonly "certificateSha256": string;
};

export type TerminalUpdateArtifactFile = {
  readonly "path": string;
  readonly "sizeBytes": number;
  readonly "sha256": string;
};

export type TerminalUpdateArtifactManifest = {
  readonly "schemaVersion": 1;
  readonly "platform": "android";
  readonly "applicationId": string;
  readonly "nativeVersion": string;
  readonly "nativeBuildNumber": number;
  readonly "bundleVersion": string;
  readonly "runtimeVersion": string;
  readonly "entry": string;
  readonly "files": readonly TerminalUpdateArtifactFile[];
  readonly "publicationId": string;
  readonly "minimumFull": TerminalUpdateMinimumFull | null;
  readonly "apk": TerminalUpdateApkFacts | null;
};

export type TerminalUpdateDownloadGrantResult = {
  readonly "relativeContentPath": string;
  readonly "grant": string;
  readonly "expiresAtEpochMillis": number;
  readonly "artifactRef": string;
  readonly "zipSha256": string;
  readonly "byteSize": number;
  readonly "artifact": TerminalUpdateArtifactManifest;
};

export type TerminalUpdateMinimumFull = {
  readonly "applicationId": string;
  readonly "nativeBuildNumber": number;
  readonly "runtimeVersion": string;
  readonly "publicationId": string;
  readonly "apkSha256": string;
};

export type TerminalUpdateReportActual = {
  readonly "apkVersion": string | null;
  readonly "nativeBuildNumber": number | null;
  readonly "applicationId": string;
  readonly "runtimeVersion": string;
  readonly "jsVersion": string | null;
  readonly "publicationId": string | null;
  readonly "apkSha256": string | null;
  readonly "bundleSha256": string | null;
  readonly "entryKind": "INSTALLED_APK" | "EMBEDDED_BUNDLE" | "HOT_BUNDLE" | "UNKNOWN";
  readonly "unknownReason": "READBACK_UNAVAILABLE" | "NOT_INSTALLED" | "MISMATCH" | "OTHER" | null | null;
};

export type TerminalUpdateReportReceipt = {
  readonly "reportId": string;
  readonly "taskId": string | null;
  readonly "acceptedSequence": number;
  readonly "outcome": "ACCEPTED" | "SUPERSEDED";
};

export type TerminalUpdateReportRecent = {
  readonly "state": "WAITING_USER" | "DOWNLOADING" | "VERIFYING" | "WAITING_IDLE" | "ADMISSION_REJECTED" | "INSTALLING" | "APPLYING_HOT" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "UNKNOWN";
  readonly "reason": "NONE" | "NETWORK" | "HTTP_REJECTED" | "HASH_MISMATCH" | "PREPARE_FAILED" | "INSTALLER_CANCELLED" | "INCOMPATIBLE" | "WOULD_DOWNGRADE" | "FAILED_ARTIFACT" | "INSTALL_FAILED" | "HOT_APPLY_FAILED" | "UNKNOWN";
  readonly "changedAtEpochMillis": number;
  readonly "ruleRef": string | null;
  readonly "fullArtifactRef": string | null;
  readonly "hotArtifactRef": string | null;
};

export type TerminalUpdateReportRequest = {
  readonly "reportId": string;
  readonly "reportSequence": number;
  readonly "taskId": string | null;
  readonly "actual": TerminalUpdateReportActual;
  readonly "recent": TerminalUpdateReportRecent;
};

export type TerminalOperationId = "issueTerminalUpdateArtifactDownloadGrant" | "submitTerminalUpdateReport";
export const TERMINAL_OPERATION_IDS = ["issueTerminalUpdateArtifactDownloadGrant","submitTerminalUpdateReport"] as const;
export type TerminalRequestMap = {
  issueTerminalUpdateArtifactDownloadGrant: { readonly pathParameters: { readonly "artifactRef": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: Readonly<Record<string, never>>; readonly body?: never };
  submitTerminalUpdateReport: { readonly pathParameters: {  }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: { readonly "Idempotency-Key": string }; readonly body: TerminalUpdateReportRequest };
};
export type TerminalResponseMap = {
  issueTerminalUpdateArtifactDownloadGrant: TerminalUpdateDownloadGrantResult;
  submitTerminalUpdateReport: TerminalUpdateReportReceipt;
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
  "issueTerminalUpdateArtifactDownloadGrant": {
    operationId: "issueTerminalUpdateArtifactDownloadGrant",
    method: "POST",
    path: "/update-artifacts/{artifactRef}/download-grant",
    owner: "TERMINAL_UPDATE_RULE",
    authorizationMode: "TERMINAL_CREDENTIAL",
    idempotencyRequired: false,
    safeRetryable: false,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_ACCESS_DENIED","PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED","PLATFORM_COMMON_RESOURCE_NOT_FOUND","PLATFORM_COMMON_VALIDATION_FAILED","PLATFORM_DEPENDENCY_UNAVAILABLE","STORE_TERMINAL_DISABLED","TERMINAL_BINDING_CREDENTIAL_INVALID","TERMINAL_UPDATE_ARTIFACT_NOT_AUTHORIZED","TERMINAL_UPDATE_BUSY","TERMINAL_UPDATE_GRANT_EXPIRED"],
    requestSchema: "NoBody",
    responseSchema: "TerminalUpdateDownloadGrantResult",
  },
  "submitTerminalUpdateReport": {
    operationId: "submitTerminalUpdateReport",
    method: "POST",
    path: "/update-reports",
    owner: "TERMINAL_UPDATE_REPORT",
    authorizationMode: "TERMINAL_CREDENTIAL",
    idempotencyRequired: true,
    safeRetryable: false,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_ACCESS_DENIED","PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED","PLATFORM_COMMON_RESOURCE_NOT_FOUND","PLATFORM_COMMON_RESULT_UNKNOWN","PLATFORM_COMMON_VALIDATION_FAILED","PLATFORM_DEPENDENCY_UNAVAILABLE","TERMINAL_BINDING_CREDENTIAL_INVALID","TERMINAL_UPDATE_REPORT_IDENTITY_CONFLICT"],
    requestSchema: "TerminalUpdateReportRequest",
    responseSchema: "TerminalUpdateReportReceipt",
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
const terminalResponseSchemas = JSON.parse("{\"NoBody\":{\"type\":\"object\",\"additionalProperties\":false},\"TerminalUpdateApkFacts\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"path\",\"sha256\",\"certificateSha256\"],\"properties\":{\"path\":{\"type\":\"string\",\"minLength\":1},\"sha256\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"},\"certificateSha256\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"}}},\"TerminalUpdateArtifactFile\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"path\",\"sizeBytes\",\"sha256\"],\"properties\":{\"path\":{\"type\":\"string\",\"minLength\":1},\"sizeBytes\":{\"type\":\"integer\",\"minimum\":0},\"sha256\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"}}},\"TerminalUpdateArtifactManifest\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"schemaVersion\",\"platform\",\"applicationId\",\"nativeVersion\",\"nativeBuildNumber\",\"bundleVersion\",\"runtimeVersion\",\"entry\",\"files\",\"publicationId\",\"minimumFull\",\"apk\"],\"properties\":{\"schemaVersion\":{\"type\":\"integer\",\"enum\":[1]},\"platform\":{\"type\":\"string\",\"enum\":[\"android\"]},\"applicationId\":{\"type\":\"string\",\"minLength\":1},\"nativeVersion\":{\"type\":\"string\",\"minLength\":1},\"nativeBuildNumber\":{\"type\":\"integer\",\"minimum\":1},\"bundleVersion\":{\"type\":\"string\",\"minLength\":1},\"runtimeVersion\":{\"type\":\"string\",\"minLength\":1},\"entry\":{\"type\":\"string\",\"minLength\":1},\"files\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/components/schemas/TerminalUpdateArtifactFile\"}},\"publicationId\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"},\"minimumFull\":{\"allOf\":[{\"$ref\":\"#/components/schemas/TerminalUpdateMinimumFull\"}],\"nullable\":true},\"apk\":{\"allOf\":[{\"$ref\":\"#/components/schemas/TerminalUpdateApkFacts\"}],\"nullable\":true}}},\"TerminalUpdateDownloadGrantResult\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"relativeContentPath\",\"grant\",\"expiresAtEpochMillis\",\"artifactRef\",\"zipSha256\",\"byteSize\",\"artifact\"],\"properties\":{\"relativeContentPath\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":512},\"grant\":{\"type\":\"string\",\"minLength\":32,\"maxLength\":256},\"expiresAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"artifactRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"zipSha256\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"},\"byteSize\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":1},\"artifact\":{\"$ref\":\"#/components/schemas/TerminalUpdateArtifactManifest\"}}},\"TerminalUpdateMinimumFull\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"applicationId\",\"nativeBuildNumber\",\"runtimeVersion\",\"publicationId\",\"apkSha256\"],\"properties\":{\"applicationId\":{\"type\":\"string\"},\"nativeBuildNumber\":{\"type\":\"integer\",\"minimum\":1},\"runtimeVersion\":{\"type\":\"string\",\"minLength\":1},\"publicationId\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"},\"apkSha256\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"}}},\"TerminalUpdateReportActual\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"apkVersion\",\"nativeBuildNumber\",\"applicationId\",\"runtimeVersion\",\"jsVersion\",\"publicationId\",\"apkSha256\",\"bundleSha256\",\"entryKind\",\"unknownReason\"],\"properties\":{\"apkVersion\":{\"type\":[\"string\",\"null\"]},\"nativeBuildNumber\":{\"type\":[\"integer\",\"null\"],\"minimum\":0},\"applicationId\":{\"type\":\"string\"},\"runtimeVersion\":{\"type\":\"string\"},\"jsVersion\":{\"type\":[\"string\",\"null\"]},\"publicationId\":{\"type\":[\"string\",\"null\"]},\"apkSha256\":{\"type\":[\"string\",\"null\"],\"pattern\":\"^[a-f0-9]{64}$\"},\"bundleSha256\":{\"type\":[\"string\",\"null\"],\"pattern\":\"^[a-f0-9]{64}$\"},\"entryKind\":{\"type\":\"string\",\"enum\":[\"INSTALLED_APK\",\"EMBEDDED_BUNDLE\",\"HOT_BUNDLE\",\"UNKNOWN\"]},\"unknownReason\":{\"type\":[\"string\",\"null\"],\"enum\":[\"READBACK_UNAVAILABLE\",\"NOT_INSTALLED\",\"MISMATCH\",\"OTHER\",null]}}},\"TerminalUpdateReportReceipt\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"reportId\",\"taskId\",\"acceptedSequence\",\"outcome\"],\"properties\":{\"reportId\":{\"type\":\"string\",\"format\":\"uuid\"},\"taskId\":{\"type\":[\"string\",\"null\"],\"format\":\"uuid\"},\"acceptedSequence\":{\"type\":\"integer\",\"minimum\":1,\"maximum\":9007199254740991},\"outcome\":{\"type\":\"string\",\"enum\":[\"ACCEPTED\",\"SUPERSEDED\"]}}},\"TerminalUpdateReportRecent\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"state\",\"reason\",\"changedAtEpochMillis\",\"ruleRef\",\"fullArtifactRef\",\"hotArtifactRef\"],\"properties\":{\"state\":{\"type\":\"string\",\"enum\":[\"WAITING_USER\",\"DOWNLOADING\",\"VERIFYING\",\"WAITING_IDLE\",\"ADMISSION_REJECTED\",\"INSTALLING\",\"APPLYING_HOT\",\"SUCCEEDED\",\"FAILED\",\"CANCELLED\",\"UNKNOWN\"]},\"reason\":{\"type\":\"string\",\"enum\":[\"NONE\",\"NETWORK\",\"HTTP_REJECTED\",\"HASH_MISMATCH\",\"PREPARE_FAILED\",\"INSTALLER_CANCELLED\",\"INCOMPATIBLE\",\"WOULD_DOWNGRADE\",\"FAILED_ARTIFACT\",\"INSTALL_FAILED\",\"HOT_APPLY_FAILED\",\"UNKNOWN\"]},\"changedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"ruleRef\":{\"type\":[\"string\",\"null\"],\"format\":\"uuid\"},\"fullArtifactRef\":{\"type\":[\"string\",\"null\"],\"format\":\"uuid\"},\"hotArtifactRef\":{\"type\":[\"string\",\"null\"],\"format\":\"uuid\"}}},\"TerminalUpdateReportRequest\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"reportId\",\"reportSequence\",\"taskId\",\"actual\",\"recent\"],\"properties\":{\"reportId\":{\"type\":\"string\",\"format\":\"uuid\"},\"reportSequence\":{\"type\":\"integer\",\"minimum\":1,\"maximum\":9007199254740991},\"taskId\":{\"type\":[\"string\",\"null\"],\"format\":\"uuid\"},\"actual\":{\"$ref\":\"#/components/schemas/TerminalUpdateReportActual\"},\"recent\":{\"$ref\":\"#/components/schemas/TerminalUpdateReportRecent\"}}}}") as Readonly<Record<string, TerminalJsonSchema>>;

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

export function isTerminalUpdateApkFacts(value: unknown): value is TerminalUpdateApkFacts {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalUpdateApkFacts"], value);
}

export function isTerminalUpdateArtifactFile(value: unknown): value is TerminalUpdateArtifactFile {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalUpdateArtifactFile"], value);
}

export function isTerminalUpdateArtifactManifest(value: unknown): value is TerminalUpdateArtifactManifest {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalUpdateArtifactManifest"], value);
}

export function isTerminalUpdateDownloadGrantResult(value: unknown): value is TerminalUpdateDownloadGrantResult {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalUpdateDownloadGrantResult"], value);
}

export function isTerminalUpdateMinimumFull(value: unknown): value is TerminalUpdateMinimumFull {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalUpdateMinimumFull"], value);
}

export function isTerminalUpdateReportActual(value: unknown): value is TerminalUpdateReportActual {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalUpdateReportActual"], value);
}

export function isTerminalUpdateReportReceipt(value: unknown): value is TerminalUpdateReportReceipt {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalUpdateReportReceipt"], value);
}

export function isTerminalUpdateReportRecent(value: unknown): value is TerminalUpdateReportRecent {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalUpdateReportRecent"], value);
}

export function isTerminalUpdateReportRequest(value: unknown): value is TerminalUpdateReportRequest {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalUpdateReportRequest"], value);
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
    issueTerminalUpdateArtifactDownloadGrant: (request: TerminalRequestMap["issueTerminalUpdateArtifactDownloadGrant"]) => execute("issueTerminalUpdateArtifactDownloadGrant", request),
    submitTerminalUpdateReport: (request: TerminalRequestMap["submitTerminalUpdateReport"]) => execute("submitTerminalUpdateReport", request),
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
    case "TerminalUpdateDownloadGrantResult": return isTerminalUpdateDownloadGrantResult(value);
    case "TerminalUpdateReportReceipt": return isTerminalUpdateReportReceipt(value);
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
