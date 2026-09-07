# 2026-09-07 销售菜单信息密度专项整改交付证据

```text
TARGET=sales-menu-information-density-ui-amendment
SCOPE=operations-admin sales-menu page and its directly owning presentation tests/docs
AUTHORITY=Dexter direct task authorization
BUSINESS_SEMANTICS_CHANGED=false
DATA_MODEL_CHANGED=false
OPERATION_DENOMINATOR_CHANGED=false
```

## 1. 本次整改范围

按 Dexter 的页面反馈，完成以下六组呈现修订：

1. 管理菜单抽屉增加“菜单时段”列，来源为菜单摘要的 `draftSchedule`。
2. 经营入口使用单行 rich Select，右侧放“管理菜单”；菜单选择器不再显示页面级分页，菜单工作控制与经营入口合并。
3. 销售分区导航收窄到当前桌面布局的 `lg=5`，名称和数量左对齐，选中态复用商品数模块的浅色 token 样式。
4. 销售项名称与商品编码分行；草稿表两种媒体模式都显示图片来源/状态文字。
5. 草稿与前台销售项表的“挂牌价”都调整为第二列。
6. 草稿价格按挂牌价与默认价相等/不等分支展示；草稿与前台 SKU/规格均按一项一行展示，前台只显示已发布挂牌价。

## 2. 直接变更的源码与测试

- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx`
  - 合并经营入口与菜单工作行；保留真实表格分页，移除入口/菜单页面级分页。
  - 使用共享 token 选中态和收窄后的桌面列宽。
  - 草稿/前台名称与编码分行；草稿媒体来源文字始终显示。
  - 草稿/前台表格均以“挂牌价”为第二列，并使用 stacked cell 渲染多行值。
- `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuManagerDrawer.tsx`
  - 新增 `draftSchedule` 对应的“菜单时段”列。
- `apps/frontend/operations-admin/src/features/sales-menu/ui/salesMenuUiShared.ts`
  - 统一草稿价格比较、草稿 SKU/规格逐行、前台已发布 SKU/规格逐行的展示规则。
- `apps/frontend/operations-admin/src/features/sales-menu/model/useSalesMenuReadModel.ts`
  - 将候选分页 helper 的稳定 `acceptPage` 回调解构后作为 Hook 依赖，收敛相关架构 lint 告警。
- 相关测试：
  - `SalesMenuPage.static.test.ts`
  - `salesMenuUiShared.test.tsx`
  - `scripts/test/browser-l2-runtime.test.mjs`

相关需求、IA、交互设计、implementation design、implementation plan 与原型已同步本次 UI 口径；未改 generated contract、fixture、seed、blueprint、L2 case/action 或 operation 分母。

## 3. 静态与 focused 验证

| 检查                                       | 结果                      |
| ------------------------------------------ | ------------------------- |
| operations-admin sales-menu focused Vitest | PASS，3 files / 36 tests  |
| browser-L2 runtime static test             | PASS，68 tests            |
| operations-admin typecheck                 | PASS                      |
| sales-menu 相关 scoped ESLint              | PASS，0 error / 0 warning |
| 相关源码/文档 Prettier check               | PASS                      |
| `git diff --check`                         | PASS                      |

## 4. fresh 独立三维对账

```text
reviewerKind=INDEPENDENT_SUBAGENT
agentId=01a07abe-21c7-7a72-a3a0-e0772a3dd7da
reviewMode=READ_ONLY_STATIC_THREE_WAY_RECONCILIATION
verdict=RECONCILIATION_PASS
```

独立 agent 逐项复核了用户反馈、需求/IA/交互设计/实施详设/计划、项目记忆约束与当前源码。上轮发现的前台 SKU 挂牌价被压成“按规格分别设置”已确认修复：前台挂牌价和销售规格分别消费 `salesMenuPublishedPriceLabel` 与 `salesMenuSpecificationLabel`，均按 `skuPrices` 逐行输出。

该对账只证明静态一致性；真实浏览器换行、下拉弹层第 21 项可达、DEV、seed、L2、UAT 尚不由本节静态结果证明。

## 5. 受管环境执行

以下条目在静态闭环后按授权顺序补录，分别保留业务与清理证据：

```text
RESET= PASS
RESET_BUSINESS= PASS_DATABASE_ABSENT_READBACK
RESET_CLEANUP= PASS_NO_PERSISTENT_RESET_PROCESS
DEV= PASS
DEV_BUSINESS= PASS_REMOTE_JAVA_SPRING_BOOT_STARTED_AFTER_FLYWAY
DEV_CLEANUP= PASS_MANAGED_PROCESS_IDENTITIES_PERSISTED_FOR_EXPERIENCE
SEED= PASS
SEED_BUSINESS= PASS
SEED_CLEANUP= PASS_PRESERVED_DEV_STATE
```

动态入口：

```text
./scripts/dev/reset
./scripts/dev/start
R5_SEED_CONFIRMATION=EXPLICIT_R5_SEED ./scripts/dev/seed --profile r5-full
```

reset manifest: `.runtime/r5/reset/r5-reset-6fe0067b-6b6e-4bb6-b2db-119ea711e964/run-manifest.json`
reset events: `.runtime/r5/reset/r5-reset-6fe0067b-6b6e-4bb6-b2db-119ea711e964/reset-events.jsonl`

DEV manifest: `.runtime/r5/run-manifest.json`
DEV readiness: `.runtime/r5/readiness-57091.jsonl`
DEV logs: `.runtime/r5/platform-admin.log`, `.runtime/r5/operations-admin.log`, `.runtime/r5/dev/r5-dev-1788766142368-57091-c4704de4-1e44-4ef0-b9f0-cef8bf9c06d0/business-server.log`

完整 seed manifest: `.runtime/r5/seed/complete/complete-seed-277942ca-457a-4dcc-a91b-44bfae2fb4a4/run-manifest.json`
完整 seed report: `.runtime/r5/seed/complete/complete-seed-277942ca-457a-4dcc-a91b-44bfae2fb4a4/seed-report.json`
完整 seed 可读报告: `.runtime/r5/seed/complete/complete-seed-277942ca-457a-4dcc-a91b-44bfae2fb4a4/seed-report.md`
完整 seed 关联的 managed DEV run: `r5-dev-1788766142368-57091-c4704de4-1e44-4ef0-b9f0-cef8bf9c06d0`

本次完整 seed 的四个按序子阶段均为 `Business=PASS`，清理均为 `PASS*`：`owner-command`、`external-collaboration-business-channel`、`catalog-inventory`、`sales-menu`。其中 catalog/inventory 计划分母为来源 73、创建 72、排除 1、媒体 34；sales-menu 子报告为 `status=PASS`。Operations Vite 页面本地 HTTP readback 为 200。

reset 只由受管 runner 在精确的非生产远端 namespace 执行；DEV start 不 seed；seed 使用完整 `r5-full` profile。未授权 UAT、部署、切流或浏览器 L2。
