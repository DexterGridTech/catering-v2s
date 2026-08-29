# base-1 详设合并稿 · 以 Codex 稿为底 + 六条修订(Claude)

**会话出处**:fresh v2s-rooted 独立评审会话。本文所有仓内事实均在本会话内重开原始源码与迁移文件亲验,
未采信任一份详设的自报数字。

---

## 0 · 合并结论

**底稿取 Codex 的 `2026-08-27-v2s-base-1-implementation-design-codex.md`(1421 行),不取我的那份(215 行)。**

这不是客气。逐项比较后,Codex 稿在三个决定性的地方比我的强:

| 维度 | Codex 稿 | 我的稿 | 判定 |
|---|---|---|---|
| **后端先闭环怎么落地** | §1.3「短命双投影窗口」——新结构字段与旧字段并存,旧 mapper 继续填充,前端 F1/F2 切换后 F3 同批删净;明令禁止 adapter/flag/v1 路径/fallback/双写/DB 兼容列 | 「保留字段声明、返回 null」 | **Codex 对,我的错**。见 §2 的 X-1 |
| **契约生成链头** | `contracts/openapi-source/{business-channel,collaboration}.schemas.json` → `contracts/openapi/components/…` | 头写错了 | **Codex 对**。已亲验 `contracts/openapi-source/` 确实只含那两个文件 |
| **分类/单位没有 transition** | `BASE1-D01` 独立发现并标 `DEXTER_DECISION`,倾向方案 B(补分类、单位、属性、点单选项四个 transition) | 同样发现,但没给出可执行的两案比较 | **Codex 更完整** |

Codex 稿另有我完全没做到的深度:§10.2 状态表/列/CHECK/回填全集、§10.3 唯一键→partial unique 全集、
附录 C 前端 handwritten consumer 全集、附录 D testId exact set、§13b 三维对账时点。
**这些直接进合并稿,不重写。**

以下六条是我亲验后要求并入底稿的修订。每条都给仓内事实与失败形态,不给我验证不了的修法细节。

---

## 1 · 修订清单

### A-1 · enum 裁定(Dexter 2026-08-27)必须并入 —— Codex 稿写于裁定之前

**仓内事实**:同一个概念在同一份契约里两种形态 ——

```
enum         BusinessChannelTemplateCreateRequest/properties/operatorKind
type=string  BusinessChannelTemplateView/properties/operatorKind
```

`accessKind`、`dineInForm`、`orderKind`、`ownerNodeType`、`capabilityClass` 同型:**写请求时是闭集,读响应时是裸 `string`。**

**对底稿的影响**:附录 E.1 把字典写成手抄的字面量对(`INTERNAL=内部接入`…)。
在响应侧是裸 `string` 的前提下,前端生成类型拿到的是 `string` 不是联合类型 ——
**E.1 只能是一份手抄的平行清单,§7 承诺的「exhaustive dictionary tests」没有真相源可比对。**

**Dexter 裁定:统一都用 enum。** 已写进后台编码规范 **1-O** 与需求 §7.4。落成三步,且**①必须先做**:

1. **响应 schema 补 enum**(值取请求侧现成字面量,是复制不是新造);
2. 重生成契约,两个 App 的字典**从生成的联合类型派生** —— 后端加枚举值,前端编译不过直到补文案;
3. 删除 DisplayName 字段。

**⚠️ 补 enum 时必须同步取齐三值。** 实测 `CatalogItemDetail.status` / `CatalogUnitList.status` 是两值
`('ENABLED','DISABLED')`,而 `CatalogDictionaryQuery.status` 已是三值。三态改完后若响应 enum 仍留两值,
**owner 会返回一个不在自己 enum 里的值**。

**成员集**:底稿 B.3 的 12 个 → **13**,补 `nodeTypeDisplayName`(collaboration 的 `nodeType` 实测是裸 `string`,
而节点类型是代码闭集,按判据必然覆盖)。**底稿附录 E.3 另找到的四类**(`businessScopeDisplayNames`、
`bindableNodeTypeDisplayNames`、`attributeValueLabels`、`attributeDictionary` 内成员)**采纳并入**,
理由与判据一致 —— 只删 12 个字段,后端仍在逐记录返回展示决定。

**⚠️ 判据是概念不是属性名。** 全域扫描出 22 组「一处 enum、一处裸 string」的同名属性,**其中含假阳性**:
`TypedProblem.code` 是 47 值错误码 enum,`CatalogItem.code` 是用户自填的业务编码 —— 后者不是闭集,不得被要求 enum。
`CatalogItemDetail` 内 `ownerType` 还同时存在 `['CATALOG_ITEM','SKU']` 与 `['ITEM','SKU','OPTION_VALUE']` 两份不同值集。
**按名字批量补 enum 会直接改错。**

---

### A-2 · 底稿依赖的 CONTRACT 门验不了结构 —— 这是本批最危险的一条

**仓内事实**(本会话亲验 `BackendAcceptanceTest.java`):CONTRACT verdict 的**全部**判定是

```java
if (!expected.contains(result.status())) { contractPass = false; throw new AssertionError("CONTRACT: …"); }
```

即 **HTTP 状态码的成员判断,零 schema 校验**。更糟的是同一方法上方:

```java
try { bodyJson = … mapper.readTree(response.body()); }
catch (Exception invalidJson) { bodyJson = mapper.createObjectNode(); }
```

**响应体是坏 JSON 都不会让 CONTRACT 红。** 另经全仓搜索,`JsonSchema` 在 `apps` / `libraries` / `scripts` / `tools`
下**零命中**;`scripts/check/openapi-contracts` 校验的是 OpenAPI 文档本身,不是运行时响应是否符合它。

**对底稿的影响**,两处直接落空:

- §1.3 第 4 条「旧投影只做 contract existence 检查」—— 在当前实现下**等于什么都不检查**,
  旧字段被删光、被改成错类型、被返回成坏 JSON,这道门一律绿;
- CP-B4 的 proof「新结构 HTTP oracle」—— 若挂在 CONTRACT 上,则 CP-B4 的产出**没有任何门验证**。

**判据(可证伪)**:后端 closure 完成前,对每一个新结构字段,必须存在一条 **BUSINESS** 断言真实读取该字段的值并比对业务预期。
**红夹具**:把 owner 里某个新结构字段改成返回空数组或错类型 —— 若 backend-acceptance 仍全绿,则该字段无门,CP-B6 不成立。

⚠️ 我不主张为此新建 schema 校验基建(与当前阶段标尺不符)。**把断言写进 BUSINESS 维度即可**,那是现成能力。

---

### A-3 · §10.5 迁移定序会在 `business_channel` 上直接失败

**仓内事实**:`V20260819_230000_001__business_channel_owner.sql` 第 47 行 ——

```sql
status VARCHAR(16) NOT NULL CHECK (status IN ('DRAFT', 'EFFECTIVE', 'DISABLED')),
```

底稿 §10.5 的顺序是「**3. 执行显式 status 回填** … **5. drop 旧 CHECK,add 新 CHECK**」,
而 §10.2 的回填语句要往这张表写 `'ENABLED'`。**`'ENABLED'` 不在旧 CHECK 的值域内,PostgreSQL 会直接拒绝这条 UPDATE。**

**范围恰好一张表。** 逐表亲验其余回填目标均未越界:

| 表 | 旧 CHECK 实测 | 回填 | 越界 |
|---|---|---|---|
| `business_channel.business_channel` | `DRAFT/EFFECTIVE/DISABLED` | `EFFECTIVE→ENABLED` | **是** |
| `catalog.catalog_item` | `DRAFT/ENABLED/DISABLED/ARCHIVED/VOIDED` | `DRAFT→DISABLED`、`ARCHIVED→VOIDED` | 否 |
| `catalog.catalog_sku` | `ENABLED/DISABLED/ARCHIVED/VOIDED` | `ARCHIVED→VOIDED` | 否 |

**判据**:每一条回填 UPDATE 的目标值,必须落在**该表执行该语句时刻**生效的 CHECK 值域内。
`catalog_sku` 的 `V20260816_020000_000` 是仓内现成的 DROP+ADD 先例,可照该形态。

---

### A-4 · `catalog_item.status` 的列默认值三态后非法,两份稿都没处置

**仓内事实**:`V20260806_120000_000__catalog_inventory_backend.sql` 第 14 行 ——

```sql
status TEXT NOT NULL DEFAULT 'DRAFT',
```

**这是全平台唯一一个三态改完后会变非法的 status 列默认值**(全量扫描:其余带 DEFAULT 的 status 列一律 `'ENABLED'`,
三态后仍合法)。新 CHECK 不含 `DRAFT`,该 DEFAULT 与表自身的 CHECK 直接矛盾。

底稿只在 CP-B1 的 FORBID 里写了「默认值掩盖 null」,**没有改这个 DEFAULT 的步骤**。

**判据**:迁移完成后,任何一张主数据表都不得存在「列默认值不在本表 CHECK 值域内」的组合。
这一条可在同一条迁移里顺手做完,不构成额外批次。

---

### A-5 · 三处 `status` 列在两份稿里都没有归档

**仓内事实**(全量迁移扫描,按最后一次声明定当前值域):恰为两值 `ENABLED/DISABLED` 的 **16 处**,
已是三值的 3 处,其他值域 10 处。其中这三处在底稿里没有归档:

- `organization.commercial_group_idempotency.status` —— 底稿全文未提及;
- `inventory.stock_target.definition_status`、`inventory.stock_bom.definition_status` ——
  底稿 §10.4 写了「不改」,但那是决定,**不是带理由的豁免登记**。

**为什么要管**:规范 **1-L** 的完备性是反向判据 ——「任何带 `status` 列的表,不在主数据清单里就必须在豁免清单里并带理由」。
只写「本批不改」,下一个人无从知道是「不该改」还是「漏了」。

**诚实边界**:`scripts/check/lifecycle-vocabulary` **尚未建**,所以现在不会红。这条是设计完备性,不是当前门失败。
理由是现成的(幂等记录不是主数据;inventory 两张的 partial index 与三处同 predicate 本批不动),**写下来即可,不是新工作**。

---

### A-6 · 需求文档已按亲验更正三处,底稿据此对齐

我的需求文档原写「两值 CHECK 声明 17 处 / 15 表 / 本批 11 张」,亲验后**三处归档错误**,已更正:

- `catalog_category` 实测已是三值 `('ENABLED','DISABLED','VOIDED')` —— **不在本批**。底稿 §10.2
  「需求所称两值不作为实施事实」是对的,采纳;
- `business_channel` 是 `DRAFT/EFFECTIVE/DISABLED`,**不属两值**,须走值域变更 + 回填,不能混在「加 VOIDED」那档;
- 本批加 `VOIDED` 的两值表因此是 **9 张**:`organization_node`、`brand`、`tenant`、`head_company`、`store`、
  `workspace_account`、`workspace_role`、`business_channel_template`、`unit_definition`。

---

## 2 · 我那份稿被推翻的地方(记录在案)

- **X-1 · 「保留字段声明、返回 null」的过渡方式是错的。** `catalogModel.ts` 的 `requiredBusinessTextArray`
  对 `undefined` 抛 `CATALOG_REQUIRED_FIELD_MISSING`、对非数组抛 `CATALOG_OWNER_SUMMARY_INVALID`,
  而 `categoryPathLabels` / `preparationSummary` / `attributeSummary` 在契约里是 required 数组 ——
  返回 null 会打死商品列表与详情。**Codex 的短命双投影窗口从根上避免了这个中间态,取它。**
- **X-2 · 契约生成链头写错**,取 Codex 的 `contracts/openapi-source/`。
- **X-3 · 批次划分前提被证伪**(五个待退役 operation 均有手写前端调用方),已并入底稿的 CP 结构。
- **X-4 · `catalog_category` 状态值域**:我写「两值」是错的。**但底稿也需注意**:CHECK 是三值不等于三态可用 ——
  该表当前是否存在产生 `DISABLED` / `VOIDED` 的写入路径,仍须在 `BASE1-D01` 裁定后一并确认。

---

## 3 · Dexter 2026-08-27 已裁的三项(D01=B、D02=B、D03=C)

三项均已由 Dexter 于 2026-08-27 裁定,**不再是待裁项**。仓内事实在本会话亲验,不转述 Codex 稿自述。
各项保留候选方案原文作为决策留痕,并在其后给出**裁定与必须跟着改的推论**。

---

### D01 · 分类与单位在本批之后还有没有生命周期命令

**事实一 · 平台已有统一惯例。** 全量枚举契约 path,已有 `transitionStatus` 形态(`POST …/status`)的实体 **17 个**:
business_channel 与其 template、organization 的 node/brand/head_company/store/tenant、platform_admin、
workspace_account、workspace_role、group_workspace、external_system、provider_profile、
catalog 的 dictionary_entry / catalog_item(单个 + 批量)/ production_tag。

**事实二 · catalog 定义库的四个实体是平台唯一的例外。** 实测它们今天的命令是:

- **分类**:create、update、delete、move、candidates —— **没有任何状态命令**;
- **单位**:create、update、delete、**disable(单向,没有对应的 enable)**、list;
- **属性定义**:create、update、delete、list —— 无状态命令;
- **点单选项定义**:create、update、delete、list —— 无状态命令。

**事实三 · 状态改不了。** `CatalogUnitUpdateRequest` / `CatalogCategoryUpdateRequest` /
`CatalogAttributeDefinitionUpdateRequest` 三个请求体的属性实测分别是
`code/dataNodeRef/expectedVersion/name/precision/unitDimension/unitRef`、
`categoryRef/dataNodeRef/expectedVersion/name`、`code/dataNodeRef/definitionRef/expectedVersion/name/options`
—— **都不含 `status`**。今天改状态只能靠专门 operation。

**为什么这是个决定**:需求 §5 步骤四要**退役 5 个** operation(`deleteOperationsCatalogCategory`、
`deleteOperationsCatalogUnit`、`disableOperationsCatalogUnit`、`deleteOperationsCatalogAttributeDefinition`、
`deleteOperationsCatalogOrderOptionDefinition`),只**新增 2 个** transition(属性、点单选项)。
两边一减一增之后,**分类与单位一个状态命令都不剩** —— 建错一个分类将永久无法停用、无法标记删除,
只能改名。裁定 1(定义库一律 `transitionStatus`)与裁定 2(物理删除完全取消)在这两个库上**变得不可执行**。

**候选方案**

- **方案 A · 只加 2 个**(需求现文字面)。operation 净 −3。代价:分类与单位失去全部生命周期能力,
  裁定 1/2 在这两个库上落空。**本稿认为这是需求书写时的疏漏,不是有意的产品选择。**
- **方案 B · 加 4 个**(分类、单位、属性、点单选项各一个 `transitionStatus`)。operation 净 −1。
  四个定义库与平台其余 17 个实体形态一致。代价:多两个 operation,须重算 operation 预算。
- **方案 C · 把 status 折进现有 PATCH**,不新增 operation(净 −5)。**本稿不建议**,两条理由:
  一是与你「统一走 transitionStatus」的裁定直接冲突;二是状态变更与字段编辑是两个授权身份,
  折进 PATCH 等于让"谁能停用"与"谁能改名"共用一个 operation 的授权判定,
  与需求 §0.2「决定授权的维度留在接口身份里」相悖。

**✅ Dexter 裁定:B。**

**推论**:新增 4 个 `transitionStatus`(分类、单位、属性定义、点单选项定义),退役 5 个,**operation 净 −1**。
四个定义库自此与平台既有 17 个实体形态一致。`disableOperationsCatalogUnit` 这个单向命令一并退役 ——
单位从"只能停用不能启用"变成可来回切。**operation delta 至此可以冻结。**

**影响面**:两个新 operation id、两条 path、对应 owner 方法与 readback、前端两处调用点、
operation 预算重算。**须在冻结 operation delta 之前裁定** —— 预算门对新 id 会立刻失败。

---

### D02 · 手机号/登录名被作废账号占用过之后,还能不能再用

**事实一 · 现状是普通唯一键。** `workspace_account` 建表处实测
`CONSTRAINT uq_workspace_mobile UNIQUE(workspace_uuid, mobile_normalized)` 与
`CONSTRAINT uq_workspace_login UNIQUE(workspace_uuid, login_name_normalized)`,
**都是普通 UNIQUE,不是 partial**,后续迁移未改动。partial(排除 VOIDED)是**本批要改成的目标态**,
目的正是落实 1-M「作废后业务唯一键必须可复用」。

**事实二 · 改成 partial 之后,同一个手机号可以同时存在多行**:任意多行历史 VOIDED,加 0 或 1 行当前非 VOIDED。

**为什么这是个决定**:你的**裁定 19** 要求邀请的创建与完成两处都拒绝 `DISABLED` 与 `VOIDED` 账号,
`accountExists` 由布尔改为四态 `ABSENT/ENABLED/DISABLED/VOIDED`。
但当一个手机号**只有 VOIDED 历史、没有当前账号**时,这两条规则给出相反答案:

- 按 **1-M**,VOIDED 已释放业务键 ⇒ 该手机号可用 ⇒ 应答 `ABSENT`,允许新建;
- 按 **裁定 19 字面**,查到 VOIDED ⇒ 拒绝 ⇒ **该手机号永久不可再用**,partial index 白改。

**候选方案**

- **方案 A · 只有 VOIDED 历史时视为 `ABSENT`,允许新建。** 裁定 19 的"拒绝 VOIDED"理解为
  "拒绝当前账号处于 VOIDED"。与 1-M 自洽。代价:离职员工的手机号立即可被再次邀请,
  邀请人看不到"这个号以前有过账号"。
- **方案 B · 见到 VOIDED 即永久拒绝。** 严格照裁定 19 字面。代价:与 1-M 直接矛盾,
  `workspace_account` 的 partial index 变成没有意义的改动;且这实质是一条**黑名单策略**,
  用唯一键的副作用来实现,后面想放开会很难。
- **方案 C · 返 `ABSENT` 但同时把"存在作废历史"作为另一个事实返回。** 允许新建,邀请人能看到历史。
  这一条与你的**裁定 18**(「对象只存自身状态,每个维度各自作为事实返回,不合并成一个值」)形态一致 ——
  `accountExists` 作为四态枚举本身就是把"在不在"和"什么状态"合并成了一个值。
  代价:readback 多一个字段,前端多一处展示。

**✅ Dexter 裁定:B —— 与本稿建议相反,按裁定执行。**

裁定成立的口径是:**身份键不是业务编码。** 分类编码、单位编码是业务自己选的标签,选错要能重来;
手机号标识的是一个自然人,复用会让"这个号以前是谁"变得不可判定。1-M 的目的是"别让看不见的行占住
用户能选的标签",对身份键不成立。

**⚠️ 推论 · Codex §10.3 必须删掉两行,否则库与应用打架。** 该稿计划把
`uq_workspace_mobile` → `ux_workspace_account_active_mobile … WHERE status <> 'VOIDED'`、
`uq_workspace_login` → `ux_workspace_account_active_login … WHERE status <> 'VOIDED'`。
既然应用层永久拒绝 VOIDED 身份,**DB 就不能放行**:改成 partial 会让 DB 允许第二行而应用永远拒绝,
predicate 变成死代码。**这两个唯一键保持普通 `UNIQUE` 不动。**
`workspace_role` 的 `uq_workspace_role_name` **不在此例外内**(角色名是业务标签),照常改 partial。

**推论 · 已登记为规范 1-M 的显式例外**,理由同上,已写入正本。

**推论 · `accountExists` 四态语义固定**:`VOIDED` 即拒绝,与 `DISABLED` 同样返回 `ACCOUNT_NOT_BINDABLE` / 422。
**不新增"存在作废历史"字段**(那是被否掉的 C 方案)。

**影响面**:`WorkspaceInvitationService` 的账号查找(第 1046–1089 行)与 `accountExists` helper
(第 1323–1331 行)的分支逻辑;若选 C,还要改 `workspace-access.schemas.json` 的两个响应
(第 257–375 行,本就要从布尔改四态,顺带)。

---

### D03 · 点单选项组作废之后,它下面可选项的编码算不算释放

**事实一 · 父子两表都有 scope 级唯一编码。** `V20260820_010000_002` 迁移(其文件头注明是你的裁定:
「点单选项组及其可选项各自拥有 scope 内唯一业务编码,创建后不可修改」)给两张表都加了 `code`:

- 父 `catalog_order_option_definition`:`UNIQUE (data_node_ref, brand_ref, code)`;
- 子 `catalog_order_option_definition_value`:`UNIQUE (data_node_ref, brand_ref, code)` ——
  **注意是 scope 级,不是父级**;该表另有 `UNIQUE (order_option_definition_ref, display_order)`。

**事实二 · 子表没有生命周期。** `catalog_order_option_definition_value` **没有 `status` 列**。
本批给父表加三态并把父表唯一键改成排除 VOIDED 的 partial index 之后,
**子表的 `uq_..._value_scope_code` 仍是普通 UNIQUE,没有任何 VOIDED 出口。**

**为什么这是个决定**:结果是"选项组作废了,但它下面每个可选项的编码永远占着"。
若不裁,实施方要么悄悄给子表也加 `status`(**扩大了数据模型,超出本批范围**),
要么在文档里宣称"定义编码已释放"(**与实际不符**)。

**候选方案**

- **方案 A · 本批不扩展子表模型,诚实记录"父编码释放、子编码仍占用"。** 代价:
  同一个 scope 内,作废过的选项组下的可选项编码不能再用;用户会遇到"这个编码明明看不见了却说重复"。
- **方案 B · 同批给子表加 `status` 与 partial unique**,与父表一致释放。代价:多一张表进三态改造,
  多一处回填与索引变更;且子表当前没有任何状态语义,加了之后"可选项自己能不能停用"会变成新的产品问题。
- **方案 C · 把子表编码的唯一域从 scope 收窄到父级**(`UNIQUE (order_option_definition_ref, code)`)。
  父作废后子编码天然随父不可见,不存在跨组撞车。**但这会改变你在 `V20260820_010000_002` 里已裁定的语义**
  (「scope 内唯一」),属于推翻既有裁定,不能由设计方代做。

**✅ Dexter 裁定:C。**

**推论 · 这是对 `V20260820_010000_002` 文件头所记裁定的显式修订。** 该注释写「点单选项组及其可选项
各自拥有 **scope 内**唯一业务编码」;**可选项部分改为父级唯一**,选项组部分不变。新迁移须在注释里写明它修订了哪一条,
不得让两条裁定并存。

**推论 · 具体变更**:`catalog_order_option_definition_value` 的
`uq_catalog_order_option_definition_value_scope_code (data_node_ref, brand_ref, code)`
改为按 `(order_option_definition_ref, code)` 唯一。`data_node_ref` / `brand_ref` 两列**保留**
—— 复合外键 `(order_option_definition_ref, data_node_ref, brand_ref)` 仍在用。
子表**不加 `status`**:父作废后子行随父不可见,父级唯一天然不跨组撞车,无须生命周期。

**推论 · 范围只此一张表,已亲验。** `catalog_attribute_definition_option` **没有 `code` 列**
(只有 `name` / `display_order`,唯一键 `(attribute_definition_ref, display_order)` 本就是父级),
不是同一形态,不在本裁定范围。改完之后两者形态反而更接近。

**影响面**:选 A 零改动,只需在交付文档里如实写明边界;选 B 增加一张表的三态改造;
选 C 是一条唯一键变更 + 你此前裁定的修订。

---

### 另两项保持开放(不在本批固化)

collaboration binding 在哪些场景构成阻断;菜单发布能力建成时需要哪些维度处于可用状态。
二者**不得在本批固化成字段、枚举、DB 约束或 UI 禁用规则** —— 现在固化等于用实现替你做产品裁决。

## 4 · 授权边界

本文是合并意见,合并后的唯一实施底稿是 Codex 稿并入本文六条修订后的版本。
**本文不授权任何实施、DEV、数据操作或部署。** 三项已裁,operation delta 可冻结为**净 −1**。
A-2 的判据未落成 BUSINESS 断言前,CP-B6「后端独立 closure」不成立。
