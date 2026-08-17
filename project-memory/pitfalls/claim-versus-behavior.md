---
id: pitfalls.claim-versus-behavior
status: active
layer: routed
taskKinds: ["review","implementation","testing"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["evidence"]
triggers: ["review","implementation","failure"]
assertions: ["CLAIM_IS_NOT_BEHAVIOR"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 拿声称当行为

- **失败模式**:据注释、字段名、类型名、契约声明、文档自述或测试方法名下行为结论。
- **根因**:这些全部是**声称**。声称与行为由不同的东西保证,编译器不检查注释。
- **适用边界**:一切行为判断。**反例**:被测试或门实际覆盖的声称,可以按其覆盖范围采信。
- **最小解**:打开真实的读写路径看。

```java
❌  /** Idempotent: duplicate requests are safely ignored. */
    void save(...) { jdbc.update("INSERT ... ON CONFLICT DO NOTHING", ...); }
    //                            ↑ 返回值被丢弃 ⇒ 第二次执行的业务写已经发生,只是回执没存。
    //                              注释说的 "safely ignored" 不成立。

✅  int claimed = jdbc.update("INSERT ... ON CONFLICT DO NOTHING", ...);
    if (claimed == 1) return null;      // 本事务拿到执行权
    return readExisting(...);            // 否则读别人已落定的结果
```

- **重要推论**:同一个 `ON CONFLICT DO NOTHING`,**用返回值判所有权是安全的,丢弃返回值是缺陷**。
  按关键字一刀切会同时改错两边。
- **判别式**:我的依据是「它写着 X」还是「我打开读写路径看到 X」?
