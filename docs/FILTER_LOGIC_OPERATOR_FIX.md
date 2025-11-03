# 筛选条件逻辑运算符修复

## 问题描述

在筛选条件编辑界面中，当有多个条件时，用户无法选择条件之间的逻辑关系（AND/OR）。逻辑运算符的下拉选择器没有显示出来。

## 问题原因

### 代码分析

在 `FilterBuilder.tsx` 中，逻辑运算符选择器的显示条件是：

```typescript
{
  index < conditions.length - 1 && <Select>{/* AND/OR 选择器 */}</Select>
}
```

**问题所在**：

- 使用了 `conditions.length`（已应用的条件数量）
- 但实际渲染的是 `localConditions`（本地编辑的条件）
- 当用户添加新条件但还未应用时：
  - `localConditions.length = 2`（本地有 2 个条件）
  - `conditions.length = 0`（还没有应用任何条件）
  - 判断条件：`index < 0 - 1` → `index < -1` → 永远为 false
  - 结果：逻辑运算符选择器不显示

### 场景示例

#### 场景 1：添加两个新条件

1. 用户点击"Add Condition"添加第一个条件
2. 再次点击"Add Condition"添加第二个条件
3. 此时：
   - `localConditions = [condition1, condition2]`
   - `conditions = []`（还未应用）
4. 渲染第一个条件时：
   - `index = 0`
   - 判断：`0 < 0 - 1` → `0 < -1` → false
   - ❌ 逻辑运算符选择器不显示

#### 场景 2：修改已应用的条件

1. 用户已有两个应用的条件
2. 添加第三个条件
3. 此时：
   - `localConditions = [condition1, condition2, condition3]`
   - `conditions = [condition1, condition2]`
4. 渲染第二个条件时：
   - `index = 1`
   - 判断：`1 < 2 - 1` → `1 < 1` → false
   - ❌ 逻辑运算符选择器不显示

## 解决方案

### 修改前

```typescript
{
  /* Logic Operator (for all except last) */
}
{
  index < conditions.length - 1 && (
    <Select
      style={{ width: 80 }}
      value={condition.logic}
      onChange={value => handleLogicChange(condition.id, value)}
    >
      {LOGIC_OPERATORS.map(logic => (
        <Option key={logic.value} value={logic.value}>
          {logic.label}
        </Option>
      ))}
    </Select>
  )
}
```

### 修改后

```typescript
{
  /* Logic Operator (for all except last) */
}
{
  index < localConditions.length - 1 && (
    <Select
      style={{ width: 80 }}
      value={condition.logic}
      onChange={value => handleLogicChange(condition.id, value)}
    >
      {LOGIC_OPERATORS.map(logic => (
        <Option key={logic.value} value={logic.value}>
          {logic.label}
        </Option>
      ))}
    </Select>
  )
}
```

### 关键变更

- **从**：`index < conditions.length - 1`
- **到**：`index < localConditions.length - 1`

### 原理

逻辑运算符应该基于**当前正在编辑的条件列表**（`localConditions`）来显示，而不是已应用的条件列表（`conditions`）。

- 如果有 3 个本地条件，前 2 个应该显示逻辑运算符选择器
- 最后一个条件不需要显示（因为它后面没有其他条件）

## 修复后的行为

### 场景 1：添加两个新条件

1. 添加第一个条件
2. 添加第二个条件
3. 此时：
   - `localConditions = [condition1, condition2]`
4. 渲染第一个条件时：
   - `index = 0`
   - 判断：`0 < 2 - 1` → `0 < 1` → true
   - ✅ 显示逻辑运算符选择器（AND/OR）
5. 渲染第二个条件时：
   - `index = 1`
   - 判断：`1 < 2 - 1` → `1 < 1` → false
   - ✅ 不显示（符合预期，最后一个条件不需要）

### 场景 2：三个条件

```
Condition 1: age >= 18      [AND ▼]  [Delete]
Condition 2: status = active [OR ▼]   [Delete]
Condition 3: city = Beijing           [Delete]
```

- 条件 1 和 2 显示逻辑运算符选择器
- 条件 3（最后一个）不显示逻辑运算符选择器

## 逻辑运算符的作用

### AND（且）

所有条件都必须满足：

```sql
WHERE age >= 18 AND status = 'active' AND city = 'Beijing'
```

只返回同时满足这三个条件的记录。

### OR（或）

任一条件满足即可：

```sql
WHERE age >= 18 OR status = 'active' OR city = 'Beijing'
```

返回满足任意一个条件的记录。

### 混合使用

```sql
WHERE age >= 18 AND status = 'active' OR city = 'Beijing'
```

注意：SQL 的 AND 优先级高于 OR，等价于：

```sql
WHERE (age >= 18 AND status = 'active') OR city = 'Beijing'
```

## 测试验证

### 测试用例 1：添加两个条件

1. 点击"Add Condition"
2. 配置第一个条件：`age >= 18`
3. 点击"Add Condition"
4. ✅ 验证：第一个条件右侧显示 AND/OR 选择器
5. 配置第二个条件：`status = active`
6. ✅ 验证：第二个条件右侧没有 AND/OR 选择器
7. 选择第一个条件的逻辑为 "AND"
8. 点击"Apply Filter"
9. ✅ 验证：生成的 SQL 为 `WHERE age >= 18 AND status = 'active'`

### 测试用例 2：三个条件混合逻辑

1. 添加三个条件：
   - `age >= 18` [AND]
   - `status = active` [OR]
   - `city = Beijing`
2. ✅ 验证：前两个条件显示逻辑选择器，第三个不显示
3. 点击"Apply Filter"
4. ✅ 验证：生成的 SQL 为 `WHERE age >= 18 AND status = 'active' OR city = 'Beijing'`

### 测试用例 3：删除中间条件

1. 有三个条件（都已配置逻辑运算符）
2. 删除第二个条件
3. ✅ 验证：现在只有第一个条件显示逻辑选择器
4. ✅ 验证：第二个条件（原来的第三个）不显示逻辑选择器

## 相关代码

### FilterBuilder 组件结构

```typescript
{
  localConditions.map((condition, index) => (
    <div key={condition.id}>
      <Space>
        {/* 字段选择器 */}
        <Select value={condition.field} />

        {/* 操作符选择器 */}
        <Select value={condition.operator} />

        {/* 条件值输入 */}
        {needsValue(condition.operator) && <Input value={condition.value} />}

        {/* 逻辑运算符选择器（除了最后一个） */}
        {index < localConditions.length - 1 && (
          <Select value={condition.logic}>
            <Option value="AND">AND</Option>
            <Option value="OR">OR</Option>
          </Select>
        )}

        {/* 删除按钮 */}
        <Button onClick={() => handleRemoveCondition(condition.id)} />
      </Space>
    </div>
  ))
}
```

### buildWhereClause 函数

在 `useTabStore.ts` 中，逻辑运算符的使用：

```typescript
const clauses = validConditions.map((condition, index) => {
  // ... 构建条件子句 ...

  // 添加逻辑运算符（除了最后一个）
  if (index < validConditions.length - 1) {
    clause += ` ${condition.logic}`
  }

  return clause
})

return ' WHERE ' + clauses.join(' ')
```

## 文件变更

### 修改的文件

- **src/components/FilterBuilder.tsx**
  - 第 267 行：`conditions.length` → `localConditions.length`

### 影响范围

- ✅ 不影响其他功能
- ✅ 不影响已应用的筛选条件
- ✅ 只修复了逻辑运算符选择器的显示逻辑

## 相关文档

- **FILTER_FEATURE.md** - 筛选功能完整说明
- **FILTER_FEATURE_FIX.md** - 初始问题修复
- **FILTER_BUTTON_VISIBILITY_FIX.md** - 按钮可见性修复

## 总结

这个修复确保了逻辑运算符选择器能够正确显示：

- ✅ 基于本地编辑状态（`localConditions`）而不是已应用状态（`conditions`）
- ✅ 除最后一个条件外，所有条件都显示逻辑运算符选择器
- ✅ 用户可以自由选择 AND 或 OR 来组合多个筛选条件
- ✅ 生成正确的 SQL WHERE 子句
