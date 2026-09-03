# Sales Menu UI/testId Preflight Implementation Review — Cycle C Round 2

## Cycle metadata

REVIEW_CYCLE_ID=UI_TESTID_PREFLIGHT_20260903C  
REVIEW_ROUND=2  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
REVIEW_TARGET=IMPLEMENTATION  
ACTION_1_VARIANT=1-A 代码提取  
ROUND_FINAL_DECISION=SELF_DECIDED

Fresh verifier stance: I reopened current repository bytes and current installed dependencies for this review. I did not treat any older 16-case/220-control report as current source truth. I did not modify production code, contracts, generated files, tests, templates, Git state, DEV, reset, seed, UAT, or browser L2 runtime. The only write in this turn is this independent report.

## Verdict block

REVIEW_TARGET=IMPLEMENTATION  
ACTION_1_VARIANT=1-A 代码提取  
VERDICT=GO_WITH_UNVERIFIED_UI  
M/S/N=0/0/1  
L1_ENGINEERING=PASS — current static source, generated policy files, focused tests, typecheck, and generator self-test support L2 script admission for the UI/testId preflight boundary.  
L2_USER_VISIBLE=UNVERIFIED — no DEV, UAT, dynamic browser L2, or real browser run was authorized or executed; static/focused proof is not promoted to user-visible L2 proof.  
L3_UNVERIFIED=dynamic browser rendering, real click/fill/upload/press behavior, AntD portal behavior under Chromium, focus restoration, HTTP owner readback, business oracle, and cleanup evidence.  
SAME_ROOT_SCAN=PASS_WITH_BOUNDARY — current sales-menu source, shared role-home scope helper, foundation image editor, installed AntD upload chain, operations L2 helper, and sibling catalog/platform patterns were scanned; raw locators found are helper-internal AntD portal/native-input probes, not replacement selectors for missing sales-menu testIds.  
DESIGN_GAPS=N-01 — implementation plan §10.0 records the current 18-case denominator, but §14.4 still contains a stale “16 L2 cases” closure bullet. This is documentation drift, not a current implementation/testId blocker, because generated source and self-test are 18.  
EVIDENCE_TIER=STATIC_SOURCE + FOCUSED_UNIT + GENERATOR_SELF_TEST + TYPECHECK; no dynamic L2/runtime tier.

Round-final decision: SELF_DECIDED. There is no confirmed M/S blocker for the UI/testId preflight implementation boundary. The correct admission verdict is not full GO, because repository standards require dynamic browser L2 for user-visible behavior and that tier was explicitly out of scope.

## Inputs reopened

- `AGENTS.md`, `PLATFORM-BLUEPRINT.md`, `doc/platform/README.md`, `scripts/README.md`.
- Roadmap registry and current roadmap only for authorization-shape context; the session request is the current task truth.
- `doc/platform/review-standard.md`.
- `doc/platform/browser-l2-execution-standard.md` §3.1, especially actual-control denominator, native input/file input, binding/touch, and raw-locator prohibitions.
- `doc/platform/frontend-coding-standard.md` §3-K-9; lines 547-548 explicitly keep true scrolling/focus/user behavior in authorized browser L2, while lines 552-570 define testId preflight fail conditions.
- `project-memory/operations/ui-testid-preflight-before-l2.md`.
- Sales-menu requirements, requirements analysis, IA, UI interaction design, implementation design, and implementation plan.
- Current source under `apps/frontend/operations-admin/src/features/sales-menu`, `apps/frontend/operations-admin/src/tests/l2`, `apps/frontend/operations-admin/src/features/role-home-bootstrap`, `libraries/frontend/admin-ui-foundation/src/presentation`, `node_modules/antd`, and `node_modules/@rc-component/upload`.

## Five review actions

### 1. 1-A 代码提取：current denominator and generated source truth

Current denominator is 16 scenarios / 18 cases, not the older 16-case or 220-control denominator.

Evidence:

- `contracts/policy/sales-menu-l2-case-blueprint.json:3-19` declares `kind=sales-menu-l2-case-blueprint`, revision `SALES_MENU_L2_P1_20260903`, fixture class `TEST`, setup channel `OWNER_HTTP_COMMANDS`, and `seedRuntimeInput=false`.
- `contracts/policy/sales-menu-l2-scenarios.json:17-20` declares `scenarioCount=16`, `caseCount=18`, and locator binding path.
- `contracts/policy/sales-menu-l2-locator-bindings.json:3-8` declares `bindingMode=CASE_PARAMETER_CONTROL_KEYS`, source of truth `apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts`, and `caseCount=18`.
- Static recount command over blueprint/scenarios/bindings/timing/fixture returned:
  - blueprint: `scenarioCount=16`, `caseCount=18`, `actualCaseCount=18`, `controlKeyCount=68`, `actionUseCount=18`, `operationCoverage=31`;
  - scenarios: `scenarioCount=16`, `caseCount=18`, `actualCaseCount=18`, `controlUseCount=240`, `uniqueControlUses=68`, `actionUseCount=18`, `operationCoverage=31`;
  - bindings: `caseCount=18`, `controlKeyCount=68`;
  - timing budget: `caseCount=18`;
  - fixture: `fixtureClass=TEST`, `setupChannel=OWNER_HTTP_COMMANDS`, `seedRuntimeInput=false`.
- `node scripts/generate/sales-menu-p1.mjs --self-test` returned `SALES_MENU_P1_SELF_TEST=PASS; CASES=18; OPERATIONS=31; FIXTURES={"fixtureClass":"TEST","setupChannel":"OWNER_HTTP_COMMANDS","seedRuntimeInput":false,...}`.

N-01 is a documentation drift only: `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md:453-458` records the current 18-case / 240-control-use / 68-control-key denominator, while `:582-584` still says “16 L2 cases” in a later implementation completion bullet. I treated generated source and generator self-test as the current implementation denominator.

### 2. Design-to-source reconciliation for actual controls and action nodes

Result: PASS for static preflight.

Key checks:

- Unique sales-menu testId source exists in `apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts:3-76`; dynamic controls derive IDs from stable business identities such as `menuRef`, `sectionRef`, `candidateRef`, `itemRef`, media identity, mode, status, and action.
- Public STORE scope uses the shared `roleHomeTestIds` source, not sales-menu-local strings:
  - `apps/frontend/operations-admin/src/features/role-home-bootstrap/roleHomeTestIds.ts:1-11` declares trigger/confirm and scope selectors.
  - `contracts/policy/sales-menu-l2-locator-bindings.json:10-18` binds `STORE_SCOPE` to `operations-data-scope-trigger` with `confirmTestId=operations-data-scope-confirm`.
  - `DataScopeSelector.tsx:300-305` places confirm testId on the real primary confirm `Button`; `:313-324` places trigger testId on the real trigger `Button`.
  - `operationsL2.ts:95-108` and `:135-141` record trigger and confirm touch when a selectable scope submission is actually performed.
- Sales-menu selector option is a stable business-identity anchor:
  - UI binds option label anchor with `salesMenuTestIds.menuOption(menu.salesMenuRef)` in `SalesMenuPage.tsx:2558-2566`.
  - L2 uses the same option id in `sales-menu.spec.ts:877-883` and records `ACTION_TOUCH` for `SALES_MENU_SELECTOR`.
- Candidate Checkbox node is explicitly bound by cloning AntD row-selection `originNode` with stable candidate identity in `SalesMenuPage.tsx:1365-1373`.
- Radio controls are directly marked on the real radio nodes:
  - media mode radios at `SalesMenuPage.tsx:584-598`;
  - status radios at `SalesMenuPage.tsx:2992-2997`.
- Upload action is routed through the shared foundation editor:
  - Sales menu passes `upload: salesMenuTestIds.itemMediaUpload` to `AdminImageCollectionEditor` in `SalesMenuPage.tsx:604-655`.
  - Foundation spreads that upload testId on AntD `Upload` at `AdminImageCollectionEditor.tsx:90-99`.
- L2 requires the native file input before upload and checks `type=file`, `accept=image/*`, and enabled state in `sales-menu.spec.ts:612-620`.
  - Every current `setInputFiles` use is followed by `ACTION_TOUCH` for `SALES_MENU_ITEM_MEDIA_UPLOAD`: `sales-menu.spec.ts:1320-1328`, `:1345-1353`, `:1627-1635`, and `:1639-1647`.
- Generic action helpers record action touch from locator metadata:
  - `recordControlTouch` emits `ACTION_TOUCH` for action interactions in `sales-menu.spec.ts:411-423`.
  - `recordActionForLocator` requires locator metadata and emits action touch in `sales-menu.spec.ts:425-437`.
  - `fillBoundControl`, `clickBoundControl`, and `checkBoundControl` act through a required bound control and then record action touch in `sales-menu.spec.ts:1014-1050`.

### 3. Same-root scan and sibling pattern check

Result: PASS_WITH_BOUNDARY.

Scans performed:

- Same-root scan of `salesMenuTestIds`, `roleHomeTestIds`, `selectOperationsDataScope`, `selectOperationsOption`, `candidateRow`, `itemMediaChoice`, `statusChoice`, `sectionMenuAction`, `managerAction`, and all `setInputFiles` call sites.
- Raw locator scan over `apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts`, `apps/frontend/operations-admin/src/features/sales-menu`, and `apps/frontend/operations-admin/src/tests/l2/operationsL2.ts`.
- Sibling scan over `apps/frontend/operations-admin/src/features/catalog-management`, `apps/frontend/platform-admin/src`, shared role-home scope, foundation presentation code, and catalog L2 spec.

Raw locator interpretation:

- `operationsL2.ts` has helper-internal AntD portal locators such as `.ant-select-dropdown` / `.ant-dropdown` and `getByRole('menuitem')`; these are used after a stable testId opens the component and are shared AntD portal handling, not a sales-menu-specific bypass for missing testIds.
- `sales-menu.spec.ts` uses `control.getByRole('textbox'|'spinbutton'|'radio'|'checkbox')` under an already-bound `getByTestId` control; this is an anchored native/semantic child probe, not a global role locator.
- No current sales-menu action was found using raw CSS/XPath/index/global text as the primary substitute for a missing `salesMenuTestIds` binding.

Sibling pattern interpretation:

- Catalog management consumes the same `AdminImageCollectionEditor` in `CatalogItemBasicEditor.tsx`, and catalog L2 uses the shared `selectOperationsOption` helper for AntD Select interactions. This supports reusing the shared foundation and helper pattern; it does not create a broader rule that wrappers are acceptable for native file input.
- Platform-admin has direct Upload uses in workspace drawers, but those are not the current sales-menu L2 preflight denominator and were not used to override the stricter browser-L2/file-input rule.

### 4. Round 1 M-03 recheck: AntD Upload wrapper vs native file input

Classification: REJECTED_WITH_EVIDENCE.

Round 1 concern restated: source appeared to spread testId onto an AntD `Upload` wrapper, so the id might not reach the native file input.

Current evidence rejects that concern for the installed dependency chain:

- Installed packages: `antd 6.5.0`, `@rc-component/upload 1.1.1`, `rc-upload NOT_FOUND`.
- `node_modules/antd/es/upload/Upload.js:6` imports `RcUpload` from `@rc-component/upload`; its props are passed through as `rcUploadProps` to `RcUpload`.
- `node_modules/@rc-component/upload/es/AjaxUploader.js:360-388` renders the native `<input type="file">` and spreads `pickAttrs(otherProps, {aria: true, data: true})` onto that input.
- `node_modules/@rc-component/util/es/pickAttrs.js:55-66` keeps `data-*` attributes when `data: true`.
- `AdminImageCollectionEditor.tsx:90-99` puts `data-testid` in the Upload props.
- `AdminImageCollectionEditor.test.tsx:52-55` focused static markup assertion proves `data-testid="image-upload"` appears on an `<input ... type="file">` for the current render path.
- The focused command `../../../node_modules/.bin/vitest run src/presentation/AdminImageCollectionEditor.test.tsx --maxWorkers=1` passed: 1 file, 2 tests.

Boundary: this rejects the static/native-input propagation concern for current installed source and focused static markup. It still does not prove actual Chromium upload behavior or browser-visible interaction; that remains L3_UNVERIFIED until authorized L2 runs.

### 5. Static/focused command evidence

Commands run in this review:

- `../../../node_modules/.bin/vitest run src/presentation/AdminImageCollectionEditor.test.tsx --maxWorkers=1` from `libraries/frontend/admin-ui-foundation` — PASS, 1 test file, 2 tests.
- `../../../node_modules/.bin/vitest run src/features/sales-menu/ui/SalesMenuPage.static.test.ts src/features/sales-menu/ui/SalesMenuPage.test.tsx src/features/sales-menu/model/salesMenuModel.test.ts --maxWorkers=1` from `apps/frontend/operations-admin` — PASS, 3 test files, 21 tests.
- `node scripts/generate/sales-menu-p1.mjs --self-test` — PASS, `CASES=18`, `OPERATIONS=31`, fixture class `TEST`, setup channel `OWNER_HTTP_COMMANDS`, `seedRuntimeInput=false`.
- `yarn workspace @catering-v2s/operations-admin typecheck` — PASS, exit 0, no stdout/stderr.
- Static recount script over policy JSON — PASS for current 18-case / 240-control-use / 68-unique-control denominator in generated source.
- Same-root/raw-locator scans — no M/S issue found; only helper-internal anchored AntD/native-input probes as described above.

## Findings

### R2-M03-RECHECK — Upload testId may not reach native file input

Status: REJECTED_WITH_EVIDENCE  
Severity: not counted as open M/S/N  
Evidence: `AdminImageCollectionEditor.tsx:90-99`, `AdminImageCollectionEditor.test.tsx:52-55`, `node_modules/antd/es/upload/Upload.js:6`, `node_modules/@rc-component/upload/es/AjaxUploader.js:360-388`, `node_modules/@rc-component/util/es/pickAttrs.js:55-66`, focused foundation test PASS.  
Minimum repair: none for this finding. If dependency versions change, rerun the same source-chain and focused markup proof.

### N-01 — Stale denominator wording remains in implementation plan completion definition

Status: CONFIRMED  
Severity: N  
Evidence: `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md:453-458` says the current preflight denominator is 18 cases / 240 declared controls / 68 unique control keys; `:582-584` still says “16 L2 cases”. Current generated source and self-test are 18.  
Minimum repair: when documentation cleanup is authorized, update the stale §14.4 bullet to 18 L2 cases and avoid citing old 16/220 reports. No production/test/generated/template change is required for this review.

## Gaps and risks

- Dynamic browser L2 was not run by instruction. Therefore real Chromium visibility, portal behavior, file chooser/upload action, focus restoration, real owner readback, business oracle, and cleanup are unverified.
- Static/focused tests prove source structure and current render-chain properties only. They do not prove real user-visible L2 behavior.
- The current `GO_WITH_UNVERIFIED_UI` should be read as L2 script-admission/static-preflight GO, not as dynamic L2, DEV, HTTP, business, or cleanup PASS.

## Stop condition

Round 2 is final for `REVIEW_CYCLE_ID=UI_TESTID_PREFLIGHT_20260903C` under `REVIEW_ROUND_LIMIT=2`. With M/S=0 and only N-01 documentation drift, the preflight implementation review can close as `GO_WITH_UNVERIFIED_UI`; any dynamic validation must be a separately authorized managed browser L2/runtime task.
