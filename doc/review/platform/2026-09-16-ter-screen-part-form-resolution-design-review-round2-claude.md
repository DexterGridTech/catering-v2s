# TER screenPart 机型解析 · 详设 / IA / 实施计划复评(第 2 轮)

```text
REVIEW_TARGET=DESIGN
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN + IA + PLAN;Codex 与 Claude 经 Dexter 中转的 review
reviewerKind=CLAUDE_DIRECT(按项目记忆"分析类任务主 agent 自己做,不派子 agent")
EVIDENCE_TIER=static;只读文档与当前源码,未执行任何构建、测试、Web、Metro、Android、设备或部署命令
被审输入(sha256 前缀 / 行数):
  详设 doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md 7eb472e9357d / 473
  IA   doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-ia-design-codex.md 8e0340dda678 / 215
  计划 doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-plan-codex.md 9afa67451672 / 339
上一轮:doc/review/platform/2026-09-16-ter-screen-part-form-resolution-design-review-claude.md(NO-GO 2M/5S/3N)
```

下文路径以 `apps/terminal/` 为根时省略该前缀;`doc/` 从仓库根写。行号为评审时当前字节。

## 0. 结论

```text
VERDICT=NO-GO
M/S/N=1/1/1
上一轮 9 条(2M/5S/3N)全部真关闭,逐条核实见 §1
本轮新增 1 个 Major:S-3 的修复本身引入了一条与仓内源码相反的承重事实
DEXTER_DECISION=无(M-4 是事实错误,不是产品语义分歧)
GO 只会表示三份文档可交 Dexter 决定是否进入实施;不构成任何运行档位的 PASS
```

**上一轮九条确实都修了,而且有三处修得比我要求的更好。** 本轮 NO-GO 只因为一处:S-3 把"当前预期"升级成"源码事实"时,那条事实是错的,而它正是 U-6 与 Dexter 裁决⑤的承重夹具。

## 1. 上一轮九条的关闭核验

逐处开文件核字节,不采信 §19 的处置表。

| 上轮 finding | 状态 | 我核到的依据 |
|---|---|---|
| M-1 跨层 declaration metadata 通道 | **真关闭,且强于要求** | 通道在详设 `:53,:162,:218,:314,:316,:401` 与 IA `:150,:188` 全部删除,统一为 `hydrated-container-not-renderable`;更进一步,详设 `:120` 把"实现者若恢复该通道或拆回 `hydrated-container-other-form`,设计对账必须红"立成 CP-2 门,IA `:192` 同步。我只要求删除,他把它变成了可被红夹具捕获的约束 |
| M-2 裁决④无执行体 | **真关闭** | 详设 `:302` 写出独立时序段落;`:362` 的 U-5b 点名 `ui/base/render/test/renderSurface.test.tsx` 与用例名,要求"先 content failure 就绪、无 system page → 不重置 ready、不重新挂载地注入 system failure → 断言运行期标题与 testID 并与启动期区分"。绕过列明写"仅读取 `failureStage` 的默认结果不算执行体"——正好堵住我指出的"什么都不做就通过" |
| S-1 U-4b 没点名、未评估覆盖 | **真关闭,且走了正确分支** | `:360` 逐文件逐用例点名 `ui-state/test/acceptance.test.ts`(3 例)、`ui-state/test/content.test.ts`(5 例)、`render/test/renderContracts.test.ts`(2 例)与两个 integration 的 4 例;并判定"当前没有直接挂载 `LayerStack` 的 focused test",因此新增 `render/test/layerStack.test.tsx`。这是我要求的"覆盖不足就补覆盖",不是换判据形式 |
| S-2 R-S1 续段被改成顶层列表项 | **真关闭** | `2026-09-14-…-claude.md` 的 `:342` 现为两空格缩进、无行首短横线,与 `:338`、`:340` 同层 |
| S-3 默认清单仍是"当前预期" | **形式关闭,事实错误** | 已从"当前预期"改写为带 path:line 的源码断言,形式上满足要求;但断言内容与仓内源码相反,见 M-4 |
| S-4 A-2 早于 A-3 却要证 other-form | **真关闭** | 计划 `:285` 的 A-2 行标"U-7b(结构无效/未知段)…不在此步宣称真实 other-form 分支";`:286` 的 A-3 行含"U-7b(filter 后 cross-form recheck)";`:148` 把该 recheck 列进 A-3 的 focused 集合;`:156` 把"提前到 A-2 并宣称真实 other-form 已执行"列为必红 |
| S-5 误引 Web 前端规范 | **真关闭** | 详设 `:80`、`:88` 改为 `N/A_WITH_REASON`,owner 改指 `RenderContext.tsx`、本地 ui-state selectors、`AdminLayer.tsx` 与 terminal primitives |
| N-1 详设自身盲审归属 | **真关闭(状态仍 OPEN,标注正确)** | `:452-453` 新增 `INDEPENDENT_SUBAGENT_REVIEW_REQUIRED=YES`,并明写"不得用作者 readback 或 Claude/Dexter review 冒充该审查"。这是把流程项如实登记,不是宣称已完成 |
| N-2 IA 对账档位前后不一 | **真关闭** | IA `:199`、`:202`、`:211` 统一为"作者自证;独立复核 OPEN",孤立的 `MATCHED by author readback` 已删除 |
| N-3 ready input 公共面未单列 | **真关闭** | 详设 `:217` 在 §9a 单开一行,写明 `partKey`→`readyPartKey:string|null` 与新增 `contentFailure` 是破坏性公共面变更,并点名两个 integration 的 `createStartupReadyPayload` 为直接消费者;`:406` 的 D-9 同步 |

§19 的处置表本身诚实:九行都标 `真修复`,N-1 另标"状态仍 OPEN",S-1 另注"新增测试尚未执行"。没有把部分接受写成完全接受,也没有把未执行的审查写成已完成。

## 2. Findings

### M-4 S-3 的修复引入了一条与仓内源码相反的承重事实

- **状态**:CONFIRMED(自行开文件核字节)
- **设计声称**(详设 `:310`,§19 S-3 行同):"`sample-wallpaper-console` 的 …`actors.ts:50-67` 只在登录/恢复认证时派发 PRIMARY `sample.wallpaper.picker`,匿名路径只尝试 SECONDARY waiting,**因此匿名 PRIMARY 保持空是现有真实生产路径**";并据此让"U-6 的 `readyPartKey=null` 分支用 wallpaper 匿名 PRIMARY 的真实装配路径"。
- **仓内事实**:
  - `ui/feature/sample-staff-auth/src/features/actors/actors.ts:32-37` 的 `showLogin` 向 **PRIMARY / `main`** 派发 `showScreenCommand`,`partKey: 'sample.auth.login'`;
  - 同文件 `:51-60` 的 `createAuthNavigationActor` 在 **`sessionRestoredAnonymousCommand`** 与 `logoutSucceededCommand` 上都调用 `showLogin`;
  - 该 feature 装在两个 integration:`ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:63` 汇总 `...sampleStaffAuthAssembly.parts`,`:83` 的 `createApplicationModules` 含 `staffAuthModule`。
- **推论**:wallpaper 在匿名会话恢复时,PRIMARY 会被 staff-auth 的 feature 级 actor 放上登录页。设计只读了 wallpaper **integration 本地**的 placement actor(它的匿名分支确实只走 SECONDARY),没有穷举同一装配内其他 owner 的 PRIMARY placement——而漏掉的那个文件正是 S-3 自己引用的 `actors.ts`。
- **尚缺证据**:我未验证冷启动时 `sessionRestoredAnonymousCommand` 的派发时序,也未排除存在某条更早清空 PRIMARY 的路径。但举证责任在设计一侧:只要同一装配里有一个 actor 在匿名命令上向 PRIMARY 放 part,"匿名 PRIMARY 保持空"就不能作为既成事实使用。
- **影响**:三处承重物同时失去依据——§12.4 的事实陈述、U-6 的 `readyPartKey=null` 真实路径夹具、以及 Dexter 裁决⑤在本批是否存在真实触发场景。若 wallpaper 匿名 PRIMARY 实际有登录页,则本批可能**没有任何真实的无默认 `container-empty` 生产路径**,`readyPartKey=null` 只能用人造夹具验证——那恰好是上一轮 S-3 要求排除的形态。
- **最小修复**:重做这一处源码核对,穷举两个 integration 装配内**所有**会向 PRIMARY 派发 placement 的 owner(至少包括 staff-auth、wallpaper-console 本地、sample-console 本地三处 actor),再据结论二选一:(a) 若确无真实无默认路径,如实写明 U-6 的 null 分支使用人造夹具,并说明该夹具为何仍代表生产语义;(b) 若确有,给出该路径的精确 owner 与命令时序。不要再以单一文件的局部阅读下全局否定结论。
- **Dexter**:不需要。这是事实核对,不是产品语义。

### S-6 U-4b 要求"既有文件 diff 为空",与 D-1/D-10 要求改造同一文件冲突

- **状态**:CONFIRMED
- **事实**:
  - 详设 `:360` U-4b:"既有回归护栏**逐文件点名并保持其 diff 为空**",点名清单含 `sampleAssembly.test.tsx` 的三个用例;证据档位列再写一次"既有文件 diff 为空";
  - 计划 `:148`:"U-4b 点名的既有 layer **文件保持 diff 为空**",且同一句里同时要求"sample-console 两处 hand-built catalog 测试处置后的 production-path test";
  - 详设 `:398` D-1 与 `:407` D-10:sample-console 两处 hand-built production-name test 必须"改真实 assembly 或明确非生产命名"/"改造、降级"。
- **推论**:那两处手搓 catalog 的测试就在 `sampleAssembly.test.tsx` 内(上一版需求点名为该文件的 `:340-345` 与 `:364-368`)。同一个文件不可能既被改造又保持 diff 为空。按字面执行,U-4b 与 D-1/D-10 必有一条无法满足;实施方会自行挑一条放弃,而放弃哪条无人可查。
- **影响**:U-4b 是本批唯一的既有 layer 行为回归护栏,其分母若被实施方自行解释,护栏就失去意义。
- **最小修复**:把 U-4b 的粒度从**文件**收到**用例**——"点名用例的实现与断言逐字不变",并显式说明 `sampleAssembly.test.tsx` 因 D-1/D-10 会有其他用例改动,文件级 diff 不为空属预期。计划 `:148` 同步。
- **Dexter**:不需要。

### N-4 合并后的恢复文案对"已退役/未知"这一支不成立

- **状态**:CONFIRMED
- **事实**:详设 `:316` 为合并后的 `hydrated-container-not-renderable` 给出示例文案"当前机型无法呈现该恢复记录,已移除本次恢复记录"。
- **推论**:合并的前提是一条文案要同时对两个成因成立。对"其他机型"成立;对"已退役/未知"(part 已从仓库删除)不成立——那与机型无关,照该文案读会把一次正常的下线清理误读成机型问题,正好是需求 R-9 想避免的方向。
- **最小修复**:改用对两支都成立的中性表述,例如"该恢复记录在当前 catalog 中不可呈现,已移除本次恢复记录";文案定稿仍归详设,不必新增 reason。
- **Dexter**:不需要。

## 3. 方案合理性

方向与上一轮判断一致,不重复。本轮只补两点:

- **M-1 的修法值得记一笔**:我要求的是"删掉通道或论证必要性",他删掉之后还把"不得恢复"写成 CP-2 的可红门(`:120`)与 IA 的 OPEN 判定(`:192`)。这比单纯删除更难被后续实施悄悄逆转。
- **S-1 的修法选对了分支**:在"点名清单"与"补覆盖"之间,他发现既有覆盖不足后选择新增 `layerStack.test.tsx`,而不是把判据改写成更容易满足的形式。这正是我上一轮那句"补的是覆盖,不是换判据形式"的意图。

唯一的退步是 M-4:上一版 S-3 处标注"当前预期"是诚实的;这一版把它升级成断言,却没有穷举检索就下了否定结论。**诚实的 OPEN 优于错误的 CONFIRMED** —— 如果穷举成本高,保留 OPEN 并写明待核范围,比给出一个站不住的事实更好。

## 4. UI 与交互强制自问

`NOT_APPLICABLE_THIS_ROUND` 的部分不重复上一轮结论。本轮唯一相关的是 M-4 的连带问题:若 wallpaper 匿名 PRIMARY 实际显示登录页,则 IA-03 里"content failure container 在 PRIMARY 可见"的举例场景需要换一个真实触发点;若实际为空,则该终端在匿名待登录这一**正常状态**下会显示"页面找不到",这是否是期望的用户可见结果,应在重做核对后一并回答。两种情况都要等 M-4 的事实澄清才能判,本轮不下结论。

## 5. 仍缺的证据

本轮全部为文档与源码静态核验。四包 typecheck、各包 focused、U-1 至 U-15 的执行结果、设备与视觉证据、冷启动与跨机型恢复观察、cleanup,均在实施后才存在,现在都不得视为 PASS。详设 `:452-453` 自陈的 fresh 独立子 agent 设计审查亦未执行。

## 6. 授权边界

本复评只读,只针对三份文档与已同步的权威文档口径,不授权修改源码、测试、脚本、依赖或构建产物,不授权实施、构建、Web、Metro、Android、设备、DEV、seed、UAT、部署或 Git。NO-GO 表示在 M-4 处置前不宜进入实施;S-6 与 N-4 的取舍及是否进入实施,由 Dexter 决定。
