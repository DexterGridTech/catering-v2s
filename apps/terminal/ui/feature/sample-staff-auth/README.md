# Sample staff auth

本 UI feature 拥有店员登录、认证业务失败提示和认证基础设施失败提示的呈现。组装
描述提供登录 screen、两个 alert layer、记住工号的 `operator-name` uiVariable，以及
负责呈现、导航和失败恢复的 actor 模块。工号和密码都是拉丁/数字凭据，均通过
`ui/base/input` 的 `useInputField` 使用虚拟全键盘；编辑值留在 input registry，登录提交时
通过同步快照读取。密码草稿不进入 runtime/store，认证业务失败时由登录部件清空。

店员会话状态和领域结果命令仍由 `kernel/feature/sample-staff-session` 持有。本包
只消费该 owner 协议。带 loading 生命周期的登录动作显式沿 tracked requestId 派发；
其他 feature-owned public action 统一经 render 的 `dispatchWithRequestId` 生成 requestId。
resolved 的 `SYSTEM`/timeout/partial failure 与 Promise rejection 统一观察为
`auth.system-notice`，而已知认证业务失败仍走 `auth.notice`。本包不拥有业务 slice，
不负责平台启动或 runtime 安装。

部件只通过 `ui/base/primitives` 的 typed React Native 控件和 `ui/base/input` 的输入接缝以 JSX
构建；本包不使用字符串 host tag 或 `createElement` 构造控件。登录表单使用
`InputScrollArea` 作为唯一滚动祖先，保证虚拟键盘收缩内容区时输入仍可滚入可见区域。

迭代时应先扩展 owner 的命令/结果协议，再在本包增加对应部件或 actor；partKey 与
呈现文案只由本包声明，不能下沉到 kernel。
