# R5 外部协作与经营渠道 implementation follow-up 独立复核输入清单

```text
REVIEW_CYCLE_ID=R5_EXTERNAL_COLLABORATION_IMPLEMENTATION_FOLLOWUP_2026_08_19
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=READ_INPUTS_THEN_REOPEN_SOURCE
```

这是新 review cycle 的 fresh Round 1 最小完整输入。上一 cycle `R5_EXTERNAL_COLLABORATION_IMPLEMENTATION_REMEDIATION_2026_08_19` 已在 Round 2 以 `NO-GO` 收口；其 verdict/intake 只能作为待证伪的历史输入，不得复用轮次或直接接受其“已修复”结论。Reviewer 必须先读取本清单，再逐点重开原始 IA/interaction、项目记忆、owning source、契约、generated output 与 focused/static evidence。

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

Reviewer 还必须按仓内 `.agents/skills/` 的 local skill 入口执行 memory 六维路由；如果 recall tooling 因既有 heading 漂移失败，记录为工具边界，不以此替代源码证据或擅自改 memory/tooling。

## 原始需求、设计与历史 verdict

| path | sha256 |
|---|---|
| `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md` | `3cecfdd61f167afaad47e803d74e8aaef90a6ace0ef1970e3c13b66b3051d286` |
| `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md` | `de3ab35e380109583346f49625d43ef2aba8f210872c3c6df68d1fc9f48a777f` |
| `doc/decisions/2026-08-19-v2s-business-channel-management-journey.md` | `c8ce03f81a311821cb75ce5932bb162ac406c90b202169cd7ee70bdaaba54af9` |
| `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md` | `246426b1abc8127491991282266ce504f6c34f5beb6937ea6669446045dbc528` |
| `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md` | `5ce99667f4ef8dab2f48134137c645cfadc9932a8f4e31830ad9ad2df3ae5afc` |
| `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-remediation-independent-review-round-2-verdict.md` | `9d69a2c37b9a97e4612224ca42ad66f5e632a29abfb0fcabdee4f2c1c41d0e08` |
| `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-remediation-independent-review-round-2-author-intake.md` | `256ba9ff0b3a39c8b66fa5a3209b888175ac4bf6d834685cd2990fdb1baa242b` |

## 契约、owner source、generated wire 与 UI source

| path | sha256 |
|---|---|
| `contracts/openapi/paths/platform-admin/external-collaboration.paths.json` | `0e0d4a7fdefd55fe617fec8ca5a855cead298a2ed4cc2ed4e8e08b8c65debea1` |
| `contracts/openapi/edge.openapi.json` | `0c80fb4fa9db2955302886ef5b4124043f42acf5c4a5f9bd3c61fddf01e374c4` |
| `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` | `11ec8c4c147933ab4e64b060880c760481ad3159b28c32087aadc68429b28dbe` |
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java` | `ff79aef29d9bd7684ebfe5cf29e44e5a098536d262410380249e53f3507b8422` |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java` | `d33c6d7130947daaaa0a0b90f88aec334b88ca372c032bc8c10d4aed4903649b` |
| `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java` | `a29461654c29dd36bec780cae00c0bb56fe2a37b87fcba2f9e0f301c37ce8cde` |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java` | `a6ffe60704d1cfaf764abab01baa36da937475da8d45b0384917e061a8bb23e9` |
| `apps/backend/catering-business-server/modules/collaboration/src/test/java/com/catering/v2s/collaboration/application/CollaborationOwnerContractTest.java` | `dd172a59f2129d49b5de6c202c8ac9a0c17a92bd5476645ec8f053f81447121a` |
| `apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts` | `741146c29a283c02f02c688b99df432a51096fe0a65451b3143fde600fc01736` |
| `apps/frontend/platform-admin/src/app/api/generated/platform-edge.rtk.ts` | `f0e1a85c507b862ec7fcc8d4c2db6b26bcc88985bb3f4331e7d77569d2277de7` |
| `apps/frontend/platform-admin/src/features/external-collaboration/ui/ExternalSystemDetail.tsx` | `8712408771fd7b956d04562faa7770a775cf4a5529868e99625159cb60b4fae0` |
| `apps/frontend/platform-admin/src/features/external-collaboration/ui/ProviderProfileDetail.tsx` | `9d8a22363276ee9c136d951065348917c333c2d29e2257d1843f3e1c3c56c3d1` |
| `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingList.tsx` | `f65ac6484777a66962644245e1502b3b8e838e72d230ee3b8f3139fac8a80add` |
| `apps/frontend/platform-admin/src/tests/architecture/external-collaboration-collection.test.mjs` | `77332c337b4ab72dc07ddd71938adacd2906307bbb360e8fe0f72e9d55856ab0` |

## Round 1 必须独立证伪的范围

1. S-1：契约 `queryText` 语义是否与 owner SQL 的真实服务端过滤完全一致，且 source path、catalog、materialized/generated chain 没有第二处旧描述。
2. S-2：ProviderProfileDetail 是否真实调用批准的 status command，使用 required version，command failure 与 post-command readback failure 是否分别可见、保留旧 readback、可分别 retry；ExternalSystemDetail 是否同样闭合。
3. N-1：ProviderProfileView.version 是否从 source schema、generated type、backend mapper 真实抵达 UI mutation 的 `expectedVersion`，没有 fallback；不要只验证 ExternalSystemView。
4. N-COUNT：源码 `@AcceptanceScenario` 实数是否为 60，设计与串行计划是否明确 44 baseline + 16 new，并登记 `business-channel.cross-node-read-authorization`，且没有恢复 retired compliance-control/provider shell/registry。
5. M-1：selected-store equality guard、同 project foreign-store negative acceptance 与 owner read projection 是否仍形成完整静态证据链；动态 acceptance 不在本轮授权范围。

## 可运行证据与边界

允许运行源码/契约/生成物、编译、focused test 与静态 check。建议至少复跑：

```text
node scripts/generate/r5-edge-materialize.mjs
node scripts/generate/edge-codegen.mjs --check
node scripts/check/external-collaboration-business-channel-contract.mjs
yarn workspace @catering-v2s/platform-admin typecheck
yarn workspace @catering-v2s/platform-admin test:architecture
node --test apps/frontend/platform-admin/src/tests/architecture/external-collaboration-collection.test.mjs
bash scripts/check/openapi-contracts
bash scripts/check/frontend-architecture
```

禁止 DEV、reset、seed、Testcontainers、真实 HTTP、浏览器 L2、UAT 与外部联调；若结论依赖动态证据，标注 `UNVERIFIED_REQUIRES_EVIDENCE`。

## 输出要求

Reviewer 只写：

`doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-followup-independent-review-round-1-verdict.md`

Verdict 必须包含本 cycle metadata、`reviewerKind=INDEPENDENT_SUBAGENT`、盲审声明、`GO`/`NO-GO`、`M/S/N`、逐条状态（`CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`）、精确 evidence path/line 与最小修复建议。不得修改生产源码、契约、生成物、测试或本清单，不得代写作者 intake；Round 1 完成后由作者 intake 决定是否进入本 cycle Round 2，不能直接把 Round 1 作为最终 GO。
