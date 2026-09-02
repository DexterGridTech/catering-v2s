# ui-state handoff

本包只交付状态协议。以下内容不在当前实现范围：React/native renderer、default/empty page、screen queue、
业务模块、跨节点同步、automation、DEV、seed、L2、UAT 与部署。

状态接缝必须继续由 runtime command/actor 写入，消费者通过显式 `displayMode` selector 读取；不得在本包
引入自有 workspace key/router 或第二条 persistence 机制。
