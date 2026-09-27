---
id: practices.third-party-library-official-source-verification
status: active
layer: routed
taskKinds: ["design","implementation","review","testing"]
domains: ["backend","contract","platform","admin-ui"]
consumerFaces: ["all"]
owners: ["all"]
impacts: ["architecture","evidence"]
triggers: ["task-start","implementation","review","failure"]
assertions: ["THIRD_PARTY_BEHAVIOR_REQUIRES_VERSIONED_OFFICIAL_SOURCE"]
sourceRefs: ["doc/platform/third-party-library-usage-standard.md"]
---

# 第三方库行为必须有版本匹配的官方依据

当正确性依赖第三方 API 或运行行为时，读取
[`doc/platform/third-party-library-usage-standard.md`](../../doc/platform/third-party-library-usage-standard.md)。
本 memory 只作路由，不复制核验规则；详设、实施计划与证明要求以该规范为准。
