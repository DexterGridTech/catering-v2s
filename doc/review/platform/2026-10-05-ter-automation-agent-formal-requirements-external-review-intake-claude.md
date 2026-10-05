# TER automation-agent 正式需求 · 外部 Claude 评审 intake

```text
INTAKE_OF=doc/review/platform/2026-10-05-ter-automation-agent-formal-requirements-external-review-claude.md
REVIEWED_SHA256=bc607783963ca82b46b8b7bd32f2625906948fa4bdb7fff002b7b85a5f2b9955
EXTERNAL_VERDICT=NO-GO，0M/3S/3N
REVISED_OBJECT_SHA256=3c16668cd5b85456c1d89ee8f1f63432a090b8bbf8ba23b4a6a8f37fb9fd89fc
AUTHOR=Claude（作者会话，续接会话）
NATURE=作者辩证 intake 与处置，不是独立 verdict
```

| # | 作者复核 | 结论 | 处置 |
|---|---|---|---|
| S-1 | 重开 `apps/terminal/kernel/base/runtime/src/application/createRuntime.ts:362`：`runtimeId` 只在 Runtime 创建时生成。只断网时 Runtime 并未重建 | CONFIRMED。原文要求断网恢复后换新的 runtime 身份，与此冲突 | R-03 拆成 runtime 身份与连接会话身份两种；订阅绑定连接会话；断网恢复不得重建业务 Runtime。R-11、F-2、V-03 同步 |
| S-2 | 重开 `doc/platform/implementation-task-template.md`：第 6 条要求 CP 在 focused proof 与修复完成后才做退出对账；6c“对账前移”要求首次动态运行前先完成独立对账 | CONFIRMED。原文把退出 MATCHED 放在了 proof 之前 | §3 进入条件改为两道关：首次动态前的静态对账，以及 proof 完成后的 CP 退出对账。proof 失败在 CP 内修复，不提前给出 MATCHED |
| S-3 | 我此前向 Dexter 说明的理解是“整个专项排在后面”，但 D-1 与 §8 只写了“实施” | CONFIRMED，属作者笔误 | D-1 与 §8 改为：详设与实施都在 Codex 批次完成后开始，之前只做需求静态评审 |
| N-1 | 重开 `createRuntimeJournal.ts:18-27`：subscribe 不回放已有事件 | CONFIRMED | R-07 改为无空窗观察：先订阅再分发，或使用可证明无空窗的快照加订阅组合 |
| N-2 | 术语歧义成立 | 采纳 | R-09 写明：Web 端为 viewport CSS 像素，Android 端为 display 物理像素，换算只做一次；F-1 增加非零滚动情形 |
| N-3 | 外部事实：Android 网络安全配置支持按域名信任随包携带的指定 CA。本会话没有再打开官方页，采信评审给出的官方链接 | 采纳 | §6 改为非穷尽列举，补上按域名信任指定 CA 的方式 |

评审在“设计缺口”中指出 `review-standard.md` 无法同时表达“已知 NO-GO finding”与“L3 未验证”两种状态。这是规范侧缺口，不属于本需求范围，本 intake 不处理，记录在此供 Dexter 参考。

修订后没有新的独立 verdict。六项都是评审认定的文字收敛项，不涉及新的产品裁决。
