---
title: RM1 r5-full Seed 高数据库操作复盘 — 分析设计审阅（Claude）
reviewTarget: ANALYSIS
scope: doc/review/platform/2026-08-01-v2s-rm1-seed-db-operation-review-codex.md 的 P0–P3 建议、23/23 分母与统计口径
verdict: GO
findings: M=0 / S=1 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 本审阅仅评价分析与设计输入；不授权实现、DEV/seed/reset、动态 L2、业务 PASS 或 cleanup PASS
createdAt: 2026-08-01
---

# Seed DB 操作复盘 — 分析设计审阅

## 0. 结论

**GO — `M=0 / S=1 / N=2`。**

四个指定核验点**全部成立**，`23/23` 分母与统计口径我用源报告机器复算**逐项确认**，
报告**没有**把 JDBC statement count 说成性能结论。

唯一的 `S`：`P0-C` 的 owner 边界条款只写了「禁止 import extension repository / 存 raw entity」，
**漏掉了「必须落在 owner 声明的 command-api package」这一条**——而在 `P0-C` 要改的同一批文件里，
今天就有一处活的实例。

## 1. 分母与统计口径（核验点 2）—— CONFIRMED，机器复算

源报告 `.runtime/r5/dev-rm1-20260801-r2/results/seed-report.json`
sha256 复算 `e0b41d7c4ac47ccb87d940bd340f250d9f01c89cd599c8fde8d4b2d087512210`，
与 front matter **一致**。

我独立重算：

```
endpointGroupCount = 26（实际 apiEndpoints 数组 = 26）
databaseOperationCount.max > 3 的分组 = 23      max <= 3 = 3
23 组的 callCount 求和 = 60                      63 - 60 = 3（恰为被排除的 3 组各 1 次）
被排除的 3 组：getPlatformAdminPage / getExtensionDefinition / getExtensionEntityCatalog（max=avg=3）
```

`23/23`、`60 次调用` **全部对上**。

再对 `§3` 的 23 行表格做逐行比对：**解析出 23 行，与 max>3 的 23 组双向差集为空**，
且每行的「次数」与「DB 次数」与报告的 `callCount` / `databaseOperationCount.average`
**逐条一致（0 条不符）**。

**口径混用检查**：`§3` 声明表内用**平均值**，而分母判据是 **max>3**。我逐组检查
`avg>3` 与 `max>3` 的一致性，**无一组发散**——即使改用平均值筛选，成员集合也完全相同。
该披露准确且无副作用。

**统计口径未被越读**：`§1.2` 明确该数字是 statement execution 的逻辑次数、不含 SQL 文本/计划、
不是事务数/往返/锁等待/CPU-IO/端到端延迟，且本次为串行样本无 p50/p95/p99。
我全文扫描 `更快|性能提升|加速|p95|吞吐|latency`，**命中全部落在免责段（§1.2、§3 引言）
或未来验证计划（§6）**，没有任何一处把本次数据当成性能结论。`§3` 也明写
「优先级是改造优先级，不是当前业务故障等级」。✓

## 2. 四个指定核验点

### 2.1 Invitation completion 的最终 owner readback —— CONFIRMED（源码逐行）

`WorkspaceInvitationService.completePublic` 结尾就是：

```java
UUID accountId = completeReadyInvitation(invitation, progress);      // CAS + 各 owner 写
jdbc.update("UPDATE workspace_iam.invitation_public_progress SET completion_account_id=? ...");
audit(..., "WORKSPACE_INVITATION_COMPLETED", ...);
return completion(read(rawInvitationToken));                          // ← 最终 owner readback
```

重放路径 `if ("COMPLETED".equals(invitation.status())) return completion(invitation);`
用的是本次 `requireGroupInvitation` 的同一次读取，同样是 owner 事实。
`§4.2` 表格与 `§9` 的更正**与源码一致**；round-1 的 `M1` 是真问题，更正是有源码支撑的。✓

顺带确认 `P0-A` 的根因判断准确：

```java
private Invitation requireGroupInvitation(String k, String t) { requireGroup(k, t); return read(t); }
private void requireGroup(String k, String t) { if (!k.equals(read(t).groupWorkspaceKey())) throw ...; }
```

同一 `token_hash` **确实被 SELECT 两次**，五条 public flow 全部经此入口。
`sendPublicInvitationOtp` 更深一层：`requireGroup` → `read(token)` → 再按 id 读一次，共三次装载
同一 invitation——与报告「约 -3」的估计吻合。修法留在 service 私有 helper 内，
不动 public API/edge、不动 CAS/rate/audit，是**更小的安全实现**，我找不到更小的。

### 2.2 extension typed validation/normalization 是否足够窄 —— 方向正确，边界条款有缺口（见 `§3`）

**当前边界的事实（先厘清，再评方案）**：

- 依赖注入的是 **api 接口**：`BusinessEntityService:39` `private final ExtensionDefinitionLookup definitions;`，
  `ContractCommandService:33` 同样。
- **没有跨 schema DML**：`replaceValues` 读写的是
  `organization.<table>.extension_values` / `extension_rule_revision`——**宿主自己 schema 的行**。
  registry 的 `r5-judgment-organization-extension` / `r5-judgment-contract-extension`
  把 `extension.extension_definition` 声明为 **judgment（读）** 边，与源码相符。
- 因此报告写的「禁止 import extension repository 或存 raw extension entity」，
  在 DML 与实体层面**今天是守住的**。

方案本身（extension owner 返回 canonical values + applied revision，宿主 owner 在**初始 INSERT** 写入）
方向正确：既消除 `validate → insert → 再读 JSON → 再读 definition → UPDATE` 的重复读，
也真实缩小 definition 版本变化的 TOCTOU 面（报告这一点没有夸大）。

**缺口见 `§3` 的 `S1`。**

### 2.3 session entry 是否仍完全由 workspace-IAM owner 组成 —— CONFIRMED

组装完全在 owner 侧：`WorkspaceAuthenticationService.sessionEntry(rawToken)`（workspace-iam `:138`）。
edge 只调用并做 wire 映射（`WorkspaceSessionWireMapper.wire(...)`），
`OperationsCatalogAuthenticationController` **没有自行拼装任何授权事实**。
`P0-B` 的约束「仅 workspace-iam session owner 组成 entry」是**保持现状**，不是新增让步。✓

报告指出的重复也确属实：
`:40` `sessions.login(...)` 后又 `sessions.sessionEntry(login.rawSessionToken())`；
`:43` `sessionResolver.requireWorkspace(...)` 后又 `sessions.sessionEntry(...)`。
（有限分母的一处遗漏见 `§4` 的 `N1`。）

### 2.4 StoreRelationValidation 与多 intent 批量 judgment 是否应维持 P3 —— 我同意维持 P3

**多 intent 的线性增长前提是真的**：`completeReadyInvitation` 内

```java
for (AssignmentIntent intent : intents) { roles.require(...); requireEnterable(invitation, intent); }
```

每个 intent 一次 role 读 + 一次 enterable judgment，确为线性。但本次 Seed 的 invitation 都是单 intent，
**当前没有该增长的实测证据**——正因如此，"先补多对象 workload 与 failure matrix 再抽象" 是对的判断，
而不是拖延。

**`StoreRelationValidation` 全仓不存在**，报告作为提案提出，未把提案说成现状。✓
store create 28 次是分母最高项，越是这种地方越容易为了降数字牺牲 typed failure 精度；
报告要求「保持每一种 typed failure 的准确性、引用状态与 scope 边界，并有关系失效/越权的真实红测」
才可实施，与本仓 G03/G04/G06 的风险定位一致。**维持 P3 是正确取舍。**

## 3. S1 ｜`P0-C` 的 owner 边界条款漏了「声明的 command-api package」，且已有活实例

**仓内事实**：extension 模块在 `contracts/policy/module-dependency-registry.json:40` 声明
`commandApiPackages: ["com.catering.v2s.extension.api"]`，
而其 `api` 包只有 `ExtensionDefinitionLookup` 与 `ExtensionDefinitionReadback`。

但**四个生产文件 import 了 application 包**：

```
organization/.../BusinessEntityService.java:8
organization/.../OrganizationOverviewTaskReadService.java:5
store-contract/.../ContractTaskReadService.java:5
store-contract/.../ContractCommandService.java:9
    import com.catering.v2s.extension.application.ExtensionDefinitionService;
```

我逐一核对用途：**唯一**用法是 `catch` 子句里的嵌套失败类型
`ExtensionDefinitionService.DefinitionNotFoundException`（共 4 处：`BusinessEntityService:376/388`、
`ContractCommandService:132/142`）。没有 repository、没有 entity、没有 DML。
`MODULE_DEPENDENCY_REGISTRY=PASS`——该门校验的是 schema/query 边，**不校验 Java package import
是否落在 `commandApiPackages` 内**，所以它抓不到。

**为什么这正好打在 `P0-C` 上**：`P0-C` 的全部价值就是一个**typed** judgment，
其 proof 清单明写要覆盖 `required/disabled/type/revision/conflict`——这些都是**typed failure**。
若新的 `validateAndNormalize` 沿用今天的形状，把失败类型继续放在 `extension.application`，
那么它**同时满足报告自己写下的禁止条款**（没 import repository、没存 entity）
**却仍然没有落在 owner 声明的 command-api package 内**。
于是审阅问题「结果对象是否足够窄」会得到「值对象够窄」的 yes，和一个无人提起的 no。

**最小修复（不扩大方案）**：在 `P0-C` 的「禁止/proof」里补一条——
judgment 类型**及其 typed failure** 必须位于 `com.catering.v2s.extension.api`；
把 `DefinitionNotFoundException` 一并迁移/重新发布到 `api`，与 `P0-C` 同包完成。
这不增加新抽象，只是把已经在做的事做完整。

**是否需要 Dexter 产品裁决**：否。

## 4. N

**N1 ｜`P0-B` 的有限分母漏了第三个同形调用点**

`OperationsCatalogAuthenticationController:42` `verifyOperationsWorkspaceOtp`：

```java
var login = sessions.verifyLoginOtp(groupWorkspaceKey, body.mobile(), body.code());
... WorkspaceSessionWireMapper.wire(sessions.sessionEntry(login.rawSessionToken()), assets)
```

与 `#12` 的「login 后无条件重组 entry」**完全同形**。
`P0-B` 点名的分母只有 `operationsWorkspacePasswordLogin` 与 `getOperationsWorkspaceSessionEntry`。
报告确有兜底句「并扫描所有 `sessionEntry` consumer」，按此执行能覆盖到；
但本仓惯例是**有限分母要显式列全**。该端点合理地不在 23 组表内（本次 Seed 走的是密码登录），
建议直接把它写进 `P0-B` 的分母。

**N2 ｜`availableTaskTargets` 已经存在，P3 的成本被高估**

报告 `§4.2` 末写「organization 提供批量 `availableTaskTargets` 的 typed judgment」，
读起来像待建。实际上它**已在 api 层存在并被消费**：
`OrganizationTaskPathLookup.java:26`（default 方法）、`OrganizationTaskPathService.java:105`（实现）、
`StoreCandidateTaskReadService.java:57`（现有调用方）。
P3 的多 intent 项真正缺的只有 role owner 的 `requireAll`。
建议改写为「复用既有 `availableTaskTargets` + 新增 `roles.requireAll`」，
以免把已建成的部分再记一次成本。

## 5. 我确认为准确、不应回退的部分

- `23/23` 分母、60/63 调用数、23 行表格与源报告的逐行一致性、源报告 sha256。
- `§1.2` 的统计口径免责与 `§6` 的性能验证计划（`EXPLAIN (ANALYZE, BUFFERS)`、并发阶梯、
  p50/p95/p99、pool/lock wait）——把「statement 数」与「性能结论」严格分开。
- `§2` 三个方向的取舍：拒绝机械 `<=3`、拒绝跨 schema 大 join，是对的。
- `P0-A` 的重复 token read、`P0-B` 的重复 session composition、
  `P0-C` 的 extension 两阶段写、`P0-D` 的 Region 无谓 phase DML——四项根因我均在源码侧确认。
- `§7` 的 `REJECTED_WITH_EVIDENCE` 与 `UNVERIFIED_REQUIRES_EVIDENCE` 分类诚实：
  尤其「最大 statement 数是否等于最慢/最贵 SQL → REJECTED」和
  「`OrganizationCommandService` 是否还缺 owner workspace recheck → UNVERIFIED」，
  没有借性能复盘越级改动。
- `§7` 末的治理事实我实跑确认：`scripts/check/standards-coverage --phase RM1-P6-3`
  返回 `STANDARDS_COVERAGE=FAIL / REASON=UNKNOWN_PHASE:RM1-P6-3`（`--phase R5` 为 PASS）。
  报告把它定性为 phase 映射/调用口径问题、明确不得表述为 standards PASS——准确。

## 6. 处置

- **`S1`** 在既有批准边界内（改的是 `P0-C` 的条款措辞与一次 package 迁移），
  Codex 可自主处置；建议在开 `P0-C` 实现包时一并落。
- **`N1`/`N2`** 为分母完整性与成本估计的修正。
- **本审阅不授权**：任何实现、DEV/seed/reset、动态 L2、业务 PASS 或 cleanup PASS。
  每个 P0 单元仍须另开 package，并按 `§6` 的验证计划先重开 IA/详设与 owning source。
