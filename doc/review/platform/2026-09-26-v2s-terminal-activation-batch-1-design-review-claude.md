# 终端激活与长连接 · 批次一详设与实施计划评审（Claude）

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=6/16/14
L1_ENGINEERING=findings：M-1～M-6，S-1～S-4、S-6～S-16
L2_USER_VISIBLE=findings：S-5（D-18 在各工件之间的口径与控件形态不一致）；S-4（E01 控件分母缺失）
L3_UNVERIFIED=见 §6「未能核实」
SAME_ROOT_SCAN=每条 finding 下的「同族」一段
DESIGN_GAPS=见 M-4、S-8、S-16（需求侧已在 R-4.8、R-10.5 补齐压缩；S-16 已由 D-38 裁决，需求已修订）
TEMPLATE_COVERAGE=见 §5，作者自报 COMPLETE 不成立
EVIDENCE_TIER=STATIC_SOURCE：仓内源码与文档逐行核对；外部事实取上游按版本标签的源码与官方文档；零运行
```

- **被审对象**：
  - `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md`（下称「详设」）
  - `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md`（下称「计划」）
  - `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`（下称「decision」）
  - `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`
  - 门店终端 IA 与交互工件中 D-18 的修订
- **依据**：需求正本 `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md`；四份设计模板；`doc/platform/implementation-task-template.md`；后台、前端编码规范；foundation-charter。
- **评审方式**：
  - Claude 派出三个 fresh 独立子 agent 盲审，攻击面分别是：甲 · 事实、门与模板；乙 · 机制与协议；丙 · 合理性与可执行性。结论依次为 NO-GO 4/13/11、4/12/8、1/11/14。
  - 三方都在读作者材料之前先写下自己的预期，都没有读 Codex 的两份评审文件。
  - Claude 主会话合并去重后，把承重的发现逐条回源码与上游一手资料核过，核过的在各条里标 `已核`。

## 1 · 结论与方案合理性

**方向对，但照此实施会在静态 verify、编译、验收三处先后失败。**

- 方案 B 是对的：独立的 terminal-binding owner，由应用层编排，TDS 只依赖窄判定 API。
- D-18 的产品语义也对。
- 问题集中在三处：
  - R-12 门闭包与治理正本的改写没做完；
  - 激活判定顺序违背 R-1.6；
  - 压缩与验收 harness 的写法在仓内锁定的技术栈上做不到。

**问题对不对**

与需求 §1.1 批次一一行、§8 基本一致，没有把 TER、Doris、多节点混进批次一。偏离的有三处：
- 把 R-12 要求批次一做的「生成切片对账按暴露面限定」推到了批次二（M-1）；
- 给批次二加了需求没有的设备端义务（S-7）；
- 把 §8 第 1 条「在线最新值归 TDS 一侧的新模块」改成了「TDS 不是模块」，没有交需求方确认（S-1）。

**方案优不优**

- 绑定放在哪：审查方构造过「绑定留在 store-terminal，另抽只读核验构件」的替代方案。它的判定点更集中，但 R-4.7 这类共用规则会落在一个不是 owner 的构件里。所以方案 B 更好，只是要补上唯一判定点（M-5）。
- 验收 harness：同一 JVM 起三个上下文是务实的选择，但需要写明隔离约定，并且只有 TDS 自己的产物才能证明「只配数据库即可启动」（M-6）。

**代价配不配**

- 大部分体量来自需求本身：门的改写、红夹具、竞态与兜底判据。
- 真正的问题在两头：
  - 该做的没做：检索全集、预算标定、超时参数、压缩参数与成本；
  - 又加了几处僵硬的东西：把 50 冻结进红夹具、给批次二下设备端义务。

## 2 · Findings

每条标出：位置、性质、证据、影响、最小可验收修正、是否需要 Dexter 裁决。

### M-1 R-12 门闭包不完整，批次一落地后静态 verify 与业务 app 编译都会失败（已核）

- **位置**：详设 §12，第 392、396、402、405、416、419 行；需求 R-12「门的执行路径」「生成切片三方对账」。
- **性质**：仓内事实（源码亲验）加推论。
- **证据**：
  1. 需求 R-12 原文：「批次一先把对账按暴露面限定并写明理由（TER 生成目标在批次二才建立），批次二再把 TER 生成目标并入」。详设第 416 行却写「explicitly defer to batch 2 … no batch-1 gate change」。
     - `tools/verify-gates/cli.mjs` 第 629–643 行的 `generatedRouteOperations` 只按三个暴露面计数，与登记表的计数不符即报 `R5_ROUTE_REGISTRY_FACE_COUNT_DRIFT`。
     - 第 885–927 行把登记表的全部接口与四个前端切片比对，报 `R5_FRONTEND_GENERATED_FACE_DRIFT`。
     - 调用方是 `frontend`（第 924 行）与 `openapi`（第 1131 行），在 `tools/verify-gates/verify.mjs` 静态段第 19、22 行；两种模式都跑。
     - 详设全文没有 `frontend-architecture`、`openapi-contracts` 这两个入口，第 396 行只把三面计数映射到运行段的 `contract-face`。
  2. `scripts/generate/backend-performance-m1-command-execution-bindings.mjs` 的 emitter 表是写死的。凡是运营面的 OWNER_COMMAND 行找不到 emitter，就报 `OPERATION_COMMAND_BINDING_EMITTER_MISSING`。
     - 业务 app 的 `compileJava` 依赖这个生成任务（`apps/backend/catering-business-server/build.gradle.kts` 第 53–56 行）。
     - 详设新增的 `cancelOperationsStoreTerminalActivation` 属于这一类，编译前即红。
     - 需求 R-12 的必命中清单点了名（「M1 命令绑定 emitter」），详设没有。
  3. 放置目录 `doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json` 有 `closure` 计数和 `pageKeyToCapability`；边缘契约目录 `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` 第 139 行以哈希 `@607aab…` 钉住它（「every operationId must resolve exactly once」）。详设全文没有提到它。
  4. 检索全集推迟到实施期（第 392 行「Before implementation, rerun each query…」）。需求要求在详设 GO 之前列全。
- **同族**，下列必命中项也没有处置：
  - 生命周期词表（`verify.mjs` 第 60 行，静态段）；运行时环境键冻结为 18 个（`cli.mjs` 第 1385 行；`verify.mjs` 第 59 行，静态段），详设没说 TDS 是否新增跨层环境键；
  - 业务模块写路径禁用词（`cli.mjs` 第 1086–1091 行）：详设没有这一行。R-12 要求「用具名放行，不删门」，V-G1 要求把只扫业务 app 的门扩到 TDS 源码。详设第 402 行只对 TDS 保留 outbox、WebClient 两个词，`@Scheduled`、`@EventListener`、`Kafka` 等词在 terminal-binding 与 TDS 上是否禁用，没有结论；
  - 终端 edge 包的 ArchUnit 隔离（`apps/backend/catering-business-server/src/test/java/architecture/BackendModuleBoundariesTest.java` 第 75–77 行只覆盖三个 edge 包）；
  - `NO_MQ_OUTBOX_TDP` 必备断言；
  - `OWNER_NAMESPACES` 实际在 `scripts/generate/operation-handler-bindings.mjs` 第 51–66 行，由 `scripts/check/operation-handler-bindings` 检查；详设第 410 行却把它归在模块依赖登记表那一行；
  - 门店终端 RTK tag policy 的「不适用」结论没有写出；
  - 以业务 app 为扫描根的其余门（例如 database、query、r11 系列、flywayTestLocations），没有逐一标「扩到 TDS / 不适用」。
- **影响**：批次一一实施，`scripts/verify --validate-only` 就会在详设明写「不改」的门上变红，业务 app 的编译也会失败。V-G1「先取绿基线」的协议做不下去。
- **最小修正**：
  - 附上可复现的检索（命令或正则，加根目录）与命中全集（路径、行、条数）；每条命中映射到一行（入口、verify 模式、红夹具），或写「不适用」并附反例。
  - 补上以下各行：
    - `frontend-architecture` 与 `openapi-contracts`：批次一按暴露面限定并写理由，计数改为四个面；
    - M1 emitter；放置目录及其哈希钉；
    - 终端 edge 的 ArchUnit；环境键与生命周期词表的结论；写路径禁用词的具名放行。
  - 验收判据：
    - 从 `operations-edge.ts` 删掉一个运营面接口，`--validate-only` 非零，首败为 `R5_FRONTEND_GENERATED_FACE_DRIFT`；
    - 加入未知的第五个面，首败为 FACE_COUNT_DRIFT；
    - 新增一条没有 emitter 的运营面命令，生成任务失败；
    - 批次一实施后不改前端切片，两种模式都绿。
- **Dexter 裁决**：不需要，需求已写明。

### M-2 新 decision 的取代链漏了 R-12 批次一必须处置的治理正本（已核）

- **位置**：decision §6（第 75–87 行）与 front-matter（`status: PROPOSED`、`supersedes:`）；详设 §9a 第 255 行。
- **性质**：仓内事实。
- **证据**：以下现行条文都没有处置。
  - `AGENTS.md` 第 56 行：`terminal-data-server` 是「未来 TDP 的空占位」，「不得为 TDP 添加」运行时等；第 44、48 行（不引入 TDP；tunnel 只转发 Java HTTP 与资产端口）；
  - `PLATFORM-BLUEPRINT.md` 第 5、7 行与授权模型红线；`doc/platform/README.md` 第 19–20 行；`scripts/README.md` 第 3 行；`doc/platform/foundation-charter.md` 第 27 行（1-A「一个业务 deployable」）；`HANDOFF.md` 第 25 行；
  - `project-memory/kernel/02-service-shape-and-owner.md`；`project-memory/decisions/distributed-topology-is-not-current.md` 与 `project-memory/required-inventory.json` 第 203–209 行的必备断言；
  - 种子 fixture contract `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` 第 55 行 `"tdp": "FORBIDDEN"`；
  - `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`：CONTRACT 只按「真实 HTTP」定义（第 21 行），测试入口与共享支撑只能放在 `BackendAcceptanceTest.java`（第 35–37 行），与 V-S 系列的 WebSocket、多上下文、代理与栅栏支撑直接冲突；
  - front-matter 按整份取代根 ADR（`supersedes` 只列整个文件），正文 §6 却说只取代若干语句，并「保留」同一份 ADR 里的 Flyway、COMMAND DAG、无 outbox 等条款（该 ADR 第 63、128、141–144 行）。仓内先例用锚点做局部取代（`doc/decisions/2026-08-04-v2s-workspace-credential-reset-state.md` 第 8 行）。
- **影响**：
  - 实施会话先读到的红线字面上禁止 TDS 运行时；
  - V-S 系列没有定义过的 CONTRACT，CONTRACT/BUSINESS 无法分开判；
  - 整份取代根 ADR，会连带失效本设计自己依赖的 owner、DAG、TASK_READ 条款。
- **最小修正**：
  - §6 按 R-12 逐条列出：文件与行、处置类别、新措辞；front-matter 改用锚点；
  - 场景规范补上 WebSocket 上的 CONTRACT 定义：握手结果、协商出的扩展、帧结构、关闭码与原因属于闭集；
  - 计划在写 TDS 源码之前加一步完成这些改写。
  - 验收判据：对上述文件检索「一个业务 deployable｜TDP｜空占位｜仅转发」，只剩已标注的历史表述；造一个关闭原因错误的场景，报 `CONTRACT=FAIL`。
- **Dexter 裁决**：内容不需要（D-4 已拍板）。decision 由 PROPOSED 转为已接受，待修订后由 Dexter 确认。

### M-3 新增 3 个接口所需的预算标定没有进计划，计划对预算来源的描述与源码不符（已核）

- **位置**：计划 §4 第 67 行。
- **性质**：仓内事实。
- **证据**：
  - `scripts/generate/edge-codegen.mjs` 第 295–300 行：常规模式下，预算投影读取 CP-05 标定报告；
  - `scripts/generate/backend-performance-budget.mjs` 第 1255 行：报告缺接口即 `BUDGET_PROJECTION_OPERATION_MISSING`；第 1276–1283 行：预算初值必须等于实测最大值（`BUDGET_INITIAL_MAX_NOT_MEASURED_RUN_MAX`）；
  - 计划却写「New operation ceilings come from existing generated budget rules and normal successful real HTTP samples」；
  - 作废路径 `postOperationsStoreTerminalStatus` 的 FIXED 上限是 18，同事务加上解绑、审计、通知之后可预见会超出，详设只分析了详情读（上限 11）。
- **影响**：目录一改，`edge-codegen` 与 `openapi-contracts` 就红，直到出现覆盖 296 个接口的新标定报告。这需要受管运行，计划里没有这一步。
- **最小修正**：
  - 计划加标定步骤：只投影身份 → 标定运行 → 更新报告 → 重新生成，写明进入条件；
  - 给出作废路径的预期增量与处置。
- **Dexter 裁决**：需要。是否按 `AGENTS.md` 第 37 行，把单接口的预算例外委托给批次一的实施 agent（`authority=IMPLEMENTATION_AGENT`）。

### M-4 压缩的「解压有界」与关闭码，在仓内锁定的技术栈上按详设写法做不到；V-S1 证伪不了（已核）

- **位置**：详设第 34、190、374、411 行；计划第 29、84 行。
- **性质**：外部事实（上游按版本标签取的源码）加推论。
- **证据**：
  - 根 `build.gradle.kts` 用 Spring Boot 4.1.0。其依赖清单把 Reactor BOM 定为 2025.0.6（`platform/spring-boot-dependencies/build.gradle`），对应 `reactorNettyVersion=1.3.6`（reactor BOM 2025.0.6 的 `gradle.properties`）。
  - reactor-netty v1.3.6 的 `WebsocketSpec.Builder` 只有 `protocols`、`maxFramePayloadLength`、`handlePing`、`compress`，**没有** `maxDecompressionBufferSize`。详设引用的是 1.2.18 文档，那一页也没有。
  - Netty 4.2.15 的 `WebSocketFrameAggregator.isAggregated()` 对「最后一片且不是续帧」的完整单帧直接放行，`isContentLengthInvalid` 恒返回 false。所以单帧高倍压缩的消息会先被整条解压，再交给 handler。详设第 190 行说的「在 JSON 解析之前检查 65,536」已经太晚。
  - 乙还指出：分片超限时，reactor-netty 由 `onInboundError` 发出的关闭码是 1002，不是 1009（这一点 Claude 未亲验，标待证）。
  - 详设没有决定上下文接管参数，没有写每连接内存与 CPU，也没有回应 RFC 7692 §8 关于压缩与加密组合的提示（首帧带凭证）。
  - V-S1 只断言「往返内容不变」，一个协商了却从不压缩的实现也能通过。
  - `compress(true)` 还会注册旧草案 deflate-frame 的握手器。
- **影响**：
  - V-S1 第一次运行即红，或实施期临时升级依赖、自己改管线；
  - 未认证连接上多出一个内存放大的攻击面（每节点 50 个未认证名额）；
  - 批次二会按一个服务端根本不发的关闭码写客户端。
- **最小修正**（需求已据 D-37 补上 R-4.8、V-S14，请按它对齐）：
  - 解压过程中就受上界约束。写明提供这个能力的具体组件（升级依赖，或一个具名的管线组件及其 owner）；
  - 关闭码按实际技术栈写定，并写进共享契约；
  - 只实现 RFC 7692，不启用 deflate-frame；
  - 写出上下文接管参数、每连接内存上界及其依据的连接规模，并说明心跳等小消息是否压缩；
  - V-S14 验收判据：
    - 单帧高倍压缩（解压量至少为上界的 64 倍）与分片累计各一例，连接按契约关闭，handler 没有收到这条消息，内存不随解压量增长；
    - 协商后在线路上两个方向各看到至少一帧 RSV1=1。
- **Dexter 裁决**：不需要。如选择升级依赖，按「新增依赖须说明」写进详设。

### M-5 激活的判定顺序拆给了两个 owner，违背 R-1.6 的「重试不重新校验」（已核）

- **位置**：详设第 196 行（首次激活顺序：解析集团/门店范围 → `lockActivationCandidate` → `activate`）、第 223 行（R-1.3/R-1.4 的全部优先级交给「store-terminal candidate + app coordinator」）、第 225、240–242、372 行。
- **性质**：仓内事实（文本比对）加推论。
- **反例**：
  1. 设备用秘密 S 激活，服务端已提交第 5 代，但响应丢失；
  2. 运营停用了这台终端，或停用了集团空间；
  3. 设备用 S 重试。
  - R-1.6 要求原样返回第 5 代，且「不重新校验 R-1.4 第 1～8 项」。
  - 按详设的顺序，协调器或 store-terminal 先判出「已停用」，terminal-binding 来不及比较摘要，设备永远拿不到第 5 代。
  - 另外，R-1.4 第 4 项（门店停用时只有当前绑定的设备能再次激活）需要锁内读到的绑定设备，候选 API 并不提供。
- **影响**：违反 R-1.6。V-B13 没有「两次请求之间状态变了」的用例，错误实现可以全绿。
- **最小修正**：
  - 由一个具名 owner 在终端行锁内按固定顺序判定：R-1.3 查找 → 当前有效、摘要相同、设备相同，则原样成功，跳过第 1～8 项 → R-1.4 第 1～8 项（第 4 项用锁内的绑定设备）→ 摘要等于最近已结束代次，返回第 9 项 → 其余按新激活处理；
  - store-terminal 只锁行、只给事实，除「找不到」外不作拒绝判定。
  - V-B13 加两例：「首次成功并丢弃应答后停用终端」「……后停用集团空间」，同一秘密重试，得到原代次、没有审计、读回不变；之后建连得到对应的拒绝原因。
- **Dexter 裁决**：不需要。

### M-6 验收 harness：同一 JVM 三个上下文没有隔离约定；故障注入手段在两份文档里互相矛盾，V-S12 做不到（已核关键前提）

- **位置**：详设第 311、317–322、354–356、401、423 行；计划第 30、75–80 行。
- **性质**：仓内事实加外部事实加推论。
- **证据**：
  1. `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/bootstrap/CateringV2sApplication.java` 第 8 行声明 `@ComponentScan("com.catering.v2s")`，而 TDS 的包是 `com.catering.v2s.terminaldataserver`（详设第 319 行）。TDS 一旦在业务 app 的测试类路径上，就会被两个业务上下文一并扫描、装配。于是一次运行里有多条 LISTEN 连接，V-S8「探测频率」与 V-S10「终止那条监听连接」都失去唯一对象。
  2. `DatabaseOperationTracker` 的度量 sink 是 JVM 全局的 `static volatile`（foundation 模块，第 24 行）；`installMeasurementSink` 直接替换它（第 57–60 行）。第二个业务上下文装载时会换掉第一个的 sink，此后两个上下文的数据库调用记到同一个后装的 sink 上，场景的度量归属就乱了。
  3. 根 `build.gradle.kts` 第 132–165 行规定：某个工程的测试源里只要出现 Testcontainers 标记，该工程的测试任务就只能远端运行。详设第 423 行把 `:apps:backend:terminal-data-server:test` 放进本机静态段，第 319 行又把验收要替换的 `LatchSessionRegistrationGate` 放在 TDS 的测试源里：这些测试替身一旦引用 Testcontainers，TDS 的测试任务就不能在本机跑。而业务 app 的验收要用到这些替身，计划第 30 行写的「测试运行期依赖」只带来 TDS 的主代码，看不到 TDS 的测试类。
  4. 详设第 319 行用生产接缝 `SessionRegistrationGate`，计划第 75 行却写「测试侧 PG 触发器/advisory 栅栏，无生产钩子」。后者让认证事务持有绑定行锁，取消激活就只能等栅栏放行后提交，V-S10 要构造的交错永远出不来。
  5. V-S12：详设第 385 行只写「stop PostgreSQL for 30s」，没写怎么停。计划第 78 行写「在容器里执行 `pg_ctl stop/start`；只停、重启自己持有的容器」：官方镜像的 postgres 是 1 号进程，`pg_ctl stop` 会让容器随之退出；改为停、启容器，Docker 随机映射的端口可能改变，而三个上下文的 JDBC URL 在启动时已经固定（这两点是外部事实推论，未亲验）。
  6. TDS 的数据库与连接池没有设超时。HikariCP 的 `connectionTimeout` 默认 30 秒，长于 15 秒的认证总时限，所以停库期间的首帧会以 `AUTHENTICATION_TIMEOUT` 关闭，而不是 R-7.3、V-S12 要求的 `SERVER_ERROR`。
  7. 「TDS 只配数据库即可启动」在业务后端的类路径与配置上得不到证明（R-READ-10）。
- **影响**：V-S 系列第一次运行即败，接着触发「同一失败族第二次即停」；或者被改成别的含义后「通过」。
- **最小修正**：
  - 写明隔离约定：业务上下文不注册 TDS 的 bean；测试度量只在第一个上下文注册（断言 sink 是同一个）；TDS 上下文只加载 TDS 自己的配置；服务端与测试客户端的 Reactor Netty 资源互相独立；
  - 测试接缝放在代码布局允许、业务测试任务够得到的源码集；
  - 两份文档只保留一套故障注入手段，逐项写明是走验收环境侧，还是走生产接缝（后者按 R-READ-10 声明覆盖边界）；
  - 停库时 JDBC 端点保持不变；TDS 的各项超时写定，并映射为 `SERVER_ERROR`；
  - 「只配数据库即可启动」由 TDS 自己的产物证明，否则在验收中标为未验证，改由 DEV 的 TDS 启动承担；
  - 详设第 356 行已要求 harness 第一步证明三个上下文能起停。这一步再加上一次停库与恢复，并在写场景之前把结果写回详设。
- **Dexter 裁决**：不需要。

### S-1 模块登记表与依赖图不完整（已核）

- **证据**：
  - `contracts/policy/module-dependency-registry.json` 的 13 个模块里没有 store-terminal、audit-read；边的两端必须已登记（`tools/module-dependency-registry/check.mjs` 第 169–170 行）。详设第 410 行计划登记的边会直接报「未知模块」。
  - 作废时由 store-terminal 调 terminal-binding，这是一条 COMMAND 边，依赖图与登记清单都没有。
  - `activate(candidate, …)` 的参数类型归谁没写；如果用 store-terminal 的类型，会形成 Gradle 环，并把 catalog、asset、对象存储带进 TDS。
  - terminal-binding 自身的构建依赖没写（沿用 `OperationsOwnerScopeGrant` 会带进 organization 等）。
  - 「在线最新值」的 owner 与需求 §8 第 1 条不一致。
- **修正**：
  - 给出完整的登记增量（先补登 store-terminal、audit-read 及其现有边）；
  - 画全 COMMAND 边；terminal-binding 不依赖 store-terminal；
  - TDS 的运行时依赖树不含 store-terminal、catalog、asset、minio、organization；
  - 为 `terminal_connection` 指定 owner；
  - 红夹具：制造一个 COMMAND 环，登记表检查非零退出。
- **Dexter 裁决**：只在坚持「TDS 不是模块」、偏离 §8 第 1 条时需要。

### S-2 若干红夹具的入口写错，或者会空转（已核一部分）

- ArchUnit `NO_MODULE_REFERENCES_TERMINAL_DATA_RUNTIME` 的包模式是 `..terminal.data..`（`apps/backend/catering-business-server/src/test/java/architecture/BackendModuleBoundariesTest.java` 第 55 行），匹配不到 `com.catering.v2s.terminaldataserver`，「业务模块 import TDS」的红夹具会是绿的。**已核。**
- pageKey/testId 这一行（详设第 408 行）的入口写成 `contract-face`。但 contract-face（`tools/platform-boundary-gates/cli.mjs` 的 post-gate-0 检查）不读接口的 pageKey；读它的是 `scripts/generate/r5-edge-materialize.mjs` 与 `tools/capability-invariants/cli.mjs`。
- `security-boundaries` 被称为「现有静态门」，实际不在 verify 里；它还是按整个控制器文件匹配解析器，不是按方法。
- TDS 成为测试依赖后，会进入业务 ArchUnit 的扫描范围。
- **修正**：每个红夹具在所写模式下的首败标记逐条列出，并在 scratch 上验证；需要改的门列入改门清单。

### S-3 计划的顺序违反 6b、6c；「当前红门」只观测到静态首败，还给 frontend-format 留了「外部阻断」的出口

- **证据**：
  - 计划第 111 行在 harness 就绪（CP-05）之前就跑全量 backend-acceptance，第 112 行才做 CP-05/06；V-B7、V-B13 与全部 V-S 都依赖这个 harness。
  - 缺 6c「第一次动态运行用 `--operation` 精确到单场景」。
  - `verify.mjs` 遇首败即停，frontend-format 在静态段排第 6；其后的静态门与整个运行段都没有观测到，拟接入的五道门也从没跑过。
  - 那几个格式问题文件就在 D-18 的改动范围与 L2 控制面内。
- **修正**：
  - 给出 CP 与步骤的对照，每次动态运行写明前置步骤；
  - 全量验收只在 6b 整体对账 MATCHED 之后运行；
  - 删去「外部阻断」这个出口，把修 frontend-format 列为第一步；
  - 当前红门写成可复核的记录（命令、时间、首败、未观测到的段）。

### S-4 L2 重新准入的接线读的是旧详设，E01 的控件分母没有列

- **证据**：
  - `contracts/policy/store-terminal-l2-admission.json` 的 `designPath` 仍指向 09-24 的门店终端详设，那份详设第 93–95 行是三个 PASS 标记；新详设 §3a 的 OPEN/BLOCKED 状态运行器读不到。
  - 控制面里没有新详设与本需求正本；`store-terminal-l2-execution.json` 不在清单里。
  - E01 是唯一有变化的用例，却只写了一句「Existing edit/action keys remain」。`contracts/policy/store-terminal-l2-scenarios.json` 里 TER-E01 的 29 个 controlKeys 和 17 个 actionControlKeys 都没有列；也缺「实际动作节点、binding、fresh 复核、结论」四列。
- **修正**：
  - `designPath` 改指批次一详设，或让旧标记回到待复核；控制面加入新详设与需求正本；
  - E01 逐控件一行，列齐九列；
  - 新 §3a 未 PASS 时，运行器拒绝启动。

### S-5 D-18 在各工件之间口径不一致，控件形态写错，编辑态提示文案失实

- **证据**：
  - 以下几处都写由 owner 拒绝，多数还写「以可区分原因」：IA `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md` 第 20、81 行；交互工件 `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md` 第 342、369 行；09-24 门店终端详设与计划各第 7 行。
  - 本详设第 224、270 行却是把 `deviceType` 移出修改契约，由 edge 的 `strictBody` 把遗留字段当未知属性拒绝（`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreTerminalController.java` 第 437–447 行）。
  - 需求 R-8.4（第 275 行）的「以可区分的原因拒绝」只在修改契约仍带这个字段时适用。所以本详设的写法与需求一致，落后的是其余工件的措辞。
  - Journey（`doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md` 第 70 行）写「Select」，现有控件实际是 `Radio.Group`（`apps/frontend/operations-admin/src/features/store-terminal/ui/StoreTerminalFormDrawer.tsx` 第 456–474 行）。
  - `apps/frontend/operations-admin/src/features/store-terminal/ui/TerminalFunctionEditor.tsx` 第 534 行的提示「请移除或更换设备类型后再保存」，在 D-18 之后后半句不再成立。
  - 只读展示的写法没有引用仓内先例（第 528–532 行：`Form.Item label` 加 `Typography.Text strong` 加 testId）。
- **修正**：
  - 各工件统一成同一句（修改契约不含 deviceType，带遗留字段的请求以校验失败拒绝，配置与版本不变）；
  - 控件形态按实际写；删掉「或更换设备类型」，不新增任何说明。

### S-6 模板缺项；§14 自报 COMPLETE 不成立

- §4 缺每个 CP 的不变量、FORBID、RECALL；
- §5 缺集合形态与预期规模两列，WebSocket 地址 `/tdp/{groupWorkspaceKey}/ws` 在详设与 decision 里一次都没出现；
- §7 缺机制行；
- §9a 不是按事实分行的表，漏了放置目录、`audit-history.paths.json` 的 entityType 枚举、`execution.json` 与两处 schema 重置清单；
- §10b.6 写成了人员分工，模板要的是 seed 前提、父流程位置与角色；
- §11 缺场景 id、identity、fixture、request 四列；
- §12 的「未决项处置」表被门清单占用了。
- **修正**：逐节补齐；§14 改成逐节「有 / 缺 / N/A 加理由」。

### S-7 批次边界：批次二的义务与需求不一致；批次二的检查被算进批次一

- **证据**：
  - 详设第 34、190、416 行要求批次二在 Expo Web 与 Android 上证明压缩协商，且「每个 TER 运行时必须提出并使用」压缩。需求 R-9.1 规定本期只做 node 测试，并且 Dexter 已裁定（D-37）：批次二只验证 node 实现的协商，Android 与 Expo Web 随新包接入 App 时再验证（R-10.5）。
  - 详设第 388 行把「unassigned、duplicate、empty selector、non-terminal target」列为批次一的检查，它们依赖批次二才建立的生成配置；需求 §1.1 批次一只含 V-T15 里针对契约的两条反例。
- **修正**：共享契约只写服务端行为，批次二的客户端义务按 R-10.5 写；批次一的 V-T15 只保留两条契约反例。

### S-8 监听机制建立在一个误读的外部前提上，时延与假死检测没有规定

- **证据**：
  - 详设第 303 行以为 pgjdbc 42.7.7 没有 `getNotifications(int timeoutMillis)`。实际上上游 REL42.7.7 的 `PGConnection.java` 第 76 行已经声明它（非 default 方法，驱动必须实现），`@since 43` 只是标注。另外，仓内模块钉的是 42.7.7，业务 app 的 `runtimeOnly("org.postgresql:postgresql")` 由 Spring Boot 4.1.0 的依赖清单管理为 42.7.11；两个版本都有这个方法。
  - 通知多久取一次、「提交到关闭」的时延上界、监听连接的读超时、主机静默消失（不发 FIN/RST）时怎样判定，都没有规定。
  - 测试闸门替换了生产的连接提供者，生产的建连代码在验收里从不执行，也没有声明这一点。
- **修正**：
  - 写明等待机制与时延上界；V-S5 的心跳间隔要大于这个上界；
  - 监听连接加读超时，并加一例「转发器停止转发、但不断开」，要求 30 秒内重建；
  - 测试闸门包装生产的提供者，或者把覆盖边界声明为未验证。

### S-9 BlockHound「零放行名单」不可行

- **证据**：
  - 仓内没有 logback 配置，即默认的同步控制台输出；在事件循环上记日志会碰到 `FileOutputStream.write`；
  - 在事件循环上调 `UUID.randomUUID()` 会读熵源；每终端串行化的锁发生争用时会 park；
  - 需求 V-S8 本来就允许放行名单，要求它随判据一起评审。
- **修正**：写明日志、ID 生成与串行化分别在哪个线程上执行，或按需求列出放行名单；写明 V-S8 在哪个 JVM 里装 BlockHound。红夹具：handler 里放 `Thread.sleep` 必红，生产的日志与 ID 路径保持绿。

### S-10 最新值的写入路径与竞态判据

- **证据**：
  - 一批合并写入晚于同一会话的断开写入提交，按会话身份比较拦不住，违背 R-6.3；
  - 8 个工作线程、队列 50（详设第 311 行），超出即拒绝：一次 120 个会话同时断开，会丢失断开记录。详设没写用哪种调度器；若用 Reactor 的 `Schedulers.newBoundedElastic`，它的队列上限按每个线程计，「队列 50」就有「共 50」与「每线程 50」两种理解；
  - 竞态用例没有写锁的是哪一行、放行前怎样确认等待者都已就位、两种先后各跑一次。
- **修正**：
  - 心跳写入带「未断开」条件；断开结果纳入有界待写集，或写明会丢失；
  - 每个竞态用例写明锁对象、观测到 N 个等待者才放行、两种顺序各跑一次；
  - 去掉激活路径的行锁，V-B7 必须变红。

### S-11 缺「被取代且凭证已作废时，关闭原因取『已取消激活』」这条规则（已核）

- **证据**：
  - 需求 R-4.4 第 3 点（需求第 181 行）有这条规则；详设第 232 行的判定表只写了「immediately closes replaced session」。
  - 同一设备再次激活、新凭证先于通知建连时，旧会话会以 `SESSION_REPLACED` 关闭，违背 V-B3、V-S5。
- **修正**：旧会话代次低于新会话时，按 `ACTIVATION_CANCELLED` 关闭；V-B3 加一例扣住监听投递的确定性交错。

### S-12 兜底核验里的「无效」没有定义，有批量清空的风险

- **证据**：监听重连到一个查不到这台终端绑定的库（D-15 题干里的「连错了库」，或 reset 之后），如果把「无效」一律以 `ACTIVATION_CANCELLED` 关闭，整个节点的设备会全部自清空，这正是 D-15 要避免的。
- **修正**：核验只在符合 R-4.7 第 2 步的作废条件时关闭会话；查不到绑定、或代次高于当前的会话，不由核验关闭；加 focused 测试。

### S-13 节点优雅下线的机制没有规定

- **证据**：Spring Boot 的优雅停机会让 Reactor Netty 在网络层停止接收新请求，下线窗口内的新连接收不到 `REDIRECT_TO_NEXT_NODE`，V-S9 第 1 条会失败。
- **修正**：下线状态在 Web 服务器停止接收之前进入；窗口内的新连接完成升级后，以 4000/`REDIRECT_TO_NEXT_NODE` 关闭；生产与验收走同一条触发路径。

### S-14 后台取消激活的错误语义偏离「沿用现有规则」（已核）

- **证据**：
  - 详设第 174 行新增 `STORE_TERMINAL_STORE_DISABLED` 与 `STORE_TERMINAL_STORE_VOIDED`。现有规则是：门店不是 ENABLED 时，`requireStore`（`apps/backend/catering-business-server/modules/store-terminal/src/main/java/com/catering/v2s/storeterminal/application/StoreTerminalOwnerService.java` 第 856–860 行）抛出 `TerminalStoreUnavailableException`，映射为 403 `PLATFORM_COMMON_ACCESS_DENIED`（`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java` 第 689 行）。同一页面的列表、详情与各写操作都走它。
  - 第 175 行给详情读加了 `STORE_TERMINAL_REFERENCE_INVALID`。现有契约里详情读的 `x-error-codes` 恰好是 AUTHZ_READ 的五个码（`contracts/openapi/paths/operations-admin/store-terminals.paths.json`）；这个码在现有代码里只用于写入时区域或标签引用无效（`StoreTerminalOwnerService.java` 第 461–492 行），详情读找不到终端走的是 `TerminalNotFoundException`（第 123 行）。详设没说详情读在什么情况下会返回这个码。
- **修正**：与现有读写保持一致；如果坚持新增错误码，交 Dexter 裁决。

### S-15 V-G1「新接入项记录耗时，默认模式保持分钟级」没有落点；有重复执行

- **证据**：
  - 详设没有耗时记录，而静态段约新增 9 条命令，包括本机 Gradle 测试与 Java 生成加编译；
  - 详设第 423 行拟加进静态段的两个 node 测试，已在运行段 `THCL-04-node-tests` 里（`tools/verify-gates/verify.mjs` 第 82 行；`scripts/test/test-health-entry-runner.mjs` 第 30、32 行）；
  - `edge-codegen --check` 已经被 `openapi-contracts`（`tools/verify-gates/cli.mjs` 第 1126 行）与 `contract-face` 各调用一次，再把它单列进静态段就是第三次。
- **修正**：两种模式分别记录耗时并给出上限；去掉重复执行。

### S-16 多存了一份「上一个已结束代次」的摘要，与需求不一致，也没有标为需求缺陷

- **证据**：
  - 详设第 225 行比较「当前代次」和「最近一个已结束代次」两份摘要。需求 R-1.6、R-2.2 只保留最近一个代次的摘要。
  - 由此行为不同：上一次 JS 运行的迟到请求，在需求下按新激活处理，会作废设备当前的凭证（§6 第 22 条，已登记接受的风险）；在详设下返回「本次激活已失效」，保住了当前凭证。
- **判断**：详设的行为更好，但它改变了一项 Dexter 知悉并接受的残余风险，又没有按派活要求列成需求修正。
- **修正**：详设把它标为需求修正提案，交需求方修订；V-B13 按最终写法断言。
- **Dexter 裁决**：需要知悉。Claude 建议接受，并据此修订需求 R-1.6、R-2.2 与 §6 第 22 条。

### N 级

- **N-1 共享契约缺项**：
  - WebSocket 地址；每个接口的 owner/tag 与各错误码的 HTTP 状态；字段约束（`surfaceForm` 取值、激活码 8 位数字、`deviceId`/`appVersion` 长度）；
  - 第 164 行的 `acceptanceScenarioId` 字段在目录里不存在，实际是 `scenarioIds` 与 `focusedTestId`；
  - 激活的幂等应写成目录里已有的 `{header: FORBIDDEN, replay: NOT_APPLICABLE}`，并在边缘契约目录的 `preAuthenticationIdempotencyPolicy`（第 741 行）登记例外；
  - 畸形帧与 `UNKNOWN` 的语义、`seq` 的规则都没写。
- **N-2 协议文件的位置**：放在 `contracts/registry/`，而 contracts 的分类闭集里已有 `protocol` 根（`tools/code-layout/cli.mjs` 第 18 行），理由没写；Java 侧怎样使用这份 JSON 也没写（生成常量，还是手写枚举加核对）。
- **N-3 常量来自测试规模并被冻结**：未认证名额 50、8 个线程、队列 50 都取自测试规模，还用红夹具「改值即红」冻结。应由预期规模推出，做成有缺省值的配置，红夹具只测行为。
- **N-4 泄漏判据缺两点**：编码形式里缺无填充的 Base64、字节数组以十进制输出；缺「格式非法的秘密被拒时，响应与日志都不回显它」这条反例。
- **N-5 摘要的唯一约束**：建在哪一列、违反时返回什么，都没写。
- **N-6 审计读的分页**：审计读写的是 `cursor`，现有 audit-read 用的是 `page, pageSize`。
- **N-7 日志门的扫描范围**：日志门（`tools/verify-gates/cli.mjs` 第 1154–1159 行）只扫业务 app 的 `src/main`、两个前端与 `libraries`，不扫业务模块 `modules/`。详设第 81 行把它算作防秘密泄漏的保障，第 403 行只把 TDS 加进扫描，处理秘密摘要的 terminal-binding 模块仍在扫描范围之外。
- **N-8 场景文件归属**：V-S 系列全部塞进 `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/StoreTerminalAcceptanceScenarios.java`（详设第 354 行）；规范要求写在「对应业务域」，新增一个域只需在 catalog 加一行。
- **N-9 Journey 文件**：与需求 §13 有偏离（前提链缺行、缺「禁止伪修复」）；STATUS 与 §7 仍写待接受，与 D-33 不一致。
- **N-10 计划缺项**：缺模板 13c 的两类检查；四项准入记录落在哪里没写；V-B4 少了「A 在 B 激活后重试取消激活」一例；V-S8「业务表读取为 0」没定义统计哪些表。
- **N-11 DEV 改动面没列**：`scripts/dev/r5-dev-runner.mjs` 第 899 行把 tunnel 固定为 `HTTP_AND_ASSET_ONLY`；还有端口校验与远端启动的进程，都要随 TDS 改。
- **N-12 兜底评审标记**：详设 §14 记录的作者兜底评审没有 `REVIEW_FALLBACK` 标记（UNVERIFIED，评审文件未读）。
- **N-13 静态测试的成功标记**：`tools/verify-gates/verify.mjs` 第 54–57 行给 `l2-locator-bindings-static` 写死了成功标记 `tests 8`/`pass 8`，新增静态用例时要同步。
- **N-14 批次体量**：详设约 480 行、约 29 组判据、约 20 道门改写，远超「半小时可核」。D-32 是 Dexter 的明确合并，本评审建议维持，先修完本轮的 M、S。

## 3 · D-18 的 UI 强制自问

1. **来自用户的明确要求**：是。D-18「终端创建后，不能改设备类型」；D-24 免单独确认。
2. **是否合逻辑**：合逻辑。编辑功能时要看到设备类型，因为它决定哪些功能能选；新建照常可选。
3. **更短的路径**：编辑态隐藏设备类型会丢掉选功能所需的上下文，所以只读展示是最短的合理路径。
4. **不合理之处的来源**：
   - 编辑态提示文案来自历史实现的惯性（S-5）；
   - 「owner 可区分拒绝」来自旧文档残留（S-5）；
   - 没有新增任何附加解释物。

## 4 · 已核成立的事实

- 接口计数 293/124/169、各面命令 126/34/9；新增后应为 296/124/172 与 127/34/9/2，算术正确。
- 详情读的 FIXED 上限是 11，作废路径是 18。
- L2 准入是 6 个用例、31 个控制面文件，designPath 指向 09-24 详设。
- D-18 的调用方全集已逐个核对，都在同步族内。
- 激活码唯一索引包含已作废的终端，按「集团空间加激活码」查找结果唯一。
- 通知负载不含秘密；`pg_notify` 与业务变更同事务。
- 「先登记认证中、再查库」加每终端串行，能堵住「通知早于登记」的竞态。
- 凭证格式 `代次.Base64URL`，SHA-256 摘要，关闭码用 4000 加原因闭集，都可接受。
- Spring 的 `ReactorNettyRequestUpgradeStrategy` 接受 builder supplier；压缩默认关闭；`maxFramePayloadLength` 作用于压缩后的长度。

## 5 · TEMPLATE_COVERAGE

- **实施详设模板**：
  - 有：§0、§1、§2、§6、§8、§9、§9b、§10、§10b.1～.5、§13、§13b、§13c；
  - 有，但带缺陷：§3（缺审计 entityType）；
  - 缺一部分：§3a（S-4）、§4、§5、§7、§9a、§11（S-6）；
  - 理解错：§10b.6（S-6）；
  - 缺：§12；
  - 自报不成立：§14。
- **IA 模板**：D-18 覆盖有；E01 缺只读 testId，与详设口径不一致（S-5）。
- **交互工件模板**：有，但与详设矛盾（S-5）。
- **Journey 模板**：§1～§3 有，但偏离需求；§4 缺「禁止伪修复」；§6 把 Radio 写成了 Select；§7 与 D-33 不一致（N-9）。
- **实施任务模板**：三答、步骤级对账、6b、四项准入、运行纪律、两行状态、逐代码对账都有；缺 6c；§8 的顺序与 6b 矛盾（S-3）。

## 6 · 未能核实（L3_UNVERIFIED）

- 静态首败是否确为 frontend-format，以及其后各门与运行段的现状：没有运行，无法复核。
- 分片超限时 reactor-netty 1.3.6 实际发出的关闭码（乙称 1002）；1.3.6 构造解压器时 maxAllocation 是否写死为 0。
- 官方 postgres 镜像停库后的容器行为、Docker 端口重映射：属外部事实推论。
- 同一 JVM 三个上下文在 Spring Boot 4.1 下的实际行为（例如日志系统重复初始化）。
- BlockHound 在 JDK 21 下需要的参数；TCP 假死的检测时长。
- TER 的 Android（OkHttp）与 Expo Web 的压缩协商：属批次二以后，按 R-10.5 随接入 App 时验证。

## 7 · 需要 Dexter 裁决或知悉

1. **M-3**：是否把单接口的预算例外委托给批次一的实施 agent（`AGENTS.md` 第 37 行）。
2. **M-2**：decision 修订后由 PROPOSED 转为已接受。
3. **S-16**：接受「上一个已结束代次」摘要这一改进，并据此修订需求（Claude 建议接受）。
4. **S-1**：只在详设坚持「TDS 不是模块」时需要。
5. **N-14**：批次体量维持（建议）。
6. 已处理：批次二的压缩义务，Dexter 已裁定 D-37，需求已补 R-4.8、R-10.5、V-S14。

**评审交付后的裁决（2026-09-26）**：Dexter 对 Claude 的建议答复「需要我拍板的我都同意你的建议，重新写话术吧」。
- M-3 → 需求 D-39：批次一中单一接口的预算例外，按 `AGENTS.md` 第 37 行委托给批次一的实施 agent（`authority=IMPLEMENTATION_AGENT`，只限单一接口，须满足双重准入）。详设要写明这项委托。落点是需求 §8 第 8 条。
- S-16 → 需求 D-38：接受详设多存「最近一个已结束代次」的摘要。需求 R-1.6、R-2.2、V-B13、§6 第 22 条、§8 第 2 条已修订。
  - 精度更正：这份摘要只保护「迟到请求所属操作建立的代次正是最近一个已结束代次」的情形。其余情形仍按 §6 第 22 条登记接受。
  - 详设 V-B13 按修订后的需求断言。
- N-14：维持 D-32 的合并。
- M-2：decision 修订后，由 Dexter 确认转为已接受；这一项尚未发生。

## 8 · 会话出处与授权边界

- 续接会话，Claude 主会话合并与核验；三个盲审由 fresh 独立子 agent 执行，只读，都没有读 Codex 的两份评审文件。
- Claude 是本需求正本的作者。评审期间，按 Dexter 的指示（D-37）在三个盲审全部结束之后修订了需求正本，补上压缩；本评审对照的是修订后的 R-4.8、R-10.5、V-S14。评审交付后，又按 D-38、D-39 修订了需求正本（见 §7）。
- 本文件是本轮唯一新写的评审文件；没有修改被审的详设、计划、decision 与门店终端工件。
- 全程只做只读检索与解析，外部事实取上游一手资料；没有运行构建、测试、生成器、scripts/verify、DEV、backend-acceptance、reset、seed、L2、UAT 或任何数据操作。
- 本结论只是评审结论：不扩展 Codex 的工作范围，不授权任何实施或运行。各条 finding 是交 Codex 复核的输入，不自动成为权威。
