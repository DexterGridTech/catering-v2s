SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

# TER 版本更新阶段 A · Claude 静态 finding 主 agent intake

- 日期：2026-10-09。
- 输入：[Claude 当前源码静态评审](2026-10-09-ter-version-update-stage-a-source-static-review-claude.md)、正式需求与阶段 A 详设/计划。
- 范围：仅本轮 S-1～S-4；阶段 B 文档只记录已同步接缝，不授权阶段 B 实施。
- 分类由主 agent 对照需求、详设、owning source 和直接测试重新核验；此记录不是独立 review verdict。

## S-1 · FULL 身份比较误用当前 HOT publication

**分类：CONFIRMED。** `UpdateFacts` 同时暴露 embedded APK 身份与当前 selected JS 身份；FULL 是否已安装应依据 embedded 身份。原实现比较 `actual.publicationId`，会把同 APK 上已经成功运行的 HOT 错判成 APK/FULL 冲突。

**最小修正：** `terminalUpdateActor.ts` 的 FULL 决策改用 `facts.embedded` 的 publication 身份；selected publication 仍用于 HOT 决策。未增加身份副本或账本。owner 测试加入同一 APK 已有 HOT 后仍可判断 FULL，并保持已到目标时的零动作语义。

**局部证明：** `yarn workspace @catering-v2s/kernel-base-terminal-update test`：2 files / 30 tests PASS；同 workspace typecheck PASS。当前 Kotlin Android 行为未由此证明。

## S-2 · FULL UNKNOWN/等待后成功未继续固定 HOT

**分类：CONFIRMED。** 观察 phase 会从 applying-full 变成 unknown/waiting-user；相同 FULL action 后续真实读回成功时，旧逻辑依 phase 判断而直接终结整个 task，遗漏固定 HOT。

**最小修正：** 持久 task 将 `actionKind` 与固定 `actionId` 绑定。FULL action 后续成功时校验 readback publicationId 与固定 FULL 工件一致，再继续既有固定 HOT；action 身份或工件身份不匹配时记录 UNKNOWN，不重派已完成 FULL，也不推进 HOT。

**局部证明：** owner 测试覆盖 phase 已变为 UNKNOWN 后同 action 成功，验证不重复 FULL、按固定 HOT 续接；`yarn workspace @catering-v2s/kernel-base-terminal-update test`：2 files / 30 tests PASS；typecheck PASS。

## S-3 · HOT 正常冷启动未确认当前 PRIMARY boot

**分类：CONFIRMED。** Android beginBoot 为每次启动建立新的 boot identity；原 owner 仅在存在 applying-hot task 时处理 boot 确认，成功 HOT 后的普通启动可能永久停留在未确认状态，后继 HOT 被 native policy 拒绝。

**最小修正：** 每个 PRIMARY 内容就绪事件通过现有通用 Runtime command 交给 terminal-update owner；owner 读取当前 bootToken/publicationId 并请求 adapter 确认，即使当前没有 update task。Android 侧仍要求 reservation、publication 和 installed APK 身份匹配，迟到 boot/candidate 的保护保留。阶段 A 详设 §8.7 的 DG-1 已同步为同一边界。

**局部证明：** owner 单测覆盖无任务的 PRIMARY-ready 确认，以及 FULL pending 状态保留；terminal-update 30 项通过。Android Kotlin focused test 本次未运行：受管 runner 在 Gradle 启动前因既存、非本 run 所有的 node_modules Android build 目录拒绝启动；未删除目录、未绕过 runner。Kotlin/native 局部证明仍 OPEN。

## S-4 · FULL 正式 ZIP 在生成至安装链中断裂

**分类：CONFIRMED。** 需求定义 FULL 传输物为 ZIP，原 builder 与 Android preparer 仍分别输出/接收裸 APK；已有 APK 签名、版本和 PackageInstaller 校验只有在取出 APK 后才能复用。

**最小修正：** builder 把同次 INSTALL 的 APK 原字节封装为单 APK ZIP；ZIP 下载摘要、解出 APK 摘要、publicationId 分别代表传输物、内层 APK、APK 发布内容。Android preparer 校验并取出 APK 后继续原签名/版本/PackageInstaller 链。没有新增压缩库、恶意归档专项或独立安装通路。

**局部证明：** `node scripts/build/terminal-update-artifact.mjs --self-test` PASS；`node --test scripts/test/terminal-update-artifact.test.mjs`：2 tests PASS；`yarn workspace @catering-v2s/terminal-automation typecheck` PASS；`yarn workspace @catering-v2s/terminal-automation test runner.test.ts`：1 file / 38 tests PASS，覆盖 FULL ZIP 与 descriptor 清理。Android Kotlin 解包/签名交接 focused test 未运行，原因同 S-3，仍 OPEN。

## 本轮验证边界

- 最近一次针对性检查链：terminal-update typecheck 与 30 tests、automation runner 38 tests、adapter-update typecheck、terminal-automation typecheck 均退出码 0。
- FULL ZIP builder self-test 与 Node artifact tests 通过；这些不证明 Android Kotlin 解包和真实 PackageInstaller 行为。
- 当前字节上的最新执行：Android Kotlin 受管 runner 的启动前资源准入失败（`PREEXISTING_INTERMEDIATES`）；无 Gradle、无 Kotlin test run manifest。
- 最后一次通过：terminal-update owner tests，2 files / 30 tests，PASS；对应本轮 owner 源码及测试字节。
- 未运行：Android Kotlin focused proof、完整 scripts/verify、Expo Web、Android 设备、DEV 与完整动态验收。未将历史动态结果提升为本轮证明。
- fresh 独立只读 reviewer 对本轮修复差量给出 `REVIEW_TARGET=IMPLEMENTATION, VERDICT=GO, M/S/N=0/0/0`；核对9个相关文件与两项 typecheck，没有运行测试或读取 runtime evidence。其 verdict 只覆盖本次静态修复差量，不关闭 Android Kotlin focused proof。
- 本次 owner/adapter/runner focused tests 与 typechecks 已由主 agent 在当前字节完成。Android Kotlin 行为验证保持 OPEN，不能由 TypeScript 测试替代；完整 `scripts/verify` 与完整动态矩阵未执行。
