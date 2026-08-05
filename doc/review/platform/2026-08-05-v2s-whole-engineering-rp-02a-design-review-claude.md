---
title: RP-02a implementation-facing 详设独立复核（Claude）
reviewTarget: DESIGN
scope: 同源契约消费者恢复（RP-02a-U01）详设
verdict: GO
findings: M=0 / S=0 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅授权设计复核；不授权生产实现、契约/generated wire、后端/前端/数据库修改、DEV/UAT/runtime、HTTP/L2、seed/reset、业务或 cleanup PASS、Roadmap 变更或 Git 操作
reviewedBytes:
  design: 1b59e62ba838886e12c2eb2d22ac644ec58c23204e38f3349fa87ac310f09fd7
  independentRound2: 799ebde236c523e5617bc10f52177161468e01025e000d071fe13d522b6ef415
createdAt: 2026-08-05
---

# RP-02a 详设独立复核

## 0. 结论

**GO — `M=0 / S=0 / N=2`。**

两份声明 hash 我均复算一致。**七项重点核验全部通过，且没有一处是靠自报数字通过的** ——
每个分母我都用当前字节独立重算或实际执行了投影函数。

这份详设最值得肯定的一点：**它的每个数字都能被独立复现**，
包括最容易被含混带过的"10 个缺失 fact 恰好等于差集"和"投影确实产出 154 = 50/92/12"。

## 1. 七项重点核验 —— 逐条独立复算

### ① 154 条 registry / placement / catalog / fact 语义闭合 —— **CONFIRMED**

```
generated registry   154   face 拆分 {platform-admin:50, operations-admin:92, public:12}
                           （其自身 closure 声明与我的重算逐字一致）
placement            154
source catalog       121   denominator.faces = {50, 59, 12}
projectEdgeCatalog   154   face 拆分 {50, 92, 12}   ← 我实际调用该函数得到
registry-only        42        catalog-only 9        121 + 42 − 9 = 154 ✓
scenario facts       144 unique IDs / 84 groups      154 − 144 = 10 ✓
```

**最关键的一条我单独验证了**：详设 `§2.2` 点名的 10 个缺失 operation
**恰好等于 `registry ∖ facts` 差集**——

```
设计点名 10 个 == 实际差集 ?  True
  设计有而实际无：[]      实际有而设计无：[]      facts 中有而 registry 无：[]
```

**双向差集为空，且无陈旧 fact。** fact 分母是精确闭合的，不是"补够数"。

`§1.1` 拒绝从 operationId/method/route/face 生成事实、要求逐条重开 owner source，
与 `http-diagnostic-scenarios.mjs` 自身注释
*"no operation name, method or route is used to invent a scenario"* 的既有不变量一致。

### ② projection materialize、R24/P3C 保真与 identity readback 可执行 —— **CONFIRMED**

- `projectEdgeCatalog(catalog, report)` 存在于
  `scripts/generate/edge-operation-projections.mjs:141`，实现为 `projectR24 → projectP3C` 的复合；
  **我以当前 catalog + placement 实际执行，输出 154 = 50/92/12**，与详设 `§2` 的目标形状一致。
- `scripts/generate/r5-edge-materialize.mjs` **已存在且支持 `--check`（`:368`）与 `--self-test`（`:369`）**，
  因此 `§2.1` 把它列为强制静态证明是**可执行的**，不是虚指。
- `projectionState=MATERIALIZED` 当前在投影模块中**不存在** ——
  详设 `§1.1` 明确写为"投影模块**增加**显式 MATERIALIZED 状态与幂等 readback"，
  **属如实声明的待做变更，不是把未来当现状**。
- `§2.1` 对 identity 的约束（"a subsequent projectEdgeCatalog call must be an identity projection
  and must preserve error augmentations、componentFieldBaseline/componentOverrides 与具体 query 参数"）
  是可机械判定的，并绑定了两条既有 check 作为证明。

### ③ hierarchy extension 的 owner 绑定 —— **CONFIRMED，且是一处真实纠错**

`§2.2` 与 `§2.2` 后的更正段（`:109-113`）声称该 route 由
`OperationsOrganizationExtensionController.hierarchyDefinition` 拥有，
而**不是** `OperationsOrganizationHierarchyController`。我打开源码逐字确认：

```java
// OperationsOrganizationExtensionController.java:41
ExtensionDefinition hierarchyDefinition(EdgeRequestContext request, @PathVariable String groupWorkspaceKey,
        @RequestParam long expectedContextVersion, @RequestParam("entityType") String hostType) {
// :43
    if (!java.util.Set.of("COMMERCIAL_GROUP", "REGION", "PROJECT").contains(hostType))
        throw new InvalidEdgeRequestException("unsupported host type");
```

controller、方法名、以及详设点名的 `COMMERCIAL_GROUP/REGION/PROJECT` allowlist **全部逐字属实**。
详设把原始 owner 简写显式标为"correction"而非静默改写，处置正确。

### ④ projectId 四类分母 —— **CONFIRMED，四组全部精确**

**(a) 四个禁止的 body 位点** —— 实测正是这四处：

```
workload:417  createOperationsOrganizationStore   body:{projectId, brandId, tenantId, code, name}
workload:441  createOperationsContract            body:{projectId, storeId, phaseName, …}
fixture:133 / fixture:134                          各含 1 处
```

（详设写的 `:415-418` / `:439-442` 是包含该 body 的行区间，实际字段行落在区间内。）

**(b) 五个非法 query 调用** —— 实测 workload 中 spread `projectContext()` 的正是这五个：

```
:414 getOperationsOrganizationStoreCandidates    :437 getOperationsContractExtensionDefinition
:438 getOperationsContractCandidates             :444 getOperationsContracts
:457 getOperationsOrganizationStores
```

**(c) 唯一保留的 outbound query** —— `:493` `getPlatformOrganizationOverviewPage` ✓

**(d) 三个契约声明的 query operation** —— 我从 root OpenAPI 展开全部 154 个 operation
逐个检查 `parameters[in=query].name == 'projectId'`，结果**恰好三个**：

```
getOperationsOrganizationCandidates
getPlatformOrganizationCandidates
getPlatformOrganizationOverviewPage
```

**与详设点名的三个逐字相同。** 这同时反证了 (b) 的五个 operation 契约上确实未声明该字段，
strict parsing 会拒绝——详设的理由成立，不是推测。

**state allowlist** 也对：`:406` `PROJECT_SCOPE`、`:407-408` `SCOPED_STORE_FACTS`，
正是详设 `§2.3` 点名的两项。

`§5` 明确拒绝"broad projectId grep gate that ignores request context" ——
与我在全工程评审中反复强调的"同名不同义"一致，**没有把四类分母压成一个正则**。

### ⑤ 154 行 crosswalk 与 42/9 replacement rows 是否足以防 generic alias 假闭环 —— **CONFIRMED**

实测 `registry ∖ catalog = 42`、`catalog ∖ registry = 9`，与详设一致。
我抽看了那 9 个 catalog-only 记录，它们**确实是泛化形状**：

```
cancelOperationsWorkspaceInvitation / createOperationsWorkspaceInvitation /
getOperationsWorkspaceInvitationCandidates / getOperationsWorkspaceInvitations /
getOperationsWorkspaceUser …
```

而 registry 侧对应的是按 target 展开的具体 operation
（`cancelOperationsWorkspaceGroupInvitation` / `…RegionInvitation` / `…ProjectInvitation` / …）——
**这正是 operations-admin 从 59 涨到 92 的来源**，也说明"保留 generic 作为 alias"会让
catalog 分母看起来闭合而消费者实际调用不同端点。

`§2.1` 明确禁止保留 alias 并给出理由，且要求每行携带
operationId/method/path/face/owner/参数 metadata/schema/status/idempotency/errorSetRef/
augmentation 规则/scenarioIds/proof refs/source path 与 anchor ——
**这是语义级 crosswalk，不是 ID 对表**，足以防假闭环。

### ⑥ recovery 四步与 public invitation 七步是否独立 —— **CONFIRMED**

```
executeOperationsRecoveryWorkload (workload:782-837) 实际 invoke 序列：
  1 startOperationsPasswordRecovery   2 sendOperationsPasswordRecoveryOtp
  3 verifyOperationsPasswordRecoveryOtp  4 completeOperationsPasswordRecovery   ← 恰好 4，顺序与详设一致

executePublicInvitationWorkload (workload:263-) 实际 7 步：
  view / accept / sendOtp / verifyOtp / saveCredentials / complete / getCompletion   ← 恰好 7

http-diagnostic-workload.test.mjs:260  assert.equal(recovery.calls.length, 7)   ← 断言的确实是 recovery
```

我特意核对了 test `:257` 的赋值（`const recovery = await executeOperationsRecoveryWorkload(...)`），
确认 `:260` 断言的是 **recovery 而非 invitation** ——
详设"test expects 7, implementation executes 4"的前提**属实**，
两个 workload 是彼此独立的函数，`§1.1(4)` 与 `§5` 的反例表述正确。

### ⑦ 过度设计 / 遗漏证据 / 静态冒充业务 —— **均未发现**

- **无过度设计**：`§5` 主动拒绝两项更大的方案——
  "generic route-to-fact generator" 与 "broad projectId grep gate"；
  D4 validator 明确留给 RP-02b 且**不阻塞本单元**（`§1.1` 末）。
- **无静态冒充业务**：`§4` 的 business 与 cleanup 两行均为
  `NOT_APPLICABLE_WITH_REASON`，并写明"later dynamic package must provide fresh evidence"；
  `§1.2` 第四条明写"不把静态 fact/payload/test PASS 描述为 business 或 cleanup PASS"。
- **证据链完整**：`§4` 七类 evidence 每条都配了**具体的 red mutation**
  （删 fact / 重复 fact / 留 147 / 恢复 generic ID / 删 augmentation / 重加 body 字段 /
  改 recovery 顺序 / 加 alias），不是"补测试"式空泛表述。
- `§6` 的六条 exit 条件包含 pre/post receipt、四类分母 exact equality、
  fresh independent IMPLEMENTATION review 与 package-exit set equality。

## 2. N（两条，均不阻塞）

**N1 ｜`§2.1` 的现在时表述读起来像 crosswalk 已存在**

`§2.1` 首句：*"…-catalog-crosswalk.json **records** the before/after sets and every replacement."*
但该文件当前**不存在**（我已确认）。`§3` 第 1 步写的是
"**Record** the 42 registry-only and 9 catalog-only operation IDs in the crosswalk evidence"，
即它是实施期产物 —— 语义上没有矛盾，但 `§2.1` 单独读会被误认为既有工件。

**最小修订**：`§2.1` 改为将来时或加"（本单元实施期产出）"。**是否需要 Dexter 裁决**：否。

**N2 ｜`r5-edge-materialize --check` 被列为强制静态证明，但没有 `scripts/check/` wrapper**

`§2.1` 把 `edge-codegen --check` 与 `r5-edge-materialize --check` 并列为强制证明。
前者有 `scripts/check/edge-codegen` 且已串入 `scripts/verify`；
后者只存在于 `scripts/generate/r5-edge-materialize.mjs`，**无 `scripts/check/` wrapper、不在 verify 中**。

按我在全工程评审中确认的结构性事实（38 道门只有 10 道进 verify，
`logging-boundaries` 因此长期红而无人知），**一条只能从 generate 路径手工调用的"强制证明"
在实践中容易漏跑**。

**最小修订**：在实施包中为它加 `scripts/check/` wrapper 并按 RP-00/RP-00b 的分类流程处置
（而不是在本单元直接接线 verify —— 那属 RP-00b 范围）。
**是否需要 Dexter 裁决**：否。

## 3. 我确认为正确、不应回退的部分

- 10 个缺失 fact 与 `registry ∖ facts` 的**双向差集为空**；
- `projectEdgeCatalog` 实际输出 154 = 50/92/12，与三个分母同形；
- 42 / 9 / `121+42−9=154` 的迁移算术，及"迁移算术不是第二份 runtime truth"的定性；
- hierarchy extension 的 owner 更正与 host-type allowlist；
- projectId 四组分母（4 body / 5 非法 query / 1 保留 query / 3 契约声明）与 state allowlist；
- recovery 精确四步有序、invitation 七步不变、两者函数独立；
- `§5` 对"generic route-to-fact generator"与"broad projectId grep gate"的明确拒绝；
- `§4` business/cleanup 的 `NOT_APPLICABLE_WITH_REASON` 与"later dynamic package"边界。

## 4. 处置与授权边界

- **`N1`/`N2`** 均在既有边界内，可在实施包中一并处置，不阻塞本次设计 GO。
- **本 GO 只授权设计复核收口。** 不授权生产实现、契约/generated wire、
  后端/前端/数据库修改、DEV/UAT/runtime、HTTP/L2、seed/reset、
  业务或 cleanup PASS、Roadmap 变更或 Git 操作。
- RP-02a 实施仍须**单独 implementation package**、fresh independent
  `REVIEW_TARGET=IMPLEMENTATION` 审查、作者 intake 与 Claude 复核，
  并按 `§6` 六条 exit 条件闭合；**不得借用本轮设计评审状态**。
- RP-02b 的 D4 validator 仍待 Dexter 裁决，不在本单元范围内。
