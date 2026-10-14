# 前后台重点代码结构优化 · 外部静态需求评审请求

## 背景

Dexter已接受分析稿五项建议。正式需求经三轮fresh独立审查及主agent处置，最终GO、0M/0S/0N；每轮仅对应各自SHA。当前需求SHA为`07ebaf95e16e78b1951ae52ca65e38bb5d451bfd757f87a09e667bfd7a232120`。此处仅准备Dexter转交材料，未声称已送达Claude。

## 评审目标

独立判断需求是否忠实于原目标、边界明确、符合前后台现规范、简单且可实施/可验收。静态需求GO不代表详设或实现GO。先独立形成判断，再读作者intake与历史结论。

## 需阅读文件

见下方话术的仓根相对路径；需求/分析/TER源材料、适用标准与当前源码为判据，review与intake仅为后读线索。

## 独立核验重点

核验D01–05、14问题族、R01–17/V01–18；现公共准入与底层类型不能互推；保护事务、授权与真实业务事实；有复用不等于真实接入；未实施不等于本阶段需求缺失，不新增框架或极端场景义务。

## 期望结论

明确GO/NO-GO与M/S/N、精确需求/规范/源码位置、事实/推论/影响/最小修正与Dexter裁决项，另列方案合理性和未验证范围。依review-standard如有本阶段真实UI未决项则GO_WITH_UNVERIFIED_UI。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《前后台重点代码结构优化》正式需求当前字节做一次独立静态需求评审。

背景：Dexter已确认问题分析稿中的五项建议。正式需求已完成三轮fresh独立对抗审查与逐项处置，最终结论为GO，M/S/N=0/0/0。此前结论只对应各自审阅字节；本次请重新独立判断，不继承历史verdict或作者intake。本次是Dexter转交的外部评审，不重开此前内部cycle。
当前需求SHA-256：07ebaf95e16e78b1951ae52ca65e38bb5d451bfd757f87a09e667bfd7a232120。

目标：先理解本专项解决的维护问题，再判断需求是否忠实落实Dexter裁定、职责和整改范围是否清楚、是否符合现有前后台架构，以及是否简单、可实施、可验收。请主动寻找反例和更小方案，不因追求目录统一或极端完整性扩大整改。

请从catering-v2s仓库根阅读：
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md：入口、协作与授权边界。
- project-memory/index.md的全部kernel、project-memory/decisions/deterministic-context-only.md，以及六维路由命中的适用原文和sourceRefs；project-memory/decisions/confirmed-business-language-corpus.md及其读取政策：事实与禁推边界。
- doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md：唯一被审正式需求，D-01～D-05、R-01～R-17、V-01～V-18。
- doc/plans/platform/2026-10-13-backend-frontend-code-structure-problem-analysis-discussion-codex.md：原始任务、问题族与五项建议来源。
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md：共性模式来源，不是将TER机制移植前后台的授权。
- doc/platform/backend-coding-standard.md、doc/platform/frontend-coding-standard.md、doc/platform/foundation-charter.md、doc/platform/review-standard.md、doc/platform/third-party-library-usage-standard.md、doc/platform/implementation-task-template.md：适用规范与后续详设义务。
- 正式需求§4引用的canonical、生成器、CBS/TDS、两后台及admin-ui-foundation源码：仅按关键事实和可行性需要只读核验。
- doc/review/platform/2026-10-13-backend-frontend-structure-requirements-review-r3-codex.md、doc/review/platform/2026-10-13-backend-frontend-structure-requirements-review-intake-codex.md：请在独立形成判断后阅读，核对历史字节、处置与轮次授权记录，不作为当前结论的证明。

请重点独立核验：
1. 五项建议与14个问题族是否完整落入本期要求；Catalog纯页签与IAM公开FQCN迁移是否清楚留在后续范围；B-7是否避免为少量构造代码新增容器或registry。
2. 是否保留既有业务、Journey、数据库、公开HTTP契约、Java公开类型、事务、授权、锁/CAS、幂等、审计和权威readback；是否避免照搬TER的declarations、actor/selector或ParameterDefinition。
3. topic合法闭集、binding授权与SQL分类是否区分；远控协议类型及运行闭集是否从现生成链派生；资产共享物化是否保持实际公共准入，未从私有视频分支或读引用形状推导视频上传能力。
4. catalog纯规则与聚合关闭责任、Page独立异步资源、远控会话起止、菜单准入、窄feature接口及现foundation复用是否有清晰住址；是否存在重复事实或新增框架。
5. 扩展字段对象适配是否保持真实JSON值、SET/CLEAR、null、省略、DATE、false/0及required语义；是否保留仍有消费者的legacy支路，避免仅用cast掩盖实际数组。
6. 主数据标签与领域状态是否区分；R/V验收是否可证伪，既不靠存在性判断，也不要求当前需求阶段伪造未来详设、测试或动态证明；是否准确保留R-READ-07最终验收义务和动态前日志/两轮查漏要求。

请给出明确GO或NO-GO与M/S/N。每项finding请列精确需求条款、仓根相对路径和行号、事实或推论、影响、最小可验收修正及是否需要Dexter裁决；单列“方案合理性”、DESIGN_GAPS和未验证项。没有finding也请明确说明，并披露本会话是否fresh。若确有本阶段未决UI项，按review-standard给出GO_WITH_UNVERIFIED_UI，不将未来实现NOT_RUN自动判为当前需求阻断。

授权边界：本次仅授权静态需求评审与必要纯读取，不授权详设定稿或实施；不授权修改需求、规范、记忆、生产源码、测试、生成器、契约或依赖，不授权生成、编译、构建、测试、verify、DEV、reset/seed、Web、Android/设备、L2、UAT或部署。可仅在doc/review/platform/下写一份文件名以-claude结尾的评审交付物。不读取.runtime/或要求运行证据；本次结论不代表实现或动态通过，也不扩大在途TER T1范围。谢谢。
```
