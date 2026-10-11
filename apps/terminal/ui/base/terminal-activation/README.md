# 终端激活界面

本包拥有可复用的激活表单、只读激活引导和本机 admin 状态区，并公开 `needToActivateTerminalCommand`。每个 integration 自己提供路由 actor，因为只有组合应用知道已注册的 screen 集合及当前路由上下文。

`ActivationCodeForm` 通过 `server-config` selector 读取当前服务空间，并把 8 位激活码交给 `activateTerminalCommand`。取消激活通过 terminal-data-client command 使用当前选中的服务空间。取消被拒绝时保留凭证并显示拒绝结果，不回退到凭证原先所属的服务空间。

MMP 和 LMP 提供激活输入；LMS 和 LSP 只提供只读引导。LMS 仅注册在 laptop 的 `MAIN` 次屏，可用于本地 `MASTER` 或配对后的 `SLAVE` runtime；LSP 是 `SLAVE` laptop `BRANCH` 的主屏。配对后的 LMS 激活状态由 topology owner 投影，不读取本地凭证 slice。

admin 状态区读取本机 Runtime 上的 terminal-data-client selectors。只有本机凭证有效的 `MASTER` 可以发起取消激活。`CommandDispatchResult.status=completed` 只表示 command 已完成分派，不代表业务取消成功；actor 结果必须为 `CANCELLED` 或 `ALREADY_CANCELLED`。

在本目录运行 `yarn typecheck` 和 `yarn test` 检查此包。
