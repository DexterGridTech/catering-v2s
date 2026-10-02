# 批次三详设/计划复评 finding intake 与修订记录

## 范围与结论状态

输入为 Dexter 转来的 Claude 对批次三详设/计划的静态复评（M/S/N=0/4/2）。按 finding 逐条重开需求、详设、计划、owner 源码与适用门定义后，六项均为 `CONFIRMED`，无产品裁决项；仅确认的缺口驱动了文档和 feasibility runner 的最小修正。

修订状态：四项 S、两项 N 的缺口均有对应修订与证据；R-14 resident probe 在限定字节/主机条件下 PASS。作者状态为 `READY_FOR_DEXTER_CLAUDE_REVIEW`，不是独立 `GO`；设计 cycle 未重开，等待 Dexter/Claude 对当前字节独立评审。批次三实现仍未获授权。

## Finding 处置

### S-1 · R-14 resident 设计前置

- **分类：** `CONFIRMED`（仓内需求事实 + 证据缺口）。
- **判据与证据：** 需求正本 R-14 明确先证明远端临时容器起停与 DEV 主机 resident 可行，再写详设：[2026-09-25 requirements §3.12](/doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:500)；复评所指详设 CP-01/R-14 记录把完整 DEV 同机、持久挂载重启及资源样本放到未来实施步骤，先后不满足正本。
- **影响：** 设计前置当时没有 resident 服务共存或持久数据目录重启证据，无法排除部署硬约束。
- **最小修正与证据：** 已新增受管探针 `scripts/dev/r5-doris-resident-feasibility.mjs`，并在 DEV 运行期间完成 health/SQL、同一容器与 bind mount 重启 marker readback、服务共存资源快照和 cleanup。结果为 `RESIDENT_PROBE_PASS_WITH_BOUNDS`；run、镜像摘要、首败与限制见[resident feasibility report](2026-10-02-v2s-terminal-activation-batch-3-resident-feasibility-codex.md)。详设[§4 CP-01、§11a R-14、§12](/doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md:100)与计划[CP-01](/doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-plan-codex.md:30)同步为：该样本对本次 host/字节限定关闭 resident feasibility 前置；未限 cgroup memory，不作峰值、持续负载或长期容量保证；Stream Load/权限/业务读回仍在实现 CP 验证。无 drift 时复用，host、镜像、runner或资源基线变化时再测。
- **Dexter 裁决：** 不需要。

### S-2 · PG open commit 至本地 active 安装窗口

- **分类：** `CONFIRMED`（设计推论，非已实现缺陷）。
- **判据与证据：** 当前 [TdsTerminalSessionActors.java:341-345](/apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java:341) 先调用 `repository.open(...)`，至[同文件:393-395](/apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/session/TdsTerminalSessionActors.java:393) 才安装 `active`。原设计未定义两者之间 B 更新 latest/通知先被消费、A 随后才登记的顺序闭包。
- **影响：** 即使通知处理会重读 PG，文档也未证明 pending candidate 不会在较新 session 已观察后回退安装。
- **最小修正：** 详设[CP-03第2-6步](/doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md:119)与计划[CP-03第2-6步](/doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-plan-codex.md:57)写定：PG open提交后、SESSION_READY/本地 active安装前按 terminalRef 权威重读；与通知reconcile经同一per-terminal actor顺序应用并保留已观察的单调sequence高水位；仅最新identity匹配且未落后才登记，否则关闭candidate；focused barrier proof覆盖B在A提交后/本地登记前取代A。动态证明留在批次三实施期。
- **Dexter 裁决：** 不需要。

### S-3 · reset 时 Doris 可用窗口与所有权

- **分类：** `CONFIRMED`（仓内执行顺序与设计缺口）。
- **判据与证据：** 当前 [r5-reset.mjs:147-152](/scripts/dev/r5-reset.mjs:147) 经受管入口先停 DEV；主流程[同文件:195-196](/scripts/dev/r5-reset.mjs:195) 随后才运行远端 PG reset。旧详设同时要求清 Doris 历史、SQL读回0，却没有提供停 DEV 后访问 resident Doris 的 owner/lifecycle。
- **影响：** 按原顺序 Doris 停止后无法 truncate/readback；临时重启又未定义 manifest 身份及失败责任。
- **最小修正：** 详设[§4 CP-04](/doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md:132)与计划[CP-04第1-2步](/doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-plan-codex.md:69)现规定：停业务历史写入者并cleanup PASS；验证同一受管resident Doris的container/image/mount identity与健康；在同一远端host truncate并readback=0；成功才进行现有PG reset。Doris步骤失败不执行PG reset；PG步骤后失败记partial reset，DEV保持停止且不start/seed；Doris容器/schema/mount/image由独立基础设施owner保留。reset仅在后续有授权与完整dry-run准入后运行。
- **Dexter 裁决：** 不需要。

### S-4 · CP-05/CP-06/full 6b 循环

- **分类：** `CONFIRMED`（计划内部依赖矛盾）。
- **判据与证据：** 原计划在CP-05要求整批 acceptance/§11a结果，但又规定所有CP与full 6b匹配后才跑整体验收；CP-06又包含依赖CP-06退出的全批结果。当前详设[§2及§4 CP-05/CP-06/批次级收口](/doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md:52)和计划[CP-05/CP-06/批次级收口](/doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-plan-codex.md:83)已同步闭环。
- **影响：** 执行者必须违反一处前置或重复跑完整验收。
- **最小修正：** CP-05只做新增场景focused proof；CP-06只完成本批适用门和focused proof后退出；全部CP MATCHED后独立6b，再做整体验收、cleanup、13c与整批IMPLEMENTATION review。六个阶段目标不相互依赖自身退出条件。
- **Dexter 裁决：** 不需要。

### N-1 · Doris event type 词汇

- **分类：** `CONFIRMED`（文档事实不一致）。
- **判据与证据：** 原详设在不同段落分别使用CONNECT/DISCONNECT与CONNECTED/DISCONNECTED。当前统一为 `CONNECTED`、`DISCONNECTED`、`HEARTBEAT_RTT`，见详设[§4 CP-02](/doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md:111)、[§11a](/doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md:276)与计划[CP-02第1步](/doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-plan-codex.md:47)。
- **影响：** event producer、writer、schema及SQL断言可能采用不同枚举值。
- **最小修正：** 所有生产者、schema、验收均使用上述单一闭集；不增加别名或兼容值。
- **Dexter 裁决：** 不需要。

### N-2 · V-G1/R-12 本批门映射精度

- **分类：** `CONFIRMED`（静态映射过泛）。
- **判据与证据：** 仓内[verify.mjs:23-36、128-133、162-168](/tools/verify-gates/verify.mjs:23)明确列出 backend/logging/database/query/code-layout/runtime-key 门、静态输出标记与自测入口。原详设只笼统指向“适用gate files”，无法逐条复验。
- **影响：** 实施者无法从计划判断哪道门跑在哪个verify模式，或该加什么red proof。
- **最小修正：** 详设[§9a.1](/doc/plans/platform/2026-10-02-v2s-terminal-activation-batch-3-implementation-design-codex.md:217)现在逐行列检查面、确切入口、validate-only/默认verify模式、真实门标记或原例marker；未受影响的OpenAPI/TER/operation budget/edge security/frontend/Flyway/seed写明N/A原因，并明确全仓verify照常运行，不把N/A当跳过。计划CP-06引用该有限表。
- **Dexter 裁决：** 不需要。

## 限度与未验证

- 当前受管探针不是 Doris 业务验收，`business=NOT_APPLICABLE`；只证明一次健康启动、简单SQL、数据目录重启读回和同机瞬时资源观察。
- Doris容器没有memory cap；host约29.95 GiB RAM，Doris健康后MemAvailable约18.53 GiB；这是样本，不是峰值或长期容量保证。
- 未运行Stream Load、最小权限、Doris reset、跨节点race/listener、backend-acceptance、scripts/verify或业务DEV场景；它们都在批次三实现授权之后。
- 受管DEV已按run owner停止且cleanup PASS；本轮没有遗留由本次启动的DEV或探针容器。
