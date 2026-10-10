# TER 阶段 B taskId 契约差量处置

`FINDING=S-1: report taskId wire contract mismatch`
`DISPOSITION=CONFIRMED`
`CP-04_DELTA=MATCHED`
`BATCH_6B_DELTA=MATCHED`

## 核验与根因

生产任务创建原先使用 `update:${ruleRef}:${createdAt}`，但 canonical `contracts/openapi-source/terminal-update.schemas.json` 将报告请求的 `taskId` 定义为 UUID；生成 DTO、CBS owner API 与持久层均按 UUID 解析和保存。受管 run `2142e05c-6934-45fd-8e13-58e14db95b57` 的日志记录完整 FULL/HOT 执行成功后，`terminalUpdateReportSubmit` 多次返回 400，TDC 将报告保留并重试，最终因 pending report 未投递而失败。清理为 PASS。该证据与 UUID schema/CBS 类型一致，确认失败是线上线契约不匹配，而不是下载或更新任务本身失败。

## 最小修正

- `terminalUpdateActor.ts` 通过现有注入的 `createProtocolUuid()` 生成任务身份；该值仍作为 opaque identity 传递，不从中解析规则或时间。
- `createTerminalUpdateModule.ts` 注释同步说明同一 UUID 来源用于持久任务 ID 与 TDC 报告身份。两个 sample composition 已提供该能力。
- 扩展已有 boot-release 测试，断言 task ID 为 UUID、值与持久化内容一致，成功状态跨启动保留原 ID，下一任务获得不同 UUID。
- 未修改 OpenAPI/CBS、没有新增 ID 解析、持久账本或兼容路径。同根消费扫描未发现依赖原 composite 格式的生产消费者。

## 影响范围与当前证明

- 当前实现位置：`apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts`，任务创建点；直接测试位于同包 `test/terminalUpdate.test.ts`。
- focused proof：`yarn workspace @catering-v2s/kernel-base-terminal-update test`，2 个文件、43 项通过；`yarn workspace @catering-v2s/kernel-base-terminal-update typecheck` 退出码 0。
- CP-04 taskId 差量独立三维对账：`MATCHED`，见 `2026-10-10-ter-version-update-stage-b-cp-04-delta-reconciliation-codex.md`。
- 整批 6b taskId 差量独立三维对账：`MATCHED`，见 `2026-10-10-ter-version-update-stage-b-6b-delta-reconciliation-codex.md`。

## 动态证据边界

修复后受管 Android `update.supply-chain` 尚待在 console 与 wallpaper 两个 sample 分别验证。本记录不将静态对账或 focused test 升级为 CBS 报告投递成功。当前字节上的最新受管运行仍是上述首败 `BUSINESS=FAIL / CLEANUP=PASS`；修复后的动态结果待运行。
