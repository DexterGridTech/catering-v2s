# 销售菜单实现结果 · 独立静态 review

- reviewerKind: `EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE`
- 会话性质: fresh v2s-rooted，**纯静态**。未运行任何命令，未起 DEV / Testcontainers / 浏览器，未 reset/seed/UAT。
- 判定: **NO-GO**（阻断项**只有证据缺口**，不是代码缺陷；见第 5 节）
- findings: **M=0, S=2, N=2**
- 授权边界: 只判断当前实现结果。不授权任何修改、动态运行、UAT、部署、切流，也不等于产品批准或交付完成。

---

## 1. 这活儿要解决什么问题，解决了没有

需求的business问题是：**内部堂食/外带渠道的菜单需要我们自己维护**，
而外部平台与团购渠道是「做对应关系」，维护逻辑完全不同。
Dexter 的判据原话是「这个渠道的菜单，是我们自己维护的，还是做对应关系的？」

三条核心裁定逐条静态核验，**全部落地**：

**裁定一 · 范围只限 `INTERNAL` + `DINE_IN`/`TAKEAWAY`** —— `CONFIRMED`

`SalesMenuOwnerService.java` 第 2856–2858 行：

```
|| !"INTERNAL".equals(judgment.accessKind())
|| !("DINE_IN".equals(judgment.orderKind()) || "TAKEAWAY".equals(judgment.orderKind()))
```

不是文档声称，是 owner 判定路径上的实际分支。GROUP_BUY 与 EXTERNAL 被排除在外。

**裁定二 · 两个可售维度，库存维度派生不落库** —— `CONFIRMED`

`V20260901_000000_000__sales_menu_owner.sql`：

- 第 222 行 `sales_manual_status_current`，第 253 行索引按 `(channel_ref, sales_item_ref)`
  —— 手动沽清落在「销售项 + 渠道」粒度，与裁定一致；
- 第 233 行 `ck_sales_manual_status_reason`、第 240 行 `ck_sales_manual_status_actor`
  —— 「必须有原因」是 DB 级 CHECK，不是应用层声称；
- 第 255 行 `sales_manual_status_event` —— 恢复留痕；
- **全 schema 无任何存储的库存可售字段**；第 1–2 行注释写明 inventory 引用保持 opaque。

这满足 `owner-read-model-and-lifecycle-standard.md` 的
`CASCADE_STATUS_IS_DERIVED_NOT_STORED`。两个维度没有被合并成一个 boolean，
这一点是需求评审时反复确认过的，实现守住了。

**裁定三 · 约束载体：contract 定闭集，销售项用 JSON 承载** —— `CONFIRMED`

- `SalesMenuOrderingConstraints.java` 是 **typed record**
  `(Integer minItemQuantity, Integer quantityStep)`，构造器校验 `>= 1`；
  是闭集，不是自由 map；
- `contracts/openapi/components/sales-menu/sales-menu.schemas.json`
  第 444、489、621、660、1344、1387 行声明 `orderingConstraints`；
- SQL 第 135 行 `ordering_constraints_json JSONB NOT NULL DEFAULT '{}'`，
  第 145 行 `CHECK (jsonb_typeof(...) = 'object')`。

D-06 要求的「不做规则版本与数据版本」也守住了：没有 version 列，没有迁移分支。

**结论：业务问题解决了，且解决的是对的那个问题。** 方案复杂度与阶段匹配，
没有为「未来可能的外部渠道对应关系」提前造抽象。

---

## 2. 有没有重复造轮子 / 自成体系

这是本轮我下功夫最多的方向。**我提出四个「另起炉灶」假设，四个全部被自己证伪。**
如实记录，因为证伪过程本身是结论的一部分。

| 假设 | 证伪证据 | 结论 |
| --- | --- | --- |
| 销售菜单自造了 6 个专属 L2 policy 文件 | `catalog-inventory` 有完全同族的 `-l2-activation-candidate` / `-case-blueprint` / `-execution` / `-locator-bindings` / `-scenarios` / `-timing-budget`，并有自己的 `catalog-inventory-p1.mjs` | 跟随既有模式，非自创 |
| `useOverlayLock` 被 13 个同侪 feature 使用，销售菜单是全 App 唯一没用的 | `useDrawerFormLifecycle.ts` 第 89、91 行内部已调用 `useOverlayLock(open)` 与 `useDirtyFormLock(open && dirty)`；销售菜单导入的正是这个更高层组合 | 复用层级更高，反而更好 |
| Drawer surface 自己手写 | 8 个 Drawer，`adminDrawerSurfaceProps` / `adminWideDrawerSurfaceProps` 共 10 处引用 | 复用 foundation |
| 分页/游标自己手写 | `useSalesMenuReadModel.ts` 第 46–94 行共 7 次 `useCursorStack`，配 `CursorPagination` | 复用 foundation |

foundation 符号复用量：销售菜单 13 个（9 个文件）。同侪区间为 4–32，
`business-channel` 15、`store-management` 12、`workspace-user` 17。**销售菜单在带内，不是离群点。**

后端同理：`SalesMenuOrderingConstraints` 等 12 个 domain enum 文件表明
「统一都用 enum」的裁定被执行，符合 `backend-coding-standard.md` 规则 1-O。

**结论：没有发现重复造轮子，没有发现自成体系。** 唯一的 foundation 缺口见 N-1。

---

## S-1 `SalesMenuPage.tsx` 单文件 3179 行，是全 App 结构离群点 · `CONFIRMED`

**事实。** `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx` 3179 行。
同侪最大单文件是 `catalog-management/ui/CatalogDictionaryDrawerState.tsx` 1675 行，
而 `catalog-management` 把复杂度摊在 **109 个文件**里；销售菜单整个 feature 只有 **9 个文件**。
单文件内含 8 个 Drawer。

**推论。** 这不违反任何已写死的规范，但它与 `frontend-coding-standard.md` 的
职责清晰取向相悖，且已经产生可观察代价：本轮 L2 反复失败时，
每次定位都要在同一个 3179 行文件里横跨读模型、抽屉、表格与命令回读。

**影响面。** 可维护性与后续 review 成本；不影响当前运行正确性。

**最小修复。** 按 Drawer 边界拆分，与 `catalog-management` 的既有做法对齐
（每个 Drawer 一个文件，页面只留编排）。不需要新抽象。

**是否需 Dexter 裁决。** 否，属工程结构。但**建议不要现在做**——
它会让刚稳定的 L2 全部需要重新验证。列入 SM-06 之前。

---

## S-2 修复后没有 fresh L2，历史 18/18 不能作为修复后的动态证明 · `CONFIRMED`

**事实。** Codex 在交接中已主动声明这一点，本轮独立确认：提供的
`l2-1788510438441-23307-…` 是**失败族修复之前**的 run。
修复后（`requireControl` 改等待、观测计数等待清除、testId 补齐）尚无 fresh 全量 run。

**推论。** L2 business 维度当前处于 `UNVERIFIED`。这是本轮 **NO-GO 的唯一阻断项**。

**影响面。** 不影响静态结论；影响「实现结果已验证」这一主张能否成立。

**最小修复。** 一次 fresh 全量 18 条 L2。不需要任何代码改动。

**评价。** Codex 主动声明这一点是正确的做法，避免了把历史 artifact 当修复后证明——
这正是过去几轮反复出问题的地方。这条 finding 记的是证据状态，不是行为过失。

---

## N-1 `adminListState` 未复用，错误横幅与「暂无数据」会同时出现 · `CONFIRMED`

**事实。** foundation 的 `list/adminListState.tsx` 文档注释写明其职责是
「Keeps loading, failed, and empty table states mutually exclusive」，
并给 loading / empty 挂上 `${prefix}-loading`、`${prefix}-empty` 两个 testId。
8 个同侪 feature 在用（如 `BusinessChannelList.tsx` 第 197 行）。

销售菜单改为在每个 Table 上分别写 `loading={…isFetching}` 与
`locale={{emptyText: '…'}}`，共 6 处（`SalesMenuPage.tsx` 第 1468/1507、1589/1592、
1933/1938、2032/2037、2077/2081 行），另有两处裸 `<Empty image={Empty.PRESENTED_IMAGE_SIMPLE}>`
（第 1736、2658 行）。

**先说被我证伪的那半。** 我最初判断「查询失败会被渲染成暂无数据」——**这是错的**。
第 1824 行取 `problemMessage(read.draftItems.query.error, …)`，
第 1925–1928 行渲染带「重试」按钮的 Alert。失败**有**处理。

**实际缺陷（比初判轻）。** 失败时 Alert 与「该分区暂无菜单商品」**同时显示**，
而 `adminListState` 的 `loading || failed ? null : <Empty/>` 正是为消除这一点而存在。
其次，empty / loading 状态没有 testId，L2 无法区分「真的空」与「请求失败后的空」。

**最小修复。** 6 处 Table 换用 `adminListState({loading, failed, emptyText, testIdPrefix})`。
两处裸 `<Empty>` 保持不变（它们不在 Table 内）。

**是否需 Dexter 裁决。** 否。

---

## N-2 「15 个 backend scenarios」本轮未能独立复算 · `UNVERIFIED_REQUIRES_EVIDENCE`

**事实。** 我用三种探针分别得到 13、23、35 三个数字：
按 `void scenario` 匹配得 13，按方法签名匹配得 23，按 `"SM…"` 字面量唯一化得 35。
`BackendAcceptanceScenarioCatalog.java` 第 20 行只登记了类
（`new SalesMenuAcceptanceScenarios(host)`），不逐条登记场景。

**推论。** 不可靠的是**我的探针**，不是 Codex 的数字。按亲验纪律，
我不据此开 finding，也不声称存在差异。

**要证实需要什么。** 场景声明的确切代码惯例（场景对象在哪构造、如何被 host 收集），
或一次 fresh acceptance run 输出的场景清单。

**其余分母已复算通过：**

- **31 operations** —— `CONFIRMED`。paths 文件有 30 个唯一 `operationId`，
  实施详设第 512 行写明口径是「31 条受影响 operations（30 新增 + 1 既有修改）」，两者一致。
  我一度准备按「30 ≠ 31」开 finding，读到该行后撤回。
- **18 L2 cases** —— `CONFIRMED`。`sales-menu-l2-case-blueprint.json` 唯一 `caseId` 数为 18。
- **repository byte binding 只含两目录** —— `CONFIRMED`。
  `repository-byte-binding.json` 中出现的 `apps/` 目录恰为 `apps/backend`、`apps/frontend`，
  无 `apps/terminal`。满足目标。

---

## 5. 判定与理由

**NO-GO，M=0 / S=2 / N=2。**

请注意 **M=0** 的含义：本轮**没有发现任何 major 缺陷**。业务问题解决对了，
三条核心裁定全部落地，foundation 复用达标，无重复造轮子，无自成体系，
契约与 schema 形态正确，byte binding 满足目标。

NO-GO 的唯一依据是 **S-2：失败族修复之后没有 fresh 全量 L2**。
静态 review 无法为动态维度背书，这是判据问题，不是代码问题。
一次 fresh 全量 L2 通过即可翻转本判定，不需要任何代码修改。

S-1（3179 行单文件）建议排到 SM-06 之前，不要现在动。
N-1（`adminListState`）是纯增量改进，可与 S-1 同批。

**除 DEV 页面可见性（Dexter 已明确排除）外，本轮未发现其他 OPEN mismatch。**

**关于历史 artifact 的 secret/HMAC 定级：** 本轮为静态 review，
未对 runner 持久化 state 的 secret 剥离与 65/65 静态回归做独立复算，
标 `UNVERIFIED_REQUIRES_EVIDENCE`，不给定级。
