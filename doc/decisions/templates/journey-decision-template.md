---
title: Journey 裁决模板
status: TEMPLATE_PROPOSED_FOR_CLAUDE_REVIEW
governanceRef: doc/decisions/2026-07-25-v2s-design-governance-batch-1.md
---

# Journey 裁决：<JOURNEY_ID> <名称>

> 使用时复制本模板为一份新的 `doc/decisions/<date>-<journey>.md`，不得直接在模板中
> 填业务答案。它是 decision 层工件，不是 implementation plan。

## 1. 裁决元数据

```text
JOURNEY_ID=<id>
STATUS=PROPOSED | DEXTER_ACCEPTED | DEXTER_REJECTED
SKILL_USED=NONE | cs-brainstorming@<frozen-vendor-sha256>
DECISION_OWNER=Dexter
UI_BEARING=true | false
CORPUS_VERSION=<confirmed corpus source/ref>
```

## 2. 用户任务与成功结果

- **Actor**：<业务叫法，不用技术 principal 代替>
- **此刻任务**：<该 actor 为什么在现在做此操作>
- **成功结果**：<对用户可观察、可由 owner readback 证明的结果>
- **失败后仍成立的事实**：<不应被部分写入或错误推导的事实>

## 3. 逐 actor 前提链

每个 actor、身份、任职/权限、入口数据和关键业务数据都必须逐项填写。来源类型只能三选一；
不得空白、不得写“默认存在”“测试账号”“以后处理”。

| 前提 | 对谁 | 需要什么事实 | 来源类型（三选一） | 产生/确认位置 | 来源证据（文件+锚点） | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | <actor> | <例如已存在的账号> | `IN_SCOPE_PRODUCED` / `ESTABLISHED_SOURCE` / `EXTERNAL_PREREQUISITE_DEXTER_DECISION` | <本 Journey 步骤 / 已裁决来源 / 待 Dexter 裁决> | <path#anchor> | <拒绝、引导、或保持未决> |
| 访问资格 | <actor> | <角色/任职/页面/能力等> | <三选一> | <...> | <...> | <...> |
| 入口数据 | <actor> | <稳定标识或用户看到的数据> | <三选一> | <...> | <...> | <...> |
| 业务数据 | <actor> | <任务需要的 owner 事实> | <三选一> | <...> | <...> | <...> |

若任一行是 `EXTERNAL_PREREQUISITE_DEXTER_DECISION`，本 Journey 的 implementation-facing
design 状态必须为 `BLOCKED_FOR_DEXTER_DECISION`，不得以 UI、seed 或 test fixture 替代。

## 4. 任务边界、非目标与禁推

- **范围内动作**：<明确的用户操作和 owner readback>
- **非目标**：<不做的相邻业务>
- **禁推**：<不得从哪些事实自动推导哪些事实>
- **禁止伪修复**：<默认账号、隐式创建、seed/测试替代、接口反推等>

## 5. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| <term> | <path#G-x> | <...> | <...> | 是 / 否 |

## 6. UI 适用性与后续工件

- `UI_BEARING=true`：必须创建交互工件，使用
  `doc/decisions/templates/ui-interaction-design-template.md`；Dexter 看图并确认前不得写
  implementation-facing design。
- `UI_BEARING=false`：说明为何没有 user-facing route/page/Drawer/public/login interaction，
  并列出该判断的来源：<...>。

## 7. Dexter 裁决

- 裁决：<接受 / 拒绝 / 需补充>
- 精确范围：<...>
- 已知前提：<...>
- 未决项：<...>
- 后续允许动作：<仅交互工件 / 可进 implementation-facing design / 其他>
