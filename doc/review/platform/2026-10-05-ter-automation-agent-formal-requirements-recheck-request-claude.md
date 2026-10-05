# TER automation-agent 正式需求 · 外部评审修复后复核请求

## 背景

本轮交付单元是 TER automation-agent 正式需求的修复版，sha256 为 `23247b33ac08dc59f661005aea043d4b9a50edbe5a324161ec327abc109602c0`。

上一轮外部 Claude 评审针对 `bc607783963ca82b46b8b7bd32f2625906948fa4bdb7fff002b7b85a5f2b9955`，结论为 NO-GO，0M/3S/3N，评审认定六项都是文字收敛。作者已逐条对照源码复核，六项全部采纳并修订：

- S-1：区分 `runtimeId` 与连接会话身份；
- S-2：区分首次动态运行前的静态对账与 CP 退出对账；
- S-3：详设与实施都排在 Codex 在途批次之后；
- N-1：command 跟踪须无空窗观察；
- N-2：Web 用 viewport CSS 像素，Android 用 display 物理像素；
- N-3：wss 证书方式改为非穷尽列举。

作者顺带同步了 V-03。之后按 Dexter 追加要求，新增 R-19“用 RxJS 实现流式能力”与 V-19，并在 R-03、R-06、R-07、R-13、R-18、F-4b、§5、§6 中引用。以上修订都尚未经过独立复核。作者会话是续接会话。

## 评审目标

请独立核验两件事：

- 上一轮六项 finding 是否在源头真正关闭；
- 新增的 R-19 是否成立：RxJS 的边界、版本与用法，是否与其他要求和规范冲突；
- 修订是否引入了新的不一致，或与仓内源码、规范冲突。

## 需阅读文件

- `doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md`：被审对象（修复版）。
- `doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-external-review-claude.md`：上一轮外部评审，六项 finding 的原文。
- `doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-external-review-intake-claude.md`：作者对六项的复核与处置。
- `doc/platform/implementation-task-template.md`：第 6 条 CP 退出对账、6c“对账前移”、“动态前整体准入”，用于核验 S-2。
- `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts`、`apps/terminal/kernel/base/runtime/src/foundations/createRuntimeJournal.ts`、`apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts`：用于核验 S-1、N-1。

## 独立核验重点

修订落点逐项如下：

- **S-1**：R-03 的“两种身份分开”与“重连”、R-11 运行信息表、F-2 判据、V-03。需要确认：
  - `runtimeId` 只在 App 重启与 JS reload 时改变；
  - 连接会话身份每次连接都变；
  - 断网恢复不重建业务 Runtime；
  - 四处说法一致。
- **S-2**：§3“进入条件”。需要确认：
  - 首次动态前的静态对账与 CP 退出对账是否与模板第 6 条、6c 一致；
  - F proof 失败在 CP 内修复、不提前给出 MATCHED 的写法是否可执行；
  - 与 §8 的“一次性顺序完成”和“F 闸不通过即停止”是否自洽。
- **S-3**：§7 D-1 与 §8 开始条件。需要确认：
  - 详设与实施都排在 Codex 批次之后；
  - 在此之前只做需求静态评审；
  - §0.2 原话“不并行，等codex做完”是否被准确落实。
- **N-1**：R-07“无空窗的观察”。需要确认：
  - “先订阅再分发，或可证明无空窗的快照加订阅组合”是否足以覆盖同步发出的 `command.started`、同步拒绝与快速完成；
  - 与“journal 属运行时元数据”“selector 须经按名求值”是否冲突。
- **N-2**：R-09 输出契约与 F-1。需要确认：
  - Web 的 viewport CSS 像素与 Android 的物理像素表述是否清楚；
  - 非零滚动的情形是否纳入。
- **N-3**：§6 wss 证书方式是否已改为非穷尽列举，并与 R-04、U-3 一致。

- **R-19 RxJS**：
  - rxjs 7.8.2 的选择与“只在 agent 和 driver 内部、不进公开 API”的边界是否清楚；
  - 简化对照表中每个用法是否对应真实 API 与正确语义，例如 `throttleTime` 默认 `trailing: false`，`webSocket` 默认使用全局 `WebSocket`；
  - 新增依赖进入所有生产包的代价是否写清；
  - driver 侧 WS 服务端复用 `ws` 是否合理；
  - 与 TR-11、TR-03、R-12 是否冲突。

此外请扫描全文，看是否残留“新的 runtime 身份”、只写“实施在 Codex 之后”、“二选一证书”等旧表述，或因修订产生的新矛盾。

已完成：六项修订与作者复核。

仍待处理：

- F-1、F-2、F-4a、F-4b 与 R-17 前提链为 UNVERIFIED；
- V-01～V-19 全部 NOT_RUN；
- 没有任何实现与运行。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`。已知阻断全部关闭、只剩 UNVERIFIED 时，按 `doc/platform/review-standard.md` 给出 `GO_WITH_UNVERIFIED_UI`。

findings 用 `M` / `S` / `N` 标注，每项写明：

- 精确的文件与行号；
- 影响面；
- 最小修复建议；
- 是否需要 Dexter 产品裁决。

另请给一张六项关闭情况表（CLOSED / PARTIALLY / OPEN）。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助复核 TER automation-agent 正式需求的修复版。

背景：上一轮外部 Claude 评审针对 sha256 bc607783963ca82b46b8b7bd32f2625906948fa4bdb7fff002b7b85a5f2b9955，结论为 NO-GO，0M/3S/3N，六项都被认定为文字收敛。作者已逐条对照源码复核并全部修订：S-1 区分 runtimeId 与连接会话身份；S-2 区分首次动态运行前的静态对账与 CP 退出对账；S-3 详设与实施都排在 Codex 在途批次之后；N-1 command 跟踪须无空窗观察；N-2 Web 用 viewport CSS 像素、Android 用 display 物理像素；N-3 wss 证书方式改为非穷尽列举。作者顺带同步了 V-03。之后按 Dexter 追加要求新增了 R-19“用 RxJS 实现流式能力”与 V-19，并在相关条款中引用。修复版 sha256 为 23247b33ac08dc59f661005aea043d4b9a50edbe5a324161ec327abc109602c0，尚未经过独立复核。作者会话是续接会话。
目标：请独立核验上一轮六项 finding 是否在源头真正关闭，新增的 R-19 是否成立，以及修订是否引入新的不一致，或与仓内源码、规范冲突。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md：被审对象（修复版）；
- doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-external-review-claude.md：上一轮外部评审，六项 finding 原文；
- doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-external-review-intake-claude.md：作者对六项的复核与处置；
- doc/platform/implementation-task-template.md：第 6 条 CP 退出对账、6c“对账前移”、“动态前整体准入”，用于核验 S-2；
- apps/terminal/kernel/base/runtime/src/application/createRuntime.ts、apps/terminal/kernel/base/runtime/src/foundations/createRuntimeJournal.ts、apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts：用于核验 S-1、N-1。

请重点独立核验：
1. S-1：R-03 的“两种身份分开”与“重连”、R-11 运行信息表、F-2、V-03 四处说法是否一致；runtimeId 只在重启与 reload 时改变，连接会话身份每次连接都变，断网恢复不重建业务 Runtime。
2. S-2：§3“进入条件”的两道关是否与模板第 6 条、6c 一致；F proof 失败在 CP 内修复、不提前给出 MATCHED 是否可执行；与 §8 的“一次性顺序完成”和“F 闸不通过即停止”是否自洽。
3. S-3：§7 D-1 与 §8 开始条件是否已写明详设与实施都排在 Codex 批次之后、之前只做需求静态评审，是否准确落实了 §0.2 原话“不并行，等codex做完”。
4. N-1：R-07 的“无空窗观察”是否足以覆盖同步发出的 command.started、同步拒绝与快速完成，与 journal 元数据例外、selector 按名求值是否冲突。
5. N-2：R-09 输出契约与 F-1 中 Web 与 Android 的坐标系是否清楚，非零滚动是否纳入。
6. N-3：§6 的 wss 证书方式是否已改为非穷尽列举，并与 R-04、U-3 一致。
7. R-19：rxjs 7.8.2 的选择与“只在 agent 和 driver 内部、不进公开 API”的边界；简化对照表中各用法的 API 与语义是否正确（例如 throttleTime 默认 trailing: false，webSocket 默认用全局 WebSocket）；新增依赖进入所有生产包的代价；driver 侧 WS 服务端复用 ws 是否合理；与 TR-11、TR-03、R-12 是否冲突。
8. 全文扫描：是否残留“新的 runtime 身份”、只写“实施在 Codex 之后”、“二选一证书”等旧表述，或因修订产生的新矛盾。
已完成：六项修订与作者复核。仍待处理：F-1、F-2、F-4a、F-4b 与 R-17 前提链为 UNVERIFIED，V-01～V-19 全部 NOT_RUN，没有任何实现与运行。

烦请给出明确 `GO` 或 `NO-GO`；已知阻断全部关闭、只剩 UNVERIFIED 时，请按 doc/platform/review-standard.md 给出 GO_WITH_UNVERIFIED_UI。如有问题，请按 `M` / `S` / `N` 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决；并附一张六项关闭情况表（CLOSED / PARTIALLY / OPEN）。

授权边界：本次 GO/NO-GO 只针对这份需求文档修复版的静态复核，不授权详设定稿、实施、规范修订、新增依赖、构建、DEV、设备或任何数据操作；评审期间只可在 doc/review/platform/ 下写一份文件名以 -claude 结尾的评审交付物，其余路径只读。谢谢。
```

交付前执行：

```bash
scripts/check/claude-review-handoff --file doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-recheck-request-claude.md
```
