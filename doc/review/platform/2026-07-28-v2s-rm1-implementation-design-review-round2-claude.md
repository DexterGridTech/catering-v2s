---
title: RM1 实施详设 post-remediation 复评（Claude，第二轮）
reviewTarget: DESIGN
reviewCycleId: RM1-WHOLE-SCOPE-DESIGN-2026-07-28
bindingMode: POST_REMEDIATION_V1
verdict: NO-GO
findings: M=1 / S=1 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅静态 implementation-facing design；不授权 contract、源码、migration、测试、脚本、DEV、seed/reset、动态运行或 Roadmap 状态变更
createdAt: 2026-07-28
---

# RM1 实施详设 post-remediation 复评

## 0. 结论

**NO-GO**，`M=1 / S=1 / N=2`。

**上轮 M1–M6 中，M1、M2、M4、M5、M6 与 S1 已真实关闭**（逐条亲验见 §2）。
**M3 部分关闭**：结构（`owningSourceSet[]`）已落地且 D1 不再是常量，
但**分母仍不完整**——3 个 routed source 在全部 11 个 unit 中零命中，
其中 2 个的 routing frontmatter 是 `["all"]`。这恰是 M3 原本要防的失败模式，故留为本轮唯一 M。

本轮 M/S/N **全部为仓内可机械修复，不涉及产品语义**，按既有批准边界交 Codex 自主修复，
**不构成再授权门槛**，也**不需要 Dexter 产品裁决**。

**授权边界**：本 GO/NO-GO 仅覆盖静态 implementation-facing design。
不授权 contract、源码、migration、测试、脚本、DEV、seed/reset、动态运行或 Roadmap 状态变更。

**会话出处**：fresh v2s-rooted 只读会话，非续接、非它仓。仓库零写入（本文件除外）。

---

## 1. 门复跑与绑定模式（按要求实跑）

```
scripts/check/implementation-design-granularity \
  --manifest doc/review/platform/2026-07-28-v2s-rm1-design-granularity-manifest.json \
  --review   doc/review/platform/2026-07-28-v2s-rm1-design-adversarial-review-round-2.json
```

实测输出：

```
IMPLEMENTATION_DESIGN_GRANULARITY=PASS
UNITS=11
FINDINGS=2
VERDICT=NO_GO
REVIEW_ROUND=2
REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE
REAL_EXIT=0
```

**判定：符合要求。** 结构门 PASS 的同时，`VERDICT=NO_GO` 与
`REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` 被如实透传——
**不是历史绿**，也没有把 round-2 的 NO_GO 洗成 PASS。两轮上限未被突破，
round-2 字节未被改写（其 `manifestSha256` 仍指向旧 manifest，这正是"不可变"的正确表现）。

---

## 2. M1–M6 逐条关闭核验

### M1 ｜设计 hash 冻结 —— **CLOSED**

本会话对 manifest 内**全部** `approvedSources[].sha256`、`sourceComplianceDenominators.*.sourceSha256`
以及 `owningSourceSet[].sha256` 逐个复算：**checked = 168，mismatched = 0**。
设计正文当前字节 `522ca0961fd7720e…`，manifest 声明与之一致。
上轮 11/11 失配已消除，且改法正确——**重算并重冻当前字节，未改写历史 round-2 的 hash**。

### M2 ｜P-D0 动态分母 —— **CLOSED**

`…implementation-design-and-plan.md:296` 现为：

> post-P3-B inventory exact set: each entry has requirement/resolver/owner recheck/red fixture;
> added/retired/unchanged fully classify; unclassified=0

全文检索 `20 writes` / `20 个业务写` / `20 write` 命中 **0**。
硬编码计数已彻底移除，判据改为 snapshot 的 exact set + 三集合完全分类 + `unclassified=0`。
这比我上轮建议的措辞更严（多了 `unclassified=0` 这一条兜底）。

### M3 ｜D1/D5 owning source set —— **部分关闭，留为本轮唯一 M**

**已关闭的部分**：
- `owningSourceSet[]` 在**全部** unit 的**全部** denominator 上存在（缺失数 = 0）；
- D1 每 unit 成员数 3–4，**distinct 绑定 = 8**（上轮为 1）；共享分组均可辩护
  （U02/U03/U04 = 三个 P3 后端安全 unit；U09/U10 = 两个 UI unit）;
- `incremental-compliance-hook.md` 已降为成员之一，不再是全部分母。

**未关闭的部分**：见 §3 的 M1。

### M4 ｜U09/U10 阻塞态 —— **CLOSED**

两个 UI unit 的 `OWNED_SURFACE_AND_PAGE_KEYS.applicability` 现为
`BLOCKED_FOR_INTERACTION_ACCEPTANCE`（上轮为 `APPLICABLE`），
且 `owningSourceSet[]` 内含 IA 工件条目、`artifactStatus=BLOCKED_FOR_INTERACTION_ACCEPTANCE`、
`requiredBeforeExit=true`、`anchor="TBD_AFTER_DEXTER_ACCEPTANCE"`：

- U09 → `ia-01-platform-otp-and-invitation-interaction.md`、`ia-02-operation-context-interaction.md`
- U10 → `ia-03-brand-authorization-interaction.md`

上轮 M4 的核心问题（U10 绑到一个**不治理该 surface** 的 carry-over manifest 却标 `APPLICABLE`）已解决：
carry-over 保留为成员之一，真正治理该 surface 的 IA 工件已具名并标记为 exit 前置。
`anchor` 占位为 `TBD_…` 在阻塞态下是正确的，**接受时必须换成唯一锚点**（已由 §7.1 规定）。

### M5 ｜amendment cycle 不可重置 —— **CLOSED**

`…implementation-design-and-plan.md` §7.1 现文：

> …review cycle only for that artifact and the explicitly bound P6/P3-D subsection; it cannot change any other
> unit, remove or relabel a pre-existing open finding, or re-freeze any old design bytes. Every still-open finding
> from this cycle is an exact input subset of the amendment cycle.

我上轮要求的三条**逐条命中**：①新 cycle 只覆盖 amendment 工件与其绑定 subsection；
②不清除/不重标未闭合 finding，且未闭合 finding 是新 cycle 输入的 exact subset；
③re-freeze 只允许新增、不得重算旧字节。**"改 hash 重置 cycle"的通路已封。**

### M6 ｜P2 静默失败防线 —— **CLOSED**

`…implementation-design-and-plan.md:193-197` 现含四条：

1. **正分母 assertion** —— 逐 module source-file count 与合计均非零，冻结为 rename receipt 的可复算输出；
2. **8 个 Flyway integration-test location** 相对前缀对新目录深度的精确对账；
3. **`walk()/walkFiles()` 输入根不存在必须具名 FAIL**；
4. **`budget()` 扫描根扩宽/缩窄的红变异**。

外加一句正面禁令：「禁止以空遍历绿灯证明跨 owner read 强制仍在生效」。

**特别说明（避免误判为缺陷）**：全文检索 `98` 命中为 0，但这**不是遗漏而是更正确的做法**——
把 98 写死本身就是硬编码分母（ST-7 同族）。改为"逐 module count 非零 + 冻结为可复算输出"
在防住空遍历的同时不引入新的魔数。**此处优于我上轮的建议措辞。**

### S1 ｜P7/P8 独立 receipt —— **CLOSED（留一条 N）**

`RM1-U11` 现为 `"P7/P8 independent closure receipt boundaries"`，
`approvedAssertions = ["RM1-U11_P7_EXIT", "RM1-U11_P8_EXIT"]`（两条具名），
`dependencyAndSerialBoundaries` 明写：

> "P7 and P8 remain separate execution packages in the plan" /
> "P8 starts only after the P7 receipt PASS" /
> "this historical review binding does not collapse those receipt boundaries"

**判定：足以避免假绿。** 理由：manifest unit 是**设计期评审绑定**粒度，
而 changed-path set equality 发生在**包 exit**（`doc/evidence/platform/rm1/<package>/package-exit.json`，
路径按 package 分），§6 完成判定表亦把 P7、P8 列为两行、各有 predecessor 与 stop condition。
两条具名 assertion + 显式边界声明 + 按包分的 receipt 路径，三者叠加已能独立审计。
残留一条可选收紧见 §3 的 N2。

---

## 3. 本轮 Findings

### M1 ｜D1 routed 分母仍不完整：3 个 routed source 在全部 11 个 unit 中零命中

**精确位置**：`doc/review/platform/2026-07-28-v2s-rm1-design-granularity-manifest.json`，
全部 11 个 unit 的 `sourceComplianceDenominators.PROJECT_MEMORY_ASSERTION_OCCURRENCES.owningSourceSet[]`。

**仓内事实（本会话机械枚举 `project-memory/kernel` + `project-memory/decisions` 共 11 份，
逐份检索是否出现在 manifest 全文）**——以下 3 份**零命中**：

| 零命中的 routed source | frontmatter routing | assertions |
| --- | --- | --- |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `taskKinds/domains/owners/impacts/triggers` 全为 **`["all"]`** | `PROGRAM_SCOPED_CURRENT_ONLY`、`R1_ONLY`、`GIT_BY_DEXTER`、`NO_R2_W1` |
| `project-memory/kernel/06-heritage-and-change.md` | 同上，全为 **`["all"]`** | `HERITAGE_READ_ONLY`、`NO_RUNTIME_FALLBACK`、`NEW_DECISION_FOR_DRIFT` |
| `project-memory/decisions/distributed-topology-is-not-current.md` | `taskKinds:["design","implementation","review"]`、`domains/owners:["backend","platform"]`、`triggers:["implementation","review"]` | `NO_MQ_OUTBOX_TDP`、`NO_INTERNAL_OPENAPI_CLIENT`、`NO_DISTRIBUTED_DEFAULTS` |

**为什么这是 M 而不是 N**：
`02-service-shape-and-owner.md` 的 routing frontmatter 与 01/06 **完全相同**（全 `["all"]`），
而它已被绑定在多个 unit 上。也就是说——**按 manifest 自己采用的 routing 模型，
01 与 06 路由到每一个 unit**，却在 11 个 unit 中一次都没出现。
`distributed-topology-is-not-current.md` 按其 routing 至少覆盖全部 backend/platform unit
（U02/U03/U04/U06/U07），同样零命中。

这正是设计 §8.1 自己定义的失败模式：
「A package can mechanically pass while omitting a routed assertion」。
且遗漏的不是边角内容——`HERITAGE_READ_ONLY` 直接治理 P2（整体结构迁移）与 P7（删死代码），
`GIT_BY_DEXTER` / `PROGRAM_SCOPED_CURRENT_ONLY` 治理 P0 的状态 owner 与 RM 系列注册，
`NO_MQ_OUTBOX_TDP` 治理 §1「以下不在 RM1」的边界本身。

**影响面**：11 个 unit 的 D1 分母；连带 P0 的 checker 扩展——
扩展做的是 `owningSourceSet[]` 的 exact set equality，若集合本身不全，
**扩展会对一个残缺分母精确对账并 PASS**，机制成本已付、收益未得。

**最小修复**：
1. 把上表 3 份按各自 routing 补入相应 unit 的 D1 `owningSourceSet[]`（含 path+sha256+selector）；
2. **同时**在 P0 的 checker 扩展中加一条**机械完整性校验**：
   对每个 unit，按 `project-memory` 各文件的 frontmatter routing 计算应命中集合，
   与 `owningSourceSet[]` 做 exact set equality，**缺一即具名红**。
   否则本轮补 3 份、下轮新增 memory 时仍会再漏一次。
3. 红变异：从任一 unit 的 D1 删除一个应命中成员 → 必须红且指名 unit 与该成员。

**为什么不是更小方案**：只补这 3 份而不加完整性校验，等于把"分母完整"重新交给人记忆——
而 M3 的存在本身就证明了这条路不成立。

**是否需要 Dexter 裁决**：**否**。这是机械对账缺口，不涉及产品语义。

---

### S1 ｜16 处 `disposition:"create"` 指向已存在路径，且 intake 对此项过度声称

**精确位置**：manifest `deliveryUnits[*].changeSurfaces[*]`，本会话逐条 `os.path.exists` 验证，
命中 **16 处**（上轮 17 处，仅减 1）。其中**具体已存在文件**两处：

- `RM1-U01` → `tools/compliance-control/cli.mjs`
- `RM1-U08` → `eslint.config.mjs`

其余 14 处为已存在目录（`libraries/backend/organization`、`apps/frontend/platform-admin`、
`scripts/check`、`doc/decisions` 等）。

**过度声称**：`doc/review/platform/2026-07-28-v2s-rm1-design-post-remediation-intake.md`
的处置表写「Claude M6 / S1 / S2 | CONFIRMED | …**path dispositions distinguish existing updates from creates**」。
**该项未实际发生**：16 处仍在，且 `tools/implementation-design-granularity/cli.mjs:369` 对
`disposition` 只做 `/^(create|update|delete|retain|not-applicable)/` 的**取值域正则**，
**不校验路径是否已存在**。

intake 表把三条（M6/S1/S2）合并为一行 `CONFIRMED`，其中 M6 与 S1 确已关闭、S2 未关闭，
合并陈述掩盖了这一点。

**影响面**：`disposition` 是 changed-path 对账的输入语义。
`create` 与 `update` 混淆会让 §1.1「新增式演进 vs 就地改写」这条边界无法机械判定。

**最小修复**：
1. 目录类条目改用明确取值（如 `update`，或新增 `create-under` 并在 schema 定义语义）；
   `tools/compliance-control/cli.mjs`、`eslint.config.mjs` 两处改 `update`；
2. 在 P0 的 checker 扩展中加：`disposition === "create"` 且路径已存在 → 具名红；
3. intake 表把 M6/S1/S2 拆成三行，S2 标 `OPEN` 而非并入 `CONFIRMED`。

**是否需要 Dexter 裁决**：**否**。

---

### N1 ｜§4 表格分隔行仍为 6 列，`deferred reason` 列不渲染

**精确位置**：`…implementation-design-and-plan.md:286`（表头 **7** 列）与 `:287`（分隔行 **6** 列）。
上轮 N1 未处置。GFM 下第 7 列被丢弃；57 行中 `P-C4`、`P-N1`、`P-U3`、`P-U4` 四行确有
`deferred reason` 内容，当前不可见。R-27 要求的"逐行七列"在渲染层面未成立。

**最小修复**：`:287` 补一个 `| ---`。

### N2 ｜U11 的两条 assertion 未显式 1:1 绑定到两条 receipt 路径

`RM1-U11.approvedAssertions = ["RM1-U11_P7_EXIT","RM1-U11_P8_EXIT"]` 与
`dependencyAndSerialBoundaries` 已足以避免假绿（见 §2 S1），
但两条 assertion 与 `doc/evidence/platform/rm1/P7/package-exit.json` /
`…/P8/package-exit.json` 之间的对应关系是**约定而非声明**。

**最小修复（可选收紧）**：在 U11 加一个 `assertionReceiptBinding` 字段，
把两条 assertion 各自映射到其 receipt 路径，使 P8 无法以 P7 的 receipt 满足自身 assertion。

---

## 4. 方案合理性（本轮增量）

上轮 §4 的判断不变（问题对、方案总体优、代价基本配），本轮只记增量：

**变好的两处**：
- P-D0 的新判据加了 `unclassified=0`，把"三集合分类"从描述升为可判定谓词——**优于我上轮的建议**。
- P2 用"逐 module count 非零 + 冻结为可复算输出"替代硬编码 98，**同时**防住空遍历与新魔数——
  这是本轮最好的一处设计判断。

**上轮提出、本轮仍未回答的两个取舍**（不升为 finding，但应在实施前有一句交代）：
1. `mutating-operation-inventory.json` 为何新建而非扩展已含
   `operationId/method/path/consumerFaces/owner` 的 `edge-route-face-registry.json`（T-1）；
2. P4-A scanner 与已裁决的 E-0'（运行时查询计数预算）的**主从关系**——
   scanner 应只产 ledger（分母），判据仍是运行时计数；若 scanner 成为主判据，
   等于回到被否决的静态代理路线。

---

## 5. UI 与交互强制自问

| 自问 | 回答 |
| --- | --- |
| 操作是否来自明确要求/批准 Journey | **已正确阻塞**。U09/U10 的 D5 现为 `BLOCKED_FOR_INTERACTION_ACCEPTANCE`，IA-01/02/03 列为 `requiredBeforeExit`。上轮"声明阻塞但形式可通过"的矛盾已消除 |
| 用户此时这样操作是否合逻辑 | R-24 单项增删合逻辑；撤销被阻断时展示具体门店优于泛化文案 |
| 有无更短路径 | 未发现 |
| 不合理之处来源 | 旧契约形态（只有整集合 `PUT`），已从契约层根治 |
| 是否需 Dexter 裁决 | **有且仅有 IA-01/02/03 的线框接受**——设计已正确挂起，本评审同意该处置。**本轮 M/S/N 均不需要产品裁决** |

`NOT_APPLICABLE` 不适用（本设计确含 UI 面）。

---

## 6. Part B / C / D 命中（对照 chapter-hit-map）

`doc/review/platform/2026-07-28-v2s-rm1-manifest-chapter-hit-map.md` 提供了 B.1–B.6、C、D
的章节导航与核验问题，本评审逐项回答：

| Part | 核验问题 | 判定 |
| --- | --- | --- |
| B.1 | Does every unit stay design-only and serial? | 命中（`implementationAuthority=false`；§1 拓扑串行；U11 边界见 §2 S1） |
| B.2 | 跨 owner 写是否 public-command + REQUIRED、migration 是否 additive | 命中（P3-B 四步 linearization；additive FK/migration） |
| B.3 | operation/capability/scope 是否 generated 且 server-derived | 命中（M2 关闭后无手写计数；resolver 由 server 事实派生） |
| B.4 | foundation 先于 app、UI 是否 Journey-backed | **部分**——foundation 顺序命中；Journey-backed 由 IA 阻塞态承接，未接受前不得实现 |
| B.5 | 无新增列表操作列 / bulk save / Drawer 替换 | 命中（§3 P3-D 明令禁止 bulk-save；操作历史沿用已接受 Modal） |
| B.6 | 包 exit 是否六分母、red-first、actual-file exact | **部分**——机制齐备，但 D1 分母不完整（本轮 M1） |
| C | standards matrix 是否作为 trace 分母而非抄录 | 命中（D6 指向 `standards-coverage-matrix.json`，按 phase due rule 追溯） |
| D | 每个 P-ID/ST-ID 是否有唯一 owner、红变异、exit assertion | 命中（57 行齐备；渲染缺陷见 N1） |

---

## 7. 处置与再评审条件

- **M1、S1、N1、N2 全部为仓内可机械修复**，交 Codex 在既有批准边界内自主修复，
  **不构成再授权门槛**，**不需要 Dexter 产品裁决**。
- **唯一仍需 Dexter 的**是 IA-01/02/03 的线框接受——这是设计已正确挂起的产品动作，
  不是本轮 finding。
- **再评审条件**：M1（补 3 份 routed source + 加完整性校验并验红）与 S1（disposition 语义 + 存在性校验）
  闭合后即可复评。本轮**不需要**再走独立子 agent 盲审——两轮上限已封顶，
  且 M1/S1 均为机械缺口、不改变设计形状。

**本评审不授权**：contract、源码、migration、测试、脚本、DEV、seed/reset、
动态运行、Roadmap 状态变更、下一 Roadmap step。
