SKILL_USED=cs-spec-to-plan;cs-writing-plans

# 后端 owner 服务职责分离 · implementation plan

## 0. 计划元数据与授权边界

```text
PROGRAM_ID=V2S_W0_W4_EXECUTION
REQUIREMENTS=doc/plans/platform/2026-09-11-v2s-backend-readability-requirements-claude.md
DESIGN=doc/plans/platform/2026-09-11-v2s-backend-readability-implementation-design-codex.md
RULES=AGENTS.md, PLATFORM-BLUEPRINT.md, doc/platform/backend-coding-standard.md, doc/platform/foundation-charter.md
ACCEPTANCE=doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md
OBSERVABILITY=doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md
REVIEW_GOVERNANCE=doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md
CURRENT_AUTHORITY=仅撰写详设与实施计划
IMPLEMENTATION_AUTHORITY_FOR_THIS_TURN=false
RUNTIME_AUTHORITY_FOR_THIS_TURN=false
REVIEW_TARGET=DESIGN
```

本文是可执行计划，不是本回合的实施授权。当前回合只允许修改本计划与对应详设；不得修改 Java、测试、契约、generated、
migration、seed、脚本或项目运行状态，不得启动 DEV、reset、seed、backend acceptance、browser L2、UAT、部署或切流。
旧的带 `frontend` 字样的需求文档已作废，不是本计划的输入。

## 1. 实施目标与确定方案

目标是把当前五个 owner facade 中不同聚合的事务入口、私有实现和持久化事实移到能力命名的具体 service，使接手者
可以沿着一个聚合定位业务实现，同时不改变任何现有业务事实。当前设计已选定“原 owner API facade + 同包具体 target bean”形态：

- `CatalogOwnerService`、`InventoryOwnerService`、`SalesMenuOwnerService`、`BusinessEntityService`、
  `BusinessChannelOwnerService` 保留现有公开 API 和必要的异常/DTO FQCN；facade 不保留业务 JDBC 实现。
- 目标类、方法族、聚合边界与当前源码锚点以详设 §4、§7.2 为准；实现时若当前字节与锚点不一致，重开符号后以源码为准，
  但不能静默改变目标边界。
- `CatalogInventoryCoordinator` 保留为跨 owner coordinator；
  `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/externalcollaboration/ExternalCollaborationBusinessChannelCoordinator.java`
  位于候选全集之外，也保持 edge coordinator 角色。
- 不采用新的 repository 抽象、通用 base class、共享万能 service、协议/契约改动或全量 SQL 归位。跨族共享只允许
  最小纯值 helper；含 JDBC、锁、receipt、owner command 或事务语义的 helper 必须留在事实 owner 的单一 target 内。

如果任何目标需要直接写两个 owner、需要新增跨 owner 事务协议、或矩阵显示可读性收益不足以覆盖结构与测试成本，必须停止当前
CP，提交证据给 Dexter；实施者不得自行缩小目标或以“部分完成”报完成。

## 2. 当前范围与目标文件拓扑

### 2.1 候选与保留边界

候选全集用当前字节重新取得：

```bash
find apps/backend/catering-business-server/modules -type f \
  \( -path '*/src/main/java/*/application/*Service.java' \
     -o -path '*/src/main/java/*/application/*Coordinator.java' \) | sort
```

当前详设记录该全集为 62 个文件；逐个纳入/排除结论在详设 §3。`PlatformAssetService` 按 asset owner 保留，不误归为
基础设施 adapter；各种 receipt、task-read、auth/policy 与 support 类按 §3.1 记录其不拥有的 mutation 事实；不能以文件大小
作为排除理由。

### 2.2 目标产物

以下是实现顺序中会出现的具体能力类。完整方法族和当前行锚点不在此重复，以详设 §4、§7.2 为唯一映射：

| owner | target services | facade / protocol boundary |
| --- | --- | --- |
| Catalog | `CatalogWorkbenchReadService`、`CatalogAttributeDefinitionService`、`CatalogUnitDefinitionService`、`CatalogOrderOptionDefinitionService`、`CatalogCategoryService`、`CatalogDictionaryService`、`CatalogItemService`、`CatalogCopyService` | `CatalogOwnerService`；`CatalogCommandRouter` 只作 operation-id 协议适配，`write` 的外层事务属性保留 |
| Inventory | `InventoryAvailabilityService`、`InventoryTargetService`、`InventoryCatalogLifecycleService`、`InventoryBomService`、`InventoryCopyService` | `InventoryOwnerService`；`InventoryReadRouter`、`InventoryCommandRouter` 只作闭集协议适配，保留当前 generic 入口的外层事务属性 |
| BusinessEntity | `BusinessBrandService`、`BusinessTenantService`、`HeadCompanyService`、`StoreService`、`BusinessEntityTaskReadService` | `BusinessEntityService`；`BusinessEntityCommandRouter` 负责 generic overload dispatch，公开嵌套异常/record 留在 facade |
| BusinessChannel | `BusinessChannelTemplateService`、`BusinessChannelService`、`BusinessChannelTaskReadService` | `BusinessChannelOwnerService` |
| SalesMenu | `SalesMenuDefinitionService`、`SalesMenuSectionService`、`SalesMenuItemService`、`SalesMenuPublicationService`、`SalesMenuManualSaleService`、`SalesMenuOperationRecordService` | `SalesMenuOwnerService`；`SalesMenuCommandApi` overload 统一转到相同 target，不通过 facade 自调用取得事务 |

这些类均放在各自现有 module 的 `application` package 下，类名只表达能力，不带 Journey/步骤 ID。`CatalogTaskReadService` 和
`InventoryTaskReadService` 等已存在的 task-read wrapper 保持原职责，不改成反向调用 facade 的环；`SalesMenuAssetCommandFacade`
保持现有 asset adapter 边界。

## 3. CP-0：重开源码并冻结四项设计输入

### 3.1 写入前读取

实施者必须在任何 Java/test 写入前重新读取：

1. 本计划 §1–§10、详设 §2–§13、正式需求 §3–§10；
2. `project-memory/decisions/deterministic-context-only.md`、六维 memory route 命中的全部适用原文；
3. `doc/platform/backend-coding-standard.md`、`doc/platform/foundation-charter.md`、
   `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md`、
   `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`、
   `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`；
4. 当前 62 个候选及其依赖的 API、facts、repository、advice、operation、controller 和测试源码；
5. 对应 CP 的方法族、调用方、事务/持久化、测试覆盖四张矩阵。

### 3.2 四张矩阵的交付内容

矩阵写入详设或该详设的实施记录，不建 hash-chain 或 retired compliance 台账：

| 矩阵 | 每行粒度 | 必须回答的问题 | 不能冒充的证据 |
| --- | --- | --- | --- |
| 方法族矩阵 | 一个将移动的 public method family；所有 overload 展开为完整签名 | 当前 source、target aggregate/class、side effect、异常、readback、风险维度和移动顺序是什么 | 方法名 token、文件存在、public 数量 |
| 调用方矩阵 | 生产 interface/concrete caller、edge controller、operation、其他 owner、测试直接构造、Spring 依赖 | facade 是否真的能保留；哪些构造器/接口必须调整；是否有 direct concrete 或反射风险 | 只扫类名、不含接口调用的引用结果 |
| 事务与持久化矩阵 | 每个方法族及关键 helper | `@Transactional` 全属性、`TransactionTemplate`、receipt/canonical、lock/CAS、JDBC/repository、owner command/readback 顺序；以及 self-call、调用点、外层 transaction attributes 与拆分后的事务承接方式 | JdbcTemplate token、SQL 行数、只看注解、只记录 self-call 存在 |
| 测试覆盖矩阵 | 每个方法族×适用风险维度 | 哪个现有 test method 有真实 fixture/request/oracle；缺口如何在结构移动前补齐 | 测试文件名、字符串命中、response status |

详设 §7.2 已给出 family map，CP-0 只补齐完整签名、真实方法名、重载和逐方法测试 oracle，并在事务/持久化矩阵逐个记录
self-call 与外层 transaction attributes；不把所有 private helper 复制成第二份清单。纯 helper 的归属在事务/持久化矩阵标记为
“同族私有”或“纯值支持”，含 owner 事实的 helper 必须有唯一 owner。

### 3.3 CP-0 退出条件

- 62 个候选均有 `KEEP_SINGLE_AGGREGATE`、`KEEP_TASK_READ`、`KEEP_COORDINATOR`、`KEEP_ADAPTER` 或 `SPLIT` 判定及源码理由；
- 五个 facade 的每个将移动 public family 都有唯一 target、完整 overload、事务属性、调用方、风险维度和测试状态；
- 公开 nested exception/DTO、`ContractProblemAdvice` mapping、直接 concrete caller 与 Spring constructor 边界均已列出；
- 每个未能从当前源码确定的事实标为 `OPEN` 或 `UNVERIFIED_REQUIRES_EVIDENCE`，提交 Dexter，不能进入 CP-1；
- CP-0 只生成/修订设计记录，不修改生产代码、测试或运行环境。

## 4. CP-1：先补行为钉住，再动结构

### 4.1 行为钉住原则

不切分既有测试文件。对详设 §7.4 每一行缺口按实际风险维度补到现有 owner/application/domain test group；测试必须使用真实
fixture、command/request、正向 oracle、负向 oracle 和写入后 authoritative readback。只出现 method/class 名、只断言状态码、
只看异常类型或只看 DB operation 数，都不能关闭行为缺口。

最低补齐范围：

- Catalog definition/category/dictionary：scope、CAS/status、hierarchy lock、problem 与 readback；
- Catalog item/promotion/copy：receipt first-use/replay/conflict、batch `REQUIRES_NEW`、已知部分失败与未知失败回滚、
  lock order、Inventory/asset dependency、promotion/copy readback；
- Inventory target/lifecycle/BOM/copy：target CAS/lock、ledger、跨 owner validation/retirement、BOM atomicity、reference mapping、
  replay/conflict 与事实读回；
- SalesMenu：menu/section/item/version ordering、SKU/option selection、publication immutable snapshot、ITEM/SKU/
  `ORDER_OPTION_VALUE` manual fact、operation record、asset/reference readback；
- BusinessEntity：四种 entity type 的 generic dispatch、extension facts、CAS/status、authorization、每个 advice 负向映射与 readback；
- BusinessChannel：template/channel 分离、visibility relation、provider revalidation、binding/readback、SalesMenu candidate fail-closed。

### 4.2 CP-1 执行与证明

1. 按测试覆盖矩阵逐行确认现有方法与真实 oracle；不确定行保持 `UNVERIFIED_REQUIRES_EVIDENCE`。
2. 在既有测试文件补最小缺口；不得新建“测试拆分框架”、基类或新的 acceptance operation。
3. 先运行对应 module 的静态编译与 focused test，读取实际 Gradle/log/test 结果；缓存、`UP-TO-DATE`、`NO-SOURCE`、`SKIPPED`
   不能作为 Docker-backed test 的 PASS。
4. 对直接 `new` 的 fixture，先将构造方式调整为显式 target composition 或当前测试所需的 Spring fixture；生产 constructor
   依赖不得改成 optional fallback。

CP-1 退出条件是每个将移动 family 的适用风险维度均有真实 behavior oracle，新增测试先绿，且与详设的同一组 source/requirements
逐点双读结果为 `MATCHED`。任何 coverage 仍是 `OPEN`，不得进入结构 CP。

## 5. CP-2：Catalog 结构移动

### 5.1 变更顺序

1. 先创建同 package target bean 和必要构造器，保持 `JdbcTemplate`、`ObjectMapper`、facts、`TimeProvider`、transaction manager、
   `InventoryOwnerApi`、`ProductionTagOwnerApi`、asset lock 等现有依赖方向。
2. 按详设 family map 依次移动 definition attribute/unit/order-option、category、dictionary、item/status/promotion、copy 与 workbench/read
   实现；每次移动连同同族 private helper、receipt/canonical、lock、CAS、owner call、readback 一起移动。
3. `CatalogOwnerService` 保留 `CatalogOwnerApi` 与 `CatalogTemporaryPromotionOwner`，其 public 方法只转发；`write` 由
   `CatalogCommandRouter` 作为 operation protocol adapter 分派，原 generic outer transaction 属性保留，router 不直接读写 JDBC。
4. `CatalogInventoryCoordinator` 不移动、不内联；Catalog→Inventory/ProductionTag/Asset 的跨 owner write 仍经原公开 command API，
   在原 REQUIRED 边界和调用顺序内完成。
5. `CatalogTaskReadService` 仍是已存在的 task-read wrapper；workbench read target 不得反向依赖 facade。

### 5.2 CP-2 证明

每个 family 完成后，用 CP-1 同一输入做 post-read：事务 annotation/TransactionTemplate、batch `REQUIRES_NEW`、receipt key、lock
顺序、Inventory retirement/asset lock、异常与 readback 逐项核对；运行 Catalog focused tests、编译和目标 owner API tests。当前 CP 的 fresh
独立步骤 review 为 `MATCHED` 后才能进入 CP-3。

## 6. CP-3：Inventory 结构移动

1. 创建 availability、target、catalog lifecycle、BOM、copy target beans；generic `read`/`write` 只由对应 router 做闭集 dispatch。
2. `InventoryTargetService` 同时承接 target read 与 typed mutation，因为两者共同围绕 target ledger/configuration/CAS/readback；不把
   generic operation switch 的协议责任混入该聚合实现。
3. lifecycle target 只做 Catalog item/unit 的依赖检查和 inventory retirement；BOM target 只写 inventory target/BOM 关系；交界处若发现
   一个入口同时改变两组事实，回到 `CatalogInventoryCoordinator` 或提交 Dexter 决策，不能新建共享写 helper。
4. 保留 SalesMenu 所需 availability API、Inventory owner API、copy mapping/digest、receipt/replay 和所有事务属性。
5. 完成同一输入的 post-read、Inventory focused tests、跨 owner Catalog/Coordinator tests 与 fresh step review。

## 7. CP-4：BusinessEntity 结构移动

1. 创建 `BusinessBrandService`、`BusinessTenantService`、`HeadCompanyService`、`StoreService`，分别承接直接 command family；
   `BusinessEntityCommandRouter` 只做 entity type 的 generic overload dispatch，不直接持有 JDBC mutation。
2. `BusinessEntityTaskReadService` 承接 list/page/path/scope/lookup 与 SalesMenu/Contract/Catalog eligibility read；这些 read 不得被用来
   决定另一个 owner 的写入。
3. `BusinessEntityService` 保留所有当前公开嵌套异常、`StoreUpdateFacts`、页面 record 的 FQCN。target 抛出这些原类型，不能创建同名
   替代异常；`ContractProblemAdvice` 的 direct mapping 不改。
4. generic `createEntity/updateEntity/transitionEntityStatus` 的所有 overload、receipt canonicalization、operations grant、store/project
   scope 与 readback 都按矩阵逐项落到正确 target；不能只把最短 overload 转发后遗漏带 actor/idempotency/grant 的 overload。
5. 生产直接注入 `BusinessEntityService` 的 controller/task-read/receipt consumer 保持不改；只有测试 fixture 为显式 target composition
   而调整。若发现 `@Bean`、反射类名或多实现注入，停在 CP-4。

## 8. CP-5：BusinessChannel 结构移动

1. `BusinessChannelTemplateService` 承接 template、scope、visible-store relation、provider validation、CAS/audit/readback；整体替换、
   `VOIDED` ref 可保存与 editor ALL read 语义必须原样保留。
2. `BusinessChannelService` 承接 channel lifecycle、binding status、template revalidation 和 channel readback；不从 template target
   复制关系写入逻辑。
3. `BusinessChannelTaskReadService` 承接 provider/template/channel 组合 read 与 SalesMenu eligibility；SalesMenu 候选的 INTERNAL + STORE
   + DINE_IN/TAKEAWAY 谓词与 direct revalidation 不变，外部系统/其他 owner 不获得菜单写入。
4. owner facade 保留 `BusinessChannelReadApi`、`BusinessChannelCommandApi`、`BusinessChannelOwnerApi` 公开解析边界；运行既有
   visibility/channel/provider/sales-menu focused tests，并做逐点 post-read 与 fresh step review。

## 9. CP-6：SalesMenu 结构移动

1. `SalesMenuDefinitionService` 负责 collection lifecycle/activation/schedule，`SalesMenuSectionService` 负责 section hierarchy/order，
   `SalesMenuItemService` 负责 item/SKU/option selection 与 asset target，`SalesMenuPublicationService` 负责 immutable publication snapshot。
2. `SalesMenuManualSaleService` 只负责 ITEM、SKU、`ORDER_OPTION_VALUE` 的人工销售状态及 publication 后同一事实的 stale child 清理；
   库存自动可售状态继续由 Inventory owner 提供，不能与人工 status 合并。
3. `SalesMenuOperationRecordService` 独立承接 `recordRejectedOperation` 与 `listOperationRecords`；失败记录不能塞进 manual-sale target。
4. `SalesMenuCommandApi` 的 overload 只是既有协议入口，必须直接进入对应 target 的 Spring bean；不得通过 facade 的另一 public method
   自调用来“借用”事务代理。所有 `@Transactional(propagation=REQUIRED)`、receipt、CAS、lock、publication readback 和 operation record
   失败语义逐项保留。
5. 完成 menu/section/item/publication/manual/operation-record/asset focused tests、逐代码与详设 post-read、fresh step review。

## 10. CP-7：整批收口与逐代码对账

### 10.1 明确步骤：逐代码与详设对账

这是独立的收口步骤，不由“编译通过”替代。主 agent 逐项读取当前全部实际改动的 Java/test 行与详设 §4、§6、§7.2、§7.4，至少核对：

- 每个 source public family、所有 overload、private helper 是否落在详设目标类；
- facade 是否只保留 API/protocol forwarding，router 是否没有 JDBC/owner mutation；
- 每个事务 annotation 的传播、readOnly、noRollback、`REQUIRES_NEW` 与外层协议事务是否保留；
- receipt/canonical/idempotency、lock/CAS、audit、exception/advice、authoritative readback 的顺序和对象是否保留；
- interface/concrete caller、Spring constructor/bean、直接 test construction 是否仍解析；
- no new HTTP/contract/generated/migration/seed/frontend/owner write；
- 七条不变量与每个方法族的 behavior oracle 是否逐项有证据。

每项只能是 `MATCHED` 或 `OPEN`。有任何 `OPEN`，先修复并接受 fresh 独立复查；不能把问题留给 acceptance。

### 10.2 静态与 focused

在最后一次结构/测试代码改动之后，按仓内当前脚本完成 `scripts/verify` 及适用的 compile/focused tests，读取真实日志，确认没有
`FROM-CACHE`、`UP-TO-DATE`、`NO-SOURCE` 或 `SKIPPED` 冒充 Docker-backed test 结果。静态结果与 focused behavior 结果分层记录。

### 10.3 最后一次 full backend acceptance

仅在 CP-7 对账为 `MATCHED`、所有 focused proof 关闭后运行：

```bash
scripts/test/backend-acceptance --operation all
```

该 run 必须晚于所有生产与测试代码改动，并在交付材料中按同一 run 标识分开报告：

- `CONTRACT`：全量场景逐条通过；
- `BUSINESS`：全量场景逐条通过且 `businessMode=REAL`，每条有业务 oracle；
- `DB_OPERATIONS`：信息性结果，只用于诊断/预算观察；
- `cleanup`：受管 Testcontainers 资源清理 PASS；
- 238-operation budget verifier：独立 run-level 证据，不替代任何业务 oracle。

本批没有整改前 baseline，不创建也不引用 baseline。backend acceptance 是后续实施授权后的动作，本计划阶段不执行。

受管 Testcontainers run 若获授权，遵守 `scripts/README.md` 与 runtime standard 的远端执行边界：远端 Java/容器与数据库同侧，
本机不启动 Spring/PostgreSQL tunnel；若已有当前 DEV manifest，按受管 stop/test/restart 联动记录 `DEV_WAS_RUNNING`；业务与 cleanup
分开判读，首败日志/PID/manifest 先保留并读取，禁止按端口/命令名杀进程或盲目延长 timeout。

## 11. 每个 CP 的固定双读、独立复查与失败处理

每个 CP 都按以下固定顺序执行：

1. **写入前双读**：重开正式需求、详设、六维 memory 原文、适用规范、当前 owning source、当前测试与 CP 入口条件；逐 family 记录
   source/target/tx/lock/receipt/readback/caller/test。
2. **最小写入**：主 agent 只写当前 CP 范围；不顺便格式化、改名、搬 SQL、改 contract 或修其他 owner。
3. **focused proof**：编译与适用行为测试，读取真实日志和业务 oracle；业务、cleanup、预算分别记录。
4. **写入后同输入双读**：用同一组原文逐项核对行为、形态、动作、关系、位置、失败/恢复、事务、锁、receipt、exception、readback、caller，
   只能得 `MATCHED`/`OPEN`。
5. **fresh independent step review**：当前步骤结束、下一 CP 开始前，由 fresh 独立子 agent 只读审查三维（正式需求、详设/IA、memory/规范）。
   主 agent 不能代替；finding 逐条重新打开 source，已确认项修复后重新接受复查。
6. **范围冲突**：shared helper 扇入、构造器、Spring graph 或测试缺口若使可读性收益不再明显，保留首败与完整成本/收益证据，交 Dexter；
   不自选“先拆能拆的”。

失败诊断遵守 log-first：保留 first failure、last known good、broken boundary、log path、受控 process identity、business 与 cleanup；同一
 signal 第二次尝试前先完成边界诊断。生产代码结构失败不能用全量 acceptance 或后续 L2 掩盖。

## 12. 交付物与完成条件

完成实施后的交付包必须分开呈现：

1. owning source 改动清单与每个 target/facade 的实际路径；
2. 四张矩阵与逐 CP 对账，包含所有 `OPEN`/`UNVERIFIED_REQUIRES_EVIDENCE` 的处置；
3. CP-1 focused 行为钉住证据与补测试清单；
4. `CONTRACT`、`BUSINESS`、`DB_OPERATIONS`、budget verifier、cleanup 的 full acceptance 分层结果及 run 标识；
5. 七条不变量逐条证明及 `ContractProblemAdvice`/公开异常/调用方/Spring 边界证据；
6. 未执行项：UAT、部署、切流，以及任何未获授权的动态动作。

本回合交付的完成条件仅是两份 design/plan 文档写完、当前字节自审完成并交 fresh independent DESIGN review。生产实施、测试、
reset、seed、DEV 和 acceptance 均保持未执行，不得在最终回复中升级为 PASS。
