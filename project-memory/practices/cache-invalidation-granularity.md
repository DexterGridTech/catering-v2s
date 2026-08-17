---
id: practices.cache-invalidation-granularity
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["admin-ui","contract","platform"]
consumerFaces: ["all"]
owners: ["frontend-platform","contract"]
impacts: ["architecture","contract"]
triggers: ["implementation","review"]
assertions: ["CACHE_TAG_EQUALS_AFFECTED_READ_MODEL"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 缓存失效的粒度与「唯一收口链」

**触发时刻**:写操作成功之后,界面怎么刷新。

## 两条规则

**一 · 缓存 tag 的粒度 = 真实受影响的读模型。**
key 至少包含:资源族 · data scope · brand ·(需要时)实体 ref。
子资源另加它自己的维度(周期 / 游标 / 展开区)。

**二 · 成功写入后的自动失效、手动刷新、命令回显,只能选一个明确的收口链。**
⛔ 不得并行叠加 —— 叠加之后没有人能解释「这次刷新是谁触发的」。

```text
❌ 全局失效
   生成器对每个查询都打上 {资源族, 具体 key} + {资源族, LIST},
   每个写操作又无条件失效同一个 LIST。
   ⇒ 一次保存会让同 app 所有活跃查询成为失效候选;
     它没有表达 scope、brand、实体,也表达不了子资源的周期或展开区。
   ⚠️ 名为「刷新当前页」的 helper,实际是全局失效 —— **名字比范围窄**。

✅ 声明式失效关系进生成器的唯一输入
   每个查询声明它属于哪个读模型 key;每个写操作只失效**真实受影响**的 key。
   该声明必须有 schema / exact-set 检查,生成器**拒绝未声明的新 operation**。
```

## 顺序不能颠倒

**先**把失效关系做进生成器输入并重生成、配红夹具,**再**删除成功回调里被精确失效覆盖的手动刷新。

⛔ 反过来做会出现一段无覆盖窗口。
⛔ 不得手改生成物;不得在业务代码里手写 tag;不得用「再刷新一次」修缓存。

## 不属于重复,不要一起删

用户显式发起的重试 · 网络不确定态的恢复 · 各懒加载区的按需刷新 ·
确实需要等完整详情回到编辑态的目标性刷新 —— **这些不是自动失效的重复。**

## 命令返回什么

command response 只回**命令完成后真正稳定、可用于界面状态收口的最小 readback**。
⛔ 它不能偷换成详情 payload,也不能代替下一次独立的详情读取。

- **判别式**:这次写入之后,**哪些读模型的内容真的变了**?
  答不出具体范围 ⇒ 说明 tag 的粒度不对,而不是「保险起见全刷一遍」。
