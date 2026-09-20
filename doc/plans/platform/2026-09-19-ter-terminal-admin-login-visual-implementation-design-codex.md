# TER terminal admin login 主题化视觉 implementation-facing 详设

```text
SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
BUSINESS_SOURCE=doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md#J-02
JOURNEY_REFS=doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md#J-02,J-03,J-06
IA_REF=doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-ia-design-codex.md
INTERACTION_REF=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md
AUTHORIZED=仅设计 admin console 登录弹层的主题化视觉、primitive 承接和验证计划；产出文档并交 Dexter/Claude review
NOT_AUTHORIZED=Web、Metro、Android、设备、DEV、seed、UAT、部署或 Git；实现授权由 Dexter 后续单独给出
IMPLEMENTATION_AUTHORITY=DEXTER_GRANTED_2026-09-19
IMPLEMENTATION_STATUS=CODE_AND_FOCUSED_EXECUTION_COMPLETE_REVIEW_PENDING
INDEPENDENT_DESIGN_REVIEW=OPEN_NOT_RUN_IN_THIS_TURN
```

> 这是一份局部视觉详设，不是 admin console 全量重做方案。用户已经接受本批线框方向；实现授权已于
> 2026-09-19 由 Dexter 给出。本文件仍只定义设计边界，源码结果与证据以 implementation review handoff 为准。

## 0. 设计边界与当前源码事实

### 0.1 真正要解决的问题

当前 `AdminLogin` 的登录行为已经成立，但密码显示是 `PrimitiveGrid` 加 `PrimitiveText` 手工拼出的
`•`/`○` 字符，不是六个有明确尺寸、焦点和主题语义的输入格。结果是：

1. 六位输入在 Web、Android、mobile、laptop 上缺少稳定的方形视觉层级；
2. login 组件无法表达当前输入格、已填格、错误态之间的视觉差异；
3. shared `admin-shell` 若写死青色，会把两个 integration 的应用身份颜色收进 base，破坏 theme owner 边界。

不解决的后果是用户仍能完成操作，但登录弹层在不同 integration 下既不统一结构，也不能正确表达各自应用
主题；维护者还会继续在业务组件内手搓 cell 样式。

### 0.2 当前事实（按源码，不按聊天摘要）

| owner | 当前事实 | 本批处置 |
| --- | --- | --- |
| `ui/base/admin-shell` | `AdminLayer` 挂载 `AdminLogin`，login 自己使用 `useInputField`，虚拟键盘配置为 `keyboardPlacement: 'surface'`。 | 保留全部输入、focus、layer、认证和 testID 行为，只改呈现组合。 |
| `ui/base/input` | `useInputField`/`InputController` 是 native-less field 与 shared virtual keyboard 的 owner。 | 不新增 controller、keyboard 或 native `TextInput` 路径。 |
| `ui/base/primitives` | `PrimitiveCodeInput` 当前只是带 `secureTextEntry` 的 `PrimitiveInput`；已有 `PrimitiveContainer`、`PrimitiveButton`、`PrimitiveGrid` 等通用 primitive。 | 新增通用、无业务词汇的 `PrimitivePinInput`，保留 `PrimitiveCodeInput` 原语义不变。 |
| `ui/integration/sample-console` | 在 assembly/test-expo 中导入自己的 `theme/global.css`，action 当前是深色值；装配共享 `adminShellAssembly`。 | 只补本批 primitive 所需 semantic token，保持 action 与业务主题不变。 |
| `ui/integration/sample-wallpaper-console` | 在 assembly/test-expo 中导入自己的 `theme/global.css`，action 当前是红色值；同样装配共享 admin shell。 | 同样补 semantic token，focus 取本应用红色主题，不复制 login。 |
| `assembly/android/sample-terminal` | `App.tsx` 和 Metro 指向 `sample-console` 的 theme；只做 Android 入口与 platform binding。 | 不改。 |
| `assembly/android/sample-wallpaper-terminal` | `App.tsx` 和 Metro 指向 `sample-wallpaper-console` 的 theme；只做 Android 入口与 platform binding。 | 不改。 |
| `ui/base/console-assembly` | 汇总 `adminShellAssembly.parts`，生产 surface 使用 `AdminLauncher`。 | 不改装配、catalog、part、layer 或 launcher。 |

### 0.3 依赖关系正本

```text
Android App/Metro
  └─选择一个 integration 及其 theme/global.css
       └─integration assembly
            └─ui.base.console-assembly
                 ├─adminShellAssembly.parts + AdminLauncher
                 └─ui.base.admin-shell/AdminLayer/AdminLogin
                      ├─ui.base.input：field/controller/virtual keyboard
                      └─ui.base.primitives：semantic tokens + PrimitivePinInput
                           └─RN/NativeWind vendor slots
```

所有权必须保持：

- Android assembly 只选择 integration/theme，不拥有 admin UI；
- integration 只拥有应用主题值与业务 assembly，不复制 admin login；
- console assembly 只拥有共享 admin shell 的装配接线，不拥有颜色值；
- admin-shell 拥有登录弹层的结构、文案、认证状态呈现和 testID，不 import 任一 integration；
- input 拥有输入焦点与虚拟键盘，不拥有 login card 视觉；
- primitives 拥有无业务词汇的通用 cell、布局和 semantic recipe；
- `package.json`、`src/dependencies.ts`、theme 导出和 `AdminLauncher` 的既有关系保持不变。

## 1. 真实用户目标与方案比较

用户目标是：进入共享终端 admin console 后，能一眼看出六位口令输入进度、当前焦点和错误状态，
同时 `sample-console` 与 `sample-wallpaper-console` 的登录框分别呈现各自 integration 的主题。
这里不改变“怎样打开 admin”“怎样弹出虚拟键盘”“怎样验证密码”。

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A. 在 `AdminLogin.tsx` 写死青色、尺寸和 RN `View/Text` | 视觉能变好，但 shared base 持有应用身份色，且又产生一条绕过 primitives 的控件路径。 | 拒绝：owner 方向错误、无法保证两个 integration 的主题隔离。 |
| B. 每个 integration 各自复制一份 AdminLogin 或传一整套颜色对象 | 每个应用能调色，但登录行为、testID、输入焦点和错误态会分叉。 | 拒绝：复制 login 与第二输入/认证路径的漂移风险大于收益。 |
| C. shared `PrimitivePinInput` + base semantic recipes，integration 只提供语义 token 值 | 结构和输入行为共用，应用色由 integration theme 决定；Android/Web 都沿用当前 theme 入口。 | **采用。** |

我选了 C 而不是 A/B，因为它把“结构/行为共用”和“应用身份颜色归 integration”分开，改动最小，
还能让未来其它 integration 复用通用 PIN 展示而不复制 admin console。

## 2. 目标视觉契约

以下内容与 `2026-09-19-ter-terminal-admin-login-visual-ia-design-codex.md` §2.1–§2.3 逐字对账。

### 2.1 结构与尺寸

- 根仍是 `PrimitiveCenter`，保留现有 `flex: 1; minHeight: 0; padding: 24` 的 layer frame；不新增
  屏幕背景或业务 canvas 设计。
- 卡片仍是 `PrimitiveContainer testID="terminal.admin:login:card" layout="card" bounded`，并由
  `AdminLogin` 显式传入新增的可选 `elevated` prop；该 prop 只给登录卡启用层级、圆角、边框与跨平台
  shadow recipe，`PrimitiveContainer` 的默认 `card` recipe 保持不变。
- 内容顺序固定为标题、说明/可选 debug password、六格 PIN、既有状态提示、验证/关闭动作。
- 六格始终恰好六个，宽度等分可用内容宽度，gap 可在窄屏收缩，`aspectRatio: 1` 保证每格是正方形；
  不使用字符宽度或平台默认 input 高度推导格子大小。
- 六格、状态提示和两个按钮必须在卡片内容宽度内；不新增第二个 ScrollView。虚拟键盘继续由 surface
  owner 处理，login card 不手动 lift 或自绘 keyboard。

### 2.2 六格状态

| 状态 | cell 呈现 | 行为来源 |
| --- | --- | --- |
| 空 | 六个空方格；不显示 `○` 或占位符号 | `password.length === 0` |
| 部分输入 | 已填格显示 `*`，未填格为空 | `useInputField().inputProps.value` |
| 输入焦点 | 当前 focus index 的边框/焦点环使用 `focus` semantic token | `useInputKeyboardState().activeFieldId` |
| 六位完成 | 仍显示六格 `*`；最后一格保持焦点反馈直到 field 失焦 | 同一 field/keyboard state；verify enabled 规则不变 |
| 口令错误 | 保留既有 `PrimitiveStatus tone="error"` 和 error testID；cell 可附加 error border，但不能吞掉错误文案 | `AdminLogin` 的既有 `error` state |
| 时钟不可用/身份降级 | 保留现有 status 文案与 debug password 语义；不伪造新的 disabled 业务态 | 既有 `clockUnavailable`/identity facts |

遮罩符号只允许 `*`。真实口令仍只存在于 input owner 的字符串状态，cell 的 `Text` 不可读出数字。

### 2.3 主题 token 合同

本批新增三个 semantic token，两个 integration 必须同时提供同名 CSS var 与 Tailwind mapping：

| token | 用途 | sample-console 建议值 | sample-wallpaper-console 建议值 |
| --- | --- | --- | --- |
| `surface-elevated` | 登录卡片背景语义 | 继承当前白色 surface 语义 | 继承当前白色 surface 语义 |
| `surface-inset` | PIN 格内底色 | 浅 slate 中性色 | 浅 rose/应用中性色 |
| `focus` | PIN 当前格的边框/焦点环 | 该应用的 action/info 家族 | 该应用的 action 红色家族 |

建议 RGB 只作为各 integration 的主题实现细节，不得进入 `AdminLogin`、`PrimitivePinInput` 或
`ui/base/primitives` 的 token 文件。实现时保留两个 integration 已有 action 值；focus 必须与自身 theme
相容，不能两包复制同一个固定“TER 青色”。主题 test 只验证 token 存在、映射完整、两个 integration
允许有不同值；focus 与其 surface/border 的可读差异属于 visual/Claude review 观察，不由 focused
结构测试以“token 不相等”冒充证明，也不在本批冻结统一 RGB、色差或对比度阈值。

### 2.4 Primitive 公共面

不要把现有 `PrimitiveCodeInput` 改成两种含义。它继续表示安全的真实 `PrimitiveInput`。新增通用：

```ts
export type PrimitivePinInputProps = PrimitiveAddressableProps & Readonly<{
  readonly accessibilityLabel: string
  readonly value: string
  readonly length: number
  readonly maskCharacter?: string // default '*'
  readonly focusedIndex?: number
  readonly invalid?: boolean
  readonly disabled?: boolean
  readonly onPress?: () => void
  readonly onTouchEnd?: (event: PrimitivePinInputInteractionEvent) => void
  readonly onClick?: (event: PrimitivePinInputInteractionEvent) => void
}>
```

其中 `PrimitivePinInputInteractionEvent` 只包含呈现节点需要转交的
`stopPropagation(): void`。`onTouchEnd` 用于 native，`onClick` 用于 browser；两者都是调用方提供的
通用事件透传，不把 surface-dismiss、input controller 或 `ui.base.input` 语义带进 primitive。

实现约束：

- `PrimitivePinInput` 是 presentation/composite primitive，不持有 state、store、command、认证算法或 keyboard；
- `onPress` 只把真实按压交回 owner，`AdminLogin` 仍调用既有 `field.focus()`；
- root 必须透传 owner 提供的 `onTouchEnd`/`onClick` 事件守卫；`AdminLogin` 保留现有
  `event.stopPropagation()` 语义，native/browser 分别沿用 `VirtualKeyboard` 的事件选择，防止 PIN 交互冒泡到
  `InputSurfaceFrame` 的 surface dismiss；primitive 不知道该守卫为何存在；
- public root 是真实 `Pressable`，六个 cell 是真实 View/Text 节点，全部通过内部 token recipe 渲染；
- root 使用 `testID` 与 `accessibilityRole="button"`，cell 使用现有 `terminal.admin:password:digit:<index>`
  由调用方传入的稳定 testID 构造；primitive 不生成业务 testID；
- `length` 必须大于 0，展示数量严格等于 `length`；admin login 传 `6`；
- `value` 超过 `length` 时只按 owner 已校验的前 `length` 位呈现，不能把该 primitive 变成第二个校验器；
- focused/invalid/disabled 只影响 presentation 和 accessibility state，不影响 field/keyboard 行为；
- `aspectRatio: 1` 与 `flex`/`minWidth: 0` 共同保证 mobile/laptop 方形，不用 consumer 传 platform style；
- 不增加 workspace/runtime 依赖，`src/index.ts`、`terminal-invariants.json`、README 与测试同步更新。

### 2.5 Card 阴影与主题边界

阴影是 primitives 的跨平台呈现 recipe，不把某个 app 的色值带入 base。实现应优先使用当前 RN/NativeWind
支持的 `boxShadow`/语义 shadow recipe；若某平台不支持同一 shadow 属性，保留 border + elevated surface 的
可读 fallback，不引入 platform-specific `elevation` 分支到 `AdminLogin`。本批不改 admin layer backdrop、
业务 wallpaper 或已认证 admin shell 的背景。

## 3. 横切机制对照表

| 机制 | ① 现成能力/规范 | ② 如何验证 | ③ 无现成时的形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | `AdminLayer.tsx` 的 runtime facts/input props；`admin-shell` 既有 owner 边界 | 静态确认 `AdminLogin` 无 store/port/integration import；focused 保持既有 login flows | N/A：无新增读取 | AdminLogin |
| 写授权与 grant 复核 | 既有 `onAuthenticated`/`onClose` 回调 | focused 触发 verify/close，确认回调路径未变 | N/A：无业务写 | AdminLogin actions |
| 跨 owner 写与事务 | N/A：本批无服务端和跨 owner 写 | 静态确认无 command/state/platform port 新增 | N/A | 全部本批文件 |
| 集合形态与分页 | `PrimitivePinInput.length` 是固定 bounded presentation | focused 传空/部分/六位，断言格数严格为 6 | N/A：无集合读取 | PIN cells |
| 缓存失效 / 改完刷新什么 | N/A：纯呈现改动 | 静态确认无 query/cache/refresh import | N/A | 全部本批文件 |
| RTK 数据读取与加载判定 | N/A：TER 不使用 RTK | 静态确认无 RTK 依赖 | N/A | 全部本批文件 |
| 同一事实只有一个住址 | `ui.base.input` 的 password string 是唯一事实；primitive 只读 props | focused 修改 shared keyboard，cell 与 verify 仍读同一 value | N/A：不新增 state | AdminLogin + PrimitivePinInput |
| 失败可见且原因不得改写 | `PrimitiveStatus`、现有 error/clock/fallback testID | focused 保留口令错误、时钟不可用、identity fallback 文案 | N/A：不新增 problem | AdminLogin status states |
| owner 错误到 HTTP 映射 | N/A：无 HTTP | 静态确认无 HTTP import | N/A | 全部本批文件 |
| 幂等键与重放 | N/A：无 command/HTTP | 静态确认无 command/transport import | N/A | 全部本批文件 |
| 生成物不得手搓字符串 | N/A：无 generated contract | 静态确认无契约字面量新增 | N/A | 全部本批文件 |
| 日志与脱敏 | `AGENTS.md`；login 不新增日志 | 静态确认不记录 password、debug password、token 或 raw input | N/A：不加诊断面 | AdminLogin/PrimitivePinInput |
| 迁移回填与可逆性 | N/A：无数据/迁移 | 静态确认无 migration/seed | N/A | 全部本批文件 |
| 前端共享行为 | `ui.base.input` 的 focus/keyboard 与 primitives 的 testID/token seam | focused/static 对照 AdminLogin、InputController、PrimitivePinInput；不出现第二 keyboard | 新增 primitive 只能是无业务呈现组合 | AdminLogin、primitives、input consumer |
| 管理后台交互一致性 | 终端正本 `doc/platform/terminal-coding-standard.md` TR-13；既有 terminal interaction artifact | 静态逐控件核对位置、testID、焦点、失败/关闭恢复；不套用 Web admin §3-K | N/A：TER terminal，不是 platform-admin/operations-admin | 登录 layer |
| 候选/下拉数据源 | N/A | N/A | N/A | N/A |
| 编码与名称呈现 | N/A：login 无编码/名称集合 | N/A | N/A | N/A |
| 会同时坏的东西原子组 | primitive public API + token mappings + AdminLogin consumer + focused tests | 逐代码对账；缺一项则设计未闭合 | 原子组不得拆成只改 consumer 或只改 theme | `ui/base/primitives`、`ui/base/admin-shell`、两个 integration theme/test |

## 4. CP 总览与每个 CP 的门

| CP | 主题 | owner | 输出 | 依赖 |
| --- | --- | --- | --- | --- |
| CP-0 | 复核关系与公共面 | 主 agent 文档/源码对账 | 当前事实、完整改动分母、无 scope drift 证明 | 本详设、既有 Journey/IA/interaction |
| CP-1 | primitive 与 token recipe | `ui/base/primitives` | `PrimitivePinInput`、elevated card recipe、semantic token 公共面与 focused proof | CP-0 |
| CP-2 | integration theme 映射 | 两个 integration theme owner | 两套 CSS vars/Tailwind 映射/theme tests | CP-1 |
| CP-3 | AdminLogin consumer | `ui/base/admin-shell` | 六格登录视觉接线；既有输入/认证/关闭行为保持 | CP-1、CP-2 |
| CP-4 | 对账与 review package | 主 agent | focused/static 结果、逐代码与详设对账、Claude handoff | CP-3 |

### CP-0

- 可证伪失败：改动清单出现 `assembly/android`、业务 feature、`console-assembly` 的生产改动，或
  `AdminLogin` 直接 import integration/theme/RN 绘制节点。
- 不变量：theme 只在两个 integration 声明；login 只在 admin-shell；通用 cell 只在 primitives；input
  owner 不变。
- FORBID：新增 Journey、复制 AdminLogin、改变 keyboard placement、改业务背景、改认证算法。
- 最低验证：静态 `rg` import/dependency/source readback；不运行 Web/Android。
- 形态理由：先锁 owner，避免先写漂亮样式再发现颜色和行为放错层。

### CP-1

- 可证伪失败：空实现仍只渲染 `PrimitiveText` 字符、cell 没有 `aspectRatio: 1`、filled cell 不显示 `*`、
  primitive 触碰 state/keyboard/command，或 public export/invariant/README 不同步。
- 红变异：把 `maskCharacter` 改成 `•`、删除 `aspectRatio`、删除 `onTouchEnd`/`onClick` 事件透传、把
  `PrimitivePinInput` 改为新建 input controller；focused/structural proof 必须变红。
- 负控制：合法 `length=4` generic consumer 可以得到四个方格，且 primitive 不要求 admin/password 领域字段。

### CP-2

- 可证伪失败：任一 integration 缺少 `surface-inset`、`surface-elevated` 或 `focus` CSS var/Tailwind mapping，
  或两包 action/theme 值被误合并成共享硬编码值。
- 红变异：删除 wallpaper 的 `focus` mapping，或把两个 theme 的 `focus` 强制成同一固定青色；各自 theme test/static
  review 必须发现。
- 负控制：两个 integration 可以声明不同 focus 值，且既有 action/error semantic token 保持原值。

### CP-3

- 可证伪失败：`AdminLogin` 仍用 `•`/`○`，没有把现有 `field.focus()` 接给真实 PIN root，或 verify/close/error/debug
  password 行为改变。
- 红变异：把 cell value 改为第二个 local state、删掉 `onPress={focusPassword}`、把 close 回调移出既有 layer；
  admin-shell/sample-console focused proof 必须变红。
- 负控制：六位输入、错误口令、时钟不可用、identity fallback 和关闭恢复均继续通过。

### CP-4

- 可证伪失败：只跑 primitive test 却没有两个 integration theme mapping proof，或只看测试名/退出码而没有真实
  render tree 与 semantic token 断言；逐代码与详设对账有 OPEN 仍声明 ready。
- 红变异：删掉一个 integration 的新 token mapping、把 AdminLogin 加入 integration import、把测试期望改回 `•`；
  对应 static/focused proof 必须变红。
- 最低验证：四个受影响 workspace 的 typecheck/owned test、terminal static；不启动 Web/Metro/Android。

## 5. 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| admin login structural layout | `ui/base/admin-shell/src/components/AdminLogin.tsx` | JSX props → primitives | `PrimitiveContainer`/`PrimitivePinInput` | admin-shell focused render tree |
| password value | `ui/base/input` field registration | `field.inputProps.value` → `AdminLogin` → `PrimitivePinInput.value` | six cells and existing verify guard | focused same-value assertion |
| theme identity | each integration `theme/global.css` | CSS var → integration Tailwind config → primitive semantic class | card/cell/focus/button | each integration theme test + static no hard-coded color |
| integration selection | each Android `App.tsx`/Metro and each `test-expo/App.tsx` | selected integration imports its own CSS | same shared admin-shell render | static package relation readback |
| login entry/layer | `console-assembly` `adminShellAssembly`/`AdminLauncher` | assembly parts + launcher → production surface | `AdminLayer`/`AdminLogin` | existing assembly focused test; no new path |
| failure/error presentation | existing `AdminLogin` error state | local state → `PrimitiveStatus` | error/clock/fallback nodes | existing password focused tests |

## 6. 文件与改动分母

### 6.1 必改（实施授权后）

| 文件/目录 | 改动 |
| --- | --- |
| `apps/terminal/ui/base/primitives/src/types/types.ts` | 增加 `PrimitivePinInputProps` 及 presentation-only state 类型。 |
| `apps/terminal/ui/base/primitives/src/components/PrimitivePinInput.tsx`（新） | 六格方形、mask、focus/invalid/disabled、真实 Pressable 节点，以及 owner 事件守卫透传。 |
| `apps/terminal/ui/base/primitives/src/components/PrimitiveContainer.tsx`、`src/types/types.ts`、`src/theme/tokens.ts` | 增加可选 `elevated` prop 与只表达呈现层级的 elevated card recipe；不改变默认 card。 |
| `apps/terminal/ui/base/primitives/src/index.ts`、`terminal-invariants.json`、`README.md` | 同步 public export、测试 owner、中文用法。 |
| `apps/terminal/ui/base/primitives/test/primitives.test.tsx` | primitive 状态、格数、方形 token、mask 和 owner 事件透传的 focused 覆盖；不把无障碍作为本批验收维度。 |
| `apps/terminal/ui/base/admin-shell/src/components/AdminLogin.tsx` | 移除手工 `Pressable`/`PrimitiveGrid`/字符 cell，接 `PrimitivePinInput`；保留所有 input/认证/状态行为与 surface-dismiss 冒泡守卫。 |
| `apps/terminal/ui/base/admin-shell/test/adminLoginVisual.test.tsx`（新）或等价现有 owner test | 真实 AdminLogin render tree、focus 回调、surface-dismiss 守卫、6 格与现有状态断言。 |
| `apps/terminal/ui/integration/sample-console/theme/global.css`、`tailwind.config.cjs`、`test/theme.test.ts` | 增加并验证三个 semantic token，保留当前 action 主题。 |
| `apps/terminal/ui/integration/sample-wallpaper-console/theme/global.css`、`tailwind.config.cjs`、`test/theme.test.ts` | 同上，但 focus/value 按 wallpaper theme，不复制 sample-console 值。 |
| `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx` | 将当前已填 cell 的现有期望从 `•` 对齐到 `*`，并保留真实 assembly 入口。 |

### 6.2 只读核对、不改

`apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx`、两个 integration 的
`src/assembly/assembly.tsx`、两个 Android `App.tsx`/`metro.config.js`、`ui/base/input` 的 field/keyboard
实现、既有 Journey/IA/interaction 文件。若实施中这些文件出现改动即 scope drift，必须停在 CP-0 重新核对。

### 6.3 明确不做

- 不改两个 Android App 的 `App.tsx`、Metro、原生 splash、application icon 或 surface 配置；
- 不改 integration 业务 feature、wallpaper、member、topology、admin 已认证 section；
- 不把 theme 迁移到 base，不建共享 theme 包，不让 admin-shell 依赖 integration；
- 不新增登录 backend、网络请求、密码算法、store、command、日志或 debug 开关；
- 不改 shared virtual keyboard 的布局、宽度、弹出位置或输入焦点机制；
- 不将用户批准的视觉图伪装成 Web/Android/visual acceptance 证据。

## 7. 可执行验证与证据档位

设计阶段的默认结果为 `OPEN / NOT_RUN`；当前实施结果只在 implementation review handoff 中登记，不能把
focused/static 结果升格为 visual、Web、Android、release 或 acceptance PASS。

| 目标 | 执行体 | 最低档位 | 红变异 |
| --- | --- | --- | --- |
| primitive public surface | primitives `index.ts` + `terminal-invariants.json` + public-surface test | static/focused | 删除 export 或 invariant 条目 |
| 六格与 mask | `PrimitivePinInput` focused render test | focused | `•`、`○`、长度 5/7、删 square style |
| focus/invalid/disabled | primitive focused test + real `AdminLogin` render | focused | focus index 不变、error tone 丢失、disabled 仍可 press |
| elevated card isolation | `AdminLogin` render 与全量 `layout="card"` production consumer source/render readback | focused/static | 把 elevated 默认施加到 `PrimitiveContainer` 的所有 card consumer，登录卡或其它七个 card consumer 的结果不符合预期 |
| surface-dismiss guard | AdminLogin/InputSurfaceFrame focused interaction test；native `onTouchEnd` 与 browser `onClick` 两个入口 | focused；若测试环境不能证明真实冒泡则转设备观察并保持 OPEN | 删除 PIN root 的事件透传后，点击 PIN 区导致 active field/keyboard 被 surface dismiss |
| 单一输入 owner | `AdminLogin`/input focused test + source scan | focused/static | 新增 local password state 或第二 keyboard |
| sample-console theme | `test/theme.test.ts` + render tree class assertions | focused/static | 删除新 CSS var/mapping；把 AdminLogin 写死色 |
| sample-wallpaper theme | `sample-wallpaper-console/test/theme.test.ts` + same render proof | focused/static | wallpaper mapping 缺失或与 sample theme 偷同值 |
| existing auth/failure behavior | existing `adminPassword.test.ts` + assembly focused tests | focused | 改写 verify guard、error/clock/fallback/close |
| package boundary | `rg`/dependency/source readback | static | admin-shell import integration/theme；assembly 改 UI |
| no business background scope drift | changed-file/readback review | static | 修改 wallpaper/business parts 或 authenticated shell |

视觉“好看”、阴影栅格化和真实 Android/Web 字体抗锯齿不由 focused structural test 宣称通过；若后续获得
visual/Web/Android 授权，需另建相应证据，不得把本批 focused/static 结果升格。

## 8. 逐代码与详设对账要求

实施授权后，CP-0 先以本文件 §6 的完整分母和 §0.3 包关系逐项回读；CP-1/2/3 每个 CP 完成后，先做
focused proof，再由 fresh 只读 reviewer 对照：

1. 本详设与 `2026-09-19-ter-terminal-admin-login-visual-ia-design-codex.md` 的 visible contract；
2. `doc/platform/terminal-coding-standard.md` TR-13 与项目 memory 的 shared admin-console invariant；
3. 当前源码 owner、实际 import、theme load 入口和 testID；
4. 业务背景未改、input owner 未改、Android/Web 入口未漂移。

交付 review 前，主 agent 还要逐行完成“代码 ↔ 详设”对账；任何 OPEN 都只能写 `实施未就绪`。

## 9. 未决与停机

| 项目 | 状态 | 处置 |
| --- | --- | --- |
| 具体 RGB 取值的最终视觉微调 | `OPEN_FOR_CLAUDE_REVIEW` | 保持 semantic token 名与主题 owner 不变；不把青色写进 base。 |
| fresh independent DESIGN review | `OPEN_NOT_RUN_IN_THIS_TURN` | 不冒充已完成；本 handoff 请求 Claude 独立复核。若项目治理要求 fresh 子 agent 先行，须补齐后再宣称设计 ready。 |
| implementation authorization | `GRANTED` | Dexter 于 2026-09-19 授权本设计范围内的源码、测试与 focused/static 验证；Web/Metro/Android/device 仍不在本轮执行。 |

出现下列事实必须停机回 Dexter：需要改 AdminLayer/console-assembly 才能实现 login 视觉；需要改变
virtual keyboard 或认证语义；两个 integration 无法同时提供 semantic token；或用户希望把背景业务画布、
已认证 admin section、Android splash/应用图标纳入本批。

## 10. 设计完成判定

```text
DESIGN_SCOPE=ADMIN_LOGIN_VISUAL_ONLY
PACKAGE_RELATION_READBACK=MATCHED
JOURNEY_REUSE=TERMINAL_ADMIN_CONSOLE_J-02/J-03/J-06
THEME_OWNER=EACH_INTEGRATION
SHARED_LOGIN_OWNER=UI_BASE_ADMIN_SHELL
PRIMITIVE_OWNER=UI_BASE_PRIMITIVES
INPUT_OWNER=UI_BASE_INPUT
IMPLEMENTATION_AUTHORITY=DEXTER_GRANTED_2026-09-19
DESIGN_STATUS=DESIGN_REVIEW_GO;IMPLEMENTATION_REVIEW_PENDING
```
