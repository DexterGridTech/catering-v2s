# U21 名称与编码显示规范

凡是同一业务实体的名称和编码同时可得且需要显示时，两个后台统一使用 `名称(编码)`：ASCII 半角括号、名称在前、编码在后。纯编辑输入、OTP/验证码、URL/path、只具备单字段的显示面不在分母；不得由前端猜造缺失编码。

在 `admin-ui-foundation` 提供无副作用的 `formatNameCode(name, code)`；空名称或编码时只显示已有字段。平台与运营 app 仅消费该 formatter，owner、edge、OpenAPI 与 generated wire 保持不变。
