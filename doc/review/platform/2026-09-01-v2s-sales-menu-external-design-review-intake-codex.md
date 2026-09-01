# 销售菜单外部 DESIGN review · Codex 辩证 intake

```text
SOURCE_REVIEW=doc/review/platform/2026-09-01-v2s-sales-menu-design-review-claude.md
SOURCE_VERDICT=GO
SOURCE_M/S/N=0/2/1
REVIEW_TARGET=DESIGN
ACTION=AUTHOR_DIALECTICAL_INTAKE
REVIEW_CYCLE_ID=SALES-MENU-DESIGN-2026-09-01
NEW_ADVERSARIAL_ROUND=false
EVIDENCE_TIER=STATIC_SOURCE_REVIEW_ONLY
DYNAMIC_EXECUTION=NOT_RUN
IMPLEMENTATION_AUTHORITY=false
```

本文件不继承外部 reviewer 的判断，也不产生第三轮 Codex 对抗审查。Codex 先重开当前仓库字节、业务/IA/详设、两条 finding 的 owning source 和 active 标准，再逐项寻找反例并处置。外部 `GO` 不授权生产实现、契约生成物写入、Testcontainers、browser L2、DEV start/stop/reset/seed、UAT 或部署。

## 1 · 复核输入

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、Registry 与 `V2S_W0_W4_EXECUTION` Roadmap 授权字段；
- 六维 `recall-memory` 的全部 kernel/routed 原文，重点为 G-05A、HTTP operation denominator、collection boundary、independent review；
- 销售菜单需求、IA、交互、详设、实施计划与外部 Claude review；
- `OperationsBusinessChannelController.requireScopedStore`、`OperationsBusinessChannelControllerScopeTest`、`WorkspaceSessionEntry.selectedDataNode`；
- `contracts/registry/iam-org-governance-manifest.json`、`contracts/catalog/admin-catalog.json`、`WorkspaceAuthorizationCatalog`；
- backend-acceptance active standard、browser L2 standard、§5 operation 表、§11 acceptance/L2 表；
- `.agents/skills/cs-review/SKILL.md`、`CLAUDE.md` 与 `doc/platform/review-standard.md`。

动态 Testcontainers、browser L2、DEV、seed、UAT、部署均未运行；本文只能裁定静态设计缺口是否存在以及文档修订是否闭合。

## 2 · S-1 intake

**分类：`CONFIRMED`。**

### 证据与反例

- `project-memory/decisions/workspace-page-entry-role-node-scope-authorization.md` 当前不存在；同根扫描显示活动设计中只有详设横切机制表引用了该失效路径。外部 review 中的引用是历史 finding 证据，不应回改；
- 反例条件是该文件真实存在，或现行正本要求 GET 使用 capability；两者均不成立；
- G-05A 明确“角色节点是主对象读取唯一范围真相、capability 只控制写”；Blueprint 同样规定普通 scoped GET 不新增 read capability；
- `requireScopedStore` 当前先读真实 Store/Project，再按 selected STORE 或 selected PROJECT scope 拒绝；对应 scope test 证明 foreign selected store 在 owner page read 前被拒绝；
- IAM governance manifest 有 `AUTHENTICATED_WORKSPACE_ROLE_NODE_RANGE`，当前 admin feature capability 只有三个 `EDIT_*`，无 `VIEW_*`。这证明本批只新增 `EDIT_STORE_SALES_MENU`、GET 零新增 capability 的模型有真实依据。

### 最小处置

已把详设 §3 “读侧节点授权”改为真实正本与先例组合：G-05A + Blueprint + `WorkspaceSessionEntry.selectedDataNode` + `requireScopedStore`/scope test + IAM role-node-range manifest。没有新造 project-memory decision，也没有只删除引用后留下无依据声明。

**处置结果：`RESOLVED_STATIC`。**

## 3 · S-2 intake

**分类：`CONFIRMED`，其中“完全没有覆盖意图”被当前 `sales-menu.generated-route-contract` 反证为不成立；真实缺口是覆盖意图没有逐 operation 可证伪。**

### 证据与反例

- §5 有 31 个唯一 operationId；§11.1 有 15 个本批业务场景，§11.3 有 16 个 L2 case；
- 31 个 operationId 原先均未在 §11 acceptance/L2 章节逐项点名；因此可以漏掉 `moveOperationsSalesMenuSection`、`releaseOperationsSalesMenuStagedAsset` 等 operation 而仍满足三个计数；
- `sales-menu.generated-route-contract` 已表达“31 identities reach handler/face”，但没有说明每个 operation 由哪个业务 oracle 和用户 action 证明；它只能反证“设计完全没想到 route coverage”，不能闭合业务覆盖；
- 把 31 个 operation 改成 31 个 scenario 壳会违反 active backend-acceptance 的业务闭环形态并弱化 oracle，因此拒绝该更大替代。

### 最小处置

1. 详设新增 §11.1a，恰好 31 行 `operationId → 业务 acceptance → 直接 oracle → L2 case`；
2. CP-03 新增失败条件：缺行、重复、无 acceptance、用户可见 operation 无 L2/`L2_NA_WITH_REASON` 均失败；
3. 矩阵声明 `generated-route-contract` 仅作结构 backstop，不能单独承载 command 业务语义；
4. 实施计划 SM-00/SM-05/SM-08/SM-12 要求实现前 exact equality，运行后从实际 production HTTP completion events 与 L2 action join 逐行回读；
5. 明确不新增 provider、按 route 生成壳、固定全仓 scenario 总数或已退役自动 exact-set 控制面。

当前只完成静态设计闭合。31 行是否真的在 backend-acceptance/L2 中执行，仍须未来获得对应动态授权后以实际 completion/action join 证明；矩阵本身不能升级为动态 PASS。

**处置结果：`RESOLVED_STATIC / DYNAMIC_PROOF_PENDING_AUTHORITY_AND_IMPLEMENTATION`。**

## 4 · N-1 intake

**分类：`DEXTER_DECISION`，已按直接裁定执行。**

- 外部 Claude 评审文件保留 `-claude`；
- Codex 侧产物，包括 Codex 调度的 independent subagent review、作者 intake/reconciliation，一律使用 `-codex`；
- 独立性仍由文件内 `reviewerKind`、轮次、盲审声明和输入清单证明；
- 历史文件不回改名。

已把该输出约定写入 `doc/platform/review-standard.md` §5，并让 `.agents/skills/cs-review/SKILL.md` 指向它。`CLAUDE.md` 的 `-claude` 规则本来就只约束外部 Claude 会话，无需修改。

**处置结果：`ACCEPTED_AND_PREVENTED_FOR_FUTURE_OUTPUTS`。**

## 5 · 同根扫描与收口

| 问题族 | 活动影响面 | 处置 |
| --- | --- | --- |
| 失效权威引用 | 销售菜单详设 §3；外部 review 仅作历史 finding 证据 | 详设改为真实正本/源码/测试/manifest；历史 review 不改 |
| 数量有了、成员覆盖没落盘 | 详设 CP-03/§11/§14；实施计划 SM-00/05/08/12 | 新增 31 行成员矩阵、失败条件、实施与动态读回义务 |
| review 后缀归属混淆 | `review-standard`、`cs-review`、`CLAUDE.md` | 新约定以 review-standard 为 owner；skill 跟随；Claude 规则保持外部边界 |

### 静态验证留痕

- 以 §5 表头的 `operationId` 列为 source denominator、§11.1a 为 coverage denominator 复算：`31 / 31`，无缺行、重复或额外成员；
- 矩阵引用的业务 acceptance 与 L2 case 分别对 §11.1、§11.3 做成员校验：`15 / 16`，引用均存在；
- 活动详设与实施计划对失效 project-memory 路径的精确扫描为 0；外部 review 与本文保留该字符串，仅用于说明历史 finding；
- `scripts/check/agent-lifecycle`、`scripts/check/project-memory`、`scripts/check/codex-self-review --self-test` 均 PASS；
- `scripts/check/codex-self-review --file <本文>` 不适用：该入口只验证正式 Codex 对抗 review 的轮次/verdict 形态，本文是外部 review 的作者 intake。不得为通过该检查伪造第三轮、`reviewerKind` 或 `ROUND_FINAL_DECISION`。

```text
S-1=CONFIRMED_RESOLVED_STATIC
S-2=CONFIRMED_RESOLVED_STATIC_DYNAMIC_PROOF_PENDING
N-1=DEXTER_DECISION_ACCEPTED
AUTHOR_INTAKE_RESULT=EXTERNAL_GO_FINDINGS_DISPOSED
DESIGN_READY_FOR_IMPLEMENTATION_DECISION=true
IMPLEMENTATION_AUTHORITY=false
```

本 intake 不重置 `SALES-MENU-DESIGN-2026-09-01` 两轮上限，不建立第三轮，不把外部 Claude review 当成 Codex 独立子 agent review。后续只有 Dexter 的直接指派才能启动生产实现或任何动态执行。
