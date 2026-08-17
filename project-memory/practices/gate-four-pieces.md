---
id: practices.gate-four-pieces
status: active
layer: routed
taskKinds: ["testing","implementation","review"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["evidence"]
triggers: ["implementation","review","failure"]
assertions: ["GATE_REQUIRES_FOUR_PIECES"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 一道门要成立,必须齐四件套

缺任何一件,这道门只是**看起来在守**。

1. **不变量**:一句话说清它保证什么。说不清 ⇒ 它守的其实是「格式」不是「行为」。
2. **红夹具**:在 scratchpad 拷贝上做变异,**真跑一次,真看到红**。
   自测 PASS 不算数,「我认为它会红」不算数。
3. **负控制**:一个**合法**的写法,门必须**放行**。缺这一条,门可能是「凡是提交都红」。
4. **反例栏**:写出一个「门会放行、但其实是错的」的例子。
   写不出来 ⇒ 说明你还不知道这道门的边界在哪。

```text
❌  门:检查 XxxService.java 里出现字符串 "@Transactional"
    → 不变量说不清(出现 ≠ 加在了那个方法上)
    → 反例:把 @Transactional 加在一个私有方法上,门放行,行为完全没变
    这是「存在性判据」,见 pitfalls.green-by-existence-check

✅  门:对每个 public 写方法,解析注解位置,断言其自身或其调用链入口带 @Transactional
    不变量:所有对外写入口都在事务内
    红夹具:摘掉某个入口的注解 → 真跑 → 真红
    负控制:一个继承自基类事务的方法 → 放行
    反例:通过反射/动态代理进入的路径不在分母内 —— 已知未覆盖,登记在案
```

**做红夹具的两个坑**:
- 变异必须落在门的**分母之内**。改一个门根本不扫的文件,红不了,不代表门失效。
- 用**拷贝—恢复法**:先拷到 scratchpad,在拷贝上变异,验完即弃,仓内零写入。

- **判别式**:这道门红的时候,能不能只靠改注释、改命名把它弄绿?能 ⇒ 它守的不是行为。
