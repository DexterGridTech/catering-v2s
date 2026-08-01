---
title: RM1 P6-3 IA04 independent implementation review round 1 (Codex)
packageId: RM1P6-U03
reviewTarget: IMPLEMENTATION
reviewCycleId: RM1-P6-U03-IA04-IMPLEMENTATION-20260731
reviewRound: 1
reviewRoundLimit: 2
reviewerKind: INDEPENDENT_SUBAGENT
verdict: NO-GO
severitySummary: "M=2, S=4, N=3"
---

# RM1 P6-3 IA04 independent implementation review — Round 1

```text
REVIEW_CYCLE_ID=RM1-P6-U03-IA04-IMPLEMENTATION-20260731
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=embedded below; input hashes are recorded below
blindReviewDeclaration=Fresh v2s-rooted reviewer first tried to falsify current production code and formed this verdict before reading any author self-review or finding disposition.
authorMaterialReadAfterIndependentVerdict=false
SCOPE=OperationsApp catalog-key refactor; IA04 store, contract and store-profile four-state production UI; directly related owner/edge/OpenAPI/generated chain only.
STATIC_BOUNDARY=No DEV, seed, reset, dynamic runtime, business claim or L2 was performed. Static source/contract review is not business or L2 evidence.
```

## 用户任务

业务用户要在运营管理后台按当前任职和可见范围维护门店、合同和受控扩展资料；门店角色只读核对本门店合同四态。用户任务来自 IA04，而非现有接口或历史页面。

## Dexter 立场

Dexter 已授权 U03 实施，但要求 owner-first、catalog-key 一致、逐物理屏 IA 对读，以及静态证据绝不冒充业务/L2/cleanup 结论。

## 替代方案

替代方案是继续沿用单项货号、浏览器候选过滤或用一个泛化页面掩盖缺口；不选，因为它们违反已接受 IA 的多货号、owner 搜索和独立 screen 路径。最小取舍是完成既有 Drawer 与 focused proof，不引入新平台。

## 方案合理性

问题是当前物理屏遗漏批准控件，不是 owner/edge 架构错误。catalog-key 和 owner-owned 四态方案的复杂度与收益匹配；代价应限于已批准 UI、adapter proof 和 IA 纠偏，不能用新 endpoint/通用表单层过度设计。

## UI 与交互

APPLICABLE：门店、合同、门店资料和总公司品牌授权都来自批准 Journey。用户操作路径应是列表业务标识→详情→关闭后 Drawer/Modal；四态只读合同不应出现写入口或操作列。接口不能使本地日期、client 过滤、单项货号或缺少选中项目展示成为合理替代；本轮未发现需要 Dexter 裁决的产品歧义。

## 审查意见复核

所有本轮 finding 均为 **CONFIRMED** 或 **REJECTED_WITH_EVIDENCE**：逐项重开 IA、physical contract、源码、owner/edge/OpenAPI/generated evidence，并检查反例和适用边界。M-001/M-002 的反例是当前实际 Drawer；S-001 的反例是 raw Problem detail；S-002/S-003 的适用边界分别是现有 owner candidate API 和 approved generated-client adapter；S-004 的反例是正确四态生产链。每项建议都比较了更小修复，拒绝新 UI platform 或协议扩张的过度设计。

## 实施代码核验

已逐点重开当前生产源码和代码调用链，包括 OperationsApp/catalog registry、Store/Contract/Profile physical consumer、generated client/RTK、OpenAPI、edge 与 contract owner。没有运行编译、测试或动态环境：本任务授权的是静态独立审查，故不存在可宣称的运行 evidence。仍以业务用户行为和批准 Journey 对照静态实现；该限制不改变代码缺口的判断。

## 闭环核验

owner、contract 与静态 evidence 已核验到 finding 所列边界；package exit、incremental receipt set equality、business、L2 和 cleanup 均未关闭，且 final alignment 仍为 `PENDING`。因此不具备闭环 acceptance。

## 结论

VERDICT=NO_GO

**NO-GO (2 M / 4 S / 3 N).** The catalog-key refactor and the fixed-store four-state owner chain are materially present, but the current IA04 create/edit surfaces do not implement the accepted controls. The recorded control-level alignment also remains explicitly `PENDING` for store, contract and store-profile, so it cannot be used as an admission or L2 substitute.

## Findings

### M-001 — Store create/edit omit the accepted definition-driven fields and control/error contract

**Status: CONFIRMED.**

IA04 requires both `IA04-STORE-CREATE` and `IA04-STORE-EDIT` to read the enabled extension definition, render its ordered controls with required/type rules, retain safe failure behavior, and expose stable test identifiers. The two current drawers only query store candidates. They do not read the store extension definition, render no `extensionValues` controls, and `StoreCreateDrawer` has no local failure handling or stable `testId` bindings. It can therefore submit `{}` while presenting neither the required controlled fields nor a usable user-visible request failure.

- Owning accepted sources: `doc/decisions/2026-07-29-v2s-rm1-ia-04-operations-organization-and-contract-interaction.md` §9 `IA04-STORE-CREATE` / `IA04-STORE-EDIT`; `doc/evidence/platform/rm1/p6/rm1-u09-physical-screen-import-contracts.md` rows 71–73; `rm1-u09-final-ui-surface-roster.md` OPERATIONS-STORES row.
- Current evidence: `apps/frontend/operations-admin/src/features/store-management/ui/StoreCreateDrawer.tsx:1-10` imports no definition/read hook and its one-line body renders only fixed fields; `StoreEditDrawer.tsx:1-10` has the same omission. The baseline itself places both paths in the IA denominator (`rm1p6-u03-ui-ia-implementation-baseline.json:923,937`).
- User impact: operators cannot supply required controlled fields when creating/updating a Store; validation/a11y automation cannot target the physical controls reliably.
- Minimal repair direction: reuse the established contract/busines-entity definition read and field renderer shape for the Store owner definition, preserve owner validation, add safe query/mutation failure UI and focused control-level tests. Do not infer extension values in the browser or add a new generic form framework.

### M-002 — Contract create/edit collapse the mandated `items[]` detail into one item

**Status: CONFIRMED.**

The accepted IA explicitly requires a `Form.List` of `{code,name}` rows, at least one item, add/remove actions, and uniqueness of code within the contract. The current create and edit drawers each define only singular `itemCode`/`itemName` fields and always send an array containing exactly one item. Editing also initializes only `contract.items[0]`. This drops existing additional item details and prevents the approved multi-item contract task.

- Owning accepted sources: IA04 §10 `IA04-CONTRACT-CREATE` and `IA04-CONTRACT-EDIT`, especially their `合同商品明细` control tables; IA04 §12.3; `rm1-u09-create-edit-form-remediation-design.md` M2; `rm1-u09-final-ui-surface-roster.md` OPERATIONS-CONTRACTS row.
- Current evidence: `apps/frontend/operations-admin/src/features/contract-management/ui/ContractCreateDrawer.tsx:9,36,52-53`; `ContractEditDrawer.tsx:9,28,33,48-49`. The contract owner wire accepts `items[]`; this is a consumer loss, not a backend limitation.
- User impact: a valid multi-code Store lease cannot be created or safely edited from the approved operations screen; saving an existing multi-item contract would overwrite it with its first item.
- Minimal repair direction: use Ant Design `Form.List` within the existing Drawer lifecycle, enforce nonempty/unique codes before submit, bind the full current `contract.items`, and submit the resulting array unchanged in shape. No contract command or owner change is needed for this finding.

### S-001 — Store status failure leaks raw Problem detail into the user surface

**Status: CONFIRMED.**

IA04 and the P6 plan require safe fixed UI failure copy and prohibit exposing raw Problem detail. `StoreStatusModal.issue` concatenates `errorCode` and `error.problem.detail`, then displays it in an Alert and also sends it to the parent. This is both an information-boundary violation and inconsistent with the safe fixed copy used by contract invalidation.

- Owning accepted sources: IA04 §4; `rm1-u09-implementation-facing-design-and-three-phase-plan.md` §1 common prohibitions; `project-memory/operations/phase-retrospective-and-systemic-repair.md` “Generated contract semantics”.
- Current evidence: `apps/frontend/operations-admin/src/features/store-management/ui/StoreStatusModal.tsx:9,13,16`.
- Minimal repair direction: retain diagnostic operation handling but render a fixed safe error such as “门店状态操作未完成，请重试。”; do not surface raw Problem code/detail or substitute a browser-derived explanation.

### S-002 — Contract creation does not implement its owner-searchable store control or explicit project fact

**Status: CONFIRMED.**

The accepted contract-create Drawer has an explicit read-only selected project and a server-searchable Store candidate selection. Current code obtains `projectId` directly from `queryContext.scopeRef`, renders no project fact, and the `Select` has neither `filterOption={false}` nor an `onSearch` route to `storeSearch`; its request always has no search term and only requests the first 100 rows. This is not equivalent to the accepted search control and makes the selected business project invisible at the point of commitment.

- Owning accepted sources: IA04 §10 `IA04-CONTRACT-CREATE` control table; IA04 §11 `IA04-CONTRACT-CREATE`; `rm1-u09-physical-screen-import-contracts.md` rows 74–76.
- Current evidence: `apps/frontend/operations-admin/src/features/contract-management/ui/ContractCreateDrawer.tsx:23-28,45-48`; compare the existing page-level generated candidate search wiring in `ContractManagementPage.tsx:33,48-52,65`.
- Boundary/alternative considered: using current data scope is acceptable only as the owner-rechecked task input. It does not remove the IA-required read-only selected-project control, nor does it turn a local first-page filter into server search.
- Minimal repair direction: keep the same generated candidates operation, display its owner-returned project readback as read-only, and bind the drawer Store Select’s search input to the existing owner `storeSearch` query/pagination. Do not add a client-side full-list filter or a second project source.

## Verified current behavior (not findings)

### S-003 — Head-company brand candidate search has no focused consumer proof

**Status: CONFIRMED.**

The P6-3 head-company brand Drawer performs a paged owner candidate read through the approved generated-client adapter. Its existing focused adapter proof exercises add/remove/readback and unknown replay, but does not exercise the candidate search itself: name/page/pageSize/enabled predicate, candidate-load failure and stale-response behavior have no focused adapter or Drawer proof. Owner/edge tests and static boundary checks cannot establish that this user-facing candidate control is wired correctly.

- Owning accepted sources: `rm1-u09-implementation-facing-design-and-three-phase-plan.md` §5 “Total-company brand authorization corrective slice”; `2026-07-30-v2s-rm1-p6-3-head-company-brand-authorization-corrective-design.md` §5.2; IA04 `IA04-HEAD-COMPANY-BRANDS`.
- Current evidence: `apps/frontend/operations-admin/src/features/business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx:47-74`; `HeadCompanyBrandAuthorizationActionAdapter.test.ts:33-71` covers commands/readback but not `searchEnabledBrands` input or failure cases.
- Boundary/alternative considered: the corrective design deliberately uses the generated transport client in this adapter and forbids importing `operationsRtk`; direct generated-client use is therefore **not** the finding. The missing focused proof is.
- Minimal repair direction: add a narrow adapter/search test plus Drawer focused test covering the paged owner query, enabled-only result handling, error copy and stale response; do not replace the approved adapter with a new RTK layer.

### S-004 — IA04 still carries superseded three-state wording alongside the accepted four-state contract

**Status: CONFIRMED.**

The same IA04 document says “合同三态” and displays only current/history/invalid in its summary/roster language, while its precise `IA04-STORE-PROFILE-CONTRACT` screen sheet and the newer accepted P6 detail require current/pending-effective/history/invalid. The current implementation correctly follows the four-state authority, but leaving the conflicting higher-level IA wording frozen invites a later regression back to three tabs.

- Owning sources: IA04 `:12,65,118,151,695` versus precise sheet `:677-685`; `rm1-u09-implementation-facing-design-and-three-phase-plan.md:107-115` records Dexter’s 2026-07-31 four-state ruling.
- Current production counterexample: `StoreProfilePage.tsx:15-19,39-55,81-110`, OpenAPI and contract owner all implement four states.
- Minimal repair direction: make a bounded IA supersession/correction record that explicitly overrides the stale three-state references. Do not change the correct owner/edge/OpenAPI/UI chain to satisfy an obsolete summary.

### N-001 — Catalog-key refactor is aligned on the inspected path

**Status: REJECTED_WITH_EVIDENCE (no defect found).** `OperationsApp.tsx:21-40,56-65` resolves labels and accessible pages from `adminCatalog`/generated `OperationsPageDesignKey`; `pageRegistry.tsx:37-54` holds each approved page’s explicit route and component. Store, contract and store-profile remain distinct components. This does not prove runtime authorization, but the inspected source has no static return to local page-title lookup or generic “operations feature” replacement.

### N-002 — Store-profile four-state semantics are owner-owned and correctly typed on the inspected chain

**Status: REJECTED_WITH_EVIDENCE (no defect found).** `StoreProfilePage.tsx:15-19,39-55,82-110` presents current/pending/history/invalid tabs, resets the page on a state change, uses generated `StoreContractViewState`, and opens a read-only detail Drawer. OpenAPI exposes the required typed state only to `operations-admin` (`contracts/openapi/paths/operations-admin/store-profile.paths.yaml:88-163`); generated API preserves it in its request type/cache argument. Edge only forwards it (`OperationsStoreProfileController.java:48-50`). Contract owner applies the same predicate values to count and page (`ContractTaskReadService.java:96-106,226-235`), and `BusinessDateProvider.java:10-14` fixes `Asia/Shanghai`. No browser date, client slice, write action or action column was found.

### N-003 — Static evidence boundary remains open, not falsely accepted

**Status: CONFIRMED.** `rm1p6-u03-final-ui-ia-control-alignment.json:5,723` says `PENDING`, names Store/Contract/Store Profile as remaining physical control rows, and explicitly says no UI L2 is authorized. This review likewise makes no L2/business/cleanup claim. This is a release condition for the current scope, not a substitute for the concrete findings above.

## Input / readback record

| Required input | Path / command | Hash or result | Read result |
| --- | --- | --- | --- |
| Entry | `AGENTS.md`; `PLATFORM-BLUEPRINT.md`; `CLAUDE.md` | `82564a…b49a5`; Blueprint read; `8b12b3…aec50f` | READ_FULL |
| Program and current state | Registry → `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | `d2490f…eb73`; `CURRENT_STEP=RM1-P6-3` | READ_CURRENT |
| Exact authorization | `rm1p6-u03-package-input.json`; `rm1p6-u03-implementation-amendment.md` | `5ee672…2ddc`; amendment read | READ_FULL |
| All memory kernel | `project-memory/kernel/01…06` | `f8add1…bd63`, `45a260…c032`, `f01d8e…c44`, `1f6d9e…fa88`, `d0d75e…65a05`, `5c52b1…5566` | READ_ALL |
| Six-dimension recall | `scripts/context/recall-memory --task-kind review --domain admin-ui --consumer-face operations-admin --owner frontend-platform --impact evidence --trigger review` | deterministic route completed; every returned memory opened | RUN / READ_ALL |
| Routed memory | verification governance, corpus/read policy, phase repair, parked intake, incremental hook, reread discipline | hashes recorded by current files; source refs reopened as applicable | READ_ALL |
| Corpus | G-03/G-04/G-06/G-08/G-09 terms: Store, tenant, head company, brand, contract | `confirmed-business-language-corpus.md` | READ_G03_G04_G06_G08_G09 |
| IA / design / physical / roster / baseline / alignment | IA04; P6 plan; final roster; physical contract; U03 baseline; final alignment | `1cdc80…49a5`; `8dfa1b…da2a`; `6d728e…b089`; `7687ed…17a7`; `a504ab…feca`; `49280f…3fd` | READ_FULL_RELEVANT_SECTIONS |
| Reviewed production and contract chain | OperationsApp, pageRegistry, Store/Contract/Profile UI, generated operations API/RTK, OpenAPI, owner and edge sources named in findings | direct source read | READ_POINTWISE |
| Standards | `contracts/policy/standards-coverage-matrix.json`; `scripts/check/standards-coverage --phase R5` | `7f5947…ca70`; `STANDARDS_COVERAGE=PASS` | READ / FRESH_STATIC |
| All decisions title review | `find doc/decisions -maxdepth 1 -type f -name '*.md' -print | sort` | listing hash `d3ff83…82a82`; relevant IA04 and review-governance decisions read | TITLES_REVIEWED |

The P6-3 active package has no completed package exit. Therefore this review does **not** infer package-exit receipt equality, dynamic business success, L2, or cleanup PASS from any static source or previous artifact.

## Authority boundary

This is a fresh independent static implementation verdict for the stated U03 slice only. It authorizes no source change, Roadmap transition, DEV, seed, reset, L2, business acceptance, cleanup acceptance or expansion. Findings are inputs for the implementation owner’s evidence-backed disposition; product/Journey changes remain Dexter decisions.
