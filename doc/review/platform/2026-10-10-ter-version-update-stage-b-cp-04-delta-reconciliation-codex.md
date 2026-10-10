# TER 阶段 B CP-04 差量三维对账

- CP：CP-04 TER 供给、CBS HTTP 报告与心跳触发重试
- 结果：**MATCHED**
- reviewer：fresh read-only `/root/stageb_cp04_delta`
- 范围：此前 CP-04 MATCHED 后的报告 descriptor 身份/UNKNOWN 持久化修正，以及 CBS 下载异步超时配置差量。
- 不代表：运行时下载完成、Android 安装读回、阶段 B 整批动态验收或最终 IMPLEMENTATION GO。

## 对账依据

1. `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:571-621,737-763`：报告描述符与任务事实一起持久化；实际信息不足时以 `writeTask` 保存 UNKNOWN；报告携带明确的 rule/FULL/HOT 引用，不从目标版本或 taskId 猜测。
2. `apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts:338-432`：直接反例验证从完整 actual APK facts 转为 UNKNOWN 后，固定任务身份与 pending report 仍可读回。
3. `apps/backend/catering-business-server/src/main/resources/application.yaml:1-5` 与 `TerminalUpdateDownloadController.java:75-108`：服务端 MVC 异步上限为 130s；内容 endpoint 校验长度与摘要并记录完整流结束状态。
4. Android 客户端仍保持 120s 完整调用时限和完整 ZIP 摘要校验；详设计划 CP-04 要求成功必须同时有完整长度、摘要和流结束证明。
5. `doc/review/platform/2026-10-10-ter-version-update-stage-b-6b-delta-reconciliation-codex.md` 对同一当前字节差量独立判定 MATCHED。

## 证据边界

本记录是当前需求、详设/计划和项目规范对实现差量的静态三维对账。130s 设置尚未由当前 DEV 下载运行证明有效；完整 body、ZIP 摘要、服务端 `STREAMED`、Android installer readback 与 cleanup 均待受管动态验收。历史失败保留于 `doc/review/platform/2026-10-10-ter-version-update-stage-b-failure-diagnosis-codex.md`，不得升级成修复后的通过证据。
