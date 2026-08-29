# `@next/host-runtime-rn84`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 F · F10** —— 宿主半边重建，只依赖地基批（现依赖 18 个包） |
| 路径 | `3-adapter/android/host-runtime-rn84` |
| 规模 | TS **4,240 行 / 59 文件**；Kotlin **4,026 行 / 23 文件**；test **0** |
| 依赖 | **18 个 `@next` 包**（kernel base 全部 + ui base 全部 + adapter + server-config） |
| 被依赖 | 1（assembly 的 `App.tsx`） |
| 状态 | 活跃；**"可复用宿主"，也是 assembly 极薄的原因** |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。


## 1 · 作用与目的

**产品无关的 RN84 Android 宿主运行时。**
把 kernel base 模块、UI base 模块、platform ports、native wrapper、automation、
hot-update、topology host 生命周期、RN84 启动机制组合成一个可直接用的宿主。

`3-adapter/android/README.md` 的边界：
> 它不得依赖 `1-kernel/1.2-business/*`、`2-ui/2.2-business/*`、`2-ui/2.3-integration/*` 中具体业务 shell。
> 产品业务由 `4-assembly/android/*` 注入 integration shell。

**实测符合**：18 个依赖里零业务包。

## 2 · TS 侧五块

| 目录 | 文件数 | 内容 |
|---|---|---|
| `platform-ports/` | 8 | `createPlatformPorts` + logger / stateStorage / hotUpdate / topology / transport / tdpSync / terminalLogs / reactotron |
| `turbomodules/` | 18 | 9 个 `specs/Native*TurboModule.ts` + 9 个 TS 包装 |
| `application/` | 21 | `createApp` · `bootstrapRuntime` · automation（4 文件）· topology（3 文件）· hotUpdate 同步 · 版本上报 · outbox · adminConsoleConfig |
| `hostApp/` | 1 | `createHostApp.tsx` —— 产品注入点 |
| `types/` | 3 | `AppProps` · `TopologyLaunch` |

### 2.1 产品注入点

```ts
createHostApp({
    RootScreen,                    // 产品根屏
    createShellModule,             // 产品 shell 模块
    extraKernelModules,            // 产品业务模块
    productConfig: {productId, moduleName, appRegistryName, logTag,
                    releaseInfo, adbSocketDebugEnabled, activationCapability},
})
```

**四个注入点，全部有类型。** assembly 只填这四个 + 产品配置值。

### 2.2 存储的双层与闸门

`createAssemblyStateStorage(layer, {shouldDisablePersistence})` ——
两个 layer（`state` / `secure-state`）各一个 MMKV namespace，
外加一个**闸门函数**：managed secondary 时禁止本地业务持久化
（topology 设计文档 §6.4 的规则落点）。

⚠️ `secure-state` 未加密，见 `a-01` §4。

## 3 · Kotlin 侧：启动编排是核心

| 文件 | 行数 | 内容 |
|---|---|---|
| `turbomodules/*.kt` | 1,791 | 9 个 TurboModule 原生实现 |
| `MainActivity.kt` | 254 | 主屏 Activity |
| `startup/StartupOverlayManager.kt` | 213 | 启动遮罩 |
| `restart/AppRestartManager.kt` | 209 | App 重启 |
| `startup/StartupAuditLogger.kt` | 192 | 启动审计日志 |
| `startup/StartupCoordinator.kt` | 172 | **启动编排** |
| `startup/SecondaryProcessController.kt` | 154 | 副屏跨进程生命周期 |
| `SecondaryActivity.kt` | 137 | 副屏 Activity（`:secondary` 进程） |
| `startup/SecondaryDisplayLauncher.kt` | 112 | 副屏投屏启动 |
| `startup/TopologyLaunchCoordinator.kt` | 104 | 拓扑启动参数 |
| `HotUpdateBundleResolver.kt` | 95 | 热更新 bundle 解析 |
| `startup/LaunchOptionsFactory.kt` | 93 | **按屏产出 launch options** |
| `startup/ReactLifecycleGate.kt` | 11 | RN context 未就绪时拦截转发 |

### 3.1 启动编排（`StartupCoordinator`，注释原文）

```
- 主屏 onAppLoadComplete(0) 后 1.5 秒关闭遮罩；
- 主屏 onAppLoadComplete(0) 后 3 秒启动副屏；
- 两者并行，不是串行。
```

冷启动显示遮罩、重启跳过遮罩；只认 `displayIndex === 0` 的 ready 信号，
**副屏 ready 不会反向干扰主屏编排**；另有热更新健康检查超时。

### 3.2 `ReactLifecycleGate`（11 行，但很关键）

RN context 未就绪时，拦截 `onNewIntent` / `onWindowFocusChanged` 不转发给 RN，
避免早期生命周期事件打到未初始化的 React 上。

## 4 · 优点

1. **assembly 只剩 30 行的原因就是这个包**（`KEEP-16`）。
   宿主机制与产品配置被干净地分开。
2. **四个注入点全部有类型**（§2.1），产品接入面窄且明确。
3. **零业务包依赖**，边界守住了（§1）。
4. **启动编排从 Activity 里抽出来**（§3.1），并且写明了三条时序约定与并行关系。
5. **`ReactLifecycleGate`** —— 11 行解决一类真实崩溃（§3.2）。
6. **`StartupAuditLogger` 192 行专门做启动审计**，
   冷启动/重启/副屏启动/加载完成/进程退出各有日志。现场排"起不来"靠它。
7. **9 个 TurboModule 有独立 spec 文件**（`specs/Native*TurboModule.ts`），
   codegen 契约与 TS 包装分开。
8. **存储闸门**（§2.2）把"managed secondary 不本地持久化"落到了实处。
9. **`assemblyPowerDisplaySwitch` 等 Priority A 项已迁入本包**，
   assembly 不再持有域决策（`layered-runtime-communication-standard.md` 的目标形态已达成）。

## 5 · 缺点 / 风险

1. **零测试。** 4,240 行 TS + 4,026 行 Kotlin，**没有 `test/` 目录**。
   assembly 那边有 4,991 行测试，很多实际在测本包的行为（`assembly-create-app.spec.ts` /
   `assembly-platform-ports.spec.ts` / `assembly-bootstrap-runtime.spec.ts` 等）——
   **测试写在了被测代码的下游包里**。
2. **依赖 18 个包**，是全仓最多。它必须知道所有 base 能力才能装配，
   但这也意味着任何 base 包的公开面变化都会波及这里。
3. **副屏靠独立进程 + 跨进程广播**（`SecondaryProcessController` 四条广播 + `killProcess`），
   整套协议的存在理由只有 `android:process=":secondary"`（`FIX-17`）。
4. **`secure-state` 未加密**（`a-01` §4 的上游一环）。
5. **包名带框架版本 `rn84`**（`FIX-02`）。TER 换 Expo 后这个名字当天就错。
6. **`application/` 21 个文件**里混着宿主机制（createApp / bootstrap / launch）与
   产品策略残留（`adminConsoleConfig` 505 行的 host tools 工厂、版本上报地址选择、outbox）。
   `layered-runtime-communication-standard.md` Priority D 把后几项列为"只有满足全部条件才可留"。
7. **`reactotronConfig.ts` 在 platform-ports 里** —— 调试工具进了端口层。

## 6 · 【TER 关键】这个包是"一个 ReactHost 挂多 surface"的改造现场

Dexter 已裁定的形态，对本包的改动集中在三处：

| 当前 | TER |
|---|---|
| `AndroidManifest` 上 `SecondaryActivity` 带 `android:process=":secondary"` | **去掉该属性**，两个 Activity 同进程共享 `ReactHost` |
| `SecondaryActivity extends ReactActivity`，驱动 `onHostResume/Pause` | **不继承 `ReactActivity`**，自行 `reactHost.createSurface(...)`，**不驱动** host 生命周期（`CON-01`） |
| `SecondaryProcessController` 四条广播 + `killProcess` | **整体删除**（`FIX-17`） |
| `LaunchOptionsFactory.create(context, displayIndex)` | **原样可用**，从"进程参数"变成"surface `initialProps`"（`KEEP-21`） |
| `StartupCoordinator` 的 3 秒副屏延迟 | 同进程后可重新评估（不再需要等第二个 JS 环境起来） |

## 7 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **"可复用宿主 + 四个注入点"的形态整体继承** | assembly 极薄的前提（§4.1） |
| 2 | **包名去掉框架版本**，按能力命名（如 `host-runtime`） | `FIX-02` |
| 3 | **补测试**，或把 assembly 里测本包行为的那部分测试迁回来 | §5.1；4,991 行测试放在下游包是错位 |
| 4 | **`application/` 拆成"宿主机制"与"产品策略"两组**，后者移出或明确为注入项 | §5.6 |
| 5 | **多 surface 改造三处**（§6） | 讨论稿 §7.2 |
| 6 | **`StartupCoordinator` / `StartupAuditLogger` / `ReactLifecycleGate` 整体继承** | 启动期问题最难查，这三件是现成资产（§4.4-4.6） |
| 7 | **TurboModule spec + TS 包装的分离形态**，映射到 expo-module 的 `ModuleDefinition` + TS 类型 | `a-01` §7.1 |
| 8 | **`reactotronConfig` 移出 platform-ports** | §5.7 |
| 9 | **存储闸门保留**，但一个 store 后闸门条件会简化（只有一个持久化 owner） | §2.2 + 讨论稿 §7.2 |

## 8 · 证据档位

`已亲验`：TS 与 Kotlin 全部文件清单与行数、`package.json` 的 18 个依赖、
`platform-ports/stateStorage.ts` 全文、`platform-ports/transport.ts` 的 `createAssemblyFetchTransport`、
`startup/StartupCoordinator.kt` 前 70 行（三条时序约定）、`SecondaryActivity.kt` 全文、
`startup/SecondaryDisplayLauncher.kt` 前 80 行、`startup/LaunchOptionsFactory.kt` 全文、
`hostApp/createHostApp.tsx` 前 80 行、assembly `AndroidManifest.xml` 全文。
"零测试"为 `已亲验`（无 `test/` 目录）。
**未逐行读**：9 个 TurboModule 的 Kotlin 实现（1,791 行）、`adminConsoleConfig.ts` 505 行、
`application/automation/` 四个文件。
