# 外部协作与经营渠道 · 架构复核(模块定位与模型形态)

- 日期:2026-08-18 · 作者:Claude · 触发:Dexter「每个模块的定位是什么,怎样设计最合理」
- 被审:`doc/review/platform/2026-08-18-v2s-external-platform-collaboration-and-business-channel-requirements-claude.md`
- 输入:美团 mock(`catering-all-v1/mocks/meituan`,只读)、`PLATFORM-BLUEPRINT.md`、`AGENTS.md`、
  业务语料 G-01～G-12、当前 15 个后端模块源码
- 结论:**需求文档有一处模型缺陷(M-1)与一处未论证的模块归属(M-2),其余成立**

---

## 1 · 现有模块定位(亲验得出,不是推测)

| 模块 | 定位 | 拥有的 schema | 公开 API 特征 |
|---|---|---|---|
| `organization` | 组织与经营主体事实 | `organization`(142) | 最大;含 `OperationsOwnerScopeGrant`、各类 `*Lookup` |
| `catalog` | 商品事实 | `catalog`(203) | `CatalogOwnerApi` |
| `inventory` | 门店轻库存 | `inventory`(36) | `InventoryOwnerApi` |
| `store-contract` | 轻合同与**货号** | `contract`(36) | `OperationsStoreContractCommandApi` |
| `extension` | **扩展字段定义(一份定义 × 多类宿主)** | `extension`(23) | `ExtensionHostTypes` / `ExtensionDefinitionLookup` |
| `asset` | 资产暂存与释放 | `asset`(32) | `CatalogAssetCommandApi` |
| `fulfillment-production` | 生产标签 | `fulfillment_production`(10) | `ProductionTagOwnerApi` |
| `workspace` | 集团空间与平台侧协调 | `workspace`(63) | `PlatformWorkspaceCoordinator` |
| `workspace-iam` | 运营账号/角色/任职/capability | 同 `workspace` | `WorkspaceCapabilityRequirementCatalog` |
| `platform-admin-iam` | 平台管理员会话与治理授权 | — | `PlatformGovernanceAuthorization`;**无 capability 模型** |
| `audit-model` / `audit-read` / `execution-context` / `foundation` / `build` | 横切支撑,无 owner API | — | — |

**由此得出三条可复用的既有形态:**

1. **`extension` 是「一份定义 × 多类宿主」的成熟范式** —— 品牌/租户/总公司/门店/合同共用一套
   定义与宿主类型枚举。本次的「能力属性字典 × 多个外部系统」与它**同构**,
   应当参照其形态(整体读取、原子替换、宿主类型闭集),而不是另立协议。
2. **`OperationsOwnerScopeGrant` 由 `organization` 拥有** —— 新模块的写授权必须接它,不得自造。
3. **`store-contract` 已拥有货号** —— 未来订单同步给商场 ERP 时,映射走它,不得另建。

## 2 · M-1(模型缺陷)· 授权维度被压进了店铺维度 —— 饿了么反例装不下

**美团 mock 的原文约束**(`docs/scenario-coverage-matrix.md` Scenario 1):

> 授权必须按 **ISV/app 和店铺隔离**。`MockShop` 必须区分 `TAKEOUT` 与 `GROUP_BUY` 两种业务线;
> **外卖店铺和团购店铺即使映射到同一个 v4 内部 Store,也必须是两个不同外部店铺对象**。
> 同一个 mock ISV/app 可以分别授权这两个店铺,也可以只授权其中一个;`developerId`、`app_id`、
> sign key、`appAuthToken`、回调目标和业务数据都必须先解析到正确的
> **ISV/app、business line 和 shop 上下文**。

⇒ **授权的粒度是三元组 `(ISV/app, 业务线, 店铺)`**,不是二元组。

**当前需求文档的 `owner_binding`**:`businessSet[]` 可多值,而 `externalOwnerId`、
`authorizationRef`、`status` **均为单值**。据此:

| Dexter 给的反例(S-05) | 当前模型 |
|---|---|
| 美团:两业务 = 两店铺 + 两套授权 ⇒ 2 条绑定 | ✅ 装得下 |
| **饿了么:两业务 = 一店铺 + 两套授权 ⇒ 1 条绑定 + 2 套授权** | ❌ **装不下** —— 只有一个 `authorizationRef` |

**更具体的失败**:饿了么若外卖授权有效、团购授权失效,单个 `status` 无法表达;
而两条渠道(外卖渠道、团购渠道)正指向这同一条绑定,一条该生效一条不该。

**根因**:我把「内外主体映射」(店铺级)与「授权」(业务线级)压进了同一行。
Dexter 早已给出该反例并被原样记入 S-05,但模型未真正满足它 ——
当时的结论「绑定条数不由系统规定」只解决了条数,没解决**维度**。

**应有形态(Dexter 2026-08-18 更正;Claude 原提案的 `authorizations[]` 子项是过度设计,作废)**:

**`owner_binding` 是扁平三元组,不是数组**:

```
owner_binding = (providerCode, capabilityClass, externalOwnerId) @ 组织节点
                 接入档案      单个业务线        外部店铺
```

**驱动因素是菜单,不是授权**:菜单 ↔ 经营渠道 **1:1**(记录 001 第 6 条:
「后续每个销售菜单绑定一条有效的经营渠道」);每个外部店铺有自己的菜单;
⇒ **外部店铺 ↔ 渠道 1:1** ⇒ **渠道 ↔ binding 1:1**。

**Dexter 给的实例**:万象城海底捞一个门店,在美团有三个外部店铺 ——
外卖「海底捞拌饭」、外卖「海底捞冒菜」、团购「海底捞万象城店」。
⇒ 系统里建**三条经营渠道**,**每条渠道做一次授权绑定**,因为三者菜单不同。

**两个平台反例在该模型下均成立**:

| 平台 | 渠道数 | binding | 说明 |
|---|---|---|---|
| 美团 | 2 | 2 条,`externalOwnerId` **不同**、`capabilityClass` 不同 | 两业务 = 两店铺 + 两套授权 |
| 饿了么 | 2 | 2 条,`externalOwnerId` **相同**、`capabilityClass` 不同 | 共用一个店铺 ID + 两套授权 |

⇒ `externalOwnerId` **不设唯一约束**,同一店铺 ID 可出现在多条 binding 上。

**由此的字段修正**:

- `businessSet[]`(数组)→ **`capabilityClass`(单值)**;
  原约束「业务集合 ⊆ 档案业务范围」收敛为 **`capabilityClass` ∈ `provider_profile.businessScope`**
  (∈ 是 ⊆ 的特例,约束不变,基数由菜单粒度钉死为 1);
- `authorizationRef` / `status` / 解绑三时间戳**保持在 binding 行上** —— 因为 binding 本身就是授权单元;
- **基数**:外部渠道 → 恰好 1 条 binding;binding → 0 或 1 条渠道
  (非渠道用途的 binding,如集团级会员卡券、主数据同步,无渠道)。

**Claude 的错在哪**:我把「饿了么共用店铺 ID」误读成「一条 binding 承载两套授权」,
于是提出拆子项。真实约束是**菜单粒度**——它在记录 001 第 6 条里,我引用过却没用它推导基数。

## 3 · M-2(未论证)· 模块归属:按**域**拆,应当是两个

需求文档 §0 写「owner 模块 `collaboration`」,**未给理由**。

⚠️ **本节第一版的论证是错的,已作废**:它以「两个后台、两类用户」为拆分依据,
并引 `workspace` / `workspace-iam` 为先例。**Dexter 2026-08-18 指出:按管理后台拆不合理,
唯一拆的理由是按域拆。** 该先例也证明不了原论点 —— 那两个模块本来就是两个域
(集团空间这个**容器** vs 空间内的**身份与访问**),由不同后台维护是**结果**不是原因。

**按域重新推导,结论仍是两个模块,理由如下。**

### 3.1 独立存在性(域边界的第一判据)

| | 是否存在 | 实例 |
|---|---|---|
| 有绑定、**无**渠道 | **是** | 集团统一会员卡券系统、主数据同步 —— 不产生任何下单入口 |
| 有渠道、**无**绑定 | **是** | 全部内部渠道:POS、扫码、自助机 —— 不碰任何外部系统 |

⇒ 两边**都能脱离对方独立存在,且各自语义完整**。这是两个域的直接证据。

### 3.2 变化原因不同(单一职责的"变化原因"版本)

| 层 | 因何而变 |
|---|---|
| 协作层 | 接入了新平台;平台改了授权机制;新增一类能力 |
| 渠道层 | 新增一种下单形态(「自助机」即本次新增);经营主体规则变化 |

⇒ **没有共同的变化原因。**

### 3.3 概念依赖单向

渠道**引用**绑定;绑定不知道渠道存在,也不需要知道。

### 3.4 仓内同形先例(且非按后台拆)

`store-contract` 独立于 `organization`:合同**基于门店**(G-09),耦合紧、单向引用,
但它是**另一个域**(经营关系档案),因此是独立模块 + 独立 `contract` schema。

**渠道 : 绑定 ≈ 合同 : 门店** —— 紧耦合、单向引用,但不同域。
⇒ 「1:1 耦合紧」不构成合并理由,仓内已有先例接受这种跨模块耦合。

### 3.5 反向验证:起不出内聚的名字

若合为一个模块,它须同时表达「对外对接关系」与「下单入口」——
找不到一个内聚的名字。**起不出名字,就是域不内聚的信号。**

### 3.6 结论

```
collaboration      对外对接关系:外部系统是谁 / 以什么身份接 / 哪个主体对哪个主体
business-channel   经营入口:用户从哪下单 / 入口形态 / 菜单挂哪

依赖方向:business-channel → collaboration(单向读),反向禁止
```

级联(绑定删除 ⇒ 渠道落回草稿)由 `collaboration` 调用 `business-channel` 的
公开 command API,加入同一 `REQUIRED` 事务(AGENTS.md 红线:跨模块写只调公开 command API)。

## 4 · 复核成立的部分(不改)

| 项 | 结论 | 依据 |
|---|---|---|
| 能力分类七类、非互斥、平台一对多 | ✅ 成立 | 美团 mock 的 waimai / tuangou / diancan 三条独立接口族印证 |
| 两段式解绑,主程序不知平台规则 | ✅ 成立 | 美团解绑是「跳转 + 异步回调」,饿了么可能不同 —— 差异必须由适配器吸收 |
| platform-admin 无 capability | ✅ 成立 | blueprint 红线 + `platform-admin-iam` 源码亲验 |
| 两个运营写能力(项目/门店渠道编辑) | ✅ 成立 | 红线「不同目标数据节点类型的写入必须有不同 capability」,恰为两种 target |
| 读不设独立 capability | ✅ 成立 | 红线「capability 不得作为页面访问或任何 GET 的读取权限」 |
| 能力属性字典只读、不设控件元数据 | ✅ 成立 | 契约态无运行时编辑表单 |
| 契约态用编码引用(反例登记) | ✅ 成立 | 契约态对象无 owner,故无 owner 分配的 UUID |

## 5 · 新登记的未来事实(本期不实现)

美团 mock 的 admin 能力清单含
`POST /admin/shops/:key/revoke-authorization` —— 其说明为
「Simulate later **merchant or platform** de-authorization」。

⇒ **外部单方面解除授权是真实且必然的情形**,不由本系统发起。
按两段式协议,它同样由适配器先收到再通知主程序,但结果应是**该业务线的授权失效**
(不是已删除),并连带对应渠道失效。完整语义待适配器批次定义。

## 6 · 处置建议

| # | 事项 | 处置 |
|---|---|---|
| M-1 | `owner_binding` 改为扁平三元组:`businessSet[]` → `capabilityClass` 单值;渠道 ↔ binding 1:1;`externalOwnerId` 不设唯一约束 | **改需求文档**(Dexter 已更正模型) |
| M-2 | 拆为 `collaboration` + `business-channel` 两个模块(**按域,不按后台**)并写明依赖方向 | **改需求文档** |
| 未来事实 | 外部单方面解除授权 | 已登记,本期不实现 |

## 7 · 授权边界

本文是**静态架构复核**,不授权实施、契约或代码改动。
美团 mock 仓为**只读**,本轮未做任何写入。
