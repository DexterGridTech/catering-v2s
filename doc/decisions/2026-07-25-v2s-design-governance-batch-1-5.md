---
title: v2s 设计法治第一批增补：遗产出处、skill 适配与静态看图
status: DEXTER_ACCEPTED
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: false
---

# 设计法治第一批增补（Batch 1.5）

## 1. 目的与授权边界

本批随第一批的 Claude GO 后、Dexter 已授权的四项增补执行：修复模板 N-1、建立 B.4/B.5
可回溯出处、以本仓适配壳收编三项第三方 skill、以及规定按需高保真静态 demo。它仍只属于
设计法治；不批准任何 R3–R6 Journey，不恢复 J02，不进入 implementation-facing design，
不授权 contract、数据库、DEV、动态运行、seed/reset 或 Git。

Dexter 于 2026-07-25 接受本批；其接受只打开第二批 Journey inventory 与排序裁决，不解除
任何 implementation、contract、数据库、DEV、动态运行、seed/reset 或 Git 禁令。

## 2. N-1 最小修复

ui-interaction-design-template.md 的 interaction map 分隔行补为八列，与八列表头一致。
这只修复 Markdown 审阅呈现，不改变交互语义或新增 gate。

## 3. B.4/B.5 的 Heritage 出处链

doc/heritage/required-inventory.json 与 doc/heritage/registry.json 将 all-v2 的 selected
assets 分母由 13 扩为 23，并以 COPIED_FROZEN 登记下列十个原文。冻结副本置于
doc/heritage/frozen/catering-all-v2/project-memory/decisions/，每份均由 registry 的
sourcePath、targetPath、expectedSha256 和 byte equality 校验约束。

| all-v2 原文 | SHA-256 | 服务的 B.4/B.5 主题 |
| --- | --- | --- |
| admin-component-selection-precedence.md | deba6b02065b004f0b0e2bce4adeb5ffd5753a8bf0b0bfc267b63256668d9fe0 | 管理后台容器与组件选择 |
| admin-consumer-chrome-rules.md | 98bb944a029e41caa84b95517bf021c0e4809e1725c5ad532e84e685131ddd1f | 两后台 chrome |
| admin-drawer-form-lifecycle-and-feedback-standard.md | 0154be1d75078d6996d3a6edbaf3c1f6457a96e0760875296762dfea06bf435f | Drawer 生命周期与反馈 |
| admin-frontend-implementation-standard.md | 12afa79feb6369995e2744897bff8cbfe5cfbfdf7ff63985d8abea0b73c7c7dd | 前端实现与状态 |
| admin-frontend-runtime-architecture-must-not-follow-journey-ids.md | 7db367e97931fe2f1292e620e8364f667ed9663a5fbb1e09f6d48a03448f41c6 | runtime 组织边界 |
| admin-page-catalog-navigation-and-access-owner-boundary.md | 2604180320cbdc473e80da5b056867e05c1a8e720658df0dc1ca39b5d1ca983b | 页面目录、导航与 owner |
| admin-routing-and-tab-query-state-must-follow-v4-style.md | 4dfb2aa61d27944bf721a2dae1825dec8fb85e138ce612e0a5eb58f48aa93912 | 路由、Tab 与状态 owner |
| platform-admin-menu-tabs-and-workspace-context.md | fc5585aa0ce198614b0f5223edf88dd458eeef91796d6b3fc3732dec6d9d12af | platform-admin 菜单与上下文 |
| runtime-source-organization-must-not-follow-journey-ids.md | f88855cc3583026ad6edf7afb3e729c46705ea5f30fa7d635acd6784db9c236a | 源码组织不跟 Journey |
| business-user-facing-language-standard.md | 087b537d57c1839315f886bc9e3bb294ed10ed719b53b590e39cadfa9374b6bb | 业务用户可感知语言 |

交互模板 §7 要求每个 UI-bearing Journey 明确填命中的 B.4/B.5 条文、遵循方式和对应冻结
原文 path@hash；不适用必须解释。JOURNEY_INTERACTION_REVIEW 同步加入此项人审证据。
这是出处对照，不读取内容作语义 checker，也不让 all-v2 成为本仓 runtime/build/policy
fallback。

## 4. 第三方 skill 的冻结与适配

vendor 原文仅以非发现入口 VENDOR-SKILL.md 冻结在
.agents/skills/vendor/superpowers-6.2.0/；其 source/hash/adapter/阶段见同目录
manifest.json。禁止运行时拉取、禁止把 vendor 原文直接作为本仓执行规范。

| 冻结 vendor skill | cs-适配壳 | 阶段 | 明确终点 |
| --- | --- | --- | --- |
| brainstorming@4a54…3891f | cs-brainstorming | Journey 裁决前 | 带备选/反例的 Journey 裁决草稿，交 Dexter |
| writing-plans@7219…99d0 | cs-writing-plans | 已接受 Journey + 看图后，implementation-facing design 阶段 | 对齐 granularity manifest 的设计，不执行 |
| systematic-debugging@808f…787 | cs-systematic-debugging | 明确授权的 implementation / verification 期 | 可复现根因与最小验证，不扩大授权 |

每个适配壳都以本仓 AGENTS.md、Roadmap、project-memory 和本地模板为最高权威，显式移除
Git、worktree、自动推进、自动分派或自动实现指令。使用适配壳时，交付物头部必须写
SKILL_USED=<adapter>@<完整冻结 vendor SHA-256>；JOURNEY_INTERACTION_REVIEW 只要求
人审其阶段与输出是否匹配，不新建 checker。未收编 vendor 的通用入口不获得隐式授权。

## 5. 两级看图与静态 demo

交互模板继续以低保真线框为默认，加入 DEXTER_HIFI_REVIEW 和可选 demo 台账。高保真只在
新交互范式或用户语言敏感屏需要 Dexter 再看图时使用：字段/术语/示例值必须有 corpus 或
已裁决 Journey 来源；无来源元素显眼标为“待裁决”；工件只可为
doc/plans/platform/mockups/<JOURNEY_ID>/ 下零依赖、内联样式、file:// 可打开的静态
HTML；实现期按图重写，未来 app 代码零引用该目录。

视觉可静态摹写 all-v2 前端壳，但必须写明 摹自 all-v2 <path>@<sha256>，不得 import
任何旧仓运行时代码或引入构建依赖。R4 如出现 mockup 接线，才可按此明确、纯机械的
app code 零引用 mockups 目录规则建立对应检查；本批不提前建设它。

## 6. 冻结条件与后续

本批冻结条件：十份 source/target hash 与字节复制复算通过；registry 自测通过；模板
N-1、B.4/B.5 对照、二级看图和 checklist 人审语句存在；三项 vendor 原文 hash 与
cs-adapter 的阶段/头部回写一致；并完成本批第一轮 Codex 对抗式自审。

REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=DESIGN-GOVERNANCE-BATCH-1-5
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
