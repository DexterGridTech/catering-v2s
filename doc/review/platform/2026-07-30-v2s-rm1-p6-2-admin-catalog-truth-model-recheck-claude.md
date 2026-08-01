---
title: RM1 P6-2 管理后台目录单一关系真相模型 POST_REMEDIATION_V1 复核（Claude）
reviewTarget: DESIGN
scope: AdminCatalogNode[] 统一关系模型 current bytes、现有 catalog 分母、Java/前端消费者、P6-2 授权边界
verdict: GO
findings: M=0 / S=1 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 只裁决统一目录关系模型与未来实施 package 的边界；不授权 catalog、generator、Java 或任何 generated output、platform-admin/operations-admin 生产改动、P6-3、DEV、seed、reset、L2 或动态业务 PASS
createdAt: 2026-07-30
---

# 管理后台目录单一关系真相模型复核

## 0. 结论

**GO**，`M=0 / S=1 / N=2`。**本 GO 只裁决模型与未来 package 边界，不构成 historical GO，也不代替独立子 agent 重审。**

我按要求**先从现有字节独立推导**，再读作者结论。独立推导的每一项分母与判别都与模型一致；
round-2 的三条 S 我逐条复核为**真实关闭**，其中 `NAVIGATION_GROUP` / `ACTION_GROUP` 的处置
恰好是我独立推导出的唯一无损解。

`S1` 是我独立发现的**新**问题：模型把迁移目标定为"无损"，但对
`display.label` 的**取值来源**没有规则；而现有 catalog 至少有 **2 个**标题与
carry-over manifest 的冻结 `textAssertionsBySurface` 冲突——按"无损"照搬会产出被冻结断言禁止的文案。

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。

---

## 1. 独立推导（先于阅读作者结论）

我直接从 `contracts/catalog/admin-catalog.json` 现有字节算出以下事实：

| 项 | 我的独立复算 |
| --- | --- |
| 顶层结构 | `platformPages 8`、`operationsPages 17`、`operationsPageUx 17`、`actionGroups 4`、`actions 34`、`userManagementActionBindings 10` |
| **5 / 12 / 8 PAGE 判别** | `operationsPages` 按 `kind` 分：**ROLE_HOME 5**（`HOME-{GROUP,REGION,PROJECT,HEAD-COMPANY,STORE}`）、**BUSINESS 12**；platform **8**；合计 **25** ✓ |
| ROLE_HOME 的角色映射 | 5 个 ROLE_HOME 各自 `eligibleOrgTypes` **恰为一个**且互不重复 → role-node type → home page 是**全函数且 1:1**，**完全可从目录派生** |
| **34 ACTION 单 target / 同 face** | 非单一 `targetPageKey` 的 action = **0**；34 个 target **全部**落在 operations-admin 的 17 页内（platform 0） ✓ |
| **10 relation → `userManagementFor(pageKey)`** | 5 个 pageKey × 2 relation；与 5 个 `PG-IAM-*` 页 **exact-set**；每条 relation 的 target **等于**该页 tuple 第 9 位 `userManagementTargetOrganizationType`；kind 域 = `{INVITE, ROLE_REVOKE}`；10 个 actionKey **全部**在 34 内 → **该表是纯冗余，可无损派生** |
| tuple 元数变化 | `operationsPages` 元数为 **8 或 9**（9 元恰为 5 个 IAM 用户页） |
| 标题重复 | `operationsPages[5]` 与 `operationsPageUx.pageTitle` **0 处不一致** → 可无损折叠 |
| 跨 face key 重叠 | platform 8 ∩ operations 17 = **空** → 每节点单值 `consumerFace` **成立** |
| menuGroup vs actionGroup 标签 | menuGroup `{工作台, 用户与权限, 组织管理, 门店经营}`；actionGroup `{用户管理, 组织管理, 门店合同, 门店管理}`；**交集只有 `组织管理`**，且 `门店经营` 一个菜单组对应**两个** action group |
| 7 项 SURFACE | 实际 router：platform `login` + `password-recovery/{verify,password,complete}` = 4；operations `:groupWorkspaceKey/*` + `invitations/...` + `password-recovery/:resetGenerationKey` = 3；**4+3=7** ✓ |
| Java 旁路 | `WorkspaceAuthenticationService:234` 手写 5 臂 switch 做 role-node type → `HOME_*`；**这正是可派生的那一段** |
| **不可派生的 switch** | 同文件 `:199 enterable(...)` 与 `:231`（描述路径）分派到 stores/entities/groups/nodes 四个 owner 仓库并返回**动态 owner 事实**，**不可被目录吸并** |
| 既有正确消费模式 | `WorkspaceRoleService:35-38` 已从 `WorkspaceAuthorizationCatalog` 派生 `PAGE_CATALOG` / `ACTION_CATALOG` → 只有 `:234` 绕过 |

**我独立得出的结论**：统一节点模型要成立，必须满足两条——
(1) `NAVIGATION_GROUP` 与 `ACTION_GROUP` **不能因标签相同而合并**（因为四对里只有一对重名，
且 `门店经营` 需容纳两个 action group）；
(2) 只有 `:234` 可被目录取代，`:199`/`:231` 必须留在 owner。

## 2. 六项核验对照作者结论 —— 逐项 `CONFIRMED`

| 核验点 | 模型落点 | 判定 |
| --- | --- | --- |
| 5/12/8 PAGE 判别 | `:98-107` `OperationsRoleHomePage{page:{kind:'ROLE_HOME',roleHomeForNodeType}}` / `OperationsBusinessPage{page:{kind:'BUSINESS'},pageAccess{...}}`；`:189` ROLE_HOME **强制无** `pageAccess`/`workspaceRequirement`/可授予角色类型 | ✓ 与我的 5/12/8 及"ROLE_HOME 不是可授予页"一致 |
| 34 ACTION 单 target/同 face | `:78` 单值判别 `kind`；`:196` "ACTION_GROUP 的 face 由 child ACTION 单值推导并验证；未来多页 placement 须另起 contract design" | ✓ 与"34 个全在 operations、0 个多 target"一致 |
| 10 relation projection | `userManagementBinding` 内嵌于 ACTION 节点，"集合不得丢失或新生" | ✓ 与我复算的 exact-set + target 一致性一致 |
| role-home diff allowlist | `:44` 点名 `WorkspaceAuthenticationService.homePage` 为绕开目录的硬编码；`:207` "业务值必须逐项等价；**允许的 Java 变化仅是显式新增 role-home lookup**"；`:193`/`:232` 同口径 | ✓ **allowlist 边界与我独立推导完全一致**（只放 `:234`） |
| owner/router/security 不可吞并 | `:25-29` 动态任职/session grants/可视候选/已选范围/上下文版本/层级可见性/请求级 capability scope 仍归 owner；`:177` `WorkspaceAuthorizationCatalog` **排除**具体组织实体、实时可见性、请求级授权结论；`:186` app router/Component/route segment 仍归 app owner；`:200` `requiredDataNodeType != NONE` 的候选唯一来源仍是 `WorkspaceSessionEntry.dataNodeCandidates` | ✓ 与我标出的 `:199`/`:231` 边界一致 |
| P6-2 / P6-3 范围 | `rm1p6-u02-implementation-amendment.md:24` "does not alter Roadmap state and **does not advance P6-3**"；`:76` 明确 excludes P6-3 operations/public work、DEV、seed、reset、Roadmap mutation、repository…；`:47` 首个 `.tsx` 生产写入前须完成前置记录；`:52` 任何 L2 前须完成 `UI_INTERACTION_CONFORMANCE_RECORD` | ✓ 当前 P6-2 **只能设计**，跨 app catalog/generator/operations/Java migration 不在授权内 |

**round-2 三条 S 的关闭我特别复核了最关键的一条**：模型 `:60` 立了原则——
"`NAVIGATION_GROUP` 与 `ACTION_GROUP` 是不同业务对象；**文字恰好相同不构成同一业务身份**"，
`:78` 把 schema 从多值 `roles[]` 改为**单值判别 `kind`**，
`:158-159` 给出两个**独立节点**同标签的样例
（`OPS_ORGANIZATION`/NAVIGATION_GROUP/组织管理 与 `ORGANIZATION_MANAGEMENT`/ACTION_GROUP/组织管理），
`:184` 再加"显示文本偶然相同不产生跨节点引用关系"。

**这正是我独立推导出的唯一无损解**：四对标签只有一对重名，若按标签合并，
`门店经营` 无法同时承载 `门店管理` 与 `门店合同` 两个 action group（一个节点只有一个 `parentKey`/一个 order）。
单值 `kind` + 独立节点使这三种非重名情形自然成立。

---

## 3. S1 ｜"无损"迁移缺少 `display.label` 的取值来源规则，而现有 catalog 至少 2 处与冻结文案断言冲突 —— `CONFIRMED`

**owning source**

- 模型 `:167-168`/`:184`：每节点持有自身非空 `display.label`；"标题的 menu/page 差异若 IA 指定，作为 PAGE 的"split display。
  **全文 `grep 总览|概览|textAssertions|frozen` = 0 命中** —— 没有任何规则说明 label 的**值**取自哪里。
- 模型 `:36-37` 的分母来源是 manifest 的 `#/pageDesignKeySurfaceCrosswalk/byPageDesignKey`，
  那是 **key** 的分母，不是 **label 值**的分母。

**反例（现有字节两处冲突）**

| pageKey | 现有 catalog 标题 | manifest `textAssertionsBySurface.required` |
| --- | --- | --- |
| `PLATFORM-WORKSPACE-OVERVIEW` | **集团空间总览** | **["集团空间概览"]** |
| `PLATFORM-ORGANIZATION-OVERVIEW` | **组织与经营概览** | **["组织概览"]** |
| `PLATFORM-CONTRACT-OVERVIEW` | 合同概览 | ["合同概览", "货号名称"] — 一致 |

并且 IA02 `:297-298` 已就第一条明确裁决：
"本稿采用 carry-over manifest 的冻结用户文案『集团空间概览』；
**当前 v2 页面和 catalog 的『集团空间总览』只记录为来源差异**"。

**影响面**：模型把迁移目标写成"无损"。若 `display.label` 按无损原则从现有 tuple 搬运，
生成的 platform 菜单/页面标题将是 `集团空间总览` 与 `组织与经营概览`——
**违反 manifest 对同一 surface 的 `required` 冻结断言**，并与 IA02 已裁决的文案相反。
即"无损"对这两处恰恰是**错误目标**，而模型没有区分"关系无损"与"文案取值以冻结断言为准"。

**严重性理由（S 而非 M）**：模型的**关系**部分（本次评审主体）无损且最小，
`S1` 只影响 label 取值这一维；IA02 已有裁决，无需新的产品决策；修法是加一条取值优先级规则。
但若不写，实施期几乎必然照搬 tuple 值。

**最小修复**：在 `§4` 约束表加一行——
"`display.label` 的取值优先级为：`frontend-asset-carryover-manifest.json#/textAssertionsBySurface[key].required`
> 已接受 IA 的 `USER_VISIBLE_COPY` > 现有 catalog tuple；三者冲突时以前者为准，
且必须在迁移记录里逐条列出被替换的旧值"，并把这两处列为已知替换项。
**不需要 Dexter 裁决**（IA02 `:297-298` 已裁决方向）。

---

## 4. N（观察项，不阻塞）

**N1 ｜"ACTION 同 face"约束目前无任何行可检验**

我复算确认 **34/34** ACTION 的 `targetPageKey` 全部指向 operations-admin 页面，platform 侧 **0** 个 ACTION。
因此 `:196` 的"parent、ACTION target PAGE 必须同 face"与"ACTION_GROUP 的 face 由 child ACTION 单值推导"
在当前分母下是**空真**（vacuously true）——第一个 platform ACTION 才会真正检验它。
建议在未来 package 的 red 里加一条"构造一个跨 face target 的 ACTION 必须失败"的夹具，
否则该约束在实施期没有任何行能证明它有效。

**N2 ｜allowlist 未点名"必须留下"的两个 switch，可验证性打折**

`:207` 只正向说"允许的 Java 变化**仅是**显式新增 role-home lookup"。
但 `WorkspaceAuthenticationService` 同文件还有两个 switch：
`:199 enterable(...)`（分派 stores/entities/groups/nodes 判定实时可进入性）与
`:231`（按类型取组织路径描述）。二者返回**动态 owner 事实**，**不可**被目录吸并——
我独立复核认为它们正确地不在 allowlist 内，但模型没有把它们**具名列为 out-of-scope**。
读者只看 `:207` 容易把"该文件里的 switch"整体当作可替换对象。
建议在 allowlist 处补一句具名排除（"`:199`/`:231` 的 owner 分派 switch 明确不在范围，
其 diff 一律视为授权逻辑改变"），使 diff 判定从散文变成可逐项对账。

---

## 5. 处置

`M=0 / S=1 / N=2` → **GO**（只裁决模型与未来 package 边界）。

- **无需 Dexter 产品裁决**。`S1` 的方向 IA02 `:297-298` 已裁决；`N1`/`N2` 是补 red 与具名排除。
- **`S1` 建议在未来 package 开工前写入约束表**：它决定生成标题的取值，
  留到实施期发现会同时打断 manifest 文案断言与 IA02 已接受文案。
- **本 GO 不代表**：`catalog` / `generator` / Java / 任何 generated output 的改动许可，
  platform-admin / operations-admin 生产改动，P6-3、DEV、seed、reset、L2 或动态业务 PASS。
  **当前 P6-2 只能设计**——跨 app catalog/generator/operations/Java migration 需另行授权，
  `rm1p6-u02-implementation-amendment.md:47/:52` 的两道前置记录亦未完成。
- **本文件不是 historical GO**：round-2 的 `NO-GO (M=0/S=3/N=1)` 与
  "当前字节未被独立 subagent 重审"的声明**仍然属实且应保留**；本复核是外部 recheck。
- 已独立验证为真的部分**不得回退**：5/12/8 判别与 ROLE_HOME 无 pageAccess、
  34 ACTION 单 target、10 relation 的可派生 exact-set、单值 `kind` 使
  NAVIGATION_GROUP/ACTION_GROUP 分离、7 项 SURFACE 与 router 一一对应、
  role-home allowlist 只含 `:234`、`:199`/`:231` 留在 owner。

**本复核不授权**：catalog、generator、Java 或任何 generated output、
platform-admin/operations-admin 生产改动、P6-3、DEV、seed、reset、L2 或动态业务 PASS。
