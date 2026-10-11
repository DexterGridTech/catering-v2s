# TER 更新阶段 C 全批三维对账（6b）

```text
DATE=2026-10-11
CHECK=WHOLE_BATCH_6B
RESULT=MATCHED
OPEN=0
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER=/root/stagec_full_batch_6b_1011
REVIEW_TARGET=WHOLE_BATCH_RECONCILIATION
SCOPE=CP-01～CP-06跨阶段需求/详设/项目记忆约束与当前 owning source；不含动态验收、13c或最终IMPLEMENTATION verdict
```

## 结论

Fresh reviewer 重新打开正式 TER 更新需求、阶段 C 详设与计划、项目记忆治理约束及当前生产 owner/source，按全批范围逐项检查跨 CP 接缝；没有将 CP 结论简单相加。独立结论 `RESULT=MATCHED`、`OPEN=0`。

reviewer 未运行命令、测试、构建、verify 或动态环境；未读取 `.runtime`。因此此 6b 仅为批次级静态三维对账，不是阶段 C 实施 GO 或任何运行 PASS。

## 全批交叉对账

| 交叉事实 | 当前 byte 对账 |
| --- | --- |
| owner 及依赖方向 | `project-basic` 拥有组织路径与项目版本规则；`store-basic` 拥有具体门店/经营资料并广播成功加载；`terminal-update` 拥有本机任务、更新执行及报告；`terminal-data-client` 独占 credential。`apps/terminal/kernel/feature/project-basic/src/features/slices/slice.ts`、`src/selectors/selectors.ts`、`src/features/actors/actors.ts` 与两套 integration assembly 的调用链符合需求及详设。未发现 base terminal-update 反向导入 feature owners。 |
| 业务 command 与观察 selector | project-basic 选出适用候选后通过公开 `requestTerminalUpdateCommand` 交给 terminal-update；selector 只用于读取状态及固定前资格复核。未发现 selector 替代跨包业务 command 或 integration 承担业务决策。 |
| 双机 credential 与角色 | TDC slice 同一 owner entry 明文保存并按 approved master-to-slave 规则投影完整 credential/null；SLAVE 保持 inactive/stopped，可本机请求 CBS，不依赖 MASTER 转发；pair 只接受同 App、不同 Runtime/设备身份，副机不连 TDS、不独立激活、不上报本机更新报告。 |
| 解绑闭包 | topology 发起清理请求；TDC actor 只清自己的 TDC 状态、持久化并读回后发完成 command；topology 收到完成后继续解绑。没有 root reset，terminal-update task 保留。此处与 Dexter 已确认的分阶段 command handshake 一致。 |
| 规则选择与固定任务 | project-basic 从完整 ready 快照选择业务候选；terminal-update 在固定前重读当前资格和实际版本，fixed 后不因规则变化换目标。当前 task/boot/action 状态沿原 owner，不新增第二账本。 |
| 工件、runner 与 fixture | canonical/生成/consumer 链与 current Stage C 两个 runner case (`update.supply-chain`、`update.pair`) 形态相符；供给链只允许 Android console/dual 与 wallpaper/mobile；pair 要求显式不同设备 serial。粒度矩阵标签不是 CLI case。fixture 使用契约中的 `term-front`/`term-handheld` 并受管读取凭证，不复制 activation code。 |
| 环境和 cleanup 边界 | Stage C 明确不执行 reset/seed、L2、UAT 或部署。case 复用既有 managed DEV fixture；资源通过唯一 managed terminal-automation 入口拥有与清理。不把旧 run、测试源码或静态审查当作当前动态业务/cleanup 结果。 |
| 跨 CP 顺序 | CP-01～CP-06 各自阶段记录为 `MATCHED`；全批 6b 为单独重新核验，符合“所有 CP → 6b → 整体验收”的顺序。默认 edge-codegen budget projection 因缺既存 `stagePlatformTerminalUpdateArtifact` projection 仍是详设声明的 `NOT_RUN/OPEN`，不属于本批新增 operation，也未伪报 PASS。 |

Independent reviewer 参考了各 CP reconciliation 作为导航/边界，然后重开相应原始需求、详设/计划与当前 owner 源码。其证据位置包括：

- 要求与职责边界：`doc/plans/platform/2026-10-05-ter-version-and-js-apk-update-formal-requirements-claude.md:129-152`。
- 当前授权、范围与跨阶段安排：`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-design-claude.md:17-33, 75-95, 147-170`。
- Stage C 执行计划及 reset/seed、runner 约束：`doc/plans/platform/2026-10-09-ter-version-update-stage-c-implementation-plan-claude.md:60-108, 118-130`。
- project-basic state/selector/actor：`apps/terminal/kernel/feature/project-basic/src/features/slices/slice.ts`、`src/selectors/selectors.ts`、`src/features/actors/actors.ts`、`src/application/module.ts`。
- terminal-update 本机状态与 TDC credential：`apps/terminal/kernel/base/terminal-update/src/features/slices/terminalUpdate.ts`、`apps/terminal/kernel/base/terminal-data-client/src/features/slices/terminalDataClient.ts`、`src/features/actors/terminalDataClientActor.ts`。
- 两 integration assembly：`apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx` 与 `apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx`。
- runner/fixture：`tools/terminal-automation/src/runner.ts`、`src/managedRun.ts`、`src/mainSampleJourneyConfig.ts`、`fixtures/managedActivation.ts`、`journeys/update.android.test.ts`、`journeys/update.pair.android.test.ts`。

## 证据边界与剩余事项

- CP-01～06：阶段级静态三维对账 `MATCHED`；本记录是独立全批 6b，不替代逐代码与详设对账 13c。
- `scripts/verify` 默认预算 projection 门：`NOT_RUN/OPEN`，按批准计划未纳入本批无关门。
- Stage C 的两项 integration Expo Web、受管 DEV 业务、console 真机双屏、wallpaper mobile 虚拟机、两组同 App pair、每个场景 business、fixture cleanup 和 runner cleanup：在本记录形成时均为 `NOT_RUN`。
- 无 reset/seed、L2、UAT、生产部署或商店发布。
- 最终实现 verdict 尚未进行，不能用本记录的 `MATCHED` 推导 `GO`。

## 状态

当前字节上的最新 focused 测试：`yarn workspace @catering-v2s/terminal-automation test test/terminalFixture.test.ts`；2026-10-11；PASS，1 file / 2 tests。

最后一次通过：同一命令；2026-10-11；PASS；针对当前 fixture/helper 字节。全批当前字节 Expo Web/DEV/设备动态结果尚无 PASS。
