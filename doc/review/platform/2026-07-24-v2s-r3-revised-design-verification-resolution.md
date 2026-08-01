---
title: catering-v2s R3 修订设计独立复核辩证处置
status: PARTIALLY_RESOLVED
createdAt: 2026-07-24
programContext: V2S_W0_W4_EXECUTION
reviewCycleId: R3-SPECIALIZED-DESIGN
reviewTarget: DESIGN
reviewRound: 2
reviewRoundLimit: 2
roundFinalDecision: SELF_DECIDED
implementationAuthority: false
---

# catering-v2s R3 修订设计独立复核辩证处置

本处置继续把 reviewer finding 当待验证假说，而不是裁决。每条意见重开 owning source，区分仓内事实、外部事实、产品决定与未来运行证据；同时检验 reviewer 建议本身是否会制造新模型、双实现或无证据的强断言。

```text
REVIEWED_DESIGN_SHA256=50f136d1c852b4ac974f8855bdb63fc04f07edc0a4cac3290593619f3bfc3ecd
REVIEWED_MANIFEST_SHA256=beb3a48ddcfafbad3b12c9d7d763ab9d510da516b5b6086904f8d10fa7c68932
RESOLVED_DESIGN_SHA256=37cf5824e19fbb2f2ed53e22535dc2c0c447c7dbd45403b4bc8f8c3d31b2ead5
```

## 处置矩阵

| Finding | 证据、反例与适用边界 | 处置 | 最小修订 | 残余 |
|---|---|---|---|---|
| `IR3-M-001` | reviewer 没有新增产品证据；exact lookup 仍只是当前成本最低的候选。 | `DEXTER_DECISION`，保持开放 | 不替 Dexter 接受 Journey。 | Dexter 需接受或改选。 |
| `IR3-M-002` | checker 缺失与授权白名单事实未变。 | `CONFIRMED`，保持开放 | 不越权新增、不绕 handoff gate。 | 需 Dexter 扩权。 |
| `R3-VERIFY-S-001` | HttpOnly refresh 入口已存在，但没有字段/失效语义就无法判断 app guard 是否真恢复。reviewer 若要求 role/capability 通用 scope 会扩张 R3。 | `CONFIRMED` | platform 仅 `principalId/displayName/expiresAt`；operations 再加 `workspaceId/workspaceKey`。missing/expired/revoked/cross-face 一致 `401`；network/5xx 不冒充 sign-out。 | schema 仍须 contract validator 与 L2 证明。 |
| `R3-VERIFY-S-002` | 两阶段 gate 已排除原循环，但“Dexter-owned baseline”确实不可机械执行。当前 dirty tree 不是反例，因为 Gate 0 尚未获 implementation 授权；真正缺的是未来 checkpoint 协议。 | `CONFIRMED` | readiness PASS 后硬停；Dexter 创建含 evidence 与空 inventory 的 immutable commit；Codex read-only 记录 full SHA；后继 target 必须由 `merge-base --is-ancestor` 证明 descendant。 | Git checkpoint 是外部串行关键段，Dexter 不发布则 NO-GO。 |
| `R3-VERIFY-S-003` | canonical origin/filter/OPTIONS 契约缺失成立；但 reviewer 建议把 missing Fetch Metadata 直接列负例并不普遍成立。OWASP 指南明确把 Origin/Referer 作为旧客户端缺少 `Sec-Fetch-*` 时的 fallback，W3C 也把 Fetch Metadata 定义为浏览器提供的附加请求上下文。 | `PARTIALLY_CONFIRMED` | server-managed per-face exact origin；固定 filter 顺序；unsafe request 必须 exact Origin，`Sec-Fetch-Site` 有则必须 same-origin、无则回退 Origin；无 CORS mapping/header；custom filter 与 framework CSRF 只保留一条实现线。 | 仍需批准浏览器矩阵的真实 spike/L2；失败时单线切 Spring token。 |
| `R3-VERIFY-N-001` | manifest 的旧计数/旧 feature 名是直接文本冲突。 | `CONFIRMED` | 改为 `eight-operation` 与 `workspace-registration-check`。 | 无。 |
| `R3-VERIFY-N-002` | 首轮输入文件当时未跟踪，只有 hash 与 reviewer 报告；现在无法证明任何“重建快照”与原 bytes 相同。 | `PARTIALLY_CONFIRMED_UNRECOVERABLE` | 不伪造历史 snapshot；保留旧 hash、reviewer 身份与 finding。以后 mutation 前必须保存 immutable snapshot 或 Git blob/commit 引用。 | 首轮旧 bytes 不能独立重算，作为非阻断 provenance debt 明示。 |
| `R3-DESIGN-N-003` | 版本仍是未来获授权 spike 的运行事实，设计不得把候选冒充验证。 | `CONFIRMED_OPEN` | 保持单一 decision 门，不建立兼容双线。 | 未来 spike。 |

## 一手资料边界

- Spring Framework 的 CORS 文档说明未匹配 CORS 配置时浏览器跨源请求不会获得许可；credentialed CORS 会扩大信任面，本 R3 无需开启：[Spring Framework CORS](https://docs.spring.io/spring-framework/reference/web/webmvc-cors.html)。
- Spring Security 把 CSRF token 与 SameSite 作为 browser forgery 防线；因此“custom filter 替代 token”必须是显式、可验证的唯一配置，而不能裸关：[Spring Security CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)。
- Fetch Metadata 提供请求来源上下文，但 OWASP 明确要求考虑不发送 `Sec-Fetch-*` 的旧客户端并以 Origin/Referer fallback，故不采纳“header 缺失一律拒绝”：[W3C Fetch Metadata](https://www.w3.org/TR/fetch-metadata/)，[OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)。

## 拒绝的过度修复

- 不给 current-session 增加 role/capability/通用 scope 模型；
- 不新增 checkpoint service、可信时间服务或由 Codex 代做 Git commit；
- 不同时实现 custom origin defense 与 Spring CSRF token；
- 不把 `Sec-Fetch-Site` 缺失等同恶意请求；
- 不事后拼接“旧文件”冒充首轮原始 bytes；
- 不因技术修订完成而替 Dexter 接受产品入口或 checker 扩权。

## 当前结论

三个 S 已通过最小设计修订收敛；旧 bytes provenance debt 与版本 spike 继续明示。真正阻断正式 handoff/implementation 的仍是：

1. Dexter 对 `R3-J01` 的产品决定；
2. Dexter 对缺失 `implementation-design-granularity` checker 的写入扩权；
3. 后续获 implementation 授权时，Dexter 接受并履行 Gate 0 checkpoint 串行协议。

本 resolution 不授权任何 R3/W1 implementation、checker、runtime、数据库、动态 evidence 或 Git 写操作。

本 `R3-SPECIALIZED-DESIGN / DESIGN` cycle 至此完成两轮并硬停止；Codex 必须自行维持上述 verdict，不再启动第三轮 Codex 对抗审查。

## 后续权限事实变化

两轮结束后，Dexter 明确澄清：完成当前交付所必需的仓内控制面 checker 属于 Codex 自主维护权，不需要逐文件再次授权。Codex 因此直接实现 `scripts/check/implementation-design-granularity` 与 supporting production validator/self-test/red fixtures；production、design-hash drift、missing business evidence、severity-count mismatch、round-three 与 missing finding-unit link 均真实 PASS。

该新事实把上表 `IR3-M-002` 从 `CONFIRMED_OPEN` 更新为 `CONFIRMED_RESOLVED_BY_CODEX_CONTROL_PLANE_RIGHT`。这不是第三轮对抗审查，也不改变其它 finding：当前唯一 M 仍是 `IR3-M-001 / R3-J01` 产品入口待 Dexter 接受；业务 implementation、runtime、数据库与 Git 仍未授权。
