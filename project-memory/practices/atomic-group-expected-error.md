---
id: practices.atomic-group-expected-error
status: active
layer: routed
taskKinds: ["design","implementation"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["governance"]
triggers: ["implementation"]
assertions: ["ATOMIC_GROUP_DECLARES_EXPECTED_ERROR"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 变更指令按「原子组」下发,并写出中途的预期报错原文

一组必须一起完成才编译得过的改动,**声明为一个原子组**,
并把「做到一半时会看到什么错」写进指令。

**为什么**:实施者中途看到红,默认反应是「我做错了,得想办法让它绿」——
于是发明兼容层、加 fallback、留旧方法。**红不是意外,是预期**,必须事先说。

```text
❌  步骤 1: 删除旧的 save(a, b) 重载
    步骤 2: 所有调用方改用 save(a, b, c)
    → 实施者做完步骤 1 编译红,于是保留旧重载并让它委托新方法 ——
      永久多出一个兼容层,而这恰恰是我们要删的东西

✅  【原子组 CP-XX-1】以下两步必须一次做完,中途不可交付:
      1. 删除 save(a, b) 重载
      2. 12 处调用方改用 save(a, b, c)
    预期中途报错(原文,看到它说明你在正轨上):
      error: method save in class Xxx cannot be applied to given types;
    ⛔ 看到该报错时**不得**保留旧重载、**不得**新增委托方法、**不得**加 @Deprecated 过渡。
```

- **配套**:预期报错原文必须是**真跑出来的**,不能照着编译器语法臆造。
  没跑过就写「预期报错见编译输出」,不要编一句像模像样的。
- **判别式**:这组改动里,做完第一步能编译过吗?不能 ⇒ 它是原子组,必须声明。
