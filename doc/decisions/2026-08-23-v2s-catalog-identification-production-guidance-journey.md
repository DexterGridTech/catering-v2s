---
title: 商品条码与标识、制作信息优化 Journey 裁决
status: DEXTER_ACCEPTED
createdAt: 2026-08-23
decisionOwner: Dexter
programId: V2S_W0_W4_EXECUTION
implementationAuthority: true
implementationAuthorization: DEXTER_CIPG_DESIGN_GO_CP00_CP13_20260823
---

# Journey 裁决：J-CIPG-001 维护商品识别与制作差异

> `PARTIALLY_SUPERSEDED_BY`：`doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md`。
> 生产标签相关 Journey 已收敛为商品级可选单值；SKU 与点单选项不再改变标签，本期也不含生产路由。其它识别与制作内容 Journey 继续有效。

<a id="catalog-identification-production-guidance-journey"></a>

## 1. 裁决元数据

```text
JOURNEY_ID=J-CIPG-001
STATUS=DEXTER_ACCEPTED
SKILL_USED=cs-brainstorming@4a54a4858b99807f3155ed1614b2f116e35ea5c1b788e793f565dd837fd3891f
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md#G-05,#G-11
```

接受依据：需求讨论稿已经 Claude 独立 reasonableness review `GO`；Dexter 已逐项裁定全部八项产品问题，并接受本 Journey、交互工件、低保真线框与 IA。本文只把已接受业务规则落为用户任务，不新增产品语义；Dexter 已授权本批 CP-00 至 CP-13 实施，但不因此授权真实 migration、DEV、reset、seed、browser L2、UAT、部署或数据操作。

## 2. 用户任务与成功结果

- **Actor**：总部或门店的商品资料维护者。
- **此刻任务**：用户在运营管理后台打开一个商品，需要在同一商品编辑会话中维护“怎样识别这个商品或具体 SKU”，并维护“商品通常怎样制作、具体 SKU 有何差异、某个点单选项会增加什么制作影响”。
- **成功结果**：
  1. 普通、称重、物料、套餐商品的识别码绑定商品；按 SKU 管理商品在每个具体 SKU 行维护识别码；服务/费用商品只维护助记码；
  2. 用户只填写识别类型和识别值，能看到重复、非法类型、错误归属和 shape 不准入的具体失败；
  3. 商品制作默认值、SKU 继承/完整覆盖和点单选项增量 effect 都显示具体对象与来源，不出现抽象“SKU节点/选项值节点”；
  4. 用户在制作信息页维护商品默认和 SKU 覆盖，在具体点单选项值中维护 effect；制作信息页可查看选项 effect 摘要并准确到达对应选项；
  5. 商品整体保存后，以 catalog owner readback 回显 identifier、覆盖来源、选项 effect 与有效制作信息；任一非法事实使 whole-save 失败且版本不变。
- **失败后仍成立的事实**：商品 code、skuCode、外部身份、商品/SKU/选项结构、已有 identifier、制作 profile、production tag 引用和历史快照均不被部分写入或重新解释；页面不自动生成默认 SKU、不猜 brand、不从 generic JSON 或旧列 fallback。

## 3. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型（三选一） | 产生/确认位置 | 来源证据（文件+锚点） | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 总部或门店商品资料维护者 | 当前集团空间内可登录的运营账号 | `ESTABLISHED_SOURCE` | workspace IAM 已确认身份 | `project-memory/decisions/confirmed-business-language-corpus.md#G-05` | 不进入已登录商品面，不返回商品资料。 |
| 访问资格 | 总部或门店商品资料维护者 | 商品页面准入、当前角色节点可读；保存时具备当前范围商品写能力 | `ESTABLISHED_SOURCE` | 实时任职、页面准入、edge grant 与 catalog command 内复核 | `project-memory/decisions/confirmed-business-language-corpus.md#G-05A`; `doc/decisions/2026-08-08-v2s-catalog-inventory-scope-specific-write-capabilities.md` | 无准入不进入；无写能力保持只读；owner 拒绝越权保存。 |
| 入口范围 | 商品资料维护者 | 当前 dataNode、brand 与目标商品或新建商品草稿 | `ESTABLISHED_SOURCE` | operations-admin 当前工作上下文与 catalog detail | `project-memory/decisions/confirmed-business-language-corpus.md#G-05,#G-11` | 缺范围或 brand 时阻断；不得从 URL、名称、旧选择或条码猜测。 |
| 商品结构 | 商品资料维护者 | 当前 shape、item、SKU、选项组、选项值及其 displayOrder | `IN_SCOPE_PRODUCED` | 同一商品 Drawer 中的商品草稿与 owner readback | `doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-formal-requirements-codex.md#catalog-identification-production-guidance-formal-requirements` | 结构不合法时对应入口阻断；不得由识别/制作页补造 SKU 或选项。 |
| Identifier contract | 商品资料维护者 | 当前 shape 可用类型、规范化、唯一域与既有 readback | `IN_SCOPE_PRODUCED` | 本 Journey 的正式需求与后续 contract | 正式需求 §3 | 候选与即时校验不可用时不允许提交任意 type；owner 最终拒绝篡改。 |
| Production tag 候选 | 商品资料维护者 | 当前范围可供新绑定的制作处理标签及既有停用引用 | `ESTABLISHED_SOURCE` | fulfillment-production owner task read | 正式需求 §4.6；`contracts/policy/catalog-inventory-reference-path-matrix.json#R07` | 新候选失败时保留草稿并允许重试；不得回退自由字符串或内联创建。 |
| 版本与 readback | 商品资料维护者 | 当前 catalog version、最新 item/SKU/option identifier 与 profile facts | `ESTABLISHED_SOURCE` | catalog owner detail/readback | 正式需求 §5.2 | 冲突时保留用户草稿并展示 owner 结果；未知结果先读回，不盲目重试。 |

本 Journey 不含 `EXTERNAL_PREREQUISITE_DEXTER_DECISION`；没有以 seed、默认账号、默认 brand 或测试夹具替代业务前提。

## 4. 任务边界、非目标与禁推

- **范围内动作**：进入商品 Drawer；维护商品级 identifier；在 SKU 矩阵的具体 SKU 行维护 identifiers；维护商品制作默认；为具体 SKU 建立/编辑/清除完整覆盖；在具体点单选项值维护增量 effect；查看来源与摘要；随商品整体保存并处理校验、冲突和未知结果。
- **非目标**：扫码设备、称重条码解析、扫父码选 SKU、外部平台映射、打印规则/模板/打印机、KDS/队列/工作台、过敏原库、生产路由、库存/BOM、菜单与可售。
- **禁推**：
  1. 商品 code、skuCode 与外部身份不自动成为 identifier；
  2. 父商品 identifier 不产生默认 SKU，也不允许扫描时由 catalog 猜规格；
  3. identifier 被移除不改写历史订单/工作单快照；
  4. dataNode 下同码不能反推 brand；扫码调用方必须给 brand 上下文；
  5. SKU 的某个覆盖字段不等于逐字段继承；`OVERRIDE` 是完整 profile；
  6. option effect 不移除基础 tag、不减少时长、不成为完整 profile；
  7. production tag 可选不产生工作台、设备、队列或打印路由；
  8. UI 隐藏、前端校验和草稿结构均不替代 owner 的 shape、唯一、target、权限和版本复核。
- **禁止伪修复**：不保留 kind/code/value、skuBarcode、generic productionProfiles、stationTags、printTags、materialRole profile fallback、客户端 brand 猜测、默认 SKU 或双写兼容层。

## 5. Corpus 命中、替代方案与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 商品、SKU、点单选项 | `project-memory/decisions/confirmed-business-language-corpus.md#G-11` | 商品回答“是什么”，SKU 是规格单元，选项回答怎么做/加什么。 | 旧 generic 三层缺具体 target，已由正式需求替代。 | 已裁定，否 |
| 运营访问与写能力 | `project-memory/decisions/confirmed-business-language-corpus.md#G-05,#G-05A` | operations-admin 提供任务入口；读取和写能力分离；owner 终判。 | 无。 | 否 |
| Identifier 与制作信息 | V6 `05-商品目录域.md` §4.7、§4.13 | 采用 item/SKU/option identity，但收窄双写类型并补确定合并。 | V6 status/scope/estimatedDuration 与本期落地差异已在正式需求解释。 | 已裁定，否 |

### 5.1 方案比较

1. **方案 A：继续当前三个抽象页签编辑器**。代价最小但 target identity 仍不存在，无法回答正在改哪个 SKU/选项值，淘汰。
2. **方案 B：新建独立“识别码管理/制作信息管理”页面**。能容纳大表，但切断商品结构和 whole-save 上下文，制造第二套保存、版本与返回路径；本期集合规模也不需要独立管理页，淘汰。
3. **方案 C：同一商品 Drawer 内按事实归属就地维护**。商品 identifier 在识别页，SKU identifier 在 SKU 行；商品/SKU制作在制作页，option effect 在具体选项值；所有变更仍由 Drawer 一次保存。它最短、身份最清楚，并复用既有 Drawer 生命周期，采用。

### 5.2 反例边界

- 若未来单商品 identifier 达到需要独立搜索分页的规模，应新开 task read，不把当前 whole-save Detail 聚合伪装成列表；当前按商品/SKU整体维护是 `Detail 聚合`。
- 若未来同址多品牌的扫码入口无法提供 brand，上述唯一域无法消歧，必须重开 D-16；不得在本 Journey 增加“自动猜品牌”。
- 若 option 真正需要改变制作岗位，用 SKU 完整覆盖；若业务不能用 SKU 表达，重开 option 合并裁定，而不是加入 remove/priority。

## 6. UI 适用性与后续工件

`UI_BEARING=true`。用户必须看到具体商品/SKU/选项值、识别类型、覆盖来源、制作标签、时长和说明；不能仅依赖 contract/owner 拒绝完成任务。

下一工件使用 `doc/decisions/templates/ui-interaction-design-template.md`，低保真线框交 Dexter 看图。Dexter 确认前不写 IA 或 implementation-facing design。

## 7. Dexter 裁决

- **裁决**：接受；本 Journey 是已接受正式需求与八项产品裁定的用户任务落账。
- **精确范围**：operations-admin 商品 Drawer 内的 identifier、商品制作默认、SKU identifier/制作覆盖、选项值制作 effect 与 whole-save readback。
- **已知前提**：contract 是 shape/type/字段/合并的单一真相；前端只维护具体对象草稿；catalog owner 在保存事务内重新派生和复核。
- **未决项**：无产品语义未决；低保真线框已于 2026-08-23 获 Dexter 接受。
- **后续允许动作**：IA、implementation-facing design、串行计划与设计期独立复核；尚不允许 implementation、测试或运行。
