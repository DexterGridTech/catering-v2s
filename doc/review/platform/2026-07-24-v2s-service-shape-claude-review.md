---
title: v2s 新服务形态 ADR Claude 评审
status: GO
createdAt: 2026-07-24
reviewTarget: doc/decisions/2026-07-24-v2s-single-deployable-modular-monolith-service-shape.md
verdict: GO(0 M / 0 S / 3 N)
implementationAuthority: false
---

# v2s 新服务形态 ADR Claude 评审

## 1. 结论

`GO(0 M / 0 S / 3 N)`。

ADR 可以由 Dexter 决定接受并作为 v2s W0 冻结输入。该 GO 不激活 ADR，不授权建仓、代码实施、数据库变更、Roadmap 推进、Git、生产切流或破坏性操作。

## 2. 忠实性核验

Claude 全程参与 12 个根问题的裁决与补充焊点，并逐节核对 ADR。结论为：

- 12 项根裁决与约 20 处评审焊点均如实编码；
- 没有走样、夹带或静默扩权；
- coordinator 零资产、动作可用性禁止 SQL `CASE`、`AFTER_COMMIT` 白名单、`x-consumer-faces` 三方对账与 `INTENTIONAL_DIFFERENCE` 均已保留；
- “无真实夹具的门只能标 future work”正确继承了 all-v2 假绿教训；
- 前端补偿路径进入物理退役；
- runtime role 权限缺口等代价被诚实登记；
- A–G 拒绝方案与讨论一致。

子 command 的 catalog 判据、DEV/生产同构代理配置入仓、测试禁直连 app 已在 working notes/action plan 落档，ADR frontmatter 已引用，可接受。

## 3. Findings

### N-1：start 不 seed 缺 Flyway 消歧

ADR §3.12 应明确：start/restart 启动 app 时正常应用未执行的 additive Flyway schema migration；禁止的只是隐式数据 seed/数据语料迁移。

不需 Dexter 裁决。

### N-2：reset allowlist 未显式包含开发资产

ADR/action plan 应明确：reset allowlist 同时覆盖开发数据库与 asset 开发存储路径/对象桶，并逐项记录执行前后 readback，避免“库清、文件留”的孤儿状态。

不需 Dexter 裁决。

### N-3：团队规模 trigger 缺具体阈值

ADR 要求 trigger 可判定，但“超过明确阈值”尚无数字。应由 Dexter 给出具体人数，并明确该事实只触发服务形态复审，不自动拆分。

需要 Dexter 裁决。

## 4. 八项评审问题结论

1. 单 deployable + 单库多 schema 与领域主权同时成立；
2. command/judgment/task read 三通道无重叠、无空隙；
3. task join、FK、全局 Flyway 未发现未识别的主权风险；
4. ExecutionContext 线性化正确，撤销语义诚实；
5. trigger 足够严格且零预建，唯 N-3 数字待落；
6. `x-consumer-faces` 是单声明多处执法，不构成第二授权真相；
7. 退役清单未见会令旧拓扑复活的遗漏；
8. 最低机器门集足以在首行业务代码前拒腐，前提是 future work 不冒充已强制。

## 5. Codex 自审 Notes 意见

- modular monolith 英文术语别名可补，无风险；
- Spring Boot 4.1 兼容 spike 留在 W1 而不写成永久栈裁决，处理正确；
- TDP 完全退出当前分母，与 manifest 一致。

