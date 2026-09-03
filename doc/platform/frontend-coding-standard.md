# 前端编码规范 · 唯一权威

> **这是前端编码规范的唯一内容源。** 其他地方(项目记忆、skill、评审文档)**只放指针,不复述内容**。
>
> **每条规则至少两段:禁止句 + 反例。** 无反例者不进本文。
> **第三段"仓内正例"是分级要求**:有正例的规则,整改指令是「照那一处改」;
> **无正例的规则标注 `未验证`,整改时要建立正例,不得照抄任何现有写法**。
>
> ⚠️ **正例必须逐个打开验证过**。2026-08-16 对抗审查发现:本文曾把一个**裸 `catch {}`** 举为
> 「提交失败」的正例,而同一份文件的另一条规则正好禁止它 —— **两条规则对同一行给出相反指令**,
> 若照抄会把该缺陷复制到两个 App 的每个抽屉。**举正例前必须验证它在本规则自己的反例下行为正确。**
>
> **上限**:本文超过"半小时读完",或门超过"分钟级",就是在重建刚退役的那套控制面。

---

## 0 · 怎么用这份文件

|              |                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------- |
| **规则来源** | 2026-08-16 一轮六路逐文件评审,212 个手写文件,113 条 finding,全部经第二轮独立验证            |
| **实例台账** | `doc/review/platform/2026-08-16-v2s-frontend-findings-ledger-claude.md`                     |
| **版本基线** | React 19.2.5 · RTK 2.12.0 · react-redux 9.3.0 · antd 6.5.0 · react-router 7.18.1 · TS 6.0.3 |
| **门的清单** | `tools/verify-gates/cli.mjs`(44 条前端断言)· `scripts/verify`                               |

⚠️ **版本对不上的"官方用法"结论一律作废。** 本文所有 antd/RTK 判断均针对上表版本。

---

## 1 · 门的形态(最重要的一条元规则)

### 1-0 · 门只写禁止句

**规则**:门断言的必须是「某文本**不得**出现」。**不得**用「某文本**必须**出现」代理行为正确。

**为什么**:被禁的东西本身就是文本(import 路径、API 名、废弃标识符)时,正则判的就是它自己,**不是代理** —— 违反必红,不会假绿。
而「源码里有这个字符串」永远只是行为的代理:换个写法就**假红**,改坏行为但保留字符串就**假绿**。

**反例**:`assert.match(source, /useState\(20\)/)` —— 把局部变量重命名会红,把 `useState(20)` 留着而逻辑改坏会绿。

**仓内正例**:`tools/verify-gates/cli.mjs` 的
`assertNoMatch(sourceFiles("apps/frontend/operations-admin"), /platform-admin\/src/, "R4_FRONTEND_CROSS_APP_IMPORT")`
—— 被禁的是 import 路径,**本身就是文本**,正则判的就是它自己。

**⚠️ 禁止句也可能是假门 —— 判据要多一条:被禁的东西必须是"编译器不会先拦下"的。**
反例:`R5_FRONTEND_GENERIC_CLIENT_INVOCATION` 禁 `/\b(?:platformClient|operationsClient|publicClient)\s*\(/`,
但 `operationsClient` 是 `createOperationsAdminClient(...)` 的返回**对象**,当函数调是 TS 错误
⇒ **该正则只能匹配已经 `tsc` 报错的源码,永远不会是先红的那道门**。

**仓内实测的分布**(这条规则不是主张,是从字节里读出来的):

|                                  | 禁止性                       | 存在性                 | 禁止占比  |
| -------------------------------- | ---------------------------- | ---------------------- | --------- |
| `verify-gates/cli.mjs`(真门)     | `assertNoMatch` **34**       | `assertMatch` **7**    | **82.9%** |
| `tests/architecture/*.mjs`(假门) | `assert.doesNotMatch` **42** | `assert.match` **175** | **19.4%** |

**倒置成立。**

> ⚠️ **计数口径更正(2026-08-16 对抗审查)**:原文写「35 / 8」并把表头写成 `assert.match` ——
> 但 `cli.mjs` 里 `assert.match` 命中数是 **0**,它用的是自定义的 `assertMatch` 辅助函数;
> 且 35 与 8 都把**函数定义那一行**数了进去,真实调用点是 34 与 7。
> **原文把两个不同的函数族放在同一个表头下比较** —— 结论(倒置)不受影响,但
> 「这条规则不是主张,是从字节里读出来的」这句话的权威性建立在没数准的字节上。

**门**:**存在性断言不得单独承载约束**。允许两种形态:

1. 与禁止性断言**配对**(存在性负责"该有的有",禁止性负责"不该有的没有")
2. 换成行为测试

**⚠️ 判据不是"归零"(2026-08-16 对抗审查更正)**。原文写的是「`assert.match` 归零」,
实测 `default-list-page-size.test.mjs` 是:

```js
assert.match(source, /useState\(10\)/, path); // 该有的有
assert.doesNotMatch(source, /useState\(20\)/, path); // 不该有的没有
```

**配对使用。归零存在性那半,只剩「不是 20」——`useState(50)` 就过了**,默认页长这条约束变成无人守。
**先归零后补行为测试的顺序,会制造一段没有覆盖的窗口期。**

### 1-1 · 行为主张必须用行为测试

**规则**:「这个组件在某情况下会怎样」这类主张,**不得**用源码文本断言表达。

**反例**:名为 `static-boundary.test.mjs` 的 "icon-mapped" 测试通过,而它对图标表**零断言**。

**现有能力(⚠️ 2026-08-16 对抗审查更正,原文在此处犯了 §4-A)**:

| 有的                                                                     | 没有的                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| **Playwright L2:两个 `playwright.config.ts` + 19 个 spec,真实 Chromium** | `jsdom` / `happy-dom` / `@testing-library` 全域 0 命中                    |
| 用的是同一套 `testId()` 选择器(全仓 104 处)                              | 单元层渲染测试走 `renderToStaticMarkup`,**effect 不跑、remount 观察不到** |

**原文写的是「都没有 DOM 环境…必须先补」—— 那是搜了三个包名没命中就下的断言,
没查 Playwright,正是 §4-A 点名的否定式全称命题失败模式,发生在本规范内部。**

**正确的判断**:本条要保护的行为(输入框失焦、loading 转换、重复 HTTP、错误渲染帧)**Playwright 都能观察**。
所以路线是**先扩已有的 L2 lane**;只有当某条行为在 L2 里成本过高(需要真实后端 + DB 才能构造)时,才考虑补单元层 DOM 环境。
⚠️ **不得在未做这个比较之前预授权新增基建。**

**仓内正例**:`app/api/operationsProblemFeedback.test.ts`(对生成的 `EDGE_PROBLEM_CODES` 做全集对账 + 断言文案不泄漏技术细节)、
`app/components/OperationsRequiredScopeSurface.test.tsx`(真渲染 + 断言 gated 子树不挂载)。

---

## 2 · 能成门的四类

### 2-A · 一个名字只能有一种失败语义

**规则**:同名函数不得在不同模块有相反的失败行为。

**反例**:两个 `wireUuid` —— `admin-ui-foundation/src/http/wireUuid.ts:8` 校验失败**抛 `WIRE_UUID_REQUIRED`**,
`catalog-management/model/catalogModel.ts:804` 是 `text(value) as Uuid` **静默放行**。

**后果实例**:`InventoryDetailDrawer` 用了抛错版且在组件体顶层无条件求值 → **门店库存页首屏白屏**(FE-001)。

**门**:同一标识符名在 `apps/frontend` + `libraries/frontend` 下只允许一处 `export`。

### 2-B · 同一个正则/常量不得多处各写一遍

**规则**:校验正则、业务常量必须单点定义。

**反例**:手机号正则三处各写一遍(`OperationsLoginPage.tsx:111` · `PublicInvitationOtpStep.tsx:9` ·
`WorkspaceInvitationCreateDrawer.tsx:165`),其中第三处是 `/^1\\d{10}$/` —— **多了一个反斜杠**。

**后果实例**:五个用户管理页的「发出邀请」**永远提交不了**(FE-002)。`od -c` 确认源码字节即为两个反斜杠。

**门**:`assertNoMatch` 禁止在 `features/` 下出现手机号/邮箱等校验正则字面量。

### 2-C · React key 不得由用户可编辑的字段拼成

**规则**:`key` 的每个组成部分,在同一子树内**不得**存在编辑它的输入控件。

**反例**:`CatalogItemDrawer.tsx:947` ``key={`${sku.skuCode}-${skuIndex}`}`` 而 `:950` 就是 `value={sku.skuCode}` 的 `<Input>`。

**后果实例**:每敲一个字符 key 变 → React 卸载重建子树 → **输入框失焦**。新建 SKU 敲 `LATTE-L` 要点 7 次。
三处(`:947` · `:1017` · `:860`)**都在创建路径上**(已落库 SKU 的编码是 disabled 的)。

**门**:`assertNoMatch` 禁止 `key={` 模板串内出现 `.code`/`.kind`/`.skuCode` 等已知可编辑字段名。
⚠️ 这条门是启发式,会有假阳性,**只在 `features/**/ui/` 下开**。

### 2-D · 格式

**规则**:排除生成物后,**>120 字符的行归零**。

**当前**:2,676 行 >120 · 1,069 行 >200 · 最长单行 **3,729 字符**(`CatalogItemDrawer.tsx:744`)。
密度 15.4%,**高于后台**。全仓 `prettier`/`biome`/`oxlint` **零命中**,只有 eslint。

**门**:`prettier --check`(或等价工具)

⛔ **必须排在 1-0 之后** —— 175 处存在性断言不清零,一次重排会弄红一堆与格式无关的"架构边界"测试。
**这是前端独有的顺序约束,后台没有。**

---

## 3 · 只能靠 review 的几类(靠语义判断,做不成门)

### 3-A · 同一件事只能有一种写法

**规则**:同一职责在两处出现不同写法时,以**仓内已写对的那处**为准,另一处改齐。

**已登记的 16 组**见台账第五部分。其中最锋利的:

| 事                            | 写对的那处(正例)                                                                                            | 写错的那处                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 表格 loading                  | ⚠️ **无干净正例,见下**                                                                                      | O 段 7 处用 `isLoading`(有旧数据时**永不为 true**)                    |
| List 级校验错误               | `ContractCreateDrawer.tsx:56` `rules` + `Form.ErrorList`                                                    | `ProjectPhaseFieldList` 丢弃 `{errors}`,是全仓唯一一处                |
| hook 返回值 memo              | `useSubmissionLifecycle.ts:16-20`(专门写了注释说明为什么)                                                   | `useDetailDrawer.ts:24` 返回裸对象字面量                              |
| `expectedVersion` 取哪版      | 11 处取「用户当时看到的那版」                                                                               | `PlatformInvitationPanel.tsx:118` 提交前重读,**把乐观并发保护删掉了** |
| 提交失败 · **保留抽屉与输入** | `ContractEditDrawer.tsx:catch` 非版本冲突分支 `setProblem(feedback.detail)`                                 | 失败时强制关闭抽屉、丢稿或继续提交                                    |
| 提交失败 · **保留服务端原因** | `ContractEditDrawer.tsx:catch` 先 `operationsProblemOf(error)`，仅 `CONTRACT_VERSION_CONFLICT` 进入冲突分支 | `catch` 丢弃 error 或把所有失败改写成无关的通用原因                   |

> ✅ **ContractEditDrawer 现为两半同时满足的正例**(2026-08-16 remediation)：它先保留
> `operationsProblemOf(error)` 的服务端原因；只有明确的 `CONTRACT_VERSION_CONFLICT` 才进入冲突处置，
> 其他失败保持抽屉和输入并渲染 `feedback.detail`。不得因“有正例”而复制其具体业务分支，仍须按错误语义判定。

> ⚠️ **表格 loading 这一行的正例已撤回(2026-08-16 对抗审查)**。
> 原文举 `CatalogWorkbenchPage.tsx:424`,**三个问题叠在同一处**:
>
> 1. **截断引用** —— 真实调用是
>    `adminListState({loading: itemsQuery.isFetching && scopeReady, failed: failed || !scopeReady || noAuthorizedBrand, ...})`,
>    而 **`failed` 才是让空态/失败态互斥的那个参数**(`adminListState.tsx:15` 是
>    `emptyText: loading || failed ? null : <Empty/>`)。我引的那半正好把机制藏掉了。
> 2. **`&& scopeReady` 是死代码** —— 该文件 5 个 query 全带 `skip: !scopeReady`,而被 skip 的 RTK query
>    `isFetching` 恒为 false。照抄的人会加一个永远不改变取值的守卫。
> 3. **周围 30 行是 §3-E 违规** —— `acceptedPage` 本地 state 镜像 `currentData`,
>    表格读 `page = acceptedPage ?? {...}` 而 loading 读 query。**同一个事实两个住址。**
>
> **正确做法**:`loading` 用 `isFetching`、`failed` 独立传入、**不要镜像进本地 state**。
> 这三件事仓内没有一处同时做对,本行状态为 `未验证`。

**为什么不做成门**:判断"这两处是不是同一件事"需要理解语义,做成关键词匹配就会变成"门全绿而功能是坏的"。

### 3-B · 读 RTK 数据用 `currentData`,判加载用 `isFetching`

**规则**:换 arg 的场景下,`data` 与 `isLoading` **不得**用于渲染。

**反例**:`WorkspaceUserPage.tsx:152` 用 `activeDetailQuery.data` —— RTK 2.12.0 实测
`data = isSuccess ? currentState.data : lastResult?.data`,`lastResult` 是不清的 `useRef`。
→ 点李四时抽屉里显示的是**张三的姓名、账号、任职机构和角色**,撤销任职按钮挂在张三的 assignment 上。

**判别式(不是「凡 `.data` 都改」)**:问一句 —— **这个 query 的参数,来自会变的组件 state 吗?**
来自 state(tab / 分页 / 筛选 / 选中行)⇒ 必须 `currentData`;参数固定(会话、常量)⇒ `.data` 正确,不要改。
⛔ **不能做成门** —— 门分不清参数是否会变,禁止 `xxxQuery.data` 会误伤合法用法。

**当前分母(2026-08-17 实测)**:`currentData` **98 处** · query 结果读 `.data` **33 处**。
⚠️ **那 33 处不是 33 个 bug**,需逐处套判别式。
已知正确:`OperationsApp.tsx` 的 `sessionEntryQuery.data`(参数固定)。
已知需判:`PlatformReadPage.tsx` 多处参数来自 `hierarchyNodeId` 等 state。
**尚未逐处核完,不得宣称「已清理」。**

**新增正例(2026-08-17)**:`CatalogDictionaryDrawer.tsx` 的 `productionQuery.currentData?.data`
配 `loading={xxxQuery.isLoading || xxxQuery.isFetching}` ——
Dexter 在 DEV 体验时报出「切 tab 后内容漂移回上一个 tab」,根因即读了 `data`,Codex 按本条修复。
**这是本条从「有反例无正例」变成「有正例」的一次。**

**最重的一处**:`StoreProfilePage` 四个合同状态 tab 共用一个 query,点「已作废」时 data 还是「当前」那批
→ **「已作废」tab 下列着当前生效的合同,状态列印着「有效」**。

### 3-C · 命令式 `initiate` 必须承担 RTK 的义务

**规则**:用 `dispatch(endpoint.initiate(...))` 就必须 `.unsubscribe()`(query)/`.reset()`(mutation),
或传 `{subscribe:false}`/`{track:false}`。

**反例**:`OperationsTransport.ts:39` 与 `PlatformTransport.ts:42` 都不做。
实测(RTK 2.12.0 源码 + harness):3 个泄漏 query + 1 mutation = **4 次 HTTP**;
4 mutations = **16 次 HTTP** + 4 条永久驻留的 mutation 条目(各含完整响应体)。对照组加 `{subscribe:false}` = **1 次 HTTP**。

**叠加**:生成物 **43/43 query · 49/49 mutation** 都挂全局 `{wire,'LIST'}` tag ⇒ 任一写作废全部读。
浏览 30 个商品详情 → 30 条永久订阅 → 此后每次保存重取全部 30 条。

**同源后果**:`catalog-inventory-edge.rtk.ts` 的 tag 计数实测为 **0** ⇒ 命令式读的 detail 在整个会话内既不过期也不刷新
⇒ 同一批商品第二次批量操作**立刻全数 `VERSION_CONFLICT`**(FE-013)。

### 3-D · 失败必须可见,且原因不得改写

**规则**:任何失败路径都必须给用户一个**能区分**的信号;不得把服务端失败改写成不相干的原因。

**反例三种**:

1. `OperationsTransport.ts:110` —— RTK 的 `PARSING_ERROR`(data 是字符串)与空体错误(data 是 null)
   全部落进 `NETWORK_ERROR` →「请检查网络连接」。**服务端答了,UI 怪网络。** 正确兜底桶 `RESULT_UNKNOWN` 就在隔壁且已用于 object 分支。
2. `RolesPage.tsx:56-65` —— `catch` 里 `setProblem(错误)`,`finally` 立刻 `await loadDetail()`,
   而 `loadDetail` 首句就是 `setProblem(undefined)`(在第一个 await **之前**)→ **错误没渲染过一帧**。
3. 三个确认弹窗(`WorkspaceStatusModal` · `AdministratorStatusModal` · `WorkspaceAccountActionModal`)
   把 problem 交给**父页面** Alert,而弹窗自己不关不显示 → 用户只看到 loading 消失、文案不变。

**仓内正例**:`operationsProblemFeedback.ts` 对生成的 problem code 闭集做**全量文案覆盖**,漏一个 code 就是编译错误。

### 3-E · 同一个事实只能有一个住址

**规则**:一份状态不得同时存在于 RTK 缓存、Redux slice、组件 state、URL 中并靠 effect/`??` 手工对齐。

**反例**:`OperationsApp.tsx:316` `const entry = entryOverride ?? sessionEntryQuery.data ?? null` ——
登录后 `entryOverride` 恒非 null,`sessionEntryQuery.data` **再也不被读取**,而该 query 仍订阅、每次写后真实重取、取回即丢。

**⚠️ 但根因不是那个 `??`**:scope 是服务端 per-session 的,丢掉 `entryOverride` 会让标签 A **静默采用标签 B 的门店**,
是更坏的失败。**真正缺的是 CONTEXT_STALE 恢复路径** —— `PLATFORM_COMMON_CONTEXT_STALE` 全前端只作为文案存在,
无任何处置逻辑;两个本可自愈的选择器自己也发陈旧值;
**而文案说「请刷新当前页面后重试」,按钮 aria-label 正是「刷新当前页」—— 指向唯一修不好它的那个控件。**

**同类**:`operationsScopeContext` slice 是 `entry.scopeContext` 的纯镜像,唯一读者已通过 prop 拿到同一个 `entry`。

### 3-F · 该回 foundation 的必须回去

**规则**:`libraries/frontend/admin-ui-foundation` 已提供或应当提供的能力,不得在 `apps/frontend/*` 重复实现。

⚠️ **本条与后台规范 2-E 结论相反,不要套用。**
后台 2-E 是「只接受工具类合并,不接受为消除少量重复而造抽象」;
**前端不适用,因为 foundation 已经是被证明的家** —— `testId` 104 处 · `useOverlayLock` 78 处 ·
`adminDrawerSurfaceProps` 37 处 · 两个 lifecycle 59 处。

**判别口径**:

- 目的地**已存在且已被广泛使用** → 现在就抽
- 目的地**要新造、且只有 1–2 个调用点** → 不抽

**反例**:扩展字段渲染 **7 份实现、2 种日期控件**(3 份 `DatePicker` / 4 份 `Input type=date`)——
运营在「新建大区」看到中文 AntD 选择器,切到「新建品牌」变成浏览器原生控件。

**已登记的候选**见台账第九部分。

### 3-G · 幂等键按操作性质划边界(Dexter 2026-08-16 裁定)

**规则**:

| 操作性质                                                                             | 键怎么来                                                                 |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **设值类** —— 做两次与做一次**结果相同**(保存商品、作废 SKU、状态流转、上传某个文件) | **内容派生键**:`key = hash(operationId + payload)`                       |
| **增减类** —— 做两次与做一次**结果不同**(库存入库/出库/调整)                         | **意图轮换键**:lifecycle 发键 + 意图改变时 `markBusinessIntentChanged()` |

**为什么这样分**:内容派生键把"记得轮换""记得 reset"这一整类 bug 从根上消掉 —— 不需要人记得任何事。
但它会把**内容完全相同而用户确实想做两次**的操作合并成一次;这对设值类无害,对增减类是吞掉真实业务
(上午入库 10 件、下午又入库 10 件,payload 一模一样但是两笔账)。

**后端语义(决定了上面这张表)**:

```java
if (rows.isEmpty()) return null;                       // 没见过 → 执行
if (!operationId.equals(…) || !requestHash.equals(…))
    throw IDEMPOTENCY_MISMATCH;                        // 键同但操作或内容不同 → 409
return receipt.response();                             // 键同且完全相同 → 返回原回执
```

**反例三种**:

1. **一个抽屉多条命令共用一个键** —— 保存商品用掉键 K,再点「暂存图片」也用 K,`operationId` 不同 → **409「幂等键已绑定其他请求」**,用户看到"上传失败",重试还是失败。
2. **每次现铸新 UUID**(catalog **18 处**现状,其中 **2 处就在本条原正例文件里**)—— 等于放弃幂等。上传超时但服务端已处理,用户重试 → **MinIO 多一份孤儿资产**(客户端从未拿到 assetRef,永远不会被释放);新建字典条目 → **两个同名销售单位**。
3. **`reset()` 只在成功路径执行** —— 保存失败 → 用户改内容 → 再存 → 复用同一键但内容已变 → **409**,此后每次改动重存都是同一个报错,只能关掉抽屉重开。内容派生键**自动免疫**这一条。

**⚠️ 仓内正例:没有(2026-08-16 对抗审查撤回)**

原文举 `BrandCatalogCopyDrawer` 与 `LocalCatalogCopyDrawer` 的 6 处 `markBusinessIntentChanged()` 为正范例。
**实测这两个文件本身就带着本条的两个反例**:

| 位置                                                                 | 问题                                                                                                                                                                                                            |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BrandCatalogCopyDrawer` 的 `STALE_COPY_PREFLIGHT` 恢复分支          | **不轮换键**,而 `LocalCatalogCopyDrawer` 同一分支**轮换**。重新预检 → 新 digest/版本 → 点确认 → 同键异内容 → **409,关掉重开才能恢复**。唯一救它的确认勾选在零确认项时 `disabled`,所以**干净的重新预检必然踩中** |
| 两个文件各有一处 `'Idempotency-Key': globalThis.crypto.randomUUID()` | 本条**反例2 逐字出现在正例文件里**                                                                                                                                                                              |

**另一个反例(增减类,危害最大)**:`InventoryActionModal.tsx:155` 在 `submit` 开头调
`markBusinessIntentChanged()`,紧接 `:156 getIdempotencyKey()` —— **每次点提交都铸新键**,等同反例2。

> 业务后果:入库 10 件提交超时但服务端已落账,用户再点一次 → 新键 → **第二笔 10 件真的入进去**。
> 这正是本条那张表为它而写的那一行。
> 同形态还有 `StoreStatusModal.tsx:13` · `HeadCompanyBrandAuthorizationDrawer.tsx:77` ·
> `WorkspaceUserPage.tsx:216` · `ContractInvalidateModal.tsx:13` · 两个登录页 —— **是一族,不是个例**。

**按 §7 的判据,本条没有仓内正例,状态为「未验证」** —— 整改时要**建立**正例,不是照抄任何现有写法。

### 3-H · 浏览器路由只定位页面与会话上下文

**规则**:认证后台的 canonical browser route 可以携带 `groupWorkspaceKey` 以定位工作空间，
但不得把 project/store/head-company 等数据节点 ref 放进页面路由并让它成为当前 scope 的来源。
数据节点只能来自已确认的 `WorkspaceScope/queryContext`；API 资源路径可以携带 owner ref，
但它与浏览器 URL 是两条不同的边界，服务端仍须对 owner ref 做会话节点复核。旧的带 UUID 地址如需迁移，
只能匹配后重定向到稳定页面路由，不能把 UUID 回填为 scope。

**反例**: `operations-admin` 曾把项目页注册成 `projects/:scopeRef/business-channels`，
`OperationsApp` 又用 `routeMatch?.scopeRef ?? scopeRefForPage(selected)`。用户把 URL 中的 UUID 改成另一项目后，
前端会用错误节点构造查询上下文；即使后端 API 仍带 `projectRef/storeRef`，也不能把这种页面 URL 当授权依据。

**最小解**:项目/门店页面固定为 `business-channels/project` 与 `business-channels/store`，
页面 scope 只读会话上下文；保留 API `/projects/{projectRef}/business-channels`、
`/stores/{storeRef}/business-channels` 作为 owner 资源路径，由 edge 复核目标节点。

**穷举范围**:新增或修改规则时，至少检查 `apps/frontend/*/src/app/routing` 的页面注册/解析/生成、
所有 `:scopeRef`/`routeForScope`/`matchRoute` 浏览器路由实现及其调用方；generated API、HTTP controller、
owner detail URL 中的 ref 只有在被浏览器路由直接当 scope 使用时才命中本条。该条由 operations-admin 两个
business-channel 路由的真实回归与红突变测试守护；无正则化全仓门，需 review 结合穷举范围判断。

### 3-I · 管理列表首列是业务名称,并且可点进详情(Dexter 2026-08-20 裁定)

**规则**:管理后台列表的第一列必须是**用户认得的业务名称**,并且点击它进入该行的详情面。
业务编码、状态、时间、UUID 或任何"系统生成中"的占位值都不得占据首列。
若该实体另有真实业务编码,按 G-05B 单独成列显示,而不是顶替名称列。

**反例**(2026-08-20 Dexter 首次体验时报出):
`operations-admin` 的经营渠道列表首列是 `channelCode`,而该编码当时尚未生成,
列里显示"待生成" —— 用户在列表上**既认不出是哪条渠道,也点不进详情**。

**最小解**:首列 `dataIndex` 指向名称字段,并在该列 `render` 内挂打开详情的 onClick;
编码列排在其后。参照 `apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelList.tsx`
的「渠道名称」首列 + 「渠道编码」次列形态。

**判别式**:用户扫一眼这一列,能说出"这是哪一条"吗?说不出 ⇒ 它不该在首列。

**穷举范围**:两个 app 下所有管理列表的 `columns` 定义。
新增或修改列表时逐个检查首列 `dataIndex` 与其 onClick 目标。

**为什么不做成门**:"哪个字段算业务名称"需要语义判断 ——
机器只能查到首列有没有 onClick,查不出 `channelCode` 不是名称。
可做的机械部分(首列必须可点)可以进组件测试,语义部分靠 review。

### 3-J · 每个内容 Tab 必须接入 Shell 的统一刷新生命周期(Dexter 2026-08-20 裁定)

**规则**:所有承载业务读模型的内容 Tab，都必须订阅所属管理后台 Shell 提供的统一刷新信号。
点击 Tab 的“刷新当前页”后，页面中的 RTK 列表、命令式读模型、服务端分页列表和已打开的只读详情
必须重新读取；不得只让某一类请求失效，也不得只刷新页面标题或局部缓存。刷新不得重置未提交的编辑表单，
也不得把“视图切换”误当成刷新：只有会改变读模型的内容刷新动作才发布统一信号。

**最小实现**:App 层维护唯一的 `platformContentTabRefreshSignal` 或 `operationsContentTabRefreshSignal`；
内容 Tab 中的命令式读模型用 foundation 的 `useRefreshVersion` 将信号接入自身 effect，RTK 查询通过既有
LIST tag 失效链回读。列表、详情和 Drawer 分别声明自己的读边界；不要在每个页面另造刷新按钮或第二套全局事件。

**反例**(2026-08-20 Dexter 体验):门店经营渠道 Tab 有统一刷新按钮，但页面中模板候选和渠道列表分别走
命令式读请求，刷新只失效了部分列表；外部协作绑定 Tab 还用自定义 Table，搜索、分页、排序和刷新不共享
同一读模型生命周期。

**判别式**:在当前 Tab 先执行一次可见的新增/启停/绑定变化，再点击“刷新当前页”；所有允许读回的列表、
详情和状态必须在同一内容 Tab 内呈现最新事实，未提交表单内容不得被覆盖。若某个读模型没有订阅信号或
没有被统一 RTK LIST tag 覆盖，即不符合本条。

**穷举范围**:两个 App 的内容 Tab 注册页、所有 `platformClient`/`operationsClient` 命令式读请求、所有
`read*` 查询函数和 `useEffect` 读回列表；排除登录/密码恢复页和用户明确打开的独立编辑 Drawer。检查时同时
覆盖普通列表、树+详情页、嵌套 Tab、服务端分页表格和已打开详情。

**为什么不做成纯正则门**:是否属于内容 Tab、刷新是否会覆盖脏表单、RTK LIST tag 是否覆盖真实 query
需要结合生命周期和业务事实判断；可机械检查信号导出、调用点和 focused test，但不能用字符串命中替代
刷新后的真实读回验证。

### 3-K · 管理后台交互一致性七族(Dexter 2026-08-23 裁定)

**适用范围**:两个管理后台中所有管理列表、详情、编辑器、Drawer、Modal、确认面、空态、反馈和状态标识。
本节是跨批唯一正本；业务 Journey 与交互稿只能逐字引用并逐 surface 应用，不得另建一份局部交互规范。
当批内交互稿与本节冲突时，以本节为准。业务规则或 owner 能力不同时，可以产生不同内容，不能产生第二套
同义动作、关闭行为、错误位置、空态句式或状态颜色。

#### 3-K-1 · 表单

**规则**:

- label 固定在控件上方并左对齐；同一分组不得混用横排 label 与顶排 label。
- 只有 contract 必填且 owner 同样拒绝缺失的字段显示必填标记；UI 推荐值或流程建议不得伪装成必填。
- 用户在填写前必须持续看见的前提、格式或业务后果使用字段下方 `extra`；只有不影响完成任务、按需了解的
  补充解释才使用 tooltip。不得把错误、必填原因或操作后果藏进 tooltip。
- 字段错误显示在对应字段下方；集合项错误显示在对应行或卡片内；跨字段错误显示在所属分组顶部并能把焦点
  定位到首个错误。禁止只在页面顶部或全局 message 显示可定位错误。
- 字段宽度只用四档：短 `160px`、中 `320px`、长 `560px`、满宽 `100%`。编码、数量、短枚举用短档；
  名称与普通单值用中档；说明、地址和长文本用长档；动态集合、矩阵和搜索结果用满宽。不得仅因容器宽就把
  三个字段的表单全部拉满。
- 页面/抽屉标题下的事实族使用二级分组标题；分组内仅在存在两组以上可独立理解的字段时使用三级标题。
  不得用 Card 套 Card 代替信息层级。

**反例**:`CatalogDefinitionLibraries.tsx` 的三字段商品属性编辑使用宽 Drawer 和满宽禁用控件，信息量、字段宽度
与承载尺寸不匹配；`CatalogItemDrawer.tsx` 的跨区段错误依赖 Tab 状态，不能稳定定位到区段内首个字段。

**可证伪判据**:抽查任意两个不同批次的编辑 surface，逐项比较 label、必填、帮助、错误、宽度档位和标题层级；
任一无业务理由的差异即缺陷。当前全仓无同时满足六项的已验证正例，状态为 `未验证`，后续 UI 批必须建立。

#### 3-K-2 · 弹层

**规则**:

- 已存在对象的标题固定为“对象名称 · 动作对象类型”，对象名称在前，例如“拿铁咖啡 · 编辑商品”；
  新建任务没有既有对象名时使用“新建 + 对象类型”。禁止只写“详情”“编辑”或内部类型名。
- 页脚固定在弹层底部右侧；主动作在最右，次动作紧邻主动作左侧。危险动作不与保存并排伪装成次动作，
  应进入“更多”或独立危险确认。
- 点击关闭按钮、按 `Esc`、点击遮罩三条关闭路径必须共用同一 dirty 判定：无修改直接关闭；有修改先确认
  “继续编辑 / 放弃修改”。不得让其中一条绕过脏数据保护。长任务默认禁止遮罩直接关闭。
- Modal 宽度只用小 `480px`、中 `720px`、宽 `960px` 三档；Drawer 只用窄 `480px`、宽 `720px`、
  超宽 `adminWideDrawerSurfaceProps`（当前 `min(1024px, calc(100vw - 48px))`）三档。字段少的原子输入
  用小/窄，主从或多区段任务用宽/超宽；
  不得用内容少的大弹层，也不得靠层层嵌套补空间。
- 具体 Journey 必须声明叠层上限、同层互斥关系和焦点归还位置；未声明不得新增嵌套弹层。

**反例**:`CatalogDictionaryDrawer.tsx` 用约 1200px Modal 承载六类不同复杂度任务，再叠宽 Drawer；
`CatalogItemDrawer.tsx` 把查看和编辑放进同一 Drawer，并继续叠规格、物料或确认 surface。

**可证伪判据**:从 X、`Esc`、遮罩分别关闭同一脏弹层，三条路径的结果必须相同；跨两个 surface 对比标题、
按钮位置和宽度档位零漂移。浏览器焦点与真实叠层行为只能由获授权 L2 证明，静态存在性不得代称。

#### 3-K-3 · 动作命名

**统一动词表**:

| 动词       | 唯一语义                                                     |
| ---------- | ------------------------------------------------------------ |
| 新建       | 建立一个此前不存在的业务事实                                 |
| 编辑       | 修改一个仍然存在的业务事实                                   |
| 保存       | 提交当前编辑任务的全部获批变更                               |
| 取消       | 结束当前输入任务，不提交本次修改                             |
| 停用       | 保留事实和既有关系，但不再进入后续候选或正常业务使用         |
| 启用       | 让既有事实重新进入后续候选或正常业务使用                     |
| 移除       | 解除当前对象与另一个事实的关系，不消灭被关联事实             |
| 删除       | 消灭可删除的事实本身                                         |
| 作废并重建 | 保留旧事实的历史身份并建立新事实，不在原身份上改写受保护属性 |

**禁止**:不得用“解除、去掉、清除、删掉”混称“移除”；不得用“禁用、下线、关闭”混称“停用”；
不得把“作废并重建”缩成“编辑”或“删除”。同一动作在列表、详情、确认面和结果报告中必须使用同一个动词。

**业务术语**:商品库及其用户可见文案统一使用“商品形态”表示商品的业务形态；“商品类型”是禁用的同义词，
不得出现在商品库界面、交互稿、L2/focused 用户文案或测试 oracle 中。技术说明、历史 review 原文和本条禁用词清单
可以保留该词，以便追溯裁定；不得把该例外扩展到用户可见文本。

**反例**:商品配置旧界面同时出现“删除”“作废并重建”和不可点击动作，却没有先说明操作是解除关系、
消灭事实还是保留历史身份，用户无法预判后果。

**可证伪判据**:任取一个动作沿入口、确认、成功反馈、失败反馈四处对账，动词和语义必须逐字一致；出现同义词
或语义漂移即缺陷。

#### 3-K-4 · 提示与反馈

**规则**:

- 原子任务成功后关闭当前输入面、结果可从父面立即读回时，使用短 message，并在父面显示最新事实。
- 多步骤、批量、复制、治理或仍留在当前面的保存，必须原位显示结构化结果；不得用一条“操作成功”覆盖
  逐项结果、冲突或后续动作。
- 字段/集合/区段可定位失败按 3-K-1 原位呈现；版本冲突和结果未知在当前任务面显示专用处置；只有真正
  无法归属到当前业务任务的系统失败才使用全局反馈。不得丢弃服务端业务原因或把它改写成“网络错误”。
- 持续影响输入判断的说明放在正文或 `extra`；仅解释名词、不会改变输入选择的补充信息才使用 tooltip。

**反例**:把批量逐项失败压成全局 message，或在 Modal 内失败却只在被遮住的父页面 Alert 显示，用户既不知道
失败项也找不到修复位置。

**可证伪判据**:每条失败路径必须回答“哪一项、为什么、事实是否改变、下一步是什么”；缺一项即反馈不完整。

#### 3-K-5 · 空态

**统一句式**:“还没有 X” + 对当前任务影响的一句业务解释 + 一个可执行的下一步动作。
无写权限时不得显示伪可用按钮，改为说明由谁或到哪里完成；业务规则不允许创建时必须展示原因而不是空按钮。

**反例**:商品制作信息只显示“尚未设置制作信息”，主入口却是“管理制作处理标签”；这让用户离开当前任务，
仍不能完成商品制作信息设置。

**可证伪判据**:用户只读空态文案与主动作，就能说出“缺什么、会怎样、下一步做什么”；若主动作不能直接推进
当前任务即缺陷。

#### 3-K-6 · 确认

**两级规则**:

- 普通确认用于可恢复、影响范围明确的状态或关系变化；正文说明对象、动作和直接影响。
- 危险确认用于删除、作废并重建、覆盖、批量不可完全撤回或会影响下游使用的动作；标题和主按钮使用统一
  危险动词，正文必须列出影响范围、不可恢复部分和失败后仍成立的事实。
- 确认面只负责确认已完整说明的动作，禁止嵌入表单、候选选择或新的业务分支。需要补充输入时先回到任务面。

**反例**:分类移动只问“确认移动”，不展示受影响子分类和商品数量；用户无法判断一次移动改变多少查找路径。

**可证伪判据**:隐藏触发按钮，只读确认面仍能准确说出对象、动作、影响范围和是否可恢复；说不出即缺陷。

#### 3-K-7 · 状态 Tag

**统一语义**:

| 状态 | 颜色语义            | 禁止挪用                                       |
| ---- | ------------------- | ---------------------------------------------- |
| 草稿 | 中性灰 `default`    | 不得用绿色暗示已经生效                         |
| 启用 | 成功绿 `success`    | 只表示该事实已启用，不表示已发布、可售或有库存 |
| 停用 | 警示橙 `warning`    | 不得用红色伪装成已删除                         |
| 归档 | 信息蓝 `processing` | 不得与启用共用绿色                             |
| 作废 | 错误红 `error`      | 不得用于普通校验提示或临时加载状态             |

Tag 文案必须是业务中文；不得显示 `DRAFT`、`ENABLED`、`DISABLED` 等原始枚举。来源、权限、库存和
校验结果不是生命周期状态，不得挪用这五种颜色制造同义状态。

**反例**:商品规格展开行直接显示 `ENABLED`，列表与详情又用不同中文和颜色，用户无法建立稳定状态认知。

**可证伪判据**:任取两个不同批次 surface 的同一状态，文案与颜色语义必须一致；任一差异即缺陷。

#### 3-K-8 · 跨批防漂移与证据边界

每份 UI-bearing Journey、交互稿和 implementation-facing design 都必须逐字引用本节，并按七族列出
本批所有 surface 的适用情况；不得复制改写成本批第二正本。评审任取两个不同批次 surface 逐族对照，
没有业务事实差异却出现交互差异即 finding。

机械上可验证的常量集合、testId、locator binding 与 case 分母可以建门；业务可理解性、按钮层级、焦点归还、
真实滚动和叠层行为必须在获授权的浏览器 L2 中验证。focused test、静态 markup 或“元素存在”不能冒充用户行为。

#### 3-K-9 · L2 自动化前 UI/testId 可测性前置

**规则**：UI-bearing screen 在进入 L2 脚本、locator binding 或 blueprint 控件声明之前，必须先按批准的
需求/IA/交互工件/详设复核 UI 代码是否符合前端规范、既有同类模块和 foundation 形态，并按 L2 action
穷举实际会被操作的控件。每个实际操作控件都必须由 app 的 `*TestIds.ts` 唯一源提供稳定 testId，且
testId 挂在真正承载 click/fill/select/upload/press 的语义节点；动态控件使用稳定业务身份。缺失或挂错
节点时，必须先修 UI 和 UI focused/static proof，不能先写 L2 再靠 locator 绕过。

**反例**：L2 通过全局 `getByRole`、label、placeholder、文本、数组下标、CSS/XPath 或外层 wrapper 找到
提交按钮、动态行菜单或文件 input，却没有对应的 testId 常量和真实动作节点绑定；这种脚本即使暂时通过，
也无法证明操作的是批准 screen 中的那个控件，组件库 DOM 变化后还会把失败伪装成业务问题。

**可证伪判据**：逐 case/action 建立控件分母；任一实际动作缺 `*TestIds.ts` 常量、常量未渲染到动作节点、
locator binding 与 touch 记录指向父级/错误节点，或 UI 对账仍有 OPEN，即 `L2_SCRIPT_ADMISSION=FAIL`。
`UI_DESIGN_REVIEW`、`TESTID_REVIEW` 和 UI focused/static proof 均 PASS 后才允许新增或修改 L2 脚本。

**复合控件窄例外**：若仓内既有复合控件（例如 `Segmented`）的组件 API 不暴露 option-level `data-*`，
可把 testId 挂在该 option 的可见 label/option anchor，前提是点击该 anchor 与用户点击该 option 具有相同动作
语义，并在控件分母中记录 `COMPOSITE_OPTION_ANCHOR`、实际触点与 focused/static proof。该窄例外不适用于
可以直接标记的 Button、MenuItem、Checkbox、Radio、输入框或 file input，也不允许以外层 wrapper、文本、role、
CSS/XPath 或宽 locator 代替真实触点。

**仓内正例**：`未验证`。当前规则建立后，首个通过逐控件分母、真实节点绑定和独立复核的 screen 才可登记为
正例；在此之前不得把“有一个 testId”或“元素存在”当作完整正例。

---

## 4 · 评审纪律

### 4-A · 否定式全称命题必须穷举后才能写

**规则**:「全仓无 X」「无人使用 X」「被 X 挡住」这类句子,搜一种写法没命中**不等于**不存在;
必须换 2–3 种写法、并检查上下游层,才能下断言。

**为什么**:2026-08-16 这轮 113 条 finding 的第二轮验证中,**被推翻的 7 条无一例外是这类句式**:

| 写的                                                    | 实测                             |
| ------------------------------------------------------- | -------------------------------- |
| 「全仓零处用 `isFetching`」                             | 30 余处在用                      |
| 「全仓无 `Form.ErrorList`」                             | 4 处在用                         |
| 「`markBusinessIntentChanged` 零调用」                  | 6 处                             |
| 「已 grep 确认无人放进依赖数组」                        | 8 文件 13 处都放了(方向完全反了) |
| 「生成 client catalog 与 RTK endpoints 是两份独立产物」 | 一次 pass 出两份,还有门守着      |
| 「全部只有自身测试引用」                                | 6/8 有真实生产消费者             |
| 「完全绕开 RTK Query」                                  | 走的是同一条 RTK 路径            |

**根因**:证明"存在"只需一个实例,证明"不存在"要穷举。
**声称缺陷成立的部分基本都对,声称缺陷不成立的部分错得最多。**

### 4-B · finding 必须带真实业务场景

**规则**:给不出「用户做什么、看到什么」的条目,必须明确标注「工程维护性,无业务后果」。

**反例(已发生)**:「门店列表失败时用户看到干净的『暂无门店』,与确实没建门店无法区分」——
实测 `StoreManagementPage.tsx:57` **有红色错误横幅**,场景不成立,该条从「高」降为「低」。

### 4-C · 免责推理不得反过来删掉承重代码

**规则**:判定某段代码"冗余"之前,必须证明**所有**进入路径都不依赖它。

**反例(差点发生)**:台账写 `CatalogItemDrawer.tsx:288-295` 那段手写 JSON 校验是「结构问题的化石」。
实测:用户若**从未打开属性页签**,`attributesText` 字段未注册,`:782` 的 validator 根本不运行,
**这段手写检查是唯一守卫**。按原判交出去会直接开洞。

---

### 4-D · 动手写新规则、新方案、新裁决之前,先查仓内有没有

**规则**:在写下任何「规范条目 / 设计方案 / 裁决」之前,必须先检索**四处**:
`doc/platform/*-coding-standard.md`(两份规范正本)· `doc/decisions/` · **`project-memory/`**
· `HANDOFF.md` · `doc/review/platform/`(既有评审文档)。
⚠️ **`project-memory/` 是本条自己漏过的那一处**(2026-08-17,写完当天):
`project-memory/pitfalls/catalog-code-rule-invention.md` 明令禁止臆造商品编码格式,
而同日的详设 `CP-11` 要求恢复编码正则与长度上限 —— Codex 实施时撞上并停机。
**四处变五处,`project-memory/` 与 `doc/decisions/` 同等重要,且两者常互为 `sourceRefs`。**
查到已有的 ⇒ **改那一处或指过去,不得新写一份**。

**⚠️ 本条不是前端专属**,与 4-A 同属通用工作纪律,只是这两份规范里只有这里有「评审纪律」一节。
后台侧见 `backend-coding-standard.md` 的维护约定指针。

**为什么(2026-08-17 一天内漏了三次,前两次是别人抓出来的)**:

| #   | 漏查什么                           | 后果                                                                                                  |
| --- | ---------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | `HANDOFF.md` 的 `HEALTH_READINESS` | 已裁「不建第二端点」,却把它当成「用哪个依赖」的技术选型重裁了一遍                                     |
| 2   | `backend-coding-standard.md` §2-E  | 里面记着 Dexter 对 P-1 的原话与根因诊断,而设计文档在不引用、不处置的情况下把 P-1 列入「本轮明确不做」 |
| 3   | 本文件 §3-B                        | 规则一字不差已存在(且反例比新写的更重),仍新起了一节 3-A2 —— 写完才撞见,已删                           |

**根因**:「我知道这件事该怎么办」与「这件事仓内已经办过」是两件事。
**前者成立不代表后者不成立**,而后者成立时,新写一份就是制造第二个真相源。

**判别式**:动笔前问一句 —— **这件事如果有人已经想过,他会写在哪?**
写不出至少一个候选位置,说明对仓内结构还不熟,先查再写。

⛔ 不接受「我搜过了没有」——按 4-A,那是否定式全称命题,一种写法没命中不算。

## 5 · 明确不上的

**这些经穷举确认不构成问题,不写规范也不建门**(2026-08-16 实测):

|                           | 实测                                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Redux 反模式              | 全仓 **1 个 `useSelector`**、**1 个 `createSlice`**、0 个 `createSelector`、0 个 `createAsyncThunk`;immer 写法标准 |
| AntD Form 受控/非受控混用 | **0 处** `<Form initialValues>`;137 个 `Form.Item name=` 全走 `setFieldsValue`/`resetFields`                       |
| `destroyOnClose` 残留     | **0 处**(v6 已 deprecated),全部用新名 `destroyOnHidden`                                                            |
| Table `rowKey`            | 14 处**全部有**;4 处 index 派生都是只读表                                                                          |
| AntD 废弃 API             | 穷举 10 类 **0 命中**;反向确认正确用了 v6 形态。**全仓最干净的一块**                                               |
| hook 依赖数组缺项         | `exhaustive-deps` 已设为 error,三处 fresh 跑 exit 0                                                                |
| TS 逃逸                   | 1 个 `any`(测试)、3 个 `@ts-expect-error`(故意的负向断言)、**0 个 `@ts-ignore`/`eslint-disable`**                  |

**`<StrictMode>` 缺失**归 `HANDOFF.md` 欠账(9 处 render 期写 ref 目前都幂等)。
**`VITE_FRONTEND_LOG_SINK_URL` 未配置**同样归 `HANDOFF.md` —— 代码侧 WARN/ERROR 已无条件出网(`safeLogger.ts:117`)。

---

## 6 · 执行顺序(有依赖,不能乱排)

```
1-0(存在性断言清零)
   └→ 2-D(格式批)          必须在后:否则重排会弄红 175 处无关断言
3-F(该抽的抽回 foundation)
   └→ 3-A(同一件事统一写法)  必须在后:否则会在两个 App 各改一遍
1-1(补 DOM 环境 + 行为测试)
   └→ 防回归才成立          foundation 29 个 Drawer 生命周期目前零测试
```

---

## 7 · 维护约定

- **本文是唯一内容源。** 新增或修改规则只改本文。
- **别处只放指针**:`project-memory/`、skill、评审文档一律只写"见本文"。
- **新规则由实例产生**,写在修完之后 —— 没有实例的规则不进本文。
- **每条规则必须有反例。** 无反例者不进本文。
- **仓内正例是分级要求,不是准入门槛**(2026-08-16 对抗审查后放宽):
  - **有正例** → 规则可直接执行,整改指令是「照那一处改」
  - **无正例** → 规则标注 **`未验证`**,整改时要**建立**正例而不是照抄现有写法
    原判据写的是「找不到正例的规则不进本文」,而实测本文 16 条里 **10 条没有正例**
    (2-A · 2-B · 2-C · 2-D · 3-B · 3-C · 3-E · 4-A · 4-B · 4-C);
    按原判据这 10 条都该被删,但它们对应的都是已证实的真缺陷。**是判据过严,不是规则无效。**
- **`未验证` 的规则不得作为"照抄某处"的指令下发** —— 反例:§3-A 曾把一个裸 `catch {}` 举为正例,
  若照抄会把该缺陷复制到两个 App 的每个抽屉。
