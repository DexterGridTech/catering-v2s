---
id: pitfalls.platform-detail-reverse-inference
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["backend","contract","platform"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["architecture","contract"]
triggers: ["task-start","review"]
assertions: ["PLATFORM_DETAIL_STAYS_IN_ADAPTER"]
sourceRefs: ["doc/review/platform/2026-08-18-v2s-external-collaboration-and-business-channel-spec-claude.md"]
---

# 读了外部平台文档之后,拿平台细节去反推主程序模型

**触发时刻**:刚读完某个外部平台(美团、饿了么…)的接口文档或它的 mock,
准备说主程序"应该怎么做"或"和平台对不上"。

## 两次实例,同一个形状

**① 2026-08-18(已写进规格 §5.6 的 ❌ 反例)**
读了美团文档后,提议**主程序按「跳转 + 回调」实现解绑**。

**② 2026-08-20(同一个人,同一个坑,换了个说法)**
读了 all-v1 的 mock,发现**美团没有 ISV 可调的解绑接口**,于是断言
「v2s §5.6 的第一段是主程序发起解绑请求,**两者对不上**」,并把它列成待 Dexter 裁决的问题。

⚠️ **第二种形式更隐蔽**:它没有提议任何代码,只是"提出一个矛盾" ——
但它的效果一样,是把平台细节拉进主程序的模型讨论,并要求产品所有者为平台细节做裁决。

## 根因

**把「我知道了平台怎么做」和「主程序需要知道平台怎么做」混为一谈。**

适配器边界存在的全部意义,就是让后者为假。
⇒ **读得越多,越容易越界** —— 这是知识带来的风险,不是知识不足带来的。

## 正解(以解绑为例)

主程序只做:申请解绑 · 记 `unbindRequestedAt` · 进入解绑中。
适配器按平台规则决定返回 ① 已完成 / ② 需用户自行操作(**不透明载荷**)/ ③ 失败。
主程序把载荷**原样展示**,不解析、不拼 URL、不算签名。

`unbindKind=REQUIRES_ADAPTER_UNBIND` 告诉主程序的是
「**不能本地直接删、可能要等**」,**不是**「要跳转到平台」。
主程序知道**要不要等**,不知道**为什么等**。

## How to apply

1. 写下任何一句关于外部平台的话之前,先问:
   **主程序如果照这句话做了,它是不是就必须认识某个平台的规则?** 是 ⇒ 已越界。
2. "平台 X 没有接口 Y,所以我们的模型有问题" —— **这句话本身就是越界**。
   平台有没有 Y 决定的是**适配器返回哪一支**,不决定主程序的协议。
3. 外部平台的机制差异**只允许**表现为:适配器返回值的分支 · 不透明载荷的内容 ·
   `unbindKind`/`authenticationKind` 这类**已定枚举**的取值。
   ⛔ 不允许表现为:主程序新增分支、新增字段、新增状态,或一次产品裁决。
4. 确实需要 Dexter 裁的,是**产品语义**(用户看到什么、能不能撤销),
   ⛔ 不是「美团到底有没有某接口」。

**判别式**:我这个问题,换成另一个外部平台还成立吗?
只对某一个平台成立 ⇒ 它是适配器的事,不该拿来问主程序。

相关:[[pitfalls.owner-boundary-reverse-inference]](不能用 owner 划分反推用户任务)·
[[pitfalls.designing-from-conversation-not-system]] · [[pitfalls.claim-versus-behavior]]
