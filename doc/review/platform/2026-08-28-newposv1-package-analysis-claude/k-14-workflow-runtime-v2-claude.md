# `@next/kernel-base-workflow-runtime-v2`

| 字段 | 值 |
|---|---|
| **TER 批次** | **批 D · 待裁** —— 能力是否采纳由 Dexter 裁（台账 `FIX-18`） |
| 路径 | `1-kernel/1.1-base/workflow-runtime-v2` |
| 规模 | src **3,823 行 / 43 文件**；test 2,397 行 |
| 依赖 | `contracts` · `runtime-shell-v2` · `state-runtime` · `tdp-sync-runtime-v2` · **`rxjs`** |
| 被依赖 | 2 个（`host-runtime-rn84` 注册模块、`admin-console` 使用） |
| 状态 | 活跃；**一次目标明确、验证到位的机制 POC**（`KEEP-27`） |

> ⚠️ 本包的完整评价见台账 `FIX-18`（能力是否采纳，需 Dexter 裁决）。
> 本文只补包级细节，不重复台账里的裁决讨论。

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。

## 1 · 作用与目的

**轻量动态 workflow runtime。** 定义可来自 module / host / remote TDP topic / test；
串行队列执行；进展经 Observable 与 selector 双路可读；步骤可调 kernel command、可调 connector、可跑动态 JS。

设计意图（README §12 原话）："它的核心不是'最后返回一个 result'，
而是 `run` 直接返回 `Observable<WorkflowObservation>`，持续发射等待、运行、步骤、错误、完成等状态。"

## 2 · 定义模型

```ts
WorkflowDefinition = {
    workflowKey, moduleName, name, enabled, version?, tags?,
    platform?: WorkflowPlatformMatcher,       // os/osVersion/deviceModel/runtimeVersion/capabilities
    inputSchema?/outputSchema?: {schemaType: 'json-schema-lite', required?, properties?},
    rootStep: WorkflowStepDefinition,
    timeoutMs?, defaultOptions?: {loop?, timeoutMs?, progressHistoryLimit?}
}

WorkflowStepDefinition = {
    stepKey, name,
    type: 'flow' | 'command' | 'external-call' | 'external-subscribe' | 'external-on' | 'custom',
    timeoutMs?, condition?, input?, output?, strategy?, steps?
}

WorkflowExpression = {type:'path', path} | {type:'script', language:'javascript', source}
```

`strategy.onError: 'fail' | 'retry' | 'skip' | 'compensate'` + `retry{times, intervalMs, backoff}` +
`compensationStepKey`。

## 3 · 三个 slice

| slice | persistIntent | 内容 |
|---|---|---|
| `workflowDefinitions` | **`owner-only`**，`kind:'field'` on `bySource`，`flushMode:'immediate'` | `{module, host, remote, test}` 四来源桶 |
| `workflowObservations` | `never` | 按 requestId 的运行观察 |
| `workflowQueue` | `never` | `activeRequestId` + `queuedRequestIds` |

## 4 · 引擎

- **全局串行**：一次一个 workflow，第二个进 `WAITING_IN_QUEUE`，队列上限默认 100
- **五个限额全走参数目录**（`KEEP-26`）：workflow 超时 60s · 步骤超时 15s · 事件历史 100 ·
  完成观察保留 100 · 队列上限 100
- **脚本执行优先走 `platformPorts.scriptExecutor`**（Android 是 QuickJS 独立 context，`KEEP-25`），
  无端口时退回本地 `new Function`
- **`loop` 支持** `{enabled, maxLoops, intervalMs, resetVariables}`

## 5 · 优点

见 `KEEP-25` / `KEEP-26` / `KEEP-27`。补三条包级细节：

1. **`platform` matcher 让同一 workflowKey 可以按 os/机型/runtime 版本给不同定义**，
   `definitionResolver` 负责选中并 fallback 到通用定义。终端设备异构时这是刚需。
2. **`strategy` 四种错误处置 + 补偿步骤**是完整的编排语义，不是"失败就整体失败"。
3. **`inputSchema` / `outputSchema` 用 `json-schema-lite`**（`required` + `properties{type, sensitive}`），
   其中 `sensitive` 标记可用于日志脱敏 —— 想到了，虽然当前未见消费点。

## 6 · 缺点 / 风险

| # | 问题 | 台账编号 |
|---|---|---|
| 1 | **未知/未实现的 step 类型静默成功**：`'custom'` 在 `src/` 只出现在类型声明一处，无处理分支；兜底分支 delay 后返回 `stepInput.output ?? stepInput ?? {}` | `FIX-20`（本质缺陷） |
| 2 | **脚本假超时**：本地路径 `setTimeout` 无法中断同步 `new Function` 体，死循环等不到超时 | `FIX-22`（本质缺陷） |
| 3 | **端口缺失时静默降级**到无沙箱 eval | `FIX-22` / `FIX-04` |
| 4 | **定义持久化**：整块 blob（`kind:'field'` on 整个 `bySource`）+ immediate flush + 数组按版本无界累积 + 远程 JS 落盘 | `FIX-21` |
| 5 | **远程定义链路未接线**（模块未声明 `tdpTopicInterests`）+ `item.payload as any` 零校验 | `FIX-19` |
| 6 | **rxjs 只为本包引入**，`run$` 对外暴露 Observable，与 command/selector 范式并行 | `FIX-23`（设计取舍） |
| 7 | **调用点手剥四层 `Record<string, unknown>`** | `FIX-18` §"采纳时形状要改" |
| 8 | 三个 topic 别名硬编码（`remoteDefinitionTopicKey` / `'workflow.definition'` / `'kernel.workflow.definition'`） | `FIX-19` |

补一条本文新增：

9. **`inputSchema` / `outputSchema` 声明了但没有校验点。**
   穷举 `src/` 未见任何地方用 `inputSchema` 校验入参、用 `outputSchema` 校验出参。
   ⇒ schema 是**声明而非行为**，与 `FIX-19` 的"远程定义零校验"是同一个缺口的两面。
   （`推论`：基于 `rg 'inputSchema|outputSchema'` 在 `src/` 的命中全部位于类型定义与 builtin 定义处；
   未逐行读完 `engineExecutor.ts` 434 行，建议复验。）

## 7 · 重构到 TER 的优化方向

**采纳与否是产品裁决（`FIX-18`），此处只写"若采纳则如何"。**

| # | 动作 | 理由 |
|---|---|---|
| 1 | **step 类型分发必须穷尽**（TS `never` 穷尽检查 + 运行期 default 抛 typed error）；声明了未实现的类型不得留在联合里 | `FIX-20` |
| 2 | **超时只能由沙箱侧提供**（QuickJS 中断机制），JS 侧定时器不算；端口缺失 **fail closed** 不降级 | `FIX-22` |
| 3 | **定义按 workflowKey 落 `kind:'record'`**，只留当前生效版本；`module` 来源不持久化（每次从代码重建） | `FIX-21` |
| 4 | **`inputSchema`/`outputSchema` 必须真校验**，且远程定义先校验后入库 | §6.9 + `FIX-19` |
| 5 | **进展观察对外只留 selector**，rxjs 若用只留在实现内部、不泄漏到公开签名 | `FIX-23` |
| 6 | **命令结果类型化**，消掉调用点手剥 | `FIX-18` |
| 7 | **保留三样形状**（与是否采纳引擎无关）：长过程的 observation+队列+取消+超时四件套；动态执行走端口；限额走参数目录 | `KEEP-27` |
| 8 | **`platform` matcher 的形态可独立复用**：终端异构时"同一能力按机型给不同实现"是通用需求 | §5.1 |

## 8 · 证据档位

`已亲验`：`types/definition.ts` 全文、`foundations/builtinTasks.ts` 全文、`foundations/scriptRuntime.ts`、
`foundations/engineStepExecutor.ts` 的分发与兜底、三个 slice 的 descriptor、
`features/actors/workflowRemoteDefinitionActor.ts` 全文、`supports/parameters.ts` 全文、
`application/createModule.ts` / `moduleManifest.ts` 全文、消费者穷举。
`推论`：§6.9（schema 无校验点）—— 未逐行读完 `engineExecutor.ts` 434 行与 `engine.ts` 406 行。
~~`UNVERIFIED`：远程定义 live spec 与静态链条的矛盾~~ —— **2026-08-28 已解释**：POC 全部 live 测试因 `better-sqlite3` 原生模块 Node 版本不匹配而无法运行，"spec 通过"的前提无从确认，矛盾消失。详见台账 `FIX-19`。
