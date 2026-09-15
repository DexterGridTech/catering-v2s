# TER surface 配置权威分离 · 详设与执行计划评审

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
REVIEW_KIND=Codex 与 Claude 经 Dexter 中转的 review(轮次由 Dexter 决定,AGENTS.md:72)
REVIEW_ROUND=1(仅作序号)
reviewerKind=CLAUDE_DIRECT(按 Dexter 直接要求,本轮不召集 fresh 对抗式子 agent)
EVIDENCE_TIER=static;只读文档与当前源码,未执行任何构建、测试、Web、Metro、Android、DEV 或 git 命令
被审输入(sha256 前缀):
  详设 doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-design-codex.md 047e4e88d274(330 行)
  计划 doc/plans/platform/2026-09-15-ter-surface-config-authority-implementation-plan-codex.md fa1c1a61621f(355 行)
本版=Dexter 2026-09-15 澄清意图后的重评;首轮 0M/6S/4N 已被本版取代,去向见 §4
```

下文路径以 `apps/terminal/` 为根时省略该前缀;`tools/`、`doc/` 与 `node_modules/` 从所在根写。行号为评审时当前字节。

## 0. 结论

```text
VERDICT=NO-GO
M/S/N=1/0/2
M-1=详设与计划的方向与 Dexter 意图相反,属过度设计;最小方案见 M-1
DEXTER_DECISION=无待决项;意图已由 Dexter 在会话中明确(§1)
本结论只判断详设与计划;不构成任何实现或运行档位的 PASS
```

## 1. Dexter 明确的意图(2026-09-15 会话)

> integration 主要是用来做预览,快速变换各种分辨率调整 UI 界面。assembly 才是实际运行包。所以不要过度设计,如果让我自己设计的话,就一个变量来存逻辑分辨率,谁传过来,或谁最后传过来就用谁的。配置非法时,由开发人员自己承担后果。

对评审口径的影响:
- 这是开发期配置,不是业务数据或用户数据。
- "integration 自带默认值、调用方传入即覆盖"正是想要的语义,不是需要消除的"静默回退"。
- 不要求非法配置走失败页、不要求专用校验门。类型检查加一个"覆盖生效"的测试即足够。

## 2. 当前源码事实(仍然成立)

| 事实 | 依据 |
|---|---|
| 两个 Web integration 在自身 `package.json` 声明相同的 `terminalSurfaces`(landscape PRIMARY 1280×800、SECONDARY 960×540;portrait PRIMARY 360×640);两个 Android App 与 `assembly/base/android` 都没有 | `ui/integration/sample-console/package.json:11-30`、`ui/integration/sample-wallpaper-console/package.json:11-30`;两个 App 与 base 的 `package.json` 全文 |
| integration 工厂在内部固定用本包配置,输入类型里没有覆盖入口;Android 工厂也不传,所以 Android 运行时实际用的是 integration 的值 | `ui/integration/sample-console/src/assembly/assembly.tsx:48-57,77`、`ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:27-36,56`;`assembly/android/sample-terminal/src/assembly/platformPorts.ts:9-15`、`assembly/android/sample-wallpaper-terminal/src/assembly/platformPorts.ts:12-18` |
| 该值是逻辑画布:`ConsoleAssembly.surfaceDeclarations` 作为 `SurfaceRoot` 的 canvas,缩放比由 host 测量值除以 canvas 得到 | `ui/base/console-assembly/src/foundations/consoleAssembly.tsx:100,381-386,424`;`ui/base/render/src/foundations/surfaceHost.ts:114-133` |
| 选择逻辑 `getSurfaceDeclarations(surfaces, surfaceForm)` 以参数形式接收配置对象,传入哪个对象就从哪个对象选 | `ui/integration/sample-console/src/application/terminalSurfaces.ts:31-39`、`ui/integration/sample-wallpaper-console/src/application/terminalSurfaces.ts:24-32` |
| Android App 可以直接静态导入自身 `package.json`:App tsconfig 只有 extends,经 base 配置继承 Expo 基础配置,后者已开启 `resolveJsonModule` | `assembly/android/sample-terminal/tsconfig.json:1-3`、`assembly/base/android/config/tsconfig.json:2`、`node_modules/expo/tsconfig.base.json:15`(外部事实:本地安装的 Expo SDK 57) |
| App `package.json` 新增 `terminalSurfaces` 不违反原生投影检查:该检查只禁止 `babel/metro/tailwind/nativewind` 四个字段 | `tools/terminal-sample2/check-native-projection.mjs:380-381` |

## 3. Findings

### M-1 详设与计划的方向与 Dexter 意图相反,属过度设计

- **状态**:CONFIRMED(方案合理性)
- **仓内事实**:
  - 详设 SR-02、SR-03、SR-05、SR-07(:58-63)把目标定为"必填输入、禁止任何回退、非法配置 fail-closed 并走失败页、通用 parser 迁到 base 单一 owner"。
  - 详设 §1.2(:81)明确拒绝方案 D("保留 integration 内部默认,Android override 可选")。而这正是 Dexter 要的"谁最后传过来就用谁的"。
  - 由此展开的变更面(详设 §9b :236-253、计划 B0 至 B4 :74-85)包括:
    - `ui.base.render` 新增 parser 与导出;
    - 两个 integration 的解析器改造与兼容导出;
    - 工厂必填化并迁移全部调用方;
    - 两个 App 新建 loader、vitest 配置与测试,测试归属由 `ABSENT` 改为真实测试;
    - 两个 App 修改 tsconfig;
    - 新建 `tools/terminal-surface-config` AST 门并接入 static 编排;
    - 一套 8 条红变异。
  - 必填化还连带两个副作用:
    - B2 到 B3 之间两个 Android App 编译断开;
    - `tools/terminal-sample2/run-a9-runtime.mjs:85-93` 的变异语义会失效。
- **影响**:为"Android 运行包能用自己的 4 个数字"引入了约 20 个锚点的改动和一个新工具目录,维护成本远高于收益;其中大部分机制(必填、禁回退、fail-closed、AST 门)恰恰是 Dexter 明确不要的。
- **最小方案**(替代详设与计划的全部 CP 与批次):
  1. 两个 Android App 的 `package.json` 增加 `terminalSurfaces`,初始值复制当前值,运行画面不变。
  2. 两个 integration 工厂入参增加**可选** `terminalSurfaces`(类型复用各包已有的 `TerminalSurfaces`)。取值改为 `getSurfaceDeclarations(input.terminalSurfaces ?? terminalSurfaces, surfaceForm)`(sample-console `assembly.tsx:77`、wallpaper `assembly.tsx:56`),即调用方传了就用调用方的,不传用 integration 自己的。
  3. 两个 Android App 的 `src/assembly/platformPorts.ts` 静态导入 `../../package.json`,把其中的 `terminalSurfaces` 传给对应工厂。不改 tsconfig(见 N-1)。
  4. Web 预览(`test-expo/App.tsx`、`ui/base/dev-host`)不改,继续用 integration 自己的值。
  5. 在两个 integration 现有的 assembly 测试(`test/sampleAssembly.test.tsx`、`test/sample2Assembly.test.tsx`)各加一个用例:传入与包内不同的值,断言 `assembly.surfaceDeclarations` 等于按 surfaceForm 从传入值选出的结果。
  6. 两个 App 与两个 integration 的 README 各补一句覆盖语义(TR-10)。
  - 明确不做:base parser 迁移、必填化、App loader 与测试基建、AST 门、fail-closed 失败页机制、兼容导出的增删、批次拆分。
  - 这里的 `??` 是 Dexter 要求的覆盖语义,不是为兼容或测试保留的回退层。
- **为什么这样最小**:
  - 覆盖入口只有一个可选参数,选择逻辑仍在原处。
  - App 传入的 JSON 结构若写错,会在调用点直接类型报错;数值是否合理由开发者负责,符合 Dexter 的口径。
- **验证**:四个包 typecheck;两个 integration 的 owned 测试;既有 terminal static。初始值与现状相同,不需要运行期观察。
- **Dexter**:意图已由 Dexter 明确,不需要再裁决。

### Notes

- **N-1 不需要修改 Android App 的 tsconfig**:`resolveJsonModule` 已经从 `node_modules/expo/tsconfig.base.json:15` 继承(经 `assembly/base/android/config/tsconfig.json:2`)。两份 App tsconfig 还须逐字相同(`tools/terminal-sample2/check-native-projection.mjs:392-398`)。详设 §9b(:246)与计划 B3 第 2 步(:210-211)的这一步应删除。
- **N-2 覆盖时传整份 `terminalSurfaces` 对象,不要传预先选好的声明**:这样按 surfaceForm 的选择只在 integration 现有的 `getSurfaceDeclarations` 里发生一次,预览和运行共用同一条选择路径。它还带来一个好处:`tools/terminal-sample2/run-a9-runtime.mjs:85-93` 通过改写这个函数让 mobile 也拿到 landscape 声明,传整份对象时该变异对 Android 运行时照样生效,runner 不需要改。

## 4. 首轮 findings 的去向

| 首轮 | 本版处置 | 理由 |
|---|---|---|
| S-1 注入点放到平台宿主 | 由 M-1 最小方案取代 | 宿主注入仍是"必填注入"思路,比 Dexter 的可选覆盖更重 |
| S-2 非法配置不走失败页 | 撤回 | Dexter:配置非法由开发人员自己承担 |
| S-3 dev-host 的第三份 schema | 撤回(本批范围外) | 预览链路不改;dev-host 的类型副本是既有状况,与本需求无关 |
| S-4 AST 门是形状匹配 | 并入 M-1 | 最小方案不需要任何专用门 |
| S-5 A9 runner 变异失效 | 由 N-2 解决 | 传整份对象时选择仍经 integration 函数,变异照样生效 |
| S-6 B2 与 B3 编译断开 | 撤回 | 可选参数不会造成调用方编译失败,也不再需要批次拆分 |
| N-1 兼容导出 | 撤回 | 最小方案不增删导出 |
| N-2 base 重定义类型 | 撤回 | 最小方案不迁移 parser |
| N-3 tsconfig 多余 | 保留为本版 N-1 | 仍然成立 |
| N-4 Web 上 canvas 与模拟 host 同源 | 撤回 | 预览链路不改,无需说明 |

## 5. 设计正确性、计划可执行性与仍缺的证据

- **设计正确性**:详设对现状的诊断和逻辑画布的解释是对的(Android 实际跟随 integration、只加字段不改行为、尺寸是逻辑画布、base 不持有 sample 值)。错在目标性质,以"单一权威、禁止回退、fail-closed"为目标,与 Dexter 的"最后传入者生效、非法自负"相反。
- **计划可执行性**:按现计划执行会产出一套 Dexter 明确不要的机制。应改为 M-1 的 6 步小改动,一次完成、一次验证,不需要 B0 至 B4。
- **仍缺的证据**(实施后才有):四包 typecheck;两个 integration 测试里"传入值覆盖包内值"的用例通过;既有 terminal static 通过。

## 6. 方案合理性

- **问题对不对**:Codex 抓住了真实断点,Android 没有自己的入口。但把问题上升成了"权威治理",而 Dexter 要解决的只是"运行包能用自己的逻辑分辨率,预览包继续自由调"。
- **方案优不优**:可选覆盖只动 6 处(2 份 App 配置、2 个工厂各一行、2 个 App 各传一个值),预览链路零改动;原方案要动约 20 个锚点并新建工具目录。
- **代价配不配**:原方案代价远超收益;最小方案与目标相称。

## 7. 授权边界

本评审只读、只针对详设与计划,不授权修改源码、测试、依赖、脚本或构建产物,不授权 Web、Metro、Android、DEV、seed、UAT、部署或 Git 操作。是否按最小方案修订后直接进入实施,由 Dexter 决定。
