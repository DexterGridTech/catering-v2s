# `@catering-v2s/application-android-sample-terminal`

## 定位

本包是 TER Android sample 的应用入口与 Android 组装层。它负责把 Android adapter、平台端口和
`ui-integration-sample-console` 连接成一个可由 Expo 启动的 sample terminal；它不是业务 owner，
不持有会员、店员或 runtime 的业务状态，也不在这里实现虚拟键盘、业务 part 或领域 command。

## 作用

只有需要把 Android 平台实现注入 sample assembly、或需要把 React Native `App` 暴露给 Expo
启动器的内容才属于本包。端口能力的语义由 `kernel-base-platform-ports` 定义，Android 的真实
实现由各 adapter 持有，sample 的界面与 runtime 由 `ui-integration-sample-console` 组装；本包
不复制这些 owner 的逻辑，不读取业务 state，也不按屏幕数量增加业务分支。

## 结构

```text
App.tsx                         Expo React 根组件；等待 assembly 后按 displayIndex 呈现 surface，注入 render-owned failure page
src/components/controlledKeyboardHarness.tsx  只供受管键盘验证的 full-layout 空输入 harness；默认启动不进入
src/index.ts                    包元数据公开面：moduleName 与依赖模块名
src/moduleName.ts               本 application 的固定 moduleName
src/dependencies.ts             Android base、render 与 sample-console 的模块依赖列表
src/assembly/platformPorts.ts   Android binding、logger 与 sample assembly 的组装接缝
android/                        Expo 原生工程与 Android 构建配置
app.json                        Expo 应用配置
```

`src/assembly/platformPorts.ts` 是 assembly 内部实现文件，不是业务 feature 公共 API；它只负责
构造一次 platform ports，并把 `PRIMARY`/`SECONDARY` 的 IME source 接给 sample assembly。
副屏是否创建、Presentation 生命周期与系统权限属于 Android carrier adapter，不在本包复制。

## 用法

通过 Expo 根入口启动本包：

```ts
import {registerRootComponent} from 'expo'
import App from './App'

registerRootComponent(App)
```

`App` 的真实公开入口是默认导出的 React 组件；Expo 会传入可选的 `displayIndex`（`0 | 1`），
组件再调用内部的 `createSampleTerminalAssembly({surfaceForm})` 和
`createSurfaceForDisplayIndex()` 完成对应 surface 的呈现；assembly 被拒绝时只把失败事实
交给来自 `ui.base.render` 的 `StandaloneStartupFailurePage`，不在 App 自绘失败 UI 或调用
splash。库消费者不应绕过 `App` 自己创建第二个 React host、runtime 或 store。
本 Android application 的 `package.json.serverSpaces` 是该入口唯一的内置服务配置。`platformPorts.ts`
在创建 integration assembly 时显式传入它；它不继承或合并 `sample-console` integration 的默认列表。

受管键盘验证器可向已运行的主屏 Activity 发送精确 URI `ter-vk://controlled/full`，进入
`InputSurfaceFrame` 内的空 full-layout harness，用于验证 URL 符号实际插入；副屏和正常启动
不进入该页面。它不是业务 part、字段或提交路径，harness 截图也不计入生产 IA 帧分母。

`App` 是唯一保留 `surfaceForm='laptop'` 默认值的外层入口；它把解析后的形态显式传给
`createSampleTerminalAssembly`，Android wrapper 与 sample-console assembly 不再各自兜底。
Android 运行时使用本包 `package.json` 的 `terminalSurfaces` 整份覆盖 integration 默认值；integration 仍按 `surfaceForm` 选择对应声明。
Android 运行时使用本包 `package.json` 的 `showAdminPassword` 控制 admin 登录提示旁是否显示当前动态口令。

进入 admin console 后，laptop/mobile 的 master-detail 或可换行 tablist 版式由 integration 接入的
`ui.base.admin-shell` renderer 提供；内容标题以 polite live region 通知，关闭与返回沿用 terminal layer 的焦点恢复边界。

## 在这个包上迭代时

先读当前 Android adapter、platform-ports 与 sample-console 的公开契约，再改本包的装配；新增
平台能力必须先由对应 adapter 与 platform-ports owner 定义并补 focused proof，不能在这里添加
临时 fallback 或业务判断。改完至少运行：

```text
yarn --cwd apps/terminal/application/android/sample-terminal typecheck
```

若变更触及 Android carrier、Presentation 或真实副屏输入，还必须按对应授权边界取得 Android
证据；本包的 TypeScript typecheck 不等于真实设备或副屏行为已验证。特别不要把
`platformPorts.ts` 重新放回 `src/` 根目录；当前实现位于 `src/assembly/`。
