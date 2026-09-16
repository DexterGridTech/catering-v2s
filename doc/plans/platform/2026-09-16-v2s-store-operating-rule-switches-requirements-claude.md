# v2s 门店经营规则开关需求

```text
DATE=2026-09-16
DOC_KIND=REQUIREMENTS
AUTHOR=Claude
STATUS=REQUIREMENTS_DRAFT
REVIEW_STATE=作者自审一轮（1M/2S/2N，已修）；Codex 独立评审第 1 轮 NO-GO（1M/2S/1N），Claude 重开源码逐条独立核验后全部 CONFIRMED，已修（§12）。REVIEW_ROUND=1/2
BUSINESS_SOURCE=Dexter 直接需求 2026-09-16，含同日七项裁决（原文见 §10）
SCOPE=门店经营规则的「开关层」：12 个开关的定义、存储、授权编辑、级联生效判定；本期只有 1 个开关有真实消费者
CONSUMER_SCOPE=apps/backend + apps/frontend 两端；终端不在本期
IMPLEMENTATION_AUTHORITY=false
RUNTIME_AUTHORITY=NOT_AUTHORIZED
RESET_DEV_SEED_AUTHORITY=NOT_AUTHORIZED
文档边界=本稿写「必须成立什么」与验收要证明的性质；存储列名、契约文件形状、API 字段名、函数签名与 IA 细节列入 §9 交详设
前置材料=讨论稿 doc/plans/platform/2026-09-16-v2s-store-operating-rule-switches-requirements-discussion-claude.md（工作材料，非权威）
路径约定=所有路径以仓库根为起点
```

## 1. 文档定位与真实业务问题

本文是业务需求正本，不是详设、实施计划、代码变更或运行授权。

门店有经营规则，分两层：

- **开关层**：由集团、大区、项目有权限的人设置，决定一家门店**具备什么能力**。
- **详细规则层**：门店自己有权限的人设置。门店具备某项能力之后，才谈得上配它的具体规则。

v2s 已经实现的商品、库存、菜单管理，就是详细规则层的内容。**本需求只建设开关层。**

当前的真实问题：v2s 没有任何「上级组织决定某门店能用什么功能」的机制。门店上只有一个整体 `status`（在营 / 停用 / 作废），要么全能用要么全不能用；角色权限回答的是「这个人能不能操作」，不回答「这家店开没开通」。所以项目方没有办法只给某家门店开通商品管理、而不开通其他能力。

### 1.1 它是第三条正交的轴

放行一项功能，从本需求起要同时满足三个条件。三者互不替代：

| 轴 | 回答的问题 | 现状 |
| --- | --- | --- |
| 门店 `status` | 这家店在不在营？ | 已有：`ENABLED` / `DISABLED` / `VOIDED` |
| **经营规则开关** | **这家店开通了这项能力吗？** | **本需求新建** |
| 角色 action capability | 这个人能不能操作这项能力？ | 已有 RBAC，例如 `EDIT_STORE_CATALOG` |

仓内既有的 `CatalogTargetCapability`（`apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/command/CatalogTargetCapability.java:10-16`）把数据节点类型映射成 `EDIT_STORE_CATALOG` / `EDIT_HEAD_COMPANY_CATALOG`，回答的是**角色**维度，不是**门店**维度。有编辑权的项目管理员在未开通的门店上必须被拦住；没有编辑权的人在已开通的门店上也必须被拦住。

## 2. 业务目标与成功结果

1. 集团、大区、项目有权限的人，能在现有门店编辑抽屉里设置该门店的经营规则开关。
2. 开关之间的父子级联关系成立：父开关关闭时，其后代能力一律不可用。
3. 开关是**真授权**，不是界面提示：未开通的能力，后端写入口必须拒绝。
4. 开关**只控制当前能不能用，不影响历史数据**。关闭再开通，原有数据原样可见。
5. 开关集合可以持续增补，新增一个开关**不需要数据迁移**。
6. 本期唯一有真实消费者的开关 `A` 生效：未开通的门店，商品、库存、菜单三个管理页面不可用。
7. 门店信息的任何变动都留下审计记录，包括此前未做审计的字段。

成功结果必须由 owner readback、HTTP contract、focused test 或后续受管验收证明；本文件的静态要求不构成运行通过。

## 3. 范围盘点

### 3.1 开关全集：12 个

`key` 是稳定标识，会写入数据库并被代码判断，一旦有数据即不可更改。因此不使用 A / B / C 字母编号（原始编号仅作示意）。

| 原始编号 | 业务名称 | `key` | 值类型 | 父 | 默认值 | 本期消费 |
| --- | --- | --- | --- | --- | --- | --- |
| A | 是否启用商品、库存和菜单管理 | `catalogManagementEnabled` | BOOLEAN | 无（根） | `false` | **是** |
| B | 是否启用外部商品、库存、菜单同步 | `externalCatalogSyncEnabled` | BOOLEAN | `catalogManagementEnabled` | `false` | 否 |
| B1 | 开放平台开发者编码 | `openPlatformDeveloperCode` | STRING | `externalCatalogSyncEnabled` | 空 | 否 |
| C | 是否启用预约功能 | `reservationEnabled` | BOOLEAN | `catalogManagementEnabled` | `false` | 否 |
| D | 是否支持押金预约 | `reservationDepositEnabled` | BOOLEAN | `reservationEnabled` | `false` | 否 |
| E | 是否启用排队叫号 | `queueCallEnabled` | BOOLEAN | `catalogManagementEnabled` | `false` | 否 |
| F | 是否启用桌台管理 | `tableManagementEnabled` | BOOLEAN | `catalogManagementEnabled` | `false` | 否 |
| G | 是否启用桌台状态管理 | `tableStatusEnabled` | BOOLEAN | `tableManagementEnabled` | `false` | 否 |
| H | 是否支持「等叫」功能 | `tableWaitCallEnabled` | BOOLEAN | `tableStatusEnabled` | `false` | 否 |
| I | 是否支持宴会订单 | `banquetOrderEnabled` | BOOLEAN | `tableStatusEnabled` | `false` | 否 |
| J | 是否启用取餐叫号 | `pickupCallEnabled` | BOOLEAN | `catalogManagementEnabled` | `false` | 否 |
| I（第二个） | 是否支持应收单管理 | `receivableEnabled` | BOOLEAN | 无（根） | `false` | 否 |

合计 **12 个开关：11 个 BOOLEAN + 1 个 STRING，两个根（`catalogManagementEnabled`、`receivableEnabled`），最大深度 4 层**（`catalogManagementEnabled` → `tableManagementEnabled` → `tableStatusEnabled` → `tableWaitCallEnabled` / `banquetOrderEnabled`）。

原始输入中 `I` 出现两次（桌台状态下的「宴会订单」、顶级的「应收单管理」）。按「编号仅作示意」处理为两个不同开关，不合并。

原始输入中的 `M`（商品数量上限）已按 2026-09-16 裁决删除，不在本需求内。

**规则树的业务逻辑本身不在本稿讨论范围**（2026-09-16 裁决：逻辑没错，不用质疑业务选项）。本稿承接这棵树，只规定它的**关联性机制**与消费要求。

### 3.2 值类型闭集

本需求定义自己的值类型闭集，**不复用** `ExtensionFieldType`：

| 值类型 | 默认值 | 当前树中的实例 |
| --- | --- | --- |
| `BOOLEAN` | `false` | 11 个 |
| `NUMBER` | `0` | **0 个**；类型与默认值规则先行声明，供将来新增开关使用 |
| `STRING` | 空 | 1 个（`openPlatformDeveloperCode`） |

不复用 `ExtensionFieldType` 的理由见 §4.6。`NUMBER` 当前没有实例，是 2026-09-16 裁决「数值类型默认就是 0」的落点，属于有意的类型预声明，不是死代码。

### 3.3 本期消费面

只有 `catalogManagementEnabled` 有真实消费者，作用于三个**门店级**页面：

| 页面 | 页面 key | `requiredDataNodeType` |
| --- | --- | --- |
| 门店商品管理 | `PG-CATALOG-STORE-ITEMS` | `STORE` |
| 门店库存管理 | `PG-INVENTORY-STORE-STATUS` | `STORE` |
| 门店销售菜单 | `PG-SALES-MENU-STORE` | `STORE` |

**不含** `PG-CATALOG-BRAND-ITEMS`（品牌商品管理）。它的 `requiredDataNodeType` 是 `HEAD_COMPANY`，不是门店级，因此不在门店开关的射程内。

其余 11 个开关本期**只定义、只存储、只可在抽屉中设置**，不产生任何后端判定，也不改变任何页面行为。

### 3.4 明确不在本次范围

- 详细经营规则层（门店自己配置的具体规则）。
- 11 个无消费者开关所对应的业务功能实现（预约、排队叫号、桌台、宴会、取餐叫号、应收单、外部同步）。
- 终端（2026-09-16 裁决：本期只做 `apps/backend` 与 `apps/frontend`）。
- 商品数量上限（2026-09-16 裁决删除）。
- 按合同或套餐自动写入开关值。将来若有，它是开关值的**上游写入路径**，不改变本需求的存储与判定模型。
- 按开关筛选或统计门店的列表能力。
- 为门店用户单独提供「已开通能力」总览界面（2026-09-16 裁决不做；能力判断的落点是各功能页面本身）。
- 在抽屉中标注开关对应功能是否已建设（2026-09-16 裁决不做）。
- 组织架构树、扩展字段**定义机制**、RBAC 权限模型的任何改动。补扩展字段**值变更的审计**（§7）不属于改动其定义机制，在范围内。

## 4. 开关的业务语义要求

### 4.1 存储形态：门店实体上的一个 JSON 属性，平铺

开关集合存为门店实体上的一个 JSON 属性，与扩展字段值**分开存放**。

**必须成立**：

- R-1.1 开关值**平铺**存放，键即 §3.1 的 `key`，不使用嵌套结构表达父子关系。
- R-1.2 父子关系、值类型、默认值由**契约**声明，不由存储结构表达。
- R-1.3 新增一个开关只需在契约中增加一条声明，**不需要数据迁移、不需要回填**。
- R-1.4 开关**不得**存入扩展字段值命名空间，也不得复用扩展字段的定义机制与其版本号。
- R-1.5 在契约中**调整某开关的父**（改挂到另一个父之下）同样只改契约，存储不动，`effective` 自动按新树重算。这是 R-1.1 与 R-1.2 的直接收益，也是平铺存储相对嵌套存储的主要理由之一。

R-1.4 的理由见 §4.6。R-1.1 与 R-1.2 的理由：级联是一条**规则**不是一种**结构**。规则放在契约里，新增层级不改变已有数据形状；烧进存储结构则每加一层都要迁移，且键路径不稳定。

### 4.2 默认值

**必须成立**：

- R-2.1 契约中每个开关**必须**声明默认值；缺少默认值的契约是不合法的。
- R-2.2 默认值按类型取：`BOOLEAN` 为 `false`，`NUMBER` 为 `0`，`STRING` 为空。
- R-2.3 读取时以契约默认值为底，存储中存在的键覆盖之。存储中不存在的键**即为默认值**，不需要回填。
- R-2.4 不需要为存量门店做任何数据处理（2026-09-16 裁决：数据最终都会 reset）。

**连带要求**（不是可选项）：

- R-2.5 因为 `catalogManagementEnabled` 默认为 `false`，**种子数据必须显式为门店开启该开关**，否则 reset dev seed 之后 DEV 环境中所有门店的商品、库存、菜单三个页面均不可用。

### 4.3 生效判定：`applicable` 与 `value` 分开

父子关联的核心是「子开关在父关闭时处于什么状态」。一个概念不够，需要两个：

- **`applicable(key)`**：祖先链上每一个开关的 `effective` 均为 `true`。根开关恒为 `applicable`。回答「这个开关现在说得上话吗」。
- **`value(key)`**：存储值；缺失则取契约默认值。
- **`effective(key)`**（**仅 BOOLEAN 有**）＝ `applicable(key) && value(key)`。回答「这项能力现在可用吗」。

**必须成立**：

- R-3.1 任何消费方判断一项能力是否可用，**必须使用 `effective`，不得直接读取叶子键**。
- R-3.2 非 BOOLEAN 开关**没有 `effective`**，只有 `value` 与 `applicable`。父关闭时其值不生效。
- R-3.3 判定逻辑由契约声明驱动，后端与前端各自的实现读取**同一份**声明，不得各自维护一份父子关系的手写副本。

R-3.1 是安全要求：若直接读叶子键，「父已关闭但子键仍为 `true`」的数据会导致越权放行。

R-3.3 有仓内反面教材：`ExtensionFieldType` 这**一个**闭集在仓内按类别散落如下，**至少 11 处，其中只有 3 处受生成链保护**：

- 契约正本 1 处：`contracts/openapi/components/extension/extension.schemas.json` 第 195-203 行。
- 生成物 3 处（受保护）：`app/edge/generated/wire/ExtensionFieldType.java`、`operations-edge.ts` 第 3453 行、`platform-edge.ts` 第 1590 行。
- 后端运行时校验与解析 3 处：`ExtensionDefinitionService.java` 第 493-506 行与第 772-787 行、`ExtensionFilterQuery.java` 第 27 行与第 181-187 行、`BusinessEntityValueSupport.java` 第 37-48 行。
- 前端运行时闭集 2 处：`libraries/frontend/admin-ui-foundation/src/extension/typedExtension.ts` 第 1 行、同目录 `invalidFilter.tsx` 第 7 行。
- 展示与编辑映射 2 处：`ExtensionsPage.tsx` 第 24 行、`ExtensionDefinitionEditDrawer.tsx` 第 40-44 行。

不给总数上限词，是因为这类手写副本本来就可能还有没被找到的——这恰恰是问题本身。父子关系若照此办理，两端判定漂移是时间问题。本需求不因此重构扩展字段系统，只要求 R-3.3 对新建的开关闭集成立。

### 4.4 父关闭时保留子值

**必须成立**：

- R-4.1 父开关关闭时，后代开关的**存储值保留**，不得清除。
- R-4.2 父开关重新开启后，后代开关的配置**原样恢复**。
- R-4.3 界面上父开关关闭时，后代开关置为不可编辑，但**不得清空已填写的值**。

理由：开关是会被反复开关的配置。清除后代值是不可逆的数据损失——关闭桌台管理再打开，不应丢失「等叫」与「宴会订单」两项配置。

R-4.3 与门店**新建**抽屉里既有的「禁用 + 级联清空」写法（`apps/frontend/operations-admin/src/features/store-management/ui/StoreCreateDrawer.tsx:247-248`）**相反**。那里清空是正确的，因为父级变化导致候选集失效；这里清空是数据损失。详设不得照搬该处写法。

### 4.5 写入校验

R-4.1 的必然结果是：存储中允许出现「父为 `false`、子为 `true`」的组合。这一点必须显式写死，否则实现时容易顺手增加一条「父关闭则子必须为默认值」的写入校验，从而推翻 R-4.1。

**必须成立**：

- R-5.1 **允许**「父 `false`、子 `true`」的组合写入并落库。越权由 R-3.1 的 `effective` 判定负责拦截，不由写入校验负责。
- R-5.2 写入的键必须属于契约声明的闭集；出现契约未声明的键**拒绝写入**。
- R-5.3 读取时遇到契约未声明的键**忽略**，不报错、不使其生效（容忍旧数据，但不让它产生效果）。
- R-5.4 写入的值类型必须与契约声明一致。
- R-5.5 契约自身必须通过一致性校验：每个声明的父必须指向已声明的键、**父必须是 BOOLEAN 类型**、不得成环、每个开关必须有默认值。任一条不满足，生成时报错。

- R-5.6 `openPlatformDeveloperCode` 在其父 `externalCatalogSyncEnabled` 开启时，**本期不做必填校验**。理由：该父开关本期没有真实消费者，此刻定义必填与格式规则没有可验证的消费场景，属于凭空立规。待 `externalCatalogSyncEnabled` 有真实消费者时，与其消费要求一并定义。

R-5.5 中「父必须是 BOOLEAN」的理由：只有布尔值能承担「开 / 关」这道门。当前树满足该约束（`openPlatformDeveloperCode` 的父 `externalCatalogSyncEnabled` 是 BOOLEAN，树中不存在以 STRING 或 NUMBER 作父的情况）。

### 4.6 不复用扩展字段机制的理由

扩展字段机制（`extension_values` 及其定义与版本号）在形态上很接近：类型闭集里已有 `BOOLEAN`，门店编辑抽屉已把 BOOLEAN 渲染为开关控件（`StoreEditDrawer.tsx:28-60`），种子数据中甚至已有 `is24Hour` 这类外形与开关一致的扩展字段。但不得复用，三条理由：

1. **owner 不同**。扩展字段的形状由**客户自定义**的字段定义驱动；经营规则开关是**平台内置语义**，代码要按键判断放行。把平台语义放进用户可自定义的命名空间，等于允许租户改名、停用或删除自己的功能开关。
2. **语义污染**。已上线的扩展字段列表展示与类型化搜索会把开关暴露为列表动态列与搜索项。
3. **版本号耦合**。扩展字段定义的乐观版本号是为自定义字段设计的；开关跟随它，会被无关的字段定义变更阻塞保存。

同理，§3.2 的值类型闭集独立定义而不复用 `ExtensionFieldType`：两者语义域不同（一个是租户自定义字段的类型，一个是平台内置开关的值类型），当前取值重合不代表将来重合；且该枚举在多个不受生成链保护的位置存在人工同步负担（§4.3），再增加消费方会加重同步负担。

### 4.7 读取失败时 fail-closed

- R-6.1 在**后端授权判定**中，所需的门店或开关数据读取失败时按未开通处理并拒绝，绝不得放行；前端若无法读到判定事实，必须呈现读取失败并阻断业务子树，不能把读取失败伪装成 `effective=false` 的“未开通”。

理由：这是授权判定。fail-open 的后果（未授权门店写入数据）比 fail-closed 的后果（临时不可用）严重得多。该取向与仓内既有的 `isExtensionDefinitionRevisionAtLeast`（`libraries/frontend/admin-ui-foundation/src/extension/staleRecovery.ts:96-110`）失败关闭的取向一致。

## 5. 授权与操作面要求

### 5.1 谁能设置

- R-7.1 开关由集团、大区、项目有权限的人设置，**复用现有门店编辑权限** `BC-ORG-STORE-EDIT`，不新建权限点。
- R-7.2 开关**复用现有门店编辑抽屉**，不新建页面。
- R-7.3 门店层角色不得修改开关。

**仓内事实支撑 R-7.3**：`BC-ORG-STORE-EDIT` 的可授予组织类型是 `["GROUP", "REGION", "PROJECT"]`（正本 `contracts/catalog/admin-catalog.json:1181-1193`，生成到 `WorkspaceAuthorizationCatalog.java:98`），不含 `STORE`；且由后端强制——`WorkspaceRoleService.java:567-578` 的 `validateCatalogs` 在角色创建与改权限时校验组织类型，不匹配即抛 `RoleCapabilityIncompatibleException`；前端角色编辑器亦按 `capability.organizationTypes.includes(serviceNodeType)` 过滤（`apps/frontend/platform-admin/src/features/workspace-iam/ui/RolePermissionFields.tsx:53`）。

因此 R-7.3 由现有权限模型**已经保证**，本需求不新增机制，验收只需证明未被本次改动破坏。

**已知并接受的代价**：复用意味着能编辑门店资料的人即可修改经营授权，无法只授予改资料而不授予改授权。当前该权限只能授予 GROUP / REGION / PROJECT，与「由集团、大区、项目有权限的人设置」一致，本期接受。将来若要求「项目可改资料、仅大区可改授权」，届时再拆权限点。

### 5.2 抽屉呈现

- R-8.1 抽屉中呈现全部 12 个开关，按 §3.1 的父子关系分层。
- R-8.2 父开关关闭时，后代开关不可编辑（值保留，见 R-4.3）。
- R-8.3 抽屉**只呈现开关本身**，不标注对应功能是否已建设（2026-09-16 裁决）。
- R-8.4 开关与门店其他资料字段在**同一次提交**中保存，共用现有的并发控制。

**仓内事实**：现有 `StoreEditDrawer.tsx` 是一串扁平 `Form.Item`（:219-259），无分组、无 Collapse、无 Tabs；两个前端的 `src/features` 全仓未使用过 Collapse；也不存在「某字段取值决定另一字段显示或禁用」的既有实现。因此 R-8.1 与 R-8.2 的分层与联动需要新建，属于本需求的真实工作量。

## 6. `catalogManagementEnabled` 的消费要求

- R-9.1 该开关 `effective` 为 `false` 的门店，`PG-CATALOG-STORE-ITEMS`、`PG-INVENTORY-STORE-STATUS`、`PG-SALES-MENU-STORE` 三个页面显示「功能尚未开启，需项目对门店授权」，且**不发起列表读取请求**。
- R-9.2 该开关 `effective` 为 `false` 时，**凡是会改变该门店商品、库存、销售菜单数据的写入口都必须拒绝**，不限于三个页面上的操作。判据是「这次写入会不会改变该门店的这三类数据」，而不是「这个入口在不在那三个页面上」。
- R-9.2a **分母来源具名**：`contracts/registry/operation-handler-bindings.json` 是 operation 全集的唯一来源。当前登记 270 条（含本批新增的专用 operating-rule read），operation 级读写判据是 `mode`；root 的 `operationCount`、`readCount`、`commandCount` 是总量统计，读写可机械区分。
- R-9.2b **闭包判据**：该登记表中**所有**会改变门店商品、库存、销售菜单数据的 command 类 operation，一条不漏全部接上开关校验。已知至少包括单条创建与保存、**批量状态变更**、**从品牌或总公司复制商品到该门店**。
- R-9.2c **详设义务**：详设必须交付「登记表全集 → 逐条分类（STORE / 非 STORE、mutation / read / preflight）→ 开关 gate 落点」的完整映射，并证明覆盖了全集，**不得抽样**。此后新增 operation 必须同步更新该映射。

此处刻意**不**把 operation 清单手工冻进本稿：清单是快照，仓内加一条接口本稿就会变成错的。具名全集来源加闭包判据同样可机器复核，而且自维护。漏一个入口，开关即可被绕过，因此 R-9.2c 的完备性证明是硬要求，不是文档义务。
- R-9.3 读取接口**不因本需求增加开关校验**。
- R-9.4 关闭开关**不改变任何已有数据**；重新开启后，原有商品、库存、菜单原样可见。
- R-9.5 三个页面的未开启空态由**一处共享实现**提供，不得三处各写一份文案。

R-9.2 与 R-9.3 的组合是本需求的核心取舍，理由如下：开关是授权，**只在前端拦截的授权不是授权**——直接调用 API 即可绕过；但「不影响历史数据」要求数据必须保留可恢复。二者合起来推出「写拒绝、读放行」：数据原样留在库中，重新开通后立即恢复可见。更小的方案（仅前端提示）不成立，开关会退化为一句装饰。

**仓内事实**：`admin-ui-foundation` 的导出清单（`libraries/frontend/admin-ui-foundation/src/index.ts`，151 行）中没有可复用的「功能未开启」空态；既有的 `OperationsRequiredScopeSurface` 解决的是「尚未选择门店」，语义不同。三个页面当前各自手写 Alert。R-9.5 因此要求新增一处共享实现。

## 7. 审计要求

2026-09-16 裁决：门店所有信息的变动都需要审计记录，以前没做的一并补上。本节与开关本身并列，是本需求的交付项，不是建议。

### 7.1 现状缺口（仓内事实）

`StoreService.java:40` 的审计字段白名单是 `Set.of("code", "name", "status", "relationship")`；真正产出差异的 `BusinessEntityValueSupport.changed()`（:75-85）与 `createdChanges()`（:68-73）**只比较 code / name / status**。

对照门店编辑抽屉实际可改的字段：

| 门店可编辑字段 | 当前是否审计 | 说明 |
| --- | --- | --- |
| 门店名称 | 是 | 四个可编辑字段中唯一在审的 |
| 总公司关系 | 否 | 白名单中有 `relationship`，但 `changed()` 从未产出该 fieldKey，是**死配额** |
| 备注 | 否 | 既不在白名单，也不参与比较 |
| 扩展字段值 | 否 | 同上 |
| 经营规则开关 | — | 本需求新增，必须纳入 |

**「门店所有信息」的边界**：门店状态流转已有审计（`STORE_STATUS_CHANGED`），保持现状不动；门店编码与所属项目、品牌、经营租户在编辑态为只读、不产生变动，因此不在本次补齐范围内。若将来其中任一变为可改，须一并纳入 R-10.1。除此之外，门店编辑抽屉可改的字段已被上表穷举。

### 7.2 必须成立

- R-10.1 门店名称、总公司关系、备注、扩展字段值、经营规则开关，**任一变动都产生审计记录**。
- R-10.2 门店**创建**时填写的上述字段同样留痕，不只记录 code / name / status。
- R-10.3 审计粒度为**逐字段**，不得把整个 JSON 作为单条 before / after 记录。审计历史需能直接看出改动了哪一项。
- R-10.4 经营规则开关的审计键来自契约闭集，可静态穷举。
- R-10.5 扩展字段的审计键是**租户自定义的动态键**，审计策略必须能容纳它而不抛异常。

**R-10.5 是硬前置，不是优化项**：`AuditChangePolicy.allow()`（`apps/backend/catering-business-server/modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditChangePolicy.java:18-23`）对不在闭集内的 `fieldKey` **直接抛异常**。若不先放宽该策略就按 R-10.3 逐键产出扩展字段差异，第一次有人修改扩展字段即在运行时抛错。

### 7.2.1 扩展字段审计的表示语义（必须在详设前冻结）

R-10.3 要求逐字段审计，而现有审计模型是**标量**：`AuditChange` 的值上限 2000、字段键上限 120（`modules/audit-model/src/main/java/com/catering/v2s/audit/contract/AuditChange.java` 第 8 行与第 20-23 行，超限直接抛 `IllegalArgumentException`）。而扩展字段的 TEXT 值在写入校验层**没有任何长度上限**——`ExtensionDefinitionService.java` 第 772-787 行的 TEXT 分支只判 `json.isTextual()`，门店写入路径经 `StoreService.java` 第 535-557 行走的正是它。

因此今天就可以写入一个超过 2000 字符的合法扩展值；若按 R-10.3 逐字段审计它，会在构造审计记录时抛异常，**让审计反过来打挂一次合法的业务写入**。这不是理论风险，必须在需求层冻结表示语义。

**必须成立**：

- R-10.9 审计前后值按类型规范化：TEXT 记原文；NUMBER 记规范化后的数值文本；DATE 记既有的规范日期串；BOOLEAN 记 `true` / `false`；SELECT 记 **option value 而非展示 label**（label 会随定义改名而漂移，审计要记录当时写入的事实）。
- R-10.10 必须区分四种「空」：字段**缺失**、值为 **null**、**被清空**、**空字符串**。审计要能把「从未填过」与「被清空」分开。
- R-10.11 值超过审计模型上限时：**截断并标注「已截断」**。不得因此拒绝业务写入，也不得静默丢弃该条变更记录。
- R-10.12 品牌、经营租户、总公司、门店四类实体的扩展字段审计表示必须**一致**。

R-10.11 的取舍由 Dexter 于 2026-09-16 授权 Claude 裁定，取「截断并标注」。理由：审计是旁路事实，**不得反噬业务主路径**；而「只记已变更、不记值」会丢掉可追溯性，等于白做审计。

字段键上限 120 已核为**非阻塞**：`extensionValues.` 前缀加上扩展字段键（建表上限 64 字符）不超过 120。

### 7.3 连带范围

**仓内事实**：`BusinessEntityValueSupport` 是品牌、经营租户、总公司、门店**四类实体共用**的。

- R-10.6 在该共享支撑中补齐备注与扩展字段的差异产出，**四类实体一并补齐**。

理由：只为门店分叉需要在共享函数内按实体类型开岔，反而更脏；四类一起补的成本几乎相同，结果一致。裁决原文说的是门店，此条为需求稿的推论，**如 Dexter 要求只补门店，本条改为门店单类**。

### 7.4 读出口不改

**仓内事实**：`OrganizationAuditHistoryService.readOperationsAuditProjection()`（`modules/organization/.../application/OrganizationAuditHistoryService.java:53-81`）已包含 `AuditEntityTypes.STORE`，两个前端均已有 `features/audit-history`。新增字段会自动出现在现有审计历史中。

- R-10.7 不新建审计查询接口或审计页面。

## 8. 验收要证明什么

不是「代码写了」，是以下性质成立。每条都要有能证伪它的具体构造。

| # | 判据 | 反例构造 |
| --- | --- | --- |
| V-1 | 未开通门店的三个页面显示未开启文案且不发列表请求 | 开通状态下同一页面必须正常出数据 |
| V-2 | 未开通门店的商品 / 库存 / 菜单**全部写入口被后端拒绝**，覆盖率对照 R-9.2c 交付的映射全集 | 绕过前端直接调用写接口必须失败；**批量状态变更**与**从品牌复制商品到该门店**两条旁路各自单独验证；仅证明前端空态不算通过，仅证明单条创建被拒也不算通过，**抽样覆盖不算通过** |
| V-3 | 关闭开关不改变任何已有数据；重新开通后原有数据原样可见 | 关闭前后对比数据行数与内容必须一致 |
| V-4 | 父开关关闭时后代存储值**未被清除**，父重新开启后配置原样恢复 | 构造「开启桌台状态并配好等叫与宴会 → 关闭桌台管理 → 重新开启」，两项配置必须还在 |
| V-5 | 消费方按 `effective` 判定 | 负向：「父 `false`、子键 `true`」时该能力必须不可用。**正向对照**：「父 `true`、子键 `true`」时该能力必须可用——缺这一半，一个永远返回 `false` 的假实现即可通过 |
| V-6 | 契约未声明的键：写入被拒绝，读取被忽略且不报错 | 分别构造写入与读取两条路径 |
| V-7 | 契约一致性门生效 | 负向：缺失默认值、父指向不存在的键、成环、以非 BOOLEAN 作父四种契约，生成必须报错。**正向对照**：合法契约必须生成成功且产物与声明一致——缺这一半，一个永远失败的门即可通过 |
| V-8 | 门店层角色无法修改开关 | 负向：门店层角色尝试获得 `BC-ORG-STORE-EDIT` 必须被拒。**正向对照**：GROUP / REGION / PROJECT 三类角色获得该能力必须成功——缺这一半，一个全拒的实现即可通过 |
| V-9 | reset dev seed 之后种子门店的 `catalogManagementEnabled` 为开启，三个页面可用 | 若种子未显式开启，此条必然失败 |
| V-10 | 门店名称、总公司关系、备注、扩展字段、开关，任一变动均留痕且可按字段看到 before / after | 分别只改备注、只改一个扩展字段、只翻一个开关，各自都必须留痕 |
| V-11 | 门店创建时填写的上述字段同样留痕 | 创建一个带备注与扩展字段的门店，审计需包含它们 |
| V-12 | 租户自定义的扩展字段键不会因不在静态白名单而抛异常 | 新增一个扩展字段定义后修改其值，不得抛错 |

V-2、V-5、V-7、V-12 是本需求最容易被做成「看起来对」的四条，验收必须各自独立构造，不得以其他条目的通过间接推定。

## 9. 交详设的事项

本稿不规定、由详设决定：

1. 存储列的物理名称、约束写法与是否加索引。
2. 契约文件的位置、schema 形状与生成链接入方式；父子声明与默认值的具体表达。
3. 判定器在后端与前端的具体形态与函数签名，以及 R-3.3「读取同一份声明」的落地方式。
4. 开关字段在门店更新请求中的字段名与并发控制的具体表达。
5. 抽屉的分区与层级呈现方式（IA 与交互设计）。
6. 三个页面共享空态组件的位置与 API。
7. 三域写入口校验的具体落点与错误码。
8. 审计字段键的命名规则，以及 `AuditChangePolicy` 放宽的具体机制。
9. 种子数据中开关初值的具体配置。

## 10. 裁决记录（2026-09-16，Dexter 原话）

| # | 事项 | 裁决 |
| --- | --- | --- |
| ① | 规则树的业务逻辑 | 「逻辑是没有错的，不用质疑业务选项。你只需要关心开关之间的关联性。」 |
| ② | 默认值与存量 | 「全部开关配置项都有默认值，如果是 Boolean 类型的默认就是 false，数值类型默认就是 0，不用管存量的问题，数据最终都会 reset。」 |
| ③ | 终端范围 | 「终端本期不接，只做 apps/backend 和 apps/frontend 两端」 |
| ④ | 商品数量上限 | 「去掉商品上限这个开关吧，真实业务不需要，我之前只是想说明，类型不只有 boolean」 |
| ⑤ | 门店用户的能力总览 UI | 「不管是不是门店的人，操作到某个页面的时候，会根据开通的能力做判断即可，不需要为门店用户单独有个 UI 展示所有开通的能力。」 |
| ⑥ | 抽屉中的建设状态标注 | 「抽屉只显示开关功能，为啥一定要标记功能是否建设中呢？完全是多此一举，过度设计。」 |
| ⑦ | 审计 | 「门店所有信息的变动需要审计记录，以前没做的都要加上。」 |

## 11. 证据边界与未决事项

本稿事实来自本会话对当前源码、迁移脚本与契约文件的**静态只读**核验，未执行任何构建、测试、生成或运行命令。标注为「仓内事实」的条目均已打开对应文件核对并给出路径行号。

**未核实**：`collaboration` 域是否已存在「开放平台开发者 / ISV 编码」这类实体。这关系到 `openPlatformDeveloperCode` 将来是否应从该域选取而非自由填写。本期按裁决先做 STRING，但**在把该字符串当作权威标识之前必须先核实**，否则将来对接会出现两套编码。此项列为详设阶段的前置核查，不阻塞本需求。

**推论而非裁决**：§7.3 的 R-10.6（四类实体一并补齐审计）是本稿从「共享支撑」这一仓内事实推出的，裁决原文只说门店。若 Dexter 要求只补门店，该条随之收窄。

**`STRING` 默认值**：裁决 ② 只给出了 BOOLEAN 与数值类型的默认值。本稿按同一规则取「空」，未区分 `null` 与空串；该区分列入详设。

本会话是续接会话，非 fresh acceptance；本稿为静态需求分析，不构成实施或运行授权。

## 12. 审查记录

### 12.1 本轮审查的性质（重要）

仓内治理（`CLAUDE.md`「独立子 agent 盲审」一节）要求 `REVIEW_TARGET=DESIGN` 的每轮对抗审查由 fresh 独立子 agent 盲审，**不得由作者会话自审自判**。

本轮**未执行**该盲审：Dexter 于 2026-09-16 要求从简提速并中断了已发起的盲审。因此下列处置是**作者自审**的结果，**不得记为独立盲审通过**，也不满足治理对 DESIGN 轮的形式要求。如需正式收口，仍需补一轮独立盲审。

### 12.2 自审处置（1M / 2S / 2N，全部已修）

| # | 级别 | 问题 | 处置 |
| --- | --- | --- | --- |
| M-1 | Major | §4.3 把 `ExtensionFieldType` 的散落位置写成「4 份」，但同句列出了 6 个位置，数字与举证自相矛盾——这是用来支撑 R-3.3 的承重事实，错了会让 R-3.3 失去依据 | 改为「散落 7 处：正本 1 + 生成 3 + 手写 3」，并补上「增加一个类型要改 4 处、其中 3 处不受生成链保护」的实际后果 |
| S-1 | Significant | R-9.2 只写「三域的写入口」，实际上批量状态变更、从品牌复制商品到门店等旁路同样会改变该门店的三类数据。按原文实现会留下可绕过开关的口子 | R-9.2 改为以「这次写入会不会改变该门店这三类数据」为判据，点名批量与复制两条旁路，并要求详设先枚举全部入口；V-2 同步要求两条旁路各自单独验证 |
| S-2 | Significant | `openPlatformDeveloperCode` 在父开关开启时是否必填，需求层完全没有定义，留给详设自由发挥 | 新增 R-5.6：本期明确**不做**必填校验，理由是其父开关本期无消费者，待有消费者时与消费要求一并定义 |
| N-1 | Note | 契约演进只覆盖了新增开关与未声明键，未说明「改变某开关的父」时的行为 | 新增 R-1.5：只改契约、存储不动、`effective` 按新树重算 |
| N-2 | Note | §7 要求「门店所有信息的变动」都留痕，但未界定「所有信息」的边界，无法证明已覆盖完 | §7.1 补边界说明：状态流转已有审计保持不动；编码与项目/品牌/经营租户在编辑态只读因而无变动；其余已由表格穷举 |

### 12.3 自审攻击过但未构成 finding 的点

- **`NUMBER` 类型 0 实例是否属于过度设计**：它是裁决②的直接落点（「数值类型默认就是 0」），且成本是契约里一行类型声明。保留，不记 finding。
- **11 个无消费者开关是否该本期定义**：树形关系必须一次定对，`key` 一旦有数据即不可改；契约多 11 行的成本近乎为零，而为它们写判定代码才是过度设计——需求稿已明确只为 `catalogManagementEnabled` 写判定。保留。
- **复用门店编辑权限导致「改资料即可改授权」**：已在 §5.1 显式记为「已知并接受的代价」，且现有权限模型已把门店层角色挡在外面。不重复记为 finding。
- **R-10.6 四类实体一并补审计**：已在 §11 显式标为「推论而非裁决」并给出收窄条件。不再重复。

### 12.4 Codex 独立评审第 1 轮（NO-GO，1M/2S/1N）与 Claude 核验

经 Dexter 中转，Codex 于 2026-09-16 完成对本稿的独立评审，结论 NO-GO。Claude 重开当前字节逐条独立核验，**四条全部 CONFIRMED**，均已修入本稿。

| ID | Codex 级别 | Claude 核验 | 处置 |
| --- | --- | --- | --- |
| M-01 写入口分母未在需求层冻结 | Major | CONFIRMED，但**修法不采纳 Codex 方案** | 新增 R-9.2a/b/c：具名全集来源、闭包判据、详设映射义务。不把 operation 清单手工冻进本稿——清单是快照，加一条接口本稿即失效；具名来源加闭包判据同样可机器复核且自维护 |
| S-01 `ExtensionFieldType` 计数错误 | Significant | CONFIRMED，我原写的「7 处」确实错 | §4.3 改为按类别列举，至少 11 处、仅 3 处受生成链保护，并去掉总数上限词 |
| S-02 扩展字段审计语义未冻结 | Significant（Codex 记 PARTIALLY） | **CONFIRMED，Claude 提级** | 新增 §7.2.1 与 R-10.9 至 R-10.12 |
| N-01 验收 oracle 只有失败路径 | Note | CONFIRMED | V-5、V-7、V-8 各补正向对照 |

**Claude 对 Codex 转述的一处更正**：Codex 称本稿「同一文档又写成 4 copies」。原文实为「增加一个类型要改 4 处」，是另一句陈述而非第二个总数。该 finding 本身仍成立（总数确实错），此处仅更正描述。

**Claude 核验时用到的承重事实**（重开当前字节）：需求冻结前 `contracts/registry/operation-handler-bindings.json` 登记 269 条 operation；本批新增专用 operating-rule read 后，当前实现分母为 270；操作级字段包括 `mode` 与 `commandBoundary`；root 统计字段仅是 `kind`、`operationCount`、`readCount`、`commandCount`，这些统计字段不属于任何 operation 条目。此前转述曾把 root 统计字段与条目字段混写，现以本句为准，不能再作为实现输入；`AuditChange.java` 第 20-23 行值超 2000 抛异常、第 8 行键上限 120；`ExtensionDefinitionService.java` 第 772-787 行 TEXT 分支无长度上限，门店写入路径经 `StoreService.java` 第 535-557 行走的正是它；Codex 点名的 `ExtensionFieldType` 具体 source locations 均属实，但该历史转述不代表当前总数，当前规范口径以 §4.3 的“至少 11 处、仅 3 处受生成链保护”为准。

**Codex 未回答、Claude 亦未核的一项**（记为 `UNVERIFIED_REQUIRES_EVIDENCE`，列入详设前置核查，不作为 finding）：审计读出口对未知 `fieldKey` 是否有白名单或中文标签映射；租户改名或删除扩展字段后，历史审计行引用已不存在的键时如何呈现。

**轮次说明**：治理对 DESIGN 的硬上限为两轮。本稿在第 1 轮处置完成后，由 Dexter 于 2026-09-16 直接授权进入详设与实施计划编写，不再走第 2 轮，按 `SELF_DECIDED` 收口。
