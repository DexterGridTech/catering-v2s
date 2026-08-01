---
title: R3-C01 carry-over-first 交互回补 Codex 对抗自审
status: SELF_REVIEW_ROUND_1
reviewTarget: doc/decisions/2026-07-25-v2s-frontend-asset-carry-over-first.md;doc/decisions/2026-07-25-v2s-r3-c01-commercial-group-initialization-interaction.md
createdAt: 2026-07-25
---

# R3-C01 carry-over-first 交互回补 Codex 对抗自审

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=R3-C01-CARRYOVER-FIRST-INTERACTION
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
RESET_TRIGGER=Dexter materially changed the approved C-01 interaction objective: every screen must first use a v2 counterpart inventory and static Heritage baseline.
PRIOR_CYCLE=R3-C01-INTERACTION-DESIGN / ROUND_1
```

## 用户任务

业务用户仍是获得部署期平台访问资格的系统服务提供者：在既有、未初始化的集团空间中核对目标，
独立录入商业集团名称和编码，并看到唯一事实的 owner readback。本轮新增的用户价值是：Dexter
审看线框时应看见成熟 v2 页面承载这个任务的真实信息层级，而不是被一张脱离现有资产的抽象
框图迫使重新判断导航、抽屉、列表和反馈形态。

## Dexter 立场

Dexter 明确要求 carry-over-first：对应页优先静态摹本/截图、只标差异；未来实现才显式搬运，
generated wire 按新 edge OpenAPI 重生成。Dexter 同时暂停 C-01 看图并未授权任何实现。因此，
本轮不能把“摹自”偷换成复制代码、将 all-v2 的 endpoint/账号/operations 登录带入 C-01，或
把未纳入 frozen registry 的页面源当作可以直接 import 的依赖。

## 替代方案

1. **保留原来的抽象线框。** 成本最低，却让 Dexter 看不到与 v2 已有页的关系，无法识别无谓
   重写；不选。
2. **立即复制 all-v2 页面到 v2s。** 视觉最接近，但越过 implementation 授权，也会把旧 wire、
   owner 与范围假设悄悄带入；不选。
3. **只贴代码路径/hash。** 可追溯但不满足“看图”，且不能证明信息层级是否真正沿用；不选。
4. **逐屏 counterpart inventory + 静态低保真摹本 + 逐项差异原因。** 以最小文档变动保留真实
   页面结构，并把新业务裁决清楚叠在上面；推荐。

## 方案合理性

| 发起的攻击 | 复核事实、反例与适用边界 | 结论 |
| --- | --- | --- |
| v2 是否真的已有 C-01 对应页？ | 重开 `WorkspaceManagementPage.tsx`、`WorkspaceDetailDrawer.tsx`、`CommercialGroupInitializationDrawer.tsx`；它们已有列表、详情 Drawer、未初始化条件下的初始化按钮和独立编码/名称表单。反例是只存在同名目录却无该用户任务；这里不成立 | `CONFIRMED`：四个 C-01 screen 都有 `EXACT_COUNTERPART` |
| 是否应照搬 v2 全部操作？ | v2 同屏还有新建集团空间、编辑、启停、运营后台入口。C-01 只批准既有空间初始化；反例是页面存在即等于新范围获批 | `CONFIRMED`：这些仅作为静态基线标注，非 C-01 操作 |
| 详情 Drawer→初始化 Drawer 是否只是历史惯性？ | v2 的详情先关闭再开初始化 Drawer；C-01 需要在不可解绑/替换的初始化前核对目标空间。反例是列表行直接初始化，信息更少且选错成本更高 | `CONFIRMED`：沿用是任务合理性，而非盲从 |
| “只读目标空间”与可见 readback 是否算过度设计？ | v2 表单缺少显示目标空间，且成功主要反馈为泛化 modal。C-01 需要证明独立字段、唯一结果，目标上下文/readback 使用户能核验，不引入新实体或流程 | `PARTIALLY_CONFIRMED`：两项是小型质量修复；具体 owner/contract 仍不设计 |
| 未注册的 source hash 能否当 implementation 资产？ | Heritage registry 当前 selected-assets 未含这三个 frontend source。反例是以 path@hash 绕过 frozen/registry 纪律 | `CONFIRMED`：仅标 `PENDING_HERITAGE_REGISTRATION` 作静态审看来源；未来实现前必须完成 registry/frozen 处置或 Dexter 明确拒绝搬运 |

该方案的收益是让成熟页面资产成为可审查的默认基线；代价是一个新 decision、模板一节和四项
screen 映射。与复制组件、提前冻结大批前端源或制作高保真 app 原型相比，成本更小且不扩大
授权。

## UI 与交互

`APPLICABLE`：列表→详情 Drawer→初始化 Drawer→已初始化详情的路径来自 C-01 已接受 Journey。
每个 screen 现在有 all-v2 静态基线、明确 path@hash 与差异原因。新界面不让“新建空间、编辑、
启停、运营后台入口”因基线存在变成 C-01 可操作项；认证页仍不画，原因是 actor 身份是部署期
外部受控前提，不是已裁决的登录方式。

差异来源已经分别归因：G-01 的空空间合法/字段独立/禁止下游推导是新裁决；C-01 排除其他
workspace 管理操作是新范围；readback 可见是质量修复；endpoint、idempotency、反馈组件与
implementation path 未裁决不得继承。没有由接口、旧文件或组件方便性反推新的用户动作。

## 审查意见复核

- **Dexter carry-over-first 指令=DEXTER_DECISION。** 重开用户原话与 v2 现有三份 source；它要求
  保留已有资产，而非推翻 G-01。适用边界是“获批 UI-bearing Journey”，不自动扩到未获批 R5
  功能；更小处理是更新 interaction template，而不是新建全局语义 checker。
- **“v2 页面存在就全部搬”的潜在 finding=REJECTED_WITH_EVIDENCE。** C-01 卡片 §4 明确排除
  空间创建、账号、运营端页面等。以仅标注、非操作的静态基线处理，比把它们复制进线框或人为
  删除成熟页面结构更小。
- **“先冻结/复制三个源码文件再看图”的潜在 finding=UNVERIFIED_REQUIRES_EVIDENCE。** 当前没有
  implementation 授权，也没有针对这批 frontend source 的 registry/frozen 接受决定。保留
  `PENDING_HERITAGE_REGISTRATION` 是诚实边界；不能以本 review 猜测 registry 处置。

每条意见均通过 owning C-01、all-v2 source 与 Heritage registry 复核，比较反例、适用边界和
更小方案；没有把 Dexter 指令或旧页面全盘当作产品语义。

## 闭环核验

- 新 decision 定义设计期盘点、静态基线、差异归因与实现期 manifest 搬运清单，并显式排除
  generated wire、runtime/build fallback 与实施授权；
- interaction template 已强制该盘点；C-01 四屏均有 `EXACT_COUNTERPART`、path@hash、静态摹本
  和差异原因；
- C-01 继续维持 `DEXTER_WIREFRAME_REVIEW=UNSET`，不要求高保真 demo；
- 本轮未创建/复制 app code、shell、foundation、generated wire、contract、DB、DEV 或 Git 产物；
- 新 cycle 的触发事实是 Dexter 实质改变已批准交互目标；本 cycle 仍只有 round 1，后续最多一轮。

## 结论

```text
VERDICT=GO
SCOPE=GO_FOR_DEXTER_REVIEW_OF_CARRY_OVER_FIRST_C01_LOW_FIDELITY_WIREFRAMES_ONLY
M=0
S=0
N=1 (C-01 frontend sources remain PENDING_HERITAGE_REGISTRATION; this blocks future implementation carry, not static visual review)
NEXT=Dexter 重新审看 C-01 四张带 v2 静态基线与差异标注的低保真线框；未 ACCEPTED 前不进入 implementation-facing design。
```
