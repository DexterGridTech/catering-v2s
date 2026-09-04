# 销售菜单 L2 执行诊断（第四轮 · 首败定性与做事方式）

- reviewerKind: `EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE`
- 会话性质: fresh v2s-rooted 只读静态复核。未运行任何命令，未起 DEV / Testcontainers / 浏览器，未 reset/seed/UAT。全部结论来自当前字节与已落盘的运行产物。
- 判定: **NO-GO**（针对「按当前方式继续」；FAST_PATH 见第 6 节）
- findings: **M=1, S=2, N=1**
- 授权边界: 只覆盖首败定性与工作方法。不授权实现、不授权动态执行、不授权 SM-05 收口、不授权进入 SM-06。

---

## 0. 首败已被静态定死，无需再跑任何东西

Codex 交接时写「尚未读取到究竟是哪一个实际 DOM/testId 不匹配」。这一项现在闭合了，
且不需要动态运行。证据链如下。

**缺失控件的精确身份**（`playwright-results.json`）：

```
SALES_MENU_L2_TEST_ID_NOT_FOUND:SALES_MENU_CANDIDATE_CATEGORY_TREE:sales-menu-candidate-category-tree
    at boundControlWithMetadata (sales-menu.spec.ts:609)
    at requireControl           (sales-menu.spec.ts:631)
    at runCaseJourney           (sales-menu.spec.ts:1590)
```

**该 testId 在 UI 里存在，不是漏写。** 三处命中：

- `salesMenuTestIds.ts` 第 22 行声明 `candidateCategoryTree: 'sales-menu-candidate-category-tree'`
- `SalesMenuPage.tsx` 第 1415 行把它挂在 `<Tree>` 上
- `salesMenuModel.test.ts` 第 86 行断言其字面量

**它没进 DOM 的原因在渲染条件。** `SalesMenuPage.tsx` 第 1399–1401 行：

```
{categoryError && <Alert type="error" … />}
{!categoryError && categoryNavigationQuery.isLoading && <Spin />}
{!categoryError && !categoryNavigationQuery.isLoading && (
  <Tree … {...testId(salesMenuTestIds.candidateCategoryTree)} />
)}
```

带 testId 的 `<Tree>` 只在「无错误且已加载完」时进 DOM，否则该位置是 `Alert` 或 `Spin`。

**排除「数据错误」这一支。** 本次 run 的 `http-request-events.jsonl` 里
`getOperationsCatalogNavigation` 返回 **status=200**，`categoryError` 为假。
因此走的是 `isLoading` 仍为真那一支。

**测试侧不等待。** 第 630 行的 `requireControl` 直接调 `boundControlWithMetadata`，
后者第 603 行做一次 `locator.count()`，为 0 即在第 609 行抛出——**零等待**。
而第 612 行的 `waitForBoundControl` 会 poll 5 秒。

第 1588–1590 行的序列是：点开候选抽屉 → 立刻 `requireControl` 抽屉 → 立刻
`requireControl` 分类树。抽屉打开触发分类导航请求，请求未回来时树不存在，
下一行立即计数为 0。

**定性：纯测试脚本竞态。不是 UI 缺控件，不是 fixture 问题，不是控件契约问题，
不指向生产 owner 业务代码。** Codex 保持「生产实现 UNVERIFIED」是对的，
但本条失败可以确定地排除在生产缺陷之外。

---

## M-1 「就绪判据用错信号」失败族第四次换装复发；类可一行收口

**仓内事实。** 同一根因已经以四种外形出现过：

1. 用 HTTP observation「快照加一」判就绪 —— RTK Query 命中缓存时不发请求（上一轮已修）
2. `chooseSection` 等 section 读请求 —— 同上（上一轮已修）
3. 本轮：`requireControl` 用一次性 `count()` 判就绪 —— 异步加载未完成时为 0
4. 反向的同族：`clickBoundControl` 内部**走的是** `waitForBoundControl`

第 4 条是关键对照：**点击路径会等，断言路径不等。** 这个不对称本身没有任何设计理由，
而断言路径恰恰是紧跟在异步触发之后运行的那一条。

**类的大小。** 在 `sales-menu.spec.ts` 中：

| 助手 | 是否等待 | 调用点 |
| --- | --- | --- |
| `requireControl` | **否** | **53** |
| `waitForBoundControl` | 是（poll 5s） | 9 |
| `clickBoundControl` | 是（内部转调） | 42 |

53 个不等待的控件查找，每一个只要目标控件位于异步取数之后，都是同一失败的潜伏实例。

**一行收口是安全的，已做证伪检查。** 若把 `requireControl` 第 631 行的
`boundControlWithMetadata` 换成 `waitForBoundControl`，唯一的风险是破坏依赖
「立刻抛出」的负向断言。逐条查过：spec 里 12 处「控件不存在」断言
（第 1607、1693、1723、1737、1738、1830、1861、1873、1887、1965、2017、2066 行）
**全部**走 `toBeHidden()` 或 `toHaveCount(0)` 的直接 locator，**没有一处**经过
`requireControl`。5 处 `catch`（第 147、325、380、496、2187 行）都在助手与错误上报路径，
不是负向断言。

**因此：一行改动关闭 53 个潜伏点。** 这与「在第 1590 行前面补一个等待」是完全不同的两件事，
后者是第五次实例修补，会把复发推迟到第 54 个调用点。

**验收判据（可证伪）。** 修完后 `sales-menu.spec.ts` 中不存在「不经过轮询就判定控件缺失」
的查找路径。反例形态请自行排除：只在第 1590 行加等待、把 timeout 调长、
给 `requireControl` 加 retry 包装、或新增一个第三种助手——都不算闭合。

---

## S-1 绿墙对该失败族结构性失明，不能作为「接近完成」的读数

**仓内事实。** 交接时的绿色读数是：静态 L2 runtime 64/64、前端 typecheck、
SM-L2-008 focused、第 4 条 focused。`scripts/generate/sales-menu-p1.mjs` 共 68 个断言点，
其 `sourceOfTruth` 是 `salesMenuTestIds.ts`（第 18、381、443 行）。

**推论。** P1 校验的是「testId 声明是否与契约绑定一致」。本次失败的 testId
**声明齐全、JSX 里也确实渲染**，只是运行期被条件挡住。**P1 按其判据构造，
永远不可能发现这一类问题**；typecheck 与静态 runtime 测试同理。

所以这四个绿对 case 5 的失败**零预测力**。这不是说这些门没用，
而是说：**它们全绿时，你对「条件渲染 / 异步就绪」这一整类失败的了解量仍然是零。**
把这类绿读作「只差最后一点」，正是每轮只暴露一个问题的心理来源。

**验收判据。** 报告进度时，绿色门必须标注其判据覆盖面；
不得用「静态全绿 + 两个 focused 通过」支撑「接近交付」的结论。

---

## S-2 拆分长 case 不是运行经济学的杠杆——这一条推翻问题里的隐含前提

**仓内事实。** `scripts/test/browser-l2-runtime.mjs` 第 5802 行硬编码
`'--max-failures=1'`；第 6035 行据此计算 `stoppedAfterFirstFailure`。
`doc/platform/browser-l2-execution-standard.md` 第 206 行要求首败必须立即保留并定界。
本次 run：18 条选中、5 条产出结果、13 条 `notRunCaseIds`，全程 **56.8 秒**。

**推论。** 只要停在首败，**每次全量 run 恰好产出一个失败，与 case 长短完全无关**。
把一条 60 秒的 case 拆成三条 20 秒的，run 仍然停在第一个失败上，信息量不变。

因此「先拆 case 以提高单轮信息量」这个思路**不成立**。拆分确有价值，
但价值在别处：失败点离成因更近（诊断定位更快）、重跑单条更便宜。
这两项都不改变「一次 run 一个失败」。

**真正的杠杆只有一个：按类修，不按实例修。** 本轮 M-1 的一行改动一次性覆盖 53 个点，
这才是把轮数压下来的机制。过去 92 次运行跨 16.4 小时而运行时长仅 2.2 小时，
根源不是 run 慢，也不是 case 长，是**每轮只关掉一个实例**。

**排序结论：先关闭 M-1 的类，再拆 case。** 不是因为拆分不重要，
而是因为现在拆分要重写已通过的 case，而收益（单轮信息量）为零。

---

## N-1 生产验证边界的表述正确，建议保留原样

Codex 写「没有证据指向生产 owner 业务代码，但生产实现仍是 UNVERIFIED」——这是准确的，
本轮独立复核支持这一表述。全量 L2、31 个 operation 的实际覆盖、后端 acceptance、
SM-05 至 SM-12 闭环确实都未证明。请不要因为根因定在测试侧就放松这条边界。

---

## 1. 首败属于哪一层，应先读什么（回答第 1 问）

**层级：测试脚本层，`requireControl` 的就绪判据。** 已 CONFIRMED，见第 0 节。

应先读的材料，按证伪效率排序（全部静态，无需运行）：

1. `playwright-results.json` 的 error message 与 stack —— 拿到精确 controlKey 与抛出行号
2. 该 testId 在 `salesMenuTestIds.ts` / `SalesMenuPage.tsx` 的命中 —— 区分「漏写」与「条件渲染」
3. 渲染条件所在的 JSX 分支 —— 找出控件不进 DOM 的确切条件
4. 同 run 的 `http-request-events.jsonl` —— 用请求状态区分「error 分支」与「loading 分支」
5. 抛出处的助手实现 —— 判断查找是否等待

前四步即可完成定性；第五步给出修复位置。**这一整条链上没有一步需要动态运行。**

---

## 2. 四个控制面是否重复或遗漏（回答第 2 问）

**不重复，各有独立判据：**

| 控制面 | 判据 | 覆盖 |
| --- | --- | --- |
| P1 静态预检 | testId 声明 ↔ 契约绑定 | 声明缺失 |
| fixture 分母 | `sales-menu-l2-fixture.json` 的 ownerFacts | 数据前提缺失 |
| control-touch | 触到未声明控件即抛（spec 第 439 行）；runner 第 6088、6153 行做每 case 反向对账 | 双向覆盖，第 4 条的分母遗漏就是它抓到的 |
| DOM 读模型断言 | 渲染结果 | 业务语义 |

**遗漏确实存在，但不在这四面之内。** 缺的是一条**助手层不变式**：
「控件查找必须容忍异步就绪」。这不该新增第五个 checker——
它不是可以静态判定的属性（是否需要等待取决于运行期取数时序）。

**更小更可靠的收敛方式：把就绪语义收进查找助手本身，让调用点无法写错。**
即 M-1 的一行改动。收敛后 `requireControl` 与 `clickBoundControl` 行为一致，
调用点不必再逐个判断「这里该不该等」。这比任何新增控制面都小，且没有假绿空间。

---

## 3. 先关闭失败族还是先拆 case（回答第 3 问）

**先关闭 M-1 的类。** 成本与风险见 S-2。

| 选择 | 成本 | 风险 |
| --- | --- | --- |
| 先拆长 case | 重写已通过的 case，spec 结构性改动 | 高：单轮信息量收益为零（`--max-failures=1`），且重构会引入新失败族 |
| 在第 1590 行补等待 | 1 行 | 高：第五次实例修补，53 个点里剩 52 个潜伏 |
| **先把 `requireControl` 改为等待** | **1 行** | **低：无负向断言依赖立刻抛，已逐条证伪** |

---

## 4. 方法论上仍存在的问题（回答第 4 问）

- **把动态运行当发现手段：仍然存在。** 本轮首败的完整定性只用了已落盘产物与源码，
  零动态运行。也就是说，暂停之前那次全量 run 之后，所需信息**已经全部在盘上**，
  却被记为「尚未读取」。动态运行的正确定位是回归确认，不是根因发现。
- **把局部 PASS 当完成证据：仍然存在。** 见 S-1。
- **忽略生产验证边界：未发现。** Codex 的表述准确，见 N-1。
- **新增一条：把 manifest 顶层字段当根因。** 上一轮 `PLAYWRIGHT_EXIT_1` 曾把诊断带向运行器，
  本轮 `SALES_MENU_L2_TEST_ID_NOT_FOUND` 又容易被读成「UI 缺控件」。
  顶层 `firstFailure` 是**边界标签**，不是根因；根因永远在 Playwright 报告本体的
  error message 与 stack 里。

---

## 5. FAST_PATH（回答第 5 问）

**第一步 · 纯静态，零运行。**
输入：本报告第 0 节与 M-1。动作：把 `sales-menu.spec.ts` 第 631 行的
`boundControlWithMetadata` 改为 `waitForBoundControl`。
禁止：新增控制面、放宽任何断言、加长任何 timeout、改任何生产代码。

**第二步 · 唯一允许的一次 focused 动态验证。**
只跑 `sales-menu-add-candidates` 一条（runner 第 5370–5389 行的 `--case` 入口，
标准第 135 行明确许可用于首败定位）。

**第三步 · 进入全量 18 条的准入条件（三条同时满足）。**

1. 第二步 focused 通过；
2. spec 中不存在不经轮询即判定控件缺失的查找路径；
3. 上一轮 M-1 的「观测计数加一」等待仍为 0（不得回潮）。

**第四步 · 全量 18 条。** 上一次全量只用 56.8 秒就走到第 5 条，
全绿预计在分钟级，不构成成本问题。

**第五步 · SM-06 之前的拆分原则。**
按「一次 owner 状态跃迁」切分，不按控件数量或行数切分：
一条 case 从一个稳定 owner 状态出发，产生一次状态跃迁，断言跃迁后的读模型，结束。
需要两次跃迁的写成两条，用 fixture 承接前置状态，不要在 case 内部串联。
这样拆出来的 case，失败位置天然贴近成因；这才是拆分的真实收益，
而不是「提高单轮信息量」。
