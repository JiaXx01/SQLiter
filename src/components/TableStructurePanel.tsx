import React, { useEffect } from 'react'
import { Button, Space, Alert, Spin, Table, Tag } from 'antd'
import { ReloadOutlined, SaveOutlined, KeyOutlined } from '@ant-design/icons'
import { useTabStore } from '../stores/useTabStore'
import type { TableStructureTab } from '../types'
import type { ColumnsType } from 'antd/es/table'

interface TableStructurePanelProps {
  tabKey: string
}

/**
 * TableStructurePanel Component
 *
 * Displays table structure (columns, types, constraints)
 */
export const TableStructurePanel: React.FC<TableStructurePanelProps> = ({
  tabKey
}) => {
  const tab = useTabStore(state =>
    state.tabs.find(t => t.key === tabKey && t.type === 'table_structure')
  ) as TableStructureTab | undefined

  const loadTableStructure = useTabStore(state => state.loadTableStructure)
  const saveStructureChanges = useTabStore(state => state.saveStructureChanges)

  useEffect(() => {
    if (tab) {
      loadTableStructure(tabKey)
    }
  }, [tabKey, loadTableStructure])

  if (!tab) {
    return <div>Tab not found</div>
  }

  const handleRefresh = () => {
    loadTableStructure(tabKey)
  }

  const handleSave = () => {
    saveStructureChanges(tabKey)
  }

  const hasDirtyChanges = tab.dirtyStructureChanges.size > 0

  const columns: ColumnsType<any> = [
    {
      title: 'Column Name',
      dataIndex: 'column_name',
      key: 'column_name',
      width: 200,
      render: (val, record) => (
        <Space>
          {record.is_primary_key && <KeyOutlined style={{ color: '#faad14' }} />}
          <span style={{ fontWeight: record.is_primary_key ? 600 : 400 }}>{val}</span>
        </Space>
      )
    },
    {
      title: 'Data Type',
      dataIndex: 'data_type',
      key: 'data_type',
      width: 150
    },
    {
      title: 'Nullable',
      dataIndex: 'is_nullable',
      key: 'is_nullable',
      width: 100,
      render: val => (
        <Tag color={val === 'NO' ? 'red' : 'default'}>
          {val}
        </Tag>
      )
    },
    {
      title: 'Primary Key',
      dataIndex: 'is_primary_key',
      key: 'is_primary_key',
      width: 100,
      render: val => (
        val ? <Tag color="gold">PK</Tag> : '-'
      )
    },
    {
      title: 'Default',
      dataIndex: 'column_default',
      key: 'column_default',
      width: 150,
      render: val => val || '-'
    },
    {
      title: 'Max Length',
      dataIndex: 'character_maximum_length',
      key: 'character_maximum_length',
      width: 120,
      render: val => val || '-'
    },
    {
      title: 'Precision',
      dataIndex: 'numeric_precision',
      key: 'numeric_precision',
      width: 100,
      render: val => val || '-'
    }
  ]

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div
        style={{
          padding: '8px 16px',
          borderBottom: '1px solid #f0f0f0',
          backgroundColor: '#fafafa'
        }}
      >
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={tab.isLoading}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            disabled={!hasDirtyChanges}
            loading={tab.isLoading}
          >
            Save Changes
          </Button>
        </Space>
      </div>

      {/* Error Display */}
      {tab.error && (
        <Alert
          message="Error Loading Table Structure"
          description={tab.error}
          type="error"
          showIcon
          closable
          style={{ margin: '16px' }}
        />
      )}

      {/* Structure Grid */}
      <Spin spinning={tab.isLoading}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          <Table
            dataSource={tab.columns}
            columns={columns}
            rowKey="column_name"
            pagination={false}
            size="small"
            bordered
          />
        </div>
      </Spin>
    </div>
  )
}
