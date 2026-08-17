---
id: practices.metadata-classified-by-attachment
status: active
layer: routed
taskKinds: ["design","review","implementation"]
domains: ["backend","admin-ui","platform"]
consumerFaces: ["operations-admin"]
owners: ["product","backend"]
impacts: ["architecture","database"]
triggers: ["review","implementation"]
assertions: ["METADATA_CLASSIFIED_BY_ATTACHMENT"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 元数据还是实例数据,看它挂在谁身上

**判据**:

- 只挂在**租户/工作区**这一级、被众多实例引用、自身不指向任何一个具体实体
  ⇒ **元数据**(字典、标签、单位、分类、枚举值域)。
- 带着指向某个具体实体的外键、离开那个实体就没有意义
  ⇒ **那个实体自己的数据**,不是元数据。

```text
❌  把「某 SKU 的图片」「某商品的规格轴取值」和「计量单位字典」放在一起,
    然后问「元数据维护界面要不要管这些」
    → 前两者带着 sku_id / product_id 外键,是实例数据;
      只有第三个是元数据。这不是范围选择题,是定义题。

✅  元数据:计量单位、商品分类、处理标签、渠道类型 —— 挂在租户上,被 N 个商品引用
    实例数据:该商品的图片、该 SKU 的条码、该商品的规格取值 —— 挂在具体商品上
```

- **推论**:元数据通常**不需要排序**(它是值域不是列表),
  实例数据经常需要(它是用户看到的顺序)。要求给元数据加 `display_order` 之前,
  先确认它到底是不是元数据。
- **判别式**:去掉某一个具体实体,这条数据还有意义吗?有 ⇒ 元数据;没有 ⇒ 实例数据。
