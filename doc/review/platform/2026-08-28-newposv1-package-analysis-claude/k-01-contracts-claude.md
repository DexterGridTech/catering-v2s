# `@next/kernel-base-contracts`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 F · F0** —— 零依赖，最先建 |
| 路径 | `1-kernel/1.1-base/contracts` |
| 规模 | src **760 行 / 19 文件**；test 110 行 |
| npm 依赖 | **零**（连 `@next/*` 都没有） |
| 被依赖 | 声明 17 个包，源码实际 import **18 个包** —— 全仓被依赖最广 |
| 层位 | 依赖图最底层，无出边 |
| 状态 | 活跃、健康 |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**跨包共享语言层。** 它只放"多个包必须对同一件事用同一个名字"的东西：ID、时间、错误、参数、request 生命周期、command envelope、topology 握手、state-sync envelope、transport server 配置形状。

README 的定位原话是"跨包共享语言层"，并明确 **不能依赖 runtime-shell、Redux、platform ports**。实测符合：`package.json` 的 `dependencies` 为空，`src` 下零第三方 import。

## 2 · 公开面

`src/index.ts` 只有 18 行，导出 `moduleName` / `packageVersion` / `protocolVersion` + 六个子目录桶。
其中 `application` / `selectors` / `hooks` / `features/*` 四处是**空壳**（`export {}` + 一行注释），只为保持全包统一骨架。

`src/protocol/index.ts` 是一个**二次筛选出口**：从 `types` 里挑出真正属于"跨节点线上协议"的 15 个类型再导一次
（`NodeHello` / `NodeHelloAck` / `PairingTicket` / `CommandDispatchEnvelope` / `StateSync*Envelope` / …）。
这一层区分"包内共享类型"与"上线协议对象"，是个有意为之的分界。

## 3 · 内部结构与关键实现

### 3.1 branded ID 类型（`types/ids.ts`）

```ts
export type RequestId = string & {readonly __brand: 'RequestId'}
export type CommandId = string & {readonly __brand: 'CommandId'}
// runtime / session / node / connection / envelope / dispatch / projection 同型
```

九种 ID 全部 branded。配套 `foundations/runtimeId.ts` 用三字母前缀生成：
`req_` / `cmd_` / `ses_` / `nod_` / `con_` / `env_` / `dsp_` / `prj_` / `run_`，
payload 是 `Date.now().toString(36) + '_' + 随机 16 位`，`crypto.randomUUID` 可用时用它、否则退 `Math.random`。

**效果**：把 `requestId` 传进要 `commandId` 的参数位是编译错误；日志里一眼看得出是哪种 ID。

### 3.2 错误协议（`types/error.ts` + `foundations/error.ts`）

三层结构分得很清楚：

| 类型 | 是什么 |
|---|---|
| `ErrorDefinition` | **静态定义**：key / name / defaultTemplate / category / severity / code |
| `AppError` | **一次真实错误**：definition 渲染后的 message + 上下文（commandId/requestId/sessionId/nodeId）+ args + details + cause + stack |
| `ErrorCatalogEntry` | **动态覆盖**：远端下发的 template，带 `source: 'default' \| 'remote' \| 'host'` |
| `ResolvedErrorView` | **给人看的最终形态**，带 `source: 'catalog' \| 'definition-default' \| 'app-error'` |

`renderErrorTemplate` 用 `${key}` 占位，缺参数渲染成空串（不抛错、不留占位符）。
`isAppError` 是结构化 type guard，检查 6 个必需字段。

`ErrorCategory` 是 9 值闭集（BUSINESS / VALIDATION / AUTHENTICATION / AUTHORIZATION / NETWORK / DATABASE / EXTERNAL_API / SYSTEM / UNKNOWN），`ErrorSeverity` 4 值。

### 3.3 参数协议（`types/parameter.ts`）

`ParameterDefinition<TValue>` 带 `valueType: 'string'|'number'|'boolean'|'json'`、`defaultValue`、可选 `decode` 与 `validate`。
`ResolvedParameter` 带 `source: 'default' \| 'catalog-fallback' \| 'catalog'` 与 `valid: boolean` ——
**"用了默认值"和"catalog 值非法所以退回默认值"是两种不同的 source**，可观测。

### 3.4 定义工厂（`foundations/definition.ts`）

```ts
const defineError = createModuleErrorFactory(moduleName)      // key = `${moduleName}.${localKey}`
const defineParameter = createModuleParameterFactory(moduleName)  // .string/.number/.boolean/.json
```

key 由 moduleName 派生，业务侧不手拼字符串。`listDefinitions(obj)` 把定义对象转成数组供 manifest 使用。

### 3.5 request 生命周期协议（`types/request.ts`）

`CommandLifecycleStatus` 六态：`registered → dispatched → accepted → started → completed | error`。
`RequestLifecycleSnapshot` 含 `commands[]` 与 `commandResults[]` 两组，可整体装进
`RequestLifecycleSnapshotEnvelope` 跨节点镜像。
**这是"远端命令已开始但未完成时本机不能提前显示 completed"能实现的协议基础。**

### 3.6 state-sync 协议（`types/stateSync.ts`）

`summary`（每 key 的 `updatedAt` + `tombstone` + `valueHash`）→ `diff`（实际值）→ `commitAck` 三段式，
带 `direction: 'master-to-slave' | 'slave-to-master'` 与 `replaceMissing`。

## 4 · 依赖关系

- **出边**：零。
- **入边**：18 个包实际 import（kernel base 全部、kernel business 全部、ui base 多个、host-runtime-rn84）。

## 5 · 优点

1. **真正做到零依赖**，因此谁都能依赖它而不产生环。这是"共享语言层"能成立的前提，多数项目做不到。
2. **branded ID** 把最容易串的九种字符串 ID 变成编译期可区分。成本极低、收益持续。
3. **错误三层分离**（静态定义 / 一次错误 / 动态覆盖 / 最终视图）—— `source` 字段让"这条文案从哪来"永远可回答。
4. **参数解析结果自带 `valid` 与 `source`** —— 远端下发了非法值时不是静默用默认值，而是可观测地标成 `catalog-fallback`。
5. **`protocol/index.ts` 二次筛选**，把"线上协议对象"和"包内类型"分开，防止内部类型无意变成跨节点契约。

## 6 · 缺点 / 风险

1. **`nowTimestampMs() = Date.now()`，无时钟抽象。**
   这是 `FIX-05`（跨端墙钟 LWW）的根 —— 时间源在最底层就固定成本机墙钟，
   上层任何同步逻辑都无法在不改这里的情况下引入偏移校正或逻辑时钟。
2. **`createRandomSuffix` 的 fallback 用 `Math.random`**，在没有 `crypto` 的宿主上 ID 不具备加密强度。
   当前 ID 只作关联标识不作安全凭据，影响有限；但若将来 ID 参与任何鉴权就是缺陷。
3. **`renderErrorTemplate` 缺参数渲染成空串**，会产出"订单  提交失败"这种带空洞的文案，
   且没有任何信号说明缺了参数。
4. **四个骨架空壳文件**（application/selectors/hooks/features）对 `contracts` 这种纯类型包是纯噪音。
   `hooks/index.ts` 那条"kernel 不写 React hook"的注释有价值，其余三个没有。

## 7 · 重构到 TER 的优化方向

| # | 动作 | 理由 |
|---|---|---|
| 1 | **把时间源做成端口或可注入 clock**，不要在 contracts 里写死 `Date.now()` | 这是唯一能让跨端同步换成 offset 校正 / 逻辑时钟的位置（对应 `FIX-05`） |
| 2 | branded ID + 前缀生成**原样继承** | 零成本高收益 |
| 3 | 错误四型分离**原样继承**；模板缺参数改为**保留占位符并打 warn**，不要静默成空串 | 空洞文案在门店现场无法诊断 |
| 4 | `protocol/` 二次筛选**原样继承**，并考虑加一道机械门：`protocol` 导出的类型不得引用未被 protocol 导出的类型 | 防止内部类型经由字段无意上线 |
| 5 | 骨架空壳**只保留有规则含义的那个**（如 `hooks` 的"不写 React"），其余删掉 | 35 个包 × 4 个空文件 = 上百个无信息文件 |
| 6 | ID 随机源统一走平台端口 | 顺带解决 fallback 强度问题 |

## 8 · 证据档位

全部 `已亲验`：逐文件读过 `src/` 全部 19 个文件；依赖为空由 `package.json` 确认；
被依赖数由全仓 `rg '@next/kernel-base-contracts'` 统计（穷举范围：`1-kernel` `2-ui` `3-adapter` `4-assembly` `0-mock-server` 下 `*.ts`/`*.tsx`，排除 `node_modules`/`dist`/`build`）。
