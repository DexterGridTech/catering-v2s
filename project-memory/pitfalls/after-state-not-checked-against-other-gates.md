---
id: pitfalls.after-state-not-checked-against-other-gates
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["all"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["governance"]
triggers: ["implementation","review"]
assertions: ["AFTER_STATE_MUST_CLEAR_ALL_GATES"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 规定 AFTER 状态,只验证它能过目标那道门

- **失败模式**:变更指令写出一个目标形态,并验证过「它能让我要修的那道门变绿」,
  但**没验证它能不能过其余适用的门**。
- **根因**:一个改动要**同时**满足所有适用约束,而注意力全在自己盯的那一道上。
  **「它解决了我的问题」和「它没制造新问题」是两件不同的验证。**
- **最小解**:写 AFTER 之前,列出该文件/该类改动**适用的全部门**,逐一验证 AFTER 能过。

```text
❌  工单:「这 4 行 `import static X.*;` 改成普通嵌套类导入」
    已验证:改完 capability-invariants 会变绿(在 scratchpad 上真跑过)
    没验证:那 4 行改完是 124–133 字节,撞 backendJavaUtf8LineLimit 的 120 字节门,
           而 **Java import 不能换行** ⇒ 这个目标形态**物理上无法满足**
    实施方按字面执行,白改一轮才发现。

✅  写 AFTER 之前先问:这次改动会碰哪些门?
      · 目标门(capability-invariants)
      · 行长门(backendJavaUtf8LineLimit,120 字节)
      · 格式门(spotlessCheck)
      · 编译
    逐一对 AFTER 求值 ⇒ 发现新增 import 必然超长 ⇒ 换成
    **不新增 import、改用外层类限定名**(外层类已被普通 import,
    解析器的 `imports.get(segments[0])` 正好命中;用法行 89–98 字节,过门)。
```

⚠️ **正确的解法往往就藏在这次检查里**:上例中「不新增 import」比原方案更好 ——
少 4 行、不撞门、且走的是解析器设计的正路。**不是妥协,是原方案没想周全。**

- **与「问题族分母」同形**:那条讲「用户点名的文件只是入口,要扫同族」;
  这条讲「你盯的那道门只是入口,要扫同批适用的门」。**都是只看了盯着的那一个。**

- **判别式**:我验证的是「它解决了我的问题」,还是「它同时满足所有约束」?
  只做了前者 ⇒ 这个 AFTER 还不能写进工单。

相关:[[claim-versus-behavior]] —— 那条讲判行为要打开路径,这条讲判可行性要跑全部门。
