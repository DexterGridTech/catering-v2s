---
title: R3-C02 运营用户真实登录 Journey inventory 裁决
status: DEXTER_REJECTED
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: false
---

# Journey 裁决：R3-C02 运营用户真实进入运营管理后台

## 1. 裁决元数据

```text
JOURNEY_ID=R3-C02
STATUS=DEXTER_REJECTED
SKILL_USED=cs-brainstorming@4a54a4858b99807f3155ed1614b2f116e35ea5c1b788e793f565dd837fd3891f
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md#G-03,G-05,G-07,G-10
INVENTORY_DISPOSITION=REMOVED_FROM_R3_ACCEPTANCE
```

## 2. 用户任务与成功结果

- **Actor**：商场运营方或店铺运营方的运营用户。
- **此刻任务**：本来设想为该个人以合法账号和已生效任职进入运营管理后台，并抵达一个
  已批准的首个业务任务。
- **成功结果**：本候选若被接受，才可能是“真实用户登录后按其任职取得页面/权限”；它在
  R3 中不再是目标或验收结果。
- **失败后仍成立的事实**：operations-admin 仍必须作为独立 app 架构存在；其独立存在、
  route、session 壳或 API 200 不表示有运营用户真实登录。

## 3. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型（三选一） | 产生/确认位置 | 来源证据（文件+锚点） | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 运营用户 | 集团空间内可登录的个人账号 | `EXTERNAL_PREREQUISITE_DEXTER_DECISION` | R3 未批准首用户来源 | corpus #G-05；Dexter §7 删除 R3 验收主张 | 不创建登录页或伪造账号 |
| 访问资格 | 运营用户 | 已接受的任职，含角色归属节点、页面准入和动作能力 | `EXTERNAL_PREREQUISITE_DEXTER_DECISION` | 邀请/接受及角色来源不在 R3 | corpus #G-05、#G-07 | 不以 session 或 app 壳替代 |
| 入口数据 | 运营用户 | 合法的集团空间编码及获准的当前任职/可视数据节点 | `EXTERNAL_PREREQUISITE_DEXTER_DECISION` | 未有首个批准任务 | corpus #G-05、#G-10 | 不回退默认空间或由显示名反查 |
| 业务数据 | 运营用户 | 登录后要完成的首个获批准业务任务 | `EXTERNAL_PREREQUISITE_DEXTER_DECISION` | R3 未指定；R5-SCOPE 仍待 Dexter | Roadmap #R5；Dexter §7 | 不设计空首页、组织页或邀请流 |

## 4. 任务边界、非目标与禁推

- **范围内动作**：仅记录为何该候选不进入 R3；不设计或实现登录。
- **非目标**：首用户邀请、账号/角色/任职管理、组织树、门店、运营首页、匿名登录或测试
  凭证。
- **禁推**：集团空间、商业集团、独立 app、platform-admin 身份、session 响应和 URL 均不
  推导运营用户账号、任职或真实登录。
- **禁止伪修复**：seed/test/default 运营账号、默认任职、匿名 bootstrap、把
  `/current-session` 200、app 可构建/可部署或登录线框当作业务闭环。

## 5. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 三类用户 / 双后台 | `project-memory/decisions/confirmed-business-language-corpus.md#G-03` | 区分系统服务提供者与运营用户；双 app 不共享业务身份 | R3 仅保留架构独立性 | 否 |
| 运营用户、账号、任职、页面/数据范围 | 同文件 `#G-05` | 证明真实登录必须有合法业务前提 | 首用户来源与首任务未定义 | 是（未来范围） |
| 邀请制任职 | 同文件 `#G-07` | 禁止直接创建/编辑任职来演示登录 | 首次邀请发起条件未定义 | 是（未来范围） |
| 运营端 URL | 同文件 `#G-10` | URL 只定位空间，不授权 | `groupWorkspaceKey` 物化另批 | 否 |

## 6. UI 适用性与后续工件

`UI_BEARING=true` 但 `STATUS=DEXTER_REJECTED`：R3 不创建 operations-admin 登录、邀请或
业务页线框。未来若 Dexter 单独接受合法首用户来源和首个业务任务，必须从一张新的
Journey 裁决卡开始，再创建交互工件；不能复活本卡或旧 J02 资产。

## 7. Dexter 裁决

- **裁决**：以 `doc/decisions/2026-07-25-v2s-r3-r6-journey-inventory-acceptance-and-c01-interaction-authorization.md#2. Dexter 接受与产品裁决` 为稳定锚点。R3 不要求“运营用户真实登录”，明确从 R3 验收主张删除；只保留
  platform-admin 与 operations-admin 双 app 的架构独立性。
- **精确范围**：该拒绝只适用于 R3，不否定未来运营用户登录的业务需要。
- **已知前提**：R3 未产生账号、角色、任职或首个运营任务。
- **未决项**：未来首用户来源、邀请方、任职条件、首个业务任务与其 UI。
- **后续允许动作**：R3 技术底座可在未来获授权时证明双 app 架构；不得把本候选转化为
  登录 UI、session 机制、测试账号或实现范围。
