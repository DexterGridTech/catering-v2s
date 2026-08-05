# 给 Claude 的 S1 post-NO-GO 静态复核请求（可直接复制）

Dexter授权你对 `catering-v2s` 的 S1「契约与 generated-wire reconciliation」做一次 post-NO-GO 静态复核。你上轮结论为 `NO-GO (M1/S1/N1)`；Codex 已按你指出的第三个漏网站点完成最小修复。请以当前工作区真实源码、契约、generated 输出和证据为准，独立确认修复是否关闭，不把 Codex 的结论当作事实；这是同一 S1 package 的 post-remediation recheck，不制造第三轮 independent-subagent verdict。

## 背景与目标

S1 目标是把已接受的 U27 edge 语义恢复到唯一契约真相，并让 materializer、OpenAPI、Java/TypeScript generated consumers 与 diagnostic workload 保持可重放一致：

1. `WorkspaceSessionEntry.scopeContext` / `WorkspaceScopeContext` 必须是 typed nullable wire，且能通过现有 owner mapper 编译；
2. 同名 `requiredDataNodeType` 的全部 schema 出现点必须一次性对齐，至少包括 session 的两处 navigation 和 `WorkspaceRolePage.pageAccessCatalog`，均保留 `REGION/PROJECT/HEAD_COMPANY/STORE`（role page 另含 `NONE`）；
3. create 请求不得让客户端伪造 `projectId`，由 operations owner 从 session scope 派生；
4. invitation cancel/reissue 必须核对四字段 owner 消费：`scopeRef` 可选，`expectedContextVersion`、`expectedVersion`、`idempotencyKey` 必填且真实使用；
5. 不得引入 `selectedDataNode`、runtime adapter、数据库、DEV/UAT/HTTP/L2 或 Git 变化。

## 仓根与重点路径（均为仓根相对路径）

- `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json`
- `doc/plans/platform/2026-07-26-v2s-r5-edge-contract-file-placement-catalog.json`
- `scripts/generate/r5-edge-materialize.mjs`
- `scripts/generate/edge-codegen.mjs`
- `contracts/openapi/components/contract/contract.schemas.yaml`
- `contracts/openapi/components/organization/store.schemas.yaml`
- `contracts/openapi/components/workspace-iam/workspace-access.schemas.yaml`
- `contracts/openapi/components/workspace-iam/workspace-session.schemas.yaml`
- `contracts/openapi/edge.openapi.yaml`
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/generated/`
- `apps/frontend/operations-admin/src/app/api/generated/`
- `apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts`
- `apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/api/WorkspaceAuthorizationCatalog.java`（只读 owner source）
- `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/workspaceiam/PlatformWorkspaceRoleController.java`（只读 owner source）
- `contracts/catalog/admin-catalog.json`
- `scripts/test/http-diagnostic-workload.mjs`
- `scripts/test/http-diagnostic-workload.test.mjs`
- `doc/evidence/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-focused-static-proof.json`
- `doc/evidence/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-problem-family.json`
- `doc/review/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-independent-review-round1.md`
- `doc/review/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-independent-review-round2.md`

## 已有证据（请独立重开）

- materializer check/self-test：PASS，含 session 与 role-page enum、path、component 的真实红变异；
- edge-codegen check/self-test：PASS；OpenAPI/contract-face/standards：PASS；
- focused Node suite：40/40 PASS；operations-admin typecheck：PASS；
- backend `compileJava` 普通与 `--rerun-tasks`：PASS（11 tasks）；
- 同名 `requiredDataNodeType` 对账：3 个 materialized schema occurrence 全部包含 `HEAD_COMPANY`；admin-catalog owner 分布 `NONE=5 / PROJECT=3 / REGION=1 / HEAD_COMPANY=1 / STORE=2`；
- Codex fresh independent Round 2 报告：`doc/review/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-independent-review-round2.md`，SHA-256 `0936b5ed503a546b6ea007a56c8e97b9c7e7c532437de9b87c01562c7b19711e`，其结论为 `GO (M0/S0/N0)`。

## 独立核验重点

- 证伪 Round 1 的 M-01：generated Java 是否仍出现 `JsonNode`/owner mapper 类型不匹配；确认 direct nullable refs 没有通过泛化 codegen 特例破坏已有 owner 类型。
- 复核 Claude 上轮 M-01：`WorkspaceRolePage.pageAccessCatalog[].requiredDataNodeType` 是否已通过既有 `WorkspaceRolePage.enumAdditions` 补 `HEAD_COMPANY`；`r5-edge-materialize --self-test` 是否真实报告 `R5_EDGE_ROLE_PAGE_REQUIRED_DATA_NODE_TYPE_HEAD_COMPANY_MISSING` 与 `R5_EDGE_ROLE_PAGE_REQUIRED_DATA_NODE_TYPE_RED_NOT_DETECTED`；
- 复核同名 property 分母：session 两处 + role-page 一处是否全部扫描、全部 enum 包含 `HEAD_COMPANY`，且 owner `pageCatalog()` 的 `PG-IAM-HEAD-COMPANY-USERS` 确实会被 wire 原样透传；
- 复核 Claude 上轮 N-01：invitation cancel/reissue 的 `scopeRef`、`expectedContextVersion`、`expectedVersion`、`idempotencyKey` 是否均有 owner 消费点，且证据不再把四字段缩写成单字段；
- 全量扫描 `selectedDataNode`、create body 的 `projectId`、邀请 action 的 `expectedContextVersion` 和 server-derived project scope；
- 对照 changed-path set 与 active package allowed surfaces，确认没有 backend owner、frontend business、DB/migration、runtime、DEV/UAT/HTTP/L2、seed/reset 或 Git 变化；
- 评价修复是否为最小根因修复，是否存在过度设计、隐藏回归或未记录的 deferred finding。

## 交付格式

请输出一份独立中文报告，并在开头明确：

`REVIEW_CYCLE_ID: WHOLE-ENGINEERING-CONTRACT-GENERATED-WIRE-20260805`

`REVIEW_TARGET: IMPLEMENTATION`

`REVIEW_ROUND: POST_REMEDIATION_RECHECK`（不是第三轮 independent-subagent review；请绑定本次 current-byte recheck）

`reviewerKind: EXTERNAL_INDEPENDENT`

最终结论严格使用：`GO` 或 `NO-GO`，并给出 `M/S/N` 计数。请逐条对 Claude 上轮 M-01/S-01/N-01 给出 `CONFIRMED_CLOSED` 或仍未关闭；每个残留 finding 必须带状态：`CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`，附 owning source、命令或可复现实验、影响、最小修复建议与适用边界。若 GO，请明确“仅静态 S1 package GO”，不得升级为 runtime、业务或 cleanup GO。

## 授权边界：

本次仅授权 static contract/generated-wire post-remediation review、源码阅读、静态命令与 focused proof 重跑。明确不授权修改源码、不授权 runtime/DEV/UAT/HTTP/L2、不授权 seed/reset/数据库/migration/远端资源、不授权 Git 操作；不得把静态 PASS 写成业务或 cleanup PASS。
