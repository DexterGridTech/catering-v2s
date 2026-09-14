---
id: pitfalls.review-checked-existence-not-rendering
status: active
layer: routed
taskKinds: ["review"]
domains: ["admin-ui","platform"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["architecture"]
triggers: ["review"]
assertions: ["REVIEW_MUST_RECONCILE_USER_VISIBLE_FACTS"]
sourceRefs: ["doc/platform/review-standard.md"]
---

# 实施后复核只验了"存在什么",没验"渲染成什么"

**触发时刻**:做 `REVIEW_TARGET=IMPLEMENTATION` 的复核,准备给 `GO`。

## 事实

2026-08-19 Claude 对 R5 实施给 `GO`(M=2/S=2/N=1)。
2026-08-20 Dexter 第一次打开页面,**连续 21 条问题**。

那轮 5 条 finding 的构成:读侧授权(后端)· 集合形态(架构)· 刷新机制(架构)·
Problem 处理器(后端)· 测试常量。**零条关于用户看到什么。**

**根因不是不认真**:当时 `agent-operating-model.md` §8 要求"只验四件" ——
不变量 · 范围外改动 · 证据档位 · 反向 PROOF,**四件全是工程不变量**。
评审侧当时**没有规范**,只有"怎么写 review 请求"的交接模板。

⇒ **设计侧有规范、评审侧没有规范,复核就只会验它会验的那一层。**

## 两个各自独立的坑

**① 读代码 ≠ 知道渲染成什么。**
读代码告诉你存在什么。21 条里 20 条是"渲染成什么" ——
首列是哪一列、按钮在 header 还是底部、Tab 里装什么、页面上那句话是不是内部实现说明。
这些必须**先机械提取事实,再与 IA 逐条对账**,不能靠通读。
(同 [[pitfalls.green-by-existence-check]])

**② `GO` 的边界声明说了等于没说。**
我写了"本轮为静态复核,未运行浏览器" —— **准确,但不可据以决策**。
Dexter 读到 `GO`,合理期待能用的页面。
正确形态是列出:**首列点击、条件校验、Tab 位置、页面文案这几类事实本轮无人验过,
你会是第一个看到的人。**

## How to apply

1. 每个改动过的 feature 目录先跑一次**可见事实提取**(表格列/`extra=`/Tab/表单字段/
   校验提示/长中文串/前端自造枚举文案),再与 IA 的可见维度对账 ——
   命令见 `doc/platform/review-standard.md` §2.2。
2. **长中文串找不到 `USER_VISIBLE_COPY` 对应的,多半是内部实现说明泄漏给用户。**
3. **契约已有 `*DisplayName` 却出现前端枚举三元表达式 = finding。**
4. 结论必须带**未验证清单**;非空时只能写 `GO_WITH_UNVERIFIED_UI`。
5. 任何 finding 都要枚举**同族全集**并逐个判定 ——
   2026-08-19 的读侧授权只修 1/6,2026-08-20 的中文名称只接 1/2,**两次都是点状止血**。

**判别式**:我这条结论,是"代码里写了这个",还是"用户会看到这个"?
只有前者 ⇒ 它进不了 `GO`,只能进未验证清单。

相关:[[pitfalls.claim-versus-behavior]] · [[pitfalls.invisible-dimension-drifts-at-implementation]] ·
[[pitfalls.green-by-existence-check]]

## TER 变体：生产装配、触摸关系和失败可观测性不能由单测形状代替（2026-09-12）

本轮 admin console 暴露了三个同根反例：

- 形态字段“存在”不等于生产入口会区分形态。`sample.console.admin-test` 只有在真实 `definedParts → UiCatalog → selectAvailableParts/openLayer` 路径上声明为 mobile-only，并对 laptop 观察到 typed no-write rejection，才是形态过滤证据。
- 手势节点“存在”不等于业务控件仍可操作。独立的不可见 `Pressable` 即使有正确 testID，也可能消费其下方业务触摸。需要把观察器放在业务内容祖先上、关闭自己的 responder/press ownership，并在手势阈值以下实际按一个业务控件；同时用宿主窗口比例把 page 坐标换算为逻辑画布坐标，不能拿像素直接和逻辑阈值比较。
- fail-closed 不等于失败可诊断。物理 host identity 矛盾若只返回 `null`，会与普通 host not-ready 合并成永久 loading；必须保留 typed rejection 和脱敏 logger 事件，同时仍不渲染 children。

适用边界：这是实施与 focused proof 的通用检查，不要求为每个形态或每个观察器新增框架。最小闭环是：真实生产装配、一个相反形态/矛盾事实的红向量、一个用户可见或结构化可读的失败信号、以及正常业务后代动作的正向向量。focused 通过仍不能提升 Web、Android、native device、release 或 visual 档位。
