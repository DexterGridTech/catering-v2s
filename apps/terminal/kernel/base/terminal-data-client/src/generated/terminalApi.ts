// Generated from contracts/policy/terminal-client-generation.json and canonical terminal contract sources; do not edit.

export type JsonValue = string | number | boolean | null | readonly JsonValue[] | {readonly [key: string]: JsonValue};

export type NoBody = Readonly<Record<string, never>>;

export type OrganizationStore = {
  readonly "id": string;
  readonly "groupWorkspaceKey": string;
  readonly "code": string;
  readonly "name": string;
  readonly "project": {
  readonly "id": string;
  readonly "code": string;
  readonly "name": string;
  readonly "path"?: string | null;
};
  readonly "brand": {
  readonly "id": string;
  readonly "code": string;
  readonly "name": string;
  readonly "path"?: string | null;
};
  readonly "tenant": {
  readonly "id": string;
  readonly "code": string;
  readonly "name": string;
  readonly "path"?: string | null;
};
  readonly "headCompany"?: {
  readonly "id": string;
  readonly "code": string;
  readonly "name": string;
  readonly "path"?: string | null;
};
  readonly "notes"?: string | null;
  readonly "status": OrganizationStoreStatus;
  readonly "extensionValues": {
  readonly [key: string]: JsonValue;
};
  readonly "extensionRuleRevision": number;
  readonly "revision": number;
  readonly "createdAt": number;
  readonly "updatedAt": number;
  readonly "contractDerivedStatus": "OPERATING" | "PREPARING" | "NOT_OPERATING";
  readonly "operatingRuleSwitches": OrganizationStoreOperatingRuleValues;
};

export type OrganizationStoreOperatingRuleValues = {
  readonly "catalogManagementEnabled": boolean;
  readonly "externalCatalogSyncEnabled": boolean;
  readonly "openPlatformDeveloperCode": string;
  readonly "reservationEnabled": boolean;
  readonly "reservationDepositEnabled": boolean;
  readonly "queueCallEnabled": boolean;
  readonly "tableManagementEnabled": boolean;
  readonly "tableStatusEnabled": boolean;
  readonly "tableWaitCallEnabled": boolean;
  readonly "banquetOrderEnabled": boolean;
  readonly "pickupCallEnabled": boolean;
  readonly "receivableEnabled": boolean;
};

export type OrganizationStoreStatus = "ENABLED" | "DISABLED" | "VOIDED";

export type StoreContract = {
  readonly "id": string;
  readonly "groupWorkspaceKey": string;
  readonly "project": {
  readonly "id": string;
  readonly "code": string;
  readonly "name": string;
};
  readonly "store": {
  readonly "id": string;
  readonly "code": string;
  readonly "name": string;
};
  readonly "tenant": {
  readonly "id": string;
  readonly "code": string;
  readonly "name": string;
};
  readonly "phaseName": string | null;
  readonly "contractNo": string;
  readonly "effectiveFrom": string;
  readonly "effectiveTo": string | null;
  readonly "note"?: string | null;
  readonly "extensionValues": {
  readonly [key: string]: JsonValue;
};
  readonly "extensionRuleRevision": number;
  readonly "status": StoreContractStatus;
  readonly "revision": number;
  readonly "source": "MANUAL";
  readonly "createdAt": number;
  readonly "updatedAt": number;
  readonly "items": readonly StoreContractItem[];
  readonly "phaseNameSnapshot"?: string | null;
};

export type StoreContractItem = {
  readonly "code": string;
  readonly "name": string;
};

export type StoreContractStatus = "VALID" | "INVALID";

export type StoreServicePointAreaType = "TABLE_AREA" | "SCAN_AREA";

export type StoreServicePointShape = "HALL" | "PRIVATE_ROOM" | "BOOTH" | "OUTDOOR";

export type StoreServicePointStatus = "ENABLED" | "DISABLED" | "VOIDED";

export type StoreServicePointType = "TABLE" | "SCAN";

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

export type TerminalContractRead = {
  readonly "contract": StoreContract;
  readonly "updatedAtEpochMillis": number;
};

export type TerminalServicePointAreaData = {
  readonly "areaRef": string;
  readonly "storeRef": string;
  readonly "name": string;
  readonly "code": string;
  readonly "areaType": StoreServicePointAreaType;
  readonly "status": StoreServicePointStatus;
  readonly "displayOrder": number;
  readonly "version": number;
  readonly "createdAt": number;
  readonly "updatedAt": number;
};

export type TerminalServicePointAreaRead = {
  readonly "area": TerminalServicePointAreaData;
  readonly "updatedAtEpochMillis": number;
};

export type TerminalServicePointData = {
  readonly "pointRef": string;
  readonly "storeRef": string;
  readonly "areaRef": string;
  readonly "name": string;
  readonly "code": string;
  readonly "pointType": StoreServicePointType;
  readonly "status": StoreServicePointStatus;
  readonly "displayOrder": number;
  readonly "seatCapacity"?: number | null;
  readonly "tableShape"?: StoreServicePointShape | null;
  readonly "reservable"?: boolean | null;
  readonly "imageAssetRef"?: string | null;
  readonly "extensionValues": {
  readonly [key: string]: JsonValue;
};
  readonly "extensionRuleRevision"?: number | null;
  readonly "version": number;
  readonly "createdAt": number;
  readonly "updatedAt": number;
};

export type TerminalServicePointRead = {
  readonly "servicePoint": TerminalServicePointData;
  readonly "updatedAtEpochMillis": number;
};

export type TerminalStoreActiveContractsRead = {
  readonly "items": readonly StoreContract[];
  readonly "collectionUpdatedAtEpochMillis": number;
};

export type TerminalStoreBasicRead = {
  readonly "store": OrganizationStore;
  readonly "operatingRules": OrganizationStoreOperatingRuleValues;
  readonly "storeUpdatedAtEpochMillis": number;
  readonly "operatingRulesUpdatedAtEpochMillis": number;
};

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

export type TerminalStoreServicePointAreasRead = {
  readonly "items": readonly TerminalServicePointAreaData[];
  readonly "collectionUpdatedAtEpochMillis": number;
};

export type TerminalStoreServicePointsRead = {
  readonly "items": readonly TerminalServicePointData[];
  readonly "collectionUpdatedAtEpochMillis": number;
};

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
  readonly "state": "WAITING_USER" | "DOWNLOADING" | "VERIFYING" | "WAITING_IDLE" | "INSTALLING" | "APPLYING_HOT" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "UNKNOWN";
  readonly "reason": "NONE" | "NETWORK" | "HTTP_REJECTED" | "HASH_MISMATCH" | "PREPARE_FAILED" | "INSTALLER_CANCELLED" | "INSTALL_FAILED" | "HOT_APPLY_FAILED" | "UNKNOWN";
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

export type TerminalOperationId = "activateTerminal" | "cancelTerminalActivation" | "issueTerminalUpdateArtifactDownloadGrant" | "submitTerminalUpdateReport" | "terminalReadContract" | "terminalReadProjectUpdateRuleSnapshotPage" | "terminalReadServicePoint" | "terminalReadServicePointArea" | "terminalReadStoreActiveContracts" | "terminalReadStoreBasic" | "terminalReadStoreOrganizationPath" | "terminalReadStoreServicePointAreas" | "terminalReadStoreServicePoints";
export const TERMINAL_OPERATION_IDS = ["activateTerminal","cancelTerminalActivation","issueTerminalUpdateArtifactDownloadGrant","submitTerminalUpdateReport","terminalReadContract","terminalReadProjectUpdateRuleSnapshotPage","terminalReadServicePoint","terminalReadServicePointArea","terminalReadStoreActiveContracts","terminalReadStoreBasic","terminalReadStoreOrganizationPath","terminalReadStoreServicePointAreas","terminalReadStoreServicePoints"] as const;
export type TerminalRequestMap = {
  activateTerminal: { readonly pathParameters: {  }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: Readonly<Record<string, never>>; readonly body: TerminalActivationRequest };
  cancelTerminalActivation: { readonly pathParameters: { readonly "terminalRef": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: { readonly "Authorization": string }; readonly body?: never };
  issueTerminalUpdateArtifactDownloadGrant: { readonly pathParameters: { readonly "artifactRef": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: { readonly "X-Terminal-Ref": string; readonly "Authorization": string }; readonly body?: never };
  submitTerminalUpdateReport: { readonly pathParameters: {  }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: { readonly "Idempotency-Key": string; readonly "X-Terminal-Ref": string; readonly "Authorization": string }; readonly body: TerminalUpdateReportRequest };
  terminalReadContract: { readonly pathParameters: { readonly "contractRef": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: { readonly "X-Terminal-Ref": string; readonly "Authorization": string }; readonly body?: never };
  terminalReadProjectUpdateRuleSnapshotPage: { readonly pathParameters: { readonly "projectRef": string }; readonly queryParameters: { readonly "collectionHash": string | null; readonly "cursor"?: string | null; readonly "limit": number }; readonly headers: { readonly "X-Terminal-Ref": string; readonly "Authorization": string }; readonly body?: never };
  terminalReadServicePoint: { readonly pathParameters: { readonly "pointRef": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: { readonly "X-Terminal-Ref": string; readonly "Authorization": string }; readonly body?: never };
  terminalReadServicePointArea: { readonly pathParameters: { readonly "areaRef": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: { readonly "X-Terminal-Ref": string; readonly "Authorization": string }; readonly body?: never };
  terminalReadStoreActiveContracts: { readonly pathParameters: { readonly "storeRef": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: { readonly "X-Terminal-Ref": string; readonly "Authorization": string }; readonly body?: never };
  terminalReadStoreBasic: { readonly pathParameters: { readonly "storeRef": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: { readonly "X-Terminal-Ref": string; readonly "Authorization": string }; readonly body?: never };
  terminalReadStoreOrganizationPath: { readonly pathParameters: { readonly "storeRef": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: { readonly "X-Terminal-Ref": string; readonly "Authorization": string }; readonly body?: never };
  terminalReadStoreServicePointAreas: { readonly pathParameters: { readonly "storeRef": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: { readonly "X-Terminal-Ref": string; readonly "Authorization": string }; readonly body?: never };
  terminalReadStoreServicePoints: { readonly pathParameters: { readonly "storeRef": string }; readonly queryParameters: Readonly<Record<string, never>>; readonly headers: { readonly "X-Terminal-Ref": string; readonly "Authorization": string }; readonly body?: never };
};
export type TerminalResponseMap = {
  activateTerminal: TerminalActivationResult;
  cancelTerminalActivation: TerminalActivationCancellationResult;
  issueTerminalUpdateArtifactDownloadGrant: TerminalUpdateDownloadGrantResult;
  submitTerminalUpdateReport: TerminalUpdateReportReceipt;
  terminalReadContract: TerminalContractRead;
  terminalReadProjectUpdateRuleSnapshotPage: TerminalUpdateRuleSnapshotPage;
  terminalReadServicePoint: TerminalServicePointRead;
  terminalReadServicePointArea: TerminalServicePointAreaRead;
  terminalReadStoreActiveContracts: TerminalStoreActiveContractsRead;
  terminalReadStoreBasic: TerminalStoreBasicRead;
  terminalReadStoreOrganizationPath: TerminalStoreOrganizationPathRead;
  terminalReadStoreServicePointAreas: TerminalStoreServicePointAreasRead;
  terminalReadStoreServicePoints: TerminalStoreServicePointsRead;
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
  | {readonly kind: "failure"; readonly category: "not-delivered" | "delivered-failure" | "unknown-business-rejection"; readonly code: string; readonly status?: number};
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
    requestSchema: "NoBody",
    responseSchema: "TerminalActivationCancellationResult",
  },
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
  "terminalReadContract": {
    operationId: "terminalReadContract",
    method: "GET",
    path: "/contracts/{contractRef}",
    owner: "store-contract",
    authorizationMode: "TERMINAL_CREDENTIAL",
    idempotencyRequired: false,
    safeRetryable: false,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_ACCESS_DENIED","PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED","PLATFORM_COMMON_RESOURCE_NOT_FOUND","PLATFORM_COMMON_VALIDATION_FAILED","PLATFORM_DEPENDENCY_UNAVAILABLE","STORE_TERMINAL_DISABLED","TERMINAL_BINDING_CREDENTIAL_INVALID"],
    requestSchema: "NoBody",
    responseSchema: "TerminalContractRead",
  },
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
  "terminalReadServicePoint": {
    operationId: "terminalReadServicePoint",
    method: "GET",
    path: "/service-points/{pointRef}",
    owner: "organization",
    authorizationMode: "TERMINAL_CREDENTIAL",
    idempotencyRequired: false,
    safeRetryable: false,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_ACCESS_DENIED","PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED","PLATFORM_COMMON_RESOURCE_NOT_FOUND","PLATFORM_COMMON_VALIDATION_FAILED","PLATFORM_DEPENDENCY_UNAVAILABLE","STORE_TERMINAL_DISABLED","TERMINAL_BINDING_CREDENTIAL_INVALID"],
    requestSchema: "NoBody",
    responseSchema: "TerminalServicePointRead",
  },
  "terminalReadServicePointArea": {
    operationId: "terminalReadServicePointArea",
    method: "GET",
    path: "/service-point-areas/{areaRef}",
    owner: "organization",
    authorizationMode: "TERMINAL_CREDENTIAL",
    idempotencyRequired: false,
    safeRetryable: false,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_ACCESS_DENIED","PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED","PLATFORM_COMMON_RESOURCE_NOT_FOUND","PLATFORM_COMMON_VALIDATION_FAILED","PLATFORM_DEPENDENCY_UNAVAILABLE","STORE_TERMINAL_DISABLED","TERMINAL_BINDING_CREDENTIAL_INVALID"],
    requestSchema: "NoBody",
    responseSchema: "TerminalServicePointAreaRead",
  },
  "terminalReadStoreActiveContracts": {
    operationId: "terminalReadStoreActiveContracts",
    method: "GET",
    path: "/stores/{storeRef}/contracts",
    owner: "store-contract",
    authorizationMode: "TERMINAL_CREDENTIAL",
    idempotencyRequired: false,
    safeRetryable: false,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_ACCESS_DENIED","PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED","PLATFORM_COMMON_RESOURCE_NOT_FOUND","PLATFORM_COMMON_VALIDATION_FAILED","PLATFORM_DEPENDENCY_UNAVAILABLE","STORE_TERMINAL_DISABLED","TERMINAL_BINDING_CREDENTIAL_INVALID"],
    requestSchema: "NoBody",
    responseSchema: "TerminalStoreActiveContractsRead",
  },
  "terminalReadStoreBasic": {
    operationId: "terminalReadStoreBasic",
    method: "GET",
    path: "/stores/{storeRef}/basic",
    owner: "organization",
    authorizationMode: "TERMINAL_CREDENTIAL",
    idempotencyRequired: false,
    safeRetryable: false,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_ACCESS_DENIED","PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED","PLATFORM_COMMON_RESOURCE_NOT_FOUND","PLATFORM_COMMON_VALIDATION_FAILED","PLATFORM_DEPENDENCY_UNAVAILABLE","STORE_TERMINAL_DISABLED","TERMINAL_BINDING_CREDENTIAL_INVALID"],
    requestSchema: "NoBody",
    responseSchema: "TerminalStoreBasicRead",
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
  "terminalReadStoreServicePointAreas": {
    operationId: "terminalReadStoreServicePointAreas",
    method: "GET",
    path: "/stores/{storeRef}/service-point-areas",
    owner: "organization",
    authorizationMode: "TERMINAL_CREDENTIAL",
    idempotencyRequired: false,
    safeRetryable: false,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_ACCESS_DENIED","PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED","PLATFORM_COMMON_RESOURCE_NOT_FOUND","PLATFORM_COMMON_VALIDATION_FAILED","PLATFORM_DEPENDENCY_UNAVAILABLE","STORE_TERMINAL_DISABLED","TERMINAL_BINDING_CREDENTIAL_INVALID"],
    requestSchema: "NoBody",
    responseSchema: "TerminalStoreServicePointAreasRead",
  },
  "terminalReadStoreServicePoints": {
    operationId: "terminalReadStoreServicePoints",
    method: "GET",
    path: "/stores/{storeRef}/service-points",
    owner: "organization",
    authorizationMode: "TERMINAL_CREDENTIAL",
    idempotencyRequired: false,
    safeRetryable: false,
    successStatus: 200,
    errorCodes: ["PLATFORM_COMMON_ACCESS_DENIED","PLATFORM_COMMON_GROUP_WORKSPACE_DISABLED","PLATFORM_COMMON_RESOURCE_NOT_FOUND","PLATFORM_COMMON_VALIDATION_FAILED","PLATFORM_DEPENDENCY_UNAVAILABLE","STORE_TERMINAL_DISABLED","TERMINAL_BINDING_CREDENTIAL_INVALID"],
    requestSchema: "NoBody",
    responseSchema: "TerminalStoreServicePointsRead",
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
const terminalResponseSchemas = JSON.parse("{\"NoBody\":{\"type\":\"object\",\"additionalProperties\":false},\"OrganizationStore\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"id\",\"groupWorkspaceKey\",\"code\",\"name\",\"project\",\"brand\",\"tenant\",\"status\",\"extensionValues\",\"extensionRuleRevision\",\"revision\",\"createdAt\",\"updatedAt\",\"contractDerivedStatus\",\"operatingRuleSwitches\"],\"properties\":{\"id\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"groupWorkspaceKey\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"code\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"name\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120},\"project\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"id\",\"code\",\"name\"],\"properties\":{\"id\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"code\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"name\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120},\"path\":{\"type\":\"string\",\"nullable\":true,\"maxLength\":512}}},\"brand\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"id\",\"code\",\"name\"],\"properties\":{\"id\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"code\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"name\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120},\"path\":{\"type\":\"string\",\"nullable\":true,\"maxLength\":512}}},\"tenant\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"id\",\"code\",\"name\"],\"properties\":{\"id\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"code\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"name\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120},\"path\":{\"type\":\"string\",\"nullable\":true,\"maxLength\":512}}},\"headCompany\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"id\",\"code\",\"name\"],\"properties\":{\"id\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"code\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"name\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120},\"path\":{\"type\":\"string\",\"nullable\":true,\"maxLength\":512}}},\"notes\":{\"type\":\"string\",\"nullable\":true,\"maxLength\":2000},\"status\":{\"$ref\":\"#/components/schemas/OrganizationStoreStatus\"},\"extensionValues\":{\"type\":\"object\",\"additionalProperties\":true},\"extensionRuleRevision\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"revision\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"createdAt\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"updatedAt\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"contractDerivedStatus\":{\"type\":\"string\",\"enum\":[\"OPERATING\",\"PREPARING\",\"NOT_OPERATING\"],\"readOnly\":true},\"operatingRuleSwitches\":{\"$ref\":\"#/components/schemas/OrganizationStoreOperatingRuleValues\"}}},\"OrganizationStoreOperatingRuleValues\":{\"type\":\"object\",\"description\":\"门店经营规则开关的完整值集合；由 store-operating-rule-switches.json 生成。\",\"additionalProperties\":false,\"required\":[\"catalogManagementEnabled\",\"externalCatalogSyncEnabled\",\"openPlatformDeveloperCode\",\"reservationEnabled\",\"reservationDepositEnabled\",\"queueCallEnabled\",\"tableManagementEnabled\",\"tableStatusEnabled\",\"tableWaitCallEnabled\",\"banquetOrderEnabled\",\"pickupCallEnabled\",\"receivableEnabled\"],\"properties\":{\"catalogManagementEnabled\":{\"type\":\"boolean\",\"default\":false,\"description\":\"是否启用商品、库存和菜单管理\"},\"externalCatalogSyncEnabled\":{\"type\":\"boolean\",\"default\":false,\"description\":\"是否启用外部商品、库存、菜单同步\"},\"openPlatformDeveloperCode\":{\"type\":\"string\",\"default\":\"\",\"description\":\"开放平台开发者编码\"},\"reservationEnabled\":{\"type\":\"boolean\",\"default\":false,\"description\":\"是否启用预约功能\"},\"reservationDepositEnabled\":{\"type\":\"boolean\",\"default\":false,\"description\":\"是否支持押金预约\"},\"queueCallEnabled\":{\"type\":\"boolean\",\"default\":false,\"description\":\"是否启用排队叫号\"},\"tableManagementEnabled\":{\"type\":\"boolean\",\"default\":false,\"description\":\"是否启用桌台和二维码管理\"},\"tableStatusEnabled\":{\"type\":\"boolean\",\"default\":false,\"description\":\"是否启用桌台状态管理\"},\"tableWaitCallEnabled\":{\"type\":\"boolean\",\"default\":false,\"description\":\"是否支持「等叫」功能\"},\"banquetOrderEnabled\":{\"type\":\"boolean\",\"default\":false,\"description\":\"是否支持宴会订单\"},\"pickupCallEnabled\":{\"type\":\"boolean\",\"default\":false,\"description\":\"是否启用取餐叫号\"},\"receivableEnabled\":{\"type\":\"boolean\",\"default\":false,\"description\":\"是否支持应收单管理\"}}},\"OrganizationStoreStatus\":{\"type\":\"string\",\"enum\":[\"ENABLED\",\"DISABLED\",\"VOIDED\"]},\"StoreContract\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"id\",\"groupWorkspaceKey\",\"project\",\"store\",\"tenant\",\"phaseName\",\"contractNo\",\"effectiveFrom\",\"effectiveTo\",\"extensionValues\",\"extensionRuleRevision\",\"status\",\"revision\",\"source\",\"createdAt\",\"updatedAt\",\"items\",\"effectiveFrom\"],\"properties\":{\"id\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"groupWorkspaceKey\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"project\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"id\",\"code\",\"name\"],\"properties\":{\"id\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"code\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"name\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120}}},\"store\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"id\",\"code\",\"name\"],\"properties\":{\"id\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"code\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"name\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120}}},\"tenant\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"id\",\"code\",\"name\"],\"properties\":{\"id\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"code\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"name\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120}}},\"phaseName\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120,\"nullable\":true},\"contractNo\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120},\"effectiveFrom\":{\"type\":\"string\",\"format\":\"date\"},\"effectiveTo\":{\"type\":\"string\",\"format\":\"date\",\"nullable\":true},\"note\":{\"type\":\"string\",\"nullable\":true,\"maxLength\":2000},\"extensionValues\":{\"type\":\"object\",\"additionalProperties\":true},\"extensionRuleRevision\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"status\":{\"$ref\":\"#/components/schemas/StoreContractStatus\"},\"revision\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"source\":{\"type\":\"string\",\"enum\":[\"MANUAL\"]},\"createdAt\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"updatedAt\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"items\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/components/schemas/StoreContractItem\"},\"minItems\":1},\"phaseNameSnapshot\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120,\"nullable\":true}}},\"StoreContractItem\":{\"type\":\"object\",\"required\":[\"code\",\"name\"],\"properties\":{\"code\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":120},\"name\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":240}},\"additionalProperties\":false},\"StoreContractStatus\":{\"type\":\"string\",\"enum\":[\"VALID\",\"INVALID\"]},\"StoreServicePointAreaType\":{\"type\":\"string\",\"enum\":[\"TABLE_AREA\",\"SCAN_AREA\"]},\"StoreServicePointShape\":{\"type\":\"string\",\"enum\":[\"HALL\",\"PRIVATE_ROOM\",\"BOOTH\",\"OUTDOOR\"]},\"StoreServicePointStatus\":{\"type\":\"string\",\"enum\":[\"ENABLED\",\"DISABLED\",\"VOIDED\"]},\"StoreServicePointType\":{\"type\":\"string\",\"enum\":[\"TABLE\",\"SCAN\"]},\"TerminalActivationCancellationResult\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"outcome\"],\"properties\":{\"outcome\":{\"type\":\"string\",\"enum\":[\"CANCELLED\",\"ALREADY_CANCELLED\"]}}},\"TerminalActivationRequest\":{\"type\":\"object\",\"additionalProperties\":true,\"required\":[\"activationCode\",\"deviceId\",\"surfaceForm\",\"appVersion\",\"credentialSecret\"],\"properties\":{\"activationCode\":{\"type\":\"string\",\"minLength\":8,\"maxLength\":8,\"pattern\":\"^[0-9]{8}$\"},\"deviceId\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":128},\"surfaceForm\":{\"type\":\"string\",\"enum\":[\"laptop\",\"mobile\"]},\"appVersion\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64},\"credentialSecret\":{\"type\":\"string\",\"minLength\":43,\"maxLength\":43,\"pattern\":\"^[A-Za-z0-9_-]{43}$\"}}},\"TerminalActivationResult\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"terminalRef\",\"storeRef\",\"groupWorkspaceKey\",\"bindingGeneration\"],\"properties\":{\"terminalRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"storeRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"groupWorkspaceKey\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":64,\"pattern\":\"^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$\"},\"bindingGeneration\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":1}}},\"TerminalContractRead\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"contract\",\"updatedAtEpochMillis\"],\"properties\":{\"contract\":{\"$ref\":\"#/components/schemas/StoreContract\"},\"updatedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0}}},\"TerminalServicePointAreaData\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"areaRef\",\"storeRef\",\"name\",\"code\",\"areaType\",\"status\",\"displayOrder\",\"version\",\"createdAt\",\"updatedAt\"],\"properties\":{\"areaRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"storeRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"name\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":160},\"code\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":160},\"areaType\":{\"$ref\":\"#/components/schemas/StoreServicePointAreaType\"},\"status\":{\"$ref\":\"#/components/schemas/StoreServicePointStatus\"},\"displayOrder\":{\"type\":\"integer\",\"minimum\":0},\"version\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"createdAt\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"updatedAt\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0}}},\"TerminalServicePointAreaRead\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"area\",\"updatedAtEpochMillis\"],\"properties\":{\"area\":{\"$ref\":\"#/components/schemas/TerminalServicePointAreaData\"},\"updatedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0}}},\"TerminalServicePointData\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"pointRef\",\"storeRef\",\"areaRef\",\"name\",\"code\",\"pointType\",\"status\",\"displayOrder\",\"extensionValues\",\"version\",\"createdAt\",\"updatedAt\"],\"properties\":{\"pointRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"storeRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"areaRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"name\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":160},\"code\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":160},\"pointType\":{\"$ref\":\"#/components/schemas/StoreServicePointType\"},\"status\":{\"$ref\":\"#/components/schemas/StoreServicePointStatus\"},\"displayOrder\":{\"type\":\"integer\",\"minimum\":0},\"seatCapacity\":{\"type\":[\"integer\",\"null\"],\"minimum\":1,\"maximum\":10000},\"tableShape\":{\"allOf\":[{\"$ref\":\"#/components/schemas/StoreServicePointShape\"}],\"nullable\":true},\"reservable\":{\"type\":[\"boolean\",\"null\"]},\"imageAssetRef\":{\"type\":[\"string\",\"null\"],\"format\":\"uuid\"},\"extensionValues\":{\"type\":\"object\",\"additionalProperties\":true},\"extensionRuleRevision\":{\"type\":[\"integer\",\"null\"],\"format\":\"int64\",\"minimum\":0},\"version\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"createdAt\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"updatedAt\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0}}},\"TerminalServicePointRead\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"servicePoint\",\"updatedAtEpochMillis\"],\"properties\":{\"servicePoint\":{\"$ref\":\"#/components/schemas/TerminalServicePointData\"},\"updatedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0}}},\"TerminalStoreActiveContractsRead\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"items\",\"collectionUpdatedAtEpochMillis\"],\"properties\":{\"items\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/components/schemas/StoreContract\"}},\"collectionUpdatedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0}}},\"TerminalStoreBasicRead\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"store\",\"operatingRules\",\"storeUpdatedAtEpochMillis\",\"operatingRulesUpdatedAtEpochMillis\"],\"properties\":{\"store\":{\"$ref\":\"#/components/schemas/OrganizationStore\"},\"operatingRules\":{\"$ref\":\"#/components/schemas/OrganizationStoreOperatingRuleValues\"},\"storeUpdatedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"operatingRulesUpdatedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0}}},\"TerminalStoreOrganizationPathRead\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"projectRef\",\"projectName\",\"regionRef\",\"regionName\",\"commercialGroupRef\",\"commercialGroupName\",\"projectUpdatedAtEpochMillis\",\"regionUpdatedAtEpochMillis\",\"commercialGroupUpdatedAtEpochMillis\"],\"properties\":{\"projectRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"projectName\":{\"type\":\"string\"},\"regionRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"regionName\":{\"type\":\"string\"},\"commercialGroupRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"commercialGroupName\":{\"type\":\"string\"},\"projectUpdatedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"regionUpdatedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"commercialGroupUpdatedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0}}},\"TerminalStoreServicePointAreasRead\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"items\",\"collectionUpdatedAtEpochMillis\"],\"properties\":{\"items\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/components/schemas/TerminalServicePointAreaData\"}},\"collectionUpdatedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0}}},\"TerminalStoreServicePointsRead\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"items\",\"collectionUpdatedAtEpochMillis\"],\"properties\":{\"items\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/components/schemas/TerminalServicePointData\"}},\"collectionUpdatedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0}}},\"TerminalUpdateApkFacts\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"path\",\"sha256\",\"certificateSha256\"],\"properties\":{\"path\":{\"type\":\"string\",\"minLength\":1},\"sha256\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"},\"certificateSha256\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"}}},\"TerminalUpdateArtifactFile\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"path\",\"sizeBytes\",\"sha256\"],\"properties\":{\"path\":{\"type\":\"string\",\"minLength\":1},\"sizeBytes\":{\"type\":\"integer\",\"minimum\":0},\"sha256\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"}}},\"TerminalUpdateArtifactManifest\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"schemaVersion\",\"platform\",\"applicationId\",\"nativeVersion\",\"nativeBuildNumber\",\"bundleVersion\",\"runtimeVersion\",\"entry\",\"files\",\"publicationId\",\"minimumFull\",\"apk\"],\"properties\":{\"schemaVersion\":{\"type\":\"integer\",\"enum\":[1]},\"platform\":{\"type\":\"string\",\"enum\":[\"android\"]},\"applicationId\":{\"type\":\"string\",\"minLength\":1},\"nativeVersion\":{\"type\":\"string\",\"minLength\":1},\"nativeBuildNumber\":{\"type\":\"integer\",\"minimum\":1},\"bundleVersion\":{\"type\":\"string\",\"minLength\":1},\"runtimeVersion\":{\"type\":\"string\",\"minLength\":1},\"entry\":{\"type\":\"string\",\"minLength\":1},\"files\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/components/schemas/TerminalUpdateArtifactFile\"}},\"publicationId\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"},\"minimumFull\":{\"allOf\":[{\"$ref\":\"#/components/schemas/TerminalUpdateMinimumFull\"}],\"nullable\":true},\"apk\":{\"allOf\":[{\"$ref\":\"#/components/schemas/TerminalUpdateApkFacts\"}],\"nullable\":true}}},\"TerminalUpdateArtifactSummary\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"artifactRef\",\"kind\",\"applicationId\",\"runtimeVersion\",\"nativeBuildNumber\",\"apkVersion\",\"jsVersion\",\"publicationId\",\"apkSha256\",\"zipSha256\",\"byteSize\",\"createdAtEpochMillis\"],\"properties\":{\"artifactRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"kind\":{\"type\":\"string\",\"enum\":[\"FULL\",\"HOT\"]},\"applicationId\":{\"type\":\"string\"},\"runtimeVersion\":{\"type\":\"string\"},\"nativeBuildNumber\":{\"type\":\"integer\",\"minimum\":0},\"apkVersion\":{\"type\":\"string\"},\"jsVersion\":{\"type\":\"string\"},\"publicationId\":{\"type\":\"string\"},\"apkSha256\":{\"type\":[\"string\",\"null\"],\"pattern\":\"^[a-f0-9]{64}$\"},\"zipSha256\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"},\"byteSize\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":1},\"createdAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0}}},\"TerminalUpdateDownloadGrantResult\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"relativeContentPath\",\"grant\",\"expiresAtEpochMillis\",\"artifactRef\",\"zipSha256\",\"byteSize\",\"artifact\"],\"properties\":{\"relativeContentPath\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":512},\"grant\":{\"type\":\"string\",\"minLength\":32,\"maxLength\":256},\"expiresAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"artifactRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"zipSha256\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"},\"byteSize\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":1},\"artifact\":{\"$ref\":\"#/components/schemas/TerminalUpdateArtifactManifest\"}}},\"TerminalUpdateMinimumFull\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"applicationId\",\"nativeBuildNumber\",\"runtimeVersion\",\"publicationId\",\"apkSha256\"],\"properties\":{\"applicationId\":{\"type\":\"string\"},\"nativeBuildNumber\":{\"type\":\"integer\",\"minimum\":1},\"runtimeVersion\":{\"type\":\"string\",\"minLength\":1},\"publicationId\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"},\"apkSha256\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"}}},\"TerminalUpdateReportActual\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"apkVersion\",\"nativeBuildNumber\",\"applicationId\",\"runtimeVersion\",\"jsVersion\",\"publicationId\",\"apkSha256\",\"bundleSha256\",\"entryKind\",\"unknownReason\"],\"properties\":{\"apkVersion\":{\"type\":[\"string\",\"null\"]},\"nativeBuildNumber\":{\"type\":[\"integer\",\"null\"],\"minimum\":0},\"applicationId\":{\"type\":\"string\"},\"runtimeVersion\":{\"type\":\"string\"},\"jsVersion\":{\"type\":[\"string\",\"null\"]},\"publicationId\":{\"type\":[\"string\",\"null\"]},\"apkSha256\":{\"type\":[\"string\",\"null\"],\"pattern\":\"^[a-f0-9]{64}$\"},\"bundleSha256\":{\"type\":[\"string\",\"null\"],\"pattern\":\"^[a-f0-9]{64}$\"},\"entryKind\":{\"type\":\"string\",\"enum\":[\"INSTALLED_APK\",\"EMBEDDED_BUNDLE\",\"HOT_BUNDLE\",\"UNKNOWN\"]},\"unknownReason\":{\"type\":[\"string\",\"null\"],\"enum\":[\"READBACK_UNAVAILABLE\",\"NOT_INSTALLED\",\"MISMATCH\",\"OTHER\",null]}}},\"TerminalUpdateReportReceipt\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"reportId\",\"taskId\",\"acceptedSequence\",\"outcome\"],\"properties\":{\"reportId\":{\"type\":\"string\",\"format\":\"uuid\"},\"taskId\":{\"type\":[\"string\",\"null\"],\"format\":\"uuid\"},\"acceptedSequence\":{\"type\":\"integer\",\"minimum\":1,\"maximum\":9007199254740991},\"outcome\":{\"type\":\"string\",\"enum\":[\"ACCEPTED\",\"SUPERSEDED\"]}}},\"TerminalUpdateReportRecent\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"state\",\"reason\",\"changedAtEpochMillis\",\"ruleRef\",\"fullArtifactRef\",\"hotArtifactRef\"],\"properties\":{\"state\":{\"type\":\"string\",\"enum\":[\"WAITING_USER\",\"DOWNLOADING\",\"VERIFYING\",\"WAITING_IDLE\",\"INSTALLING\",\"APPLYING_HOT\",\"SUCCEEDED\",\"FAILED\",\"CANCELLED\",\"UNKNOWN\"]},\"reason\":{\"type\":\"string\",\"enum\":[\"NONE\",\"NETWORK\",\"HTTP_REJECTED\",\"HASH_MISMATCH\",\"PREPARE_FAILED\",\"INSTALLER_CANCELLED\",\"INSTALL_FAILED\",\"HOT_APPLY_FAILED\",\"UNKNOWN\"]},\"changedAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"ruleRef\":{\"type\":[\"string\",\"null\"],\"format\":\"uuid\"},\"fullArtifactRef\":{\"type\":[\"string\",\"null\"],\"format\":\"uuid\"},\"hotArtifactRef\":{\"type\":[\"string\",\"null\"],\"format\":\"uuid\"}}},\"TerminalUpdateReportRequest\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"reportId\",\"reportSequence\",\"taskId\",\"actual\",\"recent\"],\"properties\":{\"reportId\":{\"type\":\"string\",\"format\":\"uuid\"},\"reportSequence\":{\"type\":\"integer\",\"minimum\":1,\"maximum\":9007199254740991},\"taskId\":{\"type\":[\"string\",\"null\"],\"format\":\"uuid\"},\"actual\":{\"$ref\":\"#/components/schemas/TerminalUpdateReportActual\"},\"recent\":{\"$ref\":\"#/components/schemas/TerminalUpdateReportRecent\"}}},\"TerminalUpdateRuleSnapshotItem\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"ruleRef\",\"targetMode\",\"storeRefs\",\"applicationId\",\"createdAtEpochMillis\",\"full\",\"hot\",\"nSeconds\",\"hotStrategy\",\"mSeconds\",\"description\"],\"properties\":{\"ruleRef\":{\"type\":\"string\",\"format\":\"uuid\"},\"targetMode\":{\"type\":\"string\",\"enum\":[\"ALL\",\"STORE_REFS\"]},\"storeRefs\":{\"type\":\"array\",\"items\":{\"type\":\"string\",\"format\":\"uuid\"}},\"applicationId\":{\"type\":\"string\"},\"createdAtEpochMillis\":{\"type\":\"integer\",\"format\":\"int64\",\"minimum\":0},\"full\":{\"$ref\":\"#/components/schemas/TerminalUpdateArtifactSummary\"},\"hot\":{\"allOf\":[{\"$ref\":\"#/components/schemas/TerminalUpdateArtifactSummary\"}],\"nullable\":true},\"nSeconds\":{\"type\":\"integer\",\"minimum\":60,\"maximum\":86400},\"hotStrategy\":{\"type\":\"string\",\"enum\":[\"IMMEDIATE\",\"IDLE\"],\"nullable\":true},\"mSeconds\":{\"type\":[\"integer\",\"null\"],\"minimum\":60,\"maximum\":86400},\"description\":{\"type\":[\"string\",\"null\"],\"maxLength\":500}}},\"TerminalUpdateRuleSnapshotPage\":{\"type\":\"object\",\"additionalProperties\":false,\"required\":[\"items\",\"collectionHash\",\"nextCursor\"],\"properties\":{\"items\":{\"type\":\"array\",\"items\":{\"$ref\":\"#/components/schemas/TerminalUpdateRuleSnapshotItem\"}},\"collectionHash\":{\"type\":\"string\",\"pattern\":\"^[a-f0-9]{64}$\"},\"nextCursor\":{\"type\":[\"string\",\"null\"]}}}}") as Readonly<Record<string, TerminalJsonSchema>>;

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

export function isOrganizationStore(value: unknown): value is OrganizationStore {
  return matchesTerminalSchema(terminalResponseSchemas["OrganizationStore"], value);
}

export function isOrganizationStoreOperatingRuleValues(value: unknown): value is OrganizationStoreOperatingRuleValues {
  return matchesTerminalSchema(terminalResponseSchemas["OrganizationStoreOperatingRuleValues"], value);
}

export function isOrganizationStoreStatus(value: unknown): value is OrganizationStoreStatus {
  return matchesTerminalSchema(terminalResponseSchemas["OrganizationStoreStatus"], value);
}

export function isStoreContract(value: unknown): value is StoreContract {
  return matchesTerminalSchema(terminalResponseSchemas["StoreContract"], value);
}

export function isStoreContractItem(value: unknown): value is StoreContractItem {
  return matchesTerminalSchema(terminalResponseSchemas["StoreContractItem"], value);
}

export function isStoreContractStatus(value: unknown): value is StoreContractStatus {
  return matchesTerminalSchema(terminalResponseSchemas["StoreContractStatus"], value);
}

export function isStoreServicePointAreaType(value: unknown): value is StoreServicePointAreaType {
  return matchesTerminalSchema(terminalResponseSchemas["StoreServicePointAreaType"], value);
}

export function isStoreServicePointShape(value: unknown): value is StoreServicePointShape {
  return matchesTerminalSchema(terminalResponseSchemas["StoreServicePointShape"], value);
}

export function isStoreServicePointStatus(value: unknown): value is StoreServicePointStatus {
  return matchesTerminalSchema(terminalResponseSchemas["StoreServicePointStatus"], value);
}

export function isStoreServicePointType(value: unknown): value is StoreServicePointType {
  return matchesTerminalSchema(terminalResponseSchemas["StoreServicePointType"], value);
}

export function isTerminalActivationCancellationResult(value: unknown): value is TerminalActivationCancellationResult {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalActivationCancellationResult"], value);
}

export function isTerminalActivationRequest(value: unknown): value is TerminalActivationRequest {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalActivationRequest"], value);
}

export function isTerminalActivationResult(value: unknown): value is TerminalActivationResult {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalActivationResult"], value);
}

export function isTerminalContractRead(value: unknown): value is TerminalContractRead {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalContractRead"], value);
}

export function isTerminalServicePointAreaData(value: unknown): value is TerminalServicePointAreaData {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalServicePointAreaData"], value);
}

export function isTerminalServicePointAreaRead(value: unknown): value is TerminalServicePointAreaRead {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalServicePointAreaRead"], value);
}

export function isTerminalServicePointData(value: unknown): value is TerminalServicePointData {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalServicePointData"], value);
}

export function isTerminalServicePointRead(value: unknown): value is TerminalServicePointRead {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalServicePointRead"], value);
}

export function isTerminalStoreActiveContractsRead(value: unknown): value is TerminalStoreActiveContractsRead {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalStoreActiveContractsRead"], value);
}

export function isTerminalStoreBasicRead(value: unknown): value is TerminalStoreBasicRead {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalStoreBasicRead"], value);
}

export function isTerminalStoreOrganizationPathRead(value: unknown): value is TerminalStoreOrganizationPathRead {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalStoreOrganizationPathRead"], value);
}

export function isTerminalStoreServicePointAreasRead(value: unknown): value is TerminalStoreServicePointAreasRead {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalStoreServicePointAreasRead"], value);
}

export function isTerminalStoreServicePointsRead(value: unknown): value is TerminalStoreServicePointsRead {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalStoreServicePointsRead"], value);
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

export function isTerminalUpdateArtifactSummary(value: unknown): value is TerminalUpdateArtifactSummary {
  return matchesTerminalSchema(terminalResponseSchemas["TerminalUpdateArtifactSummary"], value);
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
    if (result.status >= 200 && result.status < 300) {
      if (result.status !== descriptor.successStatus || !validateTerminalResponse(descriptor.responseSchema, result.body)) {
        return {kind: "failure", category: "delivered-failure", code: "TERMINAL_RESPONSE_SCHEMA_INVALID", status: result.status};
      }
      return {kind: "success", status: result.status, body: result.body as TerminalResponseMap[I]};
    }
    if (result.status >= 400 && result.status < 500 && isTerminalBusinessProblem(result.body, result.status)) {
      if (descriptor.errorCodes.includes(result.body.errorCode as never)) {
        return {kind: "business-rejection", status: result.status, errorCode: result.body.errorCode as TerminalBusinessErrorCode<I>, problem: result.body};
      }
      return {kind: "failure", category: "unknown-business-rejection", code: result.body.errorCode, status: result.status};
    }
    return {kind: "failure", category: "delivered-failure", code: "HTTP_DELIVERED_FAILURE", status: result.status};
  };
  return {
    activateTerminal: (request: TerminalRequestMap["activateTerminal"]) => execute("activateTerminal", request),
    cancelTerminalActivation: (request: TerminalRequestMap["cancelTerminalActivation"]) => execute("cancelTerminalActivation", request),
    issueTerminalUpdateArtifactDownloadGrant: (request: TerminalRequestMap["issueTerminalUpdateArtifactDownloadGrant"]) => execute("issueTerminalUpdateArtifactDownloadGrant", request),
    submitTerminalUpdateReport: (request: TerminalRequestMap["submitTerminalUpdateReport"]) => execute("submitTerminalUpdateReport", request),
    terminalReadContract: (request: TerminalRequestMap["terminalReadContract"]) => execute("terminalReadContract", request),
    terminalReadProjectUpdateRuleSnapshotPage: (request: TerminalRequestMap["terminalReadProjectUpdateRuleSnapshotPage"]) => execute("terminalReadProjectUpdateRuleSnapshotPage", request),
    terminalReadServicePoint: (request: TerminalRequestMap["terminalReadServicePoint"]) => execute("terminalReadServicePoint", request),
    terminalReadServicePointArea: (request: TerminalRequestMap["terminalReadServicePointArea"]) => execute("terminalReadServicePointArea", request),
    terminalReadStoreActiveContracts: (request: TerminalRequestMap["terminalReadStoreActiveContracts"]) => execute("terminalReadStoreActiveContracts", request),
    terminalReadStoreBasic: (request: TerminalRequestMap["terminalReadStoreBasic"]) => execute("terminalReadStoreBasic", request),
    terminalReadStoreOrganizationPath: (request: TerminalRequestMap["terminalReadStoreOrganizationPath"]) => execute("terminalReadStoreOrganizationPath", request),
    terminalReadStoreServicePointAreas: (request: TerminalRequestMap["terminalReadStoreServicePointAreas"]) => execute("terminalReadStoreServicePointAreas", request),
    terminalReadStoreServicePoints: (request: TerminalRequestMap["terminalReadStoreServicePoints"]) => execute("terminalReadStoreServicePoints", request),
  } as const;
}

function validateTerminalResponse(schemaName: string, value: unknown): boolean {
  switch (schemaName) {
    case "TerminalActivationResult": return isTerminalActivationResult(value);
    case "TerminalActivationCancellationResult": return isTerminalActivationCancellationResult(value);
    case "TerminalUpdateDownloadGrantResult": return isTerminalUpdateDownloadGrantResult(value);
    case "TerminalUpdateReportReceipt": return isTerminalUpdateReportReceipt(value);
    case "TerminalContractRead": return isTerminalContractRead(value);
    case "TerminalUpdateRuleSnapshotPage": return isTerminalUpdateRuleSnapshotPage(value);
    case "TerminalServicePointRead": return isTerminalServicePointRead(value);
    case "TerminalServicePointAreaRead": return isTerminalServicePointAreaRead(value);
    case "TerminalStoreActiveContractsRead": return isTerminalStoreActiveContractsRead(value);
    case "TerminalStoreBasicRead": return isTerminalStoreBasicRead(value);
    case "TerminalStoreOrganizationPathRead": return isTerminalStoreOrganizationPathRead(value);
    case "TerminalStoreServicePointAreasRead": return isTerminalStoreServicePointAreasRead(value);
    case "TerminalStoreServicePointsRead": return isTerminalStoreServicePointsRead(value);
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
