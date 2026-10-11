## 背景

TER 版本更新阶段 C 的实施已推进到 CP-01～CP-04 涉及的部分源码、测试与动态前诊断链；用户要求暂停后续实施，先让 Claude 对已实施部分做一次阶段性静态 review，以尽早发现同根问题并减少后续返工。

本请求不是阶段 C 整批交付 review，也不重开已关闭的 DESIGN cycle。当前状态必须准确保留：

- CP-01 的修复与 focused proof 已记录，但最新完整独立三维对账尚无结论。前两次 CP-01 对账为 OPEN；主 agent修复后启动的 fresh R3 reviewer 在用户要求暂停时被中断，故当前 `CP-01=OPEN/PENDING`，不得写成 MATCHED。
- CP-02、CP-03、CP-04 各有范围限定的 `MATCHED` 阶段记录；这些结论只对各自记录范围与当时核验字节有效，不能合并成全批 6b 或阶段 C 交付结论。
- CP-05、CP-06 尚未完成；全批 6b、逐代码 13c 与整批 IMPLEMENTATION review 均未完成。
- 动态诊断链有单独的两轮源码审查记录，R2 为 `GO, M/S/N=0/0/0`；该结论只覆盖动态前诊断源码，不证明业务实现或动态验收通过。
- 阶段 C 的 Expo Web、DEV、Android、双机配对及完整供给链业务场景均 `NOT_RUN`。本次不要求 Claude 运行这些场景或检查 `.runtime/`。

## 评审目标

请求 Claude 以 `REVIEW_TARGET=IMPLEMENTATION` 对当前已实施子集做 fresh、只读、静态对抗 review：从正式需求与阶段 C 详设独立推导应有行为，再逐条核对真实生产源码、直接测试和现有实现记录；重点判断跨 CP 接缝是否实际正确、方案是否保持简单、测试是否能揭示常见路径错误，以及是否存在会使后续动态验收反复失败的源码级缺陷。

本轮结论仅适用于“已实施子集”的静态源码质量，不得表述为 CP-01 MATCHED、阶段 C 整批 GO 或动态验收 PASS。未运行的动态证据不作为本轮 finding。

## 需阅读文件

- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：阶段 C 所依据的正式行为与边界。
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md`：阶段 C owner、行为、失败边界与实现判据。
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md`：CP 顺序、范围与 focused proof 要求。
- `doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-01-evidence-intake-codex.md`：CP-01 实际处置、当前 proof 与 OPEN 状态；作者记录仅作导航，须自行核源码。
- `doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-02-reconciliation-codex.md`、`doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-03-reconciliation-codex.md`、`doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-04-reconciliation-codex.md`：此前阶段级结论及其范围边界，不替代本轮源码核验。
- `doc/review/platform/2026-10-10-ter-version-update-stage-c-pre-dynamic-diagnostics-intake-codex.md`：动态前诊断链的实现范围、静态审查结论与未验证边界。
- `doc/platform/terminal-coding-standard.md`：TER owner、Runtime、凭证、同步及实现边界。
- `apps/terminal/kernel/feature/project-basic/`、`apps/terminal/kernel/feature/store-basic/`：项目/规则 owner 搬移、加载广播、snapshot 与业务数据刷新。
- `apps/terminal/kernel/base/terminal-data-client/`、`apps/terminal/kernel/base/terminal-update/`、`apps/terminal/kernel/base/runtime/`、`apps/terminal/kernel/base/topology/`：凭证与 TDS 调用、候选到固定任务的执行接缝、本机交互和生命周期、跨 Runtime 投影。
- `apps/terminal/ui/integration/`：console 与 wallpaper 的模块装配及调用者。
- `apps/backend/catering-business-server/modules/terminal-binding/`、`apps/backend/terminal-data-server/`：CBS credential-only 认证变化与 TDS 原有设备匹配边界。
- `contracts/openapi-source/terminal-binding.schemas.json`、`scripts/generate/r5-edge-materialize.mjs`、`scripts/generate/terminal-client-api.mjs`：认证契约 canonical 到生成客户端的来源链。
- `tools/terminal-automation/src/runner.ts`、`tools/terminal-automation/src/journeyFailureDiagnostics.ts`、`tools/terminal-automation/journeys/update.pair.android.test.ts` 及其直接测试：本阶段已实现的动态前诊断、suite 注册与失败输出；不代表 CP-05 的完整 runner/双机动态验收已经完成。

## 独立核验重点

1. **CP-01 owner 与加载闭环**：project-basic 是否实际独占组织路径和版本规则事实，store-basic 是否继续拥有门店、合同与服务点；store loaded command 的两个 listener 是否各自启动下游且不互等；迟到、重启、flush 失败、空/旧 scope、通知接受失败、分页/hash 变化耗尽等路径是否有可观察且不会误报成功的终态。
2. **凭证、契约及请求身份**：TDC 是否是终端凭证唯一 owner；MASTER→SLAVE 是否只同步完整 credential/null 且持久化成功后才使用；CBS 是否只凭业务凭证认证，而 TDS 是否仍按协议保留设备身份校验；canonical、materialize、codegen、generated client 与真实 caller 是否一致，是否存在第二条认证/下载旁路。
3. **CP-02/03 执行接缝**：本机交互事件和 presentation/ready 的观察、去重、释放是否绑定正确 Runtime；project-basic 是否只提交一条适用候选，terminal-update 是否在固定前重核当前事实、固定后不重选；FULL/HOT、跨 boot 与迟到观察是否可能丢任务、误报成功或重复提交。
4. **CP-04 共享凭证边界**：普通 CBS 请求是否由两端各自 TDC 直接发出；副机是否保持 inactive/stopped、不独立激活/取消激活/TDS/报告；显式解绑或换主机是否先清凭证并 flush 再变更角色；瞬断、旧连接迟到和保存失败是否可能让旧凭证复活或越权请求。
5. **测试与诊断是否对应真实实现**：focused tests 是否走真实 Runtime/owner 接缝而不是只直接改 slice 或注入最终事件；失败摘要是否包含可定位且脱敏的 run/阶段/请求事实；日志缺失是否不被包装成通过；当前 suite 注册是否能发现缺文件或遗漏。
6. **简单性与范围**：确认修复是否复用现有 owner/command/selector/state-sync/cleanup 能力；找出重复事实、旁路、无消费者 API、过量状态或为假设极端情况新增的框架。只报告当前已实施子集的真实问题，不要求恢复已明确排除的设计或扩大 CP-05/06。

可参考已记录的当前 focused 结果，但不得以文档自述代替重开源码，也不要求为本次阶段性 review 重跑测试、构建、verify、DEV、Expo Web、Android、双机或任何受管环境。已知状态包括：project-basic 当前 focused test 7 项、typecheck/lint 通过，terminal skeleton static/model 与 terminal layering focused gates 通过；identity-only edge-codegen 通过。默认 edge-codegen 预算投影因 `BUDGET_PROJECTION_OPERATION_MISSING:stagePlatformTerminalUpdateArtifact` 保持 `NOT_RUN/OPEN`，不得写为默认门通过。`ter-format-check` 的全量静态入口及 `code-layout` 曾有独立失败，详见 CP-01 evidence intake；请只判断它们与本次被审代码的关系，不把无关失败扩展成新范围。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M/S/N`。结论范围标为 `INTERIM_IMPLEMENTED_SUBSET_ONLY`，说明逐项源码位置与行号、需求/详设判据、事实与推论、影响、最小修复建议及是否需要 Dexter 产品裁决。若发现详设没有判据的事项，列入 `DESIGN_GAPS`。请明确声明该结论不代表 CP-01 MATCHED、全批 6b、阶段 C 整批实施通过或任何动态场景通过。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对《TER 版本定义、完整更新与热更新》阶段 C 已实施子集做一次阶段性静态源码 review。

背景：阶段 C 的实施已推进到 CP-01～CP-04 涉及的部分源码、测试和动态前诊断链。Dexter 已要求暂停后续实施，先复核当前已写部分，以便尽早发现同根问题并减少后续反复。此前 CP-01 的两次独立对账结论为 OPEN；主 agent修复后启动的 fresh R3 reviewer 在本次暂停时被中断，因此 CP-01 当前仍是 OPEN/PENDING。CP-02、CP-03、CP-04 有各自范围限定的 MATCHED 阶段记录，但它们不等于全批 6b 或阶段 C 交付结论。CP-05、CP-06、全批 6b、13c 和整批 IMPLEMENTATION review 尚未完成。动态诊断链单独的 R2 源码审查为 GO、M/S/N=0/0/0，仅覆盖诊断源码。

目标：请从正式需求、当前详设和真实 owning source 独立推导预期行为，对当前已实施子集做证伪式静态审查，重点找出会使常见流程错误、CP 接缝不一致、或后续动态验收反复失败的源码级问题，并判断当前实现是否保持简单、高效、健壮。请先独立形成判断，再参考作者的阶段记录；作者记录不是独立证明。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：正式行为依据；
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md`：阶段 C owner 与实现判据；
- `doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md`：CP 顺序和 focused proof；
- `doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-01-evidence-intake-codex.md`：CP-01 当前修复与 OPEN/PENDING 边界；
- `doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-02-reconciliation-codex.md`、`doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-03-reconciliation-codex.md`、`doc/review/platform/2026-10-10-ter-version-update-stage-c-cp-04-reconciliation-codex.md`：既有阶段记录及适用范围；
- `doc/review/platform/2026-10-10-ter-version-update-stage-c-pre-dynamic-diagnostics-intake-codex.md`：诊断链源码范围与审查边界；
- `doc/platform/terminal-coding-standard.md`：TER owner、Runtime、凭证与同步规范；
- `apps/terminal/kernel/feature/project-basic/`、`apps/terminal/kernel/feature/store-basic/`；
- `apps/terminal/kernel/base/terminal-data-client/`、`apps/terminal/kernel/base/terminal-update/`、`apps/terminal/kernel/base/runtime/`、`apps/terminal/kernel/base/topology/`；
- `apps/terminal/ui/integration/`；
- `apps/backend/catering-business-server/modules/terminal-binding/`、`apps/backend/terminal-data-server/`；
- `contracts/openapi-source/terminal-binding.schemas.json`、`scripts/generate/r5-edge-materialize.mjs`、`scripts/generate/terminal-client-api.mjs`；
- `tools/terminal-automation/src/runner.ts`、`tools/terminal-automation/src/journeyFailureDiagnostics.ts`、`tools/terminal-automation/journeys/update.pair.android.test.ts` 及其直接测试。

请重点独立核验：project-basic/store-basic 的 owner 与并行加载闭环；TDC/CBS/TDS 的凭证身份、角色与生成契约链；project candidate 到 terminal-update 固定执行的当前值复核、FULL/HOT 与跨 boot 接续；本地 Runtime interaction/presentation 生命周期；共享凭证同步、显式解绑及直接 CBS 请求边界；测试是否验证真实 owner/Runtime 接缝、诊断是否脱敏且可定位；以及是否存在重复事实、错误旁路或过度抽象。请只评估当前已实施子集，不要求尚未实施的 CP-05/06 功能。

本轮是静态 review：不要求运行测试、构建、verify、Expo Web、DEV、Android、双机或受管动态场景，也不要求读取 `.runtime/` 或补交动态 evidence。已有 focused 结果和 OPEN 项只用于说明证据边界；不得将它们提升为完整验收 PASS。默认 edge-codegen 预算投影 `BUDGET_PROJECTION_OPERATION_MISSING:stagePlatformTerminalUpdateArtifact` 仍为 `NOT_RUN/OPEN`。动态诊断链先前的 GO 仅限该源码子范围。

烦请给出明确 `GO` 或 `NO-GO`，并报告 `M/S/N`。每项 finding 请列精确源码与详设位置、事实/推论、影响、最小修复建议及是否需要 Dexter 产品裁决；详设无判据的问题列为 `DESIGN_GAPS`。请将 verdict 明确限定为 `INTERIM_IMPLEMENTED_SUBSET_ONLY`，不得据此宣称 CP-01 MATCHED、全批 6b、阶段 C 整批 GO 或动态验收通过。

授权边界：本次只请对当前阶段 C 已实施子集进行只读静态 review，不授权 Claude 修改文件、要求补跑测试/动态验收，亦不授权扩大阶段 C 范围、进入 CP-05/06、reset/seed、L2、UAT 或生产部署。后续实施由 Dexter 当前授权继续安排。谢谢。
```
