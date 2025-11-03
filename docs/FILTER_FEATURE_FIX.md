# 筛选功能问题修复

## 问题描述

用户在点击"添加条件"按钮后，页面会出现 Alert 警告：
```
Error Loading Table Data
Unexpected response format from server
```

## 问题原因分析

### 根本原因

当用户点击"添加条件"按钮时，会触发以下流程：

1. 创建一个新的筛选条件对象，其中 `value` 字段为空字符串
2. `FilterBuilder` 组件立即调用 `onChange` 回调
3. `TableViewPanel` 调用 `updateFilterConditions`
4. `updateFilterConditions` 立即执行 `loadTableData(key)` 重新加载数据
5. `loadTableData` 调用 `buildWhereClause` 构建 WHERE 子句
6. `buildWhereClause` 为空值条件生成无效的 SQL（例如：`WHERE age = ''`）
7. 后端执行 SQL 失败或返回意外格式，导致错误

### 具体问题

1. **缺少空值验证**：`buildWhereClause` 函数没有过滤掉值为空的条件
2. **立即刷新机制**：每次条件变更都会立即触发数据刷新，包括用户还在输入的时候
3. **用户体验差**：用户无法先配置好所有条件再一次性应用

## 解决方案

### 1. 在 `buildWhereClause` 中添加条件验证

**文件**: `src/stores/useTabStore.ts`

```typescript
function buildWhereClause(conditions: FilterCondition[]): string {
  if (conditions.length === 0) {
    return ''
  }

  // Filter out invalid conditions (empty values for operators that require values)
  const validConditions = conditions.filter(condition => {
    const { operator, value } = condition
    
    // NULL operators don't need values
    if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
      return true
    }
    
    // All other operators require non-empty values
    return value && value.trim() !== ''
  })

  if (validConditions.length === 0) {
    return ''
  }

  // ... rest of the function
}
```

**改进点**：
- 过滤掉值为空的条件（IS NULL 和 IS NOT NULL 除外）
- 如果所有条件都无效，返回空字符串（不添加 WHERE 子句）
- 确保生成的 SQL 始终有效

### 2. 改进 FilterBuilder 组件使用本地状态

**文件**: `src/components/FilterBuilder.tsx`

**改进点**：
- 使用 `useState` 管理本地条件状态
- 用户修改条件时只更新本地状态，不触发父组件的 `onChange`
- 添加"应用筛选"按钮，用户点击后才真正应用条件
- 添加"清除筛选"按钮，快速清除所有条件
- 显示"有未应用的更改"提示，让用户知道需要点击应用

**新增功能**：
```typescript
// 本地状态管理
const [localConditions, setLocalConditions] = useState<FilterCondition[]>(conditions)

// 同步父组件状态
useEffect(() => {
  setLocalConditions(conditions)
}, [conditions])

// 应用筛选
const handleApplyFilter = () => {
  onChange(localConditions)
}

// 清除筛选
const handleClearFilter = () => {
  setLocalConditions([])
  onChange([])
}

// 检测未保存的更改
const hasChanges = JSON.stringify(localConditions) !== JSON.stringify(conditions)
```

### 3. 优化用户体验

**新增按钮**：
- **添加条件**：添加新的筛选条件（不触发刷新）
- **应用筛选**：应用当前配置的条件并刷新数据（只在有更改时启用）
- **清除筛选**：清除所有条件并刷新数据

**视觉反馈**：
- 标题栏显示"(有未应用的更改)"提示
- "应用筛选"按钮在无更改时禁用
- 删除条件时立即应用（因为这是明确的操作意图）

## 修复后的工作流程

### 正常使用流程

1. 用户点击"添加条件" → 创建新条件，存储在本地状态
2. 用户选择字段、操作符 → 更新本地状态
3. 用户输入条件值 → 更新本地状态
4. 用户点击"应用筛选" → 调用 `onChange`，触发数据刷新
5. `buildWhereClause` 只处理有效条件（值非空）
6. 生成有效的 SQL 并执行查询
7. 数据成功加载

### 边界情况处理

1. **空值条件**：被 `buildWhereClause` 自动过滤，不会生成无效 SQL
2. **IS NULL/IS NOT NULL**：不需要值，始终被认为是有效条件
3. **删除条件**：立即应用，因为用户意图明确
4. **清除筛选**：立即应用，显示所有数据

## 测试建议

### 测试场景

1. **添加空条件**：
   - 点击"添加条件"
   - 不填写任何值
   - 点击"应用筛选"
   - ✅ 应该正常工作，不显示错误

2. **部分填写条件**：
   - 添加两个条件
   - 只填写第一个条件的值
   - 点击"应用筛选"
   - ✅ 只应用第一个条件，忽略第二个

3. **IS NULL 操作符**：
   - 添加条件，选择 IS NULL
   - 不需要填写值
   - 点击"应用筛选"
   - ✅ 正确生成 `WHERE field IS NULL`

4. **删除条件**：
   - 添加并应用一个条件
   - 删除该条件
   - ✅ 立即刷新，显示所有数据

5. **清除筛选**：
   - 添加多个条件并应用
   - 点击"清除筛选"
   - ✅ 立即清除所有条件并刷新

## 总结

通过以下改进，彻底解决了筛选功能的问题：

1. ✅ **添加条件验证**：过滤无效条件，防止生成错误 SQL
2. ✅ **本地状态管理**：避免输入过程中频繁刷新
3. ✅ **手动应用机制**：用户控制何时执行查询
4. ✅ **更好的用户体验**：清晰的视觉反馈和操作流程

现在用户可以安全地添加、编辑和应用筛选条件，不会再出现错误提示。

