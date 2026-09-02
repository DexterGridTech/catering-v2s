# TER gate defect remediation unit A implementation review request

REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TER_GATE_DEFECT_REMEDIATION_UNIT_A_IMPLEMENTATION_2026_09_01
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
AUTHOR=Codex

## 背景

TER 全部门缺陷整改已按 Dexter 当前授权完成单元 A 的实施。范围只包含 D-8 迁移基础与 D-1、D-2、D-3、D-4；单元 B、D-5 及之后、workspace scoping、display-context、native、Gradle、设备、DEV、seed、reset、browser L2、UAT、部署均不在本次实现范围内。

请 Claude 以 IMPLEMENTATION review 身份重新打开当前源码与证据，不要采信本 brief 的结论。重点不是“是否按文档写了”，而是这些门现在是否真的防住了原缺陷，是否还有“判据全绿但缺陷原样存在”的路径。

## 输入材料

- 需求登记：`doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-registry-claude.md`
- 详设：`doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-design-codex.md`
- 实施计划：`doc/plans/platform/2026-09-01-v2s-terminal-gate-defect-remediation-implementation-plan-codex.md`
- 证据：`doc/evidence/platform/2026-09-01-v2s-terminal-gate-defect-remediation-unit-a-implementation-evidence-codex.md`
- 相关源码：`tools/terminal-skeleton/`、`tools/terminal-runtime/`、`tools/terminal-contracts/`、`tools/terminal-state/`、`tools/terminal-platform-ports/`、`tools/terminal-shared/`、`apps/terminal/skeleton-graph.ts`、`apps/terminal/kernel/base/*/terminal-invariants.json`
- 规范正本：`doc/platform/terminal-coding-standard.md`

## 本轮实施摘要

1. D-8：四个已收口 kernel 包的 public/checker expected set 迁移到 package-local `terminal-invariants.json`，工具只做“包内声明与当前源码一致”的机械核验。
2. D-1：`kernel.base.runtime` 从 skeleton `plannedKind` 转为真实 `moduleKind = 'owner'`，graph-model 不再把 kind 解析硬编码到 runtime。
3. D-2：runtime owner-kind checker 使用 TypeScript symbol origin 校验 `moduleKind`，接受 namespace/import alias 和中间 const，拒绝本地同文本 shadow。
4. D-3：TR-01 例外读取 package invariant，dispatch 权限限定到声明的 actor/owner 写入点；handler 外包装函数红。
5. D-4：test owner 从 package invariant 的 `owned` 派生，runner marker 必须与 package/kind 双向一致；删 runtime test script 或删 runtime test 目录均红。
6. D-22 连带修复：closed-union consumer row 加 `closedUnionConsumerCount`，D22 helper 通过 shared invariant reader 和 TypeScript symbol 解析核 9/22，并拒绝删行。

## 新鲜运行证据

`yarn workspace @catering-v2s/terminal verify` 已 PASS，关键输出：

```text
TERMINAL_STATIC=PASS
TERMINAL_TURBO_DRY_TYPECHECK=PASS packages=22 tasks=22 executable=22
TERMINAL_TURBO_DRY_TEST=PASS packages=22 tasks=22 executable=9
TERMINAL_TURBO_DRY_LINT=PASS packages=22 tasks=22 executable=0
TERMINAL_TURBO_DRY_CLEAN=PASS packages=22 tasks=22 executable=0
Tasks:    22 successful, 22 total
Tasks:    9 successful, 9 total
TERMINAL_TEST_MARKERS=PASS real=4 noTests=5
Android Bundled 1708ms apps/terminal/assembly/android/pos-desktop/index.ts (710 modules)
TERMINAL_VERIFY_CLEANUP=PASS
TERMINAL_VERIFY=PASS
```

Focused red vectors：

```text
A1_D1_PLANNED_KIND_RED=PASS target=owner-kind vector=context-exact-set=PASS,command-mount-shape=PASS,owner-kind=FAIL,restart-positive=PASS,ledger-record-shape=PASS,support=PASS
A1_D2_LOCAL_SHADOW_RED=PASS target=owner-kind vector=context-exact-set=PASS,command-mount-shape=PASS,owner-kind=FAIL,restart-positive=PASS,ledger-record-shape=PASS,support=PASS
A2_D3_HANDLER_SCOPE_RED=PASS target=tr01-reducer-boundary vector=graph-comparison=PASS,triple-naming=PASS,dependency-direction=PASS,dependency-declaration-completeness=PASS,tr01-reducer-boundary=FAIL,kernel-platform-independence=PASS,hygiene=PASS
A1_D22_MISSING_ROW_RED=PASS target=graph-comparison vector=graph-comparison=FAIL,triple-naming=PASS,dependency-direction=PASS,dependency-declaration-completeness=PASS,tr01-reducer-boundary=PASS,kernel-platform-independence=PASS,hygiene=PASS
A2_D4_DELETE_SCRIPT_RED=PASS owned task contract mismatch; @catering-v2s/kernel-base-runtime invariant owns test but package script is missing
A2_D4_DELETE_TEST_DIR_RED=PASS marker kind mismatch; package=@catering-v2s/kernel-base-runtime expected=REAL_TESTS actual=NO_TEST_FILES
```

## 请重点独立核验

1. D-8 的 package invariant 是否真的成为四个 kernel 包 public/checker expected set 的唯一机械事实来源；是否仍有中心表或硬编码数字会被合法变更打崩。
2. D-1/D-2 是否同时支持“有真实 slice 的 owner 包”与“未来第二个 owner 包”，且没有 runtime-only 硬编码。
3. D-3 的例外是否真的收窄到 onCommand/owner 写入点词法体内；请构造 alias、destructure、helper wrapper、globalThis/window 同名函数、element access 反例。
4. D-4 是否真的能防止测试 owner 从分母消失；请复核删 script、删 test 目录、假 marker、marker package mismatch、marker kind mismatch。
5. D-22 的 9 个 union / 22 个 consumer row 是否以 TypeScript symbol 绑定，不是 raw text；删 row、加虚构 row、把 row 类型改成 `string` 是否都红。
6. `verify.mjs` 是否只跑 TER-local scoped verify，没有调用仓级 `scripts/verify` normal。
7. 现有 evidence 是否把 Expo export 只表述为 Metro/JS 解析与打包证明，没有升级为 native、Gradle 或设备证明。

## 结论格式

请给出 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 写明：位置、仓内事实或推论、可证伪失败条件、最小修复，以及 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION` 分类。

请明确列出你实跑过的命令与退出码；若不运行命令，请把运行输出标为 `UNVERIFIED_REQUIRES_EVIDENCE`，不要用静态阅读替代动态证据。

## 授权边界

本 brief 只请求 IMPLEMENTATION review。它不授权 Claude 或任何 agent 修改源码、继续单元 B、开始下一个 owner 包、运行仓级 normal verify、做 native/Gradle/设备、DEV、seed、reset、browser L2、UAT、部署或数据操作。是否接受单元 A、是否授权下一步，由 Dexter 裁定。
