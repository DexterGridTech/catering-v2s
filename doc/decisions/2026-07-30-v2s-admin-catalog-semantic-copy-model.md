---
title: 管理后台目录的单一关系真相模型
status: PROPOSED_FOR_DEXTER_AND_CLAUDE_REVIEW
reviewBindingStatus: DECLARED_POST_REMEDIATION_AWAITING_CLAUDE
createdAt: 2026-07-30
programId: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: false
REVIEW_CYCLE_ID: RM1P6-ADMIN-CATALOG-TRUTH-MODEL-20260730
---

# 管理后台目录的单一关系真相模型

## 1. 决策、用户任务和边界

`contracts/catalog/admin-catalog.json` 的静态业务主体应为唯一的
`nodes: AdminCatalogNode[]`。它是管理后台**目录关系**的单一真相：哪些静态页面可被哪一个后台消费、
它们属于哪一导航组、需要何种角色节点与可视数据节点、哪些能力落在哪些页面、能力如何分组、以及用户管理
邀请/撤销能力与目标机构类型如何关联。前端、edge generator 和后端从这同一列表各自投影所需的静态目录。

这不是文案工程，也不是要把整个 IAM/组织域搬进 JSON。显示名称只是节点的普通显示属性；标题差异只是这个模型
解决的一个表象。真正的用户结果是：平台管理员配置角色时看到的 page/capability 目录、后端校验的可授予关系、
运营端拿到的静态页面语义和相应的功能准入，来自同一组可审计关系，而不会有 tuple、binding map、硬编码首页
switch 和 feature 常量各自成为局部真相。

目录模型的唯一真相范围是**有限且静态的后台目录关系**。动态任职、当前 session 的 page/action grants、
可视数据候选、已选范围、上下文版本、组织层级可见性和每个请求的 capability scope，仍然分别由 workspace-IAM
owner、组织 owner 与 IAM requirement registry 保有。catalog 只能约束“某类页面/能力允许或需要什么”，不得产生
候选、推导授权，或替代 owner command 的重新核验。

`BUSINESS_REQUIREMENT_SOURCE=Dexter 2026-07-30：catalog 与 action 一起优化为统一真相、统一模型；页面标题不是中心问题。`

`CURRENT_AUTHORITY_BOUNDARY=本设计不授权 catalog/action 跨 app 迁移、generator、Java 生成物或 operations production UI；这不缩小 RM1 P6-2 已有的 platform owner/edge/platform-admin 实施授权，也不授权 P6-3、DEV、seed、reset 或 L2。`

## 2. 有限分母与已确认根因

| 静态分母 | 当前事实来源 | 根因 |
| --- | --- | --- |
| 25 PAGE（platform 8 + operations 17） | `admin-catalog.json` 的 `platformPages`、`operationsPages` | 位置 tuple 把 page kind、组、准入、角色/数据节点混为下标含义。 |
| 4 navigation group | operations page tuple 的 `menuGroupLabel` | 同一信息被每页重复，且没有稳定 group 身份。 |
| 4 action group + 34 ACTION | `actionGroups`、`actions` | action 是权限与范围关系，但 action group/page/scope 由平行 tuple 拼装。 |
| 10 user-management binding | `userManagementActionBindings` | `PAGE + target organization + purpose + ACTION` 是第二张关系表，不是能力节点自身。 |
| 17 operations PAGE experience records | `operationsPageUx` | 页面要求的数据范围级联、空态、禁止替代被拆出 PAGE 主关系。 |
| role-node type → home PAGE | `WorkspaceAuthenticationService.homePage` | 已在生产 Java 硬编码，绕开目录的 PAGE/role-home 关系。 |

现有 generator 已把这些结构投影到两个前端 generated catalog 与 backend
`WorkspaceAuthorizationCatalog.java`。该 Java catalog 被角色保存校验、角色编辑 readback、session navigation、
page/data-node requirement 和用户管理 capability 反查消费；operations feature 再用 session action grants 决定
按钮是否可用。因此 ACTION 不是文案附属，PAGE 也不是单纯菜单项。

## 3. 方案比较与裁决

| 方案 | 问题 | 裁决 |
| --- | --- | --- |
| 保留五类 tuple/map，只给 tuple 命名 | 保留多个事实源和 Java 首页旁路；关系仍靠 generator 拼接 | 拒绝 |
| 将页面、动作和 owner 实时事实全塞进一个泛型图数据库式 schema | 模型过度抽象，复制 owner 组织/IAM 语义并模糊责任 | 拒绝 |
| 一个受判别类型约束的 `AdminCatalogNode[]`，只承载静态目录关系 | 保留关系的业务身份、可由各 consumer 投影、不会夺取 owner 真相 | 推荐 |

推荐方案比“页面 catalog + action catalog + binding catalog”少一层事实源，也比任意属性图更小。它允许
`NAVIGATION_GROUP` 与 `ACTION_GROUP` 是不同业务对象；文字恰好相同不构成同一业务身份，不能为了字符串
去重而建立跨节点 display 引用或错误合并导航 IA 与角色权限分类。

## 4. 唯一节点模型

文件除 schema/source policy 元数据外只保存 `nodes` 列表。每个对象都有稳定 `key`、判别 `kind`、单一
`consumerFace`（action group 的 face 由 child action 投影）和节点自身的 `display`；`display` 仅表达该节点
的用户可见名称，不是另一层文案 contract。

```ts
type AdminCatalogNode =
  | NavigationGroupNode
  | ActionGroupNode
  | PageNode
  | ActionNode;

type BaseNode = {
  key: string;                         // 全目录唯一；复用现有 page/action/group stable key
  kind: 'NAVIGATION_GROUP' | 'ACTION_GROUP' | 'PAGE' | 'ACTION';
  display: {label: string};
};

type NavigationGroupNode = BaseNode & {
  kind: 'NAVIGATION_GROUP';
  consumerFace: 'operations-admin';
  navigation: { order: number };
};

type ActionGroupNode = BaseNode & {
  kind: 'ACTION_GROUP';
  actionGroup: { order: number };
};

type CommonPageNode = BaseNode & {
  kind: 'PAGE';
  navigation?: { groupKey: string; order: number; iconKey?: string };
};

type OperationsRoleHomePage = CommonPageNode & {
  consumerFace: 'operations-admin';
  page: {kind: 'ROLE_HOME'; roleHomeForNodeType: RoleNodeType};
  navigation: {groupKey: string; order: number};
};

type OperationsBusinessPage = CommonPageNode & {
  consumerFace: 'operations-admin';
  page: {kind: 'BUSINESS'};
  navigation: {groupKey: string; order: number};
  pageAccess: {
    pageAccessManaged: true;
    grantableRoleNodeTypes: RoleNodeType[];
    requiredDataNodeType: DataNodeType;
    userManagementTargetOrganizationType?: OrganizationType;
  };
  experience: {
    pageDescription: string;
    dataNodeCascaderLabel: string | null;
    noDataNodePrompt: string | null;
    noCandidatePrompt: string | null;
    cascadeLevelLabels: string[];
    forbiddenAlternatives: string[];
  };
};

type PlatformPage = CommonPageNode & {
  consumerFace: 'platform-admin';
  page: {kind: 'BUSINESS'};
  workspaceRequirement: 'GLOBAL_OR_OPTIONAL' | 'REQUIRED';
  navigation: {order: number; iconKey: string};
};

type PageNode = OperationsRoleHomePage | OperationsBusinessPage | PlatformPage;

type ActionNode = BaseNode & {
  kind: 'ACTION';
  consumerFace: 'operations-admin';
  action: {
    groupKey: string;
    targetPageKey: string;              // 当前一能力一 PAGE；多页需求须另起 contract design
    grantableRoleNodeTypes: RoleNodeType[];
    scopeApplicability: ScopeApplicability;
    userManagement?: {
      targetOrganizationType: OrganizationType;
      purpose: 'INVITE' | 'ROLE_REVOKE';
    };
  };
};
```

`RoleNodeType`、`DataNodeType`、`OrganizationType`、`ScopeApplicability` 均引用当前 owner-defined
closed vocabulary；它们**不是**新建 catalog node。这个模型描述“静态可授予/需要的类型”，不描述具体组织实体
是否可见或当前用户是否可进入。

### 4.1 关系样例

```json
{
  "nodes": [
    {"key":"OPS_ORGANIZATION","kind":"NAVIGATION_GROUP","consumerFace":"operations-admin","display":{"label":"组织管理"},"navigation":{"order":100}},
    {"key":"ORGANIZATION_MANAGEMENT","kind":"ACTION_GROUP","display":{"label":"组织管理"},"actionGroup":{"order":100}},
    {"key":"HOME-REGION","kind":"PAGE","consumerFace":"operations-admin","page":{"kind":"ROLE_HOME","roleHomeForNodeType":"REGION"},"navigation":{"groupKey":"OPS_WORKBENCH","order":20}},
    {"key":"PG-IAM-REGION-USERS","kind":"PAGE","consumerFace":"operations-admin","page":{"kind":"BUSINESS"},"navigation":{"groupKey":"OPS_ACCESS","order":210},"pageAccess":{"pageAccessManaged":true,"grantableRoleNodeTypes":["GROUP","REGION"],"requiredDataNodeType":"REGION","userManagementTargetOrganizationType":"REGION"}},
    {"key":"BC-IAM-REGION-INVITE","kind":"ACTION","consumerFace":"operations-admin","display":{"label":"管理大区用户邀请"},"action":{"groupKey":"USER_MANAGEMENT","targetPageKey":"PG-IAM-REGION-USERS","grantableRoleNodeTypes":["GROUP","REGION"],"scopeApplicability":"SELECTED_REGION_SCOPE","userManagement":{"targetOrganizationType":"REGION","purpose":"INVITE"}}}
  ]
}
```

每个节点持有自身非空 `display.label`。不同业务节点即使名字相同也不建立字符串引用；同节点跨 menu、tab、
page surface 的显示复用由它的一个 display 属性派生。标题的 menu/page 差异若 IA 指定，作为 PAGE 的
显示投影处理，但不是本设计的中心或新的词典。

## 5. 投影、owner 边界与不变量

| 投影 consumer | 从 nodes 取得 | 不得取得或推导 |
| --- | --- | --- |
| platform-admin generated catalog | platform PAGE 的固定导航/上下文要求 | operations role authorization、owner session facts |
| operations-admin generated catalog | navigation group、PAGE、experience、ACTION stable key | 当前 session grants、候选、已选数据范围 |
| WorkspaceAuthorizationCatalog | operations PAGE/ACTION、group、user-management relation、role-home lookup | 具体组织实体、实时可见性、请求级授权结论 |
| Workspace IAM / organization owner | catalog stable key 的静态兼容性校验 | 从 key 自行授予 page/action 或绕过 owner command recheck |

generator 的 fail-closed 不变量：

1. 25 PAGE、34 ACTION、4 navigation group、4 action group、17 experience、10 user-management
   purpose relation 的 key/关系集合与冻结分母完全相等；未知 key、role 或 data-node enum 拒绝。
   每个 `display.label` 必须非空；显示文本偶然相同不产生跨节点引用关系。
2. 每个 operations PAGE 恰有一个 navigation group 和 group 内唯一 order；platform PAGE 可保留其现有
   flat navigation 与 icon。app router/React Component/route segment 仍由 app owner 保有，但 router key 集合
   必须与该 face 的 PAGE key 集合相等。
3. PAGE 必须严格落入 5 个 `OperationsRoleHomePage`、12 个 `OperationsBusinessPage`、8 个
   `PlatformPage` 分母之一。ROLE_HOME 强制没有 `pageAccess`、`workspaceRequirement` 或可授予角色类型，
   且其 `pageAccessManaged=false` 的 Java 投影保持不变；12 个 operations BUSINESS PAGE 强制完整
   `pageAccess + experience`；platform PAGE 强制没有 operations authorization 字段。生成 Java
   `homePageForRoleNodeType`，从而移除
   `WorkspaceAuthenticationService` 的硬编码首页 switch。
4. ACTION 的 group/page target 均存在，ACTION face 必须等于其 target BUSINESS PAGE；所有 ACTION 当前
   是一能力一 PAGE，其 role-node type 是 target PAGE `pageAccess.grantableRoleNodeTypes` 的非空子集。
   ACTION_GROUP 的 face 由 child ACTION 单值推导并验证；未来多页 placement 须另起 contract design，不能以
   无约束数组预埋。
5. 有 `userManagementTargetOrganizationType` 的 PAGE 恰有一个 `INVITE` 和一个 `ROLE_REVOKE` ACTION；
   两者 target page、target organization type 必须一致。10 项 binding 由 ACTION 计算，禁止再存平行数组。
6. `requiredDataNodeType != NONE` 的候选唯一来源仍是 `WorkspaceSessionEntry.dataNodeCandidates`，最终选择
   仍调用 owner command；catalog 只表达静态要求。
7. generator 须输出受类型约束的 `userManagementFor(pageKey)` projection，包含
   `targetOrganizationType`、`inviteActionKey`、`roleRevokeActionKey`，供 `WorkspaceUserPage` 与
   `WorkspaceInvitationPanel` 消费；feature 不再遍历 node 或保留平行 binding 语义。endpoint 选择仍是
   OpenAPI/feature owner 的职责。
8. 结构迁移后既有 `capabilityCatalog()`、`pageCatalog()` 和 `userManagementActionBindings()` 的已解析
   业务值必须逐项等价；允许的 Java 变化仅是显式新增 role-home lookup。任何其他生成 diff 均进入
   owner/contract review。
9. `scopeApplicability` 是当前目录语义与审查字段，不替代
   `contracts/registry/iam-org-governance-manifest.json`、`WorkspaceCapabilityRequirementCatalog` 或
   `WorkspaceCapabilityScopeResolver` 的请求级安全要求。
10. `display.label` 的取值优先级是 carry-over manifest 的冻结 `textAssertionsBySurface.required`、已接受
    IA 的 `USER_VISIBLE_COPY`、现有 catalog 值。冲突时以前者为准，并在迁移 receipt 逐项记录旧值替换；
    已知 platform 例外是 `PLATFORM-WORKSPACE-OVERVIEW`（“集团空间总览”→“集团空间概览”）与
    `PLATFORM-ORGANIZATION-OVERVIEW`（“组织与经营概览”→“组织概览”）。
11. future generator red fixture 必须构造 ACTION 指向另一 consumer face 而失败；
    `WorkspaceAuthenticationService.enterable(...)` 与组织路径描述 switch 是动态 owner 分派，明确不在
    role-home lookup diff allowlist，任何改动均视为授权语义变更。

## 6. 影响、范围和证据

这是一项跨 platform/operations/backend generator 的未来迁移设计。P6-2 的现有 package 没有授权改变
`admin-catalog.json`、`edge-codegen.mjs`、operations generated catalog、operations feature behavior 或
`WorkspaceAuthorizationCatalog.java`；P6-2 只能保留这份设计与审查。后续实施须由 Dexter 建立新 package，
并 hash-bind 唯一 catalog、generator、两个 app 的 consumer、Java output、IAM registry/OpenAPI stable key
compatibility、各自 IA 分母和独立 implementation review。

实施证据顺序必须是：模型 set equality 与真实 red mutation → generator/projection proof → each consumer 的
fresh IA 对齐 → 受管动态验证（如经对应 package 授权）→ business/cleanup 分离结果。静态或类型检查绝不等于
动态业务 PASS。

## 7. 第一轮独立审查的辩证 intake

`REVIEW_CYCLE_ID=RM1P6-ADMIN-CATALOG-TRUTH-MODEL-20260730` 是 Dexter 将目标从“标题来源”实质调整为
“统一后台目录关系真相”后启动的新 cycle。round 1 的 `NO-GO (M=2/S=4/N=1)` 已逐条重开 owning source：

| finding | disposition | 最小处置 |
| --- | --- | --- |
| M-1 role home 被误建为可授予 page | `CONFIRMED` | `ROLE_HOME` 与 `BUSINESS.pageAccess` 判别分离；生成 lookup 才可取代 Java switch。 |
| M-2 错误缩小 P6-2 全部授权 | `CONFIRMED` | 仅禁止本 catalog/action 跨 app 迁移，不改变 P6-2 其他 platform 实施授权。 |
| S-1 display 引用可空/循环 | `CONFIRMED` | non-empty label XOR constrained labelRef，生成前解析与 cycle rejection。 |
| S-2 无需求多 page action 数组 | `CONFIRMED` | 收紧为一个 target PAGE；未来多 placement 须新 contract design。 |
| S-3 action face 未锁定 | `CONFIRMED` | ACTION face 等于 target PAGE；ACTION_GROUP face 由 child 计算验证。 |
| S-4 binding consumer 未收口 | `CONFIRMED` | generator 提供 typed purpose lookup，列为后续 package 的精确 consumer。 |
| N-1 request-level security owner | `CONFIRMED` | 维持 IAM registry/resolver 独立 owner truth。 |

上述是作者基于独立 verdict 的处置，不是 independent GO。round 2 必须重新证伪当前 bytes；它仍不得把
“只改静态模型”说成 P6-2 business 或动态验证结果。

## 8. 第二轮独立审查请求

请 fresh independent reviewer 重点核验：

1. ROLE_HOME/BUSINESS/pageAccess 的分离是否恢复当前 owner 语义；
2. ACTION 单 target、typed user-management lookup 和 action face 是否保留所有消费者；
3. `labelRef` 是否足够小且不重新形成文案 contract；
4. 生成 role-home lookup 与保留 existing Java projection 的 diff 边界是否可验证；
5. 是否仍有 catalog 冒充 router、动态 owner facts 或 request-level security 的路径。

本 decision 在 Dexter 和 Claude 给出可执行 GO、且另有精确 implementation package 之前，不授权任何迁移。
