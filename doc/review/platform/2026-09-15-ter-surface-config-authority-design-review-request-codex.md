# TER surface 配置权威分离 · Claude 详设与执行计划评审请求

```text
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_TARGET=DESIGN
REVIEW_STATUS=OPEN_FOR_CLAUDE_REVIEW
DESIGN_SOURCE=doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-design-codex.md
PLAN_SOURCE=doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-plan-codex.md
IMPLEMENTATION_AUTHORITY=false
ADVERSARIAL_REVIEW=DEFERRED_BY_DEXTER_DIRECT_REQUEST
RETIRED_CONTROL_NOTE=不创建或恢复 DESIGN_GRANULARITY_MANIFEST 与 implementation-design-granularity；该控制面已按当前 AGENTS.md 退役。
NOT_AUTHORIZED=源码、测试、依赖、脚本、构建产物、Web、Metro、Android、DEV、seed、UAT、部署、Git
```

## 背景

Dexter 提出一项边界明确的 TER sample 配置需求：现有 Web 的两个
`apps/terminal/ui/integration/*` 包在各自 `package.json` 中声明 surface 的逻辑
`width`/`height`，Web 继续以本 integration 包的声明为准；Android 的两个 sample App 包也应
在各自 `apps/terminal/assembly/android/*/package.json` 中声明 surface，并且 Android 运行时
以本 App 包的声明为准。

当前源码核查得到的待评审基线是：Web integration 已有 `terminalSurfaces` 配置、解析入口和
Web host/assembly 使用链；两个 Android App 的 `package.json` 尚无该字段，Android 的
assembly factory 也没有显式把 Android App 的声明传给 integration assembly，因此仅增加
Android JSON 字段不会改变实际来源。本轮 Codex 只写了 implementation-facing 详设与执行计划，
没有修改源码、测试、依赖或脚本，也没有启动 Web、Metro、Android、DEV 或其他动态运行。

详设选择把共享 schema/parser 放在现有 `ui.base.render`，让四个平台-facing package 各自
拥有自己的 `package.json`，并要求 Web/Android wrapper 显式把对应 package 的声明传入
`ConsoleAssembly.surfaceDeclarations`，沿既有链路消费到 `SurfaceRoot.canvas`。计划按 B0–B4
落地，包含语义 static checker、focused 红 mutation、全链对账、逐代码与详设对账，以及对可能
作废的临时配置和重复 parser 的线下清理。`assembly/base/android` 被明确排除，因为它是共享
平台基础包而不是 sample-specific 配置 owner。

本请求是把详设和执行计划交 Claude 做独立设计评审，不表示 implementation 已获授权或已通过
任何动态、native、Android、Web、visual、release、cleanup 或整体 acceptance。按 Dexter 的
直接要求，本轮不追加 fresh 对抗式子 agent；请由 Claude 直接重开当前仓库源码、设计和计划形成
评审结论。

## 评审目标

请判断：

1. 要解决的是否是真实的 authority/source-of-truth 问题，而不是只增加一份不会被消费的 JSON；
2. 选定的显式注入与共享 parser 方案，是否比“只加 Android 字段”、把配置放进 base、或保留
   integration fallback 等更简单替代更可靠、更易维护；
3. Web integration 与 Android App 的 owner 边界、`assembly/base/android` 的排除、逻辑 canvas
   与物理 host measurement 的分离是否成立；
4. 详设是否完整回答了声明、解析、传递、消费、失败闭合、所有调用方、测试红 mutation、
   static checker、文档/不变量和旧文件清理等实施所需问题；
5. B0–B4 计划是否真正可执行，依赖顺序、入口条件、每批收口、focused 验证、全批验证和
   逐代码与详设对账是否没有互相矛盾；
6. 需求没有给出不同 Android 数值时，计划暂以现有 Web 值迁移保真的假设是否应接受，或应
   标成必须由 Dexter 决定的产品/范围事项；
7. 任何“恶意但合规”或自然捷径是否能绕过 authority 分离、隐式 fallback 禁止、schema
   完整性、传递链和清理要求。

## 需阅读文件

请从 `catering-v2s` 仓库根打开：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`：执行入口、架构边界和
  当前授权规则；
- `project-memory/index.md`、`scripts/README.md`、`doc/platform/terminal-coding-standard.md`：
  项目记忆导航、脚本边界和 TER 编码规范；
- `doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-design-codex.md`：
  本轮 implementation-facing 详设，重点看 §0–§4、§7–§9、§11–§13b；
- `doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-plan-codex.md`：
  本轮 B0–B4 执行计划，重点看 §1、§2–§6、§7–§10；
- `apps/terminal/ui/integration/sample-console/package.json`、
  `apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts`、
  `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`、
  `apps/terminal/ui/integration/sample-console/test-expo/App.tsx`：Web 配置声明、解析、
  assembly 和 host 注入入口；
- `apps/terminal/ui/integration/sample-wallpaper-console/package.json`、
  `apps/terminal/ui/integration/sample-wallpaper-console/src/application/terminalSurfaces.ts`、
  `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`、
  `apps/terminal/ui/integration/sample-wallpaper-console/test-expo/App.tsx`：第二个 Web
  integration 的对称链路；
- `apps/terminal/assembly/android/sample-terminal/package.json`、
  `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts`、
  `apps/terminal/assembly/android/sample-terminal/App.tsx`：Android sample 当前配置和
  factory 入口；
- `apps/terminal/assembly/android/sample-wallpaper-terminal/package.json`、
  `apps/terminal/assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts`、
  `apps/terminal/assembly/android/sample-wallpaper-terminal/App.tsx`：第二个 Android sample
  的对称链路；
- `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`、
  `apps/terminal/ui/base/render/src/foundations/surfaceHost.ts`、
  `apps/terminal/ui/base/render/src/index.ts`：shared assembly 的声明输入、逻辑 canvas
  消费点、host measurement 边界和可复用 parser 所在层；
- `apps/terminal/assembly/base/android/package.json`：确认共享 Android 基础包是否应排除
  sample-specific surface owner；
- `doc/decisions/templates/implementation-design-template.md`、
  `doc/platform/claude-review-handoff-template.md`、
  `project-memory/operations/claude-review-handoff-standard.md`：设计和交接格式边界。

## 独立核验重点

请以当前源码为准，先独立形成判断，再对照详设和计划：

1. 实测/静态复核 Web 两个 integration 的 `terminalSurfaces` 真实字段、解析校验和所有消费
   入口；确认当前 Android 两个 App 是否确实没有同字段，且当前 Android assembly 是否确实
   没有显式传 `surfaceDeclarations`。若任一事实不符，请以具体文件和行号给出反例。
2. 沿 `ConsoleAssembly.surfaceDeclarations` → `SurfaceRoot.canvas` 复核 `width`/`height` 的
   语义是否是逻辑 canvas，而不是 Android 物理像素、DisplayMetrics、SurfaceFlinger 或
   host 实测尺寸；检查详设是否错误地让一条事实链覆盖另一条。
3. 检查目标包是否应正好是两个 Web integration 与两个 Android sample App；挑战把
   `apps/terminal/assembly/base/android` 排除在 owner 集合之外的理由，以及任何漏枚举的
   `apps/terminal/ui/integration/*` 或 `apps/terminal/assembly/android/*` 包。
4. 评估 `ui.base.render` 共享 parser 的层级归属与最小替代：如果现有 integration parser
   可以安全复用，说明为什么；如果不能，指出具体 layering、循环依赖或 owner 反例。检查
   是否会因“共享”而让 Android 重新依赖 Web package 的配置值。
5. 逐个检查所有 factory/wrapper 调用方迁移：Web 是否显式传本 integration 值，Android
   是否只读本 App `package.json` 并显式传值；缺字段、非法尺寸、缺失 wrapper 传递时是否
   fail closed，是否存在 `??`、merge、隐式默认或从另一平台回退的捷径。
6. 挑战计划初始值“复制当前 Web 值”的假设：确认它只是一项迁移保真默认，而不是把 Web 与
   Android 永久绑定；若需求确实需要 Android 的不同数值，指出必须补齐的产品输入。
7. 核验 B1–B4 的变更与验证是否逐项落在详设 §9a/§9b 和计划 §7；检查 checker 是否按
   JSON/AST/调用语义判断而不是关键词或字段存在性，且每个关键绕过确有 focused red
   mutation 能使门失败后再恢复。
8. 复核“旧文件线下处理”是否具体覆盖复制的 parser、临时 Android 配置、旧 fallback、
   重复测试 support、README/invariant/配置登记等可能作废项；不能用“未发现”代替对文件分母
   和调用方的扫描。
9. 保持授权边界：本轮只评审详设与执行计划；不要把计划中的命令当作已执行证据，也不要
   启动 Web、Metro、Android、DEV、seed、UAT、部署或 Git 操作。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并报告 `M`、`S`、`N` 数量。每条 finding 请区分：

- 仓内事实、外部事实、推论或尚缺证据的假设；
- 精确仓根相对路径、行号或源码锚点；
- 对架构、运行行为、可维护性、验收可执行性的影响；
- 能真正闭合问题的最小修复，而不是只增加文档或字段；
- 是否需要 Dexter 作产品、范围或授权裁决。

请分别报告：设计正确性、计划可执行性、实现前仍需补证的内容。若认为某个 finding 不成立，
请给出当前源码反例和可复跑的核验方式；不要把“计划已写”当作“源码已证明”。即使给出
`GO`，也请明确尚未产生任何 implementation 或动态证据。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审 TER surface 配置权威分离的 implementation-facing 详设与执行计划。

背景：Dexter 提出：现有 Web 的 `apps/terminal/ui/integration` 包在各自 `package.json` 中声明 surface 的 width/height，Web 继续以该 integration 包的声明为准；Android 的 `apps/terminal/assembly/android` 两个 sample App 包也应在各自 `package.json` 中声明 surface，并且 Android 运行时以本 App 包的声明为准。当前源码基线是：两个 Web integration 已有 `terminalSurfaces` 配置、解析与消费链；两个 Android App `package.json` 尚无该字段，Android factory 也未向 integration assembly 显式传入 `surfaceDeclarations`，因此仅加字段不会改变真实来源。Codex 已据当前源码写出详设与执行计划，本轮没有修改源码、测试、依赖或脚本，也没有启动任何运行环境。

目标：请判断这是否确实解决 authority/source-of-truth 问题，`ui.base.render` 共享 schema/parser 加上 Web/Android wrapper 显式注入是否比更简单替代更可靠；核验两个平台的 owner 边界、逻辑 canvas 与物理 host measurement 的分离、fail-closed、所有调用方、红 mutation、static checker、B0–B4 顺序、旧文件清理，以及详设和计划能否被实际执行且不被自然捷径绕过。

请从 catering-v2s 仓库根阅读：
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、`project-memory/index.md`、`scripts/README.md`、`doc/platform/terminal-coding-standard.md`：执行入口、架构、记忆与脚本边界；
- `doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-design-codex.md`：详设；
- `doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-plan-codex.md`：B0–B4 执行计划；
- `apps/terminal/ui/integration/sample-console/package.json`、`apps/terminal/ui/integration/sample-console/src/application/terminalSurfaces.ts`、`apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`、`apps/terminal/ui/integration/sample-console/test-expo/App.tsx`，以及 `apps/terminal/ui/integration/sample-wallpaper-console` 的对应文件：Web authority 与传递链；
- `apps/terminal/assembly/android/sample-terminal/package.json`、`apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts`、`apps/terminal/assembly/android/sample-terminal/App.tsx`，以及 `apps/terminal/assembly/android/sample-wallpaper-terminal` 的对应文件：Android 当前入口；
- `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`、`apps/terminal/ui/base/render/src/foundations/surfaceHost.ts`、`apps/terminal/ui/base/render/src/index.ts`、`apps/terminal/assembly/base/android/package.json`：shared consumer、物理 host 边界和 base 排除理由。

请重点独立核验：当前四类 package 的真实字段与调用方；`ConsoleAssembly.surfaceDeclarations` 到 `SurfaceRoot.canvas` 的逻辑尺寸语义；目标包枚举与 base 排除；共享 parser 与 layering/最小替代；Android 是否只读取本 App package.json；缺失/非法配置和隐式 fallback 是否 fail closed；B0–B4 是否与详设逐点对账；checker 是否有真实 red mutation；计划是否覆盖可能作废文件的线下清理；以及“Android 初始值复制 Web 值”是否只是迁移保真假设。请只做文档与当前源码的设计核验，不启动任何运行环境。

烦请给出明确 `GO` 或 `NO-GO`，并报告 `M`、`S`、`N` 数量。每条 finding 请区分仓内事实、外部事实、推论和待证假设，给出精确仓根相对路径与行号/锚点、影响面、最小修复建议、可复跑核验方式，以及是否需要 Dexter 产品/范围裁决；不同意时请给出源码反例。请分别说明设计正确性、计划可执行性和仍缺的实现/运行证据。

授权边界：本请求只授权对上述详设与执行计划做设计评审，不授权修改源码、测试、依赖、脚本或构建产物，不授权 Web、Metro、Android、DEV、seed、UAT、部署或 Git 操作。即使结论为 `GO`，也只表示详设/计划可以交 Dexter 决定是否进入实施，不表示 implementation、focused、native、Android、Web、visual、release、cleanup 或整体 acceptance GO。按 Dexter 的直接要求，本轮不追加 fresh 对抗式子 agent；请由 Claude 直接独立形成评审结论。谢谢。
```
