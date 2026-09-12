# `@catering-v2s/adapter-android-dual-screen`

本包是 Android 双屏 carrier。它把主 Activity 的既有 React host 复用于第二个
`ReactSurface`，并以 `Presentation` 承载副屏 view。它不创建第二个 host、React instance、
JS VM、store、进程或 React 实例，也不把业务 part、catalog、surface mode 或业务 state 带入 Kotlin。

## 组装与初始属性

Expo SDK 57 的模块配置只注册 `TerminalDualScreenModule`；`TerminalDualScreenPackage.kt`
按 Expo autolinking 的 `*Package.kt` 约定被加入生成的 `ExpoModulesPackageList.packagesList`，
再由 `createReactActivityHandlers` 提供主 Activity handler。handler 在 Activity delegate 创建时
同步读取一次 `DisplayManager.getDisplays()`，保留不可变快照：少于两块显示器时不创建副屏，
否则选择第一个非默认显示器。

同一快照同时供两条入口使用：主屏返回一个以既有 `mainComponentName`、公开 `ReactHost` 和
RN 当前 `fabricEnabled` 为基础、只覆盖 `getLaunchOptions()` 的 delegate，送入
`displayIndex=0` 与 `displayCount`；副屏用同一 host、同一已注册组件和 Presentation context
调用 `createSurface`，送入 `displayIndex=1` 与相同 `displayCount`。两个入口不重新读取、不共享
后续缓存，也不要求 MainActivity 或 assembly 增加 bootstrap。

## ReactSurface 的逻辑分辨率基线

副屏的 `Presentation` 使用目标 display 的 `Context` 与窗口主题；交给 React Native
`ReactSurface` 的 context 则对齐同一 RN runtime 已建立的共享 render `densityDpi`，不能把
目标 display 的 hardware `densityDpi` 当成第二套 RN Text/layout density。carrier 在
`createSurface` 前分别读取目标 `Display` 的硬件 metrics 与 RN 的
`DisplayMetricsHolder.screen`，并只在 surface context 的 `Configuration` 中设置共享 render
density；不复制主 Activity 的窗口边界、业务 props 或 assembly，也不改写 RN 全局 metrics。

本包使用 RN runtime 级共享 render density，但它不是画布声明的第二个真相源，也不是逐值
scaler。`hardwareDensity*` 表示目标 display 的硬件事实，`surfaceDensity*` 表示 React
surface 与 host logical conversion 实际使用的共享 RN render density；两者可以不同，必须
分别记录，不能互相替代，也不能按 surface 改写 `DisplayMetricsHolder`。当前模拟器预期为
PRIMARY `320/320`、SECONDARY `213/320`（hardware/surface）。

因此，目标 display 的 raw 分辨率与 density 只用于 carrier 的 context/资源配置和承载事实
诊断；它不再推导业务画布声明。横屏 sample 的固定逻辑画布由 host 声明为 PRIMARY
`1280×800`、SECONDARY `960×540`；当前模拟器副屏的 `1280×720 physical px / 213 dpi`
只是硬件显示配置，承载层再把各自画布映射到实际窗口。主屏与副屏共享
同一个 React host/store，但各自的 surface 必须使用自己的 display/window snapshot；目标
display hardware density diagnostics、共享 RN render density 与固定画布 scale 是独立步骤。

carrier 同时通过 `TerminalDualScreenModule` 暴露 `getSurfaceHostSnapshot(surfaceKey)` 与
`onSurfaceHostChanged`。snapshot 的 `surfaceKey` 只使用既有 `PRIMARY`/`SECONDARY` 值，
并绑定 display id、window identity 与 generation；它不是 `DevicePort`、`DisplayInfo` 或
`PlatformPortBindings` 的扩展。当前经 CP-0 选定的 host measurement policy 是
`owner-decorView-layout`：stable/current raw bounds 从实际 Activity 或 Presentation 的
`decorView` layout snapshot 读取，surface render density 从该 surface view 的资源与共享 RN
runtime 关联记录；hardware density 另从 owner display 读取。IME 只更新独立的 inset 字段，
不重算 stable host size。尚未获得有效 bounds 或 density 时 adapter 不发送可用 snapshot，也不以
声明画布或另一块屏幕的尺寸补值。

这条是当前 Expo SDK 57 + React Native 0.86.3 carrier 的运行时契约，不是业务包的视觉逻辑。
其他 assembly 只要复用本 adapter 的 host/surface 接线即可继承它，不应在 assembly、integration
或 feature 中自行设置字体缩放、density 或平台判断。若未来替换 Expo/RN carrier 或使用不同
的 host 实现，必须重新验证主副屏的逻辑 frame 与 density 基线，不能把本段当成所有版本的通用保证。

## 生命周期与失败

副屏使用显式的 AppCompat 无 ActionBar Presentation 主题，使 React Native 的 AppCompat
控件在目标 display context 中获得与主 Activity 一致的主题基线；这只是 carrier 的运行时兼容
上下文，不是业务 UI 样式。副屏状态只持有 Presentation、ReactSurface 和幂等标记。创建已请求、已有实例时直接返回；
创建/启动失败会释放已创建对象并回滚请求标记。`ReactSurface.start()`／`stop()` 的 task
在 daemon 后台线程观察，UI 线程只负责发起 stop 与执行 `detach`、`clear`、dismiss，严格保持
`stop → detach → clear`，stop 失败也不跳过后续清理。副屏拔出或主 Activity 销毁只收副屏，
不停止、不替换主屏 surface。

## 与其他层的边界

`device` 负责实时只读的显示观测；本包只负责这个 Android carrier，不实现 `TopologyHostPort`
或 `localWebServer`，不承载双机协议。双屏业务语义仍由 kernel/display-context 与 UI assembly
决定。本实现的 focused/Android 证据必须区分双屏 Android 模拟器验证与未覆盖的真实 POS 硬件；
不得把模拟器结果表述成厂商 ROM、真实 DPI 或性能已验证。

输入统一由 JS 侧的 virtual keyboard 承载；carrier 不采集、不发布、不向 render 合并系统 IME
inset。若将来需要其他输入承载形态，必须另开 scoped keyboard/IME 设计，不能把 carrier 的
host snapshot 推断为输入能力。

结构：`TerminalDualScreenModule.kt` 是 Expo module 声明与 JS bridge，`TerminalDualScreenPackage.kt`
是 Expo package 注册，`TerminalDualScreenActivityHandler.kt` 负责主屏 launch options、
Presentation、ReactSurface 生命周期、per-surface host registry 与 carrier 诊断。

迭代指引：任何 carrier 改动先用当前 Expo/RN 的公开 API 和同一 host/store 反证，保留真实
生命周期失败证据；禁止反射 RN 私有字段、增加第二实例后备路径，或借修改业务层绕过 Android
承载问题。
