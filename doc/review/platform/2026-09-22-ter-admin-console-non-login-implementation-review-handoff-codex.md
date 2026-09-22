# TER Admin console 非登录区实施结果：Claude 复核 brief

`REVIEW_TARGET=IMPLEMENTATION`
`REVIEW_CYCLE_ID=TER_ADMIN_CONSOLE_NON_LOGIN_IMPLEMENTATION_2026_09_22`
`VERDICT=REQUEST_CLAUDE_REVIEW`
`M/S/N=待 Claude 独立裁定`
`OVERALL_ACCEPTANCE=NOT_CLAIMED`
`AUTHORIZATION_BOUNDARY=仅本次 TER Admin console 非登录区详设/实施；不得扩展到登录以外业务、DEV、Web/UAT 或未授权 owner 语义`

## 背景

Dexter 已授权四处设计文档修订后直接实施，并要求登录框与认证后的 Admin console 均使用命名明确的
`Laptop`/`Mobile` 两套 UI、共享 hook/owner 承载行为与事实、两批 Android 动态验证和构建历史清理。
当前实现、owner closeout 和动态结果已完成，但不能把未达成的真实帧条件或完整视觉验收写成 PASS。

开工前四处文档修订已落地，亦请独立核验：IA frame inventory §5 的 current/non-current surface 不对称字段；requirements §5.4 的同口径收敛；design-review-response 对 frame inventory 的准确表述；两份 IA 头部和 implementation plan reconciliation gate 的 IA 正本优先级声明。

当前状态：

- 三条 admission blocker 已由 owner closeout 正式 `CLOSED_WITH_OWNER_EVIDENCE`：
  `DISPLAY_FACTS_OWNER`、`TOPOLOGY_PAGE_AVAILABILITY_AND_DIRECT_PAIR_OWNER`、`MASTER_UNPAIR_GUARD`；证据见
  `doc/evidence/platform/2026-09-22-ter-admin-console-non-login-admission-blocker-closeout-codex.md`。
- 代码 focused/typecheck 已通过；r66 第一批、r64 dual、r65 mobile 两套 integration 均受管运行
  `BUSINESS=PASS`、`CLEANUP=PASS`，总机械 union 为 `24/30`。
- IA-13 经 fresh independent vision review 为 `MATCHED`；逻辑高、物理高改为横向可读，surface map
  全屏且与 IA §4.3/§5.1 对齐，证据见
  `doc/review/platform/2026-09-22-ter-admin-console-non-login-r66-ia13-visual-review-codex.md`。
- 仍 `OPEN`：IA-03/04/05/06/07/08 的真实 empty/loading/error release 状态，以及 IA-14
  `display-facts-error` 变体；原因、first failure、last known good、broken boundary 和最小替代见
  `doc/evidence/platform/2026-09-22-ter-admin-console-non-login-current-apk-reconciliation-codex.md`。
- 因上述 OPEN，整体仍是 `IMPLEMENTATION_IN_PROGRESS / ACCEPTANCE_NOT_CLAIMED / NO-GO`；这不是把
  OPEN 改写成“可用但未测试”。

## 评审目标

请 Claude 以证伪立场独立复核当前实现是否符合已批准的 TER Admin console 非登录区需求、IA、详设和实施计划，重点判断：两套 Laptop/Mobile production UI 与共享 hook 的边界、三条 owner admission blocker 的真实闭包、30 帧分母和两批可达性、控件形态级视觉证据、OPEN 的 first failure/last known good/broken boundary，以及实现范围和构建清理是否存在越界或遗漏。

本交接不预设 Claude 的 `GO`/`NO-GO`，也不把当前实现状态写成验收通过；请 Claude 独立形成最终 verdict。

## 需阅读文件

请以当前仓库字节为准，独立重开：

1. `doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md`；
2. `doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-frame-inventory-codex.md`；
3. `doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-high-fidelity-codex.md`；
4. `doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-design-codex.md`；
5. `doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-plan-codex.md`；
6. `doc/review/platform/2026-09-20-ter-admin-console-non-login-implementation-design-review-response-codex.md`：四处设计文档修订的处置记录；
7. `apps/terminal/ui/base/admin-shell/src/` 下的 `AdminLayerLaptop/Mobile`、`AdminLoginLaptop/Mobile`、
   `AdminShellFrameLaptop/Mobile`、panel/navigation/section 的 Laptop/Mobile siblings、shared hooks、
   `adminFrameRegistry.ts` 与 `parts.ts`；
8. owner 源码：`apps/terminal/kernel/base/display-context/src/foundations/displayDevice.ts`、
   `apps/terminal/ui/base/admin-shell/src/foundations/runtimeDisplay.ts`、
   `apps/terminal/kernel/base/topology/src/foundations/createTopologyAdminCapability.ts`、
   `apps/terminal/kernel/base/topology/src/selectors/selectTopologyFacts.ts`、
   `apps/terminal/kernel/base/topology/src/features/actors/actors.ts`、
   `apps/terminal/kernel/base/topology/src/features/slices/topology.ts`；
9. `apps/terminal/ui/base/primitives/src/components/PrimitiveAdmin.tsx`、
   `apps/terminal/ui/base/primitives/src/theme/tokens.ts` 与
   `apps/terminal/ui/base/admin-shell/test/adminVisualGeometry.test.ts`；
10. 四个 `package.json` 的 display config：
   `apps/terminal/ui/integration/sample-console/package.json`、
   `apps/terminal/ui/integration/sample-wallpaper-console/package.json`、
   `apps/terminal/assembly/android/sample-terminal/package.json`、
   `apps/terminal/assembly/android/sample-wallpaper-terminal/package.json`。

## 独立核验重点

- named `Laptop`/`Mobile` UI 是否确实是两套 production renderer；登录框也必须遵守；共享 hook 不得藏布局
  JSX，`parts.ts` 必须保持同语义 `partKey` 的 `.laptop`/`.mobile` sibling 注册；
- 三条 blocker 是否真的在 owner 关闭，尤其 MASTER peerIdentity-only unpair 是否清除
  `masterLocator`、`peerIdentity`、`peerReachable` 并完成 host stop/persistence/readback；不得接受 admin-shell 绕过；
- 30 帧分母是否仍为 `IA-01..IA-29 + IA-32`，两批是否仍为 `19+11=30`；不得因不可达 frame 缩分母；
- current/non-current surface 字段是否遵守不对称口径，non-current 是否混入分辨率/就绪态；
- IA-09/IA-11 的真实端口状态、比例条、两类 capability detail 是否仍按控件形态而非 testID 存在性核对；
- Admin console 是否 edge-to-edge 全屏；IA-13 的横向尺寸标签是否确实与 high-fidelity IA 对齐；
- `sample-console` 与 `sample-wallpaper-console` 主题是否仍按 integration-owned 现有机制加载；本次没有新增
  shared Admin theme，也没有以主题差异冒充 bug；
- 当前 release APK exact SHA、r66/r64/r65 `business` 与 `cleanup` 是否能从 raw result/progress/readback 复核；
- build cleanup 是否只移除了生成历史，保留当前 release APK 与审查 evidence，且没有源码/测试/依赖残留修改。

## 动态 evidence

- 第一批：`.runtime/ter-dual-machine-topology/2026-09-22/non-login-implementation/stage1-single-screen-all-r66/`
  （两台 single-screen `emulator-5554`/`emulator-5556`，physical 2560×1600，density 320）；
- 第二批 dual：`.runtime/ter-dual-machine-topology/2026-09-21/non-login-implementation/stage2-dual-all-r64/`；
- 第二批 mobile：`.runtime/ter-dual-machine-topology/2026-09-21/non-login-implementation/stage2-mobile-all-r65/`；
- current reconciliation：`doc/evidence/platform/2026-09-22-ter-admin-console-non-login-current-apk-reconciliation-codex.md`；
- build cleanup：`doc/evidence/platform/2026-09-22-ter-admin-console-non-login-build-cleanup-codex.md`。

## 期望结论

请先以证伪立场独立读正本、源码和 raw evidence，再按以下固定收口字段返回：

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO
M/S/N=<数量>
L1_ENGINEERING=<PASS / findings>
L2_USER_VISIBLE=<PASS / findings>
L3_UNVERIFIED=<空 / 逐条列出>
SAME_ROOT_SCAN=<每条 finding 的全集与判定>
DESIGN_GAPS=<评审中发现的、正本里缺判据的条目>
EVIDENCE_TIER=<按 charter 与实施话术的档位定义>
```

逐条列出 confirmed/rejected/unverified findings；对每个 OPEN 给出 first failure、last known good、broken
boundary、是否为 owner/设备条件缺失，以及最小下一步。不要把 owner closeout 之前的历史 review verdict 当作
当前状态，也不要把结构测试、截图存在、testID、runner exit code 或 pixel diff 当作完整视觉通过条件。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助独立复核本次 TER Admin console 非登录区实施结果。

背景：Dexter 已授权四处设计文档修订后直接进入实施，并要求登录框与认证后的 Admin console 均使用命名明确的 Laptop/Mobile 两套 UI、共享 hook/owner 承载行为与事实、两批 Android 动态验证和构建历史清理。本次实现已完成源码、owner closeout、r66 第一批、r64 dual、r65 mobile 动态运行及构建清理，但当前不能宣称完整视觉验收通过：三条 admission blocker 已有 owner closeout 证据，机械 union 为 24/30，IA-13 已由 fresh independent vision review 判为 MATCHED，IA-03/04/05/06/07/08 的真实状态帧和 IA-14 display-facts-error 变体仍 OPEN。请以当前仓库字节和 raw evidence 为准，不继承历史 verdict，也不要把 OPEN 写成“可用但未测试”。

开工前四处文档修订也已落实，请一并独立核验：IA frame inventory §5 的 current/non-current surface 不对称字段；requirements §5.4 的同口径收敛；design-review-response 对 frame inventory 的准确表述；两份 IA 头部和 implementation plan reconciliation gate 的 IA 正本优先级声明。

评审目标：请独立核验实现是否符合需求、IA、详设和实施计划，尤其是：(1) 登录框和非登录区是否确实为两套 Laptop/Mobile production renderer，shared hook 是否不承载布局 JSX，parts.ts 是否保持同语义 partKey 的 .laptop/.mobile sibling 注册；(2) DISPLAY_FACTS_OWNER、TOPOLOGY_PAGE_AVAILABILITY_AND_DIRECT_PAIR_OWNER、MASTER_UNPAIR_GUARD 是否在 owner 侧真实关闭，尤其 peerIdentity-only unpair 是否清除 masterLocator、peerIdentity、peerReachable 并完成 host stop/persistence/readback；(3) 30 帧分母是否仍为 IA-01..IA-29 + IA-32，批次是否仍为 19+11=30；(4) current/non-current surface 字段、IA-09/IA-11 端口状态柱状图和 capability detail、全屏 surface map、主题归属是否符合正本；(5) 视觉结论是否按真实控件形态逐控件核对，而不是 testID、截图存在、结构测试、runner exit code 或 pixel diff；(6) OPEN 的 first failure、last known good、broken boundary、owner/设备条件和最小下一步是否准确；(7) 构建清理是否只移除生成历史并保留当前 release APK 与 evidence。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md：需求正本；
- doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-frame-inventory-codex.md：30 帧与字段边界；
- doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-high-fidelity-codex.md：高保真视觉正本；
- doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-design-codex.md：owner、数据、UI 和状态详设；
- doc/plans/platform/2026-09-20-ter-admin-console-non-login-implementation-plan-codex.md：CP-0 至 CP-5 计划与 reconciliation gate；
- apps/terminal/ui/base/admin-shell/src/：Laptop/Mobile production renderers、shared hooks、parts.ts 与 adminFrameRegistry.ts；
- apps/terminal/kernel/base/display-context/src/foundations/displayDevice.ts：display facts owner；
- apps/terminal/ui/base/admin-shell/src/foundations/runtimeDisplay.ts：runtime display owner；
- apps/terminal/kernel/base/topology/src/foundations/createTopologyAdminCapability.ts：topology command owner；
- apps/terminal/kernel/base/topology/src/selectors/selectTopologyFacts.ts：topology facts selector；
- apps/terminal/kernel/base/topology/src/features/actors/actors.ts：topology actor；
- apps/terminal/kernel/base/topology/src/features/slices/topology.ts：topology state and persistence；
- apps/terminal/ui/base/primitives/src/components/PrimitiveAdmin.tsx、apps/terminal/ui/base/primitives/src/theme/tokens.ts、apps/terminal/ui/base/admin-shell/test/adminVisualGeometry.test.ts：视觉 primitives、IA-13 surface map 和 focused geometry proof；
- doc/evidence/platform/2026-09-22-ter-admin-console-non-login-admission-blocker-closeout-codex.md：三条 owner blocker closeout；
- doc/evidence/platform/2026-09-22-ter-admin-console-non-login-current-apk-reconciliation-codex.md：当前 APK、30 帧、OPEN 边界与 reconciliation；
- doc/review/platform/2026-09-22-ter-admin-console-non-login-r66-ia13-visual-review-codex.md：IA-13 fresh independent visual review；
- doc/evidence/platform/2026-09-22-ter-admin-console-non-login-build-cleanup-codex.md：构建历史清理与 cleanup 证据；
- .runtime/ter-dual-machine-topology/2026-09-22/non-login-implementation/stage1-single-screen-all-r66/：第一批 single-screen raw result；
- .runtime/ter-dual-machine-topology/2026-09-21/non-login-implementation/stage2-dual-all-r64/：第二批 dual raw result；
- .runtime/ter-dual-machine-topology/2026-09-21/non-login-implementation/stage2-mobile-all-r65/：第二批 mobile raw result。

请重点独立核验：从源码先提取用户可见事实，再逐 IA-ID、逐控件对 IA/详设/需求对账；逐项区分静态已证、测试已证和无人验证；对 30 帧保持 19+11=30 的固定分母；对每个 finding 扫描同族全集并给出 MATCHED/OPEN；对所有 OPEN 写明 first failure、last known good、broken boundary、是否为 owner/设备条件缺失及最小下一步。请特别检查三条 blocker 是 owner 真闭合而不是 admin-shell 绕过，MASTER unpair 是否清三项事实，IA-09/IA-11 是否真的有端口状态柱状图，IA-13 是否 full-screen 且尺寸标签方向正确，以及当前 release APK 的 exact SHA、r66/r64/r65 的 business/cleanup 证据和 cleanup 是否越界。

请返回：
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码提取
VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO
M/S/N=x/y/z
L1_ENGINEERING=<PASS / findings>
L2_USER_VISIBLE=<PASS / findings>
L3_UNVERIFIED=<空 / 逐条列出>
SAME_ROOT_SCAN=<每条 finding 的全集与判定>
DESIGN_GAPS=<评审中发现的、正本里缺判据的条目>
EVIDENCE_TIER=<按 charter 与实施话术的档位定义>

每条 finding 请标注 confirmed/rejected/unverified，给出仓库相对路径和精确行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决；不要把 owner closeout 之前的历史 review verdict 当作当前状态。

授权边界：本次复核只覆盖 TER Admin console 非登录区的已批准详设、源码实施、owner closeout、r66/r64/r65 动态 evidence、视觉对账和构建清理。Claude 的 GO/NO-GO 只是独立复核结论，不自动授予新的产品/Journey 范围、登录区以外业务、DEV、Web/UAT、Git、部署、切流或设备资源授权；任何仍 OPEN 的真实状态或视觉条件必须保持 OPEN，不能用结构测试或截图存在性替代。
谢谢。
```
