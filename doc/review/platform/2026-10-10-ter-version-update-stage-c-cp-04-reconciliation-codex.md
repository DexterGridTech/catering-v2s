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
