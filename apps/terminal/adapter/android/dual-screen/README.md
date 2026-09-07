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

## ReactSurface 的密度基线

副屏的 Presentation 仍使用目标 display 的 `Context` 与窗口主题，但交给 React Native
`ReactSurface` 的 context 会复制主 Activity 的 `densityDpi`。原因是 RN 0.86.3 的部分全局
`PixelUtil` 计算以主 React host 的 density 为基线；若直接把副屏 display context 交给
surface，副屏文字与控件会按另一套 density 解释，出现字号放大、内容截断或两屏比例不一致。
因此 carrier 在 `createSurface` 前只规范化 `densityDpi`，不改 Presentation 的真实 display
上下文、窗口边界、业务 props 或 assembly；主屏与副屏随后共享同一套 RN 尺寸基线。

这条是当前 Expo SDK 57 + React Native 0.86.3 carrier 的运行时契约，不是业务包的视觉逻辑。
其他 assembly 只要复用本 adapter 的 host/surface 接线即可继承它，不应在 assembly、integration
或 feature 中自行设置字体缩放、density 或平台判断。若未来替换 Expo/RN carrier 或使用不同
的 host 实现，必须重新验证主副屏的 density 基线，不能把本段当成所有版本的通用保证。

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

主屏的 system IME inset 由 `TerminalImeInsetsCoordinator.kt` 按 Activity window 生命周期安装、
发布不可变 snapshot，并由 `TerminalImeInsetsEventBus` 转给 JS；它只监听 PRIMARY，不修改
runtime/store。`TerminalPresentation` 不安装 system-IME listener：SECONDARY 的当前产品边界
是只使用虚拟键盘。若将来副屏需要 system IME，必须另开 scoped keyboard/IME 设计，不能把主屏
snapshot 推断为副屏能力。

结构：`TerminalDualScreenModule.kt` 是 Expo module 声明，`TerminalDualScreenPackage.kt`
是 Expo package 注册，`TerminalDualScreenActivityHandler.kt` 负责主屏 launch options、
Presentation、ReactSurface 生命周期与 carrier 诊断；`TerminalImeInsetsCoordinator.kt`
负责主屏 system-IME inset 监听与 event bus 发布。

迭代指引：任何 carrier 改动先用当前 Expo/RN 的公开 API 和同一 host/store 反证，保留真实
生命周期失败证据；禁止反射 RN 私有字段、增加第二实例后备路径，或借修改业务层绕过 Android
承载问题。
