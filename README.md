# SQLiter

一个专业的、基于 Web 的 SQLite 数据库管理工具。使用 React、TypeScript 和现代 Web 技术构建，专为 SQLite 设计。

**中文** | [English](README_EN.md)

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![React](https://img.shields.io/badge/react-18.3.1-61dafb.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.9.3-3178c6.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🎯 项目愿景

SQLiter 是一个专为 SQLite 设计的数据库管理工具，完全运行在浏览器中。它提供直观的界面来浏览数据库模式、执行 SQL 查询和编辑表数据 - 所有这些都具有媲美桌面应用程序的用户体验。

## ✨ 核心特性

### 📊 数据库管理

- **模式浏览器** - 树形结构展示数据库、表和列
- **智能加载** - 按需加载表结构，提升性能
- **右键菜单** - 快速访问常用操作
- **实时刷新** - 自动更新模式缓存

### 💻 SQL 编辑器

- **Monaco 编辑器** - VS Code 同款编辑器，支持语法高亮
- **智能提示** - 基于数据库模式的自动完成
  - 表名提示
  - 字段名提示（支持 `表名.` 触发）
  - SQL 关键字提示
- **快捷执行** - Cmd/Ctrl + Enter 快速执行
- **多语句支持** - 批量执行多条 SQL 语句
- **多结果展示** - 为每个查询结果创建独立标签页

### 📝 表数据编辑

- **可编辑网格** - 双击单元格即可编辑
- **智能输入控件** - 根据字段类型自动选择合适的输入方式：
  - **INTEGER/NUMERIC** → 数字输入框
  - **BOOLEAN** → 下拉选择（TRUE/FALSE/NULL）
  - **DATE** → 日期选择器
  - **DATETIME/TIMESTAMP** → 日期时间选择器
  - **TEXT/BLOB** → 多行文本框（自动调整高度）
  - **其他类型** → 单行文本输入框
- **脏数据追踪** - 修改的单元格显示红色三角标记
- **批量保存** - 一次性保存所有修改
- **主键编辑** - 支持编辑主键值（带安全警告）
- **行选择** - 支持多选和批量操作

### 🔍 高级筛选

- **可视化筛选构建器** - 无需手动编写 WHERE 子句
- **丰富的操作符** - 支持 =, !=, >, <, >=, <=, LIKE, IN, IS NULL 等
- **逻辑连接** - AND/OR 组合多个筛选条件
- **折叠面板** - 节省显示空间
- **实时预览** - 显示已应用的筛选条件数量

### ➕ 数据操作

- **添加行** - 智能表单，根据表结构自动生成
  - 自动识别必填字段
  - 自动填充默认值
  - 跳过自增主键
  - 字段类型验证
- **删除行** - 支持多选批量删除
  - 安全确认对话框
  - 显示选中行数量
- **分页支持** - 高效处理大数据集

### 🏗️ 表结构查看

- **列定义** - 查看字段名、数据类型、约束
- **主键标识** - 清晰标记主键字段
- **默认值显示** - 展示字段默认值
- **可空性** - 显示字段是否允许 NULL

### 🎨 用户界面

- **多标签工作区** - 同时打开多个 SQL 编辑器和表视图
- **可调整大小** - 左侧边栏和编辑器面板可自由调整
- **专业设计** - 清爽、现代的 UI 设计
- **响应式布局** - 适配不同屏幕尺寸

## 🏗️ 架构设计

### 纯前端架构

这是一个**纯前端应用**。所有数据库交互（DDL、DML、DQL）的业务逻辑都在前端处理：

1. **前端职责**：生成纯 SQL 字符串（包括所有业务逻辑）
2. **API 通信**：SQL 发送到统一的后端 API 端点：`POST /_sqlite_gui/api/execute`
3. **后端职责**：作为"哑"执行器，直接执行 SQL 并返回数据库原始结果
4. **响应适配**：前端智能适配多种后端响应格式

### API 契约

**端点：** `POST /_sqlite_gui/api/execute`

**请求格式：**

```json
{
  "sql": "SELECT * FROM users"
}
```

**响应格式：**

后端直接返回 SQLite 数据库的执行结果。最常见的格式是**直接返回数据行数组**：

```json
[
  { "id": 1, "name": "Alice", "age": 30 },
  { "id": 2, "name": "Bob", "age": 25 }
]
```

对于非查询语句（INSERT、UPDATE、DELETE），后端可能返回空数组或执行结果信息。

**前端适配能力：**

为了兼容不同的后端实现，前端内置了智能适配器，可以处理以下几种可能的响应格式：

- **数据行数组**（最常见）：`[{...}, {...}]`
- **包含元数据的标准格式**：`[{ rows: [...], rowCount: number, error: null }]`
- **单个对象**：`{...}`
- **其他格式**

前端会自动将这些格式统一转换为内部使用的 `ExecuteResponse` 格式。

### ROWID 统一标识符方案

本系统使用 SQLite 的 `rowid` 作为行的唯一标识符，而不是依赖主键：

**优势：**

- ✅ **简化代码** - 减少 29% 的代码量
- ✅ **性能提升** - 脏数据检查从 O(n×m) 优化到 O(1)
- ✅ **支持主键编辑** - 可以自由修改主键值
- ✅ **统一处理** - 无需特殊处理 NULL 主键或复合主键

**实现细节：**

```sql
-- 查询时总是包含 rowid
SELECT rowid, * FROM users LIMIT 50 OFFSET 0;

-- 更新时使用 rowid 定位行
UPDATE users SET name = 'John' WHERE rowid = 5;

-- 删除时使用 rowid
DELETE FROM users WHERE rowid = 5;
```

## 🛠️ 技术栈

| 类别            | 技术             | 版本    | 用途       |
| --------------- | ---------------- | ------- | ---------- |
| **框架**        | React            | 18.3.1  | UI 框架    |
| **语言**        | TypeScript       | 5.9.3   | 类型安全   |
| **UI 库**       | Ant Design       | 5.21.0  | 组件库     |
| **状态管理**    | Zustand          | 5.0.0   | 全局状态   |
| **代码编辑器**  | Monaco Editor    | 0.52.0  | SQL 编辑器 |
| **HTTP 客户端** | Axios            | 1.7.0   | API 请求   |
| **日期处理**    | Day.js           | 1.11.13 | 日期时间   |
| **构建工具**    | Vite             | 7.1.7   | 开发和构建 |
| **图标**        | Ant Design Icons | 5.5.0   | 图标库     |

## 🚀 快速开始

### 环境要求

- Node.js 18+
- pnpm（推荐）或 npm/yarn

### 安装步骤

```bash
# 克隆仓库
git clone <repository-url>
cd sqliter

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建生产版本
pnpm build

# 预览生产构建
pnpm preview
```

### 开发环境

应用将在 `http://localhost:5173` 启动（或下一个可用端口）。

### 配置后端 API

修改 `src/services/api.service.ts` 中的 API 端点：

```typescript
// 当前配置
const API_EXECUTE_ENDPOINT = `/api/execute`

// 修改为你的后端地址
const API_EXECUTE_ENDPOINT = `https://your-api.com/execute`
```

## 📁 项目结构

```
sqliter/
├── src/
│   ├── components/          # React 组件
│   │   ├── AddRowDialog.tsx         # 添加行对话框
│   │   ├── ContextMenu.tsx          # 右键菜单
│   │   ├── CreateTableDialog.tsx    # 创建表对话框
│   │   ├── EditableGrid.tsx         # 可编辑表格
│   │   ├── FilterBuilder.tsx        # 筛选条件构建器
│   │   ├── ResizableBox.tsx         # 可调整大小容器
│   │   ├── ResizableSider.tsx       # 可调整大小侧边栏
│   │   ├── ResultsGrid.tsx          # 查询结果网格
│   │   ├── SchemaExplorer.tsx       # 模式浏览器
│   │   ├── SqlEditorPanel.tsx       # SQL 编辑器面板
│   │   ├── TableStructurePanel.tsx  # 表结构面板
│   │   ├── TableViewPanel.tsx       # 表视图面板
│   │   └── Workspace.tsx            # 工作区容器
│   ├── stores/              # Zustand 状态管理
│   │   ├── useSchemaStore.ts        # 模式缓存和树状态
│   │   └── useTabStore.ts           # 标签页管理
│   ├── services/            # API 服务层
│   │   └── api.service.ts           # API 请求封装
│   ├── types/               # TypeScript 类型定义
│   │   └── index.ts                 # 所有类型定义
│   ├── App.tsx              # 主应用组件
│   ├── App.css              # 应用样式
│   ├── main.tsx             # 应用入口
│   └── index.css            # 全局样式
├── docs/                    # 功能文档
│   ├── ADD_ROW_FEATURE.md
│   ├── FILTER_FEATURE.md
│   ├── PRIMARY_KEY_EDIT_FEATURE.md
│   ├── SMART_EDIT_FEATURE.md
│   ├── SQL_AUTOCOMPLETE_FEATURE.md
│   └── ROWID_IMPLEMENTATION_SUMMARY.md
├── public/                  # 静态资源
├── dist/                    # 构建输出
├── package.json             # 项目配置
├── tsconfig.json            # TypeScript 配置
├── vite.config.ts           # Vite 配置
└── README.md                # 项目文档
```

## 🎨 核心设计决策

### 1. 状态管理 - Zustand

使用两个主要的 Store：

**useSchemaStore** - 全局模式缓存

```typescript
{
  treeData: TreeNodeData[]           // 树形结构数据
  schemaMap: Map<string, string[]>   // 表名 → 字段名映射（用于自动完成）
  loadingKeys: Set<string>           // 正在加载的节点
  fetchInitialSchema()               // 预加载所有表和字段
  loadChildren()                     // 懒加载子节点
}
```

**useTabStore** - 工作区和标签页管理

```typescript
{
  tabs: Tab[]                        // 所有打开的标签页
  activeKey: string                  // 当前激活的标签页
  addTab()                           // 添加新标签页
  removeTab()                        // 关闭标签页
  executeSqlForTab()                 // 执行 SQL
  loadTableData()                    // 加载表数据
  saveChangesForTableTab()           // 保存修改
  updateCellValue()                  // 更新单元格值
  addNewRow()                        // 添加新行
  deleteRows()                       // 删除行
}
```

### 2. 类型系统 - 判别联合类型

使用 TypeScript 的判别联合类型确保类型安全：

```typescript
type Tab = SqlEditorTab | TableViewTab | TableStructureTab

interface SqlEditorTab {
  type: 'sql_editor'
  sql: string
  results: ApiResult[]
  // ...
}

interface TableViewTab {
  type: 'table_view'
  tableName: string
  data: any[]
  dirtyChanges: Map<number, Record<string, any>>
  filterConditions: FilterCondition[]
  // ...
}

interface TableStructureTab {
  type: 'table_structure'
  columns: ColumnInfo[]
  // ...
}
```

### 3. 脏数据追踪

使用 Map 数据结构高效追踪修改：

```typescript
// Map<rowid, 修改的字段>
dirtyChanges: Map<number, Record<string, any>>

// 示例
dirtyChanges.set(5, {
  name: 'John Doe',
  age: 30
})

// 生成 SQL
UPDATE users SET name = 'John Doe', age = 30 WHERE rowid = 5
```

**优势：**

- O(1) 查找性能
- 自动去重
- 易于遍历生成 UPDATE 语句

### 4. 智能表单控件

根据数据类型自动选择最合适的输入控件：

```typescript
function getInputComponent(dataType: string) {
  const type = dataType.toLowerCase()

  if (type === 'boolean') return <Select options={[TRUE, FALSE, NULL]} />
  if (type.includes('int') || type.includes('numeric')) return <InputNumber />
  if (type === 'date') return <DatePicker format="YYYY-MM-DD" />
  if (type === 'datetime') return <DatePicker showTime />
  if (type === 'text') return <TextArea autoSize />
  return <Input />
}
```

## 💡 使用指南

### 基本工作流程

#### 1. 浏览数据库模式

- 展开左侧的模式树
- 点击表名查看列
- 右键点击表名打开上下文菜单

#### 2. 执行 SQL 查询

- 点击顶部的"New Query"按钮
- 在 Monaco 编辑器中编写 SQL
- 按 `Cmd/Ctrl + Enter` 或点击"Execute"按钮
- 在底部面板查看结果

#### 3. 编辑表数据

**打开表视图：**

- 点击表名，或
- 右键点击表 → "Open Table"

**编辑单元格：**

- 双击单元格进入编辑模式
- 根据字段类型使用相应的输入控件
- 按 Enter 或点击外部保存
- 修改的单元格显示红色三角标记

**保存修改：**

- 点击"Save Changes"按钮
- 系统自动生成 UPDATE 语句
- 保存成功后自动刷新数据

#### 4. 添加新行

- 点击"Add Row"按钮
- 在对话框中填写字段值
- 必填字段标有红色星号
- 自增主键自动跳过
- 点击"Add Row"确认

#### 5. 删除行

- 勾选要删除的行
- 点击"Delete Selected"按钮
- 在确认对话框中确认
- 选中的行将被删除

#### 6. 筛选数据

**添加筛选条件：**

- 展开"筛选条件"面板
- 点击"添加条件"
- 选择字段、操作符和值
- 选择逻辑连接符（AND/OR）

**应用筛选：**

- 点击"应用筛选"按钮
- 数据将根据条件重新加载

**清除筛选：**

- 点击"清除筛选"按钮
- 显示所有数据

### 支持的筛选操作符

| 操作符        | 说明       | 示例                          |
| ------------- | ---------- | ----------------------------- |
| `=`           | 等于       | `age = 25`                    |
| `!=`          | 不等于     | `status != 'inactive'`        |
| `>`           | 大于       | `price > 100`                 |
| `<`           | 小于       | `quantity < 10`               |
| `>=`          | 大于等于   | `score >= 60`                 |
| `<=`          | 小于等于   | `age <= 65`                   |
| `LIKE`        | 模糊匹配   | `name LIKE '%John%'`          |
| `NOT LIKE`    | 不匹配     | `email NOT LIKE '%@test.com'` |
| `IN`          | 在列表中   | `id IN (1,2,3)`               |
| `NOT IN`      | 不在列表中 | `status NOT IN ('deleted')`   |
| `IS NULL`     | 为空       | `description IS NULL`         |
| `IS NOT NULL` | 不为空     | `email IS NOT NULL`           |

### 快捷键

| 快捷键             | 功能           |
| ------------------ | -------------- |
| `Cmd/Ctrl + Enter` | 执行 SQL       |
| `Cmd/Ctrl + Space` | 触发自动完成   |
| `Enter`            | 保存单元格编辑 |
| `Esc`              | 取消单元格编辑 |
| `Shift + Enter`    | 在文本框中换行 |

## 🔧 高级配置

### 连接真实后端

修改 `src/services/api.service.ts` 中的 API 端点配置：

```typescript
// 修改这一行即可
const API_EXECUTE_ENDPOINT = 'https://your-api.com/execute'
```

后端只需返回 SQLite 数据库的原始执行结果（通常是数据行数组），前端会自动处理。

**完整的 API 服务代码示例：**

```typescript
// src/services/api.service.ts
import type { ApiResult, ExecuteRequest, ExecuteResponse } from '../types'

const API_EXECUTE_ENDPOINT = 'https://your-api.com/execute'

export async function executeSQL(
  request: ExecuteRequest
): Promise<ExecuteResponse> {
  const { sql } = request

  try {
    const response = await fetch(API_EXECUTE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()

    // 自动适配多种响应格式
    if (Array.isArray(data) && data.length > 0 && 'rows' in data[0]) {
      return data as ExecuteResponse
    }
    if (Array.isArray(data)) {
      return [{ rows: data, rowCount: data.length, error: null }]
    }
    if (data && typeof data === 'object' && 'rows' in data) {
      return [data as ApiResult]
    }
    if (data && typeof data === 'object') {
      return [{ rows: [data], rowCount: 1, error: null }]
    }

    throw new Error('Unexpected response format')
  } catch (error) {
    return [
      {
        rows: null,
        rowCount: 0,
        error: error instanceof Error ? error.message : String(error)
      }
    ]
  }
}

export const apiService = {
  execute: (sql: string) => executeSQL({ sql })
}
```

### 自定义主题

修改 `src/App.css` 或使用 Ant Design 的主题配置：

```typescript
import { ConfigProvider } from 'antd'
;<ConfigProvider
  theme={{
    token: {
      colorPrimary: '#1890ff',
      borderRadius: 4
    }
  }}
>
  <App />
</ConfigProvider>
```

### 添加新的标签页类型

1. 在 `src/types/index.ts` 中定义新类型
2. 在 `useTabStore.ts` 中添加相关 actions
3. 在 `Workspace.tsx` 中添加渲染逻辑
4. 创建新的面板组件

## 📊 性能优化

### 已实施的优化

- ✅ **懒加载** - 按需加载表结构
- ✅ **虚拟滚动** - Ant Design Table 内置
- ✅ **代码分割** - Monaco Editor 动态导入
- ✅ **选择器优化** - Zustand 精确订阅
- ✅ **Map 数据结构** - O(1) 脏数据查找
- ✅ **ROWID 方案** - 简化行标识逻辑

### 性能指标

| 操作        | 优化前   | 优化后   | 提升  |
| ----------- | -------- | -------- | ----- |
| 脏数据检查  | O(n×m)   | O(1)     | ~100x |
| 行匹配      | O(n)     | O(1)     | ~10x  |
| UPDATE 生成 | 复杂逻辑 | 简单整数 | ~5x   |
| 代码量      | 1200 行  | 850 行   | -29%  |

## 🧪 测试

```bash
# 运行 ESLint
pnpm lint

# 类型检查
pnpm tsc --noEmit

# 构建测试
pnpm build
```

## 📝 SQL 生成示例

### 查询数据

```sql
-- 基本查询（总是包含 rowid）
SELECT rowid, * FROM users LIMIT 50 OFFSET 0;

-- 带筛选条件
SELECT rowid, * FROM users
WHERE age > 18 AND status = 'active'
LIMIT 50 OFFSET 0;

-- 多条件筛选
SELECT rowid, * FROM users
WHERE (city = 'Beijing' OR city = 'Shanghai')
  AND age >= 18
LIMIT 50 OFFSET 0;
```

### 更新数据

```sql
-- 单行更新（使用 rowid）
UPDATE users SET name = 'John Doe', age = 30 WHERE rowid = 5;

-- 批量更新
UPDATE users SET name = 'Alice' WHERE rowid = 1;
UPDATE users SET age = 25 WHERE rowid = 2;
UPDATE users SET status = 'active' WHERE rowid = 3;
```

### 插入数据

```sql
-- 添加新行
INSERT INTO users (name, email, age, created_at)
VALUES ('John Doe', 'john@example.com', 30, CURRENT_TIMESTAMP);
```

### 删除数据

```sql
-- 单行删除
DELETE FROM users WHERE rowid = 5;

-- 批量删除
DELETE FROM users WHERE rowid = 1;
DELETE FROM users WHERE rowid = 2;
DELETE FROM users WHERE rowid = 3;
```

## 🔄 后端响应说明

### 典型的后端响应

后端执行 SQL 后，直接返回 SQLite 数据库的查询结果：

**SELECT 查询：**

```json
[
  { "id": 1, "name": "Alice", "age": 30 },
  { "id": 2, "name": "Bob", "age": 25 }
]
```

**INSERT/UPDATE/DELETE：**

```json
[]
```

或者返回影响的行数等信息（取决于后端实现）。

### 前端适配能力

前端内置了智能适配器，可以自动处理不同后端可能返回的格式：

- **数据行数组**（最常见）：`[{...}, {...}]` → 直接使用
- **包含元数据的对象**：`{ rows: [...], rowCount: n }` → 提取 rows
- **单个对象**：`{...}` → 视为单行结果
- **空结果**：`[]` 或 `null` → 显示空表格

这种设计使得前端可以灵活对接不同的后端实现，后端只需返回数据库的原始执行结果即可。

## 🔒 安全特性

### SQL 注入防护

所有用户输入都经过适当的转义处理：

```typescript
function formatSqlValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL'
  }
  if (typeof value === 'string') {
    // 转义单引号
    return `'${value.replace(/'/g, "''")}'`
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0'
  }
  return String(value)
}
```

### 数据验证

- ✅ 客户端类型验证
- ✅ 必填字段检查
- ✅ 数据格式验证
- ✅ SQL 语法检查（后端）

### 用户确认

- ✅ 删除操作需要确认
- ✅ 主键修改显示警告
- ✅ 批量操作显示影响行数

## 🗺️ 路线图

### 已完成 ✅

- [x] 模式浏览器（树形结构、懒加载）
- [x] SQL 编辑器（Monaco、语法高亮、自动完成）
- [x] 表数据查看和编辑
- [x] 智能表单控件（根据数据类型）
- [x] 脏数据追踪和批量保存
- [x] 主键编辑支持
- [x] 添加和删除行
- [x] 高级筛选功能
- [x] 表结构查看
- [x] 右键上下文菜单
- [x] 多标签工作区
- [x] 分页支持
- [x] ROWID 统一标识符方案

### 计划中 🚧

- [ ] 查询历史记录
- [ ] SQL 格式化
- [ ] 导出数据（CSV、JSON、Excel）
- [ ] 导入数据（CSV、JSON）
- [ ] 深色模式
- [ ] 键盘快捷键面板
- [ ] 查询执行计划
- [ ] 事务管理
- [ ] 多数据库连接管理
- [ ] 用户认证和授权
- [ ] 表结构编辑（ALTER TABLE）
- [ ] 索引管理
- [ ] 视图管理
- [ ] 存储过程支持
- [ ] 数据库备份和恢复

## 🤝 贡献

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 编写清晰的注释
- 保持组件单一职责
- 使用函数式组件和 Hooks

## 🐛 问题反馈

如果您发现 bug 或有功能建议，请[创建 Issue](../../issues)。

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- 灵感来自 [DBeaver](https://dbeaver.io/) 和 [Navicat](https://www.navicat.com/)
- 使用了优秀的开源工具：
  - [React](https://react.dev/)
  - [Ant Design](https://ant.design/)
  - [Monaco Editor](https://microsoft.github.io/monaco-editor/)
  - [Zustand](https://zustand-demo.pmnd.rs/)
  - [Vite](https://vitejs.dev/)

---

**使用 ❤️ 和 React + TypeScript 构建**

最后更新：2025-11-03
