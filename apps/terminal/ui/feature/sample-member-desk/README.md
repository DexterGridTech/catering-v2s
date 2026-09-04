# Sample member desk

本 UI feature 拥有店员会员列表/表单、等待确认、顾客欢迎/确认和登记提示的呈现。
组装描述提供六个 parts、表单临时 uiVariable，以及负责呈现与导航的 actor 模块。

店员会话和会员登记状态仍由两个 `kernel/feature` 包分别持有。本包消费它们的命令、
领域结果事件与 owner selector，不复制业务状态或 selector。desk actor 在处理相关
命令时经 display-context 的读取端口实时判断是否有副屏；runtime 组装与平台启动由
integration 负责。

部件只通过 `ui/base/primitives` 的 typed React Native 控件以 JSX 构建。`MemberRow` 因为
承载姓名、电话等业务词汇留在本包的 `components` 目录，由 `MemberList` 传入并透传
`sample.desk.member-list:row` 根 testID；它不进入 primitives 公共面。

迭代时应先扩展相应 kernel owner 的协议，再调整本包的部件或 actor；业务 partKey、
容器准入与呈现文案只在本包声明，不能下沉到 kernel。
