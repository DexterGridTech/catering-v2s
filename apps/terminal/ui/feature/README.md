# UI feature boundary

UI feature 包拥有业务功能的呈现部件、uiVariable、呈现命令、actor 与组装描述。
业务命令、领域结果事件和 owner selector 由 kernel owner 提供；UI feature 不在
kernel 中放业务状态或业务命令，也不复制 owner 的状态。

当前 sample 验证切片包含 `sample-staff-auth` 与 `sample-member-desk`。每个包只
导出一份组装描述，包含 parts、variables 与 `createModule` 工厂；integration 将
这些描述组装进同一个 runtime。UI feature 不拥有 runtime，也不负责平台启动。
