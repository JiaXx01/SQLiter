# 筛选组件折叠功能

## 功能说明

为筛选组件添加了折叠/展开功能，以节省显示空间，提升用户体验。

## 实现方式

使用 Ant Design 的 `Collapse` 组件替换原来的 `Card` 组件。

## 主要改进

### 1. 折叠/展开功能

- **点击标题栏**：可以展开或折叠筛选面板
- **默认状态**：
  - 如果有筛选条件，默认展开
  - 如果没有筛选条件，默认折叠
- **节省空间**：折叠时只显示一行标题栏

### 2. 视觉反馈增强

#### 绿色徽章 - 已应用的筛选条件数量

```tsx
{
  appliedValidConditionsCount > 0 && (
    <Badge
      count={appliedValidConditionsCount}
      style={{ backgroundColor: '#52c41a' }}
    />
  )
}
```

- 显示当前已应用的有效筛选条件数量
- 使用绿色徽章，表示活跃状态
- 折叠时也能看到筛选条件数量

#### 红色提示 - 未应用的更改

```tsx
{
  hasChanges && (
    <span style={{ color: '#ff4d4f', fontSize: '12px' }}>(有未应用的更改)</span>
  )
}
```

- 当有未保存的更改时显示红色提示
- 提醒用户需要点击"应用筛选"按钮

### 3. 按钮区域优化

```tsx
<Space onClick={e => e.stopPropagation()}>{/* 按钮组 */}</Space>
```

- 使用 `onClick={e => e.stopPropagation()}` 防止点击按钮时触发折叠/展开
- 用户可以直接点击按钮而不会意外折叠面板

## 代码变更

### 修改的文件

**src/components/FilterBuilder.tsx**

#### 导入变更

```typescript
// 之前
import { Button, Select, Input, Space, Card } from 'antd'

// 之后
import { Button, Select, Input, Space, Collapse, Badge } from 'antd'
```

#### 组件结构变更

```typescript
// 之前：使用 Card
<Card
  size="small"
  title={...}
  extra={...}
>
  {children}
</Card>

// 之后：使用 Collapse
<Collapse
  defaultActiveKey={localConditions.length > 0 ? ['filter'] : []}
  items={[
    {
      key: 'filter',
      label: {...},
      extra: {...},
      children: {...}
    }
  ]}
/>
```

#### 新增状态计算

```typescript
// 计算已应用的有效筛选条件数量
const appliedValidConditionsCount = conditions.filter(condition => {
  const { operator, value } = condition
  if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
    return true
  }
  return value && value.trim() !== ''
}).length
```

## 用户体验提升

### 折叠前

- 筛选面板始终占用大量垂直空间
- 即使不需要修改筛选条件，也会遮挡数据表格
- 在小屏幕上尤其影响使用体验

### 折叠后

- ✅ 折叠时只占用一行空间
- ✅ 仍然显示筛选状态（条件数量、未应用提示）
- ✅ 需要时可以快速展开
- ✅ 更多空间显示数据表格
- ✅ 更好的移动端体验

## 使用场景

### 场景 1：查看已筛选的数据

1. 用户已经应用了筛选条件
2. 折叠筛选面板，专注查看数据
3. 标题栏显示"筛选条件 [2]"，表示有 2 个活跃条件

### 场景 2：修改筛选条件

1. 点击标题栏展开面板
2. 修改条件（标题显示"有未应用的更改"）
3. 点击"应用筛选"
4. 可以选择保持展开或折叠

### 场景 3：清除筛选

1. 展开面板
2. 点击"清除筛选"
3. 面板自动折叠（因为没有条件了）

## 技术细节

### Collapse 组件配置

```typescript
<Collapse
  defaultActiveKey={localConditions.length > 0 ? ['filter'] : []}
  // 如果有条件则默认展开，否则折叠
  style={{ marginBottom: 16 }}
  items={[...]}
/>
```

### 防止事件冒泡

```typescript
<Space onClick={e => e.stopPropagation()}>{/* 按钮组 */}</Space>
```

这样点击按钮时不会触发折叠/展开动作。

### Badge 样式

```typescript
<Badge
  count={appliedValidConditionsCount}
  style={{ backgroundColor: '#52c41a' }} // 绿色表示活跃
/>
```

## 兼容性

- ✅ 保持所有现有功能不变
- ✅ 不影响筛选逻辑
- ✅ 向后兼容
- ✅ 响应式设计

## 未来可能的改进

1. **记住折叠状态**：使用 localStorage 保存用户的折叠偏好
2. **快捷键**：支持键盘快捷键展开/折叠（如 Ctrl+F）
3. **动画效果**：添加更流畅的展开/折叠动画
4. **悬浮提示**：折叠时鼠标悬停显示筛选条件详情
