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

`PrimitiveInput` 的输入公共面只增加四个呈现/编辑 prop：`selection`、`onSelectionChange`、
`showSoftInputOnFocus` 与 `maxLength`。它们只透传到真实 RN `TextInput`，不引入 `inputMode`、
键盘布局、业务字段、command 或 store；`selection.end` 缺省时按光标位置归一为 `start`。业务层
可用 `maxLength` 表达通用编辑上限，虚拟键盘的纯编辑模型也必须遵守同一个上限。

为支持输入包的真实 focus/restore 与 surface 点击边界，`PrimitiveInput` 另外接受呈现无关的
`onFocus`、`onBlur`、`onPressIn` 与 `inputRef`。前三者只转发真实 `TextInput` 生命周期/按下通知，后者只暴露 `focus`/`blur` 与
`measureInWindow` 三个通用
操作给 `ui/base/input`；它们不承载字段名、键盘布局、屏数、command 或 store，也不引入
`inputMode`。这是 input provider 执行 focus-next、layer suspend/restore 的最小公共接缝。

`PrimitiveContainer` 的 `layout` 只表达呈现形态，不承载业务语义：默认 `fill` 用于 screen
根容器，`content` 用于列表行或空态内容，`card` 用于由 render 层居中的短层内容，`centered`
用于需要在 surface 内垂直居中的顾客内容。业务包不能用它传入 command、layer guard、screen
mode 或领域字段；它仍必须提供非空 `testID`。这种区分避免把 screen 的填充布局错误复用给
内容卡片，同时不让 feature 直接接触 `className` 或 React Native 原生 View。

为保持同一应用在 Web 与 Android 上的字号和布局基线，primitives 内部的 `Text` 与 `TextInput`
统一强制 `allowFontScaling={false}`；字号与行高仍由控件自身的展示 token 明确提供。该约束只
固定 TER sample 的视觉基线，不声称两个平台的字体栅格化、抗锯齿或字形 fallback 完全相同；若
未来需要无障碍字号放大，必须另行裁定应用级策略，不能通过 feature 绕过 primitives。

本包不保存业务状态、不读取 Runtime、不派发命令、不定义具体 partKey，也不导入 automation。
`className` 只存在于 `src/rnr` 与 primitives 内部 recipe，不能出现在任何 ui/feature 生产源码；
业务组件继续只消费带强制 `testID` 的语义控件。本轮已授权的公共面加法包括
`PrimitiveContainer` 的可选 `layout` 呈现字段、受控 `PrimitiveScrollView`、`PrimitiveButton` 的
`default`/`key`/`key-action` 呈现 variant，以及 `PrimitiveInput` 的四个可选编辑/呈现 prop 与四个
focus/measurement seam；它们都不增加业务语义、业务控件
或自动化后端。
`PrimitiveContainer` 默认 `fill` 保持既有 surface-filling 行为。
当前 `dependencyModuleNames` 为空，因为它表示本包运行时模块实际 import 的 workspace 能力；包级
`package.json` 的 `plannedDependencies` 与 skeleton graph 仍保留 `ui.base.automation` 的 planned
workspace 边，供未来挂点接入使用，不能被误读成当前源码已经导入 automation；静态 graph gate 会将
planned edge 与实际 import/dependency 分开对账。

## 结构

- `src/components.tsx`：九个最小语义控件及共同的非空 `testID` 校验。
- `src/rnr/`：按 RNR NativeWind 手工安装形态裁剪的 slot、Text/Button context 与 class merge
  copy-in，不形成 RNR workspace 或运行时依赖。
- `src/theme/`：只含 base 展示 token，不含应用主题与业务文案。
- `src/index.ts`：唯一公共面，导出控件与其 props 类型。
- `src/dependencies.ts`：本包实际 workspace 依赖声明；本批为空。
- `test/primitives.test.tsx`：使用 `react-test-renderer` 验证真实组件树和挂点。
- `terminal-invariants.json`：公共导出集合与测试 owner 的正本。

## 公共面

当前公共面为 27 项，与 `src/index.ts` 和 `terminal-invariants.json` 精确一致：
`PrimitiveActions`、`PrimitiveActionsProps`、`PrimitiveAddressableProps`、`PrimitiveButton`、
`PrimitiveButtonProps`、`PrimitiveContainer`、`PrimitiveContainerProps`、`PrimitiveHeading`、
`PrimitiveHeadingProps`、`PrimitiveInput`、`PrimitiveInputHandle`、`PrimitiveInputProps`、`PrimitiveInputSelection`、
`PrimitiveInputSelectionChangeEvent`、`PrimitiveLabel`、`PrimitiveLabelProps`、`PrimitiveMeasureInWindowCallback`、
`PrimitiveScrollView`、`PrimitiveScrollViewHandle`、`PrimitiveScrollViewProps`、`PrimitiveStatus`、`PrimitiveStatusProps`、`PrimitiveText`、
`PrimitiveTextProps`、`dependencyModuleNames`、
`devDependencyModuleNames`、`moduleName`。
带业务领域词汇的行组件不属于本包；由所属 feature 自己组合 primitives。

## 用法

```tsx
import {PrimitiveButton, PrimitiveContainer, PrimitiveText} from '@catering-v2s/ui-base-primitives'

export const Example = () => (
  <PrimitiveContainer testID="example:root">
    <PrimitiveText testID="example:message">请确认</PrimitiveText>
    <PrimitiveButton testID="example:confirm" onPress={() => undefined}>确认</PrimitiveButton>
  </PrimitiveContainer>
)
```

列表或表单需要唯一滚动祖先时，feature 只消费这个公共 primitive，不直接导入 RN：

```tsx
import type {ReactNode} from 'react'
import {PrimitiveScrollView} from '@catering-v2s/ui-base-primitives'

export const ScrollArea = ({testID, children}: {testID: string; children: ReactNode}) => (
  <PrimitiveScrollView testID={testID}>{children}</PrimitiveScrollView>
)
```

`PrimitiveScrollView` 是受控的纵向 ScrollView wrapper：props 只接受强制 `testID`、children
和通用的 `onScrollOffsetChange`；React ref 暴露 `PrimitiveScrollViewHandle` 的测量与 `scrollTo`，
不把 `className`、业务字段、屏幕模式或键盘策略暴露给 feature。它使用真实 RN ScrollView，
因此不会退化成只记录标签的 View；同一列表或表单只能有一个这样的滚动祖先。`PrimitiveInputHandle`
也提供同形 `measureInWindow`，供 `ui/base/input` 在焦点切换后计算可见区；测量/滚动算法不在
primitives 内实现。

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
