# v2s 销售菜单选择 UI 修订 · 静态交付证据

- 日期：2026-09-07
- 范围：`operations-admin` 门店销售菜单页面的经营入口/菜单选择、合并布局、新建菜单入口与相关详设、L2 脚本和生成策略
- 状态：`STATUS=STATIC_AND_FOCUSED_PASS`
- 动态边界：`DYNAMIC=UNRUN`
- 业务、权限、owner、Journey、数据模型和既有业务 operation：`UNCHANGED`

## 1. 本次修订

1. 经营入口由卡片组和页面级游标分页改为一行占满的 rich `Select`，选项内容保持单行展示。选项显示渠道名称、渠道模板名称、内/外部接入、订单类型、渠道状态和模板状态；候选仍按 owner cursor 在弹层滚动增量加载。
2. “管理菜单”位于经营入口选择器右侧，并只在当前经营入口上下文中打开管理抽屉。
3. 菜单选择由页面级分页改为可搜索 `Select` 弹层滚动增量加载；管理抽屉的菜单表格分页仍保留。
4. 新建菜单按钮移入管理菜单抽屉标题右上角；名称录入改为 Modal，继续使用 foundation 的表单生命周期、提交锁定和焦点归还。
5. 模式切换、菜单选择、菜单状态、时段、更新到前台和刷新动作合并到“经营入口”区块内同一水平行；页面不再单独显示“菜单工作区”区块。

## 2. 分母与唯一来源

- L2 case：18 条。
- blueprint case control-key 使用次数：231 次（18 个 case 合计；新增刷新绑定不改变 case 使用分母）。
- case-used unique control key：65 个。
- locator binding control key：76 个，包含 `SALES_MENU_MENU_REFRESH`；管理菜单动作绑定来源为 `SalesMenuManagerDrawer.tsx`。
- L2 operation coverage：32 行，其中 31 条为本批受影响 sales-menu operation，1 条为 rich channel option 复用的既有 `getOperationsBusinessChannelTemplates` 读 operation；未新增业务语义。
- visible `CursorPagination`：5 处，仅用于管理抽屉、候选区、草稿表、前台表、操作记录表。
- dropdown candidate accumulators：2 套，分别用于经营入口和菜单选择；两者各自按 query identity/reset key 管理，不与表格 cursor 共享。`channelCandidatePageSize=20` 仅表示经营入口候选的 owner 游标批次，不是页面分页控件。
- 21st reachability：经营入口和菜单通过弹层滚动，候选/表格通过既有显式分页；没有 auto-drain、total、client slice 或第二套分页控件。

唯一 locator 来源为 `apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts`；动态 option 以 channel/menu 业务 ref 生成稳定 testId，并绑定在真实 Select option 节点上。

## 3. 变更范围

- 详设：`doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`
- 实施计划：`doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`
- 需求：`doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md`
- 交互设计：`doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`
- 信息架构：`doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`
- 可操作原型：`doc/plans/platform/mockups/v2s-sales-menu-ia-codex/index.html`
- 页面/读模型/Modal/管理抽屉：`apps/frontend/operations-admin/src/features/sales-menu/`
- L2 blueprint、生成器和生成产物：`contracts/policy/sales-menu-l2-case-blueprint.json`、`scripts/generate/sales-menu-p1.mjs`、`contracts/policy/sales-menu-l2-*.json`
- L2 spec 与支撑测试：`apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts`、`scripts/test/browser-l2-runtime.test.mjs`

## 4. 已执行的静态/ focused proof

| 检查                                                                                                                           | 结果                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `node scripts/generate/sales-menu-p1.mjs --write --check --self-test`                                                          | `PASS`；18 cases、32 operation coverage                               |
| `node scripts/test/sales-menu-l2-fixture.mjs --self-test`                                                                      | `PASS`；18 cases、21 channels/menus/candidates；无 seed runtime input |
| `yarn vitest run src/features/sales-menu/model/salesMenuModel.test.ts src/features/sales-menu/ui/SalesMenuPage.static.test.ts` | `PASS`；2 files、30 tests                                             |
| `node --test scripts/test/browser-l2-runtime.test.mjs`                                                                         | `PASS`；67 tests                                                      |
| `antd lint apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx --format json`                          | `PASS`；0 a11y/usage issues；22 warnings（deprecated/performance）    |
| `antd lint apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuManagerDrawer.tsx --format json`                 | `PASS`；0 a11y/usage issues；3 warnings（deprecated）                 |
| `yarn eslint src/features/sales-menu/ui/SalesMenuPage.tsx --max-warnings=0`                                                    | `PASS`                                                                |
| `yarn test:architecture`（`apps/frontend/operations-admin`）                                                                   | `PASS`；40 pass、4 todo、0 fail                                       |
| `yarn typecheck`（`apps/frontend/operations-admin`）                                                                           | `PASS`                                                                |
| `yarn prettier --check`（本次变更的 TS/TSX/MJS）                                                                               | `PASS`                                                                |
| `git diff --check`                                                                                                             | `PASS`                                                                |

上述命令均未启动 DEV、Testcontainers、数据库、seed/reset、浏览器或真实 L2。

## 5. 尚需动态证明的边界

本证据不声称以下事项已完成：

- rich channel option 在真实 HTTP/浏览器中的模板字段展示、内外部/停用事实和第 21 个 option 弹层滚动可达；
- 真实视口下 rich option 是否保持单行、两组控制是否确实位于同一个“经营入口”区块且第二行不换行；
- 菜单切换后下方读模型真实更新，以及第 21 个菜单通过弹层滚动可达；
- 管理抽屉内新建按钮、Modal 创建、关闭管理抽屉后的权威列表刷新；
- 18 个 L2 case 的真实 browser business 结果、31 条受影响 operation 的真实执行覆盖、backend acceptance、DEV reset/seed、cleanup、UAT 或生产 owner 行为。

动态验证必须继续使用项目受管入口，并将 business 与 cleanup 分开判读；本次静态/ focused PASS 不能替代这些证据。
