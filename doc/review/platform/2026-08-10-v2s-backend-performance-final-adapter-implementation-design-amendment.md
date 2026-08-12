# Final adapter static implementation — necessary design amendment

`implementationAuthority: true`  
`runtimeAuthority: false`

## Pointwise source reconciliation

The approved design has 16 surfaces. Before writing code, pointwise source reopening found five
existing surfaces required to make its frozen promises executable:

1. `scripts/dev/http-diagnostic-runner.test.mjs` proves RM1 and final profiles remain isolated;
2. `scripts/test/r5-remote-testcontainers.mjs` must emit the parent/task/runtime binding required
   by the approved nested-child contract;
3. `scripts/test/r5-remote-testcontainers.test.mjs` is its focused red proof;
4. `HttpDiagnosticBootstrapConfiguration.java` is the only non-SQL first-platform-admin bootstrap
   available to an empty isolated namespace; and
5. `HttpDiagnosticBootstrapConfigurationTest.java` proves the final profile/run-id allowlist does
   not weaken the existing bootstrap safeguards.

No new runtime topology, fixture denominator, protocol, owner command, dynamic authority or
measurement-success claim is introduced. The total static implementation surface is therefore
21 (= approved 16 + these 5), while the workload remains exactly 396.

## Bounded rules

- The Testcontainers runner is invoked only as adapter-owned technical proof with a fixed task and
  final-parent binding. It never becomes an HTTP runner, fixture producer, snapshot source or L2.
- Bootstrap only adds the final non-production profile/run-id pair; it retains one-time bootstrap,
  non-production and secret-clearing behavior.
- Static package exit uses trim observation. The adapter records its CLI stdout/log digest solely
  for provenance and independently derives eligibility from the static exit plus approved surface;
  it must never claim receipt or after-hash set equality.

## Static-test reachability remediation

`classification: CONFIRMED_AND_REMEDIATED`

An earlier source-level test supplied a synthetically valid final authority to
`executeManagedFinalAcceptance`. That made its production adapter reach the nested technical
runner and persist a failed manifest before the runner rejected a missing local Gradle
distribution. No backend/tunnel/remote child process was started, but the reachability was still
wrong for a static package. The preserved manifest is failure evidence only, not dynamic evidence.

The focused test now supplies `resetAuthority=true` and proves rejection at the public authority
boundary before adapter import or lifecycle invocation. The prevention rule is finite: static tests
may exercise phases only through local mocks below their real side-effect boundary; they must never
supply the exact dynamic authority tuple. Production entry remains the separately activated dynamic
package and has no callback input.

## Fixture assembler feasibility correction — source-bound facts missing

`classification: CONFIRMED`  
`implementationDisposition: BLOCKED_PENDING_DESIGN_AMENDMENT`

The current 396-row catalog proves the route denominator but cannot yet create a real owner-HTTP fixture state. The existing `createFinalFixtureState` is therefore only a closed verifier: it intentionally refuses to infer a route parameter, session, body or readback from a generic label. It must not be promoted to `prepareFinalFixtureState({baseUrl, runId, secret})` until the facts below are declared and independently reviewed.

### Finite evidence

| item | measured result | implication |
| --- | --- | --- |
| catalog rows | 396 | fixed workload denominator remains correct |
| unique route operations | 196 | all workload routes remain present |
| command rows / distinct command operations | 230 / 113 | the current boolean incorrectly marks all commands as JSON-body; the final plan distinguishes 216 JSON-body rows, 12 no-body rows and 2 multipart rows |
| required-query operation IDs / projected rows | 46 / 92 | the current catalog carries no query binding plan, so path/body completion alone remains non-executable |
| parameterized rows / occurrences | 330 / 462 | paths need source-bound state extraction rather than `fixture` defaults |
| initially observed literal source coverage | 43 of 113 command operations | superseded by the full family-loop scan below; retained only as audit history |
| actual reusable-flow / new-builder split | 103 / 10 of 113 | no implementation may invent bodies, predecessor states or readbacks; all 113 still require a final-only plan |

The catalog contains zero rows with `requestBody`, `bodyTemplate`, `expectedStatus`, `readbackOperation`, `readbackSelector`, `sessionBootstrap`, `ownerHttpPlan`, `preparationFacts`, `fixtureValues` or `queryBindings`. All 230 non-GET rows currently set only the boolean `requestBodyRequired=true`, including the 12 row instances of six contract no-body operations (`acceptPublicInvitation`, `completePublicInvitation`, `operationsWorkspaceLogout`, `platformLogout`, `releasePlatformStagedAsset`, `removeOperationsOrganizationHeadCompanyBrandAuthorization`) and the two `stageOperationsCatalogAsset` multipart instances. That boolean is therefore neither a typed body plan nor an accurate body applicability discriminator. Its three current `preparationProcedure` values (`preparePlatformOwnerHttp`, `prepareOperationsOwnerHttp`, `preparePublicOwnerHttp`) only label a face; they are not procedures with typed inputs, ordered owner calls or extraction rules.

### Superseding reusable-flow source map

The literal-only 43/70 table below is retained as an audit trail of the first incomplete scan, but
**is not the implementation denominator**. Reopening the generated registry plus the dynamic
family loops found 103 reusable typed owner-HTTP algorithms for the 113 command operations
(210 of the 230 command rows); 10 operation IDs / 20 command rows require new final-only typed
builders. None of the 103 algorithms may import a historical runtime, root, credential or seed
profile.

| source pattern | command operations covered | permitted reuse |
| --- | ---: | --- |
| `scripts/test/http-diagnostic-workload.mjs` | 83 | Copy only typed request/predecessor/readback algorithms into a final-only builder. Its five invitation and assignment loops are part of the count. |
| `scripts/dev/owner-command-seed-executor.mjs` | 3 additional | Copy only platform invitation create/cancel/reissue algorithms. |
| `scripts/dev/catalog-inventory-seed-executor.mjs` | 6 additional | Copy only catalog create/save/stage algorithms. |
| `scripts/test/catalog-inventory-api.mjs` | 11 additional | Copy only typed inventory/copy/release/status algorithms. |

The exact new-builder denominator is:

`deleteOperationsCatalogCategory`, `moveOperationsCatalogCategory`,
`updateOperationsCatalogCategory`, `executeOperationsTemporaryCatalogItemPromotion`,
`preflightOperationsTemporaryCatalogItemPromotion`,
`reorderOperationsCatalogDictionaryEntry`,
`transitionOperationsCatalogDictionaryEntryStatus`,
`updateOperationsCatalogDictionaryEntry`, `updateOperationsProductionTag`, and
`updateOperationsCommercialGroup`.

Those ten operations have OpenAPI/controller/UI request-shape inputs but no existing fixture
algorithm. UI bytes are design inputs only; they are not an executable fixture source.

### Existing-source coverage (reusable pattern evidence only)

These mappings identify source patterns that may be reread during a future design amendment. They are **not** authorization to reuse the R5 runtime/root, seed profile or opaque fixture bytes.

| operationId | existing source pattern(s) |
| --- | --- |
| `acceptPublicInvitation` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `addOperationsOrganizationHeadCompanyBrandAuthorization` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `cancelWorkspaceInvitation` | `scripts/dev/owner-command-seed-executor.mjs` |
| `completePublicInvitation` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `createOperationsCatalogCategory` | `scripts/dev/catalog-inventory-seed-executor.mjs` |
| `createOperationsCatalogDictionaryEntry` | `scripts/dev/catalog-inventory-seed-executor.mjs` |
| `createOperationsCatalogItem` | `scripts/dev/catalog-inventory-seed-executor.mjs` |
| `createOperationsContract` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `createOperationsOrganizationBrand` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `createOperationsOrganizationHeadCompany` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `createOperationsOrganizationProject` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `createOperationsOrganizationRegion` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `createOperationsOrganizationStore` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `createOperationsOrganizationTenant` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `createOperationsProductionTag` | `scripts/dev/catalog-inventory-seed-executor.mjs` |
| `createPlatformAdmin` | `scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `createPlatformGroupWorkspace` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `createWorkspaceInvitation` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `createWorkspaceRole` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `initializeCommercialGroup` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `invalidateOperationsContract` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `operationsWorkspacePasswordLogin` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs`<br>`scripts/dev/catalog-inventory-seed-executor.mjs` |
| `platformPasswordLogin` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `reissueWorkspaceInvitation` | `scripts/dev/owner-command-seed-executor.mjs` |
| `replaceExtensionDefinition` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `requestWorkspaceCredentialReset` | `scripts/dev/owner-command-seed-executor.mjs` |
| `revokePlatformWorkspaceAssignment` | `scripts/dev/owner-command-seed-executor.mjs` |
| `saveOperationsCatalogItem` | `scripts/dev/catalog-inventory-seed-executor.mjs` |
| `savePublicInvitationCredentials` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `selectOperationsWorkspaceSessionDataNode` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs`<br>`scripts/dev/catalog-inventory-seed-executor.mjs` |
| `sendPublicInvitationOtp` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `stageOperationsCatalogAsset` | `scripts/dev/catalog-inventory-seed-executor.mjs` |
| `stagePlatformAsset` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `transitionOperationsOrganizationBrandStatus` | `scripts/dev/owner-command-seed-executor.mjs` |
| `transitionOperationsOrganizationHeadCompanyStatus` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `transitionOperationsOrganizationNodeStatus` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |
| `transitionOperationsOrganizationStoreStatus` | `scripts/dev/owner-command-seed-executor.mjs` |
| `transitionOperationsOrganizationTenantStatus` | `scripts/dev/owner-command-seed-executor.mjs` |
| `transitionPlatformAdminStatus` | `scripts/dev/owner-command-seed-executor.mjs` |
| `transitionPlatformGroupWorkspaceStatus` | `scripts/dev/owner-command-seed-executor.mjs` |
| `transitionWorkspaceAccountStatus` | `scripts/dev/owner-command-seed-executor.mjs` |
| `updatePlatformGroupWorkspaceDisplay` | `scripts/dev/owner-command-seed-executor.mjs` |
| `verifyPublicInvitationOtp` | `scripts/test/r5-joint-remote-l2-fixture.mjs`<br>`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`<br>`scripts/dev/owner-command-seed-executor.mjs` |

### Initial literal-only source denominator (70; superseded)

`adjustOperationsInventoryTarget`, `cancelOperationsWorkspaceGroupInvitation`, `cancelOperationsWorkspaceHeadCompanyInvitation`, `cancelOperationsWorkspaceProjectInvitation`, `cancelOperationsWorkspaceRegionInvitation`, `cancelOperationsWorkspaceStoreInvitation`, `changeCurrentPlatformPassword`, `changeCurrentWorkspacePassword`, `completeOperationsPasswordRecovery`, `completePlatformPasswordRecovery`, `countOperationsInventoryTarget`, `createOperationsWorkspaceGroupInvitation`, `createOperationsWorkspaceHeadCompanyInvitation`, `createOperationsWorkspaceProjectInvitation`, `createOperationsWorkspaceRegionInvitation`, `createOperationsWorkspaceStoreInvitation`, `deleteOperationsCatalogCategory`, `executeOperationsBrandCatalogCopy`, `executeOperationsLocalCatalogCopy`, `executeOperationsTemporaryCatalogItemPromotion`, `increaseOperationsInventoryTarget`, `moveOperationsCatalogCategory`, `operationsWorkspaceLogout`, `platformLogout`, `preflightOperationsBrandCatalogCopy`, `preflightOperationsLocalCatalogCopy`, `preflightOperationsTemporaryCatalogItemPromotion`, `reissueOperationsWorkspaceGroupInvitation`, `reissueOperationsWorkspaceHeadCompanyInvitation`, `reissueOperationsWorkspaceProjectInvitation`, `reissueOperationsWorkspaceRegionInvitation`, `reissueOperationsWorkspaceStoreInvitation`, `releaseOperationsCatalogStagedAsset`, `releasePlatformStagedAsset`, `removeOperationsOrganizationHeadCompanyBrandAuthorization`, `reorderOperationsCatalogDictionaryEntry`, `resetPlatformAdminCredential`, `revokeOperationsWorkspaceGroupUserAssignment`, `revokeOperationsWorkspaceHeadCompanyUserAssignment`, `revokeOperationsWorkspaceProjectUserAssignment`, `revokeOperationsWorkspaceRegionUserAssignment`, `revokeOperationsWorkspaceStoreUserAssignment`, `selectOperationsWorkspaceSessionContext`, `sendOperationsPasswordRecoveryOtp`, `sendOperationsWorkspaceOtp`, `sendPlatformLoginOtp`, `sendPlatformPasswordRecoveryOtp`, `startOperationsPasswordRecovery`, `startPlatformPasswordRecovery`, `transitionOperationsCatalogDictionaryEntryStatus`, `transitionOperationsCatalogItemStatus`, `transitionOperationsProductionTagStatus`, `transitionWorkspaceRoleStatus`, `updateOperationsCatalogCategory`, `updateOperationsCatalogDictionaryEntry`, `updateOperationsCommercialGroup`, `updateOperationsContract`, `updateOperationsInventoryTargetConfiguration`, `updateOperationsOrganizationBrand`, `updateOperationsOrganizationHeadCompany`, `updateOperationsOrganizationNode`, `updateOperationsOrganizationStore`, `updateOperationsOrganizationTenant`, `updateOperationsProductionTag`, `updatePlatformAdminProfile`, `updateWorkspaceRole`, `verifyOperationsPasswordRecoveryOtp`, `verifyOperationsWorkspaceOtp`, `verifyPlatformLoginOtp`, `verifyPlatformPasswordRecoveryOtp`

### Minimum design amendment, no hidden callback

For each of the 396 catalog rows, add a source-bound `fixturePlan` whose closed fields are:

1. `preparationProcedureId` and ordered predecessor identifiers, with a real source anchor/hash for each owner HTTP call;
2. `sessionPlan` (the exact bootstrap/login/context-selection owner flow and the private session result consumed by the row);
3. a typed `pathBindings` map for every one of the 462 parameter occurrences, where each value names its producing owner-readback field;
4. for each of the 216 JSON-body rows and two multipart rows, a typed `bodyTemplate` or named request-builder procedure plus its input readbacks, expected response status and CAS/idempotency/replay rule; the twelve no-body command rows must state `NONE` explicitly;
5. `prerequisiteReadback` as an actual operation/selector/assertion rather than a string label, and an expected success/readback assertion for all 396 rows; and
6. `owner/face` plus a source-proven preparation grouping so the assembler can call only its own fixed private owner-HTTP sequence and return redacted report entries.

The resulting `prepareFinalFixtureState({baseUrl, runId, secret})` may accept only the managed adapter’s three fixed values and internally execute this closed plan. It must return `{state, prepared}` only after all named owner readbacks pass; it may not accept callbacks, arbitrary root/namespace, credentials, route literals, SQL, default identifiers or inferred request bodies.

### Closed final-only builder families

The final fixture module owns exactly the thirteen named private **command-preparation** families
below. They are not a string-dispatch API: those thirteen declarations partition the 113 command
operation IDs exactly once. All 166 GET rows use the separate `READ_PROJECTION` family, which only
performs their already-declared authenticated read preparation and never selects a command builder.
Existing source patterns are copied only as request/predecessor/readback algorithms.

| family | fixed operation class | required predecessor/readback facts |
| --- | --- | --- |
| `INVITATION_LIFECYCLE` | five target invitation create/cancel/reissue and five assignment revokes | operations session, group key, target node, role/account, fresh invitation or assignment id and revision |
| `OPERATIONS_SESSION_AUTH` | current-password, logout, context selection and workspace OTP | disposable operations principal/session, password/version/context version and OTP delivery result |
| `OPERATIONS_RECOVERY` | start/send/verify/complete password recovery | separate recovery identity, recovery transaction, OTP and verification grant |
| `PLATFORM_ACCOUNT_AUTH` | current-password, logout, credential reset, profile and login OTP | platform session, disposable target-admin id/revision, credential and OTP flow result |
| `PLATFORM_RECOVERY` | start/send/verify/complete platform recovery | separate platform recovery identity, transaction, OTP and verification grant |
| `PLATFORM_ROLE` | role update and status | platform session, workspace key, disposable role id/revision |
| `INVENTORY_TARGET` | count/increase/adjust/configuration | store data-node session, brand/target refs and fresh target versions |
| `CATALOG_COPY_PROMOTION` | local/brand copy and temporary promotion preflight/execute | source/target node selection, catalog item CAS, and the exact preflight result consumed by execute |
| `CATALOG_MUTATION` | category/dictionary/item mutation and status | scoped operations session plus disposable category/dictionary/entry/item refs and revisions |
| `ORGANIZATION_UPDATE` | authorization removal and commercial-group/brand/head-company/node/store/tenant updates | operations session, group key, owner ref/revision and brand-authorization predecessor |
| `CONTRACT` | contract update | operations session, store/contract refs and contract revision |
| `PRODUCTION_TAG` | tag update and status | permitted head-company/store session, brand scope, tag code and version |
| `ASSET_RELEASE` | catalog/platform asset release | separately staged disposable asset, asset ref/bind grant and the correct owner session |

The ten new-builder operation IDs belong only to `CATALOG_MUTATION`,
`CATALOG_COPY_PROMOTION`, `PRODUCTION_TAG` and `ORGANIZATION_UPDATE`. Each needs a named typed
request-builder function and a family-positive plus missing-predecessor red proof; no generic
`operationId -> body` map is permitted.

The prose table is not the implementation oracle. The authoritative literal partition is
`contracts/policy/backend-performance-final-fixture-catalog.json@f3afba7d7c8c8c626f8a4d5d6fdc6a3d8d11ecc56a4784dd98e05efb9e151f1a`:
it declares fourteen plan families (the thirteen command families plus `READ_PROJECTION`), fourteen
preparation procedures, 113 exact command builder declarations, 113 algorithm declarations, 396
readback declarations and nine session plans. The thirteen non-read command sets contain exactly
113 unique operation IDs. Its checker recomputes the generated edge-plus-catalog route union and
OpenAPI parameter/transport requirements; the JSON is therefore a literal source-bound design
artifact, not generated runtime selection data.

The catalog additionally owns 196 exact owner-HTTP operation declarations and fourteen ordered
predecessor sequences. Each declaration names the operation, method, route template, transport,
success status, OpenAPI source path/hash/selector and produced readback keys. Family, procedure,
session, builder and every row-level readback are finite references to those declarations. The
checker reopens both OpenAPI roots and rejects an undeclared sequence, missing owner selector or
status/transport/route mismatch. This prevents a `PREDECESSOR_<family>` naming convention from
standing in for an executable owner-readback contract.

Dynamic execution is separately non-injectable: the runtime runner internally derives and brands
the dynamic admission after reading the active dynamic package and static proof. Exported calls
reject forged authority-shaped objects before importing the adapter or entering a resource phase;
the adapter accepts only that branded admission. Static implementation remains unable to execute
the managed lifecycle.

### Literal row-plan schema and vocabulary

Every one of the 396 catalog rows must carry the literal `fixturePlan` object below. `familyId`
is `READ_PROJECTION` for GET rows or one of the thirteen fixed command-preparation declarations
below; it is a closed selection
of a private typed routine, not an `operationId` dispatch mechanism. `pathBindings[]` is one
record per route placeholder and names its typed producer-readback field; `queryBindings[]` does
the same for every OpenAPI-required query parameter. Neither is a free-form value map. A literal
row plan has the following non-inferable structure:

```text
fixturePlan: {
  familyId,
  preparationProcedureId,
  sessionPlanId,
  predecessorPlanId,
  pathBindings: [{name, stateKey, producerReadbackKey}],
  queryBindings: [{name, stateKey, producerReadbackKey}],
  request: {
    transport: "NONE" | "JSON" | "MULTIPART_FORM",
    builderId: null | "<closed typed builder>",
    idempotency: "NONE" | "HEADER_REQUIRED" | "HEADER_AND_BODY"
  },
  expected: {
    successStatus: 200 | 201 | 204,
    assertionKey: "assert.<area>.<fixtureId>",
    selector: "<owner readback selector>"
  },
  casClass: "NO_BODY" | "MULTIPART_FORM" | "IDEMPOTENCY_HEADER_ONLY" |
    "IDEMPOTENCY_BODY_AND_HEADER" | "VERSION_CAS" | "CONTEXT_CAS" |
    "SESSION_VERSION_CAS" | "PREFLIGHT_DIGEST_CAS",
  replayPolicyId,
  sourceAlgorithmId
}
```

The duplicate short-form field list above exists only to make the schema boundary readable; the
object form is authoritative. Every declared ID has an exact catalog declaration naming its
allowed operation/fixture set, input readbacks, implementation source anchor and source hash.
The accepted closed vocabularies are:

- `sessionPlanId`: `PLATFORM_ADMIN`, `PLATFORM_DISPOSABLE`, `OPERATIONS_SCOPE`,
  `OPERATIONS_DISPOSABLE`, `CATALOG_STORE`, `CATALOG_HC`, `PUBLIC_RECOVERY`,
  `PUBLIC_PLATFORM_RECOVERY`, `PUBLIC_ANONYMOUS`.
- `expectedStatusId`: `SUCCESS_200`, `SUCCESS_201`, `SUCCESS_204`; the literal row selects only
  a status declared by its OpenAPI operation.
- `request.transport`: `JSON`, `NONE`, `MULTIPART_FORM`; exact command-row totals are 216, 12
  and 2. Together with the 166 GET rows (83 operations), this exhausts the 396-row catalog.
- `concurrencyPolicyId`: `NONE`, `CAS_EXPECTED_VERSION`, `CAS_CONTEXT_VERSION`,
  `PREFLIGHT_TOKEN_CONSUMED`, `STAGED_ASSET_ONE_TIME`.
- `replayPolicyId`: `READ_ONLY`, `IDEMPOTENT_SAME_KEY`, `OTP_GRANT_ONE_TIME`,
  `SAME_KEY_ONLY`.

`request.builderId=null` is legal only for all 166 GET rows and the following exact twelve
no-body command fixture IDs:

```text
PERF-WORKSPACE-COMMAND-V1:operationsWorkspaceLogout:NORMAL_SUCCESS:NORMAL_SUCCESS
PERF-WORKSPACE-COMMAND-V1:removeOperationsOrganizationHeadCompanyBrandAuthorization:NORMAL_SUCCESS:NORMAL_SUCCESS
BP-U04-PARITY:acceptPublicInvitation
BP-U04-PARITY:completePublicInvitation
BP-U04-PARITY:platformLogout
BP-U04-PARITY:releasePlatformStagedAsset
BP-U07-ROUTE:acceptPublicInvitation
BP-U07-ROUTE:completePublicInvitation
BP-U07-ROUTE:operationsWorkspaceLogout
BP-U07-ROUTE:platformLogout
BP-U07-ROUTE:releasePlatformStagedAsset
BP-U07-ROUTE:removeOperationsOrganizationHeadCompanyBrandAuthorization
```

The 216 JSON command rows and two multipart command rows need a named typed builder; their
`sourceAlgorithmId` is one of the declared `REUSE_*` algorithms or the exact ten
`NEW_*` builder algorithms enumerated above. A catalog checker must reject an undeclared
identifier, a missing path or required-query binding, `builderId=null` outside the exact set above,
a new-builder mismatch, an operation whose plan has no matching family, or a source algorithm
hash drift. Focused red proof includes
one missing predecessor/readback for every family and at least one wrong body/status/CAS/replay
member for each non-read-only policy class.

### Why no smaller safe implementation exists

A body-less/placeholder assembler would produce invalid HTTP requests for 216 JSON rows, omit the required multipart mechanics for two rows, falsely attach bodies to twelve no-body rows and omit 92 query-bound rows. Even with the corrected 103 reusable-flow patterns, every final request still needs its own final-only plan and the remaining ten command operations need new typed builders; importing any historical runtime/root would violate the final adapter’s explicit RM1/R5 isolation. Treating `secret` as an authentication/session substitute would conflate evidence integrity with user authentication. Therefore this is an implementation-facing design omission, not a mechanical code completion; it requires a bounded DESIGN amendment and the required independent/Claude review before implementation resumes.

## POST_REMEDIATION_V2 — executable owner-HTTP fixture DAG correction

### Confirmed omission and bounded scope

The literal catalog is a valid *structural* plan, but it is not yet an executable fixture-assembler contract. Every measured request must obtain its authenticated session, path/query values, body fields, CAS/idempotency values, and postcondition from a named owner HTTP predecessor. The prior declarations only labelled those facts.

This correction changes neither the 396-row denominator nor any route, owner, SQL cap, runtime topology, seed/reset authority, or dynamic-status claim. It extends only already-admitted final fixture catalog, checker, materializer, workload, adapter, and focused-test surfaces. Dynamic execution remains forbidden until static implementation proof and a fresh implementation review both close.

### Exact executable denominators

| fact | exact denominator |
| --- | ---: |
| fixture rows | 396 = 166 GET + 230 command |
| command operations | 113 = 106 JSON + 6 no-body + 1 multipart |
| command-row transports | 216 JSON + 12 NONE + 2 MULTIPART_FORM |
| path bindings | 462 occurrences |
| required-query rows / occurrences | 92 / 130 |
| JSON/multipart schema contracts | 87 / 1 |
| private command builders | 113, one exact operation each |
| session plan variants | 9 |
| command family partitions | 13 plus READ_PROJECTION |

No row may use a default identifier, inferred body, generic operation-id dispatcher, caller callback, or persisted credential/cookie/grant. A private state entry is valid only if a preceding finite `NodeSpec` declares its owner HTTP operation, OpenAPI source hash/selector, request bindings, response extractor, type predicate, and its consuming node/row.

### Private bootstrap and session contract

`V2S_BACKEND_PERFORMANCE_FINAL_SECRET` authenticates measurement headers only; it is never a login credential, cookie, OTP, grant, or fixture identifier. The adapter receives an opaque, one-time `FinalFixtureCredentialCapability` only from the managed local-runtime start result. It contains the run-generated bootstrap login and credential in a closure/WeakMap, is neither serializable nor loggable nor returned from the fixture module, and is zeroized after fixture preparation and again during cleanup. The existing `private.env` file remains only a backend launch input; the final fixture API must not read it.

The private DAG starts exactly as follows:

1. the non-production final profile bootstrap creates the first platform administrator through `PlatformDiagnosticBootstrap`;
2. `POST /api/platform/auth/password-login` receives the opaque bootstrap login/credential and yields `V2S_PLATFORM_SESSION` from `Set-Cookie`;
3. the parser retains only the cookie `name=value` pair in private memory; `GET /api/platform/auth/session` extracts the platform session/version;
4. platform owner commands create workspace, commercial group, roles, invitations, disposable accounts and their readbacks;
5. public invitation/OTP/credential completion yields a generated operations credential; it is never emitted to a report;
6. operations password login yields `V2S_OPERATIONS_SESSION`; session-entry readback supplies current context version and candidate facts;
7. every context or data-node selection consumes the current version and replaces it only with the owner-returned next version. GROUP/PROJECT, STORE, and HEAD_COMPANY sessions are separate private capabilities;
8. recovery cookies/grants remain separate private buckets and cannot be used as ordinary sessions.

Controlling anchors are `scripts/dev/managed-isolated-local-runtime.mjs#startFinalManagedLocalRuntime`, `HttpDiagnosticBootstrapConfiguration#ownerBootstrap`, platform and operations authentication/session OpenAPI operations, and typed owner-HTTP algorithms in `scripts/test/http-diagnostic-workload.mjs`. Final code may copy their typed algorithms but must not import their runtime/root/credential state.

### Literal executable declarations

Each row owns a `RowPlan`:

```text
{ rowKey, pathBindings[], queryBindings[], headers[], request,
  predecessorNodeId, expected:{httpStatus,responseAssertion,postconditionNodeId?} }
```

Every `NodeSpec` has a finite id, declared owner operation, typed request bindings, source-hashed response schema anchor, and exact output extractors. Each output records JSON pointer, type and non-empty/enum predicate. Every binding names one producer node output. `BuilderSpec` contains the OpenAPI schema path/hash/pointer, transport, required field bindings, optional-field disposition, idempotency-header/body policy, CAS/replay source binding, and success/readback selector. The workload must materialize all 462 path and 130 query occurrences, preserve NONE, encode JSON only for JSON builders, and use `FormData` only for the single multipart operation.

The 113 private builders remain one operation per builder inside existing 13 closed family routines. Reused source algorithms cover 103 operations; final-only builders remain category delete/move/update, temporary promotion preflight/execute, dictionary reorder/transition/update, production-tag update, and commercial-group update.

### Required mechanical proofs

Checker and focused tests must reject with distinct attribution: missing platform login/cookie extractor; final secret used as login credential; a context selection that does not replace its version; a body/path/query value without a declared node output; undeclared schema pointer/hash; missing idempotency/CAS binding; JSON encoding for multipart; arbitrary or persistent cookie/credential; and generic operation dispatch. Tests use temporary roots and mocked owner HTTP responses, proving no `.runtime/backend-performance` write.

`prepareFinalFixtureState` is callable only by the branded managed adapter after local readiness. It returns a nonserializable private fixture capability plus a redacted cardinality-only report; the workload consumes the capability directly. It cannot accept raw caller-provided `path`, `sessions`, `readbacks`, or `requestBodies`.

## POST_REMEDIATION_V3 — value-authority reconciliation before assembler implementation

### Why V2 is still insufficient

V2 correctly forbids inferred fixture values, but the current catalog still represents all of
them as free-form `stateKey` / `producerReadbackKey` strings. A real counterexample rewired a
`groupWorkspaceKey` binding to a nonexistent state key and an unrelated existing readback key;
the structural catalog gate stayed green. That proves that an executable assembler cannot begin
from V2 alone.

The smallest safe repair is not a generic root node or a run-scoped default. It is a finite,
literal source-authority graph in the catalog. Every binding and every body/CAS/replay input must
refer to one declared `nodeId.outputId` or one declared source-hashed literal authority.

### Reconciled value-source closure

The current 592 route-binding consumers (462 path plus 130 required-query occurrences) are
closed into exactly these authority classes:

| authority class | consumers | rule |
| --- | ---: | --- |
| `OWNER_NODE_OUTPUT` | 520 | response/header output of an earlier declared owner-HTTP node, with OpenAPI response anchor, JSON pointer, type/predicate and dependency path |
| `OPENAPI_ENUM_LITERAL` | 54 | exact enum member from a source-hashed OpenAPI parameter/schema declaration |
| `OWNER_VALIDATED_LITERAL` | 4 | exact owner-code literal from a source-hashed finite allowlist; never an arbitrary string |
| `DERIVED_OWNER_OUTPUT` | 14 | pure named derivation from one declared owner output, with its input/output types and no fallback |

`V2S_BACKEND_PERFORMANCE_FINAL_SECRET` remains measurement-only and is not a member of this
closure. The opaque bootstrap credential capability is a mandatory private root for the platform
login node, but never a route-binding value and never serializable.

V3 supersedes the V2 three-scalar signature: only the branded adapter may call
`prepareFinalFixtureState({baseUrl, runId, measurementSecret, credentialCapability})`. The fourth
argument is the opaque, identity-branded one-time capability returned by the managed local runtime,
not a caller-provided credential or filesystem path. It is consumed before the first login, never
included in a fixture result/report/manifest, and released in the adapter's `finally` path.

The two formerly misclassified strings are fixed as `OWNER_VALIDATED_LITERAL`:

* inventory `period` is `TODAY`, anchored to
  `InventoryOwnerService#periodDurationMillis`, whose closed owner switch admits only
  `TODAY`, `7D`, and `30D`; it is not an OpenAPI enum or a clock-derived string;
* catalog navigation `viewKey` is `GOVERNANCE_PENDING`, anchored to the closed `List.of` in
  `CatalogOwnerService#navigation`; it is not derived from the same navigation response because
  that route requires `viewKey` before it returns `smartViews`.

The fourteen invitation-token consumers use the sole named `DERIVED_OWNER_OUTPUT`:
`tokenFromInvitationPageUrl`, from the corresponding declared invitation-page URL output.
No other run-scoped derivation is permitted.

The old 24 owner-output *keys* are not the V3 node denominator. They expand at row level where
their original label hid a relationship: platform and catalog staged assets are different outputs;
platform audit uses a workspace-role id plus its closed enum while operations audit uses a store id
plus its closed enum; overview category and item must be selected from the same owner response;
and invitation outputs are family-specific. `catalog.item.code` also requires an actual post-create
owner readback selection node—the request's desired code is not an owner-produced output.

### Body-field and transport authority is separate from route authority

The four route-value classes above apply only to the 592 path/query consumers. Command bodies have
their own finite field references. The command denominator is 113 operation forms: 106 JSON, one
multipart (`stageOperationsCatalogAsset`) and six no-body forms. Across fixture rows this is 216
JSON, two multipart and twelve no-body requests; the 218 body-bearing rows all require their
declared `Idempotency-Key` handling. `stagePlatformAsset` is JSON/201 despite its schema name;
media type comes from its exact operation declaration, never from a schema name.

Each body-field source is one of a reachable owner output, an OpenAPI enum literal, an
owner-validated literal, a declared `DERIVED_OWNER_OUTPUT`, or a declared
`RUN_SCOPED_PRIVATE_VALUE` for generated credentials/codes/idempotency/nonsecret fixture data.
The latter is allowed only inside a private builder declaration with a source-hashed generation
algorithm and exact consumer fields; it is prohibited for route path/query inputs and cannot be
serialized into a report/manifest. Nested arrays, extension values, CAS/version, grant/preflight
digest and postcondition selectors use the same field-level reference form.

The 87 JSON plus one multipart schema contracts do not authorize schema-level generic dispatch.
There remain 113 operation-specific private builders, and repeated operation fixtures name their
row variant explicitly (including the six `saveOperationsCatalogItem` variants).

The source partitions are a review inventory, not an execution switch: ASSET 4, CATALOG_COPY 6,
CATALOG_MUTATION 11, CONTRACT 3, INVENTORY 4, INVITATION 29, OPERATIONS_RECOVERY 4,
OPERATIONS_SESSION 7, ORGANIZATION 24, PLATFORM_ACCOUNT 11, PLATFORM_RECOVERY 4, PLATFORM_ROLE
3, PRODUCTION_TAG 3, plus READ_PROJECTION. They exact-partition the 113 command operations.
Every command row must materialize the operation's required `Idempotency-Key`; its
`x-expected-version-policy` source declaration determines the explicit version/context/preflight
field references. A success status alone is not a postcondition: the response assertion must name
the exact output/predicate produced by the owner response.

### Literal graph and execution rules

The catalog must add finite `executionNodes` and `outputDeclarations`. Each node declares its
owner HTTP operation, request bindings, OpenAPI request/response anchors, explicit
`dependsOn`, session input/output handle, and response/header extraction. Each output declares
its JSON pointer or cookie selector, type, non-empty/enum predicate and consumers. A binding is
only one of `{nodeId, outputId}`, `{literalDeclarationId}`, or a named
`DERIVED_OWNER_OUTPUT` with an explicit input output reference.

The literal schema is closed as follows:

```text
executionDag = { nodeDeclarations, outputDeclarations, literalDeclarations, derivationDeclarations }
NodeSpec     = { id, kind: OWNER_HTTP|BOOTSTRAP_CAPABILITY, dependsOnNodeIds,
                 ownerHttpOperationId?, sourceAnchor, requestBindings, outputIds }
OutputSpec   = { id, producerNodeId, responseSelector: JSON_POINTER|SET_COOKIE,
                 typePredicate, consumerBindingIds }
LiteralSpec  = { id, kind: OPENAPI_ENUM_LITERAL|OWNER_VALIDATED_LITERAL,
                 sourceAnchor, schemaPointer?, value, typePredicate, consumerBindingIds }
DerivationSpec = { id, kind: DERIVED_OWNER_OUTPUT, dependsOnOutputIds, sourceAnchor,
                   algorithmSelector, output, consumerBindingIds }
```

Each path/query use has a deterministic `bindingId = fixtureId|location|name`; output and literal
consumer sets must exact-partition all 592 binding IDs. The checker must reject a value that merely
has an existing-looking readback name but is not a consumer of its actual producer.

The graph must model, rather than flatten, the following relations: platform and operations asset
outputs are distinct; extension catalog and inventory target selection are explicit; invitation
URL-to-token is explicit; organization overview category/item selection is paired; the platform
workspace-role and operations-store audit targets are separate; and operations login → cookie →
session entry → context/data-node selection replaces the rolling context version on every owner
response. `sessionPlanId` becomes the sole session selection. Legacy `sessionScope`,
`pathParameters`, and `requestBodyRequired` must be removed or machine-proved exactly derived
from the literal RowPlan before an assembler consumes the catalog.

`PUBLIC_PLATFORM_RECOVERY` is not allowed to remain an unused declaration: the literal graph
must either name its bootstrap-only consumer or remove the declaration.

The source reopen resolves this without changing the 396-row scope: the eight platform-password
recovery fixtures (four U04 parity and four U07 route rows) are public security operations, not
`PLATFORM_ADMIN` operations. They must use `PUBLIC_PLATFORM_RECOVERY`. Its literal chain is
start → private `V2S_PLATFORM_PASSWORD_RECOVERY` flow cookie → send → OTP output → verify →
complete, where complete clears the cookie. It must not require or send `V2S_PLATFORM_SESSION`.

The remaining eight session plans are likewise finite, private chains: bootstrap platform login;
disposable platform re-login; operations credential/login/session entry; disposable operations
re-login; separately selected HEAD_COMPANY and STORE capabilities with rolling context version;
operations recovery's two isolated cookies; and public anonymous invitation-token use. Any context
or data-node selection consumes the owner-returned current version and replaces it only with the
next owner-returned version.

### Reuse-source reconciliation

The 103 reusable algorithm entries are reusable request-shape evidence only: 83 from the HTTP
diagnostic workload, 6 catalog seed algorithms, 11 catalog API algorithms and 3 owner-command
seed algorithms. None authorizes importing a historical root, seed state, credential or generic
operation dispatcher. The catalog must bind every operation to an exact function/span anchor and
the closed variant that it supplies.

Twenty operation IDs are generated by source templates rather than literal call sites: fifteen
invitation create/reissue/cancel variants require their exact target type and template span, and
five `revokeOperationsWorkspace*UserAssignment` variants must anchor
`executeOperationsUserReadbackWorkload`, not the currently mispointed
`executeOperationsAccessWorkload`. These are source-anchor drift defects, not harmless aliases.

The ten final-only builders also require predicate-producing predecessors before their body fields
can be declared: a deletable category, a movable sibling/parent, two sortable dictionary entries,
a temporary item plus immediately preceding preflight digest for the same item, a mutable tag, and
an initialized commercial group with its matching revision. A list response with a generic label
is not field authority. Each body field and postcondition must cite the exact node output and
selection predicate that makes the request meaningful.

### Preconditions for implementation and dynamic admission

Before any assembler implementation, checker and focused tests must prove: all 592 route
bindings resolve to their declared source class; no node/output reference is missing, unrelated,
or cyclic; each consumer is reachable after its producer; source selectors and schema pointers
resolve; all builder fields, CAS/idempotency/replay values and response assertions use the same
graph; and the materializer consumes `fixturePlan` rather than a parallel raw-state shape. Red
fixtures must independently cover a nonexistent producer, an unrelated real producer, a missing
predecessor, a cycle, source-pointer drift, wrong literal member, query omission, wrong session,
multipart-as-JSON, missing idempotency, and missing expected response output.

This is a DESIGN-only reconciliation. It does not authorize an assembler, a managed runtime,
seed/reset, or any statement-count success claim. Dynamic admission remains blocked until this
literal graph, the private owner-HTTP preparation code, static implementation review, and the
separate runtime package all pass.

### POST_REMEDIATION_V4 — catalog-owner response and temporary-item lifecycle reconciliation

`classification: CONFIRMED`  
`implementationDisposition: BLOCKED_PENDING_CONTRACT_REPAIR_AND_FRESH_DESIGN_REVIEW`

The final fixture must model the real business lifecycle instead of inventing a terminal fixture
or a product-only test API. `FIXTURE-TEMPORARY-ITEM` is a normal, run-scoped catalog governance
state: a final-owned STORE (or declared HEAD_COMPANY) operations session creates an item, saves
the exact `EXTERNAL_ORDER_TEMPORARY` / `GOVERNANCE_TODO` external identity, then reads back that
same code/source/version before it calls promotion preflight and execute. The only permitted
sequence is:

```text
CREATE_TEMPORARY_ITEM -> SAVE_TEMPORARY_ITEM -> DETAIL_READBACK
  -> PROMOTION_PREFLIGHT -> PROMOTION_EXECUTE
```

Every arrow is an explicit normal owner-HTTP node in the same final namespace and session. The
preflight and execute nodes use the same temporary item and immutable request facts; execute
consumes that preflight's immediate `sourceVersion` and `preflightDigest`. Codes, external
identity, session cookie, OTP/grant and digest remain private run state. This is not an exception
to the catalog owner boundary: it neither extends the R5-only `terminal-fixture-state` allowlist,
uses SQL/SSH, imports an RM1/R5 fixture, nor adds an HTTP operation or workspace capability.

Before that graph is implemented, two catalog owner/contract defects in its six final rows must
be repaired from their existing source of truth:

1. `deleteOperationsCatalogCategory` currently returns `result.deletedCount`, while the frozen
   OpenAPI contract declares `result.categoryRef`, `deletedSubtreeSize`, and
   `deletedCategoryCodes`. `CatalogOwnerService#deleteCategory` must capture the locked subtree's
   deterministic codes before deletion and return the declared fields. Its focused owner
   integration and edge/API contract proof must assert the exact child/subtree result and reject
   the legacy field. Its replay policy is not assumed: the current owner recheck finds a deleted
   category before receipt replay. The next detail must explicitly choose either an owner-correct
   same-key receipt path after typed grant/context recheck or the smaller `SAME_KEY_ONLY` catalog
   policy for the two delete rows, with stale/wrong-key/mismatched-hash red cases.
2. `preflightOperationsTemporaryCatalogItemPromotion` double-envelopes its detail:
   `CatalogOwnerService#promotionPreflight` creates an envelope-shaped model and passes it to
   `envelope`, producing `response.data.data`, although the canonical
   `TemporaryPromotionPreflight` model already declares the outer envelope. The owner must return
   `envelope(requestId, detail)`. The frozen byte-coverage, OpenAPI, P1/P3 generators and generated
   wire artifacts are read-only hash-bound inputs for this repair: regeneration/check must prove
   their outputs are byte-identical, never hand-edited. The operations UI consumes `response.data`
   through a narrow raw-contract decode rather than a generator-wide type change, and raw HTTP
   proof asserts exactly one envelope plus
   `data.sourceVersion`, `data.preflightDigest`, `data.canPromote`. The final graph therefore
   binds `response.data.sourceVersion` and `response.data.preflightDigest`, never the historical
   `response.data.data` shape.

These are owner-response correctness repairs, not performance optimizations. The approved
implementation manifest must be expanded only after fresh DESIGN review admits exactly five
implementation paths (total technical surface denominator: 26):

1. `modules/catalog/.../CatalogOwnerService.java`;
2. `modules/catalog/.../CatalogCategoryOwnerIntegrationTest.java`;
3. new `modules/catalog/.../CatalogTemporaryPromotionOwnerIntegrationTest.java`;
4. `apps/frontend/operations-admin/.../CatalogItemDrawer.tsx`; and
5. `apps/frontend/operations-admin/.../CatalogManagementPage.test.tsx`.

The owner integration test proves normal create/save/detail temporary state, a single raw
preflight envelope, exact same-item execution, stale digest/version and non-temporary negatives.
The category test proves the declared closed subtree response and rejects `deletedCount`; the UI
test rejects `.data.data` while preserving selected-node/capability proof. Reopened coordinator,
edge, token/capability, generator, canonical contracts and generated output paths are read-only
bound sources: no controller, transaction, schema, generated artifact, capability, seed/reset or
product endpoint changes are admitted. Until this design is independently reviewed and Claude
rechecks it, the current static package may update design and prevention evidence only; it must
not create an assembler, expand implementation authority, or enter the dynamic package.
