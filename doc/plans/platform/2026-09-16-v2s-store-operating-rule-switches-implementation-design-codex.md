# 门店经营规则开关 · 详设

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0  
STATUS=IMPLEMENTATION_COMPLETE_AWAITING_REVIEW
BUSINESS_SOURCE=doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md  
JOURNEY_REFS=doc/decisions/2026-09-16-v2s-store-operating-rule-switches-journey-codex.md  
INTERACTION_REF=doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-interaction-design-codex.md  
IA_REF=doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-ia-design-codex.md  
OPERATION_MAPPING_REF=doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-operation-mapping-codex.md  
IMPLEMENTATION_AUTHORITY=true
DEXTER_WIREFRAME_REVIEW=CONFIRMED
AUTHORIZED=详设与实施计划修订 + production code | codegen | migration | build | test | backend acceptance | reset | DEV | seed
NOT_AUTHORIZED=browser L2 | UAT | deploy

## 1. 目标与边界

本批把“门店具备什么经营能力”作为 Store owner 的独立事实，解决两个问题：有权限的 GROUP/REGION/PROJECT 用户能在既有门店编辑 Drawer 保存 12 项规则；唯一已有消费者 catalogManagementEnabled 能在三张门店经营页面给出准确 UI，并在所有 52 条相关 STORE mutation 上由服务端不可绕过地拒绝。

本批同时补齐 Store 编辑字段和四类 Business Entity 的逐字段审计，因为共享 BusinessEntityValueSupport 是既有事实。四实体范围是需求 §7.3 的推论，不是重新解释 Dexter 裁决；若要缩为门店单类，实施前必须回 Dexter，不得自行收窄。

不建设终端、独立能力总览、商品数量上限、功能建设状态标识、通用规则引擎、审计新页面或查询端点；也不改变 Store 的既有状态生命周期、scope、grant、幂等、CAS、owner readback 和原有商品/库存/菜单业务规则。

## 2. 方案比较与选择

| 方案 | 结论 | 原因 |
| --- | --- | --- |
| A. 将 12 项塞进 extension_values，复用扩展字段渲染 | 不采用 | 扩展字段是租户定义/版本化数据；规则是平台闭集、树关系和授权事实。混用会令租户定义变化意外改变能力，且不能提供唯一 parent/default 声明。 |
| B. 后端、operations 前端、platform 前端各维护一份常量树 | 不采用 | 任意一处加键/改 parent 就会出现不同 effective 值；审计和 wire 也无法被类型系统覆盖。 |
| C. contracts 中一个 rule catalog，生成 OpenAPI 组件、后端 evaluator、operations 前端 evaluator | **采用** | 12 项闭集小、当前只有两个运行消费者；生成物消除关系/类型/默认值的手写副本，又不引入运行时配置服务。 |
| D. 仅三个页面前端空态，不加后端 gate | 不采用 | 直接调用 mutation 即可绕过，开关不是授权。 |
| E. 新能力总览页面/全局 store 读取规则 | 不采用 | 违背裁决且引入第二入口/第二状态住址；既有显式 Store 详情 owner read 可提供事实。 |
| F. 只把动态字段显示为“字段变更” | 不采用 | 定义改名/删除后无法读出审计对象，且未满足“直接看出改动项”。 |

## 3. 单一声明、生成与 contract

### 3.1 唯一输入

新增 contracts/catalog/store-operating-rule-switches.json 与紧邻 JSON schema。每个 definition 只有 key、中文 label、type、defaultValue、可空 parentKey、displayOrder。声明类型闭集固定为 `BOOLEAN`、`NUMBER`、`STRING`，默认值分别固定为 `false`、`0`、空字符串；当前输入恰为需求 §3.1 的 12 项、两根和四层树，当前实例仍是 11 个 BOOLEAN 与 1 个 STRING、0 个 NUMBER，JSON null 不作为默认值。

校验器必须在生成前拒绝：重复 key、非 BOOLEAN parent、缺失 parent、环、非法类型、与 `BOOLEAN`/`NUMBER`/`STRING` 不符的默认值、display order 重复。它不从 UI、数据库或 OpenAPI 反推树。生成失败是技术失败，不可生成半份产物。

### 3.2 生成链

新增 scripts/generate/store-operating-rule-catalog.mjs，由一个 catalog 生成三个受控输出：

1. contracts/openapi/components/organization/store-operating-rule-schemas.generated.json：按声明类型生成固定 key、默认值与 definition/read model 所需 enum；产物支持 `BOOLEAN`、`NUMBER`、`STRING` 三成员闭集，当前实例为 11 个 BOOLEAN、1 个 STRING、0 个 NUMBER，`required` 恰为当前全部 12 个 key，additionalProperties=false 的 OrganizationStoreOperatingRuleValues。OrganizationStoreCreateRequest 可省略该 property；OrganizationStoreUpdateRequest 必须把该 property 列入 request `required`。任一携带 values object 必须是当前完整的 12 键 object。
2. apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/domain/generated/StoreOperatingRuleCatalog.java：definition 列表、按 key 查找、默认解析、applicable/effective 纯函数和 source hash。
3. apps/frontend/operations-admin/src/app/api/generated/storeOperatingRuleCatalog.ts：同一 definition 列表、typed key/value、applicable/effective 纯函数和 source hash。

contracts/openapi/components/organization/store.schemas.json 只引用第 1 项，不手写 12 个 property；edge-codegen.mjs 再从已生成 OpenAPI 产生 Java/TS wire 类型。生成命令链先运行 catalog generator，再运行现有 edge generator；两者都要有 --check，使 source/三个输出/OpenAPI wire 任一漂移均失败。生成物带 source hash 和 Generated banner；消费处只能 import generated catalog/type，不能再写 parent/default/key 字符串。

这不是“生成器为一个字段过度设计”：父子关系必须被 backend、operations Drawer、operations capability gate 和审计 label 同时消费；手写四份会直接违反 R-3.3。它也不让 platform-admin 增加 rule catalog 消费：platform 读取 audit 的 label snapshot，不承担规则判定。

### 3.3 Store wire

在既有 OrganizationStore、OrganizationStoreCreateRequest、OrganizationStoreUpdateRequest 中引用 OrganizationStoreOperatingRuleValues。Update request 的 `required` 必含 operatingRuleSwitches，operations UI 提交完整 12 键对象；Create 接受可选的完整对象，省略时 Store owner 写入空 object 并由 defaults 解析。当前 StoreCreate Drawer 不增加本批规则控件，避免把未经交互确认的输入面塞进创建任务；受管 seed 和未来 API caller 需要非默认值时必须显式给出完整对象。owner 仍以 default resolver 读取历史/空 JSON，故已存在或未来新增 key 不依赖数据库回填。

规则错误分两层处理：请求格式错误、错误的 JSON 根形态、未知 key、缺少 required key、JSON 值类型错误等能由 OpenAPI/Jackson schema 绑定判定的形态，在进入 Store owner 前返回现有 contract validation 的 400 Problem，不冒充 422，也不承诺字段级首项聚焦；通过 schema 的请求若仍违反 owner 才能判定的业务/声明一致性不变量，才返回 `ORGANIZATION_STORE_OPERATING_RULES_INVALID`（422），并在 problem 中携带可定位的 rule key 时由 Drawer 聚焦首个非法项。父 false、子 true 是 R-5.1 明确允许的合法组合，不能被 owner 当作 422。

Update 使用完整对象而非 partial patch 是本批最小且明确的语义：规则是一组同一次 CAS 保存的配置，省去“缺 key 是保留、删除还是默认”的歧义；遇到后续 catalog 新键时，同一生成批的前端、契约和 owner 一起更新。Create 的 omission 是默认语义而非 patch，不保留 dual-wire fallback。

## 4. 存储、owner 写入与事务

### 4.1 物理事实

新增一条 additive Flyway：在 organization.store 增加 operating_rule_switches JSONB NOT NULL DEFAULT empty-object，仅允许 object。该列与 extension_values 并列，不加索引：本批不按规则查询/排序/筛选，只按 Store 主键读写。reset 后没有“存量回填”工作；空对象由 generated default resolver 解释。

StorePersistence 的 insert、read projection、CAS update 与 StoreServiceSql 必须同时覆盖该列。SQL 常量按 Store 规则事实命名，不能用编号式 SQL 名；同一 owner 仍是 organization，不能让 catalog/inventory/sales-menu 直读 organization.store。

### 4.2 Store command 流

既有 StoreService.createStore/updateStore 在同一个 REQUIRED transaction 中：

1. 保留既有 workspace scope、BC-ORG-STORE-EDIT grant、关系与 extension definition revision 校验。
2. Update 以及携带 values object 的 Create，用 generated Java catalog 校验完整 rule object，解析 effective/default map；Create 省略该 property 时只保留 empty object 的存储事实并由 resolver 计算 defaults，不依赖前端判定。
3. 将规范化规则 map 加入内容派生 idempotency request hash；这属于设值类，不改变既有“重放相同结果”的语义。
4. 执行 Store insert/CAS update、extension replace 和 operating rule JSON 更新。
5. 用权威 Store readback 组成 response；不能由 request echo 伪造。
6. 在同一 transaction 构造审计候选并经精确 allowlist 写入；审计值截断发生在审计投影层，不能抛回中断合法业务写。

前端不计算权威 effective 值来代替 owner。它可以使用 generated TS evaluator 呈现 disabled 子项，但 owner 会再次验证 type/key/tree。三个门店商品、库存、销售菜单 host 统一复用既有 organization owner 的专用 Store-target 读取 `getOperationsOrganizationStoreOperatingRule`（路径 `/api/operations/group-workspaces/{groupWorkspaceKey}/organization/stores/{storeId}/operating-rule-switches`），其中 `storeId` 必须来自当前已选 Store 的 `queryContext.scopeRef`；服务端调用既有通用 `user.resolveTaskScope(session, STORE, storeId)`，以显式 STORE target 复核目标，并同时校验 selected Project 与 Store 的归属。GROUP/REGION/PROJECT assignment 通过 Store 所属项目的祖先路径可读，STORE assignment 只可读自身；不得再使用绑定 Store-management PROJECT target 的 `getOperationsOrganizationStore` 或从 session ambient store 隐式派生的 `getOperationsStoreProfile` 作为本批三 host 的规则事实住址。

## 5. 审计模型与四种空

### 5.1 为什么必须升级 audit payload

当前 AuditChange(fieldKey,beforeValue,afterValue) 与 AuditChangeJson 把 missing/null 都编码为没有属性，既没有字段标签快照，又把空串 renderer 写成 value-or-dash。它无法满足 R-10.3、R-10.10 或“定义改名/删除后的历史可读”。

采用新增、向后可读的 audit event shape：

| 字段 | 新事件规则 |
| --- | --- |
| fieldKey | 保留稳定技术 key；最大 120。 |
| fieldLabelSnapshot | 可空、最大 120；写入时记录字段当时中文标签。 |
| beforeState / afterState | 必填 enum：MISSING、NULL、CLEARED、VALUE。 |
| beforeValue / afterValue | 仅 state=VALUE 时可有 text；空字符串合法且与其他三种空不同。 |

旧 audit JSON 没有 state 时，codec 明确标为 legacy-unclassified（仅 reader internal marker，不伪装成第五个新业务值）；UI 显示“历史记录未区分空值状态”。这比猜一个 MISSING 更小且诚实：历史原字节没有提供可恢复区分。

### 5.2 正规化与截断

扩展字段按需求 §7.2.1 规范化：TEXT 原文本、NUMBER canonical numeric text、DATE 既有 canonical date text、BOOLEAN true/false、SELECT option value。规则 BOOLEAN 同样记 true/false；规则 STRING 记原文本。所有标量经过唯一 AuditDisplayValueNormalizer：

- 输入长度不超过 2000：原样记录；
- 超过 2000：保留前 2000 减 suffix 长度的 Unicode code point，再追加固定 “…（已截断）”；
- 截断不改变业务持久化值，不拒绝 command，不丢弃 change；尾随文案是可见、可审计的截断标志。

MISSING 表示写前/创建对象中 key 从未存在；NULL 表示历史 JSON 的显式 null；CLEARED 仅由 ExtensionSubmission.CLEAR 的操作意图产生，即使持久化后的 key 已不存在；VALUE 加空字符串表示真实空字符串。CREATE 的“未填写”是 MISSING，不把 absent 强行审成 CLEARED。

既有可空标量字段使用 `AuditChange.forNullableScalar`，明确把 before 的 null 表示为 MISSING、after 的 null 表示为 CLEARED；需要区分显式 NULL 时必须使用 AuditChange 的完整六参构造，不得使用可空标量工厂。

### 5.3 动态 key policy 与四实体

AuditChangePolicy 仍是闭集安全边界，不能放宽为任意 extensionValues 前缀。它新增“静态允许键 + 本次已读取 definition 的精确 dynamic key 集”入口：

- 固定 Store/Business Entity 字段和规则键由 generated/catalog 静态集加入；
- 动态扩展字段只从本次 validation 使用的 current ExtensionDefinition 构造，例如 extensionValues.floorLabel；
- 每项动态 change 同时带 definition 的 label snapshot；
- 不在本次 definition 的 key 仍被 allow 拒绝，故不会把任意 payload 写入 audit。

BusinessEntityValueSupport 负责品牌、经营租户、总公司、门店的 core/notes/extension diff，接受一个纯 ExtensionAuditContext 而非 JDBC/HTTP helper；各 owner service 传入它已用于 validation 的 definition。Store 再附加 generated operating-rule diff。这维持“同类四实体同表示”，不新造跨 owner 写服务，也不让 audit model 知道 organization persistence。

### 5.4 历史读出口

OpenAPI AuditChange、edge generated types、AuditChangeJson 和两端 audit modals 同批升级。operations/platform UI 的 label 优先顺序固定为：snapshot → 既有固定 core map → “字段（fieldKey）”。经营规则事件本批起总写 label snapshot，platform-admin 不消费 operations 的 generated rule catalog，也不新建跨 app import；不存在 snapshot 的历史规则行按最后一项显示 key。扩展字段删改后，新记录仍有 snapshot；旧无 snapshot 行只显示 deterministic key fallback。两个 Modal 各自在自己的 audit-history feature 对 generated state 做穷尽 typed switch，并针对本节同一组 MISSING/NULL/CLEARED/VALUE fixture 断言相同用户可见结果；不得继续 value-or-dash 条件或新增业务 label map。

## 6. 后端 capability gate 与 270 条闭包

### 6.1 gate

新增 organization public API：StoreOperatingRuleGate.requireCatalogManagementForStoreTarget(workspaceUuid, groupWorkspaceKey, targetType, storeId)。调用方先完成自己的会话、目标与 owner 授权复核；gate 只确认目标是 STORE，由 Store owner 在显式 `readOnly` 事务边界内权威读取当前规则并计算 catalogManagementEnabled effective，false/Store read failure 时抛 typed failure。该只读事务在 gate 返回后结束；资产 staging 仍在此边界之外完成对象存储 I/O，再由 asset owner 开启自己的写事务。它不查询 catalog/inventory/sales-menu 数据、不写数据、不接触 UI。

专用 `getOperationsOrganizationStoreOperatingRule` GET 返回完整 `OrganizationStore` 聚合；controller 以一个请求级 `readOnly` 事务包住 session、Store-target scope、organization detail/entity、规则 owner read 与 contract status read，使这些只读 owner 事实在同一快照和连接边界内完成。该读事务只属于这个聚合 GET，不延伸到任何 command 或资产对象存储 I/O。

本批的两个新增业务码是 `ORGANIZATION_STORE_OPERATING_RULES_INVALID`（422）与 `ORGANIZATION_STORE_CATALOG_MANAGEMENT_DISABLED`（403，detail 为“功能尚未开启，需项目对门店授权”）。两者先登记到 error disposition catalog，作为 code ownership/metadata 的唯一输入；operation closed set 的唯一输入则是活动 `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` 的 `errorSets + operationErrorAugmentations`（可选 replacement rule 仍按该 catalog）。其中 422 只追加到 `createOperationsOrganizationStore`、`updateOperationsOrganizationStore` 两个 operation；403 逐条追加到 mapping 的 52 个 MUTATION operation。随后由 `scripts/generate/r5-edge-materialize.mjs` materialize 这 54 个 operation 的 path `x-error-codes`，再由 `edge-codegen.mjs` 生成 EdgeProblemCode/edge wire；禁止手改 materialized path 或 generated 输出。两个 code 均进入 ContractProblemAdvice 与适用的两 app feedback map。不得重用 SALES_MENU_STORE_DISABLED，因为那是 Store 生命周期 disabled；也不得用 PLATFORM_COMMON_ACCESS_DENIED 抹平“有权限但能力关闭”的业务原因。

### 6.2 完整映射与落点

唯一分母和每行 adapter/path/分类见 operation mapping 附录。其 source hash 下：

- registry 270 条完整枚举（新增专用 operating-rule read 后的当前实现分母）；
- 89 条是 operations-admin 的 STORE 目标可能操作；
- 34 READ 与 3 PREFLIGHT 依 R-9.3 不 gate；
- 剩余 52 MUTATION 是本批 gate 分母，均在目标已解析、第一次 owner mutation 前调用同一个 API；
- 181 条非 STORE operation 显式不适用。

对每条 52 mutation operation，implementation 必须在活动 edge catalog 的 `operationErrorAugmentations` 增加 403；对 Store create/update 两 operation 增加 422。`r5-edge-materialize.mjs` 必须据此写入 54 个真实 path component 的 x-error-codes。error-code disposition catalog 的 operationClosedSet policy 要求 base error set 与 per-operation augmentation 一致；当前 OTP 十项不是普通业务接口的完整名单，不能以“文件无七条旧白名单”为由跳过完整登记。

target 为非 STORE 的同一 adapter 只能通过原路径，gate 必须短路返回，不可误把品牌/项目操作拒绝。反之，前端未开通 surface、绕过 UI 的 HTTP call、批量状态变更、三种复制类命令、资产和销售菜单旁路都必须落入同一 owner gate。

## 7. 前端消费与 cache

### 7.1 operations Store Drawer

StoreEditDrawer 只增加 generated catalog 驱动的“经营规则”分组；复用 adminDrawerSurfaceProps、useDrawerFormLifecycle、useOverlayLock、当前 Form 和 Store update mutation。它不新建详情 Drawer、hook 的第二 submitting state 或父子关系常量。保存 payload 含完整 normalized map，成功以 owner response 回填。

### 7.2 三个 consumers

新 app-local `OperationsStoreCatalogManagementDisabledSurface` 是三个 host 的唯一领域组件，位于 `apps/frontend/operations-admin/src/app/components/OperationsStoreCatalogManagementDisabledSurface.tsx`。它不是 foundation 泛化：foundation 没有“门店商品能力关闭”这一领域事实；也不放在任一 feature 的私有 `ui/` 目录，避免三个 host 形成跨 feature 私有 UI 依赖。调用点只有这三个同义 host。

每个 host 先用专用 `getOperationsOrganizationStoreOperatingRule` 的 owner response 读取 operatingRuleSwitches，path 的 `storeId` 取当前 `queryContext.scopeRef`，服务端以 STORE target 重新校验该 Store 属于当前已选项目和当前 assignment 可见范围；不得把 `scopeRef` 仅作为 RTK cache key。Store rule loading/failed/false 时业务列表与业务 action 子树不 mount。false 时不发列表请求；true 时保留各页面已有 query、刷新、分页、详情和 action 生命周期。Store rule 读取失败用专门中文+可执行 refetch，不把失败降级为 false。Shell 刷新和 Store 切换也必须重新读取显式 Store-target rule read，满足前端规范 §3-J；本批不修改既有 `getOperationsStoreProfile` 与 Store-management detail 的其他历史调用者。

### 7.3 审计前端

operations/platform 各自已有 audit-history feature，只改现有 Modal 的 label/value rendering 及 generated type 消费。若实现前发现两 app 可复用的 foundation audit display primitive 已存在，必须优先消费；当前静态盘点未发现这种导出，不能为两处只有内部展示的变化仓促新增 foundation API。两个 app 只共同消费 edge generated enum/type；各自在自己的 feature 用穷尽 typed switch 渲染，并以同一组 fixture 断言同一用户可见结果，不新增跨 app helper 或复制业务 label map。

## 8. 机制总表

| 机制 | 本批确定做法 |
| --- | --- |
| 读侧节点授权 | 三个 host 使用显式 `getOperationsOrganizationStoreOperatingRule` Store-target read；由既有通用 `resolveTaskScope(session, STORE, storeId)` 保留 selected Store、selected Project、assignment path 复核；browser route 和未经服务端校验的 cache key 不作为授权。 |
| 写授权与 grant 复核 | 配置复用 BC-ORG-STORE-EDIT；gate 不替代原 operation capability/grant。 |
| 跨 owner 写与事务 | 规则事实由 organization owner 写；其他 owner 只调用 organization 公共 gate/read API，仍各自保持原 REQUIRED transaction。 |
| 集合与分页 | 12 rule 固定集合不分页；audit 沿用既有分页；不引入新列表。 |
| 缓存失效/刷新 | Store update 以 owner readback 更新；显式 Store detail 随 Store/context/统一 refresh 重新读取；不造 state mirror。 |
| RTK 数据读取与加载 | 变参数 list/detail 用 currentData + isFetching；显式 Store detail 以 `storeId=scopeRef` 隔离当前 Store，不借旧 Store 数据，失败/加载不 mount business subtree。 |
| 同一事实一个住址 | catalog 是声明住址；Store JSON 是值住址；显式 Store detail RTK query 是当前 consumer read cache；无 Redux/local rule mirror。 |
| 失败可见 | rule/Store detail failed、422、409、403 都在当前任务面给出准确原因；不改写为网络错误。 |
| owner error HTTP mapping | 新 403 code 进入 catalog/generated advice/OpenAPI/feedback；现有 error 链不删。 |
| 幂等 | Store set command 的 canonical hash 加完整 normalized rules；不改变增减类业务命令策略。 |
| generated strings/types | parent/default/key/type 和 rule labels从 catalog 生成；audit state/error code 从 edge generated type 消费。 |
| 日志 | gate 拒绝与 Store rule validation 在实际 edge/owner 边界按既有结构化脱敏日志记录 operationId、store ref hash、rule key、correlationId；不记录完整 rule JSON/扩展值。 |
| migration | 一个 additive JSONB column migration；无 index、无 backfill、无 reset/seed 执行于本次。 |
| shared frontend foundation | 复用 Drawer/lifecycle/overlay/testId foundation；operations app 在 `features/store-management/storeManagementTestIds.ts` 集中本批实际动作 testId；未有该领域 empty surface，不把三 host 组件过度泛化到 foundation。 |
| candidates | 无候选新接口；openPlatformDeveloperCode 仍 STRING。 |
| encoding/names | 所有用户文案中文；rule key、error code、audit field key 为稳定技术标识，不当作用户文案。 |
| atomic groups | Store资料、extensions、rules、CAS、readback、audit 在同一 Store command；其他 52 mutations 在 owner mutation 前 gate。 |

## 9. seed、未核实项与验证设计

### 9.1 seed

受管 seed 已修改 doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json 的所有可体验 Store fixture，显式放入 operatingRuleSwitches 的完整对象，其中 catalogManagementEnabled=true；scripts/dev/owner-command-seed-executor.mjs 在 createOperationsOrganizationStore payload 传递它，并在 owner readback 中断言 true。不能依赖默认 false，否则 reset 后商品/库存/菜单体验全部被正确 gate 掉。

已在本批授权内执行受管 reset、DEV、seed；详见本节 9.3 与《实施结果/P9 对账》文件。DEV start/restart 仍不执行 seed，当前 DEV 在 acceptance 完成后已恢复并保持运行。

### 9.2 详设核实结果

对 collaboration 的当前静态搜索只找到外部平台 provider catalog 的 MEITUAN_ISV_A/B，未找到“开放平台开发者”或可供 Store 选择的 ISV 编码实体。这不足以证明全仓绝对不存在，故状态是 UNVERIFIED_REQUIRES_EVIDENCE；当前仍依冻结需求采用 STRING 空串默认值，不新增候选 API。若后续要把它当权威外部标识，必须以对应 owner/契约重新裁决。

审计读出口已核实没有动态标签表，且历史只存 key/scalar。因此本详设采用 label snapshot；这不是额外产品功能，而是满足 R-10.3 在 rename/delete 后仍可识别改动字段的最小持久事实。

### 9.3 已执行验证与受限范围

本批已按授权完成静态、focused、远端 backend acceptance、reset、DEV 与 seed；业务结果和 cleanup 结果分开判读，完整逐代码对账见 `doc/review/platform/2026-09-17-v2s-store-operating-rule-switches-implementation-reconciliation-codex.md`。

- catalog generator 的四类非法声明 red mutation 与合法生成正例通过；OpenAPI、Java/TS 生成物与 operation bindings 均以 `--check` 通过。
- mapping 当前 registry 与附录均为 270 条，52 条 STORE mutation 全量逐行核对；远端 acceptance 对批量状态变更、品牌复制以及 Store rules 读写均有真实场景。
- focused frontend/backend/architecture/seed tests 已通过；远端 Gradle test 为 `BUILD SUCCESSFUL`。已知与本批无关的 code-layout 空目录、Java UTF-8 行长基线和 terminal readability 基线分别保留为非本批静态观察，未冒充本批 PASS。
- 最终受管 run `r5-tc-1789578383813-98101`：远端 Gradle PASS，business PASS，Testcontainers container/volume cleanup PASS，证据归档 PASS，DEV restore PASS；测量 operation set 270/270、unclassified SQL 0、CP05 budget exceeded 0。
- reset、DEV、seed 均保留独立 manifest；seed 对所有体验 Store 显式传 `catalogManagementEnabled=true` 并由 owner readback 校验。browser L2、UAT、deploy 仍为 `NOT_AUTHORIZED`，没有用静态或 backend evidence 替代它们。

## 10. 实施完成与 review 状态

Dexter 已确认低保真视觉 IA；Claude 第 2 轮独立 DESIGN review 后，M-01/N-01 已修复并授权进入生产实现。M-01 的实现是独立 Store-target operating-rule read，使用显式 `storeId` 和 `resolveTaskScope(session, STORE, storeId)`，并由项目层、门店层 acceptance 双向验证；N-01 的当前字节口径是 `commandBoundary` 属于 operation 条目字段，`kind` 与 `commandCount` 属于 registry root 统计字段。

生产实现、生成、构建、focused test、远端 backend acceptance、reset、DEV、seed 已完成；P9 逐代码对账为 `MATCHED` 且无 OPEN。当前仅等待 fresh `REVIEW_TARGET=IMPLEMENTATION` 的独立静态 review，不能把本详设或受管运行结果写成 Claude review GO。

## 11. 精确实现锚点与机制对账

| 机制 | 唯一/既有落点 | 新实现必须保持的形态 | 最低可证伪观察 | 全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | `getOperationsOrganizationStoreOperatingRule` 专用 Store-target operating-rule path；`OperationsStoreOperatingRuleController` | `storeId` 从当前 `queryContext.scopeRef` 传入，服务端经既有通用 `resolveTaskScope(session, STORE, storeId)` 与 selected Project、assignment path 复核；不以 ambient session profile 作为本批事实 | cross-scope/非当前 assignment 的 operating-rule 读取被 edge 拒绝 | 三个 consumer host |
| 配置 grant | admin-catalog 的 BC-ORG-STORE-EDIT；StoreService createStore/updateStore | 保留 role/catalog/edge grant 复核，Store role 不新增权限 | STORE role grant red case | role create、role update、所有导入/生成路径 |
| 规则写事务 | StoreService.createStore/updateStore；StorePersistence；StoreServiceSql | 同一个 REQUIRED transaction 的 CAS、idempotency、extension replacement、rules、audit、readback | update failure 不留部分 rule JSON | create + update 两条 |
| 跨 owner gate | organization public API；mapping 52 adapter symbols | 其他 owner 只调用 typed public gate，不读 organization schema | replace gate with direct SQL/import 应红 | mapping 52 条 |
| 规则 read cache | 各 host 的 `getOperationsOrganizationStoreOperatingRule` query；`queryContext.scopeRef`；operationsContentTabRefreshSignal | rule query 无 local/Redux mirror，scope/refresh 时以显式 `storeId` 重新读取 | scope change 保留旧 Store rule read 应红 | catalog/inventory/sales-menu 三页 |
| Drawer 生命周期 | StoreEditDrawer；adminDrawerSurfaceProps；useDrawerFormLifecycle；useOverlayLock | rules 进入同一 Form 和 submitting truth；三种 close path 不分叉 | rule change 后遮罩关闭丢稿应红 | 1 Drawer |
| shared disabled surface | `apps/frontend/operations-admin/src/app/components/OperationsStoreCatalogManagementDisabledSurface.tsx`；现有 OperationsRequiredScopeSurface | 跨 feature 的 app-local 领域组件只保留一份；capability false 与 no-scope 不合并；三个 host 只 import 一个领域 surface | 任一 host 自写相同 copy 应红 | 3 hosts |
| error mapping | error disposition catalog；活动 edge catalog 的 errorSets/operationErrorAugmentations；r5-edge-materialize；EdgeProblemCode；ContractProblemAdvice；operationsProblemFeedback；platformProblemFeedback | 两个新 code 的 metadata 与 operation closed set 分离；403 覆盖 52 mutation、422 覆盖 Store create/update，再 materialize 到 54 paths | 缺任一 catalog source、materialized path、consumer map 或生成 enum/advice 应红 | 54 operation path + 2 feedback map |
| audit value codec | AuditChange；AuditChangeJson；AuditChangePolicy | four-state scalar、label snapshot、legacy explicit、truncate non-failing | empty string/null/missing/cleared 任两者合并应红 | all organization audit producers/readers |
| dynamic audit policy | ExtensionDefinitionService validation；BusinessEntityValueSupport | exact current-definition keys only；不放任意 prefix | undeclared key 被 allow 应红 | Brand/Tenant/HeadCompany/Store |
| generated declaration | 新 catalog generator；generated OpenAPI/Java/TS outputs | no manual relation/default/type copy | invalid parent/default/cycle generator red cases | 12 rules、3 outputs |
| migration | new Flyway + StorePersistence SQL | JSONB object/default no index/backfill | non-object input/persist invalid should fail | one Store column |
| seed | r5 full fixture；owner-command-seed-executor | explicit true/readback, not implicit default | fixture omits true then seed assertion red | every experience Store |

## 12. operation / path / face / 集合形态

| 业务意图 | operation / path 分母 | consumer face | 集合形态与增长驱动 |
| --- | --- | --- | --- |
| 配置/读取 Store rules | existing create/update/get Store + explicit `getOperationsOrganizationStoreOperatingRule` Store-target path in organization components | operations-admin | 一个 Store 内固定 12 项；不分页，规则增加只由 catalog declaration 发生 |
| 门店商品、库存、菜单授权 gate | mapping 附录的 270 rows；其中 52 STORE mutation、89 STORE-target-possible rows | operations-admin | 非集合 control；operation 增加由 registry 驱动，mapping 必须重建 |
| 审计历史 | existing platform/operations audit-history paths | platform-admin, operations-admin | 已有分页 audit event collection；增长随历史事件，不增加 endpoint |

每条 route 保留其单一 x-consumer-faces；platform-admin 没有 Store rule configuration route，只有既有 audit read。

## 13. 跨 owner 写矩阵

| policy | 第一个 owner command | 第二个 owner command | 事务 | 失败时回滚事实 |
| --- | --- | --- | --- | --- |
| Store 资料/扩展/规则保存 | organization StoreService | 无 | Store REQUIRED | Store row、extension values、rule JSON、audit 一体回滚 |
| Catalog/Inventory/Production/Asset/Sales-menu STORE mutation | 原有对应 owner command | organization read-only gate | 原 owner 既有 REQUIRED；gate 无写 | gate 拒绝在 owner mutation 前，原数据不变 |
| Audit event | organization Store/BusinessEntity command | audit-model contract writer（非 owner command） | 随发起 owner transaction | 审计表示错误不得让合法业务值超限失败；其他 audit persistence failure 维持既有 transaction policy |

没有反向 import：organization 不调用 catalog/inventory/sales-menu；其他 owner 不直写 organization schema。

## 14. 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| rule key/type/default/parent/label | contracts catalog | generated OpenAPI + Java + operations TS | Store validator, Drawer, effective evaluator, rule audit label | generator check + invalid red cases |
| stored values | Store JSONB column | Store readback wire | Drawer full Form, explicit Store detail, gate | owner create/update/readback cases |
| capability disabled | organization typed problem + path x-error codes | EdgeProblemCode / Advice / generated wire | 3 host surface and mutation feedback | direct HTTP rejection + feedback map test |
| audit identity/value state | AuditChange schema | JSON codec + edge generated wire | 双端 audit Modal | four-state/legacy/snapshot tests |
| cache refresh | IA-SOS-02 and frontend standard §3-J | explicit Store detail RTK request/refetch | enabled pages / disabled surface | selected Store/context/refresh focused case |
| logging/privacy | AGENTS observability standard | edge/owner structured logs | support diagnostics only | authorized runtime log inspection |

## 15. 需求规则到 owner 判定点

| 规则 | owner 判定点 |
| --- | --- |
| R-1/R-2/R-3/R-4/R-5 | generated catalog validator/effective resolver in organization StoreService |
| R-6/R-7/R-8 | existing Store edge grant + StoreEditDrawer lifecycle; owner remains authority |
| R-9.1/R-9.5 | operations explicit Store detail consumer + single shared surface |
| R-9.2/R-9.2a-c | mapping 52 adapter gate call before owner mutation |
| R-9.3/R-9.4 | no gate on 33 reads/3 preflights; no data delete/update on toggle |
| R-10.1-R-10.6 | BusinessEntityValueSupport/StoreService plus exact AuditChangePolicy |
| R-10.7 | existing OrganizationAuditHistoryService and two existing audit UI modals |
| R-10.9-R-10.12 | AuditDisplayValueNormalizer, four-state codec, label snapshot |

## 16. owner API 与消费者清单

| owner method/API | consumers |
| --- | --- |
| StoreOperatingRuleCatalog generated resolver | StoreService validation/readback; StoreOperatingRuleGate; operations StoreEditDrawer; operations explicit Store detail consumers |
| StoreOperatingRuleGate.requireCatalogManagementForStoreTarget | mapping 附录中的每一条 52 mutation adapter；零额外 consumer |
| `getOperationsOrganizationStoreOperatingRule` Store-target read | catalog-management、inventory-management、sales-menu 三个 host；`storeId` 明确来自 selected Store ref |
| AuditChangeJson v2 reader | OrganizationAuditHistoryService；operations audit Modal；platform audit Modal |

## 17. 全链同步变更清单

| 变更事实 | contract / generator | backend / migration | frontend | test / seed | 结论 |
| --- | --- | --- | --- | --- | --- |
| rule declaration | catalog + generated OpenAPI/Java/TS | Store validator/readback | Drawer/effective evaluator | generator tests | 同步修改 |
| rule values | Store schemas | Store JSONB/command/readback | explicit Store detail/hosts | Store unit + seed explicit values | 同步修改 |
| capability gate | problem catalog/x-error code paths | org gate + 52 adapters | shared surface/feedback maps | mapping/HTTP/architecture tests | 同步修改 |
| audit representation | common AuditChange schema | audit model + four entity support | dual modals | codec/owner/front-end tests | 同步修改 |
| seed experience | Store request schema | owner executor readback | N/A（体验通过真实 owner read） | fixture/executor/static seed test | 同步修改 |

## 18. migration、seed、验收与未决

### 18.1 数据迁移

| migration | 加/改什么 | 旧行回填 | 理由 | 回滚 |
| --- | --- | --- | --- | --- |
| V20260916 store operating rules | Store JSONB object column default empty object | 不回填 | default resolver 给缺失键唯一默认事实；reset 由独立受管步骤执行 | additive column 可回滚仅在未依赖新字段时 |

### 18.2 seed 全集

| seed 文件 | 受影响原因 | 处置 |
| --- | --- | --- |
| doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json | 造 Store command payload | 每个体验 Store 显式完整 map、catalogManagementEnabled=true |
| scripts/dev/owner-command-seed-executor.mjs | 调 createOperationsOrganizationStore | 传 map 并 assert owner readback |
| scripts/dev/r5-seed-plan.mjs | 当前 shape/static validation | 增加完整 map/explicit true red mutation |
| scripts/dev/owner-command-seed-executor.test.mjs | executor request/readback coverage | 覆盖 omitted true 为失败 |

### 18.3 acceptance 场景设计

| scenario id | owner 文件 | identity / fixture | request | business oracle |
| --- | --- | --- | --- | --- |
| store-operating-rule-save-readback | organization acceptance scenario | project editor + Store | create/update full map | authoritative readback 的 values/effective 与存储一致 |
| store-catalog-capability-closed | catalog/inventory/sales-menu acceptance scenarios | closed Store | 每种 mutation 直接 HTTP | 403 typed code 且目标业务 readback 未变 |
| store-catalog-capability-open | same owners | explicit-open Store | representative mutation per target shape | owner readback 真实发生 |
| audit-extension-four-empty | organization audit scenario | four entity fixtures | SET/CLEAR/legacy null/empty string | state/label/truncate exact可读 |

### 18.4 未决/停机

| 项目 | 当前状态 | 本批允许 | 本批禁止 |
| --- | --- | --- | --- |
| 开放平台开发者编码是否候选 | UNVERIFIED_REQUIRES_EVIDENCE | STRING 空串 | 伪造 collaboration lookup |
| 四实体范围 | DEXTER_ACCEPTED_REQUIREMENT_INFERENCE | 按当前四实体实现 | 静默收窄为 Store |
| wireframe | CONFIRMED_BY_DEXTER | UI 实施已完成；视觉确认不等于 L2 验收 | browser L2 仍不授权 |

必须停机回 Dexter：catalog tree/12 项发生产品变更；需把 STRING 改权威候选；四实体审计需收窄；target resolver 证实某 mapping row 不符合 STORE/non-STORE 分法；视觉确认要求改变 surface。其他上游 review finding 一律先 current-source 验证，不能自动接受。

## 19. 本批实施结果与证据索引

| 结果 | 当前事实 | 证据 |
| --- | --- | --- |
| M-01 读取路径 | 三个 host 使用显式 Store-target path；服务端调用 `resolveTaskScope(session, STORE, storeId)`；项目 assignment 与 Store assignment 均读到目标 Store | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsStoreOperatingRuleController.java`；`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/WorkspaceUserService.java`；`OrganizationAcceptanceScenarios` operating-rule 场景 |
| N-01 口径 | `commandBoundary` 保留为 operation entry 字段；`kind`、`commandCount` 保持 registry root 统计字段；需求正本与实现对账口径一致 | `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md` §12.4；`doc/review/platform/2026-09-17-v2s-store-operating-rule-switches-implementation-reconciliation-codex.md` §2 |
| 生成与契约 | catalog 三类型闭集、12 项实例、OpenAPI/Java/TS 产物与 edge wire 无漂移；operation bindings 270 条 | `scripts/generate/store-operating-rule-catalog.mjs`、`scripts/generate/edge-codegen.mjs`、`scripts/generate/operation-handler-bindings.mjs` 的 `--check` 输出 |
| gate 闭包 | 52/52 STORE mutation 在 owner mutation 前调用 typed gate；batch status、local/brand copy 与其余 mutation 已纳入映射 | `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-operation-mapping-codex.md`；reconciliation §3 |
| 受管运行 | 最终 backend acceptance business PASS、cleanup PASS、DEV restore PASS；reset、DEV、seed 各自独立留存 manifest；seed 显式开启 catalog/inventory/menu 并 owner readback | `.runtime/r5/evidence/remote-testcontainers/r5-tc-1789578383813-98101/run-manifest.json`；`.runtime/r5/reset/r5-reset-022c56a8-8b6e-4a69-af52-2c6d37a16cf6/run-manifest.json`；`.runtime/r5/seed/complete/complete-seed-68fc6676-6659-4472-8d18-9dd31d55f438/run-manifest.json` |
| review 状态 | 实施后独立静态 review 尚待 Dexter 转交 Claude；本文件不预判 GO/NO-GO | `doc/review/platform/2026-09-17-v2s-store-operating-rule-switches-implementation-review-request-codex.md` |

本节是当前字节的实施结果索引，不替代独立 review；动态 evidence 只证明已授权的 backend/受管环境边界，browser L2、UAT 与生产部署仍未授权。
