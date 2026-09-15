# 销售项查看关联商品 · 独立 IMPLEMENTATION review 输入清单

- 日期：2026-09-15
- `REVIEW_TARGET=IMPLEMENTATION`
- `REVIEW_ROUND=1`
- `reviewerKind=INDEPENDENT_SUBAGENT`
- 独立 reviewer：Anscombe（fresh、只读）
- 执行边界：不写文件、不执行 Git、不执行 DEV/reset/seed/浏览器 L2；只对当前工作树做源码与设计对账。

## 1. 清单口径

主 agent 先按 `cs-memory-recall` 完成仓根恢复、六维 memory recall，并按 `cs-code-structure-recall` 定位 owning source；随后将下列最小输入清单交给 fresh 独立 reviewer，要求 reviewer 以当前工作树为准完成 action 1-A（代码提取）、同根扫描和未验证项盘点。

下表的 SHA-256 是 reviewer 返回后、最终收口前对当前工作树的字节复核。reviewer 返回后没有发生源码、测试或设计文档改动；该表用于审计当前输入字节，不替代 reviewer 的独立阅读留痕。

## 2. 输入文件与当前字节

| 分组 | 路径 | 当前行数 | SHA-256 |
|---|---|---:|---|
| 入口规范 | `AGENTS.md` | 99 | `51158ce0bba78dce53788ef060e77b3c0c768f4fab7ded6e45144d966d3e7739` |
| 入口规范 | `PLATFORM-BLUEPRINT.md` | 77 | `19ad18338bb6e4b5a443d205db06e80113993dda295a10c2bb10715764dfe396` |
| 入口规范 | `doc/platform/README.md` | 23 | `b978e9cf851b8c4829a0c69ef16f4492164e9e6583ca62582618f13fe0912c80` |
| 入口规范 | `doc/platform/roadmap-program-registry.json` | 16 | `f3e232d2a1c39ed6bb196911e7c85a73429a5871a3fe8f7e16d2cfa0403f12a8` |
| 授权 | `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md` | 759 | `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3` |
| 执行规范 | `scripts/README.md` | 238 | `06d083d7d01d6a14fe75493905da956c20c7e7037ab0fc314e0961bd187dd1c8` |
| kernel | `project-memory/index.md` | 90 | `2e73aabb4afc18d5f74eb7c9d58ea799303855d09c0a999295e319c362e0d029` |
| kernel | `project-memory/kernel/01-workspace-and-roadmap.md` | 19 | `f8add1ef738e04ab52c16ac772e1c9dfba75f9b035c904100caf3ba61fd2bd63` |
| kernel | `project-memory/kernel/02-service-shape-and-owner.md` | 18 | `45a26072af6204752e73f43d449cd5ce65f75e9b4cf8963ccdad7c3edaddc032` |
| kernel | `project-memory/kernel/03-transaction-data-and-dependencies.md` | 20 | `f01d8e4ea660d1add99368310f8304e828ea3decc8c6198334f5e4c1b8f85c44` |
| kernel | `project-memory/kernel/04-contract-consumer-and-admin.md` | 25 | `3de3d8aed7c4ad52ecfec89f0a2914e02682bba15220b407197e37ba08ddb026` |
| kernel | `project-memory/kernel/05-evidence-runtime-and-git.md` | 23 | `254ff3e682ecbf37d5777efd506ce3612282191fc2b772671a27c8921e436af8` |
| kernel | `project-memory/kernel/06-heritage-and-change.md` | 18 | `5c52b17aad29ba9d78e327ebe550a740d73f97402041c9f4d31c8df38615566c` |
| context rule | `project-memory/decisions/deterministic-context-only.md` | 22 | `c65c6aafd38d34c9ec937ad793a3d7dcf99bdda9ae3e407731b4eaf786170263` |
| routed memory | `project-memory/practices/drawer-form-lifecycle.md` | 137 | `89bcc2f0efe38994f47bcb92a608a657ecbcb24d5780c393e23db8dc8486e167` |
| routed memory | `project-memory/practices/detail-drawer-action-menu.md` | 23 | `d1d4d22c717203f77de95bff14276c7225a51f2c97a65632720212f2def6da4f` |
| routed memory | `project-memory/practices/frontend-capability-lookup.md` | 64 | `8ac0fc474432f207b7fdf469656a8d3470570c6ba3bc4cbe938a912dfdadf77b` |
| routed memory | `project-memory/practices/ui-visible-business-language-and-dynamic-aggregate-layout.md` | 39 | `f0cb3e495a1e53ee1903efad2f8b1705d736e1e65e901012f43c9b4c38ec3b93` |
| routed memory | `project-memory/practices/read-model-granularity.md` | 51 | `5594f03106a7253def704038768e55244bc11930e7be43184f26a3d49ab60561` |
| routed memory | `project-memory/practices/collection-boundary-modes.md` | 70 | `7e1b7c4bd9b568aaeac810a8e4b5ee2b03e89348ede83383d5d2e69f7d79b0b1` |
| routed memory | `project-memory/decisions/owner-read-model-and-lifecycle-standard.md` | 167 | `7f303041fc1799f7491abb9ada3c4bbb5ae5c5cb9da77b93ca08c6e7c3cb60e9` |
| 需求 | `doc/plans/platform/2026-08-31-v2s-sales-menu-requirements.md` | 593 | `f230dac08ddcf09e93b72171b0195d36e9ea26a039a609b1a44c2110a40266bc` |
| IA | `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md` | 396 | `0db4421c280e6f7ab4aac61633bce5a4d5315312421a1ab5f61adafe980bc21b` |
| 交互 | `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md` | 277 | `6d97e4a8e8fe8cdb9cef0d97ce165216f0c9d4e936770cda6607ae2a42f69fcb` |
| 详设 | `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md` | 1098 | `b049bc3df8e49108182614152737fc1a35b87d9cbe3d2807260581e0cbc7c05a` |
| 计划 | `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md` | 639 | `2f47e6f8e43409b4d2e927c2010686cc1165ceeaed88072a57c4e21713551000` |
| 商品详情交互 | `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md` | 576 | `1f708e7c4259be042cba371b6263c95747c60fbac3e10b84875c91099e29063f` |
| 商品详情 Journey | `doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md` | 140 | `c60c6eba8e26666225c2856aa14409027cdf23ca9305d042f29051556343d8f2` |
| 商品详情需求 | `doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md` | 718 | `1a31ac9426a0497f0c59f57946858052fdbd5d501995eb7bedea7c0e7340f9ac` |
| review 标准 | `doc/platform/review-standard.md` | 198 | `6e12ca56b08bb8bd6f47506635986b02ea1de0b1d6753a1db09c5757792766e6` |
| 验证治理 | `project-memory/operations/verification-governance.md` | 25 | `3094cf61cea315208323f7d3f9266f719ea6ca9d828094378ede375dfe9f3005` |
| 独立审查治理 | `doc/decisions/2026-07-25-v2s-independent-subagent-adversarial-review-governance.md` | 118 | `521cef2f7e57f16705dab326fe2c5688c33c81add0468470d0ab94dd7f529130` |
| owner contract | `apps/frontend/operations-admin/src/features/catalog-management/model/catalogItemSurfaceTypes.ts` | 30 | `48cb5233d258c46675ec42d2bd3f50227c1f33a6bd5d223ed813e64df4fe93a4` |
| existing router | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.tsx` | 17 | `551af2868144eb32d61e2150539ea6c82adc2656998175be3af4125846a2e718` |
| existing detail | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemViewDrawer.tsx` | 351 | `6bb57161180add2e10ccdf1067ddf7cc4015e0fe03eca0cac75a819398098ca3` |
| existing assembler | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchTaskSurfaces.tsx` | 109 | `a6ac3d010ede268c8a9b53919e10e2ecb8a528745fe1a64afa1e2fb17087ec6d` |
| existing detail test | `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemDrawer.test.tsx` | 896 | `f1fed3af2c256c9f0aa1f533d6674c7069ee764051df61e3db4076be838b2091` |
| changed editor | `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuItemEditorDrawer.tsx` | 780 | `52efaa77bcd72f496ab3a854ebc5dee5c6b4ce28157835dee8d3a05e5f6400bb` |
| changed assembler | `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuTaskSurfaces.tsx` | 37 | `ab85b31b26b89076ab559724879361e1b684e0818015486b1daba1d6522d4000` |
| changed page | `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.tsx` | 2067 | `52b502211aa09a42298ff2275be37eb109923cc2767da212534b90febf032f53` |
| test id | `apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts` | 98 | `a18dfe56ecb773c614eaade6d50c724b3bb5ed635f449150b9037372c63da455` |
| focused test | `apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.static.test.ts` | 625 | `92ad6f51332ab9b4fd95510f16d2493b4eb4db549fab4422d86cd4d61dfa417d` |

## 3. Reviewer 关注点

1. “查看商品”是否复用现有 `CatalogItemDrawer → CatalogItemViewDrawer`，而非新增商品详情组件。
2. 关联商品是否由销售项详情的 `itemCode` 唯一确定，且不把销售项草稿字段误当商品事实。
3. 商品详情 Drawer 是否与编辑销售项 Drawer 并存，编辑 Drawer 的草稿、脏态、关闭与保存生命周期是否保持不变。
4. 销售菜单场景是否明确为只读商品详情，不能借入口绕过商品写权限。
5. 关闭嵌套商品详情后，焦点是否回到“查看商品”按钮；父 Drawer 关闭/保存/删除时是否清理失效的焦点上下文。
6. 是否需要新增 operation、API、generated contract、数据库、migration 或 seed；若不需要，是否确实没有偷偷复制数据读取逻辑。
7. 同根扫描是否覆盖现有商品详情消费者与销售菜单 surface assembler。
