---
title: R5 前置分析：all-v2 实现态、依赖与整体迁移批次评估（Codex 独立版）
status: ANALYSIS_ONLY_NOT_R5_DESIGN
createdAt: 2026-07-25
programId: V2S_W0_W4_EXECUTION
author: Codex
scope: read-only analysis of all-v2 current source and v2s migration constraints
implementationAuthority: false
independentAnalysis: true
claudeMaterialsRead: false
---

# R5 前置分析：all-v2 实现态、依赖与整体迁移批次评估（Codex 独立版）

## 1. 结论先行

Dexter 提出的方向可行：R5 可以把 **all-v2 当前已实现的业务能力及其现有前端功能**
作为一个整体迁移范围，并以“全量接口定义 → 全量后端重构 → 全量前端搬运/适配”组织
同一个 R 的内部实施。

但这不能理解为把 all-v2 的八个服务、RocketMQ、outbox、远程投影、内部 REST client
和 gateway 直接搬入 v2s。迁移对象是用户可见能力、owner 事实与 edge operation；v2s
目标必须是一个 `catering-business-server`、单数据库多 owner schema、单 Flyway history，
跨模块写走同一 `REQUIRED` 事务中的公开 command API。

本报告的建议是采用“**三大批次、批内按依赖序列实现、R5 末尾一次统一 review**”。这既
接受 Dexter 不需要逐 Journey 反复确认的意图，也避免把一个不可定位的整仓大爆炸误当成
一次性实施。

这不是 R5 Journey decision、交互工件、implementation-facing design 或实施授权；不能
据此创建 contract、数据库、app、业务代码、DEV 或动态证据。

## 2. 独立性与证据口径

本文件只读取 all-v2 的当前源码、当前导航/覆盖文档和 v2s 冻结规则。作者没有读取
Claude 为本次 R5 分析形成的任何产物；后续由 Dexter 比较双方结论，而不是本文件先对照
Claude 结论。

### 2.1 实现态标签

| 标签 | 本报告含义 | 能否称为“已可用” |
| --- | --- | --- |
| `SOURCE_IMPLEMENTED` | 可回读的 controller、migration、edge operation、前端 route 或 feature 源码存在 | 不能；源码存在不是业务闭环 |
| `SOURCE_IMPLEMENTED_EVIDENCE_PENDING` | 源码存在，但当前 coverage/L2 资产仍写 `IN_REVIEW`、`PENDING_TEST_ASSET_REBIND` 或 `PENDING_IMPLEMENTATION` | 不能；必须在 v2s 重建 fresh evidence |
| `PARTIAL_OR_CONFLICTING` | 同一能力存在互相冲突的状态信号，或只完成公共流程/壳 | 不能；R5 先决条件是明确保留哪个用户任务 |
| `DESIGN_ONLY_OR_NOT_SOURCE_BACKED` | 在历史 Scenario/设计中出现，但本次未找到对应当前 edge route + owner + page 的完整源码锚点 | 不迁移为 R5 功能分母 |

因此，本报告不使用 `IMPLEMENTED_WORKING`。all-v2 的四份 active coverage matrix 仍将其
场景写为 `IN_REVIEW` 和 `PENDING_TEST_ASSET_REBIND`；多份前端 L2 任务也明示
`PENDING_IMPLEMENTATION`。这不否认源码价值，但禁止把它升级成 fresh business/cleanup
验收。

### 2.2 已回读的主要来源（Heritage 只读）

| 来源 | SHA-256 | 用途 |
| --- | --- | --- |
| `../catering-all-v2/settings.gradle` | `cc543e6a…` | 八个后端 deployable 的静态清单 |
| `../catering-all-v2/contracts/openapi/platform-admin-edge.openapi.yaml` | `d8de7dff…` | edge 面：86 path、105 operation 的静态计数 |
| `../catering-all-v2/apps/frontend/platform-admin/src/app/routing/pageRegistry.ts` | `1f1153aa…` | platform-admin 的 8 个已注册业务页 |
| `../catering-all-v2/apps/frontend/operations-admin/src/app/routing/router.tsx` | `de71fbe6…` | operations-admin 的公开流程、shell 与业务页路由 |
| `../catering-all-v2/apps/frontend/operations-admin/src/app/OperationsAdminSeed.tsx` | `535e7b1d…` | 运营首页/壳仍为 bootstrap 的冲突信号 |
| `../catering-all-v2/doc/specs/platform/2026-07-16-pkg{3,4,5,6}-*-coverage-matrix.md` | `58290059…`, `b2e560d3…`, `fab8c9d1…`, `8e8f7114…` | 当前 Scenario 证据未闭合的依据 |
| `../catering-all-v2/apps/backend/platform-gateway/src/main/resources/application.yaml` | `a58cee00…` | gateway 对多远程服务的 base-url/service-credential 依赖 |

## 3. all-v2 的静态实现面

### 3.1 不是“全产品”或“全部历史文档”

all-v2 的历史产品图有 30 个 Scenario（D01 8、D02 6、D03 5、D04 11），但历史 Scenario
和设计文本不是 R5 自动分母。R5 候选仅来自**当前源码可锚定的能力**；V6 parked 域、
历史未落地 Scenario、以及纯技术/诊断叙述不因被文档提及而进入范围。

尤其应排除或转换如下对象：

- R3 已完成的“商业集团初始化”只登记 `RETAIN_AS_ALREADY_MIGRATED`，不重复实现；
- all-v2 的 RocketMQ、outbox、异步 projection、repair/polling、内部 client、远程 gateway
  编排和多数据库/Flyway history 是旧拓扑，不是功能分母；
- TDP、商品/销售/库存等未在 all-v2 当前 apps 中物化的 parked 域不进入 R5；
- D01/D02/D03 的“diagnostics”历史描述不作为独立用户页迁移。当前源码已有
  workspace/organization/contract overview 的，按具体概览任务迁移；没有 source-backed
  capability 的保持非范围。

### 3.2 候选能力 inventory

| 业务能力组 | all-v2 静态锚点 | 实现态 | 主要前置关系 | v2s R5 的候选 disposition |
| --- | --- | --- | --- | --- |
| 平台管理员身份、会话与平台管理员治理 | `platform-iam-service`、platform-admin authentication / governance | `SOURCE_IMPLEMENTED_EVIDENCE_PENDING` | 无业务前置；平台受控身份前提需从 R3 的外部前提升级为明确 R5 任务 | 迁移，成为平台侧入口与治理 owner |
| 集团空间生命周期与素材绑定 | `platform-workspace-service`、`platform-asset-service`、workspace-management | `SOURCE_IMPLEMENTED_EVIDENCE_PENDING` | 平台身份；素材可独立暂存但绑定依赖空间 | 迁移；R3 已有空间只 retain，不重复初始化 |
| 商业集团、组织根与三层组织树 | `organization-service` commercial group / hierarchy、organization-hierarchy | `SOURCE_IMPLEMENTED_EVIDENCE_PENDING` | 集团空间；商业集团根 | 迁移；初始化 readback 复用 R3 已有结果 |
| 运营 IAM：角色、page access、账号、任职、邀请、凭证恢复 | `workspace-iam-service`、role/account/membership/invitation feature | `SOURCE_IMPLEMENTED_EVIDENCE_PENDING` | 集团空间；角色服务节点与可邀请目标依赖组织树 | 迁移；不能沿用 R3 对 operations 真实登录的排除，须作为 R5 新范围明确实现 |
| 运营登录、会话、身份/数据节点上下文 | workspace session controller、operations authentication/work-context | `SOURCE_IMPLEMENTED_EVIDENCE_PENDING` | 有效受邀任职或已有账号；角色与组织授权事实 | 迁移；是 operations 业务页可用的前提 |
| 品牌、实际经营租户、总公司与品牌授权 | organization business entity controller、business-entity-management | `SOURCE_IMPLEMENTED_EVIDENCE_PENDING` | 商业集团；扩展字段定义可选地影响值校验 | 迁移 |
| 门店、门店资料与状态 | organization store controller、store-management / store-profile | `SOURCE_IMPLEMENTED_EVIDENCE_PENDING` | 项目、品牌、实际经营租户；总公司为可选关联 | 迁移 |
| 扩展字段定义和值 | extension service、organization/contract extension 投影、extension-field-management | `SOURCE_IMPLEMENTED_EVIDENCE_PENDING` | 集团空间；被组织和合同能力消费 | 迁移为一个 platform-owned module；不迁移异步 projection 机制 |
| 轻合同与合同概览 | contract service、contract-management / contract-overview | `SOURCE_IMPLEMENTED_EVIDENCE_PENDING` | 门店；合同候选读取依赖组织事实；扩展字段定义 | 迁移 |
| 平台/组织/合同概览 task-read | overview controllers 与三个 platform overview 页面 | `SOURCE_IMPLEMENTED_EVIDENCE_PENDING` | 各自 owner 数据已存在 | 最后迁移为显式任务型跨 schema read，不复制旧 projection |
| operations role home | `OperationsAdminSeed` 与五个 home route | `PARTIAL_OR_CONFLICTING` | 登录和工作上下文 | 不将 bootstrap 当成功能；R5 需只保留已定义的首页任务，或在全范围设计中明确为无内容状态 |

静态规模信号：一个 edge OpenAPI 中可数出 86 个 path、105 个 HTTP operation；源码有 19 个
gateway edge controller、19 个 owner-facing internal controller、75 个旧 Flyway SQL 文件、
20 个前端 feature group、23 个后端 integration test 类。它说明 R5 是大范围迁移，不能用
“若干页面复制”描述其工作量。

## 4. 依赖图

下图表达的是业务事实依赖，而非 all-v2 的远程调用或 MQ topic 依赖。

```text
platform identity
  └─> group workspace ──> asset binding (optional)
          ├─> commercial group ─> organization hierarchy
          │                         ├─> role/service-node policy ─> accounts/invitations
          │                         │                                  └─> invitation acceptance ─> session/context
          │                         └─> business entities ─> stores ─> contracts
          └─> extension definitions ────────────────────────┘          └─> overview task reads
```

这给出后端内部的最小拓扑顺序：

1. 平台身份、集团空间、素材绑定；
2. 商业集团/组织树，与扩展字段定义并列建立；
3. 角色与页面准入、账号、邀请、公开接受、会话与工作上下文；
4. 品牌/实际经营租户/总公司及其授权；
5. 门店及门店资料；
6. 轻合同；
7. 各类 overview/task-read。

其中第 2 与第 3 不能互换：运营角色服务节点、可邀请目标、数据节点选择都需要组织事实。
第 5 与第 6 不能互换：合同拥有的门店前提需要已存在。扩展字段定义可以先于或伴随组织
核心事实，但其值校验必须晚于定义 owner；不应以旧消息投影充当同步前提。

## 5. 三大批次方案的评估

### 5.1 可接受的形式

| 内部批次 | 一次性完成物 | 批内硬边界 | 不是 |
| --- | --- | --- | --- |
| A. 全量接口定义与设计基线 | source-backed capability inventory、v2→v2s module/owner map、全量 edge OpenAPI、`x-consumer-faces`、单库 schema/Flyway 设计、UI carry/adapt 清单 | 每个 operation 都落到明确 owner 和 consumer face；每个 UI 页面有 v2 静态基线或明确不携带理由 | 不是直接复制 v2 internal OpenAPI 或让 API 反推业务语义 |
| B. 全量后端重构 | 一个 deployable 内的全部模块、迁移、owner command/task-read、generated server binding、后端测试 | 按 §4 的拓扑逐组落地和持续编译/真库测试；旧拓扑无 runtime fallback | 不是把八个服务并排塞进同一进程，也不是把 MQ/outbox/remote client 改名保留 |
| C. 全量前端搬运/适配 | 两个独立 app、公开邀请流程、v2s generated slices、页面与 app-owned shell/state、focused UI 证据 | platform-admin 与 operations-admin 独立；先消费 `libraries/frontend/admin-ui-foundation`，再在 app 保留业务特有部分 | 不是把 v2 前端作为依赖、复制生成 wire 或把两个后台合并 |

三批次之后才进入一次 R5 全范围验证、独立子 agent 对抗审查与 Claude review；不在 A/B/C
之间虚构单独 R5 closure 或单独业务验收。

### 5.2 为什么仍要在批内按依赖序列实施

Roadmap §11 的“一个波次只覆盖有限 module/Journey 分母”原意是避免不可定位的大爆炸。Dexter
已明确接受 R5 整体范围和三批次意图，因此不建议把它改回许多需要反复确认的小 R；但也不应
把全部后端文件同时写完才第一次编译/测试。

推荐折中是：**R5 只有一个设计包、一个实施包、一个 review 包；实施包内部按上表顺序建立
可编译、可测试的 capability group。** 这些 group 只用于依赖控制、失败定位、证据积累和
并行边界，不单独请求产品裁决、不单独宣告交付，也不单独触发 review cycle。

这比“严格 API 全冻结后不允许调整”更稳妥：A 形成整体 contract baseline；若 B 的 owner/
transaction 事实证明某 operation 需要校正，只能回写同一个 R5 设计包并记录差异，不能用
兼容双路径或前端补偿掩盖。

## 6. 已识别的 v2 迁移风险和不搬清单

1. **静态源码与完成证据脱节**：coverage matrix 的 `IN_REVIEW/PENDING_TEST_ASSET_REBIND` 和
   L2 的 `PENDING_IMPLEMENTATION` 意味着 R5 不能把 v2 测试名、页面文件或历史 PASS 当
   成完成证据。
2. **operations 首页冲突**：router 已有业务页 loader，但 `OperationsAdminSeed` 仍宣称
   全部注册 `PENDING_PAGE_MIGRATION` 并把五个 role home 渲染为 bootstrap。R5 必须明确首页
   的真实任务或无内容状态；不能把这个 seed 复制成“运营后台已闭环”。
3. **分布式复杂度不是业务需求**：gateway 的七类 remote base URL/service credential，以及
   各 service 的 RocketMQ/outbox/repair/scheduled poll，均与 v2s 当前单 deployable 红线冲突。
4. **多库 Flyway 不能搬运**：75 个旧 migration 文件属于多个服务自己的 schema history；R5
   应按 v2s owner schema 重新规划一条全局 Flyway history，不能机械合并编号。
5. **术语和历史设计差异**：R5 只在命中已确认 G-01～G-12 时使用其语义；未命中的历史名词
   和 parked 域不能被“v2 已有代码”自动升格为现行产品定义。
6. **UI 搬运边界**：v2 页面是视觉、信息层级和交互基线，而非 source import。generated API
   必须从 v2s edge OpenAPI 重新产生；`admin-ui-foundation` 中的 Drawer lifecycle、overlay
   lock、list context、HTTP/observability/automation primitive 必须优先消费。

## 7. 已确认业务语料对读：一致、分歧与不可反推项

本节回读 `project-memory/decisions/confirmed-business-language-corpus.md`
`@51415f7d…` 与其 read policy `@04d93294…`，并逐项对照 all-v2 的 current contract/source。
语料是现行业务语言和“不得推导”边界，不是 schema/API/Journey/implementation 授权；表中的
`R5 处理`只是后续设计必须吸收的差异清单，不在本分析阶段解决。

| 语料 | all-v2 对读结果 | 结论 | R5 处理 |
| --- | --- | --- | --- |
| G-01 集团空间与商业集团 | `CommercialGroupRoot` 已把 `groupCode`、`groupName` 与空间 key 分开（`commercial-group.schemas.yaml@3a48dba1…`），组织迁移也有独立 commercial group root | **一致**：不能由空间创建自动推出集团、组织或账号；R3 已实现的初始化不重做 | 迁移空间生命周期时 retain C-01 readback，并把后续组织/IAM 作为独立能力，不引入创建副作用 |
| G-02 三层组织树 | 旧 schema 枚举 `GROUP/REGION/PROJECT`，实际 `organization_node` 只存 `REGION/PROJECT`，集团由商业集团根单独表示（`organization-hierarchy.schemas.yaml@fadc2f56…`） | **一致**：门店、总公司不应进入组织树；项目分期是属性 | 保留这个 owner 结构；不得从历史多层/其他域设计扩展出多级大区 |
| G-03/G-04 用户、总公司、实际经营租户与门店 | store contract 明确 `project/brand/tenant` 必填、`headCompany` 可选（`store-management.schemas.yaml@947c2048…`），与“门店须一个实际经营租户、0..1 总公司”大体相容 | **部分一致**：技术 `tenant` 不能在 UI 被简写为“商户”；总公司品牌授权不能推出门店可见或门店写权 | UI 文案和授权 read 必须以 G-03/G-04 的边界重写；历史 `merchant` 只作检索别名，不能升级为业务对象 |
| G-05 运营访问上下文 | all-v2 有角色、page access、capability、session/context/data node；但 `WorkspaceUser`/`RoleAssignment` 等仍是技术词，且账号跨空间物理复用在旧 source 中不能由 workspace-scoped 字段推出 | **部分一致且有待裁决项**：page access、动作能力、数据可见必须继续分开；不能由任一项推出另两项 | 维持独立 owner/readback；不因历史 account table 形状决定跨空间账号复用 |
| G-06 品牌与总公司品牌授权 | v2 有总公司、品牌与授权，并允许门店可选关联总公司 | **语义约束高于历史实现**：品牌授权仅是维护品牌资料资格，不等于门店可见或门店资料写权 | R5 需分别设计 brand authorization、store visibility 与 store command authorization，禁止借同一 relation 推导 |
| G-07 任职、邀请与角色 | v2 membership controller 对外只有查询、详情、撤销；这与“撤销可直接做”相符（`MembershipInternalController.java@ac04652…`）。但 schema 中 assignment `source` 仍含 `ADMINISTRATION`，不能据此推断可直接新增/编辑任职（`workspace-iam.schemas.yaml@a94b8d09…`） | **需消歧，不可照搬**：当前证据不足以证明任何 `ADMINISTRATION` assignment 都符合“新增必须邀请” | R5 仅接受“邀请→接受→生效、撤销直接、角色/节点变化=撤销+新邀请”；若发现历史 direct-add，必须删除而非兼容 |
| G-08 门店启停 | v2 有 `ENABLED/DISABLED` 与状态 mutation（`store-management.schemas.yaml@947c2048…`） | **名称一致，影响面未被源码自动证明**：门店停用不是经营/合同/POS 状态，也不会自动使合同失效 | R5 只固化已裁决的“门店节点任职不能登录/切换”；其他阻断效果不得从现有 status endpoint 推导 |
| G-09 轻合同、货号和衍生经营状态 | v2 `StoreContract` 仍用 `itemCodes: string[]`，状态为 `VALID/INVALID`（`contract.schemas.yaml@ef7805c6…`） | **明确分歧**：语料要求货号为 `{编码,名称}`；`itemCodes[]` 被明确修订。经营中/待开业/未经营是合同存在性衍生状态，不等同 `VALID/INVALID`，且不得与门店启停互推 | R5 contract/API/schema 必须重建货号 pair 与衍生 read；不能复制 string array 或用单一合同状态替代经营状态 |
| G-10 集团空间编码和 URL | all-v2 edge path/DTO 普遍为 `workspaceKey`；语料规定外部技术拼写统一 `groupWorkspaceKey`，platform URL 不带该 key、operations 登录/公开邀请/业务 URL 首段带该 key | **明确命名与路由分歧** | R5 的全量 edge contract 需一次性完成 `workspaceKey → groupWorkspaceKey` 迁移；禁止默认空间、显示名反查或让 URL 承担授权 |
| G-11/G-12 商品/销售/库存 | 当前 all-v2 apps、edge contract 与 frontend feature 没有对应商品、销售集合或轻库存 owner | **不在 R5 范围**；它们是已确认语料，不是已实现迁移能力 | 不因“语料已确认”或未来 TDP 需要而提前建设商品/库存/TDP |

这张对读表给出三个必须在 R5 全范围设计前保留的高优先级差异：

1. `workspaceKey → groupWorkspaceKey` 影响全 edge contract、两个 app route、generated slice 和
   context/cache key；
2. `itemCodes[] → {code,name}[]` 影响合同 owner、表结构、API、列表/详情和经营状态 task-read；
3. 任职的 `ADMINISTRATION` 历史来源字段不能成为 direct-add 兼容口，必须以 G-07 的邀请链
   重新判定。

其余 G-01/G-02/G-03/G-04/G-06/G-08 不一定意味着代码重写，但都是禁止错误继承的边界：
空间不推集团、品牌授权不推门店权限、门店启停不推合同或经营状态。

## 8. 后续对比应回答的四个问题

Dexter 比较 Codex 与 Claude 独立报告时，应优先比较以下四点：

1. 是否都把“源码存在”与“业务 working evidence”分开，而没有把 30 Scenario 或 v2 文档
   直接当 R5 完成分母；
2. 是否都排除了 MQ/outbox/remote client/gateway、多服务/多库 history 等旧拓扑，同时保留
   其对应的业务 owner 与失败语义；
3. 后端顺序是否满足 `workspace → organization/IAM → business entities → stores → contracts → read`；
4. 是否都允许 R5 的三大批次，但把依赖切片限制在同一 R 的内部执行控制，而非拆出多次
   产品确认或多次 R5 review。

## 9. 本分析的停止点

当前 Roadmap 仍是 `CURRENT_STEP=R5`、`CURRENT_STATUS=AWAITING_DEXTER_SCOPE`、
`R5_DESIGN_AUTHORIZED=false`。本报告不改变该状态。待 Dexter 对两份独立分析作出范围与
批次裁决后，才可创建 R5 全范围 Journey/interaction/design 工件；届时仍需单独、明确的
R5 design authorization。
