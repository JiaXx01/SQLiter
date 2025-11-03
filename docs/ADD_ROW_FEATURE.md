# Add Row & Delete Rows Feature Implementation

## 概述

完善了表格视图中的 **Add Row** 和 **Delete Selected** 按钮功能，使用户能够完整地管理表格数据。

## 新增功能

### 1. Add Row（添加行）

#### 功能特性

- ✅ 智能表单生成：根据表结构自动生成输入表单
- ✅ 数据类型支持：
  - **INTEGER/NUMERIC/REAL/DECIMAL/DOUBLE/FLOAT** → 数字输入框
  - **TEXT/BLOB** → 多行文本框
  - **BOOLEAN** → 下拉选择（TRUE/FALSE/NULL）
  - **其他类型** → 文本输入框
- ✅ 字段验证：
  - 自动跳过自增主键字段
  - 必填字段验证（NOT NULL 且无默认值）
  - 显示字段类型、主键标识、默认值
- ✅ 默认值处理：
  - 自动填充列的默认值
  - 支持 NULL、CURRENT_TIMESTAMP 等特殊值
- ✅ 用户友好提示：
  - 显示必填字段标记
  - 说明自增字段会自动生成
  - 提示可选字段处理方式

#### 使用方式

1. 打开任意表的数据视图
2. 点击工具栏的 **Add Row** 按钮
3. 在弹出的对话框中填写字段值
4. 点击 **Add Row** 确认添加
5. 新行会自动插入并刷新表格

### 2. Delete Selected（删除选中行）

#### 功能特性

- ✅ 多选支持：可同时选择多行进行批量删除
- ✅ 安全确认：删除前显示确认对话框
- ✅ 批量操作：一次性删除所有选中的行
- ✅ 实时反馈：显示选中行数量
- ✅ 智能禁用：无选中行时按钮自动禁用

#### 使用方式

1. 在表格中勾选要删除的行（支持多选）
2. 点击工具栏的 **Delete Selected** 按钮
3. 在确认对话框中确认删除操作
4. 选中的行会被删除并刷新表格

### 3. 行选择功能

#### 功能特性

- ✅ 复选框选择：每行前显示复选框
- ✅ 全选支持：表头复选框可全选/取消全选
- ✅ 选择状态管理：实时跟踪选中的行
- ✅ 视觉反馈：选中行高亮显示

## 技术实现

### 新增组件

#### `AddRowDialog.tsx`

智能表单对话框组件，根据表结构动态生成输入表单：

- 自动识别字段类型并生成对应的输入控件
- 处理字段验证规则
- 支持默认值填充
- 格式化数据提交

### Store 更新

#### `useTabStore.ts` 新增方法

1. **`addNewRow(key: string, rowData: Record<string, any>)`**

   - 生成 INSERT SQL 语句
   - 执行插入操作
   - 刷新表格数据
   - 错误处理

2. **`deleteRows(key: string, primaryKeyValues: (string | number)[])`**
   - 生成批量 DELETE SQL 语句
   - 执行删除操作
   - 刷新表格数据
   - 错误处理

### 组件更新

#### `EditableGrid.tsx`

- 新增 `selectedRowKeys` 和 `onSelectionChange` props
- 支持行选择功能
- 可选的复选框列

#### `TableViewPanel.tsx`

- 集成 `AddRowDialog` 组件
- 实现 Add Row 按钮功能
- 实现 Delete Selected 按钮功能
- 管理行选择状态
- 显示选中行数量

## SQL 生成示例

### INSERT 语句

```sql
-- 添加新用户
INSERT INTO users (name, email, age, created_at)
VALUES ('John Doe', 'john@example.com', 30, CURRENT_TIMESTAMP)
```

### DELETE 语句

```sql
-- 删除选中的行
DELETE FROM users WHERE id = 1;
DELETE FROM users WHERE id = 2;
DELETE FROM users WHERE id = 3
```

## 数据验证

### 字段验证规则

- **NOT NULL 字段**：必须提供值（除非有默认值或自增）
- **主键字段**：自增主键自动跳过
- **类型验证**：根据数据类型进行格式验证
- **唯一约束**：由数据库层面保证

### SQL 注入防护

- 所有字符串值使用单引号转义
- NULL 值特殊处理
- 数字类型直接使用
- 特殊关键字识别（CURRENT_TIMESTAMP 等）

## 用户体验优化

1. **智能表单**：根据表结构自动生成最合适的输入控件
2. **实时验证**：表单提交前进行客户端验证
3. **加载状态**：操作期间显示加载指示器
4. **错误提示**：清晰的错误消息提示
5. **成功反馈**：操作成功后显示确认消息
6. **自动刷新**：操作完成后自动刷新表格数据

## 测试建议

### 测试场景

1. **基本添加**

   - 添加包含所有字段的完整行
   - 添加只包含必填字段的行
   - 添加包含 NULL 值的行

2. **特殊字段**

   - 自增主键字段自动生成
   - 默认值字段自动填充
   - 时间戳字段（CURRENT_TIMESTAMP）

3. **删除操作**

   - 删除单行
   - 批量删除多行
   - 取消删除操作

4. **边界情况**

   - 空表添加第一行
   - 删除表中最后一行
   - 特殊字符处理（单引号等）

5. **错误处理**
   - 违反唯一约束
   - 违反外键约束
   - 数据类型不匹配

## 未来改进

1. **批量导入**：支持从 CSV/JSON 批量导入数据
2. **复制行**：快速复制现有行创建新行
3. **行内添加**：直接在表格底部添加新行
4. **撤销操作**：支持撤销最近的添加/删除操作
5. **导出选中**：导出选中的行数据

## 相关文件

- `src/components/AddRowDialog.tsx` - 添加行对话框组件
- `src/components/TableViewPanel.tsx` - 表格视图面板
- `src/components/EditableGrid.tsx` - 可编辑表格组件
- `src/stores/useTabStore.ts` - 标签页状态管理
