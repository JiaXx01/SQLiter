import React, { useEffect, useState, useMemo } from 'react'
import { Tree, Spin, Modal, message, Button, Input } from 'antd'
import type { DataNode, TreeProps } from 'antd/es/tree'
import { useSchemaStore } from '../stores/useSchemaStore'
import { useTabStore } from '../stores/useTabStore'
import { ContextMenu } from './ContextMenu'
import { CreateTableDialog } from './CreateTableDialog'
import type { TreeNodeData, ContextMenuAction } from '../types'
import {
  TableOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  FileAddOutlined,
  CodeOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { apiService } from '../services/api.service'

/**
 * SchemaExplorer Component
 *
 * Displays SQLite database tables as a tree with lazy loading for columns
 * Supports context menu for table operations
 */
export const SchemaExplorer: React.FC = () => {
  const { treeData, loadingKeys, fetchInitialSchema, fetchChildrenForNode } =
    useSchemaStore()
  const addTab = useTabStore(state => state.addTab)
  const tabs = useTabStore(state => state.tabs)
  const activeKey = useTabStore(state => state.activeKey)

  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    node: TreeNodeData | null
  }>({ visible: false, x: 0, y: 0, node: null })

  const [selectedKeys, setSelectedKeys] = useState<string[]>([])
  const [createTableDialogVisible, setCreateTableDialogVisible] =
    useState(false)
  const [searchValue, setSearchValue] = useState<string>('')
  const [debouncedSearchValue, setDebouncedSearchValue] = useState<string>('')

  // Load initial schema on mount
  useEffect(() => {
    fetchInitialSchema()
  }, [fetchInitialSchema])

  // Debounce search value to avoid excessive filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue)
    }, 300) // 300ms debounce delay

    return () => clearTimeout(timer)
  }, [searchValue])

  // Sync tree selection with active tab
  useEffect(() => {
    if (!activeKey) {
      setSelectedKeys([])
      return
    }

    // Find the active tab
    const activeTab = tabs.find(tab => tab.key === activeKey)
    if (!activeTab) {
      setSelectedKeys([])
      return
    }

    // For table_view and table_structure tabs, find and select the corresponding tree node
    if (
      activeTab.type === 'table_view' ||
      activeTab.type === 'table_structure'
    ) {
      const tableName = activeTab.tableName
      const schemaName = activeTab.schemaName

      // Find the table node in the tree
      const findTableNode = (nodes: TreeNodeData[]): TreeNodeData | null => {
        for (const node of nodes) {
          if (
            node.type === 'table' &&
            node.tableName === tableName &&
            node.schemaName === schemaName
          ) {
            return node
          }
          if (node.children) {
            const found = findTableNode(node.children)
            if (found) return found
          }
        }
        return null
      }

      const tableNode = findTableNode(treeData)
      if (tableNode) {
        setSelectedKeys([tableNode.key])
      } else {
        setSelectedKeys([])
      }
    } else {
      // For SQL editor tabs, don't select any tree node
      setSelectedKeys([])
    }
  }, [activeKey, tabs, treeData])

  /**
   * Filter tree data based on debounced search value
   * Using useMemo to avoid unnecessary recalculations
   */
  const filteredTreeData = useMemo(() => {
    if (!debouncedSearchValue) return treeData

    const lowerSearch = debouncedSearchValue.toLowerCase()
    return treeData.filter(node => {
      // For table nodes, filter by table name
      if (node.type === 'table') {
        return node.tableName?.toLowerCase().includes(lowerSearch)
      }
      return true
    })
  }, [treeData, debouncedSearchValue])

  /**
   * Convert TreeNodeData to Ant Design DataNode format
   */
  const convertToDataNode = (nodes: TreeNodeData[]): DataNode[] => {
    return nodes.map(node => ({
      key: node.key,
      title: node.title,
      icon: node.icon,
      isLeaf: node.isLeaf,
      children: node.children ? convertToDataNode(node.children) : undefined
    }))
  }

  /**
   * Handle tree node expansion (lazy loading)
   */
  const onLoadData: TreeProps['loadData'] = async treeNode => {
    const nodeKey = treeNode.key as string

    // Find the original node data
    const findNode = (
      nodes: TreeNodeData[],
      key: string
    ): TreeNodeData | null => {
      for (const node of nodes) {
        if (node.key === key) return node
        if (node.children) {
          const found = findNode(node.children, key)
          if (found) return found
        }
      }
      return null
    }

    const node = findNode(treeData, nodeKey)
    if (node) {
      await fetchChildrenForNode(nodeKey, node)
    }
  }

  /**
   * Handle create table action
   */
  const handleCreateTable = () => {
    setCreateTableDialogVisible(true)
  }

  const handleCreateTableConfirm = async (sql: string, tableName: string) => {
    try {
      const results = await apiService.execute(sql)

      if (results[0]?.error) {
        message.error(`Failed to create table: ${results[0].error}`)
        throw new Error(results[0].error)
      } else {
        message.success(`Table "${tableName}" created successfully`)
        // Refresh schema tree
        fetchInitialSchema()
        // Close dialog
        setCreateTableDialogVisible(false)
      }
    } catch (error) {
      message.error(`Failed to create table: ${error}`)
      throw error
    }
  }

  /**
   * Handle refresh schema action
   */
  const handleRefreshSchema = () => {
    fetchInitialSchema()
    message.success('Schema refreshed')
  }

  /**
   * Handle new query action
   */
  const handleNewQuery = () => {
    addTab({
      type: 'sql_editor',
      title: 'Query',
      sql: '',
      isLoading: false,
      results: []
    })
  }

  /**
   * Handle refresh single table action
   */
  const handleRefreshTable = async (nodeKey: string, node: TreeNodeData) => {
    try {
      // Clear the children to force reload
      const findAndUpdateNode = (
        nodes: TreeNodeData[],
        key: string
      ): TreeNodeData[] => {
        return nodes.map(n => {
          if (n.key === key) {
            return { ...n, children: undefined }
          }
          if (n.children) {
            return { ...n, children: findAndUpdateNode(n.children, key) }
          }
          return n
        })
      }

      // Update tree data to clear children
      const updatedTreeData = findAndUpdateNode(treeData, nodeKey)
      useSchemaStore.setState({ treeData: updatedTreeData })

      // Reload children
      await fetchChildrenForNode(nodeKey, node)
      message.success(`Table "${node.tableName}" refreshed`)
    } catch (error) {
      message.error(`Failed to refresh table: ${error}`)
    }
  }

  /**
   * Handle drop table action
   */
  const handleDropTable = (tableName: string) => {
    Modal.confirm({
      title: 'Drop Table',
      icon: React.createElement(ExclamationCircleOutlined),
      content: `Are you sure you want to drop table "${tableName}"? This action cannot be undone.`,
      okText: 'Drop',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          const sql = `DROP TABLE ${tableName}`
          const results = await apiService.execute(sql)

          if (results[0]?.error) {
            message.error(`Failed to drop table: ${results[0].error}`)
          } else {
            message.success(`Table "${tableName}" dropped successfully`)
            // Refresh schema tree
            fetchInitialSchema()
          }
        } catch (error) {
          message.error(`Failed to drop table: ${error}`)
        }
      }
    })
  }

  /**
   * Get context menu items for a node
   */
  const getContextMenuItems = (node: TreeNodeData): ContextMenuAction[] => {
    const items: ContextMenuAction[] = []

    if (node.type === 'table') {
      items.push(
        {
          key: 'open-table',
          label: 'Open Table',
          icon: React.createElement(TableOutlined),
          onClick: () => {
            addTab({
              type: 'table_view',
              title: node.tableName!,
              tableName: node.tableName!,
              schemaName: node.schemaName,
              isLoading: false,
              data: [],
              columns: [],
              primaryKey: 'id',
              error: null,
              dirtyChanges: new Map(),
              page: 1,
              pageSize: 50,
              total: 0,
              filterConditions: []
            })
          }
        },
        {
          key: 'view-structure',
          label: 'View Structure',
          icon: React.createElement(InfoCircleOutlined),
          onClick: () => {
            addTab({
              type: 'table_structure',
              title: `Structure - ${node.tableName}`,
              tableName: node.tableName!,
              schemaName: node.schemaName,
              isLoading: false,
              columns: [],
              error: null,
              dirtyStructureChanges: new Map()
            })
          }
        },
        {
          key: 'refresh-table',
          label: 'Refresh Table',
          icon: React.createElement(ReloadOutlined),
          onClick: () => {
            handleRefreshTable(node.key, node)
          }
        },
        {
          key: 'drop-table',
          label: 'Drop Table',
          icon: React.createElement(DeleteOutlined),
          danger: true,
          onClick: () => {
            handleDropTable(node.tableName!)
          }
        }
      )
    }

    return items
  }

  /**
   * Handle right-click on tree node
   */
  const handleRightClick = ({ event, node }: any) => {
    event.preventDefault()

    // Find the original node data
    const findNode = (
      nodes: TreeNodeData[],
      key: string
    ): TreeNodeData | null => {
      for (const n of nodes) {
        if (n.key === key) return n
        if (n.children) {
          const found = findNode(n.children, key)
          if (found) return found
        }
      }
      return null
    }

    const nodeData = findNode(treeData, node.key as string)
    if (!nodeData) return

    const menuItems = getContextMenuItems(nodeData)
    if (menuItems.length === 0) return

    // Show context menu
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      node: nodeData
    })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div
        style={{
          height: '46px',
          padding: '8px 12px',
          borderBottom: '1px solid #f0f0f0',
          backgroundColor: '#fafafa',
          display: 'flex',
          gap: '8px',
          justifyContent: 'space-around',
          alignItems: 'center'
        }}
      >
        <Button
          icon={<CodeOutlined />}
          onClick={handleNewQuery}
          title="Query"
        />
        <Button
          icon={<FileAddOutlined />}
          onClick={handleCreateTable}
          title="Create Table"
        />
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefreshSchema}
          title="Refresh Schema"
        />
      </div>

      {/* Search Box */}
      <div style={{ padding: '8px 12px' }}>
        <Input
          placeholder="Search tables..."
          prefix={<SearchOutlined />}
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          allowClear
        />
      </div>

      {/* Tree */}
      <div style={{ flex: 1, paddingRight: '4px', overflowY: 'auto' }}>
        <Spin spinning={loadingKeys.size > 0}>
          <Tree
            showIcon
            loadData={onLoadData}
            treeData={convertToDataNode(filteredTreeData)}
            onRightClick={handleRightClick}
            className="schema-tree"
            selectedKeys={selectedKeys}
            onSelect={(keys, info) => {
              // Update local selected keys state
              setSelectedKeys(keys as string[])
              // Click to open table
              if (info.node) {
                const findNode = (
                  nodes: TreeNodeData[],
                  key: string
                ): TreeNodeData | null => {
                  for (const n of nodes) {
                    if (n.key === key) return n
                    if (n.children) {
                      const found = findNode(n.children, key)
                      if (found) return found
                    }
                  }
                  return null
                }

                const nodeData = findNode(treeData, info.node.key as string)
                if (nodeData?.type === 'table') {
                  addTab({
                    type: 'table_view',
                    title: nodeData.tableName!,
                    tableName: nodeData.tableName!,
                    schemaName: nodeData.schemaName,
                    isLoading: false,
                    data: [],
                    columns: [],
                    primaryKey: 'id',
                    error: null,
                    dirtyChanges: new Map(),
                    page: 1,
                    pageSize: 50,
                    total: 0,
                    filterConditions: []
                  })
                }
              }
            }}
          />
        </Spin>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.node && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={getContextMenuItems(contextMenu.node)}
          onClose={() =>
            setContextMenu({ visible: false, x: 0, y: 0, node: null })
          }
        />
      )}

      {/* Create Table Dialog */}
      <CreateTableDialog
        visible={createTableDialogVisible}
        onCancel={() => setCreateTableDialogVisible(false)}
        onConfirm={handleCreateTableConfirm}
      />

      {/* Custom styles for tree */}
      <style>{`
        .schema-tree .ant-tree-treenode {
          width: 100%;
          display: flex;
          align-items: center;
        }
        
        .schema-tree .ant-tree-node-content-wrapper {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          overflow: hidden;
        }
        
        .schema-tree .ant-tree-iconEle {
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
        }
        
        .schema-tree .ant-tree-title {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }
        
        .schema-tree .ant-tree-switcher {
          flex-shrink: 0;
        }
      `}</style>
    </div>
  )
}
