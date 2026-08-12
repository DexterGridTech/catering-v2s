# 后端性能最终优化：实施会话 handoff（详设已 GO，尚未实施）

`HANDOFF_STATUS=READY_FOR_NEW_STATIC_IMPLEMENTATION_SESSION_ONLY`  
`DESIGN_VERDICT=CLAUDE_GO_M0_S0_N1`  
`CURRENT_PACKAGE_AUTHORITY=DESIGN_ONLY_NO_IMPLEMENTATION_NO_DYNAMIC`

> **Dexter delivery-sequence amendment (2026-08-11):** the old design wording that
> put independent `IMPLEMENTATION` review before dynamic execution is superseded.
> The new implementation session performs static 196-row closure, row-by-row
> design-conformance reconciliation, ordered managed dynamic validation, then the
> single independent implementation review and Dexter/Claude final review. This
> amendment does not turn the current design-only package into a runtime package.

## 0. 复制给新会话的实施提示词

```text
你现在负责“后端性能最终优化”的完整交付。先立即设定一个 active GOAL：

完成 BPF-U01 至 BPF-U06 的一次性静态实施，覆盖权威 196 条 backend operation；静态完成后逐条与详设对照，
对照通过后按受管顺序完成 Testcontainers 196/196、本机 managed L2、reset、managed DEV、r5-full seed 与同口径
比较；最后做一次独立 IMPLEMENTATION review，并将最终完整证据交 Dexter 和 Claude review。

不要把“某个 gate 通过”“M1 静态 GO”“编译通过”“seed 单项 PASS”当作交付完成、性能成功、L2 PASS 或 UAT PASS。

【开始前的强制阅读顺序】

1. 仓根 `AGENTS.md`、`PLATFORM-BLUEPRINT.md`。
2. `doc/platform/README.md`、`doc/platform/roadmap-program-registry.json` 和所选 program 的 `CURRENT_*`。
3. `project-memory/index.md` 全部 kernel；随后执行：
   `scripts/context/recall-memory --task-kind implementation --domain backend --consumer-face backend --owner platform --impact database --trigger implementation`
   对命中的每份 project-memory 文件及其 `sourceRefs` 逐份打开。至少必须读 deterministic-context-only、
   http-crud-efficiency-design-redlines、incremental-compliance-hook、independent-subagent-adversarial-review、
   phase-retrospective-and-systemic-repair、implementation-source-reread-discipline、claude-review-handoff-standard。
4. `scripts/README.md`、`contracts/policy/standards-coverage-matrix.json` 与当前 Roadmap 的授权。
5. 主详设：
   `doc/plans/platform/2026-08-10-v2s-backend-performance-final-optimization-implementation-design-codex.md`。
6. Claude GO：
   `doc/review/platform/2026-08-11-v2s-backend-performance-final-optimization-post-remediation-recheck-claude.md`。
7. 行级权威：command catalog 113、read catalog 83、operation-source-read ledger 196、cur-anchor rederivation、
   remediation intake、granularity manifest，以及本 handoff。

【工作方法】

- 每次要动一个 operation 或控制点前，重新打开其 ledger/catalogue 行、适用 memory/redline、owning source 和
  详设小节；改后用同一组材料回读。遇到问题，顺序固定为：先读 project-memory，再读详设和该行，最后读 owning
  source。禁止按 operation 名、模板或聊天摘要推断业务/事务/owner/fact/查询/验收条件。
- 先新建并激活独立 static implementation package；不得复用当前 design-only package。实施期必须保留
  Pre/Post hook、receipt、精确 change surface 和 package exit。
- Dexter 已授权在本详设和合理同根范围内完成必要的 source、control、generator、test、report、runner preparation
  和 evidence 工作；中间不要申请再次授权。真实源码与详设不符时，记录 `IMPLEMENTATION_FACT_CONFLICT`（旧行、
  source/evidence、operationId、最小红线保持修正、proof）并继续。不得跳过行、拆侧批、降级 gate、改 HTTP 契约、
  使用 request/global cache、跨 owner/schema 直读、便利 BFF，或删除 idempotency/CAS/audit/lock/owner recheck/
  typed failure/必需 readback。
- BPF-U01 的 87 条 idempotency、45 条 readback、45 条 ORIGIN/JOIN 必须在改 application source 前逐行明确，
  并取得其限定 independent receipt；这不是中途 implementation review，而是源码准入条件。
- Claude N-01（granularity checker 的 update-path 对称断言）是单独欠账：登记为
  `OUT_OF_SCOPE_HANDOFF_DEBT`，不要混进本批，也不要假装已经修好。

【必须串行完成的实施内容】

1. BPF-U01：完成 45 条非 M1 cur 重导、87/45/45 前置决定；把 mandatoryPerEditGate 变为不可弱化的 closed
   profile control；创建 196 source inventory、shape matrix、loader catalogue；追加三条永久 redline 并注册标准；
   处置 database-operation-budget、gate-dispositions、authority-source-ledger、read-budget、final-fixture-catalog
   五个已有控制。所有缺行、错误 floor、弱 profile、app/edge cur、歧义 origin、未登记 loader caller 都要有
   WHY/BACKGROUND/PATTERN 与真实 red mutation。
2. BPF-U02：113 command 各有唯一 origin/participant chain；68 M1 controller 全部经同名 generated binding，
   binding 必须被 HTTP 入口实际引用且只调用同名 adapter。拒绝 edge transaction、direct-adapter bypass、dead
   binding、第二 origin、REQUIRES_NEW、NESTED、manual transaction；owner recheck 始终早于 receipt replay。
3. BPF-U03：将 facts 收拢到 named origin，传递 immutable projection 但不替代 owner 的当前 recheck；静态拒绝
   未登记 loader caller，runtime 以 HMAC immutable snapshot 检查同 requestId loader 重复。不得声称编辑期已经
   证明“只加载一次”。
4. BPF-U04：仅实施有完整等价记录的 owner-local fold。每条必须有 foldedJudgment、originalObservableSemantics、
   failingCounterexample、source/readback/error preservation evidence；缺一不折。保留 target/CAS/lock/audit/
   receipt/error/final readback，禁止跨 owner/schema 或让 edge 接管 owner read。
5. BPF-U05：先用五个真实 revoke HTTP 入口修复 read-budget，再把 78 TASK_READ 与 5 protocol exemption 接入
   common shape matrix。读取保持 receipt-free、write-transaction-free；above-floor 逐行解释任务、基数、查询链、
   owner 原因，绝不改成全局数字上限。
6. BPF-U06：先调和 196 owner/HTTP/OpenAPI fixture catalog；实现 seed `kindCounts`/UPDATE、同 kind comparator，
   以及 grouped Testcontainers plan/report。每个 operationId 必须有 request/event-joined report row；跨 reportKind、
   覆盖/basis/profile 不同、UPDATE 降低、unknown/unmatched/stale resource/cleanup fail 必红或不完整。

【静态到动态的不可跳级闸门】

静态 196 行闭合后，不能马上拿某个测试当结果；先逐条对照 command/read catalogue、source inventory、shape matrix、
redline、acceptance 和 red discriminator，形成 design-conformance reconciliation。任何不符先作为
`IMPLEMENTATION_FACT_CONFLICT` 修正；只有 196/196 reconciliation PASS，才可进入动态。

然后按这个唯一顺序运行，且每阶段 business 和 cleanup 都要独立 PASS：

1. 远端 managed Testcontainers：exact grouped plan 覆盖 196/196，产生正式 request/event-joined report；不能用
   本机 Docker、DEV、seed 或浏览器代替。
2. 本机 managed L2：`node scripts/test/catalog-inventory-l2.mjs --managed`。Spring Boot、两个 admin app 和
   Playwright 都在本机，只经受管 tunnel 连远端隔离中间件；它不是远端应用/浏览器，也不是 UAT。
3. 显式 reset：`R5_RESET_CONFIRMATION=EXPLICIT_R5_RESET node scripts/dev/r5-reset.mjs`。
4. managed DEV start：`scripts/dev/r5-dev-runner.mjs start`。
5. r5-full seed：`R5_SEED_CONFIRMATION=EXPLICIT_R5_SEED scripts/dev/seed --profile r5-full`，随后运行同 basis 的
   正式 comparator，产出 before/after artifact。

每个动态包启动前都要读该包 input/manifest/authorization、`scripts/README.md`、
`.agents/skills/cs-managed-runtime-execution/SKILL.md`、dev-command-separation、phase-retrospective、runner source
和上一 terminal manifest；先做 run-scoped resource-budget preflight。首败保留并读日志/manifest，记录 first failure、
last known good、broken boundary；不得以重复、加长 timeout、按端口/进程名猜测或杀未知进程代替诊断。

【最终交付】

只有静态、196/196 Testcontainers、本机 L2、reset/DEV/seed comparison 都关闭后，才做唯一一次 fresh independent
`REVIEW_TARGET=IMPLEMENTATION` 盲审。reviewer 先给 GO/NO-GO 与 M/S/N，再做证据型 intake。之后按
claude-review-handoff-standard 创建可复制中文 brief，运行 `scripts/check/claude-review-handoff`，把背景、目标、
相对路径、独立核验重点、GO/NO-GO+M/S/N、授权边界交给 Dexter 和 Claude。最终 review 之前，不得声称完成。
```

## 1. 交接结论、问题背景与固定边界

本 handoff 的唯一目标是让一个**新会话**以新的、独立的静态 implementation package，完成
`BPF-U01` 至 `BPF-U06` 的一次性后端性能最终优化；本会话不进入实施。

已完成的 M1 是 68 条 operations-admin command 的静态拓扑/typed-chain 收口，不是最终性能验收。
当前 196 条规范性分母来自
`contracts/registry/operation-handler-bindings.json`：113 条 COMMAND（68 M1、20 platform owner、9
platform protocol、7 workspace protocol、9 public protocol）与 83 条 READ（78 TASK_READ、5 protocol
read exemption）。Claude 复核要求的长期目标不是削减正确性成本，而是为当前及未来所有后台操作建立：

1. 一次请求只有一个声明的命令事务 origin；
2. 请求内授权/路径/会话事实在具名位置加载一次，owner 仍作当前 recheck；
3. 每条操作在改源码前有可核对的数据库形态、组件预算、来源锚点和证据义务；
4. 只在 owner-local 且可证明语义等价时把校验读折叠进写；
5. Testcontainers 和 seed 都产出可比较的正式事件报告，而不是用单次数字宣称收益。

不得用 request/global cache、跨 schema 直读/大查询、跨 owner 便利 BFF、删 idempotency/CAS/audit/lock/
owner recheck/typed failure/必需最终 readback、改 HTTP 请求字段集合或响应形状、改前端行为、新增外部 API、
或改 BP-U06 来降低数字。任务型读取不得套命令 receipt 或写事务规则；超 floor 不是自动失败，但必须逐条
解释用户任务、基数、查询链与 owner 原因。

## 2. 已批准的设计与复核：按此优先级阅读

新会话开始时，先读本仓根 `AGENTS.md`，再依次完整阅读：

1. `PLATFORM-BLUEPRINT.md`；
2. `doc/platform/README.md`、`doc/platform/roadmap-program-registry.json` 及所选 program 的 `CURRENT_*`；
3. `project-memory/index.md` 的所有 kernel，随后运行：
   ```sh
   scripts/context/recall-memory --task-kind implementation --domain backend --consumer-face backend --owner platform --impact database --trigger implementation
   ```
   并逐份打开所有返回的 project-memory 文件及 `sourceRefs`；至少必须重读：
   - `project-memory/decisions/deterministic-context-only.md`
   - `project-memory/decisions/http-crud-efficiency-design-redlines.md`
   - `project-memory/decisions/incremental-compliance-hook.md`
   - `project-memory/decisions/independent-subagent-adversarial-review.md`
   - `project-memory/operations/phase-retrospective-and-systemic-repair.md`
   - `project-memory/operations/implementation-source-reread-discipline.md`
   - `project-memory/operations/claude-review-handoff-standard.md`
4. `scripts/README.md`、`contracts/policy/standards-coverage-matrix.json` 和当前 Roadmap 明示的实现授权；
5. 详设主文：
   `doc/plans/platform/2026-08-10-v2s-backend-performance-final-optimization-implementation-design-codex.md`；
6. Claude 最终权威复核（优先于旧详设中存在冲突的措辞）：
   `doc/review/platform/2026-08-11-v2s-backend-performance-final-optimization-post-remediation-recheck-claude.md`；
7. 本轮 source/row authority：
   - `doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-command-operation-catalog.json`
   - `doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-read-operation-catalog.json`
   - `doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-operation-source-read-ledger.json`
   - `doc/review/platform/2026-08-11-v2s-backend-performance-final-optimization-cur-anchor-rederivation.json`
   - `doc/review/platform/2026-08-11-v2s-backend-performance-final-optimization-design-remediation-intake.md`
   - `doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-design-granularity-manifest.json`。

这些不是背景链接。每次准备实际变更某个 operation 前，重新打开该行的 ledger、catalogue、适用
project-memory/redline、owning source 与详设小节；变更后以同一输入逐点回读。遇到任何不一致，**先读
project-memory，再读详设和该 operation 行，再读 owning source**，不得根据名称、模板或聊天摘要猜测。

### 已闭合与仍须兑现的事实

- Claude 已给设计 `GO (M=0/S=0/N=1)`；M1 静态实现 GO 不等于性能、L2/UAT 或动态 GO。
- 45 条非 M1 current-chain 的确定性重导结果为 `mismatchCount=4`：
  `createPlatformGroupWorkspace`、`transitionPlatformGroupWorkspaceStatus`、
  `updatePlatformGroupWorkspaceDisplay`、`transitionWorkspaceAccountStatus`。`initializeCommercialGroup`
  与 `stagePlatformAsset` 在 direct-field rule 下为 MATCH。BPF-U01 必须重新生成并永久拒绝
  `app/edge/**`、歧义、缺失或 owner/protocol 包外的 `cur` dispatch 锚点；该 dispatch 锚点不能当成
  物理 transaction 证明。
- 87 条 idempotency、45 条 readback、45 条 ORIGIN/JOIN 决策是**应用源码前的显式前置**，必须逐行补全并
  取得详设要求的一次有限独立 receipt；不得在改 adapter 时边猜边定。这是 BPF-U01 的输入完成条件，不是
  整包中途的实现 review。
- Claude 的 `N-01`：`implementation-design-granularity` 尚缺“update 路径必须已存在”的通用对称断言。
  它是 `OUT_OF_SCOPE_HANDOFF_DEBT`，应登记为独立小改动/后续 handoff；**不得**塞入 BPF-U01…U06 的
  implementation surface，不得假装已修，也不得以它阻止本批静态实施。若详设 §3.2 的旧句子提到该断言，以 Claude
  POST_REMEDIATION 的 N-01 范围裁决为准。

## 3. 新会话启动与授权规则

1. 先创建/激活一个新的静态 implementation package；不得复用当前
   `BACKEND-PERFORMANCE-FINAL-OPTIMIZATION-DESIGN-20260810`，它的
   `implementationAuthority=false`、`runtimeAuthority=false`、`seedResetAuthority=false`。
2. 新包第一版只能授权 BPF-U01 所需的精确 control-plane/source-inventory 路径；从 196 行 shape matrix
   导出的具体 Java/controller/owner/generator/test 路径按 `changeSurfaceScopes` 与真实 receipt 扩展，不能用
   app/module 大根目录兜底，也不凭想象预列源码。
3. Dexter 已授权实施 agents 在该设计和合理同根范围内完成任何必要的 source、control、generator、test、
   report、managed-runner preparation 和 evidence 变更；无需中途再请求 Dexter。遇到事实冲突时，记录
   `IMPLEMENTATION_FACT_CONFLICT`（旧行、真实 source/evidence、受影响 operationId、最小红线保持修正、proof），
   然后继续；不得跳过 operation、拆出侧批、弱化断言、改外部 HTTP 契约或提前启动动态环境。
4. 每个实际变更先走现行 Pre/Post hook，记录 package receipt；保留用户/其他 agents 已有改动，绝不 reset、
   checkout 或删除不明资源。若 gate/receipt 首败出现，读取日志/owning source 找根因后再改，不能靠重试、
   超时或降低门逃过。
5. 本次实施只有一次最终独立 `IMPLEMENTATION` review，且它在静态、Testcontainers、L2、reset/DEV/seed 与
   same-basis comparison 全部通过之后进行；BPF-U01…U06 之间不插入“阶段验收 review”。静态 196 行完成后，
   必须先逐行对照 catalogue/source inventory/shape/redline 并记录 design-conformance reconciliation，成功后直接
   进入已授权的 managed dynamic 阶段。BPF-U01 的 87/45/45 catalogue-amendment 独立 receipt 与每项真实 red
   mutation 是实现前置证据，不可省略。

## 4. 必须一口气完成的六个串行实施单元

### BPF-U01 — 控制平面、196 行 source admission 与显式先决决策

先完成 45 条重导、87 idempotency、45 readback、45 ORIGIN/JOIN 的 source-based 决策和 receipt；再做全局
control：`tools/compliance-control/cli.mjs` 不得对缺失 `mandatoryPerEditGate` 静默 return，active package 只能
引用 `contracts/policy/mandatory-per-edit-gate-command-closure.json` 中封闭、兼容、review-bound 的 profile ID。
package 不可嵌任意 argv、换弱门或追加命令。闭集条目增删改本身必须独立评审，且新旧 package template（设计、
控制面、backend、frontend/generated wire、runner/evidence）都有兼容 fixtures；历史 inactive package 不回溯激活。

创建且只由 source inventory 先授权的 196-row source inventory、shape matrix 和 loader catalogue；shape matrix
严格 join 196 bindings、113 topology、68 M1 execution、83 read policy。每行有 shape class、唯一 transaction
origin、fact loaders、组成式 floor、above-floor explanation（必要时）、owner/readback/measurement disposition。
五个 protocol-read exemptions 也必须有 reason/complete-evidence row。新增三条红线：
`ONE_REQUEST_ONE_TRANSACTION_ORIGIN`、`REQUEST_LOCAL_FACT_LOADED_ONCE`、
`OPERATION_DATABASE_SHAPE_DECLARED`，并在 standards matrix 为可机判部分登记 GATE、语义部分登记明确 review
checklist 的 `UNENFORCEABLE_BY_MACHINE`。

同时按详设 §1.3 逐项处置五个已有控制：database-operation-budget 兼容退役折叠、gate-dispositions 登记三新
控制、authority-source-ledger 的 ST-11 修复/退役、read-budget 的五 revoke 真锚点、final-fixture-catalog 的
196 owner/HTTP/OpenAPI 调和。不得把 canonical-performance-ledger 或 command-baselines 偷换成 shape authority。

完成条件：缺 mandatory profile、未知/弱 profile、缺 inventory/shape/budget、错误 floor、`app/edge/**` cur、
缺/歧义 origin、未登记 loader caller 都有 WHY/BACKGROUND/PATTERN 和真实 red mutation；BPF-U02 前不能存在
未决 GAP。

### BPF-U02 — 所有 command 的唯一 origin 与 68/68 binding reachability

让 68 个 M1 HTTP entries 全部经各自 generated binding 进入同名 operation adapter；42 个当前直调 adapter 的
controller 必须迁移，binding 一次且只调用同名 adapter。任何已声明 binding 必须至少被一个 HTTP 入口引用；
HTTP edge 的 direct adapter 或 dead binding 均为红。为 113 条 COMMAND 逐条 source-prove 一个
`ORIGIN` 或 `JOIN_EXISTING_REQUIRED_PARTICIPANT` 链：edge 无 transaction，禁止第二 origin、`REQUIRES_NEW`、
`NESTED`、`TransactionTemplate`/manual begin；owner recheck 仍在 receipt replay 前。保持原 HTTP shape，勿让
binding 变成泛型 dispatcher。

### BPF-U03 — request-local facts：静态准入与运行时回溯闭环

将每个 declared fact loader 收拢到 named origin，允许 immutable fact projection 在 matrix 允许的 edge/
adapter/public owner API 间传递；禁止把它变成缓存，owner 的实时授权/状态 recheck 必留。静态检查发现所有生产
loader caller 并拒绝 catalogue 外 caller；实现新 immutable-snapshot checker，用 HMAC-validated
`db-operations.jsonl` 按 `(runId,requestId,loaderId,callSitePrefix)` 拒绝同请求重复、未知或缺 attribution。
务必诚实：编辑期只能阻止未声明 loader/caller；一次请求是否实际重复只能在 Testcontainers/seed 不可变事件
快照中回溯证明。

### BPF-U04 — 仅经等价证明的 owner-local validation folds

每个 fold 先有完整 owner-local record：`foldedJudgment`、`originalObservableSemantics`、可运行的
`failingCounterexample`、source/readback/error preservation evidence；缺任一项即不折，保留 above-floor 说明。
折叠后仍保持 target selection、current fact/state、CAS、lock、affected-row、typed error、audit/receipt 顺序和
必需 final readback。禁止跨 owner/schema、让 edge data access、删 readback 或改变 zero-row/not-found/conflict。

### BPF-U05 — 78 条任务读取与 5 条 protocol exemption

先把 read-budget 的旧 `OperationsWorkspaceUserController#revoke` 替换为五个真实入口：`groupRevoke`、
`regionRevoke`、`projectRevoke`、`headCompanyRevoke`、`storeRevoke`，并验证丢任一成员必红。然后将 78 TASK_READ
和 5 exemptions 对接 common shape matrix：读取保持 receipt-free、write-transaction-free，G1/G2 和逐行
above-floor 用户任务/基数/查询链/owner 理由不得被模板吞掉。不得把 task read 变成命令风格的统一数字上限。

### BPF-U06 — 报告、比较器与 Testcontainers 正式产物（静态实现；不运行）

先调和 `backend-performance-final-fixture-catalog` 的 196 owner/HTTP/OpenAPI source contract 与红 fixture；
随后让 `seed-report.mjs` 保留原 measurement basis 并添加每 operation/aggregate physical `kindCounts`（含 UPDATE）。
新增同 kind comparator：严格拒绝 basis、coverage/profile、endpoint、UPDATE totals 不同，拒绝 aggregate UPDATE
下降；输出 operation delta 与 profile aggregate，但绝不把 `BP_U07_SQL_MERGE_SUCCESS`/`BP_U07_SNAPSHOT` 改成成功。

同时实现 remote Testcontainers grouped-plan/report schema：可合并共享 fixture 的 scenario，但 196/196 每个
operationId 均须一条 request/event-joined report row；报告绑定 test plan、selector、fixture、measurement basis、
kindCounts、UPDATE、business/cleanup。跨 kind 比较（seed vs Testcontainers）必红。遗漏、unknown、unmatched、
stale container/volume、缺 terminal manifest 或 cleanup fail 都只能产生 incomplete technical report。

## 5. 静态终点、一次 review 与后续动态顺序

静态实施结束前必须：196 exact-set、所有 BPF red mutations、源码/生成 drift、focused compile/tests、mandatory
gate profile、shape/read checks、package-exit receipt/evidence 全部 PASS。随后逐条对照 196 catalogue、source
inventory、shape matrix、redline 和 acceptance/red discriminator，形成 design-conformance reconciliation；有任何
不符先以 `IMPLEMENTATION_FACT_CONFLICT` 修正，未成功不得进入动态。任何静态 PASS 均不等于性能数值成功。

**静态 reconciliation PASS 后，直接由新会话按以下独立 managed package 顺序进行动态验收，不得提前或跳级：**

1. managed remote Testcontainers exact grouped plan，196/196 operation rows，business 与 cleanup 各自 PASS；
2. 本机 managed L2：`node scripts/test/catalog-inventory-l2.mjs --managed`。Spring Boot、两个 admin app、
   Playwright 均在本机，只有中间件通过受管 tunnel 连接远端隔离 namespace；不是远端浏览器/应用，也不是 UAT；
3. 显式破坏性 reset：`R5_RESET_CONFIRMATION=EXPLICIT_R5_RESET node scripts/dev/r5-reset.mjs`；
4. 受管 DEV start：`scripts/dev/r5-dev-runner.mjs start`；
5. 同口径 r5-full seed：`R5_SEED_CONFIRMATION=EXPLICIT_R5_SEED scripts/dev/seed --profile r5-full`，再用正式
   comparator 生成 before/after seed artifact。

上述静态与动态证据全部通过后，才进行唯一一次 fresh independent `REVIEW_TARGET=IMPLEMENTATION` 对抗审查；
reviewer 必须先盲审，读取 path/hash checklist，给 `GO`/`NO-GO` 与 `M/S/N`，作者再做证据型 intake。之后才把
最终 brief 交 Dexter 与 Claude，按 `project-memory/operations/claude-review-handoff-standard.md` 写背景、目标、
仓根相对路径、独立核验重点、`GO/NO-GO + M/S/N` 与授权边界，并运行 `scripts/check/claude-review-handoff`。

每个动态 package 开始前必须读取它自己的 input/manifest/authorization、`scripts/README.md`、
`.agents/skills/cs-managed-runtime-execution/SKILL.md`、`project-memory/operations/dev-command-separation.md`、
`project-memory/operations/phase-retrospective-and-systemic-repair.md`、runner source 与上一 terminal manifest；先做
run-scoped budget preflight。运行中读取 manifest/log，报告 first failure/last-known-good/broken boundary；不得按
端口、命令名或猜测 PID 杀进程，且 cleanup 非 PASS 不能完成。

## 6. 新会话完成定义

实施 agent 的 GOAL 是“完成 BPF-U01…U06 的静态 196-operation 后端性能最终优化、逐项对照详设、完成受管动态
验收，再交 Dexter/Claude review”，不是“让某个 gate 通过”。完成仅在以下条件同时成立：六单元静态闭合、
196 row exact coverage、逐项 design-conformance reconciliation PASS、Testcontainers 196/196 business/cleanup PASS、
本机 managed L2 business/cleanup PASS、reset→DEV→seed same-basis comparison 证据关闭、single final independent
implementation review 产物、Claude handoff 已验证。若尚未达到这些条件，继续实施/诊断，不得用中间 gate 或
seed 单项报告当完成。
