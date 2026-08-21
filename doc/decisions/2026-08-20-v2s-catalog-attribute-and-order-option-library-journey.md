---
title: 商品属性库、点单选项库与两步新建 Journey 裁决
status: DEXTER_ACCEPTED
createdAt: 2026-08-20
decisionOwner: Dexter
implementationAuthority: false
runtimeAuthority: false
---

# Journey 裁决：CATALOG_LIBRARY_CONFIGURATION 商品属性库、点单选项库与两步新建

## 1. 裁决元数据

```text
JOURNEY_ID=CATALOG_LIBRARY_CONFIGURATION
STATUS=DEXTER_ACCEPTED
SKILL_USED=cs-spec-to-plan
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md#G-11、G-12
```

## 2. 用户任务与成功结果

- **Actor**：在当前总部或门店商品库具有商品维护能力的店铺运营方。
- **此刻任务**：先维护本 scope 可复用的商品属性和点单选项定义，再把它们准确配置到商品；首次新建商品时先慎重确认编码、名称、可空分类和不可改形态。
- **成功结果**：商品不再保存自由 JSON 属性或自创点单组；同一“过期时间”或“蘸料”由本 scope 的一个定义控制。商品只保存自身的属性值、必选/min/max/默认/加价和强制组件实际数量；首步成功持久化 `DRAFT`，随后直接进入可编辑详情。
- **失败后仍成立的事实**：未成功的命令不产生部分定义、赋值、覆盖或 BOM；删除定义不会删除商品、`StockTarget`、原材料商品或未来历史事实；商品侧不以本地判断替代库存 owner、复制预检或授权判定。

## 3. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型 | 产生/确认位置 | 来源证据 | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 店铺运营方 | 已登录运营管理后台且有当前工作上下文 | `ESTABLISHED_SOURCE` | operations session / workspace IAM | `project-memory/decisions/confirmed-business-language-corpus.md#G-05` | 不进入商品工作台。 |
| 访问资格 | 店铺运营方 | 当前 scope 的商品读取页面准入与商品写 capability | `ESTABLISHED_SOURCE` | workspace IAM 与 catalog owner command | 同文件 `#G-05A`；`PLATFORM-BLUEPRINT.md#模块 owner 与命令主权` | 页面不可进入或 owner 拒绝，前端不伪造可写。 |
| 入口数据 | 店铺运营方 | 当前总部品牌库或门店商品库 scope | `ESTABLISHED_SOURCE` | CatalogWorkbench 当前 scope/readback | 正式需求分析 §2、§3.6 | 无 scope 时显示工作台既有空/失败态，不默认跨 scope。 |
| 分类候选 | 店铺运营方 | 本 scope 分类树；可不选，只能选一个节点 | `ESTABLISHED_SOURCE` | catalog owner 分类 read | 正式需求分析 `FR-CREATE` / §3.5 | 候选读取失败则不能提交首步；空树仍可选“未分类”。 |
| 强制组件候选 | 店铺运营方 | 同 scope 已有、inventory owner 可解析的 `StockTarget` 所属原材料商品 | `ESTABLISHED_SOURCE` | inventory owner 候选 read，catalog command 最终核验 | 正式需求分析 `FR-OPT-01`、§3.3 | 库定义不能保存该组件；商品侧不再单独判断库存就绪度。 |
| 品牌复制 | 总部商品维护者 | 可读取源品牌库、可写目标门店库并有现有复制入口 | `ESTABLISHED_SOURCE` | BrandCatalogCopy drawer / catalog-inventory copy commands | 正式需求分析 §3.4 | 预检 hard block 不可确认、不可执行。 |

## 4. 任务边界、非目标与禁推

- **范围内动作**：维护两类私有定义库；把属性/选项配置给商品；定义级删除级联；品牌到门店复制的深复制与语义冲突呈现；两步创建。
- **非目标**：平台后台入口、客户点单展示、菜单发布、订单执行、实际库存扣减/恢复、采购/仓库/批次/调拨、历史数据迁移。
- **禁推**：有 `StockTarget` 不等于可售；配置 BOM 不等于已实现订单扣减；总部后续更新不自动影响已复制门店；`MULTIPLE` 的 `max=1` 不改变库定义为 `SINGLE`；商品编码和已使用定义更新语义均不因属性定义编码可改而放开；点单组选项组/值编码创建后不可修改。
- **禁止伪修复**：保留 `attributes` JSON 兼容层、把新定义伪装成 SKU 属性或 `ORDER_OPTION_VALUE`、在前端用 singleton array 模拟单分类、商品侧重做库存就绪检查、把 copy hard block 变确认框、为清库设计迁移双写/fallback。

## 5. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| CatalogItem / ProductCatalog | `confirmed-business-language-corpus.md#G-11` | 商品是可复用壳；总部复制到门店后本地独立。 | 旧自由 JSON 与内联组选项由正式需求分析明确 supersede。 | 否 |
| SKU 与点单选项 | 同文件 `#G-11` | SKU 回答规格；点单选项回答怎么做/加什么。 | 不把 SKU 销售属性当商品属性库。 | 否 |
| StockTarget / option-value BOM | 同文件 `#G-12` | 库组件意图必须指向 inventory owner 的 target；选项值只能是 BOM owner。 | 不推导可售或真实扣减。 | 否 |
| 总部/门店与写授权 | 同文件 `#G-03`、`#G-05A` | 当前 scope 私有，owner command 重新核验。 | 页面准入、可读和可写不互推。 | 否 |

## 6. UI 适用性与后续工件

本 Journey 为 `UI_BEARING=true`：唯一 consumer face 是 `operations-admin`。交互工件必须先交 Dexter 看低保真线框；在该接受结论前，不得把后续 IA、implementation-facing 详设或实施计划标为可实施。

## 7. Dexter 裁决

- 裁决：接受。
- 精确范围：正式需求分析中 Dexter 决策 1–12，外加分类单节点/未分类、库组件必须已有可解析 `StockTarget`、清库、`MULTIPLE` min/max 归商品配置、点单组选项组/值编码创建后不可修改、商品主面直出且两个定义库仅位于商品元数据 Modal 六条补充裁定。
- 已知前提：本 Journey 不使用 seed、默认账号、前端推导权限或历史兼容。
- 未决项：已使用商品属性定义的类型/选择项更新规则；未来历史事实的长期删除策略；定义库业务预期规模和检索需要。
- 后续允许动作：交互工件与低保真看图；看图接受后才允许 IA、implementation-facing 详设和串行实施计划。实施仍需单独授权。
