# TER Admin console 非登录区详设与实施计划 · 复评（Claude round 2）

```text
REVIEW_TARGET=DESIGN
VERDICT=NO-GO
M/S/N=0/1/1
```

```text
EVIDENCE_TIER=STATIC_SOURCE_AND_DOCUMENT_READBACK
SESSION=CONTINUED_SESSION
COMMANDS_RUN=无构建/测试/设备/Web/Metro/Android/Git 动作
WRITES=仅本文件
AUTHORITY=只评审详设与实施计划；不授权源码、测试、构建、Web、Android、设备或 acceptance
```

## 1. 六项复核结果

**五项完全关闭，第一项差两句话。**

### 1. current/non-current 五份文档一致 —— `PARTIALLY_CONFIRMED`

方向收敛正确，且收敛到 Dexter 已裁定的不对称口径。需求 §1.4（第 100 至 102 行）把此前的对称
文案明确记为**文档漂移而非新的产品裁定**，这一句是本轮处置里最重要的一处——它让反转有了出处。
其余落点：需求 7 处、frame inventory 4 处、high-fidelity 3 处、详设 3 处使用同一口径；计划第 30
行与第 157 行用"non-current 不能出现 resolution/readiness/physical"表达同一分母，措辞不同但无歧义。

但**两处对称残留仍在**，见 §2 的 S-1。处置记录第 20 行称"已把需求 R-9/J-2/§7、frame inventory、
high-fidelity IA、详设与计划统一"，按当前字节这句话还不成立。

### 2. MASTER unpair 仍为源码 admission blocker —— `CONFIRMED`

闭合得很完整，而且**没有被误报为已修复**（处置记录第 21 行明写"未修改源码"）。落点九处：
详设第 15 行与计划第 13 行的 `ADMISSION_BLOCKERS` 头部；详设 §0.2 第 43 行的事实行（三个
owning source 都点名）；详设 §4.5 第 285 行的 owner contract，含"以 typed `paired` 作为前置而
不是把 `masterLocator` 当通用 locator 前置"、成功后清三项事实并 read back、红变异、以及
"在该 blocker 关闭前，`IA-24`、`IA-25`、`IA-26` 只可作为已设计但不可实施的状态"；详设 §12
第 511 行 `OPEN_BLOCKER`；详设 §13 第 524 行停机条件；计划第 69 行 CP-0 停止条件；计划第 96 行
focused 覆盖；计划第 98 行红变异；计划第 239 行对账行。

我上一轮提醒的那个坑也避开了：§12 第 511 行明确把"只补第二条清除路径"列为禁止，说明作者读懂了
`clearMasterLocator` 已经连 `peerIdentity` 一起清、缺的只是守卫这一点。

### 3. Android theme 分母 —— `CONFIRMED`

详设 §0.2 第 46 行新增事实行（两个 app 的 Tailwind 继承 `sharedColors`）；§5.2 第 359 行与第 370
行把完整分母写死为**五处 mapping 加一个公共配置契约测试**：两个 integration `global.css`、两个
integration `tailwind.config.cjs`、Android `sharedColors`，以及
`assembly/base/android/test/keyboardThemeConfig.test.ts` 所属的公共配置契约测试；并要求检查两个
app 的继承结果，"只改 integration、不改 `sharedColors` 的红变异必须变红"。§12 第 512 行、§13
第 528 行、计划第 60 行扫描范围（含两个 android app 目录与 base config/test）、第 123、128、134、
252、272 行均已覆盖。

我核了被引用的测试文件确实存在：`apps/terminal/assembly/base/android/test/keyboardThemeConfig.test.ts`
（上一批键盘时建立）。引用不是悬空的。

### 4. mobile 多 surface 复用 IA-14 的 `display-facts-error` 变体 —— `CONFIRMED`

frame inventory 第 72 行与第 197 行、high-fidelity 第 141 行、详设 §4.6 的 IA-14 行（第 325 行）、
计划第 157 行与第 238 行一致：同一 frame 的 typed 变体，保留运行状态页、顶部单 selector 与单列，
显示 typed 异常/未提供原因，**不生成第二块矩形**。不新增 frame 因而不破坏 30 帧分母，比我上一轮
建议的"补一帧"更小，采纳得对。需求稿没有出现 `display-facts-error` 这个词是正确的——需求层不该
命名 IA 变体，R-9 第 6 行的业务要求本来就在。

### 5. `query-host` 仅为 direct-pair 内部实现细节 —— `CONFIRMED`

详设 §4.5 第 287 行给了 `TopologyOperation` union 的完整内部覆盖表：`query-host` 归
`internal-only/资格执行细节`，不生成 IA-ID、按钮或独立状态；`pair` 由 `pairByHost` 承接 admin-facing
调用；`unpair` 覆盖 MASTER/SLAVE 两侧；`enable-host` 保留；`switch-role` 归 `non-executable/资格-only`
不渲染按钮。并要求 CP-0 先确认 `queryMasterIdentity` 与旧 `pair(locator)` 的其它消费者才能退休或
保留兼容面。计划第 193 行同口径。union 五个成员逐一有归类，R-16 的分母要求闭合。

### 6. IA 正本优先级、CP-0 停止条件与红变异 —— `CONFIRMED`（一处措辞见 N-1）

详设第 18 行把两份 IA 的职责切开且不重叠：frame inventory 是用户旅途、可见内容、状态、文案和
动作的**语义正本**；high-fidelity 是同一 IA-ID 的位置、尺寸、形状、颜色、图标、字体和视觉 token
的**视觉正本**；冲突先修 IA，不由实施者择一。这正是上一批键盘"图不是正本、规格表才是"那条教训
的正确落地。

CP-0 停止条件四条加一条关闭条件（计划第 67 至 73 行），三条 admission blocker 各有对应条目；
红变异在计划第 98 行（topology 八项，含 unpair guard 回退、漏清 `peerIdentity`/`peerReachable`、
reconnect 回未配对、switch-role 变按钮）、第 128 行（Android mapping）与第 272 行（停 CP-2）成链。

## 2. Findings

### S-1 · 两处对称残留仍在，且都位于自称"不可越过"的规范段落 · CONFIRMED

**仓内事实（当前字节）**：

1. `doc/plans/platform/2026-09-19-ter-admin-console-non-login-ia-frame-inventory-codex.md:207`，
   位于 **§5 不可越过的事实边界**：
   "laptop 双屏 frame 必须画出两块真实 surface；**每块**标题在矩形上方，逻辑分辨率在矩形内
   长边/高边，物理分辨率在矩形外长边/高边，状态在矩形内，并按真实 surface 宽高比绘制。"
   与同一文件第 70 行（IA-15 行）、第 128 行（IA-32 行）、第 197 行、第 251 行直接冲突。
2. `doc/plans/platform/2026-09-19-ter-admin-console-non-login-requirements-codex.md:337`，
   位于 **§5.4 术语边界**：
   "laptop 双物理屏时，运行状态 tab 应同时表达两块物理屏，并**在每块 surface 内展示该屏自己的
   逻辑/物理分辨率、角色与状态**；没有权威物理值的 surface 在对应数字位置显示'未知'。"
   与同一文件的 R-9 和 §1.4 漂移记录直接冲突。

**推论与影响面**：这两句都在各自文档里最强的规范段落。尤其第二处：它规定的正是 IA-32
跨 tab 对照帧的语料，而 IA-32 在 frame inventory 第 128 行的自有行已经改成不对称——同一个工件
被两份文档描述成不同字段集。做 IA↔code 对账时，拿"不可越过的事实边界"当分母会得到与其余九处
相反的结论。

**为什么定 S 而不是 M**：方向已经压倒性清楚——五份文档约十处写不对称，加上需求 §1.4 的漂移
记录和 Dexter 的原始裁定。实施者按残留造出对称版本的概率低，更可能的后果是对账时出现一个
本可避免的 `OPEN`。这不是设计缺陷，是一次清扫没扫干净。

**最小修复**：改写这两句与其余口径一致即可——frame inventory §5 那条改为"当前 surface 标注
逻辑/物理分辨率与状态；非当前 surface 只标存在性、主/副角色和'该屏信息未提供'"；需求 §5.4
那句同样收敛，并保留其本意（两块屏都要表达、拓扑与物理副屏语料不混）。

**附带**：处置记录第 20 行"已把…frame inventory…统一"按当前字节不成立。请同时更正该行，
不要让下一个读者以为这项已闭合。

### N-1 · IA 正本优先级只写在详设，计划与两份 IA 自身都没有声明

详设第 18 行的 semantic/visual precedence 规则是本轮的好处置，但处置记录第 24 行称"详设和计划
均引用该规则"——计划全文没有该规则（我检索 `语义正本`、`视觉正本`、`precedence` 只命中详设
第 18 行）。两份 IA 文档也都没有在自己的头部声明"我负责哪一半"。

不阻断：实施者读详设即可得到规则。但建议在计划的对账门与两份 IA 的头部各加一行，让任何单独
打开一份 IA 的人都知道它管什么、不管什么。

## 3. 结论

`VERDICT=NO-GO`，`M/S/N=0/1/1`。

上一轮三条 Major 全部关闭，且关在正确层级：M-2 明确写了"未修改源码"、把 IA-24/25/26 标为
"已设计但不可实施"，没有把文档修订冒充源码修复；M-3 把分母扩到五处 mapping 加公共配置测试，
被引用的测试文件我核过确实存在；M-1 的方向按 Dexter 已有裁定收敛，并用需求 §1.4 给这次反转
补了出处。两条 Significant 与两条 Note 也都闭合。

挡住 GO 的只有 S-1 的两句话。它们不会让实施造出错的东西，但它们位于两份文档各自最强的规范段落，
而处置记录声称该项已统一。改这两句加更正处置记录第 20 行之后即可 GO，不需要再走完整一轮——
下一轮我只核这两处与处置记录，以及 N-1 的三行补充。

三条 admission blocker（`DISPLAY_FACTS_OWNER`、
`TOPOLOGY_PAGE_AVAILABILITY_AND_DIRECT_PAIR_OWNER`、`MASTER_UNPAIR_GUARD`）仍然全部 OPEN；
GO 之后也只表示详设与计划可进入实施决策，不代表这三扇门已关，更不代表源码、测试、Web、
Android、visual、release 或 acceptance PASS。
