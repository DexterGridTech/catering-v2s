# TDS 第三方库官方用法审计

```text
REVIEW_KIND=IMPLEMENTATION_INPUT_AUDIT
SCOPE=apps/backend/terminal-data-server 全部生产代码、测试代码、其启动的 terminal-ws-wire-client.mjs，以及影响该包的 Gradle 插件配置
AUTHORITY=本任务中 Codex 主 agent 只读核验官方资料并独立完成修正；未委托子 agent
EVIDENCE=官方版本文档、发布源码、当前 TDS 源码和 Gradle 已解析依赖图；本记录不声称测试通过
THIRD_PARTY_SOURCE_AUDIT=CLOSED
DYNAMIC_TDS_PROOF=NOT_RUN_BY_THIS_AUDIT
```

## 结论

逐项检查 TDS 生产/测试源码、wire client 和 build 配置中会影响协议、资源、安全、线程、生命周期、可执行包或验证结果的第三方行为。以下是核实后已经完成的修复与选择。此版本/来源复核完成后才继续下一次验证；历史运行仍按原字节和证据档位记录：

1. Netty 的 `maxAllocation` 限制单次解压缓冲，不限制一条 WebSocket 消息跨多块的解压总量；标准解码器能把多个解压块组合后交给下游。TDS 已将累计上界放进 `TdsBoundedPmdDecoder`，在每次 inflate 输出时检查，并让 `WebSocketFrameAggregator` 再限制完整消息。
2. JDK `Inflater.needsInput()` 只说明当前输入缓冲耗尽，不表示内部解压输出也已排空。原循环在输入耗尽时过早停止；已改为只有 `inflate()` 返回零且确需更多输入时才停止，并补充 30,000 字节、多输出块的 focused 回归用例。
3. Jackson 3.1.4 的默认文档长度和 token 数不限，不适合直接处理不可信帧与 PostgreSQL 通知。已使用独立的 TDS wire mapper 设置文档、token、嵌套深度、字符串、字段名和数字长度上限，并拒绝重复字段与尾随 JSON。
4. Jackson 的 `maxDocumentLength` 计数取决于 parser 输入源。TDS 两处使用 `readTree(String)`，该值限制字符数而非 wire bytes；已更正常量名与设计描述，实际报文和通知仍各自在进 JSON parser 前受 byte cap 限制。
5. TDS raw Node client 还导入 `node:path` 与 `node:url`；远端预检原先只确认部分模块。已把 preflight 和配套结构检查扩展为精确验证 client 导入的全部七个 core modules。
6. Reactor 队列容量按 backing-thread 数乘每线程 cap 推导；详设、计划与 README 指向的审计现记录四个 worker 的实际公式及 DEV 上限。
7. JUnit 6 adapter 的解析图请求 JUnit Platform 6.1.3，而 Boot 4.1.0 管理 6.0.3。改用 ArchUnit core 1.4.1 在标准 Jupiter `@Test` 中执行规则；这复用现有 core 版本并避免非必要的 JUnit adapter/engine 版本组合。
8. 主动核验了 WebSocket outbound 队列取消路径：Reactor Core 3.8.7 的 unicast sink 在 subscriber 取消时清空队列并按订阅 Context 发出 discard；Spring `WebSocketMessage` 的 `release()` 负责释放底层 `DataBuffer`，而 `DataBufferUtils.release()` 检查 pooled buffer 是否仍 allocated。原连接流没有 discard hook，等待发送的引用计数消息可能泄漏。已在 `TdsWebSocketConnection.outboundMessages()` 加 `doOnDiscard(WebSocketMessage.class, WebSocketMessage::release)`，并新增零需求后取消、断言 Netty `ByteBuf.refCnt()` 归零的回归用例；该测试已加入 `tds-constructor-assembly` 的 Gradle 选择。本审计没有运行该测试；它留给 CP-05 focused proof。

TDS Java 源码与测试的 import 全量扫描未发现审计分组以外的第三方包根。审计范围内唯一的 Node 进程导入七个 `node:` 内置模块；不导入 Undici 或 npm 包。可复现反向清单扫描：

```sh
rg --no-filename '^import ' apps/backend/terminal-data-server/src/main apps/backend/terminal-data-server/src/test/java \
  | rg -v '^import (static )?(java\.|javax\.sql\.|com\.catering\.v2s\.|org\.springframework\.|org\.postgresql\.|org\.slf4j\.|io\.netty\.|reactor\.|org\.reactivestreams\.|tools\.jackson\.|org\.junit\.|org\.assertj\.|org\.mockito\.|com\.tngtech\.)'
```

该命令无命中。它只排除 JDK、仓内包和表中逐项核验过的外部 API 根；不是对字节码、Gradle 传递依赖或运行时拓扑的断言。

Netty 压缩输出过滤也已落实详设选择：服务端数据消息小于 128 字节时跳过压缩，128 字节及以上压缩；WebSocket opcode 控制帧始终不压缩；已协商的客户端压缩数据始终允许解压。小型 JSON `PONG` 因而保持明文。此阈值是实现选择，不改变共享协议语义。

本轮核对了根 `build.gradle.kts` 作用于 TDS 的 Spotless/Palantir/PMD 配置及 TDS 自己应用的 Spring Boot 与 dependency-management 插件；插件版本、调用点和来源列于下方。所有直接 imports、未 import 的全限定名引用、Node core imports、行为相关传递库、构建插件和实际解析的 runtime/test 依赖均已分类。官方库语义核对与本仓动态装配/业务通过仍分开记录；本报告不把历史运行升级为当前字节证据。

## 已解析依赖版本

来源：`apps/backend/terminal-data-server/build.gradle.kts` 与只做依赖解析的 `./gradlew --offline :apps:backend:terminal-data-server:dependencies --configuration testRuntimeClasspath`。解析成功不等于编译或测试成功。

| 用途 | 已解析版本 |
| --- | --- |
| Spring Boot / Spring Framework | 4.1.0 / 7.0.8 |
| Reactor BOM / Core / Netty HTTP 与 Core | 2025.0.7 / 3.8.7 / 1.3.7 |
| Reactive Streams API（测试 `BaseSubscriber` 的订阅参数类型） | 1.0.4 |
| Reactor Pool | 未选入 runtimeClasspath 或 testRuntimeClasspath；BOM 管理约束为 1.2.7，但没有依赖边选择该 artifact，TDS 源码也不导入其 API |
| Netty | 4.2.18.Final（TDS 专属 BOM） |
| Jackson Core / Databind | 3.1.4 |
| Jackson annotations（Jackson 3 运行时使用） | 2.21 |
| terminal-binding 传递带入、TDS 未直接调用的 Jackson 2 Core / Databind | 2.21.4（annotations 2.21） |
| pgJDBC | 42.7.11 |
| HikariCP / SLF4J API | 7.0.2 / 2.0.18 |
| Boot/Spring 间接运行支持：Logback classic/core、Log4j-to-SLF4J、JUL-to-SLF4J、Commons Logging、SnakeYAML | 1.5.34 / 1.5.34 / 2.25.4 / 2.0.18 / 1.3.6 / 2.6 |
| Spring 间接运行支持：Micrometer observation/commons | 1.17.0 / 1.17.0 |
| 测试：JUnit Jupiter / AssertJ / Mockito / ArchUnit core / BlockHound | 6.0.3 / 3.27.7 / 5.23.0 / 1.4.1 / 1.0.17.RELEASE |
| 测试：Spring Boot Test / Spring Test / Netty EmbeddedChannel | 4.1.0 / 7.0.8 / 4.2.18.Final |
| 测试运行：JUnit Platform Launcher | 6.0.3 |
| Gradle wrapper / PMD 工具 | 9.7.0 / 7.17.0 |
| 构建插件：Spring Boot Gradle / dependency-management / Spotless Gradle / Palantir Java Format | 4.1.0 / 1.1.7 / 7.0.2 / 2.39.0 |
| 构建插件 classpath 的 Commons IO 强制选择 | 2.22.0（Gradle buildscript resolution override；不是 TDS production/test API） |
| 运行时 | Java 21；远端 wire client 固定 Node 22.23.2，仅使用 Node 内置模块 |

2026-09-28 当前字节分别执行 `./gradlew --offline --no-daemon :apps:backend:terminal-data-server:dependencies --configuration runtimeClasspath` 与同命令的 `testRuntimeClasspath`，两者均 `BUILD SUCCESSFUL`。runtime 图选中 Boot 4.1.0、Framework 7.0.8、Reactor Netty 1.3.7、Reactor Core 3.8.7、全体 Netty 4.2.18.Final、Jackson 3.1.4、pgJDBC 42.7.11、HikariCP 7.0.2、SLF4J 2.0.18；test 图另选中 Boot Test 4.1.0、Spring Test 7.0.8、JUnit Platform/Jupiter 6.0.3、AssertJ 3.27.7、Mockito 5.23.0、ArchUnit core 1.4.1、BlockHound 1.0.17.RELEASE 与 EmbeddedChannel 的 Netty 4.2.18.Final。两个图都没有 `io.projectreactor.addons:reactor-pool`。其中 Spring Boot 依赖请求 Reactor Core 3.8.6、Reactor Netty 1.3.6 与 Netty 4.2.15/17，但 TDS 局部 BOM/版本选择将实际解析结果提升为上表版本。

Reactor BOM 行只记录约束，不把约束本身误报成已选依赖。此前旧的 `runtime-classpaths.txt` 于 2026-09-27 23:19 KST 生成，包含 Reactor Pool 与 Netty 4.2.17；它早于 TDS Netty BOM 改为 4.2.18 的当前构建字节，必须视为过期。此前 classpath guard 因该旧图/旧期望报 `TDS_RUNTIME_VERSION_MISMATCH:io.projectreactor.addons:reactor-pool:1.2.7`。根因已在 owning source 修正：guard 与 acceptance launcher 不再要求不存在的 Pool artifact；当前版本通过上面两条 dependency report 证明，而不是复用旧报告。修复后的 `verifyBackendAcceptanceRuntimeClasspaths` 尚待本轮复验。

表中列的是源码实际调用的第三方 API 和 TDS build 实际配置的第三方插件；Spring Boot 测试 starter 带来的未直接调用传递依赖不逐个伪列为 API 用法。业务后端与 TDS 的类路径仍按详设隔离。

ArchUnit 调整后另作三项只读依赖解析：`dependencyInsight --configuration testRuntimeClasspath --dependency com.tngtech.archunit:archunit` 选择 `archunit:1.4.1`；`... --dependency org.junit.platform:junit-platform-engine` 选择 `6.0.3`；`... --dependency org.slf4j:slf4j-api` 选择 `2.0.18`（ArchUnit 1.4.1 请求的 2.0.17 由 Boot 4.1.0 升至 2.0.18）。三项 Gradle dependencyInsight 均 `BUILD SUCCESSFUL`；未调用 compile、test、服务或受管运行任务。

日志与 YAML 的解析来源另用 runtime `dependencyInsight` 核对：Commons Logging 1.3.6 由 Spring Core 7.0.8 请求（请求 1.3.5，被当前 dependency-management 选择升至 1.3.6）；`log4j-to-slf4j:2.25.4`、`jul-to-slf4j:2.0.18`、`log4j-api:2.25.4`、`snakeyaml:2.6` 均由 Boot 4.1.0 starter 路径带入；`log4j-slf4j2-impl` 查询无匹配依赖。以上五个有命中的 dependencyInsight 及反向桥的空结果均为 `BUILD SUCCESSFUL`。`rg --files apps/backend` 与脚本/资源文本搜索未发现 `commons-logging.properties`、JCL factory service provider、`log4j-slf4j2-impl` 或 `slf4j-jdk14` 配置；这与精确发布源码展示的默认发现路径一致。

## 生产 API 用法核对

| 库与本仓用法 | 官方语义 / 最佳实践 | 当前实现与处置 |
| --- | --- | --- |
| Gradle 构建插件：TDS 应用 Spring Boot Gradle plugin 与 dependency-management plugin；根构建把 Spotless/Palantir formatter 配置应用于全部 Java 子项目 | Boot Gradle plugin 与 Java plugin 配合生成可执行 `BootJar`；dependency-management 插件的 `imports.mavenBom` 管理未写版本的依赖；Spotless 把配置的 formatter steps 用于检查/格式化其 target 集合 | 根 buildscript 固定 Boot plugin 4.1.0、dependency-management 1.1.7；TDS 明确导入 Reactor 2025.0.7 与 Netty 4.2.18 BOM 并固定 `bootJar` main class/文件名。根 Spotless 7.0.2 对 Java 子项目使用 Palantir Java Format 2.39.0；未依赖这些插件的未记录默认行为来实现运行时逻辑。格式门实际结果在 execution-status 记录。 |
| Gradle PMD 插件与 PMD Java 规则：根构建把 Gradle `pmd` plugin 配置应用于 Java 子项目；TDS 选择 `PreserveStackTrace` | Gradle 9.7.0 的 PMD plugin 为生产/测试 source set 建立 `pmdMain`、`pmdTest`，并把 PMD tasks 接入 Java `check`；PMD 7.17.0 规则保留 catch 到的原异常因果链，不只保留 message | 根构建固定 PMD 7.17.0、只加载 `tools/verify-gates/preserve-stack-trace.xml` 并 fail-on-violation；该 ruleset 只引用 PMD 内置 `category/java/bestpractices.xml/PreserveStackTrace`。TDS 的普通 `check` 触发其 `pmdMain` 与 `pmdTest`；特定 `backendPmdPreserveStackTrace` 任务只显式列业务后端，所以不把那一任务误记成 TDS PMD 证据。 |
| Spring Boot / Spring WebFlux：`TerminalDataServerApplication` 显式 `REACTIVE`；`TdsWebSocketHandler` 使用 `WebSocketSession`；`TdsRuntimeProperties` 绑定启动配置；listener/writer/shutdown 由 `SmartLifecycle` 管理 | 明确选择 Web 应用类型可避免 classpath 推断歧义；阻塞 JDBC 应离开 Netty event loop；异步 `SmartLifecycle.stop(Runnable)` 必须在实际停止后回调，phase 控制启动/关闭顺序 | `TerminalDataServerApplication` 显式选择 `REACTIVE`；JDBC 由专用有界 scheduler 承载；listener、状态 writer、关闭流程在相应停止工作结束时完成 lifecycle callback。启动/停止重点需由 focused 与受管进程证据确认。 |
| Spring Boot configuration binding / dependency injection：`@ConfigurationProperties` record、`@DefaultValue`、`@EnableConfigurationProperties`、构造器注入、`@Qualifier` 与窄用途 `@Value` | 类型化配置集中绑定；不可变配置在启动期验证；`@DefaultValue` 只在 property 缺失时使用；限定符用于消除同类型 bean 歧义 | 连接/容量值先绑定到 `TdsRuntimeProperties` 并由 `TdsRuntimeSettings.from(...)` fail closed 验证；`@Value` 仅用于 acceptance gate 的 Unix socket/环境接线。Spring `@Bean`/`@Component`/`@Repository` 为常规构造器装配，无字段注入或静态容器查找。 |
| Spring Boot availability：`AvailabilityChangeEvent.publish(..., ReadinessState.REFUSING_TRAFFIC)` | ReadinessState 是可发布的流量可用性信号；它不会代替应用自己的准入控制 | graceful shutdown 先让 `TdsTerminalSessionActors` 拒绝新会话，再发布 `REFUSING_TRAFFIC`，随后等待有界 drain 并完成 stop callback；readiness 与连接准入各自有明确 owner。 |
| Spring WebFlux 路由与 WebSocket handshake：`WebFluxConfigurer`、`SimpleUrlHandlerMapping`、`WebSocketService`、`HandshakeWebSocketService`、`ReactorNettyRequestUpgradeStrategy` | WebFlux 通过显式 handler mapping 与 WebSocket service/upgrade strategy 适配器接入服务器；需要 Reactor Netty 特定配置时使用明确 upgrade strategy，而非 classpath 自动探测 | TDS 只注册 `/tdp/*/ws` handler；显式注入 Reactor Netty strategy 与自定义 WebSocket spec，使压缩协商和 frame 上限由 TDS Netty pipeline 管理。handler 返回覆盖 receive、send 与 heartbeat 的 `Mono<Void>`，由 WebFlux 负责订阅和生命周期。 |
| Spring WebSocket 消息所有权：接收消息在异步编解码/数据库操作前 `retain()`，完成或取消时 `release()`；发送失败释放消息，发送队列取消时清理被丢弃元素 | `WebSocketMessage` 的底层 payload 可引用计数；异步越过接收回调时须延长生命周期，恰好释放；Spring `WebSocketMessage.release()` 调 `DataBufferUtils.release()` | `TdsWebSocketHandler` 在 offload 前 retain，`doFinally` 释放；`TdsWebSocketConnection` 在 sink 拒收时释放，并在 sink 流的上游用 Reactor `doOnDiscard` 释放取消清队列时被丢弃的消息。新 focused 回归源断言 queued payload 在取消后 `refCnt()==0`；待完整第三方审计结束后执行。 |
| Spring `DataBuffer` / Netty adapter：测试构造 `WebSocketMessage` 时使用 `NettyDataBufferFactory`，生产接收 payload 经过 Spring WebSocket adapter | pooled `DataBuffer` 的 retain/release 明确影响底层 Netty reference count；`NettyDataBufferFactory` 是给定 `ByteBufAllocator` 的 adapter | 测试使用 Netty allocator 构造 payload 并显式检查引用计数；生产代码按 WebSocket message 所有权边界 retain/release，不把 Spring buffer 交给多个异步消费者。 |
| Spring Boot Test / Spring Test：`ApplicationContextRunner` 与 `SystemEnvironmentPropertySource` 构造配置绑定与条件 bean 的小型测试上下文 | Boot 4.1 的 runner 面向非 Web context，适合在不启动服务、不连接外部设施的情况下描述一组配置并断言 context 内容；`SystemEnvironmentPropertySource` 使用环境变量兼容名称查找；runner 在回调后关闭 context | TDS 设置和协议配置测试只用 runner 检验本地 Spring 装配；WebFlux 应用类型、真实 server pipeline 和 DB 行为由独立装配/受管 proof 验证，不以 runner 代替。 |
| Spring JDBC：`JdbcTemplate` 参数化查询/更新、`RowMapper` 与批量 heartbeat 写入 | Spring 7.0.8 的 `JdbcTemplate` 在配置后线程安全，负责 JDBC 核心资源工作流和 `SQLException` 转换；查询值通过参数绑定，结果由 `RowMapper` 提取。连接仍由 `DataSource`/池提供，调用是阻塞的 | Repository 使用固定 SQL 与绑定参数，不拼接不可信值；TDS listener 的 JDBC 连接由单个阻塞 worker 独占，异步 WebSocket 线程不直接执行 JDBC。动态 SQL 仅构造有限数量的 `VALUES` 占位符并独立绑定每个值。 |
| Spring URI：`UriUtils.decode(rawPathSegment, UTF_8)` | `UriUtils` 按 RFC 3986 解码 `%xy`，保留未编码字符；非法编码会抛 `IllegalArgumentException`。它不是 HTML form decoder，`+` 不被改成空格 | handler 先按 raw path 分段并验证固定 `/tdp/{key}/ws` 形状，再单独 percent-decode key，最后按业务 key 闭集校验；非法编码失败关闭，不把解码后的斜杠作为路由分隔符。 |
| Reactor Core：四个独立 `newBoundedElastic`（DB、日志、身份、codec）；单连接单播 `Sinks.Many`，其他控制信号用 `Sinks.One` / latest replay sink | `newBoundedElastic(threadCap, queuedTaskCap, ...)` 的任务队列上限是每个 backing thread；总排队上限按 `threadCap × queuedTaskCap` 推导。自定义单播队列必须满足生产者并发语义；`tryEmit*` 必须检查结果 | U=`maxUnauthenticatedConnections`，C=`max(1,min(U,availableProcessors))`。DB=`(U+2)×(U+2)`，身份=`U×U`，codec=`C×C`，日志=`C×1024` 是各自理论最大排队任务数；DEV 的 U=4 时分别为 36、16、最多 16、最多 4,096。四个 named scheduler 均由 Spring `destroyMethod=dispose` 释放。连接发送使用容量 1 的 `ArrayBlockingQueue`，生产与完成在同一 monitor 串行化，所有 `EmitResult` 均处理并释放拒收消息。 |
| Reactor Netty：请求升级策略、WebSocket server spec、`doOnConnection` 安装 pipeline | WebSocket 扩展开关、最大 frame payload 应通过版本 API 配置；应用要在原始 Netty header/ReactiveBridge 边界挂载协议控制，不能假定 Spring `WebFilter` 修改后仍影响 Reactor Netty 握手 | 使用 `ReactorNettyRequestUpgradeStrategy`、`compress(false)` 与 65,536 字节帧上限；只通过 TDS 的原始请求头 gate 和 Netty extension handler 协商压缩。安装点及顺序已在详设明确。 |
| Netty WebSocket / PMD：generic extension handler、PMD handshaker、encoder filter、frame aggregation、reference-counted buffers、EmbeddedChannel | Convenience compression handler 同时注册 PMD 与 legacy `deflate-frame`；filter 能逐帧决定跳过；压缩中的 continuation 必须保持同一消息决定；`maxAllocation` 是解压缓冲上限，不是累计消息上限；extension handler 还存在版本相关的未认证 pipelining 风险。已检查 Netty `WebSocketExtensionUtil.extractExtensions`：release 源码直接按逗号/分号拆分，并把参数放进 Map，重复键会被覆盖，不能用于严格拒绝本需求中的重复/畸形 offer。 | 锁定 Netty 4.2.18.Final（GHSA 修复版本）；仅注册 PMD。`TdsPmdMessageFilterProvider` 对 <128 字节起始 data frame 跳过，对大消息压缩；Netty continuation state 保证分片一致；入站 decoder 不跳过协商后的压缩帧。原始 offer 使用仓内限定语法的严格解析器，原因是 Netty helper 会丢失本需求校验重复项所需的信息；扩展协商和编码仍由 Netty 执行。累计限制由自有有界 inflater 与 aggregator 实施。自有 decoder 只承担 Netty API 未提供的累计上界，不复制握手或编码器。 |
| JDK 21 `Inflater(true)`：RFC 7692 raw DEFLATE payload 解压、同步刷新尾部、无上下文接管 | `needsInput()` 只表示输入缓冲为空；调用方应根据 `inflate()` 实际输出与零输出状态继续循环；`nowrap=true` 要使用 WebSocket 所需的 raw stream 处理方式；native inflater 必须 `end()` | 已修复提前停止：持续取出 8 KiB 分块，直到一次调用返回零且 `needsInput()` 为 true；分片间保留状态，消息终止后 reset，channel 移除/关闭时 end。超限在输出写入前拒绝。包含多输出块输入的四个 compression focused XML 合计 19/19 通过；详见本报告当前证据与 CP-05 对账，不能替代远端 wire proof。 |
| Jackson 3：`ObjectMapper` / `JsonNode` 解析协议、`JsonFactory` 与 `StreamReadConstraints` | 默认 `maxDocumentLength` 和 `maxTokenCount` 不限；`maxDocumentLength` 以输入 source 的单位计数（byte source 为 bytes、String/char source 为 chars），必须与调用的 parser overload 一起说明。`ObjectMapper` 在首次使用前完成配置后可安全共享；约束应放在专用 factory，避免改全局 mapper 影响其他消费者 | `TdsWireJsonConfiguration` 专为终端帧与通知载荷建立有限 mapper，装配完成后只读共享；TDS 报文先受 WebSocket 65,536-byte 上限、PG 通知先受 7,900-byte 上限；进入 `readTree(String)` 后 Jackson document 上限为 65,536 chars，另限 32 tokens、depth 2、字符串 128、字段名 64、数字 128；严格拒重名与尾随内容。静态协议资源继续使用受信 mapper 的 `rebuild()` 副本，仅打开重复键拒绝。 |
| pgJDBC：独占 listener `Connection`，`LISTEN`、`PGConnection.getNotifications(timeout)`、backend PID、取消激活通知 | pgJDBC 明确不保证 Connection 线程安全；`getNotifications(int)` 是阻塞等待，可用 timeout 周期性唤醒 | 监听连接由一个 db scheduler 任务独占，不与查询池连接共享；通知等待最多 1,000 ms，健康探测每 10 s，通知 payload 先做字节上限与 Jackson 受限解析。数据库 I/O 错误映射与恢复由 TDS 设计规定。 |
| HikariCP：Spring Boot JDBC 自动配置与池获取超时 | 固定大小池应使用清晰上限；Hikari `minimumIdle` 默认跟随 `maximumPoolSize`，官方建议固定池不要重复配置 minimumIdle；connection timeout 控制等待池连接时长 | TDS 不绕过 Boot 自行创建第二个池；获取超时是 2 s，并由配置/受管启动证据核实实际 pool。 |
| SLF4J 2.0.18：参数化日志经异步 logger scheduler | 传统 `{}` 参数化接口是 SLF4J 官方支持的常用入口；2.x 另提供 fluent event/key-value API。敏感数据不应写入日志 | TDS 当前遵循参数化 API，并把脱敏 `event=... key=value` 内容写为 message；本审计不把它描述为 SLF4J fluent structured arguments。日志队列有界，拒绝计数另行记录，不记录凭证、secret、payload 或 JDBC 异常消息。 |
| Spring Boot 日志实现与桥接：starter logging 选择 Logback；Spring Framework 经 Commons Logging API；Log4j API 与 JUL 分别可桥接到 SLF4J | Boot 4.1.0 的版本源码按 classpath 选择 Logback，并以默认 ConsoleAppender、INFO root level 配置；`LogbackLoggingSystem` 只在 JUL root 没有 handler 或仅有一个 `ConsoleHandler` 时安装 `SLF4JBridgeHandler`。Commons Logging 1.3.6 的默认发现器在看到 `log4j-to-slf4j` 提供的 `SLF4JProvider` 标记时选择其 `Slf4jLogFactory`；Log4j-to-SLF4J 将 Log4j API 调用转入 SLF4J。SLF4J 官方说明 JUL bridge 对 disabled 日志也可能产生转换成本；Boot 默认 Logback 初始化会在 bridge 已安装时加 `LevelChangePropagator` 并设 `resetJUL=true`，将 Logback level 同步到 JUL，降低该成本。 | runtimeClasspath 解析出 Logback classic/core 1.5.34、Log4j-to-SLF4J 2.25.4、JUL-to-SLF4J 2.0.18 与 Commons Logging 1.3.6；dependencyInsight 显示 Commons Logging 由 Spring Core 7.0.8 请求、Log4j/JUL 桥由 Boot starter logging 带入，`log4j-slf4j2-impl` 反向桥不存在。仓内 TDS、terminal-binding 和其资源中没有 Commons Logging factory 覆盖配置；TDS 源码无 Logback/Log4j/JUL/Commons Logging API 调用，也无自定义 Logback 配置；TDS 业务日志走 SLF4J 参数化 API 与有界异步队列。JUL bridge 的安装是 Boot 启动时的条件行为，不以 classpath 中存在 JAR 推断为每次都安装。 |
| Spring Boot YAML 加载：starter 带入 SnakeYAML 2.6，读取仓内 `application.yml` | Boot 4.1.0 的 `OriginTrackedYamlLoader` 使用 SnakeYAML `SafeConstructor`，关闭重复 key；该版本还把 collection alias 数设为 `Integer.MAX_VALUE`。SnakeYAML 2.6 `SafeConstructor` 只构造标准 Java 类型。Boot 的 YAML 加载属于部署配置路径，不能拿来解析终端或数据库不可信 JSON | TDS 的 YAML 文件只承载部署配置；协议帧与 PostgreSQL payload 均明确走受限 Jackson 3 JSON mapper。没有直接 SnakeYAML API 调用。此处依赖 Boot 默认 loader；只有当 YAML 输入进入不可信用户边界时才需要另行限定 alias 资源。 |

### 已解析但不是 TDS 直接 API 用法的传递依赖

当前 runtimeClasspath 还带入 `io.micrometer:micrometer-observation`/`micrometer-commons:1.17.0`。TDS 源码没有 Micrometer import、ObservationRegistry bean、Actuator 或自定义 metrics recorder；本报告不把依赖存在误报成 TDS 指标行为。`jakarta.annotation-api:3.0.0`、JSpecify 与 Reactor Netty 带入的 HTTP/2、HTTP/3/QUIC、DNS/native transport 模块同样没有 TDS 源码直接调用或显式开启的行为；Netty 版本由同一 4.2.18.Final BOM 锁定，TDS 只配置 HTTP/1.1 WebSocket 所需的 pipeline。它们是上游模块的运行闭包，具体是否随 BootJar 发布由构建产物/受管运行闭环验证，本审计不声称这些可选功能被启用。

此外，`terminal-binding` 的 Gradle runtime 图传递带入 `com.fasterxml.jackson.core:jackson-core/databind:2.21.4` 与 annotations 2.21。TDS 不导入 `com.fasterxml.jackson`：其启动仅显式 `@Import(TerminalCredentialVerificationApiConfiguration)`，后者只装配 credential-verification service 与 persistence；TDS JSON 实际使用 `tools.jackson` 3.1.4。Jackson 2 的直接调用位于 `terminal-binding` 的 `TerminalBindingOwnerService`，不属于本进程导入的配置和服务路径。它目前仍在 TDS runtimeClasspath 中，是同模块打包带来的未使用传递实现依赖；本轮不改 terminal-binding 的模块发布边界，也不对 Jackson 2 的 TDS 行为作通过声明。

## 测试及 wire-client API 核对

| 库/API | 官方语义 / 本仓用法 | 当前状态 |
| --- | --- | --- |
| JUnit Jupiter 6.0.3 | 自动发现扩展默认关闭，需显式设置 `junit.jupiter.extensions.autodetection.enabled=true` 并通过服务提供者文件注册 | Gradle 测试任务设置该 property；`META-INF/services` 指向 TDS BlockHound extension。 |
| BlockHound 1.0.17 | instrumentation 必须在相关代码执行前安装；其目标是检测 Reactor 非阻塞线程上的阻塞调用，不应靠全局宽泛 allowlist 消除错误 | TDS JUnit extension 在测试前仅安装一次；未配置阻塞豁免；测试故意在 `Schedulers.parallel()` 调用阻塞 API 并断言被检测。 |
| AssertJ 3.27.7 / Mockito 5.23.0 | AssertJ 使用类型化 `assertThat` 断言链；Mockito 使用显式 mock/stub/verify 和顺序验证，不依赖 runner 全局魔法 | 本仓测试均为直接调用；不使用自定义 runner 或扩展行为。 |
| ArchUnit 1.4.1 core | ArchUnit 官方说明其核心测试可与任何 Java 测试框架配合；JUnit integration 只额外提供导入缓存与较少样板。`ClassFileImporter` 配合 `ImportOption.Predefined.DO_NOT_INCLUDE_TESTS` 可明确限制生产输入范围 | 实际依赖图暴露：JUnit 6 adapter 1.5.1 会引入 `junit-platform-engine:6.1.3`，被 Boot 4.1.0 的 6.0.3 管理版本覆盖，形成非必要的跨版引擎组合。改用已解析的 ArchUnit core 1.4.1，并在 JUnit Jupiter 测试中显式导入 TDS 生产包及排除测试字节码；两个架构规则都在普通 `@Test` 中执行，保留正反夹具。 |
| Netty `EmbeddedChannel` | 官方测试 channel 用来确定性驱动 handler、inbound/outbound 与异常事件 | TDS 用它检查 handler 顺序、压缩扩展和 RSV/大小边界；真实 HTTP/WebSocket 互操作仍由受管进程验收承担。 |
| Node 22.23.2 core modules 与 globals：`crypto.createHash/randomBytes`、`net.createConnection`、`zlib.deflateRawSync/inflateRawSync`、`readline.createInterface`、`perf_hooks.performance.now`、`path.resolve`、`url.fileURLToPath`；另用 `Buffer`、WHATWG `URL`、`setTimeout/clearTimeout` 与 `process` globals | `randomBytes` 为 mask/key 的 CSPRNG；`performance.now` 提供单调 deadline 时基；zlib raw DEFLATE 的 `flush/finishFlush` 与 PMD 尾部按 RFC 7692 处理，`maxOutputLength` 限制同步 inflate 的返回输出；同步压缩/解压会阻塞 Node event loop，适用于受控、短生命周期且输入/输出有上界的验收驱动，不适用于 TDS 生产数据面；超时计时器只有在同步工作结束后才可运行，因此真实超时还须在工作前后用单调时钟检查；连接失败应销毁 socket；URL 转本地文件路径使用 `fileURLToPath`。Node v22.23.2 的 [`process` signal events/exit](https://nodejs.org/download/release/v22.23.2/docs/api/process.html) 规定自定义 `SIGTERM` listener 接管默认处理；[`Writable.write` callback](https://nodejs.org/download/release/v22.23.2/docs/api/stream.html) 可用于等待该诊断写入完成，因此客户端只在 stderr 写回调后以 POSIX 常规 `128+15=143` 退出 | 唯一 wire-client 入口为 `scripts/test/terminal-ws-wire-client.mjs:3-9,11-39,52-70,155-269,271-625,626-661,694-846,918-997`。该 client 是远端一次场景进程，inflate 的 `maxOutputLength` 为消息上限 + 1，压缩源由固定测试消息产生；连接、读取、解压均受单场景消息/帧上限，deadline 在阻塞调用前后通过 `performance.now()` 核验。收到 `SIGTERM` 时只写受限场景/阶段、marker、PID/PPID 和退出码，并等待 stderr callback 后退出；业务父进程只接受同一闭格式并在结果、cleanup 摘要中记录信号与 marker，不复制原始输出。远端 Node 版本预检与模块清单位于 `scripts/test/r5-remote-testcontainers.mjs:1289-1328`；配套结构测试比较源码 import 和预检清单。 |
| Reactive Streams 1.0.4 / Reactor `BaseSubscriber`：取消路径 focused test 使用零需求订阅者 | Reactive Streams 的 `Subscription.cancel()` 取消上游；Reactor `BaseSubscriber` 的默认 `hookOnSubscribe` 会请求无界，因此测试必须覆写该 hook 且不调用 `request`，才能真实保留队列项后触发取消/丢弃 | 新增测试直接使用测试类路径已有的 `reactive-streams:1.0.4` 类型，在 `hookOnSubscribe` 不请求元素；加入元素后取消并断言底层 Netty 引用计数释放。用例已纳入 `tds-constructor-assembly`，按真实 sink/订阅行为证明，不等待或模拟队列内部实现。 |

## 详设/计划需保持的判据

- PMD 协商仅支持 RFC 7692；协议握手门读原始 Netty headers。流水线顺序以详设为准：`HttpCodec → TdsPmdOfferGate → TdsPmdCompressionHandler → negotiated decoder/encoder → WebSocketFrameAggregator(65_536) → TdsReservedBitsGate → ReactiveBridge`。
- `maxAllocation` 不得再被称为消息总上限；累计 decoded output 必须在 inflate 过程中受 65,536 bytes 限制，超限 1009，畸形压缩/非法 RSV 1002，且在解析/认证/登记/写库前关闭。
- 内存详设已重算：已知 subtotal 644,100 bytes；1 MiB 上限内的 404,476 bytes headroom 必须由 focused allocation proof 量测封闭，不能写成“未用空间”。宿主 JVM、TLS、socket、kernel RSS 与 FD 预算独立实测。
- Node 版本只固定 Node 22.23.2；删除预检/设计里强制 `process.versions.undici` 的要求。
- Reactor scheduler 队列按每个 backing thread 的 cap 计总值；任何排队上限说明都应同时写 threadCap、每线程 queuedTaskCap、推导后总量。
- `apps/backend/terminal-data-server/README.md` 的目录结构、容量修改方法和压缩策略应与实际源码和详设一致。

## 使用分母与证据边界

源码分母为 28 个 production Java 文件、23 个 test Java 文件；`terminal-ws-wire-client.mjs` 导入 7 个 Node core modules，并使用 Node 的 `Buffer`、`URL`、timers 与 `process` globals。以下按 Java import type 去重统计该 API 面覆盖的源码文件，不把普通 JDK 引用或仓内类型计成第三方 API：

| import 根 | Production：文件数 / type 数 | Test：文件数 / type 数 |
| --- | ---: | ---: |
| `org.springframework` | 18 / 32 | 7 / 12 |
| `org.postgresql` | 1 / 2 | 0 / 0 |
| `org.slf4j` | 10 / 2 | 0 / 0 |
| `io.netty` | 7 / 31 | 6 / 23 |
| `reactor.core` | 14 / 6 | 9 / 4 |
| `reactor.netty` | 2 / 2 | 3 / 1 |
| `tools.jackson` | 4 / 9 | 5 / 2 |
| `org.junit` | 0 / 0 | 21 / 8 |
| `org.assertj` | 0 / 0 | 16 / 1 |
| `org.mockito` | 0 / 0 | 5 / 3 |
| `com.tngtech`（ArchUnit） | 0 / 0 | 1 / 9 |
| `reactor.blockhound` | 0 / 0 | 2 / 2 |
| `org.reactivestreams` | 0 / 0 | 1 / 1 |

上表的成员文件清单（相对 `apps/backend/terminal-data-server/`；不列无第三方 import 的 JDK/仓内类型文件）。为缩短重复路径，`M/` = `src/main/java/com/catering/v2s/terminaldataserver/`，`T/` = `src/test/java/com/catering/v2s/terminaldataserver/`，`A/` = `src/test/java/architecture/`：

| import 根 | Production members | Test members |
| --- | --- | --- |
| `org.springframework` | `M/TerminalDataServerApplication.java`; `M/config/TdsRuntimeProperties.java`; `M/config/TdsSettingsConfiguration.java`; `M/protocol/TdsWireJsonConfiguration.java`; `M/protocol/TerminalConnectionFrameCodec.java`; `M/protocol/TerminalConnectionProtocol.java`; `M/session/SessionRegistrationGate.java`; `M/session/TdsBindingRevocationListener.java`; `M/session/TdsGracefulShutdownLifecycle.java`; `M/session/TdsListenerRecoveryGate.java`; `M/session/TdsTerminalSessionActors.java`; `M/session/TdsTrackedSessionLimiter.java`; `M/state/TdsConnectionStateRepository.java`; `M/state/TdsConnectionStateWriter.java`; `M/websocket/TdsWebSocketConfiguration.java`; `M/websocket/TdsWebSocketConnection.java`; `M/websocket/TdsWebSocketHandler.java`; `M/websocket/UnauthenticatedConnectionLimiter.java` | `A/TdsModuleBoundariesTest.java`; `T/config/TdsRuntimeSettingsTest.java`; `T/protocol/TerminalConnectionProtocolTest.java`; `T/session/TdsGracefulShutdownLifecycleTest.java`; `T/session/TdsTerminalSessionActorsTest.java`; `T/websocket/TdsWebSocketConnectionTest.java`; `T/websocket/TdsWebSocketMessageOwnershipTest.java` |
| `org.postgresql` | `M/session/TdsBindingRevocationListener.java` | — |
| `org.slf4j` | `M/observability/TdsAsyncLog.java`; `M/session/TdsBindingRevocationListener.java`; `M/session/TdsGracefulShutdownLifecycle.java`; `M/session/TdsTerminalSessionActors.java`; `M/state/TdsConnectionStateWriter.java`; `M/websocket/TdsPmdCompressionHandler.java`; `M/websocket/TdsPmdOfferGate.java`; `M/websocket/TdsReservedBitsGate.java`; `M/websocket/TdsWebSocketConnection.java`; `M/websocket/TdsWebSocketHandler.java` | — |
| `io.netty` | `M/websocket/TdsBoundedPmdDecoder.java`; `M/websocket/TdsBoundedPmdServerExtensionHandshaker.java`; `M/websocket/TdsPmdCompressionHandler.java`; `M/websocket/TdsPmdMessageFilterProvider.java`; `M/websocket/TdsPmdOfferGate.java`; `M/websocket/TdsReservedBitsGate.java`; `M/websocket/TdsWebSocketPipelineInstaller.java` | `T/websocket/TdsPmdAllocationTest.java`; `T/websocket/TdsPmdMessageFilterProviderTest.java`; `T/websocket/TdsPmdOfferGateTest.java`; `T/websocket/TdsReservedBitsGateTest.java`; `T/websocket/TdsWebSocketConnectionTest.java`; `T/websocket/TdsWebSocketMessageOwnershipTest.java` |
| `reactor.core` | `M/config/TdsSettingsConfiguration.java`; `M/observability/TdsAsyncLog.java`; `M/session/SessionRegistrationGate.java`; `M/session/TdsBindingRevocationListener.java`; `M/session/TdsGracefulShutdownLifecycle.java`; `M/session/TdsTerminalSessionActors.java`; `M/state/TdsConnectionStateWriter.java`; `M/websocket/TdsPmdCompressionHandler.java`; `M/websocket/TdsPmdOfferGate.java`; `M/websocket/TdsReservedBitsGate.java`; `M/websocket/TdsWebSocketConfiguration.java`; `M/websocket/TdsWebSocketConnection.java`; `M/websocket/TdsWebSocketHandler.java`; `M/websocket/TdsWebSocketPipelineInstaller.java` | `T/config/TdsBlockHoundTest.java`; `T/session/SessionRegistrationGateTest.java`; `T/session/TdsGracefulShutdownLifecycleTest.java`; `T/session/TdsTerminalSessionActorsTest.java`; `T/state/TdsConnectionStateWriterTest.java`; `T/websocket/TdsPmdAllocationTest.java`; `T/websocket/TdsPmdOfferGateTest.java`; `T/websocket/TdsReservedBitsGateTest.java`; `T/websocket/TdsWebSocketConnectionTest.java` |
| `reactor.netty` | `M/websocket/TdsWebSocketConfiguration.java`; `M/websocket/TdsWebSocketPipelineInstaller.java` | `T/websocket/TdsPmdAllocationTest.java`; `T/websocket/TdsPmdOfferGateTest.java`; `T/websocket/TdsReservedBitsGateTest.java` |
| `tools.jackson` | `M/protocol/TdsWireJsonConfiguration.java`; `M/protocol/TerminalConnectionFrameCodec.java`; `M/protocol/TerminalConnectionProtocol.java`; `M/session/TdsBindingRevocationListener.java` | `T/protocol/TerminalConnectionFrameCodecTest.java`; `T/protocol/TerminalConnectionProtocolTest.java`; `T/session/TdsBindingRevocationListenerTest.java`; `T/state/TdsConnectionCloseReasonContractTest.java`; `T/websocket/TdsWebSocketConnectionTest.java` |
| `org.junit` | — | `A/TdsModuleBoundariesTest.java`; `T/config/TdsBlockHoundExtension.java`; `T/config/TdsBlockHoundTest.java`; `T/config/TdsRuntimeSettingsTest.java`; `T/protocol/TerminalConnectionFrameCodecTest.java`; `T/protocol/TerminalConnectionProtocolTest.java`; `T/session/SessionRegistrationGateTest.java`; `T/session/TdsBindingRevocationListenerTest.java`; `T/session/TdsGracefulShutdownLifecycleTest.java`; `T/session/TdsTerminalSessionActorsTest.java`; `T/session/TdsTrackedSessionLimiterTest.java`; `T/state/TdsConnectionCloseReasonContractTest.java`; `T/state/TdsConnectionStateWriterTest.java`; `T/websocket/TdsAuthenticationFailureDiagnosticsTest.java`; `T/websocket/TdsPmdAllocationTest.java`; `T/websocket/TdsPmdMessageFilterProviderTest.java`; `T/websocket/TdsPmdOfferGateTest.java`; `T/websocket/TdsReservedBitsGateTest.java`; `T/websocket/TdsWebSocketConnectionTest.java`; `T/websocket/TdsWebSocketMessageOwnershipTest.java`; `T/websocket/UnauthenticatedConnectionLimiterTest.java` |
| `org.assertj` | — | `T/config/TdsBlockHoundTest.java`; `T/config/TdsRuntimeSettingsTest.java`; `T/protocol/TerminalConnectionFrameCodecTest.java`; `T/protocol/TerminalConnectionProtocolTest.java`; `T/session/TdsBindingRevocationListenerTest.java`; `T/session/TdsGracefulShutdownLifecycleTest.java`; `T/session/TdsTerminalSessionActorsTest.java`; `T/session/TdsTrackedSessionLimiterTest.java`; `T/state/TdsConnectionCloseReasonContractTest.java`; `T/state/TdsConnectionStateWriterTest.java`; `T/websocket/TdsPmdAllocationTest.java`; `T/websocket/TdsPmdMessageFilterProviderTest.java`; `T/websocket/TdsPmdOfferGateTest.java`; `T/websocket/TdsReservedBitsGateTest.java`; `T/websocket/TdsWebSocketConnectionTest.java`; `T/websocket/UnauthenticatedConnectionLimiterTest.java` |
| `org.mockito` | — | `A/TdsModuleBoundariesTest.java`; `T/session/TdsGracefulShutdownLifecycleTest.java`; `T/session/TdsTerminalSessionActorsTest.java`; `T/state/TdsConnectionStateWriterTest.java`; `T/websocket/TdsWebSocketConnectionTest.java` |
| `com.tngtech` | — | `A/TdsModuleBoundariesTest.java` |
| `reactor.blockhound` | — | `T/config/TdsBlockHoundExtension.java`; `T/config/TdsBlockHoundTest.java` |
| `org.reactivestreams` | — | `T/websocket/TdsWebSocketConnectionTest.java` |

直接 imports 的成员清单由上面 `rg '^import '` 命令复算；Production 另有 2 个、Test 另有 2 个 Java 文件只使用 JDK/仓内类型，因此不属于第三方 API 调用点。每一行对应下方生产或测试行为核对表；同一文件可出现在多个 import 根。

另用全限定名搜索补齐了不出现在 import 清单里的 4 处直接类型引用：`T/state/TdsConnectionStateWriterTest.java` 的 `org.springframework.jdbc.core.JdbcTemplate`、`M/websocket/TdsBoundedPmdServerExtensionHandshaker.java` 的 `io.netty.handler.codec.http.websocketx.extensions.WebSocketExtensionEncoder`、`T/protocol/TerminalConnectionProtocolTest.java` 的 `tools.jackson.databind.ObjectMapper`、`T/websocket/TdsPmdOfferGateTest.java` 的 `io.netty.handler.codec.http.websocketx.ContinuationWebSocketFrame`。这些引用均落在已核对的 Spring/Jackson/Netty 用法行中；import 表保留“导入类型”口径，不把它冒充成所有源码类型引用的唯一分母。

文件数跨根不相加：同一个 test 文件可以调用多个库。构建行为另由 `apps/backend/terminal-data-server/build.gradle.kts`、根 `build.gradle.kts` 的 Boot/dependency-management/Spotless/Palantir 配置覆盖。

可复现的直接调用面盘点命令：

```sh
rg -n '^import ' apps/backend/terminal-data-server/src/main apps/backend/terminal-data-server/src/test/java
rg -n 'org\.(springframework|postgresql|slf4j|reactivestreams|junit|assertj|mockito)|io\.(netty|projectreactor)|reactor\.(core|netty|blockhound)|tools\.jackson|com\.tngtech' apps/backend/terminal-data-server/src/main apps/backend/terminal-data-server/src/test/java | rg -v '^.*:.*import (static )?'
rg -n '^import .* from ' scripts/test/terminal-ws-wire-client.mjs
rg -n "requiredWireModules|terminal-ws-wire-client\.mjs" scripts/test/r5-remote-testcontainers.mjs scripts/test/r5-remote-testcontainers.test.mjs
rg --files apps/backend | rg '(^|/)(commons-logging\.properties|META-INF/services/org\.apache\.commons\.logging\.LogFactory)$'
rg -n 'Class\.forName|ServiceLoader|loadClass\(|java\.lang\.reflect|org\.apache\.commons|com\.fasterxml\.jackson|io\.projectreactor\.addons|org\.apache\.logging|org\.yaml\.snakeyaml|io\.micrometer' apps/backend/terminal-data-server/src/main apps/backend/terminal-data-server/src/test/java scripts/test/terminal-ws-wire-client.mjs
rg --files apps/backend/terminal-data-server/src/main apps/backend/terminal-data-server/src/test | rg 'META-INF/services/'
rg -n 'spring-boot-gradle-plugin|dependency-management-plugin|com\.diffplug\.spotless|palantirJavaFormat|apply\(plugin = "org\.springframework\.boot"|apply\(plugin = "io\.spring\.dependency-management"|mavenBom\(' build.gradle.kts apps/backend/terminal-data-server/build.gradle.kts
```

当前 Java 第三方 package roots 和全部 import 文件/type 数由上表给出；type 数按唯一导入类型计，静态导入归并到声明类，不把 `assertThat`、`verify` 等成员方法误计成类型。未 import 的全限定名用法另列在上段。Node client 直接导入 `node:crypto`、`node:net`、`node:zlib`、`node:readline`、`node:perf_hooks`、`node:path`、`node:url`。上表按实际有行为依赖的调用场景逐项覆盖这些分组；同一库内只使用普通类型的引用不另造“最佳实践”测试。Gradle 行另覆盖构建插件与 BOM DSL。版本依据对应 runtime/test classpath 的实际解析图，而不是声明版本；生产源码与测试源码使用的 classpath 分开核对。

反射/服务发现补查无代码命中：没有 `Class.forName`、`ServiceLoader`、`loadClass` 或 `java.lang.reflect` 调用；唯一的 `META-INF/services/` 文件是测试作用域的 JUnit Jupiter extension provider，内容为 `TdsBlockHoundExtension`，归入 JUnit/BlockHound 测试用法，不是额外第三方 runtime provider。

该盘点只证明“使用了哪个版本及其官方语义”；每个本仓装配位置、资源所有权、close 映射和真实端到端行为仍由详设中的 focused proof / managed acceptance 证明。对尚未运行的 proof 保持未验证，不以此审计替代动态结果。

## 官方资料

官方站点可能通过 `current`、`release` 或仅含次版本号的 URL 展示较新的补丁版。本轮遇到 Spring Boot 4.1 与 Netty 4.2 页面标题/响应版本不完全等于项目补丁版，因此不把这些别名链接作为版本证据；下列 Boot/Netty/SLF4J/ArchUnit/构建插件语义以官方发布的精确版本 source JAR 为准，按坐标和源码类复核。Maven Central URLs 均指发布方上传的不可变版本归档。

- Spring Framework 7.0.8：[`SmartLifecycle`](https://docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/org/springframework/context/SmartLifecycle.html)、[`WebSocketSession`](https://docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/org/springframework/web/reactive/socket/WebSocketSession.html)、[`WebSocketMessage`](https://docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/org/springframework/web/reactive/socket/WebSocketMessage.html)、[`JdbcTemplate`](https://docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/org/springframework/jdbc/core/JdbcTemplate.html)、[`UriUtils`](https://docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/org/springframework/web/util/UriUtils.html)、[`SystemEnvironmentPropertySource`](https://docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/org/springframework/core/env/SystemEnvironmentPropertySource.html)
- Spring WebFlux 7.0.8：[`WebFluxConfigurer`](https://docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/org/springframework/web/reactive/config/WebFluxConfigurer.html)、[`WebSocketService`](https://docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/org/springframework/web/reactive/socket/server/WebSocketService.html)、[`HandshakeWebSocketService`](https://docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/org/springframework/web/reactive/socket/server/support/HandshakeWebSocketService.html)、[`SimpleUrlHandlerMapping`](https://docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/org/springframework/web/reactive/handler/SimpleUrlHandlerMapping.html)、[`NettyDataBuffer`](https://docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/org/springframework/core/io/buffer/NettyDataBuffer.html)、[`PooledDataBuffer`](https://docs.spring.io/spring-framework/docs/7.0.8/javadoc-api/org/springframework/core/io/buffer/PooledDataBuffer.html), [`spring-webflux` 7.0.8 source archive](https://repo.maven.apache.org/maven2/org/springframework/spring-webflux/7.0.8/spring-webflux-7.0.8-sources.jar) (`WebSocketMessage.release`, `ReactorNettyWebSocketSession.send`), [`spring-core` 7.0.8 source archive](https://repo.maven.apache.org/maven2/org/springframework/spring-core/7.0.8/spring-core-7.0.8-sources.jar) (`DataBufferUtils.release`, `NettyDataBuffer.isAllocated/release`)
- Spring Boot 4.1.0：[`spring-boot` source archive](https://repo.maven.apache.org/maven2/org/springframework/boot/spring-boot/4.1.0/spring-boot-4.1.0-sources.jar) (`WebApplicationType`, `SpringApplicationBuilder`, configuration binding, readiness events)、[`spring-boot-test` source archive](https://repo.maven.apache.org/maven2/org/springframework/boot/spring-boot-test/4.1.0/spring-boot-test-4.1.0-sources.jar) (`ApplicationContextRunner`)、[`spring-boot-reactor-netty` source archive](https://repo.maven.apache.org/maven2/org/springframework/boot/spring-boot-reactor-netty/4.1.0/spring-boot-reactor-netty-4.1.0-sources.jar) (`NettyServerCustomizer`)
- Spring Boot indirect runtime behavior, exact 4.1.0: same [`spring-boot` source archive](https://repo.maven.apache.org/maven2/org/springframework/boot/spring-boot/4.1.0/spring-boot-4.1.0-sources.jar) (`OriginTrackedYamlLoader`, `LoggingApplicationListener`, `LoggingSystemFactory`, `DefaultLogbackConfiguration`); SnakeYAML 2.6 [`source archive`](https://repo.maven.apache.org/maven2/org/yaml/snakeyaml/2.6/snakeyaml-2.6-sources.jar); Logback classic 1.5.34 [`source archive`](https://repo.maven.apache.org/maven2/ch/qos/logback/logback-classic/1.5.34/logback-classic-1.5.34-sources.jar). These exact-release sources take precedence over version-aliased current manuals.
- Logging dependency chain, exact releases: Spring Core 7.0.8 [`source archive`](https://repo.maven.apache.org/maven2/org/springframework/spring-core/7.0.8/spring-core-7.0.8-sources.jar) (`LogAccessor` calls Commons Logging); Commons Logging 1.3.6 [`source archive`](https://repo.maven.apache.org/maven2/commons-logging/commons-logging/1.3.6/commons-logging-1.3.6-sources.jar) (`LogFactory.newStandardFactory` and `Slf4jLogFactory`); Log4j-to-SLF4J 2.25.4 [`source archive`](https://repo.maven.apache.org/maven2/org/apache/logging/log4j/log4j-to-slf4j/2.25.4/log4j-to-slf4j-2.25.4-sources.jar) (`SLF4JProvider` marker and API adapter); SLF4J JUL bridge 2.0.18 [`source archive`](https://repo.maven.apache.org/maven2/org/slf4j/jul-to-slf4j/2.0.18/jul-to-slf4j-2.0.18-sources.jar) (`SLF4JBridgeHandler`). Logback classic 1.5.34 [`source archive`](https://repo.maven.apache.org/maven2/ch/qos/logback/logback-classic/1.5.34/logback-classic-1.5.34-sources.jar) (`LevelChangePropagator`). Cross-version concept guidance: [SLF4J legacy bridge guide](https://www.slf4j.org/legacy.html) and [Log4j installation guide](https://logging.apache.org/log4j/2.x/manual/installation.html); exact runtime behavior is grounded in the release sources above and Spring Boot 4.1.0 `LogbackLoggingSystem`.
- Reactor Core 3.8.7：[`Schedulers`](https://projectreactor.io/docs/core/3.8.7/api/reactor/core/scheduler/Schedulers.html)、[`Flux.doOnDiscard`](https://projectreactor.io/docs/core/3.8.7/api/reactor/core/publisher/Flux.html#doOnDiscard(java.lang.Class,java.util.function.Consumer))、[`BaseSubscriber`](https://projectreactor.io/docs/core/3.8.7/api/reactor/core/publisher/BaseSubscriber.html)、[Sinks reference](https://projectreactor.io/docs/core/3.8.7/reference/coreFeatures/sinks.html)、[`reactor-core` 3.8.7 source archive](https://repo.maven.apache.org/maven2/io/projectreactor/reactor-core/3.8.7/reactor-core-3.8.7-sources.jar) (`SinkManyUnicast.cancel`, `Flux.doOnDiscard`)
- Reactor Netty 1.3.7：[`WebsocketServerSpec.Builder`](https://projectreactor.io/docs/netty/1.3.7/api/reactor/netty/http/server/WebsocketServerSpec.Builder.html)
- Netty 4.2.18.Final：[`netty-codec-http` source archive](https://repo.maven.apache.org/maven2/io/netty/netty-codec-http/4.2.18.Final/netty-codec-http-4.2.18.Final-sources.jar) (`PerMessageDeflateServerExtensionHandshaker`, filters, extension handler, decoder, encoder and extension parser)、[`netty-buffer` source archive](https://repo.maven.apache.org/maven2/io/netty/netty-buffer/4.2.18.Final/netty-buffer-4.2.18.Final-sources.jar) (`ByteBufAllocatorMetric`, `UnpooledByteBufAllocator`)、[`netty-transport` source archive](https://repo.maven.apache.org/maven2/io/netty/netty-transport/4.2.18.Final/netty-transport-4.2.18.Final-sources.jar) (`EmbeddedChannel`)、[`EmbeddedChannel` Javadoc](https://netty.io/4.2/api/io/netty/channel/embedded/EmbeddedChannel.html)、[GHSA-2g37-3h88-55hc](https://github.com/netty/netty/security/advisories/GHSA-2g37-3h88-55hc)
- Reactive Streams 1.0.4: [official specification and JVM API](https://github.com/reactive-streams/reactive-streams-jvm/tree/v1.0.4) (`Subscription.request/cancel`)
- WebSocket client handshake/frame behavior: [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455.html) (nonce/accept verification and mandatory client masking)
- RFC / compression: [RFC 7692](https://www.rfc-editor.org/rfc/rfc7692.html), [zlib memory usage](https://zlib.net/zlib_tech.html), [JDK 21 `Inflater`](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/zip/Inflater.html)
- Jackson 3.1.4: [version-matched official `jackson-core` source JAR](https://repo.maven.apache.org/maven2/tools/jackson/core/jackson-core/3.1.4/jackson-core-3.1.4-sources.jar) (`StreamReadConstraints`; `maxDocumentLength` uses byte or char units from its input source and chunk-based checks) and [version-matched official `jackson-databind` source JAR](https://repo.maven.apache.org/maven2/tools/jackson/core/jackson-databind/3.1.4/jackson-databind-3.1.4-sources.jar) (`ObjectMapper` thread-safety contract)
- pgJDBC: [threading guidance](https://jdbc.postgresql.org/documentation/thread/), [`PGConnection` 42.7.11 source](https://github.com/pgjdbc/pgjdbc/blob/REL42.7.11/pgjdbc/src/main/java/org/postgresql/PGConnection.java)
- HikariCP 7.0.2: [official README](https://github.com/brettwooldridge/HikariCP/blob/HikariCP-7.0.2/README.md)
- JUnit 6.0.3: [extension registration](https://docs.junit.org/6.0.3/extensions/registering-extensions.html); [BlockHound 1.0.17 source/tag](https://github.com/reactor/BlockHound/tree/v1.0.17.RELEASE); [ArchUnit 1.4.1 source archive](https://repo.maven.apache.org/maven2/com/tngtech/archunit/archunit/1.4.1/archunit-1.4.1-sources.jar) (`ClassFileImporter`, `DO_NOT_INCLUDE_TESTS`); [SLF4J 2.0.18 source archive](https://repo.maven.apache.org/maven2/org/slf4j/slf4j-api/2.0.18/slf4j-api-2.0.18-sources.jar) (`Logger` parameterized/fluent APIs); [AssertJ 3.27.7 `Assertions`](https://javadoc.io/doc/org.assertj/assertj-core/3.27.7/org/assertj/core/api/Assertions.html); [Mockito 5.23.0 `Mockito`](https://javadoc.io/doc/org.mockito/mockito-core/5.23.0/org/mockito/Mockito.html)
- Node 22.23.2: [Buffer](https://nodejs.org/download/release/v22.23.2/docs/api/buffer.html), [globals (`URL`, `process`)](https://nodejs.org/download/release/v22.23.2/docs/api/globals.html), [timers](https://nodejs.org/download/release/v22.23.2/docs/api/timers.html), [net](https://nodejs.org/download/release/v22.23.2/docs/api/net.html), [crypto](https://nodejs.org/download/release/v22.23.2/docs/api/crypto.html), [zlib](https://nodejs.org/download/release/v22.23.2/docs/api/zlib.html), [readline](https://nodejs.org/download/release/v22.23.2/docs/api/readline.html), [perf_hooks](https://nodejs.org/download/release/v22.23.2/docs/api/perf_hooks.html), [path](https://nodejs.org/download/release/v22.23.2/docs/api/path.html), [url](https://nodejs.org/download/release/v22.23.2/docs/api/url.html)
- Gradle 9.7.0: [general best practices](https://docs.gradle.org/9.7.0/userguide/best_practices_general.html), [dependency configurations](https://docs.gradle.org/9.7.0/userguide/dependency_configurations.html), [PMD plugin](https://docs.gradle.org/9.7.0/userguide/pmd_plugin.html). Root applies Gradle core `java`/`pmd` plugins to subprojects; TDS ordinary `check` uses `pmdMain` and `pmdTest` with fail-on-violation.
- PMD exact release 7.17.0: [versioned PreserveStackTrace rule reference](https://docs.pmd-code.org/pmd-doc-7.17.0/pmd_rules_java_bestpractices.html#preservestacktrace), [release notes](https://pmd.github.io/2025/09/12/PMD-7.17.0/), and [`pmd-java` source archive](https://repo.maven.apache.org/maven2/net/sourceforge/pmd/pmd-java/7.17.0/pmd-java-7.17.0-sources.jar) (`PreserveStackTraceRule`). This matches the toolVersion set by the root Gradle build.
- 构建插件精确发布源码：[`spring-boot-gradle-plugin` 4.1.0](https://repo.maven.apache.org/maven2/org/springframework/boot/spring-boot-gradle-plugin/4.1.0/spring-boot-gradle-plugin-4.1.0-sources.jar)、[`dependency-management-plugin` 1.1.7](https://repo.maven.apache.org/maven2/io/spring/gradle/dependency-management-plugin/1.1.7/dependency-management-plugin-1.1.7-sources.jar)、[`spotless-plugin-gradle` 7.0.2](https://repo.maven.apache.org/maven2/com/diffplug/spotless/spotless-plugin-gradle/7.0.2/spotless-plugin-gradle-7.0.2-sources.jar)、[`palantir-java-format` 2.39.0](https://repo.maven.apache.org/maven2/com/palantir/javaformat/palantir-java-format/2.39.0/palantir-java-format-2.39.0-sources.jar)。Gradle wrapper 9.7.0 本身由 `gradle/wrapper/gradle-wrapper.properties` 锁定；root buildscript 对 plugin classpath 的 `commons-io` 强制选择 2.22.0，不属于 TDS Java API。JUnit Platform Launcher 6.0.3 由 TDS `testRuntimeOnly` 明确请求；Gradle test task 用 JUnit Platform 启动 Jupiter tests。

## 审计后静态验证与根因修复

### 配置键门首败

首次运行 CP-05 前的静态验证时，`V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY scripts/verify --validate-only` 停在 `runtime-environment-keys`，输出 `R5_RUNTIME_ENVIRONMENT_KEYS_TDS_CONFIG_CLOSURE:V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS`。根因是 gate 把 TDS 配置固定为直接 `@Value` 字段；仓内真实实现由 Boot `@ConfigurationProperties("v2s.tds")` record 绑定，再经 `TdsRuntimeSettings.from(...)` 做 fail-closed 验证。原红夹具也修改了旧的 `TdsSettingsConfiguration` 文本，不能触及当前绑定输入。

最小修复把 gate 改为核对 `TdsRuntimeProperties` 注解、两个必填 record component、`@EnableConfigurationProperties` 与两个容量值传入 `TdsRuntimeSettings.from(...)`；红夹具现在将 `maxTrackedSessions` 改名，要求同一配置闭包标记。已有 `TdsRuntimeSettingsTest` 注册进 `tds-constructor-assembly`，通过真实 Boot binder 对环境变量兼容名、缺失/非法启动失败与 7/11 容量值进行验证。实现依据和判据已同步到设计 §12 与计划 CP gate 行。

随后执行 `node tools/verify-gates/cli.mjs runtime-environment-keys --self-test` 与 `scripts/check/runtime-environment-keys` 正向门，均通过；项目索引经 `scripts/memory/build-index` 生成，`scripts/check/project-memory` 的完整红变异和正向检查均通过。更新后的整条 identity-only verify 也通过，细节见下方当前证据。

### Spotless/行长首败

同一次静态链先发现 `backend-spotless-check`：固定 Palantir formatter 在 17 个 TDS 手写 Java 文件上发现排版差异。检查留下的 `build/spotless-clean/spotlessJava` 输出并逐文件对照后，差异是 import 排序和格式布局。按仓内唯一格式器 `palantirJavaFormat("2.39.0")` 修复这 17 个输入，没有改行为。TDS Gradle reports 显示首轮已选定的五个测试类共 40 个用例全部零失败。

首次对 formatter 修复做完整 `spotlessCheck` 时，UTF-8 行长子门再发现 `TdsWebSocketHandler.java:126` 有 123 字节。formatter 将日志模板折在一行，超过 120 字节。把同一日志模板拆为相邻 Java 字符串后，事件名、字段顺序、参数与编译期常量值不变。修改前保存已编译的 TDS 84 个 main/test class 反汇编；完成 formatter 与 `compileJava`/`compileTestJava` 后，所有 84 项 `javap -c -p` 输出逐字节相同。

定向 `backendJavaUtf8LineLimit`、`spotlessJavaCheck` 和全仓 `./gradlew spotlessCheck --no-daemon` 均通过；全仓 Spotless 有 72 actionable tasks。格式变更文件都是手写 TDS 源码，没有生成器 owning path，因此代码生成重跑为 `NOT_APPLICABLE_WITH_REASON`。

### 过时精确锚点及当前静态结果

下一次 identity-only verify 报 `project-memory` exact-line anchor 与被拆分的 first-frame 日志行不一致。根因是 `project-memory/required-inventory.json` 仍钉旧的整行字符串。已将锚点更新到当前第一段日志事件字符串，并通过 `scripts/memory/build-index` 更新生成的 `project-memory/index.json`；`scripts/check/project-memory` 复验通过。

最后一次 `V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY scripts/verify --validate-only` 当前字节结果：`runId=ter-local-static-47681-1790535141124`，约 `2026-09-27T18:52Z–18:55Z`，`EXECUTED=35/35`、`TERMINAL_STATIC=PASS`、`R5_VERIFY_VALIDATE_ONLY=PASS`、`CLEANUP=NOT_APPLICABLE_STATIC_ONLY`。这不是普通投影模式绿基线；CP-05 calibration 前，投影相关的普通模式及其 deferred red fixtures 仍不得声称通过。最近远端动态 run 的 source-control 字节早于本报告所述门、锚点及排版修正，故本报告不把它升级为当前字节的 TDS/业务验收。
