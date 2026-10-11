SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787

# TER 阶段 C 动态前诊断链与审查输入处置

DATE=2026-10-10
REVIEW_TARGET=PRE_DYNAMIC_DIAGNOSTICS_INTAKE
INDEPENDENT_VERDICT=NONE
DYNAMIC_TESTS=NOT_RUN

本记录由主 agent 根据 Dexter 新增的动态前要求及第一轮 fresh 只读审查输入形成。它不是 CP/6b、Implementation review 或动态验收 verdict。dynamic business/device suite 尚未启动。

## 输入与逐项处置

| Finding                              | Classification | 当前事实与反例                                                                                                                                                                                                                     | 最小处置                                                                                                                                                                                                                                                   | 剩余边界                                                                                                                                |
| ------------------------------------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `update.pair` 路由缺少 suite         | `CONFIRMED`    | 初次核验时 runner 已注册 pair 路由但 suite 缺失，确会在 suite existence check 失败；单机 suite 无法覆盖两个 Runtime 和 topology forward。                                                                                          | 已加入真实双设备 suite `tools/terminal-automation/journeys/update.pair.android.test.ts`；现有 `test/runner.test.ts` 将注册 suite 路径与文件存在性逐项相核。                                                                                                | 完整 pair fixture、双设备执行和 cleanup 尚未动态验证。                                                                                  |
| Journey failure 末行无 run identity  | `CONFIRMED`    | `createJourneyFailureDiagnostics.emit()` 有时间及运行上下文，但 `report()` 的 `TERMINAL_AUTOMATION_JOURNEY_FAILURE` 只含 step、failureCode、pending request、last push、截图状态。多个受管 run 并列时，末行无法单独绑定 manifest。 | `report()` 与进度事件共享经过安全标识校验的 `runId`，并记录 `at`；focused 测试解析 JSON、断言 runId/时间，同时继续证明 payload、selector 值和敏感输入不输出。                                                                                              | runId 仍来自受管环境变量；格式校验不替代 manifest ownership 校验。                                                                      |
| DEV 日志不可读时仍可能启动或报告成功 | `CONFIRMED`    | `runner.ts` 原先只在 suite 结束后读取 managed CBS/TDS 日志；读取异常会写 `LOG_NOT_AVAILABLE`，但无动态前的全来源可读门，且该状态不影响 runner exit code。故首个动态场景可能在 DEV 诊断源全不可读时开始。                           | update suite 启动前按 canonical DEV manifest 和进程身份读取 CBS 及登记的 TDS 节点，预检必须全部 `READ`，否则记录原因、保持 cleanup/business 边界并阻止 suite。运行后日志读回失败单列 diagnostics `FAIL` 并令 runner 非零退出，不篡改 business 与 cleanup。 | 预检 focused 证明代码路径；实际远端身份与日志可读性须在首个受管动态 run 前重新确认。后运行的日志缺失仍是独立诊断失败，不能包装成 PASS。 |

## 源码改动范围

- `tools/terminal-automation/src/journeyFailureDiagnostics.ts`：失败摘要增加受校验的 runId 与时间。
- `tools/terminal-automation/src/runner.ts`：增加 DEV 日志预检和完整来源判定；运行后 diagnostics 失败独立报告并影响 runner 总退出码。
- `tools/terminal-automation/test/journeyFailureDiagnostics.test.ts`、`tools/terminal-automation/test/runner.test.ts`：覆盖身份、脱敏、来源完整性及 suite 路由存在性。
- `tools/terminal-automation/journeys/update.pair.android.test.ts`：须由主 agent补成与详设 §10b.6.1、§11 对应的真实双设备 suite；完成前 CP-05 的受管 pair proof 为 `OPEN`，不得进行动态验收。
- 详设 §8.8 与实施计划 §8a：要求 update suite 之前 CBS/TDS 日志源全部可读，后运行诊断失败与业务/cleanup 分列。

## 证据状态

- 第一轮 fresh 只读审查及主 agent finding intake：已记录；R2 之前的更新只由主 agent 写入。
- 修复前首败保留：终端自动化首次 typecheck 报告 `requestId` 可为 `null`、生命周期日志引用了局部变量、runner 类型声明未含 diagnostics 导出；首次 focused Vitest 为两项 fake ADB serial 与一项 runner 对 top-level-await ESM 模块的加载失败。根因分别是日志上下文对 nullable ID 的处理、错误日志作用域、声明文件缺口、fixture 设备清单不匹配及静态 CJS require 不适用该 ESM 模块。未通过改 timeout 或重跑规避。
- 修复后 focused 证明：`@catering-v2s/terminal-automation typecheck` 通过；`androidDevice.test.ts`、`androidAutomationConnection.test.ts`、`runner.test.ts`、`journeyFailureDiagnostics.test.ts`、`androidAppDiagnostics.test.ts` 合计 97/97 通过。另 `@catering-v2s/kernel-base-terminal-update`、`@catering-v2s/kernel-base-terminal-data-client`、`@catering-v2s/kernel-feature-project-basic` typecheck 均通过；`terminalDataClientActor.test.ts` 37/37、`projectBasic.test.ts` 3/3 通过。
- `terminalUpdate.test.ts` 首次运行 37 通过、10 失败，均回报 `stale-binding`。静态回溯确认这 5 组直接 actor harness 未提供 Runtime 必需的 `runtimeInstanceModeSliceName`；`selectActivationState` 因缺 slice 抛错，被 actor 的边界捕获为无有效绑定。生产 Runtime 装配包含该 slice；这是测试上下文不完整，不是生产绑定行为缺陷。测试 fixture 已补真实 `MASTER` mode slice；同一 focused 文件随后 47/47 通过。
- owner lifecycle 日志通过 `projectTerminalAutomationAppEvent` 安全投影到 Android/console diagnostics；增加的 `report-descriptor-persist-failed` focused 断言同时确认保留序号/队列/暂停状态、去除 binding identity 与 report 正文。诊断事件仍只允许白名单字段，不输出原始URL、凭证、请求或业务正文。
- 上述本地 focused commands 没有受管 run manifest/runId，按局部单测证据记录；它们不是 Expo Web、DEV 或设备动态验收。
- DEV / Expo Web / Android 双设备动态运行：`NOT_RUN`。
- 第二轮 fresh 独立只读对抗审查：`/root/pre_dynamic_review_2`，REVIEW_TARGET=PRE_DYNAMIC_DIAGNOSTICS，VERDICT=GO，M/S/N=0/0/0；独立审查覆盖 runner→受管 DEV CBS/TDS 日志→Playwright 管理后台→automation driver→Android Runtime/native 与 peer diagnostics→device/runner cleanup。审查者确认动态前 DEV manifest 身份校验、全部登记 TDS 诊断源 fail-closed、pair suite 路由和双 serial 准入、敏感正文投影边界及 cleanup 不误报 PASS；未发现新的源码 finding。reviewer 明确 `DYNAMIC_TESTS=NOT_RUN`、未读取 `.runtime` evidence，也未运行测试、构建、verify 或环境操作。主 agent 已重开对应 owning source 和计划判据；该 GO 仅准入诊断链所覆盖范围的后续动态阶段，不替代 CP、全批 6b、动态业务结果或整批 implementation review。
- 两轮审查完成时间顺序：R1 找到 3 项并由主 agent 核验修复；R1 所有确认项均有受影响 focused proof；随后 R2 fresh reviewer 对修订后当前源码复核并给出 GO 0/0/0。两轮期间未运行 DEV/Web/Android 动态场景。
