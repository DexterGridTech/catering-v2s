---
title: RM1 P6-1 observability formal granularity-gate binding design
status: PREPARED_FOR_INDEPENDENT_DESIGN_REVIEW
reviewTarget: DESIGN
reviewCycleId: RM1-P6-U01-FORMAL-GRANULARITY-BINDING-DESIGN-20260730
implementationAuthority: false
---

# RM1 P6-1 observability formal granularity-gate binding design

## 1. Business purpose, Dexter intent and scope

P6-1 exists so an unauthenticated person can safely authenticate or recover access, while the operations entry presents the owning group workspace brand. Its accepted owner-first design already requires secret-safe diagnostics, a managed runner with evidence and the edge-root projection repair. The original user task and invariant are in `rm1-u09-implementation-facing-design-and-three-phase-plan.md` `§3.1--§3.3`; the cross-project acceptance obligation is `2026-07-29-v2s-observability-and-acceptance-standard.md` `§1--§4`.

Dexter made **formal granularity-gate binding** a substantive new design range because the former extension plan could describe correct behavior while its own manifest was rejected before the repository gate examined the denominator. The delivery user is therefore the P6 implementation/review operator: before changing runner, foundation, edge or contract bytes, that operator needs one executable, source-bound declaration that proves which files, assertions, owner boundaries and package-exit evidence are mandatory. This is not a new product Journey, UI or public protocol.

The smaller alternative is a bespoke relaxed checker or a prose-only checklist. It is rejected: a relaxed checker changes project governance and a prose checklist again permits an unvalidated manifest. The recommended solution is one new cycle whose manifest conforms to the existing production schema and binds exactly one future P6-1 observability delivery unit. It reuses the existing checker, source-compliance policy and two-round independent-review protocol.

## 2. Formal binding contract

### 2.1 Identity and authorization

The manifest must use `kind=implementation-facing-design-granularity-manifest`, `status=PROPOSED_REVIEW_ONLY`, `programId=V2S_W0_W4_EXECUTION`, `goalId=RM1_RESTRUCTURE_AND_REMEDIATION`, the existing RM1 design-only authorization artifact, checker script/tool hashes and the existing six-denominator package-exit policy. The candidate delivery unit is capability-named `RM1P6-FORMAL-GRANULARITY-U01`; no Journey/step identifier appears in any future runtime path.

The manifest remains `implementationAuthority=false`. Its `changeSurfaces` are a future implementation denominator only: runner, backend foundation, edge/configuration/tests, edge OpenAPI root and capability invariant. They do not authorize current CP-U11 writes outside the document-only surface, nor UI, generated hand edits, migration, DEV, seed/reset or Roadmap mutation.

### 2.2 Exact source denominator

The unit's six source-compliance entries must be complete and fail closed:

1. `PROJECT_MEMORY_ASSERTION_OCCURRENCES`: the exact six-dimensional routed set for `design/backend/backend/platform/governance/implementation`; each path/hash/`Assertions` selector equals the current generated index result.
2. `APPROVED_ASSERTIONS`: this document `## 1. Business purpose, Dexter intent and scope`.
3. `FORBIDDEN_PSEUDO_FIXES`: this document `## 3. Prohibited pseudo-fixes`.
4. `DETAIL_DESIGN_COMPLETION_AND_INCREMENTAL_CRITERIA`: this document `## 4. Required future implementation proof`.
5. `OWNED_SURFACE_AND_PAGE_KEYS`: `contracts/policy/frontend-asset-carryover-manifest.json` `surfaces and pageDesignKeySurfaceCrosswalk`; it is applicable only to prove this is no-UI scope, not to invent a UI binding.
6. `DUE_STANDARDS_RULE_IDS`: `contracts/policy/standards-coverage-matrix.json` `rules enforcement phase R5`.

Every entry names an owning-source set, a hash and `APPLICABLE`; no copied rule list, `PENDING` or unbound source is allowed.

### 2.3 Production-checker completion required by Round 1

Round 1 independently found that the existing checker recomputes D1 but treats D2--D6 as shape-only metadata. That is a root failure of the formal-binding objective, not a manifest typo: a nonexistent source, stale hash, repeated/missing Markdown anchor, nonexistent JSON field or arbitrary owning-source list could still produce a green gate. The existing production checker must therefore be extended as part of the later authorized implementation; a second relaxed checker is forbidden.

For D2--D6, the checker must reopen every declared source from repository root, compute its real SHA-256, validate every declared selector and compare the normalized `(path, sha256, selector)` owning-source set to the binding. Selector syntax is deliberately finite and mechanical:

- `md:<literal anchor>` means the literal exists exactly once in a UTF-8 text source;
- `json:<RFC 6901 pointer>` means that pointer resolves to a non-empty value in a JSON source;
- a comma-separated selector list requires every member to resolve, and is normalized in declared order.

D1 remains the stricter special case: it is recomputed from `project-memory/index.json` and the six route dimensions, then compared by exact ordered set equality. D2--D6 must add real red fixtures for stale hash, missing source, duplicate/missing Markdown anchor, invalid JSON pointer and owning-source-set mismatch. The no-UI binding specifically uses `json:/surfaces,json:/pageDesignKeySurfaceCrosswalk`, because both concrete fields are required to establish that the unit has no UI surface and no page-key ownership impact.

## 3. Prohibited pseudo-fixes

Formal prohibition completion invariant: a source binding is never replaced by prose; scanner result; or exit code.

- make a second relaxed granularity checker, or bypass `scripts/check/implementation-design-granularity`;
- claim the older observability R1/R2 artifacts are the formal-binding cycle's review evidence;
- replace a real package-exit source set with prose, a static scan, an exit code or a source-string self-test;
- keep the production checker shape-only for D2--D6, or add a side checker instead of completing its real source reopening;
- use an informal or stale field label when the owning JSON has a different actual structured location;
- add runner/foundation/edge/OpenAPI/generated/migration/frontend implementation while CP-U11 is document-only;
- use formal binding to change P6 authentication/recovery wire, owner fact, error semantics or accepted UI;
- hand-edit generated outputs, introduce a flow-named runtime path, or treat any UI page as in scope.

## 4. Required future implementation proof

Formal incremental completion invariant: production validation executes every declared future red fixture.

The future implementation package must make `actualChangedPaths == pre/post receipt paths == non-empty incremental checks`, then prove the existing P6-1 observability design through real production-path controls: 22 fixed public security operations, secret-field rejector and exactly-one terminal event; runner atomic remote control record, heartbeat/log-read/PID reaping/business-cleanup separation; and edge root 35 target refs / target document 35 paths and 40 operations. It must also extend `tools/implementation-design-granularity/cli.mjs` so D2--D6 read their declared sources and validate the finite selector grammar above, with the required real red fixtures. It must execute those validator/test fixtures, not re-label today's source-string self-tests as evidence.

The formal manifest's evidence fields remain design-stage evidence: L1 source/unit-test plan, L2 future generated contract/problem mapping proof, L3 package-exit receipt/gate proof, business is owner-first authentication/recovery invariants, cleanup is `NOT_APPLICABLE_WITH_REASON` until a managed run reports it separately.

## 5. Review and closure

This material scope has its own `RM1-P6-U01-FORMAL-GRANULARITY-BINDING-DESIGN-20260730` cycle. Each independent round receives path+hash inputs and first tries to falsify the formal schema, D1 exact set, source anchors, no-UI boundary and production-gate execution. At most two rounds run. If the second round requires author remediation, `POST_REMEDIATION_V1` binds the immutable reviewed manifest/review/intake and requires Claude recheck; it never claims historical green or implementation authority.
