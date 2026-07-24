---
title: catering-v2s W0-W4 执行 Roadmap
status: ACTIVE
createdAt: 2026-07-24
updatedAt: 2026-07-24
programContext: AI_FIRST_FOUNDATION
roadmapId: v2s-w0-w4-execution
programId: V2S_W0_W4_EXECUTION
kind: SUCCESSOR_EXECUTION
stateOwner: self
authorizationOwner: self
registryStatus: ACTIVE
sourceRepository: catering-all-v2
targetRepository: catering-v2s
targetRoadmapId: v2s-w0-w4-execution
targetProgramId: V2S_W0_W4_EXECUTION
targetStateOwner: doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md
implementationAuthority: false
r1AuthorizedBy: Dexter
r1AuthorizedAt: 2026-07-24
r2ControlPlaneAmendmentAuthorizedBy: Dexter
r2ControlPlaneAmendmentAuthorizedAt: 2026-07-24
r2ControlPlaneAmendmentScope: standards-coverage-and-r1-review-resolution-only
gitOwner: Dexter
serviceShapeAuthority: doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md
carryoverAuthority: doc/plans/platform/2026-07-24-v2s-carryover-manifest-claude.md
sourceActionPlan: doc/plans/platform/2026-07-24-v2s-architecture-action-plan.md
reviewRequest: doc/review/platform/2026-07-24-v2s-execution-roadmap-claude-review-request.md
claudeReview: doc/review/platform/2026-07-24-v2s-execution-roadmap-review-claude.md
reviewResolution: doc/review/platform/2026-07-24-v2s-execution-roadmap-review-resolution.md
acceptanceDecision: doc/decisions/2026-07-24-v2s-execution-roadmap-r0-acceptance.md
r1AuthorizationDecision: doc/decisions/2026-07-24-v2s-r1-authorization.md
---

# catering-v2s W0-W4 执行 Roadmap

## 0. Roadmap 身份与当前状态

```text
ROADMAP_ID=v2s-w0-w4-execution
ROADMAP_PROGRAM=V2S_W0_W4_EXECUTION
ROADMAP_KIND=SUCCESSOR_EXECUTION
ROADMAP_OWNER=self
ROADMAP_REVIEWED=true
R0_STATUS=GO
LAST_CLOSED_STEP=R1
CURRENT_STEP=R2
CURRENT_STATUS=IN_REVIEW
CURRENT_NEXT_ACTION=由 fresh v2s-rooted Codex/Claude 会话执行 R2 静态入口验收；不得在本 all-v2-rooted 会话冒充
R1_STATUS=GO
TARGET_STATUS=V2S_HANDOFF_READY
IMPLEMENTATION_AUTHORITY=false
R1_AUTHORIZED=false
R1_CLOSED=true
R2_AUTHORIZED=false
R2_CONTROL_PLANE_AMENDMENT_STATUS=IN_REVIEW
V2S_WRITE_AUTHORITY=false
V2S_SESSION_ENTRY_READY=true
GIT_OWNER=Dexter
```

本文件是 v2s-native Roadmap 的唯一 active state/authorization owner。R1 已关闭；Dexter 已授权 standards coverage、R1 review resolution 与相应 current-truth 导航这一份有限控制面修订包，现已形成并停在 `IN_REVIEW`。`CURRENT_STEP=R2 / CURRENT_STATUS=IN_REVIEW` 不授予 fresh R2 acceptance、W1、DEV 或业务实现：

- 不读取或更新 all-v2 `AI_FIRST_FOUNDATION` 的 `CURRENT_*`，也不继承任何旧程序实现授权；
- target Registry 只登记 `V2S_W0_W4_EXECUTION`；本文件从 R1 transfer PASS 起承担后续状态真相；
- R1 输出与 transfer 已关闭，但 R2 尚未由 fresh v2s-rooted session验收，R3/W1 仍受前置阻断；
- 本次有限修订不把当前 all-v2-rooted 会话冒充为 fresh v2s-rooted acceptance；review 关闭前 `R2_AUTHORIZED=false` 与 `V2S_WRITE_AUTHORITY=false` 保持不变；
- all-v2 source 只按 Heritage registry 的 path/hash 回读，禁止 writeBack/build/runtime fallback；
- Git stage、commit、push 始终由 Dexter 负责。

服务形态、事务、模块 owner、数据访问、迁移、consumer face 与触发条件发生冲突时，始终以冻结 ADR 为准；资产取舍、通用规则与阶段策略以冻结 manifest 为准。本 Roadmap 只拥有执行顺序、阶段状态、验收门和会话切换点，不重新解释业务或架构真相。

## 1. 目标结果

Roadmap 完成时必须同时成立：

1. `catering-v2s` 成为具有仓内 AI-first 入口、确定性 project-memory、只读 Heritage 和标准动作的新工作根；
2. 后端采用一个无状态业务 deployable，保留 bounded context、owner、术语和不变量；
3. PostgreSQL 为单库多 schema、单一 Flyway lifecycle 和一份全局 history；
4. 跨模块状态变更只经目标 `<module>.api` command 并加入同一 `REQUIRED` 事务，页面任务读使用显式、有预算的跨 schema join；
5. 初始不带 MQ、通用 outbox、TDP、内部 OpenAPI client、搜索服务或常态轮询；
6. OpenAPI operation 的 `x-consumer-faces` 是服务端 route face 与两个 admin generated slice 的唯一暴露声明，face 不承担授权；
7. `platform-admin` 与 `operations-admin` 保持独立 app、独立 policy/read model/state/L2/L3；
8. DEV `start/restart` 正常运行 additive Flyway migration，但不 seed；`seed/reset` 是独立显式命令；
9. 当前批准范围的功能、旧路径退出、静态/真库/动态证据及 cleanup 全部可复验；
10. all-v2 只作为带精确冻结点的 Heritage 来源，不再被当作 v2s 目标架构或兼容 runtime。

本目标不等于生产切流或全部生产化欠账关闭。CI 执行平台、备份恢复、密钥轮换、health/readiness、部署回滚、指标告警和单 runtime DB role 权限边界继续由 `HANDOFF.md` 的可判定 trigger 管理。

## 2. 不可突破的全程红线

以下约束适用于 R0-R6，任一违反即暂停当前 Step：

- 一个业务 deployable，不按 bounded context 机械拆服务；
- 一个 PostgreSQL database，多 owner schema，一份 Flyway history；
- 模块 owner 独占 invariant、repository、schema DML 与 audit；
- command/API 写协作和 schema FK 依赖必须无环；task read 可成环但不授予写权、锁、事务传播或 FK 权限；
- coordinator 归发起模块 application 层，零表、零 repository、零自身业务不变量；
- 写事务内跨模块判断只走目标 owner 的窄 judgment API，不执行跨 schema join；
- 初始无 MQ、通用 outbox、内部投影补偿、TDP、内部 HTTP/OpenAPI client、搜索服务；
- 正常路径禁止 polling dispatcher、固定等待、前端 refetch 追平、双读和“稍后重试”补偿；
- `x-consumer-faces` 为唯一 consumer 暴露声明，禁止 frontend allowlist、consumer graph 或源码反推；
- 两个 admin 不共享 Shell、router、store、session/context、page/read model、业务文案或 L2/L3；
- `scripts/verify`、walking skeleton、受影响 L2/L3 分账，互不代证；
- `start/restart/stop/seed/reset` 五命令分权，start/restart 不 seed，reset 不自动 seed；
- 所有动态 run 必须受管，business 与 cleanup 分账，cleanup 非 PASS 不验收；
- 不 stage、commit、push；Git 始终归 Dexter。

## 3. 状态模型与更新纪律

每一步只允许以下状态：

| 状态 | 含义 |
|---|---|
| `BLOCKED_BY_PREDECESSOR` | 前置 Step 未 GO，禁止进入 |
| `WAITING_DEXTER_AUTHORIZATION` | 设计/证据已就绪，但下一动作需要 Dexter 明确授权 |
| `IMPLEMENTING` | 已获本 Step 精确授权，正在执行 |
| `IN_REVIEW` | 本 Step 交付物已形成，等待独立 review |
| `EVIDENCE_READY` | 机器与动态证据齐备，等待最终接受 |
| `GO` | 本 Step 完成条件与 review 均关闭 |
| `NO_GO` | 存在阻断 finding；修订后必须重新 review |

状态更新规则：

1. 只有本文件是 Roadmap 状态 owner；review、evidence、handoff 不复制第二份 `CURRENT_STEP`；
2. Step 状态只能在验收清单逐项引用 evidence 后推进，不能因“文件存在”“测试名为 PASS”或计划完成而推进；
3. 任一 source hash、owner/wire/schema/security/transaction/UI/evidence 边界变化，受影响 Step 回到 `IN_REVIEW` 或 `NO_GO`；
4. R1 完成前，本文件只存在于 all-v2 且保持 draft；R1 完成时按 §7 的控制面移交协议，把经接受版本复制并转换为 v2s-native Roadmap，在 v2s Registry 中登记为后续唯一状态 owner；
5. all-v2 副本在 R1 完成后只保留为 Heritage，不再接收 R2-R6 状态更新；
6. 每步均记录 `startedAt/completedAt/targetHash/reviewRef/evidenceRefs/remainingFindings`；空证据不得写 `GO`。
7. 切换后禁止双写：`CURRENT_*`、步骤看板和执行记录只更新 v2s 目标文件；all-v1、all-v2、v4、v6 均不得作为状态回写目标；
8. v2s Registry 只登记新程序 `V2S_W0_W4_EXECUTION`，不得复制 all-v2 的 `AI_FIRST_FOUNDATION`、Business Migration 或 Remediation 程序状态。

## 4. 七步执行看板

| 序号 | Step | 执行单元 | 当前状态 | 关键结果 | Review owner | 完成标记 |
|---|---|---|---|---|---|---|
| 第1步 | R0 | Roadmap 评审与授权边界冻结 | `GO` | Roadmap 获 Dexter/Claude review，未静默扩权 | Dexter + Claude | `ROADMAP_REVIEWED` |
| 第2步 | R1 | W0 4-7：v2s AI 底座、依赖 registry、HANDOFF、Heritage 切换 | `GO` | v2s 可从仓根恢复身份，all-v2 只读 | Codex + Dexter；边界由 Claude复核 | `V2S_SESSION_ENTRY_READY` |
| 第3步 | R2 | Fresh v2s-rooted 会话验收与 W0 正式关闭 | `IN_REVIEW` | 新会话无需旧聊天即可接管 R3-R6 | fresh Codex + Dexter | `V2S_FOUNDATION_READY` |
| 第4步 | R3 | W1：最薄运行骨架与 walking skeleton | `BLOCKED_BY_PREDECESSOR` | 代理→单 app→单库→双 admin 的登录+真实页面闭环 | Codex + Claude | `WALKING_SKELETON_READY` |
| 第5步 | R4 | W2：机器门、`scripts/verify` 与 red fixtures | `BLOCKED_BY_PREDECESSOR` | 业务迁移前的模块/DB/contract/retirement 强制面 | Codex + Claude | `MIGRATION_GATES_READY` |
| 第6步 | R5 | W3：按模块和 Journey 迁移当前批准范围 | `BLOCKED_BY_PREDECESSOR` | 功能逐波迁移、旧拓扑逐波退出、fresh L2/L3 | Codex + Claude；产品语义归 Dexter | `APPROVED_SCOPE_MIGRATED` |
| 第7步 | R6 | W4：全量复验、移交与 v2s 收口 | `BLOCKED_BY_PREDECESSOR` | 全量证据、零旧路径、HANDOFF 触发审计 | Dexter + Claude | `V2S_HANDOFF_READY` |

## 5. R0：Roadmap 评审与授权边界冻结

### 目标

把冻结 ADR、manifest、行动计划和 continuation handoff 收敛为唯一七步执行路线，确保 Roadmap 足够具体、可验收、可 review，同时不越权进入 v2s 写入。

### 交付物

- 本 Roadmap；
- Codex 自审；
- Claude review request；
- Dexter 对步骤、切换点和授权边界的 review；
- Claude 对架构忠实性、阶段顺序、证据门和授权边界的独立 verdict。

### 验收

- 总步骤不超过 8 个，每步都有目标、交付物、验收、review、阻断与完成标记；
- 明确 R1 结束后的 fresh-session 切换点；
- R0 GO 不自动授权 R1；
- 不改 Registry、Roadmap A `CURRENT_*`、all-v2 runtime/contract/database/test；
- Roadmap 不冒充 implementation-facing 详设：R3-R5 在实现前仍需各自的 approved Journey/Pack/manifest 或 W1/W2 专项详设；
- `scripts/check/claude-review-handoff` PASS；
- Claude 结论达到 `GO(0 M / 0 S / N*)`，M/S 必须关闭后才能标 GO。

### 当前执行记录

```text
startedAt=2026-07-24
completedAt=2026-07-24
targetHash=a0057c3a49fbb6a64225abb089122de1bc26b94784ca8f746c7fbfad3ccbd9b5
reviewRef=doc/review/platform/2026-07-24-v2s-execution-roadmap-review-claude.md;doc/review/platform/2026-07-24-v2s-execution-roadmap-review-resolution.md;doc/decisions/2026-07-24-v2s-execution-roadmap-r0-acceptance.md
evidenceRefs=CLAUDE_GO_0M_0S_2N;N1_N2_CLOSED;DEXTER_ACCEPTED
remainingFindings=NONE
```

## 6. R1：W0 4-7——v2s AI 底座、依赖 registry、HANDOFF 与 Heritage 切换

### 目标

在 Dexter 明确授权后，只在现有 `catering-v2s` 仓建立能承载后续工作的最小 AI-first/governance 根；不进入 W1，不创建业务 runtime。

### 交付物

1. v2s 自有 `AGENTS.md`、`CLAUDE.md`、`PLATFORM-BLUEPRINT.md`；
2. 仓内 `.agents/skills`、`.claude/skills` 适配、最小 hooks；
3. v2s 自有 `project-memory` kernel/routed/index、确定性 memory/code/failure recall；
4. 先建立空的 Roadmap Registry/active-document-index 基线，再只登记 v2s-native `V2S_W0_W4_EXECUTION`；不得复制 all-v2 任一程序状态；
5. 单一模块依赖 registry，结构支持 `COMMAND / SCHEMA_FK / TASK_READ`；无 runtime 时不虚构边；
6. `HANDOFF.md` 七项生产化欠账与 `scripts/check/handoff-debt`；
7. 冻结 ADR、manifest、本 Roadmap及 `doc/heritage/registry.json`；
8. `doc/evidence/platform/2026-07-24-v2s-roadmap-control-plane-transfer.json`，记录 source/target hash、最后关闭 Step、下一 Step、Registry owner 和 Heritage 边界；
9. `scripts/check/roadmap-control-plane-transfer` 及会真实失败的双 owner、hash 漂移、状态断档、source write-back 红夹具；
10. all-v1/all-v2/v4/v6 的 source path、冻结文件 hash、`READ_ONLY_HERITAGE`、`writeBack=false` 和 `runtimeFallback=false` 记录；
11. R1 closure evidence，明确没有 W1 runtime、DEV、seed/reset 或 Git 写操作。

### 验收

- target HEAD 仍从已核验的 `5b08350` 基线演进，修改只落在批准 W0 allowlist；
- project-memory build/check、deterministic recall、provider-free zero-ref 全绿；
- module dependency registry schema/唯一性/edgeKind/空现实边检查全绿；
- HANDOFF 七项存在、字段完整、stable ID 唯一、trigger 可判定；
- v2s Registry 可按显式 `programId=V2S_W0_W4_EXECUTION` 唯一解析目标 Roadmap，Roadmap frontmatter 与 Registry identity/owner 一致；
- transfer receipt 证明 `sourceAcceptedHash -> targetAdoptedHash`、`lastClosedStep=R1 -> currentStep=R2` 连续且无双 owner；
- all-v1/all-v2/v4/v6 均无写入；all-v2 冻结输入 hash 与 preflight 一致；
- v2s 中 `apps/**`、migration、业务 OpenAPI、DEV runtime 均不存在；
- Roadmap 迁入 v2s 后成为 R2-R6 唯一状态 owner，all-v2 副本转只读；
- `scripts/check/roadmap-program-registry` 与 `scripts/check/roadmap-control-plane-transfer` 的 clean/red controls 全部 PASS；
- business=`PASS`、cleanup=`PASS`、active managed resources=`0`；
- 完成标记精确为 `V2S_SESSION_ENTRY_READY`，不能写 `WALKING_SKELETON_READY`。

### Review

- Codex：逐文件 create/update/delete/retain、链接、hash、provider-free、空 Registry 与权限边界自审；
- Dexter：确认 W0 文件范围与 all-v2 Heritage 切换；
- Claude：只复核冻结输入忠实性、重复真相、旧拓扑规则是否误播种和切换门是否可靠；GO 不授权 W1。

### 当前执行记录

```text
startedAt=2026-07-24
completedAt=2026-07-24
targetHash=BOUND_BY_TRANSFER_RECEIPT
reviewRef=doc/review/platform/2026-07-24-v2s-r1-codex-self-review.md
evidenceRefs=doc/evidence/platform/2026-07-24-v2s-r1-implementation-closure.json;doc/evidence/platform/2026-07-24-v2s-roadmap-control-plane-transfer.json
remainingFindings=NONE
```

## 7. 会话切换闸门

**Dexter 可以在第2步 R1 完成后、第3步 R2 开始时，在与 all-v2 同级的 `catering-v2s` 仓库根开启新的 Codex/Claude 会话。**

### 7.1 Roadmap 控制面移交协议

R1 不做“复制一份 Markdown 然后靠人记住继续更新”，而是执行一次可失败、可审计的状态 owner 切换：

1. **先准备 source evidence，不预宣称 GO**：在 all-v2 中完成 R0 review 和 R1 的实现、clean/red evidence 与 review refs；本 Roadmap 的最后一次 source 写入只能把 R1 记为 `EVIDENCE_READY / TRANSFER_PENDING`，不得先写 `GO`，随后计算并冻结 `sourcePreparedHash`；
2. **只向 v2s 写入 target-native 副本**：目标路径固定为 `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`，保留全部历史步骤与验收，把目标 frontmatter 设为：

   ```text
   roadmapId=v2s-w0-w4-execution
   programId=V2S_W0_W4_EXECUTION
   kind=SUCCESSOR_EXECUTION
   stateOwner=self
   authorizationOwner=self
   status=PREPARED
   ```

3. **登记而非猜路径**：v2s `doc/platform/roadmap-program-registry.json` 只新增这一条 v2s-native program entry，`stateOwner` 与 `authorizationOwner` 都指向目标 Roadmap，`batchIds=[]`；R5 未来批准的 Batch 必须另经 review 后显式加入，禁止预填；
4. **建立导航**：v2s `doc/platform/active-document-index.json` 只导航 Registry、目标 Roadmap、冻结 ADR/manifest 和 Heritage registry，不复制 `CURRENT_*`；
5. **两阶段连续推进，Registry 最后发布**：
   - prepare current：current-path Registry entry=`PREPARED_NON_AUTHORITATIVE`，current-path target Roadmap=`LAST_CLOSED_STEP=R0 / CURRENT_STEP=R1 / CURRENT_STATUS=EVIDENCE_READY / V2S_SESSION_ENTRY_READY=false`，receipt=`PREPARED`；普通 Registry resolver 必须拒绝把它当 active owner；
   - complete candidate：在非 current 的 run-scoped 临时目录生成完整 final Roadmap、final receipt 与预期 ACTIVE Registry bytes；candidate Roadmap 可以包含 `LAST_CLOSED_STEP=R1 / CURRENT_STEP=R2 / R1_STATUS=GO / V2S_SESSION_ENTRY_READY=true`，但它尚不可被普通 resolver 发现；
   - candidate gate：用 `sourcePreparedHash`、candidate target/receipt/expected-active-Registry/Heritage hash 和 R1 evidence 跑 `roadmap-control-plane-transfer --candidate-root <run-scoped-dir>`；PASS 只证明整套 bytes 可发布，不改变 owner；
   - publish non-owner files：candidate PASS 后先把已验 final Roadmap 与 receipt 发布到 current path，current Registry 仍为 `PREPARED_NON_AUTHORITATIVE`，因此 target 仍不是 current owner；
   - activate Registry last：把已经验 hash 的 ACTIVE Registry bytes 作为唯一 owner-switch 文件，以同目录临时文件 + fsync + atomic rename 发布；这是第一个令 R1 GO/R2/session-ready 可被普通 resolver 发现的时点；
   - post-publish readback：只读重跑 final check，验证 current bytes 与 candidate hashes 完全相同。不得从 R1 跳到 R3。
6. **写 transfer receipt 与 post-transfer closure**：immutable candidate receipt `doc/evidence/platform/2026-07-24-v2s-roadmap-control-plane-transfer.json` 至少记录 `phase/sourceRepository/sourcePath/sourcePreparedHash/sourceFinalState/targetRepository/targetPath/targetAdoptedHash/registryPath/expectedActiveRegistryHash/programId/lastClosedStep/currentStep/candidateVerifiedAt/reviewRefs/implementationClosureHash/heritageRegistryHash/business/cleanup/activeManagedResources`；receipt 不含 `transferredAt`、不自哈希，且在 candidate gate 后不再修改。Registry-last 激活并由普通 resolver 完成 readback 后，另写不属于 candidate bytes 的 `doc/evidence/platform/2026-07-24-v2s-r1-post-transfer-closure.json`，记录真实 `activationObservedAt`、active Registry/target/receipt/implementation closure hashes 与 resolver PASS；
7. **机器验证唯一 owner**：`scripts/check/roadmap-control-plane-transfer` 同时调用 `scripts/check/roadmap-program-registry`，拒绝未注册 Roadmap、两个 active state owner、source/target hash 缺失、R1→R2 断档、Registry/frontmatter 不一致、all-v2 被登记为 current owner 或 Heritage `writeBack=true`；
8. **失败回滚**：prepare/candidate gate 失败只修 v2s R1，source 保持 `EVIDENCE_READY / TRANSFER_PENDING`；Registry-last 发布前失败时恢复 Roadmap/receipt prepared snapshot；post-publish 失败时必须**先**原子恢复 PREPARED Registry、令 resolver 立即停止返回 target，再恢复 Roadmap/receipt prepared snapshot。source 始终不回写。红夹具必须模拟“source 已准备、candidate 未通过”“non-owner files 已发布但 Registry 未激活”和“Registry 激活后 readback 失败”，逐态证明无双 owner或可发现的虚假 GO；
9. **切换标记的可见性**：`V2S_SESSION_ENTRY_READY=true` 可以存在于未发布 candidate 或 Registry 仍 PREPARED 时的 current Roadmap bytes，但普通 resolver 不得返回它；只有 candidate gate PASS 且 ACTIVE Registry 最后发布后，它才成为 current truth。source 不再追加“R1 GO”回写；R1 GO 的唯一 current truth 是 post-publish readback 通过后的 target Roadmap与 receipt。

“复制”因此包含两个明确动作：保留经接受的 source 内容，以及在 v2s 内做一次有 receipt 的 target adoption。target 因 frontmatter 和当前状态转换而与 source hash 不同是预期行为，必须由 receipt 同时记录两端 hash，不能伪装成字节相同。

### 7.2 旧仓只读策略

- **all-v1**：从 R0 起始终是只读 Heritage；R0-R6 不在 all-v1 创建 marker、更新 Roadmap、修文档、写 memory 或执行任何 Git 写操作；
- **all-v2**：只在 R0/R1 期间承担本 draft 与 source closure；transfer gate PASS 后不再更新本文件或任何 R2-R6 状态，也不为“标记只读”回写 all-v2；
- **v4/v6**：始终只读 Heritage，不接收状态或修订；
- **只读状态记录位置**：统一写在 v2s `doc/heritage/registry.json` 和 transfer receipt 中，不通过修改旧仓来声明旧仓只读；
- **未来发现旧资料有误**：在 v2s 建新 decision/erratum 并引用旧 path/hash，禁止回旧仓改原文；
- **未来需要读取 Heritage**：只允许按 registry 的 path/hash 回读；hash 不一致时 fail closed 并要求新 decision，禁止把漂移后的旧仓内容自动升级为 current truth；
- **禁止 fallback**：v2s build、runtime、test、scripts 和 current Roadmap 不得依赖 all-v1/all-v2 路径；旧仓离线时，v2s 的控制面与当前工作仍须可运行。

### 7.3 失败与恢复

- prepare gate 失败：不切换，修复动作仍只限已授权的 v2s R1 allowlist；all-v2 source 保持 `EVIDENCE_READY / TRANSFER_PENDING` 临时 owner；
- candidate gate 失败：candidate 留在 run-scoped 临时目录供诊断，不发布 current owner；
- Registry-last 发布后的 post-publish readback 失败：先原子恢复 PREPARED Registry，再按 §7.1 恢复 target Roadmap/receipt；target resolver 必须回到 non-authoritative，禁止为恢复诚实状态而把 source 预写成 GO；
- transfer gate 已 PASS：从此只修 v2s target Roadmap/Registry/receipt，不重新打开 all-v2 或 all-v1 写入；
- 新会话找不到 Roadmap、Registry 解析不唯一或 receipt/hash 不一致：R2=`NO_GO`，停止 R3，不得从聊天摘要手工续跑；
- Git 尚未由 Dexter 提交不改变状态 owner 判定；transfer receipt 必须如实记录 target worktree/hash，绝不能把未提交状态写成已提交。

切换前必须同时看到：

```text
R1_STATUS=GO
V2S_SESSION_ENTRY_READY=true
TARGET_REPOSITORY=<与 all-v2 同级的 catering-v2s 仓库根>
TARGET_HEAD=<R1 target hash>
TARGET_WORKTREE=<如实记录；Git stage/commit 仍由 Dexter 决定>
ROADMAP_PROGRAM=V2S_W0_W4_EXECUTION
ROADMAP_OWNER=doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md
ROADMAP_TRANSFER_CHECK=PASS
LAST_CLOSED_STEP=R1
CURRENT_STEP=R2
ALL_V2_ROLE=READ_ONLY_HERITAGE
ALL_V1_ROLE=READ_ONLY_HERITAGE
ACTIVE_MANAGED_RESOURCES=0
```

新会话从 v2s 仓根开始，先读 v2s 自有 `AGENTS.md`、Blueprint、Roadmap Registry、本 Roadmap `CURRENT_*`、project-memory kernel/routed refs、Heritage 和 scripts README。不得从本聊天摘要、all-v2 Roadmap A 或 all-v2 runtime 推断 v2s 实现许可。

R1 之后，当前 all-v2-rooted 会话不再执行 R2-R6。R2 的 fresh evidence 必须由 v2s-rooted 会话产生；跨仓 `cd` 后直接运行脚本不能冒充 fresh project-root discovery。

## 8. R2：Fresh v2s-rooted 会话验收与 W0 正式关闭

### 目标

证明 v2s 的 AI-first 入口不是静态文件摆设，新会话能独立恢复身份、架构红线、Roadmap 状态、记忆、Heritage、标准动作和 Git/授权边界。

### 交付物

- fresh v2s-rooted Codex acceptance evidence；
- fresh Claude（若客户端可用）或诚实的 `UNVERIFIED_CLIENT_UNAVAILABLE` 记录；
- session/prompt/recall/stop 生命周期 evidence；
- Roadmap/Registry owner 对账；
- transfer receipt/source-target hash/唯一 owner 对账；
- W0 closure decision/evidence；
- R3 的专项设计入口说明，保持 implementation authority 关闭。
- `contracts/policy/standards-coverage-matrix.json`：按冻结 manifest hash 绑定 Part B-D 的 150 个结构单元、11 份 current memory 原文、机器执法或显式 review checklist；
- `scripts/check/standards-coverage`：source denominator、memory anchor、phase 到期、active ref 与 review checklist 的 clean/red validator；
- target-native R1 execution-framework review resolution：按 path/hash 接收 transfer 后落在 all-v2 的 Claude review，不回写 source，也不修改 immutable R1 closure；
- Claude 入口显式登记为 `CLAUDE_ENTRY_INTENTIONAL`，不创建未经真实客户端验证的第二套 hook 配置。

### 验收

- fresh session 自动发现 v2s 仓内 skills/hooks，不读取全局同名 skill；
- memory recall 只走 project-memory，code recall 只走 `rg`/源码；
- source reopen 与 hash 一致，provider/daemon/cache readiness 为零；
- Prompt 不自动查询或注入候选；
- Stop 只阻断 active goal/managed run/cleanup；
- 新会话能准确复述一个 deployable、单库多 schema、三类依赖边、双 admin、无 MQ/outbox/TDP、start/restart 不 seed；
- 新会话按 `programId=V2S_W0_W4_EXECUTION` 解析唯一 `CURRENT_*`，不得读取 all-v2 的 `AI_FIRST_FOUNDATION` 作为 current；
- all-v2 只能经 Heritage 导航，不能成为 current implementation fallback；
- manifest hash 必须为矩阵声明值，结构分母精确为 B=85、C=23、D=42、合计 150；`project-memory/index.md` 仅为生成导航，不能充当 memory anchor；
- 150 个结构单元逐项具备 source text hash、active memory assertion 与 enforcement；机器不能判断者必须绑定存在的 review checklist，禁止假装 gate 理解业务语义；
- `scripts/check/standards-coverage --phase R2` 与 `--self-test` PASS；缺规则、缺 memory、PLANNED 逾期、坏 active ref、缺 review checklist 均真红；
- R3/R4 到期的 `PLANNED` 可在 R2 诚实保留，但 fresh R2 evidence 必须逐项核对 due phase，不能用未来计划冒充当前 enforcement；
- immutable post-transfer closure 保持原 hash；findings resolution 由新 target-native resolution 指向 implementation closure `/defectRetrospective`，禁止回改 R1 evidence；
- Claude 入口的 intentional 差异由 fresh 人工 review 证明，不用静态文件存在冒充真实 client discovery；
- cleanup PASS、active resources=0；
- 完成标记为 `V2S_FOUNDATION_READY`；该标记只允许设计 R3，不自动授权写 W1。

### Review

- fresh Codex 提交原始 evidence；
- Dexter 确认可以关闭 all-v2-rooted continuation task；
- Claude 只在真实 v2s-rooted 客户端可用时提供 discovery/恢复独立证据，不伪造。

## 9. R3：W1——最薄运行骨架与 walking skeleton

### 目标

建立可从零启动的最薄真实链路：标准基础设施反向代理、一个业务 app、一个 PostgreSQL database、多 owner schema、两个独立 admin app，并完成登录加一个真实页面的 walking skeleton。

### 进入条件

- R2=`GO`；
- W1 专项 spec/plan/implementation-facing 详设已经独立审查；
- W1 详设把 manifest 附录开工清单 #3 精化为 `GATE_0`：在任何 walking skeleton 业务代码前，先建立并跑绿 R3 最小门子集；
- Java 21 + Spring Boot 4.1 compatibility spike 有精确版本和依赖白名单证据；
- Dexter 对 W1 exact scope 明确授权；
- 业务 Journey 实现仍只限 walking skeleton 的批准入口，不批量迁移 feature。

### 交付物

1. `GATE_0` 最小门子集：D.1 后端模块/前端目录布局门，D.2 walking-skeleton OpenAPI/`x-consumer-faces`/生成闭包门，D.3 每门共用 production validator 的 self-test 与至少一个真 red fixture，以及全局 Flyway 版本/单 history 门；
2. `apps/backend` 单 deployable 与 owner module skeleton；
3. platform-admin、operations-admin 两个 app；
4. edge OpenAPI 与按 face 生成的最小 server/client closure；
5. PostgreSQL 单库多 schema、一份 Flyway history、UTC 毫秒版本；
6. 标准反向代理配置、覆盖式 trusted headers、`X-Edge-Auth`、直连 app 拒绝；
7. `start/restart/stop/seed/reset` 五命令分权；
8. 登录 + 一个真实页面 + owner readback 的 L2 walking skeleton；
9. business/cleanup、target hash 和最小运行 handoff。

### 验收

- 一个业务进程、一个 database、一份 Flyway history；
- `GATE_0` 的 clean control 与全部 red fixtures 在第一行业务代码前已真实 PASS；证据必须记录先后顺序，禁止用 R4 事后补门追认 R3；
- R3 只建立 walking skeleton 所需的最小强制面；R4 仍负责完整 ArchUnit、query、真库安全、reachable wire、retirement、受影响 L2 映射和 `scripts/verify` 收口，二者不得互相代证；
- start/restart 会应用 additive Flyway migration，但不 seed、不 reset；
- reset 按 database + asset allowlist 清理，前后 readback 完整，reset 后不 seed；
- 外部伪造 forwarded/correlation/internal headers 被覆盖或剥离；
- 缺失/错误 edge credential 的 app 直连被拒绝；
- 两个 admin generated endpoint/type slice 无交叉 import；
- walking skeleton 真实通过代理访问，不允许测试直连 app；
- Spring/PG/生成 binding/登录/页面 readback 均为 fresh；
- dynamic business PASS、cleanup PASS、active resources=0；
- 完成标记 `WALKING_SKELETON_READY`，不冒充全部功能迁移。

### Review

Claude 独立核验 owner/transaction/schema/security/contract/generated boundary 与动态 evidence；Dexter 只裁决版本硬阻塞、产品入口或范围变化。

## 10. R4：W2——机器门、scripts/verify 与 red fixtures

### 目标

在批量业务迁移前建立便宜、确定性、会真实失败的强制网，使模块、事务、schema、query、consumer face、生成面、运行资源和旧路径退出都能被原生工具裁决。

### 交付物

1. ArchUnit：模块 import、repository/domain 可见性、command transaction、coordinator 零资产、listener 白名单、API 类型；
2. dependency registry 与 imports/FK/task query 三方现实对账；
3. Flyway/global history/module DDL/FK owner/版本门；
4. Testcontainers 从零 migration、rollback、跨 workspace FK、安全谓词、CAS/约束负例；
5. SQL query 禁 DML/锁/`SELECT *` 与 DB 次数预算；
6. OpenAPI `x-consumer-faces` → server route registry → 双 admin generated slice 精确对账；
7. per-target operation reachable wire closure 与 foundation wire-agnostic 门；
8. `scripts/verify` 单入口、原生 test discovery、red fixtures；
9. retirement zero-reference/registration/route/generated-symbol 门；
10. `scripts/check/handoff-debt` 和确定性受影响 L2 映射。
11. `scripts/check/standards-coverage --phase R4` 纳入 `scripts/verify`；所有 machine-enforceable 规则必须由已存在的 gate/ArchUnit/negative fixture 承接，所有人审规则保留显式 checklist。

### 验收

- 每个门有真实 validator、标准入口、至少一个 red fixture 和失败定位；
- `scripts/verify` 分钟级、一次性退出，不启动浏览器/持久 DEV、不读写 DEV DB、不 seed；
- blind wrong implementation 会被 discriminator 拒绝；
- dependency registry 的三类边与现实一致；command/schema DAG、read target 存在性均 PASS；
- `x-consumer-faces` 缺失、未知、额外/漏生成 endpoint 均会失败；
- 全局 Flyway、模块 DDL owner、immediate composite FK 与禁止 CASCADE/DEFERRABLE 可失败；
- standards coverage source/memory denominator 无漂移，所有 `enforcementPhase<=R4` 的 `PLANNED` 已清零；active ref 与 red fixture 均真实存在；
- static PASS 不升级为 walking/L2/L3 PASS；
- 完成标记 `MIGRATION_GATES_READY`，仍需每个迁移波自己的 Journey/owner evidence。

### Review

Claude 执行独立 code/evidence review，重点验证门真的调用 production validator、red fixture 真红且没有 consumer graph/第二真相。

## 11. R5：W3——按模块和 Journey 迁移当前批准范围

### 目标

以稳定 module/owner 和批准 Journey 为单位迁移当前既定功能；每波同时交付 replacement、旧路径退出和 fresh evidence，不保留多服务兼容双路径。

### 波次原则

- 先迁稳定 owner/invariant，再迁跨模块 coordinator；
- 状态变更经目标 owner command，业务判断经 judgment，页面展示经 task read；
- 每个 surface 独立 read model，默认 DB 次数预算不超过批准值；
- 一个波次只覆盖有限 module/Journey 分母，不能等同整个产品；
- owner/contract/schema/security/transaction 变化触发 Claude 独立评审；
- Journey 或产品语义变化回 Dexter，不让实现反推需求。

### 每波必须交付

1. 批准 Journey/用户任务、module owner、wire、schema、transaction、security 与 UI/read-model 设计；
2. create/update/delete/retain 清单和旧 topology replacement map；
3. command/judgment/task-read dependency registry 更新；
4. migration、owner implementation、consumer task、readback；
5. `scripts/verify + walking skeleton + deterministic affected L2/L3`；
6. 跨 workspace、revoked、CAS、capability/page/scope、失败恢复负例；
7. 旧 service client/proof/projection/polling/MQ/outbox/frontend compensation/test 的零引用退出；
8. phase retrospective、memory delta、business/cleanup 和 target hash。

### 全步验收

- 当前批准模块/Journey inventory 100% 有 disposition 和 evidence；
- 所有写命令同事务失败整体回滚，owner audit 同事务；
- 页面组合不再由前端扇出/重试/双读追平；
- 两个 admin 各自保持任务、状态、文案和 L2/L3 owner；
- 所有被替换旧路径达到 zero reference/registration/route/generated symbol；
- 每波 static/DB/dynamic/business/cleanup 分账且 fresh；
- HANDOFF 未触发欠账不阻断；已触发欠账必须先关闭；
- 完成标记 `APPROVED_SCOPE_MIGRATED`，不自动等于生产切流。

### Review

每波先由 Codex 自审与系统性同类扫描；高风险边界交 Claude；Dexter 只处理产品/Journey、新范围、外部协调、破坏性数据和 Git。

## 12. R6：W4——全量复验、移交与 v2s 收口

### 目标

把 R1-R5 聚合为可由正式团队继续维护的、证据自足的 v2s 基线，同时诚实保留未触发的生产化欠账。

### 交付物

- 全量 `scripts/verify` 原始结果；
- walking skeleton 与全部受影响 L2/L3 聚合，不升格子证据；
- module/Journey/owner/contract/schema/security/transaction closure inventory；
- all-v2 旧 topology retirement inventory 与零残留证据；
- managed resource residual scan；
- HANDOFF 七项 trigger 审计与已关闭 decision refs；
- fresh repository-root handoff、运行/验证命令和已知边界；
- Dexter/Claude 最终 review packet。

### 验收

- 每个当前批准用户任务均有真实 owner readback 与失败/恢复证据；
- 每个 module invariant、dependency edge、migration、generated face 与 consumer slice 可追溯；
- 全量静态/真库/动态 evidence target hash fresh；
- business PASS、cleanup PASS、active resources=0；
- all-v2 仅存在于 Heritage refs，无 runtime/build/test fallback；
- 未触发 HANDOFF 欠账有完整 currentBoundary/risk/trigger/evidence；
- 已触发欠账有 decision、实现和 fresh evidence，不能只改状态；
- Claude 给出 `GO(0 M / 0 S / N*)`，Dexter 接受最终范围；
- 完成标记为 `V2S_HANDOFF_READY`。除非另有生产/cutover decision，不得写 `PRODUCTION_READY`、`CUTOVER_READY` 或 `RETIRED`。

## 13. 全局风险与停止条件

| 风险 | 首要控制 | 停止条件 |
|---|---|---|
| all-v2 未跟踪冻结文件漂移 | R1 记录 exact SHA-256 与 source path | hash 变化且无新 decision |
| Roadmap 跨仓后失去状态 owner | target-native Registry + transfer receipt + unique-owner red fixture | v2s 无法按 programId 解析唯一 CURRENT_* |
| source/target 双写或回写旧仓 | v2s 单 owner、Heritage `writeBack=false` | R2-R6 状态出现在 all-v1/all-v2 或旧仓被修改 |
| 多服务规则误播种进 v2s | ADR 优先、精选 memory、provider-free/negative checks | 出现七服务/MQ/projection/internal client current rule |
| Roadmap GO 被误读为实施许可 | 每步独立 Dexter authority 与 `implementationAuthority=false` | 未授权写入或进入后继 Step |
| 单体退化为无边界 CRUD | ArchUnit、schema owner、三类 registry、owner tests | 跨模块 repository/domain/DML |
| 全局 Flyway 失控 | UTC 毫秒版本、owner DDL、clean migrate/validate | 多 history、跨 owner ALTER、重复/倒序版本 |
| task read 演变为数据上帝层 | 发起任务 module owner、surface read model、DB 预算 | 全局 query/BFF、万能 DTO、写事务 join |
| consumer face 漂移 | OpenAPI 单一声明与 server/client 三方对账 | allowlist/consumer graph/额外 endpoint |
| 旧最终一致补偿复活 | retirement inventory 与 UI negative checks | polling/refetch/double-read/fixed wait |
| 动态 evidence 假绿 | run-scoped manifest、真实 readback、business/cleanup | reuse DEV、旧 hash、cleanup 非 PASS |
| HANDOFF 变第二 Roadmap | 七字段/七项/只追加 closedBy | 普通 TODO、业务 backlog 或架构真相进入 |

## 14. Review 请求的判定问题

Dexter 与 Claude 本轮应只评审以下问题：

1. 七步粒度是否足够大而不遗漏 W0-W4 的关键闭环；
2. R1 结束后开放 fresh v2s 会话是否过早或过晚；
3. R2 与 R3 的 Foundation READY / walking skeleton 权限是否清晰分离；
4. W2 机器门是否确实先于批量业务迁移；
5. R5 的按模块/Journey 波次是否仍可能退化为整仓大爆炸或逐小文件碎片化；
6. R6 的 `V2S_HANDOFF_READY` 是否诚实区别于生产/cutover；
7. 是否有任何步骤让 Roadmap、review 或静态门越权替代 Dexter 授权、业务证据或 cleanup。

## 15. MEMORY_DELTA

```text
MEMORY_DELTA=NONE
RATIONALE=本 Roadmap 是未来 v2s 的执行状态与阶段验收设计，尚未改变 all-v2 当前 active memory；R1 在 v2s 重播种时建立目标仓自己的 memory truth。
```
