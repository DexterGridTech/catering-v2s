# TER surface 配置覆盖 · 详设与执行计划复评(第 2 轮)

```text
REVIEW_TARGET=DESIGN
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN;Codex 与 Claude 经 Dexter 中转的 review(轮次由 Dexter 决定,AGENTS.md:72)
REVIEW_ROUND=2(仅作序号)
reviewerKind=CLAUDE_DIRECT(按 Dexter 直接要求,本轮不召集 fresh 对抗式子 agent)
EVIDENCE_TIER=static;只读文档与当前源码,未执行任何构建、测试、Web、Metro、Android、DEV 或 git 命令
被审输入(sha256 前缀):
  详设 doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-design-codex.md 5857917f7091(265 行)
  计划 doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-plan-codex.md 516ba161bf6b(334 行)
上一轮:doc/review/platform/2026-09-15-ter-surface-config-authority-design-review-claude.md 092ffecb978d(NO-GO 1M/0S/2N)
```

下文路径以 `apps/terminal/` 为根时省略该前缀;`tools/`、`doc/` 与 `node_modules/` 从所在根写。行号为评审时当前字节。

## 0. 结论

```text
VERDICT=GO
M/S/N=0/0/0
上一轮 M-1、N-1、N-2 均已关闭(§3)
GO 只表示详设与计划可交 Dexter 决定是否进入实施;不构成 implementation、runtime、Android、Web、visual、release、cleanup 或整体 acceptance 的 GO
```

## 1. 评审方式与出处

- 按 Dexter 直接要求,由 Claude 直接评审,未召集 fresh 子 agent。详设与计划头部如实标注 `ADVERSARIAL_REVIEW=DEFERRED_BY_DEXTER_DIRECT_REQUEST`,不列为 finding。
- 先重开当前源码核对基线未变,再逐条核对详设与计划的每项主张。
- 会话出处:从 v2s 仓根发起的续接会话,不是 fresh 会话。

## 2. 逐项核验

| # | 核验项 | 结论 | 依据 |
|---|---|---|---|
| 1 | 覆盖表达式是否准确实现"传入即覆盖、未传用默认" | 成立。入参为可选 `terminalSurfaces?`,取值为整份对象级 `input.terminalSurfaces ?? terminalSurfaces`,不是必填,也不做字段级合并 | 详设 §2.1(:78-92)、计划 §0.3(:44-58);改动锚点仍在 `ui/integration/sample-console/src/assembly/assembly.tsx:77`、`ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:56` |
| 2 | Android 是否读自身 `package.json` 整份对象,并由 integration 既有选择函数按 surfaceForm 选择 | 成立,且类型可闭合:<br>① 选择函数以参数接收对象;<br>② `DisplayMode` 只有 `'PRIMARY' \| 'SECONDARY'`,App JSON 的推导类型可直接赋给 `TerminalSurfaces`;<br>③ `resolveJsonModule` 已经继承;<br>④ `...androidPlatform` 展开的字段里没有 `terminalSurfaces`,不会被覆盖 | 详设 §2.2、§3.2(:94-105、:143-158),计划 §5(:183-208);<br>`ui/integration/sample-console/src/application/terminalSurfaces.ts:31-39`、`ui/integration/sample-wallpaper-console/src/application/terminalSurfaces.ts:24-32`;<br>`kernel/base/display-context/src/types/display.ts:5`;<br>`assembly/base/android/config/tsconfig.json:2` → `node_modules/expo/tsconfig.base.json:15`;<br>`assembly/base/android/src/foundations/androidPlatform.ts:44-51` |
| 3 | 两个 Android App 与 `assembly/base/android` 的 owner 边界 | 成立。数值只在两个 App 的 `package.json`,base 包不改 | 详设 :42-43、计划 :38-40 |
| 4 | 不迁移 parser、不新增 loader、AST 门、失败页或专用 checker 是否符合最小目标 | 成立。非目标清单与 Dexter 意图一致 | 详设 §0.3(:45-57)、计划 §3.2(:152-155) |
| 5 | Web 预览链路是否保持不变 | 成立。两个 `test-expo/App.tsx` 不传覆盖值;dev-host 调用 `createAssembly` 的入参里没有该字段,继续走 integration 默认值;新增可选字段不影响赋值兼容 | `ui/base/dev-host/src/components/testExpoApp.tsx:67-75,786-793` |
| 6 | 两个非对称覆盖用例是否足以证明工厂没有忽略传入值 | 足够:<br>① 两个测试 helper 的入参类型由生产入参推导,并用 `...input` 透传,新字段自动带过去,helper 无需改动;<br>② `assembly.surfaceDeclarations` 与 `createSurface` 使用的是同一对象;<br>③ 现有用例已断言默认值下的 canvas。<br>默认值与覆盖值两条路径都有覆盖 | ① `ui/integration/sample-console/test/sampleAssembly.test.tsx:37-44`、`ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx:36-43`;<br>② `ui/base/console-assembly/src/foundations/consoleAssembly.tsx:381-386,444-451`;<br>③ `sample2Assembly.test.tsx:81-100` |
| 7 | 四包 typecheck、两个 integration 测试和既有 static 是否足够 | 足够:<br>① 命令入口都存在;<br>② 原生投影检查只禁止 App `package.json` 出现 `babel/metro/tailwind/nativewind`,新增字段不冲突;<br>③ 生产包禁止的 8 个字符串都不在 App `package.json` 里,整份 JSON 打进 release bundle 不会触发扫描;<br>④ App tsconfig 不改,两份仍逐字相同 | ① `apps/terminal/package.json:9`,两个 App 与两个 integration 的 `typecheck`、`test` 脚本;<br>② `tools/terminal-sample2/check-native-projection.mjs:380-381`;<br>③ `tools/terminal-sample2/check-production-bundle.mjs:8-17`;<br>④ `check-native-projection.mjs:392-398` |
| 8 | 是否为可执行的单批次,并覆盖 v1 可能作废文件的核对与清理 | 成立。计划为一个批次 9 个有序步骤,清理步骤区分"确有残留"与 `NOT_NEEDED`。本轮已核实 v1 规划的路径在磁盘上均不存在:`tools/terminal-surface-config`、render 下的 parser 与测试、两个 App 的 `src/application/`、`vitest.config.ts` 与 `test/` 目录;v1 详设与计划已被原地改写,没有遗留旧文档 | 计划 §1.2(:81-95)、§8(:246-259) |
| 9 | "Android 初始值复制 Web 值"是否只是迁移保真 | 成立。两份文档都写明不是永久相等约束,并要求以实施时的当前值为准 | 详设 §2.3(:127-128)、计划 §3.1(:149-150) |
| 附 | A9 runner 是否仍然有效 | 成立。Android 传整份对象后,选择仍经过 wallpaper integration 的 `getSurfaceDeclarations`,runner 对该函数的变异对 Android 运行时照样生效 | 详设 :103-105、计划 :206-208;`tools/terminal-sample2/run-a9-runtime.mjs:85-93` |

## 3. Findings

无。

上一轮 findings 的关闭情况:

| 上一轮 | 状态 | 依据 |
|---|---|---|
| M-1 方向与 Dexter 意图相反,过度设计 | 已关闭 | 详设与计划已改为六步最小方案(详设 §2 至 §4、计划 §1.2),非目标清单明确删除了必填、fail-closed、base parser、App loader、AST 门和多批次 |
| N-1 不需修改 Android tsconfig | 已关闭 | 详设 §0.3(:50-51)、计划 §3.2(:154) |
| N-2 覆盖时传整份对象 | 已关闭 | 详设 §2.2(:103-105)、计划 §5(:193-194、:206-208) |

## 4. 详设正确性、计划可执行性与仍缺的实现证据

- **详设正确性**:覆盖语义、数据流、owner 边界、Web 不变与迁移保真值均与当前源码一致,没有与 Dexter 意图冲突的机制。
- **计划可执行性**:单批次、步骤有序;入口条件都能用当前源码核对;验证命令都存在;清理步骤对"无残留"的情况有明确记录方式。
- **仍缺的实现证据**(实施后才有):
  1. 四个包 typecheck 通过;
  2. 两个 integration 的覆盖用例通过,且覆盖值与包内默认值确实不同,工厂忽略覆盖时会失败;
  3. `verify:static` 通过;
  4. 静态核对两个 Android `platformPorts.ts` 确实传了 `terminalSurfaces: packageJson.terminalSurfaces`。按最小方案,这一行没有 Android 侧自动化测试,漏传时 Android 会继续用 integration 默认值;这是 Dexter"谁传就用谁的"口径下接受的形态,由实施评审静态兜底。
  - 初始值与现状相同,不需要运行期观察。

## 5. 方案合理性

- **问题对不对**:对。只解决"运行包能用自己的逻辑分辨率、预览包继续自由调"。
- **方案优不优**:一个可选参数加一处取值,选择逻辑与预览链路不动;没有比这更小还能达成目标的改法。
- **代价配不配**:改动 6 处加 2 个用例、4 句 README,与目标相称。

## 6. UI 与交互强制自问

`NOT_APPLICABLE`:初始值与现状相同,不改变任何控件、布局、文案或交互;未来 Android 改尺寸属于开发者自行调整与验证。

## 7. 授权边界

本复评只读、只针对详设与计划,不授权修改源码、测试、依赖、脚本或构建产物,不授权 Web、Metro、Android、DEV、seed、UAT、部署或 Git 操作。是否进入实施由 Dexter 决定。
