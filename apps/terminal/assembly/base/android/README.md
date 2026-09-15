# Android 基础装配

## 定位

`assembly.base.android` 是 TER terminal 两个 Android App 共用的原生能力装配包。它
拥有 `NativeLoadingCapability` 的 provider 与 Expo splash JS 入口，不拥有业务状态、
渲染树、failure page、picker 选择或 App 身份。

## 结构

- `src/moduleName.ts`：模块名与包的公开身份。
- `src/dependencies.ts`：该装配包声明的 workspace 依赖。
- `src/foundations/nativeLoadingCapability.ts`：module-scope prevent 与幂等 hide provider。
- `src/index.ts`：唯一公开入口和 capability 类型转出。
- `terminal-invariants.json`：公开面的静态不变量。

两个 App 的 `MainActivity`、Theme.SplashScreen、Gradle linking 和原生资源仍是各自
提交工程的真实读取入口；本包只提供可注入能力，不把 Activity 或 App 配置复制进来。

## 用法

App assembly 在构造 render/runtime 时创建本包的 provider，并把 required capability
传给共享 render assembly；assembly rejection 的 UI 也必须由 App 注入 render-owned
`StandaloneStartupFailurePage`，本包不自绘 failure page 或另起一条 hide reason。provider
的目标固定为物理 PRIMARY surface；业务 feature 不得直接调用 Expo splash API，也不得以
no-op capability 兜底。

## 迭代边界

在这个包上迭代时，先同步 `doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md`
的 D-5/D-6 与 `terminal-invariants.json`，再核对两个 App 的原生注册顺序和资源编译
入口。不要在此加入 feature、integration、runtime state 或第二条 loading bridge；
修改后必须跑对应 static/focused/native proof。
