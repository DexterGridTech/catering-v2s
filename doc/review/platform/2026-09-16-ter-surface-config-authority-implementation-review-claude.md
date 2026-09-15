# TER surface 配置覆盖 · implementation 静态评审

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_KIND=Codex 与 Claude 经 Dexter 中转的 review(轮次由 Dexter 决定,AGENTS.md:72)
REVIEW_ROUND=1(仅作序号)
reviewerKind=CLAUDE_DIRECT(本事项各轮均由 Dexter 要求 Claude 直接评审;Dexter 2026-09-16 指示"请进行静态 review")
EVIDENCE_TIER=static;只读源码、README 与证据文件,未执行任何构建、测试、Web、Metro、Android、DEV 或 git 命令
依据:
  详设 doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-design-codex.md
  计划 doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-plan-codex.md
  设计复评 doc/review/platform/2026-09-15-ter-surface-config-authority-design-review-round2-claude.md(GO 0/0/0)
  实施证据 doc/evidence/platform/2026-09-16-ter-surface-config-authority-implementation-validation-codex.md
```

下文路径以 `apps/terminal/` 为根时省略该前缀;`tools/`、`doc/` 从仓库根写。行号为评审时当前字节。

## 0. 结论

```text
VERDICT=GO(仅针对本批源码、focused 测试与 README 的静态评审)
M/S/N=0/0/2
OPEN=既有 terminal static 被外部 RD-6 基线挡住,后续静态检查未对本批执行(N-1)
DEXTER_DECISION=N-1 是否要求 RD-6 修复后补跑 verify:static
不构成 implementation acceptance,也不构成 Web、Android、native、release、visual、cleanup 或整体 acceptance 的 PASS
```

## 1. 逐项核验

| # | 核验项 | 结论 | 依据 |
|---|---|---|---|
| 1 | 两个 Android `platformPorts.ts` 静态传入整份 `terminalSurfaces`,不预选 | 成立 | `assembly/android/sample-terminal/src/assembly/platformPorts.ts:1,15`、`assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts:1,19`;两个文件都没有调用 `getSurfaceDeclarations` |
| 2 | 两个 integration 工厂的可选入参与覆盖表达式 | 成立,入参可选,表达式逐字符合 | `ui/integration/sample-console/src/assembly/assembly.tsx:19,54,79`、`ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:19,33,58` |
| 3 | 两个 Android 配置与对应 integration 默认值同形同值 | 成立。规范化 JSON 比较两对都相等 | `assembly/android/sample-terminal/package.json:10`、`assembly/android/sample-wallpaper-terminal/package.json:10`,对照两个 integration 的 `package.json:11-30` |
| 4 | 覆盖用例的传入值不同于默认值,忽略覆盖时会失败 | 成立。每个维度都不同:1400×700 对 1280×800,700×400 对 960×540,411×731 对 360×640。sample-console 用 laptop 断言 landscape,wallpaper 用 mobile 断言 portrait,两种形态各覆盖一次;工厂忽略覆盖时 `assembly.surfaceDeclarations` 会等于默认值,`toEqual` 必然失败 | `ui/integration/sample-console/test/sampleAssembly.test.tsx:249-272`、`ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx:81-104` |
| 5 | 不该改动的文件保持不变 | 成立。本批 12 个文件的修改时间都是 09-16 00:00。以下文件的修改时间都早于本批和设计复评:两个 `test-expo/App.tsx`、`ui/base/dev-host/src/components/testExpoApp.tsx`、两个 App 的 `tsconfig.json` 与 `App.tsx`、`assembly/base/android` 的 `package.json` 与源码、`ui/base/render/src/foundations/surfaceHost.ts`、`consoleAssembly.tsx`、两个 integration 的 `src/index.ts` 与 `src/application/terminalSurfaces.ts`。当前字节与此前读取一致:App tsconfig 仍只有一行 extends 且两份相同,`test-expo/App.tsx` 仍不传覆盖值 | 修改时间只是弱证据,本条结论同时依据当前字节的直接比对 |
| 6 | 四个 typecheck 与两个 owned 测试的 PASS 与证据一致 | 与证据自洽。证据记录 sample-console 8 个文件 38 个用例、wallpaper 4 个文件 15 个用例;本轮静态数测试文件中的 `it`/`test` 调用,结果恰为 8/38 与 4/15。PASS 本身来自作者运行记录,本轮未复跑 | 证据 :64-98 |
| 7 | `verify:static` 首败确属外部基线 | 成立,证据如实记为 `OPEN_BASELINE_FAILURE`,没有写成 PASS。报错的 14 个文件(platform-ports defaults、两个 Android adapter、两个 dev-host implementation)都不在本批改动集中,修改时间均为 09-15 17:34,早于本批;readability 检查器与测试分别修改于 09-12 与 09-07。推论:09-13 的 sample2 证据曾把全部 descriptor attach 点修到 `__DEV__` 保护下,这 14 个文件在 09-15 17:34 被同时改动,RD-6 回归很可能来自 sample 基础设施上收批次,与本批无关(按修改时间推断,未核实具体改动) | 证据 :100-325;`doc/evidence/platform/2026-09-13-v2s-terminal-sample2-cp5-execution-codex.md:18-23` |
| 8 | v1 作废路径均不存在 | 成立,`OBSOLETE_V1_SOURCE_CLEANUP=NOT_NEEDED` 正确。9 个路径逐一核实不存在:`tools/terminal-surface-config`、render 的 parser 与测试、两个 App 的 `src/application/`、`vitest.config.ts` 与 `test/` | 证据 :327-343 |

## 2. Findings

### N-1 既有 terminal static 没有对本批实际执行

- **状态**:CONFIRMED(证据事实);本批是否会触发后续静态检查:静态推断为否,未运行验证
- **实现与证据事实**:`verify:static` 的第一个子进程 `readability-model-test` 因 RD-6 退出,其后的全部静态检查(contracts、platform-ports、state、runtime、display-context、ui-state、render、layering、skeleton 等)都没有运行(证据 :313、:321)。
- **静态推断**:
  - 本批新增的 `import packageJson from '../../package.json'` 是相对路径。skeleton 的导入收集只保留 `@catering-v2s/` 开头的说明符(`tools/terminal-skeleton/graph-model.mjs:287-292`),不会改变依赖图比对。
  - App 薄壳规则只禁止 `platformPorts.ts` 使用动态 `import(` 或 `require(`,静态导入不受影响。
  - 本批没有新增 workspace 依赖或导出。
  - 因此后续静态检查大概率不会因本批变红,但这不是运行证据。
- **影响**:计划 §9.1 要求的"既有 terminal static 通过"目前是 OPEN;若 RD-6 基线修复后本批恰好碰到某条未运行的规则,需要到那时才能发现。
- **最小修复**:不在本批修 RD-6(授权范围外)。RD-6 基线由其所属批次修复后,补跑一次 `yarn --cwd apps/terminal verify:static` 并记录结果;在此之前保持 OPEN。
- **Dexter**:是否要求在 RD-6 修复后补跑,还是接受静态推断收口本项,由 Dexter 决定。

### N-2 两份 Android README 缺少计划要求的"逻辑 canvas 非物理 host 测量"说明

- **状态**:CONFIRMED
- **计划约束**:详设 §3.3(:162-164)与计划 §7(:241-242)要求 Android README 说明本 App JSON 会整份传入,并"强调这是逻辑 canvas 而非物理 host measurement"。
- **实现事实**:`assembly/android/sample-terminal/README.md:51` 与 `assembly/android/sample-wallpaper-terminal/README.md:47` 只写了"整份覆盖 integration 默认值;integration 仍按 surfaceForm 选择对应声明",上下文(:44-54、:40-50)也没有这层说明。
- **影响**:很小。后续开发者可能把这里的尺寸误当成设备物理分辨率去填。
- **最小修复**:两处各补半句,例如"这是 TER 的逻辑画布尺寸,不是设备物理分辨率;物理尺寸由 host 测量提供"。
- **Dexter**:不需要。

## 3. 实现正确性、证据分档与仍缺的证据

- **实现正确性**:
  - 覆盖语义、Android 取值来源、选择逻辑的位置、初始值保真、预览链路不变,全部与已通过的 v2 详设一致。
  - 没有引入 v1 的任何机制。
  - 修复 N-2 只需补文档,不影响代码。
- **证据分档**:
  - static(本轮评审):通过,见 §1。
  - focused:四个 typecheck 与两个 owned 测试由作者记录 PASS,与本轮静态计数自洽,本轮未复跑。
  - terminal static:OPEN,见 N-1。
  - Web、Android、native、设备、release、visual:未运行;按计划,初始值与现状相同,本批不需要运行期观察。
- **仍缺的证据**:RD-6 修复后的 `verify:static` 结果(N-1)。按最小方案,Android 侧"确实传了覆盖值"没有自动化测试,本轮已静态核对两处传参行,这一形态由 Dexter 在设计阶段接受。

## 4. 方案合理性

改动与 Dexter 意图和 v2 设计完全对齐:两份 App 配置、两个工厂各一行、两个 App 各传一个值、两个覆盖用例、四句 README。没有多余的抽象、门或兼容层,代价与目标相称。

## 5. UI 与交互强制自问

`NOT_APPLICABLE`:初始值与现状相同,不改变任何控件、布局、文案或交互。

## 6. 授权边界

本评审只读、只针对本批源码、focused 测试、README 与限定证据,不授权扩大源码范围、修复 RD-6 基线、启动 Web、Metro、Android 构建、设备、DEV、seed、UAT、部署或 Git。GO 不代表 implementation acceptance 或任何运行档位的 PASS,最终由 Dexter 决定。
