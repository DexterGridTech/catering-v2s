# v2s 销售菜单 UI testId/L2 前置静态复核 Round 1

REVIEW_CYCLE_ID=UI_TESTID_PREFLIGHT_20260903B
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
ROUND_FINAL_DECISION=SELF_DECIDED

## 结论

VERDICT=NO-GO
M/S/N=3/0/1
L2_USER_VISIBLE=findings

本轮只做 bounded fresh independent static review。未修改代码、契约、模板或测试；未运行动态、DEV、reset、seed、UAT、deploy 或 Git。静态核对确认 16 个 sales-menu L2 case 与 67 个 unique controlKey 在 blueprint/generated bindings/spec union 数量上闭合，但 L2_SCRIPT_ADMISSION 仍因真实动作节点与 touch 记录问题失败。

## 已确认 Findings

### [M-01] CONFIRMED - 公共 STORE scope 确认按钮属于本次销售菜单 L2 控件分母，但没有 testID，并被可见文案定位

证据：
- `DataScopeSelector.tsx:288-306`：取消按钮有 `operations-data-scope-cancel`，确认 Button 只有 `type/loading/onClick` 与文案 `确认{scopeName(type)}`，没有 testID。
- `operationsL2.ts:81-127`：`selectOperationsDataScope` 用 `page.getByRole('button', {name: '确认总公司/确认大区/确认门店/确认项目'})` 点击确认。
- `sales-menu.spec.ts:729-735`、`:738-742`、`:1563-1565`：每个 sales-menu case 在 `runDeclaredAction` 前都会通过 `openSalesMenu -> selectStoreScope -> selectOperationsDataScope` 完成公共 STORE 范围确认。
- `sales-menu-l2-case-blueprint.json:628-633`：case 步骤显式包含“确认全局门店范围”。
- `frontend-coding-standard.md:552-563` 与详设 `2026-09-01-v2s-sales-menu-implementation-design-codex.md:876-889`：L2 前置要求逐 action 建立控件分母，真实 click/fill/select/upload/press 节点必须由 `*TestIds.ts` 唯一源提供稳定 testId，不得用 role/label/text fallback。

判断：scope confirm 是销售菜单 L2 公共 setup 的真实业务前置动作，属于本轮分母。当前实现用可见文案定位 Button，且该 Button 没有唯一源 testID，阻断 L2_SCRIPT_ADMISSION。

修复建议：为 operations 公共 data-scope 控件建立唯一 testId 源或既有公共 testIds 常量，并把确认 Button 的 testID 挂在实际 Button 节点；`operationsL2.ts` 改为按该 testID 点击，并把 scope setup touch 记录纳入公共 L2 evidence。

### [M-02] CONFIRMED - `SALES_MENU_SELECTOR` 的真实选择动作绕过 sales-menu binding/touch，只用 CSS portal + label 选择 option

证据：
- `sales-menu.spec.ts:754-757`：`ensureMenuSelected` 先 `requireControl('SALES_MENU_SELECTOR')`，随后调用 `selectOperationsOption(page, salesMenuTestIds.menuSelector, facts.menuName)`。
- `operationsL2.ts:28-48`：`selectOperationsOption` 用 `page.getByTestId(testId)` 打开控件，但真实 option 通过 `.ant-select-dropdown...` 和 `filter({hasText: label})` 选择；该 helper 不接收 controlKey，也不调用 `recordActionForLocator` 或 `recordControlTouch(..., 'ACTION')`。
- `sales-menu.spec.ts:411-423`、`:425-437`：本 sales-menu runner 的 action evidence 依赖 controlKey/testId metadata；绕过后只能留下前置 CONTROL_TOUCH，不能证明 select action 的真实节点与 controlKey。
- `sales-menu-l2-case-blueprint.json:620-627`、`:669-682`、`:734-748` 等 16 case controlKeys 中广泛声明 `SALES_MENU_SELECTOR`。

判断：这不是单个 case 问题，而是 sales-menu selector 的同根全集问题。选择菜单是业务动作，但当前 spec 的真实选项点击不经过 locator binding 和 ACTION_TOUCH 闭环，且以 CSS + label 作为实际 option locator。

修复建议：把 sales-menu selector 的 select 动作接入 bound control metadata：至少在打开控件和完成选项选择后记录 `SALES_MENU_SELECTOR` 的 ACTION_TOUCH；若选项本身是业务身份动作节点，应由 sales-menu TestIds 唯一源提供动态 option/row identity，不能只靠 label。

### [M-03] PARTIALLY_CONFIRMED - 图片上传 testID 静态上挂在 AntD Upload wrapper，spec 对同一 testID 直接 `setInputFiles`，且上传动作未记录 ACTION_TOUCH

证据：
- `SalesMenuPage.tsx:645-648`：sales-menu adapter 把 `salesMenuTestIds.itemMediaUpload` 传给 foundation `AdminImageCollectionEditor`。
- `AdminImageCollectionEditor.tsx:90-99`：testID 被 spread 到 `<Upload ... {...testId(testIds.upload)}>`，不是显式挂到 native `input[type=file]`。
- `sales-menu.spec.ts:1115-1127`、`:1150-1151`、`:1423-1427`、`:1437-1438`：spec 对 `page.getByTestId(salesMenuTestIds.itemMediaUpload)` 直接执行 `setInputFiles`。
- `sales-menu.spec.ts:411-437`、`:1114-1127`：上传前只有 `requireControl('SALES_MENU_ITEM_MEDIA_UPLOAD')` 的 CONTROL_TOUCH；`setInputFiles` 后没有 `ACTION_TOUCH`。
- `frontend-coding-standard.md:566-570`：复合控件窄例外不适用于可以直接标记的 file input。

判断：静态源码已确认当前 testID 没有显式绑定 native file input，且上传动作没有 action touch。是否在运行时 AntD 恰好把 data-testid 透传到可 `setInputFiles` 的节点，需要浏览器 DOM 才能证明；本轮禁止动态，因此这部分标 PARTIALLY_CONFIRMED。但按前置标准，静态已足以判定 L2 admission 不能 GO。

修复建议：foundation 或 sales-menu adapter 应把 upload testID 明确挂到真实 file input，或提供受控的 file-input locator API；spec 在 `setInputFiles` 成功后必须记录对应 controlKey 的 ACTION_TOUCH。

### [N-01] CONFIRMED - 16 case controlKeys 与 bindings/spec union 数量闭合，但这只证明静态集合，不证明真实用户动作

证据：
- `sales-menu-l2-scenarios.json:17-19`：generated scenarios 声明 scenarioCount/caseCount 均为 16，locatorBinding 指向 `sales-menu-l2-locator-bindings.json`。
- `sales-menu-l2-locator-bindings.json:3-9`：bindings kind/sourceOfTruth/caseCount 有效，controls 为运行时 binding source。
- 本轮静态复算：16 cases，67 unique controlKeys，67 binding controls，case controlKeys 全部有 binding。

判断：集合数量闭合是必要条件，但不覆盖 M-01/M-02/M-03 的真实动作节点和 touch 记录缺口。

## Same-Root Scan

- scope setup 同族：`operations-data-scope-trigger/region/project/store/head-company/cancel` 均有直接 testID；确认 Button 是本轮确认的缺口。四个确认分支（总公司/大区/项目/门店）均使用 `getByRole(...确认...)`，其中销售菜单当前走 STORE 分支。
- sales-menu declared control 同族：16 case、204 declared control entries、67 unique controlKeys 已核对；controlKey 到 generated binding 没有缺项。
- raw locator 同族：sales-menu 业务按钮/MenuItem/Radio/Checkbox/分页多数经 `requireControl`、`clickBoundControl`、`checkBoundControl`、`findManagerAction` 绑定并记录；剩余 raw role/text/CSS 用法中，scope confirm 与 selector option 是本轮 blocking findings。AntD portal 可见 dropdown/menu 的 CSS 定位作为 helper 边界保留为静态未动态证明，不单独升级。
- upload 同族：新增、二次上传、失败重试上传共 4 个 `setInputFiles` 使用点均走同一个 `SALES_MENU_ITEM_MEDIA_UPLOAD` testID，问题同根。

## 未证明边界

L3_UNVERIFIED=
- 未运行 browser L2，未证明真实 Chromium DOM 中 scope confirm、selector option、Upload native input 的实际可点击/可填/可上传节点。
- 未运行 DEV/reset/seed/UAT/deploy。
- 未运行 typecheck、vitest、Playwright 或 LSP diagnostics；本轮结论只基于静态 source/bindings/spec/design review。
- 未证明 sales-menu L2 的 HTTP completion、business oracle、cleanup、focus return、overlay behavior 或 owner readback。

L1_ENGINEERING=findings: testID/binding/touch 静态集合闭合，但真实动作节点和 action evidence 未闭合。
L2_USER_VISIBLE=findings: 公共 scope confirm、菜单 selector select action、图片 upload action 不满足 L2 前置可测性。
L3_UNVERIFIED=见上。
SAME_ROOT_SCAN=见 Same-Root Scan。
DESIGN_GAPS=无新增正本缺口；本轮问题已有 `frontend-coding-standard.md` §3-K-9 与销售菜单详设 §11.2a 覆盖。
EVIDENCE_TIER=STATIC_SOURCE_REVIEW_ONLY。
