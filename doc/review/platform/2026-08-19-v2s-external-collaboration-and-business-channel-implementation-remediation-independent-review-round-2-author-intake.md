# R5 外部协作与经营渠道 implementation remediation Round 2 作者 intake

```text
REVIEW_CYCLE_ID=R5_EXTERNAL_COLLABORATION_IMPLEMENTATION_REMEDIATION_2026_08_19
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=AUTHOR_INTAKE_AFTER_INDEPENDENT_SUBAGENT
reviewerVerdict=doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-remediation-independent-review-round-2-verdict.md
authorIntakeStatus=STATIC_REPAIRED_AWAITING_NEW_REVIEW_CYCLE_DECISION
```

本 intake 在读取 Round 2 最终独立 verdict 后形成。Round 2 是本 `REVIEW_CYCLE_ID` 的最终轮次；不召集第三轮，也不把作者 intake 当作独立 verdict。以下每一项均重新打开对应 owning source、原始 IA/interaction、契约/生成物或源码计数后再决定处置。

## Findings intake

| finding | status | author disposition | 最小处置 |
|---|---|---|---|
| M-1 | `REJECTED_WITH_EVIDENCE` / static closed | 接受 reviewer 的证据；同一 project 的 foreign-store candidate 已真正经过 selected-store equality guard，负向 acceptance 也覆盖该绕过面。 | 不改已闭合的 controller/acceptance 逻辑；动态 acceptance 仍未授权，不能标为 runtime PASS。 |
| S-1 | `PARTIALLY_CONFIRMED` | 接受契约语义描述落后于 owner SQL 实现；不是新增 API，也不是 edge display path 过滤问题。 | 更新 queryText 的 source/catalog description，明确 binding name、business node display name/path 与 node reference 均参与服务端过滤；重新 materialize/codegen/check。 |
| S-2 | `PARTIALLY_CONFIRMED` | 接受 ProviderProfileDetail 缺少批准的 status mutation/version/error/retry 闭环；接受 ExternalSystemDetail 把 post-command readback refetch failure 当成 command failure 的根因判断。 | 复用 generated `transitionPlatformProviderProfileStatus` 与 `system` 已有模式，补 profile status mutation；把 command retry 与 post-command readback retry 分开，保留旧 readback。补 focused UI/static coverage。 |
| N-1 | `PARTIALLY_CONFIRMED` | 接受 ProviderProfileView.version 已在 source/materialized/generated/backend mapper 闭合，但未消费到 UI mutation；这是 S-2 的相关但独立末端缺口。 | Provider status mutation 使用 `profile.version` 作为 required `expectedVersion`，删除任何 fallback。 |
| N-COUNT | `CONFIRMED` | 接受新增的 same-project foreign-store negative acceptance 是 M-1 必需证据，不应删除以迎合旧分母。当前实数为 44 baseline + 16 new = 60，仍低于 80。 | 设计与串行计划同步为 `PROPOSED_NEW_COUNT=16`、`PROJECTED_COUNT=60`，将 `business-channel.cross-node-read-authorization` 登记为新增场景；不恢复退役 compliance-control。 |

## 工具与动态边界

Round 2 记录的 `scripts/context/recall-failure` 因仓内既有 memory heading 漂移返回 `PROJECT_MEMORY=FAIL`。该信号不属于本实现 finding；当前以已读取的 kernel/decision/source 证据继续，不修改 memory/tooling 作为本批副作用。

本 intake 与后续修复只覆盖源码、契约、生成物、编译、focused test 和静态门。没有 DEV、reset、seed、Testcontainers、真实 HTTP、浏览器 L2、UAT 或外部联调授权；动态结论必须保持 `UNVERIFIED_REQUIRES_EVIDENCE`。

## 收口边界

当前 cycle 最终 verdict 仍为 `NO-GO · M=0 · S=2 · N=2`。完成上述静态修复后，需要由 Dexter 决定是否建立新的 `REVIEW_CYCLE_ID` 进行独立复核；本文件不把修复后的源码宣称为新 cycle 的 GO，也不授予动态环境或仓库控制动作。

## 修复后静态证据

本 intake 完成后已落地的最小修复与证据：

- S-1：更新 `contracts/openapi/paths/platform-admin/external-collaboration.paths.json` 与 R5 edge catalog 的 `queryText` 描述，随后 `r5-edge-materialize`、edge codegen write/check、OpenAPI contracts 与 R5 contract checker 均 PASS。
- S-2/N-1：`ProviderProfileDetail` 已调用 generated `transitionPlatformProviderProfileStatus`，使用 required `profile.version`，保留旧 readback，并区分 command retry 与 readback retry；`ExternalSystemDetail` 同样将 post-command `refetch` failure 分流到 typed readback retry。platform typecheck、frontend architecture 与新增 status/readback architecture test PASS。
- N-COUNT：实际 source count 仍为 `60`；implementation design 与 serial plan 已同步为 `44 + 16 = 60`，并登记 `business-channel.cross-node-read-authorization`。
- 相关边界门：`contract-face`、`frontend-architecture`、`backend-boundaries`、`database-boundaries`、`openapi-contracts`、`operation-handler-bindings`、`capability-invariants`、`query-boundaries`、`flyway-layout`、`module-dependency-registry`、`logging-boundaries`、`code-layout`、`name-code-density` 与 `production-conformity` 均 PASS；全仓 `format:check` 仍只报告两处未触碰的既有 warning：`OperationsApp.tsx` 与 `OwnerBindingFormDrawer.tsx`。

上述证据仍是静态/编译/focused proof，不是动态 HTTP、浏览器 L2、DEV、seed、reset、UAT 或外部联调证据；新 cycle 的独立 Round 1 尚未启动。
