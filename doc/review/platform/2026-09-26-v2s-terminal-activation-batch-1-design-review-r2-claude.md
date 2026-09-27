# 终端激活与长连接 · 批次一详设与实施计划第 2 轮复评（Claude）

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=2/5/8
L1_ENGINEERING=findings：R2-M1、R2-M2、R2-S1～R2-S5、R2-N1～R2-N6、R2-N8
L2_USER_VISIBLE=D-18 已在五份工件统一（原 S-5 关闭）；残留 R2-N7（IA 与交互工件没有声明 E01 只读观测键）
L3_UNVERIFIED=见 §7
SAME_ROOT_SCAN=每条 finding 下的「同族」一段
DESIGN_GAPS=R2-S2（压缩的上下文接管策略要在详设里定清）；R2-N2（未认证连接上限的数值）
TEMPLATE_COVERAGE=见 §6；§14 自报全部 PRESENT 不成立（R2-N6）
EVIDENCE_TIER=STATIC_SOURCE：仓内源码与文档逐行核对；外部事实取上游按版本标签的源码与 RFC 原文；零运行
```

**评审对象（冻结时的 SHA-256，评审结束时复核未变）**

| 文件 | SHA-256 |
|---|---|
| `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-design-codex.md`（816 行） | `2b2123ffa189348658d01bf68c7e0e96913bc8629d99e9848b7876cbcc6f98a1` |
| `doc/plans/platform/2026-09-26-v2s-terminal-activation-and-connection-implementation-plan-codex.md`（140 行） | `c0ae84c8c8ad2e703ac3c556fa0407f395a72d825fbac8bff2927f5c4993dac2` |
| `doc/decisions/2026-09-26-v2s-terminal-activation-service-shape.md`（119 行） | `543ecabbe0a09ed82ccf0b7d7a22474a34a39dfe4a253d2d195ea7a46fdf9cb8` |
| `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ia-codex.md` | `a103adda781c32b6904de63f70c86ad61f0e2519b41e991bac4b5a1c8f430206` |
| `doc/plans/platform/2026-09-23-v2s-store-terminal-management-ui-interaction-design-codex.md` | `4e35c423b303b3c36628b7361e0642fb9aedaf4ab775a487380a5bf563cdc9d0` |
| `doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-design-codex.md` | `f6354d8af7de6cefab5769d0445deca1b0fe9598da6ad3f80a022ccb390b01e3` |
| `doc/plans/platform/2026-09-24-v2s-store-terminal-management-implementation-plan-codex.md` | `01c4e5b0363ff203121d46d2248e5c6ebe3cf6f8f4297c421a7efccdfa33dfc0` |
| `doc/decisions/2026-09-26-v2s-terminal-activation-and-connection-journey.md`（同批修订） | `e63d661c268ee3cfa51219fed4f17e68f5413f50ebbb390bcabd40575e17811f` |
| `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`（活跃规范，本轮被改） | `ea704ba9c667429fbd832e450c919f005b47552818308b062bcc35f2fd0dc61c` |

下称「详设」「计划」「decision」。

**评审方式**
- Dexter 在评审中途要求「不要子agent盲审了，全都由你来审」。本轮先派出的三个子 agent 已停止，它们的中间结果没有采用；本轮全部由 Claude 主会话完成，没有独立子 agent 的结论。
- 用第 1 轮三位审查员读取记录里的全文，逐行还原了上一版详设、计划与 decision，与当前字节做了全文比对，而不是只看修订点。比对发现一处未申报的删除：详设 §14 原有的两段作者评审记录被删掉了，不影响结论。
- 上轮之后仓内改动过的文件已全部列出：除评审对象外，还有 `project-memory/index.json`、`index.md`、`required-inventory.json` 与新文件 `project-memory/operations/claude-review-finding-intake.md`。这些是锚点重编号与 Codex 自己的 intake 规则，与本批设计无关，未纳入评审。
- 修订说明与详设里的「intake 已完成」一类自述，只作声称，不作证据。

## 1 · 结论与方案合理性

**比上一轮前进了一大步，但还有两处会让计划照着执行时卡死。**
- 上一轮的 6 个 M 里，M-5 已关闭，其余 5 个关键部分都已落地：R-12 门台账可以复现，Q1～Q14 按原样复跑的结果与详设一致；D-39 与 AGENTS.md 第 37 行逐项对得上；D-18 五份工件已统一。
- 仍会卡住执行的两处：
  - 静态验证在 CP-05 标定之前必然是红的，而计划要求先让它变绿（R2-M1）；
  - 同一 JVM 的三上下文 harness 把 TDS 放进了业务后端的测试类路径，由此带来的连带后果没有处置（R2-M2）。

**问题对不对**

范围与需求 §1.1 批次一一致；D-37 的批次划分、D-38 的判定顺序、D-39 的委托范围都已按裁决落地。有一处方向问题：压缩只接受报价里带齐两个「无上下文接管」参数的客户端，而 OkHttp 与 undici 的默认报价都不带。照此实现，Dexter 要的压缩对计划中的客户端实际不会生效（R2-S2）。

**方案优不优**

- 验收 harness：详设在第 376 行给了退路：扫描排除证明不了，就改用单独管理的 TDS 进程。R2-M2 列出的四处连带后果，都来自「TDS 与业务后端共用一个测试 JVM 和类路径」这一个根。改用单独的 TDS 进程可以一次消除这四处，还能真正证明「只配数据库即可启动」。代价是 harness 要管一个进程，而 DEV 已经有受管的 TDS 进程可以参照。
- Claude 不替作者选。但详设必须写出两条路线的取舍，而不是把同 JVM 作为默认、把问题留到第一次动态运行再暴露。

**代价配不配**

- §12.1 的 258 行命中清单可以复现（已核），有价值。但检索式漏了「三面字面量」这一族，Q5 的正则又区分大小写，漏掉了 `edge-codegen.mjs`。清单的价值在检索式本身，列得再长也补不了检索式的缺口（R2-S1、R2-M1）。
- 把未认证连接上限改成必填、缺值即拒绝启动的部署键，还计入冻结的跨层环境键，却没给数值。这比「有缺省值、可选覆盖」更重，也没有完成需求交给详设的决定（R2-N2）。

## 2 · 原 finding 逐条状态（以当前字节为准）

| 原编号 | 状态 | 依据 | 残留 |
|---|---|---|---|
| M-1 | PARTIALLY_CLOSED | 详设 §12.1 的 Q1～Q14 复跑一致；四面对账（第 702 行）、M1 emitter（第 707 行）、环境键 18→19（第 708 行）、生命周期词表 N/A 加反例（第 709 行）、RTK N/A（第 710 行）、project-memory 接入 verify（第 706、725 行）、`OWNER_NAMESPACES` 归到 operation-handler-bindings（第 704 行）、日志门扩到 modules 与 TDS（第 724 行）、放置目录与哈希钉（计划第 26 行） | R2-S1 |
| M-2 | PARTIALLY_CLOSED | 改为锚点取代（decision 第 11–17 行，5 个根 ADR 锚点与行号逐个核对存在）；§6.1、§6.2 按文件列出处置；场景规范补了 WebSocket 的 CONTRACT | R2-N3 |
| M-3 | PARTIALLY_CLOSED | 计划第 67、117 行加入三次全目录标定；运行器确实支持 `--operation all --calibration`，并拒绝单接口过滤（`scripts/test/backend-acceptance` 第 14–24 行） | R2-M1 |
| M-4 | PARTIALLY_CLOSED | 覆盖到 Reactor Netty 1.3.7 / Netty 4.2.17：上游 v1.3.7 的构建文件把 Netty 默认版本定为 `4.2.17.Final`，两者配套；解压上限在解压过程中按帧生效；累加器限整条消息；应用层按 1009 关闭可行（见 §5） | R2-S2、R2-S3、R2-N1；版本覆盖的作用范围见 R2-M2 |
| M-5 | CLOSED | 详设 §8 第 242、244 行；§6 第 215 行；§9 第 259、261 行；V-B13 第 417 行。唯一判定点在 `activateOrReplay`，顺序与 D-38 一致 | — |
| M-6 | PARTIALLY_CLOSED | 扫描排除（第 376 行，含改用独立进程的退路）；度量 sink 只由第一个上下文安装（第 344 行）；只留一个生产接缝（第 339–344 行）；V-S12 改为 Docker 暂停（第 342、430 行）；超时与错误映射（第 325 行，计划第 88 行） | R2-M2 |
| S-1 | PARTIALLY_CLOSED | 登记表补登 store-terminal、audit-read、terminal-binding，COMMAND 方向写清（第 268、722 行）；`terminal_connection` 的 owner（第 311 行） | R2-S5 |
| S-2 | PARTIALLY_CLOSED | ArchUnit 包名改正（第 741 行）；pageKey 断言移到 openapi-contracts（第 723 行）；security-boundaries 接入 verify（第 737 行） | 导入范围问题并入 R2-M2 |
| S-3 | PARTIALLY_CLOSED | 6b 在第一次动态运行之前、6c 单场景首跑、frontend-format 列为第一步（计划第 112–116 行） | 标定顺序并入 R2-M1 |
| S-4 | CLOSED | designPath 改指新详设、控制面 31→34 条、E01 键集合（详设第 102–111 行，计划第 99 行）；E01 的 29/17 键与 `contracts/policy/store-terminal-l2-scenarios.json` 的 TER-L2-E01 逐项、逐序一致 | 格式残留见 R2-N6 |
| S-5 | CLOSED | IA 第 81 行、交互工件第 342、369 行、09-24 详设与计划各第 7 行、Journey 第 78 行统一为「更新契约不含 deviceType，遗留字段由 strictBody 按未知字段拒绝」；控件形态改为 `Radio.Group`；提示文案的删除排进计划第 119 行 | — |
| S-6 | PARTIALLY_CLOSED | §5 规模列、§7 机制行、§9a 分行表、§11 四列已补 | R2-N6 |
| S-7 | CLOSED | 批次二只证 node（详设第 34、209 行，计划第 16 行）；V-T15 只留两条契约反例（第 434 行） | — |
| S-8 | CLOSED | `getNotifications(1000)`、提交到关闭 5 秒、假死 15 秒内发现、不再替换连接提供者（第 323–325、342 行） | — |
| S-9 | CLOSED | 日志、ID、序列化分到具名工作线程；本设计不批准任何放行名单，需要时停下回到设计（第 333 行） | JVM 级的 BlockHound 并入 R2-M2 |
| S-10 | CLOSED | 心跳 UPDATE 带 `disconnected_at IS NULL`；断开进入不可丢弃的有界集合（第 317 行）；竞态放行前等待具名参与者就位（第 428 行） | — |
| S-11 | CLOSED | V-S4（第 422 行） | — |
| S-12 | CLOSED | 只在 R-4.7 第 2 步成立时关闭，查不到绑定等情形不关（第 325 行） | — |
| S-13 | CLOSED | V-S9 的顺序判据（第 427 行） | — |
| S-14 | CLOSED | 停用门店沿用 `requireStore` 的 403；详情读不新增码（第 190–191 行） | R2-N8 |
| S-15 | CLOSED | 去掉重复执行（计划第 113 行；详设第 736 行）；两种模式分别记录耗时（计划第 117 行） | — |
| S-16 | CLOSED | 已由 D-38 裁决；V-B13 含「上一次操作的迟到请求」（第 417 行） | — |
| N-1 | CLOSED | WebSocket 地址、字段约束、HTTP 状态、`scenarioIds`/`focusedTestId`、`preAuthenticationIdempotencyPolicy`、畸形帧与 `seq` 规则（第 173–203 行） | 新增码缺失见 R2-S4 |
| N-2 | CLOSED | 协议文件移到 `contracts/protocol/`，classpath 副本按摘要比对（第 183 行） | — |
| N-3 | CLOSED | 不再冻结 50/8/50 | 数值缺失见 R2-N2 |
| N-4 | CLOSED | 十进制字节数组、非法秘密不回显（第 175、177 行） | — |
| N-5 | PARTIALLY_CLOSED | 唯一约束已定（第 308 行） | R2-S4 |
| N-6 | CLOSED | `page`/`pageSize`（第 265 行） | — |
| N-7 | CLOSED | 日志门扩到 modules 与 TDS（第 81、724 行） | — |
| N-8 | CLOSED | 新增 `TerminalConnectionAcceptanceScenarios.java` 域（第 376 行；场景规范已登记） | — |
| N-9 | CLOSED | Journey 补了「禁止伪修复」与前提链；§7 与 D-33/D-34 一致（Journey 第 64、84–90 行） | — |
| N-10 | CLOSED | 四项准入记录的位置（计划第 99 行）；13c 两类检查（计划第 120 行）；V-B4 新增一例（第 408 行）；V-S8 点名四张表（第 426 行） | — |
| N-11 | CLOSED | DEV 改动面（decision 第 111 行，计划第 31 行） | — |
| N-12 | CLOSED | `REVIEW_FALLBACK` 标记（第 809 行） | — |
| N-13 | CLOSED | 定位静态测试计数（第 726 行） | — |
| N-14 | CLOSED | Dexter 维持 D-32 | — |
| D-39 | CLOSED | 详设第 162–164 行、计划第 67、117 行：批次一、单一接口、双重准入、`authority=IMPLEMENTATION_AGENT`、保留上调红夹具、不得用于多接口/线性批量/契约模型/未决语义、不成立即停；与 `AGENTS.md` 第 37 行逐项对得上 | — |

## 3 · 本轮 findings

每条写明：位置、性质、证据、影响、验收判据、是否需要 Dexter 裁决。判据只写要满足什么，不写实现手法。

### R2-M1 静态验证在 CP-05 标定之前必然是红的，计划却要求在标定之前让它变绿（M-3、S-3 的残留）

- **位置**：计划第 114 行（第 3 步）与第 117 行（第 6 步）；详设 §12.3 第 737 行；计划第 67 行。
- **性质**：仓内事实，源码亲验。
- **证据**：
  - `openapi-contracts` 是静态段第 8 条命令（`tools/verify-gates/verify.mjs` 第 22 行），两种模式都跑。它调用 `edge-codegen --check`（`tools/verify-gates/cli.mjs` 第 1119–1131 行）。
  - `--check` 走 `checkOutputs()` → `load()`（`scripts/generate/edge-codegen.mjs` 第 2571、1979–1981 行），`load()` 在第 295–300 行计算预算投影。只有设置环境变量时才走 identity-only 投影（`scripts/generate/backend-performance-budget.mjs` 第 414–416 行：`V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION` 或 `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY`）；`scripts/verify` 不设。
  - 所以三个新接口进入 CP-05 标定报告之前，`--validate-only` 一定在 openapi-contracts 报 `BUDGET_PROJECTION_OPERATION_MISSING`（同文件第 1255 行）。
  - 计划第 3 步却要求先跑 `--validate-only`，每个红夹具停在自己的标记上，「no earlier unrelated failure counts」；详设第 737 行还要求每道门先证明「unmutated green verify mode」。而标定排在第 6 步，在 6b（第 4 步）与第一次动态运行（第 5 步）之后。排在 openapi-contracts 之后的门（例如 `verify.mjs` 第 59、60 行的环境键与生命周期词表）拿不到自己的标记，绿基线也拿不到。
  - 计划第 67 行只把「完整 `scripts/verify`」当作消费预算投影的路径，漏了静态段。
  - 同族：详设 Q5 的正则 `CP-05|cp05` 区分大小写，匹配不到 `edge-codegen.mjs` 里的 `Cp05`（`isCp05IdentityOnlyProjectionMode`、`readCp05CalibrationReport`）。这个消费点因此不在 Q5 的命中集里，§12.2 也就没有它的一行。
- **影响**：计划按字面执行会在第 3 步卡住，而第 3 步又是 6b 与标定的前置，形成循环。实施者只能临时改顺序，或者绕开「绿基线」协议。
- **验收判据**：
  - 计划写明：标定之前静态段处于哪种状态、标定之前哪些红夹具能在哪种模式下被证明、标定之后怎样补证其余红夹具。标定本身的进入条件也要写明，而且不能依赖一个做不到的绿静态段。
  - Q5（或新增检索）能命中 `edge-codegen.mjs`，§12.2 有它的处置行。
  - 反例：把三个新接口加进目录、不更新标定报告，按计划顺序走到第 3 步，计划应当预先写明此时的失败标记与处置，而不是「no earlier unrelated failure」。
- **Dexter 裁决**：不需要。

### R2-M2 同一 JVM 的三上下文 harness 把 TDS 放进业务后端的测试类路径，四处连带后果没有处置（M-6、S-2 的残留）

- **位置**：详设第 341–344、376 行，§12.2 第 705、711 行，§12.3 第 741 行；计划第 30 行（第 7 步）。
- **性质**：仓内事实加外部事实（上游源码）加推论。
- **前提**：验收测试源要实现 TDS 主代码里的 `SessionRegistrationGate`（详设第 341、344 行），并在同一 JVM 启动 TDS 上下文。所以 TDS 的主代码必然在业务后端的测试编译与运行类路径上。
- **证据与后果**（同族全集，四项）：
  1. **版本覆盖的作用范围没写**。业务后端应用了 `io.spring.dependency-management`（`apps/backend/catering-business-server/build.gradle.kts` 第 5–6 行），按 Spring Boot 4.1.0 的清单强制 Reactor BOM 2025.0.6（reactor-netty 1.3.6）与 Netty `4.2.15.Final`。详设只说「覆盖到 1.3.7 / 4.2.17，并在 TDS 验收前记录实际解析图」（第 34、207 行），没写覆盖放在哪里、对哪条类路径生效。若覆盖只作用于 TDS 工程，验收里的 TDS 会运行在 1.3.6 上：`WebsocketSpec.Builder` 没有 `maxDecompressionBufferSize`，调用即失败。另外，Reactor Netty 1.3.7 所属的是 Reactor BOM 2025.0.7（上游 `gradle.properties` 的 `bomVersion`），详设只写「这一对」，没写 reactor-core、reactor-pool 是否随 BOM 一起对齐。
  2. **TDS 上下文会被推断成 Servlet 应用**。Spring Boot 4.1.0 的 `WebFluxWebApplicationTypeDeducer` 标注 `@Order(20) // Ordered after MVC`，业务后端带 `spring-boot-starter-web`。同一类路径上启动的 TDS 上下文，除非显式指定 Reactive，否则会起 Servlet 容器：WebFlux 的 WebSocket 处理与 `ReactorNettyRequestUpgradeStrategy` 都不会生效，压缩与协议验收测的不是生产上的那套栈。详设与计划都没提应用类型。（Flyway 不受影响：业务后端在 `BusinessDataConfiguration` 里手动配置 Flyway，TDS 只扫描自己的包。）
  3. **业务 ArchUnit 会把 TDS 主代码一并导入**。`BackendModuleBoundariesTest` 用 `@AnalyzeClasses(packages = "com.catering.v2s", importOptions = ImportOption.DoNotIncludeTests.class)`（第 35 行），`DoNotIncludeTests` 只排除测试输出目录，不排除 TDS 的主代码。详设第 741 行把第 54–55 行的规则改成禁止依赖 `com.catering.v2s.terminaldataserver..`，而规则主体是 `noClasses()`：TDS 类之间的正常互相依赖就会让它变红；其余按包模式写的业务规则也会作用到 TDS 类上。这是静态段的门（§12.2 第 705 行）。
  4. **Reactor Netty 资源与 BlockHound 是 JVM 级的（条件性）**。上一轮要求「服务端与测试客户端的 Reactor Netty 资源互相独立」，本轮没有处置。测试 WebSocket 客户端用什么没写；若也用 Reactor Netty，它默认与 TDS 服务端共用全局事件循环，而 BlockHound 在同一 JVM 内生效（第 333 行）。
- **影响**：第 3 项会让计划第 3 步的静态验证变红；第 1、2 项会让第一次动态运行（计划第 5 步）失败或测错对象，触发「同一失败族第二次即停」。
- **验收判据**：
  - 详设比较并选定「同 JVM」或「单独管理的 TDS 进程」。若选同 JVM，逐项写明：覆盖作用于哪些工程的哪些配置，以及对 `:apps:backend:catering-business-server:testRuntimeClasspath` 与 TDS 自身 `runtimeClasspath` 的版本判据；TDS 上下文的应用类型；业务 ArchUnit 的导入范围怎样排除 TDS，而 TDS 由它自己的架构测试负责；测试客户端的资源隔离。
  - 反例：把 TDS 加为业务后端的测试依赖、不做任何排除，业务 ArchUnit 必须保持绿，且没有任何规则把 TDS 类当作业务模块来判。
- **Dexter 裁决**：不需要。

### R2-S1 暴露面字面量一族没有列全，contract-face 被判成「不变」；终端 edge 包的隔离没补（M-1 的残留）

- **位置**：详设 §12.2 第 719 行（把 `tools/platform-boundary-gates/cli.mjs` 判为「不变，N/A」，理由写的是「no ... platform-admin edge changes」）、第 702、703 行；§12.1 没有针对暴露面字面量的检索（上一版详设有这一行）。
- **性质**：仓内事实。
- **证据**：用只读检索找出单行形式的三面字面量共 6 处：
  - `tools/verify-gates/cli.mjs` 第 636 行：已处置（第 702 行）；
  - `tools/platform-boundary-gates/cli.mjs` 第 84–97 行：contract-face 用写死的三面与放置解析报告的 `closure.faceCounts` 比较，报 `R5_CONTRACT_FACE_OPERATION_CLOSURE_INVALID`。需求 R-12 点了名（需求第 456 行「`tools/platform-boundary-gates`：写死的三个暴露面」）。详设把它判为不变，理由是把 platform-boundary 误读成了 platform-admin；
  - `scripts/generate/r5-edge-materialize.mjs` 第 367–368 行：按三面计数，与放置目录比较（`R5_EDGE_FACE_DENOMINATOR_DRIFT`）；
  - `scripts/generate/edge-codegen.mjs` 第 334、344 行：两处；
  - `scripts/generate/edge-operation-projections.mjs` 第 159–163 行：被 edge-codegen 与 r5-edge-materialize 调用，不在 Q1～Q14 任何一条的命中集里。
  - 后三个文件虽因别的原因出现在命中集里，但面字面量没有逐处处置。
  - 同族：终端 edge 包的 ArchUnit 隔离。`BackendModuleBoundariesTest.java` 第 75–77 行的 `EDGE_CAPABILITIES_DO_NOT_DEPEND_ON_PEERS` 只作用于 platform、operations、publicentry 三个 edge 包，新的终端 edge 包不在规则主体内；详设 §12.2、§12.3 没有提到。
- **影响**：四面对账的门会以哪个首败标记失败无法预先确定；台账声称的「完整」不成立。
- **验收判据**：
  - 新增一条可复现的暴露面字面量检索（覆盖数组、Set、多行写法），逐处写入口、verify 模式与红夹具，或写 N/A 加反例；
  - contract-face 的四面比较要有一行；
  - 红夹具：放置目录或目录分母里出现未知的第五个面，contract-face、r5-edge-materialize 与 edge-operation-projections 各自在所写模式下非零；终端 edge 包依赖运营面某个 capability，ArchUnit 变红。
- **Dexter 裁决**：不需要。

### R2-S2 「两个无上下文接管参数都协商到，否则不压缩」在所选组件上没有落点；按字面执行，计划中的客户端都不会压缩（M-4 的残留）

- **位置**：详设第 34、205、431 行；decision 第 77 行。
- **性质**：外部事实（上游源码与 RFC）加推论。
- **证据**：
  - Netty 4.2.17 的 `PerMessageDeflateServerExtensionHandshaker.handshakeExtension`（第 298–358 行）：只有客户端报价里带 `server_no_context_takeover` 才置 `serverNoContext`，带 `client_no_context_takeover` 才置 `clientNoContext`。报价里不带这两个参数，就照常接受 permessage-deflate，并保留上下文接管。Reactor Netty 1.3.7 的 `compressionAllowServerNoContext` 与 `compressionPreferredClientNoContext` 只是把这两个开关传进去（`WebsocketServerOperations.java` 第 123–126 行），没有「要求两者都有」的模式。
  - 计划中的客户端默认报价都不带这两个参数：OkHttp 4.9.2 固定发 `permessage-deflate`，且不允许应用改这个头（`RealWebSocket.kt` 第 147–149、162 行）；undici v8.9.0 固定发 `permessage-deflate; client_max_window_bits`（`lib/web/websocket/connection.js` 第 84–88 行）。
  - RFC 7692 §7.1.1.1 与 §7.1.1.2 允许服务端在应答里单方面带上这两个参数，客户端必须支持 `client_no_context_takeover`；undici 只读取应答里的 `server_no_context_takeover` 与 `server_max_window_bits`（`permessage-deflate.js` 第 23–24 行），不会因此失败。
- **影响**：详设第 205 行的规则没有任何具名组件执行。
  - 若不执行：Netty 会对默认报价协商出保留上下文接管的压缩，与详设自己的规则和内存模型不符。
  - 若执行成「报价不带齐就不压缩」：Android（OkHttp）、Node（undici）乃至浏览器的默认报价都拿不到压缩，D-37 在实际客户端上失效，批次二 R-10.5 要求的 node 实现「协商与解压」也无从证明。
  - V-S14 只测了「带齐两个参数」的报价，两种实现都能通过。
- **验收判据**：
  - 详设写定对三类报价的应答：`permessage-deflate`；`permessage-deflate; client_max_window_bits`；带齐两参数。并写明由哪个具名组件实现。
  - V-S14 加上前两类报价的用例，断言应答里的扩展参数与之后的帧行为。
  - 若选择「默认报价不压缩」，要写明它对 D-37 与 R-10.5 的后果。
- **Dexter 裁决**：只在详设选择「默认报价不压缩」时需要（它改变了 D-37 的实际效果）；选择服务端单方面要求无上下文接管则不需要。

### R2-S3 两处帧级压缩控制在所选组件上做不到，V-S14 的相应断言通不过或证伪不了（M-4 的残留）

- **位置**：详设第 34、198、205、209、431 行；计划第 29 行。
- **性质**：外部事实（上游源码）。
- **证据**：
  1. **deflate-frame 过滤器**：详设写 `Rfc7692OnlyExtensionOfferFilter` 是 WebFlux 的 `WebFilter`，在升级协商前剔除 deflate-frame。Reactor Netty 1.3.7 协商时，从原始 Netty 请求 `replaced.nettyRequest.headers()` 复制请求头（`WebsocketServerOperations.java` 第 112–117 行），同时注册 permessage-deflate 与 deflate-frame 两个握手器（第 127–130 行）。而 Spring Framework 7.0.8 修改请求时，一律把请求头复制成一份新副本（`DefaultServerHttpRequestBuilder.java` 第 66–76 行的注释与代码）。按常规的 `exchange.mutate()` 写法，过滤器改的只是 Spring 这一层的副本，影响不到 Reactor Netty 读的原始头。
  2. **PONG 不压缩**：PING/PONG 在本协议里是 JSON 文本帧，不是 WebSocket 控制帧。Netty 4.2.17 的 `PerMessageDeflateEncoder.acceptOutboundMessage`（第 74–90 行）会压缩所有未置 RSV1 的文本帧，除非扩展过滤器要求跳过；Reactor Netty 1.3.7 调用的构造函数（`PerMessageDeflateServerExtensionHandshaker` 第 134–140 行，转到第 167–173 行）固定使用 `WebSocketExtensionFilterProvider.DEFAULT`，`WebsocketServerSpec` 也不暴露过滤器。所以协商成功后，TDS 发出的 PONG、SESSION_READY 都会被压缩。V-S14 的「uncompressed AUTHENTICATE and PING/PONG」对 PONG 通不过。
  3. **AUTHENTICATE 带 RSV1=0**：这是客户端义务（第 198 行），服务端收到压缩的首帧时怎么办，没有写。
  4. V-S14 没有「只报 deflate-frame」或「deflate-frame 排在前面」的报价用例，第 1 项即使失效也测不出来。
- **影响**：需求 R-4.8「只实现 RFC 7692」在客户端报 deflate-frame 时不成立，而且测不出来；V-S14 第一次运行即在 PONG 上失败。
- **验收判据**：
  - 每一项控制写明实际生效的组件与挂载点；做不到的，改写契约里的相应条款（例如哪些帧可能被压缩），不能保留一条实现不了的断言；
  - 写明 TDS 收到 RSV1=1 的首帧时的行为；
  - V-S14 增加 deflate-frame 报价的用例，断言协商结果里没有 deflate-frame。
- **Dexter 裁决**：不需要。

### R2-S4 摘要唯一约束的冲突码不在共享契约里，并给 R-1.4 的闭集加了第 10 种拒绝原因（N-5 的残留）

- **位置**：详设第 308 行（`uk_terminal_binding_credential_digest` 冲突时返回 409 `TERMINAL_BINDING_CREDENTIAL_DIGEST_CONFLICT`）；§5a 第 187 行（激活的错误集）与第 192 行（新增 `v2sNativeCodes` 清单）。
- **性质**：仓内事实（文本比对）。
- **证据**：这个码在详设全文只出现在第 308 行。§5a 的激活错误集与新增码清单里都没有它；§5a 又写明「no other operation receives these codes」，是批次二的交接边界。需求 R-1.4 的拒绝原因是 9 项闭集；这是第 10 种，详设没有标为需求修正。
- **影响**：owner 返回的码不在接口声明的错误集里，edge 映射与契约门的行为不确定；批次二按 §5a 生成客户端时拿不到这个码。
- **验收判据**：
  - 这个码要么进入 §5a 的错误集与新增码清单（并标为需求修正提案，由需求方修订 R-1.4），要么改为已有的不变量错误并写明理由；
  - 两处文本一致。
- **Dexter 裁决**：不需要。若保留为新的拒绝原因，由 Claude 修订需求 R-1.4。

### R2-S5 TDS 的运行时依赖闭包没有判据，terminal-binding 自身的依赖未定（S-1 的残留）

- **位置**：详设 §9 第 263 行（`cancelByOperations(..., context)`）、§12.2 第 705 行（只约束 TDS 的直接依赖「one terminal-binding API dependency」）；decision 第 32 行。
- **性质**：仓内事实加推论。
- **证据**：
  - 需求 §8 第 1 条（需求第 916 行）要求「TDS 的运行时依赖只含身份判定所需的最少模块」。
  - 现有运营面写授权用的 `OperationsOwnerScopeGrant` 在 organization 模块的 API 里（`modules/organization/src/main/java/com/catering/v2s/organization/api/OperationsOwnerScopeGrant.java`）；organization 以 api 方式带上 audit-model、execution-context、extension（`modules/organization/build.gradle.kts` 第 6–9 行），extension 又依赖 platform-admin-iam（`modules/extension/build.gradle.kts` 第 6–9 行）。
  - 详设没写 terminal-binding 能依赖哪些模块。沿用现有写法，这些模块都会随 terminal-binding 进入 TDS 的运行时类路径。
  - 同族：`activateOrReplay(candidate, ...)` 的 `candidate` 类型归属仍未写明；由第 268 行「terminal-binding 不依赖 store-terminal」可以推出它不能是 store-terminal 的类型。
- **影响**：方案 B 的核心理由「TDS 运行时最小」没有判据保护。
- **验收判据**：
  - 详设列出 terminal-binding 允许的模块依赖；
  - 给出 TDS `runtimeClasspath` 的判据：不含 store-terminal、organization、catalog、asset、extension、platform-admin-iam 与对象存储客户端，并配一条红夹具（例如让 terminal-binding 依赖 organization，检查失败）；
  - 写明 `candidate` 的类型归 terminal-binding。
- **Dexter 裁决**：不需要。

### N 级

- **R2-N1 256 KiB 的算法没有计入 zlib 状态**（详设第 209 行，计划第 29 行）：
  - 服务端压缩器用 15 位窗口、memLevel 8（Netty 握手器第 134–140 行的缺省）。按 zlib 的内存公式，仅 deflate 状态就约 256 KiB，inflate 约 32 KiB 加少量状态；表里的「两个 32 KiB 窗口」只是 LZ77 窗口大小。
  - 详设把它当作「payload/context reservation」，并另说要实测 zlib 开销，口径含混。V-S14 的「bounded allocation」也没有定义怎么测、上界多少。
- **R2-N2 未认证连接上限没有数值**（详设第 331、739 行，计划第 29 行）：
  - 需求 R-4.2 与 §10 写明「上限由详设定」。详设改成必填、缺值即拒绝启动的部署键 `V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS`，但没给数值，也没给推导依据；DEV 启动时只能由实施者自己定。
  - 是否需要做成必填键、计入冻结的跨层环境键，还是用缺省值加可选覆盖，由 Dexter 按一贯偏好判断。
- **R2-N3 decision 的几处行号与口径**：
  - §6.2 把「只改占位措辞」挂在 `AGENTS.md` 第 41–48 行下，但占位措辞在第 56 行（「`apps/backend/terminal-data-server` 是未来 TDP 的空占位」），不在所列范围；
  - §6.2 说第 83 行「already allows the approved TDS domain group」，第 83 行只把 backend-acceptance 描述为「真实 HTTP」，没有提到 TDS 或 WebSocket；
  - front-matter 对 app-layout ADR 的锚点是整篇的一级标题，等于整篇取代，而 §6.1 说只取代第 14–17 行；
  - 第 81 行说同步改写「only after Dexter accepts this decision」，但验收场景规范已在 decision 仍为 PROPOSED 时改过（本轮已逐行核对该文件的改动）。
- **R2-N4 计划与 D-34 不一致**：计划第 120 行写「separately authorized reset/seed path」。D-34 写明批次内的工作不需要再授权；这里应是进入条件，不是授权。
- **R2-N5 计划与详设对工作线程的写法不一致**：计划第 29 行写「one bounded worker pool」，详设第 333 行是四个具名调度器（db、log、identity、codec）。
- **R2-N6 模板残留**：
  - §3a 仍不是模板的逐控件九列表；E01 以键列表给出，缺实际动作节点与 L2 binding 两列。新增的只读控件已写明节点与观测方式；
  - §4 缺每个 CP 的不变量、FORBID、RECALL；
  - §10b.6 写成了团队分工，模板要的是 seed 前提、父流程位置与 seed 角色（本批不新增 seed 步骤与角色，写「N/A 加理由」即可）；
  - §12「未决项处置」表仍没有，而依赖解析图、BlockHound 版本与 JDK 参数、未认证上限数值都是推到实施期的未决项；
  - §14 自报全部 PRESENT。
- **R2-N7 IA 与交互工件没有声明 E01 的只读观测键**：详设 §3a 与 Journey 第 82 行都写了 `TERMINAL_DEVICE_TYPE_READONLY`，IA 第 65 行的 `accessibilityAndTestId` 与交互工件都没有。同一事实在两份文档里应一致。
- **R2-N8 运营面取消激活的错误集含一个到不了的码**：详设第 189 行列了 404 `STORE_TERMINAL_STORE_VOIDED`。按现有顺序，`requireStore` 对任何非 ENABLED 门店（含作废）先给 403（`StoreTerminalOwnerService.java` 第 856–860 行；门店查找不过滤状态）。两者只能留一个，并写明顺序。

## 4 · D-18 的 UI 强制自问

1. **来自用户的明确要求**：是。D-18；D-24 免单独确认。
2. **是否合逻辑**：合逻辑。编辑时看得到类型，因为它决定哪些功能可选；新建照常可选。
3. **更短的路径**：只读文本已是最短。
4. **不合理之处的来源**：上轮的「owner 可区分拒绝」旧措辞已统一掉；本轮没有新增附加解释物。只剩观测键在 IA 与交互工件里没有声明（R2-N7）。

## 5 · 已核实的事实

- **Q1～Q14 可复现**：按详设原样复跑（ripgrep 15.2.0），命中集合全部一致：Q1 46 条、Q5 12 条、Q14b 29 条等。
- **E01 键集合**：详设第 105–106 行的 29/17 键与 `contracts/policy/store-terminal-l2-scenarios.json` 的 TER-L2-E01 逐项、逐序一致。
- **Reactor Netty 1.3.7 / Netty 4.2.17**：
  - Reactor Netty v1.3.7 存在，`WebsocketSpec.Builder.maxDecompressionBufferSize(int)` 存在（上游 `WebsocketSpec.java` 第 161 行），构建默认 Netty `4.2.17.Final`，所属 Reactor BOM 为 2025.0.7。
  - 解压上限经 `PerMessageDeflateServerExtensionHandshaker` 传给 `DeflateDecoder`，在 `ZlibCodecFactory.newZlibDecoder(ZlibWrapper.NONE, maxAllocation)` 中按帧限制解压输出（Netty 4.2.17 `DeflateDecoder.java` 第 111–118 行）。分片累计要靠详设的累加器另外兜住，详设已写。
- **关闭码可以由应用决定**：Reactor Netty 1.3.7 遇到解码异常时，`ChannelOperationsHandler.exceptionCaught` → `onInboundError` 只把错误交给接收流，不自己发关闭帧（`ChannelOperationsHandler.java` 第 149–157 行，`ChannelOperations.java` 第 537–539 行）。应用捕获后可以按 1009 关闭；若让错误外抛，出站错误路径会发 1002（`WebsocketServerOperations.java` 第 216–223 行）。
- **pgjdbc**：上游 REL42.7.7 的 `PGConnection.java` 第 76 行已声明 `getNotifications(int)`。
- **Spring Boot 4.1.0 的版本清单**：Netty `4.2.15.Final`、Reactor BOM `2025.0.6`、PostgreSQL 驱动 `42.7.11`；Spring Framework `7.0.8`。
- **surfaceForm 与设备类型**：`laptop`/`mobile`，与 `contracts/catalog/store-terminal-rules.json` 一致。
- **D-39**：与 `AGENTS.md` 第 37 行逐项一致。

## 6 · TEMPLATE_COVERAGE

- **实施详设模板**：
  - 有：§0、§1、§2、§3、§5、§6、§7、§8、§9、§9a、§9b、§10、§10b.1～.5、§11、§13、§13b、§13c；
  - 有，但不合格式：§3a（R2-N6）；
  - 缺一部分：§4（R2-N6）；
  - 理解错：§10b.6（R2-N6）；
  - 缺：§12 未决项表（R2-N6）；
  - 自报不成立：§14。
- **IA 模板**：D-18 有；E01 只读观测键缺（R2-N7）。
- **交互工件模板**：D-18 有；与详设一致；观测键缺（R2-N7）。
- **Journey 模板**：有（前提链、禁推、禁止伪修复、UI 适用性、裁决）。
- **实施任务模板**：三答、步骤级对账、6b、6c、四项准入、运行纪律、两行状态、13c、逐代码对账都有；但顺序与标定的关系有矛盾（R2-M1）。

## 7 · 未能核实（L3_UNVERIFIED）

- 当前字节上 `scripts/verify` 的实际首败：没有运行。详设与计划都写明本轮没有运行。
- 浏览器（Expo Web）是否对每条消息都压缩，从而与「AUTHENTICATE 必须 RSV1=0」冲突：未取一手资料，属批次二以后。
- JDK 自带 zlib 在 15 位窗口、memLevel 8 下的实际内存：按 zlib 公式推算，未实测。
- 在远端 Docker 主机上用 Testcontainers 暂停容器的具体行为，以及 Hikari 的 `validationTimeout` 与 2 秒 `connectionTimeout` 的交互：属外部推论。
- E01 只读文本的实际渲染与可聚焦性：要到 L2 才能证明。

## 8 · 需要 Dexter 裁决或知悉

1. **R2-S2**：只在详设选择「默认报价不压缩」时需要裁决；推荐服务端单方面要求无上下文接管，RFC 7692 允许，也能保住 D-37 的实际效果。
2. **R2-N2**：未认证连接上限用必填部署键，还是缺省值加可选覆盖。
3. **R2-S4**：若保留摘要冲突作为新的拒绝原因，由 Claude 修订需求 R-1.4。
4. decision 修订后由 Dexter 确认从 PROPOSED 转为已接受，这一步尚未发生；本轮核对 decision 全文，没有把它写成已接受。

## 9 · 会话出处与授权边界

- 续接会话。按 Dexter 的要求，本轮全部由 Claude 主会话审查，没有独立子 agent 的结论。先派出的三个子 agent 在读完材料前已停止，中间结果没有采用。
- Claude 是需求正本的作者：D-37、D-38、D-39 都由 Claude 按 Dexter 的裁决写入需求正本。
- 本轮只新写了这一份评审文件。Codex 的请求写明「不修改需求或其他文件」，这份文件是 CLAUDE.md 允许的评审交付物。
- 全程只做只读检索与解析；外部事实用 curl 取上游按版本标签的源码与 RFC 原文，下载到会话临时目录。没有运行构建、测试、生成器、`scripts/verify`、DEV、Testcontainers、reset、seed、L2、UAT 或任何数据操作。
- 本结论只是评审结论，不扩展 Codex 的工作范围，不授权任何实施或运行；各条 finding 是交 Codex 复核的输入，不自动成为权威。
