---
title: 销售菜单目标选择契约源演进记录
status: IMPLEMENTATION_SOURCE_DRIFT_RECORDED
decisionOwner: Dexter
---

# 销售菜单目标选择契约源演进记录

```text
DECISION_KIND=V2S_IMPLEMENTATION_SOURCE_DRIFT
JOURNEY_ID=R5-SM-TARGET-SELECTION-AVAILABILITY
IMPLEMENTATION_AUTHORITY=true
PRODUCT_SCOPE_CHANGE=false
HERITAGE_RUNTIME_FALLBACK=false
```

本记录说明本 Journey 已授权的契约源演进，不改变产品、Journey、权限、operation 或 owner 范围，也不回写任何 Heritage 仓库。原有 R5 edge materializer 对 `contracts/openapi-source/sales-menu.schemas.json` 做 hash-bound 校验；本批为实现已接受的销售 SKU/选项目标选择、细粒度人工状态与 operation target readback，必须在该唯一 source 中新增对应字段与类型。

| source | 演进前 hash | 当前 hash | 允许的原因 |
|---|---|---|---|
| `contracts/openapi-source/sales-menu.schemas.json` | `8e5736fa84d8a13c58fdba035578d6d52b364fbb79e9e9ffa9805e6ca106f39c` | `12d9232526ff1ebdc9579ee01fd30b38c2d892e14bae8f4b98f5b14c033ff6fe` | 本 Journey 已授权的契约字段/枚举/请求/readback 演进 |

允许的修改仅限当前 Journey 已接受的 `orderOptionSelections`、selected/catalog option readback、SKU candidate/stale readback、manual target/status、operation target identity、publication blocker 与 published immutable image snapshot 字段。此次图片补充把 `INHERIT_CATALOG` 的有序 Catalog 图片集合一并读回并冻结，主图字段继续保留为列表兼容字段；详情使用同一发布集合提供缩略图切换，不回读当前 Catalog。生成链仍必须由 `scripts/generate/r5-edge-materialize.mjs` 与 `scripts/generate/edge-codegen.mjs` 执行；不得手改 materialized/generated 文件，不得以旧契约或 runtime/build fallback 止血。

本次图片集合演进的 source hash 对账如下：

| source | 演进前 hash | 当前 hash | 允许的原因 |
|---|---|---|---|
| `contracts/openapi-source/sales-menu.schemas.json` | `12d9232526ff1ebdc9579ee01fd30b38c2d892e14bae8f4b98f5b14c033ff6fe` | `2769fd4b29de76452b9617b7b8d75eaf6e54cbd762a04517cbfca685d297591e` | 详情必须完整查看已发布时冻结的 Catalog 图片集合；不新增 operation、owner 或产品语义 |

本记录不代表生成、编译、测试、DEV、reset/reseed、backend acceptance、browser L2 或 UAT 已完成；这些仍按 implementation plan 的 CP 顺序分别取得证据。
