REVIEW_TARGET=EXPERIENCE_RETROSPECTIVE

reviewerKind=EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE

# 商品库业务、用户 Journey 与 UI 交互优化 · Claude 独立合理性评审请求

## 背景

Dexter 认为当前商品库除目录树总体方式较好外，商品列表、详情、完整编辑、商品配置、各种新建/编辑弹层、复制和治理交互均存在系统性问题。14 个浏览器标注只作为问题样本，不是页面分母；尤其禁止继续用禁用表单冒充详情展示。

Dexter 本轮进一步明确：**只有目录树总体方式这一项历史 UI 裁定继续保留；其余历史页面形态、Drawer/Modal/Page、Tab、布局、控件和交互裁定全部不作为本轮约束，Claude 可按独立分析推翻重做。** 已确认的商品、规格、单位、库存/BOM、属性、点单选项、条码与标识、制作信息等业务语义与 owner 边界仍是业务正本；“忽略历史裁定”不表示可以重写业务模型。

Codex 已形成一份需求分析讨论稿，但本轮不希望 Claude 直接从作者方案开始评审。请先独立重建商品库的业务目标、用户角色、场景、Journey 和最合理交互，再读取 Codex 稿件进行对照，避免被作者的页面结构与结论锚定。

本轮 Claude 是 Dexter 邀请的外部独立评审方，不冒充仓内 `INDEPENDENT_SUBAGENT`，也不占用内部两轮盲审轮次。

## 评审目标

评审分成严格有序的两阶段：

1. **阶段 A：独立分析并冻结基线。** 在不读取 Codex 本轮讨论稿、也不把过往 UI Journey/IA/交互稿当约束的前提下，从 V6 正式业务模型、已确认 V2S 业务规则、V4 参照实现和当前 V2S owning source 独立回答：商品库究竟帮助谁完成什么任务；完整场景和 Journey 是什么；详情、编辑、配置、批量、复制、治理分别应采用什么交互；为什么；哪些事实属于商品、销售集合或库存 owner；V4 哪些只是参照而不能照搬；当前 V2S 的完整 gap 是什么。阶段 A 结束时先写下并冻结 `INDEPENDENT_BASELINE_FROZEN=true`。
2. **阶段 B：对照和综合。** 冻结阶段 A 后才打开 Codex 讨论稿，逐项比较双方的角色、场景、Journey、surface 分母、交互架构、业务语言、contract/owner/UI 分工和防回归判据，给出 `AGREE / IMPROVE / REPLACE / DEXTER_DECISION` 处置，并把 Claude 的独立结论综合成针对 Codex 稿件的具体优化建议。

请判断 Codex 稿件能否作为后续正式 Journey 与交互线框的合理输入，而不是只评论颜色、间距或 Ant Design 控件。

## 需阅读文件

### 阶段 A：先读，禁止先打开 Codex 本轮讨论稿

业务语言和当前已确认的**业务语义边界**（不是历史 UI 形态约束）：

- `project-memory/decisions/confirmed-business-language-corpus.md`：商品、规格、点单选项、制作信息、库存与用料等业务语言及 owner 边界。
- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-formal-requirements-analysis-codex.md`：商品属性库与点单选项库已确认业务规则。
- `doc/plans/platform/2026-08-21-v2s-catalog-unit-model-optimization-requirements-analysis-codex.md`：销售单位、基础计量单位和库存消费单位规则。
- `doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md`：商品类型、粒度与库存扣减/用料方式矩阵。
- `doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-formal-requirements-codex.md`：条码与标识、制作信息的正式业务规则和用户语言。

除目录树总体方式外，请不要把以上专题过去形成的 Journey、UI interaction、IA 中的页面、Tab、Drawer、Modal、控件或布局选择当作已批准约束；它们只能在需要追溯业务来源时作为历史证据。

V6 正式领域与用例，从 `catering-v2s` 仓库根使用以下相对路径：

- `../requirement-doc/design-v6/01.领域设计/05-商品目录域.md`
- `../requirement-doc/design-v6/01.领域设计/06-销售集合与发布域.md`
- `../requirement-doc/design-v6/01.领域设计/07-销售库存与物料扣减域.md`
- `../requirement-doc/design-v6/06.功能用例与用户旅程清单/06-商品销售菜单与渠道发布用例.md`
- `../requirement-doc/design-v6/06.功能用例与用户旅程清单/07-销售库存与物料扣减用例.md`

V4 只读参照实现，不得视为目标模板：

- `../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/CatalogItemDrawer.tsx`
- `../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/CatalogItemDrawerReadonlySections.tsx`
- `../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/CatalogItemDrawerEditableFields.tsx`
- `../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/CatalogItemListTable.tsx`
- `../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/CatalogSkuMatrixTable.tsx`
- `../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/CatalogItemInventoryBomDetail.tsx`
- `../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/CatalogReferenceConfigModal.tsx`
- `../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/ordering-options/OrderingOptionsReadonlyTable.tsx`
- `../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/ordering-options/OrderingOptionsWorkbench.tsx`

当前 V2S owning source：

- `apps/frontend/operations-admin/src/features/catalog-management/ui/`：请自行枚举全部生产 `.tsx/.ts` 文件形成独立 surface 分母，不以 Dexter 的 14 个标注或 Codex 的数量为分母。
- `scripts/generate/catalog-inventory-p1.mjs`：catalog/inventory 契约唯一生成源及当前 shape、grain、字段准入。
- `contracts/openapi/catalog-inventory.openapi.json`：当前生成后 HTTP 契约，用于核对 UI 是否被 contract 迫使绕路；不得把当前契约缺口反推为合理产品规则。
- `libraries/frontend/admin-ui-foundation/src/`：核对已有共享 Drawer、overlay、列表上下文、HTTP、候选和可访问性能力，避免把缺少复用误判成新产品需求。

### 阶段 B：阶段 A 冻结后才读

- `doc/plans/platform/2026-08-23-v2s-catalog-library-ui-interaction-optimization-requirements-analysis-codex.md`：Codex 的 47-work-surface 需求分析讨论稿、推荐交互架构、方案比较和防再犯判据。

## 独立核验重点

### 阶段 A 必须先独立产出的内容

1. 角色和任务：总部商品资料维护者、门店商品资料维护者、库存维护者、只读运营人员是否完整；是否还有真实角色或任务被遗漏。
2. 场景全集：查找、比较、查看、新建、完整编辑、配置复用定义、批量整理、品牌导入、本库复制、生命周期/临时商品治理及失败恢复是否穷尽；请主动找反例。
3. Journey：每个场景的触发、前提、步骤、成功结果、失败后仍成立事实、离开/返回位置和跨 owner 边界。
4. 最优交互：不要照搬 V4，也不要被当前 V2S Drawer/Modal 限制；至少比较列表/卡片/树表、详情页/Drawer、编辑 Drawer/全屏 Modal/独立工作区、统一 Modal/分散页面/统一配置页等可行方案，并说明选择理由和放弃理由。
5. 信息架构：什么应在列表比较，什么应在纯只读详情，什么必须进入编辑，什么应成为独立长期管理入口；简单字典、父子字典和复杂定义是否应使用不同形态。
6. 业务边界：商品启用不得推导发布/可售；库存摘要不得推导菜单；总部模板不得推导门店自动继承；制作信息不得推导打印/KDS 配置。
7. 用户语言：界面应使用运营人员理解的业务语言，不泄漏 UUID、内部枚举、owner/ref/readback/problem code 等技术词；同时识别真正属于业务的“商品编码、规格编码、BOM”等反例边界。
8. 完整源码 gap：覆盖当前 V2S 所有用户可达 surface，包括截图未点名的媒体、分类动作、批量结果、候选选择、规格子任务、复制、治理和各种确认面；每个问题都做同根扫描。
9. 历史裁定边界：目录树总体方式是唯一保留的历史 UI 方向；其它旧 UI 选择不得成为“只能小改”的理由，也不得因与旧 IA/interaction 不一致而判错。

### 阶段 B 对 Codex 稿件的综合评审

1. Codex 的用户任务和 Journey 是否与阶段 A 独立基线一致；不一致时哪一方更合理，为什么。
2. Codex 的 surface 分母是否真正穷尽 current tree；请独立重算，不能采信“47”。
3. “目录树 + 结果表、详情 Drawer、独立完整编辑工作区、独立商品配置页面、按复杂度选 Modal/Drawer/Page”是否分别是最小、可靠、方便的方案；是否存在更优或更小替代。
4. “禁用表单不得冒充详情”是否覆盖只读权限、业务锁定、查看库存/用料、简单字典和复杂定义；反例边界是否清楚。
5. 列表列、详情信息层级、动作层级、空态、控件尺寸、表单宽度、滚动、焦点归还、键盘路径、草稿/错误/未知结果恢复是否足以形成一致体验。
6. contract、owner 与 UI 分工是否正确：contract 声明结构/准入/可定位问题，owner 在真实事实下复核，UI 负责用户任务和即时反馈；是否仍有 UI 猜规则或 contract 泄漏技术模型。
7. 16 条防回归判据是否可证伪，是否遗漏真实浏览器行为或把低层测试冒充用户验证。
8. 对每项差异标注 `AGREE / IMPROVE / REPLACE / DEXTER_DECISION`，提供业务影响、适用范围、反例和最小文本修订建议；不要直接修改需求或代码。
9. Codex 稿中凡以“既有 Dexter UI 裁定”为约束的段落，均按本轮新指令重判；特别是统一六 Tab Modal、完整编辑 Drawer 等历史承载面不再享有保留推定。

本轮只做只读分析与评审，不执行编译、测试、DEV、reset、seed、browser L2、UAT、部署或任何数据操作。

## 期望结论

请在评审件中完整保留阶段 A 的独立基线与 `INDEPENDENT_BASELINE_FROZEN=true`，再给出阶段 B 的对照矩阵和综合建议。最终给出明确 `GO` 或 `NO-GO`，汇总 `M/S/N`。

每项 finding 请给仓根相对路径与精确行号、证据链、用户/业务影响、同根分母、反例边界、最小修订建议和是否需要 Dexter 产品裁决。`GO` 只表示讨论稿适合继续收敛 Journey 与低保真线框；`NO-GO` 表示需先修订讨论稿。两者都不授权实施。

建议评审输出：`doc/review/platform/2026-08-23-v2s-catalog-library-ui-experience-reasonableness-review-claude.md`。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请对本轮“商品库业务、用户 Journey 与 UI 交互优化”做一次两阶段独立合理性评审。

背景：Dexter 认为当前商品库除目录树总体方式较好外，商品列表、详情、完整编辑、商品配置、各种新建/编辑弹层、复制和治理交互均存在系统性问题。14 个浏览器标注只是问题样本，不是页面分母；尤其禁止继续用禁用表单冒充详情。Dexter 本轮明确：只保留“目录树总体方式较好”这一项历史 UI 裁定；其它历史页面形态、Drawer/Modal/Page、Tab、布局、控件和交互裁定全部忽略，可以推翻重做。已确认的商品、规格、单位、库存/BOM、属性、点单选项、条码与标识、制作信息等业务语义和 owner 边界仍是业务正本，不在忽略范围。Codex 已形成需求分析讨论稿，但请不要先读作者方案。本轮你的身份是 EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE，不冒充仓内独立子 agent，也不占用内部两轮盲审轮次。

目标：请先从业务正本和 owning source 独立重建商品库的业务目标、角色、完整用户场景、Journey 与最优交互，冻结你的独立基线；之后才打开 Codex 稿件进行对照，综合双方结果，给出针对 Codex 分析设计的优化建议和合理性结论。

请严格按以下顺序执行。

阶段 A：不要读取 doc/plans/platform/2026-08-23-v2s-catalog-library-ui-interaction-optimization-requirements-analysis-codex.md，也不要把此前专题的 Journey、UI interaction 或 IA 页面形态当作约束。先从 catering-v2s 仓库根阅读：
- project-memory/decisions/confirmed-business-language-corpus.md
- doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-formal-requirements-analysis-codex.md
- doc/plans/platform/2026-08-21-v2s-catalog-unit-model-optimization-requirements-analysis-codex.md
- doc/plans/platform/2026-08-22-v2s-catalog-inventory-bom-business-model-requirements-discussion-codex.md
- doc/plans/platform/2026-08-23-v2s-catalog-identification-production-guidance-formal-requirements-codex.md
- ../requirement-doc/design-v6/01.领域设计/05-商品目录域.md
- ../requirement-doc/design-v6/01.领域设计/06-销售集合与发布域.md
- ../requirement-doc/design-v6/01.领域设计/07-销售库存与物料扣减域.md
- ../requirement-doc/design-v6/06.功能用例与用户旅程清单/06-商品销售菜单与渠道发布用例.md
- ../requirement-doc/design-v6/06.功能用例与用户旅程清单/07-销售库存与物料扣减用例.md

V4 只作为参照，请重开 ../catering-server-v4/frontend/apps/catering-operations-admin/src/resources/catalog-items/components/ 下的 CatalogItemDrawer、ReadonlySections、EditableFields、CatalogItemListTable、CatalogSkuMatrixTable、CatalogItemInventoryBomDetail、CatalogReferenceConfigModal，以及 ordering-options 下的 ReadonlyTable 与 Workbench；不要把 V4 页面形态当答案。

同时请自行枚举并阅读 apps/frontend/operations-admin/src/features/catalog-management/ui/ 下全部生产 TSX/TS，以及 scripts/generate/catalog-inventory-p1.mjs、contracts/openapi/catalog-inventory.openapi.json 和 libraries/frontend/admin-ui-foundation/src/。不要采信 Dexter 的 14 个标注或 Codex 的 surface 数字作为分母；请从 current tree 独立重算。

阶段 A 请先输出并冻结：角色与真实任务、完整场景、逐场景 Journey、成功/失败后事实、跨 owner 禁推、最优信息架构和交互方案、替代方案比较、V4 可取与不可取部分、当前 V2S 全量 gap。请明确写出 INDEPENDENT_BASELINE_FROZEN=true。

阶段 B：只有阶段 A 冻结后，才阅读 doc/plans/platform/2026-08-23-v2s-catalog-library-ui-interaction-optimization-requirements-analysis-codex.md。逐项比较双方的角色、场景、Journey、surface 分母、交互架构、业务语言、contract/owner/UI 分工和防回归判据，并用 AGREE / IMPROVE / REPLACE / DEXTER_DECISION 标注差异。

Codex 稿中提到的“既有 Dexter UI 裁定”不再构成本轮保留理由；除目录树外全部按你的独立基线重新判断，尤其不要因为过去选过六 Tab Modal 或完整编辑 Drawer 就默认继续沿用。

请重点判断：目录树+结果表、纯只读详情 Drawer、独立完整编辑工作区、独立商品配置页面，以及简单字典/父子字典/复杂定义采用不同交互形态，是否真是当前最小且最优的方案；是否存在更方便、更直观、更一致的替代。还请完整核验列表比较、空态、动作层级、控件与表单尺寸、弹层层级、唯一滚动、焦点归还、键盘路径、草稿与错误恢复，以及“禁用表单不得冒充详情”的有限适用全集。

烦请输出到 doc/review/platform/2026-08-23-v2s-catalog-library-ui-experience-reasonableness-review-claude.md，并给出明确 GO 或 NO-GO，汇总 M/S/N。每项 finding 请标注仓根相对路径与精确行号、证据链、用户/业务影响、同根分母、反例边界、最小修订建议，以及是否需要 Dexter 产品裁决。请保留阶段 A 原始独立结论，不要在看到 Codex 稿件后回写或美化它。

授权边界：本轮只授权只读业务、Journey、用户场景与体验合理性评审。GO 只表示讨论稿适合继续收敛正式 Journey 和低保真线框；不等于 Dexter 接受产品方案，也不授权需求改写、IA、implementation-facing design、契约/代码修改、测试、DEV、reset、seed、browser L2、UAT、部署或数据操作。NO-GO 和 findings 也只是待 Dexter/Codex 逐条复核的独立输入，不自动改写正式业务规则。谢谢。
```

## 授权边界

本轮 Claude 只执行只读业务、Journey、用户场景与 UI 体验合理性评审。`GO` 只代表讨论稿可进入 Dexter 的需求收敛与线框讨论，不授权任何实施或动态动作；Claude findings 是待验证输入，不能自动改写 Dexter 已确认的业务规则。
