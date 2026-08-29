# `@next/adapter-android-v2`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 F · F8** —— 按能力重切为 expo-module；`N-2` protected 未加密必须先修 |
| 路径 | `3-adapter/android/adapter-android-v2` |
| 规模 | **Kotlin 9,329 行**（`adapter-lib/src/main` 6,303 + dev-app + 测试）；TS **0 行** |
| 依赖 | 零 `@next/*`（经 Gradle 被 assembly 消费，不走 npm 依赖图） |
| 结构 | `adapter-lib/`（库）+ `dev-app/`（独立 Android App）+ 9 个 JUnit 测试 |
| 状态 | 活跃；**"原生能力不依赖 RN 就能验"这条的物理载体** |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。


## 1 · 作用与目的

**把 Android 平台事实与能力暴露成稳定接口。** 不依赖 React Native，
不知道业务，只提供能力。

`3-adapter/android/README.md`：
> adapter 只提供平台能力和 host 运行环境，不承载业务包依赖，不做产品业务决策。

## 2 · 能力清单（按包）

| 包 | 主文件 | 行数 | 能力 |
|---|---|---|---|
| `scripts` | `ScriptEngineManager.kt` | **844** | **QuickJS** 脚本引擎（每次 `QuickJSContext.create()` / finally destroy）+ `ScriptExecutionGate`（`ReentrantLock` 串行化） |
| `connector` | `ConnectorManager.kt` | **778** | 统一外部通道：camera 扫码 / 系统 Intent / HID 键盘 / 文件选择 |
| `camera` | `CameraScanActivity.kt` + `CameraScannerManager.kt` + `ScanOverlayView.kt` | 957 | 扫码 Activity、扫描管理、取景框 |
| `device` | `DeviceManager.kt` | 502 | 设备 ID / 平台 / 型号 / 电源状态监听 |
| `hotupdate` | `HotUpdateBootMarkerStore.kt` + `HotUpdatePackageInstaller.kt` | 570 | boot marker 读写、更新包安装 |
| `topologyhostv3` | Server / WebSocket / Runtime / Service / Manager / Json / Models | 1,030 | **设备上跑的主副配对 WS server** |
| `appcontrol` | `AppControlManager.kt` | 265 | 重启 App、清数据缓存 |
| `logger` | `LogManager.kt` | 249 | 结构化日志落盘 |
| `automation` | `AutomationSocketServer.kt` + Session / Codec / Bridge / ScriptExecutorBridge | 约 400 | 本机 socket 自动化服务端 |
| `storage` | `StateStorageManager.kt` | 129 | **MMKV** KV 存储 |

## 3 · 三个设计判断

### 3.1 接口先行

`interfaces/` 下 5 个接口 + 4 个 model 文件：
`IStateStorage` · `IConnector` · `IDeviceManager` · `IScriptEngine` · `ILogManager`。

`IConnector` 的注释把抽象意图写得很清楚：
> 调用方不需要关心底层到底是 camera 扫码 / 系统 Intent / HID 输入 / 其他后续新增的通道。
> 对上层而言，核心语义只有三件事：发起一次调用、判断某个 channel 是否可用、查询某类 channel 当前有哪些 target 可用。

### 3.2 `dev-app` —— 不起 RN 就能逐能力手测

独立 Android App，按能力分 Fragment：
`appcontrol` · `connector` · `console` · `device` · `logger` · `scripts` · `storage` · `topologyhost`。

⇒ **原生能力坏了，可以在不启动 RN、不启动业务的前提下定位。**
这是 `KEEP-01` 里"adapter 挡住'必须起 RN 才能验原生'"的实际机制。

### 3.3 存储用 MMKV 而非 SharedPreferences，且理由写在注释里

```
- 正式持久化能力属于 Android 原生能力，放在 adapter 层边界更清晰；
- assembly 层只保留 RN TurboModule 桥接，不再直接依赖 JS 侧 react-native-mmkv；
- 避免 JS 启动早期被 NitroModules 注册链路阻塞。
```

**第三条是踩过的坑**（JS 侧 MMKV 库在启动早期阻塞），写下来了。

## 4 · 【重要安全发现】`protection: 'protected'` 没有加密

完整链条（已亲验）：

| 层 | 事实 |
|---|---|
| slice descriptor | `tcp-control` 把 `accessToken` / `refreshToken` 标 `protection: 'protected'` |
| `state-runtime` | 据此路由到 `secureStateStorage` 端口，且**缺失时 fail closed 抛 typed error** |
| `host-runtime-rn84` | `createAssemblyStateStorage('secure-state')` → MMKV namespace `host-runtime-rn84::secure-state` |
| `adapter-android-v2` | `MMKV.mmkvWithID(storageId)` —— **单参重载，无 `cryptKey`，无 `MMKVMode`** |

⇒ **`secure-state` 只是"另一个 MMKV 文件"，与普通存储同等无加密。**

整条机制（描述符 → 路由 → 独立端口 → 独立命名空间 → fail closed）**都建好了**，
只差最后一公里：真正的加密后端。

**公平地说**：这在 POC 阶段是合理状态——机制已证，换后端是一行改动
（`MMKV.mmkvWithID(id, MMKV.SINGLE_PROCESS_MODE, cryptKey)`）。
**但当前的命名是过度承诺的**：类型与描述符说"protected"，实现给的是"另一个同样明文的文件"。

## 5 · 优点

1. **纯 Kotlin、零 RN 依赖**，是"kernel 零平台 API"能成立的另一半。
2. **`dev-app` 逐能力手测**（§3.2）—— 少见且高价值。
3. **接口先行**，`IConnector` 把四类外设通道抽象成一个 `call`（§3.1）。
4. **QuickJS 作为脚本沙箱**，独立 context、用后销毁 —— 动态脚本不跑在 App 的 Hermes VM 里。
5. **设备上自带主副配对 WS server**（`topologyhostv3`，1,030 行），
   单机双屏与双机配对不依赖外部服务。
6. **踩过的坑写在注释里**（§3.3 的第三条）。
7. **9 个 JUnit 测试**覆盖 topology host runtime / WebSocket、hot-update boot marker / installer、
   script JSON literal parser / execution gate、automation socket server、
   HID 键盘扇出、系统文件选择取消。**测的都是难点。**

## 6 · 缺点 / 风险

1. **§4 的 secure storage 未加密。** 这是本包最重要的一条。
2. **`ScriptEngineManager.kt` 844 行 + `ConnectorManager.kt` 778 行**，两个大文件。
   `ConnectorManager` 承担四类通道的分发，随通道增加会继续膨胀。
3. **`ScriptExecutionGate` 只是 `ReentrantLock` 串行化**，不是安全闸门 ——
   没有来源校验、没有能力白名单、没有资源上限（`FIX-22` 的原生侧对照）。
4. **`CameraScanActivity.kt` 624 行**，扫码 Activity 体量偏大。
5. **`topologyhostv3` 在 adapter 层实现了完整的配对 host**（1,030 行），
   而 kernel 侧另有一份 TS 实现（`host-runtime`，1,986 行，零消费者，`k-05`）。
   **同一套 host 语义两份实现，且 TS 那份被 V3 裁掉了。**
6. **`IStateStorage` 是同步接口**（`getString` / `setString` 直接返回），
   而 TS 侧 `StateStoragePort` 是异步。TurboModule 桥接处做了转换，
   但意味着大量同步 I/O 发生在调用线程上。（`推论`：未验证调用线程。）

## 7 · 重构到 TER 的优化方向（Dexter 已裁定用 expo-module）

| # | 动作 | 理由 |
|---|---|---|
| 1 | **`adapter-lib` 的 Kotlin 实现体几乎可原样成为各 expo-module 的实现** | 它本来就不依赖 RN；只需换最外层的 TurboModule 声明为 Expo `ModuleDefinition` |
| 2 | **按能力拆成独立 expo-module**：`persist-kv` · `persist-secure` · `device` · `app-control` · `logger` · `connector` · `scanner` · `script-engine` · `hot-update` · `dual-screen` · `automation-host` | `FIX-02`（包名按能力不按框架）；每个可被独立 dev-app 验证 |
| 3 | **`protection: 'protected'` 必须落到真加密**（MMKV cryptKey + Android Keystore 管密钥），或**改名不再承诺加密** | §4。二选一，不能维持现状 |
| 4 | **`dev-app` 形态整体继承**，每个 expo-module 配一个 example app | §3.2 是 POC 最有价值的原生调试资产之一 |
| 5 | **`IConnector` 的通道抽象继承**，但按通道拆分实现（camera / intent / HID / file 各一个 module） | §6.2 |
| 6 | **脚本引擎是否进 TER 需裁决**（与 `FIX-18` workflow 采纳与否联动）；若进，`ScriptExecutionGate` 要补来源校验与资源上限 | §6.3 |
| 7 | **topology host 只保留一份实现**（原生侧），删掉 kernel 的 TS 版 | §6.5，`k-05` |
| 8 | **同步/异步接口边界统一**：原生侧提供异步接口，或明确同步调用的线程约束 | §6.6 |
| 9 | **单机双屏改一个 ReactHost 多 surface 后**，`topologyhostv3` 的本机部分可以退化为只服务跨机 | 讨论稿 §7.2 |

## 8 · 证据档位

`已亲验`：全部 Kotlin 文件清单与行数、`interfaces/IStateStorage.kt` 与 `IConnector.kt` 全文、
`storage/StateStorageManager.kt` 前 80 行（`MMKV.mmkvWithID(storageId)` 单参调用）、
`host-runtime-rn84/src/platform-ports/stateStorage.ts` 全文（两个 layer 的 namespace）、
`ScriptEngineManager.kt` 的 QuickJS 使用点与 `ScriptExecutionGate` 实现、dev-app 的 Fragment 清单、
9 个 JUnit 测试文件名。
`推论`：§6.6（同步 I/O 线程）—— 未验证 TurboModule 桥接的线程模型。
**未逐行读**：`ScriptEngineManager.kt` 844 行、`ConnectorManager.kt` 778 行、
`CameraScanActivity.kt` 624 行、`topologyhostv3` 全部 1,030 行。
