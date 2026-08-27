---
id: pitfalls.criterion-degraded-into-list
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["governance","contract"]
triggers: ["task-start","implementation","review"]
assertions: ["CRITERION_NOT_CLOSED_LIST"]
sourceRefs: ["doc/plans/platform/2026-08-27-v2s-base-1-requirements-claude.md"]
---

# 把可判规则写成闭集清单

- **失败模式**:本该是一条判据("该事实是否依赖本次响应之外的数据"),被写成"以下十一类必须保留"的清单。
- **为什么危险**:清单**只在正向可靠**。执行者会**反读**成"清单外的都可以删" —— 而清单一旦漏项,反读就直接造成删错。实测该十一类清单外同族至少还有 `accountCount`、`roleCount`、库存的 `entryCount` 一族、复制预检的四个计数器、`bomLineCount`,**其中多个在契约里是 `required`**。
- **它比"只留计数不留清单"更隐蔽**:那一条(见 `count-without-member-list`)说的是"要留清单";本条说的是**清单不能替代判据**。两条互补,不可互相顶替。
- **判据**:写完清单后问一句 —— **清单外新出现一个同族成员,读者能不能只靠这份文字判定它该留还是该删?** 不能 ⇒ 缺判据。
- **最小解**:判据在前、清单在后,并显式标注"已知实例、非穷尽",以及"⛔ 不得反读成清单外皆可删"。清单只用来举例与对账,不用来授权删除。
