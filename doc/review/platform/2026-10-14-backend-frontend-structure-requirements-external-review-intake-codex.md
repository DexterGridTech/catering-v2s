# 前后台重点代码结构优化 · 外部需求评审 finding intake

日期：2026-10-14。`DOCUMENT_KIND=FINDING_INTAKE`；作者会话，非 fresh，主 agent 亲自核验和修订。本文是处置记录，不是独立 verdict，不授权详设或实施。

## 1 · 输入、顺序与权限

- 外部报告：`doc/review/platform/2026-10-14-backend-frontend-structure-requirements-external-review-claude.md`，SHA-256 `b4eeb58deeb31ccff409f375973f6920a9c85774309d02eb9cac511ab2bbf5d4`。
- 外部输入 verdict：`NO-GO`，`M/S/N=0/1/3`；仅对应正式需求 SHA-256 `07ebaf95e16e78b1951ae52ca65e38bb5d451bfd757f87a09e667bfd7a232120`。原报告与此前 R1/R2/R3 不改写。
- 修订后正式需求：`doc/plans/platform/2026-10-13-backend-frontend-key-code-structure-optimization-formal-requirements-codex.md`，SHA-256 `378cdeae15b2b0b90a9b95d0cda865ff3930a898f2969ca41566191eda694f47`。
- Dexter 转交本次 finding 后，主 agent 重开入口、cs-review/cs-memory-recall、适用 kernel/六维路由原文、正式需求和 owning source，先核事实与反例，再决定处置。阅读外部 finding 在前，因此不声明盲审。没有召集新 DESIGN 轮次，不以作者 intake 替代独立复评。
- 当前任务沿既有需求编写授权及“复核处置”处理需求和本记录。只修改这两份文档；未修改分析稿、旧审查报告、TER T1、规范、记忆、生产源码、测试、生成器、契约或依赖。没有执行生成/check、编译、测试、verify、DEV、数据或设备操作；未读 `.runtime/`，未核对运行 evidence。

## 2 · 逐项处置

| 输入项 | 源码核验分类 | 文档处置状态 | 当前需求位置 | Dexter 裁决 |
|---|---|---|---|---|
| S-1 双目标生成物与 TER 排除边界冲突 | CONFIRMED；不采用“生成物不算生产代码”的说法 | CLOSED（作者文档处置） | §2:40；R-04:80–81；V-03:171；§5:188 | 无新增产品裁决；与 T1 的实施先后仍由 Dexter 统筹 |
| N-1 空值规则、HTTP 验收与 legacy 使用者 | PARTIALLY_CONFIRMED；核心确认，纠正全仓 CLEAR 单测定位的过度概括 | CLOSED（作者文档处置） | R-12:115–118；V-12/V-13:180–181；§5:188 | 否 |
| N-2 两类状态与多种 fallback | CONFIRMED；补齐评审摘要遗漏的门店 DISABLED 分支 | CLOSED（作者文档处置） | R-13:122–123；V-14:182 | 否，本批保持现文案/fallback，不统一“已作废”为“作废” |
| N-3 三组遗漏的跨 feature 深引用 | CONFIRMED | CLOSED（作者文档处置） | R-09:102；V-08:176 | 否，D-02 已覆盖 |

以上 CLOSED 只表示已确认的文字缺口在源头补正，不表示实现、测试或新字节独立审查已通过。当前修订字节的外部复核为 PENDING。

### S-1 · 生成器多目标是实际生产影响

**仓内事实**：`scripts/generate/terminal-remote-control-protocol.mjs:10–12` 同时列出 TER 和 operations-admin 输出；`:222–230` 一次 render 后写入两个目标；`:235–237` 分别比对同一内容。`apps/terminal/kernel/base/remote-control/src/foundations/parseRemoteControlMessage.ts:1` 实际导入 TER 生成物，其 `:13–45` 仍有本地 reason 集合。当前 TER 已有 declarations，但生成器的两条 outputPaths 尚未变化；不能以旧目录印象替代本次读回。

**影响/反例**：原 R-04 要求改 renderer，§2 却排除所有 TER 生产代码；只更新 admin 将产生 drift，更新双目标则超出字面范围。生成物被生产消费，称它“非生产代码”只是隐藏影响。

**最小修正**：正式需求明确未来实施的窄配套影响：同一 renderer、相同 additive export、两目标同步检查，原类型/export/wire 语义保持；TER 手写 parser/actor/declarations/入口不改、不接入新常量。详设重开实际 outputPaths，与 T1 最终路径协调。TER 手写闭集是邻接同根，归 T1 自身，不成为本批整改义务。

**更小替代比较**：保留双目标原生成路径，仅补清影响边界；拒绝只改一侧、分目标渲染和复制第二枚举。没有新增框架、运行面或现在的源码授权。

### N-1 · 表单规则、wire 形状与 proof 必须分层

**仓内事实**：`apps/frontend/operations-admin/src/features/organization-structure/model/organizationExtensionValues.ts:31–49` 在 DATE 规范化后将 undefined/null/空字符串判空，原值存在则 CLEAR，否则 omission；false/0 不被清除。`:58–59` 仅 cast legacy list，没有转对象。`apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/extension/ExtensionSubmissionWireMapper.java:15–36` 已支持对象并把 key:null 转 owner CLEAR；`:39–49` 是 HTTP legacy 数组适配，不能与 owner 的 typed list 混为一谈。

`apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/ExtensionAcceptanceScenarios.java:301–307`、`:482–485`、`:523–524` 是 legacy SET fixture；`:331–336` 断言 typed readback。该文件不能证明非空对象 SET 或 HTTP CLEAR，原需求 §5 的已有覆盖表述过强。

**反例与收窄**：外部报告称全仓 CLEAR 只在 mapper test，主 agent 找到 `apps/backend/catering-business-server/modules/organization/src/test/java/com/catering/v2s/organization/application/BusinessEntityValueSupportTest.java:45` 的 owner CLEAR 反例。因此拒绝“全仓仅一个 CLEAR 测试”的概括，但该单测不推翻 HTTP 链覆盖缺口。`apps/frontend/platform-admin/src/features/workspace-management/ui/CommercialGroupInitializationDrawer.tsx:26–38`、`:125` 已构造对象；不能把一个 App 的 legacy serializer 说成所有生产提交者的形状。

**最小修正**：R-12 补空值到 CLEAR/omission 的精确转换，保持 JSON wire null 与表单空字符串不同；§5/V-12 指定未来在现 ExtensionAcceptanceScenarios 补对象 SET（false/0/DATE）、CLEAR=null 持久化读回，以及 omission/未变化断言。所有测试仅静态阅读，未执行。

legacy 的去留在详设按迁移后的真实生产调用链判断：无生产提交者则删旧适配并同步迁移全部依赖 fixture；保留必须有具名生产理由。测试/fixture 不是使用者或长期兼容理由。不得先删 owner typed list，也不得只迁移本文件而遗漏其他 acceptance fixture。

**同根检查/更小替代**：检查既有 mapper 两个入口、owner CLEAR 单测、两 App 表单与共享 helper 引用；现 typedExtensionValues/extensionSet 还被其他 acceptance 域复用，后续迁移须重开实际引用。保留既有场景与 mapper 接缝即可，不新造 runner、不要求十四 operation 各跑完整浏览器 Journey、不靠双 cast 继续隐瞒形状。

### N-2 · 保留现用户表现，不混用状态机

**仓内事实**：`apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx:755–756` 的规则列表是 ENABLED→启用/success，其余→停用/warning；`:1086` 与 `:1311–1312` 的详情对未知值→状态未知；`:1125–1132` 的门店表是 UNKNOWN→未知、VOIDED→已作废、DISABLED→停用，其余→启用。外部摘要未列 DISABLED，不能据摘要删此分支。`:753` 的规则筛选只有 ENABLED/DISABLED，不应新增 VOIDED。

`libraries/frontend/admin-ui-foundation/src/presentation/lifecycleLabels.ts:3–19` 已有标签/色彩，VOIDED 文案为作废，未知 label 返回 raw；直接把此 helper 套入现页面会改变文案或裸显未知值。

**最小修正/取舍**：两类状态分别消费 foundation 已知常量，feature 明确保有可见文案别名和 fallback。按 D-01 保留规则列表未知落停用、详情未知落状态未知、门店已作废/未知/DISABLED及现其他分支；保持现状不证明未知实际等于停用/启用。本次不静默“修正”用户表现，也不改 foundation 的通用 helper。若另行统一显示，须明确产品输入。

**同根与更小替代**：核对规则列表、详情、门店列表及新建选择/成功提示，区分已知闭集与异常 fallback；报告与远控状态不属于主数据词表。只需现 feature 的显式分支与已知常量，不新建通用状态 registry，也不把门店 VOIDED 加入规则。

### N-3 · 公开边界要求应有完整实际消费者

**仓内事实**：额外三组当前共十一处跨 feature 引用，含 type-only，不是运行证明或永久数量门：

| 内部能力 | 当前外部引用位置（operations-admin/src/features/ 下） |
|---|---|
| organization-structure/model/organizationStatus | business-channel/model/businessChannelCodeLabels.ts:7；store-management/ui/StoreManagementPage.tsx:41、StoreDetailDrawer.tsx:23、StoreStatusModal.tsx:6；store-profile/ui/StoreProfilePage.tsx:27 |
| store-operating-rules/model/useStoreOperatingRuleGate | store-service-point/ui/StoreServicePointPage.tsx:44；inventory-management/ui/InventoryManagementPage.tsx:27；catalog-management/ui/controllers/CatalogWorkbenchController.tsx:13、ui/CatalogWorkbenchContent.tsx:5（类型）；sales-menu/ui/SalesMenuPage.tsx:77 |
| business-channel/model/businessChannelCodeLabels | sales-menu/ui/SalesMenuPage.tsx:72，消费 accessKindLabels/orderKindLabels |

`apps/frontend/operations-admin/src/features/audit-history/index.ts:1` 是窄入口正例；`store-operating-rules/model/useStoreOperatingRuleGate.ts:12` 定义消费类型，查询、刷新和 scope 仍属该 feature 的能力，不应搬成无业务 foundation。

**最小修正**：R-09/V-08 点名上述三组，与 remote/extension 一起完成实际边界；未来只导出确有外部消费者的符号，消费方改到窄入口，内部同 feature 引用保留。查询 owner、scope、刷新、业务实现和 App generated 执行接缝均不搬移。

**更小替代**：在现 feature 增加窄入口并改引用，成本有限，D-02 已授权问题族；不新建公共业务包、不全目录 export、不做每 feature 自动生成 HTTP 或机械空 index。明确延后这些引用会留下已发现同根且要再次整顿，故不采用。

## 3 · 失败模式与后续 review 清单

这里只记录本次复用的审查问题，不建立规范或机器门：

1. 多目标生成器：改 renderer 前核其全部输出及生产消费者；排除范围须明确派生副作用；不可通过改称“非生产”隐藏越界。
2. 形状迁移：分别检查表单规范化、wire、edge、owner 与真实 HTTP proof；fixture 不替代生产调用者；删除旧支路须同步依赖 fixture。
3. 状态复用：按领域/实际分支比较标签、颜色、未知 fallback；已知常量复用不意味着全局改文案或统一状态机。
4. 窄入口：同时扫值 import、type-only import 与转导出；只公开实际被消费的能力，不移动事实 owner。

适用边界是本批已批准结构问题族；有单目标生成器、已按 canonical 对象提交、合法同 feature 引用、不同状态机的路径均为反例，不机械整改。正式需求 R-15/R-16/V-16/V-17 已要求后续详设把这些实例与最小解落到既有测试/明确清单，不加控制面。

## 4 · 结论与证据边界

作者已完成四项文字处置与交叉读回，不自行给修订字节写独立 GO；本记录不改变原外部 NO-GO 或 R3 的旧字节结论。修订需求的独立外部复核仍为 PENDING，宜只核本次 §2、R-04/R-09/R-12/R-13、对应 V 及 §5/§7 差量与同根。

- 静态可确认：双目标生成路径、表单/mapper 行为、现测试源码形状、状态分支、十一处深引用及窄入口正例。
- `L3_UNVERIFIED`：结构优化后的菜单、Page/Drawer、远控和扩展提交行为；当前需求 §7:202 明确列出，未读历史 evidence，不宣称既有 UI 从未验证。仅余此类 UI 未验证时，独立 reviewer 按 review-standard 使用 GO_WITH_UNVERIFIED_UI。
- 所有拟议源码/测试/生成整改、编译、测试、verify、H/L2、DEV、数据、设备、部署与 cleanup 均 NOT_RUN；本次没有新增动态环境，cleanup 无运行对象，不写 PASS。
- 仍属后续设计义务：迁移后的 legacy 真实生产调用者与 fixture 完整范围、T1 最终输出位置/先后协调、各 V 的具体测试/场景/fixture 落点。它们不是当前已实施事实。

治理层 DESIGN_GAPS 保留供 Dexter：M/S/N 正本定义，以及 DESIGN 默认两轮与“直至 GO”追加轮次的关系。不修改治理规范、不新增裁决、不以这两项扩大本需求产品范围。
