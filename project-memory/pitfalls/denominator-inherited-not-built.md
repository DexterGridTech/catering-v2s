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
