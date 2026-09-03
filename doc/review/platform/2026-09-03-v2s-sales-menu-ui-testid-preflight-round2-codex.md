# V2S Sales Menu UI/testID Preflight Round 2 Review

REVIEW_CYCLE_ID=UI_TESTID_PREFLIGHT_20260903B
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
ROUND_FINAL_DECISION=SELF_DECIDED

VERDICT=GO
M/S/N=0/0/0
L2_USER_VISIBLE=STATIC_PREFLIGHT_ONLY_NO_DYNAMIC_L2_RUN

## Verdict scope

本轮仅核验销售菜单 L2 脚本开发前 UI/testID 前置准入：当前代码、生成分母、binding union、静态 focused tests 与仓内安装的 AntD/rc-upload 实现链。未运行动态浏览器 L2；因此本报告不证明真实 Chromium、真实 HTTP、owner readback、business oracle 或 cleanup。

准入标准边界来自：

- `doc/platform/browser-l2-execution-standard.md:13-15`：浏览器 L2 必须是真实 Chromium/前端/HTTP/owner/隔离资源；静态、focused、Testcontainers、DEV 或 UAT 互不替代。
- `doc/platform/browser-l2-execution-standard.md:63-87`：L2 脚本开发前必须完成 UI/testID 前置复核，控件需来自 `*TestIds.ts` 并绑定真实动作节点。
- `doc/platform/browser-l2-execution-standard.md:89-91`：缺常量、挂错真实动作节点、binding/touch 不一致或宽 locator 替代均是可证伪失败。
- `doc/platform/frontend-coding-standard.md:547-548`：机械可验证的 testID/locator/case 分母可建门，真实用户行为必须在获授权浏览器 L2 中验证。
- `doc/platform/frontend-coding-standard.md:550-570`：每个实际操作控件必须有稳定 testID、真实动作节点绑定；禁止用 role/label/placeholder/text/index/CSS/XPath 或外层 wrapper 替代。

## Evidence commands

- `node scripts/generate/sales-menu-p1.mjs --self-test` — `SALES_MENU_P1_SELF_TEST=PASS; CASES=16; OPERATIONS=31; FIXTURES={"fixtureClass":"TEST","setupChannel":"OWNER_HTTP_COMMANDS","seedRuntimeInput":false,"reportInputs":[],"forbiddenRuntimeInputs":["DEV seed report","API report","seed-created sales-menu object"]}`。
- `./node_modules/.bin/vitest run apps/frontend/operations-admin/src/features/role-home-bootstrap/roleHomeTestIds.test.ts --environment node` — 1 file / 1 test PASS。
- `./node_modules/.bin/vitest run libraries/frontend/admin-ui-foundation/src/presentation/AdminImageCollectionEditor.test.tsx --environment jsdom` — 1 file / 2 tests PASS。
- Denominator recompute over `contracts/policy/sales-menu-l2-case-blueprint.json`, `contracts/policy/sales-menu-l2-scenarios.json`, `contracts/policy/sales-menu-l2-locator-bindings.json` — 16 blueprint cases, 16 generated cases, 220 declared control entries, 68 unique binding keys, 68 binding controls, `missing=[]`, `extra=[]`, `STORE_SCOPE` in 16/16 cases.
- Raw locator audit over `apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts` — `getByRole=5`, `getByLabel=0`, `getByText=0`, `getByPlaceholder=0`, `locator(=0`, `.nth(=0`, `filter({hasText=0`, `xpath=0`, raw sales-menu `getByTestId('sales-menu-`=0, raw `data-testid=`=0. The five `getByRole` occurrences are scoped inside already-bound controls or read-only assertion, not sales-menu control binding identity.

One attempted combined vitest run used `--environment jsdom` for both files and made `roleHomeTestIds.test.ts` fail at `new URL(..., import.meta.url)` with non-file scheme. Re-running that static test in node environment passed; I do not count the jsdom mismatch as implementation failure.

## Finding disposition

### M-01 — DataScopeSelector trigger/confirm and STORE_SCOPE denominator

Status: REJECTED_WITH_EVIDENCE

上一轮关于 confirm 未绑定稳定 testID、operationsL2 走 role fallback、STORE_SCOPE setup touch 不足的 finding，被当前 source/test 证明不成立。

Evidence:

- `apps/frontend/operations-admin/src/features/role-home-bootstrap/roleHomeTestIds.ts:1-11` 定义唯一稳定 data-scope vocabulary，包括 `trigger='operations-data-scope-trigger'` 与 `confirm='operations-data-scope-confirm'`。
- `apps/frontend/operations-admin/src/features/role-home-bootstrap/ui/DataScopeSelector.tsx:300-307` 将 `roleHomeTestIds.dataScope.confirm` 直接挂在实际 AntD `Button` 上，`onClick={() => void submit(candidate)}` 是同一动作节点。
- `apps/frontend/operations-admin/src/features/role-home-bootstrap/ui/DataScopeSelector.tsx:313-325` 将 `roleHomeTestIds.dataScope.trigger` 直接挂在实际 trigger `Button` 上。
- `apps/frontend/operations-admin/src/features/role-home-bootstrap/roleHomeTestIds.test.ts:8-19` 静态测试要求每个 scope id 同时出现在 `DataScopeSelector.tsx` 与 `operationsL2.ts`，确认 confirm 挂到真实 Button，并禁止 `getByRole('button', {name: '确认...'})` fallback；该测试在 node 环境 PASS。
- `apps/frontend/operations-admin/src/tests/l2/operationsL2.ts:89-150` 中 `selectOperationsDataScope` 对 trigger 使用 `page.getByTestId(roleHomeTestIds.dataScope.trigger)`，对 confirm 使用 `page.getByTestId(roleHomeTestIds.dataScope.confirm).click()`，并在 trigger/confirm 后调用 `onControlTouch`。
- `apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts:729-740` 的 `selectStoreScope` 将 `onControlTouch` 绑定为 `recordControlTouch('STORE_SCOPE', testId)`，因此 setup 阶段可记录 trigger/confirm touch。
- `contracts/policy/sales-menu-l2-case-blueprint.json:23-31` 与 `contracts/policy/sales-menu-l2-locator-bindings.json:10-18` 声明 `STORE_SCOPE` 的 trigger testID 与 confirm testID。
- `contracts/policy/sales-menu-l2-case-blueprint.json:620-634` 展示首个 case 的 `STORE_SCOPE` 进入 controlKeys；复算命令确认 `STORE_SCOPE` 出现在 16/16 case。

有限适用范围：仅证明当前公共 `DataScopeSelector` 与销售菜单 L2 setup 使用的 STORE scope 绑定；不证明动态 scope 选择在真实浏览器/真实 owner 数据下成功。

最小修复：不需要。若后续动态 L2 失败，应按 runtime 日志和 browser trace 诊断，不应回退为 role/text locator。

### M-02 — Sales menu selector option business-identity testID and ACTION_TOUCH

Status: REJECTED_WITH_EVIDENCE

上一轮关于菜单 selector option 使用 label/CSS 兜底且未记录 ACTION_TOUCH 的 finding，被当前 source/spec 证明不成立。

Evidence:

- `apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts:1-15` 以 `menuOption(menuRef)` 生成 `sales-menu-option-${slug(menuRef)}`，`menuSelector='sales-menu-selector'` 来自同一常量源。
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx:2503-2519` 中 selector option 的 `value` 是 `menu.salesMenuRef`，label 内的 visible anchor 使用 `salesMenuTestIds.menuOption(menu.salesMenuRef)`，Select wrapper 使用 `salesMenuTestIds.menuSelector`。
- `apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts:759-765` 中 `ensureMenuSelected` 用 `facts.menuRef` 计算 `salesMenuTestIds.menuOption(...)`，传给 `selectOperationsOption(..., optionTestId)`，随后记录 `recordControlTouch('SALES_MENU_SELECTOR', menuOptionTestId, 'ACTION')`。
- `apps/frontend/operations-admin/src/tests/l2/operationsL2.ts:31-55` 的 `selectOperationsOption` 先以 selector testID 打开 control；传入 `optionTestId` 时 `currentVisibleOption` 在当前可见 portal 内执行 `dropdown.getByTestId(optionTestId)`，没有使用 label/CSS 作为该销售菜单 option 的身份兜底。
- Raw locator audit over `sales-menu.spec.ts` found no `getByLabel`/`getByText`/`getByPlaceholder`/`locator(`/`.nth(`/`filter({hasText`/XPath/raw sales-menu testID string usage.

有限适用范围：证明当前销售菜单 selector option 的业务身份来自 `menuRef` 且 L2 spec 记录 ACTION_TOUCH。`operationsL2.ts:4-10` 仍使用 AntD portal CSS 定位当前可见 dropdown，并保留 label fallback 供未传 `optionTestId` 的共享调用使用；这不是当前销售菜单 selector option 身份绑定的反例。

最小修复：不需要。后续若其它 operations helper 调用仍无 option-level testID，应按各自 Journey 单独补 testID/分母，不能把本结论泛化。

### M-03 — Upload testID reaches native file input and ACTION_TOUCH after setInputFiles

Status: REJECTED_WITH_EVIDENCE

上一轮 M-03 已被当前 foundation test 与仓内安装的 AntD/rc-upload 实现链证明：`sales-menu-item-media-upload` 最终落到 native `<input type="file">`，且销售菜单 spec 在 `setInputFiles` 后记录 ACTION_TOUCH。

Evidence:

- `apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts:30-36` 定义 `itemMediaUpload='sales-menu-item-media-upload'`。
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx:603-650` 将 `salesMenuTestIds.itemMediaUpload` 传给 foundation `AdminImageCollectionEditor` 的 `testIds.upload`。
- `libraries/frontend/admin-ui-foundation/src/presentation/AdminImageCollectionEditor.tsx:90-99` 将 `testIds.upload` 直接 spread 到 AntD `<Upload>`。
- `libraries/frontend/admin-ui-foundation/src/presentation/AdminImageCollectionEditor.test.tsx:52-54` 静态 markup 测试断言 `data-testid="image-upload"` 出现在 `<input ... type="file">` 上；该 jsdom/renderToStaticMarkup test PASS。
- Installed `antd` package is 6.5.0; `node_modules/antd/lib/upload/Upload.js:297-316` 将 `...props` 放入 `rcUploadProps`，只删除 `className/style`，未删除 data attribute；`node_modules/antd/lib/upload/Upload.js:423-425` 将 `rcUploadProps` 传给 rc-upload。
- Installed `@rc-component/upload` package is 1.1.1; `node_modules/@rc-component/upload/lib/AjaxUploader.js:345` 保留 `...otherProps`，`node_modules/@rc-component/upload/lib/AjaxUploader.js:372-384` 将 `pickAttrs(otherProps, {aria:true,data:true})` spread 到 native `<input>`，同一节点 `type="file"` 且保存 file input ref。
- `apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts:1126-1147` 对媒体上传控件先 `requireControl`，再通过 `visibleTestId(...itemMediaUpload)` 获取 file input，`setInputFiles` 后记录 `ACTION_TOUCH`。
- `apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts:1161-1172` 第二次上传同样在 `setInputFiles` 后记录 `ACTION_TOUCH`。
- `apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts:1436-1460` 失败与重试路径两次 `setInputFiles` 后均记录 `ACTION_TOUCH`。

有限适用范围：证明当前安装版本 `antd@6.5.0` + `@rc-component/upload@1.1.1` 的默认 `<Upload>` 渲染链和当前 foundation consumer。若未来升级 Upload 实现或改为 custom input，需要重新核验 native input 归属。

最小修复：不需要。

## Full denominator and raw locator audit

Status: REJECTED_WITH_EVIDENCE for stale 204/67 denominator; current denominator is 220/68.

Evidence:

- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md:884-886` 要求按 16 个 case/action 建立控件分母，并禁止 role/label/placeholder/text/index/CSS/XPath 或外层 wrapper 替代。
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md:915-918` 记录当前分母复算为 16 case/action、220 declared control entries、68 unique binding control key。
- `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md:452-457` 同步要求 16/220/68，且 STORE scope、Upload native input 等不得从分母省略。
- `contracts/policy/sales-menu-l2-locator-bindings.json:1-9` 声明 locator binding 文件绑定到 case blueprint，caseCount 为 16。
- `contracts/policy/sales-menu-l2-locator-bindings.json:105-110` 声明 `SALES_MENU_SELECTOR` 的 testID。
- `contracts/policy/sales-menu-l2-locator-bindings.json:336-341` 声明 `SALES_MENU_ITEM_MEDIA_UPLOAD` 的 testID。
- Fresh recompute returned: 16 blueprint cases, 16 generated cases, 220 declared control entries, 68 unique binding keys, 68 binding controls, no missing/extra controls, `STORE_SCOPE` in 16/16 cases.
- `node scripts/generate/sales-menu-p1.mjs --self-test` returned `SALES_MENU_P1_SELF_TEST=PASS; CASES=16; OPERATIONS=31`.
- Raw locator audit found no sales-menu control-binding use of raw label/placeholder/text/CSS/XPath/index locators in `sales-menu.spec.ts`. The remaining `getByRole` calls at `apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts:873-887` and `apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts:898-911` are scoped inside a prior `requireControl` result and then record ACTION_TOUCH against the bound control testID; the `columnheader` role occurrence is a read assertion, not a control binding.

有限适用范围：当前审计覆盖当前 sales-menu L2 spec、case blueprint、generated scenarios、locator bindings union。它不 audits every non-sales-menu helper consumer in operations-admin, except where directly used by the sales-menu selector/scope path.

最小修复：不需要。

## Static vs dynamic boundary

Status: UNVERIFIED_REQUIRES_EVIDENCE for dynamic browser L2 only; not a blocker for this static preflight verdict.

Evidence:

- 本轮遵守“不要运行动态 L2”的指令，未执行 browser readiness、managed runner、Chromium、HTTP owner readback 或 cleanup。
- `doc/platform/browser-l2-execution-standard.md:39-40` 明确动态 L2 需要 Dexter 明确动态授权；静态检查、readiness 建设、P1 生成或 focused proof 不构成该授权。
- 因此 `VERDICT=GO` 只代表 UI/testID/L2 script admission preflight 静态准入通过；`L2_USER_VISIBLE=STATIC_PREFLIGHT_ONLY_NO_DYNAMIC_L2_RUN` 明确不把静态 PASS 写成浏览器 PASS。

有限适用范围：动态用户可见结果、真实网络 exact-set、owner readback、失败恢复、cleanup 均未被本报告证明。

最小修复：当前前置准入不需要修复；后续进入动态 L2 时必须按受管入口另取 business/cleanup evidence。

## Final decision

ROUND_FINAL_DECISION=SELF_DECIDED

当前 M-01/M-02/M-03 均为上一轮 finding 的 `REJECTED_WITH_EVIDENCE`；未发现新的 M/S/N finding。按本轮授权范围，销售菜单 UI/testID preflight 可以从 `UI_DESIGN_REVIEW=OPEN`、`TESTID_REVIEW=OPEN`、`L2_SCRIPT_ADMISSION=BLOCKED` 推进为前置准入 GO。该 GO 不包含动态浏览器 L2，不应作为 L2 business 或 cleanup PASS 使用。
