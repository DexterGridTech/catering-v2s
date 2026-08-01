---
id: decisions.business-user-facing-language-standard
title: 业务用户界面必须使用可感知业务语言
type: decision
status: active
layer: routed
scope: all-v2 current and future business-facing UI
createdAt: 2026-07-15
taskKinds: [frontend-implementation, journey-design, ui-design, ui-review, ui-test]
domains: [admin-ui]
consumerFaces: [platform-admin, operations-admin]
owners: [frontend-platform, product]
impacts: [component, feedback, locator, navigation]
triggers: [admin-page, new-page, review, ui-change]
sourceRefs:
  - doc/platform/user-journey-first-design-standard.md
  - doc/platform/admin-consumer-chrome-standard.md
  - doc/review/platform/2026-07-15-four-domain-journey-design/d02-s02-organization-hierarchy.md
---

# 业务用户界面必须使用可感知业务语言

本规则适用于 all-v2 当前四域和未来所有新增业务。领域模型、contract 和源码可以使用稳定的内部抽象，但业务用户能够看到、听到或由辅助技术读到的界面必须使用其工作中可理解的业务词。

## 强制规则

1. 页面标题、菜单、Content Tab、字段标签、按钮、空态、确认文案、错误/恢复提示、可访问名称和 L2 可见断言不得直接暴露 `node`、`parentRef`、`aggregate`、`projection`、`owner`、`scope`、`principal` 等内部抽象。
2. 当内部概念能落到具体业务类型时必须具体表达，例如“集团 / 大区 / 项目”“所属集团 / 所属大区”“新建大区 / 新建项目”，不得使用“节点 / 父节点 / 子节点 / 新建下级”。
3. 无法预先确定具体类型时，使用用户任务语言，例如“所选组织”“当前身份”“可管理范围”“可查看门店”，而不是把领域类型名音译到界面。
   - operations-admin Shell 的已裁决例外是：必须使用 `four-domain-user-journey-actor-access-and-q01-q12-rulings.md#3.0` 的“当前运营角色 / 角色切换器 / 可视数据节点 / 数据节点切换器”；不得再用“当前身份”或“查看范围”代替。
4. 每个含领域抽象的 Journey 必须在 JG3 提供“内部概念 → 禁止文案 → 用户表达 → 使用位置”的业务语言矩阵。错误和恢复分支与 happy path 同样受矩阵约束。
5. Heritage 页面出现抽象词时必须标记 `REJECT` 或 `ADAPT`；“旧系统已经这样叫”不是保留理由。
6. 用户界面的菜单、Content Tab、页面标题、按钮、空态和错误提示禁止使用“诊断”。平台运维人员也以“集团空间总览”“组织与经营概览”“合同概览”或具体“情况”理解任务；`diagnostic` 只能作为内部 query/evidence/技术分类，不得渲染为界面文案。
7. 仅面向明确技术管理员的具体技术事实可以保留必要技术词，但必须在 Journey 中证明 actor 确实需要该字段完成排障；同一字段进入普通业务页面时仍要翻译。

## 实现与证据

- interaction spec 必须登记最终用户文案和业务语言矩阵；实现不得从 raw enum/type/error 自动生成用户文案。
- owner/edge 错误必须先映射为具体业务对象与恢复动作；内部 ID 和 raw Problem 只可进入受控技术详情，且该区域标题也不得使用“诊断”。
- L2 对批准矩阵做正向业务词断言，并对当前页面明确禁用的抽象词做负向可见文本断言；该负向检查只防文案回归，不能替代真实动作、能力、范围和 readback 证据。
- UI review 和 implementation review 必须同时检查页面、Drawer/Modal、空态、错误态和可访问名称。只修主页面标题不算关闭。

Dexter 对任一术语的纠正立即按 `project-memory/operations/dexter-feedback-systemic-impact-review.md` 扫描当前批准分母和共享页面模式；不得只修改被指出的一个线框。
