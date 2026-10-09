# TER 阶段 B CP-04 独立三维对账

- CP：CP-04 TER供给、CBS HTTP报告与心跳触发重试
- 对账结果：**MATCHED**
- reviewer：fresh read-only `/root/cp04_reconcile_stageb`
- 覆盖范围：需求、阶段 B 详设/计划、适用项目约束，与当前 CP-04 完整实现；包括本轮新增的 `reportDescriptor.contextIdentity` 差量。
- 不代表：全批 6b、整批实施 GO、整体验收、逐代码 13c 或动态验收 PASS。

## 核验结论

1. **配置/绑定失效：MATCHED。** 当前完整身份由 `terminalRef / bindingGeneration / selectedSpace / storeRef / projectRef / projectUpdatedAtEpochMillis` 构成。规则刷新和 heartbeat 观察到身份变化时，先持久清空同一 report descriptor 的 pending、pause 与最新失败摘要；本次 heartbeat 不发送旧上下文报告。绑定身份变化与 root reset 也使用既有 descriptor 清理路径。
2. **同上下文重启保留：MATCHED。** report descriptor 属于持久 terminal-update slice；相同 binding/context identity 不重置队列，普通断线/hydration 保留 pending。
3. **配置暂不可读：MATCHED。** 绑定仍有效且规则上下文暂不可读时，刷新保留 descriptor；heartbeat 返回 `context-not-ready`，不发送已知旧身份报告。绑定已结束时沿既有清理规则清除。
4. **迟到回执隔离：MATCHED。** 回执后重读绑定和 descriptor，仅更新仍存在且 `idempotencyKey` 匹配的原项；receipt 还校验 reportId/taskId/sequence。当前 slice 项已被清除或替换时返回 `stale-result`，不会复活旧项或删除新项。

具体源码、测试与文档位置详见独立 reviewer 结论，重点为 `terminalUpdateActor.ts:336-345,374-401,523-529,571-637,1037-1039`，`terminalUpdate.test.ts:431-663,2768-2777`，以及阶段 B 详设 §8.5、计划 CP-04。

## 当前字节 focused proof

- `yarn workspace @catering-v2s/kernel-base-terminal-update test`：PASS，2 files / 37 tests。
- `yarn workspace @catering-v2s/kernel-base-terminal-update typecheck`：PASS，exit 0。
- 动态 DEV、管理后台浏览器与 TER 真机验收：尚未进入，按计划留到全 CP、6b 后统一执行。
