# 双后台名称（编号）展示规范

## 裁决

双后台所有生产 UI 中的业务实体名称与编号组合统一使用 foundation 的 `NameCodeText`；组织路径统一使用 `NameCodePathText`。名称保持正常字号和主文本色，编号保留括号但使用 Ant Design `fontSizeSM`（`var(--ant-font-size-sm)`）并以 `text-tertiary` 弱化颜色，避免嵌套 secondary 容器时层级丢失。名称或编号缺失时保留既有 `—`/单值语义，不凭空补值。

## 适用分母

本规范覆盖 platform-admin 与 operations-admin 生产 `.ts/.tsx` 中所有实体 `name + code` 组合，不限于表格：Tree、ProTable/Table cell、Descriptions、Drawer、Tag、Select 下拉、Modal、组织路径和 context bar 均包含在内。基线扫描得到 75 个 foundation 格式化调用（platform-admin 28、operations-admin 47，29 个文件）以及 2 处手拼 `${name}(${code})`；实施后生产 app 不得直接调用 `formatNameCode`/`formatCodeNamePath` 或手拼该组合，视觉显示必须通过两个 foundation 组件。

纯字符串只允许留在非视觉辅助语义（例如 Set 去重 key、请求/审计 metadata、aria/tooltip 的完整文本），其同一视觉 surface 必须同时使用组件；不得用纯文本字符串冒充视觉验收。

## 方案与边界

组件放在已有 `admin-ui-foundation` presentation 层，不新增业务 wrapper 或重复样式。保留 `formatNameCode`/`formatCodeNamePath` 作为 canonical plain-string formatter，避免破坏日志、审计 metadata 和辅助文本；它们不是视觉渲染 API。该规范不改变 owner、契约、数据、查询、权限、路由或 runtime。

## 防回归

`scripts/check/name-code-density.mjs` 扫描两后台生产源码：禁止直接视觉调用旧 formatter，禁止模板/相邻 JSX 手拼名称/编号，并枚举共享组件 producer，至少守住当前 31 个文件、77 个 producer 的分母。self-test 使用 legacy helper、带空格/路径分隔符的模板和相邻 JSX 的真实红变异；未来新增名称/编号显示点必须使用共享组件。
