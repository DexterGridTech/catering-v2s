# TER 阶段 A FULL 非成功 readback boot 身份差量处置

## Finding intake

**分类：CONFIRMED**

**判据：** 阶段 A 详设 §8.3/§8.7 要求终态 task 保留同次 boot 身份，直到确认后继 boot 才释放；正式需求要求失败工件继续拒绝重入。Claude 差量复评 `doc/review/platform/2026-10-09-ter-version-update-stage-a-ds-fix-static-rereview-claude.md` 指出的非成功 readback 路径确有差异。

**仓内事实：** `apps/terminal/kernel/base/terminal-update/src/features/actors/terminalUpdateActor.ts` 的 reconcile 分支在 FULL readback 非成功时，以 `action.bootId` 写入终态 task。Android FULL action 可以不提供该字段；因此 `null` 覆盖了 task 创建时保存的 bootId。释放逻辑只在保存的 bootId 与后继实际 boot 不同时清理 task。结果是该失败 task 可永久占位。

**最小修正：** 非成功状态使用 `action.bootId ?? task.bootId`；成功状态仍只使用本次权威 `actualBootId`，缺失时沿原 UNKNOWN 路径处理。不增加新状态、重试能力或恢复框架。

**focused proof：** `terminalUpdate.test.ts` 同一用例覆盖 waiting-user→failed 的 null action boot、当前 boot 阻止新规则、Runtime 持久化重建后继 boot 释放、旧失败工件继续拒绝及随后不同修复工件被接受。命令：`yarn workspace @catering-v2s/kernel-base-terminal-update test`。结果：`TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-terminal-update`，PROD，2 个测试文件、31 个测试，runner cleanup PASS（退出码 0）。此前第一次失败是测试序列未考虑旧工件拒绝本身会保留一个失败 task；随后按现有状态机补充一次后继 boot。第二次失败是测试误用通用 phase 名；按生产阶段枚举修正为 `applying-full`。最终同一包测试通过。

**边界：** 此记录关闭的是本次 D-S 差量 finding，不是阶段 A 整批交付 verdict；阶段 B 实施和动态结果另按本次 Dexter 授权进行。
