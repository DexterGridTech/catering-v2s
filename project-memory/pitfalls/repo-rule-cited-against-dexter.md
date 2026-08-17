---
id: pitfalls.repo-rule-cited-against-dexter
status: active
layer: routed
taskKinds: ["review","design","implementation"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["governance","session"]
triggers: ["review","implementation","status-question"]
assertions: ["REPO_RULES_GOVERN_UNATTENDED_EXECUTION"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 不得拿仓内规矩去拒绝或推迟 Dexter 在对话里的直接要求

- **失败模式**:Dexter 在对话中要求做某件事,agent 引用一条仓内规矩说「规矩不允许」,
  于是拒绝、推迟,或把它当成需要他先豁免的前置条件。
- **根因**:仓内绝大多数流程规矩,防的是 **agent 无人看管地自动执行**时的失控 ——
  无限循环、无授权推进、拿低档证据冒充高档。
  **Dexter 在对话里是逐轮看结果的**,那些失控风险不成立,规矩的前提因此不成立。
- **最小解**:照做。如果确有代价,**说出代价再照做**,而不是用规矩挡回去。

```text
❌  Dexter:「你再来一轮盲审吧。」
    agent:「仓内规矩是对抗审查两轮硬上限,所以不能再派第三轮,我按 SELF_DECIDED 收口。」
    —— 那条上限防的是「agent 自己无限循环评审」。现在是他本人在逐轮看结果并要求继续,
       风险根本不存在。用它挡回去,等于把防失控的护栏当成了禁止令。

✅  agent:「好。第三轮我会换攻击面,因为前两轮的面已经用尽 —— 这轮攻『这份文档还能不能用』。」
    ⇒ 照做,并说明这一轮和前两轮的差别在哪。
```

## 反例:这三类不因对话而放松

**判别式**:**这条规矩防的是「无人看管时失控」,还是「这件事本身就是错的」?**

| 规矩防的是 | 对话中是否适用 |
|---|---|
| 无人看管时失控(轮次上限、批次边界、自动推进) | **不适用**,照做 |
| **错误本身**(不得拿编译冒充容器、不得把静态 PASS 说成业务 PASS) | **仍然适用** |
| **破坏性或不可逆**(reset / 删除 / 外部影响) | **仍然适用**,该确认还得确认 |
| **写入边界**(评审会话只写指定路径) | **仍然适用**,除非他明确另行授权 |

⇒ 证据档位不得冒充这类**不是流程规矩,是诚实性要求**,和有没有人看着无关。

- **判别式**:我引用这条规矩,是在防止一个**此刻并不存在**的风险吗?
  是 ⇒ 我在拿护栏当禁止令,照做。
