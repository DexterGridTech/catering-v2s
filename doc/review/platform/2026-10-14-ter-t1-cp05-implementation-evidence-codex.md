# TER T1 · CP-05 实施证据与回读索引

`REVIEW_TARGET=IMPLEMENTATION_RECONCILIATION_INPUT`
`CP=CP-05`
`AUTHOR_VERDICT=NOT_CLAIMED`

本记录只整理当前 CP-05 的实现与 focused proof，供 fresh 独立三维对账复核；它不是 `MATCHED`、6b、动态验收或整批交付 verdict。

## 范围与判据

- 计划：`doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-plan-codex.md` §6。
- 详设：`doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-design-codex.md` CP-05 / §8.1 / §11a。
- 正本：正式需求 R-03、R-15、V-02、V-03、V-18；`doc/platform/terminal-coding-standard.md` §7.1、TR-R06、§8。
- CP-03 与 CP-04 已有独立记录继续只覆盖各自完整 CP：`2026-10-13-ter-key-code-structure-t1-cp03-implementation-reconciliation-codex.md`、`2026-10-13-ter-t1-cp04-implementation-reconciliation-codex.md`。本记录不把它们扩写成 CP-05 或 6b 结论。

## 当前字节的变更与回读

1. `tools/terminal-skeleton/check-static.mjs` 新增闭合 `src/` 根目录与 `features/` 直接子目录的 `source-layout` 规则，并将 source-layout 纳入 12 项 rule gates。允许词表与 TR-R06 §7.1 一致：法定根目录和 `index.ts`、`moduleName.ts`、`dependencies.ts`；features 直接子目录只允许 `actors/`、`slices/`。
2. `tools/terminal-skeleton/check-static.test.mjs` 为旧 `features/commands`、旧 `features/variables`、根 `parts/`、未分类根文件提供 scratch-copy 红 mutation；每个 mutation 检查只触发 `source-layout`，并清理新建的空目录。TR-01 fixture 使用真实包内 import 与 `ActorExecutionContext` 类型；actor 资格识别解析到的 `defineActor`，允许 owner 在 `features/actors/shared/install*Commands.ts` 登记 handler，同时保留对其他 helper 越权 `dispatchAction` 的红例。
3. `storeBasicActor.ts` 将 `setStoreLoading`、`applyStoreRead` 两个 reducer callback 传入 `createLoadStore`；`shared/loadStore.ts` 只调用 owner callbacks，不直接 dispatch reducer action。`projectBasicActor.ts` 提供 `applyOrganizationPath` 给 `shared/loadProjectContext.ts`；dispatch 仍由 owner actor 持有。旧 `terminal-invariants.json` 中这两项 helper reducer 例外已删除。
4. 已改包 README 使用中文说明定位、结构、责任和公开边界；`display-context`、`terminal-update`、`sample-wallpaper-console` 的示例路径已改为当前 `declarations/` 结构。`doc/platform/terminal-coding-standard.md` TR-14 仓内实例同步为 `admin-shell/src/declarations/parts.ts`。扫描 `apps/terminal/**/README.md` 与该规范后，旧 `src/parts/parts`、`features/commands/commands`、旧 `admin-shell/src/parts/parts` 路径无命中。
5. 新的已确认失败模式写入 `project-memory/pitfalls/machine-gate-selftest-format-fragility.md`，覆盖目录门词表与反例集合、真实 package import/type 的 gate fixture、composed actor 定义识别，以及 actor callback 签名变化时同步 owner factory wiring。`project-memory/required-inventory.json` 的 assertions/assertionSources/sourceRefs 已同步；索引由受管 builder 生成，未手改 `project-memory/index.md`。

## CP-05 README 逐项复核范围

以下30份当前包 README 属于 CP-05 的包职责/维护说明回读集合。fresh reviewer 应逐份对照对应包的当前 `src/` 声明、公开 command/selector、私有 API 与资源/失败责任；不能以中文字符扫描或存在性计数代替语义核对。CP-05 的其余有限包身份和责任边界按 owner/source appendix §1 的39包表逐项交叉检查；该表不表示每个包均在本 CP 修改。

- `apps/terminal/adapter/android/remote/README.md`
- `apps/terminal/adapter/android/topology/README.md`
- `apps/terminal/adapter/android/transport/README.md`
- `apps/terminal/application/base/android/README.md`
- `apps/terminal/kernel/base/display-context/README.md`
- `apps/terminal/kernel/base/platform-ports/README.md`
- `apps/terminal/kernel/base/remote-control/README.md`
- `apps/terminal/kernel/base/runtime/README.md`
- `apps/terminal/kernel/base/terminal-data-client/README.md`
- `apps/terminal/kernel/base/terminal-update/README.md`
- `apps/terminal/kernel/base/topology/README.md`
- `apps/terminal/kernel/base/transport/README.md`
- `apps/terminal/kernel/base/ui-state/README.md`
- `apps/terminal/kernel/feature/project-basic/README.md`
- `apps/terminal/kernel/feature/sample-member-registry/README.md`
- `apps/terminal/kernel/feature/sample-staff-session/README.md`
- `apps/terminal/kernel/feature/sample-wallpaper/README.md`
- `apps/terminal/kernel/feature/store-basic/README.md`
- `apps/terminal/ui/base/admin-shell/README.md`
- `apps/terminal/ui/base/dev-host/README.md`
- `apps/terminal/ui/base/feature-assembly/README.md`
- `apps/terminal/ui/base/input/README.md`
- `apps/terminal/ui/base/integration-assembly/README.md`
- `apps/terminal/ui/base/render/README.md`
- `apps/terminal/ui/base/terminal-activation/README.md`
- `apps/terminal/ui/feature/sample-member-desk/README.md`
- `apps/terminal/ui/feature/sample-staff-auth/README.md`
- `apps/terminal/ui/feature/sample-wallpaper-picker/README.md`
- `apps/terminal/ui/integration/sample-console/README.md`
- `apps/terminal/ui/integration/sample-wallpaper-console/README.md`

## Focused proof

以下均为当前相关源码上的本地 focused 命令；未启动 DEV、Expo Web、Android、虚拟机、设备或后台动态运行。

| 命令 | 实际结果 |
|---|---|
| `yarn workspace @catering-v2s/kernel-feature-store-basic typecheck` | PASS，退出码 0；修复后运行 |
| `yarn workspace @catering-v2s/kernel-feature-store-basic test` | PASS，PROD 1 file / 21 tests，unhandled=0；修复后运行 |
| `yarn workspace @catering-v2s/kernel-feature-project-basic typecheck` | PASS，退出码 0；修复后运行 |
| `yarn workspace @catering-v2s/kernel-feature-project-basic test` | PASS，PROD 2 files / 13 tests，unhandled=0；修复后运行 |
| `node tools/terminal-skeleton/check-static.mjs` | PASS，12/12 rule gates；`SCAFFOLD_HYGIENE=PASS` |
| `node tools/terminal-skeleton/check-static.test.mjs` | PASS，`TERMINAL_SKELETON_MODEL_TEST=PASS`；完成全部既有 red mutations。该套件耗时约 6 分钟，代码和门的相关字节未再变化，不重复运行 |
| `scripts/memory/build-index` | PASS，85 entries / 6 kernel / 79 routed |
| `scripts/memory/build-index --check` | PASS，85 entries / 6 kernel / 79 routed |
| TER package/README 目录扫描 | 41 个 workspace package 均有 README；49 份 TER README 均含中文字符。此计数只证明覆盖/语言存在，不替代 README 与当前源码逐项语义对读 |

## 首败与修复

首次复验时，store-basic typecheck 报 `storeBasicActor.ts` 创建 `createLoadStore` 时漏传 `setStoreLoading` 与 `applyStoreRead`；runtime test 同时报 `setStoreLoading is not a function`。project-basic 的 `CP01_ORGANIZATION_READ_NOT_STARTED` 是 store actor 提前失败造成的级联反例，不是第二个根因。主 agent 在 owner factory 中补齐这两个 callback，并用原四条 store/project typecheck、test 命令全部复验通过。失败证明和修复后的同组 proof 均保留在当前会话输出；修复没有改 owner、API、判据或执行面。

## 尚未由本记录证明

- README 的公开 API、具体职责与所有 package 当前源文件逐项语义一致性仍交 fresh CP-05 reviewer 检查；本记录中的语言/存在性扫描不冒充该项 proof。
- 全批 6b、CP-06 logs / `TEST_CHAIN_PREFLIGHT`、DEV backend、Expo Web、Android 设备矩阵、business 与 cleanup 均未由本记录证明。

## Fresh CP-05 review R2 的 README finding intake

独立 reviewer `/root/t1_cp05_reconcile_r2` 在先形成独立结论后核对本记录，结果仍为 `OPEN`：目录门和 store/project callback wiring 未发现偏差，但确认下列8份 README 未完整满足 `TR-10` 的真实用法/迭代说明/公开面要求。主 agent 重读 `doc/platform/terminal-coding-standard.md` §TR-10/§8、正式需求 R-15、这8份 README、各自 `src/index.ts`/工厂签名及本包 `package.json` 后，将其判为 **CONFIRMED（文档缺口）**，不改变业务语义或包边界。

| README | 已确认缺口 | 最小修正 |
|---|---|---|
| `apps/terminal/adapter/android/topology/README.md` | 缺真实公开工厂用法和迭代步骤 | 加入 host/peer 工厂装配示例、依赖/调用者定位与受管验证命令 |
| `apps/terminal/adapter/android/transport/README.md` | 缺真实 adapter factory 用法和迭代步骤 | 加入 application 实际 factory 接线片段、依赖/调用者定位与验证命令 |
| `apps/terminal/ui/base/terminal-activation/README.md` | 缺结构、module 用法和迭代步骤，公开面描述不完整 | 按现有目录补结构；列本包公开能力；使用真实 module factory 作例并补 scoped 命令 |
| `apps/terminal/ui/base/admin-shell/README.md` | 仅有行内工厂提及，没有最小代码示例和明确迭代章节 | 补真实 module factory 示例和迭代检查/命令；中文化包标题 |
| `apps/terminal/ui/base/integration-assembly/README.md` | 缺最小公开用法示例 | 展示 `createIntegrationAssembly` 到 `createSurfaceForDisplayIndex` 的现有公开调用，并明确依赖/消费者 |
| `apps/terminal/ui/base/feature-assembly/README.md` | 既有示例调用 feature consumer，没有演示本包真实公开 factory；缺迭代章节 | 改成 `createUiRuntimeModule` 的实际调用并补维护检查/命令；中文化包标题 |
| `apps/terminal/ui/base/input/README.md` | 已有真实字段用法例，但缺迭代章节 | 补复用边界、受管 test/type/lint 命令 |
| `apps/terminal/ui/base/render/README.md` | 已有真实 selector/render 用法例，但缺迭代章节 | 补复用边界、受管 test/type/lint 命令 |

修订仅触及上述8份 README。示例逐项对照实际 root exports 与 consumer：topology 的两个工厂在 `adapter-android-topology/src/index.ts`、`application/base/android/src/implementations/androidPlatformBinding.ts`；transport factory 在其 root index 与同一 Android binding；activation/admin module factory 分别在对应 `src/index.ts` 与两个 integration 的 assembly；integration assembly 两个函数在本包 root index，且 Android App 以该 surface helper 挂载；feature-assembly 的 `createUiRuntimeModule`、input 的 `useInputField`、render 的 `useUiStateSelector` 都是各自 root export。八个 package 的 `typecheck`、`test`、`lint` 脚本均已从当前 `package.json` 读回。未改代码，未重跑与本次文档修订无关的门或运行。

主 agent 对上述8份 README 与同组真实 export/consumer/依赖签名完成写后回读。`CP-05` 阶段对账仍待新的 fresh 独立 reviewer 判定；此处作者 intake 不是 `MATCHED` 或整批 verdict。

## Fresh CP-05 review R3 的 README finding intake

独立 reviewer /root/t1_cp05_reconcile_r3 在读取本记录前先形成 OPEN，随后确认三处 README 示例与当前必填输入不一致。主 agent 重新核对 TR-10、R-15、根导出和真实类型后，三项均为 CONFIRMED（说明与示例准确性）；只做文档修正，不改生产 API：

| README | 核验事实 | 最小修正 |
|---|---|---|
| apps/terminal/kernel/base/platform-ports/README.md | PlatformPortBindings 有 11 个必填字段；remoteControl 是第 11 项，且 unavailableRemoteControlPort 从包根导出。原“十个键”及示例漏项不匹配。 | 改为“十一个键”，在真实导入和 bindings 示例中加入 remoteControl: unavailableRemoteControlPort。 |
| apps/terminal/ui/integration/sample-console/README.md | createSampleAssembly 的输入类型要求 nativeLoadingCapability；Android 应用装配由 createAndroidPlatformBinding 提供该值。原签名省略必填项。 | 在最小使用签名列出 nativeLoadingCapability，并说明由 Android application host 注入。 |
| apps/terminal/ui/integration/sample-wallpaper-console/README.md | createSampleWallpaperConsoleAssembly 的输入类型同样要求 nativeLoadingCapability；对应 Android 装配来自同一 binding 能力。 | 在代码示例加入该字段，并说明其由 Android application host 提供。 |

写后回读确认 platform-ports/src/index.ts 导出不可用默认值，PlatformPortBindings 与 PlatformPorts 都要求 remoteControl；两个 integration assembly 输入类型均要求 nativeLoadingCapability，Android 调用装配从 androidPlatform.nativeLoadingCapability 传入。扫描三个 README 未发现旧“十个键”或遗漏字段的相同示例。仅修改 README，没有因此重跑测试、构建或动态运行；此前 CP-05 focused proof 的代码字节未变。

CP-05 当前仍为 OPEN，等待下一次 fresh reviewer 核验全部 CP 范围与上述差量。本节是作者 finding intake，不替代独立阶段对账。

## Fresh CP-05 review R4 的 README finding intake

独立 reviewer `/root/t1_cp05_reconcile_r4` 在读取作者证据前先形成 `OPEN`，复核完整 CP-05 后仍为 `OPEN`。R4 标题称“8份”，但 finding 正文逐项列出9个不同 README 路径；主 agent 按正文全集逐一重开当前 TR-10、R-15、CP-05、包根导出/工厂签名、实际调用方和当前 `package.json` scripts，判定九项均为 **CONFIRMED（文档缺口）**。修正只补公开 API 的真实最小示例或本包实际 typecheck/test/lint 命令，不改变生产代码、owner 或包依赖。

| README | 核验和最小修正 |
|---|---|
| `apps/terminal/application/base/android/README.md` | 增加包根 `createAndroidPlatformBinding(persistenceKey)` 示例，并列当前包的 typecheck/test/lint 命令。示例函数及返回的 `platformPorts`、`nativeLoadingCapability` 与 `src/index.ts`、factory 类型一致。 |
| `apps/terminal/kernel/base/display-context/README.md` | 增加 `createDisplayContextModule({surfaceForm: 'laptop'})` 与 `selectDisplayRole(runtime.getState())` 示例，并列当前包的 typecheck/test/lint 命令。 |
| `apps/terminal/kernel/base/remote-control/README.md` | 增加 `createRemoteControlModule` 示例，地址解析回调直接对照两个 integration assembly 的现有接线；补当前包 typecheck/test/lint 命令。 |
| `apps/terminal/kernel/base/terminal-data-client/README.md` | 增加公开 `connectTerminalCommand`、`selectConnectionState` 与 `createRequestId` 的实际 Runtime 调用示例，并列当前包 typecheck/test/lint 命令。 |
| `apps/terminal/kernel/feature/project-basic/README.md` | 增加 `selectProjectTerminalUpdateCandidate(state, applicationId, storeRef)` 示例，对照当前 selector 参数定义及其测试；将迭代章节名统一为 TR-10 指定标题。该 README 已有实际 package 命令，未重复添加。 |
| `apps/terminal/kernel/feature/sample-wallpaper/README.md` | 保留已有真实 command 示例，增加当前包 typecheck/test/lint 命令。 |
| `apps/terminal/ui/base/dev-host/README.md` | 保留已有真实 `createTestExpoApp` 示例，章节统一为 `在这个包上迭代时`，增加当前包 typecheck/test/lint 命令。 |
| `apps/terminal/ui/integration/sample-console/README.md` | 增加包根 `createSampleAssembly` / `createSurfaceForDisplayIndex` 示例，包含真实必填 `nativeLoadingCapability`；统一迭代章节并列当前包 typecheck/test/lint 命令。 |
| `apps/terminal/ui/integration/sample-wallpaper-console/README.md` | 保留已含 `nativeLoadingCapability` 的 assembly 示例；迭代章节统一为 `在这个包上迭代时` 并增加当前包 typecheck/test/lint 命令。 |

写后回读上述九份 README 与对应 `src/index.ts`、factory/selector 声明、两个 integration 的调用处和各包 `package.json`。实际 workspace 名称与三个命令均匹配当前 scripts；样例使用的 factory、command、selector 均由对应包根导出。仅改 README 和本证据记录，未运行代码验证；生产/测试源码与此前 focused proof 字节未改。CP-05 仍为 `OPEN`，待 fresh 独立 reviewer 对同一完整 CP 与30份 README 的修订差量复核。

## Fresh CP-05 review R5 的 README finding intake

独立 reviewer `/root/t1_cp05_reconcile_r5` 先形成 `OPEN`，后核对当前证据，完整 CP-05 仍为 `OPEN`。主 agent 重开 `doc/platform/terminal-coding-standard.md` TR-10、正式需求 R-15、CP-05 计划判据、`platform-ports` README 及 `PlatformPortBindings` 类型。README 第 22、25、101、124 行已经把运行时端口数、`remoteControl` 和完整绑定示例写为十一项；第 77 行目录摘要仍写“十键 bindings”，与同一文档及当前类型中的 11 个必填字段冲突。处置为 **CONFIRMED（文档计数残留）**，影响限于维护说明，不影响生产行为。

最小修正已完成：将 `apps/terminal/kernel/base/platform-ports/README.md` 第 77 行“十键 bindings”改为“十一个键 bindings”。写后回读目录摘要并扫描同一 README 的“十键 / 十个键 / 十一个键 / 十一个运行时端口”措辞；现有计数一致。未改源码；R5 在修正前运行的 `node tools/terminal-skeleton/check-static.mjs` 为 12/12 PASS，文档单词修订不需要重跑机械门或任何运行。

在 R5 完成、R6 尚未开始时，CP-05 仍处于 `OPEN`；该中间状态已由下节 R6 对完整阶段的 fresh 对账取代。本节是 R5 的作者 intake，不单独代表最终 `MATCHED`。

## Fresh CP-05 review R6 对账结果

`/root/t1_cp05_reconcile_r6` 在读取本记录前形成暂定结论，随后独立检查需求 R-03/R-15/V-03/V-18、详设 CP-05/§8.1/§11a、计划 CP-05、TR-10/TR-R06/§8、CP-05 30 份 README、其公开 API/owner 源码、source-layout 门及红例、项目记忆同步；之后才核对本证据与 R2-R5 intake。结论：**CP-05 MATCHED**。

R6 核实：30 份 README 均在核验范围内；platform-ports 当前 `PlatformPortBindings` 与 README 同为 11 个必填 bindings，包含 `remoteControl`；R2-R5 已确认项在当前字节闭合；source-layout 规则/红例及 store/project owner callback wiring 与 TR-R06/owner 边界一致；TR-10 指针和失败模式记忆已同步。R6 复用了本证据第“Focused proof”记录的当前代码 proof，因为相关生产/测试代码字节未受 README 差量影响；没有运行测试、构建、生成、DEV、Expo Web、Android 或其他动态环境。R6 没有将 CP-05 结论扩大为全批 6b、13c 或整批 IMPLEMENTATION verdict。

## Public-surface closure after 6b R2

R2 reopened CP-05 because six package invariants omitted their actual root exports and the Android update package root contained implementation. The author disposition and source locations are recorded in `doc/review/platform/2026-10-14-ter-t1-implementation-6b-intake-codex.md`.

Current-byte focused proof:

| Command | Result |
|---|---|
| `node tools/terminal-skeleton/check-static.mjs` | PASS, 13/13 rule gates; support check and scaffold hygiene PASS |
| `node tools/terminal-skeleton/check-static.test.mjs` | PASS, `TERMINAL_SKELETON_MODEL_TEST=PASS`; missing-field, missing-export, wildcard and root implementation mutations fail at `public-export-invariants` |
| `yarn workspace @catering-v2s/adapter-android-update typecheck` | PASS, exit 0 after relocating the implementation |
| `yarn workspace @catering-v2s/adapter-android-update test` | PASS, 1 file / 11 tests, unhandled=0 |

The model test's first run stopped at an existing application-root import mutation because the strengthened root-barrel rule correctly added a second failing gate. The fixture's expected failure vector was updated and the full model suite then passed. The first update-adapter typecheck exposed three metadata re-exports that moved with the implementation; those now live only in the root barrel, after which focused typecheck/test passed. These were test expectation/source-move corrections, not changes to update behavior.

The six manifest arrays were checked against their TypeScript root exports by the passing static gate. Their Chinese READMEs name the same API. `adapter/android-update/src/index.ts` now contains four explicit re-exports; `androidUpdatePort.ts` owns the moved implementation. No Expo Web, DEV, Android, VM or backend dynamic run occurred. This record does not claim CP-05 reconciliation or batch 6b `MATCHED`; both await fresh independent reviewers.

## Public export and V-01 source-readback closure

The later full-batch 6b R1 finding reopened CP-05 for public-export alignment. Its repair and focused proof are recorded in `doc/review/platform/2026-10-14-ter-t1-implementation-6b-intake-codex.md`. The V-01 source-readback artifact is `doc/review/platform/2026-10-13-ter-t1-implementation-source-review-codex.md`, explicitly an author semantic readback rather than an independent verdict. After updating the design row to point to that existing artifact, fresh full-stage reviewer `/root/t1_cp05_r11` reviewed current CP-05 bytes and returned **MATCHED**. No implementation source changed after the focused proof previously recorded, so that proof is reused; this closure adds no dynamic result.
