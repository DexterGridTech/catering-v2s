# 销售菜单 L2 执行诊断（第三轮 · 根因定级）

- reviewerKind: `EXTERNAL_INDEPENDENT_REVIEWER_CLAUDE`
- 会话性质: fresh v2s-rooted 只读静态复核（未运行任何命令、未起 DEV/Testcontainers、未 reset/seed）
- 判定: **NO-GO**
- findings: **M=1, S=2, N=1**
- 授权边界: 本结论只覆盖「为什么 SM-L2-008 反复失败、下一步怎么走最快」。不授权 SM-05 收口、不授权进入 SM-06、不授权任何数据操作。

---

## 0. 本轮唯一失败的真实形状

上一轮 run（`l2-1788397701542-237-…`）的 manifest 顶层是 `firstFailure=PLAYWRIGHT_EXIT_1`、
`business=FAIL`、`lastKnownGood=L2_CASES_17_PASS`。这三个字段**不指向根因**，
容易把人带去查运行器。打开 Playwright 报告本体后，真实失败是：

- 失败 case: `sales-menu-publish-and-front-structure`（SM-L2-008），进度流 index 10
- 断言: `expect(received).toBeGreaterThanOrEqual(1)` → `Received: 0`
- 机制: `Timeout 20000ms exceeded while waiting on the predicate`
- 位置: spec 第 1644 行

第 1640–1644 行的构造是：

1. 先快照 `getOperationsSalesMenuPublishedItem` 的观测条数；
2. 点击 `SALES_MENU_ITEM`；
3. 等观测条数涨到「快照 + 1」。

**若 RTK Query 已缓存该 published item，点击直接由缓存渲染、不发网络请求，
计数永远不涨。** 收到的 0 是增量 0，不是「页面没渲染」。

---

## M-1 计数等待构造未按「类」清除，同一失败族第 10 次复发

**仓内事实。** `chooseSection` 上一轮已改为基于 DOM/read-model 断言，方向是对的。
但它只拆掉了这个构造的**一个实例**。同构造的「快照 + 1」等待在 spec 中仍有 5 个调用点：

| 行号 | 等待对象 |
| --- | --- |
| 1618 | 选中分区的 DRAFT items |
| **1644** | `getOperationsSalesMenuPublishedItem`（**本轮唯一失败点**） |
| 1653 | 选中分区的 PUBLISHED items |
| 1660 | `getOperationsSalesMenuPublishedItem` |
| 1708 | `getOperationsSalesMenu` |

底层的 `runtime.observations.filter(...)` 计数在该文件出现 **23 处**。

**仓内事实（对照组）。** 同目录另外 11 个 L2 spec 使用该构造的次数：

| spec | `runtime.observations.filter` | `waitForOperation` |
| --- | --- | --- |
| catalog-inventory | 0 | 0 |
| store-management | 0 | 0 |
| user-management | 0 | 0 |
| organization-hierarchy | 0 | 0 |
| contract-management | 0 | 0 |
| business-entity-management | 0 | 0 |
| store-profile | 0 | 0 |
| work-context | 0 | 0 |
| authentication | 0 | 0 |
| invitation-acceptance | 0 | 0 |
| access-recovery | 0 | 0 |
| **sales-menu** | **23** | **38** |

`catalog-inventory.spec.ts` 有 92 条 `expect` 断言、0 次 `waitForOperation`——
它断言的是**读模型渲染结果**，不是 **HTTP 事件流**。

**推论。** 这不是「时序没调好」，也不是「测试写得不够仔细」。这是**偏离仓内多数派模式**：
把「HTTP 请求发生过」当作「界面已就绪」的判据。二者在有缓存的 RTK Query 下**本来就不等价**，
所以任何单点修补都只是把复发推迟到下一个调用点。这与后端 4 个裸 `Response` helper
是同一条教训的两个面。

**验收判据（可证伪）。** 修完后 `sales-menu.spec.ts` 的
`runtime.observations.filter` 计数等待与 `waitForOperation` 的「+1」调用点应为 0；
若仍有任一处以「观测计数增量」作为界面就绪判据，即未闭合。
反例形态：改成 `+ 0`、改成更长 timeout、或加 retry——都不构成闭合。

---

## S-1 用例动作密度反向恶化，M-1（上一轮）未被处置

**仓内事实。** spec 从 1150 行涨到 2076 行；18 个 case 共 317 个 await 动作，
**17.6 动作/case**（上一轮 11.1）。`caseTimeoutMs` 分布 20000×3、35000×2、40000×4、
45000×4、50000×3、60000×2；Catalog 同类 case 是 2000–3000。

**推论。** 上一轮 M-1（拆分高密度 case）不仅未闭合，密度还上升了 58%。
高密度的直接代价是**每次失败要重跑整条长链**，这正是 run 数被放大的来源。

**但本轮不建议立刻拆。** 见第 3 节。

---

## S-2 中断 run 未产出 cleanup manifest，状态残留未确认

**仓内事实。** 被中断的 run 目录 `l2-1788398476753-19665-…` 共 14 个文件，
缺 `l2-cleanup-manifest.json`、`l2-execution-manifest.json`、`l2-selection-manifest.json`，
且 `cleanupErrors` 无从判读。

**推论。** 中断路径没有走 cleanup。下一次 run 前无法从产物断言「上一轮已清干净」。

**验收判据。** 每个 run 目录要么有 `l2-cleanup-manifest.json`，
要么有显式的「中断未清理」标记。目前两者都没有，属于不可判读态。

---

## N-1 后端 4 个裸 `Response` helper 仍在

Collaboration 3 处、SalesMenu 1 处。不阻塞 SM-05，但与 M-1 同源，建议在 SM-06 之前一并收。

---

## 1. 分层归因（回答 Codex 第 1 问）

| 层 | 状态 | 依据 |
| --- | --- | --- |
| 测试代码层 | **CONFIRMED** | 第 1644 行计数等待；23 处构造仓内独有 |
| 运行器/环境层 | **CONFIRMED 已修复** | 本轮 discovered=selected=results=18；no-HMR 生效 |
| 用例粒度层 | **CONFIRMED 恶化** | 17.6 动作/case，超时 20–60s |
| 契约/policy 层 | **CONFIRMED 无问题** | 逐 case 交叉 `waitForOperation` 与 `backgroundAllowed`：**0 冲突** |
| 生产代码层 | **UNVERIFIED** | 本轮无任何失败指向产品缺陷；不得据此断言产品有 bug |

关于契约层需要特别说明：我最初按**全集**比较，发现 3 个 operation 既被等待又被声明
`backgroundAllowed`，一度准备开 finding。**逐 case 交叉后为 0 冲突**——同一 operation
在 A case 必需、在 B case 后台是合法的。全集比较会产出假 finding，此处按 case 维度核过。

---

## 2. `chooseSection` 修复评价（回答第 2 问）

- **形状正确**：改用 `waitForBoundControl` + DOM 可见性，与仓内其余 11 个 spec 一致。
- **但不是最小完整修复**：它是实例修复。同构造的另外 5 个「+1」调用点原样保留，
  其中第 1644 行就是本轮唯一失败点。
- **cache/currentData/HTTP-completion 混用是否仍在**：**是，仍在**，
  但不在 policy 声明层（那里干净），而在 spec 的 5 个「+1」等待点。

---

## 3. 先拆分还是先跑（回答第 3 问）

**结论：先删构造，再跑一次 focused run；拆分推迟到 SM-06 之前。**

| 选择 | 成本 | 风险 |
| --- | --- | --- |
| 现在拆分高密度 case | 17 个已过 case 全部作废重写，spec 需重构 | 高。把一次确定的小修变成一次大重构，且重构本身会引入新失败族 |
| 不删构造直接再跑 | 一次 run | **极高。第 11 次复发几乎必然**，因为失败点未被触碰 |
| **删构造后只跑 SM-L2-008** | 5 处行级改动 + 一次单 case run | 低。改动落在唯一失败点上，判据可证伪 |

拆分**必须在 SM-06 之前做**，理由是密度已从 11.1 涨到 17.6；但**不是现在**，
因为现在做会让 17 个已通过的 case 归零重来。

---

## 4. 最快交付路径（回答第 4 问、第 6 问）

1. 把第 1618、1644、1653、1660、1708 行的「观测计数 + 1」等待，
   换成与其余 11 个 spec 一致的读模型断言（断言详情面板出现目标内容，而非断言发过请求）。
2. 只跑 SM-L2-008 一个 focused run。
3. 绿了之后再跑一次全量 18 收 SM-05。
4. SM-06 之前：拆分动作密度，并收掉 4 个裸 `Response` helper。

**最小阻塞项**：spec 第 1644 行（及同构造的 1618/1653/1660/1708）。

**唯一允许的下一条命令**：删掉 5 处计数等待之后，只跑 SM-L2-008 的 focused run。

**最可能的下一个时间黑洞**：认为「环境修好了，再跑一次就过」而不动第 1644 行。
本轮 18/18 完整跑完恰恰证明环境已经不是瓶颈——环境修复把问题**暴露**了出来，不是解决了它。

---

## 5. 关于 4 个裸 `Response` helper（回答第 5 问）

不阻塞 SM-05，不要在本轮动。它与 M-1 是同一条教训：**偏离仓内多数派模式**
（后端 43 个 typed helper 对 4 个裸 `Response`；前端 11 个 spec 对 1 个用 HTTP 计数的）。
建议在 SM-06 之前，与动作密度拆分放在同一批做完。
