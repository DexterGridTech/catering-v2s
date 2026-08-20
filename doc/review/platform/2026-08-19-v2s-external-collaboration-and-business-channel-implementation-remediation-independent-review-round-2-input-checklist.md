# R5 外部协作与经营渠道实施整改独立复核输入清单

```text
REVIEW_CYCLE_ID=R5_EXTERNAL_COLLABORATION_IMPLEMENTATION_REMEDIATION_2026_08_19
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=READ_INPUTS_THEN_REOPEN_SOURCE
ROUND_FINAL_DECISION=SELF_DECIDED
```

本清单是 Round 2 的最小完整输入。Reviewer 必须先读取本清单列出的原始需求、设计、Round 1 独立 verdict 与作者 intake，再独立重开 owning source、测试、契约与生成结果；不得把作者 intake 或本清单中的哈希视为事实结论。Round 2 是本 cycle 的最终独立复核，不得召集第三轮。

## 原始入口、授权与规范

| path | sha256 |
|---|---|
| `AGENTS.md` | `586dedb45f1d657770aa9e0579157e96597dafcad88647e168ce7a1b5935dc54` |
| `PLATFORM-BLUEPRINT.md` | `e9956c2ee23f905bcdf70b8ad0874abfdd6a497b3fc9d01ea9ad7ca896c13b74` |
| `doc/platform/README.md` | `d358e49c83726528690a9d05aa9f6a1979a0f9d2051fd56ef9db4ff98b573c7f` |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` |
| `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md` | `3cecfdd61f167afaad47e803d74e8aaef90a6ace0ef1970e3c13b66b3051d286` |
| `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ui-interaction.md` | `de3ab35e380109583346f49625d43ef2aba8f210872c3c6df68d1fc9f48a777f` |
| `doc/decisions/2026-08-19-v2s-business-channel-management-journey.md` | `c8ce03f81a311821cb75ce5932bb162ac406c90b202169cd7ee70bdaaba54af9` |

## 实施详设、Round 1 证据与契约输入

| path | sha256 |
|---|---|
| `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md` | `e473447ab06b3f007e8b9dfc9b1f7477e34a62ec7f4075e915a523e1c445f42a` |
| `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md` | `de5c6961e4dbe8bf54e3ba5065d24ea243be87349931ff608d78baf8c468cd44` |
| `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-remediation-independent-review-round-1-verdict.md` | `de48f353373b8d0f0dadc91c346c659321530bb925f5a9a44762eb490be0ee69` |
| `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-remediation-independent-review-round-1-author-intake.md` | `29a3c030bebae89176f4117abd42db59f9f9a19fd8f0fe37a8d12a35d2410342` |
| `contracts/openapi-source/collaboration.schemas.json` | `b8f0f95d319b5e20ffa663689bc8eb9ac8251c7b117486c68aa368c44a9b4d46` |
| `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json` | `1792e5047077de3de5e3b2d9f0b0992ee745d583098c2199975707b23430f739` |

## Owning source、回归测试与 UI

| path | sha256 |
|---|---|
| `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java` | `ff79aef29d9bd7684ebfe5cf29e44e5a098536d262410380249e53f3507b8422` |
| `apps/backend/catering-business-server/modules/collaboration/src/main/java/com/catering/v2s/collaboration/application/CollaborationOwnerService.java` | `a29461654c29dd36bec780cae00c0bb56fe2a37b87fcba2f9e0f301c37ce8cde` |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/CollaborationAcceptanceScenarios.java` | `a6ffe60704d1cfaf764abab01baa36da937475da8d45b0384917e061a8bb23e9` |
| `apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BusinessChannelAcceptanceScenarios.java` | `d33c6d7130947daaaa0a0b90f88aec334b88ca372c032bc8c10d4aed4903649b` |
| `apps/backend/catering-business-server/modules/collaboration/src/test/java/com/catering/v2s/collaboration/application/CollaborationOwnerContractTest.java` | `dd172a59f2129d49b5de6c202c8ac9a0c17a92bd5476645ec8f053f81447121a` |
| `apps/frontend/platform-admin/src/features/external-collaboration/ui/ExternalSystemDetail.tsx` | `83cbf13babe0582ad2ba9116849af842cfff791cfc553b57cdf949edf4112f21` |
| `apps/frontend/platform-admin/src/features/external-collaboration/ui/ProviderProfileDetail.tsx` | `ab705ec4385ee9bee4b5401a336de858dc4d2b30ca64155cb5c154f3faa5fc24` |
| `apps/frontend/platform-admin/src/features/external-collaboration/ui/OwnerBindingList.tsx` | `f65ac6484777a66962644245e1502b3b8e838e72d230ee3b8f3139fac8a80add` |
| `apps/frontend/operations-admin/src/tests/architecture/business-channel-scope.test.mjs` | `5bf187c687747d4c8d482a2e260078935930bee2de35e122bd22a5be16fc6191` |

## Round 2 必须证伪的重点

1. `M-1`：同一 project 下的 foreign-store candidate 是否仍能绕过 selected-store scope；controller、复用的 selected-store guard、owner read projection 与负向 acceptance 必须形成同一条证据链。
2. `S-1`：provider binding Page 的 `queryText` 是否在 owner SQL 的过滤、总数与成员选择阶段都匹配业务节点名称，而不是只在 edge 组装 display path 后才匹配；检查节点类型覆盖、参数绑定、Page total/member 一致性与最小替代方案。
3. `S-2`：status mutation、detail query failure、已有旧 readback 保留、typed problem 展示与 retry 是否在两种 UI 状态下真实闭合；不得只依赖 loading 或字符串错误。
4. `N-1`：`ExternalSystemView` 与 `ProviderProfileView` 的 version 是否从 source schema、生成类型、backend mapper 到 UI mutation 全链路 required；不得以 `?? 0` 之类 fallback 掩盖缺失。
5. 复核 generated/static chain 与本轮新增 scenario count 15/59；不得恢复已退役的 compliance-control 机制，也不得把 `PLANNED` 当启用门槛或擅自裁决六项 C。

## 运行边界

本轮只做源码、契约、生成物、编译、focused test 与静态审查。没有 DEV、reset、seed、Testcontainers、真实 HTTP、浏览器 L2、UAT 或外部系统权限；如某结论必须依赖这些环境，必须标注 `UNVERIFIED_REQUIRES_EVIDENCE`，不得用等待、延长 timeout 或静态推断冒充动态通过。

## 输出要求

Reviewer 只写：

`doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-remediation-independent-review-round-2-verdict.md`

文件必须包含上述 metadata、逐条 finding 的 `CONFIRMED / PARTIALLY_CONFIRMED / REJECTED_WITH_EVIDENCE / UNVERIFIED_REQUIRES_EVIDENCE / DEXTER_DECISION`、`GO`/`NO-GO`、`M/S/N`、真实证据路径与适用边界，并声明 `ROUND_FINAL_DECISION=SELF_DECIDED`。不得改动生产源码、契约、生成物、测试或作者 intake；不得代写作者 intake；不得召集第三轮 reviewer。
