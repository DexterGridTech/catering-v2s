# TER 包布局整理 implementation-facing 详设

> STATUS: IMPLEMENTATION_IN_PROGRESS
> REVIEW_TARGET: DESIGN
> REVIEW_CYCLE_ID: `TER_PACKAGE_LAYOUT_CLEANUP_2026-09-24`
> REVIEW_ROUND: 2（fresh 独立盲审已完成；第二轮后作者 SELF_DECIDED 收口）
> REVIEW_ROUND_LIMIT: 2
> ROUND_FINAL_DECISION: SELF_DECIDED（第二轮 findings 已逐条修订并回读；不再开启第三轮）
> SOURCE_REQUIREMENTS: `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md`
> SOURCE_SOLUTION: `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-solution-claude.md`
> IMPLEMENTATION_AUTHORITY: true（Dexter 2026-09-25 follow-up 授权；三处设计补齐后按本详设执行 CP-0 至 CP-4，并在单机双屏与 mobile 上完成授权动态验证）

本文件把 v5 需求和方案收敛成可执行的 implementation-facing 详设。它不重新决定 D-1 至 D-6，也不把
`AC-13 TR-08=OPEN` 改写成通过。所有“当前基线”均来自本轮在当前字节上的实际只读命令；所有“实施时”命令
只定义后续获批实施时的执行方式。

## 0. 元数据与授权边界

```text
BUSINESS_SOURCE=doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md §§1-7；方案 §§1-11
JOURNEY_REFS=NOT_APPLICABLE_WITH_REASON：本批是包布局、构建链和门的结构整理，不新增或修改用户 Journey
IA_REF=NOT_APPLICABLE_WITH_REASON：不新增 UI screen；StaffLoginForm 只把既有 Web form 宿主归属到 primitives
INTERACTION_REF=NOT_APPLICABLE_WITH_REASON：不改变控件动作、文案、焦点、失败或恢复语义
AUTHORIZED=按本详设执行 CP-0 至 CP-4；修改源码、测试、依赖、脚本、构建配置、README、正本与 project-memory；安装、构建、两个 integration 的 Expo Web、单机双屏与 mobile 动态验证
NOT_AUTHORIZED=其它虚拟机或真机、DEV、L2、UAT、seed、reset、TR-08 关闭、超出本详设的改动、除 D-2 前置条件外的数据清除、Git
IMPLEMENTATION_AUTHORITY=true；来源=Dexter 2026-09-25 follow-up 授权
```

已读取并作为约束使用：

- `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、`doc/platform/README.md`、当前 Roadmap 授权字段、`scripts/README.md`；
- `doc/platform/terminal-coding-standard.md` 的 TR-08、TR-10、TR-16、TR-17 与 §7.1；
- `doc/decisions/templates/implementation-design-template.md`、`doc/platform/implementation-task-template.md`；
- `project-memory/operations/terminal-coding-standard.md`、`project-memory/decisions/terminal-architecture-and-stack-rulings.md`、
  `project-memory/decisions/terminal-build-order-and-batches.md`、`project-memory/practices/ter-input-and-virtual-keyboard-usage.md`；
- `cs-spec-to-plan`、`cs-writing-plans` 与 `cs-review`。本文件按 `cs-writing-plans` 要求保留如下 provenance：

```text
SKILL_USED=cs-writing-plans@72190c88b2b5a67a96b91d66aa72b9161913e10e8769da3f28a226f4cc7b99d0
SKILL_USED=cs-spec-to-plan@repo-local/.agents/skills/cs-spec-to-plan/SKILL.md
```

## 1. 真实业务目标与方案比较

### 1.1 要解决的结构性问题

当前 TER 把“可运行 application 层”命名为 `assembly`，把共享整机 integration 壳命名为
`console-assembly`，并保留了四个没有生产消费者的包。这样会产生三类真实成本：

1. 目录、npm 包、moduleName、包图和 Expo 自动链接的身份不再直接表达职责；维护者会把 application
   层误认为普通 assembly 工具，且原生包全名仍携带旧层名。
2. 空壳包和 `plannedDependencies` 使依赖图、检查器计数与实际消费者不一致；下次新增代码可能错误地依赖
   一个并不存在的能力面。
3. 当前字节在正式改名之前已有可重复的门失败：transport 夹具缺 `moduleName`、App graph 缺真实 UI 边、
   StaffLoginForm 直接创建 Web host、readability 的参数/控制深度/源目录门失败、darkMode 检查器与 D-6
   决策冲突。若只移动目录而不先关闭这些失败，改名后的“全绿”会是门空过而不是结构正确。

目标是：以一个可恢复、可逐步验证的变更，把目录/包名/moduleName/原生全名/工具与正本口径同步到真实职责；
把四个没有消费者的包移出仓内并留下可恢复记录；先按根因让三道门及其全部子门绿，再证明没有夹带无关改动，最后
按 AC-9 原生证据与 AC-10 的 TR-16 两行配对证明改名没有破坏实际装配。

### 1.2 方案比较

| 方案 | 结果 | 结论 |
| --- | --- | --- |
| A. 只改 `apps/terminal/assembly` 目录名，保留 npm/moduleName/Kotlin 名 | Expo 自动链接、包图和日志仍带旧层名；`assembly` 目录迁移也无法由扫描证明闭合 | 拒绝 |
| B. 保留旧包并加 alias/fallback，空壳只从 workspace 中隐藏 | 旧名会继续成为可消费入口，违反“名字说真话”和禁止长期兼容层；空壳仍污染 graph/lock | 拒绝 |
| C. CP-0 根因基线 → 先下线/合并 → integration-assembly → application；每个 CP 安装并过三道门，收尾做 AC-2/8/9/10/11/13 | 变更边界可定位、旧入口不会残留、下线可恢复，运行行为差异可由允许差异表约束 | **采用** |
| D. 先批量改名，最后一次性修门 | 中间态不可验证，任何门失败都无法区分基线问题与改名问题 | 拒绝 |

我选了 C 而不是 A/B/D，因为它同时满足 Dexter 的“所有门全部通过”授权、三层身份同步、可恢复下线和
逐步归因；A/B 会留下旧身份，D 会把可定位的小变更变成不可定位的大批次。

### 1.3 已冻结决策与不重新裁定项

| 决策 | 本详设冻结值 | 证据/边界 |
| --- | --- | --- |
| D-1 | Kotlin 包名从 `com.catering.v2s.terminal.assembly.base.android` 改为 `...application.base.android` | 需求 §5；Android 编译与 AC-9 证明 |
| D-2 | `ui/base/console-assembly` 内部 `Console*`/`console*` 标识全部改为 `Integration*`/`integration*`；integration 自有 `WallpaperConsole*` 不改 | 需求 PL-R02、AC-2(b) |
| D-3 | `ui/base/test-support` 的五个类型直接由 `kernel/base/platform-ports` 提供，feature 测试改 import | 需求 PL-R04、platform-ports 当前 index 与 kernel feature 先例 |
| D-4 | 三个空壳和 `ui/base/test-support` 线下移出、不删除；用仓外持久根和逐文件 sha256 记录 | 需求 AC-1；2026-09-15 offline-move 先例 |
| D-5 | 两个 controlled harness 原样移到各自 `src/components/`；TR-08 保持 OPEN | 需求 AC-13；不放 `src/testing/` |
| D-6 | 删除 TER 产品运行/配置/透传中的 darkMode 语义与正向断言；仅保留 native projection checker/test 中用于证明“残留即失败”的负向 guard token | Dexter 2026-09-25；当前无 `dark:`、`.dark`、colorScheme 消费者 |

## 2. CP 总览与依赖

| CP | 主题 | 主 agent 输出 | 进入条件 | 完成条件 |
| --- | --- | --- | --- | --- |
| CP-0 | 只读盘点、基线冻结、根因修复 | 基线失败表、修复代码/测试文件集、CP-0 门结果 | 产物盘点已完成且未运行清理型 runner | 三道门和全部子门全绿；每个 baseline row 有根因、修法和 proof |
| CP-1 | 四包下线与 platform-ports 合并 | archive manifests、包图/依赖/夹具/lock 更新 | CP-0 MATCHED | 目录不存在、恢复记录完整、feature 五类型从 platform-ports 取、AC-4/5/6 绿 |
| CP-2 | console → integration-assembly | 包目录、API 标识、日志 owner/writer/source、消费者同步 | CP-1 MATCHED | old package/name zero residual；startup owner/writer 新值；门全绿 |
| CP-3 | application 层改名 | 同盘整体移动、npm/moduleName/Kotlin/工具/正本同步 | CP-2 MATCHED | AC-2/AC-8 层名闭合、原生生成物与 APK 证据可取 |
| CP-4 | 全批证明与交付前对账 | AC-2/8/9/10/11/13 证据、三维对账、逐代码对账 | CP-3 MATCHED | 三维与逐代码对账均只有 MATCHED；未把 TR-08 写成关闭 |

每个 CP 结束时必须先停在 CP 边界，由 fresh 只读子 agent 按“需求 + 详设/方案 + project-memory”逐条证伪式对账；
任一 OPEN 由主 agent 修复并接受新的 fresh 复查，不能进入下一 CP。全部 CP 完成后、整体测试前另做一次全批三维对账；
交付前再做独立的逐代码与详设对账。本文档没有为后续实施创建任何动态授权。

## 3. 横切机制对照表

本批是结构/构建链批次，以下 N/A 均是有反例边界的结论，不是空白。只要 CP-0 的 StaffLoginForm primitive
被实现为真正的 Web form，仍不引入业务数据、owner command、DB、seed 或后台交互。

| 机制 | ① 现成能力/规范 | ② 如何验证 | ③ 无现成时的形态 | ④ 本批适用全集 |
| --- | --- | --- | --- | --- |
| 读侧节点授权 | N/A：没有业务读模型或 HTTP route | 静态确认变更只触及 package/graph/tool/source layout | 不新增读授权 | skeleton graph、package.json 依赖声明 |
| 写授权与 grant 复核 | N/A：不写业务事实 | 静态确认无 owner command/schema/migration | 不新增 grant | N/A |
| 跨 owner 写与事务 | N/A：无 runtime write | `rg` 与 package diff 无 command/transaction 改动 | 不新增事务 | N/A |
| 集合形态与分页 | N/A：无 collection/API | 逐代码对账将其标 N/A | 不新增集合 | N/A |
| 缓存失效/刷新 | N/A：无业务缓存；仅清理可重建构建缓存 | CP-0 产物盘点、CP-3 构建前删除再生成 | 只能删除本批拥有的可重建目录 | `.expo/.turbo/android build/.gradle/.cxx/dist` |
| RTK 数据读取与加载判定 | N/A：不改 feature/state | 静态 diff 无 RTK import/state change | 不新增 state | N/A |
| 同一事实只有一个住址 | 规范 `project-memory/operations/terminal-coding-standard.md` 的 moduleName/包路径三元组规则 | AC-2、AC-4、AC-8 映射同一文件集合；package name、moduleName、目录三者深相等 | 不能复制 alias；派生值必须由当前包的唯一声明和 graph 读取 | 三个 application 包、integration-assembly、下线包、Kotlin package、workspace globs |
| 失败可见且原因不得改写 | `AGENTS.md` 日志/失败纪律、三道门真实退出码 | 保留 baseline first failure、gate 与原始报文；实现后仍按当前字节读取 | 失败记录必须有 owner 文件和 broken boundary，不用 timeout/截图替代 | CP-0 7 类失败族、AC-9/10 运行失败 |
| owner 错误到 HTTP 映射 | N/A：没有 HTTP owner/problem | 静态清单明确无 `x-consumer-faces` 变化 | 不新增错误码 | N/A |
| owner 审计三件套 | N/A：不写业务审计 | 无 audit table/service/route 变化 | 不新增 audit | N/A |
| 幂等键与重放 | N/A：没有 command/operation | 无 command payload 和 event 变化 | 不新增幂等 | N/A |
| 生成物不得手搓字符串 | `expo-modules-autolinking` 生成 ExpoModulesPackageList；Yarn 4.17 生成 yarn.lock | AC-6 安装、AC-9 每个 App 构建后立即读共享生成物；不手改 generated 文件 | 生成链输入改后重新生成，错误生成物 fail closed | yarn.lock、ExpoModulesPackageList.kt、APK/dex |
| 日志落点与脱敏 | `AGENTS.md` observability standard；现有 `startupDiagnosticsWriter.ts`/LOG_TAG | AC-10 只读结构化 startup.complete、logcat；不记录 token/raw payload | 不新增日志；证据 JSON 只写字段白名单 | owner/writer/source、readiness、secondary testID |
| 迁移回填与可逆性 | N/A：无数据库；AC-1 是文件归档 | archive manifest 的逐文件 sha256 与恢复命令 | 线下移出而非删除；恢复只按 manifest | 四个下线包 |
| 前端共享行为 | N/A：不改页面行为；`PrimitiveForm` 是既有 form 宿主归属修正 | primitives focused + StaffAuth native/Web shape test | primitive 只提供 Web form boundary；feature 不出现 host tag/createElement | `StaffLoginForm`、`PrimitiveForm` |
| 管理后台交互一致性 | N/A：没有新增 screen/control | `UI_DESIGN_REVIEW=NOT_APPLICABLE_WITH_REASON` | 不新增 UI | N/A |
| 候选/下拉数据源 | N/A | 无数据 selector 变化 | 不新增 | N/A |
| 编码与名称呈现 | TR-10 中文 README；AC-11 正本文档逐处分类 | README 人工逐项回读；正本表逐处 MATCHED | 只改指该层的名称，不改“assembly”装配语义 | 五包 README、terminal coding standard、active memory |
| 同时会坏的原子组 | implementation-task-template charter §5-C；本详设 CP file set | 每 CP 文件集合只允许整组提交/整组回滚；门在每 CP 后运行 | 不允许只改 package.json 留旧 import | CP-1 archive+graph+deps+tests+lock；CP-2 package+API+consumer+logs；CP-3 tree+native+tool+docs |

## 3a. UI/testID/L2 前置复核

```text
UI_DESIGN_REVIEW=NOT_APPLICABLE_WITH_REASON：不新增或修改 UI-bearing Journey；StaffLoginForm 只把既有 form host 归属到 primitive，视觉与动作不变
TESTID_REVIEW=NOT_APPLICABLE_WITH_REASON：本批不新增动作控件、不新增 testID、不写 L2 locator
L2_SCRIPT_ADMISSION=BLOCKED
```

没有 IA、交互设计或 L2 控制面新增；后续 AC-10 的 Web/设备配对是 TR-16 的运行验证，不是本批新增 L2。

## 4. 每个 CP 的门控、形态理由与 RECALL

### CP-0：基线与根因修复

#### 4.1 盘点顺序和当前盘点结果

在任何会清理 Vitest cache、`.expo`、`.turbo` 或构建目录的 runner 前，实施者必须先运行：

```sh
# 以下命令均从仓库根执行；不要把本机挂载路径写入证据或脚本。
git ls-files -o -i --exclude-standard
find apps/terminal -type d \( -name node_modules -o -name .turbo -o -name .expo -o -name .runtime -o -name .gradle -o -name .kotlin -o -name .cxx -o -name build -o -name dist \) -print
find apps/terminal -type f -path '*/debug.keystore' -print
find apps/terminal -type f -path '*/debug.keystore' -exec shasum -a 256 {} \;
```

本轮在上述步骤之后只读汇总为：`all=174583` ignored paths；按路径规则 `runtime=50087`、`cache=107757`、
`build=53826`、`keystore=2`（分类可重叠，不相加推导总数）；活跃清单为 3837 行，命令为：

```sh
git ls-files -co --exclude-standard | awk '!/^doc\/(plans|review|handoffs|evidence)\// {print}'
```

关键 targeted ignored roots（字节数；完整路径清单以实施时的命令输出为准，不能人工缩小）如下：

| 路径 | bytes |
| --- | ---: |
| `apps/terminal/.turbo` | 8 |
| `apps/terminal/node_modules` | 7,919,020 |
| `apps/terminal/assembly/android/sample-terminal/.expo` | 55,364 |
| `apps/terminal/assembly/android/sample-terminal/.runtime` | 273,128 |
| `apps/terminal/assembly/android/sample-terminal/android/.gradle` | 57,276 |
| `apps/terminal/assembly/android/sample-terminal/android/.kotlin` | 24 |
| `apps/terminal/assembly/android/sample-terminal/android/.runtime` | 34,948 |
| `apps/terminal/assembly/android/sample-terminal/android/app/.cxx` | 116,132 |
| `apps/terminal/assembly/android/sample-terminal/android/app/build` | 1,888,592 |
| `apps/terminal/assembly/android/sample-wallpaper-terminal/.expo` | 12,760 |
| `apps/terminal/assembly/android/sample-wallpaper-terminal/android/.gradle` | 45,988 |
| `apps/terminal/assembly/android/sample-wallpaper-terminal/android/.kotlin` | 20 |
| `apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/.cxx` | 114,252 |
| `apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/build` | 1,890,928 |
| `apps/terminal/assembly/android/sample-wallpaper-terminal/dist` | 1,512 |
| `apps/terminal/assembly/base/android/android/build` | 14,528 |
| `apps/terminal/adapter/android/device/android/build` | 3,808 |
| `apps/terminal/adapter/android/dual-screen/android/build` | 13,312 |
| `apps/terminal/adapter/android/persist-kv/android/build` | 5,596 |
| `apps/terminal/kernel/base/display-context/node_modules` | 3,016 |
| `apps/terminal/kernel/base/ui-state/node_modules` | 3,016 |

两个 debug keystore 当前 sha256 完全相同：

```text
221e0a3106aa4c3ccc154e0a418b55020b3f9ea6e84f92e8749cd9e2f39f5e58  apps/terminal/assembly/android/sample-terminal/android/app/debug.keystore
221e0a3106aa4c3ccc154e0a418b55020b3f9ea6e84f92e8749cd9e2f39f5e58  apps/terminal/assembly/android/sample-wallpaper-terminal/android/app/debug.keystore
```

当前某些 Vitest cache 路径已被先前受管 runner 清理，不能把“当前不存在”倒推成“从未存在”；实施时必须把本次
盘点输出作为唯一基线，再执行清理。

#### 4.2 当前基线失败清单（已实跑）

| id | 命令/子门 | 首败与证据 | 根因 | CP-0 修法 | 行为影响 |
| --- | --- | --- | --- | --- | --- |
| B-01 | `yarn --cwd apps/terminal test` | `@catering-v2s/kernel-base-transport#test`；`identityClient.test.ts:20:80`、`:60:45`；`invalid topology identity response`；2/23 fail，整批 23/27 successful | `contracts/src/foundations/topologyWire.ts` 的 identity parser 在 `:216-225` 要求 `moduleName`；`TerminalTopologyServer.kt:140` 已发送；fixture `identityClient.test.ts` 的两个 identity object 仍是旧形状 | 两个 response fixture 补精确 `moduleName`，不改 parser/native owner；补 focused assertion 保持现行身份值 | 夹具修正，不改变生产运行语义 |
| B-02 | `node tools/terminal-skeleton/check-static.mjs` | `RULE_GRAPH_COMPARISON=FAIL`；`assembly.android.sample-terminal dependencies mismatch; missing=[] extra=["ui.base.input","ui.base.primitives"]` | graph 漏记已有 `package.json`、`src/dependencies.ts` 与 import 的两条边 | 两个 application App graph node 补 `ui.base.input`、`ui.base.primitives` | graph truth correction，无运行行为变化 |
| B-03 | `node tools/terminal-layering/check-static.mjs` | `P-5d... StaffLoginForm.tsx:13` | feature 直接 `createElement('form')` | `PrimitiveForm` 在 primitives 提供 Web form host；StaffLoginForm 只消费 typed primitive；不把 form 复制到另一个 feature | Web/native 输出必须保持原形；有 focused proof |
| B-04 | `node tools/terminal-readability/check-static.mjs` | TR-R03 1 条、TR-R04 7 条、TR-R05 4 条、TR-R06 2 条 | 既有函数/控制层/目录布局没有符合当前标准 | 按下表逐条最小重构，不顺手重写业务 | 每一条都要求 focused/现有测试和 AC-8 允许差异；产品语义无变更 |
| B-05 | `node tools/terminal-sample2/check-native-projection.test.mjs` | `sample-terminal has an unallowed darkMode difference`，checker `check-native-projection.mjs:346-351` | D-6 已裁定删除 darkMode，但当前两个 App/integration、基座透传和断言仍保留 | 删除四个 tailwind 配置字段、基座参数、两处断言；checker 改为所有 App 禁止 darkMode，并同步红测试 | 当前没有 dark variant/colorScheme consumer，需由 focused scan 证明；若发现 consumer 立即 DEXTER_DECISION |
| B-06 | cache/scaffold inventory | 当前盘点中部分 cache 已不存在；当前四个待下线包各有 `.turbo/turbo-typecheck.log`，另有历史 runner 会清理 `assembly/base/android`、两个 adapter 的 `node_modules` | 受管测试 runner 的可重建 cache，不是 source | 先把盘点清单作为证据，再只删除列明的可重建 cache；四包 `.turbo` 在 CP-0 清理后，CP-1 archive manifest 记录 `ignoredInventoryRef` 和“无隐藏条目” | 不影响 source；清理独立记录 |
| B-07 | `node tools/terminal-contracts/check-static.test.mjs` | `public export exact-set mismatch; missing=[] extra=["TopologyLocalAddress"] actualCount=111` | `contracts/src/index.ts` 已导出 `TopologyLocalAddress`，但 `kernel/base/contracts/terminal-invariants.json` 的 publicExports 快照未同步 | 在 invariants publicExports 补入现有 `TopologyLocalAddress`，保留源码导出与类型使用；重跑 contracts model/static/test | 契约快照同步，不新增运行能力 |
| B-08 | `node tools/terminal-platform-ports/check-static.test.mjs` | `public export exact-set mismatch; missing=[] extra=["DisplayReadiness","DisplaySize","DisplaySurfaceInfo"] actualCount=140` | `platform-ports/src/index.ts` 已导出三项显示事实类型，但 `platform-ports/terminal-invariants.json` 的 publicExports 快照未同步 | 在 platform-ports invariants publicExports 补入现有三项类型，保留源码导出与消费者；重跑 platform-ports model/static/test | 契约快照同步，不新增运行能力 |
| B-09 | `node tools/terminal-display-context/check-static.test.mjs` | `display-context public exports mismatch; missing=[] extra=["DisplayFactsReadModel","DisplayFactsSurface","readDisplayFacts"]` | `display-context/src/index.ts` 已导出三项显示事实 API，但 `display-context/terminal-invariants.json` 的 publicExports 快照未同步 | 在 display-context invariants publicExports 补入现有三项 API，保留源码导出与消费者；重跑 display-context model/static/test | 契约快照同步，不新增运行能力 |
| B-10 | `yarn install --immutable` | `YN0028 The lockfile would have been modified`；两个 application workspace metadata 缺 `ui-base-input`、`ui-base-primitives` | 两个 App 的 package.json 已声明现有 workspace 依赖，但 yarn.lock workspace metadata 未同步 | 先普通 `yarn install`，仅接受两个 App 各两条已声明 workspace dependency hunk；再 `yarn install --immutable` 复验 | 锁文件同步，不新增 external dependency/version |
| B-11 | `node tools/terminal-skeleton/verify.test.mjs` | `AssertionError`；`expectedTaskOwners('test', 2)` 实际包含 `assembly-base-android`、`kernel-base-topology`、`kernel-base-transport`、`ui-base-console-assembly`、`ui-base-feature-assembly`，固定期望分母缺失 | `verify.test.mjs` 的固定 marker 分母落后于当前 skeleton graph 与 package invariants，未覆盖已有测试契约 | 在 `expectedTestPackages` 与 `realTestPackages` 同步补入这 5 个现有包，不改 graph、package 或运行语义 | `node tools/terminal-skeleton/verify.test.mjs` 通过，并保留 marker mismatch/kind mismatch 反例 |

readability 逐条原始 finding：

- TR-R03：`apps/terminal/ui/feature/sample-staff-auth/src/components/StaffLoginForm.tsx:13`，`React createElement`；
- TR-R04：`apps/terminal/kernel/base/topology/src/features/actors/actors.ts:58`、
  `apps/terminal/ui/base/admin-shell/src/foundations/adminFrameRegistry.ts:59,348`、
  `apps/terminal/ui/base/input/src/components/InputScrollArea.tsx:193,207`、
  `apps/terminal/ui/base/input/src/components/InputSurfaceFrame.tsx:753`、
  `apps/terminal/ui/base/input/src/hooks/useInputField.ts:126`；
- TR-R05：`actors.ts:570,576`、`InputSurfaceFrame.tsx:599,666`；
- TR-R06：两个 App 的 `src/controlledKeyboardHarness.tsx:1`。

S-5 要求的 11 个 TR-R04/TR-R05 命中逐处冻结如下；目标形态是实施时的参数对象或小型判定
helper 名，不允许以“重排代码”代替目标。现有测试是行为护栏；新增 focused 测试只补当前测试尚未
锁住的参数/分支边界，不改变业务语义。

| path:line | 目标形态（类型对象/helper） | 已有行为测试 | 需要新增的 focused 测试 |
| --- | --- | --- | --- |
| `kernel/base/topology/src/features/actors/actors.ts:58` | `TopologyFailureInput` + `createTopologyFailure(input)`，把 context/code/message/cause 绑定为具名参数 | `projects typed payload failure diagnostics without changing peer lifecycle facts` | 新增 `topologyFailure` 的 named-input 映射测试，断言 code/message/cause 与现有 error payload 一致 |
| `ui/base/admin-shell/src/foundations/adminFrameRegistry.ts:59` | `AdminFrameFixtureOptions` 参数对象传给 `fixture(options)` | `freezes the 29 production frames plus one cross-tab frame` | 新增 fixture options 缺少可选字段时仍保持默认值的 focused 测试 |
| `ui/base/admin-shell/src/foundations/adminFrameRegistry.ts:348` | `AdminFrameDefinitionInput` 参数对象传给 `definition(input)` | `drives every production fixture through its concrete frame selector` | 新增 definition 的 binding/variants 默认值与显式值 focused 测试 |
| `ui/base/input/src/components/InputScrollArea.tsx:193` | `ScrollReadbackMeasurement` 参数对象传给 `applyMeasurement(input)` | `starts exactly one animated scroll request with the measured keyboard entrance and commits after readback` | 新增同时回读 viewport、content field 与 presentation offset 的 focused 测试，断言仍只计算一次 |
| `ui/base/input/src/components/InputScrollArea.tsx:207` | `ScrollFieldMeasurement` 参数对象传给 `applyMeasurement(input)` | `uses content-local coordinates when a scaled host has a non-zero scroll offset` | 新增缺失任一 measurement 时不发起第二次 scroll、保留 pending 的 focused 测试 |
| `ui/base/input/src/components/InputSurfaceFrame.tsx:753` | `KeyboardLayerRenderInput` 参数对象传给 `layer(input)` | `keeps frozen keyboard layer identities unique across rapid A-to-B-to-A-to-C retargets` | 新增 outgoing/incoming 角色与 layerKey 一一对应的 focused 测试，断言快速切换无重复 key |
| `ui/base/input/src/hooks/useInputField.ts:126` | `FocusRectMeasurement` 参数对象传给 `presentFocusRect(input)` | `measures an ordinary focused field against the unshifted surface root and applies one centered offset` | 新增普通字段与 native-less anchor 走同一 root-local measurement contract 的 focused 测试 |
| `kernel/base/topology/src/features/actors/actors.ts:570` | `PeerCloseResolutionInput` + `resolvePeerClose(input)`，把 event/instanceMode/state facts 分离 | `clears the master pairing fact only after an explicit slave unpair close` | 新增 transient close 与 explicit unpair close 的分支 focused 测试，断言前者保留 identity |
| `kernel/base/topology/src/features/actors/actors.ts:576` | `SlaveUnpairPersistenceInput` + `persistSlaveUnpair(input)` | `clears the slave locator from an explicit master unpair notice` | 新增 persistence 失败时 repair-pending 与三项 fact 保留/清除边界 focused 测试 |
| `ui/base/input/src/components/InputSurfaceFrame.tsx:599` | `PresentationTargetInput` + `targetOffsetFor(input)` | `recomputes the next field from its unshifted root-local position without subtracting the old offset` | 新增饱和/未饱和焦点框目标偏移的 focused 测试，断言 offset 不重复扣减 |
| `ui/base/input/src/components/InputSurfaceFrame.tsx:666` | `PresentationAnimationInput` + `startPresentationAnimation(input)` | `keeps frozen outgoing and incoming snapshots layered and input-blocked during a different-layout handoff` | 新增同一 serial 不因 owner/pending 更新而从 0 重放的 focused 测试 |

TR-R03 与 TR-R06 仍按上面的独立 source/test 集合处理；它们不被这张 11 行表吞并。任何实施中发现
目标形态需要改变业务/Journey、owner 或失败语义，必须先记为 `DEXTER_DECISION`，不能借 readability
重构自行裁定。

CP-0 在 baseline evidence 写完后，才清理当前盘点到的四个待下线包 `.turbo` 目录以及其他被 AC-6 明确标记为可重建的 Vitest/Turbo cache；每个删除目标必须来自 `ignored-roots.txt` 的精确路径，先写 `cleanup-before-cp1.json` 再逐路径清理。不得清理 `node_modules`、`.runtime`、debug.keystore 或任何未在盘点中的路径。CP-1 的四包 archive 是清理后的 source tree；其 JSON 必须含 `ignoredInventoryRef`，并记录清理前路径、清理结果和“archive 前该包无剩余 ignored entry”的检查。

#### 4.3 CP-0 逐条修法与 primitive 接口

**PrimitiveForm 的唯一接口冻结为：**

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

`PrimitiveForm` 的形态是：Web 分支返回唯一的 JSX `<form>`，submit handler 先 `preventDefault()` 再调用可选
`onSubmit`；非 Web/native 分支返回 children fragment，不增加 View、padding、accessibility node 或 layout。
`StaffLoginForm` 保留现有 feature 内组件名和调用位置，只改为渲染 `<PrimitiveForm>{children}</PrimitiveForm>`，不向
feature 暴露 DOM host。这样比在 primitives 中复制 `createElement` 更小，也不需扩大 TR-R03 的 `createElement`
allowlist；P-5d 只扫 feature，primitive 的 DOM boundary 由 `PrimitiveForm` 的 typed API 和 focused test 守护。

CP-0 中新增/修改的精确 source/test 集合：

| 事实 | 文件集合 | proof |
| --- | --- | --- |
| transport fixture | `apps/terminal/kernel/base/transport/test/identityClient.test.ts` | 两个 fixture 含现行 moduleName；transport package test |
| graph closure | `apps/terminal/skeleton-graph.ts` | 两个 application node 的 dependency set 与 package/dependencies/import 三方相等 |
| skeleton marker denominator | `tools/terminal-skeleton/verify.test.mjs` | 五个已有 REAL_TESTS package marker 与 `expectedTaskOwners('test', 2)` 分母一致，并保留 marker mismatch/kind mismatch 反例 |
| form primitive | `ui/base/primitives/src/types/types.ts`、`src/components/PrimitiveForms.tsx`、`src/index.ts`、`test/primitives.test.tsx`、`ui/feature/sample-staff-auth/src/components/StaffLoginForm.tsx`、`test/staffAuth.test.ts` | Web form host、native fragment、preventDefault 三个断言；P-5d/TR-R03 绿 |
| harness layout | 两个 application `src/controlledKeyboardHarness.tsx` → `src/components/controlledKeyboardHarness.tsx`、对应 `App.tsx`、README | source-layout gate、静态 import 与 harness focused gate |
| readability R04 | `actors.ts`、`adminFrameRegistry.ts`、`InputScrollArea.tsx`、`InputSurfaceFrame.tsx`、`useInputField.ts` | 各处将多参数改为职责对象或拆小 helper；现有 test + TR-R04 |
| readability R05 | `actors.ts`、`InputSurfaceFrame.tsx` | 提前返回/提取判定 helper，保持失败与恢复分支；现有 test + TR-R05 |
| darkMode | 两个 App 和两个 integration 的 `tailwind.config.cjs`、`assembly/base/android/config/index.cjs`、`keyboardThemeConfig.test.ts`、`sample-console/test/theme.test.ts`、`tools/terminal-sample2/check-native-projection.mjs` 与对应 test | runtime/config/业务测试 corpus 无 `darkMode`；native projection checker/test 的判红 token 只在两个明确允许位置存在并进入 AC-11；checker 绿；UI 不出现暗色变体 |

**CP-0 各门：**

```sh
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
node tools/terminal-readability/check-static.test.mjs
node tools/terminal-readability/check-static.mjs
node tools/terminal-sample2/check-native-projection.test.mjs
node tools/terminal-sample2/check-production-bundle.test.mjs
node tools/terminal-image-compare/test/compare.test.mjs
node scripts/test/ter-virtual-keyboard-android.test.mjs
scripts/memory/build-index --check
scripts/check/project-memory
```

CP-0 的失败条件是任一命令非零，或任一 baseline row 没有 owning source/修法/测试；完成后期待所有 gate 输出
`PASS`/exit 0。CP-0 不改 `package.json` workspace 名；当前基线已确认两个 App 的既有
`ui-base-input`/`ui-base-primitives` workspace 依赖未写入锁文件，因此 B-10 允许且仅允许由普通安装生成
两个 App 各两条 workspace metadata hunk。除这四条已声明 workspace 依赖外，任何 external locator、版本、
workspace identity 或未登记 key 变化都必须停止并记录，不得手改 lock；随后以 `yarn install --immutable`
复验。

### CP-1：下线、合并与 graph closure

#### 4.4 当前完整 package file set

以下是当前 bytes 的四个 source package 全集（不含 ignored cache）：

```text
ui/base/automation:
  package.json src/dependencies.ts src/index.ts src/moduleName.ts terminal-invariants.json tsconfig.json
kernel/base/workflow:
  package.json src/dependencies.ts src/index.ts src/moduleName.ts terminal-invariants.json tsconfig.json
kernel/base/test-support:
  package.json src/dependencies.ts src/index.ts src/moduleName.ts terminal-invariants.json tsconfig.json
ui/base/test-support:
  README.md package.json src/dependencies.ts src/index.ts src/moduleName.ts src/types/platformTypes.ts terminal-invariants.json tsconfig.json
```

CP-1 active consumer/rewrite set is fixed, not “search until it compiles”：

- `apps/terminal/skeleton-graph.ts`：删除四节点；删除 `ui.base.primitives` → `ui.base.automation`；三个 UI feature
  的 dev edge 改为 `kernel.base.platform-ports`；node count and fixture count follow actual graph.
- `apps/terminal/ui/base/primitives/package.json`、README、`src/dependencies.ts`、`src/index.ts`：删除
  legacy `plannedDependencies` mechanism and automation claim, but retain TR-08 future hook prose/token.
- `apps/terminal/ui/feature/sample-member-desk/package.json`、`src/dependencies.ts`、
  `test/memberDesk.test.tsx`；`sample-staff-auth` 同三处；`sample-wallpaper-picker` 的 package、dependencies
  及 `test/pickerSystemFailure.test.ts`、`test/sampleWallpaperPicker.test.tsx`：五个 platform type imports 改直接 root import。
- `tools/terminal-skeleton/check-static.mjs`、`tools/terminal-skeleton/check-static.test.mjs`：node count、
  graph fixture、test-support/automation fixtures 全部同步；不保留已删除的 `plannedDependencies` checker
  branch，依赖比较直接读取 manifest 的 `dependencies`。
- `tools/terminal-ui-state/check-static.mjs`、`tools/terminal-ui-state/check-static.test.mjs`：不再用相邻
  `kernel.base.test-support` 节点截取 ui-state；夹具换到稳定 package boundary。
- `tools/terminal-sample2/check-production-bundle.mjs` 与其 test：保留 automation token 的两种写法和红夹具，
  不把 TR-08 token 当成活跃 package。
- 既有 `yarn.lock` 只由锁文件生成链更新；CP-1/2/3 先用普通 `yarn install` 生成，再用允许差异表比对，最后以 `yarn install --immutable` 验证；不手改 generated locator。

**下线顺序与 archive：**先收集四包 manifest，再把每个 source directory 移到同盘仓外持久根。命令从仓库根执行，归档根固定表述为仓库同级的 `../.ter-package-layout-cleanup-archive/`，不写本机绝对路径：

```text
../.ter-package-layout-cleanup-archive/
  2026-09-25/<package-slug>-<source-tree-sha8>/
```

每包归档记录在后续实施 evidence：
`doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/offline/<package-slug>.json`。
JSON 固定字段：`schemaVersion`, `sourceRoot`, `archiveRoot`, `movedAt`, `fileCount`, `byteCount`,
`ignoredInventoryRef`, `ignoredEntriesBeforeCleanup`, `ignoredEntriesAtArchive`, `files:[{sourceRelativePath,archiveRelativePath,bytes,sha256}]`, `restoreCommand`, `platformPortsTypeSource`（仅 test-support）。
恢复命令必须是显式的 `mkdir -p` + 按记录逐文件 `mv`/复制回源路径并重新执行 sha256 compare；禁止 `/tmp`、模糊 glob、
仓根递归删除或碰触四包以外目录。

CP-1 期待 lock diff：四个 workspace locator、四个包名和相关 workspace dependency 记录消失；不增加 external
version，不改 platform-ports 的 production export。由于 `yarn install --immutable` 在 lockfile 需要变化时会直接失败，CP-1/2/3 采用“生成—校验”两阶段：先用普通 `yarn install` 生成该 CP 的锁文件，再用 `diff -u` 对照该步允许差异，最后用 `yarn install --immutable` 验证生成后的 lock 已冻结；普通安装不得成为未审查的放宽。

CP-1 安装命令：

```sh
yarn install
yarn install --immutable
yarn --cwd apps/terminal typecheck
yarn --cwd apps/terminal test
yarn --cwd apps/terminal verify:static
```

三道门以及 §4.3 的全部子门必须为 0；AC-1 archive manifest 与现有 source bytes 匹配；AC-5 五类型 root import
和 platform-ports production index 字节不变。任何 feature 仍 import `ui-base-test-support`，或 graph 仍包含四节点，
立即判 CP-1 OPEN。

### CP-2：console-assembly → integration-assembly

#### 4.5 完整文件集与符号映射

当前 `apps/terminal/ui/base/console-assembly` 的完整受控文件集为：

```text
README.md package.json src/dependencies.ts src/foundations/consoleAssembly.tsx
src/foundations/startupDiagnosticsWriter.ts src/foundations/startupReady.ts src/foundations/stateSyncSlices.ts
src/foundations/terminalSurfaces.ts src/index.ts src/moduleName.ts terminal-invariants.json
test/partSelection.test.ts test/runtimeOwner.test.ts test/startupDiagnosticsWriter.test.ts test/startupReady.test.ts
test/stateSyncSlices.test.ts test/terminalSurfaces.test.ts tsconfig.json vitest.config.ts
```

实现时整个目录同盘移为 `apps/terminal/ui/base/integration-assembly/`，并在同一原子组内更新：

- package name `@catering-v2s/ui-base-integration-assembly`、moduleName `ui.base.integration-assembly`；
- `consoleAssembly.tsx` → `integrationAssembly.tsx`；所有导出/内部 symbol：
  `createConsoleAssembly`→`createIntegrationAssembly`、`ConsoleAssembly`→`IntegrationAssembly`、
  `ConsoleAssemblyInput`→`IntegrationAssemblyInput`、`ConsoleSurfaceCreationInput`→`IntegrationSurfaceCreationInput`、
  `ConsoleSurfaceDeclarations`→`IntegrationSurfaceDeclarations`、`ConsoleDefinedPart`、`ConsoleRuntimeBundle`、
  `ConsoleRuntimeSubscription`、`ConsoleSurfaceInputFrame` 及 Props 的同义替换；
- 两个 integration 的 package.json、dependencies、assembly source、application source、test-expo、tests、README、
  terminal-invariants 的 package/module/public symbol 与 import；
- `startupDiagnosticsWriter.ts`、`startupReady.ts`、`integrationAssembly.tsx` 中 owner/writer/source/error prefix/log message；
- `tools/terminal-sample2/check-startup-diagnostics.mjs`、`check-behavior.mjs`、相关测试；
- integration 自有 `WallpaperConsoleAssembly`、`createSampleWallpaperConsoleAssembly`、`sample-console` 不改。

CP-2 lock diff 只允许 workspace package locator/name 从 console → integration；无 external dependency version change。
每步安装先保存 `yarn.lock`，运行普通 `yarn install`，将 `diff -u` 输出与 CP-2 allowed lock diff 比对，再运行 `yarn install --immutable`；门同 CP-1。AC-7 通过条件是两个 integration 的 startup JSON `data.client.owner`
和 `data.writer` 都等于 `ui.base.integration-assembly`；把任一 writer 变异回旧值时 checker/test 必须以明确前缀判红。

### CP-3：assembly 层 → application 层

#### 4.6 整体移动和完整 file-set 规则

移动不是只移动受控文件。实施时先对 `apps/terminal/assembly/` 运行 `find`/sha256 manifest，然后在同一盘使用
目录级 `mv`，所以以下被忽略项与源一起迁移：两个 App 的 `android/app/debug.keystore`、`.runtime/`、`.expo/`、
`.turbo/`、Gradle/Kotlin/CXX/build/dist。移动后、构建前只删除新目录下可重建项：`.expo/`、`.turbo/`、
`android/.gradle/`、`.kotlin/`、`app/.cxx/`、`app/build/`、`android/build/`、`dist/`；不得删除 debug.keystore 或
`.runtime/` 运行证据。完整 file set 由以下命令生成并与 AC-8 snapshot 深相等，不能用手写 glob 代替：

```sh
find apps/terminal/assembly -type d -print | sort
find apps/terminal/assembly -type f -print0 | sort -z | xargs -0 shasum -a 256
find apps/terminal/assembly -type f -path '*/debug.keystore' -exec shasum -a 256 {} \;
find apps/terminal/assembly -type d -name .runtime -print
```

**应用层 package/file set：**两个 App 的全部文件按上面 manifest 迁移；需要内容审查的文本锚点集合是：

- `package.json`、`src/moduleName.ts`、`src/dependencies.ts`、`terminal-invariants.json`、README、`App.tsx`；
- `babel.config.cjs`、`metro.config.js`、`tailwind.config.cjs`、`tsconfig.json`、`global.d.ts`、`nativewind-env.d.ts`；
- `src/assembly/platformPorts.ts`（目录名保留，装配语义不变）；
- `apps/terminal/assembly/base/android/package.json`、`config/index.cjs`、`expo-module.config.json`、
  `src/components/AndroidTerminalApp.tsx`、所有 `src/foundations`、6 个 Kotlin source + 1 个 Kotlin test、
  `android/build.gradle`、基座 tests/README/invariants；
- 两个 App Android `MainActivity.kt`/`MainApplication.kt`、Gradle settings/build/proguard/manifest、资产与 iOS 工程。

替换规则：目录层 `apps/terminal/assembly`→`application`；三个 package name `assembly-`→`application-`；三个
moduleName `assembly.`→`application.`；`LogScope.layer` 的值 `'assembly'`→`'application'`；错误前缀
`[assembly-base-android]`→`[application-base-android]`；loading 默认 testID `assembly.base.android:loading`→
`application.base.android:loading`；Kotlin package 全名与目录同改；`verify.mjs` 的 `assembly-export*` 阶段改为
`application-export*`。Android applicationId、持久化 key、`LOG_TAG`、`src/assembly/`、`createAssembly`、
`assembly-rejection`、`sample.assembly-created` 保留。

必须同时改的外部活跃文件：根 `package.json` 的两个 workspace glob；`skeleton-graph.ts` application/base nodes；
`tools/terminal-layering/check-static.mjs`、`tools/terminal-skeleton/check-static.mjs`、`verify.mjs`、
`check-native-projection.mjs`、`check-startup-diagnostics.mjs`、`check-behavior.mjs`、`run-a9-runtime.mjs`、
`run-u8-release-cold-start.mjs`、两个 frozen journey runner、`scripts/test/ter-virtual-keyboard-android.mjs`及 test、
`tools/terminal-topology/run-dual-device.mjs`、`tools/terminal-android-dual-screen/check-behavior.mjs`、
`tools/terminal-image-compare/test/compare.test.mjs` 中确指 application 层的旧路径/包名。每一处通过 AC-11 分类，
不能用 `assembly` 全局替换。

`tools/terminal-skeleton/check-static.mjs` 中 “assembly package self-edge” 是 `graph-model.mjs` 已先行拒绝的死规则，
CP-3 删除该规则及其专属测试；这是明确允许差异，不是遗漏。

CP-3 lock diff 只允许 workspace application locators、package/module names、相应 workspace dependency key 更新；
不允许 external version、applicationId、keystore、runtime data 或生成文件被手改。每步先普通 `yarn install` 生成并比对 lock diff，再 `yarn install --immutable` 验证，最后运行三道门及全部子门。

### CP-4：收尾证明

CP-4 不再改业务代码；它只生成后续实施证据和对账记录。任何 proof 失败都回到其 owning CP，不以截图或旧证据冒充。

## 5. operation/path/face/集合形态

本批不新增后端 operation、HTTP path、consumer face、数据库集合或分页。按模板显式冻结：

| 业务意图 | operationId | method/path | consumer face | 集合形态 | 结论 |
| --- | --- | --- | --- | --- | --- |
| TER 包布局迁移 | N/A | N/A | N/A | N/A | 无业务 API；只改 workspace/source/build identity |

## 6. 声明—传递—消费矩阵

| fact | declaration | transfer | consumption | proof |
| --- | --- | --- | --- | --- |
| application package identity | `src/moduleName.ts`、package.json name、skeleton graph node | package graph、Yarn workspace、Expo autolinking | App package、Kotlin module、startup scope、工具 | AC-2/4/9；sha256 snapshot |
| integration-assembly identity | integration-assembly package.json/moduleName/index | 两 integration dependency/import、startup writer | startup.complete owner/writer/source | AC-7/10 |
| offline package status | archive manifest + source directory absence | package graph/lock/checker | no runtime consumer；可按 restoreCommand 恢复 | AC-1/4/8 |
| five platform types | `kernel/base/platform-ports/src/index.ts` 已有 root exports | 三 feature `devDependencies`、`src/dependencies.ts`、type imports | feature tests only | AC-5 + platform-ports index byte compare |
| darkMode absence | four tailwind configs + base config no field | runtime/config/业务测试 corpus 零命中；checker/test 的 guard token 逐处分类 | no TER consumer; no dark variant; guard remains diagnosable | `darkMode` residual report + native projection |
| startup readiness | `startupDiagnosticsWriter.ts` / readiness source | logger/logcat/JSON evidence | Web and two App rows | AC-10 |
| allowed difference | AC-11 classification table | AC-8 `allowedDiffRef` | snapshot compare and review | AC-8 |

## 7. 业务规则 → owner 判定点

本批无业务规则。结构规则的 owner 判定如下：

| 规则 | 判定点 |
| --- | --- |
| package/path/moduleName 三元组相等 | graph-model + package metadata + AC-2/4 |
| 下线包无仓内节点/引用 | skeleton graph、AC-2、lock |
| platform-ports 是五类型唯一生产导出住址 | platform-ports index byte compare + AST imports |
| application 原生全名一致 | expo-module.config、Kotlin source、generated list、APK dex |
| 没有夹带改动 | AC-8 file set + allowedDiffRef |
| Web 在设备前且同源 | AC-10 paired rows/sourceDigest |
| TR-08 未关闭 | AC-13 textual disposition |

## 8. owner API 与消费者清单

本批不新增 owner API；现有 API 只改声明名称或 import 的集合如下：

| owner/export | 消费者 |
| --- | --- |
| `PrimitiveForm`（CP-0 新增 primitive） | `sample-staff-auth/src/components/StaffLoginForm.tsx`；primitives focused test |
| `LogEvent`, `LogWriteInput`, `LogWriteResult`, `LoggerPort`, `NativeLoadingCapability` | `sample-member-desk`、`sample-staff-auth`、`sample-wallpaper-picker` tests，直接来自 platform-ports |
| `createIntegrationAssembly` 及 integration 类型 | `ui/integration/sample-console`、`sample-wallpaper-console` 的 source、test-expo、tests |
| `createSampleConsoleAssembly` / `createSampleWallpaperConsoleAssembly` | 各自 integration 的 App/test consumers；名字属于 integration 自有 API，不改 |
| `AndroidTerminalApp` / native loading/topology ports | 两 application App 与 platformPorts |

没有消费者的四个 package export 不作为 owner API 保留；其字节由 AC-1 archive 记录，不在仓内留下 alias。

## 9. owner/API 之外的正本同步

### 9.1 活跃正本与记忆分类原则

`assembly` 出现必须逐处分类，而非文件级放行。详见 §9.2a 的逐行 manifest；§9.2a 覆盖当前正控制的 50 个标识符命中及正本/规范散文的全部 active 命中，AC-8 直接引用同一张表：

| 文件/锚点 | 分类 | 处置 |
| --- | --- | --- |
| `doc/platform/terminal-coding-standard.md` TR-16/TR-17 中指 application 层的文字 | 层 | 改为 application |
| `doc/platform/terminal-coding-standard.md` §7.1 `src/assembly/` 词表 | 装配目录 | 保留；这是 Codex v4 已复核的第 974 行含义 |
| `AGENTS.md`、`CLAUDE.md`、`doc/platform/implementation-task-template.md` 中指 TER application 层的说明 | 层 | 改 application |
| `.agents/skills/cs-managed-runtime-execution/SKILL.md`、`cs-spec-to-plan/SKILL.md`、`cs-writing-plans/SKILL.md` | 按上下文 | 层名改；assembly callback/装配语义保留 |
| `project-memory/decisions/terminal-architecture-and-stack-rulings.md`、`operations/terminal-coding-standard.md`、`practices/ter-input-and-virtual-keyboard-usage.md` | active memory 当前结构/规范 | 直接把描述当前层名、TR-16/TR-17 现状的正文改为 `application`；不以追加条目掩盖当前正文，也不抹除历史事实 |
| `project-memory/decisions/terminal-build-order-and-batches.md` | active memory 批次历史 | 只追加带日期的“v5 取代旧 build order 中相关层名/下线包口径”条目；不回写既有批次历史 |
| `doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md` 等 active decisions | 按每处语义 | 只有指 application 层的改名；`createAssembly`/assembly action 保留 |
| `doc/plans/**`、`doc/review/**`、`doc/handoffs/**`、`doc/evidence/**` 历史记录 | 历史 | 不改写；AC-12 |

记忆同步不是本轮执行，但 implementation plan 必须把它作为 CP-4 的 active source 变更。三份当前结构/规范文件按上表直接改写；build-order 只追加日期取代条目。`project-memory/required-inventory.json` 中的 TR-16 anchor 随标题**手工同步**，因为 `tools/project-memory/cli.mjs:113-115` 只逐字核对 anchor，不生成它。随后运行
`scripts/memory/build-index` 生成 `project-memory/index.md`/index 数据，再运行
`scripts/memory/build-index --check`、`scripts/check/project-memory`，并用
`scripts/memory/query` 证明新结论优先返回。`project-memory/index.md` 不能手写成规则 anchor。

### 9.2 AC-2 活跃清单、命中数与逐处分类

实施时以如下函数生成同一个文件清单，AC-2 与 AC-8/AC-11 共用其排序结果：

```sh
active_files() {
  git ls-files -co --exclude-standard |
    awk '!/^doc\/(plans|review|handoffs|evidence)\// {print}'
}
EVIDENCE_DIR=doc/evidence/platform/2026-09-25-ter-package-layout-cleanup/cp-4
mkdir -p "$EVIDENCE_DIR"
active_files > "$EVIDENCE_DIR/active-files.txt"
```

本轮正控制（当前字节、排除历史目录和 node_modules）为：`apps/terminal/assembly=45`、
`@catering-v2s/assembly-=41`、`assembly-base-android=31`、`console-assembly=50`；CP-0 修复前的历史正控制另记录
`plannedDependencies=5`，该数字不属于当前 corpus，当前 active 命中必须为零且实现中不得再有该 mechanism；
`ui-base-automation=7`、`kernel-base-workflow=5`、`kernel-base-test-support=4`、`ui-base-test-support=18`、
`assembly\.(android|base)\.`=28、`\bassembly[A-Z]\w*`=46、`assembly-(?:export|root)`=9、`darkMode`=12。
实施证据必须用同一命令重算，文档数字不是免检快照。

模式及失效判据：

1. 固定字面量用 `rg -n -F`；PCRE 用 `rg -n -P`；每个模式先对改前 active list 做正控制；
2. 删除任意一个 active scan input file，控制器必须报告 file-set mismatch；
3. 把一个已改 identifier 改回 `assemblyRoot`/`assemblyDirectory`，PCRE 必须报 path/line/rule；
4. 反控制必须证明 `src/assembly/`、装配变量 `assembly`、`createAssembly`、`assembly-rejection`、
   integration 自有 `WallpaperConsoleAssembly` 没被层名扫描误报；
5. `ui.base.automation`/`@catering-v2s/ui-base-automation` 在代码 active corpus 只允许 TR-08 checker/fixture，
   若 checker 以外还有命中，CP-1 OPEN。
6. `darkMode` 的零残留扫描只针对 runtime/config/业务测试 corpus；`tools/terminal-sample2/check-native-projection.mjs`
   及其 `check-native-projection.test.mjs` 的 guard/fixture token 是 AC-11 明确允许的两个位置，必须分别记录 path、anchor、token、用途，不能被“零命中”规则误报为 residual。

7. D-2 的旧 console symbol 也必须有独立的 active scan：以旧包导出/内部 symbol 清单生成
   `\b(createConsoleAssembly|ConsoleAssembly|ConsoleAssemblyInput|ConsoleSurface\w*|ConsoleDefinedPart|ConsoleRuntime\w*|consoleAssembly)\b`，命中必须逐处归类；
   `WallpaperConsoleAssembly` 与 `createSampleWallpaperConsoleAssembly` 作为反向控制必须保持合法且不被该禁用集误报。
8. 代码、配置与工具中的层名边界使用 PCRE ``['"`]assembly['"`.\-]`` 逐处扫描；只允许 readability 白名单、`assembly-rejection` 和 AC-11 明确登记的装配语义命中。

`\bassembly[A-Z]\w*` 的逐处 manifest 至少列当前正控制命中的 12 个 token 家族：
`assemblyAdapterDependencyViolation`、`assemblyBaseAndroid`、`assemblyBaseFile`、`assemblyBaseGraphPattern`、
`assemblyBaseIndexPath`、`assemblyBasePackagePath`、`assemblyDirectory`、`assemblyModule`、`assemblyModuleName`、
`assemblyModuleNames`、`assemblyPromises`、`assemblyRoot`。每行字段是 `path,anchor,token,class,action,allowedDiffRef`；
class 只能是 `LAYER_RENAME` 或 `ASSEMBLY_SEMANTIC_KEEP`。AC-8 允许差异表直接引用这张表。

#### 9.2a 当前正控制命中的逐行表

以下表是本轮从当前 active file list 机械重算后的完整分母：代码/工具标识符 50 行命中，加上 active
正本、规范、skill、memory 散文的 30 行命中，再加上 `apps/terminal/**/README.md` 的 84 行命中，共 164 行。
表中没有把同一行的两个 token 合并；因此每个 token 都有
独立的 `path:line` 记录。实施后必须用同一命令重算并逐行更新，不得把“约 46 处”当作分母。`allowedDiffRef`
必须指向 AC-8 同名表项；`ASSEMBLY_SEMANTIC_KEEP` 只能保留装配语义，不能保留旧顶层层名。

| path:line | token | class | action | reason | allowedDiffRef |
| --- | --- | --- | --- | --- | --- |
| `apps/terminal/assembly/android/sample-terminal/src/dependencies.ts:1` | `assemblyBaseAndroid` | `LAYER_RENAME` | 改为 application base 标识 | 顶层 application 消费者 | `AC-8-CP3-app-deps-1` |
| `apps/terminal/assembly/android/sample-terminal/src/dependencies.ts:8` | `assemblyBaseAndroid` | `LAYER_RENAME` | 改为 application base 标识 | 同上 | `AC-8-CP3-app-deps-2` |
| `apps/terminal/assembly/android/sample-wallpaper-terminal/src/dependencies.ts:1` | `assemblyBaseAndroid` | `LAYER_RENAME` | 改为 application base 标识 | 顶层 application 消费者 | `AC-8-CP3-app-deps-3` |
| `apps/terminal/assembly/android/sample-wallpaper-terminal/src/dependencies.ts:8` | `assemblyBaseAndroid` | `LAYER_RENAME` | 改为 application base 标识 | 同上 | `AC-8-CP3-app-deps-4` |
| `apps/terminal/assembly/base/android/src/components/AndroidTerminalApp.tsx:23` | `assemblyPromises` | `ASSEMBLY_SEMANTIC_KEEP` | 保留 | assembly promise 是装配输入语义 | `AC-11-assembly-semantic-1` |
| `apps/terminal/assembly/base/android/src/components/AndroidTerminalApp.tsx:44` | `assemblyPromises` | `ASSEMBLY_SEMANTIC_KEEP` | 保留 | 同上 | `AC-11-assembly-semantic-2` |
| `apps/terminal/assembly/base/android/src/components/AndroidTerminalApp.tsx:45` | `assemblyPromises` | `ASSEMBLY_SEMANTIC_KEEP` | 保留 | 同上 | `AC-11-assembly-semantic-3` |
| `apps/terminal/ui/integration/sample-console/test/testExpoApp.test.tsx:51` | `assemblyModule` | `ASSEMBLY_SEMANTIC_KEEP` | 保留 | integration 测试中的装配 module 语义 | `AC-11-assembly-semantic-4` |
| `apps/terminal/ui/integration/sample-console/test/testExpoApp.test.tsx:52` | `assemblyModule` | `ASSEMBLY_SEMANTIC_KEEP` | 保留 | 同上 | `AC-11-assembly-semantic-5` |
| `tools/terminal-layering/check-static.test.mjs:294` | `assemblyBaseFile` | `LAYER_RENAME` | 改为 application fixture | layering fixture 指顶层层名 | `AC-8-CP3-layer-test-1` |
| `tools/terminal-layering/check-static.test.mjs:314` | `assemblyBaseFile` | `LAYER_RENAME` | 改为 application fixture | 同上 | `AC-8-CP3-layer-test-2` |
| `tools/terminal-layering/check-static.test.mjs:322` | `assemblyBaseFile` | `LAYER_RENAME` | 改为 application fixture | 同上 | `AC-8-CP3-layer-test-3` |
| `tools/terminal-sample2/run-a9-runtime.mjs:7` | `assemblyRoot` | `LAYER_RENAME` | 改为 applicationRoot | runner 目标目录 | `AC-8-CP3-runner-1` |
| `tools/terminal-sample2/run-a9-runtime.mjs:77` | `assemblyRoot` | `LAYER_RENAME` | 改为 applicationRoot | 同上 | `AC-8-CP3-runner-2` |
| `tools/terminal-sample2/run-a9-runtime.mjs:108` | `assemblyRoot` | `LAYER_RENAME` | 改为 applicationRoot | 同上 | `AC-8-CP3-runner-3` |
| `tools/terminal-sample2/run-u8-release-cold-start.mjs:18` | `assemblyRoot` | `LAYER_RENAME` | 改为 applicationRoot | runner 目标目录 | `AC-8-CP3-runner-4` |
| `tools/terminal-sample2/run-u8-release-cold-start.mjs:25` | `assemblyRoot` | `LAYER_RENAME` | 改为 applicationRoot | 同上 | `AC-8-CP3-runner-5` |
| `tools/terminal-sample2/run-u8-release-cold-start.mjs:513` | `assemblyRoot` | `LAYER_RENAME` | 改为 applicationRoot | 同上 | `AC-8-CP3-runner-6` |
| `tools/terminal-skeleton/check-static.mjs:504` | `assemblyModuleNames` | `LAYER_RENAME` | 改为 applicationModuleNames | application graph vocabulary | `AC-8-CP3-skeleton-1` |
| `tools/terminal-skeleton/check-static.mjs:510` | `assemblyModuleNames` | `LAYER_RENAME` | 改为 applicationModuleNames | 同上 | `AC-8-CP3-skeleton-2` |
| `tools/terminal-skeleton/check-static.mjs:513` | `assemblyModuleName` | `LAYER_RENAME` | 改为 applicationModuleName | 同上 | `AC-8-CP3-skeleton-3` |
| `tools/terminal-skeleton/check-static.mjs:513` | `assemblyModuleNames` | `LAYER_RENAME` | 改为 applicationModuleNames | 同行第二个 token | `AC-8-CP3-skeleton-4` |
| `tools/terminal-skeleton/check-static.mjs:514` | `assemblyDirectory` | `LAYER_RENAME` | 改为 applicationDirectory | workspace layer path | `AC-8-CP3-skeleton-5` |
| `tools/terminal-skeleton/check-static.mjs:514` | `assemblyModuleName` | `LAYER_RENAME` | 改为 applicationModuleName | 同行第二个 token | `AC-8-CP3-skeleton-6` |
| `tools/terminal-skeleton/check-static.mjs:515` | `assemblyDirectory` | `LAYER_RENAME` | 改为 applicationDirectory | workspace layer path | `AC-8-CP3-skeleton-7` |
| `tools/terminal-skeleton/check-static.mjs:515` | `assemblyModuleName` | `LAYER_RENAME` | 改为 applicationModuleName | 同行第二个 token | `AC-8-CP3-skeleton-8` |
| `tools/terminal-skeleton/check-static.mjs:516` | `assemblyDirectory` | `LAYER_RENAME` | 改为 applicationDirectory | workspace layer path | `AC-8-CP3-skeleton-9` |
| `tools/terminal-skeleton/check-static.mjs:516` | `assemblyModuleName` | `LAYER_RENAME` | 改为 applicationModuleName | 同行第二个 token | `AC-8-CP3-skeleton-10` |
| `tools/terminal-skeleton/check-static.mjs:518` | `assemblyDirectory` | `LAYER_RENAME` | 改为 applicationDirectory | workspace layer path | `AC-8-CP3-skeleton-11` |
| `tools/terminal-skeleton/check-static.mjs:520` | `assemblyModuleName` | `LAYER_RENAME` | 改为 applicationModuleName | application module identity | `AC-8-CP3-skeleton-12` |
| `tools/terminal-skeleton/check-static.mjs:523` | `assemblyModuleName` | `LAYER_RENAME` | 改为 applicationModuleName | 同上 | `AC-8-CP3-skeleton-13` |
| `tools/terminal-skeleton/check-static.mjs:524` | `assemblyModuleName` | `LAYER_RENAME` | 改为 applicationModuleName | 同上 | `AC-8-CP3-skeleton-14` |
| `tools/terminal-skeleton/check-static.mjs:528` | `assemblyModuleName` | `LAYER_RENAME` | 改为 applicationModuleName | 同上 | `AC-8-CP3-skeleton-15` |
| `tools/terminal-skeleton/check-static.mjs:531` | `assemblyModuleName` | `LAYER_RENAME` | 改为 applicationModuleName | 同上 | `AC-8-CP3-skeleton-16` |
| `tools/terminal-skeleton/check-static.mjs:536` | `assemblyModuleName` | `LAYER_RENAME` | 改为 applicationModuleName | 同上 | `AC-8-CP3-skeleton-17` |
| `tools/terminal-skeleton/check-static.mjs:693` | `assemblyAdapterDependencyViolation` | `LAYER_RENAME` | 改为 applicationAdapterDependencyViolation | 反向依赖诊断标识指顶层层名 | `AC-8-CP3-skeleton-18` |
| `tools/terminal-skeleton/check-static.mjs:705` | `assemblyAdapterDependencyViolation` | `LAYER_RENAME` | 改为 applicationAdapterDependencyViolation | 同上 | `AC-8-CP3-skeleton-19` |
| `tools/terminal-skeleton/check-static.test.mjs:310` | `assemblyBasePackagePath` | `LAYER_RENAME` | 改为 applicationBasePackagePath | graph fixture path | `AC-8-CP3-skeleton-test-1` |
| `tools/terminal-skeleton/check-static.test.mjs:314` | `assemblyBaseIndexPath` | `LAYER_RENAME` | 改为 applicationBaseIndexPath | graph fixture path | `AC-8-CP3-skeleton-test-2` |
| `tools/terminal-skeleton/check-static.test.mjs:318` | `assemblyBaseGraphPattern` | `LAYER_RENAME` | 改为 applicationBaseGraphPattern | graph fixture pattern | `AC-8-CP3-skeleton-test-3` |
| `tools/terminal-skeleton/check-static.test.mjs:323` | `assemblyBasePackagePath` | `LAYER_RENAME` | 改为 applicationBasePackagePath | graph fixture path | `AC-8-CP3-skeleton-test-4` |
| `tools/terminal-skeleton/check-static.test.mjs:331` | `assemblyBaseIndexPath` | `LAYER_RENAME` | 改为 applicationBaseIndexPath | graph fixture path | `AC-8-CP3-skeleton-test-5` |
| `tools/terminal-skeleton/check-static.test.mjs:337` | `assemblyBaseGraphPattern` | `LAYER_RENAME` | 改为 applicationBaseGraphPattern | graph fixture pattern | `AC-8-CP3-skeleton-test-6` |
| `tools/terminal-skeleton/check-static.test.mjs:339` | `assemblyBaseGraphPattern` | `LAYER_RENAME` | 改为 applicationBaseGraphPattern | 同上 | `AC-8-CP3-skeleton-test-7` |
| `tools/terminal-skeleton/verify.mjs:261` | `assemblyDirectory` | `LAYER_RENAME` | 改为 applicationDirectory | verify target path | `AC-8-CP3-verify-1` |
| `tools/terminal-skeleton/verify.mjs:262` | `assemblyDirectory` | `LAYER_RENAME` | 改为 applicationDirectory | 同上 | `AC-8-CP3-verify-2` |
| `tools/terminal-skeleton/verify.mjs:290` | `assemblyDirectory` | `LAYER_RENAME` | 改为 applicationDirectory | 同上 | `AC-8-CP3-verify-3` |
| `tools/terminal-skeleton/verify.mjs:291` | `assemblyDirectory` | `LAYER_RENAME` | 改为 applicationDirectory | 同上 | `AC-8-CP3-verify-4` |
| `tools/terminal-skeleton/verify.mjs:303` | `assemblyDirectory` | `LAYER_RENAME` | 改为 applicationDirectory | 同上 | `AC-8-CP3-verify-5` |
| `tools/terminal-skeleton/verify.mjs:307` | `assemblyDirectory` | `LAYER_RENAME` | 改为 applicationDirectory | 同上 | `AC-8-CP3-verify-6` |

正本/规范散文的全部 active 命中也逐处登记；历史 build-order 的三处只在实施时追加取代条目，不能回写原文。

| path:line | token | class | action | reason | allowedDiffRef |
| --- | --- | --- | --- | --- | --- |
| `doc/platform/terminal-coding-standard.md:556` | `assembly` | `ASSEMBLY_SEMANTIC_KEEP` | 保留 | 未过滤装配输入定义 | `AC-11-prose-1` |
| `doc/platform/terminal-coding-standard.md:631` | `console-assembly` | `LAYER_RENAME` | 改为 integration-assembly | 当前包路径 | `AC-8-CP2-prose-1` |
| `doc/platform/terminal-coding-standard.md:632` | `assembly→render` | `ASSEMBLY_SEMANTIC_KEEP` | 保留 | 装配到 render 的基础设施语义 | `AC-11-prose-2` |
| `doc/platform/terminal-coding-standard.md:655` | `assembly` | `LAYER_RENAME` | 改为 application | TR-16 顶层运行层 | `AC-8-CP3-prose-1` |
| `doc/platform/terminal-coding-standard.md:658` | `assembly` | `LAYER_RENAME` | 改为 application | TR-16 顶层运行层 | `AC-8-CP3-prose-2` |
| `doc/platform/terminal-coding-standard.md:662` | `assembly` | `LAYER_RENAME` | 改为 application | TR-16 顶层运行层 | `AC-8-CP3-prose-3` |
| `doc/platform/terminal-coding-standard.md:705` | `assembly` | `LAYER_RENAME` | 改为 application | package layer sentence | `AC-8-CP3-prose-4` |
| `doc/platform/terminal-coding-standard.md:745` | `assembly` | `LAYER_RENAME` | 改为 application | device entry sentence | `AC-8-CP3-prose-5` |
| `doc/platform/terminal-coding-standard.md:974` | `assembly/` | `ASSEMBLY_SEMANTIC_KEEP` | 保留 | §7.1 `src/assembly/` 目录词表，不是顶层层名 | `AC-11-prose-3` |
| `doc/platform/implementation-task-template.md:175` | `assembly` | `LAYER_RENAME` | 改为 application | TR-16 target | `AC-8-CP3-prose-6` |
| `.agents/skills/cs-writing-plans/SKILL.md:62` | `assembly` | `LAYER_RENAME` | 改为 application | skill 的动态 target | `AC-8-CP3-prose-7` |
| `project-memory/practices/ter-input-and-virtual-keyboard-usage.md:38` | `assembly/设备` | `LAYER_RENAME` | 改为 application/设备 | TER 动态 target | `AC-8-CP3-prose-8` |
| `.agents/skills/cs-managed-runtime-execution/SKILL.md:102` | `assembly` | `LAYER_RENAME` | 改为 application | managed runtime target | `AC-8-CP3-prose-9` |
| `.agents/skills/cs-spec-to-plan/SKILL.md:46` | `assembly` | `LAYER_RENAME` | 改为 application | plan skill target | `AC-8-CP3-prose-10` |
| `project-memory/required-inventory.json:4863` | `assembly` | `LAYER_RENAME` | 手工更新 TR-16 anchor | generated inventory anchor | `AC-11-prose-4` |
| `project-memory/index.json:4863` | `assembly` | `LAYER_RENAME` | 由 build-index 生成 | derived memory index | `AC-11-prose-5` |
| `project-memory/operations/terminal-coding-standard.md:47` | `assembly` | `LAYER_RENAME` | 改为 application | active TR-16 rule | `AC-8-CP3-prose-11` |
| `doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md:27` | `assembly` | `ASSEMBLY_SEMANTIC_KEEP` | 保留 | 装配动作语义 | `AC-11-prose-6` |
| `doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md:42` | `assembly` | `ASSEMBLY_SEMANTIC_KEEP` | 保留 | surface 装配事实 | `AC-11-prose-7` |
| `doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md:43` | `assembly` | `ASSEMBLY_SEMANTIC_KEEP` | 保留 | integration/assembly boundary semantics | `AC-11-prose-8` |
| `doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md:45` | `assembly` | `ASSEMBLY_SEMANTIC_KEEP` | 保留 | catalog 装配事实 | `AC-11-prose-9` |
| `doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md:90` | `assembly` | `ASSEMBLY_SEMANTIC_KEEP` | 保留 | assembly-owned selector semantics | `AC-11-prose-10` |
| `doc/decisions/2026-09-11-v2s-terminal-admin-console-journey-proposal-codex.md:129` | `assembly` | `ASSEMBLY_SEMANTIC_KEEP` | 保留 | production assembly provenance | `AC-11-prose-11` |
| `project-memory/decisions/terminal-build-order-and-batches.md:23` | `assembly` | `ASSEMBLY_SEMANTIC_KEEP` | 只追加带日期取代条目 | 历史 build order | `AC-11-build-order-1` |
| `project-memory/decisions/terminal-build-order-and-batches.md:41` | `assembly` | `ASSEMBLY_SEMANTIC_KEEP` | 只追加带日期取代条目 | 历史 build order | `AC-11-build-order-2` |
| `project-memory/decisions/terminal-build-order-and-batches.md:54` | `assembly` | `ASSEMBLY_SEMANTIC_KEEP` | 只追加带日期取代条目 | 历史 build order | `AC-11-build-order-3` |
| `project-memory/decisions/terminal-architecture-and-stack-rulings.md:24` | `assembly` | `LAYER_RENAME` | 改为 application | active layer list | `AC-8-CP3-prose-12` |
| `project-memory/decisions/terminal-architecture-and-stack-rulings.md:28` | `assembly` | `LAYER_RENAME` | 改为 application | active TR-16 target | `AC-8-CP3-prose-13` |
| `AGENTS.md:53` | `assembly` | `LAYER_RENAME` | 改为 application | TR-16 转述的是顶层 application 层 | `AC-8-CP3-prose-14` |
| `CLAUDE.md:49` | `assembly` | `LAYER_RENAME` | 改为 application | TR-16 转述的是顶层 application 层 | `AC-8-CP3-prose-15` |

这张表的前两部分明确 `assemblyPromises`、`assemblyModule`、装配语义散文和第 974 行的目录词表不能被层名扫描
误报；反过来，所有指顶层目录、package、moduleName、runner target 或 TR-16 target 的命中必须随 CP-2/CP-3
改名。对“同一文件存在两个不同 token”仍按两行核验，不得以文件级白名单放行。

#### 9.2b apps/terminal README 的逐行分类

README 也属于 active corpus。以下 84 行是从当前 apps/terminal README 逐行重算的完整分母；每一行都单独分类，
不得以 README 文件级白名单放行。src/assembly/、装配动作和 assembly 变量属于
ASSEMBLY_SEMANTIC_KEEP；顶层 application 或目标 integration-assembly 的 package/layer identity 属于
LAYER_RENAME。

| path:line | token | class | action | reason | allowedDiffRef |
| --- | --- | --- | --- | --- | --- |
| apps/terminal/kernel/base/topology/README.md:59 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 装配语义，不是顶层层名 | AC-11-readme-001 |
| apps/terminal/kernel/base/platform-ports/README.md:33 | UI / application 控制面 | LAYER_RENAME | 改为 application | README 明确指向 application 控制面，不是包内装配动作 | AC-11-readme-002 |
| apps/terminal/kernel/base/platform-ports/README.md:128 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | factory 前等待的装配语义 | AC-11-readme-003 |
| apps/terminal/assembly/android/sample-terminal/README.md:1 | @catering-v2s/assembly-android-sample-terminal | LAYER_RENAME | 改为 application | 顶层 application package identity | AC-11-readme-004 |
| apps/terminal/assembly/android/sample-terminal/README.md:11 | sample assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | sample 装配输入语义 | AC-11-readme-005 |
| apps/terminal/assembly/android/sample-terminal/README.md:19 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 等待装配完成的运行语义 | AC-11-readme-006 |
| apps/terminal/application/android/sample-terminal/README.md:22 | 本 application 的固定 moduleName | LAYER_RENAME | 改为 application | moduleName 属于顶层 application 包身份 | AC-11-readme-007 |
| apps/terminal/assembly/android/sample-terminal/README.md:24 | src/assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 包内 src/assembly 目录词表 | AC-11-readme-008 |
| apps/terminal/assembly/android/sample-terminal/README.md:29 | src/assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 包内实现目录 | AC-11-readme-009 |
| apps/terminal/assembly/android/sample-terminal/README.md:30 | sample assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | sample 装配接缝语义 | AC-11-readme-010 |
| apps/terminal/assembly/android/sample-terminal/README.md:46 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | assembly rejection 事实 | AC-11-readme-011 |
| apps/terminal/assembly/android/sample-terminal/README.md:55 | sample-console assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | integration assembly 的业务语义 | AC-11-readme-012 |
| apps/terminal/assembly/android/sample-terminal/README.md:69 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 命令所在包的装配说明 | AC-11-readme-013 |
| apps/terminal/assembly/android/sample-terminal/README.md:74 | src/assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 包内 src/assembly 目录词表 | AC-11-readme-014 |
| apps/terminal/ui/base/feature-assembly/README.md:1 | ui.base.feature-assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 非本批目标的 feature assembly 包 | AC-11-readme-015 |
| apps/terminal/ui/base/feature-assembly/README.md:5 | module/assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | feature assembly 工具职责 | AC-11-readme-016 |
| apps/terminal/ui/base/feature-assembly/README.md:6 | App assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 对比说明，不是目标层名 | AC-11-readme-017 |
| apps/terminal/ui/base/feature-assembly/README.md:24 | assembly factory | ASSEMBLY_SEMANTIC_KEEP | 保留 | factory 装配语义 | AC-11-readme-018 |
| apps/terminal/ui/base/feature-assembly/README.md:27 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 变量表示装配对象 | AC-11-readme-019 |
| apps/terminal/ui/base/feature-assembly/README.md:32 | assembly.createModule | ASSEMBLY_SEMANTIC_KEEP | 保留 | assembly module 调用语义 | AC-11-readme-020 |
| apps/terminal/assembly/electron/README.md:1 | Electron assembly | LAYER_RENAME | 改为 application | 顶层 application 保留位 | AC-11-readme-021 |
| apps/terminal/assembly/electron/README.md:3 | Electron assembly | LAYER_RENAME | 改为 application | 顶层 application 保留位说明 | AC-11-readme-022 |
| apps/terminal/assembly/base/android/README.md:5 | assembly.base.android | LAYER_RENAME | 改为 application | 顶层 application base package | AC-11-readme-023 |
| apps/terminal/assembly/base/android/README.md:22 | App assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | App 装配动作语义 | AC-11-readme-024 |
| apps/terminal/assembly/base/android/README.md:23 | render assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | render 装配语义 | AC-11-readme-025 |
| apps/terminal/ui/base/console-assembly/README.md:5 | ui.base.console-assembly | LAYER_RENAME | 改为 integration-assembly | 目标 integration-assembly package identity | AC-11-readme-026 |
| apps/terminal/ui/base/console-assembly/README.md:12 | console assembly | LAYER_RENAME | 改为 integration-assembly | 目标 integration-assembly 依赖说明 | AC-11-readme-027 |
| apps/terminal/ui/base/console-assembly/README.md:31 | console assembly | LAYER_RENAME | 改为 integration-assembly | 目标 integration-assembly owner 说明 | AC-11-readme-028 |
| apps/terminal/ui/base/dev-host/README.md:6 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | dev-host 接入装配语义 | AC-11-readme-029 |
| apps/terminal/ui/base/dev-host/README.md:12 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 通用宿主生成 surface 的装配语义 | AC-11-readme-030 |
| apps/terminal/ui/base/dev-host/README.md:18 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | runtime 内重启装配语义 | AC-11-readme-031 |
| apps/terminal/ui/base/dev-host/README.md:48 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | runtime reader 的装配对象 | AC-11-readme-032 |
| apps/terminal/ui/base/dev-host/README.md:52 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | integration 注入装配对象 | AC-11-readme-033 |
| apps/terminal/ui/base/dev-host/README.md:65 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 宿主重启时的装配语义 | AC-11-readme-034 |
| apps/terminal/ui/base/dev-host/README.md:70 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | SECONDARY 挂载不重启装配 | AC-11-readme-035 |
| apps/terminal/ui/base/dev-host/README.md:77 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | integration 薄入口装配配置 | AC-11-readme-036 |
| apps/terminal/ui/feature/sample-wallpaper-picker/README.md:34 | sampleWallpaperPickerAssembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | feature parts 装配对象 | AC-11-readme-037 |
| apps/terminal/ui/feature/sample-wallpaper-picker/README.md:52 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | integration/assembly 责任语义 | AC-11-readme-038 |
| apps/terminal/ui/base/admin-shell/README.md:13 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | admin shell 的 assembly 能力语义 | AC-11-readme-039 |
| apps/terminal/ui/base/admin-shell/README.md:23 | integration assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | integration assembly 注入语义 | AC-11-readme-040 |
| apps/terminal/ui/base/admin-shell/README.md:24 | assembly/runtime | ASSEMBLY_SEMANTIC_KEEP | 保留 | runtime facts 装配语义 | AC-11-readme-041 |
| apps/terminal/ui/base/render/README.md:75 | assembly children | ASSEMBLY_SEMANTIC_KEEP | 保留 | render children 的装配语义 | AC-11-readme-042 |
| apps/terminal/ui/base/render/README.md:78 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | RenderProvider 前的装配边界 | AC-11-readme-043 |
| apps/terminal/adapter/android/persist-kv/README.md:17 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | adapter factory 的装配语义 | AC-11-readme-044 |
| apps/terminal/adapter/android/persist-kv/README.md:80 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 变更前回读的装配语义 | AC-11-readme-045 |
| apps/terminal/adapter/android/persist-kv/README.md:83 | sample assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | sample 装配测试面 | AC-11-readme-046 |
| apps/terminal/assembly/android/sample-wallpaper-terminal/README.md:1 | @catering-v2s/assembly-android-sample-wallpaper-terminal | LAYER_RENAME | 改为 application | 顶层 application package identity | AC-11-readme-047 |
| apps/terminal/assembly/android/sample-wallpaper-terminal/README.md:20 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | Android App 装配完成语义 | AC-11-readme-048 |
| apps/terminal/assembly/android/sample-wallpaper-terminal/README.md:23 | src/assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 包内 src/assembly 目录词表 | AC-11-readme-049 |
| apps/terminal/assembly/android/sample-wallpaper-terminal/README.md:24 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | integration 依赖装配语义 | AC-11-readme-050 |
| apps/terminal/assembly/android/sample-wallpaper-terminal/README.md:47 | integration assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | integration 装配语义 | AC-11-readme-051 |
| apps/terminal/assembly/android/sample-wallpaper-terminal/README.md:61 | assembly rejection | ASSEMBLY_SEMANTIC_KEEP | 保留 | failure page 的装配语义 | AC-11-readme-052 |
| apps/terminal/adapter/android/dual-screen/README.md:20 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | adapter host 接线语义 | AC-11-readme-053 |
| apps/terminal/adapter/android/dual-screen/README.md:38 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | assembly props 对比语义 | AC-11-readme-054 |
| apps/terminal/adapter/android/dual-screen/README.md:64 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | adapter 复用 assembly 接线 | AC-11-readme-055 |
| apps/terminal/adapter/android/dual-screen/README.md:81 | UI assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | UI 装配的业务语义 | AC-11-readme-056 |
| apps/terminal/ui/feature/sample-staff-auth/README.md:32 | src/assembly/assembly.ts | ASSEMBLY_SEMANTIC_KEEP | 保留 | feature 内部 assembly 目录与模块接线 | AC-11-readme-057 |
| apps/terminal/ui/feature/sample-staff-auth/README.md:42 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | feature parts 的装配语义 | AC-11-readme-058 |
| apps/terminal/ui/feature/sample-member-desk/README.md:36 | src/assembly/assembly.ts | ASSEMBLY_SEMANTIC_KEEP | 保留 | feature 内部 assembly 目录与模块接线 | AC-11-readme-059 |
| apps/terminal/ui/feature/sample-member-desk/README.md:59 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | feature parts 的装配语义 | AC-11-readme-060 |
| apps/terminal/ui/integration/sample-wallpaper-console/README.md:11 | adapter/assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | adapter 与 integration 的装配职责 | AC-11-readme-061 |
| apps/terminal/ui/integration/sample-wallpaper-console/README.md:12 | assembly.android.sample-wallpaper-terminal | LAYER_RENAME | 改为 application | Android application package identity | AC-11-readme-062 |
| apps/terminal/ui/integration/sample-wallpaper-console/README.md:16 | src/assembly/assembly.tsx | ASSEMBLY_SEMANTIC_KEEP | 保留 | integration 内部 assembly 目录 | AC-11-readme-063 |
| apps/terminal/ui/integration/sample-wallpaper-console/README.md:29 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | dev-host 接入装配语义 | AC-11-readme-064 |
| apps/terminal/ui/integration/sample-wallpaper-console/README.md:52 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | assembly factory 示例 | AC-11-readme-065 |
| apps/terminal/ui/integration/sample-wallpaper-console/README.md:56 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | surface factory 的装配参数 | AC-11-readme-066 |
| apps/terminal/ui/integration/sample-wallpaper-console/README.md:57 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | surface factory 的装配参数 | AC-11-readme-067 |
| apps/terminal/ui/integration/sample-wallpaper-console/README.md:63 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 跨机内容的装配边界 | AC-11-readme-068 |
| apps/terminal/ui/integration/sample-wallpaper-console/README.md:65 | admin console assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | shared admin console 装配语义 | AC-11-readme-069 |
| apps/terminal/ui/integration/sample-wallpaper-console/README.md:97 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | surfaceForm 装配参数语义 | AC-11-readme-070 |
| apps/terminal/ui/integration/sample-console/README.md:11 | ui.base.console-assembly | LAYER_RENAME | 改为 integration-assembly | 目标 integration-assembly package identity | AC-11-readme-071 |
| apps/terminal/ui/integration/sample-console/README.md:16 | src/assembly/assembly.tsx | ASSEMBLY_SEMANTIC_KEEP | 保留 | integration 内部 assembly 目录 | AC-11-readme-072 |
| apps/terminal/ui/integration/sample-console/README.md:23 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | test-expo 接入装配语义 | AC-11-readme-073 |
| apps/terminal/ui/integration/sample-console/README.md:42 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | defined parts 的装配对账语义 | AC-11-readme-074 |
| apps/terminal/ui/integration/sample-console/README.md:44 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | runtime 的装配读取语义 | AC-11-readme-075 |
| apps/terminal/ui/integration/sample-console/README.md:45 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | createSurface 的装配委托语义 | AC-11-readme-076 |
| apps/terminal/ui/integration/sample-console/README.md:56 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | surface factory 的装配参数 | AC-11-readme-077 |
| apps/terminal/ui/integration/sample-console/README.md:57 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | display mapping 的装配语义 | AC-11-readme-078 |
| apps/terminal/ui/integration/sample-console/README.md:58 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | createSurface 的装配参数 | AC-11-readme-079 |
| apps/terminal/ui/integration/sample-console/README.md:60 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | consumer 注入 production ports 的装配语义 | AC-11-readme-080 |
| apps/terminal/ui/integration/sample-console/README.md:64 | assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 跨机内容的装配边界 | AC-11-readme-081 |
| apps/terminal/ui/integration/sample-console/README.md:66 | admin console assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | shared admin console 装配语义 | AC-11-readme-082 |
| apps/terminal/ui/integration/sample-console/README.md:82 | createSampleAssembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | integration assembly factory 语义 | AC-11-readme-083 |
| apps/terminal/ui/integration/sample-console/README.md:86 | business assembly | ASSEMBLY_SEMANTIC_KEEP | 保留 | 业务 assembly 语义，不是层名 | AC-11-readme-084 |

这张表的全部部分明确 assemblyPromises、assemblyModule、装配语义散文、第 974 行目录词表以及 README 中的
src/assembly/ 不能被层名扫描误报；反过来，所有指顶层目录、package、moduleName、runner target 或
TR-16 target 的命中必须随 CP-2/CP-3 改名。对“同一文件存在两个不同 token”仍按两行核验，不得以文件级白名单放行。

### 9.3 AC-3 四处换靶与三条新增红测试

每个 fixture 先无变异运行通过，再只做一个变异；恢复后同一个测试必须绿。冻结如下：

| fixture | 唯一变异 | gate | 报文前缀 |
| --- | --- | --- | --- |
| `tools/terminal-skeleton/check-static.test.mjs` 的 obsolete `kernel.base.test-support` fixture | 把 fixture target 改到稳定 `kernel.base.platform-ports` 后不再引用旧 node | skeleton graph comparison | `FIRST_FAILURE:graph-comparison:` |
| `tools/terminal-skeleton/check-static.test.mjs` 的已退役依赖边界 fixture | 在 primitives 中加入现有 `@catering-v2s/ui-base-render/src/index` 非根 workspace import | graph-comparison | `non-root workspace import` |
| `tools/terminal-ui-state/check-static.test.mjs` 的相邻节点截取夹具 | 把边界包名换成非相邻 package，唯一改测试 input | ui-state package boundary | `TERMINAL_UI_STATE_STATIC_UI_STATE_PACKAGE_BOUNDARY=` |
| `tools/terminal-sample2/check-native-projection.test.mjs` 的 darkMode fixture | 只恢复一处 `darkMode: 'class'` 到 `sample-terminal` | native projection | `sample-terminal has an unallowed darkMode difference` |
| 新：skeleton/layering graph | 给 UI feature 一个 `application` production edge | `p-5a-direction` | `P-5a reverse dependency ui->application (` |
| 新：skeleton/layering graph | 给 adapter 一个 application edge | `p-5a-direction` | `P-5a reverse dependency adapter->application (` |
| 新：skeleton scaffold | 在 application package 下创建 `node_modules` fixture | `SCAFFOLD_HYGIENE` | `HYGIENE_FAILURE:scaffold metadata remains:` |

AC-3 记录 `inputBefore`, `mutation`, `firstFailure`, `restore`, `greenAfter`，不接受“预计会红”。

AC-2(a) 的当前判据是 active corpus 对 retired `plannedDependencies` mechanism 的零命中；实现不再有
`plannedDependencies` 字段或 checker 分支。其 red proof 使用现有 graph-comparison 的非根 workspace import
fixture（唯一变异为向 primitives 加入 `@catering-v2s/ui-base-render/src/index`），门报告
`non-root workspace import`，恢复后 skeleton focused test 回绿。UI feature→application
与 adapter→application 两条变异都必须走 `tools/terminal-layering/check-static.mjs` 的 `p-5a-direction`
gate，报文分别以 `P-5a reverse dependency ui->application (`、`P-5a reverse dependency adapter->application (`
开头；application `node_modules` 变异必须走 `tools/terminal-skeleton/check-static.mjs` 的
`SCAFFOLD_HYGIENE`，以 `HYGIENE_FAILURE:scaffold metadata remains:` 开头。这样每一条新增红测试都有
唯一 gate 与报文，不以“或”放宽判据。

### 9.4 AC-8 snapshot/allowed-diff 格式

快照不是只取源码；其 file set 是 active list 全集，再额外纳入两个 debug.keystore 和所有两个 App `.runtime/`
文件。manifest 结构冻结为：

```json
{
  "schemaVersion": 1,
  "kind": "ter-package-layout-active-snapshot",
  "capturedAt": "<ISO-8601>",
  "files": [
    {"path":"<repo-relative>","category":"源码|配置|检查器与工具|脚本|测试|README|正本|记忆|skill|keystore|runtime","sha256":"<64hex>","allowedDiffRef":null}
  ],
  "allowedDifferences": [
    {"id":"CP-2-...","path":"<repo-relative>","anchor":"<unique token>","kind":"rename|move|baseline-fix|generated","reason":"<PL/AC reference>"}
  ]
}
```

生成方式：先保存 active file set，再对每个 path `shasum -a 256`；目录 move 以 old/new mapping 逐文件登记；
`allowedDiffRef` 必须指向 AC-11 同一张 classification table，未登记文件只能 sha256 完全相同。lock file 归 AC-6，
可重建产物不进入普通 byte compare 但 keystore/runtime 必须进入。红变异固定为：清空 snapshot、删一行、增无关文件、
省略 category、改未登记字符串、扩大 allowedDifferences；六项都必须让 comparator fail closed。

## 10. 原生与 TR-16 证据

### 10.1 AC-9 原生命令和冻结期望

后续获批构建时，两个 App 必须分别执行，不能读取一次共享文件冒充两 App：

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

`apkanalyzer` 若 latest 路径不存在，按 `$ANDROID_HOME/cmdline-tools/*/bin/apkanalyzer` 的最高已安装稳定目录
选择；找不到则 fail closed，不用 `PackageList.java` 替代。当前已确认 `apksigner` 在
`$ANDROID_HOME/build-tools/36.1.0/apksigner`，当前 debug keystore sha256 为
`221e0a3106aa4c3ccc154e0a418b55020b3f9ea6e84f92e8749cd9e2f39f5e58`，证书 SHA256 为
`FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`。
两个 App 各自记录 `buildId`, `capturedAt`, Expo list sha256, APK sha256, keystore sha256, cert digest。

预期：`ExpoModulesPackageList.kt` 的 modulesMap 恰含三个新 Kotlin 全名且不含三个旧全名；APK dex 同样；两个
keystore 与基线相同，APK cert digest 与对应 keystore 相同。红变异：错一个 module class、换 keystore、把读取路径指向另一个 App
的 list/APK，三者必须分别判红。

### 10.2 AC-10 TR-16 配对行

两行冻结为（当前源码的直接来源也一并冻结）：

| row | Web（先） | 设备（后） | owner/ready 证据 |
| --- | --- | --- | --- |
| W-1/D-1 | `apps/terminal/ui/integration/sample-console`，`http://localhost:8081/?surfaceForm=mobile`，mobile，冷启动首屏 | `apps/terminal/application/android/sample-terminal` release APK，mobile VM，冷启动 | `primaryReadyPartKey=sample.auth.login`；source=`apps/terminal/ui/feature/sample-staff-auth/src/features/actors/actors.ts:36-41`，part/testID=`apps/terminal/ui/feature/sample-staff-auth/src/parts/parts.ts:15-23`、`apps/terminal/ui/feature/sample-staff-auth/src/components/{laptop,mobile}/StaffLogin.tsx:22`；`secondary=null` |
| W-2/D-2 | `apps/terminal/ui/integration/sample-wallpaper-console`，`http://localhost:8081/?surfaceForm=laptop`，选择 `sample-wallpaper-console:test-expo:surface-mode:dual` 双屏预览，冷启动首屏 | `apps/terminal/application/android/sample-wallpaper-terminal` release APK，单机双屏 VM，PRIMARY 与 SECONDARY 分开 | `primaryReadyPartKey=sample.auth.login`；SECONDARY=`sample.wallpaper-console.waiting`, testID=`sample.wallpaper-console.waiting`; sources=`apps/terminal/ui/feature/sample-staff-auth/src/features/actors/actors.ts:36-41`、`apps/terminal/ui/integration/sample-wallpaper-console/src/features/actors/actors.ts:84-87`、`apps/terminal/ui/integration/sample-wallpaper-console/src/parts/parts.ts:11-21`、`apps/terminal/ui/integration/sample-wallpaper-console/src/components/laptop/Waiting.tsx:4-6` |

Web 命令使用每个 integration package 的现有 `web` script；URL 与形态选择固定为上表，W-2 的双屏通过
`sample-wallpaper-console:test-expo:surface-mode:dual` 选择，不存在 dual URL 参数。三条匿名态前置必须按 row
分别执行，并在清除或登出前、完成后各记录一次 startup/readiness 与可见根 testID 状态：

1. **W-1/D-1**：只使用产品内 `sample.desk.member-list:logout`；登出前记录现状，点击后确认
   `sample.auth.login` 与 startup readiness，再记录登出后的状态。该产品登出动作只适用于 W-1/D-1，不能挪用到 W-2/D-2。
2. **W-2**：Web 不执行产品登出；记录清除前状态后，只清除 `sample-wallpaper-console-web` 持久化键，重新打开上表
   URL 并确认 PRIMARY `sample.auth.login` 与 SECONDARY `sample.wallpaper-console.waiting`，再记录清除后的状态；不得清空整个 profile。
3. **D-2**：单机双屏虚拟机冷启动后先记录状态。若已经匿名则不清除；若不是匿名，才使用 Dexter 已授权的一次性动作，
   只清除 `sample-wallpaper-terminal` App 数据一次，记录清除前状态，重新启动并确认 PRIMARY/SECONDARY 匿名态后再记录清除后状态。
   不得清除其它 App 或其它数据。D-2 没有匿名态确认时标为 OPEN。

设备使用受管 Android runner，不能用 Vitest/jsdom 代替 Web。W-2 的 SECONDARY 读取要等待 `surface-mode:dual`
生效后再取树；W-1 mobile 不创建 SECONDARY。

JSON readiness 必须与 `startupDiagnosticsWriter.ts:13-20` 的类型一致：`groups` 是六个布尔成员
`modules/slices/commands/actors/ports/parts`，`primaryDeclared`、`primaryMeasured`、`primaryRealReady` 都是
布尔值，不得使用数组或对象占位。每行示例中的 readiness 至少为：

```json
{"groups":{"modules":true,"slices":true,"commands":true,"actors":true,"ports":true,"parts":true},"primaryDeclared":true,"primaryMeasured":true,"primaryRealReady":true,"primaryReadyPartKey":"sample.auth.login","primaryContentFailure":null}
```

readiness owner 是 `consoleAssembly.tsx:379-405` 的 `getStartupReadiness`（CP-2 改名后为
`integrationAssembly.tsx` 中同一函数），不是 `startupReady.ts`。`startupDiagnosticsWriter.ts` 只负责写出
结构化 `startup.complete`；Web 从 integration logger 读取，设备以 App `LOG_TAG` 过滤 logcat。

每行 JSON：

```json
{"row":"W-1","end":"web","sourceDigest":"<same source digest>","capturedAt":"<ISO>","runId":"<run>","startupComplete":{"data":{"client":{"owner":"ui.base.integration-assembly"},"writer":"ui.base.integration-assembly","groups":{"modules":true,"slices":true,"commands":true,"actors":true,"ports":true,"parts":true},"primaryDeclared":true,"primaryMeasured":true,"primaryRealReady":true,"primaryReadyPartKey":"sample.auth.login","primaryContentFailure":null,"startupRunId":"<id>","appName":"<name>","surfaceProvenance":"<value>"}},"primaryReadyPartKey":"sample.auth.login","secondary":null,"business":"PASS|OPEN","cleanup":"PASS"}
```

SECONDARY 不新增日志：Web 从双屏预览 DOM 读实际 part root testID；设备沿用仓内 `uiautomator --windows`：

```sh
REMOTE_XML="/sdcard/<run-id>-<shape>-<timestamp>.xml"
adb -s <serial> shell uiautomator dump --windows "$REMOTE_XML"
adb -s <serial> shell cat "$REMOTE_XML" > "$EVIDENCE_DIR/window-<serial>.xml"
adb -s <serial> shell rm -f "$REMOTE_XML"
```

按 `<display id="N">...</display>` 分段，再复用 `scripts/test/ter-virtual-keyboard-android.mjs:239-266`
的 `parseResourceNode`/`parseResourceAttributeHash` 同形逻辑读取 testID，并把 `displayId`、testID、partKey、XML
路径写入 JSON；不使用未在两台虚拟机上证明可用的 `--display` 变体。上述 key 以当前 source anchor 冻结；若 CP-0/CP-3
改变了启动 actor 或 part catalog，必须把 source diff 作为 DESIGN_GAP/行为变化重新记录，不得静默替换 key。

TR-16 纪律：W-1/W-2 先 PASS 后才启动 D-1/D-2；两端 `sourceDigest` 必须相同；同一时间只一个受管运行；持有运行期间不改源码；
同一 failureCategory 第二次出现立即冻结该族。双屏各自独立是设备专属，不可伪造为 Web；AC-10 在本轮“未执行”。

### 10.3 AC-13

交付文字必须是：`TR-08=OPEN/OUT_OF_SCOPE`。owner=`platform/frontend-platform`；输入=`Dexter 对 harness debug-only 或删除的单独裁定 + 当前两个 harness 的 route/production bundle 约束`；首个 gate=`tools/terminal-sample2/check-production-bundle.test.mjs` 的 automation token/production absence 门，再由 TR-08 专项详设决定 debug/release 形态。`
本批不改 harness 的生产可达性，不删除守卫 token。

## 11. 数据迁移、seed、UI 和运行边界

| 项 | 结论 |
| --- | --- |
| DB migration/backfill | `N/A_WITH_REASON`：无数据库表/业务事实/HTTP contract |
| seed | `N/A_WITH_REASON`：不新增业务数据，不 reset/seed；不把 archive manifest 当 seed |
| UI/IA | `N/A_WITH_REASON`：布局与 Journey 不变；PrimitiveForm 只复原现有 Web form host |
| L2 | `BLOCKED/NOT_APPLICABLE_WITH_REASON`：本批没有新增 L2 控制面；后续 Web/设备 AC-10 不授权在本轮执行 |
| dynamic | `NOT_YET_EXECUTED`：详设冻结时尚未进入 CP-4；按本次授权在 Web 先于设备的阶段执行 |

## 12. 停止条件与风险

必须停在当前 CP 并交 Dexter 的条件：

- 发现 D-1 至 D-6 之外的产品/Journey 选择，或发现 darkMode 有实际 consumer；
- 只能通过改 Android applicationId、持久化 key、业务 command、UI 形态或 TR-08 语义才能过门；
- 某个 generated file 没有可运行生成链、keystore 不匹配、或 active memory 的历史取代关系无法无歧义表达；
- 同一 failureCategory 第二次出现；先回到 owning source，不换命令/场景重置计数；
- archive manifest 与恢复后的 bytes 不相等，或 cleanup 涉及四包以外路径。

不属于停工理由、而是主 agent 要做根因修复的：基线门失败、锁文件预期内 workspace diff、readability 失败、生成物路径
发现不一致但有明确生成链。任何失败保留 first failure、last known good、broken boundary、business/cleanup 分档。

## 13. 详设交付前对账

实施计划必须生成两份记录：

1. CP 级三维对账：需求 v5（PL/AC/D）、本详设/方案（本文件 §§2-12）、项目 memory 四个指定条目及六维 query hits；每条比较行为、形态、owner、失败/恢复、命名边界，结论只 `MATCHED`/`OPEN`。
2. 最终逐代码与详设对账：全部新增/修改/移动的源码、测试、README、index、exports、invariants、工具、脚本、正本、memory 与 archive record，逐条列详设 section、代码 anchor、evidence path、判定人、差异，结论只 `MATCHED`/`OPEN`。任一 OPEN 就是“实施未就绪”，不得交 review。

## 14. 自检与 review 交接

作者自检不能替代 fresh 独立盲审。写完详设和实施计划后：

- 生成 design-granularity manifest，列出本详设每个 CP 的输入、输出、gate、file-set、证据路径和 `OPEN` 条件；
- 由 fresh 独立子 agent 先读最小输入集并以证伪为先做 REVIEW_TARGET=DESIGN；最多两轮，第二轮 `SELF_DECIDED` 收口；
- 盲审记录包含输入清单、盲审声明、每条 finding 的 `CONFIRMED/PARTIALLY_CONFIRMED/REJECTED_WITH_EVIDENCE/UNVERIFIED/DEXTER_DECISION`、
  详设处置和当前字节证据；
- 通过 `scripts/check/claude-review-handoff --file <handoff>` 后，才把修订后的详设、实施计划、manifest、盲审记录交 Dexter/Claude。

本轮没有 IA/交互设计，因此不会伪造“视觉已审阅”；后续 implementation review 仍须把 Web-before-device 与原生证据按实际运行分档。
