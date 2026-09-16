# TER React UI selector 订阅规范与订阅边界收紧 · 详设与实施计划复评(第 2 轮)

```text
REVIEW_TARGET=DESIGN
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN + PLAN;Codex 与 Claude 经 Dexter 中转的 review
reviewerKind=CLAUDE_DIRECT(按项目记忆"分析类任务主 agent 自己做,不派子 agent")
EVIDENCE_TIER=static;只读源码与文档,**未执行任何命令**——没有跑 typecheck、test、static、
  Web、Metro、Android、设备或部署
被审输入(sha256 前缀 / 行数):
  详设 doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-design-codex.md 61e126414b0f / 432
  计划 doc/plans/platform/2026-09-17-ter-selector-subscription-performance-implementation-plan-codex.md 0e0e70bc2611 / 300
  交接 doc/review/platform/2026-09-17-ter-selector-subscription-performance-design-review-request-codex.md 58ab7021e3b7 / 113
上一轮:doc/review/platform/2026-09-17-ter-selector-subscription-performance-design-review-claude.md(NO-GO 1M/3S/3N)
```

下文路径以 `apps/terminal/` 为根时省略该前缀;`doc/`、`tools/` 从仓库根写。

## 0. 结论

```text
VERDICT=GO
M/S/N=0/0/3
上一轮 1M/3S/3N 七条全部真关闭,逐条核验见 §1
DEXTER_DECISION=无(M-1 的方案二已由 Dexter 裁定并落地)
GO 只表示详设与计划可交 Dexter 决定是否进入实施;不构成 implementation authority,
  更不构成任何性能改善的证据——本批按方案二明确不主张性能
```

三条 Note 都不阻断:两条是交叉引用与文件命名的一致性,一条是自查项与头部状态对不上。

## 1. 七条 finding 的关闭核验

逐处开文件核字节,不采信 §15/§11 的处置表。

**M-1(`DEXTER_DECISION`=方案二)——真关闭,而且改得彻底。** 我对三份文档做了性能措辞扫描,剩余命中**全部是显式否认或文件名**,没有一处仍在主张改善:详设 `:18` `SCOPE_DECISION=方案二`、`:22`"不以性能优化命名或验收"、`:30`"不把它升级为已测得的性能缺陷"、`:52`"不定义 FPS、CPU、内存、首帧、延迟或用户感知阈值"并写明"继续使用性能优化名称会把机制证明误读为问题存在性和改善幅度证明"、`:347`、`:362`;计划 `:13`、`:16`;交接 `:10`、`:15`、`:112`。标题三处同步改为"订阅规范与订阅边界收紧"。§12.3 `:366` 还把"是否补性能基线"从未决项里撤掉,`:370` 把未来任何性能结论路由到"另开有改前基线与授权的任务"。口径一致,没有留后门。

**S-1 — 真关闭。** 详设 `:168` 新增整段:订阅通知次数不会因 with-selector 减少、同一 state source 仍通知每个订阅者、拆分后单个宿主可能执行多个窄 selector、`useUiCatalogContext` 还会构造候选 context 再比较字段;并明确"这个固定代价属于订阅边界取舍,不是性能改善声明",以及 `areUiCatalogContextsEqual` **必须保持常数时间、字段明确的浅比较,不得在通知路径做深遍历、IO 或业务计算**。计划 B1 第 3 步 `:128` 同步该约束。这正是我要求的取舍说明加 equality 约束。

**S-2 — 真关闭。** TR-15 第 6 条(详设 `:123`)现已写明 `apps/terminal/ui/base/console-assembly` 创建 state source 并向 `RenderProvider` 注入属于 assembly→render 的基础设施装配接线,不受业务 UI 读取禁令约束,**但不得把 source 继续传给业务组件**;`:126` 的机器边界段补了"console-assembly 的基础设施注入是显式例外,不能被误报为业务 UI pass-through";计划 B3 第 2 步 `:163` 把这条带进了 checker 要求。例外写进了条文本身而不是只写在详设 §5.1,这是关键——TR-15 是要进标准正本被逐条引用的。

**S-3 — 真关闭,而且补上了执行体。** 契约句落在三处:TR-15 第 1 条末尾(详设 `:118`)、§5.1 `:156`(并给出具体例子:空容器没有 screen 时业务 selector 合法返回 `undefined`)。更要紧的是判据跟上了:F-4 `:326` 已改写为"unavailable/status 与 undefined 语义边界",预期结果含"业务 selector 的 `undefined` 不被单独解释为 lifecycle unavailable";§7.1 第 6 条 `:201` 与计划 B1 第 5 步 `:130` 都要求证明"消费者不能单凭该值推断 runtime unavailable,而要结合 `useRenderStatus`"。我上一轮特别担心的是"契约句落了但判据没跟上",这次没有发生。

**N-1 — 真关闭。** 详设 §7.2 `:208` 点名 `RENDER_STATIC_RULE_NAMES`、由其派生的 `RENDER_STATIC_RULE_GATES` 与现有 self-test 规则清单必须同步,并写明"这些不是可省略的显示计数";计划 `:110` 与 B3 第 3 步 `:166` 同步。

**N-2 — 真关闭。** 详设 `:69` 已把方案 D 的否决理由改为"需要自行维护 selector 记忆化与 equality 的边界情况;官方 React 订阅原语仍可复用,但自研封装扩大维护面",夸大 tearing/并发风险的表述删除。方案比较的诚实度恢复。

**N-3 — 真关闭。** 详设 `:273` 写明 `use-sync-external-store` 是"render 当前第一个第三方运行依赖",并要求"白名单必须精确重算,不把 React/RN 改成 runtime dependency,也不以传递依赖代替直接声明";§7.2 `:211` 补"该白名单是精确替换/重算结果,不是把新包无限追加到允许列表";计划 `:69`、`:110` 同步。

**处置表的诚实性**:详设 §15 与计划 §11 把每条都标成"已改文档;未实施/未运行",并把整体状态记为 `UNREVIEWED_AFTER_CLAUDE_REMEDIATION`。没有把文档修订冒充执行,也没有把部分接受写成完全接受。

## 2. 方案二之后,代价是否还站得住

这是本轮我自己追加的检验:去掉性能主张后,删公共 hook、引入包内第一个第三方运行依赖、新立约束全部 `ui/**` 的规范——这些代价靠什么支撑?

结论是**仍然站得住**,支撑点有两条,都不依赖性能:

其一,Dexter 本轮的直接任务原话就含"把 selector 调用方式提升为框架级规范"。框架规范本身是交付目标,不是性能优化的副产品。

其二,`stateSource` 逃逸口是**今天生产里真实存在的边界缺陷**,与性能无关。我上一轮已亲验:`contexts/RenderContext.ts:10` 把 `stateSource` 放进公共上下文;`ui/base/admin-shell/src/components/AdminShellLaptop.tsx:44` 直接解构它、`:78-79` 当 prop 下传;`sections/RuntimeSection.tsx:8` 是 `context.stateSource.getStatus()`;`sections/DisplayContextSection.tsx:9-10` 直接对 `context.stateRoot` 跑 owner selector。收窄公共 context 类型是在修一个真实的 owner 边界破口。

至于那个第三方依赖:它换来的是 equality-based bailout,也就是 §0.2 目标 1 要建立的订阅契约本身;在方案二口径下该契约仍是交付物(F-1 作为行为契约验证,而非性能结论)。因此依赖是相称的。N-2 修正后的方案比较也不再靠夸大风险来支撑这个选择。

## 3. Findings

### N-1 两份文档都引用了一个不存在的 `§9.3`,而且正指在交付闸门那一步

- **状态**:CONFIRMED
- **事实**:计划 B4 第 2 步 `:178` 写"主 agent做 **§9.3** 的逐代码与详设对账";详设 §9a `:290` 写"必须同时更新本表与**计划 §9.3**"。但计划的逐代码对账实际在 **§7**(`:218` "## 7 · 逐代码与详设对账安排"),计划 §9 是交付闸门且无 9.3;详设 §9 只有 9.1/9.2/9a/9b,也没有 9.3(详设自身的逐代码对账在 §13c)。
- **影响**:实施者在 B4 的交付闸门这一步按引用去找章节会落空。位置恰好在最不该迷路的地方。
- **最小修复**:两处引用改为计划 §7(需要时并列详设 §13c)。
- **Dexter**:不需要。

### N-2 三份文档的文件名仍带 `-performance-`,与方案二"名称会导致误读"的理由自相矛盾

- **状态**:CONFIRMED
- **事实**:标题已全部改为"订阅规范与订阅边界收紧",但路径仍是 `2026-09-17-ter-selector-subscription-**performance**-implementation-design-codex.md`(计划、交接同形)。而详设 `:52` 采用方案二的理由恰恰是"继续使用'性能优化'名称会把机制证明误读为问题存在性和改善幅度证明"。
- **影响**:很小但真实——文档正文改了口径,路径没改;日后按关键字检索"性能"工作会把本批捞出来,落到路径上的读者也会先接到旧框架。文档自己论证了名称重要,却把名称留在最持久的那一层。
- **最小修复**:二选一,由 Codex/Dexter 权衡——要么改名并同步四处以上交叉引用(现在改最便宜,越往后越贵);要么在三份文档头部各加一句"文件名沿用创建时的路径,本批口径以标题与 `SCOPE_DECISION` 为准",把矛盾显式登记掉。
- **Dexter**:不需要,但改名会动既有路径引用,他若在意路径稳定性可以直接选后者。

### N-3 详设自查项与头部状态对不上

- **状态**:CONFIRMED
- **事实**:详设头部 `:17` 写 `INDEPENDENT_SUBAGENT_REVIEW=ROUND_2_COMPLETE`,而 §14 自查最后一项 `:418` 仍是未勾选的"[ ] fresh 独立 DESIGN review:交付前完成,记录路径由 review handoff/审查报告补齐"。
- **推论**:两者可以同时为真(Round 2 已完成、但作者认为交付前还要再跑一次),也可能只是改口径时漏勾。文字本身没说清是哪种。
- **最小修复**:把该自查项改成明确状态——或勾选并写上已完成的记录路径,或保留未勾选并写明"指的是交付前的最终一次,与头部的 Round 2 不是同一件事"。
- **Dexter**:不需要。

## 4. 方案合理性

- **问题对不对**:方案二之后,主张收窄为"订阅边界粗于选择边界"这一**机制事实**(我上一轮已从 `hooks/useRenderSnapshot.ts:7-11`、`foundations/createRenderSnapshotReader.ts:31-34`、`hooks/useUiStateSelector.ts:16` 亲验成立),不再主张任何未证的性能问题。定性与证据能力相称。
- **方案优不优**:C 仍是合理选择,且 N-2 修正后理由诚实。我上一轮自己构造的更小替代(原生 `useSyncExternalStore` + 约二十行记忆化包装)仍然可行但不具压倒优势,不建议返工。
- **代价配不配**:见 §2,配。
- **值得肯定的两处**:①S-1 那段没有辩解,而是直接承认"通知量不减少、selector 执行次数可能上升、catalog adapter 每次要构造候选对象",并把它写成固定代价而不是含糊带过;②S-3 不只补了契约句,还把判据(F-4)和红夹具一起补上——这是我上一轮点名要盯的形态。

## 5. UI 与交互强制自问

`NOT_APPLICABLE`:本批不改变用户可见行为、布局、文案、焦点、partKey、testID 或 Journey,详设 §3a 已如实标注。迁移必须保持 `ScreenContainer` 的失败分类与 ready 分支不变——那是上一批确立的语义,S-3 的处置正是为防止它被 `undefined` 歧义侵蚀,现已写成契约并有判据。

## 6. 证据分档

本轮为 DESIGN review,除阅读外未执行任何命令。static、focused、typecheck 在实施期才有(详设 §11 标 `OPEN`);native/Android、Web、release/visual、cleanup 标 `NOT_APPLICABLE_WITH_REASON`。本评审不触碰、不升格。**本批不存在任何性能数字,GO 不得被解读为性能改善的证据。**

## 7. 授权边界

本复评只读,只针对详设、实施计划与交接请求,不授权修改源码、测试、依赖、脚本、规范或构建产物,不授权任何动态验证、部署或 Git 操作。GO 表示设计与计划可交 Dexter 决定是否进入实施;**GO 不等于 implementation authority**,三条 N 可在既有边界内自主修复,是否进入实施由 Dexter 决定。
