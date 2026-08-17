---
id: practices.failure-condition-names-the-wrong-shape
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["backend","admin-ui","contract","platform"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["architecture","contract","database"]
triggers: ["implementation","review"]
assertions: ["FAILURE_CONDITION_NAMES_PROHIBITED_WRONG_SHAPE"]
sourceRefs: ["doc/platform/implementation-task-template.md"]
---

# 失败条件要点名错误形状

**触发时刻**：为设计 CP、测试或机械门写“失败条件”，并且要证明空实现、局部绕过或只保留旧形状不会假绿。

## 规则

失败条件应直接点名仍然存在的**错误读取、写入、契约或失效形状**，而不是只说“不能破坏既有行为”。这样不做改动、把字段留在宽读模型、继续逐元素读取、或继续用全局 cache tag 都会明确失败。

```text
❌ “修改后不影响库存详情。”
   空实现仍满足；它没有定义什么旧形状必须消失。

✅ “inventory page 的 item refs 已集合化后，仍逐行调用 Catalog owner，
   或 display read 返回完整 item detail facts。”
   空实现和只把 N 次调用换名字都失败。
```

## 边界

- 失败条件仍必须保留正确性约束：不能为了消除错误形状而删除 scope、授权、CAS、分页或 typed failure。
- 当真实目标是“必须存在一个具体值/配对约束”时，正向断言可以与禁止性断言配对；不要机械把所有规则改成纯文本禁止句。
- 该写法用于让设计和 focused proof 可证伪，不代替受管 HTTP、Testcontainers 或浏览器证据。

- **判别式**：把 proposed implementation 全部删掉后，这句失败条件会不会仍然失败？不会 ⇒ 它多半只是“未破坏”描述，不是可反驳的不变量。
