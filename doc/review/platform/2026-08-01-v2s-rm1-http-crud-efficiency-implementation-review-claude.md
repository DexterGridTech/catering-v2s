---
title: RM1 全 HTTP CRUD 效率整改实现复审（Claude）
reviewTarget: IMPLEMENTATION
scope: HTTP CRUD source-bound workload、147-operation 受管诊断、HTTP/DB evidence 与 cleanup
verdict: GO
findings: M=0 / S=1 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅覆盖 RM1 HTTP CRUD 效率整改、focused proof、受管 HTTP runtime、HTTP/DB evidence 与 cleanup；不构成浏览器 UI 业务 L2 PASS、UAT PASS、Seed PASS、DEV 长驻授权、Roadmap 状态变更或 Git 操作授权
createdAt: 2026-08-01
---

# RM1 HTTP CRUD 效率整改实现复审

## 0. 结论

**GO — `M=0 / S=1 / N=2`。**

**Dexter 的核心问题——「是否存在测试编排通过但真实业务事实不成立」——答案基本是「否」**，
而且这一轮的证据强度明显高于此前的 P6 L2：写入用的是 run-unique 的**变更值**（不是把读到的值写回去），
`expectedVersion` 走真实 owner readback 并**链式 CAS**，成功判定要求**服务端 event `outcome==='SUCCEEDED'`**
而不只是客户端 2xx。

唯一的 `S` 是这个链条上剩下的一个洞：**没有任何一处断言「写进去的字段值真的回来了」**。

## 1. 覆盖分母（147/144/3/0）—— 全部独立重算确认

我不采信 `coverage` 自报值，直接从 `operationProfiles` 与 generated registry 重算：

```
operationProfiles = 147     unique operationId = 147     unexecuted 列表 = 0 条
outcome 分布 = {PASSED: 144, EXPECTED_REJECTED: 3}        144 + 3 = 147
profile operationId 集合 vs generated route registry(147)：
    REGISTRY-ONLY = []   PROFILE-ONLY = []   EXACT_SET = True
```

`declared=147 / attempted=147 / correlated=147 / passed=144 / expectedRejected=3 /
unexecuted=0 / unresolvedUnexecuted=0` **逐项成立**。✓

分母闭合还是**结构性**的，不是巧合：`http-diagnostic-report.mjs:112` 对每个 declared key
若既无 call 又不在 unexecuted 中即抛 `HTTP_DIAGNOSTIC_UNEXECUTED_UNRESOLVED`——
**漏跑无法沉默通过**，只能显式登记。这正是我在 U13 设计审阅里提的 `S1`（`unexecuted` 无下限）
在实现层的正确落点。

## 2. 三个 `EXPECTED_REJECTED` 与契约一致 —— CONFIRMED

三条全部是 **public workspace password-reset** 链：
`sendWorkspacePasswordResetOtp` / `verifyWorkspacePasswordResetOtp` / `completeWorkspacePasswordReset`
（`http-diagnostic-scenarios.mjs:98-100`），声明为
`rejectedFact(..., 'typed owner not-found', 'WORKSPACE_IAM_RESET_NOT_FOUND')`。

**这与业务事实一致**：K04 的管理员签发链要求先有 admin 签发的 `resetGenerationKey`，
公共侧在没有可交付 generation 时**本就应当返回 typed not-found**。
关键反例也在：**发起端 `requestWorkspaceCredentialReset` 是 positive `COMMAND` fact**
（`:40`，依赖 `WORKSPACE_ACCOUNT`/`ACCOUNT_VERSION` readback）——
即签发半边被正面覆盖，只有「无 generation 的公共消费」被判为预期拒绝。
**不是拿 4xx 掩盖跑不通。**

判定也不是只看状态码：`http-diagnostic-report.mjs:31` 要求
`call.status === scenario.expectedStatus` **且** `event.status === scenario.expectedStatus`
**且** `call.typedRejection === scenario.typedRejection`，任一不符即
`HTTP_DIAGNOSTIC_REJECTION_ASSERTION_FAILED`。✓

## 3. HTTP/DB 统计是否有真实 server event 支撑 —— CONFIRMED（DB 侧逐条精确）

我用原始 `http-request-events.jsonl`（**205 条**）重算每个 operation 的 avg/min/max：

| 项 | 结果 |
| --- | --- |
| 事件 runId | 全部 1 个，且 == report runId ✓ |
| `requestId` / `correlationId` | 各 **205 个唯一**；缺 operationId/correlationId/requestId 的事件 **0** |
| 事件 operationId 覆盖 | **147** |
| `databaseOperationCount` avg/min/max | **0 处不符**（浮点精确比较，140 个 callCount 匹配的 profile 全部命中） |
| `databaseDurationMs` avg/min/max | **0 处不符**（同上） |
| profile 的 `owner` / `path` vs 事件 | **0 处不符** |

**DB 侧统计是服务端事件的忠实聚合**，不是客户端推导。✓

`httpDurationMs` 则是**客户端测量**（`profile()` 取 `call.durationMs`），
比服务端 `durationMillis` 高 **1–9ms，147 个全为正、无一为负**——符合 loopback + 客户端开销。
模块头注释已声明这一分工：*"Calls contain only operation metadata, timings and opaque correlation
handles; **the server events are the authoritative DB-count completion evidence**"*。
**口径已披露，不构成越读。** ✓

> **披露我自己的两次近失**：(1) 我第一次比较 DB 统计时对均值做了 `round()`，
> 得到「6 处 count / 8 处 duration 不符」，一度像是账目问题——**是我的取整**，
> 改为浮点精确比较后为 0 处。(2) 我看到 7 个 operation 的 `callCount=1` 而事件有 6 条，
> 一度以为漏计——实为 profile 按 declared scenario 作用域统计（见 `N1`），设计如此。
> **两次都在成文前自查纠正。**

## 4. owner readback、CAS 与顺序 —— CONFIRMED

**值来自真实 owner readback，不是编造：**

- `expectedVersion` / `revision`：均取自先前调用的 owner 响应，例如
  `getWorkspaceAccounts` 的 capture（`workload:724`）在找不到 `item.id` / `item.revision` 时抛
  `HTTP_DIAGNOSTIC_WORKSPACE_ACCOUNT_READBACK_MISSING`，找不到 ACTIVE assignment 抛
  `HTTP_DIAGNOSTIC_WORKSPACE_ASSIGNMENT_READBACK_MISSING`——**缺 readback 直接失败，不降级**。
- `roleAssignmentRef`：`workload:708` 无 `candidate.roleAssignmentRef` 即抛
  `HTTP_DIAGNOSTIC_OPERATIONS_ASSIGNMENT_READBACK_MISSING`。
- `requiredContextVersion` / `expectedSessionVersion`：取自 session entry / login 响应的
  `contextVersion` / `sessionVersion`，缺失即抛（`:627`、`:634`、`:639`、`:689`）。
- Cookie：来自真实登录/OTP 校验响应的 `response.cookies`，为空即抛（`:110`、`:328`、`:625`、`:706`）。
- `idempotencyKey`：每次调用由 `key(...)` 生成并同时进 header 与 body。

**顺序符合业务事实**：所有 `DISABLED` 与 logout 都是**终结动作**——
role disable(`:700`) → operations logout(`:704`) → account disable(`:728`) →
admin disable(`:739`) → workspace disable(`:740`) → platform logout(`:741`，最后)。
**先停用再操作**这种不可能的顺序没有出现；每个 logout 都是该 session 的最后一次使用。✓

**成功判定含服务端确认**：`isSuccessful` 要求 client 2xx/3xx **且** event 2xx/3xx
**且** `event.outcome === 'SUCCEEDED'`；任一 call 找不到对应 event 即
`HTTP_DIAGNOSTIC_COMPLETION_MISSING`。**编排自说自话无法通过。** ✓

## 5. cleanup 三项 —— CONFIRMED，且为派生值

`http-diagnostic-runner.mjs:255`：

```js
return {localProcessesStopped, remoteNamespaceRemoved,
        privateCredentialsRemoved: !existsSync(manifest.credentialPath)};
```

- `localProcessesStopped` ← `stopOwnedProcesses(...)` 的真实返回（`:208`）；
- `remoteNamespaceRemoved` ← 仅在移除路径走完后置 true（`:248`）；
- `privateCredentialsRemoved` ← **真实文件系统回读**，不是字面量；
- `:280` `status` 仅在三者皆真时为 `PASS`；`:198-200` 亦要求三者 `=== true`。

实际 run manifest：`{"status":"PASS","localProcessesStopped":true,"remoteNamespaceRemoved":true,
"privateCredentialsRemoved":true}`，`firstFailure: null`。✓

**未越级**：runtime 与 report 代码中检索 `business pass|uat|browser l2|journey` **零命中**——
没有把 HTTP 诊断说成浏览器业务 L2 或 UAT。✓

## 6. S1 ｜写入的**字段内容**从未被断言回读

**这是本轮唯一实质缺口，也是对 Dexter 那个问题最准确的回答。**

写入本身是真的（不是 P6 L2 那种「把读到的值原样写回」）：
`workload:227` 提交 `name: \`HTTP诊断空间更新${uniqueSuffix}\``、
`operationsTitle: \`HTTP诊断运营后台更新${uniqueSuffix}\``；`:699` 提交
`name: \`诊断STORE运营管理员更新${uniqueSuffix}\``——**都是 run-unique 的变更值**。

但捕获端只做**字段存在性**检查：

```js
capturePrivateResponse: (response) => requireJson(response, 'WORKSPACE_ENABLED', ['groupWorkspaceKey', 'version'])
```

全文 26 处 `requireJson(response, ...)` 均是此形状：**要求某些键存在**，
**不比对刚刚写入的值**。

**CAS 链提供了很强的间接保护**（这一点必须讲清楚，不能把 S 说重）：
下一次调用带 `expectedVersion: <上次捕获的 version>`，若 owner 根本没提交，
版本不前进，**后续 CAS 会冲突失败**。所以「整条写入没生效」这一类是能被抓住的。

**抓不住的是「部分字段被丢弃」**。具体失效场景：
若 `updatePlatformGroupWorkspaceDisplay` 的 owner 映射静默丢掉 `operationsTitle`（只写 `name`），
行版本照样 +1，响应照样含 `groupWorkspaceKey` 与 `version`，
后续 CAS 全部通过，服务端 event 仍为 `SUCCEEDED`——**整个诊断保持全绿**。
这与我在 P6-3 报的 `S3` 同族，但影响面较小：本交付单元的声明目的是
**coverage 与 DB statement 诊断**，字段级业务行为归浏览器 L2。

**最小根因修复（不新增机制）**：workload 在调用时**已经持有**它发出的那个字符串，
只需在这 26 处中**属于写命令**的那些，把 `requireJson(response, HANDLE, [...])`
扩展为附带一条值相等断言（例如 `response.json.name === 诊断更新值`、
`response.json.version > body.expectedVersion`）。无需新工件、无需新运行。

**是否需要 Dexter 产品裁决**：否。

## 7. N

**N1 ｜7 个 profile 是 n=1 统计，同 run 内另有 5 次真实执行未纳入且未披露**

`acceptPublicInvitation`、`completePublicInvitation`、`getPublicInvitationCompletion`、
`getPublicInvitationView`、`savePublicInvitationCredentials`、`sendPublicInvitationOtp`、
`verifyPublicInvitationOtp` 的 `callCount=1`，而事件文件中每个各有 **6** 条
（5 条 fixture 邀请流 + 1 条 scenario 调用）。

**设计上是自洽的**：`groupCalls` 按 declared scenario tuple 归组，
profile 只统计 scenario 作用域内的调用；把 fixture 流量混进来反而会污染 per-scenario 统计。
**但报告没有任何字段透露 profile 是 scenario-scoped**，于是这 7 条的
`min`/`max`/`average` 是**单样本**，与其他聚合多次调用的 profile 放在同一张表里不可比。

**最小修复**：profile 增加 `observedEventCount`（该 operationId 在本 run 的事件总数），
或在 report `kind` 说明中一句话写明 profile 的作用域。

**N2 ｜「focused tests 24/24」与实测不符（实际更多）**

我逐文件跑完 6 个诊断 focused test：

```
http-diagnostic-workload.test.mjs   11      rm1-http-diagnostic.test.mjs   9
http-diagnostic-runner.test.mjs      5      http-diagnostic-scenarios.test.mjs 4
http-diagnostic-inventory.test.mjs   4      http-diagnostic-report.test.mjs    3
合计 36 pass / 0 fail
```

**是低报不是虚报**，且全绿，故只判 N；但交付声明的证据数字应与实测一致，
否则后续会话按 24 去核对会找不到对应集合。

## 8. 仍存在的真实风险（Dexter 指令：是否还有未覆盖的边界）

- **本轮是覆盖与诊断，不是效率结论。** 147 个 operation 的
  `databaseOperationCount` 已可作为定位重复读取/N+1 的信号，
  但**尚未**产生任何优化实施；U13 设计里 Batch A–E 仍是候选流。本 GO 不改变这一点。
- **单次串行样本**：每个 operation 多为 1–3 次调用，`min/max` 不构成 p95/并发/执行计划结论。
  报告未做此类主张，符合 `MEASURED_PERFORMANCE_NOT_STATEMENT_COUNT` 红线。
- **`S1` 的字段级断言补上之前**，这套诊断对「owner 丢字段」类回归是盲的。

## 9. 处置

- **`S1`** 在既有批准边界内，Codex 可自主处置（26 处 capture 中的写命令加值相等断言）。
- **`N1`/`N2`** 为报告可比性与证据数字准确性。
- **不得回退**：147 exact-set 与 `HTTP_DIAGNOSTIC_UNEXECUTED_UNRESOLVED` 的 fail-closed、
  三条 typed rejection 的双端状态 + typedRejection 断言、
  DB 统计对 205 条服务端事件的精确聚合、`event.outcome==='SUCCEEDED'` 的成功判定、
  owner readback 缺失即抛的六处守卫、终结性顺序、cleanup 三项派生值与 `!existsSync` 回读。
- **本 GO 不构成**：浏览器 UI 业务 L2 PASS、UAT PASS、Seed PASS、DEV 长驻授权、
  Roadmap 状态变更或 Git 操作授权。
