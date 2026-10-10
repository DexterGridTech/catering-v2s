# C project-basic 职责追加：独立对抗评审输入

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=TER-UPDATE-C-PROJECT-BASIC-OWNERSHIP-2026-10-10
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED

R1独立原始报告为NO-GO 0M/1S/1N，仅绑定其中六份旧SHA；R1后Dexter最新同command两listener澄清在当前输入列出。本文件现为R2输入，R1原报告及旧输入边界保留，不将当前输入追加追认为R1已读。

新 cycle 的依据是 Dexter 实质增加并改变 owner 范围：此前 C 未包含 project-basic 建包及 store-basic 项目/大区/集团资料搬移；本次明确增加，并要求跨包升级走 command→actor。2026-10-10 再明确“写完要对抗性review一下，确保各个包不越界”。只审新增职责和其对 C 既有路径的影响；不重开旧 C R1～R4 或外部周期。

## 用户授权原文及范围

- “写到阶段C中吧，很明显需要把包的职责和逻辑归属要分开，终端版本规则是属于业务数据，需要放到feature中”
- “同时，要把原本在store-basic中的，属于项目实体的信息，也移动到project-basic中去，比如项目、大区、集团信息等”
- “terminal-update要有command和actor，project-basic有版本信息需要升级，就发command”
- “写完要对抗性review一下，确保各个包不越界”
- 审查期间同scope澄清：“store-basic有了具体的store信息后，project-basic才去加载project信息，有先后顺序”。先具体门店数据保存成功，再加载组织/规则；不能凭active或hydrated状态首查project，合同/服务点不因此依赖project。
- R1后最新同scope裁决：“store-basic有了具体的store信息后，发送自身的command，自身再去加载其他信息，project-basic收到这个command才去加载project信息，有先后顺序”。当前修订采用同一storeBasicInformationLoadedCommand的两个owner listener；store后续加载在自己的listener内，不能等广播聚合结束；project初始HTTP只从收到该command的handler进入。不得用R1建议的异步调度替代此最新规则。

只读审查；只允许纯读取命令与 memory query。不得写入任何文件（包括review）、改源码/规范/需求/A/B文档、读取.runtime、运行生成/编译/测试/verify/DEV/Web/Android/设备/reset/seed/部署/Git。报告全文及输入清单返回主agent，由其唯一写入。不把旧 verdict 或作者材料当结论，不因动态未运行要求增加本轮 evidence。

## 最小输入清单（reviewer逐项记录实际读取）

| 必读输入 | 路径/操作 | 记录 |
| --- | --- | --- |
| 执行入口 | AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md | 待reviewer |
| 全部kernel及deterministic | project-memory/index.md的6个kernel、project-memory/decisions/deterministic-context-only.md | 待reviewer |
| 六维与全部命中原文/source refs | scripts/memory/query --task-kind design --domain platform --consumer-face backend --owner frontend-platform --impact architecture --trigger task-start；全部命中及适用原文 | 待reviewer |
| corpus | confirmed-business-language-corpus.md；搜索项目/大区/集团/终端/版本及不得推导边界 | 待reviewer |
| 六份对象全文 | doc/decisions/2026-10-09-ter-update-automatic-execution-and-pair-{journey,ia,ui-interaction}-claude.md；doc/plans/platform/2026-10-09-ter-version-update-stage-c-{implementation-design,implementation-plan,source-and-api-appendix}-claude.md | 待reviewer |
| 原始需求、A/B设计 | doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md；2026-10-06-ter-version-update-stage-a-implementation-design-claude.md；2026-10-07-ter-version-update-stage-b-implementation-design-claude.md及附件§接口；2026-10-03-v2s-tdp-data-change-and-remote-operations-formal-requirements-claude.md | 待reviewer |
| relevant decisions | 列doc/decisions标题，全文读取相关terminal架构、owner/state/command、review治理决定 | 待reviewer |
| 模板与规范 | 四份Journey/IA/UI/implementation-design模板；implementation-task-template、terminal-coding-standard、review-standard、foundation-charter；2026-07-24-v2s-verification-governance及2026-07-25-v2s-independent-subagent-adversarial-review-governance；适用frontend/backend/third-party规范 | 待reviewer |
| owning source | store-basic/types/actors/slice/selectors/module/test；terminal-update/types/actors/slice/module/selectors/test；两个integration src/assembly/assembly.tsx与依赖/测试；TDC topic接受/订退、state hydration/reset、topology record apply资格 | 待reviewer |
| pointwise双读/focused | 本轮只是设计修订，无实现/focused；核实际源码可复用依据及计划覆盖，不推成实施证明 | N/A：本轮无源码改动 |

## 证伪重点

读取边界：六份C对象、原始正式需求、治理/四模板、入口/kernel及命中memory原文完整读取。A/B设计完整读取本次owner、业务资料/规则、command/selector、固定task/报告和前提的适用章节；无变更的installer/后台布局不重评。owning source与测试完整读相关函数/调用链/用例，terminalUpdate测试中的纯native/ZIP旧case不要求重复；frontend/backend规范只读适用owner/依赖/同步/事实和设计章节。在实际清单写明读取范围，不把片段写成全文或旧case通过。

1. 项目/大区/集团/规则只有project-basic owner；store retains store/合同/服务点，不循环等待；base不反向import feature，integration零业务编排。
2. 业务候选经公开local command→update actor；selector仅读；actual/版本比较/固定任务及N/M/执行/报告留base。固定target执行事实不可误删为业务副本；不用新callback/getter机制绕command/selector。
3. 启动、广播先后/晚安装、当前周期/hydrated、scope变更、保存flush/具体topic接受、main/branch独立资格和同步两entry闭合。
4. 移除旧descriptor/selector/topic后真实hydration与orphan行为；保留existing fixed task；不建兼容层/迁移reset；移动测试、publicExports、assembly和依赖齐全。
5. 六工件/CP/场景/资源矩阵一致，找同根反例和更小修法；不扩大设备run或极端机制。

## 输出

先证伪并写独立verdict，再读作者处置（本轮未提供）；返回完整输入清单、独立盲审声明、方案合理性、模板覆盖、抽取的事实与矛盾、逐项finding（精确路径/行号、事实/推论、影响、最小修正、Dexter裁决需求）、同根成员、DESIGN_GAPS、未验证项及review-standard §5 verdict block。GO/NO-GO/GO_WITH_UNVERIFIED_UI、M/S/N如实；UI未运行不能写裸GO。不要写文件。
