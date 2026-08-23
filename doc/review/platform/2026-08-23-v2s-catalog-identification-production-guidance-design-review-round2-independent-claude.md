# 商品识别与制作信息 DESIGN 独立审查（Round 2）

> 机械落盘说明：本文件内容来自 fresh independent subagent `01a02c94-487c-7673-ae3c-f350280061d2` 的同一 Round 2 最终输出。该 reviewer 角色为只读，无法直接写文件；作者会话仅机械保存其 verdict，并按 reviewer 随后确认的勘误表修正了 owning-source 路径转录错误，未改变 finding、severity 或 verdict。

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=CIPG-DESIGN-20260823
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
BLIND_REVIEW_DECLARATION=先冻结独立预期，后读作者工件与 Round 1；不采信作者结论、既有 verdict 或自报数字。
EVIDENCE_TIER=STATIC_DESIGN_AND_SOURCE_ONLY
```

## 1. 审查边界与输入

本轮是同一 `REVIEW_CYCLE_ID` 的最终定向复核，不是新 review round。reviewer 未召集子 reviewer，未修改代码、generated、memory、运行环境或仓库状态，也未执行测试、DEV、reset、seed、browser、UAT 或部署。

### 1.1 授权、规范与记忆

- `AGENTS.md`
- `PLATFORM-BLUEPRINT.md`
- `doc/platform/README.md`
- `doc/platform/roadmap-program-registry.json`
- 当前 program `V2S_W0_W4_EXECUTION` 授权字段
- `scripts/README.md`
- `project-memory/decisions/deterministic-context-only.md`
- `project-memory/index.md`、全部 kernel 与六维路由命中的 design/review/frontend/backend/contract/governance/product memory
- `project-memory/decisions/confirmed-business-language-corpus.md`
- `project-memory/operations/backend-acceptance.md`
- `project-memory/operations/verification-governance.md`
- `project-memory/operations/phase-retrospective-and-systemic-repair.md`
- `.agents/skills/cs-review/SKILL.md`
- `doc/platform/review-standard.md`
- Journey、UI interaction、IA、implementation design 四份模板
- `doc/platform/frontend-coding-standard.md`
- `doc/platform/backend-coding-standard.md`
- `doc/platform/foundation-charter.md`
- `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md`

### 1.2 正式需求与作者工件

reviewer 先读取正式需求并冻结独立预期，之后才读取作者工件，最后读取 Round 1：

- `doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-formal-requirements-codex.md`
- `doc/decisions/2026-08-23-v2s-catalog-identification-production-guidance-journey.md`
- `doc/decisions/2026-08-23-v2s-catalog-identification-production-guidance-ui-interaction.md`
- `doc/plans/platform/wireframes/2026-08-23-v2s-catalog-identification-production-guidance.svg`
- `doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-information-architecture-codex.md`
- `doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-implementation-design-codex.md`
- `doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-serial-plan.md`
- `doc/review/platform/2026-08-23-v2s-catalog-identification-production-guidance-design-review-independent-claude.md`

### 1.3 亲验 owning source

- `contracts/openapi/catalog-inventory.openapi.json`
- `contracts/registry/operation-handler-bindings.json`
- `scripts/generate/catalog-inventory-p1.mjs`
- `scripts/generate/backend-performance-budget.mjs`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerApi.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java`
- `apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CatalogAcceptanceScenarios.java`
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260820_010000_000__catalog_item_definition_libraries.sql`
- `apps/backend/catering-business-server/src/main/resources/db/migration/V20260820_010000_001__retire_item_attribute_json_and_order_option_relations.sql`
- `apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts`
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`
- `scripts/dev/catalog-inventory-seed-executor.mjs`

reviewer 已确认上述路径勘误只修正报告转录，不改变 `VERDICT=NO-GO` 与 `M/S/N=0/1/1`。

## 2. 冻结的独立预期

1. Identifier 闭集为 `BARCODE | PLU | MNEMONIC`，没有第二个持久化 scope，唯一与未来查询边界为 `dataNodeRef + brandRef + identifierType + normalizedValue`。
2. D-CIPG-01 必须逐层一致：BARCODE/PLU trim 后原值且大小写敏感；MNEMONIC 比较不区分大小写、展示保留输入；三类拒绝 Unicode 控制字符。
3. D-CIPG-02 必须逐层一致：显示名称 120，制作说明与追加说明各 1000，时长为空或非负整数，无 86400 业务上限。
4. D-CIPG-03 不新增 identifier resolve HTTP 或 owner production method，operation exact-set 固定 238，只保留存储、唯一索引、save/readback 与未来查询边界。
5. shape 准入矩阵、item/SKU identifier grain、item default、SKU full override 与 option add-only effect 必须闭合。
6. 用户可见面只出现已批准业务语言；BOM 是已接受业务词，不能因技术词扫描误报。
7. contract、UI、owner 分工必须可执行、可测试；acceptance subcase 的 operation identity 必须与宿主 annotation 一致，annotation 总数不得超过 80。
8. Round 1 四个 M 必须独立复验：当前 option parent、零消费者 resolve/budget、legacy Flyway preflight/disposition、production-tag management/candidate 双语义。

## 3. Action 1-B 非空提取

### 3.1 与独立预期一致的设计事实

- 正式需求与设计工件一致保持 identifier 三类型闭集。
- D-CIPG-01 的规范化、展示和控制字符规则已经进入正式需求与作者工件。
- D-CIPG-02 的 120/1000、非负整数及无 86400 上限已经进入正式需求与作者工件。
- D-CIPG-03 明确本批没有 resolve HTTP，operation exact-set 保持 238。
- 实施设计与串行计划都把存储、唯一索引、save/readback 和未来查询边界作为当前范围。
- production tag 以 `usage=MANAGEMENT | BINDABLE_CANDIDATE` 和 cursor identity 区分两类读取，不新建第二个 owner read capability。
- `USER_VISIBLE_COPY` 不向用户暴露 resolver、budget、operation count 等技术语义。
- SERVICE 只允许 MNEMONIC；不支持父商品码静默选择默认 SKU。
- seed 两栏覆盖碰撞、控制字符、长度边界、无时长上限和 no-resolve-call。

### 3.2 文档与 owning source 的矛盾

- 详设 §11 把 whole-save identifier/preparation 子场景放在 `catalog.item-create-draft-category` 下，但当前 annotation 的 operation 是 `createOperationsCatalogItem`。
- 同表把请求写成 `saveOperationsCatalogItem`，却仍挂在 create scenario identity 下。
- 串行计划说 whole-save 原子性进入 item save 场景，而 executor-facing §11 表仍让实施者在 create/save 之间猜测。

### 3.3 非阻断清晰度问题

- §9b 锚点在当前树可恢复且唯一，但部分行只写 basename 或“同上”，弱于实施交接所需的完整仓根相对路径。

## 4. 代表性实现模拟

### 4.1 operation exact-set 与 no-resolve

亲验当前 catalog OpenAPI 为 57 个 operation，无 identifier resolve operation；operation-handler binding 为 238；budget generator 期待 238 并拒绝 calibration placeholder。D-CIPG-03 在设计/source 层 PASS。

### 4.2 production-tag 双消费语义

当前 source 尚无 usage/query，cursor identity 也尚未包含二者；设计明确新增 `MANAGEMENT | BINDABLE_CANDIDATE`、query 与 cursor identity 分离，同时不新增第二 owner production method。设计层 PASS，实施与运行证据仍未取得。

### 4.3 acceptance scenario identity

当前 acceptance annotation 总数为 80，`CatalogAcceptanceScenarios.java` 为 38。`catalog.item-create-draft-category` 当前明确绑定 `createOperationsCatalogItem`；作者 §11 却在该场景下放置 `saveOperationsCatalogItem` whole-save request/oracle。此项设计层 FAIL，是 Round 2 唯一阻断。

## 5. 同根扫描

| 同根族 | 结论 | 独立证据摘要 |
| --- | --- | --- |
| 当前 option parent | PASS | 当前 parent 为 `catalog_item_order_option_value_override`，退休表已由 migration 删除，作者工件未再依赖旧 parent |
| resolve/budget 零消费者 | PASS | 正式需求禁止本批 resolve；OpenAPI 无该 operation；binding/budget 分母均为 238 |
| legacy Flyway preflight/disposition | PASS | 设计含旧数据分类、materialRole 等值折叠/冲突停止、报告与 Dexter disposition，不以 fallback/reset 代替迁移规则 |
| production-tag management/candidate | PASS | 设计补 usage/query/cursor identity，保持一个 owner read capability，用户文案不暴露机器语义 |
| D-CIPG-01 | PASS | 正式需求、contract/owner/UI/seed/acceptance 设计均承接规范化与控制字符规则 |
| D-CIPG-02 | PASS | 120/1000、非负整数、无 86400 上限逐层一致 |
| D-CIPG-03 | PASS | no-resolve 与固定 238 一致 |
| 用户业务语言与 BOM | PASS | business corpus 接受 BOM，USER_VISIBLE_COPY/IA 未泄漏本批内部术语 |
| contract/UI/owner 分层 | PASS_WITH_DESIGN_ONLY_EVIDENCE | 分工清楚，仍需实施与 focused/HTTP 证明 |
| acceptance identity/80 上限 | FAIL | 数量上限成立，但 create scenario 承载了 save request/oracle |
| seed 两栏 | PASS_WITH_DESIGN_ONLY_EVIDENCE | 正反例与 no-resolve seed 边界齐全，当前 executor 尚未实施 |
| §9b 锚点 | PASS_WITH_MINOR_CLARITY_NOTE | 当前可唯一恢复，但应展开完整路径 |

其余同根成员已检查；未发现第二个 blocking root。

## 6. Findings

### M Findings

无。

### S-01 · Acceptance §11 混合 create 场景身份与 save whole-save request/oracle

状态：`CONFIRMED`

严重度：`S`

证据：

- 当前 `catalog.item-create-draft-category` annotation 的 operation 是 `createOperationsCatalogItem`。
- 详设 §11 在该场景下安排 `whole-save item identifiers/profile` 与 `whole-save-atomicity-with-identification-preparation`。
- 后者明确写 `saveOperationsCatalogItem` request，但仍归入 create scenario。
- 串行计划 CP-10 说它应进入 item save scenario，与 §11 executor-facing 表矛盾。

影响：实施者必须猜测把 subcase 写进 create 还是 save acceptance；即使 annotation 数仍为 80，也可能把业务断言挂到错误 operation identity。

最小修复：把两个 whole-save subcase 移出 `catalog.item-create-draft-category`，放入当前 operation 为 `saveOperationsCatalogItem` 的既有场景，优先复用 `catalog.inventory-rule-admission-matrix`；§11 与 CP-10 必须逐字一致，并通过合并/重平衡维持 annotation 总数 80。

### N-01 · §9b source anchor 可恢复但路径不完全精确

状态：`CONFIRMED`

严重度：`N`

证据：部分 §9b 行使用 basename 与“同上”，当前树虽可唯一恢复，但不符合实施交接的最强机械精度。

最小修复：每行展开完整仓根相对路径，保留原 anchor 与 CP-00 唯一性检查。

## 7. 被证据否定的疑虑

- `BOM` 不是技术词泄漏：业务语料已接受该词。
- 不存在 238/239 可执行条件分支：当前 OpenAPI 无 resolve，binding/budget 为 238，设计固定 238。
- 不存在未授权 identifier resolve route：正式需求和设计均明确延期到真实销售 Journey。

## 8. L3 未验证清单

本轮只做静态设计与 source 复核，以下均未验证且不得冒充已完成：

- backend compile、frontend typecheck；
- generated artifact/OpenAPI client 重生成；
- migration 与 Flyway preflight 运行；
- owner save/readback HTTP；
- backend acceptance；
- seed、DEV、cleanup；
- browser L2、UAT；
- 真实 DOM 文案、键盘、焦点、滚动、错误状态；
- production-tag management/candidate 运行行为。

## 9. Fixed Verdict Block

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=0/1/1
L1_ENGINEERING=NO-GO: static design/source review found one blocking executability defect in acceptance scenario identity. Operation exact-set 238/no resolve, option parent table, legacy Flyway disposition, production tag usage split, D-CIPG-01/02/03, seed boundary, and UI language are acceptable at design level.
L2_USER_VISIBLE=PASS_STATIC_ONLY: USER_VISIBLE_COPY/IA/SVG were checked against approved business language; BOM is accepted existing business vocabulary. Real rendered UI, focus, keyboard, scroll, and browser behavior remain unverified.
L3_UNVERIFIED=NON_EMPTY: compile, generation, migration, HTTP, backend acceptance, seed, DEV, browser L2, UAT, and cleanup were not run and are not claimed.
SAME_ROOT_SCAN=FAIL_ON_ACCEPTANCE_IDENTITY: Round 1 four M roots were closed at design/source level, but acceptance §11 still mixes create scenario identity with save whole-save request/oracle. §9b anchors are unique but should be path-expanded.
DESIGN_GAPS=S-01 acceptance scenario identity mismatch must be repaired before implementation; N-01 §9b exact-path clarity should be cleaned.
EVIDENCE_TIER=STATIC_DESIGN_AND_SOURCE_ONLY
```
