# 商品库 owner 投影语法首败诊断

`SKILL_USED=cs-systematic-debugging@808fc5717aa88ad65efff312b11c186294d3e6ee301afb584e2f86599b137787`

- `FIRST_FAILURE=CatalogOwnerService.java:attributeSummary.addAll missing closing parenthesis`
- `LAST_KNOWN_GOOD=preparationSummary.addAll sibling at the same projection boundary`
- `BROKEN_BOUNDARY=CatalogOwnerService list summary construction`
- `BUSINESS=NOT_RUN_STATIC_SOURCE_FIX_ONLY`
- `CLEANUP=NOT_APPLICABLE_STATIC_SOURCE_FIX_ONLY`

## 假设与有限分母

假设：RCP-01 的 list projection 编辑中，一个嵌套 `addAll(businessLineArray(...))` 少闭合一层；同根分母是同一方法中的两个 `addAll(businessLineArray(...))` 调用，而不是整个 owner 文件。

`rg attributeSummary.addAll|preparationSummary.addAll` 得到两个 sibling：attribute 行缺少 addAll 的右括号，preparation 行为工作反例且闭合正确。故障不是业务字段或 owner 语义缺失，也不需要改动 contract/read model。

## 最小修复与防再犯

将 attribute sibling 补为与 preparation sibling 同构的四层闭合调用。适用的预防目的地是 RCP-06 fresh static code review 的 owner projection sibling scan；后续 compile gate 会对该 Java 语法进行机械验证。本次尚未运行 compile，因此不声称通过。
