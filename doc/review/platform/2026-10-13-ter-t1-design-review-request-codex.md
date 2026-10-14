# TER T1 设计包 · Dexter转Codex外部静态复核

后续状态：本文件为前次设计复核请求与旧SHA边界，保留历史。外部意见已由主agent处置，Dexter最新明确授权修订完成后进入实施；当前字节/判断见同目录`2026-10-13-ter-t1-external-design-review-intake-codex.md`，最新授权及交接话术见`2026-10-13-ter-t1-implementation-authorization-handoff-codex.md`。下文原“仅静态/不授权实施”不替代后续Dexter指派，亦不重开内部cycle。

## 背景

Dexter授权编写T1详设/计划，并追加本次形成长期规范和项目记忆、后续新包必须遵守。需求静态GO 0/0/0仅绑定需求SHA b92a34101871a53341b334d02235bd301e03ebbebe840d39438302e21712443e，不是详设或实施授权。

内部新DESIGN cycle TER_T1_IMPLEMENTATION_DESIGN_20261013完成两轮fresh：R1 NO-GO 0/3/2、R2 NO-GO 0/2/0。作者逐项重开源码、只修确认文档；R2两项是带键UI关闭贡献及真实CBS候选与Web平台夹具publication关联。两轮已关闭，修订后完整对象尚无独立verdict。作者CLOSED只表示处置，不是GO；本次Dexter转交外部复核不重开需求或内部cycle。

## 目标与材料

请先从原始任务、需求、适用规范和真实owning source证伪，再参考intake。判断是否简单、职责清楚、完整可实施可验收，R01–17/V01–18、全包及跨App/native/生成/driver链是否闭合。

- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-formal-requirements-codex.md
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-requirements-discussion-claude.md（§1/11/13.1）
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-design-codex.md
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-implementation-plan-codex.md
- doc/plans/platform/2026-10-13-ter-key-code-structure-t1-owner-and-source-appendix-codex.md
- doc/platform/terminal-coding-standard.md（尤其§7.1/TR-R06/新增§8）
- project-memory/operations/terminal-coding-standard.md（正本指针）
- doc/review/platform/2026-10-13-ter-t1-design-review-r1-codex.md、…-r2-codex.md及各inputs
- doc/review/platform/2026-10-13-ter-t1-design-review-intake-codex.md（历史/当前SHA及处置）
- AGENTS、CLAUDE、全kernel/六维命中原文、foundation/review/implementation-task规范、cs-spec-to-plan和模板；实际Runtime/State/UI/Topology/TDC/五APIowner/config/native/唯一automation与生成器源码按附件重开。

当前三设计SHA依次d0de84daa9fca5aacc4a1d91f9f7e5aebed3a3da27f9cc8fb175b086b31939c4、284164bd74721a3b2ef50cd4da84032b5dd1d42db7cad9ea805de5ad1a12a13c、c75f3071440c4079ce33715a30b88673273aab9b818483f515d7014b3368028a；规范/memory SHA见intake§6。文件若再变，以当前读取字节为准，旧verdict不能转移。

## 独立核验重点

1. declarations集合和具名actor/slice/selector，errors与静态ParameterDefinition实际消费，39当前包与三个目标新增包，是否避免空文件/目录搬家/额外registry。
2. concrete definitions→Runtime描述；UI包自供贡献→bundle/retry；layerDismissals keyed Record合并/重复拒绝/owner恢复；同步资格由State registration派生、required projections仍业务准入，不复制名单。
3. 15operation五私有client→TDC唯一凭证窄command→transport；Runtime ID与现credentialRevision来源、逐请求receipt/status/problem/迟到/未知交付；binary边界。
4. package.json serverSpaces→具名环境集合→config/hydrate/sync/UI→transport→DEV/automation 1/2/10地址链；新native transport/topology与AppControl在update唯一reload共址，实际类型/Gradle/Expo边界。
5. Web update.owner-flow：真实CBS/project固定/grant/report/运营读回，现fixture依prepare传入artifact产生对应action/readback，不能重新用synthetic target；现tests与CP落点清楚，Web不证明nativeboot。
6. 规范和memory是否忠实于已接受需求，新包必须遵守且未来接口/机械门未实施边界清楚；README、公开面、模板、生成器及driver同步是否完整。
7. 完整CP/6b/13c、日志前置两轮TEST_CHAIN_PREFLIGHT、C/F→W→D、同清单业务oracle及cleanup，是否可执行；不重复对账未改内容，不复活旧runner/compliance台账。

## 结论与边界

请给明确GO/NO-GO与M/S/N，每项列需求/详设位置、仓根相对源码路径与行号、事实/推论、反例/影响、最小可验收修正与是否需Dexter裁决；无设计判据列DESIGN_GAPS。区分静态核验、未实现接口及NOT_RUN。

本次只做外部静态设计复核，不授权修改需求/设计/规范/源码/测试/依赖，不授权生成、构建、测试、verify、DEV、Web、Android/设备、reset/seed、L2、UAT或部署。设计review不提供实施权；不重开内部两轮cycle，也不联系正在实施的其他会话。
