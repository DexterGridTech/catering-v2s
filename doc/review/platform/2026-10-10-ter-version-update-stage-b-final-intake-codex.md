# 阶段 B 最终实现复核 finding intake

本记录对 `stageb_final_impl_review` 的静态 findings 做主 agent 当前字节核验。该 review 的 NO-GO 保留在其原输入字节边界内；以下 intake 不是独立 verdict，也不替代下一轮 fresh 当前字节复核。

## Findings

| Finding | 主 agent 分类 | 当前字节核验与反例 | 处置 |
| --- | --- | --- | --- |
| S-1 上传按钮文案 | `REJECTED_WITH_EVIDENCE` | `TerminalUpdatePackagesPage.tsx:506-516` 只有一个主提交按钮，恒显示“保存”，并在没有当前成功解析 stage 时禁用。需求交互稿 `doc/decisions/2026-10-07-ter-update-supply-and-version-report-ui-interaction-claude.md:34-35,292` 要求解析成功后才可保存；当前流程在选择上传文件后自动解析。`terminalUpdateSupplyUi.ts:273-277` 在解析 readback 后检查保存按钮并提交。实际 Ant Design 6.5.0 将两个连续汉字渲染成“保 存”，精确字符串断言误报。console 和 wallpaper 当前真机 supply-chain run 均完成解析、保存、规则与终端更新。 | 不改产品文案或交互；只把测试断言改为 `/^保\s*存$/u`，容忍库的排版空格。该 focused helper 变化已通过 terminal-automation typecheck 和两条真实供给链验证。 |
| S-2 规则初始状态 | `REJECTED_WITH_EVIDENCE` | `ProjectTerminalUpdatePage.tsx:1095` 默认设置 `status='DISABLED'`；`1257-1265` 有“初始状态”Select，包含停用/启用；`1155-1161` 请求提交 `values.status`。因此初始停用可选且默认成立，启用也可直接选择；后续详情启停仍由独立动作负责。 | 无需修改。实际供给链使用默认停用并随后启用，真实动态 run 通过；启用初始值由当前 UI/请求源码闭合，但未在本次 supply-chain 场景单独操作。 |
| S-3 报告将 UUID 作为用户文案 | `REJECTED_WITH_EVIDENCE` | `ProjectTerminalUpdatePage.tsx:538-546,831-837,849-858` 用 owner 返回的 `latestReferences` / `row.references` 解析业务投影；`930-958` 将 rule/artifact refs 转成工件身份标题。投影缺失显示“关联更新资料暂不可读取”，不会回退显示 ref。全组件同根检索 `rg -n 'ruleRef|fullArtifactRef|hotArtifactRef' apps/frontend/operations-admin/src/features/terminal-update/ui/ProjectTerminalUpdatePage.tsx` 命中中的剩余项用于请求、键、关系或传给格式化器，未发现 UUID 直接可见渲染。 | 无需修改。维持 UUID 作为内部关联，不把 ID 当可读名称。 |
| N-1 状态 tab 文案 | `REJECTED_WITH_EVIDENCE` | `ProjectTerminalUpdatePage.tsx:632-635` 当前 Tab 文案及 TestId 同为“终端更新状态”，详情标题也一致；不存在评审提到的“版本与报告”。 | 无需修改。 |
| N-2 停用状态颜色 | `REJECTED_WITH_EVIDENCE` | `ProjectTerminalUpdatePage.tsx:448-455` 状态列将启用映射 `success`、停用映射 `warning`；UI 与列表一致。 | 无需修改。 |

## 本轮测试 oracle 修正及证据

第一条 console 真机 run `1aa7b20e-f3a3-4210-a5b5-27e9a4a83999` 在上传解析返回 HTTP 201 后、保存前失败。失败根因是 `toHaveText('保存')` 不接受 Ant Design 6.5.0 的中文字间排版空格；这不是业务请求或页面交互失败。页面源码仍为单个“保存”按钮。Ant Design Button 文档说明中文字符自动插空由 `autoInsertSpace` 控制且默认开启（[Button 文档](https://ant.design/components/button-cn/?tab=design)）。当前 helper 以 `/^保\s*存$/u` 断言可见文案，同时继续断言按钮 enabled 并真实点击提交。

修正后的当前运行：

- Console：run `83d2878b-a672-4af9-8b6b-3f82cf4cf0c0`，设备 `D409P5C2J0285`、API 34、arm64-v8a，`update.supply-chain`。FULL/HOT 在后台解析保存，规则创建、启用与审计读回；TER 读取同一绑定、门店和规则身份，FULL 安装后 HOT 更新；CBS 报告提交并送达，运营后台历史读回 1 条。manifest business/cleanup 均 PASS；测试进程、设备包、reverse、浏览器、生成 APK/ZIP/staging cleanup 均 PASS。对应事件时间 `2026-10-09T22:49:59.702Z` 至 `2026-10-09T22:55:16.625Z`。
- Wallpaper：run `5a051c3a-c1e4-46d2-8dab-bb87210e4042`，同一设备/API/ABI、同一 case。FULL/HOT 与规则读回通过，TER wallpaper 样本完成 FULL 安装、HOT 并确认 wallpaper 资源 loaded，CBS 报告送达，运营后台历史读回 1 条。manifest business/cleanup 均 PASS；测试进程、设备包、reverse、浏览器、生成物/staging cleanup 均 PASS。对应事件时间 `2026-10-09T22:55:22.095Z` 至 `2026-10-09T23:00:32.016Z`。
- 历史 DEV run 是受管 `IDENTITY_ONLY` readiness；本轮未重跑 calibrated budget。此处两条供给链复用当前已运行 DEV，但 runner manifest 未对当前源码摘要绑定，因此动态结果按受管真实运行记录呈现，不声称源码哈希绑定。

## 范围和待独立判断

- 本次没有修复上述五条静态 review finding，因为引用的反例与当前源码不符；唯一代码差量是 automation 的中文按钮排版断言。
- 本 intake 不出具整批 GO/NO-GO。需 fresh reviewer 以当前字节重看 UI、实现和运行记录；真实浏览器 L2、完整设备矩阵、阶段 C、UAT 与生产发布继续 NOT_RUN/不在本批授权内。
- 默认全仓 `scripts/verify` 未运行；不以相关局部门、类型检查或设备场景 PASS 替代它。
