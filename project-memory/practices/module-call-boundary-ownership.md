---
id: practices.module-call-boundary-ownership
status: active
layer: routed
taskKinds: ["design", "implementation", "review"]
domains: ["backend", "platform", "contract"]
consumerFaces: ["operations-admin", "platform-admin"]
owners: ["backend", "platform", "contract"]
impacts: ["architecture", "database", "evidence"]
triggers: ["task-start", "implementation", "review"]
assertions: ["REQUEST_BOUNDARY_HAS_ONE_OWNER", "MODULE_ATTRIBUTION_IS_STRUCTURAL", "WRITE_TRANSACTION_OWNS_ITS_READBACK", "PER_ITEM_BOUNDARY_IS_A_SEMANTIC_CHOICE"]
sourceRefs: ["doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-implementation-design-codex.md", "doc/plans/platform/2026-08-22-v2s-backend-performance-remediation-requirements-claude.md", "doc/review/platform/2026-08-22-v2s-backend-performance-root-cause-analysis-claude.md"]
---
# 后台模块调用边界的所有权

**这一份管「模块之间怎么调、边界归谁」,不管性能数字。**
性能只是发现这些缺陷的手段 —— 2026-08-22 的整改里,真正坏掉的不是某段算法,
是**每个请求里若干边界没有明确的所有者**。

上位规则在 kernel,本文不复述:
`MODULE_OWNER_SOVEREIGNTY` / `COORDINATOR_NO_ASSET`(`kernel.service-owner`)、
`COMMAND_REQUIRED_TRANSACTION` / `TASK_READ_JOIN`(`kernel.transaction-data`)。
⛔ 跨 schema 读的允许范围以 kernel 的 `TASK_READ_JOIN` 为准,**不在本文另立一条**。

## 规则

- `REQUEST_BOUNDARY_HAS_ONE_OWNER`:一次请求里的连接边界与事务边界都必须有明确归属的持有者。
  写路径天然有(命令事务持有一个连接);**只读任务路径同样需要一个显式的只读作用域持有者**,
  否则每条语句各借一次连接,而没有任何一层为此负责。
  判别式:打开该路径,说得出「这个连接由谁在哪一层取得、到哪一层释放」——说不出就是没有所有者。
  2026-08-22 实测:100 个 GET 中 57 个每请求借连接超过 1.5 次,
  `getOperationsCatalogItem` 借 27.7 次而语句只有 29 条;
  同期 67 个写操作平均 3.35 次,因为写在事务里持有一个连接。
  反例边界:需要观察未提交写入的读不是任务读,不适用本条。

- `MODULE_ATTRIBUTION_IS_STRUCTURAL`:一条语句属于哪个模块,必须由**结构**决定,不由调用点标注决定。
  在层入口归属,层内语句自动继承;新增查询不改任何标注代码仍归类正确 —— 这是**性质判据,不是计数指标**。
  反证已经有了:仓内 56 个逐点标注仍留下 45% 语句无法归属,
  因为任何写在作用域之外的语句都会静默落进未分类。
  ⛔ 必须保留负控制:未进入任何已知层的语句**继续保持未分类**,
  不得为了让比例达标而把默认值改成某个模块 —— 那是把「不知道」伪装成「知道」。

- `WRITE_TRANSACTION_OWNS_ITS_READBACK`:命令事务必须能从自己刚写入的事实投影出 readback,
  不得在同一事务内把读侧整条管线重跑一遍。
  这条与既有的 `REUSE_SCOPED_PROJECTION_WITHIN_REQUEST`(`practices.reuse-projection-within-request`)
  是同一族:那条管「读过的不要再读」,本条管「**写过的不要再查**」——
  2026-08-22 之前只有前半条,于是 `saveOperationsCatalogItem` 的 128 次数据库操作里
  约 62 次是保存完成后从零重查一遍完整详情,恰好等于把读接口内嵌执行了一次。
  ⛔ readback 仍必须是 owner 的真实事实投影,不得退化成把请求原样回显。

- `PER_ITEM_BOUNDARY_IS_A_SEMANTIC_CHOICE`:批量命令里「一个事务还是每项一个事务」是**业务语义裁决**,
  不是性能选项,定了就不许为压计数反向改动。
  Dexter 2026-08-22 裁定批量流转采用「逐项尽力 + 明确报告每项结果」,
  因此事务数与连接数随批量线性增长是**正确形态**;
  可以优化的是循环之前的准备读(一次批量载入),不是边界本身。
  两条配套义务:预载只是准备事实,**每项仍须在自己的事务内重新锁定并复核 scope、版本与状态**;
  以及既然选了逐项尽力,就必须逐项报告结果,
  「逐项尽力却不报告逐项结果」是两种合理设计里最差的组合。
