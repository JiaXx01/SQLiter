import { create } from 'zustand'
import type {
  Tab,
  SqlEditorTab,
  TableViewTab,
  TableStructureTab,
  ApiResult,
  FilterCondition
} from '../types'
import { apiService, escapeIdentifier, toSqlValue } from '../services/api.service'

interface TabStoreState {
  tabs: Tab[]
  activeKey: string | null

  // Actions
  addTab: (
    tabConfig:
      | Omit<SqlEditorTab, 'key'>
      | Omit<TableViewTab, 'key'>
      | Omit<TableStructureTab, 'key'>
  ) => void
  removeTab: (key: string) => void
  setActiveKey: (key: string) => void

  // SQL Editor specific
  updateSqlTabState: (key: string, changes: Partial<SqlEditorTab>) => void
  executeSqlForTab: (key: string) => Promise<void>

  // Table View specific
  updateTableViewTabState: (key: string, changes: Partial<TableViewTab>) => void
  loadTableData: (key: string) => Promise<void>
  saveChangesForTableTab: (key: string) => Promise<void>
  updateCellValue: (
    key: string,
    rowid: number,
    columnName: string,
    newValue: string | number | boolean | null
  ) => void
  addNewRow: (key: string, rowData: Record<string, any>) => Promise<void>
  deleteRows: (key: string, rowids: number[]) => Promise<void>
  updateFilterConditions: (key: string, conditions: FilterCondition[]) => void

  // Table Structure specific
  updateTableStructureTabState: (
    key: string,
    changes: Partial<TableStructureTab>
  ) => void
  loadTableStructure: (key: string) => Promise<void>
  saveStructureChanges: (key: string) => Promise<void>
}

let tabIdCounter = 0

/**
 * Helper function to build WHERE clause from filter conditions
 */
function buildWhereClause(conditions: FilterCondition[]): string {
  if (conditions.length === 0) {
    return ''
  }

  // Filter out invalid conditions (empty values for operators that require values)
  const validConditions = conditions.filter(condition => {
    const { operator, value } = condition

    // NULL operators don't need values
    if (operator === 'IS NULL' || operator === 'IS NOT NULL') {
      return true
    }

    // All other operators require non-empty values
    return value && value.trim() !== ''
  })

  if (validConditions.length === 0) {
    return ''
  }

  const clauses = validConditions.map((condition, index) => {
    const { field, operator, value } = condition
    const escapedField = escapeIdentifier(field)
    let clause = ''

    // Handle NULL operators
    if (operator === 'IS NULL') {
      clause = `${escapedField} IS NULL`
    } else if (operator === 'IS NOT NULL') {
      clause = `${escapedField} IS NOT NULL`
    }
    // Handle IN operators
    else if (operator === 'IN' || operator === 'NOT IN') {
      // Parse comma-separated values
      const values = value.split(',').map(v => {
        const trimmed = v.trim()
        // Try to parse as number, otherwise treat as string
        if (!isNaN(Number(trimmed))) {
          return trimmed
        }
        return `'${trimmed.replace(/'/g, "''")}'`
      })
      clause = `${escapedField} ${operator} (${values.join(', ')})`
    }
    // Handle LIKE operators
    else if (operator === 'LIKE' || operator === 'NOT LIKE') {
      clause = `${escapedField} ${operator} '${value.replace(/'/g, "''")}'`
    }
    // Handle comparison operators
    else {
      // Try to parse as number, otherwise treat as string
      const sqlValue =
        !isNaN(Number(value)) && value.trim() !== ''
          ? value
          : `'${value.replace(/'/g, "''")}'`
      clause = `${escapedField} ${operator} ${sqlValue}`
    }

    // Add logic operator (AND/OR) except for the last condition
    if (index < validConditions.length - 1) {
      clause += ` ${condition.logic}`
    }

    return clause
  })

  return ' WHERE ' + clauses.join(' ')
}

export const useTabStore = create<TabStoreState>((set, get) => ({
  tabs: [],
  activeKey: null,

  /**
   * Add a new tab or activate existing one
   */
  addTab: tabConfig => {
    const state = get()

    // Check if a tab with the same content already exists
    let existingTab: Tab | undefined

    if (tabConfig.type === 'table_view') {
      // For table view tabs, check if the same table is already open
      existingTab = state.tabs.find(
        tab =>
          tab.type === 'table_view' &&
          tab.tableName === tabConfig.tableName &&
          tab.schemaName === tabConfig.schemaName
      )
    } else if (tabConfig.type === 'table_structure') {
      // For table structure tabs, check if the same table structure is already open
      existingTab = state.tabs.find(
        tab =>
          tab.type === 'table_structure' &&
          tab.tableName === tabConfig.tableName &&
          tab.schemaName === tabConfig.schemaName
      )
    } else if (tabConfig.type === 'sql_editor') {
      // For SQL editor tabs, always create a new tab (users may want multiple query tabs)
      existingTab = undefined
    }

    // If tab exists, just activate it
    if (existingTab) {
      set({ activeKey: existingTab.key })
      return
    }

    // Otherwise, create a new tab
    const key = `tab-${++tabIdCounter}`
    const newTab = { ...tabConfig, key } as Tab

    set(state => ({
      tabs: [...state.tabs, newTab],
      activeKey: key
    }))
  },

  /**
   * Remove a tab
   */
  removeTab: (key: string) => {
    set(state => {
      const newTabs = state.tabs.filter(tab => tab.key !== key)
      let newActiveKey = state.activeKey

      // If we're closing the active tab, activate the previous one
      if (state.activeKey === key) {
        if (newTabs.length > 0) {
          const closedIndex = state.tabs.findIndex(tab => tab.key === key)
          const newIndex = Math.max(0, closedIndex - 1)
          newActiveKey = newTabs[newIndex]?.key || null
        } else {
          newActiveKey = null
        }
      }

      return {
        tabs: newTabs,
        activeKey: newActiveKey
      }
    })
  },

  /**
   * Set active tab
   */
  setActiveKey: (key: string) => {
    set({ activeKey: key })
  },

  /**
   * Update SQL editor tab state
   */
  updateSqlTabState: (key: string, changes: Partial<SqlEditorTab>) => {
    set(state => ({
      tabs: state.tabs.map(tab =>
        tab.key === key && tab.type === 'sql_editor'
          ? { ...tab, ...changes }
          : tab
      )
    }))
  },

  /**
   * Execute SQL for a SQL editor tab
   */
  executeSqlForTab: async (key: string) => {
    const state = get()
    const tab = state.tabs.find(t => t.key === key)

    if (!tab || tab.type !== 'sql_editor') {
      return
    }

    if (!tab.sql.trim()) {
      return
    }

    // Set loading state
    get().updateSqlTabState(key, { isLoading: true })

    try {
      const results = await apiService.execute(tab.sql)

      // Update with results
      get().updateSqlTabState(key, {
        isLoading: false,
        results
      })
    } catch (error) {
      // Handle network error
      const errorResult: ApiResult = {
        rows: null,
        rowCount: 0,
        error: `Network error: ${
          error instanceof Error ? error.message : String(error)
        }`
      }

      get().updateSqlTabState(key, {
        isLoading: false,
        results: [errorResult]
      })
    }
  },

  /**
   * Update table view tab state
   */
  updateTableViewTabState: (key: string, changes: Partial<TableViewTab>) => {
    set(state => ({
      tabs: state.tabs.map(tab =>
        tab.key === key && tab.type === 'table_view'
          ? { ...tab, ...changes }
          : tab
      )
    }))
  },

  /**
   * Load table data for a table view tab
   */
  loadTableData: async (key: string) => {
    const state = get()
    const tab = state.tabs.find(t => t.key === key)

    if (!tab || tab.type !== 'table_view') {
      return
    }

    get().updateTableViewTabState(key, { isLoading: true, error: null })

    try {
      const { tableName, page, pageSize, filterConditions } = tab
      const offset = (page - 1) * pageSize
      const escapedTableName = escapeIdentifier(tableName)

      // Load column info (including primary key) - SQLite uses PRAGMA
      // Note: PRAGMA table_info requires single-quoted strings for reserved keywords
      // Double quotes don't work, but single quotes do
      const columnsSql = `PRAGMA table_info('${tableName.replace(/'/g, "''")}')`
      const columnsResults = await apiService.execute(columnsSql)

      if (columnsResults[0]?.error) {
        get().updateTableViewTabState(key, {
          isLoading: false,
          error: columnsResults[0].error
        })
        return
      }

      const pragmaColumns = columnsResults[0]?.rows || []

      // Convert PRAGMA table_info format to our ColumnInfo format
      // PRAGMA returns: { cid, name, type, notnull, dflt_value, pk }
      const columns = pragmaColumns.map((col: any) => ({
        column_name: col.name,
        data_type: col.type,
        is_nullable: col.notnull === 0 ? 'YES' : 'NO',
        character_maximum_length: null,
        numeric_precision: null,
        is_primary_key: col.pk === 1
      }))

      // Find primary key
      const pkColumn = columns.find((col: any) => col.is_primary_key)
      const primaryKey = pkColumn?.column_name || 'rowid'

      // Build WHERE clause from filter conditions
      const whereClause = buildWhereClause(filterConditions)

      // Always load rowid for consistent row identification
      // This simplifies logic for tracking changes, especially when PK is modified
      const dataSql = `SELECT rowid, * FROM ${escapedTableName}${whereClause} LIMIT ${pageSize} OFFSET ${offset}`
      const dataResults = await apiService.execute(dataSql)

      if (dataResults[0]?.error) {
        get().updateTableViewTabState(key, {
          isLoading: false,
          error: dataResults[0].error
        })
        return
      }

      const data = dataResults[0]?.rows || []

      get().updateTableViewTabState(key, {
        isLoading: false,
        data,
        columns,
        primaryKey,
        total: data.length // In real app, would do COUNT(*) query
      })
    } catch (error) {
      get().updateTableViewTabState(key, {
        isLoading: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  },

  /**
   * Update a cell value in the table (marks as dirty)
   * Now uses rowid as the stable row identifier
   */
  updateCellValue: (
    key: string,
    rowid: number,
    columnName: string,
    newValue: string | number | boolean | null
  ) => {
    set(state => {
      const tabs = state.tabs.map(tab => {
        if (tab.key !== key || tab.type !== 'table_view') {
          return tab
        }

        // Update the data array - simple rowid matching
        const newData = tab.data.map(row => {
          if (row.rowid === rowid) {
            return { ...row, [columnName]: newValue }
          }
          return row
        })

        // Update dirty changes map using rowid as key
        const newDirtyChanges = new Map(tab.dirtyChanges)
        const existingChanges = newDirtyChanges.get(rowid) || {}

        newDirtyChanges.set(rowid, {
          ...existingChanges,
          [columnName]: newValue
        })

        return {
          ...tab,
          data: newData,
          dirtyChanges: newDirtyChanges
        }
      })

      return { tabs }
    })
  },

  /**
   * Save all pending changes for a table view tab
   */
  saveChangesForTableTab: async (key: string) => {
    const state = get()
    const tab = state.tabs.find(t => t.key === key)

    if (!tab || tab.type !== 'table_view') {
      return
    }

    if (tab.dirtyChanges.size === 0) {
      return
    }

    get().updateTableViewTabState(key, { isLoading: true })

    try {
      // Generate UPDATE statements for each dirty row
      // Now using rowid as the stable identifier
      const updateStatements: string[] = []
      const escapedTableName = escapeIdentifier(tab.tableName)

      tab.dirtyChanges.forEach((changes, rowid) => {
        const setClauses = Object.entries(changes)
          .map(([colName, value]) => {
            const escapedColName = escapeIdentifier(colName)
            const sqlValue = toSqlValue(value)
            return `${escapedColName} = ${sqlValue}`
          })
          .join(', ')

        // Simple WHERE clause using rowid - no need for complex logic
        const whereClause = `rowid = ${rowid}`

        updateStatements.push(
          `UPDATE ${escapedTableName} SET ${setClauses} WHERE ${whereClause}`
        )
      })

      // Execute batch update
      const batchSql = updateStatements.join('; ')
      const results = await apiService.execute(batchSql)

      // Check for errors
      const hasErrors = results.some(r => r.error)
      if (hasErrors) {
        const firstError = results.find(r => r.error)?.error
        get().updateTableViewTabState(key, {
          isLoading: false,
          error: firstError || 'Failed to save changes'
        })
        return
      }

      // Clear dirty changes and reload data
      get().updateTableViewTabState(key, {
        dirtyChanges: new Map()
      })

      await get().loadTableData(key)
    } catch (error) {
      get().updateTableViewTabState(key, {
        isLoading: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  },

  /**
   * Add a new row to the table
   */
  addNewRow: async (key: string, rowData: Record<string, any>) => {
    const state = get()
    const tab = state.tabs.find(t => t.key === key)

    if (!tab || tab.type !== 'table_view') {
      return
    }

    get().updateTableViewTabState(key, { isLoading: true, error: null })

    try {
      // Build INSERT statement
      const columns = Object.keys(rowData).filter(
        col => rowData[col] !== undefined
      )
      const escapedTableName = escapeIdentifier(tab.tableName)
      const escapedColumns = columns.map(col => escapeIdentifier(col))
      const values = columns.map(col => toSqlValue(rowData[col]))

      const sql = `INSERT INTO ${escapedTableName} (${escapedColumns.join(
        ', '
      )}) VALUES (${values.join(', ')})`
      const results = await apiService.execute(sql)

      if (results[0]?.error) {
        get().updateTableViewTabState(key, {
          isLoading: false,
          error: results[0].error
        })
        throw new Error(results[0].error)
      }

      // Reload table data
      await get().loadTableData(key)
    } catch (error) {
      get().updateTableViewTabState(key, {
        isLoading: false,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  },

  /**
   * Update filter conditions for a table view tab
   */
  updateFilterConditions: (key: string, conditions: FilterCondition[]) => {
    get().updateTableViewTabState(key, { filterConditions: conditions })
    // Automatically reload data with new filter conditions
    get().loadTableData(key)
  },

  /**
   * Delete rows from the table using rowid
   */
  deleteRows: async (key: string, rowids: number[]) => {
    const state = get()
    const tab = state.tabs.find(t => t.key === key)

    if (!tab || tab.type !== 'table_view') {
      return
    }

    if (rowids.length === 0) {
      return
    }

    get().updateTableViewTabState(key, { isLoading: true, error: null })

    try {
      // Build DELETE statements using rowid - simple and consistent
      const escapedTableName = escapeIdentifier(tab.tableName)
      const deleteStatements = rowids.map(rowid => {
        return `DELETE FROM ${escapedTableName} WHERE rowid = ${rowid}`
      })

      const batchSql = deleteStatements.join('; ')
      const results = await apiService.execute(batchSql)

      // Check for errors
      const hasErrors = results.some(r => r.error)
      if (hasErrors) {
        const firstError = results.find(r => r.error)?.error
        get().updateTableViewTabState(key, {
          isLoading: false,
          error: firstError || 'Failed to delete rows'
        })
        throw new Error(firstError || 'Failed to delete rows')
      }

      // Reload table data
      await get().loadTableData(key)
    } catch (error) {
      get().updateTableViewTabState(key, {
        isLoading: false,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  },

  /**
   * Update table structure tab state
   */
  updateTableStructureTabState: (
    key: string,
    changes: Partial<TableStructureTab>
  ) => {
    set(state => ({
      tabs: state.tabs.map(tab =>
        tab.key === key && tab.type === 'table_structure'
          ? { ...tab, ...changes }
          : tab
      )
    }))
  },

  /**
   * Load table structure
   */
  loadTableStructure: async (key: string) => {
    const state = get()
    const tab = state.tabs.find(t => t.key === key)

    if (!tab || tab.type !== 'table_structure') {
      return
    }

    get().updateTableStructureTabState(key, { isLoading: true, error: null })

    try {
      // SQLite uses PRAGMA table_info
      // PRAGMA requires single-quoted strings for reserved keywords
      const sql = `PRAGMA table_info('${tab.tableName.replace(/'/g, "''")}')`
      const results = await apiService.execute(sql)

      if (results[0]?.error) {
        get().updateTableStructureTabState(key, {
          isLoading: false,
          error: results[0].error
        })
        return
      }

      // Convert PRAGMA table_info format to our ColumnInfo format
      // PRAGMA returns: { cid, name, type, notnull, dflt_value, pk }
      const pragmaColumns = results[0]?.rows || []
      const columns = pragmaColumns.map((col: any) => ({
        column_name: col.name,
        data_type: col.type,
        is_nullable: col.notnull === 0 ? 'YES' : 'NO',
        column_default: col.dflt_value,
        character_maximum_length: null,
        numeric_precision: null,
        is_primary_key: col.pk === 1
      }))

      get().updateTableStructureTabState(key, {
        isLoading: false,
        columns
      })
    } catch (error) {
      get().updateTableStructureTabState(key, {
        isLoading: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  },

  /**
   * Save structure changes (generate ALTER TABLE statements)
   */
  saveStructureChanges: async (key: string) => {
    const state = get()
    const tab = state.tabs.find(t => t.key === key)

    if (!tab || tab.type !== 'table_structure') {
      return
    }

    if (tab.dirtyStructureChanges.size === 0) {
      return
    }

    get().updateTableStructureTabState(key, { isLoading: true })

    try {
      // Generate ALTER TABLE statements
      const alterStatements: string[] = []
      const escapedTableName = escapeIdentifier(tab.tableName)

      tab.dirtyStructureChanges.forEach((changes, columnName) => {
        const escapedColumnName = escapeIdentifier(columnName)
        // Simplified: only handle column rename and type change
        if (changes.column_name && changes.column_name !== columnName) {
          const escapedNewColumnName = escapeIdentifier(changes.column_name)
          alterStatements.push(
            `ALTER TABLE ${escapedTableName} RENAME COLUMN ${escapedColumnName} TO ${escapedNewColumnName}`
          )
        }
        if (changes.data_type) {
          alterStatements.push(
            `ALTER TABLE ${escapedTableName} ALTER COLUMN ${escapedColumnName} TYPE ${changes.data_type}`
          )
        }
      })

      if (alterStatements.length > 0) {
        const batchSql = alterStatements.join('; ')
        const results = await apiService.execute(batchSql)

        const hasErrors = results.some(r => r.error)
        if (hasErrors) {
          const firstError = results.find(r => r.error)?.error
          get().updateTableStructureTabState(key, {
            isLoading: false,
            error: firstError || 'Failed to save structure changes'
          })
          return
        }
      }

      // Clear changes and reload
      get().updateTableStructureTabState(key, {
        dirtyStructureChanges: new Map()
      })

      await get().loadTableStructure(key)
    } catch (error) {
      get().updateTableStructureTabState(key, {
        isLoading: false,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
}))
