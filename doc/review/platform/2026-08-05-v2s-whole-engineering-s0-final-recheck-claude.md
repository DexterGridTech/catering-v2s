---
title: WHOLE-ENGINEERING-S0-DESIGN-20260805 修订后 current-byte recheck（Claude）
reviewTarget: DESIGN
scope: S0 current-byte implementation-facing 详设与 baseline
verdict: GO
findings: M=0 / S=0 / N=1
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅复核 S0 current-byte 详设与 baseline；不授权源码、契约/schema、脚本行为、runtime、DEV、seed/reset、HTTP/L2、Roadmap 或后续单元实施
priorVerdicts:
  - Round-2 independent adversarial review：NO_GO（M3/S1/N1）—— 历史，未改写
  - Claude current-byte recheck #1：NO-GO（M=2/S=2/N=1）—— 历史，未改写
createdAt: 2026-08-05
---

# S0 修订后 current-byte recheck

## 0. 结论

**GO — `M=0 / S=0 / N=1`**，仅表示 **S0 设计审查收口**。

我上一份 recheck 的 **`M1`/`M2`/`S1`/`S2`/`N1` 五条全部真实闭合**，
且闭合方式是**补齐字节**而不是改写措辞 —— 我逐条复算验证，不采信任何自报值。

历史 verdict 未被改写：Round-2 的 `NO_GO`（M3/S1/N1）与我上一份 `NO-GO`（M2/S2/N1）
在当前字节中原样保留，hash 可复算一致。本轮不是第三轮独立审查。

## 1. 逐条闭合核验（全部为我自己的独立复算）

### M1 ｜P6-1 observability source map —— **CLOSED**

上一轮：baseline `S0-C` 只有 7 条 `sourcePaths`、**无 hash 字段**、8 类点名 source 缺失、
且含目录 `libraries/frontend/admin-ui-foundation`。

当前字节：`S0-C` 为 **16 条 exact file paths + 16 条 `sourceHashes`**，
我上一轮点名缺失的 8 类**全部补齐**：

```
PublicSecurityOperationRegistry.java   PlatformAuthenticationController.java
OperationsPasswordRecoveryController.java
PlatformSessionResolver.java           OperationsSessionResolver.java
EdgeSessionCookieWriter.java
PlatformAuthenticationService.java     WorkspaceAuthenticationService.java
```

另新增 `AdminErrorBoundary.tsx`（正是 `onError` 未接线的那个文件），
目录引用已替换为确切文件 `safeLogger.ts`。**baseline 四个 unit 中已无任何目录条目。**

### M2 ｜`implementationAuthority` —— **CLOSED**

```
design:6                              implementationAuthority: false   ✓
baseline:8                           "implementationAuthority": false  ✓
.runtime/…/active-package.json        implementationAuthority: False   ✓（packageId=REVIEW-20260805）
```

三处一致，与治理
`2026-07-26-…-binding-governance.md:45-46`「Dexter 接受前不得称设计 GO，更不产生 implementation authority」相符。
intake 还诚实披露了修订期间曾临时使用 `DESIGN_REMEDIATION` package 且其间保持 `false`，当前已恢复 `REVIEW_ONLY`。

### S1 ｜RP-00b 机械可判定性 —— **CLOSED**，三处全补

| 上一轮缺口 | 当前字节 |
| --- | --- |
| `executionClass` 值域不自洽（design 5 值 vs baseline 6 键） | design `:48` 现声明**两条互斥轴**：`classification`（5 值）与 `executionClass=VERIFY\|PACKAGE_ONLY\|CLOSED_PHASE\|REPORT\|NOT_RUN\|ALIAS`（**6 值含 ALIAS**），与 baseline 的 6 键谓词**逐键一致** |
| `aggregate` 谓词被引用却未定义 | baseline `aggregatePredicate` 定义为**派生布尔**：`aggregate=true iff executionClass=VERIFY ∧ classification=TRUE_GATE ∧ phaseApplicability=ELIGIBLE ∧ canonicalRef=self ∧ 恰有一个 verify 引用`；design `:52` 同义表述 |
| redProof 少于 design 自述 | baseline `redProofs` 现 **8 条**，我上一轮点名缺失的 `wrapper-path-missing`（登记路径不存在）与 `verify-reference-missing`（VERIFY 未被 verify 引用）**均已补入** |

### S2 ｜`detail-design/incremental criteria` —— **CLOSED**，且解法比我建议的更清楚

`§0.1` 表头现为 **8 列**，含独立的 `detail-design/incremental criteria` 列，四个 unit 各自填写
（如 S0-A 填「wrapper↔registry 字段、executionClass/aggregate 谓词、四类 red mutation、每个实际变更点的 Pre/Post receipt」）。

`§3 :80` 把我指出的 7-vs-6 矛盾解释清楚了：
**六类 package-exit source denominator** 与 **checker 必需的 `detailDesign` 字段**是**两个层次**，
并明写「后续 manifest 不得省略」。这比我原建议的"表补一列"更准确 —— 它区分了两个概念而不是把它们并列。

### N1 ｜`S0-B`/`S0-D` per-file hash —— **CLOSED**

四个 unit 现均为有限 exact `sourcePaths` + per-file `sourceHashes`，数量 **42 / 26 / 16 / 9**。

## 2. 我的独立复算（不采信任何自报值）

| 复算项 | 结果 |
| --- | --- |
| baseline 全部 `sourceHashes` | **93 条声明，93/93 与当前字节一致**；0 漂移、0 缺失、**0 目录条目** |
| `scriptCheckPathEnumeration` | 声明 `count=38` / `sortedPathSha256=ace401e9…`；我用其声明的命令实跑 → **count 38、hash `ace401e9267b7dd36cc5f5b3` 逐字一致** |
| S0-A 的 42 条构成 | 38 个 wrapper + 4 个确切文件（`scripts/verify`、`tools/verify-gates/verify.mjs`、standards execution catalog、治理 decision）—— **无泛称** |
| intake 声明的 4 个 hash | design / baseline / Round-2 adversarial / 我上一份 recheck —— **四条全部 MATCH** |
| 历史 artifact 完整性 | Round-2 `VERDICT=NO_GO / COUNTS=M3/S1/N1` 与我上一份 `verdict: NO-GO / M=2 / S=2 / N=1` **原样保留，未被改写** |

## 3. RP-12-pre 与 redProof 的互斥 —— **成立**

```
notApplicable  = [{"id":"unknown-service-node-enterable", …}]        ← 恰一条
redProofs      = 8 条，其中与 enterable / node 相关的：无            ← 互斥成立
```

design `:76` 的边界表述也未松动：仍明写「不得为了"看起来修复"把等价 `false` 改成 `throw`
或只新增重复测试；若未来要区分 typed failure/审计语义，必须另由 Dexter 先裁定」。

我在上一轮已独立验证过该 `NOT_APPLICABLE` 的调用链事实
（未知 `serviceNodeType` → `enterable()` 返回 `false` → 被 `availableAssignments` 过滤 → 无法成为 `selected`），
本轮复查该判断未被扩大或弱化。

## 4. N1（本轮唯一，非阻塞）｜四个非 `VERIFY` class 之间不可机械互斥

**位置**：`baseline.executionClassPredicate` 的 `PACKAGE_ONLY` / `CLOSED_PHASE` / `REPORT` / `NOT_RUN`

四者的谓词形状相同 —— 都是「无 `scripts/verify` 引用 + 非空 `<某种>` reason」，
区别只在 reason 的**种类**（source-bound / phase-state / report / disposition），
而"这是 phase 理由还是 disposition 理由"是**语义判断，不是机械判断**。

**为什么仍判 N 而非 S**：

- **载荷性的判别是 `VERIFY` vs 非 `VERIFY`，它唯一可机械判定**（verify 引用计数），
  而这正是 RP-00b 要预防的失效模式（"门存在却没接线"）的**唯一相关轴**；
- 把 `REPORT` 误标成 `PACKAGE_ONLY` **不会**产生该失效模式；
- 该谓词的用途是**校验已声明的 class 是否自洽**，不是**推导** class ——
  按这个读法，四者各自可验证，只是彼此不能交叉证伪。

**最小修订（可选）**：为四者各补一个可机械检查的判别位
（例如 `REPORT` 要求 `classification=REPORT`、`CLOSED_PHASE` 要求 `phaseApplicability=CLOSED`），
使 class 声明与既有字段交叉锁定。**不建议为此扩大 RP-00b 范围。**

**是否需要 Dexter 裁决**：否。

## 5. 我确认为正确、不应回退的部分

- baseline 的 93 条 per-file hash 与 `scriptCheckPathEnumeration` 的可复算枚举；
- `S0-C` 的 16 条 P6-1 exact source（RP-04/05/06 三个实现面的唯一 source 依据）；
- 三处 `implementationAuthority: false` 与 `PROPOSED_REVIEW_ONLY` 状态；
- `executionClass` 六值 / `classification` 五值 **两条互斥轴**的分离，与 `aggregate` 的派生定义；
- 8 条 `redProofs` 与 `notApplicable` 的互斥；
- `§0.1` 的八列表与 `§3` 对"六类 denominator vs `detailDesign` 字段"两个层次的区分；
- design `:48` 的「38 wrapper / 23 verify 单元 / 16 catalog ref **三者不能相加**」；
- design `:50` 的「`scripts/verify --validate-only` 仍会触发远程 Testcontainers、前端构建与 seed dry-run，
  不能标为静态轻量门」—— 这条是本设计相对我评审的实质增量；
- design `:72` 的「`673` 不得与 `477/320` 相减」「`SQL 4` 不得预填」；
- design `:84` 的「RP-02a 不等 D4」串行边界。

## 6. 处置与边界

- **`N1`** 为可选加固，Codex 可自主处置，不阻塞。
- **本 GO 只表示 S0 设计审查收口。** 它**不是**实施授权：
  - 不授权源码、契约/schema、脚本行为、runtime、DEV、seed/reset、HTTP/L2、Roadmap 变更；
  - S0 之后每个源码实施单元仍须**单独 implementation package、fresh implementation review 与 evidence closure**，
    不得借用本轮评审状态；
  - `D1`（RP-03 sink / retention / access / edge face）仍未裁决，RP-04/05/06 在其之前不得开工。
- 本轮**未改写**任何历史 verdict，**未创建**第三轮独立对抗审查。
