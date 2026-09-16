# 门店经营规则开关需求正本独立对抗评审

REVIEW_TARGET=DESIGN  
REVIEW_CYCLE_ID=V2S_STORE_OPERATING_RULE_SWITCHES_DESIGN_20260916  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
ACTION_1_VARIANT=1-B  
EVIDENCE_TIER=static read-only  
L2_USER_VISIBLE=NOT_RUN/UNAUTHORIZED（本轮只评需求稿，不评实现 UI）  
L3_UNVERIFIED=未进入实现与运行核验，故不把 UI 动态证据缺失记为代码缺陷

## 1. 评审范围与方法

评审对象是需求正本：
`doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md`。

讨论稿：
`doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-discussion-claude.md`，在源码和需求正本之后才读取，仅用于对撞，不作为事实正本。

本轮先恢复仓内执行入口、Roadmap 授权字段、全部 kernel 和六维 memory 路由命中原文，再按源码 owner、HTTP operation registry、契约和审计链核验，最后读取需求正本和讨论稿。没有把 handoff、聊天摘要、作者自审结论或旧 evidence 当作事实或授权。

独立 reviewer 留痕：fresh 只读 reviewer `Newton`（agent id `01a0a90e-de9d-7a21-9e6b-99c1f3157c85`）使用输入清单 `doc/review/platform/2026-09-16-v2s-store-operating-rule-switches-design-independent-review-input-checklist-codex.md`，先读源码后读需求稿，返回 `VERDICT=NO-GO`、独立计数 `M/S/N=1/2/0`。其报告未写入仓库；本文件是在收到该 verdict 后由主 agent 对当前字节逐条复核并记录的最终 intake。

本轮没有执行构建、测试、代码生成、DEV、reset、seed、UAT、部署或浏览器动作；以下结论全是静态证据，不能升级为运行验收。

## 2. 结论

VERDICT=NO-GO  
M/S/N=1/2/1

NO-GO 的原因不是七项产品裁决有误，而是需求正本还没有把核心授权闭包和审计值语义冻结到可审计、可反例验证的程度。独立 reviewer 的 `1/2/0` 结论被全部接受；主 agent 另确认一条不改变产品范围的 `N-01` 验收 oracle 记录，因此本文件的最终计数为 `1/2/1`。

## 3. Findings

### M-01：R-9.2 没有冻结 STORE mutation 的可验收分母

`STATUS=CONFIRMED`  
`TYPE=仓内事实`  
`SEVERITY=M`

需求正本第 241 行只冻结了“会不会改变该门店三类数据”的原则，并在第 241、301 行点名若干例子，同时把“先枚举全部入口”放到了详设；第 325 行还把三域校验的具体落点交给详设。这个原则方向正确，但没有在需求层形成可逐入口对账的闭集。

证据：

- 需求：`doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md:241`、`:301`、`:325`。
- operation 注册表：`contracts/registry/operation-handler-bindings.json:109-477`、`:605-685`、`:3613-3709`、`:3853-4317`。按当前 JSON 的 `face=operations-admin`、`mode=COMMAND` 静态重算，相关 operation 共 55 个：catalog 27、fulfillment-production 3、inventory 4、asset 2、sales-menu 19；其中 local/brand/temporary copy 的 3 个 preflight 不是 mutation，剩余 **52 个 mutation operation**。
- catalog/inventory/asset edge：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java:381-930`，覆盖 item 单条与批量状态、category、dictionary、unit、attribute definition、order option definition、production tag、copy、temporary promotion、inventory target、catalog asset 等族。
- sales-menu edge：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/OperationsSalesMenuController.java:254-632`，以及 `OperationsSalesMenuAssetController.java:48-125`，覆盖菜单/分区/item 的创建、复制、删除、移动、重命名、发布、渠道开关、手工售罄/恢复、item 与 asset 生命周期。
- owner operation requirement：`apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceCapabilityRequirementCatalog.java:11-46`、`:49-119`，显示这些 operation 不是一个页面内的两条旁路，而是分布在多个 owner 和 requirementId 中；catalog 的 STORE 映射还由 `CatalogOwnerScopeSupport.java:22-58` 做 owner/scope/grant 复核。
- sales-menu 的特殊 disabled-target 路径：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/salesmenu/SalesMenuEdgeSupport.java:112-126`，publish 为返回 typed disabled blocker 而允许进入 owner；新开关的拒绝规则必须明确覆盖这条 mutation 路径，不能只在“正常启用目标”分支接 gate。

当前源码没有因此被判定为已经存在一个绕过开关的实现缺陷，因为开关尚未实现；本 finding 针对的是需求闭包不足：仅按“单条创建、批量状态、品牌复制”抽样，无法保证 local copy、temporary promotion、production tag、category/dictionary/unit/attribute/order-option、inventory count/increase/adjust/configuration、catalog/sales-menu asset，以及全部 sales-menu command 都被逐个分类和接入。

边界与反例：

- 三个 preflight 只做预检，不能直接算作“改变数据”的 mutation；但需求仍应明确它们在开关关闭时是允许、拒绝还是只返回受限的预检结果。
- `HEAD_COMPANY` 等非 STORE 目标不能误收进 STORE gate；同一路由里的目标类型必须逐操作、逐目标判定。
- R-9.3 的读放行和关闭后保留历史数据是合理边界，不是本 finding 的问题。

最小修复：在需求正本 R-9.2 或紧邻附表冻结一份 operation-family 级的入口清单，至少列出当前 52 个 mutation、3 个 preflight 和所有 STORE/HEAD_COMPANY/品牌目标反例，逐项标记“真实 mutation / 只读 / preflight / STORE 目标 / 现有 owner grant / 需接入的开关 gate”。详设仍可决定 gate 的函数位置、错误码和调用顺序，但不能再决定本需求的验收分母。若未来新增 operation，必须先完成同样的分类。

为什么不是更小方案：只保留“详设先枚举全部入口”仍让需求验收无法判断详设是否漏了入口；只扩大 V-2 的文字或再增加一条旁路也不能覆盖 operation registry 中的完整族。这个修复不要求新框架或重写 owner，只把当前已有的 52 个 mutation 归类并冻结为审计分母。

### S-01：ExtensionFieldType 的计数口径错误且内部互相矛盾

`STATUS=CONFIRMED`  
`TYPE=仓内事实`  
`SEVERITY=S`

需求正本第 169 行把闭集写成“1 个契约正本 + 3 个生成产物 + 3 个手写副本 = 7 处”，第 207 行又写成已有“4 份拷贝”。当前源码不能按同一口径复现这两组数字。

证据：

- 契约正本：`contracts/openapi/components/extension/extension.schemas.json:195-203`。
- 生成产物：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/wire/ExtensionFieldType.java:4-9`、`apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts:3453`、`apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts:1590`，确为 3 处。
- 手写的运行时闭集至少有 5 处：`apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java:493-506`，`apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionFilterQuery.java:23-27`，`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityValueSupport.java:37-48`，`libraries/frontend/admin-ui-foundation/src/extension/typedExtension.ts:1`，`libraries/frontend/admin-ui-foundation/src/extension/invalidFilter.tsx:4-8`。
- 另有展示/编辑映射：`apps/frontend/platform-admin/src/features/extension-management/ui/ExtensionsPage.tsx:23-24` 与 `ExtensionDefinitionEditDrawer.tsx:39-51`。它们不应与运行时校验冒充同一种副本，但必须在计数口径中单独说明。

因此，R-3.3“父子关系与判定逻辑不能由两端各自维护”的方向仍然成立；不成立的是用“7 处”和“4 份”支撑该结论的事实表述。若后续只照着错误数字设计生成覆盖，会漏掉 filter 解析、invalid-filter 反馈或编辑器取值等实际同步面。

最小修复：把 §4.3 改成分类计数，而不是一个混合总数：`contract source=1`、`generated=3`、`runtime validation/parsing=至少5`、`display/edit mapping=至少2`，并逐文件列出行号；明确展示映射可以是本地化适配，不等于父子/effective 的第二份业务声明。同步删除或改写 §4.6 的“4 份拷贝”表述。无需在本需求中重构已有 extension 实现，也无需为了消除少量 label map 引入新的通用框架。

为什么不是更小方案：只把 7 改成 9 或把 4 改成 5，仍然把生成物、运行时校验和展示映射混成一类，无法证明“单一声明驱动”究竟覆盖什么。

### S-02：逐字段审计的动态值表示与长度边界未冻结

`STATUS=PARTIALLY_CONFIRMED`  
`TYPE=仓内事实`  
`SEVERITY=S`

需求正本第 272-278 行要求备注、扩展值和开关逐字段审计，且动态扩展键不能因静态白名单抛错；第 309-311 行只要求“有 before/after”和“不抛异常”，第 326 行把审计键命名及策略放宽机制交给详设。它没有定义扩展值如何从动态 JSON 变成现有审计模型要求的 display-safe scalar，也没有定义超过长度上限时的行为。

证据：

- 需求：`doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md:272-278`、`:309-311`、`:326`。
- unknown key 的现有策略确实直接拒绝：`apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditChangePolicy.java:18-23`。这验证了需求正本 R-10.5 对第一层阻塞点的判断。
- 审计值只能是字符串或 null，且每个值最多 2000：`apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditChange.java:5-10`、`:20-23`；严格 JSON codec 不接受嵌套 before/after，只读写 textual/null：`apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditChangeJson.java:9-10`、`:21-30`、`:47-56`。
- 门店扩展值在当前更新契约中只是开放的 object，没有 additionalProperties 的值长度约束：`contracts/openapi/components/organization/store.schemas.json:516-519`。扩展值语义校验只检查 JSON 类型/日期/选项，未检查值长度：`apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java:772-787`；门店更新把动态值合并后写回：`apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/StoreService.java:518-553`。
- 动态 JSON 被组装成扩展 JSON 的位置是 `BusinessEntityValueSupport.java:54-65`；门店审计仍以固定 allowlist 执行 `policy.allow`，见 `StoreService.java:40`、`:602-623`。总公司同样有固定 allowlist，见 `HeadCompanyService.java:43`、`:727-739`；品牌和经营租户则直接写共享 helper 的 JSON，见 `BusinessBrandService.java:545-565`、`BusinessTenantService.java:573-593`。
- 共享 helper 当前只产出 code/name/status：`BusinessEntityValueSupport.java:68-84`。若按 R-10.6 扩大到 notes/extension，Store/HeadCompany 的 policy 还必须准许新增静态键和动态键；否则“放宽动态键”之外会先被现有白名单挡住，Brand/Tenant 也会发生历史审计输出变化。

可复现的反例是：一个符合当前扩展字段类型校验但其 TEXT 值超过 2000 的门店扩展值，能进入动态 JSON 存储；后续若按 R-10.3 创建 `AuditChange`，会触发 `audit display value is too long`。即使值未超长，NUMBER/BOOLEAN/DATE/SELECT 是输出为 JSON literal、原始值、还是用户显示值，SELECT 使用 option 原值还是 label，当前需求也没有冻结。缺失值、CLEAR、JSON null 和空字符串的区别同样未成为验收 oracle。

这里不把“只要扩大 allowlist 就足够”作为结论：allowlist 是第一层键准入，scalar 表示和长度是第二层模型边界。`R-10.6` 四实体范围已在需求第 282-286、347 行明确标为推论，可以由 Dexter 收窄；本 finding 不替 Dexter 做该产品裁决。

最小修复：在需求层增加一张审计值 oracle 表，冻结每种 `ExtensionFieldType` 的 before/after canonical 表示、null/缺失/CLEAR 的表达、SELECT 显示原值还是 label、超过 2000 的明确处理（拒绝保存或其他经裁决的可审计表示），并要求 Store/HeadCompany policy 与 Brand/Tenant 共享输出在该语义下闭合。只需补现有 `AuditChange` scalar 的业务语义，不需要新审计页面、查询接口或嵌套 JSON 审计模型。

为什么不是更小方案：只写“逐字段”和“不要抛异常”无法约束可读性、稳定性和上限；只放宽 field key allowlist 仍会在 `AuditChange` 构造处失败，或让不同实现以不同字符串形式通过同一验收。

### N-01：V-5、V-7、V-8 仍是负向/存在性 oracle，弱实现可蒙混

`STATUS=CONFIRMED`  
`TYPE=推论`  
`SEVERITY=N`

需求正本第 296 行要求每条判据都有可证伪构造，但第 304、306、307 行的构造仍不足以排除几类明显的假实现：

| 判据 | 当前构造 | 能蒙混的实现 | 最小补强 |
|---|---|---|---|
| V-5（第 304 行） | 只构造父 `false`、子 `true`，然后要求能力不可用 | 消费方永远返回 `false`，没有真正使用 `effective` 仍可通过 | 增加父 `true`、子 `true` 的正向控制，并明确同一 evaluator/consumer 在两组输入下分别允许与拒绝 |
| V-7（第 306 行） | 只构造四种非法契约并要求生成报错 | 生成器对任何输入都报错，负向测试仍全绿 | 增加一份当前合法契约必须成功生成的正向控制，并核对生成结果与契约闭集/父子声明一致 |
| V-8（第 307 行） | 只写“现有权限模型已保证，证明未被改动破坏” | 不执行 STORE 角色配置和拒绝写入构造，文档/静态存在性陈述即可声称通过 | 具体构造 STORE 角色尝试获得 `BC-ORG-STORE-EDIT`，并验证创建/更新角色和开关写入均被拒；同时保留 GROUP/REGION/PROJECT 正向控制 |

V-12 的“只要不抛异常”问题已包含在 S-02：必须同时断言审计记录的动态 fieldKey 和确定的 before/after，不能用吞异常或跳过审计假绿。V-2 的闭包不完整已包含在 M-01，V-10 的值表示缺口已包含在 S-02。

这是 N 而不是 M/S：补充一个正向控制或一条具体负向请求不会改变业务范围、权限模型或实现架构；但不补时，需求自称的“每条可证伪”并未真正成立。

## 4. 七个攻击点逐项结论

### 4.1 R-9.2 全部写入口

结论：`NO-GO`，见 M-01。当前 operation registry 静态分母为 55 个相关 command，其中 3 个 preflight、52 个 mutation。52 个 mutation 的族为：catalog 24、fulfillment-production 3、inventory 4、asset 2、sales-menu 19。需求正本点名的批量状态和品牌复制只覆盖其中少数入口；当前没有证据说明实现已漏 gate，因为实现尚未进入本轮评审，但需求必须先冻结分母和分类规则。

### 4.2 ExtensionFieldType 的 7 处计数

结论：`NO-GO`，见 S-01。1 个契约正本和 3 个生成产物成立；手写运行时闭集至少 5 处，另有展示/编辑映射。需求第 169 行的“7”与第 207 行的“4 份”不能同时成立。R-3.3 的单一声明方向不受影响，承重事实的计数必须修正。

### 4.3 角色赋权是否存在第三条绕过路径

结论：没有发现绕过 `BC-ORG-STORE-EDIT` eligibility 从而取得“开关编辑权”的第三条生产赋权路径，当前不记 finding。

证据：

- `contracts/catalog/admin-catalog.json:1181-1193` 的 `BC-ORG-STORE-EDIT` 只允许 `GROUP/REGION/PROJECT`；生成 catalog 的同一事实由 `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceAuthorizationCatalog.java:97-99` 承载。
- 角色创建、更新和权限替换都汇入 `WorkspaceRoleService.validateCatalogs`：创建 `WorkspaceRoleService.java:82-141`，更新 `:180-237`，平台代理 `:143-177`、`:240-276`，权限替换 `:278-297`，最终组织类型检查在 `:567-578`。
- 邀请创建只接受已启用且 service node type 匹配的既有角色：`WorkspaceInvitationService.java:268-281`；邀请完成虽直接调用 `persistence.createRoleAssignment`（`:918-955`），但它只分配已经存在的 role，不能修改 role 的 page/capability catalog。
- 全仓生产源码的 `createRoleAssignment(` 只有邀请 persistence/service 这条 assignment 路径；没有发现第二条生产 role permission mutation。

必须保留的区分：`EDIT_STORE_CATALOG`、`EDIT_STORE_INVENTORY`、`EDIT_STORE_SALES_MENU` 本身允许 `STORE`（契约 `contracts/catalog/admin-catalog.json:1473-1501`），这解释了门店角色可以拥有已经建设的商品/库存/菜单详细规则能力；它们不是 `BC-ORG-STORE-EDIT`，不能据此反推门店角色可以修改本需求的开关。R-7.1 采用 `BC-ORG-STORE-EDIT` 时，详设必须保持这两个权限域不混用。

### 4.4 审计策略与四类实体影响

结论：unknown field key 直接抛异常已确认；动态扩展值存在 `AuditChange` scalar/长度/表示的第二层阻塞，见 S-02。`BusinessEntityValueSupport` 对四类实体共用的事实成立，但 R-10.6 是需求稿自己标明的推论，不替 Dexter扩大或收窄产品范围。若实施四实体共享扩展，必须同步处理 Store/HeadCompany 的 policy 和 Brand/Tenant 的历史输出变化。

### 4.5 §8 的 12 条判据

逐条分类如下：

| 判据 | 结论 | 说明 |
|---|---|---|
| V-1 | 可构造行为判据 | 有 disabled 负向和 enabled 正向控制；需在详设明确网络请求和正常数据断言。 |
| V-2 | 不可完整证伪 | 被 M-01 的 52-entry 分母缺口阻断。 |
| V-3 | 可构造行为判据 | 关闭前后行数/内容对比，边界清楚。 |
| V-4 | 可构造行为判据 | 关闭桌台管理再开启并核对后代值，反例具体。 |
| V-5 | 存在性/负向 oracle 偏弱 | 只有父 false 子 true；硬编码 false 可通过，见 N-01。 |
| V-6 | 可构造行为判据 | 明确分开未知键写入与读取路径。 |
| V-7 | 存在性/负向 oracle 偏弱 | 只有非法契约失败，没有合法契约成功控制，见 N-01。 |
| V-8 | 存在性 oracle 偏弱 | 借用“现有模型保证”而缺少具体 STORE 角色拒绝构造，见 N-01。 |
| V-9 | 可构造运行判据 | seed 后开关和页面正向行为明确；本轮未运行。 |
| V-10 | 行为方向正确但值 oracle 不全 | fieldKey/before/after 的类型化表示与长度由 S-02 补齐。 |
| V-11 | 可构造行为判据 | 创建态审计有具体备注/扩展字段构造；同样受 S-02 的值语义约束。 |
| V-12 | 只有“不抛异常”不足 | 不能证明动态键确实入审计且 before/after 正确，已并入 S-02。 |

### 4.6 需求层与详设层边界

应在需求层冻结但当前推给详设的内容：

1. R-9.2 的 mutation 分母、入口族分类、STORE 与非 STORE 目标边界；详设只能把已冻结入口映射到 owner gate。
2. R-10.3/R-10.5 的审计 scalar 表示、长度上限和空值语义；这属于用户可见审计事实，不是可以由实现自由选择的字符串格式。
3. §8 每条判据的正/负控制，至少补齐 V-5、V-7、V-8 的对称 oracle。
4. §4.3 支撑 R-3.3 的散落位置计数和分类口径；否则需求论证本身不稳定。

合理留给详设的内容：存储物理列名和索引、契约 schema 的文件组织与 generator 接线、后端/前端 evaluator 的函数签名、并发字段的具体 wire 形状、抽屉 IA 细节、共享空态组件 API、gate 调用落点/错误码、具体 seed 文件配置。这些属于机制选择，只要不改变上述已经冻结的业务结果即可。

没有发现必须单独记为 finding 的实现越界：不复用 extension 的理由、父必须是 BOOLEAN、fail-closed、写拒绝读放行等是为安全和一致性服务的约束，不等于替详设规定了类名或数据库实现。

### 4.7 开关计数与树形

结论：通过，不记 finding。

需求正本 `doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-claude.md:59-80` 逐行重算得到 12 个开关：11 个 BOOLEAN、1 个 STRING；根为 `catalogManagementEnabled` 和 `receivableEnabled`；最长链为 `catalogManagementEnabled → tableManagementEnabled → tableStatusEnabled → tableWaitCallEnabled/banquetOrderEnabled`，深度 4。讨论稿曾出现 12 BOOLEAN + 1 STRING 的工作材料错误，但讨论稿不是正本，且正本已经正确，故不记 finding。

## 5. 已确认的非 finding 与证据边界

- Dexter 冻结的七项产品裁决未被推翻：树的业务选项、默认值/reset、终端不接、删除商品数量上限、不做能力总览、抽屉不标建设状态、门店信息审计。
- `BC-ORG-STORE-EDIT` 的组织类型限制与角色创建/更新校验成立；邀请 assignment 是既有 role 的分配，不是绕过 catalog 的 permission mutation。
- `AuditChangePolicy.allow()` 对未知 field key 直接抛错成立；这是需求稿正确识别出的第一层审计前置，不是新的反例。
- 四实体共享 `BusinessEntityValueSupport` 的事实成立；是否四类一并交付是 Dexter 可收窄的产品范围，不擅自裁决。
- `collaboration` 域是否已有开放平台开发者/ISV 实体、STRING 的 null/空串取值按需求第 345-349 行的已知边界处理，不重复记 finding。
- 本轮没有动态、编译、测试、生成、DEV、reset、seed、UAT、部署或 browser evidence；不能把本 review 当作实施授权或运行 PASS。

## 6. 最小收口建议

在进入详设前，至少修订需求正本的三处正本内容：

1. R-9.2 增加当前 52 mutation + 3 preflight 的来源清单和分类规则，并明确任何新 operation 先归类再实现。
2. §4.3/§4.6 改正 ExtensionFieldType 分类计数，避免把生成、运行时校验和展示映射混成一个数字。
3. §7/§8 增加审计 scalar oracle，并给 V-5/V-7/V-8 增加对称正向或具体拒绝构造；V-10/V-12 使用同一张审计值表。

这些修订不要求引入新页面、新审计模型、新权限点或新的通用框架；它们只是把业务边界、反例分母和审计可见事实从详设自由度中收回。
