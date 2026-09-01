# TER `kernel.base.state` implementation-facing 详设与实施计划 · Claude review request

```text
REVIEW_STATUS=READY
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_CYCLE_ID=TER_KERNEL_BASE_STATE_DESIGN_20260831
REVIEW_TARGET=DESIGN
IA=NOT_APPLICABLE_WITH_REASON
```

## 背景

`kernel.base.state` 需求经两轮独立评审与 Dexter 四项裁定后定稿。Dexter 本次只授权 Codex 编写
implementation-facing 详设与实施计划，尚未授权实施。当前材料把 POC 的 manifest、批量写假原子、运行期 hydrate、
public reset action、latest-wins 与三 scope 轴收敛为：构造期 preloadedState、逐 key 提交、runtime health、actor-only reset、
无状态 authoritative full snapshot 与仅 workspace 一轴。

Codex 内部 fresh 独立子 agent 已按两轮硬上限完成对抗审查：Round 1 为 NO-GO 2M/1S，Round 2 为 NO-GO 1M/2S；
作者逐条回源后六条全部确认并闭合，处置与原始结论在同一 review report。本次请 Claude 从 current bytes 独立复判，
不要把作者处置、56 exports 或文档自洽当作 GO 证据。

## 评审目标

请先独立回答“问题是否正确、方案是否优于更小替代、代价是否与当前阶段匹配”，再以“找出它为什么不能直接实施”
为立场核验：公开类型和算法是否完整可实现，持久化在失败/重启/迁移/reset 下是否不丢数据，TR-01/TR-03/TR-09
例外是否足够窄，十组测试与四道门能否真正证伪，以及计划是否已消除实施者自由猜测空间。

## 需阅读文件

- `AGENTS.md`：授权、步骤级对账与独立评审边界；
- `PLATFORM-BLUEPRINT.md`：平台目标；
- `CLAUDE.md`：方案合理性、右尺寸与 findings 处置；
- `doc/plans/platform/2026-08-31-v2s-terminal-kernel-base-state-requirements-claude.md`：已定稿需求；
- `doc/plans/platform/2026-08-31-v2s-terminal-kernel-base-state-implementation-design-codex.md`：待评详设；
- `doc/plans/platform/2026-08-31-v2s-terminal-kernel-base-state-implementation-plan-codex.md`：待评计划；
- `doc/review/platform/2026-08-31-v2s-terminal-kernel-base-state-implementation-design-review-codex.md`：两轮 fresh 子 agent 原始结论与作者 intake；
- `doc/platform/terminal-coding-standard.md`：TR-01/02/03/04/09/10 及 state 读写例外正本；
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md`：单 VM、单 store、多 surface 与主副屏裁定；
- `project-memory/decisions/terminal-build-order-and-batches.md`：包顺序与依赖边界；
- `apps/terminal/kernel/base/contracts/src/index.ts`：`TimestampMs` 等真实前置公开面；
- `apps/terminal/kernel/base/platform-ports/src/index.ts` 与 `src/types/stateStorage.ts`：五态 `StateStoragePort`；
- `apps/terminal/kernel/base/state/`：当前仅骨架的目标包；
- `tools/terminal-skeleton/verify-static.mjs`、`tools/terminal-skeleton/verify.mjs`、`tools/terminal-skeleton/verify.test.mjs`：计划修改的 TER-local 入口；
- 同父目录 `newPOSv1/1-kernel/1.1-base/state-runtime`、
  `newPOSv1/1-kernel/1.2-feature/topology-runtime-v3/src/foundations/syncRegistry.ts`、
  `newPOSv1/1-kernel/1.2-feature/runtime-shell-v2/src/foundations/runtimeStateSync.ts`：只读 POC 事实源。

## 独立核验重点

1. 不采信 Codex 的方案表，先从需求、TR-01/03/09、StateStoragePort 与 POC 独立推导最小 state toolkit；比较
   “照搬 POC”“只建纯 helper”“当前 async runtime”三支，判断当前方案有没有过度设计。
2. 核验六字段 descriptor 的两个 discriminated union 是否真让四条双向一致性在类型层成立；reducer 必填是否正确；
   非导出 unique-symbol brand + WeakMap 是否能在无 `any`/双重 cast 下实现异构 registration，并拒绝外部伪造。
3. 核验 key grammar 的编码/冲突/相邻前缀；每物理后端一次 listKeys/readMany；所有写删逐 key；record entry 独立提交；
   baseline unknown 写栅栏、首败后继续、dirty cache 是否共同避免全绿但重启丢数据。
4. 核验 hydrate 在 store 暴露前形成 preloadedState；reset 只有 command→actor→私有 root action，且持久层全删成功后
   才让 owner reducer回初始值；runtime health 不是 slice、三类 timeout 有精确来源。
5. 核验五个 sync helper 的完整泛型、参数顺序与 full/partial 返回；value/tombstone 互斥；authoritative
   replaceMissing、tombstone、sync→persist 成立，同时无 latest-wins、sequence、session 或 receiver ledger 回潮。
6. 核验 workspace 只建 MAIN/BRANCH；最后一个 `/` 拆分与 `${sliceType}.${workspace}/${actionName}` 输出是否和 owner
   reducer 对齐，非法 type/缺 workspace/其他字段保留是否均有可证伪用例。
7. 逐条核 D/P/R/F/H/C/M/X/S/T：共享 Map 的真重启、hydrate→flush 零写、部分提交合法恢复、迁移两阶段失败、
   reset 删除失败内存不变、codec 非 JSON 值、T-6/T-7/T-8 与 ts-expect-error 反控能否抓到目标缺陷。
8. 核验 ST-2/ST-3/ST-5/ST-6 与 exact-export support 是否只判机械事实，每个 red mutation 是否定向且其他门绿；
   state 是否被精确接成第 3 个 REAL_TESTS owner，owner 总数 8、no-test 5。
9. 复算 exact exports 是否为 56，检查公开面是否过宽或漏项；特别构造“所有判据通过但包仍没建成/重启仍错误”的路径。
10. 检查详设、计划、测试、完成信号与 README 要求是否残留互斥方案或开放式措辞；评估 4 CP、10 组测试、4+1 门
    是否右尺寸，有没有可以删除且不损失反证能力的机制。

## 期望结论

请给明确 `GO` 或 `NO-GO`，汇总 `M/S/N`。每条 finding 写精确文件与行号、事实类别（仓内事实、POC 外部事实、
推论、产品判断、`UNVERIFIED_REQUIRES_EVIDENCE` 或 `DEXTER_DECISION`）、可证伪失败条件、后果、最小修复与为什么
更小方案不足。涉及产品/Journey/权限的事项单列“需 Dexter 裁决”。请列出实际打开核对与未核部分。

本轮是静态 DESIGN review；不要求动态运行，不能把尚未运行的未来命令当作 GO 证据。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请独立评审 TER kernel.base.state 的 implementation-facing 详设与实施计划。

背景：本包需求已完成两轮独立评审与 Dexter 四项裁定。Dexter 本次只授权 Codex 编写详设与实施计划，尚未授权实施。当前材料将 POC 的 manifest、批量写假原子、运行期 hydrate、public reset action、latest-wins 与三 scope 轴收敛为构造期 preloadedState、逐 key 提交、runtime health、actor-only reset、无状态 authoritative full snapshot 与仅 workspace 一轴。Codex 内部 fresh 独立子 agent 已按两轮硬上限审查：Round 1 NO-GO 2M/1S，Round 2 NO-GO 1M/2S；六条均已由作者回源确认并修订。请从 current bytes 独立复判，不采信作者 intake、56 exports 或文档自洽。

评审目标：请先独立判断问题是否正确、方案是否优于更小替代、代价是否匹配当前阶段，再以“找出它为什么不能直接实施”为立场，核验公开类型与算法、持久化失败/重启闭包、TR-01/TR-03/TR-09 边界、十组测试、四道门和逐文件计划是否成立且没有 false-green。

请从 catering-v2s 仓库根阅读：
- AGENTS.md、PLATFORM-BLUEPRINT.md、CLAUDE.md；
- doc/plans/platform/2026-08-31-v2s-terminal-kernel-base-state-requirements-claude.md；
- doc/plans/platform/2026-08-31-v2s-terminal-kernel-base-state-implementation-design-codex.md；
- doc/plans/platform/2026-08-31-v2s-terminal-kernel-base-state-implementation-plan-codex.md；
- doc/review/platform/2026-08-31-v2s-terminal-kernel-base-state-implementation-design-review-codex.md；
- doc/platform/terminal-coding-standard.md；
- project-memory/decisions/terminal-architecture-and-stack-rulings.md；
- project-memory/decisions/terminal-build-order-and-batches.md；
- apps/terminal/kernel/base/contracts/src/index.ts；
- apps/terminal/kernel/base/platform-ports/src/index.ts 与 src/types/stateStorage.ts；
- apps/terminal/kernel/base/state/；
- tools/terminal-skeleton/verify-static.mjs、tools/terminal-skeleton/verify.mjs、tools/terminal-skeleton/verify.test.mjs；
- 同父目录 newPOSv1 的 1-kernel/1.1-base/state-runtime、1-kernel/1.2-feature/topology-runtime-v3/src/foundations/syncRegistry.ts、1-kernel/1.2-feature/runtime-shell-v2/src/foundations/runtimeStateSync.ts（只读 POC 证据）。

请重点独立核验：
1. 先从需求、规范、端口与 POC 推导最小方案，比较照搬 POC、只建纯 helper 与当前 async runtime，判断是否过度设计；
2. descriptor 双 discriminated union、必填 reducer、non-exported brand + WeakMap 是否真能无 any/双重 cast实现异构且不可伪造的 registration；
3. key grammar、每后端一次 list/read、逐 key 提交、baseline unknown 写栅栏、失败继续与 dirty cache 能否防止重启丢数据；
4. preloadedState hydrate、actor-only reset、持久层先删成功、非 slice health 与三类 timeout 是否闭合 TR-01/03/09；
5. sync helper 的精确签名、full/partial、互斥 value/tombstone、replaceMissing、sync→persist 是否成立，且无会话账本/latest-wins 回潮；
6. workspace 最后一个斜杠拆分与完整 action type 是否对齐 owner reducer，错误分支和字段保留是否可证伪；
7. D/P/R/F/H/C/M/X/S/T 是否真能抓到假重启、全量重写、半提交、迁移/reset 失败、非法 JSON 与 type fixture 未编译；
8. ST-2/ST-3/ST-5/ST-6、exact-export support 和 8 owners = 3 REAL + 5 NO_TEST_FILES 是否只判机械事实且每项有定向 red；
9. 独立复算 56 exports，并再构造一条“所有判据通过但包没建成或重启仍错误”的路径；
10. 检查详设/计划是否残留互斥方案或开放式措辞，4 CP、10 组测试、4+1 门是否右尺寸。

请给出明确 GO 或 NO-GO，并汇总 M/S/N。每条 finding 请写精确文件与行号、事实类别、可证伪失败条件、影响面、最小修复及为何更小方案不足；产品/Journey/权限事项单列“需 Dexter 裁决”。请列明实际打开核过与未核部分。本轮是静态 DESIGN review，不要求动态运行，也不得把未来未运行命令当作 GO 证据。

授权边界：你的 GO 只表示这两份设计材料可以交 Dexter 决定是否作为后续 state 实施输入；不自动授权实施，不授权修改 TER 源码或端口、其余 21 包、adapter/native、设备、仓级 normal verify、DEV、seed、reset、浏览器 L2、UAT 或部署。谢谢。
```

## 授权边界

Claude 的 `GO` 只表示两份设计材料可供 Dexter 决定是否授权后续实施；不自动授权源码写入、端口、其余包、native、
动态运行、设备、仓级 normal、DEV、seed/reset、浏览器 L2、UAT 或部署。`NO-GO` 只形成 findings 输入，仍须 Codex
回源核验并由 Dexter 收口。
