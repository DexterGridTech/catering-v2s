SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

# TER 版本更新阶段 A · D-S-1～D-S-4 主 agent intake

- 日期：2026-10-09。
- 输入：`2026-10-09-ter-version-update-stage-a-source-static-delta-rereview-claude.md`，阶段 A 正式需求、详设 §8.5/§8.8/§11a、实施计划、当前 owning source 与直接测试。
- 范围：仅差量复评 D-S-1～D-S-4；不重开阶段 A 已关闭 review cycle，不扩大到完整动态/设备验收。
- 所有 finding 分类由主 agent 对照当前源码和适用判据重新核验；本记录不是独立 review verdict。

## D-S-1 · FULL-only 成功未保存本次权威 boot

**分类：CONFIRMED。** 正式需求要求一条已完成规则不能永久阻止后继规则，详设 §8.5 要求同一启动最多领取一条。native FULL 成功结果允许 `action.bootId=null`，而该次 owner readback 的 `actual.bootId` 才是本次成功安装后的当前 boot。此前终态把 nullable action 字段写入持久 task，导致后续 release 的非空身份条件永远不满足。

**最小修正：** 成功终态与 FULL→HOT fixed 占位均取同次权威 `readFacts.actual.bootId`；成功读回无实际 boot 时保持 UNKNOWN，不能猜用安装前身份。直接 owner 测试覆盖 action.bootId=null、当前成功 boot 保留占位、同 boot 不接受第二目标、继任 boot 释放并接受新目标。

**局部 proof：** `yarn workspace @catering-v2s/kernel-base-terminal-update typecheck` PASS；同 workspace test：2 files / 31 tests PASS。

## D-S-2 · APK 二进制摘要受 32 MiB 子进程缓冲限制

**分类：CONFIRMED。** `runBytes` 的 32 MiB stdout 上限不适用于会达到已声明合法 FULL 工件范围的 APK；`writeFullPackage` 与 minimum-FULL 校验曾把 unzip 的整个 APK stdout 载入 Node buffer。

**最小修正：** 新增流式文件 SHA-256（1 MiB 读取缓冲），将 unzip stdout 直接写入 run-owned staging 文件并核验摘要与文件长度，完成后删除；builder self-test 使用 40 MiB 输出证实新路径越过旧缓冲边界。未增加依赖或 APK 解析框架。

**局部 proof：** `node scripts/build/terminal-update-artifact.mjs --self-test` PASS，包含 `STREAMED_OUTPUT_OVER_32_MIB=PASS`；`node --test scripts/test/terminal-update-artifact.test.mjs`：2 tests PASS。

## D-S-3 · FULL staging 不在受管 cleanup 集合

**分类：CONFIRMED。** builder 失败/中断可遗留 `update/<app>/full-staging`；若清理集合未覆盖，runner 无法对该 run-owned APK 做删除与 readback。

**最小修正：** 将两 App 的 `full-staging` 与外部 FULL 解包 APK 加入原有 run-owned cleanup，并在既有 runner 测试中检查 staging 内容、独立解包物均被删除、目录 readback 消失及移除字节计数正确。没有清理未知或非本 run 资源。

**局部 proof：** `yarn workspace @catering-v2s/terminal-automation test runner.test.ts`：1 file / 38 tests PASS；同 workspace typecheck PASS。

## D-S-4 · compatibility 的 FULL3 安装输入仍是 INSTALL APK

**分类：CONFIRMED。** Journey 快照含 FULL3 的外层 ZIP 与 package descriptor，但安装调用使用原 INSTALL APK 路径，因此安装身份与断言中的 FULL3 不一致。

**最小修正：** 在 compatibility Journey 中校验 descriptor 与 publication identity、外层 ZIP SHA、唯一预期 APK entry 和内层 APK SHA；提取到独立 run-owned APK 后复用既有 `connection.install`。不覆盖 INSTALL APK；失败时删除提取物，正常和异常清理均由 runner ownership 集合收口。

**局部 proof：** `yarn workspace @catering-v2s/terminal-automation typecheck` PASS；相关 Journey 文件由该 workspace typecheck 覆盖。没有运行 Android 安装场景。

## 当前字节验证边界

- 最近的 owner typecheck 与测试：PASS；2 files / 31 tests。
- builder self-test 与 artifact Node tests：PASS；2 tests，40 MiB streamed-output red proof 正常通过。
- runner focused tests：PASS；1 file / 38 tests；terminal-automation typecheck PASS。
- 已改生产/测试/脚本文件的 Prettier check 与 `git diff HEAD --check` PASS。两份长篇 Markdown 的当前格式检查未通过；对 HEAD 基线经 stdin 的相同 Prettier 检查也失败，故不是本次追加造成。没有全文件重排，避免无关文档改写。
- 本轮没有受管 run，run id=N/A。没有运行 Expo Web、Android/Kotlin、设备、DEV 或完整 `scripts/verify`；真实 FULL3 安装、原生 installer 行为及中断后的实际 runner cleanup 为 NOT_RUN。
- 本记录不宣称阶段 A 整批交付，也不把局部 focused PASS 升级为 Android 动态 PASS。独立差量 verdict 由 fresh reviewer 单独给出。

## 通用失败模式与防再犯

本批四条都属于“最终事实/工件的权威来源与其生命周期消费脱节”：生命周期事实取错来源、二进制内容被诊断型 stdout 限额截断、run-owned 大文件未进入 cleanup 分母、封装产物产生后消费者仍引用旧输入。最小防护落在既有 owner 测试、builder self-test、runner cleanup 测试与 compatibility Journey typecheck；不增加通用账本、清理框架或新门。边界是这里涉及的 FULL update 工件、终态 boot 和 run-owned compatibility 产物，不泛化到未知资源删除或恶意归档专项。
