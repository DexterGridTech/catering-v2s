---
title: 商品库存与 BOM 配置 Journey 裁决
status: DEXTER_ACCEPTED
createdAt: 2026-08-22
decisionOwner: Dexter
programId: V2S_W0_W4_EXECUTION
implementationAuthority: false
---

# Journey 裁决：J-CIB-001 按商品结构配置库存扣减方式

<a id="catalog-inventory-bom-configuration-journey"></a>

## 1. 裁决元数据

```text
JOURNEY_ID=J-CIB-001
STATUS=DEXTER_ACCEPTED
SKILL_USED=cs-spec-to-plan@3f223891a0d93ce08a8c84829822d220399e0cdcb46153edac6d4b101613e6b4
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md#G-05,#G-11,#G-12
```

接受依据：Dexter 已接受正式需求中的 A-01 至 A-05 及推荐交互，并在 Claude requirements reasonableness review `GO` 后明确授权进入 Journey、交互、IA、implementation-facing design 与 serial plan。本文只把已接受语义落为 Journey，不新增产品语义，也不授权实施或运行。

## 2. 用户任务与成功结果

- **Actor**：总部或门店的商品资料维护者；在门店范围内同时承担库存配置任务的运营用户。
- **此刻任务**：用户在运营管理后台打开一个商品，在同一商品 Drawer 的“库存与 BOM”页签中，先看清商品结构派生出的可配置对象，再为当前商品、SKU 或点单选项值选择唯一的库存扣减方式并完成必要配置。
- **成功结果**：
  1. 普通销售商品与称重销售商品固定按商品配置；按 SKU 管理商品固定由各 SKU 配置且主商品壳只读；点单选项值只配置附加/替换耗用；物料只建立本品库存对象；套餐、服务、权益壳不出现可配置 owner；
  2. 每个可配置 owner 恰有一个主方式：“不参与库存 / 直接扣当前商品或 SKU / 按 BOM 扣组件”；直接扣本品不选择其他商品，按 BOM 才维护组件行；
  3. 单节点商品可直接看到唯一商品 owner 的详情，多节点商品通过结构树定位当前 owner；用户无需创建节点或理解任意 ref；
  4. 商品整体保存后，catalog 与 inventory owner 在同一事务内完成校验和写入，并以 readback 回显实际生效的结构、方式、库存对象或 BOM 行；篡改 shape、节点、owner 或方式的请求由 owner 拒绝；
  5. 存在余额、流水、BOM 引用或历史快照时，危险方式切换被明确拒绝，不搬余额、不重解释历史、不保留两套 active 方式。
- **失败后仍成立的事实**：商品结构、单位、库存对象、BOM、余额、流水和历史快照都不被部分写入或重解释；失败请求不会隐式创建组件库存对象、不会把其他商品当作当前商品库存、不会从普通/称重商品制造 SKU，也不会用 fallback 修正非法组合。

## 3. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型（三选一） | 产生/确认位置 | 来源证据（文件+锚点） | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 总部或门店商品资料维护者 | 当前集团空间内可登录的运营账号 | `ESTABLISHED_SOURCE` | workspace IAM 已确认身份 | `project-memory/decisions/confirmed-business-language-corpus.md#G-05` | 不进入已登录业务面，不返回商品或库存数据。 |
| 访问资格 | 总部或门店商品资料维护者 | 商品页面准入、当前数据节点可读；保存时具备当前范围的商品写能力，涉及门店库存配置时还具备库存写能力 | `ESTABLISHED_SOURCE` | 实时任职、页面准入、owner grant 与 command 内最终复核 | `project-memory/decisions/confirmed-business-language-corpus.md#G-05A`; `doc/decisions/2026-08-08-v2s-catalog-inventory-scope-specific-write-capabilities.md` | 无页面准入不进入；只读用户可查看但不能保存；owner 拒绝任何越权命令。 |
| 入口数据 | 总部或门店商品资料维护者 | 当前总公司品牌或门店范围、品牌上下文、目标商品或新建商品草稿 | `ESTABLISHED_SOURCE` | operations-admin 当前工作上下文与 catalog owner readback | `project-memory/decisions/confirmed-business-language-corpus.md#G-05,#G-11` | 缺少范围或目标时保持页面阻断态；不得从 URL、显示名称或旧选择猜测。 |
| 商品结构 | 商品资料维护者 | 当前 shape、商品、SKU、点单选项值及基础计量单位的最新草稿和 owner readback | `IN_SCOPE_PRODUCED` | 同一商品 Drawer 的现有商品编辑任务 | `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md#catalog-inventory-bom-formal-requirements` | 结构未满足 contract 时对应配置不可提交；不得由库存页补造商品结构。 |
| 组件候选 | 配置 BOM 的用户 | 同 owner scope、状态可用、具备 `BOM_COMPONENT`、已有 StockTarget、基础计量单位完整且非直接自引用的候选 | `ESTABLISHED_SOURCE` | inventory owner task read | `project-memory/decisions/confirmed-business-language-corpus.md#G-12`; 正式需求 §8.7 | 无候选时显示原因并引导先在原料商品启用库存；不得以自由文本或隐式创建补齐。 |
| 单位 | 配置直接库存或 BOM 的用户 | 当前商品/SKU与组件库存对象都有可解析的基础计量单位/消耗单位快照 | `ESTABLISHED_SOURCE` | catalog 单位 readback 与 inventory 快照 | `doc/decisions/2026-08-21-v2s-catalog-unit-model-journey.md#unit-model-journey` | 缺失时阻断相应方式或组件行，提示先补齐商品基础计量单位。 |
| 生命周期事实 | 尝试切换方式的用户 | 当前余额、流水、BOM 引用与历史定义快照是否均允许切换；历史定义精确指命令开始前已有的停用旧 StockTarget/ProductBom 定义 | `ESTABLISHED_SOURCE` | inventory owner 在同一事务内锁定并检查 | 正式需求 §16 A-05 | 任一维度存在即返回 typed problem；首次切换新停用的旧定义不自我阻断，后续第二次自动切换因 pre-existing 历史定义拒绝；不由前端猜测只读，也不事后补偿。 |

本 Journey 不含 `EXTERNAL_PREREQUISITE_DEXTER_DECISION`；没有用 seed、默认账号或测试夹具替代业务前提。

## 4. 任务边界、非目标与禁推

- **范围内动作**：进入商品 Drawer 的库存与 BOM 页签；浏览结构派生的商品/SKU/选项值 owner；为合法 owner 选择唯一方式；维护本品库存配置或 BOM 组件行；随商品整体保存；处理校验、冲突、拒绝、未知结果并读回。
- **非目标**：经营入口覆盖 BOM 与四层合并、顾客销售事件的源数量单位、订单扣减执行、菜单发布/可售/沽清、套餐展开运行、半成品生产配方与生产入库、采购/仓库/批次/调拨/成本、多版本/递归 BOM。
- **禁推**：
  1. shape 准入不等于已创建库存或 BOM；`SELLABLE`、`STOCK_MANAGED`、`BOM_COMPONENT` 均不自动产生库存事实；
  2. `usageCapabilities` 不作为直接扣本品的准入门，`BOM_COMPONENT` 只用于组件候选；
  3. 普通/称重 shape 不因草稿里出现 SKU 而切换到 SKU 粒度；按 SKU shape 的主商品也不因无 active SKU 而退回商品级；
  4. 点单选项值的 BOM 不使其成为库存对象；套餐组件关系不成为 BOM；物料/半成品库存不成为生产配方；
  5. `measureMode=WEIGHED` 不决定消耗单位、库存方式或销售扣减换算；
  6. 页面可见、候选可选或前端校验通过都不替代 owner 的权限、结构、引用和生命周期复核。
- **禁止伪修复**：不保留扁平 entry 双写、旧 `HAS_SKU/NO_SKU` 动态规则、自由 ref、自由单位串、JSON fallback、静默归档/迁移或客户端拼接 owner 关系。

## 5. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 运营用户、数据范围与写能力 | `project-memory/decisions/confirmed-business-language-corpus.md#G-05,#G-05A` | operations-admin 提供任务入口；读取范围和写能力分离，owner 终判。 | 无。 | 否 |
| 商品、SKU 与点单选项 | `project-memory/decisions/confirmed-business-language-corpus.md#G-11` | 商品结构派生可配置 owner；SKU 是规格单元，选项是制作/加料选择。 | 旧 `OPTIONAL_TABLE` 与新 A-01 冲突，已 supersede。 | 已裁定，否 |
| 轻库存、StockTarget、BOM 与历史 | `project-memory/decisions/confirmed-business-language-corpus.md#G-12` | inventory owner 持有真实库存对象、BOM、余额、流水和快照；无 BOM 不阻断销售。 | V6 经营入口覆盖与本专题范围不同，已列非目标。 | 否 |
| 单位与截断 | `doc/decisions/2026-08-21-v2s-catalog-unit-model-journey.md#unit-model-journey` | 消耗单位来自基础计量单位快照；盘点单位只服务录入；精度向零截断。 | 顾客销售事件源单位不在本专题。 | 否 |

## 6. UI 适用性与后续工件

`UI_BEARING=true`。用户必须在 operations-admin 的商品 Drawer 内看见结构、当前 owner、唯一方式、相关字段、候选、阻断原因与 readback；不能仅靠 contract 或 owner 拒绝完成用户任务。

下一工件使用 `doc/decisions/templates/ui-interaction-design-template.md`。Dexter 看低保真线框并确认前，不进入 IA 或 implementation-facing design；确认后再按本 Journey 和正式需求逐字传递不可见维度。

## 7. Dexter 裁决

- **裁决**：接受；本工件是已确认正式需求 A-01 至 A-05 与交互方向的 Journey 落账。
- **精确范围**：operations-admin 商品 Drawer 内的库存与 BOM 配置，覆盖普通、称重、按 SKU、物料、套餐、服务、权益壳与点单选项值的合法/非法形态。
- **已知前提**：contract 单一真相；前端只呈现和组装 typed 草稿；后端按保存事务内的真实商品结构重新派生并复核。
- **未决项**：无。
- **后续允许动作**：编写交互工件和低保真线框，交 Dexter 看图；尚不允许 IA、implementation-facing design、implementation、测试或运行。
