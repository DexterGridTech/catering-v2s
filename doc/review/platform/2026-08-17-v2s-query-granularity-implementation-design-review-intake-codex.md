# 查询粒度与重复读取整改 · Claude 设计复核 intake

- 日期: 2026-08-17
- 被审详设: `doc/plans/platform/2026-08-17-v2s-query-granularity-implementation-design-codex.md`
- 输入 review: `doc/review/platform/2026-08-17-v2s-query-granularity-implementation-design-review-claude.md`
- 本次权限: **只改详设与项目记忆文本**；不实施、不改契约/生成物/迁移，不运行 DEV、reset、seed、HTTP、L2 或 UAT。

## Intake

| finding | 状态 | 重开证据与处置 |
|---|---|---|
| M-1：单次读固定开销未 disposition | **CONFIRMED** | 重开 `InventoryOwnerService.currentTyped`：它确有 target、三次 period、recent、reference、ledger 的 owner read 形状；QG-04 只删 UI 的三个重复 HTTP summary 请求，未合并三次 owner period read。重开 2026-08-13 的 catalog historical PERF 裁定：它要求 catalog 六条各自写 QUERY disposition，但同时限定 DBCR 为 `TERMINATED_BY_DEXTER_SCOPE_REFRAME` 且不得扩到其余 finding。检索后未找到另一个已批准 batch 处置 `currentTyped` 固定开销。因此在详设 §0.5 明确记为“本轮不做，非 `QUERY_ALREADY_MINIMAL`”：不把历史 catalog 数值套入 inventory current，不重启 DBCR，不做动态测量，也不把 `DB_OPERATIONS` 变成门。 |
| S-1：QG-11 的五层契约成本没有摆出 | **DEXTER_DECISION** | 重开 operation、owner、edge/generated surface 和 UI：共享 response 目前服务 2 个 operation（详情 GET、配置更新）和 2 个直接 UI consumer（`InventoryDetailDrawer`、`InventoryActionModal`），故变更必须联动 OpenAPI、generated Java、generated TS/RTK、edge 与测试。详设 QG-11 现将该范围/批次标为 `DEXTER_DECISION`。另外源码修正 review 的收益口径：ledger 为 `LIMIT 100`、recent 为 `LIMIT 20`；但 `referenceReadbacks` 扫描同 scope `stock_bom` 后在应用层过滤，没有 SQL `LIMIT`。因此不得把全部收益写成“最多 100 行”。未获 Dexter 裁定，QG-11 不进入实施顺序。 |
| N-1：15/15 RECALL + failure condition 已落地 | **CONFIRMED** | 重读详设 15 个 CP：每项都包含 RECALL 与本项失败条件。无需修改。 |
| N-2：失败条件应点名错误形状 | **CONFIRMED** | 这是跨 CP 的可复用实践，不是单点文案。已新增 `project-memory/practices/failure-condition-names-the-wrong-shape.md` 并登记 `required-inventory.json`；它要求失败条件让空实现、宽读模型、逐项读取或全局失效等错误形状直接失败，同时保留正确性边界。 |
| N-3：QG-08 的唯一调用方没有未来机械守卫 | **CONFIRMED** | 当前 QG-08 的“仅由 `enrichInventoryTargets` 调用”是 implementation-time source assertion，不是未来全局保证。它不改变本轮边界；实施时必须将 `readInventoryDisplayFacts` 全调用方扫描作为同根检查，新增调用方须重开读模型设计。未伪造新 gate。 |

## 对 M-1 是否已被其他 batch 覆盖的结论

**未找到。** 唯一命中的同类材料是历史 DBCR/后台验收线：`doc/review/platform/2026-08-13-v2s-backend-acceptance-design-review-round2-claude.md` 与其 intake 将 QUERY disposition 限定在 catalog 的 6 条 historical PERF finding，并保持 DBCR 终止。它不是 `InventoryOwnerService.currentTyped` 的已批准处置，故 M-1 不降级。

## 证据档位

本 intake 只有源码、契约/生成物引用图、历史裁定和项目记忆的静态阅读。没有产生或宣称任何动态 QUERY、CONNECTION、TRANSACTION、HTTP、DEV、seed、L2、UAT 或 Testcontainers 结论。
