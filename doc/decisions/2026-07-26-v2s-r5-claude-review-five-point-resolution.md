---
title: R5 Claude 设计评审五项裁决
status: ACTIVE_SCOPE_DECISION
createdAt: 2026-07-26
programId: V2S_W0_W4_EXECUTION
decisionOwner: Codex under Dexter delegation
delegationRecord: Dexter message “由codex做所有裁决” on 2026-07-25
reviewCycleId: R5-W3-DESIGN-20260725
reviewTarget: DESIGN
implementationAuthority: false
---

# R5 Claude 设计评审五项裁决

## 1. 边界

本裁决只关闭
`doc/review/platform/2026-07-25-v2s-r5-whole-scope-design-review-claude.md`
中五个需要产品或架构取舍的设计问题。它不改变 32 项 Journey、104 项 operation、38/55/11
face 分母，不建立新的 review cycle，也不授权 contract、应用、数据库、测试、DEV、seed/reset
或动态运行实施。`R5_IMPLEMENTATION_AUTHORIZED=false`。

## 2. 裁决

### D-07：业务日历时区

R5 的业务日历时区固定为 `Asia/Shanghai`。所有发生时间仍以 epoch millis 保存和传输；
`BusinessDateProvider` 仅在合同 `effectiveFrom/effectiveTo`、派生经营状态与其他纯日历日期
边界上把统一 `TimeProvider` 的瞬时值投影到 `Asia/Shanghai`。DEV 固定时钟必须同时固定
instant 与 zone，默认 profile 不得装配固定时钟。

理由：已确认语料面向中国购物中心经营场景，`Asia/Seoul` 是作者会话环境泄漏，不是业务事实。
选 UTC 会使本地合同日界线偏移，选系统默认时区会使同一 fixture 在不同机器上漂移。

### D-08：角色页面准入与动作能力提交

保持现有一个 operation 和 104 项总分母，不扩成 106。角色授权命令使用两个独立字段：
`pageAccessKeys` 与 `actionCapabilityKeys`；两组分别做闭集、重复项、调用者可授予上限和目标角色
约束校验，然后在同一个 owner transaction 中原子替换。读模型也必须分别返回两组，禁止把
动作能力折叠成页面准入、由页面推导动作或拆成两个可产生中间态的命令。

交互文案同步改为“分别选择，统一保存”，不再使用可能被误读为两个提交动作的“分别保存”。

### D-09：项目分期保持名称数组

删除 `phase_key` 轻主数据化方案。项目只保存按用户顺序排列、trim 后非空且大小写敏感唯一的
分期名称数组；合同如需引用分期，只保存当时的 `phaseNameSnapshot`，不得建分期 owner、
分期 ID/key、生命周期、反向 FK 或隐式字典。名称后续修改不反写历史合同快照。

理由：G-04 只批准名称快照。稳定 key 会无授权地把辅助输入升级为主数据，并制造额外迁移、
并发与引用语义。

### D-10：停用门店候选集按任务分别裁决

- 邀请新增任职的门店候选集必须排除停用门店，接受邀请时由 owner 再校验；既有任职不因门店
  停用被自动撤销。
- 合同创建/编辑的门店候选集不得仅因门店停用而过滤或阻断；响应必须返回门店启停状态供 UI
  如实展示，但合同有效性、派生经营状态与门店启停彼此不互推。

理由：邀请是创建新的访问关系，向停用节点新增任职没有可执行用户价值；合同则受 G-08
“启停不反推合同”约束，统一过滤会偷偷创造未批准业务门。

### D-11：Flyway 继续单一历史，不从 V1 重开

R5 不从 `V1` 重开 migration，也不得改写、重命名、删除或重排 R3 已执行 migration。
所有 R5 数据形状变更在同一 Flyway history 后追加 migration；对 R3 遗留列采用
expand → backfill → constraint/read-path switch → later cleanup 的 additive 兼容步骤。
R5 本轮若必须保留旧列完成安全切换，应在 schema disposition 中明确 `TRANSITIONAL_RETAIN`，
不得用 clean DEV rebuild 掩盖已有数据库升级路径。

理由：successor 已有 R3 真实基线；重开 V1 会同时破坏增量升级证明与单一 history 红线。

## 3. 同步责任

以上五项必须同时进入主设计、开发 agent 蓝图、contract catalog、DEV/seed contract、Journey/
交互工件及相应 manifest；只改一处不算关闭。任何 owning 文档出现相反语义时立即 fail-closed，
回到本裁决，不允许实施 agent 临场选择。
