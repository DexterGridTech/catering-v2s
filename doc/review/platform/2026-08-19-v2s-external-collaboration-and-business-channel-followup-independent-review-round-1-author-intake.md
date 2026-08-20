# R5 external collaboration and business channel implementation follow-up

REVIEW_CYCLE_ID=R5_EXTERNAL_COLLABORATION_IMPLEMENTATION_FOLLOWUP_2026_08_19
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=AUTHOR_INTAKE_AFTER_INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-followup-independent-review-round-1-input-checklist.md
independentVerdict=doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-followup-independent-review-round-1-verdict.md
authorIntakeStatus=CONFIRMED_S1_PENDING_STATIC_REPAIR

## Intake boundary

This intake reopens the Round 1 verdict against the owning source, the frozen implementation-facing design, the approved contract wording, and the original Journey. It does not treat the independent verdict as an automatic patch list. No dynamic DEV, seed, reset, Testcontainers, browser L2, UAT, or external integration execution was authorized or performed.

## Finding disposition

### S-1 — CONFIRMED

The contract and edge catalog define `queryText` as a case-insensitive server-side substring over binding name, business node display name/path, and node reference. The platform edge enriches a page with `nodeDisplayPath` only after the collaboration owner has already applied SQL `COUNT`, `LIMIT`, and `OFFSET`. The owner-side filtered relation currently exposes only a leaf-like `node_display_name` (`code || ' ' || name`) and does not include the persisted recursive display path in its `WHERE` predicate.

This is a real behavior gap: a token that exists only in an ancestor segment of a region/project/store path cannot match, even though the approved contract says it must. The existing leaf-name acceptance proves only the positive leaf case and is not a counterexample to the ancestor-path case.

### Other Round 1 items — CONFIRMED_STATIC_CLOSED

The reviewer reopened and accepted the previous repair evidence for the selected-store equality guard, the provider status/version mutation and retry behavior, the contract/catalog query description, the ProviderProfile version consumption, and the 60-row acceptance count. Those items are not reopened by this intake.

## Root cause and scope

Failure mode: a server-side paginated search contract was implemented against a pre-pagination projection while a richer presentation projection was added after pagination. The same failure can recur for every supported node type whose display path contains an ancestor segment; it is not limited to one store fixture or one UI screen.

The smallest conforming repair is to add the same recursive organization-path semantics used by `OrganizationTaskPathService.persistedTaskPathsSql()` to the owner-side filtered projection, expose a `node_display_path` column, and include it in the existing SQL predicate. `COUNT(*) OVER()`, ordering, limit, and offset remain on the filtered owner relation. No new endpoint, owner boundary, database constraint, generic search abstraction, or product decision is introduced.

## Required proof updates

1. Extend `CollaborationOwnerContractTest` to assert recursive path projection and the fourth search pattern while retaining SQL-side count/pagination assertions.
2. Extend the existing collaboration acceptance scenario to search an ancestor/path token, not only the leaf token.
3. Re-read the contract, design, organization path source, owner source, test, and acceptance after the focused proof; record any residual mismatch before Round 2.

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787;cs-code-structure-recall

## Static repair evidence

- `./gradlew :apps:backend:catering-business-server:compileJava :apps:backend:catering-business-server:compileTestJava :apps:backend:catering-business-server:modules:collaboration:test --tests com.catering.v2s.collaboration.application.CollaborationOwnerContractTest --no-daemon --console=plain`: PASS (`BUILD SUCCESSFUL`); the production source, test source, and focused owner SQL contract test compile and execute.
- `node scripts/check/external-collaboration-business-channel-contract.mjs`: PASS (`EXTERNAL_COLLABORATION_CONTRACT_PASS systems=4 providers=7`).
- `./gradlew spotlessCheck --no-daemon --console=plain`: the first run failed on two newly expanded collaboration lines plus three pre-existing organization files; after splitting the two collaboration lines, the second run failed only on the same three organization baseline lines. The repaired collaboration module passed `backendJavaUtf8LineLimit`.
- No DEV, reset, seed, Testcontainers, real HTTP, browser L2, UAT, or external integration was run. The acceptance scenario is a fresh route-bound regression for the next authorized dynamic run, not dynamic evidence in this cycle.

The author intake remains `STATIC_REPAIRED_AWAITING_ROUND_2`; Round 2 is required because this is an implementation review cycle and the first independent verdict was NO-GO. No GO is claimed here.
