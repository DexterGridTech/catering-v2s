---
title: RP-02a 同源契约消费者恢复 Journey 绑定
status: DEXTER_ACCEPTED
createdAt: 2026-08-05
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: false
---

# RP-02a 同源契约消费者恢复 Journey 绑定

```text
JOURNEY_ID=R5-EDGE-CONSUMER-COVERAGE-RECOVERY
STATUS=DEXTER_ACCEPTED
SKILL_USED=cs-spec-to-plan@bd813d97c343571fdf22f88fe6573a7deb7ac5fd7ec73ea11b4957a270a5f7b9
DECISION_OWNER=Dexter
UI_BEARING=false
CORPUS_VERSION=doc/plans/platform/2026-07-25-v2s-r5-edge-contract-dialectical-assessment.md@current
```

## 1. 这不是一个新产品 Journey

本决策绑定的是 R5 已接受的 platform-admin、operations-admin 与 public 业务任务集合，
不是新增页面、登录流程、Drawer 或业务 actor。它为 RP-02a 提供一个可审查的技术恢复单元：
契约分母演进后，诊断消费者必须继续对应已有 task 的 owner、source、readback 与安全边界。
现有 task 的语义仍以
`doc/plans/platform/2026-07-25-v2s-r5-edge-contract-dialectical-assessment.md#6.执行前冻结条件`
及其 23 组 operation 评估为准，不能由 generated route registry 反推业务含义。

## 2. 任务与成功结果

- **业务 owner**：edge contract owner、workspace-iam/organization/contract 业务 owner，及维护已批准业务任务消费者的受管诊断维护者。
- **当前任务**：恢复 154 个 generated route-face tuple 与手写 scenario facts、R5 placement/catalog、诊断 workload 和测试断言之间的同源关系；处理契约删除后仍发送的 `projectId`，并纠正 operations recovery 的真实四步调用。
- **成功结果**：每个 registry tuple 都有手写的 source-backed fact 或逐条 owner/source disposition；catalog 的具体 operation 集合与 placement/registry 相等；store/contract create body 不再发送 owner 已删除字段；recovery workload 的调用顺序与 owner 路径一致；静态 red mutation 能阻止同根问题回归。
- **失败后仍成立的事实**：registry 只提供强制覆盖分母，不提供 businessTask、sourceRefs、oracle 或 ownerReadback；session/project scope 仍是项目范围真相；未获动态授权时，静态证明不得冒充 HTTP/L2/seed business PASS。

## 3. 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型 | 产生/确认位置 | 来源证据 | 未满足时行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 业务任务集合 | contract/edge owner | R5 现有 task、face、owner、命令/读模型边界 | `ESTABLISHED_SOURCE` | R5 评估与 catalog | `doc/plans/platform/2026-07-25-v2s-r5-edge-contract-dialectical-assessment.md#2.逐组评估` | 不新增 operation 语义；标记 disposition 并停止实施 |
| generated route-face 分母 | 诊断维护者 | 当前 154 个 operation-face tuple | `ESTABLISHED_SOURCE` | generated registry + U01 placement | `apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json`、`doc/evidence/platform/r5-u01-edge-placement-resolution.json` | exact-set 失败；不得手工改数字 |
| owner 行为 | owner/诊断维护者 | controller 调用的 owner service、readback、CAS/idempotency 形状 | `ESTABLISHED_SOURCE` | backend owner controller/service | `apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/workspaceiam/PlatformWorkspaceInvitationController.java`、`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/organization/OperationsOrganizationHierarchyController.java` 及详设列出的 owner source | 缺 source-backed disposition 时保持未覆盖，不运行 workload |
| 受管执行身份 | 诊断维护者 | 仅在后续独立授权中使用 managed manifest/credential，不在 RP-02a 静态单元中登录 | `EXTERNAL_PREREQUISITE_DEXTER_DECISION` | 后续动态验证包 | `doc/review/platform/2026-08-05-v2s-whole-engineering-remediation-design-and-execution-plan-codex.md#5.执行批次、并行边界与完成条件` | 当前 RP-02a 不启动 HTTP/L2/seed；不以 fixture 代替用户身份 |

## 4. 范围边界与禁推

- **范围内**：facts/dispositions exact set、catalog/placement crosswalk、static request payload、RM1/test assertions、operations recovery order、real red mutation。
- **非目标**：D4 runner validator（RP-02b）、常驻日志（RP-03--06）、OpenAPI schema 变更、backend owner 逻辑、DEV/UAT、HTTP/L2、reset/seed、前端页面或 UI interaction。
- **禁推**：不能把 operationId、method、route、face 或 controller 名称当作 business task；不能把 registry 自动生成 scenario；不能把 `projectId` 从允许的 query/read context 删除；不能把 operations recovery 的“附近七步 invitation”误改为四步。
- **禁止伪修复**：把 147 改成 154 但不补 facts、对 catalog 只改 denominator、删掉所有 projectId、把四步改成七步、运行 seed 证明静态 payload 正确、把历史 HTTP evidence 当作本次 fresh business PASS。

## 5. 方案选择

| 方案 | 裁定 | 原因与反例 |
| --- | --- | --- |
| 从 registry 派生 facts | 拒绝 | registry 没有 businessTask/sourceRefs/oracle；会让错误 route 看似覆盖，违反手写事实不变量。 |
| 只改 147/144/121 三个数字 | 拒绝 | 数字相等不能证明 42 个具体 scoped operation 与 9 个 obsolete generic operation 的语义映射，也不会阻止已删 request field。 |
| 只用人工 facts、不修 catalog | 拒绝 | catalog 是 R5 的 operation/page/owner 语义索引；121 与 154 长期分叉会让 contract-face/production-conformity 继续错误。 |
| **采用：手写 10 条缺失 fact + 具体 catalog crosswalk + payload/recovery 静态 red proofs** | 接受 | 保留 registry 与 facts 的语义分离，同时把 generic→scoped operation 替换显式落入 catalog；不引入 D4 或动态基建。 |

## 6. UI 适用性

`UI_BEARING=false`。本单元没有 user-facing route/page/Drawer/public/login interaction；它只校正已批准任务的静态消费者证据和受管 workload 形状。此判断来源于 R5 assessment 的 operation/task 对账（尤其 `#4.为什么不把所有 task support 合并`）与 RP-02a 原始问题材料 `doc/review/platform/2026-08-05-v2s-whole-engineering-merged-review-claude.md#1.2`。

## 7. Dexter 裁决

- **裁决**：接受进入 implementation-facing 详设与独立 DESIGN 盲审。
- **精确范围**：仅一个原子单元 `WHOLE-ENGINEERING-RP-02A-U01`；catalog 的 generic→scoped 替换、10 条缺失 fact、workload/test payload、recovery order 与静态 red proof 一次完成。
- **已知前提**：D4 不阻塞 RP-02a；动态 HTTP/L2/seed 仍是后续单独授权。
- **未决项**：RP-02b 的 validator 选型仍等待 D4；本单元不处理。
- **后续允许动作**：先完成详设、manifest、独立子 agent DESIGN 审查与 Claude handoff；只有两者 GO 后，才以新的 exact-surface implementation package 激活源码写入。
