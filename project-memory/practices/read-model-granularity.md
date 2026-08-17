---
id: practices.read-model-granularity
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["backend","admin-ui","contract","platform"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["architecture","contract"]
triggers: ["implementation","review"]
assertions: ["READ_MODEL_BY_TASK_FACT_CLOSURE"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 该复用现有读模型,还是新建一个

**触发时刻**:要给一个新页面/新区域取数据,不确定是复用已有接口还是新建。

## 判据(按顺序问)

1. **先列出这次交互的消费者**,以及每个消费者**实际读到哪几个字段** ——
   不是「它调了哪个接口」,是「它用了什么」。
2. 若 A 要 `X.M`、B 要 `X.N`,且二者在**同一 scope、授权、生命周期、新鲜度**下
   都需要同一个稳定实体 `X` ⇒ **可以有一个完整而有界的 `X` task read 共同服务它们**。
3. 若 C 需要**不同的关系闭集、不同授权、或独立的 loading/恢复** ⇒
   它**不是** A/B 的同一个读模型。只能复用已有恰当 task read,或按**业务任务**命名新建一个。

⛔ **不按每个屏幕/组件另造接口。** 接口按可复用的业务读模型定义,不按 UI 结构定义。

## 三个反例

```text
❌ 借用大读模型当批量查询
   列表页只要 {itemRef, itemName, skuName, materialRole, categoryDisplayName} 五个字段,
   却调用商品工作台的完整 read model,触发全部关联事实装配。
   ⚠️ 「我已经批量调用了」不是理由 —— **批量 ≠ 读得对**。
   它是把详情读模型误当成了批量查询。
✅ 由 owner 提供一个有界的 typed task read,只返回那五类展示事实,
   在 owner 内去重并以 scope 谓词过滤。

❌ 首屏预装懒加载区
   详情接口固定返回「当前区 + 变化区 + 引用区 + 完整流水」,
   而界面初始只展开当前区,其余三区各自还有独立 query 且以展开状态延迟请求。
   ⇒ 打开就读用户没打开的区;展开时又读一遍同一份事实。
✅ 首屏读模型收窄到当前区真实字段;每个懒加载区保留自己的 typed task read。
   ⛔ 也不要反过来把六个区合成一个 mega endpoint。

❌ 父组件已有的数据,子组件各自再订阅一遍
   工作台常驻某 manifest,而五个抽屉用**相同 scope/brand** 各自独立订阅。
✅ 父级已有 ⇒ prop 下传;只有独立挂载时才自行查询。
```

- **判别式**:这个消费者真正**用到**的字段闭集,和我要复用的那个读模型返回的,是同一个吗?
  不是 ⇒ 我在用一个更大的东西冒充一个更小的需求。
