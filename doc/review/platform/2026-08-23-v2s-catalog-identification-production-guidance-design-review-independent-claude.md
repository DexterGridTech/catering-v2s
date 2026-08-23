# 商品识别与制作指引 DESIGN 独立审查（Round 1）

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=CIPG-DESIGN-20260823
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_REVIEW_DECLARATION=先冻结独立预期，后读作者工件；不采信作者结论、既有 verdict 或自报数字。
```

## 1. 审查范围、顺序与授权

本轮 reviewer 先从正式需求、适用规范、模板和 owning source 冻结独立预期，再读取 Journey、交互、SVG、IA、详设与串行计划。上游 requirement review 最后读取，只作为待验证输入；没有继承其结论、verdict 或计数。

本轮只执行只读 source/document 核验及本 review 文件写入。没有执行 Git、测试、DEV、reset、seed、browser L2、UAT、部署或数据操作。

### 1.1 输入清单

授权与入口：

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/README.md`
- `doc/platform/roadmap-program-registry.json`
- 当前 program `V2S_W0_W4_EXECUTION`：`doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` 的授权字段
- `scripts/README.md`

上下文、记忆与审查准则：

- `project-memory/decisions/deterministic-context-only.md`
- `project-memory/index.md` 全部 kernel
- 六维路由命中的 design、review、frontend、backend、contract、product、governance memory 原文
- `.agents/skills/cs-review/SKILL.md`
- `doc/platform/review-standard.md`
- `project-memory/operations/verification-governance.md`
- `doc/decisions/templates/journey-decision-template.md`
- `doc/decisions/templates/ui-interaction-design-template.md`
- `doc/decisions/templates/ia-design-template.md`
- `doc/decisions/templates/implementation-design-template.md`
- `doc/platform/foundation-charter.md`
- `doc/platform/frontend-coding-standard.md`
- `doc/platform/backend-coding-standard.md`
- `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`

正式需求：

- `doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-formal-requirements-codex.md`

作者工件（在独立预期冻结后读取）：

- `doc/decisions/2026-08-23-v2s-catalog-identification-production-guidance-journey.md`
- `doc/decisions/2026-08-23-v2s-catalog-identification-production-guidance-ui-interaction.md`
- `doc/plans/platform/wireframes/2026-08-23-v2s-catalog-identification-production-guidance.svg`
- `doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-information-architecture-codex.md`
- `doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-implementation-design-codex.md`
- `doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-serial-plan.md`

最后读取的待验证输入：

- `doc/review/platform/2026-08-23-v2s-catalog-identification-production-guidance-requirements-review-claude.md`

至少逐个打开并扩展同族扫描的 owning source：

- `scripts/generate/catalog-inventory-p1.mjs`
- `scripts/generate/backend-performance-budget.mjs`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerApi.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`
- `apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/api/ProductionTagOwnerApi.java`
- `apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java`
- `apps/frontend/operations-admin/src/features/catalog/ui/CatalogItemDrawer.tsx`
- `apps/frontend/operations-admin/src/features/catalog/model/catalogModel.ts`
- `scripts/dev/catalog-inventory-seed-executor.mjs`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceScenarioCatalog.java`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java`
- `apps/backend/catering-business-server/src/main/resources/db/migration/` 中 catalog/production 相关 migration 全族
- `contracts/openapi/paths/operations-admin/production-tag-management.paths.json`
- `contracts/openapi/catalog-inventory.openapi.json`
- `contracts/registry/operation-handler-bindings.json`
- generated route/binding/owner registries 与 operations-admin generated wire

## 2. 冻结的独立预期

1. 用户只能看到已批准的业务语言；contract 字段、内部枚举、ref、owner、scope 与 typed problem 属于技术层。owner 是最终业务校验点，UI 隐藏不是业务不变量。
2. identifier、display、notes/instruction、seconds 的精确上限和规范化规则必须能追溯到正式需求、已接受 decision 或真实 owning source；不得借用无关列宽或实现常量补义。
3. 新 HTTP operation 必须有当前消费者、可生成 contract、可测量的预算准入顺序；不能依赖自身最终生成物才能取得生成所需的实测值。
4. additive Flyway 必须能够处理已知 legacy 形态；fail-closed 需要迁移前可执行的发现、报告与处置路径，不能把 reset/seed 当作默认迁移方案。
5. acceptance 总数上限不改变“一条 scenario 的 identity、operation、fixture、request、business oracle 必须语义一致”的要求。
6. UI-bearing 设计的静态一致性不能替代真实渲染、键盘、焦点、滚动、HTTP、数据库或浏览器证据。

## 3. 动作 1-B：文档事实提取

本表先记录事实，不以作者的自报 `PASS` 或数字作为结论。

| 1-B 类别 | 独立提取事实 | 对账结果 |
| --- | --- | --- |
| 模板整节/整列 | Journey、UI interaction、IA、implementation design 的主模板整节均能找到对应章节；详设 §3 的四列也存在 | 未发现整节整体缺失 |
| 模板内容缺口 | candidate search 没有冻结“管理列表”和“仅可绑定候选”的请求模式、空 query 语义、cursor identity；七个 acceptance subcase 没有逐个证明与宿主 annotation 的 operation identity 相同 | 非空缺口；见 F-04、F-06 |
| 文档矛盾 | 详设把 option effect 放入已退役的 `catalog_order_option_value`；budget 要求“实值前无最终生成物”，现有 generator 又要求每个 operation 先有非空 budget；IA 的 `0–10` 示例与“不得发明硬上限”并存；15 个 problem 的分组数字与表格不一致 | 见 F-01、F-02、F-05、F-08 |
| 无出处数值/规则 | `identifier=160` 与 trim 有 Heritage 来源；`display=120`、`notes/instruction=1000`、`seconds<=86400`、Unicode control 拒绝、case-sensitive 规范化没有在正式需求或对应当前 owning source 找到同义裁决 | 见 F-05 |
| 当前 source 事实 | catalog P1 operations=57，canonical operations=181，bindings/current total=238；当前没有 resolve operation；Catalog acceptance annotations=38，全 acceptance annotations=80 | 独立计数见 §7 |
| 状态事实 | Journey/UI interaction 为已接受输入；IA/详设明确 `IMPLEMENTATION_AUTHORITY=false`；串行计划为 `DESIGN_ONLY` | 状态授权链静态一致；见 F-09 |
| 证据档位 | 本轮只形成静态文档/source 证据；未执行任何测试、HTTP、数据库、DEV 或浏览器动作 | 测试已证为 `NONE`，L3 见 §8 |

## 4. Findings

### F-01 — option preparation effect 指向已退役的关系表

```text
CLASSIFICATION=CONFIRMED
SEVERITY=M
```

owning source 证据：详设 §10 把 `preparation_effect` 加到 `catalog.catalog_order_option_value`；`V20260820_010000_001__retire_item_attribute_json_and_order_option_relations.sql` 已删除该旧表。当前有效模型由 `V20260820_010000_000__catalog_item_definition_libraries.sql` 的 `catalog_order_option_definition`、`catalog_order_option_definition_value`、`catalog_item_order_option_config`、`catalog_item_order_option_value_override` 构成；`CatalogOwnerService` 的 `orderOptionConfigs` 读写也走这一族。

同族全集：扫描了 catalog option 建表、迁移、退役、definition/config/value override、owner read/write/copy、contract 与 UI model。未找到仍以旧表作为当前 item option 事实住址的反例。

影响：照设计实施时 migration 目标不存在；若重建旧表，则把 item-scoped definition/value override 模型退回已删除形态，并造成 owner 粒度、FK、copy/readback 不确定。

最小修复：在正式需求的“具体 definitionValueRef 对当前商品产生 effect”语义下，把 effect 放到当前 item-scoped value override 关系；补齐 item config → definition value → effect 的 FK、scope、copy 与 readback。若产品不接受这个事实住址，交 Dexter 裁定另一个当前有效且仍为 item-scoped 的唯一住址。

不过度设计替代：不重建旧表，不加兼容表、双写或 fallback；只保留一个当前有效的 item-scoped 事实住址。

### F-02 — resolve HTTP operation 与 239-operation budget 形成顺序死锁，且当前零真实 UI consumer

```text
CLASSIFICATION=CONFIRMED
SEVERITY=M
```

owning source 证据：详设要求 P1 `57→58`、总数 `238→239`，同时声明真实测量前不能有最终生成物。`catalog-inventory-p1.mjs` 的 `databaseOperationBudget` 对缺失 budget 直接失败，并把 57 个 operation 全部经 `withDatabaseOperationBudget` 处理；`backend-performance-budget.mjs` 只接受非负整数 FIXED budget、精确 operation set 与三次测量结果，拒绝 placeholder。当前 route registry、OpenAPI、bindings、frontend、owner 与 acceptance 中均没有 resolve operation。交互工件和详设又明确当前维护 UI 不调用它，只留给未来销售入口。

同族全集：扫描了 57 个 P1 operation、181 个 canonical operation、238 bindings、budget validator/calibration/reconciliation、operations-admin OpenAPI/generated wire、Catalog owner API、frontend 调用点与 acceptance route identity。resolve 的当前消费者数为 0。

影响：没有 budget 不能生成 operation；没有可生成、可调用的 operation 又不能得到真实 budget。以 null、`CALIBRATION_PENDING` 或猜测 max 不能通过当前 validator。零当前 consumer 还违反 implementation template §9 的“零调用者方法删除”判据。

最小修复：本批取消 resolve HTTP edge，只保留正式需求所需且有当前调用方的 catalog-owner task read；待真实销售 Journey 批准后再新增 edge、消费者和预算。若 Dexter 明确要求本批保留 HTTP，则详设必须先给出可运行且不污染最终 registry 的一次性校准阶段，再以实测值原子生成最终 58/181/239 输出。

不过度设计替代：优先延期无消费者的 edge；不新增永久 calibration registry，不引入 placeholder budget，不猜 max。

### F-03 — additive Flyway 对已知 legacy 形态 fail-closed，但没有可执行的现有 DEV 处置链

```text
CLASSIFICATION=PARTIALLY_CONFIRMED
SEVERITY=M
```

owning source 证据：详设要求 unknown legacy profile/code fail closed。当前 seed executor 仍写 `skuBarcode`、identifier 旧形态，并对 MATERIAL 同时写 top-level 与 `productionProfiles.item.materialRole`；当前 coordinator/owner 仍读取或提升这些旧 JSON 字段。正式需求已经给出一个确定规则：nested `materialRole` 与 top-level 相同则保留 top-level 并删除 nested，冲突才停止。详设的 generic unknown-key 失败规则没有显式编码这个已知等值反例。

同族全集：扫描了 catalog migration 目录、`CatalogOwnerService`、`CatalogInventoryCoordinator`、`CatalogItemDrawer`、`catalogModel`、seed executor 及 Catalog acceptance legacy fixtures。已确认旧形态仍可由当前 source 产生；现有 DEV 中每类数据的真实行数因本轮禁止数据操作而未验证。

影响：DEV start 会自动执行 additive Flyway。已知等值 nested/top-level 行若被当作 unknown，可能直接阻断 Spring Boot 启动；遇到真正 unknown 后，设计也没有定义报告内容、责任人、修复输入和重试条件。reset/seed 是独立授权动作，不能充当默认迁移处置。

最小修复：把正式需求的等值折叠/冲突停止规则写进 migration；在 migration 激活前定义 read-only preflight/report，输出分类、数量与安全业务编码而不输出 raw identifier、notes 或 instruction；可确定项自动迁移，真正 unknown 停止并交 Dexter 决定 repair 或 reset，清零后才执行 Flyway。

不过度设计替代：不做 dual-read、fallback、自动 reset 或兼容层；只增加确定性的 preflight → disposition → migration 路径。

### F-04 — production-tag 同一 GET 无法同时表达管理全集与“仅 enabled 可绑定候选”

```text
CLASSIFICATION=CONFIRMED
SEVERITY=M
```

owning source 证据：当前 `production-tag-management.paths.json` 的 GET 只有 data-node、cursor、pageSize，没有 query/status/usage。`ProductionTagOwnerService.readTags` 的 cursor identity 由 scope、brand、pageSize 构成，SQL 与 total 都覆盖全部 status。现有 production-tag 管理界面使用该 endpoint 管理 enabled/disabled 全集；`CatalogItemDrawer` 也使用同一 endpoint，并在客户端把非 enabled option 禁用。作者设计要求仍复用同一 GET，新增 query 后“候选只返回 enabled”，同时保留管理面读取 disabled 和编辑时显示既有 disabled 引用，却没有声明空 query 如何区分两种消费语义。

同族全集：扫描了 production-tag OpenAPI path/schema、P1 operation、generated RTK hook、`ProductionTagOwnerApi/Service`、管理界面与 CatalogItemDrawer 两类真实 consumer、cursor decode/encode 和 total 查询。冲突覆盖同 endpoint 的两个 consumer，不是单页问题。

影响：若无 query 表示全部，候选初始页会包含 disabled；若无 query 表示 enabled，管理面会丢失 disabled。仅前端禁用不能证明 owner 绑定准入；若新增过滤却不进入 cursor identity，翻页与 total 还会漂移。

最小修复：同一 endpoint 增加一个生成契约字段，例如 `usage=CANDIDATE` 或 `bindableOnly=true`；候选 consumer 即使空搜索也显式发送，管理 consumer 省略。owner 把 usage、规范化 query、pageSize 一起纳入 cursor identity，并让 rows 与 total 使用同一 predicate；写 owner 继续拒绝新绑定 disabled/foreign tag，既有 disabled readback 仍可见。

不过度设计替代：不新增第二个 owner 或第二套 endpoint，不做客户端过滤；只给现有 GET 增加一个明确消费模式。

### F-05 — 精确数值与规范化规则只有部分有出处

```text
CLASSIFICATION=PARTIALLY_CONFIRMED
SEVERITY=S
```

owning source 证据：Heritage V4 identifier 列为 `varchar(160)`，对应规则会 trim，因此 `identifier=160 + trim` 有历史来源。正式需求只要求 contract 明确字符、长度和秒数范围，没有批准其余具体值。`display=120` 只能命中无关的旧 `print_name`/显示列形态，`notes/instruction=1000` 未找到同义 owner 来源；当前 seconds 约束只有非负整数，没有 `86400` 上限；case-sensitive 与 Unicode control rejection 也没有已接受的产品/contract 裁决。

同族全集：扫描了正式需求、六份作者工件、V4 与当前 catalog migrations、catalog/production OpenAPI、Catalog owner、frontend model、P1 generator 和 seed。production-tag 当前 pageSize 20/100 有 owner 来源，不属于本 finding。

影响：这些值会改变请求拒绝、legacy migration 和用户可保存数据，不能由实现者自行补义。IA 同时使用“0–10”示例和“不得发明硬上限”，进一步造成形态不确定。

最小修复：保留能明确追溯的 `160 + trim`；其余每项要么补正式 business/contract 来源并说明长度单位、空值/0 与 normalization，要么标为 `DEXTER_DECISION` 后从当前设计删除。移除或明确标注 IA 的 `0–10` 仅为非规范示意。

不过度设计替代：不借用无关字段宽度，不引入 checksum、复杂正则、设备解析或新的 identifier 类型。

### F-06 — 七个 subcase 不是一概违规，但三个宿主 scenario 与新增 operation/oracle 错配

```text
CLASSIFICATION=PARTIALLY_CONFIRMED
SEVERITY=S
```

owning source 证据：当前 `CatalogAcceptanceScenarios` 已有 `catalog.inventory-rule-admission-matrix`，在同一 `saveOperationsCatalogItem` 业务语义下执行 7 shapes × 3 owner types × 3 modes，证明“一个 annotation 内有矩阵 subcase”本身不违规。但作者 §11 把 manifest read scenario 扩为 42 个 save 篡改，把 pagination read scenario 混入 disabled binding write，又把 identifier/effect whole-save atomicity塞进 asset lifecycle scenario；这些新增 request/oracle 不再与宿主 annotation 的单一 operation identity 一致。copy scenario 的 copy rewrite 与 item/SKU save scenario 的同 operation 扩展则可成立，不能把七项一律否定。

同族全集：独立扫描了全仓 80 个 `@AcceptanceScenario`、Catalog 38 个、scenario discovery/selection、现有 admission matrix，以及设计列出的七个宿主 scenario。已逐个区分同 operation 扩展和跨 operation 耦合。

影响：按 operation 选择 focused acceptance 时，跨 operation 的 subcase 可能不会在目标 operation 下执行；annotation 数仍为 80 也不能证明业务证据可发现、可定位或语义单一。设计自报 `results=80` 未运行，不能作为证明。

最小修复：保留 item/SKU/copy 等同 operation、同业务目的的 subcase；将 manifest-save、pagination-write、asset-identifier/effect 原子性移入对应 save/binding operation 的独立 scenario identity。为保持总数 ≤80，只合并或退役真实重复且 oracle 已被完整保留的旧 scenario，并在设计中列出精确 rebalance。

不过度设计替代：不新增 provider、registry 或新测试框架；沿用现有 annotation/catalog，只修正 scenario identity 与有限分母。

### F-07 — `BOM` 被放进本 Journey 的用户可见 copy 与 SVG

```text
CLASSIFICATION=CONFIRMED
SEVERITY=S
```

owning source 证据：UI interaction 的 `USER_VISIBLE_COPY` 与 SVG 都显示“库存与 BOM”。UI template 的业务语言规则把 BOM 列为只能出现在 `TECHNICAL_BOUNDARY` 的技术词；IA 又自报用户可见文本不得扩散技术字段名。其余新增主文案“条码与标识”“规格编码”“制作信息/制作变化”使用业务语言，contract/UI/owner 总体分层没有系统性泄漏。

同族全集：扫描了 Journey、interaction 每个 screen 的 `USER_VISIBLE_COPY`、SVG 全部 text、IA 禁词表、详设 visible-copy 约束、当前 Drawer tabs 与业务 corpus。确认本轮新增文案中的直接冲突集中在该宿主 tab；技术字段只在 `TECHNICAL_BOUNDARY` 出现不构成 finding。

影响：当前文档的“逐字一致/业务语言 PASS”不能成立；真实 UI 是否已经显示该词属于 L3，不能由静态设计推断。

最小修复：由已接受业务 corpus 给该宿主 tab 一个用户可理解的名称，并同步 interaction、SVG、IA；若现有宿主名称必须保留，则明确提交 Dexter 裁决并修正模板适用性声明。

不过度设计替代：不改库存 owner、不重命名整个领域、不引入文案映射框架；只修这一处可见标签及其文档同族。

### F-08 — 15 个 problem 的分组数字与实际表格不一致

```text
CLASSIFICATION=CONFIRMED
SEVERITY=N
```

owning source 证据：详设把 15 个 problem 描述为 identifier 5、preparation 6、common 4；UI interaction 表实际为 identifier 4、preparation 6、common 5。resolve 的 invalid/not-found/ambiguous outcome 与这 15 个 save problem 的关系也未单列。

同族全集：扫描了 interaction 的 15 行、IA error mapping、详设 problem 分组、P1 problem family 与 backend problem registration 入口。独立总数为 15，错误在分类陈述而非总数。

最小修复：建立唯一的 code → owner rule → HTTP → UI 表，修正为真实分组，并将 resolve outcome 与 save problem 分开。

不过度设计替代：不新增第二套 problem namespace，不为修正计数新增错误码。

### F-09 — 状态授权一致，但逐字一致性自检仍有陈旧文本

```text
CLASSIFICATION=PARTIALLY_CONFIRMED
SEVERITY=N
```

owning source 证据：Journey/UI interaction 的接受状态、IA/详设的 `IMPLEMENTATION_AUTHORITY=false`、serial plan 的 `DESIGN_ONLY` 与授权边界一致；没有发现状态越权。另一方面，interaction 仍写 operationId “待 implementation design 冻结”，而详设已经冻结；“规格与 SKU/规格与商品编码”“制作影响/制作变化”等文本在 interaction、IA、SVG、详设之间并非逐字相同，故作者的逐字一致 `PASS` 不能原样采信。

同族全集：扫描了六份作者工件的 frontmatter、authorization/status block、screen labels、tab/modal titles、operation references 与 serial authorization。状态一致，陈旧或不一致文本为有限文档同步问题。

最小修复：删除已过期的“待冻结”，以已接受 interaction/IA 的唯一用户文案同步 SVG 和详设；保留技术说明只在 technical boundary。

不过度设计替代：不引入文案 registry 或生成门；直接修正文档正本中的有限字符串。

## 5. 重点证伪 A–G 结论

| 重点 | 独立裁决 | 证据结论 |
| --- | --- | --- |
| A 业务语言与分层 | `PARTIALLY_CONFIRMED` | contract/UI/owner 分层在设计结构上成立；BOM visible copy 与少量逐字漂移见 F-07/F-09。当前旧代码未实施新 typed model 属于 L3，不反推设计已实现。 |
| B 数值出处 | `PARTIALLY_CONFIRMED` | 160+trim 有 Heritage 来源；120/1000/86400/control/case 没有同义当前裁决，见 F-05。 |
| C resolve/budget/consumer | `CONFIRMED` | 顺序死锁与零当前 UI consumer 均成立，见 F-02；production-tag consumer 模式冲突另见 F-04。 |
| D legacy fail-closed | `PARTIALLY_CONFIRMED` | 已知 seed/source 反例与处置缺口成立；实际 DEV unknown 行数无人验证，见 F-03。 |
| E 七个 subcase | `PARTIALLY_CONFIRMED` | 矩阵 subcase 并非天然违规；manifest/pagination/asset 三项 operation 语义错配，copy 与同-operation save 可保留，见 F-06。 |
| F 独立复算 | `CONFIRMED` | 17、15、16、80/38、42、238 全部按 source 独立复算；详见 §7。 |
| G 状态/逐字/UI | `PARTIALLY_CONFIRMED` | 授权状态一致；逐字自检有陈旧文本；UI 全部仍是 L3 未验证，见 F-07/F-09 与 §8。 |

## 6. Same-root scan 总表

| 根因族 | 有限全集 | 扫描结论 |
| --- | --- | --- |
| option effect 事实住址 | option 建表/退役 migrations、definition/config/value override、owner read/write/copy、contract/UI | 旧表已退役；当前 item-scoped override 是唯一现成关系族。 |
| operation/budget | 57 P1 + 181 canonical、238 bindings、budget validator/calibration/reconciliation、OpenAPI/generated wire/consumer | 当前无 resolve；缺预算不能生成，未生成不能实测；零 UI consumer。 |
| legacy migration | migration、owner/coordinator、frontend model/Drawer、seed、acceptance legacy fixtures | 已知 nested materialRole/skuBarcode/generic profile 仍存在；真实 DEV 行数未知。 |
| production-tag candidate | path/schema、P1、generated hooks、owner API/service、management UI、CatalogItemDrawer、cursor/total | 同一 GET 有管理全集与 enabled 候选两个语义，设计未声明 mode。 |
| 数值与规范化 | 正式需求、六份作者工件、Heritage/current migration、contract、owner、UI、seed | 仅 160+trim 找到相关来源；其余精确值/规则未获同义裁决。 |
| acceptance | 全仓 80 annotations、Catalog 38、discovery/selection、现有 matrix、七个计划 subcase | 80/38 成立；三项跨 operation 耦合，四项可在同 operation 边界内设计。 |
| 可见文案 | interaction 全 screen、SVG text、IA、详设、当前 Drawer、template/corpus | 总体采用业务语言；BOM 冲突及有限逐字漂移成立。 |
| problem/status | 15-code 表、problem registration、六份状态与授权 block | 15 总数成立、分组陈述错误；授权状态一致。 |

## 7. 独立计数

计数使用只读 source 枚举和算术复算；没有运行测试，也不使用作者自报数字作为证据。

| 项目 | 独立结果 | 口径 |
| --- | ---: | --- |
| 详设 §3 横切机制行 | 17 | 表中机制行逐行计数 |
| UI/IA problem codes | 15 | 交互错误映射表逐行计数；实际分组 4/6/5 |
| 详设 §9b anchors | 16 | anchor 行逐项计数并在目标 source 查找 |
| acceptance total | 80 | 全 acceptance Java 的 `@AcceptanceScenario` literal count |
| Catalog acceptance | 38 | `CatalogAcceptanceScenarios.java` literal count |
| 计划矩阵 | 7×2×3=42 | 算术复算；是设计矩阵，不是运行证据 |
| 当前 P1 operations | 57 | generated catalog-inventory route registry / P1 metadata |
| 当前 canonical operations | 181 | canonical edge route registry |
| 当前 total | 238 | 57+181，并与 operation-handler bindings 对账 |
| 计划 total | 239 | 新增一条 resolve 后的设计值；当前 source 尚不存在 |
| 当前已有 admission matrix | 7×3×3=63 | 单一 `saveOperationsCatalogItem` scenario 内部矩阵，不能与计划 42 混为一数 |

## 8. 证据三档与 L3 inventory

### 8.1 静态已证

- 授权/status 边界与本轮唯一写文件边界。
- 当前 option relation 的有效/退役表族。
- 当前 owner/API/coordinator、frontend consumer 和 generated registry 结构。
- 当前 operations 57+181=238、bindings=238。
- 当前 acceptance 80/38。
- 当前 production-tag GET 参数、owner 全 status 查询、cursor identity 与两个真实 UI consumer。
- 作者设计的 Journey、surface、字段意图、错误表和串行顺序。

### 8.2 测试已证

```text
NONE
```

本轮没有执行测试。现有测试源码、annotation、generator self-test 以及作者文档中的 `PASS` 只属于静态存在性证据，不升级为本轮测试证据。

### 8.3 无人验证 / L3_UNVERIFIED inventory

1. 七个批准 screen 的真实 DOM、业务文案和禁词是否按设计渲染。
2. Drawer/Modal 的键盘顺序、Esc、焦点返回、overlay lock、dirty confirm。
3. 长中文、长 identifier、长 notes/instruction、窄视口下的 scroll/overflow/card fallback。
4. candidate search 的输入规范化、触发时机、debounce、stale response、cursor、空态、失败态和 disabled 既有引用。
5. whole-save 本地草稿、version conflict、typed problem 定位及失败后全部事实不变。
6. 新 contract、P1→tokens→M1→P3 generated chain、route、handler binding 与 239 exact set。
7. Catalog owner save/readback/resolve、SKU inherit/override、option additive effect 的真实 HTTP/事务行为。
8. production-tag mode/query 的 owner rows/total/cursor 与写侧 disabled/foreign 拒绝。
9. additive Flyway 对真实 DEV legacy 分布的 preflight、迁移与启动结果。
10. 七个 acceptance subcase 的真实发现、focused 选择、CONTRACT/BUSINESS 与 total 仍为 80。
11. resolve 的三次 performance measurement、实值 budget、239-operation verifier business/cleanup。
12. seed 物化与 readback。
13. DEV、browser L2、UAT、部署、数据操作及其 cleanup；本轮均未执行。

## 9. Verdict 与最小设计修复

`NO-GO` 由 F-01 至 F-04 四个 M 级设计阻断决定，不是由 L3 未运行本身决定。最小收口顺序：

1. 把 option effect 改到当前 item-scoped option value relation，禁止复活旧表。
2. 删除本批无消费者的 resolve HTTP edge；若 Dexter 要求保留，先补无 placeholder 的一次性校准顺序。
3. 给 legacy migration 加已知等值折叠规则和可执行 preflight/disposition。
4. 给 production-tag GET 增加明确 candidate usage，并统一 rows/total/cursor predicate。
5. 再处理数值裁决、acceptance rebalance、可见文案和文档一致性；无需引入新框架或兼容层。

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=4/3/2
L1_ENGINEERING=NO-GO：F-01 已退役 option 表、F-02 resolve/budget 顺序死锁、F-03 legacy Flyway 处置不可执行、F-04 production-tag 同端点消费语义冲突
L2_USER_VISIBLE=F-07 用户可见 BOM 冲突；其余 contract/UI/owner 分层仅静态成立，真实 UI 未验证
L3_UNVERIFIED=13 项：DOM/文案、键盘焦点、响应式、候选搜索、whole-save、generated 239、owner HTTP/事务、production-tag predicate、Flyway/DEV 数据、acceptance、performance、seed、DEV/browser L2/UAT/deploy/cleanup
SAME_ROOT_SCAN=已完成 option relation、operation/budget、legacy migration、production-tag consumer、numeric rules、acceptance、visible copy、problem/status 八个有限全集扫描
DESIGN_GAPS=option effect 当前事实住址；resolve 当前 consumer 与可执行 budget calibration；legacy preflight/disposition；production-tag candidate usage/cursor identity；120/1000/86400/control/case 权威；acceptance operation identity rebalance；BOM 业务文案；problem 分组与陈旧逐字文本
EVIDENCE_TIER=STATIC_ONLY；静态已证、测试已证 NONE、L3 无人验证已逐项列出
```

## 10. 授权边界

本 verdict 只表示 `REVIEW_TARGET=DESIGN` 的 Round 1 独立审查结论，不授权 implementation、test、DEV、reset、seed、browser L2、UAT、deploy、data operation 或 Git。
