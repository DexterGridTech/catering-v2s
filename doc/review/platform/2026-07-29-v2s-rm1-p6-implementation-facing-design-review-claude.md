---
title: RM1 P6 implementation-facing 详设与三步实施计划独立复审（Claude）
reviewTarget: DESIGN
scope: RM1-P6 current bytes（三步实施详设、final UI surface roster、physical screen import contracts、granularity manifest、round-2 独立审查与 intake）
verdict: NO-GO
findings: M=2 / S=3 / N=3
sessionProvenance: FRESH_V2S_ROOTED
authorizationBoundary: 仅静态 implementation-facing design review；不授权 implementation、契约/源码/测试修改、动态运行、DEV、seed/reset、Roadmap 状态修改或仓库控制操作
createdAt: 2026-07-29
---

# RM1 P6 implementation-facing 详设与三步实施计划独立复审

## 0. 结论

**NO-GO**，`M=2 / S=3 / N=3`。

> **本文件已修订（Dexter 2026-07-29 指出）**：初版把 U03 的 `discriminator.fixture`
> "用 REGION 任职去管 PROJECT 用户"当作**优点**引用在 §7。**这是我的理解错误。**
> 该 fixture 描述的是**合法**行为，不是应被拒绝的行为；已补为 `S3`（§5），
> §7 的相应表述已撤回。计数由 `S=2` 改为 `S=3`。

**先回答"这活到底解决什么问题、解决了没有"。** 这一步要解决的是：交互已定稿，但如果直接开工，
实施者会一边猜 owner 事实一边画页面——匿名恢复、平台 OTP、集团空间品牌这三件当前**根本不存在**的
owner 能力，会被前端用 URL、asset ref、管理员 reset 链凑出来。**三步顺序的方向是对的，而且是最省的那个**：
P6-1 只做 contract/owner/edge 且**明令不做 UI**，把唯一真正新增的协议前置；P6-2、P6-3 串行消费。
更小的替代（先画 UI 再补 owner）会把安全语义变成前端实现细节，作者在 `§3.1` 已经把这个取舍写清楚了。

**机械层面这份材料的质量高于前几轮**，本会话逐项独立复算：

| 项 | 我的独立复算 |
| --- | --- |
| 12 处声明 SHA-256（设计稿、roster、import contracts、authorization、carry-over manifest、standards matrix、五份 IA） | **12/12 逐个复算一致** |
| 22 surface / 25 pageDesignKey / 7 非 catalog | **22/22、25/25、7/7 全部在 roster 命中，无遗漏** |
| D1 routed memory exact-set | **实跑 `tools/project-memory/cli.mjs query`：U01=10、U02=8、U03=8，与 manifest `owningSourceSet` 逐条相等** |
| granularity checker | 实跑 `--self-test` 15 条 red 全 PASS；`--manifest/--review` 实跑 `PASS / UNITS=3 / VERDICT=NO_GO / REVIEW_BINDING_MODE=DECLARED_POST_REMEDIATION_AWAITING_CLAUDE` |
| post-remediation 诚实性 | `currentBytesNotReviewedByAdversarialReviewer=true`、`claudeRecheckRequired=true`、intake 明写"not represented as historically reviewed green"——**诚实，未伪称复绿** |
| 恢复链混用 | roster `§2` 三行显式区分匿名链与管理员发起链，red 为"login page accepts generation key"；`forbiddenPseudoFixes` 含 "reuse administrator-issued resetGenerationKey as anonymous grant"——**未混用** |

**NO-GO 的原因集中在一处：被指定为"authoritative per-screen import-equality denominator"的
`rm1-u09-physical-screen-import-contracts.md` 本身不可执行、且与已 hash-bound 的 IA 声明相矛盾。**
这不是 review 清单上的格式项——它是 P6-2/P6-3 唯一的 import 对账分母，也是那两条 red mutation 的输入。

**会话出处**：fresh v2s-rooted 只读会话。仓库零写入（本文件除外）。

---

## 1. M1 ｜import 契约使用了 foundation 里**不存在**的两个标识符 —— `CONFIRMED`

**owning source**：`libraries/frontend/admin-ui-foundation/src/index.ts` current bytes，实际 export 为
`useOverlayLock`、`OverlayLockProvider`、`createObservedBaseQuery`（共 17 个 export）。

**当前字节**：

| 标识符 | 是否 foundation export | physical-screen-import-contracts | final-ui-surface-roster |
| --- | --- | --- | --- |
| `overlayLock` | **否** | **57** 次 | **22** 次 |
| `observedBaseQuery` | **否** | **4** 次 | **5** 次 |
| `useOverlayLock` / `createObservedBaseQuery` | 是 | **0** 次 | **0** 次 |

`overlayLock` 是模块路径 `./overlay/overlayLock` 的**文件名**，不是导出名；
`observedBaseQuery` 同理来自 `createObservedBaseQuery` 的返回值语义。

**反例**：模板 `ui-interaction-design-template.md:48-49` 要求"每个名称必须能在
`libraries/frontend/admin-ui-foundation/src/index.ts` 重新打开"；
P6 预备稿 `§4.2` 规定 import 对账"要读取 final manifest"并以"删掉已声明 import"为红。
按当前字节建 gate，会出现两种结果：要么每一行都判红（因为源码里永远 import 不到 `overlayLock`），
要么 gate 被写成匹配错误名称，从此对账的是一个不存在的符号。

**边界**：这**不是** IA 层的问题。本会话对全部 **94 个** IA screen 的 `FOUNDATION_PRIMITIVE` 做了
逐项校验，**命名非 export 的screen = 0**。回归**只发生在 implementation-facing 这一步**，
恰好发生在被指定为权威分母的那份文件里。

**最小修复**：全局改名 `overlayLock → useOverlayLock`、`observedBaseQuery → createObservedBaseQuery`
（两份文件共 88 处）。无产品判断，不改任何交互。

---

## 2. M2 ｜physical import 契约在 16/25 行与已接受 IA 的 `FOUNDATION_PRIMITIVE` 相矛盾，且丢失安全相关原语 —— `CONFIRMED`

**owning source**：`rm1-u09-physical-screen-import-contracts.md:12-14` 自称
"IA01…IA05 … are the hash-bound source declarations"、
"its references **preserve** the already accepted IA … contract rather than redrawing or changing the interaction"；
intake `:22` 亦称 "No accepted interaction/copy/control changed"。

**本会话复算**：只取该文件中**无歧义的单 screen 行**（25 行，已把 `overlayLock/observedBaseQuery`
归一化为真实 export 后比较，并忽略 `testId`），**16 行与 IA 声明不等**，其中 **9 行丢失 IA 已声明的原语**：

| screen | IA 声明但 physical **丢失** |
| --- | --- |
| `IA05-PASSWORD-RESULT` | `useOverlayLock` —— physical 反而写 `NONE_WITH_REASON: static sign-in result has no shared lifecycle` |
| `IA03-PASSWORD-DRAWER / RESULT`（result 支） | 同上，同样以 `NONE_WITH_REASON` 覆盖 IA 的具体原语 |
| `IA01-OPERATIONS-LOGIN` | `useAsyncGenerationGuard`、`useSubmissionLifecycle` |
| `IA01-PLATFORM-LOGIN` | `useSubmissionLifecycle` |
| `IA01-USER-INVITATION-CREATE-DRAWER` | `adminDrawerSurfaceProps`、`contextScopedQueryArgs` |
| `IA04-HEAD-COMPANY-BRANDS` | `adminDrawerSurfaceProps`、`useSubmissionLifecycle` |
| `IA01-USER-INVITATION-DETAIL-DRAWER`、`IA02-PLATFORM-WORKSPACE-DETAIL-DRAWER`、`IA05-USER-DETAIL` | `adminDrawerSurfaceProps` |

**两处最要紧的具体反例**：

1. **`NONE_WITH_REASON` 直接推翻 hash-bound 声明**。模板 `§1.1` 规定
   `NONE_WITH_REASON` 只能用于"当前 screen 没有 lifecycle、Drawer/Modal surface、overlay……可复用"。
   而 IA-03/IA-05 的密码结果屏都是 **Modal**，其 `FOUNDATION_PRIMITIVE` 明写 `useOverlayLock`。
   一个 Modal 声称"没有 overlay 原语可复用"与它自己的 `UI_SURFACE=Modal` 自相矛盾。
2. **`IA01-OPERATIONS-LOGIN` 丢掉 `useAsyncGenerationGuard`**。该 screen 的整个入口态
   （骨架/不存在/停用/读取失败）依赖先读 `getOperationsWorkspaceLoginEntry`；generation guard
   正是防止旧入口响应覆盖新结果的原语。P5 那一轮我复核过它的失败态语义，这不是可选装饰。

**边界**：physical 文件**新增**的原语（如给列表页加 `useOverlayLock`）不一定错——实施时确实可能需要。
问题不在"多"，而在**两个都自称权威的分母互相矛盾、且没有任何一条规则说明谁赢**。
roster `§1` 说 IA 是 hash-bound source，physical 文件说自己 supersede roster；
于是 IA 的 `FOUNDATION_PRIMITIVE` 究竟还算不算约束，无解。

**最小修复**：逐行对账后二选一，并把规则写进文件——
(a) 以 IA 声明为下界，physical 只允许**追加**、不允许删除，删除必须在该行写明理由；
或 (b) 明确 physical 取代 IA 的 primitive 维度，同时**回改 IA 的 `FOUNDATION_PRIMITIVE`**
使两者一致（IA 已 ACCEPTED，改动需 Dexter 知情）。
建议 (a)：它不动已接受字节，且保住 `useAsyncGenerationGuard`/`useSubmissionLifecycle` 这类安全原语。
`NONE_WITH_REASON` 两处应直接撤回。

---

## 3. S1 ｜`IA02-PLATFORM-AUTHENTICATED-SHELL` 在两份分母里都不存在 —— `CONFIRMED`

**owning source**：IA-02 `§12` 的
`### Screen: IA02-PLATFORM-AUTHENTICATED-SHELL`，`UI_SURFACE=登录后的应用 Shell`，
`FOUNDATION_PRIMITIVE=useOverlayLock,contextScopedQueryArgs,testId`，并在 IA-02 的 15 行
ownership roster 中占一行。

**当前字节**：`grep "AUTHENTICATED-SHELL"` 在 roster 与 physical 两份文件中**只命中 operations 一条**
（physical `:42`），**platform 的没有任何行**。physical `:24` 只覆盖
`IA02-PLATFORM-WORKSPACE-CONTEXT / SIDER-CONTROL → PlatformApp.tsx`，那是"未选空间的空态"
与"侧栏底部选择器"，不是 shell chrome。

**反例**：IA-02 `§12` 为该 shell 冻结了固定菜单图标映射、多内容页签、"刷新当前页"、
全屏 CSS 状态、`AppPageContainer` 不叠加内边距、shell 根占满视窗且 tab body 是唯一滚动容器。
这些行为在 P6-2 没有 final path、没有 foundation import 契约、没有 focused test，
却被 `P6-2 D5 assertion`（"eight platform catalog page keys and the two platform non-catalog surfaces"）
声称已覆盖。实施者可以任意实现这套 chrome 而仍然通过声明的 exit。

**边界**：根因部分在上游——22-surface 分母里有 `OPERATIONS-SHELL` 却**没有** `PLATFORM-SHELL`
（本会话已复算 manifest 的 22 个 id）。所以这不是作者凭空漏掉一行，而是继承了 manifest 的不对称。

**最小修复**：在 physical 文件补一行
`IA02-PLATFORM-AUTHENTICATED-SHELL → platform-admin/src/app/PlatformShell.tsx`（或等价 chrome 路径），
原语按 IA 声明 `useOverlayLock, contextScopedQueryArgs, testId`，并在 P6-2 D5 说明它归属哪个 surface；
若认为它不构成独立 surface，则必须写明 `NOT_APPLICABLE_WITH_REASON` 及其 chrome 行为由哪一行承担。
manifest 是 22 分母的权威，本轮不改它是对的。

---

## 4. S2 ｜P6-1 声明的 change surface 无法约束"不带 UI" —— `CONFIRMED`

**owning source**：manifest `RM1P6-U01.changeSurfaces`：

```json
{"path": "apps/frontend/platform-admin/src",  "disposition": "update", "target": "only generated contract consumption after contract generation"}
{"path": "apps/frontend/operations-admin/src", "disposition": "update", "target": "only generated contract consumption after contract generation"}
```

**反例**：生成物实际位于 `apps/frontend/{platform-admin,operations-admin}/src/app/api/generated`
（本会话 `find` 确认）。而声明的 `path` 是**整个 `src` 树**；`target` 只是散文。
本会话读 `tools/implementation-design-granularity/cli.mjs:446-470`：checker 只校验 path 形状、
重复与 disposition 取值，**不比对实际改动**——真正的比对是 D4 的
`actualChangedPaths == incrementalChecks`，而它是以**声明的 change surface** 为基准的。

因此，P6-1 若在 `features/**/ui/*.tsx` 改了一个页面，**不会违反任何已声明的边界**。
这恰好是 Dexter 本轮点名要防的"P6-1 偷带 UI"，而当前声明防不住。
roster `§2` 的"P6-1 does not implement a UI page"与 U01 的
`uiAndTerms.notApplicableReason` 都是正确的**意图**，但没有落到可对账的字段上。

**最小修复**：把这两条 path 收窄为
`apps/frontend/platform-admin/src/app/api/generated` 与
`apps/frontend/operations-admin/src/app/api/generated`。
一行改动即让"P6-1 不含 UI"从散文变成 D4 可判定的事实。

---

## 5. S3 ｜U03 的 discriminator fixture 把**合法**行为写成了应被拒绝的行为 —— `CONFIRMED`

**owning source**：`rm1-u09-implementation-design-granularity-manifest.json` 的
`RM1P6-U03.discriminator.fixture`：

> "**Use a REGION assignment to manage PROJECT users** and mutate a definition after form open:
> capability determines the target population and owner validation rejects the stale/unauthorized write."

**反证（两处 current bytes）**：

1. `contracts/catalog/admin-catalog.json` 的 `operationsPages`：

```
['PG-IAM-PROJECT-USERS', 'BUSINESS', True, 220, '用户与权限', '项目用户管理', 'PROJECT', ['GROUP','REGION','PROJECT'], 'PROJECT']
```

第 8 位是该页面的 eligible 任职机构类型，**明确包含 `REGION`**。
即"大区任职 + 项目用户管理能力"是 catalog **主动授权**的组合。

2. `OrganizationTaskPathService:174-182` 的真实判定不是类型相等：

```java
if (target.ancestorIds().isEmpty() || !target.ancestorIds().contains(target.targetId())) return false;
return switch (assignmentType) {
    case "GROUP", "REGION", "PROJECT" -> target.ancestorIds().contains(assignmentId);
    case "HEAD_COMPANY", "STORE"      -> assignmentType.equals(target.targetType()) && assignmentId.equals(target.targetId());
    default -> false;
};
```

GROUP/REGION/PROJECT 走的是**祖先包含**；只有 HEAD_COMPANY/STORE 才要求类型与 id 双相等。
**因此"大区管理员管本大区下项目的用户"必须放行。**

**具体危害（不是措辞问题）**：`discriminator` 是该 delivery unit 被指定的判别式，
`evidence.l2` 又要求由它派生 red mutation。按字面建夹具，会断言一个**必须成功**的场景失败——
该红要么永远无法变绿，要么有人为了让它变绿去补一道"assignmentType 必须等于 targetType"的校验，
**那会直接切断 catalog 已授权的业务路径**（大区管理员再也管不了本大区项目的用户）。
这比没有判别式更糟。

**真正能判别的三类**（`ancestorIds` 不含 assignmentId，或能力层先拒）：

- **同级越界**：大区 A 的任职去管**大区 B** 下某项目的用户 —— 这是 `contains()` 唯一挡住的东西，最干净；
- **向上越界**：项目任职去管大区用户（大区 path 的 `ancestorIds=[group, region]` 不含该 project id）；
- **能力缺失**：任职类型合法但角色没有该页面/动作能力，在 scope 判定之前就应被拒。

**边界**：owner 模型本身**没有错**，`evidence.l2` 里也写对了（"target mismatch, **peer**/cross-workspace…"）。
错的只有 `discriminator` 这一句；但它恰恰是最容易被实施者直接抄成夹具的一句。

**最小修复**：把 fixture 改为——

> 用大区 A 的任职去管**大区 B** 下某项目的用户：`ancestorIds` 不含该 assignmentId，owner 必须拒绝；
> **同一大区内的项目用户管理必须放行**。表单打开后 definition 变化，owner 以提交瞬间的 definition 重验。

**红夹具必须与正向对照成对写**，否则下一个人仍会把"祖先包含"误读成"类型相等"。
建议对 `RM1P6-U02`、`RM1P6-U01` 的 discriminator 也按同一标准复核一遍是否隐含同类误读。

---

## 6. N（观察项，不阻塞）

**N1 ｜roster 与 physical 对同一屏给出不同的具体文件名**

roster `§2/§3` 写 `PlatformPasswordRecoveryPage.tsx`、`§4` 写 `OperationsPasswordRecoveryPage.tsx`；
physical `:21-23`/`:44` 则拆为
`PlatformPasswordRecoveryVerifyPage.tsx / …PasswordPage.tsx / …CompletePage.tsx` 与对应三个 operations 文件。
physical 文件声明自己 supersede roster 的"multi-screen shorthand"，规则上可判定；
但 roster 给的不是"粗粒度简写"而是**另一个具体文件名**，在任何地方都不会被创建。
建议把 roster 的这几处改为指向 physical 文件，避免 D4 changed-path 分母出现两套具体路径。
`PUBLIC-INVITATION`、`OPERATIONS-SHELL`、`PLATFORM-WORKSPACES` 三行同理。

**N2 ｜roster `§4` 的"four remaining non-catalog surfaces"少算一个**

7 个非 catalog 减去 P6-2 的 `PLATFORM-AUTH`、`PLATFORM-PASSWORD`，P6-3 应为 **5** 个：
`OPERATIONS-AUTH`、`PUBLIC-ACCESS-RECOVERY`、`PUBLIC-INVITATION`、`OPERATIONS-SHELL`、`OPERATIONS-PASSWORD`。
manifest `RM1P6-U03.nonCatalogSurfaces` **正确列了 5 条**，是 roster `:104` 的散文写成了 four。
只是数字陈旧，不构成覆盖缺口；但按本包"不采信自报数字"的一贯标准应改正。

**N3 ｜U01 的 D1 route 用 `platform-admin` 承载三个 face 的 owner truth**

P6-1 同时建立 platform-IAM、workspace-IAM 与 public 三条 owner 事实，而 `memoryRoute.consumerFace`
只能取一个具体值。本会话实跑确认 `platform-admin` 可执行且返回 **10** 条（是 `operations-admin`
那 8 条的超集），因此**不存在漏召回**，M-002 的修复是有效的。
仅建议在 U01 旁注明"该 route 取 superset face，operations/public 的消费义务见 `nonCatalogSurfaces`"，
免得后续会话误读为 P6-1 只服务 platform。

---

## 7. 方案合理性判断（不只是闭环）

**问题对不对**：对。当前 owner 侧确实缺平台 OTP、两条匿名恢复族与品牌 readback——
这三样在前几轮已被逐条源码证伪为不存在。先建 owner 再消费，是唯一不把安全语义外推给前端的顺序。

**方案优不优**：三步串行 + 每步 Dexter/Claude 双闸门，比"一次性做完 P6 再统一评审"更省。
作者列出的替代（先画 UI、或复用管理员发起恢复）在 `§3.1` 有明确取舍理由，不是事后补的。

> **此处已修订**：初版我写"`discriminator` 写得具体……是能真拒错误行为的判别式"，
> 并照引了"用 REGION 任职去管 PROJECT 用户"。**说反了**——见 `S3`：该句描述的是合法行为。
> `discriminator` 的**形式**（给出可执行的具体场景而非口号）仍值得肯定，
> 但 U03 这一条的**内容**必须改，且三个 unit 的 discriminator 都应按 `S3` 的标准复核。

**代价配不配**：配。三份文档 + 一份 manifest，没有引入 CI 平台、监控或新框架；
`forbiddenPseudoFixes` 每条都对应一个已被源码证实的真实风险。

**闸门够不够防走偏**：**结构够，但三处漏气**——`S2`（P6-1 的 change surface 管不住 UI）、
`M1/M2`（import 对账分母不可执行且自相矛盾，两条 red mutation 因此无法建立）、
以及 `S3`（判别式把合法行为写成应拒行为，照抄会切断已授权业务路径）。
这几条修完之后，串行闸门是可信的。

---

## 8. 处置

`M=2 / S=3 / N=3` → **NO-GO**。

- **无需 Dexter 产品裁决**。全部 finding 都在既有批准边界内：改标识符名、逐行对账原语、
  补一行 shell 契约、收窄两条 change surface path、改写 U03 判别式、改两处陈旧数字与文件名。
  **不改任何交互、文案、用户任务或代码。**
- **`S3` 请优先处置**：它是唯一一条"照着做会把正确行为改错"的 finding；
  其余几条的失败模式是门建不起来，`S3` 的失败模式是门建反了。
- 唯一需要 Dexter 知情的是 `M2` 的修法选择：若选方案 (b)，会回改已 `ACCEPTED` 的 IA
  `FOUNDATION_PRIMITIVE` 字段。**我建议选 (a)**，不动已接受字节。
- `M1/M2` 闭合前，P6 预备稿 `§4.2` 的 import-equality 机械控制**无法建立**，
  因此 P6-2/P6-3 的 package exit 不应被声称可 PASS。
- 本轮不重开已用尽的两轮独立子审查；本文件是对 `DECLARED_POST_REMEDIATION_AWAITING_CLAUDE`
  当前字节的外部复核，`currentBytesNotReviewedByAdversarialReviewer=true` 的声明属实且应保留。

**本复核不授权**：implementation、契约/源码/测试修改、动态运行、DEV、seed/reset、
Roadmap 状态修改、任何仓库控制操作。
