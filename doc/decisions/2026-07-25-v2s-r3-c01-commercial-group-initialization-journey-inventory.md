---
title: R3-C01 商业集团显式初始化 Journey inventory 卡片
status: DEXTER_ACCEPTED
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: false
---

# Journey 裁决：R3-C01 为既有集团空间显式初始化商业集团

## 1. 裁决元数据

```text
JOURNEY_ID=R3-C01
STATUS=DEXTER_ACCEPTED
SKILL_USED=cs-brainstorming@4a54a4858b99807f3155ed1614b2f116e35ea5c1b788e793f565dd837fd3891f
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md#G-01,G-03
INVENTORY_DISPOSITION=DEXTER_ACCEPTED_FOR_INTERACTION_DESIGN
```

## 2. 用户任务与成功结果

- **Actor**：系统服务提供者（运维管理员）。
- **此刻任务**：对一个部署期外部受控、已存在且尚未初始化商业集团的集团空间，独立录入
  商业集团名称和编码，建立该空间唯一的商业集团根。
- **成功结果**：该集团空间读回恰有一个商业集团，且读回的名称、编码就是本次独立录入值；
  后续实现必须以 owner readback 证明这一结果。
- **失败后仍成立的事实**：集团空间可继续为空；不会部分创建商业集团，不会复制或回写空间
  名称/编码，也不会创建组织树、账号、角色、任职、门店或任何 operations-admin 登录事实。

## 3. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型（三选一） | 产生/确认位置 | 来源证据（文件+锚点） | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份 | 系统服务提供者 | 可用于 platform-admin 的受控身份 | `ESTABLISHED_SOURCE` | 部署期外部受控前提；不由 R3 业务 Journey 产生 | `doc/decisions/2026-07-25-v2s-r3-r6-journey-inventory-acceptance-and-c01-interaction-authorization.md#2. Dexter 接受与产品裁决`；corpus #G-03 | 不开始该业务操作；不得创建默认/测试账号 |
| 访问资格 | 系统服务提供者 | 可执行集团空间控制面的访问资格 | `ESTABLISHED_SOURCE` | 与部署期受控平台身份一并配置；具体授权实现留后续设计 | acceptance decision #2 | 拒绝访问；前端页面不可代替 owner 判定 |
| 入口数据 | 系统服务提供者 | 一个已存在、可被选择、尚未初始化商业集团的集团空间 | `ESTABLISHED_SOURCE` | 部署期外部受控事实；不由 seed、默认空间或本 Journey 隐式创建 | acceptance decision #2；corpus #G-01 | 没有符合条件空间时任务不可用；不得回退到显示名或默认空间 |
| 业务数据 | 系统服务提供者 | 本次独立输入的商业集团名称、编码 | `IN_SCOPE_PRODUCED` | 本 Journey 的明确用户输入 | corpus #G-01 | 校验失败或冲突时不创建；成功值不得借用空间字段 |

上述前提均已由 Dexter 选择为“部署期外部受控事实”。这不等于当前仓已有登录、空间、
session、contract 或运行时实现；其精确 provisioning/credential 生命周期仍不在本批范围。

## 4. 任务边界、非目标与禁推

- **范围内动作**：系统服务提供者选定已有合格集团空间，输入商业集团名称和编码，提交后
  读回唯一商业集团结果。
- **非目标**：创建集团空间、维护平台管理员、组织树、运营账号/角色/任职、门店、合同，
  或 operations-admin 业务页面。
- **禁推**：空间存在不推导商业集团存在；商业集团初始化不推导组织树、账号、角色、任职、
  门店或运营端可登录者；URL/空间编码不构成授权。
- **禁止伪修复**：默认 root 或默认集团空间、DEV seed/test fixture、匿名 session、由显示名
  查找空间、从旧 J02 manifest/handoff 继承 UI/contract/implementation 结论。

## 5. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 集团空间 / 商业集团 | `project-memory/decisions/confirmed-business-language-corpus.md#G-01` | 空空间合法；显式初始化；名称/编码独立；每空间至多一个 | 解绑、替换、重建未定义，不进入本 Journey | 否（本范围） |
| 系统服务提供者 / 运维管理后台 | 同文件 `#G-03` | Actor 使用 platform-admin，不混入运营用户 | 身份与空间来源已裁为部署期外部受控；技术生命周期未设计 | 否（本 inventory） |
| 双后台与 URL | 同文件 `#G-10` | 不把 operations URL、groupWorkspaceKey 或显示名当作权限或 C-01 的业务结果 | 后续 contract 物化另批 | 否 |
| 平台内置 root 先例 | `../catering-all-v1/doc/review/domain/01-platform-isolation/2026-07-03-platform-operator-iam-v4-anchor-and-scope.md#root 自举`；`../catering-all-v2/apps/backend/platform-iam-service/src/main/resources/db/migration/V4__platform_admin_built_in.sql` | 只解释 Dexter 选择部署期外部受控前提的可行性 | Heritage 非 v2s 当前真相，禁止复制为实现 | 否 |

## 6. UI 适用性与后续工件

`UI_BEARING=true`：Dexter 已在 acceptance decision #2 授权本 Journey 进入交互设计。交互
工件必须由 Dexter 看线框；该授权只允许 interaction map、低保真线框、状态/边界与任务合理性
审查，不允许 implementation-facing design、contract、DB、app 或 runtime。平台认证字段/方式
尚未获产品/contract 裁决，不得在本 Journey 擅自画成账号密码登录页。

当前交互工件为
`doc/decisions/2026-07-25-v2s-r3-c01-commercial-group-initialization-interaction.md`；其
`DEXTER_WIREFRAME_REVIEW=ACCEPTED`。Dexter 随后明确要求一次性形成整个 R3 的 implementation-facing
详设与实施计划；该工件是其中 UI-bearing C-01 delivery units 的输入，但不自授实现权限。

## 7. Dexter 裁决

- **裁决**：以 acceptance decision #2 为准；C-01 已接受为首个进入交互设计的 Journey。
- **精确范围**：只解决 C-01 的前提来源；不建立平台管理员治理或集团空间创建 Journey。
- **已知前提**：四项前提链均已填；系统服务提供者与目标集团空间都不是 C-01 隐式产物。
- **未决项**：后续 owner/contract/credential/provisioning 设计；集团空间创建的独立业务 Journey。
- **后续允许动作**：在本 Journey 不变的前提下，一次性形成整个 R3 的 implementation-facing
  详设与实施计划（含 R3-TECH、契约、脚本、后端、数据库、双 app、测试与证据）；仍不授权
  implementation、代码搬运、contract/数据库/app 写入、DEV、runtime、seed/reset 或 Git。
