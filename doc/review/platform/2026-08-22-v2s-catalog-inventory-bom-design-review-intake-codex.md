# 商品库存与 BOM 业务模型 · DESIGN review 作者辩证 intake

```text
REVIEW_CYCLE_ID=CIB-BUSINESS-MODEL-DESIGN-2026-08-22
REVIEW_TARGET=DESIGN
REVIEW_ROUND_LIMIT=2
AUTHOR_ROLE=逐 finding 重开 owning source、分类、比较最小修复并修订；不代写独立 verdict
ROUND_1_SOURCE=doc/review/platform/2026-08-22-v2s-catalog-inventory-bom-design-independent-review-round-1.md
ROUND_1_VERDICT=NO-GO(M=1,S=1,N=0)
ROUND_2_SOURCE=doc/review/platform/2026-08-22-v2s-catalog-inventory-bom-design-independent-review-round-2.md
ROUND_2_VERDICT=GO(M=0,S=0,N=0)
REVIEW_CYCLE_FINAL=GO
```

## Round 1 findings 处置

| finding | 作者处置 | source-backed 辩证判断 | 修订 |
|---|---|---|---|
| M-01：A-05“历史快照”没有可执行权威事实源 | `PARTIALLY_CONFIRMED` | reviewer 正确指出原稿把术语直接写成 `disabled definition snapshot`，却没有表/列/query、与另三维差异、命令时序和 fixture，实施者会猜；这一部分确认。reviewer 以“当前 source 中 `definition_status=0` 命中”推导必须另找既有事实源的部分不成立，因为 additive migration 本来就是本设计拟建立的 owner fact。正式需求 A-05 已逐字裁定“停用旧定义并切换”且“历史依赖阻断”，所以把**命令开始前已有的 DISABLED StockTarget/ProductBom definition**定义为历史定义快照，是该裁定的最小可执行化，不是新增产品语义，也不需要第三表。 | 正式需求 A-05 增加术语澄清；Journey/interaction/IA 同步；详设新增 §8.1 四维权威事实表，固定表/列、PRESENT/ABSENT、差异、lock/query时序、`blockingFacts` 和 fixture；migration 声明旧行只回填 ENABLED、后续 DISABLED immutable；acceptance 用首次成功切换产生历史、第二次反向切换拒绝。serial CP-02/05同步。 |
| S-01：CP-07 无 RECALL | `CONFIRMED` | serial 总则要求每个可写改点按所在 CP 双读，而 CP-07 允许首败修 owning source，却漏写自身 RECALL，确实会产生脱锚“修门”入口。 | serial CP-07 新增 RECALL：必须回到触发失败的原 CP，读取需求/IA/详设、owning source、首败日志/last known good、denominator、self-test/red fixture；修复和 proof 回流原 CP 双读后才继续全链。 |

## Claude 外部设计复核处置

Claude 的独立 design review（`2026-08-22-v2s-catalog-inventory-bom-design-review-claude.md`）结论为 `GO`，`M/S/N = 0/2/2`。两条 S 均为文本与可复核性修订，不改变已接受的业务语义或授权边界，处置如下：

| finding | 判断 | 处置 |
|---|---|---|
| S-1：CP-00 只数静态注解，未要求实际 discovery 与 77/80 分母对账 | `CONFIRMED` | CP-00 增加 `BackendAcceptanceScenarioCatalog.discover(this)` 的真实 discovery 对账；CP-05 明确新增前三先验为 `annotated == discovered == selected == 77`，新增后三者为 `80`，差集按 scenario id、owner 文件和行号输出并停机。 |
| S-2：详设 §9b 两个 owning-source 锚点已漂移 | `CONFIRMED` | `shapeAdmission` 修为 `shapeNodeAdmission`；`writeCatalogUnitSnapshots` 修为 `writeItemUnitSnapshots` 与 `writeSkuUnitFacts`，避免实施者误建第二处准入或快照写入点。 |

本次文本修订后未重新执行 acceptance、discovery、Testcontainers、DEV、reset、seed 或实现代码修改。Claude review 中记录的未验证项保留不变：八维证伪 workflow 本轮无产出，未纳入结论；其余未验证项仍按该 review 的清单管理。内部 Round 2 的 `GO 0/0/0` 保留为修订前的历史程序记录，不把它改写成对本次外部修订的第三轮内部 verdict。

## 最小替代比较

| 方案 | 结论 | 理由 |
|---|---|---|
| 新建第三张 deduction history 表 | 拒绝 | 两张 owner 表的 DISABLED 行已能保存旧 configuration/rows/unit snapshots/version；第三表形成第二历史真相并增加同步。 |
| 把 ledger 或单位快照统称历史维度 | 拒绝 | ledger 已是独立 blocker；单位快照只说明单位含义，不证明此前存在另一扣减方式。 |
| 每次只查当前 active 行，允许来回切换 | 拒绝 | 会重新启用/改写旧定义，违反 A-05“历史依赖阻断”和不重解释历史。 |
| pre-existing DISABLED definition | 采用 | 直接复用 A-05 明定的“停用旧定义”，首次切换不自阻断，之后的自动回切被稳定事实拒绝；owner 与事务边界清晰。 |

## 修订后待 Round 2 核验

1. `HISTORICAL_DEFINITION` 是否已在需求、Journey、interaction、IA、详设、serial 中逐层一致，且没有把当前命令新停用行算成 blocker。
2. 四维表是否给出可实施 query/lock、problem details 和正反 fixture，不需要实施者再猜。
3. CP-07 RECALL 是否覆盖所有允许修改的失败路径并回流原 CP 双读。
4. 修订是否引入未经 Dexter 接受的强制治理动作、第三表、fallback 或新业务范围。

本 intake 不授权 implementation、测试、DEV、reset、seed、browser L2、UAT、部署或数据操作。

## Round 2 最终对照

fresh reviewer 在先独立复验、后读取本 intake 后，接受 M-01=`PARTIALLY_CONFIRMED` 与 S-01=`CONFIRMED` 的处置，确认六层 `HISTORICAL_DEFINITION`、四维事实表、首次/第二次切换 fixture、migration immutable 规则及 CP-07 RECALL 均闭合；最终 `GO，M/S/N=0/0/0`。本 cycle 已达到 2/2 轮硬停止，不再召集第三轮。
