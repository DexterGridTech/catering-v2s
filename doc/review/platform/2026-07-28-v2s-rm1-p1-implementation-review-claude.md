---
title: RM1 P1（RM1-U05）实现复核（Claude）
reviewTarget: IMPLEMENTATION
scope: RM1-P1 / RM1-U05 current bytes
verdict: GO
findings: M=0 / S=0 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅复审当前 P1 静态实施与证据；不启动动态环境、DEV、seed/reset；不改写历史 design review；不授权进入 P2
createdAt: 2026-07-28
---

# RM1 P1（RM1-U05）实现复核

## 0. 结论

**GO**，`M=0 / S=0 / N=3`。

六个指定核验点**全部 CONFIRMED**。四条 finding（round-2 的 M=3 / S=1）经独立复算与变异验证，
**是真实关闭，不是补文档**——其中 ledger 的四类红变异直接命中**语义控制本身**，
而非外层 hash 锚点（这比 P3-U12 那轮的验证强度更高）。

| 核验点 | 分类 | 依据 |
| --- | --- | --- |
| 1 surface 均为 update / gate PASS / 历史 verdict 未改写 | **CONFIRMED** | 13/13 `update`，create-on-existing **0**；gate `PASS` 且 `VERDICT=NO_GO` + `DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` 原样保留 |
| 2 D5 `APPLICABLE` + 三者结构化绑定当前 receipt hash | **CONFIRMED** | `ownedSurfaceTrace` 三个 hash = trace = exit receipt = 当前字节，逐条复算相等 |
| 3 allowlist 与 manifest exact-set；不得自授权 | **CONFIRMED** | 13 = 13 精确相等；`validateRM1ApprovedSurfaceSet` 从 manifest 派生 expected，注入即红 |
| 4 七项 ledger authority/relation 逐项 exact；改动必红 | **CONFIRMED** | 7 行 authority SHA 全对；四类变异各自具名红 |
| 5 ST-2/6/9/11 仅 defer 至 P5/P6 | **CONFIRMED** | `DEFERRED_CLOSURES=ST-2:P6,ST-6:P6,ST-9:P5,ST-11:P6`；提升为 direct 即红 |
| 6 capability value 不得反写进 handwritten catalog | **CONFIRMED** | 字面量 **0**、常量引用 **44**；40 条解析值与权威 binding **0 不符** |

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）；
变异全部在 scratchpad 完整拷贝上进行，用后即弃。

**授权边界**：仅复审当前 P1 静态实施与证据。不启动动态环境、DEV、seed/reset，
不改写历史 design review，**不授权进入 P2**。

---

## 1. 机械证据复跑

| 命令 | 结果 | REAL_EXIT |
| --- | --- | --- |
| `compliance-control validate-delta-receipts` | `INCREMENTAL_RECEIPT_COVERAGE=PASS` / `PACKAGE_ID=RM1-U05` / `CHANGED=20` / `RECOVERED=0` | 0 |
| `compliance-control validate-package-exit …rm1-u05-package-exit.json` | 真仓红（见 §1.1）；**干净基线 `PACKAGE_EXIT=PASS` / `CHANGED=19`** | 1 / **0** |
| `compliance-control static-scan` | `REMEDIATION_COMPLIANCE=PASS` / `RULES=33` / `MODE=RM1_STATIC_ADMISSION` | 0 |
| `authority-source-ledger check` | `PASS` / `IDS=ST-2,ST-3,ST-4,ST-6,ST-8,ST-9,ST-11` / `DIRECT=ST-3,ST-4,ST-8` | 0 |
| `authority-source-ledger self-test` | 5 条 RED 全 PASS（含 `P1_LEDGER_RELATION_RED`） | 0 |
| `implementation-design-granularity` | `PASS` / `UNITS=12` / `VERDICT=NO_GO` / `DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` | — |
| `scripts/check/frontend-architecture` | `R5_FRONTEND_ARCHITECTURE=PASS` | 0 |
| `scripts/check/capability-invariants` | PASS | 0 |
| `edge-codegen.mjs --check` | PASS | 0 |
| `standards-coverage --phase R5` | PASS | 0 |

### 1.1 真仓 `validate-package-exit` 为红 —— 系本次评审自身，非 P1 缺陷

与上一轮同型：`.runtime/compliance-control/current-problem-intake.json` 的
`promptSha256 = 6cf2531ab111…` 即**本次评审 prompt**，尚无 disposition，
经 `validateCurrentProblemFamilyDisposition` 抛 `PROBLEM_FAMILY_DISCOVERY_REQUIRED`。
`validate-delta-receipts` 的 `CHANGED=20` 亦比 exit 的 19 多出这一条。

在 scratchpad 完整拷贝中仅移除该 intake 与 current 指针后复跑：

```
PACKAGE_EXIT=PASS   PACKAGE_ID=RM1-U05   CHANGED=19
SOURCE_DISPOSITION_ROWS=33   REAL_EXIT=0
```

**19 与来件声称的"19 个 exit changed paths 与 19 个 receipts exact-set"一致。不计为 finding。**

---

## 2. 点 1 ｜surface 均为 update、gate PASS、历史 verdict 未改写 —— `CONFIRMED`

**owning source**：`doc/review/platform/2026-07-28-v2s-rm1-design-granularity-manifest.json`（`RM1-U05.changeSurfaces`）

13 条 changeSurfaces **全部 `disposition: update`，且 13/13 路径当前存在**，
`create` 且已存在者 = **0**：

```
doc/evidence/platform/rm1/p1                 scripts/check/authority-source-ledger
tools/authority-source-ledger/cli.mjs        apps/frontend/platform-admin/.../pageRegistry.tsx
apps/.../WorkspaceAdministrationPage.tsx     contracts/policy/affected-l2-registry.json
.runtime/compliance-control/active-package.json   tools/verify-gates/cli.mjs
libraries/backend/workspace-iam/.../WorkspaceCapabilityRequirementCatalog.java
tools/compliance-control/cli.mjs             scripts/generate/edge-codegen.mjs
doc/review/platform/2026-07-28-v2s-rm1-design-granularity-manifest.json
.runtime/compliance-control/problem-family-dispositions
```

**历史 design cycle verdict 未被改写**（gate 输出原样）：

```
IMPLEMENTATION_DESIGN_GRANULARITY=PASS
UNITS=12   FINDINGS=2   REVIEW_ROUND=2
VERDICT=NO_GO
REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE
```

即 gate 自身 PASS，而其所绑定的 round-2 verdict 仍诚实保留为 `NO_GO`。

---

## 3. 点 2 ｜D5 与 owned-surface 结构化绑定 —— `CONFIRMED`

**owning source**：manifest `RM1-U05.sourceComplianceDenominators.OWNED_SURFACE_AND_PAGE_KEYS`；
`rm1-u05-package-exit.json` 的 `ownedSurfaceTrace`

D5 为 `applicability: "APPLICABLE"`、`missingEntryFails: true`，
`sourcePath` = `contracts/policy/frontend-asset-carryover-manifest.json`，
`sourceSha256 = c3b42d0f9f851ffd…` **与当前字节复算一致**，并带 `owningSourceSet[]`。

exit 的 `ownedSurfaceTrace` 结构化绑定：

| 项 | trace 声明 | exit receipt | 当前字节 | 判定 |
| --- | --- | --- | --- | --- |
| `WorkspaceAdministrationPage.tsx`（targetPath） | `39b5eb70d36a2b…` | `39b5eb70d36a2b…` | `39b5eb70d36a2b…` | OK |
| `pageRegistry.tsx`（supportPaths） | `7d180dd1fa636f…` | `7d180dd1fa636f…` | `7d180dd1fa636f…` | OK |

`surfaceId = PLATFORM-WORKSPACE-OVERVIEW` 经复核确实存在于 carry-over manifest 中。

**独立红变异**（scratchpad）：清空 `ownedSurfaceTrace` →
`REASON=RM1_U05_OWNED_SURFACE_TRACE_INVALID`，与来件声称一致。

---

## 4. 点 3 ｜allowlist exact-set 且不能自授权 —— `CONFIRMED`

**owning source**：`.runtime/compliance-control/active-package.json`；
`tools/compliance-control/cli.mjs:518-526`（`validateRM1ApprovedSurfaceSet`）

```
allowedChangeSurfaces : 13
manifest changeSurfaces: 13
exact-set 相等         : True   （双向差集皆空）
```

**反自授权的形状**（关键在 `expected` 的来源）：

```js
const expected = (rm1.unit.changeSurfaces || []).map((s) => s?.path).sort();   // ← 来自 manifest
const actual   = [...active.allowedChangeSurfaces].sort();
if (… actual.some((s, i) => s !== expected[i]))
    throw new Error(`RM1_ALLOWED_SURFACE_MANIFEST_DRIFT:${active.packageId}`);
```

`expected` **由 manifest 派生**，allowlist 无法自证其合法——
`scripts/generate/edge-codegen.mjs` 与 `.runtime/compliance-control/problem-family-dispositions`
虽在 allowlist 中，但二者**同时在 manifest changeSurfaces 中**，故授权源是设计而非 allowlist。

**独立红变异**（scratchpad）：向 allowlist 注入 `README.md` →
`REASON=RM1_ALLOWED_SURFACE_MANIFEST_DRIFT:RM1-U05`，与来件声称一致。

---

## 5. 点 4 ｜七项 ledger 逐项 exact 且改动必红 —— `CONFIRMED`

**owning source**：`doc/evidence/platform/rm1/p1/authority-ledger.json`；`tools/authority-source-ledger/cli.mjs`

```
frozenIdSet          : ST-2 ST-3 ST-4 ST-6 ST-8 ST-9 ST-11      （恰为 7-ID 集合）
directClosureIds     : ST-3 ST-4 ST-8
deferredClosureOwners: ST-2→P6  ST-6→P6  ST-9→P5  ST-11→P6
rows                 : 7        authority SHA 与当前字节不符 : 0
```

每行的 `authority` 有 `kind/path/selector/sha256`；`generatorRelation` 逐项完整：

| ST | authority.kind | generatorRelation |
| --- | --- | --- |
| ST-3 / ST-4 | `CURRENT_CATALOG`（`admin-catalog.json`） | `EDGE_CODEGEN_CATALOG_PROJECTION` + path + selector |
| ST-8 / ST-11 | `CURRENT_CARRY_OVER_MANIFEST` | ST-8 有 `CARRYOVER_TARGET_PATH_DERIVATION`；ST-11 为 `NONE` + reason |
| ST-2 / ST-6 / ST-9 | `PLANNED_P6/P6/P5_AUTHORITY` + reason | `NONE` + reason |

**`consumerTraces` 是可执行的、非装饰性的**——`cli.mjs:57` 实际执行
`rg -l --glob <glob> <pattern> <root>`，把命中文件集与 `expectedPaths` 排序后比对。
这意味着"消费者可机械追溯到 authority"是**跑出来的**，不是写上去的。

**独立红变异（scratchpad，四类，全部命中语义控制本身）**：

| 变异 | REASON | EXIT |
| --- | --- | --- |
| 改 ST-3 的 `generatorRelation.selector` | `P1_LEDGER_ROW_INVALID:ST-3` | 1 |
| 改 ST-2 的 `NONE` reason | `P1_LEDGER_ROW_INVALID:ST-2` | 1 |
| 删一个 `consumerTrace.expectedPaths` 成员 | `P1_LEDGER_CONSUMER_SET_DRIFT:workspace-overview-title-consumer` | 1 |
| 把 ST-9 从 deferred 提升为 direct closure | `P1_LEDGER_ROW_INVALID:ST-9` | 1 |

> **与 P3-U12 的对照**：那一轮的语义红被外层 receipt 锚点先行拦截，只能靠 self-test 证明；
> **本轮四类变异均直接触发语义控制**，因为 `authority-source-ledger check` 独立读 ledger、
> 不经 receipt 锚点包装。**本项的验证强度高于上一轮。**

---

## 6. 点 5 ｜ST-2/6/9/11 仅 defer —— `CONFIRMED`

`authority-source-ledger check` 输出：
`DIRECT_CLOSURES=ST-3,ST-4,ST-8`、`DEFERRED_CLOSURES=ST-2:P6,ST-6:P6,ST-9:P5,ST-11:P6`。
exit 的 `deferredLedgerClosure` 字段与之逐字相同。
`controls` 列表为 `[ST-3, ST-4, ST-8, R5_ADMIN_CATALOG_BACKEND_LITERAL,
P1_LEDGER_AUTHORITY_RELATION, D5:OWNED_SURFACE, RM1_APPROVED_SURFACE_SET]`
——**不含 ST-2/6/9/11**，未冒称关闭。

**红变异**（上表第 4 条）证明：把 ST-9 提升为 direct closure 会红。

---

## 7. 点 6 ｜capability value 未反写进 handwritten catalog —— `CONFIRMED`

**owning source**：`libraries/backend/workspace-iam/.../api/WorkspaceCapabilityRequirementCatalog.java`（handwritten）；
`…/api/WorkspaceAuthorizationCatalog.java`（**生成物**，首行即
`// Generated from contracts/catalog/admin-catalog.json; do not edit.`）；
`doc/evidence/platform/rm1/p1/rm1-u05-backend-catalog-literal-discovery.json`

**当前状态实测**：

```
WorkspaceCapabilityRequirementCatalog.java：
  引号包裹的 "BC-*" 字面量 : 0        （P3 交付时为 44）
  CapabilityKeys.* 引用    : 44
  例：requirement("REQ_CANCEL_…_HEAD_COMPANY_INVITATION",
        WorkspaceAuthorizationCatalog.CapabilityKeys.BC_IAM_HEAD_COMPANY_INVITE, …)
scripts/check/frontend-architecture → R5_FRONTEND_ARCHITECTURE=PASS（原为该门的红因）
```

**值一致性亲验（编译器抓不到"用错另一个存在的常量"，故必须比对值）**：
解析生成物的 34 个 `CapabilityKeys` 常量值，再对 40 条 IAM user-management requirement
按 target/action 反查 `admin-catalog.json` 的权威 `userManagementActionBindings` 比对：

```
比对 40 条，与权威不符 0 条
```

**结论**：capability 值现在的流向是
`admin-catalog.json`（权威）→ 生成的 `CapabilityKeys` → handwritten catalog **按引用消费**。
这也**回溯性地加固了 P3 那轮的 M2**：HEAD_COMPANY 之类的拼写漂移此后**编译期即不可能发生**。

---

## 8. N（观察项，不阻塞）

**N1 ｜`businessEvidenceObligation` 是逐单元**声明**而非从变更面派生**

`business = "NOT_APPLICABLE"`，reason 为「Control-only authority and generated-source provenance
repair; P1 changes no user journey, API, database or dynamic runtime」。

**本会话确认该声明对 U05 是实质正确的**：U05 的 `actualChangedPaths` 确实含
`libraries/backend/workspace-iam/src/main/java/.../WorkspaceCapabilityRequirementCatalog.java`
（`45a7539380cb… → a301cd5b4beb…`，receipt 链确认 RM1-U05 拥有到当前字节的最终跳），
但该改动是**字面量 → 同值生成常量引用**的保行为重构，
已由 §7 的「40/40 值与权威一致」独立证实。

**观察点**：`validateRequiredDynamicEvidence`（`cli.mjs:585-591`）只在
`binding.businessEvidenceObligation` 被显式设为
`REQUIRED_CURRENT_BYTE_DYNAMIC_HIERARCHY_AND_CAPABILITY` 时才生效；
U05 的 manifest 单元**未设置该字段**，故 `NOT_APPLICABLE` 不受该控制约束。

作者在上一轮采纳本评审 M3 时，选择了**声明式**（新增 `NOT_REQUIRED_CONTROL_ONLY` 取值）
而非本评审建议的**从 `actualChangedPaths` 派生**。两者都自洽，
但声明式允许未来某个触及 backend main 的包通过省略该字段自我豁免。
对照点 3 的 allowlist 已做成「从 manifest 派生」，此处形状不一致。
**不构成本轮 finding**（U05 的声明实质正确），建议在 P8 前统一为派生式或补一条交叉控制。

**N2 ｜`consumerTraces` 依赖外部 `rg`**
`cli.mjs:57` 通过 `spawnSync("rg", …)` 执行。若 CI/他机无 `ripgrep`，
该校验的失败形态取决于 `spawnSync` 的错误处理。本会话环境有 `rg`，控制正常工作；
建议确认无 `rg` 时是 fail-closed 而非静默跳过。**未验证，标 `UNVERIFIED`。**

**N3 ｜本评审的核验边界**
真仓 `validate-package-exit` 的红系本评审 prompt 自身 intake 所致（§1.1），
干净基线为 PASS。该边界与上一轮同型，不构成 finding。

---

## 9. 处置

**M=0 / S=0 / N=3。** 无需 Dexter 产品裁决。

**RM1-P1（RM1-U05）可 GO。**

**本复核不授权**：进入 P2、启动动态环境、DEV、seed/reset、改写历史 design review。
P2 的启动需单独授权。
