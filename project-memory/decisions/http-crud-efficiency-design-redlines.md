---
id: decisions.http-crud-efficiency-design-redlines
status: active
layer: routed
taskKinds: ["design", "implementation", "review", "testing"]
domains: ["backend", "contract", "platform", "admin-ui"]
consumerFaces: ["all"]
owners: ["backend", "platform", "contract", "frontend-platform", "product"]
impacts: ["architecture", "database", "contract", "evidence"]
triggers: ["task-start", "implementation", "review"]
assertions: ["HTTP_OPERATION_DENOMINATOR_BEFORE_EFFICIENCY_CLAIM", "SET_BASED_COLLECTION_READS", "OWNER_LOCAL_EFFICIENCY_REPAIR", "COMMAND_CORRECTNESS_COST_PRESERVED", "TASK_READ_BUDGET_REQUIRES_EXPLANATION", "MEASURED_PERFORMANCE_NOT_STATEMENT_COUNT", "CONTRACT_ROUTE_CLOSURE", "GENERATED_OPERATION_PATH_ONLY_FOR_CONSUMERS", "DIAGNOSTIC_SECRET_FLOW_EXPLICIT", "EXECUTION_EVIDENCE_TAXONOMY"]
sourceRefs: ["PLATFORM-BLUEPRINT.md", "doc/evidence/platform/rm1/p6/rm1p6-extension-hosts-u26-implementation-amendment.md", "doc/evidence/platform/rm1/p6/rm1p6-u13-all-http-crud-efficiency-remediation-design.md", "doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md"]
---

# HTTP CRUD efficiency design redlines

These redlines generalize confirmed RM1 findings. They apply before future API, owner, read-model,
edge or admin feature design. They do not turn a Seed sample into implementation authority, create a
universal SQL-count ceiling, or replace detailed business/IA/owner source reread. Every backend
operation still declares its normal-path database access shape as a design contract; that declaration
is operation-specific, not a global performance threshold.

- `HTTP_OPERATION_DENOMINATOR_BEFORE_EFFICIENCY_CLAIM`: define the authoritative generated route
  denominator and disclose attempted, correlated, passed, expected-rejected and unexecuted coverage
  before calling any workload “all interface”. Each unexecuted operation requires its own reason and
  explicit disposition; an unrecorded item blocks coverage completion, and the report states both
  `executedRatio` and unresolved-unexecuted count. A fixture/Seed sample is a diagnostic subset unless
  it covers the declared denominator.
- `CONTRACT_ROUTE_CLOSURE`: root OpenAPI, referenced path shards, generated registry, controller and
  generated consumer outputs must describe the same reachable operation set. Repair a missing
  reference or generated drift before using the set for performance, security or coverage claims. If a
  route is registry-only, decide from its shard, controller, face and approved business status whether
  to add the missing root reference or retire it; never infer retirement from a root omission alone.
- Source: `doc/evidence/platform/rm1/p6/rm1p6-u13-all-http-crud-efficiency-remediation-design.md@## 3.1 契约分母（第一交付单元）`.
- `GENERATED_OPERATION_PATH_ONLY_FOR_CONSUMERS`: an HTTP consumer must not hand-write an edge route,
  build one from string fragments, then reverse-match it against the generated registry. The finite
  denominator is both admin-app runtime consumers and every managed seed, fixture, L2 and diagnostic
  caller; OpenAPI shards, edge controller mappings, codegen and generated clients are owner truth,
  while synthetic non-request test data is a documented counterexample. The only permitted consumer
  flow is `operationId + typed path/query parameters → generated template → concrete encoded path`.
  The minimal prevention is the fail-closed frontend-architecture gate with a real route-literal red
  mutation, plus a shared registry resolver; a route mismatch discovered at runtime is evidence that
  the consumer escaped the generated path, not a reason to add another manual route string.
- Source: `doc/evidence/platform/rm1/p6/rm1p6-extension-hosts-u26-implementation-amendment.md@## Dexter-authorized generated edge route consumer closure`.
- `PER_OPERATION_DESIGN_CONTRACT`: every backend operation in an implementation-facing design must
  bind four finite facts before implementation: ordered logic steps, an ordered condition-to-typed-
  problem mapping whose problem-code set exactly equals the operation contract, the edge/coordinator/
  owner call chain and transaction boundary, and the expected request-local
  `databaseOperationCount` for one named normal fixture with its read/write breakdown and assumptions.
  The declared count includes trusted context/security and correctness-preserving receipt, CAS,
  audit and readback work observed by the request-scoped tracker. It is a design limitation used to
  expose accidental N+1, missing correctness work or an invented call path; it is not a universal
  ceiling, a latency/throughput claim, or permission to delete correctness cost. Implementation exit
  compares the measured normal fixture with the declaration exactly; any difference requires a named
  operation/design/measured/reason disposition and reopening the design when semantics changed.
  Applicability is backend implementation-facing design and its API evidence. Frontend-only work,
  synthetic non-request data, controlled performance conclusions and production runtime alert limits
  are explicit counterexamples.
- `SET_BASED_COLLECTION_READS`: a collection/list/page must not make a per-item database call, owner
  API call or HTTP request for a fact that can be loaded once for the collection. Use a bounded
  `IN`/set-based query, owner-owned batch task read, or task read model. Single-object detail lookups
  and already-batched reads are counterexamples, not failures.
- `OWNER_LOCAL_EFFICIENCY_REPAIR`: an efficiency repair keeps truth in its owner. A batch task read,
  canonical session entry, validation/normalization result or typed failure belongs in the owner’s
  declared public API package; edge maps it and does not reconstruct authorization facts. Host owners
  retain their own writes; no cross-schema DML, repository/entity import or convenience BFF is allowed.
  Before moving a typed failure, scan every cross-owner consumer, edge problem mapper and owner-internal
  direct reference; a partial migration leaves a second public contract.
- `COMMAND_CORRECTNESS_COST_PRESERVED`: never reduce statement count by deleting idempotency, CAS,
  audit, rate limiting/locks, owner authorization/state recheck, typed failure precision or required
  final owner readback. First remove repeated load/compose/write work only after proving every success,
  replay, stale, denied and relevant security path remains equivalent.
- `TASK_READ_BUDGET_REQUIRES_EXPLANATION`: the default task-read budget is a design-review prompt,
  not a mechanical universal ceiling. A stable bounded bulk read above it must document the user
  task, cardinality, query chain, owner/read-model reason and any chosen consolidation; it must not
  be forced into an unsafe cross-schema mega-query merely to lower a number.
- `MEASURED_PERFORMANCE_NOT_STATEMENT_COUNT`: request-local JDBC statement count and duration are
  diagnostic signals for redundancy/N+1. Latency, throughput or index claims require a controlled
  workload with warm-up, fixed samples/concurrency, outcome rate, p50/p95/p99 where applicable,
  pool/lock and DB resource observation, and `EXPLAIN (ANALYZE, BUFFERS)` for an index/query change.
  Do not log SQL/bind values or security-sensitive raw request data.

`PER_OPERATION_DESIGN_CONTRACT` reconciles rather than replaces the two rules above: every operation
always declares its normal path; only a task read above the separate default budget owes the expanded
cardinality/query-chain explanation; and latency, throughput or index conclusions still require the
controlled measurement demanded by `MEASURED_PERFORMANCE_NOT_STATEMENT_COUNT`.
- `DIAGNOSTIC_SECRET_FLOW_EXPLICIT`: a diagnostic workload inventory contains symbolic handles and
  non-sensitive request shape only. Credential/OTP/token/cookie/Authorization/identity values are
  generated per run or injected directly into an in-memory client, excluded from every persisted and
  output surface, then discarded; red proof covers attempted leakage, not only report redaction.
- `EXECUTION_EVIDENCE_TAXONOMY`: explicitly classify every dynamic plan as HTTP coverage/diagnostic
  integration, approved-Journey browser L2, or controlled performance study. Each reports only its
  own coverage/business/performance and cleanup evidence; raw HTTP coverage is never browser L2 or
  business PASS.

## Review questions

1. What is the exact route/owner/user-task denominator, and what coverage is still unexecuted?
2. Does any collection loop issue repeated queries/calls? If not, which bounded batch/read-model
   counterexample proves it is not N+1?
3. Is each proposed batch/normalization/session API owned, typed and declared in the target module’s
   public API package, with edge-only mapping?
4. Which command correctness costs remain deliberately present, and which exact repeated fact or
   write cycle is being removed?
5. Is the claimed benefit a diagnostic statement-count improvement or a measured performance result?
6. For every diagnostic secret, where is it created, how does it reach only the in-memory client, and
   which output surfaces have a red leakage proof?
7. Which execution class is this run, and which stronger result is it explicitly unable to claim?
8. For each backend operation, are logic steps, ordered failure conditions, owner call chain and one
   named normal-fixture DB count present; do the condition keys exactly cover `problemCodes`, and does
   measured P2 evidence either equal the declaration or carry a named design-drift disposition?

## Provenance and boundary

The finite RM1 denominator is 147 generated HTTP operations; the earlier Seed report observed 26
endpoint groups and is explicitly not its completion denominator. See the source problem family for
the confirmed root causes, P2/P3 counterexamples and prevention destinations. This memory guides
future designs but does not authorize an unreviewed API, schema, runtime or benchmark change.
