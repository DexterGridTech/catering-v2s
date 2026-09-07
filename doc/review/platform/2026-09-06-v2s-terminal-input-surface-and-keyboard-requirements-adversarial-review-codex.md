# TER terminal 输入承载形态与虚拟键盘需求独立对抗复核记录

REVIEW_CYCLE_ID=TERMINAL_INPUT_SURFACE_AND_KEYBOARD_REQUIREMENTS_2026-09-06
REVIEW_TARGET=REQUIREMENTS
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
READ_ONLY=true

## Round 1

REVIEW_ROUND=1
VERDICT=NO-GO
M/S/N=3/1/1

独立 reviewer 对以下问题给出 finding：

- M-1 `CONFIRMED`：键盘文档把所有布局在所有 PRIMARY/SECONDARY/竖屏/Web
  fixture 上都列为真实消费者，但 alpha/financial 只计划放在 PRIMARY-only
  `MemberForm`。最小修复是拆成真实业务消费者矩阵与 input base geometry harness
  矩阵。
- M-2 `CONFIRMED`：形态文档规定竖屏不建 SECONDARY，却没有写 host/adapter 的
  owner、判断时点、方向变化时的 cleanup 与可证伪反例。
- M-3 `CONFIRMED`：Web transform 与 input frame 的实际 pointer 命中盒子关系存在
  两条未裁定路径，可能继续用 transform 前的逻辑尺寸冒充实际 hit target。
- S-1 `PARTIALLY_CONFIRMED`：sample-only alpha/financial 方案方向诚实，但缺少
  sample 业务页中的可见位置、文案、生命周期、dirty 与提交隔离的产品闭环。
- N-1 `CONFIRMED`：形态文档与 handoff 中的 Android handler 路径漏了 `adapter`
  层级。

## 主 agent 处置

主 agent 只修改需求工件与 handoff，不修改源码、测试、依赖，不运行 Android/Web：

1. 在键盘需求中将 `MemberForm` 的 alpha/financial 明确为 PRIMARY-only 的
   “输入能力验证（仅 sample）”区域，位置为业务字段之后、提交/取消动作之前；
   加入“不保存到会员资料”文案、挂载/卸载清理、业务 dirty/command/state 隔离、
   不复制到 CustomerMember/SECONDARY 的规则与 KEY-R9 红向量。
2. 将原单一矩阵拆成真实业务消费者矩阵与 input base geometry harness 矩阵；
   SECONDARY 的 alpha/financial 只由 harness 覆盖，不扩张业务拓扑。
3. 在形态需求新增 host/adapter 拓扑 owner：`onDidCreateReactActivityDelegate`
   中调用 `ensureSecondarySurface` 之前读取 PRIMARY Activity 当前方向；竖屏
   禁止 Presentation/SECONDARY，横屏才允许按同一 display snapshot 创建，并固定
   方向切换时的 stop → detach → clear 不变量。
4. 将 Web 交互尺寸收敛为单一路径：`InputSurfaceFrame` 不得被改变 pointer 命中
   盒子的 ancestor transform 包裹，onLayout 必须等于实际命中布局盒子；删除物理
   尺寸桥接的逃生口并补 FORM-R5 反例。
5. 更正 Android handler 的仓根相对路径，并同步 handoff。

## Round 2

REVIEW_ROUND=2
ROUND_FINAL_DECISION=SELF_DECIDED
VERDICT=GO
M/S/N=0/0/0

第二轮为 fresh、只读、证伪式定向复核，输入包含两份新需求、历史首稿、既有 input
需求，以及 `parts.ts`、`MemberForm.tsx`、`CustomerMember.tsx`、sample kernel
types/commands、dev-host 与当前 Android handler。未运行 Android/Web。

逐项结论：

- M-1 `REJECTED_WITH_EVIDENCE`：真实业务矩阵与 harness 矩阵已分离；alpha/financial
  只在 PRIMARY-only `MemberForm` 出现，且不进入 command/state；KEY-R3 覆盖删除、
  复制到 SECONDARY 或污染业务边界的反例。
- M-2 `REJECTED_WITH_EVIDENCE`：host/adapter 在 `ensureSecondarySurface` 前读取
  PRIMARY Activity 当前方向，竖屏禁止 Presentation/SECONDARY，横屏才允许按
  display snapshot 创建；当前 handler 接缝与既有 cleanup 顺序已核对。
- M-3 `REJECTED_WITH_EVIDENCE`：Web input frame 只剩无 ancestor transform、
  onLayout 等于实际 pointer 命中盒子的路径；逻辑尺寸不能再作为物理 hit target
  证据。
- S-1 `REJECTED_WITH_EVIDENCE`：sample-only 字段的位置、文案、PRIMARY-only、
  挂载/卸载清理、dirty 隔离、command/state 隔离已完整写出。
- N-1 `REJECTED_WITH_EVIDENCE`：当前形态需求与 handoff 均使用准确的
  `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`。

## 结论边界

两份需求当前静态审查为 GO，允许交 Dexter 与 Claude 做需求 review。该结论不表示
详设、源码实现、编译、Android/Web 运行、截图、UAT 或真实设备验证已完成。
