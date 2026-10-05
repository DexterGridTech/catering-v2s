# TER automation-agent 正式需求 · 第三方依赖复评 intake

```text
INTAKE_OF=doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-third-party-review-claude.md
REVIEWED_SHA256=2d2f1cef329c1df5fd1c454544079edbbe3acd6e2d2155db8d42703dfcef1d36
EXTERNAL_VERDICT=GO_WITH_UNVERIFIED_UI，0M/0S/3N
REVISED_OBJECT_SHA256=37fe9363e79b6db3dbb68a36429d109cb8f7d586e465f701f86de4bf09507739
AUTHOR=Claude（作者会话，续接会话）
NATURE=作者 intake 与处置，不是独立 verdict
```

| # | 作者复核 | 处置 |
|---|---|---|
| N-1 | V-20 写的“agent 中只有 zod 这一项新增”，与 R-19 强制 agent 引入 rxjs、R-20 允许 agent 选用 dequal 两处冲突，成立 | V-20 改为：R-20 必选依赖中 agent 只引入 zod，adbkit、pixelmatch、pngjs 只在 driver；R-19 的 rxjs 与详设选用的可选依赖另计；按实际使用核对 |
| N-2 | 评审给出的 execa 5.1.1 官方源码表明，其 cleanup 只终止直接子进程，成立 | R-20 的 execa 行改为“子进程执行与终止辅助”，进程树回收能力按选定版本与配置核实，并复用 R-13 的受管身份与 cleanup |
| N-3 | §5 写“不做视觉比对”，与 F-4a 要求的像素比较冲突，成立 | §5 改为“不做通用视觉回归，F-4a 的开关静态页像素比较是唯一例外” |
| 方案合理性段的附带意见 | F-4b 的 bundle 增量应覆盖 agent 的全部依赖，不能只算 rxjs | F-4b 改为统计 automation-agent 及其全部依赖（rxjs、zod，以及详设选用的 agent 侧可选依赖） |

三项都是文字收敛，没有新增产品裁决。修订后没有新的独立 verdict。
