# 商品作废与库存 BOM 引用语义：Round 2 裁决处置

```text
DISPOSITION_STATUS=DEXTER_DECISIONS_ACCEPTED_PENDING_IMPLEMENTATION
SOURCE_REVIEW=doc/review/platform/2026-08-31-v2s-catalog-item-void-bom-reference-design-review-round2-claude.md
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=CATALOG_ITEM_VOID_BOM_REFERENCE_DESIGN_20260830
VERDICT=GO
M/S/N=0/0/3
IMPLEMENTATION_AUTHORITY=false
SOURCE_CONTRACT_GENERATED_RUNTIME_CHANGED=false
DYNAMIC_EXECUTION=NOT_RUN
```

## 1. 已接受的三项裁决

### 1.1 不保留 reference row status

删除 `InventoryConsumptionReferencePage.entries[].status`。实施范围必须覆盖唯一 contract source、runtime reader 与 `ACTIVE` fallback、backend wire、edge/generated output、operations-admin model/view/label、fixture 和测试；不得用 `ACTIVE`、`ENABLED` 或其他字段替代该 status。

### 1.2 不保留 candidate status

删除 `InventoryConsumptionTargetCandidatePage.items[].status` 及当前 candidate projection 的硬编码 status。现有 candidate query 已 JOIN `catalog.catalog_item`，该 JOIN 只继续服务已有 item identity/name 等字段；本次不增加 status 列读取、新 JOIN、新 query 或新 operation。`stock_target.definition_status='ENABLED'` 仍是候选 admission 条件，不再被投影成 catalog status。

### 1.3 不允许同批 A/B 拓扑释放

批量作废以 batch-start graph 为线性化观察点。若 A 的 active BOM 引用 B，即使 A、B 同批，B 仍然因为 active inbound reference fail closed；不得通过排序、预加载或先退休 A 释放 B。CP-03 按该固定语义实施，不再作为未决产品选择。

## 2. 评审结论与证据边界

Claude Round 2 的静态结论为 `GO, M=0 / S=0 / N=3`。该结论确认当前设计材料可以作为后续实施输入，不等于源码已修改或实施结果已接受。

本轮没有修改源码、contract、generated output、migration、测试、fixture、seed、L2 或运行环境；没有运行 DEV、reset、seed、browser L2、backend acceptance、UAT、部署或数据操作。Round 2 披露的 HTTP 结果和所有动态行为仍属于 `UNVERIFIED_REQUIRES_EVIDENCE`，不得由文档承诺替代。

N-1 candidate status 的最小 owning fact 已记录在详设：如果 status 字段仍存在，现有 `catalog.catalog_item` JOIN 可提供来源；但本次裁决明确删除该字段，因此不会增加该列或保留字段。N-2 关系差集已有 `targetRef` 身份依据，不新增 row id。N-3 的 `CatalogOwnerService.IDENTITY` 未命中同一 closed enum，属于另一 status 族和本设计范围外问题，不纳入本批。

## 3. 实施准入与未决项

上述三项已可进入实施，但仍不构成实施授权。实施时必须按修订后的 CP-01/CP-02/CP-03/CP-04/CP-05 落实，并先完成：

- 两个 status 字段从 contract、runtime、generated、frontend、fixture、测试的全链路删除；
- canonical/legacy BOM resolver 的新增/改变与未改变既有引用分流；
- batch-start graph 下不做同批拓扑释放；
- `scripts/verify --validate-only` 必须在测试之前运行，随后按详设 CP-08 完成 focused tests、backend acceptance、L2、seed/readback 与旧空间核验。

Journey 层仍有一项未决：是否接受商品作废时自动退休其自有 active inventory definitions。该项未被本次三项裁决覆盖，实施者不得自行改变。
