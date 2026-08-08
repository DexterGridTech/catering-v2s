# P4 acceptance-spec review disposition (Codex)

status: `REMEDIATION_IMPLEMENTED_AWAITING_CLAUDE_RECHECK`
reviewTarget: `DESIGN`
sourceReview: `doc/review/platform/2026-08-07-v2s-catalog-inventory-p4-acceptance-spec-review-claude.md`
boundary: design and policy-input preparation only; no P4 runtime, seed, API, L2, database, migration, deployment or cleanup execution

## Findings disposition

| finding | disposition | repair |
|---|---|---|
| S-01 | `CONFIRMED → CLOSED_PENDING_RECHECK` | `conditionToProblemRef` now uses the real matrix foreign key `(operationId, problemCode)`; nonexistent `conditionId` and invented `OWNER_COMMAND_FAILED` are removed from the specification; red mutations now target invalid problemCode and array-index substitution. |
| S-02 | `CONFIRMED → CLOSED_PENDING_RECHECK` | Polarity is required at API case level, not inferred from fixture `purpose`; this avoids mixed fixtures being assigned one false polarity. The specification freezes the exact 31 fixture-candidate IDs, six structural-block IDs, and the replay split. |
| N-01 | `CONFIRMED → CLOSED_PENDING_RECHECK` | Seed DAG is derived from `entities.relations`; manifest is a derived execution plan. Optional readable DAG snapshots must be machine-compared with the relation-derived partial order; deleting the Dinner Set → Latte relation is a required red mutation. |

## 38/62 decision recorded in the design input

- 31 negative fixture-candidate cases are the exact case IDs listed in the P4 specification.
- `CI-API-018-10` through `CI-API-018-15` are the six structural-block negatives.
- `CI-API-022-01` is explicitly `POSITIVE` for idempotent replay (`replaySameResult`).
- `CI-API-022-02` is explicitly `NEGATIVE` for owner failure rollback (`ownerFailureRollback`).
- Final denominator is therefore 38 negative / 62 positive. This is now a case-level test-contract assertion, not a fixture-purpose inference.
- `OWNER_COMMAND_FAILED` is not an assertion-matrix problemCode and must never be emitted as a reference; the future binding must select an existing matrix problemCode for the actual owner-failure condition.

## Evidence boundary

This repair changes the design specification and its disposition only. It does not add case bindings to the runtime scenario catalog, add a seed loader, change `r5-full`, execute any HTTP request, upload any asset, create any database row, or claim API/L2/business/cleanup PASS. A P4 preparation package must implement the case-level fields and its fail-closed gate before B/A/F execution is authorized.

## Recheck request

Claude should independently verify the current P4 specification against the 42-operation assertion matrix, 100 API cases, 39 test datasets, and the Dinner Set fixture relation; then return `GO` or `NO-GO` with `M/S/N` and preserve the P4 non-runtime boundary.
