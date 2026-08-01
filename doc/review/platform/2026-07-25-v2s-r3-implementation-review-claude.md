---
title: R3 全范围 implementation Claude 统一 fresh review
type: review
status: DELIVERED
reviewTarget: R3 implementation (U01–U07) vs accepted whole-scope design
reviewer: Claude
createdAt: 2026-07-25
---

# R3 全范围 implementation Claude 统一 fresh review

## 结论

```text
VERDICT=NO-GO
M=3  S=0  N=1
```

不是因为 C-01 功能本身——三个 platform operation、owner/事务/契约分母、operations 静态边界、文案与红线在抽验中大多与设计一致;NO-GO 的原因是**设计法治被绕过**:已接受设计在全部评审轮之后被实质改写,三个投机性结构未经审查进入仓库,且设计自己规定的 Gate 0 不可变 checkpoint 从未发生。这恰是本轮治理体系要防的第一类事故。

## 关键事实(全部亲验)

1. **设计文本漂移**:我全范围评审时读到的 U02 是"在 `apps/backend/` 建 Java 21/Spring Boot 的**单 deployable 多模块** Gradle 结构",U04 路径为 `apps/backend/modules/{platform-workspace,organization}/…`(原文存于我的评审记录);当前设计行 143/180/182 已改为"并列的 `catering-business-server` 与 `terminal-data-server`(未来 TDP 的空占位)"加 `libraries/backend/` 共享模块。**round-2 对抗审查 JSON 中 `terminal-data-server` 与 `libraries/backend` 均零提及**;我的 N 项复核只核五处修订。即:该结构变更未经任何已声明的审查轮。
2. **Gate 0 checkpoint 缺失**:git log 仍只有 `331984e/5b08350` 两个 commit,165 个脏文件;`r3-gate-0-evidence.json` 只有 checks 八项 PASS,**无 checkpoint 字段**。设计 U01 明文:"Gate 0 PASS 后立即停止,由 Dexter 创建…immutable checkpoint",并把"用工作区 dirty state…替代 checkpoint"列为禁止伪修复。
3. **投机结构三处**:①`apps/backend/terminal-data-server/` 空占位(README 自述"未来 TDP";无 src)——ADR"初始不引入 TDP"+携带规则"禁空 capability 占位/不预建空目录";②owner 模块(`platform-access/platform-workspace/organization`)入 `libraries/backend/`——库准入要求**两个真实生产消费者**,现实只有 business-server 一个,空占位 app 的 README 被用作虚构第二消费者;③`libraries/frontend/admin-ui-foundation/`(automation/behavior/http/list/overlay 等)**零消费者**——两前端 app 源码无一处 import,违反 B.4#15/#17 与"禁预建 shared/*"。
4. **积极面(如实记录)**:OpenAPI 恰三 operation、face 干净;operations-admin 有 r3-boundary 架构测试(禁 fetch//api/login),无假登录;run manifest business/cleanup 分账 PASS;J02/C-02 未复活。

## Findings

### M-1:已接受设计在评审后被实质改写,GO 链对当前 bytes 不成立(需 Dexter 裁决)

影响:Roadmap 行 86 把并列结构写成既成事实,但无 decision ref、无重审记录;你接受的"经 Claude 全范围 review 的设计"与被实施的设计不是同一份。**最小修复**:①无论结构最终是否接受,先补一条 decision 记录该偏离的提出、理由与你的裁决;②今后设计任何 post-review 修改必须重新走定向审查(这已是管线规则,本次违反);③我方整改:评审交付物自此记录 reviewTarget SHA-256(我的失误:全范围评审未记设计哈希,复核未做全文 diff,已写入我的评审门)。

### M-2:三处投机结构违反 ADR 与携带规则(需 Dexter 裁决结构去留)

**最小修复(若不接受偏离)**:删除 `terminal-data-server` 占位;owner 模块迁回 `apps/backend/catering-business-server` 模块内(Gradle 子项目路径调整,代码本体不动);`admin-ui-foundation` 并回 platform-admin 或删除,待出现真实第二消费者再按准入上提。**若接受偏离**:补设计修订+定向对抗审查+我的 delta 复核,并为"未来 TDP 占位"立 decision 说明为何豁免"无 TDP/不预建"红线。两条路都不影响 C-01 业务代码本体。

### M-3:U01 的 Dexter 不可变 checkpoint 从未发生,U02–U07 证据失去顺序锚(需 Dexter 裁决补救)

"Gate 0 先于业务代码"现在只能靠自报,无对象级证明——这正是 checkpoint 要防的。**最小修复**:顺序已无法事后追认;现实补救是你裁决是否接受本次顺序偏离,并立即 commit 当前状态建立迟到基线;M-1/M-2 处置后的复验以该基线为锚。今后每单元完成即 commit 的纪律建议一并采纳("commit 后评审"协议的实施版)。

### N-1:run manifest 缺 `activeManagedResources` 字段

`.runtime/r3/20260725T074601Z-69293/run-manifest.json` 有 business/cleanup,无 active resources 计数;设计 §7 cleanup 层要求可证=0。补字段并在 runner 收尾断言。不需 Dexter。

## 复审条件

M-1/M-2 经你裁决并落 decision、M-3 建立基线 commit 后,我做一次**定向 delta 复审**(结构处置+受影响 evidence 重跑),不重开已抽验一致的 C-01 功能面。本 NO-GO 不撤销 C-01 已验证的业务语义,不恢复 J02/C-02,不触碰 operations 静态边界。

## 授权边界

本结论不授权任何修复实施之外的动作;结构裁决、decision、Git commit 均归 Dexter。

## 附录 2(最终):全部 M 撤销,结论修订为 GO(0 M / 0 S / 3 N)

经 Dexter 说明并经我穷举复核 `doc/decisions/` 全列表,三项 M 全部撤销,撤销依据均为**仓内已存在的 ACCEPTED decision**(我评审时 grep 模式不穷举导致假阴性,负全责):

- **M-1/M-2 撤销**:并列 backend 布局与 TDP 占位由 `2026-07-25-v2s-backend-app-layout-and-tdp-placeholder.md`(acceptedBy: Dexter)裁决——"物理 app 边界,非范围扩张;R3 只运行 business-server,占位无 runtime/endpoint/database/migration/wire/seed/业务源码";`admin-ui-foundation` 复制由 `2026-07-25-v2s-frontend-foundation-consumption-rule.md` 裁决——"R3 只完成物理复制,不接入、不冒充闭环;后续 UI 必须优先消费"。设计文本的相应修订与 `whole-scope-design-acceptance` decision 同批存在。我本轮实施评审已核实实现与这两份 decision 逐项一致(占位确无 src;foundation 确未接入且未计入 C-01 证据)——即结构 delta 的独立复核就此完成。
- **M-3 撤销**:依据 `2026-07-25-v2s-agent-coordination-and-control-boundary.md`(规范性原文:任何仓库控制动作不是任何工作的前置条件;两 AI 不得再提 git)。我以 checkpoint 缺失设 M 并要求 Dexter 动作,违反该规则,收回。
- **我的评审过错记录**:①负面结论("无 decision 登记")未穷举 decisions 目录;②未把现行 CLAUDE.md 条文(foundation 消费规则、控制边界)作为评审输入;③M-3 违反控制边界规则。三条已沉淀入我的评审门。

**最终 findings(3 N,均不阻断)**:
- N-1:run manifest 补 `activeManagedResources` 字段并在 runner 收尾断言=0;
- N-2:gate-0/code-layout 加一条机械守卫——断言 `terminal-data-server` 保持无 `src/`、无依赖边、无 generated wire,使占位 decision 的边界可被门持续证明;
- N-3:设计 U01 的"immutable checkpoint"条款与控制边界 decision 冲突,修订为**哈希清单式 checkpoint**(由 runner 把 validator/evidence 的内容哈希写入 immutable evidence JSON,不涉及任何仓库控制动作);Roadmap 行 86 顺带补上述两份结构 decision 的 ref。

```text
FINAL_VERDICT=GO
M=0  S=0  N=3
```

R3 实施在其被裁决的结构与边界内忠实于设计;C-01 功能面、operations 静态边界、契约分母、evidence 分账均已核验。三条 N 交 Codex 在既有边界内自主修复。

Dexter 已当面说明:并列 `catering-business-server`/`terminal-data-server` 占位与 `libraries/backend` 结构是**他在实施过程中主动指示 Codex 做的整改**(理由:根代码堆在单 backend 内,未来抽取成本高;先分结构是防返工的低成本保险)。据此:

- **M-1 定性修正**:不存在"未经授权的设计漂移";缺口收敛为**裁决未落盘**——补一条 decision 记录该结构裁决(原话+理由+日期)、Roadmap 行 86 加 ref 即闭。降级为记录性 S,随 decision 落盘关闭。
- **M-2 定性修正**:结构去留已由 owner 裁决,不再是 finding;我保留三条**建议性 N**(不阻断):①占位 app 加机械守卫(gate-0/code-layout 断言其无 src/无依赖边,防止将来悄悄长出代码);②`admin-ui-foundation` 当前零消费者——建议 platform-admin 实际接入或在 README 标注 `CANDIDATE_FOUNDATION` 状态,避免死代码假象;③在同一 decision 中写明 libraries 两消费者准入的豁免理由(未来抽取成本),防止该豁免被泛化引用。
- **M-3 维持**:Gate 0 checkpoint 缺失与 Dexter 本次说明无关,仍待 Dexter commit 建立迟到基线。
- **过程教训(双向)**:实施期的结构级口头裁决须当时落一行 decision(或同步评审侧),否则评审只能按未授权漂移上报——本次 NO-GO 的一半成因在此。

**修订后状态**:`NO-GO(1 M / 1 S / 4 N)`;M-3(commit 基线)+ S(裁决 decision 落盘)完成后,我做定向 delta 复审即可转 GO。
