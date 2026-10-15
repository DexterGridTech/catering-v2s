# 前后台结构优化 CP-02 实施与对账记录

## 范围与当前状态

- CP：02，asset/catalog owner 内提纯。
- 主 agent 实施状态：实现、编译和 CP-02 所需 focused proof 已完成；fresh 独立三维对账 `MATCHED`。先前 reviewer 的 `OPEN` 绑定于当时旧计划的 Testcontainers 边界及未运行的数据库方法；最新计划和实际 focused proof 已补齐该范围。CP-03 尚未开始。
- 判据：正式需求 R-05～R-07、R-14；详设 §6、§8.2、§8.3；实施计划 CP-02；源码与验证附件 §1、§3。
- 本阶段没有改变业务 API、owner 权限、数据库事实、事务属性、公开模型/FQCN、素材用途或持久化语义。

## 主 agent 的判定与修改

| 项目 | 当前字节事实与最小处置 | 适用边界 |
|---|---|---|
| Asset 流式物化 | `PlatformAssetService` 内新增唯一 private `materializeStream` 与 `MaterializedStream`。该循环负责读取、限长、前缀采集、SHA-256、临时文件写入和关闭；ZIP 与公开图片 wrapper 传入各自既有的大小、前缀及文件名策略。ZIP 签名、图片 magic/decode、声明大小和各自 typed error 仍由原 wrapper 负责；失败删除本次创建的临时文件，成功文件仍交给既有 stage `finally` 所有。 | 未改变公共 video 准入；测试只读取图片/ZIP 两个既有临时前缀的路径集合并比较前后差异，不删除任何路径。数据库、对象存储、事务挂起及回滚/清理顺序仍由原 owner 路径负责。必要的 `PlatformAssetServiceTest` PostgreSQL/Flyway集成方法已按最新授权经受管入口运行；容器化证明仍限于CP-02所需方法。 |
| Catalog 制作差异 | `CatalogOwnerValueSupport.skuPreparationDiffers` 统一 Item 与 Workbench 的纯值判断；`totalCount > 0` 仍由调用方判断，列表/详情使用的事实范围未合并。 | MissingNode/null 归一化保持原语义；未扩大读取范围。 |
| Catalog 草稿校验 | 把 shape/SKU/派生字段纯校验移入 package-private `CatalogItemDraftValidator`。原 `CatalogItemService` 仍负责 Facts、owner 读取/命令、锁/CAS、receipt、审计、错误编排和事务。通过直接构造保持原构造/FQCN，不引入 Spring bean 或代理。 | 错误码、验证顺序和低层已读事实保持在原编排中；没有搬移 JDBC 或 owner 调用。 |
| Catalog 详情值组装 | 把只消费既有 hydrated 值的纯投影移入 package-private `CatalogItemDetailAssembler`；`ItemFacts` 显式携带已有 `sourceScopeRef`，`InboundReference` 为原 inbound 值的具名投影。service 继续执行原查询和事实读取，再将值交给 assembler。 | `sourceFact` 的 AUTO_SYNC、临时来源和 SELF_MANAGED/COPIED 优先级不变；未新增查询、第二事实副本或公开类型。 |

同根扫描覆盖原 Asset 两个物化 wrapper、stage 外层所有权、CatalogItemService 全部迁出 helper 的调用点、Workbench 同语义调用、ItemRow 已有 sourceScopeRef 读取，以及构造、promotion、自调用和 `@Transactional` 边界。未发现需要迁移的 I/O helper；未触及公开 tabs/IAM 类型。

### 外部 finding intake

| Finding | 主 agent disposition | 证据与最小处置 | 残余边界 |
|---|---|---|---|
| S-1：ZIP/图片 wrapper 缺少真实失败、流关闭、临时文件及实际限长断言 | `CONFIRMED` | 原测试的部分缺口由新增 `PlatformAssetServiceMaterializationTest` 补齐：两个 public wrapper 分别覆盖读取、对象 stat 与 metadata 写失败，断言原 cause、输入流关闭、对应前缀无新增残留；metadata 失败还断言只清理由本次上传的对象。增加图片实际读取超过 5 MiB 上限的反例。随后通过真实 PostgreSQL/Flyway 的 owner 集成测试验证 ZIP stage/claim/readback、ZIP 读取失败清理、对象写失败清理及内容拒绝。 | 256 MiB ZIP 超限不分配同尺寸测试文件，由同一循环的有界读取与 ZIP wrapper 参数静态核验支撑；未宣称该大体积路径动态执行。 |
| S-2：差集清理会删除未经所有权证明的临时文件 | `CONFIRMED` | 原 `deleteTemporaryAssetUploadsCreatedAfter(before)` 会删除扫描前集合中不存在的所有匹配路径，不能证明归本测试所有。已删除该 helper 及调用点；失败断言保留只读集合比较，不执行任何文件删除。生产代码只删除自身创建的精确临时路径。 | 若测试因断言提前失败留下临时文件，保留给本次生产精确清理/人工处理；测试不扫除未知资源。 |
| N-1：`CatalogItemDetailAssembler.compositeGroups(JsonNode)` 无调用者 | `CONFIRMED` | 静态搜索生产与测试调用，方法在 assembler 中无消费者，唯一依赖的 `copyNullableText` 也只服务该方法。已删除这两个死方法；`CatalogItemService` 与 `CatalogCopyService` 的同名且有真实消费者方法保持不动。 | 无；未扩展为同名方法机械清理。 |

## 当前字节与逐点读回

写入前重开正式需求 R-05～R-07、CP-02 详设/计划和附件、Asset/Catalog owning source 与直接测试；结合 R-READ01～R-10 命中记忆核对数据/事务约束。focused proof 后再次检查下列同组源码，结果如下：

- Asset 的两个 wrapper 都只调用同一个流循环；它们仍分别完成内容语义校验。外层 stage 的事务挂起、对象 I/O、原 typed 错误映射与最终临时文件删除路径未被抽离。
- Catalog 新类没有 JDBC、owner API、事务或资源管理；service 的 public constructor、公开类型、事务注解及既有 Facts/读写边界保留。
- detail assembler 接收来自原查询的值；`sourceScopeRef` 来自原 `ItemRow`，并非新查出的字段。
- 现有测试/类型边界未覆盖的数据库行为保留 `NOT_RUN`，不会由纯测试或编译推定为通过。

本记录是主 agent 实施后整理的当前字节说明，不伪造逐点时间戳或独立 verdict。

## focused proof 与失败处置

| 范围 | 当前字节上的运行 | 结果与边界 |
|---|---|---|
| Catalog 新纯能力 | `node scripts/test/r5-remote-testcontainers.mjs :apps:backend:catering-business-server:modules:catalog:test --tests com.catering.v2s.catalog.application.CatalogOwnerValueSupportTest --tests com.catering.v2s.catalog.application.CatalogItemDraftValidatorTest --tests com.catering.v2s.catalog.application.CatalogItemDetailAssemblerTest`，run `r5-tc-1791998889329-46982` | 三个选定的纯 JUnit 类 BUILD SUCCESSFUL；managed runner完成远端workspace/process和容器/卷查询cleanup，资源列表为空。该次主要证明新增纯能力。 |
| Asset 引用查询测试，首败与修复复验 | 同一受管入口、`PlatformAssetServiceBatchReferenceTest`，run `r5-tc-1791998983655-48999`、`r5-tc-1791999083743-51129` | 首次测试因期望projection漏掉当前SQL已有的`usage`失败；仅修正测试期望和mock值。第二次BUILD SUCCESSFUL。两次manifest记录cleanup PASS、容器和卷列表为空。 |
| 图片/ZIP materialization public wrapper | `PlatformAssetServiceMaterializationTest`，run `r5-tc-1792000008291-73369`、`r5-tc-1792000070424-74757`、`r5-tc-1792000127488-76132` | 前两次断言因mock未匹配`stageContent`中的null workspace UUID及null group key而失败；只改测试matcher，未改生产实现。第三次7个JUnit用例BUILD SUCCESSFUL，覆盖图片/ZIP read/stat/metadata失败、cause、source close、临时前缀读回、metadata失败对象清理和图片5 MiB实际读取超限。测试没有覆盖ZIP `putPrivate`上传写失败；“storage failure”由已运行的对象stat失败覆盖，不声称ZIP写失败已验证。 |
| Java 编译及目标源格式 | `./gradlew :apps:backend:catering-business-server:modules:catalog:spotlessJavaCheck :apps:backend:catering-business-server:modules:catalog:compileJava :apps:backend:catering-business-server:modules:catalog:compileTestJava :apps:backend:catering-business-server:modules:asset:compileJava :apps:backend:catering-business-server:modules:asset:compileTestJava --console=plain` | BUILD SUCCESSFUL；目录内本批改动 Java 均与 Spotless 输出一致，Catalog 模块 Spotless 通过；asset 与 catalog main/test 编译通过。Asset 模块既有 Spotless 任务因四个未修改存量文件仍有格式差异而未宣称通过；未为格式结果改动那些文件。 |
| Asset owner集成测试 | `PlatformAssetServiceTest`中精确4方法，run `r5-tc-1792003779340-33569` | 4/4通过，JUnit XML已读回：`terminalUpdatePackageUsesPrivateBucketAndRequiresScopeAndClaimBeforeActiveRead`、`failedTerminalPackageReadClosesSourceAndDeletesItsOwnTemporaryFile`、`stageDeletesTheMaterializedUploadWhenObjectPutFails`、`rejectsUnsupportedOrOversizedContent`。执行了PostgreSQL/Flyway/Testcontainers；manifest status与cleanup均PASS，启动1个run-owned PostgreSQL容器，无卷，结束查询通过且清理一次完成。 |
| Catalog详情与草稿owner集成 | `CatalogCategoryOwnerIntegrationTest`中精确2方法，run `r5-tc-1792003874987-35641` | 2/2通过，JUnit XML已读回：`itemListAndDetailProjectCatalogReferencesAndNonArchivedSkuPriceRange`、`skuCodeDefaultAndDisplayOrderInvariantsRejectBeforeChangingPersistedFacts`。执行PostgreSQL/Flyway/Testcontainers；manifest status与cleanup均PASS，启动2个run-owned PostgreSQL容器，无卷，结束查询通过且清理一次完成。 |

本报告涉及八次 managed run，八份 manifest与Gradle日志均已读回：五次BUILD SUCCESSFUL、三次测试失败；六次历史run和两次本轮run均记录managed cleanup PASS、资源查询成功；两个新增集成run的run-owned PostgreSQL容器均已清理。前三次失败属于测试fixture期望/matcher修正，未改生产代码。后两次当前CP02关键数据库proof分别为资产4/4与Catalog 2/2通过。DEV业务、reset/seed、Web及Android仍未运行；本CP无需这些运行来闭合。未操作UAT或真机。

## 主要文件 SHA-256

| 文件 | SHA-256 |
|---|---|
| `apps/backend/catering-business-server/modules/asset/src/main/java/com/catering/v2s/platform/asset/application/PlatformAssetService.java` | `8063727c32a97e10763361448926e16c456df91841a86fea9e9a7d3866996c6a` |
| `apps/backend/catering-business-server/modules/asset/src/test/java/com/catering/v2s/platform/asset/application/PlatformAssetServiceTest.java` | `d66b97efafc5fd7ddc16366c9e3b2fe1db86539d1656cc2b67503d6505f7b3da` |
| `apps/backend/catering-business-server/modules/asset/src/test/java/com/catering/v2s/platform/asset/application/PlatformAssetServiceBatchReferenceTest.java` | `eb9034df8f09935df528b138fcbe08a5cd29e6658bade068e882a1570362e719` |
| `apps/backend/catering-business-server/modules/asset/src/test/java/com/catering/v2s/platform/asset/application/PlatformAssetServiceMaterializationTest.java` | `bce16c5e9a38ac6e7225c2381d1d71486a85e51c336b977f3e931221b5dfec3b` |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemService.java` | `31cb7e3cbcdb21f1bcbed449d8eeaa384c4c5d2b3299ad0461eecb04d0cba1c3` |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerValueSupport.java` | `b780fabdd5166e34222e6ed2cd56f1e38482edae084faa416fc3d7964bb4c3de` |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogWorkbenchReadService.java` | `fcbb095ce178ce7363eddd9483eb06d41dd80cd79e0df727321e6ba00268d084` |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemDraftValidator.java` | `fb0954a5eb65af1367cd204471c5e9b12e92b7a9b2b9417e0f06d1105ec33252` |
| `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemDetailAssembler.java` | `3f120776bbe740ae160e0155513e2638c5e0d0e2c6883a27b05248d94560f4af` |
| `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogItemDraftValidatorTest.java` | `fd4723d0c39ce184c01bef4dec5c2fa3cd3615469e33ad22a147425ae25f658f` |
| `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogItemDetailAssemblerTest.java` | `14bb92e57eb9a56f35fdd12f2df50ee165821269259c7227e0285da13e122e9a` |
| `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogOwnerValueSupportTest.java` | `fec6d7b10f000359d1d75fa6464596010fc95505da69acc895e5382846059a12` |

## 独立 CP 对账

- 状态：`MATCHED`。
- reviewer：`/root/cp02_final_match_current`，`reviewerKind=INDEPENDENT_SUBAGENT`，只读；未写文件、运行测试或操作环境。先独立读取当前需求、详设、计划、项目记忆、owning source、直接测试和运行记录，再读取本报告与作者处置。
- 独立结论：未发现阻止退出 CP-02 的差异。需求 R-05～R-07/R-14、详设 §6/§8.2/§8.3 和计划 CP-02 对应当前 Asset 两 wrapper 的唯一流循环、wrapper 各自内容校验、stage 的对象 I/O/事务/finally 顺序，以及 Catalog 的制作差异纯规则、草稿验证和只读详情组装；service 的构造、FQCN、事务、锁/CAS、receipt、审计和权威 readback 边界保持。项目记忆维度核对 R-READ-01～10 与 kernel/deterministic-context-only 要求。
- reviewer 直接读回四组 focused 结果：Catalog 新纯能力 6 项、Asset 物化 7 项、Asset PostgreSQL/Flyway 集成 4 项、Catalog PostgreSQL/Flyway 集成 2 项均无失败/跳过；对应受管 run manifest 为 `PASS`，cleanup、远端进程/工作区与 Testcontainers 容器/卷查询及清理均为 `PASS`。256 MiB ZIP 实际超限仍是静态边界，不冒充动态测试；全批 DEV、Web、Android 与 seed 仍未运行。
- CP-03 现可开始；本结论只关闭 CP-02，不代表全批 `GO`。
- 全批 6b、DEV 动态准入与运行、13c、整批 IMPLEMENTATION review：尚未开始。
