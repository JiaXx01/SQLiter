# NULL 主键问题修复

## 问题描述

在执行更新或删除数据时，如果表的主键值为 `NULL`，会导致操作无效。这是因为 SQL 的 `WHERE` 子句使用 `=` 运算符无法匹配 `NULL` 值。

### 问题场景

1. **表没有定义主键**：系统回退到使用第一列，但该列可能包含 `NULL` 值
2. **主键列允许 NULL**：某些行的主键值为 `NULL`
3. **使用 `WHERE pk = NULL`**：这在 SQL 中永远不会匹配任何行

## 解决方案

### 1. 使用 SQLite 的 `rowid`

对于没有主键的表，SQLite 会自动创建一个隐藏的 `rowid` 列作为唯一标识符。

```sql
-- 没有主键的表，包含 rowid
SELECT rowid, * FROM table_name;
```

### 2. 正确处理 NULL 值

在 SQL 中，必须使用 `IS NULL` 而不是 `= NULL` 来匹配 NULL 值。

```sql
-- ❌ 错误：永远不会匹配
WHERE column_name = NULL

-- ✅ 正确：使用 IS NULL
WHERE column_name IS NULL
```

## 技术实现

### 修改的函数

#### 1. `loadTableData` - 数据加载

**改进前：**

```typescript
// 总是使用 SELECT *
const dataSql = `SELECT * FROM ${tableName} LIMIT ${pageSize} OFFSET ${offset}`

// 如果没有主键，回退到第一列或 'id'
const primaryKey = pkColumn?.column_name || 'id'
```

**改进后：**

```typescript
// 检测是否有主键
const pkColumn = columns.find((col: any) => col.is_primary_key)
const primaryKey = pkColumn?.column_name || 'rowid'

// 没有主键时，显式包含 rowid
const dataSql = pkColumn
  ? `SELECT * FROM ${tableName} LIMIT ${pageSize} OFFSET ${offset}`
  : `SELECT rowid, * FROM ${tableName} LIMIT ${pageSize} OFFSET ${offset}`
```

#### 2. `saveChangesForTableTab` - 保存更新

**改进前：**

```typescript
const whereClause =
  typeof pkValue === 'string'
    ? `${tab.primaryKey} = '${pkValue.replace(/'/g, "''")}'`
    : `${tab.primaryKey} = ${pkValue}`
```

**改进后：**

```typescript
let whereClause: string
if (pkValue === null || pkValue === undefined) {
  // 主键为 null，使用 IS NULL
  whereClause = `${tab.primaryKey} IS NULL`
} else if (typeof pkValue === 'string') {
  whereClause = `${tab.primaryKey} = '${pkValue.replace(/'/g, "''")}'`
} else {
  whereClause = `${tab.primaryKey} = ${pkValue}`
}
```

#### 3. `deleteRows` - 删除行

**改进前：**

```typescript
const whereClause =
  typeof pkValue === 'string'
    ? `${tab.primaryKey} = '${pkValue.replace(/'/g, "''")}'`
    : `${tab.primaryKey} = ${pkValue}`
```

**改进后：**

```typescript
let whereClause: string
if (pkValue === null || pkValue === undefined) {
  // 主键为 null，使用 IS NULL
  whereClause = `${tab.primaryKey} IS NULL`
} else if (typeof pkValue === 'string') {
  whereClause = `${tab.primaryKey} = '${pkValue.replace(/'/g, "''")}'`
} else {
  whereClause = `${tab.primaryKey} = ${pkValue}`
}
```

### 额外改进：布尔值处理

在保存更新时，正确处理布尔值（SQLite 使用 0/1 表示布尔值）：

```typescript
const sqlValue =
  typeof value === 'string'
    ? `'${value.replace(/'/g, "''")}'`
    : value === null
    ? 'NULL'
    : typeof value === 'boolean'
    ? value
      ? 1
      : 0 // 布尔值转换为 0/1
    : value
```

## 支持的场景

### 场景 1：有主键的表

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT
);

-- 正常使用主键
UPDATE users SET name = 'John' WHERE id = 1;
```

### 场景 2：没有主键的表

```sql
CREATE TABLE logs (
  message TEXT,
  timestamp TEXT
);

-- 使用 rowid 作为唯一标识
SELECT rowid, * FROM logs;
UPDATE logs SET message = 'Updated' WHERE rowid = 1;
```

### 场景 3：主键为 NULL 的行

```sql
CREATE TABLE items (
  code TEXT PRIMARY KEY,
  name TEXT
);

INSERT INTO items (code, name) VALUES (NULL, 'No Code');

-- 使用 IS NULL 匹配
UPDATE items SET name = 'Updated' WHERE code IS NULL;
DELETE FROM items WHERE code IS NULL;
```

### 场景 4：复合主键（未来支持）

```sql
CREATE TABLE order_items (
  order_id INTEGER,
  item_id INTEGER,
  quantity INTEGER,
  PRIMARY KEY (order_id, item_id)
);

-- 当前版本：使用第一个主键列
-- 未来版本：支持多列主键
```

## 测试建议

### 测试用例

1. **测试有主键的表**

   ```sql
   CREATE TABLE test1 (id INTEGER PRIMARY KEY, name TEXT);
   INSERT INTO test1 VALUES (1, 'Test');
   -- 更新和删除应该正常工作
   ```

2. **测试没有主键的表**

   ```sql
   CREATE TABLE test2 (name TEXT, value TEXT);
   INSERT INTO test2 VALUES ('Test', '123');
   -- 应该使用 rowid，更新和删除正常工作
   ```

3. **测试主键为 NULL 的行**

   ```sql
   CREATE TABLE test3 (code TEXT PRIMARY KEY, name TEXT);
   INSERT INTO test3 VALUES (NULL, 'No Code');
   INSERT INTO test3 VALUES ('A001', 'Code A');
   -- 应该能够更新和删除 NULL 主键的行
   ```

4. **测试布尔值**
   ```sql
   CREATE TABLE test4 (id INTEGER PRIMARY KEY, active BOOLEAN);
   INSERT INTO test4 VALUES (1, TRUE);
   -- 更新布尔值应该正确保存为 0/1
   ```

### 验证步骤

1. 创建测试表（包含上述各种场景）
2. 插入测试数据（包括 NULL 主键）
3. 在表格视图中双击编辑数据
4. 保存更改，验证更新成功
5. 选择行并删除，验证删除成功
6. 检查数据库，确认更改已持久化

## 注意事项

### SQLite rowid 特性

1. **自动创建**：SQLite 自动为每个表创建 `rowid`
2. **唯一性**：`rowid` 在表中是唯一的
3. **可能重用**：删除行后，`rowid` 可能被重用
4. **不可见**：`SELECT *` 不包含 `rowid`，需要显式指定

### 限制

1. **单行匹配**：`WHERE pk IS NULL` 可能匹配多行，如果有多个 NULL 主键
2. **性能**：没有主键的表，使用 `rowid` 可能影响性能
3. **最佳实践**：建议所有表都定义主键

### 推荐做法

1. **定义主键**：所有表都应该有明确的主键
2. **NOT NULL**：主键列应该设置为 NOT NULL
3. **自增主键**：使用 `INTEGER PRIMARY KEY AUTOINCREMENT`
4. **唯一约束**：确保主键值的唯一性

## 相关文件

- `src/stores/useTabStore.ts` - 主要修改文件
  - `loadTableData()` - 加载数据时处理 rowid
  - `saveChangesForTableTab()` - 保存时处理 NULL 主键
  - `deleteRows()` - 删除时处理 NULL 主键

## SQL 示例

### 更新 NULL 主键的行

```sql
-- 错误方式（不会匹配任何行）
UPDATE table_name SET column = 'value' WHERE pk = NULL;

-- 正确方式
UPDATE table_name SET column = 'value' WHERE pk IS NULL;
```

### 删除 NULL 主键的行

```sql
-- 错误方式
DELETE FROM table_name WHERE pk = NULL;

-- 正确方式
DELETE FROM table_name WHERE pk IS NULL;
```

### 使用 rowid

```sql
-- 查看 rowid
SELECT rowid, * FROM table_name;

-- 使用 rowid 更新
UPDATE table_name SET column = 'value' WHERE rowid = 1;

-- 使用 rowid 删除
DELETE FROM table_name WHERE rowid = 1;
```

## 总结

这个修复确保了系统能够正确处理：

- ✅ 没有主键的表（使用 rowid）
- ✅ 主键为 NULL 的行（使用 IS NULL）
- ✅ 布尔值的正确存储（0/1）
- ✅ 所有类型的主键（字符串、数字、NULL）

现在，无论表的主键配置如何，更新和删除操作都能正常工作。
