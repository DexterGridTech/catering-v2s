---
id: practices.reuse-projection-within-request
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["backend","platform"]
consumerFaces: ["backend"]
owners: ["backend"]
impacts: ["architecture","database"]
triggers: ["implementation","review"]
assertions: ["REUSE_SCOPED_PROJECTION_WITHIN_REQUEST"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 同一请求内已读到的对象要复用

**触发时刻**:一次请求里,先读了一个对象做 scope 判定,后面 mapper 又需要它的别的字段。

## 规则

**同一请求中已经取到、并且完成了 scope 判定的 owner projection,后续需要其余字段时直接复用它。**
⛔ 不要因为「第一次只用了一列」就再造一个窄查询。

```text
❌ 同请求双读
   controller 先读 store projection 完成 scope 判定,
   随后 mapper 又读同一个 projection 取 project/brand/tenant 引用 —— 而第一个对象里本来就有。

❌ 「先详情再补一次查询」
   初始化流程先读一个含 join 的完整详情,实际只用其中 enabled/key/id 三个字段,
   然后又按 key/id 查一次拿 UUID。

✅ 把第一次读到的对象传给 mapper;
   或由 owner 提供一个单行的初始化上下文 {uuid, key, id, status},一次读完。
   ⚠️ 两种改法都**不改变** command 的授权与重核验。
```

## 已知 no-op 时的边界(容易改过头)

```text
✅ 允许:preflight 已由 owner 证明闭包为空 ⇒ 不调用 execute、不伪造 mutation/readback。
   前提是 owner 用 typed 字段(如 `actionable`)声明该结论,
   且合并摘要/响应里的参与方集合由同一事实推导。

❌ 不允许:跳过 preflight 本身。
   preflight 要读私有事实才能得出「空」这个结论 —— 跳过它就没有依据了。
   ⛔ 也不得用局部 if 绕过契约,那会让预检与执行不一致。
```

- **判别式**:这次查询要的字段,**在本请求里已经读到过吗**?
  读过 ⇒ 复用;没读过再查。
- **反向判别式**:我想跳过的这一步,**是产生结论的那一步,还是使用结论的那一步**?
  产生结论的那一步不能跳。
