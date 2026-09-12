# 后台编码规范 · 唯一权威

> **这是后台编码规范的唯一内容源。** 其他地方(项目记忆、skill、评审文档)**只放指针,不复述内容** ——
> 同一条规则写两处必然漂移。
>
> **规则只有一种写法:自带反例的禁止句。** 不写「应当避免过度设计」;
> 写「网络 I/O 不得出现在 `@Transactional` 方法内。**反例:** 方法带 `@Transactional` 且体内有 HTTP 调用」。
> 判断不了对错的句子不进本文。
>
> **上限**:本文超过"半小时读完",或门超过"分钟级",就是在重建刚退役的那套控制面。

---

## 0 · 怎么用这份文件

| | |
|---|---|
| **规则来源** | 2026-08-14 的一轮后台全量评审,33 条实例(M-01~12 / S-01~20 / N-01)归纳成十类 |
| **实例登记册** | `doc/review/platform/2026-08-14-v2s-backend-code-review-findings-claude.md` |
| **分流与批次** | `-backend-findings-triage-and-sequencing-claude.md` · `-part-one-coding-standards-batches-claude.md` · `-part-two-batches-claude.md` |
| **门的清单** | `tools/verify-gates/verify.mjs`(⛔ **门存在 ≠ 门生效**,必须在 command 列表里) |

**既有十九类里有十类能变成门。** 其余九类只能靠 review —— 这不是偷懒,是那九类的判据需要理解上下文,
做成关键词匹配就会变成"门全绿而功能是坏的"。本文后面的 `2.5` 是 2026-09-11 增补的 owner
可读性整改 review 规则,不把上下文判定伪装成新的机器门。

---

## 1 · 能变成门的十类

### 1-C · 契约声明必须传导到生成物

**规则**:契约里声明的类型约束,必须在生成物里表达为对应类型;不得声明了却生成成裸 `string`。

**反例**:OpenAPI 里 `format: uuid` 的字段,在生成的 Java / TS 里是 `String` / `string`。

**为什么**:声明了不传导,等于把类型系统关掉 —— 消费侧只能手搓字符串,编译器一个都拦不住。

**门**:`edge-codegen --check`

### 1-D · 错误不得伪造原因

**规则**:`catch` 之后不得丢弃 cause,也不得把捕获到的异常改写成不相干的原因。

**反例**:`catch (SQLException e) { throw new Problem("VALIDATION_ERROR", "参数不合法"); }` —— cause 丢了,原因也不是真的。

**为什么**:排障时看到的是伪造的原因,真因永远查不到。

**门**:PMD 单规则 `PreserveStackTrace`(⚠️ **只上这一条规则,不上整个 PMD 规则集** —— 规则集要 curate,三万行存量上会产出几百条待分诊)

### 1-H · 分层命名与 split package

**规则**:同一个包名不得跨 Gradle 模块出现。

**反例**:`src/main/java/.../catalog/application/` 与 `modules/catalog/src/main/java/.../catalog/application/` 同名。

**为什么**:split package 在模块化下是未定义行为,且让"这个类在哪个模块"无法从包名判断。

**门**:文件系统级判据(拆完后 `src/main` 与 `modules/*/src/main` 无同名包)

### 1-I · 格式

**规则**:排除生成物后,**>120 字符的行归零**。

**工具**:Spotless + palantir-java-format。

**排除范围**:`app/edge/generated/wire/` 下的签入生成文件、`build/generated/sources/**`。

**门**:`spotlessCheck`

⛔ **格式批必须单独成批,不与任何语义修改混提。** 且**排在所有以 `文件:行号` 为坐标的批次之后** ——
登记册整篇是行号坐标,一次全仓重排会让所有未处置条目的施工图作废。

**验收判据(自带反例)**:

| 判据 | 反例 |
|---|---|
| 格式化前后各编译一次,`javap -c -p` 去掉 `LineNumberTable` 后逐字节相同 | 有差异 → 改到了逻辑 |
| 重新跑一次代码生成后 `spotlessCheck` 仍绿 | 生成后变红 → 生成物没排全 |
| 排除生成物后 >120 字符归零 | 仍有长行 → target 路径没覆盖全 |

---

### 1-J · 引用必须可解析为业务身份

**规则**:task-read 响应中,**已登记为业务实体引用**的 ref 字段,必须能在同一响应体内解析到该实体的**业务身份**。三种满足形式等价:

0. **业务身份由该实体自己决定,不得写死为 `code` + `name`。** 商品标签是 `code` + `name`;**属性选项没有编码概念**,契约 `required` 就是 `["optionRef","name","displayOrder"]`,身份即 `optionRef` + `name`;**运营角色也没有编码**,唯一键是名称。要求一个实体交出它从来没有的字段,只会逼出一次没必要的数据库迁移。

1. **自身份**:ref 与身份字段同在一个对象里 —— `tags: [{tagRef, code, name, status}]`、`options: [{optionRef, name, displayOrder}]`
2. **伴随实体**:`category: {categoryRef, code, name, …}`
3. **兄弟集合**:`productionTagRef` 配同响应体内以 `tagRef` 为键的 `productionTags[]`

**反例**:`categoryRef`(uuid)只配 `categoryPathLabels`(预渲染字符串数组)—— 前端拿到一个用不了的 ref 和一串只能原样打印的标签,想显示分类编码时该字段不在契约里。

**为什么**:引用无法解析到业务身份,前端就只能消费后台预渲染的结果,展示决定因此长进契约。

**必须先有登记,门才成立**:仓内 `format: uuid` 的属性有 837 个,其中作用域坐标(`dataNodeRef`、`brandRef`、`scopeRef`)、请求条件回显(`targetOrganizationRef`)、资产句柄(`assetRef`,资产没有 `code`/`name`)本就不该有业务身份。因此契约里必须显式登记**哪些 ref 是业务实体引用**;不登记就只能"去掉 `Ref` 后缀按名字找兄弟",那正是 1-L 自己禁止的名字猜测。**登记未建立之前,本条只能靠 review,不得接门。**

**门**:`scripts/check/read-model-reference-identity`(**待建**);红夹具 = 把某个已登记 ref 的 `code`/`name` 从响应里摘掉,门必须红

### 1-K · 响应字段的值不得由拼接产生

**规则**:task-read 响应字段的值,不得由拼接从两个以上事实产生。**与语言无关、与分隔符无关、与发生在哪一层无关。**

**三层都算**:Java 的 `+` / `String.join` / `String.format` / `StringBuilder`;**Stream 的 `Collectors.joining` 与 `.reduce((a,b) -> a + sep + b)`**;**SQL 的 `||` / `string_agg` / `concat` / `format`**。静态 enum mapper 不是装配,不要误收。只扫 Java 会漏掉 `commercial_group_name || '（' || commercial_group_code || '）' AS node_display_path` 这种 —— 全角括号的「名称(编码)」,表达细节全在后台。

**三处例外**:时点快照(写入时冻结的值本身是事实,如 `actor_display_snapshot`、合同 `phase_name_snapshot`);**安全与隐私脱敏**(手机号等 PII,完整形态受访问控制,后端必须决定可展示形态,如 `mobile_mask_source`);非人读的复合串(游标、幂等键、SQL 占位符)。错误消息在原则内但当前不在 base-1 范围。

**反例**(三种实测形态,注意第二种不含中文):

- `preparationSummary.add("生产标签：" + productionTagName)`
- `region.code() + " " + region.name() + " / " + target.code() + " " + target.name()` → 落进 `path` 字段
- `String.join("、", optionNames)` → 落进 `attributeSummary`

**为什么**:拼接把多个事实压成一个字符串,前端只能原样打印。表达一变就要改后台,契约、测试、seed 全线跟改。

**判据就是被禁的那件事本身,不是代理。** 早先版本按"CJK 字面量"划范围,那是代理:既漏报(`code + " " + name` 一个中文都没有)又误报(错误消息里的中文与展示无关),还可以靠把中文放进 helper 实参绕过。现按"这个字段的值是不是拼出来的"判定,以上三条同时消失。

**范围判据是"响应字段的值是不是拼出来的",不是"文件里有没有拼接"。** 二者不等价:`CatalogOwnerService` 实测 39 处 `String.join`,其中 31 处是 `String.join(",", Collections.nCopies(n, "?"))` 的 SQL 占位符,按"文件内出现装配"会误报 31 次。

⚠️ **在"响应字段数据流可判"做出来之前,本条只能靠 2-H 的 review,不得按文件清单接门。** 文件清单只是范围登记,不是判据。**新建文件不在清单内不会被拦住** —— 这是本门已知的边界,由 2-H 的 review 覆盖。

**门**:`scripts/check/read-model-assembly`(**待建**);红夹具 = 在清单内文件把某个响应字段改成两个事实拼接,门必须红

### 1-L · 主数据状态词汇恰好三值

**规则**:被显式登记为主数据实体的表,其 `status` CHECK 必须恰好是 `('ENABLED','DISABLED','VOIDED')`。

**反例**:`catalog_item` 的 `DRAFT/ENABLED/DISABLED/ARCHIVED/VOIDED`;`business_channel` 的 `DRAFT/EFFECTIVE/DISABLED`;`unit_definition` 的 `delete` 与 `disable` 并存。

**为什么**:实测全平台曾有六种生命周期形态,维护者要学六套模型,前端要写多套确认流,用户在不同库之间看到不同行为。

**完备性靠反向判据,不靠正向清单**:只说"登记表必须三值",新建一张带 `status` 的表不登记就照样全绿——那是存在性判据。判据必须反过来写:

> **任何带 `status` 列的表,不在主数据清单里就必须在豁免清单里并带理由,否则门红。**

分母可查:`db/migration` 下 105 个 `CREATE TABLE`,建表体内带 `status` 的 20 张,另有 ALTER 追加的(brand、head_company、organization_node、store、tenant 等)。

**门**:`scripts/check/lifecycle-vocabulary`(**待建**);红夹具 = 新建一张带 `status` 且两处清单都不登记的表,门必须红

### 1-M · 作废后业务唯一键必须可复用

**规则**:每张登记的主数据表,其**业务唯一键**约束必须是排除 `VOIDED` 的 partial index。

**唯一键不一定叫 `code`。** 实测仓内至少四种:`(data_node_ref, brand_ref, code)`、`(data_node_ref, brand_ref, dictionary_kind, code)`、`(item_ref, sku_code)`、以及**按名称唯一**的 `uq_workspace_role_name`(`workspace_iam.workspace_role` 无 `code` 列);`workspace_iam.workspace_account` 的唯一键是登录名与手机号。登记项必须写明该表的 scope 列与唯一键列。

**已登记例外 · `workspace_iam.workspace_account`(Dexter 2026-08-27 裁定 D02=B)。**
该表的登录名与手机号**保持普通 `UNIQUE`,不改 partial**;账号一旦 `VOIDED`,该手机号/登录名**永久不可再用**。
理由:**身份键不是业务编码。** 分类编码、单位编码是业务自己选的标签,选错要能重来;手机号标识的是一个自然人,
复用会让"这个号以前是谁"变得不可判定。本条规则的目的是"别让看不见的行占住用户能选的标签",对身份键不成立。
**推论(必须一致,否则库与应用打架)**:既然应用层永久拒绝,DB 就不能允许 —— 若把索引改成 partial,
DB 会放行第二行而应用永远拒绝,predicate 变成死代码。`workspace_iam.workspace_role` 不在此例外内:
角色名是业务标签,照常改 partial。

**反例**:表级普通 `UNIQUE (data_node_ref, brand_ref, code)`——用户建错一个定义再删除,就再也不能用同一编码重建,而且撞的是一个他看不见的已删除行。

**为什么**:取消物理删除后,已删除行仍在表内;不排除它,编码就被永久占住。


**不适用情形必须登记而不是硬套**:没有 `code` 列的表(如 `catalog.catalog_composite_component`,列为 `composite_component_ref / composite_group_ref / component_item_ref / …`,唯一约束是 `(composite_group_ref, display_order)`)在物理上无法满足本条。这类表通常根本不是主数据 —— 组件行是"整组删掉重插表达一次编辑",按 1-L 的可证伪判据(能不能由人手动在两个状态间来回切)就不该进主数据清单。**先按判据分类,再套约束;分类错了不要靠豁免打补丁。**

**门**:`scripts/check/lifecycle-vocabulary`(**待建**);仓内已验证形态见 `V20260816_030000_000__catalog_dictionary_tag_voided_code_release.sql` 与 `V20260816_020000_000__catalog_sku_voided_code_release.sql`

### 1-N · 校验只针对本次变更的引用

**规则**:保存时只对**本次新增或改变**的引用做"必须启用"校验;未变更的既有引用一律放行。

**反例**:保存商品时对全部引用一律要求 `ENABLED`——则任何引用了已停用/已删除定义的商品都会变成不可保存,用户连改个名字都做不到。

**为什么**:停用与删除的业务含义是"不能再被**新**选中",不是"引用过它的东西全部冻结"。

**门**:`backend-acceptance` 真实场景——把被引用的定义置停用后保存引用它的对象(不改该引用)必须成功;把该引用改成另一个停用的必须被拒。这是本组规则里唯一验证真实行为的门

### 1-O · 代码定义的闭集必须在契约里声明为 enum

**规则**:响应字段的值若来自代码定义的闭集(Java enum、固定常量集、DB CHECK 约束枚举),契约里**必须**声明为 `enum`;不得只在请求侧声明、响应侧留裸 `string`。业务自定义的值(用户自己填的编码、名称)不属于闭集,不得强上 enum。

**反例**(实测,同一个概念在同一份契约里两种形态):

```
enum         BusinessChannelTemplateCreateRequest/properties/operatorKind
type=string  BusinessChannelTemplateView/properties/operatorKind
```

`accessKind`、`dineInForm`、`orderKind`、`ownerNodeType` 同型。全域扫描:22 组同名属性一处 enum、一处裸 string(**含假阳性,见下**)。

**为什么**:响应不声明值域,前端就拿不到联合类型,只能对一个 `string` 建字典——后端新增一个枚举值,前端默默显示成裸英文码,编译器一个都拦不住。**这正是 `*DisplayName` 这批字段当初被造出来的原因**:后端手里有闭集、不结构化地给出来,只好改送一个预渲染的中文字符串。1-K 禁的是拼装,本条堵的是拼装的**成因**——两条不接上,删掉的 DisplayName 会再长回来。

**⚠️ 判据是概念,不是属性名。** 按名字匹配必然误判,实测三种形态:

- **同名不同概念**:`TypedProblem.code` 是 47 值错误码 enum,`CatalogItem.code` 是用户自填的业务编码——后者**不是**闭集,不得因前者而被要求 enum
- **同名不同值集**:`CatalogItemDetail` 内 `ownerType` 同时存在 `['CATALOG_ITEM','SKU']` 与 `['ITEM','SKU','OPTION_VALUE']` 两份
- **同概念不同值集**:`CatalogDictionaryQuery.status` 是三值 `('ENABLED','DISABLED','VOIDED')`,而 `CatalogItemDetail.status` / `CatalogUnitList.status` 是两值 `('ENABLED','DISABLED')`——与 1-L 直接冲突,响应侧补 enum 时必须同步取齐三值,否则 owner 会返回一个不在自己 enum 里的值

**完备性靠反向判据**:只说"这几个字段要补 enum"是存在性判据,新写一个裸 `string` 的闭集字段照样全绿。判据反过来写:

> **响应字段的值若由 Java enum 或固定常量集产生,契约声明不是 `enum` 就必须登记豁免并带理由,否则门红。**

**门**:`scripts/check/closed-set-enum-declared`(**待建**);红夹具 = 把任一已声明 enum 的响应字段改回裸 `string`,门必须红

## 2 · 只能靠 review 的九类

### 2-A · 同类路径一致性

**规则**:一组承担同一职责的路径,其**安全与并发处理必须一致**。

**反例**:六个同族端点,其中三个不传 scope;同一张表的多条 UPDATE 路径,只有一条加锁。

**为什么**:不一致的那一条就是漏洞入口,而且因为"其他几条是对的"而极难被发现。

**实例**:M-11 根因 · S-19 · M-09

### 2-B · 失败必须可见

**规则**:任何"**什么都没做**"的路径不得返回成功。

**反例**:超过上限静默截断第 5001 项后返回 200;复制九个 section 里七个是空操作,却报 `skipped` 为空;
告警条件写了但永久静默。

**为什么**:用户以为做了,实际没做,而且没有任何信号。这类缺陷不会被任何门抓到。

**实例**:M-04 静默截断 · M-09 静默空操作 · S-11b 空操作报成功 · S-03 告警永久静默

### 2-C · 事务边界

**规则**:**网络 I/O 不得出现在 `@Transactional` 方法内。**

**反例**:方法带 `@Transactional`,体内有 HTTP 调用或跨服务 owner 调用。

⚠️ **ArchUnit 抓不到**:根因是写路径跨四层各带 `@Transactional`,**任何单一位置都看不出网络 I/O 落在事务里** ——
必须顺着调用链读。

**实例**:M-01

### 2-D · 该用生成物却手搓字符串

**规则**:凡生成物已提供类型的地方,不得手写字符串字面量。

**反例**:生成物已有 `operationId` 常量,消费侧仍写 `"getOperationsCatalogItem"` 字符串。

**关系**:这一类**依赖 1-C** —— 先修 generator 让类型传导,119 个手写点会自己变红。**顺序不能倒。**

**实例**:M-08 消费侧

### 2-E · 不重复造轮子

**规则**:同一职责的工具代码不得多份并存。

**✅ 2026-08-16 更正 —— 原文写反了,且错误地署了 Dexter 的名。**

原文是「只接受工具类合并,不接受为消除少量重复而造抽象」,并标注「Dexter 已裁」。
**Dexter 的实际立场恰恰相反**:「该抽象到 foundation 的需要抽象,现在这个阶段不抽象,
后面走的会更乱」「我一直一直很反对重复造轮子,有的造的一样有的造的还有缺陷」。
那句「Dexter 已裁」是我把自己的判断署了他的名,**已撤回**。

**现行规则**:横切关注点(幂等回执、锁助手、事务样板)**必须统一提供,不得各 owner 自实现**。

**反例(实测,不是假设)**:
- 8 个 `*CommandReceiptService`,918 行,**约 95% 逐字相同**
- 11 张回执表用了 **6 种 scope-key 约定**
- 并发语义三家不同:catalog 的回执写入带 `ON CONFLICT ... DO NOTHING`,
  inventory 与 production **没有** ⇒ 两个请求同时首次使用同一幂等键时,
  catalog 正确重放,另两家抛 `DuplicateKeyException` 且无 advice 处理 → **用户拿到 500**
- 三个跨 owner 锁常量在 catalog 与 inventory 手工复制,源码注释写着
  「Must stay byte-for-byte compatible」—— **唯一强制力就是这句注释**,全仓零门

**根因不是纪律,是位置**:`modules/foundation` **没有 JDBC 依赖**,回执与锁助手无处安放。
一个尽职的工程师在这个约束下唯一能做的就是复制。**先给 foundation 加 JDBC 依赖,
再谈"不要重复"才有意义。**

⚠️ **仍然不该合并的**:形似而语义不同的。反面对照:六个 `CreateOperationsOrganization*`
组内差异 12–36 行 / 共 20–39 行 —— 那是**六件不同的事**,不是一件事的六份拷贝。
判别口径:**逐字节相同或近乎相同 ⇒ 抽;语义不同只是形似 ⇒ 不抽。**

**实例**:S-07 · S-08 · S-09 · S-10 · S-17
⚠️ S-10 切换会改已落库回执的物理格式,**需单独裁定**。

### 2-F · 过度设计

**规则**:新增抽象若只有单一实现,须书面说明理由;死代码按**可达性**删,不按命名启发式删。

**反例**:按名字配对删除"看起来是旧版"的方法 —— 已被证伪的实例:`stageAsset` 与 `stageWorkspaceAsset` **两个都是死的**。

**为什么**:按命名猜会删错;而"新增抽象"这条不适用于 `api` 包 ——
实测 38 个顶层接口 33 个在 `api` 包,**那正是跨模块唯一合法的耦合点**,不是过度设计。

**实例**:S-06(是删除不是重构)· S-04 · S-05

### 2-G · 浏览器 URL 不构成 API owner 授权

**规则**:API 资源路径可以携带 `projectRef`、`storeRef` 等 owner ref 来选择业务聚合，
但 edge 必须从已认证会话解析允许的数据节点，并在每个读写入口复核 path/body 中的 owner ref。
浏览器页面 URL 只定位工作空间与页面，不能成为服务端授权输入，也不能因为前端已校验而省略 edge 复核。

**反例**:项目/门店经营渠道页把节点 UUID 放进浏览器 URL；若 controller 只调用
`requireWorkspaceRead` 后直接执行 `/projects/{projectRef}/business-channels` 或
`/stores/{storeRef}/business-channels`，用户改 URL 即可把另一节点 ref 传入查询，形成跨节点读取入口。

**最小解**:保留 API 的资源路径和生成契约；在 controller 统一走
`resolveSelectedProjectScope`、`requireScopedStore`、owner aggregate readback 等服务端复核，
并为项目列表、门店列表、渠道详情、绑定详情分别保留跨节点拒绝测试。前端稳定路由修复不能替代后端授权。

**反例边界**:这条不要求把 API 的 owner ref 从契约中删除，也不要求把所有资源 URL 改成无 ID 的形式；
它只禁止把 browser URL、query context 或 body 的客户端 ref 直接当作授权结论。读取真实 owner 事实后再把其 ref
交给 capability/grant 或 owner command，是可接受的实现。

---

### 2-H · owner 暴露业务模型,不暴露视图模型

**规则**:owner 的 task-read 返回该实体的业务结构本身,含相关联的结构化实体;返回内容不由任何调用方要显示什么决定。为某一屏新增读接口或新增字段,默认是设计错误。

**判据(能算 / 不能算)**:前端拿到完整模型后自己能算出来的,后台不许算;必须依赖模型之外的数据才能算的,后台必须算,并以结构化事实返回(枚举码 + 结构,不是句子)。

- 「各规格制作内容不同」→ 各规格 profile 都在返回里 → 前端算 → 后台删掉
- `deletionAvailability` → 依赖全局引用计数 → 后台算,但形状是 `{blocked, reason, count}` 而非句子

**边界**:裁剪的正确对象是**无界集合**(流水、日志、可无限递归的关系、被显式裁定的懒加载子集合),不是**字段**。集合分页是集合语义,不算裁剪。

**为什么只能靠 review**:1-J 与 1-K 只能抓住机械形态;"这个读模型是不是某一屏的取景框"是语义判断,仓规明定业务语义不得做成 checker。

### 2-I · 决定授权的维度留在接口身份里,只决定展示的维度进数据

**规则**:一个维度该不该出现在接口身份里,取决于它决定什么。

**可证伪判据**:对任一接口问「去掉这个维度后,授权判定会不会变得依赖请求体?」答**会** ⇒ 必须保留分立接口;答**不会** ⇒ 应当合并。

**正例(必须保留分立)**:IAM 的五个节点类型决定谁能执行,被 `noClientDerivedAuthorization: true` 与 `serverDerivedTarget: "STATIC_OPERATION_CAPABILITY"` 显式治理。合并成一个带 `targetType` 请求字段的接口,等于让目标由客户端提交决定。

**反例(必须进数据)**:catalog 的分类路径标签只决定怎么显示。

⛔ **接口形状的相似性不能作为合并依据。** "这个维度决定什么"只能从业务语料库与已批准裁决中读出,不能从代码形状反推。

## 2.5 · 2026-09-11 后台 owner 可读性整改补充规则(只能靠 review)

本节只适用于**不改变业务语义**的 owner service 内部职责重构。它不授权全量 SQL 迁移、契约或 generated
变更、数据库变更、前端变更、既有测试文件切分、新框架或通用基类；也不接入 `scripts/verify`。成员数量、
文件名、SQL 行数和 token 命中只能是当前事实证据,不能替代下面需要理解业务调用链的判定。

### `R-READ-01` · 拆分轴必须是业务事实职责

**规则**:owner service 的拆分轴必须同时落在同一命令事实、同一 CAS/锁目标和同一 owner 权威 readback 上;
候选范围内的 service/coordinator 必须逐个分类并写出纳入或排除理由,不得按规模数字决定边界。

**反例**:因为一个类行数较小、public 方法较少或 SQL 较少就排除,或因为方法名相近就合并两个实际写入不同
事实、使用不同锁/CAS 或由不同 readback 关闭的事务族。

**为什么**:数字会随源码演进漂移,而职责不一致才是接手者无法定位变更影响的根因。

### `R-READ-02` · facade 只保留稳定解析边界

**规则**:职责重构必须保留既有 owner API、公开类型的 FQCN、公开嵌套异常/record、静态兼容校验入口和已存在的
直接构造边界;原 facade 只转发,具体 owner bean 才持有业务事实、事务、校验和 readback。

**反例**:为获得“更干净”的文件结构删除 facade 并让所有 controller、其他 owner、advice 和测试改注入新类,
或在 facade 与 target 各保留一份业务实现,再用 `primary`、`fallback` 或 optional 注入掩盖 bean 歧义。

**为什么**:可读性重构不应把公开解析面、异常映射和注入拓扑变成新的业务风险;转发层也不能退化成第二个万能 service。

### `R-READ-03` · 结构移动不得改变事务语义

**规则**:移动方法族前必须枚举 self-call 及其外层事务属性,并保留 `@Transactional` 全部属性、
`TransactionTemplate` 的传播、锁顺序、幂等回执、CAS、审计和权威 readback 的调用顺序;若 bean-to-bean 调用会改变
代理边界,必须用行为证据证明原有语义仍成立。

**反例**:只搬方法和 `@Transactional` 注解,没有分析 self-invocation、`REQUIRES_NEW` 或编程式事务,导致拆分后
代理开始或停止生效,失败隔离、回滚范围或锁顺序发生变化。

**为什么**:结构上的“调用了同一个方法”不等于 Spring 事务传播和异常回滚仍是同一个事实。

### `R-READ-04` · 协调器、task-read 和支持类不得冒充聚合

**规则**:跨 owner coordinator、组合 task-read、adapter/support 必须显式分类,不得为了满足“一个类一个聚合”而塞进
某个业务 owner;共享 helper 只有在纯值/纯投影且不持有 JDBC、事务、锁、回执或 owner command 时才可跨族共享,
其余 helper 必须归唯一事实 owner。

**反例**:把跨 owner 写协调器拆进 Catalog 或 Inventory,或新增一个带 JDBC/事务/锁/回执的万能 base/support service
以消除重复,让两个 owner 共同“拥有”同一业务事实。

**为什么**:文件位置不能改变事实所有权;错误的共享层会把跨 owner 写权限和事务边界重新隐藏起来。

### `R-READ-05` · 先行为钉住,再移动结构

**规则**:每个将移动的 public method family 必须按实际适用的风险维度先有真实 fixture、请求/动作、正向与负向
business oracle 以及写入后的权威 readback;只出现方法名/类名、只看状态码、只看异常类型或只看 DB operation 数
都不能关闭行为缺口。既有测试文件按正确职责补最小缺口,不得为“切文件”另造基类或测试框架。

**反例**:先把三百个方法搬到新类,再用编译通过、测试名称命中、`200/422` 或预算数字推断行为未变。

**为什么**:结构重构最难回溯的是事务、幂等、锁、部分失败、跨 owner 和 readback 的行为变化,而不是类是否能编译。

### `R-READ-06` · 每一步都要同输入双读和独立对账

**规则**:每个 CP 写入前重开需求、详设、六维 memory、规范和 owning source;focused proof 后用同一组原文逐项回读,
并在进入下一 CP 前由 fresh 独立 reviewer 做需求、详设/IA、项目记忆三维对账。结果只能是 `MATCHED` 或 `OPEN`;
`OPEN` 必须根因修复并复查,不能积压到全量测试或最终 review。

**反例**:只在任务开始时读一次设计,或把“编译/全量 acceptance 绿”当作前一步的逐条语义对账和下一步准入。

**为什么**:跨步骤的 owner、事务、caller 或 readback 漂移通常在最后才暴露,届时定位成本最高。

### `R-READ-07` · acceptance 必须证明业务而非仅证明运行

**规则**:最后一次全量 backend acceptance 必须晚于所有生产与测试代码改动,并分开报告 `CONTRACT`、真实
`BUSINESS` oracle、信息性的 `DB_OPERATIONS` 和 cleanup;focused proof、静态检查、预算 verifier 或旧 run 不能代替
全量业务证据。

**反例**:把多个单场景 focused run 拼成“全量通过”,复用改码前的 acceptance,或以数据库操作数在预算内替代业务事实断言。

**为什么**:运行成功只能说明某些路径执行完,不能说明整套 owner 事实在新结构下仍然成立。

### `R-READ-08` · 测量必须可复核,未知不得伪装确定

**规则**:任何“全量/唯一/零/只有”或候选规模数字必须绑定可复现的当前源全集和明确口径;无法可靠复算的内容必须标为
`UNVERIFIED_REQUIRES_EVIDENCE`,不得由样本、旧报告或工具近似值外推。未具备完整分母和真实 red mutation 的判据只能保持
review 规则,不能伪装成机器门;不得创建已退役的 hash-chain 或合规台账。

**反例**:从一个文件的 SQL/成员扫描推断全仓,把生成产物或嵌套类型混入 public 计数,或只修改 checker 的正向样本就宣称
新门能拦住未来增量。

**为什么**:错误分母会把不可能完成的门误报为实现缺陷,也会让假绿掩盖未扫描的同根命中。

## 3 · 执行顺序(有依赖,不能乱排)

```
2-F(删死代码)
   └→ 2-E(工具类合并)        必须在后:否则会去合并将死的代码
1-C / 2-D(改 generator + 全量重生成)
   └→ 前端消费侧修正           必须在后:先修 generator,前端错路自己变红
2-A / 2-B / 2-C(写规范 + 按规范扫一遍)
1-I(格式批)                  ⛔ 必须单独成批;必须排在所有行号坐标批次之后
1-H(split package)           与 1-I 同批,同属机械改动
```

---

## 4 · 明确不上的

**Checkstyle / PMD 完整规则集 / Error Prone 默认检查** —— 价值在规则集,规则集要 curate,
三万行存量上会产出几百条待分诊。**唯一例外是 1-D 的 `PreserveStackTrace` 单规则。**

---

## 5 · 维护约定

⚠️ **通用工作纪律见 `frontend-coding-standard.md` §4**(那一节不是前端专属):
`4-A` 否定式全称命题必须穷举后才能写 · `4-B` finding 必须带真实业务场景
· `4-D` 动手写新规则/新方案/新裁决前先查仓内有没有。
⛔ 内容只维护一份,本处只放指针。


- **本文是唯一内容源。** 新增或修改规则只改本文。
- **规则来源分两批**:1-C/1-D/1-H/1-I 与 2-A..2-G 来自 2026-08-14 的后台全量评审(33 条实例归纳);1-J..1-N 与 2-H/2-I 来自 2026-08-26 的 base-1 读模型与生命周期评审,实例见 `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md` 第 1、2 章。**后一批的四个门尚未建成**,条目里已逐条标注「待建」;门存在 ≠ 门生效,建成后必须进 `tools/verify-gates/verify.mjs` 的 command 列表。
- **别处只放指针**:`project-memory/`、skill、评审文档一律只写"见本文",不复述规则内容。
- **新规则由实例产生**,写在修完之后 —— 没有实例的规则不进本文。
- **每条规则必须自带反例**,否则它不是规范,是口号。
