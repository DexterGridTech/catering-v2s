# 商品库工作台四轴设计复审：作者辩证 intake

```text
STATUS=SELF_DECIDED_READY_FOR_DEXTER_CLAUDE_DESIGN_REVIEW
REVIEW_CYCLE_ID=CATALOG_LIBRARY_WORKBENCH_DESIGN_AMENDMENT_20260823
REVIEW_TARGET=DESIGN
AUTHOR=CODEX
BUSINESS_RESULT=PASS_DESIGN_AMENDMENT_ONLY
CLEANUP=NOT_APPLICABLE_STATIC_ONLY
RUNTIME_ACTIONS=NONE
```

Round 1 独立 review 的 `M-001` 已确认：原设计缺 browser L2 secret 注入合同。现已在 formal §9.3/验收 35、
implementation design §11c.5 和 serial plan CP-10/12 补齐。Round 2 独立复验确认主体关闭，留下 `S-001`：
`L2_SECRET_FORMAT_INVALID` 与 `L2_SECRET_STALE` 缺独立红变异。作者已按 reviewer 最小修复逐项补齐；两轮上限已到，
不召集第三轮，最终处置为 `SELF_DECIDED_CONFIRMED_AND_FIXED`，不改写 Round 2 的原始 `NO-GO M/S/N=0/1/0`。

## 1. 本轮范围与证据边界

本轮只复审并修订以下四个设计轴：用户业务语言与任务连续性、contract/owner/frontend 控制权、诊断与首败链、
browser L2 的执行条件/TEST fixture/场景动作与 oracle。没有修改生产代码、契约生成物或测试实现，也没有执行
Testcontainers、browser L2、DEV、reset、seed 或 UAT。

本轮 owning source 当前事实：

- `contracts/policy/catalog-inventory-l2-scenarios.json`：18 scenario / 41 case；
- `contracts/policy/catalog-inventory-l2-execution.json`：`FRAMEWORK_ONLY`，active case 为 0；
- `contracts/policy/catalog-inventory-fixture-catalog.json`：39 个 TEST dataset，尚无本批 8 组 fixture；
- `scripts/test/catalog-inventory-l2-fixture.mjs`：已拒绝 DEV seed/report 作为测试输入，并要求 TEST + owner commands；
- `apps/frontend/operations-admin/playwright.config.ts`：只有 Playwright 基础配置；`scripts/test/browser-l2` 不存在；
- `contracts/policy/affected-l2-registry.json`：没有商品库 surface 的精确映射；
- 前端已有 `safeLogger`/`observedBaseQuery`，后端已有 HTTP completion 与 DB operation events，但没有
  `case/action/testId -> requestId -> completion -> DB section` 的 run-scoped join。

所以当前 `L2_EXECUTION_READY=false`。这是一条明确的未验证边界，不是实现失败，也不能由 focused/static proof 代称。

## 2. Findings 的辩证处置

| finding | 结论 | 根因层与有限适用范围 | 已折入的最小解 |
| --- | --- | --- | --- |
| 用户可见“SKU/预检/重新读取失败/导入”泄漏技术实现或内部状态 | `CONFIRMED` | 商品库 UI copy；不影响技术文档、operationId、测试键与真正的文件导入导出非目标 | UI 统一为“规格/检查影响/结果已保存，列表暂未更新/从品牌复制”；逐 screen 扫描和 wireframe 扫描必须为零 |
| 八条 Journey 只有 happy path，失败后的下一步与焦点恢复不够精确 | `CONFIRMED` | 商品库八类用户任务 | 交互稿新增 success/failure/recovery 连续性矩阵和逐字错误基线；每条都定义保留事实、下一动作与焦点 |
| “商品元数据/当前结果域”仍偏技术 | `CONFIRMED_BUT_DEXTER_FROZEN_EXCEPTION` | 仅两个冻结入口 | 保留入口，不扩散；配置抽屉补业务副标题解释其用途 |
| `code` 被一概视为技术词会误伤商品/规格业务编码 | `CONFIRMED` | 用户可见业务编码不是 problem code/internal key | 只禁 raw enum/ref/UUID/problem code/internal key；业务名称与业务编码允许且必须可读 |
| 分类候选和动作准入可被前端本地树或 `acceptedPage` 镜像重新解释 | `CONFIRMED` | 分类 TreeSelect、动作可见/禁用、RTK 查询消费 | contract 声明闭集、层级、selectable/disabledReason/actionAvailability；owner 计算并重验；generated RTK 传递；frontend 只呈现。当前本地 `treeData`/`acceptedPage` 明列为待退休 GAP |
| 前端没有一张逐控件 state owner 表 | `CONFIRMED` | 商品工作台交互控件全集 | IA §2.5 增加控制权矩阵；服务端事实只住 RTK `currentData`，整单草稿只住 draft store，workspace/UI 瞬态只住各自 reducer/local state，diagnostics 不成为第四事实住址 |
| 日志能看 HTTP 汇总，但无法从失败的用户动作闭合到 request 与 DB | `CONFIRMED` | 本批 24 条 L2 case 的声明 action | 详设 §11d 增加 `action-request-join.jsonl`、expected-event 矩阵、DB row join、脱敏字段与红变异 |
| 缺失日志会等到 timeout，首败报告缺 `lastKnownGood/brokenBoundary` | `CONFIRMED` | 受管 browser L2 runner | action window 结束立即产出 `NO_NEW_EVENT` 或 `LOG_NOT_AVAILABLE`；manifest 分阶段维护 firstFailure/lastKnownGood/brokenBoundary，business 与本地/远端 cleanup 分离 |
| 现有 18/41、active=0 被误当作本批可执行 L2 | `CONFIRMED` | catalog-inventory 既有 L2 单链 | 如实标记 `NOT_READY`；实施目标扩同一链到 26/65，只有本批 24 case 在全部 readiness PASS 后原子激活 |
| 本批测试数据未设计或复用 DEV seed | `CONFIRMED` | 本批 browser L2 | 新增且仅新增 8 个 run-scoped TEST dataset（39→47），全部由 owner HTTP commands 物化；DEV seed 永不作为 L2 前置数据 |
| 24 条场景只写标题、动作或 DOM 可见性，不能证明业务结果 | `CONFIRMED` | J-CATUI-01..08 × success/failure/recovery | 详设冻结 24 个 caseId、用户动作、逐字结果、owner readback/unchanged、焦点/恢复和日志关联；每个写 failure 均证明事实与版本未变 |
| 当前没有受管 browser L2 runner 与本地/远端 cleanup | `CONFIRMED` | 仅 browser L2 动态执行 | 设计唯一 `scripts/test/browser-l2` capability runner；按批准 L2 拓扑运行，不复用长驻 DEV；readiness 任一缺失即 fail closed |
| browser L2 secret 来源、最小注入与跨 run 清理未声明 | `CONFIRMED_ROUND1_M001_FIXED_ROUND2_VERIFIED` | 仅受管 browser L2 runner，不进入 App/business contract | 新增 runner-local credential adapter；0600 文件、六类 allowlist、按 child 最小注入、run/namespace binding、脱敏 manifest、失败码与红变异、local/remote cleanup readback |
| `L2_SECRET_FORMAT_INVALID` / `L2_SECRET_STALE` 只有失败码、没有独立红变异 | `CONFIRMED_ROUND2_S001_FIXED_SELF_DECIDED` | browser L2 secret validator 的验证层 | formal 验收 35、详设 §11c.5、serial CP-10 分别加入非法格式和过期 epoch 两条独立真红，精确断言对应 code，禁止泛化 throws 合并 |

没有 finding 被用来新增产品语义。分类可选性、动作准入、typed problem 与事实不变仍由 owner/contract 决定；
前端只拥有草稿编排、视图瞬态、布局和业务语言映射。

## 3. 修订工件

- `doc/plans/platform/2026-08-23-v2s-catalog-library-ui-experience-formal-requirements-codex.md`
- `doc/decisions/2026-08-23-v2s-catalog-library-workbench-journey.md`
- `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-interaction-design-codex.md`
- `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-ia-design-codex.md`
- `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-implementation-design-codex.md`
- `doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-serial-plan-codex.md`
- `doc/plans/platform/wireframes/2026-08-23-catalog-library-batch-copy.svg`
- `doc/plans/platform/wireframes/2026-08-23-catalog-library-config-drawer.svg`

## 4. 静态交叉对账

```text
USER_VISIBLE_COPY_FORBIDDEN_TECHNICAL_TERMS=0
WIREFRAME_FORBIDDEN_TECHNICAL_TERMS=0
CROSS_CUTTING_MECHANISM_ROWS=17
CHANGE_ANCHORS=16/16_UNIQUE
L2_CASE_ROWS=24/24_UNIQUE
L2_TEST_FIXTURE_ROWS=8/8_UNIQUE
CURRENT_L2_BASELINE=18_SCENARIO/41_CASE/0_ACTIVE
CURRENT_TEST_DATASETS=39
CURRENT_MANAGED_BROWSER_L2_RUNNER=ABSENT
SECRET_INJECTION_CLASSES=6
SECRET_FAIL_CLOSED_CODES=9
SECRET_RED_MUTATIONS=8
```

这些是设计和当前树的静态事实，不是 L2 PASS。真正 L2 只有实施完成、获得单独动态授权、24/24 case 运行、
业务 oracle 与本地/远端 cleanup 全 PASS 后才能报告。

## 5. 独立 reviewer 需要重点证伪

1. 从所有 `USER_VISIBLE_COPY` 和线框找反例：是否仍有用户看不懂的技术词，或失败后没有明确下一步。
2. 任取分类、动作准入、草稿、分页/展开、错误映射各一项，检查 contract→owner→generated RTK→frontend 的
   声明、传递、消费是否唯一，frontend 是否还在重算 owner 事实。
3. 任取一个本地无网络动作、一个 read、一个 write、一个 background refresh，检查 no-new-log 判据、request/DB
   join、firstFailure/lastKnownGood/brokenBoundary 与脱敏是否可证伪。
4. 从当前 18/41/0 active 的 owning source 出发，检查 26/65+24 active 的激活条件是否 fail closed；8 个 fixture
   是否不依赖 DEV seed；24 条 case 是否覆盖八类 Journey 的成功、失败、恢复，并以 owner readback 为业务 oracle。

## 6. 两轮后作者收口

- Round 1：`NO-GO M/S/N=1/0/1`，确认 secret injection contract 缺失；已根因补齐。
- Round 2：`NO-GO M/S/N=0/1/0`，确认 format-invalid/stale 缺独立 red mutation；已按最小修复补齐。
- 两轮上限已到，未召集第三轮。作者基于 owning source、Round 2 反例与修订后静态检查作出
  `SELF_DECIDED=READY_FOR_EXTERNAL_CLAUDE_DESIGN_REVIEW`。这不改写两个 reviewer 原始 verdict，也不把任何动态项标为通过。

## 7. 授权边界

本 intake 只授权 fresh 独立子 agent 进行本轮 DESIGN review。它不授权实施、契约/代码修改、测试执行、migration、
DEV、reset、seed、browser L2、UAT、部署或任何数据操作。
