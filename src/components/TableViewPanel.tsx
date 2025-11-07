import React, { useEffect, useState } from 'react'
import { Button, Space, Alert, Spin, Pagination, message, Modal } from 'antd'
import {
  ReloadOutlined,
  SaveOutlined,
  PlusOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  ExportOutlined,
  ImportOutlined
} from '@ant-design/icons'
import { useTabStore } from '../stores/useTabStore'
import { EditableGrid } from './EditableGrid'
import { AddRowDialog } from './AddRowDialog'
import { FilterBuilder } from './FilterBuilder'
import { ColumnSelector } from './ColumnSelector'
import { ExportDialog } from './ExportDialog'
import { ImportDialog } from './ImportDialog'
import type { TableViewTab, FilterCondition } from '../types'
import type { ExportOptions } from './ExportDialog'

interface TableViewPanelProps {
  tabKey: string
}

/**
 * TableViewPanel Component
 *
 * Displays table data with pagination (editable grid will be added in Phase 3)
 */
export const TableViewPanel: React.FC<TableViewPanelProps> = ({ tabKey }) => {
  const tab = useTabStore(state =>
    state.tabs.find(t => t.key === tabKey && t.type === 'table_view')
  ) as TableViewTab | undefined

  const loadTableData = useTabStore(state => state.loadTableData)
  const saveChangesForTableTab = useTabStore(
    state => state.saveChangesForTableTab
  )
  const updateCellValue = useTabStore(state => state.updateCellValue)
  const addNewRow = useTabStore(state => state.addNewRow)
  const deleteRows = useTabStore(state => state.deleteRows)
  const updateFilterConditions = useTabStore(
    state => state.updateFilterConditions
  )
  const changePage = useTabStore(state => state.changePage)
  const exportTableData = useTabStore(state => state.exportTableData)
  const importTableData = useTabStore(state => state.importTableData)

  const [addRowDialogVisible, setAddRowDialogVisible] = useState(false)
  const [exportDialogVisible, setExportDialogVisible] = useState(false)
  const [importDialogVisible, setImportDialogVisible] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const tableContainerRef = React.useRef<HTMLDivElement>(null)

  // Initialize visible columns when tab columns are loaded
  useEffect(() => {
    if (tab && tab.columns.length > 0 && visibleColumns.length === 0) {
      setVisibleColumns(tab.columns.map(col => col.column_name))
    }
  }, [tab?.columns])

  useEffect(() => {
    if (tab) {
      loadTableData(tabKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKey])

  if (!tab) {
    return <div>Tab not found</div>
  }

  const handleRefresh = () => {
    loadTableData(tabKey)
  }

  const handleSave = async () => {
    try {
      await saveChangesForTableTab(tabKey)
      message.success('Changes saved successfully')
    } catch {
      message.error('Failed to save changes')
    }
  }

  const handleCellValueChange = (
    rowid: number,
    columnName: string,
    newValue: string | number | boolean | null
  ) => {
    updateCellValue(tabKey, rowid, columnName, newValue)
  }

  const handleAddRow = () => {
    setAddRowDialogVisible(true)
  }

  const handleAddRowConfirm = async (rowData: Record<string, any>) => {
    try {
      await addNewRow(tabKey, rowData)
      setAddRowDialogVisible(false)
      message.success('Row added successfully')
    } catch {
      // Error already handled in store
    }
  }

  const handleDeleteSelected = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select rows to delete')
      return
    }

    Modal.confirm({
      title: 'Delete Rows',
      icon: React.createElement(ExclamationCircleOutlined),
      content: `Are you sure you want to delete ${selectedRowKeys.length} row(s)? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          // Extract rowid from selectedRowKeys (format: "rowid_123")
          const rowids = selectedRowKeys.map(key => {
            const keyStr = String(key)
            return parseInt(keyStr.replace('rowid_', ''))
          })
          await deleteRows(tabKey, rowids)
          setSelectedRowKeys([])
          message.success(
            `${selectedRowKeys.length} row(s) deleted successfully`
          )
        } catch {
          // Error already handled in store
        }
      }
    })
  }

  const handleSelectionChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys)
  }

  const handleFilterChange = (conditions: FilterCondition[]) => {
    updateFilterConditions(tabKey, conditions)
  }

  const handleVisibleColumnsChange = (newVisibleColumns: string[]) => {
    setVisibleColumns(newVisibleColumns)
  }

  const handlePageChange = (page: number, pageSize: number) => {
    changePage(tabKey, page, pageSize)
  }

  const handleExport = () => {
    setExportDialogVisible(true)
  }

  const handleExportConfirm = async (options: ExportOptions) => {
    try {
      await exportTableData(tabKey, options)
      setExportDialogVisible(false)
      message.success('Data exported successfully')
    } catch (error) {
      message.error(
        `Export failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  const handleImport = () => {
    setImportDialogVisible(true)
  }

  const handleImportConfirm = async (data: Record<string, any>[]) => {
    try {
      await importTableData(tabKey, data)
      setImportDialogVisible(false)
      message.success(`Successfully imported ${data.length} rows`)
    } catch (error) {
      message.error(
        `Import failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      )
    }
  }

  const hasDirtyChanges = tab.dirtyChanges.size > 0

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          padding: '8px 12px 0 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
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
            Save Changes {hasDirtyChanges && `(${tab.dirtyChanges.size})`}
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={handleAddRow}
            disabled={tab.isLoading}
          >
            Add Row
          </Button>
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={handleDeleteSelected}
            disabled={tab.isLoading || selectedRowKeys.length === 0}
          >
            Delete Selected{' '}
            {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
          </Button>
          <Button
            icon={<ExportOutlined />}
            onClick={handleExport}
            disabled={tab.isLoading}
          >
            Export
          </Button>
          <Button
            icon={<ImportOutlined />}
            onClick={handleImport}
            disabled={tab.isLoading}
          >
            Import
          </Button>
          <ColumnSelector
            columns={tab.columns}
            visibleColumns={visibleColumns}
            onVisibleColumnsChange={handleVisibleColumnsChange}
          />
        </Space>

        <div style={{ color: '#666', fontSize: '12px' }}>
          Primary Key: {tab.primaryKey || '(none - using rowid)'}
        </div>
      </div>

      {/* Main Content Container - Flex container for all content below toolbar */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        {/* Error Display */}
        {tab.error && (
          <Alert
            message="Error Loading Table Data"
            description={tab.error}
            type="error"
            showIcon
            closable
            style={{ margin: '8px', marginBottom: 0, flexShrink: 0 }}
          />
        )}

        {/* Filter Builder - Auto height based on content */}
        <div style={{ padding: '8px 12px 0 12px', flexShrink: 0 }}>
          <FilterBuilder
            columns={tab.columns}
            conditions={tab.filterConditions}
            onChange={handleFilterChange}
          />
        </div>

        {/* Table Container - Takes remaining space */}
        <div
          ref={tableContainerRef}
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            marginTop: '8px'
          }}
        >
          {/* Data Grid - Scrollable area */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              padding: '0 12px 0 12px',
              overflow: 'hidden'
            }}
          >
            <Spin spinning={tab.isLoading}>
              <div style={{ height: '100%', overflow: 'hidden' }}>
                {tab.data.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '200px',
                      color: '#999'
                    }}
                  >
                    No data in this table
                  </div>
                ) : (
                  <EditableGrid
                    data={tab.data}
                    columns={tab.columns}
                    primaryKey={tab.primaryKey}
                    dirtyChanges={tab.dirtyChanges}
                    selectedRowKeys={selectedRowKeys}
                    containerRef={tableContainerRef}
                    visibleColumns={visibleColumns}
                    onCellValueChange={handleCellValueChange}
                    onSelectionChange={handleSelectionChange}
                  />
                )}
              </div>
            </Spin>
          </div>

          {/* Pagination - Fixed at bottom of table container */}
          {tab.data.length > 0 && (
            <div
              style={{
                padding: '8px 12px',
                borderTop: '1px solid #f0f0f0',
                display: 'flex',
                justifyContent: 'flex-end',
                flexShrink: 0,
                backgroundColor: '#fff'
              }}
            >
              <Pagination
                current={tab.page}
                pageSize={tab.pageSize}
                total={tab.total}
                showSizeChanger
                showTotal={total => `Total ${total} rows`}
                onChange={handlePageChange}
                onShowSizeChange={handlePageChange}
                pageSizeOptions={['10', '20', '50', '100', '200']}
                disabled={tab.isLoading}
              />
            </div>
          )}
        </div>
      </div>

      {/* Add Row Dialog */}
      <AddRowDialog
        visible={addRowDialogVisible}
        columns={tab.columns}
        primaryKey={tab.primaryKey}
        onCancel={() => setAddRowDialogVisible(false)}
        onConfirm={handleAddRowConfirm}
      />

      {/* Export Dialog */}
      <ExportDialog
        visible={exportDialogVisible}
        tableName={tab.tableName}
        columns={tab.columns}
        currentFilters={tab.filterConditions}
        onCancel={() => setExportDialogVisible(false)}
        onConfirm={handleExportConfirm}
      />

      {/* Import Dialog */}
      <ImportDialog
        visible={importDialogVisible}
        tableName={tab.tableName}
        columns={tab.columns}
        onCancel={() => setImportDialogVisible(false)}
        onConfirm={handleImportConfirm}
      />
    </div>
  )
}
