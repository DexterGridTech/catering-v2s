# 商品作废 BOM 引用语义：实施方案草案

```text
PLAN_STATUS=DRAFT_FOR_REVIEW
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=CATALOG_ITEM_VOID_BOM_REFERENCE_DESIGN_20260830
IMPLEMENTATION_AUTHORITY=false
SOURCE_OF_TRUTH=2026-08-30-v2s-catalog-item-void-bom-reference-implementation-design-codex.md
```

## 1. 实施前置

本方案只把已识别的根因拆成可执行步骤，不授权当前会话写生产代码或执行动态环境。每个步骤完成后，主 agent 必须用同一组需求/详设/IA/memory/owning source 做前后双读，并在进入下一步前接受 fresh 独立子 agent 的三维证伪式对账；全步骤结束后再做一次全批对账。

推荐方案是：inventory owner 分离自有定义和入向 BOM component reference；没有入向引用时在同一 `REQUIRED` 事务中停用自有 active definitions，再由 catalog owner 作废商品。

## 2. CP 顺序与文件责任

### CP-00：冻结问题与 change surface

重新打开：

- `doc/plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-problem-analysis-codex.md`；
- `doc/decisions/2026-08-30-v2s-catalog-item-void-bom-reference-journey-amendment.md`；
- `doc/plans/platform/2026-08-30-v2s-catalog-item-void-bom-reference-implementation-design-codex.md`；
- J-CIB-001 原 Journey/interaction/IA；
- `project-memory/decisions/confirmed-business-language-corpus.md`、`project-memory/operations/backend-acceptance.md`、`project-memory/decisions/independent-subagent-adversarial-review.md`；
- `CatalogOwnerService`、`InventoryOwnerApi`、`InventoryOwnerService`、当前前端 model/view、seed/L2 source。

输出一张实际命中表：每个 change fact 对应 contract、唯一 generator、backend owner、catalog coordinator、frontend model/view、focused test、acceptance、seed、L2；找不到 owning source 时停止并保留首败。

完成信号：A/B 方向图与 SKU sibling/option-value counterexample 均有源码证据，未把 A-05 mode-switch 规则混入 item void。

本 CP 同时必须把 status deletion surface 单独列出：reference `entries[].status`、candidate `items[].status`、BOM row reader、唯一 contract source、generated TS/backend wire、frontend model/label。Dexter 已裁决两个 status 字段均不保留；实施完成的判据是全链路删除且没有 `ACTIVE`/`ENABLED` 替代字段或 fallback。

### CP-01：修正 reference path 与生成输入

责任文件：

- `contracts/policy/catalog-inventory-reference-path-matrix.json`：保留 R13/R15 owner paths，明确 C02 `rows[*].targetRef` 是 inbound component lifecycle consumer；不添加重复矩阵；
- `scripts/generate/catalog-inventory-p1.mjs`：如需支持 C02 lifecycle metadata，只改 generator 的唯一校验/输出源；不得把 C02 伪装成 `InventoryCatalogReferenceDeclarations` column source；
- generator 产物：`InventoryCatalogReferenceDeclarations.java`、`contracts/catalog/catalog-inventory-edge-contract.json`、backend route registry、operations-admin generated TS。
- 按已裁决结果从唯一 contract source 删除 reference `entries[].status` 与 candidate `items[].status`，并由 generator 同步 edge contract、backend wire 与 operations-admin TS；同时删除 runtime reader/fallback、candidate hardcode、frontend model/view/label 与测试依赖，不新增替代 status。
- candidate 查询现有 JOIN `catalog.catalog_item` 可继续用于已有 item identity/name 等字段；本次不为 status 增加列读取、新 join、新 operation 或新查询。

完成信号：generator 从当前 source 一次重生成；生成物可反向定位 C02/新 reason，且两个 status 字段在 contract、generated、runtime、frontend、fixture、测试中无残留；无手工 generated edit、无新 HTTP operation、无 operation/budget 变化。

### CP-02：inventory owner 判断与退休 command

责任文件：

- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/api/InventoryOwnerApi.java`；
- `.../inventory/application/InventoryOwnerService.java`；
- owner 现有 lock/receipt/readback helper；
- `InventoryCatalogReferenceDependenciesIntegrationTest.java` 及新增/调整的 inventory lifecycle integration test。

实施要求：

1. 将 `catalogItemVoidDependencies` 的语义改为显式 `ownedActive*` 与 `inboundBomReferences`，不能保留 `hasDependentFacts = own count > 0` 的隐藏兼容逻辑。
2. 用一个 scoped set-based query 读取 subject 的 all-status target refs，并将 `ENABLED`、`DISABLED` 与 active BOM rows 的 `targetRef` 分流；过滤 definition status、row status、scope/brand、own-BOM owner；无法映射或 active row 命中 disabled target 时 typed fail closed。
3. 增加同事务 `retireCatalogVoidInventoryDefinitions` owner command；ENABLED→DISABLED、无物理删除、最终 readback、idempotency。
4. 复核 SKU subject；若纳入，按相同 typed subject 实现，不复制 item-only 分支。
5. 收口 `DISABLED` 历史快照边界：current/list/detail/mutation 只接受 ENABLED，canonical/legacy BOM component resolver 共用同一 state-aware admission；新增/改变引用要求 ENABLED + eligibility + unit snapshot，未改变既有引用只做 scope/identity 存在性并保留编辑豁免；保持 `catalogReferenceDependencies` 的 declared-column 责任，不把 JSON component scan 复用到错误语义。
6. 在同一版本/CAS 保存边界内读取持久化 row 的 `targetRef`，按 C02 直接对应 `stock_target.target_ref`，计算 submitted 与 existing 的关系差集；不添加 row id 或新的关系主键。新增/改变引用不能指向 `DISABLED`/非组件/无单位 target，未改变既有 disabled 引用不得因状态变化而阻断普通编辑；仍需核对重复 target、legacy alias 和关系顺序。

完成信号：owner integration 能证明 A 自有 definition 不 blocker、B inbound component blocker、disabled/history/scope/concurrency 反例全部成立；失败不产生任何部分写入。

### CP-03：catalog transition/detail/batch 协调

责任文件：

- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`；
- `.../catalog/application/CatalogInventoryCoordinator.java`；
- catalog owner API/operation readback mapper；
- 对应 lifecycle tests。

实施要求：

- `transitionItemState` 的 VOIDED path 先锁 catalog item，执行现有 catalog blockers，再调用 inventory owner retirement command，成功后才更新 catalog status；
- 单项、batch preloaded facts、detail `voidAvailability` 均不得再次用 `catalogReferenceDependencies(CATALOG_ITEM)` 解释 BOM；
- `appendItemVoidBlockingReasons` 移除 item void 的自有 `HAS_STOCK_CONFIGURATION`/`HAS_BOM_CONFIGURATION`，新增 `USED_BY_INVENTORY_BOM`；
- `canVoid` 与 blockingReasons 同源；`references` 保持 catalog composite 语义；
- SKU path 必须有明确同根处置；option value 保持现有 dedicated cascade，除非源码证明需要同步修正；
- 批量作废以 batch-start graph 为线性化观察点；A 的 active BOM 引用 B 时，即使 A、B 同批，B 仍按 active inbound reference 失败，不通过排序、预加载或先退休 A 释放 B；CP-03 必须实现该固定语义，不引入同批拓扑释放；
- 任何 owner readback 缺失/不一致都 fail closed 并 rollback。
- reference/candidate status 字段已裁决删除；不得保留 target definition、catalog item status 的替代投影或 `ACTIVE` fallback。

完成信号：A item transition 成功后 catalog=VOIDED、inventory active definitions=0；B transition typed 失败且 catalog/inventory unchanged；batch 以 batch-start graph 判定，不产生 preload-only false-green，也不通过同批拓扑释放 B。

### CP-04：contract 与 operations-admin

责任文件：

- contract source / operation response shape；
- `apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts`；
- `catalogManifestLabels.ts`；
- `CatalogItemGovernanceView.tsx` 及其 focused tests；
- generated TS 只能生成，不手改。

实施要求：

- 添加/生成 `USED_BY_INVENTORY_BOM` reason；只展示业务文案和来源摘要；
- 商品关联区与作废限制区不合并；自有 BOM 不再作为 item void warning；
- error/loading/unknown mapping 与现有 model decoder 保持 typed fail closed；
- 删除两个 status 字段后，model/view/decoder/label 不得保留残留引用或替代字段；candidate 现有 catalog item JOIN 只服务已有字段；
- 复用 foundation 的详情 surface、focus、overlay 行为；不增加第二个 drawer/入口。

完成信号：前端 model/view tests 能用 counterexample 证明 A 无库存自有 blocker、B 有入向 reason；没有 raw UUID、技术 kind 或 placeholder success copy。

### CP-05：验收与测试 change surface

责任文件/重点：

- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`；
- `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/operations/TransitionOperationsCatalogItemStatusOperationTest.java`；
- `CatalogCategoryOwnerIntegrationTest.java` 中现有 item/SKU void tests；
- `CatalogInventoryCoordinatorCopySourceAuthorityTest.java` 中 own inventory blocker assertions；
- `InventoryCatalogReferenceDependenciesIntegrationTest.java`；
- `InventoryTypedMutationCasIntegrationTest.java`、`InventoryBomBatchIntegrationTest.java`、`ResolvedBomTargetsTest.java` 中 disabled current target 与 canonical/legacy resolver 边界；
- `ResolvedBomTargetsTest.java` 必须覆盖：新增/改变 disabled target 拒绝、enabled component with unit 接受、跨 scope/非组件/无单位拒绝、未改变既有 disabled 引用允许无关字段编辑，以及 canonical/legacy parity；同时覆盖两个 status 字段全链路不存在、无 fallback/hardcode。
- `contracts/policy/catalog-inventory-api-scenarios.json` 的 CI-API-006 相关 fixture/case（如 contract 语义变更）；
- `apps/frontend/operations-admin/src/features/catalog-management/model/*test*`、`ui/*test*`。

业务 scenario 必须逐个写明：scope/identity、fixture creation channel、request/expected version、businessOracle、owner readback、failure unchanged facts、运行归属 `CatalogAcceptanceScenarios.java`；scenario 总数不设历史 80 条 cap，不能为保旧数字压缩 A/B/SKU/batch/rollback 覆盖；不以删除测试来制造全绿，不以 response status 替代业务断言。

完成信号：focused tests 真实覆盖所有 `findings`；没有测试仍把 own `HAS_BOM_CONFIGURATION` 当作 item void blocker，也没有只测 detail 不测 command 的半闭环。

status 相关测试必须证明：reference `entries[].status` 与 candidate `items[].status` 已从 contract/runtime/generated/UI/fixture 全链路删除；candidate 不再用 target definition `ENABLED` 作为替代字段。

### CP-06：seed fixture 与 readback 对账

责任文件：

- `contracts/policy/catalog-inventory-fixture-catalog.json`；
- `scripts/dev/catalog-inventory-seed-plan.mjs`；
- `scripts/dev/catalog-inventory-seed-executor.mjs` 及其 tests；
- 需要时更新 `scripts/dev/profiles/catalog-inventory.json` 的 parity/fixture declarations，但不得抬高预算或放宽校验。

新增最小 directed fixture（复用现有 fixture graph，不另造执行器）：

| fixture | 事实 | 预期 |
| --- | --- | --- |
| A-OWNER | A 使用无 SKU、无 identifier、无 production tag、无 catalog composite blocker 的普通 item；有 active target/BOM，B target 为 component | A 可作废并使自有 definition 变 DISABLED。 |
| B-COMPONENT | 被 A active row targetRef 指向，且自身没有其他 blocker | B detail 显示入向 reason，B 作废 422/unchanged。 |
| B-HISTORY | 仅被 disabled/history row 指向 | 不产生 current blocker。 |
| EXISTING-DISABLED-EDIT | 既有 BOM 引用的 target 后续变为 DISABLED | 无关字段编辑可保存；该 target 不回到候选；新增/改变引用仍拒绝。 |
| SCOPE-CONTROL | 同 ref/代码的其他 scope/brand | 不串 scope。 |

所有数据经 owner HTTP command/readback 建立；seed executor 不直接写数据库。seed 报告同时记录 business 与 cleanup；成功后由 detail、transition、inventory owner readback 三方对账。

完成信号：seed fixture 的关系方向与 current contract/生成物一致；A/B 结果与 focused/acceptance oracle 相同；无旧 fixture 继续宣称“自有 BOM 阻断作废”。

### CP-07：browser L2 与旧空间下线

责任文件：

- `contracts/policy/catalog-inventory-l2-scenarios.json`；
- `contracts/policy/catalog-inventory-l2-case-blueprint.json`；
- `contracts/policy/catalog-inventory-l2-locator-bindings.json`；
- `scripts/test/catalog-inventory-l2-fixture.mjs`、`browser-l2-catalog-fixture.mjs`、对应 browser runtime；
- 旧库存/商品详情入口的真实 router/navigation/source（CP-00 搜索后锁定，不凭截图猜路径）。

要求：

- 新增或改造最小真实 L2 case，使用 TEST owner HTTP setup，不消费 seed/API report；
- A 页面显示自有 BOM 不是 void blocker；B 页面显示“被其他商品用料引用”；
- 真实点击 transition 后验证 HTTP/business/readback/页面刷新；
- 旧空间重复入口下线或只保留到新权威入口的明确一次性 redirect；不得保留并列语义、旧 warning 或 fallback。

完成信号：L2 case 与 locator/fixture exact set 对齐，完整 run business 与 cleanup 均 PASS；当前文档阶段不执行。

### CP-08：验证顺序与收口

源码变更后严格按以下顺序（每项保留首败、日志、business/cleanup）：

1. 按已裁决结果完成两个 status 字段的 contract/source 删除设计落地；
2. 完成 backend/frontend owning-source 修改；
3. 按 owning generator 生成并校验全部生成物；
4. 运行仓内 `scripts/verify --validate-only`，确认静态/生成/边界门；
5. 再运行 focused backend/frontend tests；
6. backend acceptance（真实 HTTP/容器）并读日志和最终 owner readback；
7. browser L2（受管 runtime，A/B 同 run 业务证据）；
8. reset/seed/DEV restart 按已有独立授权和受管入口执行，seed 后重新对账；
9. 检查旧空间已下线、无重复 route/菜单/文案；
10. 全批三维回读与实施复核，最后才交 Dexter/Claude。

当前这份设计交付不运行以上动态步骤，不把未运行命令当作证据。

## 3. 停止条件

遇到以下情况立即保留首败并停止当前 CP，不用改文案、抬 timeout、加 fallback 或删除断言止血：

- `targetRef` 与 owner ref 无法在当前 scope 唯一映射；
- owner command 与 catalog status 不在同一事务/readback；
- A 作废后仍有 active inventory definition；
- B 入向 active BOM 未阻断；
- 两个已裁决删除的 status 字段仍存在于 runtime/contract/generated/frontend/fixture，或出现 `ACTIVE`/`ENABLED` 替代字段；
- 新增/改变引用的 disabled admission 与未改变既有引用豁免没有分别验证；
- generated source/edge registry/TS 不一致；
- seed/L2 使用旧空间或旧 fixture，或业务 PASS 但 cleanup 非 PASS；
- 发现新的产品/Journey 语义未由 Dexter 裁决；同批 A/B 已固定为不允许拓扑释放，不得通过实现改写。
