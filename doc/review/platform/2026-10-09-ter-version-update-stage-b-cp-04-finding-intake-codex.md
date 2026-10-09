# TER 阶段 B CP-04 finding intake：报告上下文失效

## Finding disposition

**分类：CONFIRMED。** 这是 CP-04 首轮独立对账提出的完整配置上下文失效缺口；作者重新核对原需求中“配置变化使旧上下文失效”、阶段 B 详设 §8.5 与实际 actor 后确认成立。

- **源码事实：** `terminalUpdateActor.ts` 原报告身份仅覆盖 binding，规则上下文身份与 pending report descriptor 没有关联。规则快照刷新在当前规则 context 变化时只清 snapshot；心跳发送前也无法拒绝配置变化前创建的 pending 报告。
- **反例：** 同一终端、绑定代次不变，管理员更改项目规则配置/更新时间；旧 pending 报告仍在 descriptor，下一次 PONG 会尝试按旧上下文向 CBS 发送。
- **影响：** 同绑定但不同配置上下文的旧报告可能被继续投递，且 pause/递送失败摘要也未按配置失效规则清理。
- **最小修正：** 在已有单一报告 descriptor 加入非秘密 `contextIdentity`，取自当前完整规则上下文（终端、绑定代次、当前服务空间、门店、项目、项目更新时间）。规则刷新或报告发送观察到新完整身份时，在同一 slice 持久清除旧 pending、pause 与失败摘要，再继续新上下文；身份暂不可读而绑定仍有效时保留原 descriptor，并禁止发送；绑定结束仍按既有生命周期清理。回执只更新仍存在且上下文身份匹配的项。不新增账本、持久结构或恢复机制。
- **同根检索：** `rg -n "reportDescriptor|pendingReports|sendPaused|currentRuleContext|refreshRuleSnapshot|sendPendingReport" apps/terminal/kernel/base/terminal-update/src apps/terminal/kernel/base/terminal-update/test`；已检查 descriptor 创建、更新、发送、规则刷新与 root reset 的生产路径和相关测试夹具。

## 当前字节修正与 focused proof

- `terminalUpdate.ts` 与初始 slice descriptor 记录 `contextIdentity`。
- `terminalUpdateActor.ts` 的完整规则上下文 identity 纳入 selectedSpace；规则刷新比较 binding/context identity，并在变化时持久清理旧报告状态；心跳发送在 context 不可读时不发送已知旧身份报告，身份变化时先清理再退出本次发送；task 报告优先使用固定 selection context，其他报告使用当前 context。
- 新增测试 `drops pending reports from a changed rule context before any network send`，断言 pending、pause、失败摘要被清除，身份更新且没有发 HTTP。
- `yarn workspace @catering-v2s/kernel-base-terminal-update test`：PASS，2 files / 37 tests。
- `yarn workspace @catering-v2s/kernel-base-terminal-update typecheck`：PASS，exit 0。
- 首败保留：一次包测试因新增刷新分支测试夹具仍使用不含服务空间的旧 selection context identity，命中 target context mismatch；将测试身份对齐当前 identity 后复验通过。另一次类型检查指出测试报告 reason 使用了不属于闭集的 `READBACK_UNAVAILABLE`；改为合法的 `UNKNOWN` 后复验通过。首次命令还有一处新分支括号不匹配，按编译器错误定位并修正后继续。未改宽业务判据。

## 阶段状态

CP-04 首轮 reviewer 结论为 OPEN。修正后需由 fresh read-only reviewer 对完整 CP-04 复核；此 intake 与 focused PASS 不冒充独立 MATCHED。当前字节未进行 CP-04 受管动态验收、整批 6b、管理后台浏览器或 TER 真机验证。
