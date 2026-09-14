# TER sample2 壁纸终端详设与实施计划复评交接

REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
DESIGN_STATUS=OPEN_FOR_REVIEW
PLAN_STATUS=OPEN_FOR_REVIEW
IMPLEMENTATION_AUTHORIZED=false
IMPLEMENTATION_PERFORMED=false
BUILD_EXECUTED=false
RUNTIME_EXECUTED=false
INDEPENDENT_SUBAGENT_REVIEW=NOT_RUN
PREVIOUS_REVIEW=NO-GO;M/S/N=6/11/9
CURRENT_REMEDIATION=DOCUMENTS_UPDATED;REQUIRES_INDEPENDENT_RECHECK

## 背景

sample2 壁纸终端的上一轮 implementation-facing 详设与实施计划复评为
`NO-GO; M/S/N=6/11/9`。本轮只修订详设与实施计划，没有修改产品源码、测试、依赖、脚本或
构建产物，也没有执行 Metro、Web、Android、native、虚拟机、release、DEV、seed、UAT 或部署。

本轮交付文件：

- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md`
- `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-plan-codex.md`
- 本文件：请求 Claude 对修订后的 implementation-facing 详设与计划重新独立复评。

上一轮的六项 M、十一项 S、九项 N 已逐项写入修订后的设计/计划落点，但这些文字不是实现
证据，也不是 reviewer 的 PASS。特别是未来 `tools/terminal-image-compare` 仍未创建，CP-0
的 Metro/JPG/type declaration 实测仍未执行，所有动态档位仍是 OPEN。

本轮没有新增 Dexter 产品裁决。A3 的三条行为 oracle 已按需求正本当前字节冻结：确认后两屏
wallpaper ROI 各自变化、两屏 asset identity 相同、换另一张确认后两屏再次各自变化；不做
跨尺寸 raw-pixel equality。若复评认为当前需求字面与 implementation-facing 技术取法仍有
冲突，必须标为 `DEXTER_DECISION` 或 `UNVERIFIED_REQUIRES_EVIDENCE`，不能静默替选。

## 评审目标

请先打开当前 owning source，再阅读需求正本、规范、修订后的详设和计划。不要把上一轮处置表、
本文件的 remediation summary、计划中的 gate 或自检数字当成质量证明。

请独立判断：

1. 六项 M 是否真的被最小且可实施的设计闭合，而不是换了措辞；
2. 十一项 S 是否有明确 owner、失败行为、测试/红夹具和证据落点；
3. 九项 N 是否已降为清楚的实现注意事项，或仍隐藏着会升级为阻断的漏洞；
4. 一个未参与前序讨论的实施者能否按 CP-0 至 CP-9 开工，且中间骨架/分层门不会结构性假红；
5. 详设是否仍误把计划、未来工具或静态材料写成动态行为证据，是否保留了任何未登记的事实、
   owner、UI、范围或产品语义缺口。

## 需阅读文件

请从 `catering-v2s` 仓库根按下列顺序阅读：

1. `doc/platform/terminal-coding-standard.md`：TER owner、slice、descriptor、command/actor、
   UI、Android、README 和证据约束；
2. `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md`：
   当前需求、A1-A9、F 夹具、A3 三条现行 oracle、范围与 Android 形态语义；
3. `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md`：
   修订后的 IA、owner、state/layer、19 token、Android 形态、截图方法、positions 和场景；
4. `doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-plan-codex.md`：
   CP-0 至 CP-9 的顺序、原子骨架同步、逐代码对账、交叉矩阵、红夹具和动态证据计划；
5. `doc/review/platform/2026-09-13-v2s-terminal-sample2-wallpaper-design-review-claude.md`：
   上一轮独立复评的 6M/11S/9N 原始问题；只作 finding 输入，不作事实证明；
6. `apps/terminal/ui/base/primitives/src/vendor/slots.tsx`、
   `apps/terminal/ui/base/primitives/src/components/PrimitiveContainer.tsx`、
   `apps/terminal/ui/base/primitives/src/theme/tokens.ts`、
   `apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx`：Image 接缝、透明容器、
   children/ScreenContainer/LayerStack 顺序；
7. `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts`、
   `apps/terminal/kernel/base/ui-state/src/application/createUiStateModule.ts`、
   `apps/terminal/kernel/base/ui-state/src/features/contentActors.ts`、
   `apps/terminal/kernel/base/ui-state/src/types/content.ts`：descriptor、hydrate、install、
   catalog membership、availability 和四格 layer 语义；
8. `apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx`、
   `apps/terminal/ui/integration/sample-console/src/parts/parts.ts`、
   `apps/terminal/ui/feature/sample-staff-auth/src/parts/parts.ts`：现有 catalog、placement、
   part owner、application/terminalSurfaces/baseModuleDescriptors 形态；
9. `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`：
   `onDidCreateReactActivityDelegate`、display snapshot、Bundle、方向和 configuration 路径；
10. `apps/terminal/assembly/android/sample-terminal/app.json` 与
    `apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml`：
    既有方向锁和回归边界；
11. `apps/terminal/skeleton-graph.ts`、`tools/terminal-skeleton/check-static.mjs`、
    `tools/terminal-skeleton/check-static.test.mjs`、`tools/terminal-layering/check-static.mjs`：
    当前节点/计数/reachability/分层实现，核对计划的原子同步和真实目录 census 是否可行；
12. `project-memory/index.md`、本任务路由命中的原始 project-memory entries、`scripts/README.md`、
    `doc/platform/claude-review-handoff-template.md` 与 `scripts/check/claude-review-handoff`：
    owner、三维对账、失败诊断、cleanup、证据分档和交接边界。

两版 POC 和旧 review 只能作为历史背景；请自行以当前 owning source 为准。

## 独立核验重点

### A. 六项 M 的闭合性

1. **M-01 Android 形态判定**：详设/计划改为在 `onDidCreateReactActivityDelegate` 读取
   `activity.resources.configuration.smallestScreenWidthDp`，先在两台 VM 取得 mobile=`m`、
   laptop=`l`，冻结 `floor((m+l)/2)+1`，方向只用于判定后的 orientation lock；
   `onConfigurationChanged` 不重算，真实 delegate 重建才重读。请核这是否真正消除了当前 window
   宽高、方向锁自反馈和形态随机性；也请核需求正本 §5.2.1 的“DisplayMetrics/方向”字面是否
   与这项 implementation-facing 取法一致，若不一致请明确指出而不是替选。
2. **M-02 截图执行体**：详设把 `tools/terminal-image-compare/compare.mjs` 登记为第 12 个、仅
   证据支持位置，规定 content/canvas/foreground mask、ROI ≥20%、mask ≤80%、baseline、
   changedFraction/P95/meanAbsDiff/8×8 changedCellFraction、known-PNG self-test 和 mutation。
   当前工具尚不存在；请核“有唯一未来执行体”是否被误写成“现已实现”，阈值是否可证伪且没有
   用静态/人工观察冒充定量执行。
3. **M-03 CP 顺序和骨架门**：CP-2/4/5/7 各自创建包时，同一原子组更新 graph node、工具期望值、
   静态测试和 reachability/分层分母；预期节点序列为 27→28→29→30→31，batch 为
   15/27→15/28→15/29→15/30→16/31。请核 CP-2 至 CP-7 不会在包先出现而门必红的中间态，
   且 CP-8 没有被假定为事后修补步骤。
4. **M-04 CP-0**：临时 probe 必须放在已有 `sample-staff-auth`，经已有 sample-console 和
   sample-terminal Metro entry，实测 workspace `.jpg` 与 TS declaration 后完全清理；请核它
   没有引用尚未创建的 picker 包或 `assetsById`，没有把未来 probe 结果写成当前 PASS。
5. **M-05 integration 清单**：请核 `package.json` 的 `main`/`react-native`/`exports`/`terminalSurfaces`、
   `index.js`、`src/application/terminalSurfaces.ts`、`src/application/baseModuleDescriptors.ts`、
   metro/babel/nativewind/type declaration 等是否完整；`portrait.PRIMARY` 的 720×1280 是否
   明确只属于 sample2，而不是复制 sample-console 的 360×800。
6. **M-06 红夹具可证伪性**：F-A2b 使用独立的 w2 期望而非被测 `assetsById`；F-A7 读精确 token 值、
   HSL、实际 action/error 上下文；F-A3a/F-A3b 对冻结 A3 三条行为 oracle；F-A5d 检查确认后
   pending 是否在重启复活；F-A9 检查 mobile 的 SECONDARY surface/dispatch。请实际构造恶意
   合规实现，判断每条是否必红。

### B. 十一项 S 的落点

- S-01：`configChanges` 下 split/fold 只冻结、不重判；真实 delegate 重建才重读；
- S-02：`pruneHydratedLayersCommand` payload 为空，由 install actor 自己遍历四格计算 removals；
- S-03：`applyEntries` 只替换 layers，混合存档必须保留 containers；
- S-04：写入和 hydrate 共用 `isValidOpenedAt`；
- S-05：known-but-unavailable 只在 render 过滤，不因可用性变化反复 write/flush，直至 close 或
  membership removal；
- S-06：baseline 仅是稳定性门，不乘 10B；业务阈值同时受 ROI、P95、mean 和 grid coverage 约束；
- S-07：A3 不再依赖未定义的比较样本或 raw-pixel equality，改用三条冻结行为 oracle，
  且 identity 取自实际 WallpaperBackground render/readback；
- S-08：A9 增加 mobile 的真实 surface/dispatch readback 与“创建 SECONDARY”变异；
- S-09：A8 既有 sample-terminal 旅途在已认证、存在 pending、登出后三个边界各有冷重启回归；
- S-10：ROI/mask 有最小面积和最大遮罩约束，无法建立唯一映射即 OPEN；
- S-11：skeleton 的 27/15/27 基线和 28/29/30/31、16/31 目标随建包 CP 原子更新，且有删除/漏
  声明 mutation，而不是由最终 count 自证。

### C. 九项 N 的反例复核

请额外核对：N-01 是否已经去掉 baseline 的无效乘数；N-02 的 B=0 只代表一次稳定基线而不是
正确性；相同 canvas/host geometry 的重复捕获是否有断言；A5d 是否包含真实 state transition；
主/副屏 Bundle 是否只有一个 helper（N-05）；N-03 的相同 canvas/host geometry 重复捕获是否
有断言；N-04 的 A5d 是否包含真实 state transition；N-06 的 `readDisplaySnapshot` primary-only、
缺失和双屏分支是否逐分支可测；N-07 的 workspace 是否仍进入 diagnostic；N-08 的
`skeleton-graph.ts` 是否在 product/tool 清单中；N-09 的 layering 是否已改为真实 integration
directory census 而非 sample-console 硬编码。

### D. 三维对账与证据边界

请确认所有 design/plan 表格只把未实施内容写为 `OPEN`，没有把计划、静态、focused、欢迎语
完整、历史 clean debug 或 tool specification 升格为 dynamic PASS。当前不得执行任何源码、
构建、Metro、Web、Android、VM、native、release、DEV、seed、UAT 或部署动作；本轮是文档复评。

## 期望结论

请给出明确的 `GO` 或 `NO-GO`，并报告 `M/S/N` 数量。每条 finding 必须标注：

- `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、
  `UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`；
- 仓库根相对路径与行号或唯一符号；
- 失败场景、影响面、最小修复方向；
- 为什么更小的修复不够；
- 是否需要 Dexter 裁决。

请单独列出：

1. 你推翻的本轮 remediation 结论；
2. 详设阶段新发现的需求、范围、owner、UI、证据或方案缺口；
3. 仅属未来实施/动态证据的 OPEN，不要把它们错误计成当前源码已经失败或已经通过。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER sample2 壁纸终端修订后的 implementation-facing 详设与实施计划做第二轮独立复评。

背景：上一轮对
doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md
和
doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-plan-codex.md
给出 NO-GO，M/S/N=6/11/9。我们已按上一轮 findings 修订两份文档，但没有修改源码、测试、依赖、脚本或构建产物，也没有执行 Metro、Web、Android、native、虚拟机、release、DEV、seed、UAT 或部署。本轮没有新增 Dexter 产品裁决；A3 的三条行为 oracle 已按需求正本当前字节冻结。

目标：请判断修订后的详设与计划是否真的闭合上一轮 6M/11S/9N，是否足以让未参与前序讨论的实施者按 CP-0 至 CP-9 开工，并找出仍会在实施阶段静默漂移的事实、owner、UI、骨架、证据或方案问题。

请先从仓库根阅读当前 owning source，再读：
- doc/platform/terminal-coding-standard.md：规范正本；
- doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-requirements-claude.md：当前需求、A1-A9、F 夹具、A3 三条冻结 oracle；
- doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-design-codex.md：修订详设；
- doc/plans/platform/2026-09-13-v2s-terminal-sample2-wallpaper-implementation-plan-codex.md：修订计划；
- doc/review/platform/2026-09-13-v2s-terminal-sample2-wallpaper-design-review-claude.md：上一轮 NO-GO 的原始 finding 输入；
- apps/terminal/ui/base/primitives/src/vendor/slots.tsx、apps/terminal/ui/base/primitives/src/components/PrimitiveContainer.tsx、apps/terminal/ui/base/primitives/src/theme/tokens.ts、apps/terminal/ui/base/render/src/components/SurfaceRoot.tsx：Image seam、透明容器和 children 顺序；
- apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts、apps/terminal/kernel/base/ui-state/src/application/createUiStateModule.ts、apps/terminal/kernel/base/ui-state/src/features/contentActors.ts、apps/terminal/kernel/base/ui-state/src/types/content.ts：layers hydrate/install、containers 保留、openedAt、workspace、membership/availability；
- apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx、apps/terminal/ui/integration/sample-console/src/parts/parts.ts、apps/terminal/ui/feature/sample-staff-auth/src/parts/parts.ts：现有 catalog、placement 和 package 形态；
- apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt：delegate、snapshot、Bundle、方向和 configuration；
- apps/terminal/assembly/android/sample-terminal/app.json、apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml：既有方向锁；
- apps/terminal/skeleton-graph.ts、tools/terminal-skeleton/check-static.mjs、tools/terminal-skeleton/check-static.test.mjs、tools/terminal-layering/check-static.mjs：节点/计数/reachability/真实目录 census；
- project-memory/index.md、命中的原始 project-memory entries、scripts/README.md、doc/platform/claude-review-handoff-template.md、scripts/check/claude-review-handoff：项目约束、失败/cleanup、证据分档与交接规范。

请重点核验：
1. Android 是否已从易被 orientation lock 反馈污染的 window 宽高改为 delegate 创建期的 stable `smallestScreenWidthDp`，两台 VM 实测值是否只用于冻结阈值；configuration change 是否不重算，真实 delegate 重建是否重读；并核需求正本 §5.2.1 的 DisplayMetrics/方向字面是否与此技术取法一致；
2. `tools/terminal-image-compare` 是否只是未来唯一执行体而非被误写成现有证据，ROI/mask、baseline、changedFraction/P95/mean/grid 指标、阈值、metadata 和 known-PNG mutation 是否足以证伪；
3. CP-2/4/5/7 建包时 graph node、skeleton 期望值、静态测试、reachability 和 layering census 是否原子同步，目标序列是否为 27→28→29→30→31（batch 15/27→15/28→15/29→15/30→16/31），CP-8 是否不再承担事后修补；
4. CP-0 是否确实在既有 sample-staff-auth + sample-console + sample-terminal Metro 路径上做临时 JPG/type probe，且清理后不残留、不引用未来 picker/assetsById；
5. integration 文件清单是否包含 `package.json` 的 main/react-native/exports/terminalSurfaces、index.js、metro/babel/nativewind/type declaration、`src/application/terminalSurfaces.ts` 与 `baseModuleDescriptors.ts`，以及 sample2 独有的 `portrait.PRIMARY=720×1280`；
6. F-A2b 是否使用独立 w2 oracle，F-A7 是否读取精确主题值/上下文，F-A3a/F-A3b 是否确实攻击 A3 三条冻结行为 oracle，F-A5d/F-A9 是否分别能打到 pending 复活与 mobile SECONDARY；
7. layers 的四格、containers 保留、统一 openedAt validator、unknown membership install 清理、known-unavailable 保留、workspace diagnostic 与无 availability-only flush 是否闭合；
8. A8 是否含已认证/pending/登出后的冷重启回归，A3 的 identity 是否从实际 render/readback 而非同一 selector 得出，readDisplaySnapshot 早退分支是否逐分支可测，Bundle 是否只有一个 helper，layering census 是否不再硬编码 sample-console。

请对每个上一轮 finding 做反例构造，不要只看绿色主路径，也不要采信本轮处置表、自检数字或计划中的“必须”。每条 finding 标注 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE`、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`，并给出仓库根相对路径与行号/唯一符号、失败场景、影响面、最小修复方向、为什么更小方案不够、是否需要 Dexter 裁决。另列你推翻的 remediation 结论和详设阶段新发现的问题。

请给明确 `GO` 或 `NO-GO` 以及 `M/S/N` 计数。注意：当前仍未实施源码、未运行动态验证；任何 OPEN、未来工具、static/focused 计划都不能写成 Android、Web、native、release 或 visual PASS。

授权边界：本轮只授权对需求、详设、实施计划和当前 owning source 的静态独立复评，不授权源码、测试、依赖、脚本或文档之外的实施改动，不授权构建、Metro、Web、Android、虚拟机、native、release、DEV、seed、UAT、部署或数据操作。谢谢。
```

交接校验命令：

```bash
scripts/check/claude-review-handoff --file doc/review/platform/2026-09-13-v2s-terminal-sample2-wallpaper-design-review-request-codex.md
```
