# TER 更新正式需求 · 主 agent finding intake

本文件是作者处置，不是独立 verdict。Dexter仅授权完整需求和两轮DESIGN审查；主agent唯一写入，reviewer纯只读。原始裁决全文与真实源码已在写入前/后重开。

## 第一轮

Reviewer `/root/ter_update_formal_r1`，fresh无作者上下文，NO-GO 0/1/2；原SHA `3a7fa3cb70aeadeeab5c6a8866a7fe8f46b792e3661f813de68d5a59994545b4`。report与checklist见同日r1文件。原verdict保留不变。

| Finding | 作者核验 | 反例/最小替代与处置 | 当前需求位置 |
| --- | --- | --- | --- |
| S-1 | CONFIRMED；讨论稿§3:43确有每次新JS发布变化，正式R-01漏掉 | 恢复已有变化要求；同App/平台/runtime的版本冲突拒绝是作者具体收敛范围，交R2核验，不是R1已指定的范围。相同内容/跨空间不误作新发布。拒绝增加第五版本、全局严增序列或设备盘点 | R-01:43/52；V-01/V-03 |
| N-1 | CONFIRMED为验收oracle补充，非产品未决；R-06/R-10既有语义仍成立 | V-07无规则零动作、V-09同目标/更高JS零动作、V-15失败本boot不另领/下boot不同修复工件可执行；V-17已保留同坏工件不自动重试 | V-07/09/15/17 |
| N-2 | CONFIRMED为通用flush措辞歧义；讨论稿§19.2:561及state flush真实队列支持 | R-11回指及R-12明确FULL/HOT受控边界，V-20同根失败零提交。仅在可控移交边界flush，不承诺未来输入已落盘，不增加全局锁/备份 | R-11:173、R-12:183、V-20 |

主agent另作引用清晰化：§16来源表改为完整真实仓根路径，V-01的JS9→10示例改成1.0.9→1.0.10；不改产品目标或增加验收机制。

修订后全文SHA：`6da24f4e14c6f3a29bf27b57206145961363dbea9e42d576e9ec0a84c37ea04b`。仅需求及review文档写入；全部新实现/动态仍OPEN/NOT_RUN。此修订不是独立GO，交第二轮fresh reviewer全文审查。

## 防再犯与有限适用范围

发布排序不能代替发布变化；有状态结果不能代替无副作用oracle；一节标题不能收窄通用受控重启持久边界。落点为正式需求R-01/R-11/R-12与V-01/03/07/09/15/17/20及本轮review清单。反向边界：同内容/native-only不滥增JS版本；零动作仅适用于确实无目标/已满足原生前提；FULL移交后的系统行为不是flush保证。无需新增台账、prompt hook、自然语言机器门或通用恢复机制。

## 第二轮

Reviewer `/root/ter_update_formal_r2` 在读取作者材料前已独立形成需求GO、M/S/N=0/0/0；review-standard标签为GO_WITH_UNVERIFIED_UI。第二轮输入SHA仍为`6da24f4e14c6f3a29bf27b57206145961363dbea9e42d576e9ec0a84c37ea04b`；原话/需求/源码独立核验后才对照intake及R1 findings，没有继承旧verdict。

| 前轮项 | 第二轮独立复核 | 主agent处置 |
| --- | --- | --- |
| S-1 | CONFIRMED_CLOSED，含作者同App/平台/runtime的具体边界及相同内容例外 | CONFIRMED；保留R-01与V-01/03修订，不增全局JS序列或设备盘点 |
| N-1 | CONFIRMED_CLOSED，零动作、失败本boot/后继boot与坏工件区分 | CONFIRMED；保留既有V-07/09/15/17，不新建恢复机制 |
| N-2 | CONFIRMED_CLOSED，FULL/HOT受控flush及真实失败结果 | CONFIRMED；保留R-11/12与V-20，不增全局业务锁/备份 |

R2无新增finding/需求DESIGN_GAPS，也无新增Dexter产品裁决。主agent核对其引用与当前条款一致；本轮后不再修改需求字节。其报告中的L1/L2 PASS仅是需求/任务静态判断，新增功能全部NOT_RUN，native/依赖/资源/installer/恢复等工程OPEN保持。SELF_DECIDED最终综合由第二轮独立reviewer给出，作者仅归档与intake；cycle已到两轮硬停止点，不增加第三轮。

交付正本、两轮report/checklist及本intake均已保存；当前任务仅需求及两轮审查，不授权后续设计、实现或动态运行。
