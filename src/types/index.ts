// =====================================================
// API Types
// =====================================================

/**
 * Result from executing a single SQL statement
 */
export interface ApiResult {
  rows: any[] | null // null for non-SELECT statements
  rowCount: number
  error: string | null
}

/**
 * Request payload for API
 */
export interface ExecuteRequest {
  sql: string
}

/**
 * Response from API (array of results for each statement)
 */
export type ExecuteResponse = ApiResult[]

// =====================================================
// Tab Types (Discriminated Union)
// =====================================================

export interface BaseTab {
  key: string
  title: string
}

export interface SqlEditorTab extends BaseTab {
  type: 'sql_editor'
  sql: string
  isLoading: boolean
  results: ApiResult[]
}

export interface TableViewTab extends BaseTab {
  type: 'table_view'
  tableName: string
  schemaName?: string
  isLoading: boolean
  data: any[]
  columns: ColumnInfo[]
  primaryKey: string | null // User-defined primary key column name, or null if no PK
  error: string | null
  dirtyChanges: Map<any, Record<string, any>> // Map<PrimaryKeyValue, ChangedFields>
  page: number
  pageSize: number
  total: number
  filterConditions: FilterCondition[] // Filter conditions for WHERE clause
}

export interface TableStructureTab extends BaseTab {
  type: 'table_structure'
  tableName: string
  schemaName?: string
  isLoading: boolean
  columns: ColumnInfo[]
  error: string | null
  dirtyStructureChanges: Map<string, Partial<ColumnInfo>> // Map<columnName, changes>
}

export type Tab = SqlEditorTab | TableViewTab | TableStructureTab

// =====================================================
// Schema Types
// =====================================================

export interface TreeNodeData {
  key: string
  title: string
  type: 'root' | 'database' | 'schema' | 'tables_folder' | 'table' | 'column'
  icon?: React.ReactNode
  isLeaf?: boolean
  children?: TreeNodeData[]
  // Metadata
  tableName?: string
  schemaName?: string
  databaseName?: string
  columnInfo?: ColumnInfo
}

export interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string // 'YES' | 'NO'
  column_default?: string | null
  character_maximum_length?: number | null
  numeric_precision?: number | null
  is_primary_key?: boolean
}

// =====================================================
// Filter Types
// =====================================================

export type FilterOperator =
  | '='
  | '!='
  | '>'
  | '<'
  | '>='
  | '<='
  | 'LIKE'
  | 'NOT LIKE'
  | 'IN'
  | 'NOT IN'
  | 'IS NULL'
  | 'IS NOT NULL'

export type FilterLogic = 'AND' | 'OR'

export interface FilterCondition {
  id: string
  field: string
  operator: FilterOperator
  value: string
  logic: FilterLogic // Logic operator to connect with next condition
}

// =====================================================
// Context Menu Types
// =====================================================

export interface ContextMenuAction {
  key: string
  label: string
  icon?: React.ReactNode
  danger?: boolean
  onClick: () => void
}
