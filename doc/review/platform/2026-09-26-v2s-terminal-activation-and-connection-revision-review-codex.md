# 终端激活与长连接需求 · 修订稿复核

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=DEXTER_TRANSMITTED_CODEX_REVIEW_2026-09-26
REVIEW_ROUND=2
reviewerKind=CODEX_PRIMARY_AGENT_SOURCE_REVIEW
INDEPENDENT_INPUT=revision_blind_review_recovery 的盲审 finding；已逐项重开仓内正本核验
SCOPE=只读复核修订需求；未运行构建、测试、DEV、backend-acceptance、L2 或任何受管运行
```

## 结论

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/1/1
L1_ENGINEERING=1 条 S finding：R-12/V-G1 尚不能证明所有改写或排除的机械门均有有效执行路径
L2_USER_VISIBLE=需求层面的 UI 范围与 D-18 一致；界面尚未实施，本轮没有渲染或 L2 证据
L3_UNVERIFIED=backend-acceptance 双业务后端加 TDS 的实际拓扑；本需求实现后的 TER Web/设备一致性与门店终端 L2 重新准入，均未运行
SAME_ROOT_SCAN=S-1 已核对 R-12 列出的所有门类别、verify 命令清单和独立门入口；N-1 已核对 R-10.3、§10、V-T7 的重试公式与判据
DESIGN_GAPS=每个未接入 scripts/verify 的改写门所需的替代验证命令/清单、责任批次与红夹具闭环；verify 分钟级判定所用的具体执行模式
TEMPLATE_COVERAGE=Journey 模板逐节覆盖；IA、交互、implementation-facing 详设模板均按本轮“需求复核”范围标记 NOT_APPLICABLE_WITH_REASON，详见下文
EVIDENCE_TIER=STATIC_SOURCE_AND_REQUIREMENT_REVIEW；无构建、测试、动态或业务验收证据
```

修订稿对先前四条 S 的处置总体成立。本轮独立核验没有发现 R-1.6 两种同操作重试形态、R-10.3/R-10.4 的时序与 owner 边界、R-9.6 的保留范围、R-15 生成闭包或批次 ②a/②b 顺序上的新阻断。旧 server-config 语句仍保留在路由记忆中，但该文件已明确把前述批次标为历史，故我没有把它当作仍有效的禁建规则。S-1 仍阻止本轮给 GO。

## Findings

### S-1 · R-12/V-G1 没有为所有门规定可执行的失败路径

- **位置**：R-12 §3.12；V-G1。
- **性质**：仓内事实 + 推论。
- **状态**：`CONFIRMED`。
- **证据**：
  - 需求把逐门决定“接入 `scripts/verify` 或说明不接入理由”交给详设，但没有规定不接入项的替代验证路径：`doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:446`。
  - V-G1 要求改写门的红夹具使 `scripts/verify` 失败，同时将未接入项交由 R-12 的理由兜底；未要求其替代命令或人工检查实际失败：同需求 `:791`。TDS 单元测试失败也被要求使 `scripts/verify` 失败：同需求 `:450`。
  - `scripts/verify` 的静态命令闭集从 `tools/verify-gates/verify.mjs:14` 开始并在 `:76` 结束；独立 runtime 命令从 `:78` 开始。`--validate-only` 在 `:243` 进入静态-only 返回、在 `:247` 结束；默认模式则在 `:251` 执行 runtime 命令。因此当前条款未说明 V-G1 指默认模式还是 `--validate-only`，两者执行面不同。
  - 后台编码规范规定门清单以 `tools/verify-gates/verify.mjs` 为准，且“门存在 ≠ 门生效”：`doc/platform/backend-coding-standard.md:21`。R-12 点名的独立入口确实存在，例如 `scripts/check/security-boundaries:3`、`scripts/check/operation-handler-bindings:5`、`scripts/check/r5-edge-materialize:6`；它们不能仅凭“有理由不接入”证明有效。
- **影响**：一个机械门可以被排除并附理由，却没有任何被要求执行的替代检查；或红夹具只在未指明的完整 `scripts/verify` 模式里失败。这样 V-G1 不能判定相关门是否仍能抓住违规，也无法同时核验分钟级约束与失败传播。
- **最小修正（可验收判据）**：在 ②a/②b 详设 GO 前，按 R-12 的仓内检索结果形成有限门清单；每项写明门/文件、所属批次、确切命令与 `scripts/verify` 模式、红夹具及其失败传播。接入项必须证明指定模式运行红夹具时以非零退出；排除项必须给出不接入原因、唯一替代命令或具名 review checklist、责任批次和同一违规形状的红证明。若替代项是语义判断，应标为不可机械化并指定 reviewer checklist，不能把理由本身当作验证。对新增执行项记录实际耗时，并按项目的分钟级约束验收；不可将默认全量 runtime 模式与 `--validate-only` 混称。
- **需要 Dexter 裁决**：否。此项是门的可执行性与证据闭环，不改变产品语义；严重度接受权仍归 Dexter。

### N-1 · 达到重试上限后，随机量退化为固定 300 秒

- **位置**：R-10.3、§10「重连随机量」、V-T7。
- **性质**：仓内事实 + 可靠性推论。
- **状态**：`CONFIRMED`（公式结果）；影响为低严重度推论。
- **证据**：重连基数为 `min(10 + (n − 1), 300)` 秒并增加 0～50% 随机量后受 300 秒上限约束：需求 `:336`、`:337`、`:986`。V-T7 仅要求延时落在 100%～150% 且不超过 300 秒，并验证 1000 次失败后继续以 300 秒节奏重试：同需求 `:672`、`:674`。
- **影响**：当 `n ≥ 291` 时基数已是 300 秒；增加正向随机量后再截到 300 秒，所有结果都只能是 300 秒。持续失败十余小时后，每次重试不再产生新的随机分散。已有相位会保留，所以这不是“设备必然重新同步”；它是 §10 所述持续错开设备重试这一效果在上限处不再成立。
- **最小修正（可验收判据）**：明确上限处是否仍要求非零随机分散。若要求持续分散，定义不超过 300 秒且区间非零的封顶分布，并在 V-T7 用可控随机源验证 `n=1000` 时低、高两个随机值产生不同延时且都不超过 300 秒；若接受达到上限后固定 300 秒，则把 §10 的目的限定为未封顶阶段，并在 V-T7 明确断言封顶后的固定行为。
- **需要 Dexter 裁决**：否；按 §10 作者自定写法处理即可。若选择改变封顶时的等待分布，应在需求中说明它对长期重试频率的影响。

## 需要 Dexter 裁决的事项

无待裁决项。Dexter 在本轮明确裁决：**server-config 本期回归**。需求已把新 owner 列入 ②b（需求 `:59`），R-11.1 明确新建（需求 `:372`），R-12 将旧结论列为由 D-11 取代（需求 `:415`）。`project-memory/decisions/terminal-build-order-and-batches.md:29` 的旧句由同文件 `:63` 标明为历史记录；本轮明确裁决后，不构成当前约束。本轮只授权评审稿，未改该历史记忆或需求正本。

§6 第 22 条另把“旧 JS 运行中尚未处理的激活请求迟到，可能使较新凭证失效”登记为残余风险，并写明本期接受；§11.9 已把该选项与替代方案交 Dexter 知悉。依本轮输入中“§10 作者自定写法，Dexter 不反对即生效”的规则，我没有把已披露、已接受的风险重复列成未决产品裁决。若 Dexter 不接受该残余风险，候选为：①维持现状并保留该残余；②增加跨操作的新鲜度/防重放机制，并补充旧请求晚到不得改变当前绑定的验收场景。推荐当前选择 ①，以保持 R-1.5/R-2.2 的单一当前摘要模型，不额外引入操作历史或序号机制。

## 核过且成立的事实

- **激活重试**：R-1.6 明确同一操作各请求携带同一设备生成秘密，并区分当前摘要、最近已结束摘要和其他秘密；V-B13 覆盖 command 第二次调用、执行器换地址重发、响应丢失、扣住原请求、两个业务后端并发及不同秘密。V-T13 覆盖客户端生成与复用秘密。静态条款前后一致；本轮未运行服务端实现或 acceptance。
- **transport 与网络状态**：R-10.3 把重试节奏、轮转和网络触发放进 transport，把业务参数、就绪/失效/改连/叫停信号留给使用方。R-10.4 规定订阅前读取播种、同值去重、仅跃迁派发 command、actor 独占重连及 10 秒最小间隔，V-T14 对应覆盖这些分支。现行 TR-11 要求事件先成为 command（`doc/platform/terminal-coding-standard.md:434`）；目标稿要求同步修改 transport runtime 声明和 README（需求 `:357`、`:368`），未发现规范冲突。当前源码仍声明 transport 不持有 command/actor（`apps/terminal/kernel/base/transport/src/application/createTransportModule.ts:8`、`:14`、`:15`），README 仍写 bounded retry、不持有命令路由（`apps/terminal/kernel/base/transport/README.md:7`、`:15`）；这是待实施的明确变更，不是修订稿遗漏。
- **state 保留**：R-9.6/V-T8 覆盖 server-config、所有当前持久化 owner、未登记孤儿键、保留声明正反例，以及删除/重置/中断失败路径（需求 `:687`、`:693`、`:696`、`:698`）。R-12 要求同步改写 TR-09 的例外正文（需求 `:419`）；方向一致。
- **旧 server-config 记忆的状态**：`project-memory/decisions/terminal-build-order-and-batches.md:29` 仍保留“server-config（概念取消）”原句，但同文件 `:63` 明确说前述批次是历史记录；需求 R-11.1 与 R-12 分别写明由 D-11 取代（需求 `:372`、`:415`）。Dexter 本轮进一步明确裁决“server-config 本期回归”。因此该旧句是历史文本，不是当前约束；本轮没有权限改写这条业务记忆。
- **生成链与暴露面**：R-12 点名终端凭证上下文、operation binding 的 `CONTEXT_KINDS`/`COMMAND_CONTEXTS`、按暴露面校验与生成 Java 类型/计数、能力不变量门、materialize 的安全方案闭集、edge-codegen 的 `AuthorizationMode`/`requiresSession`、IAM manifest 授权闭集、ArchUnit 暴露面隔离、契约目录精确性、第四暴露面的预算字段、TER 骨架 29 节点以及生成切片对账。抽查对应 owner source 与 R-12 的描述相符：`scripts/generate/operation-handler-bindings.mjs:34`、`:45`、`:399`、`:408`、`:447`；`scripts/generate/r5-edge-materialize.mjs:204`、`:246`、`:390`；`scripts/generate/edge-codegen.mjs:1865`；`contracts/registry/iam-org-governance-manifest.json:11`；`scripts/policy/backend-performance-operation-counts.mjs:40`；`tools/terminal-skeleton/check-static.mjs:650`；`tools/verify-gates/cli.mjs:885`。R-12 也明确这些只是已知项，详设仍需以可复现检索输出为完整分母（需求 `:397`、`:406`）。
- **模块边界与批次**：§8 第 1 条把 store-terminal/独立绑定 owner 留给详设比较，并给出 TDS 最小依赖与避免 COMMAND 成环两项判据（需求 `:869`、`:872`）；这符合 owner API/依赖倒置约束，未静态发现必须在需求阶段先锁定模块的事实。②a 的接口与服务端先落地，②b 在 ②a 复核通过后实施，R-15 生成目标依赖 ②a 的 terminal 契约；设计可以并行，不会把实施依赖倒置（需求 `:58`、`:59`、`:63`）。
- **门店终端需求同步**：D-36 已将“创建后可改设备类型”标为被取代，并说明随本需求、不属门店终端当前批次落地（`doc/plans/platform/2026-09-23-v2s-store-terminal-management-requirements-claude.md:333`、`:661`）。本需求按批次 ① 安排编辑态只读与 L2 重新准入（需求 `:57`、`:902`），没有把改动移入门店终端批次。
- **Journey 模板**：Journey 模板 §1～§7 对应需求 §13.1～§13.6：元数据、actor 用户任务、前提链、边界/禁推、corpus、UI 适用性/交互一致性引用和 Dexter 裁决均有正文。对应模板：`doc/decisions/templates/journey-decision-template.md:12`、`:23`、`:30`、`:45`、`:52`、`:58`、`:72`。

## 未能核验 / 尚未验证

- **多实例 acceptance**：现有 `backend-acceptance` 是远端 Testcontainers 与真实 HTTP 的受管入口（`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md:14`；`scripts/test/backend-acceptance:75`），当前入口将一个 Gradle `test` 任务交给 runner（`scripts/test/backend-acceptance:76`、`:86`）。需求要求两个业务后端实例加一个 TDS 共用 PostgreSQL，并把启动形态与回收交给详设（需求 `:461`、`:463`、`:907`、`:908`）。静态上可通过多个 Spring 上下文、独立进程或容器实现，但没有当前运行证据证明任一方式已在该 harness 中成立；这应由详设选一种并给出运行/cleanup 证据，本轮不据此判为不可行。
- **故障注入**：§8 第 14 条枚举响应扣留/丢弃、双后端并发、认证栅栏、首帧/关闭时序、监听断开、数据库不可用、Doris 挂起、强杀、事件循环阻塞、缓冲上限与优雅下线；并要求逐项说明走环境侧还是生产代码测试接缝（需求 `:907`、`:921`）。范围看起来覆盖对应判据，但接缝是否能触达真实生产路径只能在详设/实现后验证。
- 本轮没有运行 `scripts/verify`、单元测试、backend-acceptance、TER Web/设备验证或 L2；不得把静态可行性写成已通过的运行证据。门店终端编辑抽屉的 L2 准入按需求在批次 ① 重新完成。

## TEMPLATE_COVERAGE（DESIGN 必填）

以下为逐节状态；`NOT_APPLICABLE_WITH_REASON` 指本轮是需求复核，未授权详设，且需求正本明确先交 Dexter 接受后才进入各批详设（需求 `:1619`、`:1623`），不是对后续工件的豁免。

- **Journey** `doc/decisions/templates/journey-decision-template.md`：§1 metadata — 有（§13.1）；§2 user task — 有（§13.2）；§3 actor prerequisites — 有（§13.3）；§4 boundary/non-goals — 有（§13.4）；§5 corpus — 有（§13.4）；§6 UI applicability — 有（§13.5）；§6.1 admin interaction consistency — 有（§13.5 引用前端规范）；§7 Dexter ruling — 有（§13.6）。
- **IA** `doc/decisions/templates/ia-design-template.md`：§1 metadata、§2.1 visible dimensions、§2.1.1 container behavior、§2.2 invisible dimensions、§3 shared IA rules、§4 error mapping、§5 cross-check、§6 completion — 全部 `NOT_APPLICABLE_WITH_REASON`，待批次设计阶段创建 IA。
- **UI interaction** `doc/decisions/templates/ui-interaction-design-template.md`：§1 metadata、§1.1 standard、§1.2 admin consistency、§2 interaction map、§3 v2 page inventory、§4 wireframes（含 testId/control roster 与表单/搜索子项）、§5 state/boundaries、§6 task rationale、§7 face/owner、§8 manifest map、§9 optional demo、§10 Dexter visual conclusion — 全部 `NOT_APPLICABLE_WITH_REASON`，当前只有需求描述；§13.5 已说明哪些既有页面变化、哪些页面/交互不变。
- **Implementation-facing** `doc/decisions/templates/implementation-design-template.md`：§0 authorization、§1 alternatives、§2 CP overview、§3 cross-cutting mechanisms、§3a L2 admission、§4 CP gates、§5 operation/face/shape、§6 cross-owner writes、§7 propagation、§8 business rules、§9 owner API、§9a sync inventory、§9b locations、§10 migrations、§10b seed（含 §10b.1–§10b.6）、§11 acceptance、§12 unresolved items、§13 stop conditions、§13b 3D reconciliation、§13c code/design audit、§14 delivery checklist — 全部 `NOT_APPLICABLE_WITH_REASON`，待 Dexter 接受需求并进入对应批次详设。

## Review provenance

先读需求 §0～§10、§12、§13，再读 §11.7～§11.11；独立盲审的门 finding 作为输入，随后重开需求、仓内 verify/gate 实现与规范核验。当前文件是 Codex 主 agent 的 source reconciliation，不冒充独立子 agent 产物。该经 Dexter 中转的 Codex/Claude review 不设置 `REVIEW_ROUND_LIMIT` 或 `ROUND_FINAL_DECISION`。
