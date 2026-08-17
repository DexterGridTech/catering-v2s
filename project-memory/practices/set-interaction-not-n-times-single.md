---
id: practices.set-interaction-not-n-times-single
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["backend","admin-ui","contract","platform"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["architecture","contract"]
triggers: ["implementation","review"]
assertions: ["SET_INTERACTION_NOT_N_TIMES_SINGLE"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 集合交互不得退化为 N 次单体操作

**触发时刻**:用户选了 N 个对象要一起做点什么(批量改分类、批量状态、复制闭包)。

## 规则

**集合交互不得退化为 `N × detail`、`N × owner read` 或 `N × JDBC`。**
批量读取与批量 command 必须保留**稳定输入顺序**,以及**首个业务错误的可观察语义**。

```text
❌ 前端拼装式批量
   选中 N 行 → N 次详情请求 → 用返回值拼 N 个完整保存体 → N 次保存。
   ⇒ 规模线性增长;读到的内容远超「设置分类」所需;每次保存还各自触发一轮缓存失效。

✅ 一个稳定的集合业务 command
   请求只含:data scope · 关系种类 · 目标关系 refs · 每项 {ref, expectedVersion}。
   owner 在同一批量任务内按输入顺序逐项重核验,只更新对应关系,
   返回逐项的成功 / typed failure / readback。
   ⛔ 不新增「批量抽屉详情」query,也不信任列表缓存去拼完整保存体。
```

## 闭包与前沿也算集合

```text
❌ 按每个 item 查一次目标、按每个 BOM 行查一次引用,写后再逐 item 查一遍泄漏
✅ 按前沿的 refs 一次批量加载;收集到的下一层 refs 复用已有的按集合查询;
   校验改成按集合的窄投影,在内存里按原顺序报告首个失败
```

## 三条不可为「次数下降」牺牲的

1. owner 命令事务内的**授权 / 状态 / CAS / 幂等重核验**、审计、真实 readback
2. **已经是 set-based 的实现不得重构回逐条查**
3. **Java 层过滤不能伪装成选择性查询** ——
   「读全 scope 再在内存里筛一个 target」不是批量优化,是把过滤挪到了错的地方

- **判别式**:选择数从 1 变成 100,请求数或查询数会跟着变成 100 倍吗?
  会 ⇒ 它是 `N × 单体`,需要一个集合形态。
