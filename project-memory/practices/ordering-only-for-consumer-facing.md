---
id: practices.ordering-only-for-consumer-facing
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["backend","admin-ui","contract","platform"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["architecture","contract"]
triggers: ["task-start","implementation","review"]
assertions: ["ORDERING_ONLY_FOR_CONSUMER_FACING"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 这张表要不要排序字段

**触发时刻**:设计一个新实体,正准备加 `displayOrder` / `sortOrder` / `sequence`。

## 判据只有一条

**这个列表的读者是消费者,还是管理员?**

- **消费者** ⇒ 需要排序。他要按你安排的顺序**逐个看过去**,顺序本身是业务表达。
- **管理员** ⇒ **不设排序**。他的任务是「找到那一条」,靠搜索和筛选,不靠序号。

```text
❌ 给配置数据加排序
   渠道模板、渠道、门店绑定、对接配置、字典种类、各种 definition ——
   这些是管理员配置数据。加 displayOrder 等于加一整条链:
   维护它的界面动作(上移/下移/拖拽)· 并发重排语义 · 每次增删后的重排成本 ·
   以及一个没人会去调、却永远要一起读写的字段。
   ⚠️ 「以后可能想调顺序」不是理由 —— 那是为假设中的未来需求提前建复杂度。

✅ 配置列表按稳定业务键呈现
   编码、名称、创建时间。管理员找不到东西时,答案是搜索和筛选,不是让他去排序。
```

## 要排序的(不要顺手删)

菜单与菜单内的菜品 · 商品 SKU 的呈现次序 · 点单选项组与组内选项 ·
面向消费者的商品分类。

⛔ 判据始终是**谁在看**,不是**像不像配置**。SKU 看起来很像配置数据,
但它出现在消费者的点单页上,顺序影响消费者怎么选 —— 它要排序。

## 已落地的裁定

2026-08-18 Dexter 裁定:经营渠道需求规格删除 `BusinessChannelTemplate`、
`BusinessChannel`、`BusinessChannelBinding` 三处 `displayOrder`,
并同步删除 `FR-CH-03` 的「可改排序」与用例中的「各自排序」。

- **判别式**:我能说出**哪个消费者**会按这个顺序逐个看过去吗?
  说不出具体的人和场景 ⇒ 不加这个字段。
