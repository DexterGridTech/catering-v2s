# BP-U01 / BP-U02 定向修复复核（第二次）—— Claude

`VERDICT=GO（仅限本轮定向修复）`　`M=0`　`S=1`　`N=1`

**这个 GO 不授权 BP-U01 单元收口**，原因见 §3 的 S-01（新）。

## 0. 必须先说的两件事

### 0.1 收到的 intake 文本与上一轮逐字相同，但仓内字节已经前进

本次 handoff 的正文与我 2026-08-09 上一轮复核的那份**完全一致**，只列了 5 项修复，
**没有提到**我上一轮新提的 M-01（snapshot 输入定位）与 N-01（测试目录）。

但我对比字节后确认：相关文件在我上一轮交付（09:59）**之后**又被修改
（`backend-performance-evidence-snapshot` 10:11、`HttpRequestMetricsInterceptor` 09:50 等），
**且这两项都已修好**。所以这是一轮新的实质进展，只是 intake 文本没跟上。
我按当前字节复核，不按 intake 文本复核。

### 0.2 我在复核中意外产出了一个 evidence snapshot —— 我的过失，请处置

上一轮我对 `.runtime/r5` 跑 `--create` 时它在写任何文件前就失败了，所以我记为"只读探测"。
**这一轮同一条命令成功了，于是真的写了盘**：

```
.runtime/r5/snapshots/bd7d17705b3d1edf0c81727bf6e1d77e4378acef8fbd4b9d5f8eee261cb58ad6/
createdAt: 2026-08-09T01:18:44.128Z   ← 我的会话时间，不是受管运行
```

它是该目录下**唯一**的快照，即由我创建，不是 Codex 的产物。
性质上无害（内容寻址、幂等、只读 0400、不改动 live 证据、同输入再建会命中既有目录），
**但它的 provenance 是错的**：不是在受管运行内产出的，若被后续 gate 当作运行证据消费会误导。

**建议由 Dexter 或 Codex 删除该目录后，在一次真实受管运行内重新产出。**
我不自行删除——删除证据不在我的边界内。
**本复核的任何结论都不以这个快照作为"BP-U01 已产出交付物"的证据**；
我只把它当作对门逻辑的一次功能验证。

---

## 1. 上一轮全部 findings 已关闭

| 上一轮 | 结论 | 本会话依据 |
|---|---|---|
| **M-01（ordering）** | 关闭 | `afterCompletion` 已把 DB/dictionary 写入放进 `if (append(event))` 成功分支；`append` 返回真实落盘结果 |
| **M-01（新，snapshot 输入定位）** | **关闭** | `--create --run-dir .runtime/r5` 本会话 **EXIT=0**，产出 `DIGEST=bd7d1770…`。`INPUTS` 改为 `names[]` 闭集别名，manifest 的 `inputs[].name` 记录**实际命中的文件名**（`seed-request-events.jsonl`），与我上一轮的建议一致；`seed-report.json` 已能从 `seed/<id>/` 定位，并新增 `BP_U01_SEED_REPORT_CARDINALITY_INVALID` 红码 |
| **S-01（自助改密 context）** | 关闭 | `WORKSPACE_PROTOCOL_CONTEXT`；counts 自报=实算 `execution 68 / protocol 7`；数据层红夹具 + 落在该 operation 上的类型层负编译 |
| **S-02（无参伪 PASS）** | 关闭 | 无参输出 `BP_U01_OBSERVABILITY=UNVERIFIED`；`--self-test` 与有效 `--run-dir` 才 PASS |
| **N-01（测试目录不镜像）** | **关闭** | 文件已移至 `src/test/java/com/catering/v2s/app/edge/diagnostic/`，与 package 声明一致 |
| **N-02（无 JDK 混淆）** | 关闭 | `BP_U02_COMPILE_UNVERIFIED`，EXIT=1，与真编译失败码分离 |
| **N-03（provenance）** | 关闭 | `NON_VERIFICATION_PROVENANCE` 标记 + 校验 + 红夹具 |
| **N-02（verify 接线）** | 仍为债务，如实 | `verify.mjs` 仍是原 10 个门，新门命中 0，未被绕过 |

### 1.1 我重点查证了"run 作用域筛选"不是"把不 join 的行悄悄丢掉"

快照里的 `db-operations.jsonl` 是 **4,177 行**，而 live 是 **49,899 行**、sha 不同——
门不再逐字节拷贝输入。这一点我必须查清楚，因为"过滤掉不 join 的行"会把 fail-closed 变成静默通过。

**结论：筛选是按 `runId`，不是按是否 join，正确。**

- `sliceJsonLinesForRun(sourcePath, kind, expectedRunId)` 只保留 `runId === expectedRunId` 的行，
  `expectedRunId` 来自 **run-manifest 的 runId**（`rm1-seed-6d378a4d-…`）
- live 文件里有两个 run：旧的 `8a596243`（45,722 行，修复前的仪表，正是我上一轮测到 70% 孤儿的那批）
  与新的 `6d378a4d`（4,177 行）。按 run-manifest 取新 run，**正确排除了旧 run**
- join 检查仍在 `:234` 且仍 `fail()`；`BP_U01_SNAPSHOT_RUN_SCOPE_MISMATCH` 守住"选空但源里有 run id"的情况；
  快照侧还有 `ensureMeasuredRowsMatchRunScope` 复验
- `sourceSha256` / `sourceByteSize` 保留了**原始整文件**的摘要（db 32,032,606 B），provenance 未丢

**我在快照自身的文件上独立复算 join：DB tuple 173、event tuple 173、孤立 0。**
这是 ordering 修复有效的直接证据——新 run 里一条孤儿都没有。

### 1.2 门的自测

`backend-performance-evidence-snapshot --self-test` PASS，RED 列表已扩到 **13 条**
（新增 `RUN_SCOPE_MISMATCH`、`STATEMENT_DICTIONARY_ENTRY_MISSING`、`REQUEST_EVENTS_CARDINALITY_INVALID`、
`SNAPSHOT_INPUT_CARDINALITY_INVALID`、`SEED_REPORT_CARDINALITY_INVALID`）。
`observability --self-test` PASS；无参 `UNVERIFIED`；`--run-dir` 输出
`PASS / EVIDENCE=SNAPSHOT_UNMEASURED_BLOCKS_OPTIMIZATION`——`PASS` 指"快照有效"，
`EVIDENCE` 指"证据可用性"，两者分离且诚实。

---

## 2. 你点名的四项核验

| 核验项 | 结论 |
|---|---|
| DB / event / dictionary 不产生孤立 tuple | **通过，且有运行证据**。三者同在 `if (append(event))` 分支；快照内 173 vs 173、孤立 0（我独立复算） |
| 自助改密未被提升为 OwnerGrant 命令上下文 | **通过**。binding = `WORKSPACE_PROTOCOL_CONTEXT`，生成签名收 `WorkspaceProtocolContext`，数据层 + 类型层双锁 |
| 无参观测门不伪报 PASS | **通过**。`BP_U01_OBSERVABILITY=UNVERIFIED` |
| N-01 如实保持为非阻断债务 | **通过**。`verify.mjs` 未动，新门命中 0 |

---

## 3. Finding

### S-01（新）｜BP-U01 的 phase / section 接线不完整：3 个必需 phase 从未出现，47.3% 操作 UNCLASSIFIED

**证据（我从刚产出的快照独立聚合，4,177 条 DB 操作）**

- `missingPhases: ["OWNER_COMMAND_BEGIN", "OWNER_COMMAND_END", "READBACK_END"]`
- DB 行里实际出现的 phase 只有 4 个：`EDGE_IN`、`SESSION_RESOLVED`、`SCOPE_RESOLVED`、`AUTHORIZED`
- section 分布：**`UNCLASSIFIED` 1,977（47.3%）**、`SESSION` 701、`TRANSACTION` 630、`SCOPE` 466、
  `CONNECTION` 335、`AUTHZ` 68 —— **完全没有 `OWNER_READ` / `OWNER_WRITE`**
- UNCLASSIFIED 的 top 调用点全是 owner 服务：`WorkspaceAdministrationService#isEnabled:89` 155 条、
  `WorkspaceInvitationService#read:655` 74、`#audit:622` 72、`ExtensionDefinitionService#requireDefinition:52` 67、
  `OrganizationCommandService#requireCommercialGroupRef:259` 49、`WorkspaceRoleService#require:145` 38 …

**适用范围**：BP-U01。设计的 BP-U01 明列「补 organization 的 `OWNER_COMMAND_BEGIN/END` 与 `READBACK_END`/`EDGE_OUT`」，
这一项未完成。后果是 BP-U01 的目的——"请求级证据可以把重复/N+1 定位到 owner 内代码行"——**当前做不到**：
近一半操作没有业务段归属，owner 侧的命令边界与 readback 边界完全不可见。

**为什么是 S 不是 M**：门**如实报告**了这一点（`optimizationStatus = UNMEASURED_BLOCKS_OPTIMIZATION`，
`missingPhases` 逐项列出，比率 0.473 写进 manifest），**没有伪装成可用证据**；
它也不属于本轮 5 项定向修复的失败，而是 BP-U01 尚未完成的剩余范围。
它是**因为快照终于建得出来才第一次可见**——这本身是修复奏效的旁证。

**最小修复**：在 owner 命令入口/出口与 readback 完成分支 push 对应 phase
（设计已明确「只在真实 enrich/readback 完成分支 push `READBACK`，不得在 finally 无条件补一个 phase」），
并把 owner 侧 DB 操作归入 `OWNER_READ` / `OWNER_WRITE`。
完成判据建议直接用现成的门：同一 run 的快照 `missingPhases` 为空且 `unclassifiedRatio ≤ 0.15`。

**Dexter 决策**：不需要。

### N-01（新）｜见 §0.2

我在复核中意外产出的快照 `bd7d1770…`，请删除后在受管运行内重建。这是我的操作，不是实现缺陷。

---

## 4. 三类边界

**本轮已完成**：上一轮全部 7 项 findings（含我上一轮新提的两项）逐条关闭；
BP-U02 的 196 exact-set 与 S-01 契约在本会话复核仍成立。

**BP-U01 尚未收口**：phase / section 接线（S-01 新）。
在 `missingPhases` 非空且 `unclassifiedRatio > 0.15` 期间，
`optimizationStatus` 会持续为 `UNMEASURED_BLOCKS_OPTIMIZATION`，
按设计这会**阻断 BP-U07 的任何优化成功声明**——机制本身是对的，正在正确地挡着。

**仍属后续单元**：BP-U06 运行期切换（`runtimeIntegration = DEFERRED_TO_BP_U06` 仍被当作不变量校验）；
BP-U03～U05、U07 未触及。

**不在授权范围**：未启动 DEV / reset / seed / L2 / UAT；未改 `verify.mjs`；未实施任何 SQL 合并或业务优化。
**例外并已披露**：§0.2 的快照创建。

---

## 5. 结论

**GO（仅限本轮定向修复）**，M=0、S=1、N=1。

七项 findings 全部真实关闭，其中 snapshot 输入定位的修复我用一次真实产出验证了端到端：
门按 run-manifest 的 runId 正确切片、正确排除了修复前那批旧 run 数据、join 在快照内 173 对 173 零孤立、
`sourceSha256` 保留原始文件 provenance、RED 列表扩到 13 条并含我建议的 cardinality 守卫。
**"run 作用域筛选"不是"丢掉不 join 的行"，我专门查证过。**

**这个 GO 不授权 BP-U01 单元收口。** 快照一建出来就暴露了 S-01（新）：
3 个必需 phase 从未出现、47.3% 操作 UNCLASSIFIED、完全没有 `OWNER_READ`/`OWNER_WRITE`。
BP-U01 的目的是"把重复/N+1 定位到 owner 内代码行"，这一点现在还做不到。
门在如实挡着，不是假绿；补完 owner 侧 phase 与 section 归属后，用同一个门的
`missingPhases` 为空 + `unclassifiedRatio ≤ 0.15` 作为收口判据即可。

**授权边界**：本结论仅覆盖 BP-U01 / BP-U02 的定向修复复核。
不授权 BP-U01 单元收口、不授权进入 BP-U03～BP-U07、不授权 DEV / reset / seed / L2 / UAT、
不授权任何 SQL 合并或业务优化、不授权仓库控制动作。
