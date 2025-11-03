import React, { useState } from 'react'
import {
  Modal,
  Input,
  Form,
  Button,
  Space,
  Select,
  Checkbox,
  Table,
  message,
  Divider,
  Typography
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EyeOutlined
} from '@ant-design/icons'
import type { ColumnType } from 'antd/es/table'

const { TextArea } = Input
const { Text } = Typography

interface ColumnDefinition {
  id: string
  name: string
  type: string
  isPrimaryKey: boolean
  isAutoIncrement: boolean
  isNotNull: boolean
  isUnique: boolean
  defaultValue: string
}

interface CreateTableDialogProps {
  visible: boolean
  onCancel: () => void
  onConfirm: (sql: string, tableName: string) => Promise<void>
}

// SQLite data types
const DATA_TYPES = [
  'INTEGER',
  'TEXT',
  'REAL',
  'BLOB',
  'NUMERIC',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'TIMESTAMP',
  'VARCHAR',
  'CHAR',
  'DECIMAL',
  'DOUBLE',
  'FLOAT'
]

export const CreateTableDialog: React.FC<CreateTableDialogProps> = ({
  visible,
  onCancel,
  onConfirm
}) => {
  const [tableName, setTableName] = useState('')
  const [columns, setColumns] = useState<ColumnDefinition[]>([
    {
      id: '1',
      name: 'id',
      type: 'INTEGER',
      isPrimaryKey: true,
      isAutoIncrement: true,
      isNotNull: true,
      isUnique: false,
      defaultValue: ''
    }
  ])
  const [showPreview, setShowPreview] = useState(false)
  const [loading, setLoading] = useState(false)

  // Generate SQL from current state
  const generateSQL = (): string => {
    if (!tableName.trim()) {
      return '-- Please enter a table name'
    }

    if (columns.length === 0) {
      return '-- Please add at least one column'
    }

    const columnDefinitions = columns.map(col => {
      const parts: string[] = [`  ${col.name}`]

      // Data type
      parts.push(col.type)

      // Primary key
      if (col.isPrimaryKey) {
        parts.push('PRIMARY KEY')
      }

      // Auto increment (only for INTEGER PRIMARY KEY in SQLite)
      if (col.isAutoIncrement && col.isPrimaryKey && col.type === 'INTEGER') {
        parts.push('AUTOINCREMENT')
      }

      // Not null
      if (col.isNotNull && !col.isPrimaryKey) {
        // PRIMARY KEY implies NOT NULL
        parts.push('NOT NULL')
      }

      // Unique
      if (col.isUnique && !col.isPrimaryKey) {
        parts.push('UNIQUE')
      }

      // Default value
      if (col.defaultValue.trim()) {
        // Check if it's a special keyword or function
        const defaultVal = col.defaultValue.trim()
        if (
          defaultVal.toUpperCase() === 'NULL' ||
          defaultVal.toUpperCase() === 'CURRENT_TIMESTAMP' ||
          defaultVal.toUpperCase() === 'CURRENT_DATE' ||
          defaultVal.toUpperCase() === 'CURRENT_TIME' ||
          /^\d+$/.test(defaultVal) || // numeric
          /^\d+\.\d+$/.test(defaultVal) // decimal
        ) {
          parts.push(`DEFAULT ${defaultVal}`)
        } else {
          // String value - add quotes
          parts.push(`DEFAULT '${defaultVal.replace(/'/g, "''")}'`)
        }
      }

      return parts.join(' ')
    })

    return `CREATE TABLE ${tableName} (\n${columnDefinitions.join(',\n')}\n);`
  }

  // Add new column
  const handleAddColumn = () => {
    const newId = String(Date.now())
    setColumns([
      ...columns,
      {
        id: newId,
        name: `column_${columns.length + 1}`,
        type: 'TEXT',
        isPrimaryKey: false,
        isAutoIncrement: false,
        isNotNull: false,
        isUnique: false,
        defaultValue: ''
      }
    ])
  }

  // Delete column
  const handleDeleteColumn = (id: string) => {
    if (columns.length === 1) {
      message.warning('At least one column is required')
      return
    }
    setColumns(columns.filter(col => col.id !== id))
  }

  // Move column up
  const handleMoveUp = (index: number) => {
    if (index === 0) return
    const newColumns = [...columns]
    ;[newColumns[index - 1], newColumns[index]] = [
      newColumns[index],
      newColumns[index - 1]
    ]
    setColumns(newColumns)
  }

  // Move column down
  const handleMoveDown = (index: number) => {
    if (index === columns.length - 1) return
    const newColumns = [...columns]
    ;[newColumns[index], newColumns[index + 1]] = [
      newColumns[index + 1],
      newColumns[index]
    ]
    setColumns(newColumns)
  }

  // Update column property
  const handleUpdateColumn = (
    id: string,
    field: keyof ColumnDefinition,
    value: any
  ) => {
    setColumns(
      columns.map(col => {
        if (col.id !== id) return col

        const updated = { ...col, [field]: value }

        // Auto-adjust related fields
        if (field === 'isPrimaryKey' && value === true) {
          // When setting as primary key, automatically set NOT NULL
          updated.isNotNull = true
          // Only one primary key allowed
          return updated
        }

        if (field === 'isAutoIncrement' && value === true) {
          // AUTOINCREMENT requires INTEGER PRIMARY KEY
          if (!col.isPrimaryKey) {
            message.warning(
              'AUTOINCREMENT requires the column to be a PRIMARY KEY'
            )
            return col
          }
          if (col.type !== 'INTEGER') {
            message.warning('AUTOINCREMENT requires INTEGER type')
            return col
          }
        }

        if (field === 'type' && col.isAutoIncrement) {
          // If changing type and AUTOINCREMENT is set, validate
          if (value !== 'INTEGER') {
            message.warning('AUTOINCREMENT requires INTEGER type')
            updated.isAutoIncrement = false
          }
        }

        return updated
      })
    )

    // Ensure only one primary key
    if (field === 'isPrimaryKey' && value === true) {
      setColumns(prevColumns =>
        prevColumns.map(col =>
          col.id === id ? col : { ...col, isPrimaryKey: false }
        )
      )
    }
  }

  // Handle create
  const handleCreate = async () => {
    // Validation
    if (!tableName.trim()) {
      message.error('Please enter a table name')
      return
    }

    if (columns.length === 0) {
      message.error('Please add at least one column')
      return
    }

    // Check for duplicate column names
    const columnNames = columns.map(col => col.name.toLowerCase())
    const duplicates = columnNames.filter(
      (name, index) => columnNames.indexOf(name) !== index
    )
    if (duplicates.length > 0) {
      message.error(`Duplicate column name: ${duplicates[0]}`)
      return
    }

    // Check for empty column names
    const emptyNames = columns.filter(col => !col.name.trim())
    if (emptyNames.length > 0) {
      message.error('All columns must have a name')
      return
    }

    setLoading(true)
    try {
      const sql = generateSQL()
      await onConfirm(sql, tableName)
      // Reset form
      setTableName('')
      setColumns([
        {
          id: '1',
          name: 'id',
          type: 'INTEGER',
          isPrimaryKey: true,
          isAutoIncrement: true,
          isNotNull: true,
          isUnique: false,
          defaultValue: ''
        }
      ])
      setShowPreview(false)
    } catch (error) {
      // Error handled by parent
    } finally {
      setLoading(false)
    }
  }

  // Handle cancel
  const handleCancel = () => {
    setTableName('')
    setColumns([
      {
        id: '1',
        name: 'id',
        type: 'INTEGER',
        isPrimaryKey: true,
        isAutoIncrement: true,
        isNotNull: true,
        isUnique: false,
        defaultValue: ''
      }
    ])
    setShowPreview(false)
    onCancel()
  }

  // Table columns configuration
  const tableColumns: ColumnType<ColumnDefinition>[] = [
    {
      title: 'Order',
      key: 'order',
      width: 80,
      render: (_, __, index) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<ArrowUpOutlined />}
            disabled={index === 0}
            onClick={() => handleMoveUp(index)}
          />
          <Button
            type="text"
            size="small"
            icon={<ArrowDownOutlined />}
            disabled={index === columns.length - 1}
            onClick={() => handleMoveDown(index)}
          />
        </Space>
      )
    },
    {
      title: 'Column Name',
      key: 'name',
      width: 150,
      render: (_, record) => (
        <Input
          value={record.name}
          onChange={e => handleUpdateColumn(record.id, 'name', e.target.value)}
          placeholder="Column name"
          size="small"
        />
      )
    },
    {
      title: 'Type',
      key: 'type',
      width: 120,
      render: (_, record) => (
        <Select
          value={record.type}
          onChange={value => handleUpdateColumn(record.id, 'type', value)}
          size="small"
          style={{ width: '100%' }}
        >
          {DATA_TYPES.map(type => (
            <Select.Option key={type} value={type}>
              {type}
            </Select.Option>
          ))}
        </Select>
      )
    },
    {
      title: 'PK',
      key: 'isPrimaryKey',
      width: 50,
      render: (_, record) => (
        <Checkbox
          checked={record.isPrimaryKey}
          onChange={e =>
            handleUpdateColumn(record.id, 'isPrimaryKey', e.target.checked)
          }
        />
      )
    },
    {
      title: 'AI',
      key: 'isAutoIncrement',
      width: 50,
      render: (_, record) => (
        <Checkbox
          checked={record.isAutoIncrement}
          disabled={!record.isPrimaryKey || record.type !== 'INTEGER'}
          onChange={e =>
            handleUpdateColumn(record.id, 'isAutoIncrement', e.target.checked)
          }
        />
      )
    },
    {
      title: 'NOT NULL',
      key: 'isNotNull',
      width: 80,
      render: (_, record) => (
        <Checkbox
          checked={record.isNotNull}
          disabled={record.isPrimaryKey}
          onChange={e =>
            handleUpdateColumn(record.id, 'isNotNull', e.target.checked)
          }
        />
      )
    },
    {
      title: 'UNIQUE',
      key: 'isUnique',
      width: 70,
      render: (_, record) => (
        <Checkbox
          checked={record.isUnique}
          disabled={record.isPrimaryKey}
          onChange={e =>
            handleUpdateColumn(record.id, 'isUnique', e.target.checked)
          }
        />
      )
    },
    {
      title: 'Default Value',
      key: 'defaultValue',
      width: 150,
      render: (_, record) => (
        <Input
          value={record.defaultValue}
          onChange={e =>
            handleUpdateColumn(record.id, 'defaultValue', e.target.value)
          }
          placeholder="NULL, 0, 'text', etc."
          size="small"
        />
      )
    },
    {
      title: 'Action',
      key: 'action',
      width: 60,
      render: (_, record) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteColumn(record.id)}
        />
      )
    }
  ]

  return (
    <Modal
      title="Create New Table"
      open={visible}
      onCancel={handleCancel}
      width={1000}
      footer={[
        <Button
          key="preview"
          icon={<EyeOutlined />}
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? 'Hide' : 'Show'} SQL Preview
        </Button>,
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button
          key="create"
          type="primary"
          loading={loading}
          onClick={handleCreate}
        >
          Create Table
        </Button>
      ]}
    >
      <Form layout="vertical">
        <Form.Item label="Table Name" required>
          <Input
            value={tableName}
            onChange={e => setTableName(e.target.value)}
            placeholder="Enter table name"
            size="large"
          />
        </Form.Item>

        <Form.Item label="Columns" required>
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              PK = Primary Key, AI = Auto Increment
            </Text>
          </div>
          <Table
            dataSource={columns}
            columns={tableColumns}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
            style={{ marginBottom: 8 }}
          />
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={handleAddColumn}
            block
          >
            Add Column
          </Button>
        </Form.Item>

        {showPreview && (
          <>
            <Divider />
            <Form.Item label="SQL Preview">
              <TextArea
                value={generateSQL()}
                readOnly
                rows={8}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  backgroundColor: '#f5f5f5'
                }}
              />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  )
}
