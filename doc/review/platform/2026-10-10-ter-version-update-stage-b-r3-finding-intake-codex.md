# TER 版本更新阶段 B R3 差量 finding intake

日期：2026-10-10。范围：仅核验 Claude R3 中剩余的无任务实际版本观察 S-1；不代表阶段 B 整批实现或动态验收结论。

## S-1：绑定周期序号不能作为 taskless observation 的首次标记

**处置：`REJECTED_WITH_EVIDENCE`（当前字节已具备所需闭包，无需再改源码）。**

- 判据：B 详设要求 report sequence 在同一 binding 周期内单调递增；完整上下文变化清除旧 pending 并重置 observation 去重事实；新上下文可为当前实际版本提交 `taskId=null` 观察，且不得把旧任务身份改签到新上下文。
- 当前源码：`apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts:338-348` 按 binding/context 身份重置描述符；同 binding 的 context 变化保留 `nextReportSequence`。`:404-432` 的 initial observation 明确令 `associatedTask=null`，且不继承 recent 中旧任务的规则/工件身份。`:445-470` 使用当前实际版本字段去重并以当前 sequence 创建报告，不依赖 `nextReportSequence===1`。`:911-935` 在完整 context 与当前 binding 相符且实际版本事实尚未观察时生成 taskless report。
- 反例核验：旧 task 已有 recent、同 binding 的 context 更新时间变化、实际版本不变但 bootId 变化时，descriptor 保留递增序号、清除旧 context 记录，并允许新观察；同 context 重复 reconcile 在 ACK 后不再分配报告。
- 直接测试：`apps/terminal/kernel/base/terminal-update/test/terminalUpdate.test.ts:965-1115` 覆盖首个 taskless report、重复 reconcile 去重、同 binding 新 context 使用递增 sequence 生成 `taskId=null`、旧 task rule/artifact 引用不继承，以及新 context ACK 后不重复生成。当前 focused 运行：Vitest `queues one actual-version observation for an active terminal without an update task`，1 passed，43 skipped，0 failed。
- 最小修正比较：评审建议的修法（以实际 binding/context 和版本事实去重、sequence 只作 binding-cycle 顺序）已经存在；再加独立序号判定或第二个队列会重复现有职责，故不做。
- 剩余边界：此结果只证明当前源码与该 focused unit case；不证明 HTTP 递送、CBS 持久化、Web/设备或阶段 B 整批动态验收。本 intake 不把这些项升级为 PASS。
