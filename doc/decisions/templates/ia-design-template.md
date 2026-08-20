# IA 详设模板

- 建立:2026-08-19 · 作者:Claude
- 适用:所有 UI-bearing 交付的 IA 详设。由 `cs-writing-plans` / `cs-spec-to-plan` 引用。
- 与 `ui-interaction-design-template.md` 的分工:
  **交互工件管"用户看得见什么"**(文案、线框、surface ownership);
  **IA 管"看不见但决定行为的东西"**(谁能读、改完刷新什么、集合有多大)。
  两份文档同一事实必须逐字一致。

## 为什么单独建这份模板

2026-08-19 R5 收口复核:四条缺陷**全部**能追回 IA 原文,而 IA 里
**能在屏幕上看见的维度全部落实、看不见的维度全部走偏**。

原因不是不认真,是**验证方式决定了什么会被验证** —— 实施者打开页面就能看见抽屉里有没有搜索框,
但看不见「这次读有没有过节点授权」「是否只失效了受影响的 query」「total 是不是服务端给的」。

当时交互工件已有 343 行强制标准(全部关于可见项),**IA 没有任何模板**。本文件补这个缺口。

---

## 1 · 元数据

```text
IA_SCOPE=<本工件覆盖的 IA-ID 全集>
BUSINESS_SOURCE=<冻结规格路径>
JOURNEY_REFS=<已接受的 Journey 路径>
UI_INTERACTION_REF=<交互工件路径>
IMPLEMENTATION_DESIGN_REF=<详设路径;两份文档必须交叉对账>
DEXTER_WIREFRAME_REVIEW=<UNSET | ACCEPTED@日期>
IMPLEMENTATION_AUTHORITY=false
```

## 2 · 维度(分可见/不可见两组;每个 IA-ID 逐项填写,不得省略)

### 2.1 可见维度

这一组能在屏幕上被直接验证。

⚠️ **它们不是"更不容易错",而是"错了会更早被抓住"。**
R5 的 `entryAndSurface` 就写错过(运维后台页面路由携带了集团空间编码,违反语料 G-10)——
它在**设计评审阶段**就被拦下,没有活到实施期。**可验证性决定拦截时点,不决定出错率。**

| 维度 | 必填内容 |
|---|---|
| `businessTask` | 用户在此要完成的**业务结果**。⛔ 不写"管理 X"这类容器词 |
| `actorAndScenario` | 业务角色的用户称谓 + 到达此处的业务情境。⛔ 不写技术 principal |
| `entryAndSurface` | 路由 + surface 形态 + 打开控件。⚠️ 运维后台页面路由**不携带集团空间编码**(语料 G-10) |
| `controlType` | 逐控件形态。⚠️ **编辑态最容易被偷工**,只读与编辑必须分别写 |
| `validationAndError` | 每个 typed problem 的**用户可见处理**,不是错误码清单 |
| `accessibilityAndTestId` | 键盘可达性 · aria · **状态不能只靠颜色** · testId 命名 |
| `emptyLoadingErrorStates` | 空集合显示什么 · 加载中显示什么 · **读取失败时旧数据保留还是清空**。⚠️ 不写就会被临场发明:R5 详设全文「空态」「加载态」**零命中** |

### 2.2 不可见维度 —— **必须写成一个能做的观察**

这一组无法靠打开页面验证,**属性式描述一律不接受**。

| 维度 | 必填内容 | 观察句必须能被执行 |
|---|---|---|
| `stateAndPermission` | 谁能读、谁能写、在哪一层拦截 | 「把 URL 的 <节点> 段换成同空间另一个 <节点>,本屏全部读接口(共 N 条)均返回授权拒绝」 |
| `navigationAndRefresh` | 成功/失败后哪些数据重取、哪些不动 | 「停用一条 X 后,只有 <某列表> 重新取数;<另一列表> 与详情不发请求」 |
| `collectionShapeAndScale` | 四形态之一 + **预期规模** + 上界来源 | 「进页面只发一次请求;total 取自服务端响应;长到 1000 条时 <会发生什么>」 |
| `dataSourceAndCascade` | 数据来自哪个 owner、上游改变清理哪些下游 | 「改 <上游字段> 后,<下游选择> 被清空且不保留 stale value」 |
| `forbiddenUI` | 本屏**不得出现**什么 | 每条都要能被搜索证伪(如「response 与 DOM 中 token/authorizationRef 值出现即缺陷」) |

**每个观察句必须声明它在哪一档证据上执行**,并选**能证伪它的最低档**:

| 档位 | 何时用 | 例 |
|---|---|---|
| 静态读源码 | 判定"某处有没有调某个东西" | 「六个读接口都调了 <授权方法>」 |
| owner / 组件 focused test | 判定纯函数或单组件行为 | 「传 disabled 对象保存 ⇒ 抛 <错误码>」 |
| **backend-acceptance(真实 HTTP)** | **判定授权、隔离、状态、读写回读** | 「用 A 门店身份请求 B 门店的四条读接口,均 403」 |
| 浏览器 L2 | 只有真正需要渲染与交互时 | 「切 tab 后内容不漂移」 |

⛔ **不要把观察句写成只有跑起来应用才能做的动作** —— 多数批次不授权 DEV/L2
(R5 的 `NOT_AUTHORIZED` 就明确含 `DEV + L2 + UAT`)。
写成浏览器动作,该观察在本批**根本无法执行**,规则就退化成仪式。

⚠️ 同一条约束往往可以降档:读授权用 **acceptance 场景**验证,比"在浏览器里改 URL"
既可执行、又能进回归。**降到能证伪它的最低档,是这一节的核心要求。**

**写法对照:**

```text
❌ stateAndPermission=读按 role node scope
   ↑ 这是属性。实施者无法据此验证,也无法据此发现自己漏了五个接口。

✅ stateAndPermission=[acceptance] 用仅授权 A 门店的身份,请求 B 门店的全部读接口
   (列表 / 详情 / 关联对象详情,共 4 条),均返回授权拒绝;任一条返回 B 的数据即缺陷。
   [静态] 这 4 条 edge 方法都调用了 <既有授权方法>。
   写授权另由 grant 判定,读授权不依赖 grant。

❌ navigationAndRefresh=按精确 cache/query identity 刷新
✅ navigationAndRefresh=[静态] 停用命令的失效声明只列 <某 query identity>;
   [组件 test] 停用成功后,模板列表的取数函数不被调用。

❌ dataSource=<某某> Page
✅ collectionShapeAndScale=Bounded;预期规模=每门店 3–10 条,由门店渠道数天然限制;
   上界来源=源码固定上限 N(不拿当前行数当上界);
   [静态] 契约无 cursor/pageSize 参数,前端无抽干循环;
   [acceptance] 造 N+1 条时 owner 拒绝或明确截断,不静默丢数据。
```

⚠️ `collectionShapeAndScale` 写不出**预期规模**,说明形态还没定 —— 此时不许往下写。
形态义务见 `doc/platform/foundation-charter.md` §1-J;判别式见
`project-memory/practices/collection-boundary-modes.md`。

**填写前必须完整读一遍 `doc/platform/frontend-coding-standard.md` 并逐条应用。**
⛔ 本模板**不复述**其中任何一条规则 —— 它是众多前端规范之一,复述到这里就会有两个住址、各自漂移。
⚠️ 该规范把规则分成「能成门的」与「**只能靠 review 的**」两类;后一类没有任何机器会替你检查,
必须在 IA 阶段落成可做的观察句。

## 3 · 共用信息架构规则

逐条写清适用于全部 IA-ID 的规则:数据来源与级联 · 只读/编辑原则 · 通用禁止 UI。
**通用禁止 UI 的每一条都必须可被搜索证伪**,不能写"不应过度暴露技术细节"这类无法检验的话。

## 4 · 错误语义与界面映射(全量,不采样)

| problem code | HTTP | 业务规则映射 | 触发界面/owner | 用户可见处理 |
|---|---|---|---|---|

⚠️ 「出现即缺陷」类规则不要为它编造 HTTP reject code;写明由红夹具或人工核验证明。

## 5 · 交叉对账(交付前必做)

| 检查 | 判据 |
|---|---|
| IA ↔ 交互工件 | 同一 screen 的形态、入口、可见文案逐字一致 |
| IA ↔ 详设 | **同一事实在两份文档里必须逐字一致**;不一致即缺陷,⛔ 不许留给实施期弥合 |
| IA-ID ↔ Journey | 每个 IA-ID 追得到一个已批准的 Journey 步骤 |
| 计数自证 | 文中自称的 IA-ID 个数 = 实际小节数 |

> **为什么单列这一条**:R5 最贵的一条缺陷是 IA 写 `bounded`、详设写 `Page` ——
> **两份设计文档在实施开始前就自相矛盾**,实施者只能自己选一个,于是用"抽干全部页再客户端分页"弥合两者。

## 6 · 完成判定

```text
IA_DIMENSIONS=<全部 IA-ID>,两组维度逐项齐全
INVISIBLE_DIMENSIONS_AS_OBSERVATIONS=<是/否>   ← 否则不得进入 implementation-facing design
FORBIDDEN_UI=explicit
TYPED_PROBLEMS=<数量> mapped
CROSS_CHECK_WITH_DESIGN=<PASS / 列出不一致项>
DEXTER_WIREFRAME_REVIEW=<状态>
IA_STATUS=<...>;不构成 implementation authorization
```
