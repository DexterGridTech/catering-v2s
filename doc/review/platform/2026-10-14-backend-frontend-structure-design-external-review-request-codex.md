# 前后台重点代码结构优化 · 外部 Claude 设计评审请求

## 背景

Dexter授权编写详设/实施计划并对抗审查直至无阻断；本包仅文档设计，未实施或运行。R1为NO-GO 0/5/2，R2为NO-GO 0/1/0，读足后先独立verdict的整包R3为NO-GO 0/1/0（仅新Node测试入口登记）；原报告和阅读限制均保留，主agent不代写GO。R3确认项最小文档修订后按Dexter本次“直至go”送fresh R4差量复核，同cycle不重置，不重复未改production审计。R4独立结论为GO_WITH_UNVERIFIED_UI，0M/0S/0N；精确范围是Node测试入口设计差量/同根与三当前文档完整回读，不冒称从零整批review。当前已确认设计阻断已闭合，内部审查收口；待外部Claude独立整包判断。

当前输入SHA：需求378cdeae15b2b0b90a9b95d0cda865ff3930a898f2969ca41566191eda694f47；详设87e382793739557ad3ef524c59d9ec5d04fde7bad66abf56fcc1b59c339eb921；计划64fbf23fe057ab867728b57d6d29f14d8cf04c2a734142cd98d72de24b5855f0；附件2872ac8713ca0e48edb1dfa1560d8b317cd94b4aa0bd798fac418cf9de4e30ce。原需求旧评审不代表当前设计结论。

## 评审目标

从需求、项目规范、现生产调用链独立判断是否解决维护住址混乱/重复/越界/分散资源身份，而不是仅文档自洽。检查纯提取和foundation接入是否保留真实业务事实、公开/事务/权限边界，控制面和计划是否足够具体又不过度设计。

## 需阅读文件

- doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md：需求正本。
- doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-design-codex.md：详设。
- doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-plan-codex.md：CP/验证/交付顺序。
- doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-source-and-verification-appendix-codex.md：精确source、十四operation、TestIds/fixture/控制面/依赖。
- doc/review/platform/2026-10-14-backend-frontend-structure-design-review-{inputs-r1,inputs-r2,inputs-r3,inputs-r4,r1,r2,r3,r4,intake}-codex.md：独立输入、原报告、作者处置；请先独立判断再读报告/intake。
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md；project-memory/index.md全部kernel、deterministic-context-only及六维命中原文/sourceRefs；doc/platform/{backend-coding-standard,frontend-coding-standard,foundation-charter,review-standard,implementation-task-template,third-party-library-usage-standard}.md和四模板：适用判据。
- 详设§0点名既有Journey/IA/UI；附件§1–6当前owning source及直接测试：真实行为与接口依据，不把旧源码当新实现PASS。

## 独立核验重点

R01–17/V01–18闭包；catalog纯闭包事实输入/asset资源生命周期；双目标additive生成与TER手写边界；五feature窄入口和菜单注册；六资源/foundation/单会话；扩展对象全链与排序/legacy退役；逐动作节点；policy/P1/L2父run及有效工件交接；focused H先L2与full H最后；seed dry-run/日志两轮/cleanup；延后项与不扩生产拓扑。

## 期望结论

独立GO或NO-GO与M/S/N；静态无阻断但UI未证按review-standard给GO_WITH_UNVERIFIED_UI。每finding给需求/详设/源码精确行号、事实/推论、反例、影响、最小修正及Dexter裁决；列L1/L2/L3、SAME_ROOT_SCAN、四模板TEMPLATE_COVERAGE、DESIGN_GAPS和证据档位。仅静态review，不复跑或索取运行证明。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《前后台重点代码结构优化》详设与实施计划做一次外部独立静态 DESIGN review。

背景：Dexter已授权根据当前正式需求与项目规范编写完整设计包。已完成详设、实施计划与源码/验证附件，并按“直至go”完成独立审查与最小处置。整包R3为NO-GO 0M/1S/0N（Node测试登记），修订后fresh R4差量复核为GO_WITH_UNVERIFIED_UI 0M/0S/0N；R4只覆盖该差量/同根及三文档回读，不冒称从零整批review。原报告/轮次/读取限制及intake均保留，内部审查已收口。请按当前字节独立判断，不继承任何旧verdict或作者处置；本次是Dexter转交的外部整包评审，不重开需求cycle。

目标：判断方案是否真正减少重复事实、跨feature内部泄漏、Page资源身份分散和owner职责混杂；检查是否简单、可实施、可验收，保留现业务/API/事务/锁/CAS/幂等/审计/readback与两个后台边界，不把TER机制搬进前后台。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md：正式需求。
- doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-design-codex.md：详设。
- doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-implementation-plan-codex.md：实施顺序和交付门。
- doc/plans/platform/2026-10-14-backend-frontend-key-code-structure-source-and-verification-appendix-codex.md：文件/operation/控件/fixture/控制面与依赖依据。
- doc/review/platform/2026-10-14-backend-frontend-structure-design-review-r3-codex.md、doc/review/platform/2026-10-14-backend-frontend-structure-design-review-r4-codex.md、doc/review/platform/2026-10-14-backend-frontend-structure-design-review-intake-codex.md：整包/最终差量独立报告与作者处置；intake链接原R1/R2，请先独立核验再对照。
- AGENTS.md、CLAUDE.md、PLATFORM-BLUEPRINT.md、doc/platform/README.md、scripts/README.md；全部kernel、deterministic-context-only及适用六维memory/sourceRefs；backend/frontend规范、foundation-charter、review-standard、implementation-task-template、third-party标准和四设计模板。
- 详设§0所引既有Journey/IA/UI，附件§1–6所列当前owning source、调用者与直接测试。

请重点独立核验：
1. R-01～R-17/V-01～V-18与CP、具体文件、场景档位及业务断言逐项闭合；B4/B5延后、B7现构造、公开模型/权限/事务边界没有偷渡。
2. asset两wrapper与唯一流式生命周期；catalog来源字段、纯闭包与IO分开；topic/canonical、远控同renderer双目标additive生成，TER手写不接入。
3. 菜单注册/授权、五feature窄出口、六读取资源foundation复用，launcher唯一session与Workspace受控身份；相同名称不等于相同排序/领域状态。
4. 十Drawer/十四operation、edge/seed/acceptance对象SET/CLEAR/omission/false/0/DATE及legacy退役；真实HTTP证明和保留的合法反例。
5. 六case逐动作TestId/真实节点、admin-ui policy/P1/受管入口、隔离TDS与wire在线fixture、现update.artifacts导出交接/cleanup是否准确可执行；不制造假ONLINE/ACTIVE或新runner。
6. focused H先于对应L2、最终full backend-acceptance晚于全部改动、首次L2前完整seed dry-run、日志链与两轮动态前查漏；不重复未改对账/完整矩阵，不擅自reset/seed。
7. 新增四个Node测试与现五项缺登记只同步既有nodeTestFiles元数据、真实root/red及controlPlaneFiles；不增加新checker/runner，不默认--node全集或完整verify，不把登记当seed/LiveKit运行授权。

烦请给出明确 GO / GO_WITH_UNVERIFIED_UI / NO-GO 与 M/S/N。每条finding写精确需求/详设/当前源码文件与行号、事实或推论、反例、影响、最小修正及是否需要Dexter产品裁决；并列方案合理性、四模板TEMPLATE_COVERAGE、L1_ENGINEERING/L2_USER_VISIBLE/L3_UNVERIFIED、SAME_ROOT_SCAN、DESIGN_GAPS与证据档位。

证据边界：仅静态设计/源码读取。所有实施、生成、编译、测试、verify、H/L2、DEV、seed和cleanup均NOT_RUN，UI/节点与控制面实际准入仍OPEN/BLOCKED。不要把计划、旧源码或测试文件当运行PASS。

授权边界：本请求只用于完整设计包静态评审，不授权实施、修改需求/规范/记忆/源码/测试/生成器/依赖，或任何构建、测试、verify、DEV、reset/seed、Web、设备、L2、UAT、部署。仅可在doc/review/platform/新写一份以-claude结尾的独立评审交付物，其余只读。谢谢。
```
