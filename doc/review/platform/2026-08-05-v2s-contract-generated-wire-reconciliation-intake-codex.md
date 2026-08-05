# S1 契约与 generated-wire 实施复核 — Codex intake（Claude NO-GO 后修复版）

## 交付身份与授权边界

- `packageId/unitId/reviewCycleId`: `WHOLE-ENGINEERING-CONTRACT-GENERATED-WIRE-20260805`
- `REVIEW_TARGET`: `IMPLEMENTATION`
- `scopeKind`: `IMPLEMENTATION_STATIC`
- 本次是一次性 S1 静态交付的 post-NO-GO 修复：契约真相、materializer、OpenAPI 输出、Java/TypeScript generated consumers、诊断 workload 与证据闭环。
- 明确不包含：backend owner 业务源、frontend business runtime、数据库/migration、DEV/UAT/HTTP/L2、seed/reset、远端资源、Git。

## 原始问题与根因处置

### M-01 — generated Java session wire 类型错误

状态：`CONFIRMED_CLOSED`。

Round 1 在真实 generated Java 与 owner mapper 上确认 `WorkspaceSessionEntry.scopeContext` / `WorkspaceScopeContext` 因 `allOf` 单引用被生成为 `JsonNode`，导致 owner mapper 编译边界失败。根因不是 owner 代码缺失，而是 edge codegen 对该 wire 形状无法保留已接受的 typed nullable reference。

最小修复：在 `workspace-session` 物化结果中将这两个已接受对象作为直接 nullable `$ref` 输出，保留已有 allOf codegen 规则，不引入 runtime adapter，也不修改 owner source。重新生成后字段为 typed `WorkspaceScopeContext` / `WorkspaceScopeNode`，普通及 `--rerun-tasks` `compileJava` 均 PASS。

### S-01 — nested navigation 与 role-page 同名 property 分母不完整

状态：`CONFIRMED_CLOSED_PENDING_CLAUDE_RECHECK`。

Round 1 在 OpenAPI/TS 与 materializer self-test 中确认 nested `dataNodeCandidates[].requiredDataNodeType` 和 `scopeContext.requiredDataNodeType` 丢失 `HEAD_COMPANY`。根因是 enum additions 在 `$ref` inline 前应用，后续 inline 覆盖了 additions。

最小修复：将受批准的 enum additions 延迟到 component-aware inline 完成之后，并把 `HEAD_COMPANY` 纳入 session 两处与 `WorkspaceRolePage.pageAccessCatalog` 的 materializer 正向断言和空 additions 真实红变异；分母新增同名 `requiredDataNodeType` 全出现点对账。生成输出、TS enum、40/40 workload tests 均 PASS，等待 Claude post-remediation recheck。

## 实施范围与 owner 真相

1. catalog/placement catalog 明确补齐 `WorkspaceScopeNode`、`WorkspaceScopeContext` 与 exact placement；`WorkspaceSessionEntry` 保留 `scopeContext`、去除 `selectedDataNode`，补齐 `HEAD_COMPANY`。
2. store/contract create wire 不再从客户端接收 `projectId`，由已有 operations owner 根据 session scope 派生。
3. invitation cancel/reissue 的四字段契约为 `scopeRef`（可选）以及 `expectedContextVersion`、`expectedVersion`、`idempotencyKey`（必填）；四者均有 owner 消费点并在 workload 中保持稳定。
4. generated Java/TS/OpenAPI 均由既有脚本重放生成；没有手改 generated consumer、owner controller 或数据库。

## 机器与 focused proof

- `scripts/check/r5-edge-materialize --check`: PASS（154 operations；50/92/12 faces）。
- `scripts/check/r5-edge-materialize --self-test`: PASS；包含 nested enum、path、component 三类真实 red mutation。
- `scripts/check/edge-codegen --check` 与 `--self-test`: PASS（253 files；wire/TS/RTK/catalog/security/controlled-write red mutation）。
- `scripts/check/openapi-contracts`: PASS。
- `scripts/check/contract-face`: PASS，`STATE=POST_GATE_0`。
- `scripts/check/standards-coverage --phase R5`: PASS（150 rules）。
- focused Node suite：`40/40 PASS`。
- `yarn --cwd apps/frontend/operations-admin typecheck`: PASS。
- `gradle :apps:backend:catering-business-server:compileJava --no-daemon --console=plain`: PASS。
- 同命令 `--rerun-tasks --no-daemon --console=plain`: PASS（11 tasks；仅既有 deprecation warnings）。
- 同名 `requiredDataNodeType` 对账：3 个 materialized schema occurrence 全部包含 `HEAD_COMPANY`；owner admin-catalog 分布为 `NONE=5 / PROJECT=3 / REGION=1 / HEAD_COMPANY=1 / STORE=2`。

Focused proof：`doc/evidence/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-focused-static-proof.json`。

## 独立对抗复核 disposition

### Round 1

报告：`doc/review/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-independent-review-round1.md`。

结论：`NO-GO (M1/S1/N0)`。M-01 与 S-01 均为 `CONFIRMED`，已按根因修复并补充反例自测与强制编译证据；Round 1 其余 owner、payload、forbidden surface 检查通过。

### Round 2（Codex 独立终审，历史输入）

报告：`doc/review/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-independent-review-round2.md`。

SHA-256：`0936b5ed503a546b6ea007a56c8e97b9c7e7c532437de9b87c01562c7b19711e`。

`REVIEW_ROUND=2`、`REVIEW_ROUND_LIMIT=2`、`reviewerKind=INDEPENDENT_SUBAGENT`、`ROUND_FINAL_DECISION=SELF_DECIDED`。

结论：`GO (M0/S0/N0)`，仅限当时已覆盖分母的 S1 static package。该结论保留为历史输入，不覆盖 Claude 后续发现的 role-page 漏点。

## Claude post-recheck finding intake

Claude 对当前 bytes 的独立静态终审为：`NO-GO (M1/S1/N1)`。五项核验通过，问题集中在同一枚举 property 的第三个 schema 出现点：

- `contracts/openapi/components/workspace-iam/workspace-access.schemas.yaml` 的 `WorkspaceRolePage.pageAccessCatalog[].requiredDataNodeType` 缺 `HEAD_COMPANY`；
- `WorkspaceAuthorizationCatalog.pageCatalog()` 的 `PG-IAM-HEAD-COMPANY-USERS` 实际发出 `HEAD_COMPANY`，`PlatformWorkspaceRoleController.pageAccessCatalogWire` 原样透传；
- 因而 `getWorkspaceRoles` 可发出契约禁止值，属于同一 generated-wire 全局对账问题族；
- 原核验项 5 误写成只验证 `expectedContextVersion`，现改为四字段 owner 消费对账：`scopeRef` 可选，`expectedContextVersion`、`expectedVersion`、`idempotencyKey` 必填；
- 分母已新增 `ENUM_PROPERTY_SURFACE`，要求同名 `requiredDataNodeType` 的全部 schema 出现点一次性对齐。

### Post-NO-GO 修复

1. 在既有 catalog `enumAdditions` 机制中为 `WorkspaceRolePage.requiredDataNodeType` 补 `HEAD_COMPANY`。
2. 在 `r5-edge-materialize --self-test` 中增加 role-page 正向断言和删除 additions 的真实红控制：
   `R5_EDGE_ROLE_PAGE_REQUIRED_DATA_NODE_TYPE_HEAD_COMPANY_MISSING`、
   `R5_EDGE_ROLE_PAGE_REQUIRED_DATA_NODE_TYPE_RED_NOT_DETECTED`。
3. 重放 materializer 与受控 edge-codegen；当前 OpenAPI 三个 occurrence、platform/operations TS 均包含 `HEAD_COMPANY`。
4. 更新设计、manifest、package input、focused proof、problem family 与 Claude brief；保留历史 Round2 报告，不制造第三轮独立 subagent verdict。

## 最终 Codex disposition

| Finding | Codex 状态 | 证据 | 后续 |
|---|---|---|---|
| M-01 typed session wire | `CONFIRMED_CLOSED` | Round 2 forced compile + generated owner mapper | 无 deferred item |
| M-01 role-page `HEAD_COMPANY`漏点 | `CONFIRMED_CLOSED_PENDING_CLAUDE_RECHECK` | role-page enum addition + dedicated positive/red materializer control + all-surface scan | Claude post-remediation recheck |
| S-01 same-property denominator | `CONFIRMED_CLOSED_PENDING_CLAUDE_RECHECK` | manifest/design 新增 `ENUM_PROPERTY_SURFACE`，3 occurrence exact scan | Claude post-remediation recheck |
| N-01 invitation action criterion | `CONFIRMED_CLOSED_PENDING_CLAUDE_RECHECK` | owner controller 四字段消费 + generated contract/workload readback | Claude post-remediation recheck |

Problem family：`doc/evidence/platform/2026-08-05-v2s-contract-generated-wire-reconciliation-problem-family.json`，状态 `ACTIVE_RED_VERIFIED`；已把“inline 前 enum additions”与“single-ref allOf Java typing”抽象为可复用失败模式并保留真实 red mutation。不存在 PENDING disposition。

## 结论

Codex 已完成 Claude NO-GO 指出的最小静态修复，当前机器证据为 PASS，但在 Claude post-remediation recheck 返回前不宣称最终 S1 GO。若 Claude 复核通过，只能表示静态 S1 package 收口；DEV、HTTP、L2、业务或 cleanup 闭环仍需另行授权并运行受管入口。
