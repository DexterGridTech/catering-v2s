# TER screenPart 机型解析 · 详设 / IA / 实施计划评审

```text
REVIEW_TARGET=DESIGN
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN + IA + PLAN;Codex 与 Claude 经 Dexter 中转的 review(轮次由 Dexter 决定)
reviewerKind=CLAUDE_DIRECT(按项目记忆"分析类任务主 agent 自己做,不派子 agent")
EVIDENCE_TIER=static;只读文档与当前源码,未执行任何构建、测试、Web、Metro、Android、设备或部署命令
被审输入(sha256 前缀 / 行数):
  详设 doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md 703ba49ef24e / 448
  IA   doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-ia-design-codex.md 804d41ab4bb9 / 209
  计划 doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-plan-codex.md 10a86adf92b2 / 337
  需求 doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-requirements-claude.md 81de6167ca21 / 634
```

下文路径以 `apps/terminal/` 为根时省略该前缀;`doc/`、`tools/` 从仓库根写。行号为评审时当前字节。

## 0. 结论

```text
VERDICT=NO-GO
M/S/N=2/5/3
DEXTER_DECISION=无。两项待裁决已于需求 v9 §8 由 Dexter 授权作者定案,本轮未产生新的产品语义分歧
GO 只会表示详设/IA/计划可交 Dexter 决定是否进入实施;不构成 implementation、runtime、visual、Android、Web 或 release 的任何 PASS
```

两个 Major 都不是方向问题:方案选择(C 方案、R-10a 同组件零回归基线、视觉不由结构证明)是对的。M-1 是为一条诊断文案新增跨层数据通道且未比较需求已给出的免费替代;M-2 是 Dexter 裁决④唯一的可证伪点没有执行体。

## 1. 先确认的事:文档修订是真的落了盘

详设头部 `AUTHORIZED` 声称本轮已同步 TR-13/TR-14 与旧需求四处。**这类声称不能采信,已逐处亲验,结论是全部属实**:

| 声称 | 核实结果 | 依据 |
|---|---|---|
| TR-13 第 2 条改为查未过滤装配输入 | 成立 | `doc/platform/terminal-coding-standard.md` TR-13 第 2 条已写"**未过滤装配输入**…不能以过滤后的 catalog 反推是否接入" |
| TR-13 反例栏同步 | 成立 | 同条反例栏已改为"未接入未过滤装配输入""未把 admin parts 纳入该输入" |
| 新开 TR-14 命名条目 | 成立 | 同文件 `:586` `TR-14 · 单机型组件文件名必须显式标出机型` |
| R-S1 改为内容类可就绪 | 成立 | `doc/plans/platform/2026-09-14-…-claude.md:336,338,342` |
| R-S7 收窄到系统类 | 成立 | 同文件 `:343`,并明确 SECONDARY 不显示全屏失败页 |
| U8 判据与绕过形态同步 | 成立 | 同文件 `:518`,绕过列已含"把内容类 fallback 错判为系统失败页或阻止 ready" |
| §8 v3.7 第 1 项同步 | 成立 | 同文件 `:695` 第 1 行已改为"只管首次就绪前的系统类终态事实" |

同时核实详设 §12.3 关于启动语义的两条承重引用属实,且可回溯到既有裁定而非新造:六个启动组与 `primaryDeclared/primaryMeasured/primaryRealReady` 见 `ui/base/console-assembly/src/foundations/consoleAssembly.tsx:298-309`;`writeComplete` 的唯一调用点见 `:352`;该语义的出处是旧需求 §8 v3.7 第 4 项。

## 2. Findings

### M-1 为一条恢复诊断新增 assembly→ui-state 跨层数据通道,且未比较需求已给出的免费替代

- **状态**:CONFIRMED(文档事实 + 需求条款比对)
- **设计事实**:详设 §12.4 第 3 点——"'其他机型'与'已退役/未知'通过**装配期保存的全量 declaration metadata** 区分;该 metadata 只供 ui-state 恢复诊断,不穿透到 render"。IA §6 进一步把它固化成两个 typed problem code:`hydrated-container-invalid` 与 `hydrated-container-other-form`。
- **需求事实**:R-9 第二条写的是"两者的运维含义不同,详设须**区分或改写文案**"——给了两个分支,后者零成本。需求 §6「明确不做」另有一行:"把'被过滤条目'表穿透到 render 层 | R-4 已砍掉需要它的诊断字段;**为一个日志字段拉跨层数据通道不成比例**"。
- **推论**:详设选择了昂贵分支(新增一份从装配期一直活到 ui-state 的全量声明快照),而该通道的唯一消费者是一条恢复诊断的文案。它把 §6 禁止的形态换了个目的地(render → ui-state),动机与代价结构完全相同。过滤后跨机型条目与已退役条目在 catalog 中确实不可区分,所以"要区分就得带数据"这一点成立;成立的是**必要性推导**,缺失的是**必要性本身的论证**。
- **影响**:一条永久的跨层数据通道进入 kernel;后续任何 catalog/装配变更都要维护它。按 CLAUDE.md"方案优不优:作者没有列出的替代方案要自己构造出来做比较",这一步缺失。
- **最小修复**:二选一并写明理由——(a) 采用需求给的免费分支:单一 reason(如 `not-renderable-in-current-catalog`)+ 文案说明两种可能,不新增通道;(b) 保留区分,但必须论证"运维必须在运行期区分这两者"的具体场景,并说明为什么该场景值一条跨层通道。若选 (b),IA §6 的两个 problem code 才成立。
- **Dexter**:不需要。这是方案取舍,不是产品语义。

### M-2 Dexter 裁决④唯一的可证伪点没有执行体

- **状态**:CONFIRMED
- **需求事实**:R-16 的 `failureStage` 条末句——"判据:该漂移必须被**显式断言**(内容失败就绪后再触发系统失败,失败页显示运行期档位),**不得作为无人验证的默认继承**"。这是 Dexter 授权作者裁定④时附带的唯一约束。
- **设计事实**:详设 §13 的 U-5b 覆盖的是"typed category matrix 覆盖 4 content、3 system、1 transition;断言 system page/ready/neutral 分流"——是**分类分流**,不含**时序**。IA-04 的 `dataSourceAndCascade` 只描述了语义("content failure 先 ready 后的系统失败按既有运行期档位"),描述不是执行体。计划 §9 的 A-1 行只列 U-4a/U-5/U-5b,§4 的 A-1 红夹具五条也不含该时序。
- **推论**:实现方最省力的做法是什么都不做——`ScreenContainer.tsx:59` 的 `failureStage = hasPrimarySurfaceReady ? 'runtime' : 'startup'` 已经会自动产生该行为。于是裁决④退化为"默认继承",正是需求明令禁止的形态,且没有任何判据会因此变红。
- **影响**:用户可见文案的一次语义变更无人验证;将来若有人把就绪判据改回旧口径,该漂移会静默消失而不触发任何红。
- **最小修复**:在 U-5b 增加一段时序断言,或新增一条判据——先以内容失败在目标 PRIMARY 就绪,再触发系统类失败,断言失败页为运行期档位(与首次就绪前的启动期档位 testID 不同);落到计划 A-1 的 focused 集合与红夹具清单。
- **Dexter**:不需要。

### S-1 U-4b 的"点名既有测试"没有点名,也没有评估既有覆盖是否足够

- **状态**:CONFIRMED
- **需求事实**:U-4b 的执行形式是"**点名的**既有 layer 测试文件 diff 为空且仍全绿",并附一句"⚠️ 这是回归护栏不是行为 oracle……**若既有覆盖不足,详设须补的是覆盖,不是换判据形式**"。
- **设计事实**:详设 §13 U-4b 写"点名现有 layer admission/LayerStack focused tests;确认派发拒绝与渲染过滤测试仍全绿"——没有给出任何文件或用例清单;计划 §9 A-3 行同样只写 `U-4b`。§13 也没有回答"既有覆盖是否足够"。
- **影响**:交付时无法判断"diff 为空"的分母是什么,护栏可以被悄悄缩小到一两个文件;需求特别提示的"覆盖不足要补覆盖"这一步被跳过。
- **最小修复**:列出确切文件与用例名,并给出覆盖充分性判断;不足则在计划里列出要补的用例,而不是维持现状。
- **Dexter**:不需要。

### S-2 CP-0 的 R-S1 修订把规范续段改成了顶层列表项

- **状态**:CONFIRMED(自行核字节)
- **事实**:`doc/plans/platform/2026-09-14-…-claude.md` 的 `:338`(⚠️ R-E3 勘误)与 `:340`(原定义说明)是 R-S1 项下的两空格缩进续段;`:342` 却以 `-␣␣` 开头,是顶层列表项。
- **影响**:定义"目标 PRIMARY 必须排除过渡态与系统类 fallback、内容类 fallback 可就绪"这句**规范性文字**,在结构上脱离了 R-S1,渲染后与 R-S1/R-S7 并列。后续评审按条引用 R-S1 时会漏掉它,而它正是本批最要紧的一句。
- **最小修复**:去掉 `:342` 行首的 `-`,恢复两空格缩进续段,与 `:338`/`:340` 同层。
- **Dexter**:不需要。

### S-3 R-6 与裁决⑤所依赖的默认值清单是"当前预期",被推给实施 preflight

- **状态**:CONFIRMED(设计自陈)
- **事实**:详设 §12.4 写"实现前必须从两个 integration 当前的 anonymous/primary entry 重新核对默认清单……**当前预期是**:sample-console 使用其已有的匿名入口默认;sample-wallpaper-console 的 PRIMARY 没有默认时保持空,ready 通过 `readyPartKey=null` 表达";§18 `DESIGN_GAPS` 再次标注须在实施 preflight 核。
- **推论**:R-6 的默认传递链、U-6 的判据分母、以及 Dexter 裁决⑤(`readyPartKey` 可空)的**真实触发场景**,三者都建立在这个未核事实上。若 wallpaper 其实已有 PRIMARY 默认,则本批不存在无默认的 `container-empty`,裁决⑤在本批没有真实用例,U-6 的 null 分支只能靠人造夹具。
- **影响**:属于诚实登记的 OPEN,不是隐瞒;但这是**本轮静态就能读完的两个文件**(两个 integration 的 `assembly.tsx` 与 parts),推给实施期不成比例,且它决定一条 Dexter 裁决在本批是否可验。
- **最小修复**:交付前读出两个 integration 当前的默认清单写进详设 §12.4,把"当前预期"改成事实;若确实没有无默认场景,则说明 U-6 的 null 分支用什么夹具、该夹具是否代表生产。
- **Dexter**:不需要。

### S-4 A-2 早于 A-3,但 A-2 要证的 other-form 分支在该时点不可能发生

- **状态**:CONFIRMED(推论,依据计划顺序与机制语义)
- **事实**:计划 §4 的步骤顺序是 A-2(CP-2,含 hydrated container prune 与 unknown/other-form/valid 三分支)→ A-3(CP-3,pre-filter 冲突与装配期过滤)。A-2 的红夹具写"删除 prune,跨形态冷启动必须仍有 invalid container/layer;U-6/U-7b 必须红";收口要求 CP-2 `MATCHED` 后才进 A-3。
- **推论**:过滤尚未上线时,catalog 仍含全部机型条目,**跨机型容器记录在运行期不可能出现**——`other-form` 这一支在 A-2 时点无法用真实路径构造,只能手搓一个 catalog 中不存在的 partKey,而那证明的是 `unknown/retired` 分支。
- **影响**:CP-2 的收口判据里有一条在该批次点不可真实构造;若实施方用 unknown 夹具冒充 other-form,A-2 会以假绿通过,而真正的跨机型恢复要到 A-3 之后才第一次被执行。
- **最小修复**:三选一——(a) 明确 A-2 只证 structural-invalid 与 unknown/retired 两支,other-form 断言在 A-3 完成后补一次 focused 复验并写进 A-3 收口;(b) 调整为 A-3 先于 A-2;(c) 在 A-2 显式声明 other-form 夹具为模拟,并在全批三维对账处标记该项仍 OPEN。
- **Dexter**:不需要。

### S-5 终端批次引用了面向 Web admin 的前端规范作为机制出处

- **状态**:CONFIRMED
- **事实**:详设 §3 横切机制对照表中,"RTK 数据读取与加载判定"行的出处写"前端规范 §3-B","同一事实只有一个住址"行写"前端规范 §3-E"。本仓 `doc/platform/frontend-coding-standard.md` 面向两个 Web admin App,`doc/platform/terminal-coding-standard.md` 才是 TER 的正本。
- **影响**:不改变结论(前者最终判 N/A,后者同时列了 TER 的真实 owner `createSurfaceFormSlice`/`RenderContext.tsx`),但把不适用的规范列为 owning source,会让后续评审去核一份不管这批的文件。
- **最小修复**:改引 TER 规范对应条款,或直接写 `N/A(terminal 不适用该前端规范)`。
- **Dexter**:不需要。

### N-1 详设自身的对抗式盲审归属未写清

详设头部与 §18 两处标 `INDEPENDENT_SUBAGENT_REVIEW=OPEN`,但没有说明该轮是否要跑、由谁跑。需求稿那两轮盲审的 `REVIEW_TARGET=DESIGN` 上限针对的是**需求**这一对象;详设是新的 DESIGN 对象。这是流程项,不影响本轮技术结论,但 Dexter 需要知道它悬着。

### N-2 IA 交叉对账的证据档位与详设口径不一致

IA §7 把"IA ↔ implementation design"记为 `MATCHED by author readback`,§8 又记 `CROSS_CHECK_WITH_DESIGN=MATCHED by author-side document readback; human review OPEN`。作者自读不是对账结果。**本轮我已逐字比对 IA §2 与详设 §12.7,确实一致**,所以结论对;但档位标注应统一为"作者自证,独立复核 OPEN",不要在同一份文档里一处写 MATCHED、一处写 OPEN。

### N-3 ready input 的公共类型重命名未列入公共面影响

`ui/base/render/src/types/props.ts:76` 今天是 `readonly partKey: string`(必填)。详设 §12.3 将其改为 `readyPartKey: string | null` 并新增 `contentFailure`,计划 A-1/A-2 也覆盖了改动点。但详设 §9a 的全链同步表与 D-9 的公共面同步都没有把**该导出类型的破坏性变更**单列;两个 integration 的 `createStartupReadyPayload` 是它的直接消费者。建议在 §9a 或 D-9 明列该类型的公共面影响与两处同步点。

## 3. 方案合理性

- **问题对不对**:对。详设 §1.1 独立复述的问题与需求一致,没有把"机型解析"扩大成 catalog 数据模型改造。
- **方案优不优**:主干选择正确,且有三处值得肯定——
  1. **R-10a 同组件零回归基线**:两个兄弟先指向同一组件,使"拆分前后行为逐字不变"成为可断言的事实,这比任何结构断言都硬,也解决了 U-1/U-2 的真实夹具来源;
  2. **视觉不由结构证明**:§13/§14 把 U-5/U-9/U-10 的像素结论标 `UNVERIFIABLE_BY_MACHINE` 并交 D-13,且明写 ROI 差分只作辅助——没有拿差分器当绝对 oracle;
  3. **克制**:不建跨包 AST checker(跨包 helper 留 review-only)、不给通用 `definePart` 加 sibling-aware 机制、不加横向滚动能力、不保留 `runtime-unavailable` 兼容别名。这几处都顶住了"顺手做大"的诱惑。
  唯一的反例是 M-1:在一条诊断上选了贵方案且没做比较。
- **代价配不配**:配,除 M-1 外。CP 门带具名 production red mutation(§4 尾段五条)是本批质量最高的部分;计划 §8.3 的逐代码与详设对账按仓内要求列为交付前置门,未与三维对账混用。

## 4. UI 与交互强制自问

- **操作是否来自用户明确要求**:是。admin console 双形态与最大化展示来自 Dexter 2026-09-16 裁决②与其后的澄清。
- **此时这样操作是否合逻辑**:是。IA-01/IA-02 沿用既有隐藏入口与本地口令,未新增 Journey。
- **有无更短路径**:mobile 形态已比较过横向滚动与换行两案,并以仓内无横向能力为由取换行(`PrimitiveScrollView.tsx:17` 无 `horizontal`),结论正确。
- **不合理之处的来源**:`:342` 的结构破损来自本批文档编辑(S-2),不是历史实现或产品语义未裁决。
- **歧义处置**:本轮未发现需要 Dexter 裁决的产品/Journey 歧义。

## 5. 仍缺的证据(实施后才有)

本轮全部为文档与源码静态核验。以下在实施后才存在,现在都不得视为 PASS:四包 typecheck;render/ui-state/console-assembly/admin-shell/两个 integration 的 focused 结果;U-1 至 U-15 的执行结果;U-5/U-9/U-10/U-11 的设备与视觉证据;冷启动与跨机型恢复的 native 观察;cleanup。详设 §14 与计划 §7 的分档计划本身是合格的,问题只在 M-2/S-1/S-3/S-4 指出的执行体缺口。

## 6. 授权边界

本评审只读,只针对上述三份文档与已同步的权威文档口径,不授权修改源码、测试、脚本、依赖或构建产物,不授权实施、构建、Web、Metro、Android、设备、DEV、seed、UAT、部署或 Git。NO-GO 表示在 M-1、M-2 处置前不宜进入实施;是否进入实施、以及五条 S 与三条 N 如何取舍,由 Dexter 决定。
