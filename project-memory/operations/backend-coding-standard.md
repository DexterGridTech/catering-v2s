---
id: operations.backend-coding-standard
title: 后台编码规范的唯一内容源在 doc/platform,别处只放指针
type: operation
status: active
layer: routed
scope: every backend implementation, review, and standards change
createdAt: 2026-08-16
taskKinds: ["implementation", "review", "design"]
domains: ["platform"]
consumerFaces: ["platform-admin", "operations-admin"]
owners: ["platform"]
impacts: ["governance"]
triggers: ["implementation", "review"]
assertions: ["BACKEND_STANDARD_SINGLE_SOURCE", "BACKEND_STANDARD_POINTERS_ONLY", "BACKEND_STANDARD_RULES_CARRY_COUNTEREXAMPLE"]
sourceRefs: ["doc/platform/backend-coding-standard.md"]
---

后台编码规范的**唯一内容源**是 `doc/platform/backend-coding-standard.md`。

**本条只是指针,不复述规则内容** —— 同一条规则写两处必然漂移。
要查后台该怎么写、哪些是门、门有没有生效,打开那份文件。

**三条不变量**:

1. **单一内容源** —— 新增或修改规则只改 `doc/platform/backend-coding-standard.md`;
   项目记忆、skill、评审文档一律只写"见该文件"。
2. **只放指针** —— 本条以及任何其他记忆条目都不得复制规则正文。
3. **每条规则自带反例** —— 判断不了对错的句子不进规范;
   规则由实例产生,写在修完之后。

**为什么建这条**:2026-08-14 沉淀的十类后台规范(1-A ~ 1-J)此前没有正本,
只散在三份日期命名的评审文档里,两套项目记忆均无条目。
后果是可测量的:格式规范(Spotless + palantir-java-format,判据「排除生成物后 >120 字符归零」)
定了之后无人执行,`spotless` 全仓零命中,超长行从基线 5207 涨到 7998。
**规范失效不是因为没写,是因为找不到。**
