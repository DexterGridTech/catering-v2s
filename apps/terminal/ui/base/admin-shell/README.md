# TER admin shell

本包承载终端本地的 admin console shell。它负责管理员入口、身份口令纯函数、
section 导航与诊断内容组合；不拥有业务 feature 或业务事实，也不直接写业务数据，也不创建第二套
layer、catalog 或输入管线。

当前结构：

- `src/foundations/`：身份、口令、section 选择和真实控件 test ID 等无 UI 规则；
- `src/components/`：console layer、登录、诊断和拓扑 section 的 React Native 呈现；`AdminLauncher` 是包住业务内容的普通 `View` 观察器，不是会吞掉业务触摸的独立 `Pressable`；
- `src/foundations/adminTestIds.ts`：真实控件与 focused/L2 绑定共用的 test ID 单源。

公共面由 `src/index.ts` 导出；除模块元数据、assembly 与组件外，事件坐标归一化的
`adminLauncherPointFromEvent`、手势状态/跟踪函数和 admin identity/test ID 常量也属于
受 invariant 锁定的 owner API。新增导出时必须同步更新 `terminal-invariants.json` 与
public-surface focused test，不得让 README 或 invariant 漂移。

入口手势由 `AdminLauncher` 在原生观察业务内容祖先上的触摸结束事件，在 Web 观察同一祖先上的点击事件；两种平台事件互斥绑定。
它先兼容解析原生 RN、Web TouchEvent 与 Web MouseEvent 的窗口坐标，再用测得的窗口原点和宿主/画布比例调用
`foundations/adminLauncher.ts#logicalPointFromWindow`，把逻辑坐标交给同一个纯手势跟踪器；96×96 阈值因此按逻辑画布而不是窗口像素判定。
窗口原点在本节点布局、窗口尺寸、画布声明或宿主逻辑尺寸变化后重新测量，并清除跨几何变更的未完成手势；事件使用最近一次完成测量的坐标空间。
观察器没有自己的 press responder、绝对定位覆盖层或业务控件回调，阈值以下的业务后代仍由原控件处理。

使用时由 integration assembly 注入真实的 platform/runtime/display facts，并把本包的
`adminShellAssembly` 合并到同一个 `UiCatalog`。调试态只读 assembly/runtime facts；迭代时先扩展既有 owner API 或契约，
再修改本包的呈现；不得引入业务 feature import、持久化认证、第二个注册表或新的
navigation/input owner。

运行状态页中的“逻辑分辨率”指每个 surface 的应用逻辑画布声明；设备逻辑显示区域仅用于该屏矩形比例，物理像素尺寸来自同一 surface 的 display facts。主屏和副屏都必须逐屏显示各自的逻辑分辨率、物理尺寸与状态，不因当前渲染屏而省略或借用数值。

拓扑 section 只接收 `TopologyAdminCapability` 这一窄能力：事实由 capability 读取，配对、解绑和
主机服务操作委托给 topology owner，admin-shell 不取得 Runtime、stateSource、platform port 或原生
lifecycle。拓扑 tab 在 laptop/mobile 都恒显；mobile 以禁用控件和可读原因表达限制。电源角色切换由
display-context 的 request/confirm/cancel owner 驱动，确认层是 PRIMARY-only 的临时 decisive layer，
不在 admin-shell 持久化事实。

装配后的 laptop renderer 使用 list/button 导航与 master-detail 内容区，mobile renderer 使用可换行的
tablist/tab；详情标题通过 polite live region 通知选择变化。LayerStack 只通过 input owner 的
suspend/restore 接缝清除焦点与键盘；关层不会隐式恢复先前字段焦点，不新增第二套焦点或返回管线。

登录口令使用 `@catering-v2s/ui-base-input` 的共享 `InputSurfaceFrame` 键盘覆盖层；键盘不嵌入登录卡片，
卡片与页面保持完整布局尺寸，由 surface presentation 与焦点避让机制统一处理。接入示例、provider 边界和
禁止事项以 `apps/terminal/ui/base/input/README.md` 为准，不要在本包或业务包直接拼接 `VirtualKeyboard`。
