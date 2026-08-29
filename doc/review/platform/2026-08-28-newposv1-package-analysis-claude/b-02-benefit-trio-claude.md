# 权益三包 · `benefit-types` / `benefit-calculation` / `benefit-session`

| 包 | src | test | 测试比 | 结构 | 被依赖 |
|---|---|---|---|---|---|
| **TER 批次** | **批 D · 延后** —— 业务；当前全仓零引用 |
| `@next/kernel-business-benefit-types` | **1,164 / 22 文件** | 212 | 18% | **领域目录**（非标准骨架） | 2（另两个 benefit 包） |
| `@next/kernel-business-benefit-calculation` | **1,820 / 6 文件** | **1,935** | **106%** | **仅 `pipeline/`**（非标准骨架） | 1（benefit-session） |
| `@next/kernel-business-benefit-session` | **1,988 / 20 文件** | 2,116 | 106% | **标准骨架** ✅ | **0** |

**三包合计 4,972 src + 4,263 test 行。全仓穷举确认：三包之外零引用**
（`rg 'kernel-business-benefit'` 在 `*.ts` `*.tsx` `*.json`、排除自身目录后**零命中**）。

外加文档：`benefit-types/README.md` 296 行 · `benefit-session/README.md` 262 行 ·
`benefit-calculation/README.md` 175 行 · `1.2-business/benefit-framework-maintenance.md` 89 行
= **822 行文档**，另有 mock 后台 `0-mock-server/.../modules/benefit-center`。

## 0 · 先定性：这是一次领域模型 POC，不是遗留代码

按 §2.0 的判据校准，"零消费者"在 POC 语境下不是缺陷。
`benefit-framework-maintenance.md` 明确写了三包分工、标准接入流程（购物车/订单确认/支付三阶段）、
关键业务规则与**带真实数值的总案例**。它是**先把领域模型建好并验证，等业务接入**——
与 `workflow-runtime-v2`（`FIX-18`）同一性质。

> **TER 建设批次**见 [`00-ter-build-order-claude.md`](00-ter-build-order-claude.md)（Dexter 2026-08-28 裁定：地基优先，业务无关内容按依赖关系先建）。


## 1 · 三包分工（维护文档原话）

| 包 | 负责 | 不负责 |
|---|---|---|
| `benefit-types` | 统一模型。让零售、餐饮、高化都能适配到同一套商品、身份、权益、支付单候选字段 | 不计算、不请求后台 |
| `benefit-calculation` | 纯计算。输入标准快照，输出可用机会、实际应用、价格调整、支付单候选、履约效果 | 不查接口、不占用、不核销、不退款 |
| `benefit-session` | 终端运行时会话。接 TDP、查个人权益、动态码、多购物车上下文、占用与释放配额、调用计算 | 不理解具体业务下单模型、不手写 HTTP |

## 2 · `benefit-types`：模型设计的几个关键判断

### 2.1 金额一律最小货币单位

README 首条约定："所有 `Money.amount` 都使用最小货币单位。人民币场景下 `10000` 表示 100.00 元。
不要在模型层混用元和分，否则满减阈值、积分抵扣、支付优惠都会错一个数量级。"

**并且给了完整数值样例**（120.00 + 80.00 = 200.00 → 满 200 减 20 → 180.00 →
100 元券 → 预付卡 8 折 `coverageAmount=8000/externalRequestAmount=6400/payableImpactAmount=1600` →
5000 积分抵 50.00 `quantity=5000, payableImpactAmount=5000`）。
**维护者可以用这组数字自查字段是否用对。**

### 2.2 `BenefitRef = {templateKey, lineKey?}`

> 活动规则和用户资产必须分开。全场满减只有模板；优惠券既有模板规则，也有属于某个人的一张券行。

### 2.3 `BenefitContextRef = {contextType, contextId, isCurrent}`

`contextType: 'cart' | 'order' | 'payment'`；`contextId` 区分挂单 A/B；
`isCurrent` 标记"正在操作的那一单"。

⇒ **多购物车（挂单）下的配额占用被建模成一等问题**：
购物车 A 占用后，B 看到 `reservedByOtherContext`；A 取消释放后 B 重算可用。
这是收银台真实场景，多数模型会漏掉。

### 2.4 "可用"与"使用"严格分开

维护文档原话：
> `BenefitOpportunity` 只是机会；只有 `BenefitApplication`、`PricingAdjustment`、
> `SettlementLineCandidate` 或 `FulfillmentEffect` 才代表真实使用。

### 2.5 数量与金额分开

"5000 积分是数量，50.00 元是金额" —— `quantity` / `quantityUnit` 与 `payableImpactAmount` 分列。

### 2.6 目录按领域概念切

`commands` · `evaluation` · `fulfillment` · `identity` · `line` · `settlement` · `snapshot` · `template` · `foundations`
—— **不是仓库标准骨架**。对纯类型包来说是合理的（没有 actor/slice/selector 可放），
但它偏离了"每个包一套固定骨架"（`KEEP-02`）。

## 3 · `benefit-calculation`：一个 1,673 行的纯函数

`src/evaluate.ts` **1,673 行 / 占该包 92%**，只导出一个入口
`evaluateBenefitRequest(request): BenefitEvaluationResult`，内含约 40 个私有 helper：

生命周期与日期窗 · 商品范围过滤 · 资格判定（身份/会员/属性/时间窗/终端/渠道）·
门槛匹配（金额/非金额/最低应付）· 金额封顶 · 按额分摊 · 支付单候选生成 …

**测试 1,935 行 > 源码 1,820 行**，是全仓测试比最高的包之一。

## 4 · `benefit-session`：唯一走标准骨架的一个

标准 `application / features{actors,commands,slices} / foundations / selectors / supports / types`。

- `features/actors/sessionActor.ts` **556 行**（单 actor）
- `foundations/httpService.ts` 216 行（个人权益查询、动态码、占用/释放）
- 三个 slice：`benefitSnapshotSlice`(155) · `reservationSlice`(113) · `evaluationSlice`(108)
- 依赖 8 个包（含 `tdp-sync` / `transport` / `server-config` / 另两个 benefit 包）

## 5 · 优点

1. **领域模型建得扎实**：金额单位、机会 vs 使用、数量 vs 金额、多上下文占用 —— 四条都是
   真实收银场景里最容易做错的地方，都被显式建模了。
2. **822 行文档 + 带真实数值的总案例**，维护者能自查字段用法。
   这是全仓文档质量最高的一处。
3. **纯计算与运行时会话彻底分离**：`benefit-calculation` 无 I/O、无状态，
   1,935 行测试可以完全离线跑。
4. **三阶段（cart/order/payment）语义清晰**，并明确"购物车阶段调价会改变订单金额"
   这类容易被忽略的连锁后果。
5. **配套 mock 后台**（`benefit-center`）提供个人查询、占用、释放、动态码与订单事实测试数据。
6. **测试比 106%**（calculation 与 session），远高于仓库平均。

## 6 · 缺点 / 风险

1. **`evaluate.ts` 1,673 行单文件。**
   即便它是纯函数、测试充分，40 个 helper 挤在一个文件里也让"改一条规则会影响什么"难判断。
   而它的领域（资格/门槛/分摊/候选生成）恰好是天然可分层的。
2. **两包偏离标准骨架**（§2.6 与 `benefit-calculation` 只有 `pipeline/`）。
   对纯类型/纯函数包可辩护，但仓库没有为"非 runtime 包"定义第二套标准骨架，
   于是变成"看情况"。
3. **`benefit-session` 依赖 8 个包**，是 business 层依赖最多的。
   其中同时依赖 `tdp-sync` + `transport` + `server-config` —— 意味着它既消费 TDP 推送，
   又自己发 HTTP，两条数据入口。
4. **`sessionActor.ts` 556 行单 actor**，与 `evaluate.ts` 同类问题。
5. **零消费者**（§0 已定性为 POC 正常状态）。但需要记的是：
   **没有任何机制会提示"这个能力已建好，等待接入"** —— 与 `FIX-11` 同源。
6. **三包 README 与代码的一致性未验证**：README 描述的字段与实际类型是否逐条对上，
   本轮未逐字核对（`UNVERIFIED`）。

## 7 · 重构到 TER 的优化方向

**采纳与否是产品裁决**（与 `FIX-18` 同型：TER 现阶段要不要权益能力）。
若采纳：

| # | 动作 | 理由 |
|---|---|---|
| 1 | **模型（`benefit-types`）整体继承** | 四条关键建模判断（§2.1-2.5）都对，重写一遍只会犯同样的错 |
| 2 | **`evaluate.ts` 按阶段拆分**：资格判定 / 门槛匹配 / 效果计算 / 候选生成 四层 | 1,673 行单文件（§6.1）；测试已充分，拆分风险低 |
| 3 | **`sessionActor` 按职责拆**：TDP 接入 / 个人权益查询 / 占用释放 / 计算触发 | 556 行单 actor（§6.4） |
| 4 | **为"非 runtime 包"定义第二套标准骨架**（纯类型包、纯函数包各一套），写进 TER 规范 | 消掉"看情况"（§6.2） |
| 5 | **金额单位约定上升为仓库级规范**（不只是本包 README） | 混用元/分是跨包事故，不该只在一个包的 README 里 |
| 6 | **多上下文（挂单）占用模型整体继承** | 收银台真实场景，且极易漏（§2.3） |
| 7 | **建立"已建成待接入能力"的登记**，让零消费者不等于被遗忘 | `FIX-11` 的同一机制 |
| 8 | 若 TER 现阶段不做权益，**三包整体不搬**，但把 §2 的四条建模判断写进 TER 的业务语料 | 模型判断比代码值钱 |

## 8 · 证据档位

`已亲验`：三包文件清单与行数、目录结构、`benefit-types/README.md` 前 55 行、
`benefit-framework-maintenance.md` 全文、`evaluate.ts` 的导出与 helper 清单（`rg` 提取）、
零消费者穷举（`rg 'kernel-business-benefit'` 全仓 `*.ts`/`*.tsx`/`*.json`，排除自身目录后零命中）。
`UNVERIFIED`：README 描述与实际类型的逐字一致性；`evaluate.ts` 1,673 行的完整逻辑；
`sessionActor.ts` 556 行的完整分支。
