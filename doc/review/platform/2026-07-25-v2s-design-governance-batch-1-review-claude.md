---
title: v2s 设计法治第一批 Claude 独立评审
type: review
status: DELIVERED
reviewTarget: doc/decisions/2026-07-25-v2s-design-governance-batch-1.md
reviewer: Claude
createdAt: 2026-07-25
---

# v2s 设计法治第一批 Claude 独立评审

## 结论

```text
VERDICT=GO
M=0  S=0  N=1
```

第一批以最小方式封住了两个缺口:前提链三选一不留空、交互工件成为可审查落点且 Dexter 看图前置;机械/语义边界划得干净,J02 隔离诚实,未提前启动第二批。另按 Dexter 本轮新指令,附**第一批增补工作包(Batch 1.5)**四项,与本 GO 一并交 Dexter 接受后执行。

## 亲验记录

1. **管线一致性**:decision §3、`cs-spec-to-plan` 管线节、policy §9 三处顺序一致(Journey 裁决→交互工件→Dexter 看图→实现面设计→两轮自审→Claude);policy/skill 均只引用不复制正文。
2. **前提链设计**:模板三选一 + "EXTERNAL_PREREQUISITE 即 BLOCKED"+ 禁伪修复清单(默认账号/seed/测试替代/接口反推)——用 J02 事故反推检验:该模板下"operations 登录"会在"身份"行强制暴露无来源,缺口封住。反例检查:纯后台 unit 走 `notApplicableReason`,不被强迫画图,右尺寸。
3. **checker 机械边界与真红(scratchpad 拷贝行为级变异)**:fresh self-test PASS(7 类红含新增两类);变异一:废掉锚点唯一性判定 → self-test 真红(`ANCHOR_NOT_UNIQUE`);变异二:移除 UI-bearing 工件强制 → self-test 真红;两次还原后基线回绿。checker 确只判定 path 存在/anchor 唯一,不读语义。`standards-coverage --phase R3` fresh PASS(150)。
4. **checklist**:`JOURNEY_INTERACTION_REVIEW` 两条人审项(前提链对读、交互工件齐备+看图)文字完整;`requiredEvidence` 为字符串与其余五条 checklist 形制一致(评审中曾疑为类型错误,经核对撤回)。
5. **J02 隔离**:Roadmap `CURRENT_STATUS=PAUSED_FOR_DESIGN_GOVERNANCE / R3_DESIGN_STATUS=PENDING_RECOVERY` 与 decision §6 台账一致;五类资产的"不可使用主张"逐条明确;恢复必须从新 Journey 裁决开始,未见暗中恢复路径。
6. **范围克制**:未发现 R3–R6 inventory 提前启动;自审对三个替代方案的否决理由成立。

## Finding

### N-1:ui 模板 interaction map 表格列数不匹配(渲染破表)

`doc/decisions/templates/ui-interaction-design-template.md:24`——表头 8 列、分隔行 7 列,Markdown 渲染将错位。最小修复:分隔行补一列。不需 Dexter 裁决。

## 第一批增补工作包(Batch 1.5,Dexter 已口头授权方向,随本 GO 交接受)

以下四项为 Dexter 在本轮评审期间新增的指令,作为第一批的增补执行,交付纪律与第一批相同(冻结→Claude 复核→Dexter 接受),不授权任何实现:

**A. Heritage 台账增补 v2 前端 decisions(缺口 3 修复)**
把 all-v2 的前端专项 decision 原文按 path/hash 增补进 `doc/heritage/registry.json` selected assets(只读登记):`admin-component-selection-precedence`、`admin-consumer-chrome-rules`、`admin-drawer-form-lifecycle-and-feedback-standard`、`admin-frontend-implementation-standard`、`admin-frontend-runtime-architecture-must-not-follow-journey-ids`、`admin-page-catalog-navigation-and-access-owner-boundary`、`admin-routing-and-tab-query-state-must-follow-v4-style`、`platform-admin-menu-tabs-and-workspace-context`、`runtime-source-organization-must-not-follow-journey-ids`、`business-user-facing-language-standard`。目的:形成"manifest B.4/B.5 条文 → v2 原文"的出处链,疑义时可回原文对质。

**B. B.4/B.5 命中对照进交互工件(缺口 2 修复)**
ui-interaction-design-template 增加一节"manifest B.4/B.5 命中对照":列出本 Journey 命中的 B.4(前端架构与状态 20 条)/B.5(交互与信息架构)条目编号及遵循方式;`JOURNEY_INTERACTION_REVIEW` checklist 相应加一句。这是人审对照,不建 checker。

**C. 第三方 skill 收编(Dexter 已安装,待收编)**
按以下纪律把已安装 skill 接入管线:①vendor 进 `.agents/skills/` 并冻结 hash,禁止运行时拉外部版本;②每个包 cs- 前缀适配壳,开头声明"权威边界与输出格式以 AGENTS.md 与本仓模板为准,冲突时后者赢",剪掉任何 Git/自动推进指令;③阶段绑定:`brainstorming`(壳后)绑 Journey 裁决前的备选与反例生成,终点改为"产出 Journey 裁决模板草稿交 Dexter";`writing-plans`(壳后)绑 implementation-facing design,输出字段对齐 granularity manifest;`systematic-debugging` 留实现期;④交付物头部写回执行 `SKILL_USED=<name>@<hash>`,列入 checklist 人审项(不建 checker)。

**D. 高保真静态 demo 规则(模板 2 增补一节)**
线框之上按需增加高保真静态 demo,四条规矩:①**假数据溯源**:demo 中每个字段/术语/示例值必须对到 corpus 条目或已裁决 Journey,无来源元素必须带显眼"待裁决"水印,禁止编造合理字段填空;②**一次性工件**:纯静态 HTML(内联样式、零依赖、可 file:// 打开),放 `doc/plans/platform/mockups/<journey>/`,未来 app 代码对该目录零引用(R4 接线为机械检查),实现期照图重写不复制;③**默认线框、按需升级**:仅新交互范式屏与用户语言敏感屏做高保真,标准 CRUD 列表线框即可;④**视觉基线 = all-v2 前端壳的静态摹本**:模板壳摹自 v2 壳并注明 `摹自 all-v2 <path>@<hash>`,只提取视觉语言,不 import 运行时代码、不建构建依赖,v2 仓保持只读。看图字段相应扩为 `DEXTER_WIREFRAME_REVIEW` / `DEXTER_HIFI_REVIEW(按需)` 两级。

## 授权边界

本 GO 仅表示第一批治理包(连同上述增补工作包的执行授权请求)可交 Dexter 接受。不接受任何 R3–R6 Journey,不恢复 J02,不启动第二批 inventory,不授权 implementation、contract、migration、app、DEV、数据库、动态运行、seed/reset 或任何 Git 操作。Git 归 Dexter。
