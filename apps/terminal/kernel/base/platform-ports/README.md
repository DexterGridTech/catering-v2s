# `kernel.base.platform-ports` · kernel 通往外部世界的唯一门

| 字段 | 值 |
|---|---|
| npm 名 | `@catering-v2s/kernel-base-platform-ports` |
| moduleName | `kernel.base.platform-ports` |
| 层 | `kernel/base` |
| kind | `toolkit`（不拥有 slice，不注册 command） |
| 依赖 | **只有** `kernel.base.contracts` |
| 适配目标 | RN Android · RN iOS · Electron Windows · Electron Linux |

---

## 1 · 这个包是什么

**kernel 对宿主能力的需求声明，以及这些能力的默认实现。**

`kernel/**` 零 Expo、零 RN、零原生 API 这条边界，靠的就是
**所有平台能力只能经此进入** —— 有唯一入口，才谈得上守住。
它也是 `TR-05` 规则句原文点名的两个包之一。

它有**十个端口**：

`logger` · `persistKv` · `persistSecure` · `device` · `appControl` ·
`script` · `connector` · `hotUpdate` · `logUpload` · `topologyHost`

## 2 · 它不是什么

| 不是 | 为什么 |
|---|---|
| 平台实现 | 真实实现在 `adapter/**`；本包只有**声明**与**零依赖默认实例** |
| 配置容器 | `environmentMode` 是 factory 的构造参数，**不是端口**，也不出现在 `PlatformPorts` 里 |
| UI / assembly 控制面 | automation 不进端口 —— 它是 UI 层关注点，且 `TR-08` 要求编译期剔除 |
| 屏幕上下文 | **没有独立的 `display` 端口**。设备级屏数由 `device.getDisplayInfo()` 提供；surface 身份仍由宿主经 `initialProps` 推入 `kernel.base.display-context`；`appControl` 只拿被推进来的 `containerKey` 路由既有 surface |

## 3 · 什么该进来 —— 三个判别式

**① 这个能力是不是「宿主提供、kernel 需要」的？**
adapter 做得到但 kernel 用不到的，不进来。

**② 命名说的是能力还是机制？**
问一句：**这个名字在四个平台上说的是同一件事吗？**
POC 的 `restartApp` 过不了 —— 它描述的是 Android 的做法（整进程重启），
而能力是"重置 JS 运行时"，本包叫 `resetRuntime`。
类型名、字段名、枚举值同理：**这个词在另外三个平台上有对应物吗？** 没有就属于 adapter。

**③ 两个能力该合还是该拆？** 四条全成立才合并，缺一条就拆开：
生命周期一致 · 默认档位一致 · 保证级别一致 · 由同一个 adapter 实现。
> `persistKv` 与 `persistSecure` 形状完全相同却是两个端口 —— 因为**保证级别不同**，
> 合并后调用方无法表达"这条必须加密"。

⚠️ **`localWebServer` 按这套判别式被判为不建**：它与 `topologyHost` 的协议能力不可分、
无已证的非协议能力、无真实 consumer。要重开这个结论，需要拿出这三项的新证据。

---

## 4 · 目录结构

```text
src/
  moduleName.ts / dependencies.ts   骨架元数据
  types/                            纯类型，无运行时代码
    result.ts        五态 result union · PlatformPortName 闭集 · 不可用原因
    logging.ts       LogEvent 与 LoggerPort（**无 emit**）
    storage.ts       persistKv 与 persistSecure 共用的 StateStoragePort
    device.ts        设备/屏幕/系统/电源快照与订阅（已去平台化）
    appControl.ts    六类宿主控制能力
    script.ts        脚本执行：函数名列表 + 单一 dispatcher
    connector.ts     外设通道 call/subscribe/unsubscribe/on
    hotUpdate.ts     热更新包与 boot/active/rollback marker
    logUpload.ts     按日期上传日志
    topologyHost.ts  跨机 host 服务（含 HTTP 与 WS 地址）
    platformPorts.ts LoggerBinding · 十键 bindings · PlatformPorts · factory 入参
  foundations/
    sensitiveData.ts        **唯一**的脱敏漏斗，不导出
    createPlatformPorts.ts  central logger 包装 · 穷尽装配 · 冻结根对象
  defaults/
    logger.ts               consoleLoggerBinding（可用）
    processMemoryStorage.ts 进程内 Map KV（可用，**不跨重启**）
    unavailable*.ts         八个不可用默认，**一端口一文件**
  index.ts                  唯一公开面，逐项显式导出，禁止 export *
test/
  platformPorts.test.ts         A 组 · 装配与冻结
  defaultPorts.test.ts          D 组 · 可用/不可用默认逐方法
  successSemantics.test.ts      S 组 · accepted/succeeded/timed-out
  logger.test.ts                L 组 · 全环境脱敏
  public-surface.typecheck.ts   C/F 组负夹具，**只进 tsc 不进 vitest**
```

八个不可用默认**一端口一文件**，是为了漏方法时能一眼定位；
共享的构造 helper 留在文件内私有，**不导出通用 fallback API**。

---

## 5 · 用法

### 5.1 装配：十个键必须写全，漏一个编译不过

```ts
import {
  createPlatformPorts, consoleLoggerBinding, createProcessMemoryStateStoragePort,
  unavailablePersistSecurePort, unavailableDevicePort, unavailableAppControlPort,
  unavailableScriptPort, unavailableConnectorPort, unavailableHotUpdatePort,
  unavailableLogUploadPort, unavailableTopologyHostPort,
} from '@catering-v2s/kernel-base-platform-ports';

const ports = createPlatformPorts({
  environmentMode: 'DEV',
  bindings: {
    logger: consoleLoggerBinding,                    // 或 {kind:'sink', write}
    persistKv: createProcessMemoryStateStoragePort(),
    persistSecure: unavailablePersistSecurePort,     // 这台机器真的没有 → 填不可用值
    device: unavailableDevicePort,
    appControl: unavailableAppControlPort,
    script: unavailableScriptPort,
    connector: unavailableConnectorPort,
    hotUpdate: unavailableHotUpdatePort,
    logUpload: unavailableLogUploadPort,
    topologyHost: unavailableTopologyHostPort,
  },
});
```

**为什么是穷尽 record 而不是 `register()` 逐个注册**：
装配是一次性动作，漏一个键必须在**编译期**炸，而不是运行期悄悄拿到默认实例。
`createPlatformPorts` 是**纯 factory**，返回 `Object.freeze` 后的对象 ——
没有可变注册器，也就没有"封口前取用"这个错误状态需要防。
assembly 若要等原生初始化，**在调用 factory 之前 await**，不要把等待做进端口层。

⚠️ **本包不导出"整套默认 record"的 helper**，就是为了不让人用一次 spread
掩盖掉"我没想清楚这个端口该填什么"。

### 5.2 消费：五态必须分支，不能当成功值用

```ts
const read = await ports.persistKv.read({key: 'lastOrderId', timeoutMs: 1000});

switch (read.status) {
  case 'succeeded':
    // read.value 是 {state:'found', value} | {state:'missing'}
    // ⚠️ 「没这个键」是 succeeded + missing，不是 unavailable
    break;
  case 'unavailable':
    // read.reason: 'ADAPTER_NOT_INJECTED' | 'PLATFORM_UNSUPPORTED'
    break;
  case 'failed':      break;   // read.error.retryable 决定要不要重试
  case 'timed-out':   break;   // read.timeoutMs 是原始预算
}
```

**两个不可用原因不要混**：
`ADAPTER_NOT_INJECTED` 是**这次装配没接线**（web、测试、未接线构建里是常态，走降级分支）；
`PLATFORM_UNSUPPORTED` 是**这个平台真的没有**（iOS 不允许应用自杀），UI 不该给出入口。

**`accepted` 不是 `succeeded`**：

```ts
const reset = await ports.appControl.resetRuntime({requestId, timeoutMs: 5000});
if (reset.status === 'accepted') {
  // 只代表宿主已受理。终态观察点是 reset.terminalObservation
  // = 'SUCCESSOR_RUNTIME_STARTED'，由后继运行时读 hotUpdate 的 marker
  //（marker 带 resetRequestId，用它和这次的 requestId 对上）
  // reset.value 不存在 —— 类型层就禁止你把它当成功值读
}
```

### 5.3 日志：只有一个入口族，且只有一个漏斗

```ts
const scoped = ports.logger.scope({moduleName: 'kernel.base.runtime'}).withContext({requestId});
scoped.info({category: 'order', event: 'submitted', message: '...', data: {...}});
```

`debug` / `info` / `warn` / `error` 与 `scope` / `withContext` 派生出的 logger
**全部经过同一个 sanitizer**。`LoggerPort` **没有 `emit`** —— 那是 POC 里绕过脱敏的公开旁路，本包不提供。

脱敏在**所有环境**生效（不存在"非 PROD 可明文"），覆盖 `message`、`data`（递归、键与值双判）、
`error` 的 `message/stack/name/code`；命中后**整值**替换为 `[REDACTED:<类别>]` 并把
`security.containsSensitiveRaw` 置真。类别写死在 `sensitiveData.ts`，
**不做可配置规则引擎**。

热更新诊断所需的合法 64 位 `packageSha256` / `manifestSha256`、数字版本串
`bundleVersion` 与十进制 `accountBalance` 会原样保留；不符合这些精确形状的值仍按敏感项处理。

### 5.4 脚本：传函数名，不传函数表

```ts
await ports.script.execute({
  source, paramsJson, globalsJson, timeoutMs: 3000,
  native: {kind: 'named', functionNames: ['printReceipt'], invoke: dispatcher},
  // 或 {kind: 'none'}
});
```

`source` 允许运行期远端下发（`T-11`），所以脚本源本来就是不可信输入。
安全边界是：**只有 `functionNames` 列出的名字能走那一个 `invoke`**，参数与返回都是 JSON 字符串。
不得恢复开放函数表，也不得回退到主 JS 上下文的 `new Function`。

---

## 6 · 默认实例的两个档位

**可用默认，当且仅当两条同时成立**：
① 不存在任何目标平台真的缺这个能力；
② 默认实现的语义与真实实现一致 —— 是同一件事的另一种做法，**不是冒充**。

| 端口 | 默认 | 说明 |
|---|---|---|
| `logger` | **可用** | `console` 在任何 JS 运行时都有，且它**就是真的在记日志**，只是去向不同 |
| `persistKv` | **可用** | 进程内 Map。⚠️ **`PROCESS_MEMORY_ONLY`，不跨进程重启** —— 依规范正本 `§3-A` 保留 |
| 其余八个 | **不可用** | 逐方法返回 typed 结果，`reason: 'ADAPTER_NOT_INJECTED'` |

⚠️ **`persistSecure` 永远是不可用默认**：明文存储冒充加密是**不可见的谎**，
比"能力不可用"这个**可见的事实**危险得多。adapter 侧在缺失时也必须返回不可用，不得退回明文。

---

## 7 · 在这个包上迭代时

### 7.1 改一个端口，要同时改这几处 —— 漏一处门就红

| 动作 | 必须同步改 |
|---|---|
| **给端口加/改一个方法** | ① `src/types/<port>.ts` 接口；② `src/defaults/unavailable<Port>.ts` **逐方法**补上（`capability` 必须**精确等于方法名**）；③ 门里的 `expectedPortMethods`；④ `test/defaultPorts.test.ts` 的逐方法断言 |
| **加/改一个公开导出** | ① `src/index.ts` 逐项显式导出；② 门里的 `expectedPublicExports` |
| **新增一个端口** | 上面全部，**再加** `types/result.ts` 的 `PlatformPortName`、`types/platformPorts.ts` 的两个 record、`foundations/createPlatformPorts.ts` 的装配、门里的 `expectedPortKeys` |

⚠️ 门里的 expected 清单是**手写常量**，**绝不能改成从源码自动派生** ——
那样多出来的导出永远抓不到，门就成了摆设。

### 7.2 必跑的命令

```bash
yarn workspace @catering-v2s/kernel-base-platform-ports typecheck
```

```bash
yarn workspace @catering-v2s/kernel-base-platform-ports test
```

```bash
node tools/terminal-platform-ports/check-static.test.mjs && node tools/terminal-platform-ports/check-static.mjs
```

四道门是 `tr05-named-boundary`（TR-05 具名边界，复用 contracts 的 analyzer）·
`required-port-shape`（两层零可选）· `default-import-allowlist`（默认实现只许 import 本包与 contracts）·
`platform-identifier-boundary`（无原生 namespace/import），外加一条公开面精确相等的 support check。

### 7.3 本包踩过的坑，不要踩回去

- **`tsconfig.json` 的 `include` 必须含 `test/**`**，否则 `public-surface.typecheck.ts` 里的
  `@ts-expect-error` 不会被求值，负夹具全部假绿。验证办法：**删掉一行该注释，typecheck 必须变红。**
- **端口方法不得是可选的**（`method?()`），端口键也不得可选。
  "这台设备没有第二块屏"是**返回值**要表达的事实，不是**方法存不存在**要表达的事实。
- **`Record<string, unknown>` / `any` / 双重 cast 会被门直接拦下。**
  真的需要字典时，把值收成闭合的递归 JSON 联合 —— 看 `LogValue` 与 `ConnectorValue` 的写法。
- **不可用不得抛异常、不得返回 `null`**：抛异常会让每个调用点重新变成 try/catch，
  返回 null 和"成功但没数据"分不清。
- **改 `sensitiveData.ts` 时必须同时补正反两类测试**：
  既要有"敏感值必须消失"，也要有"**合法值必须原样保留**"。
  只加遮蔽规则不加保留反例，很容易把 hash、版本号这类**排查问题最需要的字段**一起吃掉。
- **`LogContext` 通过闭合投影进入 sanitizer**：branded ID 字段保留，`commandName` 走同一 value sanitizer，
  未知字段不透传；新增字段必须先在该投影中显式处置，不能绕过唯一的漏斗。

### 7.4 遇到这些情况停下来问，不要自己决定

找不到某个形状的证据 · 某方法的成功语义答不出 · 需要新依赖或新出边 ·
需要增删公开端口/方法/导出 · 需要冻结 `connector` 的 channel 分类 ·
需要决定 `exitApplication` 与 kiosk 的 owner 和产品入口。

> 后两项分别是 `UNVERIFIED_REQUIRES_EVIDENCE` 与 `DEXTER_DECISION`，
> 本包只冻结了它们的形状，**没有裁定谁来调用**。
