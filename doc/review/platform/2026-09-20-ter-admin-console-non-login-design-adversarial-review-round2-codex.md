# TER Admin console 非登录区详设与实施计划 · 独立对抗复核 Round 2

```text
REVIEW_TARGET=DESIGN
REVIEW_CYCLE_ID=2026-09-20-TER-ADMIN-CONSOLE-NON-LOGIN-DESIGN
REVIEW_ROUND=2
REVIEW_ROUND_LIMIT=2
reviewerKind=INDEPENDENT_SUBAGENT
VERDICT=GO_WITH_UNVERIFIED_UI
M/S/N=0/0/0
L1_ENGINEERING=PASS_WITH_ADMISSION_BLOCKERS_DISCLOSED
L2_USER_VISIBLE=PASS
L3_UNVERIFIED=owner blockers, implementation, focused/static, Web, Android/native, device, visual
WRITES=NONE
COMMANDS=read-only source/document inspection; no build/test/device/network
```

## 1. 复核范围与结论

本轮由 fresh 只读独立 reviewer 针对上一轮 Claude findings 的修订进行定向证伪。未修改文件，也未运行构建、测试或任何运行环境动作。

结论为 `GO_WITH_UNVERIFIED_UI`，`M/S/N=0/0/0`。这表示当前详设与计划的文档结构可以进入 Claude 复评；不表示源码已经实施，也不关闭以下三个 admission blocker：

- `DISPLAY_FACTS_OWNER`；
- `TOPOLOGY_PAGE_AVAILABILITY_AND_DIRECT_PAIR_OWNER`；
- `MASTER_UNPAIR_GUARD`。

## 2. 逐项结果

### M-1 · current/non-current surface 口径

`CONFIRMED`。需求、frame inventory、high-fidelity、详设、计划均统一为：current surface 显示逻辑/物理分辨率与就绪/可用状态；non-current 只显示存在性、主副角色和“该屏信息未提供”。需求 §1.4 记录旧对称文字为文档漂移；frame inventory 负责语义字段/状态/文案/动作，high-fidelity 负责同 IA-ID 的几何与视觉 token。未发现后续文档恢复旧对称口径。

### M-2 · MASTER unpair

`CONFIRMED`。当前源码仍存在真实反例：`selectTopologyFacts` 在 `MASTER + peerIdentity` 时判定 `paired`，而 unpair actor 仍先检查 `masterLocator`。设计与计划已将其登记到 admission blocker、owner contract、stop condition 和 red mutation，明确要求使用 typed `paired`、清理三项事实并 readback；没有把它写成已修复。

### M-3 · Android `sharedColors`

`CONFIRMED`。当前 `sharedColors` 仍没有本批 `admin-*` token，公共 config test 仍只覆盖既有 keyboard token；设计/计划已把 Android base config、公共 config test 和两个 Android app 的继承路径纳入 theme 分母、CP-0 扫描与 CP-2 gate，并规定只改 integration、不改 sharedColors 的变异必须变红。

### S-1 · mobile 多 surface

`CONFIRMED`。需求、线框、高保真、详设、计划均把它定义为 `RUNTIME-M-SINGLE-SURFACE`/IA-14 的 `display-facts-error` variant：保留 mobile 竖屏单列和唯一 selector，显示 typed 异常/未提供原因，不生成第二块矩形。

### S-2 · IA 正本优先级

`CONFIRMED`。frame inventory 是语义正本；high-fidelity 是相同 IA-ID 的视觉正本；high-fidelity 不得新增、删除或改写语义；发生冲突先修 IA，详设/实施不得自行择一。

### N-1 · `query-host`

`CONFIRMED`。已归类为 direct-pair 的 internal-only identity/protocol 细节，不生成 IA-ID、用户按钮或独立状态；用户动作由 `pairByHost` 承接。`unpair` 覆盖两侧，`enable-host` 保留，`switch-role` 为 non-executable/资格-only。

### N-2 · token 扫描分母

`CONFIRMED`。CP-0 扫描已覆盖 `admin-*`、两个 integration theme/Tailwind、Android `sharedColors`、公共 config test 以及两个 Android app 的 Tailwind 继承路径。

## 3. 当前状态边界

本轮没有发现新的跨文档状态元数据偷渡或语义矛盾。`DisplayFactsReadModel.status/readiness` 仍明确是计划中的 owner contract，不是当前源码能力声明。当前 review 之后仍须由 Claude 复核；不得将本轮 `GO_WITH_UNVERIFIED_UI` 改写为 implementation、visual、Android、device 或 acceptance PASS。
