# TER 应用内远程控制设计包外部评审交接

REVIEW_TARGET=DESIGN
REVIEW_STATUS=READY_FOR_DEXTER_CLAUDE_REVIEW

## 背景
Dexter授权编写完整设计包并独立对抗审查，强调只覆盖90%常见主流程、不增加保密或极端场景机制。六工件已完成。R1为NO-GO 0M/2S/4N，R2为NO-GO 0M/2S/3N；R2确认R1六项已关闭。作者亲自核验并最小修订R2五项，按SELF_DECIDED收口GO_WITH_UNVERIFIED_UI；修订后CURRENT_BYTES_INDEPENDENT_VERDICT=NONE，不能把作者收口当独立GO。原始两轮报告保留；外部评审不继承作者intake或此前verdict。

## 评审目标
独立核验真实任务能否由现有运营终端Tab/Drawer、CBS/TDP与LiveKit、TER owner/Android/peer链实现，规则和协议是否足以限制实施自由发挥，同时不越owner、不重复已有foundation或制造另一套runner。

## 需阅读文件
- `doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md`：需求正本与Dexter裁决；
- `doc/plans/platform/2026-10-10-ter-remote-control-requirements-discussion-claude.md`：原话、范围与技术前置；
- `doc/decisions/2026-10-10-ter-remote-control-journey-claude.md`：用户任务与corpus；
- `doc/decisions/2026-10-10-ter-remote-control-ia-claude.md`：既有Tab/Drawer与一个新全屏Modal；
- `doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md`：线框、控件、文案、隐藏mutation事实；
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md`：owner/事务/状态/command/selector/协议及R/V映射；
- `doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md`：CP顺序、准入与验收交付；
- `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md`：真实source、HTTP矩阵、TestIds/精确控制面、seed/设备；
- `doc/review/platform/2026-10-10-ter-remote-control-design-review-r1-codex.md`、`doc/review/platform/2026-10-10-ter-remote-control-design-review-intake-codex.md`、`doc/review/platform/2026-10-10-ter-remote-control-design-review-r2-codex.md`、`doc/review/platform/2026-10-10-ter-remote-control-design-review-intake-r2-codex.md`：先独立形成判断后再读，旧字节findings与作者处置及最终SHA。
从本仓入口、适用记忆、四模板与规范恢复；owning source按附件定位，不读取.runtime或运行evidence，不干扰在途阶段C。

## 独立核验重点
1. 读写授权分开：三个运营POST live grant，GET仅原read scope/发起者/终端归属且无写副作用；PG连接权威与顶层DTO字段。
2. 一套CBS terminal-control事实、既有TDP command/TDC认证、base command/actor/selector、同App精准peer与原Window registry，Android唯一Room和普通MotionEvent；不把automation生产化。
3. 六HTTP、六Data消息精确格式/方向/输入结果/seq/stream/gesture、独占/有限租约/断连手动再发起、两屏任一断连结束、局部与远程并用。
4. 三交互面、标准foundation、逐动作九列、唯一TestIds、14动作/观察行、精确L2控制面、seed角色/账号scope/fixture及五个交叉覆盖设备run。
5. T01～04官方/实际解析与原生桥proof仍OPEN：尤其custom frame到RN WebRTC track不是已证实的public能力。计划CP01先证明后冻结，失败停止，不准猜API或私有反射。
6. CP→全批6b→动态前准入→整批验证→13c→实施review顺序；最小技术proof可在CP内，不需要先伪造MATCHED；分开isolated L2与DEV/device，不能用fakeRoom证明实际输入。

7. 本次新增永久要求：全链诊断日志先行、两轮TEST_CHAIN_PREFLIGHT、首败定位/假设修复后focused重验；不重新打开当前DESIGN cycle，不增加日志平台或重复未改内容。

## 期望结论
明确GO或NO-GO及M/S/N；只有静态阻断关闭且仍有未验证UI时用GO_WITH_UNVERIFIED_UI。逐项精确文件/行号、事实/推论、影响、最小修正、是否需要Dexter裁决；列方案合理性、模板缺口、未验证项与设计缺口。不要把计划/历史结果当成当前PASS。

## 可直接复制给 Claude 的话术
```text
您好 Claude，烦请独立评审《TER 应用内远程控制》的完整设计包。

背景：Dexter要求只覆盖90%常见主流程，避免过度设计。Journey、IA、交互线框、详设、计划和source/API附件已完成。内部两轮分别NO-GO 0M/2S/4N与NO-GO 0M/2S/3N；作者已核实并最小修订全部确认项，SELF_DECIDED收口GO_WITH_UNVERIFIED_UI。修订后尚无独立verdict，原始两轮不改；请依据当前字节重新判断。
目标：确认方案真正解决“运营管理员看到并通过原控件协助操作终端”的任务，忠实于裁决、符合TER command/selector与owner架构，并使实施agent无需猜测核心链路。

请从catering-v2s仓库根阅读：
- doc/plans/platform/2026-10-10-ter-remote-control-formal-requirements-claude.md：正式需求；
- doc/plans/platform/2026-10-10-ter-remote-control-requirements-discussion-claude.md：原话与技术前置；
- doc/decisions/2026-10-10-ter-remote-control-journey-claude.md；
- doc/decisions/2026-10-10-ter-remote-control-ia-claude.md；
- doc/decisions/2026-10-10-ter-remote-control-ui-interaction-claude.md；
- doc/plans/platform/2026-10-10-ter-remote-control-implementation-design-claude.md；
- doc/plans/platform/2026-10-10-ter-remote-control-implementation-plan-claude.md；
- doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md；
- doc/review/platform/2026-10-10-ter-remote-control-design-review-r1-codex.md；
- doc/review/platform/2026-10-10-ter-remote-control-design-review-r2-codex.md；
- doc/review/platform/2026-10-10-ter-remote-control-design-review-intake-codex.md；
- doc/review/platform/2026-10-10-ter-remote-control-design-review-intake-r2-codex.md：最终处置与六工件SHA。
请先读需求、规范、当前设计与owning source形成独立判断，再读历史review/intake；恢复本仓AGENTS、CLAUDE、BLUEPRINT、全部kernel和六维命中记忆，不把来源导航当权威。

请重点独立核验：现有终端Tab/Drawer入口和全屏Modal；三个运营POST与纯GET的权限边界；PG连接状态、六HTTP和六Data协议；TDC唯一认证owner、base command/actor/selector、精准peer、唯一Window registry与普通触摸链；独占、有限租约、任一屏断连整体结束和本地并用；逐控件/TestId/L2文件、seed角色、五个设备交叉覆盖run、CP/6b/动态/13c顺序及简单性；六HTTP逐op错误闭集和判定先后；先关Drawer再开Modal、叠层1、互斥和焦点归还；原五查询/操作模板覆盖。
T01～04和阶段C最终出口仍OPEN，尤其原生帧导入RN WebRTC轨道尚无public API及真实proof；CP01须证明后才能冻结，不得把候选库说成已可实施。Dexter新要求已写入项目记忆、日志规范、设计/实施模板及本包§3.2/计划§2.1：动态之前先补整条链路日志，再做两轮fresh源码对抗审查，缺口关闭再focused运行，首败读日志定位而非反复重跑。当前两轮文档DESIGN审查不算未来这两轮源码准备。
三个交互面看图UNSET，所有新实现、生成、编译、测试、verify、Web、设备、DEV、seed与cleanup均NOT_RUN。

烦请给出明确GO或NO-GO与M/S/N；静态无阻断但仍有未验证UI时给GO_WITH_UNVERIFIED_UI。每项finding附精确仓根相对路径/行号、事实或推论、影响、最小修正及是否需Dexter裁决，单列方案合理性、模板覆盖、DESIGN_GAPS与未验证项。

授权边界：本次仅为外部独立静态设计评审，不重开已关闭的内部两轮cycle，不授权实施、规范/需求/记忆/依赖修改、生成、构建、测试、verify、DEV、reset/seed、Web/设备、L2、UAT或部署，不读取.runtime运行证据，不打扰Codex在途阶段C。谢谢。
```
