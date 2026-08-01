---
title: 扩展字段与角色授权:对齐 v2 的存储与语义设计(Claude 代 Dexter 决策)
type: review
subtype: design-directive
status: DELIVERED_FOR_CODEX_EXECUTION
reviewer: Claude
decisionBasis: |
  Dexter 2026-07-26：「扩展字段你看下 v2 的做法，我希望跟 v2 是一模一样的」
  「包括角色的能力和页面准入，也希望是一模一样的，简单存储 json 就好了」
  「代码治理要严谨，但是业务设计不能过度」「你替我做所有决策，要求是最优最长期的方案」
createdAt: 2026-07-26
authorizationBoundary: 在既有 R5_IMPLEMENTATION_AUTHORIZED=true 内；不授权 DEV/seed/reset/动态运行；不扩大 R5 业务范围
---

# 扩展字段与角色授权:对齐 v2 的设计

## 0. 一句话

**两处都改成 v2 的 JSON 形态,并把 v2 已经跑通的业务语义原样带过来;v2 自身的缺陷与半成品不带。** 这同时顺手关闭了上一份裁定里的 `extension_rule_revision` 缺口——两件事合并成一次改。

## 1. 我核实到的 v2 真实做法(不是概述,是建表语句)

### 1.1 扩展字段定义 = 一行一宿主,字段集合整包 JSONB

`catering-all-v2/apps/backend/extension-service/src/main/resources/db/migration/V1__extension_definitions.sql`:

```sql
CREATE TABLE extension_definition (
    workspace_key VARCHAR(64) NOT NULL,
    entity_type   VARCHAR(64) NOT NULL,
    definitions   JSONB NOT NULL,      -- 整个字段定义数组
    revision      BIGINT NOT NULL,
    updated_at    BIGINT NOT NULL,
    PRIMARY KEY (workspace_key, entity_type)
);
```

**v2 从来没有把字段定义拆成一行一字段。** `revision` 整行一个,首版固定 = 1,每次成功替换 +1,整集合 CAS(`ExtensionDefinitionRepository.java:22-46`)。

### 1.2 扩展值 = 宿主表上的两列

五张宿主表各加两列,形状逐字一致(`organization/V9__business_entity_extension_values.sql`、`V6__store_extension_values.sql`、`contract/V2__contract_extension_values.sql`):

```sql
ADD COLUMN extension_values JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN extension_rule_revision BIGINT NOT NULL DEFAULT 0,
ADD CONSTRAINT <t>_extension_values_object CHECK (jsonb_typeof(extension_values) = 'object'),
ADD CONSTRAINT <t>_extension_rule_revision_non_negative CHECK (extension_rule_revision >= 0);
```

### 1.3 角色能力与页面准入 = 角色表上的 JSONB 数组

`catering-all-v2/apps/backend/workspace-iam-service/.../V1__workspace_roles.sql`:`capability_keys jsonb not null` + `CHECK (jsonb_typeof(capability_keys) = 'array')`。**不是关联表。**

### 1.4 v2s 现状(即要改掉的)

| 面 | v2 | v2s 现状 | 判定 |
|---|---|---|---|
| 定义 | 1 表,definitions JSONB | `extension_definition` + `extension_definition_field`(一行一字段) | 过度 |
| 值 | 宿主表 2 列 | 5 张 `*_extension_value` 表(一行一字段),宿主表**无** `extension_rule_revision` | 过度 + 有缺口 |
| 角色 | 角色表 2 个 JSONB 列 | `role_capability` + `role_page_access` 两张关联表 | 过度 |

## 2. 已决事项

### D-E1 定义与值全部改为 v2 的 JSON 形态

- `extension.extension_definition` 重建为:`(group_workspace_key, entity_type, definitions JSONB, revision BIGINT, updated_at_epoch_millis BIGINT)`,PK `(group_workspace_key, entity_type)`。**删除 `extension.extension_definition_field`**。
- 五张宿主表(`organization.brand/tenant/head_company/store`、`contract.store_contract`)各加 `extension_values JSONB NOT NULL DEFAULT '{}'::jsonb` + `extension_rule_revision BIGINT NOT NULL DEFAULT 0`,并加 v2 同款两条具名 CHECK。**删除 5 张 `*_extension_value` 表**。
- 这一条**吸收并取代**上一份裁定里"给五张表补 `extension_rule_revision`"的动作——不要做两遍。

### D-E2 宿主闭集保持 5 类,并修掉已物化契约里的 8

**决定:`BRAND / TENANT / HEAD_COMPANY / STORE / CONTRACT`,五类。**

理由是硬事实,不是保守:v2 的契约 enum 确实是 8 类,但 **organization migration 停在 V9,规格要求的 V20 根本不存在**——`COMMERCIAL_GROUP / REGION / PROJECT` 在 v2 里**定义存得进去、值无处可放**,是半成品。v2s 主设计 §170 定的五类,恰好等于 v2 真正跑通的那一份。

**须修**:`contracts/openapi/components/extension/extension.schemas.yaml` 的 `ExtensionEntityType` 现为 8 值,是 U01 物化时从 heritage 基线回流带回来的,与主设计 §170 冲突。收窄为 5 值。

### D-E3 字段定义形状与校验:照抄 v2

字段对象(`additionalProperties: false`):

| 字段 | 约束 |
|---|---|
| `key` | 必填,1-80,`^[a-z][a-zA-Z0-9_]*$` |
| `label` | 必填,1-120 |
| `type` | 必填,闭集 `TEXT / NUMBER / DATE / BOOLEAN / SELECT` |
| `required` | 必填 boolean |
| `options` | 必填数组(非 SELECT 传 `[]`),每项 ≤120 |
| `status` | 可选,`ENABLED / DISABLED`,缺省 `ENABLED` |
| `displayOrder` | 可选,≥0,缺省取下标 |
| `displaySuffix` | 可选,1-20(单位后缀,如 `㎡`) |

服务端校验(v2 `ExtensionDefinitionService.java:115-190` 原样):字段不完整 → 400「字段配置不完整」;`key` 重复 → 「字段编号不能重复」;`displayOrder` 负数或重复 → 「字段顺序必须唯一」;SELECT 无 options → 「单选字段必须提供选项」;非 SELECT 带 options → 「只有单选字段可以配置选项」;选项空白或重复 → 对应报错;**同 key 变更 type → 400「已配置字段不能直接变更类型」**;不支持的 entityType → 400。写入前按 `displayOrder` 排序整集合落库。

**不引入 v2 没有的东西**:没有 NUMBER 的 min/max/精度、没有 TEXT 长度/正则、没有 DATE 区间、没有表达式/规则引擎/跨字段联动。v2 规格明令禁止这些(`spec:47`、`d01-s07p:121`)。

### D-E4 值的写入语义:`preserveUnknown + replaceKnown`(v2 最硬的不变量)

这是 v2 全套设计里重复次数最多的一条,必须原样实现:

1. 提交时带 `expectedExtensionRuleRevision`(来源是**定义查询的 readback revision**,不是实体自己的 `extensionRuleRevision`);与当前定义 revision 不等 → **409**,文案「经营资料规则已变化,请刷新后重试」,不做自动迁移。
2. 通过后做**宽容合并**:只遍历当前定义声明的 key,`submitted` 含该 key 才覆盖,值为 `null` 则删除该 key;**当前定义未声明的历史 key 原样保留在 JSONB 里,绝不静默删除**。
3. 值类型守卫:`TEXT`=String;`NUMBER`=Number;`DATE`=String 且匹配 `\d{4}-\d{2}-\d{2}`;`BOOLEAN`=Boolean;`SELECT`=String 且 ∈ options。未声明的 key → 400;required 字段缺失或为 null → 400。
4. `submitted == null && expected == null` → 原样保留旧值旧 revision(部分更新豁免)。
5. 读取时按**当前**定义解析:可解析的正常展示;定义新增而实体无值 → 空;已删除/未知/类型不兼容的旧值 → **不展示、不报错、不阻断整页**,保存时仍保留。

### D-E5 三处 v2 从未裁决的空白,我在此裁定

v2 规格留了三个真空,不能"照抄"。按简单优先:

| 空白 | 我的裁定 | 理由 |
|---|---|---|
| type 兼容规则的具体内容 | **同 key 一律不允许改 type**(v2 代码即如此)。要换类型 = 删旧 key + 建新 key,旧值自动变成"未知值"被保留 | 最简单、无歧义、零迁移;任何"部分兼容"表都会引入需要长期维护的矩阵 |
| 新增必填字段后,老记录怎么办 | **只读详情永不阻断;编辑时按当前定义校验必填**(= v2 代码行为)。不做宽限路径、不做脏数据标记 | required 的语义就是编辑时必须有值;宽限路径要引入"部分合规"状态,是过度设计 |
| 改 key | **不提供改 key 操作**;语义上等价于删+建。平台端删除字段时须提示"历史值不会被删除,但将不再显示" | 与 D-E4 的未知值保留一致;v2 规格要求过这个提示(`d01-s07p:140,178`)但没实现,我们补上 |

### D-E6 v2 的这些缺陷**不带过来**

| v2 缺陷 | v2s 做法 |
|---|---|
| 8 类宿主但只有 5 类有值存储 | 只留 5 类(D-E2) |
| gateway 给业务实体返回的是 `COMMERCIAL_GROUP` 的定义,而 owner 按 `BRAND/TENANT/HEAD_COMPANY` 校验(`PlatformGatewayBusinessEntityService.java:60` vs `BusinessEntityCommandService.java:68/80/92`)——前端拿错 revision 去提交 | 三类实体各读各自 entityType 的定义,不共用 |
| 门店写模型字段名 `extensionRuleRevision` 与另两类的 `expectedExtensionRuleRevision` 不一致;门店有专属冲突码而另两类复用 `EXTENSION_DEFINITION_INVALID`(400 的码配 409 的状态) | 五类宿主**统一**用 `expectedExtensionRuleRevision`;冲突统一用一个 409 语义的具名码 |
| `status=DISABLED` 的字段在值校验里完全不参与——禁用字段照样按 required 强制 | 停用字段:不渲染、不校验 required、历史值保留 |
| `displaySuffix` 被运营端消费,平台端却没有编辑入口 | 平台端字段编辑表格补该列 |
| 规格要求的"删除字段提示历史值不被静默删除"从未实现 | 按 D-E5 实现该提示 |
| 保存成功弹窗的文案变量赋了值但从未渲染 | 正常渲染 |
| `extension_definition_audit` 只写不读、无主键无索引 | **不新建审计快照表**;变更记进 v2s 已有的 `extension.extension_audit` 即可 |

### D-E7 不搬 v2 的投影/MQ 机制(红线,且是最大的一次简化)

v2 为了跨服务读定义,建了整套 outbox + RocketMQ + 投影表 + receipt + gap 检测 + repair 反向通道(两个 owner 各一份,约占 v2 扩展能力复杂度的六成)。**v2s 是单 deployable,owner library 之间直接在同一进程内调用即可**,这套东西全部不要——这本来就是 v2s 已冻结的红线(无 MQ/outbox/投影)。

因此 v2s 的形态是:`extension` owner library 提供 `requireDefinition(workspaceUuid, groupWorkspaceKey, entityType)`,organization/contract owner 在**同一事务内**直接调用它读当前定义,再做 D-E4 的校验与合并。没有投影、没有 stale/gap、没有 503 依赖不可用分支。

### D-E8 角色能力与页面准入改为 JSONB 两列

**这不是"我觉得 JSON 更好",而是 v2 自己已经走过的路。** v2 早期确实用过关联表 `workspace_page_grant`,后来在 `V27__workspace_role_page_access_keys.sql` 里**加 JSONB 列并 `DROP TABLE IF EXISTS workspace_page_grant`**,V28 再删 `workspace_page_access_revision`。v2s 现在建的两张关联表,正是 v2 已经废弃迁走的形态。v2 还为此留了裁决 `doc/decisions/2026-07-22-role-page-and-action-keys-share-role-json.md`,原文:

> 数据库不得保存页面定义或动作定义,只保存角色被授予的稳定 key。每个 `workspace_role` 聚合保存两个互相独立的 JSON/JSONB Array 字段……两个字段不得互相推导、合并、覆盖或使用同一数组。

且 §4 明令物理退出关联表时「不得保留双写、双读、兼容 fallback 或由 page grant 反向生成 `pageAccessKeys`」。

**落地**:

1. `workspace_iam.workspace_role` 加 `capability_keys JSONB NOT NULL DEFAULT '[]'::jsonb`、`page_access_keys JSONB NOT NULL DEFAULT '[]'::jsonb`,各加具名 `CHECK (jsonb_typeof(...) = 'array')`。**删除 `role_capability` 与 `role_page_access` 两张表**(按 §3 的 precondition 流程)。**DB 只保证是数组**,元素合法性一律在应用层——与 v2 一致。
2. 写入:两列在**同一条 UPDATE** 里整组替换,`revision=revision+1` 且 `where ... and revision=?` 做 CAS。
3. 读页面准入时用 `jsonb_array_elements_text` 横向展开,不建索引表。
4. 契约**不改**:`WorkspaceRole` 已是两个数组,`WorkspaceRoleAuthorizationReplaceRequest` 已是全量原子替换 + `expectedVersion`(D-08)。

**校验(照 v2)**:capability 必须适配角色的 service node type(v2 用 catalog 的 `grantableRoleNodeTypes`);page key 必须在 catalog 内、必须是 `pageAccessManaged=true`(五个首页 `HOME-*` 固有可见、**不可授予**)、且适配 service node type。错误码沿用 v2 语义:能力不适配 → 400;页面不适配/不在目录/是首页 → 400;readback 时发现存量 key 已退役 → 409「当前运营角色的动作配置需要重新设置」。**不做"调用者只能授予自己拥有的能力"这类上限校验**——角色 CRUD 是平台侧专属,v2 也没有。

**闭集唯一真相**:v2 是 `contracts/catalog/admin-catalog.yaml` 经 codegen 落成后端 Java catalog + 前端 TS catalog + OpenAPI enum(capability 是真 enum 34 个;page key 只是 `maxLength 80` 的 string,靠服务端查目录)。v2s 已有等价物(manifest 的 `actionCapabilityCatalog.activeKeys` 恰为 34,pageDesignKey 25),沿用即可,**不要在 DB 里存目录**。

**读取语义"求同存异"**(与 D-E4 的未知值保留同源):已删除、退役、未知、类型不适配的 key **不产生授权,但也不清洗历史 JSON**,不把未知 key 当兼容输入回写。

**两组 key 互不推导**必须保持:页面准入决定能否进页面,动作能力决定按钮能否执行;不得由页面准入推出动作,也不得由动作反推菜单。v2 在代码里留了显式注释守这条,v2s 照做。

**无内置角色、无 seed 角色**——v2 明确"不是系统自动创建的默认角色",平台运维手工建。

**UI(照 v2)**:两棵**并排、各自独立**的可勾选树,左「页面准入」(按菜单分组)、右「可执行动作」(按动作组分组);未选组织类型时两者都提示「请先选择组织类型。」。**目录节点只作展示,绝不落库——只持久化叶子 key**(v2 在代码里专门注释了这一点,是容易踩的坑)。两份候选目录由列表接口随响应下发(`capabilityCatalog` / `pageAccessCatalog`),**不是前端常量**。组织类型创建后不可改;若改则自动剪掉不再适用的已选项。

### D-E9 用户可见语义:运营端不得出现"扩展字段"

v2 的 L2 用例**明确断言**页面上不能出现"扩展信息/自定义字段"字样。v2s 照此:

- 运营端这些字段以 **「经营资料」** 分组出现在实体详情与表单里,与固定字段同样的标签、顺序、控件;**不显示** definition key、revision 或任何技术来源。
- 平台端才叫"扩展字段配置",入口在平台后台。
- **不新增第二套权限**:值的读写完全继承宿主实体原有能力(如门店由 `BC-ORG-STORE-EDIT` 控制);定义维护是平台侧能力。
- 控件映射:`NUMBER` → 数字输入 + `displaySuffix` 后缀;`DATE` → 日期选择器(`YYYY-MM-DD`);`BOOLEAN` → 开关;`SELECT` → 单选下拉;`TEXT` 及兜底 → 文本框。展示侧做类型守卫,不匹配渲染 `—`。

## 2.5 与 Codex 已执行部分的衔接(2026-07-26 16:03 状态实测)

Codex 已按上一份 persistence-conflict 裁定动手。我逐项核对了当前字节:

**已完成、且与本设计完全兼容——保留,不要返工:**

| 已做 | 位置 |
|---|---|
| 五表加 `alias/remark/notes/extension_rule_revision` | `V20260726_150000_000__organization_and_contract_persistence_correction.sql` |
| typed precondition `DO $$` 块,逐条具名错误码 + 列出违规行 id | 同上(**正是 S-2 要求的形态,做得对**) |
| tenant/head_company 的 `legal_name` NOT NULL、`credit_code` 收窄 32 + NOT NULL + 非空白 CHECK + 每表各自 UNIQUE | 同上 |
| `externalCode` / `legalExternalCode` 已从契约删除(实测命中 0) | `business-entity.schemas.yaml` |
| `StoreContract` 三处重复 `required` 已去重 | `contract.schemas.yaml` |

**冲突点——必须在这里停下,不要继续按旧指令接线:**

旧裁定 §3 第 2 点写的是「command……与 owner 表和 **extension values** 在同一 `REQUIRED` 事务内写入」。当时的隐含前提是**扩展值仍存在 5 张 `*_extension_value` 表里**。本设计把存储形态换成了宿主表上的 `extension_values JSONB`(D-E1),所以:

- **不要**把 owner command/readback 接到 `organization.brand_extension_value` 等 5 张表上——那部分代码写了就是废的;
- **不要**继续用 `extension.extension_definition_field` 读写字段定义;
- 角色侧同理:**不要**把 `WorkspaceRoleService` 接到 `role_capability` / `role_page_access` 两张关联表上。

**尚未做、按本设计执行的:**

1. 五张宿主表加 `extension_values JSONB NOT NULL DEFAULT '{}'::jsonb` + 具名 `CHECK (jsonb_typeof(extension_values) = 'object')`;
2. 删 5 张 `*_extension_value` 表、删 `extension.extension_definition_field`、删 `role_capability` 与 `role_page_access`(按 §3 的 precondition 流程);
3. `extension.extension_definition` 重建为 definitions JSONB 单行形态;
4. `workspace_role` 加两个 JSONB 数组列;
5. `ExtensionEntityType` 由 8 值收窄为 5 值(D-E2)。

**一处小修**:已写的 `CHECK (extension_rule_revision >= 0)` 是**匿名内联约束**,而 v2s 蓝图 §2.3 要求"FK/unique/Check 全部具名",v2 那边也是具名的(`business_brand_extension_rule_revision_non_negative`)。新增的这些 CHECK 请一并补名字。

## 3. 迁移方式(重要:这不是纯 additive,我显式授权)

要删的表:`extension.extension_definition_field`、5 张 `*_extension_value`、`workspace_iam.role_capability`、`workspace_iam.role_page_access`。

**这不是 additive,我不粉饰。** 授权依据:R5 尚未 seed、这些表零业务数据、DEV 未连远端;而保留一组永不写入的空表会长期误导每一个后来的 agent 和评审。**早期删除成本最低**,这正是 Dexter 的判准。

执行方式(必须):新增**一条**能力命名的 migration,不改写任何已执行 migration 字节;每张待删表**先跑显式 precondition 断言行数为 0**,非 0 即以具名错误停止(不得静默 DROP);断言全绿后再 `DROP TABLE`。同一条 migration 内完成加列与建约束。

## 4. 交付判定

1. 五类宿主闭集在契约、Java enum、UI 三处一致,`COMMERCIAL_GROUP/REGION/PROJECT` 零出现。
2. `extension.extension_definition` 一行一宿主;`extension_definition_field` 与 5 张 `*_extension_value` 表不存在。
3. 五张宿主表各有 `extension_values` + `extension_rule_revision` 两列与两条具名 CHECK。
4. `workspace_role` 两个 JSONB 列存在,两张 role 关联表不存在。
5. focused test 覆盖 D-E4 的五条语义,其中**"未知/已删除字段的历史值在一次正常编辑保存后仍然存在"必须有独立断言**——这是 v2 全套设计里最硬的不变量,也是最容易被实现顺手丢掉的。角色侧的同源语义(退役 key 不产生授权但不清洗 JSON)同样要一条断言。
6. 一条断言证明运营端页面不出现"扩展字段/自定义字段"字样。
7. 规则冲突路径:五类宿主统一 409 + 同一具名错误码,文案一致。
8. 角色侧:①两棵树只持久化叶子 key(目录节点不落库)有断言;②`HOME-*` 五个首页不可被授予有负例;③capability/page 与 service node type 不适配各有负例;④两组 key 互不推导有断言(改页面准入不改动作能力,反之亦然)。
9. 分母不变:104 operation / 32 scenario / 22 surface / 25 pageDesignKey / 7 owner schema、HTTP path、operationId 全部不动;capability 闭集仍为 34。

## 5. 需 Dexter 裁决的

**无。** D-E1~D-E9 已由我代裁。唯一可回退点是 D-E2(若你确实想要 v2 契约上那 8 类宿主,而不是它真正跑通的 5 类,告诉我,那要额外给商业集团与组织节点建值存储——但那是 v2 自己都没做完的部分)。

## 6. 授权边界

在既有 `R5_IMPLEMENTATION_AUTHORIZED=true` 内执行,并入 Phase B/C 一并交付,不单独送审。不授权 DEV、seed/reset、动态运行,不扩大 R5 业务范围。R5 仍只在全范围完成后由唯一一次 whole-scope implementation review 验收。
