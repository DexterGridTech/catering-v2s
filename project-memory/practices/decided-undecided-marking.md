---
id: practices.decided-undecided-marking
status: active
layer: routed
taskKinds: ["design","review"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["governance"]
triggers: ["review","implementation"]
assertions: ["DOC_STATE_IS_THREE_VALUED"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 设计文档里每一项只有三种状态,没有第四种

| 标注 | 含义 | 实施者该做什么 |
|---|---|---|
| `[已定]` | 结论确定,细节足以照做 | 照做 |
| `[未定]` | 尚未裁决 | **停下来问**,不得自行发挥 |
| `[已定·本轮不执行]` | 结论确定,但不在本批次 | 不做,也不要以为它没想过 |

**没有第四种。** 一句没有标注的描述,读者无从知道它是要求、是背景、还是随手写的想法。

```text
❌  「弹窗的表单校验应保持与列表页一致。」
    → 是要求?是现状描述?一致是指哪些方面?实施者只能猜

✅  [已定] 弹窗表单在提交前执行必填校验;必填项为 name、code。
    [未定] 是否复用列表页的长度上限 —— 需裁决,裁决前保持无长度限制。
    [已定·本轮不执行] 跨字段联动校验推迟到下一批。
```

- **判别式(唯一标准)**:**读完这一条,两个不同的人做出来的东西一样吗?**
  不一样 ⇒ 不够格标 `[已定]`,要么写细,要么降级为 `[未定]`。
- 「方向正确」不是合格标准。详设的合格标准是**收敛到唯一实现**。
