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

`useUiStateSelector(selector)` 按 state root 引用与 selector 函数身份共同记忆化结果：同一 root 且同一
selector 身份不会再次执行 selector；root 不变但 selector 身份变化时必须重新计算。selector 应是 root
的纯函数；若闭包捕获外部值，selector 身份必须随被捕获值的变化而变化，不能用缺少依赖的
`useCallback` 把旧值伪装成同一 selector。

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

## 公共面

当前公共面固定为 27 项：3 项基础包元数据导出、9 项类型/焦点协议、1 个焦点 context、4 个渲染组件、2 个 catalog 工厂、7 个 hook
与 1 个 request helper，其中包括 `SurfaceFocusBoundaryContext`、`SurfaceRootContentFrame`、
`useSurfaceFocusBoundary`、`useDispatchCommand`、`useUiVariable`、`dispatchWithRequestId`、
`useRequestInFlight` 与 `useTrackedRequest`。焦点协议只允许 `suspend` 与 `restore` 两个 phase；
render 只发出生命周期事件，不读取 input 的 active field 或 keyboard owner。

`SurfaceRoot` 可选接收 `renderContentFrame({content})`。默认路径仍将 assembly children、
`ScreenContainer` 与 `LayerStack` 放在一个 `flex: 1` content subtree；frame consumer 可以把这个
content subtree 与自己的底部 sibling 放入同一 surface frame，而不让 render 反向依赖 input。
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
