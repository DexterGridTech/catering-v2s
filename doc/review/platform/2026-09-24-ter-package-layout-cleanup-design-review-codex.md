# TER 包布局整理正式需求与方案独立评审

REVIEW_TARGET=DESIGN  
VERDICT=NO-GO  
M/S/N=3/7/3  
REVIEW_CYCLE_ID=`TER_PACKAGE_LAYOUT_CLEANUP_CODEX_2026-09-24`  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=`CODEX_PRIMARY + INDEPENDENT_SUBAGENT`  

评审对象：

- `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-formal-requirements-claude.md`
- `doc/plans/platform/2026-09-24-ter-package-layout-cleanup-solution-claude.md`

本评审只做只读核验。没有修改源码、需求、方案、测试、依赖或构建产物；没有构建、安装、Web、Metro、Android、虚拟机或真机运行。

## 1. 独立推导的应有范围

先只按需求稿 §1.1 的 Dexter 原文推导，结论应当是：

1. `apps/terminal/assembly` 是顶层可运行 application 层，应整体改为 `apps/terminal/application`。影响不止目录：workspace glob、包名、moduleName、包图、工具/runner、Android 原生包名与自动链接、active 正本和记忆都必须分别判断。`assembly` 作为“把部件拼起来”的动作、`src/assembly` 和 `createXxxAssembly` 不能因为同词而误改。
2. `ui/base/console-assembly` 应改为 `ui/base/integration-assembly`，同时同步 package name、moduleName、包内真正属于该基础设施包的 `Console*`/`console*` 标识、日志 owner/writer/source 和错误前缀；两个 integration 自有的 `WallpaperConsoleAssembly`、`createSampleWallpaperConsoleAssembly` 等产品组合名不应被机械改写。
3. 四个包必须先做消费者分母核验。三个真正空壳可以移出仓内并留下可恢复记录；`ui/base/test-support` 不是空壳，它被三个 feature 的测试消费，最小方案是把它的测试类型直接归还已有的 `kernel/base/platform-ports` 出口，并同步三处 dev dependency、包图和测试 import。不能仅凭目录大小或仓内零命中决定删除。
4. 结构整理完成后必须能证明：旧名/旧包图/旧层路径没有漏改；允许差异之外没有夹带行为变化；原生 module 全名、签名和 startup 诊断没有回归；TR-16 的 Web/设备配对若纳入交付，必须有可执行的场景、绝对期望值和两端同字节证据。

这个独立推导与文档 §1.2 的“结构整理、不改运行行为”方向一致，但要求在详设前把 proof boundary 冻结，不能把关键判据继续留成开放占位。

## 2. 当前字节核验与静态基线

### 2.1 只读命令

本轮实际执行了以下仓内已有门：

| 命令 | 当前结果 | 事实边界 |
|---|---|---|
| `yarn --cwd apps/terminal typecheck` | PASS，Turbo 33/33 | 只证明当前类型可解析，不证明包图、命名或运行行为 |
| `yarn --cwd apps/terminal test` | FAIL；`kernel-base-transport` 的 `identityClient.test.ts` 有 2 个 `invalid topology identity response` | 失败落在当前 transport/topology 字节，不是本需求三项基线之一；测试 runner 会清理 package-local `node_modules`，因此缓存基线必须在 runner 之前取证 |
| `yarn --cwd apps/terminal verify:static` | FAIL；首个报告为 `readability-real-static`，含 TR-R03/04/05/06 | 不能把总门失败压缩成方案 §1 的三项 |
| `node tools/terminal-skeleton/check-static.mjs` | FAIL；`RULE_GRAPH_COMPARISON` 报 `assembly.android.sample-terminal` 缺 `ui.base.input`、`ui.base.primitives` | 这是需求 §1.3 的第一项，具体 gate 与报文可复现 |
| `node tools/terminal-layering/check-static.mjs` | FAIL；`sample-staff-auth/src/components/StaffLoginForm.tsx:13` 的既有 P-5d host tag 违规 | 这是额外的既有红，不是 §1.3 三项之一 |
| `node tools/terminal-ui-state/check-static.mjs` | PASS | 不能据此抵消全量静态门的其它失败 |

其它只读事实：

- `apps/terminal/kernel/base/platform-ports/src/index.ts:18-33,135-139` 已直接导出 `LogEvent`、`LogWriteInput`、`LogWriteResult`、`LoggerPort`、`NativeLoadingCapability`；`ui/base/test-support/src/index.ts:3` 只是同五个类型的转出。因此 D-3 不需要新增 platform-ports 生产代码或根出口。
- `apps/terminal/skeleton-graph.ts:49-76,84-115,144-149,175-218` 仍包含四个待下线节点/边，三个 UI feature 仍通过 `ui.base.test-support` 声明 dev dependency；两个 application 节点在 `:281-299` 确实缺 `ui.base.input`、`ui.base.primitives`。
- `tools/terminal-skeleton/check-static.mjs:460-468,600-613` 仍实现 `plannedDependencies`；`tools/terminal-ui-state/check-static.mjs:411-419` 仍以 `kernel.base.test-support` 作为正则边界。方案已意识到二者需要改，但没有给出换靶后的精确红断言。
- `apps/terminal/assembly/android/sample-terminal/App.tsx:8-19` 与 wallpaper 对应文件相同位置无条件 import/调用 `controlledKeyboardHarness`；`doc/platform/terminal-coding-standard.md:278-294` 的 TR-08 明确要求自动化/调试面在 production bundle 编译期不存在。`tools/terminal-sample2/check-production-bundle.mjs:8-17` 当前禁止名单没有 `controlledKeyboardHarness`。
- `doc/platform/terminal-coding-standard.md:974` 仍把顶层 `assembly/`列为目录层；`.agents/skills/cs-managed-runtime-execution/SKILL.md:85`、`cs-spec-to-plan/SKILL.md:35-40`、`cs-writing-plans/SKILL.md:60-63` 仍以 `assembly` 指可运行层；`project-memory/decisions/terminal-architecture-and-stack-rulings.md:23-28` 与 active `terminal-build-order-and-batches.md:20-54` 仍保存旧层/旧建设顺序。
- `tools/terminal-sample2/check-native-projection.mjs:258-265` 仍硬编码旧 application package name，说明改名后该工具必须实改，不能只做目录扫描。
- 当前 application 目录含被忽略的 `.runtime`、`.expo`、`.turbo`、`.gradle`、`.kotlin`、`.cxx`、`build`、`dist` 和两个 `debug.keystore`；需求要求移动 `.runtime`/keystore、删除明确的可重建产物，但 AC-8 的活跃文件范围又排除了构建产物，二者需要一个明确的文件分母。

## 3. Findings

### M-1 · AC-8 的反向映射证明目前不可执行

- 类型：仓内事实 / 推论。
- 文档位置：需求 AC-8，`...formal-requirements-claude.md:244-247`；方案 §9，`...solution-claude.md:196-204`。
- 事实与反例：AC-8 只说“仓外保存源码快照”“用锚定、按文件限定的映射反向替换”，方案把快照位置、映射、允许差异清单全部推迟到详设。当前没有机器可验证的 snapshot identity、文件清单、旧→新映射、忽略/构建/`.runtime`/keystore/yarn.lock 的处理规则，也没有防止空快照、空映射或把任意变更列入允许差异的门。简单字符串反替换还会把顶层 application 层的 `assembly` 与合法的 `src/assembly`、`createXxxAssembly`、`assembly-rejection` 混在一起；`Console` 也会碰到 integration 自有 API 的词边界。
- 证据：需求 AC-8 `:244-247`；命名区分需求 `:90-95`；当前组合语义规则 `doc/platform/terminal-coding-standard.md:974`；方案 §9 `:196-204`。
- 验收判据：详设必须冻结一个非临时、可恢复且有 hash 的快照 manifest，列出纳入比较的每个 active source/config 文件；提供路径/AST/manifest-aware 的旧→新映射和逐文件 allowed-diff manifest；明确四个移出包、三项 CP-0、lockfile、ignored runtime/keystore、可重建产物如何分别比较；对快照缺失、增加一行无关源码、改一个非允许业务字符串、扩大 allowlist 的红变异都必须失败。AC-8 只能报 PASS 当快照 identity、文件集合和每项允许差异都被实际验证。

### M-2 · AC-10 的 TR-16 矩阵缺少可执行的绝对期望值

- 类型：仓内事实 / 推论。
- 文档位置：需求 AC-10，`...formal-requirements-claude.md:254-263`；方案 §8，`...solution-claude.md:178-194`，以及 §9 `:204`。
- 事实与反例：两行矩阵只给出 integration/App/VM 组合；`primaryReadyPartKey` 和 SECONDARY `partKey` 被明确留给详设，方案没有写出 Web 入口、具体操作、startup 证据字段、双屏承载方式、设备 runner action 或证据落盘关系。只要 Web 页面启动成功、或只读到一个 `startup.complete`，就可能空过；“sample-wallpaper-console，laptop 双屏预览”也没有定义是 Web 的双 surface preview 还是 native 两个独立 display。方案 §6 又把设备验证收窄到两行，没有解释如何证明两块屏分别命中。
- 证据：需求 AC-10 `:254-263`；方案 §8 `:187-194`；现有设备 runner 的 startup 字段入口可见于 `tools/terminal-sample2/run-sample2-frozen-journey.mjs:434-448,599,624`，但方案没有把这些现有值写入本批绝对期望。
- 验收判据：详设必须给出两个 Web entry、每行同一份源码字节标识、操作步骤、`startup.complete` 的完整字段期望、sample-console 的 primary key、wallpaper 的 primary/secondary key、双屏 displayIndex/partKey 映射和 evidence manifest schema；Web 通过时间必须早于对应设备 run；设备端必须分别观察 PRIMARY/SECONDARY；故意交换 secondary key、清空 readiness、把 Web/设备源码 hash 改成不同值时门必须红。未授权动态阶段前只能把 AC-10 标为未执行，不能在设计里写成已可证明。

### M-3 · 基线门的范围与当前事实冲突，四步无法按现文档开工

- 类型：仓内事实 / 推论 / 假设（“只有三项基线红”是未经运行的假设）。
- 文档位置：需求 §1.3，`...formal-requirements-claude.md:80-86`；PL-R00 `:99-106`；方案 §1 `...solution-claude.md:7-24`。
- 事实与反例：文档把三项源码推断列为当前基线，并规定第 0 步后 typecheck、test、`verify:static` 全绿，遇到其它首败就停。实际只读运行得到 typecheck PASS，但全量 test 在 `apps/terminal/kernel/base/transport/test/identityClient.test.ts:18-24,34-37` 失败，错误来自 `apps/terminal/kernel/base/contracts/src/foundations/topologyWire.ts:216-225`；`verify:static` 首败为 readability-real-static；直接 layering 门还在 `sample-staff-auth/src/components/StaffLoginForm.tsx:13` 失败。这样第 0 步不可能按“只修三项后三道门全绿”完成，且方案没有规定全量门、直接子门与已有红之间的优先级或授权处置。
- 证据：上述当前命令结果；需求 `:80-106`；transport 测试与 parser 行号；`tools/terminal-layering/check-static.mjs:115-125,182-186`。
- 验收判据：先在详设中冻结每一道命令、版本/工作区状态、首败排序和结果分类；基线表必须同时列出三项“本批预期红”和 transport/readability/layering 等其它现有红。若“其它红”不属于本批，必须有 Dexter 的明确不修/继续门，并把 AC-0 改为“无本批新增回归、已知外部红保持同一摘要”，不能写“第 0 步后三道门全绿”。若要求全绿，则本批范围必须扩充并重做授权，这不是当前方案可自行推断的。

### S-1 · AC-2 的扫描范围会对 active 未跟踪文件、正本和 skill 空过

- 类型：仓内事实 / 推论。
- 文档位置：需求 §2 `...formal-requirements-claude.md:90-95`；AC-2 `:206-222`；方案风险 `...solution-claude.md:174-176`。
- 事实与反例：活跃文件明确定义为受控与未忽略文件，并包含 `AGENTS.md`、`CLAUDE.md`、`project-memory`、`.agents/skills`、`doc/platform`；AC-2 却要求用 `git grep`，该工具只看 tracked 文件。AC-2(c) 的 PCRE 还只覆盖 `tools/**`、`scripts/**`、`apps/terminal/**`，没有证明根治理文件、active memory、skill 和编码规范中 top-level `assembly` 的层语义。当前 `doc/platform/terminal-coding-standard.md:974`、`.agents/skills/cs-managed-runtime-execution/SKILL.md:85` 等正是未被现有 allowlist 明确涵盖的残留族。手写的 Console 正则也不能保证未来新增的旧内部标识被捕获。
- 证据：需求 `:94-95,206-218`；`doc/platform/terminal-coding-standard.md:974`；三个 skill 上述行；`git grep` 与当前 active 文件定义不等价。
- 验收判据：AC-2 应先生成包含受控/未忽略 active 文件的确定文件清单，再用 `rg --hidden --no-ignore` 或等价的显式文件列表扫描；历史四目录单独排除并记录。把 layer-name、package-name、moduleName、Kotlin full name、Console symbol 分成不同扫描集合；每个合法 composition 命中必须逐文件白名单并说明；旧 package/source AST 导出的标识集合应驱动 Console forbidden set；每种模式保留改动前正控制，删除一个扫描输入文件、改一个旧名到未列出的同义标识时都要红。

### S-2 · AC-9 没有现成可执行的 ExpoModulesPackageList/证书证据路径

- 类型：仓内事实 / 推论。
- 文档位置：需求 AC-9 `...formal-requirements-claude.md:249-252`；方案 §8/§9 `...solution-claude.md:178-185,196-204`。
- 事实与反例：当前原生投影检查器仍在 `:264-265` 断言旧 npm 名；仓内当前没有生成的 `ExpoModulesPackageList` 可供静态检查。现有 production bundle 守卫只扫 `tools/terminal-sample2/check-production-bundle.mjs:8-17` 的 token，不能产生“自动链接清单恰含三个新全名”或“APK 证书摘要等于 keystore”的结果。方案只写目标，把生成文件定位、构建后读回、`apksigner`/`keytool` 命令、两个 APK/两个 keystore 的对应关系留给详设。
- 证据：`tools/terminal-sample2/check-native-projection.mjs:258-275`；`tools/terminal-sample2/check-production-bundle.mjs:8-17`；需求/方案上述行；Android 类名来源 `apps/terminal/assembly/base/android/expo-module.config.json:5-7` 与签名配置 `apps/terminal/assembly/android/sample-terminal/android/app/build.gradle:114-129`。
- 验收判据：详设要冻结两个 application 的 release 命令、生成 `ExpoModulesPackageList` 的准确路径/阶段、三个新 Kotlin full name 的 exact set、旧名零命中和失败输出；冻结每个 APK 与对应 `debug.keystore` 的 sha256、`apksigner verify --print-certs`/等价证书摘要命令及 expected digest；改一个类名、旧包名或签名输入时必须红。只读设计阶段不运行这些命令，但不能把未定义的命令当作 AC-9 已可落地。

### S-3 · active 正本、active memory 与 skills 的同步判据不完整

- 类型：仓内事实 / 推论。
- 文档位置：需求 PL-R01 `...formal-requirements-claude.md:129-135`、AC-11 `:265-269`；方案 §4 `...solution-claude.md:110-120`。
- 事实与反例：方案列出若干 TR-16/TR-17 行和若干 memory 文件，但漏掉 `doc/platform/terminal-coding-standard.md:974` 的顶层目录表；三个 skill 只写“同步”，未列出当前实际命中路径。更重要的是，`project-memory/decisions/terminal-build-order-and-batches.md` 是 `status: active`，其 `TER_FOUNDATION_FIRST_THREE_BATCHES` 与 `TER_SKELETON_TWO_BATCH_VERTICAL_SLICE` 在 `:20-54` 仍把 workflow、automation、test-support、assembly 作为建设顺序。仅追加“取代说明”而不说明其在 active query 中的优先级、frontmatter/assertion/index 处理，后续 agent 仍可能按旧包顺序行动。
- 证据：上述正本与 memory 行；`project-memory/required-inventory.json:4863` 及 `index.json` 的 TR-16 anchor 也需要与新术语同步；memory 的 active 前端由 `project-memory/index.md` 路由。
- 验收判据：详设列出每一个实际命中的 active path，并逐项决定“顶层 application 需改”或“composition assembly 保留”；把 `terminal-coding-standard.md:974` 纳入 AC-11。对 active memory 采用追加而不改历史正文可以接受，但追加内容必须是带日期、明确优先级的 normative supersession，并同步 assertion/required-inventory/index；运行 `scripts/memory/build-index`、`scripts/memory/build-index --check`、`scripts/check/project-memory`，再用六维 query 证明新结论优先且不再把已下线包当当前建设步骤。不要用改写历史 review/plan 替代这个同步。

### S-4 · D-4 的仓外保留方案不能仅以“日期目录+文件数/体积”证明可恢复

- 类型：仓内事实 / 推论。
- 文档位置：需求 PL-R03/D-4 `...formal-requirements-claude.md:161-173,285-286`；方案 §5 与 §9 `...solution-claude.md:122-134,196-204`。
- 事实与反例：三空壳与 `ui/base/test-support` 都要移出仓内，但实际外部根目录、命名冲突处理、源路径、文件 hash、目录清单、移出时间、恢复步骤、是否包含 ignored 文件没有冻结。仅记录文件数和体积时，内容被替换而计数/体积相同不会被发现；记录落在 `/tmp` 又违反需求。方案明确把位置与记录格式推迟到详设。
- 证据：需求 `:163-167,285-286`；方案 `:124-130,196-204`；当前 `ui/base/test-support` 内容与其五个类型出口见 `apps/terminal/ui/base/test-support/src/index.ts:1-3`。
- 验收判据：详设冻结仓外持久根、不可碰撞命名、源/目标相对路径、文件数/字节数/逐文件 sha256、manifest 与恢复命令；四个 package 都有一条记录（包括合并包的五个类型来源）；仓内目录和 graph/yarn.lock 清理后，按 manifest 可在不依赖 runtime/build fallback 的情况下恢复原字节。证明清理动作只触及本批包，不影响其它 dirty workspace 内容。

### S-5 · D-5 与 TR-08 的现状冲突，方案不能把“行为不变”与“静态全绿”混为通过

- 类型：仓内事实 / 推论。
- 文档位置：需求现状/PL-R05/D-5 `...formal-requirements-claude.md:80-88,182-193,287-298`；方案 §5、§6、§10 `...solution-claude.md:124-134,156-158,206-215`。
- 事实与反例：两个 App 在 `App.tsx:8-19` 生产入口无条件引用并可通过 intent 切到 `controlledKeyboardHarness`；TR-08 `doc/platform/terminal-coding-standard.md:278-294` 的要求是 production bundle 编译期不存在。D-5 的“本批原样搬位”是 Dexter 已授权的范围判断，可以保留，但它不等于 TR-08 PASS。当前 `check-production-bundle` 的禁止 token 没有 harness，因此测试通过也不能证明这一风险关闭。
- 证据：两份 App 对应 `:8-19`；TR-08 `:278-294`；`tools/terminal-sample2/check-production-bundle.mjs:8-17`；需求 D-5 `:287-290`。
- 验收判据：本批交付表将 TR-08 明确写为 `OPEN / OUT_OF_SCOPE`，不把 AC-6 的工具测试绿或 AC-8 的行为比对写成 TR-08 关闭；记录后续 owner、输入、首个 gate 和“debug-only vs 删除”的 Dexter 裁定入口。若详设要宣称 `verify:static` 全绿，必须声明它不代表 TR-08 全集通过，或补一个不改变本批范围的明确 NOT_APPLICABLE 判据。

### S-6 · 四步“每步安装后过三道门”缺少可通过的中间态契约

- 类型：推论 / 假设。
- 文档位置：方案 §1 `...solution-claude.md:7-24`、§7 `:166-176`、§9 `:196-204`。
- 事实与反例：步骤 1 同时删包、改 graph、改 fixtures、删 `plannedDependencies`；步骤 2 改 package/moduleName/所有 Console 标识；步骤 3 改顶层 workspace、native、runner、layer checker。方案未给出每步的原子变更清单、允许的中间 workspace/lockfile 状态和 exact install 命令。第 0 步的 harness 目标目录也未确定；而 TR-R06 当前只在 `tools/terminal-readability/check-static.mjs:27-28` 定义 root 文件名单，错误目录会让静态门仍红。安装可能改写 lockfile/安装状态，方案没有 clean-install/lockfile diff 边界。
- 证据：需求第 0 步 `...formal-requirements-claude.md:99-106`；方案 §9 `:198-203`；TR-R06 `tools/terminal-readability/check-static.mjs:9-28`；当前 `controlledKeyboardHarness.tsx` 位于两个 App 的 `src` 根目录外侧文件位置 `App.tsx` 同级引用。
- 验收判据：详设按 CP 冻结每步的完整文件集合、先后依赖和中间 graph；每步结束时 package.json、package graph、source import、checker fixture、README/README anchors、lockfile 的状态都能过指定门；明确 harness 的合法 `src/testing`/其它目标并让新 import 与 production-bundle边界一致；安装命令必须锁文件不漂移（除本步预定 workspace 条目），并记录 install-state 变化。若当前额外 baseline 红阻止三道门，按 M-3 的分类门处理，不能以延长 timeout 代替。

### S-7 · AC-3 的“具体 gate+报文”要求已有方向，但换靶清单仍可空过

- 类型：仓内事实 / 推论。
- 文档位置：需求 AC-3 `...formal-requirements-claude.md:224-229`；方案 §5 `...solution-claude.md:124-130` 与 §9 `:198-200`。
- 事实与反例：方案只说把 skeleton/ui-state fixtures 换成“仍然违反该规则的现存包”，没有指定替代 fixture、构造差异、预期 gate ID 和 exact message；`plannedDependencies` 又写明“没有专门的测试”。若替代 fixture 同时触发 graph comparison 或层违规，测试可能在错误原因下变红，删除 `plannedDependencies` 机制则没有红控制。
- 证据：现有 fixture 入口 `tools/terminal-skeleton/check-static.test.mjs:727,731,844`、`tools/terminal-ui-state/check-static.test.mjs:138`；被测实现 `tools/terminal-skeleton/check-static.mjs:460-468,600-613`；方案 `:124-130`。
- 验收判据：每个红测试列出输入文件、唯一故意变异、预期 gate 名、报文前缀和恢复步骤；用例先在基线 fixture 上正向通过，再仅施加目标变异得到目标 gate 红；删除 `plannedDependencies` 后增加“旧机制不存在/不会影响 graph”的静态反例或明确 `NOT_APPLICABLE_WITH_REASON`，不得用任意 checker 非零作覆盖。

## 4. 方案合理性

方案的方向本身是合理的：

- 用顶层 `application` 与包内组合语义 `assembly` 分开，符合 Dexter 原文，也避免了把 `src/assembly`、`createXxxAssembly` 和 `assembly-rejection` 误改。
- D-1（Kotlin full name 随 application 层改名）是机械且可由编译/自动链接暴露的变更；保持 `applicationId`、持久化键和 `LOG_TAG` 不变是正确边界。
- D-2 只改共享基础设施包内的 `Console*`，保留 integration 自有组合名，方向正确。
- D-3 是最小合并：当前五个类型已经在 `platform-ports` 根出口，test-support 没有生产实现；三个 feature 改为 dev-only 直接消费 platform-ports，不会因为合并而新增 production 依赖。
- D-4 采用仓外持久保留、不用 `/tmp`，比直接删除更可恢复；但必须补齐 S-4 的可恢复 manifest。
- D-5 按 Dexter 当前授权保持 harness 字节不变可以接受，但必须把 TR-08 风险明确留为本批 OPEN，不能借静态包整理把它写成已解决。
- 四步从基线、空壳、共享包改名到 application 层改名，原则上能缩小每步影响面；但在 M-3、S-6 的中间态和基线口径未冻结前，不能宣称“每步安装后过三道门”可执行。

因此，本方案不是方向错误，而是“结构决策已闭合、证明接口尚未闭合”。当前不适合直接进入详设/实施；详设可以开始，但必须先把 M-1 至 M-3 的验收输入与 S-1 至 S-7 的边界写成可执行条件。

## 5. 决策与正本关系逐项判断

| 项目 | 独立判断 | 需要的收口 |
|---|---|---|
| D-1 Kotlin 包名随层改名 | 合理，非产品语义 | AC-9 明确全名集合、自动链接生成文件和 applicationId 不变 |
| D-2 包内 Console 标识改名 | 合理，需保留 integration 自有组合 API | 用 AST/导出清单生成 forbidden set，不用过宽字符串替换 |
| D-3 test-support 并回 platform-ports | 合理，当前已有五个根类型出口 | AC-5 证明只改变三个 feature 的 dev import，不改变 platform-ports production index |
| D-4 线下移出不删除 | 合理且可恢复 | 补 S-4 的外部 manifest/hash/restore 证据；不使用 `/tmp` |
| D-5 harness 原样搬位 | **DEXTER_DECISION 已存在，当前可接受** | 记录 `TR-08=OPEN/OUT_OF_SCOPE`；不得把 bundle gate 结果升格为该问题关闭 |
| TR-08 保留 automation token | 合理 | AC-2 允许点号/npm 两种 token 只出现在守卫/夹具，并单独保留负向测试 |
| TR-16/TR-17、AGENTS/CLAUDE/skills 同步 | 方向正确但范围不完整 | 纳入 `terminal-coding-standard.md:974`、三个 skill 实际命中行和 active memory supersession |
| 批次决策文件只追加取代说明 | 对历史记录是正确的 | 对 `status: active` memory 必须追加 normative override 并同步 assertion/index；不能只追加一条无人路由的注释 |

这里没有新增产品或 Journey 裁定；涉及 D-5 的范围继续沿用 Dexter 已授权决定。若后续要在本批改变 harness release 语义，必须另立 Dexter 授权，不应在详设中自行扩 scope。

## 6. 独立 critic 结果

已使用一个 fresh、只读、无写入/无构建/无安装/无设备的 critic 子 agent 对同一组需求、方案、源码和工具做盲审：

- reviewer：Carson，`01a0d3c6-6233-7020-be2f-1a79d3e96850`
- verdict：`NO-GO`
- M/S/N：`2/2/1`
- 其确认的交集：AC-8/AC-10 的细节不足、忽略产物分母不完整、D-5 与 TR-08 的冲突、三空壳无生产消费者、ui/base/test-support 可合并、当前三项源码基线事实成立。

本文件的 `M/S/N=3/7/3` 在该独立结果之上加入了主 agent 实际执行静态门后确认的全量基线冲突、active 正本/memory/skills 漏项、D-4 恢复证据、步骤中间态和 AC-3 换靶可执行性 findings；没有把 critic 的意见直接当作已证事实。

## 7. 交付结论

`REVIEW_TARGET=DESIGN`，`VERDICT=NO-GO`，`M/S/N=3/7/3`。

GO 前至少需要在详设/实施计划中关闭：

1. AC-8 的快照、映射、允许差异和红变异；
2. AC-10 的具体 partKey、Web/设备操作和逐行证据格式；
3. 当前静态门基线的分类与第 0 步是否可进入的明确门；
4. AC-2 的 active 文件分母及 composition/application 区分；
5. AC-9 的自动链接清单和签名证据命令；
6. active 正本、memory、skills 的精确同步清单；
7. D-4 恢复 manifest、D-5 TR-08 OPEN 口径、四步中间态与 AC-3 红测试。

本评审不授权源码改名、包下线、依赖安装、构建、动态验证或设备操作。
