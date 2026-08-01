# RM1 P6 表单详设修复：独立对抗审查第二轮

REVIEW_CYCLE_ID=RM1-P6-FORM-REMEDIATION-20260729
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
ROUND_FINAL_DECISION=SELF_DECIDED
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist={path=doc/evidence/platform/rm1/p6/rm1-u09-form-remediation-independent-review-round2-input-checklist.md,sha256=aed6cfe1aee7a89073c22189de8652ab5fc1dfb38ef85bfe205fc377b7a37f48}
implementationAuthority=false

## 用户任务

业务用户是平台/运营管理者；其用户任务是在正确的业务任务面中，选择当前范围内真实的任职、机构、门店、分期或角色，并只通过明确的启停确认改变角色状态。

## Dexter 立场

Dexter 要求详设先服从业务实质、候选搜索接口统一设计，且不能把跨 owner 的候选和授权事实混成一个万能服务。

## 独立性与范围

`blindReviewDeclaration`：本 reviewer 在形成下列 verdict 前，仅阅读 input checklist 所列的原始 Journey、业务语料、现行 IA、统一台账、契约与生产源码；没有阅读 round-1 审查件、旧 audit、作者 remediation record、finding disposition 或 handoff。`authorMaterialReadAfterIndependentVerdict=true`：本轮不需要也未将其作为判断依据。

定向范围只有三项：(a) C/S/P command variant 分母与 production mapping；(b) C08 是否仍可绕过 S03 的角色状态动作；(c) `CandidateQuery` 是否成为增长型表单候选的单一 consumer 协议而不越过 owner。它不复判 P6 shell、合同 project-scope、扩展字段或历史遗留的全部问题。

## 替代方案

替代方案是一个跨 owner 的万能候选 HTTP endpoint；不选它，因为会混合 workspace-IAM、organization、contract 的 owner 事实和授权。另一个替代是继续每张表单各调一个 endpoint；不选它，因为会重复 query/pagination/cancellation/error 语义，且已是 Dexter 要消除的问题。

## 方案合理性

R5 的真实业务任务不是“把输入框连到接口”，而是让平台/运营管理者仅在对应业务任务中改变 owner 允许的事实：角色状态要通过明确的启停确认改变；邀请、门店、合同等增长型业务对象必须按当前范围选择，而不是凭名称或前端缓存猜测。R5 `D04-S01/S02/S05O` 与 G-05/G-07 冻结了前者，D02-S04、D03-S01/S02 与 G-04/G-09 冻结了后者。

统一为一个跨 owner 的后端万能候选 endpoint 看似更直接，实际会把 workspace-IAM、organization、contract 的授权事实和任务型 read 混为一个 owner，违反 owner 主权。当前“一个 consumer-side `CandidateQuery` protocol + 正确 owner 的 adapter/read + command recheck”是更小且正确的方向；它应当统一 query wire、分页、取消、loading/empty/error，而不能统一事实或授权。该方向不能以“每个现有 endpoint 都不相同”为由否定。

问题正确：现有状态字段确实能绕过专用启停动作，增长型候选也确实不能靠本地缓存猜测。方案的代价与收益匹配：统一 consumer protocol 保留 owner read，避免了跨 owner 聚合的复杂度；C08 的最小收敛只移除 generic update 的 status，而不重造资料/授权 command。

## UI 与交互

APPLICABLE：邀请 Drawer 的机构/角色选择和角色详情的编辑/启停均来自 R5 Journey。用户路径合理：先选机构再选角色，角色状态改动由单独确认操作承接。接口限制已被检查：角色候选目前没有 query/page，不能以 UI 的隐藏字段或本地过滤冒充完成。

## 审查意见复核

本轮是独立第二轮，不接受作者或首轮 finding 作为前提。以下 `CONFIRMED` 结论来自本轮重开 source/源码；适用边界和更小修复均在 finding 中说明。

## 闭环核验

### C/S/P 分母与生产映射：通过

我从 IA01–IA04 的 mutation 事实矩阵、台账和 controller/service 重新按实际 command 收敛，得到：

| 集合 | 独立重算 | 结论 |
| --- | ---: | --- |
| `CORE_CREATE_EDIT_SET` | C01–C12、C14–C25 = **24** | 通过；C12 是一个 hierarchy update command 的两种业务 surface，不能伪增为两个 wire command |
| `STATUS_VOID_SET` | S01–S10 = **10** | 通过；均为独立 status/invalidate command，而不是编辑表单中的隐藏状态 |
| 本轮 IA01–IA04 相邻 security | P01 = **1** | 通过；P02 属 IA05，未被本轮冒充为 IA01–IA04 范围内对象 |

关键反例也成立：当前 `WorkspaceRoleUpdateRequest` 明确将 `status` 列为 required，`PlatformWorkspaceRoleController#update` 将其传给 `WorkspaceRoleService#update`，后者 SQL 同时更新 `status`；但 `transitionStatus` 是另一个独立 owner command。因此 C08/S03 不是“一个表单的两个名称”。

### C08 generic role update status：诚实登记且最小方向合理

IA03 §10 和台账没有把“隐藏状态”误称为已安全：它把 C08 标为 `GAP-ROLE-GENERIC-UPDATE-STATUS-BOUNDARY`，明确要求从 generic public update body 删除 `status`，由 owner 从 latest role 保留当前值，而只允许 S03 接收 `targetStatus`。这与实际 controller/service 调用链相符，也是比新造第二套资料/授权命令更小的修复。

该 GAP 在 OpenAPI、edge mapper、owner public method/SQL 和所有 production caller 同步收敛、并对“向 C08 body 注入 status”做真实 red mutation 前，仍阻断 implementation-facing 设计；当前 IA 没有把它写成已关闭。本项无新的 M/S finding。

### S1｜`CandidateQuery` 尚未覆盖“业务角色”这个增长型表单候选

**分类：CONFIRMED；S。**

IA01 把“任职机构”与“业务角色”都标为 `CandidateQuery`，但对后者又写成“多选 Select；不可搜索外部数据 / 同一候选集内多选”。生产 `OperationsWorkspaceInvitationCandidateController` 的五条 target endpoint 没有 `queryText`、`page` 或 `pageSize`，且一次映射并返回全部 role。业务角色本身由 C07 创建，R5 没有给每个集团空间的角色数量上限；故它是会增长、可能同名、并受所选任职机构类型约束的 form candidate，不能被当作固定枚举或“当前一次 readback 的有限列表”。

这使“所有增长型表单候选均有同一 consumer query protocol”的命题不成立：`subjectType=业务角色` 没有已声明的 queryText 匹配、分页、取消旧请求与 owner-returned page 语义。当前设计只为机构选择登记候选缺口，遗漏了角色分支；全量业务角色积累后会退化为无搜索、无分页的每页独立特殊列表。

最小修复不是新建跨 owner HTTP 聚合 endpoint，而是在 IA01 与统一台账增加 `GAP-INVITATION-ROLE-CANDIDATE-QUERY`：由同一 `CandidateQuery` adapter 将固定 target + 已选机构 ref 作为 dependencies、将 `queryText/page/pageSize/contextVersion` 传给 workspace-IAM public task read；owner 返回统一 `CandidatePage`（只含该类型、当前范围和可用状态的角色）。在该 owner contract/read、adapter 映射和 command recheck 具备前，角色控件不得伪称搜索可用，也不得以 client-side filter 或一次性全量 readback 替代。这个修复保留每个 owner endpoint，统一的只是 consumer 协议，符合“不可跨 owner”的边界。

### N1｜统一协议的 `contextVersion` 需要给 platform selector 明确唯一来源

模板和台账把 `contextVersion` 写为 `CandidateQuery` 固有字段；IA02 又将平台“集团空间”选择器纳入该协议，但该 IA 没有说明此值在 platform session/task read 中的唯一来源。修订时可将它明确为“owner 版本字段（缺失则 `GAP`）”，或把协议该字段改为可选且按 owner contract 声明；不能在实现时临时猜一个 app-local version。

### N2｜本轮验证反例没有支持把授权目录 Tree 强塞进 CandidateQuery

IA03 的“可使用的功能菜单 / 可执行的操作”来自随 role list readback 的冻结 authorization catalog，并非用户增长的业务实体或跨 owner 关系候选；树形呈现保留菜单/动作层级也优于把 key 变成远程搜索结果。本轮没有证据要求把它改为 `CandidateQuery`。但若该 catalog 将来脱离 role readback、出现分页/名称查找需求，必须重新按本模板的增长型候选分母判断，不能沿用此例作为逃逸口。

## 结论

VERDICT=NO_GO

**NO-GO（M=0 / S=1 / N=2）。** S1 修复前，P6 的“统一候选搜索查询”详设不能 GO；C08 的 GAP 登记则是正确的 fail-closed 处理，不应为追求绿灯而回退为 UI 隐藏字段。两轮上限已到，本 reviewer 不会发起第三轮；作者只能按 S1 重开 owning source、比较最小方案并写 disposition/post-remediation 绑定，必要的产品/contract 语义再交 Dexter。
