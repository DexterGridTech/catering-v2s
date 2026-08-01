---
title: RM1 P3-A+B+C 整改后实现复核（Claude，第三轮）
reviewTarget: IMPLEMENTATION
scope: RM1-P3-A + P3-B + P3-C（RM1-U12）current bytes
verdict: GO
findings: M=0 / S=0 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅复审 P3-A+B+C current bytes 与整改证据；不进入下一 P，不改 Roadmap 状态，不做 DEV、seed、reset 或任何破坏性操作
createdAt: 2026-07-28
---

# RM1 P3-A+B+C 整改后实现复核（第三轮）

## 0. 结论

**GO**，`M=0 / S=0 / N=3`。

上一轮 `M1 / M2 / S1 / S2` **四条全部 CONFIRMED 关闭**，且关闭方式经本会话独立复算与变异验证。
三条 N 均为观察项与核验边界披露，**不阻塞**。

| finding | 分类 | 一句话 |
| --- | --- | --- |
| M1 生成输出分母 | **CONFIRMED（已关闭）** | 分母显式含两个产物；registry 走连续性恢复、operations-edge 走 incremental+terminal replay；checker 用 `exactSet` 强制并禁止互相冒充 |
| M2 HEAD_COMPANY 能力键 | **CONFIRMED（已关闭）** | 8 条全部改为权威连字符；生产/契约/生成物三侧下划线残留 **0** |
| S1 resolver 接线状态 | **CONFIRMED（已关闭）** | exit 新增 `componentWiringStatus`，如实声明 `wired: false`，未为关闭 finding 而错误接线 |
| S2 recovery 分类谓词 | **CONFIRMED（已关闭）** | 谓词已显式定义为**同包有向路径**；按该谓词复算 31/31 与 20/20 全部成立 |

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）；
全部变异在 scratchpad 拷贝上进行（hook-events 2648 条与真仓逐数一致），用后即弃。
不采信历史 round-2 verdict 与作者结论。

**授权边界**：仅复审 P3-A+B+C current bytes 与整改证据。
不进入下一 P，不改 Roadmap 状态，不做 DEV、seed、reset 或任何破坏性操作。

---

## 1. 机械证据复跑结果

| 命令 | 结果 | REAL_EXIT |
| --- | --- | --- |
| `compliance-control validate-delta-receipts` | `INCREMENTAL_RECEIPT_COVERAGE=PASS` / `PACKAGE_ID=RM1-U12` / `CHANGED=59` / `RECOVERED=21` | 0 |
| `compliance-control validate-package-exit …u12-package-exit.json` | **见下方 §1.1（会话副作用）** | 1（真仓）/ **0（干净基线）** |
| `compliance-control static-scan` | `REMEDIATION_COMPLIANCE=PASS` / `RULES=32` / `MODE=RM1_STATIC_ADMISSION` | 0 |
| `edge-codegen.mjs --check` | `R5_EDGE_CODEGEN_CHECK=PASS` / `FILES=218` | 0 |
| `capability-invariants check` | `CAPABILITY_INVARIANTS=PASS` / `MUTATING_OPERATIONS=78` / OTP 与 typed-problem 四项 PASS / `MAPPED=78:NOT_REACHABLE=0:UNMAPPED=0` | 0 |
| `capability-invariants self-test` | 7 条 RED 全 PASS（含 `RED_P3_C_TARGET_CAPABILITY`）+ `CLEANUP=PASS` | 0 |
| `compliance-control rm1-evidence-truth-self-test` | 4 条 RED 全 PASS（含 `RED_GENERATED_OUTPUT_DENOMINATOR_DRIFT`）+ `CLEANUP=PASS` | 0 |

### 1.1 `validate-package-exit` 在真仓为红——**是本次评审自身造成的，不是 P3 缺陷**

真仓实跑：

```
PACKAGE_EXIT=FAIL
REASON=PROBLEM_FAMILY_DISCOVERY_REQUIRED:c38822372e12
REAL_EXIT=1
```

`c38822372e12…` 经复核即**本次评审 prompt 自身**的 intake：
`.runtime/compliance-control/current-problem-intake.json` 的 `promptSha256` 与之相同，
`state = REQUIRES_PROBLEM_FAMILY_DISPOSITION`，对应 intake 文件写于 **21:23:10**（本会话）。
代码路径为 `tools/compliance-control/cli.mjs:1017-1023`
（`validateCurrentProblemFamilyDisposition` → `validateProblemIntakeDisposition` → 缺 disposition 即抛）。

**独立取得干净基线**：在 scratchpad 完整拷贝中仅移除该 intake 与 current 指针后复跑：

```
PACKAGE_EXIT=PASS
PACKAGE_ID=RM1-U12   CHANGED=58   SOURCE_DISPOSITION_ROWS=32
PROBLEM_INTAKES=2    PROBLEM_FAMILIES=2      REAL_EXIT=0
```

**结论：U12 的 package exit 在 current bytes 上真实通过**；真仓的红是评审动作本身引入的，
在 Codex 侧不会出现。**该项不计为 finding**，仅作出处披露。

---

## 2. M1 ｜生成输出分母 —— `CONFIRMED（已关闭）`

**owning source**
- `doc/evidence/platform/rm1/p3-c/rm1-u12-generated-output-continuity-recovery.json`
- `doc/evidence/platform/rm1/p3-c/rm1-u12-generated-output-terminal-replay.json`
- `doc/evidence/platform/rm1/p3-c/rm1-u12-package-exit.json`
- `tools/compliance-control/cli.mjs:13-14`、`:610-641`（`validateRM1U12GeneratedOutputContinuity` / `validateRM1U12GeneratedOutputDenominator`）

### 2.1 分母精确且两成员分工明确

`packageGeneratedOutputDenominator` 显式为**两条**：

```
apps/backend/catering-business-server/src/main/resources/generated/capability-operation-registry.json
apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts
```

`classificationPredicate` 原文亦写明「the backend registry is the historical-continuity member
and operations-edge.ts is the ordinary U12 terminal-replay member」。

### 2.2 registry 侧的历史连续性恢复 —— 逐字段独立复算

| 字段 | 声明 | 本会话复算 | 判定 |
| --- | --- | --- | --- |
| `output.lastRecordedSha256` | `09f8960999e840…` | hook-events 中 **RM1-U03** 的 `after`，且**无后继边** | OK |
| `predecessorReceiptEdges[0]` | `RM1-U03: 20037a51ffd704 → 09f8960999e840` | 与真实 post 事件**逐字段相同** | OK |
| `output.currentSha256` / `replayOutput.finalSha256` | `8e187cce9ba93e…` | 当前字节 `8e187cce9ba93e…` | OK |
| `generator.sha256` | `e44d71776aca8d69…` | `edge-codegen.mjs` 当前字节相同 | 无漂移 |
| `authoritativeInput.sha256` | `e7b865a24fdc2af0…` | `iam-org-governance-manifest.json` 当前字节相同 | 无漂移 |

上一轮的断链（`09f8960999e8 → 当前字节`无 receipt 边）现由该工件显式绑定并声明为
`DEXTER_AUTHORIZED_HISTORICAL_CONTINUITY_RECOVERY`，**不冒称为 U12 incremental receipt**。

### 2.3 operations-edge 侧的 hash set equality

```
replay.finalSha256 = 437e13a68e407cd2…
exit.afterSha256   = 437e13a68e407cd2…
当前字节            = 437e13a68e407cd2…     → 三者相等
```

### 2.4 checker 的强制形状（逐行读 `cli.mjs:610-641`）

```js
if (!outputs.has(terminalOutputPath) || !checks.has(terminalOutputPath))
    throw new Error("RM1_U12_GENERATED_OUTPUT_DENOMINATOR_MISSING_TERMINAL_OUTPUT");
if (checks.has(outputPath) || outputs.has(outputPath))
    throw new Error("RM1_U12_GENERATED_CONTINUITY_FALSE_INCREMENTAL_CLAIM");
validateRM1U12GeneratedOutputDenominator([...outputs.keys(), outputPath]);   // exactSet
```

四重约束同时成立：①terminal 成员**必须**同时在 `outputs` 与 `checks` 中；
②continuity 成员**不得**出现在二者中（禁止互相冒充）；③并集与常量分母做 `exactSet`；
④continuity 工件的全部 hash 由 checker **从磁盘重算**后比对，不采信自报。

### 2.5 红变异验证与其边界（**如实披露**）

`rm1-evidence-truth-self-test` 本会话 fresh 复跑 → `RED_GENERATED_OUTPUT_DENOMINATOR_DRIFT=PASS`；
其断言为 `validateRM1U12GeneratedOutputDenominator([denominator[0]])` 必抛 drift，
即**漏掉任一输出确实会红**。

**但本会话未能通过生产路径独立触发该语义红，原因如下**（非缺陷，属更强控制先行）：
本会话在 scratchpad 上做了 **6 组变异**——删分母成员、清空 terminal `outputs`、
把 registry 伪称 incremental、漂移 `currentSha256`、以及直接改 `cli.mjs` 的分母常量（两向）——
**全部为红**，但其中 5 组的 reason 是 `PACKAGE_EXIT_CHANGED_PATH_HASH_DRIFT`：
证据文件与 checker 自身的 changed-path hash 被 **receipt 链锚定**，
任何编辑都在语义控制之前先触发外层锚点。
（唯一非该原因者为伪称 incremental → `INCREMENTAL_CHECK_UNKNOWN`，方向正确。）

要绕过外层锚点必须伪造 hook receipt，本评审不做。
**故该条语义红的直接证明来源为 self-test；外层锚点的存在使其难以被绕过，本身是加强而非削弱。**
记为 N3 的核验边界披露。

---

## 3. M2 ｜HEAD_COMPANY capability —— `CONFIRMED（已关闭）`

**owning source**
- `libraries/backend/workspace-iam/…/api/WorkspaceCapabilityRequirementCatalog.java`
- `contracts/registry/iam-org-governance-manifest.json`
- `apps/backend/…/resources/generated/capability-operation-registry.json`
- 权威：`contracts/catalog/admin-catalog.json` 的 `userManagementActionBindings`

**8 条 requirement 现状（本会话解析）**：

```
REQ_CREATE_…_HEAD_COMPANY_INVITATION              BC-IAM-HEAD-COMPANY-INVITE
REQ_CANCEL_…_HEAD_COMPANY_INVITATION              BC-IAM-HEAD-COMPANY-INVITE
REQ_REISSUE_…_HEAD_COMPANY_INVITATION             BC-IAM-HEAD-COMPANY-INVITE
REQ_GET_…_HEAD_COMPANY_INVITATIONS                BC-IAM-HEAD-COMPANY-INVITE
REQ_GET_…_HEAD_COMPANY_INVITATION_CANDIDATES      BC-IAM-HEAD-COMPANY-INVITE
REQ_GET_…_HEAD_COMPANY_MEMBERSHIP                 BC-IAM-HEAD-COMPANY-ROLE-REVOKE
REQ_GET_…_HEAD_COMPANY_MEMBERSHIP_ACCOUNT         BC-IAM-HEAD-COMPANY-ROLE-REVOKE
REQ_REVOKE_…_HEAD_COMPANY_MEMBERSHIP_ASSIGNMENT   BC-IAM-HEAD-COMPANY-ROLE-REVOKE
```

与 `admin-catalog.json` 的权威 binding（`BC-IAM-HEAD-COMPANY-INVITE` /
`BC-IAM-HEAD-COMPANY-ROLE-REVOKE`）**逐字相同**。

**下划线变体清零核验**：

| 文件 | `BC-IAM-HEAD_COMPANY`（下划线） | `BC-IAM-HEAD-COMPANY`（连字符） |
| --- | --- | --- |
| `contracts/registry/iam-org-governance-manifest.json` | **0** | 8 |
| `capability-operation-registry.json`（生成物） | **0** | 8 |
| `WorkspaceCapabilityRequirementCatalog.java` | **0** | 8 |

全仓（含 `*.md`、`*.mjs`，排除 `node_modules`/`build`/`.git`）下划线仅剩 **1 处**：
`doc/evidence/platform/rm1/p3-c/rm1-p3-abc-round2-claude-problem-family-discovery.json:26`，
位于 `searchQueries[]` 数组内——是**发现该缺陷所用的检索词记录**，非活绑定，**正确保留**。
（另有若干处在本评审自己的 review 文档中，同属记录。）

`capability-invariants self-test` 的 `RED_P3_C_TARGET_CAPABILITY=PASS` 覆盖 target capability 红。

---

## 4. S1 ｜resolver 接线状态 —— `CONFIRMED（已关闭）`

**owning source**：`rm1-u12-package-exit.json` 的 `componentWiringStatus`；
`libraries/backend/workspace-iam/…/application/WorkspaceCapabilityScopeResolver.java`

exit 新增字段，原文：

```json
{"component": "WorkspaceCapabilityScopeResolver", "wired": false,
 "disposition": "DISCLOSED_NOT_WIRED",
 "reason": "P3 request paths enforce the target scope through WorkspaceMembershipService and owner commands.
            Attaching the resolver to reads would choose unapproved read-capability semantics;
            that separate decision remains N1."}
```

**三点逐一核实**：

1. **未伪称已接线** —— 全仓检索 `WorkspaceCapabilityScopeResolver` 仍只有 **2 个文件**
   （自身与其测试），`wired: false` 与事实一致。
2. **owner read/command 路径仍正确** —— 读路径
   （`OperationsWorkspaceMembershipController:53-54`）只做会话 + `contextVersion` +
   owner 侧 scope 收敛，不校验 capability，符合 R-22 第一层；
   写路径经 `requireUserManagementAction` → `requiredUserManagementCapabilityForTarget`
   使用权威能力集。
3. **未为关闭 finding 而错误接线** —— reason 明确把 read-capability 语义留为 N1 待决，
   这正是本评审上一轮的要求。

---

## 5. S2 ｜recovery 分类谓词 —— `CONFIRMED（已关闭）`

**owning source**：`rm1-u12-dexter-authorized-historical-receipt-recovery.json` 的 `classificationPredicate`

谓词已显式定义（原文）：

> `REPLAYED_RECEIPT_CHAIN_EXISTS` is true **only when same-package RM1-U12 pre/post receipt edges
> form a directed path from the package baseline SHA-256 to the current SHA-256**;
> `DEXTER_AUTHORIZED_HISTORICAL_RECOVERY` is true only when that same-package path is absent.
> **Cross-package receipt edges never classify RM1-U12 entries.**

**本会话按该谓词独立复算**（只取 `packageId == "RM1-U12"` 的 post 事件建图，做**传递可达**搜索）：

| 分类 | 条数 | 同包有向路径成立 | 判定 |
| --- | --- | --- | --- |
| `REPLAYED_RECEIPT_CHAIN_EXISTS` | 31 | **31 / 31** | 全部成立 |
| `DEXTER_AUTHORIZED_HISTORICAL_RECOVERY` | 20 | **0 / 20** | 全部无路径，符合定义 |

`currentSha256` 与当前字节 **0 不符**。

> **作者失误披露**：本会话初次复算时只测了**单条边**（`before==baseline && after==current`），
> 得到"replay 侧 14 条不成立"的中间结果。谓词原文为**有向路径**（可多跳），
> 按正确口径复算后 31/31 成立。该中间结果**未进入任何 finding**，此处记录以免后续会话重复误判。

---

## 6. 动态证据 —— 核验通过

`business = "PASS"`、`cleanup = "PASS"`，`dynamicEvidence[]` 三条逐条核实：

| suite | result | cleanup | log 文件 |
| --- | --- | --- | --- |
| `:libraries:backend:workspace-iam:test` | PASS | PASS | 存在 |
| `:libraries:backend:contract:test` | PASS | PASS | 存在 |
| `:libraries:backend:organization:test` | PASS | PASS | 存在 |

`WorkspaceCapabilityScopeResolverTest` 的 target 覆盖：
**`GROUP` / `REGION` / `PROJECT` / `HEAD_COMPANY` / `STORE` 五个全覆盖**（本会话解析确认）。
这也是 M2 那类拼写错误此后能被测试抓住的直接原因。

---

## 7. N（观察项，不阻塞）

**N1 ｜read-capability 语义仍显式待决（延续上轮，状态正确）**
16 条 `REQ_GET_*` 的 `capabilityKey` 仍绑写能力（`ROLE-REVOKE` / `INVITE`）。
**当前不构成缺陷**——读路径不消费 capability。
exit 的 `componentWiringStatus.reason` 已把该决定显式挂为 N1。
**在 resolver 接线之前需 Dexter 裁定**：新增 `BC-IAM-<TARGET>-VIEW` 只读能力，
或读 requirement 不带 capability。**接线之前不需处理。**

**N2 ｜legacy 二参重载仍在**
`WorkspaceMembershipService` 的 `resolveTaskScope(session, requestedScopeRef)`
内部仍以 `assignment.serviceNodeType()` 作 target，注释标为 legacy-only；
operations 端点均走三参版本。建议 P8 前删除或加静态断言禁止 edge 层调用。

**N3 ｜本评审的核验边界（出处披露）**
(a) `validate-package-exit` 在真仓为红系本评审 prompt 自身的 intake 所致（§1.1），
干净基线为 PASS；
(b) M1 的分母语义红仅由 self-test 直接证明——6 组 scratchpad 变异全部先被
receipt 锚定的 `PACKAGE_EXIT_CHANGED_PATH_HASH_DRIFT` 拦截，
本评审不伪造 hook receipt 以绕过它。**该边界不构成 finding**，
但 P8 若要复证该语义红，需在受控环境下连同 receipt 一并构造。

---

## 8. 处置

**M=0 / S=0 / N=3。** 无需 Dexter 产品裁决（N1 在 resolver 接线时才需要）。

**P3-A+B+C 可 GO。**

**本复核不授权**：进入下一 P、修改 Roadmap 状态、DEV、seed、reset、migration
或任何破坏性操作。下一 P 的启动需单独授权。
