# TER UI 业务可读性 CP-1 implementation review

REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-1 feature scope
REVIEW_ROUND=1
reviewerKind=INDEPENDENT_SUBAGENT
DATE=2026-09-23

## 输入

- `doc/plans/platform/2026-09-22-ter-ui-business-readability-requirements-codex.md`
- `doc/plans/platform/2026-09-22-ter-ui-business-readability-ia-reconciliation-codex.md`
- `doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-design-codex.md`
- `doc/plans/platform/2026-09-22-ter-ui-business-readability-implementation-plan-codex.md`
- CP-0 baseline 与 CP-1 evidence
- 项目 memory 的 deterministic-context、frontend coding standard、UI foundation 与 implementation governance 原文
- 三包当前源码、parts、public entry、focused tests

## 独立审查结果

### Popper（code-reviewer）

- 三包 feature-only CP-1：`GO`。
- 14 个 logical part 展开为 member 18、staff 6、wallpaper 4 个 sibling renderer。
- 三包 feature 范围内的旧 wrapper、旧 suffix renderer、聚合 hook、`ComponentType<any>`、`createPart/createFormPart` 与默认 laptop alias 均未命中。
- customer-member 可选年龄与原 interaction design、IA 修订和当前 hook/测试一致。
- 初始 finding：详设 CP-1 将 integration `WaitingLaptop/WelcomeLaptop` old basename 写进 gate，而计划安排在 CP-4。

### Lovelace（verifier）

- 三包 feature-only CP-1：`GO`，`M/S/N=0/0/2`。
- 确认 staff login 的 `containerKeys=['main']` 与 workspace `['MAIN']` 是两个不同的既有语义，当前实现未混淆。
- public entry/invariant 无歧义；member/staff 没有 wallpaper 那样的 exact-set public export test 是 note，不构成当前 gate blocker。

### Hume（scope verifier，finding 修复后 fresh 复核）

- 详设与计划已同口径：feature wrapper/suffix/aggregate hook/alias 属于 CP-1；integration old basename 与 `WaitingLaptop/WelcomeLaptop` 属于 CP-4/CP-5。
- `WaitingLaptop/WelcomeLaptop` 当前仍存在，状态为 `OPEN_FOR_CP4`，不被 CP-1 feature gate 隐藏。
- customer-member age、typed part pair、三包目录和负向扫描继续 `MATCHED`。

## 处置

- 已修正 implementation design CP-1 gate 的范围文字，明确 integration old basename 不提前计入 CP-1。
- 未提前修改 integration，也未把残留写成“可用但未测试”；CP-4 必须完成 rename 与重复机制下沉后再关闭。
- 已重跑 focused proof：base render 13 files/85 tests、member 28/28、staff 9/9、wallpaper 16/16；四包 typecheck PASS。

## Verdict

`CP1_FEATURE_GATE=GO`

`M/S/N=0/0/0`（仅按 CP-1 feature scope）；
`OUT_OF_SCOPE_OPEN=OPEN_FOR_CP4: sample-wallpaper-console WaitingLaptop/WelcomeLaptop`。

本记录不宣称全批 implementation GO，不替代 CP-2 至 CP-5、全批对账、四类虚拟机动态验证或 cleanup 证据。
