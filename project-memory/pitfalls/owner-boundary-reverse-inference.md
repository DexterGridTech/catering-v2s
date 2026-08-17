---
id: pitfalls.owner-boundary-reverse-inference
status: active
layer: routed
taskKinds: ["design","review","implementation"]
domains: ["admin-ui","platform"]
consumerFaces: ["operations-admin","platform-admin"]
owners: ["product","frontend-platform"]
impacts: ["architecture"]
triggers: ["review","implementation"]
assertions: ["UI_TASK_NOT_INFERRED_FROM_OWNER"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 从 owner 边界反推用户任务

- **失败模式**:因为某个功能的数据属于另一个 owner,就判定「它不该出现在这个界面」,
  据此删掉一个用户功能。
- **根因**:owner 划分是**实现事实**,用户不感知。用它反推用户任务,
  等于把我们的模块划分外化成用户的操作成本。
- **适用边界**:一切 UI 归属判断。**反例**:owner 边界决定**命令与事实**去哪,那一层不能合并。
- **最小解**:先问「用户在这个页面做的是一件事吗」。是 ⇒ 保留,后台归谁是实现细节。
  **界面按用户任务聚合,但不合并 owner 事实或命令。**

```text
❌  「这个 tab 的数据来自另一个 owner ⇒ 它是类型重载 ⇒ 该删」
    ← 删掉的是一个用户每天都在用的功能,理由只是领域纯洁性

✅  「用户在这个弹窗里维护商品所需的全部元数据,不管它归哪个 owner。
      界面按用户任务聚合;目录字典仍走 catalog owner,处理标签仍走 fulfillment owner。」
```

- **判别式**:我的论据里出现「它属于另一个 owner / 另一张表 / 另一个接口」了吗?
  出现了 ⇒ 我在用实现反推需求。
