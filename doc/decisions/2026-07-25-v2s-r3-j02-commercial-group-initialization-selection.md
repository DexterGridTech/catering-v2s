---
title: catering-v2s R3-J02 商业集团显式初始化入口裁决
status: active
createdAt: 2026-07-25
programContext: V2S_W0_W4_EXECUTION
decisionOwner: Dexter
implementationAuthority: false
---

# R3-J02：为既有集团空间显式初始化商业集团

## 1. Dexter 裁决

Dexter 已接受下列 R3 最小真实 Journey：平台管理员为一个**既有、已启用、尚未初始化商业集团**的集团空间，单独输入商业集团编码和名称，显式初始化唯一商业集团根，并读回结果。

```text
JOURNEY_ID=R3-J02
JOURNEY_STATUS=DEXTER_ACCEPTED_FOR_DESIGN
IMPLEMENTATION_AUTHORITY=false
```

该裁决替代旧的 `R3-J01`“按已知 workspaceKey 查询登记状态”候选。J01 保留为历史设计和证据，不得修改、复用为本 cycle 证据，亦不得作为实现入口。

## 2. 已裁决边界

- 空集团空间是合法长期状态；初始化前不推导商业集团存在。
- 初始化成功后每个集团空间恰有一个商业集团；重复初始化必须拒绝 `COMMERCIAL_GROUP_ALREADY_INITIALIZED`。
- 商业集团编码、名称由用户独立录入，不得复制、回写或借用集团空间名称、集团空间编码。
- 本 Journey 不创建大区、项目、门店、账号、任职或角色；也不定义解绑、替换或重建行为。
- 运营后台本切片仅证明独立登录/session；不虚构组织页或业务操作。

## 3. 设计与授权边界

本文件只确认产品 Journey，配合 `2026-07-24-v2s-r3-specialized-design-authorization.md` 允许重新形成 implementation-facing design、manifest、Codex 对抗审查和 Claude handoff。它不授权 application、contract、migration、测试、动态运行、DEV、seed/reset、数据库或 Git 写入。

## 4. 根据

- `project-memory/decisions/confirmed-business-language-corpus.md` 的 G-01：集团空间与商业集团分离，显式初始化且字段独立；
- `../catering-all-v2/doc/review/platform/2026-07-15-four-domain-journey-design/d01-s05-initialize-commercial-group.md`：已批准的 D01-S05 用户路径与失败恢复；
- `../catering-all-v2/doc/specs/platform/modules/commercial-group-root.md`：唯一性、幂等、owner、权限与 readback 边界。

