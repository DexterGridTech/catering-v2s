---
title: RM1 P5（RM1-U08）实现独立复核（Claude）
reviewTarget: IMPLEMENTATION
scope: RM1-P5 current bytes
verdict: NO-GO
findings: M=0 / S=1 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅复审 RM1 P5 当前实现与证据；不授权 P6/P3-D、新 Journey/UI、后端/契约/数据变更、DEV、seed、reset 或动态环境
createdAt: 2026-07-29
---

# RM1 P5（RM1-U08）实现独立复核

## 0. 结论

**NO-GO**，`M=0 / S=1 / N=3`。

> **说明**：无 M。判 NO-GO 是因为 S1 是**用户可见的、属于 P5 自身缺陷类**的残留，
> 且**未在任何证据中声明**。若 Dexter 认为该残留可接受并要求登记后放行，
> 本评审不反对——但按"解决了没有"这个标准，它没解决完。

### 先回答 Dexter 的问题：这活到底解决了什么，解决了没有

P5 要修的是既有管理任务的可靠性缺陷（不新增 Journey/页面/接口/数据模型）。
本会话**不看验收清单、直接查这些用户可见的毛病**：

| 原缺陷 | 现状（本会话实测） |
| --- | --- |
| P-R1 会话过期后停在当前页、每个操作弹通用错误、登出不清 store | **已修**：两个 app 各有 `onUnauthorized` + `registerXxxUnauthorizedRecovery` 接线 |
| P-R2 **8 个平台列表页 `loading={!result}` 永久转圈** | **已修**：改为 `loading={isLoading && !result && !problem}`（三态区分），`AccountsPage` / `AdministratorsPage` / `ExtensionsPage` / `WorkspaceAdministrationPage` 等逐一确认 |
| P-R3 换页失败丢上一页 | 已修（`WorkspaceScope.tsx:29` 亦为 `!result && !problem` 正确形态） |
| P-R4 迟到响应覆盖新结果 | **已修**：`generation guard` 落地（残留 local 路径也带 `candidatesGeneration.isCurrent`） |
| P-R5 全仓无 Error Boundary | **已修**：`libraries/frontend/admin-ui-foundation/src/behavior/AdminErrorBoundary.tsx`，两个 app 均接入 |
| P-E4 抽屉开着持续打接口 | 已修（foundation lifecycle） |
| P-Q9 eslint 未覆盖 foundation / 无 react-hooks | 已修（`eslint … --max-warnings=0` 覆盖两 app + foundation，PASS） |
| ST-9 写后刷新三种做法并存 | **实质已收敛**：RTK tag 为唯一权威（139 处 `providesTags`/`invalidatesTags`），但旧机制有死残留（见 N1） |

**核心结论：不是为了凑 GO 的伪迁移。** 15 个读消费者是**真订阅** generated hook
（`useXxxQuery(...)`，见 §1），手写 URL / `fetch` / `axios` 全仓 **0**，
foundation 未被上提 session/router/baseApi。

**但同一缺陷类在 P5 自己动过的 2 个文件里留了 8 处**（S1）——
`<Select loading={!candidates}>`，候选加载失败后下拉**永久转圈**。
这正是 P-R2 的形状，只是从列表页换到了下拉框。

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。
未开第三轮子审查（遵守封顶约定）；本文件为 Claude 独立复核，不属该 cycle 的子 agent 轮次。

**授权边界**：仅复审 RM1 P5 当前实现与证据。不授权 P6/P3-D、任何新 Journey/UI、
后端/契约/数据变更、DEV、seed、reset 或动态环境。

---

## 1. 核验点 1 ｜generated RTK hook 是真订阅，非伪迁移 —— `CONFIRMED`

**owning source**：`apps/frontend/*/src/features/**/ui/*.tsx`

**全量同根扫描**（`apps/frontend/*/src/features`，排除 `node_modules`）：

```
使用 generated Query/Mutation hook 的文件 : 15
手写 fetch( / axios / '/api/ 字面量        : 0
useEffect 内直接调 transport/load 的手动拉取 : 0
```

15 个文件逐一确认为**真订阅**（示例）：

```tsx
useGetOperationsWorkspaceProjectUserQuery(
  operationsAdminRtkRequest.getOperationsWorkspaceProjectUser(path, requestOptions),
  {skip: targetType !== 'PROJECT'});
useListPlatformGroupWorkspacesQuery(listRequest);
useGetWorkspaceAccountsQuery(listRequest);
```

`workspace-user/WorkspaceInvitationPanel.tsx` 10 个、`WorkspaceUserPage.tsx` 5 个，
与 P3 的五 target × 读操作一一对应，**request 由 `operationsAdminRtkRequest.*` 生成器产出**，
未手写 operation id / method / URL。

**反例搜索**：检索 `RefreshSignal` 的**订阅**侧 `useRefreshVersion` ——
生产代码中**零消费者**（见 N1）。故不存在"RefreshSignal 驱动 local load"的伪迁移路径。

---

## 2. 核验点 2 ｜transport 边界与 foundation 未被上提 —— `CONFIRMED`

feature 只经 app-owned transport 消费生成的 request/hook：
`operationsAdminRtkRequest` / `platformAdminRtkRequest` 由 app 层 `*Api.ts` / `*Transport.ts` 提供。

**foundation 未被上提**（`libraries/frontend/admin-ui-foundation/src` 全量检索
`createApi` / `configureStore` / `BrowserRouter` / `useNavigate` / session 实体）：
仅 3 处**注释**提及 session/location 策略，且措辞明确为"app-owned policy"：

```
AdminErrorBoundary.tsx:28   "… reset location and session policy; foundation …"
observedBaseQuery.ts:28     "/** App-owned policy for an unauthenticated … */"
```

无任何 `createApi` / store / router 实体落在 foundation。`scripts/check/frontend-architecture` 实跑 **PASS**。

---

## 3. 核验点 4/5/6 ｜exact-set、证据 hash、机械复跑 —— `CONFIRMED`

| 项 | 结果 |
| --- | --- |
| `actualChangedPaths` / `incrementalChecks` | **56 / 56，exact-set `True`** |
| `sourceComplianceDisposition` 绑定文件 hash | 声明 `68af37d718bae92b…`，**复算一致** |
| source-compliance 分母 | **28 行**（与来件一致） |
| focused frontend evidence 的 `currentSourceHashes` | **7 条逐条复算，0 不符** |
| `rm1-evidence-truth-self-test` | PASS，且**含**并通过 `RED_CURRENT_SOURCE_HASH_DRIFT=PASS`、`RED_EVIDENCE_LOG_HASH_DRIFT=PASS`（另有 5 条 RED 一并 PASS） |
| `edge-codegen.mjs --check` | PASS |
| `scripts/check/frontend-architecture` | PASS |
| `scripts/check/standards-coverage --phase R5` | PASS |

focused evidence 的 `execution` 记录了 7+2+6 个前端测试、typecheck 与
`eslint … --max-warnings=0`，均 PASS——**动态执行真实存在，非静态 hash 冒充**。

> `validate-package-exit` / `validate-delta-receipts` / `static-scan` 三条在真仓会因
> 本次评审 prompt 自身的 problem-intake 而红（与前几轮同型，属会话副作用）；
> 本轮以上述逐项复算 + 各专项门实跑替代，未影响任何结论。

---

## 4. S（应修复）

### S1 ｜P5 自己动过的两个文件里，`loading={!candidates}` 残留 8 处，失败后下拉永久转圈

**owning source**
- `apps/frontend/operations-admin/src/features/store-management/ui/StoreManagementPage.tsx:141,144,147,150,200`
- `apps/frontend/operations-admin/src/features/contract-management/ui/ContractManagementPage.tsx:170,178,237`

**反例搜索范围**：`apps/frontend/*/src` 全部 `*.tsx`（排除 `node_modules`），
精确匹配 `loading={!candidates}` → **8 处，集中在上述 2 个文件**。

**为何是缺陷（而非误报）**：

```tsx
// StoreManagementPage.tsx:48
const [candidates, setCandidates] = useState<OrganizationStoreCandidatePage>();   // 非 RTK hook
// :77-78
.catch((error) => { if (candidatesGeneration.isCurrent(request)) setProblem(issue(error)); });
// 失败路径不 set candidates → candidates 永远 undefined
// :141
<Select loading={!candidates} options={options(candidates?.projects ?? [])}/>     // 永久 loading
```

失败后 `candidates` 保持 `undefined`，`loading={!candidates}` **恒为 true**——
项目 / 品牌 / 租户 / 总公司 / 分期这几个下拉**一直转圈**，用户无法判断是慢还是已经失败。

**对照证明这是可修的、且同仓已有正确形态**：

```tsx
// platform-admin/src/app/state/WorkspaceScope.tsx:29
loading={!result && !problem}                      // 考虑失败态
// platform-admin/.../AccountsPage.tsx:83 等 4 处
loading={isLoading && !result && !problem}         // 三态区分
```

**为何不是 N（而是 S）**：

1. **这两个文件都在 P5 的 `actualChangedPaths` 内**——P5 动过它们，未修此处；
2. 这正是 P-R2 的缺陷类（"失败与空结果都永久转圈"），是 P5 的**核心目标之一**；
3. **未在任何证据中声明**——检索 exit / amendment / focused evidence 中
   `candidate` / `deferred` / `out-of-scope`：**命中 0**。既未修，也未登记为已知残留。

**为何不是 M**：用户不会静默失败——`:131` 的 `{problem && <Alert type="error" …/>}`
会显示错误横幅，且 `candidatesGeneration` 的 generation guard 已就位。
用户看到的是"错误提示 + 仍在转的下拉"，属体验残留而非功能不可用或数据错误。

**最小修复**
1. 8 处改为区分失败态，例如 `loading={!candidates && !problem}`
   （与 `WorkspaceScope.tsx:29` 同形），或把这 4 处 candidates 读取
   迁到 generated Query hook 并用其 `isLoading`/`isError`；
2. 加一条机械控制：`apps/frontend/**` 中 `loading={!<identifier>}`
   若该 identifier 无对应失败态判定即具名红。
   红变异 = 把任一处改回 `loading={!x}`，门必须红。
   **缺这条，同类残留会随新页面再次出现**——本轮 8 处即是明证。

**是否需要 Dexter 产品裁决**：**否**（实现缺陷）。
但"本轮修 vs 登记后随 P6 修"属排期，可由 Dexter 一句决定。

---

## 5. N（观察项，不阻塞）

**N1 ｜`refreshSignal` 发布端仍在，订阅端为零——ST-9 的旧机制死残留**

```
PlatformTransport.ts:39    if (request.method.toUpperCase() !== 'GET') platformRefreshSignal.publish();
OperationsTransport.ts:42  同形
useRefreshVersion 的生产消费者：0（仅 foundation 定义与 export）
```

RTK tag 已是唯一权威（139 处 `providesTags`/`invalidatesTags`），
故**不构成功能缺陷**；但每次写操作都向无人订阅的信号 publish，
是 ST-9 "三种做法并存"的残留物。建议删除发布端与 foundation 的
`createRefreshSignal`/`useRefreshVersion`，使"写后刷新"只剩一处实现。

**N2 ｜P-R6（登出失败仍清本地会话）未能在本会话直接定位到实现**

检索 `logout`/`signOut` 与 `catch`/`finally`/`clear` 的组合无命中。
401 恢复链（`onUnauthorized` → `registerXxxUnauthorizedRecovery`）确已存在，
但"主动登出且请求失败"这一支未验证。标 `UNVERIFIED`，建议作者指明实现位置或补断言。

**N3 ｜本会话未重跑前端测试**

`yarn` 工作区未在本会话执行。前端测试结果（foundation 7 / platform 2 / operations 6、
typecheck、eslint）以 focused evidence 的记录 + 其 7 条 `currentSourceHashes`
逐条复算一致为依据。标 `VERIFIED_BY_ARTIFACT_NOT_BY_RERUN`。
S1 与 N1 均为**静态可判**，不依赖运行。

---

## 6. 处置

| finding | 性质 | 处置 |
| --- | --- | --- |
| S1 | 用户可见残留，属 P5 自身缺陷类，未声明 | Codex 修复（8 处 + 一条机械控制）；排期可由 Dexter 定 |
| N1–N3 | 观察 | 不阻塞 |

**再复核条件**：S1 闭合（8 处修正 + `loading={!x}` 的机械控制并验红），
或 Dexter 明确裁定登记后随 P6 处置。

**本复核不授权**：P6/P3-D、新 Journey/UI、后端/契约/数据变更、DEV、seed、reset、动态环境。
