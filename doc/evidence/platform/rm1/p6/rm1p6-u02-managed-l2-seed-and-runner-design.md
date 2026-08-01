SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# RM1 P6-2 managed isolated L2 seed and runner design

## 1. Business purpose and authority

P6-2 proves that a platform administrator can use the nine accepted platform
business surfaces against owner-held truth, rather than a mock, a static page,
or a client-derived substitute.  The original business requirements are the
P6-2 platform surfaces in `contracts/policy/affected-l2-registry.json` under
`RM1P6-U02`, the accepted platform interactions in
`doc/decisions/2026-07-28-v2s-rm1-ia-02-operation-context-interaction.md` and
`doc/decisions/2026-07-29-v2s-rm1-ia-03-platform-governance-and-self-service-interaction.md`.

Dexter has expressly authorized a **managed isolated L2 environment plus seed,
without reset**.  This is narrower than the proposed full R5 fixture: it only
creates the owner facts required to render and inspect the P6-2 L2 targets.
It does not implement P6-3, does not reuse its UI journeys, and does not make
the historical proposed full seed executable.

## 2. Boundary and failure model

`scripts/test/r5-platform-admin-l2.mjs` owns one run-scoped execution.  It
generates a unique valid `V2S_DEV_NAMESPACE` and a matching private
`V2S_RUNTIME_DIR`, starts the existing managed R5 environment with an explicit
fresh-database requirement, invokes
`scripts/test/r5-platform-admin-l2-fixture-seed.mjs`, runs the finite nine
Playwright cases, and invokes the matching managed stop command in `finally`.
The runner persists a redacted run manifest, phase log and result JSON below
the configured runtime directory.  It reports `BUSINESS=PASS|FAIL` separately
from `CLEANUP=PASS|FAIL`.

No command may call `scripts/dev/reset`, delete a database, kill by port, or
reuse a stale manifest.  The managed runner must refuse an already-existing
database before it starts any process or sends an owner HTTP command, and record
`freshDatabase=true` only when its current remote provision call created that
database.  This provision-time fact is the isolation proof; an after-the-fact
table scan is neither sufficient nor permitted as an ordinary-fact SQL escape.
The root bootstrap then requires an empty platform-admin table.  Managed stop
is process cleanup only: the isolated database remains available for post-failure
diagnosis and is never reset by this delivery unit.

The only direct SQL remains `scripts/dev/r5-seed-bootstrap.mjs`, whose frozen
scope is the built-in DEV root identity, credential, audit and receipt.  Every
other fact below is created through the owner HTTP command named in this
section.  For this isolated L2 run only, the runner starts the business server
with `CATERING_OTP_DEBUG_CODE_EXPOSURE=true`; all other starts retain its false
default. The seed gets the invitation OTP solely from that single send-OTP
response, consumes it immediately, and fails closed when it is absent. It writes
neither session cookies, OTP values nor passwords to logs, the fixture export,
or package evidence.

## 3. Minimal owner-command fixture

The fixture is intentionally one enabled group workspace (`aurora`), one
group-scoped operations account, one role, one region/project/brand/tenant/
head company/store, one contract, one extension definition and one additional
platform administrator.  Its public display values are taken from command
readbacks; tests receive only those values through a redacted fixture export.

| Order | Owner command / source | Required result and readback |
| --- | --- | --- |
| 1 | Existing `r5-seed-bootstrap.mjs`; `platformPasswordLogin` | Root platform cookie only in process memory. |
| 2 | `stagePlatformAsset`, `POST /api/platform/assets/staging` | Live `assetRef` and bind grant; a generated 1x1 PNG is multipart input, not a database row. |
| 3 | `createPlatformGroupWorkspace`, then `initializeCommercialGroup` | `aurora`, `极光商业集团空间`, operations title, logo, and commercial-group root ID from owner responses. |
| 4 | `replaceExtensionDefinition` for `BRAND` | A non-empty `品牌` definition readback, including owner revision. This is why the extension-field L2 page has a real editor target. |
| 5 | `createPlatformAdmin` | A second enabled administrator readback used by the administrator detail L2 case. |
| 6 | `createWorkspaceRole` | One `GROUP` role with precisely the organization and contract create capabilities used in rows 9--14, and its owner role ID/readback. |
| 7 | `createWorkspaceInvitation` targeting the commercial-group root, then `acceptPublicInvitation`, `sendPublicInvitationOtp`, `verifyPublicInvitationOtp`, `savePublicInvitationCredentials`, `completePublicInvitation` | A real workspace account/assignment. The invitation page URL supplies the opaque invitation token; the OTP is read only from the enabled isolated-run response and immediately consumed in process memory. |
| 8 | `operationsWorkspacePasswordLogin` | Operations session cookie in process memory for the assigned group role. |
| 9 | `createOperationsOrganizationRegion`, `createOperationsOrganizationProject` | `东区` and `河畔项目` owner IDs. |
| 10 | `createOperationsOrganizationBrand`, `createOperationsOrganizationTenant`, `createOperationsOrganizationHeadCompany`, `addOperationsOrganizationHeadCompanyBrandAuthorization` | `茶里`, `极光餐饮一号`, and a brand-authorized head-company ID. |
| 11 | `createOperationsOrganizationStore` | `河畔茶里店` and owner store ID, with project/brand/tenant/head-company source IDs. |
| 12 | `createOperationsContract` | `R5-CUR-001`, one item (`SKU-TEA-01` / `招牌茶饮`) and a readback-able contract. |

The role command includes only the capability keys necessary for rows 9--12:
`BC-ORG-REGION-CREATE`, `BC-ORG-PROJECT-CREATE`, `BC-ORG-BRAND-CREATE`,
`BC-ORG-TENANT-CREATE`, `BC-ORG-HEAD-COMPANY-CREATE`,
`BC-ORG-HEAD-COMPANY-BRAND`, `BC-ORG-STORE-CREATE`, and
`BC-CONTRACT-CREATE`.  It has no authority to alter platform owner facts.

`createWorkspaceInvitation` uses the commercial-group root's command
readback ID as `targetOrganizationRef`; it must not invent a GROUP reference
from the workspace key.  The completed public invitation creates the account
and assignment, so the seed never writes an assignment directly.

## 4. Contract, readiness and session invariants

Before bootstrap or any seed HTTP command, the runner performs one bounded,
observable readiness phase. It checks the owned PID tree from the run manifest,
the backend health/edge reachability, and the platform-admin reachable URL
against fixed deadlines. On its first failure it reads the manifest and the last
bounded lines from each owned process log, records phase elapsed time and log
paths, then invokes managed stop. It never replaces a failed readiness phase
with sleep, a longer timeout, or a retry loop.

All platform commands carry the platform session cookie and their required
idempotency header/body value.  Asset bind grants and invitation tokens are
opaque one-time command material.  All organization and contract commands
carry the operations session cookie that can exist only after row 7 completed
and row 8 authenticated it.  An owner command response is immediately checked
for its identifier and human-readable source value before its successor is
called; failure records only operation ID, HTTP status, correlation ID and a
redacted response classification.

The runner emits a redacted fixture JSON containing only readback-backed public
labels/identifiers and their digest. It must derive the following exact public
test labels from owner readbacks, never hard-code hidden internal IDs:

`R5_L2_PLATFORM_LOGIN_NAME`, `R5_L2_PLATFORM_WORKSPACE_LABEL`,
`R5_L2_PLATFORM_WORKSPACE_NAME`,
`R5_L2_PLATFORM_ADMIN_NAME`, `R5_L2_PLATFORM_ROLE_NAME`,
`R5_L2_PLATFORM_ACCOUNT_NAME`, `R5_L2_PLATFORM_EXTENSION_ENTITY_NAME`,
`R5_L2_PLATFORM_ORGANIZATION_NAME`, `R5_L2_PLATFORM_ORGANIZATION_SOURCE`,
`R5_L2_PLATFORM_ORGANIZATION_PROJECT_LABEL`,
`R5_L2_PLATFORM_ORGANIZATION_BRAND_LABEL`,
`R5_L2_PLATFORM_ORGANIZATION_TENANT_LABEL`, and
`R5_L2_PLATFORM_CONTRACT_NO`.

`R5_L2_PLATFORM_LOGIN_PASSWORD` is deliberately absent from that JSON. The
runner reads it from its private `credentials.env` and passes it only as a
one-shot child-process environment variable to Playwright. Result evidence can
state whether the expected credential key was present, but must not record the
value, a value hash, an OTP, a cookie, an invitation token or a bind grant.

## 5. Nine L2 cases and acceptance

The runner invokes exactly the nine files enumerated by `RM1P6-U02` in
`affected-l2-registry.json`.  Each signs in through rendered platform-admin,
uses the approved business page and opens an owner-backed read/detail/editor
surface: authentication, group-workspace management and overview, platform
administrator management, organization overview, contract overview, role
management, workspace-account management and extension-field management.
No L2 case performs a governance mutation.

Acceptance requires all nine browser cases PASS and a retained run result with
their exact test IDs, run manifest path, fixture readback digest and redacted
log paths.  It also requires the managed process manifest to report no owned
live PID after `finally`; an L2 business PASS with cleanup FAIL is not a
package-exit PASS.

## 6. Source-compliance denominator and prevention

| Source denominator | Owning source / check | Disposition |
| --- | --- | --- |
| Current L2 obligation | `contracts/policy/affected-l2-registry.json` / `scripts/check/affected-l2` | Update; P6-2 active, P6-3 future only. |
| Managed run orchestrator | `scripts/test/r5-platform-admin-l2.mjs` and `scripts/dev/r5-dev-runner.mjs` | Create/update; unique fresh DB, bounded readiness, scoped debug OTP and separate cleanup. |
| Owner-command fixture | `scripts/test/r5-platform-admin-l2-fixture-seed.mjs` | Create. |
| L2 browser cases | `apps/frontend/platform-admin/src/tests/l2/*.spec.ts` | Existing P6-2 tests, executed rather than substituted by static proof. |
| L2 policy enforcement | `tools/verify-gates/cli.mjs` | Update, with target/stub/layout/selected-change/expiry red controls. |
| Package truth | manifest, package input, disposition, finding family and final exit under `doc/evidence/platform/rm1/p6/` | Update/create; final set equality is required. |

The confirmed problem family is
`HISTORICAL_DEFER_OVERRIDE_OF_CURRENT_DEXTER_SCOPE` in
`rm1p6-u02-l2-scope-correction-problem-family.json`: a historical deferral
must not override Dexter's current finite L2 business denominator.  Prevention
is the schema-4 active/future obligation split plus this run-scoped real
browser proof.  Counterexample: P6-3 remains `PENDING_FUTURE_UNIT`; this
design neither creates P6-3 pages nor treats their absent L2 files as P6-2
success.

## 7. Failure recovery and review boundary

The static/red controls additionally prove that an existing requested database
is refused before any seed HTTP command, a missing debug OTP is refused before
verification, and a stale manifest is refused. On the first failure the runner stops creating successor facts, preserves
redacted operation/runner logs and invokes managed stop.  A repeat of the same
signal requires reading the retained phase log and run manifest before retry.
No timeout extension, retry loop, port kill, seed-on-start or reset is a
recovery action.

This is a material Dexter-authorized scope extension (managed L2 plus seed),
so it requires a fresh independent DESIGN adversarial review before script
implementation.  After implementation and dynamic evidence, the old capped
P6-2 implementation review is not rewritten; the new scope receives a fresh
IMPLEMENTATION review cycle and then Dexter/Claude review.

## 8. Independent review input inventory

The design-review record must freeze path plus SHA-256 for this document,
`contracts/policy/affected-l2-registry.json`, `scripts/dev/r5-dev-runner.mjs`,
`scripts/dev/r5-seed-bootstrap.mjs`, the platform/group-workspace, commercial
group, workspace-access, public-invitation, organization/store/contract OpenAPI
sources, and the nine `apps/frontend/platform-admin/src/tests/l2/*.spec.ts`
files. The independent reviewer declares a blind falsification pass against
those input bytes before comparing its result with this design.
