---
title: TER terminal admin login 主题化视觉 IA 增补
status: DESIGN_ONLY_PENDING_REVIEW
---

# TER terminal admin login 主题化视觉 IA 增补

> 本文是既有 `TERMINAL_ADMIN_CONSOLE` Journey 的局部 IA/交互增补，不创建新的 Journey，
> 不改变 admin console 的认证、输入、焦点、layer、command 或已认证页面行为。当前任务只覆盖
> admin 登录弹层本身；业务画布、壁纸、会员页、拓扑页和 Android 启动画面不在范围内。

## 1. 工件元数据

```text
IA_SCOPE=TERMINAL_ADMIN_LOGIN_VISUAL
BUSINESS_SOURCE=doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md#J-02
JOURNEY_REFS=doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md#J-02,J-03,J-06
UI_INTERACTION_REF=doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md
IMPLEMENTATION_DESIGN_REF=doc/plans/platform/2026-09-19-ter-terminal-admin-login-visual-implementation-design-codex.md
DEXTER_WIREFRAME_REVIEW=ACCEPTED_BY_CURRENT_REQUEST@2026-09-19
IMPLEMENTATION_AUTHORITY=false
```

路径 `doc/plans/platform/2026-09-11-v2s-terminal-admin-console-ui-interaction-design-codex.md` 是仓内
既有交互工件的实际文件；本增补只覆盖其中 admin login 的视觉部分。既有 Journey 仍是唯一入口，
本增补不把“漂亮登录框”升级成新的业务步骤。

## 2. 视觉与交互事实（与详设逐字对账）

### 2.1 用户任务与入口

| 维度 | 冻结内容 |
| --- | --- |
| `businessTask` | 终端工作人员从既有隐藏入口进入终端管理，输入当日六位动态口令并验证，或关闭登录弹层。 |
| `actorAndScenario` | 已在终端现场操作的工作人员；通过既有 admin launcher 手势到达本地 admin login layer。 |
| `entryAndSurface` | `ui.base.admin-shell` 的 `AdminLayer` 内 `AdminLogin`；现有 `AdminLauncher` 与 layer/focus scope 不变。 |
| `controlType` | 主题化短卡片、标题、说明、六格方形 PIN 展示/聚焦控件、既有状态提示、既有“验证”和“关闭”按钮。 |
| `validationAndError` | 动态口令计算、时钟不可用、设备标识降级和错误口令的业务语义不变；继续使用现有状态 testID 与文案。 |
| `accessibilityAndTestId` | 仍由一个 `ui.base.input` native-less field 持有六位字符串；PIN 展示使用 `adminTestIds.passwordInput` 作为真实可按节点，六个格子保留 `adminTestIds.password:digit:<index>`；遮罩字符是 `*`，不能把真实数字放进可见文本或可访问性值。 |
| `emptyLoadingErrorStates` | 空输入显示六个空方格；部分输入已填格显示 `*`；焦点格显示主题 focus ring；错误/时钟不可用/设备标识降级继续使用现有状态呈现；不新增 loading、重试或第二个输入路径。 |
| `containerBehaviorUnderLoad` | 卡片使用现有 `PrimitiveCenter` + `PrimitiveContainer layout="card" bounded` 结构，并由 `AdminLogin` 显式传入新增的 `elevated` prop；默认 `card` recipe 不改变。登录卡本身不新增滚动容器。六格在可用卡片内容宽度内等宽、保持 1:1 方形并允许 gap 收缩；按钮、状态提示和卡片边界不得横向溢出逻辑画布。虚拟键盘仍由 `keyboardPlacement="surface"` 的既有 surface owner 负责。PIN root 必须透传 owner 提供的 surface-dismiss 冒泡守卫；primitive 不理解 dismiss 业务。 |
| `interactionConsistency` | 以 `doc/platform/terminal-coding-standard.md` 的 TR-13、既有 terminal admin interaction 工件和 `ui.base.input` 的单一输入 owner 为正本；不套用 Web 管理后台的 Ant Design 登录规范。 |

### 2.2 主题契约

admin login 不拥有颜色值。它只消费 primitives 的语义 class/token；颜色由挂载该 integration 的
`theme/global.css` 提供。

| 语义 token | admin login 用途 | 两个 integration 的责任 |
| --- | --- | --- |
| `surface-elevated` | 登录卡片的抬升 surface 语义 | 两个 integration 都必须声明并映射；不得在 `AdminLogin` 或 primitive 中写死青色或白色。 |
| `surface-inset` | 空/已填 PIN 格的内底色 | 两个 integration 都必须声明并映射，可按应用主题不同取值。 |
| `focus` | 当前输入格的边框/焦点环 | 两个 integration 都必须声明并映射；不得在 `AdminLogin` 或 primitive 中写死青色。 |
| 既有 `surface`、`foreground`、`muted-foreground`、`border`、`action`、`action-foreground` | 卡片、文字、边框、按钮和已填状态 | 保持各 integration 的既有语义来源；`sample-console` 与 `sample-wallpaper-console` 的 action 可不同。 |
| 既有 `error-*`、`info-*`、`warn-*`、`ok-*` | 既有状态提示和错误态 | 不复制状态色，不改变现有错误语义。 |

卡片继续由 `PrimitiveContainer layout="card" bounded` 承载，并由 `AdminLogin` 显式传入 `elevated`；
本批只在 shared primitive 增加可复用的 elevated presentation recipe，实际颜色仍由 `surface-elevated`
主题 token 提供；其它 `layout="card"` consumer 不传该 prop，默认 recipe 不变。

`focus` 与相邻格面/边框的可读差异属于视觉观察，不由本批 focused 结构测试宣称通过；当前设计不
冻结统一 RGB、色差或对比度阈值，后续 visual/Claude review 负责观察，不把“两个 token 不相等”当作
可读性证明。

主题映射必须保持这条关系：

```text
assembly/android/sample-terminal
  -> ui/integration/sample-console/theme/global.css
  -> shared NativeWind semantic mapping
  -> ui/base/admin-shell -> ui/base/primitives

assembly/android/sample-wallpaper-terminal
  -> ui/integration/sample-wallpaper-console/theme/global.css
  -> shared NativeWind semantic mapping
  -> ui/base/admin-shell -> ui/base/primitives
```

Web 预览同样由各 integration 的 `test-expo/App.tsx` 导入自己的 theme；不增加第三套 theme 入口。

### 2.3 低保真线框：`terminal-admin-login`

```text
┌────────────────────────────────────────────┐
│                                            │
│          ┌────────────────────────┐        │
│          │  终端管理              │        │
│          │  请输入六位动态口令     │        │
│          │  （调试口令按现有开关） │        │
│          │                        │        │
│          │  ┌──┐ ┌──┐ ┌──┐ ┌──┐  │        │
│          │  │* │ │* │ │  │ │  │… │        │
│          │  └──┘ └──┘ └──┘ └──┘  │        │
│          │  当前格使用 theme.focus │        │
│          │                        │        │
│          │  错误/降级/时钟提示      │        │
│          │                        │        │
│          │  [验证]       [关闭]    │        │
│          └────────────────────────┘        │
│                                            │
└────────────────────────────────────────────┘
```

线框只描述 login layer 自己的 surface。四周业务画布、壁纸、其它 admin section 不属于本 screen，
不在本线框内重新设计。卡片阴影是 primitive 的跨平台呈现 recipe，不是某个 integration 的固定青色或
业务背景样式。

## 3. 不可见维度（可执行观察）

| 维度 | 观察与最低证据档位 |
| --- | --- |
| `stateAndPermission` | `[static]` `AdminLogin` 只接收 `AdminLayer` 传入的 identity/debug/showAdminPassword 与回调；它不读取 integration feature/store，也不直接调用 platform port。`[focused]` 既有密码验证测试继续覆盖成功、错误、时钟不可用和 identity fallback。 |
| `navigationAndRefresh` | `[static]` login 只调用既有 `onAuthenticated`/`onClose`，不新增 navigation、refresh 或第二个 `openLayer`。 |
| `collectionShapeAndScale` | `[focused]` PIN 长度固定为 6；传入 0、部分、6 位值时始终渲染恰好 6 个格子，不渲染输入长度以外的额外节点。 |
| `dataSourceAndCascade` | `[static]` 可见数字只来自 `useInputField` 的单一 password string；debug password 仍由 `AdminLayer` 的既有 runtime facts 开关控制，不由 theme 或 primitive 派生。 |
| `surfaceDismissBoundary` | `[focused]` 点击/触摸 PIN root 后，既有 field 仍保持 active，surface owner 不得把该交互当成外部点击而 dismiss；`PrimitivePinInput` 只透传 owner 回调，不依赖 `ui.base.input`。 |
| `forbiddenUI` | `[static]` `AdminLogin.tsx` 不出现 hex/rgb 颜色、不 import 任一 integration 包、不直接 import RN `View/Text` 来绘制格子、不创建第二个 input controller/keyboard、不改业务背景或已认证 admin section。 |

## 4. 控件、动作和焦点 roster

| 控件键 | 当前/保持的 testID | 真实节点与动作 | 说明 |
| --- | --- | --- | --- |
| login root | `adminTestIds.login` | `PrimitiveCenter` | layer 内容根；不负责业务背景。 |
| login card | `terminal.admin:login:card` | `PrimitiveContainer layout="card" bounded elevated` | 只有登录卡显式启用 elevated recipe；其它 card consumer 保持默认 recipe。 |
| title | `terminal.admin:login:title` | `PrimitiveHeading` | 保持 polite header 语义。 |
| instruction | `terminal.admin:login:instruction` | `PrimitiveText` | 保持既有动态口令文案与可选 debug password。 |
| password input | `adminTestIds.passwordInput` | 主题化 `PrimitivePinInput` 的真实 Pressable | 点击后调用现有 `field.focus()`；继续透传 native `onTouchEnd` 与 browser `onClick` 的 surface-dismiss 守卫；不是第二个输入 owner。 |
| password cell 0–5 | `terminal.admin:password:digit:<index>` | `PrimitivePinInput` 内部真实 cell | 已填显示 `*`，空格为空；状态由 value/focus/error/disabled 传入。 |
| fallback/clock/error | 既有 `terminal.admin:login:*` IDs | `PrimitiveStatus` | 不改变现有状态 owner 或文案。 |
| verify | `adminTestIds.verify` | `PrimitiveButton` | 仍按六位和时钟可用性决定 disabled。 |
| close | `adminTestIds.close` | `PrimitiveButton` | 仍关闭 layer 并恢复既有 focus scope。 |

## 5. 无新增 Journey 与 v2 基线

- Journey 仍是 `TERMINAL_ADMIN_CONSOLE` 的 J-02/J-03/J-06；本批没有新业务动作、没有新身份或新的
  admin 入口。
- 当前仓未发现可直接搬运的 Heritage terminal admin login 视觉页面；本批沿用已被用户接受的当前
  低保真方向，不把不存在的旧页面伪装成 carry-over 基线。
- 既有 interaction/IA 中关于 virtual keyboard、focus scope、single input owner、success/failure
  copy 的条目继续有效；本增补只覆盖外观和主题 token 的差异。

## 6. 完成判定（设计层）

```text
IA_DIMENSIONS=TERMINAL_ADMIN_LOGIN_VISUAL
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=YES
FORBIDDEN_UI=explicit
TYPED_PROBLEMS=existing_admin_login_states_only
CROSS_CHECK_WITH_DESIGN=PENDING_DESIGN_FILE_READBACK
DEXTER_WIREFRAME_REVIEW=ACCEPTED_BY_CURRENT_REQUEST@2026-09-19
IA_STATUS=DESIGN_ONLY_PENDING_CLAUDE_REVIEW
```
