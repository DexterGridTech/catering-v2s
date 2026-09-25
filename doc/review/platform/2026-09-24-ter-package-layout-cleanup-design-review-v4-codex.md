# TER 包布局整理 v4 DESIGN 独立复核（Codex）

复核对象：

- `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md`
- `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-solution-claude.md`
- `doc/review/platform/2026-09-24-ter-package-layout-cleanup-design-review-intake-claude.md`

复核范围：只读复核当前源码、规范、项目记忆、v4 需求与方案；允许运行已有静态门确认第 0 步基线；没有修改源码、需求、方案、依赖或构建产物，没有安装、构建、Web、Metro、Android、虚拟机或真机运行。

## 结论

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=3/2/2
L1_ENGINEERING=3 个 Major、2 个 Significant，见 M-1 至 M-3、S-1 至 S-2
L2_USER_VISIBLE=NOT_APPLICABLE（本批是包布局、检查器、构建与证据治理变更，不新增用户界面或 Journey）
L3_UNVERIFIED=未执行构建、Web、Android、设备和动态配对；这些是实施阶段证据，不作为本轮设计通过条件
SAME_ROOT_SCAN=已扫描旧顶层 assembly、旧 console-assembly、四个下线包、camelCase 层名标识、检查器/runner/原生配置、正本文档与 active project-memory；M-1 与 M-2 为扫描/证据入口遗漏，M-3 为全量门分母遗漏，S-1 与 S-2 为可执行性收口缺口
DESIGN_GAPS=AC-2 标识符级扫描契约、AC-10 startup.complete 证据入口与 artifact schema、AC-0/AC-6 全量基线失败清单、AC-8 精确快照文件集
EVIDENCE_TIER=源码与静态门当前字节；未包含构建或运行时证据
```

v4 相比上一版已经实质收敛：PL-R00 明确要求先实跑、冻结失败清单、逐根因修复；AC-8 增加了快照、锚定映射、逐文件允许差异和红变异；AC-11 增加了 active 正本与记忆的逐处分类；AC-13 明确保持 TR-08 `OPEN/OUT_OF_SCOPE`；第 974 行保留的反驳也成立。但下面三处仍会让详设或实施阶段继续猜测，且其中两处会使“旧层名已清除”或“TR-16 两端证据已配对”的验收判据空过，因此暂不建议进入详设。

## 当前字节的基线复核

按需求 §2、§3 和 AC-6 读取并运行了当前已有门：

| 门 | 当前结果 | 首个可定位事实 |
| --- | --- | --- |
| `yarn --cwd apps/terminal typecheck` | PASS | 33/33 Turbo tasks |
| `yarn --cwd apps/terminal test` | FAIL | `kernel-base-transport` 的 `identityClient.test.ts:20,60` 夹具缺 `moduleName`；契约在 `topologyWire.ts:216-225` 已要求该字段，原生 `TerminalTopologyServer.kt:140` 已发送 |
| `yarn --cwd apps/terminal verify:static` | FAIL | readability real：TR-R03 1、TR-R04 7、TR-R05 4、TR-R06 2 |
| `tools/terminal-skeleton/check-static.mjs` | FAIL | `assembly.android.sample-terminal` 图缺 `ui.base.input`、`ui.base.primitives` |
| `tools/terminal-layering/check-static.mjs` | FAIL | `StaffLoginForm.tsx:13` 使用字符串宿主 `form` |
| `tools/terminal-ui-state/check-static.mjs` | PASS | 全部门 PASS |
| `tools/terminal-sample2/check-native-projection.test.mjs` | FAIL | `sample-terminal has an unallowed darkMode difference`，当前 `sample-terminal/tailwind.config.cjs:3` 仍为 `darkMode: 'class'` |
| `tools/terminal-sample2/check-production-bundle.test.mjs` | PASS | 既有生产 bundle 门及其红变异通过 |
| `tools/terminal-image-compare/test/compare.test.mjs` | PASS | 既有比较器测试通过 |
| `scripts/test/ter-virtual-keyboard-android.test.mjs` | PASS | 66 tests passed |
| `scripts/memory/build-index --check`、`scripts/check/project-memory` | PASS | 当前 project-memory 索引与断言通过 |

需求 §1.3 已列 transport 夹具、readability、skeleton graph、StaffLoginForm 等失败，但没有列出 `check-native-projection.test.mjs` 的真实失败。由于 v4 的 Dexter 授权把范围扩大为“所有门全部通过”，这不是可忽略的范围外测试；必须进入第 0 步冻结清单，或在详设中明确其产品/行为边界并由 Dexter 裁定。

## Findings

### M-1 · AC-2 漏掉顶层 application 层的 camelCase 标识

- 类型：仓内事实 + 推论。
- 文档位置：需求 §4 AC-2，`...formal-requirements-claude.md:211-247`；相关影响清单在 `...solution-claude.md:69-123`。
- 事实：AC-2 当前覆盖 `apps/terminal/assembly`、`assembly.`、`assembly-`、`assembly\.` 以及若干包和导出名，但没有把顶层层名的标识符形态列为禁用/分类分母。
- 当前证据：
  - `tools/terminal-sample2/run-u8-release-cold-start.mjs:18` 仍使用 `assemblyRoot` 指向 `apps/terminal/assembly/android/sample-terminal`；
  - `tools/terminal-sample2/run-a9-runtime.mjs:7` 仍使用 `assemblyRoot` 指向旧顶层路径；
  - `tools/terminal-skeleton/verify.mjs:261-270` 使用 `assemblyDirectory` 作为顶层应用目录；
  - `tools/terminal-skeleton/check-static.mjs:504-520` 使用 `assemblyModuleNames`、`assemblyDirectory` 等层语义标识。
- 反例：只把路径、包名和点号模式改成新名字后，保留或把旧层名重新写成 `assemblyRoot`、`assemblyDirectory`、`assemblyModuleNames`，现有 AC-2 模式仍可能零命中；因此旧层名语义可残留而门仍绿。
- 最小修订：AC-2 增加标识符级禁用/分类清单，至少覆盖当前同根的 `assemblyRoot`、`assemblyDirectory`、`assemblyModuleName(s)`、`assemblyBasePackagePath` 等真实标识；允许保留的 `assembly` 单词必须逐处证明是装配对象、`src/assembly/`、`createXxxAssembly` 或 `assembly-rejection`，不能用一个宽泛 allowlist 放行整个文件。
- 可执行验收判据：
  1. 由 `git ls-files -co --exclude-standard` 生成 active 文件集，逐文件执行字面量、PCRE 和标识符级扫描，且记录未跟踪文件与历史目录过滤；
  2. 改名完成前，对每个新增模式做正控制；改回一个新标识为 `assemblyRoot` 或 `assemblyDirectory` 时，AC-2 必须失败并指出文件/行/规则；
  3. 对 `src/assembly/`、装配变量、composition callback 和 integration 自有 `Console` 名称分别做反向控制，确保不会把合法装配语义误报为层残留。

### M-2 · AC-10 引用的证据入口与字段事实不符

- 类型：仓内事实 + 推论。
- 文档位置：需求 §4 AC-10，`...formal-requirements-claude.md:298-312`；详设交接项在 `...solution-claude.md:185-195`。
- 事实：AC-10 声称证据字段取法沿用 `tools/terminal-sample2/run-sample2-frozen-journey.mjs:434-448`。当前这些行处理的是 wallpaper 选项、确认节点和滚动后的 UI 树，不是 `startup.complete`、readiness、`primaryReadyPartKey` 或双屏 partKey 的诊断证据。
- 当前证据：
  - `tools/terminal-sample2/run-sample2-frozen-journey.mjs:434-448` 是 `confirmNode`、`selectedOptions` 等 wallpaper Journey 逻辑；
  - `apps/terminal/ui/base/console-assembly/src/foundations/startupDiagnosticsWriter.ts:52-65` 才写入 `startup.complete` 及 `primaryReadyPartKey`、`primaryContentFailure`、readiness 数据；
  - `apps/terminal/ui/base/console-assembly/src/foundations/consoleAssembly.tsx:374-385` 才建立 readiness 状态；
  - 当前生成的 Expo 模块清单位于 `apps/terminal/node_modules/expo/android/build/generated/expo/src/main/java/expo/modules/ExpoModulesPackageList.kt`，其 `modulesMap` 目前列出三个旧 `assembly.base.android` 全名，说明 AC-9/AC-10 后续必须绑定真实生成物和源码摘要，而不是泛引一个 Journey runner 行号。
- 反例：实施者按 AC-10 的引用打开 runner，只能读到 wallpaper 选择状态，无法从该位置生成要求的 `owner`、`writer`、六组 readiness、`primaryReadyPartKey`、`primaryContentFailure` 和 SECONDARY `displayIndex/partKey`；最终会出现“有两端截图但没有规定字段来源”的假配对。
- 最小修订：把 AC-10 的证据入口改为 `startupDiagnosticsWriter.ts` 产生的结构化 `startup.complete` 记录及双屏读取入口，明确字段路径、日志/事件读取命令、artifact JSON schema、源码摘要字段、Web 与设备各自 writer/reader；详设再冻结两个 integration 的实际 `primaryReadyPartKey` 和 SECONDARY `partKey`。
- 可执行验收判据：
  1. 每一行 TR-16 配对都能从同一套 schema 读取 `owner`、`writer`、readiness、`primaryReadyPartKey`、`primaryContentFailure`，双屏另读 `displayIndex` 与 `partKey`；
  2. 交换 SECONDARY partKey、清空 readiness、把 writer 改回旧包名、或改变任一端源码摘要时，验证器必须在明确字段上失败；
  3. Web evidence 的时间、设备 run ID、源码摘要和 cleanup 结果均写入同一条可恢复记录，不能用截图文件存在性代替。

### M-3 · PL-R00/AC-0 的“全量基线失败清单”当前不完整

- 类型：仓内事实 + 产品/范围判断（涉及是否把现有门纳入本批，标 `DEXTER_DECISION`）。
- 文档位置：需求 §3 PL-R00，`...formal-requirements-claude.md:118-129`；AC-0/AC-6，`...formal-requirements-claude.md:211-274`。
- 事实：v4 已经把“先实跑、冻结、逐根因修到全绿”写对，但 §1.3 的现有基线列表没有包含实际运行得到的 `terminal-sample2/check-native-projection.test.mjs` 失败。当前失败为 `sample-terminal has an unallowed darkMode difference`，来源是 `apps/terminal/assembly/android/sample-terminal/tailwind.config.cjs:3`。
- 另一个可复核边界：本轮 `yarn test` 运行后部分 package-local `node_modules` 缓存已被 runner 清理，因此 v4 表中三处缓存的历史推断不能直接当作本次复核的当前证据；第 0 步必须在任何会清理现场的 runner 之前完成只读 ignored-artifact inventory。
- 反例：按 v4 §1.3 只修列出的 failures，跑完表内门后仍可能在 `AC-6` 的 terminal-sample2 子门失败；或者先跑清理型测试再记录缓存，导致“缓存已删除”的证据无法区分原本不存在、已被 runner 删除和本步骤主动清除。
- 最小修订：把 `check-native-projection.test.mjs` 失败追加到基线表，并在详设中决定它是行为保持的配置修复还是 `DEXTER_DECISION`；第 0 步先记录每个 ignored cache 的存在性、字节数/目录清单，再允许任何会清理它们的测试 runner。
- 可执行验收判据：
  1. 基线 manifest 逐条包含三道门及全部子门、命令、退出码、first failure、文件/行/报文、keystore hash 和 ignored-artifact inventory；
  2. 第 0 步结束后 `yarn typecheck`、`yarn test`、`yarn verify:static` 及 AC-6 列出的每个子门全部 PASS；
  3. `sample-terminal` 的 `darkMode` 差异若保留，必须有 Dexter 的明确产品/平台裁定，不能把未决失败从分母中删除；若修复，必须记录行为不变依据和红变异。

### S-1 · AC-8 的快照文件集仍有“源码与配置”的边界空洞

- 类型：文档可执行性推论。
- 文档位置：需求 AC-8，`...formal-requirements-claude.md:278-289`；详设交接项，`...solution-claude.md:185-195`。
- 事实：§2 把 active 文件集扩大到脚本、检查器、README、`doc/platform/**`、`doc/decisions/**`、`AGENTS.md`、`CLAUDE.md`、`project-memory/**`、`.agents/skills/**`，而 AC-8 又把快照文件集描述为 active 集里的“源码与配置”。没有定义哪些脚本、测试、README、规范和记忆文件进入快照、哪些只由 AC-11 管理，也没有规定快照后对 active 文件集合本身做 exact equality。
- 反例：在未列入“源码与配置”的 runner、检查器或规范中夹带一个旧名/行为变更，AC-8 可能不比较该文件；反过来如果把全部 active 文件都纳入，又必须把正本文案和 memory 的允许差异按文件列出，否则无法稳定复核。
- 建议验收：详设冻结一个 manifest schema，逐文件记录 `path/category/sha256/allowedDiffRef`；快照前后先比较文件集合，再比较每个文件 hash；任何未分类文件、未登记新增/删除、扩大 allowlist 的变异都失败。AC-8 与 AC-11 的覆盖边界要在同一张表里写死。

### S-2 · AC-9 的生成物和证书工具链需在详设冻结

- 类型：仓内事实 + 文档可执行性推论。
- 文档位置：需求 AC-9，`...formal-requirements-claude.md:291-296`；详设交接项，`...solution-claude.md:185-195`。
- 事实：v4 已明确要求 `ExpoModulesPackageList`、三个新全名、keystore hash、APK 证书摘要和两个变异，但把生成文件路径、读取命令和期望值全部留给详设。当前 repo 里实际可定位的是 `apps/terminal/node_modules/expo/android/build/generated/expo/src/main/java/expo/modules/ExpoModulesPackageList.kt`；另有两个 app 的 React Native `PackageList.java`，它们不是同一个 artifact。
- 反例：如果详设误读 `PackageList.java`，会漏掉 Expo module 的三个类；如果只读取共享 `node_modules/expo` 生成物而不绑定本次两个 application build 的产物，也无法证明两个 release APK 各自使用了当前 `expo-module.config.json:5-7` 的新 namespace。
- 建议验收：详设分别冻结两个 application 的 release build 输出目录、实际生成的 `ExpoModulesPackageList` 来源、三类全名抽取命令、APK/keystore 证书摘要命令和 expected hash；改一个模块全名、换一个 keystore、读取错误生成文件时必须分别红。

## 其余重点核验

### 第 0 步已知修法

以下几项与当前字节相符，方向可保留：

- transport 夹具补 `moduleName` 是契约根因修复：`topologyWire.ts:216-225` 已要求字段，`TerminalTopologyServer.kt:140` 已发送；
- 两个 App 节点补 `ui.base.input`、`ui.base.primitives` 与各自 `package.json`、`src/dependencies.ts` 的当前消费集一致；
- `StaffLoginForm` 将 Web `form` 宿主移到 primitives 能同时消除 TR-R03/P-5d，必须保持 Web submit 与 native fragment 语义；
- harness 放到 `src/components/` 与当前 App import 方式一致，不能放到 `testing/`；
- readability 余项必须以实跑清单为准，不能把“预计有 7 条/4 条/2 条”当作冻结分母。

这些修法并不关闭 M-3：`sample-terminal` 的 `darkMode` 失败仍需进入第 0 步裁定或修复。

### AC-3、AC-6、AC-11、AC-13

- AC-3 的“每条红测试断言具体 gate 与报文前缀、四处换靶夹具逐一列输入/变异/恢复”已经具备可执行形状；详设必须补足具体 fixture，不得只写“新增红测试”。
- AC-6 的“每步全部门全绿、锁文件只由本条验收”方向正确；四步中间态能否过门取决于详设给出每一步完整文件集与安装顺序，不能只依赖最终扫描。
- AC-11 的逐处分类、active memory 追加 supersession、`build-index`/`project-memory` 检查方向正确；`doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md` 等当前 active 文件仍需在详设表中逐处区分层语义与装配语义。
- AC-13 明确 `TR-08=OPEN/OUT_OF_SCOPE`，且要求 owner、输入、首个 gate，口径正确；不能因 automation token 在扫描 allowlist 中而把 TR-08 误报关闭。

### 决策与第 974 行

- D-1 Kotlin 包名随 application 层改名：工程上合理，因为 `expo-module.config.json:5-7` 和原生 Kotlin 全限定名属于同一命名契约；详设需给出目录、namespace、生成物和 APK 反向核对。
- D-2 包内以 Console 开头的旧 assembly 名称统一改名：合理，但必须保留 integration 自有 `WallpaperConsoleAssembly`、`createSampleWallpaperConsoleAssembly` 等业务组合名，并由 AC-2 逐处分类。
- D-3 `test-support` 并回 platform-ports、D-4 线下移出不删除、D-5 harness 原样搬位，以及 TR-08 token 保留，均属于 Dexter 已授权的架构/治理决策；详设仍需补类型来源映射、恢复记录和后续 owner，不能以仓内零命中替代外部消费者裁定。
- 前一轮针对 `doc/platform/terminal-coding-standard.md:974` 的 finding 应撤回。该行位于 §7.1 的 `src/` 目录词表 `955-974`，明确指包内 `src/assembly/` 的装配目录，不是顶层 `apps/terminal/assembly` 层。v4 保留它是正确的，判定为 `REJECTED_WITH_EVIDENCE`。

## 方案合理性

目标、四步顺序和“每一步安装后过三道门与全部子门”的总体方案是合理的：先恢复基线可解释性，再做下线/合并，随后做 console 包改名和顶层层改名，最后用扫描、快照、原生和 TR-16 证据收口；这比在不绿基线下直接移动目录可审计得多。

但当前方案还不能证明“做完能证明做对”：AC-2 会漏掉真实的层名标识；AC-10 的证据引用不能产生它声称的字段；第 0 步的全量门分母还漏掉已实跑的 sample2 native projection 失败。S-1/S-2 虽可在详设阶段收口，但必须在详设中冻结，不能再以“后续补命令”作为已关闭判据。

## 进入详设前的最小修订清单

1. 修订 AC-2：加入 camelCase 层名标识的禁用/分类分母、正控制、换靶红变异和合法装配语义反控制。
2. 修订 AC-10：改用 `startupDiagnosticsWriter.ts`/实际双屏 readiness 证据入口，冻结字段路径、artifact schema、读取命令和预期 partKey 的来源。
3. 把 `check-native-projection.test.mjs` 的真实失败加入 AC-0/PL-R00 基线，或由 Dexter 对其范围/行为作明确裁定；在任何清理型 runner 前冻结 ignored-artifact inventory。
4. 在详设中冻结 AC-8 的逐文件 manifest 范围，并让 AC-8 与 AC-11 对 active 文件集合的责任边界相交且可核对。
5. 在详设中冻结 AC-9 两个 application 的生成物来源与 APK/keystore 证书核验命令。

上述修订完成并重新独立核对后，才建议进入详设；本轮不授权实施。
