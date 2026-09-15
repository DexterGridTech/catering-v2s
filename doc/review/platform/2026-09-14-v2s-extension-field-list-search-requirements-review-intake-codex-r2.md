# 扩展字段列表展示与类型化搜索需求 · Claude 第二轮结果作者处置

```text
REVIEW_KIND=AUTHOR_INTAKE_AFTER_EXTERNAL_REVIEW
REVIEW_CYCLE_ID=EXTENSION_FIELD_LIST_SEARCH_REQUIREMENTS_20260914
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=NOT_APPLICABLE_TO_EXTERNAL_CLAUDE_REVIEW
reviewerKind=CODEX_AUTHOR_INTAKE
SOURCE_REVIEW=USER_PASTED_CLAUDE_REVIEW
EXTERNAL_REVIEWER_KIND=CLAUDE_EXTERNAL_REVIEWER
EXTERNAL_VERDICT=NO-GO
EXTERNAL_M_S_N=0/6/4
AUTHOR_VERDICT=NOT_A_REVIEW_VERDICT
CURRENT_BYTES_STATUS=AUTHOR_REMEDIATED_AFTER_EXTERNAL_REVIEW_ROUND_2; ROUND_2_DID_NOT_REVIEW_CURRENT_BYTES
EVIDENCE_TIER=STATIC_SOURCE_READ
IMPLEMENTATION_AUTHORITY=false
RUNTIME_AUTHORITY=NONE
MEMORY_RECALL_STATUS=PROJECT_MEMORY_FAIL_REQUIRED_ASSERTION_DRIFT
```

## 1. 处置和授权边界

本文件是 Codex 对用户转交的 Claude 第二轮外部 DESIGN review 的逐条辩证 intake，不替代 Claude verdict，也不把 Claude 文字中的“Dexter 的决定”当作授权。Claude 提议“可直接进入详设与实施计划”和“实现授权”的部分不是当前会话中的 Dexter 直接指派；需求正本仍保留 `IMPLEMENTATION_AUTHORITY=false`，第 14 节仍要求 Dexter 单独接受语义并另行授权详设。

用户本轮明确要求：读完 Claude 结果，判断成立与否；成立的立即修订，不成立的给出证据；随后整理新话术交 Claude 再 review。因此本文件允许作者修改需求文档和生成新的 Claude 外部 review 请求，但不授权代码、契约、数据库、测试、seed、reset、DEV、backend acceptance、browser L2、UAT、部署或 Git。

当前 project-memory 的独立子 agent 两轮上限只约束 `INDEPENDENT_SUBAGENT` 对抗审查；本轮 reviewer 是 `CLAUDE_EXTERNAL_REVIEWER`，新的 Claude 外部复审由用户直接要求，不能把历史第二轮请求中误写的 `REVIEW_ROUND_LIMIT=2` 和 `ROUND_FINAL_DECISION=SELF_DECIDED` 继续套在 Claude 外部 review 上。新的外部 review brief 会明确该边界，不把它伪装成独立子 agent 第三轮。

第二轮 Claude verdict 针对的是修订前字节。本轮写入后的需求正本是新的当前字节，不能声称已经被第二轮 review 覆盖；新的 Claude 外部 review 请求单独核验这份当前字节。

## 2. 失败诊断和当前证据边界

本轮按入口先重读 `AGENTS.md`、`PLATFORM-BLUEPRINT.md`、Registry 选出的 Roadmap 授权字段、`project-memory/index.md` 全部六个 kernel 和 `scripts/README.md`。四条六维 recall 均带齐六个 route flag，但返回：

```text
PROJECT_MEMORY=FAIL
REASON=required assertion drift: project-memory/decisions/independent-subagent-adversarial-review.md
```

按 `cs-failure-recall` 与 `cs-systematic-debugging` 读取 exact failure 后，当前诊断为：

- `first failure`：四条 recall 在 memory route validator 处因 routed memory 新增的 `CLAUDE_EXTERNAL_REVIEW_NOT_ROUND_LIMITED` 没有对应 owning decision assertion source 而失败；
- `last known good`：入口文档、Roadmap 授权、六个 kernel、`scripts/context/agent-context health`（`STATUS=PASS`）以及直接打开的相关 source/decision 均可读取；
- `broken boundary`：确定性 memory recall 的 assertion-source 一致性，不是需求正本、源码、OpenAPI 或性能报告本身；
- 处置：没有把 recall 的失败改写成成功，也没有修改项目 memory（用户未要求更新 memory）。直接重开 recall 返回的 kernel/routed 路径和 owning decision 后继续 source-first 核验；没有启动动态运行。

## 3. 同根全集和源事实复核

- 宿主全集仍是八类：`BRAND`、`TENANT`、`HEAD_COMPANY`、`STORE`、`CONTRACT`、`COMMERCIAL_GROUP`、`REGION`、`PROJECT`；`ExtensionHostTypes.VALUES` 与 OpenAPI 宿主枚举一致。
- 平面消费面是十个：运营品牌、经营租户、总公司、门店、合同五页；平台组织概览品牌、经营租户、总公司、门店四页；平台合同概览一页。树消费面是运营组织架构树和平台组织架构树两个。
- 当前确切读取 operation 分母不是“九个平面 operation”：十个平面消费面映射到七个平面 operation（平台组织概览四个页签共用一个 operation），再加两个树 operation，共九个目标读取 operation。当前 calibration report 对九者均有 `budgetReadiness.status=READY`；operation-count report 仍只是总量计数源。
- 当前运营树 controller 的 `list` 先经 `sessions.requireWorkspaceRead`，task read 组装完整 `HierarchySnapshot`；运营前端在已返回快照内本地筛选。当前平台树先经平台 `requireRead` 和 enabled selected workspace，再由 `OrganizationHierarchyTree` 响应返回顶层 group 属性和 `REGION`/`PROJECT` 节点；平台节点契约目前没有扩展属性。
- `ContractManagementPage` 的 `useOrganizationCandidates` 以 `candidateUsage='CONTRACT_LIST'`、`selectedId=filters.tenantId` 驱动合同列表的核心经营租户条件；候选控件本身不计入动态扩展分母，但合同列表核心条件不排除。
- `WorkspaceManagementPage` 的 `listPlatformGroupWorkspaces` 返回集团空间 owner 记录，不是 organization owner 的商业集团实体列表。
- 当前 SELECT `options` 为字符串数组，`ExtensionDefinitionService.validJsonValue` 与 `BusinessEntityValueSupport.validJsonValue` 都按 `field.options().contains(json.asText())` 校验。

## 4. 逐条 finding 处置

### S-01：SELECT 历史非空未知值的显示规则

判定：`CONFIRMED`。

当前事实：原需求第 7 节同时写了历史未知值可显示原始值或“—”，第 9.5 节又要求历史字符串原样显示。当前契约只有字符串 options，当前实体非空历史字符串是事实，不是空值。

后果：同一个字段、同一个实体的非空历史 SELECT 值可能被显示为横杠，从而遮蔽实体事实，并与空值语义混淆。

最小修复：需求正本第 7 节固定为：字段仍启用且实体保存了非空、但已不在当前 options 中的字符串，仍显示可识别原始值；只有缺失、`null` 或空值才按统一空值规则显示“—”。本轮已删除“或‘—’”。

适用边界：仅适用于当前 SELECT 字符串数组模型；停用/移除字段不生成列，未来稳定 option key/label 是另行需求。

### S-02：树宿主的 `listDisplay` 适用性和配置交互

判定：`CONFIRMED`。

当前事实：树没有平面表格列消费面，而原需求却把八类宿主都写成两个可编辑配置。当前三类树宿主异构：`REGION`/`PROJECT` 是树节点，`COMMERCIAL_GROUP` 只是根部事实。

后果：管理员选择“是否列表展示=是”时没有任何可见消费结果，状态和行为不一致；把无效开关按普通布尔控件展示还会诱发错误配置期待。

最小修复：需求正本第 4.1、4.2、4.3、6.4、8、11.1、13 节加入三档矩阵：五类平面两个开关均适用且可编辑；`REGION`/`PROJECT` 只有 searchable 适用，listDisplay 显示“不适用”且不可编辑；`COMMERCIAL_GROUP` 两个均显示“不适用”且不可编辑，但名称、类型、必填、启用、选项、顺序仍可维护。不适用值不得产生列或搜索项。

适用边界：该矩阵只限定新配置在八类宿主上的消费；不改变树已有名称/编码导航、详情或扩展值编辑。

### S-03：组织树授权维度

判定：`CONFIRMED`。

当前事实：运营树 controller 的 `workspace(...)` 调用 `sessions.requireWorkspaceRead`，owner 返回工作区完整 hierarchy；平台树调用平台 `requireRead` 加 enabled selected workspace。两者都不是门店/项目列表那种分派作用域查询。

后果：若需求不冻结这一事实，实施者可能把组织树误改成按角色分派范围裁剪，或以“权限外节点不泄漏”为由引入未经批准的新权限模型。

最小修复：需求正本第 8、10.1、11.4 节明确：运营树沿用工作区级读授权并在该边界内返回全部组织节点扩展值；平台树沿用平台读授权和 selected workspace 边界；本需求不扩大也不新增分派作用域裁剪。未来要做 assignment-scope clipping 必须另立权限需求。

适用边界：只适用于当前两个组织树读取面；平面门店/合同主对象仍保持自身既有作用域裁剪。

### S-04：商业集团根字段的树搜索语义

判定：`CONFIRMED`。

当前事实：运营快照把商业集团作为单数 `commercialGroup` 与节点列表分开；平台树把 `groupCode/groupName` 放在响应顶层，`OrganizationHierarchyTreeNode.type` 只有 `REGION`、`PROJECT`。

后果：若让商业集团 searchable 字段生成树搜索项，无法定义节点命中结果，可能出现整树清空或只剩根的伪搜索行为。

最小修复：需求正本第 3.1、4.1、6.4、8、11.4、13 节明确只有 `REGION`/`PROJECT` 的启用 searchable 字段产生树搜索项；商业集团两个新配置均不适用，不产生树搜索项。

适用边界：保留现有树根名称/编码导航；若未来商业集团成为正式树节点，需另立树契约和产品语义。

### S-05：合同列表核心经营租户条件的候选边界

判定：`CONFIRMED`。

当前事实：`ContractManagementPage.tsx` 的 `useOrganizationCandidates` 使用 `candidateUsage='CONTRACT_LIST'`、`selectedId=filters.tenantId`；列表 query 把 `tenantId` 放进合同列表请求，搜索表单也渲染该核心条件。它不是“纯命令表单控件”。

后果：若按候选排除把 hook 整体排除，会漏掉合同列表的核心 `tenantId` 条件，破坏第 6.3 节的核心条件 AND 与定义漂移后的核心条件保留。

最小修复：需求正本第 3.3 节把候选控件与所在列表的核心条件拆开说明，并加入 `BusinessChannelTemplateDrawer` 使用点：候选控件本身排除，合同列表的 `tenantId` 核心筛选保留在 `CONTRACT` 分母内。

适用边界：不因此把所有候选下拉扩展为实体列表；只有已经属于实体列表请求的核心筛选保留。

### S-06：定义漂移恢复的缓存版本下界和停止条件

判定：`CONFIRMED`。

当前事实：运营实体、门店、组织层级定义当前通过普通 RTK query 读取；普通缓存可能返回停用前的旧定义。仅写“重读定义”不能保证取得新版本。

后果：owner 以新 `definitionRevision` 拒绝旧条件后，页面若重新命中旧缓存，会用同一旧条件重新请求，形成无界恢复循环；旧动态列/控件也可能继续伪装为当前结果。

最小修复：需求正本第 10.3、11.5 节规定：平面 drift problem 携带 owner 当前 `definitionRevision`；强制重读绕过 app/RTK 缓存且版本不低于该 revision；一次恢复后同一 revision 再次拒绝即停止自动恢复，展示结构化错误和手动重试。树快照 metadata 标识适用定义版本，发现新版本只替换一次，同版本不循环。

适用边界：平面适用于 owner 拒绝动态条件的恢复；当前树在完整快照内本地筛选，没有相同的逐条件 owner rejection，但仍需通过快照版本发现定义漂移。

### N-01：性能基线 operation 分母

判定：`PARTIALLY_CONFIRMED`。

确认部分：Claude 指出的三个缺失平面 operation ID——`getOperationsOrganizationBrands`、`getOperationsOrganizationTenants`、`getOperationsOrganizationHeadCompanies`——确实需要补入需求第 5.4 节；当前 calibration report 中三者均为 `P5/READY/max=8`。

被当前字节反证的子结论：十个平面消费面不是九个平面 operation。源码中平台组织概览四个页签共用 `getPlatformOrganizationOverviewPage`；准确分母是七个平面 operation + 两个树 operation = 九个目标读取 operation。需求正本已明确该映射，未复述“九个平面 operation”。

后果：若使用错误分母，会把页面数、operation 数和性能预算混淆，导致漏验或虚假覆盖。

最小修复：需求第 5.4 节列出七个平面 operation、两个树 operation及其 READY 静态状态，并明确 operation-count/READY 不能证明 JSONB 扫描、延迟或规模成本。

适用边界：本判定只覆盖当前目标读取面的静态 operation 分母；动态条件新增后的预算仍待获批实现和适用验证。

### N-02：平台树当前契约没有扩展属性

判定：`CONFIRMED`。

当前事实：`organization-hierarchy.schemas.json` 的 `OrganizationHierarchyTreeNode` 只有 id/type/code/name/status/notes/updatedAt/children/phases；`type` 仅 `REGION`/`PROJECT`，商业集团是顶层 `groupCode/groupName`。

后果：平台树不能仅通过前端改造获得大区/项目扩展值；从详情路径拼装或逐节点补请求会破坏当前 owner/read-model 和请求次数边界。

最小修复：需求第 3.2、8 节已标记平台树扩展值/定义版本需要 OpenAPI、generated wire、edge 和 owner projection 的契约变更，当前阶段不实施。

适用边界：只针对平台组织树；平台平面列表已有各自 extensionFields 预留，不由该结论否定。

### N-03：树本地匹配与平面匹配的语义正本

判定：`CONFIRMED`。

当前事实：平面需求第 6.2 节定义了五种类型语义；当前两个树前端已有名称/编码本地匹配，但新增扩展匹配若另写一套会产生大小写、空值、数字或 SELECT 差异。

后果：同一字段在平面与树上可能显示同样控件却得到不同命中结果。

最小修复：需求第 8 节已明确树本地类型化匹配完全复用第 6.2 节；平面由 owner 过滤、树由浏览器在完整快照内过滤，但二者指向同一语义正本。

适用边界：树仅对 `REGION`/`PROJECT` 搜索；商业集团根字段没有树搜索项。

### N-04：平台集团空间列表不是商业集团实体列表

判定：`CONFIRMED`。

当前事实：`WorkspaceManagementPage.tsx` 以 `listPlatformGroupWorkspaces` 读取集团空间 owner 记录；它不是 organization owner 的 `COMMERCIAL_GROUP` 实体列表。

后果：若按页面标题把该页计入商业集团扩展消费面，会把集团空间事实与商业集团实体事实混合，错误扩大分母和字段配置作用域。

最小修复：需求第 3.3 节已加入明确排除行；商业集团仍只按组织树根部事实处理。

适用边界：该页仍保留自己的集团空间名称/编码/状态等既有能力；排除只针对本需求的扩展动态列/搜索分母。

## 5. 通用失败模式与防再犯落点

本轮每个确认的 finding 都抽象为“模式—根因—有限全集—反例—最小解”，并统一放入新建的 Claude 外部复审 brief `doc/review/platform/2026-09-14-v2s-extension-field-list-search-requirements-review-request-claude-r3.md` 的独立核验清单；该文件是 review checklist，不是产品授权或实现计划。

| 问题族 | 通用失败模式 | 根因层 | 有限适用范围 | 反例边界 | 最小可复用解 |
| --- | --- | --- | --- | --- | --- |
| 值/显示身份 | 把可变显示文本当稳定身份，或把非空历史事实降级为空值 | 扩展定义契约与存量值语义 | 当前 SELECT 字符串 options | 未来稳定 option key/label 新契约 | 在正本中固定字符串即保存值/显示文本/搜索身份，显式区分空值与历史孤立值 |
| 异构宿主配置 | 对没有同一消费面的宿主复用同一可编辑开关 | 配置适用矩阵缺失 | 五类平面 + 三类树宿主 | 单一平面宿主 | 以宿主矩阵表达适用、N/A、默认和消费效果 |
| 授权维度 | 以平面作用域推导树作用域，或以“权限外”口号引入新裁剪 | owner 读取边界未冻结 | 两个组织树 | 平面主对象列表的既有作用域 | 固定当前 controller/owner 授权维度，未来新权限另立需求 |
| 页面/候选分母 | 以 hook 或接口名字决定页面语义，漏掉列表核心筛选 | 页面任务与请求消费未拆分 | 当前候选控件及十个平面面 | 纯命令候选控件 | 逐页面区分候选控件与核心列表条件，并列出 hook 使用点 |
| 版本/缓存恢复 | 以“重读”代替绕过缓存和版本下界，导致旧条件循环 | 定义 snapshot/version 生命周期不完整 | 动态定义驱动的平面/树读 | 无动态定义的纯核心列表 | problem revision + 强制权威读取 + 一次恢复/同版本停止 |
| operation 分母 | 用页面数、字符串出现数或总量计数反推 operation 覆盖和性能 | authoritative operation catalog 与消费面映射未闭合 | 本需求七平面 + 两树 operation | 不涉及 operation 的静态说明 | 列出 exact member list、face/owner/status/max，并把扫描成本另列为未验证 |
| 树契约/语义 | 前端从详情或逐节点请求弥补 tree wire 缺口，或另造匹配规则 | tree contract 与共享语义正本未连接 | 两个组织树 | 当前已有完整平面 read model | 先声明契约变更边界，树匹配复用第 6.2 节 |

## 6. 尚未升级为通过的证据

以下仍是 `UNVERIFIED_REQUIRES_EVIDENCE`，不因本轮文档修改变成 GO：

- 动态列、动态搜索项、三档“不适用”配置状态、五类类型控件、树祖先保留和漂移提示尚无 implementation-facing IA/交互工件或浏览器渲染证据；
- 平台树扩展属性的最终 HTTP/OpenAPI/generated wire 形态尚未冻结；
- 九个目标读取 operation 加入动态条件后的 JSONB 查询计划、代表性规模、扫描成本、延迟和新预算尚未验证；现有 calibration `READY` 只证明当前静态 operation budget 记录；
- 业务 acceptance、Browser L2、DEV、seed/reset、UAT 均未在本轮执行。

## 7. 当前修订文件和后续外部复审

本轮主 agent 只写入：

- `doc/plans/platform/2026-09-14-v2s-extension-field-list-search-requirements.md`：修订后的当前需求正本；
- 本文件：第二轮外部 review 的作者 intake；
- `doc/review/platform/2026-09-14-v2s-extension-field-list-search-requirements-review-request-claude-r3.md`：供 Dexter 转交 Claude 的新外部 review 请求。

未修改生产源码、OpenAPI、generated output、数据库、迁移、测试、seed、脚本、依赖或运行资源。下一步只请求 Claude 对当前修订后的需求正本做静态外部复审；它不能代替 Dexter 的产品接受、详设授权、实现授权或动态授权。
