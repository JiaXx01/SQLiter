import { create } from 'zustand'
import type { TreeNodeData } from '../types'
import { apiService } from '../services/api.service'
import { TableOutlined, ColumnHeightOutlined } from '@ant-design/icons'
import React from 'react'

interface SchemaStoreState {
  // Tree data for Ant Design Tree component
  treeData: TreeNodeData[]

  // Schema cache for autocomplete: { "tableName": ["col1", "col2", ...] }
  schemaMap: Map<string, string[]>

  // Keys of nodes currently being loaded
  loadingKeys: Set<string>

  // Actions
  fetchInitialSchema: () => Promise<void>
  fetchChildrenForNode: (nodeKey: string, node: TreeNodeData) => Promise<void>
  updateTreeNode: (nodeKey: string, updates: Partial<TreeNodeData>) => void
}

/**
 * Recursively find and update a node in the tree
 */
function updateNodeInTree(
  nodes: TreeNodeData[],
  nodeKey: string,
  updates: Partial<TreeNodeData>
): TreeNodeData[] {
  return nodes.map(node => {
    if (node.key === nodeKey) {
      return { ...node, ...updates }
    }
    if (node.children) {
      return {
        ...node,
        children: updateNodeInTree(node.children, nodeKey, updates)
      }
    }
    return node
  })
}

export const useSchemaStore = create<SchemaStoreState>((set, get) => ({
  treeData: [],
  schemaMap: new Map(),
  loadingKeys: new Set(),

  /**
   * Fetch initial top-level schema (list of tables)
   */
  fetchInitialSchema: async () => {
    try {
      const { treeData: oldTreeData } = get()

      // For SQLite, fetch tables directly
      const sql =
        "SELECT name as table_name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      const results = await apiService.execute(sql)

      if (results[0]?.rows) {
        // Create a map of old table nodes to preserve their children
        const oldTableMap = new Map<string, TreeNodeData>()
        oldTreeData.forEach(node => {
          if (node.type === 'table' && node.tableName) {
            oldTableMap.set(node.tableName, node)
          }
        })

        const tableNodes: TreeNodeData[] = results[0].rows.map((row: any) => {
          const oldNode = oldTableMap.get(row.table_name)

          return {
            key: `table-${row.table_name}`,
            title: row.table_name,
            type: 'table',
            icon: React.createElement(TableOutlined),
            tableName: row.table_name,
            isLeaf: false, // Tables have children (columns), so not a leaf node
            // Preserve children if they were already loaded
            children: oldNode?.children
          }
        })

        set({ treeData: tableNodes })

        // Preload all table columns for autocomplete
        const newSchemaMap = new Map<string, string[]>()
        for (const row of results[0].rows) {
          try {
            const tableName = row.table_name
            // PRAGMA table_info requires single-quoted table name for reserved keywords
            const columnSql = `PRAGMA table_info('${tableName.replace(
              /'/g,
              "''"
            )}')`
            const columnResults = await apiService.execute(columnSql)

            if (columnResults[0]?.rows) {
              newSchemaMap.set(
                tableName,
                columnResults[0].rows.map((col: any) => col.name)
              )
            }
          } catch (error) {
            console.error(
              `Failed to preload columns for ${row.table_name}:`,
              error
            )
          }
        }
        set({ schemaMap: newSchemaMap })
      } else {
        set({ treeData: [] })
      }
    } catch (error) {
      console.error('Failed to fetch initial schema:', error)
      set({ treeData: [] })
    }
  },

  /**
   * Lazy load children for a specific node (columns for tables)
   */
  fetchChildrenForNode: async (nodeKey: string, node: TreeNodeData) => {
    const { loadingKeys, schemaMap } = get()

    // Prevent duplicate loading
    if (loadingKeys.has(nodeKey)) {
      return
    }

    // Mark as loading
    set(state => ({
      loadingKeys: new Set(state.loadingKeys).add(nodeKey)
    }))

    try {
      if (node.type === 'table') {
        // Fetch columns for this table using SQLite's PRAGMA
        // PRAGMA table_info requires single-quoted table name for reserved keywords
        const sql = `PRAGMA table_info('${node.tableName!.replace(
          /'/g,
          "''"
        )}')`
        const results = await apiService.execute(sql)

        if (results[0]?.rows) {
          const columnNodes: TreeNodeData[] = results[0].rows.map(
            (col: any) => ({
              key: `column-${node.tableName}-${col.name}`,
              title: `${col.name} (${col.type})`,
              type: 'column',
              icon: React.createElement(ColumnHeightOutlined),
              isLeaf: true,
              columnInfo: {
                column_name: col.name,
                data_type: col.type,
                is_nullable: col.notnull === 0 ? 'YES' : 'NO'
              },
              tableName: node.tableName
            })
          )

          // Update tree with column nodes
          set(state => ({
            treeData: updateNodeInTree(state.treeData, nodeKey, {
              children: columnNodes
            })
          }))

          // Update schema map for autocomplete
          const newSchemaMap = new Map(schemaMap)
          newSchemaMap.set(
            node.tableName!,
            results[0].rows.map((col: any) => col.name)
          )
          set({ schemaMap: newSchemaMap })
        }
      }
    } catch (error) {
      console.error(`Failed to load children for ${nodeKey}:`, error)
    } finally {
      // Remove loading state
      set(state => {
        const newLoadingKeys = new Set(state.loadingKeys)
        newLoadingKeys.delete(nodeKey)
        return { loadingKeys: newLoadingKeys }
      })
    }
  },

  /**
   * Update a specific node in the tree
   */
  updateTreeNode: (nodeKey: string, updates: Partial<TreeNodeData>) => {
    set(state => ({
      treeData: updateNodeInTree(state.treeData, nodeKey, updates)
    }))
  }
}))
