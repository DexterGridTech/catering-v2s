# `@catering-v2s/ui-base-render`

TER 的 React Native UI 渲染 toolkit。它负责把集成层提供的只读运行时快照、冻结的 ui-state catalog
与冻结的 renderer catalog 组合成 SurfaceRoot、screen 和 layer 渲染树；它不拥有业务 Journey、命令、状态
slice 或 Runtime module。

## 边界

`RenderProvider` 接收窄的 `stateSource`：

- `getStatus()`：读取 Runtime 当前生命周期状态；
- `getState()`：仅在状态为 `started` 时读取稳定的 state root；
- `subscribe(listener)`：接收 state 或生命周期变化通知并返回退订函数。

集成层从 Runtime 闭包构造这三个函数，并额外注入两个窄函数：`dispatchCommand(command, {requestId})`
与绑定某个 `UiStateModule` 实例的 `selectUiVariable(root, declaration)`。render 不接收完整 Runtime，
不使用 `getStore()`，不暴露 `dispatchAction`／`useDispatch` 或 Redux store；业务包仍拥有 command 定义，
这里只通过 `dispatchWithRequestId` 统一构造并传递显式带 `requestId` 的 public command intent，
并由 `useRequestInFlight`／`useTrackedRequest` 提供 request 观察与瞬时句柄。变量的注册 identity 校验仍由
ui-state module 完成。窄派发 Promise 被拒绝时，`useDispatchCommand` 通过注入的 logger 记录带
`commandName`／`requestId` 的 `command-dispatch-rejected` typed diagnostic 后原样 rethrow；不把基础设施
失败伪装成业务成功，也不新增业务错误层。

React UI 的状态订阅统一走 `useUiStateSelector(selector[, equalityFn])`，生命周期状态走
`useRenderStatus()`；业务组件不能直接读取 `stateSource`、完整 snapshot 或 raw root。`useUiStateSelector`
按 state root 引用与 selector 函数身份共同记忆化结果：同一 root 且同一 selector 身份不会再次执行 selector；
root 不变但 selector 身份变化时必须重新计算。selector 应是 root 的纯函数；若闭包捕获外部值，selector
身份必须随被捕获值的变化而变化，不能用缺少依赖的 `useCallback` 把旧值伪装成同一 selector。

`undefined` 只是选择结果，不表示 runtime unavailable，也不表示业务一定为空；需要区分两者时同时读取
`useRenderStatus()`。无参数 selector 放在模块级；参数化 selector 使用模块级 factory 或带完整依赖的
`useMemo`/`useCallback`。scalar 与 owner 已稳定的引用直接返回，派生对象/数组优先由 owner selector 或
Reselect 保持引用稳定，必要时才传入字段明确、常数时间的窄 equality。Reselect 只缓存派生计算和结果引用，
不能替代 selector-aware subscription，也不能成为继续读取完整 snapshot 的理由。

典型调用保持在组件订阅边界内：

```tsx
import {selectDisplayRole} from '@catering-v2s/kernel-base-display-context'
import {useRenderStatus, useUiStateSelector} from '@catering-v2s/ui-base-render'

const DisplayRole = () => {
  const role = useUiStateSelector(selectDisplayRole)
  const runtimeStatus = useRenderStatus()
  return <PrimitiveText>{runtimeStatus === 'started' ? role ?? '未知' : '运行时不可用'}</PrimitiveText>
}
```

示例中的 `PrimitiveText` 代表既有 primitives 组件；实际组件必须从对应 owner 包导入它。参数化 selector
必须将所有捕获值放进完整依赖，不要把组件的 `root` 或 `stateSource` 传给下一级业务组件。

## Catalog

安装期使用 `definePart` 同时得到两半：`catalogEntry` 交给 ui-state 的 `createUiCatalog`，
`rendererBinding` 交给本包的 `createRendererCatalog`。两张 catalog 构建后冻结且没有 register；
`catalogEntry` 保存准入字段（包括可为空的 `containerKeys`），renderer binding 保存 component、`layerTier`
与正交的 `layerGuard`。`layerTier` 只决定标准层/告警层的排序，`layerGuard` 决定遮罩与返回键是否
可以关闭顶层 layer：`dismissible` 可关闭，`decisive` 不可绕过。
文案只存在 catalog，不进入 state 或 renderer binding。

`SurfaceRoot` 必须显式接收 `displayMode` 与 `containerKey`。screen 与 layer 都使用 ui-state 的选择器，
再按 `partKey → catalog entry → rendererKey → renderer binding` 两跳解析。运行时不可用、容器为空、
catalog 缺失、renderer 缺失和非法 props 使用不同的 fallback 语义；render 不创建默认业务内容。

`RenderRuntimeFacts.surfaceCanvasSizes`（由 integration assembly 提供）保存逐 surface 的应用逻辑画布尺寸，
也就是应用逻辑分辨率；其公开类型为 `RuntimeSurfaceCanvasSizes`。它与 display facts 中按真实设备读取的逻辑显示区域、物理像素尺寸分开保存；
consumer 不得把宿主测量或 Android real metrics 当作应用画布声明。

## 公共面

公共面以 `terminal-invariants.json` 与 TypeScript 实际导出为准，其中包括 `RuntimeSurfaceCanvasSizes`、`SurfaceFocusBoundaryContext`、
`SurfacePresentationOffsetProvider` 与 `useSurfacePresentationOffset`（presentation-only 位移桥；无 provider 时偏移为 `0`）、
`SurfaceRootContentFrame`、
`useSurfaceFocusBoundary`、`useDispatchCommand`、`useUiVariable`、`dispatchWithRequestId`、
`useRenderStatus`、`useUiStateSelector`、`useUiCatalogContext`、`useRequestInFlight` 与 `useTrackedRequest`。
焦点协议只允许 `suspend` 与 `restore` 两个 phase；
render 只发出生命周期事件，不读取 input 的 active field 或 keyboard owner。

`SurfaceRoot` 可选接收 `renderContentFrame({content})`。默认路径仍将 assembly children、
`ScreenContainer` 与 `LayerStack` 放在一个 `flex: 1` content subtree；frame consumer 可以把这个
content subtree 与自己的底部 sibling 放入同一 surface frame，而不让 render 反向依赖 input。
当 assembly 在 `RenderProvider`/`SurfaceRoot` 建立前被拒绝时，App 只能把失败原因与物理
`displayIndex` 交给 `StandaloneStartupFailurePage`；该页面仍由本包拥有固定 failure testID、
文案与 alert 语义，并只对物理 PRIMARY 调用注入的 `NativeLoadingCapability.hideOnce('startup-failure')`。
App 不得自绘第二套失败页或自行决定 splash 收起时机。
测试接缝与内部 fallback/诊断实现不进入 `src/index.ts` 或 package publicExports。

## 目录与测试

- `src/types`：公共类型；
- `src/foundations`：安装期 catalog、快照与解析基础设施；
- `src/contexts`、`src/hooks`：只读 React 接缝；
- `src/components`：Provider、SurfaceRoot、ScreenContainer 与 LayerStack；
- `test`：Vitest 的 `.ts`/`.tsx` 行为测试，使用 `react-test-renderer`；
- `vitest.config.ts`：显式收集 `.test.ts` 与 `.test.tsx`。

本包的生产测试命令由 `tools/terminal-shared/run-owned-tests.mjs` 托管。跨包 catalog 契约测试真实调用
definePart、ui-state 的 createUiCatalog 与 selectAvailableParts，不以 mock 替代交界。

当前依赖基于已落地的 Runtime `status/getState/subscribe` 与 ui-state `containerKeys` 契约；历史需求文档中
关于这两项“尚未落地”的文字不构成兼容 API 的依据。
