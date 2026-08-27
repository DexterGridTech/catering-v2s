# base-1 requirements independent review

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
REVIEW_CYCLE_ID=BASE1-REQUIREMENTS-2026-08-27-CODEX-INDEPENDENT
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
BLIND_DECLARATION=本轮先独立读取入口、skill、review-standard、project-memory、正本与 owning source，并以证伪立场形成 findings/verdict；未读取作者自审或 finding disposition；未把两份 2026-08-26 已作废文档作为行动依据。
AUTHORIZATION_BOUNDARY=仅 review；不授权实施、生产代码变更、需求/标准/记忆修改、测试、DEV、reset、seed、L2、UAT、部署或 Git。本轮只写入 checklist 与 review artifact。
```

## Verdict

**NO-GO — M=4 / S=2 / N=2.**

被审稿的大方向与 Dexter 三句原则一致，且 §7.2 的 role/account 运行期授权判断基本成立；但它现在还不能作为 base-1 实施输入。主要问题不是“缺一点文案”，而是几个会让实施第一步或后续验收直接撞墙的分母/控制面漂移：backend-acceptance cap 口径没有同批收敛，旧按屏读契约义务被低估，239/reads102 gate 链漏掉一个仍运行的 verifier，且 full change surface/seed/fixture/generated 同步面没有被列成可执行分母。

## Findings

### M-01 — backend-acceptance “80 cap” 退役没有同步到当前入口和项目记忆

Status: `CONFIRMED`

Owning source:

- 被审稿声明去掉 80 上限：`doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:191,295`
- 当前主动规范已改为“不设上限”：`doc/decisions/2026-08-14-v2s-backend-acceptance-business-scenario-standard.md:17`
- 但当前入口仍写上限：`AGENTS.md:81`
- 项目记忆仍写上限/五域：`project-memory/operations/backend-acceptance.md:19`; `project-memory/practices/backend-capability-lookup.md:35`
- 当前真实 scenario 已是 80 条、9 个 domain group：`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/*AcceptanceScenarios.java` scan = `4+7+2+10+9+7+1+2+38`

Issue: 被审稿把“裁定 14 去掉 backend-acceptance 80 条上限”作为 base-1 前提，但同批 change surface 没有包含仍会指导后续 agent 和 executor 的入口/记忆。更糟的是 `project-memory/operations/backend-acceptance.md:19` 还限定五个 scenario 文件，而当前真实目录已包含 `Audit/Extension/Collaboration/BusinessChannel` 等 9 个 group。

Falsifiable failure condition: 后续新增第 81 条 scenario，或新增到 audit/extension/collaboration/business-channel 组时，实施者按 `AGENTS.md`/project-memory 会认为超上限或文件位置不合法；或者 review 继续按五域口径漏扫真实 runner 已发现的场景。

Same-root scan: `CLAUDE.md:55` 已写“总数不设上限”但仍说“当前已实现并运行 80 条”；`scripts/README.md:66-68` 写当前 80 条且列出 9 域；`doc/decisions/2026-08-14...:42-53` 列出 9 域并在 `:132` 要求代码、设计、项目记忆与 skill 同一口径；`AGENTS.md` 与两份 project-memory 仍漂移。

Counterexample boundary: 仅“当前刚好 80 条”不是缺陷；缺陷是 active instruction/memory 仍把 80 当上限或把五域当唯一位置。

Minimum fix: 同批修订 `AGENTS.md:81`、`project-memory/operations/backend-acceptance.md:19`、`project-memory/practices/backend-capability-lookup.md:35` 等当前入口/记忆指针，使其统一为“不设总数上限、按当前 9 domain group/自动发现扩展、BackendAcceptanceTest 不堆业务断言”。若保留“当前 80 条”，必须标成观测值而非 cap。

Why smaller fix is insufficient: 只改被审稿或只改主动规范不能防止下一轮 agent 继续从入口/记忆读到旧 cap；这是同一事实两个住址漂移，不是单文档 typo。

### M-02 — blocker 5 的契约旧口径分母错误：assertion matrix 是 7 处，不是 2 处

Status: `CONFIRMED`

Owning source:

- 被审稿：`doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:256`
- `contracts/catalog/catalog-inventory-edge-contract.json`: `485,5099,5241,5364,5489,5624,5748`
- `contracts/policy/catalog-inventory-assertion-matrix.json`: `802,6053,6249,6380,6513,6656,6788`

Issue: 被审稿说旧短语 `Load exactly the approved detail section with bounded task reads and return its typed read model.` 在 edge contract 7 处、assertion matrix 2 处；当前 bytes 显示 assertion matrix 也是 7 处。实际总分母是 14 处，而不是 9 处。

Falsifiable failure condition: 实施者按 “7+2” 修改，只会清掉 assertion matrix 的 2 处，剩余 5 个 operation 仍带 “approved detail section / bounded task reads” 的按屏取数义务；base-1 的“读模型不按屏裁剪”在契约层仍自相矛盾。

Same-root scan: 两个文件均全量扫描该 exact phrase；没有使用 BSD grep CJK regex；命中行如上。

Counterexample boundary: 如果某个命中是非当前 operation 的历史说明，可以从 current generated/edge consumer 中证明不可达后列入退役清单；在当前 draft 未给出这种反例前，它仍是契约义务。

Minimum fix: 把 blocker 5 改为 14 处总分母，并逐条列出 operation/component/契约片段处置：改为完整业务结构、退役、或用 current-unreachable 证据排除。

Why smaller fix is insufficient: “顺手全局替换”没有说明哪些 operation 仍应存在、哪些是历史残留；而继续保留 “2 处” 会让 review 无法证明分母闭合。

### M-03 — blocker 1 漏掉仍运行的 239/count verifier，第一步“全局阻塞”分母不闭合

Status: `CONFIRMED`

Owning source:

- 被审稿 blocker 1：`doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:215-221,260`
- `scripts/generate/backend-performance-budget.mjs:10,210,635-648`
- `scripts/generate/operation-handler-bindings.mjs:19-25,406-408`
- `scripts/test/r5-remote-testcontainers.mjs:343-369`
- `scripts/test/backend-performance-operation-reconciliation.mjs:163,223,261,302,332`
- `contracts/policy/backend-performance-cp05-calibration-report.json` still records 239-operation calibration/budget material

Issue: 被审稿把“239 / reads:102 / cp05 calibration / edge-codegen / remote runner / design-byte 摘要链”列为唯一全局阻塞，但“正在跑的门”不止稿内四类。`scripts/test/backend-performance-operation-reconciliation.mjs` 对 registry expected size 239、connection expected size 239、identity variant expected size 239、normal sample matrix expected size 239 都 hard fail；它是 run-level verifier 口径的一部分，不是无关旧文档。

Falsifiable failure condition: 第一步只修 backend-performance-budget、operation-handler-bindings、edge-codegen、remote runner/design-byte，任一 operation set 变化后仍会在 `backend-performance-operation-reconciliation.mjs` 抛 `PERFORMANCE_*_OPERATION_COUNT_INVALID` 或 normal sample matrix count failure。

Same-root scan: hard-coded 239/102/count path included generation, binding generation, remote runner manifest verification, reconciliation verifier, CP05 report, and policy JSON references. `scripts/README.md:87-88` says generated 239-operation budget and run-level verifier were restored separately, so this path remains current until explicitly retired or derived.

Counterexample boundary: A retired script could be excluded only if current `scripts/README.md`/runner graph proves it is unreachable. The current README says the generated operation budget and run-level verifier are restored, so exclusion is not established.

Minimum fix: Extend blocker 1 to a finite “operation-count/control chain” table that includes `backend-performance-operation-reconciliation.mjs`, then choose one root-cause path for every consumer: derive count from the same generated registry, or explicitly retire that gate with updated runner documentation and red mutation.

Why smaller fix is insufficient: Changing `EXPECTED_OPERATION_COUNT` in one generator is the exact workaround pattern this repo has been trying to avoid; it masks denominator drift while leaving another fail-closed consumer behind.

### M-04 — requirements draft names contract/backend/test/seed fallout but lacks the full implementation change-surface denominator

Status: `CONFIRMED`

Owning source:

- Requirements claim: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:14`
- Rollout order and acceptance surface: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:258-315`
- Implementation template mandatory surfaces: `doc/decisions/templates/implementation-design-template.md:156-166` (§9a full-chain sync), `173-176` (§10 migration), `178-219` (§10b seed)
- Review-standard action 1-B: `doc/platform/review-standard.md:84-99`
- Independent source scan: 626 main Java files; Java/string assembly tokens 3965 hits / 119 files, SQL concat-like tokens 1469 hits / 169 files, `DisplayName/Label/Summary` suffix-symbol scan 67 unique names / 430 hits / 66 files

Issue: The draft correctly says the current failure mode makes one display expression ripple through contract, backend, test, and seed. But it does not provide the implementation template’s required per-fact matrix: contract/unique generator/generated outputs, backend owner/edge/migration, frontend model/surface/state, focused/static/HTTP/L2 tests, fixture/seed/executor, and explicit generated/N/A dispositions. For a refactor whose entire risk is cross-surface drift, that missing denominator is itself a blocker.

Falsifiable failure condition: An executor starts with §5’s six steps, changes response shapes or status values, and leaves old seed payloads, acceptance fixture assertions, generated client types, or front-end model/copy in the previous shape. Static code may compile while reset+seed or later dynamic acceptance fails; the draft provides no path-level list to catch it.

Same-root scan: The current source roots count exactly 210 module main Java files and 416 app main Java files. Existing assembly/display candidates are much wider than a few catalog examples. The draft’s “41 fields” number is not a path-level denominator: independent main-Java scan sees 67 suffix-symbol names, while contract-property scans can produce a different number depending on whether unique property names or field paths are counted.

Counterexample boundary: A pure requirements draft does not need to become the final implementation-facing design. But if it is used to authorize or dispatch implementation, it must either contain or explicitly require a separate implementation-facing §9a/§10/§10b/§11 package before any source changes.

Minimum fix: Add an explicit “not implementation-facing” stop condition, then produce a separate implementation-facing design with §9a/§10/§10b/acceptance/fixture/generator/frontend matrices before implementation. At minimum, base-1 must list each changed fact and the exact contract/source/generated/test/seed/frontend consumer or a falsifiable N/A reason.

Why smaller fix is insufficient: Listing only blockers and rollout phases catches first-order failures, not stale generated/seed/test consumers. The defect class is full-chain drift; a partial list recreates the same root cause.

### S-01 — front-end static enum dictionary source is ambiguous and may create two residences for one display vocabulary

Status: `PARTIALLY_CONFIRMED`

Owning source:

- Requirements: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:153,364-374`
- Frontend standard “one fact one residence”: `doc/platform/frontend-coding-standard.md:246-258`
- Frontend standard “should live in foundation/shared when shared behavior exists”: `doc/platform/frontend-coding-standard.md:260-267`
- Owner read/lifecycle memory: `project-memory/decisions/owner-read-model-and-lifecycle-standard.md:19-27,52-58`

Issue: The product direction “code-defined closed set labels live in frontend, not backend operation” is defensible. The ambiguous part is execution: “两个 App 各建一份枚举字典(或从生成的契约 enum 派生)” allows two handwritten app-local dictionaries for the same code-defined vocabulary. That weakens the “多个前端同一事实一个接口/同一事实一个住址” intent at the presentation-fact layer, even if no backend interface is needed.

Falsifiable failure condition: `platform-admin` and `operations-admin` independently define labels for the same enum value; one is updated after a vocabulary/product-copy change and the other is not, with no compile-time/generated-source failure.

Same-root scan: The current task has no UI surface to inspect, so this is a design-source ambiguity rather than an implementation defect. `doc/platform/frontend-coding-standard.md:262` makes shared/foundation residence mandatory for shared frontend capability; however app-owned business copy can remain app-local when the enum is app-specific.

Counterexample boundary: If a closed-set label applies to exactly one app or one route-specific business wording, app-local is acceptable. If both apps display the same code-defined vocabulary, the source must be generated/shared or otherwise single-residence.

Minimum fix: Replace the “两个 App 各建一份” option with a narrower rule: derive vocabulary keys from generated contract enum, and place shared labels in one shared/generated frontend module; only app-specific wording may be app-local with an explicit N/A reason.

Why smaller fix is insufficient: Saying “front-end dictionary” alone answers backend-vs-frontend, but not single-residence. The drift can happen entirely inside the frontend layer.

### S-02 — `catalog_composite_component.status` exemption leaves exact status vocabulary undecided

Status: `CONFIRMED`

Owning source:

- Requirements: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:352-360`
- Source behavior cited by draft and confirmed by scan: `apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogCompositeFacts.java` reads/writes component `status`
- Migration/status corpus scan: status vocabularies still include `ARCHIVED` in catalog/fixture/policy surfaces; `V20260816_020000_000__catalog_sku_voided_code_release.sql:1-28` documents the pre-base-1 ARCHIVED-vs-VOIDED split

Issue: §7.3 correctly finds that `catalog_composite_component` is not ordinary主数据 and cannot be treated like user-togglable lifecycle rows. But the draft stops with “豁免表的状态词汇如何处置,须在实施前明确”. That leaves a concrete enum/check value unresolved inside a requirements document that also says platform `ARCHIVED` unifies into `VOIDED`.

Falsifiable failure condition: One executor preserves `ARCHIVED` because the table is exempt; another maps to `VOIDED` because裁定 12 says统一并入; generated contract/check/fixture/frontend dictionary then disagree about allowed values.

Same-root scan: The exception is not “dead field”: it is full request/readback behavior. The review did not decide the product rule; it only confirms the draft has not settled the exact execution value.

Counterexample boundary: Keeping a non-master-data status vocabulary can be acceptable if it is explicitly named as an exception with a different semantic (`component-row edit lifecycle`, not platform master-data lifecycle) and all contract/migration/frontend consumers use that vocabulary consistently.

Minimum fix: Before implementation, choose and record one exact vocabulary for this exempt table: keep `ENABLED/DISABLED/ARCHIVED` with explicit non-master-data semantics, or migrate/check/contract it to the base-1 vocabulary. Also list generated/fixture/frontend consumers.

Why smaller fix is insufficient: Merely adding the table to an exemption list tells implementers not to delete the column; it does not tell them what values are legal after base-1.

### N-01 — “41 DisplayName/Label/Summary fields” is not reproducible without a path-level denominator

Status: `UNVERIFIED_REQUIRES_EVIDENCE`

Owning source:

- Requirements: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:134-153,254`
- Independent main-Java scan result: 67 unique suffix-symbol names, 430 hits across 66 files

Issue: The draft’s four-way classification is the right idea; the raw number “41 fields across 8 domains” is not reproducible from the scan method unless “field” means a specific contract field-path denominator rather than Java symbols, schema properties, or unique names. This is dangerous because the same section warns not to suffix-cut blindly.

Falsifiable failure condition: Reviewers/executors cannot decide whether a changed field was inside or outside the 41; one scan says 37 unique contract property names, another says 67 Java suffix symbols.

Same-root scan: The broader source scan intentionally overmatches methods/helpers like `readCatalogInventorySummary`, proving why suffix-only counting is a poor denominator. The draft needs the exact contract/schema paths for the 41 and the four-class disposition for each.

Counterexample boundary: If the author has a separate machine-readable path list, the number may be correct; it just is not carried by this artifact.

Minimum fix: Add a table with 41 exact field paths, source contract, owning domain, classification, and disposition. Keep the warning against suffix-only deletion.

Why smaller fix is insufficient: A count without paths cannot be independently rechecked and will collapse back into suffix-based deletion.

### N-02 — “三句推出全部/唯一成因” overstates authority for rules that have separate sources

Status: `PARTIALLY_CONFIRMED`

Owning source:

- Requirements: `doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md:8-24,95-101,318-378`
- Review-standard says conflicts with more specific artifacts are findings: `doc/platform/review-standard.md:27-29`

Issue: The three Dexter sentences are a strong root principle for read-model/display assembly. They do not by themselves settle every base-1 rule: error-message retirement is explicitly postponed; runtime authorization identity has a separate IA/source basis; lifecycle three-state has separate Dexter裁定; §7 contains Claude代裁 that can be overturned. The draft often does name these exceptions, so this is not a blocking defect, but the “后面全部由它推出/唯一成因” framing can cause later review to treat separately sourced exceptions as contradictions.

Falsifiable failure condition: A later implementation rejects a necessary exception, such as time-point snapshots or static-operation-capability split operations, because it tries to mechanically derive all behavior from the three sentences alone.

Same-root scan: §0.1, §0.2, §1.5, §7.1-§7.4 already prove multiple source classes exist; the problem is framing precision, not absence of those sections.

Counterexample boundary: This wording is acceptable as a rhetorical introduction if every derived rule later carries its actual authority and exception boundary.

Minimum fix: Rephrase §0 to “base-1 的主线由三句推出；生命周期、授权身份、错误消息范围和四条代裁另有显式来源/边界”, then keep per-rule sourceRefs.

Why smaller fix is insufficient: Leaving the absolute wording invites a false universal rule; deleting the principle would lose the useful root-cause framing.

## Confirmed non-findings / validated claims

- `noClientDerivedAuthorization` split-operation logic is plausible: the draft correctly distinguishes operation identity carrying authorization target from ordinary display/shape differences. I did not find evidence requiring those 21 operations to merge.
- `WorkspaceAuthenticationService` role runtime authorization must not be relaxed: source keeps `r.status='ENABLED'` in session/current-assignment resolution (`WorkspaceAuthenticationService.java:522,901,1282,1303`), consistent with G-07 immediate permission effect.
- The account login/OTP sequence in §7.2 is correctly ordered: password login and mobile OTP lookup lack `a.status='ENABLED'` (`WorkspaceAuthenticationService.java:188-195,947-953`), while password recovery already filters enabled account (`WorkspacePasswordRecoveryService.java:281-305`).
- Contract creation and invitation creation blockers are real: `BusinessEntityService.java:2115-2135` returns store status without filtering; `ContractCommandService.java:78-82,143-151` only checks project id; `WorkspaceInvitationService.java:249-258` does not check `role.status()`.
- Main source-root denominator in the prompt is current: `modules/**/src/main/java` = 210 Java files; `src/main/java` = 416 Java files.

## Required review-standard §5 block

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=4/2/2
L1_ENGINEERING=findings: M-01 backend-acceptance cap/control surface drift; M-02 old detail-section contract denominator false; M-03 239/count running gate denominator incomplete; M-04 implementation change-surface/seed/generated/test denominator missing; S-02 composite component status vocabulary undecided.
L2_USER_VISIBLE=NOT_APPLICABLE_WITH_REASON(纯后台/需求治理，无本批 UI surface)
L3_UNVERIFIED=N-01 DisplayName/Label/Summary 41-field denominator requires path-level proof; N-02 three-sentence framing needs narrower source attribution.
SAME_ROOT_SCAN=M-01 scanned active entrypoints/standard/project-memory and 9 acceptance scenario groups; M-02 scanned exact phrase in both contract/policy JSON files; M-03 scanned generator/binding/remote-runner/reconciliation/CP05 count chain; M-04 scanned both backend main Java roots and template surfaces; S-01 checked frontend single-residence/foundation standard boundary; S-02 checked composite status read/write and migration/status surfaces.
DESIGN_GAPS=Implementation-facing §9a full-chain sync table absent; §10b seed table absent; acceptance fixture/scenario map absent; operation-count control chain table incomplete; component-status exception vocabulary undecided; frontend enum dictionary residence ambiguous; 41-field denominator lacks exact paths.
EVIDENCE_TIER=静态 only: authoritative docs/project-memory/full target artifact/source scans. No Git, tests, DEV, reset, seed, L2, UAT, deployment, or dynamic runner executed.
```

## Recommendation

**REQUEST CHANGES / NO-GO for implementation use.** The requirements can be repaired with targeted text/source-of-truth synchronization; no production code change or dynamic run is required to close this review round.

