---
id: practices.insert-as-claim-ownership
status: active
layer: routed
taskKinds: ["design","implementation","review"]
domains: ["backend","platform"]
consumerFaces: ["backend"]
owners: ["backend"]
impacts: ["transaction","database"]
triggers: ["implementation","review"]
assertions: ["LINEARIZATION_POINT_BEFORE_MECHANISM","FOR_UPDATE_LOCKS_NO_ABSENT_ROW"]
sourceRefs: ["doc/platform/foundation-charter.md"]
---

# 并发串行化:先想「在哪串行」,再想「用什么串行」

同一个操作被并发重放时,要保证只有一方执行、另一方读到已落定的结果。
两种可用手段,**选哪种取决于串行点的位置,不取决于手段本身好不好**。
本仓 advisory lock 与 insert-as-claim 两种都在用,按串行点位置选。

## 手段 A · insert-as-claim(用唯一约束抢执行权)

```java
✅  int claimed = jdbc.update(
        "INSERT INTO receipt(scope, key, result) VALUES (?,?,?) "
      + "ON CONFLICT (scope, key) DO NOTHING", scope, key, result);
    if (claimed == 1) return null;        // 抢到 ⇒ 由本事务执行
    return readExisting(scope, key);      // 没抢到 ⇒ 读别人已落定的
```

- **成立条件**:唯一约束真的存在;**返回值必须被使用**。丢弃返回值 ⇒ 退化成静默吞掉,
  第二次的业务写照样发生了,见 `pitfalls.claim-versus-behavior`。
- **隐藏行为**:冲突方若尚未提交,`DO NOTHING` **会阻塞**直到对方提交或回滚 ——
  这正是它能串行化的原因,但只在 READ COMMITTED 下成立;更高隔离级下会抛序列化失败。

## 手段 B · advisory lock(在读之前先排队)

```java
✅  advisoryLock.acquire(scope, key);      // 事务级,提交/回滚自动释放
    var existing = read(scope, key);       // 排队之后再读,读到的一定是最终态
    if (existing != null) return existing;
    // ... 执行 ...
```

- **成立条件**:锁在**读之前**取。放在读之后等于没锁。

## 选哪个

| 串行点位置 | 选 |
|---|---|
| 已有唯一约束,且执行权与「谁先写进去」天然一致 | A |
| 需要保护的是**读—判断—写**这整段,行还不存在 | B |

- ⚠️ **`SELECT ... FOR UPDATE` 对不存在的行什么都不锁**。行锁是写在元组上的标记,
  没有元组就没有标记,两个事务会同时查到空、同时往下走。用它防重放是无效的。
- **比较方案时只许动一个变量**:「换机制」和「换位置」要分开比。
  同时动两个,会得出「A 机制更好」这种其实由位置决定的结论,
  并且**第三个候选(原位置 + 另一机制)根本不会被构造出来**。
- **判别式**:我要串行化的那段代码,**第一行**是不是已经在保护之下?不是 ⇒ 保护点选错了。
