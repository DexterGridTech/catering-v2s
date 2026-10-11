# TER 更新阶段 C CP-04 处置与三维对账

DATE=2026-10-10
CP=CP-04
RESULT=MATCHED
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER=/root/stagec_cp04_reconcile_final
SCOPE=同App凭证/业务投影与直接CBS下载；不含整批6b、动态验收或交付前13c

## Finding intake

### 非空 SLAVE credential 清除及“replace-host”路径

**分类：PARTIALLY_CONFIRMED。** 原证据缺口成立：原有 focused proof 没有直接从非空 SLAVE credential 开始，覆盖 clear command 将值清空并等待持久化。另一个“SLAVE 可以直接 replace-host、需覆盖该直接分支”的前提不成立：`ensurePairPreconditions` 在已配对时先返回 `TOPOLOGY_ALREADY_PAIRED`，并要求 `MASTER + CHIEF`；`pairByHostTopologyCommand` 和内部 `pairTopologyCommand` 都先执行该门。因此直接 SLAVE 替换新主机不是公开可达路径。

最小处置：

- `terminalDataClientActor.test.ts` 新增非空 credential 清除 proof。它匹配完整凭证身份，断言状态在 `flushPersistence` 调用前已变为 `null`，flush 成功后命令才返回 `cleared`。
- `topology.test.ts` 覆盖解绑清理失败时旧配对仍在、尝试配对新主机在 identity 查询前被 `TOPOLOGY_ALREADY_PAIRED` 拒绝；另覆盖清理成功的显式 unpair 后，新主机查询与配对才发生。
- 删除 `beforeSlaveCredentialTransition('replace-host')` 的不可达分支及相应类型分支。凭证清理仍由 composition 接到 TDC owner；拓扑行为保持“先 unpair，成功清理并转为 MASTER/CHIEF 后，再调用现有 pair-by-host”。

**更小替代比较：** 只新增“replace-host”测试会测试一个被前置条件永久屏蔽的内部调用，而非真实用户路径；新增 direct-replace 行为则扩大了产品能力。本处置保留现有 unpair 与 pair 命令，只去除死分支并测试批准的两步路径。

## 变更与 focused proof

- `apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts:615`：非空 SLAVE 凭证清除及 flush 顺序。
- `apps/terminal/kernel/base/topology/src/features/actors/actors.ts:146`、`:533`：配对前置条件；pair 命令移除不可达 replace-host hook。
- `apps/terminal/kernel/base/topology/src/application/createTopologyModule.ts:54`：transition 类型仅保留 `unpair | peer-unpaired`。
- `apps/terminal/kernel/base/topology/test/topology.test.ts:1164`：解绑失败阻断新主机查询；`:1448` 起覆盖成功解绑后再配对新主机。
- `yarn workspace @catering-v2s/kernel-base-terminal-data-client typecheck`：退出码 0。
- `yarn workspace @catering-v2s/kernel-base-terminal-data-client test`：PASS，PROD，8 files / 60 tests。
- `yarn workspace @catering-v2s/kernel-base-topology typecheck`：退出码 0。
- `yarn workspace @catering-v2s/kernel-base-topology test`：PASS，PROD，1 file / 44 tests。
- CP-04 前已完成且本次未改动其相应源码的 integration 证明沿用：console integration typecheck + 10 files / 68 tests；wallpaper integration typecheck + 6 files / 40 tests。它们不是本次重跑，也不代表 Web 或设备动态运行。

## Fresh 独立三维对账

Reviewer 独立检查当前需求/裁决、阶段 C 详设与计划及 IA、适用规范和 owning source，并对两项原 OPEN 做了反例核验。结论：

| 维度 | 结论 | 关键依据 |
| --- | --- | --- |
| 需求/裁决 | MATCHED | 正式需求 R-07/R-08；共享凭证裁决：副机凭证由 TDC 投影，解绑/换主机先清理；普通断链保留 |
| 详设/计划/IA | MATCHED | 详设 §8.6；计划 CP-04；IA §3；固定路径为 clear+flush 后转换，再以普通入口重新配对 |
| 项目记忆/规范 | MATCHED | TR-09 的 credential-only 具名投影边界；拓扑通过 TDC command 清理，不直接写 TDC slice |

独立 reviewer 确认：同步只含 credential/null；SLAVE reload 保持 inactive/stopped 但允许普通 CBS 请求；激活、取消、连接、TDS、报告仍受 MASTER 门限制；clear 失败不推进拓扑转换；瞬时断链不清凭证。CP-04 可退出。

## 证据边界

本记录关闭 CP-04 阶段静态三维对账，不是整批 6b 或 REVIEW_TARGET=IMPLEMENTATION verdict。Web、设备、CBS/TDS 真实环境、所有动态场景与 cleanup 仍 NOT_RUN。当前字节上的最新运行是上述 topology package test；最后一次通过也是该命令，针对当前 CP-04 字节。其他 integration package proof 是先前结果且相应字节未变，不升级为本次动态 PASS。

## 2026-10-11 unpair A/B 与 no-reset 差量复核

```text
REVIEW_TARGET=CP_STAGE_RECONCILIATION_DELTA
CP=CP-04
RESULT=MATCHED
OPEN=0
REVIEWER_KIND=FRESH_INDEPENDENT_SUBAGENT
REVIEWER=/root/stagec_cp04_reconcile_fresh
SCOPE=本轮新增的 topology→TDC state-clear request / TDC→topology completion handshake、pair state-sync/no-reset、相关依赖/invariant/test 与 assembly 接缝
TESTS_RUN=NONE
DYNAMIC=NOT_RUN
```

fresh reviewer 对当前变化范围做了三维独立静态核对，结论 `MATCHED`。正式需求/最新裁决、详设/IA/计划及 terminal-coding standard/TR-09 均与实现一致：Topology 的 SLAVE unpair 先发 internal request；TDC actor 清除自己拥有的 credential、topic/cursor/remote-operation state 及 status projection，flush 并读回成功后发 completion；Topology 收到 completion 才推进角色转换。clear/flush/readback 失败不会继续转换。pairing 不调用 root reset，复用既有声明式 master-to-slave state-sync；local-only state 保留。ordinary disconnect 保留 credential；terminal-update 的 fixed task 保留；integrations 只做 assembly/composition，不持有 unpair 业务逻辑。

重点源码/测试锚点：

- `apps/terminal/kernel/base/topology/src/features/commands/commands.ts:31-40`：两个 internal request/completion command。
- `apps/terminal/kernel/base/topology/src/features/actors/actors.ts:668-707`：SLAVE unpair 请求后等待 completion，失败保留修复状态。
- `apps/terminal/kernel/base/terminal-data-client/src/features/actors/terminalDataClientActor.ts:979-1055`：TDC 清理、flush、readback 与 completion command。
- `apps/terminal/kernel/base/topology/src/application/createTopologyStateSyncController.ts:150-172,274-360`：按声明 slice 与方向处理 state-sync。
- `apps/terminal/kernel/base/topology/test/topology.test.ts:1211-1282,1497-1568,2622-2661,2689-2697`：清理失败阻断转换、成功后重配对、pair 不触发 root reset、瞬断保留配对事实。
- `apps/terminal/kernel/base/terminal-data-client/test/terminalDataClientActor.test.ts:731-887`：TDC state 清空与持久化后才 completion，且不请求 app reset。
- 两个 integration assembly 仅 compose slice/公开依赖：`apps/terminal/ui/integration/sample-console/src/assembly/assembly.tsx:212-235`、`apps/terminal/ui/integration/sample-wallpaper-console/src/assembly/assembly.tsx:200-222`。

**差量结论：MATCHED，OPEN=0。** 原报告的 credential/plain sync、CBS HTTP、generated operation 与 role gate 结果未受本次差量影响，按原 CP-04 MATCHED 记录复用；本轮不把源代码核验提升为测试执行结果。Reviewer checklist 记录：已读当前规范/需求/计划、全部 memory kernel 与 deterministic-context-only、six-dimensional recall（一次通用 route 成功，terminal-specific route 因验证失败关闭并直接回读适用原文）、Topology/TDC/update/state-sync/两 assembly owning sources 和测试；先独立判断，后读此前报告比较。未运行测试、typecheck、build、Web、Android 或动态环境。

本轮 latest evidence 仍是前述 topology package test；新增 independent reconciliation 是静态证据，不是运行。Expo Web、DEV、Android、双机及业务/cleanup 仍 `NOT_RUN`；全批 6b 与 13c 尚未完成。
