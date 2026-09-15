# TER sample 基础设施上收 base · 详设与 B1–B4 实施计划复评(第 2 轮)

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
REVIEW_KIND=Codex 与 Claude 经 Dexter 中转的独立对抗评审(轮次由 Dexter 决定,见 AGENTS.md:72)
REVIEW_ROUND=2(仅作序号;本轮核实"上一轮 9M/22S/12N 是否真正关闭",不是第一次盲审)
reviewerKind=INDEPENDENT_SUBAGENT(5 个 fresh 子 agent 分维度盲审)+ 编排会话合并与亲验
EVIDENCE_TIER=static;未执行任何构建、测试、Metro、Web、Android、设备或 git 命令
被审输入(sha256 前缀):
  详设  doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-design-codex.md  1416460a698f(917 行)
  计划  doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-implementation-plan-codex.md  1c9b320652f3(627 行)
  需求  doc/plans/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-requirements-claude.md  03f5fb777582(746 行,v3.4,Dexter 已 GO)
上一轮评审:doc/review/platform/2026-09-14-v2s-terminal-sample-infrastructure-uplift-design-plan-review-claude.md(9M/22S/12N)——本轮只作待核输入,不采信其结论
```

下文【详设】【计划】【需求】指上列三份文档,冒号后为行号。

## 0. 结论块

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取
VERDICT=NO-GO
M/S/N=3/6/5
L1_ENGINEERING=findings:M-1、M-2、M-3;S-1、S-2、S-3、S-4、S-5、S-6
L2_USER_VISIBLE=findings:S-4(system notice 恢复机制)、S-5(D-9 矩阵矛盾);其余用户不可见
L3_UNVERIFIED=见 §6
SAME_ROOT_SCAN=见各 finding 的同族全集扫描
DESIGN_GAPS=M-1(需求 R-E6 本身方向错误,需再出一次需求侧勘误);其余为详设/计划侧缺口
EVIDENCE_TIER=static;本评审不构成 implementation acceptance,也不构成 visual、Web 或 release PASS
FLOW_GAP(非本轮 finding,如实记录)=Codex 侧 fresh 独立子 agent 对抗审查(治理决定文件规定的那类)与本轮 Dexter 中转的 Claude 复评是两道不可互替的门;前者至今未发生,本轮 GO/NO-GO 不能替代它
```

## 1. 评审方式与独立性

沿用第 1 轮的分维度切分:A 依赖图与运行期依赖;B 开机画面与 release 证据;C 身份/资产/根配置与启动诊断;D picker 与回归矩阵;E 计划完整性与授权。每路 fresh 子 agent 只核"上一轮对应 finding 是否真正关闭",逐条给出 CONFIRMED_CLOSED / PARTIALLY_CLOSED / STILL_OPEN / REGRESSED,并允许报告本轮新发现。编排会话(本会话)在 5 路子 agent 全部返回后,对每一条 PARTIALLY_CLOSED 及以上的 finding、以及全部新发现,重开被审文档与 owning source 逐条核实;对分歧较大或影响面广的点(D-13 锚点、U8 排期矛盾、B0 双点修复方向、release 证据先例可行性)做了额外的独立复核。

**利益披露**:编排会话是需求稿(3 个版本、7 处勘误)与第 1 轮复评文件的作者。本轮对需求侧问题(M-1)的判定同样来自独立子 agent 与编排会话的亲验,不是自证。

## 2. Findings

### M-1 需求 R-E6 本身方向错误:B0 按现有门的实现无法通过"同时改 graph 边与 dependencies.ts 数组"收口

- **状态**:CONFIRMED(编排会话独立发现并完整验证,不来自任何子 agent 的原始报告;子 agent C 路 S-13 发现了"计划的'双点'定义与需求 R-E6 字面不一致"这一半,编排会话在其基础上继续下钻,发现即使按 R-E6 字面执行,门依然会红)。
- **仓内事实**(逐行核实):
  - `ui/feature/sample-wallpaper-picker/package.json` 的 `devDependencies` 字段已含 `@catering-v2s/kernel-base-platform-ports`(字段正确,不是 `dependencies`);
  - `src/dependencies.ts` 的 `devDependencyModuleNames = [] as const`(空);`skeleton-graph.ts` 该节点的 `devDependencies: []`(空)——这两处是真正与 package.json 不一致的地方;
  - 该包 `src/` 目录下对 `platform-ports` **零命中**;`test/sampleWallpaperPicker.test.tsx:8` 是**唯一**引用点,且是 `import type {...} from '@catering-v2s/kernel-base-platform-ports'`——纯类型导入,不是值导入;
  - `tools/terminal-skeleton/graph-model.mjs` 的 `collectStaticImportSpecifiers` 只扫 `src`(及存在时的 `test-expo`),**从不扫 `test/`**;
  - `tools/terminal-skeleton/check-static.mjs` 的 `runGraphComparison` 对每个包顺序执行四类 `assertEqualSet`:① package.json `dependencies` vs graph `dependencies`;② `plannedDependencies`;③ package.json `devDependencies` vs graph `devDependencies`;④ **`declaredWorkspaceDependencies`(package.json 的 `dependencies`+`devDependencies`+`peerDependencies`+`optionalDependencies` 四个字段合并,不分种类)vs `sourceImports`(仅 `src/` 收集)**,要求完全相等;
  - 今天的首败正是第③步(package.json 比 graph 多一个 `platform-ports`)。若 B0 只按 R-E6 字面把 graph 的 devDependencies 与 `dependencies.ts` 数组都补上 `platform-ports`,第③步会通过——但第④步会立刻失败:`declared` 集合含 `platform-ports`(来自 package.json),`sourceImports` 集合不含(因为只在 `test/` 被 type-only 导入,门看不见),两者不相等,`graph-comparison` 会以**不同的错误信息**继续红;
  - 编排会话检索全仓"devDependency 声明但仅在 `test/` 使用"的形态,**未发现任何包能在这种组合下通过该门**——不是 picker 一个包的偶然,是 `runGraphComparison` 的第④步在设计上就不认可"仅测试使用的 workspace 依赖"这个形态,不区分 regular/dev。
- **失败场景**:Codex 若严格按需求 R-E6"同时改 graph 边与该数组"执行 B0,`graph-comparison` 门会从"devDependencies 不等"变成"source imports 不等"继续红,B0 无法收口,B1–B4 全部因 §4.0 前置条件 2 未满足而不能开工。
- **影响面**:B0 是全部批次的前置条件,此项不修,后续设计与计划无论多完善都无法进入实施。
- **最小修复**:B0 的正确改法是**从 `package.json` 的 `devDependencies` 删除这条声明**(而不是往三处填充),同步保持 graph 与 `dependencies.ts` 数组维持现状的"不声明"。删除后测试文件对 `platform-ports` 的类型引用能否正常解析(Yarn workspace 提升机制下大概率可行,但未验证),以及是否有更合适的改法(如把该类型改从别处引入、或判断这条测试依赖是否本就多余),留给 Codex 详设裁定。
- **为什么不是更小的修法**:不能只改需求措辞了事——需求 R-E6 的"根因"判断本身就指错了方向,若不连带改正,Codex 后续任何一次重读需求都会被引回错误路径。
- **是否需要 Dexter 裁决**:不需要。这是需求作者的事实错误,需求作者(本会话)将在需求稿上再出一次勘误(R-E6 的修订版),不改变批准范围与产品语义。

### M-2 需求 B4 的 ui/feature 骨架上收仍未定 owner,处置表引用的锚点是错的

- **状态**:CONFIRMED(来源 E 路;编排会话重开详设 §9.4 与处置表逐行核实)。
- **仓内事实**:
  - 【详设】处置表 M-07 行(:102)写"落点:D-13、B4、§9.2";
  - 【详设】§9.4 D-13(:645-660)标题就是"App 壳",全文讲的是 `assembly/android/*` 的 `index.ts`/`App.tsx`/`src/assembly/platformPorts.ts` 三个薄壳文件与它们的运行期 import 规则,**与 `ui/feature` 的 `module.ts`/`assembly.ts` 骨架上收完全无关**;
  - 详设 CP-4 行(:171)与横切机制表(:193)确实把"module/assembly shared skeleton"列为产出与不得复制项,但**全文没有任何一个 D 编号小节**回答"目标包是谁、API 形状是什么、三个消费者(`sample-staff-auth`、`sample-member-desk`、`sample-wallpaper-picker`)怎么迁"这些问题——这正是上一轮 M-07 finding 本来要问的。
- **失败场景**:实施方按处置表指引去读 D-13,找到的是一份与本任务无关的 App 壳规范,会误以为骨架上收已经设计完毕,或者转而自己现场决定 owner 包,产生与其他批次不一致的设计。
- **最小修复**:补一个新的 D 编号小节(或扩充 CP-4 一节),给出目标包(建议与 `requestOutcome`/notice 同置于某个 `ui/base` 包,或新开一个专职包)、公开 API 形状、三个消费者的迁移步骤;处置表的锚点改指向该小节,不再引用 D-13。
- **是否需要 Dexter 裁决**:不需要,属详设应补的设计细节。

### M-3 全局章节要求"三类对账先于动态运行",两处子章节又把 release 证据排回收口之前——原 M-08 问题的复发

- **状态**:CONFIRMED(来源 E 路;编排会话重开【计划】§4.3、§5.3、§9.2 与【详设】D-8 表逐字核实)。
- **仓内事实**:
  - 【计划】§9.2(:488-495,whole-scope reconciliation)与【详设】D-8 表 U8 行(:497,"final acceptance after B4")都正确要求:全批三维对账排在任何动态运行之前;
  - 但【计划】§4.3(B2 测试清单,:236-240)原文:"最终 release/手机/双屏冷启动证据需在 **B3/B4 closure 前**按需求分档完成";
  - 【计划】§5.3(B3 测试清单,:286-291)同样把"U8 final:release/手机/双屏冷启动记录"列为 B3 阶段的证据清单项,且给出了完整的 t0/t1/t2 记录要求——即这段文字明确要求该证据在 B3 收口时就已经产出;
  - 两处子章节与 §9.2/D-8 的先后顺序**直接矛盾**:子章节说"B3/B4 关闭前做完",全局章节说"B4 之后、对账之前才排 final"。
- **失败场景**:实施方读到 §4.3/§5.3 时会在 B2/B3 阶段就去跑 release 冷启动设备观察,把这份证据当作 B3 收口条件;而全批三维对账届时会发现"B1/B3 是否留下第二套 runtime exclusion"等跨批次偏移前,动态证据已经产出并可能已被当作既成事实——这正是 AGENTS.md 要求"步骤级/全批对账先于动态运行"要防止的形态。
- **最小修复**:统一口径——B2/B3 阶段只产出静态与 focused 证据、`U8 supporting`(record 模式的 B2 部分),`U8 final` 的完整 release 双形态记录明确排在 B4 收口且全批三维对账完成之后,删除或改写 §4.3/§5.3 里"B3/B4 closure 前完成"的表述。
- **是否需要 Dexter 裁决**:不需要。

### S-1 D-1 的检查器谓词比需求 R-E1 字面更宽松,跨平台误连不可达红夹具

- **状态**:CONFIRMED(来源 A 路;编排会话核实 R-E1 原文与 D-1 predicate 逐条对照,并核实仓内确有 `adapter/android`、`adapter/electron`、`assembly/android`、`assembly/electron` 四个真实平台目录)。
- **仓内事实**:需求 R-E1 要求"目标的平台段(moduleName 第二段)与源一致";【详设】§6.1 predicate 第 3 条(:209-210)写"adapter target **永不**因'非 base'被本 predicate 禁止"——不分平台,只要目标层是 adapter 就一律放行。红夹具清单(:236-241)也只给了"同平台"的绿色对照,没有跨平台的红色对照。
- **失败场景**:`assembly.base.android` 若误依赖 `adapter.electron.*`(或反之),该 predicate 判绿,U11 判据测不出来,需求 U11 的绕过形态里也没有列出这一种,是需求与详设共同的留白。
- **最小修复**:predicate 第 3 条加一句"且目标 moduleName 第二段与源 moduleName 第二段相同";红夹具补一条跨平台依赖必须判红的用例。
- **是否需要 Dexter 裁决**:不需要。

### S-2 计划里一条"哪个门会红"的断言与实际实现矛盾,且与同一批文档的详设表述不一致

- **状态**:CONFIRMED(来源 A 路;编排会话重开 `runGraphComparison`/`readPackageCensus` 源码与【计划】§3.2、【详设】§6.2 对照表逐行核实)。
- **仓内事实**:
  - 【计划】§3.2 B1.1 行(:172)写"删除一个 root workspace declaration...时 graph comparison/coverage 红";
  - `tools/terminal-skeleton/graph-model.mjs` 的 `readPackageCensus` 是纯文件系统遍历(`readdirSync` 逐层枚举包目录),**不读根 `package.json` 的 `workspaces` 字段**;`runGraphComparison` 的全部 `assertEqualSet` 都基于这份 census,与根 workspaces 声明无关;
  - 全仓检索"coverage"作为检查名,**零命中**——这不是现存检查器的名字;
  - 【详设】§6.2 D-2 表在同一问题上写得更准确:"root workspace 漏项不由文件 census 冒充已发现,必须由 workspace/turbo 观察或 fresh review 明确兜底"(:271-272)——与计划的错误表述形成同一批文档内的自相矛盾,也正是上一轮 S-21 要求"预期中间报错必须验证过"这条本身被违反的样本。
- **失败场景**:实施方按计划的错误描述,以为漏加 root workspace 时 `graph-comparison` 会红、能被这道门兜住,实际上不会,真正能发现漏项的只有 Turbo dry-run 或 fresh review。
- **最小修复**:计划 §3.2 B1.1 行改为与详设 §6.2 一致的表述,删除"coverage"这个不存在的检查名。
- **是否需要 Dexter 裁决**:不需要。

### S-3 Dexter 裁定④的豁免条件(先核实先例、核不过才新建)未被履行,详设把核实动作推给了实现阶段;编排会话独立复核先例后确认它大概率核不过

- **状态**:CONFIRMED(来源 B 路;编排会话独立重开两份先例源码验证)。
- **仓内事实**:
  - 需求裁定④原文:"复用 `tools/terminal-sample2/run-a9-runtime.mjs` 先例做一次记录式观察,不新建受管 runner;**除非该先例经详设核实无法驱动本判据所需的双形态冷启动观察,才升级为新建**";
  - 【详设】§6.5(:391-392)与【计划】§4.3(:236-240)都把"若脚本无法驱动双形态,先保留失败日志...再向 Dexter 请求是否新建 runner"这句话原样保留,即把"核实"这个动作本身推迟到了 B2 执行阶段,详设阶段没有真正做过这次核实;
  - 编排会话直接重开仓内最接近的两个先例:
    - `tools/terminal-sample2/run-a9-runtime.mjs`:机制是 `yarn start` 拉 Metro dev server + `adb reverse` + 对已装 debug 包 `monkey` 冷启动;SECONDARY 形态靠**源码 mutation** 硬改 `displayIndex` 伪造,不是真实双物理屏;只覆盖 `sample-wallpaper-terminal` 一个 App;日志过滤关键字里没有任何 splash 相关项;
    - `tools/terminal-android-dual-screen/check-behavior.mjs`:名字含"dual-screen",实际是 `spawnSync('./gradlew', [':...:testDebugUnitTest', ...])` 调起的**纯 Gradle JVM 单元测试**,通过源码字符串替换验证分类器,**不启动设备、不涉及 adb、不产生任何可观察的屏幕状态**;
  - 两者均不具备"release 构建 + 真实双物理屏 + 冷启动"的能力,且详设/计划全文只提及"dual-screen"1 次(指向真实 adapter 消费者),从未比较或引用过这个仓内唯一名称含"双屏"的既有工具。
- **失败场景**:若把裁定④的"复用先例"直接当作已核实通过来推进,B2/B3 阶段实际执行时才会发现 `run-a9-runtime.mjs` 需要的改动(去 Metro 依赖、改用已装 release APK、覆盖第二个 App、用真实双屏而非源码 mutation、新增 splash 信号采集)体量已接近重写而非"扩展",到那时才回头找 Dexter 走"升级为新建"这条路,会比在详设阶段先说清楚多绕一圈。
- **最小修复**:详设直接给出核实结论——按上述两份源码的机制差距,`run-a9-runtime.mjs` 大概率不足以"扩展"到位,应在详设里明确列出需要新增的能力清单(release 包驱动、双 App、真实双屏而非 mutation、splash 信号采集),并据此向 Dexter 说明是否满足"升级为新建"的条件;不需要现在就真的新建,但核实结论应该在详设阶段写清楚,而不是留到 B2 才发现。
- **是否需要 Dexter 裁决**:是——裁定④的"先例是否够用"这个事实判断本该在详设阶段完成,现在编排会话已经把大概率的判断摆出来,请 Dexter 确认是否接受"按此详设结论,大概率需要升级为新建,新建范围见上述清单"这条路径,还是要求 Codex 先实际跑一次先例、拿到第一手失败证据再定案。

### S-4 system notice "冷重启不恢复"的裁定已被一致引用,但没有任何机制说明如何阻止它被持久化

- **状态**:PARTIALLY_CLOSED,记为 finding(来源 D 路;编排会话核对 `workspaceSlices.ts` 与详设/计划全文检索确认)。
- **仓内事实**:`kernel/base/ui-state/src/foundations/workspaceSlices.ts` 的 `serializeLayers`/`parseLayerEntries` 完全通用,不按 part 类型过滤,今天会把全部浮层(含三个 system notice)原样序列化并在冷重启后恢复;详设/计划全文检索 `serializeLayers`/`persistIntent`/`ephemeral`/`transient` 等关键词,只有一处 FORBID 声明("system notice 不进冷重启恢复")与相应的测试断言要求,**没有任何一处说明具体用什么机制**(新增字段区分持久层级?改用 `persistIntent`?按 partKey 在恢复时过滤?)实现这条 FORBID。
- **失败场景**:实施方在 B4 落地时,若按现有 `serializeLayers` 的通用逻辑不做任何改动,system notice 会被冷重启恢复,直接违反已经裁定的产品行为,而详设/计划本身给不出实现路径,容易导致临时拍脑袋的实现,还可能误伤 sample2"未确认选择需要恢复"这条既有规则的实现方式。
- **最小修复**:详设补一段机制设计——建议方案是给浮层元数据加一个持久层级标记(如 `persistIntent: 'durable' | 'ephemeral'`),`serializeLayers` 按该标记过滤,system notice 的 part 声明为 `ephemeral`;或等价的其他机制,但必须写清楚,不能只停留在"不恢复"这句产品裁定上。
- **是否需要 Dexter 裁决**:不需要,属详设应补的机制设计。

### S-5 D-9 回归矩阵在详设与计划两份文档之间互相矛盾

- **状态**:PARTIALLY_CLOSED(来源 D 路;编排会话核对两份文档的 S1/WP/PF 三张表)。
- **仓内事实**:
  - 【计划】§8.1 的 S1-11/S1-12 与【详设】§8.1 对照,详设有"冷重启已确认/未确认核验"与"logout 清双屏残留层"两个场景,计划里这两个场景丢失,被年龄相关子项重复占位替代;
  - sample2 WP 系列:【详设】§8.2 的 WP-01~09 是正常旅途,【计划】§8.2 的 WP-06~09 却写成"child failure before/after write"这类失败注入内容——直接违反需求 D-9"U10 正常旅途与 U13 失败注入须分栏,不得重复或遗漏"的约束;
  - PF 编号在两份文档里完全对不上:同一个 `PF-06`,详设指"notice 后冷重启",计划指"retry resolved"。
- **失败场景**:实施方对照矩阵编号核对测试覆盖时,会因为两份文档编号语义不同而产生虚假的"已覆盖"判断,真正的场景(如冷重启已确认核验、logout 清残留层)反而被漏掉。
- **最小修复**:以详设 §8 为唯一权威,计划 §8 改为直接引用详设的编号与场景,不再自行编号或改写内容;若计划确有理由要调整某个场景的验证方式,须保留详设的编号与场景描述,只在验证方式列另作说明。
- **是否需要 Dexter 裁决**:不需要。

### S-6 身份/资产检查器仍缺两项设计,需求 D-6 追问的问题仍未正面回答

- **状态**:PARTIALLY_CLOSED(来源 C 路;编排会话核对详设 §6.6 全文)。
- **仓内事实**:详设 §6.6(D-6)已解决上一轮 S-12 的大部分问题(ST 孤儿资产处置、WP README 自身如何处理、"被原生资源引用"空类别、逐 `.kt` 文件检查),但仍缺:① "App 发现规则"与"空输入守卫"——检查器如何枚举"App"、如何避免空输入误判通过、是否显式排除 `assembly/base/android`,全文未写;② 需求 D-6 原文追问的"原生 splash drawable 是否已由 Android 资源编译兜底",仍未见正面回答。
- **最小修复**:补这两点,不需要新的章节,在 §6.6 现有表格里各加一行。
- **是否需要 Dexter 裁决**:不需要。

### Notes

- **N-1**(来源 D 路,编排会话未逐一复核全部消费点):【计划】§6.2 第 1 点称现行 `requestOutcome` 分类逻辑位于 `kernel/base/runtime/src/application/requestOutcome.ts`——该路径下 `application/` 目录实际只有 `createInternalRuntimeModule.ts`、`createRuntime.ts`、`moduleManifest.ts`;真实文件在 `ui/feature/{sample-staff-auth,sample-member-desk}/src/components/requestOutcome.ts`,与需求 §3.4 的迁移目标 `ui/base/render` 也不是同一路径。属引用路径错误,建议下一版逐处核对详设/计划里新增的锚点,不只是复用旧锚点。
- **N-2**(来源 B 路,编排会话核对详设 §9.4 附近文字):R-S7(终态失败收起、显示失败页)的机制已在 §6.5 写清 owner、触发条件、testID 与文案,但缺一个专属编号的实施步骤(如 B2.3/B3.4 那样),目前只在 B3 的 U8 证据描述里带过一句"捕获 assembly rejection 并调用 hideOnce"。建议补一个显式步骤。
- **N-3**(来源 E 路,编排会话未独立复核):B1–B4 每批都有"由 fresh 独立子 agent 做 stage reconciliation"的专属步骤编号(B1.6/B2.6/B3.6/B4.6),唯独 B0 全程只写"主 Codex"执行,CP-0 门控卡片的 FORBID 也没有这条约束。材料性较低(B0 是纯静态基线修复),仍建议补齐,保持批次间一致。
- **N-4**(来源 E 路,编排会话核实属实):处置表本身出现了新的同型错误——上一轮 N-10 指出的两处锚点误引已修正,但本轮处置表在 M-07 一行又引用了错误的 D-13 锚点(见 M-2)。这不是独立新问题,是同一类错误(改错处引对锚点)在不同位置的复发,记录为提醒。
- **N-5**(来源 C 路,编排会话核实属实,影响很小):详设 §9.2(D-11)tsconfig.json 一行写"若必须 include 由需求列出的 integration path 说明"——需求 §3.1 从未对 tsconfig 列出过任何 integration path(该措辞只用于 metro 的 `global.css`),且两 App 的 `tsconfig.json` 今天 `diff` 退出码为 0(逐字相同)。这个"若必须"分句缺依据,建议删除或改写为"无"。

## 3. 已确认关闭的原 finding(不再展开,供交叉核对)

M-02(D-12 分类表)、M-03(picker 两跳,设计层机制)、S-01(注册顺序)、S-02(PRIMARY 重定义+6 种 fallback)、S-04(D-5/D-10 单一分支)、S-05(就绪机制批次落点)、S-07(5 工厂+sample-console)、S-08(U2 夹具)、S-14(B4 只依赖 B1)、S-17(notice 身份 3×5 testID)、S-18(请求生命周期与 sample1 一致)、S-20(自检表诚实标注 OPEN)、S-21(原子组顺序,除 S-2 同根残留)、S-22(CP 门控卡片六要素齐全)、N-01(3 条新跨 batch 边已列出)、N-02(D-10 app-control/logger 处置一致)、N-11(元数据与路径引用准确)。均经子 agent 与编排会话交叉核实。

## 4. 同族全集扫描汇总

- M-1:全仓检索"devDependency 声明但仅 `test/` 使用"形态,除本例外未发现其他成员,该问题是这一个包独有,已核对完毕。
- M-2/N-4:详设全部 14 个 D 编号逐一核对处置表引用是否对应正确章节,仅 M-07 一处(D-13)错配,其余 13 处引用准确。
- S-1:仓内平台目录共 4 个(`adapter/android`、`adapter/electron`、`assembly/android`、`assembly/electron`),跨平台组合共 4 种可能误连方向,详设 predicate 与红夹具均未覆盖,已核对完毕。
- S-3:仓内含"dual-screen"/"a9"/"run-a9"字样的可执行脚本已逐一定位(`run-a9-runtime.mjs`、`check-behavior.mjs`),均不具备目标能力,已核对完毕;不排除仓内还有编排会话未检索到的第三个先例,已列入未验证清单。
- S-4:持久化浮层同族共 8 个(第 1 轮评审 S-16 的统计),其中 system notice 3 个,均受本条影响。
- S-5:S1/WP/PF 三张表逐项比对,详设与计划两侧内容;其余章节(除矩阵表本身)未做逐句 diff,列入未验证清单。

## 5. 方案合理性

上一轮 9M/22S/12N,本轮降至 3M/6S/5N,且绝大多数关闭是真实的机制改动(检查器 predicate 具体化、批次落点补齐、release 证据分档写实、CP 门控卡片六要素齐全),不是换词稿——E 路子 agent 独立给出的这一判断,编排会话抽样核实后认同。

真正的问题集中在两类:① 需求稿自身仍有事实错误(M-1),这是本会话作为需求作者的责任,不是 Codex 的问题;② 全局设计正确、但局部子章节没有跟着同步更新,导致"写对的地方"与"写错的地方"并存于同一份文档(M-3、S-2 都是这个形态)——这提示 Codex 下一轮修订后,应该对改动过的全文做一次纯文本关键词自查(如 grep 涉及顺序、批次归属的关键句),而不是只信任某一节"总览"或"处置表"的存在。

代价与当前阶段匹配,未见过度设计;S-3 指出的证据链问题(先例是否够用)如果 Dexter 选择"先实跑再定案",会引入一次真实的设备验证成本,但这是需求裁定④本身要求的核实步骤,不是评审强加的。

## 6. 未验证清单

**静态已证**(本轮子 agent 与编排会话共同核实):M-1 的完整证据链(package.json 字段、`src/`/`test/` 导入分布、`collectStaticImportSpecifiers`/`runGraphComparison`/`declaredWorkspaceDependencies` 源码逻辑);M-2 的 D-13 内容与处置表引用不符;M-3 的 §4.3/§5.3 与 §9.2/D-8 文本矛盾;S-1 的 predicate 文本与仓内平台目录;S-2 的 `readPackageCensus` 实现与"coverage"零命中;S-3 的两份先例脚本机制;S-4 的 `serializeLayers` 通用性;S-5 的矩阵表内容对照;S-6 的 §6.6 缺项;N-1 至 N-5 各自引用的源码位置。

**无人验证**(需要动态/设备证据,产品负责人可据此决策):删除 `package.json` 该条声明后,测试文件能否正常解析(M-1 修复方案的可行性);两个 App 是否真的会在 release 构建、双形态冷启动下正确显示/收起开机画面(需 S-3 裁决后才能安排验证);system notice 的持久化过滤机制(S-4)实现后是否真的观察不到冷重启恢复;D-9 矩阵(S-5)统一后是否真的覆盖全部冻结旅途步骤;身份/资产检查器补全 S-6 两项后能否被真实红夹具验证;Codex 侧 fresh 独立子 agent 对抗审查(§0 FLOW_GAP)是否会在实施前补做。

## 7. 授权边界

本评审只判断需求、详设、实施计划与当前 owning source,不授权修改源码、测试、依赖、脚本或构建产物,不授权任何构建、Metro、Web、Android、设备、DEV、seed、UAT 或部署动作,不构成 implementation、visual、Web、Android、release 或 cleanup PASS。此处 GO/NO-GO 只代表详设与实施计划是否可交 Dexter 决定下一步;NO-GO 时,修订完成后是否再次复评由 Dexter 决定。
