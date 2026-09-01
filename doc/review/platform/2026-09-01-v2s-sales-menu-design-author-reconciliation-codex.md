# 销售菜单详设 · 作者静态三维对账与两轮 review 处置

- 日期：2026-09-01
- 性质：作者静态对账与 finding intake，**不是独立 review verdict**；独立两轮上限已用尽
- REVIEW_TARGET：DESIGN
- 被审对象：销售菜单 implementation-facing 详设与串行实施计划
- 动态边界：未运行 Testcontainers、browser L2、DEV、reset、seed、UAT

## 1 · 三维输入

| 维度 | 已重开输入 | 本次对账 |
| --- | --- | --- |
| 原始需求 | `2026-08-31-v2s-sales-menu-requirements.md`；Dexter 2026-09-01 的 IA 接受、复制边界、三表分页裁定 | 门店独占、渠道范围、多菜单、时段、发布冻结、shape price、两状态、两约束、后置边界均进入详设 |
| IA/交互 | 已接受 IA、UI interaction、可操作 mockup、UI-01..UI-31 | §11.2/§11.3 与计划 SM-06/07/08逐项承接；没有第二页/诊断台/disabled详情/重复动作 |
| 项目规范/记忆 | AGENTS、backend/frontend standards、foundation charter、owner read model、G-08/G-11/G-12、collection/ordering、verification/review/acceptance/L2/seed standards | owner/contract/generated/事务/授权/cursor/RTK/foundation/动态证据边界全部落 §3/§7/§9a |

## 2 · 模板完整性

canonical `doc/decisions/templates/implementation-design-template.md` 的 §0、§1、§2、§3、§4、§5、§6、§7、§8、§9、§9a、§9b、§10、§10b、§11、§12、§13、§13b、§14 均有对应完整节；不存在的 `doc/plans/platform/implementation-design-template.md` 不作为输入。§3 固定 17 行未删除；seed 新旧两类、阶段/整体对账均已写。

串行计划对每步明确：前读、红证明、finite denominator、focused proof、后读、fresh 独立阶段对账、动态授权和 business/cleanup 分账。

## 3 · 同一事实交叉对账

| 事实 | 需求/IA | 详设/计划 | 结论 |
| --- | --- | --- | --- |
| 全局门店 | 页面不重复门店名/选择 | STORE scope path + global queryContext；UI禁止第二控件 | MATCHED |
| section/item排序 | 行末上/下，无拖拽，权威读回 | owner邻接 swap + canMove + command/readback | MATCHED |
| 集合可达性 | 三张表固定分页；“全部入口/菜单/候选”必须用户可达 | channel/selector/manager/candidate/draft/front/log 七套 opaque cursor + visible CursorPagination；无 auto-drain | MATCHED_AFTER_R2_REPAIR |
| SKU价格 | 每 SKU 菜单价、无公共价 | tagged SKU_SELECTION、per-SKU cents/public absent | MATCHED |
| front详情 | 名称点击、无操作/查看、真只读 | 独立 detail component，不渲染 disabled Form | MATCHED |
| 两个可售维度 | Inventory派生 + manual销售项/渠道，不合并 | contract两必备对象、menu仅持manual、Inventory set-read | MATCHED |
| multi-menu | 同入口多份 enabled，销售端判断 | activation无互斥、无current-menu事实、返全部 | MATCHED |
| copy | current draft/schedule；new disabled；五类 excluded | SM-19/20 + acceptance/L2 exact absence | MATCHED |
| disabled关系 | 不影响编辑/发布 | 只有 store/channel disabled阻断publish；activation disabled不阻断 | MATCHED |
| 发布copy | 生成前台菜单≠终端已获取 | immutable publication/effective view，无terminal状态/诊断 | MATCHED |
| operation log | 普通四列、无诊断、Cursor | owner business record + frontend presenter，无raw/详情 | MATCHED |
| 图片 actual target | 图片属于当前草稿销售项；写必须复核实际 STORE target | 完整 store/menu/item path → STORE grant → SalesMenu target judgment → Asset target row；stage/release/claim 三次重判 | MATCHED_AFTER_R2_REPAIR |

## 4 · 数值/枚举出处

| 具体值 | 出处/性质 |
| --- | --- |
| pageSize 20、21 行反例 | Dexter 已接受 IA UI-31 与商品管理现有 precedent |
| 1 主 + 最多5附、2MB | 已接受 IA 的商品图片同规则 |
| INTERNAL + DINE_IN/TAKEAWAY、STORE only | 需求正本已裁 |
| minItemQuantity/quantityStep | 需求正本已裁闭集 |
| 31 条受影响 operations / 19 commands | 详设 §5 为30新增+1既有 business-channel 修改，不是业务上限；脚本已重数31/19 |
| 38 owner rules | §8 连续规则索引，不是 runtime enum/上限；脚本已重数38 |
| 15 acceptance scenarios | 13 个 SalesMenu 聚合场景 + 1 个 BusinessChannel owner 场景 + 1 个 Asset owner 场景；按业务闭环组合，不是 operation 分母/上限 |
| 16 L2 cases | UI + business negative/join/focus 的 case exact-set，不等同31 UI且不是产品上限 |
| price integer cents | 当前 Catalog contract `standardSalePrice format=cents` 的同仓先例 |
| schedule cross-midnight | 详设明确 start-inclusive/end-exclusive；start>end为跨午夜，避免无来源地禁止晚间时段 |
| empty menu publish | 需求没有最小项限制；详设明确允许，防实施期擅加 blocker |

## 5 · 真实源码影响分母

- 当前无 sales-menu production owner/route/feature/schema/seed/L2 case；因此设计采用新 owner，不伪称复用不存在的能力。
- 已定位并绑定：edge materialize/codegen/bindings、admin catalog/auth manifest、module/app Gradle、Catalog/Inventory/BusinessChannel/Organization/Asset public API、RTK substrate、Cursor/foundation、backend-acceptance、shared browser runner、r5-full seed parent。
- 当前 r5-full 只有 owner-command → catalog-inventory，business-channel executor仍为静态；当前business-channel plan只有INTERNAL DINE_IN模板，真实channels只有EXTERNAL TAKEAWAY/GROUP_BUY。详设把真实 INTERNAL DINE_IN/TAKEAWAY channel owner facts和HTTP stage纳入本批seed原子组，不让sales-menu seed偷写别域，并要求父编排按stage id绑定validator而非`stages[1]`。
- CatalogAssetEditor 是强先例但不是 foundation；详设采用 presentational primitive + 两业务 adapter，避免 cross-feature依赖与重复实现。

## 6 · 未验证库存

| 档位 | 当前状态 |
| --- | --- |
| 静态已证 | 原始需求/IA状态、模板章节、表行计数、现有生成/route/foundation/seed/L2源码位置 |
| 测试已证 | 无；当前仅以脚本重数文档表行与 UI-01..31 文档 exact-set，mockup 没有独立自动化测试，本次新 design 也尚无生产实现测试 |
| 无人验证 | 新 contract/schema/owner/edge/frontend、15 Testcontainers场景、16 browser L2 cases、四阶段seed及全部动态 business/cleanup |

## 7 · 两轮独立 review 与作者处置

| round | 独立 verdict | M/S/N | 作者 source-first 处置 |
| --- | --- | --- | --- |
| Round 1 | NO-GO | 2/1/0 | canonical template、真实 INTERNAL channel seed、parent stage-id 绑定三项均 CONFIRMED 并修复；Round 2 独立确认 CLOSED_STATIC |
| Round 2 | NO-GO；`ROUND_FINAL_DECISION=SELF_DECIDED` | 2/0/0 | Asset actual-target 与 channel/menu/candidate 第21项可达性均 CONFIRMED；按 owning source 最小修复，详见 Round 2 intake；不启动第三轮 |

Round 2 后同根修复已同步到已确认 IA 的 implementation-facing 可达性澄清、交互设计、详设、串行计划、Testcontainers场景、frontend cursor/asset request model、L2 case oracle 与 seed/全链对照。Round 2 reviewer没有复核这些后续字节；当前关闭性质是作者按两轮治理执行的 `SELF_DECIDED_STATIC_CLOSEOUT`，不能冒充独立 GO 或动态 PASS。

## 8 · 当前作者结论与证据边界

`SELF_DECIDED_STATIC_CLOSEOUT=READY_FOR_DEXTER_AND_CLAUDE_REVIEW`。两轮独立 finding 已全部做 source-first intake，当前文档扫描没有保留已知 OPEN 设计项；但 Testcontainers、browser L2、DEV reset/seed、UAT、部署仍全部 `NOT_RUN`，只有未来实施和相应授权后的受管执行才能关闭。Claude 必须独立阅读当前修复后字节，不应继承本文件结论。
