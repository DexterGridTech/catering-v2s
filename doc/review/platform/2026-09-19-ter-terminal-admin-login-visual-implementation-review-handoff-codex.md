# TER terminal admin login 主题化视觉 implementation review 交接

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_STATUS=READY_FOR_CLAUDE_REVIEW
DESIGN_REVIEW=GO_0M_1S_1N
IMPLEMENTATION_AUTHORITY=DEXTER_GRANTED_2026-09-19
IMPLEMENTATION_STATUS=CODE_AND_FOCUSED_EXECUTION_COMPLETE_REVIEW_PENDING
CODE_DESIGN_RECONCILIATION=MATCHED_BY_MAIN_AGENT
INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN
WEB=OPEN_NOT_RUN
ANDROID=OPEN_NOT_RUN
DEVICE=OPEN_NOT_RUN
VISUAL_ACCEPTANCE=OPEN
```

## 背景

TER terminal admin login 主题化视觉的 DESIGN review 第二轮为 `GO, M/S/N=0/1/1`。唯一的 S-1
要求在 CP-1 前明确 elevated card 的接入方式；已采用最小方案：`PrimitiveContainer` 增加可选
`elevated` prop，只有 `AdminLogin` 显式传入，默认 `layout="card"` recipe 不变。

Dexter 已授权按详设与计划进入 implementation。本轮已完成源码、测试与静态验证，现交 Dexter 与 Claude
做 implementation review。这里的实现完成表示代码与已授权 focused/static 执行已完成，不表示
implementation acceptance、visual、Web、Android、release 或整体验收通过。

## 评审目标

请独立核验：

1. `PrimitivePinInput` 是否真的是无状态、无业务词汇的通用 primitive，是否保留六格、方形、`*`、focus/error/disabled、testID 与真实 Pressable。
2. `AdminLogin` 是否仍是唯一 password/focus/auth owner，并且 native `onTouchEnd` 与 browser `onClick` 两条 surface-dismiss 守卫都由 owner 传入；删除任一入口应能暴露交互回归。
3. elevated 是否只作用于登录卡；其余七个 `layout="card"` production consumer 是否保持默认 card 输出，不存在就地升级默认 recipe 的静默范围扩大。
4. 两个 integration 是否各自拥有 `surface-elevated`、`surface-inset`、`focus` 的 CSS var 与 Tailwind mapping，并且 theme 之间没有被复制成同一个固定青色。
5. 既有动态口令、错误/时钟/身份 fallback、debug password、关闭恢复、keyboard placement、testID 与业务背景是否保持不变，是否出现 scope drift。
6. 下列证据是否诚实分档：focused/typecheck/static 已执行；visual focus 可读性、Web、Metro、Android、device、release 未执行，不能从 focused/static 推导 PASS。

## 需阅读文件

- `doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-ia-design-codex.md`：主题化登录 IA 与包边界；
- `doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-implementation-design-codex.md`：实现详设、S-1 处置、判据与不做项；
- `doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-implementation-plan-codex.md`：CP-0 至 CP-4 顺序和文件对账；
- `doc/review/platform/2026-09-19-ter-terminal-admin-login-visual-design-review-claude.md`：上一轮 M-1/N-1/N-2 的原始 finding；
- `doc/review/platform/2026-09-19-ter-terminal-admin-login-visual-design-review-round2-claude.md`：本轮 GO、S-1 与独立审查状态；
- `doc/review/platform/2026-09-19-ter-terminal-admin-login-visual-implementation-evidence-codex.md`：实际改动、命令结果、判据和档位；
- `apps/terminal/ui/base/primitives/src/components/PrimitiveContainer.tsx`：默认/elevated card recipe；
- `apps/terminal/ui/base/primitives/src/components/PrimitivePinInput.tsx`：六格 primitive 与事件透传；
- `apps/terminal/ui/base/primitives/src/types/types.ts`、`apps/terminal/ui/base/primitives/src/index.ts`、`apps/terminal/ui/base/primitives/terminal-invariants.json`：公共面；
- `apps/terminal/ui/base/primitives/src/theme/tokens.ts`、`apps/terminal/ui/base/primitives/test/primitives.test.tsx`：语义 recipe 与 focused proof；
- `apps/terminal/ui/base/admin-shell/src/components/AdminLogin.tsx`、`apps/terminal/ui/base/admin-shell/test/adminLayout.test.ts`：登录 owner、elevated 与双事件守卫；
- `apps/terminal/ui/integration/sample-console/theme/global.css`、`apps/terminal/ui/integration/sample-console/tailwind.config.cjs`、`apps/terminal/ui/integration/sample-console/test/theme.test.ts`：sample-console 主题；
- `apps/terminal/ui/integration/sample-wallpaper-console/theme/global.css`、`apps/terminal/ui/integration/sample-wallpaper-console/tailwind.config.cjs`、`apps/terminal/ui/integration/sample-wallpaper-console/test/theme.test.ts`：sample-wallpaper-console 主题；
- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`：真实 assembly 登录行为与 `*` 断言；
- `doc/platform/terminal-coding-standard.md`、`project-memory/index.md`：终端规范与共享 admin-console owner 约束。

## 独立核验重点

请从仓库根执行或复核：

- `yarn --cwd apps/terminal/ui/base/primitives typecheck` 与 `test`；
- `yarn --cwd apps/terminal/ui/base/admin-shell typecheck` 与 `test`；
- 两个 integration 的 `typecheck` 与 `test`；
- `yarn --cwd apps/terminal verify:static`；
- 以 source/readback 复核全量 production `layout="card"` 分母：只有 AdminLogin 带 `elevated`，其他七处不带；
- 用 red mutation 把 elevated 施加到默认 card、删除 native `onTouchEnd`、删除 browser `onClick`、把两个 integration focus token 改成同一个固定青色，确认对应 focused/static proof 会变红；
- 如果要判断 PIN 点击后的真实 field/keyboard 保持聚焦，请在 Web/Android/device 证据中验证；本轮 focused render test 不得冒充真实冒泡证据；
- 不要把 user-approved visual direction 当成 visual acceptance，不要把 `INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN` 改成已完成。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`、`S`、`N` 数量。每条 finding 请给出仓库相对路径、精确行号、源码事实/推论/尚缺证据的区分、影响面、最小修复建议及是否需要 Dexter 裁决。请分别标明 static、focused、Web、Android、device、visual、release、cleanup 档位；未执行档位保持 `OPEN`，不要用测试名、退出码或结构断言替代用户可见结论。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 TER terminal admin login 主题化视觉 implementation 做独立 review。

背景：本批 DESIGN review 第二轮为 GO，M/S/N=0/1/1。唯一的 S-1 已按最小方案关闭：PrimitiveContainer 新增可选 elevated prop，只有 AdminLogin 显式传入，默认 card recipe 不变。Dexter 已授权实现；源码、focused/typecheck 与 terminal static 已执行，现交你做 implementation review。

目标：请独立核验已实现的 admin login 主题化视觉代码、包边界、surface-dismiss 事件守卫、elevated card 隔离、主题 token 与证据分档。

请从 catering-v2s 仓库根阅读下列详设、计划、证据、源码与规范文件，并以当前源码为准：

请重点独立核验：
1. elevated 是否只有 AdminLogin 显式使用，其他七个 layout="card" production consumer 的默认输出是否不变；把 elevated 施加到默认 card 必须能被判据抓住。
2. PrimitivePinInput 是否无 state/controller/auth 业务依赖，六格是否方形、已填显示 *、testID 与 focus/error/disabled 语义是否成立。
3. AdminLogin 是否仍是唯一 password/focus/auth owner，native onTouchEnd 与 browser onClick 两条 surface-dismiss 事件守卫是否都保留；真实冒泡若不能由 focused 证明，请保持 device/Web 档位 OPEN。
4. 两个 integration 是否各自提供 surface-elevated、surface-inset、focus 的 CSS var/Tailwind mapping，且 focus theme 没有被复制成同一个固定青色。
5. 既有认证、错误/时钟/身份 fallback、debug password、关闭恢复、keyboard placement、testID、业务背景及包边界是否未漂移。
6. 逐项区分 static、focused、Web、Android、device、visual、release、cleanup；本轮未启动 Web/Metro/Android/设备，不能把 focused/static 说成 visual 或 implementation acceptance PASS；INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN 也必须保留。

请给出明确 GO 或 NO-GO，并报告 M/S/N 数量。每条 finding 请带精确仓库相对路径与行号、事实/推论/尚缺证据、影响面、最小修复和是否需要 Dexter 裁决。

授权边界：本轮只请 review 已实现的 admin login 主题化视觉代码与其证据，不授权扩大到业务 feature、wallpaper、member、topology、已认证 admin section、shared virtual keyboard、Android App/Metro、splash、application icon、登录 backend、密码算法或部署。GO 不等于 implementation acceptance、visual、Web、Android、release 或整体 acceptance PASS。谢谢。
路径：doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-implementation-design-codex.md；doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-implementation-plan-codex.md；doc/review/platform/2026-09-19-ter-terminal-admin-login-visual-implementation-evidence-codex.md；apps/terminal/ui/base/primitives/src/components/PrimitiveContainer.tsx；apps/terminal/ui/base/primitives/src/components/PrimitivePinInput.tsx；apps/terminal/ui/base/admin-shell/src/components/AdminLogin.tsx；apps/terminal/ui/base/admin-shell/test/adminLayout.test.ts；apps/terminal/ui/base/primitives/test/primitives.test.tsx；apps/terminal/ui/integration/sample-console/theme/global.css；apps/terminal/ui/integration/sample-console/tailwind.config.cjs；apps/terminal/ui/integration/sample-console/test/theme.test.ts；apps/terminal/ui/integration/sample-wallpaper-console/theme/global.css；apps/terminal/ui/integration/sample-wallpaper-console/tailwind.config.cjs；apps/terminal/ui/integration/sample-wallpaper-console/test/theme.test.ts；doc/platform/terminal-coding-standard.md；project-memory/index.md。
```
