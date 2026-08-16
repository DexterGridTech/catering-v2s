# 前端整改执行序列 · 2026-08-16

**15 步串行(第 0 → 13,含 9.5)。做完一步再做下一步。**

| | |
|---|---|
| **来源** | 六路逐文件评审 212 个手写文件 → 113 条 finding → 五路独立验证 → **88 成立 · 5 降级 · 2 证伪** |
| **台账** | `doc/review/platform/2026-08-16-v2s-frontend-findings-ledger-claude.md` |
| **规范正本** | `doc/platform/frontend-coding-standard.md` |
| **版本基线** | React 19.2.5 · RTK 2.12.0 · antd 6.5.0 · TS 6.0.3 —— **版本对不上的结论作废** |

**每步三段**:当前问题 · 整改方案 · 验收标准(自带反例)。
**定位用方法名 + 特征串,不用裸行号** —— 前面的修改会让后面的行号漂。

---

## 为什么是这个顺序

```
第 0 步    定测试路线 + 扩 L2         ⛔ 必须最先(见下,这是二次自我纠错)
第 1–3 步  抽 foundation 原语        ← 顺带根除 3 条阻断,不用单独修
第 4–8 步  按 feature 修业务缺陷
第 9–9.5 步 transport / 幂等
第 10–11 步 失败信号 / shell 架构层
第 12 步   存在性断言逐条处置        ⛔ 必须在格式化之前
第 13 步   格式批                    ⛔ 必须最后
```

### ⚠️ 第 0 步是修正后的位置(原排在倒数第二,那是错的)

**发现的问题**:本文前 11 步的验收判据大量是「渲染某组件,观察某行为」——
而仓内**没有任何 DOM 环境**(`jsdom` / `happy-dom` / `@testing-library` 实测 **0 命中**),
现有 7 个 `.test.tsx` **全部**走 `renderToStaticMarkup`(单次静态渲染,**effect 不跑、remount 观察不到**),
L2 的 10 个 spec **catalog / inventory 零覆盖**。

**后果(若不改)**:
1. 前 11 步做完**一条也验不了**,只能靠肉眼和推理声称"改好了" —— 这正是本仓规范批评的「声称 ≠ 行为」
2. **序列里存在一条反向依赖**:第 12 步要求「表达行为的断言换成真行为测试」,而真行为测试需要 DOM,
   那原本是第 13 步才建的 —— 第 12 步依赖了排在它后面的一步

**两次修正**:
1. 位置错 → 提到第 0 步
2. **内容也错** → 初版写「补 DOM 环境」,是搜了 `jsdom`/`happy-dom`/`@testing-library` 三个包名没命中就下的断言,
   **没查 Playwright**。实测有 **19 个 L2 spec + 两个 `playwright.config.ts`**,跑真实 Chromium。
   这正是规范 §4-A 点名的否定式全称命题失败模式,**发生在我自己身上**。
   现改为「先做路线比较,默认扩已有 L2 lane」。

**哪些判据不需要 DOM**(这几步的验收仍可静态完成,不必等第 0 步):
`grep` 类(「全仓只有一处 export」「无字面量正则残留」)、编译类(「格式化前后 `tsc` 一致」)、
纯函数单测类(「`MOBILE_PATTERN` 匹配 13812345678」)。

**第 12 步是前端独有的约束**:175 处 `assert.match` 断的是源码文本长什么样,
实测**对一个 JSX 标签纯换行(属性不变、行为不变)立即变红**。不先处置,第 13 步(格式批)会弄红一堆与格式无关的"架构边界"测试。
⚠️ **处置 ≠ 归零** —— 其中一部分是与禁止性断言配对使用的,归零会开洞,详见第 12 步。

**第 1–3 步放最前**,是因为 Dexter 已裁定「该抽象到 foundation 的现在就抽,不抽后面走的会更乱」。
⚠️ **不要套用后台规范 2-E**(「不接受为消除少量重复而造抽象」)—— 前端 foundation 已是被证明的家
(`testId` 104 处 · `useOverlayLock` 78 处 · `adminDrawerSurfaceProps` 37 处 · 两个 lifecycle 59 处),
7 份扩展字段渲染不是"提前造抽象",是**该回家的没回家**。

---

# 第 0 步 · 定测试路线并扩 L2 覆盖 ⛔ 必须最先

**⚠️ 本步是二次纠错。** 初版排在倒数第二(错);一改提到第 0 步但内容是「补 DOM 环境」(**也错**)。

**当前问题**
后续各步的验收判据大量是「渲染某组件、观察某行为」。仓内实际能力是:

| 有的 | 没有的 |
|---|---|
| **Playwright L2:两个 `playwright.config.ts` + 19 个 spec,真实 Chromium**,用同一套 `testId()` 选择器 | `jsdom` / `happy-dom` / `@testing-library` 全域 0 命中 |
| | 单元层渲染走 `renderToStaticMarkup`,**effect 不跑、remount 观察不到** |

**L2 的覆盖缺口**:catalog / inventory **零 spec**;现有 L2 全用 Playwright `.fill()`(单次 input 事件),
**原理上观察不到 FE-003 那种逐字符重建**。

**整改方案**
1. **先做路线比较,不要直接新增基建。** 本序列要验的行为(输入框失焦、loading 转换、重复 HTTP、
   错误渲染帧、Drawer 生命周期)**Playwright 都能观察**;`.fill()` 换成 `pressSequentially()` 即可覆盖 FE-003。
2. **默认路线:扩已有 L2 lane** —— 补 catalog / inventory spec,把 `.fill()` 换成逐字符输入。
3. 只有当某条行为在 L2 里成本过高(需真实后端 + DB 才能构造)时,才补单元层 DOM 环境,**并写明是哪几条**。

**为什么必须最先**:第 12 步要求「表达行为的断言换成真行为测试」——**没有可用的行为测试通道,那一步会卡住**。

**验收标准(自带反例)**
- 能观察到**逐字符输入导致的失焦** —— 反例:仍用 `.fill()`,原理上看不到
- 前述每步至少有一条**行为**断言可写 —— 反例:只能靠肉眼声称"改好了"
- 若最终仍新增了 DOM 环境,**必须写明哪几条行为是 L2 覆盖不了的** —— 反例:未做比较就双跑两套 runtime

---

# 第 1 步 · 统一 `wireUuid` 失败语义(根除阻断 FE-001)

**当前问题**
两个同名函数失败行为相反:`admin-ui-foundation/src/http/wireUuid.ts` 校验失败**抛 `WIRE_UUID_REQUIRED`**;
`operations-admin/src/features/catalog-management/model/catalogModel.ts` 的 `wireUuid` 是 `text(value) as Uuid`,**静默放行**(注释已自陈)。

`InventoryDetailDrawer` 用的是抛错版(`import {wireUuid} from '../../../app/api/wireUuid'`),
且在组件函数体顶层无条件求值 `const path = {targetRef: wireUuid(targetRef ?? '')}`,前面无 early return。
列表页 `<InventoryDetailDrawer targetRef={detail.isOpen ? detail.target : undefined}>` 无条件渲染
⇒ 抽屉关着时传 `undefined` ⇒ `wireUuid('')` 抛错 ⇒ `AdminErrorBoundary`。

**业务后果**:点左侧菜单「门店库存」→ **页面直接变成「页面暂时无法显示」,一条库存都看不到**。首屏即炸,无需任何操作。
同文件 41–67 行所有 query 都用 `{skip: !open}` 关掉了 —— 唯独这一行在 skip 之前求值。

**整改方案**
1. `catalogModel.ts` 那个静默版**改名**(如 `readUuid`),或直接删除改用 foundation 版;一个名字只能有一种失败语义。
2. `InventoryDetailDrawer` 在 `wireUuid` 之前加 early return(与同文件 `{skip: !open}` 一致)。

**验收标准(自带反例)**
- 抽屉关闭状态下渲染库存列表页,**不抛异常** —— 反例:仍进 ErrorBoundary
- 全仓 `wireUuid` 只有**一处** `export` —— 反例:两处并存,IDE 自动补全仍可能选错
- 不得靠"调用方记得先判空"收口 —— 反例:只改调用点不改命名,下一个调用点还会踩

---

# 第 2 步 · 抽 `MOBILE_PATTERN` 常量(根除阻断 FE-002)

**当前问题**
手机号正则三处各写一遍:`OperationsLoginPage.tsx` · `PublicInvitationOtpStep.tsx` · `WorkspaceInvitationCreateDrawer.tsx`。
第三处写的是 `/^1\\d{10}$/` —— **两个反斜杠**(`od -c` 确认源码字节)。实跑:

```
邀请:  ^1\\d{10}$  →  test('13812345678') = false
登录:  ^1\d{10}$   →  test('13812345678') = true
```

**业务后果**:集团/大区/项目/总公司/门店**五个用户管理页**的「发出邀请」,填对手机号也一直报「请输入正确的手机号」,
校验失败 → `onFinishFailed` → `create()` 永不执行。**新员工无法入职。**

**整改方案**
抽一个 `MOBILE_PATTERN` 到 foundation,三处引用它。

**验收标准**
- 三处引用同一常量,**无字面量正则残留** —— 反例:改对了那一处但另两处仍各写一遍,下次还会漂
- `13812345678` 在三处都通过 —— 反例:只修了字面量没抽常量

---

# 第 3 步 · 抽 `useCursorStack` 与 `useCursorCandidates`

**当前问题(两组)**

**cursor 分页栈 2 套**,`InventoryManagementPage` 与 `CatalogWorkbenchPage` 都传了 `total`
⇒ AntD 渲染出**完整可点的页码条**,而 `onChange` 只处理 ±1。
**同一个 feature 内 `InventoryDetailDrawer` 用的是 `slice(0, page)`,向后跳是对的** —— 说明是遗漏不是取舍。

> 业务后果:200 个库存对象每页 20,店长点「7」→ 实际只到第 2 页;从第 5 页点「1」→ 只回第 4 页。

**无限滚动候选累积 3 份**近乎逐行相同:`useOrganizationCandidates` · `useContractStoreCandidates` ·
`WorkspaceInvitationCreateDrawer` 内联(`scrollHeight - 8` vs `- 24` 两个魔数)。
且**全仓无 debounce**(grep `debounce|setTimeout` 只命中一个到期计时器)。

> 业务后果:搜「星巴克」发 3 次请求;platform 侧 9 处同形态,集团空间选择器挂在 shell 头部对所有页面生效。

**整改方案**
抽 `useCursorStack`(以 `slice(0, page)` 那版为准)与 `useCursorCandidates`(含 debounce)到 foundation。

**验收标准**
- 任意页码可**一步**到达 —— 反例:仍只能 ±1,而分页器还渲染着完整页码(这是"控件承诺了做不到的事")
- 或者**不传 `total`**改用简单上下页 —— 二选一,不得保持"渲染完整页码但只走一步"
- 输入 N 个字符发出的候选请求数 **< N** —— 反例:逐字符仍各发一次

---

# 第 4 步 · 属性 KV 编辑器停止有损往返(FE-011 · FE-012)

**当前问题**
`AttributesKeyValueEditor` 用 JSON 字符串当中间态:`serializeAttributeDraftRows` 对每行做 `JSON.parse`(失败才回退字符串),
effect 与 Form 值双向回环,**改任一行都会让全部行走一次 serialize→parse 往返**。
写进 `Record<string, JsonValue>`,同名 key **后写覆盖先写**。

scratchpad 实跑确认:

| 用户敲的 | 结果 |
|---|---|
| `{"note":"true"}` 只改别的行 | `note` 变布尔 `true` |
| `{"id":"1234567890123456789"}` | 变 `1234567890123456800`(精度丢失) |
| `{"origin":"直营"}` + 新行 key 敲到 `origin` | **上一行连值整行消失**,且用户正在输入的 input 已不存在 |

契约 `catalog-item.schemas.yaml` 的 `attributes` 是 `additionalProperties: true`,**后端零守卫,污染直接落库**。

**业务后果**:运营只想改一个属性,**没碰过的属性被静默改类型/丢精度**;或整行无提示消失。用户不会意识到自己删了数据。

**整改方案**
不要用 JSON 字符串当中间态;行数组是唯一真相,只在提交时序列化一次。重复 key 必须**显式报错**而非静默覆盖。

**验收标准**
- 只编辑 A 行,B 行的值与**类型**逐字节不变 —— 反例:`"true"` 变 `true`
- 长数字串保持字符串 —— 反例:`"1234567890123456789"` 变 `...800`
- 两行同名 key 时**给出可见错误**,不静默丢行 —— 反例:第一行消失且无提示

---

# 第 5 步 · 作废 SKU 不得丢弃草稿(FE-010)

**当前问题**
`voidSku` 成功后 `await detailQuery.refetch()` → `detail` 换引用 → 依赖 `[detail, form]` 的初始化 effect 触发。
该 effect 里只有 `initializedProductionItem` / `initializedMediaItem` **两个 ref 护栏**,
其余 13 个 `set*Draft` 全部**无条件重置**回服务端值。`lifecycle.dirty` 仍是 true。

**业务后果**:运营在编辑态改了 5 个 SKU 价格、加了两个点单选项,顺手作废一个过期 SKU
→ **全部未保存修改无声消失**,界面看不出发生过回滚,关闭时还弹「放弃当前填写内容?」。

**整改方案**
重置改为"仅在 `item.code` 变化或刚保存成功时重放";或作废后只重放 SKU 那一段。
根治方向是把 20 多个平铺 `useState` 收进一个 `useCatalogItemDraft` reducer —— 有了聚合体才有地方回答"服务端变了草稿怎么办"。

**验收标准**
- 编辑态作废一个 SKU 后,其他页签的未保存修改**仍在** —— 反例:静默回滚
- `dirty` 状态与实际草稿一致 —— 反例:草稿已被重置而仍提示"放弃填写内容"

---

# 第 6 步 · 提交失败不得丢稿、不得谎报原因(FE-036 · FE-059 · FE-043)

**当前问题(三处,同一类)**

1. `ContractEditDrawer` 的 `catch` **不区分错误码**,把任何失败(网络抖动、500、日期区间非法、货号重复)
   都当版本冲突,并调 `onConflict` → 页面 `setEditing(undefined)` → `destroyOnHidden` 卸载表单。
   **同目录 `ContractCreateDrawer` 是对的**:保留抽屉、保留输入。
   > 业务后果:改完分期+起止日期+5 条货号明细,保存时网线抖一下 → 抽屉直接关掉、内容清零,还被告知「合同已更新」——**但没人动过这份合同**。

2. 三处 `catch (error) { void error; ... }` 显式丢弃服务端原因,而同文件就定义了 `issue()` 并用于查询错误。

3. `OperationsPasswordRecoveryVerifyPage` 两个 Form.Item **无 `rules`**,手写正则读镜像 state,
   失败只把同一句提示从蓝变红、**文案完全不变**。
   > 业务后果:手机号少打一位,用户不知道是自己填错、账号不匹配、还是系统故障。

**整改方案**
失败一律保留抽屉与输入;文案统一来自 `operationsProblemOf` / `platformProblemOf`;
只有**确认是版本冲突**时才走冲突分支。校验回到 Form `rules`。

**验收标准**
- 任意非冲突失败后,抽屉仍开、输入仍在 —— 反例:强制关闭
- 错误文案能区分至少「填写有误 / 已被他人修改 / 服务暂时不可用」三类 —— 反例:四种失败一句话
- 不得 `void error` —— 反例:真因丢失,用户只看到通用提示

---

# 第 7 步 · 列表读数据用 `currentData`、判加载用 `isFetching`(FE-039 · FE-040)

**当前问题**
RTK 2.12.0 实测:`data = isSuccess ? currentState.data : lastResult?.data`,`lastResult` 是不清的 `useRef`;
`isLoading` 只在"从来没有过数据"时为真。

**7 处表格用 `isLoading`**,`&& !list.data` 那段是恒真冗余。

- `WorkspaceUserPage` 用 `activeDetailQuery.data`:先看张三详情、关掉、再点李四 →
  **抽屉里列的是张三的姓名、账号、任职机构和角色**,撤销任职按钮此刻挂在张三的 assignment 上。
- **最重的一处**:`StoreProfilePage` 四个合同状态 tab 共用一个 query,点「已作废」时 data 还是「当前」那批
  ⇒ **「已作废」tab 下列着当前生效的合同,状态列印着「有效」**。店长可能据此判断某份合同已作废。

**⚠️ 仓内已有正确写法**:`CatalogWorkbenchPage` 的 `adminListState({loading: itemsQuery.isFetching && scopeReady, ...})`。

**整改方案**
7 处照 `CatalogWorkbenchPage` 改;详情读 `currentData`;effect 里加 `detailData.accountId === detailAccountId` 交叉校验。

**验收标准**
- 换 arg 期间表格显示 loading 而非旧数据 —— 反例:纹丝不动然后突然跳变
- 切换详情目标时**不出现**上一个目标的资料 —— 反例:张冠李戴
- 「已作废」tab 只列作废合同 —— 反例:列出状态为"有效"的行

---

# 第 8 步 · 表单交互三处(FE-038 · FE-042 · FE-037)

**FE-038 · 候选下拉打字禁用整张表单**
`ready` 里含 `!candidate.isFetching`,`<Form disabled={...!ready}>` 经 AntD 的 DisabledContext 传播
(已核 `antd/es/form/Form.js` → `select/index.js` 的 `customDisabled ?? disabled`),
rc-select 在 disabled 时 `triggerOpen(false)` 且清空 `searchValue`。
> 业务后果:新建门店搜「星巴克」,打完「星」下拉就灰掉收起、输入被清空。禁用发生在按键后 1–2 次 commit,**不等网络**。

**FE-042 · 项目分期重名,点创建毫无反应**
错误写到 `phaseDrafts` 字段路径,但 `ProjectPhaseFieldList` 内层 `Form.Item` **没有 `name`**,
render prop 只解构两参、**丢弃了第三个 `{errors}`**,也没配 `Form.ErrorList`。
空值那条被各输入框自己的 `required` 拦在前面 —— **所以这行代码只在"重名"时触发,而重名恰好是唯一看不见提示的情况**。
> 业务后果:填了两个「一期」点创建 → 按钮不转圈、抽屉不关、页面无任何红字。

**⚠️ 仓内已有正确写法**:`ContractCreateDrawer` 用 `rules` + `Form.ErrorList`,`ProjectPhaseFieldList` 是全仓唯一一处丢弃 `{errors}` 的 `Form.List`。

**FE-037 · 品牌授权加一个就关抽屉**
`act()` 每次 add/remove 成功都调 `onUpdated`,页面 handler 把 `authorizing` 置空 → 抽屉关闭并跳详情。
> 业务后果:总公司授权 6 个品牌要**来回 6 趟**。

**验收标准**
- 候选搜索期间**只有该 Select 处于 loading**,其余控件可用 —— 反例:整张表单变灰、下拉收起
- 分期重名时**字段处出现红字** —— 反例:静默无反应
- 连续添加多个品牌**抽屉不关** —— 反例:每次操作跳一次详情

---

# 第 9 步 · transport 承担 RTK 义务(FE-065 · FE-013 · FE-075)

**当前问题**
`OperationsTransport` 与 `PlatformTransport` 都用 `dispatch(endpoint.initiate(request))`,
**从不 `.unsubscribe()` / `.reset()`**,也不传 `{subscribe:false}`。

RTK 2.12.0 源码亲验:query 默认 `subscribe = true`,mutation 默认 `track = true`;
失效中间件按订阅者数分支 —— 有订阅者走 **refetch(真实 HTTP)**,无订阅者走 `removeQueryResult`。

叠加生成物 **43/43 query · 49/49 mutation** 都挂全局 `{wire,'LIST'}` tag(归一后各只有一种形状)。

Harness 实测:3 个泄漏 query + 1 mutation = **4 次 HTTP**;4 mutations = **16 次 HTTP** + 4 条永久驻留的
mutation 条目(各含完整响应体)。对照组加 `{subscribe:false}` = **1 次 HTTP**。

**三个用户可见后果**:
1. **`catalog-inventory-edge.rtk.ts` 的 tag 计数实测为 0** ⇒ 命令式读的 detail 整个会话既不过期也不刷新
   ⇒ 同一批商品第二次批量改标签**立刻全数 `VERSION_CONFLICT`**,而列表显示的版本号是新的。只能刷整页。
2. `getOperationsCatalogItem` 浏览 30 个商品 → **30 条永久订阅** → 此后每次保存重取全部 30 条。
3. platform 的**「刷新当前页」按钮不发任何请求** —— 实现只是 `setPageReload` 改 key 强制重挂,arg 不变 → 命中缓存。
   而重挂点在 `<Routes>` 外层,**还会清空用户已设好的筛选、排序、分页、展开的组织树**。
   真实语义是「清空你的筛选,然后什么都不刷新」。

**整改方案(Dexter 2026-08-16 裁定:先修泄漏,不做更细的 tag)**
1. `dispatchWire` 补 `{subscribe:false}` / `.reset()`(或在 `finally` 里 `unsubscribe`)
2. `catalog-inventory` 补 tag,与其余 face 一致 —— **这不是"做细",是消除不一致**
3. 「刷新当前页」改为真正触发 refetch/失效,而不是改 key

⛔ **不要做比全局 `LIST` 更细的 tag 粒度。** 理由:RTK 失效中间件按订阅者数分支 ——
有订阅者走 refetch(真实 HTTP),**无订阅者走 `removeQueryResult`(丢弃,零 HTTP)**。
现在因为从不退订,所有历史读过的都算"有订阅者"于是全部重发;
**退订修好后,只有当前屏幕上真正挂着的 query 才会重取 —— 那正是应该重取的。**
实测对照:泄漏状态 4 个 mutation 触发 **16 次 HTTP**,加 `{subscribe:false}` 后同序列 **1 次**。

**零 tag 与全局 LIST 不同质**:零 tag 让用户拿到**错误结果**(改成功了却报版本冲突);
全局 LIST 结果永远正确,只是多发请求。所以只补前者。

**验收标准**
- 一次写操作触发的 GET 数**不随会话时长增长** —— 反例:浏览越多、保存越慢
- 同一批商品连续两次批量操作**都成功** —— 反例:第二次全数 VERSION_CONFLICT
- 点「刷新当前页」**真的取到新数据**,且**不清空用户筛选** —— 反例:数据不变、筛选被清
- **做完实测一次「取消一条邀请」发几个请求并记录** —— 若仍明显偏多再议 tag 粒度;
  反例:不实测就断言"已经够好"或"还得再细"

---

# 第 9.5 步 · 幂等键按操作性质划边界(FE-096 · Dexter 2026-08-16 已裁定)

**当前问题**
catalog-management 下 **15 处**直接写 `'Idempotency-Key': globalThis.crypto.randomUUID()`
(`CatalogItemDrawer` 7 · `CatalogDictionaryDrawer` 4 · `CatalogWorkbenchPage` 2 · 两个复制抽屉各 1),**等于放弃幂等**。

**根因在 foundation**:`useDrawerFormLifecycle` 与 `useSubmissionLifecycle` **每实例只有一个 `useRef`**,
而 `CatalogItemDrawer` 一个抽屉要发 **7 类命令**(保存 · 状态流转 · 作废 SKU · 晋级预检 · 晋级执行 · 暂存资产 · 释放资产)。
共用一个键会更糟 —— 后端 `replay()` 见到 `operationId` 不同即抛 409。

**业务后果**:
> 运营在商品详情点「暂存图片」,网关超时但**服务端已经处理了**。用户重试 → 新 UUID → 服务端**再存一份**;
> 第一份因为客户端从未拿到 assetRef,**永远不会被释放**,只能等 TTL。MinIO 留下孤儿资产。
> 新建字典条目同理 → **两个同名的销售单位/生产标签**,需人工清理。

**另有一处现存的坑**:`lifecycle.reset()` 在**成功路径的 try 内**,保存失败不执行
⇒ 用户改内容再保存,复用同一键但内容已变 ⇒ **409**,此后每次改动重存都是同一个报错,只能关掉抽屉重开。

**整改方案(裁定结果)**

| 操作性质 | 键怎么来 | 适用 |
|---|---|---|
| **设值类** —— 做两次与做一次**结果相同** | **内容派生键** `hash(operationId + payload)` | catalog 抽屉那 7 类**全是** |
| **增减类** —— 做两次与做一次**结果不同** | **意图轮换键**:lifecycle 发键 + `markBusinessIntentChanged()` | 库存入库/出库/调整 |

内容派生键把「记得轮换」「记得 reset」这一整类 bug 从根上消掉,**并自动免疫上面那个 `reset()` 坑**。
但它会把内容相同而用户确实想做两次的操作合并成一次 —— 对设值类无害,对增减类是吞掉真实业务。

⚠️ **动手前先逐条判定每个命令是设值类还是增减类**,不要按目录一刀切。

**仓内正例**:`BrandCatalogCopyDrawer` 与 `LocalCatalogCopyDrawer` 共 **6 处** `markBusinessIntentChanged()` ——
同一 feature 里两个复制抽屉是正范例,`CatalogItemDrawer` 是唯一没用的。

**验收标准(自带反例)**
- 同一文件重复上传(模拟超时重试)**只产生一份 staged 资产** —— 反例:MinIO 多一份孤儿
- 保存失败 → 改内容 → 再保存,**成功** —— 反例:409「幂等键已绑定其他请求」
- 换一个文件上传**不被当成重放** —— 反例:第二次合法上传被 409 挡住
- 增减类操作连做两次**产生两笔** —— 反例:内容派生键把第二笔吞了

---

---

# 第 10 步 · 失败信号与恢复路径(FE-062 · FE-004 · FE-076 · FE-078)

**FE-062 · 服务端答了,UI 怪网络**
`problem()` 只分 `typeof data === 'object' && data !== null` 一支。但 RTK 的 `PARSING_ERROR` 时 `data` 是**字符串**,
空体错误时 `data` 是 **null** —— 两者都落进 `NETWORK_ERROR` →「暂时无法连接服务/请检查网络连接后重试」。
`FetchBaseQueryError.status` 完全没看(代码读的是 RFC7807 **body** 上的 `status`)。
正确兜底桶 `PLATFORM_COMMON_RESULT_UNKNOWN` 就在隔壁且已用于 object 分支。
> 业务后果:后端重启或网关返回 HTML 502/504 期间,**全公司运营在登录页和每次保存看到的都是"请检查网络连接"**,
> 他们去查 WiFi、换网络、给 IT 报网络故障。
> (真正的 `FETCH_ERROR`/`TIMEOUT_ERROR` 没有 `data` 键,落 NETWORK_ERROR 是对的 —— 缺陷精确地是"服务端答了却怪网络"。)

**FE-004 · 错误被自己抹掉**
`catch` 里 `setProblem(错误)`,`finally` 立刻 `await loadDetail()`,而 `loadDetail` 首句就是 `setProblem(undefined)`
(在第一个 await **之前**)⇒ 同批 setState,最终值 undefined,**错误没渲染过一帧**。
> 业务后果:角色停用失败页面无任何提示,管理员以为没点中,反复点击、每次静默失败。

**FE-076 · 确认弹窗零反馈**
三处(`WorkspaceStatusModal` · `AdministratorStatusModal` · `WorkspaceAccountActionModal`)失败后把 problem
交给**父页面** Alert,弹窗既不关也不显示 —— 而 Modal 有 35% 遮罩 + 520px 面板压住中段。
> 业务后果:点「停用」→ loading 消失、文案不变、无任何新信息。只能再点一次或先关掉弹窗才看见顶部红条。

**FE-078 · 审计弹窗一闪即关**
403/404 直接调 `onClose`,父级只 `setAuditTarget(undefined)`,无任何提示;而非边界失败**确有** Alert + 重试。

**验收标准**
- 服务端返回非 JSON/空体时,文案是「操作结果待确认」类而**不是**「请检查网络」—— 反例:后端 502 期间用户去查 WiFi
- 写失败的错误在弹窗内**至少渲染一帧且可读** —— 反例:被 `finally` 抹掉、或被遮罩压住
- 403/404 给出可上报信息 —— 反例:弹窗一闪即关,再点还是一闪即关

---

# 第 11 步 · CONTEXT_STALE 恢复路径与 shell 兜底(FE-061 · FE-092 · FE-091 · FE-068)

**FE-061 · 当前问题(根因已重述)**
`const entry = entryOverride ?? sessionEntryQuery.data ?? null` —— 登录后 `entryOverride` 恒非 null,
`sessionEntryQuery.data` 再也不被读取,而该 query 仍订阅、每次写后真实重取、**取回即丢**。
`session.contextVersion` 来自这个冻结 entry,喂给每页 `expectedContextVersion`。

`context_version` 只在 `selectContext` 与 `selectDataNode` 两条语句递增。

**⚠️ 修法不是去掉那个 `??`** —— scope 是服务端 per-session 的,丢掉 `entryOverride` 会让标签 A
**静默采用标签 B 的门店**,是更坏的失败。**真正缺的是 CONTEXT_STALE 恢复路径**:
- `PLATFORM_COMMON_CONTEXT_STALE` 全前端**只作为文案存在**,无任何处置逻辑;恢复钩子只在 401 触发
- 两个本可自愈的选择器**自己也发陈旧值**
- **文案说「请刷新当前页面后重试」,而按钮 aria-label 正是「刷新当前页」—— 指向唯一修不好它的那个控件**

> 业务后果:单标签也可达 —— `selectDataNode` 服务端提交成功但响应丢失 ⇒ 行是 N+1 而 `entryOverride` 停在 N ⇒ **永久砖化**,
> 此后每条命令都返回「页面资料已更新,请刷新当前页面后重试」,而刷新按钮修不好。唯一出路是整页重载或登出。

**FE-092 · platform-admin 草稿静默消失**
`useShellInteractionLock` 在 platform-admin **0 处**,用的是 `useOverlayLock()`(返回合并值),
**无法区分「有 Drawer 开着」与「有草稿没保存」**;Menu `onClick` 与「刷新当前页」都**无 `locked` 判断**。
> 业务后果:在「新建管理员」抽屉填一半点刷新 → **Drawer 连同已填内容一起消失,没有任何确认和提示**。
> 同一操作在 operations 是被禁掉的,顶栏还有「请先保存或放弃当前修改」。

**FE-091 · 确认框悬留在无关页面**
`modal.confirm` 返回值(含 `.destroy()`)没被接住,hook 无卸载清理;confirm 由根部 `<App>` 的 holder 渲染。
> 业务后果:填一半点关闭 → 弹「放弃当前填写内容?」→ 此时点左侧菜单 → 页面子树连 Drawer 卸载 →
> **确认框孤零零悬在一个毫无关系的新页面上**(按钮能关掉对话框,但 `onOpenChange`/`reset` 落在已卸载组件上静默 no-op)。

**FE-068 · operations 的 ErrorBoundary 无 `resetKeys`**(platform 传了)
> 业务后果:某列渲染器遇 null 抛错 → **整个 shell 被 Result 取代**,无法切页/改范围/登出;点「重试页面」立刻再抛。

**验收标准**
- 收到 CONTEXT_STALE 时**能自愈或给出真正可执行的指引** —— 反例:文案指向一个修不好它的按钮
- 两个 App 的 shell 交互(菜单/刷新/切页/全屏)对 dirty 状态**行为一致** —— 反例:一个禁用一个静默丢稿
- 组件卸载后**不留悬空对话框** —— 反例:确认框出现在无关页面
- 路由变化能重置 ErrorBoundary —— 反例:一处渲染错误锁死整个后台

---

# 第 12 步 · 存在性断言逐条处置 ⛔ 必须在格式化之前

**当前问题**
两个 App 的 `src/tests/architecture/*.mjs` 共 **13 个文件 175 处 `assert.match`**,全部 `readFileSync` + 正则,
断的是**源码文本长什么样**,不是行为。实测:对一个 JSX 标签**纯换行**(属性不变、行为不变)立即变红。

**双向代价具体**:
- **假绿** —— 名为 `static-boundary.test.mjs` 的 "icon-mapped" 测试通过,而它对图标表**零断言**
- **假红** —— `rp07-rp08-second-package.test.mjs` 断言字符串 `[submitting, setSubmitting]` 的**缺席**,重命名局部变量即红
- **同义反复** —— `operations-context-view-reset.test.mjs` 的红夹具删除的正是它自己 grep 的那个字面量

**仓内对照**:`tools/verify-gates/cli.mjs` 是 **35 禁止 / 8 存在**,而这批是 **42 禁止 / 175 存在** —— 81% 对 81%,完全倒置。

**⚠️ 判据不是「归零」(2026-08-16 对抗审查更正)**
初版写「`assert.match` 归零」。实测 `default-list-page-size.test.mjs` 是**配对使用**:
```js
assert.match(source, /useState\(10\)/, path);        // 该有的有
assert.doesNotMatch(source, /useState\(20\)/, path);  // 不该有的没有
```
**归零存在性那半,只剩「不是 20」——`useState(50)` 就过了**,默认页长这条约束变成无人守。
**先归零后补替代的顺序会开一段覆盖真空。**

**整改方案(四分,逐条判定不得批量处理)**
1. **与禁止性断言配对的** → **保留**(存在性负责"该有的有",禁止性负责"不该有的没有")
2. 能单独表达为**禁止句**的 → 改写成 `assertNoMatch` 收进 `tools/verify-gates/`
3. 表达**行为**的 → 换成行为测试(**替代先落地,再删旧的**)
4. 三者都不是的 → **删**

⚠️ **顺便修一条已知假门**:`R5_FRONTEND_GENERIC_CLIENT_INVOCATION` 禁
`/\b(?:platformClient|operationsClient|publicClient)\s*\(/`,而这三个是工厂返回的**对象**,
当函数调是 TS 错误 ⇒ **该正则只能匹配已经 `tsc` 报错的源码,永远不会是先红的那道门**。

**验收标准(自带反例)**
- 存在性断言**不再单独承载任何约束** —— 反例:直接归零,`useState(50)` 从此无人拦
- 每条被删的断言,**其约束有明确接管者**(配对的禁止句 / 行为测试 / 或书面说明该约束已不需要)
  —— 反例:删了就算完,约束凭空消失
- 对任意源文件做纯格式化后,测试**仍全绿** —— 反例:换行即红(说明还在断言文本形状)
- 迁进 `verify-gates` 的每条,**人为制造一次违反必须变红** —— 反例:迁过去了但从没验证过它会红

---

# 第 13 步 · 格式批 ⛔ 单独成批,必须最后

**当前问题**

| | 前端 | 参照:后台 |
|---|---|---|
| >120 字符 | **2,676** | 8,008 |
| >200 字符 | **1,069** | 2,497 |
| 最长单行 | **3,729** | 1,967 |
| 密度 | **15.4%** | 更低 |

工具链:`prettier` / `biome` / `oxlint` **全仓零命中**,只有 eslint。
最长的两行是 `CatalogItemDrawer.tsx` 的 `:744`(3,729 字符,`CatalogTabContent` 的内联 props 类型)
与 `:655`(2,737 字符,`tabItems` 的约 50 个 props 组装)——
**可维护性的真实瓶颈是这两行,不是那个文件的 1311 行**。

**整改方案**
引入 prettier(或等价工具),全量重排,接进 `scripts/verify`。

**验收标准(自带反例)**

| 判据 | 反例 |
|---|---|
| 格式化前后**行为测试全绿** | 变红 → 改到了逻辑 |
| 排除生成物后 >120 字符**归零** | 仍有长行 → target 路径没覆盖全 |
| 第 12 步之后再跑,**架构测试不因排版变红** | 变红 → 存在性断言没清干净 |

⛔ **不与任何语义修改混提。**

---

# 未列入序列(归 HANDOFF 欠账)

| 条 | 情况 |
|---|---|
| **FE-111 日志 sink** | 代码侧 WARN/ERROR 已无条件出网(`safeLogger.ts:117`),缺的是 `VITE_FRONTEND_LOG_SINK_URL`,仓内连 `.env` 都没有 → **`HANDOFF.md` 欠账**。 |
| **`<StrictMode>` 缺失** | 9 处 render 期写 ref 目前都幂等 → **`HANDOFF.md` 欠账**。 |

**两条 Dexter 裁定已落地,无待裁项。**

---

# 已证伪,不要按它们改

| 条 | 为什么 |
|---|---|
| **FE-064** 菜单图标表 Partial 导致页面静默隐身 | **编译器实验推翻**:加第 21 个页面 key 不给图标 → `tsc` 报 **TS7053**(另三处 TS2345)。`satisfies Partial<>` 买不到宽松 —— `menuIconByKey[key]` 在索引处、`strict:true` 下重新强加穷尽性。残留只是注解误导 + 测试名过誉。 |
| **FE-023** decodeDetail 双镜像分叉 | 根与 item 两份来自**同一个 `sections` JsonNode、同一个纯函数、同一次 `detail()` 调用**,结构上不可能不一致。 |
| **FE-063** dispatchWire 同步 throw 逃出契约 | ①`edge-codegen.mjs` **一次 pass 出两份产物**+门守着 ⇒ endpoint 缺失不可达;②RTK **会 catch** 抛错的 `query()`,`.unwrap()` 在 try **内**抛出,契约完好。 |
| **FE-097** 列表失败显示"暂无门店"无法区分 | `StoreManagementPage` **有红色错误横幅**;`StoreProfilePage` 更彻底(early-return 带重试的 Alert)。降为「错误横幅下仍写『暂无门店』的双重信号」。 |
| **FE-080** 切空间白拉列表 | 重跑发的 arg 与挂载时**完全相同** → 落进缓存分支 → 0 次 HTTP。 |
| **FE-044** 四个详情抽屉关闭时空壳滑出 | 只在 **2/4** 成立,且台账举的场景恰好点名了不成立的那两个。 |

⚠️ **另一条差点造成误改**:台账曾写 `CatalogItemDrawer` 那段手写 JSON 校验是「结构问题的化石」。
实测:用户若**从未打开属性页签**,该字段未注册、Form validator 不运行,
**这段手写检查是唯一守卫** —— 按原判删掉会直接开洞。**它是载荷,不是化石。**
