# UI Runtime 模块贡献工厂（`ui.base.feature-assembly`）

## 定位

本包提供 UI Runtime module 工厂，把模块的运行期定义与 parts、variables、按 partKey 关联的
layer dismissals 一起冻结。它不拥有业务事实、App assembly 或 Runtime state。

这是 UI toolkit，直接依赖 contracts/runtime/state/ui-state/render，由 UI owner modules 使用；它不反向依赖具体 feature 或 integration。

## 结构

- `src/types/uiRuntimeModule.ts`：UI module 与呈现贡献类型。
- `src/foundations/createUiRuntimeModule.ts`：为 `ui.base`、`ui.feature`、`ui.integration` 模块附加呈现贡献。
- `src/index.ts`：包的唯一公共导出。
- `terminal-invariants.json`：公开面与包边界不变量。
- `test/featureAssembly.test.ts`：验证 Runtime module 与呈现贡献冻结。

## 用法

UI owner 在自己的模块工厂中调用本包公开的 `createUiRuntimeModule` 返回呈现贡献；integration 只加载模块并收集这些贡献：

```ts
const module = createUiRuntimeModule(runtimeModule, {parts, layerDismissals})
```

feature、base 与 integration owner 都使用 `createUiRuntimeModule` 声明本包实际的
Runtime definitions 和呈现贡献。没有真实 Runtime 行为的 primitives/input/render 不伪造 module。

## 边界

本包不得依赖具体 feature、integration 或 App。业务身份、状态、文案和测试标识由各自 owner
声明；integration 不重复维护第二份 parts、variables 或 dismissal 名单。

修改时同步 `package.json`、`src/dependencies.ts`、graph、public exports、README 与
`terminal-invariants.json`，并运行本包 focused typecheck/test 及对应 terminal static checker。

## 在这个包上迭代时

只为真实 UI Runtime module 附加本包 owner 提供的 presentation contributions；纯 toolkit 不伪造业务 module。修改后运行 `yarn workspace @catering-v2s/ui-base-feature-assembly typecheck`、`test`、`lint`，并用 integration-assembly 的消费者测试确认新增 parts、variables 或 dismissal 被实际收集。
