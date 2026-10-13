# TER T1 · R1 fresh reviewer input checklist

REVIEW_CYCLE_ID=TER_T1_IMPLEMENTATION_DESIGN_20261013
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=/root/t1_design_blind_r1

由主agent保存reviewer返回的真实读取披露；主agent不以“prompt要求读取”代替实际READ。

- READ：AGENTS、CLAUDE、PLATFORM-BLUEPRINT、doc/platform/README、scripts/README。
- READ_ALL：project-memory/index全部6kernel、deterministic-context-only。
- ROUTE_RUN：`scripts/memory/query --task-kind design --domain platform --consumer-face operations-admin --owner platform --impact architecture --trigger task-start`；全部26命中原文READ。适用sourceRefs回当前规范/模板/治理；无CBS变更的历史catalog/预算实施细节未采为本轮源码判据。
- READ：terminal-coding-standard全文、foundation-charter、implementation-task-template、review-standard、third-party-library-usage-standard；仓内cs-spec-to-plan、cs-review；四模板及review input模板；独立审查治理/验证治理/roadmap退役/service-shape/corpus采用/日志验收decision。
- TITLES_REVIEWED：doc/decisions根目录全部Markdown标题。
- CORPUS：T1/终端/主副机/主机/副机/terminal/TER；针对终端结构NO_CORPUS_ENTRY_MATCHED，TER子串误匹配拒绝；空间/组织/后台相关G01/02/03/05/10原文已读。
- READ_FULL：formal requirements17R/18V及SHA；discussion§1/11/13.1；详设/计划/附件全文及SHA见报告。
- READ_APPLICABLE：激活配对、更新C、远控三组Journey/IA/UI，激活大型UI/IA按相关呈现、admin、配置、阶段、断链与错误条款定向读取；后续凭证/日志裁决优先。
- READ_SOURCE：Runtime module/types/工厂/注册/资源/dispatch/limits；State types/descriptor/createStateRuntime/PersistenceEngine；feature-assembly、integration-assembly bundle/retry/replace及两App；State→Topology完整资格/收发；TDC credential/readiness/HTTP及五owner调用；config/defaults/revision/sync、Androidentry；APIpolicy/generator/schema/skeleton边界；native appcontrol/network/topology/Gradle/Expo/update-reload/两Apploading；当前driverparser/suites/aliases/Android/DEV/acceptance输入与cleanup源码。
- PER_CHANGE_PREWRITE_POSTPROOF：N/A，本次只有设计对象没有实现变更，不制造运行proof。
- AUTHOR_INTAKE_READ=false；无作者intake输入；先证伪形成独立verdict。
- NOT_RUN：生成、编译、测试、verify、DEV/Web/Android/设备/reset/seed/L2/UAT部署及cleanup；未读.runtime。
- 限制：当前接缝与能力组审查，不声称所有叶子组件/native分支全量语义运行证明。
