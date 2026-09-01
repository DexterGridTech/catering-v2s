# v2s 门店销售菜单 · 串行实施计划

- 日期：2026-09-01
- 状态：`EXTERNAL_CLAUDE_DESIGN_REVIEW_GO_S_FINDINGS_RESOLVED_READY_FOR_DEXTER_IMPLEMENTATION_DECISION`
- 详设：`doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`
- 需求：`doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`
- IA：`doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`
- 交互：`doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`
- 外部评审：`doc/review/platform/2026-09-01-v2s-sales-menu-design-review-claude.md`
- 作者 intake：`doc/review/platform/2026-09-01-v2s-sales-menu-external-design-review-intake-codex.md`
- 执行原则：contract/backend/API closure → frontend/IA/L2 closure → DEV reset/seed；不得并行跨越 owner/contract 未冻结边界。

## 0 · 本计划如何使用

本文件是后续实施 agent 的串行指令，不是当前轮的实施授权。每一步都必须执行同一闭环：

1. **前读**：逐项打开该步的需求、IA、详设条款、六维 recall 全部命中、owning source；
2. **红证明**：先写能证伪目标形态的 focused test/red mutation；
3. **实施**：只改该步 finite denominator，不顺手扩未决能力；
4. **focused proof**：运行本步最低足够档位，保留首败；
5. **后读**：用第 1 步同一原文逐项回读生产源码和测试，不以 green 替代语义；
6. **独立阶段对账**：进入下一步前，由 fresh 独立子 agent 对需求/详设IA/项目记忆三维、11 个界面/设计维度给 `MATCHED|OPEN`；OPEN 先修并 fresh recheck；
7. **证据分级**：静态、compile、真实 HTTP/Testcontainers、browser L2、DEV seed、UAT 各自命名，禁止越级。

动态命令只有在 Dexter 对当次实施明确授权后才可执行。Roadmap 只记录能力授权，不替代当前会话直接指派。Git、部署、UAT 不属于本计划完成前提。

## 1 · 总顺序与不可并行边界

```text
SM-00 重新冻结输入/影响分母
  → SM-01 contract/admin/auth 唯一源与生成链
  → SM-02 sales-menu schema/module/owner 基础
  → SM-03 owner commands/publication/availability/asset transaction
  → SM-04 edge/generated handler/error/auth closure
  → SM-05 backend-acceptance + 全 API closure
  → SM-06 shared image primitive + operations-admin model/route
  → SM-07 单页 IA 全行为 + frontend focused closure
  → SM-08 sales-menu P1 + 同一 managed browser runner 扩展
  → SM-09 managed browser L2（需单独动态授权）
  → SM-10 business-channel prerequisite seed + sales-menu seed + r5-full parent
  → SM-11 managed reset/seed（需单独破坏性授权）
  → SM-12 全批三维对账、整体验证、正式 IMPLEMENTATION review
```

- SM-01 未生成并 compile 前，后端不得手写 DTO/path；
- SM-05 全部 API/business oracle 未闭合前，前端不得用 mock shape 先跑；
- SM-07 IA focused/静态对账未闭合前，不得启动 L2；
- SM-09 business 与 cleanup 均 PASS 前，不得执行 DEV reset/seed；
- 每一步独立阶段对账未关闭前，不得进入下一步。

## 2 · SM-00 · 重新冻结输入与 finite denominator

**目标**：实施者以当前仓库字节开工，确认本设计没有被并发修改或新裁定推翻。

**前读全集**：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、registry + selected Roadmap authorization；
- `doc/decisions/templates/implementation-design-template.md`；不得使用不存在的 `doc/plans/platform/implementation-design-template.md`；
- `project-memory/index.md` kernel、`scripts/context/recall-memory --task-kind implementation --domain platform --consumer-face operations-admin --owner product --impact architecture --trigger task-start` 全命中；
- 三份销售菜单需求/IA/交互、详设与本计划；
- 外部 Claude 评审及 Codex intake；详设 §5 operation 表与 §11.1a 31 行覆盖矩阵必须逐项对读；
- backend/frontend coding standards、foundation charter、active backend acceptance/browser L2/verification/independent review standards；
- §3/§5/§9a/§10b/§11 的所有 owning sources。

**只读检查**：

```bash
rg -n "SalesCollection|SalesMenuOwnerApi|sales-menu" apps/backend apps/frontend contracts scripts
rg -n -F 'const canonicalOperationCount = 180;' scripts/generate/edge-codegen.mjs
node -e "const f=require('./doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json'); console.log(f.operations.length,f.denominator.operations)"
```

**完成条件**：形成当前 exact source list；确认 sales-menu 仍为新 owner，或把已经出现的并发实现作为待核对输入。任何 operation/owner/IA 数字漂移先修详设，不带着旧数字开工。

另须复算：§5 的 31 个 operationId 与 §11.1a 31 行一一相等、无重复；每行 acceptance 非空，L2 非空或写明 `L2_NA_WITH_REASON`；矩阵引用的 scenario/case 必须分别存在于 §11.1/§11.3。这里是批次设计分母，不得写成全仓 acceptance 场景固定总数。

## 3 · SM-01 · contract、admin catalog、auth 与生成链

### 3.1 红证明先行

- `edge-codegen` self-test：source denominator 与 operation array 不等、同 operation id、错误 face、command 无 capability/recheck、生产 route 手写均失败；
- sales-menu contract source test：31 条受影响 operation（30新增+1既有 business-channel 修改）、19 command、每 route 仅 operations-admin、price integer cents、published item 必有两状态对象且无 merged boolean；
- asset contract red：stage/release path 缺 store/menu/item 任一 target、body 可覆写 target、request 无对应 version、Asset owner binding 不声明 STORE grant + actual-target recheck 时失败；
- collection contract red：channel/menu/candidate 任一 Cursor 缺 pageSize/cursor/query identity，或前端 source 出现 auto-drain/client slice 时失败；
- admin catalog test：页面仅 STORE，`EDIT_STORE_SALES_MENU` 只绑定 `PG-SALES-MENU-STORE`。

### 3.2 修改 finite denominator

1. 新增 `contracts/openapi-source/sales-menu.schemas.json`，含 target-bound asset stage/release schema与所有 Cursor page；同步扩 `business-channel.schemas.json` 的 usage/channel facts和真实 cursor；
2. 扩 edge catalog、placement catalog、error disposition catalog；
3. 扩 `contracts/catalog/admin-catalog.json` 与 IAM/auth manifest；
4. `edge-codegen.mjs` 删除 JS `canonicalOperationCount` 第二住址，改读 source denominator 并双向校验；
5. `operation-handler-bindings.mjs` 增加 owner namespace `sales-menu`，binding input 只登记真实 handler；
6. 生成 OpenAPI、Java wire/registry/auth、operations-admin TS/RTK/admin catalog；不得手改派生物。

### 3.3 执行顺序

```bash
node scripts/generate/r5-edge-materialize.mjs
node scripts/generate/edge-codegen.mjs --write
node scripts/generate/operation-handler-bindings.mjs --write
node scripts/generate/r5-edge-materialize.mjs --check
node scripts/generate/edge-codegen.mjs --check
node scripts/generate/operation-handler-bindings.mjs --check
```

若实际 CLI 与本段不同，先读脚本 main 以当前受支持参数为准；不得猜 flag 或直接改 generated output。

### 3.4 focused proof / 后读

- generator self-tests/red mutations；
- generated operation/read/command/face counts 与 source exact；
- frontend generated API typecheck、backend generated Java compile；
- `rg` 证明生产 Java/TS 无 sales-menu raw API path。

**阶段对账重点**：31 operation、contract shape、consumer face、page/action capability、错误闭集、生成物分母。

## 4 · SM-02 · schema、module 与 owner 基础

### 4.1 红证明

- migration integration 先断言 `sales_menu` schema、14 owner tables（以最终 migration exact count为准）、`platform_asset.sales_menu_asset_target`、same-schema FK/index/immutable trigger；
- ArchUnit 先断言无 sales-menu → other schema JDBC、无 other module → sales-menu reverse import；
- owner tests 先断言：一 current draft、多 immutable publication、多 enabled activation、stable item binding、duplicate catalog item refs。

### 4.2 修改

- 新 `modules/sales-menu/build.gradle.kts` 与 `com.catering.v2s.salesmenu` 四层 package；
- settings/app Gradle/module dependency registry；
- Flyway `V20260901_*__sales_menu_owner.sql`（或同 CP 相邻 asset migration）：sales_menu owner表、asset target表/索引、usage闭集；不得有 store/menu/item 跨 schema FK；
- `SalesMenuOwnerApi`、domain records/policies、repository、service；
- receipt、operation record、manual status、order swap 和 opaque cursor 基础；
- app Spring composition，不在 module 引 generated wire。

### 4.3 实施次序

1. migration + integration test；
2. stable aggregate/version/value objects；
3. repository set queries、locks/CAS/cursor；
4. public API + service；
5. module/app wiring + ArchUnit。

### 4.4 focused proof

```bash
./gradlew :apps:backend:catering-business-server:modules:sales-menu:test
./gradlew :apps:backend:catering-business-server:backendModuleBoundariesArchunitSelector
./gradlew :apps:backend:catering-business-server:test --tests '*SalesMenu*Migration*'
```

测试 selector 名以实施时真实类为准；若 app test 会进入 Testcontainers 受管边界，不得用本地 Gradle 绕过，改走已授权 managed entry。

**阶段对账重点**：owner/schema、version immutability、activation relation、no cross-schema FK、stable item/section identity。

## 5 · SM-03 · owner commands、publication、availability 与 Asset 事务

### 5.1 依赖 owner API 先实现

- Catalog：candidate page + item facts set-read；
- Inventory：availability set-read；
- BusinessChannel：既有 store-channel operation 增加 `usage=SALES_MENU`、一般 access/order facts和真实 keyset cursor；内部 API提供 exact judgment；退休当前无业务上界的 `LIMIT 101/nextCursor=null`；
- Organization：store status/timezone judgment；
- Asset：sales-menu image stage/release-STAGED/claim/task-read + owner-local `sales_menu_asset_target`；API 接收 server-owned target readback、STORE grant/contextVersion，不能只检查 workspace/usage。

每个 API 先有 task-shaped focused test与唯一消费者；严禁 screen JSON、逐 item detail 或零调用者方法。

### 5.2 menu command 顺序

按详设 §5 operation 13..31 实现：menu lifecycle → section → item → publication → manual status。每条 command 同形：

```text
parse/validate
→ owner actual-target/capability recheck
→ transaction + aggregate lock
→ receipt replay/conflict
→ business judgment
→ CAS/write/cross-owner target command
→ authoritative readback
→ success operation record + receipt
→ commit
```

已授权、已定位的业务 rejection 由 edge catch 后调用 `recordRejectedOperation` 独立事务；auth、transport、unknown internal failure 只写脱敏诊断日志。

### 5.3 publication 的 focused red cases

- draft/catalog change after publish does not change old published rows；
- publish with store/channel disabled rolls back；activation disabled does not block；
- SKU/catalog/asset invalid blocker structured；
- current draft and activation unchanged after publish；
- old publication rows reject update/delete；
- front list 20 rows uses one Catalog-free snapshot query + one Inventory set-read + one manual set-read, no N+1。

### 5.4 Asset 原子组

提取/扩 Asset usage 时同时改 contract、Asset owner service/API、migration/check、generated wire、menu item save、focused tests。固定顺序是：path target → selected STORE → `EDIT_STORE_SALES_MENU` grant → `SalesMenuOwnerApi.requireSalesMenuItemAssetTarget(mode, ...)` → Asset stage/release；whole-save claim 在 draft lock 内以 `CLAIM` 重判 target，release以 `RELEASE_STAGED`允许归档/已移除item的原target清理但不得放宽store/menu/item匹配。Asset target row必须精确记录 workspace/store/menu/item，stage/release/claim 都锁后比对；no-capability、cross-store/menu/item、wrong usage、released/version conflict 先红。已进入任一 published version 的 ACTIVE menu asset 不因 draft 替换或 archive 释放。

**阶段对账重点**：38 owner rules、copy include/exclude、publish blockers、两个状态维度、事务/receipt/CAS/audit/log ordering。

## 6 · SM-04 · edge、error/auth、generated handler closure

### 6.1 修改

- `OperationsSalesMenuController`、`OperationsSalesMenuAssetController`、wire mapper、scope resolver、failure recorder；Asset controller不得提供 workspace级通用 upload，完整 store/menu/item target只来自 generated path；
- 30 个新增 generated operation handler bindings + 1 个既有 business-channel binding/schema 修改；
- `OWNER_RECHECK_SALES_MENU` 实际 owner path；
- ErrorDisposition → owner Problem → 既有唯一 `ContractProblemAdvice` → frontend typed presenter；不得新建第二套全局 handler；
- RTK tag policy：menu summaries/detail/draft/front/preview/log exact invalidation。

### 6.2 focused proof

- 每条 generated route 恰一 handler，method/path/face exact；
- same workspace foreign store/menu/channel/item、project/external channel、no capability 全拒绝且无 menu/asset owner writes；
- unknown error不泄露 exception/raw reason；
- content/intent idempotency replay；
- app compile/spotless/static architecture。

**阶段对账重点**：read scope与write capability不同、actual target recheck 在 receipt/CAS 前、generated paths、typed errors/日志脱敏。

## 7 · SM-05 · backend-acceptance 与 API closure

### 7.1 文件与场景

- 新 `SalesMenuAcceptanceScenarios.java`，实现详设 §11.1 的13条菜单聚合业务场景；
- 既有 `BusinessChannelAcceptanceScenarios.java` 增加1条 21-channel sales-menu eligible cursor owner 场景，既有 `AssetAcceptanceScenarios.java` 增加1条 target-bound sales-menu image lifecycle owner 场景；owner 语义不得集中塞入 SalesMenu 文件；
- `BackendAcceptanceScenarioCatalog` 只登记新增 SalesMenu domain group；既有 BusinessChannel/Asset group 不重复登记；
- domain fixture/helper 留在各自 owner 文件；仅跨 domain 的通用 HTTP helper 才进入 `BackendAcceptanceTest`；
- fixture denominator明确包含21 menus与21 candidates；Asset owner场景必须覆盖 no-capability、cross-store/menu/item、wrong usage、already released/claimed和valid authoritative readback；
- operation route identity只用入口已有 generated constant。
- 以详设 §11.1a 为逐 operation 覆盖合同：31 行必须全部落实到真实 scenario request；业务语义不得只落在 `sales-menu.generated-route-contract`，也不得为每条 route 生成一个壳场景。
- 每次场景运行保留 production HTTP completion event 的 operationId，并能按 scenarioId 归因；full run 后逐行回读 31 个 operation 的实际 observed mapping。只比较场景数量、源码里出现字符串或 HTTP 2xx 都不算覆盖。

### 7.2 动态授权门

运行前重读当前 direct authority 与 `cs-managed-runtime-execution`。若当次没有 Testcontainers runtime 授权，只可完成静态/compile，不得宣称 API closure；把动态项列 `PENDING_AUTHORITY`。

获授权后逐条执行，30 秒报告，首败诊断，business/cleanup 分账：

```bash
scripts/test/backend-acceptance --operation sales-menu.store-scope-and-channel-eligibility
# 其余12条 SalesMenu、1条 BusinessChannel、1条 Asset 场景逐条
scripts/test/backend-acceptance --operation all
scripts/verify
```

若运行前有当前 manifest 明确拥有且 identity 匹配的 DEV，按 AGENTS 联动先 managed stop，记录 `DEV_WAS_RUNNING=true`；只有 Testcontainers business+cleanup PASS 才 managed restart，原来无 DEV 则不启动。不得停止未知进程或 seed。

### 7.3 closure

- CONTRACT/BUSINESS 每条 REAL；business oracle 断言字段/副作用/无写事实；
- DB_OPERATIONS 仅信息；generated run-level verifier用真实新分母测量；
- cleanup 无容器/卷/进程残留；
- §11.1a 31 行均有本次 run 的 actual completion event；observed operationId union 与当前 generated affected-operation set、§5 和矩阵 exact equality，且每行对应场景的 BUSINESS oracle 已执行。此为本批运行证据/人工 review 条件，不新增 provider、固定全仓 scenario count 或旧自动 exact-set 控制面；
- 后读 38 rules 与 owner/edge/contract，一条不漏。

**阶段对账重点**：静态 design 与真实 HTTP 结果一致；Testcontainers 不冒充 browser/DEV/UAT。

## 8 · SM-06 · shared image primitive 与 operations-admin route/model

### 8.1 foundation 最小提取

- 从 `CatalogItemBasicEditor.tsx` 的 `CatalogAssetEditor` 提取纯 presentational `AdminImageCollectionEditor` 到 admin-ui-foundation；
- primitive 只持 UI transition contract（uploading/failed/ready、retry、primary、move、delete、focus/keyboard），由 adapter 注入业务 labels/testId/upload callbacks/limits；
- Catalog adapter 保持现有 API、文案、testId 和行为；SalesMenu adapter 使用 generated sales-menu Asset API；
- foundation/Catalog focused tests先红后绿；Catalog L2 locator 字节不因提取漂移，或由原唯一 binding source同步生成。

### 8.2 route/API substrate

- admin catalog生成 `PG-SALES-MENU-STORE` 后在 `operationsPageRegistry` 注册 `catalog/sales-menus`（最终 segment 必须与 admin catalog唯一声明一致）；
- 页面只消费 global STORE `queryContext.scopeRef`，不新增门店 selector/chip；
- `OperationsApi.ts`/`OperationsTransport.ts` 接 generated sales-menu endpoints/tag policy，不在 feature `fetch`；
- 建 `features/sales-menu/model` 的 single read-model/commands/presenter 和 `salesMenuTestIds.ts`。

### 8.3 state/cursor exact rules

- 服务端 facts只在 RTK `currentData`；本地只留 scope/mode/ref/cursor/overlay/unsaved form；
- 七套 cursor stack 互不共享：channel=`store|SALES_MENU`，selector=`store|channel|SELECTOR|query`，manager=`store|channel|MANAGER|query`，candidate=`store|menu|category|query`，draft=`store|channel|menu|DRAFT|section`，front=`...|PUBLISHED|section|publication`，log=`store|channel|LOG`；
- pageSize hard UI value 20；owner nextCursor唯一前进；无 total、任意 jump、size picker/client slice；
- 禁止 effect/loop 自动请求到 `nextCursor=null`；selector 的 selected menu 由 detail query 保留，不因选项页改变而清空；
- SalesMenu image adapter 每次 generated stage/release显式传 groupWorkspaceKey/storeRef/menuRef/itemRef和version，不只依赖 ambient state；
- command成功按详设矩阵失效并权威读回；失败保持输入。

**阶段对账重点**：foundation复用不是跨 feature 依赖；scope/cursor/cache/idempotency唯一住址。

## 9 · SM-07 · 单页 IA 全行为与 frontend closure

### 9.1 composition 顺序

1. channel cards + modes + menu selector/actions；
2.真实 section panel；
3. draft/front/log 三种主 surface；
4. candidate/editor/detail/manage/schedule/publish drawers；
5. section/manual status/delete confirm overlays；
6. empty/loading/failure/refresh/focus/dirty states。

### 9.2 UI 红线逐字执行

- 不显示页内门店名称/selector；
- section/item 不拖拽；row末 `…` 的 exact actions；
- draft/front fixed columns；front 无“操作/查看”；detail非 disabled Form；
- item editor title有删除/关闭，无库存/沽清；
- SKU逐价、weighted无份约束、image最后；
- sold-out仅front status modal；库存只读且不可在 modal恢复；
- multi-menu不互斥，copy exact，disabled menu仍 edit/publish；
- publish/operation copy准确，无诊断台；
- channel cards、menu selector、manager rows、candidate panel和三表共七处 shared CursorPagination；各自固定20、显式可达第21项、没有后台自动抽干。

### 9.3 focused/static closure

- 新 IA trace test 把 UI-01..31 每项映射到具体 source/test，禁止仅搜 mockup；
- component/controller tests覆盖失败保留、focus return、dirty close、shell lock、authority readback；
- columns/actions exact set；21 channel/menu/candidate reachability 与七套 resetKey/network-call exact；raw enum/SKU/API path/testId forbidden；
- typecheck/build/foundation+Catalog regression。

**阶段对账重点**：按行为、形态、动作、关系、位置、文案、限制、状态、失败、a11y、source/invalidation 逐项审阅，不能只看 screenshot 或 typecheck。

## 10 · SM-08 · sales-menu P1 与同一 browser L2 runner

### 10.1 写唯一 source 和红测试

- `sales-menu-l2-case-blueprint.json` 16 case exact set、actions、fixture refs、network、oracles；
- `sales-menu-p1.mjs` 生成 scenario/locator/candidate/execution/timing；
- `sales-menu-l2-fixture.json` + validator；
- `sales-menu.spec.ts` 只读 generated profile；
- `salesMenuTestIds.ts` 是唯一 locator source；
- P1 red：duplicate/missing case、testId drift、route drift、network missing、fixture mismatch、activation subset、timing missing；fixture少于21 channel/menu/candidate 或network允许auto-drain时失败。
- blueprint 中每个 action 的 generated operation/network 声明与详设 §11.1a 的 L2 列对账；31 个用户可见 operation 均至少被一个 case/action 消费，若未来出现真实 L2 不适用项则必须先在详设写 `L2_NA_WITH_REASON`，不能静默漏掉。

### 10.2 runner 扩展

- 唯一入口 `scripts/test/browser-l2` 增加显式 suite 参数；
- `browser-l2-runtime.mjs` 的生命周期/secret/join/progress/cleanup保持一个；只增加窄 salesMenuSuite 的 source paths、fixture bootstrap/readback 和 spec选择；
- 不复制 run state/manifest/artifact kind，不建第二 runner/fixture registry/locator protocol；
- current catalog suite self-tests与behavior必须保持。

### 10.3 静态 proof

- P1 self-test、runner self-test、fixture validator、spec typecheck；
- discovered/selected/generated exact-set一致；committed execution为 FRAMEWORK_ONLY（无当次 readiness 时 active=0），不得手写激活；
- affected L2 registry 登记 sales-menu owning sources。
- §11.1a 中每个 L2 case 引用都存在，且其 action 声明的 generated operation union 覆盖矩阵 31 行；case 数与 operation 数不要求相等。

**阶段对账重点**：31 UI不是31 case；21st channel/menu/candidate/item/log均有明确用户动作与owner readback；每个写 action有失败不变事实；无 DEV seed输入。

## 11 · SM-09 · managed browser L2（单独动态授权）

只有 Dexter 对当次 L2 明确授权才执行：

```bash
scripts/test/browser-l2 --suite sales-menu readiness
SALES_MENU_L2_READINESS_MANIFEST=<same-run-readiness.json> node scripts/generate/sales-menu-p1.mjs --write --check
node scripts/generate/operation-handler-bindings.mjs --write --check
scripts/test/browser-l2 --suite sales-menu finalize
scripts/test/browser-l2 --suite sales-menu run
```

命令参数以实现后唯一 entry help 为准；不得手工启动 Spring/Vite/Playwright/tunnel/DB/assets。运行中每 case START/COMPLETE 和 30 秒进度；首败后不盲重试。完成必须同时满足 16/16 business、action join、repository binding、local cleanup、remote DB cleanup、remote asset cleanup、secret/session cleanup PASS。

**阶段对账重点**：真实用户动作/焦点/文案/状态与 owner readback；browser L2 不冒充 UAT。

## 12 · SM-10 · Seed code 与完整父编排

### 12.1 prerequisite 修复

- `external-collaboration-business-channel-seed-executor.mjs` 从静态占位实现为真实 owner HTTP executor；
- 当前plan只有 INTERNAL DINE_IN模板，真实channels只有EXTERNAL TAKEAWAY/GROUP_BUY；在business-channel owner plan内新增真实 INTERNAL DINE_IN 与 INTERNAL TAKEAWAY channel实例及enabled/disabled分支，同时保留EXTERNAL TAKEAWAY/project/其他order kind负例；
- plan/executor tests分别证明template不等于channel、INTERNAL不等于EXTERNAL、sales-menu只消费STORE+INTERNAL+DINE_IN/TAKEAWAY；
- 只消费其 own plan，不让 sales-menu plan 创建渠道；
- manifest/report/readback/cleanup与父 managedRunId绑定。

### 12.2 sales-menu domain seed

- `profiles/sales-menu.json`、plan、executor、tests；
- plan exact覆盖详设 §10b.3；
- executor只用 generated operations，按前置 readback解析真实 refs；
- copy等行为必须通过真实 commands造成，不能把预期结果直接写成 fixture；
- UNKNOWN inventory标 N/A_WITH_REASON，不伪造 owner state。

### 12.3 parent

- `COMPLETE_SEED_STAGE_IDS` exact：owner-command、external-collaboration-business-channel、catalog-inventory、sales-menu；
- exact order通过后以stable stage id建立`stageById`，四个owner-specific validator只读取自己的stage；删除`const catalog = stages[1]`及一切`stages[n]`业务假设；
- child顺序、same runId、business/cleanup、firstFailure、source/readback denominators；
- profile、executor、test-health显式列表同步。

**静态 proof**：四 stage正序、任一缺失/失败/run mismatch/cleanup fail使父红；交换external/catalog、四项齐全但某stage report shape属于另一owner、catalog缺失均必须红；所有 child dry-run只验证 plan，不假称数据已写。

**阶段对账重点**：每个事实只由自己的 owner seed生成；acceptance/L2 fixture仍完全独立。

## 13 · SM-11 · managed reset/seed（单独破坏性授权）

执行前必须取得 Dexter 对当次 reset/seed 的直接授权，并使用受管入口；不得因 Roadmap ready flag自行运行。调用遵循当前 `scripts/dev/*` 帮助和 managed manifest，核心 seed入口为：

```bash
R5_SEED_CONFIRMATION=EXPLICIT_R5_SEED scripts/dev/seed --profile r5-full
```

如完整体验需要 reset/start，由当前受管命令与授权明确决定；禁止手工清库/SQL/端口停止。要求：

- 四 child + parent business PASS；
- 每域 owner HTTP readback精确；
- parent/child cleanup PASS；
- DEV page实际可查看 seeded multi-menu/21 rows/states；仅 DEV体验，不称L2/UAT；
- first failure/log/PID/manifest 路径可读且脱敏。

## 14 · SM-12 · 全批收口、整体三维对账与正式 review

### 14.1 整体三维对账（整体测试前）

重新打开，不复用各步结论：

- 需求全文及31 UI；
- IA/交互/详设/计划；
- 六维项目记忆全部命中；
- 当前 contract/source/generated/backend/frontend/tests/L2/seed真实字节。

对详设规定的11维逐项 `MATCHED|OPEN`，特别检查跨步骤：contract字段与UI文案、published snapshot与front read、tag invalidation与cursor reset、copy exclusions与seed/L2、asset lifecycle与archive、两状态对象与manual modal。OPEN=0 后才进入整体测试。

### 14.2 整体验证分账

| 档位 | 证明 | 不证明 |
| --- | --- | --- |
| generator/static/compile | source-generated equality、类型、模块边界、IA静态形态 | HTTP/runtime/browser |
| backend-acceptance | Testcontainers真实HTTP/owner业务 | frontend/browser/DEV/UAT |
| browser L2 | 真浏览器+真实HTTP+TEST fixture Journey | DEV seed/UAT/终端 |
| managed seed | reset后DEV体验数据和owner readback | L2/UAT/生产 |

business 与 cleanup分别报告。任何未授权/未执行项写 `NOT_RUN_NO_AUTHORITY`，不得“设计完成”替代动态 PASS。

### 14.3 正式 IMPLEMENTATION 对抗 review

全部实现和适用动态证据完成后，建立新的 implementation review cycle，由 fresh 独立子 agent最多两轮；作者只在独立 verdict 后逐 finding 以 `CONFIRMED/PARTIALLY_CONFIRMED/REJECTED_WITH_EVIDENCE/UNVERIFIED_REQUIRES_EVIDENCE/DEXTER_DECISION` intake。第二轮硬停止 `ROUND_FINAL_DECISION=SELF_DECIDED`；不能换 reviewer重置轮次，也不能让Claude替代独立子 agent。

### 14.4 实施完成定义

只有同时满足以下条件，实施 task才可结束：

- 31 条受影响 operations（30新增+1既有修改）/19 commands/38 owner rules 当前 source重新计数一致；
- 15 个本批 backend scenarios（13 个 SalesMenu 聚合场景 + 1 个 BusinessChannel owner 场景 + 1 个 Asset owner 场景）和16 L2 cases exact source闭合；该 15 不是全仓固定 scenario 总数；
- §5 与 §11.1a 的 31 operationId exact equality；每行 acceptance/L2 映射有效，backend-acceptance actual completion events 与 L2 action join 分别证明真实覆盖，无 operation 只靠文档字符串或 route 壳通过；
- UI-01..31逐条有 focused + 适用L2事实，IA无OPEN；
- contract/backend/frontend/Testcontainers/L2/Seed各自适用proof真实完成；
- 所有阶段和整体三维对账OPEN=0；
- 正式 implementation review按两轮上限收口；
- 无把 terminal/TDP/UAT/营销/整单约束等后置项偷偷做进本批。
