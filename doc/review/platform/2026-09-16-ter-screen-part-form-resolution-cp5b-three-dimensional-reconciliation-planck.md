# TER screenPart 机型解析 · CP-5b 步骤级三维对账

```text
REVIEW_TARGET=STEP_RECONCILIATION
REVIEW_SCOPE=CP-5b / B-2 / R-11
REVIEWER_KIND=INDEPENDENT_SUBAGENT
REVIEWER=Planck
REVIEWER_ID=01a0a99a-65b2-78b3-848d-1b3e724782b0
TESTS_RUN=NO; read-only reconciliation
VERDICT=MATCHED
```

## 结论

CP-5b 当前实现、focused 结构证据与需求、详设、实施计划及项目规范一致。

## 核验

- `apps/terminal/ui/base/render/src/components/LayerStack.tsx:31-55` 的 stack 与每个
  layer wrapper 都是 absolute full-bleed；
  `apps/terminal/ui/base/render/test/renderSurface.test.tsx:764-796` 对 stack 与 layer
  wrapper 均拒绝 `alignItems`、`justifyContent`、`padding` 的旧样式恢复。
- `apps/terminal/ui/base/admin-shell/src/components/AdminShellFrame.tsx:10-16` 的 root
  是 `layout="fill"` 与 `{flex:1,width:'100%',minWidth:0}`；真实
  `sample-console` laptop/mobile assembly 在
  `apps/terminal/ui/integration/sample-console/test/sampleAssembly.test.tsx:377-416`
  拒绝 `maxWidth`。
- `AdminShellLaptop.tsx:32-41,64-85` 保持共享 workspace 下的 row/list-detail；
  `AdminShellMobile.tsx:51-68` 与 `AdminSectionNavigation.tsx:14-19` 保持 wrap navigation
  和单一 content frame。
- `adminLayout.test.ts:68-103` 逐文件覆盖 7 个 floating card：唯一 `PrimitiveCenter`
  必须有 frame style，且 `layout="card" bounded` 必须位于该 center 的 JSX 子树；四个
  section 均为 bounded content scroll owner。
- 已记录的临时 red mutation 能捕获 LayerStack 旧 center/padding、root card/maxWidth、
  card frame/bounded 缺失与 card 移出 owning center；所有生产变异均已恢复。

## 证据边界

本记录只证明 CP-5b 的结构、属性与测试防线。真实像素铺满、mask、Android/Web、设备和
视觉结论仍按 D-13 保持 OPEN，不能由本对账升级。
