# 商品库最终范围 DESIGN 独立对抗审查 · Round 2

```text
REVIEW_CYCLE_ID=CATALOG_LIBRARY_WORKBENCH_FINAL_SCOPE_20260824
REVIEW_TARGET=DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
ROUND_FINAL_DECISION=SELF_DECIDED
INDEPENDENT_BASELINE_FROZEN=true
VERDICT=GO_WITH_UNVERIFIED_UI
GO_OR_NO_GO=GO
M/S/N=0/0/1
```

本轮由 fresh independent critic subagent `01a02f90-aa68-7270-9072-5fa377835d89` 完成。reviewer 只读运行，
本文件由作者会话忠实持久化其 verdict；没有把作者结论或 Round 1 verdict 作为通过依据。

## 结论链

`firstFailure`：本轮未复现 DESIGN 阻断首败；Round 1 的 `PROJECT_MEMORY=FAIL / required assertion drift` 已关闭。

`lastKnownGood`：project-memory check 与三条有效六维 recall route PASS；§9b `20/20`；backend acceptance annotation
`80`；IA-ID `8`；当前 L2 基线 `18 scenario / 41 case / FRAMEWORK_ONLY / active=0 / TEST dataset=39`。

`brokenBoundary`：无 DESIGN 语义边界断裂。仅保留 L3 未验证边界：代码、真实 migration、动态 acceptance、browser L2、
DEV/reset/seed、UAT 与部署均未授权、未执行。

## 定向证伪

1. **Round 1 M-01：`CONFIRMED_CLOSED`**。required inventory、业务语料 frontmatter 与生成 index 已原子一致；
   遗漏 assertion/sourceRef 的反例会由同一 check/recall fail closed。
2. **十列表格：`PASS`**。十列精确为“商品、商品形态、价格和单位、规格或选项、商品属性、制作信息、库存与 BOM、
   更新时间、状态、来源”，全部常显；父/规格共表头；四行上限、ellipsis/Tooltip 与横向滚动一致。隐藏来源、斜杠列、
   `expandedRowRender` 文本块、第二条 range 滚动、窄屏卡片均是红反例。
3. **商品生产标签：`PASS`**。contract nullable singular、owner 0..1 复核与 DB partial unique 三层闭合；SKU 仅覆盖
   显示名/时长/说明，option 仅非负时长增量/追加说明；无 route/KDS/打印/队列/fallback。
4. **Migration：`PASS_AS_DESIGN`**。目标只处理持久化 item profile、SKU override、option effect 与 reference，明确不把
   运行时 `sections.productionTagRefs` 当第四份存储；SKU 显式空清除非空 canonical、嵌套不同值、额外 relation 与畸形
   均 fail closed。pick-first/default、兼容数组、吞冲突均是红反例。
5. **生产标签导航/筛选：`PASS`**。全部定义与停用状态可见；count 按未作废父商品去重；专用
   `productionTagRef` 不复用商品标签 `tagRef`；展开返回父商品全部规格；set-based，禁止 N+1/本地过滤。
6. **80 annotation：`PASS`**。当前 80；三组合并 `80→77`，一拆二 `+1→78`，两新增 `+2→80`；navigation、items、
   SKU page、category candidate 宿主 identity 分离，旧断言不得删除。
7. **L2/日志/TEST fixture/seed：`PASS_AS_DESIGN_WITH_L3_UNVERIFIED`**。目标 26/65、active24、47 TEST dataset 是实施后
   readiness 目标；当前仍为 18/41/0/39。DEV seed 不得作为 L2 fixture，focused/static 不得冒充 browser L2。

## N-01 · L3 未验证必须保留

contract/code/test/migration 尚未实施；migration、acceptance、browser L2、DEV/reset/seed、UAT、部署均未动态执行；
当前 production code 的旧多值路径只是实施红基线，不能写成已完成。

## 授权边界

本 verdict 不授权实施、contract/代码/测试修改、migration、DEV、reset、seed、browser L2、UAT、部署或数据操作。
