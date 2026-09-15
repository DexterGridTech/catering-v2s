# sample1 当前源码 release 冻结旅途

DATE=2026-09-15
RUNNER=`tools/terminal-sample2/run-sample1-frozen-journey.mjs`
EVIDENCE_TIER=release/android/cleanup

## 当前运行

| 形态 | evidence 目录 | business | cleanup | APK sha256 |
| --- | --- | --- | --- | --- |
| mobile | `sample1-frozen-current-source-mobile-normal-20260915/` | PASS | PASS | `e985891e238e72a7ff68af44e93b1b6d7629df375e6759a16c83a3b67d9f8c94` |
| dual | `sample1-frozen-current-source-dual-normal-20260915/` | PASS | PASS | `e985891e238e72a7ff68af44e93b1b6d7629df375e6759a16c83a3b67d9f8c94` |

两次均安装并回读了当前 `sample-terminal` release APK，`firstFailure=null`，
`lastKnownGood=S1-11`。dual 记录发现 logical display `0/2`、SurfaceFlinger primary/virtual
映射，并逐步保存 PRIMARY/SECONDARY 状态与截图；mobile 记录证明只有 PRIMARY。两种形态
均覆盖：匿名登录、错误凭据 notice、dismiss、正确登录、member-list、member-form、
customer-confirm、确认后冷重启、logout、匿名冷重启。

## 身份保护

错误登录步骤继续使用原 sample1 的 notice partKey、layerId、testID 和固定文案；本记录
没有同步改名或以成功文本替代 partKey/state。该摘要关闭当前 sample1 normal mobile/dual
记录式证据，不替代其他失败恢复、empty-age、Web、visual 或整体 implementation review。

## 历史边界

此前绑定旧 sha256 的 sample1 目录仍保留为历史记录；本摘要只引用两个新目录的当前
binding，避免把旧 APK 数字当作当前源码证据。
