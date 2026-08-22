# 后台接口性能整改 · implementation-facing DESIGN review(Claude 独立复核)

- 日期:2026-08-22 · 作者:Claude · 被审:Journey / 交互稿 / IA / 详设 / 串行计划(五件)
- 会话出处:**续接会话**。按亲验纪律声明:本轮不冒充 fresh acceptance;
  全部结论由本轮重开 registry、OpenAPI 分片、Tracker、Interceptor、TC runner、DEV runner、
  CatalogOwnerService、catalogModel、CatalogWorkbench 与生成源亲验,**未采信作者自述,
  也未采信内部两轮 verdict**。
- ⚠️ 话术给的仓根 `/Users/dexter/Documents/workspace/idea/catering-v2s` 与实际不符,
  本轮按实际仓根执行;**该差异本身即建议修正**(见 N-2)。

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取(缺项/矛盾/无出处数值,非空)
VERDICT=GO
M/S/N=0 / 1 / 2
```

---

## 0 · 方案合理性

**问题对不对** —— 对,且是我自己给的根因,本轮仍复核了它:两个相乘的因子(每次 DB 往返成本 × 往返数),
详设 §1.1 忠实继承且没有扩大范围。

**方案优不优** —— 优。三处判断值得单独肯定:
- **`transactionBeginCount` 只数 `SET_AUTO_COMMIT(false)`**,不拿 BEGIN/COMMIT 两条 raw `TRANSACTION`
  与事务数比较 —— 这正好修掉我根因分析里"108 次 TRANSACTION 对 48 次 UPDATE"的口径歧义,比我写得准。
- **`unclassifiedSqlRatio` 排除 CONNECTION/TRANSACTION,不允许稀释** —— 关掉了"靠加连接操作把比例摊薄"的假绿路径。
- **预算初值取整改后三次运行最大值,且不得高于分类阈值;高于说明整改未完成,不通过抬预算解决** ——
  关掉了"按当前糟糕状态标定"这个最容易走的捷径。

**代价配不配** —— 配。无新增 DB shape、无性能表、无审计表(§10 迁移为 N/A);
无 fallback、无双 registry、无第三真相。

---

## 1 · 独立复算的数字(全部亲验,含一次我自己的测量假象)

| 声称 | 我的独立复算 | 判定 |
|---|---|---|
| 238 = 181 + 57 unique | edge=181、catalog=57、platform=3;**edge∩catalog=0**,**platform 3 个全部已含于 edge** ⇒ 去重 **238** | ✅ 成立 |
| 100 GET / 138 write | method 分布 GET=100、POST=108、PATCH=22、DELETE=7、PUT=1 ⇒ 非 GET **138** | ✅ 成立 |
| 数组 request schema **24**、元素独立写 **1** | 我第一次跟 `$ref` 分片算得 **23**,与设计差 1;定位到唯一差异项 `createOperationsOrganizationProject`,打开 `contracts/openapi/components/organization/organization-hierarchy.schemas.json` 的 `OrganizationProjectCreateRequest` —— 数组 `phases` 在 **`allOf` 第二分支**里,**我的扫描器没处理 `allOf`** | ✅ **设计的 24 成立;23 是我的测量假象**,已纠正 |
| 元素独立写只命中 `batchTransitionOperationsCatalogItemStatus` | 逐条核对 §5.1 的 24 行判定:其余 23 条均为"一个聚合的成员数组"(邀请 roleIds、角色 capability set、定义 allowedValues、copy closure、有序集合原子替换、商品聚合、组织节点 phases) | ✅ 成立 |
| 旧 `performanceCriterion`/provider 壳/lane/`correctnessCases`/`acceptedBaseline` 已退役 | 在 TC runner 与全部 acceptance 源码中逐个 grep,**5 项全部 0 命中** | ✅ 成立 |

---

## 2 · 逐项核验(话术九点)

1. **238 / 100 / 138** —— 见 §1,全部成立。
2. **24 / 1 数组闭集** —— 成立(我的反例被自己证伪)。§5.1 末句「实现期生成器必须重新算此表;
   名称扫描只作下限。若 exact-set 不同,停机更新设计」写得对 —— **这条正是我这次踩坑的防线**。
3. **L1 覆盖面** —— 完整。远端 process identity = `trusted host + boot id + PID + /proc start ticks + command digest`;
   本机 tunnel/Vite = `PID + OS start token + command digest`;**只停止 manifest 拥有的 identity**;
   readiness 要求日志出现 `Started CateringV2sApplication` 且两个 Vite listener ready,
   **端口存在本身不算 ready**;FORBID 逐条点名 PostgreSQL forward、本机 Java fallback、
   按端口杀进程、secret 写进 manifest、移除 asset tunnel、start 自动 seed。
   **browser L2 未被误改**:全文只在授权边界与证据档位声明中出现。
4. **TC 与 DEV 联动** —— 串行计划第 135 行:TC 启动前读 DEV manifest,原有 DEV 则受管 stop 且要求
   cleanup PASS,记 `DEV_WAS_RUNNING`;**只有 business/cleanup 双 PASS 且原先有 DEV 才恢复**;
   测试失败或原先无 DEV 均不启动;**该联动不执行 reset/seed**。manifest ownership 保持,未扩张授权。
5. **238 budget 由独立 run-level verifier 消费** —— CP-03/04 明写以
   `(runId, requestId, correlationId, operationId, routeTemplate)` 唯一,
   **scenario sink 不作分母真相,性能结果不参与单场景 `CONTRACT`/`BUSINESS`**。✅
6. **无哨兵值/无 fallback/顺序唯一** —— CP-02 逐个点名排除
   「`CALIBRATION_PENDING`、null、哨兵预算、默认无限预算、双 registry」;
   激活顺序为「CP-05 前只保留现有**非门控** completion event,不创建 pending metadata →
   238 实值齐全 → 一次原子完成生成与启用」。✅
7. **layer classification 防漂移** —— 复用 `DatabaseOperationTracker.defaultSection(kind, callSite)`
   为唯一模块层归属入口,owner module 的 SELECT→OWNER_READ、UPDATE/BATCH→OWNER_WRITE;
   **删除仅为分类而写的分散 `pushSection`**,新增 owner SQL 不改标记代码仍自动归类;
   并有**负控制**:foundation/edge 中未进入任何已知层的 SQL **仍为 UNCLASSIFIED**,
   「不能把默认值改成 OWNER 取得假绿」。✅ 这条负控制是本设计最关键的一句。
8. **batch 预载仍在每项 `REQUIRES_NEW` 内复核** —— CP-06 明写「预载不能替代权威复核」,
   每项按 itemRef+scope 重新锁定并复核版本、状态与所有写前业务条件;
   strict order(同 key 同成员换序即 mismatch)、replay 走同一 strict parser、
   前端**不得 Map 对齐或补 `RESULT_UNKNOWN`**;`reason` 由 owner 脱敏生成、前端无本地 fallback;
   **B-06 不新增审计语义**。预算按 `15+5×N` 且「transaction/connection 随项线性是允许形态」——
   与 Dexter 的逐项尽力裁定一致,没有为压计数改回单事务。✅
9. **模板四项** —— §3 横切表 **17 行齐**,第④列为真实全集(100 GET、138 write、batch 1–100、
   238 registry、IA 5+5 类等),不是举例;§7 声明—传递—消费矩阵含机制行;
   **§9b 16 个锚点我逐个数了命中次数,16/16 全部唯一命中**(上一批那张表有两个死锚点,本批已消除);
   §10b seed 两栏齐且给出 `NOT_APPLICABLE_WITH_REASON` 而非留空;
   §11 失败判据可执行(退出码判绿、`declared=measured=passed=238`、
   `saveOperationsCatalogItem` avg 下降 ≥90%、预算调高差集必须为空或逐条 decisionRef)。✅

---

## 3 · Findings

### S-1 · P2「57 个 GET」在本设计中已是历史基线,但需求稿仍把它写成当前分母 —— `CONFIRMED`

- **事实**:详设 §2 末段写明「CP-06–12 只能在 CP-05 当前树重分类后执行,
  **历史 94/4/57/36/9/38 仅是输入基线**」;CP-09 的失败条件亦写作「任一**确认成员** borrow≠1」。
  这是对的 —— 分类必须在当前树上重算。
- **但**:需求正本
  `doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-requirements-claude.md`
  §2 与 §8 把 94/4/57/36/9/38 呈现为**当前分母**(那是我写的,基于 08-21 的 evidence)。
  两份文档对同一组数字的时态不同:详设说"历史基线",需求说"当前分母"。
- **影响面**:实施期若有人按需求稿第 8 节的清单逐个整改,会把 CP-05 重分类的结果覆盖掉,
  或把已经不在该类的成员仍按旧类处理。
- **区分**:两处表述为【事实】;"会有人按旧清单施工"为【推论】。
- **最小修复**:需求稿 §2/§8 加一句时态标注 ——「以下为 2026-08-21 evidence 的基线快照,
  实施期以 CP-05 当前树重分类结果为准」。**改需求稿一句话,不动详设。**
- **更大方案的成本**:另一种做法是先跑 CP-05 再回写需求稿分母 —— 但那会让需求稿依赖运行结果,
  违反"需求先于实施"的次序,**不采用**。
- **需 Dexter 裁决?** 否(是我自己文档的时态标注)。

### N-1 · 内部两轮审查程序面合规,但 Round 2 遗留一条 N 未在详设留痕

Round 1 `M/S/N=1/1/0`、Round 2 `M/S/N=0/0/1` 且 `ROUND_FINAL_DECISION=SELF_DECIDED`,
两轮均有 `reviewerKind` 与盲审声明,两轮上限合规。Round 2 那条 N 的处置在 intake 里,
但未在详设正文留下对应痕迹 —— 建议按 §7 的 intake 纪律把结论回写一行,便于下一轮复核。

### N-2 · 交接话术中的仓根绝对路径与实际不符

话术写 `/Users/dexter/Documents/workspace/idea/catering-v2s`,实际为另一路径。
本轮按实际仓根执行,不影响结论。建议交接一律用**仓库根相对路径**,避免在别的机器上失效。

---

## 4 · 未验证边界(动态 / DEV / TC / L2 / seed / UAT)

本轮**只做静态设计复核**,以下全部**未验证**,设计中也未声称已验证:

1. **L1 前后对比数字** —— `saveOperationsCatalogItem` avg 下降 ≥90% 是设计判据,未执行;
2. **远端主机资源是否够跑 Java 服务** —— 需求 §9 已列为未验证,详设的资源预检是设计不是实测;
3. **238 calibration** —— `declared=measured=passed=238`、`P0=0`、`UNCLASSIFIED≤5%` 均未跑;
4. **managed Testcontainers 全量** —— 未跑;TC↔DEV 联动规则未实测;
5. **reset / start / seed** —— 需另行授权;设计明写 start 不 seed;
6. **browser L2 与 UAT** —— 未授权未执行;设计明写「未授权则明确未验证,不用组件测试冒充」;
7. **layer classification 的防漂移性质** —— 「新增 owner SQL 不改标记代码仍正确归类」
   是设计判据,需实施期用真实新增查询证明;
8. **24/1 数组闭集的生成器复算** —— 设计要求实施期由生成器重算,本轮为人工静态核算。

---

## 5 · 收口

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B(模板缺项 0;跨文档时态不一致 1=S-1;死锚点 0;无出处数值 0)
VERDICT=GO
M/S/N=0 / 1 / 2
方案合理性=成立(问题真、三处判断优于我的原始分析、代价匹配)
数字复算=238/100/138/24/1 全部独立复算成立;其中 24 一项我先算得 23,经定位为自身扫描器未处理 allOf,已纠正
SAME_ROOT_SCAN=§9b 锚点 16/16 逐个数命中次数,全部唯一 · 旧 lane/provider/criterion 5/5 全部 0 命中 · 数组闭集 24/24 逐行判定
DESIGN_GAPS=无需新增正本;S-1 为需求稿一句时态标注
EVIDENCE_TIER=静态读源码 + 独立复算 registry/OpenAPI 分片/method 分布/数组闭集 + 锚点命中计数。⛔ 未运行任何门、未跑 TC/DEV/seed/L2/UAT、未写入除本文件外任何路径
```

**授权边界**:本 GO 仅表示该设计可作为后续 implementation 授权的输入。
不授权实施、生产代码或契约修改、测试执行、DEV/reset/seed、browser L2、UAT、部署、
数据操作或任何 Git 操作。S-1 建议在 CP-00 开工前以一句话修订折入需求稿。
