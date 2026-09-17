# 「门店桌台与二维码管理」实现向详设与实施计划 · Claude 第 3 次静态 DESIGN 复核请求

```text
REVIEW_TARGET=DESIGN
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN_RECHECK
REVIEW_CYCLE_ID=2026-09-17-store-service-point-qr-implementation-facing-design
REVIEW_ROUND=3
reviewerKind=CLAUDE_REVIEW_RECHECK
INDEPENDENT_BLIND_REVIEW=NOT_CLAIMED：本轮是经 Dexter 中转的 Codex/Claude 静态复核，不把续接会话包装成 fresh 独立子 agent
PRIOR_REVIEW_INPUT=Claude 第 2 轮静态 DESIGN review；原结论 NO-GO，M/S/N=1/2/2
DESIGN_GRANULARITY_MANIFEST=N/A_WITH_REASON：仓内 implementation-design-granularity 控制面已退役
REVIEW_STATUS=READY_FOR_CLAUDE_REVIEW
CODEX_DISPOSITION=COMPLETED_STATIC_ONLY
DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-09-17
IMPLEMENTATION_AUTHORITY=false
RUNTIME_AUTHORITY=NOT_AUTHORIZED
```

## 背景

本批在运营管理后台建设区域、桌台、扫码点和门店二维码配置，并在运维管理后台把 `SERVICE_POINT` 接入集团空间级扩展字段定义。需求正本、Journey、IA 和交互工件已收口，Dexter 已确认低保真线框：区域列表头部“新建区域”；选中区域后按区域类型显示“新建桌台/新建扫码点”；区域和桌台/扫码点的顺序只走列表行“…”菜单中的上移/下移；排序不在表单；二维码在主页面只读摘要中展示，编辑进入独立 Drawer；没有二维码详情页或生成区；扫码点没有图片；编辑 Drawer 的 dirty 统一由 `useDrawerFormLifecycle` 管理。

Claude 第 2 轮 review 给出 `NO-GO，M/S/N=1/2/2`。Codex 已重新打开当前需求、详设、计划和 owning source，确认并修复 1 条 Major、2 条 Significant、2 条 Note，处置记录在：

`doc/review/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-review-disposition-codex-round2.md`

请不要把处置记录或本 brief 当作事实正本，必须重新读取当前字节。

## 评审目标

请以证伪为立场，判断当前实现向详设与实施计划是否已经消除了本轮五条 finding，并且没有改变已裁决的 owner、权限、事务、生命周期、审计、资产、seed、共享 foundation 和 IA/交互语义。

## 需阅读文件

- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md`
- `doc/decisions/2026-09-17-v2s-store-service-point-qr-journey-codex.md`
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md`
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-interaction-design-codex.md`
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-codex.md`
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-plan-codex.md`
- `doc/review/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-review-disposition-codex.md`
- `doc/review/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-review-disposition-codex-round2.md`
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/claude-review-handoff-template.md`
- `project-memory/decisions/deterministic-context-only.md` 及本任务六维 recall 命中的全部项目 memory 原文
- `apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/command/CatalogInventoryWorkspaceCommandTokens.java`
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuOwnerService.java`
- `apps/backend/catering-business-server/modules/sales-menu/src/main/java/com/catering/v2s/salesmenu/application/SalesMenuAssetCommandFacade.java`
- `scripts/generate/catalog-inventory-workspace-command-tokens.mjs`
- `scripts/dev/r5-seed-plan.mjs`、`scripts/dev/owner-command-seed-executor.mjs`
- `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/AuditAcceptanceScenarios.java`

## 独立核验重点

1. **gate 分母与调用链**：当前 token 闭集应为 36 条，其中 gate=true 33 条、preflight=false 3 条；sales-menu 的 19 个写入口不在 token 链，直接调用 keyed gate；上一批 52 条只表示 `33+19` 的 gate 分母。确认详设/计划没有再把 19 条 sales-menu 写成 token→resolver，也没有把 organization 新 operation 塞入 token 链。
2. **资产 gate 场景**：详设 §11.1 的 `stageStoreServicePointImage` 与 `releaseStagedStoreServicePointImage` 必须同时绑定 `storeServicePointGateAndRoles`；V-2 的 11 个 HTTP entry 全拒绝不能靠抽样，资产生命周期场景仍需覆盖成功、失败、claim 和无孤儿。
3. **审计场景落点**：详设 §11 的场景文件集合必须包含 `AuditAcceptanceScenarios.java`，且 `storeServicePointAudit` 的四态、label snapshot、历史读出和既有回归不能被误放入 Organization 场景文件。
4. **seed 长度 guard**：详设/计划同步清单必须逐一列出 `r5-seed-plan.mjs` 与 `owner-command-seed-executor.mjs` 当前的 `definitions.length !== 8`，实施后分别改为 9；同时 host 集合为 9、flat 为 5、SERVICE_POINT 的两个 flat 标志为 null。
5. **HTTP oracle 与前端 focused 分界**：`storeServicePointGateAndRoles` 的 HTTP `businessOracle` 不应混入“disabled page sends no list request”；该观察应单列在 V-1 前端 focused proof，不能改变 11 个 HTTP entry 的业务断言。
6. **L2 前置门**：详设 §3a 与计划 P6 必须把逐个 IA-ID 的 surface/container、位置、层级、样式和行为比对列为独立前置；创建/编辑 Drawer、选中、排序、边界禁用、失败恢复不能只用 testId 存在替代。该门通过前不得进入 Browser L2。
7. **整体一致性**：20 行 HTTP operation→scenario 矩阵保持 20 个唯一 operation；本域 gate 保持 11 个 HTTP entry；需求映射仍可复算为 67/67、`missing=[]`、`extra=[]`；模板 create/update、SERVICE_POINT host、四阶段 seed 顺序、IA/交互约束均不得漂移。

## 期望结论

请只基于当前仓库字节给出：

```text
REVIEW_TARGET=DESIGN
VERDICT=GO | NO-GO
M/S/N=<数字>/<数字>/<数字>
```

每条 finding 请标明 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE`、`DEXTER_DECISION` 或 `DESIGN_GAP`，并提供仓库根相对路径、精确行号/符号、影响、最小修复及不能更小的理由。

动态与证据必须单列：契约生成、构建、测试、迁移、reset、DEV、seed、Browser L2、UAT、部署本轮均为 `NOT_RUN`/`NOT_AUTHORIZED`，不得将静态核查升级为运行 PASS。

本 brief 不授予实施或运行权限；当前详设与计划仍记录 `IMPLEMENTATION_AUTHORITY=false`、`RUNTIME_AUTHORITY=NOT_AUTHORIZED`。后续授权只以 Dexter 的直接指派为准。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请基于当前仓库字节，对「门店桌台与二维码管理」实现向详设与实施计划做第 3 次静态 DESIGN 复核。

背景：第 2 轮结论为 NO-GO，M/S/N=1/2/2。Codex 已修复确认问题，处置记录见 doc/review/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-review-disposition-codex-round2.md。请不要把处置记录当事实正本，重新打开当前需求、Journey、IA、交互、详设、计划和 owning source。
目标：重点核对 36 条 token（33 gate=true、3 preflight=false）、19 条 sales-menu 直调与上一批 52 条 gate 分母的边界；资产两个 HTTP entry 的 gate 场景归属；AuditAcceptanceScenarios.java 的场景落点；两个 definitions.length guard；以及 L2 前逐控件 IA 位置/样式/行为对照门。
材料：doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-codex.md、doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-plan-codex.md、doc/review/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-review-disposition-codex-round2.md，以及本文件“需阅读文件”中的 owning source。
结论格式：REVIEW_TARGET=DESIGN；VERDICT=GO 或 NO-GO；M/S/N=<数字>/<数字>/<数字>。每条 finding 标明确认状态、仓库根相对路径、精确行号/符号、影响、最小修复与不能更小的理由；详设缺判据列为 DESIGN_GAP。
授权边界：本轮只授权静态 DESIGN 复核，不授权生产代码、契约生成、迁移、构建、测试、reset、DEV、seed、Browser L2、UAT、部署或 Git。动态项目单列为 NOT_RUN/NOT_AUTHORIZED；当前 IMPLEMENTATION_AUTHORITY=false、RUNTIME_AUTHORITY=NOT_AUTHORIZED。
```
