# TER terminal admin login 主题化视觉 · IMPLEMENTATION review(静态)

- 评审人:Claude｜日期:2026-09-19
- REVIEW_TARGET=IMPLEMENTATION;**仅静态源码逻辑与证据分档**
- 方式:**先回源读实现**,证据文档只作对照

## 0. 结论

```
VERDICT=NO-GO
M/S/N=1/0/1
```

**S-1(elevated 隔离)与上上轮的 M-1(双入口守卫)都实质闭合**,实现质量高、包边界干净。

唯一的 Major 是:**三个新 semantic token 没有进 Android 的共享 Tailwind 工厂**,导致同一份代码在 Web 上成立、在 **Android 上 PIN 格没有底色、焦点格没有焦点环**。⚠️ **详设 §6.1 的改动分母也漏了那个文件**,所以逐代码与详设对账会显示 MATCHED —— 这条靠对账发现不了。

⚠️ 本轮只读、零写入(本文件除外),未执行 Web、Metro、Android、设备、DEV、seed、UAT 或部署。**不得把本文或 focused/static 结果表述为 acceptance、Android、Web、visual 或 release PASS。**

## 1. 逐项核验:做对的部分

| 核验项 | 结论 | 亲验落点 |
|---|---|---|
| `elevated` 是否只作用于 AdminLogin | ✅ | `PrimitiveContainer.tsx:8` 签名 `elevated = false` 默认;`:35` `elevated && layout === 'card' ? baseTokens.containerElevated : undefined` **双条件**;`containerElevated` 是**追加 class**,未改写 `containerCard`;全仓 production 只有 `AdminLogin.tsx:94` 一处传入 |
| 其他 card consumer 是否保持默认输出 | ✅ | 其余 `layout="card"` 消费方均不传 `elevated` ⇒ 得到 `undefined`,`cn(...)` 结果与改前一致 |
| `PrimitivePinInput` 是否无业务状态 | ✅ | `:1-4` 仅 import `vendor/slots`、`assertTestID`、`baseTokens` 与自身类型 —— **不依赖 `ui.base.input`**;全文无 `useState`/`useRef`/`useEffect`;`:20-22` `length` 非正整数即抛;`:27` `value.slice(0, length)` 只呈现不二次校验 |
| native `onTouchEnd` 与 browser `onClick` 是否都保留 | ✅ | `AdminLogin.tsx:21` `stopSurfaceDismiss = event => event.stopPropagation()`,`:113-114` **两个入口都传**;`PrimitivePinInput.tsx:24-26` 用 `typeof document === 'undefined'` 二选一,与 `VirtualKeyboard.tsx:31-33` 同款 ⇒ owner 持守卫、primitive 只透传 |
| 旧结构是否清除 | ✅ | `AdminLogin.tsx` 已无 `PrimitiveGrid`、无手工 `Pressable`、无 `'•'`/`'○'` |
| 两个 theme 是否各自提供 token 且 focus 不同 | ✅ | 两份 `global.css` 各有 `--color-surface-elevated`/`--color-surface-inset`/`--color-focus`;focus 值 **`30 64 175` vs `225 29 72`**,确为两套而非共用固定色;两份 `tailwind.config.cjs` 三个 mapping 齐全 |
| primitives 是否仍 theme-agnostic | ✅ | `theme/tokens.ts:5,39-44` 全是语义 class(`bg-surface-elevated`、`bg-surface-inset`、`border-focus`);`ui/base/primitives/src` **零硬编码颜色** |
| 六格方形 | ✅ | `pinCell` 含 `flex-1 aspect-square min-w-0` |
| 既有 cell testID | ✅ | `PrimitivePinInput.tsx:53` `${cellTestIDPrefix}:digit:${index}`,`AdminLogin.tsx` 传 `cellTestIDPrefix={adminTestIds.password}` ⇒ **`terminal.admin:password:digit:0..5` 逐字保留**;primitive 不自造业务 testID |
| 认证/错误/关闭/debug/keyboard/包边界 | ✅ | `keyboardPlacement: 'surface'`(`:44`)未动;debug password(`:100`)、fallback/clock-error/error 三个状态块(`:117-125`)原样;verify 的 `disabled={password.length !== 6 \|\| clockUnavailable}` 与 `onPress={submit}`、close 的 `onPress={onClose}` 未改;**`AdminLogin` 不 import 任何 integration 或 theme** |
| 证据分档 | ✅ | 证据文档 `:8-13` 明标 `WEB=OPEN_NOT_RUN`、`METRO=OPEN_NOT_RUN`、`ANDROID=OPEN_NOT_RUN`、`DEVICE=OPEN_NOT_RUN`、`VISUAL_ACCEPTANCE=OPEN`;`INDEPENDENT_DESIGN_REVIEW` 保持 OPEN;未把 focused/typecheck 升格 |

## 2. Major

### M-1 三个新 semantic token 未进 Android 共享 Tailwind 工厂;Android 上 PIN 格无底色、焦点格无焦点环

```
严重度=M
状态=CONFIRMED(静态配置链可证);Android 实际渲染 UNVERIFIED_REQUIRES_EVIDENCE
owning source=apps/terminal/assembly/base/android/config/index.cjs:78-98;详设 §6.1(`:276-277`)
需 Dexter 裁决=否
```

**仓内事实(配置链逐环打开)**

1. `ui/base/primitives/src/theme/tokens.ts` 的新 class 用三个语义颜色:`:5` `containerElevated: 'bg-surface-elevated shadow-lg'`;`:40` `pinCell: '… bg-surface-inset'`;`:41` `pinCellFocused: '… border-focus bg-surface-inset'`。
2. 两个 integration 的主题是 **Tailwind v3 形态**(`global.css:1-3` 为 `@tailwind base/components/utilities`)⇒ `:root` 的 CSS var **不会自动生成 utility**,必须有 config 的 colors mapping。
3. 两个 **integration** 的 `tailwind.config.cjs` 三个 mapping 齐全 ⇒ **Web 预览成立**。
4. 两个 **Android app** 的 `tailwind.config.cjs` 不自带 colors,而是 `require('@catering-v2s/assembly-base-android/config').createTailwindConfig({...})`,且**都不传 `theme`**。
5. `assembly/base/android/config/index.cjs:102` `theme: theme ?? {extend: {colors: sharedColors}}` ⇒ Android 走 `sharedColors`。
6. `:78-98` 的 `sharedColors` 是 **19 条字面量**:含 `surface`、`border`、`action`、`ok-*`、`warn-*`、`error-*`、`info-*`;**不含 `surface-elevated`、`surface-inset`、`focus`**(直接 `grep -c` 计数三者均为 **0**,未经管道)。

**推论与影响面**

Android 上这三个 class 不存在 ⇒ 无样式:

- `bg-surface-elevated` 失效 ⇒ 登录卡拿不到 elevated 背景;
- `bg-surface-inset` 失效 ⇒ **六个 PIN 格没有格内底色**;
- `border-focus` 失效 ⇒ **当前焦点格没有焦点环**。

⚠️ 一个很具体的形态:`pinCellInvalid` 用的是 `border-error-border bg-error-background`,而这两个 **在 `sharedColors` 里是有的** ⇒ **Android 上错误态能正常渲染,默认态与焦点态却渲染不出来**。三个视觉目标(方格、`*`、清晰焦点态)中,"清晰焦点态"在 Android 上直接落空;方格仍在(`aspect-square` 是布局 class 不依赖颜色)。

**为什么现有判据抓不到**

- 详设 §6.1 的必改分母(`:276-277`)**只列了两个 integration 的 `tailwind.config.cjs`**,没有列 `assembly/base/android/config/index.cjs` ⇒ **逐代码与详设对账会显示 MATCHED**;
- focused/typecheck 跑的是 web/jest 路径,不经过 Android 的 NativeWind 构建;
- 证据文档 `ANDROID=OPEN_NOT_RUN` 是诚实的"未验证",但该缺口**不是未验证,是未实现** —— 即便去跑 Android 也只会看到没样式,而不会看到"配置缺三行"。

**最小反例(复现方式)**:在任一 Android app 上打开 admin login。期望:六格有格内底色、当前格有焦点环。实际:格子只有边框与文字,焦点格与未焦点格**视觉相同**;输入错误时反而有红色底色与边框。

**最小修复**:在 `assembly/base/android/config/index.cjs` 的 `sharedColors` 增加三条,与两个 integration 的 mapping 同形:

```
'surface-elevated': 'rgb(var(--color-surface-elevated) / <alpha-value>)',
'surface-inset': 'rgb(var(--color-surface-inset) / <alpha-value>)',
focus: 'rgb(var(--color-focus) / <alpha-value>)',
```

同时把该文件补进详设 §6.1 的改动分母,并在判据表增一行:**三个 token 在 Android 与 Web 两侧的 mapping 必须同时存在**,红变异为"只在 integration config 声明而不在 Android 共享工厂声明"。

**为什么不是更大的方案**:不需要新机制,也不该把 token 搬进 base 或让 Android config 反向依赖 integration —— `sharedColors` 已经是"Android 侧统一消费各 integration CSS var"的既有模式,本批只是漏了三条。⚠️ 也**不要**改成让 Android app 各传自己的 `theme`,那会把一份共享 map 拆成两份,制造新的漂移面。

## 3. Notes

### N-1 PIN 容器 testID 漂移,但全仓无消费方

```
严重度=N
状态=CONFIRMED
```

改前容器为 `<PrimitiveGrid testID={`${adminTestIds.password}:cells`}>` = **`terminal.admin:password:cells`**;改后 `PrimitivePinInput.tsx:41` 为 `${testID}:cells`,而 `AdminLogin` 传入的 `testID` 是 `adminTestIds.passwordInput`(`terminal.admin:password-input`)⇒ 变为 **`terminal.admin:password-input:cells`**。

**影响可忽略**:全仓检索 `password:cells` 与 `password-input:cells`,**零消费方**(测试、runner、工具均未引用);六个 cell 的 testID 逐字保留。新 ID 在语义上也更自洽(它是 PinInput 自己的容器)。建议在实施记录里登记这次改名,避免将来有人按旧 ID 写用例。

## 4. 未发现问题、但静态无法证明的事项

- 本文所有结论均为**配置链与源码逻辑**可证;**Android 与 Web 的真实渲染未取证**,M-1 的现场形态属 `UNVERIFIED_REQUIRES_EVIDENCE`;
- focus 与相邻 surface/border 的**可读差异**按设计本就属 visual/Claude review 观察,本轮不判;
- 阴影在各平台的真实呈现(`shadow-lg` 在 RN/NativeWind 的落地)未取证;
- 证据文档所列 focused/typecheck 的**运行结果**我未复跑,只核了其分档声明与源码一致,**不对其真伪背书**。

## 5. 分档结论

- `static` = **已完成**(源码、配置链、token 定义、消费方计数可证);
- `focused` / `typecheck` = 实施方已执行并标 PASS,**本轮未复跑**,不据其下结论;
- `Web`、`Metro`、`Android`、`device`、`visual`、`release`、`cleanup` = **一律 OPEN,未升格**;
- **L2_USER_VISIBLE**:本批是 UI-bearing。M-1 指向**用户可直接感知的平台差异**(Android 焦点态不可见),结论为 **`L2_UNVERIFIED`**,在 M-1 关闭前不得记为 visual 或 acceptance PASS。

## 6. 授权边界

本轮只 review 已实现的 admin login 主题化视觉代码与证据。未修改源码、测试、依赖、脚本或构建产物;未扩大到业务 feature、shared virtual keyboard、Android App/Metro、splash、application icon、登录 backend 或部署。**NO-GO 指 M-1 关闭前不宜宣称本批实现就绪**;是否放行由 Dexter 裁定。
