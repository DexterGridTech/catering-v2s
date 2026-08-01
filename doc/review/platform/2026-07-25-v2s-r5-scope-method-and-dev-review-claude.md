---
title: R5 范围、执行方法与 DEV/seed 交付要求 Claude 独立评审
type: review
status: DELIVERED
reviewTarget: doc/decisions/2026-07-25-v2s-r5-scope-and-method-decisions.md
reviewer: Claude
createdAt: 2026-07-25
---

# R5 范围、执行方法与 DEV/seed 交付要求 Claude 独立评审

## 结论

```text
VERDICT=GO
M=0  S=0  N=4
```

六项裁决忠实于双盲收敛与全部既有边界:单 deployable/单库多 schema/双 admin/无 MQ-outbox-TDP 未被触碰;R 原子交付与"半小时 section"兼容机制成立;32 分母、C-01 retain、parked 排除准确;G-07/G-09/G-10 无过度推导;五宿主处置诚实;DEV/seed 契约红线合规且明确排除 production/cutover 误称。四条 N 均为一句话级同步/衔接项,可随设计授权一并落。

## 亲验记录

1. **fresh 复跑**:`roadmap-program-registry` PASS;`standards-coverage --phase R5` PASS(150,无到期红);`claude-review-handoff --file <request>` PASS;corpus 哈希 `51415f7d…` 与裁决 §4 声明逐字一致。
2. **D-01(原子+section)**:与 CLAUDE.md 的 R 原子交付规则一致;可核性机制(section≈半小时+evidence index+group 内持续机械验证与 focused evidence)使原子复核可执行。**如实记录**:我在双盲对比中曾建议分波审查,该分歧由 Dexter 既有 R 原子规则裁定,本裁决是其忠实执行;"问题不得推迟到末尾才首次发现"的持续验证义务是对我担忧的正面吸收。
3. **D-02(契约惯例)逐项对边界**:八项均在双盲识别的冲突集内且各有明确取舍;幂等改 header 修正了 v2s R3 的 GET 错置;`groupWorkspaceKey` 全量统一执行 G-10 裁决;Problem 域前缀+correlationId 必填优于 v2 扁平 85 值;无双形状保留。
4. **D-03(五宿主)**:与我方盘点(K-04:定义 8 类/值宿主 5 类)一致;"不建空壳、不删语义、留演进位、未来另裁"是诚实处置,且不触碰 G-01–G-12。
5. **D-04(衍生三态)**:OPERATING/PREPARING/NOT_OPERATING 严格只读 task-read、不驱动任何 command/阻断、不选唯一当前合同、要求写清时钟与日期端点——与 G-09"存在性判断+用法待裁决"完全兼容,本裁决即其用法裁决。
6. **D-05/D-06(设计门与 DEV/seed)**:C-02 只作 R5 新 Journey ✓;DEV 契约逐条对红线——start/restart 只 additive Flyway 绝不 seed ✓、reset allowlist+前后 readback+不自动 seed ✓、seed 显式版本化+dry-run+批量 readback+分账 ✓、check 不得人工冒充 ✓;"借鉴 v4 formal-UAT 方法不拓扑"明确排除 RocketMQ/outbox/投影/缓存 ✓;`r5-full` 覆盖面(双 admin 身份、多空间/集团/组织、角色/准入/邀请、实体/门店启停、五宿主扩展值、货号二元组、三态、负权限用例)足以支撑 Dexter 亲测 32 项;明示"开发/验收环境,非 production/cutover" ✓。
7. **Roadmap 对账**:§0 状态块已更新(`LAST_CLOSED_STEP=R4 / WAITING_R5_DESIGN_EXACT_AUTHORIZATION / R5_SCOPE_AND_METHOD_DECIDED`),frontmatter `r5ScopeDecisionRef` 与英文冻结注记在;**但中文叙事段仍停留在"R4 IN_REVIEW 等待 Claude review"时点**——见 N-1。
8. **委托链**:`decisionOwner: Dexter delegated to Codex` + 委托原话记录在 frontmatter,与 Dexter 交办一致;裁决内容全部落在委托范围(双盲遗留项+DEV 要求),无越权扩权。

## Findings(均 N,不阻断)

### N-1:Roadmap §0 中文叙事段失鲜,与状态块矛盾

行 123 叙事段仍写"当前 `LAST_CLOSED_STEP=R3 / CURRENT_STEP=R4 / CURRENT_STATUS=IN_REVIEW`…等待 Claude 全范围独立 review",与行 76–79 状态块(R4 已关闭、R5 scope decided)冲突——状态 owner 文件内部自相矛盾会误导 fresh 会话。**最小修复**:叙事段更新至现状,并顺手在 §11 加一行 D-01(每波 review 执行解释修订)与 D-06(DEV/seed 进 R5 完成条件)的 ref。不需 Dexter。

### N-2:expectedContextVersion 收敛需与 B.4 上下文失鲜语义写明衔接

D-02 废除 `expectedContextVersion` 作为 edge command 并发字段,但 manifest B.4(行 59 系)要求 contextVersion 进入 query arg/cache key/tag、失鲜返回 typed stale。**最小修复**:R5 设计中写明——收敛仅指 edge command 字段,客户端 cache/tag 的版本携带与"上下文失鲜可检测"语义保留(由服务端 readback 版本供给);防止把 CAS 语义连同字段一起丢掉。不需 Dexter。

### N-3:seed 写入通道需明确,否则"不绕过邀请/授权语义"不可核验

`r5-full` 要 seed 运营身份与任职,而 G-07 规定新增任职只走邀请。**最小修复**:设计中明确 seed 通道优先级——优先经真实 owner command/邀请链重放构造;确需 fixture 直写的表列入显式白名单并记录理由与审计,使"非后门"成为可检查命题而非口号。不需 Dexter。

### N-4:幂等 header 需等价约束并登记 R3 三 operation 的迁移

v2 body 字段带 `minLength:16/maxLength:128`;header 形态需等价约束声明;同时 A 批需显式列出 R3 三 op 的迁移项(移除 GET 上错置的 required header、初始化补幂等)。**最小修复**:两句话进契约基线条目。不需 Dexter。

## 章节对照(范围/治理评审,紧凑版)

B.1–B.3/B.6:由 D-02 契约惯例与既有 R4 门承接,本裁决无新增运行时语义;B.4/B.5:D-06 前端要求 + carry-over-first/foundation 优先条款命中(§4 后续要求);Part C 规范性条款:D-02 错误码/typed 常量方向一致;D.1–D.8:五命令分权/日志/受管运行由 D-06 逐条命中,其余 `NOT_APPLICABLE(本轮不产生实现)`。

## 授权边界

本 GO 仅确认该裁决可作为 R5 全范围设计的冻结输入(四条 N 随设计授权一并落)。不授权 R5 Journey、交互、详设、任何 app/contract/database/Flyway/test/业务源码、DEV、远端连接、seed/reset 或动态运行;`R5_DESIGN_AUTHORIZED=true` 由 Dexter 另行记录后设计才可开始。Git 归 Dexter。
