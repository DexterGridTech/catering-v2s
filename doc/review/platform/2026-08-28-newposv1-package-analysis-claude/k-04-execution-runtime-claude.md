# `@next/kernel-base-execution-runtime`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 N · 不建** —— 与 F3 是两套 command 语义；middleware 链与错误归一化**吸收进 F3** |
| 路径 | `1-kernel/1.1-base/execution-runtime` |
| 规模 | src **488 行 / 19 文件**；test **475 行** |
| 依赖 | `contracts` · `definition-registry` · `platform-ports` |
| 被依赖 | **0**（声明 0，源码 import 0，穷举全仓 `*.ts`/`*.tsx`） |
| 状态 | **已建成、已测试、无消费者**——被 `runtime-shell-v2` 的另一套模型取代 |

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

README 的定位是"**低层 command 执行原语**"：handler 注册、middleware 链、command lifecycle、
execution journal、错误归一化。定位表原话还写着"可作为 runtime-shell 更高层 command bus 的底层能力"
和"普通业务包通常不直接依赖它"。

**也就是说：它被设计成一个可选的底层，不是被遗忘的代码。**

## 2 · 它的 command 模型 vs `runtime-shell-v2` 的

这两个包实现了**两种不同的 command 语义**，这是理解它为什么没有消费者的关键：

| 维度 | `execution-runtime` | `runtime-shell-v2`（实际在用） |
|---|---|---|
| handler 数 | `Map<commandName, handler>` —— **一条命令一个 handler** | `Map<commandName, handler[]>` —— **一条命令 N 个 actor，广播** |
| 结果 | `ExecutionResult = {status:'completed', result} \| {status:'failed', error}` | `CommandAggregateResult` 四态 + `actorResults[]` |
| 扩展点 | **middleware 链**（`handle(ctx, next)`，带重入保护） | **actor 注册**（同名多注册即广播） |
| handler 缺失 | **抛 `AppError`**（README 明确"是执行契约的一部分，不能改成 failed result"） | 按 `allowNoActor` 决定 `COMPLETED` 或 `FAILED` |
| 可观测 | `ExecutionJournal`（有界环形） | `RequestLedger`（427 行，可查询/可订阅） |
| 跨机 | 无 | `target: 'local' \| 'peer'` + peer gateway |
| 状态 | 与 Redux 完全解耦 | 与 Redux store 绑定 |

**广播模型赢了**，因为 POS 里一个动作常需多个 owner 同时反应（`KEEP-06`）；
而 middleware 模型更适合"一条命令一条流水线"。两者不是优劣关系，是**语义选择**。

## 3 · 关键实现

### 3.1 middleware 链带重入保护

```ts
const dispatch = async (cursor) => {
    if (cursor <= index) throw new Error('Execution middleware chain re-entry is not allowed')
    index = cursor
    const middleware = middlewares[cursor]
    if (!middleware) return handler()
    return middleware.handle(context, () => dispatch(cursor + 1))
}
```

标准洋葱模型 + 游标单调递增校验。middleware 调两次 `next()` 会立刻抛，而不是静默执行两遍。

### 3.2 错误归一化保留 cause 与 stack

`createNormalizeError`：已经是 `AppError` 就原样返回；否则包成
`executionRuntimeErrorDefinitions.commandExecutionFailed`，
并把原始 `{name, message, stack}` 放进 `details.error`、原始对象放进 `cause`，同时打一条 error 日志。

**没有丢 cause，也没有伪造原因**——对照 v2s 后台规范 1-D，这里是正例。

### 3.3 每条命令自带 scoped logger

```ts
logger.withContext({requestId, commandId, commandName, sessionId})
```

生命周期三事件（started / completed / failed）各打一条结构化日志，
`category` 统一为 `command.lifecycle`。

### 3.4 journal 有界

`createExecutionJournal(maxJournalRecords)` —— 生命周期事件进环形缓冲，不会无界增长。

## 4 · 依赖关系

- **出边**：`contracts`、`definition-registry`、`platform-ports`。
- **入边**：**零**。

⚠️ 这不等于"死代码"。按 POC 的判据，它是**一条被建成并验证过、但最终没被上层选中的执行模型**。
475 行测试说明它自己是跑通的。

## 5 · 优点

1. **middleware 链的重入保护**写得干净，是 `runtime-shell-v2` 没有的能力
   （后者靠 `executionStack` 防同 request 内同 actor 递归，粒度不同）。
2. **错误归一化保留 cause/stack/details 三层**，可直接作为 TER 的模板。
3. **journal 有界**，不会像某些 observation 结构那样无界累积。
4. **与 Redux 完全解耦**，可在任何上下文单测（475 行测试全部 node 环境）。
5. **`handler not found` 抛而不是返回 failed**——这是一条明确的契约判断：
   "没有人处理这条命令"和"处理了但失败了"是两件事，不该压成同一个返回值。
   对照 `FIX-20`（workflow 未知 step 静默成功），这里的选择恰恰是对的。

## 6 · 缺点 / 风险

1. **与 `runtime-shell-v2` 的模型重叠但不兼容**，两套并存会让"command 到底是什么语义"有两个答案。
   POC 阶段并存是合理探索；产品阶段不行。
2. **`ExecutionResult` 的 `result` 是 `Record<string, unknown>`**，与 `runtime-shell-v2` 一样没有类型化返回。
3. **`middlewares` 在构造时固定**（`[...input.middlewares]`），无法运行期增删——
   如果它真要当"底层 command bus"，模块化装配就需要这个能力。
4. **没有超时**。`runtime-shell-v2` 每条 command 有 `timeoutMs`，这里没有，
   handler 卡住就永远挂着。

## 7 · 重构到 TER 的优化方向

**结论：不作为独立包继承，但要把三件东西吸收进 TER 的 command 运行时。**

| # | 动作 | 理由 |
|---|---|---|
| 1 | **不建这个包** | TER 只应有一种 command 语义。两套并存正是"同一件事两个答案"（对照前端规范 §3-A） |
| 2 | **吸收 middleware 链 + 重入保护** | 广播 actor 模型缺一个横切扩展点（日志/耗时/审计/限流）。actor 注册解决不了"每条命令都要做的事" |
| 3 | **吸收错误归一化的三层保留**（cause / details.error / stack） | 直接可用，且符合"错误不得伪造原因" |
| 4 | **吸收"handler not found 必须显式失败"这条契约判断**，并写进 TER 编码规范 | 它是 `FIX-20` 的反例——同一个团队在这里做对了，在 workflow 那里做错了 |
| 5 | 若 TER 需要"命令流水线"能力（如统一鉴权/统一耗时统计），在**广播 dispatcher 外层**加 middleware，而不是再造第二个 dispatcher | 保持一种语义 |

## 8 · 证据档位

- 规模、依赖、零消费者：`已亲验`（穷举范围＝`1-kernel` `2-ui` `3-adapter` `4-assembly` `0-mock-server` 下 `*.ts`/`*.tsx`，排除 `node_modules`/`dist`/`build`；`package.json` 与源码 import 双向确认）。
- 实现细节：`已亲验`，`foundations/createExecutionRuntime.ts`、`types/execution.ts`、`types/runtime.ts` 全文读过。
- "广播模型赢了因为 POS 需要多 owner 反应"：`推论`，依据是 `runtime-shell-v2` 的设计意图注释与 20 个包的实际采用。
