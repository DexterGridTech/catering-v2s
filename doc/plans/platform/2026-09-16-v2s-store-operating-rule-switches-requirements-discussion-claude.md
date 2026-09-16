# 门店经营规则开关 · 需求讨论稿

```text
DOC_KIND=REQUIREMENTS_DISCUSSION
AUTHOR=Claude
STATUS=讨论稿，不是正式需求稿；不构成详设、实施计划或任何运行授权
BUSINESS_SOURCE=DEXTER_DIRECT_REQUEST_2026-09-16
EVIDENCE_TIER=static；本稿事实来自本会话只读当前源码、迁移脚本与契约文件，未执行任何构建、测试、生成或运行命令
修订史=v1 首稿；
      v2 Dexter 四项裁决落地：规则树的业务逻辑不再质疑（只做关联性机制）；
        默认值规则定为「每个开关都有默认值，BOOLEAN=false、数值=0」，不处理存量；
        终端本期不接，范围收窄为 apps/backend + apps/frontend 两端；
        **删除「商品数量上限」开关**（真实业务不需要，原意只是说明类型不止 boolean）；
      v3 Dexter 三项裁决落地：不为门店用户单独做「已开通能力」总览 UI；
        抽屉只呈现开关本身，不标注「功能建设中」；
        **门店所有信息的变动都要审计，以前没做的一并补上**（从建议升级为本期交付项，见 §7）
DECISION_STATE=§7 三条裁决后，本稿已无待裁决项；下一步是正式需求稿
路径约定=所有路径以仓库根为起点
```

## 0. 这份文档是什么

把口述的经营规则开关对着当前源码推一遍，把必须先定下来的事和我会怎么选摆出来。不是正式需求稿，不是详设，不写接口形状和代码。

事实分档：**仓内事实**（打开源码核过，带路径行号）、**推论**（从事实推出来的）、**待裁决**（§7）、**未核实**（§10 标了一处）。

## 1. 需求

经营规则分两层，这次只做第一层：

- **开关层**：由集团 / 大区 / 项目有权限的人设置，决定一家门店**具备什么能力**。复用现有门店编辑权限与门店编辑抽屉。
- **详细规则层**：门店自己有权限的人设置。门店具备某项能力之后，才谈得上配它的具体规则。已实现的商品、库存、菜单管理就是详细规则层的内容。

开关会不断增补，存成门店实体上的 JSON 属性；形状定义在契约里。开关之间有上下级级联关系，不是平铺属性。

**本期只有 A 一个开关有真实消费者。** 其余 12 个本期只定义、只存储、只在抽屉里可设置，不写任何后端判定。

### 1.1 规则树与建议 key

key 要写进数据库和代码判断，一旦有数据就改不动，所以不用 A/B/C 字母编号（编号仅作示意）。建议语义化 key：

| 编号 | 开关 | 建议 key | 类型 | 父 | 默认值 | 本期消费 |
|---|---|---|---|---|---|---|
| A | 是否启用商品、库存和菜单管理 | `catalogManagementEnabled` | BOOLEAN | — | false | **是** |
| B | 是否启用外部商品、库存、菜单同步 | `externalCatalogSyncEnabled` | BOOLEAN | A | false | 否 |
| B1 | 开放平台开发者编码 | `openPlatformDeveloperCode` | STRING | B | 空 | 否 |
| C | 是否启用预约功能 | `reservationEnabled` | BOOLEAN | A | false | 否 |
| D | 是否支持押金预约 | `reservationDepositEnabled` | BOOLEAN | C | false | 否 |
| E | 是否启用排队叫号 | `queueCallEnabled` | BOOLEAN | A | false | 否 |
| F | 是否启用桌台管理 | `tableManagementEnabled` | BOOLEAN | A | false | 否 |
| G | 是否启用桌台状态管理 | `tableStatusEnabled` | BOOLEAN | F | false | 否 |
| H | 是否支持「等叫」功能 | `tableWaitCallEnabled` | BOOLEAN | G | false | 否 |
| I | 是否支持宴会订单 | `banquetOrderEnabled` | BOOLEAN | G | false | 否 |
| J | 是否启用取餐叫号 | `pickupCallEnabled` | BOOLEAN | A | false | 否 |
| I（第二个） | 是否支持应收单管理 | `receivableEnabled` | BOOLEAN | — | false | 否 |

原文里 `I` 出现两次（G 下的宴会订单、顶级的应收单管理）。按编号仅作示意处理，当成两个不同开关，不合并。

原 M（商品数量上限）已按 2026-09-16 裁决删除。

**规则树的业务逻辑不在本稿讨论范围**（Dexter 2026-09-16：逻辑没错，不用质疑业务选项）。本稿只负责开关之间的**关联性机制**，见 §5。

**仓内事实**：除 A 之外的 12 个开关，对应业务在仓内没有任何实现。我在 `contracts/openapi/components/`、`contracts/catalog/admin-catalog.json`、`apps/backend/catering-business-server/modules/`、两个前端的 `src/features/` 搜过 应收/receivable、预约/reservation、排队、叫号、桌台、宴会/banquet、押金/deposit、取餐/pickup，全部无命中（唯一一条 `reservation` 命中在 `ExtensionDefinitionService.java`，是扩展字段历史 key 保留逻辑，与业务预约无关）。后端 18 个模块里也没有对应域。

## 2. 第一性问题：这是什么

它是**能力授权**，不是门店资料，也不是权限。放行一个功能，从现在起要同时满足三个正交条件：

| 轴 | 问的问题 | 现状 |
|---|---|---|
| 门店 `status` | 这家店在不在营？ | 已有：ENABLED / DISABLED / VOIDED |
| **经营规则开关** | **这家店开通了这项能力吗？** | **本次新建** |
| 角色 capability | 这个人能不能操作这项能力？ | 已有 RBAC：`EDIT_STORE_CATALOG` 等 |

分清这三轴很重要，因为仓内已经有个叫 "capability" 的东西，很容易被当成现成机制复用。

**仓内事实**：`modules/execution-context/src/main/java/com/catering/v2s/platform/command/CatalogTargetCapability.java:10-16` 把数据节点类型映射成 `EDIT_STORE_CATALOG` / `EDIT_HEAD_COMPANY_CATALOG`。它回答的是「**某角色**在某类节点上能不能编辑」，不是「**某门店**开没开通」。两者不能互相替代：有编辑权的项目管理员，在未开通的门店上应该被拦住；没有编辑权的人，在已开通的门店上也应该被拦住。

**推论**：这是第三个轴，仓内没有现成机制，必须新建。

## 3. 仓内现状（核过的）

### 3.1 门店实体

`organization.store` 当前只有一个 JSONB 列 `extension_values`（建表 `db/migration/V20260726_090000_000__owner_schemas_and_workspace_compatibility.sql:122`，该列由 `V20260726_160000_000__extension_and_role_json_storage_alignment.sql:33-35` 追加，带 `CHECK (jsonb_typeof(extension_values) = 'object')`，**无索引**）。同表还有 `extension_rule_revision BIGINT`（扩展字段定义的乐观版本号）。

更新链路：`OperationsStoreManagementController.java:217-247` → `UpdateOperationsOrganizationStoreOperation` → `StoreService.updateStore`（`modules/organization/.../application/StoreService.java:113-142`，`@Transactional`）→ `StorePersistence`。

`OrganizationStoreUpdateRequest`（`contracts/openapi/components/organization/store.schemas.json:491-531`）是 `additionalProperties: false`，必填 `name`、`extensionValues`、`extensionRuleRevision`、`expectedVersion`。编辑抽屉每次提交全量字段并带 `expectedVersion` 做乐观锁（`StoreEditDrawer.tsx:135-154`）。

**推论**：新增开关字段必须改这个 schema 并重新生成，塞不进去。反过来，加进这个请求体的成本很低——权限、事务、乐观锁全部复用。

### 3.2 权限（对复用决定是好消息）

**仓内事实**：`BC-ORG-STORE-EDIT` 的 `grantableRoleNodeTypes` 是 `["GROUP", "REGION", "PROJECT"]`（正本 `contracts/catalog/admin-catalog.json:1181-1193`，生成到 `WorkspaceAuthorizationCatalog.java:98`），**不含 STORE**。且后端强制：`WorkspaceRoleService.java:567-578` 的 `validateCatalogs` 在角色创建和改权限时校验节点类型，不匹配抛 `RoleCapabilityIncompatibleException`；前端角色编辑器按 `capability.organizationTypes.includes(serviceNodeType)` 过滤（`RolePermissionFields.tsx:53`）。

**推论**：门店层角色在结构上拿不到门店编辑权限，「门店自己给自己开通能力」这条风险已被现有权限模型堵死。复用现有门店编辑权限是安全的，不需要新建权限点。

代价：能改门店资料的人就能改经营授权，没法只给某人改资料、不给改授权。当前只有 GROUP/REGION/PROJECT 能拿到，与「由集团、大区、项目有权限的人设置」吻合，本期不是问题。将来若要求「项目能改资料、只有大区能改授权」，那时才拆权限点。

### 3.3 门店编辑抽屉

**仓内事实**：`StoreEditDrawer.tsx` 是一串扁平 `Form.Item`（第 219-259 行），没有分组、没有 Collapse、没有 Tabs；两个前端的 `src/features` 全仓没用过 Collapse。也没有「字段 A 的取值决定字段 B 是否显示」的既有实现——最接近的是新建抽屉里的「禁用 + 级联清空」（`StoreCreateDrawer.tsx:275,289,247-248`）。

**推论**：级联开关的 UI 要新写。可以照 `StoreCreateDrawer` 的 disable 路子（但**不 reset**，见 §5.4），一串扁平 Form.Item 上再挂 13 个带四层层级的开关可读性会塌，抽屉需要分区。这是本期实打实的 UI 工作量。

### 3.4 A 的作用面与商品模型

**仓内事实**：商品、库存、菜单三个页面全在 operations-admin，页面 key 是 `PG-CATALOG-STORE-ITEMS`、`PG-INVENTORY-STORE-STATUS`、`PG-SALES-MENU-STORE`，三者 `requiredDataNodeType` 都是 `STORE`。门店不是页面内选的，是左侧导航栏的全局级联选择器（`features/role-home-bootstrap/ui/DataScopeSelector.tsx`，唯一渲染点 `OperationsApp.tsx:364-381`），选中后经 `queryContext.scopeRef` 传给页面。

`PG-CATALOG-BRAND-ITEMS`（品牌商品管理）的 `requiredDataNodeType` 是 `HEAD_COMPANY`，**不是门店级**，不在 A 的射程内。

**仓内事实**：没有可复用的「功能未开启」空态组件。`admin-ui-foundation` 的导出清单（`src/index.ts`，151 行）里没有 `FeatureDisabled` / `CapabilityGate` 之类；现成的 `OperationsRequiredScopeSurface` 解决的是「还没选门店」，不是「选了门店但功能没开」。三个页面目前各自手写 Alert。

### 3.5 契约生成链（终端本期不接）

**仓内事实**：契约源是 `contracts/openapi/components/<域>/*.schemas.json`；`scripts/generate/edge-codegen.mjs:25-43` 的 `targets` 常量逐条写明产物落点——后端 Java wire 类、两个前端各自的 TS 与 RTK 封装。这三个目标正好就是本期需要的全部范围。

按 2026-09-16 裁决，**终端本期不接**，只做 `apps/backend` 与 `apps/frontend` 两端。相关终端现状事实（无 HTTP 客户端、`kernel.base.transport` 为空壳、无门店上下文、生成脚本无 `apps/terminal` 产物）本稿不再展开，仅记录结论：终端不在本期范围，也不为它预留额外机制。

### 3.6 一个近亲机制，以及它为什么不是这个

**仓内事实**：`business_channel` 域已有「项目级渠道模板对哪些门店可见」的机制——`business_channel_template.store_visibility_scope` 取 `ALL_PROJECT_STORES` / `SELECTED_PROJECT_STORES`，配关联表 `business_channel_template_store_visibility(template_ref, store_ref)`（`V20260908_000000_003__business_channel_template_store_visibility.sql`，全文 29 行）。它刻意不对 `organization.store` 建外键，注释原文是门店引用保持跨 owner 的 opaque 身份。

**推论**：形态上是「上级为下级门店划定范围」的白名单，是近亲但不是同一件事——它的 owner 是渠道模板（一个模板对多个门店），经营规则开关的 owner 是门店本身（一个门店一份配置）。用关联表表达 13 个开关会退回成 EAV，而 EAV 正是 `V20260726_160000_000` 特地从门店上删掉的形态。所以不复用，但**契约里的门店引用语义要与它保持一致**（opaque ref，不建跨 owner 外键）。

## 4. 方案合理性

### 4.1 问题对不对

对。一个我认为值得先记一笔的替代方向：**这些能力会不会应该由合同驱动？** SaaS 里「这家店能用什么」通常是卖出来的，仓内已有 `store-contract` 域。

我的判断是**不返工，现在做手工开关是对的**：当前 `store-contract` 装的是商业合同（租赁、扣点这类商业关系），不是软件套餐；即使将来有套餐，套餐也只是**生成开关值的上游**，开关本身仍是同一份数据、同一个契约、同一套判定。到时增加的是一条「按套餐写入开关」的写入路径，不是推翻存储模型。这条不阻塞。

### 4.2 方案优不优

| 方案 | 形态 | 取舍 |
|---|---|---|
| (i) 独立表 | 一张 `store_operating_rule` 表，每开关一列或一行 | 一列：每加一个开关一次迁移，与「会不断补充」直接冲突。一行（EAV）：正是 `V20260726_160000_000` 特地删掉的形态，不该复活 |
| (ii) 复用 `extension_values` | 把开关当扩展字段存 | **不可以**，见下 |
| (iii) 新开一个 JSONB 列 + 契约声明父子关系 | `organization.store` 加一列，形状由契约定义 | **推荐** |

**(ii) 为什么不可以**——诱惑很大：`ExtensionFieldType` 里已有 `BOOLEAN`，抽屉已把 BOOLEAN 渲染成 Switch（`StoreEditDrawer.tsx:28-60`），种子数据里甚至已有 `is24Hour` 这种开关样子的扩展字段。但：

1. **owner 不同**。`extension_values` 的形状由扩展字段定义驱动，是**客户自定义资料字段**；经营规则开关是**平台内置语义**，代码要按 key 判断放行。把平台语义放进用户可自定义的命名空间，等于允许租户把自己的功能开关改名、停用、删掉。
2. **刚上线的扩展字段列表展示与类型化搜索会污染它**——开关会变成列表动态列和搜索项。
3. **`extension_rule_revision` 乐观锁是给自定义字段设计的**，开关跟着它走会被无关的定义变更阻塞保存。

(iii) 的唯一代价：将来「列出所有启用了桌台管理的门店」要走 JSONB 查询。PG 加 GIN 索引即可，当前没有这个需求。

### 4.3 代价配不配

删掉商品上限之后，本期有消费者的开关只剩 A 一个，另外 12 个定义了也没有效果。比例变悬殊了，所以这条要说清楚。

建议仍是 **契约里一次把整棵树定义完，但只为 A 写后端判定代码**。理由：树形关系必须一次想清楚，否则 UI 做不出层级，而且 key 一旦有数据就改不动；契约里多 12 行的成本近乎为零。反过来，为没有消费者的开关写判定代码才是过度设计。

本期真实工作量因此是：一列 + 一个契约文件 + 生成链接入 + 抽屉一个分区（含级联禁用）+ 三个页面一个共享空态 + 三个域写入口一次校验 + 种子数据。这个量级与「只放行一个 A」是匹配的。

抽屉只呈现开关本身，不标注功能建设状态（2026-09-16 裁决）。开关面板就是开关面板，建设进度是另一件事，标进去还要有人维护、会烂掉。

## 5. 开关之间的关联性（本稿重点）

Dexter 2026-09-16 明确：规则树的业务逻辑不用质疑，只需要关心开关之间的关联性。以下是这套关联性要定死的六条机制。

### 5.1 存储：新开一个 JSONB 列，平铺存储

`organization.store` 加一列，建议 `operating_rule_switches JSONB NOT NULL DEFAULT '{}'::jsonb`，照 `extension_values` 的既有做法加 `CHECK (jsonb_typeof(...) = 'object')`。

**存储平铺，级联关系写在契约里**：

- 存储：`{"catalogManagementEnabled": true, "tableManagementEnabled": true, "tableWaitCallEnabled": false}`
- 契约：每个开关声明自己的 `key`、`type`、`parent`、`default`

理由（第一性）：**级联是一条规则，不是一种结构**。规则属于契约，结构属于存储。把规则烧进存储结构有三个代价：读一个叶子要走长路径；新增一层会改变已有数据形状、需要数据迁移；后端判断 A 写 `rules.catalog.enabled`、判断 H 写 `rules.catalog.table.status.waitCall`，key 不稳定。

平铺之后，**新增一个开关 = 契约加一条声明，存储零迁移**——这正是「会不断补充」想要的性质。

### 5.2 默认值（已裁决）

Dexter 2026-09-16：全部开关配置项都有默认值，BOOLEAN 默认 `false`，数值类型默认 `0`；不用处理存量，数据最终都会 reset。

落地为契约规则：

- 每个开关在契约里**必须**声明 `default`，没有声明就是契约不合法（生成时报错）。
- 类型级默认：BOOLEAN → `false`，NUMBER → `0`，STRING → 空。
- 读取时以「契约默认值」为底，用存储里的值覆盖。存储里没有的 key 就是默认值，**不需要数据迁移，也不需要回填**。

两条随之而来的事实，不是问题，是必须一起做的事：

1. **当前这棵树里没有 NUMBER 类型的开关**（商品上限删掉后，12 个 BOOLEAN + 1 个 STRING）。NUMBER 的默认值规则仍写进契约，供将来使用。
2. **A 默认 false，意味着 reset 之后每家门店的商品/库存/菜单三页都是未开启的**。所以**种子数据必须显式给门店开 A**，否则 reset dev seed 之后 DEV 环境这三个页面对所有门店都不可用。这条要写进详设的种子清单，不能漏。

STRING 的默认值裁决里没有明说，本稿按同一规则取「空」。若要别的（例如 null 与空串区分），一句话即可改。

### 5.3 生效判定：`applicable` 与 `value` 分开

父子关联的核心是「子开关在父关闭时是什么状态」。用一个概念不够，要两个：

- **`applicable(key)`** ＝ 祖先链上每一个开关的 `effective` 都为 true（根开关恒为 applicable）。它回答「这个开关现在说得上话吗」。
- **`value(key)`** ＝ 存储值，缺失则取契约默认值。
- **`effective(key)`**（仅 BOOLEAN）＝ `applicable(key) && value(key)`。它回答「这项能力现在可用吗」。

非 BOOLEAN 开关（当前只有 B1 这个 STRING）**没有 effective**，只有「值」和「是否 applicable」。B 关闭时，B1 填了什么都不生效。这样区分之后，`openPlatformDeveloperCode` 这类配置项不会被硬塞进布尔语义里。

由此得到一条**硬规则**：

> 任何消费方判断一项能力是否可用，必须用 `effective`，**不得直接读叶子键**。

否则「父已关闭但子键还是 true」会导致越权放行。这条不能靠每个消费方自己写 AND 链——**判定器应由契约驱动、后端 Java 一份、前端 TS 一份，两份都从同一份契约声明生成或读取同一份声明**，消费方只调函数。

反面教材就在仓里：`ExtensionFieldType` 这个闭集有 **4 份拷贝**，只有 Java wire 枚举和两份生成 TS 受生成链保护，另外 `ExtensionDefinitionService.java:498` 的 `Set.of("TEXT",...)`、`BusinessEntityValueSupport.java:37-52` 的 switch、`typedExtension.ts:1` 的手写字面量都靠人工同步——加一个类型要改 4 处、其中 2 处不受保护。开关判定如果也这么搞，两端漂移是迟早的事。

### 5.4 父关闭时子值保留，不清除

父开关关掉时：

- **保留子值**，不物理清除。父重新打开，子配置原样恢复。
- UI 上父关闭时子项**置灰不可编辑**，但**不清空表单值**（这一点和 `StoreCreateDrawer` 的「禁用 + 级联清空」不同，那里清空是对的，因为父变了候选集就失效了；这里清空是数据损失）。

理由：开关是会被反复开关的配置，清除子值不可逆。用户关掉桌台管理再打开，不应该丢掉「等叫」「宴会订单」两项配置。

### 5.5 写入校验：允许「父 false、子 true」落库

这是 §5.4 的必然结果，要显式写死，否则实现时很容易顺手加一条「父关则子必须为默认值」的校验，把 §5.4 推翻。

- **允许**存储里存在「父 false、子 true」的组合；
- **不允许**的是消费方直接读叶子键——那是 §5.3 的判定规则负责的。

写入时真正要校验的是这三条：

1. **key 必须在契约声明的闭集里**。出现契约未声明的 key → 拒绝写入（`additionalProperties: false` 的精神）；读取时遇到未知 key → 忽略，不报错（容忍旧数据，但不让它生效）。
2. **值类型必须与契约声明一致**（BOOLEAN 位置不能写字符串）。
3. **父必须存在且为 BOOLEAN**。这是契约本身的一致性约束，在生成时校验：每个 `parent` 必须指向已声明的 key、不能成环、且父必须是 BOOLEAN 类型（只有布尔能承担「开 / 关」的门）。当前树满足——B1 的父 B 是 BOOLEAN，没有以 STRING 作父的情况。

### 5.6 读不到配置时 fail-closed

后端校验时读不到门店或读不到开关列（异常、门店不存在），应当**当作未开通并拒绝**，而不是放行。理由：这是授权判定，授权读不到就不应该放行。

代价要讲清楚：这会把一次数据库故障放大成「功能不可用」而不是「功能照常」。我认为这个方向是对的——授权类判定 fail-open 的后果（未授权门店能写数据）比 fail-closed 的后果（临时不可用）严重得多，而且与仓内既有的 `isExtensionDefinitionRevisionAtLeast` 失败关闭取向一致。

## 6. 本期唯一起作用的开关：A

- **作用面**：`PG-CATALOG-STORE-ITEMS`、`PG-INVENTORY-STORE-STATUS`、`PG-SALES-MENU-STORE` 三个门店级页面。
- **不含** `PG-CATALOG-BRAND-ITEMS`（品牌商品管理，节点类型 HEAD_COMPANY，不是门店级）。
- **关闭时的行为**：三页显示「功能尚未开启，需项目对门店授权」；后端三域**写入口拒绝**；历史数据完全不动。

### 6.1 拦截层次：写拒绝、读放行

「只是开关，只控制门店当前能不能用，不影响历史数据，不要过度设计」这句话推到底：

开关是授权。**只在前端拦的授权不是授权**——直接调 API 就能绕过。但「不影响历史数据」又要求数据必须保留。两条合起来推出一个干净的结论：

> **后端在 catalog / inventory / sales-menu 的写入口校验开关并拒绝；读接口不改；前端拿到开关后直接渲染「功能尚未开启」空态，根本不发列表请求。**

数据原样留在库里，重新开通后立刻恢复可见。成本是写入口一次门店读 + 一次 JSON 判断。

这**不是过度设计，是让开关真的成立的最小实现**。更小的方案（只做前端提示）不成立，因为开关会立刻变成一句装饰。

空态文案按原话：「功能尚未开启，需项目对门店授权」。**仓内事实**：没有可复用组件（§3.4），三个页面目前各自手写 Alert，建议抽一个共享空态组件放 foundation，避免三份文案各写各的。

## 7. 审计：门店所有信息的变动都要留痕

Dexter 2026-09-16 裁决：门店所有信息的变动都需要审计记录，以前没做的一并补上。这从「建议」升级为本期交付项，和开关本身并列。

### 7.1 现状缺口

**仓内事实**：`StoreService.java:40` 的审计白名单是 `Set.of("code", "name", "status", "relationship")`；真正产出差异的 `BusinessEntityValueSupport.changed()`（:75-85）和 `createdChanges()`（:68-73）**只比较 code / name / status**。

对照编辑抽屉实际可改的字段：

| 门店可编辑字段 | 当前是否审计 | 说明 |
|---|---|---|
| `name` 门店名称 | ✅ | 唯一在审的 |
| `headCompanyId` 总公司关系 | ❌ | 白名单里有 `relationship`，但 `changed()` 从未产出过，是**死配额** |
| `notes` 备注 | ❌ | 既不在白名单，也不比较 |
| `extensionValues` 扩展字段 | ❌ | 同上 |
| `operatingRuleSwitches` 经营规则开关 | — | 本次新增，必须进 |

也就是说四个可编辑字段里只有一个在审。开关如果照这个默认走，「谁在什么时候给这家店开了什么能力」将无处可查——而开关是授权变更，比门店改名重要得多。

### 7.2 要改的三处

1. **`StoreService.java:40` 的 `AUDIT_FIELDS` 白名单**：补齐上表缺的字段。
2. **`BusinessEntityValueSupport` 的 `changed()` 与 `createdChanges()`**：真正产出这些字段的差异。创建路径同样要补——门店创建时填的备注、扩展字段、开关初值也应当留痕，不能只记 code/name/status。
3. **`AuditChangePolicy.allow()`**：它对不在闭集里的 `fieldKey` **直接抛异常**（:18-23）。扩展字段的 key 是**租户自定义的、动态的**，静态闭集装不下，所以这一处必须一起改，否则第 2 步会在运行时炸。

### 7.3 粒度建议：逐字段，不要整块 JSON

`AuditChange` 是 `(fieldKey, beforeValue, afterValue)` 三元组。两个 JSON 字段有两种记法：

- 整块记：`fieldKey="extensionValues"`，before/after 是整个 JSON 串。简单，但审计历史里看不出到底改了哪一项。
- **逐 key 记**（推荐）：`operatingRuleSwitches.catalogManagementEnabled`、`extensionValues.floorLabel`。审计历史直接可读，「谁开了桌台管理」一眼可见。

两者的 key 来源不同，处理方式也不同：

- **经营规则开关**的 key 来自**契约闭集**，可以静态全量进白名单，不需要放宽策略；
- **扩展字段**的 key 是租户自定义的，需要 `AuditChangePolicy` 支持**前缀允许**（例如允许 `extensionValues.` 开头的 fieldKey）。

### 7.4 一个连带范围，建议一起做

**仓内事实**：`BusinessEntityValueSupport` 是品牌、经营租户、总公司、门店**四类实体共用**的。

在它里面补 `notes` / `extensionValues` 的差异产出，会同时补齐这四类实体的审计。只给门店分叉反而更脏——要在共享函数里按 entityType 开岔。建议**四类一起补**，成本几乎相同，结果一致。裁决说的是门店，所以这条标出来：如果只要门店，说一声即可。

### 7.5 读出口不用动

**仓内事实**：`OrganizationAuditHistoryService.readOperationsAuditProjection()`（:53-81）已包含 `AuditEntityTypes.STORE`，两个前端都已有 `features/audit-history`。新增的字段会自动出现在现有审计历史里，不需要新页面。

### 7.6 已裁决，不再讨论

- **不**为门店用户单独做「已开通能力」总览 UI。不管是不是门店的人，操作到某个页面时按开通的能力判断即可（2026-09-16）。
- 抽屉**只呈现开关本身**，不标注「功能建设中」（2026-09-16）。

至此本稿无待裁决项。

## 8. 验收要证明什么

不是「代码写了」，是这些性质成立：

1. 关闭 A 的门店，三个页面显示未开启文案；**后端写入口同样拒绝**（只证前端不算）。
2. 关闭 A 不改变任何历史数据；重新开通后，原有商品、库存、菜单原样可见。
3. 父开关关闭时子开关的存储值**没有被清除**；父重新开通后子配置原样恢复。
4. 消费方走 `effective` 判定：构造「父 false、子键 true」的数据，能力必须不可用。
5. 契约未声明的 key 写入被拒绝；读取到未知 key 时忽略而不报错。
6. 契约里每个开关都有 `default`；缺失 `default`、`parent` 指向不存在的 key、成环、或以非 BOOLEAN 作父，生成时报错。
7. 门店层角色无法修改开关（现有权限模型已保证，验收只需证明没有被本次改动破坏）。
8. reset dev seed 之后，种子门店的 A 是开启的，三个页面可用。
9. 门店的名称、总公司关系、备注、扩展字段、经营规则开关，**任一变动都产生审计记录**，能在现有审计历史里按字段看到 before / after。判据要自带反例：只改备注、只改一个扩展字段、只翻一个开关，各自都必须留痕。
10. 门店**创建**时填写的上述字段同样留痕，不只是 code / name / status。
11. 扩展字段这类租户自定义 key 的审计不会因为不在静态白名单里而抛异常（`AuditChangePolicy` 的前缀允许生效）。

## 9. 明确不在本次范围

- 详细经营规则层（门店自己配的具体规则）。
- 12 个没有消费者的开关的业务实现。
- 终端（2026-09-16 裁决，本期只做 apps/backend + apps/frontend）。
- 商品数量上限（2026-09-16 裁决删除）。
- 按合同 / 套餐自动写入开关（§4.1，将来的上游写入路径，不影响本期存储模型）。
- 按开关筛选门店的列表能力（没有需求，将来加 GIN 索引即可）。
- 为门店用户单独做「已开通能力」总览 UI（2026-09-16 裁决不做；判断点在各功能页面）。
- 抽屉里的「功能建设中」标注（2026-09-16 裁决不做）。
- 组织树、扩展字段**定义机制**、RBAC 权限模型的任何改动。注意：补扩展字段**值变更的审计**（§7）不属于改动其定义机制，在本期范围内。

## 10. 本稿性质与证据边界

讨论稿，不是正式需求稿，不构成详设、实施计划或任何运行授权。

标「仓内事实」的都打开了对应源码、迁移脚本或契约文件，带路径行号；标「推论」的是从这些事实推出来的；未决的进了 §7。

**未核实的一处**：`collaboration` 域是否已有「开放平台开发者 / ISV 编码」这类实体，本轮没查。这关系到 B1 将来是不是应该从该域选择、而不是自由填字符串。本期按原话先做 STRING，但**在把这个 string 当成权威标识之前需要先核实**，否则将来对接会出现两套编码。

本会话是续接会话，只做静态只读核验，未执行任何构建、测试、生成或运行命令，除本文件外未改动任何文件。
