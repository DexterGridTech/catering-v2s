# TER screenPart 机型解析 · fresh 独立只读审查记录

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=2026-09-16-ter-screen-part-form-resolution
REVIEW_ROUND=N/A（implementation-facing design focused pre-implementation check）
reviewerKind=INDEPENDENT_SUBAGENT
AGENT=01a0a911-db1b-7ba0-935b-640a494b3f87
INPUTS=AGENTS.md;PLATFORM-BLUEPRINT.md;doc/platform/README.md;selected Roadmap authorization;project-memory;current requirements;implementation design;IA;implementation plan;latest Claude review
WRITE_BOUNDARY=只读；未修改文件、未运行构建/测试/运行时/设备/部署、未做 Git 操作
STATUS=COMPLETED
```

本记录保存 fresh 子 agent 返回的原始结论摘要。审查者先独立核对当前源码与文档，再报告 finding；主 agent 随后按最新 Claude 授权完成文档修订。该记录不是 `REVIEW_TARGET=IMPLEMENTATION` verdict，也不把实现结果预报为 PASS。

## 独立输出

### REJECTED_WITH_EVIDENCE — wallpaper 匿名 PRIMARY 为空的事实不成立

`sample-wallpaper-console/src/assembly/assembly.tsx:79-84` 同时装入 `createSampleStaffSessionModule()` 与 `staffAuthModule`；staff session 的匿名 bootstrap 会派发 `sessionRestoredAnonymousCommand`；`sample-staff-auth/src/features/actors/actors.ts:32-37` 的 `showLogin` 明确派发 `PRIMARY/main/sample.auth.login`，且 `:51-60` 在匿名恢复与退出登录时调用。wallpaper 本地 actor `sample-wallpaper-console/src/features/actors/actors.ts:49-67` 的匿名分支只派发 SECONDARY waiting，不能代表完整装配分母。sample-console 同样装入 staff-auth；其本地 integration module 只有 startup-ready actor。现有 `sample2Assembly.test.tsx:210-242` 只断言 SECONDARY waiting，没有断言 PRIMARY 为空。

最小处置是删除“真实 wallpaper anonymous null path”断言，改用显式 synthetic fixture，并说明它只代表合法空容器状态形状；不能把局部 actor 观察升级成装配事实。

### CONFIRMED — U-4b 文件级 diff 为空与 D-1/D-10 冲突

`sample-console/test/sampleAssembly.test.tsx:332-345` 与 `:348-385` 是 D-1/D-10 指定的 hand-built catalog/production-name 测试；U-4b 的 integration regression 用例在 `:704-836`。同一文件不能既完全无 diff 又按计划改动前两段。最小处置是把 U-4b 收到具名用例的实现与断言逐字不变，允许同文件其他计划内用例改动。

### CONFIRMED — 合并恢复文案必须中性化

`hydrated-container-not-renderable` 合并 other-form 与 retired/unknown 时， “当前机型无法呈现”会把已退役/未知误说成机型问题。保持单一 reason 与无 metadata 通道，文案改为“该恢复记录在当前 catalog 中不可呈现，已移除本次恢复记录”。

### DEXTER_DECISION — 直接实施授权与设计审查状态

Dexter 可以明确改变实施授权边界，但不能把未完成的独立审查伪装成已完成。文档应诚实记录独立审查状态与直接授权；本次 fresh 只读审查已完成，故不需要把它写成被 Claude/Dexter review 替代。
