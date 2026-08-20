---
id: pitfalls.denominator-inherited-not-built
status: active
layer: routed
taskKinds: ["review","design"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["evidence"]
triggers: ["review","implementation"]
assertions: ["DENOMINATOR_MUST_BE_SELF_BUILT"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 分母从上游继承,却按全集的语气下结论

- **失败模式**:接手上游报告列出的对象清单直接分析,从未问「一共有多少」,
  然后用「三类」「七个对象」这样的措辞下结论,读者会以为那是全集。
- **根因**:继承清单等于继承它的盲区,而下游所有处置、批次、判据都建在那个盲区上。
- **适用边界**:任何以「有哪些」开头的分析。**反例**:上游清单本身附了枚举方法与全集规模时可以直接用。
- **最小解**:先写**枚举方法**,再给**全集分母**,再用判据切出必做子集,最后说明其余为什么不做。

```text
❌  「裸 string 有三类:字典 kind、problem code、testId」     ← 来自上游报告

✅  「枚举方法:按字面量形态分桶,再对每桶用『谁必须达成一致』切跨界子集。
      实测八桶,最大的一类是 JSON 字段名(455 个不同值 / 381 个跨界 / 生成物只覆盖 77
      ⇒ 304 个无编译器保护),而它原版完全未识别。」
```

- **判别式**:这一节写完,能回答「**一共有多少**」吗?答不上来 ⇒ 结论不能下。

## OpenAPI 根文件与 paths 分片的收集边界

- **失败模式**：把 `contracts/openapi/paths` 分片目录当成 OpenAPI 响应形状的完整入口，
  用它计算根级数组或列表候选，随后把漏掉的 catalog-inventory operation 当成“不存在”。
- **根因**：catalog-inventory 的响应 schema 需要从自己的合并根文件解引用；只遍历 paths 分片
  不能解析该根文件中的本地 schema 关系，机械候选因此出现假阴性。
- **适用边界**：任何跨 OpenAPI root、path shard、外部 `$ref` 的分母盘点。它只纠正收集边界，
  不自动把根级数组判为分页，也不替代数据流与业务形态判断。
- **最小解**：先枚举全部相关根文件，再递归解引用 path item 与 schema 的外部/本地 `$ref`，
  用 operationId 去重后保存完整成员清单、扫描口径和反向差集；paths 分片只能作为交叉校验。
- **反例**：只扫 paths 目录得到“catalog-inventory 没有根级数组”的结论；应改为同时扫描
  `edge.openapi.json` 与 `catalog-inventory.openapi.json` 后再取交。
