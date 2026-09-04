# `@catering-v2s/ui-base-primitives`

## 定位

本包是 TER 的最小 React Native 展示控件 toolkit，不是业务 owner、状态模块、命令模块或
自动化后端。本批先使用带 TypeScript 类型的 React Native 控件；NativeWind、React Native
Reusables 与 automation 后端按裁定押后，不能在本包里偷偷加入替代实现。

## 作用

凡是业务部件需要的基础展示、输入、按钮、状态、动作组或部件根容器，都必须经本包
提供的语义控件渲染。每个控件都要求非空 `testID`，并把这个挂点落在真实 React Native
元素上；没有不带挂点的旁路调用形式。未来接入 automation 时，挂点由本包统一接入注册，业务
组件不需要知道注册细节。

`PrimitiveText` 的 `accessibilityRole` 只接受 `alert` 或 `status`；按钮、标题等控制语义必须
使用对应的专用 primitive，不得用通用文本控件冒充。实现会把这两个反馈语义转发到 RN
0.86.3 的 typed `role` 属性，因为 RN 的旧 `accessibilityRole` 类型不包含 `status`。

本包不保存业务状态、不读取 Runtime、不派发命令、不定义具体 partKey，也不导入 automation。
当前 `dependencyModuleNames` 为空，因为它表示本包运行时模块实际 import 的 workspace 能力；包级
`package.json` 的 `plannedDependencies` 与 skeleton graph 仍保留 `ui.base.automation` 的 planned
workspace 边，供未来挂点接入使用，不能被误读成当前源码已经导入 automation；静态 graph gate 会将
planned edge 与实际 import/dependency 分开对账。

## 结构

- `src/components.tsx`：八个最小语义控件及共同的非空 `testID` 校验；只依赖 React Native。
- `src/index.ts`：唯一公共面，导出控件与其 props 类型。
- `src/dependencies.ts`：本包实际 workspace 依赖声明；本批为空。
- `test/primitives.test.tsx`：使用 `react-test-renderer` 验证真实组件树和挂点。
- `terminal-invariants.json`：公共导出集合与测试 owner 的正本。

## 公共面

当前公共面为 20 项，与 `src/index.ts` 和 `terminal-invariants.json` 精确一致：
`PrimitiveActions`、`PrimitiveActionsProps`、`PrimitiveAddressableProps`、`PrimitiveButton`、
`PrimitiveButtonProps`、`PrimitiveContainer`、`PrimitiveContainerProps`、`PrimitiveHeading`、
`PrimitiveHeadingProps`、`PrimitiveInput`、`PrimitiveInputProps`、`PrimitiveLabel`、
`PrimitiveLabelProps`、`PrimitiveStatus`、`PrimitiveStatusProps`、`PrimitiveText`、
`PrimitiveTextProps`、`dependencyModuleNames`、`devDependencyModuleNames`、`moduleName`。
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

示例使用的导出、必填 `testID` 与回调形态均来自本包当前源码；业务命令仍由业务包拥有，
控件只接收回调，不替业务包定义命令。

## 在这个包上迭代时

新增控件前先确认它是不带业务词汇、已经被两个以上 feature 真实重复使用且可机械归一的展示能力，
而不是把业务行为或视觉设计提前
塞进 toolkit。保持 `testID` 必填并落在真实 RN 节点；不要引入 NativeWind、React Native
Reusables 或 automation 依赖来凑当前批次。修改公共面时同步 `src/index.ts`、
`terminal-invariants.json` 与本 README，并运行本包 `typecheck` 和 `test`；同时检查所有
业务消费者是否仍通过 JSX 使用语义控件。第一次真实视觉实现时，另行按裁定评估 NativeWind、
React Native Reusables 与 automation 接入，不在本包自行发明第二套样式或注册协议。

带业务领域词汇的控件永远留在 feature，即使它只出现一次或后来出现多处；本包只承载呈现
形态。先在 feature 中看见真实重复，再评估是否下沉，不能预先猜测业务控件并放进 base。
因此会员姓名、电话等领域字段不属于本包，feature 应使用本包的通用容器与文本控件组合它们。
