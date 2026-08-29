# UI 桥接与测试支撑三包

> `topology-runtime-bridge` · `hot-update-runtime-bridge` · `ui-base-test-support`

---

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## A · `@next/ui-base-topology-runtime-bridge`（132 行）

| 字段 | 值 |
|---|---|
| **TER 批次** | **分开** —— `topology-runtime-bridge` → **批 D**；`hot-update-runtime-bridge` → **批 N**（空目录）；ui `test-support` → **批 F · F9b**（须先与 tcp 解耦） |
| 规模 | src **132 行 / 7 文件**；test 134 行（测试比 100%） |
| 依赖 | `runtime-shell-v2` · `topology-runtime-v3` · `ui-runtime-v2` · `runtime-react` |
| 被依赖 | 1（`host-runtime-rn84`） |

### A.1 它是"请求确认拆两段"的标准范例

整个包只有**一个 actor、一条 command 处理**：

```ts
onCommand(topologyRuntimeV3CommandDefinitions.requestPowerDisplayModeSwitchConfirmation, async ctx => {
    await ctx.dispatchCommand(createCommand(uiRuntimeV2CommandDefinitions.openOverlay, {
        definition: runtimeReactDefaultParts.defaultAlert.definition,
        id: TOPOLOGY_POWER_DISPLAY_SWITCH_ALERT_ID,
        props: {
            title: isPrimary ? '切换到主屏' : '切换到副屏',
            message: '检测到电源状态变化，请确认是否切换显示模式。',
            autoConfirmAfterMs: 3_000,
            confirmAction: {commands: [closeOverlay(...), confirmPowerDisplayModeSwitch({displayMode})]},
            cancelAction: {commands: [closeOverlay(...)]},
            metadata: {reason, targetDisplayMode, powerConnected},
        },
    }))
})
```

**完全声明式**：没有回调、没有命令式编排。
确认后要执行什么，是 alert props 里的一个 `commands` 数组（`ui-runtime-v2` 的 `UiAlertAction`）。

链路：
`adapter 报电源变化 → platform port → topology-runtime-v3 判定并发 request 命令 → 本 bridge 开 alert
→ 用户确认 → alert 里带的两条 command 被 dispatch → topology 执行状态迁移`

### A.2 一条文档漂移（好的方向）

`spec/layered-runtime-communication-standard.md` 的 **Priority A 第 1 条**把
"assembly 直接消费电源事实、构造 overlay、内嵌 topology 执行命令"列为待重构项，
并给出目标形态。

**代码里这条已经完成了** —— 目标形态就是本包。但标准文档仍把它列为待办（`FIX-10`）。

### A.3 优点

1. **132 行做完一件完整的事**，是全仓"一个包一个职责"的最好样本。
2. **`autoConfirmAfterMs: 3000`** —— 无人值守终端上，确认框不能永远等人点。
3. **文案可由装配方覆盖**（`CreateTopologyRuntimeBridgeModuleInput.powerDisplaySwitchAlert`），
   基础包给默认值。
4. **测试比 100%**。
5. **`metadata` 里带 `reason` / `targetDisplayMode` / `powerConnected`** —— 自动化与日志能看到"为什么弹这个框"。

### A.4 缺点 / 风险

1. **只有电源切屏这一个 bridge。** 包名叫 `topology-runtime-bridge`，
   但 topology 还有别的需要 UI 确认的动作（配对导入、断开重连、清除主机），
   目前那些仍在 `admin-console` 的组件 handler 里（`u-02` §5.2）。
2. **默认文案硬编码中文**在基础包里。可覆盖，但默认值是产品文案。

### A.5 TER 优化方向

| # | 动作 |
|---|---|
| 1 | **这个形态整体继承**，并作为 TER"kernel 需要 UI 确认"的**唯一标准写法**写进规范 |
| 2 | topology 其余需要确认的动作**一并收进 bridge**，不留在组件 handler |
| 3 | 默认文案移出基础包，由装配方必填 |
| 4 | `autoConfirmAfterMs` 的存在提醒：TER 所有确认框都要回答"无人值守时怎么办" |

---

## B · `hot-update-runtime-bridge`（**空目录**）

| 字段 | 值 |
|---|---|
| 路径 | `2-ui/2.1-base/hot-update-runtime-bridge` |
| 实际内容 | **0 个文件**（只有空的 `src/` 与 `test/` 两个目录） |
| 被引用 | 仅 `2-ui/2.1-base/README.md` 的包清单表中一行 |

`2.1-base/README.md` 把它列为在编包：

> \| `hot-update-runtime-bridge` \| 热更新重启/进度类 UI bridge。\|

**但它一个文件都没有。** 该能力实际住在 `runtime-react/src/ui/components/HotUpdateProgressModal.tsx`（65 行），
以及（按 `layered-runtime-communication-standard.md` Priority D 第 3 条）曾在 assembly 里编排。

### B.1 这说明什么

**文档声明了一个不存在的包**，而没有任何机制会发现。
与 `FIX-11`（没有机制注意到"没人用"）是同一根：
这里是反向的"没有机制注意到**不存在**"。

### B.2 TER 动作

| # | 动作 |
|---|---|
| 1 | **不建这个包**；热更新的 UI 交互按 A 的形态做成一个真实 bridge，或明确留在 renderer |
| 2 | **依赖/结构 checker 增加一条**：README 的包清单必须与实际存在的包一致 |
| 3 | 空目录不进仓 |

---

## C · `@next/ui-base-test-support`（1,177 行）

| 字段 | 值 |
|---|---|
| 规模 | src **1,177 行 / 9 模块**；test 0 |
| 依赖 | 9 个（含 `ui-automation-runtime` · `runtime-react` · 多个 kernel 包） |
| 被依赖 | 声明 1 个，源码 0（devDependency，测试期使用） |

### C.1 它是"浏览器测试道"的基础设施

九个模块：

| 模块 | 行数 | 内容 |
|---|---|---|
| `shell/` | 291 | `ExpoRuntimeTestShell` 组件 + `createExpoRuntimeReactHarness` |
| `storage/` | 161 | `createMemoryStorage` / `createWebStoragePort`（localStorage / sessionStorage / memory 三模式） |
| `expoConfig/` | 137 | 从环境读 Expo Web 测试配置、解析 server config 与激活码 |
| `platform/` | 136 | `createExpoWebPlatformPorts`（浏览器版 platform ports） |
| `transport/` | 125 | `createBrowserFetchTransport` / `createBrowserWsTransport` / `overrideServerBaseUrl` |
| `topology/` | 121 | `createExpoWebTopologyAssembly`（浏览器里接真实 topology host） |
| `ui/` | 103 | `ExpoTestWatermark`（测试水印） |
| `logger/` · `tcpControl/` | — | 日志与 TCP 控制面测试桩 |

**这是 `test-expo/` 那条道能存在的原因**：
浏览器里要跑真实 kernel，就需要浏览器版的 platform ports、transport、storage、topology assembly。

### C.2 优点

1. **让"真实 kernel 在浏览器里跑"成为可能** —— 这是 `KEEP-17` 三层测试里最有价值的一层：
   真浏览器、真 effect、真布局、真事件，比 jsdom 强。
2. **storage 三模式**（memory / localStorage / sessionStorage）让"重启恢复"可以在浏览器里验证。
3. **`ExpoTestWatermark`** —— 页面上标出这是测试实例，避免误认。
4. **`overrideServerBaseUrl`** 让同一份配置在测试里指向临时服务器。
5. **它同时是 Electron 适配的预演**：浏览器版 platform ports 的形状，
   与将来 Electron 版高度重叠。

### C.3 缺点 / 风险

1. **自身 0 测试**（测试基础设施没有测试）。它坏了会表现成"业务测试莫名其妙失败"。
2. **依赖 9 个包**，其中包含 `ui-automation-runtime` ——
   测试支撑与自动化控制面互相依赖，环形风险（当前不是环，但方向上要注意）。
3. **与 `1-kernel/test-support` 同名不同形态**：
   一个是 npm 包（本包），一个是散文件（kernel 侧）。
4. **`platform/` 里的浏览器 platform ports 与将来 Electron adapter 高度重叠**，
   但当前是"测试支撑"，不是"Electron 适配层" —— 定位需要在 TER 明确。

### C.4 TER 优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **整体继承**，并**铺到全部 UI 包**（当前只有 2 个包在用 test-expo 道） | `KEEP-17`；这是 TER"web 方式测试"的现成底座 |
| 2 | **浏览器 platform ports 与 Electron adapter 的关系先定** | 两者形状高度重叠（§C.3.4）；Dexter 已裁定 Electron 先建空目录 |
| 3 | **补自身测试**（至少 storage 三模式与 transport 的 conformance） | §C.3.1 |
| 4 | **与 kernel 侧 test-support 形态统一**（都做成包） | §C.3.3 |
| 5 | **共享 live-harness 建在这里还是 kernel 侧要定**（kernel 侧必须 React-free） | `b-03` §B.5.2 |

---

## D · 证据档位

`已亲验`：
A —— `topology-runtime-bridge/src/application/createModule.ts` 全文、行数、测试行数、
`layered-runtime-communication-standard.md` Priority A 第 1 条原文。
B —— `find` 确认 0 文件；全仓 `rg` 确认只有 README 一处提及。
C —— `src/index.ts`、九个模块的导出清单（`rg` 提取）、行数、`package.json` 依赖。
**未逐行读**：C 的 `shell/index.tsx` 291 行完整实现。
