# TER admin shell

本包承载终端本地、只读的 admin console shell。它负责管理员入口、身份口令纯函数、
后续的 section 导航与诊断内容组合；不拥有业务 feature、不写业务数据，也不创建第二套
layer、catalog 或输入管线。

当前结构：

- `src/foundations/`：身份、口令、section 选择和真实控件 test ID 等无 UI 规则；
- `src/components/`：console layer、登录和只读 section 的 React Native 呈现；
- `src/foundations/adminTestIds.ts`：真实控件与 focused/L2 绑定共用的 test ID 单源。

使用时由 integration assembly 注入真实的 platform/runtime/display facts，并把本包的
`adminShellAssembly` 合并到同一个 `UiCatalog`。调试态只读 assembly/runtime facts；迭代时先扩展既有 owner API 或契约，
再修改本包的呈现；不得引入业务 feature import、持久化认证、第二个注册表或新的
navigation/input owner。
