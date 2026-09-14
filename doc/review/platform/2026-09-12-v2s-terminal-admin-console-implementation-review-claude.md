# TER admin console 实施独立评审 — Claude

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
REVIEW_CYCLE_ID=TER_ADMIN_CONSOLE_IMPLEMENTATION_20260912
reviewerKind=CLAUDE_INDEPENDENT
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=1/2/3
```

## 0. 会话出处、方法与利益冲突

- **会话出处（事实）**：v2s-rooted **续接会话**（上下文经摘要接续），**不是 fresh acceptance**。
- **方法（事实）**：本轮按 `1-A 代码提取` 重开 owning source 逐行核验，并做同根全集扫描。**我未执行任何构建、测试、静态门、Web、Android、native、DEV、seed、UAT 或部署命令**——这是我在本仓的既定分工（跑验证属 Codex 职责），因此本报告的档位一律记为 `static`（源码与文档对账）。凡我未亲自运行的结果，一律按作者自报处理并单列为未验证，不计入我的 PASS。
- **利益冲突（事实）**：需求正本与三份历史设计评审由我撰写；被评审的实现与证据文件由 Codex 撰写。对实现我独立；对需求条款本身我不独立，`M-01` 的判据出处是我自己的需求，我按事实报告。
- **未采信项（事实）**：历史设计 review、作者 intake、`CODE_DESIGN_RECONCILIATION=MATCHED`、focused PASS 与 evidence 中的 `MATCHED` 均未作为本轮结论依据。

## 1. 结论

`GO_WITH_UNVERIFIED_UI`，`1M / 2S / 3N`。

实现质量高于我预期。我上一轮设计评审的 `S-A`（identity effect 按对象引用比较）被**双重解决**；`M-A` 的自闭方案在源码中真正落地且**未引入 render→admin-shell 反向依赖**；系统键盘退役、null-ref 虚拟聚焦、loading 指示器、九字段 catalog、物理 index 链路、生产 section 注入全部经源码亲验成立。证据文件是我在本仓见过的最诚实的一份——`A-20` 自报 `NOT_RUN`，`A-18/A-19` 自报 `PARTIALLY_EXECUTED`，native 历史失败原样保留在 §9.2。

唯一的 M 不是"代码错了"，而是**本批最核心的机制在生产入口上仍未被证明、且以当前声明结构上不可证明**：form 维度在 21 处生产与测试声明中**全部双形态全开**，过滤在生产路径上没有任何区分力。这恰是需求 `CT-4` 为消除"形态过滤生产零消费"而设立的缺陷类，在加了九字段之后以另一种形态复现。

`L3_UNVERIFIED` 非空（Web/release/visual 全未跑，Android 仅 primary debug 局部，59 条判据中 26 条部分执行、8 条未执行），因此按 review-standard 只能给 `GO_WITH_UNVERIFIED_UI`。

## 2. findings

```text
[M-01] severity=M
status=CONFIRMED
fact_type=仓内事实（枚举与定位）+ 推论（可证伪性影响）
location=apps/terminal/ui/base/admin-shell/src/parts/parts.ts:8,22,36,49,62；apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:58；apps/terminal/kernel/base/ui-state/src/foundations/catalog.ts:158；对照 kernel/base/ui-state/test/acceptance.test.ts:329,348,379
failure_scenario=同根全集扫描：全仓 definePart 调用块共 22 处（admin-shell 4、sample-member-desk 9、sample-staff-auth 3、sample-console 1、render 测试 5）。其中 21 处显式声明 surfaceForm，第 22 处（render/test/catalog.test.ts 的 count-part）经 ...partInput() 展开继承——**其余 21 个已检查，全部声明为 ['laptop','mobile'] 或等价的 allForms，无一处限制形态**。全仓唯一带形态限制的 catalog 条目是 ui-state 验收测试里的三个合成对象。因此 catalog.ts:158 的 entry.surfaceForm.includes(context.surfaceForm) 在生产上永远为真：把该子句删除、或整体改为 return true，全部生产测试仍绿。U-12 用 createUiCatalog([{partKey:'mobile-only-layer',...}]) 这一**自造夹具**证明了谓词本身，但没有证明生产接线。
impact=需求 CT-4、§3.1.7、A-20、A-43。九字段 catalog、ui-state surfaceForm slice、selectSurfaceForm 选择器与 22 处声明改动，目前在生产上改变零行为。作者在 evidence §6 自报 A-20=NOT_RUN，§10.4 自报"mobile-only 形态仍未在 Android 执行"——我的独立结论比这更强：以当前生产声明，A-20 **不是未执行，而是不可执行**。
minimum_fix=给 sample.console.admin-test 单一形态声明（它本就是需求指定的 A-18/A-20 对象，且只是标题占位，限制它无产品代价），然后在两种形态下经生产 assembly 各跑一次，断言 laptop 下该 section 不出现在导航中且产生可观测拒绝。为什么更小不够：U-12 那类 kernel 夹具证明的是纯函数，不是"生产 definedParts → 生产 catalog → 生产 admission/render"这条链；而证明这条链正是 CT-4 存在的全部理由。仅在文档里标注 OPEN 也不够，判据不能只靠文字断言。
dexter_decision=NO（需求已指定对象与判据，属执行范畴）
```

```text
[S-01] severity=S
status=CONFIRMED
fact_type=仓内事实
location=apps/terminal/ui/base/render/src/foundations/surfaceHost.ts:57-60；连带 apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx:29；apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx:88-102；apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx:40
failure_scenario=bindSurfaceHostIdentity 的 enrich 在 snapshot.isHostPrimaryDisplay !== (displayIndex === 0) 时直接 lastSnapshot = null 并返回。该模块无 logger，全链无任何诊断。适配器接线错误（双屏 index 与 host 位不一致）时，SurfaceHostController 因 geometry === null 永久渲染 loading 指示器且不渲染 children，表现与"宿主尚未就绪"完全相同、不可区分。同时 SurfaceRoot:29 以 ?? false 兜底，AdminLauncher:40 要求 isHostPrimaryDisplay 为真——于是**诊断工具本身在最需要它的故障态下不可达**。
impact=AC-3A 与"失败可见且原因不得改写"。fail-closed 的方向是对的（伪造 host 位会被拒绝，这一点我确认是优点），问题只在原因不可观测。
minimum_fix=在该不匹配分支产出一个可观测的拒绝原因——最小做法是让 snapshot 携带 typed rejected reason，或由 SurfaceHostController 在"source 存在但持续无 snapshot"时记一条诊断。为什么更小不够：加注释或在文档里写明不改变运行时可观测性，而本条的全部内容就是可观测性。
dexter_decision=NO
```

```text
[S-02] severity=S
status=PARTIALLY_CONFIRMED（机制经源码确认；实际遮挡取决于业务画面，本轮无证据）
fact_type=仓内事实（机制）+ 尚缺证据假设（真实业务遮挡）
location=apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx:41-48,52-61；挂载点 apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:362；层叠对照 apps/terminal/ui/base/render/src/components/LayerStack.tsx:32-40
failure_scenario=AdminLauncher 渲染为 position:absolute、top/left 0、96×96、opacity:0、zIndex:1100 的 Pressable。opacity 为 0 不影响命中测试；handlePress 消费事件且从不转发。它挂在 SurfaceInputFrame 内、{content} 之前，但 zIndex 1100 高于业务内容（LayerStack 为 zIndex/elevation 1000，故 layer 仍在其上，且 hasAdminLayer 为真时 launcher 返回 null——这两点是对的）。结果：admin 关闭时（即常态），PRIMARY 画布左上角 96×96 内的任何业务控件都无法被按下，且失败是静默的。sample 应用该区域恰好为空，所以 clean Android debug 的五击能过；真实业务画面若在左上角放返回键或标识，就会静默失效。
impact=所有 PRIMARY surface 的业务交互。无任何判据覆盖此区域的业务可点击性。
minimum_fix=二选一并写进 Journey：把隐藏热区移到产品保证无交互的区域，或把探测器改为不消费触摸（观察而不拦截）。为什么更小不够：仅缩小尺寸仍然留下死区，只是更难被发现；只加一条测试断言"launcher 可点"也不覆盖"业务在同一区域仍可点"这一相反方向。
dexter_decision=YES —— 问题：隐藏手势入口固定占据逻辑画布左上角 96×96 并吞掉该区域全部业务点击，是否接受？若不接受，热区应改放何处，或是否改为不消费触摸的探测方式？
```

```text
[N-01] severity=N
status=PARTIALLY_CONFIRMED
fact_type=推论
location=apps/terminal/ui/base/admin-shell/src/components/AdminLayer.tsx:30-42
failure_scenario=effect 内先读 previousDisplayMode.current 再写入本次值，因此第 N+1 个 effect 的 cleanup 携带的是第 N 次的 displayMode，语义"落后一拍"而非"本 effect 自身的模式"。我穷举后确认当前**不可达**：displayMode 变化时 LayerStack 按当前 displayMode 选层（LayerStack.tsx:107-109），AdminLayer 直接卸载而不会带新值重渲；同态 identity 变更下 displayMode 本就未变。但该安全性完全依赖 LayerStack 的一条不变量，AdminLayer 内没有任何地方声明它。
impact=潜在，当前为零。若将来 layer 选择跨 displayMode 保留，cleanup 会关错 contentSet 并因 closeLayer 幂等而静默 no-op。
minimum_fix=直接在闭包里捕获本 effect 的 identityDisplayMode，删掉 ref——按构造即正确，且更短。
dexter_decision=NO
```

```text
[N-02] severity=N
status=CONFIRMED
fact_type=仓内事实
location=apps/terminal/ui/base/render/src/foundations/definePart.ts（catalogEntry 字面量中 surfaceForm: input.surfaceForm）
failure_scenario=同一字面量内其余四个数组字段都做了 Object.freeze([...input.X]) 防御性拷贝，唯独 surfaceForm 直接引用调用方数组。parts.ts:8 的 allForms 被四个 part 共享且 as const 不做运行时冻结。经 createUiCatalog 后无影响——canonicalEntry 走 assertStringArray，该函数拷贝进新数组并 Object.freeze（catalog.ts:38-48），所以 catalog 条目确实不可变；仅 definedPart.catalogEntry 在进入 catalog 之前共享引用。
impact=当前为零；一致性瑕疵，且与 A-19"catalog 条目不可变"的阅读容易产生误判。
minimum_fix=与其余四个字段同样处理。更小的做法（只加注释）不够，因为下一个新增字段会重复这个不对称。
dexter_decision=NO
```

```text
[N-03] severity=N
status=CONFIRMED
fact_type=仓内事实
location=apps/terminal/ui/base/input/src/hooks/useInputFocusController.ts:47；apps/terminal/ui/base/admin-shell/src/components/AdminLayer.tsx:46
failure_scenario=默认 focus scope 'business' 在两个包里各写一次字符串字面量，而 admin 侧的 scope 已经是 ADMIN_CONSOLE_FOCUS_SCOPE_ID 常量。任一处拼写漂移会让 preflightFocusTarget 永久拒绝业务字段，且无编译期保护。
impact=当前两处一致，无运行时缺陷。
minimum_fix=把默认 scope 提为与 admin scope 同源的导出常量。
dexter_decision=NO
```

## 2b. `S-02` 裁决与需求变更记录（2026-09-12,交付后）

**根因更正（重要,责任在我）。** 我在 `S-02` 里把浮层写成实施选择,这不准确。我重读需求 `AC-1.5` 第二句——「手势必须挂在一个有稳定 testID 的独立节点上,**不得直接挂在既有 View 的 props 上**」——**这句直接禁掉了 POC 的做法**。实施做成压在业务之上的隐形浮层,是在正确执行我写的条款;真正缺的是"不得拦截触摸"这条约束,我当初没写。`S-02` 的根因是需求缺口,不是实施疏忽。

**POC 对照（Dexter 提示后亲验）。** POC 的 `useAdminLauncher.ts` 返回的是普通事件处理器（原生 `onTouchEnd`、Web `onClick`）,由 `RootScreen.tsx` 以 `{...launcherHandlers}` 展开在最外层 root View 上,业务内容是其子树。`onTouchEnd` 是 RN 的普通 View 属性（`ViewPropTypes.js` 第 131 行）,不参与响应者协商,因此观察而不拦截——这就是 POC 业务正常响应的原因。

**但 POC 有一处不可照抄。** `adminLauncherTracker.ts` 第 17 行 `if (event.pageX > areaSize || event.pageY > areaSize) return false`,拿原始宿主坐标直接与 96 比较,无任何换算。POC 无缩放画布故可用;v2s 有非等比缩放画布,照抄会使手势区域位置与大小双双偏移。该问题我在 POC 分析稿 §4.1 已记录,需求 `AC-1.3` 与判据 `A-4` 本就是为它设的。

**Dexter 2026-09-12 裁决**：按 POC 机制改,并避开 POC 的坐标缺陷,要比 POC 做得更好。

**需求正本已由我（需求 owner）同步**，三处：
- 新增 `AC-1.7`：手势节点必须是业务内容的**祖先包裹节点**,观察触摸而不拦截;明文禁止可命中浮层并写明 RN 命中测试的原因;声明与 `AC-1.5` 不冲突（包裹节点同样是独立节点、同样带稳定 testID、门禁为假时同样不渲染）;并写明 `AC-1.3` 优先于 POC 机制,坐标换算义务不豁免。
- 新增判据 `A-5A`（沿用 `AC-3A` 的字母后缀先例,避免重排 A-6..A-59 波及五份文档与证据文件）：手势区域内放置可交互业务控件,未达阈值时该控件必须收到 press,达阈值仍能开 console;红夹具为"改回可命中浮层或以任何方式消费触摸"。
- §0 沿革记录裁决与理由。

判据总数由 59 增至 60。`A-4`（画布逻辑坐标 vs 宿主窗口坐标）在机制改动后**变得更吃重**：浮层方案下 `locationX` 天然是画布逻辑坐标,该判据近乎免费;改为祖先观察后必须真做 page→logical 换算,`A-4` 成为该换算的唯一红夹具,其当前 `NOT_RUN` 状态不可再顺延。

`S-02` 状态改为 `RESOLVED_BY_RULING；待实施`。

## 3. 被我亲验后推翻的结论（含我自己的）

1. **我自己的怀疑：`accessibilityRole="status"` 与已修的 `textbox` 同族。** 推翻。我先确认 RN 0.86.3 的 `AccessibilityRole` 联合类型确实不含 `'status'`，随后打开 `apps/terminal/ui/base/primitives/src/components/PrimitiveText.tsx:11-14`：该处有明确注释并把值落到 RN 的 ARIA `role` prop 而非 `accessibilityRole`；再核 RN 的 `Role` 类型，确实包含 `'status'`。注释属实，实现正确，**撤回**。
2. **我自己的枚举：`count-part` 缺 `surfaceForm`。** 推翻。是我的块解析器假阳性，该调用用 `...partInput()` 展开，字段存在。22 处调用点**全部**带 surfaceForm。
3. **我上一轮设计评审的 `S-A`（identity effect 按对象引用比较）。** 已被双重解决，撤回：`AdminLayer.tsx:42` 的依赖数组是 `[surfaceKey, displayIndex, surfaceForm, identityDisplayMode]` 四个原始值；且 `surfaceHost.ts:47,64` 把 identity 冻结一次并在每个 snapshot 中复用同一引用，引用本身也稳定。
4. **作者 evidence §6 的 `A-20=NOT_RUN`。** 不是推翻而是**加强**：以当前 21 处全开声明，A-20 并非"未执行"，而是**不可执行**。见 `M-01`。

## 4. 经亲验成立的部分（重开源码，非采信报告）

- **跨包数据流**：`assembly.tsx` 的 `surfaceHostSourcesByDisplayIndex?.[surface.displayIndex]` 按物理 index 取源；`bindSurfaceHostIdentity` 冻结 `{surfaceKey, displayIndex, surfaceForm, displayMode}`；`webSurfaceHost.ts:27` 的 `isHostPrimaryDisplay: input.displayIndex === 0`；Android `surfaceHost.ts:171` 同口径校验；`SurfaceRoot.tsx:29` 以 `?? false` fail-closed。**未发现由 displayMode、instanceMode 或 Web 硬编码伪造 host 位的路径。**
- **loading**：`SurfaceHostController.tsx:88-102` 为 `accessibilityRole="progressbar"` 容器加 `PrimitiveSpinner`，children 不渲染。旧的空 View 已消失。
- **catalog 九字段**：`types/catalog.ts`、`approvedEntryKeys`(catalog.ts:18-28)、`canonicalEntry` 重建字面量(catalog.ts:86-97)、`definePart` 的 `Pick`(definePart.ts:12-24) 与其 catalogEntry 字面量，**五个构造/校验点逐字一致**。
- **layer-only 与 section 区分**：`parts.ts:12` 的 `layerContainer = []` 与 `:13` 的 `sectionContainer = [ADMIN_SECTION_CONTAINER_KEY]`；`selectAvailableParts` 与 admission 复用同一谓词。
- **四节同一生产 catalog**：`createSampleDefinedParts()` 合并 `adminShellAssembly.parts` + 两个 feature assembly + `sampleAdminTestPart`，单一 `createUiCatalog`/`createRendererCatalog`。`includeSampleAdminSection=false` 分支即 A-18 的移除证明，走**同一生产 assembly**，非另造夹具。
- **无第二注册面**：`adminSection`/`AdminSectionMetadata`/`orderKey`/`sectionOrder` 全仓零命中；section 顺序取 `sections[0]`（AdminShell.tsx:47-49），即过滤后 catalog 列表顺序，与裁决一致。
- **admin 生命周期**：`ADMIN_CONSOLE_LAYER_ID='admin.console.layer'` 与 partKey 分离；开（AdminLauncher.tsx:23）与关（AdminLayer.tsx:39,53）用同一常量；cleanup 覆盖同态变更与旧 mode 卸载两条路径；用既有 `closeLayerCommand`，无回调/事件总线；`SurfaceRoot` 无 key/remount；全链无 `clearLayers`。`closeLayer` reducer 的 `if (index < 0) return` 与 `completeWrite.ts:17` 的 `!changed` 分支共同保证冗余关闭无副作用。
- **skeleton 三条新边**：`render→primitives`、`admin-shell→display-context/input`、`sample-console→admin-shell` 均已入图；**无 render→admin-shell 反向边**。
- **系统键盘退役**：`showSoftInputOnFocus` 全仓 6 处——`slots.tsx:19` 的 `Omit` 把它移出调用面、`slots.tsx:58` 的固定 `false`，其余 4 处均为断言 false 的测试。`PrimitiveInputProps` 无该 prop。**其余构造点已检查，无任何路径可重开系统键盘。**
- **native-less 聚焦**：`useInputFocusController.ts:128-139` 在 ref 为 null 时走 `handleFocus(fieldId)` 提交键盘状态，`completeField:141-157` 同规则；`preflightFocusTarget:46-47` 按 scope 比对并在 suspended 下只拦 `'business'`。单一 `InputController` 管线。
- **设备标识与口令**：`assembly.tsx:202` 全局 await 一次 `getDeviceInfo`，结果交同步纯函数；`verifyAdminPassword` 在 `available===false || deviceId===null` 时才接受 `123456`；`describePlatformPortCapabilities` 为方法级。admin-shell 内**零 logger 调用**，assembly 只记 `available` 布尔，未发现原始 deviceId、口令或 token 进日志。
- **调试态**：`resolveDebugMode` 为 `startup ?? packaging ?? false` 且 source 三值优先级正确（含 `startup:false` → `enabled:false, source:'startup'`）；debug 事实链**不含 `__DEV__`**，不会被 dead-code elimination 消除。
- **section 切换真实换内容**：AdminShell.tsx:50-56 由 `activePartKey` → `activeEntry` → `rendererCatalog.resolve` → `<ActiveSection>`，不是只改高亮。

## 5. 方案合理性

**问题对不对（产品判断）。** 对。"不离开业务画布查看可信的本机只读诊断事实"是真实运维任务，Journey 的五个动作逐一对应 Dexter 的裁决。

**更简单的替代（我自己构造并比较）。** 三个：
- *单一静态诊断页*：最省，但 Dexter 明确要求业务包能把管理页注册进框（Q-7），静态页做不到，且切到独立页会离开业务画布，与任务冲突。
- *直接复用现有 layer 内容、不走 catalog*：省掉九字段与 projection，但会产生第二份 section 列表，正是 `AC-5` 系列禁止的。
- *host boundary 只传少量事实*：已经是当前做法——UI 只收 `surfaceForm` 与 `isHostPrimaryDisplay`，不索引 host source map。

结论：catalog projection、identity lifecycle、virtual input、dynamic replacement 四项复杂度中，前三项与 Dexter 已裁决的范围直接对应，**配**。dynamic replacement 是 Dexter 后期拉进本轮的，其复杂度主要落在 AdminLayer 的一个 effect 上，代价可接受。

**唯一代价不配的地方**是 `M-01`：为 form 维度付了九字段 + slice + 选择器 + 22 处声明的改造成本，而该维度在生产上目前零区分力。这不是"该不该做"的问题——做是对的——而是**尚未兑现**。

## 6. UI / Journey / 用户路径结论

逐项回答：

- **来源**：launcher（Q-6 入口一律隐藏、只有手势）、keypad（Dexter 第二条六格分框）、Verify、section 切换（第三条 section 不能跳转）、close、reopen 回登录（AC-4 认证瞬时），**六项全部来自已批准 Journey 或 Dexter 明文裁决**。
- **此时操作是否合逻辑**：是。遮罩不暂停业务、不夺焦，符合"边看业务边查状态"的运维态。
- **更短路径**：section 导航是同一 catalog 的投影而非独立列表 owner，四项无多余层级；未发现更短路径。
- **切换/关闭/重开**：源码层面三者都真实（见 §4）；Android clean debug 亦有观察记录，但那是 primary debug 局部，**不外推**。
- **归因**：`S-02` 的热区问题属**产品语义未裁决**（Journey 只说"隐藏入口 + 手势"，未裁定热区位置与是否消费触摸）；`S-01` 属 owner 边界（纯 foundation 无 logger）；其余未见旧文档模糊或历史惯性导致的不合理。
- **不得扩写**：primary debug 截图、欢迎语完整、文本齐全、历史 review GO **均未**被我读成视觉验收。

## 7. 未验证清单（分档）

- **static**：作者自报全门 PASS。**我未复跑**，按自报处理，不计入我的 PASS。我的静态结论仅来自源码对账。
- **focused**：作者有新鲜输出（primitives / admin-shell / sample-console / ui-state / render / runtime）。**我未复跑**。59 条判据的作者自报分布为 `FOCUSED_PASS 13`、`STATIC_PASS 12`、`PARTIALLY_EXECUTED 26`、`NOT_RUN 8`（我独立重数，合计 59）。即**仅 25/59 在其目标档位完整执行**。
- **Android**：`PARTIAL_PASS_WITH_OPEN_BOUNDARIES`。clean debug **primary** 的五击、键盘输入、Verify、四节导航、close/reopen 有记录。**未覆盖**：secondary display 手势、scaled geometry、IME/no-popup、权限与数据清理、真机、protected persistence（`persistSecure.listKeys: adapter not injected` 是真实能力边界，不得静默 catch、不得明文替代、不得写成 admin authentication PASS）。
- **native**：仅 `PASS_FOR_NAMED_KOTLIN_UNIT_TEST`，**不外推** native device 或 Android IME 行为。
- **Web**：`NOT_RUN_OPEN`。
- **release**：`NOT_RUN_OPEN`。
- **visual**：`NOT_RUN_OPEN`。现有 PNG 仅为 raw artifact，无 wireframe、无相似度、无完整视觉 verdict。
- **cleanup**：作者自报 PASS。cleanup PASS **不提升任何其他档位**。
- **N-2**：仅 focused bounded-list（100 行 / 最多 24 挂载）。不构成性能、视觉或真机证明，维持 `UNVERIFIED_REQUIRES_EVIDENCE`。

## 8. 需 Dexter 裁决

1. **`S-02`（产品语义）**：隐藏手势入口固定占据逻辑画布左上角 96×96 并吞掉该区域全部业务点击，是否接受？若不接受，热区改放何处，或改为不消费触摸的探测方式？
2. **证据范围（范围问题，非缺陷）**：`A-14`（业务命令在途时 admin 无法解析）与 `A-16`（持久化快照中不得含 auth/section）两条 `NOT_RUN` 在证据文件中没有给出闭合路径。是本轮补跑，还是显式登记为欠账？

## 9. 结论块

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=1/2/3
L1_ENGINEERING=PASS with M-01（跨包数据流、catalog 九字段、identity 生命周期、输入退役、设备标识/调试态、包边均经源码亲验成立；form 维度在生产上零区分力为唯一工程级阻断）
L2_USER_VISIBLE=findings：S-02（左上角 96×96 隐形热区吞业务点击，需 Dexter 裁决）；S-01（host 位不匹配静默降级为永久 loading，且使诊断工具自身不可达）
L3_UNVERIFIED=Web NOT_RUN_OPEN；release NOT_RUN_OPEN；visual NOT_RUN_OPEN（PNG 仅 raw artifact）；Android 仅 primary debug 局部，secondary 手势/scaled geometry/IME-no-popup/权限与数据清理/真机/protected persistence 全部 OPEN；native 仅 named Kotlin unit test；59 条判据中 PARTIALLY_EXECUTED 26、NOT_RUN 8；N-2 仅 focused bounded-list；static 与 focused 门由作者运行，本评审未复跑
SAME_ROOT_SCAN=M-01：definePart 调用块全集 22 处已逐块解析（admin-shell 4 / sample-member-desk 9 / sample-staff-auth 3 / sample-console 1 / render 测试 5），21 处显式声明 surfaceForm 且全部双形态全开，第 22 处经展开继承同样全开；全仓形态受限条目仅 ui-state 验收测试 3 个合成对象。S-01：isHostPrimaryDisplay 全部 24 处出现点已检查，生产推导点 2 处（Web dev-host、Android adapter）均由物理 index 得出，校验点 2 处同口径，消费点 4 处，其余为测试。S-02：AdminLauncher 挂载点全集 1 处，层叠对照 LayerStack 1 处已检查。N-02：definePart 数组字段全集 5 个已检查，4 个有防御性拷贝、1 个无。N-03：'business' 字面量全集 2 处已检查。showSoftInputOnFocus 全集 6 处已检查（vendor 2 + 测试 4），无可重开系统键盘的构造点。accessibilityRole 取值全集 13 类已检查，'textbox' 零残留，'status' 经 PrimitiveText 落到 RN ARIA role 且该联合类型支持，判定合规
DESIGN_GAPS=A-20 以当前生产声明结构上不可执行（无任何生产 part 限制形态），判据与实现之间缺可执行闭环；A-14、A-16 为 NOT_RUN 且证据文件未给出闭合路径
EVIDENCE_TIER=static：本评审仅做源码与文档对账，未执行任何命令；focused/Android/native/cleanup：作者自报，未由本评审复跑或复核运行输出；Web/release/visual：NOT_RUN_OPEN
```

## 10. 授权边界

本文只是对当前实施的独立评审输入，**不自动成为新权威**。不授权修复、下一 Roadmap step、动态环境、数据操作、部署或任何产品裁决。`M-01`、`S-01`、`N-01`、`N-02`、`N-03` 在既有批准边界内可自主处置；`S-02` 与 §8 第二项需 Dexter 裁决后再动。
