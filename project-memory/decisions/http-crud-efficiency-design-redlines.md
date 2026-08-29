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
assertions: ["HTTP_OPERATION_DENOMINATOR_BEFORE_EFFICIENCY_CLAIM", "SET_BASED_COLLECTION_READS", "OWNER_LOCAL_EFFICIENCY_REPAIR", "EXPLICIT_EXTENSION_SUBMISSION_OWNER_BOUNDARY", "COMMAND_CORRECTNESS_COST_PRESERVED", "BUSINESS_CORRECTNESS_PRECEDES_DB_EFFICIENCY", "TASK_READ_BUDGET_REQUIRES_EXPLANATION", "MEASURED_PERFORMANCE_NOT_STATEMENT_COUNT", "CONTRACT_ROUTE_CLOSURE", "GENERATED_OPERATION_PATH_ONLY_FOR_CONSUMERS", "DIAGNOSTIC_SECRET_FLOW_EXPLICIT", "EXECUTION_EVIDENCE_TAXONOMY", "BACKEND_NA_SPLIT_PACKAGE_SCOPE", "BACKEND_PUBLIC_INVITATION_CONTRACT_GENERATED_CLOSURE", "BACKEND_SOURCE_HASH_CHAIN_CLOSURE", "BACKEND_FORMATTING_GATE_SCOPE", "PERFORMANCE_IS_TWO_MULTIPLIERS", "MEASUREMENT_BASIS_BEFORE_MEASUREMENT_CLAIM", "BUDGET_CALIBRATED_AFTER_REPAIR_NOT_BEFORE", "IMPLEMENTATION_AGENT_CONTROLLED_BUDGET_EXCEPTION", "OPTIMIZATION_CLOSURE_NEEDS_BEFORE_AFTER_NUMBERS"]
sourceRefs: ["PLATFORM-BLUEPRINT.md", "doc/decisions/2026-08-10-v2s-m1-extension-submission-and-command-readback-decision.md", "doc/decisions/2026-08-12-v2s-public-invitation-resumption-state-machine.md", "doc/evidence/platform/rm1/p6/rm1p6-extension-hosts-u26-implementation-amendment.md", "doc/evidence/platform/rm1/p6/rm1p6-u13-all-http-crud-efficiency-remediation-design.md", "doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md", "doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-implementation-design-codex.md", "doc/platform/backend-coding-standard.md", "doc/platform/implementation-task-template.md", "doc/review/platform/2026-08-16-v2s-backend-standards-conformance-review-claude.md", "doc/review/platform/2026-08-22-v2s-backend-performance-remediation-design-review-claude.md", "doc/review/platform/2026-08-22-v2s-backend-performance-root-cause-analysis-claude.md"]
---

# HTTP CRUD efficiency design redlines

These redlines generalize confirmed RM1 findings. They apply before future API, owner, read-model,
edge or admin feature design. They do not turn a Seed sample into implementation authority, create a
universal SQL-count ceiling, or replace detailed business/IA/owner source reread. Every backend
operation still declares its normal-path database access shape as a design contract; that declaration
is operation-specific, not a global performance threshold.

- `COMMAND_RECEIPT_CANONICAL_REPLAY`: a typed owner-command receipt must use the shared parser and
  canonical JSON serializer for new writes and replay. A legacy hand-encoded
  `{"k":"<base64>"}` receipt may be decoded only on its replay path and rewritten to canonical
  JSON in the same owner transaction; regex field extraction and permanent dual-format support are
  prohibited. The minimum proof covers `"`, `\\`, nulls, lists, maps, an old stored receipt, and
  the exact terminal readback. This applies only to persisted command readbacks; opaque credentials,
  audit payloads, and already-canonical Jackson receipts are counterexamples. Source:
  `doc/review/platform/2026-08-16-v2s-backend-standards-conformance-review-claude.md`, N-f.

- `PERFORMANCE_IS_TWO_MULTIPLIERS`: backend request latency is `round-trip count × per-round-trip
  cost`, and an optimization round that touches only one factor produces no user-visible gain. The
  2026-08-22 measurement proved it: the same `saveOperationsCatalogItem` code took 102 DB operations
  and 50.8ms with the database co-located (4.1ms of it in the database, 8% of the request), and 128
  operations and 5608ms through the DEV SSH tunnel (5473ms in the database, 98% of the request) —
  a 663–1074× amplification **per database operation**. Before proposing any repair, state which
  factor it moves and by how much. Counterexample: a co-located deployment where per-operation cost
  is already sub-millisecond makes round-trip count the only remaining factor. Source:
  `doc/review/platform/2026-08-22-v2s-backend-performance-root-cause-analysis-claude.md`, §1.

- `MEASUREMENT_BASIS_BEFORE_MEASUREMENT_CLAIM`: never compare two numbers until their basis is
  read from the report header. Four confirmed traps: the seed report's third numeric column is
  **database duration**, not server duration; `connectionBorrowCount` is a separate cost from
  statement count and a read path can borrow one connection per statement; an unclassified-statement
  ratio computed over all database operations can be diluted by CONNECTION/TRANSACTION entries, so
  it must be computed over SQL executions only; raw `TRANSACTION` counts BEGIN and COMMIT as two
  entries, so transaction count must be derived from `SET_AUTO_COMMIT(false)` rather than halving.
  Source: `doc/review/platform/2026-08-22-v2s-backend-performance-remediation-design-review-claude.md`, §0.

- `BUDGET_CALIBRATED_AFTER_REPAIR_NOT_BEFORE`: a database-operation budget is set from the repaired
  implementation, never from the current state. Take the maximum integer count across three runs of
  one fixed fixture, and require it to be at or below the class threshold; a value above the
  threshold means the repair is incomplete and must not be resolved by raising the budget. Budgets
  move down freely. An increase is allowed only through the controlled exception below, with a
  source-controlled operation scope and a red fixture proving an unapproved raise fails.
  Non-determinism across the three runs is fixed at the fixture, never by adding random headroom.
  Source:
  `doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-implementation-design-codex.md`, CP-02/CP-05.

- `BUSINESS_CORRECTNESS_PRECEDES_DB_EFFICIENCY`: DB count is a diagnostic constraint, never permission
  to delete or weaken business facts, owner rechecks, required transactions, idempotent replay,
  concurrency locking, typed problems, audit or authoritative readback. After an event-level proof
  shows that an operation's remaining DB closure is correctness-preserving and that a consolidation
  would cost more safety/review surface than it returns, Dexter may authorize one exact budget increase,
  or an implementation agent may make that same decision when the current Dexter authorization and
  implementation design explicitly delegate it. The exception has exactly two admission criteria:
  (1) it weakens no business fact; and (2) the source proof shows that applicable shared/general
  mechanisms have already been reused, leaving neither duplicate implementation nor avoidable owner
  fan-out/N+1. The record must state both proofs, the measured closure, rejected alternative, cost and
  narrow operation boundary; the generic undecided-increase red mutation remains mandatory. This is
  not a blanket performance exemption.
  Source: Dexter decision, 2026-08-26; implementation-agent delegation, 2026-08-28.

- `IMPLEMENTATION_AGENT_CONTROLLED_BUDGET_EXCEPTION`: an explicitly authorized implementation batch
  may delegate a narrow **fixed, single-operation** budget decision to its implementation agent; the
  agent does not need another Dexter round-trip once every admission fact is proven. Before release,
  the agent must (a) reopen the operation's owner, edge, SQL and same-root siblings; (b) prove that
  success, replay, stale, denied and relevant security paths preserve owner rechecks, transactions,
  idempotency, locks, typed problems, audit and authoritative readback; (c) prove that all applicable
  shared mechanisms are actually reused and that no safe consolidation, duplicate implementation,
  avoidable owner fan-out or N+1 remains; (d) measure the same fixed fixture three times and record
  `from`, `to`, `measuredMax`, the report header and DB-event evidence; and (e) record the rejected
  alternative, safety/review-surface cost and the exact operation boundary. The exception must use an
  operation-scoped `decisionRef` registered in the unique generator source and the existing controlled
  exception record; it may not be a free-form or blanket ref. The record must declare `authority=DEXTER`
  for a historical approval or `authority=IMPLEMENTATION_AGENT` for the explicitly delegated decision;
  the validator rejects an implementation-agent record whose resolver scope contains multiple operations.
  Existing Dexter-approved refs whose resolver scope contains multiple operations are historical grouped
  approvals and cannot be reused for a delegated self-decision; a self-decided exception needs a newly
  registered one-to-one ref.
  The agent must label the result
  `SELF_DECIDED_IMPLEMENTATION_EXCEPTION` and retain the red mutation proving an undecided increase
  fails. This delegation does **not** cover `LINEAR_REQUEST_CARDINALITY` budgets, operation count or
  identity changes, contract/schema/business-semantic changes, unresolved product/Journey/permission
  decisions, or any operation whose optimization proof is incomplete. If any admission fact is
  unknown, the agent must not release the exception and must return the precise gap to Dexter. This
  rule changes who may make the already-defined implementation decision; it does not weaken the
  two admission criteria, the machine validator, the independent reconciliation, or the final review.

- `OPTIMIZATION_CLOSURE_NEEDS_BEFORE_AFTER_NUMBERS`: an efficiency round is not closed without
  same-workload before/after numbers in the closure document. Two prior rounds (2026-08-08 refactor,
  2026-08-09 phase3/phase4 rebaseline) produced no measurable improvement and their closure carried
  no comparison figures, so the loss was invisible: writes stayed at 26–44 operations, a read that
  had been ruled to cost 7–10 statements grew to 59, and one list endpoint went from 13 to 26.75
  across two seeds while three feature batches each added queries back. Closure must report avg and
  p95, database operation count, and per-operation database duration for the same workload, and a
  regression gate must exist before the round is declared done. Source:
  `doc/review/platform/2026-08-22-v2s-backend-performance-root-cause-analysis-claude.md`, §4.

- `INDEX_RETIREMENT_NEEDS_PREDICATE_AND_PREFIX_PROOF`: an index is not dead because its name is
  absent from a grep or because a narrow acceptance workload did not touch its table. Before a
  destructive migration, inspect the indexed leading columns, partial-index predicate, and every
  production query shape; a query that can use the leading prefix keeps the index even when its
  full ordering is not used. `pg_stat_user_indexes` is supporting runtime evidence, not a substitute
  for this source proof. Source: `doc/review/platform/2026-08-16-v2s-backend-standards-conformance-review-claude.md`, N-c.

- `BACKEND_S07_S08_SCOPE`: S-07/S-08 的通用判据与反面对照以
  `doc/platform/backend-coding-standard.md` §2-E/§2-F 和本轮 review 为准；本轮只把跨 owner
  逐字节相同的 catalog target capability 映射收口到 execution-context 工具，owner 自己的
  grant/context/copy 判定仍留在 owner 内，不能因方法名相似而继续抽象。这个适用边界用于后续
  后台重复代码复核，避免把语义差异误报成可复用工具或只修 review 点名的三处而漏扫同族 owner。

- `BACKEND_PRESERVE_STACK_TRACE_SCOPE`: 异常翻译的根因复核必须覆盖所有同族 catch 边界，
  包括嵌套回执的直接解析与 legacy fallback；捕获到的 cause 必须沿真实错误链保留，确定性的
  业务拒绝则留在 catch 外或使用无 cause 的明确分支。组合 owner/edge 边界的宽泛兜底 catch
  也必须先透传 owner typed Problem；否则字段路径、实际大小和超出量等业务诊断会被降级为
  泛化错误。具体判据以
  `doc/platform/backend-coding-standard.md` §1-D 和本轮 review 第 10 步为准；该指针用于
  后续后台异常边界复核，避免只修首个 PMD 命中或用无关原因遮盖真实失败。

- `BACKEND_OPENAPI_JSON_EXTENSION_SCOPE`: `contracts/openapi` 的 61 个持久契约文档均为 JSON，
  因此扫描器、resolver、生成器、placement/evidence 与生成物路径必须共同使用 `.json`；
  Heritage YAML 只能由显式只读 source catalog + `yamlAsJson` 适配读取，scratch fixture 也必须
  遵守被测目录的 JSON-only 扫描语义。该指针用于后续契约扩展名改动，避免只改文件名而留下
  空扫描假绿、旧 evidence path 或 generator 分母漂移。

- `BACKEND_GENERATED_PROJECTION_BOUNDARY_SCOPE`: 大型契约 root 若由 placement/shard 生成，root
  必须在自身顶层声明生成投影、禁止手工编辑和可解析的 source reference；测试必须同时读取 raw
  root、重建 canonical projection 并做结构对账。`.yaml` 到 `.json` 的重命名还必须扫描当前
  active work order、generator、checker、consumer 与 evidence 引用；历史 review/evidence 只在
  明确属于历史记录时保留，不能把活动施工入口留在已删除路径上。该族修复防止“分片是源但读者
  看不出来”与“重命名后工单继续指向旧文件”同时发生。

- `BACKEND_FORMATTING_BYTECODE_PAIR_SCOPE`: 格式化语义证据必须来自同一源码快照的独立 before
  编译与 after 编译，并记录各自 source/build identity；对每个类的 `javap -c -p` 输出去除
  `LineNumberTable` 后再做逐字节对账。单独的旧 baseline、Spotless PASS 或只有 class hash
  不能证明格式化没有改变逻辑；缺少成对且新鲜的证据时只能判为未验证。

- `BACKEND_SOURCE_CONTRACT_TEST_OWNING_PATH_SCOPE`: source-contract test 读取生产源码时必须绑定
  当前实际 owning path，尤其是 operation 类型因 split-package 收口迁入 `application.operations`
  后，测试路径必须同步迁移并扫描同族文件。对 Java 语义的 source assertion 应只把合法空白/换行
  当作表示层归一化；不能用旧路径或单行正则把测试缺陷误报为实现缺陷，也不能因格式化折行而放宽
  到失去关键 token 的宽泛匹配。

- `BACKEND_NA_SPLIT_PACKAGE_SCOPE`: split-package 修复必须以实际迁移的 app operation 类型为
  closed set，而不是按 owner namespace 全量推断 `application.operations`；同一 namespace 的
  owner read、protocol 或仍未迁移的 adapter 继续留在 `application`。绑定生成器、registry、
  controller imports 与文件系统门必须共同验证这个 exact set，避免生成不存在的类名或把 owner
  边界误迁移。

- `BACKEND_PUBLIC_INVITATION_CONTRACT_GENERATED_CLOSURE`: owner readback 已被 Journey/详设消费的
  字段，必须在 OpenAPI required closed schema、Java/TypeScript generated wire、controller 和
  frontend consumer 中成套闭合；发现生成物缺字段时先修 owning schema，再运行受控 codegen，
  并扫描同族 readback，不得手改 generated 文件或以 consumer fallback 掩盖契约漂移。

- `BACKEND_SOURCE_HASH_CHAIN_CLOSURE`: 任何会改变 implementation-facing design、contract 或
  source-bound policy 字节的机械修改，都必须沿 owning source hash、coverage policy、生成读模型、
  generated wire 与 checker 逐层回读并由同一生成器刷新；验证器第一次报告 hash drift 是真实
  依赖链断裂，不得只改派生 hash 或跳过生成。该规则适用于 source-bound artifact chains，
  不适用于没有声明 source hash 的普通文档改字。

- `BACKEND_FORMATTING_GATE_SCOPE`: Spotless/palantir 是 Java 格式化权威，但不能单独约束 SQL
  text block、长字符串和深层 continuation expression 的 UTF-8 物理行宽；120-byte 扫描必须
  接入 `spotlessCheck`。格式化 bytecode 证据必须区分注释/空白、编译期字符串折叠和真实局部变量
  或控制流改写；格式化例外必须显式且只覆盖精确表达式，不能把动态重写 helper 当作构建能力。
  直接匹配 Java 源码字符串拼接的 source-contract 测试也必须把相邻字面量拼接与空白视为表示层，
  再对归一化后的 SQL/业务 token 做语义断言；不能因 formatter 行折叠把有效行为误报为回归。
  来源：`doc/review/platform/2026-08-16-v2s-backend-standards-conformance-review-claude.md` 第 13 步、
  `doc/platform/backend-coding-standard.md` §1-I。

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
- Command transaction form for `OWNER_LOCAL_EFFICIENCY_REPAIR`: every operations command first enters
  its existing `REQUIRED` application-handler transaction, then obtains each owner-local command fact
  exactly once:
  workspace-IAM produces the authenticated active-assignment, enabled-role and capability projection;
  organization produces the selected target/path-and-range judgment; contract produces only its own
  derived state. A typed immutable projection may cross an owner API boundary, but no owner may rebuild
  another owner’s facts, use a request/global cache to evade fresh command authorization, or receive a
  generic fact map/callback. Command-following owner readback stays in that same transaction when it is
  needed for the response. Receipt claim, owner recheck, CAS, audit and typed denial remain intact.
  The exact applicable operation set and the source anchors for this pattern must be guarded by the
  existing `scripts/check/backend-performance-sql-merge-coverage` gate after **every** source or test
  change in its implementation package; a skipped gate is a failed implementation check, not a later
  later bookkeeping omission. The gate derives every `OWNER_COMMAND + REQUIRED +
  WORKSPACE_EXECUTION_CONTEXT` row from the operation-handler registry on each run: each row has one
  exact named application handler, its own `REQUIRED` entry and in-transaction context resolution, while
  edge has neither transaction nor command-context resolution. A future matching registry row without
  that exact handler must fail rather than inheriting a controller count or a shared facade. The gate must
  reject generic operation-id/map/callback dispatch and retain real source red mutations, including a
  missing handler, duplicated handler, wrong handler operation, edge transaction and pre-transaction
  context resolution. Per-operation validation folding into `EXISTS`/CTE is a separate, explicitly
  measured batch and must not be smuggled into this shared-context pattern.
- `EXPLICIT_EXTENSION_SUBMISSION_OWNER_BOUNDARY`: a typed public owner command carries dynamic
  extension data only as an owner-native immutable submission list whose entries have `fieldKey`,
  canonical JSON text and explicit `SET` or `CLEAR` intent. An omitted field is not submitted;
  `CLEAR` must never be inferred from Java `null` or literal JSON text `"null"`. Only the extension
  owner interprets the JSON text against the current definition, and the definition revision remains
  owner-generated persistence/readback evidence rather than a client CAS. New owner command APIs,
  adapters and generated runtime bindings must not expose `Map`, `JsonNode` or `ObjectNode` for this
  boundary. Legacy map-shaped paths are a migration counterexample, not a reusable implementation
  pattern. When a command response needs cross-owner facts, its one-operation composition producer
  remains inside the same `REQUIRED` transaction, calls only declared typed readbacks, reuses the
  authoritative existing mapper, and may not add JDBC/repository access, a convenience BFF or an
  owner-truth copy. The mechanical prevention is the command topology gate with real red mutations
  for mode/null confusion, generic extension escape, an extra composition query and mapper drift.
- `EXPLAINABLE_COMMAND_GATE_REJECTION`: every failure emitted by that command-topology gate must
  contain three stable fields: `WHY` (the mechanically violated invariant), `BACKGROUND` (the
  owner/transaction/security reason that makes the invariant necessary), and `PATTERN` (the
  bounded compliant repair). The finite denominator is every gate failure code, including unknown
  command profile, missing or extra topology/execution rows, unanchored source, pending closure,
  duplicate or wrong handler, edge transaction/context resolution and generic-dispatch/JDBC escape.
  A terse code-only error is a failure because it invites bypass through a different controller,
  `Map`/callback facade or an unrelated transaction boundary. This remains a mechanical diagnostic:
  it explains the already-declared rule, never invents business authorization or a new route. Its
  prevention is the same gate's diagnostic-catalog self-test, which mutates representative failures
  and rejects a message missing any of the three fields.
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

- `ONE_REQUEST_ONE_TRANSACTION_ORIGIN`: every HTTP command path declares exactly one transaction origin; edge code never creates a transaction and participating owner calls never create a second origin.
- `REQUEST_LOCAL_FACT_LOADED_ONCE`: fresh authorization, session and path facts are minted once at a named request-local origin and passed as immutable facts without bypassing a current owner recheck.
- `OPERATION_DATABASE_SHAPE_DECLARED`: every canonical operation has one source-inventory-bound shape class, transaction origin, fact-loader set, component formula, evidence obligation and red discriminator before source admission.

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
