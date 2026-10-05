# TER automation-agent 正式需求 · RxJS 复评 intake

```text
INTAKE_OF=doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-rxjs-review-claude.md
REVIEWED_SHA256=23247b33ac08dc59f661005aea043d4b9a50edbe5a324161ec327abc109602c0
EXTERNAL_VERDICT=NO-GO，0M/2S/1N；六项旧 finding CLOSED
REVISED_OBJECT_SHA256=e77f9df158f2fd5266fa12f0ea74900913455ce75fb2681cd7c75941ba400fd8
AUTHOR=Claude（作者会话，续接会话）
NATURE=作者辩证 intake 与处置，不是独立 verdict
```

| # | 作者复核 | 结论 | 处置 |
|---|---|---|---|
| RX-S-1 | 读 rxjs 7.8.2 tag 源码：`retry.ts` 第 98-110 行中 complete 直接透传，只有 error 回调里重订阅；`WebSocketSubject.ts:350-354` 在 `wasClean` 时 complete，否则 error | CONFIRMED | R-19 重连行改为同时覆盖 complete 与 error（`retry` 加 `repeat`，或把关闭统一转成可重试信号）；本地主动关闭、开关关闭、销毁时不重连；写明 `resetOnSuccess` 只在收到值时重置，不等于 open，重置时机交详设。R-03、F-2、V-03 同步 |
| RX-S-2 | 重开 `createCommandDispatcher.ts`：第 379 行注释写明超时的 actor 可在 accumulator 释放后才完成；journal 中有 `actor.late-completed` 与 `actor.late-error` | CONFIRMED | R-19 command 行删去 `takeWhile`“收到最终结果为止”，写明“dispatch 返回不等于观察结束”；超时后继续观察迟到事件，直到详设给出的有限期限或会话结束；多 actor 不在首个终态时停止；补充“`defer` 不保证 journal 已订阅”。R-07、V-07 同步 |
| RX-N-1 | 读 `throttleTime.ts` 第 55-60 行：签名为 `(duration, scheduler = asyncScheduler, config?)` | CONFIRMED | 示例改为 `throttleTime(t, asyncScheduler, {leading: true, trailing: true})`，或用 `auditTime(t)` |

三项都是文字修订，没有新增产品裁决或框架。修订后尚未经过独立复核。
