# 表视图筛选功能

## 功能概述

在表视图标签页中新增了数据筛选功能，用户可以通过可视化的表单界面构建 WHERE 筛选条件，无需手动编写 SQL 语句。

## 功能特性

### 1. 筛选条件构建器

- **字段选择**：从表的所有列中选择要筛选的字段
- **操作符选择**：支持多种比较和逻辑操作符
- **条件值输入**：根据操作符类型输入相应的条件值
- **逻辑连接**：支持 AND/OR 逻辑运算符连接多个条件
- **折叠展开**：支持折叠和展开筛选面板，节省显示空间
- **状态提示**：显示已应用的筛选条件数量和未应用的更改提示

### 2. 支持的操作符

| 操作符        | 说明       | 示例                                   |
| ------------- | ---------- | -------------------------------------- |
| `=`           | 等于       | `age = 25`                             |
| `!=`          | 不等于     | `status != 'inactive'`                 |
| `>`           | 大于       | `price > 100`                          |
| `<`           | 小于       | `quantity < 10`                        |
| `>=`          | 大于等于   | `score >= 60`                          |
| `<=`          | 小于等于   | `age <= 65`                            |
| `LIKE`        | 模糊匹配   | `name LIKE '%John%'`                   |
| `NOT LIKE`    | 不匹配     | `email NOT LIKE '%@test.com'`          |
| `IN`          | 在列表中   | `id IN (1,2,3)`                        |
| `NOT IN`      | 不在列表中 | `status NOT IN ('deleted','archived')` |
| `IS NULL`     | 为空       | `description IS NULL`                  |
| `IS NOT NULL` | 不为空     | `email IS NOT NULL`                    |

### 3. 使用方法

#### 展开/折叠筛选面板

- 点击"筛选条件"标题栏可以展开或折叠筛选面板
- 折叠时仍然显示已应用的筛选条件数量（绿色徽章）
- 默认情况下，如果有筛选条件则自动展开，否则折叠

#### 添加筛选条件

1. 在表视图页面中，展开"筛选条件"面板
2. 点击"添加条件"按钮
3. 选择要筛选的字段
4. 选择操作符
5. 输入条件值（某些操作符如 IS NULL 不需要输入值）
6. 如果需要多个条件，可以继续添加，并选择 AND 或 OR 连接
7. **点击"应用筛选"按钮**以应用筛选条件并刷新数据

#### 应用筛选

- 修改筛选条件后，需要点击"应用筛选"按钮才会实际执行查询
- 如果有未应用的更改，标题栏会显示"(有未应用的更改)"提示
- "应用筛选"按钮只有在有更改时才会显示（包括删除条件的情况）

#### 删除筛选条件

- 点击每个条件右侧的删除按钮即可移除该条件
- 删除条件后需要点击"应用筛选"按钮才会生效

#### 清除所有筛选

- 点击"清除筛选"按钮可以一次性清除所有筛选条件
- 清除后会立即刷新数据，显示所有记录

### 4. 条件值输入提示

- **LIKE/NOT LIKE**：使用 `%` 作为通配符，例如 `%keyword%` 表示包含关键字
- **IN/NOT IN**：使用逗号分隔多个值，例如 `1,2,3` 或 `'value1','value2'`
- **IS NULL/IS NOT NULL**：不需要输入条件值

## 技术实现

### 新增类型定义

```typescript
// FilterCondition 类型
export interface FilterCondition {
  id: string
  field: string
  operator: FilterOperator
  value: string
  logic: FilterLogic
}

export type FilterOperator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'NOT LIKE'
  | 'IN'
  | 'NOT IN'
  | 'IS NULL'
  | 'IS NOT NULL'

export type FilterLogic = 'AND' | 'OR'
```

### 新增组件

- **FilterBuilder** (`src/components/FilterBuilder.tsx`)：筛选条件构建器组件

### 修改的文件

1. **src/types/index.ts**

   - 新增 `FilterCondition`、`FilterOperator`、`FilterLogic` 类型定义
   - 在 `TableViewTab` 中添加 `filterConditions` 字段

2. **src/stores/useTabStore.ts**

   - 新增 `buildWhereClause` 辅助函数，将筛选条件转换为 SQL WHERE 子句
   - 修改 `loadTableData` 函数，支持应用筛选条件
   - 新增 `updateFilterConditions` 函数，更新筛选条件并自动刷新数据

3. **src/components/TableViewPanel.tsx**

   - 集成 `FilterBuilder` 组件
   - 添加筛选条件变更处理函数

4. **src/components/SchemaExplorer.tsx**
   - 在创建 `TableViewTab` 时初始化 `filterConditions` 为空数组

## SQL 生成示例

### 单个条件

```
筛选条件：age = 25
生成 SQL：SELECT rowid, * FROM users WHERE age = 25 LIMIT 50 OFFSET 0
```

### 多个条件（AND）

```
筛选条件：
  - age > 18 AND
  - status = 'active'
生成 SQL：SELECT rowid, * FROM users WHERE age > 18 AND status = 'active' LIMIT 50 OFFSET 0
```

### 多个条件（OR）

```
筛选条件：
  - city = 'Beijing' OR
  - city = 'Shanghai'
生成 SQL：SELECT rowid, * FROM users WHERE city = 'Beijing' OR city = 'Shanghai' LIMIT 50 OFFSET 0
```

### 复杂条件

```
筛选条件：
  - age >= 18 AND
  - age <= 65 AND
  - status IN ('active','pending')
生成 SQL：SELECT rowid, * FROM users WHERE age >= 18 AND age <= 65 AND status IN ('active', 'pending') LIMIT 50 OFFSET 0
```

## 注意事项

1. **SQL 注入防护**：所有字符串值都会进行转义处理（单引号替换为两个单引号）
2. **数值识别**：系统会自动识别数值类型，无需手动添加引号
3. **空值处理**：使用 IS NULL 和 IS NOT NULL 操作符处理空值
4. **条件验证**：只有填写了条件值的筛选条件才会被应用（IS NULL 和 IS NOT NULL 除外）
5. **手动应用**：需要点击"应用筛选"按钮才会执行查询，避免输入过程中频繁刷新

## 未来改进方向

1. 支持条件分组（括号）
2. 支持更多操作符（BETWEEN、NOT BETWEEN 等）
3. 支持日期/时间选择器
4. 保存常用筛选条件
5. 导出筛选后的数据
6. 筛选条件的历史记录
