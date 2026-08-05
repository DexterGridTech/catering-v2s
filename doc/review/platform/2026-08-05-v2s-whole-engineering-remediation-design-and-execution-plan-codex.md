---
title: 全工程评审终稿的修复详细设计与执行计划（Codex）
status: DRAFT_FOR_DEXTER_AND_CLAUDE_REVIEW
createdAt: 2026-08-05
sourceReview: doc/review/platform/2026-08-05-v2s-whole-engineering-merged-review-claude.md
designKind: PROGRAM_REMEDIATION_DESIGN
implementationFacing: false
implementationAuthority: false
roadmapAuthority: false
reviewCycleId: REMEDIATION-PLAN-20260805
---

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0

# 全工程评审终稿的修复详细设计与执行计划

## 1. 目的、输入与授权边界

本计划把最终结论 `doc/review/platform/2026-08-05-v2s-whole-engineering-merged-review-claude.md` 转化为可审查的修复程序，而不是把其中 B0--B7 批次表直接变成实施指令。目标是恢复四项长期底座能力：**可追溯的调用、不会漂移的消费者契约、语义唯一的领域集合、可证明回收的受管运行**；同时消除已确认的用户可见缺陷和 owner 读模型浪费。

本文件是 `PROGRAM_REMEDIATION_DESIGN`，不是 implementation-facing 详设：

- 不授权代码、OpenAPI、schema、DEV、seed/reset、动态运行、Roadmap 或 gate 接线变更；
- 不把终稿中的建议当作已验证的实现方案；每个实施单元开始前仍须重开 owning source、关联 IA/业务材料、六维 project-memory、约束和实际可复用源码；
- 每个实施单元必须取得自身的明确 Roadmap/范围授权、implementation-facing manifest、hook receipt、独立对抗审查与 Claude 复核，不能借用本计划的评审状态；
- `P0--P3` 是优先级，不是本计划或某个单元的 GO 门槛。完成一项只代表该单元有自己的 business/cleanup evidence，不代表全工程关闭。

最终终稿已撤回的 `standards-coverage` 失效、递归保护 catch、治理工具体量、已删除的 `infra/`、错误使用 pre-gate 的 gate-0 红项与 P3 正面记录不进入修复分母。长单行 SQL 仅“接触即改善”，不成立独立 delivery unit。

## 2. 方案选择与通用设计规则

| 可选路径 | 结论 | 原因 |
| --- | --- | --- |
| 一次性按 B0--B7 全量修复 | 拒绝 | 把跨 owner、跨契约、用户交互和运行资源混在一起，无法得到有限分母、正确反例或可归因的 cleanup。 |
| 每条 finding 单点修补 | 拒绝 | 同源的 154/144/147/`projectId` 漂移会再次拆开；可观测性也会退化为局部日志。 |
| 分层架构闭环 + 原子 owner 单元 | 采用 | 先冻结分母和架构决定；可合并的同源消费者契约一次收口，其余严格按 owner、契约和用户行为拆分。 |

所有单元采用以下规则：

1. **原始证据优先。** 终稿、独立复核与本计划仅是入口；实施者必须重新读取实际源代码和当前命令输出，不能用本文件替代事实。
2. **语义先于机械替换。** 相同字面量、相似 helper 和相同状态码不自动表示同一事实或同一抽象。
3. **owner 不被便利性穿透。** UI 不合并分页后求并集；跨 schema read 不在“补 gate”中偷偷决定；前端 sink 不以无契约的上报替代设计。
4. **一项 defect 有一个有限分母。** 每单元写明扫描范围、保留反例、测试 oracle、日志证据与防复发落点。找不到分母时，先做只读 inventory，不实施。
5. **动态证明与 cleanup 分离。** 任何需要 run 的单元必须使用受管入口、读取 first failure/last known good，并单列 process/tree/远端资源回收证据；静态通过不替代它。

## 3. 修复程序与依赖顺序

```text
RP-00 当前控制分类冻结 ──┬── RP-00b 仅接入适用真门 ──┬── 各 owner 红项的独立修复
                           │                              └── 动态 red/cleanup proof
RP-02a 契约分母与消费者恢复 ── RP-02b（D4：runner validator）
RP-03 可观测性架构裁决 ── RP-04 后端 completion ── RP-05 前端 sink ── RP-06 bootstrap 输出
RP-07 品牌 queryText ──┐
RP-08 Drawer 生命周期 ─┼── 可并行（同 Journey、不同实施单元）
RP-09 MinIO 可用性 ────┤
RP-10 host trust source ┤
RP-11 cleanup tree proof┘
RP-12 节点集合归类 ── Dexter 确认各集合规范源 ── RP-12-pre / RP-12a..n 按语义集合逐个实施
RP-13..RP-20 各 owner 独立收口（可在前置条件满足时并行）
```

优先顺序是：先使现有诊断与契约消费者重新可执行（RP-02a），同时冻结控制面实际状态（RP-00）；D4 只阻塞防复发 validator（RP-02b），不阻塞恢复工作负载。随后完成可观测性架构闭环和两个独立的用户缺陷；最后按 owner 收口资产、审计、读模型、分页/唯一性和轻量治理。可观测性不是“最小日志止血”，但也不得把 backend、两 App、foundation 和 bootstrap 写成一个无法审查的 package。

## 4. 单元详细设计

### A. 控制面、契约与可观测性

| ID / 优先级 | 问题、边界与变更形状 | 前置条件与有限分母 | 验收、反例与防复发 |
| --- | --- | --- | --- |
| RP-00 / P1 | **控制面分类冻结。** 对 `scripts/check/` 的每个候选命令记录：真 gate / 报告工具 / 需参数门 / 已关闭阶段模式，及当前 phase、命令、exit code、红信号、owner。此单元只产生 inventory，不接线、不修改红项。 | 分母是当前 `scripts/check/` 的候选命令，不是 `scripts/` 的所有脚本；保存当前复现输出。跨 schema audit read、`SELECT *`、presentation-filter、Flyway denominator、ST-11、heritage hash 等红项各保留为 owner issue。 | 任一命令分类缺参数、无 red signal 或未知适用 phase 均不得进入默认 verify。防复发：分类表成为 RP-00b 的唯一输入。 |
| RP-00b / P1 | **check registry 与 aggregate 关系完整性。** 基于 RP-00 的只读分类建立唯一登记：每个 `scripts/check/*` wrapper 恰有一行，含 kind（aggregate-gate/package-gate/report/closed-phase）、默认调用或 `N/A`、适用 phase、`aggregate=verify/package-only/not-run`、source anchor 与非 aggregate 的具体理由；再设计机械关系检查。 | 依赖 RP-00 的当前 bytes、参数、时长、动态依赖和红信号，不采用历史 “38/10” 数字。此单元先设计、审查 registry；只有被接受后，才为 production checker 和 verify 接线写 implementation-facing detail design。 | 真正机械的分母是 wrapper 集合与 registry 集合，以及 aggregate-gate 到 `scripts/verify` 的引用关系；不判断豁免业务合理性。red mutation 至少覆盖未登记 wrapper、不存在登记路径、aggregate-gate 未被 verify 引用、closed-phase/package-only 缺具体依据。 |
| RP-01 / P0 | **runner request validator 设计选择。** 规定实际序列化 OpenAPI request body 的 `.mjs` 入口如何获得可执行约束：迁移至受类型检查的 TS，或从 edge OpenAPI/generated wire 复用/生成 runtime validator。 | Dexter 必须选定路径（D4）。有限分母先冻结为 `http-diagnostic-workload.mjs`、`rm1-http-diagnostic.mjs`、`r5-platform-admin-l2-fixture-seed.mjs`、`r5-joint-remote-l2-fixture.mjs`；不含糊外推为“所有 runner”。 | TS 路径须拒绝 `any`/宽类型逃逸并对已删字段 typecheck 红；runtime 路径须在发 HTTP 前拒绝 unknown/required/type drift。它只服务 RP-02b，不阻塞恢复。 |
| RP-02a / P0 | **同源消费者契约恢复。** registry 只提供 operation 强制分母；每个 operation 必须有手写 scenario fact，或有 owner/source-ref/oracle 支撑的显式 disposition。删除硬编码 `147`，移除两个 store 请求的废弃 `projectId`，使 placement、catalog、事实、断言和现有 payload 对账，目标是 workload 越过首请求。 | 不依赖 D4。source-owned 分母是 root OpenAPI、generated registry、U01 placement report、U01 catalog、facts/dispositions、测试 assertion、diagnostic/L2 fixture payload；额外重开 recovery workload 的“实际 4 call / 测试期望 7”差异，以 route/fact/owner 行为裁定而非机械改数。 | name/route/method 自动推导 scenario 是反例；缺 fact、重复 fact、sourceRef 不足、已删字段、placement/catalog 少项、测试旧分母均独立红。动态 business proof 需后续单独授权：本机受管 HTTP diagnostic 穿过 store create、owner readback 和关联 completion event；seed consumer 未获 seed 授权时只能有静态 payload proof。 |
| RP-02b / P0 | **runner request validator 落地。** 将 RP-01 选择接到 RP-02a 已校正的实际 payload，防止下一次 contract 删除字段后 runner 静默继续发送。 | 依赖 D4 与 RP-02a，且先冻结 RP-02a bytes，防止共享 runner 并行写冲突。 | 删除 contract field 后 exact object literal 必须在 typecheck 或 pre-request validator 阶段红；不能以 generated frontend TypeScript 已正确但 `.mjs` 未消费它为 PASS。 |
| RP-03 / P0 | **常驻可观测性架构决定。** 明确生产 sink、保留期、访问主体、事件成本/采样、关联 ID、前端是否增加 edge 接收面；定义 backend/frontend 共用的脱敏字段表与不可记录项。 | Dexter 决定 D1。现有诊断 JSONL、公共安全 recorder 与安全 logger 仅是可复用参考，不等于 production sink。 | 禁止密码、hash、OTP、token、cookie、Authorization、手机号、登录名、原始 IP、raw payload、stack。应有敏感 fixture 的 red mutation；没有可读取 sink 的内存环形缓冲是反例。 |
| RP-04 / P0 | **后端 completion observer。** 在 edge 的常驻 completion 通道写结构化事件：`runId?`、correlation/request ID、operation、owner、route template、consumer face、status、outcome、error code、duration 与 DB 指标；owner typed exception 在 advice 集中投影安全上下文。 | 依赖 RP-03；以全部认证业务 operation 和 public security operation 为覆盖分母，不只覆盖诊断模式。不得把 owner raw payload 推入日志。 | 正常、4xx、409 CAS 冲突、5xx 各产一条可关联且脱敏事件；重复记录或诊断-only 开关导致空日志均失败。 |
| RP-05 / P0 | **前端 sink 与 ErrorBoundary。** 让两个独立 App 把 WARN/ERROR 和 `AdminErrorBoundary.onError` 送至 RP-03 定义的受控 sink；保留 app-owned shell/theme/baseApi，foundation 只承载通用协议/脱敏 primitive。 | 依赖 RP-03/04；先盘点所有 local `createSafeLogger`、base query 与 ErrorBoundary 接线，不以单个 App 的成功代替另一个。 | DEV 全级别、生产 WARN/ERROR、React render error 均可被读取并脱敏；仅写内存 100 条或以 `console` 代替失败。 |
| RP-06 / P0 | **bootstrap 输出归位。** `ManagedInvitationBootstrap` 及同族受管 child 输出进入 manifest 管理的结构化日志，不允许自由 stdout；受管 runner 对 child identity、log path、exit 与 cleanup 留痕。 | 依赖 RP-03；先扫描 `System.out/err` 与未受控 child 启动的有限分母。 | `logging-boundaries` 真红变异、可读 bootstrap 失败日志、child 回收 proof 都必须存在。 |

### B. 用户缺陷、受管运行与封闭集合

| ID / 优先级 | 问题、边界与变更形状 | 前置条件与有限分母 | 验收、反例与防复发 |
| --- | --- | --- | --- |
| RP-07 / P0 | **品牌授权的单一 `queryText` 语义。** 在 owner/contract 定义 name-or-code 搜索，重新生成 consumer；前端不得把一个输入复制为 `name` 与 `code`，也不得双请求后合并分页结果。 | 重开品牌授权 IA、OpenAPI、owner query、generated client 与 action adapter。分母是此授权搜索端点及同契约消费者。 | name-only、code-only、两者均不匹配、分页均有 focused proof；AND 与客户端 union 都是反例。 |
| RP-08 / P1 | **Drawer 提交期关闭状态机。** 以实际 lifecycle 的 `submitting` 为唯一真相，遮罩、Esc、关闭图标和取消动作同一规则处理；优先复用 `admin-ui-foundation` drawer surface。 | 扫描全部 operations App 中 local `submitting` + `maskClosable`（及等价 close handler）后确定有限分母；与 RP-07 不同 package。 | 提交中每个关闭入口都不能逃逸；失败/完成后按设计恢复。只改 `maskClosable` 而遗漏 Esc/close button 是反例。 |
| RP-09 / P1 | **MinIO 可用性语义。** `exists()` 仅把明确 NotFound 映射 `false`，认证/网络/服务端/transport 故障均沿既有 unavailable 语义上抛。 | asset owner adapter 单独 package；不捆绑 UI Journey。 | not-found、auth、network、5xx、edge 500 的行为分别验证；吞所有 exception 为 false 是红例。 |
| RP-10 / P0 | **remote host trust source。** 将预期远端 host/fingerprint 从输入 host 的自哈希改为受控 allowlist/fingerprint 的唯一权威来源，含维护人、轮换/变更流程与受管 manifest 记录。 | Dexter 决定 D2；先定义该配置是 repo 受控还是受管外部安全配置，不能由实施者静默选定。 | 攻击者可同时提供 host 和其 hash 是红例；合法轮换、未知 host、错误 fingerprint 必须各有失败/成功证明。 |
| RP-11 / P1 | **cleanup tree proof。** 保留已存在的进程组终止，但将证明从“组长 PID 消失”升级为“本 runner 明确拥有的整棵 process tree 已清空”；`spawnSync` invitation bootstrap 改为可归属 child。 | 独立于 RP-10；以 manifest 的 OS start token、PID/PGID、child tree、远端 identity 为分母，不按端口/命令名猜测。 | 组长已死、子进程仍活的动态 red mutation 必须使 cleanup FAIL；business PASS 不得遮盖 cleanup FAIL。 |
| RP-12 / P0 | **节点类型及相关集合归类（只读）。** 采用同单位分母：当前生产 Java 的五个完整节点 token 发现面为 `NODE_TYPE_JAVA_TOKEN_OCCURRENCES=477`、逐行语义归类面为 `NODE_TYPE_JAVA_TOKEN_LINES=320`。320 行逐一记录 `file:line`、出现次数、token 集、语义集合、owner、是否 generated 与 disposition；SQL node literal 另扫、另处置，不能预填“SQL 4”或由 JDBC 调用猜测。Dexter 的历史“全量收敛 316”意图保留，但 `SERVICE_NODE_LOGIC_LINES` 只能从这 320 行分类结果导出，不能以未经复现的算术预填。`ALL_BUSINESS_ENUM_OCCURRENCES=673` 只在补齐 vocabulary/排除规则后作为独立 discovery artifact，绝不与节点行数相减或混入集合归类。 | 先做人工 inventory 与独立复核；不替换生产源码。当前已知五集合和取值见下表；复合枚举（如 `GROUP_WORKSPACE`、`STORE_CONTRACT`）是 token 扫描反例。 | 同一字符串跨集合即是反例。分类表缺 normative source、owner 或反例时不允许进入 RP-12-pre/RP-12a..n；将 occurrence、line 和无词表全枚举计数混算也失败。 |
| RP-12-pre / P0 | **enterable 的 fail-closed 安全微单元。** 在不等待整套收敛的前提下，令 `WorkspaceAuthenticationService.enterable(...)` 的未知服务节点类型显式拒绝，而非静默 default 行为；它不重定义任何集合。 | 重开该 switch、服务节点 contract/generated enum、认证原始业务条目和同根 switch 分母；独立 implementation-facing design/package。 | 未知服务节点输入必须稳定拒绝，已知五值行为保持；不得借此把组织树、审计、实体或 extension 值合并。 |
| RP-12a..n / P0 | **按集合实施收敛。** 每一集合单独决定 enum/contract/generated constant/SQL representation 的 owner 和 consumer，不建立“万能 NodeType”。 | 依赖 RP-12 和 Dexter D3 对每个集合规范源的确认；每个集合要有自己的 implementation-facing design、真实 red mutation 与迁移边界。 | 例如 OpenAPI 不能成为 audit/extension 的替代事实；全局 search-replace 是反例。服务节点的未知类型不得静默获得进入权限。 |

### C. Owner 读模型、语义硬化与低风险收口

| ID / 优先级 | 问题、边界与变更形状 | 前置条件与有限分母 | 验收、反例与防复发 |
| --- | --- | --- | --- |
| RP-13 / P1 | **总公司品牌授权 list/detail read model。** 列表不物化未显示的全部 `authorizedBrands`；详情或显式展开时才读取需要的关系。 | 先明确 list 与 detail 的 API/read-model 分界、权限语义和 pagination；不能在 controller 临时删字段。 | 列表响应不包含未消费集合，详情仍完整、授权不变；N+1/扇出和“列表为详情服务”均为反例。 |
| RP-14 / P2 | **审计 JSON writer。** audit-model 提供唯一严格 JSON writer（不是只读 parser），所有 audit write source 走同一转义、null、类型和失败语义。 | 扫描 audit JSON 写入点，确定 owner 分母；不把业务 payload 原样写日志。 | 特殊字符、null、嵌套、非法 JSON 都有 oracle；复制一个 serializer 或把 writer 放 edge 是反例。 |
| RP-15 / P2 | **不可达 OpenAPI error。** 针对 authorization version code，先证实 owner 永不产生该失败；之后在“删契约声明”与“补 owner 行为”之间选择，不得留下虚假 consumer branch。 | 重开 owner service、problem advice、OpenAPI、generated client 和调用方；若涉及安全语义则由 Dexter 决定 D6。 | declaration/owner/runtime consumer 三者 set equality；仅删 UI 分支仍保留错误契约是反例。 |
| RP-16 / P1 | **分页语义。** 14 处分页只共享上限/解析 primitive，保留各 owner 的 typed error。`WorkspaceUserService` 目前把非法 pageSize 映射为 AccountNotFound，先裁定 404 concealment 与参数错误语义。 | D5 处理账号可见性；先盘点 14 处而非全局统一请求对象。 | 上限一致、越界正确、owner-specific concealment 保持；将所有 owner error 抹平成一种是反例。 |
| RP-17 / P2 | **`findFirst()` cardinality inventory。** 仅列出无 DB 唯一约束且无 codegen cardinality proof 的调用，逐个判定需要 unique API、显式 duplicate error，或已有不变量。 | 先只读分母，不能 blanket replace。 | 有 DB unique 或 codegen proof 的调用是保留反例；无证明的 `findFirst` 不得只靠“当前数据唯一”关闭。 |
| RP-18 / P2 | **同构 helper 收敛。** 只收敛字节级/语义级同构 primitive（如 `hierarchyNameCollator`）；`statusLabel`、`problem`、app shell/theme/router 保持 app-local。 | inventory 要比较依赖、locale、错误语义和调用生命周期；优先 foundation 既有能力。 | 名称相同但语义不同的 helper 是反例；不得把业务文案抽成“通用组件”。 |
| RP-19a / P1 | **跨 schema audit read。** 在 registry 显式声明 task-read，或改走 workspace owner API；不可在 gate 接线时静默选择。 | Dexter 决定 D7；分母是 `OrganizationAuditHistoryService` 的该 read 和相关 dependency registry/owner API。 | 未声明的跨 schema join 必须形成红例；只让 gate 变绿而无 owner 边界证明失败。 |
| RP-19b / P1 | **`SELECT *`。** 对终稿列出的 owner SQL 明确字段投影，不与 task-read 或 UI red 混包。 | 分母是当前 production `SELECT *` discovery list；owner 为组织查询实现。 | 列顺序/新增列 mutation 不得静默改变 read model；每项有 query-level proof。 |
| RP-19c / P1 | **CRUD presentation filter。** 对 `frontend-architecture` 指出的 operations store/contract presentation-filter 漂移，按 UI catalog、query context、edge contract 分别定义允许的 presentation/read-model 边界。 | 先重开关联 IA、两张列表及 controller/contract；分母不能借用 RP-19a/b。 | UI/contract 分母有独立 red mutation；仅改架构检查配置失败。 |
| RP-19d / P2 | **password-reset 空目录。** 判定其是否为失效能力残留、未来占位或错误 skeleton，并由对应 owner/source authority 处理。 | 分母是该空目录及全部引用/contract/catalog/roadmap evidence。 | 仅删除目录而留下入口，或把未来能力误删，均失败。 |
| RP-19e / P1 | **Flyway test denominator。** 修复 migration test 的真实分母/发现逻辑，不与业务 migration 或 seed 混合。 | 分母是测试发现器、实际 migration tree 和阶段适用的 baseline。 | 漏 migration 与误纳入历史/非适用 migration 均须有红例。 |
| RP-19f / P2 | **ST-11 authority ledger。** 重开 authority owning source，补齐/校正 ledger 的证据引用和状态，不以刷新文本掩盖未授权事实。 | 分母是 ST-11 声明及其每条 authority/evidence 引用。 | 悬空、过期或错误 authority 都必须可失败。 |
| RP-19g / P2 | **heritage hash。** 对比 frozen authority 与当前 bytes，判定合法历史演进还是必须更新受控 authority；保留只读 heritage 边界。 | 分母是报告列出的 heritage hash assertion 及其 frozen source/current bytes。 | 盲目刷新 hash 或改写 heritage 均失败；差异必须有 authority 解释。 |
| RP-20 / P2 | **轻量记录。** 建立 Roadmap step 与 standards phase 的明确映射；相同 budget 命令别名仅保留一个入口。 | 仅在 source authority 已明确时执行；不借机改 Roadmap 状态。 | 把历史 phase 或关闭阶段当当前运行门是反例。 |

## 5. 执行批次、并行边界与完成条件

| 阶段 | 内容 | 可并行性 | 阶段完成条件 |
| --- | --- | --- | --- |
| S0 设计冻结 | RP-00、RP-01、RP-03、RP-12 的只读输入；向 Dexter 提交 D1--D7。 | 四项可并行，只读产物需统一复核。 | 每个 finding 已有 owner、有限分母、反例与决策依赖；没有任何源码/契约变更。 |
| S1 可执行性恢复 | RP-02a；RP-00b 仅在 RP-00 后；对应当前真实红项先各自详设。 | RP-02a 与红项详设可并行；RP-00b 不与分类并行；RP-02b 等 D4 和 RP-02a。 | 契约诊断能越过首请求；所有新 verify 接线有 real red evidence。 |
| S2 底座闭环 | RP-04 → RP-05 → RP-06。 | 后端完成通道可与前端实现准备并行，但联调/关闭顺序固定。 | 后端、前端、bootstrap、脱敏 mutation 和可读 sink 全部关闭。 |
| S3 用户与运行可靠性 | RP-07、RP-08、RP-09、RP-10、RP-11。 | RP-07/08/09/11 可独立；RP-10 等 D2。 | 各单元单独通过 user behavior 或 managed cleanup evidence。 |
| S4 语义与 owner 收口 | RP-12-pre、RP-12a..n、RP-13..20。 | RP-12-pre 可优先但独立；不同 owner 可并行；同一 OpenAPI/生成面串行，防止共享写入冲突。 | 每一项都有自身 implementation review、Claude verdict、business/cleanup proof；不以程序总报告替代。 |

一个实施单元的最小开工包必须包含：(a) 批准范围与用户任务；(b) 关联 IA/原始业务条目；(c) owning source、contract 和 project-memory 的逐点回读；(d) 六类 package-exit denominator；(e) 源码前 hook；(f) 独立 reviewer 的新 cycle。一个单元的最小关闭包还必须包含：变更后逐点回读、focused test/真实 red mutation、日志读取、post hook、package-exit set equality、独立 review disposition、Claude `GO/NO-GO` 和（如有动态运行）business/cleanup 双证据。

## 6. Dexter 决策清单

| 决策 | 需要确认的内容 | 阻塞单元 |
| --- | --- | --- |
| D1 | 生产观测 sink、保留期、访问主体、成本/采样与前端上报是否新增 edge face。 | RP-03--06 |
| D2 | remote host allowlist/fingerprint 的权威来源、维护人和轮换方式。 | RP-10 |
| D3 | 在既有“全量收敛 316 处”裁定下，对每个语义集合确认 normative source、owner 和生成方向（服务节点类型以 OpenAPI component 为 edge 源的可行边界亦须确认）。 | RP-12a..n |
| D4 | `.mjs` runner 采用 TS 类型检查还是 runtime generated validator。 | RP-01/02 |
| D5 | workspace user 非法 `pageSize` 是否必须维持 404 concealment，还是参数错误。 | RP-16 |
| D6 | 若 owner 不可能产生 authorization version code，删除契约分支是否符合产品/安全语义；否则定义真实 owner 行为。 | RP-15 |
| D7 | `OrganizationAuditHistoryService` 的跨 schema read 选显式 task-read 声明还是 workspace owner API。 | RP-19 |

## 7. 防复发映射与不做项

| 问题族 | 首选防复发控制 |
| --- | --- |
| 观测缺失/敏感泄露 | 常驻事件 contract + sink integration + 脱敏 red fixture。 |
| 契约下游漂移 | registry 为 operation denominator、手写 scenario/disposition 对账、payload validator/type check 与 catalog set equality。 |
| 单输入误映射为多筛选 | owner queryText contract test（name/code/no-match/page）。 |
| Drawer 关闭逃逸 | 全关闭入口 lifecycle test，foundation 共享状态面。 |
| host/cleanup 假证明 | immutable trust source test、managed process-tree red mutation。 |
| 字面量/重复 helper 误收敛 | 集合分类清单 + 仅字节/语义同构的 scoped review checklist。 |
| owner/query/cardinality 漂移 | owning-source focused test、明确 unique/typed-error proof，禁止全局替换。 |

对 Claude S3 的机制处置如下：

- **check 接线遗漏：** RP-00b 的 primary prevention 是有门三问和四种 red mutation的 *registry relationship completeness*，不是“所有 check 必进 verify”；registry 同时保留 aggregate、package-only、report 与 closed-phase 的可审计理由。
- **可观测性：** 不新建同义 `observability-contract` memory；复用既有 `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md` 与其 routed kernel，待 RP-03/04 的明确 observer 分母后才向既有 implementation checklist/standards coverage 增加机械覆盖项。
- **封闭集合：** 仅在 RP-12 分类、独立复核且每个集合有 normative source 后，建立一条 routed `closed-set-single-source` memory；在此之前不建裸字面量 gate。
- **typed failure：** RP-09/RP-15/RP-16 在各自有限 owner 分母上形成 `typed-failure-taxonomy` review checklist（不可用/不存在/参数非法及反例），不建通用语义 gate。
- **R 收口：** 用 registry 的 R-close classification readback 列出本 R aggregate 执行项、package-only evidence、report-only artifacts、closed-phase 项及原因；只执行当前 R 适用且分钟级的 aggregate 项。跨 App 重复符号 sweep 是 `rg` 产生的独立 review 输入，不是 gate。

### RP-12 已知集合起点（非替代逐行归类）

| 集合 | 当前已知取值 | 必须保留的反例 |
| --- | --- | --- |
| 服务节点 | `GROUP, REGION, PROJECT, HEAD_COMPANY, STORE` | 是任职/授权目标，不自动覆盖其它同名集合。 |
| 组织树 | `REGION, PROJECT` | 是组织树约束，不是五值服务节点子集的可替换写法。 |
| 审计 entityType | `ORGANIZATION_NODE, BRAND, TENANT, HEAD_COMPANY, STORE, BUSINESS_ENTITY, WORKSPACE_ROLE, WORKSPACE_ACCOUNT, WORKSPACE_INVITATION` 等 | 审计模型拥有自己的演进事实。 |
| 业务实体 | `BRAND, TENANT, HEAD_COMPANY` | 不含 `STORE`。 |
| 扩展宿主 | `BRAND, TENANT, HEAD_COMPANY, STORE, CONTRACT, COMMERCIAL_GROUP, REGION, PROJECT` | 取值为八个，不能被 OpenAPI 服务节点替代。 |

明确不做：不生成业务 scenario、不建立万能 NodeType、不在前端双请求合并品牌分页、不把整个 `scripts/check` 全部接入 verify、不为“统一”消除 owner typed errors、不引入 MQ/outbox/TDP/常态轮询、不把本计划当作实现授权。

## 8. 本轮评审请求与判定标准

本计划可被评为：

- **GO（仅进入逐单元 implementation-facing 详设）**：终稿每个仍有效 finding 均有明确处置；决策依赖未被隐瞒；没有把不同 owner/语义硬捆绑；撤回项未重开；防复发不是空泛“加测试”。
- **NO-GO**：发现缺失 finding、错误的合并/拆分、错误 owner、未列出的 Dexter 决策、会让契约/日志/cleanup 没有真实 red proof 的方案，或计划暗示了未获授权实施。

评审者请按 `M / S / N` 给出精确文件与行号、影响面、最小修复建议及是否需要 Dexter 裁决。GO 绝不授权实施；实施仍逐单元重新设计、审查和取证。
