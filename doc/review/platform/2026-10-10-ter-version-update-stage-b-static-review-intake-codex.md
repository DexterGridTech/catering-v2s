# 阶段 B 更新身份链静态复核与 finding intake

日期：2026-10-10  
范围：阶段 B 的固定 FULL/HOT 身份、下载授权 manifest 与 FULL 安装 readback。阶段 C 自动选择、N/M 调度、闲时策略和双机能力均不在本次范围；仅阅读阶段 C 详设确认边界，没有修改阶段 C 文件。  
动态状态：本轮静态修复后测试、构建、verify、DEV 和设备验收均未运行；不得将源码或测试断言描述为通过证据。

## finding dispositions

| Finding | 处置 | 当前事实、反例与影响 | 最小修正/结论 |
| --- | --- | --- | --- |
| HOT grant 的 `minimumFull` 未对照固定 FULL 五项 | `CONFIRMED` | `terminalUpdateActor.ts` 的 grant manifest 校验此前只比对当前被选工件；HOT 的 `apkSha256` 为 `null`，故即使 grant 中 `minimumFull` 与已固定 FULL 的 applicationId、nativeBuildNumber、runtimeVersion、publicationId 或 apkSha256 不一致，也能继续到 prepare。Android preparer 只能校验 ZIP 内 manifest 与收到的 manifest 相符，无法恢复固定目标身份。 | 校验函数现在接收固定目标 FULL；HOT 必须携带完整 `minimumFull` 并逐项等于固定 FULL 五项，缺失/不一致统一返回 `DOWNLOAD_ARTIFACT_IDENTITY_MISMATCH`，不调用 prepare。新增直接反例测试。 |
| FULL readback 成功未核对已安装 APK 摘要 | `CONFIRMED` | Android 在 action 记录中持久化 `actionApkSha256`，但 `readAction` 与 busy installer reconcile 曾仅比较 applicationId、nativeBuildNumber、publicationId。相同三项而 APK 字节不同的外部替换会被误认作目标已安装。 | 两处改用同一 `matchesInstalledFullAction` 判定，并要求已安装 sourceDir 流式读取出的 APK 摘要等于持久化 action 摘要；摘要缺失或不同不成功。新增策略测试覆盖摘要相同、不同及缺失。 |
| 固定任务创建后，规则停用仍可按固定工件继续申请下载 grant | `REJECTED_WITH_EVIDENCE` | 阶段 B §8.4 明确固定目标后后续规则停用不改写任务；固定任务继续按固定 artifactRef 取授权。§8.4 的关联谓词包含“已创建规则目标”，并明示包含停用的固定目标；snapshot 只影响新目标接受。强加启用状态检查会破坏重启续接。 | 保持当前 owner 校验；新目标仍须来自当前有效、启用的快照。无需改动。 |
| FULL 候选第一页可能漏掉合法最低版本 | `REJECTED_WITH_EVIDENCE` | UI 查询带完整 64 位 `minimumFull.publicationId`，本地再用 app/build/runtime/publication/APK 摘要精确核对。数据库同名 `minimumFull*` 查询字段过滤的是 artifact 自身 `minimum_full` JSON；FULL 行此字段为空，不适用于精确查找 FULL 工件。搜索文本为完整 publication SHA，常规固定 App/version 字段不会匹配该完整 SHA；首屏匹配项可选。 | 不将 HOT 的 minimumFull 过滤字段错误用于 FULL 行，不新增查询 API 或分页机制。保留现有 exact 本地校验和保存端 owner 复核。 |
| FULL 构建失败时 staging 可能残留 | `REJECTED_WITH_EVIDENCE`（受管执行范围） | staging 位于 run-owned `.runtime/terminal-automation/<runId>/update/<app>/full-staging`。本次授权采用的受管 runner 清理清单已包含两个 App 的 `full-staging`，并在 cleanup 后读回目录不存在；构建失败仍由该 run cleanup 负责回收。 | 不在 builder 内重复实现清理机制；如脱离本次受管 runner 单独执行，不属于本轮授权路径。 |

## 附加的阶段 B 身份边界核验

Dexter 关于“console 不能升级 wallpaper 包”的要求已在阶段 B 主链源码中有明确拒绝路径：接受目标前先读取实际 `applicationId`，与选定规则的 `applicationId` 不同即返回 `APPLICATION_ID_MISMATCH`；`validTarget` 同时要求 FULL/HOT 工件的 `applicationId` 与目标一致。直接反例位于 `apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts` 的不同 applicationId 拒绝用例。此结论只针对固定规则目标的跨 App 身份匹配，不扩展到阶段 C。

## 修订文件

- `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts`：对照固定 FULL 的 `minimumFull` 五项；FULL grant 使用固定目标 artifact source 校验摘要。
- `apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts`：增加 HOT grant 最低 FULL APK 摘要不匹配时不调用 prepare 的反例。
- `apps/terminal/adapter/android/update/android/src/main/java/com/catering/v2s/terminal/adapter/android/update/TerminalUpdateInstallerPolicy.kt`：加入 FULL action 已安装身份的窄纯判定。
- `apps/terminal/adapter/android/update/android/src/main/java/com/catering/v2s/terminal/adapter/android/update/TerminalUpdateRuntime.kt`：`readAction` 与 busy reconcile 统一核验 action APK 摘要。
- `apps/terminal/adapter/android/update/android/src/test/java/com/catering/v2s/terminal/adapter/android/update/TerminalUpdateInstallerPolicyTest.kt`：增加 APK 摘要成功/不匹配/缺失反例。
- 阶段 B 详设 §8.4 与计划 CP-04：同步 HOT `minimumFull` 与 FULL 成功 readback 的精确身份判据。

## 验证边界

当前修复均为静态源码与测试源码修改。尚未执行新增 focused tests、类型检查、Kotlin 编译、构建、verify、DEV 或受管设备运行。下一步只在静态差量复核通过后执行这些修改直接相关的 focused proof，不重跑未受影响的 Stage B 场景，也不进入阶段 C。

阶段 B 身份差量已由 fresh 独立只读 reviewer 复核：`REVIEW_TARGET=IMPLEMENTATION`、差量范围、`GO`、`M/S/N=0/0/0`；未运行动态验证。该 verdict 不代表阶段 B 整批实现的最终 review 或运行证据。

阶段 B 核心更新链另由 fresh 独立只读 reviewer 完成源码静态对抗审查：覆盖 CBS 工件/规则与 snapshot、TDC 固定目标及跨 App 拒绝、grant manifest、Android FULL/HOT prepare/readback、报告提交及阶段 C 边界；`REVIEW_TARGET=IMPLEMENTATION`、`GO`、`M/S/N=0/0/0`。该审查未运行测试、构建、verify 或动态验收，不代表阶段 B 整批运行通过。
