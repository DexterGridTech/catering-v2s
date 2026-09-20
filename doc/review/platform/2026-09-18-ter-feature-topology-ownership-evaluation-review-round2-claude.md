# TER feature 端主副屏写入归属评估 · 复核(第二轮)

- 评审人:Claude｜日期:2026-09-18
- 对象:`doc/review/platform/2026-09-18-ter-feature-topology-ownership-evaluation-codex.md`(392 行)、`doc/platform/terminal-coding-standard.md` §4-D、`project-memory/decisions/terminal-architecture-and-stack-rulings.md`,及当前源码事实
- 上轮:`…-ownership-evaluation-review-claude.md`(GO,0/1/2)

## 0. 结论

```
VERDICT=NO-GO
M/S/N=1/0/2
```

⚠️ **这条 Major 的源头是我。** 上轮我提出"公共写入 seam 只有一处,在 `dispatchContentAction` 设门即可一次覆盖所有 feature";本轮我把内容 slice 的写入路径**穷举**了一遍,发现**只覆盖 6 条里的 4 条**。报告 `:161-162` 原样采纳了我的建议,所以这个洞是我带进去的,不记在实施方头上。

**规则落点本身是对的**(§1),**M-1/M-2/M-3 三条偏差全部复核仍成立**(§3),**唯一阻断项是所提修法不成立**(§2)。

⚠️ 本轮只读,零写入(本文件除外);未运行任何构建、测试、gradle、设备或网络动作。

## 1. 规则的规范落点 —— 正确

- `doc/platform/terminal-coding-standard.md` §4-D(`:775-780`):**逐字采用 Dexter 原话** ——「`MAIN` 只能主机的 actor 执行 command 写入 slice。`BRANCH` 只能副机的 actor 执行 command 写入 slice。」并写明这是唯一的写入 owner 判定、投影方向由它导出。
- `project-memory/decisions/terminal-architecture-and-stack-rulings.md:44-45`:`TER_FEATURE_TOPOLOGY_OWNERSHIP` 同样逐字记录并指向规范正本;且该 assertion 已在 `:11` 的 `assertions` 列表内 ⇒ routed memory recall 能召回,不会变成孤立段落。

⇒ 正本与记忆一致、措辞即原话、指向关系正确。**无 finding。**

## 2. Major

### M-1 所提的"公共写入 seam"只覆盖 6 条写入路径里的 4 条;被遗漏的两条今天就在违规,且与将要引入的投影互斥

```
状态=CONFIRMED
严重度=M
owning source=本评审人上轮的 S-1 建议;报告 §5 M-1 收口第 1 条(`:161-162`)
需 Dexter 裁决=是(prune 的归属属产品语义,见最小修复)
```

**穷举结果(我对 `contentActions.` 做了全仓生产代码检索,非采样)**

内容 slice 的写入路径共 **4 类 6 处**:

| # | 路径 | 落点 | 是否经 `dispatchContentAction` |
|---|---|---|---|
| 1 | `showScreen` actor | `contentActors.ts:236` | ✅ 经过 |
| 2 | `openLayer` actor | `:270` | ✅ 经过 |
| 3 | `closeLayer` actor | `:283` | ✅ 经过 |
| 4 | `clearLayers` actor | `:293` | ✅ 经过 |
| 5 | **prune-hydrated-containers** | **`:333`** `dispatch(contentActions.removeScreen(...))` | ❌ **直接 dispatch,绕过** |
| 6 | **prune-hydrated-layers** | **`:400`** `dispatch(contentActions.closeLayer(...))` | ❌ **直接 dispatch,绕过** |

第 5、6 条分别属 `createPruneHydratedContainersActor`(`:339`)与 `createPruneHydratedLayersActor`(`:371`),二者由 `pruneHydratedContainersCommand` / `pruneHydratedLayersCommand` 驱动(`ui-state/src/features/commands/index.ts:7-8`)⇒ **它们是"actor 执行 command 写入 slice",正落在 §4-D 规则的字面适用范围内。**

**为什么这不只是"门开漏了一个口"**

1. **今天就存在一条报告未列出的违规路径。** `displayDerivation.ts:11-14` 的 `resolveWorkspace` 仅在 `SLAVE && CHIEF` 时返回 `BRANCH`,其余一律 `MAIN` ⇒ 已配对副机处于 **VICE**(双机副屏的正常态)时 `currentWorkspace` = `MAIN`。⇒ **副机重水合后执行 prune,写的是副机的 `MAIN`** —— 与 M-1 现有两条路径(主机派命令让副机写、`sample-member-desk/actors.ts:68` 的 fallback 让副机自发写)并列,是**第三条**"副机 actor 写 MAIN"。
2. **它与将要引入的投影语义互斥。** MAIN 一旦声明为 `master-to-slave`,`applyAuthoritativeSync` 会整片替换副机的 MAIN。副机本地 prune 删掉的容器/层,**下一次投影又会回来**;prune 与投影会互相推翻,形成反复。这不是加一道门能解决的,**是归属未定导致的语义冲突**。

**反例(按报告现稿执行会怎么落空)**

实施方按 `:161-162` 只在 `contentActors.ts:216-228` 设门 ⇒ 门自称 fail-closed,但 prune 两条路径**不经过它**,副机继续写 MAIN;而此时投影已打开,现场表现为**副屏内容周期性闪回/抖动**,且门全绿。

**最小修复**

1. 门的落点从"`dispatchContentAction` 一处"改为**覆盖全部 6 处 `contentActions.` 派发**(或把 prune 两处改为经同一 seam,再在 seam 设门)—— 二者取其一,但必须**先穷举再设门**,不得以"公共 seam"之名只盖 4 条。
2. **prune 在副机上的归属需要裁定**(`DEXTER_DECISION`):
   - 方案 A:prune 视为**本机水合卫生**,显式豁免于 §4-D,但豁免必须写进规范正本并**限定它只能删除、不能新增/改写业务内容**,否则豁免会变成绕过规则的通道;
   - 方案 B:prune 也归主机 —— 副机不 prune `MAIN`,渲染层遇到不可渲染内容直接跳过,由主机在 MAIN 侧清理后经投影下发。
   ⚠️ 方案 B 与 §4-D 字面一致、与投影不冲突,但要求渲染层容忍"投影来的内容本机渲染不了";方案 A 实现小但需要在规范里挖一个有边界的口子。**两者都需 Dexter 定,不该由实施方默认。**

## 3. 复核项 2–5:上轮结论逐条复核,**全部仍成立且未整改**(本轮本就只授权评估)

| 复核项 | 当前源码事实 | 结论 |
|---|---|---|
| 2 双机 secondary 是否由主机 MAIN projection 驱动 | `workspaceSlices.ts:570` 内容 descriptor 仍 `syncIntent: 'isolated'`;`createTopologyStateSyncController` 仍只投 members 且 slice 名硬编码 | **否**,仍靠命令路由 |
| 3 是否存在副机 actor 写 MAIN / recovery 本地重放 | `resolveCommandTarget.ts:30-36` 仍在 MASTER+已配对+单屏+SECONDARY 时 `return 'peer'`;`sample-member-desk/actors.ts:68` 仍 `return facts?.paired === true` | **存在**,且本轮新增第三条(prune,见 M-1) |
| 4 `SyncIntent`/workspace descriptor 能否复用为 workspace 级投影 | `state/src/types/sync.ts:4-7` 已是 `'isolated' \| 'master-to-slave' \| 'slave-to-master'`;`slice.ts:38` 已约定非 isolated 须带 `sync`;`sample-member-registry` 已在用 `'master-to-slave'` | **能**,词汇与机制齐备,无需新造 |
| 5 wallpaper 资格与 SLAVE/PRIMARY/BRANCH 本地闭环 | `sample-wallpaper-console/actors.ts:29` 仍用 `resolveSecondarySurfaceAvailable(displayInfo)`(物理);`resolveCommandTarget.ts:27-29` 的 `peer-intent` 分支仍只查 `SLAVE && paired`,不看 displayMode/workspace | **仍不合规**,与报告 M-2/M-3 一致 |

⇒ 报告的 M-1 / M-2 / M-3 三条定性我**再次确认成立**,本轮不重复计入 finding 数。

## 4. Notes

### N-1 归属门不得把投影路径一并挡住

`applyAuthoritativeSync` 走的是 state store 层的独立 action(`createStateStore.ts:11-12` `APPLY_AUTHORITATIVE_SYNC`),**不经过 `contentActions.` 派发** ⇒ 天然落在内容 seam 之外,门不会误伤它。但请在详设写明这一点:**门只约束"actor 执行 command 写内容 slice",不约束投影落地**,否则一个写得过宽的守卫会把 MAIN 投影本身挡掉,副屏直接不出内容。

### N-2 本轮覆盖边界(如实声明)

- **已亲验**:`contentActions.` 的全仓生产检索与 6 个派发点;`contentActors.ts:216-228`、`:320-340`、`:390-405`、`:339`、`:371`;`commands/index.ts:7-8`;`displayDerivation.ts:1-14`;`resolveCommandTarget.ts` 全文;`workspaceSlices.ts:570`;`state/src/types/sync.ts`、`slice.ts:38`;`createStateStore.ts:11-12`;`sample-member-desk/actors.ts:60-68`;`sample-wallpaper-console/actors.ts:29`;规范 §4-D 与记忆裁定原文。
- **未复跑**:报告声称的"全树扫描所有 UI part 声明,`BRANCH` 命中只在 admin-shell 与 sample-console fixture" —— 上轮已声明未复跑,本轮仍未;对 parts 层结论**不背书也不否定**。
- **未读**:`createTopologyPeerCommandController.ts` 本轮未重读(上一批 implementation review 中已逐行读过其集合与 cancel 路径,与本规则无直接交集)。

## 5. 证据分档(严格分开,未混写)

- `static` = **已完成**。本文全部结论均为静态源码与文档核验。
- `focused` = **本评审未运行**。报告自陈 member-desk focused test 公共面先验失败且尚未重跑,该状态我未复核。
- `native/Android`、`device` = **本轮不涉及,未宣称**。三条 Major 的运行期表现仍为 `UNVERIFIED_REQUIRES_EVIDENCE`,我同意该档位。
- `Web` = **不适用**。
- `visual/release` = **不适用,未宣称**。
- `cleanup` = **本轮不涉及**。

## 6. 授权边界

本次只授权 review。不授权修改源码、测试、脚本、依赖或运行环境;不扩大双机拓扑范围;不改变既有裁决。**NO-GO 指所提修法在补全写入路径清单、并由 Dexter 裁定 prune 归属之前不宜进入详设**;规则正本与记忆落点无需返工。不构成 Android、Web、release 或 acceptance PASS。
