---
title: RM1 P6 implementation-facing 详设整改后复审（Claude）
reviewTarget: DESIGN
scope: RM1-P6 current bytes（physical screen import contracts、final UI surface roster、granularity manifest、recheck intake）
verdict: GO
findings: M=0 / S=0 / N=2
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅静态 implementation-facing design admission；不授权 implementation、契约/生产源码/测试修改、动态运行、DEV、seed/reset、Roadmap 状态或任何仓库控制操作
createdAt: 2026-07-29
---

# RM1 P6 implementation-facing 详设整改后复审

## 0. 结论

**GO**，`M=0 / S=0 / N=2`。**本 GO 仅代表静态 implementation-facing design admission。**

上一轮 `M=2 / S=3 / N=3` 共八条全部真实关闭，且关闭方式经本会话独立复算。
`M2` 选了我建议的非侵入方案（IA 为不可删除下界），**代价是把规则显式写进文件**——
这比逐行改值更强：它让 94 个 screen 的 import 分母在**不改任何已接受 IA 字节**的前提下变成可计算的集合。

| 上一轮 finding | 关闭情况（本会话复算） |
| --- | --- |
| **M1** 两个非 export 标识符 | **已闭合**：`overlayLock`/`observedBaseQuery` 在两份分母中**归零**；`useOverlayLock` 77 次、`createObservedBaseQuery` 6 次。对第三列全部 primitive token 取并集后逐个比对 `index.ts`，**非 export = 0** |
| **M2** IA/physical 原语漂移 | **已闭合**：`:18-24` 新增显式规则"required import set = `IA lower bound ∪ third-column additions`，可加不可删"；两处错误的密码结果 `NONE_WITH_REASON` 已撤回（现为 `useOverlayLock`）；`IA01-OPERATIONS-LOGIN` 的 `useAsyncGenerationGuard`/`useSubmissionLifecycle`、`IA01-USER-INVITATION-CREATE-DRAWER` 的 `adminDrawerSurfaceProps`/`contextScopedQueryArgs`、`IA04-HEAD-COMPANY-BRANDS` 的两项均已显式恢复 |
| **S1** 平台 shell 未绑定 | **已闭合**：`:32` 新增 `IA02-PLATFORM-AUTHENTICATED-SHELL → platform-admin/src/app/PlatformApp.tsx`，原语 `useOverlayLock, contextScopedQueryArgs`（等于 IA 下界），并显式写 `NOT_APPLICABLE_WITH_REASON: no PLATFORM-SHELL exists in the frozen 22-surface catalog denominator; this is required host chrome, not a 23rd catalog surface` |
| **S2** P6-1 前端根过宽 | **已闭合**：`RM1P6-U01.changeSurfaces` 两条前端路径收窄为 `apps/frontend/{platform-admin,operations-admin}/src/app/api/generated`，`target` 追加 "no UI path is permitted" |
| **S3** U03 判别式把合法行为写成应拒 | **已闭合**：改为 peer-REGION 反例 + same-REGION 正向对照，并直接引用 `target.ancestorIds`；U01/U02 判别式经复核不属同类误读 |
| **N1** roster 与 physical 路径不一致 | **已闭合**：`:67`/`:93` 已列三个具体 step 文件，与 physical `:21-23`/`:44` 一致 |
| **N2** "four remaining non-catalog" | **已闭合**：`:105` 改为 five |
| **N3** U01 D1 route 旁注 | 已在 intake 说明 |

**本会话独立复算清单（全部通过）**

| 项 | 结果 |
| --- | --- |
| 94 个 accepted IA screen 的 physical binding | **94/94，MISSING=0**，简写行全部可解析（`unresolved=0`） |
| 第三列 primitive token 对 `index.ts` | 9 个 distinct token，**非 export=0** |
| 5 份 IA 的 SHA-256 | **逐个复算与 roster `§1` 声明一致 → 已接受 IA 字节零改动**，与 intake 的"No accepted IA byte changed"相符 |
| manifest 4 处绑定 hash（design / roster / physical / authorization） | **4/4 复算一致**（roster 与 physical 已随整改更新为新值） |
| 22 surface / 25 pageDesignKey / 7 非 catalog | **22/22、25/25 全命中，7 保持不变** |
| granularity checker 实跑 | `PASS / UNITS=3 / VERDICT=NO_GO / REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` |
| 三步串行边界 | `dependencyAndSerialBoundaries` 未变；P6-2 需 P6-1 GO、P6-3 需 P6-2 GO 保持 |
| 未伪称复绿 | `CURRENT_BYTES_NOT_REVIEWED_BY_ADVERSARIAL_SUBAGENT=true`、`claudeRecheckRequired=true` 均保留 |

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。本轮未重开已用尽的独立子审查。

---

## 1. 六个核验重点的逐项结论

**① foundation primitive 可重开、旧名清零** —— `CONFIRMED`。
两份分母中 `overlayLock`/`observedBaseQuery` 各 0 次。我对 physical 第三列做了全量 token 提取
（去掉散文词后 9 个 distinct），逐个比对 `libraries/frontend/admin-ui-foundation/src/index.ts` 的 17 个 export，
**无一落空**。

**② IA 为不可删除下界、94/94 绑定、两个密码结果 Modal** —— `CONFIRMED`。
`:18-24` 的规则原文是可执行的集合定义，不是承诺：
"required import set is exactly `IA lower bound ∪ third-column additions`……may add an exported primitive but
**may never erase** an IA primitive……applies to all 94 accepted IA screens, including grouped rows"。
`NONE_WITH_REASON` 的适用条件也被收紧为"IA 下界本身为空**且**该 screen 无可复用行为"。
两个密码结果屏现为 `useOverlayLock`（IA03 `:41` result 支、IA05 `IA05-PASSWORD-RESULT`），
与其 `UI_SURFACE=Modal` 自洽，错误声明已消失。

**③ 平台 shell 以 supporting contract 绑定、非第 23 个 surface** —— `CONFIRMED`。
physical `:32` 与 roster `:68`（`supporting PLATFORM-SHELL`）双处标注；
carry-over manifest 的 `surfaces` 本会话复算仍为 **22**，未被改动。
处理方式正确：既给了 chrome 一个 final path 和 focused test，又没有伪造冻结分母。

**④ P6-1 机械排除偷带 UI** —— `CONFIRMED`。
`RM1P6-U01.changeSurfaces` 现为四条：`contracts/openapi`、`apps/backend/catering-business-server`、
以及两端的 `src/app/api/generated`。由于 D4 以声明的 change surface 为基准做
`actualChangedPaths == incrementalChecks`，在 `features/**/ui/*.tsx` 的任何改动现在都会落在声明之外。
**"P6-1 不含 UI"从散文变成了可判定事实**，这正是上一轮 S2 要的效果。

**⑤ U03 判别式** —— `CONFIRMED`。当前字节：

> "Use a **REGION-A** assignment to manage PROJECT users under **peer REGION-B**: `target.ancestorIds`
> excludes the assignment and owner must reject. **Positive control**: the same REGION-A assignment manages a
> PROJECT under REGION-A and **must be allowed**. Separately mutate a definition after form open…"

与 `admin-catalog.json` 中 `PG-IAM-PROJECT-USERS` 的 eligible 类型 `['GROUP','REGION','PROJECT']`
以及 `OrganizationTaskPathService:178` 的 `target.ancestorIds().contains(assignmentId)` 完全一致。
**红夹具与正向对照成对**，不会再被读成类型相等。
U01（不泄露账号/会话/资产引用/跨空间品牌）与 U02（list/total/candidates 保持 owner-scoped、冲突强制 readback）
经复核均不含祖先包含语义，intake 的"not analogous"判断属实。

**⑥ roster 路径、非 catalog 计数与 physical 一致** —— `CONFIRMED`。
roster `:67` 列 `PlatformLoginPage.tsx` + 三个 `PlatformPasswordRecovery*Page.tsx`；
`:93` 列 `OperationsLoginPage.tsx` + 三个 `OperationsPasswordRecovery*Page.tsx`，与 physical 逐一对上。
`:105` 的非 catalog 计数已由 four 改为 **five**，与 manifest `RM1P6-U03.nonCatalogSurfaces` 的 5 条一致。

---

## 2. N（观察项，不阻塞）

**N1 ｜第三列的列名与其语义规则相反，会误导 gate 实现者**

**owning source**：physical 文件表头第三列为
`exact foundation primitive contract`；而 `:18-21` 的规则说该列是
"explicit **additions** or repeats"，真正的必需集合是 `IA lower bound ∪ third-column additions`。

**具体反例（我自己就踩了）**：本会话第一遍核验时我按列名把第三列当作**完整集合**读，
于是判出 5 条"下界违反"——
`IA01-PLATFORM-LOGIN` 缺 `useSubmissionLifecycle`、
`IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER` 与 `IA05-USER-DETAIL` 缺 `adminDrawerSurfaceProps`、
`IA01-USER-INVITATION-ACTIONS` 缺 `useDetailDrawer`、
`IA05-PASSWORD-DRAWER` 缺 `useSubmissionLifecycle`。
读到 `:18-21` 才明白这些是**继承而非删除**，遂撤回。
**这几行确实合规**——但一个只看列名去写 gate 的人会把它们判成"未声明"，
从而允许实现时移除 `useSubmissionLifecycle`，那正是 M2 想防的事。

**加剧因素**：该列的填法本身不统一。`IA01-OPERATIONS-LOGIN` 重复列出了 IA 已有的
`useAsyncGenerationGuard, useSubmissionLifecycle`；`IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER`
则省略 `adminDrawerSurfaceProps` 依赖继承。并集意义下两种写法等价，但人工审阅时无法从行本身判断是否完整。

**最小修复**：列名改为
`additional foundation primitives (required set = IA lower bound ∪ this column)`，
并在 `:18` 那段之后补一句"本列不重复 IA 下界"或"允许重复但不表示完整集合"，二选一固定填法。
**不改任何行的值。**

**N2 ｜roster `:68` 的 `PLATFORM-SHELL` 用了与冻结 surface id 相同的排版**

同一张表里 `PLATFORM-WORKSPACES`、`PLATFORM-AUTH` 等冻结 surface 也是反引号 token。
`:68` 虽以 "supporting" 前缀限定、physical `:32` 也写明不是第 23 个 surface，
但单看 roster 这一行仍可能被后续会话当成一个 surface id 计入分母。
建议把该单元格改为 `supporting host chrome（不属于冻结 22 surface）; IA02 platform authenticated shell`，
去掉反引号 token 形态。纯排版，不改绑定。

---

## 3. 方案合理性复核

**M2 的修法选择值得记一笔。** 我上一轮给了 A/B 两案，作者选了 A（IA 为下界）并把理由写进 intake：
方案 B 虽然能让两份文档字面一致，但"would leave a future implementer free to erase an accepted
safety/lifecycle primitive"。这个判断是对的——`useAsyncGenerationGuard` 之于运营登录入口态、
`useSubmissionLifecycle` 之于提交去重，都是行为安全原语，不该由实施期的一份表格决定去留。
选 A 还避免了回改已 `ACCEPTED` 的 IA 字节（本会话已复算 5 份 IA hash 未变），**不需要 Dexter 再裁决一次**。

**S1 的处理也没有过度工程**：没有为了让 shell "有归属"就往冻结 22 分母里塞第 23 项，
而是用 supporting contract + 显式 `NOT_APPLICABLE_WITH_REASON` 说明它是 host chrome。
分母的权威仍是 carry-over manifest，这是正确的边界。

**闸门现在是可信的**：上一轮我说"结构够但三处漏气"——`S2`（change surface 管不住 UI）、
`M1/M2`（import 分母不可执行且自相矛盾）、`S3`（判别式建反）。**三处都已堵上**，
两条 import-equality red mutation 现在有确定的输入集合可建。

---

## 4. 处置与授权边界

`M=0 / S=0 / N=2` → **GO**。

- **无需 Dexter 产品裁决**。N1/N2 均为列名与排版，Codex 可自主处理，**不改任何行的值或绑定**。
- **本 GO 的含义**：`P6-2/P6-3` 的 implementation-facing import/evidence 分母**已可执行**；
  已接受的 UI 交互、业务语义与三步串行边界**未被改变**（IA 5 份 hash 零漂移、串行约束原样）。
- **本 GO 不代表**：implementation authorization、历史独立子审查复绿、
  或 P6-1 可以开工。`VERDICT=NO_GO` 与 `CURRENT_BYTES_NOT_REVIEWED_BY_ADVERSARIAL_SUBAGENT=true`
  仍是 manifest 的当前事实，应保留；P6-1 启动仍需 Dexter 的单独 implementation 授权。
- 全部既有 `GAP-*` 未被本轮解除。

**本复核不授权**：implementation、契约/生产源码/测试修改、动态运行、DEV、seed/reset、
Roadmap 状态修改、任何仓库控制操作。
