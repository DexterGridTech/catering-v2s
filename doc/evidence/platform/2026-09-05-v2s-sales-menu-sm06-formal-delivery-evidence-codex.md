# V2S 销售菜单 SM-06 正式阶段交付与验证证据

```yaml
status: PASS
scope: SM-06
reviewCycleId: SM06-2026-09-05-STRUCTURE
dynamicRunId: l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43
business: PASS
cleanup: PASS
```

## 1. 范围与结论

本证据只覆盖销售菜单 SM-06（共享图片 primitive、operations-admin route/API substrate、single read model/commands、cursor/readiness 规则及 Drawer 表面收敛）。SM-07 及之后的开发、UAT、部署、切流和 DEV 验证均未开始或未纳入本次结论。页面可见性对账按 Dexter 已明确排除，不作为阻断项。

结论：SM-06 正式阶段实现、静态验证、独立步骤对账和一次 fresh 受管浏览器 L2 均已闭合；动态 business 与 cleanup 分开为 PASS。

## 2. 实现交付

- 复核并保持 `libraries/frontend/admin-ui-foundation` 的 `AdminImageCollectionEditor` 及 Catalog/SalesMenu adapter 形态，业务 labels、testId、asset API、stage/release 参数继续由 adapter 注入。
- 参照 `catalog-management` 的 `CatalogWorkbenchTaskSurfaces`，将销售菜单的 Manager、Candidate、Item Editor、Item Detail、Publish、Media UI surface 从页面编排中收敛到：
  - `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuTaskSurfaces.tsx`
  - `SalesMenuCandidateDrawer.tsx`
  - `SalesMenuItemDetailDrawer.tsx`
  - `SalesMenuItemEditorDrawer.tsx`
  - `SalesMenuItemMediaEditor.tsx`
  - `SalesMenuManagerDrawer.tsx`
  - `SalesMenuPublishDrawer.tsx`
  - `salesMenuUiShared.ts`
- `SalesMenuPage.tsx` 保留 scope、read model、commands 和页面编排，页面体量由约 3,209 行降至约 1,530 行；未新增业务语义、权限边界或数据模型。
- 修复独立复核 Round 1 的三个 finding：selector 服务端搜索接入 `showSearch/filterOption/searchValue/onSearch`；published detail 使用 `currentData` only 与 `isFetching`；candidate/manager 搜索框使用唯一 `salesMenuTestIds` 并标在真实输入节点。
- 生成物使用唯一 P1 generator；动态 run 后重新生成无 readiness 的 `FRAMEWORK_ONLY` 基线，未将当次运行绑定写入日常生成基线。
- 本 task 未写入 `apps/terminal`。工作区中另有 terminal 变更，未纳入本销售菜单 task；本次 L2 source binding 的内容范围明确排除 terminal。

## 3. 静态与步骤级独立证据

适用原文：

- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md` §8、§11
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`
- `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`
- `project-memory/operations/ui-testid-preflight-before-l2.md`
- `project-memory/practices/frontend-capability-lookup.md`
- `project-memory/decisions/owner-read-model-and-lifecycle-standard.md`

作者在本次修改后重新读取上述需求/详设/记忆与 owning source，核对 foundation 复用、global STORE scope、7 套 cursor identity、pageSize=20、`currentData`、真实 testId 节点和 Catalog 同类 surface 形态。

fresh 独立只读 subagent：

```text
REVIEW_CYCLE_ID=SM06-2026-09-05-STRUCTURE
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
STEP_RECONCILIATION=GO (static/source/focused)
M/S/N=0/0/0
```

Round 2 定向复核确认 Round 1 的 selector、published detail 和搜索 testId 三项均已修复；该 review cycle 已达到两轮上限，不再召集第三轮。动态 L2 结果见下一节。

已通过的静态命令：

- `yarn workspace @catering-v2s/operations-admin vitest run src/features/sales-menu/ui/SalesMenuPage.static.test.ts src/features/sales-menu/ui/SalesMenuPage.test.tsx src/features/sales-menu/model/salesMenuModel.test.ts`：3 files / 29 tests PASS。
- `yarn workspace @catering-v2s/operations-admin typecheck`：PASS。
- `yarn workspace @catering-v2s/operations-admin lint:architecture`：PASS。
- `node scripts/generate/sales-menu-p1.mjs --write --check`（无 readiness 环境）：`SALES_MENU_P1=PASS; CASES=18; OPERATIONS=31`，输出恢复 `FRAMEWORK_ONLY`。
- `node scripts/generate/operation-handler-bindings.mjs --write --check`：`BP_U02_BINDING_WRITE_CHECK=PASS`。
- `scripts/verify --validate-only`：`R5_VERIFY_VALIDATE_ONLY=PASS`、`EXECUTED=21/21`；相关 contract、P1、L2 runtime self-test、backend compile/ArchUnit（15/15）、PMD、Spotless 均 PASS。

## 4. Fresh 受管浏览器 L2

使用唯一受管链，未手工启动 Spring/Vite/Playwright/tunnel/DB/assets：

```text
scripts/test/browser-l2 --suite sales-menu readiness
SALES_MENU_L2_READINESS_MANIFEST=<same-run-readiness.json> node scripts/generate/sales-menu-p1.mjs --write --check
node scripts/generate/operation-handler-bindings.mjs --write --check
scripts/test/browser-l2 --suite sales-menu finalize
scripts/test/browser-l2 --suite sales-menu run
```

Run：

```text
runId=l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43
topology=LOCAL_SPRING_LOCAL_VITE_LOCAL_PLAYWRIGHT_REMOTE_DB_ASSET_TUNNEL
BROWSER_L2_READINESS=PASS; ACTIVE_CASES=18; OWNER_ITEMS=21
BROWSER_L2_SOURCE_BYTE_BINDING_FINALIZE=PASS; FILES=1459; BYTES=12564616
BROWSER_L2=PASS; DISCOVERED=18; SELECTED=18; RESULTS=18; BUSINESS=PASS; CLEANUP=PASS
```

证据文件：

- readiness：`.runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/readiness-manifest.json`
- execution：`.runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/l2-execution-manifest.json`
- join：`.runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/l2-join-artifact.json`
- cleanup：`.runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/l2-cleanup-manifest.json`
- Playwright 本体：`.runtime/browser-l2/l2-1788537303752-6068-0e2f3771-704f-4f00-a538-8746276dcd43/playwright-results.json`

Join 反向对账：

- `joinStatus=COMPLETE`；18 个 case 均 `result=passed`、`joinStatus=COMPLETE`。
- `missingDeclaredControlKeyCount=0`、`unexpectedTouchedControlKeyCount=0`、`invalidCaseScopedEventCount=0`。
- `browserRuntimeErrorCount=0`、`invalidActionMetadataCount=0`、所有 case `networkConformanceError=null`。
- HTTP completion=285，DB section rows=14,370；失败恢复 case 的 4 个 intercepted completion 属于其声明的浏览器失败分支，不是未归因错误。

31-row operation 实际执行映射从同一 run 的 HTTP/join 产物反向计算：

```text
expectedOperations=31
observedExpectedOperations=31
missing=[]
```

额外出现的 `getOperationsCatalogNavigation` 与 `getPublicAssetContent` 是页面导航/资产读取 supporting operations，不替代或稀释 31 条销售菜单 operation。负向业务场景产生的 `409`（非空分区删除）和 `404`（删除后详情读取）均位于已通过的 failure oracle 路径；不能按“所有 HTTP 必须 2xx”误判。

## 5. 永久 source binding 与资源清理

本 run 的 `repository-byte-binding.json` 内容为：

```text
scope=apps-backend-and-apps-frontend-input-files-excluding-managed-runtime-and-build-output
includedDirectories=[apps/backend, apps/frontend]
fileCount=1459
byteCount=12564616
apps/terminal fileCount=0
outside apps/backend/apps/frontend fileCount=0
```

这证明本项目约定的永久 source binding 范围仅为 `apps/backend` 与 `apps/frontend`，不因 terminal agent 的读写而扩大或误报。

cleanup：

- `l2-cleanup-manifest.json`：`business=PASS`、`cleanup=PASS`、`cleanupErrors=[]`、`firstFailure=null`。
- run runtime state：`status=FINISHED`、`cleanup=PASS`。
- 运行后 `scripts/env/check-runtime-resource-budget .runtime`：`LIVE_MANAGED_PROCESSES=0`、`MANAGED_RSS_MB=0`、`STATUS=PASS`。
- 远端隔离 DB、asset prefix、本机受管 process tree、session/private cleanup 均由受管 runner 收口；本次没有遗留受管资源。

## 6. 未宣称的边界

- 本证据是浏览器 L2 与真实 HTTP/远端隔离 middleware 的验证，不是 UAT，也不是部署或生产切流批准。
- 没有启动或声称 DEV、Testcontainers、UAT；没有进入 SM-07、SM-08 之后的实现工作。
- 31 operation 的本次覆盖与 18 个 L2 case 已动态证明；未据此宣称所有未纳入本批的 product Journey、生产数据或业务审批均完成。
- 生产 owner 逻辑在本批 18 个真实 HTTP 场景中得到动态行为证据，但不把该证据扩大为全产品生产验收。
