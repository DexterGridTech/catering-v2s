---
title: R5 全范围 Journey 裁决
status: DEXTER_ACCEPTED
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
scopeDecisionRef: doc/decisions/2026-07-25-v2s-r5-scope-and-method-decisions.md
designAuthorizationRef: doc/decisions/2026-07-25-v2s-r5-whole-scope-design-authorization.md
implementationAuthority: false
---

# R5 全范围 Journey 裁决

## 1. 裁决元数据

```text
JOURNEY_ID=R5-J01
STATUS=DEXTER_ACCEPTED
SKILL_USED=cs-spec-to-plan@local
DECISION_OWNER=Dexter
UI_BEARING=true
CORPUS_VERSION=project-memory/decisions/confirmed-business-language-corpus.md@51415f7d3b024967b10d89414534deb16c1c09e5eced2883f3573d98891b4503
SCENARIO_DENOMINATOR=32
IMPLEMENTATION_AUTHORITY=false
```

`R5-J01` 是 R5 原子交付的 umbrella Journey decision；下表 32 个稳定 scenario ID 仍各自
保有 actor、任务、成功结果、前提和 evidence 分母。采用一份 decision 不合并用户任务，
也不允许在实施或验收时用 umbrella ID 替代逐项 evidence。

编号空洞保持 heritage 稳定语义，不得压号复用：`D02-S05` 已合并进 `D04-S09` 的同一
context-switch 用户任务；`D03-S05` 已降为非用户交接锚点 `D03-H01`；`D04-S07` 是并入
`D04-S06` 的本人 credential readiness 历史别名。R5 的 32 分母来自已实现 source-backed
场景及 P/O 独立 face/actor 变体，不靠复用这三个退役 ID 凑数。

R3 的 `J02/C-02` 历史资产仍不恢复。R5 对应的正向产品任务由本文件 `D04-S08` 重新建立：
已启用运营账号在带 `groupWorkspaceKey` 的登录页获得 workspace-IAM owner session，并按
单/多/无角色进入明确结果；其输入是 R5 新 Journey、交互、104-operation catalog 与 fresh
evidence，不引用 R3 `PENDING_RECOVERY` 资产。

## 2. 用户任务与成功结果

- **业务用户**：系统服务提供者、商场运营方、店铺运营方及被邀请运营用户。
- **此刻任务**：在两个独立后台中完成 all-v2 已 source-backed 的平台治理、空间与组织、
  IAM、经营主体、门店、轻合同、扩展字段和本人凭据任务。
- **成功结果**：32 项逐项由 owning module readback 证明；两个后台只能看到各自
  `x-consumer-faces` operation；R5 完成后 Dexter 可在完整 DEV 中从登录、邀请、治理、业务
  操作到 owner readback 走完全部任务。
- **业务日边界**：依据
  `doc/decisions/2026-07-26-v2s-r5-claude-review-five-point-resolution.md#D-07：业务日历时区`
  固定使用 `Asia/Shanghai`；合同生效日、失效日与衍生经营状态均不得使用会话机器默认时区。
- **失败后仍成立的事实**：owner 事务不得部分写入；页面隐藏不代替授权；空间、商业集团、
  角色、页面准入、动作能力、数据范围、品牌授权、门店状态与合同衍生状态不得互相错误推导。

## 3. 共用 actor 与数据前提链

| 前提 | 对谁 | 需要的事实 | 来源类型 | 产生/确认位置 | 来源证据 | 未满足时行为 |
| --- | --- | --- | --- | --- | --- | --- |
| 平台身份 | 系统服务提供者 | 已存在且已启用的平台管理员身份 | `ESTABLISHED_SOURCE` | 部署期外部受控前提；R5 只实现登录/session 与后续管理员治理 | `doc/decisions/2026-07-25-v2s-r3-c01-commercial-group-initialization-interaction.md#2. 用户任务与前提` | 拒绝登录；不得创建默认/root 账号 |
| 集团空间 | 平台及运营任务 | 稳定 `groupWorkspaceKey`、状态与展示信息 | `IN_SCOPE_PRODUCED` | D01-S02；已有空间可作为 owner fact | 本文件 `#scenario-d01-s02` | owner 404/typed problem，不回退默认空间 |
| 商业集团 | 组织/IAM/经营任务 | 与空间分离的唯一商业集团根 | `IN_SCOPE_PRODUCED` | R3 C-01 retain；D01-S05/D02-S01 不重复实现 | 本文件 `#scenario-d01-s05-d02-s01` | 不自动建立组织、账号、角色或门店 |
| 组织与角色 | 运营用户 | 三层组织、角色、页面准入、动作能力 | `IN_SCOPE_PRODUCED` | D02-S02、D04-S01/S02 | 本文件 `#scenario-d02-s02`、`#scenario-d04-s01-s02` | owner 拒绝邀请/页面/动作，不由 UI 猜测 |
| 首个运营账号 | 商场/店铺运营方 | 邀请、本人验证、账号 readiness 与任职同事务生效 | `IN_SCOPE_PRODUCED` | D04-S05P→D04-S06 | 本文件 `#scenario-d04-s05p-s06` | 无默认运营账号；邀请未完成不赋权 |
| 运营会话上下文 | 商场/店铺运营方 | 当前运营角色、可视数据节点、版本 | `IN_SCOPE_PRODUCED` | D04-S08/S09 | 本文件 `#scenario-d04-s08-s09` | typed stale/denied，清投影后重读 |
| 经营与合同事实 | 相关业务用户 | 品牌、经营租户、总公司、门店、合同 | `IN_SCOPE_PRODUCED` | D02-S03/S04、D03-S01 | 本文件对应 scenario | 不用 seed/旧投影/前端拼装冒充 owner fact |
| DEV 测试身份与数据 | Dexter | 32 项所需完整 fixture | `IN_SCOPE_PRODUCED` | 仅实施期显式 `r5-full` seed；普通事实走真实 command/邀请链 | `doc/decisions/2026-07-25-v2s-r5-scope-and-method-decisions.md#D-06：R5 完成时的完整 DEV 与 seed 交付` | 未显式 seed 时环境保持无隐式测试数据 |

不存在 `EXTERNAL_PREREQUISITE_DEXTER_DECISION` 未决项。平台首个身份沿用已裁决的部署期
受控前提，不在 R5 发明 runtime 默认账号；其 DEV fixture 只由显式 seed 管理。

## 4. 32 项 scenario inventory

### 平台运行与隔离

<a id="scenario-d01-s01"></a>

| ID | Actor / 任务与成功结果 | UI / disposition | 依赖与 owner readback | Corpus |
| --- | --- | --- | --- | --- |
| D01-S01 | 系统服务提供者以既有平台身份登录并进入平台后台 | platform login；`CREATE_FROM_V2_CARRY` | platform-iam session | G-03 |
| D01-S02 | 创建集团空间并录入编码、唯一名称、运营后台标题、Logo 与备注 | workspace list/create Drawer；`CREATE` | platform-workspace command + asset claim | G-01/G-10 |
| D01-S03 | 修改空间展示信息、备注与 Logo 绑定 | detail/edit Drawer；`CREATE` | platform-workspace + platform-asset 同事务 | G-01 |
| D01-S04 | 从详情启用/停用空间并读回对运营入口的影响 | detail status action；`CREATE` | platform-workspace status + workspace-IAM judgment | G-01/G-10 |

<a id="scenario-d01-s05-d02-s01"></a>

| ID | Actor / 任务与成功结果 | UI / disposition | 依赖与 owner readback | Corpus |
| --- | --- | --- | --- | --- |
| D01-S05 | 平台人员为既有空间录入独立集团编码/名称并初始化 | existing C-01 Drawer；`RETAIN_AS_ALREADY_MIGRATED`，A 批修正契约惯例 | organization owner readback | G-01 |
| D01-S06 | 平台 Shell 在未选空间时保留全局页，选择/切换空间后正确刷新 required tabs | platform shell；`CREATE_FROM_V2_CARRY` | platform-workspace context readback | G-01/G-10 |
| D01-S07P | 平台人员按五类实际值宿主管理扩展字段 definitions 的完整集合 | extension list/detail/edit Drawer；`ADAPT` | extension owner revision CAS | D-03；G-03/G-04/G-09 |
| D01-S07O | 运营人员在五类实体原页面查看/编辑可解析字段，未知旧值保留 | embedded fields；`ADAPT` | 各实体 owner 保存值 + extension definitions | D-03；G-03/G-04/G-09 |

### 组织与经营主体

<a id="scenario-d02-s02"></a>

| ID | Actor / 任务与成功结果 | UI / disposition | 依赖与 owner readback | Corpus |
| --- | --- | --- | --- | --- |
| D02-S01 | 运营侧可读唯一商业集团根 | 与 D01-S05 同一事实；`RETAIN_AS_ALREADY_MIGRATED` | organization owner | G-01 |
| D02-S02 | 商场运营方在左树右详情维护集团→大区→项目，项目内维护分期名称数组 | hierarchy page；`CREATE_FROM_V2_CARRY` | organization owner | G-02/G-04 |
| D02-S03 | 分别维护品牌、实际经营租户、总公司及总公司品牌授权 | 三个独立 pageKey；`CREATE_FROM_V2_CARRY` | organization owner | G-03/G-04/G-06 |
| D02-S04 | 创建/维护/启停门店，锁定项目+租户+品牌，只允许合规总公司 | store page；`ADAPT` | organization owner + brand authorization judgment | G-04/G-06/G-08 |
| D02-S06 | 平台人员只读搜索组织、品牌、经营租户、总公司、门店事实 | organization overview；`CREATE_FROM_V2_CARRY` | organization task query | G-02/G-03/G-04 |
| D02-S07 | 门店角色只读本门店基础归属与启停状态 | store profile；`CREATE_FROM_V2_CARRY` | organization task query by current role node | G-03/G-04/G-08 |

### 轻合同

| ID | Actor / 任务与成功结果 | UI / disposition | 依赖与 owner readback | Corpus |
| --- | --- | --- | --- | --- |
| D03-S01 | 有能力的集团/大区/项目角色创建立即有效合同，录入日期、分期快照、货号二元组与备注 | contract create Drawer；`ADAPT` | contract owner；store/tenant/phase candidates | G-09 |
| D03-S02 | 编辑合同可重选当前分期或保留历史快照，并处理 CAS 冲突 | contract edit Drawer；`ADAPT` | contract owner expectedVersion | G-09 |
| D03-S03 | 将有效合同设置为失效并读回时间/版本 | contract detail status action；`CREATE_FROM_V2_CARRY` | contract owner | G-09 |
| D03-S04 | 管理角色查看完整合同；门店角色在资料页只读合同与三态 | list/detail/store profile；`ADAPT` | contract owner + store task-read derived status | G-09 |
| D03-S06 | 平台人员按空间、门店、租户、合同号、货号与状态只读合同概览 | platform contract overview；`ADAPT` | contract task query | G-09 |

### 账号、权限与会话

<a id="scenario-d04-s01-s02"></a>

| ID | Actor / 任务与成功结果 | UI / disposition | 依赖与 owner readback | Corpus |
| --- | --- | --- | --- | --- |
| D04-S01 | 平台人员维护业务角色名称、节点类型、状态、说明，并分别选择页面准入与动作能力后统一保存 | role list/detail/config Drawers；单命令双独立字段原子替换；`CREATE_FROM_V2_CARRY` | workspace-IAM owner | G-05/G-07 |
| D04-S02 | 平台人员按页面中心查看/配置角色页面准入；动作能力独立选择、不得由页面推导；批量只追加 | integrated role/page UI；同一保存动作原子提交两集合；`ADAPT` | workspace-IAM owner | G-05/G-07 |
| D04-S03 | 平台人员在空间账号页治理账号状态、凭据恢复和任职结果，并可直接撤销任职 | account tab；`ADAPT` | workspace-IAM owner | G-05/G-07 |
| D04-S04 | 运营人员在五类用户页查看任职并按能力撤销；不直接编辑任职 | five user pages；`ADAPT` | workspace-IAM owner | G-05/G-07 |

<a id="scenario-d04-s05p-s06"></a>

| ID | Actor / 任务与成功结果 | UI / disposition | 依赖与 owner readback | Corpus |
| --- | --- | --- | --- | --- |
| D04-S05P | 平台人员按手机号、服务节点、角色发出/查看/取消/重发邀请 | platform invitation tab；`CREATE_FROM_V2_CARRY` | workspace-IAM invitation owner | G-05/G-07 |
| D04-S05O | 运营人员在五类用户页固定节点类型内发出/复制/取消/重发邀请 | five invitation tabs；`CREATE_FROM_V2_CARRY` | workspace-IAM owner + org candidates | G-05/G-07 |
| D04-S06 | 受邀人通过公开 URL 查看→同意→手机号验证→补齐账号 readiness→原子完成任职 | public stepped page；`CREATE_FROM_V2_CARRY` | workspace-IAM owner transaction | G-05/G-07/G-10 |

<a id="scenario-d04-s08-s09"></a>

| ID | Actor / 任务与成功结果 | UI / disposition | 依赖与 owner readback | Corpus |
| --- | --- | --- | --- | --- |
| D04-S08 | 已启用运营账号在带 `groupWorkspaceKey` 的登录页登录，单角色直入、多角色明确选择、无角色空工作台 | keyed login + role choice；`ADAPT` | workspace-IAM session | G-05/G-10 |
| D04-S09 | 已登录用户切换当前运营角色与可视数据节点，Tabs/导航/数据按 owner 版本刷新 | operations shell；`ADAPT` | workspace-IAM context + navigation | G-05/G-10 |
| D04-S10 | 用户获得准确 denied/stale/session/space-disabled 恢复；重置时本人验证手机号后设新密码 | access recovery；`CREATE_FROM_V2_CARRY` | workspace-IAM credential owner | G-05/G-07 |
| D04-S11 | 平台人员治理独立平台管理员 principal 的列表、创建、启停、凭据恢复与审计 | platform admin page；`ADAPT_NO_ROOT_DEFAULT` | platform-IAM owner | G-03 |
| D04-S12P | 已登录平台人员从用户菜单修改本人密码，owner 成功后其他 session 失效并重新登录 | password Drawer；`CREATE_FROM_V2_CARRY` | platform-IAM session owner | G-03 |
| D04-S12O | 已登录运营用户从用户菜单修改本人密码，owner 成功后其他 session 失效并重新登录 | password Drawer；`CREATE_FROM_V2_CARRY` | workspace-IAM session owner | G-05 |

## 5. Operations 五类首页沿用 v2 边界

all-v2 的五类首页只有 route/bootstrap，没有真实首页内容。Dexter 已裁决所有线框以 v2 为准，
无需再确认，因此 R5 只搬运五条 route、shell/content outlet 与 owner-confirmed navigation，
不新增 orientation card、指标、待办、快捷写命令、业务汇总或 task-read。登录和切换角色后的
用户任务仍由 v2 shell 与已有导航承接；空首页不是待补产品范围。

## 6. 任务边界、非目标与禁推

- **范围内**：上表 32 项，以及五类 v2 首页 route/bootstrap 作为 D04-S08/S09 的进入/切换落点。
- **非目标**：商品、销售、库存、订单、支付、TDP、分析报表、完整合同系统、生产切流。
- **禁推**：空间不推集团；数据可见不推页面/动作；品牌授权不推门店可见或写权；门店启停
  不推合同/经营状态；合同三态不驱动 command；URL 不授权。
- **禁止伪修复**：默认/root 账号、直接新增/编辑任职、`workspaceKey` 兼容别名、
  `itemCodes[]`、前端扇出/双读、旧服务/MQ/outbox/runtime fallback、seed 替代业务链。

## 7. Corpus 命中与冲突

| Corpus | 本 Journey 使用 | all-v2 冲突及处置 | Dexter 再裁决 |
| --- | --- | --- | --- |
| G-01/G-02 | 空间/集团分离、固定三层组织 | 保留 owner 语义，删分布式投影 | 否 |
| G-03/G-04/G-06 | 三类用户、经营租户、总公司、门店、品牌授权 | UI 旧“商户”等词改正；授权不扩权 | 否 |
| G-05/G-07 | 角色/范围/页面/动作分离；邀请新增、直接撤销 | 删除 `ADMINISTRATION` direct-add 口 | 否 |
| G-08 | 门店启停只阻断门店节点任职进入/切换 | 不扩展其他阻断 | 否 |
| G-09 | 货号 `{code,name}`、只读三态 | 不搬 `itemCodes[]` 或 `VALID/INVALID` 代替三态 | 否 |
| G-10 | `groupWorkspaceKey` 与双后台 URL | 全量替换 `workspaceKey`，无兼容双形状 | 否 |
| G-11/G-12 | 商品/库存语言 | 非 R5 source-backed 范围 | 否 |

## 8. UI 适用性与后续工件

`UI_BEARING=true`。对应交互工件为
`doc/decisions/2026-07-25-v2s-r5-whole-scope-interaction-design.md`。正式
Dexter 已在该工件记录 `DEXTER_WIREFRAME_REVIEW=ACCEPTED_V2_BASELINE_NO_FURTHER_CONFIRMATION`。
implementation-facing design 可直接冻结，不再设置逐页或首页看图确认点。

## 9. Dexter 裁决

- 范围裁决：Dexter 已明确 `R5 业务范围=v2 已实现范围`，并授权完成 R5 全范围 design。
- 精确分母：32 项；R3 C-01 retain，不重复实施。
- 已知前提：平台首个身份沿用部署期受控前提；首个运营账号在 R5 邀请链内产生。
- 线框裁决：全部以 v2 为准，不需要 Dexter 再确认；五类首页不补造 v2 未实现的内容。
- 后续允许动作：冻结全范围 implementation-facing design；实施仍需另行授权。
