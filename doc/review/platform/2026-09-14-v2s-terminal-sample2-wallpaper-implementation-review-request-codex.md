# TER sample2 壁纸终端 implementation review handoff

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_CYCLE_ID=TER-SAMPLE2-IMPLEMENTATION-20260913
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=CODEX_HANDOFF_REQUEST
CURRENT_DELIVERY_STATUS=OPEN_FOR_REVIEW
COMPLETE_IMPLEMENTATION_ACCEPTANCE=NOT_CLAIMED
```

## 背景

Dexter 已授权按当前需求、详设和实施计划完成 TER sample2 壁纸终端实施，并要求完成动态验收后
再交独立 review。实施已经按 CP-0 至 CP-8 的源码范围推进：四个新包、两个 integration 的
共享 admin console 接入、sample-terminal 回归、两台 Android VM 的 sample2 运行和部分截图
ROI 证据均已产生。

本 handoff 不是 implementation acceptance 结论。当前证据仍是部分收口状态：CP-7 evidence
为 `STATUS=ANDROID_DYNAMIC_PARTIAL_WITH_OPEN_REVIEW_ITEMS`，Web、release、完整 visual/quantified ROI、sample2-specific 的真实
Android/ROI 红夹具与完整 A/F 矩阵仍有 OPEN；F-A5d 与可启动的 F-A5_RUNTIME confirmed-field
storage mutation 已补真实 Android 红证据，原 F-A5 的非法 descriptor 变异仅触发运行时不变量拒绝，
主屏六个与副屏六个 directed ordered-pair 已有当前证据；本回合又在同一 picker 几何下取得
laptop 主/副屏 w1↔w2 的 fresh 双向 ROI 对，详见
`doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-current-a3-pair-codex.md`，
生成 Android set、package/Gradle 与资产身份的最终对账已实际 PASS；focused
source-level red 已由 `tools/terminal-sample2/check-behavior.mjs` 复跑。请以当前源码、
详设、计划和 evidence 为准，不采信历史聊天、自报完成数字或本文件的状态字段作为质量证明。

本轮执行未使用 computer use，未启动后台 DEV，未执行 seed、UAT、部署或 Git。Android 证据使用
TER 自有 Expo/Metro、Gradle、ADB、uiautomator 和截图工具；Web/release 未执行不是 Web PASS。

## 评审目标

请独立确认：

1. 当前实现是否仍符合需求正本与 implementation-facing 详设，尤其是 pending/confirmed 壁纸语义、
   透明容器可见性、laptop 双屏与 mobile 单屏形态、浮层恢复和既有 sample-terminal 回归；
2. `TR-13` 是否在所有当前 `apps/terminal/ui/integration/*` 中落实：admin-shell 声明、同一
   catalog 的 `adminShellAssembly.parts`、生产 `AdminLauncher`，且没有第二套 registry/open
   path/overlay/input 管线；
3. CP-0 至 CP-8 的实际源代码、测试、工具、Android 入口、生成物和证据是否逐项闭合；
4. 当前 A1-A9 与全部 F 红夹具中，哪些是真实证据，哪些只是 static/focused/基线 Android
   支持，哪些仍不可证伪或未执行；
5. 任何失败是实现缺陷、证据缺口、测试逃逸、环境边界，还是产品语义问题。请不要把缺证据
   直接写成代码正确，也不要把局部 Android 截图升级成完整视觉验收。

## 需阅读文件

请从 catering-v2s 仓库根打开：

- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md`：当前需求正本；
- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md`：当前详设与 A/F 语义锚点；
- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-plan-codex.md`：CP 顺序、变更清单、对账表与结束闸门；
- `doc/platform/terminal-coding-standard.md`：TER 规范正本，含所有 integration 必须接入 admin console 的 TR-13；
- `project-memory/decisions/terminal-integration-admin-console-invariant.md`：本项目已登记的 integration 共同工程不变量；
- `doc/evidence/platform/2026-09-13-v2s-terminal-sample2-cp0-execution-codex.md` 至
  `doc/evidence/platform/2026-09-13-v2s-terminal-sample2-cp7-execution-codex.md`：各 CP 的真实输出、首败、
  根因、修复、动态边界和 cleanup；
- `apps/terminal/kernel/feature/sample-wallpaper`：wallpaper owner、slice、commands、actors 与测试；
- `apps/terminal/ui/feature/sample-wallpaper-picker`：四项 picker、图片资产、background、actor 与测试；
- `apps/terminal/ui/integration/sample-wallpaper-console`：catalog、placement、透明容器、laptop/mobile
  surface、admin 接入与测试；
- `apps/terminal/ui/integration/sample-console`：既有 integration 的 TR-13 对照与回归影响；
- `apps/terminal/assembly/android/sample-wallpaper-terminal`：Expo/Android 入口、端口、形态参数、
  app identity、生成 Android 工程与资源；
- `apps/terminal/assembly/android/sample-terminal`：删除方向锁后的既有 sample 回归入口；
- `apps/terminal/adapter/android/dual-screen`：smallestScreenWidthDp 形态判定、surface/Bundle 传播；
- `apps/terminal/ui/base/primitives`、`apps/terminal/ui/base/render`、
  `apps/terminal/kernel/base/ui-state`：图片 seam、透明容器、surface/render 和浮层持久化 owner；
- `tools/terminal-image-compare`、`tools/terminal-sample2`、`tools/terminal-ui-sample-wallpaper-picker`、
  `tools/terminal-ui-primitives`、`tools/terminal-ui-render`、`tools/terminal-runtime`、
  `tools/terminal-display-context`：比较工具和已执行 red mutation runner；
- `doc/platform/claude-review-handoff-template.md`：本交接材料的结构要求。

## 当前实施与证据摘要

### 已真实执行

- CP-0 已实测 workspace feature 包内 JPG 能由既有 sample-terminal Metro consumer 解析；consumer
  可见的 asset declaration 落点已确定，临时 probe 已清除。
- 当前回合 focused 重跑：sample-wallpaper 9/9、picker 9/9、sample-wallpaper-console 12/12、
  primitives 16/16、ui-state 38/38、render 46/46、runtime 94/94、display-context 57/57、
  admin-shell 8/8、dual-screen 7/7 全部通过。
- 当前回合 red/self-test：`tools/terminal-sample2/check-behavior.mjs` 的 11 个 focused F mutation（含
  F-A5_RUNTIME 的可启动 confirmed-field persistence-loss 变异）、picker F-A2b、image-compare threshold mutation/self-test、primitives
  theme mutation、render 26 个 mutation vector、runtime 5 个 mutation vector、display-context
  secondary mutation 均按预期变红且 cleanup PASS；另在真实 Android 上执行 F-A2a、F-A3a、F-A3b
  的 ROI 反向变异并按预期变红，另以真实 Android MMKV storage mutation 执行 F-A5d 与
  F-A5_RUNTIME 并按预期变红；补充的 F-A9_RUNTIME 在真实 mobile 日志中出现被禁止的
  `displayIndex=1`/`displayMode=SECONDARY` surface/root 后按预期变红，源码已恢复。
  F-A5_RUNTIME 与 F-A9_RUNTIME 的冷启动后 XML/截图/日志在 CP-7 evidence 中列出；它们不关闭
  原 F-A5 非法 descriptor 变异或完整 A/F 矩阵。
- skeleton、layering、runtime、display-context static gate 当前回合均 PASS；sample2 三个相关
  package typecheck 当前回合均 exit 0。
- 两台 Android VM 均真实完成匿名登录、四项 picker、选择/确认、确认后恢复和未确认 pending
  重启恢复；laptop VM 的副屏能看到对应 wallpaper 与 waiting/welcome；本回合又独立完成
  laptop 认证态 w1 冷启动恢复；mobile VM 物理屏幕为
  720×1280、integration 逻辑画布为 360×640 且未创建 SECONDARY。
- 既有 `sample-terminal` 已真实完成登录、会员新建、主副屏确认、会员列表、登出和冷启动回到
  登录页的旅途；相关 evidence 与截图/XML 在 CP-7 evidence 列出。
- 已对真实 PNG 对执行 image-compare：laptop 主屏六个 directed ordered-pair、pending 不提前
  改变背景，以及 secondary 的三种无序组合（w1↔w2、w1↔w3、w2↔w3）各自两个方向、共六个 directed pair
  均得到指标输出；metadata 固定 canvas 8×8 网格、
  ROI 和 mask；F-A2a/F-A3a/F-A3b 另有真实 Android 变异输出。完整 sample2 A/F 反向变异仍未关闭。
- cleanup 已精确确认两个目标 serial 上 sample2 包、本回合 Metro session 均不再残留，见
  `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-f-a5d-cleanup-codex.md`、
  `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-a4-cleanup-codex.md` 与
  `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-f-a5-runtime-cleanup-codex.md`；其他不属于本
  run 的 Node 进程未被停止。

### 首败、修复与边界

1. CP-7 初次 static graph 发现 sample2 assembly 错误依赖了 admin-shell；主 agent 删除错误边后
   skeleton/layering 恢复通过。请确认没有在别处转移同一条错误边。
2. sample-terminal 首次回归曾把 APK 接到了 sample2 Metro；停止错误 Metro、启动 sample-terminal
   自己的 Metro 后重新完成旅途。请把它作为运行入口串包边界，不要当成 sample-terminal 源码失败。
3. `screencap -d 2` 对 laptop 副屏返回 status `-2`；通过 `dumpsys display` 解析出的真实
   SurfaceFlinger id 截图成功。请核对 display-id 映射是否被误写成通用 display index。
4. `none` 的第一次确认点按未命中，定位后在同一真实控件上重试成功；这只证明第一次输入命中
   不稳定，当前没有把它归因为源码缺陷。
5. Android debug 曾显示既有可选 `subscribePowerStatus` 的
   `power-bridge.subscription-unavailable` warning；它不是 sample2 或 persistKV 的 fatal
   失败，关闭 warning 后旅途继续，但 warning 本身没有在本批修复。
6. image-compare 的一组初始 metadata 没有遮住确认按钮，造成不应使用的差异；metadata 修正
   后重跑并保留 v2 结果。请确认最终引用的比较文件没有混入初始失败结果。

7. 当前字节最后一次移动端 swipe 仍失败后，回读 React Native `Pressable` owning source 确认
   Pressability 覆盖了同名 responder prop；最终修复将 `InputSurfaceFrameContents` 的共享
   表面从 `Pressable` 改为普通 `View`，保留直接 surface 的 keyboard dismiss，并让嵌套
   `PrimitiveScrollView` 使用真实 responder。最终 APK 已重新构建、移动端真实 swipe 成功，
   详见 `doc/evidence/platform/2026-09-14-v2s-terminal-sample2-cp7-dynamic-evidence-codex.md`。

### 分档边界

| 档位 | 当前状态 | 不得扩写为 |
| --- | --- | --- |
| static | PASS（本回合门与源码核对） | 行为、视觉或 Android 全量 PASS |
| focused | PASS（已执行包与通用 red runner） | Web、Android、visual |
| native | PASS（CP-6 named Kotlin/unit proof） | 真机、Android IME 或 release |
| Android | PARTIAL | 完整 A/F、完整视觉验收 |
| Web | NOT_RUN（遵守不使用 computer use） | Web PASS |
| release | NOT_RUN | release PASS |
| visual/quantified ROI | PARTIAL（已有历史 directed pairs，并补 fresh laptop 主/副屏 w1↔w2 双向对） | 全 ordered-pair、全屏像素验收 |
| cleanup | PASS（F-A5d 回合、F-A9_RUNTIME 回合及本回合 fresh A3 pair 均有精确目标与 absence readback） | 其他档位自动 PASS |

## 独立核验重点

请先读当前 owning source，再对照需求、详设、计划和 evidence；不要先采信计划的 MATCHED 或
作者的自报数字。重点核验：

1. `WallpaperPicker` 是否只通过真实控件产生 UI intent，再由 picker actor 决定 kernel change
   command；相同 effective 选项与 disabled confirm 的边界，必须区分“无 kernel command”和
   “无 UI intent”。
2. `WallpaperBackground` 是否只读 confirmed；pending 选择不会提前改变 background；none 与
   w1/w2/w3 的 source 是否由独立直接 import oracle 对照，而不是从被测 `assetsById` 自证。
3. 透明 container 是否只影响 picker/waiting/welcome，且 wallpaper 的真实 children 层级不会被
   不透明 `ScreenContainer` 或普通流布局盖住；检查 A2 与 F-A2a 的判据是否真的能把 opaque
   变异弄红。
4. laptop 两块 surface 是否用同一 confirmed selector；两块 ROI 各自变化、asset identity 相同、
   换另一张确认后二者再次变化；检查当前部分 ROI 证据与完整 A3 需求之间的差距。
5. mobile 是否只创建 PRIMARY，逻辑尺寸确为 360×640，Android 的 720×1280 仅为 VM 物理尺寸；
   `smallestScreenWidthDp`、方向锁、launch options、configuration change 与 display index 不
   得被混用或二次推导。
6. float/layer persistence 是否保留 containers、顺序、props、openedAt、workspace 反向清理和
   install 期 catalog membership；未知/不可用/重复/非法行的诊断与 flush 不能被误读成 availability
   过滤。
7. 两个现有 integration 是否均遵守 TR-13：package.json、`src/dependencies.ts`、同一 catalog
   中的 `adminShellAssembly.parts` 和生产 `AdminLauncher` 四处必须互相一致，不能只检查一个样板。
8. package/graph/layering/generated Android set 是否逐文件闭合；特别检查 sample2 `app.json`、
   Android namespace/applicationId、assets、autolinking 与当前实际 import/dependency 集合。
9. 逐条复核 A1-A9 与 F-A2a/F-A2b/F-A2c/F-A2/F-A3a/F-A3b/F-A5/F-A5_RUNTIME/F-A5b/F-A5d/F-A7/F-A9/F-A9_RUNTIME；
   每一项标 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE` 或
   `UNVERIFIED_REQUIRES_EVIDENCE`，并说明证据档位。红夹具若没有真实使判据失败，请直接指出。
10. 既有 sample-terminal 回归不只看一次旅途：检查需求规定的已认证、存在 pending、登出后三个
    冷启动边界是否确有实际证据；不要以一次旅途的成功文本替代完整回归矩阵。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M/S/N` 计数。每条 finding 请给出：

- 状态：`CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、
  `UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`；
- 仓库根相对路径、行号或唯一符号；
- 失败场景、影响面、最小修复方向，以及为什么更小方案不足；
- 该项是仓内事实、推论、产品判断还是尚缺证据的假设；
- 是否需要 Dexter 产品/范围/证据授权。

请单独列出：

1. 被你推翻的 Codex 当前结论；
2. 当前文档/实现漏掉但本批必须回答的问题；
3. implementation acceptance 与 Web/release/visual 尚未执行之间的关系；
4. 既有 warning、首次点按未命中、错误 Metro 入口和副屏 SurfaceFlinger id 失败的归因。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助对 TER sample2 壁纸终端当前实现做 fresh 独立 implementation review。

背景：Dexter 已授权按需求、详设与实施计划实施 sample2 壁纸终端；当前 CP-0 至 CP-8 已有部分源码、focused、native、Android 和 cleanup 证据，CP-7 当前状态为 `ANDROID_DYNAMIC_PARTIAL_WITH_OPEN_REVIEW_ITEMS`。本次不是请你把计划或自报数字当成完成证明，而是请你从当前 owning source、详设、计划和 evidence 重新判断实现是否成立。

目标：请独立核验当前实现的 architecture、contract、boundary、用户可见行为与分档 evidence 是否真实闭合。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md`：需求正本；
- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md`：详设与 A/F 锚点；
- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-plan-codex.md`：CP 顺序、逐代码对账与结束闸门；
- `doc/platform/terminal-coding-standard.md` 与 `project-memory/decisions/terminal-integration-admin-console-invariant.md`：规范与 integration 共同不变量；
- `doc/evidence/platform/2026-09-13-v2s-terminal-sample2-cp0-execution-codex.md` 至 `...cp7-execution-codex.md`：真实输出、首败、动态边界和 cleanup；
- `apps/terminal/kernel/feature/sample-wallpaper`、`apps/terminal/ui/feature/sample-wallpaper-picker`、`apps/terminal/ui/integration/sample-wallpaper-console`：本批核心实现；
- `apps/terminal/ui/integration/sample-console`、`apps/terminal/assembly/android/sample-wallpaper-terminal`、`apps/terminal/assembly/android/sample-terminal`、`apps/terminal/adapter/android/dual-screen`：integration/admin 接入、Android 入口、既有回归和形态判定；
- `apps/terminal/ui/base/primitives`、`apps/terminal/ui/base/render`、`apps/terminal/kernel/base/ui-state`：共享 seam、surface 与浮层持久化 owner；
- `tools/terminal-image-compare` 及 CP evidence 中引用的 red runner：比较工具与可证伪性。

请重点独立核验：pending/confirmed 与真实控件命令链、透明容器下 wallpaper 的真实可见性、laptop 双屏同一 confirmed selector、mobile 360×640 单屏、浮层恢复、两个 integration 的 TR-13 接入、sample-terminal 冷启动回归、Android generated set，以及 A1-A9 与全部 F 红夹具是否实际可证伪。请区分 static、focused、native、Android、Web、release、visual、cleanup；不要把局部截图、欢迎文本、计划、静态门或历史证据扩写为完整 implementation acceptance 或 visual PASS。当前 Web/release 未执行，且本轮明确不使用 computer use。

请给出明确 `GO` 或 `NO-GO` 与 `M/S/N` 计数。每条 finding 标注 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`，并给出仓根相对路径与行号/唯一符号、失败场景、影响面、最小修复方向、为什么更小方案不足、证据档位和是否需要 Dexter 裁决。请另列被你推翻的 Codex 结论，以及当前批次漏掉但必须回答的问题。

授权边界：本 handoff 请求的是对当前 implementation 与证据的独立 review，不授权扩范围、改需求、Web/release/visual 动态操作、后台 DEV、seed、UAT、部署或 Git。若发现代码问题，请先指出，不要自行修改仓库。谢谢。
```
