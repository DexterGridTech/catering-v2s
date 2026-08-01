---
title: RM1 P5 Claude S1 复核整改 intake
reviewTarget: IMPLEMENTATION
scope: RM1-P5 Claude S1 当前字节整改
reviewerInput: doc/review/platform/2026-07-29-v2s-rm1-p5-implementation-review-claude.md
authorizationBoundary: 仅闭合 P5 S1 与补强 P-R6 直接证明；不授权 P6/P3-D、新 Journey/UI、后端/契约/数据变更、DEV、seed、reset 或动态环境
createdAt: 2026-07-29
---

# RM1 P5 Claude S1 复核整改 intake

## 1. 原业务问题与最小边界

P5 不新增任何用户 Journey。其服务的原始业务要求是：`G-03` 的角色匹配后台入口、`G-05` 的任职切换权限上下文、`G-10` 的两个独立后台。原文 owning source 是
`project-memory/decisions/confirmed-business-language-corpus.md` 的 `G-03/G-05/G-10`，P5 详设为
`doc/plans/platform/2026-07-28-v2s-rm1-restructure-and-remediation-implementation-design-and-plan.md#RM1-P5`。

本次只处理这些既有管理任务在网络失败时的诚实可恢复状态：候选数据请求失败后，用户必须看到错误且下拉不再伪装为仍在加载；主动登出的远程请求失败后，本地会话仍必须清除。这是已批准 `P-R2` 和 `P-R6` 的直接闭合，不改变页面、接口、权限、数据或 Journey。

## 2. Claude finding 的独立处置

| finding | 独立结论 | 证据与处置 |
| --- | --- | --- |
| S1：8 个 `loading={!candidates}` | `CONFIRMED` | 同根 35 个 TSX / 79 个 loading prop 扫描中，裸 candidate 失败态只有 StoreManagement 5 处、ContractManagement 3 处；两文件 catch 会保留 undefined candidates 并写入 `problem`。8 处均改为 `!candidates && !problem`。 |
| N1：RefreshSignal 无订阅 | `NOT_A_P5_FUNCTIONAL_DEFECT` | publish 无生产 subscriber，RTK tag 已为写后刷新权威；删除此 dormant residue 不改变 S1 用户结果，避免在最小整改中扩张范围。 |
| N2：P-R6 未直接定位 | `CONFIRMED_EVIDENCE_GAP` | 两 app root 均已有 `try { await remoteLogout } finally { clearLocalSession() }`，故不改生产语义；现补同一 gate 的双 root structural assertion 及两个真实 removal red mutation。 |
| N3：未重跑测试 | `CONFIRMED` | 已 fresh 重跑 foundation 7、platform 2、operations 6、platform typecheck、全前端/foundation eslint，以及 frontend architecture、codegen 与 standards gate。 |

`P5-REFRESH-SIGNAL-03` 的有限不适用理由、所有反例、扫描分母和 prevention set 已落在
`doc/evidence/platform/rm1/p5/rm1-u08-claude-s1-problem-family.json`；其 prompt disposition 是
`.runtime/compliance-control/problem-family-dispositions/97efa45bd47c8caed8d8d77fd3513f9e8ab2f7e0b8d284ee45e947c5f9826ab2.json`。

## 3. 防再发与替代比较

选择复用既有 `scripts/check/frontend-architecture`，没有新增第二套 gate。它只在同一 TSX 文件同时出现：候选 state、请求前清空该 candidate、失败 catch 写 `problem` 时，拒绝裸 `loading={!candidate}`；因此不误伤显式 loading flag、RTK `isLoading` 或已有 `!result && !problem` 反例。其真实 P5 Drawer 红变异会精确报
`R5_FRONTEND_CANDIDATE_LOADING_FAILURE_STATE_MISSING`。

更小的“只搜索字符串 `!candidates`”被拒绝：它依赖变量命名，无法覆盖同一失败模型的其他 candidate 名称。把两个局部读取迁为 RTK 也被拒绝：这会扩大 P5 整改，当前 local generation guard + 明确三态已满足 P-R2。

P-R6 的控制检验两个固定 app-owned remote logout 调用均包在 finally 的 `clearLocalSession()` 内；分别删除 platform/operations 清理均精确红。该直接证明补强不会把 session/router/baseApi 上提到 foundation。

## 4. 当前字节与复审要求

本 intake 之后的 package-exit、focused proof 与 post-remediation review request 必须由当前字节重新计算。此前 independent-subagent cycle 已按 2/2 封顶；本文件不发起第三轮，只请求 Claude 对 S1 整改结果复审。
