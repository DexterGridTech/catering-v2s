# `@next/kernel-base-platform-ports`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 F · F1a** —— 端口形状需按 `FIX-03`/`FIX-04`/`N-2` 重做后再建 |
| 路径 | `1-kernel/1.1-base/platform-ports` |
| 规模 | src **482 行 / 16 文件**；test 256 行 |
| 依赖 | `@next/kernel-base-contracts` |
| 被依赖 | 声明 14 个包，源码实际 import **11 个包** |
| 状态 | 活跃、健康，但端口形状有系统性问题 |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**kernel 访问外部世界的唯一入口。** 它定义 kernel 需要宿主提供的能力接口，由 adapter/assembly 在启动时注入实现。

这是"`1-kernel/**` 零 React / 零 RN / 零 Android API"能成立的**机制**——
有唯一入口才谈得上守住。README 原话："kernel 包不能偷用平台 API。"

## 2 · 端口清单（`types/ports.ts`）

```ts
export interface PlatformPorts {
    environmentMode: LogEnvironmentMode        // 必填
    logger: LoggerPort                         // 必填
    terminalLogs?: TerminalLogUploadPort
    scriptExecutor?: ScriptExecutorPort
    stateStorage?: StateStoragePort
    secureStateStorage?: StateStoragePort
    device?: DevicePort
    appControl?: AppControlPort
    hotUpdate?: HotUpdatePort
    topologyHost?: TopologyHostPort
    localWebServer?: LocalWebServerPort
    connector?: ConnectorPort
}
```

| 端口 | 能力 | 类型质量 |
|---|---|---|
| `LoggerPort` | 结构化日志 + scope/withContext 派生 | ✅ 具名类型完整 |
| `StateStoragePort` | KV：`getItem/setItem/removeItem` + 可选 `multiGet/multiSet/multiRemove/getAllKeys/clear` | ✅ 完整 |
| `secureStateStorage` | 同上，加密后端 | ✅ 复用同一接口 |
| `ScriptExecutorPort` | `execute<T>({source, params, globals, nativeFunctions, timeoutMs})` | ⚠️ `nativeFunctions` 是 `Record<string, Function>` |
| `TerminalLogUploadPort` | 按日期上传日志，返回逐文件结果 | ✅ 结构完整 |
| `DevicePort` | `getDeviceId/getPlatform/getModel` + `addPowerStatusChangeListener` | ❌ 电源事件是 `Record<string, unknown>` |
| `AppControlPort` | `restartApp` / `clearDataCache` | ✅ 简单完整 |
| `HotUpdatePort` | 下载/写 boot marker/读 active/rollback marker/确认 load complete | ❌ 四个 marker 读取全返回 `Record<string, unknown> \| null` |
| `TopologyHostPort` | `start/stop/getStatus/getDiagnosticsSnapshot` | ⚠️ 返回联合了 `Record<string, unknown>` |
| `LocalWebServerPort` | `start/stop/getStatus` | ❌ 三个方法全 `Record<string, unknown>` |
| `ConnectorPort` | `call/subscribe/unsubscribe/on/isAvailable/getAvailableTargets/connect/disconnect` | ❌ 几乎全是 `Record<string, unknown>` |

## 3 · 关键实现

### 3.1 `createPlatformPorts`：只校验两个必填项

```ts
if (!input.environmentMode) throw ...
if (!logger) throw ...
for (const m of ['emit','debug','info','warn','error','scope','withContext'])
    if (typeof logger[m] !== 'function') throw ...
return Object.freeze({...input})
```

`logger` 被逐方法校验（防止传一个只实现了一半的 logger），其余十个端口**不校验、不要求**。
返回值 `Object.freeze`，防止运行期被改。

### 3.2 `createLoggerPort`：脱敏按 PROD/非 PROD 切换

```ts
const SENSITIVE_FIELD_PATTERN = /(token|password|credential|secret|phone|mobile|idNumber|identity|payment)/i
resolveMaskingMode = env => env === 'PROD' ? 'masked' : 'raw'
```

- `containsSensitiveRaw(data)` 递归看**键名**是否命中上面的正则；
- `maskValue(data)` 在 PROD 下把命中键的值换成 `[MASKED]`，带 `WeakSet` 循环引用保护（`[CIRCULAR]`）；
- 每条 `LogEvent` 都带 `security: {containsSensitiveRaw, maskingMode}`；
- `scope()` / `withContext()` 返回新 logger，逐层合并，不改原对象。

## 4 · 依赖关系

- **出边**：只有 `contracts`。
- **入边**：kernel base 的 execution-runtime / host-runtime / runtime-shell-v2 / state-runtime / tcp / tdp / topology / transport / ui-runtime / workflow，以及 `host-runtime-rn84`。

## 5 · 优点

1. **端口层真的挡住了平台泄漏**——13 个 kernel 包零 React/RN/Android import，这是可验证的事实而不是承诺。
2. **`logger` 逐方法校验**，比"传进来就当它是 logger"稳。
3. **普通存储与加密存储分成两个端口**，让 slice descriptor 的 `protection: 'protected'` 有真实落点。
4. **`security.containsSensitiveRaw` 是类型里的必填字段**——写日志的人被迫回答这个问题，而不是靠约定。
5. **`Object.freeze`** 让端口集合在运行期不可被偷改。
6. **`scriptExecutor` 作为端口而不是 kernel 内实现**，让沙箱策略归宿主（Android 用 QuickJS，Electron/Node 可以另选）。

## 6 · 缺点 / 风险

### 6.1 端口退化成 `Record<string, unknown>`（`FIX-03`）

`DevicePort.addPowerStatusChangeListener(listener: (event: Record<string, unknown>) => void)`、
`HotUpdatePort` 的四个 marker 读取、整个 `LocalWebServerPort` 与 `ConnectorPort`。

端口的全部意义是**有类型的边界**。退化成 `Record<string, unknown>` 之后它不是边界，是洞：
消费侧只能手搓字段名，那些字段名立刻变成**跨层字符串、零编译器保护**。
`spec/layered-runtime-communication-standard.md` 的迁移地图自己把"归一化 power payload"列为待办，说明作者知道。

### 6.2 十个端口全可选，缺失时无 fail-fast（`FIX-04`）

> ✅ **解法已定**（Dexter 2026-08-28）：改为**端口注册器 + 默认实例**，端口取消可选。见 §7 第 2 行与 `00-ter-build-order` §4B.1。
> 下文保留问题描述作为证据。

12 个字段只有 2 个必填。于是每个消费者写 `ports.device?.getDeviceId()`，
并**在每一个调用点**决定"没有这个能力时怎么办"。
真正该回答一次的问题——"这个模块没有 device 还能不能工作"——被推迟到运行时、推迟到处处。
**降级行为因此散落且不一致**，最坏的一例是 `workflow-runtime-v2` 在 `scriptExecutor` 缺失时
静默退回 `new Function` 在主 JS 上下文求值（`FIX-22`）。

### 6.3 脱敏只看键名，不看值，也不覆盖 message

- `containsSensitiveRaw` 对顶层字符串直接 `return false`；
- `maskValue` 只按**键名**正则替换；
- `LogEvent.message` **完全不参与脱敏**。

所以 `logger.info({message: '用户 13800138000 登录成功'})` 在 PROD 下原样落盘，
`logger.info({data: {value: '13800138000'}})` 也既不标记也不脱敏。
正则命中的是 `phone`/`mobile` 这种**键名**，而现场最常见的是"值敏感、键名普通"。

### 6.4 `ScriptExecutorPort.nativeFunctions` 是 `Record<string, (...args:any[]) => unknown>`

把宿主函数直接塞进脚本全局，类型上完全开放。这是动态脚本能力的攻击面之一。

## 7 · 重构到 TER 的优化方向

| # | 动作 | 理由 / 判据 |
|---|---|---|
| 1 | **端口方法的入参与返回一律具名类型，禁止 `Record<string, unknown>`** | 可做成机械门：扫 port 类型定义文件里的该字面量，禁止句形态；红夹具＝把任一端口方法改回去，门必须红 |
| 2 | ⚠️ **本行前两版都写错了，以本版为准。** 第一版建议"安装期 fail-fast"、第二版建议"required/optional 三态"，**均被 Dexter 2026-08-28 裁定取代**。正解是一版 POC 已验证过的形状：**端口注册器 + 默认实例** —— `PlatformPorts` **取消全部可选字段，端口永远存在**；有人注册就用注册的实现，没人注册就用**声明端口时自带的默认实例**（必须零额外依赖）。默认分两类：**可用默认**（`logger` → `console.log`，KV → 进程内 Map）与**不可用默认**（摄像头/打印/热更新 → typed `CAPABILITY_UNAVAILABLE`）。详见 `00-ter-build-order` §4B.1 | 这样 `ports.scanner.scan()` 永远可调、永远类型正确、永远返回有意义的结果；**降级只在端口声明处发生一次**，不再散落到每个调用点 —— 本表 §6.2 描述的 `FIX-04` 由此整条消解 |
| 3 | 脱敏改成**按值 + 按键双判**，并**覆盖 `message`** | 现场最常见的是值敏感、键名普通；`message` 是自由文本，恰恰最危险 |
| 4 | 脱敏正则升级为**分类规则表**（手机号/身份证/银行卡/token 各自的值模式），并加单测 | 单条正则既漏又误 |
| 5 | 按 TER 需要**重切端口粒度**：`persist-kv` / `persist-secure` / `device` / `app-control` / `scanner` / `connector` / `script` / `hot-update` / `dual-screen` | 对应 adapter 侧一个 expo-module 一个端口，dev-app 可逐个验 |
| 6 | 新增**能力型**端口表达"持久 + 可本机查询汇总"（SQLite/IndexedDB/webstorage 由 adapter 选） | Dexter 已定：非 adapter 层对后端无感。已裁定推迟，先占位不实现 |
| 7 | `createPlatformPorts` 的逐方法校验**扩展到所有已声明端口** | 现在只有 logger 享受这个保护 |

## 8 · 证据档位

全部 `已亲验`：`types/ports.ts`、`types/logging.ts`、`foundations/createPlatformPorts.ts`、
`foundations/logger.ts` 逐行读过。
脱敏行为的三条结论由 `containsSensitiveRaw` / `maskValue` / `createLogEvent` 的实际分支推出（`推论`，推导链已在 §6.3 写出）。
