# TDP 数据变化通知与远程运维 · round 1 finding intake

```text
REVIEW_CYCLE_ID=TDP_DATA_CHANGE_REMOTE_OPERATIONS_DESIGN_2026-10-04
REVIEW_TARGET=DESIGN
INTAKE_OWNER=主agent
EVIDENCE_TIER=当前需求/详设/计划/源码静态；无TDP生成、构建、测试、verify、DEV或动态运行
```

只把 Claude/独立 reviewer findings 作为待验证输入；以下是主 agent 对 round 1 的处置，不是独立 verdict。

| Finding | Intake | 主 agent 核验与反例 | 当前处置 | 剩余项 |
| --- | --- | --- | --- | --- |
| M-1 R-20 详设前置闭包 | `PARTIALLY_CONFIRMED` | 原需求 R-20 的技术 OPEN 确实要求在详设中形成方案与异常验收；但初始空集合时间不是 OPEN：R-07 明确首次空结果取0。TDS只读 owner cache task query、terminal credential、REGION 迁移 fail-closed、有限队列/消息/记录上限现在均在 CP 与验收映射中给出方案。容量属于设计提案，不冒称 Dexter 已批；第三方实际解析版本与官方 tag 依据仍需后续 CP 的依赖报告。旧绑定事实补报及 CBS ACK 事实保留期改变产品可见/接纳范围，保留为 Dexter 决策。 | 将 R-20 技术闭合与产品决策分开；计划要求实际 dependency report 后才执行使用该 API 的 CP。R-07 初始空集合改为明确按需求取0。 | 两项产品决定仍 OPEN；实际依赖解析与官方依据 NOT_RUN。 |
| S-1 WS/TDS/TDC wire 生成链 | `CONFIRMED` | 当前 `terminal-client-api.mjs` 只处理 HTTP OpenAPI；`terminal-connection-protocol.json` 尚无 TDP 消息 schema。原稿把目标 generated closure 写成既有事实。 | 详设/计划明确新增单一 canonical JSON 消息生成器、TDS Java/TDC TypeScript 产物、`--write/--check`、D-41 路径校验及负例；HTTP 生成链保持独立。 | 只属设计方案，生成与红夹具未执行。 |
| S-2 terminal HTTP 授权闭环 | `CONFIRMED` | materializer 的终端 authorization allowlist 只有原激活与取消接口；新增 read operations 若不改门会失败或放松凭证边界。 | CP-01 同步 OpenAPI、catalog、requirements、materializer allowlist、edge-codegen、TDC generated；新增读操作用 `TERMINAL_CREDENTIAL`，激活继续 `NONE`，逐类错配红夹具。 | 门/生成尚未运行。 |
| S-3 TER 执行面映射 | `CONFIRMED` | 需求旧文字要求设备执行，但当前 Dexter 明确限定此专项 Expo Web only；原矩阵无法区分逻辑投影、backend/DEV 与 adapter。 | §11a/计划拆列 CBS/TDS、TER、adapter。TER 动态仅 Expo Web；真实双设备和平台 adapter 标 `NOT_COVERED`；backend/DEV 单列，不冒充 TER 端 PASS。 | 全部未来场景 `NOT_RUN`。 |
| S-4 CP-07 / 6b 顺序 | `CONFIRMED` | 原 CP-07 把整批验收列为 CP 退出，而又要求所有 CP 与 6b 后才验收。 | 仅保留 CP-01～06；各 CP 关闭后独立阶段对账，随后独立批次 6b，再批次级 acceptance、cleanup、13c、review。计划完成定义同步。 | 6b/验收未执行。 |
| 补充：CBS↔TDS 远程调用跨进程通路 | `DEXTER_DECISION`（主 agent 发现） | R-13 的 owner/业务链有定义，但源码上 CBS 与 TDS 是独立进程，CBS module command 不能直接触发 TDS 进程内 socket actor，TDS 也不能直接调用 CBS Java owner。原详设只有“在线投递/回报”语义，未定义实际进程间载体。PG wake-up 可以唤醒，不足以自动解决结果写回 owner 的双向闭环；不得臆加队列或 owner 越权写。 | 在详设 §12 列窄私有 HTTP command/report API 与 PG wake-up/task-read 作为候选；推荐前者但需要 Dexter 明确接受其进程间接口/鉴权/路由，未确认前 CP-03/06 对应实现阻断。 | 产品/架构边界待 Dexter 决策；不影响 CP-01/02。 |

## 相关字节静态核对

- 当前 terminal HTTP 生成器：`scripts/generate/terminal-client-api.mjs`。
- 终端认证 materialize 闭集：`scripts/generate/r5-edge-materialize.mjs`。
- TDS 权威连接/通知：`apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/` 与既有 PG listener/repository。
- Runtime 观察接口：TER `runtime/src/application/createRuntime.ts` 暴露 `dispatchCommand(..., { requestId })` 及其返回结果；`requestLedger.ts` 是 `persistenceIntent=never`，不能替代 TDC 持久事实。
- 详设/计划除上表标明产品决定与实际依赖报告外，仍是设计提案；未将未来验收描述写成当前 PASS。
