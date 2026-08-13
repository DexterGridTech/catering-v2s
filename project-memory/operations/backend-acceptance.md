---
id: operations.backend-acceptance
status: active
layer: routed
taskKinds: ["backend-acceptance","design","implementation","testing","review"]
domains: ["backend","contract","platform"]
consumerFaces: ["all"]
owners: ["backend","contract","platform","product"]
impacts: ["database","contract","evidence","runtime","cleanup","governance"]
triggers: ["task-start","implementation","review","failure","runtime"]
assertions: ["BACKEND_ACCEPTANCE_ONE_REAL_OPERATION","BACKEND_ACCEPTANCE_TODO_SHELLS_RETAINED","BACKEND_ACCEPTANCE_OLD_CONTROLS_RETIRED"]
sourceRefs: ["scripts/README.md"]
---
# Backend acceptance

- `BACKEND_ACCEPTANCE_ONE_REAL_OPERATION`: 当前仅 `getPublicInvitationView`；必须以真实容器和 HTTP、手写 fixture/request/业务真值断言输出 `CONTRACT` 与 `BUSINESS`，另打印不设门的 DB 调用数。
- `BACKEND_ACCEPTANCE_TODO_SHELLS_RETAINED`: 197 个 provider 与 scenario registry 是待办目录，196 个只是自指字符串，均不是 scenario 实现或 coverage；保留不动，后续逐条按当前真实场景扩充。
- `BACKEND_ACCEPTANCE_OLD_CONTROLS_RETIRED`: PERFORMANCE/CLEANUP verdict、accepted-baseline、known-uncovered、自动精确分母、lane/并行/心跳/work-stealing、calibration 和 correctnessCases 均不再运行或作为准入。
