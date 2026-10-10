# Android 基础装配

## 定位

`application.base.android` 是 TER terminal 两个 Android App 共用的原生能力装配包。它
拥有 `NativeLoadingCapability`、Android platform binding，以及只在受管自动化构建中启用的
更新目标 source provider；不拥有业务状态、渲染树、failure page、picker 选择或 App 身份。

## 结构

- `src/moduleName.ts`：模块名与包的公开身份。
- `src/dependencies.ts`：该装配包声明的 workspace 依赖。
- `src/foundations/nativeLoadingCapability.ts`：module-scope prevent 与幂等 hide provider。
- `src/foundations/androidAutomationUpdateTargetSourceProvider.ts`：读取受管自动化构建注入的更新目标；生产构建返回未配置状态。
- `src/index.ts`：唯一公开入口和 capability 类型转出。
- `terminal-invariants.json`：公开面的静态不变量。

两个 App 的 `MainActivity`、Theme.SplashScreen、Gradle linking 和原生资源仍是各自
提交工程的真实读取入口；本包只提供可注入能力，不把 Activity 或 App 配置复制进来。

## 用法

App assembly 在构造 render/runtime 时创建本包的 binding，并把 required capability
传给共享 render assembly；assembly rejection 的 UI 也必须由 App 注入 render-owned
`StandaloneStartupFailurePage`，本包不自绘 failure page 或另起一条 hide reason。provider
的目标固定为物理 PRIMARY surface；业务 feature 不得直接调用 Expo splash API，也不得以
no-op capability 兜底。

`AndroidPlatformBinding.terminalUpdateSourceProvider` 只在受管自动化构建变量完整时提供
run-scoped fixture source；Android app assembly 将它传给 integration 的
`terminalUpdateSourceProvider` 输入。常规构建下该值为 `undefined`，真实版本规则仍由
project-basic 和 terminal-update owner 处理。

## 迭代边界

在这个包上迭代时，先同步 `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md`
的 D-5/D-6 与 `terminal-invariants.json`，再核对两个 App 的原生注册顺序和资源编译
入口。不要在此加入 feature、integration、runtime state 或第二条 loading bridge；
修改后必须跑对应 static/focused/native proof。

Android 启动时由 `TerminalExpoSplashScreen.prepareActivity` 在共享包内统一设置
`SplashScreenManager.preventAutoHideCalled`，再注册 Activity；两个 App
不得重复直接访问该未文档成员。当前只保留这一处访问，升级 `expo-splash-screen` 时必须复核。

Expo 启动画面只在 `NativeLoadingCapability.hideOnce` 已释放 Activity-owned gate 后由公开的
`SplashScreen.hide()` 释放；Activity 初始化阶段不得提前调用 `SplashScreenManager.hide()`。

`TerminalNativeLoadingRegistry` 在 Android Application 进程范围持有 Activity lifecycle callbacks。
Expo module 的 `OnCreate` 只排队注册；JS module reload / `OnDestroy` 不得注销这组 Application
callbacks。每个 Activity 销毁时只清理该 Activity 自己的 gate。Expo `AsyncFunction` 与 lifecycle
callback 不得在 JS 线程同步等待主线程任务。

Android 的 Tailwind shared color mapping 包含全部 `keyboard-*` 语义名；两个 Android App 继续从各自 integration 的 `global.css` 读取 RGB，base config 不保存应用颜色。
