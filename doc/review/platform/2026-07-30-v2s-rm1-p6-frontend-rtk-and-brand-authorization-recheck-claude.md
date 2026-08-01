---
title: RM1 P6 前端 RTK/上下文整改 + P6-3 总公司品牌授权矫正设计整包复审（Claude）
reviewTarget: DESIGN
scope: RM1-P6 current bytes（RTK/context 整改、P6-3 corrective design、roster、physical contracts、granularity manifest、相关生产源码与契约）
verdict: NO-GO
findings: M=1 / S=1 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅静态设计与当前字节复审；不授权 implementation、契约/生成物修改、动态运行、DEV、seed/reset、Roadmap 状态或仓库控制操作
createdAt: 2026-07-30
---

# P6 前端 RTK/上下文整改 + P6-3 品牌授权矫正设计复审

## 0. 结论

**NO-GO**，`M=1 / S=1 / N=3`。

前一轮我提的 RTK 三条与 P6-1 实现审的 D1 漂移**全部真实关闭**，
P6-3 矫正设计的**状态机与安置裁决写得准确**，其中在用条件那段甚至主动点名了我本轮独立发现的同一处
edge 缺陷。**NO-GO 只因一条**：candidate search 被断言为 owner 服务端分页，
而当前字节的过滤与分页**发生在 edge**，owner 侧根本不接受这些参数，且两份工件均未登记为 GAP。

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。

---

## 1. 已关闭的历史 finding（逐条复算）

| 历史 finding | 关闭情况 |
| --- | --- |
| RTK 复审 `M1` 页面级 app-substrate primitive | **已闭合且优于要求**：`createObservedBaseQuery` / `platformHttpProtocol` 在两份工件的**表格行中全部清零**，仅保留 `physical-screen-import-contracts.md:26-27` 的显式规则——"`createObservedBaseQuery` is allowed only in `PlatformApi.ts` and `OperationsApi.ts`, where the one generated `createApi` is configured；`platformHttpProtocol` is foundation-internal; it has no page…"。登录/恢复/邀请/shell 各行现在只声明真正的页面级原语 |
| RTK 复审 `S1` 切上下文不重置分页 | **已闭合**：`OperationsApp.tsx:56` 为内容组件加了 `key={session.contextVersion}`，采用的是我建议的单点修法，分页与本地视图态一并归位 |
| P6-1 实现审 `M1` D1 sha 漂移 | **已闭合**：`scripts/check/implementation-design-granularity` 本会话实跑不再出现 `D1_ROUTED_SOURCE_SET_MISMATCH`，正常走到 `FINDINGS=2 / VERDICT=NO_GO / REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` |

## 2. 已验证为"真"的部分（不得回退）

**RTK 单一 api/store 约束未破**（本会话全量 grep，排除 `/generated/`）：
`createApi` = 2 文件、`configureStore` = 2 文件、
`createSlice` / `useSelector` / `useDispatch` = **0**、
`features/**` 下**无** `.refetch()` 或裸 `fetch(` —— 无新 slice、无第二 API、无页面 fetch/refetch 循环。

**contextVersion 刷新链未破**：owner CAS + 递增（`WorkspaceAuthenticationService:105/:119`）→
`setEntry` → `queryContext` useMemo → 页面 `listRequest` 含 `expectedContextVersion` → 新 RTK cache key。
新增的 `key={session.contextVersion}` 只影响本地视图态，不改变 cache key 语义。

**P6-2 已无 operations 品牌授权例外** —— 核验重点 ①。
roster `:109-113` 明写该 corrective slice 归 `PG-ORG-HEAD-COMPANY`、
"it is not an extra P6-2 surface or a second management page"，
且 legacy nested Drawer 与旧 bulk-operation 静态断言"**removed in the same P6-3 package-exit receipt set**"。
矫正设计 `:20-23` 同样明写"It is not a platform governance task and must not be an exception in P6-2"。

**四个 operation 齐备** —— 核验重点 ③（前半）。契约实处：
`getOperationsOrganizationHeadCompany`（`head-company-management.paths.yaml:279`）、
`getOperationsOrganizationBrands`（`brand-management.paths.yaml`）、
`add…BrandAuthorization`（`:597`，POST + 单 `brandId`）、
`remove…BrandAuthorization`（`:701`，DELETE 且 `brandId` 在 path，`:756`）。
无 bulk / collection-replace 出现在这四个之中。

**最终 UI 路径三处一致** —— 核验重点 ②。
physical `:66` `IA04-HEAD-COMPANY-BRANDS → business-entity-management/ui/HeadCompanyBrandAuthorizationDrawer.tsx`，
原语 `adminDrawerSurfaceProps, useDrawerFormLifecycle, useSubmissionLifecycle, useOverlayLock`；
与 roster `:110` 及 granularity manifest `:815-816` 一致。legacy
`head-company-management/ui/HeadCompanyManagementPage.tsx` 仍在，且矫正设计 `:21` 如实记录
"The existing page still calls the retired collection-replace operation"，处置为 removal-only。

**transport 侧 code-only 成立** —— 核验重点 ④（后半）。
`OperationsTransport.ts:81-92` 只从 `data.errorCode` 取码，`detail` 用的是**固定客户端串**
`'请求未完成，请根据错误码检查后重试。'`，**服务端 `Problem.detail` 从不透传**；
矫正设计 `:41-44` 进一步禁止 `brandAuthorizationBlockers` / `visibleStores` / 门店标识或数量进入 feature state。

**unknown-result / idempotency 状态机正确** —— 核验重点 ⑤。矫正设计 `§3`：
receipt identity `(workspaceUuid, idempotencyKey)` + method/path/body 规范化哈希（`:53`）；
204 → 立即 owner detail readback（`:57`）；**已定 4xx 永不重放**（`:58`）；
仅 `PLATFORM_COMMON_RESULT_UNKNOWN` 或无确定 HTTP 结果进入 unknown 分支（`:62`）；
unknown 先读 detail，**仅在 membership predicate 仍不满足时**以完全相同的 method/path/body/key 重放一次（`:65`）；
明禁 mint 新 key、循环选择、collection replacement、重放已知 4xx（`:66`）。
五条子要求逐条命中，无一遗漏。

---

## 3. M1 ｜candidate search 的过滤与分页在 edge，不在 owner；两份工件均未登记 —— `CONFIRMED`

**owning source（断言方）**

- roster `:118-120`："Candidate search sends `name`, `status=ENABLED`, `expectedContextVersion`, `page`,
  `pageSize` **to the owner**; it never materializes a full client candidate set."
- 矫正设计 `:30-32`："candidates **remain server-paginated** and no full browser list is fetched."

**反例（当前字节）**

| 层 | 事实 |
| --- | --- |
| 契约 | `brand-management.paths.yaml` 的 `getOperationsOrganizationBrands` 声明 `name/code/status/sort/direction/page/pageSize` ✓ |
| edge | `OperationsBusinessEntityController:82-88` **接收**全部参数 ✓，但方法体是 `page(entities.listEntities(BRAND, workspaceUuid, groupWorkspaceKey), name, code, status, sort, direction, page, pageSize)` |
| owner | `BusinessEntityService:294` **只有一个** `listEntities(String entityType, UUID workspaceUuid, String groupWorkspaceKey)`，返回 `List<OrganizationEntityReadback>` —— **无 filter、无 page、无 total 参数**，全仓无第二个重载 |
| 谓词位置 | `OperationsBusinessEntityController:125` 的 `private static Page<OrganizationEntityReadback> page(List<…> source, name, code, status, sort, direction, page, pageSize)` —— **过滤、排序、分页与 total 全在 edge 内存中对全量 owner 列表完成** |

即：参数到达的是**edge controller**，不是 owner。
"no full **browser** list" 这半句为真（浏览器只拿一页），
但"sends … **to the owner**"与"server-paginated"在 owner 边界上**不成立**。

**影响面**

1. 每次候选检索都会把该集团空间的**全部品牌**载入 edge 内存；
2. items/total 仅因同一个本地 helper 计算而自洽，**owner 从未见过该谓词**——
   将来 owner 侧若加入范围或授权过滤，两者不会复合，且不会有任何门发现；
3. 这正是三步计划 `§1 共同禁止项` 的"以 UI filter 代替 owner filter"所针对的形状，
   仓内对门店已登记同类 GAP（`GAP-STORE-LIST-FILTER-SEMANTICS`：
   "必须补 controller/task-read 的 server filtering + same-predicate total"）。
   **同一缺陷形状，门店登记为 GAP，品牌却被断言为已满足**——处置不一致且未披露。

**严重性理由（为何 M）**：这不是措辞问题。P6-3 正是以"candidate search 已是 owner 服务端分页"
为前提被提交准入的，而该前提为假；正确处置是**登记 GAP**（与门店同形），
而不是改写为"edge-paginated"就放行。它也直接否掉了 Dexter 点名的核验重点 ③ 后半。

**适用边界**：不影响 §2 已验证的四个 operation 存在性、UI 路径一致性、状态机与 code-only 结论；
也不影响浏览器侧"不 materialize 全量"的事实。

**最小修复**：给 owner 增一个接 `name/status/page/pageSize` 并以**同一谓词**返回 `items+total` 的
`listEntities` 重载，edge 停止本地 `page(...)`；在闭合前于 roster 与矫正设计**登记
`GAP-BRAND-CANDIDATE-OWNER-PAGINATION`**，并明确该 slice 在其闭合前不得声称 candidate search 已就绪。
**不要**只把措辞改成"edge-paginated"——那会让品牌与门店的同类缺陷出现两套标准。

---

## 4. S1 ｜roster 用现在时断言 typed in-use 已闭合，而 edge 当前把它塌缩为通用冲突 —— `CONFIRMED`

**owning source（断言方）**：roster `:120-122`——
"The owner in-use condition **is** a typed safe code through edge/generated wire/transport
and renders the fixed copy『该品牌仍被门店使用』"。

**反例（当前字节，四层逐一重开）**

| 层 | 事实 |
| --- | --- |
| owner | `BusinessEntityService:397` `HeadCompanyBrandAuthorizationInUseException extends OrganizationConflictException`，在 `:222`（删除前门店引用）与 `:226`（完整性冲突）抛出 ✓ |
| 契约 | `head-company-management.paths.yaml:717` **已声明** `ORGANIZATION_HEAD_COMPANY_BRAND_AUTHORIZATION_IN_USE` ✓ |
| edge | `ContractProblemAdvice` 的 `conflict` handler（`:87-103`）的 `instanceof` 三元链中**没有该异常的分支**；因其父类 `OrganizationConflictException` 在 handler 列表内，它落到最后的 `else` → **`"PLATFORM_COMMON_VERSION_CONFLICT"`**，detail 为 `"owner readback 已变化，请重新读取后再操作"` |
| transport / Drawer | 因此**永远收不到**该 typed code，固定文案『该品牌仍被门店使用』**无法渲染** |

用户实际会看到"owner readback 已变化，请重新读取后再操作"——**这是错误引导**：
重新读取不会有帮助，该品牌确实仍被门店使用。

**为何是 S 而非 M**：**矫正设计本身是对的**，`:38-40` 明写
"P6-3 **must add** an explicit owner-exception → edge 409 generated code mapping for that closed condition;
**generic conflict fallback is not sufficient**"，并在 `:74` 把"删除该显式 typed in-use 映射"列为必需红变异。
也就是说设计层面**已把它正确界定为 P6-3 的未来义务并点名了当前缺陷**。
错的只有 roster 的**现在时**表述——而 roster 是 P6-2/P6-3 exit 分母的绑定工件，
若照其字面理解，会得出"该链已闭合"的结论。

**最小修复**：roster `:120-122` 改为未来义务表述（与矫正设计 `:38-40` 同口径），
例如"the typed in-use code **is a P6-3 implementation obligation**; current edge collapses it to
`PLATFORM_COMMON_VERSION_CONFLICT`"。纯时态与事实对齐，不改设计。

---

## 5. N（观察项，不阻塞）

**N1 ｜`capability-invariants` 的 typed-owner-exception 门对子类塌缩是盲的**

本会话实跑：`P3_A_TYPED_PROBLEM_OWNER_CONSUMPTION=MAPPED=83:NOT_REACHABLE=0:UNMAPPED=0`，
`P3_A_TYPED_PROBLEM_OWNER_EXACT_INVENTORY=EXACT_SET=83`，且
`tools/capability-invariants/cli.mjs` 中**不含** `HeadCompanyBrandAuthorizationInUse` 任何引用。

因为父类 `OrganizationConflictException` 已被映射，子类即被计为"已覆盖"。
**这正是 `S1` 能在全绿门下存活的原因**：那道门本应捕获"typed owner exception 未映射"，
但它按类计数而不按**最具体的抛出类型**计数。
建议在 P6-3 实现该映射时，同步把该门改为按实际抛出的最具体异常类型对账，
否则同类塌缩会继续发生。

**N2 ｜"旧 bulk-operation 静态断言"的移除目标未指名**

roster `:112-113` 与矫正设计 `:73` 都要求移除"stale bulk-operation architecture assertion"，
但我在 `tools/capability-invariants/cli.mjs` 与 `tools/verify-gates/cli.mjs` 中 grep `bulk` **零命中**，
无法定位该断言实体。建议在矫正设计中写出确切文件与断言标识，
否则 removal-only 的 receipt set 无法被验证为完整。

**N3 ｜`HeadCompanyBrandAuthorizationActionAdapter.ts` 无 import 契约**

它在 roster `:111`、granularity manifest `:815-816`、矫正设计 `:48` 均有落点，
但**不在** `physical-screen-import-contracts.md` 中。该文件被指定为
"authoritative per-screen import-equality denominator"；adapter 是 nonvisual 模块，
按 screen 分母确实可以不入表，但它承载 transport/adapter state 与
`errorCode`-only 约束，其 import 集合目前无任何机械对账。
建议在 physical 文件补一节 nonvisual module 契约，或在 roster 明写其 import 对账归属哪一行。

---

## 6. 处置

`M=1 / S=1 / N=3` → **NO-GO**。

- **无需 Dexter 产品裁决**。M1 的正解是登记 GAP（与门店同形）并在实现期补 owner 重载；
  S1 是把 roster 的时态与矫正设计对齐；N1–N3 是门口径、断言指名与 nonvisual 契约。
- **M1 与 S1 是同一族**：两处都是"契约已声明 / owner 已具备 / edge 未闭合"，
  而 roster 用现在时把它们写成已闭合。建议同一轮修完，并在 roster 建立一条规则——
  **凡 owner→edge→wire→transport 未逐层验证的属性，一律写为 obligation 而非 fact**。
- `§1`/`§2` 已验证关闭与为真的部分**不得回退**：
  app-substrate 排除规则、`key={session.contextVersion}`、RTK 单一 api/store、
  contextVersion 刷新链、四个 operation 的精确集合、状态机五条、transport code-only。

**本复核不授权**：implementation、契约或生成物修改、动态运行、DEV、seed/reset、
Roadmap 状态变更或任何仓库控制操作。
