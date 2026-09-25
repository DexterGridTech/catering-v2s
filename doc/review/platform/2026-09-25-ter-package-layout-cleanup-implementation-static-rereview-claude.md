# TER 包布局整理 · 实现静态复审（Claude，只看代码）

```text
REVIEW_TARGET=IMPLEMENTATION（只看代码，复审）
VERDICT=GO（范围：代码静态实现）
M/S/N=0/0/3
```

```text
上轮：doc/review/platform/2026-09-25-ter-package-layout-cleanup-implementation-static-review-claude.md（NO-GO 0/2/3）
依据：需求 v5、方案 v5、Codex 详设与实施计划（2026-09-25）
EVIDENCE_TIER=仅静态：Claude 回读当前字节；未运行任何命令、门、构建或设备。Codex 自报的门结果不作为本轮证据
SESSION=CONTINUED_SESSION（v2s 仓根，经上下文压缩续接，不是 fresh acceptance）
AUTHORITY=结论只覆盖代码的静态实现；不覆盖动态、视觉、业务或设备验收；TR-08 仍为 OPEN
```

## 1. 结论

上轮的 2 个 S 与 3 个 N 都已闭合。这些修订真正起到防回归作用：新增的红测试都挂在 `verify:static` 下；把对应规则写错，测试就会失败。

本轮新记 3 个 N，都是命名残留或 README 文字问题，不影响运行期行为，不挡 GO。

## 2. 上轮 5 处的核对

### S-1 AC-3 三条红测试 · 已闭合

**layering 两条**（`tools/terminal-layering/check-static.test.mjs` 第 313–332 行）
- 两条变异分别往 ui feature 夹具和 adapter 夹具里加一行副作用 import：`@catering-v2s/application-base-android`。
- 检查器侧：
  - `import-capabilities.mjs` 把这种 import 记为 `side-effect`；
  - `workspaceLayer`（第 166 行）把它归入 application 层；
  - `isInvalidDirection`（第 184–185 行）判定 ui→application 与 adapter→application 都是反向依赖；
  - 报文为 `P-5a reverse dependency ui->application (…)` 或 `P-5a reverse dependency adapter->application (…)`（第 197 行），测试的正则能匹配。
- 其它三条规则不受影响：
  - P-5c 只禁 react-redux 模块与具名能力，`*` 不在禁用名单；
  - P-10 只扫 kernel feature；
  - P-5d 只看原生元素创建。
  - 因此 `assertVector(report, ['p-5a-direction'])` 成立。
- `withRedMutation` 恢复后会再断言全绿。
- 可证伪：把第 184 或 185 行的 `'application'` 写错，或把第 166 行的 `application-` 前缀写错，对应测试都会失败。

**skeleton hygiene 一条**（`tools/terminal-skeleton/check-static.test.mjs` 第 81–101 行）
- 在 fixture 的 `application/base/android` 下创建 `node_modules`。
- `runScaffoldHygiene`（`check-static.mjs` 第 1137–1154 行）按 `application.` 前缀取包，于是报 `scaffold metadata remains: …/node_modules`。测试同时断言 7 条规则仍为 PASS，只有 hygiene 为 FAIL。
- `finally` 删除目录后再次断言全绿。
- 可证伪：把第 1138 行的 `application.` 写错，hygiene 不会变红，测试失败。

**接线**
- `apps/terminal/package.json` 第 15 行的 `verify:static` 调用 `verify-static.mjs`。
- 该脚本第 71、83、87 行分别运行 skeleton、ui-state、layering 三个测试文件。

### S-2 integration-assembly README 定位 · 已闭合

- 第 5–9 行已改为“整机装配壳”，列出读取设备与屏幕事实、合并 parts、建立并启动 runtime、按屏生成界面树，并写明导出 `createIntegrationAssembly`；启动诊断只是其中一项。
- 这与代码一致：`integrationAssembly.tsx` 第 339 行定义入口，第 423–525 行建立并启动 runtime，第 406 行创建 writer；`index.ts` 第 24–29 行导出这些能力。
- 第 13–26 行的结构清单与包内文件一一对应。
- “用法”一节仍有残余，见 N-3。

### N-1 application 自环死规则 · 已闭合

- `runDependencyDirection`（`check-static.mjs` 第 751–770 行）已无 application 自环分支。
- 自环仍由 `graph-model.mjs` 第 155–157 行在解析时对所有节点拒绝，覆盖没有减弱。

### N-2 ui-state 检查器依赖相邻节点 · 已闭合

- `graphEntry`（`tools/terminal-ui-state/check-static.mjs` 第 411–422 行）的解析方式：
  - 以 ui-state 条目自身为起点；
  - 以下一个两空格缩进的同级条目为终点；
  - 截出的内容必须以 `\n  },` 结尾。
  - 它不再依赖具体的相邻节点名。
- 新用例（测试第 75–86 行）在 ui-state 之后插入一个带 `plannedKind` 的节点：
  - 解析若越界吞进该节点，`plannedKind` 断言会报错；
  - 按旧实现（以 `'ui.base.render':` 为终点），这条用例会变红。
- 真实 `skeleton-graph.ts` 有 29 个条目，都是两空格缩进，条目之间没有空行，当前能正常解析。

### N-3 两行 README 的归类 · 已闭合

- `application/android/sample-terminal/README.md` 第 22 行已改为“本 application 的固定 moduleName”，对应分类表 AC-11-readme-007（详设第 695 行），已改为 LAYER_RENAME。
- `kernel/base/platform-ports/README.md` 第 33 行已改为“UI / application 控制面”，对应 AC-11-readme-002（详设第 690 行）。
- Codex 顺带修改的 `sample-wallpaper-console/README.md` 第 12 行已改为 application 包身份（AC-11-readme-062，详设第 750 行）。但同一段还有残留，见 N-2。

## 3. Findings

### N-1 · layering 测试的两个输出标签仍叫 ASSEMBLY_BASE · CONFIRMED · 需 Dexter 裁决：否

- **仓内事实**：
  - `tools/terminal-layering/check-static.test.mjs` 第 345 行输出 `TERMINAL_LAYERING_ALLOWED_ASSEMBLY_BASE_SAME_PLATFORM_ADAPTER`，第 353 行输出 `TERMINAL_LAYERING_ALLOWED_ASSEMBLY_BASE_CROSS_PLATFORM_DELEGATED_TO_SKELETON`；
  - 两个用例测的都是 `application/base/android` 夹具；
  - 仓内没有任何地方消费这两个标签；
  - 分类表没有收录它们。
- **影响**：只影响测试输出的可读性，没有行为影响。
- **说明**：上轮我同样漏看了这两行。
- **验收**：两个标签不再含旧层名 `ASSEMBLY_BASE`。

### N-2 · sample-wallpaper-console README 第 11–12 行仍有过时表述 · 第 12 行 CONFIRMED，第 11 行为推论 · 需 Dexter 裁决：否

- **第 11 行**：“surface host 与 Android 形态由 adapter/assembly 拥有”。
  - 分类表 AC-11-readme-061（详设第 749 行）把它记为“装配义、保留”，理由是“adapter 与 integration 的装配职责”。
  - **推论**：这句话列的是“本包不拥有”的东西。如果这里的 assembly 指 integration 自己的 `src/assembly/`，就与“本包不拥有”自相矛盾，所以它只能指顶层层名。
  - **佐证**：`application/base/android/README.md` 第 17–18 行写明两个 App 的 `MainActivity` 等原生工程由各自的 App 包持有；`application/android/sample-terminal/README.md` 第 19 行写明由 App 的 `App.tsx` 按 displayIndex 呈现 surface。
- **第 12 行**：仍写“未来依赖它的 Android application 包是……”。
  - **仓内事实**：`application/android/sample-wallpaper-terminal/App.tsx` 第 1、6 行已经依赖本包，“未来”已不成立。
- **影响**：README 与现状不符，违反 TR-10 的准确性要求；没有行为影响。
- **验收**：第 11 行按层义改写，第 12 行不再称“未来”；分类表 AC-11-readme-061 的类别与理由同步修改。

### N-3 · integration-assembly README 的“用法”仍是旧写法 · CONFIRMED · 需 Dexter 裁决：否

- **仓内事实**：
  - “用法”一节（第 34–38 行）只写了调用 `createStartupDiagnosticsWriter` 的受控入口，以及接入 `createStartupReadyActor` 等辅助能力，没有写 integration 的主入口 `createIntegrationAssembly`。
  - 实际上，两个 integration 都从各自的 `src/assembly/assembly.tsx` 调用 `createIntegrationAssembly`（sample-console 第 76 行，wallpaper 第 55 行）。
  - writer 由 `createIntegrationAssembly` 在内部创建（`integrationAssembly.tsx` 第 406 行）并调用（第 595 行）；包外只有本包测试与 `tools/terminal-sample2` 直接调用它。
- **影响**：按“用法”接入新 integration 的人，可能自己再建一个 writer。这与第 28–30 行“不得各自复制写入逻辑”相冲突。
- **说明**：上轮 S-2 我只要求重写“定位”，没有检查“用法”，这一条是本轮补查出来的。
- **验收**：“用法”写明 integration 的入口是 `createIntegrationAssembly`，并说明 writer 由它在内部创建与调用。

## 4. 观察（不计 finding）

新的 `graphEntry` 要求 ui-state 之后还有同级条目，且条目之间没有空行或注释；否则会直接抛错。它会明确报错，不会静默放过；以当前图的排序，ui-state 也不可能是最后一个条目。

## 5. 方案合理性与边界

- 各项修订都是需求要求的最小补齐：
  - 红测试放在原有测试文件里，沿用已有的 `withRedMutation` 与夹具，没有新建测试框架；
  - ui-state 的解析只改了边界判定，没有引入新的解析依赖。
- 这一轮没有发现夹带的运行期改动。
- UI 自问：NOT_APPLICABLE。本轮只涉及静态检查器、测试与 README，没有用户可见的变化。
- 3 个 N 可由 Codex 在既有授权内顺手修，修完是否再交复审由 Dexter 决定。
- 本结论只覆盖代码的静态实现：
  - 不把 Codex 自报的门结果当作本轮新鲜证据；
  - 不覆盖 AC-10 的动态对照、视觉、业务或设备验收；
  - 不关闭 TR-08；
  - 不授权任何修改。
