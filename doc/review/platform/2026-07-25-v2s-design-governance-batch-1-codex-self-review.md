REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=DESIGN-GOVERNANCE-BATCH-1
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2

# 设计法治第一批 Codex 对抗式自审

## 用户任务

业务用户不是当前的后台操作者，而是未来每个被设计 Journey 的真实 actor。其用户任务
必须先有可追溯的身份和数据前提，才能谈登录、进入页面、提交操作和看到 owner readback。
Dexter 需要一套足够小、可让他先看交互图并裁决的设计管线，避免 AI 从接口或测试便利
反推业务；本批的用户任务是为后续设计提供这种前置判断，而不是替用户设计新的业务。

## Dexter 立场

Dexter 已明确暂停 R3-J02，优先建立完整设计规范体系；第一批只建规范、冻结后送 Claude，
每批应在评审者约半小时内核完。Dexter 同时禁止借此授权实现、contract、数据库、DEV
或 Git，且要求 J02 待回收而不废弃。因此本批必须只改治理落点与机械引用校验，不能
决定首位运营用户、邀请链、R3 新 Journey 或任一业务页面。

## 替代方案

1. **只写一条“以后画线框”提醒**：成本最低，但无法要求前提链完整，也无法发现 UI
   unit 忘记交互工件；不选。
2. **把所有 UI 合理性编码成 checker**：表面完整，但机器无法理解业务前提、线框质量
   或更优路径，会制造伪语义门；不选。
3. **建立完整设计平台、图形编辑器或大量图表规范**：可能更强，但超出当前问题且违背
   小批量成本；不选。

选择的最小方案是两个 Markdown 模板、Dexter 看图前置、一个只验证 path/unique anchor
的机械补充与两条人工 checklist。它保留 Claude/Dexter 的语义判断，不扩大实现面。

## 方案合理性

问题明确：现行 policy 已要求 UI 任务合理性，却没有可审查的交互工件落点；实际设计
又把登录误归为技术 shell，导致前提链缺失。方案把“前提链三选一”和“线框先看”放在
implementation-facing design 之前，直接阻断同类遗漏。

复杂度控制在五处已有治理表面和两个模板内；唯一代码变化只验证文件路径与唯一锚点，
并带两项真红变异。收益是让 Dexter/Claude 能在业务实现前看见缺失身份、入口和恢复
路径。代价是 UI-bearing Journey 多一份人工工件，但相较错误设计登录/邀请流后的返工
更低。非 UI Journey 仍可明确 `NOT_APPLICABLE`，不被强迫画图。

## UI 与交互

NOT_APPLICABLE：本批不交付任何 end-user UI、route 或登录交互；理由是它仅建立未来
UI-bearing Journey 的交互工件模板与审查次序。模板本身要求每个未来 UI 屏幕提供
interaction map、可看图的低保真线框、状态/边界、逐操作任务合理性以及 face/owner
对齐，并要求 Dexter 在 implementation-facing design 前看图。当前不画 operations 登录
或邀请线框，以免暗中选择未获批准的首用户 Journey。

## 审查意见复核

`CONFIRMED`：Dexter 指出的“无用户前提却设计登录”经重新打开 J02 selection、confirmed
corpus G-05/G-07、当前 J02 design/manifest 后成立；证据显示 J02 禁止账号/任职/角色，
而设计仍声称 operations 登录。反例是纯后台/无用户动作 unit；它们可以适用
`NOT_APPLICABLE`，理由是它们不涉及用户可见 UI 或交互，故本批只要求 UI-bearing unit
引用工件。

`PARTIALLY_CONFIRMED`：需要线框的意见适用于 UI-bearing Journey，不适用于所有技术
unit；因此采用低保真、可审阅线框而非视觉稿或统一组件库。更小替代是只要求文字状态
表，但它无法让 Dexter 直观看到信息层级与操作路径，收益不足。

`REJECTED_WITH_EVIDENCE`：把前提链或线框质量做成关键词/语义 checker 的建议不适用。
依据 verification governance 的机器/语义分工及 checker 源码复核，机器只新增存在性和
唯一锚点；缺失引用、重复 anchor 的红例可重现，业务语义仍归独立 review 与 Dexter。

## 闭环核验

- 新 decision 明确模板、顺序、机械/人工边界、既有 policy 引用和 J02 回收台账；
- Journey 与 UI 模板分别覆盖 Dexter 要求的前提链、禁推、corpus 命中、interaction map、
  线框、状态/边界、任务合理性和 face/owner 对齐；
- `cs-spec-to-plan` 与方案合理性 policy 只引用本批而不复制正文；standards checklist
  追加两条人审项；
- granularity checker 自测通过，包含 missing UI interaction artifact 与 duplicate anchor
  两条行为真红；R3 standards coverage、Roadmap registry 与 project-memory 检查均通过；
- 未开始第二批 inventory，未恢复 J02，未执行应用、contract、数据库、DEV、动态运行或
  Git。

## 结论

VERDICT=GO
M=0
S=0
N=0
NEXT=冻结第一批并送 Claude；只有 Claude review 与 Dexter 接受后，才可讨论第二批 R3–R6 Journey inventory。
