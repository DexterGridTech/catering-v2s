# `@catering-v2s/application-android-sample-wallpaper-terminal`

## 定位

本包是 TER sample2 壁纸终端的 Android Expo 入口与组装层。它把 Android adapter、平台端口和
`ui-integration-sample-wallpaper-console` 连接成一个可启动的独立应用；它不是壁纸、认证、
浮层或渲染基础件的 owner。

## 作用

本包只负责一次 platform-port 绑定、Expo 根入口、Android 工程身份和把 adapter 的
`displayIndex`/`surfaceForm` 传给 integration。壁纸状态由 `kernel.feature.sample-wallpaper`
持有，图片与 picker 由 `ui.feature.sample-wallpaper-picker` 持有，主副屏 placement 与
surface 由 `ui.integration.sample-wallpaper-console` 持有；本包不复制这些逻辑，也不按屏幕
数量建立第二个 runtime、store、catalog 或 Image seam。

## 结构

```text
App.tsx                         Expo React 根组件；等待 assembly 后呈现指定 displayIndex，注入 render-owned failure page
src/components/controlledKeyboardHarness.tsx  只供受管键盘验证的 full-layout 空输入 harness；默认启动不进入
index.ts                        Expo registerRootComponent 入口
src/assembly/platformPorts.ts   Android port binding、logger 与 sample2 assembly 连接
src/dependencies.ts             assembly、render 与 integration 的 workspace module 依赖声明
src/moduleName.ts               固定 moduleName 转发
app.json                        独立 slug、applicationId、Android adaptive icon 与 favicon
android/                        Expo prebuild 生成的 Android 工程
```

`app.json` 的工程身份固定为 `sample-wallpaper-terminal` 与
`com.catering.v2s.terminal.samplewallpaper`；不使用 Expo 默认的 `com.anonymous.*`，也不写
固定 orientation。方向与形态由 `adapter/android/dual-screen` 在 delegate 创建时决定，再由
launch options 传给 `App`。

## 用法

```ts
import {registerRootComponent} from 'expo'
import App from './App'

registerRootComponent(App)
```

Android 正常入口由 adapter 传入 `displayIndex` 与 `surfaceForm`。App 默认只为缺失 launch
options 的受批准 fallback 使用 `displayIndex=0`、`surfaceForm='laptop'`；它不按窗口宽度
重新判断设备形态。mobile 不创建副屏，laptop 的副屏由 adapter 的既有 Presentation 路径
创建并使用相同的 integration assembly。
受管键盘验证器可向已运行的主屏 Activity 发送精确 URI `ter-vk://controlled/full`，进入
`InputSurfaceFrame` 内的空 full-layout harness，用于验证 URL 符号实际插入；副屏和正常启动
不进入该页面。它不是业务 part、字段或提交路径，harness 截图也不计入生产 IA 帧分母。
Android 运行时使用本包 `package.json` 的 `terminalSurfaces` 整份覆盖 integration 默认值；integration 仍按 `surfaceForm` 选择对应声明。
本 Android application 的 `package.json.serverSpaces` 是该入口唯一的内置服务配置。`platformPorts.ts`
在创建 integration assembly 时显式传入它；它不继承或合并 `sample-wallpaper-console` integration 的默认列表。
Android 运行时使用本包 `package.json` 的 `showAdminPassword` 控制 admin 登录提示旁是否显示当前动态口令。

进入 admin console 后，laptop/mobile 的 master-detail 或可换行 tablist 版式由 integration 接入的
`ui.base.admin-shell` renderer 提供；内容标题以 polite live region 通知，关闭与返回沿用 terminal layer 的焦点恢复边界。

## 迭代指引

新增平台能力先检查对应 adapter 与 platform-ports 的公开契约，再在本包只接线；不要在这里
新增壁纸 registry、第二套 state、第二个 runtime、第二个 surface host 或 UI overlay。新增
图片、picker 控件或 section 必须回到各自 owner 包与同一 UiCatalog；assembly rejection 的失败页
必须复用 `ui.base.render` 的 `StandaloneStartupFailurePage`，不能在此复制 UI 或 splash 逻辑。改完至少执行本包
typecheck，并按详设/实施计划重新运行 skeleton、Android 与必要的 Web/visual proof；类型或
静态通过不等于真实设备或像素验收通过。
