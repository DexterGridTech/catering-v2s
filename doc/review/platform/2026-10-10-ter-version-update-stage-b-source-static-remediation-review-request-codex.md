# TER 版本更新阶段 B 当前源码静态复评请求

## 背景

Dexter 转交的 Claude 阶段 B 源码静态评审结论为 `NO-GO, M/S/N=0/13/4`，只对应原评审所读取的源码字节。主 agent 已逐项重开需求、详设、计划和当前 owning source；13 项 S 均在当前源码找到对应最小闭包，N-1 已有有限完整快照重读，N-2/N-4 对当前字节不成立，N-3 仅保留 opaque cursor 子列表的 append/load-more 是否完全满足 UI 一致性约定这一非阻断注记。逐项处置见本目录的 `2026-10-10-ter-version-update-stage-b-source-static-review-intake-r2-codex.md`。

本轮直接修复了并发 accept 测试的确定性 source-read 屏障、FULL parser 测试 fixture 的 entry 声明，以及 operations-admin refresh 的 generated UUID 品牌转换。相关 focused tests/typecheck 已按原命令复验通过。此前首败和根因均在 intake 中保留。

## 评审目标

请 Claude 只对当前源码与直接相关测试做独立静态 review，判断阶段 B 普通供给/规则/报告闭环、TER 固定目标及 owner 权限边界是否符合正式需求和阶段 B 详设；重点重新检查原 S-1～S-13 的反例在当前代码是否确实闭合，以及 N-3 的残留 append/load-more 交互是否构成具体偏差。

本请求不要求比较运行 evidence，不要求运行测试、构建、verify、DEV、Expo Web、Android 或其他动态环境。测试源码只作为断言设计阅读，不代表测试通过；本请求中记录的 focused command 输出是作者已有局部验证，不替代 Claude 的源码判断。

## 需阅读文件

- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：阶段 B 的正式行为判据与 A/B/C 边界。
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md`：阶段 B 的 owner、固定目标、报告矩阵及 UI 判据。
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md`：实施范围、CP 与已批准验证边界。
- `doc/review/platform/2026-10-10-ter-version-update-stage-b-source-static-review-claude.md`：上一轮 13S/4N 的原始反例和字节边界；只作复核线索，不继承 verdict。
- `doc/review/platform/2026-10-10-ter-version-update-stage-b-source-static-review-intake-r2-codex.md`：主 agent 的逐项 intake、当前闭包和局部验证范围；不作为独立结论。
- `apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/TerminalUpdateRuleOwnerService.java` 与 `api/TerminalUpdateRuleOwnerApi.java`：规则授权 grant、receipt 重放、manifest 文件计数。
- `apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/TerminalUpdateArtifactParser.java`、`TerminalUpdateReportOwnerService.java` 及同模块直接测试：归档 entry、当前绑定最终复核和 owner 断言。
- `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts`、`test/terminalUpdate.test.ts`：snapshot、报告序号与观察、失败矩阵、HOT 状态、固定前资格复核。
- `apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx`：规则/报告刷新、日期 query、状态 CAS、统一分页和详情。
- `apps/frontend/platform-admin/src/features/terminal-update/ui/TerminalUpdatePackagesPage.tsx`：上传 dirty lifecycle、包列表/详情刷新和共享 Drawer。
- `libraries/frontend/admin-ui-foundation/src/list/cursorPagination.tsx`、`useCursorStack.ts`、`overlay/drawerSurface.ts`、`behavior/useDrawerFormLifecycle.ts`：本批复用的既有交互能力。

## 独立核验重点

1. 按原 S-1～S-13 的输入与竞态逐项检查当前源码：授权 grant 必须在 owner receipt 重放前有效；FULL/HOT entry 必须匹配清单和真实普通文件；解析、grant 共享同一 8192 技术上限；报告写入需在 owner 事务内锁核当前 binding；同 binding context 切换不能复用旧序号；无 task 的真实版本首次 observation 必须只生成一次；身份拒绝、终态拒绝、传输未知和 flush failure 必须遵守各自发送/保留行为；HOT applying 与恢复来源不得错报；await 后固定候选必须再核当前资格；日期值形状须与当前 ProTable 配置一致；刷新要接现有 signal 且第二页不永久 loading；状态 CAS 要有提交锁、当前读回和面内错误；上传放弃确认由唯一 dirty lifecycle 管理。
2. 核验同根边界：成功 ACK 的 flush 失败与业务终态拒绝不能混为一类；固定目标后的规则变更不能改写已经固定的执行目标；不因后台 UI snapshot 包含两个 App 就推断跨 App 执行被允许。
3. N-1 只需核查本 refresh 对 `SNAPSHOT_CHANGED` 的三次有限重读和旧完整快照保留；N-2 核对当前源码是否仍存在额外 64 项截断；N-4 搜索当前 UI 是否仍把 `nSeconds` 标为“检查间隔”。
4. N-3 限定在具体 UI 约定：主表是否复用 CursorPagination；规则固定门店与报告历史的“下一页/加载更多”是否违背该列表的 opaque-cursor 交互；Drawer surface/宽度、键盘可操作详情入口是否统一。请只报告可从当前源码及明确设计判据证明的问题，不因风格偏好增加分页框架。
5. 不将代码读取、focused proof、历史运行或计划场景当成此次独立 verdict；本次不要求运行 evidence。

## 期望结论

请明确给出 `GO` 或 `NO-GO` 及 `M/S/N`。每个 finding 请列精确仓根相对路径与行号、事实和推论、影响面、最小修正建议、是否需要 Dexter 产品裁决。若原反例当前已不成立，请说明当前调用链或测试断言如何关闭它；不要沿用作者 disposition。

## 可直接复制给 Claude 的话术

```text
Dexter 转交：

您好 Claude，烦请对《TER 版本定义、完整更新与热更新》阶段 B 当前源码做独立静态复评。

背景：上一轮阶段 B 源码静态评审结论为 NO-GO，M/S/N=0/13/4；该结论只对应原评审读取的字节。主 agent 已按原 S-1～S-13、N-1～N-4 逐项重开正式需求、详设和 owning source，并记录在 `doc/review/platform/2026-10-10-ter-version-update-stage-b-source-static-review-intake-r2-codex.md`。本轮仅有针对测试屏障、parser fixture 和 generated UUID 类型边界的局部修订；原始 finding 与首败没有被抹除。

目标：请只审查当前生产源码与直接相关测试源码，独立判断普通供给、规则、报告、TER 固定目标及两个后台查询/编辑路径是否符合正式需求和阶段 B 详设。重点重看原 S-1～S-13 在当前源码是否已闭合，以及 N-3 中规则门店/报告历史使用 opaque-cursor “下一页/加载更多”是否构成明确设计偏差。

请从 catering-v2s 仓根阅读：
- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：正式行为要求与阶段边界；
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-design-claude.md`：owner、固定目标、报告和 UI 判据；
- `doc/plans/platform/2026-10-07-ter-version-update-stage-b-implementation-plan-claude.md`：阶段 B 范围；
- `doc/review/platform/2026-10-10-ter-version-update-stage-b-source-static-review-claude.md`：上一轮原始 findings，只作核验线索；
- `doc/review/platform/2026-10-10-ter-version-update-stage-b-source-static-review-intake-r2-codex.md`：作者处置记录，不作为独立结论；
- `apps/backend/catering-business-server/modules/terminal-update/src/main/java/com/catering/v2s/terminalupdate/application/TerminalUpdateRuleOwnerService.java`、`TerminalUpdateArtifactParser.java`、`TerminalUpdateReportOwnerService.java` 及同模块直接测试；
- `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts`、`test/terminalUpdate.test.ts`；
- `apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx`；
- `apps/frontend/platform-admin/src/features/terminal-update/ui/TerminalUpdatePackagesPage.tsx`；
- `libraries/frontend/admin-ui-foundation/src/list/cursorPagination.tsx`、`useCursorStack.ts`、`overlay/drawerSurface.ts`、`behavior/useDrawerFormLifecycle.ts`。

请重点验证授权是否在 receipt 重放之前复核、FULL/HOT entry 与真实文件是否闭合、manifest 上限是否贯穿 grant、报告 owner 是否锁核当前 binding、同 binding 序号是否单调、无任务 observation 是否幂等、报告失败分类与发送状态是否匹配、HOT/恢复状态是否如实表达、固定前候选是否再次核资格、日期提交类型是否与 ProTable 一致、刷新与 CAS 是否正确接入现有能力、上传 Drawer 是否遵守唯一 dirty lifecycle。另请核实有限 snapshot 重读、当前是否还有 64 项 pending 截断、安装提醒文案，以及 N-3 的具体残余分页交互。

本次只要求静态源码与测试源码 review，不要求运行或比较任何 evidence，不要求测试、构建、verify、DEV、Expo Web、Android 或其他动态运行。测试源码不等于测试已通过；作者已有的 focused 输出也不替代你的独立判断。

烦请给出明确 `GO` 或 `NO-GO` 与 `M/S/N`。每个 finding 请提供精确仓根相对路径和行号、事实与推论、影响面、最小修正建议及是否需要 Dexter 产品裁决。只报告当前字节可复核的具体问题，不扩展阶段 C 或以风格偏好增加机制。

授权边界：本请求仅为阶段 B 当前源码的静态复评，不授权阶段 C、动态运行、reset/seed、L2、UAT、生产部署或批次外功能。谢谢。
```
