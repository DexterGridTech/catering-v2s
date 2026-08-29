---
id: pitfalls.negative-universal-claim
status: active
layer: routed
taskKinds: ["review","design","implementation"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["evidence"]
triggers: ["review","implementation","failure"]
assertions: ["NEGATIVE_CLAIM_REQUIRES_EXHAUSTION"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 否定式全称命题必须穷举后才能写

- **失败模式**:写下「全仓无 X」「无人使用 X」「零消费者」,依据只是一种写法的检索没有命中。
- **根因**:证明「存在」只需一个实例,证明「不存在」要穷举。检索是抽样,不是穷举。
- **适用边界**:一切「不存在 / 零 / 无人」型断言。**反例**:给出穷举范围与多种写法后的否定结论有效。
- **最小解**:换 2–3 种写法、做去换行归一、检查上下游层,并**写出穷举范围**。

```text
❌  grep 'ON CONFLICT (a,b) DO NOTHING'  → 0 命中 → 「全仓无此写法」
    真实源码:  "... ON CONFLICT "  +  "(a,b) DO NOTHING"     ← 跨两个字面量,单行匹配看不见

✅  去掉换行与 `" + "` 后再匹配;并写明:
    「在 apps/ scripts/ libraries/ contracts/ 下的 *.java *.sql *.mjs(排除 build/)中穷举」
```

## 「换几种写法」不够 —— 要换的是**机制的实现形态**

最贵的一次假阴性不是拼写差异,是**只搜了机制的一种实现形态**。

```text
❌  判断「这三个服务有没有并发保护」⇒ grep 辅助类名 AdvisoryLock ⇒ 命中 0
    ⇒ 写下「既无锁也无 ON CONFLICT」
    真实情况:三者都在 SELECT 之前内联调用 pg_advisory_xact_lock,不经过那个辅助类。
    保护完整,结论完全反了。

✅  先列出「这个机制在本仓可能有几种落地形态」:
      · 走共享辅助类           → 搜类名
      · 内联 SQL 直接调        → 搜 pg_advisory
      · 唯一约束 + 返回值判权   → 搜 ON CONFLICT
    三种都搜过,才允许说「没有保护」。
```

⚠️ **最讽刺的自检**:同一份 `practices.insert-as-claim-ownership` 里,我自己写着
「本仓两种机制并存」,却只按其中一种的**实现形态**去搜。
**知道有多种机制,不等于搜的时候会想起来。**

- **判别式**:我写的是「不存在 X」吗?穷举范围写出来了吗?
  **我搜的是「机制」还是「机制的某一种写法」?**

## 变体（2026-08 TER 分析）：把「存在测试代码」读成「行为已被验证」

- **失败模式**：默认"仓内 129 个 spec 是绿的"，据此说"某能力已由测试验证"。
  实测发现该仓所有依赖 mock server 的 live 测试**因原生模块 Node 版本不匹配根本跑不起来**。
- **判别式（补充）**：我说的是"**存在覆盖该行为的测试代码**"，
  还是"**该行为已被验证通过**"？后者需要**本轮真实跑过**，不能由前者推出。
