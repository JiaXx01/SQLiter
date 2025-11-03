# SQL 智能提示使用指南

## 快速开始

SQL 编辑器现在支持智能代码提示功能！当你在编写 SQL 查询时，编辑器会自动提示：

- 📊 **数据库表名**
- 📋 **表字段名**
- 🔤 **SQL 关键字**

## 使用方法

### 1. 自动触发提示

智能提示会在以下情况自动弹出：

#### 输入表名后的点号

```sql
SELECT users.
       ↑ 自动显示 users 表的所有字段
```

#### 开始输入任何内容

```sql
SELECT
  ↑ 自动显示表名、字段和关键字
```

### 2. 手动触发提示

如果提示没有自动显示，可以手动触发：

- **Windows/Linux**: 按 `Ctrl + Space`
- **macOS**: 按 `Cmd + Space`

### 3. 选择提示项

- 使用 `↑` `↓` 方向键浏览提示列表
- 按 `Enter` 或 `Tab` 选择当前项
- 按 `Esc` 关闭提示列表
- 继续输入以过滤提示列表

## 实用示例

### 示例 1: 查询用户信息

```sql
-- 1. 输入 "SEL" 然后选择 "SELECT"
SELECT
  -- 2. 输入 "us" 然后选择 "users.id"
  users.id,
  -- 3. 输入 "users." 查看所有字段
  users.name,
  users.email
-- 4. 输入 "FR" 然后选择 "FROM"
FROM users
-- 5. 输入 "WH" 然后选择 "WHERE"
WHERE users.status = 'active'
```

### 示例 2: 多表连接查询

```sql
SELECT
  u.name,
  o.total,
  o.created_at
FROM users u
-- 输入 "LEF" 选择 "LEFT JOIN"
LEFT JOIN orders o
  ON u.id = o.user_id
WHERE o.status = 'completed'
ORDER BY o.created_at DESC
```

### 示例 3: 聚合统计

```sql
SELECT
  users.country,
  -- 输入 "COU" 选择 "COUNT"
  COUNT(*) as total_users,
  -- 输入 "AVG" 选择 "AVG"
  AVG(orders.total) as avg_order_value
FROM users
LEFT JOIN orders ON users.id = orders.user_id
GROUP BY users.country
HAVING COUNT(*) > 10
ORDER BY total_users DESC
```

## 提示图标说明

智能提示列表中会显示不同的图标，帮助你识别提示类型：

- 📦 **类图标** - 数据库表
- 📝 **字段图标** - 表字段
- 🔑 **关键字图标** - SQL 关键字

## 提示优先级

提示列表按以下优先级排序：

1. **表名** - 最高优先级，显示在最前面
2. **字段名** - 中等优先级
3. **SQL 关键字** - 最低优先级

## 高级技巧

### 技巧 1: 快速查找字段

当输入 `tableName.` 后，只会显示该表的字段，方便快速查找：

```sql
SELECT users.  -- 只显示 users 表的字段
```

### 技巧 2: 模糊搜索

你可以只输入部分字符来搜索：

```sql
-- 输入 "cre" 可以匹配：
-- - CREATE TABLE
-- - users.created_at
-- - orders.created_at
```

### 技巧 3: 使用键盘快捷键

- `Ctrl/Cmd + Enter` - 执行 SQL 查询
- `Ctrl/Cmd + Space` - 手动触发智能提示
- `Esc` - 关闭提示列表

### 技巧 4: 查看字段详情

当你选中一个字段提示时，会显示该字段所属的表名，帮助你区分同名字段：

```
users.id
  ↓
Column in users
```

## 常见问题

### Q: 为什么没有显示某个表的字段？

**A:** 可能的原因：

1. 表是新创建的，需要刷新数据库模式
2. 在左侧的 Schema Explorer 中点击刷新按钮 🔄

### Q: 如何刷新智能提示？

**A:**

1. 在左侧的 Schema Explorer 中点击刷新按钮
2. 系统会自动重新加载所有表和字段信息

### Q: 智能提示支持哪些 SQL 语法？

**A:** 目前支持常用的 SQLite 语法，包括：

- SELECT 查询（单表、多表连接）
- INSERT、UPDATE、DELETE 操作
- CREATE、ALTER、DROP 表操作
- 聚合函数（COUNT、SUM、AVG、MAX、MIN）
- 排序和分组（ORDER BY、GROUP BY）

### Q: 可以自定义智能提示吗？

**A:** 目前智能提示是基于数据库模式自动生成的，暂不支持自定义。未来版本可能会添加这个功能。

## 性能说明

- 智能提示数据在应用启动时自动加载
- 对于中小型数据库（< 100 个表），加载速度非常快
- 提示响应速度优化，不会影响编辑体验

## 反馈与建议

如果你在使用过程中遇到问题或有改进建议，欢迎反馈！

---

**提示**: 充分利用智能提示功能可以大大提高 SQL 编写效率，减少拼写错误！🚀
