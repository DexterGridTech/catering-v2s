# 商品作废与库存 BOM 引用语义：外部设计评审处置记录

```text
DISPOSITION_STATUS=DESIGN_REVIEW_INPUT_PROCESSED
REVIEW_TARGET=DESIGN
SOURCE_REVIEW=doc/review/platform/2026-08-31-v2s-catalog-item-void-bom-reference-design-review-claude.md
REVIEW_CYCLE_ID=CATALOG_ITEM_VOID_BOM_REFERENCE_DESIGN_20260830
REVIEW_ROUND_LIMIT=2
IMPLEMENTATION_AUTHORITY=false
SOURCE_CONTRACT_GENERATED_RUNTIME_CHANGED=false
DYNAMIC_EXECUTION=NOT_RUN
```

## 1. 评审边界

本记录处置 2026-08-31 外部只读设计评审的 findings。评审原结论为 `NO-GO, M=1 / S=1 / N=2`，范围是问题分析、implementation-facing 详设和实施方案；评审明确没有授予源码、contract、generated output、migration、runtime、DEV、reset、seed、L2、数据或 Git 操作授权。

本轮只修订上述设计材料并保留未决裁决，不把静态设计处置写成动态通过。此前同一 `REVIEW_CYCLE_ID + REVIEW_TARGET` 的独立子 agent 已达到两轮上限，不能用换文件名或局部修订召集第三轮；本记录也不伪装成新的独立 verdict。

## 2. Finding 辩证处置

### 2.1 M-1：reference/candidate status 与当前字节不绑定

分类：`CONFIRMED`；reference status 的业务含义：`DEXTER_DECISION`。

已回到 owning source 核实：

- `InventoryOwnerService.references` 从 BOM JSON row 读取 `status`，缺失时默认 `ACTIVE`；当前 BOM row writer 未证明会写入该字段。
- `InventoryConsumptionReferencePage.entries[].status` 的 contract/generated union 是 `ENABLED | DISABLED | VOIDED`，与 runtime 的 `ACTIVE` fallback 不相交。
- `InventoryOwnerService.consumptionTargetCandidates` 的查询条件证明的是 `stock_target.definition_status='ENABLED'`、component eligibility 和消费单位；投影却硬编码 `status='ENABLED'`，而 contract 将该字段描述为 component catalog status。
- 因而这里至少有三种不能互相冒充的事实：BOM reference row status、stock target definition status、catalog item lifecycle status。问题不是把 `ACTIVE` 补进 union 或把一条文案从 `VOIDED` 改成 `DISABLED` 就能关闭。

处置：详设与实施方案新增 status contract gate。先由 Dexter 决定 reference status 是否有已批准业务用途：

1. 如果没有，删除 reference status 及其 runtime reader/writer、contract/generated shape、frontend model/label 和测试依赖，是更小且更诚实的方案。
2. 如果保留，必须先定义 reference status 的 owner、写入来源、readback、历史/失效边界和闭集；再从唯一 contract source 修改，并由 owning generator 同步 backend wire、edge contract 和 operations-admin generated TS。
3. candidate status 不得继续用 target definition eligibility 硬编码冒充 catalog item status；若保留，必须从 catalog owner fact 读取，target eligibility 仍作为独立 admission 条件。

在裁决前不新增 `ACTIVE`、不缩窄/扩展 union、不改 label、不手工编辑 generated 文件。这个 decision 不改变商品作废的 A/B owner/component 业务方向。

### 2.2 S-1：BOM resolver 只校验存在性

分类：`PARTIALLY_CONFIRMED`。

确认部分：`ResolvedBomTargets` 当前只按 scope/brand 验证 target 存在，因此新增或改变的 BOM 引用可以指向已经 `DISABLED`、不具备 component eligibility 或缺少有效消费单位快照的 target。

不直接采纳的部分：无条件在 resolver SQL 加 `definition_status='ENABLED'` 会破坏既有 `EXISTING_REFERENCE_EXEMPT_FROM_STATUS_CHECK` 规则。未改变的既有引用即使目标后来被停用，也必须允许商品编辑无关字段；它不能重新出现在候选列表，也不能被当作新的 current operational target。

最小根因修复：canonical 与 legacy 两个 `saveCatalogProductBom` 入口共用一个 state-aware resolver，并在同一版本/CAS 保存边界内取得当前 BOM 关系后计算关系差集：

- 新增或改变的 target ref：要求当前 scope/brand、`definition_status='ENABLED'`、component eligible、有效消费单位快照；失败继续使用 `REFERENCE_MAPPING_UNRESOLVED`（除非 contract source 另有已批准的更细 typed reason），fail closed。
- 未改变的既有 target ref：只做 scope/identity 存在性与关系一致性校验，按既有引用豁免保留；不能因后续 `DISABLED` 直接阻断普通编辑。
- 不凭空添加 row id 或新的关系主键；关系身份必须由真实 BOM JSON/command contract 证明。

因此，单纯“把 `ENABLED` 加进查询”的方案比 state-aware admission 更小，但不完整，会把一个已确认的新增引用漏洞换成既有引用编辑回归，不能作为交付修复。

### 2.3 N-1：`targetRef` 的两跳路径

分类：`CONFIRMED` 且不构成设计缺陷。保留 `targetRef -> inventory.stock_target.target_ref -> stock_target.item_ref -> catalog item` 两跳语义。不得把 C02 JSON component path 改写成直接 catalog item 引用，也不新增重复 path matrix。

### 2.4 N-2：同批 A/B 的拓扑释放

分类：`DEXTER_DECISION`，维持原状态。当前设计继续以 batch-start graph 为观察点，不通过先退休 A 释放 B；未获得裁决前不实施或固化 batch 语义，也不把该项混入 M-1/S-1 修复。

## 3. 已修订的材料

已在以下材料中同步上述处置：

- [问题分析](../../plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-problem-analysis-codex.md)：补入 status writer/reader/contract/candidate 同根扫描、S-1 的既有引用豁免边界、finding 分类、通用失败模式和反例条件。
- [implementation-facing 详设](../../plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-implementation-design-codex.md)：重写 `DISABLED`/status 段落，新增 BOM 保存 admission 分流，补充 status contract gate、resolver focused tests 和 HTTP oracle。
- [实施方案](../../plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-implementation-plan-codex.md)：把 status decision 放在生成链之前，明确 `ResolvedBomTargets` 的 change surface、fixture、测试和停止条件。

这些修改没有新增业务 operation、数据模型、预算例外、阈值或 HTTP route，也没有修改 Journey amendment 中已有的 Dexter 裁决项。

## 4. 本批未做与延期项

| 项目 | 状态 | 原因 |
| --- | --- | --- |
| reference status 的 contract/source/generator 修改 | 延期 | owner/source、writer/readback、历史边界和闭集尚未由 Dexter 决定；猜测性加 `ACTIVE` 或删除字段都会制造新语义。 |
| candidate status 的 runtime/contract/generated 修复 | 延期 | 必须先分离 catalog lifecycle 与 target eligibility，再按唯一 owning source 生成；当前没有实现授权。 |
| `ResolvedBomTargets` 及两个 BOM 保存入口源码修改 | 延期 | 需要在真实 command contract 下确定 existing relation identity，并落实 state-aware admission；当前仅完成设计修订。 |
| contract/generated TS/backend wire 重生成 | 未做 | 没有完成 status decision，且本批 `IMPLEMENTATION_AUTHORITY=false`。 |
| focused/backend acceptance/frontend tests | 未做 | 设计评审材料修订不等于实施验证；没有把静态文档改动冒充测试 evidence。 |
| `scripts/verify`、DEV、reset、seed、browser L2、旧空间下线 | 未做 | 均属于后续实施/动态验证范围；本轮无相应授权，且 status decision 和 source implementation 仍是前置条件。 |
| 第三轮 independent subagent review | 不做 | 同一 review cycle 已达到两轮上限；后续只能在 Dexter 实质改变 scope/authority/target 后建立新 cycle。 |

## 5. 后续准入顺序

1. Dexter 裁决 reference status：删除，或保留并给出 owner/source、writer/readback、历史边界和 closed set。
2. 按修订后的 CP-01/CP-02 回到 contract、BOM writer/reader、candidate projection、`ResolvedBomTargets` 和两个保存入口，先做源码 change-surface 对账。
3. 仅在实施授权后修改 owning source，并由 generator 生成所有 generated output；随后按 `scripts/verify --validate-only`、focused tests、backend acceptance、L2、seed/readback 的顺序验证。
4. 动态证据必须证明同一业务关系下：新增/改变 disabled 引用被拒、未改变既有 disabled 引用可编辑、candidate status 与其 owning fact 一致、reference status 没有 `ACTIVE` 越界，并分别报告 business 与 cleanup。

当前材料可以进入下一次 Dexter 决策，不可以进入源码实施或动态 GO。
