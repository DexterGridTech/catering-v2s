# catering-v2s 新对话无缝交接（Codex）

更新时间：2026-08-08  
交接范围：继续系统迭代优化；当前已完成商品目录与门店轻库存 P1/P2/P3/P4 实施与验收资料收敛，下一步由新 agent 负责一次受管 DEV reset → start → seed，准备可体验环境。

## 给新 agent 的第一条消息（可直接复制）

```text
你是 catering-v2s 的后继 Codex 实施与诊断 agent。请从仓库根目录恢复真相，不要从聊天摘要或旧报告直接推断当前状态。

第一步必须按 AGENTS.md 的顺序读取：AGENTS.md、PLATFORM-BLUEPRINT.md、doc/platform/roadmap-program-registry.json 中显式 program 的当前 Roadmap CURRENT_*、project-memory/index.md 的全部 kernel、按六维路由命中的 memory 原文、scripts/README.md，以及当前 .runtime/compliance-control/active-package.json。当前 active package 是 CATALOG-INVENTORY-P4-FULL-20260807，runtimeAuthority 与 seedResetAuthority 已获授权；没有 UAT、Git 或生产部署授权。

本次你的动态任务不是 API/L2 测试，而是为 Dexter 准备 DEV 体验环境：先按受管入口执行 reset，再启动本机应用/远端非生产中间件，先执行 r5-full 基础 seed，再执行 catalog-inventory seed；必须读取 run-scoped manifest、日志、seed report 和 owner readback，分别报告 business 与 cleanup。不要直写数据库、不要用本机 PostgreSQL/Docker、不要远端启动应用、不要把 seed 当 API/L2 fixture。

执行前必须重读本交接文档的“必须阅读材料”“源代码地图”“业务与设计基线”和“受管执行顺序”。动态执行期间每 30 秒报告“已完成阶段/当前阶段/当前 runId/首败/cleanup”，不要静默等待；遇到首败先读日志和 manifest，再诊断边界，禁止延长 timeout 或盲目重试。

执行完成后给 Dexter：reset run manifest、DEV run manifest、r5-full seed report、catalog-inventory seed report、两层 readback 摘要、business/cleanup 分账、实际本机访问地址与当前账号/数据节点上下文。DEV 应保持运行供体验；不要在交付后自动 stop。
```

## 当前事实与授权边界

- 当前唯一业务 deployable 是 `apps/backend/catering-business-server`；`terminal-data-server` 仍是未来 TDP 空占位。
- 一个 PostgreSQL、多 owner schema、单 Flyway history；catalog、inventory、production-tag、asset 各自持有事实与命令，application coordinator 只编排，不持有业务资产。
- `platform-admin` 与 `operations-admin` 是两个独立前端 app；本期商品与库存页面属于 `operations-admin`。
- 当前 active package：`.runtime/compliance-control/active-package.json`，packageId 为 `CATALOG-INVENTORY-P4-FULL-20260807`。该包已允许 catalog/inventory P4 的实现与受管 reset/start/seed/API/L2；本交接只要求后续 agent 做 DEV reset/seed，不扩大到 UAT、生产、Git 或旧仓写入。
- DEV 拓扑必须是：

  ```text
  TOPOLOGY=LOCAL_APPLICATIONS_REMOTE_NON_PRODUCTION_MIDDLEWARE
  APPLICATIONS=LOCAL_HOST
  MIDDLEWARE=REMOTE_NON_PRODUCTION
  TRANSPORT=MANAGED_SSH_TUNNEL
  ```

- 刚才本会话只执行过 `scripts/dev/reset --dry-run`，输出为 `R5_DEV_RESET_DRY_RUN=PASS; DATABASE=catering_v2s_dev_r5_full; MANAGEMENT=REMOTE_SSH_EXEC`；没有 reset 数据库、没有清理媒体、没有启动 DEV、没有 seed。

## 新 agent 必须阅读的材料（顺序不可省略）

### A. 仓库控制面与长期规则

1. `AGENTS.md`
2. `PLATFORM-BLUEPRINT.md`
3. `doc/platform/roadmap-program-registry.json`
4. `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：只读当前 `CURRENT_*`，不要用历史段落覆盖当前状态
5. `project-memory/index.md`，随后打开全部 `project-memory/kernel/*.md`
6. 运行以下六维路由，并打开每个返回的 repository-relative memory 原文（查询输出不是规则本身）：

   ```bash
   scripts/context/recall-memory \
     --task-kind runtime-management --domain platform \
     --consumer-face backend --owner platform \
     --impact runtime --trigger task-start
   ```

7. `scripts/README.md`
8. `project-memory/operations/dev-command-separation.md`
9. `project-memory/operations/phase-retrospective-and-systemic-repair.md`，特别是以下条目：
   - `BACKEND_API_CLOSURE_BEFORE_FRONTEND_L2`
   - `DEV_SEED_AFTER_TEST_CLOSURE`
   - `L2_MUST_NOT_EXECUTE_API_SUITE`
   - `PHASE_FAIL_FAST_AFTER_SHARED_BARRIER`
   - `UPSERT_CONFLICT_TARGET_FOLLOWS_INDEX`
   - `STAGE_IDENTITY_MUST_INCLUDE_ALL_DIMENSIONS`
   - `HELPER_NAME_MUST_MATCH_RUNTIME_ROLE`
   - `RUNTIME_EVIDENCE_MUST_BIND_CURRENT_BYTES`
10. `doc/decisions/2026-07-24-v2s-verification-governance.md` 第 8 节：固定顺序是 backend API closure → frontend IA/L2 closure → DEV seed。
11. `doc/decisions/2026-07-29-v2s-observability-and-acceptance-standard.md`
12. `.agents/skills/cs-managed-runtime-execution/SKILL.md`、`.agents/skills/cs-memory-recall/SKILL.md`、`.agents/skills/cs-code-structure-recall/SKILL.md`

### B. 业务真相、需求、IA 与详设

1. `doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md`（当前需求唯一真相；特别读 §5.2、§5.6、§5.7、§5.9）
2. `doc/plans/platform/2026-08-05-v2s-catalog-store-light-inventory-requirements-analysis-codex.md`（独立 Codex 需求分析）
3. `doc/plans/platform/2026-08-05-v2s-catalog-inventory-requirements-analysis-claude.md`（独立 Claude 需求分析）
4. `doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md`（89 个 IA-ID、三页、抽屉、库存六区、复制预检与控件位置）
5. `doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md`（P1/P2/P3 分工、42 operations、26/100 API、18/43 L2、seed/test 分层）
6. `doc/review/platform/2026-08-07-v2s-catalog-inventory-p4-acceptance-judgment-spec-codex.md`（P4 判定规则）
7. `doc/review/platform/2026-08-07-v2s-catalog-inventory-p4-execution-diagnosis-claude.md`（P4 运行链路踩坑与根因）
8. `doc/review/platform/2026-08-08-v2s-catalog-inventory-p4-final-acceptance-review-claude.md` 与 `doc/evidence/platform/2026-08-08-v2s-catalog-inventory-p4-final-acceptance-codex.json`
9. `doc/review/platform/2026-08-06-v2s-catalog-inventory-p4-scope-registry-claude.md`

### C. 契约、fixture、seed 与测试分母

1. `contracts/openapi/catalog-inventory.openapi.yaml`
2. `contracts/catalog/catalog-inventory-edge-contract.json`
3. `contracts/catalog/catalog-inventory-read-models.json`
4. `contracts/policy/catalog-inventory-fixture-catalog.json`
5. `contracts/policy/catalog-inventory-fixture-catalog.schema.json`
6. `contracts/policy/catalog-inventory-api-scenarios.json`
7. `contracts/policy/catalog-inventory-l2-scenarios.json`
8. `contracts/policy/catalog-inventory-assertion-matrix.json`
9. `contracts/policy/catalog-inventory-media-assets.json`
10. `scripts/dev/profiles/catalog-inventory.json`
11. `scripts/dev/catalog-inventory-seed-plan.mjs`
12. `scripts/dev/catalog-inventory-seed-executor.mjs`
13. `scripts/dev/owner-command-seed-executor.mjs`
14. `scripts/test/catalog-inventory-api.mjs`、`scripts/test/catalog-inventory-l2.mjs`、`scripts/test/r5-joint-remote-l2-fixture.mjs`

重要分母：v4 来源 73 个商品、34 张真实媒体；catalog-inventory seed 依据形态准入实际创建 72 个、排除 1 个 `BENEFIT_SHELL`（原因“权益域尚未开放”）。不要为了凑 73 去伪造权益域对象。Seed 必须使用真实图片字节和 multipart 上传，不能用占位/base64/SQL。

### D. 源代码地图（必须打开，不得只看文档）

#### 后端 owner 与 coordinator

- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java`：商品、分类、字典、商品生命周期、复制候选/预检/执行、临时商品治理；catalog schema 是商品事实主权。
- `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerApi.java` 与 `CatalogOwnerTypes.java`：owner command/read API 和 typed 类型。
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java`：StockTarget、BOM、库存列表/详情六区、库存盘点/增加/调整/配置、ledger；inventory schema 是库存事实主权。
- `apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/api/InventoryOwnerApi.java`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/application/cataloginventory/CatalogInventoryApplicationService.java`：跨 owner 的任务型 read join、scope/brand 组织、结果投影；不能把 coordinator 当业务事实 owner。
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java`：operations-admin edge HTTP 路由、owner dispatch、generated operation registry 接线。
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/CatalogInventoryOperationRegistry.java`
- `apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json`

#### operations-admin 前端

- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchPage.tsx`：门店商品管理/品牌商品管理共用工作台骨架；门店数据节点、品牌全局切换、左树、域内搜索、树表切换、结果表与复制入口。
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx`：右侧宽 Drawer 的商品只读/编辑态、形态驱动页签、基础资料、SKU、点单选项、属性、生产提示、库存/BOM、治理/引用。
- `apps/frontend/operations-admin/src/features/catalog-management/ui/LocalCatalogCopyDrawer.tsx`：已有商品之间的本地配置复制；不要把它和品牌→门店复制混为一谈。
- `apps/frontend/operations-admin/src/features/catalog-management/ui/BrandCatalogCopyDrawer.tsx`：品牌→门店复制候选/预检/映射/执行界面。
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogDictionaryDrawer.tsx`：商品字典与商品处理标签入口；标签事实仍属于 production-tag owner，入口共置不改变 owner。
- `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx`：门店库存管理列表、六视图/计数、筛选和库存对象入口。
- `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryDetailDrawer.tsx`：库存详情六区；高级诊断无权限时整区和对应请求都不渲染。
- `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryActionModal.tsx`：存量盘点、库存增加、人工调整、快捷配置四动作及 before/change/after/readback。
- `apps/frontend/operations-admin/src/features/catalog-management/model/catalogModel.ts`、`apps/frontend/operations-admin/src/features/inventory-management/ui/inventoryManagementModel.ts`：read model 解码与业务状态映射；遇到缺字段不得静默用 `text/0/false/[]` 掩盖契约问题。
- `libraries/frontend/admin-ui-foundation/`：Drawer surface、overlay lock、submission lifecycle、list context、HTTP protocol、observability、automation primitive；新增 UI 行为先查 foundation，禁止在 app 重造。

#### 受管 DEV / reset / seed

- `scripts/dev/r5-dev-environment.mjs`：解析受管环境、远端 host allowlist、数据库/对象存储地址。
- `scripts/dev/r5-dev-runner.mjs`：本机 Spring Boot + 两个 Web app、远端 PostgreSQL/MinIO tunnel、PID/start-token manifest、readiness、日志与 stop。
- `scripts/dev/r5-reset.mjs`：远端 terminate → drop 精确数据库 → readback absence → 清理精确媒体 namespace；不得用本机 psql/Docker。
- `scripts/dev/catalog-inventory-seed-executor.mjs`：catalog-inventory owner HTTP seed，真实 multipart 字节、readback、run-scoped report；不可直写 SQL。
- `scripts/dev/owner-command-seed-executor.mjs`：历史/基础 `r5-full` owner-command seed。
- `scripts/dev/profiles/catalog-inventory.json`：73/34 parity、两个 owner scope、readback 与 cleanup policy。
- `scripts/env/check-runtime-resource-budget`：启动前资源/PID/RSS 预检。

## 业务与设计基线（新 agent 必须能复述）

1. 本期是交易前基础，不做菜单/销售发布、交易订单、履约运行时、外部 ERP/WMS、扣减/恢复执行、Excel 导入导出。
2. 商品形态是持久化 source fact，并进入 Java/TS 形态契约；能力、`itemKind`、`measureMode`、`skuMode`、页签和字段由形态派生，能力三态只读，前端不能传入派生事实。
3. `HAS_SKU` 的判据是存在任一非归档 SKU；停用 SKU 仍算，只有归档 SKU 才不算。形态准入矩阵在 `modeRules` 之上：先决定节点能否存在，再决定已存在节点允许 `NONE/INDEPENDENT_STOCK/BOM` 等模式。
4. owner 统一是“总公司 ref + brand ref”或“门店 ref + brand ref”；门店唯一归属一个品牌。总公司可以有真实库存对象与 BOM，但没有余额、流水、盘点/库存增加/调整，也不参与扣减。
5. 商品处理标签属于 production-tag owner，作用域是总公司+品牌与门店两级，不设项目级；入口可以和商品字典共置，不能把标签事实归 catalog。
6. 门店从自己所属的总公司+品牌显式复制；复制后本地独立，不自动同步、不自动提醒、不锁字段。判同键统一是“编码”；编码不可修改，只能作废重建。闭包、映射重写、结构兼容、两个上限（selected=20、closure=500）和 TOCTOU digest/version 是复制正确性的核心。
7. v4 的好做法要保留：左树+域内搜索、树/表视图、名称+弱化编码、复合单元格、形态驱动页签、SKU 即时矩阵、库存六分类、详情关联反查、dirty close guard、compact table。v4 的菜单/渠道、套餐引用、Excel 导入导出和独立库存创建不搬。
8. “需处理”是库存视图派生计数，不是 `stockState`；“消耗”在本期改成真实流水聚合的“库存变化”。总公司商品库无余额内容，品牌切换器是全局工具。

## P4 之后的固定测试边界（必须遵守）

- API 测试属于后台开发 package，必须在 frontend 开发前闭环；失败不能被 L2 或 seed 掩盖。
- L2 测试属于前端开发 package，前置是 IA/逐控件对账和 API 闭环；L2 只证明可见 UI、交互、状态恢复和用户任务结果，不调用 API runner、不读 API report、不依赖 API run 数据库/会话。
- API/L2 只能共享静态 contract/scenario/fixture definition，不共享运行态数据库、资产 namespace、cookie/token、report、sidecar；两层独立 runId、business、cleanup。
- DEV seed 只为 Dexter 体验，必须在 API 与 L2 都闭环之后；seed 不能成为 API/L2 fixture。seed 保留 DEV 数据，reset 负责破坏性数据库与媒体清理。

## 新 agent 的受管 DEV 执行顺序（由新 agent 执行，不由本会话执行）

### 0. 执行前

```bash
scripts/context/agent-context health
scripts/memory/build-index --check
scripts/env/check-runtime-resource-budget .runtime/r5
node --check scripts/dev/r5-reset.mjs
node --check scripts/dev/r5-dev-runner.mjs
node --check scripts/dev/catalog-inventory-seed-executor.mjs
node scripts/dev/r5-reset.mjs --self-test
node scripts/dev/r5-dev-runner.mjs --self-test
scripts/dev/seed --profile catalog-inventory --dry-run
scripts/dev/seed --profile r5-full --dry-run
```

### 1. Reset（破坏性；必须通过受管入口）

```bash
R5_RESET_CONFIRMATION=EXPLICIT_R5_RESET scripts/dev/reset
```

保存 stdout 中的 `RUN_MANIFEST`/`LOG`，并打开 reset manifest/log，确认远端数据库不存在、媒体 namespace 已清空、business 与 cleanup 分账均为 PASS。禁止 bare `psql`、本机 Docker、猜数据库名或手工 SQL。

### 2. Start（只启动，不 seed）

```bash
scripts/dev/start
```

从 `.runtime/r5/run-manifest.json` 读取本机应用 PID、tunnel identity、readiness 和实际 URL；不要按端口或旧聊天猜测进程归属。DEV start/restart 永不 seed。

### 3. 基础 `r5-full` seed

```bash
R5_SEED_CONFIRMATION=EXPLICIT_R5_SEED scripts/dev/seed --profile r5-full
```

先保证 `r5-full` 的业务事实、API 调用归属、owner readback、seed report 和 cleanup 状态真实闭环。不能把旧 `.runtime/r5/results/seed-report.*` 当作本次证据。

### 4. 商品与库存 seed

```bash
V2S_DEV_PROFILE=r5-full \
CATALOG_INVENTORY_SEED_CONFIRMATION=EXPLICIT_CATALOG_INVENTORY_SEED \
  scripts/dev/seed --profile catalog-inventory
```

不要把 `V2S_DEV_PROFILE` 设成 `catalog-inventory`；它必须保持 `r5-full`，因为 catalog-inventory executor 要复用受管 `r5-full` DEV manifest，且只通过 owner HTTP、真实 multipart 资产上传、创建/保存/回读完成。保存其 stdout 返回的 catalog seed `RUN_MANIFEST`、`REPORT`、`LOG`，检查 72 个 eligible、1 个有据排除、34 个媒体、readback 与 `noDirectDatabaseWrites=true`。

### 5. 交付前 readback

- 打开本次 `.runtime/r5/run-manifest.json` 和两个 seed 的 run manifest/report/log。
- 分别记录 `business: PASS|FAIL` 与 `cleanup: PASS|FAIL`；不能用退出码或页面能打开替代 cleanup PASS。
- 确认 DEV 进程仍是本次 manifest 所有、远端 middleware/tunnel 仍健康、媒体 namespace 有本次 seed 资产。
- 只把实际从 manifest/readback 得到的 URL、账号、管理范围（大区/项目/门店或总公司+品牌）交给 Dexter；不要把密码、OTP、token、cookie、Authorization、raw payload 写入报告。
- DEV 应保持运行，供 Dexter 打开 `operations-admin` 的“门店商品管理”“门店库存管理”“品牌商品管理”体验；不要自动 stop。

## 明确禁止的偏航

- 不把当前 roadmap 历史段落、旧 review、旧 seed report 或 dry-run 当成当前 runtime PASS。
- 不把 API 测试塞进 L2 runner，不把 L2 结果当 API 正确性，不把 DEV seed 当测试 fixture。
- 不以 `setTimeout`、延长 timeout、重复 POST 或“跑满所有用例”掩盖共享 fixture/数据库/网络首败。
- 不改写 Heritage 仓；不执行 Git；不进行 UAT/生产部署；不新增 MQ/outbox/内部 OpenAPI client；不跨 owner 直写数据库。

## 当前交接完成定义

新 agent 必须在 reset/start/两个 seed 完成后，交付一份只读可核验摘要：

```text
DEV_RESET_RUN_MANIFEST=<path>
DEV_RUN_MANIFEST=<path>
R5_FULL_SEED_REPORT=<path>
CATALOG_INVENTORY_SEED_REPORT=<path>
CATALOG_INVENTORY_READBACK=<counts/scopes/media summary>
BUSINESS_STATUS=<PASS|FAIL>
CLEANUP_STATUS=<PASS|FAIL>
DEV_URLS=<manifest-derived URLs>
NEXT=<Dexter can now experience catalog/inventory>
```

如果任一阶段失败，必须停在首败边界、保留日志与 manifest、说明是否需要 Dexter 决策；不得继续盲目跑后续阶段，也不得声称 DEV 已准备好。
