# V2S Base-1 Requirements Independent Review Round 2

- `REVIEW_CYCLE_ID=BASE1-REQUIREMENTS-2026-08-27-CODEX-INDEPENDENT`
- `REVIEW_TARGET=DESIGN`
- `ACTION_1_VARIANT=1-B 文档提取`
- `REVIEW_ROUND=2`
- `REVIEW_ROUND_LIMIT=2`
- `reviewerKind=INDEPENDENT_SUBAGENT`
- `ROUND_FINAL_DECISION=SELF_DECIDED`
- 授权边界：仅 review；不授权实施、运行、数据、Git、DEV、reset、seed、L2、UAT 或部署。本轮只新增本文件与 round-2 input checklist。

## Blind declaration

我先重开 Round 1 verdict 与本轮指定 owning source，再独立复判 12 个信号；没有读取或采信作者自审、finding disposition，也没有把 Round 1 finding 当作无需证明的事实。本轮是同一 cycle 的第 2 轮，达到 `REVIEW_ROUND_LIMIT=2` 后硬停止，不开启第三轮。

## Verdict

`NO-GO — M=7 / S=2 / N=2`

Round 2 修正了 Round 1 的两个过宽结论：§8 已明示非实施授权，因此 Round1 M-04 不再作为需求稿本身的 M；双 App 文案允许按 app-local business copy/Journey behavior 有差异，因此 Round1 S-01 不再作为 S。相反，本轮从源码补强出四个 Round1 未充分覆盖的阻断：后端安全脱敏第三类例外、contract 硬编码展示 fallback、workspace account collision lookup 状态语义、BusinessChannel guard 误指，以及 stock partial unique 与生命周期规则冲突。

## Blocking findings

### M-01 — 后端安全脱敏是第三类必须保留的后端拼装例外，需求稿现有例外漏收

- 状态：`CONFIRMED`
- Owning source：`PlatformAdminGovernanceController.java:134-148,171-173`; `WorkspaceUserService.java:491-498,871-875`; `WorkspaceInvitationService.java:433-437,503-507,750-756,1451-1455`; `PlatformWorkspaceInvitationTaskReadService.java:95-100,268-272`; requirements draft §0.1/§1.5 only covers time snapshot and non-human composite.
- 可证伪失败条件：若需求稿的“后台只返回事实/前端自行展示”按字面删除 backend masking fields or helpers，用户可见安全脱敏将下沉到前端或与 raw PII 同源混用。
- 有限同根全集：本轮确认 4 条 backend user-visible masking chain；其余普通 `statusDisplayName`/`Label` 不自动归入安全例外。
- 反例边界：纯 enum 文案、非敏感 item summary、前端 app-local copy 不是安全脱敏例外。
- 最小修复：在 Base-1 rules 中增加“security/privacy redaction assembly”第三类语义例外：后端必须返回可展示的脱敏值，并明确 raw value 暴露边界。
- 为什么更小方案不足：只把个别 mobile 字段列入 scope exclusion 会遗漏后续同族 PII，且无法约束 raw/mobileMasked 双字段的安全所有权。

### M-02 — 全平台机制/domain coverage 漏了 contract 硬编码展示 fallback 与 itemSummary 拼装

- 状态：`CONFIRMED`
- Owning source：`PlatformContractOverviewController.java:127-146` and `153-174`; requirements draft §2/§4 source coverage.
- 证据：`phaseName == null ? "未设置" : value.phaseName()` at 131/159; `value.items().stream().map(Item::code).collect(joining(", "))` at 144-146 and 172-174.
- 可证伪失败条件：若 Base-1 只按 catalog/organization/business-channel 执行，会保留或遗漏 contract edge 的 hardcoded display fallback，导致所谓“全平台”不成立。
- 有限同根全集：本轮确认 contract overview 至少 2 个 fallback 点、2 个 itemSummary 点；其余 contract controllers 未被证明无类似 hardcoded display fallback。
- 反例边界：`LocalDate.toString()` 等标准序列化不属于 user-visible fallback 文案。
- 最小修复：把 contract edge 纳入 §2 mechanism/domain denominator，并把 hardcoded fallback、joining summary 分入第二/三/四类的具体处置表。
- 为什么更小方案不足：只删除“未设置”不处理 `itemSummary`，或只处理 contract 不回写 denominator，都会留下同根扫描缺口。

### M-03 — DisplayName/Label/Summary 字段与装配 denominator 不可复现且闭集分类不完整

- 状态：`PARTIALLY_CONFIRMED` for exact numbers; `CONFIRMED` for defect.
- Owning source：two Java main roots; `CheckedInCollaborationCatalogSource.java:127,147,165-201`; `BusinessChannelWireMapper.java:147-155`; requirements draft §2.3; Round1 N-01.
- 证据：本轮 main Java count was 626. My reconstructed CJK+ scan found 39 lines / 12 files, not the draft's 37/11; the directed 41/12 number was not independently reproducible because no saved member list/method was provided. Broad organization path candidate scan produced 54 lines / 7 files, proving the 18-point organization body count is at least under-specified. Checked-in collaboration defines `attributeValueLabels`, `catalogStatusDisplayName`, `businessScopeDisplayNames`, `bindableNodeTypeDisplayNames`, `authenticationKindDisplayName`, `unbindKindDisplayName`, and `catalogStatusDisplayName`; business-channel defines `stopReasonDisplayNames`.
- 可证伪失败条件：若 an executor deletes “12 code-defined closed-set fields” or uses 37/11/18 as the denominator, current source contains omitted labels/display names/summaries and organization assembly points.
- 有限同根全集：Round 1 already observed suffix names far beyond 12; Round 2 adds checked-in collaboration catalog and business-channel stopReasonDisplayNames as concrete omissions. The exact 41-field list remains untrusted until saved with members.
- 反例边界：Generated type names that are not returned or mapped at runtime should be excluded, but only after member-level evidence.
- 最小修复：replace all aggregate counts with a checked-in member list grouped by source mechanism: generated OpenAPI response field, edge mapper helper, owner read model, checked-in static catalog, SQL/display path assembly.
- 为什么更小方案不足：adjusting 37→41 or 12→N without member identity repeats the same unreviewable denominator failure.

### M-04 — workspace account/role status semantics are incomplete for collision-sensitive lookup

- 状态：`CONFIRMED`
- Owning source：`WorkspaceAuthenticationService.java:188-195,946-953`; `WorkspaceInvitationService.java:1060-1072,1323-1331`; contrast `WorkspacePasswordRecoveryService.java:277-305`; `WorkspaceRoleService.java:318-332,468-485,499-522`; requirements draft §7.1/§7.2.
- 证据：password login and mobile OTP lookup by login/mobile do not filter `a.status='ENABLED'`; invitation completion/accountExists lookup by mobile do not filter status. Password recovery already uses `status='ENABLED'`, showing the state semantics exist. `WorkspaceRoleService.require/requireAll` reads by id without status filter, while role can transition between `ENABLED` and `DISABLED`.
- 可证伪失败条件：after partial unique/index changes release keys on VOIDED, a DISABLED account/role can still be selected for login/invitation/assignment flows unless command-specific enabled semantics are explicit.
- 有限同根全集：6 collision-sensitive lookup classes checked: password login, OTP mobile login, password recovery matching account, password recovery enabled account, invitation completion account lookup, invitation accountExists. Recovery is already enabled-filtered; login/OTP/invitation are not. Role require/requireAll adds a separate assignment-status gap.
- 反例边界：platform/task read pages may intentionally list DISABLED/VOIDED records; id detail read is not automatically collision-sensitive unless it grants runtime authority.
- 最小修复：define per-command status semantics: runtime authentication and invitation account adoption must select only ENABLED active identities; read/history can include non-active identities; role assignment/admission must require role `ENABLED` where it grants access.
- 为什么更小方案不足：only patching login/OTP leaves invitation completion able to attach to or block on the wrong status; only patching indexes leaves runtime selection ambiguous.

### M-05 — BusinessChannel §7.1 points to the wrong guard and counts a dead coordinator helper

- 状态：`CONFIRMED`
- Owning source：`BusinessChannelOwnerService.java:511,649,736,767,769,868,870,1465-1468`; `BusinessChannelPolicy.java:91-118`; `ExternalCollaborationBusinessChannelCoordinator.java:310-313`; requirements draft §7.1.
- 证据：there are 7 live owner `requireEditable` checks. The edge coordinator `requireEditable(Channel)` helper has zero call sites. `BusinessChannelPolicy.validateBinding(... requireEffective)` throws `BINDING_NOT_EFFECTIVE` only when binding is missing or binding status is not `EFFECTIVE`; it does not check business channel or template status.
- 可证伪失败条件：if §7.1 is implemented as “渠道绑定沿用既有 `BINDING_NOT_EFFECTIVE`”, disabled channel/template status is not what that guard enforces, and one listed code point is dead.
- 有限同根全集：7 live owner calls + 1 dead coordinator helper + policy binding guard checked.
- 反例边界：operations owner create/update paths that already call `requireEditable` on template/channel are not the same as external binding validation.
- 最小修复：rewrite §7.1 to name the exact channel/template/binding status owner and live call sites; do not use `BINDING_NOT_EFFECTIVE` as a proxy for channel enabled/editable state.
- 为什么更小方案不足：renaming the problem code only changes surface wording; it does not add the missing channel/template status predicate.

### M-06 — stock_target/stock_bom partial unique indexes violate the disabled-still-occupies-key lifecycle rule

- 状态：`CONFIRMED`
- Owning source：migration CHECK parser over `src/main/resources/db/migration/*.sql`; `V20260822_010000_000__catalog_inventory_rule_definition_status.sql:42-58`; requirements draft §2/§4 lifecycle blockers.
- 证据：migration scan found 17 two-value `ENABLED/DISABLED` CHECK declarations over 15 tables; after excluding `platform_workspace.group_workspace`, `platform_iam.platform_admin`, `collaboration.external_system_enablement`, and `collaboration.provider_profile_enablement`, 11 lifecycle tables remain. `stock_target` and `stock_bom` use unique indexes with `WHERE definition_status='ENABLED'`.
- 可证伪失败条件：if DISABLED definitions should continue occupying the business key until VOIDED, an ENABLED-only partial unique index permits a new ENABLED row to reuse a key still held by DISABLED.
- 有限同根全集：remaining lifecycle tables: `business_channel.business_channel_template`, `catalog.unit_definition`, `inventory.stock_bom`, `inventory.stock_target`, `organization.brand`, `organization.head_company`, `organization.organization_node`, `organization.store`, `organization.tenant`, `workspace_iam.workspace_account`, `workspace_iam.workspace_role`.
- 反例边界：tables excluded from the lifecycle rule by explicit scope are not blockers; VOIDED-key release is also a separate three-state implementation, not present in these two-value checks.
- 最小修复：Base-1 must explicitly call out the stock indexes: disabled occupies key; only voided releases key; migration/index change must be paired with status-domain expansion.
- 为什么更小方案不足：changing enum CHECK without changing partial unique leaves the business invariant broken at DB level.

### M-07 — blocker 1 needs split sequencing, but generated/reconciliation omission remains blocking before operation identity changes

- 状态：`PARTIALLY_CONFIRMED`
- Owning source：requirements draft §4 blocker 1; `scripts/README.md:64-66`; memory/authority says current performance denominator is 239; Round 1 M-03.
- 证据：field-only response changes do not necessarily affect operation identity/count and should not be blocked by CP05/performance denominator recalculation first. However, operation identity/count/control-chain changes still need current 239/CP05/generated operation reconciliation before they are used as a gate. Round 1's “reconciliation verifier omission” remains confirmed.
- 可证伪失败条件：if the plan treats every field-only design-byte change as needing CP05 first, it overblocks harmless schema work; if it changes operation identity before fixing 239/CP05 reconciliation, it can invalidate generated operation gates.
- 有限同根全集：field-only generated/schema changes vs operation identity/count changes; only the latter needs CP05 first.
- 反例边界：renaming/removing/adding operations, changing required auth, or altering operation catalog membership is not field-only.
- 最小修复：split blocker 1 into (a) design-byte/generated field synchronization for field-only changes, same batch; (b) 239/CP05/reconciliation closure before operation identity/count/control-chain changes.
- 为什么更小方案不足：a single “step0 blocks all” loses the distinction; deleting step0 entirely loses the retained reconciliation blocker.

## Serious findings

### S-01 — active authority drift still exists around backend-acceptance 80 cap

- 状态：`CONFIRMED`
- Owning source：`CLAUDE.md:55`; `AGENTS.md:81`; `scripts/README.md:64-66`; `project-memory/operations/backend-acceptance.md:19`; `project-memory/practices/backend-capability-lookup.md:35`.
- 证据：`CLAUDE.md:55` says `总数不设上限` by Dexter 2026-08-27; other active guidance still says no more than/current 80 scenarios.
- 可证伪失败条件：an implementation/review agent following `AGENTS.md` or memory can reject legitimate scenario growth despite the newer no-cap authority.
- 有限同根全集：AGENTS, scripts README, and routed memory hits checked; no production code change authorized in this review.
- 反例边界：current observed count being 80 is not itself a cap.
- 最小修复：one authority source should own the current no-cap rule; stale 80-cap statements need retirement or explicit historical marking.
- 为什么更小方案不足：leaving stale text active preserves a split-brain gate.

### S-02 — composite component status vocabulary remains undecided against platform裁定

- 状态：`DEXTER_DECISION`
- Owning source：requirements draft §7.3; platform lifecycle requirements in Base-1; Round1 retained finding.
- 证据：Round 2 did not receive new decisive source that resolves whether composite component status is a semantic exception or contradicts the platform-wide lifecycle裁定.
- 可证伪失败条件：if implementation treats composite status as exempt without Dexter/platform decision, it can become a silent fourth lifecycle semantics.
- 有限同根全集：Round1 composite status issue retained; no new source in Round2 closes it.
- 反例边界：pure scope exclusion is not the same as semantic exception.
- 最小修复：mark as Dexter/platform decision before implementation.
- 为什么更小方案不足：a reviewer-local ruling would create a new criterion outside an owning source.

## Notes / non-blocking corrections

### N-01 — §8 means Round1 M-04 was over-severe as a requirements finding

- 状态：`REJECTED_WITH_EVIDENCE` as M.
- Owning source：requirements draft §8.
- Evidence：§8 states this is a requirements draft and does not authorize implementation, DEV, or data operations.
- Disposition：not a blocker against the requirements draft itself. It remains a downstream handoff condition: implementation still needs a concrete change-surface/seed/generated/test plan after approval.

### N-02 — dual App display copy may legitimately differ

- 状态：`REJECTED_WITH_EVIDENCE` as S.
- Owning source：`CLAUDE.md:73`; `AGENTS.md:52`; requirements draft §7.2.
- Evidence：both active instructions state the two apps own their own business copy/Journey behavior while shared foundation/generic lifecycle should not be duplicated.
- Disposition：the “one backend fact, multiple frontends” rule does not require identical user-visible wording in both apps. It requires one authoritative backend fact; app-local copy can differ when it is Journey/app-specific.

## Round-2 directed signal disposition

| # | Verdict |
|---:|---|
| 1 | `CONFIRMED` → M-01 |
| 2 | `CONFIRMED` → M-02 |
| 3 | `PARTIALLY_CONFIRMED` exact counts; denominator defect confirmed → M-03 |
| 4 | `CONFIRMED` → M-04 |
| 5 | `CONFIRMED` as correction: invitation target enterability already exists; role `ENABLED` is separate. No new blocker. |
| 6 | `CONFIRMED` → M-05 |
| 7 | `CONFIRMED` → M-06 |
| 8 | `PARTIALLY_CONFIRMED` → M-07 |
| 9 | `CONFIRMED` as denominator defect → M-03 |
| 10 | `REJECTED_WITH_EVIDENCE` as M → N-01 |
| 11 | `REJECTED_WITH_EVIDENCE` as S → N-02 |
| 12 | `CONFIRMED` → M-03 |

## Retained Round1 items

- 80-cap active authority drift retained as S-01.
- blocker5 denominator `7+7` not `7+2` retained in the broader denominator-risk family; Round 2 adds BusinessChannel live/dead split evidence.
- generated operation reconciliation omission retained as M-07, narrowed by sequencing.
- composite status unresolved retained as S-02 / Dexter decision.

## Required review-standard §5 block

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=7/2/2
L1_ENGINEERING=findings: M-01 backend security masking exception missing; M-02 contract fallback omitted; M-03 denominator/classification not reproducible; M-04 workspace account/role status lookup semantics incomplete; M-05 BusinessChannel guard wrong/dead helper; M-06 stock lifecycle unique-index mismatch; M-07 blocker1 sequencing/reconciliation gap; S-01 80-cap active authority drift; S-02 composite status requires Dexter decision.
L2_USER_VISIBLE=NOT_APPLICABLE_WITH_REASON: pure backend/requirements governance review; no UI surface is being implemented or verified in this batch.
L3_UNVERIFIED=No dynamic/runtime/browser/test evidence; static-only by authorization. Exact 41-field member list remains untrusted until checked in as a reproducible denominator.
SAME_ROOT_SCAN=M-01: 4 backend masking chains checked; M-02: contract overview fallback/itemSummary checked; M-03: both Java main roots scanned, checked-in collaboration and business-channel display-name sources added; M-04: 6 collision-sensitive workspace lookup classes checked; M-05: 7 live BusinessChannel owner calls + 0-call coordinator helper + policy guard checked; M-06: 17 two-value CHECK declarations / 15 tables / 11 in-scope lifecycle tables checked; M-07: field-only vs operation-identity change classes split.
DESIGN_GAPS=Missing third backend-controlled security redaction exception; missing contract edge/hardcoded fallback coverage; missing reproducible field/member denominator; missing command-specific active identity semantics; missing live BusinessChannel status predicate; missing stock partial unique treatment; missing split sequencing for generated field-only vs operation identity changes.
EVIDENCE_TIER=STATIC_SOURCE_ONLY_WITH_SHA256; no tests/runtime/Git by explicit authorization.
```

## Hard stop

Round 2 is final for `REVIEW_CYCLE_ID=BASE1-REQUIREMENTS-2026-08-27-CODEX-INDEPENDENT` under `REVIEW_ROUND_LIMIT=2`. I do not request or open a third independent review round. Remaining product/platform decisions go to Dexter/author disposition under `SELF_DECIDED`.
