# U26 extension-host implementation amendment

## Dexter-authorized CRUD presentation and query-standard remediation

## Dexter-authorized workspace credential reset replacement

The user-reported “reset login credential” control exposed a complete but unreachable legacy
generation-key chain: it created an owner record without changing the credential, had no approved
delivery path for its opaque key, and did not prevent password, OTP, session or business use.  It
is one credential-state problem family, not a platform button defect.

The replacement is owner-owned and single-source: `workspace_credential.password_change_required`
records `SET` versus `CHANGE_REQUIRED`. The platform command CASes the current account revision,
sets the bcrypt hash of its normalized login name, clears lock state, revokes active operations
sessions, writes the ordinary receipt/audit, and readbacks `CHANGE_REQUIRED` without a secret.
Password and OTP entries return the explicit `PASSWORD_CHANGE_REQUIRED` outcome. The common
operations session resolver denies that state before all normal protected endpoints; only entry,
current-password update and logout use the restricted-session read. A current-password update or
the already independent OTP-backed self-service recovery clears the flag and requires login again.

The operations app must render a centered non-dismissible forced-password task before role/context
selection and shell rendering; it tells the user that the temporary password is the login name.
The platform confirmation tells the administrator the same outcome before command submission and
retains safe context on error. The platform-admin’s own credential lifecycle is an explicit
counterexample: it has another owner and is untouched.

The old administrator-issued `resetGenerationKey` scheme is retired in the same change: owner
generation/progress state, anonymous public controller and three OpenAPI paths, public generated
operations, tests and database tables are removed. Operations self-service recovery remains, but
it must never reuse or accept a former administrator generation key.

The user-reported name/code display, relationship filtering and invisible-search-column defects
are one presentation/owner-query problem family, not independent page defects. The finite
denominator is every current platform-admin and operations-admin flat CRUD list, its primary
detail surface, and every external-entity filter. The root cause is that the prior broad
`名称(编码)` presentation convention was applied without the semantic distinction between the
row's primary fact and an associated fact, while several list filters were modelled as strings
instead of owner candidate selections. A second design omission allowed a query condition to
disappear from the result table, preventing a user from checking why a row matched.

The remediation is normative:

1. A primary list name is name only and a real code is a separately visible code column; a
   primary detail exposes name and code as separate rows.
2. A returned associated entity remains `名称(编码)`; this is the only normal use of the shared
   name/code formatter in a CRUD page. Hierarchy navigation titles are an explicit non-flat-list
   counterexample.
3. External-entity filters use owner-issued ID candidates, support real name/code search and
   must not fabricate a missing owner code. Their candidate relationship lookup is not a second
   primary read-range filter under G-05A.
4. A CRUD list's visible result columns strictly cover all visible query semantics and include at
   least one additional business column.

`doc/evidence/platform/rm1/p6/rm1p6-name-code-display-u21-implementation-amendment.md` remains
historical evidence only. Its broad wording that all name/code displays should be formatted is
superseded by this primary-vs-associated rule; no historical evidence is retroactively edited.

## Dexter-authorized generated edge route consumer closure

The verified disabled-entity status-transition failure showed that a managed caller could hand-write
an Edge path and then reverse-match it against the generated registry. That escaped the contract at
the only point which should have selected the operation, so a stale `/nodes/{id}/status` variant
survived until L2. The repair is one consumer rule for both admin applications and every managed
seed, fixture, L2 or diagnostic caller: select the generated operation by `operationId`, supply typed
path/query parameters, materialize the generated template with encoded values, and only then execute
the HTTP request. Hand-written paths, string-fragment route construction and method/path reverse
lookup are retired from consumers. OpenAPI shards, controller mappings, codegen and generated
registries remain the owner truth; synthetic non-request test data is the only documented
counterexample.

The existing frontend-architecture gate now scans that complete consumer denominator and
fail-closes on an Edge-route literal, with a real red mutation. The finite migration set is the
formal owner-command seed, both L2 fixture executors, HTTP diagnostic workload and direct browser
request helpers. A green generated registry cannot substitute for this gate: the caller must prove
it did not escape the registry before runtime.

The finite source catalog is `contracts/policy/crud-presentation-standard-catalog.json`. It is
executed by the existing `scripts/check/frontend-architecture` gate, which validates catalog
schema, strict filter/column coverage, registered source existence, primary formatter misuse and
required relationship presentation expressions. Its self-test contains a behavior-changing red
mutation. L2 adds actual result/selector assertions; neither static gate nor L2 substitutes the
other.

## Dexter-authorized systemic operations authorization remediation

The reported commercial-group edit and audit-history failures exposed a deeper common
authorization defect. The finite denominator is all 66 operations declared as
`AUTHENTICATED_WORKSPACE` with the target-scope resolver: 20 invitation or assignment
mutations already call their workspace-IAM owner action check; 20 workspace-IAM reads
are an explicit counterexample because they retain owner scope filtering but never use a
write capability; 17 organization/contract mutations had neither action enforcement nor
owner-first-query predicate handoff; five hierarchy mutations resolved an edge predicate
but discarded it before the owner command; and four session-lifecycle operations were
incorrectly modelled as role-scoped operations.

The repair is deliberately not a global HTTP interceptor. A server-resolved, typed
operation authorization grant carries the generated requirement and first-owner-query
predicate. The workspace-IAM owner rechecks the active assignment and current role
capability from owner facts, not `WorkspaceSessionReadback.actionCapabilityKeys`; the
target owner applies the predicate to its first target query in the same `REQUIRED`
transaction before command receipt replay, invariant checking, mutation and audit.
For group-root actions the explicit catalog scope is `GROUP`; for existing target and
parent target actions the owner derives that target from current owner facts. The four
self-session operations remain bearer-session protected but require neither role
capability nor task assignment. This bounded remediation adds no raw SQL client,
cross-owner private-table access, invented target or generic bypass.

Dexter authorized a complete extension-field host addition for commercial groups,
regions, and projects. The preceding U25 visual-theme work has no package-exit
artifact because Dexter directed that isolated bug/UI repairs do not create a package.
This package therefore resumes from the latest closed implementation package,
`RM1P6-AUTH-SURFACE-LAYOUT-U24`, and does not assert U25 closure.

U26 is limited to the eight-host definition catalog, durable organization-owner
values and readbacks, generated contract, the two admin form/detail surfaces, and
the formal owner-command seed. It adds no workspace capability, client-side raw
transport, direct seed SQL, or new owner boundary.

## Confirmed hierarchy-detail completion repair

The platform organization hierarchy had accepted the three new host definitions but
missed their final read presentation: the commercial-group root was projected with an
empty extension-field list, while the owner overview reader did not map REGION or
PROJECT values into its existing extension-display projection. This repair stays in
U26's existing authorization boundary. It reuses the existing generated definition
query and owner readback path, removes only the redundant hierarchy “所属机构” row,
and consumes the already-returned disabled status in the tree title. It adds no
endpoint, workspace capability, raw transport, seed mechanism, or owner write path.

## Confirmed extension-editor interaction completion repair

The editor already persists declaration order from the dragged card order. Its
duplicate up/down buttons were a second, unnecessary ordering control and the add
control was visually detached below the field set. The Drawer now exposes one
primary “添加字段” control in its top-right extra slot and retains drag-and-drop as
the sole ordering interaction. This is presentation-only: it preserves owner CAS,
field identity, display-order serialization, generated client use, and all field
validation.

## Confirmed organization-path presentation repair

The workspace-IAM owner intentionally transfers organization paths in canonical
`CODE name / CODE name` form. Both admin applications had consumers that rendered
that transport value directly, even though the shared user-visible identity rule is
`名称(编码)`. The finite repair denominator is the platform account list, detail,
revocation confirmation and organization candidates; the platform invitation
candidate surfaces; and the equivalent operations user and invitation surfaces.
The repair adds one tolerant shared presentation formatter and leaves owner facts,
OpenAPI, generated clients, authorization, persistence and public invitation pages
unchanged.

## Confirmed workspace selector label repair

The authenticated platform shell has a single workspace selector in the side-bar
footer. Its text label consumes unnecessary space beside the selected workspace;
the label is replaced with an accessible icon while the Select retains its
`aria-label`, test id, candidate behavior and selected-workspace semantics.

## Confirmed extension definition key/name repair

The extension owner already keeps a stable `key` for parsing entity `extensionValues` and a
separate `label` for the human-facing field name. The configuration UI previously showed only
the label, which obscured that separation. The platform extension-definition table and edit
Drawer now separately show “字段 key” and “字段名称”. Existing keys remain owner-issued and
read-only; a new row states “保存后自动生成” until owner readback allocates it. Host forms and
details continue to display the field name while binding values by key. OpenAPI, generated
clients, persistence, owner allocation and atomic CAS replacement remain unchanged.

## Confirmed formal extension seed completion repair

The formal fixture defined all eight extension hosts, but the seed executor only wrote the first
field for commercial-group, region and project. Brand, tenant, head-company, store and contract
facts had no extension values at all. The fixture now declares a local seed alias and human label
for every field, and each Aurora owner fact declares values for every applicable alias. The
executor maps aliases to keys only from the owner definition PUT readback, writes all values through
the existing owner HTTP create commands, and fail-closes on missing, partial or mismatched
definition/value readbacks. The final aggregate readback reports only host/count metadata; it does
not expose payloads or generated field keys. No owner API, workspace capability, direct SQL,
OpenAPI contract or persistence shape changed.

## Dexter-authorized three-domain read-interface reconciliation

Dexter's reported tenant-list divergence exposed a broader architectural problem: the two
administrative edges had gradually grown parallel application queries for the same owner facts.
The external HTTP faces remain deliberately different because their sessions, actor boundaries,
DTOs and user tasks are different. The owner domain interface must not be different for the same
fact, however. This amendment therefore applies the following finite reconciliation before any
test run is used as acceptance evidence.

| owner fact | one retained domain interface | app-owned adapters | retired parallel path |
| --- | --- | --- | --- |
| brand, tenant and head-company page/detail | `BusinessEntityService#pageBusinessEntities` and `#requireBusinessEntity` | platform overview item and operations entity DTOs | overview-local three-table union and its independent count/predicate |
| group/region/project hierarchy snapshot, page and detail | `OrganizationCommandService#requireCommercialGroup` plus `OrganizationHierarchyService#list`, `#page(HierarchyQuery)` and `#requireNodeWithPath` | platform tree/page/detail projection and operations hierarchy wire mapper | overview-local hierarchy tree/page/detail SQL and independent count/path predicates |
| contract list | `ContractTaskReadService#list(ContractListQuery)` with one shared predicate object for `COUNT` and page IDs | platform overview wire mapper and operations contract mapper | `page(...)` / `platformOverview(...)` list variants and their duplicate filters |
| workspace-account page and invitation candidates | `WorkspaceUserService#page(AccountPageQuery)` and `#candidates(CandidateQuery)` | platform account/invitation edge and operations task-scoped account/invitation edge | `pageForPlatform`, `pageForOperations`, `candidatesForPlatform`, `candidatesForOperations`, and duplicated account-ID/count SQL |

`ContractListQuery` is the complete owner vocabulary: `projectId`, `storeId`, `contractNo`,
`storeName`, `phaseName`, `tenantName`, `itemCode`, effective-date bounds, status, sort,
direction and pagination. Platform sends the IA03 text filters (`合同编号`、`门店`、`项目分期`、
`经营租户`、`货号`、`状态`); operations continues to send its explicit `projectId` scope and
its own approved filters. Both map into the same query and count/page predicate. The platform
response's historical candidate metadata remains wire-compatible but is not allowed to cause a
second contract-list query or client filtering.

`HierarchyQuery` follows the same rule for the node fact: type, name, code, status, optional
project ID, sort, direction and pagination belong to `OrganizationHierarchyService`; the platform
overview maps its page-specific conditions into that query while the operations tree maps the
unfiltered owner list into its own wire shape.  Neither edge nor the former overview task read is
allowed to own a second hierarchy predicate, count or ancestry query.

## Dexter-authorized CRUD relationship-filter identity normalization

The current CRUD-presentation gate found eight independently confirmed symptoms of one later
regression in the preceding reconciliation: a relationship filter may display an owner candidate
but must submit that candidate's opaque owner identifier, never its label or a separately recreated
name predicate.  The finite repair is therefore owner-first and replaces—not supplements—the
following text conditions:

| owner | retained owner query vocabulary | platform-admin adapter | operations-admin adapter |
| --- | --- | --- | --- |
| contract | `ContractListQuery(projectId, storeId, tenantId, contractNo, phaseName, itemCode, date bounds, status, sort, direction, page)` and an owner relation-candidate read with name-or-code matching | contract overview sends `storeId` / `tenantId` and obtains store/tenant options through its platform edge | contract management keeps its task-primary `projectId` but sends `storeId` / `tenantId`; its own edge adapts the same owner candidate read |
| workspace IAM account | `AccountPageQuery(..., roleId, ...)` | platform account list selects an owner-issued role ID | operations user list selects an owner-issued role ID through its existing operations candidate edge |
| workspace IAM invitation | `ManagementInvitationPageRequest(..., targetOrganizationRef, roleId, ...)` | platform invitation list retains its organization ID selector and changes the role selector to `roleId` | operations invitation list uses owner-issued organization and role IDs through its existing operations candidate edge |
| organization brand | the existing `BusinessEntityService#pageBusinessEntities` name/code predicate | no change | the total-company brand-authorisation selector forwards the same query text to both `name` and `code` fields |

`storeName`, `tenantName`, `roleQuery` and `organizationQuery` are retired from the listed owner
list predicates and from both corresponding edge request contracts. They remain allowed only as
ephemeral candidate-search text, which is never persisted as a selected filter value. A role has no
business code, so its candidate label remains its name while its submitted value is `roleId`.
Organization, store, tenant and brand candidates display `名称(编码)` and their candidate reads
must match both facts. This does not merge either app's session, router, shell, generated client or
HTTP endpoint; it only makes both adapters map to the same owner query semantics.

`AccountPageQuery` carries an explicit owner-resolved read scope rather than a capability. A
platform query has workspace-wide administration scope; an operations query resolves the current
assignment and fixed target type in workspace-IAM, then passes the resulting target/family
predicate into the same account predicate used for both count and page IDs. This preserves the
settled rule that capability controls writes only, while primary account visibility comes from the
role-node range. Invitation candidates are deliberately not treated as generic account pages:
the candidate that becomes an invitation/assignment target remains range-constrained; associated
reference candidates remain outside a second read-range filter under G-05A.

The reconciliation does not merge platform-admin with operations-admin, does not share their
session, router, shell, generated client or external OpenAPI face, and does not introduce an
internal OpenAPI client. It removes duplicate owner SQL only after the consuming app adapters
are already mapped to the retained owner readback. Focused proof must demonstrate (1) the same
contract predicate for count/page with every filter, including `storeName` and `itemCode`; (2) the
same account predicate for workspace and task scope, including the group/head-company aggregate;
(3) hierarchy root, nodes and phases all originate in organization owner APIs; and (4) TENANT and
HEAD_COMPANY legal fields retain their shared page/detail source while BRAND remains the explicit
name/code-only counterexample.
