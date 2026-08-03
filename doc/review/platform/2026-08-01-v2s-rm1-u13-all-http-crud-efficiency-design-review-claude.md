---
title: RM1 U13 全 HTTP CRUD 效率整改 — 最终静态设计审阅（Claude）
reviewTarget: DESIGN
scope: U13 remediation design、problem family、HTTP CRUD 效率设计红线、Round-2 的 S2/S3 作者处置
verdict: GO
findings: M=0 / S=1 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅覆盖静态设计；不授权生产实现、契约/schema 变更、DEV/Seed/reset、managed diagnostic、browser L2、performance/business/cleanup PASS 或 Roadmap 变更
createdAt: 2026-08-01
---

# U13 全 HTTP CRUD 效率整改设计审阅

## 0. 结论

**GO — `M=0 / S=1 / N=2`。**

三个目标全部成立：**全接口分母、owner 边界、效率分类与实施顺序都立得住**；
通用红线**能够防止同类复发**且没有升级成机械门；**Round-2 的 `S2`/`S3` 我在字节里逐条确认已真实关闭**。

唯一的 `S`：147-operation coverage 的 oracle **只要求披露 `unexecuted`，却没有给它任何下限或逐项处置要求**——
这让「147-operation coverage」可以在实际只执行一个子集时被宣称达成。一句话即可补上。

## 1. 分母与契约闭合（核验点 1）—— 机器复算确认

我用真实结构重解根 OpenAPI（该文件扩展名是 `.yaml` 但内容是 JSON，`$ref` 按**路径键**逐条指向
shard 内的 path item，需逐个解析后再收集 operationId）：

```
root path 条目            = 124
root 可达 operationId     = 146     未解析 ref = 0
generated route registry  = 147     （operationId 全唯一）
REGISTRY-ONLY = ['releasePlatformStagedAsset']      ROOT-ONLY = []
```

**146 / 147 与「缺失的正是 `releasePlatformStagedAsset` 根引用」逐项对上。** ✓

我另行确认了**闭合方向**（设计未写，见 `N2`）：
`contracts/openapi/paths/platform-admin/group-workspace-management.paths.yaml` **确实声明**该 operation；
root 也 `$ref` 了这个 shard，但只在路径键 `/api/platform/assets/staging`（`:53-54`），
**缺的是 `/api/platform/assets/staging/{assetRef}/release` 这个路径键**；
`PlatformAssetController`（`@RequestMapping("/api/platform/assets/staging")`）实现存在；
registry 记录 `consumerFaces: ["platform-admin"]`、`owner: platform-asset`。
所以「补根引用」是对的方向，**不是**退役该 route。

`§3.1` 的机器控制也选对了：把 root 展开的 `{operationId, method, path, consumer-face}` 集合
与 generated registry 做 **exact-set** 校验，并挂在**既有** `edge-codegen --check` 上，
focused red 是「删除根引用或改 operationId/path 则 `--check` 必失败」。
这是补强既有 drift 防线，不是新增语义门——符合本仓 verification-governance 的加门三问。

## 2. Round-2 `S2` / `S3` 是否真实关闭（核验点 3）—— 均 CLOSED，字节可查

**`S2`（HTTP diagnostic 与 browser L2 混用）—— CLOSED。**
设计 `§3.2` 现行字节（`:57`）：

> 这是**覆盖与诊断**，不是性能 benchmark 或 browser L2。HTTP diagnostic 只启动其本机 backend
> 和所需受管 remote-middleware tunnel，并保留 run-scoped manifest、日志读取与资源回收；
> 它只报告 coverage/diagnostic 与 cleanup，**不**启动两个 frontend/Playwright，也不产生 Journey
> business 结果。已批准 Journey 的 browser L2 才在本机启动两个 frontend/Playwright，并单独判定
> 该 Journey 的 business 与 cleanup。

Round-2 点名要删改的那句已被替换，`§5.1`（`:139-142`）保留三分类，`:156-159` 记录了该更正。
我全文扫 `Playwright|frontend|browser L2|Journey`，**没有残留的相反表述**。✓
`§3.3` 的两层指标表还带「不能替代」列（operation profile ⊥ latency/吞吐结论；
performance study ⊥ 用户流程/安全正确性），分类是双向的。

**`S3`（extension typed failure 迁移分母不全）—— CLOSED，且比 Round-2 的最小要求更彻底。**
Batch B 的 “extension API closure” 段（`:103-111`）明写：public normalization result 与
**每一个 public typed failure（含 definition absence）**必须声明在 `com.catering.v2s.extension.api`，
"an implementation nested exception is not a public contract"；
并把有限分母写成**六处生产直接引用**。

我独立重算该分母（生产源，排除 `/build/` 与 `src/test/`）：

| # | 位置 | 性质 |
| ---: | --- | --- |
| 1–4 | `BusinessEntityService`、`OrganizationOverviewTaskReadService`、`ContractCommandService`、`ContractTaskReadService` | 跨模块 application consumer |
| 5 | `app/edge/problem/ContractProblemAdvice:44` | edge problem mapper |
| 6 | `extension/application/ExtensionAuditHistoryService:16` | owner 内部抛出点 |

引用该类型的生产文件共 **7** 个，第 7 个是 **声明方** `ExtensionDefinitionService` 本身
（`:214` `public static final class DefinitionNotFoundException`），不计入引用——
**所以 6 是对的**。✓

设计选择让**六处全部迁移**、并**移除**过时的 application 嵌套失败类型，
理由写为「否则留下第二份公开契约」。这比 Round-2 允许的「内部那个可继续 internal」更严，
方向正确：只迁五处会让同一语义存在两个可被 catch 的类型。

> 这同时关闭了我在上一轮 seed DB 复盘审阅中提的 `S1`（typed failure 未落在声明的 command-api package）。

## 3. owner 边界、效率分类与实施顺序（核验点 1、2）

**collection N+1 只在真实 page fan-out 修复 —— 成立，两处我都在源码确认：**

- operations head-company page：`OperationsBusinessEntityController:117` 的私有
  `headCompany(...)` 对**每个** HeadCompany 调用
  `entities.authorizedBrands(workspaceUuid, key, value.id())`，而该 owner 方法签名就是
  **单 head-company** 粒度（`BusinessEntityService:234`）→ 页级逐行扇出，确为真 N+1；
- platform workspace page 的逐 workspace logo asset resolve（同族）。

**反例被正确保留**：`§2` 第 5 条把 P4 ledger 里十个稳定批量读取明确判为
**「这些当前证据不是 N+1，必须逐项分类」**；红线 `SET_BASED_COLLECTION_READS` 也直书
"Single-object detail lookups and already-batched reads are counterexamples, not failures"。
Batch A 的 proof 形状正确：1 / 20 / 50 item page 下 DB 操作保持**常数上界**，
并保留空 asset/brand、跨 workspace、失效 status 与**单对象 detail 反例**的语义。

**命令正确性成本不得删除 —— 成立。**
红线 `COMMAND_CORRECTNESS_COST_PRESERVED` 逐项列出 idempotency、CAS、audit、rate limiting/locks、
owner authorization/state recheck、typed failure precision、required final owner readback；
Batch B `:98` 对 invitation 明写「OTP bucket、CAS、audit、typed errors、完成后的 owner completion
readback 不删除」，`:101` 对 hierarchy 明写「不删除 Project readback/CAS/audit」。
与我上一轮在 `completePublic` 源码确认的 `completion(read(token))` 边界一致。

**owner 边界 —— 成立。** Batch B `:99` 「edge 不拼 authorization facts」；
`:100` 「不得 import application/repository/entity，不得跨 schema DML」；
红线 `OWNER_LOCAL_EFFICIENCY_REPAIR` 把 batch task read / canonical session entry /
validation-normalization result / typed failure 一律要求落在 **owner 声明的 public API package**，
并要求迁移前扫描「每一个跨 owner consumer、edge problem mapper 和 owner 内部直接引用」。

**实施顺序 —— 成立且是本设计最强的地方。**
先闭合契约分母 → 再建 147 coverage → 最后按**已确认**热点拆独立小包。
`§4` 明写 Batch A–E 是**候选整改流**，不是已获准的 implementation package / change surface / package exit；
`§2` 第 6 条对多 intent 批量 API 直接设禁：「没有多 intent workload 前禁止实施 batch API」——
拒绝了为降数字提前抽象。

**Seed / JDBC 口径未被越读 —— 成立。**
红线 `MEASURED_PERFORMANCE_NOT_STATEMENT_COUNT` 与
`HTTP_OPERATION_DENOMINATOR_BEFORE_EFFICIENCY_CLAIM` 分别管住「statement count ≠ 性能」
与「样本 ≠ 全接口」；`§3.2` 还专门写了「正常 completion 的 DB count 可以是 0；零不能被误判失败」。

**secret 边界 —— 成立。** 红线 `DIAGNOSTIC_SECRET_FLOW_EXPLICIT`：
inventory 只含 symbolic handle 与非敏感 request shape；凭据/OTP/token/cookie/Authorization/identity
每 run 生成或直接注入内存 client，**排除所有持久化与输出面**，用后丢弃；
且要求 **"red proof covers attempted leakage, not only report redaction"**——
红测覆盖的是「尝试写入」而不只是「报告已脱敏」，这一点是对的。

**红线是否防复发（核验点 2）—— 是。**
九条 assertion 与本轮确认的九类失败一一对应，且开篇明确「不把 Seed 样本变成实施授权、
不建立全局 SQL-count 门、不替代详细业务/IA/owner 源码重读」——
是**设计评审纪律**而非机械门，符合本仓对新增门的三问约束。

## 4. S1 ｜147 coverage 的 `unexecuted` 只被披露，没有下限也没有逐项处置

`§3.2` 的 oracle：

> report 产生 `declared / attempted / correlated / passed / expectedRejected / unexecuted`；
> 任何 147 分母缺项、未知 op、缺 completion 或错误 operation metadata 均失败。

失败条件有四项：分母缺项、未知 op、缺 completion、错误 metadata。
**`unexecuted > 0` 不在其中。**

我全仓检索 `unexecuted`，只有三处：设计 `:54` 的输出类别、
红线 `:22` 的**披露**要求、红线 `:62` 的一条 review 提问。
**没有任何一处**要求：(a) 每个 `unexecuted` operation 记录逐项原因与处置；
(b) 存在未处置的 `unexecuted` 时该交付单元不得称为完成。

**具体失效场景**：一次 run 声明满 147（分母不缺项）、每个已执行 operation 都有正确 completion
与 metadata，但实际只执行 40 个、其余 107 记为 `unexecuted`——
四项失败条件**一条都不触发**，报告合法产出，而后续会话很容易把它引用为
「147-operation HTTP diagnostic coverage 已建立」。这恰是本设计第二交付单元的核心主张。

红线 `HTTP_OPERATION_DENOMINATOR_BEFORE_EFFICIENCY_CLAIM` 已经提供了**诚实**的一半（必须披露），
缺的是**有界**的一半。

**最小修复（一句话，不新增机制）**：在 `§3.2` 补一条——
每个 `unexecuted` operation 必须记录逐项原因（前置事实不可建立 / 需外部副作用 / 已由
`expectedRejected` 覆盖等）与显式处置；存在未记录原因的 `unexecuted` 时，
该 coverage 单元不得声明完成，报告须同时输出 `executedRatio` 与未处置计数。

**是否需要 Dexter 产品裁决**：否。

## 5. N

**N1 ｜当前 `static-scan` 为红，属既有 U12 控制面问题，作者已如实披露**

我实跑：`REMEDIATION_COMPLIANCE=FAIL / REASON=RM1_SUCCESSOR_AMENDMENT_HASH_DRIFT`，
active package 为 `RM1-SEED-REPORT-U12`。
作者 resolution `§3` 主动写明该失败「outside these new document paths and is not represented as
this design's PASS」——**披露准确**，本设计确未借它宣称 PASS，本轮为 design-only 也未开 package。
但它是一处**活的控制面红灯**，建议在下一个 package 开启前由 U12 owner 收口，避免被后续会话继承。
（作者另两项自述我也实跑核对：`build-index --check` KERNEL=6 / ROUTED=15 = 21 条；
`standards-coverage --phase R5` PASS，且未把 `RM1-P6-3` 说成矩阵 PASS。）

**N2 ｜146→147 的闭合方向没有写下依据**

`§2` 第 1 条只说「遗漏的是 `releasePlatformStagedAsset` 根路径引用……必须先修正」，
`§3.1` 直接给出「补根引用」的动作，但**没有记录为什么补而不是退役该 route**。
我自己建立了依据（shard 已声明、`PlatformAssetController` 已实现、root 只是缺该路径键、
registry 声明 `platform-admin` face）。写一句进设计可以省掉下一个读者的同样推导，
也能防止有人反向「修复」成删除 registry 条目。

## 6. 处置

- **`S1`** 在既有批准边界内，Codex 可自主处置（`§3.2` 补一条 `unexecuted` 处置规则）。
- **`N1`** 属 U12 owner；**`N2`** 一句话补记。
- **已确认为真、不应回退**：146/147 与 `releasePlatformStagedAsset` 的单点差异、
  `§3.1` 的 exact-set + focused red、`§3.2` 修正后的三类运行分离、
  Batch B 的六处迁移分母与「实现嵌套异常不是公开契约」、
  两处真实 page N+1 的定位与单对象/已批量读的反例保留、
  九条红线（尤其 `COMMAND_CORRECTNESS_COST_PRESERVED`、`OWNER_LOCAL_EFFICIENCY_REPAIR`、
  `DIAGNOSTIC_SECRET_FLOW_EXPLICIT`、`EXECUTION_EVIDENCE_TAXONOMY`）。
- **本 GO 仅覆盖静态设计**：不授权生产实现、契约/schema 变更、DEV/Seed/reset、
  managed diagnostic、browser L2、performance/business/cleanup PASS 或 Roadmap 变更。
  每个后续小包仍须单独授权、冻结详设并接受独立 IMPLEMENTATION review。
  本文件不开启第三轮 DESIGN 审查。
