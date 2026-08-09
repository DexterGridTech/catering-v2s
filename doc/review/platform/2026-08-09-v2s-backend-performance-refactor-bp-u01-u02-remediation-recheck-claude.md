# BP-U01 / BP-U02 定向修复复核 —— Claude

`VERDICT=NO-GO`　`M=1`　`S=0`　`N=2`

上一轮的 M-01、S-01、S-02、N-02、N-03 **全部真实关闭**，其中三处做得比我要求的更强。
新的阻断是一处我上一轮没有探到的集成缺口：**snapshot 仍然产不出来**，原因与上次不同。

## 0. 会话出处

续接会话，非 fresh；本仓零写入（除本文件）；变异与重生成实验只在 scratchpad 拷贝上做。
本轮所有门的可跑部分已 fresh 复跑；BP-U02 的 javac 部分本机仍无 JDK，见 §2.3。

---

## 1. 上一轮 findings 的关闭核验

### M-01（DB 行写在凭据门之前）—— **已关闭，且强于我的要求**

`HttpRequestMetricsInterceptor.afterCompletion` 现在的顺序是：

```java
if (!state.eventAuthorized()) return;
… 组装 event …
if (append(event)) {
    appendDatabaseOperations(state, snapshot, response.getStatus());
    appendStatementDictionary(snapshot.statementDictionary());
}
```

我要求的是"移到 `eventAuthorized` 之后"；实现进一步把它们**放进 `append(event)` 成功的分支**。
`append` 的返回值是真实落盘结果——`eventsPath == null` 返回 false，`IOException` 捕获后返回 false，
只有写成功才 true。

于是**孤立 tuple 在结构上不可能出现**：DB 行与 dictionary 的写入以"事件已落盘"为前置条件，
而 snapshot 门的 join 是单向的（每条 DB 行必须有事件行；有事件无 DB 行是合法的零查询请求）。方向正确。

**测试是 production-path 驱动的，不是字符串断言**（`HttpRequestMetricsInterceptorTest`，9 个 @Test）：

- `databaseEvidenceIsWrittenOnlyForCredentialAuthorizedRequestTuple`：先跑 `executeObservedStatement()`
  驱动真实 `CountingDataSource` 产生 DB 操作，未带 secret 头时断言 **events / db / dictionary 三个文件都不存在**；
  带 secret 后断言 `runId`、`correlationId`、`requestId` **三字段逐一相等**，且 dictionary 存在。
- `databaseEvidenceIsNotPublishedWhenItsManagedCompletionEventCannotBeWritten`：把事件父路径造成一个**文件**
  使 `createParent` 抛 `IOException` → `append` 返回 false → 断言 db 与 dictionary 均不存在。这是真红条件，不是 mock 桩。
- `configuredDatabaseEvidenceFailsClosedWhenHmacKeyIsMissing`：断言事件带 `DB_OPERATION_HMAC_KEY_MISSING`
  且 db 文件不存在。

**远程证据复核**：`.runtime/r5/evidence/remote-testcontainers/r5-tc-1786236668090-9251/`
的 JUnit XML 我直接读了 —— `tests="9" skipped="0" failures="0" errors="0"`，与自报一致；
`run-manifest.json` 的 `business.status=PASS`（`remoteGradleStatus: 0`）、`cleanup.status=PASS`（`reaped: true`）、
`firstFailure: null`、`sourceSha256` 存在。

### S-01（自助改密的 context kind）—— **已关闭，且有两层机器记忆**

- binding 该行 `contextKind = WORKSPACE_PROTOCOL_CONTEXT` ✓
- `contextCounts` 自报 = 我实算 = `execution 68 / protocol 7`；
  **operations-admin command 仍为 75、command 总计仍为 113、196 exact-set 仍与两 registry 并集完全相等** ✓
- **数据层红夹具**：`CONTEXT_KIND_BY_OPERATION` 表 + `:268` 的 `BP_U02_BINDING_OPERATION_CONTEXT_DRIFT`；
  self-test `:709-711` 的变异正是"把 `changeCurrentWorkspacePassword` 改回 `WORKSPACE_EXECUTION_CONTEXT`"，
  期望该错误码 ✓ —— 这正是我要求的"别省第三步"。
- **类型层负编译证明**：`:585-602` 生成 `WrongWorkspacePasswordContextMustNotCompile.java`，
  向 `bindings.changeCurrentWorkspacePassword(...)` 传 `WorkspaceExecutionContext`，
  **要求 javac 返回非零**（`if (negativeResult.status === 0) fail("BP_U02_CONTEXT_KIND_COMPILE_NEGATIVE_MISSED")`）。
  **负编译点正好落在这次裁定的那条 operation 上**，不是随便挑一条示意。
- 生成 Java 的实际签名已核对：
  `changeCurrentWorkspacePassword(OperationDescriptor, WorkspaceProtocolContext, Wire.WorkspaceCurrentPasswordChangeRequest)`
- 运行期未被波及：BP-U06 未开始，`OperationsSessionResolver:60` 仍走 `sessionForPasswordChange` 受限读，
  binding 契约现在与既有行为一致，没有把自助改密提升为持 `OwnerGrant` 的命令上下文。

**我又做了一次独立字节复现**（S-01 改动之后）：scratchpad 重生成 24 个产物，与仓内**逐字节一致**。

### S-02（无参门伪报 PASS）—— **已关闭**

本会话 fresh 复跑：无参输出 `BP_U01_OBSERVABILITY=UNVERIFIED` / `EVIDENCE=UNMEASURED_BLOCKS_OPTIMIZATION`（EXIT=0）；
`--self-test` 输出 `PASS` / `EVIDENCE=SELF_TEST_ONLY`。`PASS` 已只保留给 `--self-test` 与有效 `--run-dir`。

### N-02（无 JDK 与真编译失败混淆）—— **已关闭**

无 JDK 环境本会话实测：`BP_U02_COMPILE_UNVERIFIED`，EXIT=1，与真实 javac 非零退出的错误码分开
（`:566`/`:580`/`:601` 三处 spawn error 一律映射为 UNVERIFIED；`status !== 0` 才是真编译失败码）。

### N-03（provenance 未进 digest）—— **已关闭，且强于我的建议**

我建议"纳入 digest **或**显式标为非验证性"。实现选了后者**并补了校验与红夹具**：
`NON_VERIFICATION_PROVENANCE` 标记同时打在 `sourceRunDir`（`:155`）与 `inputs[].sourcePath`（`:141`），
`validateSnapshot:176/:181` 校验标记存在且路径为绝对路径，self-test 的 RED 列表新增
`BP_U01_SNAPSHOT_PROVENANCE_INVALID`（本会话 fresh 复跑 8 条红码全在）。

### N-01（`scripts/verify` 接线）—— **如实保持为债务，未绕过**

我复核 `tools/verify-gates/verify.mjs`：仍是原 10 个 `scripts/check/*`，
`operation-handler-bindings` / `backend-performance-observability` / `backend-performance-evidence-snapshot`
**命中数为 0**，文件未被改动。声明的"修改被机械拒绝、未绕过"属实。

---

## 2. Findings

### M-01（新）｜snapshot 门要求的输入名/位置与受管 runner 的实际产物不匹配，快照仍产不出来

**path:line**

- `scripts/check/backend-performance-evidence-snapshot:12-18`（`INPUTS` 五项，全部 `required=true`）
- 同文件 `:35-38` `locate()`：只在 `<runDir>/<name>` 与 `<runDir>/evidence/<name>` 两处找，**无别名、无递归**
- 产物侧：`scripts/dev/r5-dev-runner.mjs:192` 写 `evidence/seed-request-events.jsonl`；
  `scripts/dev/http-diagnostic-runner.mjs:138` 写 `evidence/http-request-events.jsonl`

**复现证据（本会话只读实测）**

```
$ scripts/check/backend-performance-evidence-snapshot --create --run-dir .runtime/r5
EXIT=1
BP_U01_SNAPSHOT_INPUT_MISSING:/…/.runtime/r5:request-events.jsonl
```

对 `.runtime/r5` 逐项定位：

- `db-operations.jsonl` ✓（`evidence/`）
- `statement-dictionary.json` ✓（`evidence/`）
- `run-manifest.json` ✓（runDir）
- **`request-events.jsonl` ✗**（实际叫 `seed-request-events.jsonl`）
- **`seed-report.json` ✗**（实际在 `.runtime/r5/seed/<seedRunId>/seed-report.json`，且**存在多个 seed run 目录**）

**适用范围**：BP-U01 的具名交付物。上一轮的 ordering 修复是**必要但不充分**——
孤立 tuple 这条路已经堵死，但**两个必需输入根本定位不到**，`--create` 在任何真实受管 run 上都失败。
两个 runner 无一产出 `request-events.jsonl`。

**不是假绿**：门 fail-closed，覆盖状态停在 `UNMEASURED_BLOCKS_OPTIMIZATION`。是**交付物拿不到**。

**修复建议（最小，三选一，我推荐第一个）**

1. **门侧接受闭集别名与定位规则**：`request-events.jsonl` 允许
   `{request-events.jsonl, seed-request-events.jsonl, http-request-events.jsonl}` 三选一；
   `seed-report.json` 允许 `seed/<seedRunId>/seed-report.json`，并在**多于一个 seed run 时显式失败**
   （`BP_U01_SEED_REPORT_CARDINALITY_INVALID`）而不是任选。别名集必须是**闭集并写进 manifest 的 `inputs[].name`**，
   让 snapshot 记录实际用了哪一个。
2. runner 侧改写规范名——会破坏既有消费者，代价更大。
3. BP-U01 增一个 evidence 收敛步骤把产物规范化到 snapshot 输入布局——引入新步骤，最重。

**Dexter 决策**：不需要。

**我的自陈**：上一轮我只跑了裸命令拿到 `ARGUMENT_INVALID`，没有对真实 run 目录跑 `--create`，
所以没探到这一层。这次补上了。

### N-01（新）｜测试文件目录与 package 不镜像

`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/**configuration**/HttpRequestMetricsInterceptorTest.java`
的首行是 `package com.catering.v2s.app.**edge.diagnostic**;`。

package **是对的**（镜像被测源码 `src/main/java/com/catering/v2s/app/edge/diagnostic/`），**目录放错了**。
JUnit XML 里类名是 `com.catering.v2s.app.edge.diagnostic.HttpRequestMetricsInterceptorTest`，编译与执行都正常。

违反 manifest **B.3.2**「测试包镜像源码包」。影响很小（能编能跑），但任何按目录解析归属的工具会误判，
且测试不在被测类旁边。**最小修复：移动文件到 `…/app/edge/diagnostic/`，一次移动。**

### N-02｜`scripts/verify` 接线仍为债务（沿用上一轮，如实非阻断）

`operation-handler-bindings` 是纯静态、秒级、无 run-dir 依赖的门，不在 verify 链上意味着
196 exact-set 的漂移只有人工跑才会发现。声明的"授权边界内被机械拒绝"我已复核属实，
**本轮不作为阻断**；建议在 `HANDOFF.md` 或后续单元的门 disposition 里显式登记这笔债，避免被遗忘。

---

## 3. 你点名的四项核验

| 核验项 | 结论 |
|---|---|
| DB / event / dictionary 不产生孤立 tuple | **通过**。三者同处 `if (append(event))` 分支，以"事件已落盘"为前置；测试用真实 `CountingDataSource` 驱动，未授权时三个文件都不产生 |
| 自助改密未被错误提升为 OwnerGrant 命令上下文 | **通过**。binding = `WORKSPACE_PROTOCOL_CONTEXT`，生成签名收 `WorkspaceProtocolContext`，数据层红夹具 + **落在该 operation 上的类型层负编译**双重锁定；运行期仍走既有受限读 |
| 无参观测门不伪报 PASS | **通过**。`BP_U01_OBSERVABILITY=UNVERIFIED` |
| N-01 如实保持为非阻断债务 | **通过**。`verify.mjs` 未被改动，新门命中数为 0，声明属实 |

---

## 4. 三类边界

**本轮已完成**：M-01 ordering（含事件落盘前置）、S-01 契约与双层红夹具、S-02 输出语义、
N-02 编译未验证码、N-03 provenance 标注与校验；BP-U02 产物在 S-01 改动后仍逐字节可复现。

**仍属后续单元**：BP-U06 运行期切换（`runtimeIntegration = DEFERRED_TO_BP_U06` 仍被当作不变量校验，
`CatalogOwnerService` 旧 `case` 分支仍在）；BP-U03～U05、U07 未触及，生成的 context 类仍是空 marker。

**不在本次授权范围**：未启动 DEV / reset / seed / L2 / UAT；未创建任何 evidence snapshot
（§2 的 `--create` 是**只读探测**，因输入缺失在写任何文件前即失败，未产生副作用）；
未实施任何 SQL 合并或业务优化；未改动 `verify.mjs`。

---

## 5. 结论

**NO-GO**（M=1，S=0，N=2）。

五项定向修复我逐条亲验**全部真实关闭**，其中三处强于我的要求：M-01 从"移到凭据门之后"加强为
"以事件落盘成功为前置"；S-01 除数据层红夹具外还补了落在该 operation 上的类型层负编译；
N-03 从"标注"加强为"标注 + 校验 + 新红夹具"。远程测试证据我读了 JUnit XML 原件，9/0/0 与自报一致。

阻断的是一处集成缺口：**snapshot 门的五个必需输入里有两个在真实受管 run 里定位不到**
（`request-events.jsonl` 实际叫 `seed-request-events.jsonl`；`seed-report.json` 在 `seed/<id>/` 下且可能多份）。
`--create --run-dir .runtime/r5` 本会话实测 EXIT=1。BP-U01 的具名交付物仍然拿不到——
上一轮的修复堵死了孤立 tuple，但没打通输入定位。修复是门侧加一个闭集别名与 seed-report 定位规则。

**授权边界**：本结论仅覆盖 BP-U01 / BP-U02 的定向修复复核。不授权进入 BP-U03～BP-U07、
不授权 DEV / reset / seed / L2 / UAT、不授权任何 SQL 合并或业务优化、不授权仓库控制动作。
