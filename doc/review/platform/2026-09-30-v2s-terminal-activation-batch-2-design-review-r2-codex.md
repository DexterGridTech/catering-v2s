# 终端激活与长连接 · 批次二详设与实施计划 · 独立 DESIGN Round 2

```text
REVIEW_CYCLE_ID=TERMINAL-ACTIVATION-BATCH-2-DESIGN-2026-09-30
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewer=/root/batch2_design_review_r2_final
blindReview=true
authorMaterialReadAfterIndependentVerdict=true
VERDICT=GO
M/S/N=0/0/0
ROUND_FINAL_DECISION=SELF_DECIDED
EVIDENCE_TIER=STATIC_SOURCE_AND_OFFICIAL_DOCUMENTATION
TARGET_DESIGN_SHA256=91ce9a3c044481391dbc2c1ffc1e15b2eed2c4f280ebd57318dad315fc75d3df
TARGET_PLAN_SHA256=15a8b9c303b860452326f7d4973dfabaa3130d878bc847c9698973afb5d89a01
DESIGN_GAPS=none
L1_ENGINEERING=PASS
L2_USER_VISIBLE=PASS_FOR_DESIGN_SCOPE_NO_NEW_UI_ACTION
L3_UNVERIFIED=none_within_design_claims
DYNAMIC_EXECUTION=NOT_AUTHORIZED_NOT_RUN
```

## 1. 结论

Fresh reviewer 对所绑定的批次二详设与实施计划做了 Round 2 定向、证伪式静态复核，给出 `GO, M/S/N=0/0/0`。本轮是该 `REVIEW_CYCLE_ID + REVIEW_TARGET + 批次范围` 的第二轮且最后一轮；`ROUND_FINAL_DECISION=SELF_DECIDED` 收口。没有未关闭 finding，也没有需 Dexter 裁决的设计缺口。

本结论只确认当前两份设计文档在静态审查范围内具备进入后续独立评审/裁定的条件，不构成 Dexter 对设计的接受，不授权源码实施或动态验证。

## 2. 输入与审查绑定

Reviewer 在 verdict 前独立核对目标摘要，并报告先按证伪立场审查目标文档与 owning sources、形成初步判断，再读取 Round 1 处置材料作定向对照。目标摘要与本文件头一致。Round 2 输入清单列有 reviewer 实际报告的 decision inventory、memory 路由、模板、源码路径、官方来源及留痕限制，见 [Round 2 输入清单](2026-09-30-v2s-terminal-activation-batch-2-design-review-r2-input-checklist-codex.md)。

本轮覆盖需求与 D-37～D-51、Journey/service-shape、terminal-connection protocol、批次一边界、`server-config` 与唯一 credential owner、commands/selectors、Node/Undici 代理与 PMD、TDS readiness/node identity/drain、D-41 仓内输入边界、acceptance 场景与证据通道、受管 DEV 拓扑及 Batch 2/3 划分。

## 3. Round 1 finding 对照

`DR1` 为 Round 1 唯一 M：accepted Journey 第 48、54 行对持久凭证住址的冲突，以及初稿将 Journey 列为 CP-01 写入目标。作者修订仅涉及详设与计划：删除对 Journey/accepted decision 的修改承诺，记录来源漂移；按当前明确指派和 R-9.3/R-9.6/D-16，将唯一 credential identity owner 定为 `terminal-data-client/state`，`server-config` 只保留配置，并要求若冲突仍存在，则在 CP-01 写入前由 Journey owner 修订或交 Dexter 裁定。Journey 与 decision 原文件未改，也没有引入第二凭证库。

Round 2 reviewer 对上述处置复核后确认 finding 已关闭，初始与对照后的 verdict 均为 `GO, M/S/N=0/0/0`。不再启动第三轮 DESIGN review。

## 4. 关键设计核验结果

- `server-config` 明确纳入本期 Batch 2，负责环境/服务配置、默认值和受保护代理配置；凭证身份的持久化唯一由 `terminal-data-client/state` 持有，恢复与 reset retention 按 R-9.6 定义。
- 激活、取消激活由 `terminal-data-client` command→actor 执行；激活状态、连接状态与连接延迟由专用 selector 暴露，并在设计/计划中配置相应测试路径。
- 本批 Node 注入式 client 是唯一 PMD 接入证明；系统 TCP/TLS 代理由受注入的 Undici `ProxyAgent` dispatcher 处理，不自写 CONNECT。Node bundled Undici 与 standalone Undici 的版本边界分开描述，未把计划 pin 当作当前解析事实。
- TDS readiness、配置化 node identity、摘除后 drain 和受管拓扑具有对应场景与运行证据要求；设计未把跨节点会话协调、Doris、topic sync 或 Batch 3 内容移入本批。
- D-41 仓内输入限制、V-B15 的 acceptance scenario key、V-S9/V-S15 执行面及 CONTRACT/BUSINESS/TOPOLOGY_PREFLIGHT 分离均在设计范围内。

## 5. 留痕限制与验证边界

Reviewer 的后置清单审计将完整 120 项 `doc/decisions` 标题 inventory 标记为 `EXECUTED_BEFORE_FINAL_VERDICT_AND_RECORDED`，并记录了 25 个 recall `id/path`。可保存的来源映射中，若干 recall 项的完整 `sourceRefs/assertionSources` 与原始 recall stdout 未保留，详见清单中的 `EXECUTED_NOT_RECORDED`；这没有被表述为已读完每个未能定位的路径。reviewer 另记录了 verdict 前的相关 decision、模板、主要源码与官方 URL/claim。

精确 patch 版本的部分官方页面 URL/行提取未完整留存（Spring Boot 4.1.0 patch 页面、HAProxy 3.4.6 patch 页面）；设计将依赖解析与实际 runtime 行为核验留给对应 CP 的实施前/实施中 focused proof。该缺口没有被写作当前动态行为已通过，也没有被 reviewer 列为阻断设计的 finding。

本轮没有运行 build、test、generation、`scripts/verify`、DEV、Testcontainers、reset、seed、L2、UAT 或部署；动态验证仍未完成且未获本轮授权。

```text
INDEPENDENT_INITIAL_VERDICT=GO
AUTHOR_R1_DISPOSITION_COMPARISON=DR1_CLOSED
INDEPENDENT_FINAL_VERDICT=GO
ROUND_FINAL_DECISION=SELF_DECIDED
M/S/N=0/0/0
DESIGN_GAPS=none
IMPLEMENTATION_AUTHORIZED=false
DYNAMIC_EVIDENCE=NOT_RUN
```
