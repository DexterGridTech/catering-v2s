# CP-06 实施阶段三维对账

日期：2026-10-15  
范围：CP-06「文档、DEV 验证接缝与全链日志」当前字节。  
此前 CP-06 静态对账及 `/root/cp06_reconcile_delta_r2` 的 `MATCHED` 仅适用于当时已复核字节。后续全批 6b 确认受管历史分页 route handler 的在途清理缺少闭包；该部分经 `/root/cp06_route_cleanup_reconcile_fresh` 复核通过。其后多轮 fresh CP-06 复核确认 response waiter 首败拒绝未接管；主 agent先修复 supply helper 全部 17 处 waiter，再由 `/root/cp06_waiter_full_r3` 发现本 CP 的 `adminStructureDevUi.ts` 还有 3 处相同窗口。该 finding 已由主 agent核实并修复，增加局部拒绝日志及直接 focused test。fresh reviewer `/root/cp06_final_waiter_review_r3` 对当前完整 CP-06 判 `MATCHED, 0M/0S/0N`，结论仅为 STATIC；所有旧 verdict 保留，不升级为当前动态结果。

## 输入与独立复核

- 正式需求：`doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md`，V07、V12、V13、V16、V18。
- 详设：`doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-design-codex.md`，§3a、§9a、§10b、§11a、§13。
- 实施计划：`doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-plan-codex.md`，CP-06 与 DEV/cleanup 顺序。
- 附件：`doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-source-and-verification-appendix-codex.md`，§3–5。
- 项目约束：命中的 kernel、`deterministic-context-only`、`implementation-source-reread-discipline`、`test-closed-loop`、owner read-model 与 r5-full 资源/fixture 约束。
- 历史 fresh reviewer：`/root/cp06_reconcile_current` 的 MATCHED 仅对应先前字节。当前完整 CP-06 fresh 独立只读 reviewer：`/root/cp06_final_waiter_review_r3`，结论 `MATCHED, 0M/0S/0N`，STATIC only；它核查了完整 CP-06 与当前记录，未重跑主 agent focused proof。

## 三维结论

| 维度 | 结论 | 对账事实 |
|---|---|---|
| 正式需求 | MATCHED | V07/V12/V13/V16/V18 的三项后台场景在真实 console `update.owner-flow` 中调用；位于报告 accepted、CBS owner readback 与 UI 断言之后、`BUSINESS_PASS` 之前。覆盖业务角色菜单权限、门店扩展字段 SET/CLEAR/omission 与契约字段 owner readback。 |
| 详设、IA 与计划 | MATCHED | 唯一新增普通 helper 为 `tools/terminal-automation/journeys/adminStructureDevUi.ts` 及其 focused test；复用原 supply browser、owner API、精确 fixture 身份与现有 context 生命周期；没有增加 phase、case、runner、Java/DB/TDS 隔离环境或通用 fixture 系统。 |
| 项目记忆与规范 | MATCHED | 保留 owner command/readback、权限与审计边界、受管运行、日志关联、首败和 business/cleanup 分离；cleanup 只处理本 run 的精确对象，不清理未知对象。 |

## 源码、测试与诊断闭合

- `tools/terminal-automation/journeys/adminStructureDevUi.ts`：owner 请求携带相同的 `X-Request-Id` 与 `X-Correlation-Id`；本地 started/completed/rejected/failed 结构化事件带 `requestId`、`correlationId`、`operationId`。服务端自身 `requestId` 由诊断拦截器独立生成，跨层关联使用 `correlationId`，不声称两端 requestId 相同。
- Owner 读回：空或畸形响应均失败；assignment 只撤销本 run 创建的精确对象并 GET 确认；邀请状态使用当前闭集；只有邀请已 `COMPLETED` 而账号仍缺失才判 cleanup 失败，早期未完成的部分 setup 可正常回收。
- `tools/terminal-automation/test/adminStructureDevUi.test.ts`：10 项 focused test 覆盖关联头/事件、失败和空 GET、未知 enum、已完成邀请缺账号失败、早期部分 setup 清理通过，以及请求 waiter 原始拒绝仍传给调用方且立即输出诊断。
- `tools/terminal-automation/test-health`：当前已有的五个遗漏 Node test 文件显式登记；Vitest helper test 使用 Vitest 本身，不被误加到 Node test 清单。
- 主 agent 当前 focused 结果：`adminStructureDevUi.test.ts` 10/10 PASS；terminal-automation typecheck PASS。reviewer 未重跑。

## 当前 CP-06 fresh 完整阶段 verdict

- `reviewerKind=INDEPENDENT_SUBAGENT`；fresh reviewer `/root/cp06_final_waiter_review_r3`；结论 `MATCHED, M/S/N=0/0/0`，`EVIDENCE_TIER=STATIC`。
- Reviewer 独立核验正式需求 V07/V12/V13/V16/V18、详设/IA/CP06 计划、命中记忆与规范，随后才对照作者记录。确认供给 helper 的全部 17 个 request/response waiter 与 admin helper 的 3 个 request waiter均在可能失败的 UI await 前接拒绝观察；正常路径仍消费原 Request/Response 并保持既有断言，失败日志含原始错误名/message/stack。
- caller 清理核对：供给 helper 创建失败关闭 browser，成功返回后由 `update.test.ts` afterAll 关闭；admin role session 创建失败关闭 context，finally 关闭两个角色 context 后恢复本次业务字段并清理角色/任职；controlled route 精确 unroute，必要时关闭 owner page 并等待 tracked handler settled。
- focused proof 边界：本轮主 agent 命令输出为 `adminStructureDevUi.test.ts` 10/10 PASS 与 terminal-automation typecheck exit 0；没有保存单独原始输出文件。Reviewer检查直接测试源码，没有独立重跑，故执行结果标为作者命令输出，不归 reviewer 独立证实。DEV、D_BROWSER、W_CONTROLLED_UI、seed、business/cleanup 动态仍 `NOT_RUN`。
- 当前 CP-06 状态：三维 `MATCHED`。CP-04 仍为 `OPEN / DEXTER_WAIVED`；豁免只允许继续，不补造历史双读记录，不标 MATCHED。

## 边界与后续

- CP-06 的 DEV 动态业务与 cleanup 仍为 **NOT_RUN**，按计划留待全批 6b、动态准入、当前字节完整 seed dry-run 和后续 DEV 阶段执行。
- 按 Dexter 最新澄清，确需直接证明本批受影响隔离持久化接缝时，可使用现有受管 Testcontainers focused 入口；本 CP 不需要该证明。该许可不扩展到全量 backend-acceptance、隔离 L2，也不改变 UAT/真机禁项。
- 本 CP 对账不替代全批 6b、13c 或 fresh 整批 `REVIEW_TARGET=IMPLEMENTATION`。

## 当前 owner CLEAR 差量收口（2026-10-15）

- 主 agent 根因核验与修复记录见 `2026-10-15-backend-frontend-structure-owner-extension-clear-dynamic-delta-codex.md`。
- 当前 CP-06 字节由 fresh reviewer `/root/clear_delta_cp06_fresh` 判 `MATCHED, M/S/N=0/0/0, STATIC`；该审查核对了 typed CLEAR 到 GET key omission 的 owner 链、helper、日志、focused tests 和附录，不执行动态任务。
- 主 agent focused proof：`adminStructureDevUi.test.ts` 21/21 PASS，terminal-automation typecheck 退出码 0。
- 当前字节定向 DEV Web run `ccc67936-2758-45cf-90da-62c3474fff30`：business PASS、managed DEV diagnostic read PASS、runner/generated-artifact cleanup PASS。其日志分别记录门店 `floorLabelPresent=false` 与合同 `signedDatePresent=false`，同时保留其他值断言。详细状态、适用边界及历史失败保留见上述 delta intake。
- 此差量不改变 package/owner/API/存储契约，不触及 CP-01～CP-05；CP-04 仍 `OPEN / DEXTER_WAIVED`。Web 结果不证明 Android 安装器或 Hermes/native 热加载。

## 全批 6b 差量处置（主 agent 核验）

| 项 | disposition 与证据 | 最小处置及当前边界 |
|---|---|---|
| 6B-01：门店 `is24Hour` 开关未从 true 改为 false | `CONFIRMED`。附件 §4.1 要求 owner 先准备 true、UI 实际改为 false；`adminStructureDevUi.ts` 原逻辑以传入的旧 owner snapshot 决定是否点击。真实顺序为准备 true、打开编辑、放弃一次草稿、再重开，故条件为 false 不成立，正常路径不会点击，而后续断言却要求提交 false。 | 现改为先断言当前控件 `aria-checked=true`，实际点击一次，并断言控件转为 false 后再提交。类型检查已通过；原 `adminStructureDevUi.test.ts` 9/9 通过，但它覆盖清理 helper，不冒称覆盖真实 Switch；真实控件提交由计划中的 console `update.owner-flow` 验证。 |
| 6B-02：日期单字段提交错误要求未变字段 | `CONFIRMED`。V-12/V-13 与附件 §4.1 要求 changed-only object；`serializeExtensionFormValues` 对已有且未改变的 `renewal=true`、`depositRate=0.2` 会省略，只把变化的 `signedDate` 发出。原 helper 却要求三个字段均出现，正常 DATE SET 会被自身 oracle 拒绝。 | 现只要求 `signedDate`，并断言 `renewal`、`depositRate`、`settlementMode` 均缺席；随后独立 owner GET 仍验证原两个值保持。 |
| 6B-03：mutation 被强制附带不存在的 context query | `CONFIRMED`。生成契约 `operations-edge.ts` 的 `updateOperationsContract.query` 为 `Record<string, never>`；实际 `ContractEditDrawer` 发送 path、body 与幂等头，不发送 query。原 journey 强制 URL 有 `expectedContextVersion`，重放又人为追加该 query，既不能通过真实形态断言，也未重放原请求形状。 | 现要求首次 mutation URL 无 query，同键重放复用相同 path、body 与 idempotency key且不传 query；当前会话/上下文继续由现 session 与后续 owner readback 资格证明，不新增 mutation 参数。 |
| 过时的直接测试文件引用 | `CONFIRMED`。附件 §5.1 点名的 `terminalUpdateSupplyUi.test.ts` 与 `remoteControlWebJourney.test.ts` 不存在；相应行为实际落在现有受管 `update.test.ts`（分页与受限 fixture）和 `remote.web.test.ts`（两次 session 重启、结束与资源读回），角色/邀请精确清理由 `adminStructureDevUi.test.ts` 覆盖。 | 已把附件落点改为实际消费/运行文件，不新增同功能 suite 或 runner。未声称本批 W 已运行。 |

本次既有修改后 terminal-automation typecheck `PASS`；`test/adminStructureDevUi.test.ts` 9/9 `PASS`。这两项只证明类型与现有角色清理测试；三个正常路径 oracle 的真实页面行为仍为 `NOT_RUN`，需由计划中的 DEV console update 主链证明。此段形成时仍将 CP-04/05 历史留痕记为 `OPEN`，之后 Dexter 已透明豁免 CP-04 留痕门且 CP-05 已 `MATCHED`；该旧 gating 文字属于历史快照，不作为当前状态。全批 6b 尚待最新差量复核，因此动态仍未启动。

## CP-06 差量独立复核结果

- Fresh 独立只读 reviewer：`/root/cp06_reconcile_delta_r2`，结论 `MATCHED`，仅覆盖本次 CP-06 helper 与验收映射差量。

## 后续全批 6b 差量：分页 route handler 在途清理

- disposition：`CONFIRMED`。`terminalUpdateSupplyUi.ts` 原 `finally` 只 await 精确 `page.unroute(pattern, routeHandler)` 并记录 `handlerRemoved=true`，没有观察已进入 handler 的异步回调是否结束。按计划附件 §4 的普通失败路径判据，移除路由不等于终止在途 callback。
- 复核依据：项目 Playwright 解析版本为 `1.61.1`（`tools/terminal-automation/package.json`）；本机对应 `playwright-core/lib/coreBundle.js` 中 `page.unroute()` 调用 `_unrouteInternal(..., "default")`，不等待 `RouteHandler.stop()`；官方 v1.61.1 `page.ts` 与 `Page` API 的 `unrouteAll({behavior:"wait"})` 能力已核实。使用全页 `unrouteAll` 会移除无关路由，故不是本案的更小方案。
- 最小修正：只跟踪本具名分页 handler 返回的 Promise。先精确 unroute；若首败时仍有回调在途，由本 helper 当前 page owner 关闭该 page 以结束请求；随后 await 所有已登记 handler 的 settled 结果。记录 started/settled/in-flight、精确 unroute/page close 状态及原始 handler 错误；handler 未释放时不记 `handlerReleased=true`，首个业务失败仍优先抛出。
- 当前 focused proof：`yarn workspace @catering-v2s/terminal-automation typecheck` 退出码 0。计划中的现有 `update.owner-flow` 仍需在全批动态准入后验证正常分页行为；本轮未运行 Web、DEV、UAT或设备。
- 该段记载的是首次 route-handler 差量提交后的历史状态：当时等待 fresh reviewer。其后 `/root/cp06_route_cleanup_reconcile_fresh` 对 route-handler 部分确认 MATCHED，但发现 waiter 拒绝残余并将完整当前 CP-06 判为 `OPEN`；后续 waiter 修正已记录在本文件末尾，待新的完整 CP-06 复核。
- Reviewer 核对 R V-12/V-13/V-16/V-18、详设、计划、适用 memory/规范、`adminStructureDevUi.ts`、真实 Drawer/serializer、现有 journey 调用者及 focused test。确认门店开关从已读回的 `true` 实际切为 `false`；合同 DATE SET 只提交变化字段，保留原值并同键重放；不添加生成契约不支持的 query；测试落点对应现有真实调用链。
- 该 verdict 不覆盖 CP-04/CP-05 的历史过程记录，不替代全批 6b、13c、DEV 动态或整批 IMPLEMENTATION review。三个修正路径的页面行为仍 `NOT_RUN`；focused test 9/9 与 typecheck PASS 的边界如上。

## 全批 6b reviewer 发现的 response waiter 差量

- Fresh 独立 CP-06 reviewer：`/root/cp06_route_cleanup_reconcile_fresh`，对前一版 route-handler 修复作完整 CP-06 三维复核，结论 `OPEN`；未运行命令或测试。
- 主 agent disposition：`CONFIRMED`。`waitForControlledPage()` 创建 response waiter 后，原调用先 await UI click；click 若先失败，则 waiter 尚未 await。随后由外层 `afterAll` 关闭 browser 时 waiter 可能拒绝，原路径没有立即接收拒绝的处理器。此事实不表示已发生生产业务故障。
- 同根范围：controlled pagination 的首屏/下一页/上一页/刷新四处均为 waiter→click→await；route 精确移除后的真实历史恢复首屏和后续页也有相同顺序。未把本次修复扩展到此 W_CONTROLLED_UI 段之外的独立 owner UI 操作。
- 最小修正：局部 `clickAndWaitForPageResponse` 在 click 开始前附加 waiter 拒绝日志，并以 `Promise.all([click(), responsePromise])` 同时接管两侧拒绝；四个受控分页动作和路由移除后的真实 task 恢复读回共用该段逻辑。保留正常路径既有 Response 断言与首个失败，不加 waiter registry、重试或新资源 owner。
- 定向证明：`yarn workspace @catering-v2s/terminal-automation typecheck` 在此差量后退出码 0。浏览器 W_CONTROLLED_UI、业务和 cleanup 仍 `NOT_RUN`；尚无修复后 fresh CP-06 verdict。
- 同组源码回读：`terminalUpdateSupplyUi.ts` 中受控分页、handler 的精确 unroute、失败 owner page close 与真实历史恢复保持原顺序；`update.test.ts` 仍在 `afterAll` 关闭所属 browser。此状态是该历史记录形成时的状态，已由下方最新差量更新。

## response waiter 同根闭合差量

SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

- 独立核验：`/root/cp06_response_waiter_reconcile_r2` 对当时字节判 `OPEN`，确认初始真实历史读取仍先创建 `waitForResponse`、再点击、最后 await；点击先失败后，供给 browser 的 `afterAll` 关闭会使 waiter 拒绝，而该拒绝没有接收者。该事实是 runner 清理/诊断缺口，不证明已发生业务故障。
- 主 agent 扩大同根扫描：同一文件共有 17 个 `waitForResponse`/`waitForRequest` 调用点，涉及工件保存、规则创建/筛选/门店详情/启停/刷新、真实报告历史首屏与后续页、受控分页和 route 移除后的真实恢复。它们都可能在后续 UI 动作先败、页面关闭时收到拒绝；不把它限制在 reviewer 点名的首屏路径。
- 最小修正：增加同文件 `observePageWaiterRejection(runId, phase, waiter)`，在每个原始 request/response waiter 创建后立即挂上拒绝日志并保留原 Promise 给原有成功路径 await。controlled/restore 的 `clickAndWaitForPageResponse` 继续用 `Promise.all` 接管 click 与 response 两侧失败。没有 waiter registry、retry、额外 timeout 或新资源 owner。
- 同根反例边界：waiter 成功时观察器不改返回值，原有 status、body、业务字段和 readback 断言保持；失败时日志包含 phase、错误名、message、stack，caller 仍按原路径传播首个业务失败。route handler 仍只精确 unroute，必要时关闭本次 owner page 后 await 自己的在途集合。
- focused proof：`yarn workspace @catering-v2s/terminal-automation typecheck` 退出码 0。受管 Web `W_CONTROLLED_UI`、DEV业务与 cleanup 仍 `NOT_RUN`，不得将 typecheck 写作运行闭包证明。
- 防再犯落点：本文件的 CP-06 review checklist 记为“先列出该 utility 全部 `waitForRequest`/`waitForResponse` 创建点，确认拒绝观察在任何可能失败的 UI await 之前已挂接；再核正常路径仍 await 原 waiter”。以 `rg` 枚举为有限分母；无需增加机械门或新测试框架。
- 当前状态：前两次 reviewer verdict 均保留为各自字节的 `OPEN`；上述修复字节尚未有 fresh CP-06 verdict，CP-06 当前仍 `OPEN / WAITING_FRESH_REVIEW`。CP-04 留痕仍为 `OPEN / DEXTER_WAIVED`，豁免推进阻断但不是 `MATCHED`。

## adminStructureDevUi response waiter 同根差量

- 独立核验：`/root/cp06_waiter_full_r3` 对修复前字节完成完整 CP-06 三维对账并判 `OPEN`。其确认 `terminalUpdateSupplyUi.ts` 的 17 个 waiter 已观察，但 `adminStructureDevUi.ts` 的 store 更新、合同日期设置及合同日期清除三个 `waitForRequest → click → await` 路径仍有相同拒绝窗口。点击先失败并由父级关闭页面时，原 waiter 可能在没有拒绝处理器时 reject；该事实是首败诊断/清理缺口，不表示业务请求错误已发生。
- 主 agent disposition：`CONFIRMED`。本人重读正式需求 R-15～R-17、CP-06 详设/计划和 owning helper，确认这是本 CP 新接入的后台维护流程，落在全链日志与首败判据内。供给 helper 已修复不覆盖此文件。
- 最小修正：在 `adminStructureDevUi.ts` 内为该 helper 增加局部 `observePageRequestWaiterRejection`，每个 waiter 创建后、点击前附加关联阶段及原始错误名/message/stack 的结构化拒绝日志，同时返回原 Promise，正常路径继续 `await` 原响应。不引入通用 waiter registry，不改变 UI、请求或业务断言。
- focused proof：`adminStructureDevUi.test.ts` 10/10 PASS，新增直接证明原 Promise 仍向 caller reject 且旁路日志保留原始错误；`yarn workspace @catering-v2s/terminal-automation typecheck` exit 0。未运行浏览器或 DEV 场景。
- 当前状态：CP-06 仍 `OPEN / WAITING_FRESH_REVIEW`，等待 fresh reviewer 按完整 CP 范围重核 supply helper 17 处、admin helper 3 处、原 owner/readback/cleanup 接线及日志。CP-04 仍 `OPEN / DEXTER_WAIVED`；该豁免仅允许继续，不表示历史记录补齐或 CP-04 MATCHED。

## CP-06 详情生命周期两轮修复及当前收口

- 主 agent 独立核验：R1、R2 findings 均为 `CONFIRMED`。真实 Store/Contract detail 的 edit action 会先关闭详情；旧 helper 在 dirty discard 后未重开详情，并在 owner-readback clean cancel 后还点击隐藏详情的 close 按钮。
- 最小修复：新增按精确 store/contract ID 从列表重开详情、等待 owner-backed action menu ready 后进入编辑的 helper；dirty discard 后复用该路径。owner-readback 编辑 clean cancel 后，只验证编辑与详情 Drawer 均隐藏，不再对已隐藏详情执行点击。同步更新附件中的实际交互顺序与验收边界。
- 直接反例测试：`yarn workspace @catering-v2s/terminal-automation test test/adminStructureDevUi.test.ts`，17/17 PASS，覆盖两种资源的精确重开顺序与 clean cancel 不再点击隐藏 close；`yarn workspace @catering-v2s/terminal-automation typecheck` 退出码 0。测试不代表真实页面动态通过。
- Fresh 独立 reviewer `/root/cp06_final_delta_reconcile` 对当前完整 CP-06 完成静态三维对账，结论 `MATCHED, M/S/N=0/0/0`。它核验了该差量、两个真实 Drawer 生命周期、调用顺序、既有供给 waiter/route cleanup 闭包及未变测试登记；未运行测试或动态环境。
- 仍保留：`CP-04=OPEN / DEXTER_WAIVED`，豁免只允许继续，不追补历史留痕，也不标为 MATCHED。CP-06 的 STATIC MATCHED 不等于动态通过。

## 当前字节的最近受管运行

- 最近运行：`acbacd91-0306-4846-9676-ea7cb569da87`，console `update.owner-flow`，`business=FAIL`、runner `cleanup=PASS`。首败 `TERMINAL_AUTOMATION_WEB_BUSINESS_PASS_NOT_OBSERVED`，发生在后台详情 action menu 就绪等待；run log 已定位到 Store/Contract Drawer 的生命周期假设。该源码缺口已修复并由 focused tests、typecheck、fresh CP-06 STATIC MATCHED 收口；修复后的 owner-flow 尚未重跑。
- 该旧 run 的业务 fixture helper 清理曾对 `updateOperationsOrganizationStore` 返回 403 `PLATFORM_COMMON_ACCESS_DENIED`；其角色/assignment cleanup 成功，runner 进程与生成物清理 PASS。manifest 的 runner cleanup PASS 不覆盖业务字段恢复，因此不得将该旧 run 的业务 fixture cleanup 写为 PASS。
- 最新 helper 现使用创建该角色的 writer session 恢复并 owner-GET 验证字段，随后才关闭 session；当前一次成功 owner-flow 仍是验证该修复的必要差量。测试开始时先保存真实当前值，结束时恢复该 run 的起始值，不将 seed 基准强加给未知的既有业务值。
- DEV manifest 仍指向本仓受管 DEV `runId=r5-dev-1792058956406-6851-f214e222-e03c-4c56-a971-93755ab883f8`、namespace `v2s-dev-r5-full`、数据库 `catering_v2s_dev_r5_full`。本轮没有执行 reset、seed、UAT 或设备操作。当前无运行中的 terminal-automation process；旧 run 树已结束。
- 最近运行与最后一次通过：当前字节最新动态仍为上述 `FAIL / runner cleanup PASS`；修复后当前字节最后一次业务通过尚无，写 `NOT_RUN`。历史其他 run 不因本次 focused proofs 升级为当前字节通过。

## 下一步边界

- CP-06 当前静态阶段 `MATCHED`；2 轮 TEST_CHAIN_PREFLIGHT 已完成，确认问题修复并由定向 closure reviewer 及完整 CP-06 reviewer 核验。进入动态前仍需补全批 6b 的受影响差量核对与现有 DEV 资源预检。
- 下一动态只重跑受影响的 console `update.owner-flow`，验证后台三项检查及现有更新供给/报告链；不会重跑完整设备矩阵、seed 或无关 verify。若该场景再失败，先读取其当前字节日志，判定首败边界和业务 fixture cleanup，再决定最小修复。
- 其他未受影响的 CP/动态记录继续按各自原字节、原范围复用。13c 与 fresh 整批 IMPLEMENTATION review 仍未完成。
