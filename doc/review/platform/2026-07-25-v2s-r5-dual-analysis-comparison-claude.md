---
title: R5 双盲分析对比与取优(Claude 侧)
type: review
status: DELIVERED_FOR_DEXTER_DECISION
compares:
  - doc/review/platform/2026-07-25-v2s-r5-scope-and-order-independent-analysis-claude.md
  - doc/review/platform/2026-07-25-v2s-r5-v2-implementation-state-and-dependency-analysis-codex.md
author: Claude
createdAt: 2026-07-25
---

# R5 双盲分析对比与取优

## 0. 总评

两份盲写在**所有结构性结论上互证一致**(三大批可行、批内依赖切片、旧拓扑全不搬、后端拓扑序同构、G-09/G-10 两大语料分歧同集)——双盲的价值兑现。互补面干净可合并;**真分歧只有一处需要 Dexter 裁决:评审节奏**(批内每波送审 vs R5 末尾一次统审)。

## 1. 事实仲裁(对比中发现的唯一事实级冲突,已当场核验)

Codex 将 operations 首页标 `PARTIAL_OR_CONFLICTING`,依据 `OperationsAdminSeed` 注释自称"every approved page registration remains PENDING_PAGE_MIGRATION"。**亲验裁定**:该注释是 v2 旧 R6 阶段的陈旧遗留;`router.tsx` 现有 12 处真实 lazy loader,业务页全部真实挂接,仅 5 个 `HOME-*` 渲染 Seed。→ 采 Claude 侧读法:**业务页=可搬运;5 个角色首页=需新做**(Codex 的"必须明确首页真实任务或无内容状态"的要求保留,与 Claude 的"走 Journey 裁决+看图"合并)。顺带登记:该陈旧注释属 v2 卫生问题,不搬。

## 2. 强一致清单(互证,直接定案)

1. **三大批(契约→后端→前端)可行,批内按依赖序切组/波;组不单独触发产品确认**;
2. **不搬清单同集**:MQ/outbox/投影/repair、Ed25519 proof、8 份 internal OpenAPI、gateway 本体、多库 Flyway history(重开单一 history)、Redis、退役物;
3. **后端拓扑序同构**:平台身份→空间+资产→商业集团/组织树(∥扩展定义)→运营 IAM 链→经营主体→门店→合同→overview task-read;合同必须在门店后、overview 最后;
4. **语料三大硬分歧同集**:G-10 `workspaceKey→groupWorkspaceKey` 全量改名(契约批一次完成)、G-09 货号 `{编码,名称}` 二元组重建、G-07 只认"邀请→接受→生效/撤销直接/变化=撤销+新邀请";
5. **C-02 处理一致**:operations 真实登录在 R3 被删除仅限 R3,R5 作为明确新范围实现(含首个运营账号经邀请链原子产生);
6. **v2 证据不作 v2s 验收基线**:无论标签叫什么,R5 每能力必须自产 fresh v2s 证据;
7. **R3 已迁移物 retain**:C-01 三 operation 登记 `RETAIN_AS_ALREADY_MIGRATED`,按契约批惯例对齐(分页/幂等/Problem),不重做。

## 3. 互补吸收(全部并入合并方案)

**采 Codex 独有**:①`ADMINISTRATION` assignment source 字段的消歧警示——不得成为 direct-add 兼容口,发现历史直加即删除;②G-02 细节:v2 `organization_node` 只存 REGION/PROJECT,集团由商业集团根单独表示——v2s schema 沿用此形;③"若 B 批证明某 operation 需校正,只能回写同一 R5 设计包并记录差异,禁止兼容双路径"的契约基线修订规则;④capability inventory 的"source-backed 才入分母"原则表述。

**采 Claude 独有**:①**分母 32**(D04-S12P/O 已实现未登记,Codex 未捕获);②**org↔workspace-iam 双向 MQ 环⇒二者不得分别关账**(补强 Codex 的"2 先于 3":组内可先 org 后 IAM 布线,但必须同组同验);③**前端补做清单五项**(5 首页、role L2、ops Drawer 幂等对齐、test:l2 入口、按 face 收窄 codegen);④**第三类生成物依赖**(admin-catalog/problem-semantics/presentation-catalog 归契约批);⑤契约裁决清单细化至 8 项(幂等信封/分页信封/Problem 形状/参数名/OpenAPI 版本/并发命名/排序参数/状态变更形态)+ 四件契约基建继承;⑥语料分歧的**行为层新增两项**(平台侧撤销任职入口、门店停用阻断门店任职登录)与**文案层风险**(v2 前端旧词"当前身份/查看范围"须逐页断言);⑦坑清单 K-01–K-10 与处置;⑧34 张投影表消失的量化收益。

## 4. 真分歧与裁决建议

### 分歧 A(唯一需 Dexter 裁决):评审节奏

- **Codex**:一个设计包+一个实施包+**R5 末尾一次**统一验证/对抗审查/Claude review;组只作执行控制。
- **Claude**:产品确认保持一次(范围+契约惯例),但**质量审查按批/波**:A 批一次、B 批四波各审、C 批四组各审。
- **裁决建议(Claude,理由如下)**:采**分波审查**。①B3(org+IAM 合并)单波即 ~10k 行主源码重构,末尾统审必然超出任何单次可核量——"半小时可核"是你亲定的效率红线;②末审意味着 B1 的坍缩模式错误要到全部写完才被抓,返工×后续所有波——J02/R4 两次事故的教训都是"审查太晚";③分波审查**不违背你的原意**——你否决的是"逐 Journey 反复产品确认",而波审是质量门不是授权门,不产生任何新的产品裁决;④与新盲审治理自然对齐(每波一个 IMPLEMENTATION cycle,输入清单可控)。若你仍选末审,建议至少 B3 单独加一道中间审。

### 分歧 B(方法论,无需裁决,已在合并中处理):实现态标签

Codex 拒用 `IMPLEMENTED_WORKING`(依据 coverage matrix 的 IN_REVIEW 等陈旧信号);Claude 按 MDB closure+traceability 判 working。**合并处理**:分母判定采 Claude 口径(32 场景,源码+closure 双锚定);验收态度采 Codex 口径(v2 任何证据不升级为 v2s 验收,只用于"搬什么"取舍)。两者本就作用于不同环节,无实质冲突。

## 5. 合并推荐方案(取优版骨架)

范围=**32 场景**(source-backed capability inventory 承载)+前端补做清单五项;顺序=三大批:
**A 契约批**(A0 八项惯例裁决→A1–A6 逐域切片(含 groupWorkspaceKey 全量改名、货号二元组、x-consumer-faces 闭集)→A7 四件基建+三生成物管线;基线修订规则按 Codex ③);
**B 后端批**(B0 骨架/坍缩模式定稿→B1 叶子(extension+platform-iam)→B2 workspace+asset→B3 org+workspace-iam(同组同验,组内 org 先 IAM 后)→B4 contract;每波 fresh Testcontainers+L3+verify);
**C 前端批**(C0 foundation+生成物+按 face 收窄 codegen→C1 双壳(含 401 登出与新词文案)→C2 页面按证据厚度三组+公开三页→C3 补做清单五项,其中 5 首页走 Journey 裁决+线框+看图);
横切:§9 语料分歧表(9 处)为每波盲审子 agent 必读输入;评审节奏按分歧 A 裁决执行。

## 6. 交 Dexter 的最终裁决点(收敛后仅 5 项)

1. **分歧 A:评审节奏**(建议分波审);
2. **A0 八项契约惯例**(多数建议采 v2 惯例,清单在 Claude 稿 §8;`groupWorkspaceKey` 已有语料裁决,仅需确认执行成本可接受);
3. **K-04 扩展宿主**:补齐 3 类 or 收窄闭集(牵动语料);
4. **32 分母**确认(含 D04-S12P/O);
5. **G-09 衍生状态(经营中/待开业/未经营)的用法**——可留待 C2 合同页设计时再裁。

裁决后即可授权 R5 全范围设计(设计包按合并方案编制,走既有管线:设计→盲审→Claude review→你接受→实施授权)。
