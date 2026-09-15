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
- 当前执行状态：`SM-06_TO_SM-12_FORMAL_DELIVERY_COMPLETE_ROOT_FIX_VALIDATED_CLAUDE_REVIEW_PENDING`；门店 assignment 读取经营入口模板的权限根因已由 focused unit、真实 HTTP acceptance、Testcontainers cleanup 与 DEV 页面读回共同验证，之后由 Dexter 转交 Claude 做外部 implementation review。

> **2026-09-07 当前有效 UI 修订**：按 Dexter 的页面反馈，经营入口与菜单工作台控制合并为一个“经营入口”区块：第一行是单行占满的 rich `Select` 与右侧“管理菜单”，第二行把模式、菜单选择和当前菜单状态/时段/更新到前台/刷新动作合并为单行；channel option 文案不拆成两行。菜单由页面级分页改为下拉弹层滚动加载，新建菜单按钮位于管理菜单抽屉标题右上角，点击后以 Modal 输入名称。管理抽屉、候选区、草稿表、前台表、操作记录表的真实数据分页保留。该修订只改变 UI 形态、可达路径和测试分母，不改变 owner、Journey、权限、数据模型或既有业务 operation。当前 blueprint 为 18 个 L2 case、32 个 operation coverage 行；第 32 行是复用的既有 `getOperationsBusinessChannelTemplates` 读 operation，不代表新增业务语义。

> **2026-09-07 信息密度修订实施顺序**：先改 owning source 与共享展示 helper，再同步本原型、需求/IA/交互/详设和 static/unit proof；不改 generated contract、fixture、seed、blueprint 或 L2 case/action 分母。管理菜单时段、section 选中态、名称/编码分行、媒体来源状态、挂牌价第二列、价格比较与逐 SKU/规格一行都必须在 focused/static proof 中有可证伪断言，之后才执行已授权的 reset → DEV → seed。

> **2026-09-07 权限根因修复实施记录**：门店 assignment 的模板元数据读取复用既有 `getOperationsBusinessChannelTemplates` operation，不新增 API。edge 仅把当前门店通过既有 owner 校验得到的上级 project 与 `operatorKind=STORE` 传给 business-channel owner；项目 assignment 的原有 project scope 路径保持不变。真实 HTTP 回归复用 `business-channel.store-template-scope`，必须证明 STORE 模板可读、PROJECT 模板不可读，并分别记录 CONTRACT、BUSINESS 与 cleanup。

## 0 · 本计划如何使用

本文件是后续实施 agent 的串行指令，不是当前轮的实施授权。每一步都必须执行同一闭环：

1. **前读**：逐项打开该步的需求、IA、详设条款、六维 recall 全部命中、owning source；
2. **红证明**：先写能证伪目标形态的 focused test/red mutation；
3. **实施**：只改该步 finite denominator，不顺手扩未决能力；
4. **owning source → generator → verify**：所有生成物必须从 owning source 重生成并完成当前仓库的 `scripts/verify`（或该步明确的 `--validate-only` 等价入口）；verify 必须作用于本次新生成输出，不能在旧 generated 输出上先验；
5. **focused proof**：仅在第 4 步通过后运行本步最低足够档位，保留首败；动态场景按失败族逐个闭环，不用全量运行替代诊断；
6. **后读**：用第 1 步同一原文逐项回读生产源码和测试，不以 green 替代语义；
7. **独立阶段对账**：进入下一步前，由 fresh 独立子 agent 对需求/详设IA/项目记忆三维、11 个界面/设计维度给 `MATCHED|OPEN`；OPEN 先修并 fresh recheck；
8. **证据分级**：静态、compile、真实 HTTP/Testcontainers、browser L2、DEV seed、UAT 各自命名，禁止越级。

动态命令只有在 Dexter 对当次实施明确授权后才可执行。Roadmap 只记录能力授权，不替代当前会话直接指派。Git、部署、UAT 不属于本计划完成前提。

### 1a · 2026-09-01 CP-05 normal projection 的跨阶段边界（历史执行说明，已被后续证据 supersede）

> **状态声明（2026-09-05）**：本节记录的是 operation denominator 从 238 扩展到 268 时的历史 CP-05 pending 与 calibration 执行约束。后续受管 backend acceptance 已记录 operation measurement `268/268`，当前 `scripts/verify --validate-only` 已 PASS，因此本节的 `OPEN_GLOBAL_PREREQUISITE` 不再是当前 SM-06～SM-12 的 active blocker。以下内容保留用于解释当时的执行边界，不得覆盖本计划顶部当前状态、SM-06～SM-12 聚合证据或实施完成定义。

当前仓库的 performance source 明确规定：CP-05 budget projection 只能在当前 operation exact-set 的
真实 HTTP completion evidence、三次受管 measurement、business/cleanup PASS 后生成；在此之前只允许
保留 calibration identity projection，不得写 `pending`、null、哨兵预算或手工补 report。销售菜单把
operation denominator 从 238 扩到 268 后，SM-01 的正常（非 calibration）`edge-codegen --check` 因
缺少 `getOperationsSalesMenus` 的 CP-05 row 而失败，这是当前字节可复现的跨阶段前置依赖，不是
contract/admin/auth/source-denominator 的产品或设计偏移。

因此执行口径固定为：

1. 【历史执行口径】SM-01 当时必须先完成 source denominator → calibration edge projection → binding/admin/IAM 的静态闭环；
   `V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=CALIBRATION scripts/verify --validate-only` 是本阶段允许的
   verify 入口。正常 CP-05 首败必须保留，不能称为 normal PASS，也不能用跳过/放宽断言关闭。
2. 【历史执行口径，已关闭】该 CP-05 pending 当时不计作 SM-01 的三维设计偏移，并曾作为 `OPEN_GLOBAL_PREREQUISITE`
   保留在实施证据；该 pending 已由后续证据关闭。SM-02→SM-05 当时严格串行，期间不得提前生成预算或运行依赖未闭合 route 的 acceptance。
3. 【历史执行口径】SM-05 的真实 backend-acceptance HTTP exact-set closure 后，当时需按受管 CP-05 路径刷新 report；随后在
   进入整体测试与 SM-12 收口前，必须重新运行正常 `edge-codegen --check`、`scripts/verify --validate-only`
   及其 owning generated checks。若 CP-05 仍红，回 owning source/受管测量根因修复，不得推进整体测试。

这条修订只修正不可提前满足的验证时序，不改变任何 operation、业务语义、预算值、授权、测试分母或
SM-00→SM-12 串行顺序；若当前性能规范被后续 Dexter 裁定替换，以新裁定为准并重新记录冲突。

> **历史段落结束（2026-09-05）**：以上 1a 的 pending/open 口径不再作为当前执行准入。当前 review 只按现有 operation completion、backend acceptance、browser L2、seed/readback、cleanup 与静态 verify 证据判定，不将本历史段落重新升级为新的性能或产品阻断。

### 1b · 2026-09-01 执行路径审计与纠偏（历史复盘，已被当前交付状态 supersede）

> **状态声明（2026-09-05）**：本节记录的是 2026-09-01 的暂停恢复诊断与当时的 SM-05 recovery gate，现仅保留为历史上下文，不再作为当前 active gate。当前 SM-05 已由后续受管 backend acceptance、31-operation completion mapping、18-case browser L2、seed/readback 和 cleanup 产物收敛；当前执行入口以本计划顶部状态、SM-06～SM-12 聚合证据及本计划的实施完成定义为准。不得再次套用本节下方“不得进入 SM-06～SM-11”的历史限制。

本节是对本轮近 13 小时执行的只读复盘，不是新的产品语义或新的 operation。两名 fresh 独立审计者
分别重开当前计划、需求、IA、详设、项目记忆、owning source 及最新受管运行证据，结论一致：销售菜单
整体方向不需要推倒，当前执行算法必须停止并切换为 `SM-05` focused recovery。

已确认的执行事实：

- `.runtime/r5/evidence/remote-testcontainers/` 在 2026-09-01 的审计窗口内有 21 个相关 manifest；其中
  14 次首败为 `REMOTE_GRADLE_EXIT_NONZERO`，4 次仍停在同一 `BUDGET_PROJECTION_OPERATION_MISSING`，
  另有 1 次因既有受管 run 尚未结束而触发 `LOCAL_TESTCONTAINERS_RUN_ALREADY_ACTIVE`。因此耗时主要来自
  重复粗粒度运行与编排噪音，不是一次业务测试连续运行近 13 小时。
- 最近一轮 `r5-tc-1788271073909-91073` 直接运行 `backend-acceptance --operation all --calibration`；
  Gradle 共 101 tests、10 failures，仍同时包含 405、403、409、422、500、publication revision 与 P2
  失败族。该结果只能作为 SM-05 诊断输入，不能作为 closure，也不得再原样重跑。
- 当前 evidence 只实际收口到 SM-04（`doc/evidence/platform/2026-09-01-v2s-sales-menu-implementation-evidence-codex.md:594-730`）；
  最新 SM-05 运行尚未形成 15 条场景、每条的 BUSINESS/cleanup 分账及 31-operation 实际映射，因此
  动态证据链不完整。
- 当前工作树同时存在销售菜单以外的大量 terminal/remediation 改动。它们属于现有工作区上下文，不能被
  反向撤销，也不能混入销售菜单的阶段 closure；本批只读取相关字节并限制销售菜单的变更面。

不可继续的动作：

1. SM-05 closure 之前，不进入 SM-06/SM-07/SM-08/SM-09/SM-10/SM-11，也不做前端 mock、browser L2、
   reset 或 seed。
2. 不再用 `--operation all`、`--operation all --calibration` 或 whole-app test 作为调试循环；不在已有
   active managed run 上启动新 run；不把 CP-05、P2 connection proof、HTTP BUSINESS 失败和 cleanup 失败
   混成一个“测试红”。
3. 同一 failure signature、source/generated digest 与请求证据未发生变化时，不得第二次重跑；必须先完成
   日志读取、first failure / last known good / broken boundary 分类和 owning layer 定位。

SM-05 的唯一恢复算法：

1. 固定 `CURRENT_STAGE=SM-05`，建立 15 行场景台账（13 SalesMenu、1 BusinessChannel、1 Asset）。每行记录
   `scenarioId`、failure family、request source、owning source、最新运行、first failure、CONTRACT、
   BUSINESS、DB_OPERATIONS（信息项）、business cleanup、resource cleanup 和 31-row operation mapping。
2. 每一轮只处理一个失败族，并在该轮开始前重读需求、IA、详设/计划 SM-05、active backend-acceptance
   standard、对应 owner/edge source、scenario source、最新 run manifest/HTTP/DB/log。先判断是 contract/source、
   generated、scenario request/fixture、owner fact、编排还是环境 cleanup，禁止先凭状态码猜归属。
3. 修 owning source；若涉及契约或生成边界，先完成 source/generator 的新输出，再运行 `scripts/verify`
   （或该步骤明确的 validate-only 入口），verify PASS 后才允许 focused test。不得手改 generated、放宽断言、
   加 fallback、延长 timeout、删除场景或用 pending/null/哨兵预算止血。
4. 只运行该失败族的单条或最小必要场景，真实读取 run-scoped manifest、结构化日志、HTTP/DB evidence；分别
   判定 CONTRACT、BUSINESS、DB_OPERATIONS 与 cleanup。若仍失败，保留首败并继续根因定位，不回到全量。
5. 该失败族 focused PASS 后，执行同一组原文的后读，并由 fresh 独立子 agent 逐条三维对账；有 OPEN 就修复并
   fresh recheck，不得把 OPEN 积到 SM-05 最终测试。
6. 仅当 15 条场景都各自 focused PASS、cleanup PASS、证据完整时，才运行一次 `backend-acceptance --operation all`；
   然后用真实 HTTP completion event 对 31 个 operation 做 exact mapping。CP-05 normal projection、normal
   `edge-codegen --check` 和最终 `scripts/verify` 必须在新生成输出上按计划顺序完成，不能以 calibration PASS 代替。
7. 只有 15/15、31/31、CP-05、normal verify、cleanup 及 fresh SM-05 三维对账全部 `OPEN=0`，才允许 SM-06。

首轮只按 405 route/method 失败族恢复，覆盖 copy、generated-route、manual-sold-out/restore 相关场景；
随后依次处理已记录的 500 SKU fact、publication revision、asset/version、display-media 422、disabled-store
preview 403、ordered cursor 422 与 P2 proof。该顺序只是失败族的诊断顺序，不改变任何业务语义；每个族仍须
以当前字节和详设 oracle 重新确认，不能把审计者的归因直接当成修复授权。

本节的完成标志不是“跑过一次全量”，而是：失败族根因已闭合、15 行台账逐条有新鲜证据、SM-05 fresh
三维对账 `OPEN=0`。本节不授权扩大产品范围，也不覆盖后续 implementation review 的两轮上限。

> **历史段落结束（2026-09-05）**：以上 1b 的 failure-family 诊断、禁止推进条件和恢复算法均属于已完成前置阶段的历史记录；当前不得将其解释为 SM-06～SM-12 的 active 阻断。当前证据以本计划 SM-06～SM-12 各节及 `doc/evidence/platform/2026-09-05-v2s-sales-menu-sm06-sm12-formal-delivery-evidence-codex.md` 为准。

### 1c · 当前字节执行修订：SM-02 排序交换（2026-09-01）

详设 §10.3 的 deferred/single-CASE 排序写法与当前 database-boundaries gate 冲突：该 gate 禁止
`DEFERRABLE` 唯一约束，而当前 migration 已使用立即唯一约束。SM-02 不得通过放宽 gate 或手改 generated
输出关闭冲突。执行采用详设 §10.3a 的等价闭包：`lockAndCheck` 的 aggregate `FOR UPDATE` + CAS，current
与全序相邻行显式 `FOR UPDATE`，临时未占用 order，再以三次单行更新完成交换；每次必须影响 1 行，事务失败
整体回滚。focused/容器证明必须覆盖连续序号与删除后有空洞序号两种邻接，且检查 `canMove*` 来自 owner 全集
邻接 existence。该修订只解决立即唯一约束下的可执行性，不改变用户可见上下移动作、排序全序、operation
分母或模型边界。

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
  → SM-09 managed browser L2（本轮已获动态授权，仍须受管入口与 business/cleanup 门）
  → SM-10 business-channel prerequisite seed + sales-menu seed + r5-full parent
  → SM-11 managed reset/seed（本轮已获破坏性授权，仍须受管入口与前置门）
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
- Asset：sales-menu image stage/release-STAGED/claim/task-read + owner-local `sales_menu_asset_target`；API 接收 server-owned target readback、STORE grant/contextVersion，不能只检查 workspace/usage。菜单复制沿 Catalog 既有关系复制语义，直接复用已 ACTIVE 的 `assetRef`，不 clone Asset、不复制文件、不新增复制 operation。实现前必须读取 `CatalogOwnerService.executeCopy`、`CatalogItemMediaFacts.insertForCopy` 与 `CatalogSkuMediaFacts.insertForCopy` 的当前源码；菜单只复刻“新 owner relation 指向同一 opaque ref”的事实，不复制 Catalog item、Asset object 或 lifecycle。

每个 API 先有 task-shaped focused test与唯一消费者；严禁 screen JSON、逐 item detail 或零调用者方法。

B（结构化商品单位）必须沿用 Catalog owner 的既有 `UnitSnapshot` read path：输入请求不得有 `unitLabel`/`salesUnit`，
`SalesMenuItemFacts` 传递 `salesUnitSnapshot`；draft list/detail 现读 Catalog，published 只读
`sales_version_item` 的五列快照。只在 WEIGHTED 输出结构化 `salesUnit`，不得新增 sales-menu unit model、直接查
catalog schema 或让前端回写单位。

### 5.2 menu command 顺序

按详设 §5 operation 13..31 实现：menu lifecycle → section → item → publication → manual status。每条 command 同形：

实现 command/readback 时沿用详设 §5.2 的 target 口径：菜单级与分区级（含按分区加入商品）命令的 `targetRef` 是菜单聚合 ref；分区 path 仍必须用于 owner 关系校验，不能自动取第一分区；销售项级命令和人工沽清/恢复的 `targetRef` 是 stable `salesItemRef`。图片 stage/release 使用独立完整 `SalesMenuAssetTarget` readback。

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

实现时先取得同 key 的 owner receipt advisory lock，再锁定实际 menu/target 并完成 workspace、STORE、capability、channel、archive/version
复核；只有完成本次 owner recheck 后才读取 receipt 做 replay/conflict，不能用 receipt replay 绕过本次 target 复核；Catalog/Inventory/Asset
等业务 facts 在 replay 判定后、业务写入前重新读取。成功 action 后必须从
`SalesMenuRepository.find` 重新读取持久化 aggregate，再组装 authoritative command readback；不得用 `expectedVersion + 1` 或锁前内存
aggregate 猜造版本。成功 operation record 之后才写 `SUCCEEDED` receipt，本批不写 `IN_PROGRESS`。已授权、已定位的业务 rejection 由
edge command supplier 内 catch 后调用 `recordRejectedOperation` 独立事务；auth、transport、unknown internal failure 只写脱敏诊断日志。
`SALES_MENU_CHANNEL_INELIGIBLE` 的失败记录先由 BusinessChannel owner 做仅限 persisted STORE target 的 ownership proof，同店但不合资格可记账，跨店/无 target 不记账。

### 5.3 publication 的 focused red cases

- draft/catalog change after publish does not change old published rows；
- publish with store/channel disabled rolls back；activation disabled does not block；
- SKU/catalog/asset invalid blocker structured；
- current draft and activation unchanged after publish；
- old publication rows reject update/delete；
- front list 20 rows uses one Catalog-free snapshot query + one Inventory set-read + one manual set-read, no N+1。

### 5.4 Asset 原子组

提取/扩 Asset usage 时同时改 contract、Asset owner service/API、migration/check、generated wire、menu item save、focused tests。固定顺序是：path target → selected STORE → `EDIT_STORE_SALES_MENU` grant → `SalesMenuOwnerApi.requireSalesMenuItemAssetTarget(mode, ...)` → Asset stage/release；whole-save claim 在 draft lock 内以 `CLAIM` 重判 target，release 以 `RELEASE_STAGED` 允许归档/已移除 item 的原 target 清理但不得放宽 store/menu/item/usage 匹配。`SalesMenuAssetReleaseRequest` 只有 `expectedAssetVersion`，release 不接受或猜造 draft version；Asset owner 锁定 staged asset 与 target row 后，以保存的 target 版本做 authoritative readback，并以 asset version 做 CAS。Asset target row 必须精确记录 workspace/store/menu/item，stage/release/claim 都锁后比对；no-capability、cross-store/menu/item、wrong usage、released/version conflict 先红。已进入任一 published version 的 ACTIVE menu asset 不因 draft 替换或 archive 释放。已 ACTIVE 的菜单图片（包括复制得到的共享 `assetRef`）不再次 claim；复制只新增 menu media relation，不新增 Asset target row。

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
- app compile/spotless/static architecture；
- 构造 persisted menu version 与 expected/in-memory version 不同的 red case，验证 command readback 使用 owner `find` 的 persisted version；
- create、activation、manual sold-out/restore 的 in-supplier channel eligibility failure 经过 recorder；auth、transport、unknown failure 不生成 FAILED operation record；
- receipt order 验证 target lock/recheck → receipt replay/conflict → business preflight → CAS/write → authoritative readback → success record → `SUCCEEDED` receipt，且不存在 `IN_PROGRESS` 写入。

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

获当前授权后，先确认无 active managed run，再按“source/generator → fresh generated output → `scripts/verify`
（或该步明确的 validate-only 入口）→ focused scenario”的顺序逐条执行；每次受管运行 30 秒报告，首败诊断，
business/cleanup 分账。`verify` 必须发生在本批所有 focused/all 测试之前，且不能针对旧 generated 输出先验：

```bash
# 先在最新 owning source 生成并校验；不能省略或移到测试之后
scripts/verify

scripts/test/backend-acceptance --operation sales-menu.store-scope-and-channel-eligibility
# 其余12条 SalesMenu、1条 BusinessChannel、1条 Asset 场景逐条
scripts/test/backend-acceptance --operation all
```

不得用 `--operation all`（含 calibration）替代失败族 focused recovery；只有 15 条场景都各自 focused PASS
并完成后读/独立阶段对账后，才运行一次 all。

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
- 两套 dropdown candidate accumulator 与五套表格 cursor stack 互不共享：channel=`store|SALES_MENU`、selector=`store|channel|SELECTOR|query` 使用 `useCursorCandidates`；manager=`store|channel|MANAGER|query`、candidate=`store|menu|category|query`、draft=`store|channel|menu|DRAFT|section`、front=`...|PUBLISHED|section|publication`、log=`store|channel|LOG` 使用 `useCursorStack`；
- pageSize hard UI value 20；owner nextCursor唯一前进；无 total、任意 jump、size picker/client slice；
- 禁止 effect/loop 自动请求到 `nextCursor=null`；selector 的 selected menu 由 detail query 保留，不因选项页改变而清空；
- SalesMenu image adapter 每次 generated stage/release显式传 groupWorkspaceKey/storeRef/menuRef/itemRef和version，不只依赖 ambient state；
- command成功按详设矩阵失效并权威读回；失败保持输入。

**阶段对账重点**：foundation复用不是跨 feature 依赖；scope/cursor/cache/idempotency唯一住址。

## 9 · SM-07 · 单页 IA 全行为与 frontend closure

### 9.1 composition 顺序

1. 单一“经营入口”区块：第一行 channel selector + 管理菜单，第二行 modes + menu selector/actions；第二行保持单行，channel option 保持单行；
2. 真实 section panel；桌面 section 列收窄约四分之一，行文本左对齐，选中态复用商品数模块的浅色 token 样式；
3. draft/front/log 三种主 surface；draft/front columns 以菜单商品、挂牌价开头，草稿媒体来源和名称/编码分行；
4. candidate/editor/detail/manage/schedule/publish drawers；
5. section/manual status/delete confirm overlays；
6. empty/loading/failure/refresh/focus/dirty states。

### 9.2 UI 红线逐字执行

- 不显示页内门店名称/selector；
- section/item 不拖拽；row末 `…` 的 exact actions；
- draft/front fixed columns；front 无“操作/查看”；detail非 disabled Form；
- item editor title有删除/关闭，无库存/沽清；
- SKU逐价、weighted无份约束且只读展示 Catalog 结构化 `salesUnit`、image最后；
- sold-out仅front status modal；库存只读且不可在 modal恢复；
- multi-menu不互斥，copy exact，disabled menu仍 edit/publish；
- publish/operation copy准确，无诊断台；
- channel selector 与 menu selector 使用下拉弹层候选增量加载，不显示页码；manager rows、candidate panel 和 draft/front/log 三表保留五处 shared `CursorPagination`，各自固定 20、显式可达第 21 项、没有后台自动抽干。页面只有一个“经营入口”区块，不再有独立“菜单工作区”区块；模式、菜单和菜单动作共用同一水平行。
- 草稿挂牌价相等时只显示挂牌价，不等时显示菜单/默认两种价格；草稿与前台的 SKU/规格名称和价格均逐行渲染，不使用 `、`/`；` 拼接，前台只显示已发布挂牌价。

### 9.3 focused/static closure

- 新 IA trace test 把 UI-01..31 每项映射到具体 source/test，禁止仅搜 mockup；
- component/controller tests覆盖失败保留、focus return、dirty close、shell lock、authority readback；
- columns/actions exact set；21 channel/menu/candidate reachability 与两套 candidate resetKey、五套 table resetKey/network-call exact；raw enum/SKU/API path/testId forbidden；
- typecheck/build/foundation+Catalog regression。
- 管理菜单 `draftSchedule` 列、section 选中 token、媒体来源文字、名称/编码分行和两张销售项表的列序/价格行结构（含前台 SKU 逐行挂牌价）有静态红证明。

**阶段对账重点**：按行为、形态、动作、关系、位置、文案、限制、状态、失败、a11y、source/invalidation 逐项审阅，不能只看 screenshot 或 typecheck。

## 10 · SM-08 · sales-menu P1 与同一 browser L2 runner

### 10.0 · L2 脚本开发前 UI/testId 前置准入（必须先完成）

在 SM-08 开始或继续修改任何 L2 spec、runner adapter、locator binding 或 blueprint 控件声明之前，先按
`doc/platform/browser-l2-execution-standard.md` §3.1、`doc/platform/frontend-coding-standard.md` §3-K-9
和 implementation-facing 详设模板 §3a 完成 UI 前置复核。顺序固定为：重开需求/IA/详设与前端规范 → 查看
Catalog 等既有同类模块及 foundation 消费者 → 按每个 case/action 穷举真实操作控件 → 为每个控件核对
`*TestIds.ts` 唯一常量、真实动作节点、稳定业务身份和 binding/touch → UI focused/static proof → fresh
独立复核。

Modal/Drawer 操作、动态行菜单、分页及 AntD wrapper 后的 native input/file input 都必须进入控件分母；
role/label/placeholder/text/index/CSS/XPath 或外层 wrapper 不能替代 testId。任一 UI 设计对账、testId 节点
绑定或 focused/static proof 为 OPEN，都不得进入 10.1 的 L2 source/generator/spec 修改。

当前销售菜单执行前置状态：`UI_DESIGN_REVIEW=PASS`、`TESTID_REVIEW=PASS`、`L2_SCRIPT_ADMISSION=PASS`。
依据 `doc/review/platform/2026-09-03-v2s-sales-menu-ui-testid-preflight-cycle-c-round2-codex.md` 的 fresh independent
Round 2 final review，前置门已关闭；该 PASS 仅解除 L2 脚本开发准入，不代表动态浏览器 L2、HTTP、business 或 cleanup 已通过。

当前准入分母已按唯一 blueprint 复算为 18 个 case/action、231 个声明控件条目、65 个 case-used unique control key、75 个
locator binding control key；共享 scope surface 的 trigger、selector、动态 option、confirm、cancel 均使用 `roleHomeTestIds`
唯一源并逐控件建模；本固定 STORE/STORE-readonly Journey 的 setup 只实际记录 `STORE_SCOPE_TRIGGER`。逐
case/action 的常量、实际节点、binding/touch、focused/static proof 与 fresh review 表在
详设 §11.2a，实施以该表为唯一逐控件清单。菜单级直接按钮、manager 动态行 MenuItem、Modal/Drawer 提交与
取消、分页、候选 Checkbox、Radio、Upload native input 和既有 Segmented option label anchor 均不得从分母
省略。当前已为 `PASS/PASS/PASS`；后续动态运行必须继续按受管入口取得独立 business/cleanup 证据，不能把本前置 PASS 当作浏览器 PASS。

### 10.1 写唯一 source 和红测试

- `sales-menu-l2-case-blueprint.json` 18 case exact set、actions、fixture refs、network、oracles；
- `sales-menu-p1.mjs` 生成 scenario/locator/candidate/execution/timing；
- `sales-menu-l2-fixture.json` + validator；
- `sales-menu.spec.ts` 只读 generated profile；
- `salesMenuTestIds.ts` 是唯一 locator source；
- P1 red：duplicate/missing case、testId drift、route drift、network missing、fixture mismatch、activation subset、timing missing；fixture少于21 channel/menu/candidate 或network允许auto-drain时失败。
- blueprint 中每个 action 的 generated operation/network 声明与详设 §11.1a 的 L2 列对账；31 个受影响 sales-menu operation 均至少被一个 case/action 消费，另有 1 个复用的 business-channel template read operation 支撑 rich channel option 展示；若未来出现真实 L2 不适用项则必须先在详设写 `L2_NA_WITH_REASON`，不能静默漏掉。
- UI 修订静态约束由 `SalesMenuPage.static.test.ts` 与 `scripts/test/browser-l2-runtime.test.mjs` 共同守门：channel option 不得使用 vertical layout，经营入口区块不得出现“菜单工作区” Card，模式/菜单/动作必须来自同一不换行 Row；该修订不增加 L2 action 或 operation 分母。

### 10.2 runner 扩展

- 唯一入口 `scripts/test/browser-l2` 增加显式 suite 参数；
- `browser-l2-runtime.mjs` 的生命周期/secret/join/progress/cleanup保持一个；只增加窄 salesMenuSuite 的 source paths、fixture bootstrap/readback 和 spec选择；
- 不复制 run state/manifest/artifact kind，不建第二 runner/fixture registry/locator protocol；
- current catalog suite self-tests与behavior必须保持。

### 10.3 静态 proof

- P1 self-test、runner self-test、fixture validator、spec typecheck；
- discovered/selected/generated exact-set一致；committed execution为 FRAMEWORK_ONLY（无当次 readiness 时 active=0），不得手写激活；
- affected L2 registry 登记 sales-menu owning sources。
- §11.1a 中每个 L2 case 引用都存在，且其 action 声明的 generated operation union 覆盖 31 条受影响 sales-menu operation，并包含 1 条复用的 template read operation；case 数与 operation 数不要求相等。

**阶段对账重点**：31 UI不是31 case；channel/menu 第 21 项经下拉弹层滚动到达，candidate/item/log 第 21 项经显式分页到达，均有明确用户动作与 owner readback；每个写 action 有失败不变事实；无 DEV seed 输入。

## 11 · SM-09 · managed browser L2（本轮已获动态授权）

本轮 direct authority 已包含当次 L2；仍只能在 SM-08 完成、受管 runner readiness 通过且 business/cleanup
门可满足时执行。不得因 Roadmap ready flag自行运行，也不得手工启动 Spring/Vite/Playwright/tunnel/DB/assets：

```bash
scripts/test/browser-l2 --suite sales-menu readiness
SALES_MENU_L2_READINESS_MANIFEST=<same-run-readiness.json> node scripts/generate/sales-menu-p1.mjs --write --check
node scripts/generate/operation-handler-bindings.mjs --write --check
scripts/test/browser-l2 --suite sales-menu finalize
scripts/test/browser-l2 --suite sales-menu run
```

命令参数以实现后唯一 entry help 为准；不得手工启动 Spring/Vite/Playwright/tunnel/DB/assets。运行中每 case START/COMPLETE 和 30 秒进度；首败后不盲重试。完成必须同时满足 18/18 business、action join、repository binding、local cleanup、remote DB cleanup、remote asset cleanup、secret/session cleanup PASS。

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
- copy等行为必须通过真实 commands造成，不能把预期结果直接写成 fixture；SalesMenu CUSTOM 图片必须断言源/副本 media `assetRef` 完全相同、Asset 行/object/lifecycle 不变，且无 clone/stage/claim/release 调用。测试前后以 `CatalogItemMediaFacts.insertForCopy`/`CatalogSkuMediaFacts.insertForCopy` 当前源码的 relation-only 语义作静态对照，不调用、抽取或跨 owner 复用这些 package-private 类；sales-menu 只写自己的 media relation；
- UNKNOWN inventory标 N/A_WITH_REASON，不伪造 owner state。

### 12.3 parent

- `COMPLETE_SEED_STAGE_IDS` exact：owner-command、external-collaboration-business-channel、catalog-inventory、sales-menu；
- exact order通过后以stable stage id建立`stageById`，四个owner-specific validator只读取自己的stage；删除`const catalog = stages[1]`及一切`stages[n]`业务假设；
- child顺序、same runId、business/cleanup、firstFailure、source/readback denominators；
- profile、executor、test-health显式列表同步。

**静态 proof**：四 stage正序、任一缺失/失败/run mismatch/cleanup fail使父红；交换external/catalog、四项齐全但某stage report shape属于另一owner、catalog缺失均必须红；所有 child dry-run只验证 plan，不假称数据已写。

**阶段对账重点**：每个事实只由自己的 owner seed生成；acceptance/L2 fixture仍完全独立。

## 13 · SM-11 · managed reset/seed（本轮已获破坏性授权）

本轮 direct authority 已包含当次 reset/seed；仍必须在 SM-09 business 与 cleanup 均 PASS、SM-10 静态
stage/parent closure 后使用受管入口，不得因 Roadmap ready flag自行运行。调用遵循当前 `scripts/dev/*` 帮助和
managed manifest，核心 seed入口为：

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

### 14.0 · 2026-09-07 当前 UI 图片投影与密度修订

1. 先复核 Catalog 已有 `CatalogAssetPreview` 的真实请求、加载、失败和本地文件行为，再将其移动为 app 级 `AssetPreview`；Catalog 文件只保留兼容导出，SalesMenu 不反向依赖 Catalog feature。
2. 在契约源和物化组件中为草稿 `SalesMenuDraftItemView` 增加 nullable `catalogPrimaryImageAssetRef`，由 SalesMenu owner 透传 Catalog 已有 `defaultImageAssetRef`，执行 edge-codegen 生成 Java/TypeScript，不手写 generated 文件。
3. 草稿列表和编辑媒体区域按展示模式选择共享图片预览：自定义模式使用菜单媒体主图，沿用模式使用 Catalog 当前主图；没有资源时由共享组件显示“图片不可用/重试加载”状态。
4. 页面移除重复标题，分区新增使用普通主按钮，分区 action node 显式左对齐，草稿挂牌价列固定 160px；不新增操作、迁移、seed 分母或产品语义。

本步骤的交付分母：五项用户界面意见、Catalog→SalesMenu 图片引用链一条、两份契约源同步、两类 generated edge 同步、共享预览组件一个、后端 owner 单测一个、前端静态/单测与浏览器逐项验证各一组。

### 14.1 整体三维对账（整体测试前）

重新打开，不复用各步结论：

- 需求全文及31 UI；
- IA/交互/详设/计划；
- 六维项目记忆全部命中；
- 当前 contract/source/generated/backend/frontend/tests/L2/seed真实字节。

对详设规定的11维逐项 `MATCHED|OPEN`，特别检查跨步骤：contract字段与UI文案、published snapshot与front read、tag invalidation与cursor reset、copy exclusions与seed/L2、asset lifecycle与archive、两状态对象与manual modal。OPEN=0 后才进入整体测试。

### 14.2 整体验证分账

| 档位                     | 证明                                                  | 不证明                   |
| ------------------------ | ----------------------------------------------------- | ------------------------ |
| generator/static/compile | source-generated equality、类型、模块边界、IA静态形态 | HTTP/runtime/browser     |
| backend-acceptance       | Testcontainers真实HTTP/owner业务                      | frontend/browser/DEV/UAT |
| browser L2               | 真浏览器+真实HTTP+TEST fixture Journey                | DEV seed/UAT/终端        |
| managed seed             | reset后DEV体验数据和owner readback                    | L2/UAT/生产              |

business 与 cleanup分别报告。任何未授权/未执行项写 `NOT_RUN_NO_AUTHORITY`，不得“设计完成”替代动态 PASS。

### 14.3 正式 IMPLEMENTATION 对抗 review

全部实现和适用动态证据完成后，建立新的 implementation review cycle，由 fresh 独立子 agent最多两轮；作者只在独立 verdict 后逐 finding 以 `CONFIRMED/PARTIALLY_CONFIRMED/REJECTED_WITH_EVIDENCE/UNVERIFIED_REQUIRES_EVIDENCE/DEXTER_DECISION` intake。第二轮硬停止 `ROUND_FINAL_DECISION=SELF_DECIDED`；不能换 reviewer重置轮次，也不能让Claude替代独立子 agent。

### 14.4 实施完成定义

只有同时满足以下条件，实施 task才可结束：

- 31 条受影响 operations（30新增+1既有修改）/19 commands/38 owner rules 当前 source重新计数一致；
- 15 个本批 backend scenarios（13 个 SalesMenu 聚合场景 + 1 个 BusinessChannel owner 场景 + 1 个 Asset owner 场景）和18 L2 cases exact source闭合；该 15 不是全仓固定 scenario 总数；
- §5 与 §11.1a 的 31 operationId exact equality；每行 acceptance/L2 映射有效，backend-acceptance actual completion events 与 L2 action join 分别证明真实覆盖，无 operation 只靠文档字符串或 route 壳通过；
- UI-01..31逐条有 focused + 适用L2事实，IA无OPEN；
- contract/backend/frontend/Testcontainers/L2/Seed各自适用proof真实完成；
- 所有阶段和整体三维对账OPEN=0；
- 正式 implementation review按两轮上限收口；
- 无把 terminal/TDP/UAT/营销/整单约束等后置项偷偷做进本批。

### 14.5 2026-09-07 商品形态/销售规格专项修订执行项

本专项以 `doc/plans/platform/2026-09-07-v2s-sales-menu-specification-display-amendment-codex.md` 为补充正本，按以下顺序执行：

1. 前读 Catalog order-option owner facts、SalesMenu readback/wire、sales-menu schema、现有 Catalog order-option presenter 与测试；确认一次 set read 能覆盖普通商品点单选项。
2. 先补 typed Catalog→SalesMenu facts 和 owner/readback/edge contract，再由 edge-codegen 重生成 generated Java/TypeScript；不得手改 generated。
3. 修改共享 sales-menu specification presenter 与 draft/front 两张表：移除独立商品形态列，将中文商品形态放到首列编码下方，普通商品选项逐项展示。
4. 更新 static/unit/backend owner tests 与当前详设/IA/requirements 文档；执行本步骤 `逐代码与详设对账`，逐项检查字段来源、列顺序、空值、SKU/选项优先级、无 N+1。
5. 只运行最小静态/单元/编译 proof；动态 DEV/浏览器验证必须另按当前授权执行。验证必须保留 ordinary-with-options 的正例和 empty-options 的反例。

### 14.6 2026-09-15 编辑销售项关联商品入口执行项

本增补复用现有 Catalog 商品详情 surface，不新增后端实现单元：

1. 在销售项编辑 Drawer 标题操作区加入“查看商品”，以 owner detail readback 的 `itemCode` 为唯一目标，并登记
   `salesMenuTestIds.itemViewProduct`；未读回时不可点击。
2. 由 `SalesMenuPage` 持有商品详情目标与触发点，`SalesMenuTaskSurfaces` 通过 `CatalogItemDrawer` router 以
   `initialMode='view'` 组装现有商品详情；传当前门店 scope、只读权限边界，销售项编辑 Drawer 保持打开。
3. 让既有 `CatalogItemViewDrawer` 暴露可选的关闭完成回调，关闭后恢复入口焦点；商品详情读取、错误和重试继续由
   Catalog owner surface 负责。
4. 执行 focused static/unit/typecheck proof，并按需求 §11.3、IA §13、交互 §11、详设 §14.6 逐代码对账；本增补
   不自动执行 DEV、reset、seed、browser L2 或动态后端验收。
