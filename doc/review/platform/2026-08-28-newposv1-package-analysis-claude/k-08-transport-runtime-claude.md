# `@next/kernel-base-transport-runtime`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 F · F4a** —— 机制与协议无关，可先建；`N-1` 不检查状态码必须先修 |
| 路径 | `1-kernel/1.1-base/transport-runtime` |
| 规模 | src **2,344 行 / 31 文件**；test 1,907 行 |
| 依赖 | `contracts` · `platform-ports` · `runtime-shell-v2` · `state-runtime` |
| 被依赖 | 7 个包（tcp / tdp / topology / terminal-log-upload / benefit-session / host-runtime-rn84 …） |
| 状态 | 活跃；**招牌能力"多地址故障切换"有一处关键缺口** |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**HTTP + WS 的通用传输基础设施。** 地址目录、多地址选择、失败切换、有效地址保持、
并发闸门、限流、metrics、socket 生命周期与重连节奏。

设计红线（注释原文）："它故意不解释业务 envelope 成功/失败语义，
避免 transport 和业务完成语义再次混在一起。"

## 2 · 五层结构

```text
serverCatalog        serverName -> TransportServerAddress[]
  ↑
httpRuntime          重试轮 × 地址列表 + 偏好地址 + 并发闸门 + 限流 + metrics
  ↑
httpEndpoint         defineHttpEndpoint / buildHttpUrl
  ↑
httpServiceFactory   createModuleHttpEndpointFactory + service binder（result / envelope）
  ↑
业务包               TCP / TDP / terminal-log 各自的 service facade
```

WS 侧对称：`socketProfile`（defineSocketProfile / buildSocketUrl / JsonSocketCodec）→
`socketRuntime`（连接、地址迭代、事件、metrics）→ `socketLifecycleController`（重连节奏）。

## 3 · 关键实现

### 3.1 地址选择与偏好保持

```ts
resolveRoundAddresses(serverName)   // 把上次成功的地址排到最前
rememberPreferredAddress(...)       // HTTP 成功 / WS onOpen 时记住
replaceServers(...)                 // 更换服务器配置时清空偏好
```

`failoverStrategy: 'ordered' | 'single-address'`，外加 `retryRounds` 与可注入的 `shouldRetry(error, request)`。

### 3.2 并发闸门 + 滑窗限流

`HttpExecutionController`：`maxConcurrent` 用队列排队（不是拒绝），
`rateLimitWindowMs / rateLimitMaxRequests` 用时间戳滑窗，超限**抛 typed error** 而不是排队。
两种背压语义分得很清楚。

### 3.3 逐次尝试的 metrics

每次尝试产出 `HttpAttemptMetric{attemptIndex, roundIndex, addressName, baseUrl, startedAt, endedAt, durationMs, success, errorCode, errorMessage}`；
整次调用产出 `HttpCallMetric{endpointName, serverName, method, pathTemplate, durationMs, success, attempts[]}`。
**"这次调用试了几个地址、每个花了多久、为什么失败"是完整可回答的。**

### 3.4 service binder 两种业务语义

- `result(endpoint, input, errorInput)` —— 直接返回 `response.data`
- `envelope(...)` —— 期望 `{success, data, error}` 形状，`success === false` 时抛 typed `AppError`

**业务成功语义在这一层解释，不在 transport 层** —— 边界守住了。

### 3.5 socket 生命周期：连接 token 防幽灵连接

```ts
const token = ++connectionToken
await input.connect({isReconnect})
if (token !== connectionToken || manualStop) { input.disconnect('stale-connect'); return }
```

注释原文："token 防止'旧 connect 慢返回'覆盖新的 stop/restart 决策，避免重连竞态造成幽灵连接。"
这是重连里最容易出错的一处，这里处理对了。

### 3.6 一条被记录下来的真实平台坑

`socketProfile.ts` 的 `buildSocketUrl` 坚持纯字符串拼接，注释写明：

> RN84 + Hermes 在 Android 上对 `new URL('ws://...')` 的 host 解析不可靠，会得到空 host，
> 进而让 RN 原生 WebSocketModule 抛 `Invalid URL host: ""`。

⚠️ 对比：**HTTP 侧的 `buildHttpUrl` 仍然用 `new URL(joinedUrl)`** —— 两边不一致，
但 http/https 在 Hermes 上没有这个问题，所以不是缺陷，只是同一个文件族里两种做法。

## 4 · 【关键缺口】故障切换在最常见的两种故障下不触发

### 4.1 全链路从不检查 HTTP 状态码

穷举 `foundations/` `supports/` `types/http.ts` 下所有 `.status` 命中，只有两处：

```
foundations/fetchHttpTransport.ts:52-53   // 放进返回对象
foundations/httpRuntime.ts:271            // 放进日志 data
```

**没有任何一处检查 `response.ok` 或状态码区间。**

后果链（`推论`，推导链如下）：

1. 服务端返回 500/502/404 且响应体是合法 JSON ⇒ transport 返回成功 ⇒
   `httpRuntime` 的 `try` 不抛 ⇒ **`rememberPreferredAddress` 把这个坏地址记为首选**；
2. 多地址故障切换**只在 fetch 本身 reject 时触发**（DNS 失败、连接拒绝、abort），
   服务器"活着但坏了"时不切换，而且坏地址被粘住；
3. `callHttpEnvelope` 的 `envelope.success` 会兜住业务失败，
   但那是**业务错误**，不会回流成 transport 失败，也就不会触发切换；
4. 500 返回 HTML 时，`JSON.parse` 抛 SyntaxError ⇒ 才被当成 transport 失败 ⇒ 切换。

**所以行为不一致**：`500 + JSON` 不切换且粘住坏地址，`500 + HTML` 切换。
两种在门店网络里都会发生（网关 502 常返 HTML，业务服务 500 常返 JSON）。

### 4.2 kernel 自带 transport 忽略 `timeoutMs`，生产 transport 补上了

`httpRuntime` 会算出 `timeoutMs = endpoint.timeoutMs ?? address.timeoutMs` 并放进 `HttpTransportRequest`。

| 实现 | 位置 | 是否用 timeoutMs |
|---|---|---|
| `createFetchHttpTransport` | `transport-runtime/src/foundations/fetchHttpTransport.ts` | ❌ **完全忽略**，无 AbortController、无 signal |
| `createAssemblyFetchTransport` | `host-runtime-rn84/src/platform-ports/transport.ts` | ✅ 有 `AbortController` + `setTimeout(abort)` + `finally clearTimeout` |

**生产路径是安全的**；但 kernel 自带的那个是测试与其他宿主的默认实现，
`server-config-v2` 上配的 `timeoutMs: 3_000` 在它身上不生效。
两个实现行为不同，而契约（`HttpTransportRequest.timeoutMs`）看起来是统一的。

## 5 · 优点

1. **多地址 + 失败切换 + 偏好保持**的形状是门店网络的正确答案（多条可达路径、任一可能间歇不可用）。
2. **transport 不解释业务成功语义**，并把业务 envelope 解释放在 service binder 一层，边界干净。
3. **逐次尝试 metrics** 让"为什么这次请求慢/失败"可回答，不用靠猜。
4. **并发闸门（排队）与限流（抛错）语义分开**，不是一个含糊的"限流"。
5. **重连 token 防幽灵连接**，且写了注释说明为什么需要。
6. **踩过的平台坑写在代码旁边**（Hermes 的 `new URL('ws://')`）—— 没有这条注释，后人一定会"优化"掉。
7. **endpoint / profile 是第一公民**，service binder 只收薄样板、不隐藏传输语义（注释里明说了这个取舍）。

## 6 · 缺点 / 风险

1. **§4.1：不检查 HTTP 状态码，导致故障切换在 5xx 下不触发，且坏地址被记为首选。**
   这是本包最重要的缺口——招牌能力在最常见的服务端故障形态下失效。
2. **§4.2：两个 transport 实现对 `timeoutMs` 的行为不一致。**
3. **`readResponseData` 的 `JSON.parse` 无 try/catch**：非 JSON 响应抛 SyntaxError，
   错误信息是 `Unexpected token <` 而不是"502 网关错误"，排障时指向错误的方向。
4. **`serverCatalog` 是运行期可变的全局 Map**，`replaceServers` 会清空偏好——
   多 runtime 共享一个 catalog 时会互相影响（当前一进程一 runtime，不是问题）。
5. **限流超限抛的是 `createTransportNetworkError`**，与真实网络错误同一类型，
   `shouldRetry` 无法区分"被自己限流"和"网络不通"。
6. **HTTP 与 WS 的 URL 构造策略不一致**（`new URL` vs 纯字符串），虽有理由但没写在 HTTP 侧。

## 7 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **transport 层必须判定 HTTP 状态码**：非 2xx（或可配置的可重试集合，如 5xx/408/429）视为传输失败，触发切换且**不记为首选地址** | 修 §4.1。这是"多地址故障切换"能真正成立的前提 |
| 2 | 状态码策略要**可注入**（`isRetryableStatus(status, request)`），因为某些业务用 4xx 表达正常分支 | 避免把业务语义硬编进 transport |
| 3 | **timeout 在 transport 契约层强制**：要么 kernel 默认实现补 AbortController，要么把 `HttpTransport` 接口改成"实现必须遵守 timeoutMs"并加一个 conformance 测试 | 消掉两实现不一致（§4.2） |
| 4 | **响应体解析失败要保留状态码与前 N 字节**，错误消息里带 `status` | 让"502 返回 HTML"指向正确方向（§6.3） |
| 5 | **多地址失败切换 + 偏好保持整体继承**，并且**必须留在 transport runtime**，不交给任何 HTTP client（RTKQ 也好、生成的 fetch client 也好，只是它下面一层） | 这是我们的策略不是客户端的（`KEEP-12`） |
| 6 | **逐次尝试 metrics 整体继承**，并接进 Sentry breadcrumb | 现成的排障素材 |
| 7 | **限流错误与网络错误分成两个 error definition** | 让 `shouldRetry` 能区分 |
| 8 | 重连 token 机制整体继承 | 竞态处理正确，重写容易出错 |
| 9 | WS 保留（Dexter 已裁定 SSE 放弃），`socketLifecycleController` 的重连节奏可直接复用 | 讨论稿 §7.1 |

## 8 · 证据档位

- 结构、地址选择、metrics、限流、重连 token：`已亲验`，逐文件读过。
- §4.1 无状态码检查：`已亲验`（穷举 `foundations/` `supports/` `types/http.ts` 的 `.status` 命中共 2 处，均非判定）。
  后果链为 `推论`，推导链已写出；**未做运行验证**，TER 落地前建议用一次 500 响应实测确认。
- §4.2 两实现差异：`已亲验`，两个文件全文对照。
