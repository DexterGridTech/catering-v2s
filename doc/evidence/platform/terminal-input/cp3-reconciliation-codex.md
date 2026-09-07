# CP-3 实施对账（主 agent 记录）

```text
CP=CP-3
REVIEW_TARGET=IMPLEMENTATION
RECONCILIATION_SCOPE=sample-member-registry + sample-member-desk + sample-console + Android/Web acceptance
CP3_STEP_RECONCILIATION=PASS
INDEPENDENT_REVIEW_ROUND=2 completed; one S finding addressed by main agent; no third round permitted
INDEPENDENT_REVIEW_FINAL=MATCHED_AFTER_REMEDIATION
```

本记录按实施计划 §6、详设 §10/§11 与需求 sample §4.5/§9.2 重开源码；它不是用测试结果
替代语义对账。每一维都按“需求—详设/IA—当前源码与证据”三方比较。

## 代码全集与三维结果

| 代码组 | 当前范围 | 行为 | 形态 | 动作/关系/位置 | 文案 | 状态/控制 | 失败/恢复 | 焦点/可访问性 | 数据来源/失效 | 结果 |
|---|---|---|---|---|---|---|---|---|---|---|
| registry owner | `apps/terminal/kernel/feature/sample-member-registry/src/**`、测试、README | submit/confirm/reject/withdraw 语义与 sample §4.5.3 一致 | `Member.age?` 与 confirm payload 的可选 age 一致 | owner 仍由 command API 持有事实 | 无 UI 文案下沉 | reject 保留 pending；withdraw/abandon 清理 | 晚到 competing command 是幂等 no-op | kernel 不持 UI focus | age 只读用户输入并规范化；不生成 | MATCHED |
| member desk actors | `apps/terminal/ui/feature/sample-member-desk/src/actors/**` | 双屏年龄 confirm 与单屏 `handheld-confirm` 两路径一致 | screen/layer、九 parts、六 semantic layer type/七 partKey 分母与 IA 一致 | SECONDARY 相关动作均在 `hasSecondarySurface` 派生分支 | waiting/notice/retry/abandon 文案来自 feature | `requestOutcome` 五态显式处理，`running` 不提前 finish | reject/withdraw/notice failure 均有 owner-specific recovery | actor 负责 screen/mode，part 不读屏数 | submit/confirm 从 input snapshot/owner selector 取值 | MATCHED |
| member desk parts | `apps/terminal/ui/feature/sample-member-desk/src/components/**`、parts | 字段编辑不进 store；confirm 只读 snapshot | 零 `className`、零直连 RN、零字符串标签 | age field 与 actions 在同一 content frame | age 可选、动作可达 | `maxLength=3` 与 optional 语义一致 | 键盘容量不足不制造 dead state | `testID` 来自 6.9/新表且动作可寻址 | 卸载后本地草稿消失；pending owner 只在业务恢复时回填 | MATCHED |
| sample console assembly | `apps/terminal/ui/integration/sample-console/src/assembly.tsx`、`terminalSurfaces.ts`、测试 | input frame/provider/dock 在每个 surface 成立 | surface 声明尺寸与 Android 比例渲染一致 | 主副屏仍由同一 assembly/store 驱动 | 无业务文案复制 | 业务仍不感知 keyboard owner 细节 | unavailable persistence 只作为已知环境诊断，不伪装成功 | frame contract 包裹 content/provider/dock | surface size 来自 terminalSurfaces，Web/Android 证据分开 | MATCHED |
| input package | `apps/terminal/ui/base/input/src/**`、测试、README/invariants | 原子 registry/snapshot、selection edit、keyboard owner 与 focus boundary | dock 按 `logicalHeight / declaredSurfaceHeight` 百分比渲染；scroll 为 full width | 不派业务 command；virtual key 只派 edit intent | 公共面不含业务词 | system↔none↔virtual 双向互斥；system→virtual 由旧 system owner dismiss；virtual→system 不 dismiss 已获焦的 system 目标；native blur 不夺 virtual owner | explicit blur/unregister/layer suspend 清理 | age focus 后 scroll-into-view；无祖先 no-op | token registry 与 snapshot capture 是唯一编辑期来源 | MATCHED |
| Android adapter | `apps/terminal/adapter/android/dual-screen/**` ActivityHandler/IME coordinator | 主屏系统 IME inset 消费；副屏不请求系统 IME | Presentation 只提供 surface 生命周期 | 同一 host/VM/store；副屏虚拟键盘由 input frame | 无业务文案 | primary `visible/bottomLogical` contract | focus/lifecycle cleanup 不泄漏 | 副屏 field 可 focus，但 system IME hidden | 本机双屏模拟器已实跑；POS 硬件未验 | MATCHED |

## focused 与静态证据

```text
@catering-v2s/ui-base-input          typecheck PASS; 7 files / 32 tests PASS
@catering-v2s/ui-base-primitives     typecheck PASS; 1 file / 7 tests PASS
@catering-v2s/ui-base-render         typecheck PASS; 8 files / 37 tests PASS
@catering-v2s/ui-feature-sample-member-desk
                                     typecheck PASS; 1 file / 17 tests PASS
@catering-v2s/ui-integration-sample-console
                                     typecheck PASS; 6 files / 13 tests PASS
@catering-v2s/kernel-feature-sample-member-registry
                                     typecheck PASS; 1 file / 9 tests PASS
TERMINAL_STATIC=PASS
TERMINAL_SKELETON_MODEL_TEST=PASS
TERMINAL_RENDER_STATIC=PASS
TERMINAL_LAYERING=PASS
```

静态模型红向量中的 `FAIL` 表示夹具变异被门抓住；真实树结果为 `PASS`，两者不合并表述。
本批没有创建 §9 比例静态门。

## 动态证据索引

- Android 脱敏结果：`doc/evidence/platform/terminal-input/runs/TERMINAL-INPUT-CP3-ANDROID-2026-09-06T05-00-00/README.md`
- Android 结论：在双屏 Android 模拟器上验证，未在真实 POS 硬件上验证；厂商定制 ROM 的
  Presentation/多显示差异以及真实分辨率、DPI、性能特征仍未覆盖。
- 副屏系统 IME：未作为能力放行；副屏字段焦点与虚拟键盘已实跑。
- Web：`yarn workspace @catering-v2s/ui-integration-sample-console web --port 8082` 成功
  bundler，`Web Bundled 2505ms`、`startup-ready`，`curl http://localhost:8082/` 返回 `HTTP/1.1 200 OK`
  与 `id="root"`。开发期告警包括 protected storage adapter 未注入、power bridge unavailable、
  web BackHandler 不支持与 CSS interop color-scheme runtime error；这些告警已如实登记，不能升级成
  Android 或浏览器刷新/resize 证据。
- S-12 的 Web 刷新语义与 S-26 的浏览器 resize 仍未取证；本批没有浏览器自动化。

## CP-3 修复边界

Android 复验曾先暴露两条真实实现接缝：

1. RN 密度归一化使声明键盘高度直接按数值渲染，副屏 dock 占 540 物理像素，年龄字段不可见；
   已改为比例渲染，并在详设 `doc/plans/platform/2026-09-05-v2s-terminal-input-implementation-design-codex.md`
   记录原因与边界。
2. `showSoftInputOnFocus=false` 的真实 RN `TextInput` 会发出 native blur；已由
   `InputProvider` 区分“无 IME 的平台副作用”与显式 blur/unregister/layer suspend，避免虚拟 owner
   被误清理；同一详设已记录该授权内实现修正，且有 focused regression test。

临时 CP-0 probe assembly、临时 diagnostic log 与探路组件已删除；当前仓内扫描不再发现
`TEMP_INPUT_DIAGNOSTIC` 或 production probe 接线。运行中的旧 Metro bundle 曾输出过历史
`TEMP_INPUT_DIAGNOSTIC` 行，但该字符串不在当前源码；本批交付前已停止 Metro、Web server
与 Android 应用，并复核 8081/8082 无监听、应用 `pidof` 为空。

CP-3 独立审查第二轮唯一 S 是 member-desk README 把撤回误写为保留本地 draft；主 agent
已按源码与详设修正为“撤回清 pending，本地编辑 draft 不跨卸载保留，只有 reject retry
从 PendingMember 回填”。除该文档口径外，第二轮其余逐项结果均为 MATCHED；按 review cycle
两轮上限，不再召集第三轮。
