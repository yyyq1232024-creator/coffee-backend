# 悠然咖啡系统数据库答辩展示说明

## 一、项目当前数据库

- 数据库平台：Supabase
- 数据库类型：PostgreSQL
- 后端访问方式：Express 服务端通过 `pg` 连接池访问
- 数据持久化：用户、商品、豆源批次、收藏、订单、库存扣减、吧台队列和登录会话均保存到 PostgreSQL

## 二、答辩时建议展示的业务表

| 数据表 | 作用 | 重点关系 |
| --- | --- | --- |
| `users` | 用户、管理员及个人资料 | 主表 |
| `products` | 菜单商品、价格、库存和售罄状态 | 关联 `coffee_bean_batches` |
| `coffee_bean_batches` | 咖啡豆产地、庄园、批次及风味档案 | 被商品引用 |
| `wishlist_items` | 用户收藏的产品和私人配方 | 外键关联 `users` |
| `orders` | 订单主表 | 一对多关联 `order_items` |
| `order_items` | 每个订单的商品和定制参数 | 外键关联 `orders` |
| `print_jobs` | 已支付订单的吧台制作任务 | 关联 `users` 和 `orders` |
| `print_job_items` | 吧台任务中的制作明细 | 外键关联 `print_jobs` |
| `user_sessions` | 可跨服务器重启保持的登录会话 | 外键关联 `users` |

## 三、老师现场查看方法

1. 登录 Supabase Dashboard，进入 `coffee-backend` 项目。
2. 左侧打开 **Table Editor**，选择 `public` schema。
3. 依次展示上述数据表、字段类型、主键和外键关系。
4. 打开 **Database → Schema Visualizer** 展示实体关系图。
5. 打开 **SQL Editor**，执行下面的只读查询证明业务数据真实写入数据库。

### 查看订单与订单明细

```sql
select
  o.id,
  o.buyer_username,
  o.total_price,
  o.order_time,
  oi.name as product_name,
  oi.size,
  oi.sugar,
  oi.temp
from public.orders o
join public.order_items oi on oi.order_id = o.id
order by o.order_time desc
limit 20;
```

### 查看商品库存与豆源批次

```sql
select
  p.id,
  p.name,
  p.stock,
  p.active,
  b.lot_code,
  b.country,
  b.region,
  b.farm
from public.products p
left join public.coffee_bean_batches b on b.id = p.bean_batch_id
order by p.id;
```

### 查看收藏归属关系

```sql
select
  u.username,
  w.name,
  w.size,
  w.sugar,
  w.added_at
from public.wishlist_items w
join public.users u on u.id = w.owner_user_id
order by w.added_at desc;
```

### 查看登录会话是否持久化

```sql
select
  s.id,
  u.username,
  s.created_at,
  s.last_seen_at,
  s.expires_at,
  (s.expires_at > now()) as is_active
from public.user_sessions s
join public.users u on u.id = s.user_id
order by s.created_at desc;
```

## 四、答辩讲解要点

可以这样介绍：

> 系统使用 Supabase 托管的 PostgreSQL。订单提交时，后端使用数据库事务同时创建订单、写入订单明细并扣减库存，任何一步失败都会整体回滚。收藏、豆源档案、吧台队列和登录会话也都采用关系表持久化。登录令牌只向浏览器返回一次，数据库只保存 SHA-256 摘要，因此即使数据库被查看，也不能直接复制会话令牌。

## 五、安全注意事项

- 答辩时不要展示 `.env`、数据库连接密码或 DeepSeek API Key。
- 不要查询或截图 `users.password_hash`、`users.salt`、`user_sessions.token_hash` 的实际内容。
- `user_sessions` 已启用 RLS，并撤销 `anon`、`authenticated` 对该表的直接访问；只有后端数据库连接可以管理会话。
