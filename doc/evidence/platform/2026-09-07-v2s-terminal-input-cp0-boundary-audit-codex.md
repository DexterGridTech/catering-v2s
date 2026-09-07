# TER terminal input CP-0 boundary audit

STATUS=PASS_STATIC_BOUNDARY_AUDIT
SCOPE=input-only
RUNTIME=NOT_RUN

## 结论

本 CP 只确认 input 包与既有 Android carrier 的边界，不改变 App 的方向锁、Manifest、Expo
app.json、Presentation 拓扑、IME policy 或设备策略。input 的横竖屏展示由每个
`InputSurfaceFrame` 自己的 `onLayout` frame 尺寸决定；App 是否锁定 landscape 不是 input
包的准入条件。

## 已核对事实

- `apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt`
  继续作为既有 surface carrier 与 `imeInsetsSource` 的 Android owner；本 CP 不改其 host、
  Presentation 或生命周期接缝。
- `apps/terminal/assembly/android/sample-terminal/android/app/src/main/AndroidManifest.xml`
  与 `apps/terminal/assembly/android/sample-terminal/app.json` 的现有方向声明属于 App 形态，
  不属于 input 的实现输入；本 CP 不修改它们。
- `apps/terminal/ui/integration/sample-console/src/assembly.tsx` 仍是 input 的唯一
  `imeInset` 传递接缝；CP-1 将移除静态 `terminalSurfaces` 尺寸桥，保留该平台事实。
- input 包不存在读取 DisplayManager、Dimensions、window、Platform、其它 surface 测量或
  `terminalSurfaces` 的必要性；CP-1 的尺寸真相改为自身 root View 的 `onLayout`。

## 停止条件核对

截至本 CP，input 不需要修改方向锁、创建第二 host/VM/process、读取其它 surface 尺寸或
新增设备策略。因此没有触发停止条件。副屏系统 IME 的产品决定保持为“不启用”；本 CP
不以副屏系统 IME 运行结果作为 input 通过条件。

## 证据边界

这是静态 source audit，不证明 Android/Web 运行行为，也不证明真实 POS 硬件行为。后续
CP 的 focused、Web、Android 证据必须分档记录。
