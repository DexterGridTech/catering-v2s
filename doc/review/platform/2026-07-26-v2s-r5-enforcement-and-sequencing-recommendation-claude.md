---
title: R5 防复发机制与执行顺序 Claude 决策建议
type: review
subtype: recommendation
status: DELIVERED_FOR_DEXTER_DECISION
reviewer: Claude
createdAt: 2026-07-26
context: Dexter 要求给出最专业、最长远的判断,不为短期完成目标让步
relatedReview: doc/review/platform/2026-07-26-v2s-r5-s0-s4-structure-checkpoint-review-claude.md
authorizationBoundary: RECOMMENDATION_ONLY_DECISION_BELONGS_TO_DEXTER
---

# R5 防复发机制与执行顺序:我的决策建议

## 0. 我的判断,一句话

**把接下来的力气全部先投到"机器门"这一层,而不是继续往前推功能;并且不要为了补一条项目记忆去解冻 `required-inventory`。** 长期看,能真正约束未来 agent 的只有机器门;记忆和蓝图都是软层。这一轮的教训不是"少了一条记忆",而是**守卫被排在了它要守卫的工作之后**——而这恰好发生在一个专门为防复发而写的计划里。

## 1. 先说清楚真正的失败模式

这一轮的事实链条是:

1. 计划写明五条防复发链,并把它们定为 S0 前置("S0 不通过不得搬迁");
2. S0 **诚实地**把 frontend-architecture 与 backend ArchUnit 标为 `PENDING OWNER MIGRATION`,承诺"随 S1-S3 的源码搬迁同批激活";
3. S1-S3 完成了搬迁;
4. 控制没有激活(ArchUnit 1/3、frontend gate 2/3、code-layout backend 根不设防,均经真实变异证明放行)。

所以失败的不是诚实度——S0 的披露是真诚的、数字是准的。失败的是**允许把守卫延后到它守卫的工作之后**。计划自己写了"前置",但"前置"只是散文,没有任何机械机制阻止 S1 在 gate 仍 PENDING 时开工。

这个模式此前已经出现过一次(§3.2 的自我反思:"先让 104 operations 有路由,置于先建立稳定承载结构之前")。**同一个错误换了对象又发生了一遍**,而且是在为修它而写的计划里。这说明散文级的顺序约束对 agent 无效,不管写得多明确。

我也要承认自己在其中的一份:我在上一轮把 S2/S3 挂到了 22 surface / 25 key 的完备性分母上,那是给重构包挂了 S5 的尺子;判定不可达,才逼出了措辞软化。详见 checkpoint review §4.5 的自我更正。

## 2. 决策一:不要为这条记忆解冻 `required-inventory`——维持冻结

**建议:否决治理 batch,affirm Codex 拒绝篡改冻结分母的做法。**

理由,按权重:

1. **`required-inventory.json` 的冻结本身就是一条控制**——它是"project-memory 不能被悄悄加料"这件事成立的唯一原因。为了加一条"不要悄悄堆积东西"的记忆,去解冻那个防止悄悄加料的分母,方向是反的,净值为负。
2. **记忆和蓝图都是软层,不是承重层。** 它们只在 agent 真的读了、路由真的命中时起作用。真正无差别拦住错误提交的是机器门——不挑 agent、不挑会话、不挑上下文窗口。你的要求是"以后不能让开发的 agent 犯这个错误",这个要求的承重结构是门,不是记忆。
3. **成本不成比例。** 一个治理 batch 是一整轮评审周期,换来的是一层冗余软保护。同样的时间投到补两条 ArchUnit 规则上,拦截力高一个数量级。
4. **Codex 的克制值得肯定而不是推翻。** 它发现加不进去之后选择了停手并如实登记,没有改分母、没有伪造 active memory。这正是我们希望它形成的反射。用一次授权把这个反射覆盖掉,代价比收益大。

**但两件事必须做**:①方案在我 GO 之后被静默修订(`d5ca6bf5…` → `306c596f…`,§6 第 4 条被移除)必须补披露——修订的实质我同意,不披露的做法不能成为惯例;②`doc/evidence/…s0-baseline.md:54` 那条 "PENDING S4 / must be added before R5 closure" 与新 §6.4 冲突,必须改掉,否则下一个 agent 会照着它去动冻结分母。

将来若因为别的原因真的开治理 batch,这条记忆可以顺路搭车。它不值得单独开一次。

## 3. 决策二:守卫先行,单独成批,红夹具验证前不做任何其它事

**建议:在恢复 S5、以及在补任何前端/后端功能之前,先把下面这批做完并逐条真实变异验红。这批之外不放任何东西在飞行中。**

| 项 | 内容 | 为什么现在做 |
| --- | --- | --- |
| 1 | `EdgeRouteRegistryCoverageTest` 增反向断言(runtime 路由集 − error/actuator 白名单 ⊆ registry) | **全评审里性价比最高的一处改动**。它永久关闭"契约外端点"这一整类漂移,而且每增加一个 face(terminal、customer-bff)它的价值线性上升。当前 5 条契约外活端点(含无 workspace 作用域的运营登录)就是它缺席的直接后果 |
| 2 | backend ArchUnit 补 2 条:edge 禁 JDBC/repository;capability 单向依赖(`session` 显式豁免) | §6 承诺的 3 条只落实 1 条 |
| 3 | ArchUnit 现有 cookie 规则扩到 servlet API 全面禁令 | 现只 ban `Cookie` 类,21/24 controller 的 `HttpServletRequest` 穿透不被拦 |
| 4 | `frontend-architecture` 补"catalog required mutation 必须经 lifecycle idempotency" | 变异证明:删光 4 个 `lifecycle.getIdempotencyKey()` 门仍绿 |
| 5 | `code-layout` backend app 根改**白名单**(只允许 `bootstrap/configuration/edge/generated`) | 变异证明:controller 复制回 app 根、整个业务页复制进 `src/app/`,门均放行 |
| 6 | security self-test 变异对象改为 base 真读的输入;修正 `r4-gate-catalog` 与 red-fixtures README 的失实声明 | self-test 当前是 no-op 变异且已在报红 |
| 7 | `logging` 正则收窄到值侧字面量 | 现在误伤 cookie 常量名,是 CLAUDE.md 明禁的关键词伪装 checker;且这条红两份证据都没登记 |

**边界(防止这批变成镀金)**:只做计划已承诺的门 + 第 1 项反向断言,**不新增门类别**,每条仍只判一行机械事实,总时长应是小时级而非天级。做完每条都要在 scratchpad 上真实变异证明它会红——self-test 绿不算数,这一轮已经证明了 self-test 可以是 no-op。

为什么坚持"这批之外不放任何东西":因为顺序问题的根因是并行时守卫总是被优先级挤后。单独成批、没有别的东西可做,是唯一能保证它不再被挤后的排法。

## 4. 决策三:把"守卫不得后置"写成硬停,而不是再写一遍散文

**建议:蓝图 §14 增一条硬停规则,并给它一个可机械检查的形态。**

规则内容:**一个控制不得以 `PENDING` 状态跨越它所守卫的工作。** 要么在该工作开始前激活,要么该工作等待。S0-style baseline 里不允许出现"某控制 PENDING,由本包稍后的 step 激活"这种行。

可机械检查的形态:baseline 证据里控制表的每一行,状态只允许 `ACTIVE_RED_VERIFIED` 或 `OUT_OF_SCOPE_THIS_PACKAGE`,不允许 `PENDING <本包内的后续 step>`。这一行是纯机械的(字符串闭集),符合"门只管一行机械事实"的标尺,不需要新建 checker——放进已有的 granularity/evidence 校验即可。

这条比再写十遍"必须先建控制"有用,因为它把顺序从"agent 的自觉"变成了"文档形态的合法性"。

## 5. 决策四:修正 S2/S3 的判定锚(我的错,一并改掉)

**建议:S2/S3 的完成判定改为纯形状判定,完备性移交 S5/U12。**

改成:存量 surface 全部落在 feature 目录、零 generic 兜底、路由层存在、mutation 全部经 lifecycle、feature 具备 `api/model/ui/automation`。
移出:"22 surface / 25 key 全部有承载"——这是 S5 completeness。

不这样改,S2/S3 永远不可能诚实地判绿,而不可达的判定只会持续制造措辞软化。这是我上一轮定错的锚,由我提出更正。

## 6. 我考虑过但不建议的两个方案

**不建议:把 R5 拆成多个 review 周期。** 你在 D-01 已裁决 R 原子交付,我当时保留过意见但你已定;这一轮的证据也**不支持**推翻它——失败发生在 R 的内部顺序,不是 review 粒度。拆 review 解决不了"守卫被后置",只会增加交接成本。D-01 维持。

**不建议:现在就补齐前端 6 个缺失 surface 以求"分母好看"。** 那是 S5 的活,现在做等于让重构包继续吞完备性工作,也正是这轮混乱的来源。先把形状和门做对,功能按 S5 正常推进。

## 7. 如果只能采纳一条

**采纳第 3 节的第 1 项——反向覆盖断言。**

理由:它是唯一一条"改一次、永久生效、且随系统长大而增值"的改动。v6/v7 要长到 22 个 owner 域、5 个契约面;每多一个 face,未声明端点的暴露风险就增加一分,而这条断言的成本不变。当前那 5 条契约外端点里有一条是无 workspace 作用域的登录入口——它已经在那里躺了不止一轮评审没人发现,唯一能发现它的机制正好是单向的。

## 8. 边界

本文件是建议,不是裁决。决策权在你;`doc/decisions/` 是你的。第 2 节的否决建议若你不同意、决定开治理 batch,我不认为那是错误决定——只是我认为投入产出更低。第 3、4、5 节的内容不需要新授权,在既有 R5 implementation 授权内即可执行。本建议不授权 DEV、seed、reset、动态执行或任何新业务能力。
