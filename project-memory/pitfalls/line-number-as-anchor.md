---
id: pitfalls.line-number-as-anchor
status: active
layer: routed
taskKinds: ["implementation","design"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["governance"]
triggers: ["implementation","failure"]
assertions: ["LOCATE_BY_ANCHOR_NOT_LINE"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 用行号指认一个自己即将移动的目标

- **失败模式**:变更指令用绝对行号定位,而同一批次里前面的步骤会改变文件长度。
- **根因**:行号是**位置**不是**身份**。删一行之后,后面所有行号的所指都变了。
- **适用边界**:任何多步骤的源码/迁移变更。**反例**:只读引用(评审举证)用行号可以,但要标日期。
- **最小解**:定位一律用**逐字锚点**或方法签名;行号只进括号作参考。

```text
❌  步骤 1: 删除第 12 行
    步骤 2: 删除第 72-74 行        ← 步骤 1 执行后全文上移,这里实际命中 73-75,
                                     而第 75 行是必须保留的活表 teardown

✅  步骤 1: 删除锚点 `'some_policy_name',` 所在整行
    步骤 2: 删除锚点 `ALTER TABLE x.y DISABLE ROW LEVEL SECURITY;` 所在整行
```

- **锚点自身的两个坑**:①**不要带前导空白**(源码缩进 11 空格,写 12 就零命中);
  ②锚点必须**在目标文件内唯一**,写之前数命中数。
- **判别式**:前一步执行完之后,后面几步的定位还指向同一个东西吗?
