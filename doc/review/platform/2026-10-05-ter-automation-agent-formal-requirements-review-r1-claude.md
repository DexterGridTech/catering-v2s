# TER automation-agent 正式需求 · 第 1 轮独立盲审

```text
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-review-r1-input-checklist-claude.md
blindReviewDeclaration=先独立 verdict、后对照作者材料（本轮无作者 intake 材料）
authorMaterialReadAfterIndependentVerdict=true
REVIEW_CYCLE_ID=TER_AUTOMATION_AGENT_FORMAL_REQUIREMENTS_2026-10-05
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewedObjectSha256=2fdd117499093a6dcf81ce827c42e1dbf032497da36f268db5adc5e2cca012fb
SESSION_PROVENANCE=fresh 子 agent，catering-v2s 仓内；静态只读；未构建、未跑测试/设备、未执行 git
AUTHORIZATION_BOUNDARY=本结论只针对需求文档静态评审，不授权详设定稿、实施、规范修订、依赖、构建、DEV、设备或任何数据操作
```

## 0 · 结论块

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=2/12/7
L1_ENGINEERING=findings：M-1 与在途已授权批次冲突；M-2 受管执行与观测要求缺失；S-1/S-2/S-3/S-5/S-6/S-10/S-11 范围或可行性误述
L2_USER_VISIBLE=findings：S-4（R-04 第 4 条在本机 admin 新增可见指示，属 UI-bearing，未做 UI 适用性声明与交互工件）；首个旅途沿用既有 UI，非新增界面
L3_UNVERIFIED=F-1～F-4（对象自认 UNVERIFIED）；副屏 Presentation 的像素密度与 PixelRatio.get() 是否一致（外部事实）；RN Android 对自签 wss 证书的处理（外部事实）；sample-console 当前开机首屏是否仍为 staff-login、首个旅途是否需要 DEV 后台（S-7）
SAME_ROOT_SCAN=见 §4
DESIGN_GAPS=G-1：正本未定义“TER 自动化 runner”与“门/检查器”的判别式（R-16 分母无判据）；G-2：TR-08 未规定“构建期配置读入、代码常驻”这一形态的门与红夹具应如何改写；G-3：terminal-coding-standard 未定义何为“公开 selector”（状态 selector 与同名纯函数 helper 无判别）
TEMPLATE_COVERAGE=见 §5
EVIDENCE_TIER=静态源码与文档亲验；无 focused/Web/设备运行证据
```

NO-GO 的直接原因是两条 M：R-16/R-14 会拆掉一个 `IMPLEMENTATION_AUTHORITY=true`、动态 `IN_PROGRESS` 批次正在使用的受管入口和 testID；被删 runner 承载的受管设备生命周期在新 driver 上没有任何对应要求。其余 S 多数可由作者在本轮范围内修正；S-9、S-12 需 Dexter 裁决。

## 1 · 方案合理性

**我先独立推导的预期**：Dexter 的三个痛点（定位难、触发难、state 黑盒）指向一件事：让外部脚本以结构化方式拿到控件、数据和 command 结果，而不是靠 dump 与日志。我自己的方案也会是 App 内一个 agent（Web/Android 同一份 TS）+ 主机侧 driver，数据只经 selector，command 复用 requestId 与 journal，真实输入走平台通道。这与对象一致。

**问题对不对**：对。仓内事实支持痛点：现有 runner 合计 18,524 行（`wc -l` 亲验 5 个主文件），依赖 uiautomator dump 与 logcat。对象没有把需求扩成通用测试平台。

**方案优不优**：主干合理，但对象漏了三个更小的替代，作者应在需求里写出取舍：

1. **displayId 由 driver 侧取**：driver 用 `adb shell dumpsys display` 与注册表的 surface 键对应，App 内不必新增 displayId 读面（见 S-1）。比 R-09“取自 dual-screen 适配层”少一条跨层读面，也不碰 platform-ports README:33 的“automation 不进端口”。
2. **登记即定义**：要求公开状态 selector 一律经 runtime 的 `defineSelector` 创建，登记表由定义派生（与 `defineCommand` 同形），机械门退化为类型检查加一条“包根导出的已定义 selector = 登记集合”。比“从公开面识别 selector”更容易写成一行可判定规则（见 S-2）。
3. **分两批交付**：批 A = agent + driver + selector 登记 + 首个旅途（只改旅途涉及包的 testID）；批 B = testID 全量重建 + runner 删除，在批 A 两端跑通后进行。spike 已跳过，风险集中在 F-1/F-2；把破坏面最大的两项放在新栈被证明之后，失败时不会出现“旧 runner 已删、新栈不通”。这是 Dexter 的范围裁决（S-12）。

**代价配不配**：方向上的收益真实，但对象低估了代价。“删除约 1.85 万行”并不全是负担：其中包含 VM 识别、APK 构建/安装/启动、run manifest、cleanup 等受管生命周期（`scripts/test/ter-virtual-keyboard-android.mjs:4,24,565`），新 driver 必须重建这部分才能合规运行（M-2）。testID 重建涉及 115 个源码文件里 795 处 `testID` 与 35 个测试文件（grep 亲验）。加上 selector 补登、runtime 契约、两道门、规范修订、skill 与两端双屏旅途，单批无法在半小时内核完（S-12）。

**方案合理性 verdict**：方向 GO，范围与排序 NO-GO。问题选对了，解法主干对，但批次边界与在途工作、受管执行红线和若干仓内事实没有对齐。

**UI 与交互自问**：agent/driver 本身不是用户界面，`NOT_APPLICABLE`（用户是写旅途的工程师与 agent）。唯一新增可见面是 R-04 第 4 条“本机 admin 能看出 automation 已启用及连接地址”：来源是 Dexter 认可的连接面四条（讨论稿 §5.6），用户（门店/运维）此时看到它合逻辑（防止误发测试包），但放在哪个 admin 页、文案、是否显示完整地址都未定（S-4）。

## 2 · 内部一致性核对（逐对）

- R-02 开关 vs R-04 第 1 条：一致（字段缺省即关闭），重复但不矛盾。
- R-06 vs R-05：一致；但 R-06 的“不直接读 full state”需要 runtime 提供按名求值接口才可证（N-6）。
- R-10“不设使用限制” vs R-17“只能真实输入”：一致。R-10 定能力，R-17 定首个旅途的证据口径。
- §5 非目标 vs R-15/R-16：一致（不接线扫描门；不重写首个旅途之外的场景）。
- R-03“远端可不依赖 adb” vs R-10 Android 真实输入依赖 adb：不一致（S-11）。
- R-08“业务组件零改动” vs R-14 全量改 testID：措辞冲突，实际指注册零改动（N-7）。
- §3“实施第一个 CP” vs §8“详设开工前列为第一个 CP”：口径不清，F-3 实为详设输入（S-10）。
- 与讨论稿：§10 的 Appium 后备、§5.6 的 HOT 下发关系、§8 K7 非 React 界面在正式稿消失且无处置（N-5）。

## 3 · Findings

### M-1 · R-16/R-14 会拆掉在途已授权批次的受管入口与 testID，对象没有排序或前置条件

- **位置**：R-16（第 259-273 行）、R-14（第 232-244 行）、§8（第 391-395 行）。
- **证据（仓内事实）**：`doc/plans/platform/2026-10-02-ter-terminal-activation-interaction-pair-topology-implementation-plan-codex.md` 头部写 `IMPLEMENTATION_AUTHORITY=true`、`ALL_DYNAMIC_STATUS=IN_PROGRESS`；第 172 行“Expo Web 场景复用 `scripts/test/ter-admin-display-web.mjs`”，第 194 行把 `ter-admin-display-web-contract.mjs::WEB_SCENARIOS` 定为共享目录，第 223、273 行复用 `ter-virtual-keyboard-android.mjs` 的受管 VM/build/install/launch，第 267 行用 `ter-admin-display-web-stage.mjs` 聚合 11 个 A 场景。`scripts/README.md:264-280` 把 `ter-admin-display-web.mjs` 登记为 TER Expo Web A 场景的受管入口。`scripts/test/ter-admin-display-web.mjs` 修改时间为今天 11:18，说明仍在活跃使用。
- **推论**：照 R-16 执行会让该批次失去动态验收入口；照 R-14 执行会让它的 locator 全部失效；该批计划新增的 `ter-terminal-interaction-android.mjs` 按“全部 TER runner”也落入删除范围。对象 §7 与 §8 都没有提到这批工作。
- **分类**：CONFIRMED（冲突事实）；排序本身是 `DEXTER_DECISION`。
- **最小修复**：在 §8 增加一条前置条件：“本专项的 R-14、R-16 在终端激活交互与双机拓扑批次动态收口之后执行；该批新增的 runner 与场景一并列入 R-16 待重写清单。”若 Dexter 要求并行，则须写明交接方式。只加一条排序约束，不改能力设计，所以没有更小的修复。

### M-2 · 删除的 runner 承载受管设备生命周期，新 driver 没有对应的受管执行与观测要求

- **位置**：R-13（第 220-230 行）、R-16、§3 第 323 行、§6“删除约 1.85 万行”（第 373 行）。
- **证据（仓内事实）**：`scripts/test/ter-virtual-keyboard-android.mjs:4` 注明“this entrypoint so process, device, screenshot, and cleanup evidence is bound”，`:24` 的 `cleanup --run-id`，`:565` 的 `assertRunAllowsAction(manifest, …)`。AGENTS.md:83、87、89 与 kernel 05 的 `RUN_SCOPED_LOG_READ_REQUIRED`、`MANAGED_RESOURCE_BUDGET_REQUIRED`、`BUSINESS_CLEANUP_SEPARATE` 要求所有长运行有 run-scoped manifest、受控 process identity、资源预检、结构化脱敏日志，并分开判定 business 与 cleanup。
- **推论**：R-13 只要求失败报告字段，没有要求 driver 作为受管入口运行（manifest、VM/APK 身份、`adb reverse` 的建立与回收、WS 服务端进程回收、首败日志）。§3 只把 F-1/F-2 指向 `cs-managed-runtime-execution`，V-13、V-17、V-18 没有。结果有两种：要么新 driver 违反 AGENTS 硬约束，要么详设阶段才发现要重建这部分。后者是隐性范围，也使“删除 1.85 万行”的收益被高估。
- **分类**：CONFIRMED。
- **最小修复**：在 R-13 增加一条：“driver 与旅途运行是受管运行，遵守 AGENTS.md 受管运行、资源预算与日志条款；详设须列出从被删 runner 迁移或复用的生命周期能力（VM/设备身份、build/install/launch、`adb reverse`、cleanup）。”同时把 §6 的“删除”改成“删除 dump、坐标与日志解析部分，受管生命周期迁移到 driver”。只补约束、不预设实现，不能更小。

### S-1 · R-09/R-11 的 displayId 与运行信息来源与仓内事实不符

- **位置**：R-09 第 187 行、R-11 第 207-212 行、R-01 依赖方向。
- **证据（仓内事实）**：displayId 只存在于 `kernel/base/platform-ports/src/types/device.ts:30`（DevicePort）与 `adapter/android/dual-screen/src/implementations/surfaceHost.ts:6,33,60`；display-context 的公开读模型 `DisplayFactsSurface`（`kernel/base/display-context/src/foundations/displayDevice.ts:28-36`）只有 `displayIndex`，没有 displayId；`ui/base/render` 的 `SurfaceHostMeasurementSnapshot`（`surfaceHost.ts:13-16`）也没有。`kernel/base/platform-ports/README.md:33` 写明“automation 不进端口”。
- **推论**：agent 只依赖 kernel/base 与 ui/base（R-01），且“全部经 selector 读数据”（Dexter 裁定、TR-03 2026-10-02 段禁止新增 getter/snapshot 读面），因此它现在拿不到 displayId。R-11 的“设备身份、surface 列表”同样没有说明来自哪个 selector。要实现只能扩 display-context 读模型、直接读 DevicePort，或交给 driver 侧。对象写成“取自 dual-screen 适配层的设备事实”，归属也写错了：真正的来源是 DevicePort。
- **分类**：CONFIRMED。
- **最小修复**：R-09 改为“surface 到 displayId 的映射由详设在两种来源中选一：扩展 display-context 公开 selector，或由 driver 侧经 `dumpsys display` 取得；不得新增端口或 getter”。R-11 的每项运行信息注明来源（selector 或 runtime 描述），runtime `descriptors` 不属于业务数据，写明这是允许的例外。只改来源说明，不新增能力。

### S-2 · R-05 没有定义“公开 selector”，“每个包在 runtime 登记”对非 runtime 模块不成立

- **位置**：R-05 第 123-132 行、F-3 第 320 行、V-05。
- **证据（仓内事实）**：全部包 `export const|function select*` 定义约 55 个（逐包计数：store-basic 12、terminal-data-client 5 等）。其中有不读 state 的纯函数 helper：`ui/base/admin-shell/src/foundations/adminSectionSelection.ts:80` 的 `selectAdminSections(catalog, context)`、`ui/base/integration-assembly/src/foundations/stateSyncSlices.ts:12` 的 `selectStateSyncSlices(slices)`、`integrationAssembly.tsx:169` 的 `selectPartsForSurfaceForm`、`kernel/base/ui-state/src/foundations/catalog.ts:117` 的 `selectAvailableParts`。admin-shell、integration-assembly、primitives、render、input 都没有 runtime module 定义（grep `commandDefinitions|stateSlices:|AppModule` 为空），无从“在 runtime 中登记”。`kernel/feature/store-basic/src/selectors/selectors.ts:49` 的 `selectStoreBasicTopicState(root, topicKey)` 带业务参数。
- **推论**：R-05 的机械门要“从公开面识别 selector”，又禁止关键词匹配。可是现在唯一的识别线索就是 `select` 前缀，而这个前缀会误收上述 helper。F-3 是对现有 selector 的盘点，属于详设输入，不需要放进实施 CP。
- **分类**：CONFIRMED。
- **最小修复**：R-05 定义“公开 selector = 签名为 `(state: StateRoot, args?) => value`、从 runtime 模块包根导出的函数”；非 runtime 模块的包不在登记范围，或注明随所属 module 登记。门的口径可选“经 `defineSelector` 定义即登记”（§1 替代 2）。F-3 移入详设。只需补一个定义，不必改架构。

### S-3 · R-07 要求“参数非法”时拒绝，但 runtime 没有 payload 校验

- **位置**：R-07 第 157 行、V-07。
- **证据（仓内事实）**：`kernel/base/runtime/src/types/command.ts:53-71` 的 `CommandDefinition`/`DefineCommandInput` 没有 payload schema，类型约束只在 TS 编译期；`createRuntime.ts:460-474` 与 `createCommandDispatcher.ts:513-523` 只拒绝“未注册”和“public 缺 requestId”（抛异常，不返回结果），深度超限经 journal `command.depth-rejected`。
- **推论**：WS 传入的 JSON 不会被校验，形状错误的 payload 会直接到达 actor。“参数非法”需要为全部 command 补 payload 形状声明，这是隐性范围；R-05 要求 selector 声明参数形状，command 却没有同等要求。
- **分类**：CONFIRMED。
- **最小修复**：二选一写进 R-07：删除“参数非法”，只保证“未注册/缺 requestId/深度超限”的拒绝原因，以及“抛出的异常被转换为明确拒绝推送”；或明确扩展 command 定义的参数形状声明，并列入范围与代价。前者更小，推荐前者。

### S-4 · R-04 第 4 条新增本机 admin 可见指示，属 UI-bearing，却未声明 UI 适用性

- **位置**：R-04 第 116 行、V-04。
- **证据（仓内事实）**：TR-13 要求每个 `ui/integration` 集成共享 admin console（`ui/base/admin-shell`）。CLAUDE.md 的“UI 与交互强制自问”要求逐项回答，journey 模板 §6 要求声明 `UI_BEARING`。
- **推论**：放在哪个 admin 页、是否显示完整地址（地址可能含内网信息）、文案、testID 都没有来源，详设只能自行发明。
- **分类**：CONFIRMED。
- **最小修复**：在 R-04 写明 `UI_BEARING=true`（仅此一处），指定 admin 页面与显示字段；或请 Dexter 确认“只读一行状态”可免交互工件。不需要整套 IA。

### S-5 · R-16 的 runner 分母没有判据，已知清单漏了同类文件

- **位置**：R-16 第 261-271 行、V-16。
- **证据（仓内事实）**：`scripts/test/` 另有 `ter-admin-display-android.mjs`、`ter-admin-display-web-stage.mjs`、`ter-persist-kv-prechange-android.mjs`（含 .test）；`tools/terminal-sample2/` 有 `run-a9-runtime.mjs`、`run-u8-release-cold-start.mjs`、`check-behavior.mjs`、`check-u8-focused.mjs`；`tools/terminal-topology/` 有 9 个辅助模块，`scripts/test/terminal-topology-*.test.mjs` 引用 testID；`scripts/test/terminal-client-dev-acceptance.mjs` 是 TDC 受管入口。两个 App 的 `App.tsx:10,18-19` 在生产代码中挂着只服务键盘 runner 的 `ter-vk://` harness。
- **推论**：`ter-persist-kv-prechange-android` 是否算“runner”直接关系到 TR-04 的重启测试能力；harness 若不随 runner 删除，会留下无人使用的测试钩子。“全部”与“已知范围”之间没有判别式（DESIGN_GAPS G-1）。
- **分类**：CONFIRMED（遗漏事实）；判别式归 Dexter 或详设。
- **最小修复**：R-16 给出判别式（例如“驱动 UI 或设备完成旅途/场景的入口及其专用辅助、App 内专用钩子”），列出上述文件逐个判定，并写明“不删 TR-04 重启证明能力，除非新栈已覆盖”。

### S-6 · R-15 误述“其余调试面仍按原规则剔除”，且扫描门禁用词并不覆盖它们

- **位置**：R-15 第 250 行、V-15。
- **证据（仓内事实）**：`ui/base/render/src/components/SystemFailureBoundary.tsx:20-26` 的 `ter-failure://` 由 `__DEV__ || EXPO_PUBLIC_TER_DEBUG_FAILURE_INJECTION === 'true'` 运行期决定，代码照常进产物。`application/android/sample-terminal/App.tsx:10,18-19`（wallpaper App 同形）在生产 App 中无条件挂 `ter-vk://` harness。`tools/terminal-sample2/check-production-bundle.mjs:8-17` 的禁用词不含 `ter-vk`/`ter-failure`。该门除自测外无人调用（grep 亲验，对象也承认）。
- **推论**：这两个钩子今天就不符合 TR-08。对象把它们写成“仍按原规则剔除”的例子，Dexter 会误以为改写后的 TR-08 仍有门在守。V-15 的“其余禁用词仍生效”只能由门的自测证明，证明不了产物里真的没有。
- **分类**：CONFIRMED。
- **最小修复**：R-15 改写为“其余调试面仍受 TR-08 约束；现状 `ter-failure://` 为运行期开关、`ter-vk://` harness 常驻，二者的处置为 ……（随 R-16 删除 harness，`ter-failure` 列入 HANDOFF 或本批修正）”。V-15 写成“门自测”档。只改事实陈述与处置归属。

### S-7 · R-17 的旅途分母与“现有冻结旅途”不一致，前提链未写

- **位置**：R-17 第 277-297 行、§7 I-1、V-17。
- **证据（仓内事实）**：`tools/terminal-sample2/run-sample1-frozen-journey.mjs:39-44` 的 case 集合是 `normal、reject-retry、abandon、withdraw、hand-back、render-smoke、keyboard-alpha-probe`，其中 `withdraw` 与 `render-smoke` 只在 dual 形态。R-17 按 2026-09-03 需求 §4.3 矩阵取行，矩阵不含双屏“撤回”（它在 §4.4 差异表“撤回”行，属双屏形态），R-17 也没有把它列入待重写清单。`ui/integration/sample-console/src/assembly/assembly.tsx:178-205` 现已装配 terminal-activation、TDC、store-basic、topology，晚于该矩阵的冻结日期。
- **推论**：Dexter 认可的是“sample-console（单机双屏）的现有冻结旅途”，R-17 实际换成了矩阵，并丢了一个双屏专属路径。开机是否仍直达 `staff-login`、是否需要终端激活或 DEV 后台、店员账号来源（`kernel/feature/sample-staff-session/src/features/actors/actors.ts:22` 为本地常量）都没有写成前提链。若需要 DEV，就涉及昂贵动作授权。
- **分类**：PARTIALLY_CONFIRMED（case 差异已证；开机首屏与 DEV 依赖为 `UNVERIFIED_REQUIRES_EVIDENCE`）。
- **最小修复**：R-17 以冻结 runner 的 dual case 集合为分母（或说明为何以矩阵为准），把 `withdraw` 明确放进首个旅途或待重写清单；按 journey 模板 §3 补一张前提表（激活状态、后台依赖、店员凭据来源）。

### S-8 · 与在途 Rive 软键盘需求冲突；键盘例外本可当场关闭

- **位置**：R-08 第 174-178 行、R-14、R-16。
- **证据（仓内事实）**：`ui/base/input/src/components/VirtualKeyboard.tsx:239-250、273-284` 的键已由 `PrimitiveButton` 渲染，所以 §4-C 的例外文字（terminal-coding-standard.md:900-902）已经过时。`doc/plans/platform/2026-09-30-ter-rive-soft-keyboard-requirements-claude.md` 第 44、132、172-176、222-225 行规划由 Rive 命中、逐键 marker 不拦截触摸、交接期 testID 前缀 `outgoing/`、`incoming/`，并依赖待删的三个 runner。
- **推论**：Rive 方案落地后，键不再是带回调的 primitive，语义动作与“经 primitives 自动注册”都失效，`outgoing/` 前缀也与 R-14 的格式冲突。两份需求互不引用。
- **分类**：CONFIRMED（冲突事实）；两者谁先、谁让路是 `DEXTER_DECISION`。
- **最小修复**：R-08 直接写入当前事实（键是 PrimitiveButton，随 primitives 注册，§4-C 例外随本批改写），删掉条件分支；增加一条“与 Rive 软键盘需求的关系”：marker 节点的注册方式与 testID 格式以本需求 R-14 为准，或待 Dexter 裁定。

### S-9 · 不脱敏的 selector 返回值进入 driver 日志与报告，与 AGENTS.md 日志红线未调和

- **位置**：R-05 第 128 行、R-13 第 229 行（失败报告含“最后收到的相关推送值”）、R-04“令牌不得写入日志”。
- **证据（仓内事实）**：AGENTS.md:89 与 kernel 05 `OBSERVABILITY_REQUIRED_FOR_ACCEPTANCE` 规定安全敏感路径不得记录 password/hash、OTP、token、cookie 等。Dexter 裁定 D4 是“不做任何处理不脱敏”（对象第 30 行）。
- **推论**：D4 明确覆盖 selector 的返回值。它是否也覆盖 driver 落盘的日志、报告和截图，原话没有说。对象只对会话令牌规定“不得写入日志”，对推送值没有规定。按现文实施，凭证类推送值会原样进入受管运行产物。
- **分类**：`DEXTER_DECISION`（D4 的作用范围）。
- **最小修复**：在 R-13 写明二选一并请 Dexter 确认：（a）D4 只管协议返回，driver 落盘时按 AGENTS.md 脱敏；（b）D4 扩展到测试产物，作为 AGENTS.md 日志红线的具名例外写入 decision。不必为此新增脱敏框架。

### S-10 · §3 的可行性准入要么做不到“先行”，要么不可能失败；破坏性步骤没有排在准入之后

- **位置**：§3 第 312-323 行、§8 第 394 行、V-09。
- **证据（文档内事实与推论）**：F-1 的判据要求“由注册表记录的按下事件确认”与“误差不超过 1 物理像素”。R-08 没有要求注册表记录按下事件及其坐标。没有触点坐标，就测不出像素误差。1 px 这个阈值没有出处（讨论稿 K1 只写“1 px”）。F-1 依赖 R-08/R-09 已实现，所以“第一个 CP”实际上要建好注册表和 bounds，不是轻量准入。F-4 的“渲染结果一致”没有可观察定义，“耗时有实测数据”没有上限，因此不可能失败。F-3 是盘点，属于详设输入（见 S-2）。F-2 涉及 Web，但没有按 TR-16 写明 Web 先于设备。
- **推论**：spike 跳过后，§3 是唯一的风险闸，但当前写法是一个“可以永远通过”或“必须先实现大半才能判”的闸。对象也没有要求 R-14 与 R-16 排在 F-1～F-4 和 R-17 两端通过之后，所以失败时可能留下“旧 runner 已删、新栈不通”。
- **分类**：CONFIRMED。
- **最小修复**：F-1 判据改为“注册表记录按下事件及其 nativeEvent 坐标，与 agent 给出的目标坐标之差不超过 N px（N 由详设给出依据）”，并在 R-08 增加对应能力；F-4 给出可证伪的判据（开关开/关两份截图逐像素一致，或明确只测耗时并写上限来源）；F-3 移入详设；§8 增加“R-14、R-16 在 F-1～F-4 与 R-17 两端通过后执行”。

### S-11 · 真实输入通道与连接方式、Web 双 surface 定位不一致

- **位置**：R-03 第 97 行、R-02 第 88 行、R-10 第 193-195 行、R-14 第 236 行。
- **证据（仓内事实）**：Expo Web 的 test-expo 在同一 DOM 中同时渲染两块 surface（`ui/base/dev-host/src/components/testExpoApp.tsx:465、480` 的 `…:surface:PRIMARY` 与 `…:surface:SECONDARY`），两块屏会出现同名 testID（`ui/base/render/src/components/SurfaceRoot.tsx:159` 的 `ui-base-render:surface-root`）。R-14 规定 surface 不写进 testID。
- **推论**：Playwright `getByTestId` 在 Web 上会命中两个节点，R-10 没有规定按 surface 容器限定 locator。R-03 允许连接远端服务器且“不依赖 adb”，R-02 说连接成功即可用全部基础能力；但 Android 真实输入只能走 `adb shell input`，所以远端模式只剩语义动作，而 R-17 要求真实输入。
- **分类**：CONFIRMED。
- **最小修复**：R-10 增加“Web 真实输入的 locator 须限定在所属 surface 容器内”；R-03 写明“不经 adb 的连接只提供 agent 侧能力，Android 真实输入需要 adb 通道”。两句约束即可。

### S-12 · 单批范围远超半小时可核量（需 Dexter 裁决是否切分）

- **位置**：§8 第 393 行、§6 代价段。
- **证据（仓内事实）**：testID 共 795 处，分布在 115 个源码文件，另有 35 个测试文件和 scripts/tools 下约 20 个文件引用；约 55 个 `select*` 分布在约 15 个包；runtime 模块契约要改；要删约 20 个 runner 及辅助文件；规范要改 TR-08、§4-C 与 testID 例子段；另有 skill 与两端双屏旅途。验证治理 §5 与 CLAUDE.md 要求超过半小时可核量先切小；`TER_SAME_GOVERNANCE_AS_MAIN_REPO` 记忆写明正确读法是“R 的范围要定得足够小”。
- **推论**：批次原子交付禁止拆开同一批的复核，但没有禁止 Dexter 把范围定小。spike 已跳过，风险集中，更应该小批。
- **分类**：`DEXTER_DECISION`（范围已由 Dexter 认可推荐项）。
- **最小修复**：把切分方案作为一条待裁项写进 §7（见 §1 替代 3）；若 Dexter 维持单批，§8 写明接受超量复核的理由。不改任何能力要求。

### N-1 · “check-static 中硬编码的节点数”位置不对

R-01 第 72 行。`tools/terminal-skeleton/check-static.mjs:647-650` 明确不冻结总数；真正写死的是 `tools/terminal-skeleton/verify.test.mjs:149`（`expectedLintPackages.length, 31`）与 `check-static.test.mjs:34`（批一 13 个节点）。`skeleton-graph.ts` 现有 34 个节点。CONFIRMED。修复：改指这两处。

### N-2 · R-04 的令牌方向与“只限制谁能连上”的说法不符

R-04 第 111-118 行、§6 第 379 行。按 R-04 第 2 条，令牌由 App 携带、driver 校验，只能防止陌生 App 连进 driver，不能防止有人控制终端：谁能占用配置地址（主机端口、DNS），谁就能下指令；令牌写在 package.json，会随 bundle 和仓库一起分发。该改写的是表述，安全取舍已由 Dexter 接受，不重开。推论 + 仓内事实。修复：把“只限制谁能连上”改为“令牌只认证 App；终端侧的安全前提是配置地址可信，非 localhost 时还有 wss 证书校验”。TR-08 原反例“存在但默认不启动”在本例外中被接受，也写明。

### N-3 · “可读出终端凭证”与现状不符

§6 第 378 行、V-05“敏感值原样返回”。现有公开 selector 不返回凭证本体：`kernel/base/terminal-data-client/src/selectors/selectTerminalDataClientState.ts:17-37` 只给出 terminalRef、storeRef 等。凭证在 slice 内（`terminalDataClient.ts:18,171`），但 TR-03 禁止按键读取。CONFIRMED。修复：改为“若有 selector 返回敏感值则原样返回”；V-05 的敏感值场景需要先指明对象 selector。

### N-4 · R-12 的“与 scripts.execute 无关”只在今天成立

当前仓内没有 `scripts.execute`（grep 为空）。T-11 要求将来支持它且远端下发不设限；一旦它以 command 形式登记，R-07 的“可分发任何 command”就构成远端执行脚本的通路。推论。修复：在 R-12 补一句后果说明，交 Dexter 知悉，不改能力。

### N-5 · 讨论稿中的三项在正式稿消失且无处置

讨论稿 §5.6 末条（开关打开的 bundle 可能经 HOT 下发）、§8 K7（系统对话框等非 React 界面，必要时 uiautomator 兜底）、§10（spike 不过时改用 Appium 作设备输入的选项）。正式稿 §3 改为“不得用降级方案绕过”，与 §10 的选项口径不同。修复：逐项写“保留/放弃/待 Dexter”。

### N-6 · V-06“agent 不读 full state”与“不阻塞 UI 线程”不可证

selector 求值必须拿到 state；TR-08 现行文字把 `runtime.getState` 列为调试入口。若没有“runtime 按名求值”接口，就无从证明 agent 不读 full state。Web 上 JS 线程就是 UI 线程，“不阻塞”需要可测的定义（例如单次推送计算耗时上限）。修复：R-06 写明经 runtime 按名求值接口访问；把“不阻塞”换成可测判据。

### N-7 · 措辞与门的落点

R-08 的“业务组件零改动”与 R-14 的全量改 testID 字面冲突，应改为“注册零改动”。R-05、R-14 两道新门未写明是否接入 `scripts/verify`、是否过“建门三问”（验证治理 §3）；R-05 门由 Dexter 裁定，R-14 门由作者提出。修复：补一句门的落点与三问结论。

## 4 · SAME_ROOT_SCAN

- M-1：对照全部 TER 在途计划与入口说明（grep `run-dual-device|ter-admin-display-web|ter-virtual-keyboard-android|run-sample1-frozen|ter-persist-kv-prechange` 在 doc/plans、doc/decisions、doc/platform、scripts/README.md、.agents）。仍处于实施期的只有 2026-10-02 激活交互批（已判）；2026-09-30 Rive 键盘为草案（S-8）；其余 9 月计划为已收口的历史，不判冲突。
- M-2：检查 R-13、R-16、R-17、R-18、§3 中所有动态执行面（V-02/03/04/06/07/08/09/10/11/13/17/18 含 A 或 W），均未要求受管运行；已全部计入。
- S-1：agent 需要的全部非 selector 读面已逐项核查：displayId（缺）、surface 列表（render/display-context 有 surfaceKey）、设备与 App 身份（来源未写）、runtime descriptors（runtime.ts:46 有，非业务数据）、注册表（agent 自有）。
- S-2：已逐包计数全部 34 个包的 `select*` 导出；纯函数 helper 共 4 处，已列出。
- S-3：runtime 的拒绝路径已核对 3 类（未注册、缺 requestId、深度超限），不存在 payload 校验。
- S-5/S-6：`scripts/test/ter-*`、`tools/terminal-sample2/*`、`tools/terminal-topology/*`、App 内 `ter-vk`/`ter-failure` 钩子均已列出并逐个判定。
- S-11：同名 testID 跨 surface 的已知实例 `ui-base-render:surface-root` 一处；其余由 R-08 盘点。

## 5 · TEMPLATE_COVERAGE（需求阶段适用口径）

- journey-decision：§1 元数据 缺（无 `UI_BEARING`、`CORPUS_VERSION`）· §2 用户任务 有（§0.1，actor 为写旅途的工程师/agent，隐含）· §3 逐 actor 前提链 缺（S-7）· §4 边界/非目标 有（§5），禁推/禁止伪修复 缺 · §5 Corpus 缺（应写 `NO_CORPUS_ENTRY_MATCHED`）· §6 UI 适用性 缺（S-4）· §7 Dexter 裁决 有（§0.2）。
- ia-design：整体 NOT_APPLICABLE（无业务页面）；例外是 R-04 admin 指示，§2 可见维度 缺（S-4）。
- ui-interaction-design：整体 NOT_APPLICABLE；admin 指示的 §4 线框与 testId 清单 缺（S-4）。
- implementation-design（需求阶段可核的节）：§1 方案比较 有（§6 引讨论稿 §6，缺本文自己的“选 C 不选 A/B，因为”一句，也缺 §1 的三项替代）· §3 第三方依据 有（U-2 延后到详设）· §3a NOT_APPLICABLE（无浏览器 L2；testID 前置复核在详设阶段适用）· §10/§10b NOT_APPLICABLE（无迁移、无 seed）· §11/§11a 有（§4 V 表，每条 R 都有 V；V-05/V-06/V-15 的判据见 N-3/N-6/S-6）· §12 未决 有（§7）· §13 停机条件 有（§3），判据缺陷见 S-10 · 其余节 NOT_APPLICABLE 至详设。

## 6 · 未验证清单

- 静态已证：§3 各 finding 所引仓内事实。
- 测试已证：无（本轮不运行）。
- 无人验证：副屏 Presentation 的密度与坐标换算（F-1）；WS 重连（F-2）；开关开时的渲染与性能（F-4）；首个旅途在当前 sample-console 上的开机首屏与后台依赖（S-7）；Maestro/Detox/Appium、RNW、Playwright 的版本事实（讨论稿快照，对象 U-2 已延后）。

## 7 · 交给作者与 Dexter

- 作者可在本轮范围内直接修：M-2、S-1～S-8、S-10、S-11、N-1～N-7。
- 需 Dexter 裁决：M-1 的排序方式、S-8 两份键盘需求的先后、S-9 的 D4 作用范围、S-12 是否切批。
- 第 2 轮应定向核对上述修订，并复核 M-1 的排序条款是否与激活批计划的 V-20 分母一致。

