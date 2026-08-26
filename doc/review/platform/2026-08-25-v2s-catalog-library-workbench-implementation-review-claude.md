# 商品库工作台 · implementation review(Claude 外部独立复核)

- 日期:2026-08-25 · reviewerKind=`EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE`
- 会话出处:续接会话。四份运行证据逐一亲验原始工件,门与分母独立复算,未采信任何自报。
- 按 Dexter 指令,本轮不只对清单:先回答"解决了什么、解决了没有",再逐代码对项目记忆/设计/规范,
  并专查重复轮子、自成体系、绕开 foundation。

```text
REVIEW_TARGET=IMPLEMENTATION
VERDICT=NO-GO
M/S/N=1 / 2 / 2
FIRST_FAILURE=本批新增 GET 的预算与连接双超限,而预算门因 V2S_BACKEND_PERFORMANCE_EXACT_SET 未设而整体跳过(M-01)
LAST_KNOWN_GOOD=除性能治理外的全部主线:单标签三层、L2 24/24 真实执行、seed 读回规则、工程拆分、术语统一
BROKEN_BOUNDARY=TC 验收链与性能门之间 —— 门存在但是"选跑"的
BUSINESS=FAIL(仅 M-01;业务功能主线全部达成)
CLEANUP=PASS(四份证据的 cleanup 各自分账亲验,见 §1)
```

---

## 1 · 先回答 Dexter 的问题:这批解决了什么,解决了没有

**要解决的三件事**:①商品库交互模型系统性重做(查看/编辑分壳、十列表格、配置抽屉、草稿恢复);
②生产标签从多值伪语义收敛为商品级单一业务分类;③把 browser L2 从"设计"变成"真跑",并系统性重建 seed。

**结论:三件业务事都解决了,且质量高;倒下的是第四件 —— 性能治理的"防增量"承诺**:

- **交互模型**:`CatalogItemDrawer` 从 5,677 行拆到 **17 行**(纯装配);生产 TSX 12→**49 个**,
  其中 **19 个 View/Editor 分文件**;**31 个文件**消费 `catalogTestIds` 常量;
  旧六 Tab `CatalogDictionaryDrawer` 缩为 13 行转发壳。「商品形态」前端残留 **0**,`tagKind` 残留 **0**。
- **单一生产标签**:正向链多值**精确退出** —— 全后端主链唯一残留是
  `CatalogOwnerService.java:5632` 的**恶意旧字段拒绝清单**(设计要求的 fail-closed,合法);
  `CatalogItemReferenceFacts` 全 singular;partial unique 真实落库
  (`V20260824_120000_000` 第 467 行 `ux_catalog_item_reference_production_tag_item_ref`)。
- **L2 真跑**:`discovered=selected=results=24`、`activeCaseIds=24`,
  逐 case `budgetMs=28000` 时长预算,join artifact 存在,`business=PASS`、`cleanup=PASS`;
  拓扑如设计(`LOCAL_SPRING_LOCAL_VITE_LOCAL_PLAYWRIGHT_REMOTE_DB_ASSET_TUNNEL`)。
- **seed**:话术点名的两条规则在 executor 第 60–65 行逐字落地
  (叶商品含 **ITEM/NONE** 编辑节点;SKU 父行返回 `{grain:"SKU", mode:null}`);
  `business=PASS`、`cleanup=PASS_PRESERVED_DEV_STATE`。
- **四份证据 cleanup 分账**:TC 五项全 PASS;L2 双侧 PASS;seed 保留 DEV 态;reset 两项 PASS。
- **最终生成态无已清理 L2 namespace 残留**(contracts/generated 全扫零命中)。

## 2 · Findings

### M-01 · 本批新增 GET 双超限,而性能门在验收链里是"选跑"的 —— `CONFIRMED`

- **行为事实(从本次 TC run 的 4539 条原始事件实算)**:
  `getOperationsCatalogItemSkus` 实测 `databaseOperationCount=24`(两次)——
  其生成预算 `FIXED max=12`,**超限一倍**;借连接最高 **10 次**(GET 应为 1)。
  `getOperationsCatalogCategoryCandidates` 借连接 3 次(5 调用中 4 次 >1)。
  两者恰是**本批新增的 task-read** —— 性能批修好的 57 个旧 GET 全部仍为 1,
  **新代码没有套用只读连接作用域**。
- **门为何没红(根因钉死)**:`r5-remote-testcontainers.mjs` 第 565 行 ——
  预算/连接/exact-set 断言仅在 `V2S_BACKEND_PERFORMANCE_EXACT_SET === 'true'` 时执行;
  本次 run 的 manifest `measurementEvidence` 里 `budgetEvidence`/`connectionBudgetEvidence`
  **双缺失**(仅 UNCLASSIFIED 比例是无条件断言的,实测 0.00%/58007 条 ✅)。
  ⇒ **门存在但默认不跑** —— Dexter 裁定"把门加回来"防的正是增量回归,
  第一批增量就从env 开关下面钻过去了。
- **违反的正本**:详设自身不变量「GET connection≤1」(serial 第 204 行);
  项目记忆 `REQUEST_BOUNDARY_HAS_ONE_OWNER`、`BUDGET_CALIBRATED_AFTER_REPAIR_NOT_BEFORE`
  (超限的正解是修实现,不是抬预算)。
- **最小修复(两半都要)**:①给两个新 read 套用性能批的只读连接作用域,
  `ItemSkus` 的 24 次往返按同族 set-based 收敛回预算内 ——
  ⛔ 不得改成把 max 提到 24;②TC runner 把预算/连接断言改为**默认执行**
  (或在标准验收链固定设置该 env),红夹具:造一个超预算事件必须让 run FAIL。
- **需 Dexter 裁决?** 否(两半都是既有裁定的执行)。
- **同根扫描**:本批新增 read 共 2 个,**双双**超限;240 个 operation 其余在门下历史绿。

### S-01 · seed executor 在 seed 运行窗口内被修改,当前字节未被证据完整覆盖 —— `CONFIRMED`(定性)

- **时序事实**:seed `startedAt` 18:33(本地),报告写于 **19:36**;
  `catalog-inventory-seed-executor.mjs` mtime **19:05:28** —— 落在运行窗口内。
- **两种可能,证据无法区分**:①单进程 18:33 加载后一路跑完 ⇒ 19:05 的修改**从未执行**;
  ②分阶段逐次 spawn ⇒ 后段阶段跑的是新字节、前段是旧字节。
  无论哪种,**"当前树的 executor 整体通过了 seed"这个命题不成立**。
- **最小修复**:Codex 说明 19:05 改了什么;若属行为性修改,需 Dexter 授权后 fresh 重跑 seed 留证;
  若纯注释/日志,书面登记即可闭。
- **需 Dexter 裁决?** 仅当需要重跑 seed 时(一次运行授权)。

### S-02 · `CatalogWorkbenchPage` 宿主未按工程结构要求拆到"只装配" —— `CONFIRMED`

- **事实**:1,787 行(重构前 1,742,**不降反升**)、单文件 **60 个 hook 调用**、仅 3 个顶层声明。
  对照本批硬要求「宿主只做装配与生命周期,目标 ≤300 行」——
  `CatalogItemDrawer` 做到了(17 行),工作台宿主没有。
- **影响**:Dexter 点名的"后续没法维护"风险在最大宿主上原样保留;
  可证伪判据「新增区段字段宿主零改动」对表格列/筛选/批量域大概率不成立。
- **最小修复**:按已成立的同批先例拆 —— 列模型、批量域、筛选域、抽屉编排各自成文件,
  宿主收敛到装配;不新增机制,照 `CatalogItemDrawer` 的拆法做即可。
- **需 Dexter 裁决?** 否。

### N-01 · L2 manifest 的 `joinArtifactPath` 记录绝对路径

指向 `/Users/dexter/...` 前缀;同一文件在本机 `/Volumes/idea/...` 视图下存在 ——
**顺带解开长期悬案:两个仓根是同一磁盘的两个挂载视图**。建议 manifest 记录仓根相对路径,证据可携带。

### N-02 · `V20260825_010000_000__retire_production_tag_kind.sql` 是设计后新增的跨 owner 迁移

删除 `fulfillment_production.production_tag_definition.tag_kind`。迁移注释自带登记理由
(「内部 kind 细分无已批准语义,不得作为隐藏第二分类器存续」),方向与单一生产标签裁定一致,
前端 `tagKind` 已同步清零。**判定:合法的实施期自主收敛**;建议在详设补一行 addendum 留痕。

## 3 · Dexter 三轴专项(重复轮子 / 自成体系 / 绕开 foundation)

**结论:这一轴是本批的亮点,未发现violación。**
- 49 个生产文件逐一扫描:foundation 引用近乎全覆盖,手搓嫌疑模式
  (自装 keydown/portal/useReducer/IntersectionObserver)**零命中**;
- Drawer/提交/overlay/cursor 生命周期全部走 foundation(6 个文件消费两个生命周期 hook,
  无平行实现);testId 三方同源(常量模块 31 处消费);
- 与其他模块横向对照:错误反馈走 `operationsProblemFeedback` 闭集、读走 generated RTK
  `currentData`、幂等走 `createContentIdempotencyKey` —— 与既有模块同构,无自成体系。
唯一的结构性欠账即 S-02 的宿主本体。

## 4 · L3 未验证清单

1. browser L2 的 24 case 已跑,但**焦点归还/键盘路径**类 oracle 的充分性未逐 case 复核
   (抽验了 progress 结构与预算,未逐条读 48 行 END 记录的断言明细);
2. UAT 未授权未执行;
3. S-01 的 executor 当前字节未被 seed 证据完整覆盖(见上);
4. M-01 修复后的预算复测(需重跑 TC 且开启 exact-set)。

## 5 · 收口

```text
REVIEW_TARGET=IMPLEMENTATION
VERDICT=NO-GO
M/S/N=1 / 2 / 2
SAME_ROOT_SCAN=新增 read 2/2 双超限 · 多值残留全链 1 处且为合法拒绝清单 · 四证据 cleanup 4/4 分账 · 49 文件 foundation 审计零违例
EVIDENCE_TIER=四份 run 原始工件亲验(事件级实算)+ 源码逐点核对 + mtime 时序对账。⛔ 未执行任何运行动作,未写入除本文件外任何路径
```

**NO-GO 的边界**:业务主线(工作台/单标签/L2/seed)全部达成且质量高;
NO-GO 只因 M-01 —— 它不是功能缺陷,是**治理承诺的第一次增量检验就失守**:
新代码双超限 + 门默认不跑。修复两半(连接作用域 + 门默认执行)并复跑 TC(开 exact-set)后,
预期即可 GO;S-01 视 Codex 说明决定是否需要一次 seed 重跑授权。

**授权边界**:本轮仅独立 review。不授权新增产品语义、后续 Roadmap step、UAT、部署、
数据操作或任何仓库控制动作;M-01 复测所需的 TC 重跑与可能的 seed 重跑需 Dexter 明确授权。
