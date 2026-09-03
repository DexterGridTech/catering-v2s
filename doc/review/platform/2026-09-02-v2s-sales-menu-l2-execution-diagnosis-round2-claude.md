# 销售菜单 L2 执行方式诊断(第二轮 · Claude 只读)

```text
VERDICT=NO-GO(当前 L2 测试组织方式)
M/S/N=2/2/1
EVIDENCE_TIER=STATIC + RUNTIME_ARTIFACT
```

**方法**:只读当前字节,未改代码、未跑测试。所有数字由我从 run 产物与源码独立复算。
**被诊断 run**:`.runtime/browser-l2/l2-1788355293842-1651-9eb90022-cc39-49ce-9194-b42af151e4f3`。

---

## 0 · 一句话结论

**问题不在生产实现,也主要不在 fixture/oracle,而在 L2 的测试组织粒度。**
销售菜单把 L2 写成了 **16 个巨型 case**,而 Catalog 是 **130 个微型 case**;
每 case 动作密度 **11.1 : 2.7**,时间预算 **35–60 秒 : 2–3 秒**。
巨型 case 决定了"一次运行只能暴露一条链上的第一个失败",这才是"改一次不行、改几十次仍漏项"的机制。

---

## 1 · 根因分层

### L1 · 测试组织粒度(**主因**,M-1)

`[已确认 · 我独立复算]`

| | sales-menu | catalog |
| --- | --- | --- |
| case 数 | **16** | **130** |
| `await` 业务动作 | 177 | 352 |
| **平均动作/case** | **11.1** | **2.7** |
| `caseTimeoutMs` | 35000×2、40000×4、45000×5、50000×3、60000×2 | **2000×112、3000×18** |

**机制**:一个 11 步的 case 在第 7 步失败时,第 8–11 步的信息**全部丢失**,且无法从第 7 步续跑。
16 个 case × 约 11 步 ≈ 176 个可失败点,而**每次运行平均只能暴露 1 个**。
Catalog 的 130 × 2.7 结构下,一次运行可以同时确认上百个独立断言。

**这直接解释本轮现象**:16 个 case `selected=16` 但 `results=4`,
**12 个 case 连跑都没跑到**(`missing`),因为第 4 个 case 的 watchdog 打断了整条链。

### L2 · 运行环境:Vite 在 run 中途持续重载(M-2)

`[已确认]` `operations-admin-vite.log` 仅 **239 字节**(启动信息),
而 `operations-admin-vite.refresh-1.log` 有 **88641 字节、140 处 hmr/reload 命中**。

`[已确认]` Codex 报的 "FETCH_ERROR" 实测落在
`http://127.0.0.1:5175/@fs/.../admin-ui-foundation/src/observability/safeLogger.ts` ——
**这是 Vite 的模块 fetch,不是 API 调用**。`net::ERR_ABORTED` 出现 266 次,同源。

**因此 Codex 的定性需要更正**:这**不是"登录 transport 异常"**,
而是 **dev server 在测试执行期间反复重载模块**,把页面 JS 打断。
后端 200 与浏览器 FETCH_ERROR 并存,正是这个原因 —— 后端根本没参与。

**决定性佐证**:`stageOperationsSalesMenuAsset` 在 `owner-http-calls.jsonl` 中 **calls = 0**。
media case 的 `setInputFiles` 之后 **上传请求从未发出**;
`waitForOperation` 轮询 20 秒无果,case watchdog 在 60054/60000 ms 触发。
**这不是后端缺陷,也不是 oracle 期望错,是页面 JS 被 HMR 打断后 file input 的 handler 未生效。**

### L3 · 排序契约:默认排序键是 UUID(S-1)

`[已确认]` `BusinessChannelOwnerService.java` 第 2011 行 `salesMenuChannelOrderBy`:

```java
if (sortKey == null) return "c.channel_ref";
```

**默认排序是 `channel_ref`,一个 UUID。** 因此分页顺序与创建顺序**在构造上无关**。
Codex 报的"case 2 把 fixture 创建顺序当成 UI 分页顺序"成立,
但根因不是测试粗心,而是**契约默认排序键选了一个无业务意义的列**,
任何"第 N 项是谁"的断言都必须先读 owner 返回的实际顺序。

### L4 · fixture 策略(**不是问题**,应表扬)

`[已确认]` sales-menu spec 内 owner 建数据调用点 **1 处**,catalog **11 处**;
`contracts/policy/sales-menu-l2-fixture.json`(15898 字节)与
`scripts/test/sales-menu-l2-fixture.mjs`(11591 字节)已做预置隔离。
spec 内 `nth(` **0 次**、`fixture 下标` **0 次**、`getByTestId` **22 次**。

**夹具隔离与动态 identity 已经做对了**,这一轮的改进有效,不要回退。

### L5 · 生产实现

`[尚无证据指向]` 本轮 owner 调用 `updateOperationsSalesMenuItem` **47 次全部 200**,
`createOperationsSalesMenu`、`addOperationsSalesMenuItems`、
`getOperationsSalesMenuDraftSections/Items` 均有成功调用。
**没有任何一条失败指向生产 owner 逻辑。**
⚠️ 但这只等于"尚无动态证据指向它",**不等于生产实现已验证** —— SM-05 未闭环。

---

## 2 · Findings

### M-1 · L2 case 粒度过粗,导致单次运行信息产出极低
**层级** 测试组织 · **已确认** · 证据见 §1-L1。
**可证伪失败条件**:若 sales-menu 的 `caseTimeoutMs` 中位数仍显著高于 catalog 的 2000–3000ms,
或平均动作/case 仍在 10 以上,则该结构未改变。
**最小修复**:**按 Catalog 形态拆分** —— 把 16 个 case 拆成"一个 case 一个业务断言"的粒度,
目标是 `caseTimeoutMs` 落到 2000–3000ms 区间。拆分不需要新增业务语义,
只是把现有 177 个动作重新分配到更多 case 里。
**为什么更小的替代不足**:调大 timeout 只会让失败来得更慢;
保留巨型 case 而"改进断言"不能解决"第 8 步之后信息全丢"。
**需要 Dexter 裁决**:否。

### M-2 · Vite 在 L2 执行期间持续重载,打断页面 JS
**层级** runner/environment · **已确认** · 证据见 §1-L2。
**可证伪失败条件**:若 run 期间 `operations-admin-vite.refresh-*.log` 仍出现 hmr/reload 命中,
或 `@fs/` 模块 URL 出现 FETCH_ERROR,则未解决。
**最小修复**:L2 执行期间用**构建产物或禁用 HMR 的 preview 模式**提供前端,
不使用带 HMR 的 dev server。
**为什么更小的替代不足**:重试或加 timeout 无法消除模块重载;
`stageOperationsSalesMenuAsset` calls=0 证明请求根本没发出,不是慢。
**需要 Dexter 裁决**:否(属受管 runtime 配置,不改产品语义)。

### S-1 · 渠道列表默认排序键是 UUID
**层级** contract/owner · **已确认** · `BusinessChannelOwnerService.java` 第 2011 行。
**影响面**:任何依赖"第 N 项"或"下一页包含 X"的断言在构造上不可预测;
用户侧的分页顺序也无业务含义。
**最小修复**:测试侧一律以 owner 返回的实际顺序为准(Catalog 已是此形态);
是否把默认排序改成业务列(如 `channel_name`)属产品判断,**标 DEXTER_DECISION**。
**需要 Dexter 裁决**:是(仅"是否改默认排序"这一半)。

### S-2 · 失败族 stop condition 仍未落地
**层级** governance · **已确认** · Codex 自述"仍未关闭",与我上一轮 M-1 同源。
**最小修复**:落到实施模板阶段准入(我已在 `implementation-task-template.md` 第 135 行加入 6c)。

### N-1 · 裸 Response helper 收敛未完成
`[已确认]` BusinessChannel 六个已 typed;**Collaboration 三个、SalesMenu 一个仍待核**。
非阻断,但属同一根因,建议随手收完。

---

## 3 · 最小下一步(按序,不并行)

1. **先关 M-2**(环境)。用无 HMR 的前端服务重跑当前 16 个 case ——
   **不改任何测试代码**。目的是把"环境噪音"从"业务失败"里剥离出来。
   `[推论]` 我预期这一步会让 case 1/3 的 FETCH_ERROR 与 media case 的 watchdog 直接消失。
2. **看剥离后的真实失败面**。此时失败的才是真业务/oracle 问题。
3. **再做 M-1 拆分**。按第 2 步暴露的真实失败点拆 case,
   而不是先拆再跑 —— 先拆会把环境噪音也复制到更多 case 里。
4. **S-1 按 owner 实际顺序改断言**(测试侧),默认排序是否改留给 Dexter。
5. **收完 N-1 的四个 helper。**

⚠️ **第 1 步与第 3 步的顺序不能颠倒。** 当前 16 个 case 里已知有环境噪音;
先拆成 130 个 case 只会得到 130 份带噪音的结果。

---

## 4 · SM-05 → SM-12 快速闭环顺序

**SM-05(当前)**:按 §3 五步走。闭环判据是 16/16 或拆分后的全量 case business PASS,
且 `stageOperationsSalesMenuAsset` 等关键 operation 在 `owner-http-calls` 中有 200 记录。

**SM-06 → SM-08(前端)**:拆分后的 case 粒度直接沿用,**不要再回到巨型 case**。
每新增一个 UI 行为,新增一个 2–3 秒的 case,而不是往已有 case 尾部追加步骤。

**SM-09(browser L2)**:M-2 修复后此步风险大幅下降。

**SM-10 → SM-11(Seed/reset)**:与 L2 解耦,可与 SM-06–08 并行准备,但执行仍串行。

**SM-12(收口)**:此时才做全批三维对账与两轮对抗审查。

---

## 5 · 必须动态证明的

- M-2 修复后 case 1/3/4 是否真的通过;
- 拆分后全量 case 是否 business PASS;
- `stageOperationsSalesMenuAsset` / `releaseOperationsSalesMenuStagedAsset` 是否真的被后端收到;
- 31 个 operation 的**实际**执行覆盖;
- 生产 owner 逻辑在真实 HTTP 下的行为(**本文所有关于生产代码的判断都是"未证伪",不是"已证明正确"**)。

**我明确没做**:未运行任何测试;未修改任何源码;
未引入 fixture DSL、测试平台、fallback、放宽断言或新产品语义。

---

## 6 · 对 Codex 自述的三处更正

1. **"case 1、3 是登录后的浏览器 FETCH_ERROR"** —— 更正为 **Vite HMR 模块重载**,
   FETCH_ERROR 的 URL 是 `@fs/.../safeLogger.ts`,与登录无关。
2. **"case 4 因前置运行链异常出现 Channel closed watchdog"** —— 更正为
   **`stageOperationsSalesMenuAsset` 请求从未发出**(calls=0),
   是上传 handler 未生效,不是前置链污染。
3. **"多个场景共享登录和前置链,早期异常会级联污染"** —— 部分成立,
   但**真正的级联源是巨型 case**:`selected=16` 而 `results=4`,
   12 个 case 因第 4 个 case 的 watchdog 而根本没跑。拆细 case 即可消除该级联。
