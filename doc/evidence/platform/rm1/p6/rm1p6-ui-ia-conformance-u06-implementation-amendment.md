---
title: RM1 P6-2 UI IA conformance remediation
status: ACTIVE_IMPLEMENTATION_DESIGN
packageId: RM1P6-UI-IA-CONFORMANCE-U06
---

# RM1 P6-2 UI IA conformance remediation

## 原始问题、范围与裁决

P6-2 的历史 U02 prewrite baseline 只证明过一次写前 consumer/source hash 绑定；它明确不是
38 个物理 screen 的最终交互符合性记录，且历史 package exit 已失效。Dexter 要求逐项以 IA、
project-memory、physical screen contract 和当前源码独立对读，先建立新的 source-to-IA baseline，
再修复确认偏差，最终才能恢复受管 L2。

本包的有限分母为 platform-admin 的 38 accepted physical screen（36 个实际 consumer）。每项均核对：
业务任务、角色场景、入口/形态、控件、数据与级联、校验/错误、权限/状态、刷新/导航和 test-id/可访问性。
不把 static/type/generation proof 说成 business PASS，不启动 DEV、seed、reset 或 L2。

确认的问题族是：（1）已有 PAGE node 的页面标题绕过 generated catalog；（2）IA-required foundation/
accessibility/recovery 行为未完整接入；（3）owner 已具备的组织/合同筛选事实与 IA 的旧 GAP 描述冲突；
（4）集团空间运营后台地址仍是 IA 要求但没有 owner-approved contract readback；（5）roster 所列 focused
proof 文件不存在；（6）准备材料没有被明确限定为支撑当前最小变更的证据，并且每个变更点缺少强制的变更前/
变更后 IA、命中项目记忆、设计约束和可复用实现回读。平台 drawer/modal/field 的专有业务文案不是现有 PAGE/ACTION node 的可引用语义，禁止伪造
第二份 copy catalog。

## 实施边界与最小方案

1. PAGE 标题只从 `admin-catalog.json` 的 platform PAGE node 投影读取。`PLATFORM-ROLES` 的 display label
   以 IA `业务角色管理` 为准后重生成；不得拼接 raw suffix。
2. 保留 list name-link → detail → independent Drawer/Modal 的已批准流，所有列表继续禁止操作列。
3. 对 workspace scope、overview、edit/status conflict、extension save-result 和缺失 test-id 使用现有
   `admin-ui-foundation` primitive，不复制 foundation 行为。
4. 运营后台地址只能由 platform/workspace owner 的显式 readback 提供；禁止客户端由 workspace key、URL、
   router 或环境变量拼接。若 owner 尚无可授权的地址配置，记录为 owner contract closure，不伪造链接。
5. 组织/合同筛选的 current owner/controller 已落实时，以 U06 source reconciliation 显式重冻结 IA 的旧 GAP
   陈述；不回退到 client filtering 或“筛选准备中”。
6. 准备工作只做成当前变更点可执行且可复核的最小输入；每一个实现点在写前逐项重开对应 IA、六维命中
   project-memory 原文/owning source、当前详设/标准与可复用实现，在 focused proof 后再以同一输入逐项
   对照回读。该规则进入 AGENTS、仓内 memory-recall skill 与独立对抗审查 input checklist；它不允许 prompt hook
   注入上下文，也不以通用准备替代实际修复。

## 强制顺序

先写 `UI_IA_PREWRITE_BASELINE=PASS`（36 consumer / 38 screen / 5 source bindings），并在 active package
精确绑定 `uiInteractionAdmission`；之后才可修改生产 `.tsx`。每次变更均保留 hook receipt。所有 confirmed
differences 修复并由 focused proof 覆盖后，写最终 `UI_INTERACTION_CONFORMANCE_RECORD=PASS`；该记录是 L2
的前置条件。Dexter 于 2026-07-30 裁决：P6-2 不单独启动或修复 L2；P6-3 实施完成后，以 P6-2 与 P6-3 的完整
业务分母进行一次联合受管 L2。届时必须读取 run-scoped logs，并单独报告 business 与 cleanup；本包静态交付只能写
`L2=NOT_RUN_BY_DEXTER_SEQUENCE_DECISION`，不得把 focused/static/generation 说成 business PASS。

## 禁止伪修复

- 只改 allowlist 或 baseline hash 而不更新 implementation manifest 与 active binding；
- 以 raw string/local constants 替代 catalog 引用，或把 PAGE catalog 滥扩为纯文案字典；
- 用 row action column、client-derived operation URL、client full-list filtering 或 stale draft 覆盖 owner readback；
- 把 IA 旧 GAP 静默忽略、把测试文件不存在说成 focused proof，或把静态校验说成动态业务结果。

## Package exit

静态 exit 必须保留 38 项逐项记录及 IA/physical/current-source hashes，actual changed path 与 hook receipt exact-set，
source-compliance 和 due standards PASS，focused proof 实际存在且通过，并明确标出
`L2=NOT_RUN_BY_DEXTER_SEQUENCE_DECISION`。它不是 business PASS、也不取消 `contracts/policy/affected-l2-registry.json`
中 P6-2 的联合 L2 义务；联合 L2 的 business 与 cleanup PASS 是 P6-3 后的后继交付条件。
