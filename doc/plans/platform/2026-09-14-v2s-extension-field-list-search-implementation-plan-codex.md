# 扩展字段列表展示与类型化搜索实施计划（已获实施授权）

```text
SKILL_USED=cs-spec-to-plan@repo; cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
REQUIREMENTS=doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md
JOURNEY=doc/decisions/2026-09-14-v2s-extension-field-list-search-journey.md
IA=doc/plans/platform/2026-09-14-v2s-extension-field-list-search-ia-design-codex.md
INTERACTION=doc/plans/platform/2026-09-14-v2s-extension-field-list-search-interaction-design-codex.md
IMPLEMENTATION_DESIGN=doc/plans/platform/2026-09-14-v2s-extension-field-list-search-implementation-design-codex.md
IMPLEMENTATION_AUTHORITY=true
RUNTIME_AUTHORITY=AUTHORIZED_R5_RUNTIME
RESET_DEV_SEED_AUTHORITY=AUTHORIZED_BY_DEXTER_2026-09-14
CURRENT_SESSION_AUTHORITY=IMPLEMENTATION_AND_MANAGED_RUNTIME_DIRECTIVE
INDEPENDENT_DESIGN_REVIEW=NO_GO_ROUND_2_FINDINGS_SELF_CLOSED
DEXTER_WIREFRAME_REVIEW=CONFIRMED_2026-09-14
L2_SCRIPT_ADMISSION=BLOCKED
```

本计划是当前实施者可执行的顺序，实施授权来自 Dexter 2026-09-14 直接指派；主 agent 负责全部文件写入、受管执行和证据，fresh independent subagent/Claude 只读 review。Git 由 Dexter 控制，本计划不要求任何 Git 操作。reset/DEV/seed 仅在 P1-P7、P8 资源预检和实现前置条件闭合后按受管入口执行；browser L2、UAT 和部署不在本批授权内。

## 0. 固定范围与进入条件

### 0.1 固定分母

- 8 个 extension host：`BRAND`、`TENANT`、`HEAD_COMPANY`、`STORE`、`CONTRACT`、`COMMERCIAL_GROUP`、`REGION`、`PROJECT`。
- 12 个 screen：2 个 platform-admin 配置 screen + 10 个平面列表 screen。
- 7 个目标 list operation：brand、tenant、head company、store、contract、platform organization overview、platform contract overview。
- 5 张表：`organization.brand`、`organization.tenant`、`organization.head_company`、`organization.store`、`contract.store_contract`。
- 组织架构树 0 变更：树接口、树页面、树详情、树扩展 search/listDisplay、树 revision、树 error、树 scenario、树 seed 均不在计划中。
- 候选选择器不计入动态列表分母；合同既有 project/tenant/store 核心条件继续保留。

### 0.2 进入任一步骤前

主 agent 必须按当前 bytes 重开该步骤所需的 AGENTS、PLATFORM-BLUEPRINT、Roadmap 授权字段、六维 memory recall、原始需求、IA、交互、详设、适用 backend/frontend coding standard 和 owning source。旧 handoff、聊天摘要和上一轮 verdict 只能作为待核查线索。

UI 前置顺序：Dexter 已确认视觉 IA、low-fi 和文案 → fresh 独立 DESIGN review round 2 已完成 → 主 agent intake/修复 → contract/source OPEN 项关闭 → 按 Dexter 当前 R5 显式授权实施。round 2 的 S/N finding 已自闭合；runtime 仍须在 P8 按 manifest、资源预检和 business/cleanup 证据执行。

## 1. 步骤总表

| 步骤 | 目标 | 主 agent 可写范围 | 最低验证 | 下一步门 |
| --- | --- | --- | --- | --- |
| P0 | 设计/source 盘点与分母冻结 | 文档、对账清单 | 静态 source/需求/IA/交互/详设核对 | 8/12/10/7/tree unchanged 一致 |
| P1 | definition flags 与配置面 | contract source、extension owner、platform config、focused tests（获授权后） | OpenAPI/codegen + extension focused + readback | flags/N-A/revision/audit MATCHED |
| P2 | 7 个平面 contract/owner/Page | 7 path source、owner query、generated 派生、两 app list | owner focused + 每 operation HTTP acceptance | 每 operation AND/Page/raw/revision MATCHED |
| P3 | typed semantics、scale/index、budget | shared predicate/formatter、测量后 additive migration | 五表 100k EXPLAIN + 三次 budget measurement | scale/write-cost/decisionRef MATCHED |
| P4 | foundation/UI/state/testId | 两 app UI、foundation capability、app `*TestIds.ts`、focused tests | static/focused + Dexter visual + fresh UI review | UI/testId PASS，L2 仍需独立授权 |
| P5 | seed/fixture/acceptance/sync | r5 fixture、executor、plan/profile、domain scenarios | static + focused；动态须另授权 | definition→values→revision MATCHED |
| P6 | 步骤级三维对账 | 对账记录 | fresh 只读 subagent 逐点证伪 | 当前步骤无 OPEN |
| P7 | 全批三维对账 | 全批对账记录 | fresh 只读 subagent 全范围重读 | 整体测试前全范围 MATCHED |
| P8 | 受管验证与 business/cleanup | 仅另行授权后运行 scripts | business 与 cleanup 分离 PASS | 动态结论可审计 |
| P9 | 逐代码与详设对账 | 逐变更行/符号记录 | 主 agent 双读 + fresh 复核 | 全部 MATCHED 才交 implementation review |

P6/P7/P9 不是作者自评替代物。fresh reviewer 只能只读；主 agent 处理 finding 并重新请求复查。未完成步骤不能由测试 green、handoff checker 或历史 Claude verdict 代替。

## 2. P0：设计/source 盘点

### 2.1 Owning source 清单

- definition contract：`contracts/openapi/components/extension/extension.schemas.json`；
- definition owner：`ExtensionDefinitionReadback.Field`、`ExtensionDefinitionService#requireDefinition`、`ExtensionDefinitionService#replaceDraft`、`ExtensionDefinitionPersistence`、`ExtensionDefinitionServiceSql`；
- list paths：operations brand/tenant/head/store/contract path files，platform organization-overview/contract-overview path files；
- platform consumers：`OrganizationOverviewDetailDrawer.tsx`、`ContractOverviewDetailDrawer.tsx`、`PlatformReadPage.tsx`、`HeadCompanyBrandAuthorizationActionAdapter.ts`；
- generated catalogs：`apps/frontend/*/src/app/api/generated`、`contracts/registry/operation-handler-bindings.json`、`edge-route-face-registry.json`；
- UI owning sources：`ExtensionFieldManagementPage.tsx`、`ExtensionsPage.tsx`、`BusinessEntityManagementPage.tsx`、`StoreManagementPage.tsx`、`ContractManagementPage.tsx`；
- focused tests：`OrganizationOverviewPresentation.test.ts`、`OrganizationOverviewFilters.test.ts`、`platform-read-boundary.test.mjs` 及各 host owner tests；
- seed 全集：fixture JSON、`scripts/dev/owner-command-seed-executor.mjs`、`scripts/dev/r5-seed-plan.mjs`、`scripts/dev/profiles/r5-full.json`、executor focused test、必要时 `scripts/test/test-health-entry-runner.mjs`。

若路径/符号漂移，先用 `rg`、源码和编译器重新确定，不把计划名字当作事实。

### 2.2 P0 退出条件

需求、Journey、IA、交互和详设的平面共用原文逐字一致；12 screens、10 flat、7 list operations 与树 unchanged 一致；definition source/list raw wire/revision/errors、5 表/100k/index/write-cost、每 operation budget、Drawer hidden facts、platform detail consumers、seed 全集均有条款。无 runtime/reset/seed/DEV/L2/UAT/Git 动作。

## 3. P1：definition flags 与配置面

1. 在 OpenAPI source 的 definition field items 增加 `listDisplay`、`searchable`；flat 为 `boolean`，N/A host read model 为 nullable `null`。
2. 在 owner readback/normalize/replace 中传递 flags；保留 field key/type/options/status/order/suffix、revision、CAS、audit、Idempotency-Key/receipt。
3. 从 contract source 生成 backend/frontend models，禁止手改 generated。
4. 配置表固定列顺序为“字段名称｜字段类型｜是否列表展示｜是否可搜索｜是否必填｜是否启用｜选项”；Drawer 增加两个独立真实 Select。N/A host 只显示禁用“不适用”，这不产生树消费。
5. 复用 `useDrawerFormLifecycle`、`useSubmissionLifecycle`、`useAsyncGenerationGuard`、`useOverlayLock`、`adminWideDrawerSurfaceProps`、`testId`。

focused 必须覆盖旧 JSON 缺字段默认、flat 四组合、N/A non-null rejection、disabled 不消费、invalid type/options、version conflict、同 key 幂等重放和 authoritative readback。OpenAPI/codegen/authorization/部分写入任一失败，停在 P1 并保留 first failure。

## 4. P2：7 个平面 operation

### 4.1 Contract 形态

七个 operation 同形增加以下两个 query parameter：`extensionFilters` 以 scalar query string 承载 JSON encoded array，并引用 `ExtensionFilterQuery`；`definitionRevision` 为 `required=false`、`integer`、`int64`、`minimum=0`。OpenAPI contract 的可复制形态为：

```yaml
- name: extensionFilters
  in: query
  required: false
  schema:
    $ref: '#/components/schemas/ExtensionFilterQuery'
- name: definitionRevision
  in: query
  required: false
  schema:
    type: integer
    format: int64
    minimum: 0
```

新增共享 `ExtensionFieldType` enum、`ExtensionFilter` logical object 与 `ExtensionFilterQuery` scalar component。因 Heritage source hash-locked 且只读，active edge catalog 的 `componentOverrides.ExtensionDefinition` 与 `componentOverrides.ExtensionDefinitionUpdateRequest` 将两个 definition `type` 属性从 inline enum 替换为 `ExtensionFieldType` `$ref`。active edge catalog 的七个 parameter 以 symbolic `$ref` 引用 `ExtensionFilterQuery`，`ExtensionFilterQuery.x-v2s-logical-schema` 引用 `ExtensionFilter`，从而由 materializer/codegen 产生真实 `$ref` 与 reachable generated types。`ExtensionFilter.value` wire type 为 string，由 owner 按 `type` 解码。请求先做 percent decode/JSON syntax/encoded length/top-level array/item shape/raw array limit；malformed/shape/length invalid 不读 definition snapshot。未携带或解码后为空数组（包括 `extensionFilters=[]`）等价于无扩展条件，不发送/比较 `definitionRevision`；非空数组缺 revision 或 revision 不合约先返回 `400 EXTENSION_FILTER_INVALID`，reason 分别为 `DEFINITION_REVISION_REQUIRED`/`DEFINITION_REVISION_INVALID`，之后才读 snapshot、比 revision、做 definition 语义校验。不能把同一参数同时写成 content 与 schema，必须满足 codegen 的 schema 硬约束。

7 个 operation 为：`getOperationsOrganizationBrands`、`getOperationsOrganizationTenants`、`getOperationsOrganizationHeadCompanies`、`getOperationsOrganizationStores`、`getOperationsContracts`、`getPlatformOrganizationOverviewPage`、`getPlatformContractOverviewPage`。

owner 顺序固定为 authorization/scope → raw query decode/shape/length/raw array limit → 未携带或空数组无扩展条件且不读/比 revision；非空缺失或非法 revision 先 typed invalid → current definition snapshot → revision compare/stale → 全量 filter semantic validation → core AND extension predicate → Page。Page item 统一 raw `extensionValues`，definition version 使用 `ExtensionDefinition.revision`。platform 旧 `extensionFields` 消费者必须同步到 raw wire 或有证据的唯一转换，不得留下第二 formatter。

### 4.2 每 operation 交付顺序

1. 修改 OpenAPI path parameter/response source，运行生成链；
2. 修改对应 owner query/persistence/projection，调用共享 parser/predicate，不直连 extension persistence；
3. 保留 workspace/project/category+type identity、权限、候选和分页；
4. 在 disposition registry 增加 code，并在 active edge catalog 的七个 operation augmentation 中各登记 stale 409 与 invalid 400；运行 materializer 后再检查 `x-error-codes`、`EdgeProblemCode.java`、`ContractProblemAdvice` 和 generated mapping；不改全局 `AUTHZ_READ`，不创建 `OperationsApiProblem`；
5. 修改两 app query args、typed controls/columns、currentData/isFetching、一次 recovery；
6. 更新 focused/HTTP scenario 与详设 §12 全链。

每 operation 需证明：enabled+searchable 才有控件、enabled+listDisplay 才有列、列无排序、filters 与 core AND、total/items/page 同集、不逐行 detail、合同无 project 不发 list、platform Tab identity 不串。

## 5. P3：类型、scale/index 与预算

### 5.1 类型能力

foundation 若无 extension formatter，新增一个能力命名的唯一 formatter，operations-admin 和 platform-admin 共用；backend 新增/复用唯一 `ExtensionFilterParser`/`ExtensionFilterPredicateBuilder`。TEXT trim/lower/contains 并转义 `%`、`_`、escape；NUMBER/DATE/BOOLEAN/SELECT 分别 exact typed；empty/null/missing、disabled、stale option 不静默匹配。

### 5.2 五表 100k 证明

真实 scope 上界为每 workspace/project flat list ≤100,000 行，增长由实体行数驱动，不由 field key 数量驱动。五表为 organization.brand、tenant、head_company、store、contract.store_contract。

每表及相关 operation 必须准备 equality、TEXT contains、AND、未命中、跨页用例，执行后记录 `EXPLAIN ANALYZE BUFFERS`、total/items/page、recheck、读 p95/max、写放大/storage。Equality 候选为通用 `GIN (extension_values jsonb_path_ops)`；TEXT 先 bounded scoped scan，不可接受才评估每表一个通用 trigram 候选并 JSONB exact recheck。参考 migration `V20260815_020000_000__catalog_item_short_name_column.sql` 的 pg_trgm/btree_gin；不得 per-key expression index、runtime DDL 或 read model。

### 5.3 每 operation budget

现有 calibration DB operation count FIXED baseline 为 8/8/8/13/8/6/6，分别对应上述 7 个 operation；不是 scale 上限。每 operation 以详设 §9 的独立 decisionRef、`authority=IMPLEMENTATION_AGENT`、from/current、to/provisional、measuredMax 记录三次真实测量。任何上调必须证明业务事实、owner 复核、事务、幂等、审计/readback 未弱化，且已经复用通用 definition/predicate/formatter/foundation/generated、无可消除 fan-out。未测/未授权保持 OPEN，red mutation 不删除。

## 6. P4：foundation、UI、状态与 testId

按顺序实现：platform config → operations brand/tenant/head → operations store → operations contract project prerequisite → platform organization 四 Tab → platform contract → platform detail/list consumers/tests → 两 app app-specific `*TestIds.ts`。

dynamic controls/columns 只读当前 definition；row value 只读 Page raw values；local state 只保留 filter draft/query identity；RTK 使用 currentData/isFetching。stale 只允许一次 definition bypass-cache read，清 dynamic filter、保留 core、回第一页；同 revision 再拒绝则手动重试。

12 个 screen 的文案、控件类型、位置、滚动、空/加载/错误、焦点/accessibility 必须与 requirements/IA/interaction/design 对账。dynamic testId 包含 host+fieldKey；Drawer draft 使用 stable key/identity，不使用 index；真实 Button、Select option、input、Pagination、retry 节点直接绑定。Dexter visual review 或 fresh UI review 未 PASS 时 `L2_SCRIPT_ADMISSION=BLOCKED`，不写 L2 binding/runner。

## 7. P5：seed、fixture、acceptance 和同步

### 7.1 seed

完整受影响集：`doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`、`scripts/dev/owner-command-seed-executor.mjs`、`scripts/dev/r5-seed-plan.mjs`、`scripts/dev/profiles/r5-full.json`、executor focused test、必要时 `scripts/test/test-health-entry-runner.mjs`。先 definition，再五表 values，再 definition revision change。覆盖 8 host、五 type、both-off/list-only/search-only/both-on、disabled、empty/null/missing、旧 SELECT、special chars、跨页和合同 project context。`extensionFilters=[]` 与未携带参数均覆盖“无扩展条件且不比 revision”边界。修复 executor 当前 TEXT-only/每 key 必须存在及 seed plan 纯中文字符串限制。seed static tests 与旧断言同批同步，当前不执行 seed。

### 7.2 acceptance

只在已有 `ExtensionAcceptanceScenarios.java`、`OrganizationAcceptanceScenarios.java`、`CommercialContractAcceptanceScenarios.java` 中增加能力命名场景，不新增 provider/registry。覆盖 flags/auth、四 organization flat、contract flat、platform org/contract、invalid aggregate、revision stale、scope isolation；真实 HTTP fixture 超过一页，browser recovery 放 frontend focused。动态执行另行授权后走受管入口，CONTRACT/BUSINESS/DB_OPERATIONS 与 cleanup 分开。

### 7.3 §12 回读

P5 完成时用详设 §12 逐行回读 contract/generated/edge/owner/frontend/test/fixture/seed/platform detail consumers。旧 `extensionFields`、TEXT-only executor、旧 empty 文案、旧 filter shape 或 generated drift 任何一项都不能进入 P6。

## 8. P6：步骤级三维对账

每个 P1–P5 结束、下一步开始前，主 agent 用需求、IA/interaction/design、命中的 project-memory 和 owning source 做前后双读；fresh 独立只读 subagent 以证伪立场逐项核验行为、形态、动作、关系、位置、文案、限制、状态、失败/恢复、焦点/accessibility、data source/invalidation。主 agent 将 finding 分类为 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`，修复后重新复查，直到当前步骤 `MATCHED`。

每项记录至少包含：

```text
STEP=<P1|P2|P3|P4|P5>
REQUIREMENTS=<path#anchor + evidence>
DESIGN_IA=<path#anchor + evidence>
MEMORY_STANDARDS=<routed source + evidence>
FRESH_REVIEWER=<read-only reviewer + finding ids>
DISPOSITION=MATCHED|OPEN
```

## 9. P7：整体三维对账

所有 P1–P5 完成、任何整体测试前，重新建立全批对账，不做步骤汇总替代。重新核对 8 host、12 screen、10 flat、7 operation、flag applicability、definition source/raw wire/revision/error/recovery、typed semantics、Page/100k、5 表/index/write cost、每 operation budget、foundation/testId、platform detail consumers、seed/acceptance/logging、树 unchanged 和授权边界。任一跨步骤偏差 OPEN，不能进入 P8。

## 10. P8：受管验证与 business/cleanup

P8 按当前 Dexter 授权并完成资源预检后执行 contract/codegen/static、逐 operation backend acceptance、必要的 all，随后才执行受管 reset、DEV、seed。business 与 cleanup 独立判定，cleanup 非 PASS 不得完成。DEV 如因获授权 Testcontainers 联动，只按 manifest/identity/stop/test/restart 规则；本批 reset/seed 仍按显式命令和顺序执行。同一 failure signal 第二次前必须完成日志/source/PID/边界诊断并根修，不以延时、盲轮询、换 oracle 代替。当前尚无动态证据。

## 11. P9：逐代码与详设对账

P1–P5 实际修改后，主 agent 对每条 contract、generated 派生、代码、test、fixture、seed、script 变更行/符号逐项映射到详设 §12、IA、interaction、requirements；fresh independent reviewer 只读复核。必须覆盖 flags/N-A/enabled、7 operation Page/raw/revision、类型 predicate/escape、errors/recovery、五表 scale/index/write cost/budget、foundation/currentData/isFetching/testId/Drawer hidden facts、platform consumers/generated catalogs、seed/acceptance/log privacy 和 tree unchanged。

记录只能使用：

```text
MATCHED=<file#unique symbol/change + design clause + evidence>
OPEN=<file#unique symbol/change + deviation + root cause + minimum fix>
```

任一 OPEN 未闭环，implementation-ready=NO。

## 12. 停止条件与当前状态

以下任一项停止当前步骤并保留 first failure：tree 范围重新扩大；definition source 与 list wire 不一致；codegen schema 缺失；问题码无真实 registry；前端当前页过滤/逐行 detail；100k/index/write-cost 未证明；预算只能删业务事实；seed 仍 TEXT-only/缺 key；foundation/testId 未对账；需要产品选择、reset/seed/DEV/L2/UAT/Git 才能继续。

```text
PLAN_SCOPE=8 hosts; 12 screens; 10 flat consumers; 7 operations; tree unchanged
PLAN_STATUS=ACCEPTED_FOR_IMPLEMENTATION
INDEPENDENT_DESIGN_REVIEW=NO_GO_ROUND_2_FINDINGS_SELF_CLOSED
IMPLEMENTATION_AUTHORITY=true
RUNTIME_AUTHORITY=AUTHORIZED_R5_RUNTIME
RESET_DEV_SEED_AUTHORITY=AUTHORIZED_BY_DEXTER_2026-09-14
L2_SCRIPT_ADMISSION=BLOCKED
P8_DYNAMIC_EVIDENCE=NONE
IMPLEMENTATION_READY=YES
```
