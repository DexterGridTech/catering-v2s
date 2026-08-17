---
id: pitfalls.check-repo-before-authoring
status: active
layer: routed
taskKinds: ["design","review","implementation"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["governance","memory"]
triggers: ["task-start","implementation","review"]
assertions: ["CHECK_EXISTING_BEFORE_AUTHORING","RECHECK_AT_IMPLEMENTATION_TIME"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 动手写新规则、新方案、新裁决之前,没查仓内有没有

- **失败模式**:凭「我知道这件事该怎么办」直接写下新规范/新方案/新裁决,
  而仓内已有权威记录,于是造出第二个真相源,甚至推翻了既有裁决。
- **根因**:「我知道该怎么办」与「这件事仓内已经办过」是两件事,前者成立不代表后者不成立。
- **适用边界**:写规范条目、设计方案、裁决之前。**反例**:确属全新领域且五处都查过后可以新写。
- **最小解**:动笔前检索**五处** —— `project-memory/`(**含 pitfalls**)· `doc/decisions/`
  · 两份 coding standard · `HANDOFF.md` · `doc/review/platform/`。
  查到已有的 ⇒ **改那一处或指过去,不得新写一份**。

```text
❌  写详设时要求「恢复业务标识的格式与长度校验」
    ← 而 project-memory/pitfalls/ 里有一条 active 记录明令禁止臆造该格式,
      doc/decisions/ 里当天还有一份 ACTIVE 裁决写着「不强制大写、不限制字符」

✅  动笔前问:这件事如果有人已经想过,他会写在哪?
    列出候选位置并逐一检索;写不出候选位置说明对仓内结构不熟,先查再写。
```

- **关键时序**:**裁决会在你写文档的过程中新增**。按「写之前查一次」的节奏必然漏掉写作期间新增的
  ⇒ **实施那一刻要再查一次**,这是唯一能兜住的机制。
- **判别式**:我搜过了吗?搜的是五处还是一处?⛔ 「我搜过了没有」本身是否定式全称命题,见
  `pitfalls.negative-universal-claim`。
