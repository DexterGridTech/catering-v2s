# Final optimization author adversarial self-audit

`MAXIMUM_AUTHOR_SELF_AUDIT_ROUNDS=5`  
`INDEPENDENT_REVIEW_LIMIT_PER_CYCLE=2`

## Round 1 — admission authority, denominator and test-plan counterexamples

Scope re-opened: current design, design manifest, the two operation catalogues,
canonical bindings, task-read policy, M1 topology/execution and the Round-2 NO-GO.

| Attack | Finite applicability | Result | Prevention/disposition |
| --- | --- | --- | --- |
| A shape-matrix edit substitutes a controller/helper path while retaining 196 rows. | All 196 current rows and every future operation. | Confirmed in the prior wording: the matrix still carried literal physical anchors. | Corrected: inventory is sole physical-anchor/fact-loader owner; matrix has only inventory IDs/digests. Future validator red-mutates literal matrix paths, reference substitution and inventory orphaning. |
| A grouped Testcontainers scenario is mistaken for one operation per test. | All 196 operation coverage rows. | Confirmed wording conflict. | Corrected: each operation has exactly one scenario membership and exactly one report row; scenarios may cover multiple operations; all scenarios and all 196 report rows must pass. |
| A task-read rule silently treats the stale revoke anchor as repaired. | Five workspace revoke HTTP entries. | Confirmed current baseline failure. | Retained as `KNOWN_STALE_PRECONDITION_NOT_REPAIRED`; BPF-U05 must repair the exact five members plus a lost-member red mutation before shape extension. |
| A source gap is completed by profile/name inference. | 87 command idempotency/readback gaps; read G1/G2 gaps and any future gap. | Confirmed risk. | Catalogues require `GAP_*`/`G1`/`G2` source reopen and explicit future declaration; no template may supply an unknown field. |
| A report is called L2/UAT, L2 consumes seed state, or seed starts after partial technical evidence. | Testcontainers, seed and L2 execution classes. | Confirmed historic ambiguity risk. | Technical report remains technical only; 196/196 report coverage plus cleanup PASS precedes a separate local managed L2 with private fixture and separate cleanup. Only after L2 closes may explicit reset → managed DEV start → seed run; seed is a DEV-experience artifact, not L2/API input. |

Round-1 result: five confirmed failure families, all have a bounded design correction.
This is author self-audit evidence, not independent review or implementation
authorization.

## Round 2 — correctness, concurrency and rollback counterexamples

| Attack | Result | Required prevention |
| --- | --- | --- |
| A fold lowers DB count by returning a generic affected-row result. | Rejected: it can collapse not-found, scope, CAS and lock conflicts. | Per-row fold proof preserves target selection, CAS/lock predicate, audit/receipt order, typed problem mapping and final readback. |
| Fact reuse is implemented as cache or reused after authorization changes. | Rejected: it weakens fresh owner authority. | Only immutable request-local facts may travel; owner current recheck remains and runtime duplicate control is per requestId only. |
| A no-content route is forced to `6+N` or loses its protocol contract. | Rejected: it makes a valid response shape look over-floor. | Shape formula records `5+N` no-content branch and literal response disposition. |
| Report/control schema changes strand prior evidence or permit silent rollback. | Rejected: comparison basis would become non-comparable. | Version/basis/hash are required; compatibility is explicit and comparison rejects mixed schema/basis; source behavior is retained until focused proof and package-exit equality. |

## Round 3 — resource, failure and future-interface counterexamples

| Attack | Result | Required prevention |
| --- | --- | --- |
| A grouped Testcontainers scenario leaks state into a sibling operation. | Rejected: grouping would invalidate per-operation numbers. | Group only when fixture, owner boundary, authorization precondition and cleanup isolation match; otherwise split. Scenario manifest declares all members. |
| A failed scenario leaves a seemingly complete 196-row report. | Rejected. | Every report row joins request/event; all referenced scenarios and 196 distinct operation rows must PASS; cleanup is independent. |
| A future controller/adapter appears without an operation identity. | Rejected. | Inventory scanner fails unknown HTTP entry, bridge, origin or loader caller before shape/matrix admission. |
| A reviewer treats a numerical floor as proof a query is necessary. | Rejected. | Above-floor explanation and owner-fold checklist stay review-owned; no global cap or semantic pseudo-gate. |

## Round 4 — catalog completeness audit

The command catalogue exact-joins all 113 COMMAND operation IDs; the read catalogue
exact-joins all 83 READ operation IDs. Each row carries source identity plus selected
constraint template, floor/budget, acceptance and red discriminator. The finite
exceptions/gaps are explicit: no-content, five protocol-read exemptions, 87 command
operation-level idempotency/readback source gaps, read G1/G2 gaps and the stale five-
revoke-anchor precondition. None is treated as an implementation pass.

The final source-reading receipt independently exact-joins all 196 canonical IDs:
113 COMMAND plus 83 READ, with no duplicate, missing or substituted operation. Every
COMMAND record supplies actual edge, adapter and owner method-window anchors
(including the four corrected mutation-owner anchors); every READ record supplies
edge/reader anchors or an explicit protocol-exemption non-inference record. The
ledger is review evidence only, so it cannot silently become a concurrent source-
admission authority.

## Round 5 — closure criteria audit

Before independent review, the design must pass manifest-anchor validation, exact-set
checks for both catalogues and the source-read ledger, static checker self-tests and
diff hygiene. The design contains the one-review/one-delivery rule: one independent
DESIGN verdict now, no review inserted between BPF-U01..U06, and one independent
IMPLEMENTATION verdict only after the full static delivery. Independent review must
then challenge the admission chain, grouped-scenario set relation, correctness
retention, gap handling, implementation-fact-conflict discipline and execution-plane
taxonomy. Claude handoff is prepared only after that verdict; neither review grants
implementation or dynamic authority.
