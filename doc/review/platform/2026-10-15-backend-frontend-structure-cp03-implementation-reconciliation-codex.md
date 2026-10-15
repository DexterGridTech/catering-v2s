# 前后台结构优化 CP-03 实施与对账记录

## 范围与当前状态

- CP：03，operations-admin 页面注册、feature 窄入口与局部生命周期呈现。
- 主 agent 实施状态：菜单候选 helper 的最新差量已由 `/root/cp03_delta_after_assert_r3` fresh reviewer 判为 `MATCHED`；下文早期“等待 fresh reviewer”文字是对应形成时点的历史快照，以本段和末尾差量结果为当前状态。该结论不代表 D_BROWSER/DEV 动态通过。
- 判据：正式需求 R-08、R-09、R-13；详设 §8.4、§8.6；计划 CP-03；项目记忆前端能力优先复用与逐点读回纪律。
- 本 CP 未改路由、scope、焦点、查询生命周期、业务授权或状态 owner；未操作 DEV、UAT、浏览器或设备。CP03 是纯前端源与单测范围，没有需要 PostgreSQL/Testcontainers 的 owning behavior。Dexter 已确认 Testcontainers 对确有数据库边界的后续相关 proof 可用。

## 主 agent 核验、实现与最小处置

| 范围 | 当前源码事实与修改 | 适用边界 |
|---|---|---|
| 页面注册与菜单成员 | `pageRegistry.tsx` 的 `Registration` 增加必填 `icon: ReactNode`，现每个 registry 项均在自身声明图标；`OperationsApp.tsx` 删除 `menuIconByKey` 和 icon filter。菜单候选仍按 session 授权 keys，逐项要求 catalog page 与实际 registration 均存在，再沿既有 `menuOrder` 排序。组图标 `navigationIconByKey`、route、scope、焦点代码保持。 | 不使用默认图标掩盖注册遗漏；`Record<OperationsPageDesignKey, Registration>` 与必填 icon 由 TypeScript 检查完整闭包。 |
| 组织状态窄入口 | 新增 `organization-structure/index.ts`，只导出 `organizationStoreStatusLabels` 与 `toggleOrganizationStoreStatus`；门店管理/详情/状态弹窗和门店资料页改从该 feature 入口消费。删除 `businessChannelCodeLabels.ts` 对组织状态的转导出及相应重复断言；原 owner 的 `organizationStatus.test.ts` 保留状态词表和切换判据。 | 未把 generated `OrganizationStoreStatus` type 搬入新入口；扩展字段相关旧跨 feature 引用留待 CP04。 |
| 门店规则门窄入口 | 新增 `store-operating-rules/index.ts`，只导出 `useStoreOperatingRuleGate` 与 `StoreOperatingRuleGateState`；销售菜单、库存、服务点、catalog controller 和 type-only content 消费者统一改从入口导入。 | hook、请求生命周期与业务状态仍由原 feature 所有；未建立全目录 barrel。 |
| 渠道枚举窄入口 | 新增 `business-channel/index.ts`，只导出 `accessKindLabels` 和 `orderKindLabels`；跨 feature 的 SalesMenu 使用新入口。同 feature 内部 model 引用继续使用本地路径。 | 未导出该 feature 的其他词表或 UI。现有 remote-control index 与更新页消费原样保留。 |
| 更新页主数据状态呈现 | 新增 `terminalUpdateLifecyclePresentation.ts`，规则表/详情/指定门店各用具名 mapper；已知 ENABLED/DISABLED 标签与颜色来自 foundation `LIFECYCLE_LABELS/COLORS`。原列表未知→停用/warning、详情未知→“状态未知”、门店 VOIDED→“已作废”、UNKNOWN→“未知”、其他值→“启用”的差异保持。原页面接入 mapper。 | mapper 只供本主数据 UI；未套用任务、报告或远控状态，也未改 foundation 的“作废”词汇。 |

同根扫描覆盖 OperationsApp、完整 page registry、三个 feature 的所有当前跨 feature status/gate/channel consumers、business-channel 同 feature imports，以及更新页规则/门店状态呈现。检索未发现上述三个能力仍有直接跨 feature internal-model 引用；organization-extension-values 的 CP04 迁移仍按计划保留。

## focused proof 与失败处置

| 范围 | 当前字节上的运行 | 结果与边界 |
|---|---|---|
| 规则/门店状态 presenter、组织与渠道词表 | `yarn exec vitest run src/features/business-channel/model/businessChannelCodeLabels.test.ts src/features/organization-structure/model/organizationStatus.test.ts src/features/terminal-update/model/terminalUpdateLifecyclePresentation.test.ts`，operations-admin cwd | 退出码 0，3 files / 8 tests passed。覆盖 foundation 已知值、规则列表未知回退、规则详情未知文案、门店 VOIDED/UNKNOWN/其他值回退及原组织/渠道词表断言。 |
| 菜单注册和 feature 公共边界 | `node --test src/tests/architecture/public-entry-boundary.test.mjs`，operations-admin cwd | 退出码 0：3 pass、0 fail；1 项既有 TODO 保持 TODO。新增断言验证 Shell 不再有第二 icon map/filter、从 registration 取图标、三组 index 是窄导出、外部消费者无目标内部路径，并保留同 feature 内部相对导入和 remote-control 现入口。 |
| operations-admin 类型边界 | `yarn typecheck`，operations-admin cwd | 最终退出码 0。首跑报告一处编译错误：删除图标映射时误删了 Shell 独立刷新按钮仍使用的 `ReloadOutlined` import；恢复该 import 后复跑通过。没有改变刷新按钮行为。 |
| 定向 lint | `yarn exec eslint src/app/OperationsApp.tsx src/app/routing/pageRegistry.tsx src/features/organization-structure/index.ts src/features/store-operating-rules/index.ts src/features/business-channel/index.ts src/features/store-management/ui/StoreDetailDrawer.tsx src/features/store-management/ui/StoreStatusModal.tsx src/features/store-management/ui/StoreManagementPage.tsx src/features/store-profile/ui/StoreProfilePage.tsx src/features/sales-menu/ui/SalesMenuPage.tsx src/features/inventory-management/ui/InventoryManagementPage.tsx src/features/store-service-point/ui/StoreServicePointPage.tsx src/features/catalog-management/ui/controllers/CatalogWorkbenchController.tsx src/features/catalog-management/ui/CatalogWorkbenchContent.tsx src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx src/features/terminal-update/model/terminalUpdateLifecyclePresentation.ts src/features/terminal-update/model/terminalUpdateLifecyclePresentation.test.ts --max-warnings=0`，operations-admin cwd | 退出码 0。 |
| lint 命令范围修正 | 首次把 Node `node:test` 使用的 `src/tests/architecture/public-entry-boundary.test.mjs` 也传给 ESLint | 退出码 1：该 `.mjs` 被仓内 ignore 规则忽略并触发 `--max-warnings=0`。这是命令文件集误含被忽略测试入口，不是源码 lint 失败。 | 移除被忽略的 `.mjs` 后，用上行精确文件清单重跑退出码 0；该测试仍由 `node --test` 执行并有 red/green 证据。 |
| 曾尝试的 registry runtime 单测入口 | `yarn exec vitest run src/app/routing/pageRegistry.test.tsx ...` | 初次尝试发现 `pageRegistry` 导入所有页面组件会加载仓内 `@ant-design/pro-components`，vitest 当前 ESM/CJS 解析在组件 import 前失败（`ReferenceError: exports is not defined in ES module scope`）。该测试文件已删除，未改变生产依赖或构建配置；改由轻量 Node architecture 断言验证 Shell 接线，required `Registration.icon` + registry `Record` 由 typecheck 验证。 |

## 反例门与逐点材料记录

### 实际 red mutation

| 判据 | 临时反例 | 结果 | 恢复后的证明 |
|---|---|---|---|
| 每个页面注册必须声明图标 | 临时移除 `PgProjectTerminalVersionRules` 的 `icon`，执行 `yarn typecheck` | 退出码 2；TypeScript 在 `pageRegistry.tsx` 的 registry `Record` 赋值及该成员处报告缺少必需 `icon`（TS2322/TS2418）。 | 恢复 `<ReloadOutlined />` 后最终 `yarn typecheck` 退出码 0。 |
| 跨 feature 消费者不得直接导入 owning model | 临时把 `CatalogWorkbenchContent.tsx` 的 type-only gate import 改成 `../../store-operating-rules/model/useStoreOperatingRuleGate`，执行架构门 | 退出码 1；指定 architecture case 失败，准确指出 `CatalogWorkbenchContent.tsx` 必须使用 owning feature 的 public entry。 | 恢复 `../../store-operating-rules` 后架构门退出码 0。为避免失败时打印拼接后的全部源码，本次将门改为逐文件检查并输出命中路径；同 feature 内部 import 的既有允许断言保留。 |
| 生命周期 mapper 保留现有分支差异 | 临时把门店状态 `VOIDED` 的返回值由 `已作废` 改成 `已停用`，执行对应 presenter Vitest | 退出码 1；测试报告期望 `已作废`、实际 `已停用`，明确命中 VOIDED 分支。 | 恢复 `已作废` 后三文件 focused Vitest 退出码 0（8 tests passed）。 |

以上临时错误值均已立即恢复；最终绿门在恢复后的当前字节执行。没有通过放宽断言、延长等待或改产品语义关闭 red。

### 写前输入和记录边界

本轮实际写入前已读取的判据与 owning source 如下。需要如实说明：前序实施中没有为每个变更点即时落盘逐点双读日志；本表根据当时已读取的会话材料和当前源码定位补列，不把补录冒称为当时形成的同期记录。写后读回见下一节，fresh CP reviewer 需据此判定记录缺口是否可关闭。

| 写入范围 | 写前已打开的依据 | owning source/直接消费者 |
|---|---|---|
| 注册图标与 Shell 菜单 | 正式需求 R-08；详设 §8.4；计划 CP-03.1；原 IA：IA-03 §2 平台屏准入、IA-04 §2 运营屏入口、更新供给 IA §2 RULE-LIST、销售菜单交互稿 §2 页面操作顺序；这些 IA 的交互/权限/菜单层级均不改变 | `app/routing/pageRegistry.tsx`、`app/OperationsApp.tsx`、完整 registry 与菜单授权过滤；记忆 `project-memory/practices/frontend-capability-lookup.md`、`project-memory/operations/implementation-source-reread-discipline.md` |
| feature 窄入口 | 正式需求 R-09；详设 §8.4；计划 CP-03.2；IA-04 §2 门店/组织入口、销售菜单交互稿 §2–4、更新供给 IA §2 RULE-LIST/DETAIL；仅改变源码依赖边界，不改变 IA 操作 | 三个 feature index、全部迁移 consumers、同 feature 合法 model import、原 owning tests；同上两条路由记忆 |
| 更新主数据 lifecycle 呈现 | 正式需求 R-13；详设 §8.6；计划 CP-03.3；更新供给 IA §2 RULE-LIST、RULE-DETAIL（指定门店状态行）；foundation 状态词表原文见前端能力记忆 | 原页面三个状态呈现点、foundation `LIFECYCLE_LABELS/COLORS`、新增 mapper 与 focused test；记忆 `project-memory/practices/frontend-capability-lookup.md`、`project-memory/operations/implementation-source-reread-discipline.md` |
| architecture 门扩展 | 正式需求 R-09/R-13；详设 §8.4；计划 CP-03.4；无 UI/IA 行为变化，IA-04/销售菜单/更新供给 IA 继续按上列原入口；这是源码边界判据，不增加交互 | `tests/architecture/public-entry-boundary.test.mjs`、所有列出的受影响 imports、remote-control 公开入口；同上两条路由记忆 |

本 CP 未启动 managed run，无长运行 PID、DEV/Testcontainers 资源或 cleanup 事项；dynamic Web/DEV 行为留在计划的整体准入后，不从 source/unit proof 推断通过。UAT 与真机未触碰。

## 写后读回

以下是本次补证时重新打开同组原文与最终字节后的逐点读回记录。原实施当时已读过这些材料，但未同期逐点落盘，历史状态保持 `NOT_RECORDED`；本表记录现在确实执行的复核，不倒填成同期证据。

| CP03变更点 | 当前重读的原文与 IA | 当前源码读回 | 对应 focused proof / 证据边界 |
|---|---|---|---|
| Registration 与 Shell menu | R-08；详设 §8.4；计划 CP-03.1；IA-03 §2 `IA03-ORG-OVERVIEW/CONTRACT-OVERVIEW`；IA-04 §2 `IA04-ORG-TREE/STORE-PAGE/CONTRACT-PAGE`；更新供给 IA §2 `RULE-LIST`；销售菜单交互稿 §2。重读记忆 `project-memory/practices/frontend-capability-lookup.md`（复用边界）与 `project-memory/operations/implementation-source-reread-discipline.md`（逐点双读）。 | `pageRegistry.tsx:36-41` 的必填 `icon`、完整 `operationsPageRegistry` 每项 icon 与 `Record`；`OperationsApp.tsx` 的 `accessiblePages` 仍按 session keys 与 catalog/registration 交集排序，menu child 从 registration 取 icon；group icon、route、scope、焦点代码未改。 | 移除 terminal-update registration icon 的 typecheck red→恢复 green；菜单/注册 architecture red→green；当前最终 `yarn typecheck` exit 0 与 `node --test ...public-entry-boundary.test.mjs` exit 0。未运行浏览器。 |
| 三组 feature public entry | R-09；详设 §8.4；计划 CP-03.2；IA-04 §2 门店页/详情/状态、IA-03 §2 只读组织/合同、销售菜单交互稿 §2–4、更新供给 IA §2 RULE-LIST/DETAIL；重读同上两条 routed memory。 | 三个 index 仍只导出既有 consumers 所需符号；4 个组织状态消费者、5 个规则 gate 消费者（含 type-only）和 1 个 channel label consumer 使用 feature entry；同 feature business-channel model import 仍本地；remote-control index 与更新页原入口保留。 | `CatalogWorkbenchContent.tsx` 的 type-only deep import red→green；逐文件 architecture 门报告违规路径且 green；组织状态/渠道词表原测试随 focused suite通过。没有运行 DEV/Web。 |
| lifecycle 呈现 helper | R-13；详设 §8.6；计划 CP-03.3；更新供给 IA §2 `RULE-LIST` 与 `RULE-DETAIL` 的规则及指定门店状态行；重读前端能力记忆中生命周期标签约束及逐点读回记忆。 | `terminalUpdateLifecyclePresentation.ts` 仅消费 foundation 标签/颜色；`ProjectTerminalUpdatePage.tsx` 的列表、详情、指定门店三处调用该 mapper；未知/作废/其他既有 fallback 保持，不扩至任务/报告/远控状态。 | VOIDED 临时错误标签 red→恢复 green；最终三文件 focused Vitest 8 tests passed。无动态UI证明。 |
| architecture boundary 门 | R-09/R-13；详设 §8.4；计划 CP-03.4；用户界面 IA 操作不变；重读同上两条 routed memory。 | 当前 `public-entry-boundary.test.mjs` 对消费者逐文件检查目标内部路径；仍容许同 feature model import，并检查 remote-control 既有公共入口。 | 非法 type-only direct import red→green；正常 architecture command 当前 exit 0（3 pass、1既有 TODO）。门的边界仅为本 CP 指名的三个能力，不冒称所有 model deep-import 的全仓静态分析。 |

重读原文同时确认：组织状态用词按 foundation 约束；销售菜单的入口/草稿/前台操作顺序不变；更新规则与状态页仍是既有双 Tab；CP03 只移状态词表/门控/labels 的源码边界，不触碰功能操作、权限或列表事实。

## 全批 6b 差量处置：菜单成员行为证明

- 主 agent disposition：`CONFIRMED`（证明缺口；未确认生产菜单有授权或成员错误）。R-08 与详设 §8.4/V-07 要求菜单候选是会话授权、catalog 页面及真实 registration 的交集，菜单顺序保留，图标缺失不得决定成员。旧 `public-entry-boundary.test.mjs` 仅检查 Shell 源码接线，不能证明候选集合行为；已删除的 `pageRegistry.test.tsx` 未能越过 Vitest ESM/CJS 模块加载错误。
- 最小修正：将 `OperationsApp` 当前实际使用的候选计算提到同 app、单文件纯 helper `selectAccessibleOperationsPages`，测试直接调用同一 helper。focused test 同时证明已授权且 `icon=null` 的 registration 被保留、未授权/未注册/无 catalog 页面被排除、输出按 `menuOrder` 排序。无需挂载整页、增加 DOM 环境或另建 registry。
- 当前 focused 证据：`yarn exec vitest run src/app/routing/accessibleOperationsPages.test.ts`（operations-admin workspace）1 file/1 test PASS；`yarn typecheck` 最终退出码 0。菜单 helper 是生产 `OperationsApp` 直接消费的逻辑；architecture source test 仍只承担边界检查，不替代该行为断言。未运行 D_BROWSER/DEV，焦点与真实菜单渲染仍待计划内动态证明。
- 当前差量涉及文件 SHA-256：`OperationsApp.tsx`=`fc3fe3d37060e138142ae85bd4193c54626d57334996d3d1bd58a88c3d6c994e`；`accessibleOperationsPages.ts`=`0565ef67e5166b6357b9fa4913ac4d4ec002f071b82ee658e6d4252fe1567df8`；`accessibleOperationsPages.test.ts`=`58acad5205f7ae0ae61e72af7824d49a54f45d60d2e5da12e41317bcf570a615`。本段记录当前读取字节，不代表 D_BROWSER/DEV 已验证。
- 修复后 CP-03 当前源码及本差量仍待 fresh 独立 CP-03 reviewer 复核；本段不是独立 verdict。

## 6b 菜单证明后的 CP-03 差量复核

- 主 agent disposition：`CONFIRMED`（架构测试与生产入口的断言失配；未确认生产菜单行为错误）。将候选计算提取为 `selectAccessibleOperationsPages` 后，既有 `public-entry-boundary.test.mjs` 仍断言 OperationsApp 内存在旧内联 `const registration = operationsPageRegistry[key]`。新实现由 Shell 调用 selector，查表实际位于同包 helper；旧断言因此在当前字节上失败。
- 最小修正：只将该 architecture assertion 改为核对 Shell 导入并调用实际 selector；保留注册 icon 与渲染判据。没有恢复重复实现，也没有扩大源文本扫描范围。
- focused proof：修正前 `node --test src/tests/architecture/public-entry-boundary.test.mjs` 退出码 1，唯一失败正是过时内联断言；修正后同命令退出码 0（3 pass、0 fail、1 既有 TODO）；`yarn exec vitest run src/app/routing/accessibleOperationsPages.test.ts` 1/1 PASS。当前 `public-entry-boundary.test.mjs` SHA-256=`bd7fc138fb5bf2fff1fd79a335a85ae68f06c5493b56562aafa322150bd7bf7b`。未运行 D_BROWSER/DEV。
- 其他受影响当前字节：`OperationsApp.tsx`=`fc3fe3d37060e138142ae85bd4193c54626d57334996d3d1bd58a88c3d6c994e`；`accessibleOperationsPages.ts`=`0565ef67e5166b6357b9fa4913ac4d4ec002f071b82ee658e6d4252fe1567df8`；`accessibleOperationsPages.test.ts`=`58acad5205f7ae0ae61e72af7824d49a54f45d60d2e5da12e41317bcf570a615`。本段哈希绑定当前读回字节，不表示已执行浏览器验收。
- 当时 CP-03 差量状态：等待 fresh 独立 reviewer；该状态已由下文 `/root/cp03_delta_after_assert_r3` 的 `MATCHED` 结论更新。旧 verdict 仅适用于各自审查时点。

### Fresh CP-03 差量三维复核结果

- fresh reviewer：`/root/cp03_delta_after_assert_r3`，`reviewerKind=INDEPENDENT_SUBAGENT`，结论 `MATCHED`。其先收到的导航材料含 TER T1 文档；reviewer 发现其 CP-03 与本批不匹配后即报告。主 agent 随后更正为本批正式需求、详设、计划和附件；reviewer 未把 T1 用作判据，并按更正材料重新开展盲核。前两次指定 reviewer 角色因当前 ChatGPT 宿主不支持其固定模型而报错，未形成 verdict。
- 正确阅读顺序：仓库入口/kernel/skill/确定性上下文 → 本批正式需求 R-08/R-09/R-13、详设 CP-03/§8.4/§8.6、计划 CP-03、附件及适用 IA/规范/命中记忆 → 当前生产 selector/helper、行为测试、OperationsApp、完整 page registry、architecture test、feature 入口与消费者、lifecycle mapper/tests → 先形成判断 → 最后读取作者 CP03 记录。
- reviewer 独立确认 `OperationsApp.tsx:101–103` 实际调用 `selectAccessibleOperationsPages`；helper 用授权 keys、catalog 与 registration 交集并按 `menuOrder` 排序，图标不参与成员筛选。当前 behavior fixture 覆盖 null icon、缺授权、缺注册、缺 catalog 及排序。architecture test 核查实际 import/调用及 registration 图标消费，不再要求过时内联查表。三组 feature 窄入口与实际消费者一致；更新页列表/详情/门店状态 mapper 的 fallback 差异保留；route、scope、焦点和权限来源未改变。
- reviewer 对当前四个相关源码/测试 SHA 与作者补充记录一致；未写文件、未运行测试/构建/DEV/UAT。该 verdict 只关闭当前 CP-03 静态差量；D_BROWSER/DEV 菜单实际渲染仍 `NOT_RUN`，继续留在全批动态阶段。
- memory 路由 `domain=testing` 分别配 `owner=frontend-platform` 与 `owner=platform` 均返回 `PROJECT_MEMORY=FAIL / unknown domain`；未将失败解释成无适用规范。platform/admin-ui architecture 与 platform governance 有效路由已读取。

**当前 CP-03 差量状态：`MATCHED`。** 初始一次错误指向 TER T1 文档已明确记录为阅读导航错误，不构成本轮证据；最终 verdict 依据本批正确正本与当前源码。

## 独立 CP 对账

- reviewer 与 verdict：`/root/cp03_reconcile_fresh`，`reviewerKind=INDEPENDENT_SUBAGENT`，`MATCHED`。先盲核当前需求/详设/计划/IA/记忆和源码，后读取作者报告与补证；未写文件、未运行测试。reviewer确认 R-08/§8.4、R-09/§8.4、R-13/§8.6均与当前源码一致，合法同feature引用、remote-control入口及状态fallback保留。历史同期逐点日志仍为 `NOT_RECORDED`，补录不冒称历史证据；现逐点原文回读、focused red/green及独立源码核验已关闭当前 CP 实质对账，该历史记录缺口不阻断退出。动态菜单/焦点仍待全批DEV/Web证明。
- 下一个 CP：仅在本节独立结果为 `MATCHED` 后开始 CP04。
- 全批 6b、DEV 运行、13c 与整批 IMPLEMENTATION review：尚未开始。
