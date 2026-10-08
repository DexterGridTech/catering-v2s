# Claude 静态复评请求：TER 阶段 A D-S-1～D-S-4 修复差量

## 背景

Claude 对 TER 版本更新阶段 A 的修复差量提出 D-S-1～D-S-4，主 agent 重开正式需求、详设和 owning source 后，四项均判为 `CONFIRMED` 并完成最小修正。修复后 owner、builder、runner 的相关 focused tests/typecheck 均已通过；fresh 内部只读 reviewer 对本差量给出 `GO, M/S/N=0/0/0`。本次请求针对这些修订后的当前字节，不继承此前 verdict，也不代表阶段 A 整批交付完成。

## 评审目标

请独立复核 D-S-1～D-S-4 的代码修正是否真正关闭原反例，是否引入同根回归，并判断修法是否保持现有 owner、工件与清理机制的简单边界。评审范围仅为本次修复差量及其直接调用链，不复核无关的阶段 A 历史实现。

## 需阅读文件

- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：FULL/HOT 与 boot 生命周期正式判据。
- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md`：§8.5、§8.8、§11a 与本次 §14.2 修订判据。
- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md`：§11.9 差量验证记录及 NOT_RUN 边界。
- `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts` 与 `apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts`：FULL-only 成功的 boot 占位及继任 boot 释放。
- `scripts/build/terminal-update-artifact.mjs` 与 `scripts/test/terminal-update-artifact.test.mjs`：APK 流式摘要、ZIP 解包与超过旧 32 MiB stdout 上限的 self-test。
- `tools/terminal-automation/src/runner.ts` 与 `tools/terminal-automation/test/runner.test.ts`：run-owned FULL staging/解包 APK 清理与 readback。
- `tools/terminal-automation/journeys/update.android.test.ts`：compatibility 外部 FULL ZIP 摘要、entry、内层 APK 摘要校验及既有安装调用。
- `doc/review/platform/2026-10-09-ter-version-update-stage-a-source-static-delta-intake-codex.md`：主 agent 的 finding intake、分类和本轮证据边界；请在形成独立判断后再对照。

## 独立核验重点

请先从正式需求、当前详设、计划和 owning source 独立形成判断，再读取 intake。逐项核验：

1. D-S-1：FULL-only 成功时 `action.bootId` 可空，owner 是否使用同次权威 `actual.bootId` 保存终态占位；权威 boot 不可用时是否保持 UNKNOWN；同 boot 是否仍不能领取第二规则，继任 boot 是否释放旧任务并可接受新目标。
2. D-S-2：FULL APK 与 minimum-FULL APK 的所有同根读取是否避开整包 stdout buffer；流式摘要、输出文件身份及失败路径是否正确，是否仍拒绝摘要/长度不符内容。
3. D-S-3：两 App 的 run-owned `full-staging` 与 compatibility 解包 APK 是否均进入现有 cleanup 和删除 readback；cleanup 是否只触碰当前 run 拥有的路径。
4. D-S-4：compatibility FULL3 是否从对应已校验 ZIP 提取正确 APK，校验外层 ZIP 与内层 APK identity 后调用原安装入口；INSTALL APK 是否保持独立、未被覆盖。

可核对主 agent 记录的 focused 结果：terminal-update typecheck、2 files/31 tests；builder self-test 与 artifact Node tests 2 项；terminal-automation runner 1 file/38 tests 与 workspace typecheck；代码 Prettier 与 `git diff --check`。这些是本地 focused 结果，不是 Android 运行 evidence。请勿要求重跑完整设备矩阵作为本差量 review 的前置；Android/Kotlin、Expo Web、DEV、完整 `scripts/verify` 与真实外部 FULL3 安装仍标记为 `NOT_RUN`，不得据本次静态 review 写成 PASS。

## 期望结论

请给出明确 `GO` 或 `NO-GO`，并报告 `M/S/N` 数量。每条 finding 请列精确仓库相对路径与行号、事实与推论、影响、最小可验收修正，以及是否需要 Dexter 产品裁决。请区分本次差量结论与阶段 A 整批状态；没有详设判据的问题列为 `DESIGN_GAPS`，无需为证据边界本身提出 finding。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对 TER 版本更新阶段 A 的 D-S-1～D-S-4 修复差量做一次独立静态复评。

背景：您先前指出 FULL-only 成功 boot 占位、APK stdout 缓冲、FULL staging 清理和 compatibility 外部 FULL3 安装输入四项问题。主 agent 已逐项重开正式需求、详设和 owning source，四项均判为 CONFIRMED 并完成最小修正；相关 focused tests/typecheck 已通过。fresh 内部只读 reviewer 对本差量给出 GO、M/S/N=0/0/0。本请求只对应当前修复差量，不继承旧 verdict，也不代表阶段 A 整批完成。

目标：请独立判断四项修正是否关闭原反例、是否引入同根回归，及实现是否仍保持当前 owner、工件和清理机制的简单边界。

请从 catering-v2s 仓库根阅读：
- `doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md`：正式行为判据；
- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-design-claude.md`：当前详设与 §14.2 差量判据；
- `doc/plans/platform/2026-10-06-ter-version-update-stage-a-implementation-plan-claude.md`：当前验证记录与未运行边界；
- `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts`、`apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts`：FULL-only boot 占位与次 boot 释放；
- `scripts/build/terminal-update-artifact.mjs`、`scripts/test/terminal-update-artifact.test.mjs`：APK 流式摘要和 builder 自测；
- `tools/terminal-automation/src/runner.ts`、`tools/terminal-automation/test/runner.test.ts`：run-owned staging 与 compatibility 解包物清理；
- `tools/terminal-automation/journeys/update.android.test.ts`：外部 FULL ZIP 解包、双层摘要校验及实际安装输入；
- `doc/review/platform/2026-10-09-ter-version-update-stage-a-source-static-delta-intake-codex.md`：主 agent intake；请在先独立阅读需求、详设和源码后再对照。

请重点独立核验：
1. FULL-only action.bootId 为空时是否以同次权威 readback 的 actual.bootId 保存成功占位；无权威 boot 时是否 fail closed；同 boot 与继任 boot 行为是否分别正确。
2. 所有会消费完整 APK 字节的 builder 路径是否不再受 32 MiB stdout buffer 限制，流式摘要和 staging 失败路径是否正确。
3. 两 App 的 run-owned full-staging 与兼容 FULL 解包 APK 是否纳入精确 cleanup/readback，且不删除未知或其他 run 的资源。
4. compatibility FULL3 实际安装输入是否来自匹配 ZIP 中经摘要验证的 APK，且没有覆盖 INSTALL APK。

主 agent 本地 focused 结果为：terminal-update 2 files/31 tests 与 typecheck PASS；builder self-test 和 artifact Node tests 2 项 PASS；runner 1 file/38 tests 与 terminal-automation typecheck PASS；代码 Prettier、git diff --check PASS。没有运行 Android/Kotlin、Expo Web、DEV、完整 scripts/verify 或完整设备矩阵；真实安装和重启行为均为 NOT_RUN。请不要要求这些完整动态 evidence 作为本次静态差量 review 的前置，也不要把本次差量结论写成阶段 A 整批 PASS。

烦请给出明确 GO 或 NO-GO 与 M/S/N。每条 finding 请列准确仓库相对路径和行号、事实/推论、影响、最小可验收修正及是否需要 Dexter 产品裁决；无详设判据的问题列为 DESIGN_GAPS。

授权边界：本次请求仅为阶段 A 四项修复差量的静态复评，不授权 Android/Expo Web/DEV/完整动态验收、完整 scripts/verify、阶段 B/C、reset/seed、L2、UAT 或部署，也不代表阶段 A 整批实施 review。谢谢。
```
