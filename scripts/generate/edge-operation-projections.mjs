const r24RetiredOperationId = "replaceOperationsOrganizationHeadCompanyBrandAuthorizations";
const r24RetiredComponentNames = [
  "HeadCompanyBrandAuthorizationRequest",
  "HeadCompanyBrandAuthorizationResult",
];
const r24AddOperation = {
  operationId: "addOperationsOrganizationHeadCompanyBrandAuthorization",
  method: "POST",
  path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations",
  requestSchema: "HeadCompanyBrandAuthorizationAddRequest",
  responseSchema: "NoContent",
  successStatus: "204",
  expectedVersion: "FORBIDDEN",
  focusedTestId: "edge.addOperationsOrganizationHeadCompanyBrandAuthorization",
};
const r24RemoveOperation = {
  operationId: "removeOperationsOrganizationHeadCompanyBrandAuthorization",
  method: "DELETE",
  path: "/api/operations/group-workspaces/{groupWorkspaceKey}/organization/head-companies/{headCompanyId}/brand-authorizations/{brandId}",
  requestSchema: "NoBody",
  responseSchema: "NoContent",
  successStatus: "204",
  expectedVersion: "FORBIDDEN",
  focusedTestId: "edge.removeOperationsOrganizationHeadCompanyBrandAuthorization",
};
const p3CAuthorizationOperationIds = new Set([
  "getOperationsWorkspaceInvitations",
  "getOperationsWorkspaceInvitationCandidates",
  "getOperationsWorkspaceUser",
  "getOperationsWorkspaceUserAccount",
]);
const p3CNonNarrowingScopeOperationIds = new Set(["getOperationsWorkspaceUserAccount"]);
const p3CUserManagementTargets = [
  {key: "GROUP", slug: "group", suffix: "Group", pageKey: "PG-IAM-GROUP-USERS"},
  {key: "REGION", slug: "region", suffix: "Region", pageKey: "PG-IAM-REGION-USERS"},
  {key: "PROJECT", slug: "project", suffix: "Project", pageKey: "PG-IAM-PROJECT-USERS"},
  {key: "HEAD_COMPANY", slug: "head-company", suffix: "HeadCompany", pageKey: "PG-IAM-HEAD-COMPANY-USERS"},
  {key: "STORE", slug: "store", suffix: "Store", pageKey: "PG-IAM-STORE-USERS"},
];
const p3CUserManagementOperationDescriptors = new Map([
  ["getOperationsWorkspaceInvitations", {root: "getOperationsWorkspace", tail: "Invitations", pathSuffix: "/invitations"}],
  ["createOperationsWorkspaceInvitation", {root: "createOperationsWorkspace", tail: "Invitation", pathSuffix: "/invitations"}],
  ["getOperationsWorkspaceInvitationCandidates", {root: "getOperationsWorkspace", tail: "InvitationCandidates", pathSuffix: "/invitations/candidates"}],
  ["cancelOperationsWorkspaceInvitation", {root: "cancelOperationsWorkspace", tail: "Invitation", pathSuffix: "/invitations/{invitationId}/cancel"}],
  ["reissueOperationsWorkspaceInvitation", {root: "reissueOperationsWorkspace", tail: "Invitation", pathSuffix: "/invitations/{invitationId}/reissue"}],
  ["getOperationsWorkspaceUser", {root: "getOperationsWorkspace", tail: "User", pathSuffix: "/user"}],
  ["getOperationsWorkspaceUserAccount", {root: "getOperationsWorkspace", tail: "UserAccount", pathSuffix: "/user/accounts/{accountId}"}],
  ["revokeOperationsWorkspaceUserAssignment", {root: "revokeOperationsWorkspace", tail: "UserAssignment", pathSuffix: "/user/assignments/{assignmentId}/revoke"}],
]);
const p3CUserManagementPathPrefix = "/api/operations/group-workspaces/{groupWorkspaceKey}/user-management";
const materializedProjectionStatus = "MATERIALIZED";
const materializedProjectionPipeline = "R24_P3C";

function replacement(base, value) {
  return {
    ...base,
    ...value,
    pathParameters: value.operationId === r24RemoveOperation.operationId
      ? [...base.pathParameters, "brandId"]
      : [...base.pathParameters],
  };
}

function replace(entries, retiredOperationId, values) {
  return entries.flatMap((entry) => entry.operationId === retiredOperationId ? values : [entry]);
}

function projectR24(catalog, report) {
  const legacy = catalog.operations.find((operation) => operation.operationId === r24RetiredOperationId);
  if (!legacy) return {catalog, report};
  const values = [replacement(legacy, r24AddOperation), replacement(legacy, r24RemoveOperation)];
  const operationErrorAugmentations = {...(catalog.operationErrorAugmentations || {})};
  delete operationErrorAugmentations[r24RetiredOperationId];
  // D6: the owner never emits ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_REQUIRED.
  // Keep only the reachable remove conflict; do not project an impossible branch into the edge contract.
  operationErrorAugmentations[r24AddOperation.operationId] = [];
  operationErrorAugmentations[r24RemoveOperation.operationId] = ["ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE"];
  const operationErrorSelectionRules = {...(catalog.operationErrorSelectionRules || {})};
  delete operationErrorSelectionRules[r24RetiredOperationId];
  const componentFieldBaseline = {...catalog.componentFieldBaseline};
  for (const name of r24RetiredComponentNames) delete componentFieldBaseline[name];
  const projectedCatalog = {
    ...catalog,
    denominator: { ...catalog.denominator, operations: catalog.denominator.operations + 1, faces: {...catalog.denominator.faces, "operations-admin": catalog.denominator.faces["operations-admin"] + 1}},
    operations: replace(catalog.operations, r24RetiredOperationId, values),
    componentFieldBaseline,
    operationErrorAugmentations,
    operationErrorSelectionRules,
  };
  if (!report) return {catalog: projectedCatalog, report};
  const legacyReport = report.operations.find((operation) => operation.operationId === r24RetiredOperationId);
  if (!legacyReport) {
    if (report.operations.some((operation) => operation.operationId === r24AddOperation.operationId)
      && report.operations.some((operation) => operation.operationId === r24RemoveOperation.operationId)) {
      return {catalog: projectedCatalog, report};
    }
    throw new Error("R24_LEGACY_CATALOG_REPORT_DRIFT");
  }
  return {
    catalog: projectedCatalog,
    report: {
      ...report,
      closure: {...report.closure, operations: report.closure.operations + 1, faceCounts: {...report.closure.faceCounts, "operations-admin": report.closure.faceCounts["operations-admin"] + 1}},
      operations: replace(report.operations, r24RetiredOperationId, values.map((value) => replacement(legacyReport, value))),
    },
  };
}

function projectP3C(catalog, report) {
  const componentOverrides = {...catalog.componentOverrides};
  const addRemovals = (name, removeProperties) => {
    componentOverrides[name] = {
      ...(componentOverrides[name] || {}),
      removeProperties: [...new Set([...(componentOverrides[name]?.removeProperties || []), ...removeProperties])],
    };
  };
  addRemovals("WorkspaceOperationsInvitationCreateRequest", ["pageDesignKey", "targetOrganizationType", "targetOrganizationPath"]);
  addRemovals("WorkspaceOperationsInvitationActionRequest", ["pageDesignKey"]);
  const narrowed = {
    ...catalog,
    componentOverrides,
    operations: catalog.operations.map((operation) => !p3CAuthorizationOperationIds.has(operation.operationId) ? operation : {
      ...operation,
      queryParameters: (operation.queryParameters || []).filter((parameter) => parameter.name !== "pageDesignKey" && !(p3CNonNarrowingScopeOperationIds.has(operation.operationId) && parameter.name === "scopeRef")),
    }),
  };
  const expand = (entries) => entries.flatMap((entry) => {
    const descriptor = p3CUserManagementOperationDescriptors.get(entry.operationId);
    if (!descriptor) return [entry];
    return p3CUserManagementTargets.map((target) => ({...entry, operationId: `${descriptor.root}${target.suffix}${descriptor.tail}`, path: `${p3CUserManagementPathPrefix}/${target.slug}${descriptor.pathSuffix}`, pageKey: target.pageKey, focusedTestId: entry.focusedTestId ? `${entry.focusedTestId}.${target.slug}` : undefined}));
  });
  const operations = expand(narrowed.operations);
  const added = operations.length - narrowed.operations.length;
  if (added !== 32) throw new Error("P3_C_STATIC_TARGET_EXPANSION_DRIFT");
  const projectedCatalog = {...narrowed, denominator: {...narrowed.denominator, operations: narrowed.denominator.operations + added, faces: {...narrowed.denominator.faces, "operations-admin": narrowed.denominator.faces["operations-admin"] + added}}, operations};
  if (!report) return {catalog: projectedCatalog, report};
  const reportHasTemplates = report.operations.some((entry) => p3CUserManagementOperationDescriptors.has(entry.operationId));
  if (!reportHasTemplates) return {catalog: projectedCatalog, report};
  const reportOperations = expand(report.operations);
  if (reportOperations.length - report.operations.length !== added) throw new Error("P3_C_STATIC_TARGET_EXPANSION_REPORT_DRIFT");
  return {catalog: projectedCatalog, report: {...report, closure: {...report.closure, operations: report.closure.operations + added, faceCounts: {...report.closure.faceCounts, "operations-admin": report.closure.faceCounts["operations-admin"] + added}}, operations: reportOperations}};
}

function assertMaterializedCatalog(catalog, report) {
  const state = catalog?.projectionState;
  if (state?.status !== materializedProjectionStatus || state.pipeline !== materializedProjectionPipeline) {
    throw new Error("R5_EDGE_MATERIALIZED_PROJECTION_STATE_INVALID");
  }
  const operations = catalog.operations;
  const operationCount = state.operationCount;
  if (!Number.isInteger(operationCount) || operationCount !== catalog.denominator?.operations
    || !Array.isArray(operations) || operations.length !== operationCount) {
    throw new Error("R5_EDGE_MATERIALIZED_OPERATION_DENOMINATOR_INVALID");
  }
  const ids = new Set(operations.map((operation) => operation?.operationId));
  if (ids.size !== operations.length || operations.some((operation) => !operation?.operationId || operation.operationId === r24RetiredOperationId || p3CUserManagementOperationDescriptors.has(operation.operationId))) {
    throw new Error("R5_EDGE_MATERIALIZED_OPERATION_IDENTITY_INVALID");
  }
  const faceCounts = Object.fromEntries(["platform-admin", "operations-admin", "public"].map((face) => [face, operations.filter((operation) => operation.face === face).length]));
  if (JSON.stringify(faceCounts) !== JSON.stringify(state.faceCounts)) throw new Error("R5_EDGE_MATERIALIZED_FACE_DENOMINATOR_INVALID");
  if (report !== undefined) {
    if (!report || report.closure?.operations !== operationCount || JSON.stringify(report.closure?.faceCounts) !== JSON.stringify(faceCounts)) {
      throw new Error("R5_EDGE_MATERIALIZED_REPORT_INVALID");
    }
  }
  return {catalog, report};
}

/** The only projection consumed by both root OpenAPI materialization and generated clients. */
export function projectEdgeCatalog(catalog, report = undefined) {
  if (catalog?.projectionState?.status === materializedProjectionStatus) return assertMaterializedCatalog(catalog, report);
  const r24 = projectR24(catalog, report);
  return projectP3C(r24.catalog, r24.report);
}
