# Claude DESIGN review：商品属性库、点单选项库与两步新建

```text
REVIEW_KIND=IMPLEMENTATION_FACING_DESIGN
REVIEW_TARGET=DESIGN
ADVERSARIAL_REVIEW_REPORT=doc/review/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-design-independent-review-intake-codex.md
RETIRED_CONTROL_NOTE=不提供 DESIGN_GRANULARITY_MANIFEST，也不运行 implementation-design-granularity；该 compliance-control 面已由 AGENTS.md 明确退役。
```

## 背景

本轮将已接受的 Journey 与交互工件传递为 IA、implementation-facing 详设和串行计划。独立子 agent 已完成两轮 DESIGN 对抗审查；第二轮已到治理上限，作者已按来源处置其全部 `CONFIRMED` finding。需要 Claude 作为外部 DESIGN review 复核设计是否仍有模板缺项、层间矛盾或未经裁定的形态。

## 评审目标

独立核验：商品属性/点单选项“定义库事实 vs 商品配置事实”分层；删除级联与 inventory owner 事务；两步新建交互；500 Bounded 行为；复制 hard block；以及 UI 容器、动态数据结构和业务文案是否被无歧义地传递到详设和计划。

## 需阅读文件

- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-formal-requirements-analysis-codex.md`：产品规则、现状冲突与未决项；
- `doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-journey.md`：已接受 Journey 和禁止推导；
- `doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ui-interaction.md`：九屏可见交互、线框、容器布局和 mutation 分母；
- `doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ia.md`：九个 IA-ID、不可见观察、集合和错误语义；
- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-implementation-design.md`：owner/API/operation/transaction/acceptance 详设；
- `doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-serial-plan.md`：获后续授权时的内部串行边界；
- `doc/review/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-design-independent-review-intake-codex.md`：两轮独立盲审与来源级处置；
- `doc/decisions/templates/ui-interaction-design-template.md`、`doc/decisions/templates/ia-design-template.md`、`doc/decisions/templates/implementation-design-template.md`：必填项判据；
- `doc/platform/frontend-coding-standard.md`、`doc/platform/backend-coding-standard.md`、`doc/platform/review-standard.md`：适用规范与 DESIGN action 1-B。

## 独立核验重点

1. 500 是常规约100的五倍源码余量、501 owner typed reject、非分页/非截断，且库定义与单商品 Detail 集合没有混用。
2. 定义层持有组名、值、对客顺序、SINGLE/MULTIPLE、强制原料；商品层只持有 required/min/max/default/加价/实际用量。max=1仍为 MULTIPLE。
3. StockTarget 只在建库保存强制原料时核验；商品侧仅填每份用量。属性定义、整个组选项定义和 definition update 中待删除单值的级联止点及 REQUIRED 事务是否正确。
4. 品牌复制的 closure/rewrite 与同码语义 `BLOCKED` 是否不可确认；不得把目标无 target 的既有 copy plan 误判为 hard block。
5. UI 是否严格 operations-admin 独占；Modal→Drawer 无重叠；点单选项定义的左有序可选项/右当前项扣料原料为单一 Drawer body 主从结构；可见文案无“组件、target、BOM”等技术词。
6. 每个新增或改变 HTTP operation 是否有唯一 operationId/path/face 与非空 identity/fixture/request/businessOracle；且不声称 DEV、L2、HTTP 实跑或 UAT 已完成。

## 期望结论

请按 `doc/platform/review-standard.md` 对 DESIGN 执行 action 1-B，输出：

```text
REVIEW_TARGET=DESIGN
ACTION_1_VARIANT=1-B
VERDICT=GO | GO_WITH_UNVERIFIED_UI | NO-GO
M=<n> S=<n> N=<n>
L1=<...> L2=<...> L3=<...>
SAME_ROOT_SCAN=<...>
DESIGN_GAPS=<...>
EVIDENCE_TIER=<...>
```

每项 finding 请给精确仓根相对路径与行号、影响面、最小修复建议及是否需 Dexter 产品裁决。

## 可直接复制给 Claude 的话术

```text
您好 Claude，烦请协助评审本次“商品属性库、点单选项库与两步新建”的 implementation-facing 设计。

背景：Dexter 已接受本批 Journey 与交互看图结论；随后形成 IA、详设和串行计划。fresh 独立子 agent 已按 DESIGN 完成两轮对抗审查，作者已对 CONFIRMED finding 做来源级处置。现在需要独立确认设计没有模板缺项、跨文档矛盾或未经裁定的实现形态。
目标：请以 DESIGN action 1-B 独立核验定义库与商品配置分层、跨 owner REQUIRED、500/501 Bounded 行为、两步新建、删除级联、品牌复制 hard block、九屏 UI 容器/动态数据结构/业务文案，以及 operation 到 backend-acceptance 的完整映射。

请从 catering-v2s 仓库根阅读：
- doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-formal-requirements-analysis-codex.md：产品规则、冲突与未决项；
- doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-journey.md：已接受 Journey；
- doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ui-interaction.md：九屏交互、线框、容器布局；
- doc/decisions/2026-08-20-v2s-catalog-attribute-and-order-option-library-ia.md：IA 与可证伪观察；
- doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-implementation-design.md：实现边界、operation、事务与验收设计；
- doc/plans/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-serial-plan.md：串行实施路径；
- doc/review/platform/2026-08-20-v2s-catalog-attribute-and-order-option-library-design-independent-review-intake-codex.md：独立盲审与处置；
- doc/decisions/templates/ui-interaction-design-template.md、doc/decisions/templates/ia-design-template.md、doc/decisions/templates/implementation-design-template.md、doc/platform/review-standard.md：模板和 DESIGN 审查判据。

请重点独立核验：500是常规约100的五倍源码余量、501 owner typed reject而非分页；MULTIPLE max=1仍为多选；原材料的可用库存对象门只在建库；属性删除、整个组选项删除、定义整体更新中的待删值三条级联路径止点正确；同码语义复制是不可确认 BLOCKED；点单选项详情不混排不同可选项的原料且全量一次保存；每个 HTTP operation 都有真实 businessOracle。

烦请给出明确 GO、GO_WITH_UNVERIFIED_UI 或 NO-GO。如有问题，请按 M/S/N 标注精确文件与行号、影响面、最小修复建议，以及是否需要 Dexter 产品裁决。请同时输出 REVIEW_TARGET=DESIGN、ACTION_1_VARIANT=1-B、L1/L2/L3、SAME_ROOT_SCAN、DESIGN_GAPS、EVIDENCE_TIER。

授权边界：本次评审只评价设计；不授权生产代码、契约或生成物、数据库迁移、seed、reset、DEV、浏览器 L2、UAT、数据操作或任何仓库控制动作。谢谢。
```
