# 后端性能一次性彻底优化 —— 需求文档

作者：Claude（应 Dexter 要求编写，作为下一批详设的输入）
状态：需求，非设计。**不构成任何实施授权，也不构成性能成功声明。**

## 0. Dexter 的要求

不再分第二批、第三批。**下一批一次性改完当前代码的不合理结构与不合理的 DB 调用次数**，
目标是「**合理架构约束下的最小调用次数**」——不是最少，是在 owner 主权、事务正确性、
幂等/CAS/审计、授权复核这些约束下能达到的最小值。

---

## 1. 事实基线（本文档所有数字均由 Claude 从原始事件流独立复算）

**口径**：`JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH`（JDBC 执行 + 连接 + 事务批量），
**不是 SQL 条数**。两份 seed 同口径、同 173 次调用、同 41 组，可直接相减。

### 1.1 M1 第一批已取得的真实收益

| operation | 前 | 后 | 变化 |
|---|---:|---:|---:|
| createOperationsOrganizationStore | 63 | 41 | −35% |
| createOperationsContract | 57 | 38 | −33% |
| transitionOperationsOrganizationStoreStatus | 56 | 35 | −38% |
| transitionOperationsOrganizationHeadCompanyStatus | 38 | 21 | −45% |
| addOperationsOrganizationHeadCompanyBrandAuthorization | 33 | 19 | −42% |

14 条被覆盖的 M1 命令**全部下降 33–45%**，加权总量 **3795 → 3216（−15.3%）**。
`UPDATE` 前后**恒为 615**——写入一次未动，符合 `COMMAND_CORRECTNESS_COST_PRESERVED`。
门店的 `SESSION` 由 13 降到 4，是第一批的头号目标，已达成。

### 1.2 剩余 3216 次的归属与病因

| 桶 | 操作数 | 调用 | 每次 | 事务+连接 | 主要剩余成本 |
|---|---:|---:|---:|---:|---|
| 非 M1 platform 命令 | 20 | 54 | 20.8 | 6.7 | `OWNER_READ` 6.0（无重复读） |
| M1 命令（已优化） | 68 | 34 | 30.5 | 6.2 | `OWNER_READ` 9.9 + `SCOPE` 5.3 |
| 非 M1 public protocol | 9 | 63 | 10.6 | **3.0** | 已近地板 |
| 非 M1 workspace protocol | 7 | 6 | **32.8** | 6.0 | `SESSION` 10.8，含 ×8.0 重复 |
| 读取 GET | 78+5 | 16 | 12.1 | **5.7** | 记账是真实访问（2.8）的 **2 倍** |

**关键观察：public protocol 那 9 条已经做到 `TRANSACTION 2 + CONNECTION 1`，即一次请求一个事务一个连接。**
这不是理论值，是本仓已经存在的事实——**地板可达，其余四个桶都还在开约两个事务。**

### 1.3 仍在重复的调用点（每次调用平均）

```
workspace protocol : OrganizationVisibilityService#resolveSessionEntryFacts…  x8.0   ← 全系统最严重
                     WorkspaceAuthenticationService#require:355               x2.7
                     WorkspaceAuthenticationService#requireAssignment…        x1.7
M1 命令            : OrganizationCommandService#requireCommercialGroup…       x1.5
                     OrganizationTaskPathService#node:451                     x1.4
public protocol    : WorkspaceInvitationService#read:658                      x1.2
```

`resolveSessionEntryFacts` 在同一个请求里跑 **8 次**，是全仓最严重的单点浪费，
且它落在登录/切换数据节点这条**每个用户会话必经**的路径上。

---

## 2. 病因收敛：只有三种机制

把五个桶的剩余成本按机制归类，**不是几十个接口各有各的问题，而是同样三件事发生在不同地方**：

### 机制 A｜事务与连接边界未收敛（横跨四个桶）

除 public protocol 外，每个请求仍开约 **2 个事务、2 个连接**。
命令侧是「adapter 开一个 + owner 服务各自 `@Transactional` 再开一个」；
读侧更极端——`TRANSACTION 3.8 + CONNECTION 1.9 = 5.7` 的记账，
而真实数据访问只有 `OWNER_READ 2.8`，**记账是干活的两倍**。

### 机制 B｜请求内上下文事实重复解析（横跨三个桶）

同一请求内同一事实被反复装载：`resolveSessionEntryFacts` ×8、`node:451` ×1.4、
`requireCommercialGroup` ×1.5、`require:355` ×2.7。
规范 B.6.6 要求「会话上下文每请求解析一次，授权判定基于已载入的内存投影」，当前未落实到这三个桶。

### 机制 C｜校验读未折进写语句（命令侧）

M1 的 `OWNER_READ 9.9 + SCOPE 5.3`、platform 的 `OWNER_READ 6.0`，
主体是「先查父节点存在 / 编码唯一 / 目标启用，再写」。
这正是第二批原计划的 `EXISTS`/CTE 折叠，**本次一并做完**。

---

## 3. 为什么一次做完是最优方案

Dexter 已定「一次做完」，此节说明为何这个决定在工程上也是对的，供详设引用：

1. **三种机制是同一批，不是三批。** A 与 B 是框架级单点改动（事务在哪里开、事实在哪里装载一次），
   不是逐接口改造。分批做等于把同一个改动设计三遍、评审三遍。
2. **五个桶共用同一批 owner 服务。** `OrganizationVisibilityService`、`WorkspaceAuthenticationService`、
   `OrganizationTaskPathService` 同时被 M1 命令、workspace protocol 与读取命中。
   分批会反复改同几个文件，每次都要重付一遍回归风险。
3. **分批的评审开销大于收益。** 每批要付一轮设计 + 两轮独立盲审 + 一次 Claude 复核；
   三批就是三倍，而机制只有三种。
4. **地板已被证明可达。** public protocol 的 `2+1` 不是估算，是现存事实，
   所以本批不需要先做探索性验证。

**唯一必须保留的分界**：读侧不得套用命令侧的 receipt / CAS / 写事务规则。
读取没有幂等收据，硬套会造出假约束——这条来自现有读侧门（`backend-performance-read-budget`）
已固化的语义，本批必须继续遵守。

---

## 4. 范围

### 4.1 分母（全部 196 条 HTTP 操作，按 profile 治理）

| 类别 | 条数 | 本批处置 |
|---|---:|---|
| M1 命令 `WORKSPACE_EXECUTION_CONTEXT` | 68 | 机制 A 补完 + B + C |
| platform 命令 `PLATFORM_COMMAND_CONTEXT / OWNER_COMMAND` | 20 | 机制 A + B + C |
| platform 协议 `PLATFORM_COMMAND_CONTEXT / PROTOCOL` | 9 | 机制 A + B |
| workspace 协议 `WORKSPACE_PROTOCOL_CONTEXT` | 7 | **机制 B 优先**（×8 重复）+ A |
| public 协议 `PUBLIC_PROTOCOL_CONTEXT` | 9 | 仅机制 C 的轻量部分；已近地板，不得为了数字动它 |
| 任务型读取 `TASK_READ` | 78 | **机制 A 优先**（记账 2 倍于访问）+ B |
| 协议/内容读取豁免 | 5 | 不设预算，只保留完成度证据 |
| **合计** | **196** | |

### 4.2 明确不在本批范围

- 不改任何 HTTP 契约的字段集合与响应形状（沿用 2026-08-10 裁决第三条）；
- 不删减幂等、CAS、审计、锁、owner 授权/状态复核、typed 失败精度、必需的最终 owner readback
  （`COMMAND_CORRECTNESS_COST_PRESERVED`）；
- 不引入跨 schema 大查询或跨 owner 直读来降数字（`MODULE_OWNER_SOVEREIGNTY`、服务形态 §3.4）；
- 不用请求级或全局缓存替代「每请求装载一次」——缓存会绕过新鲜授权复核；
- 不改前端行为、不新增 API、不动 BP-U06 运行期切换。

---

## 5. 「合理架构约束下的最小调用次数」——地板定义

Dexter 要的是**约束下的最小值**，因此地板必须逐形态定义，并说明每一项为何不可再减。

### 5.1 命令（单 owner）

| 项 | 次数 | 为何不可再减 |
|---|---:|---|
| CONNECTION | 1 | 一次请求一个连接 |
| TRANSACTION | 2 | begin + commit，`REQUIRED` 下不可再少 |
| 上下文事实装载 | 1 | 每请求一次，授权读内存投影 |
| receipt claim | 1 | 幂等必需 |
| owner 写 | N | **业务不可减，不得为降数字删除** |
| 最终 readback | 1 或 0 | `OWNER_READBACK` 为 1，`NO_CONTENT` 为 0 |
| **地板** | **6 + N** | |

### 5.2 命令（跨 owner，最多三段）

上下文装载按需判断的 owner 数计，**每 owner 各一条，不合并成跨 schema 查询**：
地板 = `1 + 2 + (1~3) + 1 + N + 1` = **6~8 + N**。

### 5.3 任务型读取

| 项 | 次数 |
|---|---:|
| CONNECTION | 1 |
| TRANSACTION | 0~2（只读，能不开显式事务则为 0） |
| 上下文事实装载 | 1 |
| 主查询 | 1 |
| 可选计数 | 0~1 |
| **地板** | **3~6** |

### 5.4 按地板推算的目标（估算，非承诺）

| 桶 | 当前/次 | 目标/次 | 依据 |
|---|---:|---:|---|
| M1 命令 | 30.5 | **12~14** | `OWNER_READ+SCOPE` 15.2 折到约 3，记账 6.2 → 3 |
| platform 命令 | 20.8 | **10~12** | `OWNER_READ` 6→2，记账 6.7 → 3 |
| workspace 协议 | 32.8 | **10~12** | 消除 ×8 重复，`SESSION` 10.8 → 2 |
| public 协议 | 10.6 | **8~9** | 已近地板，只做轻量折叠 |
| 读取 GET | 12.1 | **5~6** | 记账 5.7 → 1~2 |

按本次 seed 的调用构成加权，全量约 **3216 → 1400~1600**，即在 M1 已得 −15.3% 之上**再降约一半**。
**这是估算，不是承诺**；实测以同口径 seed 前后对照为准。

---

## 6. 验收要求

1. **必须做成产物的前后对照。** 当前前后对比是人工完成的，仓内没有任何脚本做这件事。
   本批必须提供一个脚本或报告段落，输入两份同口径 seed 报告，输出每 operation 的
   `databaseOperationCount` 差值与按 profile 的汇总。**没有这个产物，收益永远只能靠人手算。**
2. **地板达成度按 §5 的形态逐类核验**，不是只看总数下降。
3. **`UPDATE` 总数不得下降**——写入减少即意味着删了业务动作，是失败信号而非成功信号。
4. 全部现有门保持绿；新增机制须有真实红变异。
5. 在同口径 seed 前后对照产出之前，
   `BP_U07_SQL_MERGE_SUCCESS` 与 `BP_U07_SNAPSHOT` 的状态位不得被改写为成功。
6. **浏览器 L2 未闭合**（P4 预检被旧硬编码 43/100 分母拦截，当前 P1 权威分母为 API 26/99、L2 18/41），
   本批不得把 seed PASS 表述为 L2 或 UAT PASS；L2 分母问题单独处置。

---

## 7. 这是规范，不是一次整改（Dexter 追加要求）

Dexter 明确：**本批不是针对现有这些接口和逻辑，而是要立一条能管住未来所有后台接口和逻辑的规范。**
现有 196 条是这条规范的**第一次应用**，不是交付目标本身。

因此本批的交付物有三层，缺任何一层都不算完成：

### 7.1 项目记忆（routed decision）

在 `project-memory/decisions/http-crud-efficiency-design-redlines.md` 追加 assertion，
**不新建文件**（该文件已是 routed、已被 design/implementation/review/testing 四类任务触发）。
现有 11 条 assertion 中**没有任何一条**管住事务/连接边界或请求内事实装载次数，这是真实缺口。

建议新增三条，名字与既有风格一致：

| assertion | 断言内容 |
|---|---|
| `ONE_REQUEST_ONE_TRANSACTION_ORIGIN` | 每个 HTTP 操作有且只有一个事务起点，位于其具名应用处理器；edge 不得开事务；同一请求路径上的 owner 方法不得再开第二个独立事务。只读操作若无需写一致性，不得开显式事务。 |
| `REQUEST_LOCAL_FACT_LOADED_ONCE` | 每个请求作用域的上下文/授权事实装载器在单次请求内最多执行一次；授权判定读已载入的内存投影。禁止用请求级或全局缓存替代——缓存会绕过新鲜授权复核。 |
| `OPERATION_DATABASE_SHAPE_DECLARED` | 每个后端操作必须声明其常规路径的数据库访问形态（形态类 + 各项次数），并与其 profile 的地板公式一致；新增操作缺声明即失败。 |

### 7.2 设计规范（standards-coverage）

在 `contracts/policy/standards-coverage-matrix.json` 注册对应规则条目（当前 150 条），
每条标明 `kind`：能机械判定的挂 `GATE` 并给出 `ref`，不能的挂 `UNENFORCEABLE_BY_MACHINE`
并给出 `reviewChecklistRef`。**不得把语义判断伪装成 checker。**

明确分工：

- **机器可判**：事务起点数量与位置、edge 是否带事务注解、装载器在请求内的执行次数、
  操作是否有形态声明、声明是否与 profile 地板公式自洽、新增操作是否有对应 topology/budget 行。
- **机器不可判**（进 review checklist）：某次 owner 读取在业务上是否真的必要、
  某个 `EXISTS` 折叠是否保持了原语义、某个跨 owner readback 是否属于该操作的用户任务。

### 7.3 门（fail-closed，必须管住未来）

**这一层是 Dexter 要求的核心**：规范必须对**尚不存在的接口**生效。

复用 M1 已建立的形态（我已核验其可用）：113 行 topology matrix 对未知 tuple 与已知 tuple 的新增行
均 fail-closed，78 行读预算同理。本批扩展为：

1. **静态门**：任何新增 HTTP 操作，若缺少形态声明、缺 topology/budget 行、
   或其声明与 profile 地板公式不符，**门直接红**，而不是继承某个已有计数或共享 facade。
2. **静态门**：edge 出现事务注解、同一请求路径出现第二个事务起点、
   装载器在具名单点之外被调用——均红。
3. **运行时门**：以 seed 报告的 `db-operations` 事件流做请求内不变量校验——
   同一 `requestId` 内任一装载器 `callSite` 出现次数 > 1 即红。
   **这条现在就能做**：本文档的全部重复次数（`resolveSessionEntryFacts` ×8 等）
   就是我从该事件流算出来的，机制已具备，只是没人把它做成门。
4. 每条新失败码必须带 `EXPLAINABLE_COMMAND_GATE_REJECTION` 要求的
   `WHY` / `BACKGROUND` / `PATTERN` 三字段。

### 7.4 一条必须遵守的既有约束

红线现有 `TASK_READ_BUDGET_REQUIRES_EXPLANATION` 明确：
「the default task-read budget is a design-review prompt, **not a mechanical universal ceiling**」。

因此**新规范不得做成一个全局数字上限**。
正确形状是：**按形态类给出地板公式（§5）→ 每个操作声明自己的形态 → 门校验声明与公式自洽、
以及运行时不违反结构不变量**。超出地板的操作不是自动失败，而是必须逐条写明
用户任务、基数、查询链与 owner 理由——这与既有 cap 例外的做法一致，
也避免了「为了压数字而做出跨 schema 大查询」这种更坏的结果。

## 8. 与 M1 本轮结论的关系

M1 静态实现我已独立审查并给出 `GO`（`M=0 / S=1 / N=1`），
其中 S-01 是执行矩阵为全部 68 行声明 binding 作为 edge、而实际仅 26 条经 binding，
其余 42 条 controller 直调 adapter——**建议在本批一并收口**，
使矩阵声明与真实链一致，并让门断言「声明的 edge 方法必须被至少一个 HTTP 入口引用」。

另有一项属 M1 第一批自身范围但未完成：**事务合并只做了一半**
（每请求仍约 2 个事务，而非设计要求的 1 个）。它已并入本文档的机制 A。
