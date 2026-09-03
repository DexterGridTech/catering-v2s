# `@catering-v2s/ui-base-render`

TER 的 React Native UI 渲染 toolkit。它负责把集成层提供的只读运行时快照、冻结的 ui-state catalog
与冻结的 renderer catalog 组合成 SurfaceRoot、screen 和 layer 渲染树；它不拥有业务 Journey、命令、状态
slice 或 Runtime module。

## 边界

`RenderProvider` 接收窄的 `stateSource`：

- `getStatus()`：读取 Runtime 当前生命周期状态；
- `getState()`：仅在状态为 `started` 时读取稳定的 state root；
- `subscribe(listener)`：接收 state 或生命周期变化通知并返回退订函数。

集成层从 Runtime 闭包构造这三个函数。render 不接收完整 Runtime，不使用 `getStore()`，不暴露或调用
dispatch，也不提供 command、automation 或可编辑变量接缝。业务包的命令归业务 owner；变量与 automation
分别归对应 toolkit。

`useUiStateSelector(selector)` 按 state root 引用记忆化结果：同一 root 不会再次执行 selector。selector
必须是 root 的纯函数；不要在 selector 闭包中捕获会变化的 props 或其他外部值，否则 root 不变时可能
返回旧参数对应的陈旧结果。

## Catalog

安装期使用 `definePart` 同时得到两半：`catalogEntry` 交给 ui-state 的 `createUiCatalog`，
`rendererBinding` 交给本包的 `createRendererCatalog`。两张 catalog 构建后冻结且没有 register；
`catalogEntry` 保存准入字段（包括可为空的 `containerKeys`），renderer binding 保存 component 与 `layerTier`。
文案只存在 catalog，不进入 state 或 renderer binding。

`SurfaceRoot` 必须显式接收 `displayMode` 与 `containerKey`。screen 与 layer 都使用 ui-state 的选择器，
再按 `partKey → catalog entry → rendererKey → renderer binding` 两跳解析。运行时不可用、容器为空、
catalog 缺失、renderer 缺失和非法 props 使用不同的 fallback 语义；render 不创建默认业务内容。

## 公共面

当前公共面固定为 16 项：3 项基础包元数据导出、5 项类型、4 个渲染组件、2 个 catalog 工厂和 2 个 hook。
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
