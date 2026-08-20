---
id: practices.collection-boundary-modes
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["backend","admin-ui","contract","platform"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["architecture","contract","database"]
triggers: ["task-start","implementation","review"]
assertions: ["COLLECTION_BOUNDARY_MODE_DECLARED_FIRST"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 我要做一个返回集合的接口

**触发时刻**:设计任何返回数组的接口 —— 列表页、候选下拉、详情里的子集合。

## 先判形态,再写实现

按顺序问三句,第一个命中的就是答案:

1. **库里是整体保存、业务上整体读取并原子替换的吗?** ⇒ **Detail 聚合**
2. **上界由源码固定吗?** ⇒ **Bounded**
3. **用户要跳到任意页吗?** 要 ⇒ **Page**;只需连续往后翻 ⇒ **Cursor**

形态决定义务,见 charter §1-J 表。⛔ 不允许「先按列表做出来再看」。

## 四个真实反例(都发生过)

```text
❌ 伪 cursor —— 最坏的一种
   契约的请求收 cursor、响应声明 cursor 与 total,owner 却把 request 整个丢弃,
   SQL 写死 LIMIT 100,返回 cursor=null、total=本页行数。
   ⇒ 调用方拿到 total:100 且 cursor:null,得出「一共 100 条、没有下一页」。
   真实成员可能几千。这不是缺控件,是**契约在撒谎**。
   ⛔ 修法不是删掉 cursor/total —— 那会把真实截断变成合法的未知上界。
   ✅ 让 owner 真消费 cursor/pageSize。

❌ 内存分页
   先 List<X> all 全量物化,再 Java 里 filter/sort/subList,以 all.size() 作 total。
   契约看起来有 page/pageSize,分页却发生在 SQL 之后。
   ✅ 过滤、计数、排序、分页全部在 SQL 侧完成。

❌ 顶替补丁(内存分页的并发症)
   选中项不在本页时,把本页最后一条替换掉。
   ⇒ 该页静默少一个成员。真 SQL 分页根本不需要这个补丁。

❌ 把整体聚合伪造成列表
   payload 里有 definitions[] 就给它加分页或人为上限。
   但它在库里是**单列存储**、被整体 replace + CAS 写回 —— 物理上分不了页。
   ✅ 判为 Detail 聚合。将来真要逐行浏览就**新开列表 operation**,不改造现有的。
```

## 三条不可让步

1. `total` 必须是**完整匹配集合**的 count,不是本页长度
2. 契约声明了 `cursor`/`pageSize`,owner 就**必须真消费**
3. 集合内部有数组 ≠ 该集合要分页 —— 看**它整体怎么被读写**,不看 payload 形状

## 测试要能证伪

⚠️ **fixture 必须造出超过单页的数据量。** 上面四类缺陷的共同点是
「数据量不过页时看起来完全正常」—— 不过页的场景必然假绿,等于没写。

断言至少覆盖:第二页可达 · cursor 能推进到末页 · **total 不等于本页长度** ·
翻页不重复不遗漏 · 跨 scope 不可见。

- **判别式**:我能说出这个集合**长到 1000 条时**会发生什么吗?
  说不出 ⇒ 形态还没定。
