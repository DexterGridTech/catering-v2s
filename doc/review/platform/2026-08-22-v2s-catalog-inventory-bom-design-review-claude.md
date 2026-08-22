# 商品库存与 BOM 业务模型 · implementation-facing DESIGN review(Claude 独立复核)

- 日期:2026-08-22 · 作者:Claude · 被审:Journey / 交互稿 / IA / 详设 / 串行计划(五件)
- 会话出处:续接会话。全部结论由本轮重开正式需求、六份设计工件与八个 owning source 亲验;
  **未采信内部 Round 2 的 GO**,其结论只作为待验证输入。

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B 文档提取(缺项/矛盾/无出处数值,非空)
VERDICT=GO
M/S/N=0 / 2 / 2
```

---

## 0 · 方案合理性

**问题对不对** —— 对。详设 §1.1 的病灶陈述我在源码上验过:同一 owner 的扣减方式散在
`sections.inventoryConfiguration.nodes[]`、`catalogDraft.inventoryBom[]`、
`orderOptionConfigs.values[].materialQuantities[]` 三处,没有一个住址。收成单一
`inventoryRules` aggregate 是对症的。

**方案优不优** —— 优,且替代已被真实比较。§1.2 的 A(只重排卡片)/B(两表正交)拒绝理由成立:
B 的拒绝理由是"同 owner 可同时 active,销售链必须自行决定是否双扣",这是语义缺口而不是口味问题。
我另构造的第三替代 ——**分两批(先契约+后端矩阵闭合,再 UI 重构)**—— 与作者的一批式比较后:
串行计划 CP-01→CP-07 本身就是内部串行且只有一个交付单元,拆两批会让 CP-04 消费一个尚未
被 acceptance 证明的契约,反而增加返工。**作者的一批式合理,不构成 finding。**

**代价配不配** —— 配。没有第三张真相表(A-05 复用两张 owner 表的 `definition_status`)、
没有 fallback、没有双写;§13 停机条件八条与串行计划 §12 九条都写得出失败条件。

---

## 1 · 逐项核验(九点)

1. **63 格矩阵是否 contract 完整约定** —— 是。详设 §11.1 给出 7×3×3 全表且每格 `Y`/`R` 有值,
   §11.1 末句「`usageCapabilities` 不参与前三列准入」与需求第 239 行(上一轮 S-3)一致。
   前后端补义的口子由 §7 声明—传递—消费矩阵关闭:allowedModes 由 P1 声明、UI 只展示、
   inventory 再核验。✅
2. **单一 aggregate + 重派生 + 原子 replace + REQUIRED rollback 是否最小可靠** —— 是。
   §6 跨 owner 写矩阵把回滚事实写成可证伪句(「inventory/asset 任一失败:catalog item
   version/sections、target/BOM status/rows/version、asset binding、所有 child receipt 一起回滚」),
   且复用既有 `SaveOperationsCatalogItemOperation.execute @Transactional(REQUIRED)`,不新建事务壳。✅
3. **A-05 四维,尤其 HISTORICAL_DEFINITION** —— **成立,且我独立重建后确认它不是新语义。**
   我先不看作者结论自行推:A-05 裁定含四维,而前三维(余额/流水/BOM引用)都是"当前事实";
   第四维若解释为 ledger 或单位快照,则与第二维冗余 —— **只有"命令开始前已存在的 DISABLED
   定义行"这一读法能让第四维非冗余且可执行**。这与详设 §8.1 逐字相同。
   「首次切换不自阻断、第二次自动切换拒绝」是该读法的直接推论,不是新增产品语义。
   Journey §3 前提链末行已把该语义写入且状态为 `DEXTER_ACCEPTED`,**无需第三 truth,也无需再裁定**。✅
4. **组件五条件 + 自引用两端复核** —— 是。§3 候选行与 §11.3 均要求 candidate SQL 过滤与 save 时
   同条件复核,六个 red case「candidate 隐藏与篡改 save 拒绝都断言」。✅
5. **三布局能直接消费 generated detail、未误伤四类** —— 是。IA §2.2 `forbiddenUI` 把
   「标签、SKU 销售属性值、商品属性进入 owner tree」列为出现即缺陷,§11.3 有对应 red case。✅
6. **17 行横切表 / 15 problem / migration / 幂等 / 缓存 / 日志 / owner 边界** —— 闭合。
   17 行齐、第④列为全集不是举例;IA §4 十五个 code 与 §5 计数自证一致;
   §10 迁移四行均写明「旧行回填什么、为什么那是唯一可恢复事实」。✅
7. **80 分母与全集覆盖** —— 数字我独立复算:`@AcceptanceScenario` 静态计数 **77**(逐文件相加),
   `saveIndependentSku*` 调用点 **20**,当前 OpenAPI operationId **56**,+1 candidate = **57**。
   三个数与详设一致。63/8/6/3 在 §11.1–§11.3 可逐条推出。✅(另见 S-1)
8. **seed 唯一源与丰富度** —— §10b.1 列九个受影响文件并声明「只在 P1 且只在这里」;
   §10b.2 两栏分开;§10b.3 八条覆盖判据**每条都写得出失败条件**(如「所有 target 都有或都没有
   counting unit」)。七 shape、三方式、SKU 各自 BOM、选项正负、共享 `BOX-001`、盘点有/无、
   A-05 历史实例俱全。✅
9. **串行计划可执行 / 无未裁语义、fallback、双写、第三真相** —— 是。CP-08 把全部动态动作
   挡在"另行授权"之后,静态与动态证据分账清楚。✅

---

## 2 · Findings

### S-1 · 「77 基线」是静态计数,而最近一次全量 run 只发现 76;第 77 条从未执行过

- **事实链**:`@AcceptanceScenario` 逐文件相加 = **77**(CatalogAcceptanceScenarios 35 + 其余 42);
  最近一次全量 run(`.runtime/r5/evidence/remote-testcontainers/r5-tc-1787321536079-56325`)
  `discovered=selected=results=76`。差集唯一一条:
  `inventory.count-preserves-consumption-precision-without-counting-unit`
  (`CatalogAcceptanceScenarios.java` 第 288 行)。
  该文件 mtime `08-22 00:23`,run 起于 `08-21 23:12` ⇒ **该场景在 run 之后加入,从未被执行。**
- **为什么要紧**:它正是单位模型批次 M-1(无盘点单位时静默整数截断)的判据场景。
  详设 §11 与串行计划 CP-05 都把 77 当作"当前源码静态计数"基线,并把 CP-05 的可证伪观察写成
  `discovered=selected=80`。若第 77 条因未注册/未被发现而在实施期仍不进 discovery,
  **该门永远拿不到 80,CP-05 会以"基线不符"停机**(串行 §12.7 正好是这条停机)。
- **区分**:计数与 mtime 为【事实】;"实施期仍不会被发现"为【推论】——也可能只是本次 run 早于该场景。
- **最小修复**:CP-00 的实时分母复核里加一条 —— 不仅数注解,还要跑一次 discovery 确认
  `annotated == discovered`;差集非空即先闭合,再谈 +3。
- **需要 Dexter 裁决?** 否。

### S-2 · 详设 §9b 有两个死锚点,而 §9b 的作用正是让实施者定位改点

- **事实**:§9b 第 207 行声明 contract source 锚点 `const shapeAdmission =` ——
  在 `scripts/generate/catalog-inventory-p1.mjs` 中 **0 命中**(真实符号是 `const shapeNodeAdmission =`,
  第 368 行);第 212 行声明 catalog owner 锚点 `writeCatalogUnitSnapshots(` ——
  在 `CatalogOwnerService.java` 中 **0 命中**(真实符号是 `writeItemUnitSnapshots(` 与
  `writeSkuUnitFacts(`)。其余抽查的锚点(`operationMetadata`、`inventoryConfigurationSaveSchema`、
  `inventoryBomLineSchema`、`catalogDefinitionSeed`、`seedDatasets`、`saveCatalogProductBomCore(`、
  `CatalogItemSaveEnsureTargetCommand`、`inventoryBomDraft`)**均命中**。
- **影响**:实施者按 §9b 定位会在这两处扑空;`shapeAdmission` 尤其要紧 ——
  它是 A-01 落地的**主改点**,扑空后可能改到别处或自建第二处准入声明。
- **区分**:全为【事实】(grep 计数)。
- **最小修复**:两个锚点改成真实符号名。
- **需要 Dexter 裁决?** 否。

### N-1 · 交互稿 §3 的 all-v2 盘点结论无法在本仓复验

`CIB-01/CIB-02` 的 v2 对应关系写作「在 `../catering-all-v2` 静态检索无业务面命中」。
该仓不在本轮授权输入清单内,我未打开,**标 `UNVERIFIED_REQUIRES_EVIDENCE`**;
所引 v4 三个组件文件与线框 SVG 我已确认真实存在。不阻断。

### N-2 · A-05 被拒后的"显式治理"出路,本批只写了"未来"

详设 §8.1 末句「再次切换必须走未来显式治理」。本批不做该治理是正确的范围控制,
但用户在第二次切换被拒后,当前批次内**没有任何可执行出路**(IA §4 的用户可见处理是
「不提供强制切换」)。清库阶段可接受,记录以免上线后成为死路。

---

## 3 · 未验证清单

- 八维证伪 workflow 在本轮结束前未产出,**其结论未纳入**;本文全部结论出自我的直接亲验。
- `../catering-all-v2` 盘点(N-1)。
- 内部 Round 1/Round 2 的输入清单哈希未复算;但两轮 sha256 不同,可证 Round 2 确实重读了修订后文件,
  **程序面(fresh 独立子 agent、盲审声明、两轮上限、SELF_DECIDED 收口)合规**。

## 4 · 收口

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B(模板缺项 0;跨文档矛盾 0;死锚点 2=S-2;无出处数值 0;分母口径 1=S-1)
VERDICT=GO
M/S/N=0 / 2 / 2
方案合理性=成立(问题真、C 优于 A/B、我另构造的"分两批"替代经比较后不优)
上一轮三条 S 与两条 N=全部折入(需求稿第 239、262、400、410、427 行;两份 08-06 文档均有 SUPERSEDED-BY)
A-05=独立重建后确认为裁定的最小可执行化,非新语义,无需再裁
DESIGN_GAPS=无
EVIDENCE_TIER=静态读源码 + 数字独立复算(77/20/56+1)+ 锚点 grep 复验 + 复核既有 76/76 run 的原始 jsonl。未运行门、未写入除本文件外任何路径
```

**授权边界**:本 GO 仅表示该设计可作为后续 implementation 授权的输入。不等于实施授权,
不授权契约/代码修改、测试、DEV、reset、seed、browser L2、UAT、部署或数据操作。
两条 S 建议在 CP-00 开工前以文本修订折入,不需要重开裁定。

---

## 附录 · 收口后到达的多维证伪补充(2026-08-22 深夜)

主评审收口后,后台八维证伪扇出完成了 4/8 维(其余因会话额度中断,对抗复核未跑)。
其中三条经我本人回源码坐实,**升级本轮结论为 GO 附加三条 S 待折入**(M/S/N 修订为 0/5/2):

**S-3(升格自扇出 matrix 维)· A-01 声明层退役零落点。** 需求 §5.1 裁定 OPTIONAL_TABLE 与
HAS_SKU/NO_SKU 两种口径「都不再保留」,但 `OPTIONAL_TABLE`、`skuMode`、`hasSkuRule` 在详设
与串行计划**全文零命中**(本人 grep 复验)。p1.mjs 第 172/174/176 行 shape 声明、第 219–231 行
`modeRules` 的 HAS_SKU/NO_SKU 条件、第 447–449 行 `hasSkuRule` 等旧口径声明都不在 §9b 变更
定位或任何 CP 步骤中 —— 实施可以在不触碰它们的情况下满足 CP-01 全部已写门,让 manifest 继续
对外宣告旧粒度,形成同一事实第二住址。**最小修复**:CP-01 增补退役清单(上列行级声明逐条列出)。

**S-4(扇出 crossdoc 维)· DIRECT 一级文案两套「逐字」权威互斥。** 交互稿 USER_VISIBLE_COPY
固定「直接扣当前商品或 SKU」;而已接受线框 SVG 中实为「直接扣当前商品库存」「直接扣当前 SKU 库存」
两个变体(本人 grep 复验)。详设同时要求「与线框逐字一致」与「与 USER_VISIBLE_COPY 一致」,
二者不可同真。**需 Dexter 一句裁定**:按 owner 上下文取两变体,还是统一回单一标签。

**S-5(扇出 crossdoc/template 维)· 文案分母不全 + IA CIB-01 容器行为未逐字引用交互稿。**
选项值一级文案、树节点摘要、五条件提示、IA §4 新增六条中文均不在交互稿 USER_VISIBLE_COPY 分母内;
IA CIB-01 的 containerBehaviorUnderLoad 为转述而非逐字(CIB-02 是逐字的,可照做)。
**最小修复**:补全 USER_VISIBLE_COPY 唯一分母;CIB-01 静态半边改逐字引用。

扇出另有两条(A-05 触发谓词与 X→NONE 分支未钉住;组件复核锁形态)未经对抗复核亦未经我
回源码,标 `PLAUSIBLE_UNVERIFIED`,交 Codex 辩证 intake 自判。
