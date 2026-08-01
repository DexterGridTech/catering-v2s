# RM1 P3-A+B+C Claude NO-GO remediation design v2

## Status and authority

- `status`: `ACTIVE_IMPLEMENTATION_REMEDIATION`
- `scope`: RM1 P3-A+B+C only; P1 remains blocked until this remediation has a composite PASS exit and Claude re-review.
- `supersedes`: `rm1-p3-abc-post-claude-remediation-design.json` only. That draft's session/id-derived target proposal is rejected and was never implemented.
- `preserves`: the historical two-round independent review artifacts. Their round-2 `GO` is not reused as a current verdict and no third independent review is opened.

## User task and immutable model

The five catalog pages are distinct user-management tasks. A user holding a REGION assignment may manage PROJECT users at an allowed project, and must receive PROJECT users and the PROJECT capability check—not REGION users or a 404. The target organization type is an intrinsic operation/capability fact; `pageDesignKey` never crosses the wire into authorization and a client never chooses target type or capability.

The existing ten catalog bindings are the authority:

| logical family | target | capability |
| --- | --- | --- |
| invitation list/candidates/create/cancel/reissue | GROUP/REGION/PROJECT/HEAD_COMPANY/STORE | matching `BC-IAM-<TARGET>-INVITE` |
| membership list/detail/revoke | GROUP/REGION/PROJECT/HEAD_COMPANY/STORE | matching `BC-IAM-<TARGET>-ROLE-REVOKE` |

This applies the existing bindings to the read operations as well. It does not invent a new read capability.

## M1: target-specific operation identities

The current eight generic operations must be replaced by forty static, target-specific OpenAPI operation identities: five target variants for each logical behavior. Each identity has a concrete target segment in its route, an individual operation id, the matching target page key for frontend metadata only, and one matching `x-required-capability`. A generic operation plus target parameter is forbidden because its capability is not intrinsic.

For each static operation, controller/service code receives a constant expected target type from the selected operation. Where `scopeRef` is already part of the selected read/create contract, the owner uses `requireTaskPath(workspace, key, expectedTargetType, scopeRef)` and retains the existing `isScopeAllowed(assignment, target)` ancestor/leaf predicate unchanged. It must not use `assignment.serviceNodeType()` as target type and must not infer the target type from a scope id.

For detail/revoke/cancel/reissue, the persisted assignment or invitation intent is server-resolved; it must be of the endpoint's fixed target type and within the acting assignment's allowed hierarchy before owner read/command proceeds. The owner command continues to recheck the existing target-specific capability internally. `scopeRef` remains only on its three existing selection surfaces; no `pageDesignKey`, target type, or capability is accepted in a request body/query to select authorization.

Required real tests are: REGION→PROJECT returns PROJECT personnel; GROUP→STORE returns STORE personnel; peer-region project denied; cross-group id denied; STORE assignment with foreign scope denied; revoke checks `BC-IAM-<TARGET>-ROLE-REVOKE`. The red mutation changes the expected operation target back to `assignment.serviceNodeType()`; tests 1, 2, and 6 must fail. Existing mock-only controller tests do not satisfy this denominator.

## M2: generated-output receipt continuity

The replay evidence becomes an append-only two-segment record: historical `012/013`, then current `015/016`. The terminal segment records the current generator hash and the delivery hashes. Every terminal output hash must equal the same package exit's `incrementalChecks[].afterSha256`; the checker fails with a named reason on any mismatch. The historical segment is retained rather than overwritten.

## M3 and S1: truthful dynamic and authorization evidence

`incrementalChecks` remains a changed-file compliance record and is never test execution evidence. Package input declares a business-evidence obligation; a package with that obligation may not say `business: NOT_APPLICABLE`. Package exits gain distinct `dynamicEvidence[]` (runner, current-source hashes, suite, result, run log/result path or `LOG_NOT_AVAILABLE`, and cleanup). P3-A/B/C historical exits are amended to record the original lack of dynamic proof as `BLOCKED_ON_HISTORICAL_FIXTURE`/`UNVERIFIED_REQUIRES_EVIDENCE` only where the source log supports it; the U04R composite exit cannot PASS until current-byte managed evidence is PASS.

The managed runner must collect remote result/logs and execute cleanup even when Gradle fails; the first observed failed run is retained with `firstFailure`, `lastKnownGood`, and `brokenBoundary` before a retry. The new exit also has `authorizationSemanticsEvidence[]` that maps each semantic assertion to a real test, assertion, target capability, red mutation, and current source hashes.

### Current-byte fixture compatibility denominator

The dynamic suite is a current-byte proof surface, so its fixtures must not silently retain pre-cutover persistence assumptions. The finite same-root denominator is every Testcontainers fixture that constructs an organization `GROUP` node, inserts a `role_assignment` without a valid invitation, inserts an invitation without all current timestamp fields, inserts a tenant without its required legal name and credit code, or refers to a retired generic user-management requirement. The scope-test proof, workspace-iam public-flow test, workspace-iam role test, organization owner test, and contract command test are all reopened. Each is moved to the authoritative commercial-group/REGION→PROJECT model or to current database constraints; this is fixture compatibility work only and does not alter an application authorization rule, migration, seed, or the P2/P4 exclusions.

The independent but same mechanical `pg_advisory_xact_lock` denominator is every Java caller. PostgreSQL returns void for that lock function, so a `queryForObject(..., Long.class, ...)` caller is invalid even though the lock itself succeeds. All callers use a result-agnostic invocation; this preserves transaction-local lock semantics and fixes the OTP path without introducing a retry or timing workaround.

The current-byte run also proves two P3-owned production inconsistencies: the ownership read's PostgreSQL `DISTINCT` query orders by a non-selected column, and the P3 invitation lifecycle writes transient `COMPLETING` while the immutable predecessor migration's check omits it. The former receives a SQL-only projection correction without changing the deferred P4 pagination algorithm. The latter receives one additive Flyway migration that extends the named check; no executed migration is rewritten and no seed/reset data is introduced. The direct membership fixture's empty scope is a REGION node, matching the current hierarchy model.

## Explicit exclusions

- Do not restore backend authorization from `pageDesignKey`.
- Do not use `requireTaskPathById` or any id-derived target type.
- Do not alter `OrganizationTaskPathService.isScopeAllowed`.
- Do not close P4's in-memory pagination/row-by-row resolution observation or P2's Membership naming observation.
