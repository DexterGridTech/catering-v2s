# 前后台结构优化 CP-05 实施与对账记录

## 范围与状态

- CP：05，更新页资源接缝、规则创建 Drawer、remote-control launcher/workspace，以及现有 automation driver 的页面诊断与历史分页观察 helper。
- 本记录整理当前字节上的核验、focused proof 与回读；不把文档整理时间伪称为每次代码写入时刻。
- fresh 独立 CP-05 reviewer `/root/cp05_fresh_delta` 对完整 CP05 与本次 close/restart 差量判定 `MATCHED`；reviewer 只读，未运行验证。此前记录中的待复核状态保留为历史。
- 依据：正式需求 R-10/R-11、V-09/V-11；详设 §8.5；计划 CP-05 第 1、3～5 项；远控 IA/UI 的弹层关闭与 session 身份规则；更新规则 IA/UI 的 Drawer lifecycle；命中 memory `implementation-source-reread-discipline.md`、`deterministic-context-only.md`。

## Finding intake 与最小修正

| 项 | disposition | 当前源码事实、反例与最小修正 | 边界 |
|---|---|---|---|
| F1：Workspace A 的 `ending` 污染新 session B | `CONFIRMED` | `RemoteControlWorkspace.tsx` 的 session effect 在切换身份时重置连接呈现状态，但此前没有清理 A 的 `ending`。A 的 end 请求挂起、同一挂载切换到 B，B 完成首帧和 keepalive 后仍被渲染为非 active，并继承结束按钮 loading。新 session 初始化现在同步 `setEnding(false)`。测试保持同一 Workspace 挂载，在 B active 后先拒绝 A 的 end，再分别完成/拒绝 A 的 disconnect；B 的 active 呈现和按钮状态保持。 | 不据此声称所有指针事件均被禁止；已有 pointer handler 仍按当前 phase/Room 身份判断。只关闭确认的 UI 状态污染和资源交错。 |
| F2：Page 在异步后仍用旧详情身份 | `CONFIRMED` | `ProjectTerminalUpdatePage.tsx` 原先在 report Drawer open/close 后没有同步更新 selected terminal ref，远控资格闭包读取 render snapshot；规则状态成功后 `await loadRules()` 又可能按旧 detail snapshot refresh A。迟到 start 失败也能在同 context 的 B Drawer 写入 A 的错误。现在 open/close 同步更新 `selectedReadRefs`，close 同时 invalidates 未完成 start；成功状态刷新使用当前 ref 重读，冲突读回和远控成功/失败反馈均在 await 后核对当前 entity。 | project/context 仍由各 read hook 和 launcher 自己检查；没有新增业务数据镜像、请求队列或 page registry。当前页面接缝由静态 wiring 断言验证，实际 session launcher 交错由 hook 测试验证。 |
| F3：规则创建成功/失败回包可污染后续 Drawer context | `CONFIRMED` | `RuleCreateDrawer.tsx` 的幂等键生成与 create HTTP 均为 await；原成功、catch、finally 无提交身份检查。A 请求挂起后 Drawer context 切换为 B，A 的迟到响应会关闭/提示/清理 B。现在复用 foundation `useAsyncGenerationGuard`；提交捕获 generation 与 `open|context`，在幂等键和 HTTP 两个 await 后及 catch/finally 写 UI 状态前校验；context/open 变化和卸载使 generation 失效。切 context 复用现 `lifecycle.resetPreservingOpen()` 清掉旧提交态与草稿状态。 | 不取消已发出的 HTTP，也不声称可回滚已完成的服务端操作；仅阻止旧结果写入新 UI 身份。没有新增 retry 或通用请求框架。 |
| F4：上述交错缺少直接测试 | `CONFIRMED`（测试缺口已补） | `RemoteControlWorkspace.test.tsx`、`useRemoteControlLauncher.test.tsx`、`terminalUpdateReadModels.test.tsx`、`RuleCreateDrawer.test.tsx` 补了同挂载 A/B、end 先拒绝、同 context 选中终端变化、门店页和历史页在关闭后分别迟到成功/拒绝、Drawer context 变化后迟到成功/拒绝。仍用既有 React test renderer 与 foundation guard。 | mock Room 只证明 Web seam 上的状态和释放回调，不证明浏览器媒体栈或原生 adapter。没有扩大成端到端动态验收。 |
| F5：缺少可读的 CP05 差量记录 | `PARTIALLY_CONFIRMED` | 先前尚无 CP05 专属的耐久记录。本文件现在记录 finding disposition、判据、修改点、focused proof 与当前源码回读；不声称其在首次改动前已写入。执行会话中写入前重开了本节列出的需求/设计/IA/memory/owning source，focused proof 后再次读回同组判据与源码。 | 独立 reviewer 仍需核查逐点双读是否足以支撑完整 CP 对账；本文件不替代 fresh 独立 CP05 判定。 |
| F6：session 已结束后关闭按钮不再收口 | `CONFIRMED`（已修复） | `RemoteControlWorkspace.tsx` 原先在首次 `finishSession` 后永久保留 `sessionFinishing=true`；若首次异步 end/Room 清理完成时 `closeRequested=false`，之后点可见“关闭”只设置标记并返回，永不再触发 `onClose`。现在在本 session effect 闭包保存完成结果及一次性通知标记；清理进行中关闭仍由首次完成尾部处理，清理完成后关闭立即带原结果通知一次。测试覆盖断开结束完成后再点关闭，并断言 session 身份、end/cleanup 结果及重复点击不重复通知。 | 复用现有 session 闭包与 callback，不增加账本、恢复任务或重试。 |
| F7：Room cleanup 失败在 ENDED 页不可见 | `CONFIRMED`（已修复） | cleanup 失败此前只写日志并传给父页关闭后的提示；由于用户主动结束时 Modal 保持 ENDED，用户在该 Modal 内看不到批准的“远程控制已结束，资源释放失败”结果。现在当前 session 的 Room cleanup 失败直接更新 ENDED 页面提示；测试断言该文案可见，并验证关闭回调仍带 `cleanupFailed=true`。 | 只显示浏览器本地 Room cleanup 事实；不推断 TER native 资源状态，不新增 CBS 报告字段。 |
| F8：read model 请求在组件卸载后迟到 | `CONFIRMED`（测试缺口已补） | 四个具名 hook 均使用 foundation `useAsyncGenerationGuard`；其 effect cleanup 会使当前 generation 失效，四个 hook 的成功、拒绝与 finally 状态写入均在 generation/context/entity/cursor 检查后。原测试覆盖 context、entity、cursor 与 close，未覆盖组件仍有请求在途时卸载。现在既定 `terminalUpdateReadModels.test.tsx` 用 deferred 的规则页成功和报告页拒绝覆盖卸载后到达，观察实际 foundation guard 均返回失效，并确认没有可提交的数据、problem 或完成态 loading 值。 | 只测 Web read-model hook 与 foundation guard 接缝；请求未取消，未据此声称网络、DEV 或适配器行为。 |
| F9：当前 launcher owner 卸载或切换 context 后未结束已 active 的 CBS session | `CONFIRMED` | `OperationsApp.tsx` 以 `contextVersion` 为 Page key，实际切换会卸载旧 Page；但 launcher 只 invalidate pending start，current active session 只存在 React state，卸载无 CBS `end`。同一 hook 保持挂载而 contextKey 改变也只清理 pending start。现在 launcher 保留同步 `currentSessionRef`，并在已拥有 session 的 context 改变或卸载时，通过既有 `endOperationsTerminalRemoteControl` 精确关闭该 session；Page 正常关闭后 `clear(sessionId)` 清 ref，避免重复 end；旧 session id 不匹配时不清新 session。新增 context-change、active unmount、正常 clear 后 unmount 三个直接断言。 | 不增加 session store/ledger；只给现 launcher 的唯一当前 session 补生命周期 close。CBS end 失败被现有 logger 记录，不宣称服务端必然已结束。 |
| F10：远控失败诊断在 frontend/driver 投影处丢失原始错误 | `CONFIRMED` | Workspace 只写 `errorName/errorCode/status`，其 `log` 将 outcome=ERROR 仍发 INFO；launcher/Page catch 也只投影 typed problem。browser request 只保留 `ERR_*`，LiveKit 错误正文和 Expo 子进程未分类/超长输出被丢弃或截断。现在 ERROR 事件使用 error logger；operations-admin 在 DEV 或显式 debug 日志时附原始 `errorMessage/errorStack`，runner 转发 remote-control 日志的这两字段；remote Journey 同时记录原始 request/socket error，Expo stdout/stderr 子进程 chunk 原样进入 run log，Android diagnosticText 不再截断，RTC probe 保留完整 socket error。增加 logger projection 的原始错误字段正例，保留通用 event.message 与无关字段不投影。 | 不记录 request/response payload，不改用户可见错误；admin release 默认不附原始正文。调试字段没有做字段级裁剪。 |
| F11：restart 在途时关闭仍可能接纳迟到 session | `CONFIRMED`（已修复） | ENDED Modal 的“重新发起”调用 launcher；workspace 的“关闭”/Esc 原先只等 Room 收尾后 `clear(oldSessionId)`，而 `restart` 仅检查 context。若 start 响应在 clear 前到达，launcher 会接纳新 session；若在 clear 后到达，也没有失效代次，均可能重新打开 Workspace。现在 launcher 为单个在途启动记录其发起 session；Workspace 在关闭开始时同步调用 `cancelRestart(sessionId)`，仅匹配该 session 的待处理 restart 才使既有 generation 失效。迟到成功继续走既有 stale-start end，不写入 currentSession。新增 launcher 红例覆盖 restart→close/cancel→迟到成功 end 返回 session，并在 Workspace close 测试中断言同步关闭请求回调。 | 复用既有 generation、currentSession 和 stale-start cleanup；没有第二会话账本、重试或新状态机。真实 Room/网络行为仍未由该 React 单测证明。 |

## 当前源码读回

1. `RemoteControlWorkspace.tsx` session effect 的初始化顺序现重置 `dataPathReady`、`ending`、phase、problem、tracks、screenReady 与 visibleFrames。`ending` 属当前 workspace 呈现状态，跟随新 `currentStart.sessionId` 初始化，不进入 launcher/task 第二份状态。
2. `ProjectTerminalUpdatePage.tsx` 的 `openRule`、`closeRule`、`openVersion`、`closeVersionDrawer` 在调用 hook/launcher 前同步写当前 selection；状态读回和远控 start 的闭包仅在 request context 与所选 entity 同时匹配时提交 UI 反馈。远控 start/end 与 currentSession 的事实仍归 `useRemoteControlLauncher`。
3. `RuleCreateDrawer.tsx` 保留原 request body、idempotency key、scope、FULL/HOT 选择和业务 API；guard 只围住同一提交的结果写回。context reset 调用 foundation 明确提供的 `resetPreservingOpen`，dirty/close guard 仍由 `useDrawerFormLifecycle` 单一管理。
4. `ProjectTerminalUpdatePage.static.test.ts` 原有两处检查仍定位到已迁出的内部 owner（详情分页 hook 与 remote launcher），造成对当前结构的失效断言；现改为读取真实 hook/launcher source 并断言当前消费接线与本次身份条件，没有删除检查目标。
5. `src/react-test-renderer.d.ts` 原声明只暴露单参数 `create`，但本 CP 需要既有 React test renderer 的 `createNodeMock` option 为 video ref 提供可读尺寸/readyState。仅扩充本地 test-only 声明；未变更依赖或运行代码。
6. `RemoteControlWorkspace.tsx` 在结束完成后保留同一 effect 闭包的 `{endFailed, cleanupFailed}`，后续关闭回调最多触发一次；结束尚在途时仍由原完成尾部消费 `closeRequested`。Room 清理失败在仍打开的 ENDED Modal 内呈现批准文案，随后关闭仍把失败事实传给原父 owner。
7. `RemoteControlWorkspace.test.tsx` 的 Modal mock 之前不渲染 `title`，无法触发真实关闭按钮；现将标题和正文一起渲染，并用 `ReactNode` 保持测试替身类型正确。
8. 四个 read model hook 均调用 foundation guard；foundation 的实际 hook cleanup 在卸载时 invalidate。新增两个 deferred 反例在真实 hook/foundation 接缝上观察迟到成功和拒绝发生于 unmount 之后时 guard 都已失效，写后读回四 hook 的 state-writing 分支仍均受该 guard 与各自业务身份限制。
9. `terminalUpdateSupplyUi.ts` 的 W_CONTROLLED_UI 观察复用现有页面与 Playwright route：fixture 只匹配当前 origin、历史 path 和本次 `contextVersion`；页 1/2 的真实渲染行分别显示唯一 `actual.apkVersion` 后缀并断言另一页值不存在，下一页、上一页和刷新均核对业务行。finally 精确撤销本次 route 后重开真实报告历史并恢复原任务。它只为有限分页提供可重复观察，不把 fixture response 当 owner 持久化事实，也不替代 DEV HTTP。
10. 原 remote-control console projection 对 diagnostic 字段做 allowlist，并过滤自由文本；browser request failure 只保留 `ERR_*`，LiveKit socket 正文仅在部分 probe 中记录且截断，Expo 子进程输出只分类、未分类文本丢弃且长行截断。当前 CP05 修复后，admin DEV/debug 日志通过 `errorMessage/errorStack` 记录异常正文，runner 透传这两个明确错误字段；browser request/socket error 与 Expo stdout/stderr 原始输出均进入本次 run log，Android 的原始错误文本不再按 4096 字符截断。仍不记录请求/响应业务正文，不改变 UI safe message；production admin 未显式 debug 时不附异常原文。
11. `useRemoteControlLauncher.ts` 的 `currentSessionRef` 只指向当前有效 session；成功 start 同步更新 ref，Page 正常结束反馈调用 `clear(sessionId)` 同步清除该 ref。实际 page/context unmount 时，cleanup 只向 CBS end ref 持有的 session；contextKey 改变时先 invalidates pending start，再精确结束 context 不同的 current session。旧 end 成功或失败都不会覆盖后续 session ref。

## Focused proof

| 命令 | 当前字节结果 | 证明边界 |
|---|---|---|
| 同上五文件 suite（F8 加测之前） | 退出码 0；5 files / 26 tests passed。 | 已改文件之后单独重跑；其余四文件字节未变，沿用本次记录中的原结果。 |
| `yarn workspace @catering-v2s/operations-admin vitest run src/features/terminal-update/model/terminalUpdateReadModels.test.tsx`（F8 后） | 最新退出码 0；1 file / 10 tests passed，含迟到成功及拒绝发生于卸载后的两项。 | 与上一行合并覆盖 CP05 原五文件范围的 28 个 test case；不是一次 28 项 aggregate run。测试观察 actual foundation guard 的 late `isCurrent=false`，并保留 stale read snapshot 的 items/problem/loading 断言。 |
| `yarn workspace @catering-v2s/operations-admin typecheck` | 退出码 0。 | operations-admin 当前 TypeScript 闭包。 |
| `yarn eslint apps/frontend/operations-admin/src/features/terminal-update/model/terminalUpdateReadModels.test.tsx --max-warnings=0` | 退出码 0。 | F8 新测试文件定向 lint；Workspace 修复两文件及此前 8 个 CP05 TS/TSX/d.ts 文件定向 lint 仍按原记录保留。 |
| `yarn workspace @catering-v2s/operations-admin vitest run src/features/terminal-update/model/terminalUpdateReadModels.test.tsx src/features/terminal-update/ui/RuleCreateDrawer.test.tsx src/features/terminal-update/ui/ProjectTerminalUpdatePage.static.test.ts src/features/remote-control/model/useRemoteControlLauncher.test.tsx src/features/remote-control/ui/RemoteControlWorkspace.test.tsx src/features/remote-control/model/parseRemoteControlMessage.test.ts` | 当前字节退出码 0；6 files / 32 tests passed。 | 覆盖本轮 CP05 页面、Drawer、remote launcher/workspace、read-model 和 parser 单测；只证明 Web/React seam，不证明 DEV HTTP、浏览器媒体或 adapter。 |
| `yarn workspace @catering-v2s/operations-admin typecheck` | 当前字节退出码 0。 | operations-admin 当前 TypeScript 闭包。 |
| `yarn workspace @catering-v2s/terminal-automation vitest run test/browserNetworkDiagnostics.test.ts test/adminStructureDevUi.test.ts` | 当前字节退出码 0；2 files / 31 tests passed。 | 覆盖保留原始 browser policy/错误诊断及 admin 页面 helper 的直接检查；不代表任何 DEV Journey 已运行。 |
| `yarn workspace @catering-v2s/terminal-automation typecheck` | 当前字节退出码 0。 | 更新后 driver helper 与 remote Journey TypeScript 闭包。首轮曾发现 `contextVersion` 未限定到输入对象以及远控重启状态字段未充分收窄；按真实类型修正后本次通过。 |
| `yarn workspace @catering-v2s/operations-admin vitest run src/features/remote-control/model/useRemoteControlLauncher.test.tsx src/features/remote-control/ui/RemoteControlWorkspace.test.tsx` | 本次当前字节退出码 0；2 files / 11 tests passed。 | 直接覆盖 active context change/unmount、clear 后不重复 end、现有 A/B workspace 交错；不是运行时/DEV证据。 |
| 同上两个 remote-control 测试文件（restart-close 差量） | 旧实现下新增 launcher 用例失败：`cancelRestart is not a function`；修复后退出码 0，2 files / 12 tests passed。 | 覆盖关闭请求同步使匹配 session 的 restart 失效、迟到 start 返回只经既有 end cleanup、不写 currentSession；Workspace close 先发关闭请求回调。仅为 React/launcher seam proof。 |
| `yarn workspace @catering-v2s/terminal-automation vitest run --config vitest.config.ts test/browserNetworkDiagnostics.test.ts` | 本次当前字节退出码 0；1 file / 22 tests passed。 | 直接断言 remote-control 错误正文/stack 投影，同时保留非 remote 通用字段排除；不是任何 Journey 运行。 |
| `yarn workspace @catering-v2s/operations-admin typecheck` | CP05 修复后当前字节退出码 0。 | 本次 launcher、Workspace、Page 与 tests 类型闭包。首轮因 `useRef` 无初始值不符合仓内 React 类型签名失败；改为 `useRef<RemoteControlSession | undefined>(undefined)` 后通过。 |
| `yarn workspace @catering-v2s/terminal-automation typecheck` | CP05 修复后当前字节退出码 0。 | 本次 browser diagnostic projection、两条 remote Journey 与 RTC probe 类型闭包。 |

## 本轮 CP-05 全量复核 finding 处置

| finding | disposition | 当前字节证据与最小处置 | 剩余边界 |
|---|---|---|---|
| TDC README 未列全公开 selectors | `CONFIRMED` | `src/index.ts` 导出六个 selectors，而 README 原只说明激活、连接和延时三个。已在 README 列出六个准确导出名及各自用途：`selectActivationState`、`selectConnectionState`、`selectConnectionLatency`、`selectTerminalTopicSubscriptions`、`selectTerminalClientStatusProjection`、`selectTerminalHttpContext`。无 API 或生产行为改动。 | README 是否完整准确仍由本次 fresh 完整 CP-05 reviewer 复核。 |
| reviewer 提出的 `transportParameters.reconnectPolicy` 测试遗漏 | `REJECTED_WITH_EVIDENCE` | 当前正式需求 V-05 是 `catalog.preparation-diff`（null/missing/SKU 子集与 totalCount），详设同样指定 `CatalogOwnerValueSupportTest` 和 DEV catalog readback；CP-05 不把 TER `ParameterDefinition` 消费列作判据。现有 transport 参数测试可属于其他范围，但不能据此扩大本 CP 的测试或实现分母。 | 不回退其他已存在的 transport 参数实现；本 disposition 仅排除其作为 CP-05 finding。 |
| `ui-state` README 结构与实际源码不符 | `CONFIRMED` | README 原把 `commands/` 放在 `features/` 下；当前命令位于 `src/declarations/commands.ts`，且 TR-R06 只允许 `features/actors/` 与 `features/slices/`。已将 README 树改为实际 `declarations/commands.ts`、`declarations/errors.ts`，移除错误的 `features/commands/`。 | 纯文档修正；没有新增结构或代码门。 |
| transport README 重复列出 `application/` | `CONFIRMED` | README 结构树重复列同一 `application/`；当前源码仅有一个 `src/application/`，包含 module 与 network-status bridge。已合并为一个准确目录项。 | 纯文档修正；没有行为改动。 |

此前记录中的 transport 参数测试属于其他范围，不纳入 CP-05 V-05。CP-05 V-05 仍按正式契约映射到 catalog preparation-diff；其相关实现和验证在 CP-02/CP-03 的对应记录中处置。本次 CP-05 差量只更新 README 与 remote-control close/restart identity。

CP-05 fresh review 还发现两处 README 树与实际目录不符。主 agent 按正式需求 R-15、TR-10/TR-R06 与当前 source 最小更正文档；修改后回读 README 和 source，并以 `git diff --check` 验证补丁格式。该文档差量仍等待 fresh reviewer 对完整 CP-05 复核。

首轮 red 证据：新增 Workspace A/B 交错测试在生产修复前失败，B 已取得有效 video/frame 和 keepalive ACK，但 video class 仍为 `remote-control-video`，定位到新 session 未清除 `ending`。随后第一轮四文件测试有 2 条旧静态断言失败，分别仍查找已迁入 hook 的详情 cursor 和已迁入 launcher 的 start/end API；按真实 owner 修正断言。此轮新增“结束完成后再关闭”测试第一次失败于测试替身未渲染 Modal `title`，其 ENDED 清理失败文案断言已先通过；修正 Modal mock 后 focused 测试通过。类型检查第一次因 mock 将 React 节点错标为 `unknown` 失败，按 React 渲染契约改为 `ReactNode` 后通过。F8 首次测试 run 因 Probe 在每次 render 新建 filters 对象，effect 反复重载并导致 Vitest worker heap OOM；将 filters 稳定为测试外常量后，用原测试文件复验 10/10 通过，没有提高 heap 上限。operations-admin 页面静态检查另曾因源码格式变化触发一条脆弱字符串断言；改为容忍空白差异的定位断言后 6/6 通过，未改变生产行为。automation 首轮 typecheck 报上述两个真实类型错误，修正后重跑通过。未运行本批 DEV Journey、UAT、Android 或真机；容器仅在直接证明受影响 owner 接缝且测试确需时使用，不把授权误作无差别启动条件。

## 差量回读判据

- R-10/V-09：读资源身份保留 context/entity/cursor 与独立 guard；本次修复未改变 query/业务 owner。打开/关闭与 await 后结果依赖当前所选身份，迟到结果不能改写新 selection。
- R-11/V-11：start 成功仍须同 target/session 资格；过期 start 由 launcher 结束其捕获的 session；Workspace A 的迟到 end/disconnect 只清理 A，不改 B 的 `ending`、phase、problem、tracks、loading 或 close 通路。页面资格仍受原 capability、ONLINE、target/context 约束。
- R-11/V-11 close-after-restart：关闭按钮与 Esc 在启动请求返回前同步取消从当前 session 发起的 pending restart；响应若随后成功，必须结束它自己的新 session，不能重新设置 `currentSession`。普通重发起成功仍通过受控 `currentStart` 更新同一 Workspace。
- 远控 UI IA §1.4、交互 §5：结束后保留 ENDED Modal；清理失败在 Modal 内明确可见；随后“关闭”与 Esc 由同一 Workspace owner 收口并恢复原焦点。当前 effect 内完成结果供关闭回调使用一次，不重复发送 end 或 disconnect。
- RULE-CREATE IA/UI：仍经原 Drawer、lifecycle、唯一提交、失败保留输入路径；本次没有改变用户可见操作、业务 payload 或授权。
- CP-05 测试判据：同一挂载 A→B；A end 先拒绝、A disconnect 随后完成或拒绝；B 保持 active、A listener/Room 精确释放；同上下文 entity 切换后过期 start 被 end；read-model close 后 late success/error 不回写；规则 Drawer context 变化后的旧提交不 close、不 toast、不显示旧错误；Room cleanup 失败在 ENDED 可见，已完成 session 后关闭将原结果通知一次。
- read-model unmount：测试在 pending page 请求仍未完成时卸载当前 hook，再 resolve/reject。foundation guard 实际检查必须在卸载后返回 false，hook的 success/catch/finally 不得写数据、problem 或完成态 loading；四具名 hook 的 guard 接线和写入条件已静态逐项核对。

## 尚未覆盖

- README selector 清单、实际目录树与 V-05 测试映射的旧 `OPEN` 已由本轮修正文档并经 fresh reviewer 核验关闭。
- fresh reviewer 逐项检查完整 CP05 需求、详设/IA、项目记忆、owning source、直接测试与 README；确认当前完整 CP05 `MATCHED`。该结论是静态三维对账，不代表 DEV、LiveKit 媒体或 adapter 动态通过。
- close/restart 差量的 operations-admin 两个测试文件 12/12 通过，operations-admin typecheck 通过；这些 proof 由主 agent 执行，reviewer 未运行验证。
- DEV Web、Android/adapter、远控真实媒体/LiveKit、全批 6b、13c 和整批 IMPLEMENTATION review 尚未完成；按计划后续阶段执行。必要 Testcontainers/受管资源按实际相关测试需要使用；UAT 与物理真机不在本批执行面。
