# TER surface 配置覆盖 · 执行计划

```text
DOC_KIND=IMPLEMENTATION_PLAN
PLAN_VERSION=2026-09-15-v2-minimal
BUSINESS_SOURCE=DEXTER_DIRECT_REQUEST_2026-09-15
DESIGN_SOURCE=doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-design-codex.md
REVIEW_SOURCE=doc/review/platform/2026-09-15-ter-surface-config-authority-design-review-claude.md
REVIEW_VERDICT=NO-GO_1M_0S_2N
AUTHORIZED=本轮只修订详设与执行计划；是否实施由 Dexter 另行决定
IMPLEMENTATION_PERFORMED=false
ADVERSARIAL_REVIEW=DEFERRED_BY_DEXTER_DIRECT_REQUEST
NOT_AUTHORIZED=源码、测试、依赖、脚本、构建产物、Web、Metro、Android、DEV、seed、UAT、部署、Git
```

本计划替代 v1 的 B0–B4/CP 方案，按评审文件 §1 的最小方案组织为一个实施批次。步骤有先后，
但不形成多个独立交付批次，也不把配置来源问题扩展成新的治理控制面。本文件只描述未来动作，
本次不修改源码、测试、依赖、脚本或构建产物。

## 0. 目标、范围与方案

### 0.1 目标

保持 Web integration 的默认配置和预览行为不变；让两个 Android 实际运行 App 可以在各自
`package.json` 持有 `terminalSurfaces`，并在 assembly 创建时覆盖 matching integration 的
默认值。逻辑分辨率仍是一个 `terminalSurfaces` 对象，最终由现有
`getSurfaceDeclarations(..., surfaceForm)` 选出声明。

### 0.2 目标 package

| package | 角色 | 变化 |
| --- | --- | --- |
| `apps/terminal/ui/integration/sample-console` | Web preview integration | factory 增加可选覆盖 input，默认仍用本包 JSON |
| `apps/terminal/ui/integration/sample-wallpaper-console` | Web preview integration | factory 增加可选覆盖 input，默认仍用本包 JSON |
| `apps/terminal/assembly/android/sample-terminal` | Android actual assembly App | 增加本 App JSON，并传整份对象 |
| `apps/terminal/assembly/android/sample-wallpaper-terminal` | Android actual assembly App | 增加本 App JSON，并传整份对象 |

`apps/terminal/assembly/base/android` 不增加 sample-specific surface 配置。Web
`test-expo/App.tsx`、`ui/base/dev-host`、Android `App.tsx`、native host measurement、
DisplayMetrics、SurfaceFlinger 和现有 exports 不在本批改动范围内。

### 0.3 统一覆盖语义

两个 integration factory 的 input 增加：

```ts
readonly terminalSurfaces?: TerminalSurfaces
```

其中 `TerminalSurfaces` 复用各自 integration 已有类型。两个 factory 的现有选择表达式统一
改为：

```ts
surfaceDeclarations: getSurfaceDeclarations(input.terminalSurfaces ?? terminalSurfaces, surfaceForm)
```

调用方传入即覆盖；不传入则保留 integration 默认值。`??` 是产品指定的优先级，不做字段
merge，不新增配置 fallback 治理，不增加非法配置产品路径。

## 1. 实施入口条件与顺序

### 1.1 入口条件

实施开始前由主 agent 重新读取 `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、
`doc/platform/README.md`、相关 project memory、`scripts/README.md`、详设 §0–§8 及当前
owning source，并确认：

1. Web 两个 package 的当前 `terminalSurfaces` 值仍是本计划的迁移输入；若已变化，以当前
   package JSON 为准，不用旧文档数字覆盖；
2. 两个 integration factory 仍在详设 §1 所列锚点使用 `getSurfaceDeclarations`；
3. 两个 Android `platformPorts.ts` 仍分别创建 matching integration assembly，且当前未传
   `terminalSurfaces`；
4. 两个 App tsconfig 仍从 `assembly/base/android/config/tsconfig.json` 继承
   `resolveJsonModule`，并且两份文件逐字相同；
5. 没有 v1 实验产生的未登记 loader、base parser、surface checker 或 App test harness；
6. Dexter 已另行打开源码/测试修改授权。仅有本计划或 Claude `GO` 不构成实施授权。

任一入口事实不成立时，保留首个差异、last known good 和 broken boundary，先交 Dexter，不
用新增 fallback 掩盖差异。

### 1.2 单批次步骤顺序

在实施授权打开后，按下列顺序在一个批次内完成：

1. 只读建立当前 source denominator 和 v1 作废文件清单；
2. 写两个 Android App 的 `package.json`；
3. 写两个 integration factory 的可选 input 与覆盖表达式；
4. 写两个 Android `platformPorts.ts` 的本地 JSON import 和整份对象传递；
5. 在两个现有 integration assembly 测试各增加一个 override 用例；
6. 更新两个 integration README 和两个 Android README；
7. 执行 v1 临时文件清理核对；
8. 按 §9.1 顺序执行四包 typecheck、两个 integration owned tests 和既有 terminal static；
9. 回读源码与详设/计划逐点对账，记录未授权的 runtime 证据为 `NOT_RUN`。

所有步骤由主 agent 完成；本计划不安排子 agent、不安排运行期观察。

## 2. 步骤 1：建立源码分母与作废文件清单

### 2.1 读取与扫描

主 agent 以当前字节核对：

- 四个目标 package 的 `package.json`、README、现有 `terminal-invariants.json`；
- 两个 integration 的 `src/application/terminalSurfaces.ts`、`src/assembly/assembly.tsx`、
  `test-expo/App.tsx` 和 assembly tests；
- 两个 Android 的 `src/assembly/platformPorts.ts`、`tsconfig.json`、`App.tsx`；
- shared `ConsoleAssembly.surfaceDeclarations` 与 `SurfaceRoot.canvas` 消费；
- 所有 `createSampleAssembly` 和 `createSampleWallpaperConsoleAssembly` 的直接调用方；
- v1 曾规划但本版明确不做的路径：base parser、Android loader/App tests、surface AST tool、
  新 static 编排和 tsconfig 修改。

扫描目的只是确定改动分母，不新增校验器，不以旧数字代替当前源码。确认已有 integration
parser 是继续保留的 owning code，而不是待删除的作废文件。

### 2.2 步骤 1 收口

进入步骤 2 前必须得到：

- 四个目标 package 与所有 factory callsite 清单；
- 当前 Web 值和两份 Android 缺失字段的源码事实；
- v1 临时文件清单为 `NONE`，或每个文件均有明确任务归属和引用关系；
- 未发现 `assembly/base/android` 应持有 sample 数值的理由。

## 3. 步骤 2：增加 Android package 配置

### 3.1 修改落点

修改：

- `apps/terminal/assembly/android/sample-terminal/package.json`；
- `apps/terminal/assembly/android/sample-wallpaper-terminal/package.json`。

增加与 matching Web integration 相同形状的：

```json
"terminalSurfaces": {
  "orientations": {
    "landscape": {
      "PRIMARY": {"width": 1280, "height": 800},
      "SECONDARY": {"width": 960, "height": 540}
    },
    "portrait": {
      "PRIMARY": {"width": 360, "height": 640}
    }
  }
}
```

实际写入前以步骤 1 的当前 Web JSON 值为准。这个副本只保证初始运行画面不漂移，不建立
Web/Android 永久相等关系；未来 Android 只需改自身 package JSON。

### 3.2 不做的伴随修改

不改两个 App 的 tsconfig、dependencies、scripts、`App.tsx`、native resource 或
`assembly/base/android/package.json`。不为 JSON 增加 loader、运行时读取、环境变量或错误页。

## 4. 步骤 3：integration factory 增加可选覆盖

### 4.1 sample-console

修改 `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`：

1. 在 `SampleAssemblyInput` 增加 `readonly terminalSurfaces?: TerminalSurfaces`；
2. 从该包现有 `../application/terminalSurfaces` 导入 `TerminalSurfaces` 类型；
3. 将当前第 77 行附近的
   `getSurfaceDeclarations(terminalSurfaces, surfaceForm)` 改为
   `getSurfaceDeclarations(input.terminalSurfaces ?? terminalSurfaces, surfaceForm)`；
4. 保留 `terminalSurfaces` 默认常量、parser、`getSurfaceDeclarations` 及现有 exports。

### 4.2 sample-wallpaper-console

修改 `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`：

1. 在 `WallpaperConsoleAssemblyInput` 增加同名可选字段；
2. 从该包现有 `../application/terminalSurfaces` 导入 `TerminalSurfaces` 类型；
3. 将当前第 56 行附近的选择表达式改为
   `getSurfaceDeclarations(input.terminalSurfaces ?? terminalSurfaces, surfaceForm)`；
4. 保留现有 parser、默认常量和 exports。

所有原有未传该字段的调用方继续编译并继续使用 integration 默认值。不得把字段改成 required，
不得把选择逻辑移到 Android 或 base。

## 5. 步骤 4：Android 传递本 App 的整份对象

### 5.1 sample-terminal

修改 `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts`：

1. 静态导入本包 `../../package.json`；
2. 在 `createSampleAssembly` 的 input 中增加
   `terminalSurfaces: packageJson.terminalSurfaces`；
3. 保持现有 `surfaceForm`、persistence key、platform binding 和 loading capability；
4. 不在这里调用 `getSurfaceDeclarations`，不传预选的 `PRIMARY`/`SECONDARY`，不读取
   `ui/integration/sample-console/package.json`。

### 5.2 sample-wallpaper-terminal

对称修改 `apps/terminal/assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts`：

1. 静态导入本包 `../../package.json`；
2. 在 `createSampleWallpaperConsoleAssembly` 的 input 中传
   `terminalSurfaces: packageJson.terminalSurfaces`；
3. 保持现有 surface form 和 platform binding；
4. 不在 Android 侧复制 parser/selector 或读取 Web integration 配置。

传整份对象的原因是让 `surfaceForm` 的选择仍由 matching integration 的现有
`getSurfaceDeclarations` 完成，也保留 `tools/terminal-sample2/run-a9-runtime.mjs` 对选择路径
的现有变异语义。

## 6. 步骤 5：增加最小 focused 覆盖用例

只修改两个已有 assembly 测试，不创建 Android 测试基建：

- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`；
- `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx`。

每个文件增加一个用例，传入与 package 默认值不同但结构合法的 `terminalSurfaces` sentinel，
再按该用例的 `surfaceForm` 断言：

```text
assembly.surfaceDeclarations === getSurfaceDeclarations(override, surfaceForm)
```

可使用不同于默认的宽高，避免“忽略 override 仍然通过”。至少覆盖一个 laptop/dual 或 mobile
选择，且断言的是实际 `assembly.surfaceDeclarations`，不是仅断言 input 或 package JSON。
不增加 invalid-config 失败页、Android mock factory、loader test 或专用 AST red fixture。

## 7. 步骤 6：更新四个 README

各补一句与实现一致的说明：

- `apps/terminal/ui/integration/sample-console/README.md`；
- `apps/terminal/ui/integration/sample-wallpaper-console/README.md`：

  本包 `package.json` 的 `terminalSurfaces` 是预览默认值；factory 收到
  `terminalSurfaces` 时按 `surfaceForm` 使用调用方传入对象。

- `apps/terminal/assembly/android/sample-terminal/README.md`；
- `apps/terminal/assembly/android/sample-wallpaper-terminal/README.md`：

  本 App `package.json` 的 `terminalSurfaces` 会由 `platformPorts.ts` 整份传给
  matching integration assembly，覆盖其默认值；它表示逻辑 canvas，不是物理 host measurement。

不在 README 承诺非法配置的产品处理、失败页、AST 门、运行时热更新或 Android/Web 数值同步。

## 8. 步骤 7：作废文件线下处理

这次 v1 只产生文档，v1 计划中的 base parser、Android loader/test harness、专用 surface
checker 和 tsconfig 改动不是现存实现，不能凭计划路径删除。

实施时若步骤 1 发现工作区确实有本事项 v1 实验产生的文件：

1. 逐个读取文件并扫描 imports/exports/callsite；
2. 仅删除能证明由本事项 v1 产生、且在最小方案中不再有 owner 的文件；
3. 删除后重新扫描无残留 import、README 叙述和 package script；
4. 不删除两个 integration 现有 `terminalSurfaces.ts`、有效 owned tests、无关配置或用户已有文件。

清理与业务结果分开记录。若清单为 `NONE`，记录 `OBSOLETE_V1_SOURCE_CLEANUP=NOT_NEEDED`，不
把“没有可删文件”误报成删除动作已完成。

## 9. 验证与收口

### 9.1 验证顺序

仅在后续获得实施授权、且步骤 2–8 已完成后运行：

```text
yarn --cwd apps/terminal/ui/integration/sample-console typecheck
yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console typecheck
yarn --cwd apps/terminal/assembly/android/sample-terminal typecheck
yarn --cwd apps/terminal/assembly/android/sample-wallpaper-terminal typecheck
yarn --cwd apps/terminal/ui/integration/sample-console test
yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console test
yarn --cwd apps/terminal verify:static
```

四个 typecheck 覆盖可选 factory input、本地 JSON import 和现有调用闭合；两个 integration
owned tests 覆盖 override 生效；既有 terminal static 覆盖仓内已有静态约束。不得把这些结果
升级为 Web、Metro、Android、设备、native、release、visual 或整体 acceptance PASS。

### 9.2 失败处理

任何命令失败时保留原始输出，记录 first failure、last known good、broken boundary。第二次
尝试前先根据 owning source 定位根因；不通过延长 timeout、盲目重跑或增加 v1 已删除的治理机制
掩盖失败。动态环境、设备观察、seed、UAT、部署和 Git 均不在本计划。

### 9.3 交付前逐代码与详设对账

主 agent 逐项复核：

| 计划项 | 详设落点 | 必须看到的源码事实 |
| --- | --- | --- |
| Android JSON | 详设 §2.3、§3.2 | 两个 App 各自拥有同形状对象，初始值按当前 Web 值迁移 |
| optional input | 详设 §2.1、§3.1 | 两个 factory 都是可选字段，调用方可不传 |
| override expression | 详设 §2.1 | 只出现 `input.terminalSurfaces ?? terminalSurfaces` 的覆盖语义 |
| Android pass | 详设 §2.2、§3.2 | 每个 platformPorts 读取本地 JSON 并传整份对象 |
| Web no-change | 详设 §2.2、§3.3 | test-expo/dev-host 与默认预览链路保持不变 |
| tests | 详设 §4.2 | 两个既有 assembly 测试各有 asymmetric override 断言 |
| README/cleanup | 详设 §5 | 四个 README 与实际 owner 一致，v1 临时文件无残留 |
| non-goals | 详设 §0.3、§4.4 | 无 base parser、loader、AST 门、失败页、tsconfig 改动和新批次 |

任何行不匹配都不报告“计划闭合”，先回到文档或实现的根因处置。

## 10. 首轮 findings 对账

逐条处置以评审文件 §4 和详设 §6 为准：

| Finding | 计划处置 |
| --- | --- |
| S-1 注入点放到平台宿主 | 收敛为 Android `platformPorts.ts` 传可选覆盖对象，不做必填平台注入 |
| S-2 非法配置不走失败页 | 不设计失败页；开发配置错误由开发人员承担 |
| S-3 dev-host 第三份 schema | Web preview 与 dev-host 不改，列为范围外 |
| S-4 AST 门只是形状匹配 | 不新建任何 surface AST 门 |
| S-5 A9 runner 变异失效 | Android 传整份对象，选择保留在 integration `getSurfaceDeclarations` |
| S-6 B2/B3 编译断开 | optional input 保持既有调用方兼容，不拆 B0–B4 |
| N-1 兼容导出 | 不增删现有 exports |
| N-2 base 重定义类型 | 不迁移 parser/type |
| N-3 Android tsconfig 多余 | 不改两份 tsconfig，复用已继承的 `resolveJsonModule` |
| N-4 Web canvas 与模拟 host 同源 | 不改 Web preview 或 host measurement |

## 11. 最终边界

本计划只描述一个小范围配置覆盖改动。未来完成 §9 的文档/源码对账和最小验证后，可把本项
交 Dexter 决定是否继续；它不自动授权任何运行期动作，也不代表 implementation、Web、Android、
native、release、visual、cleanup 或整体 acceptance GO。

本次交付状态：

```text
DESIGN_REWRITE=PLANNED_ONLY
SOURCE_MODIFIED=false
TESTS_RUN=false
RUNTIME_RUN=false
```
