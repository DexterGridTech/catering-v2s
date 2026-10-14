# 终端激活界面

本包拥有可复用的激活表单、只读激活引导和本机 admin 状态区，并公开 `needToActivateTerminalCommand`。本包的 actor 根据注入的 `surfaceForm`、command 路由上下文和本包实际声明的 parts 幂等展示激活屏；integration 只决定激活阶段优先级并发送该 command。

这是 UI Runtime owner module；直接依赖为 contracts/runtime/server-config/state/terminal-data-client/topology/ui-state 与 admin-shell/feature-assembly/input/primitives/render，实际使用者是两个 sample integration。它不拥有凭证或服务配置事实。

`ActivationCodeForm` 通过 `server-config` selector 读取当前服务空间，并把 8 位激活码交给 `activateTerminalCommand`。取消激活通过 terminal-data-client command 使用当前选中的服务空间。取消被拒绝时保留凭证并显示拒绝结果，不回退到凭证原先所属的服务空间。

MMP 和 LMP 提供激活输入；LMS 和 LSP 只提供只读引导。LMS 仅注册在 laptop 的 `MAIN` 次屏，可用于本地 `MASTER` 或配对后的 `SLAVE` runtime；LSP 是 `SLAVE` laptop `BRANCH` 的主屏。配对后的 LMS 激活状态由 topology owner 投影，不读取本地凭证 slice。

admin 状态区读取本机 Runtime 上的 terminal-data-client selectors。只有本机凭证有效的 `MASTER` 可以发起取消激活。`CommandDispatchResult.status=completed` 只表示 command 已完成分派，不代表业务取消成功；actor 结果必须为 `CANCELLED` 或 `ALREADY_CANCELLED`。

## 结构

- `src/declarations/`：本包 command 与 UI parts 声明。
- `src/features/actors/`：根据 owner command 与 surface context 路由激活页面。
- `src/selectors/`：本包激活状态的 UI 投影。
- `src/components/`：激活表单、只读引导和状态呈现。
- `src/foundations/`：无副作用的凭证密钥与 test ID 逻辑。
- `src/application/module.ts`：从本包真实定义构造 UI Runtime module。

公开功能面还包括 `createCredentialSecret`、`ActivationCodeForm`、`ActivationGuide`、`ActivationStatusSection` 与 `selectActivationStatusView`；完整 root export 与 package invariant 以 `src/index.ts`、`terminal-invariants.json` 为准。

## 用法

Integration 按当前 App 的 surface form 创建并加载本包 module；页面是否进入激活阶段仍由 integration policy 决定：

```ts
const activationModule = createTerminalActivationModule(serverSpaces, surfaceForm)
```

`createTerminalActivationModule`、`needToActivateTerminalCommand` 与页面组件均是本包当前公开面；不要在 integration 中复制激活表单或凭证判断。

## 在这个包上迭代时

新增页面或命令时先确认 terminal-data-client/server-config 的现有公开 command/selector，再同步本包 declarations、module、README 与 `terminal-invariants.json`。修改后运行 `yarn workspace @catering-v2s/ui-base-terminal-activation typecheck`、`test`、`lint`。
