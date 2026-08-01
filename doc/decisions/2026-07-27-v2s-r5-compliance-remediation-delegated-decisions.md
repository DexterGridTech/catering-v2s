---
title: R5 合规整改七项委托裁决
status: DEXTER_DELEGATED_CODEX_DECIDED
createdAt: 2026-07-27
programId: V2S_W0_W4_EXECUTION
reviewCycleId: R5-COMPLIANCE-REMEDIATION-DESIGN-20260727
decisionOwner: Codex under explicit Dexter delegation
implementationAuthority: false
runtimeAuthority: false
seedResetAuthority: false
---

# R5 合规整改七项委托裁决

## 1. 授权来源与边界

Dexter 在收到
`doc/review/platform/2026-07-27-v2s-r5-compliance-remediation-design-review-claude.md`
的 `NO-GO(M=1 / S=1 / N=2)` 后明确授权：本件所有需要决策的事项由 Codex 全权裁决。

本授权只解决候选详设中的 D-1～D-7，不等于接受整个设计，也不授权 implementation、业务源码、
契约、migration、测试、`scripts/`、构建、DEV、数据库、远端运行或 seed/reset。实施仍须等待
Claude 对修订设计的 recheck、Dexter 接受设计以及后续 implementation exact authorization。

## 2. 裁决

| ID | 裁决 | 理由与约束 |
| --- | --- | --- |
| D-1 通用 registry | **选择 B：拆成独立 capability surface** | 通用 `Record` registry 无法忠实承载 face/capability 语义、typed endpoint、编辑生命周期和可定位 L2；保留它会继续制造手写字符串与弱类型边界。不得把独立 surface 解释为新增第 23 个 surface，仍在冻结 22/25 分母内归位。 |
| D-2 七个编辑能力 | **选择 A：R5 本轮全部闭合** | 七项已经属于冻结 22 surface 的 `ADAPT` 范围，后置会让 R5 已批准业务只读不完整。实施在 CR06 内按依赖小切片串行，但仍只做一次 R5 whole-scope implementation review。 |
| D-3 缺失 surface | **选择 A：全部纳入整改** | platform/operations 改密、operations 门店档案和五类 HOME bootstrap 都已有冻结 surface/pageDesignKey。HOME 只提供与当前 actor/context 对应的业务入口和摘要，不发明 dashboard、统计口径或新 Journey。 |
| D-4 商业集团初始化审计 owner | **选择 A：organization** | commercial group 是 organization 的事实，审计必须随 owning mutation 写入同一 owner 事实边界；`platform-workspace` 只可按批准任务读取或聚合，不能为省一次 reader 而复制审计事实。边界纯度优先于局部接线简度。 |
| D-5 extension workspace identity | **选择 A：additive 恢复 `workspace_uuid` 与复合完整性** | extension definition 是 workspace-scoped。新增 migration 恢复 `workspace_uuid`，并以 workspace/key/entityType 建立可诊断的复合完整性；不改写已执行 migration，不恢复 external-sync 语义。 |
| D-6 业务列表二级索引 | **选择 B：本轮不做猜测性索引** | 本轮只保留 PK/FK/UNIQUE/security 以及由真实 query 与 `EXPLAIN` 证明必需的索引。未被当前负载证明的二级索引登记为性能观察项，不作为 R5 完成欠账，也不允许凭 DEV seed 规模臆测生产索引。 |
| D-7 历史顺序偏离 | **选择 B：登记历史不合规，从 CR00 重建真实 baseline** | 不回滚现有正确字节；但后续任何整改必须先完成 CR00 的 source-derived baseline、触发 canary 与真实红证明，前包 exit 未绿不得跨越。 |

## 3. 包 ID 与名称

同时接受候选 Roadmap 的命名：

- 九个实施包固定为 `R5-CR00`～`R5-CR08`；
- 唯一 whole-scope implementation review step 固定为 `R5-CR09`；
- 严格顺序固定为 `CR00 → CR01 → CR02 → CR03 → CR04 → CR05 → CR06 → CR07 → CR08 → CR09`。

这些名称只确定计划结构，不产生实施授权。

## 4. 方案合理性

更小方案是保留通用 registry、后置编辑和缺失 surface，只修安全与契约；它成本较低，但会留下
“页面可看不可改”和弱类型手写 registry，直接违反 R5 的冻结业务范围。更重方案是重写整个 R5；
它会推翻仍然正确的 owner libraries、controller capability 布局和 106 operation 契约，回归成本
不合理。当前裁决保留正确资产，只在 CR00 建立真实控制后按依赖归位错误实现，阶段成本最合适。
