# v2s sales-menu DESIGN adversarial review Round 1

targetPath=doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-1-claude.md

## Metadata

REVIEW_CYCLE_ID=SALES-MENU-DESIGN-2026-09-01  
REVIEW_TARGET=DESIGN  
ACTION_1_VARIANT=1-B 文档提取  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
reviewerAgentId=01a058bd-69fd-7a11-b30b-f9a043548fbf  
artifactTranscription=MAIN_AGENT_VERBATIM_FROM_INDEPENDENT_SUBAGENT  
reviewerInputChecklist={path:doc/review/platform/2026-09-01-v2s-sales-menu-design-review-round-1-input-checklist-claude.md,sha256:0fb5ca8385374223b46867ae290cf200d405a6ef9297e2b18530ae9811e26151}  
blindReviewDeclaration=独立 verdict 前未读取作者对账或作者 intake  
authorMaterialReadAfterIndependentVerdict=false  
writePolicy=NO_REPOSITORY_WRITE_BY_REVIEWER_DUE_READ_ONLY_SUPERIOR_CONSTRAINT  
evidencePolicy=STATIC_SOURCE_REVIEW_ONLY  
dynamicExecution=NOT_RUN  
gitExecution=NOT_RUN

## Verdict

VERDICT=NO-GO

M/S/N summary:

| severity | count |
| --- | ---: |
| M | 2 |
| S | 1 |
| N | 0 |

Outcome: 设计当前不能安全实施。原因不是主方案整体方向错误，而是 implementation-facing packet 仍有两个会让 executor 误判输入/seed 事实的 M 级问题，以及一个四阶段 seed parent 会踩到的 S 级硬编码耦合。

## Evidence tier

EVIDENCE_TIER=STATIC_SOURCE_REVIEW_ONLY

- Static/source evidence: YES
- Contract/generated source sampled: YES
- Backend owner/edge sampled: YES
- Frontend foundation/catalog image sampled: YES
- Backend-acceptance runner/scenario standard read: YES
- Browser L2 runner/standard sampled: YES
- Seed parent/profile/executor/plan sampled: YES
- Six-dimensional recall project-memory originals: READ_FULL
- Testcontainers PASS: NOT_RUN
- Browser L2 PASS: NOT_RUN
- DEV start/reset/seed PASS: NOT_RUN
- UAT/deploy PASS: NOT_RUN

Static review must not promote unrun Testcontainers, L2, seed, DEV, reset, UAT, or deployment to PASS.

## L1_ENGINEERING

L1_ENGINEERING=NO-GO

Confirmed engineering blockers:

1. The review/design input path for the implementation template drifted from canonical repository location. The canonical template is now read, but the packet must not preserve the wrong path as a required input.
2. The sales-menu seed design overstates existing business-channel seed facts. Current source has INTERNAL DINE_IN templates, but TAKEAWAY templates/channels are EXTERNAL.
3. The complete seed parent has two-stage assumptions beyond `COMPLETE_SEED_STAGE_IDS`: it also reads catalog at `stages[1]`. A four-stage design must explicitly retire this positional coupling.

Engineering checks that did not become findings after full recall read:

- G-08 disabled-store menu-publish blocking is covered by the implementation design and plan: publish blockers include disabled store/channel; activation disabled does not block.
- G-11/G-12 menu/catalog/inventory separation is covered at design level: the design keeps catalog facts in Catalog owner, inventory facts in Inventory owner, and returns inventory/manual sale-state as separate facts.
- `getOperationsStoreBusinessChannels?usage=SALES_MENU&cursor&pageSize` is a real required modification: current controller/API/service lack usage/cursor/pageSize on store channel list. The design identifies this and routes it through a new owner read API rather than pretending current code already supports it.
- The current browser L2 runner is catalog-specific, but the design explicitly treats sales-menu L2 as a generated-suite extension of the single runner and does not claim current runner already supports sales-menu.
- `scripts/generate/edge-codegen.mjs` still has `canonicalOperationCount = 180`; the design explicitly identifies the generated count as an owning-source fix, not as a generated-file hand edit.
- Full recall did not add a new confirmed finding beyond the existing 2M/1S.

## L2_USER_VISIBLE

L2_USER_VISIBLE=UNVERIFIED_STATIC_ONLY

User-visible design facts covered statically:

- 单页门店销售菜单入口。
- 门店-only 菜单；品牌/总公司不拥有菜单。
- 经营入口只支持 STORE + INTERNAL + DINE_IN/TAKEAWAY。
- 同一入口可启用多份菜单；菜单域不替渠道判断“此刻哪份”。
- 草稿/前台菜单分离；发布文案不声称终端已获取。
- 库存驱动与人工估清两个维度分开返回，不合并成一个 boolean。
- 草稿列表和操作记录使用 cursor/20 条顺序分页，不前端抽干假分页。
- 图片覆盖复用商品图片上传/排序交互。
- 删除、复制、启停、改名、归档的 UI copy/行为在 IA 中有静态落点.

L2 user-visible facts not dynamically verified:

- 真实浏览器中焦点是否回到触发按钮。
- 抽屉/弹窗/行末菜单在 Ant Design preserved DOM 下是否只命中 visible instance。
- 20+1 cursor 翻页是否真实无重无漏。
- 发布阻断、成功文案、人工估清/恢复文案是否在真实 UI 中逐字呈现。
- 图片上传失败重试/删除是否保留失败卡片。
- 管理菜单复制后是否真实选中新副本且默认停用。

## L3_UNVERIFIED

L3_UNVERIFIED=NON_EMPTY

Unverified groups:

1. Browser L2: all sales-menu UI flows are static design only; no L2 was run.
2. Backend acceptance: proposed 13 sales-menu scenarios plus business-channel/asset scenarios are design only; no Testcontainers/backend-acceptance was run.
3. Seed: sales-menu complete DEV seed is design only; current seed source was sampled and shows contradictory prerequisite facts.
4. Runtime lifecycle: managed DEV/L2/seed lifecycle standards were read, but no managed lifecycle proof was produced.

Because REVIEW_TARGET=DESIGN and dynamic execution was prohibited, these are not failures by themselves; they define the evidence boundary.

## ACTION_1_VARIANT=1-B extraction

### Template-section extraction

The canonical implementation template requires these relevant design sections:

- §1 business goal and at least three方案比较.
- §3 cross-cutting mechanism table with exact existing capability/spec path, verification observation, fallback shape, and complete in-batch set.
- §5 operation/path/face/collection shape and expected growth driver.
- §7 declaration-transfer-consumption matrix including mechanism rows.
- §9 owner API and consumers.
- §9a full-chain synchronization denominator for every changed business fact.
- §10b seed data for both new functionality and old-function adjustments.
- §11 acceptance scenarios with fixture/request/businessOracle.
- §12 unresolved items.
- §13 stop conditions.
- §13b staged and whole-batch three-dimensional reconciliation.

Design coverage judged from static reading:

- Mostly present: business goal/solution comparison, operation table, owner APIs, generated chain, backend acceptance, browser L2, seed, stop conditions.
- Still unsafe: seed §10b overstates an existing prerequisite; seed parent positional coupling is not explicitly retired.
- Input drift: original required template path was wrong; canonical path is now used in this artifact.

### Recall extraction

The recall originals add or confirm these review criteria:

- Business corpus G-11/G-12: menu is a sales collection, catalog/inventory facts are not copied, inventory and sale-state control remain separate.
- Business corpus G-08: disabled store blocks new menu publish; current design covers this with publish blockers.
- Owner lifecycle standard: cascade status must be separate facts, disabled entities remain editable, and consumer-computable presentation stays in frontend. Current design matches these at static level.
- Collection-boundary practice: cursor must be real and over-page fixtures are required. Current design recognizes business-channel cursor work and 20+1 tests; no new finding.
- Evidence/runtime kernel: no dynamic PASS can be claimed without managed execution. Current artifact keeps all dynamic evidence unverified.
- Independent review memory: absence of source reading invalidates a round; after this continuation, all 19 recall project-memory originals are READ_FULL.

### Cross-document contradiction extraction

- Requirements and IA require INTERNAL DINE_IN/TAKEAWAY sales-menu channels.
- Implementation design §10b.1 says existing `external-collaboration-business-channel-seed-plan.mjs` already has STORE INTERNAL DINE_IN/TAKEAWAY declarations.
- Actual seed source has TAKEAWAY templates/channels as EXTERNAL and only DINE_IN templates as INTERNAL.
- Therefore the seed prerequisite portion contradicts owning source.

### Undecided or bounded facts extracted

- Inventory UNKNOWN seam remains design-recognized as unresolved/test-seam dependent; no finding because design stops at source-based seam and does not claim PASS.
- Empty menu publication is allowed by current design because requirements do not block it; no finding because this is explicitly listed as unresolved/risk.
- Business-channel usage cursor is a required source change; no finding because design routes it through owner API and acceptance scenario.
- L2 generated suite source is proposed; no finding because current runner limitation is acknowledged as an implementation change.

## Findings

### F-M-001 — Input path drift prevents a mechanically honest minimum-input checklist unless corrected

severity=M  
classification=CONFIRMED  
owning source:

- user-specified required path: `doc/plans/platform/implementation-design-template.md`
- actual canonical path: `doc/decisions/templates/implementation-design-template.md`
- review skill source: `.agents/skills/cs-review/SKILL.md`
- canonical template source: `doc/decisions/templates/implementation-design-template.md`

Evidence:

- `doc/plans/platform/implementation-design-template.md` does not exist.
- `doc/decisions/templates/implementation-design-template.md` exists and has SHA-256 `7b1b2da048c7761540e58666986382476bc50273e9964f871c21f13f2293ac03`.
- `.agents/skills/cs-review/SKILL.md` directs design review criteria to `doc/decisions/templates/`.

Falsifiable failure condition:

- If a main agent transcribes checklist using the originally supplied `doc/plans/platform/implementation-design-template.md` and marks it read, the checklist contains a false input-read claim.
- If an executor later follows that wrong path as canonical, design-template criteria are not recoverable from the declared input path.

Minimum fix:

- In the Round 1 checklist/review packet, record the original path as `MISSING/NOT_READ_FILE_DOES_NOT_EXIST`.
- Use `doc/decisions/templates/implementation-design-template.md` as the canonical template input with the hash above.
- Do not claim the missing path was read.

Why smaller alternative is insufficient:

- Silently substituting the canonical template without recording the missing requested path hides the drift and makes the checklist non-reproducible.
- Marking the missing path as read is false.
- Dropping template review entirely would violate cs-review DESIGN 1-B criteria.

Same-root scan:

- Checked `doc/decisions/templates/`: `ia-design-template.md`, `implementation-design-template.md`, `journey-decision-template.md`, `ui-interaction-design-template.md`.
- Checked requested `doc/plans/platform/implementation-design-template.md`: missing.
- No repository write performed.

### F-M-002 — Sales-menu seed prerequisite claims existing INTERNAL TAKEAWAY facts that the owning seed plan does not contain

severity=M  
classification=CONFIRMED  
owning source:

- design claim: `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md` §10b.1
- seed plan: `scripts/dev/external-collaboration-business-channel-seed-plan.mjs`
- seed executor: `scripts/dev/external-collaboration-business-channel-seed-executor.mjs`
- sales-menu requirement: `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md` §3.3/§4.3
- business corpus: `project-memory/decisions/confirmed-business-language-corpus.md` G-11/G-12
- owner kernel: `project-memory/kernel/02-service-shape-and-owner.md`

Evidence:

- Design states `scripts/dev/external-collaboration-business-channel-seed-plan.mjs` has existing STORE INTERNAL DINE_IN/TAKEAWAY declarations.
- Actual seed plan shows:
  - `TEMPLATE-STORE-TAKEAWAY-A/B` are `orderKind: "TAKEAWAY", accessKind: "EXTERNAL"`.
  - `CHANNEL-STORE-TAKEAWAY-MEITUAN/ELEME` are `orderKind: "TAKEAWAY", accessKind: "EXTERNAL"`.
  - `TEMPLATE-STORE-DINE-IN-POS/QR/KIOSK` are `orderKind: "DINE_IN", accessKind: "INTERNAL"`.
- Seed validation requires expected TAKEAWAY channels/templates to be EXTERNAL.
- Current executor is static-only and not a runtime seed proof.
- Full recall reinforces that menu/channel facts must remain in their owner and not be inferred from adjacent platform details or conversation.

Falsifiable failure condition:

- Implement the design by only “preserving” the existing business-channel seed facts and then add sales-menu seed depending on INTERNAL TAKEAWAY. The sales-menu seed cannot find a real INTERNAL TAKEAWAY channel, or it must create menu facts against an EXTERNAL takeaway channel, violating requirements.
- A backend-acceptance or seed readback expecting STORE + INTERNAL + TAKEAWAY eligible channel would fail or silently use the wrong channel category.

Minimum fix:

- Revise §10b.1 to say the existing seed plan has INTERNAL DINE_IN templates but not INTERNAL TAKEAWAY channels/templates.
- Add explicit business-channel seed design for required INTERNAL TAKEAWAY facts, including enabled/disabled/project-negative facts if needed by sales-menu.
- Keep these facts in the business-channel owner seed plan/executor, not in the sales-menu seed plan.
- Add static red tests/readback assertions proving TAKEAWAY INTERNAL and EXTERNAL are distinct and that sales-menu only consumes INTERNAL.

Why smaller alternative is insufficient:

- Merely changing sales-menu seed to ignore TAKEAWAY would violate requirements.
- Reusing EXTERNAL TAKEAWAY channels would confuse “menu maintained by system” with external platform correspondence.
- Adding menu-side workaround/fallback channel facts would violate owner sovereignty and duplicate business-channel facts.
- Deferring to manual DEV setup would make seed non-reproducible.

Same-root scan:

- Scanned templates, channels, and validation sections in `scripts/dev/external-collaboration-business-channel-seed-plan.mjs`.
- Scanned design §10b seed table and sales-menu eligibility rows.
- Scanned seed executor static-only boundary.
- Remaining relevant seed sources checked: `scripts/dev/profiles/r5-full.json`, `scripts/dev/r5-complete-seed-executor.mjs`, `scripts/dev/external-collaboration-business-channel-seed-executor.mjs`.
- Rechecked recall originals for owner sovereignty, business corpus G-11/G-12, platform detail reverse-inference, and evidence/runtime boundary.

### F-S-001 — Complete seed parent has a positional catalog-stage assumption not explicitly retired by the four-stage design

severity=S  
classification=CONFIRMED  
owning source:

- design seed table: `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md` §10b.1
- complete seed parent: `scripts/dev/r5-complete-seed-executor.mjs`
- r5-full profile: `scripts/dev/profiles/r5-full.json`
- evidence/runtime kernel: `project-memory/kernel/05-evidence-runtime-and-git.md`
- implementation template: `doc/decisions/templates/implementation-design-template.md` §10b

Evidence:

- Current `COMPLETE_SEED_STAGE_IDS` is `["owner-command", "catalog-inventory"]`.
- Current validation checks exact stage order and denominator length.
- Current validation then reads `const catalog = stages[1]` and assumes catalog evidence is always index 1.
- Design says change exact order to `owner-command → external-collaboration-business-channel → catalog-inventory → sales-menu`, and says tests should cover four-stage order/denominator/readback, but it does not explicitly name the `stages[1]` positional catalog coupling.

Falsifiable failure condition:

- Executor changes only `COMPLETE_SEED_STAGE_IDS` and child invocation order to four stages. Then `stages[1]` becomes `external-collaboration-business-channel`, so catalog denominator/readback validation is applied to the wrong stage.
- Depending on report shape, this fails with misleading catalog errors or, worse, weakens catalog readback coverage.

Minimum fix:

- Amend seed parent design to require lookup by stable stage id, e.g. find stage where `id === "catalog-inventory"` before catalog-specific readback.
- Add red tests for four-stage order, missing `catalog-inventory`, swapped external/cat stages, and wrong report shape under a correct stage count.
- Keep stage-specific validators separate: owner-command, external-collaboration-business-channel, catalog-inventory, sales-menu.

Why smaller alternative is insufficient:

- Updating only the stage array proves count/order but not stage-specific validator binding.
- Relying on current `stages[1]` after inserting a new second stage is brittle and directly contradicts the proposed four-stage order.
- Removing catalog readback validation would weaken existing seed correctness.

Same-root scan:

- Checked `COMPLETE_SEED_STAGE_IDS`, stage order validation, report/manifest validation, and catalog-specific readback in `scripts/dev/r5-complete-seed-executor.mjs`.
- Checked `scripts/dev/profiles/r5-full.json` current two-component profile.
- Checked design §10b.1 seed table rows for profile, parent executor, parent tests, business-channel seed plan/executor, catalog-inventory seed, and sales-menu profile.
- Rechecked recall originals for seed/runtime evidence separation and implementation template §10b old+new seed adjustment requirements.

## SAME_ROOT_SCAN

sameRootScanStatus=COMPLETED_FOR_CONFIRMED_FINDINGS_STATIC_ONLY

| finding | scanned same-root set | result |
| --- | --- | --- |
| F-M-001 | requested template path; canonical `doc/decisions/templates/`; cs-review criteria path | original path missing; canonical template exists and was read |
| F-M-002 | business-channel seed plan templates/channels/validation; design §10b; seed executor static boundary; r5 profile; business corpus and owner-sovereignty memory | only DINE_IN is INTERNAL; TAKEAWAY is EXTERNAL; design claim overstates source |
| F-S-001 | complete seed stage id list; parent validation; r5-full profile; sales-menu seed design rows; implementation template seed requirements | four-stage design must retire index-based catalog assumption |

## DESIGN_GAPS

DESIGN_GAPS=NON_EMPTY

1. Seed prerequisite gap: design must distinguish existing INTERNAL DINE_IN from missing INTERNAL TAKEAWAY business-channel seed facts.
2. Seed parent gap: design must explicitly replace positional stage indexing with stage-id lookup/validator binding.
3. Input packet gap: review/design packet must use canonical template path and preserve the missing original path as a recorded drift.

## Static checks by required dimension

| dimension | static review result |
| --- | --- |
| behavior | PARTIAL_NO-GO: main menu behavior is declared; seed prerequisite would fail INTERNAL TAKEAWAY behavior |
| shape/form | MOSTLY_OK_STATIC: page/drawer/list/card/table shapes declared; dynamic rendering unverified |
| actions | PARTIAL_OK_STATIC: publish/copy/enable/manual sold-out actions declared; seed prerequisite action data incomplete |
| relationships | NO-GO: business-channel seed relation for INTERNAL TAKEAWAY missing in current source |
| placement | OK_STATIC: single page and Drawer placements declared |
| user-visible copy | OK_STATIC_FOR_DESIGN: publish copy and terminal-not-acquired caveat declared; browser unverified |
| limits | OK_STATIC: cursor/20 rows declared; no dynamic proof |
| state/control | PARTIAL_NO-GO: draft/published/inventory/manual dimensions declared; seed state coverage incomplete |
| failure/recovery | PARTIAL_OK_STATIC: typed problems and failure visibility declared; runtime proof absent |
| accessibility/focus | OK_STATIC_DESIGN_ONLY: requirements exist; L2 unverified |
| data source/invalidation | PARTIAL_OK_STATIC: owner/API/RTK invalidation declared; source changes unimplemented |
| owner sovereignty | PARTIAL_NO-GO: owner sovereignty is the design intent, but seed prerequisite must stay in business-channel owner and not be overstated |
| contract generated unique source | OK_STATIC: generated chain and operation count owner identified |
| transaction/idempotency/CAS/audit/log | OK_STATIC_DESIGN_ONLY: design declares mechanisms; no implementation proof |
| publication freeze | OK_STATIC_DESIGN_ONLY: declared |
| multi-menu | OK_STATIC_DESIGN_ONLY: declared |
| copy exclusions | OK_STATIC_DESIGN_ONLY: declared |
| inventory/manual status | OK_STATIC_DESIGN_ONLY: declared |
| shape/SKU price | OK_STATIC_DESIGN_ONLY: declared |
| cursor | OK_STATIC_DESIGN_ONLY: declared; current business-channel store route must be changed |
| frontend constraints | OK_STATIC_DESIGN_ONLY: foundation and RTK constraints declared |
| backend-acceptance owner placement | OK_STATIC_DESIGN_ONLY: scenario owners declared |
| L2 unique source/managed lifecycle | OK_STATIC_DESIGN_ONLY: blueprint/generator/single runner declared; no L2 run |
| Seed old+new and parent orchestration | NO-GO: old business-channel facts overstated; parent positional coupling under-specified |
| dynamic evidence boundary | OK_STATIC: design does not claim unrun dynamics as PASS |

## Verification notes

- No Git command was run.
- No files were written.
- No Testcontainers/backend-acceptance was run.
- No browser L2 was run.
- No DEV start/stop/reset/seed was run.
- No UAT or deployment was run.
- Author reconciliation was not read.
- Author intake was not read.
- The specified six-dimensional recall command was run.
- Every project-memory original returned by that recall command was read to completion.
- Full recall did not change the verdict or M/S/N counts.

## Author material delta

authorMaterialReadAfterIndependentVerdict=false

No author-material comparison was performed. Per current instruction, this Round 1 artifact remains blind and does not append “与作者材料差异”.
