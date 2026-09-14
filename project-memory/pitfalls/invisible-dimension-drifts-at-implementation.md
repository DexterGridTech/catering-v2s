---
id: pitfalls.invisible-dimension-drifts-at-implementation
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["backend","admin-ui","contract","platform"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["architecture","contract"]
triggers: ["task-start","implementation","review"]
assertions: ["INVISIBLE_DIMENSION_NEEDS_PERFORMABLE_OBSERVATION"]
sourceRefs: ["doc/decisions/templates/ia-design-template.md", "doc/decisions/templates/implementation-design-template.md"]
---

# 看不见的维度必然在实施期走偏

**触发时刻**:写 IA 或详设时,准备写下一条**无法靠打开页面验证**的约束。

## 事实(2026-08-19 R5 收口复核)

四条缺陷,**全部**能追回 IA 原文:

| 缺陷 | IA 出处 | 维度 |
|---|---|---|
| 六个读接口五个无节点授权 | 「读按 role node scope」 | `stateAndPermission` |
| 手写刷新计数器(全仓 11 个 feature 里唯一) | 「按精确 cache/query identity 刷新」 | `navigationAndRefresh` |
| 声明 Page 实建抽干+客户端分页 | 「需要真实 SQL Page」/「bounded 结果展示分页」 | 集合形态 |

**而同一份 IA 里,能在屏幕上看见的维度全部落实** ——
控件形态、入口与 surface、testId(13 个文件)、可见错误文案,一条不差。

⇒ **不是不认真,是验证方式决定了什么会被验证。**
实施者打开页面就能看见抽屉里有没有搜索框;
看不见「这次读有没有过节点授权」「是否只失效了受影响的 query」「total 是不是服务端给的」。

旁证:当时 `ui-interaction-design-template.md` 已有 **343 行**强制标准,全部关于可见项;
承载不可见维度的 IA **没有任何模板**。

## 三个各自独立的成因(修法不同,别混为一谈)

**① 规范根本不存在,只有代码先例。**
读侧节点授权、owner Problem 注册处 —— 全仓零成文规范,只有
`OperationsContractController` / `ContractProblemAdvice` 这样的代码先例。
作者既无「用现成的」可指,也无「该长成什么样」的约束,**只能自己发明**。
⇒ 修法:详设模板第 ③ 列(无现成时必须指出先例精确路径 + 要同形的哪几点)。

**② 规范存在但详设没点名。**
`createRefreshSignal` 存在、App 级 `operationsRefreshSignal` 已实例化、
前端能力查找表里有「刷新信号」行 —— 详设的 foundation 对接表**没有这一行**,于是手写了 7 处计数器。
⇒ 修法:横切机制表行集固定,**只能填值不能删行**。

**③ 规范存在、详设点名两次,照样违反。** ← 最贵的一条,也最容易被误诊
`collection-boundary-modes` 被 `RECALL` 点名两次。它错在**缝隙**:
IA 写 `bounded`、详设 §5.2 写 `Page` —— **两份设计文档在实施开始前就自相矛盾**;
契约层选了 cursor,前端层用"抽干全部页"弥合。每一层单独看都说得通。
⇒ 修法:两份文档交叉对账(同一事实逐字一致)+ 同一事实跨多层时,**每层各写一次它在该层的具体值**。

## How to apply

1. **不可见的维度写成一个能做的观察,不写属性。**
   ```text
   ❌ 读按 role node scope
   ✅ 把 URL 的门店段换成同空间另一门店,本屏全部读接口(共 4 条)均返回授权拒绝
   ```
2. **凡写「对 X 这样做」,先给出 X 的全集** —— 不是举例,是清单。
   写不出全集 ⇒ 同族还没扫完。(读侧授权正是这么漏掉五个接口的:
   前一轮 finding 只点名了候选接口,修复也只加在那一个上。)
3. **同一事实出现在两份设计文档里,必须逐字一致** —— 不一致就是缺陷,
   ⛔ 不许留给实施期弥合。
4. **RECALL 是阅读清单,不是合规机制** —— 它点名过的规范照样被违反,不要指望它兜底。

**判别式**:我写下的这条约束,实施者**能做什么动作**来确认它成立?
说不出那个动作 ⇒ 它就是一句属性描述,实施期一定走偏。

## 2026-09-12 TER：逐轴几何推导必须穿过生产组件

纯函数里的 `scaleX ≠ scaleY` 用例不能证明组件从 host/canvas 推导逐轴比例是正确的；
如果组件 fixture 只使用等比宿主，交换或复制一条轴的公式也可能全绿。最低可执行约束是：

- 在真实生产装配的组件级测试中使用宽高比不同的 host 与 canvas；
- 选择靠近门槛、且一个轴在正确公式下越界而错误公式下落界内的点；
- 暂时执行轴公式复制的坏变异，必须使该组件级断言真实变红，再恢复并复跑。

这条是 `coordinateSpaceOf` 的已确认失败模式，适用于所有把测量值转换为业务坐标/阈值的
组件入口；下游纯函数测试只能作为概念补充，不能替代生产推导点的反例。

相关:[[practices.failure-condition-names-the-wrong-shape]] ·
[[practices.collection-boundary-modes]] · [[pitfalls.claim-versus-behavior]] ·
[[practices.cache-invalidation-granularity]]
