# TER screenPart 机型解析 · 机制批全范围三维对账（首轮）

```text
REVIEW_TARGET=BATCH_RECONCILIATION
SCOPE=A-0..A-4 / R-1..R-9 / R-15 / R-16 / R-10a
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER=Fermat
REVIEWER_ID=01a0a96c-e528-7b42-8b3a-b2883ed0340f
INPUTS=需求、详设、IA、实施计划、项目记忆、CP1~CP4 evidence/对账、当前源码
TESTS_RUN=NO; this was a read-only reconciliation
VERDICT=OPEN
```

## Finding

`apps/terminal/ui/base/render/src/components/ScreenContainer.tsx` 的 resolved content
failure 分支把所有内容失败传给 `ScreenReadyBoundary` 时使用 `partKey={null}`；而
`ScreenReadyBoundary` 会把该值写入 `RenderSurfaceReadyInput.readyPartKey`。现有
`apps/terminal/ui/base/render/test/renderSurface.test.tsx` 的 missing-catalog 与
incompatible-catalog focused 断言也把该值锁成 `null`。

需求/详设只允许真正没有 placement identity 的 `container-empty` 使用
`readyPartKey=null`。missing-catalog、incompatible-catalog、invalid-props 都仍有
requested `partKey`，必须沿 ready → console writer → integration payload 保留。
否则 startup-ready 与后续诊断无法定位请求的内容 part。

这是跨 A-1/A-2 的真实边界缺口，不是 evidence 文案问题。最小修复是：

```text
container-empty                 -> partKey=null
resolved content failure       -> partKey=resolution.failure.partKey
```

并同步 render focused identity 断言；console-assembly 与两个 integration 已有
nullable payload 字段无需扩展字段，只需确保接收到的值不再被上游清空。

## 其他维度

- `TRIAD_REQUIREMENTS=OPEN`：ready identity 未闭合。
- `TRIAD_DESIGN_IA=OPEN`：D-2/D-9 的 ready input 与 startup writer 链尚有实际值丢失。
- `TRIAD_MEMORY_STANDARDS=OPEN`：验证治理禁止用已有测试绿或 evidence 声称掩盖当前源码的丢失。
- `SCOPE_DRIFT=NONE_FOUND`：尚未发现 A 批误做 B 批；admin 仍是 CP-4 same-component 状态，
  `AdminShell` 仍为旧 card，`LayerStack` 仍保留旧居中/padding。
- `CP3_FALLBACK_BOUNDARY=RETAINED`：CP-3 的主 agent fallback 仍不能升级为 fresh verdict。
- `EVIDENCE_GAPS`：本轮未运行测试，未核 native/Android/Web/visual/release；CP-3/CP-4
  的部分 negative controls 仍为 defined/not applied。

## 复核要求

修复后由新的 fresh 只读对账者重新核对该 finding 及 A 批全范围；此记录保留为首轮
`OPEN`，不被后续 `MATCHED` 记录覆盖。
