# R5 合规整改 DESIGN 独立对抗审查 Round 2 输入清单

```text
REVIEW_CYCLE_ID=R5-COMPLIANCE-REMEDIATION-DESIGN-20260727
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
REVIEW_TARGET=DESIGN
reviewerKind=INDEPENDENT_SUBAGENT
```

## 1. 盲审与动态边界

- `READ` 表示本 reviewer 在独立 verdict 冻结前全文或按明确适用章节逐字读取；`TITLE_STATUS_READ` 表示按要求逐文件读取 `doc/decisions` 的 title/status，相关项另列为 `READ_FULL`。
- 独立 findings、severity、unit verdicts 与 `NO_GO` 已在读取本 cycle round-1 review/intake 前冻结。
- 未运行 build、DEV、seed/reset、数据库、浏览器或远端动态任务；未修改业务源码、contract、migration、test 或 scripts。

## 2. 根入口、Registry、Current Roadmap 与授权

| path | SHA-256 | readback |
| --- | --- | --- |
| `AGENTS.md` | `7df534e31d78cf9cbec390d0b1276abd069336d90f27a168969ae43c9d34315c` | READ |
| `CLAUDE.md` | `da3213ab7a75431198ac0d645d7de49b9705b07a27397a2e568d439ea4f66ca1` | READ |
| `PLATFORM-BLUEPRINT.md` | `91c0a83511df10a63a581c0678d7c2cdbc8a204b515bb570f3edba9fd92c365f` | READ |
| `doc/platform/README.md` | `809f9567df2048bfe40c254c6a613dae7535a6fdebb802f8a06b1e15ebd3687e` | READ |
| `doc/platform/roadmap-program-registry.json` | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` | READ; ACTIVE=`V2S_W0_W4_EXECUTION` |
| `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `abe6a04eab943e89086f737e71a4f22413b0284ee8f2818ca7492d0210555d49` | READ; all CURRENT_* parsed |
| `doc/decisions/2026-07-27-v2s-r5-compliance-remediation-design-authorization.md` | `e421bf728e91b77cccf20b34777dfdc2ccf4f3e222b32aa8a97630ee5008b521` | READ_FULL |
| `scripts/README.md` | `fec5b1855e8abc79c8012b3536458d0ad3ca19af19b92714bcd555c98890c26b` | READ |

Current truth readback: `CURRENT_STEP=R5`, `CURRENT_STATUS=WAITING_R5_COMPLIANCE_REMEDIATION_DESIGN_REVIEW`, `CURRENT_ACTIVITY=R5_COMPLIANCE_REMEDIATION_DESIGN_ONLY`, and implementation/runtime/seed-reset are all false. This is consistent with the exact design-only authorization.

## 3. Project memory：六个 kernel、六维 query 与全部命中

| path | SHA-256 | readback |
| --- | --- | --- |
| `project-memory/index.md` | `8fbedd001edda5bfff87d2ab1d31580d7f674582ff67a17b2cf19dbb37c260cb` | READ |
| `project-memory/routing-vocabulary.json` | `608e064d7c85223fe0c6c215a4a73b0100dfb89648490180986e248c99180707` | READ |
| `project-memory/kernel/01-workspace-and-roadmap.md` | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` | READ |
| `project-memory/kernel/02-service-shape-and-owner.md` | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` | READ |
| `project-memory/kernel/03-transaction-data-and-dependencies.md` | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` | READ |
| `project-memory/kernel/04-contract-consumer-and-admin.md` | `1f6d9efbe0208f5b164d12effd4a4c4ab8f2c297b9b000462dc96820c3efa88d` | READ |
| `project-memory/kernel/05-evidence-runtime-and-git.md` | `101a8d9952efff6bd217488c2444616e19af43a75413619055f9b0590e1a20a8` | READ |
| `project-memory/kernel/06-heritage-and-change.md` | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` | READ |
| `project-memory/decisions/deterministic-context-only.md` | `4c98ed79b0c8e4694893a29ed977fd2eccea6c1562f2d62f32c06dcbb5ac7e20` | READ |
| `project-memory/decisions/confirmed-business-language-corpus.md` | `51415f7d3b024967b10d89414534deb16c1c09e5eced2883f3573d98891b4503` | READ |
| `project-memory/decisions/independent-subagent-adversarial-review.md` | `891fc8de061560796dc682c5749d73a5d47029592fca197f09f032e3018b4daf` | READ |
| `project-memory/decisions/distributed-topology-is-not-current.md` | `c578afa258d1a7cb610aa87f8a80f5693f0477cfebd0795c8a5c863633c7664e` | READ |
| `project-memory/operations/claude-review-handoff-standard.md` | `35ee335e19c74ac3bdcd1e93281d60e2f36c5a4a9bf23ccf0759a43f9ab1137f` | READ |
| `project-memory/operations/verification-governance.md` | `090e9ce7b6907404103353d69474071b9dc12048f9956e3c05a7847f1397b577` | READ |
| `project-memory/operations/dev-command-separation.md` | `aa11398ca191776e93073d54c7d6a2d5d93c69636494e5f0598ee38f341ccfe1` | READ |
| `project-memory/operations/roadmap-control-transfer.md` | `bcff1e0404176b55ed2b2d438bec47985e88bdaf2b190ec310d84d8d89419e10` | READ |
| `project-memory/operations/business-corpus-adoption-and-read-policy.md` | `04d9329413131e369e8c1ea841f172d4c295f953b07b9768a0e597405fd28353` | READ |
| `project-memory/operations/phase-retrospective-and-systemic-repair.md` | `67c9a97ad808ee90e25dcf1bd1cb4ee964837a34e634ddea0f3dcbb40b7b3b50` | READ |
| `project-memory/operations/business-corpus-parked-domain-intake.md` | `739473d09701aba15332c6de72f1f1965b7b5048732fd60d3b97c7934febee9e` | READ |
| `project-memory/pitfalls/log-first-failure-retry.md` | `044df40abd43efb5948e6457b29f770b7798252c614e53eae1a7a92c40e9e909` | READ |

实际运行的六维合法 query：

1. `review/platform/backend/platform/governance/review`
2. `review/backend/backend/backend/architecture/review`
3. `review/platform/platform-admin/platform/evidence/review`
4. `testing/platform/backend/platform/runtime/runtime`
5. `review/platform/backend/product/roadmap/status-question`
6. `diagnostics/contract/backend/backend/cleanup/failure`

全部 query 命中原文的 union 为上述 6 kernel 加 12 个 routed entries；逐条已打开。Applicable source refs 另回读了：

- `doc/decisions/2026-07-24-v2s-r1-authorization.md@a2216874062892229424cc9f8c2bc478d110795b4876433782c6d22a2e78b615`
- `doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md@ebc8cc3affe6446979359194a64a50df9a693dc32cef0e97687caaee31ecd568`
- `doc/decisions/2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md@eb8772599be4ec7c9c111c074946f0ff22ce7b73c54ba29bc17e72131eb3849b`
- `doc/heritage/frozen/catering-all-v2/project-memory/decisions/logging-and-debugging-foundation-standard.md@597a87741247b7abf600486087539d614f501e7b53ff031a635f387213b2e03b`
- `doc/platform/claude-review-handoff-template.md@75cacde6f28152bdbd01d828c45f3be9b0a28a24e99dad24698c22341c6e702f`
- `doc/review/platform/2026-07-25-v2s-all-v2-governance-disposition-ledger.md@4152924af407d7f9fd372f826f8564408c59dd4d628bbcb5214ab6e251b709d1`

## 4. Confirmed business corpus

| path | SHA-256 | readback |
| --- | --- | --- |
| `doc/review/platform/2026-07-24-v2s-cross-generation-business-corpus-draft.md` | `4422ed54b3c693b6f44031ad0a17660a39ce86a4f7387abdd072ef0f8068bbb0` | READ §7.1–§7.12 canonical text |

检索词覆盖：`集团空间`、`商业集团`、`组织树`、`运营用户`、`运营角色`、`任职`、`可视数据节点`、`品牌`、`总公司`、`门店`、`启用`、`停用`、`租赁合同`、`货号`、`双后台 URL`、`操作历史`、`扩展字段`。本 R5 冻结范围命中 G-01～G-10；G-11/G-12 是未来商品/轻库存边界，不据此扩展 R5。`NO_CORPUS_ENTRY_MATCHED+操作历史,扩展字段`；这两个 literal miss 不解除其 non-corpus owning decisions。

不得推导边界已逐条回读，包括：空间存在不推出商业集团；集团初始化不推出组织树/账号/角色/门店；品牌授权不推出门店可见或门店写权；可视数据节点、页面准入、动作能力互不推出；邀请、撤销、角色替换不可偷换；门店状态不推出合同/营业/POS；合同状态不推出门店状态或唯一 current contract；URL key 不构成授权。

## 5. 被审对象、上游诊断与 accepted inputs

| path | SHA-256 | readback |
| --- | --- | --- |
| `doc/roadmaps/platform/2026-07-27-v2s-r5-compliance-remediation-roadmap.md` | `e08202cc20657ac5d405f32cfb88187d5e46babf900e986ad9fac6f60be3054f` | READ |
| `doc/plans/platform/2026-07-27-v2s-r5-compliance-remediation-implementation-design-and-plan.md` | `edbd083853e87e88cd3533c946aeb25f5e9f835da4a2f53bf778be93c4a25a08` | READ |
| `doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-granularity-manifest.json` | `e1b332b09cb9c9387ffc59c9541caa191cf8d6959618f315d9b349a74559fa92` | READ |
| `doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-manifest-chapter-hit-map.md` | `3baa9522a8a48dc6d5e88648286ab85d1820f217675786c2b9ef341fdc697032` | READ |
| `doc/review/platform/2026-07-27-v2s-r5-current-code-comprehensive-diagnostic-claude.md` | `3b221daafa60fca21f3a8c445dbf43e44a801ba1f69963b97c2d10bddb37856c` | READ |
| `doc/review/platform/2026-07-27-v2s-r5-current-code-comprehensive-diagnostic-codex.md` | `4226198f8d7147ac9bd9e633cf9671eb49541b3e91e6af7c8feab984614cc6c1` | READ |
| `doc/plans/platform/2026-07-26-v2s-r5-revised-implementation-design-and-plan.md` | `e7eab446fba849ae31e7f85f92facc72f71e8e273259d031f96762a4bde3d4dd` | READ |
| `doc/review/platform/2026-07-26-v2s-r5-revised-design-granularity-manifest.json` | `78a79d3f7f66aaab3ee90a3fec5401cfad5140da2c41d7fb880964a04177b049` | READ |
| `doc/plans/platform/2026-07-26-v2s-r5-revised-carryover-execution-inventory.md` | `95415ec2db922f31809342901e052622b89f6188248c176125c67f273c4d4ccc` | READ |
| `doc/decisions/2026-07-25-v2s-r5-whole-scope-journey-decision.md` | `dfa67547e3bda2b8703e8227cd463d65ad8211d09526eeed01c5b45a08e51324` | READ_FULL |
| `doc/decisions/2026-07-25-v2s-r5-whole-scope-interaction-design.md` | `5ae243d823cca0bd00570bdc351769661ebdcb7b88cfb8cae41b7324e754ab1e` | READ_FULL |
| `doc/decisions/2026-07-26-v2s-r5-operation-history-journey-decision.md` | `738cb4d604939bc72ddfcbebd789820275329bb3767e4bcadaa7faffb589d63f` | READ_FULL |
| `doc/decisions/2026-07-26-v2s-r5-operation-history-interaction-design.md` | `fd5cc25851021fe84f11172f1d5978a9630ba2eec86939957b149dc33f2c477f` | READ_FULL |
| `doc/review/platform/2026-07-26-v2s-extension-and-role-storage-alignment-design-claude.md` | `e3ac462114a39be45dad682002623d82e147746f4fbcb2a1ae0a1d1f32d8ac61` | READ |

## 6. Standards、checklist 与静态证明面

| path | SHA-256 | readback |
| --- | --- | --- |
| `contracts/policy/standards-coverage-matrix.json` | `6a9f7a700d1b4dbbf3e6fb910a1a291f95d61777c70120e7ae049c4b415101c5` | READ；内嵌 `reviewChecklists` 全读 |
| `doc/decisions/2026-07-24-v2s-verification-governance.md` | `c9632a65f9eac7678a4be919d980894e3f1e71e5e2e1ddce70ea3c7091d829dc` | READ_FULL |
| `doc/decisions/2026-07-24-v2s-solution-reasonableness-review-policy.md` | `b30cc0d28d4d79034f10914a50c85f6bac9cc394f092dccbfdac21a62e1163e7` | READ_FULL |
| `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | `95b79f7c74a3f867e9fdfef6b9f0d63d9e51e50cb08abc905056307d9423d508` | READ_FULL |
| `contracts/policy/frontend-asset-carryover-manifest.json` | `1a118c6ab2d5141780b98d1ab9a1f6b14366b21f54cc1fa9092b625d9e973d09` | READ |
| `contracts/policy/module-dependency-registry.json` | `4e29f8e0ea9b0a077e87feefc273f07cda165fa31e6eaef5539cf28a10d34830` | READ |
| `scripts/test/r5-remote-testcontainers.mjs` | `a0aa5028f9c8b8a9b1109fc7f880db242ed1505f46baec4fad4657e503ec7739` | READ |

只读检查：

- `scripts/check/standards-coverage --phase R5` => `PASS`, `RULES=150`
- `scripts/check/roadmap-program-registry` => `PASS`
- `scripts/check/project-memory` => `PASS`
- `scripts/check/provider-free-context` => `FAIL: skill denominator is not five`；精确读取后确认当前实际为 8 个项目 skill，且该已知状态由 R5-CR-U08 的 Blueprint/verification inventory 对齐负责，不把当前红升格为设计已关闭。

独立复算：

- 106 unique operationId；39 platform-admin / 56 operations-admin / 11 public。
- 32 unique scenario；22 surface；25 pageDesignKey；七个 Flyway fact-owner schema。
- 44 OpenAPI JSON/YAML files，1,330 refs；450 resolved / 880 unresolved，拆分为 50 missing-file + 830 missing-pointer，其中 742 ProblemResponse + 88 other pointer。
- standards 150 = B 85 + C 23 + D 42；machine 46 / human 104；manifest review/machine union=150、overlap=0。
- 10 个 unit（U00–U09）各有且仅有六个 denominator rows；manifest 自身 assertion/forbidden 使用 `CURRENT_MANIFEST_BYTES`，不存在 literal self-hash 悖论。
- `platform-access` 当前 registry 仍写 `platform_access`，设计 U04 已明确改为 `null`；其为 schema-less facade，不是第八 schema。
- D-1～D-7 均保持 pending 且阻断对应实施；CR00→CR09 严格串行；D-1～D-7 不因推荐项而默认。
- remote contract 已精确绑定 runner path/hash、显式 host/host SHA、task registry、source snapshot、receipt fields、business/cleanup 与七类 red fixtures。
- D.1～D.7 实施仍为 pending；本轮 DESIGN review 不把设计描述当已实施。

## 7. `doc/decisions` 全目录 title/status 清单

以下 43 个 Markdown 文件逐文件 `TITLE_STATUS_READ`；与本轮相关者已在上文或实际读取记录中全文回读。

```text
2026-07-24-v2s-execution-roadmap-r0-acceptance.md | active
2026-07-24-v2s-r1-authorization.md | active
2026-07-24-v2s-r2-acceptance.md | active
2026-07-24-v2s-r3-specialized-design-authorization.md | active
2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md | active
2026-07-24-v2s-solution-reasonableness-review-policy.md | active
2026-07-24-v2s-verification-governance.md | active
2026-07-25-v2s-agent-coordination-and-control-boundary.md | ACCEPTED
2026-07-25-v2s-backend-app-layout-and-tdp-placeholder.md | ACCEPTED
2026-07-25-v2s-confirmed-business-corpus-memory-adoption.md | active
2026-07-25-v2s-design-governance-batch-1-5.md | DEXTER_ACCEPTED
2026-07-25-v2s-design-governance-batch-1.md | DEXTER_ACCEPTED
2026-07-25-v2s-frontend-asset-carry-over-first.md | DEXTER_DIRECTED
2026-07-25-v2s-frontend-foundation-consumption-rule.md | ACCEPTED
2026-07-25-v2s-independent-subagent-adversarial-review-governance.md | DEXTER_ACCEPTED
2026-07-25-v2s-r3-c01-commercial-group-initialization-interaction.md | DEXTER_WIREFRAME_ACCEPTED
2026-07-25-v2s-r3-c01-commercial-group-initialization-journey-inventory.md | DEXTER_ACCEPTED
2026-07-25-v2s-r3-c02-operations-real-login-rejected-inventory.md | DEXTER_REJECTED
2026-07-25-v2s-r3-hash-evidence-checkpoint.md | ACCEPTED
2026-07-25-v2s-r3-implementation-acceptance.md | DEXTER_ACCEPTED
2026-07-25-v2s-r3-j02-commercial-group-initialization-selection.md | active
2026-07-25-v2s-r3-r6-journey-inventory-acceptance-and-c01-interaction-authorization.md | DEXTER_ACCEPTED
2026-07-25-v2s-r3-r6-journey-inventory.md | DEXTER_ACCEPTED_C01_INTERACTION_AUTHORIZED
2026-07-25-v2s-r3-whole-scope-design-acceptance.md | DEXTER_ACCEPTED
2026-07-25-v2s-r4-design-acceptance-and-implementation-authorization.md | DEXTER_ACCEPTED_AND_IMPLEMENTATION_AUTHORIZED
2026-07-25-v2s-r4-design-authorization.md | DEXTER_AUTHORIZED_DESIGN_ONLY
2026-07-25-v2s-r4-first-independent-review-input-checklist-exemption.md | ACTIVE_LIMITED_EXCEPTION
2026-07-25-v2s-r4-implementation-acceptance.md | DEXTER_ACCEPTED
2026-07-25-v2s-r5-scope-and-method-decisions.md | ACTIVE_SCOPE_DECISION
2026-07-25-v2s-r5-whole-scope-design-authorization.md | ACTIVE_AUTHORIZATION
2026-07-25-v2s-r5-whole-scope-interaction-design.md | DEXTER_ACCEPTED_V2_BASELINE
2026-07-25-v2s-r5-whole-scope-journey-decision.md | DEXTER_ACCEPTED
2026-07-25-v2s-roadmap-r-unit-atomic-delivery-rule.md | ACCEPTED
2026-07-26-v2s-post-remediation-review-binding-governance.md | ACTIVE_GOVERNANCE_AMENDMENT
2026-07-26-v2s-r5-claude-review-five-point-resolution.md | ACTIVE_SCOPE_DECISION
2026-07-26-v2s-r5-operation-history-interaction-design.md | DEXTER_WIREFRAME_ACCEPTED
2026-07-26-v2s-r5-operation-history-journey-decision.md | DEXTER_ACCEPTED_SCOPE_AND_INTERACTION
2026-07-26-v2s-r5-revised-design-authorization.md | DEXTER_AUTHORIZED_DESIGN_ONLY
2026-07-26-v2s-r5-revised-design-final-acceptance.md | DEXTER_ACCEPTED
2026-07-26-v2s-r5-revised-whole-scope-implementation-authorization.md | DEXTER_AUTHORIZED
2026-07-26-v2s-r5-whole-scope-design-final-acceptance.md | DEXTER_ACCEPTED
2026-07-26-v2s-r5-whole-scope-implementation-authorization.md | DEXTER_AUTHORIZED
2026-07-27-v2s-r5-compliance-remediation-design-authorization.md | DEXTER_AUTHORIZED_DESIGN_ONLY
```

## 8. 独立 verdict 冻结后才读取的作者材料

| path | SHA-256 | order |
| --- | --- | --- |
| `doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-adversarial-review-round-1.json` | `e0a76ebee3bc56126af4df3b17f2b3f5a29982d0c1e8ac797325c644ac2ef14a` | READ_AFTER_INDEPENDENT_VERDICT |
| `doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-round-1-intake.md` | `6c1e24bdf9182aefafe26a290035e1690b92cd9c59cb32ec89a35abf5c2074a8` | READ_AFTER_INDEPENDENT_VERDICT |

差异摘要：round-1 的 resolver、十乘六分母、Roadmap pause、七 schema、remote runner、150 partition 与 non-corpus authority 多数已修订关闭；round-2 独立证伪发现其“适用性”修订仍未闭合——十个 unit 没有 `domain/face/owner/impact` route tuple，22 surface/25 pageDesignKey 的 owning source rows 也没有 owning-unit 字段，U05/U06 只以自然语言 selector 互相 split。该差异不改变盲审前已冻结 verdict。
