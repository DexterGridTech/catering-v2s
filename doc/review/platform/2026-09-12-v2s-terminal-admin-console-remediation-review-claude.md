# TER admin console 修复后实施独立复审 — Claude

```text
REVIEW_TARGET=IMPLEMENTATION (REMEDIATED BYTES)
REVIEW_CYCLE_ID=TER_ADMIN_CONSOLE_IMPLEMENTATION_20260912
reviewerKind=CLAUDE_INDEPENDENT
VERDICT=GO_WITH_UNVERIFIED_UI（工程层等同 GO;按 review-standard,L3 非空时不得写裸 GO）
M/S/N=0/1/2
```

## 0. 会话出处与方法

- **出处（事实）**：v2s-rooted 续接会话,**非 fresh acceptance**。
- **方法（事实）**：按当前字节重开 owning source 与测试逐行核验,**未执行任何命令**——跑验证是 Codex 的分工。brief 自报的结果、历史 review、focused PASS 一律未作为结论依据;我对 brief 的每一条断言都独立证伪过,其中**两条被推翻**(见 §3)。
- **利益冲突**：需求正本与历次评审由我撰写,实现与证据由 Codex 撰写。

## 1. 结论

`GO_WITH_UNVERIFIED_UI`,`0M / 1S / 2N`。

上一轮的九项待改项我逐条重开字节核验,**九项全部真实落地**,且其中四项的测试质量高于我提出的要求。唯一新增的是一条 `S`:逐轴 scale 的**推导点**在组件级测试中只被等比数据覆盖,而非等比拉伸恰是本产品的定义性属性。

## 2. 逐项核验（重开字节,非采信 brief）

**M-01 — CONFIRMED_FIXED。** `sample-console/src/assembly/assembly.tsx` 第 58 行已收窄为 `surfaceForm: ['mobile'] as const`。`test/sampleAssembly.test.tsx` 第 234 行的用例用**两个真实生产 assembly**（`surfaceForm: 'laptop'` / `'mobile'`,非夹具 catalog）:laptop 侧对真实生产 partKey 派发 `openLayerCommand`,断言 `status==='error'`、`code==='ERR_TER_UI_STATE_LAYER_PART_UNAVAILABLE'`,并断言 `selectLayers(...)` 为空——**state write 前拒绝已证**;mobile 侧挂载、真实手势、真实鉴权后断言该 section 可见。未新增 fixture registry。这条完全满足我原先"经生产入口"的要求。

**S-01 — CONFIRMED_FIXED。** `render/src/foundations/surfaceHost.ts#bindSurfaceHostIdentity` 在不匹配分支改为先调 `onIdentityRejected` 传出冻结的 `{reason:'physical-host-flag-mismatch', displayIndex, expectedIsHostPrimaryDisplay, actualIsHostPrimaryDisplay}`,**随后仍置 `lastSnapshot = null`**——loading/rejection 边界保留,没有被改写成"正常就绪"。测试第 509 行同时断言三件事:`ui-base-render:surface-host-pending` 节点存在、launcher 节点数为 0、日志事件 `surface.host-identity-rejected` 的四个字段。四字段中无原始设备标识。

**S-02 / A-5A — CONFIRMED_FIXED,质量高于要求。** `AdminLauncher.tsx` 现为包住 children 的普通 `View`:第 104 至 112 行无 `Pressable`、无 `position:'absolute'`、无 `zIndex`、无任何 responder 属性,仅 `onTouchEnd`;门禁为假时返回 `<>{children}</>`,children 不丢。测试第 269 行不止查节点形状（`launcher.type === View`、`onPress`/`onStartShouldSetResponder`/`onResponderGrant` 均 undefined、业务控件是其 descendant）,还**真的按了业务控件**并断言 `sample.auth.notice` 出现——这是行为级证明,不是节点存在性断言。这比我要求的更强。

**A-14 — CONFIRMED_FIXED,无自证。** 测试第 538 行用注入平台端口的真实 `displayInfoGate` 卡住第二次 `getDisplayInfo`,先断言 `businessSettled === false` 证明确实在途,再用**真实手势**开 admin,释放 gate 后断言 `result.status === 'completed'`,并断言业务 screen 与 `sample.desk.waiting-confirm`、`admin.console.layer` 三者同时存在。**没有内部 setter,没有伪造完成状态。**

**A-16 — CONFIRMED_FIXED,已防空过。** 测试第 580 行用 `createRecordingStorage` **包住既有** `persistKv`/`persistSecure`,未更换生产 persistence owner。真实手势、真实鉴权、真实选中 section 后先断言 `sample.console.admin-test` 已渲染,再等 350 毫秒（持久化防抖为 300 毫秒）,然后 **`expect(persistedValues.length).toBeGreaterThan(0)`** 再断言两个字符串均不出现。那句长度断言正是防"只检查初始空快照"的空过,已就位。

**N-01 — CONFIRMED_FIXED。** `AdminLayer.tsx` 第 31 至 40 行的 effect 直接闭包捕获 `identityDisplayMode`,`previousDisplayMode` ref 已删除;依赖仍是四个原始值,cleanup 仍走既有 `closeLayerCommand`,同态变更与旧 mode 卸载两条路径都由同一 cleanup 覆盖。

**N-02 — CONFIRMED_FIXED。** `definePart.ts` 第 78 行 `surfaceForm: Object.freeze([...input.surfaceForm])`,与其余四个数组字段一致。

**N-03 — CONFIRMED_FIXED。** `input/src/foundations/focusScope.ts` 单行导出 `BUSINESS_FOCUS_SCOPE_ID`。全仓 `'business'` 字面量扫描:**仅该定义点一处命中**,`AdminLayer.tsx` 第 42 行与 input consumer 均改用常量。

**未重新引入覆盖层或第二调起路径 — CONFIRMED。** `AdminLauncher.tsx` 全文无 `Pressable`/`absolute`/`zIndex`。全仓 `openLayerCommand` 生产调用点已枚举:`ADMIN_CONSOLE_PART_KEY` 仅 `AdminLauncher.tsx` 第 71 行一处;其余 8 处分属 sample-member-desk 与 sample-staff-auth,开的是业务 layer。**其余 8 处已检查,无第二条 admin 调起路径。**

**坐标 origin 路径 — CONFIRMED。** 测试第 115 至 116 行 mock 了 `measureInWindow` 并返回**非零** `LAUNCHER_WINDOW_ORIGIN = {x:100, y:200}`,所以忽略 origin 的实现会被抓住。

## 3. 被我推翻的结论（含 brief 的自述）

1. **brief 的 A-4 数字与实际测试不符。** brief 称 `host=2560×1600` 与 `host=640×400` 构成"双向非等比缩放"。我独立复算:2560/1280=2、1600/800=2;640/1280=0.5、400/800=0.5——**两组都是等比**。而实际 `admin-shell/test/adminLauncher.test.ts` 第 39 行用的是 `{scaleX: 2, scaleY: 1.5}`,**是真非等比**。brief 把纯函数测试与组件级测试的数字混写了,其自述反而低估了自己的纯函数用例、高估了组件级用例。这正是不采信自述的理由。
2. **我自己的怀疑:`assembly.tsx` 第 199 行 `input.surfaceForm ?? 'laptop'` 是第二个 form 来源。** 推翻。需求 §3.1.5 要求"`sample-console` 必须能在启动时选择画布组",§3.1.6 明写"`sample-terminal` 本期只按 laptop 虚拟机运行,但形态必须是**显式参数而非硬编码**,当前 `App.tsx` 只接 `displayIndex`,须补齐"。当前 `App.tsx` 第 23 行已是 `{displayIndex = 0, surfaceForm = 'laptop'}` 的显式入参,链路 `App.tsx → createSampleTerminalAssembly → createSampleAssembly` 逐层显式传递。`A-41` 的红夹具是"从画布宽度断点派生形态",实现没有任何数值比较。**完全符合需求,撤回。**

## 4. S finding

```text
[S-01] severity=S
status=CONFIRMED
fact_type=仓内事实（覆盖枚举）+ 推论（变异存活）
location=apps/terminal/ui/base/admin-shell/src/components/AdminLauncher.tsx#coordinateSpaceOf 第 35-36 行；对照 apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx 第 312 行用例与 apps/terminal/ui/base/admin-shell/test/adminLauncher.test.ts 第 35 行用例
failure_scenario=逐轴 scale 的唯一推导点是 coordinateSpaceOf 的 scaleX = host.width/canvas.width 与 scaleY = host.height/canvas.height 两行。把第二行误写成 host.width/canvas.width（相邻两行的复制粘贴,是这段代码最可能的缺陷）后:纯函数测试不受影响,因为它直接传入 space 而从不调用 coordinateSpaceOf;组件级测试第 312 行两例的画布为 1280×800,host 分别为 2560×1600 与 640×400,我独立复算 scaleX/scaleY 分别为 2/2 与 0.5/0.5,**两例都是等比**,变异后的 scaleY 与正确值相等,**测试全绿**。于是该变异在全仓零覆盖。其后果是纵向手势区域按横向比例判定:在 1280×800 画布配 16:9 之类的真实横屏宿主上,96 单位的纵向边界会被整体缩放错位,手势时灵时不灵且无任何报错。
impact=AC-1.3、A-4。非等比拉伸是 Dexter 为本产品明确裁定的形态（"我要做非等比拉伸,要全屏"）,逐轴独立正是其定义性属性,而该属性在生产推导点上未被证明。纯函数层已用 {scaleX:2, scaleY:1.5} 覆盖,所以概念正确、仅推导点未覆盖。
minimum_fix=把第 312 行两例之一的 host 改成与画布不同宽高比的取值（例如 canvas 1280×800 配 host 2560×1200,scaleX=2、scaleY=1.5）,使组件级至少有一例 scaleX≠scaleY。不需要新增用例,改两个数字即可。为什么更小不够:纯函数层的非等比覆盖无法替代——它绕过了 coordinateSpaceOf,而那正是唯一从 host/canvas 推导两个 scale 的地方;只在详设写明"逐轴独立"同样不够,判据不能只靠文字断言。
dexter_decision=NO
```

## 5. N findings

```text
[N-01] severity=N
status=CONFIRMED
fact_type=仓内事实
location=apps/terminal/assembly/android/sample-terminal/App.tsx 第 23 行；apps/terminal/assembly/android/sample-terminal/src/assembly/platformPorts.ts 第 36 行；apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx 第 199 行
failure_scenario='laptop' 这个默认形态在三层各写一次。链路本身符合 §3.1.6 的显式参数要求（见 §3 第 2 条,我已撤回对它的质疑）,但三处默认值互相独立:改其中一处而漏改另外两处时,外层传参与内层兜底会给出不同形态,且无编译期保护。
impact=当前三处一致,无运行时缺陷。
minimum_fix=保留最外层 App.tsx 的默认,内两层改为必填参数。
dexter_decision=NO
```

```text
[N-02] severity=N
status=CONFIRMED
fact_type=仓内事实
location=apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx#pressLauncher 第 160-165 行
failure_scenario=测试辅助 pressLauncher 调用生产函数 logicalPointFromWindow 算出 pagePoint,仅用于 null 检查,**结果随即丢弃**（第 166 行另行重算同一表达式传给 onTouchEnd）。这是死代码,本身无害;但它让辅助函数依赖了被测的生产转换函数,后续若有人图省事把 pagePoint 直接用作事件坐标,测试就变成用生产函数验证生产函数的同义反复。当前的构造方式（用画布真实 transform 反推 page 坐标）是正确且独立的,不应被这段死代码侵蚀。
impact=测试独立性的潜在风险,当前为零。
minimum_fix=删掉第 160-165 行,null 检查改为对第 166 行实际使用的两个表达式做有限性断言。
dexter_decision=NO
```

## 6. 证据档位

- **static**：brief 自报 `check-static.mjs` PASS。**我未复跑**,按自报处理。我的静态结论仅来自源码与测试的逐行对账。
- **focused**：brief 自报八个包 typecheck 与测试 PASS。**我未复跑**。我核的是**测试内容是否可证伪**,不是它是否通过——§2 逐条给出的是断言形状,不是绿灯转述。
- **Android**：历史 clean debug 证据保留;本轮 remediation **未重跑** A-4 的真实缩放窗口动作。secondary 手势、scaled geometry、IME 与 no-popup、权限与数据清理、真机、protected persistence 全部 OPEN。`S-01` 所指的非等比缺口**不能**由 Android 历史证据补上,因为那轮跑的不是这段代码。
- **native**：历史 named Kotlin unit test 保留,**不外推** native device 或 Android IME 行为。
- **Web / release / visual**：`NOT_RUN`。
- **cleanup**：focused cleanup PASS,无新增外部 runtime cleanup;cleanup PASS **不提升任何其他档位**。
- `N-2`（虚拟列表 bounded-list）仍为 focused 边界证明,未升级。

## 7. 授权边界

本文只是对当前字节的独立复审输入,**不自动成为新权威**。不授权继续修改源码、测试、依赖或文档,不授权 Web、release、visual、DEV、seed、UAT、部署或任何未明确授权的运行,不授权下一 Roadmap step。`S-01` 与两条 N 均在既有批准边界内可自主处置,无需 Dexter 裁决。
