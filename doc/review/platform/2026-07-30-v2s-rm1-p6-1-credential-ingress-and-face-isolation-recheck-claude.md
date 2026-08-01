---
title: RM1 P6-1 credential ingress 与双后台 session face isolation 整改实现复审（Claude）
reviewTarget: IMPLEMENTATION
scope: RM1-P6-1 credential-ingress / face-isolation 整改 current bytes、package exit、focused proof 与受管测试产物
verdict: GO
findings: M=0 / S=1 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅审查本 P6-1 整改的静态源码、证据与既有受管测试产物；不授权 DEV、seed、reset、Roadmap 状态变更或其他 P6 单元实施
createdAt: 2026-07-30
---

# P6-1 credential ingress 与 face isolation 整改复审

## 0. 结论

**GO**，`M=0 / S=1 / N=2`。

上一轮我提的两条（恢复流 cookie 以裸 `String` 进 controller、两个 session resolver 的
package/path 不能证明 face-local 隔离）**均真实关闭，且关闭方式比我建议的更完整**——
不是只给恢复流补一个 resolver，而是把**五类浏览器凭证全部收敛为 typed opaque credential**，
并把 package/path 一致性升级为覆盖全仓的机器门。Dexter 点名的五项核验**逐项通过**，
其中 398 / 11 两个分母我独立复算与声明**完全一致**。

`S1` 是我本轮独立发现的**新**问题，不在原 finding 之列：编译期 face 隔离对
"共享 hub 把两个 face 的 owner credential 分发给每个 controller"这条新路径**尚无规则覆盖**。
当前**无任何违例**（每个 accessor 恰好一个调用点且 face 正确），故不阻塞，但应在 P6-2 前补上。

> **会话出处披露**：来件给出的仓根 `/Users/dexter/…/catering-v2s` 在本会话**不存在**；
> 本复审在 `/Volumes/idea/catering-v2s` 上进行（见 `N2`）。fresh v2s-rooted 只读会话，
> 仓库零写入（本文件除外）。

---

## 1. 五项核验逐项结论

### ① credential ingress —— `CONFIRMED`

**`@CookieValue` 全量归零**：`src/main` = **0**，`src/test` = **0**（全量 grep）。

恢复流/授予凭证现在只经 `EdgeRequestContextArgumentResolver` 变为 typed opaque credential。
五类凭证的实现形状**一致且正确**：

| 类型 | owning source | 形状 |
| --- | --- | --- |
| `PlatformSessionCookie` | `edge/platform/session/` | `private final String value`；`private` 构造器；`static fromCookie`；`String rawValue()` **包私有**；`toString()` → `[redacted]` |
| `OperationsSessionCookie` | `edge/operations/session/` | 同形 |
| `PasswordRecoveryFlowCredential` | `PlatformAuthenticationService:502-508` | 同形，`fromEdgeCookie` |
| `RecoveryFlowCredential` | `WorkspacePasswordRecoveryService:184-190` | 同形 |
| `RecoveryGrantCredential` | `WorkspacePasswordRecoveryService:192-198` | 同形 |

- **不进日志**：五类 `toString()` 全部覆写为 `[redacted]`，字符串插值无法泄漏原值。
- **不进 wire**：`edge/generated` 与 `contracts/openapi` 中无任何 credential 类型的 schema 落点
  （契约里的 `platformSessionCookie` 命中是 OpenAPI `securityScheme` 名，非字段）。
- **原值只有 owner 可读**：`rawValue()` 全部包私有；platform 恢复流的原值只在
  `PlatformAuthenticationService:120/:134/:152` 被读取。
- **缺失 cookie 仍反枚举**：wrapper 恒被构造（内含 null），owner 侧
  `requireRecoveryFlow:367` 以 `hash(rawToken == null ? "" : rawToken)` 查询，无行匹配即
  `RecoveryFlowInvalidException` → 401 `PLATFORM_IAM_INVALID_CREDENTIALS`。
  **无 NPE，且与"凭证无效"同一响应**，来件承诺的"反枚举不变"得到保持。

### ② face-local package 与双向红变异 —— `CONFIRMED`

package 声明与目录**各自 face-local 且一致**（上一轮这两个文件是全仓唯一的 2 处不一致）：

```
edge/platform/session/PlatformSessionResolver.java     declares …app.edge.platform.session    == dir
edge/operations/session/OperationsSessionResolver.java declares …app.edge.operations.session  == dir
```

`BackendModuleBoundariesTest` 有**双向**规则（`:84-91`）：
`PLATFORM_EDGE_DOES_NOT_DEPEND_ON_OPERATIONS_SESSION`、
`OPERATIONS_EDGE_DOES_NOT_DEPEND_ON_PLATFORM_SESSION`。

**红变异是真的**（`:145-158`）：两个专门 fixture
`PlatformDependsOnOperationsSessionFixture` / `OperationsDependsOnPlatformSessionFixture`
（各持有对方 face 的 `*SessionResolver` 字段），测试 `assertThrows` 后
**逐个断言失败消息含该 fixture 名**——不是只断言"抛了异常"。

### ③ code-layout 覆盖 398 文件 / 11 root —— `CONFIRMED`（独立复算一致）

`tools/code-layout/cli.mjs:103-110` 以 `/src/main/java/` 为标记做
`JAVA_PACKAGE_PATH_MISMATCH` 判定，并有红夹具（`:287-290`）。

**我自己走了一遍全仓**（排除 `build`/`node_modules`）：

| 项 | 我的复算 | 声明 |
| --- | --- | --- |
| production java 文件（`src/main/java` 下） | **398** | 398 |
| `src/main/java` root 数 | **11** | 11 |
| package/path 不一致 | **0** | 0 |

`scripts/check/code-layout` 实跑 `CODE_LAYOUT=PASS`。

### ④ package exit exact-set 与 receipt —— `CONFIRMED`

`rm1p6-cp-u14-…-package-exit.json`：

```
actualChangedPaths 32  ==  incrementalChecks 32   exact-set: True
acp-only: []   inc-only: []
afterSha256 与当前字节不符: 0（逐条复算）
business: PASS      cleanup: PASS
```

### ⑤ 动态证据三个 task —— `CONFIRMED`（回指 run-manifest 权威）

`dynamicEvidence` 三条，`currentSourceHashes` 逐条复算 **0 不符**；
且三个 task 各自能在 `.runtime/r5/.../run-manifest.json` 找到
`business.status=PASS` 且 `cleanup.status=PASS` 的受管运行：

| task | run | BUSINESS | CLEANUP |
| --- | --- | --- | --- |
| `:apps:backend:catering-business-server:test` | `r5-tc-1785373690163-36061` | PASS | PASS |
| `…:modules:platform-admin-iam:test` | `r5-tc-1785374449592-50269` | PASS | PASS |
| `…:modules:workspace-iam:test` | `r5-tc-1785374537917-52041` | PASS | PASS |

两个 owner module 的运行**时间上晚于** deployable 运行，与 round-1
"两个 owner module suite 未执行"的关闭说法一致；同目录仍保留若干
`BUSINESS=FAIL` 的历史运行，**未被删除或改写**，这是诚实的。

`focused-proof.log` 末段亦与之自洽：`REMOTE_BUSINESS=PASS`、`REMOTE_CLEANUP=PASS`、
`REMOTE_REAPED=true`、`REMOTE_LOG_INSPECTION=READ:14`、
`REMOTE_STALL_DIAGNOSIS=PASS`（log plateau 被诊断后正常采集），
以及 `architecture.BackendModuleBoundariesTest:15/0/0` 等六个 focused 报告。

---

## 2. S1 ｜共享 hub 把两个 face 的 owner credential 分发给每个 controller，而编译期规则未覆盖这条路径 —— `CONFIRMED`

**owning source**

- `edge/session/EdgeRequestContext.java`：同时 `import` 了
  `edge.platform.session.PlatformSessionCookie`、`edge.operations.session.OperationsSessionCookie`、
  `platform.iam.application.…PasswordRecoveryFlowCredential`、
  `workspace.iam.application.…RecoveryFlowCredential`、`…RecoveryGrantCredential`，
  且**七个 accessor 全部 `public`**。
- `EdgeRequestContextArgumentResolver:33-41`：**每个请求无条件构造全部七项**，不区分路由所属 face。
- `BackendModuleBoundariesTest`：跨 face 规则只有两条，作用域是
  `..app.edge.platform.. → ..app.edge.operations.session..` 与
  `..app.edge.operations.. → ..app.edge.platform.session..`。
  **没有**任何规则限制 `..app.edge.platform.. → workspace.iam..`
  或 `..app.edge.operations.. → platform.iam..`；`edge.session` 本身也不在两条规则的 `that()` 范围内。

**反例检验（编译期可达路径）**：`PlatformAuthenticationController` 拿到的
`EdgeRequestContext` 上，`operationsRecoveryGrant()` / `operationsRecoveryFlow()` /
`operationsSessionCookie()` 都是 public 且已被填充。它**无法读出原值**
（`rawValue()` 包私有于 owner 模块），但**可以把该 opaque 凭证转交给
`WorkspacePasswordRecoveryService`**——而该服务正是接受它的。
两条新 ArchUnit 规则都不会拒绝这段代码，因为凭证类型位于 owner 模块而非
`..app.edge.operations.session..`。

**适用边界（当前不是违例）**：我枚举了五个 accessor 的**全部**调用点，
每个恰好一个，且 face 全部正确：

```
platformSessionCookie      → platform/session/PlatformSessionResolver.java
operationsSessionCookie    → operations/session/OperationsSessionResolver.java
platformRecoveryFlow       → platform/session/PlatformAuthenticationController.java
operationsRecoveryFlow     → publicentry/passwordrecovery/OperationsPasswordRecoveryController.java
operationsRecoveryGrant    → publicentry/passwordrecovery/OperationsPasswordRecoveryController.java
```

**没有任何现存跨 face 使用**（`platform/` 下 0 处调用 `operations*`，反向亦 0）。

**严重性理由（为何 S 而非 M）**：本次整改的目标之一是"编译期隔离"。
ingress 收敛已完全达成，edge session 包的双向隔离已由真实红变异证明；
残留的是**新引入的 hub 分发路径**没有对应规则。无现存违例、无运行时影响，
但"编译期不可达"这一性质对这条路径**尚不成立**，而它恰好是本次改动创造出来的。

**最小修复（二选一，均为追加）**

- **(a) 推荐**：补两条 ArchUnit 规则——
  `noClasses().that().resideInAPackage("..app.edge.platform..").should().dependOnClassesThat().resideInAPackage("..workspace.iam..")`
  与其镜像（`..app.edge.operations..` → `..platform.iam..`），
  并各配一个与现有两条同形的红 fixture（断言消息含 fixture 名）。
  注意 `publicentry..` 需按现状显式豁免或单列，因为公开恢复 controller 合法依赖 `workspace.iam`。
- (b) 把 `EdgeRequestContext` 拆成两个 face-specific 视图接口
  （platform controller 只能注入含 platform 三项的视图），resolver 按 handler 所属 face 选择实现。
  更彻底但改动面大于 (a)。

---

## 3. N（观察项，不阻塞）

**N1 ｜resolver 无条件构造全部七项凭证，包括与该路由无关的 face**

`EdgeRequestContextArgumentResolver:33-41` 对**每个**请求都读取五个 cookie 并包装，
公开未认证路由（如平台登录、公开邀请）同样会被填入 operations 恢复流/授予凭证。
凭证是 opaque 且 `toString()` 已 redacted，**不构成泄漏**；
但它把 `S1` 的可达面从"需要写跨 face 代码"扩大到"默认就在手边"。
按 handler 所属 face 条件填充（未命中的 face 传 `null` wrapper 或不传）可同时缩小 `S1`。

**N2 ｜来件仓根与本会话仓根不一致（出处披露）**

来件指定 `/Users/dexter/Documents/workspace/idea/catering-v2s`，
该路径在本会话**不存在**；本复审的全部读取、grep、复算与门实跑都发生在
`/Volumes/idea/catering-v2s`。两者若不是同一工作树，本结论**不适用于**前者。
按仓内约定，交接材料不应使用本机绝对路径，建议后续以仓根相对路径描述。

---

## 4. 处置

`M=0 / S=1 / N=2` → **GO**（仅限本 P6-1 整改的静态源码与证据）。

- **无需 Dexter 产品裁决**。`S1` 是追加两条 ArchUnit 规则 + 两个红 fixture；
  `N1` 是 resolver 按 face 条件填充；`N2` 是出处表述。
- **建议 `S1` 在 P6-2 开工前闭合**：P6-2 会新增大量 platform controller，
  届时"两个 face 的 credential 都在 `EdgeRequestContext` 上且无规则拦"的面会显著变大。
  它不阻塞本次 P6-1 的 GO，因为当前零违例且五项核验全过。
- **本轮不开第三轮内部审查**；本文件是外部复核，
  round-2 的最终轮结论与 `POST_REMEDIATION` 边界保持不变。
- 已验证为真的部分**不得回退**：`@CookieValue` 归零、五类 typed opaque credential
  （包私有 `rawValue()` + redacted `toString()` + 不进 wire）、缺失 cookie 的反枚举等价响应、
  两个 resolver 的 face-local package、双向 ArchUnit 红变异、
  code-layout 的 398/11 exact-set、package exit 32==32、三个 task 的 BUSINESS/CLEANUP PASS。

**本复核不授权**：DEV、seed、reset、Roadmap 状态变更、其他 P6 单元实施，
或任何契约/生成物修改与仓库控制操作。
