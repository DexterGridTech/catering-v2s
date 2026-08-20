# 外部协作与经营渠道 · 设计整改后第二轮复核

- 日期:2026-08-19 · 评审:Claude · 会话:续接(非 fresh,已声明)
- 前轮:`2026-08-19-...-design-review-claude.md`(NO-GO · M=1 · S=4 · N=5)
- 结论:**GO(设计内容)** · **M=0 · S=1 · N=1**
- ⚠️ 唯一的 S 是**流程件**(盲审 verdict 缺失),不是内容缺陷;
  它决定「能否申请实施授权」,由重跑或 Dexter 豁免解决。

---

## 0 · 前轮 findings 逐条关闭核验(全部现验源文,未采信整改自报)

| 前轮 | 整改核验 | 判定 |
|---|---|---|
| **M-1** 枚举整族漂移 | 六文档合并全文:旧字面量 `TAKEOUT`/`GROUP_BUYING`/`SELF_SERVICE` **全零**;规格字面量 `TAKEAWAY`(5)/`GROUP_BUY`(4)/`INVENTORY_SYNC`(1)/`TAKEAWAY_DELIVERY`(1)/`LOCAL_ONLY`(1)/`COMMERCIAL_GROUP`(5) 全在;裸 `GROUP` token **0**;详设第 115 行 bindableNodeTypes 已用 `COMMERCIAL_GROUP`,与 IA 的 subjectType 扩展统一 | ✅ 关闭 |
| **S-1** IA-P1 URL 违反 G-10 | IA 第 65 行现为 `/platform/external-collaboration;集团空间由 WorkspaceScope 会话上下文提供`;两文档 `group-workspaces/:groupWorkspaceKey` **零命中**(API 路径未被连带改动,正确) | ✅ 关闭 |
| **S-2** 场景放错 domain | 详设第 394 行与串行计划第 248–251 行均改为**新增** `CollaborationAcceptanceScenarios` 与 `BusinessChannelAcceptanceScenarios` 并在 `BackendAcceptanceScenarioCatalog` 登记;§7.2 旧落点(Organization/CommercialContract)**零残留**;「当前设计阶段不修改测试源码」边界正确 | ✅ 关闭(残一行见 N-1) |
| **S-3** seed 两缺陷 | 串行 CP-07 + 详设新增 §7.4 **两处同步**:本域 plan 目标 `external-collaboration-business-channel-seed-plan.mjs` 沿用 catalog-inventory 形态(revision/seedDatasets/ownerScopes/planDigest/`STATIC_PLAN_ONLY`);契约目录改为**只读输入引用**、明写「不放入 catalog-inventory-seed-plan.mjs、不经 seed 写契约态」;三族夹具补齐:五类节点(字面量 `COMMERCIAL_GROUP..STORE`)、万象城**一店三渠道三绑定(两条 `TAKEAWAY` 一条 `GROUP_BUY`)**、内部 `DINE_IN` 的 `POS/QR/KIOSK` 各一条 | ✅ 关闭 |
| **S-4** 盲审无 verdict | **未关闭**,见本轮 S-1 | ⚠️ 遗留 |
| N-1 十个/十一 | 「十一」×3,「十个 IA」残留 0;UI 工件 `### Screen` 实数 **11** | ✅ |
| N-2 命名理由 | 已登记:「与交互工件 Screen 恒等映射…待 Dexter 确认后如需纳入 IA0X 再迁」 | ✅ |
| N-3 Journey 自标已接受 | 两份均改 `DRAFT_PENDING_DEXTER_CONFIRMATION` / frontmatter `DRAFT_PENDING_DEXTER_WIREFRAME_REVIEW` | ✅ |
| N-4 无人调用的 API 方法 | **教科书级修复**:方法删除,且明写「级联置灰是**读取时派生的显示态**,不写入 binding,不提供该 command」—— 与规格派生置灰语义精确一致 | ✅ |
| N-5 死锚 | 两份 Journey 改指真实标题锚(`#screen-p1…`/`#screen-o1…`) | ✅ |

## 1 · 反向攻击:首轮已成立项有没有被整改改坏

- **BR 落点**:§8 实数 **34 行、全唯一**,BR-33 空号保持声明、不在表中 ✅
- **E-33**:`PLANNED` 触点合并全文 35 处,契约→owner→IA→场景→红夹具链路完整,无一处回退成门槛 ✅
- **六项 C**:C-01/02/03/04/08/09 全部保持依赖态(引用 9–15 处),未见固化 ✅
- **单一 consumer face / 双后台独立 / edge 双 command 同一 `REQUIRED` 事务**:§5.2/§5.4 未被触碰 ✅
- **退役机制**:`196`/`provider 壳`/`package exit` 仅出现于 FORBID/退出条件的**禁止语境** ✅
- 详设 CP 编号(CP-01~06)与串行计划(CP-00~09)是**两套编号**,首轮已存在、非本次引入,
  两文档各自内部一致,不再立 finding。

## S-1 · 设计期盲审仍无 verdict —— 申请实施授权前的唯一未清件

**事实**:两次派出 fresh 子 agent 均无返回;第二次**约四分钟**即受控关闭。
Codex 如实记 `UNVERIFIED_REQUIRES_EVIDENCE`(处置正确,未假装通过)。

**根因诊断(供第三次尝试用,依「同一失败第二次后必须先诊断」纪律)**:
**四分钟远不够。** 本批同规模的两轮盲审,真实耗时分别约 **15 分钟与 22 分钟**
(读完冻结输入 + 独立推导 + 逐项攻击的正常时长)。第二次 agent 大概率**不是失败,是被提前杀掉**。

**最小整改**:同一份输入清单(格式合格,hash 齐全,直接复用)重跑 Round 1,
**受控等待窗口 ≥ 30 分钟**;两次无效轮不消耗两轮上限。
**或** Dexter 在会话中明示豁免本批的作者侧盲审(其权限;AGENTS.md 的两轮上限约束的是
agent 自主轮次,Dexter 指令不受其约束)。
⛔ 在 verdict 或豁免之前,本批不满足其自订退出条件(串行计划 §12.3:
「通过独立设计 review **与** Claude review」),**不得**据本 GO 单独申请实施授权。

## N-1 · `collaboration.catalog-constraints` 的归属与形态残留

**事实**:详设第 398 行该场景仍落 `CatalogAcceptanceScenarios.java` —— 那是**商品目录**
domain group,而该场景验的是**外部平台契约目录**(collaboration 域),同名不同物。
且其本体是 contract publish validation(自述「无 HTTP 伪造 response」),
与 acceptance「真实 HTTP + business oracle」的能力形态不符;
规格 §10 本就把 BR-01/02/30 的验证方式定为**契约校验**,CP-01 的比例验证也已覆盖同一内容。

**最小整改(二选一)**:删除该场景,BR-01/02/30 由 CP-01 的契约校验独占;
或改造为真实 HTTP 场景(经树/详情 endpoint 读目录)并移入 `CollaborationAcceptanceScenarios`。
不需要 Dexter 裁决。

## 结论与授权边界

**设计内容:GO。** 前轮 1M+3S+5N 全部关闭且反向攻击未发现新伤;
模型、owner/事务、IA、E-33、六项 C、faces、双后台、foundation、退役红线在整改后依然成立。

**能否申请实施授权:还差一件** —— S-1 的盲审 verdict(重跑,窗口给足)或 Dexter 明示豁免;
外加 Dexter 对两份 Journey 与线框的确认(文档已如实标 PENDING)。

本轮为静态复核,未运行任何生产代码、契约生成、迁移、seed、reset、DEV、Testcontainers、
L2、UAT。GO 不构成 implementation authorization,不裁决六项 C,不授权任何 Git 动作。
