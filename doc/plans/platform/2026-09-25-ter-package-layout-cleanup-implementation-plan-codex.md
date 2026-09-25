# TER 包布局整理实施计划（v5）

> STATUS: IMPLEMENTATION_IN_PROGRESS
> REVIEW_TARGET: DESIGN
> REVIEW_CYCLE_ID: `TER_PACKAGE_LAYOUT_CLEANUP_2026-09-24`
> REVIEW_ROUND: 2（fresh 独立盲审已完成；第二轮后作者 SELF_DECIDED 收口）
> REVIEW_ROUND_LIMIT: 2
> ROUND_FINAL_DECISION: SELF_DECIDED（第二轮 findings 已逐条修订并回读；不再开启第三轮）
> SOURCE_REQUIREMENTS: `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md`
> SOURCE_SOLUTION: `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-solution-claude.md`
> IMPLEMENTATION_AUTHORITY: true（Dexter 2026-09-25 follow-up 授权；三处设计补齐后按本计划执行 CP-0 至 CP-4，并在单机双屏与 mobile 上完成授权动态验证）

本计划是 [`2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md`](./2026-09-25-ter-package-layout-cleanup-implementation-design-codex.md) 的执行顺序版本。v5 的 PL-R00 至 PL-R05、AC-0 至 AC-13、D-1 至 D-6 均为硬输入；计划不降低任何门，不把 `TR-08` 的 OPEN 改成关闭。Dexter 已在 2026-09-25 follow-up 中授权三处设计补齐后立即执行本计划。

SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
SKILL_USED=cs-spec-to-plan@repo-local/.agents/skills/cs-spec-to-plan/SKILL.md

## 1. 目标、边界与执行纪律

### 1.1 目标

按以下顺序完成一个可恢复、可逐步归因的结构迁移：

1. 先关闭当前字节已经暴露的基线门失败，并冻结真实首败；
2. 将 `apps/terminal/assembly` 改为 `apps/terminal/application`，将 `ui/base/console-assembly` 改为 `ui/base/integration-assembly`；
3. 将 `ui/base/automation`、`kernel/base/workflow`、`kernel/base/test-support` 线下移出，将 `ui/base/test-support` 合并至 `kernel/base/platform-ports`；
4. 删除 TER 中无效的 `darkMode` 产品配置、透传与正向行为断言；保留 checker/test 的负向残留守卫以便 AC-3 证伪；
5. 证明包图、锁文件、原生自动链接、签名身份、startup readiness、Web→设备顺序及无夹带改动均满足 v5。

### 1.2 当前授权边界

Dexter 已授权三处 follow-up 文字补齐后执行 CP-0 至 CP-4：可修改本计划范围内的源码、测试、依赖、package.json、脚本、检查器、构建配置、README、正本与 project-memory；可移动或线下归档四个包；可按锁文件协议安装、构建、启动两个 integration Expo Web，并在单机双屏与 mobile 虚拟机动态验证。

本计划仍不授权其它虚拟机或真机、DEV、L2、UAT、seed、reset、TR-08 关闭、超出详设范围的改动，以及除 D-2 前置条件外的数据清除。计划中的命令在对应前置门未通过时不得执行；当前基线只读结果仍以详设 §4.2 为准，不可把旧 evidence 或后续预期结果写成当前通过。

### 1.3 不可越过的执行规则

- 由主 agent 独立写入全部文件；fresh 子 agent 只读盲审/对账，不实现、不改文件、不运行 computer use。
- 任一 CP 结束后先做三维对账：v5 需求、详设/方案、四条指定 project-memory；任何 OPEN 先修复并复查，再进入下一 CP。
- 全部 CP 完成、整体测试前，再做一次全批三维对账；不是阶段对账的汇总。
- 同一 failure category 第二次出现立即冻结该失败族，保留 first failure、last known good、broken boundary、business 与 cleanup；不能换命令、加 timeout 或循环截图来掩盖。
- 同一时间只允许一个受管运行；持有运行期间不得改源码。
- CP-1/CP-2/CP-3 的 staged install 只能在上一 CP MATCHED、当前 CP 快照/锁协议已冻结后进入；CP-4 的构建、Web、设备（以及其后的任何再安装）必须通过 §7.1 的全量静态门与 TR-16 前置门。
- Git 由 Dexter 控制；本计划不要求任何 Git 操作。

## 2. 步骤总表与交付闸门

| CP | 顺序 | 允许的变更 | 安装/运行 | 退出条件 | 失败处理 |
| --- | --- | --- | --- | --- | --- |
| CP-0 | 0 | 基线根因修复：夹具、graph、PrimitiveForm、readability、harness 路径、darkMode | 安装、三道门、全部子门和 AC-6 工具测试 | 三道门及全部子门 exit 0；每个 baseline row 有 root cause/proof | 停在 CP-0，回源修复；产品/Journey 变化交 `DEXTER_DECISION` |
| CP-1 | 1 | 四包 archive/offline、platform-ports 合并、graph/fixture/lock 收口 | 安装、三道门、全部子门 | 四包不存在、archive 可恢复、五类型 root import、lock 仅预期 diff | archive/graph/import 任一 OPEN 不进入 CP-2 |
| CP-2 | 2 | console-assembly → integration-assembly 及所有 API/consumer/log identity | 安装、三道门、全部子门 | 旧包 identity 无残留；AC-7 startup 字段正确 | 旧 identity、日志或消费者不一致则回 CP-2 |
| CP-3 | 3 | assembly 层整体移动为 application；原生/Kotlin/工具/正本同步 | 安装、三道门、全部子门 | AC-2/8/11 静态闭合；可开始构建 | 任何 external version、applicationId、keystore 或行为变化立即停 |
| CP-4 | 4 | 只生成证明、对账、原生和 TR-16 证据 | 先 static/focused，再 Web，后设备 | 逐代码与详设对账全 MATCHED，AC-9/10/13 状态如实 | 任一 OPEN 只能交“实施未就绪” |

CP-0 在根因修复前使用 `yarn install --immutable`；CP-1 至 CP-3 因为会改变 workspace package identity，必须先用普通 `yarn install` 生成锁文件，再用 `yarn install --immutable` 做只读复验。锁文件不是手工编辑对象；每步安装前后都要保存 diff，只有该步预先冻结的 workspace hunk 可以存在，任何 external version、非本步 workspace locator 或未登记的 key 变化均停。

每个会改变 workspace identity 的 CP 都执行同一套锁文件协议，`<cp>` 替换为 `cp-1`、`cp-2` 或 `cp-3`，`<expected-lock-scope>` 使用该 CP 表中的允许范围：

```sh
LOCK_DIR="doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/<cp>"
mkdir -p "$LOCK_DIR"
cp yarn.lock "$LOCK_DIR/yarn.lock.before"
yarn install
set +e
diff -u "$LOCK_DIR/yarn.lock.before" yarn.lock > "$LOCK_DIR/yarn.lock.diff"
lock_diff_rc=$?
set -e
test "$lock_diff_rc" -eq 0 || test "$lock_diff_rc" -eq 1
```

`yarn.lock.diff` 的每个 hunk 必须逐条对照 `<expected-lock-scope>` 并登记；不在允许范围的 hunk 立即停止该 CP。随后运行 `yarn install --immutable`，再运行本 CP 的三道门和全部子门；immutable 不是生成变更的命令，而是验证已生成锁文件可复现的命令。

## 3. CP-0：基线冻结与根因修复

### 3.1 进入条件与第一条命令

CP-0 的第一动作必须是只读盘点，且在任何可能清理 Vitest cache、`.expo`、`.turbo`、Gradle、CXX、build、dist 或 `.runtime` 的 runner 之前完成。证据根固定为：

```text
doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-0/
```

实施时执行：

```sh
REPO_ROOT="$(pwd)"  # 命令从仓库根执行；不把本机绝对路径写入计划或证据
mkdir -p doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-0
git ls-files -o -i --exclude-standard > doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-0/ignored-files.txt
find apps/terminal -type d \( -name node_modules -o -name .turbo -o -name .expo -o -name .runtime -o -name .gradle -o -name .kotlin -o -name .cxx -o -name build -o -name dist \) -print | sort > doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-0/ignored-roots.txt
find apps/terminal -type f -path '*/debug.keystore' -print | sort > doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-0/keystores.txt
while IFS= read -r path; do shasum -a 256 "$path"; done < doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-0/keystores.txt > doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-0/keystore-sha256.txt
du -a apps/terminal | sort -n > doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-0/terminal-du.txt
```

这一步不能按大小过滤清单，也不能先运行 `run-owned-tests`。当前基线的分类统计（`all=174583`、`runtime=50087`、`cache=107757`、`build=53826`、`keystore=2`，分类可重叠）和两个 debug keystore 的 SHA-256 已在详设 §4.1 固定；实施时重新生成，以实施证据为准。

完成只读盘点并写入 `ignoredInventoryRef` 后，才允许执行 CP-0 到 CP-1 之间的现场整理。当前已核实的四个 package-local 可重建缓存目录必须逐一记录后清理：

```text
apps/terminal/kernel/base/test-support/.turbo
apps/terminal/kernel/base/workflow/.turbo
apps/terminal/ui/base/automation/.turbo
apps/terminal/ui/base/test-support/.turbo
```

实施时把清单复制为 `doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-0/cleanup-before-cp1.json`，逐项记录 `path`, `reason`, `owner=CP-0`, `removedAt`，再只对上述四个精确路径执行 `rm -rf -- <path>`；若盘点发现额外缓存，只能在 AC-6 证据中逐项标为可重建并经本 CP 记录后清理，不能用 glob 扩大范围。不得触碰任何 `.runtime`、debug.keystore、node_modules 或未知 owner 的进程/产物。

### 3.2 基线命令与证据

每个命令单独运行、单独记录 exit code、首败、gate、报文、last known good、broken boundary；不得把一条总命令的 exit code 当作全部子门结果。命令清单：

```sh
yarn --cwd apps/terminal typecheck
yarn --cwd apps/terminal test
yarn --cwd apps/terminal verify:static
node tools/terminal-skeleton/check-static.mjs
node tools/terminal-skeleton/check-static.test.mjs
node tools/terminal-skeleton/verify.test.mjs
node tools/terminal-layering/check-static.mjs
node tools/terminal-layering/check-static.test.mjs
node tools/terminal-ui-state/check-static.mjs
node tools/terminal-ui-state/check-static.test.mjs
node tools/terminal-readability/check-static.mjs
node tools/terminal-readability/check-static.test.mjs
node tools/terminal-sample2/check-native-projection.test.mjs
node tools/terminal-sample2/check-production-bundle.test.mjs
node tools/terminal-image-compare/test/compare.test.mjs
node scripts/test/ter-virtual-keyboard-android.test.mjs
scripts/memory/build-index --check
scripts/check/project-memory
```

AC-6 的每个工具测试也要单独作为记录行；当前清单已包含 transport test、skeleton/layering/ui-state/readability/native-projection/production-bundle/image-compare/keyboard runner 与 project-memory。若 `verify:static` 的实现还调用额外子门，必须从实际 stdout/源码读出并追加，不得只照本计划的列表猜测。

当前首败冻结为 B-01 至 B-11：

| baseline | owning source | 修法 | focused proof |
| --- | --- | --- | --- |
| B-01 transport identity fixture 缺 `moduleName` | `apps/terminal/kernel/base/transport/test/identityClient.test.ts`；parser `apps/terminal/kernel/base/contracts/src/foundations/topologyWire.ts:216-225`；native sender `apps/terminal/assembly/base/android/android/.../TerminalTopologyServer.kt:140` | 两个 response fixture 补现行 moduleName，不改 parser/native owner | transport test 两个 case + identity 值断言 |
| B-02 两个 App graph 少 `ui.base.input`、`ui.base.primitives` | `apps/terminal/skeleton-graph.ts` application nodes | graph 依赖集合与 package/dependencies/import 对齐 | skeleton graph static + graph red mutation |
| B-03 StaffLoginForm 直接 `createElement('form')` | `ui/feature/sample-staff-auth/src/components/StaffLoginForm.tsx:13` | form host 归 `ui/base/primitives` 的 typed `PrimitiveForm`；feature 只消费 primitive | Web submit/preventDefault、native children fragment、P-5d/TR-R03 |
| B-04 TR-R03/04/05/06 readability | 详设 §4.2 逐处列表 | 每处最小拆 helper/参数对象/提前返回/词表目录搬移；不改业务语义 | readability static + owning package focused tests |
| B-05 darkMode | 两 App、两 integration tailwind；base config/test；native projection checker/test | D-6 删除 runtime/config/business-test 语义；checker/test 只保留为“禁止残留”的断言与红变异输入，并在 AC-11 逐处分类 | active runtime/config/business corpus 的 `rg darkMode` 为 0；checker/test 允许位置逐处列出，native projection red/green |
| B-06 cache/scaffold | 盘点和 runner 清理边界 | 仅清理本批拥有的可重建 cache；`.runtime`、keystore 证据不删 | archive/cleanup record |
| B-07 contracts public export snapshot | `apps/terminal/kernel/base/contracts/src/index.ts` 与 `terminal-invariants.json` | invariants publicExports 补入现有 `TopologyLocalAddress`；不改变源码导出 | contracts model/static/test |
| B-08 platform-ports public export snapshot | `apps/terminal/kernel/base/platform-ports/src/index.ts` 与 `terminal-invariants.json` | invariants publicExports 补入现有 `DisplayReadiness`、`DisplaySize`、`DisplaySurfaceInfo`；不改变源码导出 | platform-ports model/static/test |
| B-09 display-context public export snapshot | `apps/terminal/kernel/base/display-context/src/index.ts` 与 `terminal-invariants.json` | invariants publicExports 补入现有 `DisplayFactsReadModel`、`DisplayFactsSurface`、`readDisplayFacts`；不改变源码导出 | display-context model/static/test |
| B-10 yarn lock workspace metadata | 两个 Android App 的 package.json 与根 `yarn.lock` | 普通安装只生成两个 App 各两条已声明 workspace dependency hunk；immutable 复验通过，不增加 external locator/version | `yarn install --immutable` + lock hunk 比对 |
| B-11 skeleton marker denominator | `tools/terminal-skeleton/verify.test.mjs`；`skeleton-graph.ts` 与各包 invariants | `expectedTaskOwners('test', 2)` 实际多出 `assembly-base-android`、`kernel-base-topology`、`kernel-base-transport`、`ui-base-console-assembly`、`ui-base-feature-assembly` | 固定 `expectedTestPackages`/`realTestPackages` 补齐当前已有测试契约；不改 graph、package 或运行语义 | `node tools/terminal-skeleton/verify.test.mjs` 及 marker mismatch/kind mismatch 反例 |

如果实跑产生不在 B-01 至 B-11 的失败，先追加 baseline row，重新判断是否属于门报出的根因、行为缺陷或 `DEXTER_DECISION`；不能静默扩大 CP-0。

### 3.3 StaffLoginForm primitive 的冻结接口

新增/修改的唯一接口如下，实施时不得改成未类型化的 `React.createElement`：

```text
apps/terminal/ui/base/primitives/src/types/types.ts
  PrimitiveFormSubmitEvent = Readonly<{ readonly preventDefault: () => void }>
  PrimitiveFormProps = Readonly<{
    readonly children?: ReactNode
    readonly onSubmit?: (event: PrimitiveFormSubmitEvent) => void
  }>

apps/terminal/ui/base/primitives/src/components/PrimitiveForms.tsx
  PrimitiveForm(props: PrimitiveFormProps): ReactNode

apps/terminal/ui/base/primitives/src/index.ts
  export {PrimitiveForm}
  export type {PrimitiveFormProps, PrimitiveFormSubmitEvent}
```

Web 分支使用唯一 JSX `<form>`，submit handler 先 `preventDefault()` 再调用可选回调；native 分支只返回 children fragment，不新增 View、padding、accessibility node 或 layout。`StaffLoginForm` 保留现有 feature 组件和调用位置，改为 `<PrimitiveForm>{children}</PrimitiveForm>`。如果发现 native/web 分支需要不同产品行为，标 `DEXTER_DECISION`，不由实施者自行改变。

### 3.4 CP-0 完整文件集

CP-0 只允许以下已知文件集和由其直接生成的测试结果发生变化；readability 逐处只能落在表中 owning file：

S-5 的 11 个 TR-R04/TR-R05 命中必须逐处实施，不允许只证明 readability gate 变绿。每行冻结目标形态、
既有行为测试和新增 focused 边界；TR-R03/TR-R06 仍按本节文件集中的独立条目处理。

| path:line | 目标形态 | 已有测试 | 新增 focused 测试 |
| --- | --- | --- | --- |
| `kernel/base/topology/src/features/actors/actors.ts:58` | `TopologyFailureInput` + `createTopologyFailure(input)` | `projects typed payload failure diagnostics without changing peer lifecycle facts` | named-input 保持 error payload 的 code/message/cause |
| `ui/base/admin-shell/src/foundations/adminFrameRegistry.ts:59` | `AdminFrameFixtureOptions` + `fixture(options)` | `freezes the 29 production frames plus one cross-tab frame` | 默认/显式 fixture options |
| `ui/base/admin-shell/src/foundations/adminFrameRegistry.ts:348` | `AdminFrameDefinitionInput` + `definition(input)` | `drives every production fixture through its concrete frame selector` | binding/variants 默认值与显式值 |
| `ui/base/input/src/components/InputScrollArea.tsx:193` | `ScrollReadbackMeasurement` + `applyMeasurement(input)` | `starts exactly one animated scroll request with the measured keyboard entrance and commits after readback` | viewport/content/presentation 只合成一次 |
| `ui/base/input/src/components/InputScrollArea.tsx:207` | `ScrollFieldMeasurement` + `applyMeasurement(input)` | `uses content-local coordinates when a scaled host has a non-zero scroll offset` | 缺 measurement 时保留 pending、不重复 scroll |
| `ui/base/input/src/components/InputSurfaceFrame.tsx:753` | `KeyboardLayerRenderInput` + `layer(input)` | `keeps frozen keyboard layer identities unique across rapid A-to-B-to-A-to-C retargets` | outgoing/incoming layerKey 一一对应 |
| `ui/base/input/src/hooks/useInputField.ts:126` | `FocusRectMeasurement` + `presentFocusRect(input)` | `measures an ordinary focused field against the unshifted surface root and applies one centered offset` | ordinary/native-less 共用 root-local contract |
| `kernel/base/topology/src/features/actors/actors.ts:570` | `PeerCloseResolutionInput` + `resolvePeerClose(input)` | `clears the master pairing fact only after an explicit slave unpair close` | transient close 保留 identity、explicit unpair 才清理 |
| `kernel/base/topology/src/features/actors/actors.ts:576` | `SlaveUnpairPersistenceInput` + `persistSlaveUnpair(input)` | `clears the slave locator from an explicit master unpair notice` | persistence failure 的 repair-pending/facts 边界 |
| `ui/base/input/src/components/InputSurfaceFrame.tsx:599` | `PresentationTargetInput` + `targetOffsetFor(input)` | `recomputes the next field from its unshifted root-local position without subtracting the old offset` | 饱和/未饱和目标偏移只换算一次 |
| `ui/base/input/src/components/InputSurfaceFrame.tsx:666` | `PresentationAnimationInput` + `startPresentationAnimation(input)` | `keeps frozen outgoing and incoming snapshots layered and input-blocked during a different-layout handoff` | 同 serial 不因 pending/owner 更新从 0 重放 |

目标形态如果需要改变 owner、Journey、失败/恢复或业务语义，必须先登记 `DEXTER_DECISION`；本表不是
允许扩大范围的授权。

```text
apps/terminal/kernel/base/transport/test/identityClient.test.ts
apps/terminal/kernel/base/contracts/terminal-invariants.json
apps/terminal/kernel/base/platform-ports/terminal-invariants.json
apps/terminal/kernel/base/display-context/terminal-invariants.json
yarn.lock
apps/terminal/skeleton-graph.ts
tools/terminal-skeleton/verify.test.mjs
apps/terminal/ui/base/primitives/src/types/types.ts
apps/terminal/ui/base/primitives/src/components/PrimitiveForms.tsx
apps/terminal/ui/base/primitives/src/index.ts
apps/terminal/ui/base/primitives/test/primitives.test.tsx
apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLoginForm.tsx
apps/terminal/ui/feature/sample-staff-auth/test/staffAuth.test.ts
apps/terminal/assembly/android/sample-terminal/src/controlledKeyboardHarness.tsx -> src/components/controlledKeyboardHarness.tsx
apps/terminal/assembly/android/sample-terminal/App.tsx
apps/terminal/assembly/android/sample-terminal/README.md
apps/terminal/assembly/android/sample-wallpaper-terminal/src/controlledKeyboardHarness.tsx -> src/components/controlledKeyboardHarness.tsx
apps/terminal/assembly/android/sample-wallpaper-terminal/App.tsx
apps/terminal/assembly/android/sample-wallpaper-terminal/README.md
apps/terminal/kernel/base/topology/src/features/actors/actors.ts
apps/terminal/ui/base/admin-shell/src/foundations/adminFrameRegistry.ts
apps/terminal/ui/base/input/src/components/InputScrollArea.tsx
apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx
apps/terminal/ui/base/input/src/hooks/useInputField.ts
apps/terminal/assembly/android/sample-terminal/tailwind.config.cjs
apps/terminal/assembly/android/sample-wallpaper-terminal/tailwind.config.cjs
apps/terminal/ui/integration/sample-console/tailwind.config.cjs
apps/terminal/ui/integration/sample-wallpaper-console/tailwind.config.cjs
apps/terminal/assembly/base/android/config/index.cjs
apps/terminal/assembly/base/android/test/keyboardThemeConfig.test.ts
apps/terminal/ui/integration/sample-console/test/theme.test.ts
tools/terminal-sample2/check-native-projection.mjs
tools/terminal-sample2/check-native-projection.test.mjs
```

上表中的 `README.md` 只在 harness 路径或标准允许的命名处同步；没有实际引用的 README 不得顺手重写。CP-0 的 `yarn.lock` 只允许 B-10 记录的两个 App 各两条已声明 workspace dependency hunk；workspace identity、external version/locator 均不得变化。

### 3.5 CP-0 退出门

执行 `yarn install --immutable` 后，依次运行 §3.2 全部命令。三道门定义为：

- `yarn --cwd apps/terminal typecheck`；
- `yarn --cwd apps/terminal test`；
- `yarn --cwd apps/terminal verify:static` 及其从实际输出展开的全部子门。

CP-0 只有在三道门及全部 AC-6 工具测试 exit 0，且 B-01 至 B-11 每一项都有“修前报文→root cause→修法→focused proof→修后报文”才 MATCHED。CP-0 结束后立即做 fresh 只读三维对账，OPEN 不得进入 CP-1。

## 4. CP-1：四包下线与 platform-ports 合并

### 4.1 完整源文件集

四个 source package 的当前受控全集如下，不含 ignored cache：

```text
apps/terminal/ui/base/automation/
  package.json src/dependencies.ts src/index.ts src/moduleName.ts terminal-invariants.json tsconfig.json
apps/terminal/kernel/base/workflow/
  package.json src/dependencies.ts src/index.ts src/moduleName.ts terminal-invariants.json tsconfig.json
apps/terminal/kernel/base/test-support/
  package.json src/dependencies.ts src/index.ts src/moduleName.ts terminal-invariants.json tsconfig.json
apps/terminal/ui/base/test-support/
  README.md package.json src/dependencies.ts src/index.ts src/moduleName.ts src/types/platformTypes.ts
  terminal-invariants.json tsconfig.json
```

CP-1 的消费者/检查器文件集固定为：

```text
apps/terminal/skeleton-graph.ts
apps/terminal/ui/base/primitives/package.json
apps/terminal/ui/base/primitives/README.md
apps/terminal/ui/base/primitives/src/dependencies.ts
apps/terminal/ui/base/primitives/src/index.ts
apps/terminal/ui/feature/sample-member-desk/package.json
apps/terminal/ui/feature/sample-member-desk/src/dependencies.ts
apps/terminal/ui/feature/sample-member-desk/test/memberDesk.test.tsx
apps/terminal/ui/feature/sample-staff-auth/package.json
apps/terminal/ui/feature/sample-staff-auth/src/dependencies.ts
apps/terminal/ui/feature/sample-staff-auth/test/staffAuth.test.ts
apps/terminal/ui/feature/sample-wallpaper-picker/package.json
apps/terminal/ui/feature/sample-wallpaper-picker/src/dependencies.ts
apps/terminal/ui/feature/sample-wallpaper-picker/test/pickerSystemFailure.test.ts
apps/terminal/ui/feature/sample-wallpaper-picker/test/sampleWallpaperPicker.test.tsx
tools/terminal-skeleton/check-static.mjs
tools/terminal-skeleton/check-static.test.mjs
tools/terminal-ui-state/check-static.mjs
tools/terminal-ui-state/check-static.test.mjs
tools/terminal-sample2/check-production-bundle.mjs
tools/terminal-sample2/check-production-bundle.test.mjs
```

`kernel/base/platform-ports/src/index.ts` 是 five-type 的唯一生产住址，字节必须保持不变；若为了合并而改动 production index，CP-1 OPEN 并交 Dexter。三 feature 只改 package/dev dependency、`src/dependencies.ts` 的 module list 与测试 type import，不能把测试类型搬进 feature。

### 4.2 归档和恢复

先生成每包完整 file manifest，再移动；先 manifest、后 move，不能反过来：

```text
../.ter-package-layout-cleanup-archive/2026-09-25/
  <package-slug>-<source-tree-sha8>/
```

四份证据：

```text
doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/offline/
  ui-base-automation.json
  kernel-base-workflow.json
  kernel-base-test-support.json
  ui-base-test-support.json
```

每个 JSON 必须含 `schemaVersion`, `sourceRoot`, `archiveRoot`, `movedAt`, `fileCount`, `byteCount`, `files[]`, `restoreCommand`, `ignoredInventoryRef`, `ignoredEntriesBeforeCleanup`, `ignoredEntriesAtArchive`；每个 `files[]` 项含 `sourceRelativePath`, `archiveRelativePath`, `bytes`, `sha256`。`ignoredInventoryRef` 必须指向 CP-0 的完整盘点，`ignoredEntriesBeforeCleanup` 必须包含该包盘点到的 `.turbo` 与其他 ignored entry，`ignoredEntriesAtArchive` 必须为空或明确列出仍随树迁移的受控非源码项。`ui-base-test-support.json` 另含 `platformPortsTypeSource`，逐项列五个类型来自 `kernel/base/platform-ports/src/index.ts`。恢复命令必须是显式 `mkdir -p` 加逐文件路径恢复和 sha256 比对，禁止 `/tmp`、模糊 glob、仓根递归删除和越过四包范围。

归档后检查：四个源目录不存在；archive bytes、file count、sha256 与移出前一致；仓内 active corpus 不留旧 package/moduleName；`TR-08` 两种 automation token 仍在 guard/test fixture 中，但不被误判为活跃 package。

### 4.3 CP-1 安装、锁文件和门

```sh
LOCK_DIR="doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-1"
mkdir -p "$LOCK_DIR"
cp yarn.lock "$LOCK_DIR/yarn.lock.before"
yarn install
set +e
diff -u "$LOCK_DIR/yarn.lock.before" yarn.lock > "$LOCK_DIR/yarn.lock.diff"
lock_diff_rc=$?
set -e
test "$lock_diff_rc" -eq 0 || test "$lock_diff_rc" -eq 1
# 逐 hunk 对照下方 expected lock scope，非允许 hunk 立即停止
yarn install --immutable
yarn --cwd apps/terminal typecheck
yarn --cwd apps/terminal test
yarn --cwd apps/terminal verify:static
node tools/terminal-skeleton/check-static.mjs
node tools/terminal-skeleton/check-static.test.mjs
node tools/terminal-skeleton/verify.test.mjs
node tools/terminal-layering/check-static.mjs
node tools/terminal-layering/check-static.test.mjs
node tools/terminal-ui-state/check-static.mjs
node tools/terminal-ui-state/check-static.test.mjs
node tools/terminal-readability/check-static.mjs
node tools/terminal-readability/check-static.test.mjs
node tools/terminal-sample2/check-native-projection.test.mjs
node tools/terminal-sample2/check-production-bundle.test.mjs
node tools/terminal-image-compare/test/compare.test.mjs
node scripts/test/ter-virtual-keyboard-android.test.mjs
```

预期 `yarn.lock` 只出现四个 workspace locator、四个包名和相关 workspace dependency 记录消失或更新；不增加 external version，不改 platform-ports 的 production export。三道门以及 §3.2 的全部子门必须为 0；AC-1 archive manifest 与 source bytes 匹配；AC-5 五类型 root import 和 platform-ports production index 字节不变。任何 feature 仍 import `ui-base-test-support`、graph 仍包含四节点，立即判 CP-1 OPEN。

## 5. CP-2：console-assembly 改名

### 5.1 完整文件集和映射

当前受控全集（同盘移动后逐文件复用）：

```text
apps/terminal/ui/base/console-assembly/README.md
apps/terminal/ui/base/console-assembly/package.json
apps/terminal/ui/base/console-assembly/src/dependencies.ts
apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx
apps/terminal/ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts
apps/terminal/ui/base/console-assembly/src/foundations/startupReady.ts
apps/terminal/ui/base/console-assembly/src/foundations/stateSyncSlices.ts
apps/terminal/ui/base/console-assembly/src/foundations/terminalSurfaces.ts
apps/terminal/ui/base/console-assembly/src/index.ts
apps/terminal/ui/base/console-assembly/src/moduleName.ts
apps/terminal/ui/base/console-assembly/terminal-invariants.json
apps/terminal/ui/base/console-assembly/test/partSelection.test.ts
apps/terminal/ui/base/console-assembly/test/runtimeOwner.test.ts
apps/terminal/ui/base/console-assembly/test/startupDiagnosticsWriter.test.ts
apps/terminal/ui/base/console-assembly/test/startupReady.test.ts
apps/terminal/ui/base/console-assembly/test/stateSyncSlices.test.ts
apps/terminal/ui/base/console-assembly/test/terminalSurfaces.test.ts
apps/terminal/ui/base/console-assembly/tsconfig.json
apps/terminal/ui/base/console-assembly/vitest.config.ts
```

同一原子组中更新：

- 目录、package name、moduleName：`console-assembly` → `integration-assembly`；
- `consoleAssembly.tsx` → `integrationAssembly.tsx`；`createConsoleAssembly`、`ConsoleAssembly`、`ConsoleAssemblyInput`、`ConsoleSurfaceCreationInput`、`ConsoleSurfaceDeclarations`、`ConsoleDefinedPart`、`ConsoleRuntimeBundle`、`ConsoleRuntimeSubscription`、`ConsoleSurfaceInputFrame` 及对应 Props 按 D-2 改为 Integration 词根；
- 两个 integration 的 `package.json`、`src/dependencies.ts`、`src/assembly/assembly.tsx`、`src/application/*`、`test-expo/App.tsx`、测试、README、`terminal-invariants.json`；
- `startupDiagnosticsWriter.ts`、`startupReady.ts`、`integrationAssembly.tsx` 的 owner/writer/source/error prefix/log message；
- `tools/terminal-sample2/check-startup-diagnostics.mjs`、`check-behavior.mjs` 与对应测试。

`WallpaperConsoleAssembly`、`createSampleWallpaperConsoleAssembly`、`sample-console` 等 integration 自有名字不改；不能使用全局替换。所有旧导出必须由 AC-2 的 active scan 与 package public surface test 判定为 residual 或允许语义。

### 5.2 CP-2 安装与退出门

```sh
LOCK_DIR="doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-2"
mkdir -p "$LOCK_DIR"
cp yarn.lock "$LOCK_DIR/yarn.lock.before"
yarn install
set +e
diff -u "$LOCK_DIR/yarn.lock.before" yarn.lock > "$LOCK_DIR/yarn.lock.diff"
lock_diff_rc=$?
set -e
test "$lock_diff_rc" -eq 0 || test "$lock_diff_rc" -eq 1
# 逐 hunk 对照“只允许 console → integration workspace locator/name”的范围
yarn install --immutable
yarn --cwd apps/terminal typecheck
yarn --cwd apps/terminal test
yarn --cwd apps/terminal verify:static
node tools/terminal-skeleton/check-static.mjs
node tools/terminal-skeleton/check-static.test.mjs
node tools/terminal-skeleton/verify.test.mjs
node tools/terminal-layering/check-static.mjs
node tools/terminal-layering/check-static.test.mjs
node tools/terminal-ui-state/check-static.mjs
node tools/terminal-ui-state/check-static.test.mjs
node tools/terminal-readability/check-static.mjs
node tools/terminal-readability/check-static.test.mjs
node tools/terminal-sample2/check-native-projection.test.mjs
node tools/terminal-sample2/check-production-bundle.test.mjs
node tools/terminal-image-compare/test/compare.test.mjs
node scripts/test/ter-virtual-keyboard-android.test.mjs
node tools/terminal-sample2/check-startup-diagnostics.mjs
node tools/terminal-sample2/check-behavior.mjs
```

预期锁文件只有 workspace package locator/name 从 console → integration 的变化；无 external version 变化。AC-7 必须从两个 integration 的 startup JSON 读取 `data.client.owner`、`data.writer`，均等于 `ui.base.integration-assembly`；将任一 writer 单独改回旧值时，checker/test 必须以固定前缀判红。CP-2 结束后 fresh 三维对账 MATCHED 才能进入 CP-3。

## 6. CP-3：assembly 层整体改为 application

### 6.1 同盘整体移动

先生成完整目录 manifest，再用同盘目录级 `mv`；不能只移动 git tracked 文件。源目录内的 `.expo`、`.turbo`、Gradle、Kotlin、CXX、build、dist、`.runtime` 和 debug.keystore 都必须先被 manifest 记录并随树迁移；构建前只清理新目录下可重建物，绝不删除 debug.keystore 或 `.runtime` 运行证据。

```sh
mkdir -p doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-3
find apps/terminal/assembly -type d -print | sort > doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-3/assembly-directories-before.txt
find apps/terminal/assembly -type f -print0 | sort -z | xargs -0 shasum -a 256 > doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-3/assembly-files-before.sha256
find apps/terminal/assembly -type f -path '*/debug.keystore' -exec shasum -a 256 {} \; > doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-3/keystores-before.sha256
find apps/terminal/assembly -type d -name .runtime -print | sort > doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-3/runtime-roots-before.txt
mv apps/terminal/assembly apps/terminal/application
```

移动后的可重建清理集合仅限：`application/**/.expo`、`application/**/.turbo`、`application/**/android/.gradle`、`application/**/android/.kotlin`、`application/**/android/app/.cxx`、`application/**/android/app/build`、`application/**/android/build`、`application/**/dist`。不得清理 `application/**/android/app/debug.keystore` 与 `application/**/.runtime`。

### 6.2 CP-3 文本和原生边界

完整 application 树的所有文件都在 CP-3 move file set 中；文本审查锚点为：

```text
package.json, src/moduleName.ts, src/dependencies.ts, terminal-invariants.json, README.md, App.tsx
babel.config.cjs, metro.config.js, tailwind.config.cjs, tsconfig.json, global.d.ts, nativewind-env.d.ts
src/assembly/platformPorts.ts
apps/terminal/assembly/base/android/package.json
apps/terminal/assembly/base/android/config/index.cjs
apps/terminal/assembly/base/android/expo-module.config.json
apps/terminal/assembly/base/android/src/components/AndroidTerminalApp.tsx
apps/terminal/assembly/base/android/src/foundations/**
apps/terminal/assembly/base/android/android/build.gradle
apps/terminal/assembly/base/android/android/src/**
两个 App 的 MainActivity.kt、MainApplication.kt、Gradle settings/build/proguard/manifest 与资产
```

改名边界：

- `apps/terminal/assembly` → `apps/terminal/application`；根 `package.json` 的两个 workspace glob 同步；
- 三个 `@catering-v2s/assembly-*` → `@catering-v2s/application-*`，三个 `assembly.*` moduleName → `application.*`；
- `LogScope.layer`/binding 的层值 `'assembly'` → `'application'`；错误前缀 `[assembly-base-android]` → `[application-base-android]`；默认 loading testID `assembly.base.android:loading` → `application.base.android:loading`；
- Kotlin package、目录和 `expo-module.config.json` 全名从 `...terminal.assembly.base.android` → `...terminal.application.base.android`；两个 `MainActivity.kt` 的 import 同步；
- `verify.mjs` 阶段 `assembly-export*` → `application-export*`；工具/runner 的层路径按 AC-11 逐处分类。

必须保持不变：Android `applicationId`、持久化 key、`LOG_TAG`、包内 `src/assembly/`、`createAssembly`、`assembly-rejection`、`sample.assembly-created` 和确属装配语义的局部变量。`terminal-coding-standard.md` §7.1 的 `src/assembly/` 词表行保留，不把它当顶层层名。

必须检查的外部 active 文件：

```text
package.json
apps/terminal/skeleton-graph.ts
tools/terminal-layering/check-static.mjs
tools/terminal-skeleton/check-static.mjs
tools/terminal-skeleton/verify.mjs
tools/terminal-sample2/check-native-projection.mjs
tools/terminal-sample2/check-startup-diagnostics.mjs
tools/terminal-sample2/check-behavior.mjs
tools/terminal-sample2/run-a9-runtime.mjs
tools/terminal-sample2/run-u8-release-cold-start.mjs
tools/terminal-sample2/run-sample1-frozen-journey.mjs
tools/terminal-sample2/run-sample2-frozen-journey.mjs
scripts/test/ter-virtual-keyboard-android.mjs
scripts/test/ter-virtual-keyboard-android.test.mjs
tools/terminal-topology/run-dual-device.mjs
tools/terminal-android-dual-screen/check-behavior.mjs
tools/terminal-image-compare/test/compare.test.mjs
```

这些文件不是全部无条件改动；逐处必须进入 AC-11 classification table。`tools/terminal-skeleton/check-static.mjs` 中由 `graph-model.mjs` 先行拒绝的 dead self-edge rule 才允许删除；删除其专属断言后要保留 graph-model 的实际禁止规则。

### 6.3 CP-3 安装和门

```sh
LOCK_DIR="doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-3"
mkdir -p "$LOCK_DIR"
cp yarn.lock "$LOCK_DIR/yarn.lock.before"
yarn install
set +e
diff -u "$LOCK_DIR/yarn.lock.before" yarn.lock > "$LOCK_DIR/yarn.lock.diff"
lock_diff_rc=$?
set -e
test "$lock_diff_rc" -eq 0 || test "$lock_diff_rc" -eq 1
# 逐 hunk 对照“只允许 application workspace locator/name 与相关 workspace key”的范围
yarn install --immutable
yarn --cwd apps/terminal typecheck
yarn --cwd apps/terminal test
yarn --cwd apps/terminal verify:static
node tools/terminal-skeleton/check-static.mjs
node tools/terminal-skeleton/check-static.test.mjs
node tools/terminal-skeleton/verify.test.mjs
node tools/terminal-layering/check-static.mjs
node tools/terminal-layering/check-static.test.mjs
node tools/terminal-ui-state/check-static.mjs
node tools/terminal-ui-state/check-static.test.mjs
node tools/terminal-readability/check-static.mjs
node tools/terminal-readability/check-static.test.mjs
node tools/terminal-sample2/check-native-projection.test.mjs
node tools/terminal-sample2/check-production-bundle.test.mjs
node tools/terminal-image-compare/test/compare.test.mjs
node scripts/test/ter-virtual-keyboard-android.test.mjs
scripts/memory/build-index --check
scripts/check/project-memory
```

预期锁文件只允许 application workspace locators、package/module names 与相关 workspace dependency key 变化；external versions、applicationId、keystore、`.runtime`、生成文件均不可手改或被快照误报为普通源码变化。三道门及全部子门 exit 0 后做 CP-3 fresh 三维对账。

## 7. CP-4：静态证明、原生证明与 TR-16 动态顺序

### 7.1 CP-4 昂贵阶段的统一前置门

本节是 CP-4 的构建、Web、设备阶段前置门，不反向要求 CP-1/CP-2/CP-3 在自身改动尚未完成时先证明自身全绿。
CP-1/CP-2/CP-3 的安装只允许在上一 CP MATCHED、当前 CP 的 source/file-set 快照已冻结、锁文件协议已准备好且没有其他受管运行时进入；它们各自安装后必须按本计划完整跑三道门和全部子门。CP-4 开始构建、Web 或设备前必须确认：

1. CP-0 至 CP-3 的三道门和全部子门全绿；
2. AC-2 active scan、AC-8 snapshot set、AC-11 classification table 无 OPEN；
3. archive manifest 已写完且未发生未知目录清理；
4. TR-16 的 Web 行先于设备行；
5. 同一时间没有另一个受管运行，runner manifest 的 owner/start token/readiness 可读；
6. 运行期间不改源码，sourceDigest 在 Web 与设备行相同；
7. 同一 failure category 第二次出现即停，不通过重试或截图循环掩盖。

前置门任一失败时只输出“未进入昂贵阶段”及缺项，不启动下一个 runner。

### 7.2 AC-2 active scan 和 AC-11 分类

所有扫描输入来自同一排序文件：

```sh
active_files() {
  git ls-files -co --exclude-standard |
    awk '!/^doc\/(plans|review|handoffs|evidence)\// {print}'
}
EVIDENCE_DIR=doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-4
mkdir -p "$EVIDENCE_DIR"
active_files > "$EVIDENCE_DIR/active-files.txt"
```

每个扫描模式先在改名前 corpus 做正控制并记录命中数，再对当前 corpus 判定。当前 `\bassembly[A-Z]\w*`
正控制是 50 个 token 命中，不是旧文档中的约数；详设 §9.2a 的逐行表包含 50 个代码/工具行、30 个 active
正本/规范/skill/memory 行和 84 个 README 行，共 164 行 path/token/class/action/allowedDiffRef，计划不得另造缩减表。
实施证据必须引用同一表并逐行回读：

```text
apps/terminal/assembly
@catering-v2s/assembly-
assembly-base-android
console-assembly
Console 基础装配
plannedDependencies（CP-0 历史基线；CP-1 后当前实现必须为零命中）
ui-base-automation / kernel-base-workflow / kernel-base-test-support / ui-base-test-support
对应 moduleName 与 PCRE `assembly\.(android|base)\.`
PCRE `\bassembly[A-Z]\w*`
darkMode（仅扫描 runtime/config/business-test corpus；native projection checker/test 中的禁止断言与唯一 red-mutation 输入按 AC-11 单独分类）
旧 console symbol 禁用集 `\b(createConsoleAssembly|ConsoleAssembly|ConsoleAssemblyInput|ConsoleSurface\w*|ConsoleDefinedPart|ConsoleRuntime\w*|consoleAssembly)\b`
代码/配置/工具边界 PCRE ``['"`]assembly['"`.\-]``
```

终端颜色控制码不得写入证据。`assembly` 语义逐处分类，不按文件整体放行；旧 console symbol 禁用集必须不命中，除 integration 自有 `WallpaperConsoleAssembly`/`createSampleWallpaperConsoleAssembly` 反向控制。AC-11/AC-8 共用详设 §9.2a 的逐行表，字段为 `path, anchor, token, class, action, allowedDiffRef`，`class` 只能是 `LAYER_RENAME` 或 `ASSEMBLY_SEMANTIC_KEEP`。正控制 token 家族必须逐文件列出；`assemblyPromises`、`assemblyModule`、装配语义和 `src/assembly/` 目录词表不误报，顶层 application/integration identity 必须改名。

反向控制必须证明以下合法内容不被层名扫描误报：`src/assembly/`、装配变量、`createAssembly`、`assembly-rejection`、`sample.assembly-created`、`WallpaperConsoleAssembly`/`createSampleWallpaperConsoleAssembly`。下线包 token 只能在 TR-08 guard/test fixture 允许位置出现。

### 7.3 AC-3 红测试记录

每个 fixture 先以未变异字节通过，再只施加一个变异，记录 `inputBefore`, `mutation`, `firstFailure`, `restore`, `greenAfter`。四处换靶与三条新增红测试冻结为详设 §9.3：

- obsolete `kernel.base.test-support` fixture → `kernel.base.platform-ports` 稳定 target，断言 graph-comparison 前缀；
- 已退役依赖边界 fixture → 在 primitives 中加入现有 `@catering-v2s/ui-base-render/src/index` 非根 workspace import，断言 skeleton `graph-comparison` gate 的 `non-root workspace import` 报文；不恢复 `plannedDependencies` 字段或 checker 分支；
- ui-state 相邻节点 fixture → 非相邻稳定 package boundary，断言 boundary gate；
- native projection darkMode fixture → 只恢复一处 `darkMode: 'class'` 到 `sample-terminal`，断言 `sample-terminal has an unallowed darkMode difference`；
- 新 graph mutation：UI feature 指向 application，走 `p-5a-direction` 并断言 `P-5a reverse dependency ui->application (`；adapter 指向 application，走同一 gate 并断言 `P-5a reverse dependency adapter->application (`；application 包下创建 node_modules，走 `SCAFFOLD_HYGIENE` 并断言 `HYGIENE_FAILURE:scaffold metadata remains:`。

恢复变异后同一门必须绿；任何“预计会红”或只看非零 exit code 都不算证据。

### 7.4 AC-8 快照与允许差异

在 CP-0 修复后、每个迁移 CP 前后各生成一次：active file set、四包 archive file set、application tree ignored file set、两个 debug keystore。manifest 字段固定为：

```json
{
  "schemaVersion": 1,
  "kind": "ter-package-layout-active-snapshot",
  "capturedAt": "<ISO-8601>",
  "files": [{"path":"<repo-relative>","category":"<category>","sha256":"<64hex>","allowedDiffRef":null}],
  "allowedDifferences": [{"id":"<CP/AC>","path":"<repo-relative>","anchor":"<unique>","kind":"rename|move|baseline-fix|generated","reason":"<PL/AC>"}]
}
```

比较顺序固定：先 file set，再 category/path，再 sha256；未登记文件必须 byte-for-byte 相同。红变异必须覆盖清空 snapshot、删一行、增无关文件、省略 category、改未登记字符串、扩大 allowedDifferences；六项都必须 fail closed。锁文件按 AC-6 单独比较；可重建产物不参与普通 source byte compare，但 keystore/runtime 必须保留在相应 evidence manifest。

### 7.5 AC-9 原生证据

每个 App 构建后立即读取共享 `ExpoModulesPackageList.kt`，不能用一次读取代表两个 App；`PackageList.java` 不可替代：

```sh
REPO_ROOT="$(pwd)"  # 从仓库根执行
APP_ROOT="$REPO_ROOT/apps/terminal/application/android/sample-terminal"
"$APP_ROOT/android/gradlew" -p "$APP_ROOT/android" assembleRelease --no-daemon --console=plain
EXPO_LIST="$REPO_ROOT/apps/terminal/node_modules/expo/android/build/generated/expo/src/main/java/expo/modules/ExpoModulesPackageList.kt"
rg -n 'application\.base\.android|assembly\.base\.android' "$EXPO_LIST"
APK="$APP_ROOT/android/app/build/outputs/apk/release/app-release.apk"
APKANALYZER="$(find "$ANDROID_HOME/cmdline-tools" -path '*/bin/apkanalyzer' -type f -print | sort | tail -n 1)"
test -n "$APKANALYZER"
"$APKANALYZER" dex packages "$APK" | rg 'com\.catering\.v2s\.terminal\.(application|assembly)\.base\.android\.'
"$ANDROID_HOME/build-tools/36.1.0/apksigner" verify --print-certs "$APK"
KEYSTORE_CERT_SHA256="$(keytool -list -v -keystore "$APP_ROOT/android/app/debug.keystore" -storepass android -alias androiddebugkey | awk -F': ' '/SHA256:/{print $2; exit}')"
APK_CERT_SHA256="$("$ANDROID_HOME/build-tools/36.1.0/apksigner" verify --print-certs "$APK" | awk -F': ' '/certificate SHA-256 digest:/{print $2; exit}')"
test -n "$KEYSTORE_CERT_SHA256" && test -n "$APK_CERT_SHA256"
test "$KEYSTORE_CERT_SHA256" = "$APK_CERT_SHA256"
```

对 wallpaper App 重复执行，替换 `APP_ROOT`，每个 App 单独记录 `buildId`, `capturedAt`, Expo list sha256, APK sha256, keystore sha256、证书 SHA256。期望 Expo list/dex 含三个新 Kotlin 全名且不含三个旧全名；keystore sha256 与 CP-0 相同；证书 digest 与对应 keystore 相同。错一个 module class、换 keystore、读取另一 App 的 list/APK 三种变异都必须红。

### 7.6 AC-10 TR-16 配对矩阵

本节先冻结矩阵；进入 CP-4 后严格先 Web、后设备，并使用同一源代码摘要：

| row | Web（先） | 设备（后） | source/ready |
| --- | --- | --- | --- |
| W-1/D-1 | `ui/integration/sample-console`，`http://localhost:8081/?surfaceForm=mobile`，mobile，冷启动首屏 | `application/android/sample-terminal` release APK，mobile VM | startup owner/writer、新 `primaryReadyPartKey`、`primaryContentFailure=null` |
| W-2/D-2 | `sample-wallpaper-console`，`http://localhost:8081/?surfaceForm=laptop`，选择 `sample-wallpaper-console:test-expo:surface-mode:dual` 双屏预览 | `sample-wallpaper-terminal` release APK，单机双屏 VM，PRIMARY 与 SECONDARY 分开 | 同上；SECONDARY 用 UI tree/testID→partKey |

每行冷启动前必须按 row 完成匿名态前置，并在清除或登出前、完成后各记录一次 startup/readiness 与可见根 testID 状态：
1. **W-1/D-1**：只使用产品内 `sample.desk.member-list:logout`；登出前记录现状，点击后确认 `sample.auth.login`
   与 startup readiness，再记录登出后的状态。该产品登出动作只适用于 W-1/D-1。
2. **W-2**：不执行产品登出；记录清除前状态后，只清除 `sample-wallpaper-console-web` 持久化键，重新打开上表 URL，
   确认 PRIMARY `sample.auth.login` 与 SECONDARY `sample.wallpaper-console.waiting`，再记录清除后的状态；不得清空整个 profile。
3. **D-2**：单机双屏虚拟机冷启动后先记录状态。若已匿名则不清除；若不是匿名，才执行 Dexter 已授权的一次性动作，
   只清除 `sample-wallpaper-terminal` App 数据一次，记录清除前状态，重新启动并确认 PRIMARY/SECONDARY 匿名态后再记录清除后状态。
   不得清除其它 App 或其它数据；没有匿名态确认的行必须标 `OPEN`。

W-2 先确认 `sample-wallpaper-console:test-expo:surface-form:laptop`，再点击
`sample-wallpaper-console:test-expo:surface-mode:dual`；双屏没有 URL 参数。W-1 mobile 不创建 SECONDARY。

startup 读取必须使用 `startupDiagnosticsWriter.ts` 与 `consoleAssembly.tsx:379-405` 的 `getStartupReadiness`
（CP-2 改名后为 `integrationAssembly.tsx` 中同一函数）生成的结构化 `startup.complete`；不能把
`startupReady.ts` 写成 readiness owner。Web 从 integration logger 读取，设备以 App `LOG_TAG` 过滤 logcat。
`groups` 必须是六个布尔成员 `modules/slices/commands/actors/ports/parts`，`primaryDeclared`、
`primaryMeasured`、`primaryRealReady` 必须是布尔值。最小 readiness 示例为：

```json
{"groups":{"modules":true,"slices":true,"commands":true,"actors":true,"ports":true,"parts":true},"primaryDeclared":true,"primaryMeasured":true,"primaryRealReady":true,"primaryReadyPartKey":"sample.auth.login","primaryContentFailure":null}
```

设备 SECONDARY 读取沿用仓内已跑通的 `uiautomator --windows`：

```sh
REMOTE_XML="/sdcard/<run-id>-<shape>-<timestamp>.xml"
adb -s <serial> shell uiautomator dump --windows "$REMOTE_XML"
adb -s <serial> shell cat "$REMOTE_XML" > "$EVIDENCE_DIR/window-<serial>.xml"
adb -s <serial> shell rm -f "$REMOTE_XML"
```

按 `<display id="N">...</display>` 分段，再按
`scripts/test/ter-virtual-keyboard-android.mjs:239-266` 的 `parseResourceNode`/
`parseResourceAttributeHash` 同形逻辑在目标 display 段读取 testID，JSON 记录 `displayId`、testID、partKey 和 XML
路径；不使用未在两台虚拟机证明可用的 `--display` 变体。

AC-10 的业务锚点在实施前后都固定为以下当前源码值；若 CP-0/CP-1 改变这些值，必须先记录 DESIGN_GAP/行为变化，不得静默替换：

| row | primaryReadyPartKey | SECONDARY partKey | testID 与 source anchor |
| --- | --- | --- | --- |
| W-1/D-1 | `sample.auth.login` | `null` | primary actor `apps/terminal/ui/feature/sample-staff-auth/src/features/actors/actors.ts:36-41`；part registration `apps/terminal/ui/feature/sample-staff-auth/src/parts/parts.ts:15-23`；laptop/mobile root testID `apps/terminal/ui/feature/sample-staff-auth/src/components/{laptop,mobile}/StaffLogin.tsx:22` |
| W-2/D-2 | `sample.auth.login` | `sample.wallpaper-console.waiting` | primary 同 W-1；secondary actor `apps/terminal/ui/integration/sample-wallpaper-console/src/features/actors/actors.ts:84-87`；part registration `apps/terminal/ui/integration/sample-wallpaper-console/src/parts/parts.ts:11-21`；waiting root testID `apps/terminal/ui/integration/sample-wallpaper-console/src/components/laptop/Waiting.tsx:4-6` |

JSON 每行至少含 `row`, `end`, `sourceDigest`, `capturedAt`, `runId`, `startupComplete`, `primaryReadyPartKey`, `secondary`, `secondaryPartKey`, `secondaryDisplayId`, `secondaryXmlPath`, `business`, `cleanup`；Web 结果时间必须早于对应设备结果。双屏专属几何不伪造 Web；未覆盖项明确 `NOT_COVERED_BY_PRODUCT_CONSUMER` 或 `OPEN`，不升级为 PASS。

### 7.7 AC-13 TR-08

交付必须明确写：`TR-08=OPEN/OUT_OF_SCOPE`。后续待办：

```text
owner=platform/frontend-platform
input=Dexter 对 harness debug-only 或删除的单独裁定 + 两个 harness 的 route/production-bundle 约束
firstGate=tools/terminal-sample2/check-production-bundle.test.mjs 的 automation token/production absence 门
```

本批不删 guard token、不改变 harness release 行为、不把 production-bundle 绿写成 TR-08 已关闭。

## 8. 记忆、正本与历史文件

### 8.1 active 正本同步

CP-3/CP-4 只修改当前 active 且语义指顶层 application/integration 层的文本；`doc/plans/**`、`doc/review/**`、`doc/handoffs/**`、`doc/evidence/**` 的历史记录不改写。`terminal-coding-standard.md` §7.1 的 `src/assembly/` 目录词表、装配语义 token、`createAssembly` 等保留。

实施时逐处进入 AC-11 表的预期 active 文件包括：

```text
AGENTS.md
CLAUDE.md
doc/platform/terminal-coding-standard.md
doc/platform/implementation-task-template.md
doc/decisions/**（所有 active decision；当前已知命中至少包括 `doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md`）
.agents/skills/cs-managed-runtime-execution/SKILL.md
.agents/skills/cs-spec-to-plan/SKILL.md
.agents/skills/cs-writing-plans/SKILL.md
project-memory/decisions/terminal-architecture-and-stack-rulings.md
project-memory/operations/terminal-coding-standard.md
project-memory/practices/ter-input-and-virtual-keyboard-usage.md
project-memory/decisions/terminal-build-order-and-batches.md
```

active memory 分两类处理，历史事实不得抹除：

- `terminal-architecture-and-stack-rulings.md`、`operations/terminal-coding-standard.md`、
  `practices/ter-input-and-virtual-keyboard-usage.md` 直接把当前结构、规范和 TR-16/TR-17 现状改为
  `application`/`integration-assembly` 口径；
- `terminal-build-order-and-batches.md` 只追加带日期的“v5 取代旧 build order 中相关层名/下线包口径”条目，
  不回写已有批次历史。`project-memory/required-inventory.json` 的 TR-16 anchor 随标题手工同步；
  `tools/project-memory/cli.mjs:113-115` 只做逐字核对、不生成该文件。`project-memory/index.md`/`index.json`
  由 `scripts/memory/build-index` 生成，不手写。

同步后执行：

```sh
scripts/memory/build-index
scripts/memory/build-index --check
scripts/check/project-memory
scripts/memory/query --task-kind design --domain platform --consumer-face platform-admin --owner platform --impact architecture --trigger task-start
```

查询结果必须能路由到新规范性取代条目；旧历史条目仍可被历史检索，但不能成为 active implementation 的唯一规则。

### 8.2 AC-12 历史记录与仓外 archive

历史 evidence 不回写为新名；在新的 CP evidence 中同时记录旧→新映射。仓外 archive 不放 `/tmp`，不纳入仓库 active file scan，但 archive manifest 必须记录路径、时间、文件数、字节数、sha256 和恢复命令。清理只允许明确属于本批、可恢复、且未被当前受管运行持有的目录。

## 9. 逐代码与详设对账（交付硬门）

这是实施计划的独立交付步骤，不是测试摘要。CP-4 必须生成：

```text
doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/reconciliation/
  cp-0-three-dimensional-reconciliation.json
  cp-1-three-dimensional-reconciliation.json
  cp-2-three-dimensional-reconciliation.json
  cp-3-three-dimensional-reconciliation.json
  final-code-to-design-reconciliation.md
```

### 9.1 CP 级三维对账

每个 CP 结束由 fresh 只读 reviewer 逐条比较：

- v5 需求中的 PL-R、AC、D；
- 详设/方案对应 section、命名映射、file set、owner、失败/恢复和证据要求；
- `project-memory/operations/terminal-coding-standard.md`、`decisions/terminal-architecture-and-stack-rulings.md`、`decisions/terminal-build-order-and-batches.md`、`practices/ter-input-and-virtual-keyboard-usage.md` 命中的约束。

每行固定字段：`cp`, `requirementAnchor`, `designAnchor`, `memoryAnchor`, `sourceAnchor`, `evidencePath`, `reviewer`, `status`, `difference`, `firstFailure`, `lastKnownGood`, `brokenBoundary`。`status` 只能 `MATCHED` 或 `OPEN`；OPEN 必须回主 agent 修复并由新的 fresh reviewer 复查。

### 9.2 最终逐代码与详设对账

逐条覆盖所有新增、修改、移动和归档关联的：

```text
生产源码、测试、README、src/index.ts、package.json、exports、terminal-invariants.json、
检查器、工具、runner、根 package.json、yarn.lock、Android/Kotlin/Gradle/Expo 配置、
active 正本、project-memory、skill 文本、archive manifest、AC-2/3/8/9/10/11/13 evidence。
```

每行列：详设 section/plan step、代码或文档位置、具体 symbol/anchor、证据路径、判定人、差异、status。README 必须人工逐条核对，不能用机器扫描替代。不得用“按计划完成”作为行内容。任一 OPEN 都是“实施未就绪”，禁止交 Dexter/Claude implementation review。

## 10. 实施后 review 与交付材料

只有以下材料全部完成，才可以组织 `REVIEW_TARGET=IMPLEMENTATION`：

1. CP-0 至 CP-4 状态与每步 gate 输出；
2. CP-0 baseline first failure 与 root-cause 修复记录；
3. 四包 archive/restore manifest；
4. AC-2 正控制、活跃扫描、逐处分类和 AC-8 allowed-diff 同表；
5. AC-3 四处换靶和三条新增 red mutation 的首次红/恢复绿；
6. AC-9 两 App 独立原生生成物、dex、keystore/certificate 证据；
7. AC-10 两行 Web→设备并列 JSON，包含 sourceDigest、startup、SECONDARY、business、cleanup；
8. AC-11 active memory 与正本同步记录、AC-12 历史不改写证明、AC-13 `TR-08=OPEN/OUT_OF_SCOPE`；
9. CP 级三维对账和最终逐代码与详设对账，全部 MATCHED；
10. fresh 独立 `REVIEW_TARGET=IMPLEMENTATION` 审查及每条 finding 的详设位置、实现位置、证据与处置；
11. Claude handoff 通过模板检查。

实施阶段最终回报必须分档：`static`、`focused`、`Web`、`Android/native/device`、`business`、`cleanup`、`visual`。本批没有视觉改动，不得把结构或 startup 证据写成视觉通过；未执行项写 `NOT_RUN`/`OPEN` 并说明原因。

## 11. 当前阶段结论

详设和本计划完成后，当前唯一允许的下一步是按 `doc/review/platform/2026-09-25-ter-package-layout-cleanup-design-review-handoff-codex.md`
交 Claude 做本轮 DESIGN follow-up review；不重开已完成的两轮 fresh 独立 DESIGN 盲审。本轮仍不安装、不构建、不移动、
不清理、不运行 Web/Metro/Android/设备。只有 Claude 给出 GO 且 Dexter 另行确认实施入口后，才按 CP-0→CP-4 顺序执行。
