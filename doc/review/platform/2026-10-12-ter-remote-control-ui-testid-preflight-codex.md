# TER 应用内远程控制 UI / TestId 当前源码前置复核

## 范围与结论

本记录只覆盖 Browser-L2 脚本开发前的 operations-admin UI 与 TestId 节点前置；不覆盖 Browser-L2 控制面 admission、浏览器业务、DEV、LiveKit 媒体或 Android。

`UI_DESIGN_REVIEW=PASS`、`TESTID_REVIEW=PASS`（静态当前源码）。
`L2_SCRIPT_ADMISSION=NO-GO`：远控 suite、P1/admission 控制文件与 Playwright spec 尚未接入。Browser-L2 focused/browser 证明为 `NOT_RUN`。

## 独立复核与当前实现

fresh 只读 reviewer `/root/remote_ui_l2_current_preflight` 的当前字节结论：UI/TestId 前置 `GO`；整体 L2 控制面 `NO-GO`，`M/S/N=0/1/0`。finding 仅为 Browser-L2 suite/control plane 缺失，本记录不把该 finding 误记为 UI/TestId 缺口。

当前动作节点与 TestId 映射逐项见 `doc/plans/platform/2026-10-10-ter-remote-control-source-and-api-appendix-claude.md` §4a：

- operations-admin 查询、重置、翻页、终端详情入口及在线状态映射到当前 `terminalUpdateTestIds` 常量；`reportQueryReset` 和 `reportPagination` 已存在。
- 详情操作菜单由 `AdminDetailActionMenu` 的真实 Button 触发；“远程控制”项的 `data-testid` 直接挂在 Ant Design MenuItem，而不是标签包装节点。
- 工作区视频由 `RemoteControlWorkspace.tsx` 内部 `RemoteScreen` 渲染；结束、关闭、重新发起各是实际 Button。
- TestId 值来自对应 `*TestIds.ts` 唯一源。静态检查未发现需用 role/text/index/CSS/XPath 替代的节点缺口。

MenuItem 的 `data-testid` 依据本仓解析的 Ant Design 6.5.0 `MenuItemType` `DataAttributes` 与当前本地 rc-menu props 转发源码；这只证明节点属性可达，不证明 Playwright 菜单点击或业务行为通过。

## 局部验证

- `yarn workspace @catering-v2s/operations-admin vitest run src/features/terminal-update/ui/ProjectTerminalUpdatePage.static.test.ts`：1 file / 4 tests PASS。
- `yarn workspace @catering-v2s/operations-admin typecheck`：PASS。
- fresh reviewer 对 `@catering-v2s/admin-ui-foundation typecheck`：PASS；其 LSP MCP 曾断连，使用 package typecheck 作为静态诊断。
- 浏览器真实 UI、Browser-L2 binding、focused spec、DEV 与设备场景：`NOT_RUN`。

## 下一个独立执行面

下一步只补 `browser-l2-runtime` 既有入口下的 `remote-control` suite、同 run owner fixture/P1/admission/spec 与精确 cleanup。Browser-L2 证明远控后台页面、权限、真实 TDS ONLINE read model、启动/结束后台承载；Expo Web 只证明已跑过的 DEV-backed Web smoke；Android 设备 run 证明真实媒体、输入和设备侧 command。三种结果分开保存，不互相替代。
