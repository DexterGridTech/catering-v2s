# TER terminal input 实施结果 review brief

## 交付状态

```text
REVIEW_CYCLE_ID=TERMINAL_INPUT_CP0_CP3_IMPLEMENTATION_2026-09-06
REVIEW_TARGET=IMPLEMENTATION
IMPLEMENTATION_SCOPE=CP-0..CP-3
RECONCILIATION=PASS
READY_FOR=DEXTER_AND_CLAUDE_STATIC_REVIEW
REMEDIATION_REVIEW_CYCLE_ID=TERMINAL_INPUT_IMPLEMENTATION_REMEDIATION_2026-09-06
REMEDIATION_REVIEW_TARGET=IMPLEMENTATION
REMEDIATION_REVIEW_ROUND=1
REMEDIATION_REVIEW_ROUND_LIMIT=2
REMEDIATION_INDEPENDENT_VERDICT=GO_WITH_UNVERIFIED_UI
REMEDIATION_M_S_N=0/0/0
```

Dexter：本批已按授权完成 `ui/base/input` 的 CP-0 至 CP-3 实施、验证、清理与
逐代码—详设对账，现提交 Dexter 与 Claude 做实施后静态 review。范围没有推进到
真实 POS、UAT、部署、浏览器自动化或 §9 比例静态门。

## 目标与保留边界

本批实现的是可寻址、性能可控的虚拟键盘输入能力：编辑期字段由 input registry
维护，提交读取原子 snapshot；系统键盘与虚拟键盘互斥；键盘按承载输入字段的
surface 出现；副屏不承诺系统 IME，但支持虚拟键盘。既有 PrimitiveInput 公共契约
保持，新增的 `maxLength` 是通用可选呈现/输入约束，未暴露业务 `inputMode`。

主屏系统 IME 由 Android adapter 消费 inset；副屏 Presentation 只提供可聚焦字段与
虚拟键盘，不把副屏系统 IME 当成能力放行。SurfaceRoot 的 frame render prop、
LayerStack 的 focus suspend/restore、input 的 keyboard owner 与 feature actor 的
业务状态边界均按详设落地。

## 代码、详设与证据输入

- 原始需求：`doc/plans/platform/2026-09-05-v2s-terminal-input-requirements-claude.md`
- 实施详设：`doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md`
- 实施计划：`doc/plans/platform/2026-09-05-v2s-terminal-input-execution-plan-codex.md`
- CP-0 对账：`doc/evidence/platform/terminal-input/cp0-reconciliation-codex.md`
- CP-1 对账：`doc/evidence/platform/terminal-input/cp1-reconciliation-codex.md`
- CP-2 对账：`doc/evidence/platform/terminal-input/cp2-reconciliation-codex.md`
- CP-3 对账：`doc/evidence/platform/terminal-input/cp3-reconciliation-codex.md`
- 全批逐代码—详设对账：`doc/evidence/platform/terminal-input/reconciliation-codex.md`
- CP-0 run-scoped evidence：`doc/evidence/platform/terminal-input/runs/TERMINAL-INPUT-CP0-ANDROID-VIRTUAL-PROBE-2026-09-06T04-44-29/`
- CP-3 Android evidence：`doc/evidence/platform/terminal-input/runs/TERMINAL-INPUT-CP3-ANDROID-2026-09-06T05-00-00/`

## 各 CP 产出与新鲜证据

### CP-0：Android IME/虚拟键盘边界

- 先构造并运行了不依赖 input 包的受控 probe surface，验证主屏系统 IME inset、
  副屏字段 focus、虚拟按键输入与提交回读。
- 主屏 probe 记录 `visible=true` 与 `bottomLogical=368.0`；副屏 probe 记录虚拟
  输入长度与提交回读成功。
- 副屏系统 IME 事实：副屏字段存在 focused client，但 `mInputShown=false`，
  WindowManager 的 InputMethod window 仍在 display 0；因此结论是“副屏系统 IME
  不支持/不放行，副屏虚拟键盘可用”，不是“副屏字段不能 focus”。
- 临时 probe assembly、临时 diagnostic log 与探路组件已删除。当前源码扫描不再
  命中 `TEMP_INPUT_DIAGNOSTIC`、`ProbeSurface`、`TemporaryProbe` 或 production
  probe 接线。

### CP-1：输入包基础能力

字段注册、注销 token、selection 编辑、纯编辑函数、原子 snapshot、四个
PrimitiveInput 可选 prop、虚拟键盘 owner 与强制 testID 均已落地。CP-1 对账见
`cp1-reconciliation-codex.md`，独立只读审查 round 2 无 finding。

### CP-2：render 接缝与交互输入

`SurfaceRoot` 通过 frame render prop 组织 content/provider/dock；LayerStack 的
suspend/restore 只通过 `SurfaceFocusBoundaryContext` 传递 phase，不反向 import input。
焦点滚入可见区由 input owner 负责，找不到滚动祖先时 no-op；键盘 dock 高度使用
逻辑高度与声明 surface 高度的比例，避免 Android 密度差导致副屏内容被 540px
直接覆盖。CP-2 focused 计数已修正为 32 个 input tests，详见
`cp2-reconciliation-codex.md`。本轮 remediation 的独立只读审查未发现新的 M/S/N
finding；真实 Android/Web IME 交互没有在该审查轮次重跑，保持原有未取证边界。

### CP-3：sample Journey、Android/Web 运行验证

- sample registry 增加可选 age 链；actor 只读取/规范化用户输入，不生成 age。
- 双屏顾客侧年龄使用虚拟键盘；单屏使用 `handheld-confirm`；feature 内没有按
  屏数分支，屏幕形态判断只在 actor owner。
- 撤回与拒绝/重试/放弃均按 owner 的 pending 与先到者幂等规则处理；撤回清
  pending，本地编辑 draft 不跨卸载保留，只有 reject retry 从 `PendingMember`
  回填。
- 真实 Android 双屏路径完成：主屏输入姓名/电话、提交等待确认；副屏 focus 年龄、
  虚拟键盘输入四次但最终保持 3 位、确认；确认后副屏回到 welcome，主屏可见登记行，
  键盘消失。

## 新鲜 focused/typecheck 输出

```text
@catering-v2s/ui-base-input
  typecheck PASS
  Test Files 7 passed (7)
  Tests 32 passed (32)
  TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS

@catering-v2s/ui-feature-sample-member-desk
  typecheck PASS
  Test Files 1 passed (1)
  Tests 17 passed (17)
  TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS

@catering-v2s/kernel-feature-sample-member-registry
  typecheck PASS
  Test Files 1 passed (1)
  Tests 9 passed (9)
  TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS

@catering-v2s/ui-integration-sample-console
  typecheck PASS
  Test Files 6 passed (6)
  Tests 13 passed (13)
  TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS

@catering-v2s/ui-base-primitives
  typecheck PASS; 1 file / 7 tests PASS

@catering-v2s/ui-base-render
  typecheck PASS; 8 files / 37 tests PASS
```

## Android 编译与动态证据

Android Gradle 实跑：

```text
./gradlew :catering-v2s-adapter-android-dual-screen:compileDebugKotlin :app:assembleDebug --no-daemon
BUILD SUCCESSFUL in 13s
352 actionable tasks: 39 executed, 313 up-to-date
resolved minSdk=24 compileSdk=36 targetSdk=36 ndk=27.1.12297006
```

运行环境必须准确表述为：**在双屏 Android 模拟器上验证，未在真实 POS 硬件上验证**。
厂商定制 ROM 对 Presentation/多显示的行为差异，以及真实分辨率、DPI 与性能特征，
仍未覆盖。

副屏实际 UI tree 证据：年龄字段 bounds 为 `[42,119][1238,207]`，actions 为
`[518,235][763,319]`，virtual keyboard 为 `[0,361][1280,720]`；年龄在键盘出现后
仍可见，四次输入后 UI tree 文本长度为 3。该模拟器的 `screencap -d 2` 返回
`Capturing failed`，且 SurfaceFlinger 只列出物理 display 0，因此本批不伪造副屏
PNG；副屏使用脱敏 UI tree/bounds 证据，不把失败的截图命令写成截图已验。

首败与修复：

1. 直接把逻辑高度当 RN 数值渲染，副屏 dock 占满约 540 物理像素，年龄不可见；
   已改为 `logicalKeyboardHeight / declaredSurfaceHeight` 比例布局，并记录在详设。
2. `showSoftInputOnFocus=false` 的 RN TextInput 触发 native blur，误清 virtual
   owner；已由 `InputProvider` 将该平台副作用与显式 blur/unregister/layer suspend
   区分，并有 focused regression test。

## Web 启动证据与未取证边界

命令：`yarn workspace @catering-v2s/ui-integration-sample-console web --port 8082`

```text
Web Bundled 2505ms apps/terminal/ui/integration/sample-console/index.js (614 modules)
Web LOG Running application "main"
Web INFO event="startup-ready" runtimeStatus="started"
HTTP/1.1 200 OK
HTML_BYTES=1335
id="root"
```

本轮没有浏览器自动化。Web 日志中的 protected storage adapter 未注入、power bridge
unavailable、Web BackHandler 不支持及 CSS interop color-scheme runtime error 已如实
登记在 `web-start-output.md`；它们不能被改述为“零启动告警”，也不能替代 Android
或浏览器行为证据。S-12 的 Web 刷新语义与 S-26 的浏览器 resize 仍为
`UNVERIFIED_REQUIRES_EVIDENCE`，本轮不宣布已验。

## 静态门、红向量与生产树

```text
TERMINAL_SKELETON_MODEL_TEST=PASS
RULE_GATES=6
SCAFFOLD_HYGIENE=PASS
TERMINAL_RENDER_STATIC=PASS
TERMINAL_LAYERING=PASS
TERMINAL_STATIC=PASS
REAL_STATIC_TREE=PASS
```

模型红向量中的 `FAIL` 表示变异夹具被门抓住；它与真实生产树的 `PASS` 是两类证据，
不得合并表述为生产源码失败。本批没有提前建立 §9 比例静态门。

## 独立对抗审查与收口方式

### 2026-09-06 review remediation

本轮由 fresh、只读、证伪立场的独立子 agent 完成；主 agent 没有把自己的修复判断
当作独立 verdict：

```text
REVIEW_CYCLE_ID=TERMINAL_INPUT_IMPLEMENTATION_REMEDIATION_2026-09-06
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
READ_ONLY=true
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
```

独立审查重开了需求、详设、计划、`InputProvider`、`useInputField`、provider tests、
`MemberForm`、`CustomerMember` 与当前证据。它确认：

- `InputProvider` 只在旧 owner 为 `system` 时 dismiss；virtual→system 的首击不会
  在目标字段已获焦后被全局 blur，system→virtual 仍收起旧 system IME；
- provider 测试的受控 native focus/blur harness 维护 active node，`Keyboard.dismiss`
  会实际 blur active node，双向测试观察的是焦点归属与 dock，而不是只数调用次数；
- 临时去掉方向守卫的 red mutation 在主 agent 的 focused run 中已使目标 system
  字段失焦断言失败；恢复生产守卫后 input 32/32 PASS；
- 详设 §6.1 已按真实代码改写为 `editStateRef`、延迟 `setEditState` 与同步 registry
  refs，snapshot 只读 registry；
- CP-0 §3.4 已把副屏 IME 写成 Android WindowManager display policy 与普通应用权限
  边界，并明确产品有意不开启；hidden 只能记录为 `FIRST_FAILURE`/事实边界，不得
  用 adb、权限或兼容层绕过。

该独立审查没有重跑 Android/Web 真实 IME，也没有自行写临时 mutation；因此它的结论
是 `GO_WITH_UNVERIFIED_UI`，不是把既有 focused/static 证据升级成新的动态证明。
这不产生新的代码 OPEN；UI 动态未取证边界按原 evidence 保留。

CP-3 使用 fresh、只读、证伪立场的独立子 agent：

```text
REVIEW_CYCLE_ID=TERMINAL_INPUT_CP3_IMPLEMENTATION_2026-09-06
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
READ_ONLY=true
ROUND_FINAL_DECISION=SELF_DECIDED
```

第二轮唯一 finding 是 member-desk README 将撤回误写为“保留本地 draft”。主 agent 已
按详设与当前源码修正，并重新跑 member-desk 17/17 与相关 typecheck；没有再召集第三轮，
遵守 review cycle 两轮上限。第二轮确认的其余实现、Android/Web 证据、输入边界与临时
代码清理均为 MATCHED。

全批逐代码—详设对账已逐一覆盖行为、形态、动作、关系、位置、文案、限制、状态/控制、
失败/恢复、焦点/可访问性、数据来源/失效边界 11 个维度；7 个代码组每行结果均为
`MATCHED`，最终记录为：

```text
CODE_TO_DESIGN_RECONCILIATION=PASS
ANDROID_CLEANUP=PASS
```

## 请 Claude 独立核验

请以 `REVIEW_TARGET=IMPLEMENTATION` 重新打开上述需求、详设、源码与证据，重点核验：

1. 副屏系统 IME 不被误报为支持，但副屏虚拟键盘与 age 业务路径真实闭合；
2. `SurfaceRoot` frame、LayerStack focus boundary、input keyboard owner 的 owner
   边界与互斥顺序；
3. Android 密度比例修复与 native blur 修复是否真正解决首败，而非改断言；
4. age 的 `maxLength=3`、原子 snapshot、pending/withdraw/retry 竞态与单屏
   `handheld-confirm` 是否与需求/详设一致；
5. 既有 PrimitiveInput 公共面是否只做了获批的加法，业务 feature 是否没有直接
   依赖 react-native/className/字符串标签；
6. 临时 probe/diagnostic 是否已从当前源码与 production 接线清除；
7. Android 模拟器、Web bundler、模型红向量、真实树与未取证边界是否被分开表述。

请返回 `GO` 或 `NO-GO`，并报告 `M/S/N`；任何 finding 请给出仓根相对路径、证据类型、
失败场景、owning source 与最小修法。授权仅覆盖 CP-0 至 CP-3 的 input 实施与本批验证，
不授权真实 POS、UAT、部署、浏览器自动化、seed、§9 比例静态门或其他专题推进。
