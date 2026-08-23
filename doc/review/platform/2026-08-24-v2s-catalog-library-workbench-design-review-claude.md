# 商品库工作台 · 四轴 DESIGN review(Claude 外部独立复核)

- 日期:2026-08-24 · reviewerKind=`EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE`(不占内部两轮)
- 被审:正式需求 / Journey / 交互 / IA / 详设 / 串行计划(六件)+ 内部两轮与 intake
- 会话出处:续接会话。全部数字由本轮重开 owning source **独立复算**,未采信作者自报,
  未继承内部 `SELF_DECIDED`。

```text
REVIEW_TARGET=DESIGN
VERDICT=GO
M/S/N=0 / 1 / 3
```

---

## 1 · L2 基线独立复算(话术五数,逐个核)

| 声称 | 我的复算 | 判定 |
|---|---|---|
| 18 scenarios / 41 cases | `l2-scenarios.json` 实测 scenarios=18,caseCount 求和=41 | ✅ |
| 0 active | `l2-execution.json`:`mode=FRAMEWORK_ONLY`,`enabledCaseIds` 长度=**0** | ✅ |
| 39 TEST datasets | `fixture-catalog.json` 的 `testDatasets`=**39** | ✅ |
| runner absent | `scripts/test`、`scripts/dev` 下 **无** browser-l2 受管 runner;仅 fixture 助手(242 行)与 spec 骨架(937 行,受 FRAMEWORK_ONLY 约束) | ✅ |
| 目标 26/65、本批 24 case | 详设第 190 行:「旧 18/41 保留,本批新增 8 scenario/24 case,generated 总分母精确为 26/65;本批 execution exact-set 为 24」,算术 18+8=26、41+24=65 ✅ | ✅ |

**当前 L2 readiness 独立结论**:**NOT_READY** —— runner 缺位、0 case 激活、8 个 TEST fixture 未实现、
任何动态动作未执行。**设计完备 ≠ 动态 PASS**,本轮不做任何升档。

## 2 · 四轴逐项核验

### 轴一 · 用户语言与 Journey —— PASS
- 交互稿 15 处 `USER_VISIBLE_COPY` 合计 1088 字,对 11 个技术词全集扫描**零命中**
  (IA 不重复 copy,合规);intake 第 44 行明确了「业务编码可读、只禁 raw enum/ref/UUID/problem code」
  的正确边界,避免误伤商品/规格编码。
- 「商品元数据/当前结果域」按 Dexter 冻结入口保留(正式需求第 128–132 行,控件顺序不变),
  intake 第 43 行标注 `CONFIRMED_BUT_DEXTER_FROZEN_EXCEPTION`,配置抽屉补业务副标题 —— **未扩散**。
- Journey `DEXTER_ACCEPTED`,八条 J-CATUI 均含 success/failure/recovery 与焦点归还,
  交互稿另有连续性矩阵与逐字错误基线(intake 第 42 行处置落地)。

### 轴二 · 控制权与 state —— PASS
- 详设含控制权表:contract 声明闭集/read model/typed problem/**actionAvailability**;
  owner 计算并重验候选资格与准入;generated RTK 只传递 typed facts;
  本地 `treeData`/`acceptedPage` 镜像**明列为待退休 GAP**(intake 第 45 行)。
- 分类断言字段统一 `disabledReason`(第 485 行),前端不本地推导资格。
- 三层住址(server facts / 整单 draft / UI 瞬态)落在 `useCatalogItemDraft` typed slice 设计;
  「九 View/Editor 分文件」「不塞回巨型宿主」为不变量(第 161/164 行);
  宿主拆分锚点在 §9b(`CatalogWorkbenchPage` 行)。

### 轴三 · 日志与首败 —— PASS
- join 链完整:`case/action/testId → requestId → HTTP completion → DB section`,
  runner 生成 join artifact 与 `lastKnownGood/brokenBoundary`(第 85 行);
  首败为结构化 `firstFailure={code,caseId,actionId,source}`(第 728 行);
  runner self-test 覆盖 identity/heartbeat/log/firstFailure/lastKnownGood/brokenBoundary/business/cleanup
  schema(第 196 行)。
- `NO_NEW_LOG` 矩阵存在;「action 后无预期日志仍等到 timeout」被禁止(第 213 行),
  「不得用等待、加 timeout 或重复点击掩盖」(第 722 行)。
- 禁录清单:不记录 keyword/path 名称值、draft、raw body/SQL/bind(第 85 行);
  fixture report 只写业务码/版本/数量与不可逆 HMAC digest,不写识别码值/token/cookie/raw payload(第 635 行)。

### 轴四 · L2 能力建设 —— PASS(设计层)
- **24 = 8 Journey × success/failure/recovery**:8 个 `FIXTURE-CATALOG-LIBRARY-*` 逐 Journey 定义,
  每个 fixture 明确覆盖三态(第 625–627 行样例);fixture 与 DEV seed 严格隔离
  (「不得复用或修改长期 DEV,也不得读取 DEV seed」第 612/659 行),由 owner HTTP commands 每 run 物化。
- **runner 设计完整**:本机 Spring Boot/双 Vite/Playwright、受管 tunnel、每 run 远端 DB/资产命名空间、
  identity/资源预检、readiness 全 PASS 才激活、两侧 cleanup 分账(第 611–616、688–690 行,
  cleanup 五步含 readback「本地路径不存在且远端 namespace 零残留」)。
- **SECRET_INJECTION 可实现且闭环**:runner-local adapter 只复用受管 host trust 形态、不读 DEV credential
  (第 658–659 行);`0700` runtime 目录 + `0600` 文件(第 661–662 行);六类 secret 表带
  「唯一来源与 run 绑定 / 最小注入目标 / **明确不接收**」三列 ——
  Vite/Playwright 不拿 host 访问与 DB 凭据(第 666–667 行);
  **9 个失败码逐个数齐**(REQUIRED_MISSING / FILE_REQUIRED / FILE_MODE_INVALID / ALLOWLIST_MISMATCH /
  RUN_BINDING_MISMATCH / NAMESPACE_BINDING_MISMATCH / LEAK_DETECTED / **FORMAT_INVALID** / **STALE**);
  **8 类红变异逐项独立真红**,且明写「不能由一个泛化 throws 代替」(第 690–693 行)。
- **Round 2 后补两项已真实落地**:格式非法→精确命中 `L2_SECRET_FORMAT_INVALID`、
  expires epoch 过期→精确命中 `L2_SECRET_STALE`,在详设红变异清单与串行计划双处出现。

## 3 · 内部两轮的独立判定(不继承)

Round 1 `NO-GO 1/0/1` → intake 逐条 `CONFIRMED` 处置(技术词、Journey 三态矩阵、冻结入口、
业务编码边界、分类候选控制权)→ Round 2 `NO-GO 0/1/0`,唯一 S=「两个 secret 码缺独立红变异」→
作者按最小修复补齐,`SELF_DECIDED_CONFIRMED_AND_FIXED`,**未改写 Round 2 原始 NO-GO** —— 程序诚实。
两项修复我已在 owning source 亲验(见轴四),**真实成立**。

## 4 · Findings

### N-1(原编号保留)· L2 runner 拓扑重新引入已测得的隧道税,设计未声明预期运行时长 —— `CONFIRMED`

- **事实**:runner 设计为本机 Spring → 受管 tunnel → 远端每 run DB namespace(第 611–616 行)。
  这正是性能批实测过的拓扑:**每次 DB 操作 ≈42.7ms**(项目记忆 `PERFORMANCE_IS_TWO_MULTIPLIERS`),
  一次整单保存 ≈102 次操作 ≈4–6 秒。65 个 case、33 个写 operation 的全量 L2 run,
  整场时长可能在数十分钟量级。设计有逐 action 的日志超时纪律,但**无整场与逐 case 的时长预算**,
  也未引用该记忆说明"为什么明知慢仍选此拓扑"。
- **适用边界与反例**:该拓扑是**受环境约束的合理选择**(本机无容器可用 ⇒ 远端 namespace 是唯一隔离路径,
  Playwright 又必须在本机),**不是缺陷**;缺的只是把代价说出来。
  若未来本机可跑容器,应重估。
- **最小修复**:详设 §11 加一段 —— 引用两乘数记忆,给出预期单 case 与整场时长预算
  (由 42.7ms × 预估操作数推导,不拍脑袋),并把逐 case timeout 从该预算导出。
- **需 Dexter 裁决?** 否。


## 4b · 专项 · 商品列表列的用户视角合理性(Dexter 2026-08-24 点名重审)

**方法**:不看规格是否自洽,只问两件事 —— **每一列是谁在扫、扫它回答什么问题**;
以及**典型屏宽下这套列真的摆得下吗**。

### 4b.1 一笔宽度账(设计里没人算过)

1280px 内容区 − 左树 240px − 间距 16px ≈ **1024px 给表格**。
选择列 ~40px + 行动作 ~90px 后,八列剩 ~**894px**。
「商品」列(48px 主图 + 两行名称/编码/短名)按设计自身的可读要求至少 **~240px**。
余七列分 ~654px ⇒ **平均每列 ~93px** ——「库存扣减」的值域是
「直接扣当前商品或规格 / 各规格分别设置」这类**九至十汉字短语**(≈130px 起),
「更新时间」带日期时间(≈140px)。⇒ **在最常见的 13/14 寸屏上这套列必然横向滚动**,
而设计的应对只有「表格是唯一横向滚动区」—— 合规,但**被滚出视口的恰是右侧的
状态、来源、更新时间**。

### 4b.2 逐列用户判定

| 列 | 谁在扫、答什么 | 判定 |
|---|---|---|
| 商品(图+名+码+短名) | 所有人;"找到它" | ✅ 黄金列,占宽合理 |
| 商品类型 | 混合结果域里分辨原料/销售品/套餐 | ✅ 保留,但扫读频率中等 |
| 规格 | SKU 商品看"几个规格、什么维度" | ✅ 父行摘要+子行展开的设计好 |
| 标准价 | 店长/运营比价;**缺价提示是真实风险事实** | ✅ 高频扫读列 |
| **库存扣减** | ⚠️ **谁会横向比较 20 个商品的扣减方式?** 它是逐商品的配置事实,不是扫读事实;日常问"这个商品怎么扣"的人(库存员)走的是详情,不是列表。它占走 ~130px 黄金宽度,换来的扫读价值存疑 | ⚠️ 见 S-1 |
| 状态 | **所有人、所有任务的第一过滤事实**("哪些还是草稿/停用") | ⚠️ 排在第 6 位,恰好落进横向滚动区 —— **最高频的列被滚出首屏** |
| 来源 | 治理与复制场景 | ⚠️ 冻结筛选区已有「来源」筛选;筛选后列内全同值,不筛选时扫读频率低 —— 双重存在的价值最薄 |
| 更新时间 | "最近改了什么" | ✅ 但可短格式化(今天 14:32 / 8-21) |

### 4b.3 结论 → S-1(升级为本轮唯一 S)

**列集合按"配置事实的完整性"选取,没有按"用户扫读频率"定序与分档**:
1. **无默认/可选两档机制** —— 八列全员常显,窄屏必然滚动,而被滚掉的是高频列;
2. **状态列位置偏后**(第 6/8)—— 用户视角它应紧随「商品」或「标准价」;
3. **「库存扣减」「来源」两列扫读价值存疑**却常驻:前者是详情型事实,
   后者与冻结筛选区功能重叠;
4. 对照本批自己的第一性判据(§5.3「信息是否可比较」):可比较性应以**扫读频率**为序,
   当前排序是按事实族的枚举序。

**最小修复**(不推翻列集合,只加两条规则):
- 默认列 = 商品、状态、标准价、规格、商品类型、更新时间(短格式);
  **可选列** = 库存扣减、来源(列设置开关,记住偏好)—— AntD Table 原生支持,零新机制;
- 列序按扫读频率:状态紧随商品之后。
**反例边界**:若 Dexter 判断"库存配置完整性巡检"是高频任务(开业铺库存阶段),
则库存扣减升回默认列 —— 这是产品节奏判断,标 `DEXTER_DECISION`(轻,一句话)。

### 4b.4 用户视角下做对了的(点名保护,实施不得丢)

缺价单独提示(风险事实进列表)· 短名进商品列 · 子行与父行同表头对齐、
加载中/失败/继续加载各占一条子行不跳宽 · 行 key 用业务码禁 index ·
SKU 子行不参与父行批量选择但保留对齐占位 · 禁斜杠复合列 —— 这六条全是站在用户侧的正确决定。

### 4b.5 两条 N(随列专项一并给)

- **N-2 · 智能视图下缺「分类」信息**:「外部订单临时商品」「最近更新」等视图跨分类出结果,
  当前八列无一告诉用户"它属于哪个分类" —— 而治理转正的第一步恰是补分类。
  最小修复:仅在智能视图/跨域结果域下于商品列第二行追加分类路径(灰字),不加新列。
- **N-3 · 生命周期风险不可见**:列表看不出"被套餐/BOM 引用中",批量停用/归档要靠 owner 拒绝才发现。
  最小修复:状态 Tag 旁小徽标「使用中」,数据由 contract 列表摘要提供(§8.1.5 已要求摘要防 N+1),
  不逐行拉详情。

## 5 · UI 与动态未验证清单(⛔ 不得被设计完整性代称)

1. browser L2 runner、24 case、8 fixture:**未实现、未运行**;
2. DEV / reset / seed / Testcontainers / migration / 部署:本轮均未执行;
3. 九 View/Editor 拆分、`useCatalogItemDraft`、sessionStorage 草稿恢复:设计存在,行为无人验证;
4. 一致性七族(已落 `frontend-coding-standard.md` §3-K):跨 surface 零差异判据待实施后 L2 抽查;
5. secret 红变异八项:设计声明,真红与否待实现。

## 6 · 足以指导实施的判定

**是。** 判据:产品语义(冻结入口、业务编码边界、八 Journey 三态矩阵)、控制权(逐控件归属表 +
待退休 GAP 点名)、日志(join 链 + 首败 schema + 禁录清单)、L2 环境(runner 分阶段 + 六类 secret 表 +
9 失败码 + 8 红变异 + readiness 门)均为**闭集与可证伪判据**,实施 agent 无需在这四轴上猜测。
唯一需补的是 N-1 的时长预算一段。

## 7 · 收口

```text
REVIEW_TARGET=DESIGN
VERDICT=GO
M/S/N=0 / 1 / 3
L2_READINESS=NOT_READY(runner 缺位、0 激活、fixture 未实现;基线 18/41/0/39 独立复算成立)
SAME_ROOT_SCAN=§9b 锚点 16/16 唯一命中 · secret 失败码 9/9 · 红变异 8/8(含 Round2 两项)· L2 五基线数 5/5 · 列表八列 8/8 逐列用户判定(4b.2)
EVIDENCE_TIER=静态读源码与文档 + 独立复算(JSON 分母、锚点、失败码枚举)。⛔ 未运行任何门/DEV/seed/TC/L2/UAT,未写入除本文件外任何路径
```

**授权边界**:本 GO 仅表示设计可作为实施授权输入;不授权修改生产代码/契约/测试/fixture,
不授权 DEV、reset、seed、browser L2、UAT、migration、部署或数据操作。
S-1(列分档定序)与 N-1..N-3 建议在 CP-00 前以文本修订折入;S-1 内含一项轻量 DEXTER_DECISION(库存扣减列是否默认显示)。
