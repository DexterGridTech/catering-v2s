---
id: practices.cross-boundary-string-agreement
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["contract","backend","admin-ui"]
consumerFaces: ["all"]
owners: ["contract","backend","frontend-platform"]
impacts: ["contract"]
triggers: ["implementation","review"]
assertions: ["BARE_STRING_CLASSIFIED_BY_AGREEMENT"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 裸 string 该不该收进契约,判据是「谁必须达成一致」

**常见错判**:按「谁在用它」分类 —— 前后台都出现的就收,只在一边的就不收。
这会漏掉大量真正危险的字面量。

**正确判据**:**这个字面量写错了,谁会不一致?**
答案跨越了模块/进程/语言边界 ⇒ 它是契约,需要单一来源与编译期保护。

```text
❌  分类:「前端用的 → UI 常量;后台用的 → 后台常量」
    → JSON 字段名两边都在用,却因为「各自都有常量」被判为已覆盖;
      实际两边常量的**值**没有任何机制保证相等

✅  分类:「写错了谁不一致?」
    · 字段名写错 → 后台发的和前端读的对不上   ⇒ 跨界,必须由生成物统一
    · 错误码写错 → 前端分支走不到             ⇒ 跨界,必须收
    · 日志前缀写错 → 只是日志难看             ⇒ 不跨界,不收
    · 测试 id 写错 → 测试红                   ⇒ 测试内部一致即可,不进产物契约
```

- **配套要求**:分类之前先**自建分母** —— 按字面量形态分桶,数出每桶多少个、
  其中多少跨界、生成物覆盖了多少。没有分母的分类结论不能下,
  见 `pitfalls.denominator-inherited-not-built`。
- **判别式**:我在问「谁在用」还是在问「谁必须一致」?前者会漏。
