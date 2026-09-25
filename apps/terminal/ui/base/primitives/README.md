# `@catering-v2s/ui-base-primitives`

## 定位

本包是 TER 的最小 React Native 展示控件 toolkit，不是业务 owner、状态模块、命令模块或
自动化后端。NativeWind 与 React Native Reusables 的必要内部实现已按 copy-in 形态落在本包，
automation 后端仍按裁定押后。

## 作用

凡是业务部件需要的基础展示、输入、按钮、状态、动作组或部件根容器，都必须经本包
提供的语义控件渲染。每个控件都要求非空 `testID`，并把这个挂点落在真实 React Native
元素上；没有不带挂点的旁路调用形式。未来接入 automation 时，挂点由本包统一接入注册，业务
组件不需要知道注册细节。

`PrimitiveText` 的 `accessibilityRole` 只接受 `alert` 或 `status`；按钮、标题等控制语义必须
使用对应的专用 primitive，不得用通用文本控件冒充。实现会把这两个反馈语义转发到 RN
0.86.3 的 typed `role` 属性，因为 RN 的旧 `accessibilityRole` 类型不包含 `status`。

`PrimitiveHeading` 保持 header 语义，并使用 `accessibilityLiveRegion="polite"` 通知标题内容变化；
它只负责通用的可读呈现，不持有页面导航、焦点 scope 或业务状态。

`PrimitiveInput` 的输入公共面只增加三个呈现/编辑 prop：`selection`、`onSelectionChange` 与
`maxLength`。它们只透传到真实 RN `TextInput`，不引入 `inputMode`、
键盘布局、业务字段、command 或 store；`selection.end` 缺省时按光标位置归一为 `start`。业务层
可用 `maxLength` 表达通用编辑上限，虚拟键盘的纯编辑模型也必须遵守同一个上限。

系统软键盘抑制不属于公共 props；`src/vendor/slots.tsx` 在唯一的 RN `TextInput` slot 内固定
`showSoftInputOnFocus={false}`，调用方不能重新打开该逃生口。

为支持输入包的真实 focus/restore 与 surface 点击边界，`PrimitiveInput` 另外接受呈现无关的
`onFocus`、`onBlur`、`onPressIn` 与 `inputRef`。前三者只转发真实 `TextInput` 生命周期/按下通知，后者只暴露 `focus`/`blur`、
`measureLayout` 与 `measureInWindow` 四个通用
操作给 `ui/base/input`；它们不承载字段名、键盘布局、屏数、command 或 store，也不引入
`inputMode`。这是 input provider 执行 focus-next、layer suspend/restore 的最小公共接缝。

`PrimitiveContainer` 的 `layout` 只表达呈现形态，不承载业务语义：默认 `fill` 用于 screen
根容器，`content` 用于列表行或空态内容，`card` 用于由 render 层居中的短层内容，`centered`
用于需要在 surface 内垂直居中的顾客内容。业务包不能用它传入 command、layer guard、screen
mode 或领域字段；它仍必须提供非空 `testID`。这种区分避免把 screen 的填充布局错误复用给
内容卡片，同时不让 feature 直接接触 `className` 或 React Native 原生 View。

`PrimitiveContainer` 的可选 `bounded` 仍是纯呈现约束：在 `card` 上通过跨平台原生 style 限制卡片
不超过父级高度并隐藏外溢，在 `content` 上让内容承担父级剩余高度并允许其唯一的列表子项滚动。它不创建新的
滚动祖先、不读取运行时或业务状态；只有需要在逻辑画布内承载可滚动 section 的 owner 才应使用它。

`PrimitiveContainer` 还接受只对 `layout="card"` 生效的可选 `elevated` 呈现 prop。它只追加
shared primitive 的 elevated card recipe；默认 `card` recipe 不变，业务 owner 必须显式选择，不能
通过升级默认 token 让其他 card 消费方静默改变。

`PrimitivePinInput` 是无状态的通用 PIN 呈现控件：调用方提供 `value`、长度、遮罩字符、焦点索引、
稳定的 cell testID 前缀和 `onPress`，控件不持有输入、键盘、认证或 store。它按长度渲染方形 cell，
已有值显示调用方指定的遮罩字符，默认是 `*`。`onTouchEnd` 与 `onClick` 只作为结构化的
`stopPropagation` 事件透传；surface dismiss 的 owner 仍由调用方持有，primitive 不依赖
`ui.base.input`，也不解释这两个事件的业务语义。可选 `measureRef` 只透传到承载六格的同一个
Pressable 根，供 owner 按自己的坐标契约测量可见 PIN 锚点；primitive 不计算避让或键盘几何。

为保持同一应用在 Web 与 Android 上的字号和布局基线，primitives 内部的 `Text` 与 `TextInput`
统一强制 `allowFontScaling={false}`；字号与行高仍由控件自身的展示 token 明确提供。该约束只
固定 TER sample 的视觉基线，不声称两个平台的字体栅格化、抗锯齿或字形 fallback 完全相同；若
未来需要无障碍字号放大，必须另行裁定应用级策略，不能通过 feature 绕过 primitives。

本包不保存业务状态、不读取 Runtime、不派发命令、不定义具体 partKey，也不导入 automation。
`className` 只存在于 `src/vendor` 与 primitives 内部 recipe，不能出现在任何 ui/feature 生产源码；
业务组件继续只消费带强制 `testID` 的语义控件。本轮已授权的公共面加法包括
`PrimitiveContainer` 的可选 `layout`/`bounded` 呈现字段、受控 `PrimitiveScrollView`、`PrimitiveButton` 的
`default`/`key`/`key-action` 呈现 variant，以及 `PrimitiveInput` 的三个可选编辑/呈现 prop 与四个
focus/measurement seam；它们都不增加业务语义、业务控件
或自动化后端。
`PrimitiveContainer` 默认 `fill` 保持既有 surface-filling 行为。
组合式布局可通过 `PrimitiveContainer`、`PrimitiveButton`、`PrimitiveText`、`PrimitiveStatus`、
`PrimitiveStack` 与 `PrimitiveGrid` 的可选 `style` 做局部原生布局约束；这些字段只用于呈现，
不携带业务状态。`PrimitivePressOption` 的 `tab` variant 只提供紧凑导航 tab 外观，仍沿用同一
press/selected 状态模型。
当前 `dependencyModuleNames` 为空，因为它表示本包运行时模块实际 import 的 workspace 能力；本包
不声明任何未实现的 workspace 边，也不导入自动化后端。未来若正式接入自动化挂点，必须先形成新的
设计与授权，并同步公共面、依赖、graph、测试与本 README；不能以 planned edge 或 fallback 伪装成已实现能力。

## 结构

- `src/components/`：排版、布局、表单、反馈和数据展示的 bounded primitives；控件共用
  `src/foundations/assertTestID.ts` 的非空 `testID` 校验。
- `src/types/types.ts`：控件公共 props、handle 与事件类型，不含运行时值。
- `src/vendor/`：唯一接触 React Native value API 的 slot，包括 Text/Button/Input、滚动、Spinner、
  VirtualizedList 和首批 SVG/icon 接缝；不把平台分支泄漏到 component 层。
- `src/theme/`：只含 base 展示 token 和 `ok`/`warn`/`error`/`info` 语义 tone 映射，不含应用主题与业务文案。
- `src/index.ts`：唯一公共面，导出控件与其 props 类型。
- `src/dependencies.ts`：本包实际 workspace 依赖声明；本批为空。
- `test/primitives.test.tsx`：使用 `react-test-renderer` 验证真实组件树和挂点。
- `terminal-invariants.json`：公共导出集合与测试 owner 的正本。

## 公共面

`src/index.ts` 与 `terminal-invariants.json` 同步导出五组 bounded primitives：排版
`PrimitiveText`、`PrimitiveHeading`、`PrimitiveLabel`、`PrimitiveCodeBlock`；布局
`PrimitiveContainer`、`PrimitiveCard`、`PrimitiveDivider`、`PrimitiveStack`、`PrimitiveGrid`、
`PrimitiveCenter`；表单 `PrimitiveButton`、`PrimitiveInput`、`PrimitiveCodeInput`、`PrimitiveCheckbox`、
`PrimitiveRadio`、`PrimitiveSwitch`、`PrimitiveSelect`、`PrimitiveTextarea`、`PrimitiveForm`、`PrimitiveFormField`、通用
`PrimitivePinInput`；反馈
`PrimitiveSpinner`、`PrimitiveInlineAlert`、`PrimitiveEmptyState`、`PrimitiveProgress`、`PrimitiveSkeleton`；
数据展示 `PrimitiveBadge`、`PrimitiveKeyValueRow`、`PrimitiveStatusRow`、`PrimitiveList`、
`PrimitiveTable`、`PrimitiveTabs`、`PrimitiveSegmentedControl`、新增的 `PrimitiveImage`，以及既有 `PrimitiveStatus`、
`PrimitiveActions`、`PrimitiveScrollView` 和 list bound 常量。带业务领域词汇的行组件不属于本包；由所属
feature 自己组合 primitives。

可交互件统一接收可读 `accessibilityLabel` 和 `testID`，并暴露 disabled/selected/busy 等状态；
按钮在 disabled 或 busy 时不会执行 `onPress`。`PrimitiveList` 保留完整 `data`，以真实
`VirtualizedList` slot 承载，消费侧窗口固定为 16 行、前后各 4 行且最多 24 个可见 row；这只是
挂载上界，不是截断数据。

## 用法

```tsx
import {PrimitiveButton, PrimitiveContainer, PrimitiveText} from '@catering-v2s/ui-base-primitives';

export const Example = () => (
  <PrimitiveContainer testID="example:root">
    <PrimitiveText testID="example:message">请确认</PrimitiveText>
    <PrimitiveButton testID="example:confirm" onPress={() => undefined}>
      确认
    </PrimitiveButton>
  </PrimitiveContainer>
);
```

列表或表单需要唯一滚动祖先时，feature 只消费这个公共 primitive，不直接导入 RN：

```tsx
import type {ReactNode} from 'react';
import {PrimitiveScrollView} from '@catering-v2s/ui-base-primitives';

export const ScrollArea = ({testID, children}: {testID: string; children: ReactNode}) => (
  <PrimitiveScrollView testID={testID}>{children}</PrimitiveScrollView>
);
```

`PrimitiveScrollView` 是受控的纵向 ScrollView wrapper：props 接受强制 `testID`、children、
通用的 `onScrollOffsetChange`、presentation-only 的 `layout` 与可选 `contentPaddingBottom` 尾部内容
inset；React ref 暴露
`PrimitiveScrollViewHandle` 的测量与 `scrollTo`，
不把 `className`、业务字段、屏幕模式或键盘策略暴露给 feature。它使用真实 RN ScrollView，
因此不会退化成只记录标签的 View；同一列表或表单只能有一个这样的滚动祖先。其
`getContentNativeNode()` 返回 ScrollView 的真实 inner content component ref，供
`PrimitiveInputHandle.measureLayout()` 使用 content-local 坐标；这里必须使用 RN 的
`getInnerViewRef()`，不能把 `getInnerViewNode()` 返回的数字 node handle 传给 Fabric 的 ref
测量 API。`PrimitiveInputHandle` 同时提供通用的 `measureLayout` 与 `measureInWindow`；输入几何
必须由 `ui/base/input` 用 `measureLayout` 相对未平移的 surface root 测量普通字段，滚动区内字段则
相对 scroll content 测量并由 input 合成视口与滚动偏移，不能用窗口坐标计算可见区。测量/滚动算法
不在 primitives 内实现。`layout="fill"`（默认）保留不透明的
`bg-canvas`，已有消费者无需改变；父级自己提供背景的复合件（例如壁纸 picker）可以选择
`layout="transparent"`，该选择只改变 viewport 背景，不改变测量、滚动观察或内容间距。
业务组件不得借此传入平台专属样式、另建 ScrollView 或另建输入路径。

示例使用的导出、必填 `testID` 与回调形态均来自本包当前源码；业务命令仍由业务包拥有，
控件只接收回调，不替业务包定义命令。

## 在这个包上迭代时

新增控件前先确认它是不带业务词汇、已经被两个以上 feature 真实重复使用且可机械归一的展示能力，
而不是把业务行为或视觉设计提前塞进 toolkit。保持 `testID` 必填并落在真实 RN 节点；本批
NativeWind 与 React Native Reusables 只作为本包内部 copy-in 实现，不形成 workspace/runtime
依赖，也不在本包另造第二套样式或注册协议。修改公共面时同步 `src/index.ts`、
`terminal-invariants.json` 与本 README，并运行本包 `typecheck` 和 `test`；同时检查所有业务消费者
是否仍通过 JSX 使用语义控件。automation 后端仍按裁定押后，接入时继续由本包统一承载挂点。

带业务领域词汇的控件永远留在 feature，即使它只出现一次或后来出现多处；本包只承载呈现
形态。先在 feature 中看见真实重复，再评估是否下沉，不能预先猜测业务控件并放进 base。
因此会员姓名、电话等领域字段不属于本包，feature 应使用本包的通用容器与文本控件组合它们。

虚拟键盘由 `PrimitiveKeyboardBackdrop`、`PrimitiveKeyboardSurface`、`PrimitiveButton` 与 `PrimitiveIcon` 共同呈现：backdrop 负责覆盖键盘占用的完整高度但保持透明，surface 负责有内边距的键盘卡片并持有不透明键盘面。键盘面、键面、动作键、文字、边框与 focus 消费 `keyboard-*` 语义 token，实际 RGB 由 integration theme 提供；backdrop 不消费应用身份色。Shift 的 selected 视觉只呈现 input 传入的一次性待生效状态，成功插入后由 input 消耗；primitive 不拥有 CAPS 或持久锁定语义。所有 key/key-action 的按下瞬态仍由 primitive 持有，并与 selected 状态共用主题 focus 边框 recipe；释放后恢复普通边框。primitive 不持有输入状态，也不实现 surface dismiss。
