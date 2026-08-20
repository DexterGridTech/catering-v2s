REVIEW_CYCLE_ID=EXTERNAL_COLLABORATION_DESIGN_2026_08_19
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=REQUIRED
ROUND_FINAL_DECISION=SELF_DECIDED

# 独立设计盲审 Round 2 输入清单

本轮是同一 review cycle 的最终定向复核，不得重置轮次。Round 1 的完整最小输入清单仍是：
`doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-design-review-round-1-input-checklist.md`
reviewer 必须完整读取该清单列出的 56 个输入及原文；当前 Round 1 清单已复算为 `CHECKLIST_HASHES=56/56`。

Round 1 独立 verdict（仅在 reviewer 先独立重建 expected behavior 后读取）与 author intake 是本轮修复目标的索引，不是预先替代判断：

- `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-design-independent-review-round-1-verdict.md`
- `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-design-independent-review-round-1-author-intake.md`

## 当前修复后输入 bytes

| path | sha256 | purpose |
| --- | --- | --- |
| `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-implementation-design.md` | `aeb75e787e7a8af2535c0aac25739fa51302f2e4cc351479bfce62ad64555ec4` | descriptor/provider status/commands/operation mapping/seed stage |
| `doc/plans/platform/2026-08-19-v2s-external-collaboration-and-business-channel-serial-plan.md` | `765420c905d5ba300a83a033bb9966402dc11ff4f3b22f3512989782053f0ecf` | CP-01/CP-04/CP-07/CP-08 repair |
| `doc/decisions/2026-08-19-v2s-external-collaboration-and-business-channel-ia.md` | `d05420deaefb684583647ed3445aa4a9009ba14d9ac7236ba9808e98645c9aab` | 15 typed problems / 11-screen IA |
| `doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md` | `cc2373d1d3dc3d329e549acf22048a6e063832878787ee953f2bd4bd85b6a9c9` | current seven catalog groups + two authorized groups |
| `doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-design-review-round-1-input-checklist.md` | `56/56 current hashes` | Round 1 input integrity repair |

## Round 2 targeted checks

1. Descriptor contract has the exact five fields `fieldKey/label/helpText/controlKind/optionSourceRef`; read values are separate capability values; `controlKind` is readonly; provider profile and readback both include `catalogStatus`; E-33 still treats PLANNED as non-gating.
2. `collaboration` API and business-channel API expose only owner commands required by the model; no `cascadeDisableByExternalReference`, `markBindingsCascadeDisabled`, `markBindingDeleted`, or undefined `disableEnablement`; edge matrix names declared commands, two owner commands and same `REQUIRED` transaction; C-01 remains dependency.
3. Seed repair is connected to existing managed composition: plan plus executor, parent stage IDs `[owner-command, external-collaboration-business-channel, catalog-inventory]`, child/parent manifest/report, managedDevRunId, business/cleanup/first failure; no seed is executed in review.
4. Every new operation has source shard/method, one face, authorization/requirement, resolver, owner recheck, typed problem, red fixture and context/version field; operations writes use only `BC-BUSINESS-CHANNEL-PROJECT-EDIT` and `BC-BUSINESS-CHANNEL-STORE-EDIT`; grant context is server-minted and `expectedContextVersion` is explicit.
5. CP-08 no longer assigns contract validation to `CatalogAcceptanceScenarios.java`; 14 scenarios remain only in `CollaborationAcceptanceScenarios.java` and `BusinessChannelAcceptanceScenarios.java`; active standard matches current catalog groups.
6. IA says `TYPED_PROBLEMS=15 total, including VERSION_CONFLICT`; all P1-P6/O1-O5 eleven screens remain in scope; no no-finding item regressed.
7. Recompute all Round 1 hashes and check the updated checklist; no hidden old literal/command/name remains in the current design family.

## Reviewer boundary

Do not modify files, execute production code, contract generation, migration, seed, reset, DEV, L2, UAT, external integration or Git; do not spawn children. Form the independent model before reading the prior verdict/intake. Output metadata, evidence, every finding classification, GO/NO-GO, M/S/N and `ROUND_FINAL_DECISION=SELF_DECIDED`. After this round no third independent review is allowed.
