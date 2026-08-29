# `@next/ui-base-automation-runtime`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 F · F7a** —— 自研控制面已裁；生产 inert 须改成编译期可判定 |
| 路径 | `2-ui/2.1-base/ui-automation-runtime` |
| 规模 | src **1,685 行 / 26 文件**；test 436；test-expo 43 |
| 依赖 | `contracts` · `runtime-shell-v2` · `ui-runtime-v2` |
| 被依赖 | 2（`host-runtime-rn84` · `ui-base-test-support`） |
| 状态 | 活跃；**Dexter 已裁定 TER 完全自研，本包是基线** |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**统一的 UI 自动化与运行时调试控制面。** 一套 JSON-RPC 协议，两种传输：
Android 走 `adb forward` + 本机 socket；Web/Expo 走 WebSocket。

设计文档的自我定位很克制：
> 本设计的目标不是做一个通用的 agent 平台，也不是做重量级测试框架，
> 而是在现有架构上新增一套边界清晰、默认不启动、协议统一、宿主可适配的基础设施。

## 2 · 28 个方法，五类

| 类 | 方法 | 第三方能否替代 |
|---|---|---|
| **runtime** | `getInfo` `getState` `selectState` `listRequests` `getRequest` `getCurrentScreen` | ❌ 无 |
| **ui** | `getTree` `queryNodes` `getNode` `getFocusedNode` `getBounds` `performAction` `revealNode` `scroll` `setValue` `clearValue` `submit` | ✅ Maestro/Detox |
| **wait** | `forNode` `forScreen` `forState` `forRequest` `forIdle` | 部分（`forState`/`forRequest` 无替代） |
| **控制** | `command.dispatch` `scripts.execute` | ❌ 无 |
| **观测** | `events.subscribe/unsubscribe` `automation.getLastTrace/getTraceHistory/clearTrace` | ❌ 无 |

target 模型：`primary | secondary | host | all`，
且 **`wait.*` 与有副作用的方法禁止 `all`**（避免"对两块屏同时点一下"这种歧义）。

## 3 · 三个值得单独讲的实现

### 3.1 `wait.forIdle` 是真正的空闲检测

```ts
pendingRequests === 0 && inFlightActions === 0 && inFlightScripts === 0
  && (now - lastActivityAt >= quietWindowMs /* 默认 300ms */)
```

`lastActivityAt` 由订阅 `runtime.stateChanged` / `screenChanged` / `requestChanged` 事件更新。

**超时时返回 `blocker` 原因**：`pending-requests:3` / `quiet-window` / …
⇒ 自动化超时是**可诊断**的，不是"等了 5 秒没等到"。

这条比固定 sleep 好一个量级，也是 Maestro 这类外部工具给不了的
（它不知道你的 request ledger）。

### 3.2 semantic registry 有生命周期，不返回幽灵节点

- 按 target 独立维护（primary/secondary 各一份，不隐式同步）；
- 节点 unmount → 移入 `staleNodes` 并标 `stale: true`；
- screen 上下文变化 → 清理不属于当前可见上下文且未声明 `persistent` 的节点；
- `getNode` 命中 stale 节点必须返回 `STALE_NODE`；
- `performAction` 执行前**重新校验** mounted / visible / enabled / 属于当前 target 与 screen。

### 3.3 trace 逐步记录

`automationTrace.record({step, status, input, output})` ——
每个方法调用都留痕，`automation.getLastTrace` / `getTraceHistory` 可取。
失败时不用重跑就能看到卡在哪一步。

### 3.4 Product 环境默认 inert

设计文档 §2.1：Product 可以编入代码，但**默认不创建 registry、不启动 socket/ws server、
不注册 target、不保留 trace listener**。

## 4 · 优点

1. **把 runtime 内部事实变成可断言、可等待的东西**（`selectState` / `getRequest` /
   `wait.forState` / `wait.forRequest` / `command.dispatch`）—— 这是本包的真正价值，
   **没有任何第三方工具能提供**，因为它绑定的是自己的架构概念。
2. **`wait.forIdle` 带 blocker 原因**（§3.1）。
3. **semantic registry 有完整生命周期**，不返回幽灵节点（§3.2）。
4. **target 模型对双屏一等支持**，且对有副作用的方法禁止 `all`。
5. **同一协议、两种传输**（adb socket / WebSocket），调用方不关心宿主差异。
6. **trace 逐步留痕**（§3.3）。
7. **Product 默认 inert**（§3.4）。
8. **`command.dispatch` 让测试可以绕开 UI 直接驱动 kernel**，
   把"UI 坏了"和"业务坏了"分开 —— 方法论文档专门写了这条排查顺序。

## 5 · 缺点 / 风险

1. **语义来源是手工注册**（`FIX-08`）：全仓 `semanticId:` **52** 处 vs `testID=` **221** 处。
   注册是**加法**（写一行才有），覆盖率必然随代码量下降。
   设计文档 §6.2 明确第一版不走 Fabric shadow tree、不走 Android Accessibility。
2. **`browserAutomationHost.ts` 918 行**，占本包 55%。
   Web 宿主的实现体量超过协议与引擎之和。
3. **"生产不启动"靠约定不靠机制**（`FIX-14`）：代码仍编进产物，
   只是运行期不初始化。而这套控制面能读全部 state、dispatch 任意命令、执行任意脚本。
4. **`scripts.execute` 是任意脚本执行**，是最大的攻击面。
   设计文档称它为 escape hatch，但没有开关把它与其余方法分开。
5. **`ui.getTree` 返回的是"可自动化语义树"不是完整渲染树** ——
   这是明确的设计取舍并写进了文档，但意味着**没注册的东西自动化看不见**，
   与 §5.1 是同一个问题的两面。

## 6 · 与第三方的对比结论（Dexter 已裁定自研）

| | 自研控制面 | Maestro / Detox |
|---|---|---|
| UI 驱动（点击/输入/滚动/等元素） | ✅ 有 | ✅ 更成熟，且不需要注册 |
| 读 Redux state / request ledger | ✅ | ❌ |
| 直接 dispatch kernel command | ✅ | ❌ |
| `wait.forState` / `forRequest` | ✅ | ❌ |
| 双屏 target 寻址 | ✅ | ❌ |
| 真实空闲检测 | ✅ 带 blocker | Detox 有同步机制但语义不同 |

**Dexter 裁定完全自研**，理由是灵活度与可测面。本文只记录取舍事实，不再讨论替换。

## 7 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **控制面整体继承**：28 个方法面、target 模型、trace、Product inert | §4 |
| 2 | **语义来源从加法改减法**：注册下沉到 NativeWind + RNR 的 primitive 包装层，业务组件零感知 | 一次解决 `FIX-08`（§5.1）。这是 TER 相对 POC 最大的自动化改进点 |
| 3 | **"生产不启动"改为可机械验证**：构建变体剔除 / 编译期常量裁剪 / 启动断言，任选其一但必须可判定 | `FIX-14`（§5.3） |
| 4 | ~~`scripts.execute` 单独裁决~~ ⛔ **已裁定 `T-11`**：**保留，且必须支持运行期远端下发脚本源，不设来源限制**。Claude 原建议的「分开开关 + 审计」属安全侧加限，**已被 Dexter 明确否决**，不得重新引入 | `00-ter-build-order` §4B.11 X-08 |
| 5 | **`wait.forIdle` 的 blocker 原因整体继承**，并扩展到所有 wait 方法 | §3.1，超时可诊断 |
| 6 | **Web 宿主拆分**：918 行的 `browserAutomationHost` 按传输/协议/DOM 桥三层拆 | §5.2 |
| 7 | **考虑把 `host-runtime` 的"有类型故障注入规则集"接进来** | `k-05` §7.2：双屏测试最需要可编程故障 |
| 8 | 浏览器道（`test-expo`）与设备道共用同一协议的做法保留并铺开 | `KEEP-17` |

## 8 · 证据档位

`已亲验`：`types/protocol.ts` / `types/selectors.ts` / `types/actions.ts` 全文、
`foundations/waitEngine.ts` 的 `forIdle` 实现、`foundations/semanticRegistry.ts` 全文、
`foundations/automationTrace.ts`、文件行数、设计文档 §2.1/§6.2/§6.3/§11 原文、
`semanticId` 与 `testID` 的全仓计数。
**未逐行读**：`supports/browserAutomationHost.ts` 918 行、`foundations/queryEngine.ts`、
`foundations/actionExecutor.ts` 的完整分支。
