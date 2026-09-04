# Sample staff auth

本 UI feature 拥有店员登录与认证失败提示的呈现。组装描述提供登录 screen、提示
layer、`operator-name` 与 `passcode` 两个 uiVariable，以及负责呈现与导航的 actor
模块。

店员会话状态和领域结果命令仍由 `kernel/feature/sample-staff-session` 持有。本包
只消费该 owner 协议，派发显式携带 requestId 的 public 命令，并把瞬时 requestId
保留在当前交互中。本包不拥有业务 slice，不负责平台启动或 runtime 安装。

部件只通过 `ui/base/primitives` 的 typed React Native 控件以 JSX 构建；本包不使用字符串 host
tag 或 `createElement` 构造控件。

迭代时应先扩展 owner 的命令/结果协议，再在本包增加对应部件或 actor；partKey 与
呈现文案只由本包声明，不能下沉到 kernel。
