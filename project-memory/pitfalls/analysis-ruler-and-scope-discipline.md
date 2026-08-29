---
id: pitfalls.analysis-ruler-and-scope-discipline
status: active
layer: routed
taskKinds: ["review","design","diagnostics"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["evidence","governance"]
triggers: ["review","task-start","failure"]
assertions: ["RULER_MUST_MATCH_SUBJECT_STAGE","VERIFY_ONLY_WHAT_CHANGES_THE_RECOMMENDATION","BATCH_EDIT_MUST_ASSERT_AND_READ_BACK"]
sourceRefs: ["doc/review/platform/2026-08-28-newposv1-package-analysis-claude/03-review-discipline-claude.md"]
---

# 分析前先选对尺子、只验证会改变结论的事实、批改必须自证

三条同源纪律，都由 2026-08 对 POC `newPOSv1` 的分析中真实发生的错误产生。

## `RULER_MUST_MATCH_SUBJECT_STAGE`：用产品阶段的尺子量 POC

- **失败模式**：把 charter §2-A（"这个抽象现在有几个实现？只有一个 ⇒ 不建"）
  直接套到 POC 上，于是把"**机制先于业务建好、用一个真实场景验证过**"读成过度设计。
  一次判错波及 23 条 finding 里的 19 条，全部要重新分档。
- **根因**：没有先问"被审对象处于什么阶段、它自己的成功判据是什么"。
- **Dexter 原话**：*POC = proof of concept，你有真实的业务场景，去验证它是否实际可行；
  至于是否从前到后全面贯通，POC 不是这个目的。*
- **判别式（每轮开工第一问）**：
  - **POC** ⇒ 判据是"**证明了什么 / 把什么留作未证**"，不是"是否已被多处采纳"；
  - **产品** ⇒ 才适用"抽象要有多个实现"、"不为想象中的未来付费"。
- **最小解**：finding 分档 —— `本质缺陷`（任何语境下都错，且让被审对象自己的结论不可信）/
  `产品化欠账`（该阶段合理，产品化前必补）/ `阶段残留`（合理产物，换形状即可）/ `设计取舍`。

## `VERIFY_ONLY_WHAT_CHANGES_THE_RECOMMENDATION`：不验证与结论无关的事实

- **失败模式**：为了"把信息掌握全"，去核实一些**无论结果如何都不改变建议**的事实，
  把对话拖进无关分支。两例：追查"某历史实现现在通不通"（而需求是**把它做通**）；
  追查"某历史仓的测试能不能跑"（而新工程**不带那套依赖**）。
- **Dexter 的类比**：*你现在是个小孩，你说"我以后不能当宇航员"，我说"你以后可以"，
  然后你现在就检查自己到底是否拥有航天飞机 —— 可不可笑？*
- **判别式（动手查之前问）**：**这个事实会改变我要给出的建议吗？** 不会 ⇒ 不查。
- **适用边界**：会改变建议的事实仍必须亲验；本条治的是"为验证而验证"，不是放宽亲验要求。

## `BATCH_EDIT_MUST_ASSERT_AND_READ_BACK`：批量改文件必须自证命中

- **失败模式**（同一轮内两次）：
  1. Python 双引号字符串里嵌套双引号 ⇒ **解析期就炸**，整个脚本一行没跑，
     而同一条命令里别的输出照样打印，看起来像成功；
  2. `str.replace` 目标不存在时**不报错** ⇒ 锚点有前导空格差异，静默没命中，回读才发现。
- **最小解（无条件执行）**：
  - 文档批改一律用**三引号**字符串（或外层单引号）；
  - 每个 replace 前 **`assert s.count(old) == 1`**；
  - 批量改完**必须回读校验**，不能以"脚本没报错"当成功。
- **判别式**：我的成功依据是「脚本 exit 0」还是「我回读到了改后的内容」？
