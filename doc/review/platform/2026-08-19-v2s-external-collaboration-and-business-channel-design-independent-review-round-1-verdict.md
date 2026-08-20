REVIEW_CYCLE_ID=EXTERNAL_COLLABORATION_DESIGN_2026_08_19
REVIEW_TARGET=DESIGN
REVIEW_ROUND=1
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
reviewerInputChecklist=doc/review/platform/2026-08-19-v2s-external-collaboration-and-business-channel-design-review-round-1-input-checklist.md
blindReviewDeclaration=HONORED

# Fresh independent design review — Round 1

本轮 reviewer 未修改文件，未执行生产代码、契约生成、migration、seed、reset、DEV、L2、UAT、外部联调或 Git，未派生子 agent。独立 expected behavior/attack model 在读取作者设计前冻结，未以作者处置、Codex intake、Claude review 或 handoff 替代独立判断。

## Independent expected behavior

- `collaboration` 拥有 external system/provider/binding 事实；`business-channel` 拥有 template/channel 事实，只能单向读取 collaboration。
- 跨域写由 edge 在同一 `REQUIRED` 事务内显式编排两个 owner command；派生置灰不落 binding，不新增 cascade command。
- exact literals 是 `GROUP_BUY`、`TAKEAWAY`、`INVENTORY_SYNC`、`TAKEAWAY_DELIVERY`、`LOCAL_ONLY`、`COMMERCIAL_GROUP`。
- `catalogStatus=PLANNED` 仅为信息态；contract 存在且 workspace enablement 开启即可启用/进入运营候选。
- C-01/02/03/04/08/09 保持依赖态；`EXTERNAL_GRANT` 创建允许空 `externalOwnerId`。
- platform-admin 页面 URL 不携带 group key，由 WorkspaceScope 提供上下文；operations 写仅有项目渠道编辑、门店渠道编辑两个 capability。
- 11 screens 为 P1-P6/O1-O5；双 app、单一 `x-consumer-faces`、foundation reuse、OpenAPI→generated→consumer 闭环必须保持。
- acceptance 为 44 + 14 = 58；`collaboration.catalog-readback` 必须是真实 platform tree/detail HTTP read，并归属 Collaboration domain。
- seed 只审查 plan/executor 边界，覆盖五类 node、万象城海底捞一店三渠道三绑定、POS/QR/KIOSK，business/cleanup 分离。

## Input integrity

清单共核验 56 项：54 项原始 PASS，Round 1 发现两项清单旧 hash，分别是：

- `doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md`：清单旧值 `ded25e2a...`，实际 `a0adbccdcc4973d7733323220ae5a20657abc97ba8366f5faec3ed16bc7438c3`；
- `doc/review/platform/2026-08-18-v2s-external-platform-capability-and-binding-decoupling-source-claude.md`：清单旧值 `befa1bb1...`，实际 `499eed365ffe591dc390746e09a52c13ebe2a35776d86e4825815b8467983ca7`。

清单还将 11 个 IA screen 写成十个，并把 active acceptance source group 叙述为旧的五类。

## Findings

### F-M-001 — descriptor 字段漂移

`CONFIRMED · M`。规格要求 `fieldKey/label/helpText/controlKind/optionSourceRef`，详设以 `value` 代替 `optionSourceRef`，且放宽 readonly kind；foundation 的 renderer value 是独立运行时输入。反例是 provider option source 缺失或 readonly descriptor 被当作 editable primitive。最小修复是恢复五字段 descriptor，把 read value 独立放入 capability `attributeValues`，并加入 option-source/readonly red fixture。

### F-M-002 — provider profile 漏 `catalogStatus`

`CONFIRMED · M`。规格 §5.4 要求 provider profile 有 `catalogStatus`，详设 provider shape 没有，但 readback 又要求 provider 状态。反例是 system AVAILABLE/provider PLANNED 时无法区分两级状态。最小修复是补 provider contract/read model/readback 字段，E-33 同时断言 system/provider，仍不得作为 gate。

### F-M-003 — owner command 字面量冲突与禁止的 cascade command

`CONFIRMED · M`。详设声明不提供 `markBindingsCascadeDisabled`，却列 `cascadeDisableByExternalReference`；事务矩阵还引用未声明的 `markBindingDeleted`/`disableEnablement`。最小修复是删除 cascade command，统一使用已声明的 collaboration status/request-or-delete command，并由 edge 调用明确的 business-channel owner transition；不冻结 C-01。

### F-S-001 — seed plan 未接入受管 executor

`CONFIRMED · S`。现有完整 seed runner 的阶段为 `[owner-command,catalog-inventory]`，详设只有本域 plan，没有 executor、stage、父子 manifest/report。反例是 plan 永远不被 `r5-full` 执行或绕过 managed receipt。最小修复是把本域作为受管 stage 接入既有 complete runner，明确输入输出、managedDevRunId、business/cleanup/first-failure 汇总；本轮不执行 seed。

### F-S-002 — operations auth/source mapping 粒度不足

`UNVERIFIED_REQUIRES_EVIDENCE · S`（设计缺口本身确认，运行行为留待实施证据）。详设只有聚合 operation 表，未逐 operation 冻结 OpenAPI source、face、authorization requirement、resolver、owner recheck、typed problem、red fixture、context/version；generator 要求这些字段，现行 key pattern 也不接受 `BC_PROJECT_EDIT`/`BC_STORE_EDIT`。最小修复是逐 operation source-of-truth 表，沿用 `BC-*`/`EDIT_*` 形态，补 server-minted `expectedContextVersion`，实施期用生成物/static proof 验证。

### F-N-001 — serial plan 残留 Catalog domain

`PARTIALLY_CONFIRMED · N`。CP-08 仍把 contract validation 写为 `CatalogAcceptanceScenarios.java`，与详设已修复的 N-1 冲突。最小修复是改为 CP-01 contract validator，两个新增 domain 文件只承接 14 条真实 HTTP business scenarios。

### F-N-002 — typed problem 总数表达为 16

`CONFIRMED · N`。15 个 code 已含 `VERSION_CONFLICT`，IA 完成行写 `15 + VERSION_CONFLICT mapped`。最小修复是改为 `15 total, including VERSION_CONFLICT`。

### F-N-003 — review input hash/screen/source-group 漂移

`CONFIRMED · N`。清单两个 hash 与当前 bytes 不同，screen 写十个而实际为 11 个；active standard 写五类而 catalog 已有七类。最小修复是刷新 hash、改 11 screen，并同步 standard 到当前七类加本批两个新 domain group。

## Explicit no-finding set

exact literals、G-10 platform URL、E-33 PLANNED semantics、六项 C 与 nullable `EXTERNAL_GRANT`、34 BR/BR-33 空号、11 screens/九维 IA、双 app/face、platform 无 capability、operations 两个写 capability、foundation reuse、44+14=58、无 provider shell/shared SPI/退役 registry、真实 catalog-readback 方向、敏感字段/CAS/logging/cleanup 均无独立 finding。未运行动态证据，不虚构 runtime PASS。

## Verdict

`GO/NO-GO=NO-GO`

`M=3 · S=2 · N=3`

`ROUND_2=REQUIRED`。Round 2 只定向核验上述 8 条修复；Round 2 后硬停止，不得以换 reviewer、文件名或局部措辞重置轮次。
