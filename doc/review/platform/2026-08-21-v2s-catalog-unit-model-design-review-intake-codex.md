---
title: 商品计量、销售单位与库存单位优化 · DESIGN 盲审作者 intake
status: HOLISTIC_REVIEW_PENDING
---

# 独立盲审后的作者 intake（不是独立 verdict）

```text
REVIEW_CYCLE_ID=UNIT-MODEL-DESIGN-20260821
REVIEW_TARGET=DESIGN
REVIEW_ROUND_LIMIT=2
SOURCE_REVIEWER=/root/unit_design_blind_review
SOURCE_VERDICTS=ROUND_1:NO-GO(M=2,S=3,N=1); ROUND_2:NO-GO(M=2,S=2,N=1)
AUTHOR_ROLE=仅逐条复核、分类和修订；不代写独立 verdict
```

| finding | 作者处置 | 复核依据与动作 |
| --- | --- | --- |
| Round-1 M-01 / Round-2 M-01：`<100` 与第101条检测位冲突 | `CONFIRMED` | Dexter 已定“上限小于100”。Journey、UI、IA、详设、计划统一为最多99条、`LIMIT 100`、第100条拒绝；不再存在允许第100条的“≤100/101”表述。 |
| Round-1 M-02：目标精度被当成源输入精度 | `CONFIRMED` | 删除“输入最多显示目标 precision”的设计。新增 `U-UNIT-DESIGN-02`：源数量的业务含义仍需 Dexter 选择；最终目标向零截断保持不变。 |
| Round-2 M-02：以 inventory task read 放行 catalog mutation | `CONFIRMED` | 列表继续使用 `readCatalogUnitUsageSummaries`；update/delete 改为同一 REQUIRED 中的 `validateCatalogUnitLifecycle(unitRef,intendedChange)` 公开 judgement command，并要求 inventory 所有新增/改写 unit reference 使用同一 unitRef advisory lock。catalog 不直查 inventory schema。 |
| Round-1 S-01：无来源的最大精度 | `CONFIRMED` | UI 改为非负整数输入、无预设业务最大值；不把技术存储上限冒充产品规则。 |
| Round-1 S-02 / Round-2 S-01：盘点候选维度不一致 | `CONFIRMED` | `STOCKTAKING_UNIT` 固定以 target 消耗单位类别调用 `listOperationsCatalogUnits(..., dimension=...)`，UI、IA、详设均保留 inventory 最终复核。 |
| Round-1 S-03 / Round-2 S-02：候选协议缺字段 | `CONFIRMED` | 交互工件新增 `subjectType`、依赖、查询、取消/重读、返回，以及 `queryText/page/pageSize/consistencyToken/dependencies/items` 的显式 Bounded 值。 |
| Round-1/2 N-01：all-v2 静态基线未登记 | `UNVERIFIED_REQUIRES_EVIDENCE` | 已只读扫描 Heritage；当前没有可直接登记的 catalog/inventory unit UI counterpart。保留为整体审阅时补证或明确 `NO_V2_COUNTERPART` 的非阻断项；不以 v2s 当前组件伪造 all-v2 `path@SHA`。 |

## 仍需 Dexter 在整体审阅时裁决

1. `U-UNIT-DESIGN-01`：已有非零余额库存对象的有效基础计量单位变更。
2. `U-UNIT-DESIGN-02`：`0.3567kg → 356g` 中的源数量是用户输入还是系统转换数量，以及源输入单位精度如何约束。

除上述两项和未验证线框外，本 intake 不授予实现、契约、数据库、seed、DEV 或运行权限。
