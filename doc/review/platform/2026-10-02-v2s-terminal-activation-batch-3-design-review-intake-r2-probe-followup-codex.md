# 批次三 DESIGN R2 finding · R-14 探针后 intake

REVIEW_CYCLE_ID=2026-10-02-terminal-activation-batch-3-design
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
INTAKE_OWNER=MAIN_AGENT
INTAKE_KIND=POST_VERDICT_EVIDENCE_FOLLOWUP
INTAKE_STATE=NO_GO_R14_RESIDENT_EVIDENCE_OPEN

## 独立 verdict 的历史状态

已完成的 fresh 子 agent 第二轮输出：`NO-GO，M/S/N=1/0/0`，`ROUND_FINAL_DECISION=SELF_DECIDED`。其唯一 finding 为 M-1：R-14 的设计前置未满足。该 verdict 针对本次 probe 前的证据字节；已结束的两轮本仓 DESIGN cycle 不重开，本文件不是第三轮 reviewer verdict。

## M-1 · R-14 设计前可行性证据不完整

- **原 verdict 分类**：`CONFIRMED`；**本次新增证据后的主 agent intake**：`PARTIALLY_CONFIRMED`。探针关闭了临时远端容器的健康/SQL/停止清理和单次主机资源观察缺口，但没有证明 DEV resident/full-stack 资源条件，finding 仍 OPEN，设计不自判 GO。
- **判据**：需求 `doc/plans/platform/2026-09-25-v2s-terminal-activation-and-connection-requirements-claude.md:506` 要求先证明 Doris 可在远端 Testcontainers 主机按运行起停、在 DEV 主机常驻，并给出每次运行启动耗时，再写详设。R-14 的原文没有授权以临时容器替代 DEV resident。
- **原 finding 证据**：`scripts/README.md:54-70,145,149` 区分 Testcontainers、DEV、L2/UAT 拓扑；当前 `scripts/dev/r5-dev-runner.mjs` 与 `scripts/dev/r5-reset.mjs` 尚无 Doris resident/reset 生命周期。第二轮 reviewer 对当前 runner 的判断成立。
- **新增运行证据**：`r5-tc-1790869525054-48267` 于 `2026-10-01T15:45:25.054Z` 至 `2026-10-01T15:47:01.361Z`；测试 `DorisFeasibilityProbeTest` 为 `1/1`，远端 Apache `apache/doris:all-in-one-4.1.3` 的 health-ready 32,215 ms、容器内 `SELECT 1` 119 ms、关闭 441 ms，runner test execution 与 cleanup 均 PASS。JUnit XML SHA-256 `a94ada667c0ccb1ece158fd373c2feac2d0276440fddbe7371657215a6788600`；run manifest SHA-256 `4abf41a5974869202965f9482154d48f1b0ca7db99da48b74f00cc94c6120697`。
- **资源观察及边界**：JUnit XML 记录单实例 cgroup RSS `1,559,093,248` bytes、`memory.max=max`；host before/after 可用 RAM、磁盘和 CPU 也有快照。该run的manifest `resources=null`，DEV未运行（`devLifecycle.wasRunning=false`）；未有现存 PG/MinIO/HAProxy/3 TDS 同机负载，不是全栈容量或持续预算。
- **分类依据**：R-14“远端临时容器能起停并执行SQL”的主张得到当前受管运行支持；“DEV resident、持久生命周期及共存资源可行”的主张仍无证据。无需改写需求或申请产品裁决即可确认这一区分。是否接受残余 OPEN 作为设计可审查输入，交本次 Dexter/Claude 评审决定；本 agent 不把它裁为 GO。
- **影响**：按 R-14 原文，resident可行性是详设前置。即使该设计可供评审，也不能声称前置全闭或据此进入批次三实施。
- **最小验收**：若要求关闭 R-14 M-1，须在不绕过受管生命周期的前提下补足 DEV resident 的受管 start/health/stop/cleanup、持久挂载/重启读回，以及与现存服务共存时的 host/Docker/Doris RSS 资源证据；或者由 Dexter明确决定是否接受当前限定范围证据并调整前置。当前授权的一次性临时探针不包含前述动作，未擅自执行。
- **当前处置**：详设与计划标记 `READY_FOR_DEXTER_CLAUDE_REVIEW`，`R14_DESIGN_PREREQUISITE=PARTIAL_PROBE_COMPLETE_RESIDENT_LIFECYCLE_OPEN`。该状态只表示材料已交审，不表示 `GO` 或实施授权。

## 运行状态

- 当前字节上的最新运行：`r5-tc-1790869525054-48267`，2026-10-01 UTC，feasibility probe PASS、cleanup PASS；运行所用临时测试源已移除，因此源码字节与当前树不一致。
- 最后一次通过：同一 run；只证明该临时 probe 的范围，不证明 DEV resident、全栈容量、Stream Load、reset 或跨节点行为。
- 未运行：本次 intake 后未重跑任何测试；只执行评审交接检查。

## 审查边界

本记录是主 agent 对 R2 finding 的证据 intake，不替代两轮 reviewer verdict，不增加 REVIEW_ROUND，不生成第三轮独立 verdict。下一步为 Dexter/Claude 对当前文档和新增证据作外部评审；批次三实施、DEV接线、reset/seed、L2、UAT和部署均未获本次授权。
