import React from 'react'
import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'

interface ResultsGridProps {
  data: any[]
}

/**
 * ResultsGrid Component
 *
 * Read-only grid for displaying SQL query results
 */
export const ResultsGrid: React.FC<ResultsGridProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '200px',
          color: '#999'
        }}
      >
        No data returned
      </div>
    )
  }

  // Generate columns from first row
  const columns: ColumnsType<any> = Object.keys(data[0]).map(key => ({
    title: key,
    dataIndex: key,
    key: key,
    ellipsis: true,
    width: 150
  }))

  return (
    <Table
      dataSource={data}
      columns={columns}
      rowKey={(_record, index) => index?.toString() || '0'}
      pagination={{ pageSize: 50 }}
      scroll={{ x: 'max-content', y: 400 }}
      size="small"
      bordered
    />
  )
}
