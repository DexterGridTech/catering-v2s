---
title: 商品计量单位维护与使用 Journey 裁决
status: DRAFT_WAITING_FOR_HOLISTIC_REVIEW
createdAt: 2026-08-21
decisionOwner: Dexter
programId: V2S_W0_W4_EXECUTION
---

# Journey 裁决：J-UNIT-001 商品计量单位维护与使用

<a id="unit-model-journey"></a>

## 1. 裁决元数据

```text
JOURNEY_ID=J-UNIT-001
STATUS=DRAFT_WAITING_FOR_HOLISTIC_REVIEW
SKILL_USED=NONE
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md#G-05,#G-11,#G-12
```

## 2. 用户任务与成功结果

- **Actor**：总部或门店的运营用户。
- **此刻任务**：运营用户先在自己可维护的商品元数据中维护一套可复用的计量单位；再为商品或 SKU 确定唯一销售单位和基础计量单位，并在库存配置中只使用该商品资料已确定的计量口径。
- **成功结果**：
  1. 当前总部/门店范围内可用的单位有名称、编码、维度、精度和状态，且一个正常范围通常为十几个、最多几十个，最多 99 个；
  2. 每个可销售商品或 SKU 读回时只能解析出一个有效销售单位；启用库存管理或作为 BOM 组件的商品或 SKU 只能解析出一个有效基础计量单位；
  3. 库存对象读回的消耗单位来自该有效基础计量单位的快照；盘点录入换算不改变余额、BOM 或流水的消耗单位；
  4. 零引用单位可以修改或删除；已被引用的单位仅名称可以修改，编码、维度和精度不可修改；停用后既有商品、SKU、库存、BOM 与历史快照仍保留原含义，而用户不能再为商品或库存新增选择该单位。
- **失败后仍成立的事实**：不会因一次失败或取消而把多个销售单位写到同一商品/SKU；不会让库存页自建或改写脱离商品资料的消耗单位；不会删除既有引用或重新解释历史快照。

## 3. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型（三选一） | 产生/确认位置 | 来源证据（文件+锚点） | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 总部或门店运营用户 | 已存在于当前集团空间、可登录的运营账号 | `ESTABLISHED_SOURCE` | 工作空间 IAM 已确认身份 | `project-memory/decisions/confirmed-business-language-corpus.md#G-05` | 不显示业务数据，也不允许调用维护动作。 |
| 访问资格 | 总部或门店运营用户 | 可进入运营管理后台商品维护面；写入时拥有当前范围的商品或库存写能力 | `ESTABLISHED_SOURCE` | 实时任职、页面准入和 owner 首读授权 | `project-memory/decisions/confirmed-business-language-corpus.md#G-05A` | 无页面准入时不进入该面；无写能力时只能读取，不显示或不执行写动作。 |
| 入口数据 | 商品资料维护者 | 当前商品容器范围及品牌/门店上下文已由运营管理后台选择 | `ESTABLISHED_SOURCE` | 商品目录范围与当前运营上下文 | `project-memory/decisions/confirmed-business-language-corpus.md#G-05,#G-11` | 不以显示名称猜测范围；缺上下文时提示先选择有效工作范围。 |
| 业务数据 | 商品资料维护者 | 当前范围已有或可创建的计量单位定义 | `IN_SCOPE_PRODUCED` | 本 Journey 的“维护计量单位”动作 | `doc/plans/platform/2026-08-21-v2s-catalog-unit-model-optimization-requirements-analysis-codex.md#FR-UNIT-01` | 没有可用单位时，可先维护单位；不得用自由文本替代。 |
| 业务数据 | 商品资料维护者 | 待维护的商品或 SKU，及其是否可销售/是否需要库存或 BOM 语义 | `ESTABLISHED_SOURCE` | 商品目录 owner readback | `project-memory/decisions/confirmed-business-language-corpus.md#G-11`; `doc/plans/platform/2026-08-21-v2s-catalog-unit-model-optimization-requirements-analysis-codex.md#FR-UNIT-03,#FR-UNIT-05` | 目标不存在或不在当前范围时拒绝；不以候选单位创建商品或 SKU。 |
| 业务数据 | 库存配置维护者 | 关联商品或 SKU 已能解析有效基础计量单位 | `ESTABLISHED_SOURCE` | 商品资料 readback 后由 inventory owner 使用 | `project-memory/decisions/confirmed-business-language-corpus.md#G-12`; `doc/plans/platform/2026-08-21-v2s-catalog-unit-model-optimization-requirements-analysis-codex.md#FR-UNIT-06` | 不允许创建或改写无来源的库存消耗单位；先回商品资料补齐。 |
| 生命周期裁决 | 总部或门店运营用户 | 零引用单位可以修改或删除；被商品、SKU、库存、盘点换算、BOM 或历史快照引用后删除被拒绝、可停用且仅名称可改，编码、维度、精度不可改 | `ESTABLISHED_SOURCE` | Dexter 2026-08-21 直接裁定 | `doc/decisions/2026-08-21-v2s-catalog-unit-model-journey.md#D-UNIT-003` | 引用中的删除动作不可用并由 owner 拒绝；停用仅阻断后续候选选择，不清理既有事实；需要不同编码、维度或精度时新建单位并重新选择。 |
| 集合规模 | 总部或门店运营用户 | 单位库典型十几个、最多几十个；“上限小于100”在实现上固定为最多99条 | `IN_SCOPE_PRODUCED` | 本工件按 Dexter 的“小于100”裁定消除边界歧义 | `doc/decisions/2026-08-21-v2s-catalog-unit-model-journey.md#D-UNIT-002` | 后续交互和 IA 必须按有界集合设计；第100条拒绝，不得伪装成无限滚动或任意大分页。 |

## 4. 任务边界、非目标与禁推

- **范围内动作**：维护当前总部或门店私有的计量单位；修改或删除零引用单位；为商品或 SKU 选择其单值销售单位和基础计量单位；读取库存对象由此冻结的消耗单位；为盘点录入选择合法盘点单位及明确换算；停用已不再供未来选择的单位。
- **非目标**：顾客端点单、菜单发布、订单执行、实际库存扣减、采购、仓库、批次、任意单位两两换算引擎、库存专用单位库，以及让平台后台维护商品计量单位。
- **禁推**：
  1. 不得由 `measureMode`（计件/称重方式）推导 g、kg、个等实际单位；
  2. 不得由“份、杯、瓶、包”等单位名称推导商品容量或库存扣减量；
  3. 不得由已选销售单位推导 BOM 总量或把多条 BOM 合成为通用单位换算；
  4. 不得由已引用单位的停用推导删除既有商品、SKU、库存、BOM、盘点换算或历史快照；不得由“名称可改”推导编码、维度或精度可改；
  5. 不得由商品资料页面可见推导写权限，或由前端候选结果推导 owner 授权。
- **禁止伪修复**：不把原销售单位多选控件改成单选后仍保留数组事实；不在库存页开放自由文本单位；不保留兼容数组、双写或旧数据 fallback；不以 seed、测试夹具或默认单位代替用户维护和 owner 校验。

## 5. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 运营用户、页面准入、动作能力 | `project-memory/decisions/confirmed-business-language-corpus.md#G-05,#G-05A` | 运营用户从运营管理后台进入；读取范围与写能力分开，写入由 owner 实时核验。 | 无。 | 否 |
| 商品与 SKU | `project-memory/decisions/confirmed-business-language-corpus.md#G-11` | 商品回答卖什么，SKU 承载规格单元；本 Journey 为它们补齐单位口径，不把单位变成菜单或价格事实。 | 现有 `salesUnitRefs[]` 多选与本 Journey 的唯一销售单位冲突。 | 已由 Dexter 接受单值模型，否。 |
| 库存、BOM、盘点单位 | `project-memory/decisions/confirmed-business-language-corpus.md#G-12` | 消耗单位是库存真相；盘点单位只服务录入；BOM 可挂商品、SKU、选项值。 | 当前 inventory 将 `measureMode` 当单位，与 corpus 冲突。 | 否 |
| 单位精度与数量截断 | `doc/plans/platform/2026-08-21-v2s-catalog-unit-model-optimization-requirements-analysis-codex.md#3.1,#FR-UNIT-01,#FR-UNIT-02` | 单位逐项定义精度；目标单位的输入与计算均向零截断，不四舍五入。 | 无。 | 已裁定，否。 |
| 单位停用、删除与定义变更 | `doc/decisions/2026-08-21-v2s-catalog-unit-model-journey.md#D-UNIT-003` | 零引用单位可修改或删除；已引用单位删除被拒绝，停用后只移除后续商品/库存选择候选，既有引用和历史快照保留；仅名称可改，编码、维度、精度必须通过新建单位并重新选择解决。 | 无外部未决前提。 | 否 |
| 总部复制到门店 | `project-memory/decisions/confirmed-business-language-corpus.md#G-11` | 总部商品是门店复制候选；复制后的门店商品独立生命周期，单位引用必须重写为目标门店范围可用引用。 | 不得保留总部范围单位引用。 | 否，已由正式需求明确。 |

## 6. UI 适用性与后续工件

`UI_BEARING=true`。运营用户要在既有商品元数据 Modal、商品资料、SKU 资料和库存配置中查看、选择、停用或拒绝删除单位；这些均为直接用户操作，不能以接口或 seed 替代。

后续必须先形成 `doc/decisions/templates/ui-interaction-design-template.md` 所要求的交互工件，并由 Dexter 看低保真线框。Dexter 已要求先把 IA、implementation-facing 详设与串行计划写成一组供整体审阅的**草案**；该例外只允许文档联动，不改变线框未确认时不得开始代码、契约、数据库、seed 或运行环境工作的边界。

## 7. Dexter 裁决

### D-UNIT-001：业务模型

- **裁决**：接受。
- **精确范围**：一套总部/门店私有的计量单位库；商品/SKU 的销售单位与基础计量单位各为单值；库存消耗单位来自基础计量单位快照；盘点单位只用于录入。
- **已知前提**：SKU 覆盖优先于商品默认值；`measureMode` 不是单位；BOM 不被泛化单位换算替代。
- **未决项**：无。
- **后续允许动作**：仅进入交互工件与 Dexter 看图确认。

### D-UNIT-002：单位库规模

- **裁决**：接受。
- **精确范围**：一个总部或门店通常维护十几个单位，最多几十个。将“上限小于100”固定解释为**最多99个**；第100个单位必须被拒绝。
- **已知前提**：该数值仅约束单位库及其候选选择，不外推为商品、SKU、库存对象或历史流水的规模上限。
- **未决项**：无。
- **后续允许动作**：交互与 IA 按最多99个处理；owner 取第100条作检测位并拒绝，不得自造无根据的大集合策略。

### D-UNIT-003：单位的删除、停用与被引用后的定义变更

- **裁决**：接受。
- **精确范围**：零引用单位可以修改或删除。被商品、SKU、库存、盘点换算、BOM 或历史快照引用的单位删除被拒绝、可停用；停用仅使该单位在用户后续为商品或库存选择单位时不可见，不移除、不改写既有引用或历史快照。被引用单位仅名称可以修改；编码、维度、精度不可修改，需要变更时新建单位，再由未来使用者重新选择。
- **已知前提**：这不是商品、SKU 或库存对象的停用，也不等于删除、迁移或重算；库存 owner 仍以已有快照解释既有余额、BOM 和流水。
- **未决项**：无。
- **后续允许动作**：交互工件可设计“删除零引用单位”“改名称”和“停用”及其后果说明；不得出现对已引用单位的“删除”、改编码、改维度或改精度动作。

### D-UNIT-004：数量输入与目标单位精度

- **裁决**：接受，关闭 `U-UNIT-DESIGN-02`。
- **精确范围**：源单位输入数量按源单位自身 `precision` 处理；转换后的目标消耗数量再按目标消耗单位自身 `precision` 处理。两处均向零截断、不四舍五入；前端输入限制与 owner 采用同一向零截断语义，不能把目标 precision 冒充源 precision。
- **已知前提**：`0.3567kg → 356g` 的例子成立：源数量先按 kg precision 截断，再乘换算因子，最后按 g precision=0 截断；单位快照后来改名或定义变化不重解释既有余额、流水和 BOM。
- **未决项**：无。
- **后续允许动作**：实现动态源单位输入精度、目标消耗精度和对应 focused/acceptance proof；不得使用固定 `precision={3}` 或任何四舍五入 formatter。
