# Claude review request：TER feature 端主副屏状态与命令归属评估

REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码事实提取
REVIEW_SCOPE=静态源码、项目规范、项目记忆与两个仓外 POC 的机制对照
AUTHORITY=本请求只申请 review，不授权修改源码、测试、脚本、依赖、构建产物或运行环境

## 背景

Dexter 新增并要求固化一条 TER feature 端设计原则：**`MAIN` 只能主机的 actor 执行 command
写入 slice。`BRANCH` 只能副机的 actor 执行 command 写入 slice。** 无论单机双屏还是双机双屏，
副屏业务内容都由主机的 command 与 actor 处理；主机修改 `MAIN` 内容 slice 的 `SECONDARY` 内容，
再由 state 驱动副屏 UI。副屏用户操作回到主机，由主机处理业务 command。副机切换到主屏后进入
`SLAVE + PRIMARY → BRANCH`，UI 与 command 都由副机本地处理。

本次 Codex 已对照两个仓外 POC（`../_old_`、`../newPOSv1`）和当前 TER 源码完成静态评估，
并把规则写入终端设计规范与项目记忆指针。没有执行构建、测试、Web、Metro、Android、设备、
双机 runner 或部署动作，也没有修改 production/test/script/依赖代码。

## 评审目标

请站在实施方和框架 owner 的角度，先独立判断这条 feature 端 owner 原则是否真能由当前 TER
的 workspace、state projection 与 dispatch boundary 承接，再逐条核验报告中的 M/S/N。重点不是
采信作者结论，而是判断：

1. 单机双屏和双机双屏是否都由主机 `MAIN` secondary state 驱动，并且是否满足 `MAIN/MASTER`、
   `BRANCH/SLAVE` 的写入归属规则；
2. 副屏用户操作是否确实回到主机 actor；
3. 副机切成 `PRIMARY/BRANCH` 后，UI 与 command 是否都在副机本地闭环；
4. 当前实现是否存在更小的修复边界，或报告把某个职责错误地推给了 topology base。

## 需阅读文件

- 评估报告：`doc/review/platform/2026-09-18-ter-feature-topology-ownership-evaluation-codex.md`
- 规范正本：`doc/platform/terminal-coding-standard.md` §4-D
- 项目记忆指针：`project-memory/decisions/terminal-architecture-and-stack-rulings.md` 中
  `TER_FEATURE_TOPOLOGY_OWNERSHIP`
- TER 状态与 workspace：
  - `apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts`
  - `apps/terminal/kernel/base/ui-state/src/selectors/selectContent.ts`
  - `apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts`
- TER topology 与命令边界：
  - `apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts`
  - `apps/terminal/kernel/base/topology/src/selectors/selectTopologyFacts.ts`
  - `apps/terminal/kernel/base/topology/src/foundations/resolveCommandTarget.ts`
  - `apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts`
  - `apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts`
  - `apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts`
  - `apps/terminal/kernel/base/ui-state/src/features/actors/contentActors.ts`
  - `apps/terminal/kernel/base/ui-state/src/features/commands/index.ts`
  - `apps/terminal/kernel/base/state/src/foundations/createStateStore.ts`
  - `apps/terminal/kernel/base/contracts/src/types/topology.ts`
  - `apps/terminal/kernel/base/runtime/src/foundations/createCommandDispatcher.ts`
- sample feature/integration：
  - `apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts`
  - `apps/terminal/ui/feature/sample-member-desk/src/components/CustomerMember.tsx`
  - `apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx`
  - `apps/terminal/ui/feature/sample-member-desk/src/components/WithdrawConfirm.tsx`
  - `apps/terminal/ui/feature/sample-member-desk/src/parts/parts.ts`
  - `apps/terminal/ui/integration/sample-wallpaper-console/src/features/actors/actors.ts`
  - `apps/terminal/ui/integration/sample-wallpaper-console/src/parts/parts.ts`
  - `apps/terminal/ui/integration/sample-console/src/moduleName.ts`
  - `apps/terminal/ui/integration/sample-wallpaper-console/src/moduleName.ts`
  - `apps/terminal/ui/integration/sample-wallpaper-console/README.md`
- 既有 focused 覆盖：
  - `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx`
  - `apps/terminal/kernel/base/topology/test/topology.test.ts`
  - `apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx`
- POC 对照（仓外 sibling source，不属于当前仓运行时）：
  - `../_old_/2-ui/2.3-integrations/mixc-retail/src/features/actors/navigate.ts`
  - `../_old_/2-ui/2.3-integrations/mixc-retail/src/hooks/useDisplaySwitchConfirm.ts`
  - `../_old_/2-ui/2.3-integrations/mixc-retail/src/ui/screens/RootScreen.tsx`
  - `../newPOSv1/1-kernel/1.1-base/ui-runtime-v2/src/features/slices/screenState.ts`
  - `../newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2-live-screen-master-to-slave.spec.ts`
  - `../newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2-live-branch-screen-slave-to-master.spec.ts`
  - `../newPOSv1/1-kernel/1.1-base/topology-runtime-v3/src/foundations/runtimeDerivation.ts`

## Codex 当前静态结论

```text
VERDICT=NO-GO
M/S/N=3/3/2
L1_ENGINEERING=NO-GO：双机 secondary projection、wallpaper paired-single-screen eligibility、SLAVE/PRIMARY/BRANCH local loop 未由当前源码闭合。
L2_USER_VISIBLE=NO-GO：副屏内容、确认操作与副机脱离后的本地操作存在 owner 分裂或未闭合路径。
L3_UNVERIFIED=focused、native/Android、device、Web、visual/release、cleanup 与所有运行期行为 OPEN。
EVIDENCE_TIER=static source + POC source comparison only
```

### Major findings

1. `M-1`：双机 secondary 的 peer receiver 归一后会由副机 actor 按当前 `MAIN` workspace 写入
   副机自己的 MAIN；当前也没有 `MAIN secondary content → SLAVE projection → 副屏 render` 的闭合
   证据。另有两处 prune actor 直接 dispatch content action，绕过只覆盖四处的
   `dispatchContentAction`；实施修法必须穷举六处写入，且不能拦截独立的
   `APPLY_AUTHORITATIVE_SYNC` 投影 action。
2. `M-2`：`sample-wallpaper-console` 仍用只表达本机物理屏数的
   `resolveSecondarySurfaceAvailable`，会拒绝“单屏主机 + 已配对副机”的远端 secondary。
3. `M-3`：`SLAVE + PRIMARY → BRANCH` 的基础 derivation 已有，但 sample feature 没有对应
   BRANCH production parts/本地 command 闭环，且 `peer-intent` resolver 只看 `SLAVE && paired`。

### Significant findings

1. `S-1`：当前 topology sync 只覆盖 members，缺少 workspace 级 UI content projection contract；
   现有 `SyncIntent`/workspace descriptor 已提供可复用词汇，不应为每个 feature 另造 projection contract。
2. `S-2`：`peer-intent` 同时覆盖副屏回主机和副机 PRIMARY/BRANCH 操作，workspace 边界不足。
3. `S-3`：topology base 硬编码 sample members slice，不能承接通用 feature projection owner。

### Notes

1. `N-1`：`sample-member-desk` 的 paired single-screen slave-local secondary fallback 会让副机
   actor 自建 MAIN 事实；`_old_` 的历史 effect-like monitor 仍不应照搬，只采用其 role/workspace owner 语义。
2. `N-2`：当前 `memberDesk.test.tsx` 存在 `memberActions` 公共导入的既有 TS2305 证据；本轮未重跑，
   不能把它或历史日志升级为本轮 focused PASS。

## 独立核验重点

1. 不要只回读报告结论。请从当前字节重开 `workspaceSlices`、`selectContent`、topology state
   sync、target resolver、两个 sample actor 和 parts 声明，判断 M-1/M-2/M-3 是否确实成立。
2. 反例验证：
   - 主机只有一块物理屏但已配对副机时，wallpaper 是否仍能创建 secondary placement；
   - 主机 secondary 内容是否由 MAIN slice 的状态变化驱动，而不是 peer 直接执行一次 show；
   - 副机 PRIMARY/BRANCH 上的 command 是否 local，而不是仅因 `SLAVE && paired` 仍 peer；
   - topology recovery 后是否存在 feature actor 自行重放副屏 UI 的第二事实源。
3. 对照 `../newPOSv1` 的 live master-to-slave 与 branch scenario，判断当前 TER 的 members-only
   sync 能否等价承接用户要求；不要把同一 VM 的 multiple surface 误当双机 state projection。
4. 检查新增的规范 §4-D 是否与现有 TR-01、TR-11、TR-12、4-A 的 command/actor、workspace、
   displayMode 语义一致；若规则本身过强或缺少明确适用边界，请给 finding。
5. 对每条 finding 给出 `CONFIRMED`、`PARTIALLY_CONFIRMED`、`REJECTED_WITH_EVIDENCE` 或
   `UNVERIFIED_REQUIRES_EVIDENCE`，并写 owning source、反例和最小替代；不要用测试名、路径命中或
   退出码代替业务 oracle。
6. 本轮不要求运行动态验证；若认为必须运行，须明确它属于 `focused`、`native/Android`、
   `device` 或其他证据档位，不能把静态结论升格为 runtime PASS。

## 期望结论

请给出 `GO` 或 `NO-GO`，并报告 `M`、`S`、`N` 数量。请同时给出：

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A 代码事实提取
VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO
M/S/N=<数量>
L1_ENGINEERING=<PASS / findings>
L2_USER_VISIBLE=<PASS / findings>
L3_UNVERIFIED=<逐条列出>
SAME_ROOT_SCAN=<每条 finding 的扫描全集与判定>
DESIGN_GAPS=<详设/规范缺口，或空>
EVIDENCE_TIER=<static/focused/native/Android/device/Web/visual/release/cleanup 分档>
```

## 授权边界

本轮只请 Claude 和 Dexter review 评估报告、规范落点与当前源码事实，不授权实施或修改源码、测试、
脚本、依赖、构建产物和运行环境。若 review 认为产品/Journey owner、是否支持某个 feature 的
`BRANCH` 形态或 projection 范围需要裁决，请单列为 `DEXTER_DECISION`；不要在评审中自行扩大范围。
本报告的 `NO-GO` 不是 Android/Web/release/acceptance 结论，动态证据仍为 `OPEN`。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审 TER feature 端主副屏状态与命令归属评估。

背景：Dexter 要求固化一条 feature 端正式规则：**MAIN 只能主机的 actor 执行 command 写入 slice。BRANCH 只能副机的 actor 执行 command 写入 slice。** 由此导出单机双屏与双机双屏的副屏业务内容都由主机 command/actor 处理，主机修改 MAIN 内容 slice 的 SECONDARY 内容并由 state 驱动副屏；副屏操作回到主机处理；副机切到 PRIMARY 后进入 BRANCH，由副机本地驱动 UI 与 command。Codex 已对照 ../_old_、../newPOSv1 两个仓外 POC 与当前 TER 源码完成静态评估，结论为 NO-GO，M/S/N=3/3/2。没有运行构建、测试、Web、Metro、Android、设备或部署，也没有修改源码、测试、脚本、依赖或构建产物。

目标：请不要采信报告结论，独立核验当前 TER 是否真正满足三种形态的 owner 边界，并验证 M-1/M-2/M-3、S-1/S-2/S-3、N-1/N-2 是否成立；特别检查双机 MAIN secondary projection、`MAIN/MASTER` 与 `BRANCH/SLAVE` 归属门、单屏主机已配对副机的 wallpaper eligibility，以及 SLAVE/PRIMARY/BRANCH 下的本地 command 闭环。

请从 catering-v2s 仓库根阅读：
- doc/review/platform/2026-09-18-ter-feature-topology-ownership-evaluation-codex.md：静态评估与 finding；
- doc/platform/terminal-coding-standard.md：§4-D 新增 feature owner 规范，以及 TR-01、TR-11、TR-12、§4-A；
- project-memory/decisions/terminal-architecture-and-stack-rulings.md：TER_FEATURE_TOPOLOGY_OWNERSHIP 与既有 workspace/topology 规则；
- apps/terminal/kernel/base/ui-state/src/foundations/workspaceSlices.ts、apps/terminal/kernel/base/ui-state/src/selectors/selectContent.ts：MAIN/BRANCH 内容来源；
- apps/terminal/kernel/base/display-context/src/foundations/displayDerivation.ts：display/workspace 推导与物理屏 helper；
- apps/terminal/kernel/base/topology/src/foundations/evaluateTopologyOperation.ts、apps/terminal/kernel/base/topology/src/selectors/selectTopologyFacts.ts、apps/terminal/kernel/base/topology/src/foundations/resolveCommandTarget.ts：拓扑资格与命令目标；
- apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts、apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts、apps/terminal/kernel/base/topology/src/application/createTopologyPeerCommandController.ts：状态同步、接收归一与恢复路径；
- apps/terminal/ui/feature/sample-member-desk/src/features/actors/actors.ts、apps/terminal/ui/feature/sample-member-desk/src/parts/parts.ts、apps/terminal/ui/feature/sample-member-desk/src/components/CustomerMember.tsx、apps/terminal/ui/feature/sample-member-desk/src/components/MemberForm.tsx、apps/terminal/ui/feature/sample-member-desk/src/components/WithdrawConfirm.tsx：feature actor、part 与副屏操作；
- apps/terminal/ui/integration/sample-wallpaper-console/src/features/actors/actors.ts、apps/terminal/ui/integration/sample-wallpaper-console/src/parts/parts.ts：wallpaper placement；
- apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx、apps/terminal/kernel/base/topology/test/topology.test.ts、apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx：现有行为覆盖；
- ../_old_/2-ui/2.3-integrations/mixc-retail/src/features/actors/navigate.ts、../newPOSv1/1-kernel/1.1-base/ui-runtime-v2/src/features/slices/screenState.ts、../newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2-live-screen-master-to-slave.spec.ts、../newPOSv1/1-kernel/1.1-base/ui-runtime-v2/test/scenarios/ui-runtime-v2-live-branch-screen-slave-to-master.spec.ts：两个 POC 的 owner/sync 对照；这些是仓外 sibling source，不是当前仓运行时依赖。

请重点独立核验：
1. 主机已配对但只有一块物理屏时，wallpaper 是否仍能创建远端 SECONDARY placement；不得用物理双屏 helper 代替 topology 资格。
2. 双机 secondary 是否由主机 MAIN state 投影驱动，还是只由 peer 直接执行一次 show 或由副机 recovery actor 重放；确认副机 actor 写 MAIN 的路径会被公共 write seam 归属门阻断。
3. 副机 PRIMARY/BRANCH 的 feature UI 与 command 是否本地闭环；不能只因 SLAVE && paired 就继续 peer。
4. 当前 topology sync 是否只有 members；现有 `SyncIntent`/workspace descriptor 是否足以复用为
   workspace 级 projection，且 focused 测试是否真的覆盖 UI content projection 与 branch local command。
5. `contentActors.ts` 的六处生产 `contentActions.*` 派发是否都具备 `MAIN/MASTER`、`BRANCH/SLAVE`
   的 fail-closed 归属判定；prune 是否只清本机 workspace；单机共享 store 的合规路径不得被误判。
6. 对每条 finding 给出 CONFIRMED、PARTIALLY_CONFIRMED、REJECTED_WITH_EVIDENCE 或 UNVERIFIED_REQUIRES_EVIDENCE，说明 owning source、反例和最小修复；不要用路径字符串、测试名或退出码冒充业务 oracle。

烦请给出明确 GO 或 NO-GO，并报告 M/S/N 数量；每条 finding 请标明精确路径/行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。请区分 static、focused、native/Android、device、Web、visual/release、cleanup 证据档位。

授权边界：本次只请评估报告、规范落点与当前源码事实，不授权实施或修改源码、测试、脚本、依赖、构建产物和运行环境。评审结论不代表 Android、Web、release 或 acceptance PASS；动态证据仍为 OPEN。
```
