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
sourceRefs: ["doc/platform/foundation-charter.md","project-memory/pitfalls/line-number-as-anchor.md","tools/project-memory/cli.mjs"]
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

- **锚点自身的两个坑**:①普通源码定位时不要带前导空白(源码缩进 11 空格,写 12 就零命中);②锚点必须**在目标文件内唯一**,写之前数命中数。
- **精确行锚点例外**:`project-memory/required-inventory.json` 的 `assertionSources[].anchor` 不是普通搜索锚点;`scripts/memory/build-index` 用 `sourceText.split("\n").includes(anchor)` 校验,必须从 owning source 复制完整原行并保留其缩进。不要手工重写签名或只给行内片段;若 owning source 原行也被改动,必须在同一改动中更新该 assertionSources.anchor;提交前逐条确认所有 anchor 仍是源文件的完整原行。
- **sourceRefs 派生坑**:新增或删除 `assertionSources` 时,必须在 memory frontmatter 与 `required-inventory.json` 同步维护 `sourceRefs = sorted(unique(assertionSources[].path))`。只比较两份 `sourceRefs` 彼此相等不够,因为它们可能一起漏掉刚新增的门或测试来源。运行 `scripts/memory/build-index` 前先按该等式核验,再逐行核验所有精确 anchor。
- **判别式**:前一步执行完之后,后面几步的定位还指向同一个东西吗?
