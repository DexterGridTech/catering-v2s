# TER automation-agent 正式需求 · RxJS 修复与 R-20 新增后的复核请求

## 背景

本轮交付单元是 TER automation-agent 正式需求的最新版，sha256 为 `2d2f1cef329c1df5fd1c454544079edbbe3acd6e2d2155db8d42703dfcef1d36`。

上一轮外部复评针对 `23247b33ac08dc59f661005aea043d4b9a50edbe5a324161ec327abc109602c0`，结论为 NO-GO，0M/2S/1N。复评确认六项旧 finding 已关闭，并对新增的 R-19（RxJS）提出三项：

- RX-S-1：正常关闭后不会自动重连，`retry` 只处理 error；
- RX-S-2：dispatch 返回即结束观察，会漏掉超时后的迟到完成或出错；
- RX-N-1：`throttleTime` 的配置放错了参数位置。

作者已对照 rxjs 7.8.2 tag 源码与仓内 runtime 源码复核这三项，三项全部成立并已修订，同步改动了 R-03、R-07、R-19、F-2、V-03、V-07。

之后按 Dexter 裁定（“根据你的推荐来写吧”），新增 R-20“其他第三方依赖”与 V-20：

- 必须采用：`@devicefarmer/adbkit`（driver）、`zod`（agent 与 driver，只用于协议消息）、`pixelmatch` 加 `pngjs`（driver，用于 F-4a）；
- 可选：`dequal`、`pino`、`execa`，由详设决定；
- 明确不用：Redux DevTools 远程、Reactotron、Flipper、superjson、JSON-RPC 库、nanoid 与 uuid、`@playwright/test` 作为旅途 runner、Detox、Maestro、Appium。

R-05、R-13、F-4a、§5、§6 同步引用。以上修订都尚未经过独立复核。作者会话是续接会话。

## 评审目标

请独立核验两件事：

- 这三项是否在源头真正关闭；
- 新增的 R-20 是否成立：每个库的位置、边界与“替代什么”是否准确，是否与 R-19、R-05、TER 的“vitest 单一 runner”裁定及其他规范冲突；
- 修订是否引入新的不一致，或与 rxjs 7.8.2 的实际语义、仓内 runtime 源码冲突。

## 需阅读文件

- `doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md`：被审对象，重点看 R-03、R-07、R-19 用法表、R-20、F-2、F-4a、V-03、V-07、V-20。
- `doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-rxjs-review-claude.md`：上一轮复评，三项 finding 原文。
- `doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-rxjs-review-intake-claude.md`：作者对三项的复核与处置。
- `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts`、`apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts`、`apps/terminal/kernel/base/runtime/src/types/journal.ts`：用于核验迟到事件。

## 独立核验重点

- **RX-S-1**（R-19 重连行、R-03 重连条款、F-2、V-03）：
  - 是否同时覆盖远端正常关闭（complete）与异常断开（error）的自动恢复；
  - 本地主动关闭、开关关闭与销毁时是否终止恢复；
  - 关于 `resetOnSuccess` 与 open 时机的表述是否符合 7.8.2 源码；
  - 用 `retry` 加 `repeat` 组合，或把关闭统一转成可重试信号，这两种思路是否成立。
- **RX-S-2**（R-19 command 行、R-07、V-07）：
  - “dispatch 返回不等于观察结束”是否写清；
  - 超时后对 `actor.late-completed` / `actor.late-error` 的继续观察，以及“详设给出的有限期限或会话结束”这一结束条件，是否与 runtime 源码一致；
  - 多 actor 场景是否覆盖；
  - “`defer` 不保证 journal 已订阅”的说明是否准确。
- **RX-N-1**（R-19 selector 行）：`throttleTime(t, asyncScheduler, {leading: true, trailing: true})` 是否是 7.8.2 的合法签名。
- **R-20 其他第三方依赖**：
  - 三个必须采用的库是否各自对应一段真实的手写负担，位置（agent 或 driver）是否合理；
  - zod “只用于协议消息、不用于 selector 参数形状”的边界是否清楚，进入生产包的体积代价是否写清；
  - adbkit 能否覆盖 `reverse`、`input -d`、`screencap -d`、`dumpsys display`，“不支持时用参数数组形式的 adb 子进程补齐”是否合理；
  - “明确不用”各条理由是否成立，尤其是 `@playwright/test` 与 vitest 单一 runner 的关系；
  - V-20 能否证明 R-20。
- **全文扫描**：是否残留 `takeWhile` 的“收到最终结果为止”、两参数形式的 `throttleTime`，或“只用 `retry` 即可重连”等旧表述。

已完成：三项修订与作者复核。

仍待处理：

- F-1、F-2、F-4a、F-4b 与 R-17 前提链为 UNVERIFIED；
- V-01～V-20 全部 NOT_RUN；
- rxjs、R-20 的各库与 driver 的 ws 依赖尚未安装或解析；
- 没有任何实现与运行。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`。已知阻断全部关闭、只剩 UNVERIFIED 时，按 `doc/platform/review-standard.md` 给出 `GO_WITH_UNVERIFIED_UI`。

findings 用 `M` / `S` / `N` 标注，每项写明：

- 精确的文件与行号；
- 影响面；
- 最小修复建议；
- 是否需要 Dexter 产品裁决。

另请给一张三项关闭情况表（CLOSED / PARTIALLY / OPEN）。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助复核 TER automation-agent 正式需求的最新版：其中修复了 RxJS 复评的三项问题，并新增了 R-20“其他第三方依赖”。

背景：上一轮外部复评针对 sha256 23247b33ac08dc59f661005aea043d4b9a50edbe5a324161ec327abc109602c0，结论为 NO-GO，0M/2S/1N。复评确认六项旧 finding 已关闭，并对新增的 R-19（RxJS）提出三项：RX-S-1 正常关闭后不会自动重连，retry 只处理 error；RX-S-2 dispatch 返回即结束观察，会漏掉超时后的迟到完成或出错；RX-N-1 throttleTime 的配置放错了参数位置。作者已对照 rxjs 7.8.2 tag 源码与仓内 runtime 源码复核，三项全部成立并已修订，同步改动了 R-03、R-07、R-19、F-2、V-03、V-07。之后按 Dexter 裁定新增 R-20“其他第三方依赖”与 V-20：必须采用 @devicefarmer/adbkit（driver）、zod（agent 与 driver，只用于协议消息）、pixelmatch 加 pngjs（driver，用于 F-4a）；可选 dequal、pino、execa；并列出明确不用的库。修复版 sha256 为 2d2f1cef329c1df5fd1c454544079edbbe3acd6e2d2155db8d42703dfcef1d36，尚未经过独立复核。作者会话是续接会话。
目标：请独立核验这三项是否在源头真正关闭、新增的 R-20 是否成立，以及修订是否引入新的不一致，或与 rxjs 7.8.2 的实际语义、仓内 runtime 源码冲突。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-10-05-ter-automation-agent-formal-requirements-claude.md：被审对象，重点看 R-03、R-07、R-19 用法表、R-20、F-2、F-4a、V-03、V-07、V-20；
- doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-rxjs-review-claude.md：上一轮复评，三项 finding 原文；
- doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-rxjs-review-intake-claude.md：作者对三项的复核与处置；
- apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts、apps/terminal/kernel/base/runtime/src/foundations/createCommandActorDispatcher.ts、apps/terminal/kernel/base/runtime/src/types/journal.ts：用于核验迟到事件。

请重点独立核验：
1. RX-S-1（R-19 重连行、R-03 重连条款、F-2、V-03）：是否同时覆盖远端正常关闭（complete）与异常断开（error）的自动恢复；本地主动关闭、开关关闭与销毁时是否终止恢复；关于 resetOnSuccess 与 open 时机的表述是否符合 7.8.2 源码；用 retry 加 repeat 组合或把关闭统一转成可重试信号，这两种思路是否成立。
2. RX-S-2（R-19 command 行、R-07、V-07）：是否写清“dispatch 返回不等于观察结束”；超时后继续观察 actor.late-completed / actor.late-error，以及“详设给出的有限期限或会话结束”这一结束条件，是否与 runtime 源码一致；多 actor 是否覆盖；“defer 不保证 journal 已订阅”的说明是否准确。
3. RX-N-1（R-19 selector 行）：throttleTime(t, asyncScheduler, {leading: true, trailing: true}) 是否是 7.8.2 的合法签名。
4. R-20：三个必须采用的库是否各自对应一段真实的手写负担、位置是否合理；zod“只用于协议消息、不用于 selector 参数形状”的边界与生产包体积代价；adbkit 能否覆盖 reverse、input -d、screencap -d、dumpsys display，不支持时用参数数组形式的 adb 子进程补齐是否合理；“明确不用”各条理由，尤其是 @playwright/test 与 TER“vitest 单一 runner”裁定的关系；V-20 能否证明 R-20。
5. 全文扫描：是否残留 takeWhile 的“收到最终结果为止”、两参数形式的 throttleTime，或“只用 retry 即可重连”等旧表述。
已完成：三项修订与作者复核。仍待处理：F-1、F-2、F-4a、F-4b 与 R-17 前提链为 UNVERIFIED，V-01～V-20 全部 NOT_RUN，rxjs、R-20 的各库与 driver 的 ws 依赖尚未安装或解析，没有任何实现与运行。

烦请给出明确 `GO` 或 `NO-GO`；已知阻断全部关闭、只剩 UNVERIFIED 时，请按 doc/platform/review-standard.md 给出 GO_WITH_UNVERIFIED_UI。如有问题，请按 `M` / `S` / `N` 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决；并附一张三项关闭情况表（CLOSED / PARTIALLY / OPEN）。

授权边界：本次 GO/NO-GO 只针对这份需求文档修复版的静态复核，不授权详设定稿、实施、规范修订、新增依赖、构建、DEV、设备或任何数据操作；评审期间只可在 doc/review/platform/ 下写一份文件名以 -claude 结尾的评审交付物，其余路径只读。谢谢。
```

交付前执行：

```bash
scripts/check/claude-review-handoff --file doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-rxjs-deps-recheck-request-claude.md
```
