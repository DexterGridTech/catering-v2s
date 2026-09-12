# TER admin console 详设与实施计划 — Claude 收口复审（M-A 自闭方案）

```text
REVIEW_TARGET=DESIGN + IMPLEMENTATION_PLAN (M-A REMEDIATION)
REVIEW_CYCLE_ID=TERMINAL_ADMIN_CONSOLE_DESIGN_20260911
REVIEW_KIND=DELTA_RECHECK（窄口径:只核 M-A、N-A 与 A-19 对账,外加其连带面）
reviewerKind=CLAUDE_INDEPENDENT
VERDICT=GO
M/S/N=0/1/0
EVIDENCE_TIER=static（源码与文档对账）;未构建,未运行任何门、测试、Web、Android、native、DEV、seed、UAT、部署
WRITE_SCOPE=仅本文件
```

## 1. 结论

`GO (0M / 1S / 0N)`。

`M-A` 的自闭方案我逐条重开源码核过,**成立且比我建议的版本更完整**——作者自己发现了我没提的一个场景（跨 displayMode 时旧 `AdminLayer` 会先被卸载,所以 cleanup 必须同时覆盖同态 identity 变更与旧 mode 子树卸载）。`N-A` 与 `A-19` 两侧对账均已闭合。

余下一条 `S`:identity effect 的比较方式未冻结,而没有任何判据能区分安全与不安全的两种写法。这是一句话加一条红夹具的事,在既有批准边界内可自主修复,不需要再开一轮。

**`GO` 的授权边界**:只表示设计与计划作为 implementation-facing 契约可以接受,**不授权源码实施、Roadmap 下一步、任何动态环境操作或仓库控制动作**。

## 2. 已核验修复（重开源码亲验）

**`M-A` 自闭方案（CONFIRMED_FIXED）。** 详设第 211 行把生命周期拆成两段:通用 render 路径只观察新 snapshot/geometry 并 blur 旧 field,「without knowing any admin identity」;清理由 `admin-shell/AdminLayer` 的 identity-bound effect 自行完成,并明写「No render→admin-shell import, literal admin layer ID in render, or `clearLayers` all-layer action is allowed」。§7 矩阵新增第 286 行承载该事实——**上一轮该行是空缺,这正是 `M-A` 的核心证据**。变更表第 382 行、CP-07、CP-08 与 A-57 红夹具同步。

**幂等性声明（CONFIRMED,亲验非采信）。** 作者称普通关闭依赖 `closeLayer` 的幂等 no-op。我打开两处证实:
- `kernel/base/ui-state/src/foundations/workspaceSlices.ts` 的 `closeLayer` reducer 写的是 `const index = ...findIndex(...)`,随后 `if (index < 0) return`,**没有** `splice(-1,1)` 这类经典陷阱,未命中时确为纯 no-op。
- `kernel/base/ui-state/src/features/actors/completeWrite.ts:17` 对 `!result.changed` 直接返回冻结结果,`persistenceStatus='succeeded'`,**不抛错也不触发 `flushPersistence`**。

所以「普通关闭会多发一条冗余 `closeLayer`」在状态与持久化两侧都无副作用。声明成立。

**旧 mode 卸载路径（CONFIRMED）。** 我亲验 `ui/base/render/src/components/LayerStack.tsx:96-110`:`displayMode` 来自 `useSurfaceContext()`,`layers` 来自 `useRenderSnapshot()` 后经 `selectLayers(snapshot.root, displayMode)`。两个独立来源确实会让 displayMode 先变、admin layer 因不在新 mode 的 contentSet 而从输出中消失,`AdminLayer` 随之卸载。作者对这条路径的判断正确,cleanup 覆盖该场景是必要的而非冗余。

**`N-A`（CONFIRMED_FIXED）。** 详设第 382 行已改为「host/runtime facts only; `surfaceForm` is read from the `ui-state` selector and is not a separate [prop]」。

**`A-19` 两侧对账（CONFIRMED_CLOSED）。** 需求正本已由我修订（`AC-5.4` 第 295 行、`A-19` 第 527 行、§0 沿革）。设计与计划侧全文检索 `OPEN_REQUIRES_REQUIREMENTS_OWNER` 与 `legacy order-key`:**零命中**,OPEN 已撤。计划第 447 行的 `A-19` 红夹具现含「an independent owner/order field」,与新需求字面一致。

## 3. 我自己撤回的一条怀疑（记录以免作者去修不存在的问题）

我在本轮核验中曾准备就「cleanup 用 ref 保存旧 `displayMode`」立一条 finding,理由是 ref 若写在 render 阶段,cleanup 时会读到**新** mode,导致关错 contentSet 而静默 no-op——正是 `M-4` 要防的失败。

穷举后不成立,撤回。依据:
- **跨 mode 路径**:`LayerStack` 重渲时 `AdminLayer` 不在输出中,React 直接卸载它,该组件**不会带新值再渲染一次**,所以 render 阶段的 ref 写入不会发生,ref 保留旧值。
- **同 mode 的 in-place identity 变更**:`displayMode` 本身没变,ref 写新值与旧值相同。

两条路径下 ref 与 effect 闭包捕获等价。作者选 ref 是安全的,**不要改成闭包**——改动没有收益。

## 4. S finding

### S-A — identity effect 的比较方式未冻结,且无判据能区分两种写法

`ID=S-A`
`STATUS=CONFIRMED`
`SEVERITY=S`
`PATH_OR_SYMBOL=doc/plans/platform/...implementation-design-codex.md:210、211、286；...implementation-plan-codex.md:307、485(A-57)；apps/terminal/ui/base/render/src/components/SurfaceHostController.tsx:30、38-39`
`DEXTER_DECISION_REQUIRED=否`
`EVIDENCE_TIER=static`

**事实。** 详设第 210 行只写 `SurfaceIdentity` 「is frozen and compared as an identity token, not only by `displayMode`」。`Object.freeze` 只保证不可变,**不保证跨事件的引用稳定**。两份文档全文检索 dependency array、referential、stable、non-identity、geometry-only:**零命中**,比较方式完全未冻结。

**事实。** 计划第 307 行把 `surfaceIdentity` 放在 `SurfaceHostSnapshot` 内部,其引用寿命因此绑定在 snapshot 上。

**事实。** `SurfaceHostController.tsx` 第 30 行与第 38 至 39 行用的是 `useState` 加 `source.subscribe(setSnapshot)`,**不是 `useSyncExternalStore`**。React 因此不对 snapshot 施加任何引用稳定性约束,每次 host 事件都可能送来一个全新对象。

**推论（失败场景）。** `AdminLayer` 的 effect 绑在 `SurfaceContext.surfaceIdentity` 上。若实施者写 `useEffect(..., [identity])`（对象引用比较）,而 host 在 geometry、尺寸或窗口事件上重新构造 snapshot 与其内嵌 identity——四个字段值完全没变——effect 仍会判定依赖变化,**先跑 cleanup 再 setup**,于是 `AdminLayer` 在用户输入口令或阅读某一节的中途把自己关掉。若实施者写 `[identity.surfaceKey, identity.displayIndex, identity.surfaceForm, identity.displayMode]`（四个原始值）则安全。两种写法都符合当前文字。

**影响面。** 这条失败**逃逸整个 focused 档**:静态与 focused 夹具都是主动构造真实 identity 变更,稳定桌面上不产生额外 snapshot 事件,全绿。它只在 Android 真机的 geometry/尺寸事件下显形,而 Android 档本轮不执行。`A-57` 的红夹具列（第 485 行）是「cached canvas/auth/focus/scroll、wrong previous-mode close、old-mode `AdminLayer` unmount without cleanup、whole-root remount、business layer/content loss」——**全部是真实 identity 变更或清理缺失,没有一条断言 admin layer 在非 identity 的 snapshot 变化下必须存活**。所以该判据当前无法证伪这个缺陷。

**最小修复方向。** 在详设第 210 行的 identity contract 补一句:identity 比较**按四个字段的值**进行,不依赖对象引用;并在 `A-57` 增一条红夹具——「只改 geometry / 重发内容相同的 snapshot,admin layer 必须仍在且认证态不变」。

**为什么更小的修复不够。** 只写「identity 必须 memo 化」不够:memo 化把责任推给 snapshot 的生产侧（Android adapter 与 dev-host 两处),而生产侧是否稳定复用对象本轮不验证,等于把一个不可见的前提塞进别的包。按值比较把正确性收在消费侧一处,且不要求生产侧做任何保证。红夹具必须一并加,否则修复本身无法被证伪——判据不能只由文字断言。

## 5. 证据档位与授权边界

- **static**：本轮结论全部来自当前源码与当前文档字节的对账。重开并逐行核过 `workspaceSlices.ts`（closeLayer reducer）、`completeWrite.ts`、`contentActors.ts`（close actor）、`LayerStack.tsx`、`SurfaceHostController.tsx`、`surfaceHost.ts`,以及修订后的详设、计划与需求正本。
- **focused / Web / Android / native / release / visual**：**全部未执行,本轮无权执行**。`S-A` 明确指出其失败面逃逸 focused 档,因此本轮的 static 通过**不得**被读成该行为已验证。`N-2` 仍为 `UNVERIFIED_REQUIRES_EVIDENCE`。
- **授权边界**：`GO` 只覆盖本次设计与计划复审。**不授权**源码实施、Roadmap 下一步、DEV、seed、UAT、部署或任何仓库控制动作。`S-A` 在既有批准边界内可由作者自主修复,不需要 Dexter 裁决,也不需要另开一轮独立审查。
