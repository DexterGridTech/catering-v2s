# TER admin shell

本包承载终端本地、只读的 admin console shell。它负责管理员入口、身份口令纯函数、
后续的 section 导航与诊断内容组合；不拥有业务 feature、不写业务数据，也不创建第二套
layer、catalog 或输入管线。

当前结构：

- `src/foundations/`：身份、口令、section 选择和真实控件 test ID 等无 UI 规则；
- `src/components/`：console layer、登录和只读 section 的 React Native 呈现；`AdminLauncher` 是包住业务内容的普通 `View` 观察器，不是会吞掉业务触摸的独立 `Pressable`；
- `src/foundations/adminTestIds.ts`：真实控件与 focused/L2 绑定共用的 test ID 单源。

入口手势由 `AdminLauncher` 在原生观察业务内容祖先上的触摸结束事件，在 Web 观察同一祖先上的点击事件；两种平台事件互斥绑定。
它先兼容解析原生 RN、Web TouchEvent 与 Web MouseEvent 的窗口坐标，再用测得的窗口原点和宿主/画布比例调用
`foundations/adminLauncher.ts#logicalPointFromWindow`，把逻辑坐标交给同一个纯手势跟踪器；96×96 阈值因此按逻辑画布而不是窗口像素判定。
观察器没有自己的 press responder、绝对定位覆盖层或业务控件回调，阈值以下的业务后代仍由原控件处理。

使用时由 integration assembly 注入真实的 platform/runtime/display facts，并把本包的
`adminShellAssembly` 合并到同一个 `UiCatalog`。调试态只读 assembly/runtime facts；迭代时先扩展既有 owner API 或契约，
再修改本包的呈现；不得引入业务 feature import、持久化认证、第二个注册表或新的
navigation/input owner。

登录口令使用 `@catering-v2s/ui-base-input` 的同一 `InputKeyboard` 公共呈现入口，并选择
`keyboardPlacement: 'field'` 将键盘放在登录卡片内。其他业务 UI 如需独立 surface dock，使用
`keyboardPlacement: 'surface'` 并让 `InputSurfaceFrame` 自动挂载同一个 presenter；两种方式的
接入示例、provider 边界和禁止事项以 `apps/terminal/ui/base/input/README.md` 为准，不要在本包或业务包
直接拼接 `VirtualKeyboard`。
