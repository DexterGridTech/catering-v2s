# 商品库唯一工作区 DESIGN review 辩证 intake

```text
REVIEW_CYCLE_ID=CATALOG_LIBRARY_WORKBENCH_20260823_DESIGN
REVIEW_TARGET=DESIGN
REVIEW_ROUND_LIMIT=2
ROUND_1=NO-GO,M/S/N=2/2/1
ROUND_2=GO_WITH_UNVERIFIED_UI,M/S/N=0/0/1
ROUND_FINAL_DECISION=SELF_DECIDED
AUTHOR_DISPOSITION=READY_FOR_DEXTER_CLAUDE_DESIGN_REVIEW
IMPLEMENTATION_AUTHORITY=false
```

## 1. Intake 方法

作者没有把 reviewer finding 当成结论直接照抄。每条均重新打开 formal requirements、Journey、交互、IA、
implementation design、串行计划及 reviewer 点名的当前 contract/owner/controller/frontend/acceptance/L2 owning
source，再判断是否成立。Round 2 已达同 cycle 两轮上限；后续 Claude 外部 review 不冒充内部 reviewer，也不重置轮次。

## 2. Findings 处置

| finding | 作者分类 | 根因/反例边界 | 处置 |
| --- | --- | --- | --- |
| M-001 30/33 写分母冲突 | `CONFIRMED` | 当前 contract 37 个 non-GET；商品库实际消费 33，另 4 个是门店库存管理动作。production tag 三写漏出原 30 表 | interaction exact-set 改 33；详设逐字引用 33，并列 4 条 `OUT_OF_SCOPE_WITH_REASON`；serial CP-00 同步 16/33 |
| M-002 4/6/16 读分母混用 | `CONFIRMED` | 6 是主链强化断言，不是全部 read auth；15 是 scoped operations read；1 是 public asset；当前 contract GET 20，规划 22 | §5.1.1 新增 6/15/1/16/20→22 exact-set；16 条逐一写 controller/owner/state/consumer/proof；IA 主链补 detail/category candidates |
| S-001 分类候选协议未闭 | `CONFIRMED` | 当前 navigation 不含场景化选择资格，UI 本地算后代只适用于旧 reparent；不能充当四场景统一协议 | 冻结 `ITEM_ASSIGNMENT/CATEGORY_REPARENT`、字段组合、root/null、keyword、cursor identity、1..100、page shape、path segment、排序、`disabledReason` 对偶及 owner 重验 |
| S-002 testId/L2 分母未物化 | `CONFIRMED` | “以后补 testId”无法证明 47 surface/所有交互控件/八 Journey 全覆盖；元素存在也不是业务 oracle | §11b 冻结 47 surface literal、control key API、AST/binding/concrete touched 三门及 24 个成功/失败/恢复 case ID |
| N-001 acceptance 合并可能删断言 | `UNVERIFIED_REQUIRES_EVIDENCE` | 当前四个独立 scenario 与 80 annotations 仍在；设计只能冻结未来合并保真，不能冒充已实施 | §11 添加四个 subcase 的 fixture/request/readback/red mutation checklist；CP-11 要求逐项保留；实际证明留到 implementation acceptance |
| N-R2-001 陈旧 `30 UI writes` | `CONFIRMED` | 仅一处机制表文字，未改变 §5.2 可执行 exact-set | 已改为 `33 UI writes`；同根扫描无 30 分母残留；按两轮上限不发起第三轮 |

## 3. 自决与未验证边界

设计已无已知阻断项，提交 Dexter 与 Claude 做外部 DESIGN review。内部最终 verdict 保留 reviewer 原文
`GO_WITH_UNVERIFIED_UI`，不把作者修掉 N 的动作改写成新的独立 verdict。

仍未验证且不得被静态设计冒充：production code/contract/generated 实施、编译/typecheck/focused/static 门、
80/80 HTTP acceptance、两新 cursor 的真实 over-page 行为、testId/locator/L2 物化与 browser L2、DEV/reset/start/seed、
UAT、部署和任何数据动作。这些均未获本轮授权。

## 4. 对实施者的硬交接

未来只有 Dexter 明确授权实施后，才可按串行计划 CP-00 至 CP-13 开工。实施者必须以 IA §2/§3 为控件状态和
级联正本，以详设 §5.1/§5.1.1/§5.2/§11/§11b 为协议与分母正本；不得恢复 `acceptedPage`、多个 open boolean、
disabled Form 详情、平铺分类 Select、SKU 文本展开块、index 身份、generated 手改或任何 fallback。

## 5. Claude 外部 DESIGN review 辩证 intake（2026-08-24）

外部 review 为 `GO，M/S/N=0/1/3`，不占内部两轮，也不自动授权实施。作者重开当前 contract、owner、现行
`CatalogWorkbenchPage` 与性能原始口径后逐项处置：

| finding | 作者分类 | owning-source 复核与反例边界 | 处置 |
| --- | --- | --- | --- |
| S-1 默认/可选列与定序 | `PARTIALLY_CONFIRMED + DEXTER_DECISION_RESOLVED` | 状态第二与普通 AntD Table 无 `columnsState` 成立；“必须把默认列塞进 1280px 首屏”不成立，Dexter 明确接受表体横向滚动并要求不因此缩减信息 | 默认列定为商品、状态、标准价、规格、商品类型、库存扣减、更新时间；库存扣减不可关闭，来源是唯一可选列；AntD Dropdown/Checkbox 只保存来源偏好，不为列设置保 ProTable |
| N-1 L2 隧道时长预算 | `CONFIRMED_WITH_BOUNDARY` | 42.7ms/DB operation 是同口径实测；全部由 tunnel 导致仍是推论 | 详设 §11c.5 从 generated DB budget × request multiplicity × 42.7ms 派生 case/整场预算与 timeout，统一 headroom，不允许逐 case 魔法值；串行计划同步 |
| N-2 跨分类路径 | `CONFIRMED` | 当前 `CatalogItemPage` 只有 `categoryRef`，智能视图/标签/全部商品无法显示完整分类路径；UI 从局部 navigation tree 拼接会漂移 | parent item page 新增 owner 排序的 `categoryPathLabels`；只在跨分类结果域显示于商品副信息，不新增列；acceptance/focused/L2 oracle 同步 |
| N-3 状态旁“使用中” | `REJECTED_WITH_EVIDENCE` | 当前 owner 仅在目标状态 `VOIDED` 时执行 catalog/inventory 引用守卫；`DISABLED` 与 `ARCHIVED` 不因引用拒绝。详情已用 `actionAvailability.voidAvailability` 暴露作废阻止事实。“使用中”还会歧义为在售/有库存，并要求列表新增跨 owner 聚合 | 不把错误的停用/归档前提写进 contract，不加模糊徽标。若未来要在列表巡检“不可作废”，需 Dexter 先确认用户任务与业务文案，再设计精确 `voidAvailability` 摘要，不能借 N 项扩义 |

### 5.1 Claude review 后 Dexter 裁定

- `U-CATUI-08=DEXTER_ACCEPTED`：库存扣减默认常显且不可关闭；来源默认隐藏、可在“显示列”切换。
- `U-CATUI-09=DEXTER_ACCEPTED`：表体横向滚动没有问题，不得以避免横向滚动为由删列或缩减单元格业务信息。
- `U-CATUI-10=DEXTER_ACCEPTED`：商品与规格价格可不设置，商品库只中性显示“未设置”；菜单项必须有价由菜单/
  销售集合 owner 负责。现行红色缺价提示与 `missingPriceCount` 用户呈现不再成立。
- Dexter 同轮要求逐列定义父商品、规格子行的内容与视觉，并以 V4 为参照而非答案。作者重开 V4
  `CatalogItemListTable`、V2S 当前 `CatalogWorkbenchPage` 与 Ant Design 6.5.0 Table API 后，保留父子同表、固定身份列、
  父行选择和懒加载；删除 V4 技术/风险列、额外 range 滑块与技术文案，形成 formal §4.2 / interaction §1.2 的
  逐列正本。
- Dexter 在同一轮先说“库存扣减默认隐藏”后立即更正为“不隐藏”；本工件只保留最后明确裁定，前一句不构成产品事实。
- 本段是外部 DESIGN GO 之后的 Dexter 实质 UI 细化，已经同步到 Journey、正式需求、交互、IA、详设和串行计划；
  尚未被 2026-08-24 Claude review 复核，后续 design/implementation review 必须把本段作为新增输入，不能继承旧 GO
  冒充对新增字节的审查。

当前开放产品项为零。
