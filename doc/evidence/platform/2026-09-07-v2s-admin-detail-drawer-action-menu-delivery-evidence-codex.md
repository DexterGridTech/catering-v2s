# 双后台详情抽屉“操作”Popup Menu 整改交付证据

```text
DATE=2026-09-07
SCOPE=apps/frontend/platform-admin + apps/frontend/operations-admin + libraries/frontend/admin-ui-foundation
DETAIL_DRAWER_ACTION_MENU=PASS
BACKEND_CONTRACT_DATABASE_SEED_RESET=NOT_IN_SCOPE
```

## 1. 交付结论

两个管理后台现有对象详情 Drawer 的 header 动作已统一为一个“操作”按钮，动作通过
Popup Menu 展示。业务 app 继续拥有动作条件、文案、危险标识、确认、loading、回调和
readback；共享 foundation 只拥有按钮与 Popup 的展示机制。

## 2. 分母回读

| 分母 | 结果 | 说明 |
|---|---:|---|
| 对象详情 Drawer 全集 | 19/19 | platform-admin 8 个，operations-admin 11 个 |
| action-bearing Drawer | 16/16 | platform-admin 7 个，operations-admin 9 个 |
| 无 header action 反例 | 3/3 | OrganizationOverview、FixedStoreContract、SalesMenuItem，均未伪造空“操作”入口 |
| 逻辑 action slots | 53 | 原动作逐项保留；Catalog 顶部动作与原“更多”合并，不重复计数 |
| foundation consumer | 16/16 | 每个 action-bearing Drawer 恰有一个 `AdminDetailActionMenu` |
| 既有业务 operation/path | unchanged | 本批没有 backend、contract、generated wire、migration 或 seed 变更 |

纳入的 16 个 action-bearing Drawer 与排除反例的完整清单见：

- `doc/plans/platform/2026-09-07-v2s-admin-detail-drawer-action-menu-interaction-design-codex.md`
- `doc/plans/platform/2026-09-07-v2s-admin-detail-drawer-action-menu-implementation-design-and-plan-codex.md`

## 3. 实施结果

- 新增 `libraries/frontend/admin-ui-foundation/src/overlay/detailActionMenu.tsx`，由 foundation
  统一渲染 native Button、`aria-label="操作"`、Popup 触发行为和触发器 testId。
- 新增 `AdminDetailActionLabel`，使各 app 的动作 testId 留在菜单动作 label 节点；业务
  item 的 callback 与状态仍在 owning Drawer 内构造。
- platform-admin 7 个 action-bearing Drawer 全部接入。
- operations-admin 9 个 action-bearing Drawer 全部接入；Catalog 原顶部动作与“更多”动作
  合并到同一菜单，Inventory 的动作表单仍保持独立。
- 两 app 的 `*DetailDrawerTestIds.ts` 补齐触发器身份并保留既有动作身份；Catalog 继续
  使用其既有 `catalogTestIds` 词汇。
- 受影响 L2 仅适配入口：先点击“操作”触发器，再按 app-owned testId 点击 Popup item；
  没有新增业务场景、oracle、timeout 或 locator fallback。

## 4. 验证证据

### 4.1 静态与 focused

- foundation focused test：`src/overlay/detailActionMenu.test.tsx`，3 tests passed。
- platform-admin typecheck：PASS。
- operations-admin typecheck：PASS。
- admin-ui-foundation typecheck：PASS。
- 19/16/3 分母与 16 个 consumer 静态复核：PASS。
- 受影响普通 L2 的旧动作直连 locator 检查：PASS；均已改为先打开菜单，再消费真实 app-owned testId。
- Catalog L2 action binding 检查：PASS；动作触点指向真实菜单触发器/动作身份源。
- `git diff --check`：PASS。

### 4.2 目标 UI smoke

使用当前运行中的本机两个 Vite 页面做了目标面 smoke，未启动新的 backend、Testcontainers、
reset、seed 或全量 L2：

1. platform-admin：打开角色详情 Drawer，确认 header 只显示一个“操作”按钮；点击后可见
   `操作历史`、`编辑业务角色`、`停用业务角色`、`标记删除业务角色`，并确认
   `workspace-role-action-menu` 与 `workspace-role-edit` 各唯一且可见。
2. operations-admin：由源码确定的 `/operations/aurora/login` 登录入口进入，打开商品详情
   Drawer，确认 header 只显示一个“操作”按钮；点击后可见 `编辑`、`停用`、`标记删除`、
   `从已有商品复制配置`，并确认 `catalog-item-view-action-menu` 唯一可见、
   `catalog-item-edit` 唯一可见。

上述 smoke 证明了两个 consumer face 的真实渲染、Popup 展开和关键 TestId；不等同于所有
16 个详情面逐一完成浏览器动作回归，也不等同于全批 L2 或业务 operation 覆盖证明。

## 5. 未证明边界

- 未运行全批 L2；本批没有把历史 L2 结果重标为整改后证明。
- 未逐一在浏览器操作 16 个 Drawer 的每一项业务动作，因此各 owner command 的真实 HTTP
  行为沿用已有实现，仍需其原有测试/验收证据。
- 未涉及 backend、contract、generated API、migration、database、seed、DEV、Testcontainers、
  UAT、部署或切流。
- 未将 `apps/build` 或 `apps/backend/build` 作为本批交付产物；验证使用 typecheck、focused
  test、静态复核和目标 UI smoke。

## 6. 关联规范与计划

- `project-memory/practices/detail-drawer-action-menu.md`
- `doc/platform/frontend-coding-standard.md`（`3-K-10 · 详情抽屉动作入口`）
- `doc/plans/platform/2026-09-07-v2s-admin-detail-drawer-action-menu-interaction-design-codex.md`
- `doc/plans/platform/2026-09-07-v2s-admin-detail-drawer-action-menu-implementation-design-and-plan-codex.md`
