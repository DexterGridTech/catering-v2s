---
title: RM1 P6 carry-over authority ledger reconciliation
status: ACTIVE_IMPLEMENTATION_DESIGN
packageId: RM1P6-AUTHORITY-LEDGER-U05
---

# RM1 P6 carry-over authority ledger reconciliation

## 原始问题、目标与授权

P6 的 ST-8 和 ST-11 authority ledger 行都声明同一 current carry-over manifest 为 authority，分别绑定
target path 与 focused evidence selector。重新读取完整同源分母后，ST-11 的两个 consumer trace 均与当前树
一致；同时发现 ST-8 与 ST-11 都保留旧 SHA-256。ledger 按 ID fail-fast，因此最初只报告 ST-11，不能据此
把 ST-8 留在错误状态。问题是同一 authority metadata hash drift，而不是 UI consumer 漂移或业务行为缺陷。

继续全量读取 P6-owned ledger rows 后，ST-2 的两条 consumer/trace 路径仍指向已不存在的
workspace-membership feature；当前 P6 roster 和源码已将其收敛到 workspace-user 的
WorkspaceUserPage 与 WorkspaceInvitationPanel，且两者逐项命中原 error-detail pattern。此为同一
current-tree ledger drift 的第二形态，必须在 U05 一并对齐。ST-9 的 refresh trace 全量为空，但它的
closurePackage 是 P5；U05 不修改它，而将其保留为显式 P5 successor debt。全局检查随后先报
closurePackage 为 P1 的 ST-3：其 direct-closure 仍断言已不再存在的 platform page catalog access
shape。这是 P1-owned、由 U04 catalog consumer 当前形状暴露的 ledger-control compatibility debt，不是 U05
可借由恢复旧页面结构修复的项。两项
external debt 均禁止被行级 P6 proof 伪称为 full-ledger PASS。

U04 的 immutable baseline 后才独立确认此 debt；其 static PASS 不恢复 ST-11。本 amendment 在 Dexter 已授权
RM1 P6 实施范围内建立正确 baselined 的 U05 successor package，仅修复这两个同源行的 authority hash，
并保留它们既有 relation。

## 有限范围与 owner 边界

有限分母是 ST-2/ST-8/ST-11 ledger rows、carry-over manifest authority bytes、ST-2 的两条迁移 consumer/
trace 路径、ST-11 两个 consumer trace 和 ledger checker；ST-9 仅作为全局 check 的 P5 external debt
readback，不属于本 package 的 repair denominator。
允许变更仅为 authority-ledger row、其既有 checker 的必要 focused proof，以及本 U05 package evidence。
不修改 carry-over manifest 的 focusedEvidence 语义、平台或运营前端 .tsx、router、catalog、generator、
OpenAPI、owner command、数据库、DEV、seed、reset、L2 或动态业务验证。

两个 trace 先被逐项 readback：app trace 的四个路径和 policy trace 的两个路径均与 expected set 相等。
因此 repair 只能将 ST-8/ST-11 authority.sha256 对齐现行 manifest bytes，并将 ST-2 的两个已迁移 consumer
路径同时改为当前 source/trace exact set；不得以改 pattern、改 relation kind、删除 trace 或重写 authority
source 来掩盖失败。

## 验证顺序与禁止伪修复

先激活 U05 并建立 baseline，再保留 ledger checker 的真实红态 readback，之后仅更新 ST-2 consumer paths
和 ST-8/ST-11 hash，执行 selected-row self-test、P6-owned current-tree row check、source-compliance、receipt
equality、standards coverage 和
独立 implementation review。静态证明不构成 business PASS；本 package 的 business 与 cleanup 均为
NOT_REQUIRED_CONTROL_ONLY，不启动任何受管 runtime。

禁止：修改 trace search pattern；将 frozen metadata 改称 edge-codegen output；修改任何 UI consumer 来获得
ledger green；把 P1-owned ST-3 或 P5-owned ST-9 debt 混入本 package；回写 U04 exit；或把此 static evidence reconciliation
宣称为 L2、业务或 P6-2 总体 closure。

## Package exit

退出必须证明 ST-2 current consumer/trace exact set、ST-8/ST-11 authority hash 精确等于现行 carry-over
manifest、ST-11 两个 trace 的 exact set 未变，selected-row red mutation 仍能拒绝不合法 row、package
变更/receipt 集合精确相等，并保留全局 ST-3 P1 / ST-9 P5 debt、U04 和 P6-3
的静态/动态边界。38 个 physical screen IA baseline、最终 IA 对齐与受管 L2 仍为后续 P6-2 serial work。
