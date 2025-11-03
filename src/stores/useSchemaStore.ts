import { create } from 'zustand'
import type { TreeNodeData } from '../types'
import { apiService } from '../services/api.service'
import { TableOutlined, ColumnHeightOutlined } from '@ant-design/icons'
import React from 'react'

interface ColumnInfo {
  name: string
  type: string
  notnull: number
}

interface SchemaStoreState {
  // Tree data for Ant Design Tree component
  treeData: TreeNodeData[]

  // Schema cache for autocomplete: { "tableName": ["col1", "col2", ...] }
  schemaMap: Map<string, string[]>

  // Full column info cache: { "tableName": [{ name, type, notnull }, ...] }
  columnInfoCache: Map<string, ColumnInfo[]>

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
  columnInfoCache: new Map(),
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

        // Preload all table columns for autocomplete in a SINGLE batch request
        // This optimizes from N requests (one per table) to just 1 request
        const newSchemaMap = new Map<string, string[]>()
        const newColumnInfoCache = new Map<string, ColumnInfo[]>()
        const tables = results[0].rows.map((row: any) => row.table_name)
        
        if (tables.length > 0) {
          try {
            // Build a UNION ALL query to fetch all table columns at once
            // Each subquery returns: table_name, column_name, type, notnull_flag
            const unionQueries = tables.map((tableName: string) => {
              const escapedName = tableName.replace(/'/g, "''")
              return `SELECT '${escapedName}' as table_name, name as column_name, type, "notnull" as notnull_flag FROM pragma_table_info('${escapedName}')`
            })
            
            const batchSql = unionQueries.join(' UNION ALL ')
            const columnResults = await apiService.execute(batchSql)

            if (columnResults[0]?.rows) {
              // Group columns by table name
              const columnsByTable: Record<string, string[]> = {}
              const columnInfoByTable: Record<string, ColumnInfo[]> = {}
              
              columnResults[0].rows.forEach((col: any) => {
                const tableName = col.table_name
                
                // For schemaMap (autocomplete - just column names)
                if (!columnsByTable[tableName]) {
                  columnsByTable[tableName] = []
                }
                columnsByTable[tableName].push(col.column_name)
                
                // For columnInfoCache (full column info for tree display)
                if (!columnInfoByTable[tableName]) {
                  columnInfoByTable[tableName] = []
                }
                columnInfoByTable[tableName].push({
                  name: col.column_name,
                  type: col.type,
                  notnull: col.notnull_flag
                })
              })

              // Populate schema map and column info cache
              Object.entries(columnsByTable).forEach(([tableName, columns]) => {
                newSchemaMap.set(tableName, columns)
              })
              Object.entries(columnInfoByTable).forEach(([tableName, columnInfos]) => {
                newColumnInfoCache.set(tableName, columnInfos)
              })
            }
          } catch (error) {
            console.error('Failed to batch preload columns:', error)
            // Fallback: Don't populate schemaMap, columns will be loaded on-demand
          }
        }
        
        set({ schemaMap: newSchemaMap, columnInfoCache: newColumnInfoCache })
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
    const { loadingKeys, columnInfoCache } = get()

    // Prevent duplicate loading
    if (loadingKeys.has(nodeKey)) {
      return
    }

    // Check if tree already has children loaded
    if (node.children && node.children.length > 0) {
      // Already loaded in tree, no need to fetch again
      return
    }

    // Check if columns are in the cache (loaded during initialization)
    if (node.type === 'table' && columnInfoCache.has(node.tableName!)) {
      // Build tree nodes from cache - NO HTTP REQUEST needed!
      const cachedColumnInfo = columnInfoCache.get(node.tableName!)!
      
      const columnNodes: TreeNodeData[] = cachedColumnInfo.map(
        (col: ColumnInfo) => ({
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

      // Update tree with column nodes (synchronously from cache)
      set(state => ({
        treeData: updateNodeInTree(state.treeData, nodeKey, {
          children: columnNodes
        })
      }))
      return
    }

    // Not in cache - fetch from server (fallback case)
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

          // Update both caches for future use
          const { schemaMap, columnInfoCache } = get()
          const newSchemaMap = new Map(schemaMap)
          const newColumnInfoCache = new Map(columnInfoCache)
          
          newSchemaMap.set(
            node.tableName!,
            results[0].rows.map((col: any) => col.name)
          )
          newColumnInfoCache.set(
            node.tableName!,
            results[0].rows.map((col: any) => ({
              name: col.name,
              type: col.type,
              notnull: col.notnull
            }))
          )
          
          set({ schemaMap: newSchemaMap, columnInfoCache: newColumnInfoCache })
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
