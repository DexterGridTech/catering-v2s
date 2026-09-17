# TER 双机拓扑 · DESIGN review 第二轮(详设 + 实施计划)

- 评审人:Claude｜日期:2026-09-17
- REVIEW_TARGET=DESIGN
- 对象:
  - `doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md`
  - `doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md`
- 需求正本:`doc/plans/platform/2026-09-17-ter-dual-machine-topology-requirements-claude.md`
- 上轮:`doc/review/platform/2026-09-17-ter-dual-machine-topology-design-review-claude.md`(NO-GO,2/4/2)

## 0. 结论

```
VERDICT=GO
M/S/N=0/1/2
```

上轮两条 Major 与四条 Significant **全部实质关闭**(逐条回文档亲验,非采信修复清单)。剩余一条 S 是前批范围移除后的**残留条目**,与本批自己的 §12 声明冲突,**须在 CP-0 前删除**;两条 N 为措辞与归属不精确。

⚠️ **独立性边界**:需求正本由本评审人撰写,故本文对需求稿的判断**不是独立评审**;对详设与实施计划的评审是独立的。

⚠️ GO 的含义:详设与实施计划可交 Dexter 决定是否进入实施。**不构成 implementation、runtime、native、Android、visual、release 或 cleanup 的任何 PASS**。本轮只读,未运行任何构建、测试、设备或动态动作。

## 1. 上轮 findings 的复核(逐条回文档亲验)

| 上轮 | 状态 | 亲验落点 |
|---|---|---|
| M-1 跨批范围并入 | **CLOSED** | 头部新增 `CROSS_BATCH_DEPENDENCY`;§0.1 不变量 5 改为"前置依赖";§12 整节改为「前批 screen-part 契约依赖(不纳入本批实现)」并列出四份 dependency 文档;CP-3 与计划 §3.1/§4.4 的 R-10a 步骤已移除;§4.2/§4.5 的冲突检测与兄弟条目失败命题已移除 |
| M-2 D-18 状态名不存在 | **CLOSED** | §0.3 写出真实取值:`RequestLifecycleStatus = started/completed/partial-failed/timed-out/error`、`CommandAggregateStatus = running/completed/partial-failed/timed-out/error`,并明写「registered/dispatched/accepted 不是 status,不能把日志 phase 当 status」;D-18 行与计划 §4.4 第 6 步同步重写;红变异含「漏 partial-failed/timed-out」与「不得改 union」 |
| S-1 evaluator 同时返回裁决与事实 | **CLOSED** | §10.1 拆为 `selectTopologyFacts`(只读)与 `evaluateTopologyOperation({operation, facts}) → {allowed, reasonCode}`;capability 增 `getOperationEligibility(operation)`;明写「所有 action control 必须调用 getOperationEligibility,不得从 snapshot 的 paired/reachable 自行推导」;CP-1 红变异含「UI 用 facts 自算 allowed」 |
| S-2 §9 的 D-1/D-2 答非所问 | **CLOSED**(未在修复清单中列出,但已修) | D-1 行改为 tab 恒显 + operation eligibility 置灰与可读原因;D-2 行改为只读 `GET /terminal-topology/status`、字段集、连接前确认、失败不写 pairing |
| S-3 副屏分母 | **CLOSED** | DR-02 裁为 `FOUR_SECONDARY_PARTS`,逐 app 列出;与仓内事实一致(下详) |
| S-4 端口占用无行为 | **CLOSED** | §8.4 增 `TOPOLOGY_HOST_PORT_OCCUPIED` 及文案;D-4/D-8 要求 bind 异常归一为 typed reason、不得吞成通用失败;CP-2 红变异含「把端口占用吞成无原因的 TOPOLOGY_HOST_FAILED」 |
| N-1 确认动作不是判据 | **CLOSED** | 计划 §4.4 第 4 步改为对 `showScreen`/`openLayer`/`clearLayers` **各做一次绕过 runtime boundary 的 production red mutation**,并明写「它们不是"看过调用路径"的确认动作」;CP-3 红清单含「取消任一条」 |

### 1.1 一条我提出、但自行证伪的怀疑(如实记录)

本轮我怀疑 **DR-02 把分母扩到两个 app,而同步集合没跟着扩**:§10.2 写死 `sliceName 只允许 members`,若 `sample-wallpaper-console` 的两个副屏 part 读的是别的切片,第二个 app 作副机时副屏就是空的。

**回源码后该怀疑不成立**:

- `apps/terminal/ui/integration/sample-wallpaper-console/src/parts/parts.ts` 全文:`waitingPart`(等待店员登录)与 `welcomePart`(店员登录后顾客欢迎语),二者 `displayModes: ['SECONDARY']`、`instanceModes: ['MASTER']`、`surfaceForm: ['laptop']`。
- 该包 `*.tsx` 检索 `useUiStateSelector` 与 `select[A-Z]` **零命中** ⇒ 两个组件**不读任何 state**,waiting↔welcome 靠**屏幕迁移**切换,不靠数据。
- `apps/terminal/kernel/feature/sample-wallpaper/src/features/slices/slice.ts` 第 42 行 `syncIntent: 'isolated'`,且无副屏消费者。

⇒ D-14 的「members 下行、session isolated」对两个 app 都成立;第二个 app 的副屏正确性依赖的是**跨机屏幕迁移(D-19/CP-3)**,该路径设计中已闭合。**不构成 finding。**

## 2. Significant

### S-1 前批范围移除后的残留条目,与本批 §12 自相矛盾

```
状态=CONFIRMED
严重度=S
owning source=前批 screen-part-form-resolution
```

**仓内事实**

- 本批详设 §12 明写「本批不重新实现或修改该批的 screen-part form resolution、catalog 冲突检测、ready/failure classification……」。
- 但详设 §13 仍写:「两个 integration 的 assembly/parts 和 sampleAssembly tests:生产装配走真实 catalog;**手搓 production-name test 改为真实装配或降级改名为纯 unit**。」
- 计划 §4.5 第 7 步仍写:「……assembly tests 必须验证真实 assembly,**而不是只手搓 production-name catalog**。」
- 该事项的 owning source 是前批:`doc/plans/platform/2026-09-16-ter-screen-part-form-resolution-implementation-design-codex.md` 第 199 行(「现有 hand-built test 只允许保留为明确的非生产 catalog unit test」)与第 342 行(「`createUiCatalog` 的公开导出不承担生产冲突扫描;直接调用它的测试必须被明确命名为非装配 catalog unit,或改走真实 assembly」)。

**反例**

实施方按详设 §13 执行,去改 `sample-console`/`sample-wallpaper-console` 既有的 production-name catalog 测试。该测试治理属前批范围且前批已有结论;在本批改动会与前批的 code/design reconciliation 产生二次偏移,而本批任何 red mutation 都不会捕获它(本批没有对应判据)。

**最小处置**

删除详设 §13 与计划 §4.5 第 7 步中关于 `production-name`/手搓 catalog test 的从句;本批只需要求「两个 integration 的 topology section 与各自真实 secondary allowlist 走真实 assembly 验证」,不附带前批的测试改名/降级要求。

**核验方式**

```
rg -n "手搓|production-name" doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-design-codex.md doc/plans/platform/2026-09-17-ter-dual-machine-topology-implementation-plan-codex.md
```

## 3. Notes

### N-1 计划 §9 自查表残留前批词汇

计划 §9 仍有一行「Batches/CP 依赖和 **B1/B3 overlap**」。`B1/B3` 是前批的批次编号,本批 CP 体系是 CP-0..CP-5,没有 B1/B3。建议改为「CP-3 机制批先行、CP-4 UI 批后行」。

### N-2 DR-02 对两个 part 的归属描述不精确

DR-02 与 D-3 写「sample-console 为 customerWelcome、customerMember」。这两个 part 实际声明在 `apps/terminal/ui/feature/sample-member-desk/src/parts/parts.ts`(`customerWelcomePart`、`customerMemberPart`),由 sample-console 的 assembly 汇入;而 wallpaper 的两项确实声明在 `sample-wallpaper-console` 自己的 `parts.ts`。两者归属层级不同。

计划 §4.1 第 4 步要求 CP-0「逐包读取两个 integration 的 assembly/parts」——按现描述可能在 `sample-console/src/parts` 下找不到那两项。建议在 DR-02 注明 member-desk 是其声明 owner。

## 4. 本轮核验范围与未验

**已逐条回文档或回源码核验**:上轮全部 7 条 findings 的关闭状态;DR-02 四项分母与两个 integration 的真实 `parts.ts`;`sample-wallpaper` 切片的 `syncIntent`;wallpaper 副屏组件的 state 读取面;前批文档中该残留事项的 owning 行号。

**抽样核验**:U-1、U-4、U-7、U-9、U-13、U-15、U-18、U-19、U-20、U-21、U-22 的执行体与红变异描述,方向与需求一致。

**未验**:未对 U-1 至 U-22 全部 22 条逐条构造反例推演;未运行任何 focused/native/设备动作;DR-01 的 Android server 依赖可用性仍为 CP-0 的 OPEN,本轮无法判断;双设备 runner 尚不存在,其能力声明属计划态。

## 5. 授权边界

本评审只读。不授权修改源码、测试、脚本、依赖或构建产物;不授权实施、构建、Android、设备、Web、DEV、seed、UAT、部署或仓库控制动作。**DESIGN review 的 GO 不等于 implementation acceptance**;进入实施与否由 Dexter 裁定。
