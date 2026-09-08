# v2s 门店销售菜单目标选择与细粒度沽清实施计划

```text
PLAN_STATUS=IMPLEMENTATION_EXECUTED_DYNAMIC_VALIDATION_BLOCKED
DESIGN_REF=doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-implementation-design-codex.md
REQUIREMENTS_REF=doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-requirements-amendment.md
INTERACTION_REF=doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-interaction-design-codex.md
IA_REF=doc/plans/platform/2026-09-07-v2s-sales-menu-target-selection-availability-ia-amendment.md
IMPLEMENTATION_AUTHORITY=true
INDEPENDENT_SUBAGENT_REVIEW=ROUND_2_COMPLETE_NO_GO_AUTHOR_REPAIRED
AUTHOR_SELF_DECISION=IMPLEMENTATION_MAY_PROCEED_AFTER_ACCEPTANCE_REPAIR
DYNAMIC_EXECUTION=PARTIAL_MANAGED_RUN_BLOCKED_EXTERNAL_RUNTIME
```

## 1. 计划原则与顺序

本计划按“唯一 source → generated → owner → HTTP/权限 → acceptance → frontend → L2 → seed → reset/reseed → overall reconciliation”推进。实现阶段主 agent 唯一写文件；每个 CP 结束先做步骤级三维对账，再进入下一 CP；全部 CP 后再做一次独立的整体三维对账。

历史数据库行、旧 client 兼容和回填不纳入实现。最终数据由受管 reset/reseed 重新建立；本轮已有授权但因 browser-L2 远端 runtime 首败尚未执行，不能用未执行替代 PASS。

## 2. CP-00：锁定需求与生成源

**owner**：edge contract / platform catalog。

### 修改

- 修改 `contracts/openapi-source/sales-menu.schemas.json`：option selection、selected snapshot、SKU candidates、manual target、target status、request/response/error。
- 修改相应 operation/error/placement source catalog；保持现有 operation IDs/routes，避免无必要新增 HTTP operation。
- 更新 source binding/decision hash（如当前文件维护该 binding）。

### 保留/禁止

- 保留 `skuPrices` 作为 SKU selected price rows，不新增平行 SKU 选择 endpoint。
- 保留 item-level sold-out/restore operation ID，仅扩 request target。
- 禁止手改 generated OpenAPI、Java wire、RTK/types、route registry。

### 验证

- 运行现有 generator `--check`/self-test、backend/frontend typecheck。
- 逐项核对 source required/enum/operation/error 与 generated equality。
- 记录 first failure，不以删除字段/放宽 exact set 通过。

## 3. CP-01：SalesMenu owner domain 与 Flyway

**owner**：`apps/backend/catering-business-server/modules/sales-menu`。

### 修改

- `SalesMenuSaleContent.java`、`SalesMenuSaleContentInput.java`、相关 domain records：增加 option selection/snapshot。
- `SalesMenuOwnerApi.java`、`CatalogOwnerApi` task read adapter：批量提供 SKU candidate 与 option fact。
- `SalesMenuOwnerService.java`：
  - 修复 SKU subset authoritative validation；
  - candidate read 只暴露 `ENABLED` SKU；保存与发布再次拒绝 `DISABLED`/`VOIDED` ref；
  - 实现 option snapshot replace/readback；
  - publish copy/freeze；
  - target-level manual command/readback/cleanup。
- `SalesMenuOwnerService.authoritativeOrderOptionRows(...)`：DIRECT 的提交 definitionRef 集合与 Catalog definition 集合 exact 相等；missing/extra/duplicate definition、陌生 value、required 空选择均 typed reject；optional 的显式空值仍写 group snapshot。
- `CatalogOwnerApi.SalesMenuItemFacts` 与 `SalesMenuReadback.java`：保留按 Catalog display order 的图片集合；published readback 增加不可变图片集合快照，primary 字段继续兼容紧凑列表。
- `SalesMenuOwnerService.java`：draft 读回沿用 Catalog 集合，publish 在 owner transaction 内冻结/校验集合，并让 asset retention 同时保护集合内每个引用；operation record 增加 `targetKind` 与 resolved target display snapshot。
- 新 Flyway migration（使用当天顺序号）：option snapshot tables、manual current/event target columns/keys/check、published child immutability trigger、published ordered Catalog image collection snapshot。

### 事务/失败

- update/publish/manual 都在 owner REQUIRED transaction；跨 owner 只 task read。
- typed problems 在校验前置阶段产生；任何失败无 child partial write。
- 发布移除 child target 只删除不再属于新 published set 的 child current status row，不写额外 detach event；`sales_manual_status_event.event_kind` 保持 `SOLD_OUT`/`RESTORED`。

### 验证

- owner unit/integration：exact subset、duplicate、invalid ref、required empty、shape mismatch、target membership、CAS、publish detach、inventory independence。
- 图片集合：Catalog readback 保留至少两张图片及顺序；`INHERIT_CATALOG` publish/readback 保留同一顺序；后续 Catalog 图片变化不改变 published snapshot。
- migration integration：空库 reset 跑全迁移；生成 snapshot 与 target PK/trigger 可写/不可写边界。

## 4. CP-02：HTTP edge、权限、readback

**owner**：operations edge + generated bindings。

### 修改

- `OperationsSalesMenuController.java` / `SalesMenuEdgeSupport.java`：映射 target/selection input，禁止客户端名称/加价成为权威。
- owner edge readback mapper：draft `catalogOrderOptions`/`skuCandidates`，published selected snapshot/child status。
- draft `skuCandidates` 只含当前 `ENABLED` SKU；对已保存后失效的 selected ref 保留 stale readback。若它是唯一已保存 SKU 且没有任何 `ENABLED` candidate，Drawer 只提示删除 SalesItem 或在 Catalog 恢复 SKU，保存/发布保持不可用，不在 Drawer 内修复 Catalog 事实。
- IAM/operation source manifest：保持 GET role-node range，写 command capability + owner recheck。
- error catalog/operation records：targetRef 指向 child，审计带 targetKind 与 resolved display snapshot，reason 脱敏。

### 验证

- 真实 route identity reverse check 与 generated operation budget。
- focused HTTP acceptance 设计覆盖所有新字段及负向 typed problems；`selection-negative-boundaries` 必须逐个发送 `missing-definition`、`extra-definition`、`duplicate-definition` 三个 exact-set red mutation，并证明 typed reject 与无 owner business fact mutation。
- set-based child status readback 的 DB operation observation，确保不按每行 N+1。

## 5. CP-03：后端 acceptance

**owner**：`SalesMenuAcceptanceScenarios.java`，遵守 active backend-acceptance business scenario standard。

### 修改

- 在既有类中增加第 6.1 节的业务场景；不增加 provider、scenario registry 或 direct service calls。
- 增加 `sales-menu.disabled-sku-is-not-selectable`：验证 candidate omission、直接提交 `DISABLED` ref 的 typed problem、无草稿/发布部分写入。
- 扩 helper `saleContent`，显式发送 `orderOptionSelections`；SKU helper 支持一个/多个 selected rows。
- 在 `selection-negative-boundaries` 中显式构造并发送缺失 definition、额外 definition、重复 definition 三种 request；每种都断言 `SALES_MENU_ORDER_OPTION_SELECTION_INVALID`、CONTRACT/BUSINESS/DB_OPERATIONS 分离及 no-write。
- 扩 manual helper，显式发送 `target`，并对 child readback/assert audit。

### 验证计划

- 先跑每个 focused scenario，读取 structured logs，分开记录 `CONTRACT`、`BUSINESS`、`DB_OPERATIONS`。
- 再按受管入口跑 `scripts/test/backend-acceptance --operation all`；需先按环境矩阵关闭当前 manifest-owned DEV，再在 business/cleanup 均 PASS 后恢复 DEV；本轮不运行。
- 失败按 first failure → log/PID/runner boundary → fix；不靠延长 timeout 或重复重试。

## 6. CP-04：operations-admin

**owner**：`apps/frontend/operations-admin/src/features/sales-menu`。

### 修改

- `SalesMenuItemEditorDrawer.tsx`：SKU checkbox 只渲染 `ENABLED` candidates；stale selected SKU 单独显示为不可选终态行；同时支持 option group/value selection、显式 save arrays、typed error/focus recovery。
- `SalesMenuItemDetailDrawer.tsx`：selected snapshot 与 child status 展示，不把 current Catalog options当 published事实。
- `SalesMenuItemImageGallery.tsx`：详情使用 readback 图片集合，显示计数、按顺序的缩略图和可点击原图预览；缩略图切换使用唯一动态 testId，空集合显示明确空态。
- `SalesMenuPage.tsx`、状态 Modal：target tree、item/SKU/option value target command、inventory independent copy。
- `useSalesMenuCommands.ts`、model/types：跟随 generated types，成功后权威 readback。
- `salesMenuTestIds.ts`：稳定动态 testId；覆盖真实 action node。
- 对接 foundation：`adminWideDrawerSurfaceProps`、`useDrawerFormLifecycle`、`useSubmissionLifecycle`、`useDirtyFormLock`、`testId`。

### 验证

- focused/static/unit/typecheck；验证 loading 不闪旧数据、失败保留表单、成功刷新而非乐观拼读回。
- 截图/浏览器检查：SKU 选择、普通选项 selection、状态 target tree、库存/人工并列。
- 图片验收：列表主图实际加载；详情显示多张缩略图，切换第二张后主图实际 `<img>` 加载且 alt/index 与所选图片一致；图片失败仍可重试。

## 7. CP-05：L2 与 testId

**owner**：shared browser L2 suite + operations-admin。

### 修改

- 修改批准的 sales-menu P1/生成 scenario/locator/network/timing source；不新建第二 runner。
- 覆盖 SKU 子集、重复 SalesItem、option subset、child target sold-out/restore、inventory independence。
- 覆盖详情多图：至少两张真实资产按发布快照顺序出现，第二张缩略图 action 可由生成 locator 绑定并切换主图。
- 只使用 `salesMenuTestIds.ts` 的真实 action node；不使用文本/index/CSS/XPath/等待。

### 验证边界

- 实现前 `L2_SCRIPT_ADMISSION=BLOCKED`。
- 实现后需按 managed browser L2 chain readiness → activation → generated check → finalize → run；business 与 cleanup 分开。
- L2 不替代 backend acceptance，也不能把 DEV/L2 说成 UAT。

## 8. CP-06：Catalog fixture 与 sales-menu seed

**owner**：Catalog fixture owner + sales-menu seed。

### 修改

- 当前 fixture 只有 `LATTE-001` 且仅有一个 `ENABLED` SKU，不能支撑两个互斥非空 SKU subset；实施 CP-06 必须在 Catalog fixture generator/source 中增加第二个 `ENABLED` SKU（并保留至少一个 `DISABLED` 与一个 `VOIDED` 反例），再由两个 SalesItem 各选一个。不得把 `DISABLED` 当作第二个可选 SKU，也不得继续引用不存在的 `BEV-LATTE-001`/`PASTA-BOLOGNESE-001`。
- option fixture 使用当前 Catalog owner 可真实物化的 `CAESAR_TOPPINGS` assignment（`required=true`、`selectionMode=MULTIPLE`、`minSelectionCount=1`、`maxSelectionCount=2`），并保留 `CAESAR_DRESSING` 作为 optional 零选择对照。当前 owner 对 `SINGLE` 明确拒绝 `min/max`，故不把 `CAESAR_DRESSING` 伪造成 required fixture；required-empty negative 仍由 `CAESAR_TOPPINGS` 覆盖。
- `scripts/dev/sales-menu-seed-plan.mjs`：声明 SKU subset、option subset、child target manual matrix；把一个现有 DIRECT selector 替换为 `CAESAR-001`（或 review 后的 `MILK-TEA-001`），保持 21 项 denominator，并同步 exact selector/expected readback tests；不把 Catalog candidate/option定义复制成第二 owner denominator。
- `scripts/dev/sales-menu-seed-executor.mjs`：用 Catalog HTTP readback 解析 refs；取消 `.slice(0, 2)` 全量语义；分别创建 distinct SalesItems；状态 target 使用 selected published refs。
- `sales-menu-seed-plan.test.mjs` / `sales-menu-seed-executor.test.mjs`：加入 red mutation 和 cleanup/readback assertions。

### 验证边界

- plan 只静态验证；executor 只走真实 owner HTTP，不直接 DB，不复用 L2 fixture。
- reset/reseed 后验证：两个 SKU SalesItem、一个 option subset SalesItem、child sold-out/restore、item-level matrix、report/cleanup。
- 未来动态入口：`scripts/dev/reset --profile r5-full`（具体受管 reset 命令以当前脚本帮助为准），随后 `scripts/dev/start`，再 `scripts/dev/seed --profile r5-full`；start/restart 不隐式 seed。仅在 Dexter 单独授权和 managed runner preflight 通过后执行。

## 9. CP-07：收口、对账和证据

### 9.1 步骤级对账

每个 CP 完成后用同一组三维输入逐点核对：原始用户需求/业务需求、IA/交互/实现详设、项目 memory/标准与 owning source。每项必须记录 `MATCHED` 或 `OPEN`；`OPEN` 不得进入下一 CP。

### 9.2 整批对账

全部 CP 后重新打开所有原始材料和当前源码，不把阶段对账汇总当整体对账。逐项确认：

- 行为：subset、target status、publish freeze、inventory independence；
- 形态：Drawer checkbox、option groups、status target tree、文案、focus/error；
- 关系：SalesItem → selected SKU/option snapshot → published target → manual state；
- 限制：required option、non-empty SKU、reason/confirm/CAS、no mixed shape；
- 数据来源：Catalog candidate vs SalesMenu snapshot vs Inventory overlay；
- 失败/恢复：typed problem、no partial write、detach/no resurrection；
- 测试/seed/L2：真实 refs、业务 oracle、cleanup、稳定 testId。

### 9.3 最终允许的状态

只有满足以下条件才可向 Dexter 报实施完成：生成链 PASS、静态/类型/focused PASS、backend business/cleanup PASS、L2 business/cleanup PASS（如批准）、reset/reseed business/cleanup PASS、步骤级与整批三维对账全部 `MATCHED`，并完成 fresh independent implementation review/Claude review。当前本计划已取得静态与 backend acceptance business/cleanup 证据，但 browser-L2 在受管远端 middleware/DB/tunnel 边界连续首败，reset/reseed 与 Claude implementation review 尚未闭合，因此不能报告实施完成；详见 `doc/review/platform/2026-09-08-v2s-sales-menu-target-selection-availability-implementation-reconciliation-codex.md`。
