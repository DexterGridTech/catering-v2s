# TER 虚拟键盘正式需求：作者处置记录

> REVIEW_CYCLE_ID=`TER_VIRTUAL_KEYBOARD_OPTIMIZATION_REQUIREMENTS_2026-09-23`；`REVIEW_TARGET=DESIGN`。本文件是主 agent 的 intake，不代替独立审查 verdict。

## 第一轮 intake

独立 reviewer 结论 `GO_WITH_UNVERIFIED_UI，M/S/N=0/0/0`，无 finding 可逐条裁决。其 L3 限定为未读到原始会话措辞、未运行 Web/Android/device、后续 IA/详设/代码未形成；本需求仍只属静态正本。不存在由 reviewer finding 驱动的修复。

## 主 agent 另行发现的同根边界及处置

| 入口／类别 | 回源事实与反例 | 最小处置及范围 |
| --- | --- | --- |
| `field` placement／`CONFIRMED` | `InputKeyboard.tsx` 的 `field` 分支以 `parentWidth` 为 host；`provider.test.tsx` 和 `inputFieldOptions.test.ts` 有该公共路径，生产注册目前均为 `surface`。原需求草稿同时说“全 surface 宽”和“field placement 待复核”，可能让详设把窄父容器 100% 误判为 A。 | 正式需求 §2、VK-R01、§4、AC-07 明确：若保留可显示 `field`，窄父容器仍不能豁免所属 surface 全宽；退役须显式给出影响。没有在需求阶段强制具体组件树或新业务消费者。 |
| 一次性 Shift 被零字符插入消耗／`CONFIRMED` | `editText.ts` 的 `insertText` 无论 `inserted` 是否为空均写 `shift:false`。`maxLength` 已满即构成反例。 | VK-R03、AC-03 与 §8 说明这是要改变的旧行为，旧 `maxLength` 限制和 selection 不变。 |
| 点击非输入区／`CONFIRMED` | `useInputFocusController.dismissActiveField` 遇非 business focus scope 提前返回；管理员 PIN 不等同 business 点击外部收起。 | VK-R05、VK-R08、AC-04 改为按 focus scope 保留既有关闭语义，不把 business 行为强压 admin。 |
| PIN 内部滚动／`CONFIRMED` | 管理员 PIN `nativeLess:true`，没有普通 `PrimitiveInput` 测量 ref，也没有现成 `InputScrollArea`。 | VK-R08、AC-07 强调真实可见锚点与滚动承载是后续设计责任；物理容量不足时不假报可见。 |
| 最终可视容量／`CONFIRMED` | `keyboardHeight.ts` 的宽度计算与 `InputKeyboard.tsx` 渲染使用的窄 dock 路径可能不是同一宽度分母。 | VK-R08、AC-07 要求以最终渲染外框与内边距／gap 判断支持；不提前规定计算函数。 |
| Shift 状态误判为换键盘／`CONFIRMED` | 字符键帽随 Shift 变化，但 keyboard layout 类型未变；若按“实际键位形态不同”字面触发旧下新上，每次 Shift 都会重弹。 | 第一轮修订 VK-R07 将 modifier 与布局／外框变化区分；其中把同布局 resize 的外框变化也当成换键盘仍过宽，已在下文第二轮后自决时进一步收窄为**布局类型变化才换键盘**。 |
| 旧输入需求优先级／`CONFIRMED` | 2026-09-05 输入需求 §1b.3/§1b.6 也要求程序虚拟键盘收缩内容；原草稿 §8 只列较新的承载详设和视觉 v2。 | §8 增列旧正本冲突，并限定本批只改程序键盘的覆盖模型，不暗改系统 IME。 |

这些补强针对已证实的歧义和反例；未修改分析稿、IA、详设、源码、测试或运行态。第二轮 fresh reviewer 应从修订后的需求字节先独立证伪，再检查这些处置是否引入新矛盾。当前不把任何静态判断上升为运行通过。

## 第二轮 intake 与硬停止后的作者自决

独立 reviewer 对修订前字节 `0fc5a248…` 给出 `NO-GO，M/S/N=0/1/0`；唯一 S-1 是 Shift armed 后切换字段／scope 的状态归属不明。该 verdict 保持原样，不能改写为 reviewer GO；同 cycle 两轮上限已用尽，不召集第三轮。

| finding | 状态与回源 | 方案比较与作者自决 | 修订落点／剩余证据边界 |
| --- | --- | --- | --- |
| S-1 · Shift 焦点生命周期 | `CONFIRMED`。`useInputField.ts:28–35` 把 Shift 放在每字段 `editState`；`editText.ts:94–107` 的 focus-next／complete 不清它；`useInputFocusController.ts:66–114` 在焦点交接和中间 blur 上另有 owner 规则。原需求只说“下一次成功插入”，未定义真正离开 A 后的归属。 | 对比“保留在 A 直至返回”“转移给 B”“真正离开即清”：前两者使一次性 Shift 跨焦点会话潜伏或迁移，用户见到的键帽状态不易预测。按 Dexter 已裁定“简单 Shift、不要 CAPS 逻辑”的最小解释，自决为**当前字段当前焦点会话局部**：真正转字段、系统 owner、完成、显式收起、scope 切换或卸载即清；未真正失去 owner 的 React Native 中间 blur 不清；零字符插入且仍聚焦不清。此为新需求语义，不伪称现状已满足。 | 正式需求 VK-R03、VK-R07、AC-08、§6、§8 明列状态与反例。尚未有 IA/详设/代码或运行验证；若 Dexter 对这个细节另有产品取舍，可直接修改本稿语义，不能把 reviewer 的原 NO-GO 抹掉。 |

另有作者自行从原分析稿 §5.3 找到的同布局 resize 反例：它要求**同布局留在原位，同时重算 `K` 与避让**；修订前 VK-R07 把“外框几何不同”误列为旧下新上触发条件。已将触发条件收窄为布局类型变化，并说明同 surface resize 原位适配、跨 surface 分别交接；AC-06 同步列为反例。该修订非第二轮 finding，也未接受新的独立复查；不以此声称整体动态通过。

作者处置结论：第二轮 S-1 的需求歧义已在文本上自决收敛；`REVIEW_TARGET=DESIGN` 的独立末轮 verdict 仍是 `NO-GO`，最终修订字节的状态是 `SELF_DECIDED_AFTER_ROUND_2`，**不是**第三轮独立 GO。当前 task 只要求正式需求与两轮审查，后续交互／IA、详设、计划和实施均未授权、未开始。
