# TER Admin console 非登录区 implementation-facing 详设与实施计划 · 独立评审（Claude）

```text
REVIEW_TARGET=DESIGN
VERDICT=NO-GO
M/S/N=3/2/2
```

```text
EVIDENCE_TIER=STATIC_SOURCE_AND_DOCUMENT_READBACK
SESSION=CONTINUED_SESSION（非 fresh；本轮全部行级断言按当前字节重新打开核对）
COMMANDS_RUN=无构建/测试/设备/Web/Metro/Android/Git 动作
WRITES=仅本文件
AUTHORITY=只评审详设与实施计划；不授权源码、测试、构建、设备或任何 acceptance
```

## 1. 总体判断

详设质量高：CP 分层清楚，owner 契约（尤其 `pairByHost` 的六步边界）写得比多数实施稿细，订阅边界逐页给了 equality 与红变异，§12/§13 把三条 owner 缺口 fail closed 而没有伪装成已有能力。挡住 GO 的是三件事：**一条已确认的产品口径在四份文档里三分**、**IA 自己登记的第四条源码阻断在详设里整个丢失**、以及**Android theme 分母第三次被漏掉**。前两条都不是文风问题，是实施者照着做会做错。

## 2. Findings

### M-1 · non-current surface 字段口径四文档三分，`IA_REF` 的两份 IA 互相矛盾，而 §0.4 漏掉了其中一份 · CONFIRMED / 需 Dexter 裁决

**仓内事实**（全部按当前字节）：

- 需求稿 R-9 现在写"**每个实际 surface 都必须显示逻辑分辨率、物理分辨率、主/副角色和就绪/可用状态**…缺失时物理分辨率数字位置显示'未知'"；J-2 第 172 行补"当前 surface 与非当前 surface 都遵守同一规则"；§7 第 4 项同口径。全文检索"该屏信息未提供"**出现 0 次**。
- IA frame inventory §2.3 第 68 行（IA-15）写"**每块**先在矩形上方显示主屏/副屏标题…逻辑分辨率标在框内…物理分辨率标在框外…状态标在框内"；§4 第 195 行、第 249 行同样写"每个实际 surface 都必须…"。该文件同样**没有**"该屏信息未提供"。
- IA high-fidelity 第 138 行（IA-15）写"非当前 surface 只显示存在性、角色和'该屏信息未提供'，不补分辨率/就绪态"；第 166 行、第 232 行重复该不对称。
- 详设 §0.3 第 55 行、§4.4 第 250 行跟随不对称。

**推论**：真实分歧不是"需求 vs IA"，而是 **需求 + IA frame inventory（对称）** 对 **IA high-fidelity（不对称）**。而详设 §0.4 第 60 行把它描述为"需求正本 R-9/§7.4 …；已确认 IA 的双屏帧与 §5.1 又明确规定非当前 surface 只显示存在性"——**没有提到 `IA_REF` 里的另一半 frame inventory 与需求同侧**。读者会以为是一比一取舍，实际是二比一。

**反例**：IA-15 这一帧在两份都被 Dexter 确认过的 IA 文档里画法不同。实施者无论按哪一份画，都能说自己"照 IA 实现"，而逐代码与详设对账（§13c）拿任一份做分母都能得出 MATCHED。

**另一层没人记录的事**：Dexter 对我 round-1 的 M-1 裁定是 (a) 不对称，我 round-2 GO 的需求稿 R-9 当时写的也是不对称。现在需求稿被改成对称，四份文档里没有任何一处记录这次反转由谁、何时、依据什么做出。

**已做对的部分**：计划 §1 第 7 项与 §2.3 第二条确实对这条 fail closed，CP-0 不裁定就不进 CP-1。方向对，但闸门瞄错对象——它挡的是"需求 vs IA"，没挡"IA 内部两份互相矛盾"。

**最小修复**：三件事，缺一不可。一，补记需求稿 R-9 由不对称改为对称的来源与依据；若是 Dexter 在确认 IA 时改口，写明。二，`IA_REF` 的两份 IA 先自洽——frame inventory §2.3/§4 与 high-fidelity §138/§166 对 IA-15 二选一。三，§0.4 改写成三方对照并把 frame inventory 列入。在这三件事完成前 CP-0 保持 OPEN 是正确的。

### M-2 · IA 登记的主机解绑源码阻断，在详设与计划里整个丢失 · CONFIRMED

**IA 已经登记过**：frame inventory §2.6 第 110 行与源码差距第 1 条（第 119 行）明确写：`evaluateTopologyOperation` 按 `paired` 允许主机解绑，但解绑 actor 先检查 `masterLocator`；真正的 MASTER 以 `peerIdentity` 表示配对而 `masterLocator` 为空，所以 `UNPAIRING-MASTER` 的成功转移当前不可达，并要求"不把它误删为无用页"。

**我亲验了三处**：
- `apps/terminal/kernel/base/topology/src/features/actors/actors.ts:289`：
  `if (current.masterLocator === null) throw new Error('Topology is not paired')`；
- `selectTopologyFacts.ts:38-39`：MASTER 的 `paired` 由 `peerIdentity !== null` 得出，`masterLocator` 为 null；
- `evaluateTopologyOperation.ts:31-34`：`unpair` 的资格只看 `paired`。

三者合起来：主机点"解除配对"→ 资格允许 → 命令下发 → actor 抛 `Topology is not paired`。

**一处我核过之后收回的推测**：我一度怀疑主机侧连清除路径都没有。不成立——`features/slices/topology.ts:44` 的 `clearMasterLocator` 同时清 `masterLocator`、`peerIdentity` 和 `peerReachable`，状态转移本身是具备的。缺的只是 actor 那条前置守卫写错了对象。修法是改守卫并确定正确前置，不是补清除路径。

**详设与计划的处置**：详设全文检索 `masterLocator`、`unpair actor`、`解绑 actor`、`actors.ts`，**零命中**。§12 未决项只有三条 `OPEN_BLOCKER`（display facts、page availability、direct pair），不含它；§13 七条停机条件不含它；§4.5 的 capability 草图把 `unpair` 原样保留；§4.6 的 IA-26 行写"主机解绑 busy；完成回目标选择"，读起来像已可用。计划 §2.3 的四条停止条件同样不含它。

**影响面**：IA-24 与 IA-25 的唯一主要动作"解除配对"，以及 IA-26 整帧，在主机侧成功路径不可达。本批没有设备授权，CP-5 的 focused/static 不会暴露它——交付时极可能以"测试全绿"结束，真机上主机永远解不开配对。

**最小修复**：列为第四条 admission blocker 与停机条件；§4.5 的 owner contract 写明 `unpair` 的正确前置（按 `paired` 而非按 `masterLocator`）与主机侧成功后应清除的事实集合；补一条 focused red mutation：把守卫改回 `masterLocator` 时主机解绑用例必红。**不需 Dexter 裁决**，但必须登记。

### M-3 · Android `sharedColors` 第三次被漏出 theme 分母 · CONFIRMED

**仓内事实**：详设 §5.2 第 364 行写"token alias 仍必须在两个 `theme/global.css` 与两个 `tailwind.config.cjs` 中同时存在"——只有 integration 两侧。详设与计划全文检索 `sharedColors`、`assembly/base/android`、`assembly-base-android`，**零命中**；计划 §2.2 的 token 扫描式范围也只有两个 integration 目录。

而两个 Android app 的 `tailwind.config.cjs` 调用 `createTailwindConfig` 且不传 `theme`，`apps/terminal/assembly/base/android/config/index.cjs:115` 的 `theme: theme ?? {extend: {colors: sharedColors}}` 因此生效。当前 `sharedColors` 已含 `keyboard-*` 七项（上一批补的），但没有任何 `admin-*`。

**后果**：§5.2 新增的 `admin-shell-*`、`admin-content-*`、`admin-inset`、`admin-action*`、`admin-surface-current/noncurrent` 在 Android 上全部生成不出 utility——整个 Admin console 面板在两个 Android app 上没有背景、边框和前景色。这与 admin-login 批、键盘批出过的是同一个缺陷；键盘批已经把 `sharedColors` 纳入分母并补了 owned config test，本批又退回去了。

**最小修复**：§5.2 与计划的 theme 分母加入 `apps/terminal/assembly/base/android/config/index.cjs` 及其 owned config test；CP-0 的 token 扫描范围加上该文件；补红变异——只改 integration 不改 `sharedColors` 时该 test 必红。

**建议给 Dexter**：这是第三次同形重复，值得考虑一条机器约束（例如 primitives token 名与三处 mapping 的一致性检查），而不是每批靠 review 抓。

### S-1 · mobile 多 surface 异常态有需求、无 frame、无实现 owner

需求稿 R-9 第 6 行规定："mobile 形态只呈现一个实际 surface；如果输入事实声称 mobile 有多个 surface，页面必须显示 display facts 异常/未提供，而不是画第二块屏。"

但这个异常态在 IA 里没有 frame：frame inventory §2.3 第 70 行只说"mobile 形态只有单屏 frame"；详设 §4.6 的 IA-14 行只写"竖屏单列、一块真实 surface map"。§4.6 自称是"完整 IA 分母"，却不含这个由需求明文规定的状态。

`displayCount` 来自 DisplayManager，mobile 形态设备外接显示时确实可能返回 ≥2，所以这不是纯理论态。

**最小修复**：要么补一帧进 §4.6 分母，要么在 §4.6 明确该态复用 IA-04/IA-08 的空/错态，并给出判定条件与用户文案。

### S-2 · `IA_REF` 指向两份 IA，但没有规定谁是形态正本

详设 `IA_REF` 同时列 frame inventory 与 high-fidelity，第 18 行只说"图片与 IA 规格表仍是可见形态的正本"，没有规定两者冲突时以哪份为准——而它们在 IA-15 上确实冲突（M-1）。

上一批键盘的教训正是"图不是正本、规格表才是"。本批需要同样一句话：哪份是形态正本、哪份是清单、冲突时如何处置。

### N-1 · action matrix 覆盖了 `switch-role`，漏了 `query-host` 的归类

R-16 要求 action matrix 的分母覆盖 `TopologyOperation` union 全集。§0.2 第 43 行与 §4.5 把 `switch-role` 明确标为资格-only 不画按钮，做得对；但 `pairByHost` 上线后 `query-host` 这个 union 成员是保留为资格-only、还是随 `queryMasterIdentity` 一并收窄，详设没有写。建议在 §4.5 的 action matrix 或 §12 补一行。

### N-2 · CP-0 的 token 扫描式抓不到本批新增的 token 族

计划 §2.2 第 58 行的 `rg -n 'color-(login|surface|action|focus|ok|warn|error|info)' …` 不含 `admin`，扫不到本批要新增的 `admin-*`；范围也只有两个 integration 目录（与 M-3 同源）。建议同时补 `admin` 前缀与 Android config 路径。

## 3. 已核对且成立，不构成 finding

- **IA 分母完整**：IA-01 至 IA-29 与 IA-32 共 30 帧在 §4.6 逐行给了 owner、形态和"必须可见/必须不可见"；IA-30/IA-31 已声明撤销且不复用。计数我逐个 grep 过，无遗漏。
- **`PrimitiveDropdownSelect` 不是重复造轮子**：`PrimitiveForms.tsx:118` 的 `expanded` 确实硬编码为 `false`，`:120-124` 的 `onPress` 确实是 `(selectedIndex + 1) % options.length` 循环。§0.2 第 38 行的描述准确，新增真实 dropdown 且保留旧语义是对的。
- **mobile 只有一个真实 dropdown**：§0.3 第 49 行、§4.6 的 IA-02/04/06/08/10/12/14/17 各行、§13 停机条件第 4 条三处一致，且把"出现第二 selector 或横向 tab"列为停机而不是仅仅禁止。
- **page gate 与 operation eligibility 严格分层**：§4.5 第 298 行"operation eligibility 只用于动作卡 disabled/reason，不得升级为 page gate"，与 §1.2 拒绝"读代表性 operation reason"的替代方案一致，正是我上一轮 S-1 要的。
- **`pairByHost` 的 owner 边界闭合**：§4.5 第 274 至 281 行的六步（输入规范化、identity 与 `moduleName` 校验、前置校验不由 UI 重复推导、单 command boundary 内写 locator/identity 并切 `SLAVE`/`VICE`、typed phase failure 与回滚/保留语义、成功与失败都有 readback），并明确"不能只测 `pairByHost` 被调用"。这是本稿写得最好的一节。
- **display facts 与 topology owner 没有被当成现有能力**：§0.2 第 40/42 行、§1.2 两张替代方案表、§12 三条 `OPEN_BLOCKER`、§13 第 1/2/5 条、计划 §2.3 前三条，口径一致且都 fail closed。评审请求的第 2 项在这两条上成立。
- **订阅边界**：§3.1 四页各自列了只订阅的事实、equality/identity 与明确不订阅，并把全 root 订阅、等价对象漂移、跨页订阅列为红变异。
- **档位诚实**：`IMPLEMENTATION_AUTHORITY=false`、`RUNTIME/WEB_METRO_ANDROID_DEVICE=NOT_AUTHORIZED`、§12 的 visual/native/device 与 L2 均标 OPEN，没有把 static/focused 升格。

## 4. 结论

`VERDICT=NO-GO`，`M/S/N=3/2/2`。

M-1 需要 Dexter 一句裁定（non-current surface 到底对称还是不对称），并要求两份 IA 先自洽；M-2 与 M-3 在 Codex 既有边界内可自主修复，但都必须在进入 CP-1 前登记为 blocker——M-2 尤其重要，它是唯一一条"照当前详设实施、focused 全绿、真机功能坏掉"的缺陷。两条 Significant 与两条 Note 随修订带上即可。

本结论只覆盖详设与实施计划的可实施性；不代表源码实现、测试、Web、Android、visual、release、cleanup 或 acceptance PASS。
