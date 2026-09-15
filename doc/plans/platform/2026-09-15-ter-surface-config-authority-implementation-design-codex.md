# TER surface 配置覆盖 · implementation-facing 详设

```text
DOC_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_VERSION=2026-09-15-v2-minimal
BUSINESS_SOURCE=DEXTER_DIRECT_REQUEST_2026-09-15
REVIEW_SOURCE=doc/review/platform/2026-09-15-ter-surface-config-authority-design-review-claude.md
REVIEW_VERDICT=NO-GO_1M_0S_2N
AUTHORIZED=本轮只修订详设与执行计划；是否实施由 Dexter 另行决定
IMPLEMENTATION_AUTHORITY=false
ADVERSARIAL_REVIEW=DEFERRED_BY_DEXTER_DIRECT_REQUEST
NOT_AUTHORIZED=源码、测试、依赖、脚本、构建产物、Web、Metro、Android、DEV、seed、UAT、部署、Git
```

本版按评审文件 §1 的 Dexter 意图重写，替代同日 v1。这里解决的是一个小的配置来源问题，
不是建立新的配置治理系统：integration 主要服务预览，assembly 才是实际运行包；逻辑分辨率
由一个 `terminalSurfaces` 对象承载，调用方传入时覆盖 integration 默认值，未传入时继续使用
integration 自己的默认值。非法开发配置由开发人员承担后果，不新增产品失败页或专用机器门。

## 0. 目标、范围与非目标

### 0.1 目标

- 两个 `ui/integration` 包继续在自己的 `package.json` 提供预览默认值，方便预览中快速变换
  分辨率调整 UI；
- 两个 Android sample App 包在自己的 `package.json` 增加同形状的 `terminalSurfaces`，
  Android assembly 创建时把整份对象传给对应的 integration 工厂；
- integration 工厂只增加一个可选覆盖入口，使用
  `getSurfaceDeclarations(input.terminalSurfaces ?? terminalSurfaces, surfaceForm)`；
- 仍由现有 `getSurfaceDeclarations` 按 `surfaceForm` 选择最终声明，再进入
  `ConsoleAssembly.surfaceDeclarations` 和 `SurfaceRoot.canvas`。

### 0.2 范围

| 平台 | package | 配置语义 |
| --- | --- | --- |
| Web 预览 | `apps/terminal/ui/integration/sample-console` | 本包 `package.json` 是默认值 |
| Web 预览 | `apps/terminal/ui/integration/sample-wallpaper-console` | 本包 `package.json` 是默认值 |
| Android 运行包 | `apps/terminal/assembly/android/sample-terminal` | 本 App `package.json` 覆盖传入 |
| Android 运行包 | `apps/terminal/assembly/android/sample-wallpaper-terminal` | 本 App `package.json` 覆盖传入 |

`apps/terminal/assembly/base/android` 是共享 Android 平台基础包，不持有 sample-specific 数值，
不加入 `terminalSurfaces`。

### 0.3 非目标

- 不把 parser 或类型迁移到 `apps/terminal/ui/base/render`；
- 不把 integration 工厂入参改成必填，不删除 integration 默认值；
- 不在 Android App 新建 loader、vitest 配置、测试目录或额外配置文件；
- 不修改两个 Android App 的 `tsconfig.json`。`resolveJsonModule` 已由现有 Expo/base 配置继承，
  且两份 App tsconfig 必须继续逐字相同；
- 不新建 `tools/terminal-surface-config`、AST 门或新的 static 编排；只运行既有 terminal static；
- 不为非法配置设计失败页、环境变量、运行时动态配置或新的 fallback 治理；
- 不改 `test-expo/App.tsx`、`ui/base/dev-host`、物理 host 测量、DisplayMetrics、SurfaceFlinger
  或现有兼容导出；
- 不拆成原 v1 的 B0–B4/CP 批次，不进行任何源码、测试、依赖、脚本、构建、Web、Metro、
  Android、DEV、seed、UAT 或部署动作。

## 1. 当前源码事实

实施前须以 owning source 重新核对，不用旧文档数字覆盖当前源码：

| 事实 | 当前位置 | 当前结论 |
| --- | --- | --- |
| Web 配置 | 两个 `ui/integration/*/package.json` | 已有相同形状的 `terminalSurfaces`：landscape `PRIMARY=1280×800`、`SECONDARY=960×540`，portrait `PRIMARY=360×640` |
| Web parser | 两个包的 `src/application/terminalSurfaces.ts` | 已有 `TerminalSurfaces`、`getSurfaceDeclarations(surfaces, surfaceForm)` 和本包默认对象 |
| integration factory | `sample-console/src/assembly/assembly.tsx:48-77`、`sample-wallpaper-console/src/assembly/assembly.tsx:27-56` | input 无覆盖字段，分别在第 77/56 行固定选择本包默认值 |
| Android App | 两个 `assembly/android/*/package.json` | 当前没有 `terminalSurfaces` |
| Android factory | 两个 Android App 的 `src/assembly/platformPorts.ts` | 当前不传 surface 配置，实际跟随 integration 默认值 |
| Web wrapper | 两个 integration 的 `test-expo/App.tsx` | 已把 integration 默认对象传给 `createTestExpoApp`，本批不改 |
| shared consumer | `ui/base/console-assembly/.../consoleAssembly.tsx`、`ui/base/render/.../surfaceHost.ts` | `surfaceDeclarations` 是逻辑 canvas；host measurement 是另一条事实链 |
| JSON 导入 | 两个 App `tsconfig.json` 及 base/Expo 配置 | 已继承 `resolveJsonModule`，不需修改 tsconfig |

## 2. 方案与数据流

### 2.1 一个对象、一个覆盖点

每个 package 只有一个 `terminalSurfaces` 对象。两个 integration factory 的 input 各增加：

```ts
readonly terminalSurfaces?: TerminalSurfaces
```

这里的类型复用该 integration 包现有的 `TerminalSurfaces`，不创建 shared parser/type package。
现有选择点改为：

```ts
surfaceDeclarations: getSurfaceDeclarations(input.terminalSurfaces ?? terminalSurfaces, surfaceForm)
```

`??` 是 Dexter 指定的覆盖优先级：调用方传入对象就使用该对象；没有传入就使用 integration
包内默认对象。它不做字段级 merge，也不引入另一套 fallback 治理；最终选择仍只执行一次。

### 2.2 调用方优先级

| 调用场景 | `terminalSurfaces` input | 实际来源 |
| --- | --- | --- |
| Web `test-expo/App.tsx` | 省略，保持现状 | 对应 integration 的默认对象 |
| 未传覆盖值的其他 integration 调用方 | 省略 | 对应 integration 的默认对象 |
| Android `sample-terminal` | 传本 App `package.json` 的整份对象 | `assembly/android/sample-terminal/package.json` |
| Android `sample-wallpaper-terminal` | 传本 App `package.json` 的整份对象 | `assembly/android/sample-wallpaper-terminal/package.json` |

Android 不预先按 `surfaceForm` 选出某个声明，而是把整份对象传给对应 integration 工厂；
`surfaceForm` 的选择继续只在现有 `getSurfaceDeclarations` 中执行。这样既不复制选择逻辑，
也不改变 `tools/terminal-sample2/run-a9-runtime.mjs` 对该选择路径的变异方式。

### 2.3 Android 初始值

两个 Android App 的新增字段先复制当前对应 Web integration 的值：

```json
{
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
}
```

这是迁移保真值，不是 Web 与 Android 永久相等约束。实施前若 Web 当前值已改变，以当前源码
重建保真副本，不用旧数字覆盖。

## 3. 精确改动落点

### 3.1 integration assembly

- `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`：在
  `SampleAssemblyInput` 增加可选 `terminalSurfaces?: TerminalSurfaces`，将第 77 行改为
  `getSurfaceDeclarations(input.terminalSurfaces ?? terminalSurfaces, surfaceForm)`；
- `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`：在
  `WallpaperConsoleAssemblyInput` 增加同名可选字段，将第 56 行改为同样的覆盖表达式。

类型从各自现有 `../application/terminalSurfaces` 导入。两个包已有的
`readTerminalSurfaces`、`getSurfaceDeclarations`、`terminalSurfaces` 和公开导出不增不减。

### 3.2 Android platform factory

分别修改：

- `apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts`；
- `apps/terminal/assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts`。

每个文件静态导入本包 `../../package.json`，并在对应 integration factory 的 input 中增加：

```ts
terminalSurfaces: packageJson.terminalSurfaces
```

传入整份对象，不在 Android 侧调用 `getSurfaceDeclarations`，不读取 matching integration 的
package JSON，不从 host measurement 生成或覆盖逻辑 canvas。两个 App 的 `App.tsx`、tsconfig、
native adapter 和 `assembly/base/android` 不改。

### 3.3 README

四个目标包各补一句覆盖语义：integration README 说明本包 JSON 是预览默认值、调用方传入时
assembly 使用传入对象；Android README 说明本 App JSON 会由 `platformPorts.ts` 整份传入，
并强调这是逻辑 canvas 而非物理 host measurement。不在 README 承诺失败页或 static 治理门。

## 4. 验证设计

以下是未来实施后的最小验证，本次文档修订不执行：

### 4.1 四包 typecheck

```text
yarn --cwd apps/terminal/ui/integration/sample-console typecheck
yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console typecheck
yarn --cwd apps/terminal/assembly/android/sample-terminal typecheck
yarn --cwd apps/terminal/assembly/android/sample-wallpaper-terminal typecheck
```

这证明可选 input、JSON import 和现有调用在当前类型配置下闭合；不新增 tsconfig。

### 4.2 两个 integration owned tests

只在以下现有 assembly 测试各加一个用例：

- `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`；
- `apps/terminal/ui/integration/sample-wallpaper-console/test/sample2Assembly.test.tsx`。

用例传入一份与包内值不同的合法 sentinel，按该用例的 `surfaceForm` 断言
`assembly.surfaceDeclarations` 等于传入对象中被选出的声明。如果 factory 忽略 override 而
继续读取 package 默认值，断言必须失败。不新建 Android test harness。

```text
yarn --cwd apps/terminal/ui/integration/sample-console test
yarn --cwd apps/terminal/ui/integration/sample-wallpaper-console test
```

### 4.3 既有 terminal static

```text
yarn --cwd apps/terminal verify:static
```

不新建 surface checker，不把字段存在性、关键词或行数检查冒充语义证明。若既有 static 因
真实 package/invariant 关系要求同步资料，只修改现有 gate 所需登记，不恢复 v1 控制面。

### 4.4 不需要的证据

Android 初始值与当前 integration 值相同，本批不需要运行期观察。不执行 Web、Metro、Android、
设备、DEV、seed、UAT、部署、release 或 visual 观察，也不把 typecheck、owned tests 或
terminal static 说成 runtime PASS。

## 5. 清理与可能作废文件

本次 v1 只写过文档，v1 计划中的新源文件原则上不存在，不应凭路径删除文件。未来实施时，
主 agent 必须先以当前源码和引用扫描确认：

- 不创建 `ui/base/render/src/foundations/terminalSurfaces.ts` 或其他 base parser；
- 不创建 Android loader、vitest 配置、Android surface 测试基建或 tsconfig 改动；
- 不创建 `tools/terminal-surface-config` 或 AST checker；
- 若工作区已有明确由 v1 实验产生的上述临时文件，先核对引用和归属，再在同一实施批次删除并
  确认无 import；不得删除既有 integration parser、有效测试或无关文件；
- 清理后四个 README、package JSON、现有 invariants 和实际 exports 保持一致。

清理是独立结果，不升级为业务或运行期 PASS；本次文档修订不执行源码删除。

## 6. 首轮 findings 逐条处置

以下完全按评审文件 §4 的去向记录：

| Finding | 本版处置 | 详设落点 |
| --- | --- | --- |
| S-1 注入点放到平台宿主 | 由 M-1 最小方案取代；只保留 Android factory 的可选覆盖传递 | §2.2、§3.2 |
| S-2 非法配置不走失败页 | 撤回；非法开发配置由开发人员承担 | §0.3、§4.4 |
| S-3 dev-host 第三份 schema | 撤回并列为范围外；Web 预览链路不改 | §0.3、§2.2 |
| S-4 AST 门只是形状匹配 | 并入 M-1；不需要专用 AST 门 | §0.3、§4.3 |
| S-5 A9 runner 变异失效 | 按 N-2 处置；Android 传整份对象，选择仍在 integration 函数中 | §2.2 |
| S-6 B2/B3 编译断开 | 撤回；可选字段不会令既有调用方断编译，不拆 B0–B4 | §2.1、§7 |
| N-1 兼容导出 | 撤回；不增删现有导出 | §3.1 |
| N-2 base 重定义类型 | 撤回；不迁移 parser/type | §0.3、§2.1 |
| N-3 Android tsconfig 多余 | 保留为注意项；复用继承的 `resolveJsonModule` | §0.3、§3.2 |
| N-4 Web canvas 与模拟 host 同源 | 撤回；不改 Web 预览或 host measurement | §0.3、§2.2 |

当前评审结论为 `NO-GO / 1M / 0S / 2N`；M-1 的六步最小方案已替代 v1 的必填、fail-closed、
base parser、App loader、AST 门和多批次方案。

## 7. 设计收口条件

未来实施完成后，只有同时满足以下条件，才能说本项实现材料可交复核：

1. 两个 Android App 有与当前 Web 形状一致的 `terminalSurfaces`，初始值不造成画面漂移；
2. 两个 integration factory 的覆盖字段可选，且 `input.terminalSurfaces ?? terminalSurfaces`
   的行为实际生效；
3. 两个 Android `platformPorts.ts` 只静态读取本 App `../../package.json`，传整份对象，
   不预选、不读取 integration 配置；
4. Web wrapper、`ui/base/dev-host`、物理 host measurement 和既有 exports 未被无关改动；
5. 两个 integration override 用例、四包 typecheck 和既有 terminal static 按 `§4` 通过；
6. README 与可能作废文件清理按 `§3.3`、`§5` 完成；
7. 以上结果不被表述为 Android/Web/runtime、visual、release、cleanup 或整体 acceptance PASS。

## 8. 授权边界

本详设只授权作为后续实施输入的文档设计，不授权当前修改源码、测试、依赖、脚本或构建产物，
也不授权 Web、Metro、Android、DEV、seed、UAT、部署或 Git。是否直接进入实施及实施后的动态
验证范围，均由 Dexter 另行决定。

