REVIEW_CYCLE_ID=BUSINESS_CHANNEL_STORE_VISIBILITY_DESIGN_2026_09_08
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
AUTHOR_VERDICT=FORBIDDEN_BEFORE_REVIEWER
VERBATIM_SUBAGENT_OUTPUT_BEGIN
Dexter，

**REJECT / NO-GO**

REVIEW_CYCLE_ID=BUSINESS_CHANNEL_STORE_VISIBILITY_DESIGN_2026_09_08  
REVIEW_TARGET=DESIGN  
REVIEW_ROUND=1  
REVIEW_ROUND_LIMIT=2  
reviewerKind=INDEPENDENT_SUBAGENT  
输入清单：`doc/review/platform/2026-09-08-v2s-business-channel-store-visibility-design-independent-review-round1-input-checklist-codex.md`  
blind declaration：我先读清单要求的仓库入口、规范、项目记忆、owning source、Journey/IA/UI interaction/implementation design/implementation plan；未先读作者 disposition/self-review/Claude brief；未修改文件，未运行生成、迁移、测试、seed/reset/DEV/L2/UAT/Git，未召集子 reviewer。

M/S/N：**2 / 3 / 1**

Justification：设计方向本身有不少正确闭包：候选按 `ALL OR EXISTS`、既有 channel list/detail retention、template/store/channel 生命周期事实分离、owner command CAS/idempotency/audit/readback/rollback、acceptance fixture 至少两家同项目 ENABLED store 等都有明确设计。但当前文档还不能作为 implementation-ready DESIGN 输入：存在产品裁决硬门未闭、UI/IA 模板强制维度缺失、API owner 表引用错层、TestId 分母跨文档不一致、seed denominator 不精确。

## Findings

### M-01 — DEXTER_DECISION：产品边界仍是硬门，当前不能 GO 到实施

证据：

- Journey 明确列出待 Dexter/Claude review 的边界：ALL 是否覆盖未来门店、SELECTED 空集合、disabled/voided store 关系、保存时提交、PROJECT wire 形态，且写明未明确接受前为 `PROPOSED_FOR_REVIEW`：`doc/decisions/2026-09-08-v2s-business-channel-store-visibility-journey-amendment.md:109-119`
- Implementation plan 写明 D-BCV-01..06 未接受前“计划停在设计阶段”：`doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-plan.md:30-41`
- Implementation design 的 unresolved ledger 仍标 DEXTER_REVIEW_REQUIRED / PROPOSED_FOR_REVIEW：`doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-design.md:336-347`

反例：如果 Dexter 选择“ALL 不含未来门店”，当前 `ALL_PROJECT_STORES` 动态 membership 方案会改变 relation table、候选 SQL、seed 和 acceptance；如果 SELECTED 允许空集合，则当前 `BUSINESS_CHANNEL_STORE_VISIBILITY_EMPTY`、UI copy 和候选空态都要改。

影响面：contract enum/wire、migration、candidate SQL、create/update owner policy、UI copy、acceptance fixture、seed。

最小修复：先取得 D-BCV-01..06 的明确裁决；任一裁决改变时，同步回写 Journey、IA、UI interaction、implementation design、implementation plan 后再进入实施。

是否需 Dexter 产品裁决：**是**。

同根 sibling 检查范围：D-BCV-01..06 在 Journey、IA、UI interaction、implementation design、implementation plan 中逐项对读；确认是未决硬门，不是动态证据缺口。

---

### M-02 — CONFIRMED：IA 与 UI interaction 未满足强制模板维度，implementation-facing 输入不完整

证据：

- IA 模板要求每个 IA-ID 不得省略 `emptyLoadingErrorStates`、`containerBehaviorUnderLoad`、`collectionShapeAndScale`、`forbiddenUI` 等维度：`doc/decisions/templates/ia-design-template.md:34-65`
- UI interaction 模板要求每个 user-facing screen/surface 单独声明 `UI_SURFACE`、`USER_VISIBLE_COPY`、`TECHNICAL_BOUNDARY`、`FOUNDATION_PRIMITIVE`、`CONTAINER_LAYOUT`；缺项的 screen 不得进入 implementation-facing design：`doc/decisions/templates/ui-interaction-design-template.md:31-47`
- 当前 IA 的 IA-BCV-O1/O2/O1T/O5/O5C 均只有折叠式文本块，没有上述模板键：`doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ia.md:48-115`
- 当前 UI interaction 只有全局 `CONSUMER_FACE=operations-admin` 和 Screen O2/O1/O1T/O5/O5C 的章节/线框，不含逐 screen 的 `CONTAINER_LAYOUT` 等强制字段：`doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ui-interaction.md:39-82`, `:104-153`

反例：visible-store selected Page 超页、长门店名/编码、候选区失败保留旧数据、Drawer 内局部滚动等，都需要明确容器与空/加载/错误行为；否则实施者会临场发明，L2 也无法判断“正确 UI”。

影响面：operations-admin IA、UI interaction、foundation consumption、focus/error recovery、TestId/L2 admission。

最小修复：为 IA-BCV-O1/O2/O1T/O5/O5C 补齐模板要求的全部维度；为 O2 Drawer、O1/O1T、O5/O5C 拆出逐 surface 的 UI interaction 标准块，尤其补 `CONTAINER_LAYOUT` 和 `FOUNDATION_PRIMITIVE`，并与 IA 逐字对账。

是否需 Dexter 产品裁决：否，属于设计工件缺口。

同根 sibling 检查范围：5 个 IA-ID 全扫；UI interaction 三个 Screen 章节与模板强制字段全扫。

---

### S-01 — CONFIRMED：implementation design 的 owner API / consumer 表把 read API 写成了 sales-menu owner API

证据：

- 当前 `BusinessChannelReadApi` 才声明 `pageStoreTemplateCandidates`：`apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelReadApi.java:6-25`
- 当前 `BusinessChannelOwnerApi` 是 sales-menu owner 需要的 owner-native facts，只含 `listSalesMenuEligibleChannels`、`requireSalesMenuChannel`、`salesMenuChannelBelongsToStore`：`apps/backend/catering-business-server/modules/business-channel/src/main/java/com/catering/v2s/businesschannel/api/BusinessChannelOwnerApi.java:7-28`
- Operations controller 当前也通过 `BusinessChannelReadApi businessChannels` 调 candidate：`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/businesschannel/OperationsBusinessChannelController.java:64-70`, `:124-130`
- 但 implementation design 表写成 `BusinessChannelOwnerApi.pageStoreTemplateCandidates` 和 `new BusinessChannelOwnerApi.pageTemplateVisibleStores`：`doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-design.md:272-283`

反例：实施者按表把 visible-store page 加到 `BusinessChannelOwnerApi`，会把 operations management read 暴露到 sales-menu owner API 语义层，造成 owner API 消费者边界漂移。

影响面：business-channel API split、operations edge、sales-menu owner API、zero/foreign consumer method 检查。

最小修复：把表改为 `BusinessChannelReadApi.pageStoreTemplateCandidates` 与 `BusinessChannelReadApi.pageTemplateVisibleStores`；若确实要进 `BusinessChannelOwnerApi`，必须说明 sales-menu consumer 为什么需要它，并重写 consumer 清单。

是否需 Dexter 产品裁决：否。

同根 sibling 检查范围：`BusinessChannelReadApi`、`BusinessChannelOwnerApi`、`BusinessChannelOwnerService implements`、`OperationsBusinessChannelController` candidate wiring 已核。

---

### S-02 — CONFIRMED：TestId 分母跨文档不一致，save/cancel 在 detailed design 中丢失

证据：

- IA 要求 Radio、添加、删除、候选搜索、保存、取消均由唯一 `businessChannelTemplateTestIds.ts` 提供常量：`doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ia.md:62-74`
- UI interaction roster 明确包含 `template save` / `template cancel`：`doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ui-interaction.md:87-102`
- Implementation plan 也包含 save/cancel：`doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-plan.md:146-150`
- 但 implementation design §13.3 的 TestId 分母只列 scope/add/search/add-row/remove-row/page controls，漏了 save/cancel：`doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-design.md:304-306`
- 当前源码 save/cancel 仍是 inline literal testId：`apps/frontend/operations-admin/src/features/business-channel/ui/BusinessChannelTemplateDrawer.tsx:175-188`

反例：实施者按 implementation design 执行，只给新增 scope/add/remove 控件建常量，保存/取消继续散写 inline literal，导致 L2 binding 不能从唯一源消费 footer action。

影响面：operations-admin automation identity、L2 admission、Drawer 保存/取消焦点恢复、future browser proof。

最小修复：在 implementation design §13.1/§13.3 明确加入 `formSubmit`、`formCancel`，说明迁移当前 inline literal 到 `businessChannelTemplateTestIds.ts`，并要求真实 Button 节点绑定。

是否需 Dexter 产品裁决：否。

同根 sibling 检查范围：IA、UI interaction、implementation design、implementation plan、当前 `BusinessChannelTemplateDrawer.tsx` footer buttons 已核。

---

### S-03 — CONFIRMED：seed 设计没有列出受影响 seed 文件全集；当前同根 seed plan 明显会受模型变化影响

证据：

- Implementation design template 强制 §10b.1 列出受影响 seed 文件全集，不能写泛称：`doc/decisions/templates/implementation-design-template.md:208-249`
- 当前 implementation design 只写 seed 顺序，没有精确 seed 文件全集：`doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-design.md:330-334`
- 当前 implementation plan 也只写 “existing managed seed owning source 与本批 fixture definition”，没有路径：`doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-plan.md:160-173`
- 同根扫描发现当前业务相关 seed plan 至少包括 `scripts/dev/external-collaboration-business-channel-seed-plan.mjs`，其 ownerNodes 只有一个 `COLLAB-STORE`，且 templates 仍是旧形态无 visibility scope/relations：`scripts/dev/external-collaboration-business-channel-seed-plan.mjs:16-28`, `:65-74`
- executor 还断言模板 denominator 为 8：`scripts/dev/external-collaboration-business-channel-seed-executor.mjs:151-160`

反例：实施后如果 seed plan 仍只有一店、模板无 visibility scope/relations，未来 `reset + seed` 可能造不出 SELECTED/ALL 关系、两店候选、移除 visibility 后 channel retention 等体验事实，即使 acceptance 自建 fixture 通过也不能证明 DEV seed 可用。

影响面：managed seed plan/executor/static tests、business-channel fixture、future DEV experience。

最小修复：在 §15/CP-05 写出 seed 文件全集，例如至少核对并列出 `scripts/dev/external-collaboration-business-channel-seed-plan.mjs`、`scripts/dev/external-collaboration-business-channel-seed-executor.mjs` 及其测试；为每个新增/调整事实写处置：两家同项目 ENABLED store、ALL/SELECTED、visible relation、remove visibility 后 readback retention、static test denominator 更新。

是否需 Dexter 产品裁决：否；是否执行 seed 仍需另行授权。

同根 sibling 检查范围：`scripts/dev/*seed*`、backend acceptance source、business-channel seed plan/executor/test 命名命中范围已核。

---

### N-01 — CONFIRMED：O5 空态文案 IA 与 UI interaction 不逐字一致

证据：

- IA O5 空集文案：`当前门店暂无可选模板`：`doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ia.md:90-101`
- UI interaction O5 空态文案：`当前门店暂无可选的渠道模板`：`doc/decisions/2026-09-08-v2s-business-channel-store-visibility-ui-interaction.md:123-131`
- IA 模板要求两份文档同一事实逐字一致：`doc/decisions/templates/ia-design-template.md:5-8`

反例：UI 实现选一种文案，L2/静态 copy oracle 选另一种，review 时会出现“用户看见的是对的还是错的”无法判定。

影响面：O5 empty state、copy oracle、L2 expectation。

最小修复：选择一个最终文案并同步 IA/UI interaction/implementation design/code labels；建议优先用 UI interaction 的完整业务文案，除非 Dexter 想更短。

是否需 Dexter 产品裁决：通常否；若要改业务措辞风格，可由 Dexter 裁。

同根 sibling 检查范围：O1/O2/O1T/O5/O5C user-visible copy 对读；本轮只确认 O5 empty copy 存在逐字差异。

## L3 / dynamic evidence

以下均为 **UNVERIFIED_REQUIRES_EVIDENCE**，不是本轮 DESIGN PASS：

- backend acceptance 场景与 red mutation 未执行；设计只列了场景：`doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-design.md:308-328`
- contract generation / generated edge / migration 未执行。
- seed/reset/DEV/backend acceptance/browser L2/UAT 未执行；implementation plan 也明确当前不执行动态：`doc/plans/platform/2026-09-08-v2s-business-channel-store-visibility-implementation-plan.md:198-207`
- 事务/锁/CAS/幂等/audit/readback/rollback 当前只可静态设计审查；运行期原子性不能由静态设计关闭。

## Summary

- Clarity：核心业务意图清楚，但 D-BCV 产品边界未闭，不能 implementation-ready。
- Verifiability：acceptance 场景设计有真实 HTTP/business oracle 意识；但 IA/UI 强制维度和 seed denominator 缺口会让后续验证漂移。
- Completeness：backend owner 机制大体覆盖；UI/IA 与 seed 部分不完整。
- Big Picture：方案没有明显过度设计；选择 scope column + relation table 而非复制 channel/状态事实是合理方向。
- Principle/Option Consistency：非 ralplan；三个方案比较存在且不浅。
- Alternatives Depth：可接受。
- Risk/Verification Rigor：设计层可接受但动态项必须保持 UNVERIFIED。
- Deliberate Additions：不适用。

## Round 2 定向核验点

1. D-BCV-01..06 是否已有明确裁决，并同步到 Journey/IA/UI interaction/implementation design/implementation plan。
2. IA 是否补齐 `emptyLoadingErrorStates`、`containerBehaviorUnderLoad`、`collectionShapeAndScale`、`forbiddenUI`；UI interaction 是否逐 surface 补齐 `CONTAINER_LAYOUT` 等强制字段。
3. API owner/consumer 表是否改回 `BusinessChannelReadApi`，没有把 operations read 塞进 sales-menu `BusinessChannelOwnerApi`。
4. `businessChannelTemplateTestIds.ts` denominator 是否包含 save/cancel，且当前 inline literal 有明确迁移路径。
5. Seed design 是否列出精确 seed 文件全集，并覆盖当前一店旧 seed plan 的两店/visibility relation 改造。


VERBATIM_SUBAGENT_OUTPUT_END

