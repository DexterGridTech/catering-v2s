# v2s sales-menu DESIGN review Round 2 · 作者 intake 与 SELF_DECIDED 收口

REVIEW_CYCLE_ID=SALES-MENU-DESIGN-2026-09-01  
REVIEW_TARGET=DESIGN  
REVIEW_ROUND=2  
REVIEW_ROUND_LIMIT=2  
ROUND_FINAL_DECISION=SELF_DECIDED  
furtherCodexAdversarialRoundAllowed=false  
INDEPENDENT_VERDICT=NO-GO  
INDEPENDENT_M_S_N=2/0/0  
INTAKE_KIND=AUTHOR_SOURCE_FIRST_DISPOSITION  
SELF_DECIDED_STATIC_CLOSEOUT=READY_FOR_DEXTER_AND_CLAUDE_REVIEW

本文件在 fresh 独立 reviewer 固定 Round 2 verdict/findings 后编写。作者逐项重开当前需求/IA、owner规范、现有 Catalog Asset 实现、共享 Cursor 能力和当前销售菜单设计，不把 reviewer finding 当权威。Round 2 是同一 DESIGN cycle 的最终轮；以下修复后不再召集第三名 Codex reviewer。

## F-M-201 · Sales-menu Asset 缺 actual-target owner recheck

- 处置：`CONFIRMED`。
- 亲验证据：现有 `StageOperationsCatalogAssetMultipartOperation` 从 request `dataNodeRef` 解析 Catalog actual target；`CommandExecutionContextResolver` 由 generated token + server-resolved resource 建授权 context；`OperationsOwnerScopeGrant.matchesRequirementAndCapability` 绑定 workspace/group/target/requirement/capability。Round 2 前 sales-menu 图片 path 只有 workspace级 `/sales-menu/assets/stage`，关键 schema 未声明 store/menu/item，Asset owner确实只能猜 ambient scope或只验 workspace/usage。
- 根因：把“复用 Catalog 图片生命周期”误当成“可复用 Catalog target contract”，漏掉 sales-menu 图片实际属于某门店菜单的 stable sales item，而不是 workspace 通用资产。
- 最小修复：两条 HTTP path 固定携带 `groupWorkspaceKey/storeRef/salesMenuRef/salesItemRef`；stage body只补 `expectedDraftVersion` 和文件 facts，release body只含 `expectedAssetVersion`，body无权覆写 target。edge 顺序固定为 selected STORE → `EDIT_STORE_SALES_MENU` grant → `SalesMenuOwnerApi.requireSalesMenuItemAssetTarget(mode, ...)` → `SalesMenuAssetCommandApi`。`STAGE|CLAIM`要求当前可编辑draft target，`RELEASE_STAGED`只放宽归档/已移除item的原target清理而不放宽target匹配。Asset owner新增 `platform_asset.sales_menu_asset_target` 保存 opaque target，并在 stage/release/claim 锁后比对 target、grant、contextVersion、workspace、usage、status/version。
- cleanup反例：release允许 stable item 已从 current draft 移除，但 SalesMenu owner仍必须证明原 menu/item关系；这样不会因删除草稿行而失去清理STAGED资产的路径。它不放宽到任意同workspace资产。
- 事务边界：沿用现有 Asset owner 的 object I/O 事务外规则；actual-target judgment在物化前，relational stage在Asset事务内；whole-save claim在draft lock内再次判定，防止前置judgment与保存之间的目标漂移。
- 同根同步：operation/path/schema、typed problems、跨owner矩阵、owner API、asset migration、frontend generated args、13+1+1 acceptance分母、L2图片case、实施计划 SM-01..06。
- 可证伪 closure：无 capability、cross-store/menu/item、wrong usage、already released/claimed/version conflict 都必须拒绝且menu/asset target/lifecycle不变；valid stage/release返回权威readback。任一只检查workspace/usage或adapter只读ambient page state即重新OPEN。
- 拒绝更小替代：只在item save时验会留下未授权stage/release side effect；只持bindGrant不能证明业务target；直接复用Catalog request会把dataNode/brand语义带进menu；不持久化target无法在release/claim重判。

## F-M-202 · “全部”入口/菜单/候选与 Cursor/20 无用户可达性

- 处置：`CONFIRMED`。
- 亲验证据：已接受 IA 明确“全部可维护经营入口”“全部菜单”，而 Round 2 前详设把channel/menu/candidate改成Cursor/20，只写“visited pages/顺序加载”，没有分页位置、搜索reset、selector保留或第21项行为。共享 `CursorPagination`/`useCursorStack` 已存在，因此缺口是设计选择，不是foundation缺能力。
- 根因：把owner集合协议写完整，却漏了非表格surface的用户控制面；“全部”被误读成首个page或后台全量数组。
- 最小修复：统一“全部=每项经显式控件可达，不等于一次取全”。channel cards下、selector下拉面板底部、manager菜单行下、candidate右侧列表下均使用固定20的共享顺序分页；selector与manager各有独立页栈，menu query服务端搜索；selected menu由detail query保留；candidate按category/query reset。三张表/log继续原已接受分页。
- 七套identity：channel、selector、manager、candidate、draft items、published items、operation log互不共享；owner cursor编码适用的store/channel/menu/version/section/mode/filter/query/pageSize；禁止effect循环自动取到`nextCursor=null`、client slice、OFFSET、total、任意跳页和size picker。
- 同根同步：IA implementation-facing可达性澄清、UI interaction、operation collection table、frontend read model、acceptance 21-menu/21-candidate与既有21-channel、L2三个case的20+1 oracle、实施计划 SM-01/05/06/07/08。
- 可证伪 closure：21 channels、21 menus、21 candidates分别能通过明确下一页到达第21项；返回上一页无重无漏；换query identity回第一页；network oracle证明没有自动抽干。任一第21项不可操作或页面自动连续取尽即重新OPEN。
- 拒绝更小替代：“visited pages”不是交互；自动抽干违背无界集合规范；只测sales item表不能证明卡片/selector/drawer/candidate；为所有集合造表格会不必要改变已确认IA形态。

## 同步变更分母

1. `doc/plans/platform/2026-08-31-v2s-sales-menu-information-architecture-codex.md`；
2. `doc/plans/platform/2026-08-31-v2s-sales-menu-ui-interaction-design-codex.md`；
3. `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-design-codex.md`；
4. `doc/plans/platform/2026-09-01-v2s-sales-menu-implementation-plan-codex.md`；
5. `doc/review/platform/2026-09-01-v2s-sales-menu-design-author-reconciliation-codex.md`；
6. 本 intake。

没有修改生产 contract/generated、前后台代码、Testcontainers、L2、Seed脚本或运行环境；没有执行动态验证。Round 1/2独立review正文保留各自当时的原始 NO-GO，不回写成GO。

## 最终作者决策

两项 finding 都是可由当前规范和 owning source 消解的设计完整性问题，不需要新的产品裁定。作者完成最小同根修复后按两轮上限执行：

```text
ROUND_FINAL_DECISION=SELF_DECIDED
SELF_DECIDED_FINDINGS_OPEN=0
SELF_DECIDED_STATIC_CLOSEOUT=READY_FOR_DEXTER_AND_CLAUDE_REVIEW
THIRD_CODEX_REVIEW=FORBIDDEN_FOR_SAME_CYCLE
DYNAMIC_EVIDENCE=NOT_RUN
```

该状态不是独立GO，也不是Testcontainers/L2/Seed PASS。Dexter与Claude应针对修复后当前字节独立review；若他们确认新产品歧义或实质改变批准范围，再由Dexter决定是否建立新的review cycle。
