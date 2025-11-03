# SQL 智能提示功能

## 概述

SQL 编辑器现在支持基于当前数据库模式的智能代码提示功能，能够自动提示表名、字段名和 SQL 关键字。

## 功能特性

### 1. 自动加载数据库模式

当应用启动或刷新数据库模式时，系统会自动预加载所有表的字段信息到内存中（`schemaMap`），无需用户手动展开表节点。

**实现位置：** `src/stores/useSchemaStore.ts` - `fetchInitialSchema` 方法

```typescript
// 预加载所有表的字段信息用于自动完成
const newSchemaMap = new Map<string, string[]>()
for (const row of results[0].rows) {
  const tableName = row.table_name
  const columnSql = `PRAGMA table_info(${tableName})`
  const columnResults = await apiService.execute(columnSql)

  if (columnResults[0]?.rows) {
    newSchemaMap.set(
      tableName,
      columnResults[0].rows.map((col: any) => col.name)
    )
  }
}
```

### 2. 智能上下文感知提示

编辑器会根据光标位置和已输入的内容，提供不同的提示：

#### 场景 1: 输入表名后的点号（`.`）

当用户输入 `tableName.` 后，编辑器会自动显示该表的所有字段：

```sql
SELECT users.  -- 自动提示: id, name, email, created_at 等
```

**特点：**

- 只显示当前表的字段
- 不显示其他表或关键字
- 提供字段的详细信息

#### 场景 2: 一般输入

在其他位置输入时，编辑器会提供完整的提示列表：

1. **表名** - 显示所有数据库表

   - 图标：类图标（Class）
   - 详情：表名和字段数量
   - 优先级：最高

2. **带表前缀的字段名** - 格式：`tableName.columnName`

   - 图标：字段图标（Field）
   - 详情：所属表名
   - 优先级：中等
   - 支持只输入字段名进行搜索

3. **SQL 关键字** - 常用 SQL 语句关键字
   - 图标：关键字图标（Keyword）
   - 优先级：最低

### 3. 触发方式

智能提示可以通过以下方式触发：

1. **自动触发：**

   - 输入点号（`.`）后
   - 输入空格后
   - 开始输入任何字符时

2. **手动触发：**
   - 按 `Ctrl + Space`（Windows/Linux）
   - 按 `Cmd + Space`（macOS）

### 4. 支持的 SQL 关键字

编辑器支持以下 SQL 关键字的智能提示：

**查询语句：**

- SELECT, FROM, WHERE, JOIN, LEFT JOIN, RIGHT JOIN, INNER JOIN, OUTER JOIN
- ON, AND, OR, NOT, IN, LIKE, BETWEEN
- ORDER BY, GROUP BY, HAVING, LIMIT, OFFSET
- DISTINCT, AS, UNION, UNION ALL, INTERSECT, EXCEPT

**数据操作：**

- INSERT INTO, UPDATE, DELETE FROM

**表操作：**

- CREATE TABLE, ALTER TABLE, DROP TABLE

**聚合函数：**

- COUNT, SUM, AVG, MAX, MIN

**其他：**

- NULL, IS NULL, IS NOT NULL, ASC, DESC
- INDEX, VIEW

## 使用示例

### 示例 1: 简单查询

```sql
-- 输入 "SEL" 后按 Tab 或 Enter
SELECT
-- 输入 "us" 后选择 "users"
FROM users
-- 输入 "users." 后自动显示字段列表
WHERE users.status = 'active'
```

### 示例 2: 多表连接

```sql
SELECT
  users.name,
  orders.total
FROM users
-- 输入 "LEF" 后选择 "LEFT JOIN"
LEFT JOIN orders ON users.id = orders.user_id
```

### 示例 3: 聚合查询

```sql
SELECT
  users.country,
  -- 输入 "COU" 后选择 "COUNT"
  COUNT(*) as user_count
FROM users
GROUP BY users.country
ORDER BY user_count DESC
```

## 技术实现

### 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                   应用启动/模式刷新                        │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           useSchemaStore.fetchInitialSchema             │
│  1. 获取所有表名                                          │
│  2. 为每个表获取字段信息（PRAGMA table_info）              │
│  3. 构建 schemaMap: Map<tableName, columnNames[]>       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              SqlEditorPanel 组件                         │
│  - 从 useSchemaStore 获取 schemaMap                      │
│  - 注册 Monaco Editor 自动完成提供器                      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│         Monaco Editor 自动完成提供器                      │
│  provideCompletionItems(model, position)                │
│  1. 分析光标位置的上下文                                   │
│  2. 检测是否在表名后输入点号                               │
│  3. 根据上下文返回相应的提示列表                           │
└─────────────────────────────────────────────────────────┘
```

### 核心代码

**1. 模式预加载（useSchemaStore.ts）**

```typescript
// 在获取表列表后，立即预加载所有字段信息
const newSchemaMap = new Map<string, string[]>()
for (const row of results[0].rows) {
  try {
    const tableName = row.table_name
    const columnSql = `PRAGMA table_info(${tableName})`
    const columnResults = await apiService.execute(columnSql)

    if (columnResults[0]?.rows) {
      newSchemaMap.set(
        tableName,
        columnResults[0].rows.map((col: any) => col.name)
      )
    }
  } catch (error) {
    console.error(`Failed to preload columns for ${row.table_name}:`, error)
  }
}
set({ schemaMap: newSchemaMap })
```

**2. 智能提示提供器（SqlEditorPanel.tsx）**

```typescript
monaco.languages.registerCompletionItemProvider('sql', {
  provideCompletionItems: (model: any, position: any) => {
    const suggestions: any[] = []

    // 获取光标前的文本以提供上下文感知的建议
    const textUntilPosition = model.getValueInRange({
      startLineNumber: position.lineNumber,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column
    })

    // 检查是否在表名后（用于字段建议）
    const tableMatch = textUntilPosition.match(/(\w+)\.\s*$/i)

    if (tableMatch) {
      // 用户输入了 "tableName." - 只显示该表的字段
      const tableName = tableMatch[1]
      const columns = schemaMap.get(tableName)

      if (columns) {
        columns.forEach(columnName => {
          suggestions.push({
            label: columnName,
            kind: monaco.languages.CompletionItemKind.Field,
            insertText: columnName,
            detail: `Column in ${tableName}`,
            documentation: `${tableName}.${columnName}`
          })
        })
      }
    } else {
      // 一般建议：表、字段（带表前缀）和关键字
      // ... 添加表名、字段和关键字
    }

    return { suggestions }
  },
  triggerCharacters: ['.', ' '] // 在点号和空格时触发自动完成
})
```

## 性能考虑

### 优化策略

1. **预加载模式信息：**

   - 在应用启动时一次性加载所有表的字段信息
   - 避免在每次打开编辑器时重复加载
   - 使用 Map 数据结构实现 O(1) 查找性能

2. **智能过滤：**

   - 根据上下文只显示相关的提示
   - 使用 `sortText` 控制提示的优先级
   - 使用 `filterText` 支持模糊搜索

3. **延迟加载：**
   - 只在用户实际触发自动完成时才生成建议列表
   - Monaco Editor 自动处理防抖和节流

### 内存占用

对于中小型数据库（< 100 个表，每表 < 50 个字段），内存占用通常小于 1MB，对应用性能影响可忽略不计。

## 未来改进方向

1. **字段类型信息：**

   - 在提示中显示字段的数据类型
   - 提供字段约束信息（主键、外键、非空等）

2. **智能 SQL 片段：**

   - 提供常用 SQL 模板（如 INSERT 语句模板）
   - 根据表结构自动生成完整的 SQL 语句

3. **语法验证：**

   - 实时检查 SQL 语法错误
   - 提供错误提示和修复建议

4. **查询历史：**

   - 记录用户的查询历史
   - 提供历史查询的快速插入

5. **别名支持：**
   - 识别表别名（如 `SELECT u.name FROM users u`）
   - 为别名提供字段提示

## 相关文件

- `src/components/SqlEditorPanel.tsx` - SQL 编辑器组件，包含自动完成逻辑
- `src/stores/useSchemaStore.ts` - 模式存储，负责预加载表和字段信息
- `src/services/api.service.ts` - API 服务，执行 SQL 查询

## 测试建议

1. **基本功能测试：**

   - 打开 SQL 编辑器
   - 输入 `SELECT ` 并验证是否显示表名提示
   - 输入 `tableName.` 并验证是否显示该表的字段

2. **性能测试：**

   - 在包含大量表的数据库中测试加载速度
   - 验证自动完成的响应速度

3. **边界情况：**
   - 空数据库（无表）
   - 表名包含特殊字符
   - 字段名与 SQL 关键字冲突

## 总结

SQL 智能提示功能大大提升了用户的开发效率，通过预加载数据库模式信息和上下文感知的智能提示，用户可以更快速、更准确地编写 SQL 查询语句。
