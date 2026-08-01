---
title: R5 操作历史 Journey 裁决
status: DEXTER_ACCEPTED_SCOPE_AND_INTERACTION
createdAt: 2026-07-26
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
scopeAuthority:
  - doc/review/platform/2026-07-26-v2s-problem-discovery-and-direction-claude.md#3-dexter-已下的裁决(全部生效,详设必须遵循)
implementationAuthority: false
---

# Journey 裁决：R5-AUDIT 操作历史

## 1. 裁决元数据

```text
JOURNEY_ID=R5-AUDIT
STATUS=DEXTER_ACCEPTED_SCOPE_AND_INTERACTION
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md@51415f7d3b024967b10d89414534deb16c1c09e5eced2883f3573d98891b4503
SCOPE_AUTHORITY=R-11,R-13,R-14
```

R-11 保留审计并新增“操作历史”用户能力；R-13 明确两个独立后台均显示；R-14 已接受
由该能力引起的 operation 分母扩张。本裁决只把该已接受范围落成可审查的用户任务，不增加
新的业务域或第二套授权。

## 2. 用户任务与成功结果

- **Actor**：系统服务提供者（运维管理员，使用运维管理后台）或商场运营方（使用运营管理后台）。
- **此刻任务**：在其已获准查看的实体详情中追溯该实体发生过什么变更、何时发生、由谁操作，
  以便解释当前状态，而不离开当前详情上下文。
- **成功结果**：点击“操作历史”后以弹窗（Modal，非 Drawer）读取该实体的分页历史；左侧列表以
  发生时间为主信息并可分页，点击任一项后右侧显示该项的人可读操作者、闭集动作、目标和以业务
  字段名呈现的变更前后值。无记录时明确显示空态，不以空 JSON 或伪造摘要替代。
- **失败后仍成立的事实**：历史读取不会改变实体、角色、会话或权限；无权查看实体者不会因
  该入口得知实体是否存在；写命令回滚时不得遗留审计行。

## 3. 逐 actor 前提链

| 前提 | 对谁 | 需要什么事实 | 来源类型 | 产生/确认位置 | 来源证据 | 未满足时的行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 已登录身份 | 两类 actor | 已启用且未失效的相应平台/运营会话 | `IN_SCOPE_PRODUCED` | R5 已接受 32 scenario 的 session 链 | `doc/decisions/2026-07-25-v2s-r5-whole-scope-journey-decision.md#3-共用-actor-与数据前提链` | 401，前端清理本地上下文并回登录入口 |
| 查看资格 | 两类 actor | 对宿主实体已有的页面准入、数据节点及 owner read 资格 | `IN_SCOPE_PRODUCED` | 相同实体详情 command/task-read 授权链 | `project-memory/decisions/confirmed-business-language-corpus.md#G-05-运营访问上下文` | 403/404 的既有 typed Problem；不另造审计权限 |
| 目标实体 | 两类 actor | 该详情已被 owner 确认可见，且 type/id 落在本 Journey 闭集 | `IN_SCOPE_PRODUCED` | 详情页 owner readback | 本文 §4 | typed NOT_FOUND/ACCESS_DENIED；前端保留原详情，不展示历史 |
| 审计事实 | 两类 actor | 与命令同一事务提交的 owner audit 行 | `IN_SCOPE_PRODUCED` | 各 owner command 内部 append | `doc/review/platform/2026-07-26-v2s-problem-discovery-and-direction-claude.md#56-审计与操作历史r-11新增用户功能` | 返回稳定空页；不得回退日志或猜测历史 |

## 4. 任务边界、非目标与禁推

### 4.1 范围内实体闭集

| audit entity type | 详情所在 face | owner | 说明 |
| --- | --- | --- | --- |
| `GROUP_WORKSPACE` | platform-admin | platform-workspace | 集团空间详情；platform-workspace 在宿主授权后经 organization 的窄 task API 合并同一 workspace/group key 的商业集团初始化事实，不把二者混为同一事实或做 edge 跨 schema 查询 |
| `PLATFORM_ADMIN` | platform-admin | platform-iam | 平台管理员治理详情 |
| `WORKSPACE_ROLE` | platform-admin | workspace-iam | 运营角色详情 |
| `WORKSPACE_ACCOUNT` | platform-admin, operations-admin | workspace-iam | 平台账号详情与运营端角色/节点范围内账号详情；operations face 只按已解析角色/服务节点 scope 读取 |
| `WORKSPACE_INVITATION` | platform-admin、operations-admin | workspace-iam | 邀请详情；永不显示 raw token、OTP 或凭据 |
| `EXTENSION_DEFINITION` | platform-admin | extension | 五宿主定义的一行 JSONB 版本变更 |
| `ORGANIZATION_NODE` | operations-admin | organization | 大区、项目；商业集团不是组织树节点 |
| `BRAND` | operations-admin | organization | 品牌 |
| `TENANT` | operations-admin | organization | 实际经营租户 |
| `HEAD_COMPANY` | operations-admin | organization | 总公司及品牌授权变更 |
| `STORE` | operations-admin | organization | 门店及启停 |
| `STORE_CONTRACT` | operations-admin、platform-admin | contract | 轻合同及货号二元组变更 |

闭集为 12 类；它对应现有 R5 详情 surface，不把资产、导入导出、报表、临时处理物、登录尝试、
原始 credential、OTP 或 session 当作可浏览实体历史。

### 4.2 非目标与禁推

- 不是通用日志浏览器、审计导出、跨实体搜索、报表或保留期策略；这些均不在 R5。
- 不从“能读历史”推导额外页面、动作能力或数据节点。权限严格继承宿主详情。
- 不从审计记录推导幂等重放；`*_command_receipt` 仍是幂等唯一事实。
- 不以 `detail_json` 裸展示、数据库列名、UUID、密码哈希、OTP、token、手机号明文或
  request body 替代人可读变更内容。
- 审计 actor 不是一次实时 identity 查询：会话解析阶段仅在 IAM owner 内构造
  `AuditActor{actorType,actorId,displaySnapshot}`，每条 owner-local audit 在 command 同一事务内写入最小
  `actor_display_snapshot`。读取先完成宿主实体授权，再按 face 投影：operations-admin 对平台管理员
  只见“平台管理员”，同一集团空间的运营账号可见其历史显示名，系统 actor 为“系统”；账号停用或
  不再可解析时仍只显示历史快照。不得返回手机号、登录名、账号 id 或因审计新增身份读取权限。
- 不以 seed、测试 fixture、默认管理员或直接写 audit 表伪造用户链路。

## 5. Corpus 命中与冲突

| 术语/关系 | 现行 corpus 来源 | 本 Journey 如何使用 | 冲突/未知 | Dexter 裁决是否必要 |
| --- | --- | --- | --- | --- |
| 运维管理后台 / 运营管理后台 | `...confirmed-business-language-corpus.md#G-03`、`#G-10` | 术语固定为 platform-admin / operations-admin 两个独立 app | 无；R-12 已持久化术语 | 否 |
| 运营访问上下文 | `...#G-05` | 审计不新增权限，继承实体 read scope | 无 | 否 |
| 商业集团与组织树 | `...#G-01`、`#G-02` | 集团空间记录与组织节点记录不混同；GROUP 不作为组织节点 history type | 无 | 否 |
| 品牌、租户、总公司、门店 | `...#G-03`、`#G-04`、`#G-06` | 变更显示使用业务主叫法，不用“商户”混称 | 无 | 否 |
| 合同和货号二元组 | `...#G-09` | 合同 audit 显示 `{编码,名称}` 的差异；不把衍生状态写回 | 无 | 否 |

## 6. UI 适用性与后续工件

`UI_BEARING=true`。对应交互工件为
`doc/decisions/2026-07-26-v2s-r5-operation-history-interaction-design.md`。其低保真 Modal 已于
2026-07-26 由 Dexter 看图接受，故可把本 Journey 的 contract、后端、前端单元写入最终
implementation-facing design；本文件本身不授权任何实施。

## 7. Dexter 已有裁决与本件状态

- 已接受范围：R-11（保留审计并新增操作历史）、R-13（两个 App）、R-14（operation 分母变更）。
- 精确 operation 取舍：Dexter 于 2026-07-26 裁决采用两个 scalar-face operation：
  `getPlatformEntityAuditHistory` 与 `getOperationsEntityAuditHistory`，基线 104 + 2 = **106**，
  face closure 为 platform-admin 39、operations-admin 56、public 11。二者共用相同 owner task read 和
  同一个 app-local Modal；不按 12 个实体复制 12 个 operation，也不改变既有 104 operation。
- 当前待办：将已接受交互纳入修订详设、granularity manifest、独立盲审和 Claude review；完成这些
  设计管线前，本 Journey 的详细实施单元仍不授权实施。
