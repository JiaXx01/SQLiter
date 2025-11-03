# 筛选按钮可见性优化

## 问题描述

当用户删除最后一条筛选条件时，会出现以下问题：

1. 条件被从本地状态中删除（`localConditions` 变为空数组）
2. 由于 `localConditions.length > 0` 条件不满足，"应用筛选"和"清除筛选"按钮被隐藏
3. 用户无法点击"应用筛选"按钮来应用这个删除操作
4. 查询结果仍然保持之前的筛选状态，没有更新

## 问题场景

### 操作步骤

1. 用户添加一个筛选条件并应用（例如：`age >= 18`）
2. 数据表格显示筛选后的结果
3. 用户点击删除按钮，删除这个唯一的条件
4. 条件从界面上消失，但按钮也消失了
5. 用户无法应用这个删除操作
6. 表格仍然显示筛选后的数据，而不是所有数据

### 预期行为

- 删除最后一条条件后，应该能看到"应用筛选"按钮
- 点击"应用筛选"后，清除筛选条件，显示所有数据

## 解决方案

### 修改前的逻辑

```typescript
{
  localConditions.length > 0 && (
    <>
      <Button
        type="primary"
        size="small"
        icon={<CheckOutlined />}
        onClick={handleApplyFilter}
        disabled={!hasChanges}
      >
        应用筛选
      </Button>
      <Button size="small" icon={<ClearOutlined />} onClick={handleClearFilter}>
        清除筛选
      </Button>
    </>
  )
}
```

**问题**：

- 按钮的显示完全依赖于 `localConditions.length > 0`
- 当删除最后一条条件时，`localConditions` 为空，按钮被隐藏
- 即使有未应用的更改（`hasChanges` 为 true），按钮也不显示

### 修改后的逻辑

```typescript
{
  /* Show "Apply Filter" button when there are changes */
}
{
  hasChanges && (
    <Button
      type="primary"
      size="small"
      icon={<CheckOutlined />}
      onClick={handleApplyFilter}
    >
      应用筛选
    </Button>
  )
}
{
  /* Show "Clear Filter" button only when there are applied conditions */
}
{
  conditions.length > 0 && (
    <Button size="small" icon={<ClearOutlined />} onClick={handleClearFilter}>
      清除筛选
    </Button>
  )
}
```

**改进**：

1. **"应用筛选"按钮**：只要有未应用的更改就显示（`hasChanges`）
   - 包括添加、修改、删除条件的情况
   - 即使 `localConditions` 为空，只要与 `conditions` 不同就显示
2. **"清除筛选"按钮**：只在有已应用的条件时显示（`conditions.length > 0`）
   - 基于实际应用的条件（`conditions`），而不是本地编辑状态
   - 如果没有已应用的条件，不需要显示清除按钮

## 各种场景下的按钮显示逻辑

### 场景 1：初始状态（无条件）

- `conditions = []`
- `localConditions = []`
- `hasChanges = false`
- **显示**：[添加条件]
- **隐藏**：应用筛选、清除筛选

### 场景 2：添加了条件但未应用

- `conditions = []`
- `localConditions = [condition1]`
- `hasChanges = true`
- **显示**：[添加条件] [应用筛选]
- **隐藏**：清除筛选

### 场景 3：已应用条件，无更改

- `conditions = [condition1]`
- `localConditions = [condition1]`
- `hasChanges = false`
- **显示**：[添加条件] [清除筛选]
- **隐藏**：应用筛选

### 场景 4：已应用条件，正在修改

- `conditions = [condition1]`
- `localConditions = [condition1_modified]`
- `hasChanges = true`
- **显示**：[添加条件] [应用筛选] [清除筛选]

### 场景 5：删除最后一条条件（本次修复的场景）

- `conditions = [condition1]`（已应用的条件）
- `localConditions = []`（删除后的本地状态）
- `hasChanges = true`（有未应用的更改）
- **显示**：[添加条件] [应用筛选] [清除筛选]
- ✅ 用户可以点击"应用筛选"来应用删除操作

### 场景 6：删除部分条件

- `conditions = [condition1, condition2]`
- `localConditions = [condition1]`（删除了 condition2）
- `hasChanges = true`
- **显示**：[添加条件] [应用筛选] [清除筛选]

## 代码变更

### 文件：src/components/FilterBuilder.tsx

#### 变更内容

1. 将"应用筛选"按钮的显示条件从 `localConditions.length > 0` 改为 `hasChanges`
2. 将"清除筛选"按钮的显示条件从 `localConditions.length > 0` 改为 `conditions.length > 0`
3. 移除了 `disabled={!hasChanges}` 属性，因为按钮只在有更改时才显示

#### 优势

- **更直观**：有更改就显示"应用筛选"按钮
- **更一致**：删除操作与其他编辑操作行为一致
- **更可靠**：避免了按钮消失导致无法应用更改的问题

## 用户体验改进

### 改进前

```
1. 用户有一个已应用的条件
2. 删除这个条件
3. ❌ 按钮消失，无法应用
4. ❌ 数据仍然是筛选后的结果
5. ❌ 用户困惑：条件删除了，为什么数据没变？
```

### 改进后

```
1. 用户有一个已应用的条件
2. 删除这个条件
3. ✅ "应用筛选"按钮仍然可见
4. ✅ 标题显示"(有未应用的更改)"
5. ✅ 点击"应用筛选"
6. ✅ 数据更新，显示所有记录
7. ✅ 用户体验流畅
```

## 测试验证

### 测试用例 1：删除唯一条件

1. 添加条件：`age >= 18`
2. 点击"应用筛选"
3. 验证：数据被筛选
4. 点击删除按钮
5. ✅ 验证："应用筛选"按钮仍然显示
6. 点击"应用筛选"
7. ✅ 验证：显示所有数据

### 测试用例 2：删除多个条件中的一个

1. 添加两个条件：`age >= 18` AND `status = 'active'`
2. 点击"应用筛选"
3. 删除第一个条件
4. ✅ 验证："应用筛选"和"清除筛选"按钮都显示
5. 点击"应用筛选"
6. ✅ 验证：只应用第二个条件

### 测试用例 3：删除所有条件

1. 添加两个条件并应用
2. 删除第一个条件
3. 删除第二个条件
4. ✅ 验证："应用筛选"按钮显示，"清除筛选"按钮也显示
5. 点击"应用筛选"
6. ✅ 验证：显示所有数据，"清除筛选"按钮消失

## 相关文档

- **FILTER_FEATURE.md** - 筛选功能完整说明
- **FILTER_FEATURE_FIX.md** - 初始问题修复
- **FILTER_COLLAPSE_FEATURE.md** - 折叠功能说明

## 总结

这个修复确保了按钮的可见性逻辑更加合理：

- ✅ "应用筛选"按钮：基于是否有未应用的更改
- ✅ "清除筛选"按钮：基于是否有已应用的条件
- ✅ 删除条件后可以正常应用更改
- ✅ 用户体验更加流畅和直观
