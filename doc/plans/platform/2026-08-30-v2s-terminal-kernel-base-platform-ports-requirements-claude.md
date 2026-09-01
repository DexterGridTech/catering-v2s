# `kernel.base.platform-ports` · 需求文档

| 字段 | 值 |
|---|---|
| 包 | `apps/terminal/kernel/base/platform-ports` · `@catering-v2s/kernel-base-platform-ports` |
| 性质 | 需求文档。详设与实施由 Codex 承担 |
| 前置 | `kernel.base.contracts` 已完成（74 导出）；本包是唯一被解锁的下一个包 |
| 规范正本 | `doc/platform/terminal-coding-standard.md`（`TR-05` 原文点名本包；`§3-A` 定端口默认档） |
| 强制上位标准 | `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md` 第 2 条（日志禁记项） |
| 架构裁定 | `project-memory/decisions/terminal-architecture-and-stack-rulings.md`（`TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE`） |
| POC 参照 | `1-kernel/1.1-base/platform-ports` + `3-adapter/android/adapter-android-v2` + `host-runtime-rn84` |
| 适配目标 | RN Android · RN iOS · Electron Windows · Electron Linux |
| 修订 | 已并入 Codex 两轮独立评审（R1 6M/5S/2N · R2 1M/1S）与 Dexter 两条裁定，逐条处置见 §11 |

---

## 1 · 背景

**这是 kernel 访问外部世界的唯一入口。** `kernel/**` 零 Expo / 零 RN / 零原生 API
这条边界，靠的就是"所有平台能力只能经此进入" —— 有唯一入口，才谈得上守住。

它也是 `TR-05` 规则句原文点名的两个包之一（另一个是刚完成的 contracts），
而 `TR-05` 反例栏点名的方法**全部来自本包**。

⇒ 本批的难度不在"写接口"，在**把 POC 在这里丢掉的类型找回来**，
并且**用一套四平台都能满足的形状**去找。

---

## 2 · POC 判读

不读懂 POC 为什么长成那样，就只能在"照搬"与"乱改"之间二选一。

### 2.1 必须继承的三件事

| 做法 | 意图 | 判定 |
|---|---|---|
| 端口层作为 kernel 唯一外部入口 | 让"kernel 零平台 API"从承诺变成可验证的机制 | **成立** —— POC 13 个 kernel 包零 React/RN/Android import |
| 普通存储与加密存储**共用一个接口、两个实例** | slice descriptor 的 `protection: 'protected'` 需要真实落点，而两者操作集合完全相同 | **成立** —— 一个接口两个注册位，不是两套 API |
| `LogEvent.security.containsSensitiveRaw` **必填** | 逼写日志的人回答"这条含不含敏感数据" | **成立** —— 把容易被忘记的问题变成类型义务 |

### 2.2 断裂一 · 类型不是"未知"，是在 TS 边界被丢掉了

Kotlin 侧的能力接口**完全具名**：

```kotlin
interface IDeviceManager {
  fun getDeviceInfo(): DeviceInfo      // 9 字段，含 displays: List<DisplayInfo>
  fun getSystemStatus(): SystemStatus
  fun addPowerStatusChangeListener(listener: (PowerStatusChangeEvent) -> Unit): String
}
data class PowerStatusChangeEvent(
  val powerConnected: Boolean, val isCharging: Boolean, val batteryLevel: Int,
  val batteryStatus: String, val batteryHealth: String, val timestamp: Long,
)
```

TS 端口是：

```ts
export interface DevicePort {
    getDeviceId(): Promise<string>
    getPlatform(): Promise<string>
    getModel?(): Promise<string>
    addPowerStatusChangeListener?(listener: (event: Record<string, unknown>) => void): () => void
}
```

**同一个 `PowerStatusChangeEvent`：Kotlin 是 6 字段具名 data class，TS 是 `Record<string, unknown>`。**

桥接层没有补救，把丢失继续传下去（`turbomodules/connector.ts`）：

```ts
const listener = emitter.addListener('connector.stream', (event: Record<string, unknown>) => {
    if (event.channelId !== subscriptionId) { return }
```

`event.channelId` 是从无类型 Record 里**手搓的字段名**，拼错一个字母就是静默运行时 bug ——
`TR-05` 说的"退化之后它不是边界，是洞"。

**根因**：两侧各写各的，中间隔着 `JSON.stringify` / `JSON.parse`。
序列化边界让"不转写类型"毫无阻力 —— 反正过去是字符串，回来是 `any`。

⇒ **不是"这个领域没法定类型"，是没人把已有的类型转写过来。**

### 2.3 断裂二 · 对侧已经解决的问题，TS 侧没采纳

脚本执行的 native function 回调：

| | 形态 | 评价 |
|---|---|---|
| **Kotlin** | `nativeFuncNames: List<String>` + 单一 `NativeFunctionInvoker.invoke(funcName, argsJson, timeoutMs)` | **传名字 + 一个具名分发器**；**调用参数与返回是字符串**，宿主按名分发 |
| **TS 端口** | `nativeFunctions?: Record<string, (...args: any[]) => unknown>` | **把一整张函数表摊开传过去**，类型完全开放 |

⚠️ 差别不是"有没有函数跨界"——`NativeFunctionInvoker` 本身就跨界。
差别是**跨界的是一个具名的、单一的分发器，还是一张任意键的开放函数表**；
以及**参数与返回是否被收成字符串协议**。Kotlin 两者都做到了，TS 端口两者都没有。

⇒ 断裂不只是"忘了转写类型"，还包括"没看对侧怎么解的"。

### 2.4 断裂三 · 粒度错配，把结构拆成了字符串

Kotlin `DeviceInfo` 是一个 9 字段结构；TS `DevicePort` 把它拆成三个字符串 getter
（`getDeviceId` / `getPlatform` / `getModel?`），结构信息在端口层被摊平。

**判据是"这个接口表达得了消费者需要的东西吗"**：一旦拆成 getter，
任何"需要多个字段一起看"的判断（机型 + 系统版本 + 电源状态）都要跨三次边界拼回来，
而且端口一旦少写一个 getter，那条信息在 kernel 侧就永远取不到。

⇒ **端口取结构，不取字段。** 详见 §3 主张二。

⚠️ **`displays` 不在此列。** POC 的 `DeviceInfo.displays` 确实带完整屏幕信息，
但 TER 不通过端口取它 —— 见 §5.6 关于屏幕的说明。

### 2.5 断裂四 · 名字描述机制

POC 的端口方法叫 `restartApp()`，Android 实现（`AppControlManager.kt:92-101`）确实是
整进程重启（`startActivity` + `finishAffinity` + `Runtime.exit(0)`）。
**但它要达成的能力是"让新 bundle 生效 / 重置 JS 运行时"**，
整进程重启只是 Android 上一种粗暴但有效的**实现方式**。

后果是四平台判断被直接带偏：按"重启应用进程"读，iOS 是 `✗`（App Store 不允许）；
按"重置 JS 运行时"读，**iOS 是 `✓`**（`RCTTriggerReloadCommandListeners`，
CodePush 正是这么做的），Electron 是 `✓`（`webContents.reload`）。

⇒ **端口方法必须按能力命名。名字一错，四平台判断跟着错。**

### 2.6 断裂五 · 只定义了失败，没定义成功

`AppControlTurboModule.kt:68-77`：

```kotlin
override fun restartApp(promise: Promise) {
  runCatching {
    val activity = MainActivity.instance ?: error("MainActivity not ready")
    activity.restartApp()
  }.onSuccess { promise.resolve(null) }
   .onFailure { promise.reject("APP_CONTROL_ERROR", it.message, it) }
}
```

而 `MainActivity.restartApp()`（第 195-197 行）只是转给 `appRestartManager.restart()`。
⇒ **Promise 在"请求已排队"的那一刻就 resolve 了**，真正的 reload 在后续异步链里执行，
**后续失败只写日志，不会反向拒绝这个已经成功的 Promise**。

调用方拿到成功，JS 运行时可能根本没重置。这是 `TR-02` 家族的问题：
**"什么都没做"的路径返回了成功。**

⇒ 端口不能只定义"不可用"长什么样，**必须定义"成功"意味着什么**（§5.5）。

### 2.7 四平台目标改变了"转写"的含义

「忠实转写对侧形状」有歧义 —— **对侧有四个，而 POC 只有一个（Android/Kotlin）。**
照转 Kotlin，等于把 Android 的实现方式烤进 kernel 契约。

| 端口 | 四平台差异 | 照转 Kotlin 的后果 |
|---|---|---|
| `persistKv` | Kotlin `IStateStorage` 有 `getInt/getLong/getFloat/getBoolean` 分类型访问器 | **POC 的 TS 端口只留 string KV，反而更可移植** —— 照转会引入四套访问器，而 iOS/Electron 后端都是 string 或需自行序列化 |
| `device` | `PowerStatus.batteryHealth` 是 Android 专有枚举；桌面机可能没有电池 | 端口里出现一个三个平台答不上来的字段 |
| `connector` | `ChannelType` 的 `INTENT` / `AIDL` 是 Android IPC 机制 | 把实现机制变成 kernel 契约 |
| `appControl` | iOS 无法以编程方式退出应用；kiosk 需 MDM/supervised device | 把"能退出"当成普遍能力 |

**两条推论**：

1. `persistKv` 那一行证明 **POC 的 TS 端口有时比 Kotlin 更可移植**。
   ⇒ 转写方向不是「Kotlin → TS」，而是**取四平台都能满足的抽象**；Kotlin 是证据之一，不是权威。
2. **能力缺失是四平台下必然发生的常态**，不是理论上的降级 ——
   这是"不可用默认"的实证依据。

---

## 3 · 五条设计主张

⚠️ **五条全部是"更简单"的方向，不是"更完备"。** 更优不等于更复杂。

**一 · 端口类型取自已有形状的证据，但形状要四平台可满足。**
每个端口方法的入参与返回类型，详设须能指出①它在已有实现里的形状证据
（Kotlin data class / Electron API / iOS API / Web 标准）；②它在四平台上分别怎么满足，
或明确"该平台不可用"。形状已存在且被验证过，转写是抄写不是设计。
找不到任何形状证据的，说明这个能力还没有实现方 —— 按不可用默认处理，不要凭空造形状。

**二 · 保结构，不要拆成 getter。**
`getDeviceInfo(): Promise<DeviceInfo>` 一个方法胜过三个字符串 getter：方法更少、信息不丢、
跨边界一次往返而不是三次。**更简单、更完整、更快三者不冲突时，不要选复杂的那个。**

**三 · 采纳对侧已解决的问题。**
脚本的 native function 走**"函数名列表 + 单一具名 typed dispatcher"，不摊开传函数表**（§2.3）。
Dexter 已裁定 `scripts.execute` 必须支持运行期远端下发脚本源（`T-11`），脚本源本来就是不可信输入 ——
让跨界面只有**一个**入口、参数与返回收成字符串协议，是**让远端下发更容易做对**。

**四 · 端口永不可选，且接口要全**（Dexter 已裁定）。
`PlatformPorts` 取消全部可选字段；有实现用实现，没有用默认实例（零额外依赖）。
**端口按能力全量声明，不按"当前有没有 kernel 消费者"裁剪** ——
没有真机适配器注入时，默认实例返回一个**明确说出"未注入适配器，本接口当前不可用"**的
typed 结果（§5.5）。

> 这条直接消解 `FIX-04`：POC 12 个字段 10 个可选，导致每个消费者写
> `ports.device?.getDeviceId()` 并在**每一个调用点**决定"没有这个能力怎么办"。
> 最坏一例是 `workflow-runtime-v2` 在 `scriptExecutor` 缺失时
> **静默退回 `new Function` 在主 JS 上下文求值**（`FIX-22`）。

⚠️ POC 的可选性**嵌套两层** —— 不只 `device?`，`DevicePort` 内还有 `getModel?`
与 `addPowerStatusChangeListener?`。**两层都要取消。**
"这台设备没有第二块屏"是**返回值**要表达的事实，不是**方法存不存在**要表达的事实。

⚠️ **"接口要全"不等于"接口可以是空壳"** —— 一个只有键、没有可调用方法的端口
会让所有门变绿而消费者仍然无法调用（§5.6 的 `connector`）。

**五 · 平台专有概念不得进入端口。**
类型名、字段名、枚举值、**方法名**里不得出现平台专有词汇或实现机制。

> **两个判别式**：词汇 —— 这个词在另外三个平台上有对应物吗？
> 命名 —— 这个名字在四个平台上说的是同一件事吗？（`restartApp` 过不了第二个）

⚠️ POC 的 `IConnector` 是这条的活反例：注释写着「调用方不需要关心底层到底是
camera 扫码 / 系统 Intent / HID 输入」，**意图是能力抽象，而 `ChannelType` 的枚举值
泄漏了机制**。意图对，形状背叛了意图。

---

## 4 · 包定位

**是**：kernel 对宿主能力的**需求声明**，以及这些能力的**默认实现**。

| 不是 | 为什么 |
|---|---|
| 平台实现 | 真实实现在 `adapter/**`；本包只有声明与零依赖默认实例 |
| 配置容器 | `environmentMode` 这类配置不是端口（§5.6） |
| UI / assembly 控制面 | automation 不进端口（§5.6） |

**硬边界**：依赖只有 `contracts`（`skeleton-graph.ts` 已定，不得增加出边）·
零 Expo/RN/原生 import · 默认实例除 `contracts` 外零依赖 · `plannedKind: toolkit`，不得拥有 slice。

---

## 5 · 端口清单与装配规则

### 5.1 全量清单

**全量声明，不按当前消费者裁剪**（Dexter 裁定）：端口是**能力声明**，
晚声明的成本是每个消费者各自绕路。

⚠️ 这条**不是**"POC 桥接层有什么就声明什么"，也**不能**用"adapter 侧已建 N 个包"
去证明某个端口本批必须落地 —— 已建的 adapter 包只支持各自的能力。
唯一的判据是 §3 主张一：**能指出形状证据，且四平台归属说得清。**

**四平台列**：`✓` 有原生对应 · `△` 受限或形态不同 · `✗` 平台不允许。
这一列**不是本批要实现的东西**，是**端口形状必须容纳的事实** ——
凡有 `△`/`✗`，端口签名必须让"不可用"成为一个合法返回值（§5.5）。

| # | 端口 | 能力 | 形状证据 | 默认 | And | iOS | Win | Linux |
|---|---|---|---|---|---|---|---|---|
| 1 | `logger` | 结构化日志 + scope/context 派生 | Kotlin `ILogManager` · `console` | **可用** | ✓ | ✓ | ✓ | ✓ |
| 2 | `persistKv` | 普通字符串 KV | POC 的 TS 端口（比 Kotlin 更可移植，§2.7） | **可用**（正本 §3-A） | ✓ | ✓ | ✓ | ✓ |
| 3 | `persistSecure` | 加密 KV，**与 2 同接口** | Keychain · EncryptedSharedPreferences · safeStorage | 不可用 | ✓ | ✓ | ✓ | △ |
| 4 | `device` | 设备标识 · 系统状态 · 电源 | Kotlin `DeviceModels` **去平台化后** | 不可用 | ✓ | △ | △ | △ |
| 5 | `appControl` | 六类，见 §5.6 | §5.6 | 不可用 | ✓ | △ | ✓ | ✓ |
| 6 | `script` | 脚本执行（名字 + 单一 dispatcher） | Kotlin `ScriptModels` · QuickJS/JSC/vm | 不可用 | ✓ | ✓ | ✓ | ✓ |
| 7 | `connector` | 外部外设通道 · **最小 typed 契约见 §5.6** | POC `ConnectorPort` 的 `call`/`subscribe`/`unsubscribe`/`on` | 不可用 | ✓ | △ | ✓ | ✓ |
| 8 | `hotUpdate` | 热更新包下载与 boot/active/rollback marker | Kotlin `HotUpdate*` | 不可用 | ✓ | △ | △ | △ |
| 9 | `logUpload` | 按日期上传日志 | Kotlin `ILogManager.uploadLogsForDate` | 不可用 | ✓ | ✓ | ✓ | ✓ |
| 10 | `topologyHost` | 跨机 host 服务（自带 HTTP 与 WS 地址） | Kotlin `TopologyHostV3*` · `TopologyHostAddressInfo` | 不可用 | ✓ | **△** 后台限制 | ✓ | ✓ |
| 11 | `localWebServer` | 本机 Web 服务 | POC `LocalWebServerPort`，⚠️ 见下 | 不可用 | ✓ | **△** 后台限制 | ✓ | ✓ |

🔴 **`device` 在三个平台是 `△`** —— `PowerStatus.batteryHealth` 是 Android 专有枚举，
`DeviceInfo` 的 `cpu/memory/disk/network` 是 Android 风格字符串。
端口取**去平台化后的形状**，不得照转。

🔴 **`localWebServer` 的举证责任在详设，未过关则不得建。**

已确认的负向证据（`CONFIRMED`）：POC 原生能力验证台
`3-adapter/android/adapter-android-v2/dev-app/.../ui/TestHomeFragment.kt:48` 原文写着
**"topologyHost 将在独立模块补齐，旧 LocalWebServer 不再作为协议能力保留"**。
⚠️ 这是 dev-app 的界面文案，**足以证明"旧 LocalWebServer 不再作为协议能力"，
但不足以单独证明 TER 永远不需要任何非协议的本机 Web 服务能力。**

其余实测：`LocalWebServerPort` 的 `start`/`stop?`/`getStatus?` **三个方法返回值全是
`Record<string, unknown>`**；POC 内唯一提及处是 `runtime-shell-v2` 的透传，**无真实消费者**；
而 `TopologyHostAddressInfo` 已同时带 `httpBaseUrl` / `wsUrl` / `localHttpBaseUrl` / `localWsUrl`。

⇒ 按"接口要全"暂列，但**详设必须逐项证明**：① 它不是 `topologyHost` 已覆盖的
HTTP/WS/本机 URL 协议能力；② 它具体提供什么**非协议**能力；③ 谁是真实 consumer；
④ 返回形状是什么；⑤ 四平台分别如何满足或返回不可用。
**五项答不全，就合入 `topologyHost` 或本批不建**，不得新造一个全 `Record` 的空壳。

### 5.2 端口边界怎么切

> **两个能力合成同一个端口，四条必须全部成立；有一条不成立就拆开：**
> **① 生命周期一致**（一起可用、一起不可用）· **② 默认档位一致** ·
> **③ 保证级别一致**（调用方不需要区分"哪一种"）· **④ 由同一个 adapter 实现**。

| 分家 | 不成立的条款 | 说明 |
|---|---|---|
| `logger` / `logUpload` | **②** | `console` 是可用默认，"上传日志"没有任何默认实现。合并后**无法表达"能记日志但传不上去"** —— 而这是 web 与无网门店的常态 |
| `persistKv` / `persistSecure` | **②③** | 默认档位不同（可用 / 不可用）；且接口形状相同、**保证不同**，合并后调用方无法表达"这条必须加密" |
| `topologyHost` / `localWebServer` | `UNVERIFIED_REQUIRES_EVIDENCE` | 见 §5.1 —— 详设按四条判别式作答，四条全成立就该合并 |

### 5.3 默认档位怎么定

> **默认实例可用，当且仅当两条同时成立：**
> **① 不存在任何目标平台真的缺这个能力**（否则"不可用"是事实，不是兜底）；
> **② 默认实现的语义与真实实现一致 —— 是同一件事的另一种做法，不是冒充。**

| 端口 | 判定 | 理由 |
|---|---|---|
| `logger` | **可用** | `console` 在任何 JS 运行时都有，且 console 日志**就是真的在记日志**，只是去向不同 |
| `persistKv` | **可用（进程内 Map）** | **依规范正本 `§3-A`，Dexter 2026-08-30 裁定维持正本** |
| `persistSecure` | 不可用 | 明文存储冒充加密是**欺骗** —— 调用方以为数据被保护了。能力不可用是**可见的事实**，明文冒充加密是**不可见的谎** |
| 其余八个 | 不可用 | 均有 `△`/`✗`，或无任何零依赖实现 |

⚠️ **`persistKv` 的残留风险必须在实施记录里登记一行**：进程内 Map 只在进程存活期间成立，
`set` 成功而重启后数据丢失时**没有信号**。本文不再就此主张变更（正本已裁定），
但详设须让默认实例的**名称或文档串**自身说明"这是进程内的、不跨重启"，
使阅读代码的人不必去查正本才知道。

⚠️ Linux 的 `persistSecure` 标 `△` —— `libsecret`/`kwallet` 依赖桌面环境，无头环境没有。
adapter 侧要能在缺失时**返回不可用**而不是退回明文。

### 5.4 端口集合怎么装配

**要求：一次性构造的穷尽 record + 纯 factory，不做可变注册器。**

```
完整的 binding record（必须写全每一个端口键）
  → createPlatformPorts(record)
  → 冻结的 PlatformPorts
```

漏填任何一个键 **编译不过**。有实现填实现，没有就填一个具名的不可用值。

| 备选 | 为什么不选 |
|---|---|
| N 次 `register()` + `seal()` | **凭空造出"seal 前取用"这个错误状态，再去防它**。本轮未找到任何必须"异步注册端口对象"的反例：POC 的 state/logger/device/connector/script/appControl/topologyHost 都能同步取得稳定 wrapper，异步的是**端口方法内部的 ready**，不是端口对象本身 |
| `seal()` 时打印警告 | 警告会被无视，**不是门** |
| 新增 `declareUnavailable()` API | 与穷尽 record 等价，却多一个概念，且是运行期检查 |

assembly 若需等待原生初始化，**在调用 factory 之前 await 即可** ——
不需要把等待做进端口层。

⚠️ 只有将来出现真实的生命周期环（端口对象必须在 runtime 创建后才能取得，
且稳定代理也无法表达），才重新评估 builder/seal。

### 5.5 "不可用"与"成功"都必须有定义

**不可用**：返回一个**具名的、可判别的**结果，携带**哪个端口、哪个能力、
以及原因类别**。原因至少分两类，因为处置不同：

| 原因类别 | 含义 | 调用方该怎么办 |
|---|---|---|
| **未注入适配器** | 本次装配没有给这个端口填真实实现 | 这在 web / 测试 / 未接线的构建里是正常的；走降级分支 |
| **平台不支持** | 这个平台真的没有该能力（iOS 退出应用、无头 Linux 的加密存储） | 永久性事实，UI 不应给出该入口 |

- **不得抛异常** —— 每个调用点会重新变成 try/catch，等于把 `FIX-04` 的散落降级换个形式请回来；
- **不得返回 `null`/`undefined`** —— 与"成功但没数据"分不清。

**成功**：`§2.6` 证明"只定义失败"不够。**每一个端口方法必须写清五件事**：

1. **什么时间点算完成**（请求已受理 / 动作已生效）；
2. **需要什么可观察确认**；
3. **后续异步失败如何回传**（不能只写日志）；
4. **是否允许返回 accepted/pending**，若允许，终态从哪里取；
5. **timeout 怎么表达**。

⚠️ 本批只**冻结语义**；真实 adapter 的动态证明留到对应 adapter 实施批次。
但**语义没写清就不算这一批交付完成** —— 否则 `restartApp` 那类
"排队即成功"的实现会带着全绿的门进来。

⚠️ **接线错误与能力缺失是两类事**：漏填端口键是**程序错误**，
由编译期挡住（§5.4）；能力缺失是**运行期事实**，返回 typed 结果。
**判别式：这件事是"写错了"还是"这台机器就是没有"？**

### 5.6 逐端口的单独说明

**屏幕信息不走端口。** `TER_SINGLE_VM_SINGLE_STORE_MULTI_SURFACE` 已裁定：
单机双屏 = 一个 ReactHost / 一个 VM / 一个 store / 多个 Root Surface，
**Kotlin 按屏传不同 `initialProps`**，`displayMode` / `containerKey` 随命令传入。
且 `skeleton-graph.ts` 里 `kernel.base.display-context` 的依赖是
`contracts` / `state` / `runtime`，**不含 platform-ports**。
⇒ surface 身份是**被推进来的输入**，不是 kernel 去查的硬件。
**本批不建 `display` 端口。** 详设须写明 `surface initialProps → display-context`
这条合约的边界，避免后来者再把它做成硬件查询端口。
（POC 靠"副屏独立进程"实现双屏，那套跨进程广播协议已裁定不搬。）

**`appControl` 六类能力全量声明**（Dexter 2026-08-30 裁定："接口要全"）。
实测 POC kernel 只有一处消费 `appControl` ——
`tdp-sync-runtime-v2/src/application/createModule.ts:175` 的 `appControl?.restartApp?.()`
（热更新装载）。其余五类**当前零 kernel 消费者**，按裁定仍然声明，
默认实例返回"未注入适配器"的 typed 不可用结果。

| 能力 | 没有它，POS 会缺什么 | kernel 消费者实证 | And | iOS | Win | Linux |
|---|---|---|---|---|---|---|
| 重置 JS 运行时 | 热更新下载完无法生效 | **有**（热更新装载） | ✓ | ✓ | ✓ | ✓ |
| 退出应用 | 运维无法远程收工/交班退出 | 无 | ✓ | **✗** iOS 不允许自杀 | ✓ | ✓ |
| 清数据缓存 | 现场故障无法就地复位 | 无（POC 是 assembly 组合 storage.clear） | ✓ | ✓ | ✓ | ✓ |
| 全屏开关与查询 | 收银界面被系统状态栏挤占 | 无（POC 是 host/admin 直连） | ✓ | △ | ✓ | ✓ |
| kiosk 锁定开关与查询 | 机器可被切走 | 无 | ✓ | **△** 需 MDM/supervised | ✓ | ✓ |
| 原生加载遮罩 | 冷启动白屏在收银台肉眼可见 | 无（assembly 启动阶段） | ✓ | ✓ | ✓ | ✓ |

⚠️ **"清数据缓存"与"重置 JS 运行时"是两件事**，不得合并：前者清数据，后者重载代码。
⚠️ **别名不进端口**，同一能力只声明一次（POC 桥接层的 `onAppLoadComplete` 实测就是
`hideLoading` 的别名）。
⚠️ **`需 Dexter 裁决`**：退出应用与 kiosk 的**最终 owner 与产品授权**未定 ——
声明在端口层不等于裁定了"由 kernel 发起"。详设写清"谁发起、谁消费、谁处理失败"，
与产品语义冲突时以 Dexter 裁定为准。

**`connector` 冻结最小 typed 契约，只推迟 channel 分类。**
实测 `workflow-runtime-v2/src/foundations/connectorRuntime.ts` 真实调用
`connector.call` / `subscribe` / `unsubscribe` / `on`（第 32 / 64 / 65 / 164 行）——
**方法集是有实证的**，没有理由留空。

⇒ 本批**必须冻结**：`call` 的请求与结果、`subscribe`/`unsubscribe` 的订阅与消息、
`on` 的事件、以及统一的错误形状 —— 全部 typed，不得 `Record<string, unknown>`。
⇒ 本批**推迟**：channel 的**分类枚举**，标 `UNVERIFIED_REQUIRES_EVIDENCE`。
Kotlin 的 8 值里 `INTENT`/`AIDL` 是 Android IPC **机制**，
`USB`/`SERIAL`/`BLUETOOTH`/`NETWORK`/`HID` 是**传输方式** ——
没有一个值回答"kernel 想干什么"；而 POS 外设是开放集合，现在凭空定能力枚举
会把错误从"泄漏机制"换成"猜错能力边界"。

⚠️ **只留白分类、不留白契约** —— 一个只有键、没有可调用方法的 `connector`
会让 P-1/P-2/P-3 全绿而 workflow 仍然无法发起一次类型安全的调用。**那是假绿。**

**`automation` 不是端口，这是设计不是遗漏。**
POC 桥接层有 `turbomodules/automation.ts`（7 个方法）但没有对应端口 —— 实测是刻意的：
assembly 的 `hostApp/createHostApp.tsx` 直接接 `nativeAutomationHost`，
而 `ui-automation-runtime` 自带 `WebSocketAutomationHost` 与 `browserAutomationHost`。
理由：① automation 是 **UI 层**关注点，不是 kernel 需求；
② `TR-08` 要求调试与自动化面**编译期剔除**，做成 kernel 端口反而更难剔干净。
**TER 沿用。列在此是为了避免将来被人当成遗漏"补"进来。**

**`environmentMode` 不是端口。** POC 把它放在 `PlatformPorts` 第一个字段，
但它是**配置值**（DEV/PROD/TEST），不是宿主提供的能力。
⇒ 它是 factory 的构造参数。⚠️ 它**只能影响日志 sink、level 与详细度，
不得影响 PII 是否明文**（§6）。

---

## 6 · 日志与脱敏

**继承**：`LogEvent` 的结构化字段（`scope`/`context`/`level`/`category`/`event`），
其中 `scope` 与 `context` 直接引用 contracts 的 branded ID；
`security.containsSensitiveRaw` 保持必填。

**修正 POC 的脱敏缺陷。** 实测现状：`containsSensitiveRaw` 只看**键名**是否命中
`/(token|password|credential|secret|phone|mobile|idNumber|identity|payment)/i`，
`maskValue` 也只按键名替换，**`LogEvent.message` 完全不参与脱敏**。
⇒ `logger.info({message: '用户 13800138000 登录成功'})` **原样落盘**，
而门店场景里"值敏感、键名普通"恰恰最常见。

**上位标准**：`doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`
第 2 条严禁记录**密码、密码 hash、验证码、token、cookie、Authorization、
手机号明文、登录名、原始 IP、raw request/response 或可反推账号存在性的字段**，
**且全文无环境例外**。

**要求四条**：

1. **脱敏在所有环境启用** —— 不存在"非 PROD 可明文"。环境只影响 sink / level / 详细度；
2. **覆盖 `message`** —— 自由文本最危险；
3. **按键名 + 按值双判**，类别覆盖上位标准的完整禁记清单，
   不止手机号与身份证；
4. 🔴 **公开面上不得有绕过 sanitizer 的入口。**

**第 4 条的实证**：POC 的 `LoggerPort` 除 `debug/info/warn/error` 外还公开
`emit(event: LogEvent): void`（`types/logging.ts:60-68`）。其实现
（`foundations/logger.ts:107-109`）是 `input.write(event)` —— **直接落盘**，
不经 `createLogEvent`，因而不做遮蔽、不重算 `containsSensitiveRaw`、不套 `maskingMode`。
`debug/info/warn/error` 走的 `emitLevel` 才经过 sanitizer。
POC 测试 `passes emitted events through without cloning`
（`test/scenarios/platform-ports.spec.ts:220-253`）**把这条旁路固化成了预期行为**。

⇒ 只修 `info/warn/error` 的脱敏，本文 §8 的 L 组可以全绿，
而调用方仍能用 `emit()` 把 token / Authorization / 手机号原样写出。**那是假绿。**

**处置：本批的 `LoggerPort` 公开面不含 `emit`。**
实测 POC 全仓调用 `logger.emit` 的**只有它自己的测试**
（`platform-ports.spec.ts:251`），**没有任何生产消费者** ——
删掉是最简单的封口，不需要再为它写一套跨环境的旁路测试。

⚠️ 将来若出现"必须由调用方提交完整 `LogEvent`"的真实 consumer，
该入口**必须与 `info/warn/error` 走同一个 sanitizer**，
并按 §8 L 组的反断言补齐 direct-emit 的跨环境覆盖。
⚠️ **不得照抄 POC 那条固化旁路的测试。**

⚠️ **明确不做**：不建"分类规则表框架"、不做可配置规则引擎。一组**写死的、有单测的**模式即可。
可配置化解决的是想象中的需求，而每条规则都必须有测试才算数。

---

## 7 · 标准 · 落点 · 验收

每条绑定真实门或负夹具；无法机械判定的标 `UNENFORCEABLE_BY_MACHINE` 并绑评审清单。

| # | 标准 | 落点 | 不通过的表现 |
|---|---|---|---|
| P-1 | 出边只有 `contracts`；零 Expo/RN/原生 import | 已有门（依赖方向 + 平台独立性） | 有其它出边 |
| P-2 | `TR-05`：禁止 `Record<string, unknown>` / `any` / 双重 cast | **扩展 contracts 那道门到本包**，扫描面同四维（成员类型/函数签名/泛型约束/双重 cast）。红夹具：把任一端口方法返回改回 `Record<string, unknown>` | 端口方法仍有 `Record<string, unknown>` |
| P-3 | `PlatformPorts` 零可选字段，**且每个端口接口内零可选方法** | **新增门**（两层都扫）。红夹具：给任一端口加一个 `?` 方法 | 任一层还有 `?` |
| P-4 | 默认实现零额外依赖 | **新增门**：默认实现只允许 import 本包与 `kernel.base.contracts`；禁止 platform/runtime/adapter import 与任何新增第三方依赖 | 默认实现引入了第三方或平台依赖 |
| P-5 | 端口集合是**穷尽 record**，漏填任一端口编译失败（§5.4） | **类型层负夹具**：`@ts-expect-error` 构造少一个键的 record，`typecheck` 必须红。**需配反向控制**，否则是假绿 | 漏填只是运行期拿到默认，编译照过 |
| P-6 | 不可用结果 typed、可判别、**带原因类别**；不抛异常、不返回 null | `UNENFORCEABLE_BY_MACHINE` + **测试兜底**（§8 的 D 组） | 某端口抛异常、返回 null，或不可用结果说不出"未注入"还是"平台不支持" |
| P-7 | **每个端口方法的成功语义已定义**（§5.5 五问） | `UNENFORCEABLE_BY_MACHINE` —— **评审清单**：逐方法回答五问 | 只有 `Promise<void>`，"排队即成功"能通过 |
| P-8 | 端口里零平台专有**标识符** | **新增门（收窄）**：只禁 Android/iOS/Electron 的 **namespace 与原生 import**（如 `android.*`、`androidx.*`、`NS*`、`UI*`、`electron`）和少量明确的平台类型名。**不声称能给出"完整词表"** | 端口里出现原生 namespace 或平台类型 |
| P-9 | 端口方法名**描述能力，不描述机制** | `UNENFORCEABLE_BY_MACHINE`（黑名单抓不到换个词的机制泄漏，也可能误伤正常文字）—— **评审清单**：逐方法回答"这名字说的是宿主**做什么**，还是某平台**怎么做**？" | 端口里留着 `restartApp` 这类机制名 |
| P-10 | 每个端口类型能指出**形状证据来源** | `UNENFORCEABLE_BY_MACHINE` —— **评审清单**：逐端口写明来源，找不到的必须说明为什么 | 有端口的类型是凭空发明的 |
| P-11 | 每个端口方法在**四平台都有明确归属**（✓/△/✗） | `UNENFORCEABLE_BY_MACHINE` —— **评审清单**：逐方法给出满足方式；标 △/✗ 的说明"不可用"如何成为合法返回值 | 只写了 Android 怎么做 |
| P-12 | **默认档位与端口切分按规则判**，不是逐个拍 | `UNENFORCEABLE_BY_MACHINE` —— **评审清单**：逐端口填 §5.3 两条；每处分家/合并填 §5.2 四条，含 `localWebServer` 的存废结论 | 档位逐个拍；切分无理由 |
| P-13 | **脱敏全环境生效**，覆盖上位标准的完整禁记清单，含 `message`，**且公开面无旁路入口** | 测试（§8 的 L 组，含公开面无旁路的类型层夹具） | 手机号 / token / Authorization 在任一环境原样落盘；或存在一个不经 sanitizer 的公开 logger 入口 |

---

## 8 · 测试

**道次**：vitest `4.1.10`，**node 环境** —— 本包零 React/RN，这本身也是平台独立性的验证手段。

| 组 | 断言 | 反断言 |
|---|---|---|
| **A**（装配） | 完整 record 经 factory 得到冻结的 `PlatformPorts`；填入的实现能被取到 | 返回对象**不可再被写入**（冻结是真的） |
| **D**（默认实例） | 可用默认（`logger`、`persistKv`）真的能用 | 逐**不可用默认**各一条：返回 typed 结果、**带原因类别**、**不抛异常、不返回 null** |
| **S**（成功语义） | 至少一个 accepted/pending 型方法：受理与生效是两个可区分的状态 | **"排队即成功"必须无法冒充"已生效"** —— 用一个只受理不生效的假实现，断言调用方能分辨 |
| **L**（脱敏） | 键名命中被遮蔽 | ① **`message` 里的手机号被遮蔽**；② **在 DEV/TEST 环境同样被遮蔽**；③ token / cookie / Authorization / 登录名 / 原始 IP 各一条；④ `containsSensitiveRaw` 在值命中时为 `true`；⑤ 🔴 **公开面无旁路**：`LoggerPort` 的每一个公开方法都经过同一 sanitizer。以类型层夹具钉死——`@ts-expect-error` 调用 `logger.emit(...)` 必须编译失败（该方法不在公开面）。若将来恢复该入口，本条改为 direct-emit 的跨环境 × 全禁记类别红断言 |
| **C**（消费者编译夹具） | 代表性调用方式真实成立：state/runtime 调 KV 与 logger；workflow 调 `script` 与 `connector.call`/`subscribe`；assembly 构造完整 binding record | ① `@ts-expect-error`：branded ID 不可互传（把 `RequestId` 传进要 `CommandId` 的位置必须红）；② **不可用结果必须被显式分支处理**，直接当成功值用必须编译失败 |
| **F**（类型层） | 全部端口可从公开面构造一个完整合法实现 | ① `@ts-expect-error`：实现缺任一**方法**必须编译失败（P-3）；② `@ts-expect-error`：record 缺任一**端口键**必须编译失败（P-5） |

⚠️ **C 组是 contracts 那批欠下的债** —— `kernel.base.contracts` 需求文档的消费者编译夹具一节
写过"真正的证明在 `platform-ports` 那批"。本批必须兑现。
⚠️ C 组只在本包内写夹具，**不得为了证明本包去改尚未授权的 workflow/runtime/assembly 生产源码**；
真实下游消费在对应包实施时再次复证。

⚠️ **`tsconfig` 必须包含 `test/**`**，否则 `@ts-expect-error` 不被求值 ——
contracts 那批踩过这个坑。同样要有**反向控制**：删掉一行 `@ts-expect-error`，
`typecheck` 必须变红。

**一键测全部**仍全绿，真实有测试的包数 = **2**。

---

## 9 · 明确不做

| 不做 | 为什么 |
|---|---|
| `display` 端口 | 屏幕不经端口，surface 身份由 `initialProps` 推入（§5.6） |
| Kotlin → TS 的**类型代码生成** | 11 个端口是手工转写一次的量；建 codegen 要引工具链与构建步骤，**代价大于收益** |
| 边界处的**运行期 schema 校验** | 端口声明类型，**adapter 负责产出符合的值**，其自身测试验证之。每个方法加校验是重机制，且把责任从实现方挪到声明方 |
| 脱敏的**可配置规则引擎** | 解决的是想象中的需求（§6） |
| 能力型端口（SQLite/IndexedDB 抽象） | Dexter 已裁定推迟 |
| `connector` 的 **channel 分类**现在定形 | 无四平台实证（§5.6）。⚠️ 契约本身不推迟 |
| 可变注册器与 `seal()` | 无异步注册反例，纯 factory 已足够（§5.4） |
| 为 iOS / Electron 现在就写 adapter | 本批只做端口声明与默认实例 |

---

## 10 · 交付物

1. 11 个端口的类型声明 + 各自默认实例；
2. `createPlatformPorts(record)` 纯 factory（穷尽 record · 返回冻结对象）与 `environmentMode` 构造参数；
3. 默认 logger（含 §6 的全环境脱敏）；
4. 四道门：`TR-05` 扩展 · P-3 零可选两层扫描 · P-4 默认实现依赖白名单 · P-8 原生 namespace 禁入 ——
   各带红夹具与真实树绿；
5. §8 六组断言 + `tsconfig` 覆盖 `test/**` 的反向控制记录；
6. 实施记录，含：
   ① 逐端口的**形状证据来源**（P-10）与**四平台归属矩阵**（P-11）；
   ② 逐端口方法的**成功语义五问**（P-7）；
   ③ 逐端口的**默认档位理由**（§5.3）与**分家/合并理由**（§5.2），
      含 `localWebServer` 存废结论；
   ④ **`persistKv` 进程内 Map 的残留风险登记**（§5.3）；
   ⑤ 与 POC 的**显式差异清单**，至少含：`appControl` 按能力重命名并全量声明六类 ·
      **不建 `display` 端口**及其合约边界 · `device` 保结构并去平台化 ·
      `persistKv` 保持 string KV · 脚本 native function 改为名字 + 单一 dispatcher ·
      `environmentMode` 移出端口 · 两层可选取消 · `connector` 冻结契约但推迟分类 ·
      取消 `seal()` 改纯 factory；
   ⑥ 找不到形状证据的端口及其处理方式。

---

## 11 · 评审处置记录

Codex 第一轮独立评审 `TER_PLATFORM_PORTS_REQUIREMENTS_2026_08_30`（NO-GO，6M/5S/2N）。
本文作者已逐条回源亲验，处置如下。

| 编号 | 处置 | 依据 |
|---|---|---|
| M-1 `display` | **ACCEPTED** | 亲验 `skeleton-graph.ts`：`display-context` 依赖不含 platform-ports；裁定原文为 `initialProps` 推入。端口已删（§5.6、§9） |
| M-1 `localWebServer` | **PARTIALLY_ACCEPTED** | 所引"Android 验证台写明不再保留"一句在 `doc/`、`project-memory/`、`apps/terminal/` 及 POC 侧**均未检出**，该出处标 `UNVERIFIED`。但结论按可复现证据保留质疑：三方法全 `Record`、无真实消费者、`TopologyHostAddressInfo` 已带 HTTP/WS 地址。按 Dexter"接口要全"保留端口，形状证据不足已标注（§5.1） |
| M-1 端口分档 | **PARTIALLY_ACCEPTED** | "不得用已建 adapter 数量当分母"已采纳（§5.1）；`NOW_REQUIRED/DEFERRED` 分档**未采纳** —— 与 Dexter"接口要全"裁定冲突 |
| M-2 `connector` | **ACCEPTED（取方案 B）** | 亲验 `connectorRuntime.ts` 第 32/64/65/164 行真实调用四方法，方法集有实证 ⇒ 冻结最小 typed 契约，只推迟分类（§5.6） |
| M-3 `persistKv` 正本冲突 | **DEXTER_DECISION → 维持正本** | 亲验 `terminal-coding-standard.md:375` 确有 `KV → 进程内 Map`。Dexter 2026-08-30 裁定：正本不动，需求文档让步。残留风险登记（§5.3） |
| M-4 取消 `seal()` | **ACCEPTED** | 未找到必须异步注册端口**对象**的反例；纯 factory 更简单且同样编译期抓漏（§5.4） |
| M-5 脱敏违反上位标准 | **ACCEPTED** | 亲验上位标准第 2 条禁记清单，且全文 grep `PROD`/`DEV`/`TEST` 零命中 ⇒ 无环境例外。改为全环境脱敏、覆盖完整清单，删除"非 PROD 不遮蔽"断言（§6、§8 L 组） |
| M-6 成功语义缺失 | **ACCEPTED** | 亲验 `AppControlTurboModule.kt:68-77` 与 `MainActivity.kt:195-197`：排队即 resolve。新增 §5.5 五问与 P-7、§8 S 组 |
| S-1 `appControl` owner | **DEXTER_DECISION → 接口要全** | 亲验 POC kernel 仅一处消费（`createModule.ts:175`）。Dexter 裁定六类全量声明，默认返回"未注入适配器"。退出/kiosk 的产品授权仍标"需 Dexter 裁决"（§5.6） |
| S-2 ScriptModels 引述 | **PARTIALLY_ACCEPTED / 事实部分 REJECTED_WITH_EVIDENCE** | 原文表格已同时写明 `nativeFuncNames` **与** `NativeFunctionInvoker.invoke(funcName, argsJson, timeoutMs)`，事实未引错。真正失准的是评价句"边界上只有字符串"——invoker 本身跨界，只有参数与返回是字符串。措辞已收窄（§2.3、§3 主张三） |
| S-3 P-8 伪语义门 | **ACCEPTED** | 门收窄为原生 namespace / import / 明确平台类型；命名判断移入 P-9 评审清单，不再声称"完整词表" |
| S-4 P-4 过宽 | **ACCEPTED** | 改为白名单：只允许本包与 `kernel.base.contracts` |
| S-5 缺 consumer fixture | **ACCEPTED** | 新增 §8 C 组，并限定只在本包内写夹具 |
| N-1 五个 adapter 不是分母 | **ACCEPTED** | §5.1 已删除该推理并写明唯一判据 |
| N-2 无 requirements 模板 | **知悉** | `NOT_APPLICABLE_WITH_REASON`，非 finding |

第二轮（NO-GO，1M/1S）：

| 编号 | 处置 | 依据 |
|---|---|---|
| R2 M-1 `logger.emit` 旁路 | **ACCEPTED，取更简单那支** | 亲验 `types/logging.ts:60-68` 公开 `emit`，`foundations/logger.ts:107-109` 直接 `input.write(event)` 绕过 `createLogEvent`；`platform-ports.spec.ts:220-253` 把旁路固化为预期。再验**全仓调用 `logger.emit` 的只有该测试自己**，零生产消费者 ⇒ 公开面删除 `emit`，并加类型层夹具钉死（§6、§8 L 组⑤、P-13） |
| R2 S-1 引证"未检出"不成立 | **ACCEPTED，我方举证有误** | 该句确在 `dev-app/.../TestHomeFragment.kt:48`。**上一轮我只 grep 了 `.md` 文件，未搜 Kotlin 源码就下了"均未检出"的负面结论**，属穷举不足。已升为 `CONFIRMED` 并给出精确出处；同时保留 Codex 的限定：它是 dev-app 文案，只证伪"旧协议能力"，不证明 TER 不需要非协议能力（§5.1） |
| R2 对三处非全盘接受的判定 | **知悉** | S-2 同意我的部分驳回，不再构成 finding；display 删除被判为正确的架构收敛而非范围裁剪；localWebServer 按上行处置 |
| R2 其余核验结论 | **知悉，无需改动** | 不可用二分够用 · 成功语义五问成立 · 纯 factory 成立 · connector 最小契约够用 · C 组方向成立 · P-7…P-12 右尺寸。唯一实质缺口即 R2 M-1，已闭 |
