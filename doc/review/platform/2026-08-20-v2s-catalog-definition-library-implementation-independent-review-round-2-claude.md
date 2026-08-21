# 商品属性库、点单选项库与两步新建 — implementation 独立对抗审查 Round 2

```text
REVIEW_CYCLE_ID=CATALOG_DEFINITION_LIBRARY_IMPLEMENTATION_20260820
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-08-20-v2s-catalog-definition-library-implementation-review-round-2-input-checklist-claude.md
reviewerInputChecklistSha256=ba7e9c7fa0298979b2b2b73baf5404db911d3e0f3861efdbc7b705664a40548b
blindReviewDeclaration=FRESH_INDEPENDENT_ROUND_2; ROUND_1_VERDICT_AND_DISPOSITION_USED_ONLY_AS_ATTACK_LIST
ROUND_FINAL_DECISION=SELF_DECIDED
```

本轮是该 `REVIEW_CYCLE_ID` 的最终独立审查轮次。Round 1 的三个 finding 先按当前源重开，再检查本批同根的契约、generated、前端、owner、迁移、acceptance 与受管动态证据；没有把作者 disposition、静态通过或旧 verdict 当成当前事实。不得再建立第三轮。

## 1. 审查边界与固定结论

**NO-GO — `M=2 / S=4 / N=1`。**

当前仍开放的 implementation finding：

| ID | 严重度 | 状态 | 结论 |
| --- | ---: | --- | --- |
| M-01 | M | `CONFIRMED` | operations-admin 点单选项定义 Drawer 只保存每个值的第一条原料；编辑一个拥有多条原料的定义会静默丢失其余原料。 |
| M-02 | M | `CONFIRMED` | Round 1 M-03 的逐实际变更点前读/后 proof 记录缺口被 disposition 明确保留；当前输入仍没有可审计的完整双读 ledger。 |
| S-01 | S | `CONFIRMED` | 品牌复制 hard-block 的 owner 语义存在，但 brand preflight/execute edge problem-code 闭集漏注册 `CATALOG_COPY_DEFINITION_CONFLICT`，且 UI 没有把 owner 的 `CATALOG_ORDER_OPTION_DEFINITION` 映射为“点单选项”。 |
| S-02 | S | `CONFIRMED` | 库定义 mutation 只失效库列表、商品列表和 inventory target page，没有失效当前商品 detail；打开商品 detail 时定义名称/值/原料快照可继续陈旧。 |
| S-03 | S | `CONFIRMED` | 原料候选查询硬编码 `pageSize: 200`，没有 `useCursorCandidates` 或 cursor 收集；第 201 个可用 inventory 商品无法在定义 Drawer 中被选择。 |
| S-04 | S | `CONFIRMED` | acceptance 没有执行设计要求的“改变后的组/值编码拒绝”红夹具，也没有 order-option same-code copy conflict 与 option-value BOM/reference 映射的业务 oracle。 |
| N-01 | N | `UNVERIFIED_REQUIRES_EVIDENCE` | 生产 main path 已清除 legacy 表/JSON 路径，但 catalog integration test 仍直接查询已退役的 `catalog_order_option_group/value` 与 `orderOptions` JSON；当前完整 acceptance 通过不能证明该未注册测试路径已清理。 |

`CATALOG_COPY_DEFINITION_CONFLICT` 的 owner hard block 本身不是本轮 finding：owner preflight/execute 都重新比较 definition shape，UI 也禁止确认/执行。S-01 是 contract registration 与用户可定位文案的闭集缺口。

## 2. Round 1 finding reconciliation

| Round 1 finding | 当前独立结论 | 证据 |
| --- | --- | --- |
| M-01：点单组选项/值没有可执行业务编码 | `REJECTED_WITH_EVIDENCE`（仅静态闭合；动态改变编码红夹具仍缺） | `V20260820_010000_002__catalog_order_option_definition_business_codes.sql:1-43` 增加 group/value code 与唯一约束；generated TS `catalog-inventory-edge.ts:143,162-165` 已带 code/materials；owner update 对既有 value code 变更抛 `VALIDATION_ERROR`，组 code 不在 update command。 |
| M-02：legacy free JSON/item-owned option runtime chain | `REJECTED_WITH_EVIDENCE`（生产 main）；测试债务另列 N-01 | `V20260820_010000_001__retire_item_attribute_json_and_order_option_relations.sql:1-10` 删除旧列/表；`CatalogOwnerService.java:3040-3041,3117,3633-3639,6151-6167` 拒绝旧 raw input、去除 relational sections 并由 typed relations rehydrate；当前生产 main 对旧表/字段无命中。 |
| M-03：逐变更点前读/后读留痕缺失 | `CONFIRMED`（仍开放） | Round 1 disposition `:19` 明确保留该治理缺口，且当前 Round 2 输入没有逐一绑定实际变更点、原始需求/IA、memory、owning source、focused proof 和 proof 后回读的完整记录。 |

## 3. Action 1-A — 当前源码事实提取

| Surface | 当前可渲染/可执行事实 | 判定 |
| --- | --- | --- |
| Legacy removal | 迁移删除 `catalog_item.attributes`、`catalog_order_option_group/value`；owner 只 rehydrate `attributeAssignments`/`orderOptionConfigs` 并拒绝 `attributes`/`orderOptions` raw payload。生产 main 不再引用旧路径；test-only SQL 残留见 N-01。 | 静态 PASS（N-01 除外） |
| Immutable option codes | group/value code 已进入 DB、OpenAPI/generated create/readback；group update command 不接收 code，既有 value 的 code mismatch 被 owner 拒绝；前端 edit 禁用 group/value code。 | 静态 PASS；required negative acceptance 缺失，见 S-04 |
| Definition aggregate / bound | `CatalogDefinitionFacts.BOUNDED_LIST_LIMIT=500`，两个 list SQL 使用 `LIMIT 501`，`requireBounded` 返回 `CATALOG_DEFINITION_LIMIT_EXCEEDED`；前端表格无分页。 | 静态 PASS；最新真实 acceptance 通过 |
| Owner / transaction | catalog owns definition/assignment/configuration facts；`CatalogInventoryCoordinator` 的 create/update/delete/local copy/brand copy 均在默认 `@Transactional` REQUIRED 内，inventory 只经 `InventoryOwnerApi` resolve target/delete BOM/copy command。 | 静态 PASS |
| Local `ORDER_OPTIONS` copy | `planOrderOptionCopy` 按 group/value code 比较 mode、value code/name/order 与 material identity；`copyOrderOptionConfigs` 写 target definition/value/material template 并重写 item config；coordinator 后续调用 inventory owner。 | 静态 PASS；acceptance 只断言 target config 非空，未证明完整 BOM/reference 映射，见 S-04 |
| Brand copy hard block | `CatalogOwnerService:4435-4494,7142-7178` 在 preflight 产生 `BLOCKED`，execute 再计划并拒绝；`BrandCatalogCopyDrawer.tsx:465-492,545-565,613-630` 禁用 confirmation/execute 并显示 blocked rows。 | Owner/UI 静态 PASS；contract/UI vocabulary closure 见 S-01 |
| Definition UI material editor | generated contract 的 `materials[]` 被 Drawer 的 `materialItemRef?: string`、`value.materials[0]` hydration 和单元素 submit 映射覆盖。 | M-01 |
| Latest managed dynamic | run `r5-tc-1787224951000-11286` manifest 的 `testExecution.status=PASS`、`cleanup.status=PASS`；相关 rows `catalog.order-option-definition-create-update`、`catalog.order-option-definition-list-limit`、`catalog.copy-definition-semantic-conflict`、`catalog.local-copy-section-outcomes` 均 `business=PASS`, `contract=PASS`, `businessMode=REAL`。 | HTTP/Testcontainers PASS；不关闭静态缺口或 UI L2 |

## 4. Open findings

### M-01 — 多原料定义在编辑保存时静默丢失原料

**Classification:** `CONFIRMED`; **tier:** L1/L2 source-visible user behavior; **severity:** M.

当前 generated contract 明确允许一个值的完整 `materials[]`：
`apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.ts:143,162-165`。后端也按集合 readback 和 replace 保存：`CatalogDefinitionFacts.java:163-180,190-220`，并且 FR-OPT-05 要求一个库值拥有 `1..n` 个强制原料、交互稿要求右侧 `ProFormList` 多行原料（`formal-requirements-analysis-codex.md:70-77`、`ui-interaction.md:268-299`）。

但 `CatalogDefinitionLibraries.tsx:264-269` 的 form 类型只有 `materialItemRef?: string`；`286-300` 从服务端只取 `value.materials[0]`；`306-320` 保存时最多发送一个 material。一个已有两条原料的值只要打开并保存，第二条及以后就不在 request 中，owner 的整集合替换会永久删除它们。这里不是“当前浏览器尚未证明”，而是读写映射的确定性数据损失；没有 L2 也不改变静态结论。

**Same-root scan:** 已检查该 feature 的 form type、create/edit hydration、candidate collection、rendered field、submit body、generated `materials[]`、catalog owner read/write、商品侧 `OrderOptionsEditor`（`CatalogItemDrawer.tsx:4708-4715,4791-4804` 能遍历全部 materials，证明问题集中在 definition library editor）。剩余 **0** 个当前点单选项定义编辑入口未检查；UI 的 multi-material 本身没有第二实现。

**Minimum repair:** 将 Drawer 草稿改为当前 value 的 `materials[]`，按交互稿提供当前可选项的可增删多行原料和只读单位，并用 focused red test 先证明两条原料 round-trip；不得把后端集合压缩为单值或由前端推断 material identity。

### M-02 — 实际变更点没有可审计的前读 / proof 后读双读记录

**Classification:** `CONFIRMED`; **tier:** L1 governance; **severity:** M.

Round 1 disposition (`2026-08-20-v2s-catalog-definition-library-implementation-round-1-disposition-codex.md:19`) 已诚实保留 M-03，称从 M-02 修复之后按 owning source/需求/同根扫描记录；但本轮可审计输入仍只有总览文档、当前源码与 test/run artifacts，未提供每个实际 production/contract/generated/migration/frontend/acceptance 变更点的：原始条目与 IA、六维 memory、owning source/reuse source 的写前记录、focused proof、同一组原文写后回读结果。不能把本轮 reviewer 自己的总览阅读或 acceptance PASS 倒推为历史 pre-read proof。

**Same-root scan:** 以本批 serial plan 的 CP-02 至 CP-06 变更面（migration、owner、coordinator、contract/generated、operations-admin、acceptance）为有限全集检查；当前不存在一份覆盖这些点的双读 ledger，剩余 **all actual change points** 均未可审计。

**Minimum repair:** 保留为治理 finding；后续工作只能补真实、逐点、可复核的 source-read/proof-read 记录，不能追溯制造历史证据，也不能用新增 receipt/hook 枚举替代根因控制。

### S-01 — copy hard-block 的 edge problem-code 与用户业务词未闭合

**Classification:** `CONFIRMED`; **tier:** L1 contract + L2 user-visible source; **severity:** S.

Owner 确实产出 `CATALOG_COPY_DEFINITION_CONFLICT`：
`CatalogOwnerService.java:4460-4494,7166-7178`。OpenAPI generic schemas/policy 也包含该 code。但 generated edge operation registry 的 brand-copy 闭集漏了它：`contracts/catalog/CatalogInventoryEdgeWire.java:44-45` 的 preflight/execute `problemCodes` 没有 `CATALOG_COPY_DEFINITION_CONFLICT`，同样的 route entries 在 `contracts/catalog/catalog-inventory-edge-contract.json` 的 brand-copy operations 处漏记。于是当前 source 同时声称“owner 会返回该 typed problem”和“该 operation 不允许该 problem code”。最新 HTTP acceptance 的 attribute conflict 返回 PASS 只能证明当前 advice 没有运行时强制 registry 闭集，不能消除契约漂移。

同一 hard-block 链的 UI business vocabulary 也断了：owner compatibility row 使用 `CATALOG_ORDER_OPTION_DEFINITION`（`CatalogOwnerService.java:4488-4493`），而 `catalogModel.ts:682-700` 只映射 `ORDER_OPTION_GROUP`/`ORDER_OPTION_VALUE`，没有这个实际 objectType；`BrandCatalogCopyDrawer.tsx:613-625` 因此 fallback 为“关联内容”，不是交互稿要求的“点单选项”定位文案。按钮 hard stop 是正确的，但冲突不能被准确命名。

**Same-root scan:** 对 copy policy、OpenAPI generic/component schemas、edge Java registry、edge JSON registry、owner preflight/execute objectType、generated TS model/decoder、operations-admin label/blocked/confirmation controls 全部扫描；剩余 **0** 个当前 brand-copy hard-block source/consumer 未检查。

**Minimum repair:** 在 preflight/execute operation problem-code 列表和对应 contract shard 登记 `CATALOG_COPY_DEFINITION_CONFLICT`；将实际 owner objectType 映射到“点单选项”并补 contract/decoder/UI focused regression。不要通过把 owner objectType 偷换成旧 `ORDER_OPTION_GROUP` 来掩盖跨层不一致。

### S-02 — 当前商品 detail 没有随定义库 mutation 失效

**Classification:** `CONFIRMED`; **tier:** L1 source; **severity:** S.

IA 要求定义变更刷新当前库和当前/受影响商品 detail（`ia.md:157,173`），serial plan 也明确要求 generated RTK/refresh signal 刷新 detail（`serial-plan.md:142`）。当前 generated RTK：
`apps/frontend/operations-admin/src/app/api/generated/catalog-inventory-edge.rtk.ts:157-164` 只使 definition-library、catalog-item-page（以及 option update/delete 的 inventory-target-page）失效；商品 detail query 的 tag 在 `:117` 是 `catalog-item-code`/itemRef response tag，未被这些 mutation invalidation 引用。

Workbench 的 revision 只接受旧 `CatalogDictionaryKind`：`CatalogWorkbenchPage.tsx:244-246,1450-1459`；`CatalogDictionaryDrawer.tsx:51-54,712-738` 的 metadata tabs `ATTRIBUTES`/`ORDER_OPTIONS` 也没有能向 `CatalogItemDrawer` 发出对应 revision 的类型/回调。Item drawer 的 revision 使用点只有 TAG/SALES_UNIT/SKU attribute paths（`CatalogItemDrawer.tsx:1388-1390,2089-2098,2379-2383`）。因此在商品 detail 仍打开时从 metadata library 修改定义，库列表会 refetch，但当前 detail 的 relational snapshot/已有商品配置不因该 mutation 自动重新读取；这违反“当前详情/受影响商品刷新”的已冻结 UI 行为。

**Same-root scan:** 检查 mutation tags、definition list query tags、item detail query tags、Workbench revision state、DictionaryDrawer metadata tab/onClose、ItemDrawer revision consumers、以及 IA/serial refresh requirement；剩余 **0** 个 ATTRIBUTES/ORDER_OPTIONS detail refresh path 未检查。

**Minimum repair:** 为两个 definition library mutation 接入 foundation/既有 generated refresh signal，明确失效当前 item detail 和受影响 item；不要只增加一个不会被 ItemDrawer 消费的局部 counter。补 focused cache/invalidation test。

### S-03 — 原料候选被任意 200 条页面硬截断

**Classification:** `CONFIRMED`; **tier:** L1 source; **severity:** S.

`CatalogDefinitionLibraries.tsx:271-280` 直接调用 `getOperationsInventoryTargets`，query 固定 `pageSize: 200`，只把这一页去重为 Select options；`274-275` 没有 cursor、`useCursorCandidates` 或 subsequent-page collection，`:362` 直接渲染这组截断 candidates。交互稿把该 screen 的 foundation primitive 明定为 `useCursorCandidates`（`ui-interaction.md:271-273`），serial plan CP-05 也将其列为必须对接能力（`serial-plan.md:133`）。

这不是定义库 500 上界：这里读取的是 inventory owner 的原料候选；当第 201 个可用原料商品存在时，用户无法把它作为强制原料，且没有 typed “too many”或搜索/继续加载反馈。候选缺失会直接阻断合法的多原料维护。

**Same-root scan:** 检查 definition Drawer 的 candidate request/query/dedupe/render、generated inventory target query 的 cursor/page fields、交互稿 foundation primitive 与 CP-05 target anchors；当前没有第二个 definition-library material candidate consumer，剩余 **0** 个同根候选入口未检查。

**Minimum repair:** 复用 foundation `useCursorCandidates` 或等价的 cursor 收集/搜索 primitive，并保留 scope、StockTarget、loading、failure 和 draft semantics；不得把 200 当作静态业务上限。

### S-04 — 关键 option-code/copy/BOM 红夹具与 oracle 不完整

**Classification:** `CONFIRMED`; **tier:** L1 acceptance source; **severity:** S.

实现详设与 serial plan 明列 acceptance 红夹具：update 携带改变后的组/值编码必须拒绝，same-code definition semantic conflict 必须 preflight `BLOCKED`、execute 不写入，local `ORDER_OPTIONS` 必须证明完整关系闭包（`implementation-design.md:184-187`、`serial-plan.md:154-162`）。当前 `CatalogAcceptanceScenarios.java:2025-2088` 的 option create/update 只回显原编码，未发送改变后的 group/value code 负例；`:2302-2401` 的 copy conflict 注释明确只证明 attribute-definition conflict，不推断 order-option identity；`:1684-1779` 的 local copy 场景只断言 target `orderOptionConfigs` 非空，未设置带 material/BOM 的值并核验 target value/material/BOM/reference mapping。

最新受管 run 的 `backend-acceptance-result.jsonl`（72 rows，29 catalog rows）中上述既有 scenarios 均 `business=PASS`, `contract=PASS`，因此这是“关键负例/完整 oracle 没有进入测试分母”，不是把本次运行误报为失败。它不能证明 option immutable code、option-specific hard block 或 material/BOM closure 在 HTTP 中工作。

**Same-root scan:** 检查 definition create/update/delete、501、value deletion、local copy、brand copy 的全部 catalog acceptance scenarios 与 run result；剩余 **0** 个当前同名 acceptance scenario 可替代这三个缺失红夹具。最新 `gradle.log` 也只证明 task build/test 成功，不能制造缺失业务断言。

**Minimum repair:** 在同一 `CatalogAcceptanceScenarios.java` 增加：改变 group code 与 value code 的两个 422/原编码 readback 负例；order-option same-code mode/value/material conflict 的 preflight `BLOCKED` + execute 422/no target write；local ORDER_OPTIONS 带至少一条 material/BOM 的 target opaque-ref/value/material mapping oracle。保持 business 与 cleanup 分开。

### N-01 — test-only legacy SQL 与当前清库迁移不一致

**Classification:** `UNVERIFIED_REQUIRES_EVIDENCE`; **tier:** test source; **severity:** N。

当前 production main 对旧表/字段的扫描没有命中，但 `apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogCategoryOwnerIntegrationTest.java:3675-3780` 仍查询 `catalog.catalog_order_option_group`、`catalog.catalog_order_option_value`、`item.orderOptions` 和旧 JSON 结构。`V20260820_010000_001` 已明确删除这些表/列。最新受管 `:apps:backend:catering-business-server:test` PASS 没有证明该 module integration test 类被纳入同一 runner 或这些查询仍可执行，因此不能把它判为已运行失败，也不能把 stale fixture 当成生产 runtime finding。

**Same-root scan:** 扫描 catalog backend production main、migrations、generated detail shape、operations-admin runtime/test source 与 catalog test source；生产 main/前端 runtime 的旧路径均无命中，只有上述 test-only old SQL family 留存，剩余 **0** 个同根 test-only legacy query 未检查。

**Minimum repair:** 更新或删除旧 test fixture，使测试直接验证 relational `attributeAssignments`/`orderOptionConfigs`/definition refs；不要恢复兼容列、旧表或 dual-write。

## 5. Required implementation inventory

| Claim | Static source | Latest acceptance | Nobody has verified |
| --- | --- | --- | --- |
| Legacy free JSON/item-owned option removal | Migration + owner reject/re-hydration PASS；test-only stale SQL is N-01 | Relevant current acceptance PASS, but no proof that every stale module test is executed | Browser rendering of the typed detail/editor; UAT/seed |
| Group/value codes immutable | Migration, owner command shape, value mismatch reject, frontend disabled control PASS | Existing option CRUD PASS; changed group/value code negative absent (S-04) | Browser disabled-state and real HTTP changed-group/value reject |
| 500/501 definition list bound | SQL `LIMIT 501` + typed reject + no pagination PASS | `definition-list-limit` and `order-option-definition-list-limit` PASS | Browser error rendering/L2 |
| Owner/transaction boundary and inventory public commands | Coordinator/owner API/REQUIRED transaction static PASS | Current run exercises create/update/delete/local-copy paths, but not every rollback/failure branch | Runtime rollback/isolation adversaries, browser |
| Local `ORDER_OPTIONS` copy closure | Code maps group/value/material/config refs and delegates inventory owner static PASS | `local-copy-section-outcomes` PASS only on non-empty target config | Material/BOM/reference target identity and browser readback |
| Brand copy hard block | Owner preflight/execute + UI disabled confirmation static PASS; S-01 registration/vocabulary gap | Attribute-only semantic conflict PASS; option-specific conflict absent | Option-specific HTTP and all UI L2 behavior |
| Multi-material definition edit | Backend/generated/item editor support arrays; definition library editor refutes it (M-01) | No multi-material UI acceptance scenario | Browser data-loss reproduction (static request mapping already proves it) |

## 6. Dynamic, cleanup and L2 boundary

The latest artifact was read directly, not inherited from the Round 1 disposition:

```text
RUN=r5-tc-1787224951000-11286
MANIFEST=.runtime/r5/evidence/remote-testcontainers/r5-tc-1787224951000-11286/run-manifest.json
TEST_EXECUTION=PASS
BUSINESS=PASS for the emitted real HTTP acceptance rows
CLEANUP=PASS (remoteProcess=PASS, remoteWorkspace=PASS, testcontainersContainers=PASS, testcontainersVolumes=PASS)
RELEVANT_ROWS=PASS for catalog.order-option-definition-create-update,
  catalog.order-option-definition-list-limit,
  catalog.copy-definition-semantic-conflict,
  catalog.local-copy-section-outcomes
BROWSER_L2=NOT_RUN
DEV/RESET/SEED/UAT=NOT_RUN
```

`gradle.log` ends with `BUILD SUCCESSFUL`; `http-request-events.jsonl` contains run-scoped correlation/request IDs and succeeded HTTP route observations. This is genuine managed HTTP/Testcontainers business and cleanup evidence for the scenarios that exist. It does not prove browser L2, visual layout, keyboard/focus behavior, the multi-material UI path, or the missing negative/oracle cases. The absence of browser L2 is therefore explicitly `NOT_RUN`, not a product PASS and not silently promoted to another tier.

## 7. Verdict

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=NO-GO
M/S/N=2/4/1
L1_ENGINEERING=findings M-02, S-01, S-02, S-03, S-04, N-01; legacy/code/bound/owner/transaction static closure otherwise PASS
L2_USER_VISIBLE=findings M-01, S-01, S-02, S-03; copy hard stop itself is source-conformant but option-specific user text and detail refresh are not closed
L3_UNVERIFIED=browser L2 not run; no DEV/seed/reset/UAT; no browser proof for multi-material edit, disabled immutable-code controls, candidate loading/scroll, or blocked copy rendering
SAME_ROOT_SCAN=M-01 definition-library material type/hydration/render/submit plus generated/backend/item-editor arrays checked; M-02 all current CP-02..CP-06 actual change points lack a complete double-read ledger; S-01 copy policy/OpenAPI/edge Java+JSON/owner/generated/model/UI checked; S-02 mutation tags/detail tags/Workbench revisions/DictionaryDrawer tabs/ItemDrawer consumers checked; S-03 candidate query/generated cursor/foundation anchors checked; S-04 all catalog acceptance scenarios and latest run rows checked; N-01 production main/migration/generated/frontend/test old-fact family checked
DESIGN_GAPS=FR-OPT-01a says group-internal value-code uniqueness while V20260820_010000_002 enforces scope-wide (data_node_ref,brand_ref,code) uniqueness; canonical source does not resolve whether the stronger scope is intended, so this is DEXTER_DECISION and is not counted in M/S/N
EVIDENCE_TIER=STATIC source/contract/generated/acceptance extraction plus managed real HTTP/Testcontainers PASS and cleanup PASS; browser L2/DEV/seed/reset/UAT absent
```

This is the final Round 2 decision for the current cycle. No third independent review round is permitted. The smallest closure sequence is: repair the multi-material editor and copy contract/UI closure, add detail invalidation and cursor candidate collection, add the specified option-code/option-copy/BOM acceptance red fixtures, then independently re-read the same roots and decide any separately authorized L2/UAT evidence. 
