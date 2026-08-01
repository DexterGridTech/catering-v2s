---
title: 已确认业务语料纳入项目记忆方案 Claude 独立评审
type: review
status: DELIVERED
reviewTarget: doc/plans/platform/2026-07-25-v2s-confirmed-business-corpus-memory-adoption-proposal.md
reviewer: Claude
createdAt: 2026-07-25
---

# 已确认业务语料纳入项目记忆方案 Claude 独立评审

## 结论

```text
VERDICT=GO_FOR_DEXTER_ACCEPTANCE
M=0  S=0  N=3
```

方案 C(精简 canonical corpus + read policy + parked intake)右尺寸、边界诚实、与验证治理一致;G-01–G-12 记录对 Dexter grill 原始裁决**高保真**(我以本人全程在场的问答记录逐条比对);此前 S-1/N-3 修订已在修订版草稿落实并经我复算。三条 N 均为一句话级修订,不阻断 Dexter 接受;建议接受时顺带采纳。

## 评审出处与亲验记录

- fresh v2s-rooted Claude 会话;我全程参与了 G-01–G-12 对应的 grill 问答(2026-07-24/25),对忠实性核验具有一手依据;
- 哈希复算全对:proposal 所绑三份冻结输入(修订版草稿 `4422ed54…`、record `4546c82a…`、及 proposal 自身 `2208480f…`);修订版草稿 §9 ledger 全部 **56 行**逐条复算零漂移(含新增的 q01-q12 rulings `0276357b…`、business-user-facing-language-standard `087b537d…`、8 份现行模块规范);
- S-1 落实亲验:§4 词条已逐行改为"已共识(Dexter grill 日期)"并注 07-21 裁决层;"page grant 独立于运营角色"口径变化已按我的要求登记进 §6 而非静默改写;
- 细节留存亲验:草稿行 323/583 保留"查看门店经营结果(**未来分析/报表类能力**)"限定;行 475/708 保留"商品形态 shapeKey 仅历史映射、采用与否待裁决"。

## 方案合理性(先于闭环)

1. **问题对不对**:对。要解决的是"以后不再造业务概念",而非"文档更全"。方案把"已确认"与"未确认"物理分离、把 08–22 明确标 `PARKED_UNVERIFIED` 并给出诚实停下的路径(§5.1 第三行),正面命中这个问题。
2. **方案优不优**:A(只留草稿)路由不可达、B(整稿入记忆)把 UNVERIFIED 升为真相,均正确否决。C 的三文件分工(语义来源/使用规则/未来台账)清晰;拒绝关键词 checker、拒绝入 kernel、拒绝为补齐 22 域立通用研究项目,三个"不做"都与 `verification-governance` 的既有断言一致。
3. **代价配不配**:三份小文档+一次 inventory route,分钟级维护;恢复机制按域小批(半小时问题清单上限),符合小批量纪律。配。

## 逐项处置

```text
ITEM=G-01–G-12 对 grill 裁决的忠实性(record §2–§5)
STATUS=CONFIRMED
EVIDENCE=本人在场的 grill 问答记录逐条比对;修订版草稿 §7.1–§7.7 G 结论
FINDING=十二条主张、禁推、待裁决边界均与 Dexter 原话一致;"未经营(禁用已停业)""货号二元组""运维可撤销任职(v2 修订已登记)""URL 规则按 v4 实况"等易失真点全部保真
MINIMAL_CHANGE=见 N-1(record 摘要层两处细节回补)

ITEM=三份 future anchor 的职责划分与不重不漏(proposal §4)
STATUS=CONFIRMED
FINDING=语义来源/使用规则/旁支台账三分无重叠;不入 kernel 的理由成立(非全任务相关);与既有 deterministic-context-only、verification-governance 无职责冲突
MINIMAL_CHANGE=见 N-3(parked 台账收口 01–07 残余未决项)

ITEM=读取触发矩阵(proposal §5.1)
STATUS=PARTIALLY_CONFIRMED
FINDING=四行触发/豁免设计合理,无关机械任务被明确豁免;但"涉及 G-01–G-12 任一对象"依赖 agent 自识别命中,缺一个零成本的自查抓手
MINIMAL_CHANGE=见 N-2

ITEM=parked 08–22 恢复机制(proposal §6;record §6)
STATUS=CONFIRMED
FINDING=按域触发、半小时批、逐题 G 编号、Claude+Dexter 双门、禁设通用研究项目——与既有小批量与授权纪律一致;"还没问到不能代替答案"有明确落点(§5.1 行 80)
MINIMAL_CHANGE=NONE

ITEM=授权边界与措辞(全部三份文件)
STATUS=CONFIRMED
FINDING=逐份检查未发现"memory 已写入/技术映射已定/R3W1 已授权"式偷换:proposal §1/§4/§7 反复声明"接受后才执行";record 前言"接受前不属于 project-memory";G-10 把 workspaceKey→groupWorkspaceKey 迁移明确留 R3 契约物化另批;自审第一轮如实声明"未收到外部 finding,不假装已有独立结论"
MINIMAL_CHANGE=NONE

ITEM=Codex 自审(codex-self-review)
STATUS=CONFIRMED
FINDING=对我 S-1/N-3 的复核处置正确——采纳"现行裁决层必须入草稿",拒绝把 S-1 扩为"重构 IAM 技术模型"(该拒绝有据:S-1 从来只要求证据层完整,不要求实现动作);cycle 纪律(至多一次定向第二轮后 SELF_DECIDED)符合 CLAUDE.md
MINIMAL_CHANGE=NONE
```

## Findings(0 M / 0 S / 3 N)

### N-1:record 是摘要层,须防 Unit A 只抄摘要丢细节

- **位置**:proposal §7 Unit A(行 112–117);record G-03(行 69,"查看门店经营结果"缺"未来分析/报表类能力"限定)、G-11(行 179–196,缺"商品形态 shapeKey 仅历史映射、采用待裁决");另 G-06 的操作语义(选总公司须有效授权/移除被用授权须拒绝)与 G-07 的"v2 原文修订台账"也只在草稿层。
- **业务影响**:细节都在冻结草稿 §4/§7.x 里,不丢证据;但若 Unit A 生成 canonical 时以 record 为内容基准,上述限定词会缺失,"查看经营结果"可能被未来会话读成当前范围能力。
- **最小修订**:在 Unit A 写一句"逐条内容基准是草稿 §7.x G 结论全文(含限定词、历史映射、修订台账),record 仅作目录";或直接在 record 两处补回括号限定。**处置**:CONFIRMED(事实)+ 修订建议;不需 Dexter 裁决。

### N-2:触发矩阵缺零成本自查抓手

- **位置**:proposal §5.1 行 78("涉及 G-01–G-12 的任一对象/关系/禁推")。
- **业务影响**:命中判定全靠 agent 自觉;漏判即绕过。
- **最小修订**:canonical corpus 文件头部附一份"命中词干清单"(每条 G 的中英文主叫法+禁用词,纯词表,供任务开始时人工/机械对照自查)——它是查找索引,不是语义 checker,不违反 `MACHINE_GATES_MECHANICAL_ONLY`。不需 Dexter 裁决。

### N-3:parked 台账只收 08–22,01–07 域的未确认残余缺归属

- **位置**:proposal §4 行 65、§6 行 97–99;record §6 行 221–224。
- **业务影响**:StoreOperationType(实体 vs 枚举)、OrgScope、03 域合同之外的商业关系实体群等属 01–07 域但未被 G-01–G-12 覆盖;现设计里它们只散落在各条"待裁决"字段与草稿 §6,首次进入设计时没有像 08–22 那样的"诚实停下"台账兜底。
- **最小修订**:parked intake 初始登记增加一节"01–07 域未确认残余"(逐项列名+来源),恢复机制同 08–22。不需 Dexter 裁决。

## 授权边界

本 GO 仅表示纳入方案可交 Dexter 接受。不写入 project-memory,不确认 G-13+,不确认技术/contract 映射,不恢复 R3/W1,不授权业务代码、contract、数据库、DEV/seed/reset、动态运行或任何 Git 操作。Unit A/B 的执行须以 Dexter 对 proposal §10 的逐项接受为准;Git 始终归 Dexter。
