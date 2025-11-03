import React from 'react'
import { Button, Dropdown, Checkbox, Space, Divider } from 'antd'
import { ColumnHeightOutlined } from '@ant-design/icons'
import type { ColumnInfo } from '../types'
import type { MenuProps } from 'antd'

interface ColumnSelectorProps {
  columns: ColumnInfo[]
  visibleColumns: string[]
  onVisibleColumnsChange: (visibleColumns: string[]) => void
}

/**
 * ColumnSelector Component
 * 
 * Provides a dropdown menu for selecting which columns to display in the table
 */
export const ColumnSelector: React.FC<ColumnSelectorProps> = ({
  columns,
  visibleColumns,
  onVisibleColumnsChange
}) => {
  const handleColumnToggle = (columnName: string, checked: boolean) => {
    if (checked) {
      onVisibleColumnsChange([...visibleColumns, columnName])
    } else {
      onVisibleColumnsChange(visibleColumns.filter(col => col !== columnName))
    }
  }

  const handleSelectAll = () => {
    onVisibleColumnsChange(columns.map(col => col.column_name))
  }

  const handleDeselectAll = () => {
    onVisibleColumnsChange([])
  }

  const dropdownMenu = (
    <div
      style={{
        backgroundColor: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: '6px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
        padding: '8px 0',
        minWidth: '200px',
        maxWidth: '300px',
        maxHeight: '400px',
        overflow: 'auto'
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header with actions */}
      <div style={{ padding: '4px 12px 8px 12px' }}>
        <Space size="small">
          <Button
            type="link"
            size="small"
            onClick={handleSelectAll}
            style={{ padding: 0, height: 'auto' }}
          >
            Select All
          </Button>
          <Divider type="vertical" style={{ margin: '0 4px' }} />
          <Button
            type="link"
            size="small"
            onClick={handleDeselectAll}
            style={{ padding: 0, height: 'auto' }}
          >
            Deselect All
          </Button>
        </Space>
        <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
          {visibleColumns.length} / {columns.length} columns selected
        </div>
      </div>

      <Divider style={{ margin: '4px 0' }} />

      {/* Column list */}
      <div style={{ padding: '4px 0' }}>
        {columns.map(col => (
          <div
            key={col.column_name}
            style={{
              padding: '6px 12px',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#f5f5f5'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
            onClick={() => {
              const isChecked = visibleColumns.includes(col.column_name)
              handleColumnToggle(col.column_name, !isChecked)
            }}
          >
            <Checkbox
              checked={visibleColumns.includes(col.column_name)}
              onChange={e => handleColumnToggle(col.column_name, e.target.checked)}
              onClick={e => e.stopPropagation()}
            >
              <span style={{ fontSize: '14px' }}>{col.column_name}</span>
              <span style={{ fontSize: '12px', color: '#999', marginLeft: '8px' }}>
                {col.data_type}
              </span>
            </Checkbox>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <Dropdown
      menu={{ items: [] }}
      popupRender={() => dropdownMenu}
      trigger={['click']}
      placement="bottomRight"
    >
      <Button icon={<ColumnHeightOutlined />}>
        Columns ({visibleColumns.length}/{columns.length})
      </Button>
    </Dropdown>
  )
}

