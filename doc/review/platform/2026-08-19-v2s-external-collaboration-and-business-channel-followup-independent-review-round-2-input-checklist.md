# R5 外部协作与经营渠道 implementation follow-up 独立复核 Round 2 输入清单

```text
REVIEW_CYCLE_ID=R5_EXTERNAL_COLLABORATION_IMPLEMENTATION_FOLLOWUP_2026_08_19
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=READ_INPUTS_THEN_REOPEN_SOURCE
ROUND_FINAL_DECISION=SELF_DECIDED
```

这是本 cycle 的最终独立复核轮。Round 1 已由 fresh 独立子 agent 得出 `NO-GO M=0 S=1 N=0`；作者 intake 将 S-1 标记为 `CONFIRMED` 并完成静态修复。Round 2 必须重新证伪修复后的真实 source，不得把作者 intake 或 Round 1 的建议直接当作通过依据；本 cycle Round 2 后不得再召集第三轮。

## 仓入口、授权、记忆与规范

| path | sha256 |
|---|---|
| `AGENTS.md` | `586dedb45f1d657770aa9e0579157e96597dafcad88647e168ce7a1b5935dc54` |
| `PLATFORM-BLUEPRINT.md` | `e9956c2ee23f905bcdf70b8ad0874abfdd6a497b3fc9d01ea9ad7ca896c13b74` |
| `doc/platform/README.md` | `d358e49c83726528690a9d05aa9f6a1979a0f9d2051fd56ef9db4ff98b573c7f` |
| `doc/platform/active-document-index.json` | `97dc4965f131f31a3cb40839ce96da2bb9ef4899c80a2b0c48b11e8d4dd6ecf3` |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` |
| `scripts/README.md` | `2e82318aa0b2593228f040141bf7e217ceddfae58d9ace38b7d311f284785986` |
| `project-memory/index.md` | `b5638996d64a3a31bc6c7cfd164faadbeb0302d082aafc645affb41db665c9fe` |
| `project-memory/decisions/deterministic-context-only.md` | `c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263` |

必须按本仓 `.agents/skills/` 入口完成 memory 六维路由，并逐点重开 owning source；不以历史 review、生成图或作者摘要替代源码证据。

## 原始需求、设计与 Round 1 证据

| path | sha256 |
|---|---|
| `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md` | `3cecfdd61f167afaad47e803d74e8aaef90a6ace0ef1970e3c13b66b3051d286` |
| `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md` | `de3ab35e380109583346f49625d43ef2aba8f210872c3c6df68d1fc9f48a777f` |
| `doc/decisions/2026-08-19-v2s-business-channel-management-journey.md` | `c8ce03f81a311821cb75ce5932bb162ac406c90b202169cd7ee70bdaaba54af9` |
| `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md` | `bd30b4d664bf16a123e32a85bc6ed2cfacf34e4da27b6adb0c432caf5664a106` |
| `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md` | `5ce99667f4ef8dab2f48134137c645cfadc9932a8f4e31830ad9ad2df3ae5afc` |
| `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-followup-independent-review-round-1-input-checklist.md` | `7797cf19c2717e305b8a141febce3fee0275d5618ba1e0452a3aa27242493f1a` |
| `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-followup-independent-review-round-1-verdict.md` | `ea91ac0e009a857cb926af1bfee0f73166d836dab6f93f56a672df0f7fc2fbea` |
| `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-followup-independent-review-round-1-author-intake.md` | `388423c8b42d2799ec85b926cee25822fcd01d1701684873b4a2759107e7ad5c` |

## 契约、owner source、路径参考、测试与生成链

| path | sha256 |
|---|---|
| `contracts/openapi/paths/platform-admin/external-collaboration.paths.json` | `0e0d4a7fdefd55fe617fec8ca5a855cead298a2ed4cc2ed4e8e08b8c65debea1` |
| `contracts/openapi/edge.openapi.json` | `0c80fb4fa9db2955302886ef5b4124043f42acf5c4a5f9bd3c61fddf01e374c4` |
| `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` | `11ec8c4c147933ab4e64b060880c760481ad3159b28c32087aadc68429b28dbe` |
| `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java` | `00d4060fcd098c56d63e220cbb3e336bbae8545c6c1dd62d731011654e022664` |
| `apps/backend/catering-business-server/modules/organization/src/main/java/com/catering/v2s/organization/application/OrganizationTaskPathService.java` | `6539bc695bdd8b4d36f27ba6290076778f87378f7607f919d2d25b418b0a3a1c` |
| `apps/backend/catering-business-server/modules/collaboration/src/test/java/com/catering/v2s/collaboration/application/CollaborationOwnerContractTest.java` | `d9d8fd23a2c4646b507fbc344e596cbc71abe8c33609399e0223ac330ac5f90c` |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java` | `e02c496c1785d398ba8b6738feda7b6621e4a5df13751c604215b03fb57a6958` |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/externalcollaboration/PlatformExternalCollaborationController.java` | `bd7748ddda95e519e212f52cd00f6c6621bb82cf70880b40c84b52e4e842dc97` |
| `apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts` | `741146c29a283c02f02c688b99df432a51096fe0a65451b3143fde600fc01736` |
| `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingList.tsx` | `f65ac6484777a66962644245e1502b3b8e838e72d230ee3b8f3139fac8a80add` |

## Round 2 定向独立核验重点

1. **Round 1 S-1 修复是否真实闭合**：契约与 catalog 的 `queryText` 仍声明 binding name、business node display name/path、node reference；检查 owner SQL 是否在 `COUNT(*) OVER()`、`ORDER BY`、`LIMIT/OFFSET` 之前把同一 `node_display_path` 纳入过滤关系。
2. **路径语义是否与 owning reference 一致**：逐项对照 `OrganizationTaskPathService.persistedTaskPathsSql()` 的五类路径语义（COMMERCIAL_GROUP、REGION、PROJECT、HEAD_COMPANY、STORE），确认递归 ancestor path、store suffix、group display path、scope predicates、node type/ref join 没有自造第二种路径。
3. **防止只修字符串不修行为**：确认 `CollaborationOwnerContractTest` 断言 recursive/path projection、第四个 pattern 与参数顺序；确认 `CollaborationAcceptanceScenarios` 真实使用祖先/path segment，而不是 leaf-only 或只验证 HTTP 200。
4. **回归范围**：重看 S2、N1、M1、N-COUNT 的既有静态证据，确认路径修复没有改变 owner 边界、selected-store guard、UI version/readback、场景计数或退役机制边界。
5. 以证伪为先，必须区分 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`；静态证据不能冒充动态运行。当前禁止 DEV、reset、seed、Testcontainers、真实 HTTP、浏览器 L2、UAT 与外部联调。

## 已执行的作者静态证据（仅供复核入口，不得直接接受）

```text
./gradlew :apps:backend:catering-business-server:compileJava :apps:backend:catering-business-server:compileTestJava :apps:backend:catering-business-server:modules:collaboration:test --tests com.catering.v2s.collaboration.application.CollaborationOwnerContractTest --no-daemon --console=plain => PASS
node scripts/check/external-collaboration-business-channel-contract.mjs => PASS
./gradlew spotlessCheck --no-daemon --console=plain => FAIL only on pre-existing organization files:
  apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewControllerTest.java:23,24
  apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/organization/PlatformOrganizationOverviewController.java:127
the repaired collaboration module passes backendJavaUtf8LineLimit.
```

## 输出与边界

Reviewer 只写：`doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-followup-independent-review-round-2-verdict.md`。必须包含本 cycle metadata、`REVIEW_ROUND=2`、`REVIEW_ROUND_LIMIT=2`、`reviewerKind=INDEPENDENT_SUBAGENT`、盲审声明、`ROUND_FINAL_DECISION=SELF_DECIDED`、最终 `GO`/`NO-GO` 与 `M/S/N`，以及逐条 finding 的 evidence 与最小处置建议。不得修改 production source、contract、generated output、test、plan 或本清单，不得代写作者 intake。
