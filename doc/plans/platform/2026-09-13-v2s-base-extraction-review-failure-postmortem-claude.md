# 抽 base 需求文档 review 反复不过的原因 · 复盘

```text
DOC_KIND=POSTMORTEM
AUTHOR=Claude(复盘对象是我自己写的文档)
SOURCE=本会话历史记录中三份 fresh 独立盲审的原始结论
EVIDENCE_TIER=历史 review 原文 + 本次重新核实
```

## 1. 三份盲审各自的结论

| 审查维度 | 结论 |
|---|---|
| 跨 feature 编排上移 | **NO-GO**(2M / 3S / 4N) |
| 主题契约与证据纪律 | E-6 与"全仓无一致性校验"两条均 `REJECTED_WITH_EVIDENCE` |
| 抽取归属与包图 | E-1 `PARTIALLY_CONFIRMED`,"零新增边"被证伪 |

## 2. 五个失败模式(按出现次数排)

### F-1 · 未穷举的全称断言 —— 三份审查全都抓到,是**首要死因**

同一种句式,四次:

| 我写的 | 实际 | 抓到的审查 |
|---|---|---|
| "只有 `desk-navigation` 监听他包命令,另外六个 actor 只响应自己的命令" | **5 / 7 个** actor 监听他包命令;**7 / 7** 都在做画面编排 | 编排上移 |
| "全仓没有任何语义 token 一致性校验" | 两处:`sample-console/test/theme.test.ts:9-44`、`tools/terminal-ui-primitives/check-behavior.mjs:107-123` | 主题契约 |
| "三个消费者,全部已依赖 display-context" | **五个**;漏掉的两个恰好都没有那条边 | 归属与包图 |
| "零新增边" | 至少一条实边,且 `check-static.mjs:245` 的集合相等门会直接红 | 归属与包图 + 主题契约 |

**共同结构**:都是"只有 X / 没有 Y / 零 Z"这类**对整个空间的断言**,而我没有遍历那个空间。

**为什么特别致命**:这类句子恰恰是论证的承重墙——"只有它特殊,所以只搬它"。承重墙一倒,整个抽取清单跟着塌。第一份审查的原话是:**"按文档自己的判据一致执行,六个 actor 全都得上移,member-desk 会被搬空。"**

### F-2 · 用类比代替归属论证,而且举的例子自带反例

E-1 论证"`SurfaceForm` 该归 display-context"的全部依据,是一句类比:"display-context 已经拥有 `DisplayMode`"。

审查给出的反证很狠:我拿 `WorkspaceKey ← kernel.base.state` 当"概念 owner 提供"的正例,但 `state/src/types/workspace.ts:4` 只声明了 `'MAIN'|'BRANCH'`,真正的 workspace 语义 `resolveWorkspace` 在 **display-context** 里。`WorkspaceKey` 住在 state,**正是因为 state 是最低公共包**——这是图便利摆放,不是概念归属。

**我用一个"图便利摆放"的例子,去论证"不要按图便利摆放"。**

### F-3 · 概念只搬一半,且不写重开条件

E-1 把 `SurfaceForm` 的**类型**移去 display-context,**slice 与 selector 留在 ui-state**。于是"当前是 laptop 还是 mobile"的运行期 owner 和概念 owner 分属两个包,而同族的 `selectDisplayRole` 在 display-context。

审查判定这正是我自己写在 §0 的"不接受先凑合"要禁的形态,而我没写重开条件。**自己定的规矩,自己第一个破。**

### F-4 · 造一个满足门的 slice

我给 `sample-console` 设计的 `phase` slice:
- **没有读者**——那四个 handler 全文零处 `getState()`;
- **镜像了两份已有事实**——`staff-session` 的 session slice 已有 `anonymous|authenticated`,"哪个 part 在哪块屏"已在 ui-state 的 screen slice;
- **直接撞规范 4-B**(`terminal-coding-standard.md:621-627`):业务 slice 不得新增 `selectedTab`/`currentPage`/`activeScreen` 这类**导航镜像状态**,理由是"当前在哪一页只有一个真相源"。

审查的评语:**"文档引用了 TR-09 那条禁令、声明'我没有编一个',然后用一个更精致的理由做了同一件事。"**

### F-5 · 不构造替代方案就下结论

`CLAUDE.md` 明写"作者没有列出的替代方案要自己构造出来做比较"。我没做,审查替我做了,而且更优:

> 不上移 actor,**反转翻译方向** —— integration 拥有一个无状态 actor,把 staff-session 的四条会话命令翻译成 **member-desk 自己拥有的** `deskOpened`/`deskClosed`;member-desk 保留自己的 navigation actor,只改成监听自己的命令。

它同时解决了我方案会造成的三个新问题:partKey 出包、partKey 双写、display 探测逻辑复制。

## 3. 范围过大是不是死因?

**部分是,但不是主因。** 逐条核:F-1 是检索纪律,F-2 是论证方法,F-3 是自律,F-5 是流程规定没执行——**四条与范围无关,拆小了照样犯**。

范围的真实作用是**放大器**:8 个抽取项 × 每项都有承重全称断言 = 任何一条被推翻,连带整份结论不可信。审查只要打穿一处,就有理由怀疑其余七处。**拆小不能治病,但能让每次只死一处。**

## 4. 做完 sample 治理,抽 base 会变好做还是变难做?

### 4.1 会变好的(有证据)

| 变化 | 直接对应的失败模式 |
|---|---|
| 编排职责归位后,member-desk 的 actor 集合不再混合"自己的旅程"与"别人的会话",F-1 里"5/7 监听他包命令"那种判据混乱**在源头消失** | F-1 |
| `hasSecondarySurface` 从交互包挪出后,会显出它是**显示拓扑查询**而不是业务工具——上一轮 base 分析里它根本没进候选清单 | 候选集不全 |
| 编排从 `assembly.tsx` 剥离后,剩下的东西才是 E-3/E-4 是否成立的真实检验对象 | F-2 |

### 4.2 不会变好的(必须另外治)

**F-1、F-2、F-3、F-5 是方法问题,治理 sample 一行也治不到。** 抽 base 那一轮必须另外带上:

1. 任何"只有/没有/零"的句子,**先遍历再写**,并在文档里附上遍历命令与命中清单;
2. 归属论证不得用类比,必须给出"若归属在别处会怎样"的失败场景;
3. 概念搬迁要么整族搬,要么写死重开条件;
4. 每个抽取项必须自带一个"我构造的替代方案 + 为什么它更差"。

### 4.3 ⚠️ 新发现的一条真实耦合:G-3 跨不过 sample 治理这一轮

本次核实发现,治理文档 §4.3 写的"member-desk 改读 `surface-plan` selector"**结构上不可能**:
- `skeleton-graph.ts:176` 有 `ui.integration.sample-console → ui.feature.sample-member-desk` 边;
- member-desk 反过来读 sample-console 的 slice 会成环,`check-static.mjs:65,206` 的 `assertAcyclic` 直接红。

`hasSecondarySurface` 的 12 处调用中,只有 4 处(`actors.ts:85,90,95,103`)随导航 actor 一起走;**另外 8 处留在 member-desk 自己的 handler 里,本轮修不掉**。要修,拓扑事实必须住进两边都能读的地方 = `kernel/base/display-context` = **按范围规则属于抽 base 那一轮**。

**所以 G-3 只能完成三分之一。** 治理文档原来的表述是过度承诺,已标记待改。这也是"A 影响 B"的一个具体正向例子:治理暴露出拓扑归属问题,抽 base 那轮有了明确的、带证据的输入。

### 4.4 两轮之间没有循环依赖

治理轮不需要抽 base 先做完:G-1/G-2/G-4/G-5 的修复落点全在 sample 包内。只有 G-3 的**后三分之二**要等 base 轮。**这是单向的先后,不是互相卡死。**
