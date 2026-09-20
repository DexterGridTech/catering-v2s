---
title: v2s 受管浏览器 L2 全量脚本静态对账
status: STATIC_RECONCILIATION_PASS
reviewTarget: IMPLEMENTATION
reviewer: Codex
date: 2026-09-19
---

# 1. 结论

本记录是进入动态 L2 前的完整静态对账，不是动态验收。

```text
REVIEW_TARGET=IMPLEMENTATION
ACTION_1_VARIANT=1-A
L2_SCRIPT_ADMISSION=PASS
M/S/N=0/0/0
L1_ENGINEERING=STATIC_READY
L2_USER_VISIBLE=NOT_RUN
L3_UNVERIFIED=动态 L2 未运行
SAME_ROOT_SCAN=已覆盖 registry 当前 22 个 carry-over ID、2 个显式业务 surface 与仓内 21 个 L2 spec
DESIGN_GAPS=动态 L2 仍未运行；其余 registry surface 不因两个 managed suite 的动态结果而自动声称通过
EVIDENCE_TIER=静态源码与契约对账；未升级为运行证据
```

当前静态准入已在逐项控件、binding、读取事实和执行入口闭合后通过。两个已经具备 runner 配置的套件可以进入同一受管动态链，但不得用它们替代 registry 的全量分母。

# 2. 读取的正本与执行边界

- `AGENTS.md`、`doc/platform/browser-l2-execution-standard.md`、`doc/platform/frontend-coding-standard.md`。
- `contracts/policy/affected-l2-registry.json`：schemaVersion 4，`fallback=ALL_R5_L2`，当前声明 22 个 carry-over ID，并显式纳入 catalog/inventory 与 sales-menu 两个业务 surface。
- `scripts/test/browser-l2-runtime.mjs`：当前 `L2_SUITE_CONFIGS` 只有 `catalog-inventory` 与 `sales-menu`，第 93 至 140 行；命令入口只接受这两个 suite，见第 8410 至 8439 行。
- `contracts/policy/catalog-inventory-l2-execution.json` 与 `contracts/policy/sales-menu-l2-execution.json`：两者当前均为 `FRAMEWORK_ONLY`、`enabledCaseIds=[]`，不是动态 PASS。
- `contracts/policy/catalog-inventory-l2-locator-bindings.json`、对应 case/scenario/fixture、两个 app 的 L2 spec、真实 feature UI 与 `*TestIds.ts`。
- `apps/frontend/operations-admin/src/tests/l2/catalog-inventory-network.ts` 与其 Vitest 正反例，作为 catalog 负向网络闭包的可执行纯逻辑边界。

按执行标准第 71 至 94 行，动态 L2 前必须完成 UI 设计对账、实际动作控件分母、真实动作节点的 testId 绑定、focused/static proof 与准入复核；运行结果不能替代这些前置门。

# 3. 全量 spec 分母与 locator 对账

下表由当前字节直接扫描得到。`nonTest` 是 role、label、text、locator、nth、first 的调用总和；它不是说所有读取断言都错误，而是标出需要逐调用判断是否属于用户动作、真实读取或可接受的组件适配器。

| app              | spec                         | testId | role | label | text | locator | nth | first | nonTest |
| ---------------- | ---------------------------- | -----: | ---: | ----: | ---: | ------: | --: | ----: | ------: |
| operations-admin | access-recovery              |     22 |    0 |     0 |    0 |       0 |   0 |     0 |       0 |
| operations-admin | authentication               |     23 |    1 |     3 |    1 |       0 |   0 |     0 |       5 |
| operations-admin | business-entity-management   |     18 |    4 |     0 |    4 |       3 |   0 |     3 |      14 |
| operations-admin | catalog-inventory            |     60 |    7 |     0 |    5 |       6 |   0 |     1 |      19 |
| operations-admin | contract-management          |     22 |    4 |     0 |    1 |      12 |   0 |     0 |      17 |
| operations-admin | invitation-acceptance        |     15 |    0 |     0 |    0 |       0 |   0 |     0 |       0 |
| operations-admin | organization-hierarchy       |     17 |    5 |     0 |    4 |       2 |   0 |     2 |      13 |
| operations-admin | sales-menu                   |     40 |    9 |     0 |    2 |       3 |   0 |     0 |      14 |
| operations-admin | store-management             |     17 |    2 |     0 |    3 |       1 |   0 |     0 |       6 |
| operations-admin | store-profile                |     16 |    3 |     0 |    4 |       0 |   0 |     0 |       7 |
| operations-admin | user-management              |     26 |    4 |     0 |    1 |       2 |   0 |     1 |       8 |
| operations-admin | work-context                 |     13 |    1 |     0 |    7 |       0 |   0 |     0 |       8 |
| platform-admin   | authentication               |      1 |    2 |     0 |    0 |       0 |   0 |     0 |       2 |
| platform-admin   | contract-overview            |     10 |    3 |     1 |    3 |       4 |   0 |     0 |      11 |
| platform-admin   | extension-field-management   |      7 |    2 |     0 |    3 |       0 |   0 |     0 |       5 |
| platform-admin   | organization-overview        |     10 |    2 |     1 |    7 |       0 |   0 |     0 |      10 |
| platform-admin   | platform-admin-management    |      7 |    1 |     0 |    2 |       0 |   0 |     0 |       3 |
| platform-admin   | role-management              |     10 |    7 |     0 |    2 |       5 |   0 |     0 |      14 |
| platform-admin   | workspace-account-management |     19 |   11 |     0 |    2 |       2 |   0 |     1 |      16 |
| platform-admin   | workspace-management         |     11 |    1 |     2 |    5 |       0 |   0 |     0 |       8 |
| platform-admin   | workspace-overview           |      0 |    1 |     0 |    2 |       1 |   0 |     0 |       4 |

仓内共 21 个 spec；registry 已把 catalog/inventory 与 sales-menu 作为显式业务 surface 纳入，并保留其余 carry-over 分母。registry 机械闭集不等于每个 suite 都有当前 managed runner 的动态执行能力，动态交接仍按实际 suite evidence 分账。

# 4. 已确认阻断

## M-01（已修复待复核）：registry 全量分母与 managed runner 不闭合

类型：仓内事实。

证据：`contracts/policy/affected-l2-registry.json:4-5` 声明 `ALL_R5_L2` 与 20 个前端测试 surface；`scripts/test/browser-l2-runtime.mjs:93-140` 只有 `catalog-inventory` 与 `sales-menu` 两个 suite；`scripts/test/browser-l2-runtime.mjs:8410-8439` 的 CLI 也只接受这两个 suite。两个 execution profile 当前均为 `FRAMEWORK_ONLY` 且 `enabledCaseIds=[]`。

当前处置：registry 已补入 operations catalog/inventory 的 inventory path，并新增独立 sales-menu surface 与对应 contract/test paths；动态执行范围仍只由 runner 实际支持的 suite 决定。

最小修复：要么在同一受管链中为剩余 registry 分母补齐各自 suite 配置、生成源、fixture、binding、readiness、run 与 cleanup；要么由 Dexter 明确收窄 registry 分母并同步 `affected-l2-registry.json`、计划和交接口径。不能只改状态或把 2 个套件的 PASS 复制到 20 个套件，因为那不会产生缺失套件的用户行为证据。

Dexter 裁决：若选择收窄或延期全量分母，需要；若补齐既有授权内 runner 能力，不需要新的产品裁决，但仍需保持当前 L2 动态授权边界。

## M-02（保留为全量分母风险，未宣称已闭）：旧套件存在 raw locator，无法满足 L2 动作准入

类型：仓内事实，影响范围由静态扫描发现，具体每个调用点仍需按“动作/读取/组件适配器”分桶。

证据：`apps/frontend/platform-admin/src/tests/l2/workspace-overview.spec.ts:11-14` 使用 `.locator('.platform-tab-body')`、`getByText` 与 role button；`apps/frontend/platform-admin/src/tests/l2/workspace-account-management.spec.ts` 多处使用 role、菜单、分页与文本；`apps/frontend/operations-admin/src/tests/l2/business-entity-management.spec.ts:34,47-50,60,68,141,150` 使用 role、locator、text；contract、hierarchy、stores、store-profile、users、work-context 也存在同类调用。完整数量见第 3 节。

影响：行动控件可能随文案、AntD DOM、分页结构或顺序变化而漂移，且无法证明 testId 绑定到了真实动作节点。按 `doc/platform/browser-l2-execution-standard.md:78-94`，这些调用在对应控件未完成 testId 与节点对账前不能进入动态 L2。

最小修复：只改用户动作与 L2 读取事实确实需要稳定身份的调用，使用 app `*TestIds.ts` 唯一常量并绑定真实动作节点；对纯文本业务 oracle、已限定范围的 AntD 虚拟列表适配器保留并在分母记录理由。不能全局机械替换所有 `getByText`，因为那会把业务 oracle 和动作控件混为一谈并制造过度设计。

Dexter 裁决：不需要产品裁决；若要把 legacy registry 的范围改成仅当前支持套件，需要。

## M-03（已修复待复核）：当前 catalog/inventory 支持套件仍有动作节点未绑定

类型：仓内事实。

已确认的具体点：

- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogItemListTable.tsx:115-119` 把选择 testId 放在包裹 Checkbox 的 `span`，`apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts:1448-1457` 再用 wrapper 内 `getByRole('checkbox')` 才能动作；该绑定没有落到实际 Checkbox 节点。
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchToolbar.tsx:53-60` 只给 Segmented 外层绑定，`catalogTestIdControls.workbench.viewTree/viewTable` 尚未挂到实际 option；`catalog-inventory.spec.ts:1823` 仍使用 wrapper 内 role radio。
- `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryManagementPage.tsx:318-328` 只给库存 Segmented 外层绑定，`catalog-inventory.spec.ts:2036-2039` 仍按 radio 名称点击。
- `apps/frontend/operations-admin/src/features/inventory-management/ui/InventoryActionModal.tsx:535-543` 只给 Radio.Group 外层绑定，`catalog-inventory.spec.ts:1750-1752` 仍按 radio 名称点击。
- `apps/frontend/operations-admin/src/features/catalog-management/ui/CatalogWorkbenchContent.tsx:45-55` 的 scope forbidden 重试按钮没有自己的 testId，`catalog-inventory.spec.ts:2189-2195` 仍按 role/name 点击。

影响：当前支持套件的 `binding` 与实际 action node 不一致；即便动态执行成功，也可能只是依赖 AntD 内部结构，不能满足真实控件准入。

最小修复：在既有 app testId 源中为可标记的 Button、Checkbox、Radio option 增加直接 ID；对 AntD Segmented 仅使用规范允许的 `COMPOSITE_OPTION_ANCHOR`，把 ID 放到可见 option label 并证明点击 label 改变同一 option 值；同步 binding、spec、focused/static proof 与生成器 red mutation。不能只把 spec 改成更宽的 locator，因为那会掩盖 UI 与 L2 的真实绑定偏差。

当前处置：商品选择、view/inventory option、direction、retry、scope composite、Tabs 选中态与销售菜单 native input 已完成真实节点对接；generator、P1 validate-only CLI、focused/static proof 均已同步。

Dexter 裁决：不需要产品裁决。

## S-01（已修复待复核）：binding schema 仍保留 role-within-testId 旧口径

类型：仓内事实。

证据：`contracts/policy/catalog-inventory-l2-locator-bindings.json:1` 的 `locatorKind` 仍是 `PLAYWRIGHT_TEST_ID_OR_ROLE_WITHIN_TEST_ID`，而 `scripts/generate/catalog-inventory-p1.mjs:198-199` 已将 role/name/parent fallback 作为禁止项。当前文档和生成器口径不一致。

影响：读者会误以为 wrapper 内 role 是正常协议，无法判断哪些 composite option 是规范例外，哪些是绕过真实动作节点。

最小修复：把 binding 协议改为 testId/明确的 composite option anchor 两种受控形态，并为 composite 行显式写 `COMPOSITE_OPTION_ANCHOR` 与 focused/static proof；不要恢复通用 role fallback。

当前处置：binding 的 action-node 约束已收窄为 testId 或受控 composite option；scope 绑定显式列出实际触达阶段、固定控件 ID 与动态 option 工厂，Tabs 显式声明可见 label anchor 和 focused static proof。

Dexter 裁决：不需要产品裁决。

# 5. 支持套件的真实读取事实对账

## catalog-inventory

当前生成链的事实源是 `contracts/policy/catalog-inventory-l2-case-blueprint.json`、`catalog-inventory-l2-scenarios.json`、`catalog-inventory-l2-locator-bindings.json` 与 `apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts`。spec 的 owner/readback 读取来自真实 generated operation response，并按 case 记录 owner facts、readback、失败恢复和 action touch；不能把这些 JSON 存在性当成动态 PASS。

已对账的 action/control 族包括：catalog route/tree/search、商品行选择与打开、Drawer tabs、批量动作、媒体动作、库存 route/stock view、库存详情 zones、库存 action modal、方向/数量/单位/原因/备注、失败 surface retry、scope trigger/selector/option/confirm/cancel 触达与 owner readback。第 4 节 M-03 的动作节点已修复，并经 fresh reviewer 复核通过。

## sales-menu

`apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts` 当前主要控件已有 `salesMenuTestIds.ts` 绑定；fill/check 已记录真实 native input/radio/checkbox 节点，channel popup 的虚拟列表适配限定在 `sales-menu-channel-popup` 与 AntD `.rc-virtual-list-holder` 内。该适配器不是普通业务控件的 raw locator 例外，scope 分母、网络闭包与生成物已经 fresh reviewer 复核通过。

# 6. 当前修复后的静态状态

主 agent 已对支持套件完成一轮最小修复，fresh 独立 verifier Schrodinger 已按当前字节定向复核通过（REVIEW_TARGET=IMPLEMENTATION，VERDICT=GO，M/S/N=0/0/0，EVIDENCE_TIER=STATIC_CURRENT_BYTES_ONLY）：

- catalog 商品选择的业务身份 ID 直接落在 Checkbox action node；
- catalog view switch 的两个 option 使用 `catalogTestIdControls.workbench.viewTree/viewTable` 作为可见 label anchor，并有 `data-active` selected-state focused proof；
- catalog scope-forbidden retry 使用既有 `catalogTestIds.control.workbenchRetry`；
- inventory stock view 与 adjustment direction 使用 `inventoryTestIds.ts` 的 option factory；
- binding 协议从通用 `ROLE_WITHIN_TEST_ID` 收窄为 testId 或受控 composite option anchor，并由 generator 与实际 `tools/catalog-inventory-p1/cli.mjs` 同时校验 option factory、scope touch phases、Tabs action node 和 focused proof。
- catalog scope helper 已把 `OperationsDataScopeTouch` 的真实 testId 逐事件写入 join；scope binding 与 `DataScopeSelector` 的固定/动态控件身份逐项相符。
- catalog 的 required/forbidden/background/request-budget 网络闭包已与生成器同源：`catalog-governance-failure` 唯一消费 `transitionOperationsCatalogItemStatus` 的 forbidden 声明；其余 active case 的 required 均有 request budget，且 generated operation identity 完整存在。
- catalog 的网络闭包已抽为 `catalog-inventory-network.ts`，Vitest 覆盖 required success、forbidden observed、expected-failure status missing 与 unexpected non-success 四个边界；生成器另有 forbidden 声明缺失 red mutation。
- sales scope 分母已按门店范围 8 个、项目范围 6 个控件冻结；`scripts/generate/sales-menu-p1.mjs` 对缺项 fail closed，生成 scenarios 与运行时 touch closure 逐 case 一致。
- sales 的网络闭包已抽为 `sales-menu-network.ts`，并由 `sales-menu.spec.ts` 消费；Vitest 覆盖 forbidden、expected-failure status、unexpected non-success 与 request-budget red mutation。
- 当前只读 reconciliation 汇总为：catalog 65 cases/24 active/117 controls、sales-menu 20 cases/20 active/94 controls；两套 active case 的 source/proof 路径、operation identity、required-to-budget 覆盖与 forbidden overlap 均无误报。sales blueprint 与 generated scenarios 的 controlKeys mismatch 为 0。
- P1 fixture schema 已补齐 seed source 使用的 `standardSalePriceCents`；P1 generator self-test 的 owner admission source 已指向实际 `CatalogItemService`。

当前静态验证：

- catalog P1 `--write --check` PASS，P1 validate-only 与 self-test 均 PASS，`OPERATIONS=58`、`API_SCENARIOS=26/99`、`L2_SCENARIOS=26/65`、`IA_IDS=89`；
- browser L2 runtime self-test（catalog）PASS，sales-menu self-test PASS；
- `node --test scripts/test/l2-locator-bindings.static.test.mjs scripts/test/browser-l2-runtime.test.mjs` 84/84 PASS；
- `yarn vitest run src/tests/l2/catalog-inventory-network.test.ts` 4/4 PASS；
- operations architecture 44 PASS、4 TODO、0 fail；platform architecture 18 PASS、1 TODO、0 fail；
- operations-admin 与 platform-admin typecheck、catalog Tabs focused/static test、相关 catalog/sales static checks 均退出 0；
- `scripts/check/affected-l2` PASS；它证明 registry 机械闭集，不替代两个 managed suite 的动态 evidence，也不证明未配置 runner 的其余 surface 已执行。
- `node scripts/generate/catalog-inventory-p1.mjs --self-test`、catalog L2 runtime self-test、sales-menu L2 fixture self-test、相关格式检查均 PASS。
- `node scripts/generate/sales-menu-p1.mjs --self-test`、scope exact-set 对账、`scripts/check/affected-l2` 均 PASS；sales network Vitest 为 5/5，catalog/network 合计为 9/9。

以上静态结果已由 fresh 独立 verifier 复核通过；它不包含 DEV、远端或 Browser L2 运行证据，`L2_USER_VISIBLE` 仍为 `NOT_RUN`。

# 7. 动态状态

本记录写入时没有启动 Browser L2；没有 readiness、finalize、run 或 cleanup 证据。动态状态统一为 `NOT_RUN`，不是 PASS/FAIL。DEV 当前保持既有受管运行状态，未被本记录擅自停止或重启。

后续进入动态 L2 的必要顺序仍是：

1. 保留已完成的 IA/交互/源码逐控件对账记录。
2. 保留已完成的真实动作节点、binding、focused/static proof 与生成物复核。
3. 静态准入已由 fresh 独立只读复核确认 `UI_DESIGN_REVIEW=PASS`、`TESTID_REVIEW=PASS`、`L2_SCRIPT_ADMISSION=PASS`。
4. 对每个已批准 suite 执行同一受管链的 readiness → same-run activation → generated-chain exact check → finalize → run → cleanup，并分开报告 business 与 cleanup。
5. registry 其余分母在没有同等 runner 与证据前保持 OPEN，不得在交接中隐去。
