---
title: RM1 P5 整改后独立复核（Claude，S1 + P-R6）
reviewTarget: IMPLEMENTATION
scope: RM1-P5 current bytes（S1 闭合 + P-R6 直证）
verdict: GO
findings: M=0 / S=0 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅复审 P5 当前字节；不授权 P6/P3-D、新 Journey/UI、后端/契约/数据、DEV、seed、reset 或动态环境
createdAt: 2026-07-29
---

# RM1 P5 整改后独立复核（S1 + P-R6）

## 0. 结论

**GO**，`M=0 / S=0 / N=3`。

上轮 S1 **真实关闭**，且不是"改 8 个字符"——同时补了**有限模型的机械控制**，
本会话独立复现的三条红全部具名命中。上轮 N2（P-R6 未验证）也已由源码直证。

| 上轮 finding | 关闭情况 |
| --- | --- |
| **S1** 8 处 `loading={!candidates}` 失败后永久转圈 | **已闭合**：8/8 改为 `loading={!candidates && !problem}`，裸形态全仓归零，并新增控制防复发 |
| **N2** P-R6「登出失败仍清本地会话」未验证 | **已直证**：两个 app root 均为 `try { await remoteLogout } finally { clearLocalSession() }`，并各配一条红 |
| **N1** `RefreshSignal` 无订阅者 | **已如实登记**为 `NOT_APPLICABLE_WITH_REASON` / `NOT_A_P5_FUNCTIONAL_DEFECT`，未借机扩大范围删除——处置得当 |

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）；
变异在 scratchpad 完整拷贝上做，用后即弃。未开新的子审查轮次。

**授权边界**：仅复审 P5 当前字节。不授权 P6/P3-D、新 Journey/UI、后端/契约/数据、
DEV、seed、reset 或动态环境。

---

## 1. S1 闭合核验 —— `CONFIRMED`

### 1.1 修改本身

**owning source**：
`apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx:141,144,147,150,200`；
`.../contract-management/ui/ContractManagementPage.tsx:170,178,237`

**全量同根扫描**（`apps/frontend/*/src`，全部 `*.tsx`，排除 `node_modules`）：

```
裸 loading={!candidates}                : 0        （上轮为 8）
loading={!candidates && !problem}       : 8        （5 + 3，行号与上轮点名一致）
其余任何 loading={!<identifier>} 形态    : 0        （全仓无遗漏同类）
```

**语义复核（不止看字符）**：失败路径 `.catch(… setProblem(issue(error)))` 置 `problem`，
`loading` 表达式因 `!problem` 为 false 而停止转圈，同时 `:131` 的
`{problem && <Alert type="error" …/>}` 显示错误横幅——**用户看到"失败"而非"仍在加载"**。
重试路径 `:69`/`:85` 先 `setProblem(undefined)`，故 loading 可正确恢复。
`candidatesGeneration.isCurrent` 的 generation guard 保持不变。

### 1.2 新增控制是**有限模型**，非一刀切禁令

`tools/verify-gates/cli.mjs:62-70`：

```js
const candidateState = source.match(new RegExp(`const\\s+\\[\\s*${candidate}\\s*,\\s*(set[A-Za-z0-9_]+)\\s*\\]\\s*=\\s*useState`));
const problemState   = source.match(/const\s+\[\s*problem\s*,\s*(set[A-Za-z0-9_]+)\s*\]\s*=\s*useState/);
if (!candidateState || !problemState) continue;                       // 两个 state 都在才管
const hasReset        = new RegExp(`${candidateSetter}\\(undefined\\)`).test(source);      // 请求前清空
const catchSetsProblem = new RegExp(`\\.catch\\([\\s\\S]{0,800}${problemSetter}\\(`).test(source);  // 失败写 problem
if (hasReset && catchSetsProblem) fail("R5_FRONTEND_CANDIDATE_LOADING_FAILURE_STATE_MISSING", …);
```

**四个前置条件同时成立**才判红——candidate state、problem state、请求前清空、catch 写 problem。
这正是"该页面确实具备失败态、却未用于 loading"的精确形状，
不会误伤没有 problem 概念的组件。与来件描述一致。

### 1.3 三条红——本会话独立复现（不采信 self-test）

在 scratchpad 完整拷贝上逐条变异：

| 变异 | REASON | EXIT |
| --- | --- | --- |
| `StoreManagementPage:141` 改回裸 `loading={!candidates}` | `R5_FRONTEND_CANDIDATE_LOADING_FAILURE_STATE_MISSING:…/StoreManagementPage.tsx` | 1 |
| 移除 `PlatformApp` 的 `finally { clearLocalSession(); }` | `R5_FRONTEND_LOGOUT_LOCAL_CLEAR_MISSING:…/PlatformApp.tsx` | 1 |
| 移除 `OperationsApp` 的 `finally { clearLocalSession(); }` | `R5_FRONTEND_LOGOUT_LOCAL_CLEAR_MISSING:…/OperationsApp.tsx` | 1 |

三条均**具名**红，还原后回到 `R5_FRONTEND_ARCHITECTURE=PASS`。
门的 `--self-test` 亦输出来件声称的三个标记：
`R5_FRONTEND_CANDIDATE_LOADING_FAILURE_STATE_RED=PASS`、
`R5_FRONTEND_PLATFORM_LOGOUT_LOCAL_CLEAR_RED=PASS`、
`R5_FRONTEND_OPERATIONS_LOGOUT_LOCAL_CLEAR_RED=PASS`。

---

## 2. P-R6 直证 —— `CONFIRMED`

**owning source**：`apps/frontend/operations-admin/src/app/OperationsApp.tsx:109-120`；
`apps/frontend/platform-admin/src/app/PlatformApp.tsx:41-43,64-68`

```tsx
// OperationsApp.tsx:109-120
const logout = async () => {
  if (!session) return;
  lifecycle.markBusinessIntentChanged();
  try {
    await operationsClient.operationsWorkspaceLogout({groupWorkspaceKey: session.groupWorkspaceKey},
      {headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
  } finally {
    clearLocalSession();          // ← 远端失败仍清本地
  }
};

// PlatformApp.tsx:64-68（同形）
try { await platformClient.platformLogout({}, {headers: {…}}); } finally { clearLocalSession(); }
```

`clearLocalSession` 定义于 `PlatformApp.tsx:41-43`（含 `setSession(undefined)`）。
**上轮我标 `UNVERIFIED` 的这一支，现已由源码直证，并各配一条红变异。**

---

## 3. 机械证据复核 —— 全部一致

| 项 | 结果 |
| --- | --- |
| `actualChangedPaths` / `incrementalChecks` | **61 / 61，exact-set `True`** |
| `incrementalChecks[].afterSha256` 与当前字节 | **0 不符** |
| `sourceComplianceDisposition` 绑定 hash | 复算一致；**rows = 28** |
| focused evidence `currentSourceHashes` | **12 条逐条复算，0 不符**（上轮为 7 条，本轮扩展） |
| focused evidence `execution` | **11 条全 PASS**（foundation/platform/operations 测试、typecheck、eslint `--max-warnings=0`、frontend-architecture 及其 self-test、foundation-standard-actions、edge-codegen check 与 self-test、standards-coverage R5） |

**本会话独立实跑**：`frontend-architecture` PASS、其 `--self-test` PASS、
`foundation-standard-actions` PASS、`edge-codegen --check` PASS、
`standards-coverage --phase R5` PASS。

---

## 4. N1 的处置得当（记录为优点）

`rm1-u08-claude-s1-problem-family.json:59,82` 与 post-remediation intake 均如实记载：

> RefreshSignal has publish sites but no production subscriber. RTK tags are the current write-refresh authority.
> `preventionDestination: NOT_APPLICABLE_WITH_REASON` / `NOT_A_P5_FUNCTIONAL_DEFECT`

**未借闭合 S1 之机顺手删除 foundation 的 `createRefreshSignal`/`useRefreshVersion`**——
这符合"不扩大范围"的纪律。dormant publish 不改变用户行为，登记后留给后续包处置是正确取舍。

---

## 5. N（观察项，不阻塞）

**N1 ｜新控制的行号输出恒为 `:1`**

`tools/verify-gates/cli.mjs:70`：

```js
fail("…_MISSING", `${file}:${source.slice(0, match.index).split("\\n").length}`);
```

模板串中的 `"\\n"` 求值为**字面反斜杠 + n**（两字符），而非换行符；
TSX 源码中几乎不含该序列，故 `.length` 恒为 1。
本会话变异位于第 141 行，报告为 `…StoreManagementPage.tsx:1`。

**不影响检出**（红仍精确命中文件与规则），仅影响可诊断性。
修法：`split("\n")`（单反斜杠）。

**N2 ｜控制只覆盖 `.catch()` 形态的失败写入**

`catchSetsProblem` 用 `\\.catch\\([\\s\\S]{0,800}${problemSetter}\\(` 匹配。
若将来某页面改用 `try { … } catch (e) { setProblem(…) }`（同步 try/catch）
或 catch 体超过 800 字符，前置条件不成立，该页面即使裸写 `loading={!candidate}` 也不会红。
当前 2 个文件均为 `.catch()` 形态，**不构成现存缺口**；
建议在下次触及该门时把同步 `catch` 分支一并纳入。

**N3 ｜本会话未重跑前端测试**

`yarn` 工作区未在本会话执行。11 条 `execution` 记录以其
12 条 `currentSourceHashes` 逐条复算一致为依据，标 `VERIFIED_BY_ARTIFACT_NOT_BY_RERUN`。
但本轮结论的**决定性部分**——8 处修改、logout `try/finally`、三条红变异、
门的有限模型实现、61/61 与 28 行分母——**均为本会话静态可判或已实跑**，不依赖该记录。

---

## 6. 处置

**M=0 / S=0 / N=3。** 无需 Dexter 产品裁决。**RM1 P5 可 GO。**

**本复核不授权**：P6/P3-D、新 Journey/UI、后端/契约/数据变更、DEV、seed、reset、动态环境。
