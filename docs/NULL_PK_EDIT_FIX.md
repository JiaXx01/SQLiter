# NULL 主键双击编辑问题修复

## 问题描述

当表格中某行的主键值为 `NULL` 时，无法双击该行的单元格进行编辑。这会导致用户无法修改这些行的数据。

### 问题根源

在 `EditableGrid` 组件中，Ant Design Table 的 `rowKey` 属性使用主键值来唯一标识每一行：

```typescript
// 问题代码
rowKey={record => String(record[primaryKey])}
```

当主键为 `null` 时，会出现以下问题：

1. **相同的 rowKey**：多个主键为 null 的行会有相同的 key `"null"`
2. **React 渲染问题**：相同的 key 会导致 React 无法正确识别和更新组件
3. **事件处理失败**：双击事件无法正确绑定到特定的行
4. **编辑功能失效**：无法触发编辑模式

## 解决方案

### 1. 智能 rowKey 生成

为每一行生成唯一的 key，即使主键为 null：

```typescript
rowKey={record => {
  const pkValue = record[primaryKey]
  // 如果主键为 null/undefined
  if (pkValue === null || pkValue === undefined) {
    // 优先使用 rowid（SQLite 的隐藏列）
    if ('rowid' in record && record.rowid !== null && record.rowid !== undefined) {
      return `rowid_${record.rowid}`
    }
    // 否则基于所有列值生成唯一 key
    return `row_${JSON.stringify(record)}`
  }
  return String(pkValue)
}}
```

### 2. 使用 rowid 作为后备标识符

当主键为 null 时，使用 SQLite 的 `rowid` 作为唯一标识符：

```typescript
// 在 onSave 回调中
let pkValue = record[primaryKey] as string | number | null
if (pkValue === null || pkValue === undefined) {
  if (
    'rowid' in record &&
    record.rowid !== null &&
    record.rowid !== undefined
  ) {
    pkValue = record.rowid as number
  }
}
onCellValueChange(pkValue!, col.column_name, newValue)
```

### 3. 正确处理脏数据标记

在检查单元格是否被修改时，也要处理 null 主键：

```typescript
let pkValue = record[primaryKey] as string | number | null
// 如果主键为 null，使用 rowid
if (pkValue === null || pkValue === undefined) {
  if (
    'rowid' in record &&
    record.rowid !== null &&
    record.rowid !== undefined
  ) {
    pkValue = record.rowid as number
  }
}
const isDirty =
  pkValue !== null &&
  pkValue !== undefined &&
  dirtyChanges.has(pkValue) &&
  dirtyChanges.get(pkValue)?.[col.column_name] !== undefined
```

### 4. 允许编辑 NULL 主键

允许用户为 NULL 主键设置值，但不允许修改已有的主键值：

```typescript
let isEditable = col.column_name !== 'rowid'
if (col.column_name === primaryKey) {
  const pkValue = record[primaryKey]
  // 只有当主键为 null 时才允许编辑
  isEditable = pkValue === null || pkValue === undefined
}
```

### 5. 禁止编辑 rowid

确保 rowid 列不可编辑（它是 SQLite 的系统列）。

## 技术细节

### rowKey 生成策略

| 场景                   | rowKey 生成方式 | 示例                  |
| ---------------------- | --------------- | --------------------- |
| 主键有值               | 直接使用主键值  | `"123"`, `"user_001"` |
| 主键为 null + 有 rowid | 使用 rowid      | `"rowid_5"`           |
| 主键为 null + 无 rowid | 基于行数据生成  | `"row_{...json...}"`  |

### 为什么使用 rowid？

1. **唯一性**：SQLite 的 rowid 在表中是唯一的
2. **稳定性**：rowid 在行的生命周期内保持不变
3. **性能**：rowid 是整数，比 JSON 序列化更高效
4. **兼容性**：与之前的 UPDATE/DELETE 修复保持一致

### JSON 序列化作为最后手段

当既没有主键值也没有 rowid 时，使用 JSON 序列化：

```typescript
return `row_${JSON.stringify(record)}`
```

**注意事项**：

- ⚠️ 如果行数据被修改，JSON 字符串会改变，导致 key 改变
- ⚠️ 可能影响性能（对于大量数据）
- ✅ 但能保证每行有唯一的 key，避免 React 错误

## 修改的文件

### `src/components/EditableGrid.tsx`

#### 1. rowKey 生成逻辑

**位置**：第 333-345 行

**改进前**：

```typescript
rowKey={record => String(record[primaryKey])}
```

**改进后**：

```typescript
rowKey={record => {
  const pkValue = record[primaryKey]
  if (pkValue === null || pkValue === undefined) {
    if ('rowid' in record && record.rowid !== null && record.rowid !== undefined) {
      return `rowid_${record.rowid}`
    }
    return `row_${JSON.stringify(record)}`
  }
  return String(pkValue)
}}
```

#### 2. onSave 回调

**位置**：第 266-276 行

**改进前**：

```typescript
const pkValue = record[primaryKey] as string | number
onCellValueChange(pkValue, col.column_name, newValue)
```

**改进后**：

```typescript
let pkValue = record[primaryKey] as string | number | null
if (pkValue === null || pkValue === undefined) {
  if (
    'rowid' in record &&
    record.rowid !== null &&
    record.rowid !== undefined
  ) {
    pkValue = record.rowid as number
  }
}
onCellValueChange(pkValue!, col.column_name, newValue)
```

#### 3. 脏数据检查

**位置**：第 278-291 行

**改进前**：

```typescript
const pkValue = record[primaryKey] as string | number
const isDirty =
  dirtyChanges.has(pkValue) &&
  dirtyChanges.get(pkValue)?.[col.column_name] !== undefined
```

**改进后**：

```typescript
let pkValue = record[primaryKey] as string | number | null
if (pkValue === null || pkValue === undefined) {
  if (
    'rowid' in record &&
    record.rowid !== null &&
    record.rowid !== undefined
  ) {
    pkValue = record.rowid as number
  }
}
const isDirty =
  pkValue !== null &&
  pkValue !== undefined &&
  dirtyChanges.has(pkValue) &&
  dirtyChanges.get(pkValue)?.[col.column_name] !== undefined
```

#### 4. 可编辑性检查

**位置**：第 258-267 行

**改进前**：

```typescript
const isEditable = col.column_name !== primaryKey
```

**改进后**：

```typescript
let isEditable = col.column_name !== 'rowid'
if (col.column_name === primaryKey) {
  const pkValue = record[primaryKey]
  // 只有当主键为 null 时才允许编辑
  isEditable = pkValue === null || pkValue === undefined
}
```

**说明**：

- rowid 始终不可编辑（系统列）
- 主键只有在值为 null 时才可编辑（允许设置初始值）
- 已有值的主键不可编辑（保护数据完整性）
- 其他列始终可编辑

## 配合使用的功能

这个修复与之前的 NULL 主键更新修复配合使用：

1. **数据加载**（`useTabStore.loadTableData`）：

   - 没有主键的表会自动包含 `rowid` 列

2. **数据更新**（`useTabStore.saveChangesForTableTab`）：

   - 使用 `WHERE pk IS NULL` 匹配 null 主键的行
   - 或使用 `WHERE rowid = ?` 匹配特定行

3. **数据删除**（`useTabStore.deleteRows`）：
   - 同样支持 null 主键和 rowid

## 测试场景

### 场景 1：有主键且主键不为 null

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT
);
INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob');
```

**预期行为**：

- ✅ 可以双击编辑任意单元格
- ✅ rowKey 使用主键值：`"1"`, `"2"`
- ✅ 编辑和保存正常工作

### 场景 2：主键为 null

```sql
CREATE TABLE items (
  code TEXT PRIMARY KEY,
  name TEXT
);
INSERT INTO items VALUES (NULL, 'No Code'), ('A001', 'Item A');
```

**预期行为**：

- ✅ 可以双击编辑 null 主键行的单元格
- ✅ **可以双击编辑主键列本身，为 null 主键设置值**
- ✅ 已有值的主键列不可编辑（保护数据完整性）
- ✅ rowKey 使用 rowid：`"rowid_1"`, `"2"`
- ✅ 编辑和保存正常工作
- ✅ 脏数据标记正确显示

### 场景 3：没有主键的表

```sql
CREATE TABLE logs (
  message TEXT,
  timestamp TEXT
);
INSERT INTO logs VALUES ('Log 1', '2024-01-01'), ('Log 2', '2024-01-02');
```

**预期行为**：

- ✅ 表自动包含 rowid 列
- ✅ 可以双击编辑任意单元格
- ✅ rowKey 使用 rowid：`"rowid_1"`, `"rowid_2"`
- ✅ rowid 列不可编辑（显示为灰色）

### 场景 4：多个 null 主键

```sql
CREATE TABLE temp (
  id INTEGER PRIMARY KEY,
  value TEXT
);
INSERT INTO temp VALUES (NULL, 'A'), (NULL, 'B'), (NULL, 'C');
```

**预期行为**：

- ✅ 每行有唯一的 rowKey
- ✅ 可以独立编辑每一行
- ✅ 不会出现 React key 冲突警告
- ✅ 编辑不会影响其他行

## 用户体验改进

### 改进前

- ❌ 主键为 null 的行无法编辑
- ❌ 双击没有反应
- ❌ 可能出现 React 警告
- ❌ 用户体验差

### 改进后

- ✅ 所有行都可以正常编辑
- ✅ 双击立即进入编辑模式
- ✅ 无 React 警告
- ✅ 编辑体验一致
- ✅ 支持各种边界情况

## 注意事项

### 1. rowid 的可见性

- rowid 只在没有主键的表中显式显示
- 有主键的表中，rowid 仍然存在但不显示
- rowid 列始终不可编辑

### 2. 主键的可编辑性

- ✅ **NULL 主键可以编辑**：允许用户为 null 主键设置值
- ❌ **已有值的主键不可编辑**：保护数据完整性，防止破坏关联关系
- 💡 **使用 rowid 标识行**：编辑 null 主键时，使用 rowid 来标识要更新的行

### 3. JSON 序列化的性能

- 只在极少数情况下使用（没有主键也没有 rowid）
- 对于大表可能影响性能
- 建议所有表都定义主键

### 4. 最佳实践

- ✅ 所有表都应该定义主键
- ✅ 主键列应该设置 NOT NULL
- ✅ 使用 INTEGER PRIMARY KEY AUTOINCREMENT
- ⚠️ 避免主键为 null 的设计

## 相关修复

这个修复是 NULL 主键支持的一部分，配合以下修复：

1. **NULL_PRIMARY_KEY_FIX.md** - 更新和删除操作的 null 主键支持
2. **SMART_EDIT_FEATURE.md** - 智能编辑控件（支持各种数据类型）
3. **ADD_ROW_FEATURE.md** - 添加行功能

## 总结

这个修复确保了：

- ✅ 所有行都可以双击编辑，无论主键是否为 null
- ✅ 每行都有唯一的 React key，避免渲染问题
- ✅ 使用 rowid 作为 null 主键的后备标识符
- ✅ 与之前的 UPDATE/DELETE 修复保持一致
- ✅ 提供完整的 null 主键支持

现在，用户可以在任何情况下正常编辑表格数据，包括主键为 null 的特殊情况！
