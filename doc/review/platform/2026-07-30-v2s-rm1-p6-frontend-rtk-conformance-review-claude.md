---
title: RM1 P6-1 / P6-2 前端 RTK-Redux 规范符合性与上下文切换刷新链复核（Claude）
reviewTarget: DESIGN
scope: P6-1/P6-2/P6-3 前端详设对本仓 RTK/Redux 实际规范的符合性；运营管理后台切任职/切数据范围的刷新链正确性
verdict: NO-GO
findings: M=1 / S=3 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅静态复核；不授权 implementation、契约/生产源码/测试修改、动态运行、DEV、seed/reset、Roadmap 状态或任何仓库控制操作
createdAt: 2026-07-30
---

# P6 前端 RTK/Redux 规范符合性与上下文切换刷新链复核

## 0. 结论

**NO-GO**，`M=1 / S=3 / N=2`。

两个问题分别回答：

- **P6-1 符合规范**：其前端 change surface 只有 `apps/frontend/*/src/app/api/generated`，
  正对应"endpoints 全由 generator 产生、手写零 endpoint"。无 store/slice 改动。
- **运营后台切任职 / 切数据范围的刷新链是对的**（`§2` 逐段验证），
  但**正确性挂在一条无人守护的隐含不变量上**，且**切上下文后分页不重置**，会让用户看到空列表。
- **P6-2/P6-3 的 physical import 契约有一处实质不符（M1）**：
  把两个 **app-substrate 专用**的 foundation export 声明成了**页面级** primitive，
  照做会逼实施者写出违反现有前端架构门的代码。

---

## 1. 本仓 RTK/Redux 的实际规范（从生产字节反推）

| 约定 | 证据 |
| --- | --- |
| 每个 app 恰好一个 `createApi` | `PlatformApi.ts:47`、`OperationsApi.ts:47`；`reducerPath: 'platformApi'` |
| store 只装 api reducer + api middleware | `PlatformStore.ts` / `OperationsStore.ts` 全文各 5 行 |
| **除 RTK Query 缓存外没有任何 Redux 状态** | 全仓 `createSlice` / `useSelector` / `useDispatch` = **0 文件** |
| endpoints 100% 由 generated slice 产生 | `endpoints: (build) => createPlatformAdminRtkEndpoints(build, toWireRequest)` |
| 单一标签 + 粗粒度扇出 | `tagTypes: ['wire']`；`platform-edge.rtk.ts:344` `invalidatesTags`、`:372` `providesTags`，均为 `[{wire, operationId}, {wire, LIST}]` |
| 读走生成 hook，写走命令式 client | 读 `operationsRtk.use<OperationId>Query(...)`；写 `operationsClient.<op>()` → `PlatformTransport.ts` 的 `execute` → `store.dispatch(endpoint.initiate(request)).unwrap()` |
| 传输边界由机器门守 | `tools/verify-gates/cli.mjs:146` `R5_FRONTEND_RAW_API_IMPORT_ESCAPE`（`*Api` 只许 4 个 app 文件 import）；`:148-149` `R5_FRONTEND_RAW_WIRE_ENDPOINT_ESCAPE`（`.endpoints` 只许出现在两个 `*Transport.ts`） |
| app 级选中态用 React state | `platform-admin/src/app/state/WorkspaceScope.tsx` 是 `useState` + render-prop，不是 Redux |

---

## 2. 切任职 / 切数据范围的刷新链 —— `CONFIRMED 正确`

本会话逐段追踪，机制是 **cache-key 变化**，不是 tag 失效（与写后 `{wire, LIST}` 扇出是两套并行机制）：

1. **owner CAS + 递增**
   - 切任职 `WorkspaceAuthenticationService:105`：
     `UPDATE … SET current_assignment_id=?, visible_data_node_id=NULL,
     context_version=context_version+1, authorization_revision=authorization_revision+1
     WHERE id=? AND context_version=?`
   - 切范围 `:119`：`SET visible_data_node_id=?, context_version=context_version+1, … WHERE id=? AND context_version=?`
2. owner 返回**完整新 entry** → `onEntry = setEntry`（`OperationsApp.tsx:124`）
3. `queryContext` useMemo 重算（`OperationsApp.tsx:47-52`，deps 含
   `assignmentId / contextVersion / groupWorkspaceKey / visibleDataNodeId`）
4. 页面 `listRequest` useMemo 重算（如 `StoreManagementPage:220-225`，deps 含 `expectedContextVersion`）
5. `operationsRtk.useGetOperationsOrganizationStoresQuery(listRequest)`（`:227`）拿到新 arg
   → RTK Query 以序列化 arg 为 cache key → **新 key，自动重取**

**两处值得记的优点（不得回退）**：

- `context_version` **单调递增**，不可能回退到旧 key，因此**不会回闪上一个范围的数据**；
- 切任职时 owner 主动把 `visible_data_node_id` 置 NULL，前端 `scopeRef` 随之为 undefined，
  依赖范围的页面自动回到"请先选择范围"（`ContractManagementPage:76`）。

RTK/Redux 用法本身也合规：session 是 React state，读用生成 hook，写用 client，
`.endpoints` 只出现在 `OperationsTransport.ts`。

---

## 3. M1 ｜physical import 契约把 app-substrate 原语声明成页面级 primitive —— `CONFIRMED`

**owning source**：`doc/evidence/platform/rm1/p6/rm1-u09-physical-screen-import-contracts.md`

| export | 全仓实际消费者 | physical 契约中声明的行数 |
| --- | --- | --- |
| `createObservedBaseQuery` | **仅** `PlatformApi.ts:3,45` 与 `OperationsApi.ts:3,47`（即 app 的 baseQuery） | **4** |
| `platformHttpProtocol` | **仅 foundation 自身**：`observedBaseQuery.ts:3,6,7,8` 与 `foundation.test.ts`；**app 侧 0** | **7** |

受影响 screen：`IA01-PLATFORM-LOGIN`、`IA01-PLATFORM-RECOVERY-VERIFY/PASSWORD/COMPLETE`、
`IA01-OPERATIONS-LOGIN`、`IA05-RECOVERY-VERIFY/PASSWORD/COMPLETE`、
`IA01-PUBLIC-INVITATION` 四步、`IA02-PLATFORM-WORKSPACE-CONTEXT/SIDER-CONTROL`、
`IA02-OPERATIONS-AUTHENTICATED-SHELL` 一组——**几乎全是未认证入口与 shell**，
恰恰是最必须走统一 transport 的那批。

**反例（后果链）**：P6 预备稿 `§4.2` 要建的 import-equality gate 会**要求**这些 import
真实出现在这些文件里。照做即：

- 页面里出现 `createObservedBaseQuery(...)` = 在单一 `createApi` 之外**再造一条 baseQuery**，
  直接破坏"每 app 一个 api、store 只装一个 reducer"的既有架构；
- 页面里出现 `platformHttpProtocol` = **页面自己拼 correlation / request / trace header**，
  绕过 `*Transport.ts` 边界，与 `R5_FRONTEND_RAW_API_IMPORT_ESCAPE` 的意图正面冲突。

**这与上一轮 `S3`（判别式建反）是同一失败模式：门建反了，照做会把对的代码改错。**

**适用边界**：`contextScopedQueryArgs`、`useDetailDrawer`、`useDrawerFormLifecycle`、
`useSubmissionLifecycle`、`adminDrawerSurfaceProps`、`testId` 这些**是**页面级原语，不在本条范围内。

**最小修复**：这 11 处从页面行移除。`platformHttpProtocol` 全部删除（app 层本就不该直接用）；
`createObservedBaseQuery` 若要保留，只能挂在 `PlatformApi.ts` / `OperationsApi.ts` 这类
app-substrate 行上——而这两个文件当前**不在** physical 契约的分母里，需要一并补行或明确排除。

---

## 4. S1 ｜切上下文后分页不重置，用户会看到空列表 —— `CONFIRMED`

**owning source**（current bytes，逐页核对 `setPage` 的全部调用点）：

| 文件 | page state | `setPage` 调用点 |
| --- | --- | --- |
| `StoreManagementPage` | `:207-208` | **仅** `:292` Pagination.onChange |
| `ContractManagementPage` | `:247-248` | **仅** `:330` |
| `WorkspaceUserPage` | `:35-36` | **仅** `:126` |
| `BrandManagementPage` / `TenantManagementPage` / `HeadCompanyManagementPage` | `:220` / `:212` / `:252` | 同形 |

没有任何 `useEffect` 在 `contextVersion` 变化时 `setPage(1)`；
`OperationsApp.tsx:56` 的 `<registration.Component queryContext={…}/>` 也**没有 `key={contextVersion}`**，
所以切上下文不会 remount 页面、不会重置 page state。

**反例（用户可见）**：在大区 A 翻到第 3 页 → 切到大区 B（该范围只有 1 页数据）
→ 新请求带 `page=3` → **返回空列表**。用户会理解成"这个大区没有数据"，
而不是"我停在第 3 页"。数据本身是正确作用域的，不构成越权或脏读。

**为什么同时是 P6 设计缺项**：P6-3 要新增 5 个用户页与组织/门店/合同页，
全部吃同一条链；roster 该行只写了
`dirty guard and upstream selection clear dependent state`，**没有一个字**要求
上下文变化时重置分页。新页面几乎必然复制同一行为。

**最小修复**：在共享位置一次性解决，不要逐页补——
`OperationsApp.tsx:56` 给内容组件加 `key={session.contextVersion}`（切上下文即 remount，
page/筛选/展开态一并归位），或在各页加一个以 `queryContext.expectedContextVersion` 为 dep 的
`setPage(1)` effect。前者更小且覆盖所有本地视图态。
P6-3 roster 相应行补一句"上下文变化必须重置分页与本地视图态"，并配 red。

---

## 5. S2 ｜刷新正确性依赖一条无人守护的隐含不变量 —— `CONFIRMED`

**owning source**：`StoreManagementPage:220-225` 的 `listRequest` useMemo，
deps 为 `[page, pageSize, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]`
——**不含 `scopeRef`、不含 `identityKey`**。其余列表页同形。

也就是说：**页面的 cache key 只随 `groupWorkspaceKey + contextVersion` 变化**。
今天之所以正确，完全依赖 owner 侧那条不变量——
**"任何改变 assignment 或 visible data node 的路径都必须 `context_version+1`"**。

**反例边界**：只要将来出现一条改范围/改任职但不 bump version 的 owner 路径
（例如 P6-1 新增的恢复流在 owner 侧顺手调整 session、或某次为省一次写而跳过 bump），
页面将**静默不刷新**——展示上一范围的数据，而没有任何提示。
这类缺陷在 UI 上不可见，只能靠 owner 侧不变量保证。

**当前无任何控制守护它**：`§2` 那两条 SQL 是唯一实现；
没有 focused test 断言"selectContext/selectDataNode 必须使 contextVersion 严格递增"，
P6 设计与 roster 也未把它列为不变量或 red。

**最小修复**：在 P6-3 的 focused proof 里补一条 owner 侧 red——
"移除 `selectDataNode` 的 `context_version+1` 后，
断言前端 list 请求的 `expectedContextVersion` 不变、页面不重取 的用例必须失败"；
并在 roster 该行写明"contextVersion 是读缓存键的唯一上下文来源"。
**不建议**改成把 `scopeRef` 也塞进 listRequest——那会让同一份数据出现两个 cache key，
且掩盖 owner 侧真正的不变量。

---

## 6. S3 ｜P6 前端详设完全没有描述读写形态与缓存策略 —— `CONFIRMED`

三份材料（三步计划、roster、physical 契约）中，**没有任何一处**说明：

- 哪些读用 `use<OperationId>Query` hook、哪些写用 `client.<op>()` 命令式 dispatch；
- `tagTypes: ['wire']` 的粗粒度扇出语义——**每个写操作都会让所有已订阅列表重取**；
- P6-1 新增 7 个认证/恢复 operation 后，这个扇出代价是否仍可接受。

P6-2 的 focused proof 只写了"context 缓存扇出失效"一句，**没有说清它的机制**
（`{wire, operationId}` + `{wire, LIST}` 全量失效），也没有把它与 `§2` 的
cache-key 刷新区分开——这是两套并行机制，实施者若混为一谈，很可能在新页面里
自造 `refetch()` 或本地 `refreshKey`，重复已有能力。

**最小修复**：在 roster `§1` 的 common rule 里补两段——
(a) 读=生成 hook / 写=生成 client，禁止页面自造 fetch 或 refetch 循环；
(b) 写后刷新由生成 slice 的 `invalidatesTags` 承担、上下文刷新由 `expectedContextVersion`
进入 query arg 承担，两者都不由页面自行实现。

---

## 7. N（观察项，不阻塞）

**N1 ｜P-U2 选中集团空间的状态机制未定**

physical 契约把 `IA02-PLATFORM-WORKSPACE-CONTEXT / SIDER-CONTROL` 绑到
`PlatformApp.tsx` + `contextScopedQueryArgs, useOverlayLock, createObservedBaseQuery`，
但现有实现是 `platform-admin/src/app/state/WorkspaceScope.tsx` 的 React `useState` + render-prop，
且全仓零 `createSlice`。设计没写明是沿用 React state 还是引入本仓**第一个** Redux slice。

按现状惯例应明确写"沿用 app-owned React state，不新增 slice、不扩 store reducer"，
否则实施期很可能顺手加一个 slice，破坏"store 只装 api reducer"的既有形态。
另注意绑定路径是 `PlatformApp.tsx` 而非现有的 `WorkspaceScope.tsx`，二者关系也需说明。

**N2 ｜`identityKey` 在读路径上是死字段**

`contextScopedQueryArgs.ts` 计算了 `identityKey`（`OperationsApp.tsx:50` 传入 `assignmentId`），
但全前端**零消费**：`scopeRef` 至少被 `RoleHomeBootstrapPage.tsx:19` 展示、
被 `ContractManagementPage:86,97` 当作 `projectId` 使用，`identityKey` 则无任何读取点。

它不产生错误行为（只是多算一个字段），但 P6-3 若照 physical 契约在 12 个新页面声明
`contextScopedQueryArgs`，会把这个死字段一并带过去。
建议在 P6-3 设计中明确 `identityKey` 的处置：要么给出首个真实消费者与业务理由，
要么记为 `DORMANT_WITH_REASON`（参照 P5 对 `createRefreshSignal` 的处置方式）。

---

## 8. 处置

`M=1 / S=3 / N=2` → **NO-GO**（仅就本次复核范围）。

- **无需 Dexter 产品裁决**。全部 finding 都是前端架构与设计声明层面的修正。
- **优先级建议**：`M1` 与 `S1` 先做——`M1` 是"照做会把对的改错"，
  `S1` 是当前用户已能看见的行为缺陷（且共享修复点只有一处）。
  `S2`/`S3` 是把已经正确的机制写进设计并配 red，防止 P6-3 新页面走样。
- **`S1` 的修复触及生产源码**（`OperationsApp.tsx` 或各列表页），
  超出本次静态复核授权；本文件只登记问题与最小修法，**实施需 Dexter 单独授权**。
- `§2` 已验证正确的刷新链（owner CAS 递增、单调版本、切任职清空 scope）
  **不得在整改中回退**。

**本复核不授权**：implementation、契约/生产源码/测试修改、动态运行、DEV、seed/reset、
Roadmap 状态变更或任何仓库控制操作。
