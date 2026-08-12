# M1 命令拓扑与通用门 —— Claude POST_REMEDIATION_V2 定向复核

`VERDICT=NO-GO`　`M=1`　`S=0`　`N=1`

**设计本身我逐项核验，质量很高**：113 与 68 的分母、五元 profile、catalog 26 的口径、泛化分发禁令、
post-hook 阻断 receipt 的自测，全部经得起独立复算与实跑。

**NO-GO 的唯一原因是授权面与设计不匹配**：本包批准面里**没有任何一条**能容纳该修订要求新建的制品，
实施会在第一个新文件上被 hook 挡死。这不是设计缺陷，是包配置缺口，修起来很小但必须在动手前修。

**本复核不授权** runtime、DEV、reset、seed、L2、Testcontainers、部署、手工 SQL/SSH，
**也不构成任何性能数值成功声明**。

## 0. 会话出处与写入边界

续接会话，非 fresh v2s-rooted acceptance。本仓零写入（除本文件）。
分母、profile、门语义、hook 行为均本会话独立复算或实跑。

---

## 1. 你点名的七项核验

### 1.1 113 分母与 68/7/20/9/9 profile、未知 tuple fail-closed —— **通过**

我没有采信声明，从 `contracts/registry/operation-handler-bindings.json` 按
`face / contextKind / commandBoundary / transactionMode` 四元组独立重算：

| profile tuple | 我的复算 | 声明 |
|---|---:|---:|
| operations-admin / WORKSPACE_EXECUTION_CONTEXT / OWNER_COMMAND / REQUIRED | **68** | 68 |
| platform-admin / PLATFORM_COMMAND_CONTEXT / OWNER_COMMAND / REQUIRED | **20** | 20 |
| public / PUBLIC_PROTOCOL_CONTEXT / PROTOCOL / REQUIRED | **9** | 9 |
| platform-admin / PLATFORM_COMMAND_CONTEXT / PROTOCOL / REQUIRED | **9** | 9 |
| operations-admin / WORKSPACE_PROTOCOL_CONTEXT / PROTOCOL / REQUIRED | **7** | 7 |

`mode` 分布实算 `READ 83 / COMMAND 113`；**五元组之和恰为 113，零剩余、零未在声明内的 tuple、
113 条全部 `REQUIRED`**。

fail-closed 语义在修订 `:52-53` 与门表首行：profile 覆盖与 topology 覆盖**同时**要求集合相等，
未知 tuple、缺行、多行均失败。

M1 的 68 我另按 owner 复算：`workspace-iam 20 / organization 19 / catalog 17 / inventory 4 /
fulfillment-production 3 / contract 3 / asset 2`，合计 **68**，与修订 `:72-73` 逐项相符
（修订写 "store-contract 3"，注册表 owner 键是 `contract`，仅命名差异）。

### 1.2 113 行 topology matrix 与未来新增行 —— **设计要求到位**

修订 `:50-58` 要求每行给出真实 edge class/method、context-origin class/method、
transaction-owning command entry、owner/protocol public API、由所属 route registry join 出的实际
HTTP method/path，以及 source anchors；workspace-owner 行引用其 M1 execution-matrix 行。

关键那句写死了你问的点：
「**a future command with an already-known tuple still fails until it has a concrete topology row;
a profile is never a substitute for an actual endpoint-to-entry chain**」。
红变异清单里也单列了「a future command with a known profile but no topology row」。

### 1.3 68 行 execution matrix、生成器、source set、compileJava、wire DTO、单操作 adapter —— **闭环成立**

链条我逐段读了，是完整的：矩阵（68 行，声明 registry operation ID、adapter FQCN、物理源路径、
edge class/method、实际解码的请求/响应 DTO、server-only 参数、context/token 政策、resolver 变体、
typed owner API、`OWNER_READBACK` 或 `NO_CONTENT`、source anchors）
→ 生成器校验矩阵与规范注册表并逐行产出一个具体 typed binding 方法
→ 产物落在 `build/generated/sources/...` 并由 `build.gradle.kts` 注册进 main Java、
`compileJava` 依赖生成器
→ 每个方法只调其具名 adapter，且不含 collection/reflection/bean scan/string lookup/`Map`/
`ObjectNode`/`Function`/callback。

**"UNRESOLVED_REQUIRES_SOURCE" 这一条我认为是本修订最好的设计**：
授权工具只能预填 registry、route-registry 与 capability-projection 这类机械事实，
其余一律标 `UNRESOLVED_REQUIRES_SOURCE` 且被校验器拒绝——
**从机制上堵死了"用源码命名猜测冒充安全或所有权规则"**。

我核验了两条事实性断言：`app.edge.generated.wire` 下**确有 238 个文件**（42 个 edge-face 类型的说法成立）；
`contracts/registry/generated/operation-handler-bindings/java` 下 **12 个文件**，
打开确认是 `OperationBindingTypes` 这类 marker/alias 支持类型，
修订称其为"contract artifacts, not runtime proof"属实。

### 1.4 catalog 26 条取消泛化分发例外 —— **通过，且口径准确**

先澄清一个容易误判的数字：注册表里 `owner=catalog` 是 25 个操作、**17 条 COMMAND**，
而修订说的"26-command path"指的是 **`routeRegistry=catalog-inventory` 这条 controller 路径**——
我实算该路径共 42 个操作、**26 条 COMMAND，且全部是 `WORKSPACE_EXECUTION_CONTEXT`**，
owner 为 catalog 17 + inventory 4 + fulfillment-production 3 + asset 2 = 26，**全在 M1 的 68 内**。
措辞准确，不是笔误。

当前状态我也核了：`CatalogOwnerService` 有 **70 处 `case "`** 分支，controller 走 `ObjectNode` 泛化 JSON。
修订 `:23-27` 明确把这两种形态列为"migration targets"，
`:96-97` 的运行时形态要求"typed invocation, never an operation-ID string, `Map`, `ObjectNode`,
callback, service locator or generic request-facts bag"，
门表"No generic escape hatch"行与红变异"catalog generic dispatch"逐条对上。

**更强的一点在 `:130-139`**：26 条的 wire DTO 目前只存在于 OpenAPI components，
修订要求先扩展既有 `catalog-inventory-p1.mjs` 产出这 26 个后端 DTO，
并**明令 M1 生成器不得用 OpenAPI schema 名、`ObjectNode`、`Map` 或手写影子 DTO 替代**，
且输入 hash 必须绑定 P1 源、catalog OpenAPI 根/components 与生成 DTO 产物，
**否则 26 条 M1 行一条都不得准入**。这是把例外取消做成了准入前置，不是口头禁止。

### 1.5 非 M1 的 NOT_APPLICABLE 只针对 workspace-grant —— **通过**

修订 `:46-48`：「The 45 non-M1 rows are not exempt: **only the M1-specific workspace-grant assertions
are `NOT_APPLICABLE_WITH_REASON`**; each remains checked against its own protocol/platform topology」。
门表末行同义重述：「every protocol/platform row resolves to its declared edge/context/transaction/owner
topology; **only its documented M1 assertion is not applicable**」。
45 = 113 − 68 ✓。

### 1.6 post-hook 强制与失败阻断 receipt —— **通过，我实跑验证**

- `.runtime/compliance-control/active-package.json` 已带
  `mandatoryPerEditGate: {kind: "closed-static-command", command: "scripts/check/backend-performance-sql-merge-coverage"}`；
- `tools/compliance-control/cli.mjs:853` 校验该命令必须落在**闭集** `closedMandatoryPerEditGateCommands` 内
  （当前恰一条），不能随手换成更弱的门；
- `:2388` 的调用点在 `hook-post` 中、**紧邻写 post receipt 的前一行**，
  失败即 `postBlock`，receipt 不会被写；
- **自测我实跑了**：
  ```
  MANDATORY_PER_EDIT_GATE_SELF_TEST=PASS
  RED_GATE_FAILURE_BLOCKS_POST_RECEIPT=PASS
  CLEANUP=PASS
  ```
  它在临时目录里造一个 `exit 1` 的门脚本、真跑一次 `hook-post`，
  断言输出含 `MANDATORY_PER_EDIT_GATE_FAILED:...` **且 post receipt 文件不存在**。

**旧门没有被冒称为新门**：修订用的是「`scripts/check/backend-performance-sql-merge-coverage`
**becomes** a registry-derived command-topology gate」，未来时；
我实跑当前该门，输出仍是旧计数面
（`BP_U07_APPLICABILITY_CHECK=PASS / ROUTES=196 / TASK_READ=78 / SQL_M1_COMMAND=68 / …`），
无任何拓扑校验。**声明与现状一致，没有假绿。** 相关的时序建议见 N-01。

### 1.7 静态拓扑不得表述为 JDBC 或事务收益 —— **通过**

修订门表后紧跟一句：「**Static proof never establishes JDBC-event savings or Spring proxy behavior;
the later existing seed report remains the only numerical evidence.**」
授权边界段另明确：在静态实施、既有单测、受权 reset 与新 r5-full seed 对比全部完成前，
`BP_U07_SQL_MERGE_SUCCESS=BLOCKED_UNMEASURED` 与 `BP_U07_SNAPSHOT=NOT_SUPPLIED_UNMEASURED` 保持不变。

package input 的 `measurementBoundary` 也如实写明计量基准是
「JDBC executions plus CONNECTION and TRANSACTION batches; **not a SQL-row count**」，
并引用基线 `total 3795 / query 1656 / transaction 980 / update 615 / connection 544`
——与我上轮实算逐项一致。

---

## 2. Findings

### M-01｜本包批准面无法容纳该修订要求新建的任何制品，实施将在第一个新文件上被 hook 挡死

**证据**。`.runtime/compliance-control/active-package.json` 的 `allowedChangeSurfaces` 共 **64 条**，
且 `changeSurfaceScopes` **不存在**（`kind` 为空、`roots` 0 条、`exclusions` 0 条）。
我按 `tools/compliance-control/cli.mjs` 的 `allowed()` 完整语义
（精确相等，或以 `surface + "/"` 为前缀）逐条判定：**64 条全部是具体文件，没有任何目录级授权**
（唯二无扩展名的两条 `scripts/check/backend-performance-sql-merge-coverage` 与
`scripts/hooks/post-tool-compliance` 也是文件）。`app/application` 下授权条目数为 **0**。

修订明确要求新建或修改、而**当前批准面判定为 `NOT-ALLOWED`** 的路径至少包括：

| 修订要求 | 判定 |
|---|---|
| `contracts/registry/backend-performance-command-enforcement-profiles.json`（新，五元 profile 源） | NOT-ALLOWED |
| `contracts/registry/backend-performance-command-topology-matrix.json`（新，113 行） | NOT-ALLOWED |
| `contracts/registry/backend-performance-m1-command-execution-matrix.json`（新，68 行） | NOT-ALLOWED |
| `scripts/generate/backend-performance-m1-command-execution-bindings.mjs`（新生成器） | NOT-ALLOWED |
| `scripts/generate/catalog-inventory-p1.mjs`（须扩展以产出 26 个 DTO） | NOT-ALLOWED |
| `apps/backend/catering-business-server/build.gradle.kts`（须注册生成源集与 `compileJava` 依赖） | NOT-ALLOWED |
| `CatalogOwnerService.java`（泛化分发迁移目标） | NOT-ALLOWED |
| 68 个 composition adapter 源文件（新建） | NOT-ALLOWED（无目录级授权） |

**这不是设计缺陷**。64 条面本身是自洽的，覆盖的正是第一批要改的既有上下文与 owner 服务
（`OrganizationVisibilityService`、`WorkspaceAuthenticationService`、`CommandExecutionContextResolver`、
`WorkspaceCapabilityScopeResolver`、`OrganizationTaskPathService`、`BusinessEntityService` 等）
及其既有单测，与 `deliverySequence` 第 1 步「owner-local command context, one REQUIRED transaction
boundary, and command-local post-write readback only」对得上。
**问题是同一份修订同时把拓扑矩阵、执行矩阵、生成器与 68 个 adapter 作为第一批的承载机制**
（`compileJava` 依赖生成器、68 adapter 进 composition source set），
而这些都不在面内。

**后果**：`hook-post` 会以 `UNAUTHORIZED_CHANGED_PATH` 挡下第一个新文件；
或者有人临场去改 `active-package.json` 扩面——那恰是合规体系要求经治理路径、
而不是实施中途即兴处理的动作。

**最小修复**：在动手前，经既有的 successor-admission 治理路径把上表路径补进
`allowedChangeSurfaces`；若 68 个 adapter 要新建，为其目标包补一条**目录级**授权
（现有 64 条无一是目录）。不改任何分母、profile、门语义或设计结论。

**为什么不是更小的方案**：面是精确文件集且无 scope roots，没有任何"顺带覆盖"的余地；
不补面就一个新文件都建不出来。

**是否需要 Dexter 裁决**：**不需要**——这是把已授权范围如实登记到批准面，不是扩大授权范围。
但扩面动作本身应走治理路径并留痕。

### N-01｜门的改写应排在 M1 源码改动之前，否则强制门在这段时间内是空转的

**证据**：`mandatoryPerEditGate` 现已指向 `scripts/check/backend-performance-sql-merge-coverage`，
而我实跑该门，当前仍只输出旧计数面，**不做任何 profile 或 topology 校验**。
修订用「becomes」是诚实的未来时（见 §1.6），但在它被改写之前，
每次编辑触发的"强制门"对新不变量而言恒真。

**影响面**：从实施开始到门改写完成之间的所有编辑。不产生任何虚假声称。

**最小修复**：把交付顺序固定为——先补批准面（M-01），
再改写 `scripts/check/backend-performance-sql-merge-coverage` 为拓扑门并连同三份新 registry 一起落地，
**之后**才动 68 条 M1 的运行时链。这样每一次 M1 源码编辑都真的被新门覆盖。
该门脚本本身已在批准面内，可以先行。

**是否需要 Dexter 裁决**：不需要。

---

## 3. 方案合理性

**问题定位准确**。修订开篇的判断——「68 条 `OWNER_COMMAND` 在各自 owner 命令开始前
付的是同一套 workspace session、scope 与授权栈」——与我上轮从 seed 报告实测的结论一致：
operations-admin 15 个操作 SESSION 恒 13、AUTHZ 恒 2、SCOPE 8 或 9，上下文固定 23 到 24。
把第一批限定在这个共享形状上，是对的切法。

**两处取舍我特别认可**：
其一，`UNRESOLVED_REQUIRES_SOURCE` 加校验器拒绝，把"命名猜测变成安全规则"这条路堵死；
其二，26 条 catalog wire DTO 必须先由既有 P1 生成器按 OpenAPI 权威产出、
并以输入 hash 绑定后才准入，而不是允许用 `ObjectNode` 或手写影子 DTO 过渡。
这两条都是"宁可多一道准入，也不留一个看起来能跑的捷径"。

**边界克制**：`INSERT ... SELECT`、CTE、`RETURNING` 明确留给第二批，
不在本轮夹带；45 条非 M1 行不获豁免、只免 M1 专属断言。

**UI 与交互**：`NOT_APPLICABLE`。本修订只涉及命令运行时拓扑、生成器、注册表与门脚本，
不触碰任何 HTTP 契约、响应形状、页面或用户可见操作。

---

## 4. 结论

**NO-GO**（M=1，S=0，N=1）。

**设计部分我核验为高质量，且绝大多数结论是我独立复算出来的**：
113 = 68/20/9/9/7 五元组精确相符、零未知 tuple、113 条全 `REQUIRED`；
M1 的 68 按 owner 拆分逐项相符；"catalog 26"经查是 `routeRegistry=catalog-inventory` 的 26 条 COMMAND
（全在 M1 内），措辞准确；泛化分发的取消被做成了 DTO 生成与 hash 绑定的准入前置；
非 M1 的 45 条只免 M1 专属断言、拓扑仍逐条核验；
post-hook 的强制与阻断我实跑自测通过，`RED_GATE_FAILURE_BLOCKS_POST_RECEIPT=PASS`，
且调用点就在写 receipt 的前一行；旧计数门没有被冒称为新拓扑门；
静态证明不得表述为 JDBC 或事务收益这一条被明文写死。

**卡住的是包配置，不是设计。** 本包批准面是 64 条精确文件、无 `changeSurfaceScopes`、
无任何目录级授权、`app/application` 下 0 条；而该修订要求新建的三份 registry、
新生成器、P1 生成器扩展、`build.gradle.kts` 与 68 个 adapter 源文件，
按工具自身的 `allowed()` 语义**逐条判定为 `NOT-ALLOWED`**。
也就是说：即使我给 GO，实施也会在第一个新文件上被 `hook-post` 以
`UNAUTHORIZED_CHANGED_PATH` 挡死。这不是扩大授权范围，而是把 Dexter 已经授权的工作
如实登记进批准面——经既有 successor-admission 路径补齐即可，不改任何分母与门语义。

N-01 是时序建议：门脚本本身已在面内，先把它改写成拓扑门再动 M1 运行时链，
否则这段时间内的"强制门"对新不变量恒真。

**授权边界**：本 NO-GO 意味着**尚不可开始 M1 静态实施**，直到批准面补齐。
补齐后本设计我无实质异议。
不授权动态环境、DEV、reset、seed、L2、Testcontainers、部署、手工 SQL/SSH 或仓库控制，
**也不构成任何 SQL 或事务性能成功声明**——收益只能等后续同口径 r5-full seed 报告。
