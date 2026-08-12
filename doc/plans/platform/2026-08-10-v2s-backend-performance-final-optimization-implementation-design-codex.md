# Backend-performance final optimization implementation-facing design

`SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0`

implementationAuthority: false

## 1. Project-memory, standards, gates and Testcontainers design

### 1.1 Routed project-memory and immutable redlines

The implementation reopens and obeys `project-memory/decisions/deterministic-context-only.md`,
`project-memory/decisions/http-crud-efficiency-design-redlines.md`, the current
`contracts/policy/standards-coverage-matrix.json`, the immutable-evidence rules and
the managed-runtime boundary. They are not background references: they supply the
three permanent assertions, owner/cross-schema prohibitions, evidence taxonomy and
first-failure/cleanup rules used below. Existing sources and generated registries are
reused as the canonical denominator; no new generic dispatcher, cache, query bus,
runner or API is introduced.

### 1.2 Standards and machine-control split

The next implementation appends the three new redlines and registers their
machine-checkable portions as `GATE` entries in standards coverage. The machine
controls are deliberately narrow: exact inventory/shape joins, one declared origin,
binding reachability, loader caller membership, immutable event multiplicity,
same-basis report integrity and UPDATE conservation. Owner-readback necessity,
semantic equivalence of a fold and user-task/cardinality sufficiency remain
`UNENFORCEABLE_BY_MACHINE` with a source-first review checklist. Every machine failure
includes WHY, BACKGROUND and PATTERN plus a real red mutation.

### 1.3 Gate topology, permanent dispatch and existing-control disposition

The gates run in this dependency order: independent operation-source inventory →
196-row database-shape matrix → command topology/M1 binding reachability → task-read
policy/exemption closure → immutable request-fact-load-once snapshot check → report
comparison. No gate replaces another: command coverage does not judge read semantics;
read budget does not impose a global cap; report comparison cannot make a static or
L2/UAT result pass. The five stale revoke anchors are repaired as a finite precondition
to extending read-budget control.

#### Mandatory-per-edit dispatch is a repository control, not a mutable package option

`BPF-U01` first changes `tools/compliance-control/cli.mjs` so every active package,
including design-only, control-plane, source, runner and future-package templates,
must carry `mandatoryPerEditGate`. Absence, malformed shape, unknown profile or a
profile whose command cannot be executed fails activation/pre-hook with
`ACTIVE_PACKAGE_MANDATORY_PER_EDIT_GATE_INVALID`; `runMandatoryPerEditGate` must no
longer silently return on absence. This is a global compliance-control change, not a
performance-package convention.

The package field names an immutable **gate profile ID**, never an arbitrary command.
The CLI resolves that ID exclusively through a new
`contracts/policy/mandatory-per-edit-gate-command-closure.json`. The closure has a
closed `closedMandatoryPerEditGateCommands` map: each ID owns its exact argv, intended
package archetypes, command source hash and independent-review binding. A package may
select only a compatible existing profile; it cannot embed arguments, substitute a
weaker checker, or append a command to satisfy the required field. Adding, removing
or changing an entry is a separate control-plane change that requires a fresh
independent review whose reviewed command/hash/profile is stored in that closure; a
normal feature package may not make that change. The CLI must red-mutate (a) missing
field, (b) unlisted command/profile, (c) changed command argv/hash, (d) missing or
non-GO independent-review binding, and (e) an incompatible package archetype.

Before enabling the requirement, `BPF-U01` creates a finite compatibility matrix for
the current active package and every future creation-template archetype (design-only,
control-plane, backend source, frontend source, runner/evidence). The implementation
denominator is explicit, not “all JSON that happens to name a package”: direct
`readActivePackage` activation; `active-package-recovery`'s `targetPackage`; the
active-recovery self-test target; the mandatory-gate self-test target; and edge-codegen
controlled-write self-test package fixture. Their concrete construction anchors are
`tools/compliance-control/cli.mjs#readActivePackage`,
`#readActivePackageRecoveryRequest`, `#activePackageRecoverySelfTest` and
`#mandatoryPerEditGateSelfTest`, plus
`scripts/generate/edge-codegen.mjs#selfTest`. Each must parse/validate a profile ID
and select exactly one compatible closure entry. The test denominator includes one
design/control, one backend, one frontend/generated-wire and one runner/evidence
fixture; a profile rejected for one archetype cannot be substituted merely to make a
fixture green. Historical inactive package bytes are not retroactively activated.

The initial closure includes the existing performance topology command and only
additional commands that have passed this same independent control-plane review. This
prevents both a future silent skip and the opposite error of forcing an unrelated
package through an inapplicable performance gate.

`scripts/verify` may report the closure checker for visibility, but source-edit
admission is owned by compliance-control, not by a best-effort aggregate script.
The design does **not** claim that the fact-load-once checker runs at edit time: static
inventory only rejects an unregistered loader/caller or missing shape declaration;
the at-most-once property is a runtime, immutable-snapshot verdict only.

#### Existing gate topology: explicit non-masking disposition

The implementation does not treat pre-existing red checks as invisible. The following
five adjacent controls are finite prerequisites/dispositions, recorded in the gate
topology and in `backend-performance-gate-dispositions` before any performance
success claim:

| Existing control | Current role / red state | BPF disposition; no masking allowed |
| --- | --- | --- |
| `scripts/check/database-operation-budget` | Three-line wrapper; currently `R4_DATABASE_SELECT_STAR` red. | Retire its duplicate *performance-shape* responsibility into the new shape gate, but first retain a compatibility wrapper that delegates to that gate and gives the old check its own explicit historical `SELECT_STAR` disposition. It may not simply disappear or be called green. |
| `scripts/check/backend-performance-gate-dispositions` | Current executable-gate denominator is red. | Update its finite ledger and closed additions to register the source-inventory, shape and fact-load-once controls with their real phase/status; prove new executable/verify drift red mutations. |
| `scripts/check/authority-source-ledger` | Current `ST-11` row is red. | Reopen and repair/retire the invalid row under its owning authority source before implementation exit; this design neither consumes it as a green authority nor suppresses its failure. |
| `scripts/check/backend-performance-read-budget` | Current stale `OperationsWorkspaceUserController#revoke` anchor is red. | BPF-U05 replaces it with exactly five real revoke entries and proves a missing-member mutation; no shape join is admitted first. |
| `scripts/check/backend-performance-final-fixture-catalog` | Current owner/HTTP/OpenAPI drift is red. | BPF-U06 first reconciles the exact 196 source contract and its red fixture before Testcontainers plan/report work. |

`canonical-performance-ledger` and `backend-performance-command-baselines` remain
consulted, passing neighbouring controls; they are not silently repurposed as shape
authority. The new source-inventory, shape and runtime-snapshot controls are added to
the gate-dispositions ledger with WHY/BACKGROUND/PATTERN diagnostics. This closes the
long-standing “executable but unwired” control debt without pretending that a static
design document has repaired it.

### 1.4 Managed Testcontainers technical-validation contract

After all 196 static rows are implemented and have passed the row-by-row
design-conformance reconciliation, remote managed Testcontainers—not local Docker and
not browser L2—runs one exact-coverage test plan. The independent implementation
review remains the final review over the complete static-plus-dynamic delivery.
It deliberately groups compatible operations into the fewest scenarios that can share
fixture setup, owner boundary and isolation safely; there is no one-container or
one-test-per-operation rule. A scenario records the complete set of operationIds it
executes, and the report still emits one request/event-joined, HMAC-validated row per
operation containing DB count, kindCounts and UPDATE. Grouping is forbidden only when
shared state would change an operation’s authorization, fixture precondition,
transaction/readback assertion or cleanup precision. A missing canonical operationId,
an unmatched event, a failed scenario, a missing terminal manifest, a stale
container/volume or cleanup failure blocks the entire technical package.
`business=PASS` is exactly 196/196 successfully covered technical operation rows;
`cleanup=PASS` is a separate owned-resource proof. Only then can the separately
authorized local-L2 and reset/seed packages be admitted. Browser L2 has a separate
local-application/managed-tunnel/Journey manifest and is never implied by this
technical contract.

### 1.4.1 Mandatory post-Testcontainers execution map: local L2 before DEV seed

This design deliberately distinguishes technical coverage, browser evidence and DEV
experience data. Dexter's final-delivery order is **static 196 closure → row-by-row
design-conformance reconciliation PASS → remote Testcontainers 196/196 business+cleanup
PASS → local managed L2 business+cleanup PASS → destructive reset → managed DEV start →
r5-full seed and same-basis comparison → one independent IMPLEMENTATION review →
Dexter and Claude review**. L2 is before seed because it owns a private, isolated
fixture and must neither consume a seed database nor lend its runtime data to seed;
seed creates persistent DEV experience facts only after API and L2 evidence close.
This implements `doc/decisions/2026-07-24-v2s-verification-governance.md` §8 rather
than treating a seed as an API or browser fixture.

Before any future dynamic package starts a command, its owner must read, in this
order: `AGENTS.md`; that package's active input/manifest and authorization;
`scripts/README.md`; `.agents/skills/cs-managed-runtime-execution/SKILL.md`;
`project-memory/operations/dev-command-separation.md` and
`project-memory/operations/phase-retrospective-and-systemic-repair.md`; the named
runner source; and the immediately prior terminal run manifest. A static checker or
dry-run is not a runtime substitution. Every runner must first call
`scripts/env/check-runtime-resource-budget` for its run-scoped runtime root and must
not identify, stop, or reuse work by port, process name or a guessed PID.

| Stage | Only allowed entry and topology | Required preflight and terminal evidence | Forbidden substitution |
| --- | --- | --- | --- |
| 196 technical proof | Future exact-coverage plan through `scripts/test/r5-remote-testcontainers.mjs`; JVM/Docker are on the managed remote technical plane. | No prior `org.testcontainers=true` container/volume; runner source/plan/fixture hashes; 196 request-event rows; `business=PASS`, owned container/volume/process cleanup and terminal manifest `cleanup=PASS`. | Local Docker/Colima, DEV database, browser, or treating it as L2/UAT. |
| Local managed L2 | `node scripts/test/catalog-inventory-l2.mjs --managed`, which delegates to `scripts/test/r5-joint-remote-l2.mjs --catalog-inventory`; Spring Boot, both admin apps and Playwright run locally and use only the managed tunnel to an isolated remote namespace. | The L2 runner's private fixture and its own run ID/manifest/logs; local PID/start-token and tunnel identity; remote database/asset namespace readback; separate `business` and both-side `cleanup` PASS. Its existing child `catalog-inventory-backend-unit` is a narrow API preflight, never a replacement for the prior 196/196 technical report. The no-`--managed` form is fixture-only and cannot close L2. | Remote browser/app/Vite, a persistent DEV namespace, Testcontainers report, seed report, or a manually started local service. |
| Destructive reset | `R5_RESET_CONFIRMATION=EXPLICIT_R5_RESET node scripts/dev/r5-reset.mjs`; the runner may stop only the prior manifest-owned local DEV tree, then executes the exact non-production remote namespace reset. | Validate manifest PID/start token and trusted non-production host/database allowlist; preserve the reset manifest/log; require terminate, drop, absence readback and asset cleanup markers. | Bare `psql`, manual SSH/SQL, a guessed DB/asset prefix, or stopping unknown processes. |
| DEV seed and comparison | After reset terminal PASS, start only via `scripts/dev/r5-dev-runner.mjs start`, then `R5_SEED_CONFIRMATION=EXPLICIT_R5_SEED scripts/dev/seed --profile r5-full`; bind the resulting immutable seed report to an eligible baseline with the same report kind/basis. | DEV manifest/readiness; owner HTTP/readback evidence; seed business status plus separately reported cleanup ownership; two immutable `reportKind=SEED` reports; comparator accepts exact coverage/basis/profile and rejects lowered aggregate UPDATE. | Seed-on-start, Testcontainers/L2 fixture reuse, direct SQL, cross-kind comparison, or calling seed PASS L2/UAT/performance success. |

At every dynamic stage retain the first failure, last known good phase, broken boundary,
run-scoped manifest and structured redacted log. While it runs, report concrete progress
at least every 30 seconds; after one stalled interval inspect its log, PID tree,
container/runner state, and after a second equivalent signal diagnose before any retry.
Business and cleanup are independently terminal: neither PASS upgrades the other.

### 1.5 One detailed-design review, one post-validation whole-delivery review

This is the only implementation-facing design review for this optimization scope. A
fresh independent DESIGN verdict and Claude's review happen **before** any future
implementation package is admitted. The ensuing implementation is one serial,
complete delivery of BPF-U01 through BPF-U06: no review checkpoint is inserted between
units, and a unit's mechanical proof is not relabelled as an intermediate review.
After static 196 closure, the implementation lead must perform a row-by-row
**design-conformance reconciliation** against the two operation catalogues, source
inventory, shape matrix and redline checklists. That reconciliation is an author
evidence control, not an independent review and not a substitute for one. A fresh
independent IMPLEMENTATION review follows only after the authorized Testcontainers,
local L2, reset/DEV/seed and same-basis comparison evidence is complete; Dexter and
Claude receive the final handoff after that review.

If implementation reopens a source and finds a design/source mismatch, the owner of
that operation records an `IMPLEMENTATION_FACT_CONFLICT` with the old row, exact
source/evidence anchors, affected operation IDs, and the smallest redline-preserving
correction. It may adjust the row or implementation within the existing one-package
scope, but may not skip an operation, create a side batch, weaken an assertion, or
start dynamic validation. The mandatory static gates and source reread discipline
continue through the correction; its adequacy is challenged in the single final
IMPLEMENTATION review, rather than by an invented mid-delivery review.

Dexter grants implementation agents all authority necessary to complete this one
delivery and its declared evidence chain. They do not stop to request a new Dexter
approval for a reasonable, redline-preserving source/control/test/report/managed-runner
action that is needed to close an admitted row or an evidenced
`IMPLEMENTATION_FACT_CONFLICT`; they record the scope, reason, affected rows and
proof instead. This delegation does **not** permit an external HTTP/API expansion,
weakened owner/correctness rule, bypassed gate, unowned process/resource operation or
an out-of-order dynamic step. Testcontainers, reset/seed and local L2 still begin only
when their preceding package conditions are PASS and through their declared managed
entries; once those conditions hold, their approved package owners proceed without a
second permission request.

## 2. Architecture and reusable abstractions

### 2.1 Authority, problem and non-claims

This is the single design for the next backend-performance implementation package;
the current design-only package does not itself authorize implementation or a dynamic
run. Dexter's subsequent delivery authorization permits the new implementation session
to admit required managed dynamic packages only after static 196 closure and the
row-by-row design-conformance reconciliation described in §1.5. Its numeric baseline
and allocation are
the independent figures in
`doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-requirements-claude.md`.
The current observed 3,216 database operations and the 1,400–1,600 floor-derived
range are respectively a measurement and an estimate, never a success claim.
No uncontrolled seed, L2, UAT, runtime, DEV, reset, deployment, Testcontainers,
manual SQL or SSH is authorized by this document. Dynamic execution is allowed only
through the ordered, newly admitted managed packages in §1.4.1 after static
conformance; it remains forbidden before then.

The objective is a permanent, fail-closed operation-shape discipline: a newly added
backend operation must declare its database shape, transaction origin, fact loaders,
budget components and evidence obligations before it can pass the relevant static
gate. It applies to the exact current denominator, and to every future binding added
to the canonical registry.

The 196 rows are the mandatory migration baseline, not a closed feature list. Every
future backend operation follows the same admission lifecycle before its source
package can be created: (1) canonical operation-handler binding and consumer face;
(2) one per-operation design-contract row with owner/edge/transaction/facts,
correctness constraints, component budget, acceptance and red discriminator; (3)
independently generated source-inventory row verified against actual source; (4)
shape-matrix row referencing that inventory; (5) profile-specific static gate and
managed Testcontainers plan row. An operation missing any link fails closed. A new
route, controller method, adapter, transaction origin or fact-loader caller that has
no admitted operation identity also fails closed. This is deliberately a reusable
backend design standard, not a finite remediation workflow.

For the current 45 non-M1 commands, present-source evidence is additionally bound to
`doc/review/platform/2026-08-11-v2s-backend-performance-final-optimization-cur-anchor-rederivation.json`.
It reapplied `EDGE_DECLARED_OWNER_PROTOCOL_FIELD_CALL_V1` to all **45/45** rows:
reopen the HTTP edge method; select the call on its declared injected owner/protocol
field; derive that field type and called method; never select the last arbitrary
argument method reference. The result is **4/45** `cur.tx`/`cur.chain` mismatches,
**41/45** matches, 0 derived `app/edge/**` anchors and 0 anchors outside
owner/protocol application/API packages. The four corrections are
`createPlatformGroupWorkspace`, `transitionPlatformGroupWorkspaceStatus`,
`updatePlatformGroupWorkspaceDisplay` and `transitionWorkspaceAccountStatus`; their
catalogue entries are corrected before BPF-U01 consumes them. The report is not
future machine authority: BPF-U01 reruns the rule and permanently rejects an absent,
ambiguous, `app/edge/**`, or out-of-owner/protocol derived anchor.

This deliberately distinguishes dispatch from physical transaction proof. Under the
specified direct-field rule, `initializeCommercialGroup` and `stagePlatformAsset`
remain valid public API dispatch anchors; their interface/delegating implementation
is later classified as `ORIGIN` or `JOIN_EXISTING_REQUIRED_PARTICIPANT` by the source
inventory. Rejecting a valid public API dispatch merely because it delegates would
create a different, unsupported rule; accepting it as an origin would be equally
wrong.

The implementation retains HTTP request/response field sets, response shape,
idempotency, CAS, audit, locks, owner authorization/state rechecks, typed error
precision and necessary final owner readback. It does not use request/global caches,
cross-schema broad joins, direct cross-owner reads, new HTTP/OpenAPI endpoints,
generic cross-owner APIs, front-end behavior changes, or BP-U06 changes to improve a
count. A named existing-module owner method may be refined only when it preserves the
same HTTP contract and is declared in the source inventory/shape proof; it is not a
license to introduce a generic facade or a new external API.

This design is intentionally not complete until its two exact per-operation catalogues
are bound: `...-command-operation-catalog.json` for all 113 commands and
`...-read-operation-catalog.json` for all 83 reads. Every row must state its actual
owner/route/adapter/source anchor, target change (or explicit no-change reason),
transaction/fact/receipt/readback constraints, component floor, acceptance and a
source/event red discriminator. A closed template can remove repeated prose, but a
row must explicitly select and parameterize it; an implementation agent must never
infer a transaction, owner call, loader, query or acceptance condition from a name.

Before either catalogue can be relied on for implementation, the design review input
also contains `...-operation-source-read-ledger.json`: an exact 196-row, human
source-reading record. Each row records the reopened production anchors, business
meaning, owner/transaction boundary, fact/readback or failure behavior, applicable
project-memory/redline IDs, and any `GAP_*` that prevents inference. It is review
evidence for the present design, not a future source-admission authority: the later
generated source inventory remains the only machine source authority. The ledger
exists so a future implementer cannot substitute a registry-name guess for the
required per-operation source and rule reading.

### 2.2 Fixed denominator and source of truth

`contracts/registry/operation-handler-bindings.json` is the denominator: 196
operations, comprising 113 COMMAND and 83 READ. COMMAND partitions are exactly:

| Profile | Count | Existing control source |
| --- | ---: | --- |
| workspace execution / owner command / REQUIRED | 68 | M1 execution matrix |
| platform owner command | 20 | command topology |
| platform protocol | 9 | command topology |
| workspace protocol | 7 | command topology |
| public protocol | 9 | command topology |
| task read | 78 | task-read policy |
| protocol/content read exemption | 5 | task-read policy |

The independently generated
`contracts/registry/backend-performance-operation-source-inventory.json` is the
source-admission denominator. It is hash-bound to canonical operation bindings and
the generated route/face registries, then source-verified against the actual HTTP
entry, composition/binding bridge, transaction origin and named owner API call chain.
It is generated and checked **before** the shape matrix; it is never derived from the
shape matrix. Its exact-set generator rejects an added/substituted/orphaned source
path or an operation with no real HTTP entry. A future operation therefore needs both
a canonical binding and a source-verified inventory row before a shape declaration
can name it. The shape matrix can consume inventory IDs and hashes only; it cannot
authorize a Java path, helper or call chain by itself.

The future `contracts/registry/backend-performance-operation-database-shape-matrix.json`
is then an exact 196-row join to both the canonical binding registry and the source
inventory, hash-bound to both. A row cannot be inferred from a route, class name,
profile or budget. It declares:

```text
operationId, mode, profileId|readDisposition, shapeClass,
sourceInventoryRef{inventoryRowId, inventoryDigest},
transactionOrigin{kind, propagation, inventoryTransactionOriginRef},
factLoaderRefs[], budget{components, derivedFloor},
aboveFloorExplanation?, topologyRefs, finalReadbackDisposition,
ownerCount, measurementDisposition
```

`shapeClass` is closed: `OWNER_COMMAND_SINGLE_OWNER`,
`OWNER_COMMAND_CROSS_OWNER`, `PROTOCOL_COMMAND`, `TASK_READ`, and
`PROTOCOL_READ_EXEMPT`. All five exemptions still own a row with
`budgetDisposition=EXEMPT_COMPLETION_EVIDENCE_REQUIRED` and a nonempty reason;
there is no missing-row exemption. The **inventory**, not the matrix, owns the closed
`factLoaders` catalogue: each loader supplies `loaderId`, physical source anchor,
stable runtime call-site prefix, invocation pattern and finite allowed callers. A
matrix row can only reference that `loaderId`; each operation maps it at most once per
request. The matrix has no literal Java path field.

Unknown, duplicate, unjoined, missing or mismatched rows fail. The next
implementation package must regenerate and compare canonical-binding, source-
inventory and shape exact sets before it permits any source change. Static scanning
also rejects an actual HTTP entry, transaction origin, declared binding bridge or
fact-loader caller absent from the inventory; no simultaneous matrix edit can hide
that bypass.

### 2.3 Shape floor: components, not a global cap

No row is judged by one global database-operation limit. Each row declares physical
components and a formula selected by its shape. A normal single-owner command with a
required final readback has one connection, two transaction events, one fresh
context-fact load, one receipt claim when idempotency applies, `N` intrinsic owner
writes and one final readback: `6 + N`. A valid `NO_CONTENT` command omits only the
last component, yielding `5 + N`; the two current no-content M1 commands must remain
valid rather than be falsely rejected.

A cross-owner command declares each real owner and its required recheck/readback;
its range is `6..8 + N` when a final readback exists (`5..8 + N` only when the
contract is genuinely no-content). It must not fold owners into a cross-schema query.
Protocol rows use their actually declared receipt/readback components; the current
public protocol `TRANSACTION=2, CONNECTION=1` is an existing lower-bound witness,
not a rule to delete semantics elsewhere. Task reads declare primary query, optional
query, context facts and transaction disposition, yielding the documented `3..6`
shape range.

When a normal-path declared budget is above its derived shape floor, it remains
allowed only with a row-local explanation of user task, cardinality, query chain and
owner reason. This implements `TASK_READ_BUDGET_REQUIRES_EXPLANATION`: it is a review
prompt, not a generic mechanical ceiling.

### 2.4 Permanent assertions and control plane

The implementation appends, without replacing existing redlines, these assertions to
`project-memory/decisions/http-crud-efficiency-design-redlines.md`:

1. `ONE_REQUEST_ONE_TRANSACTION_ORIGIN`: an HTTP command path declares one origin;
   edge code never creates a transaction and participating owner calls do not start a
   second origin.
2. `REQUEST_LOCAL_FACT_LOADED_ONCE`: fresh authorization/session/path facts are
   minted once in a named request-local origin and passed as immutable facts; this is
   not caching and never bypasses a current owner recheck.
3. `OPERATION_DATABASE_SHAPE_DECLARED`: a registry operation has a complete,
   source-anchored shape and component formula before source admission.

`contracts/policy/standards-coverage-matrix.json` will register mechanical predicates
as `GATE` with a checker reference. Necessity of a particular owner readback,
preservation of a typed domain failure, and whether a validation predicate can be
folded without semantic change are `UNENFORCEABLE_BY_MACHINE` with an explicit review
checklist reference; they must not be misrepresented as automated proof.

The first assertion has one additional permanent source-inventory predicate: a
non-M1 current-chain anchor is an owner/protocol dispatch anchor, never an
`app/edge/**` helper. The checker derives it from the declared field call above, not
merely by verifying that a stored `path#method` happens to compile or carries a
transaction annotation. A red fixture changes a selected owner-field invocation into
an arbitrary argument/helper reference and must fail before any origin-convergence
source change.

### 2.5 A — transaction and connection origin convergence

For every command profile, the matrix names a single `REQUIRED` transaction origin
or the documented protocol form. Edge controllers have no `@Transactional` entry.
The 68 M1 operations converge on their existing per-operation composition adapters;
all 68 HTTP controller entries call their matching generated binding method. This
resolves M1 S-01 by making the generated binding the sole declared edge bridge, not a
dead declaration. The binding makes exactly one same-operation adapter invocation;
the adapter begins the required transaction and calls only named public owner APIs.

The corresponding 42 non-catalog controllers must be migrated from direct adapter
calls to their declared generated binding methods. The matrix’s `edge.httpEntryAnchor`
must be found in an actual HTTP entry, and every declared binding must have at least
one such reference. Conversely, a direct adapter call at a declared binding edge is
a failure. This check is source/reachability structural only; it does not alter HTTP
shape or runtime behavior.

For non-M1 and read rows, the future shape matrix declares the one valid origin. A
second `@Transactional` command start, a controller transaction annotation, or an
undeclared origin is rejected. Owner recheck remains before receipt replay; this is
not permission to move replay earlier.

`REQUIRED` on a public owner participant is not, by itself, evidence of a second
transaction: it may join the declared origin. The inventory therefore classifies each
transactional method on the operation path as `ORIGIN` or
`JOIN_EXISTING_REQUIRED_PARTICIPANT`. The static check rejects an edge origin,
`REQUIRES_NEW`, `NESTED`, `TransactionTemplate`/manual begin, or an unclassified
transactional path; it must not falsely reject a named participant that joins the
origin. The immutable technical report then checks the physical normal-path shape:
one connection and one begin/complete transaction event pair for a normal command,
except for a matrix-declared protocol form. That distinction prevents source syntax
from being mistaken for proof of a runtime transaction boundary.

### 2.6 B — fresh facts loaded once per request

The fact-loader catalogue is complete rather than hard-coded to today’s examples.
It includes the current repeat families such as
`OrganizationVisibilityService#resolveSessionEntryFacts`,
`WorkspaceAuthenticationService#require`, `OrganizationTaskPathService#node`, and
`OrganizationCommandService#requireCommercialGroup`, but source scan must discover
and classify every declared loader/caller pair. A loader cannot be called from an
unlisted production caller. Immutable fact records may carry values between an edge,
composition adapter and public owner API; they never substitute for the owner’s
current authorization/state recheck.

At runtime, after immutable evidence is produced, the new snapshot checker groups
`db-operations.jsonl` events by `(runId, requestId, loaderId, callSitePrefix)`. More
than one matching event is a red failure; an unknown/missing loader attribution is
also red. It consumes the HMAC-validated immutable snapshot, never a live `.runtime`
file. Line numbers are not trusted as identifiers: the stable `Class#method:` prefix
is the catalogue binding.

This is intentionally a **retrospective runtime control**. Static admission proves
that every known production loader invocation has an admitted catalogue/caller and
that every operation declares its loader set; it cannot prove one execution path only
invoked a loader once. A future operation with an undeclared caller is stopped at
edit time, but a permitted caller that executes twice is proved red only by the
HMAC-validated Testcontainers/seed immutable event snapshot. No design, gate or
handoff may claim the latter is an edit-time guarantee.

### 2.7 C — fold validation reads into owner writes only when equivalent

Each candidate fold receives an owner-local proof record in the shape matrix and a
review checklist entry. The record is incomplete—and the fold is forbidden—unless it
names (1) the exact **folded judgment**, (2) its original observable semantics,
(3) an executable/focused **failing counterexample** that would distinguish an
incorrect fold, and (4) the source/readback/error evidence proving preservation. The
owner must preserve the same target selection, current
fact/state check, CAS predicate, lock scope, affected-row outcome and typed failure
classification. A fold is rejected if it crosses an owner/schema boundary, turns an
owner readback into edge data access, removes a required final readback, changes an
audit/receipt order, or weakens a zero-row/not-found/conflict distinction. SQL form
(predicate, CTE or other owner-local form) is an implementation choice only after
that proof; no generic repository or cross-schema shortcut is introduced.

### 2.8 Static and runtime enforcement design

The next package adds a source-of-truth generator/validator for the operation-shape
matrix and exposes it through the mandatory backend-performance gate. It joins all
196 registry rows with the existing 113 command topology, 68 M1 execution matrix and
83-row read policy. It fails closed for missing topology, shape, budget component,
formula, source-inventory reference, future-operation row, unknown profile/disposition, duplicate
row, unreferenced binding or absent above-floor explanation.

Named failures include WHY, BACKGROUND and PATTERN. At minimum there are real red
mutations for: a missing shape row; wrong floor component; edge transaction
annotation; a second origin; a loader call from an unlisted caller; a duplicated
same-request loader event; a dead M1 binding; unknown loader attribution; report
basis/coverage mismatch; missing UPDATE totals; and lower UPDATE totals. The
implementation must prove each mutation changes the intended verdict, not merely
exercise a parser branch.

The task-read checker remains separate for task semantics. Before it gains shape-row
joins, BPF-U05 repairs and proves its existing command-anchor baseline: its former
single `OperationsWorkspaceUserController#revoke` anchor is replaced by the exact
five HTTP entry methods `groupRevoke`, `regionRevoke`, `projectRevoke`,
`headCompanyRevoke` and `storeRevoke`, with a red mutation for a lost member. The
existing read-budget check must pass on that finite replacement before any new shape
join is admitted. It never becomes a universal count cap. The existing M1/command
coverage checker owns command topology/binding reachability. A new static
`scripts/check/backend-performance-operation-source-inventory` owns independent
route-to-source closure, `scripts/check/backend-performance-operation-database-shape`
owns the 196-row formula join, and
`scripts/check/backend-performance-request-fact-load-once` owns the immutable
snapshot event invariant.

### 2.9 Measurement comparison, not premature success

`scripts/test/seed-report.mjs` will retain its existing measurement basis while
adding per-operation and aggregate physical `kindCounts`, including `UPDATE`. A new
`scripts/test/compare-backend-performance-seed-reports.mjs` accepts two immutable,
same-basis reports and emits per-operation deltas plus profile aggregates. It rejects
different measurement basis, route/operation/profile coverage mismatch, duplicate or
malformed endpoint data, absent UPDATE counts, and any lower aggregate UPDATE total.
It does not update `BP_U07_SQL_MERGE_SUCCESS` or `BP_U07_SNAPSHOT`; before a valid
comparison it only reports evidence absence. A seed PASS is neither L2 nor UAT PASS.

The same formal schema closes focused remote Testcontainers technical proof. The
managed `r5-remote-testcontainers` runner must, for each completed test plan, emit a
run-scoped immutable report bound to: test-plan/source hash, test selector, fixture
identity, measurement schema/basis, exact invoked operation set, request/completion
join, per-operation `databaseOperationCount` and `kindCounts`, aggregate UPDATE, and
separate technical business/cleanup statuses. It may be compared only with another
Testcontainers report whose plan, fixture, operation coverage and basis all match;
it must never be compared to a seed report or called L2/UAT. Missing event capture,
an unmatched request, stale Testcontainers resources, missing terminal manifest or
cleanup failure yields an incomplete technical report rather than a numeric result.
The comparator has a `reportKind`-specific contract (`SEED` or
`REMOTE_TESTCONTAINERS`) and rejects cross-kind comparison. This makes each focused
Testcontainers run a durable, comparable technical artifact while preserving the
separate managed-runner resource/cleanup boundary.

The existing `backend-performance-final-fixture-catalog` is the finite fixture and
owner-HTTP/OpenAPI predecessor for that plan, so BPF-U06 owns it before any runner
work. Its current `BP_FINAL_FIXTURE_PLAN_OWNER_HTTP_OPENAPI_DRIFT` is an explicit
static precondition, not an unrelated green assumption: first reconcile the 196
owner-HTTP declarations to the authoritative OpenAPI method, path, transport, success
status, readback key and source anchor; then prove its checker and real red mutation
are green; only then extend the catalog with grouped scenario membership and formal
report linkage. A runner, manual operation list, or post-hoc report cannot repair this
fixture/source drift.

## 3. Exact 196-operation design and serial implementation units

The two checked-in catalogues are the per-operation implementation authority for this
design: `doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-command-operation-catalog.json`
contains 113 COMMAND rows and
`doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-read-operation-catalog.json`
contains 83 READ rows. Together they exact-join the canonical binding set. Each row
names its actual route/edge/adapter/owner/policy anchors; selects a closed reusable
template; explicitly gives A/B/C applicability or N/A reason; carries transaction,
fact, receipt/readback and budget constraints; and names acceptance plus red
discriminator. `GAP_*` / `G1` / `G2` rows are mandatory source-reopen work before
implementation and cannot be filled by template inference. This is how abstraction
removes duplication without allowing agents to guess.

Before **any** application source is changed, a serial BPF-U01 admission sub-step
closes the present decision gaps with a dedicated catalogue amendment and one
independent review receipt: all **87**
`GAP_OPERATION_LEVEL_IDEMPOTENCY_NOT_DECLARED` decisions and all **45**
`GAP_OPERATION_LEVEL_READBACK_NOT_DECLARED` decisions receive an explicit
operation-level disposition (existing protocol, owner receipt, no receipt with a
source reason; required readback, valid no-content, or source-preserved response).
The 45 non-M1 `ORIGIN` versus `JOIN_EXISTING_REQUIRED_PARTICIPANT` classifications
receive the same source evidence before mechanism-A edits. These are not template
defaults and cannot be decided while modifying an adapter. Missing/ambiguous rows,
or a catalogue amendment lacking the independent review receipt, blocks all BPF-U02+
source admission.

The accompanying 196-row source-read ledger is the required review receipt for
these catalogues. A reviewer must be able to trace every catalogue operation through
one ledger row to reopened source and a named applicable memory/redline rule; a
missing, duplicate, or differently named operation is a design finding. Its gaps are
not defects silently repaired in prose: they become explicit prerequisite work in the
implementation unit that owns the affected source boundary.

The current 45 non-M1 command catalogue `adapter` values are declared operation type
identities, not Java source anchors. Each is now explicitly marked
`GAP_ADAPTER_SOURCE_ANCHOR` in the ledger: current source proof is only the physical
HTTP edge and current named owner/protocol entry. BPF-U01 must inventory that real
edge-to-owner origin as such; it must never invent a path from the FQCN. BPF-U02 may
create a concrete composition adapter only where source reread shows it is needed for
the one-origin design, then replaces the gap with the resulting physical
`path#method`; otherwise the matrix records the existing named owner origin. A FQCN,
profile or template is never sufficient source-admission evidence.

### 3.1 One package, serial implementation units

These are ordered delivery units within one future implementation package, not
separate optimization batches. A later unit may not mask a failure in an earlier
unit, and no dynamic validation begins before static 196 closure and row-by-row
design-conformance reconciliation.

The implementation lead executes the following exact order in the one package. Each
step first reopens its row-local ledger source/memory/redline evidence; then changes
only the admitted surfaces; then runs its focused compiler/checker proof and records
an incremental receipt. These are construction controls, not review rounds:

1. **BPF-U01, control plane first:** (a) correct and mechanically rederive the 45
   non-M1 current-chain anchors; (b) complete the 87 idempotency, 45 readback and 45
   origin/participant catalogue decisions and obtain their one independent receipt;
   (c) install the global required closed mandatory-gate profile control plus its
   template compatibility proof; (d) generate the independent 196-row inventory;
   create the shape matrix, loader catalogue, three redlines and standards entries;
   and (e) add all matrix/inventory/floor/control-plane red mutations. It must close
   before any application path is admitted.
2. **BPF-U02, command bridge/origin:** make all 68 M1 HTTP entries call their exact
   generated bindings; declare and source-prove one origin/participation path for all
   113 commands. Preserve the current HTTP contracts and fail direct-adapter,
   edge-origin and dead-binding mutations.
3. **BPF-U03, facts:** consolidate each declared fact loader at its named origin,
   pass immutable request facts only where the matrix permits, preserve every current
   owner recheck, and close static caller plus immutable-snapshot duplicate controls.
4. **BPF-U04, owner-local folds:** process only rows with a completed owner
   equivalence record. For each, retain all target/CAS/lock/audit/receipt/error/final
   readback behavior in focused proof; a row without that proof remains unchanged,
   above-floor and explicitly explained rather than guessed.
5. **BPF-U05, reads:** first repair the finite five-revoke baseline, then bind all 78
   task reads and five exemptions to the common matrix. Read paths stay receipt-free
   and write-transaction-free; their above-floor reasons remain individual.
6. **BPF-U06, evidence before dynamic:** implement report kind totals, formal grouped
   Testcontainers plan/report schema and same-kind comparators with all red fixtures.
   First repair and prove the current 196-row owner-HTTP/OpenAPI fixture catalog
   closure; then attach the grouped scenario membership/report plan to that verified
   fixture denominator. Complete static compile/checker/package-exit closure for the
   whole 196 rows; do not start Testcontainers yet.
7. **Design reconciliation, ordered dynamic packages, then one implementation review:**
   compare all 196 completed rows against the approved catalogues, source inventory,
   shape matrix, required red mutations and redline checklists; a mismatch is an
   `IMPLEMENTATION_FACT_CONFLICT` and must be corrected before dynamic admission.
   Then run the distinct 196/196 Testcontainers package; only after its business and
   cleanup PASS run the separately authorized local managed L2 package; only after
   its business and cleanup PASS run the separate destructive reset → DEV start →
   seed-comparison package. The L2 fixture is private and is never replaced with, or
   fed by, a seed runtime. After those dynamic evidence packages close, obtain the
   single independent IMPLEMENTATION verdict over the complete delivery and submit the
   final review handoff to Dexter and Claude.

The terminal validation order is mandatory and has no shortcut:

1. static implementation closure for all 196 operation rows and row-by-row
   design-conformance reconciliation PASS;
2. one managed remote Testcontainers technical-validation package whose grouped,
   exact-coverage plan invokes **196/196** operations, emits the formal report row
   for each and closes its own resource cleanup;
3. only after that technical package is PASS, a separately authorized local managed
   browser L2 Journey package runs from its own fixture, isolated namespace and
   manifest; it is not created by a seed;
4. only after local L2 business and cleanup PASS, a separately authorized destructive
   `R5_RESET_CONFIRMATION=EXPLICIT_R5_RESET` reset → managed DEV start →
   `R5_SEED_CONFIRMATION=EXPLICIT_R5_SEED` same-basis `r5-full` seed package may
   produce the seed report pair/comparison;
5. only after all prior static and dynamic evidence closes, one fresh independent
   IMPLEMENTATION review and the final Dexter/Claude review handoff occur.

The Testcontainers admission requires exact operation coverage, not a percentage:
every canonical operationId has one managed test-plan scenario, source/fixture hash,
request/completion join and report row. `business=PASS` requires 196/196 successful,
request/event-joined operation report rows, every referenced grouped scenario PASS,
and report completeness; `cleanup=PASS` additionally requires
the remote Testcontainers runner’s owned containers, volumes, process record and
terminal manifest to close. Any skipped/unknown/unmatched row, failed scenario or
cleanup failure blocks seed admission. Testcontainers remains technical proof, never
browser L2/UAT evidence.

| Unit | Source-owned change | Completion discriminator |
| --- | --- | --- |
| BPF-U01 | Add the 196-row shape matrix, loader catalogue, three redlines and standards registration. | A new registry binding without a shape row is rejected. |
| BPF-U02 | Extend command/read topology checks; migrate all 68 M1 HTTP entries to generated bindings; declare one command origin. | Replacing one bound controller call with a direct adapter call makes reachability red. |
| BPF-U03 | Consolidate request-local fact minting and owner transaction participation across all command profiles. | A second origin or unlisted fact-loader caller is red. |
| BPF-U04 | Apply owner-local validation-read folds only to matrix-approved rows and retain typed failure/readback evidence. | A fold that loses an expected zero-row/conflict/readback outcome is rejected by focused owner proof. |
| BPF-U05 | Join all 78 task reads and 5 exemptions to the shape matrix; preserve read-only rules and above-floor explanations. | Missing exemption reason or an unapproved read shape is red. |
| BPF-U06 | Add immutable snapshot fact-load-once validator, report kind totals and two-report comparator. | Duplicate same-request loader event or lower UPDATE aggregate is red. |

All actual Java/controller/owner paths are admitted only from the matrix’s exact
source anchors in the future implementation package; no broad module/app directory
admission is permitted. Known M1 controller surfaces are the eight
`Operations*Controller` classes already named in the M1 matrices, but the 196-row
matrix—not this document—forms the finite source list for all other profiles.

### 3.2 Exact future surfaces and verification sequence

Future implementation updates: the compliance-control mandatory-gate closure and its
template compatibility fixtures; the redline and standards matrix; command topology,
the redline and standards matrix; command topology,
M1 execution and task-read policy registries; M1 binding and coverage generators;
task-read policy generator/checker; seed-report producer/test; the remote
Testcontainers runner/test and its formal report producer; and the admitted
source anchors derived from the new shape matrix. It creates the shape matrix, its
static checker and test, the immutable request-fact checker and test, and the
two-report comparator and test. `scripts/check/backend-performance-sql-merge-coverage`
becomes the unified command/topology invocation point, but does not absorb task-read
semantic ownership or falsely report dynamic success.

Static sequence: mandatory-gate/profile compatibility red mutations → exact
idempotency/readback/origin gap review → schema/generator red mutations → exact
source admission → focused compile/tests → mandatory topology/shape/read checks →
row-by-row design-conformance reconciliation → separate 196/196 managed
Testcontainers technical package → separately authorized
local managed L2 package with its own fixture/manifest → separate explicit reset →
managed DEV start → r5-full seed comparison package → fresh independent IMPLEMENTATION
review → Dexter/Claude final review. No later stage upgrades an earlier one; L2 never
consumes seed runtime state.
No later stage upgrades an earlier one. A first failure is diagnosed from its
manifest/log boundary; no repeat or timeout extension substitutes for diagnosis.

### 3.3 Review questions

Independent review must challenge whether a matrix declaration can be bypassed,
whether `NO_CONTENT` and protocol shapes are treated faithfully, whether a
request-local fact record accidentally becomes a cache, whether owner-local folds
preserve every error/readback, whether 68/68 binding reachability is mechanically
proved, and whether the report comparator can produce an honest before/after result
without claiming L2/UAT. Claude’s review decides design GO/NO-GO only; it does not
authorize implementation or dynamic execution.
