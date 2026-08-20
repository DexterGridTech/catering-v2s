# 详设与 IA 维度集 · 设计提案

- 日期:2026-08-19 · 作者:Claude
- 状态:**已落地并被取代(SUPERSEDED)**。正本是
  `doc/decisions/templates/ia-design-template.md` 与
  `doc/decisions/templates/implementation-design-template.md`。
- ⚠️ **本文只保留诊断证据,维度内容以模板为准** —— 落地后的对抗轮改动了三处:
  机制表 12 行 → 17 行(补入两份 coding-standard 中"只能靠 review"的条目);
  观察句新增**证据档位**要求(必须选能证伪它的最低档,不得写成只有跑起来应用才能做的动作);
  去掉了全部冻结计数(charter §6-C)。
- 依据:R5 收口复核的四条真实缺陷 + 现有两份文档的全量维度拆解
- 原则:**每一维都必须能指向一次真实失败,或指向一处必然的临场发挥**。凑数的维度不收。

---

## 0 · 判定尺度(决定收不收一个维度)

一个维度值得存在,必须满足三条之一:

1. **这次真的坏在它上面**(有 finding 编号可指);
2. **漏了不报错** —— 编译器、类型检查、既有门都发现不了,只能靠人写下来;
3. **实施者必然要做这个决定** —— 不写他就自己发明,而本仓只有一个正确答案。

⛔ 反过来:**漏了会编译失败的,不收**。编译器管得比文档好,写进文档只是噪音。

---

## 1 · IA 维度:9 → 11,并对三维施加"可证伪观察"强制

### 1.1 现有九维的实测评级

| 维度 | 本批实测 | 处置 |
|---|---|---|
| `businessTask` | ✅ 落实 | 保留 |
| `actorAndScenario` | ⚠️ 第 106 行写「需要真实 SQL Page」,实现是抽干 | 保留;规模断言拆出独立维 |
| `entryAndSurface` | ✅(URL 违反 G-10 已在设计轮修复) | 保留 |
| `controlType` | ✅ Select、搜索框、编码列全对 | 保留 |
| `dataSourceAndCascade` | ⚠️ 集合形态藏在这一维里没说清 | 保留;形态拆出 |
| `validationAndError` | ✅ 15 个 typed problem 全落 | 保留 |
| **`stateAndPermission`** | ❌ **M-1**:第 181 行「读按 role node scope」五个接口未实现 | 保留,**强制可证伪** |
| **`navigationAndRefresh`** | ❌ **S-1**:第 84/112 行「精确失效」实现为手写计数器 | 保留,**强制可证伪** |
| `accessibilityAndTestId` | ✅ 13 个文件 | 保留 |

### 1.2 关键发现:失守的全是"看不见的维度"

能在屏幕上看见的(`controlType`/`entryAndSurface`/`accessibilityAndTestId`/可见错误文案)**全部落实**;
看不见的(`stateAndPermission`/`navigationAndRefresh`/集合形态)**全部走偏**。

原因不是不认真,是**验证方式决定了什么会被验证** —— 实施者打开页面就能看见抽屉里有没有搜索框,
但看不见「这次读有没有过节点授权」「是否只失效了受影响的 query」「total 是不是服务端给的」。

⇒ **规则:不可见的三维必须写成"一个能做的观察",不能写成"一条属性描述"。**

```text
❌ stateAndPermission=读按 role node scope           ← 属性,无法验证
✅ stateAndPermission=把 URL 门店段换成同空间另一门店,
   本屏全部读接口(列表/详情/绑定详情,共 N 条)均返回授权拒绝;
   任一条返回他节点数据即缺陷

❌ navigationAndRefresh=按精确 cache/query identity 刷新
✅ navigationAndRefresh=停用一条渠道后,只有本项目渠道列表重新取数;
   模板列表与详情抽屉不发请求

❌ dataSource=business-channel Page
✅ collectionShapeAndScale=Bounded;上界来源=每门店渠道数由业务天然限制,
   源码固定上限 N;进页面只发一次请求;total 取自服务端
```

同 `project-memory/practices/failure-condition-names-the-wrong-shape.md` 与
`evidence-falsifiable-criterion`:**判据要自带反例。**

### 1.3 新增两维

| 新维度 | 收它的理由 | 必填内容 |
|---|---|---|
| **`collectionShapeAndScale`** | 尺度 1:**M-2** 直接坏在这里。IA 第 178 行写 `bounded`、详设 §5.2 写 `Page`,两份设计文档实施前就矛盾 | 四形态之一 + **预期规模** + 上界来源 + 「长到 1000 条会怎样」。写不出规模 ⇒ 形态没定,不许往下走 |
| **`emptyLoadingErrorStates`** | 尺度 3:每个列表/抽屉都要,不写就自己发明;且详设全文「空态」「加载态」**0 命中** | 空集合显示什么 · 加载中显示什么 · 读取失败时旧数据保留还是清空 |

⚠️ 明确**不新增**「并发可见行为」维 —— IA §3 的 `VERSION_CONFLICT` 行已经写了
「关闭旧编辑态、读取最新详情、允许用户重新确认」,再开一维是重复。

---

## 2 · 详设维度:保留 14 类,新增 8 类

### 2.1 现有维度的实测评级(全部保留,标注哪些要改造)

| 现有维度 | 本批实测 | 处置 |
|---|---|---|
| §0.1 真实业务目标 | ✅ 使"问题对不对"可被独立判断 | 保留 |
| §0.2 方案比较 A/B/C + 「我选了 X 而不是 Y,因为 Z」 | ✅ **这是"方案合理性"唯一抓手**,没它只能验闭环 | 保留,**提为必填** |
| §1 CP 总览与依赖 | ✅ | 保留 |
| 每 CP `可证伪失败条件` | ✅ 空实现会红,质量高于平均 | 保留 |
| 每 CP `不变量` / `FORBID` | ✅ | 保留 |
| 每 CP `RECALL` | ❌ **点名 `collection-boundary-modes` 两次仍违反** | **降级**为阅读清单;合规靠 §2.2-A/C,不靠它 |
| §5.2 operationId/path/face 表 | ✅ face 单一、命名合规 | 保留;`collection` 列改造(见 2.2-C) |
| §5.3 capability policy | ✅ 恰两个 | 保留 |
| §5.4 跨域写矩阵(policy/first/second/transaction/rollback) | ✅ **六个方法全对** —— 这一维直接生效 | 保留,**样板** |
| §6.3 foundation 对接表 | ⚠️ 行不全:无刷新行、无错误映射行 → 那两处被手写 | 保留,行集由 registry 决定,作者不得自选 |
| §7.2 acceptance 场景设计(id/owner file/identity/fixture/request/businessOracle) | ✅ 14 条全对 | 保留,**样板** |
| §7.3 红夹具与人工核验 | ✅ | 保留 |
| §8 BR → owner judgment point | ✅ 34 条全落、零缺 | 保留,**样板** |
| §9 声明-传递-消费矩阵 | ⚠️ **九行全是业务事实,零机制事实** | 保留,**必须含机制行**(见 2.2-C) |
| §10 未决项处置 | ✅ 六项 C 全保持未决 | 保留 |
| §11 stop rules | ✅ | 保留 |

### 2.2 新增八维

**A · 横切机制对照表(主结构,Dexter 指定)**

每个实现步骤三列:

| 列 | 内容 | 为什么 |
|---|---|---|
| 用哪个现成能力/规范 | **精确路径或符号名**,不写「参考 foundation」 | S-1:`createRefreshSignal` 存在、`operationsRefreshSignal` 已实例化,仍手写 7 处计数器 |
| 如何验证 | 一个能做的观察 | 见 §1.2 |
| 无现成时的实现形态 | 必须符合什么形状 | **M-1/S-2 的根**:读侧授权与 Problem 登记处**本仓无规范,只有代码先例**,作者无处可指,只能发明 |

行集来自横切机制 registry,**作者只能填值,不能删行**;不适用要写 `N/A` + 理由。

**B · 同族全集清单**

每条机制必须列出本批适用的**全部**落点,不是举例。

> **M-1 的根**:F-02 认定「store/project pair 必须校验」,实施只加在被点名的候选接口上,
> 同族另外五个读接口没扫 —— `requireStoreProjectPair` 全文件只有一个调用点。

判别式:**这条规则适用于几个接口 / 几个页面 / 几个 owner 方法?写不出全集,就是还没扫。**

**C · §9 矩阵必须含机制行,且逐层写具体值**

现有九行全是业务事实。新增机制行,`declaration`/`transfer`/`consumption` 三列分别写它在**每一层的具体值**:

| fact | declaration | transfer | consumption |
|---|---|---|---|
| 集合形态 | IA 的 `collectionShapeAndScale` | **契约:参数列表有没有 cursor/page/filter** | **前端:total 取自哪、有没有客户端 slice** |
| 授权执行点 | IA 的 `stateAndPermission` | **edge:哪个方法、哪一行** | owner 是否复核 |
| 缓存失效 | IA 的 `navigationAndRefresh` | RTK tag / 失效调用点 | 哪些 query 重取 |
| 错误映射 | typed problem 集合 | **注册处的精确类路径** | 前端呈现 |
| 日志与脱敏 | 哪些字段禁止出现 | 写路径的日志点 | — |

> **M-2 的根**:形态标签写在 §5.2 一处,履行发生在契约、owner、前端三处,中间无强制对账点。
> 每层各写一次具体值,矛盾就藏不住。

**D · 预期规模与增长**

每个集合/查询写:今天大约多少 · 增长由什么驱动 · 长到 1000 条会怎样。
这是 charter §1-J 判别式的强制实例化。**写不出来 ⇒ 形态没定。**

**E · owner API 的消费者清单**

每个新 owner 方法列出谁调用。零调用者当场删。

> 依据:设计复核 round 2 的 N-4 —— `markBindingsCascadeDisabled` 被声明,而 §5.4 政策矩阵不调用它。

**F · 日志与脱敏落点**

每个写路径/外部交互写:产生什么日志 · 哪些字段必须不出现。

> AGENTS.md 是**硬约束**,而详设全文「脱敏」**0 命中**。它 100% 静默失败 —— 尺度 2。

**G · 迁移的回填与可逆性**

加列时旧行取什么值 · 为什么那是唯一可恢复的事实 · 能否回滚。

> 这次 `statusChangedAt` 用 `created_at` 回填并写了注释,做得对 —— 但**详设没要求,是实施者自觉**。
> 数据迁移错了既贵又难回滚,不能靠自觉。

**H · 幂等键构成**

`receipts.execute` 的 canonical 键由哪些字段构成、重放时返回什么。

> 这次靠代码先例做对了,而详设「幂等」只出现 1 次。重放语义错了不报错 —— 尺度 2。

---

## 3 · 落地时的两条边界

1. **是给作者查的表,不是给脚本判的门。** 本仓刚退役整套 compliance-control
   (196 壳、package-exit、standards-coverage-matrix);再建机器门是重蹈覆辙。
   价值全在"写详设时照着填",不在"事后能不能扫出来"。
2. **落点在 skill 触及处**(Dexter 指定)。`cs-writing-plans` / `cs-spec-to-plan`
   应当直接吐出上述结构的**空表**,作者只能填值。落地前先摸清两个 skill 当前实际引用了哪些文件。

## 4 · 时序

Dexter 已裁定 **等 R5 五条 findings 整改完成后再建**。届时这五条正好可以作为新维度集的第一次真实检验 ——
逐条回答「如果当时有这一维,它会不会被挡住」。
