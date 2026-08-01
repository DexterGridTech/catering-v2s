---
title: R5 范围、批次方法与契约基线裁决
status: ACTIVE_SCOPE_DECISION
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter delegated to Codex
delegationRecord: Dexter message “由codex做所有裁决” on 2026-07-25
implementationAuthority: false
r5DesignAuthority: true
sources:
  - doc/review/platform/2026-07-25-v2s-r5-v2-implementation-state-and-dependency-analysis-codex.md
  - doc/review/platform/2026-07-25-v2s-r5-scope-and-order-independent-analysis-claude.md
  - doc/review/platform/2026-07-25-v2s-r5-dual-analysis-comparison-claude.md
  - doc/review/platform/2026-07-25-v2s-r5-scope-method-and-dev-review-claude.md
---

# R5 范围、批次方法与契约基线裁决

## 1. 状态与边界

Dexter 已将双盲对比遗留的全部裁决委托 Codex。本裁决先关闭 R5 的范围和方法歧义；
随后 Dexter 已通过
`doc/decisions/2026-07-25-v2s-r5-whole-scope-design-authorization.md`
授权形成 Journey、交互工件、implementation-facing design、manifest 与设计 review 包。
`R5_DESIGN_AUTHORIZED=true`，`R5_IMPLEMENTATION_AUTHORIZED=false`，因此 contract、
数据库、应用、测试源码与动态运行仍不得进入实施。

R5 的业务 inventory 分母固定为 **32 个 source-backed all-v2 场景**，其中包含
`D04-S12P/O`；R3 已完成的 C-01 三 operation 在该 inventory 中标记
`RETAIN_AS_ALREADY_MIGRATED`，不是重复实施分母。历史设计、parked 域、无完整
edge/owner/page 源码锚点的内容不进入该 32 项。每项仍必须在 R5 产生 fresh v2s evidence，
all-v2 证据只用于决定“搬什么”。

## 2. 五项裁决

### D-01：R 原子交付与评审节奏

R5 按 Dexter 已确定的原子方式交付：一个全范围设计包、一个全范围实施包、一个
全范围 review target。A/B/C 及其依赖 group 只用于拓扑、编译、测试、失败定位和证据
积累；不得形成逐 Journey、逐 group 或逐波的独立产品确认、Claude handoff、对抗 review
cycle、GO/NO-GO verdict 或 closure。

“半小时可核”不被放弃：最终 review packet 必须有可独立阅读的 section/evidence index，
每个 section 控制在约半小时核验量；它们共同构成同一个 R5 review target 和最终 verdict，
不构成中途交付。每个 group 仍要持续运行已存在的机械验证与 focused evidence，不能把
问题推迟到末尾才首次发现。

这是对 Roadmap §11 “每波 review”在 R5 的执行解释修订；R5 适用本节的原子 review
节奏，Roadmap 的每波 evidence、owner、replacement 与退出要求仍完全有效。

### D-02：A0 契约惯例

R5 的全量 edge OpenAPI 在同一个契约基线中采用下列固定惯例；不保留 v2/v2s 双形状：

| 项目 | 裁决 |
| --- | --- |
| 幂等 | `Idempotency-Key` HTTP header，`minLength: 16`、`maxLength: 128`；只用于会产生业务写效果的 command，`GET` 不得声明或校验。body 不再携带同义 idempotency key。A 批契约基线必须显式迁移 R3 的三个 operation：两个 `GET` 均不得要求该 header，`initializeCommercialGroup` 必须增加该 header 及前述等价长度约束。 |
| 分页 | 统一 `items`、`page`、`pageSize`、`total` response envelope；每个可排序 surface 定义其闭集 `sortKey`/`sortDirection`。 |
| Problem | `application/problem+json`、RFC 7807 基础字段、稳定 uppercase domain-prefixed `errorCode` 与必填 `correlationId`；错误目录由契约基线集中声明。 |
| 集团空间 key | 所有外部 DTO、path/query 参数、route/context/cache key 一律 `groupWorkspaceKey`；platform URL 不携带 key，operations URL 按 G-10 携带 key；URL 不授权。 |
| OpenAPI 与时间 | 保持现有 codegen 已使用的 OpenAPI 3.0.3；可空用该版本的 `nullable`。所有“发生于/创建于/更新于/过期于/撤销于/最后访问于”等时间点，在 edge wire、Java 后台模型和 PostgreSQL 中分别固定为 `epochMillis(integer/int64)`、`long/Long`、`BIGINT`，单位毫秒；禁止 `String`、`LocalDateTime`、`OffsetDateTime` 或数据库 timestamp 作为持久化形状。纯业务日历日期（例如合同 `effectiveFrom/effectiveTo`）不是时间点，仍保持 OpenAPI `date`、Java `LocalDate`、PostgreSQL `DATE`，不得混用。 |
| contract 源文件组织 | `contracts/openapi/edge.openapi.yaml` 只作根入口；path/operation 按 `platform/operations/public` face 再按业务能力拆到 `paths/`，schema 按 owner/capability 拆到 `components/`。每个手写 YAML 只拥有一个 face+capability 或一个 owner+schema family，非空行不得超过 500；达到上限必须继续按 read/command 或子能力拆分。只允许 codegen 临时 bundle 为单个大文件，bundle 不得成为 source truth 或手工编辑对象。 |
| 乐观并发 | 业务聚合写命令统一用 `expectedVersion`；`expectedRevision`、`expectedContextVersion` 不再作为 edge command request 的并发字段。该收敛不删除 frontend query arg/cache key/tag 中相互独立的 `contextVersion` 与 `authorizationRevision`，也不删除 owner typed-stale 语义；两类版本由服务端 readback 供给，客户端失鲜时清除投影并重读。可信 execution context 只由服务端解析。 |
| 排序 | 统一 `sortKey` 与 `sortDirection`；值域按 surface 明确，不使用自由字符串。 |
| 状态变更 | 只有简单、封闭的 lifecycle 状态变更使用 `POST /<resources>/{id}/status`，body 为 `targetStatus` 与需要时的 `expectedVersion`；有独立业务语义的命令使用具名 operation，不伪装为 status。 |

### D-03：扩展字段宿主

R5 迁移的是已有实际值宿主的闭集：`BRAND`、`TENANT`、`HEAD_COMPANY`、`STORE`、
`CONTRACT`。all-v2 的 extension definition catalog 虽列出八类，但 `COMMERCIAL_GROUP`、
`REGION`、`PROJECT` 没有对应的 source-backed value host；R5 不创建“可配置但无处承载”的
定义或值实现。

这不是删除三类业务语义，也不修改 G-01～G-12；它们保持为未来经明确范围裁决后才能进入的
候选。R5 设计应保留 enum/模块演进位置，但不得预建表、endpoint、UI 或空壳兼容路径。

### D-04：G-09 合同衍生状态的用法

R5 必须把该状态实现为门店 task-read 的只读字段：存在当前生效合同为 `OPERATING`；否则
存在未来生效合同为 `PREPARING`；两者皆无为 `NOT_OPERATING`。多份合同不选择“唯一当前合同”。

它不驱动 command、门店启停、登录、授权、合同失效或任何阻断；`VALID/INVALID` 不能替代
这条派生逻辑。合同设计必须把“当前/未来生效”的时间边界、受控时钟与日期端点写清，前端只在
已有门店/合同 task 中展示，不因此新增首页或用户 Journey。

### D-05：设计进入条件

Dexter 已给出 R5 全范围 design authority，Roadmap 已记录
`R5_DESIGN_AUTHORIZED=true`。当前只允许按既有管线一次性建立全范围 Journey inventory、
UI 交互工件、详设、granularity manifest 与独立子 agent 盲审。C-02 不从 R3 历史资产恢复；
它在 R5 中只能作为这次新范围下的新 Journey 处理。实施仍需后续精确授权。

### D-06：R5 完成时的完整 DEV 与 seed 交付

R5 不是只交付静态/真库/受管短跑 evidence。R5 全范围完成的必要条件是存在一个可由
Dexter 亲自使用的 **完整 DEV 环境**：两个独立 admin app、edge、唯一业务 deployable 和
v2s 已批准的远端中间件以真实配置连通，能够执行 32 项 inventory 的完整用户功能。它是
开发/验收环境，不是 production/cutover 声明，也不得借“远端中间件”重新引入 MQ、outbox、
Redis、TDP、内部 client 或其他已拒绝拓扑。

R5 implementation-facing design 必须指定并实现下列受管脚本契约；具体 target path 可在设计中
确定，但职责不得合并：

| 动作 | 必需行为 |
| --- | --- |
| `dev start` / `dev restart` / `dev stop` | 使用 run-scoped manifest、结构化日志和远端依赖 readiness preflight；start/restart 只应用 additive Flyway，绝不 seed；stop 只清理其 manifest 所有的资源。 |
| `dev reset` | 仅对明确的 DEV remote namespace/allowlist 做破坏性清理，记录清理前后 readback；reset 成功后仍不得自动 seed。 |
| `dev seed --profile r5-full` | 显式、可重复、版本化的丰富数据装载；支持只读 dry-run 覆盖核验，写入后做批量 source-fact readback 与业务/cleanup 分账。 |
| `dev check` | 检查环境变量、远端依赖可达性、运行版本/contract 对齐、脚本参数和 seed profile 完整性；不得用人工口令、手工改库或旧数据冒充可测环境。 |

`r5-full` seed 的最小业务覆盖必须让 Dexter 不手工补数据即可走完已批准 R5 用户任务：分离的
platform-admin 与 operations-admin 测试身份和会话；多个集团空间、商业集团、大区/项目；角色、
页面准入、动作能力、数据节点、邀请接受与撤销场景；品牌、实际经营租户、总公司及品牌授权；
启用/停用门店；五类已裁定扩展值宿主；合同货号二元组及 `OPERATING`/`PREPARING`/
`NOT_OPERATING` 三种派生状态；以及每个列表、详情、失败恢复与负权限用例所需的 source fact。
seed 身份是可审计的 DEV fixture，不是运行时默认账号、隐式 root 或绕过邀请/授权语义的后门。

seed 构造业务事实的通道优先级固定如下：普通业务事实优先且默认必须经真实 edge/owner
command；新增任职必须重放邀请与接受链，不得用直写伪造已生效任职。只有不存在产品 command
可以构造的部署期前提或 fixture bootstrap 才允许受控直写，并须在设计中逐项给出 DEV-only
table/column allowlist、不可经 command 构造的理由、审计/receipt 与写后 owner readback。该例外
不得扩展为普通业务事实装载通道、运行时默认账号、权限绕行或后门。

R5 借鉴 v4 formal-UAT 的**方法**而不是其拓扑：分段 fixture 与 dry-run、单独 remote readiness/
reset/seed/ensure 脚本、request/correlation 日志、阶段耗时、有限并发和批量 readback；不复制 v4
的 RocketMQ、outbox、投影 repair、缓存或任何 v2s 未批准依赖。R5 closure 必须保存一次从清洁
remote DEV namespace 开始的受管 rebuild → explicit seed → 双 admin 真实操作/readback 的 evidence，
并把 business PASS 与 cleanup PASS 分开。

## 3. 选择理由与替代方案

业务用户需要的是已有四域能力在新单体、双后台、单一 edge contract 中一致可用；Dexter 的
明确成本意图是避免把已知需求拆成反复确认的许多小项目。替代方案是按 B/C group 各自开
review cycle：它有更早的语义反馈，却直接违背 R 原子交付，并把一个固定迁移范围重新变成
多次阶段性交付。采用 D-01 的 section-sized 单一 review target 保留可核性和持续验证，避免
重复的产品/评审 ceremony。

## 4. 冻结输入与后续要求

- 业务语义以 `project-memory/decisions/confirmed-business-language-corpus.md`
  `@51415f7d3b024967b10d89414534deb16c1c09e5eced2883f3573d98891b4503` 为准；
  Heritage 形状冲突时以语料和本裁决为准。
- all-v2 只读；不得从旧 catalog、旧 route 或旧 wire 获得 runtime/build fallback。
- R5 全范围设计必须把 32 项逐项列出 source anchor、`CREATE/UPDATE/RETAIN/NOT_CARRIED`
  disposition、所在 A/B/C group 和 fresh evidence 责任，才可进入独立盲审。
- UI-bearing 项必须先盘点并优先消费 `libraries/frontend/admin-ui-foundation`，再完成
  carry/adapt/rewrite 说明。Dexter 已进一步裁决“线框全部以 v2 为准，不需要我再确认了”：
  五个 operations 首页只搬运 v2 route/bootstrap，不补造 dashboard、orientation card 或
  其他新内容，也不再设置逐页看图确认点。
- R5 全范围设计必须把 D-06 的 remote DEV、脚本、fixture、凭据交付方式、readiness、reset
  allowlist、seed readback、日志/耗时和 cleanup evidence 作为实施单元；不得留到 R6 或 HANDOFF。

## 5. Claude review intake

Claude 对本裁决给出 `GO(0 M / 0 S / 4 N)`。四条 N 均已按 owning source 做最小同步：

- N-1：Roadmap 当前叙事与 §11 的 D-01/D-06 引用同步；
- N-2：明确 command 并发字段收敛不删除 `contextVersion`、`authorizationRevision` 与 typed-stale；
- N-3：明确 seed 优先走 owner command/邀请链，直写仅限逐表列审计的 DEV bootstrap 例外；
- N-4：补齐幂等 header 长度约束及 R3 三 operation 的 A 批迁移责任。

处置明细见
`doc/review/platform/2026-07-25-v2s-r5-scope-method-and-dev-review-resolution.md`。
这些同步不改变 `R5_DESIGN_AUTHORIZED=false` 或 `R5_IMPLEMENTATION_AUTHORIZED=false`。
