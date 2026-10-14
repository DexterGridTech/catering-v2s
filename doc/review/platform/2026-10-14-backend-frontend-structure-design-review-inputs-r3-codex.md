# 前后台结构优化 · Dexter追加的fresh当前字节复核

REVIEW_CYCLE_ID=BACKEND_FRONTEND_STRUCTURE_IMPLEMENTATION_DESIGN_20261014
REVIEW_TARGET=DESIGN
REVIEW_ROUND=3
ROUND_AUTHORITY=DEXTER_EXPLICIT_UNTIL_GO
reviewerKind=INDEPENDENT_SUBAGENT

本次Dexter最新直接指派：“请根据项目设计规范，和需求文档，生成详设和实施计划，并完成对抗式review，直至go，最后将详设和实施计划给另一个Claude做review”。本次追加按该明确目标执行，仅修确认设计项并fresh审查至无阻断；保留原cycle/轮次，不假重置R1，不将该会话授权变为长期规范。需求cycle不重开。主agent不能代写任何独立verdict。

## 授权与输入

只读静态review，可纯读取/query/hash。不得写文件/源测试/规范记忆/依赖，不生成/编译/test/verify/DEV/数据/设备/L2，不读.runtime，不Git。主agent唯一存档与修文档。

先完整完成以下**适用最小输入**并证伪当前设计、独立形成verdict，再读任何R1/R2/intake；禁止部分输入尚未读完就对作者材料。历史无关内容具名N/A，不强制巨型文件全库分母。

1. AGENTS.md、CLAUDE.md全文；PLATFORM-BLUEPRINT/doc/platform README/scripts README适用正文；本仓cs-review/cs-memory-recall。用户授权即本表。
2. index全部kernel、deterministic-context-only，design/backend/backend/backend/architecture/task-start及design/admin-ui/operations-admin/frontend-platform/architecture/task-start全部命中原文和适用sourceRefs/corpus。对每个适用原文读足具体章节，sourceRefs中无关领域具名N/A；不能将导航当规则。列doc/decisions标题并读取实际相关原文。
3. 正式需求全文doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md及其讨论原话；三当前工件全文同目录2026-10-14-backend-frontend-key-code-structure-{implementation-design,implementation-plan,source-and-verification-appendix}-codex.md，亲算SHA。
4. 四设计模板全文；backend/frontend规范、foundation-charter、review-standard、implementation-task-template、third-party标准本批适用条款；独立review/verification/日志/browser-L2正本。本批不改产品/页面，适用原IA/UI条款按详设0精确锚点重开；无关原screen/历史版本不作新分母。
5. 生产/直接测试按附件1–6每个**变更责任**的可达闭包核验，不把不相关巨型类逐行当条件：Protocol/Codec与测试/canonical、双目标generator；asset两wrapper/stage/test所调用fixture；Catalog纯validator/assembler/ItemRow来源/IO/构造事务及相关集成测试fixture；registry/五窄入口/十Drawer十四variant/mapper/七seed；六资源/hooks与foundation；Remote Workspace/start/register/grant/end/Room生命周期；admission/bootstrap/源run builder/export/import/cleanup/受管TDS/wire。源代码尚未改，测试只是当前判据。
6. 本轮实际修订点是wire只能STARTING，无register/description就不能Room；L2保持真实start/end/焦点，Room F留原mock seam，去掉新LiveKit可达性门。请独立重开owner start/register/grant/readback与Workspace所有相关effect/end。扫描全部六case及设计/计划/附件对应条款，查缩减有没有漏保留原V11义务，不造假actor/media。同时检查输入/计划整体可执行性与R01–17/V01–18。

全部以上读完并先独立形成findings/verdict后，可读同目录2026-10-14-backend-frontend-structure-design-review-r1-codex.md、...-r2-codex.md和...-intake-codex.md作差异说明。原报告不足/先读作者的情况不能当本轮盲审资格，必须从当前source自己判断。

## 输出

完整报告只回消息，由主agent写：当前SHA/read order/适用输入闭合与N/A、GO/GO_WITH_UNVERIFIED_UI/NO-GO M/S/N；精确条款/源码行号/反例/影响/最小修正/产品裁定；方案合理性、四模板逐节coverage、同根剩余成员；L1/L2/L3与DESIGN_GAPS，STATIC_ONLY。UI和F/H/L2/cleanup全NOT_RUN，不裸GO。若仅未知运行前提，可给GO_WITH_UNVERIFIED_UI并清楚列OPEN，不因不存在未来产物阻断设计。完成后不继续读写，不在作者修改后偷偷改原输入verdict。
