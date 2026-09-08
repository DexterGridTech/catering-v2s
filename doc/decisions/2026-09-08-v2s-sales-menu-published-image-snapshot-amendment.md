---
title: 销售菜单发布态商品图片快照补充
status: IMPLEMENTATION_AUTHORIZED
decisionOwner: Dexter
---

# 销售菜单发布态商品图片快照补充

```text
DECISION_KIND=V2S_IMPLEMENTATION_SOURCE_DRIFT
JOURNEY_ID=R5-SM-TARGET-SELECTION-AVAILABILITY
IMPLEMENTATION_AUTHORITY=true
PRODUCT_SCOPE_CHANGE=false
```

## 决策

当销售菜单商品使用 `INHERIT_CATALOG` 时，发布事务把发布时 Catalog 的有效主图片引用冻结到 `sales_menu.sales_version_item.published_primary_image_asset_ref`。发布态列表和详情只读取这个发布快照，不回读当前 Catalog；旧发布版本没有该快照时保持 `null`，不做回填。`CUSTOM` 图片仍沿用既有发布菜单媒体快照。

发布读取的图片引用必须参与 Catalog/资产 owner 的全局生命周期判断，并与 Catalog 变更使用同一 assetRef 事务锁，避免发布快照建立与图片释放之间出现竞态。L2 fixture 必须通过受管 HTTP 真实绑定一个 PNG 到 Catalog，并在前台列表和详情对真实 `<img>` 的加载结果做断言；占位错误态或仅存在 testId 不构成图片证据。

本补充只修复既有销售菜单图片展示与发布快照闭包，不改变 Journey、权限、operation、owner 或环境拓扑，也不授权 reset、seed、UAT 或部署。
