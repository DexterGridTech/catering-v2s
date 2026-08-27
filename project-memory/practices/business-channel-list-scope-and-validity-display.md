---
id: practices.business-channel-list-scope-and-validity-display
title: 经营渠道候选范围与合同有效性展示必须按事实类型分开
type: practice
status: active
layer: routed
taskKinds: ["design", "implementation", "review", "testing"]
domains: ["platform", "admin-ui", "contract"]
consumerFaces: ["platform-admin", "operations-admin"]
owners: ["platform", "frontend-platform", "product"]
impacts: ["architecture", "contract", "governance"]
triggers: ["implementation", "review", "failure"]
assertions: ["STORE_TEMPLATE_CANDIDATE_IS_EFFECTIVE_STORE_TEMPLATE", "TEMPLATE_STATUS_IS_A_DIMENSION_FACT_NOT_MATERIALIZED", "CONTRACT_VALIDITY_USES_SHARED_DOT_TEXT", "INTERNAL_CHANNEL_BINDING_STATUS_IS_NOT_REQUIRED"]
sourceRefs: ["doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md", "project-memory/practices/business-channel-list-scope-and-validity-display.md"]
---

# 经营渠道候选范围与合同有效性展示

## 1. 门店候选模板是受业务条件约束的投影

经营渠道模板由项目维护。门店经营渠道页的候选列表不是项目模板主列表的复制，而是项目 owner read 的业务候选投影，必须同时满足：

- 模板归属于当前门店的上级项目；
- `operatorKind = STORE`，即经营主体为门店；
- `status = ENABLED`，即模板有效。

因此门店候选表不再显示“状态”列：停用模板已经不属于候选集合，展示一个永远成立的状态会制造无意义信息。该规则只针对候选投影；项目模板主列表仍需展示模板状态，停用对象在主列表与详情中仍可读但不可编辑。

`store status` 不是模板候选准入条件。门店本身停用不应改变“上级项目维护的有效门店模板”这一候选事实；创建渠道时再由适用 owner 规则处理门店状态。

## 2. 模板失效会使既有渠道失效，但不删除历史事实

门店新建渠道的候选条件只决定“现在还能不能新建”。它不应通过隐藏或删除历史渠道来实现。项目停用一个已被渠道引用的模板时,渠道仍保留在项目/门店列表与详情中,以**各维度状态事实可读**的形式呈现。

⚠️ **2026-08-27 按 Dexter 裁定十八修订。** 修订前本条要求 owner「在同一停用事务内把引用渠道置为 `DISABLED` 并追加 `CASCADE_TEMPLATE`」,即**把级联物化落库** —— 该做法已推翻。落库的派生值无法反派生(全仓 `array_remove` 零命中),直接导致渠道停用后**永久启用不回来**。

**现行做法**:渠道只存自身状态;owner 读时把**每个相关维度的状态各自作为事实返回**(所引用模板、模板所属项目、渠道目标节点、external system 与 provider profile、collaboration binding),⛔ **不合并成单一"有效状态"值** —— 合并会丢掉"是哪一维不可用"这个前端唯一需要的信息。模板恢复启用则该维度事实自动变回可用,不需要任何清除路径。

原文里「不可编辑或恢复为草稿,直到级联原因被明确清除」一句作废:按适用矩阵,**管理编辑与重新启用只看自身状态**,不得因任何祖先维度不可用而阻断。

因此要区分两条读路径：候选查询只返回 `operatorKind=STORE AND status=ENABLED` 的项目模板；已有渠道查询不按模板有效性**过滤**(不隐藏历史渠道),而是读回渠道**自身状态**,以及**每个相关维度各自的状态事实**(所引用模板、模板所属项目、渠道目标节点、external system 与 provider profile、collaboration binding)。候选表不展示状态列，渠道列表/详情展示渠道自身状态,并能指名道姓说出是哪一维不可用。

防再犯最小反例是：有效 STORE 模板 → 门店渠道已生效 → 项目停用该模板 → 渠道仍可读,自身状态不变,**模板那一维的状态事实变为停用** → 新建候选不再包含该模板。

## 3. 合同有效性只表达 VALID/INVALID 合同事实

合同表格和合同详情对 `VALID/INVALID` 统一使用 foundation 的 `ValidityStatus`：蓝色状态点 + `有效`，灰色状态点 + `已失效`。不得在同一事实类型下混用 `生效中`、`已作废`、裸文本或局部 `valueEnum.status`。

本条不覆盖其他状态机：`ENABLED/DISABLED` 仍表达主数据启停，`ACTIVE` 仍表达邀请有效，经营渠道的 `DRAFT/EFFECTIVE` 仍表达渠道生效条件，门店合同 Tab 的“已作废”仍是历史查询分组名称。它们不能被机械替换成合同有效性文案。

## 4. 根因与最小防再犯解

根因是把“列表用途/候选准入”与“主数据状态列”混在一个 UI 表格里，以及各页面局部自行翻译同一个合同状态。最小解是由 owner 在候选查询中完成条件过滤、由 shared foundation 统一合同 `VALID/INVALID` 的点与文字呈现；页面只声明正确的列集和事实类型。

防再犯要求：

1. 需求/IA/详设在候选表中同时写清投影谓词与列集，并在级联规则中写清既有渠道的读回语义；
2. backend acceptance 覆盖 STORE、PROJECT、DISABLED 三种候选反例，以及“有效模板建渠道后再停用模板”的级联反例；
3. foundation focused test 覆盖 `VALID`、`INVALID`、缺失值；两后台合同表格/详情的 architecture scan 覆盖所有直接消费者；
4. review 必须区分候选投影、主列表、渠道级联状态、合同有效性与其他状态机，不能用字符串全仓替换代替语义核验。

## 5. 渠道绑定状态必须由 owner 按接入类型投影

`bindingRef = null` 不是“未绑定”的充分条件。内部渠道完全不涉及 collaboration binding，因此 owner readback 必须把内部无绑定投影为 `bindingStatus=NOT_REQUIRED`，列表和详情显示 `—`；外部渠道无绑定才投影为 `UNBOUND` 并显示“未绑定”，已有绑定投影为 `BOUND`。前端、排序和详情不得自行用 nullable `bindingRef` 推导这三种语义，也不能因为门店候选模板集合不包含失效模板而丢失既有渠道的 binding 语义。

最小反例是同一 bounded channel read 同时返回：内部 `bindingRef=null → NOT_REQUIRED/—`、外部 `bindingRef=null → UNBOUND/未绑定`、外部 `bindingRef!=null → BOUND/已绑定`；acceptance 必须断言这三个结果，浏览器必须回读内部行不出现“未绑定”。
