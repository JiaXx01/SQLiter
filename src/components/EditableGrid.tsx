import React, { useState } from 'react'
import {
  Table,
  Input,
  InputNumber,
  Form,
  Select,
  DatePicker,
  Modal,
  Tooltip
} from 'antd'
import {
  ExclamationCircleOutlined,
  KeyOutlined,
  CloseCircleOutlined,
  CheckCircleOutlined
} from '@ant-design/icons'
import type { InputRef } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { ColumnInfo } from '../types'
import dayjs from 'dayjs'

interface EditableGridProps {
  data: Record<string, unknown>[]
  columns: ColumnInfo[]
  primaryKey: string
  dirtyChanges: Map<number, Record<string, unknown>> // Now keyed by rowid
  selectedRowKeys?: React.Key[]
  containerRef?: React.RefObject<HTMLDivElement | null> // Reference to parent container for height calculation
  visibleColumns?: string[] // Array of visible column names
  onCellValueChange: (
    rowid: number, // Changed from primaryKeyValue to rowid
    columnName: string,
    newValue: string | number | boolean | null
  ) => void
  onSelectionChange?: (selectedRowKeys: React.Key[]) => void
}

interface EditableCellProps {
  title: React.ReactNode
  editable: boolean
  children: React.ReactNode
  dataIndex: string
  record: Record<string, unknown>
  dataType: string
  isPrimaryKey: boolean
  onSave: (value: string | number | boolean | null) => void
}

/**
 * Editable Cell Component
 */
const EditableCell: React.FC<EditableCellProps> = ({
  editable,
  children,
  dataIndex,
  record,
  dataType,
  isPrimaryKey,
  onSave,
  ...restProps
}) => {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState<string | number | boolean | null>(
    record && dataIndex
      ? (record[dataIndex] as string | number | boolean | null) ?? null
      : null
  )
  const inputRef = React.useRef<InputRef>(null)

  const toggleEdit = () => {
    setEditing(!editing)
    setValue(
      record && dataIndex
        ? (record[dataIndex] as string | number | boolean | null) ?? null
        : null
    )
  }

  const save = async () => {
    try {
      setEditing(false)
      if (record && dataIndex) {
        const currentValue = record[dataIndex] as
          | string
          | number
          | boolean
          | null
        if (value !== currentValue) {
          // If editing primary key, show warning
          if (
            isPrimaryKey &&
            currentValue !== null &&
            currentValue !== undefined
          ) {
            Modal.confirm({
              title: 'Warning: Editing Primary Key',
              icon: React.createElement(ExclamationCircleOutlined),
              content:
                'You are about to modify a primary key value. This may affect data integrity and relationships. Are you sure you want to continue?',
              okText: 'Yes, Continue',
              okType: 'danger',
              cancelText: 'Cancel',
              onOk: () => {
                onSave(value)
              },
              onCancel: () => {
                // Reset value to original
                setValue(currentValue)
              }
            })
          } else {
            onSave(value)
          }
        }
      }
    } catch (errInfo) {
      console.log('Save failed:', errInfo)
    }
  }

  React.useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [editing])

  // Get appropriate input component based on data type
  const getInputComponent = () => {
    const dataTypeLower = dataType.toLowerCase()

    // Boolean types
    if (dataTypeLower === 'boolean' || dataTypeLower === 'bool') {
      return (
        <Select
          value={value as boolean | null}
          onChange={val => setValue(val)}
          onBlur={save}
          style={{ width: '100%' }}
          options={[
            { label: 'TRUE', value: true },
            { label: 'FALSE', value: false },
            { label: 'NULL', value: null }
          ]}
        />
      )
    }

    // Numeric types
    if (
      dataTypeLower.includes('int') ||
      dataTypeLower === 'real' ||
      dataTypeLower === 'numeric' ||
      dataTypeLower === 'decimal' ||
      dataTypeLower === 'double' ||
      dataTypeLower === 'float'
    ) {
      return (
        <InputNumber
          value={typeof value === 'number' ? value : undefined}
          onChange={val => setValue(val ?? null)}
          onPressEnter={save}
          onBlur={save}
          style={{ width: '100%' }}
        />
      )
    }

    // Date types
    if (dataTypeLower === 'date') {
      return (
        <DatePicker
          value={value ? dayjs(value as string) : null}
          onChange={date => setValue(date ? date.format('YYYY-MM-DD') : null)}
          onBlur={save}
          style={{ width: '100%' }}
          format="YYYY-MM-DD"
        />
      )
    }

    // DateTime/Timestamp types
    if (dataTypeLower === 'datetime' || dataTypeLower === 'timestamp') {
      return (
        <DatePicker
          showTime
          value={value ? dayjs(value as string) : null}
          onChange={date =>
            setValue(date ? date.format('YYYY-MM-DD HH:mm:ss') : null)
          }
          onBlur={save}
          style={{ width: '100%' }}
          format="YYYY-MM-DD HH:mm:ss"
        />
      )
    }

    // Text/Blob types - use textarea
    if (dataTypeLower === 'text' || dataTypeLower === 'blob') {
      return (
        <Input.TextArea
          ref={inputRef as any}
          value={
            typeof value === 'string'
              ? value
              : value === null
              ? ''
              : String(value)
          }
          onChange={e => setValue(e.target.value || null)}
          onPressEnter={e => {
            if (!e.shiftKey) {
              e.preventDefault()
              save()
            }
          }}
          onBlur={save}
          autoSize={{ minRows: 1, maxRows: 6 }}
        />
      )
    }

    // Default: text input
    return (
      <Input
        ref={inputRef}
        value={
          typeof value === 'string'
            ? value
            : value === null
            ? ''
            : String(value)
        }
        onChange={e => setValue(e.target.value || null)}
        onPressEnter={save}
        onBlur={save}
      />
    )
  }

  // If record is undefined, just render children (header row case)
  if (!record) {
    return (
      <td {...(restProps as React.TdHTMLAttributes<HTMLTableDataCellElement>)}>
        {children}
      </td>
    )
  }

  let childNode = children

  if (editable) {
    childNode = editing ? (
      <Form.Item style={{ margin: 0 }} name={dataIndex} initialValue={value}>
        {getInputComponent()}
      </Form.Item>
    ) : (
      <div
        className="editable-cell-value-wrap"
        style={{
          paddingRight: 24,
          minHeight: 32,
          cursor: 'pointer'
        }}
        onDoubleClick={toggleEdit}
      >
        {children}
      </div>
    )
  }

  return (
    <td {...(restProps as React.TdHTMLAttributes<HTMLTableDataCellElement>)}>
      {childNode}
    </td>
  )
}

/**
 * EditableGrid Component
 *
 * Editable data grid with dirty tracking
 */
export const EditableGrid: React.FC<EditableGridProps> = ({
  data,
  columns: columnInfo,
  primaryKey,
  dirtyChanges,
  selectedRowKeys = [],
  containerRef,
  visibleColumns,
  onCellValueChange,
  onSelectionChange
}) => {
  const [tableHeight, setTableHeight] = React.useState<number>(500)

  React.useEffect(() => {
    const updateHeight = () => {
      if (containerRef?.current) {
        const height = containerRef.current.clientHeight
        // Reserve space for table header (~55px) and some margin
        const scrollHeight = Math.max(200, height - 120)
        setTableHeight(scrollHeight)
      }
    }

    // Use a slight delay for initial calculation to ensure DOM is ready
    const timer = setTimeout(updateHeight, 0)

    // Use ResizeObserver to watch for container size changes
    const resizeObserver = new ResizeObserver(() => {
      updateHeight()
    })

    if (containerRef?.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Also listen to window resize as fallback
    window.addEventListener('resize', updateHeight)

    return () => {
      clearTimeout(timer)
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateHeight)
    }
  }, [containerRef])

  // Filter columns based on visibility selection
  const filteredColumnInfo = visibleColumns
    ? columnInfo.filter(col => visibleColumns.includes(col.column_name))
    : columnInfo

  // Generate Ant Design columns from column info
  const columns: ColumnsType<Record<string, unknown>> = filteredColumnInfo.map(
    col => {
      // Build column title with metadata
      const isPK = col.column_name === primaryKey || col.is_primary_key
      const isNotNull = col.is_nullable === 'NO'
      const hasDefault =
        col.column_default !== null && col.column_default !== undefined

      const columnTitle = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div
            style={{
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {col.column_name}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <span style={{ color: '#1677ff', fontSize: '11px' }}>
              {col.data_type}
            </span>
            {isPK && (
              <Tooltip title="Primary Key">
                <KeyOutlined style={{ color: '#faad14', fontSize: '12px' }} />
              </Tooltip>
            )}
            {isNotNull && (
              <Tooltip title="NOT NULL">
                <CloseCircleOutlined
                  style={{ color: '#ff4d4f', fontSize: '12px' }}
                />
              </Tooltip>
            )}
            {hasDefault && (
              <Tooltip title={`Default: ${col.column_default}`}>
                <CheckCircleOutlined
                  style={{ color: '#52c41a', fontSize: '12px' }}
                />
              </Tooltip>
            )}
          </div>
        </div>
      )

      return {
        title: columnTitle,
        dataIndex: col.column_name,
        key: col.column_name,
        width: 150,
        ellipsis: true,
        onCell: (record: Record<string, unknown>) => {
          // Determine if this cell is editable
          // - rowid is never editable (system column)
          // - all other columns (including primary key) are editable
          const isEditable = col.column_name !== 'rowid'

          // Get rowid for this row - now the stable identifier
          const rowid = record.rowid as number

          return {
            record,
            editable: isEditable,
            dataIndex: col.column_name,
            title: col.column_name,
            dataType: col.data_type,
            isPrimaryKey: col.column_name === primaryKey,
            onSave: (newValue: string | number | boolean | null) => {
              // Simply pass rowid - no complex logic needed
              onCellValueChange(rowid, col.column_name, newValue)
            }
          }
        },
        render: (value: unknown, record: Record<string, unknown>) => {
          // Check if this cell has been modified
          // Now using rowid - simple and direct
          const rowid = record.rowid as number
          const isDirty =
            dirtyChanges.has(rowid) &&
            dirtyChanges.get(rowid)?.[col.column_name] !== undefined

          return (
            <div style={{ position: 'relative' }}>
              {isDirty && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 0,
                    height: 0,
                    borderLeft: '8px solid #ff4d4f',
                    borderBottom: '8px solid transparent'
                  }}
                  title="Modified"
                />
              )}
              {value === null ? (
                <span style={{ color: '#999' }}>(null)</span>
              ) : (
                String(value)
              )}
            </div>
          )
        }
      }
    }
  )

  // Add selection column
  const rowSelection = onSelectionChange
    ? {
        selectedRowKeys,
        onChange: (newSelectedRowKeys: React.Key[]) => {
          onSelectionChange(newSelectedRowKeys)
        }
      }
    : undefined

  return (
    <Form component={false}>
      <Table
        components={{
          body: {
            cell: EditableCell
          }
        }}
        rowSelection={
          rowSelection
            ? {
                type: 'checkbox',
                ...rowSelection
              }
            : undefined
        }
        dataSource={data}
        columns={columns}
        rowKey={record => {
          // Always use rowid as the stable row identifier
          return `rowid_${record.rowid}`
        }}
        pagination={false}
        scroll={{ x: 'max-content', y: tableHeight }}
        size="small"
        bordered
      />
    </Form>
  )
}
