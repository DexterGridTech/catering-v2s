REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_GRANULARITY_MANIFEST=RETIRED_NOT_APPLICABLE_BY_CURRENT_AGENTS
ADVERSARIAL_REVIEW_REPORT=OPEN_NOT_RUN_IN_THIS_TURN
REVIEW_TARGET=DESIGN
REVIEW_STATUS=READY_FOR_CLAUDE_REVIEW_RECHECK

## 背景

本轮只设计 TER terminal 共享 admin console 的登录弹层视觉，不实施源码。当前 `AdminLogin` 的认证、
虚拟键盘和 layer 行为已经存在，但六位口令仍由业务组件手工渲染 `•`/`○` 文本；用户已认可“六个方形
格、已填显示 `*`、卡片有层级”的视觉方向，并明确要求：admin console 不能锁定青色，必须跟随每个
integration 自己的 theme。

本轮已从当前源码整理四个直接相关包和三个 base owner 的边界，形成 IA 增补、implementation-facing
详设与串行计划。没有修改生产代码、测试、依赖、脚本或构建产物。详设头部诚实标记
`INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN`；这不是独立子 agent verdict，也不能被本次 Claude
review 文字改写成已经完成的 fresh adversarial round。

## 上一轮 review intake

- `M-1 CONFIRMED`：当前 `AdminLogin` 的 PIN Pressable 以 `onTouchEnd={event => event.stopPropagation()}`
  阻止触摸冒泡；`InputSurfaceFrame` 在 native 侧会对 surface touch 调用 `dismissActiveField`，browser 侧
  则对 surface click 调用同一 dismiss。原详设删掉该 Pressable 却没有给 `PrimitivePinInput` 事件透传入口。
  已在 IA、详设和计划中补上 owner 提供的 native `onTouchEnd`/browser `onClick` 守卫、focused 反变异与
  交付对账；primitive 不依赖 `ui.base.input`，只转交 `stopPropagation`。
- `N-1 ACCEPTED`：focus 与相邻 surface/border 的可读差异不由“token 不相等”冒充机器证明，当前不冻结
  统一 RGB、色差或对比度阈值，转为后续 visual/Claude review 观察并保持 OPEN。
- `N-2 RETAINED`：`INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN` 仍为真实状态；本交接请求
  Claude review，不把 Claude 外部复评改写成治理要求的 fresh independent design verdict。
- `S-1 ACCEPTED`：elevated card 明确定为 `PrimitiveContainer` 的可选 `elevated` prop，只有
  `AdminLogin` 显式传入；其它 `layout="card"` consumer 保持默认 recipe。详设、IA、计划已同步该调用形态，
  并新增“登录卡使用 elevated 且其它 card consumer 输出不变”的 focused/static 判据与“把 elevated 施加到默认
  card”红变异。

## 评审目标

请独立判断这组设计是否真正满足“只改 admin login、shared structure、integration theme owner、primitive
承接”的目标，并能安全交给后续 implementation：

1. package graph 与运行时 theme 加载路径是否准确；
2. `admin-shell`、`ui/base/input`、`ui/base/primitives`、两个 integration、两个 Android assembly 的
   owner boundary 是否没有反转；
3. `PrimitivePinInput` 是否是足够小且可复用的 primitive，是否会意外新增第二 input/keyboard/state owner；
4. 六格方形、`*` 遮罩、focus/error/disabled、mobile/laptop 不溢出、testID 是否可执行；点击 PIN root 后
   native/browser 的 surface-dismiss 冒泡守卫是否仍保持 field/keyboard active；
5. semantic token 是否确实由两个 integration 分别提供，是否仍残留固定青色或把业务背景纳入 scope；
6. 详设、IA 增补与实施计划是否逐项一致，计划是否越过当前“不授权实施”的边界；
7. 方案 C 是否比固定色或每个 integration 复制 login 更小、更长期可维护。

## 需阅读文件

请从 `catering-v2s` 仓库根阅读：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`project-memory/index.md`、相关 `project-memory`：项目治理、TER owner 与 review 边界；
- `doc/platform/terminal-coding-standard.md`：尤其 TR-13 共享 admin console 规则；
- `doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md`：既有 `TERMINAL_ADMIN_CONSOLE` Journey 的 J-02/J-03/J-06；
- `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ia-design-codex.md`：既有 IA 与输入/焦点边界；
- `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md`：既有 virtual keyboard、testID、login interaction；
- `doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-ia-design-codex.md`：本轮 scoped IA/视觉增补；
- `doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-implementation-design-codex.md`：本轮 owner、token、primitive、CP 与证据详设；
- `doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-implementation-plan-codex.md`：本轮 CP-0 至 CP-4 串行计划；
- `apps/terminal/ui/base/admin-shell/src/components/AdminLogin.tsx`、`apps/terminal/ui/base/admin-shell/src/components/AdminLayer.tsx`：当前登录层、输入 owner 接线与 layer 关系；
- `apps/terminal/ui/base/admin-shell/package.json`、`apps/terminal/ui/base/admin-shell/src/index.ts`：admin-shell 的直接依赖与 public surface；
- `apps/terminal/ui/base/input/package.json`、`apps/terminal/ui/base/input/src`：field/controller/virtual keyboard owner；
- `apps/terminal/ui/base/primitives/src/components/PrimitiveForms.tsx`、`apps/terminal/ui/base/primitives/src/components/PrimitiveContainer.tsx`、`apps/terminal/ui/base/primitives/src/theme/tokens.ts`、`apps/terminal/ui/base/primitives/src/index.ts`：当前 primitive 能力与 proposed `PrimitivePinInput` 接缝；
- `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`：admin parts 与 `AdminLauncher` 的生产装配；
- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`、`apps/terminal/ui/integration/sample-console/theme/global.css`、`apps/terminal/ui/integration/sample-console/tailwind.config.cjs`、`apps/terminal/ui/integration/sample-console/test/theme.test.ts`：sample-console theme/assembly；
- `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`、`apps/terminal/ui/integration/sample-wallpaper-console/theme/global.css`、`apps/terminal/ui/integration/sample-wallpaper-console/tailwind.config.cjs`、`apps/terminal/ui/integration/sample-wallpaper-console/test/theme.test.ts`：sample2 theme/assembly；
- `apps/terminal/ui/integration/sample-console/test-expo/App.tsx`、`apps/terminal/ui/integration/sample-wallpaper-console/test-expo/App.tsx`：Web 预览的各自 theme 入口；
- `apps/terminal/assembly/android/sample-terminal/App.tsx`、`apps/terminal/assembly/android/sample-terminal/metro.config.js`、`apps/terminal/assembly/android/sample-wallpaper-terminal/App.tsx`、`apps/terminal/assembly/android/sample-wallpaper-terminal/metro.config.js`：Android 两个 assembly 如何选择各自 integration theme；
- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`、`apps/terminal/ui/base/admin-shell/test/adminLayout.test.ts`、`apps/terminal/ui/base/admin-shell/test/adminPassword.test.ts`：现有 focused/static 约束与需要保留的行为。

## 独立核验重点

1. 反向从两个 Android `App.tsx`/Metro 和两个 Web `test-expo/App.tsx` 追到 CSS，确认 admin-shell 不 import integration，且两个 integration 的 semantic token 是唯一颜色来源。
2. 反例攻击：把 `AdminLogin` 写死青色、让 wallpaper 直接复制 sample-console theme、在 integration 复制一份 login、在 primitive 内新增 password state/keyboard；确认详设的边界和计划红夹具能发现这些形状。
3. 核实当前 `PrimitiveCodeInput` 只是安全 `PrimitiveInput` 别名，因此新增 `PrimitivePinInput` 是否比重载旧 API 更小；检查 public export、`terminal-invariants.json`、README 和 focused test 是否被同步列入。
4. 核验六格在逻辑 mobile 360×640 与 laptop surface 下的方形/等宽/不溢出方案，且虚拟键盘仍是 surface owner；
   特别检查 `onTouchEnd` 与 browser `onClick` 的 owner 事件透传，删除任一入口应使 focused interaction proof 变红；
   不得用结构测试宣称视觉、Android 或 Web PASS。
5. 核验 focus 与相邻 surface/border 的可读差异是否被诚实标为 visual/Claude review 观察，而不是用 token
   不相等冒充机器证明；本批不要求统一 RGB、色差或对比度阈值。
6. 核验保留既有 `AdminLogin` 的动态密码、debug password、clock/identity fallback、错误文案、verify/close、focus restore 和 testID；本批没有背景业务画面、已认证 admin 页面、splash 或 App icon 改动。
7. 核验详设与 IA 的 visible contract 逐字一致，计划 CP-0 至 CP-4 与详设 §6/§7/§8 对账一致；任何 implementation、typecheck、test、Web、Metro、Android 或设备结果都应继续标为未执行。
8. 对 `INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN` 保持诚实，不把本交接或作者文档自检当成 fresh independent verdict。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M`（major）、`S`（significant）、`N`（note）数量。每条 finding
请给出仓根相对路径与稳定 symbol/锚点（行号可作为当前字节辅助）、事实/推论/未证实假设、影响面、
反例或复现方式、最小修复建议，以及是否需要 Dexter 产品/Journey 裁决。请单独说明：本轮用户已经接受的
视觉方向是否足以作为 implementation-facing 输入；若不足，请指出还缺哪一个明确决定。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审 TER terminal admin console 登录弹层的主题化视觉 IA 增补、implementation-facing 详设与串行实施计划。

背景：本轮只设计 shared admin login，不实施源码。当前 AdminLogin 的认证、虚拟键盘和 layer 行为已存在，但六位口令仍由组件手工显示 •/○；Dexter 已接受“六个方形格、已填显示 *、卡片有层级”的视觉方向，并明确 admin console 不能锁定青色，必须跟随各 integration 自己的 theme。两个 integration 共用 admin-shell，但必须各自提供 semantic token。文档已诚实标记 INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN；这不是 fresh independent verdict，请不要把它当成已完成的对抗式审查。

目标：请独立核验包关系、owner boundary、theme 加载路径、PrimitivePinInput 的最小性、六格/遮罩/focus/error/testID 约束，以及详设与实施计划是否能防止固定青色、复制 login、第二输入 owner、surface-dismiss 冒泡守卫丢失、把 elevated recipe 错施加到默认 card、业务背景 scope drift 等自然捷径。请判断方案是否可以作为后续 implementation 的设计输入；不要开始实施。

请从仓库根阅读当前源码与设计材料：既有 Journey/IA/interaction、terminal TR-13、两个 base owner、
两个 integration theme/assembly、两个 Android theme 入口，以及本轮三份设计文档。

请重点核验：两个 integration 的 theme 是否是唯一颜色 owner；admin-shell 是否保持 theme-agnostic；PrimitivePinInput 是否比重载 PrimitiveCodeInput 更小且不新增 input/keyboard/state；六格是否始终方形、显示 *、保留焦点/错误/testID；PIN root 的 native `onTouchEnd` 与 browser `onClick` 事件透传是否保留 surface-dismiss 守卫；登录卡是否只有 AdminLogin 显式传 `elevated`，其余 `layout="card"` consumer 是否保持默认 recipe；focus 可读差异是否诚实降为 visual/Claude review 观察而非 token 不等机器证明；AdminLogin 是否没有背景业务画面或固定青色；四个包和三个 base owner 的依赖方向是否清楚；IA、详设、计划的事实是否逐字一致；计划是否明确当前没有 implementation、Web、Metro、Android 或设备授权。

烦请给出明确 GO 或 NO-GO，并按 M/S/N 报告 findings。每条 finding 请给出仓库相对路径、稳定 symbol/锚点、事实/推论/未证实假设、影响面、反例或复现方式、最小修复和是否需要 Dexter 裁决。

授权边界：本次只请求 DESIGN review。不得修改源码、测试、依赖、脚本或构建产物，不得启动 Web、Metro、Android、设备、DEV、seed、UAT 或部署，也不得把本次 GO/NO-GO 解释为 implementation、visual、Web、Android、release 或 acceptance PASS；后续是否进入实施由 Dexter 另行决定。

仓库相对路径：doc/platform/terminal-coding-standard.md；doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md；doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-ia-design-codex.md；doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-implementation-design-codex.md；doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-implementation-plan-codex.md；apps/terminal/ui/base/admin-shell/；apps/terminal/ui/base/input/；apps/terminal/ui/base/primitives/；apps/terminal/ui/integration/sample-console/；apps/terminal/ui/integration/sample-wallpaper-console/；apps/terminal/assembly/android/sample-terminal/；apps/terminal/assembly/android/sample-wallpaper-terminal/；project-memory/index.md。谢谢。
```
