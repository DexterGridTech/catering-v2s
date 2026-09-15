# 编辑销售项查看关联商品 · IMPLEMENTATION 独立审查

- 日期：2026-09-15
- 主题：在销售项编辑 Drawer 中查看其关联商品
- reviewer：Anscombe（fresh 独立只读 subagent）
- reviewer agent：`01a0a495-0ec4-70f0-8949-9f7340fb2196`
- 输入清单：[2026-09-15-v2s-sales-menu-product-view-implementation-review-input-checklist-codex.md](2026-09-15-v2s-sales-menu-product-view-implementation-review-input-checklist-codex.md)
- 说明：本文件由主 agent 按独立 reviewer 的原始返回报告整理入仓；reviewer 未写入仓库、未执行 Git、未执行动态环境。

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
reviewerKind=INDEPENDENT_SUBAGENT
blindReviewDeclaration=reviewer 先按输入清单从当前源码和设计材料独立取证，未依赖作者自报结论
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS
L2_USER_VISIBLE=PASS
L3_UNVERIFIED=非空——嵌套 Drawer 的真实浏览器层级、动画、焦点陷阱、脏态保留和失败恢复未执行 Browser L2
SAME_ROOT_SCAN=PASS
DESIGN_GAPS=NONE
EVIDENCE_TIER=STATIC_SOURCE + TYPESCRIPT_DIAGNOSTICS + FOCUSED_VITEST; NO_BROWSER_L2; NO_DYNAMIC_BACKEND
```

## 1. 独立审查口径

reviewer 按 `doc/platform/review-standard.md` 执行 action 1-A（代码提取），重新读取仓根规范、Roadmap 授权、全部 kernel、六维 recall 命中、销售菜单需求/IA/交互/详设/计划、商品详情既有设计和当前 owning source。审查立场为先证伪：不采信作者的“已复用”声明，直接扫描商品详情组件消费者、销售项 surface assembler、Drawer 生命周期、权限参数、测试 trace 与文档约束。

本轮不执行 DEV、reset、seed、backend acceptance 或浏览器 L2；因此 `GO_WITH_UNVERIFIED_UI` 不等同于动态验收通过。

## 2. 当前实现事实

| 核验项 | 结果 | 当前源码依据 |
|---|---|---|
| 入口文案与位置 | PASS | `SalesMenuItemEditorDrawer.tsx:475-483` 在编辑销售项 header action 中加入“查看商品”，与删除动作并列；无商品详情时禁用 |
| 关联事实来源 | PASS | `SalesMenuItemEditorDrawer.tsx:478` 使用已读取 detail 的 `itemCode`，由页面 owner 进入商品详情 |
| 复用既有商品详情 | PASS | `SalesMenuTaskSurfaces.tsx:2,15,32` 使用现有 `CatalogItemDrawer`；其既有 router 继续落到 `CatalogItemViewDrawer`，没有新增商品详情 renderer |
| 页面状态归属 | PASS | `SalesMenuPage.tsx:631,750-772` 由页面持有 `productDetailItemCode`、打开/关闭和焦点恢复上下文 |
| 两个 Drawer 并存 | PASS | `SalesMenuPage.tsx:1600-1630` 同时传入 editor 与 catalogItem surface；`SalesMenuTaskSurfaces.tsx:31-33` 先渲染编辑 Drawer，再渲染既有商品详情 Drawer |
| 只读权限边界 | PASS | `SalesMenuPage.tsx:1623-1629` 使用 `initialMode: 'view'` 与 `canWriteCatalog: false`，不会从销售项入口扩张商品写能力 |
| 商品查询上下文 | PASS | 商品详情复用当前 `queryContext`，surface 为 `store`，不复制商品 read/query 逻辑 |
| 父 Drawer 生命周期 | PASS | 编辑 Drawer 的 `onClose`、`onSaved` 与删除成功路径清理商品详情 context；既有编辑草稿/脏态生命周期没有被商品详情入口替换 |
| 焦点恢复 | PASS | 页面记录触发按钮，在商品详情关闭后的 `afterOpenChange` 中恢复焦点；父级关闭/保存/删除时清理失效 trigger |
| contract/API/DB 影响 | PASS | 本需求没有新增 operation、HTTP endpoint、generated contract、数据库表、migration、seed 或独立商品读取实现 |
| 可追踪 UI 测试 | PASS | `SalesMenuPage.static.test.ts:179-182,382-392` 覆盖 UI-33、测试 ID、既有 router、view mode、只读参数、并存与 cleanup；`CatalogItemDrawer.test.tsx:483-484` 覆盖新增生命周期回调接线 |

## 3. Finding 处置

### 3.1 代码逻辑 finding

无 `CONFIRMED`、`PARTIALLY_CONFIRMED` 或 `UNVERIFIED_REQUIRES_EVIDENCE` 的代码逻辑 finding。`M/S/N=0/0/0`。

reviewer 特别核对了“不要重复造商品详情组件”这一约束：销售菜单只增加入口和页面级路由状态，实际商品详情仍由既有 `CatalogItemDrawer` / `CatalogItemViewDrawer` 承担；因此没有需要修复的重复实现或 owner 越界。

### 3.2 同根扫描

`CatalogItemDrawer` 的现有消费者范围与 sales-menu 新增消费者均已扫描。未发现第二个商品详情 renderer、销售菜单内重复的商品读取协议、或通过该入口开启商品编辑能力的同族路径。商品详情的 `onAfterOpenChange` 是对既有 surface contract 的最小生命周期扩展，用于把焦点恢复交给页面 owner，不改变既有 view/edit 路由。

结论：`SAME_ROOT_SCAN=PASS`。

### 3.3 DESIGN_GAPS

无。详设已明确“复用既有商品详情组件”、`itemCode` 事实来源、双 Drawer 并存、只读能力、焦点恢复和无新增后端契约；实现逐项匹配。

## 4. L3 未验证项（不计入 M/S/N）

以下是动态 UI 证据缺口，不是静态代码 finding：

- 真实浏览器中嵌套 Drawer 的层级、遮罩、动画结束时序和可视区域表现；
- 编辑销售项存在未保存草稿时，打开/关闭商品详情后的真实草稿与滚动位置保留；
- 键盘焦点陷阱、关闭后的焦点回到“查看商品”按钮、以及屏幕阅读器语义；
- 商品详情读取失败、重试和父 Drawer 保持打开时的真实用户反馈。

这些属于未执行 Browser L2 的 `L3_UNVERIFIED`，本轮没有把它们升级成代码问题，也没有把静态测试升级成动态验收。

## 5. 结论与授权边界

```text
REVIEW_TARGET=IMPLEMENTATION
REVIEW_ROUND=1
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS
L2_USER_VISIBLE=PASS
L3_UNVERIFIED=非空，见 §4
SAME_ROOT_SCAN=PASS
DESIGN_GAPS=NONE
EVIDENCE_TIER=STATIC_SOURCE + TYPESCRIPT_DIAGNOSTICS + FOCUSED_VITEST; NO_BROWSER_L2; NO_DYNAMIC_BACKEND
```

本报告只记录本轮实施逻辑的 fresh 独立审查，不新增 DEV、reset、seed、Browser L2、UAT、部署或 Git 授权。动态浏览器体验仍由 Dexter 按需要另行安排。
