# TER 固定逻辑画布 CP-0 第 2 轮独立复查清单

REVIEW_CYCLE_ID=TER_LOGICAL_CANVAS_STRETCH_IMPLEMENTATION_20260908
REVIEW_TARGET=IMPLEMENTATION
REVIEW_SCOPE=CP-0
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReview=true
readOnly=true

## 输入

- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-design-codex.md`
- `doc/plans/platform/2026-09-08-v2s-terminal-android-web-preview-alignment-implementation-plan-codex.md`
- `doc/review/platform/2026-09-08-ter-logical-canvas-cp0-independent-review-checklist-codex.md`
- `doc/review/platform/2026-09-08-ter-logical-canvas-stretch-implementation-evidence-codex.md`
- `/tmp/ter-cp0-final-complete.log`
- `/tmp/ter-cp0-final-verified.log`
- `/tmp/ter-cp0-ime-window-before.txt`
- `/tmp/ter-cp0-ime-window-visible.raw.txt`
- `/tmp/ter-cp0-ime-window-after.raw.txt`
- `/tmp/ter-cp0-tap-primary.txt`
- `/tmp/ter-cp0-tap-secondary.txt`
- `/tmp/ter-cp0-screenrecord.out`

## 复查范围

只读证伪 CP-0 P-01 至 P-05，并重点核对上一轮两个 finding 是否闭合：

1. P-01 是否引用了包含 IME 初始隐藏、显示中、收起后三个状态的原始证据，且同一
   production app 的 primary Activity 与 secondary Presentation frame 可逐段核对。
2. P-03 是否引用了实际存在的文件；primary 与 secondary tap 是否有真实 shell trace，
   并能与新鲜 probe 进程的 `hitPressed` 日志按坐标和进程对应。
3. 不得把缺失的 secondary screenshot/screenrecord 能力写成 screenshot 成功；不得
   把旧 probe 的过程日志冒充 production frame 证据。
4. 检查临时 probe 是否已从 sample-terminal 源码删除，且恢复后的入口仍可 typecheck。

审查者不得修改文件、不得运行命令、不得进入 CP-1。结论只写 `CP-0=MATCHED` 或
`CP-0=OPEN`，并逐条报告阻断 finding。
