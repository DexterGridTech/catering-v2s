# 「门店桌台与二维码管理」实现向详设与实施计划 · Claude 第 2 次静态 DESIGN review 请求

```text
REVIEW_TARGET=DESIGN
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_CYCLE_ID=2026-09-17-store-service-point-qr-implementation-facing-design
REVIEW_ROUND=2
reviewerKind=CLAUDE_INDEPENDENT_STATIC_REVIEW
PRIOR_REVIEW_INPUT=Claude 经 Dexter 转交的文本；原文本明确是作者自审，不计作独立盲审
DESIGN_GRANULARITY_MANIFEST=N/A_WITH_REASON：仓内 implementation-design-granularity 控制面已退役
REVIEW_STATUS=READY_FOR_CLAUDE_REVIEW
CODEX_DISPOSITION=COMPLETED_STATIC_ONLY
DEXTER_WIREFRAME_REVIEW=ACCEPTED_2026-09-17
IMPLEMENTATION_AUTHORITY=false
RUNTIME_AUTHORITY=NOT_AUTHORIZED
```

## 背景

本批在运营管理后台建设区域、桌台、扫码点和门店二维码配置，并在运维管理后台把 `SERVICE_POINT` 接入集团空间级扩展字段定义。需求正本、Journey、IA 和交互工件已收口，Dexter 已确认低保真线框：区域列表头部“新建区域”；选中区域后从属列表头部按区域类型显示“新建桌台/新建扫码点”；区域和桌台/扫码点的顺序只走列表行“…”菜单中的上移/下移；排序不在表单；二维码在主页面只读摘要中展示，编辑进入独立 Drawer；没有二维码详情页或生成区；扫码点没有图片；编辑 Drawer 的 dirty 统一由 `useDrawerFormLifecycle` 管理，子控件不得自行提示“请先保存”。

Codex 已根据上一份 Claude review 输入重新打开当前需求、设计文档、计划、project memory 和 owning source。上一份输入给出 `NO-GO，M/S/N=4/3/3`，共 10 条 finding，10 条均已逐条处置：M-01 至 M-04、S-01 至 S-03、N-01 至 N-02 已修入当前详设/计划；N-03 以当前字节静态展开复算为 `REJECTED_WITH_EVIDENCE`。请不要把处置记录当作事实结论，必须重新打开当前字节独立判断。

## 评审目标

请以证伪为立场，判断当前实现向详设与实施计划是否已经能指导后续实施，且没有改变已裁决的用户任务、owner、权限、事务、生命周期、审计、资产和共享前端 foundation 语义。重点确认本轮修订没有把一个问题从 seed/契约层转移到另一个不一致的边界。

## 需阅读文件

- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md`
- `doc/decisions/2026-09-17-v2s-store-service-point-qr-journey-codex.md`
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md`
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-interaction-design-codex.md`
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-codex.md`
- `doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-plan-codex.md`
- `doc/review/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-review-disposition-codex.md`
- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/review-standard.md`、`doc/platform/claude-review-handoff-template.md`
- `project-memory/decisions/deterministic-context-only.md` 及本任务六维 recall 命中的全部项目 memory 原文
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/api/StoreOperatingRuleGate.java`
- `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/BusinessEntityService.java`
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/CommandExecutionContextResolver.java`
- `apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/command/WorkspaceCommandOperationToken.java`
- `scripts/generate/catalog-inventory-workspace-command-tokens.mjs`
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/api/ExtensionHostTypes.java`
- `apps/backend/catering-business-server/modules/extension/src/main/java/com/catering/v2s/extension/application/ExtensionDefinitionService.java`
- `scripts/dev/r5-seed-plan.mjs`、`scripts/dev/owner-command-seed-executor.mjs`、`scripts/dev/r5-complete-seed-executor.mjs`
- `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json`
- `contracts/openapi/components/business-channel/business-channel.schemas.json`
- `contracts/openapi/paths/operations-admin/business-channel.paths.json`
- `contracts/openapi/paths/platform-admin/extension-definition.paths.json`
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx` 与 `libraries/frontend/admin-ui-foundation`

## 独立核验重点

1. **Gate 的实际落点**：需求正本 R-5.9 仍要求既有 gate/token 标志按开关键泛化。请确认当前详设的两条链是否成立：新 organization owner 直接调用 `StoreOperatingRuleGate.requireStoreOperatingRuleForStoreTarget(..., ruleKey)` 使用 `tableManagementEnabled`；既有 52 条 catalog/inventory/sales-menu/asset command 仍通过 token→resolver→keyed gate 且保持 `catalogManagementEnabled` 语义；没有把 organization 错放入当前 token 链，也没有用前端绕过后端 gate。检查“保留旧 `requireCatalogManagementForStoreTarget` 并委托”的兼容形态是否会造成异常、错误码或权限语义漂移。
2. **本域 gate 分母**：确认 11 个 HTTP entry 恰为 9 个 organization command 加 2 个 asset stage/release；`claimStoreServicePointImage` 确实没有 HTTP path，只作为 point owner REQUIRED 事务内步骤，并且 V-2/acceptance 对 claim 的成功、失败和无孤儿资产仍有可证伪观察。不要把内部方法重新算成 HTTP operation，也不要漏掉两条 asset entry。
3. **模板 URL rule 契约**：确认 `BusinessChannelTemplateCreateRequest` 与 `BusinessChannelTemplateUpdateRequest` 都必须增加 nullable `urlRule`，目标四维的空/合法值和非目标维度的 null 约束在 owner、projection、seed 与 acceptance 中一致；create 不能被迫依赖创建后的二次 PATCH。
4. **SERVICE_POINT host 与 seed fixture**：确认当前基线 host=8、实施后 host=9、flat host=5；`ExtensionHostTypes`、有序 `MANAGEMENT_HOST_TYPES`、`r5-seed-plan.mjs`、`owner-command-seed-executor.mjs` 与 `doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json` 的集合/数量/顺序约束清楚，`SERVICE_POINT` 的 `listDisplay/searchable` 为 null，缺项或回退 8 的 red mutation 会失败。
5. **seed 的真实顺序与开关**：确认 `r5-complete-seed-executor.mjs` 的既有四阶段及顺序不变；owner-command 阶段不在渠道存在前写 enabled QR config；external collaboration 阶段完成 channel owner readback 后，在同一既有 stage 执行 organization owner 的 QR config save post-step；功能 fixture store 显式 readback `catalogManagementEnabled=true` 与 `tableManagementEnabled=true`，不能依赖默认值。
6. **HTTP operation 场景完整性**：逐行检查详设 §11.1 的 20 行 operation→scenario 矩阵：organization 13、candidate 1、template create/update 2、platform extension 既有读写 2、asset stage/release 2；每行绑定真实 scenario，scenario 的 `identity`、`fixture`、`request`、`businessOracle` 非空且不是只断言 HTTP status。内部 `requireQrChannel`、`deriveQrServicePointUrl`、`claimStoreServicePointImage` 不计 HTTP 行，但必须在 business oracle 中观察。
7. **需求覆盖分母**：重新核对详设 §8 的闭区间与字母后缀规则，以及 `67/67`、`missing=[]`、`extra=[]` 的可复算性；不要因为 N-03 的原 finding 就要求重复维护第二份逐条清单。
8. **既有已确认行为不能漂移**：区域/从属列表继续复用 SalesMenu 交互，顺序不进表单；二维码只读摘要与独立编辑 Drawer 不变；扫码点无图片；统一 dirty guard 不变；D-10 候选不因 URL 空/非法而预过滤，D-12 生成层只看最终 URL 合规，状态变化不新增第四种不出码原因；`SERVICE_POINT` 不进入 flat host、动态列或类型化搜索。

## 期望结论

请只基于当前仓库字节给出：

```text
REVIEW_TARGET=DESIGN
VERDICT=GO | NO-GO
M/S/N=<数字>/<数字>/<数字>
```

每条 finding 请标明 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`，说明是仓内事实、推论、产品判断还是尚缺证据的假设，并给出仓库根相对路径、精确行号/符号、用户/权限/数据/验收影响、最小修复及为什么不能更小。若发现详设缺判据，请列为 `DESIGN_GAP`；不要把未运行项目记为代码缺陷。

动态与证据必须单列：本轮没有授权也没有执行契约生成、构建、测试、迁移、reset、DEV、seed、Browser L2、UAT 或部署；请将这些写为 `NOT_RUN`/`NOT_AUTHORIZED`，不要把静态文档检查升级为运行 PASS。

本请求仍只授权静态 DESIGN review，不授权生产代码、契约生成物、migration、构建、测试、reset、DEV、seed、Browser L2、UAT、部署或 Git。即使结论为 GO，也只表示当前实现向详设与实施计划可继续交 Dexter 裁定，不能视为实施授权。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请基于当前仓库字节，对「门店桌台与二维码管理」的实现向详设与实施计划做第 2 次独立静态 DESIGN 对抗评审。

背景：上一份 Claude review 为 NO-GO，M/S/N=4/3/3。Codex 已逐条重开 owning source，修复已确认问题并记录在 doc/review/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-review-disposition-codex.md；请不要把处置记录当作事实结论。
目标：证伪当前详设与计划是否足以指导后续实施，重点核对 gate 两条链、11 个本域 HTTP 写入口、模板 create/update 契约、SERVICE_POINT host=9/flat=5、四阶段 seed 顺序、20 行 operation→scenario 矩阵、67 项需求映射，以及已确认的 IA/交互约束。
评审材料：请从仓库根读取 doc/plans/platform/2026-09-17-v2s-store-service-point-qr-requirements-claude.md、doc/decisions/2026-09-17-v2s-store-service-point-qr-journey-codex.md、doc/plans/platform/2026-09-17-v2s-store-service-point-qr-ia-design-codex.md、doc/plans/platform/2026-09-17-v2s-store-service-point-qr-interaction-design-codex.md、doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-design-codex.md、doc/plans/platform/2026-09-17-v2s-store-service-point-qr-implementation-plan-codex.md，并按 review brief 中的源码清单逐项核验。
结论格式：REVIEW_TARGET=DESIGN；VERDICT=GO 或 NO-GO；M/S/N=<数字>/<数字>/<数字>。每条 finding 标明 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE、UNVERIFIED_REQUIRES_EVIDENCE 或 DEXTER_DECISION，给出仓库根相对路径、精确行号/符号、影响、最小修复与不能更小的理由；详设缺判据列为 DESIGN_GAP。
授权边界：本轮只授权静态 DESIGN review，不授权生产代码、契约生成、迁移、构建、测试、reset、DEV、seed、Browser L2、UAT、部署或 Git。动态项目单列为 NOT_RUN/NOT_AUTHORIZED，不得升级为运行 PASS。
```
