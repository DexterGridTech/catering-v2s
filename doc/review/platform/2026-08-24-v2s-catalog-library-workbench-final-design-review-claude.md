# 商品库工作台(最终范围)· fresh 外部独立 DESIGN review(Claude)

- 日期:2026-08-24 · reviewerKind=`EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE`(不占内部两轮)
- 会话出处:续接会话。**未继承**作者 GO、内部 subagent verdict 或历史 Claude review;
  全部数字重开 owning source 独立复算;先建预期后读工件。

```text
REVIEW_TARGET=DESIGN
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0 / 1 / 0
FIRST_FAILURE=「商品形态」(列头,本轮 Dexter 裁定用词)与「商品类型」(详情/编辑区,CIPG 批裁定用词)在同一 App 并存 —— 见 S-1
LAST_KNOWN_GOOD=全部分母/三层单标签/迁移 fail-closed/十列规格/L2 目标 —— 独立复算逐项成立
BROKEN_BOUNDARY=用户术语层:3-K 动词表未收编「形态/类型」这一对同义词
```

---

## 1 · 独立复算(逐项,不采信自报)

| 声称 | 我的复算 | 判定 |
|---|---|---|
| §9b anchors 20/20 唯一 | 解析 20 行,逐行 `grep -cF` **20/20 唯一命中** | ✅ |
| acceptance annotation 80 | 全目录求和 **80** | ✅ |
| IA-ID 8 | `### …IA-` 小节实数 **8** | ✅ |
| project-memory build/check | 本会话 fresh 跑 **exit=0**,`PROJECT_MEMORY_CHECK=PASS`(同时独立确认内部 Round 1 M-01 已真实闭合) | ✅ |
| L2 基线 18/41/0/39 | scenarios=18、cases=41、`FRAMEWORK_ONLY`+enabled=0、testDatasets=39 | ✅ |
| L2 目标 26/65 / active 24 / datasets 47 | 详设第 206/884/926 行;算术 18+8、41+24、39+8 全成立 | ✅ |
| 80→77→78→80 | 三组合并配对我逐对核了**真实 annotation operation**:SKU 两场景同为 `saveOperationsCatalogItem`、copy 两场景同为 `executeOperationsBrandCatalogCopy`、盘点两场景同为 `countOperationsInventoryTarget` —— **三对全部同 operation**;合并表逐 subcase 保留旧断言并各配 red mutation;一拆二 + 两个 task-read(`item-sku-page-contract`、tag/navigation)= 80 | ✅ |
| 旧 CIPG partial supersede | 记忆门 PASS + 语料/正本更新(intake M-01 处置) | ✅ |

## 2 · 十三条 Dexter 裁定的落地核验

**十列表格**:formal §4.2 列表逐列有宽度、父行/子行/约束三栏 ——
商品列**严格四行**(名/码/完整分类路径/≤2 标签+N);规格子行**严格两行**(规格名/码);
价格列"多种单位必须**逐项带业务类型**,不得只列名称";规格或选项列"**不显示共 N 个代替内容**";
制作信息列四行含**单一生产标签**;库存与 BOM 用「不参与库存/直接扣当前商品/按用料扣减 · N 项」;
四行上限 + `EllipsisTooltip` + 第四行「还有 N 项」;`scroll.x` 按最小宽度和计算、禁 `colSpan`
第二套列模型、商品列固定、加载/失败/加载更多各占一条子行且只写商品列。**可实施性成立**。
⚠️ 我上一轮"默认/可选两档列"的 S 被裁定 4(十列全默认、横滚正常)**推翻,已随裁定作废** —— 如实记录。

**单一生产标签三层**:
- contract:详设第 115 行 —— profile/SKU/option schema **删除标签字段**,items query 增专用
  `productionTagRef`,navigation 增 `productionTags[]`;
- owner:第 882 行 —— `0→1、1→0、1→另一个、重复/双值篡改、停用既有可见、新绑定停用拒绝、跨 scope`
  全集进 focused/integration;第 866 行 `CatalogItemReferenceFacts` 提供 **singular replace/read**,
  「禁止给 singular 再套 array 兼容层」;
- DB:第 864–865 行 `UNIQUE(item_ref) WHERE kind='PRODUCTION_TAG'` partial unique。
**前端单选未被当防线**(第 412 行「三层强制,UI 只消费」)。✅

**SKU/option 标签退役**:红基线我亲验(当前 `CatalogPreparationFacts` 第 24/26/42/72 行仍是多值,
`catalog_item_reference` 现无 partial unique)—— 设计对 copy/promotion/readback/reference closure/
seed/migration 六面**全部覆盖**(第 869–871 行 create/save/copy/promotion/readback/closure 同步改
singular;第 872 行 copy 冲突「不丢弃、不选第一个」)。**全文未发现任何允许恢复多值的条款**;
运行时派生 `sections.productionTagRefs` 被明确定性为「不冒充第四份存储」(第 90 行)且
schema 删除即退休。✅

**迁移**:四个真实持久化点位逐一处置(第 461 行),每类冲突语义精确 ——
SKU 显式空集合清除非空 canonical = **冲突**;option add 仅空或重复 canonical 可删;
relation 缺 canonical 确定性补齐、含不同值冲突;禁 pick-first/dual-read/fallback/默认标签;
**Flyway 事务内重跑同一 predicate**(第 90 行)。✅

**生产标签导航**:count = 绑定该标签的**未作废父商品去重数、不含 SKU 重复**(第 537 行);
专用 `productionTagRef` 不复用 `tagRef`(第 538 行两筛选互不串用 + red mutation「错接到 tagRef 必红」);
set-based(第 125/315 行)。✅

**改名**:五份工件「生产标签」共 99 处;「制作处理标签」仅余 3 处 —— 两处是 U-CATUI-11
改名裁定原文、一处是"旧段落出现即…"的元条款,**均为合法残留**。✅

**技术词**:交互稿 USER_VISIBLE_COPY 1129 字对 10 词全集**零命中**。✅
**本期非目标**:第 874–875 行无 route/dispatcher/工作台/队列/KDS/默认路由,
「最多一个不等于必须有一个」。✅

## 3 · Finding

### S-1 · 「商品形态」与「商品类型」同指一事、两词并存 —— `CONFIRMED` + 轻量 `DEXTER_DECISION`

- **事实**:列头按本轮 Dexter 裁定原文用「**商品形态**」(formal §4.2 第 168 行,176px 列);
  而查看抽屉标题区与编辑区段沿 CIPG 批裁定用「**商品类型**」(formal 第 226/236/244 行)。
  formal 内两词各 5 处、交互稿 2+3 处混用,**无任何一处声明两词关系**。
- **为什么要紧**:这正是本系列 C5 一致性正本(3-K 动词表「一词一义,禁同义混用」)要防的模式;
  两词都出自 Dexter 裁定(不同时间),实施者无从取舍,L2 的技术词/术语扫描也无法立门。
- **反例边界**:若 Dexter 有意区分(列头叫形态、表单叫类型),则需一句成文的使用分界 —— 但那仍是裁定。
- **最小修复**:Dexter 一句话选定其一(或成文分界),写入 3-K 动词表;五份工件全局替换。
- **同根扫描**:十列列名逐一对了动词表与既有批用词,**仅此一对**冲突。

## 4 · 对内部 Round 2 verdict 的独立判定 —— **采信**

理由:①Round 1 唯一 M(记忆断言漂移)我用本会话 fresh 记忆门 **exit=0** 独立确认已闭;
②Round 2 唯一 N(IA 残余"显示列"旧行)属编辑噪音,处置为删除且三状态表本已写"十列无显隐偏好",
与裁定 4 一致;③intake 未改写两轮原始 verdict、两轮上限守住、第三轮明确禁止 —— 程序诚实;
④其 GO_WITH_UNVERIFIED_UI 的全部数字与我的独立复算**逐项吻合**。
采信不等于继承:本文结论独立成立,S-1 是内部两轮未发现的新 finding。

## 5 · L3 未验证清单

1. **实施红基线**:当前生产代码仍是多值(`CatalogPreparationFacts` 多值字段、无 partial unique)——
   这是待迁移的起点,⛔ 不是"已实现"的证据;
2. migration 未真实执行(fail-closed 行为仅为设计);
3. L2:runner 缺位、0 case 激活、8 fixture 未实现;26/65/24/47 全部是目标;
4. DEV / reset / seed / Testcontainers / browser L2 / UAT:本轮均未执行;
5. 十列渲染、四行截断、Tooltip、横滚 sticky、树内生产标签节点交互:无人验证;
6. 导航 count set-based 的实际 SQL 形态与预算:待实施证明。

## 6 · 收口

```text
REVIEW_TARGET=DESIGN
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0 / 1 / 0
执行者需要猜测的点=仅 S-1 的术语取舍(一句裁定即消);其余业务语义、contract 字段、迁移处置、状态控制者与测试 oracle 均为闭集或带失败条件,无需猜测
SAME_ROOT_SCAN=§9b 20/20 · 合并配对 operation 3/3 同一 · 四持久化点位 4/4 · owner 迁移七态 7/7 · 列名同义冲突 1/10 列(仅 S-1)
EVIDENCE_TIER=静态读源码/文档 + 独立复算(锚点/annotation/L2 JSON/记忆门 fresh 运行/合并对 operation 亲验)。⛔ 未执行迁移/DEV/seed/TC/L2/UAT,未写入除本文件外任何路径
```

**授权边界**:仅外部 DESIGN review。不授权实施、契约/生产代码/测试修改、migration 真实执行、
DEV、reset、seed、browser L2、UAT、部署或数据操作。S-1 需 Dexter 一句裁定后随正式稿折入。
