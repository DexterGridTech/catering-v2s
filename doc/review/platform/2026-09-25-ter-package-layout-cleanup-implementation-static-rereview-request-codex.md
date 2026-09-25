# TER 包布局整理 IMPLEMENTATION 静态复审请求

## 背景

本轮针对 `doc/review/platform/2026-09-25-ter-package-layout-cleanup-implementation-static-review-claude.md` 的
`REVIEW_TARGET=IMPLEMENTATION` 复审结论 `NO-GO`（`M/S/N=0/2/3`）完成了授权范围内的 5 项代码侧修订，
并按 fresh 仅读复审补齐了 integration README 中同一 AC-11 术语分类遗漏。
本次只复审当前代码、测试、静态检查器、README 与详设分类表；不收集、不依赖 Web、Android、虚拟机、设备或
动态 evidence。

## 评审目标

请独立确认：

1. layering 的 ui→application、adapter→application 两个反向依赖变异，以及 skeleton application 下
   `node_modules` hygiene 变异，是否都能在未变异时通过、变异时针对具体 gate 与报文变红、恢复后再次通过；
2. integration-assembly README 的定位、结构和用法是否与当前整机装配代码一致；
3. application 自环死规则是否已删除，且不改变 graph-model 对自环的实际拒绝；
4. ui-state skeleton graph 条目解析是否不再依赖 `ui.base.render` 相邻节点，并由非相邻节点测试守住；
5. 三处 README 与详设 AC-11 分类表是否已同步使用 application 层命名；
6. 本轮没有引入超出授权范围的运行期行为或动态验证结论。

## 需阅读文件

请从 catering-v2s 仓库根阅读：

- `tools/terminal-layering/check-static.test.mjs`：两个 p-5a-direction 红变异与恢复断言；
- `tools/terminal-skeleton/check-static.test.mjs`：application `node_modules` hygiene 红变异与恢复断言；
- `tools/terminal-skeleton/check-static.mjs`：依赖方向检查与已删除的 application 自环死规则；
- `tools/terminal-ui-state/check-static.mjs`：ui-state graph 条目边界解析；
- `tools/terminal-ui-state/check-static.test.mjs`：非相邻 graph 节点回归用例及既有变异；
- `apps/terminal/ui/base/integration-assembly/README.md`：整机 integration assembly 的定位、结构与用法；
- `apps/terminal/application/android/sample-terminal/README.md`：application moduleName 术语；
- `apps/terminal/kernel/base/platform-ports/README.md`：application 控制面术语；
- `apps/terminal/ui/integration/sample-wallpaper-console/README.md`：integration 文档中的 application
  身份术语；
- `doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md`：AC-11
  README 分类表对应行；
- `doc/platform/claude-review-handoff-template.md`：本次交接结构与结论格式。

## 独立核验重点

- layering 测试的新增位置约为 `tools/terminal-layering/check-static.test.mjs:313-332`，公共红变异辅助函数在
  `:53-58`；确认两个变异分别命中 `p-5a-direction`，并分别断言
  `reverse dependency ui->application (` 与 `reverse dependency adapter->application (`。
- skeleton 测试的新增位置约为 `tools/terminal-skeleton/check-static.test.mjs:81-101`；确认只影响 hygiene，
  报文含 `scaffold metadata remains:`，清理 fixture 后恢复 PASS。
- `tools/terminal-skeleton/check-static.mjs:752-770` 不再有 application 自环规则；graph-model 的自环约束仍由
  owning source 负责。
- `tools/terminal-ui-state/check-static.mjs:411-422` 应按 ui-state 条目自身的同级边界截取；
  `tools/terminal-ui-state/check-static.test.mjs:75-86` 在 ui-state 与 render 之间插入节点后仍应 PASS。
- README 与详设行应分别核对 `integration-assembly/README.md:3-17`、sample-terminal README `:22`、
  platform-ports README `:33`、sample-wallpaper-console README `:12`，以及详设 AC-11-readme-002、
  AC-11-readme-007、AC-11-readme-062 行。
- 静态门已由主 agent 实跑：三个专项静态测试、三个专项 gate、`yarn --cwd apps/terminal verify:static`、
  `yarn --cwd apps/terminal typecheck` 与 `yarn --cwd apps/terminal test` 均通过；请独立判断测试是否真正覆盖
  上述变异，不把截图或设备结果作为本轮依据。

## 期望结论

请给出 `REVIEW_TARGET=IMPLEMENTATION`、`VERDICT=GO|NO-GO` 与 `M/S/N=x/y/z`。每条 finding 请写明精确路径与
行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。若当前字节已满足本轮范围，请明确说明 5 项修订
均已闭合；不要把静态通过升级为 Web、Android、设备、视觉或业务验收。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助复审 TER 包布局整理本轮 IMPLEMENTATION 静态修订。

背景：上一轮实现静态复审文件 doc/review/platform/2026-09-25-ter-package-layout-cleanup-implementation-static-review-claude.md 给出 REVIEW_TARGET=IMPLEMENTATION、VERDICT=NO-GO、M/S/N=0/2/3。本轮已按授权修复 5 项：补充 ui→application 与 adapter→application 的 p-5a-direction 红变异及恢复断言；补充 application/node_modules 的 skeleton hygiene 红变异及恢复断言；重写 integration-assembly README 的完整整机装配定位；删除 check-static.mjs 中不可达的 application 自环死规则；改造 ui-state graph 条目边界解析并增加非相邻节点回归；同步两处 README 与详设 AC-11 分类表的 application 术语。fresh 仅读复审另发现 sample-wallpaper-console README:12 遗留的 “Android assembly” 表述，已按 AC-11-readme-062 改为 “Android application 包”。本轮只涉及代码、测试、静态检查器、README 与详设分类表，不收集动态 evidence。

目标：请只看当前代码与静态测试，独立确认上述 5 项修订是否真实闭合，尤其确认三条新红测试都能在未变异时通过、变异时针对具体 gate 与报文变红、恢复后再次通过；README 定位是否与 integration assembly 代码一致；application 自环死规则是否确已删除而未削弱 graph-model 自环守卫；ui-state 条目解析是否不再依赖相邻节点；README 与详设分类表是否同口径。

请从 catering-v2s 仓库根阅读：
- tools/terminal-layering/check-static.test.mjs：p-5a-direction 两条反向依赖变异；
- tools/terminal-skeleton/check-static.test.mjs：application node_modules hygiene 变异；
- tools/terminal-skeleton/check-static.mjs：依赖方向与死规则删除；
- tools/terminal-ui-state/check-static.mjs：ui-state 条目边界解析；
- tools/terminal-ui-state/check-static.test.mjs：非相邻 graph 节点回归；
- apps/terminal/ui/base/integration-assembly/README.md：整机装配壳定位、结构与用法；
- apps/terminal/application/android/sample-terminal/README.md：application moduleName 术语；
- apps/terminal/kernel/base/platform-ports/README.md：application 控制面术语；
- apps/terminal/ui/integration/sample-wallpaper-console/README.md：integration 中的 application 身份术语；
- doc/plans/platform/2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md：AC-11-readme-002 与 AC-11-readme-007；
- doc/platform/claude-review-handoff-template.md：本次交接格式。

请重点独立核验：
1. tools/terminal-layering/check-static.test.mjs:313-332 的两条 mutation 是否分别断言 p-5a-direction 以及 reverse dependency ui->application ( / reverse dependency adapter->application (；
2. tools/terminal-skeleton/check-static.test.mjs:81-101 是否断言 hygiene=FAIL、报文含 scaffold metadata remains:，并在 finally 后恢复 PASS；
3. tools/terminal-skeleton/check-static.mjs:752-770 是否已删除 application 自环死规则，且不影响 graph-model 的自环拒绝；
4. tools/terminal-ui-state/check-static.mjs:411-422 是否按 ui-state 条目自身的同级边界解析，tools/terminal-ui-state/check-static.test.mjs:75-86 插入后续节点仍是否通过；
5. README 与详设分类表的 application 术语是否与当前字节一致，尤其是 sample-wallpaper-console README:12 与 AC-11-readme-062；
6. 本轮静态门结果是否与代码覆盖相符。可参考已实跑的专项静态测试、verify:static、typecheck 与 test，但不要把它们或任何既有截图解释成动态、视觉或业务验收。

期望结论：请明确给出 REVIEW_TARGET=IMPLEMENTATION、VERDICT=GO 或 NO-GO、M/S/N=x/y/z；每条 finding 附精确路径与行号、影响、最小修复建议和是否需要 Dexter 产品裁决。

授权边界：本轮仅授权上述 5 项代码、测试、静态检查器、README 与详设分类表修订，以及静态测试、typecheck、verify:static 运行；不授权修改其它运行期行为，不授权重新收集 Web、Android、虚拟机或真机动态证据，不授权关闭 TR-08。谢谢。
```
